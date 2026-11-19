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

create table if not exists public.academy_events (
  id bigint generated always as identity primary key,
  academy_id bigint references public.academies(id) on delete cascade,
  lecture_id bigint references public.lectures(id) on delete set null,
  kind text not null check (kind in ('open', 'special', 'mock')),     /* 개강·특강·모의고사 */
  title text not null,
  starts_on date not null,
  ends_on date,
  level text not null check (level in ('elementary', 'secondary')),
  area text check (area in ('pedagogy', 'major', 'second')),
  subject_code text references public.subjects(code),
  url text,
  created_at timestamptz not null default now()
);
create index if not exists academy_events_date on public.academy_events (level, starts_on);

/* 광고: 후기와 섞지 않고 '광고' 표시로 따로 보여 줌 */
create table if not exists public.ads (
  id bigint generated always as identity primary key,
  academy_id bigint references public.academies(id) on delete cascade,
  title text not null,
  body text,
  url text,
  level text check (level in ('elementary', 'secondary')),
  starts_on date not null default current_date,
  ends_on date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['academies','lectures','academy_events','ads'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "누구나 읽기" on public.%I', t);
    execute format('create policy "누구나 읽기" on public.%I for select to anon, authenticated using (true)', t);
    execute format('grant select on public.%I to anon, authenticated', t);
  end loop;
  foreach t in array array['lecture_requests','enrollments','lecture_reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

/* ───── 읽기 view ───── */
create or replace view public.lectures_v as
  select l.id, l.academy_id, a.name as academy_name, l.instructor, l.title, l.level, l.area, l.subject_code, l.url,
         (select count(*) from public.lecture_reviews r where r.lecture_id = l.id and r.status = 'visible') as review_count,
         (select round(avg(rating), 2) from public.lecture_reviews r where r.lecture_id = l.id and r.status = 'visible') as rating_avg,
         (select round(avg(delivery), 1) from public.lecture_reviews r where r.lecture_id = l.id and r.status = 'visible') as delivery_avg,
         (select round(avg(material), 1) from public.lecture_reviews r where r.lecture_id = l.id and r.status = 'visible') as material_avg,
         (select round(avg(care), 1) from public.lecture_reviews r where r.lecture_id = l.id and r.status = 'visible') as care_avg,
         (select status from public.enrollments e where e.lecture_id = l.id and e.user_id = auth.uid()) as my_enrollment
    from public.lectures l join public.academies a on a.id = l.academy_id;

create or replace view public.lecture_reviews_v as
  select r.id, r.lecture_id, r.label, r.rating, r.delivery, r.material, r.care, r.body, r.created_at, (r.author_id = auth.uid()) as is_mine
    from public.lecture_reviews r
   where r.status = 'visible'
     and not exists (select 1 from public.blocks k where k.blocker_id = auth.uid() and k.blocked_id = r.author_id);

create or replace view public.academy_events_v as
  select e.*, a.name as academy_name from public.academy_events e left join public.academies a on a.id = e.academy_id;

create or replace view public.ads_v as
  select d.id, d.title, d.body, d.url, d.level, a.name as academy_name
    from public.ads d left join public.academies a on a.id = d.academy_id
   where d.active and d.starts_on <= current_date and (d.ends_on is null or d.ends_on >= current_date);

grant select on public.lectures_v, public.lecture_reviews_v, public.academy_events_v, public.ads_v to anon, authenticated;

/* 운영자용: 수강 인증 대기, 강의 요청 */
create or replace view public.admin_enrollments_v as
  select e.id, e.lecture_id, l.title as lecture_title, l.instructor, a.name as academy_name, e.doc_paths, e.created_at
    from public.enrollments e join public.lectures l on l.id = e.lecture_id join public.academies a on a.id = l.academy_id
   where e.status = 'pending' and public.is_admin();
create or replace view public.admin_lecture_requests_v as
  select id, text, created_at from public.lecture_requests where status = 'open' and public.is_admin();
grant select on public.admin_enrollments_v, public.admin_lecture_requests_v to authenticated;

/* ───── 함수 ───── */
create or replace function public.request_lecture(p_text text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if (select count(*) from public.lecture_requests where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception '요청은 하루 5개까지 할 수 있어요';
  end if;
  insert into public.lecture_requests (user_id, text) values (auth.uid(), trim(p_text));
end; $$;

/* 수강 인증 신청: 사진 경로는 enroll-docs/<내 id>/... 만 */
create or replace function public.request_enrollment(p_lecture bigint, p_paths text[]) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint; p text;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if coalesce(array_length(p_paths, 1), 0) = 0 then raise exception '수강 내역 사진을 올려 주세요'; end if;
  foreach p in array p_paths loop
    if split_part(p, '/', 1) <> auth.uid()::text then raise exception '사진 경로가 올바르지 않아요'; end if;
  end loop;
  if exists (select 1 from public.enrollments where user_id = auth.uid() and lecture_id = p_lecture and status = 'approved') then
    raise exception '이미 수강 인증된 강의예요';
  end if;
  insert into public.enrollments (user_id, lecture_id, doc_paths) values (auth.uid(), p_lecture, p_paths)
  on conflict (user_id, lecture_id) do update set status = 'pending', doc_paths = excluded.doc_paths, reject_reason = null, created_at = now()
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.admin_review_enrollment(p_id bigint, p_approve boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  update public.enrollments set status = case when p_approve then 'approved' else 'rejected' end,
    reject_reason = case when p_approve then null else coalesce(p_reason, '확인이 어려워요') end, doc_paths = '{}', reviewed_at = now()
   where id = p_id;
end; $$;

create or replace function public.upsert_lecture_review(p_lecture bigint, p_rating int, p_delivery int, p_material int, p_care int, p_body text, p_verification uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_label text;
begin
  v_label := public.check_writer(p_verification, p_body);
  if not exists (select 1 from public.enrollments where user_id = auth.uid() and lecture_id = p_lecture and status = 'approved') then
    raise exception '수강 인증을 받은 사람만 후기를 쓸 수 있어요';
  end if;
  insert into public.lecture_reviews (lecture_id, author_id, label, rating, delivery, material, care, body)
  values (p_lecture, auth.uid(), v_label, p_rating, p_delivery, p_material, p_care, trim(p_body))
  on conflict (lecture_id, author_id) do update set rating = excluded.rating, delivery = excluded.delivery, material = excluded.material,
    care = excluded.care, body = excluded.body, label = excluded.label, status = 'visible', created_at = now();
end; $$;

create or replace function public.delete_lecture_review(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.lecture_reviews set status = 'deleted' where id = p_id and (author_id = auth.uid() or public.is_admin());
end; $$;

/* 운영자: 학원·강의·일정·광고 등록 */
create or replace function public.admin_add_lecture(p_academy text, p_instructor text, p_title text, p_level text, p_area text, p_subject text, p_url text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_ac bigint; v_id bigint;
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  insert into public.academies (name) values (trim(p_academy)) on conflict (name) do nothing;
  select id into v_ac from public.academies where name = trim(p_academy);
  insert into public.lectures (academy_id, instructor, title, level, area, subject_code, url)
  values (v_ac, trim(p_instructor), trim(p_title), p_level, p_area, nullif(p_subject, ''), nullif(trim(p_url), '')) returning id into v_id;
  update public.lecture_requests set status = 'done' where status = 'open' and position(lower(trim(p_instructor)) in lower(text)) > 0;
  return v_id;
end; $$;

create or replace function public.admin_add_event(p_academy text, p_kind text, p_title text, p_starts date, p_ends date, p_level text, p_area text, p_subject text, p_url text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_ac bigint; v_id bigint;
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  if nullif(trim(p_academy), '') is not null then
    insert into public.academies (name) values (trim(p_academy)) on conflict (name) do nothing;
    select id into v_ac from public.academies where name = trim(p_academy);
  end if;
  insert into public.academy_events (academy_id, kind, title, starts_on, ends_on, level, area, subject_code, url)
  values (v_ac, p_kind, trim(p_title), p_starts, p_ends, p_level, nullif(p_area, ''), nullif(p_subject, ''), nullif(trim(p_url), '')) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.admin_delete(p_table text, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  if p_table not in ('lectures', 'academy_events', 'ads', 'lecture_requests') then raise exception '지울 수 없는 표예요'; end if;
  execute format('delete from public.%I where id = $1', p_table) using p_id;
end; $$;

/* 수강 인증 사진 저장소 (비공개) */
insert into storage.buckets (id, name, public) values ('enroll-docs', 'enroll-docs', false)
on conflict (id) do update set public = false;
drop policy if exists "수강 인증 사진 올리기" on storage.objects;
create policy "수강 인증 사진 올리기" on storage.objects for insert to authenticated
  with check (bucket_id = 'enroll-docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "수강 인증 사진 보기" on storage.objects;
create policy "수강 인증 사진 보기" on storage.objects for select to authenticated
  using (bucket_id = 'enroll-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "수강 인증 사진 지우기" on storage.objects;
create policy "수강 인증 사진 지우기" on storage.objects for delete to authenticated
  using (bucket_id = 'enroll-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

/* ───── 신고 대상에 강의 후기 추가 ───── */
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'comment', 'message', 'study', 'material', 'mock_review', 'lecture_review'));

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
  if n >= 5 then
    case p_type
      when 'post' then update public.posts set status = 'hidden', hidden_reason = '신고 누적' where id = p_id and status = 'visible';
      when 'comment' then update public.comments set status = 'hidden' where id = p_id and status = 'visible';
      when 'study' then update public.studies set status = 'hidden' where id = p_id and status in ('open', 'closed');
      when 'material' then update public.materials set status = 'hidden' where id = p_id and status = 'visible';
      when 'mock_review' then update public.mock_reviews set status = 'hidden' where id = p_id and status = 'visible';
      when 'lecture_review' then update public.lecture_reviews set status = 'hidden' where id = p_id and status = 'visible';
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
         end as content,
         case r.target_type
           when 'post' then (select status from public.posts where id = r.target_id)
           when 'comment' then (select status from public.comments where id = r.target_id)
           when 'study' then (select status from public.studies where id = r.target_id)
           when 'material' then (select status from public.materials where id = r.target_id)
           when 'mock_review' then (select status from public.mock_reviews where id = r.target_id)
           when 'lecture_review' then (select status from public.lecture_reviews where id = r.target_id)
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
                  when 'mock_review' then 'mock_reviews' when 'lecture_review' then 'lecture_reviews' end)
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
    'request_lecture(text)', 'request_enrollment(bigint,text[])', 'admin_review_enrollment(bigint,boolean,text)',
    'upsert_lecture_review(bigint,int,int,int,int,text,uuid)', 'delete_lecture_review(bigint)',
    'admin_add_lecture(text,text,text,text,text,text,text)', 'admin_add_event(text,text,text,date,date,text,text,text,text)', 'admin_delete(text,bigint)',
    'report_content(text,bigint,text,text)', 'admin_resolve(text,bigint,text,text,text,int)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select (select count(*) from public.lectures) as "강의 수";
