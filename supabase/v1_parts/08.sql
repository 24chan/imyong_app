/* v1 설치 8/9 — 순서대로 실행하세요. 여러 번 실행해도 안전해요. */
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

/* ===== 0014_univ_pass ===== */
/* 0014 대학별 합격률
   - 공식 자료(정보공개청구 회신·교육부 자료 등)는 운영자가 출처·기준일과 함께 입력
   - 이용자 합격 인증: 최종 합격 화면 사진 → 운영자 확인 → 사진 즉시 삭제. 대학별 3명 이상일 때만 숫자 공개
   0013 다음에 실행. 여러 번 실행해도 괜찮아요. */

create table if not exists public.univ_pass_stats (
  id bigint generated always as identity primary key,
  univ_code text not null references public.univs(code),
  year int not null,                               /* 학년도 */
  level text not null check (level in ('elementary', 'secondary')),
  subject_code text references public.subjects(code),
  graduates int check (graduates >= 0),            /* 졸업(예정)자 또는 응시자 */
  applicants int check (applicants >= 0),
  passed int not null check (passed >= 0),
  basis text not null default '졸업자 대비',        /* 합격률 계산 기준 설명 */
  source_title text not null,
  source_url text,
  source_date date not null,
  created_at timestamptz not null default now()
);
create index if not exists univ_pass_stats_list on public.univ_pass_stats (level, year desc);
alter table public.univ_pass_stats enable row level security;
drop policy if exists "누구나 읽기" on public.univ_pass_stats;
create policy "누구나 읽기" on public.univ_pass_stats for select to anon, authenticated using (true);
grant select on public.univ_pass_stats to anon, authenticated;

create table if not exists public.pass_certs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  univ_code text references public.univs(code),
  year int not null,
  level text not null check (level in ('elementary', 'secondary')),
  subject_code text references public.subjects(code),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  doc_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (user_id, year, level)
);
alter table public.pass_certs enable row level security;
revoke all on public.pass_certs from anon, authenticated;

/* 대학별 이용자 합격 인증 수 (3명 미만은 숨김) */
create or replace view public.pass_cert_counts_v as
  select univ_code, year, level, count(*) as certified
    from public.pass_certs where status = 'approved' and univ_code is not null
   group by univ_code, year, level having count(*) >= 3;
create or replace view public.my_pass_certs_v as
  select id, univ_code, year, level, subject_code, status, created_at from public.pass_certs where user_id = auth.uid();
create or replace view public.admin_pass_certs_v as
  select c.id, c.year, c.level, c.subject_code, u.label as univ_label, c.doc_paths, c.created_at
    from public.pass_certs c left join public.univs u on u.code = c.univ_code
   where c.status = 'pending' and public.is_admin();
grant select on public.pass_cert_counts_v to anon, authenticated;
grant select on public.my_pass_certs_v, public.admin_pass_certs_v to authenticated;

/* 합격 인증 신청: 학교는 내 학교 인증에서 가져옴 */
create or replace function public.request_pass_cert(p_year int, p_level text, p_subject text, p_paths text[]) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_univ text; v_id bigint; p text;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  select univ_code into v_univ from public.verifications
   where user_id = auth.uid() and kind = 'school' and status = 'approved' and univ_code is not null order by reviewed_at desc limit 1;
  if v_univ is null then raise exception '학교 인증을 먼저 해 주세요 (어느 대학 합격자인지 세기 위해)'; end if;
  if coalesce(array_length(p_paths, 1), 0) = 0 then raise exception '최종 합격 화면 사진을 올려 주세요'; end if;
  foreach p in array p_paths loop
    if split_part(p, '/', 1) <> auth.uid()::text then raise exception '사진 경로가 올바르지 않아요'; end if;
  end loop;
  insert into public.pass_certs (user_id, univ_code, year, level, subject_code, doc_paths)
  values (auth.uid(), v_univ, p_year, p_level, nullif(p_subject, ''), p_paths)
  on conflict (user_id, year, level) do update set status = 'pending', doc_paths = excluded.doc_paths, univ_code = excluded.univ_code,
    subject_code = excluded.subject_code, created_at = now()
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.admin_review_pass_cert(p_id bigint, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  update public.pass_certs set status = case when p_approve then 'approved' else 'rejected' end, doc_paths = '{}', reviewed_at = now() where id = p_id;
end; $$;

create or replace function public.admin_add_pass_stat(p_univ text, p_year int, p_level text, p_subject text, p_graduates int, p_applicants int, p_passed int,
  p_basis text, p_source_title text, p_source_url text, p_source_date date) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  insert into public.univ_pass_stats (univ_code, year, level, subject_code, graduates, applicants, passed, basis, source_title, source_url, source_date)
  values (p_univ, p_year, p_level, nullif(p_subject, ''), p_graduates, p_applicants, p_passed, coalesce(nullif(trim(p_basis), ''), '졸업자 대비'),
    trim(p_source_title), nullif(trim(p_source_url), ''), p_source_date) returning id into v_id;
  return v_id;
end; $$;

select '8/9 완료' as result;
