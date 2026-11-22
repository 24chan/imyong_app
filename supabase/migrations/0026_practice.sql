/* 0026 실습초 (2026-11-22 사용자 승인)
   ① 실습학교 목록 제보: 글 + 사진·PDF 첨부(최대 5개) → 운영자가 목록에 옮겨 적고 처리하면 첨부는 바로 삭제
   ② 실습 후기: 학교마다, 교대·초등교육과 학교 인증 회원만. 화면에는 라벨 없이 '인증 회원'으로만(작은 학교에서 누군지 드러나지 않게)
   ③ 신고·가리기 대상에 실습 후기 추가
   여러 번 실행해도 안전 */

/* ───── ① 실습학교 목록 제보 ───── */
create table if not exists public.practice_tips (
  id bigserial primary key,
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  univ text not null check (char_length(univ) between 2 and 30),
  year int check (year between 2020 and 2100),
  note text check (note is null or char_length(note) <= 500),
  url text check (url is null or url ~ '^https?://'),
  file_paths text[] not null default '{}' check (cardinality(file_paths) <= 5),
  status text not null default 'pending' check (status in ('pending', 'done', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.practice_tips enable row level security;
revoke all on public.practice_tips from anon, authenticated;

insert into storage.buckets (id, name, public) values ('practice-tips', 'practice-tips', false)
on conflict (id) do update set public = false;
drop policy if exists "실습 제보 첨부 올리기" on storage.objects;
create policy "실습 제보 첨부 올리기" on storage.objects for insert to authenticated
  with check (bucket_id = 'practice-tips' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "실습 제보 첨부 보기" on storage.objects;
create policy "실습 제보 첨부 보기" on storage.objects for select to authenticated
  using (bucket_id = 'practice-tips' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "실습 제보 첨부 지우기" on storage.objects;
create policy "실습 제보 첨부 지우기" on storage.objects for delete to authenticated
  using (bucket_id = 'practice-tips' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create or replace function public.submit_practice_tip(p_univ text, p_year int, p_note text, p_url text, p_files text[])
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; f text;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if (select count(*) from public.practice_tips where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception '제보는 하루 5건까지 할 수 있어요';
  end if;
  if coalesce(cardinality(p_files), 0) = 0 and nullif(trim(coalesce(p_url, '')), '') is null and char_length(trim(coalesce(p_note, ''))) < 4 then
    raise exception '사진·PDF·주소·내용 중 하나는 넣어 주세요';
  end if;
  foreach f in array coalesce(p_files, '{}') loop
    if split_part(f, '/', 1) <> auth.uid()::text then raise exception '첨부 파일이 올바르지 않아요'; end if;
  end loop;
  insert into public.practice_tips (univ, year, note, url, file_paths)
  values (trim(p_univ), p_year, nullif(trim(coalesce(p_note, '')), ''), nullif(trim(coalesce(p_url, '')), ''), coalesce(p_files, '{}'))
  returning id into v_id;
  return v_id;
end $$;

/* 운영자 보기 (보낸 사람은 안 보임) */
create or replace view public.admin_practice_tips_v as
  select id, univ, year, note, url, file_paths, created_at
    from public.practice_tips where status = 'pending' and public.is_admin();
grant select on public.admin_practice_tips_v to authenticated;

/* 처리: 첨부 목록을 비우면 남은 파일은 storage-cleanup이 하루 뒤 지움(앱도 바로 지움) */
create or replace function public.admin_finish_practice_tip(p_id bigint, p_done boolean)
returns text[] language plpgsql security definer set search_path = public as $$
declare v_files text[];
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  select file_paths into v_files from public.practice_tips where id = p_id and status = 'pending';
  if not found then raise exception '이미 처리된 제보예요'; end if;
  update public.practice_tips set status = case when p_done then 'done' else 'rejected' end, file_paths = '{}', reviewed_at = now() where id = p_id;
  return v_files;
end $$;

/* 남은 파일 정리 함수에 실습 제보 첨부 추가 (처리됐거나 30일 지난 것) */
create or replace function public.orphan_storage_objects()
returns table (bucket text, path text)
language sql stable security definer set search_path = public, storage as $$
  select o.bucket_id::text, o.name::text
  from storage.objects o
  where o.created_at < now() - interval '1 day'
    and (
      (o.bucket_id = 'dm-images'
        and not exists (select 1 from public.messages m where m.image_path = o.name))
      or (o.bucket_id = 'verify-docs'
        and not exists (select 1 from public.verifications v where o.name = any (v.doc_paths)))
      or (o.bucket_id = 'enroll-docs'
        and not exists (select 1 from public.enrollments e where o.name = any (e.doc_paths)))
      or (o.bucket_id = 'pass-docs'
        and not exists (select 1 from public.pass_certs p where o.name = any (p.doc_paths)))
      or (o.bucket_id = 'practice-tips'
        and (o.created_at < now() - interval '30 days'
             or not exists (select 1 from public.practice_tips t where o.name = any (t.file_paths) and t.status = 'pending')))
    )
  order by o.created_at
  limit 1000;
$$;
revoke all on function public.orphan_storage_objects() from public, anon, authenticated;
grant execute on function public.orphan_storage_objects() to service_role;

/* ───── ② 실습 후기 ───── */
create table if not exists public.practice_reviews (
  id bigint generated always as identity primary key,
  school text not null check (char_length(school) between 3 and 80),   /* '지역|학교 정식 이름' */
  author_id uuid not null references auth.users(id) on delete cascade,
  year int not null check (year between 2015 and 2100),
  atmosphere int not null check (atmosphere between 1 and 5),   /* 분위기 */
  guidance int not null check (guidance between 1 and 5),       /* 지도·배려 */
  commute int not null check (commute between 1 and 5),         /* 다니기 편함 */
  recommend boolean not null,
  body text not null check (char_length(body) between 10 and 500),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  unique (school, author_id, year)
);
alter table public.practice_reviews enable row level security;
revoke all on public.practice_reviews from anon, authenticated;
create index if not exists practice_reviews_school on public.practice_reviews (school) where status = 'visible';

create or replace view public.practice_reviews_v as
  select r.id, r.school, r.year, r.atmosphere, r.guidance, r.commute, r.recommend, r.body, r.created_at, (r.author_id = auth.uid()) as is_mine
    from public.practice_reviews r
   where r.status = 'visible'
     and not exists (select 1 from public.blocks k where k.blocker_id = auth.uid() and k.blocked_id = r.author_id);
grant select on public.practice_reviews_v to anon, authenticated;

create or replace function public.upsert_practice_review(p_school text, p_year int, p_atmosphere int, p_guidance int, p_commute int, p_recommend boolean, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.check_writer(null, p_body);  /* 로그인·이용 제한·금지어 */
  if not exists (select 1 from public.verifications v join public.univs u on u.code = v.univ_code
                  where v.user_id = auth.uid() and v.status = 'approved' and v.kind = 'school' and u.kind in ('edu', 'elem')) then
    raise exception '교대·초등교육과 학교 인증을 한 사람만 실습 후기를 쓸 수 있어요';
  end if;
  if p_year > extract(year from now())::int + 1 then raise exception '실습한 학년도를 확인해 주세요'; end if;
  insert into public.practice_reviews (school, author_id, year, atmosphere, guidance, commute, recommend, body)
  values (p_school, auth.uid(), p_year, p_atmosphere, p_guidance, p_commute, p_recommend, trim(p_body))
  on conflict (school, author_id, year) do update set atmosphere = excluded.atmosphere, guidance = excluded.guidance, commute = excluded.commute,
    recommend = excluded.recommend, body = excluded.body, status = 'visible', created_at = now();
end $$;

create or replace function public.delete_practice_review(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.practice_reviews set status = 'deleted' where id = p_id and (author_id = auth.uid() or public.is_admin());
end $$;

/* ───── ③ 신고 대상에 실습 후기 추가 (0013 정의 + practice_review) ───── */
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'comment', 'message', 'study', 'material', 'mock_review', 'lecture_review', 'practice_review'));

create or replace function public.author_of(p_type text, p_id bigint) returns uuid
language sql stable security definer set search_path = public as $$
  select case p_type
    when 'post' then (select author_id from public.posts where id = p_id)
    when 'comment' then (select author_id from public.comments where id = p_id)
    when 'message' then (select sender_id from public.messages where id = p_id)
    when 'study' then (select author_id from public.studies where id = p_id)
    when 'material' then (select author_id from public.materials where id = p_id)
    when 'mock_review' then (select author_id from public.mock_reviews where id = p_id)
    when 'lecture_review' then (select author_id from public.lecture_reviews where id = p_id)
    when 'practice_review' then (select author_id from public.practice_reviews where id = p_id)
  end;
$$;
revoke all on function public.author_of(text, bigint) from public, anon, authenticated;

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
  /* 실습 후기는 특정 학교·사람 이야기라 3명이면 바로 가림 */
  if n >= 5 or (p_type = 'practice_review' and n >= 3) then
    case p_type
      when 'post' then update public.posts set status = 'hidden', hidden_reason = '신고 누적' where id = p_id and status = 'visible';
      when 'comment' then update public.comments set status = 'hidden' where id = p_id and status = 'visible';
      when 'study' then update public.studies set status = 'hidden' where id = p_id and status in ('open', 'closed');
      when 'material' then update public.materials set status = 'hidden' where id = p_id and status = 'visible';
      when 'mock_review' then update public.mock_reviews set status = 'hidden' where id = p_id and status = 'visible';
      when 'lecture_review' then update public.lecture_reviews set status = 'hidden' where id = p_id and status = 'visible';
      when 'practice_review' then update public.practice_reviews set status = 'hidden' where id = p_id and status = 'visible';
      else null;
    end case;
  end if;
  return n;
end; $$;

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
           when 'lecture_review' then (select '[강의 후기] ' || left(body, 300) from public.lecture_reviews where id = r.target_id)
           when 'practice_review' then (select '[실습 후기] ' || split_part(school, '|', 2) || ' — ' || left(body, 300) from public.practice_reviews where id = r.target_id)
         end as content,
         case r.target_type
           when 'post' then (select status from public.posts where id = r.target_id)
           when 'comment' then (select status from public.comments where id = r.target_id)
           when 'study' then (select status from public.studies where id = r.target_id)
           when 'material' then (select status from public.materials where id = r.target_id)
           when 'mock_review' then (select status from public.mock_reviews where id = r.target_id)
           when 'lecture_review' then (select status from public.lecture_reviews where id = r.target_id)
           when 'practice_review' then (select status from public.practice_reviews where id = r.target_id)
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
    execute format('update public.%I set status = $1 where id = $2',
      case p_type when 'comment' then 'comments' when 'study' then 'studies' when 'material' then 'materials'
                  when 'mock_review' then 'mock_reviews' when 'lecture_review' then 'lecture_reviews'
                  when 'practice_review' then 'practice_reviews' end)
      using v_status, p_id;
  end if;
  update public.reports set status = 'resolved' where target_type = p_type and target_id = p_id;
  if p_sanction is not null and v_author is not null then
    v_end := case p_sanction when 'write_7d' then now() + interval '7 days' when 'write_30d' then now() + interval '30 days' else null end;
    insert into public.sanctions (user_id, level, reason, ends_at) values (v_author, p_sanction, coalesce(p_reason, '운영 규칙 위반'), v_end);
  end if;
end; $$;

do $$
declare f text;
begin
  foreach f in array array[
    'submit_practice_tip(text,int,text,text,text[])', 'admin_finish_practice_tip(bigint,boolean)',
    'upsert_practice_review(text,int,int,int,int,boolean,text)', 'delete_practice_review(bigint)',
    'report_content(text,bigint,text,text)', 'admin_resolve(text,bigint,text,text,text,int)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '0026 완료' as result;
