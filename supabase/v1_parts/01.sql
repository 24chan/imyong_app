/* v1 설치 1/9 — 순서대로 실행하세요. 여러 번 실행해도 안전해요. */
/* v1 한 번에 설치: 0010 인증 + 0011 커뮤니티·쪽지 + 0012 스터디·자료·모의고사 + 0013 학원·인강 + 0014 대학별 합격률
   0009 를 먼저 실행한 뒤 이 파일 전체를 SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 괜찮아요. */

/* ===== 0010_verifications ===== */
/* 0010 학교·교사 인증
   - 라벨은 두 가지뿐: 학교 '○○교대' / '○○대 사범대', 교사 '초등교사' / '중등교사'
   - 재학/졸업, 기간제/정교사, 지역은 저장·표시하지 않음
   - 인증 사진은 비공개 저장소(verify-docs)에 잠깐 두고, 운영자가 승인·거절하면 바로 삭제
   Supabase SQL Editor 에 통째로 붙여 넣고 Run. 여러 번 실행해도 괜찮아요. */

/* 1) 학교 목록: kind = edu(교육대학교) / sabeom(사범대) / elem(초등교육과)
      email_domains 가 있으면 그 학교 메일로 로그인한 사람은 자동 승인 (교대만) */
create table if not exists public.univs (
  code text primary key,
  name text not null,
  label text not null,
  kind text not null check (kind in ('edu', 'sabeom', 'elem')),
  email_domains text[] not null default '{}',
  sort int not null default 100
);
alter table public.univs enable row level security;
drop policy if exists "누구나 읽기" on public.univs;
create policy "누구나 읽기" on public.univs for select to anon, authenticated using (true);
grant select on public.univs to anon, authenticated;

