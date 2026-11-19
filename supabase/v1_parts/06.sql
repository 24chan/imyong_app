/* v1 설치 6/9 — 순서대로 실행하세요. 여러 번 실행해도 안전해요. */
create or replace function public.report_content(p_type text, p_id bigint, p_reason text, p_detail text default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int; v_author uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  v_author := public.author_of(p_type, p_id);
  if v_author is null then raise exception '신고할 대상을 찾을 수 없어요'; end if;
  if v_author = auth.uid() then raise exception '내 글은 신고할 수 없어요'; end if;
  if p_type = 'message' and not exists (
    select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
     where m.id = p_id and auth.uid() in (c.a_id, c.b_id)) then
    raise exception '신고할 대상을 찾을 수 없어요';
  end if;
  insert into public.reports (target_type, target_id, reporter_id, reason, detail)
  values (p_type, p_id, auth.uid(), p_reason, p_detail)
  on conflict (target_type, target_id, reporter_id) do nothing;
  select count(*) into n from public.reports where target_type = p_type and target_id = p_id and status = 'open';
  if n >= 5 then
    case p_type
      when 'post' then update public.posts set status = 'hidden', hidden_reason = '신고 누적' where id = p_id and status = 'visible';
      when 'comment' then update public.comments set status = 'hidden' where id = p_id and status = 'visible';
      when 'study' then update public.studies set status = 'hidden' where id = p_id and status in ('open', 'closed');
      when 'material' then update public.materials set status = 'hidden' where id = p_id and status = 'visible';
      when 'mock_review' then update public.mock_reviews set status = 'hidden' where id = p_id and status = 'visible';
      else null;
    end case;
  end if;
  return n;
end; $$;

/* 쪽지 시작: 스터디 모집 글에서도 (참여 문의) */
create or replace function public.start_conversation(p_type text, p_id bigint, p_verification uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_label text; v_other uuid; v_other_label text; v_title text; v_id uuid;
begin
  v_label := public.check_writer(p_verification, null);
  v_other := public.author_of(p_type, p_id);
  if v_other is null or v_other = auth.uid() then raise exception '쪽지를 보낼 수 없어요'; end if;
  if p_type = 'post' then select label, title into v_other_label, v_title from public.posts where id = p_id;
  elsif p_type = 'comment' then
    select c.label, p.title into v_other_label, v_title from public.comments c join public.posts p on p.id = c.post_id where c.id = p_id;
  elsif p_type = 'study' then select label, '[스터디] ' || title into v_other_label, v_title from public.studies where id = p_id;
  elsif p_type = 'material' then select label, '[자료] ' || title into v_other_label, v_title from public.materials where id = p_id;
  else raise exception '쪽지를 보낼 수 없어요';
  end if;
  if exists (select 1 from public.blocks where (blocker_id = v_other and blocked_id = auth.uid()) or (blocker_id = auth.uid() and blocked_id = v_other)) then
    raise exception '쪽지를 보낼 수 없는 상대예요';
  end if;
  if coalesce((select dm_off from public.profiles where id = v_other), false) then raise exception '상대가 쪽지 받기를 꺼 두었어요'; end if;
  select id into v_id from public.conversations
   where (a_id = auth.uid() and b_id = v_other) or (a_id = v_other and b_id = auth.uid())
   order by last_at desc limit 1;
  if v_id is not null then return v_id; end if;
  if (select count(*) from public.conversations where a_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception '새 쪽지 대화는 하루 20개까지 시작할 수 있어요';
  end if;
  insert into public.conversations (a_id, b_id, a_label, b_label, origin_title)
  values (auth.uid(), v_other, v_label, v_other_label, left(v_title, 60)) returning id into v_id;
  return v_id;
end; $$;

/* 운영자 신고 목록·처리에 새 대상 추가 */
create or replace view public.admin_reports_v as
  select r.target_type, r.target_id, count(*) as reports, min(r.created_at) as first_at,
         string_agg(distinct r.reason, ', ') as reasons,
         case r.target_type
           when 'post' then (select title || ' — ' || left(body, 200) from public.posts where id = r.target_id)
           when 'comment' then (select left(body, 300) from public.comments where id = r.target_id)
           when 'message' then (select coalesce(left(body, 300), '[사진]') from public.messages where id = r.target_id)
           when 'study' then (select '[스터디] ' || title || ' — ' || left(body, 200) from public.studies where id = r.target_id)
           when 'material' then (select '[자료] ' || title || ' — ' || left(body, 200) from public.materials where id = r.target_id)
           when 'mock_review' then (select '[모의고사 후기] ' || left(body, 300) from public.mock_reviews where id = r.target_id)
         end as content,
         case r.target_type
           when 'post' then (select status from public.posts where id = r.target_id)
           when 'comment' then (select status from public.comments where id = r.target_id)
           when 'study' then (select status from public.studies where id = r.target_id)
           when 'material' then (select status from public.materials where id = r.target_id)
           when 'mock_review' then (select status from public.mock_reviews where id = r.target_id)
           else 'visible'
         end as content_status,
         (select count(*) from public.sanctions s where s.user_id = public.author_of(r.target_type, r.target_id)) as author_sanctions
    from public.reports r
   where r.status = 'open' and public.is_admin()
   group by r.target_type, r.target_id;
grant select on public.admin_reports_v to authenticated;

create or replace function public.admin_resolve(p_type text, p_id bigint, p_action text, p_sanction text default null, p_reason text default null, p_hide_days int default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_end timestamptz; v_status text;
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  if p_action not in ('keep', 'hide', 'delete') then raise exception '처리 방법이 올바르지 않아요'; end if;
  v_author := public.author_of(p_type, p_id);
  if p_type = 'post' then
    if p_action = 'keep' then update public.posts set status = 'visible', hidden_reason = null, hidden_until = null where id = p_id and status = 'hidden';
    elsif p_action = 'hide' then update public.posts set status = 'hidden', hidden_reason = coalesce(p_reason, '운영 규칙 위반'),
      hidden_until = case when p_hide_days is null then null else now() + make_interval(days => least(p_hide_days, 30)) end where id = p_id;
    else update public.posts set status = 'deleted' where id = p_id; end if;
  elsif p_type = 'message' then
    if p_action = 'delete' then update public.messages set body = '운영 규칙 위반으로 삭제된 쪽지예요', image_path = null where id = p_id; end if;
  else
    v_status := case p_action when 'keep' then 'visible' when 'hide' then 'hidden' else 'deleted' end;
    if p_type = 'study' and v_status = 'visible' then v_status := 'open'; end if;
    execute format('update public.%I set status = $1 where id = $2', case p_type when 'comment' then 'comments' when 'study' then 'studies' when 'material' then 'materials' when 'mock_review' then 'mock_reviews' end)
      using v_status, p_id;
  end if;
  update public.reports set status = 'resolved' where target_type = p_type and target_id = p_id;
  if p_sanction is not null and v_author is not null then
    v_end := case p_sanction when 'write_7d' then now() + interval '7 days' when 'write_30d' then now() + interval '30 days' else null end;
    insert into public.sanctions (user_id, level, reason, ends_at) values (v_author, p_sanction, coalesce(p_reason, '운영 규칙 위반'), v_end);
  end if;
end; $$;

create or replace function public.block_author(p_type text, p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare v_target uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if p_type = 'conversation' then
    select case when a_id = auth.uid() then b_id else a_id end into v_target
      from public.conversations where id = p_id::uuid and auth.uid() in (a_id, b_id);
  else
    v_target := public.author_of(p_type, p_id::bigint);
  end if;
  if v_target is null or v_target = auth.uid() then raise exception '차단할 수 없어요'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), v_target) on conflict do nothing;
end; $$;

do $$
declare f text;
begin
  foreach f in array array[
    'create_study(text,text,text[],text,text,int,text,text,uuid)', 'set_study_status(bigint,text)',
    'create_material(text,text,text,text,text,uuid)', 'update_material(bigint,text,text)', 'delete_material(bigint)', 'toggle_material_like(bigint)',
    'upsert_mock_review(bigint,int,int,text,uuid)', 'delete_mock_review(bigint)', 'add_mock_score(text,text,int,bigint,numeric,numeric)', 'delete_mock_score(bigint)',
    'admin_add_mock_exam(text,text,text,text,date,text,text)', 'admin_delete_mock_exam(bigint)',
    'report_content(text,bigint,text,text)', 'start_conversation(text,bigint,uuid)', 'admin_resolve(text,bigint,text,text,text,int)', 'block_author(text,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select (select count(*) from public.mock_exams) as "모의고사 일정 수";

/* ===== 0013_academy ===== */
/* 0013 학원·인강: 강의 목록(운영자 등록) · 수강 인증 · 강의 후기(수강 인증자만) · 개강·특강·모의고사 일정 · 광고(분리 표시)
   0012 다음에 실행. 여러 번 실행해도 괜찮아요. */

create table if not exists public.academies (
  id bigint generated always as identity primary key,
  name text not null unique,
  kind text not null default 'both' check (kind in ('offline', 'online', 'both')),
  url text,
  created_at timestamptz not null default now()
);
create table if not exists public.lectures (
  id bigint generated always as identity primary key,
  academy_id bigint not null references public.academies(id) on delete cascade,
  instructor text not null,
  title text not null,
  level text not null check (level in ('elementary', 'secondary')),
  area text not null check (area in ('pedagogy', 'major', 'second')),
  subject_code text references public.subjects(code),
  url text,
  created_at timestamptz not null default now()
);
create index if not exists lectures_list on public.lectures (level, area, subject_code);

create table if not exists public.lecture_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 2 and 300),
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);

/* 수강 인증: 수강 내역·영수증 화면 사진 → 운영자 확인 → 사진 즉시 삭제 */
create table if not exists public.enrollments (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  lecture_id bigint not null references public.lectures(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  doc_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (user_id, lecture_id)
);

create table if not exists public.lecture_reviews (
  id bigint generated always as identity primary key,
  lecture_id bigint not null references public.lectures(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  rating int not null check (rating between 1 and 5),
  delivery int not null check (delivery between 1 and 5),     /* 전달력 */
  material int not null check (material between 1 and 5),     /* 교재·자료 */
  care int not null check (care between 1 and 5),             /* 관리·피드백 */
  body text not null check (char_length(body) between 10 and 3000),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  unique (lecture_id, author_id)
);

select '6/9 완료' as result;
