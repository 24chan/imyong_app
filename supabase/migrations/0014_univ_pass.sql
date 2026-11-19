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

create or replace function public.admin_delete_pass_stat(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  delete from public.univ_pass_stats where id = p_id;
end; $$;

insert into storage.buckets (id, name, public) values ('pass-docs', 'pass-docs', false)
on conflict (id) do update set public = false;
drop policy if exists "합격 인증 사진 올리기" on storage.objects;
create policy "합격 인증 사진 올리기" on storage.objects for insert to authenticated
  with check (bucket_id = 'pass-docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "합격 인증 사진 보기" on storage.objects;
create policy "합격 인증 사진 보기" on storage.objects for select to authenticated
  using (bucket_id = 'pass-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "합격 인증 사진 지우기" on storage.objects;
create policy "합격 인증 사진 지우기" on storage.objects for delete to authenticated
  using (bucket_id = 'pass-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

do $$
declare f text;
begin
  foreach f in array array['request_pass_cert(int,text,text,text[])', 'admin_review_pass_cert(bigint,boolean)',
    'admin_add_pass_stat(text,int,text,text,int,int,int,text,text,text,date)', 'admin_delete_pass_stat(bigint)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select (select count(*) from public.univ_pass_stats) as "대학별 자료 수";