insert into public.univs (code, name, label, kind, email_domains, sort) values
  ('snue', '서울교육대학교', '서울교대', 'edu', '{snue.ac.kr}', 1),
  ('ginue', '경인교육대학교', '경인교대', 'edu', '{ginue.ac.kr}', 2),
  ('cnue', '춘천교육대학교', '춘천교대', 'edu', '{cnue.ac.kr}', 3),
  ('cje', '청주교육대학교', '청주교대', 'edu', '{cje.ac.kr}', 4),
  ('gjue', '공주교육대학교', '공주교대', 'edu', '{gjue.ac.kr}', 5),
  ('jnue', '전주교육대학교', '전주교대', 'edu', '{jnue.kr}', 6),
  ('gnue', '광주교육대학교', '광주교대', 'edu', '{gnue.ac.kr}', 7),
  ('dnue', '대구교육대학교', '대구교대', 'edu', '{dnue.ac.kr}', 8),
  ('bnue', '부산교육대학교', '부산교대', 'edu', '{bnue.ac.kr}', 9),
  ('cue', '진주교육대학교', '진주교대', 'edu', '{cue.ac.kr}', 10),
  ('knue', '한국교원대학교', '한국교원대', 'elem', '{}', 11),
  ('ewha_elem', '이화여자대학교 초등교육과', '이화여대 사범대', 'elem', '{}', 12),
  ('jeju_elem', '제주대학교 초등교육과', '제주대 교육대학', 'elem', '{}', 13),
  ('snu', '서울대학교', '서울대 사범대', 'sabeom', '{}', 20),
  ('korea', '고려대학교', '고려대 사범대', 'sabeom', '{}', 20),
  ('ewha', '이화여자대학교', '이화여대 사범대', 'sabeom', '{}', 20),
  ('skku', '성균관대학교', '성균관대 사범대', 'sabeom', '{}', 20),
  ('hanyang', '한양대학교', '한양대 사범대', 'sabeom', '{}', 20),
  ('cau', '중앙대학교', '중앙대 사범대', 'sabeom', '{}', 20),
  ('konkuk', '건국대학교', '건국대 사범대', 'sabeom', '{}', 20),
  ('dongguk', '동국대학교', '동국대 사범대', 'sabeom', '{}', 20),
  ('hongik', '홍익대학교', '홍익대 사범대', 'sabeom', '{}', 20),
  ('smu', '상명대학교', '상명대 사범대', 'sabeom', '{}', 20),
  ('sungshin', '성신여자대학교', '성신여대 사범대', 'sabeom', '{}', 20),
  ('hufs', '한국외국어대학교', '한국외대 사범대', 'sabeom', '{}', 20),
  ('dankook', '단국대학교', '단국대 사범대', 'sabeom', '{}', 20),
  ('inha', '인하대학교', '인하대 사범대', 'sabeom', '{}', 20),
  ('inu', '인천대학교', '인천대 사범대', 'sabeom', '{}', 20),
  ('kangnam', '강남대학교', '강남대 사범대', 'sabeom', '{}', 20),
  ('kangwon', '강원대학교', '강원대 사범대', 'sabeom', '{}', 20),
  ('cku', '가톨릭관동대학교', '가톨릭관동대 사범대', 'sabeom', '{}', 20),
  ('knue_sec', '한국교원대학교 (중등)', '한국교원대', 'sabeom', '{}', 20),
  ('cbnu', '충북대학교', '충북대 사범대', 'sabeom', '{}', 20),
  ('seowon', '서원대학교', '서원대 사범대', 'sabeom', '{}', 20),
  ('cnu', '충남대학교', '충남대 사범대', 'sabeom', '{}', 20),
  ('kongju', '공주대학교', '공주대 사범대', 'sabeom', '{}', 20),
  ('hannam', '한남대학교', '한남대 사범대', 'sabeom', '{}', 20),
  ('mokwon', '목원대학교', '목원대 사범대', 'sabeom', '{}', 20),
  ('jbnu', '전북대학교', '전북대 사범대', 'sabeom', '{}', 20),
  ('wku', '원광대학교', '원광대 사범대', 'sabeom', '{}', 20),
  ('woosuk', '우석대학교', '우석대 사범대', 'sabeom', '{}', 20),
  ('jnu', '전남대학교', '전남대 사범대', 'sabeom', '{}', 20),
  ('chosun', '조선대학교', '조선대 사범대', 'sabeom', '{}', 20),
  ('mokpo', '목포대학교', '목포대 사범대', 'sabeom', '{}', 20),
  ('scnu', '순천대학교', '순천대 사범대', 'sabeom', '{}', 20),
  ('knu', '경북대학교', '경북대 사범대', 'sabeom', '{}', 20),
  ('yu', '영남대학교', '영남대 사범대', 'sabeom', '{}', 20),
  ('kmu', '계명대학교', '계명대 사범대', 'sabeom', '{}', 20),
  ('daegu', '대구대학교', '대구대 사범대', 'sabeom', '{}', 20),
  ('cu', '대구가톨릭대학교', '대구가톨릭대 사범대', 'sabeom', '{}', 20),
  ('andong', '안동대학교', '안동대 사범대', 'sabeom', '{}', 20),
  ('pusan', '부산대학교', '부산대 사범대', 'sabeom', '{}', 20),
  ('silla', '신라대학교', '신라대 사범대', 'sabeom', '{}', 20),
  ('gnu', '경상국립대학교', '경상국립대 사범대', 'sabeom', '{}', 20),
  ('kyungnam', '경남대학교', '경남대 사범대', 'sabeom', '{}', 20),
  ('jejunu', '제주대학교', '제주대 사범대', 'sabeom', '{}', 20)
on conflict (code) do update set name = excluded.name, label = excluded.label, kind = excluded.kind,
  email_domains = excluded.email_domains, sort = excluded.sort;

/* 2) 인증 신청·결과 (서류 원본은 저장소에 잠깐만, 결과는 라벨만) */
create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('school', 'teacher')),
  method text not null check (method in ('email', 'student_id', 'kakao', 'certificate', 'employment', 'license', 'contract')),
  univ_code text references public.univs(code),
  univ_input text,                     /* 목록에 없는 학교: 직접 입력 (운영자가 라벨 정함) */
  teacher_level text check (teacher_level in ('elementary', 'secondary')),
  subject_code text references public.subjects(code),
  show_subject boolean not null default false,   /* 중등교사 과목 표시 (본인이 켤 때만) */
  label text,                          /* 승인되면 정해짐 */
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  doc_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint school_needs_univ check (kind <> 'school' or univ_code is not null or univ_input is not null),
  constraint teacher_needs_level check (kind <> 'teacher' or teacher_level is not null)
);
create index if not exists verifications_user on public.verifications (user_id);
create index if not exists verifications_pending on public.verifications (status) where status = 'pending';
alter table public.verifications enable row level security;

