/* v1 설치 4/9 — 순서대로 실행하세요. 여러 번 실행해도 안전해요. */
create or replace function public.send_message(p_conv uuid, p_body text, p_image text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare c public.conversations%rowtype; v_other uuid; v_id bigint; v_run int;
begin
  perform public.check_writer(null, p_body);
  select * into c from public.conversations where id = p_conv and auth.uid() in (a_id, b_id);
  if c.id is null then raise exception '대화를 찾을 수 없어요'; end if;
  v_other := case when c.a_id = auth.uid() then c.b_id else c.a_id end;
  if exists (select 1 from public.blocks where (blocker_id = v_other and blocked_id = auth.uid()) or (blocker_id = auth.uid() and blocked_id = v_other)) then
    raise exception '쪽지를 보낼 수 없는 상대예요';
  end if;
  /* 상대가 답장하기 전에는 3통까지 */
  select count(*) into v_run from public.messages
   where conversation_id = p_conv and sender_id = auth.uid()
     and id > coalesce((select max(id) from public.messages where conversation_id = p_conv and sender_id = v_other), 0);
  if v_run >= 3 then raise exception '상대가 답장하기 전에는 3통까지 보낼 수 있어요'; end if;
  if p_image is not null and split_part(p_image, '/', 1) <> p_conv::text then raise exception '사진 경로가 올바르지 않아요'; end if;
  insert into public.messages (conversation_id, sender_id, body, image_path)
  values (p_conv, auth.uid(), nullif(trim(coalesce(p_body, '')), ''), p_image) returning id into v_id;
  update public.conversations set last_at = now() where id = p_conv;
  return v_id;
end; $$;

create or replace function public.get_messages(p_conv uuid, p_before bigint default null) returns table (
  id bigint, body text, image_path text, created_at timestamptz, is_mine boolean, read_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_conv_member(p_conv) then raise exception '대화를 찾을 수 없어요'; end if;
  update public.messages m set read_at = now()
   where m.conversation_id = p_conv and m.sender_id <> auth.uid() and m.read_at is null;
  return query
    select m.id, m.body, m.image_path, m.created_at, (m.sender_id = auth.uid()), m.read_at
      from public.messages m
     where m.conversation_id = p_conv and (p_before is null or m.id < p_before)
     order by m.id desc limit 50;
end; $$;

create or replace function public.leave_conversation(p_conv uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_conv_member(p_conv) then raise exception '대화를 찾을 수 없어요'; end if;
  if exists (select 1 from public.reports r join public.messages m on r.target_type = 'message' and r.target_id = m.id
              where m.conversation_id = p_conv and r.status = 'open') then
    raise exception '신고를 확인하는 중인 대화라 지금은 나갈 수 없어요 (차단은 할 수 있어요)';
  end if;
  delete from public.conversations where id = p_conv;
end; $$;

create or replace function public.set_dm_off(p_off boolean) returns void
language sql security definer set search_path = public as $$
  update public.profiles set dm_off = p_off where id = auth.uid();
$$;

/* 쪽지 사진 저장소 (비공개). 경로 = <대화 id>/<파일>, 대화 참여자만 */
insert into storage.buckets (id, name, public) values ('dm-images', 'dm-images', false)
on conflict (id) do update set public = false;
drop policy if exists "쪽지 사진 올리기" on storage.objects;
create policy "쪽지 사진 올리기" on storage.objects for insert to authenticated
  with check (bucket_id = 'dm-images' and public.is_conv_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "쪽지 사진 보기" on storage.objects;
create policy "쪽지 사진 보기" on storage.objects for select to authenticated
  using (bucket_id = 'dm-images' and (public.is_conv_member(((storage.foldername(name))[1])::uuid) or public.is_admin()));

/* ───── 운영자 ───── */
create or replace view public.admin_reports_v as
  select r.target_type, r.target_id, count(*) as reports, min(r.created_at) as first_at,
         string_agg(distinct r.reason, ', ') as reasons,
         case r.target_type
           when 'post' then (select title || ' — ' || left(body, 200) from public.posts where id = r.target_id)
           when 'comment' then (select left(body, 300) from public.comments where id = r.target_id)
           when 'message' then (select coalesce(left(body, 300), '[사진]') from public.messages where id = r.target_id)
         end as content,
         case r.target_type
           when 'post' then (select status from public.posts where id = r.target_id)
           when 'comment' then (select status from public.comments where id = r.target_id)
           else 'visible'
         end as content_status,
         (select count(*) from public.sanctions s where s.user_id = public.author_of(r.target_type, r.target_id)) as author_sanctions
    from public.reports r
   where r.status = 'open' and public.is_admin()
   group by r.target_type, r.target_id;
grant select on public.admin_reports_v to authenticated;

create or replace view public.admin_appeals_v as
  select s.id, s.level, s.reason, s.starts_at, s.ends_at, s.appeal, s.created_at
    from public.sanctions s where s.appeal_status = 'open' and public.is_admin();
grant select on public.admin_appeals_v to authenticated;

/* 신고 처리: keep(문제없음) / hide(숨김, 임시조치 최대 30일) / delete(삭제). 필요하면 작성자 제재 */
create or replace function public.admin_resolve(p_type text, p_id bigint, p_action text, p_sanction text default null, p_reason text default null, p_hide_days int default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_end timestamptz;
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  v_author := public.author_of(p_type, p_id);
  if p_action = 'keep' then
    if p_type = 'post' then update public.posts set status = 'visible', hidden_reason = null, hidden_until = null where id = p_id and status = 'hidden';
    elsif p_type = 'comment' then update public.comments set status = 'visible' where id = p_id and status = 'hidden';
    end if;
  elsif p_action = 'hide' then
    if p_type = 'post' then
      update public.posts set status = 'hidden', hidden_reason = coalesce(p_reason, '운영 규칙 위반'),
        hidden_until = case when p_hide_days is null then null else now() + make_interval(days => least(p_hide_days, 30)) end
       where id = p_id;
    elsif p_type = 'comment' then update public.comments set status = 'hidden' where id = p_id;
    end if;
  elsif p_action = 'delete' then
    if p_type = 'post' then update public.posts set status = 'deleted' where id = p_id;
    elsif p_type = 'comment' then update public.comments set status = 'deleted' where id = p_id;
    elsif p_type = 'message' then update public.messages set body = '운영 규칙 위반으로 삭제된 쪽지예요', image_path = null where id = p_id;
    end if;
  else
    raise exception '처리 방법이 올바르지 않아요';
  end if;
  update public.reports set status = 'resolved' where target_type = p_type and target_id = p_id;
  if p_sanction is not null and v_author is not null then
    v_end := case p_sanction when 'write_7d' then now() + interval '7 days' when 'write_30d' then now() + interval '30 days' else null end;
    insert into public.sanctions (user_id, level, reason, ends_at) values (v_author, p_sanction, coalesce(p_reason, '운영 규칙 위반'), v_end);
  end if;
end; $$;

create or replace function public.admin_appeal(p_id bigint, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  update public.sanctions set appeal_status = case when p_accept then 'accepted' else 'rejected' end where id = p_id;
end; $$;

/* 함수 실행 권한 */
do $$
declare f text;
begin
  foreach f in array array[
    'create_post(text,text,text,uuid)', 'update_post(bigint,text,text)', 'delete_post(bigint)',
    'create_comment(bigint,text,bigint,uuid)', 'delete_comment(bigint)', 'toggle_post_like(bigint)', 'toggle_comment_like(bigint)',
    'toggle_scrap(bigint)', 'report_content(text,bigint,text,text)', 'block_author(text,text)', 'clear_blocks()',
    'appeal_sanction(bigint,text)', 'start_conversation(text,bigint,uuid)', 'send_message(uuid,text,text)',
    'get_messages(uuid,bigint)', 'leave_conversation(uuid)', 'set_dm_off(boolean)', 'admin_resolve(text,bigint,text,text,text,int)',
    'admin_appeal(bigint,boolean)', 'is_conv_member(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  revoke all on function public.check_writer(uuid, text) from public, anon, authenticated;
  revoke all on function public.active_write_ban(uuid) from public, anon, authenticated;
end $$;

select (select count(*) from public.boards) as "게시판 수";

/* ===== 0012_study ===== */
/* 0012 스터디 모집 · 공부 자료 · 모의고사 (일정·후기·점수 비교)
   - 공부 자료는 직접 쓴 글만 (파일·사진 업로드 없음 → 교재·강의 PDF 공유 차단)
   - 쓰기는 인증 회원만(0011 의 check_writer), 신고·숨김·제재는 커뮤니티와 같은 방식
   0011 다음에 실행. 여러 번 실행해도 괜찮아요. */

create table if not exists public.studies (
  id bigint generated always as identity primary key,
  author_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  level text not null check (level in ('elementary', 'secondary')),
  subject_code text references public.subjects(code),
  regions text[] not null default '{}',          /* 오프라인 지역 (시도 코드) */
  stage text not null check (stage in ('first', 'second', 'both')),
  mode text not null check (mode in ('online', 'offline', 'both')),
  capacity int not null check (capacity between 2 and 30),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 3000),
  status text not null default 'open' check (status in ('open', 'closed', 'hidden', 'deleted')),
  created_at timestamptz not null default now()
);
create index if not exists studies_list on public.studies (level, status, id desc);

create table if not exists public.materials (
  id bigint generated always as identity primary key,
  author_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  level text not null check (level in ('elementary', 'secondary')),
  subject_code text references public.subjects(code),
  area text not null default 'major' check (area in ('pedagogy', 'major', 'second', 'etc')),  /* 교육학·전공·2차·기타 */
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 20 and 20000),
  like_count int not null default 0,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists materials_list on public.materials (level, id desc);
create table if not exists public.material_likes (material_id bigint references public.materials(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, primary key (material_id, user_id));

create table if not exists public.mock_exams (
  id bigint generated always as identity primary key,
  name text not null,
  provider text not null,                          /* 주관 (학원·기관) */
  level text not null check (level in ('elementary', 'secondary')),
  subject_code text references public.subjects(code),
  exam_date date,
  apply_url text,
  note text,
  created_at timestamptz not null default now()
);
create table if not exists public.mock_reviews (
  id bigint generated always as identity primary key,
  exam_id bigint not null references public.mock_exams(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  rating int not null check (rating between 1 and 5),
  difficulty int not null check (difficulty between 1 and 5),
  body text not null check (char_length(body) between 5 and 2000),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  unique (exam_id, author_id)
);

select '4/9 완료' as result;