drop policy if exists "내 인증 읽기" on public.verifications;
create policy "내 인증 읽기" on public.verifications for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "서류 인증 신청" on public.verifications;
create policy "서류 인증 신청" on public.verifications for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending' and method <> 'email' and label is null);
drop policy if exists "대기 중 신청 취소" on public.verifications;
create policy "대기 중 신청 취소" on public.verifications for delete to authenticated using (auth.uid() = user_id and status = 'pending');
drop policy if exists "과목 표시 켜고 끄기" on public.verifications;
create policy "과목 표시 켜고 끄기" on public.verifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, delete on public.verifications to authenticated;
grant update (show_subject) on public.verifications to authenticated;

/* 3) 학교 메일 자동 인증: 로그인한 메일 주소가 교대 메일이면 바로 승인 */
create or replace function public.verify_school_email() returns text
language plpgsql security definer set search_path = public, auth as $$
declare
  v_email text;
  v_domain text;
  v_univ public.univs%rowtype;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  v_domain := split_part(v_email, '@', 2);
  select u.* into v_univ from public.univs u, unnest(u.email_domains) d
   where v_domain = d or v_domain like '%.' || d
   limit 1;
  if v_univ.code is null then
    raise exception '교대 메일이 아니에요 (%). 학생증 등 사진으로 인증해 주세요', v_domain;
  end if;
  if exists (select 1 from public.verifications where user_id = auth.uid() and univ_code = v_univ.code and status = 'approved') then
    return v_univ.label;
  end if;
  insert into public.verifications (user_id, kind, method, univ_code, label, status, reviewed_at)
  values (auth.uid(), 'school', 'email', v_univ.code, v_univ.label, 'approved', now());
  return v_univ.label;
end;
$$;
grant execute on function public.verify_school_email() to authenticated;

/* 4) 운영자 검수: 승인이면 라벨을 정하고, 승인·거절 모두 서류 경로를 지움
      (사진 파일은 앱의 운영자 화면이 저장소에서 먼저 삭제) */
create or replace function public.review_verification(p_id uuid, p_approve boolean, p_reason text default null, p_label text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v public.verifications%rowtype;
  v_label text;
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  select * into v from public.verifications where id = p_id for update;
  if v.id is null then raise exception '신청을 찾을 수 없어요'; end if;
  if p_approve then
    if v.kind = 'teacher' then
      v_label := case v.teacher_level when 'elementary' then '초등교사' else '중등교사' end;
    else
      v_label := coalesce(nullif(trim(p_label), ''), (select label from public.univs where code = v.univ_code));
      if v_label is null then raise exception '목록에 없는 학교는 라벨을 입력해 주세요'; end if;
    end if;
    update public.verifications set status = 'approved', label = v_label, reject_reason = null,
      doc_paths = '{}', reviewed_at = now() where id = p_id;
    return v_label;
  end if;
  update public.verifications set status = 'rejected', reject_reason = coalesce(p_reason, '확인이 어려워요'),
    doc_paths = '{}', reviewed_at = now() where id = p_id;
  return null;
end;
$$;
grant execute on function public.review_verification(uuid, boolean, text, text) to authenticated;

/* 5) 인증 사진 저장소 (비공개). 경로 = <내 사용자 id>/<파일> */
insert into storage.buckets (id, name, public) values ('verify-docs', 'verify-docs', false)
on conflict (id) do update set public = false;

drop policy if exists "인증 사진 올리기" on storage.objects;
create policy "인증 사진 올리기" on storage.objects for insert to authenticated
  with check (bucket_id = 'verify-docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "인증 사진 보기" on storage.objects;
create policy "인증 사진 보기" on storage.objects for select to authenticated
  using (bucket_id = 'verify-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "인증 사진 지우기" on storage.objects;
create policy "인증 사진 지우기" on storage.objects for delete to authenticated
  using (bucket_id = 'verify-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

select (select count(*) from public.univs) as "학교 수", (select count(*) from public.verifications) as "인증 수";

select '1/9 완료' as result;
