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

/* ===== 0011_community ===== */
/* 0011 커뮤니티 · 쪽지 · 신고 · 차단 · 제재
   원칙
   - 글쓴이(사용자 id)는 앱에 절대 내려가지 않음: 읽기는 view, 쓰기는 함수(RPC)로만
   - 글·댓글·쪽지는 인증(라벨) 받은 사람만, 이용 제한 중이면 못 씀
   - 신고 5명(서로 다른 사람)이면 자동 숨김 → 운영자 판단, 권리침해 임시조치 최대 30일
   Supabase SQL Editor 에 통째로 붙여 넣고 Run. 여러 번 실행해도 괜찮아요. */

/* ───── 게시판 ───── */
create table if not exists public.boards (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('all', 'level', 'subject', 'region', 'review')),
  level text check (level in ('elementary', 'secondary')),
  subject_code text references public.subjects(code),
  region text references public.regions(code),
  sort int not null default 100
);
alter table public.boards enable row level security;
drop policy if exists "누구나 읽기" on public.boards;
create policy "누구나 읽기" on public.boards for select to anon, authenticated using (true);
grant select on public.boards to anon, authenticated;

insert into public.boards (id, name, kind, level, sort) values
  ('free', '자유', 'all', null, 1),
  ('elem', '초등', 'level', 'elementary', 2),
  ('sec', '중등 전체', 'level', 'secondary', 3),
  ('review', '합격 수기', 'review', null, 4)
on conflict (id) do update set name = excluded.name, kind = excluded.kind, level = excluded.level, sort = excluded.sort;
insert into public.boards (id, name, kind, level, subject_code, sort)
  select 'sub_' || code, name, 'subject', 'secondary', code, 100 + coalesce(sort, 0) from public.subjects
on conflict (id) do update set name = excluded.name, subject_code = excluded.subject_code;
insert into public.boards (id, name, kind, region, sort)
  select 'reg_' || code, short_name, 'region', code, 200 + sort from public.regions
on conflict (id) do update set name = excluded.name, region = excluded.region;

/* ───── 글 · 댓글 ───── */
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  board_id text not null references public.boards(id),
  author_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 10000),
  like_count int not null default 0,
  comment_count int not null default 0,
  scrap_count int not null default 0,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  hidden_reason text,
  hidden_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_board on public.posts (board_id, id desc);
create index if not exists posts_hot on public.posts (like_count desc, id desc) where status = 'visible';

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  parent_id bigint references public.comments(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  anon_no int not null,          /* 0 = 글쓴이, 1·2·3… = 익명1·2·3 (글마다 따로) */
  body text not null check (char_length(body) between 1 and 2000),
  like_count int not null default 0,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default now()
);
create index if not exists comments_post on public.comments (post_id, id);

create table if not exists public.post_anon (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  anon_no int not null,
  primary key (post_id, user_id)
);
create table if not exists public.post_likes (post_id bigint references public.posts(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, primary key (post_id, user_id));
create table if not exists public.comment_likes (comment_id bigint references public.comments(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, primary key (comment_id, user_id));
create table if not exists public.scraps (post_id bigint references public.posts(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, created_at timestamptz not null default now(), primary key (post_id, user_id));

/* ───── 신고 · 차단 · 제재 · 금칙어 ───── */
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  target_type text not null check (target_type in ('post', 'comment', 'message')),
  target_id bigint not null,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  detail text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  unique (target_type, target_id, reporter_id)
);
create table if not exists public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
create table if not exists public.sanctions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('warning', 'write_7d', 'write_30d', 'permanent')),
  reason text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,              /* null = 경고(제한 없음) 또는 영구 */
  appeal text,
  appeal_status text check (appeal_status in ('open', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);
create table if not exists public.banned_words (word text primary key);
insert into public.banned_words (word) values ('시발'), ('씨발'), ('병신'), ('좆'), ('fuck')
on conflict do nothing;

/* ───── 쪽지 ───── */
alter table public.profiles add column if not exists dm_off boolean not null default false;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  a_id uuid not null references auth.users(id) on delete cascade,   /* 시작한 사람 */
  b_id uuid not null references auth.users(id) on delete cascade,
  a_label text not null,
  b_label text not null,
  origin_title text,                /* 어느 글에서 시작했는지 (제목만) */
  created_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  check (a_id <> b_id)
);
create index if not exists conv_a on public.conversations (a_id, last_at desc);
create index if not exists conv_b on public.conversations (b_id, last_at desc);
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text check (char_length(body) <= 2000),
  image_path text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (coalesce(char_length(body), 0) > 0 or image_path is not null)
);
create index if not exists messages_conv on public.messages (conversation_id, id);

/* 기본 테이블은 앱에서 직접 못 읽고 못 씀 (view·함수로만) */
do $$
declare t text;
begin
  foreach t in array array['posts','comments','post_anon','post_likes','comment_likes','scraps','reports','blocks','sanctions','banned_words','conversations','messages'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

/* ───── 도우미 ───── */
create or replace function public.active_write_ban(p_user uuid) returns public.sanctions
language sql stable security definer set search_path = public as $$
  select * from public.sanctions
   where user_id = p_user and level in ('write_7d', 'write_30d', 'permanent')
     and (ends_at is null or ends_at > now())
     and coalesce(appeal_status, '') <> 'accepted'
   order by created_at desc limit 1;
$$;

/* 글·댓글·쪽지 쓰기 전 확인: 로그인·인증·제재·금칙어. 쓸 라벨을 돌려줌 */
create or replace function public.check_writer(p_verification uuid, p_text text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v public.verifications%rowtype;
  s public.sanctions%rowtype;
  w text;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  s := public.active_write_ban(auth.uid());
  if s.id is not null then
    raise exception '이용 제한 중이에요 (%까지): %', coalesce(to_char(s.ends_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI'), '무기한'), s.reason;
  end if;
  select * into v from public.verifications
   where user_id = auth.uid() and status = 'approved' and (p_verification is null or id = p_verification)
   order by (id = p_verification) desc nulls last, reviewed_at desc limit 1;
  if v.id is null then raise exception '학교 또는 교사 인증을 먼저 해 주세요'; end if;
  select word into w from public.banned_words where position(word in lower(coalesce(p_text, ''))) > 0 limit 1;
  if w is not null then raise exception '쓸 수 없는 표현이 들어 있어요 (운영 규칙)'; end if;
  return v.label || case when v.kind = 'teacher' and v.show_subject and v.subject_code is not null
    then ' · ' || coalesce((select name from public.subjects where code = v.subject_code), '') else '' end;
end;
$$;

/* ───── 읽기용 view (글쓴이 id 대신 is_mine 만) ───── */
create or replace view public.posts_v as
  select p.id, p.board_id, b.name as board_name, p.label, p.title,
         case when p.status = 'visible' or p.author_id = auth.uid() or p.hidden_until < now() then p.body else '' end as body,
         p.like_count, p.comment_count, p.scrap_count, p.status, p.created_at, p.updated_at,
         (p.author_id = auth.uid()) as is_mine,
         exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()) as liked,
         exists (select 1 from public.scraps s where s.post_id = p.id and s.user_id = auth.uid()) as scrapped
    from public.posts p join public.boards b on b.id = p.board_id
   where p.status <> 'deleted'
     and (p.status = 'visible' or p.author_id = auth.uid() or (p.hidden_until is not null and p.hidden_until < now()))
     and not exists (select 1 from public.blocks k where k.blocker_id = auth.uid() and k.blocked_id = p.author_id);

create or replace view public.comments_v as
  select c.id, c.post_id, c.parent_id, c.label, c.anon_no,
         case when c.status = 'visible' then c.body when c.status = 'deleted' then '삭제된 댓글이에요' else '숨겨진 댓글이에요' end as body,
         c.like_count, c.status, c.created_at, (c.author_id = auth.uid()) as is_mine,
         exists (select 1 from public.comment_likes l where l.comment_id = c.id and l.user_id = auth.uid()) as liked
    from public.comments c
   where not exists (select 1 from public.blocks k where k.blocker_id = auth.uid() and k.blocked_id = c.author_id);

create or replace view public.hot_posts_v as
  select * from public.posts_v where status = 'visible' and like_count >= 10;

create or replace view public.my_scraps_v as
  select v.*, s.created_at as scrapped_at from public.scraps s join public.posts_v v on v.id = s.post_id where s.user_id = auth.uid();

create or replace view public.my_conversations_v as
  select c.id,
         case when c.a_id = auth.uid() then c.b_label else c.a_label end as other_label,
         case when c.a_id = auth.uid() then c.a_label else c.b_label end as my_label,
         c.origin_title, c.last_at,
         (select coalesce(m.body, '사진') from public.messages m where m.conversation_id = c.id order by m.id desc limit 1) as last_body,
         (select count(*) from public.messages m where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.read_at is null) as unread,
         exists (select 1 from public.blocks k where k.blocker_id = auth.uid() and k.blocked_id = case when c.a_id = auth.uid() then c.b_id else c.a_id end) as blocked
    from public.conversations c
   where auth.uid() in (c.a_id, c.b_id);

create or replace view public.my_sanctions_v as
  select id, level, reason, starts_at, ends_at, appeal, appeal_status,
         (level in ('write_7d', 'write_30d', 'permanent') and (ends_at is null or ends_at > now()) and coalesce(appeal_status, '') <> 'accepted') as active
    from public.sanctions where user_id = auth.uid();

grant select on public.posts_v, public.comments_v, public.hot_posts_v to anon, authenticated;
grant select on public.my_scraps_v, public.my_conversations_v, public.my_sanctions_v to authenticated;

/* ───── 쓰기 함수 ───── */
create or replace function public.create_post(p_board text, p_title text, p_body text, p_verification uuid default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_label text; v_id bigint;
begin
  v_label := public.check_writer(p_verification, p_title || ' ' || p_body);
  if (select count(*) from public.posts where author_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    raise exception '글은 1시간에 10개까지 쓸 수 있어요';
  end if;
  if not exists (select 1 from public.boards where id = p_board) then raise exception '게시판이 없어요'; end if;
  insert into public.posts (board_id, author_id, label, title, body) values (p_board, auth.uid(), v_label, trim(p_title), trim(p_body))
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.update_post(p_id bigint, p_title text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.check_writer(null, p_title || ' ' || p_body);
  update public.posts set title = trim(p_title), body = trim(p_body), updated_at = now()
   where id = p_id and author_id = auth.uid() and status <> 'deleted';
  if not found then raise exception '내 글만 고칠 수 있어요'; end if;
end; $$;

create or replace function public.delete_post(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.posts set status = 'deleted' where id = p_id and (author_id = auth.uid() or public.is_admin());
  if not found then raise exception '내 글만 지울 수 있어요'; end if;
end; $$;

create or replace function public.create_comment(p_post bigint, p_body text, p_parent bigint default null, p_verification uuid default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_label text; v_no int; v_author uuid; v_id bigint;
begin
  v_label := public.check_writer(p_verification, p_body);
  select author_id into v_author from public.posts where id = p_post and status = 'visible';
  if v_author is null then raise exception '댓글을 달 수 없는 글이에요'; end if;
  if exists (select 1 from public.blocks where blocker_id = v_author and blocked_id = auth.uid()) then
    raise exception '댓글을 달 수 없는 글이에요';
  end if;
  if (select count(*) from public.comments where author_id = auth.uid() and created_at > now() - interval '10 minutes') >= 20 then
    raise exception '댓글을 너무 빨리 쓰고 있어요. 잠시 뒤에 써 주세요';
  end if;
  if v_author = auth.uid() then
    v_no := 0;
  else
    select anon_no into v_no from public.post_anon where post_id = p_post and user_id = auth.uid();
    if v_no is null then
      perform 1 from public.posts where id = p_post for update; /* 번호 겹치지 않게 */
      select coalesce(max(anon_no), 0) + 1 into v_no from public.post_anon where post_id = p_post;
      insert into public.post_anon (post_id, user_id, anon_no) values (p_post, auth.uid(), v_no);
    end if;
  end if;
  insert into public.comments (post_id, parent_id, author_id, label, anon_no, body)
  values (p_post, p_parent, auth.uid(), v_label, v_no, trim(p_body)) returning id into v_id;
  update public.posts set comment_count = comment_count + 1 where id = p_post;
  return v_id;
end; $$;

create or replace function public.delete_comment(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_post bigint;
begin
  update public.comments set status = 'deleted' where id = p_id and status <> 'deleted' and (author_id = auth.uid() or public.is_admin())
  returning post_id into v_post;
  if v_post is null then raise exception '내 댓글만 지울 수 있어요'; end if;
  update public.posts set comment_count = greatest(comment_count - 1, 0) where id = v_post;
end; $$;

/* 공감·스크랩: 누르면 켜고 다시 누르면 끔. 돌려주는 값 = 새 개수 */
create or replace function public.toggle_post_like(p_id bigint) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if not exists (select 1 from public.verifications where user_id = auth.uid() and status = 'approved') then
    raise exception '인증한 회원만 공감할 수 있어요';
  end if;
  if exists (select 1 from public.posts where id = p_id and author_id = auth.uid()) then raise exception '내 글에는 공감할 수 없어요'; end if;
  delete from public.post_likes where post_id = p_id and user_id = auth.uid();
  if not found then insert into public.post_likes values (p_id, auth.uid()); end if;
  update public.posts set like_count = (select count(*) from public.post_likes where post_id = p_id) where id = p_id returning like_count into n;
  return n;
end; $$;

create or replace function public.toggle_comment_like(p_id bigint) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if not exists (select 1 from public.verifications where user_id = auth.uid() and status = 'approved') then
    raise exception '인증한 회원만 공감할 수 있어요';
  end if;
  delete from public.comment_likes where comment_id = p_id and user_id = auth.uid();
  if not found then insert into public.comment_likes values (p_id, auth.uid()); end if;
  update public.comments set like_count = (select count(*) from public.comment_likes where comment_id = p_id) where id = p_id returning like_count into n;
  return n;
end; $$;

create or replace function public.toggle_scrap(p_id bigint) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  delete from public.scraps where post_id = p_id and user_id = auth.uid();
  if found then
    update public.posts set scrap_count = greatest(scrap_count - 1, 0) where id = p_id;
    return false;
  end if;
  insert into public.scraps (post_id, user_id) values (p_id, auth.uid());
  update public.posts set scrap_count = scrap_count + 1 where id = p_id;
  return true;
end; $$;

/* 대상(글·댓글·쪽지) → 작성자 id (앱에는 안 보냄) */
create or replace function public.author_of(p_type text, p_id bigint) returns uuid
language sql stable security definer set search_path = public as $$
  select case p_type
    when 'post' then (select author_id from public.posts where id = p_id)
    when 'comment' then (select author_id from public.comments where id = p_id)
    when 'message' then (select sender_id from public.messages where id = p_id)
  end;
$$;
revoke all on function public.author_of(text, bigint) from public, anon, authenticated;

/* 신고: 서로 다른 5명이 신고하면 자동 숨김 (운영자가 최종 판단) */
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
    if p_type = 'post' then update public.posts set status = 'hidden', hidden_reason = '신고 누적' where id = p_id and status = 'visible';
    elsif p_type = 'comment' then update public.comments set status = 'hidden' where id = p_id and status = 'visible';
    end if;
  end if;
  return n;
end; $$;

/* 차단: 글·댓글·쪽지 대화 상대를 차단 (상대 id 는 안 보여줌) */
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

create or replace function public.clear_blocks() returns int
language sql security definer set search_path = public as $$
  with d as (delete from public.blocks where blocker_id = auth.uid() returning 1) select count(*)::int from d;
$$;

/* 제재 이의 신청 */
create or replace function public.appeal_sanction(p_id bigint, p_text text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.sanctions set appeal = trim(p_text), appeal_status = 'open'
   where id = p_id and user_id = auth.uid() and appeal_status is null;
  if not found then raise exception '이의 신청은 제재마다 한 번만 할 수 있어요'; end if;
end; $$;

/* ───── 쪽지 함수 ───── */
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

create or replace function public.is_conv_member(p_conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversations where id = p_conv and auth.uid() in (a_id, b_id));
$$;

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
/* 모의고사 점수 vs 실제 1차 점수 (본인 기록, 통계는 5명 이상일 때만) */
create table if not exists public.mock_scores (
  id bigint generated always as identity primary key,
  author_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('elementary', 'secondary')),
  subject_code text references public.subjects(code),
  year int not null check (year between 2020 and 2100),       /* 응시한 학년도 */
  exam_id bigint references public.mock_exams(id) on delete set null,
  mock_score numeric(5,2) not null check (mock_score between 0 and 100),
  real_score numeric(5,2) check (real_score between 0 and 100),
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['studies','materials','material_likes','mock_reviews','mock_scores'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
alter table public.mock_exams enable row level security;
drop policy if exists "누구나 읽기" on public.mock_exams;
create policy "누구나 읽기" on public.mock_exams for select to anon, authenticated using (true);
grant select on public.mock_exams to anon, authenticated;

/* ───── 읽기 view ───── */
create or replace view public.studies_v as
  select s.id, s.label, s.level, s.subject_code, s.regions, s.stage, s.mode, s.capacity, s.title,
         case when s.status in ('open', 'closed') or s.author_id = auth.uid() then s.body else '' end as body,
         s.status, s.created_at, (s.author_id = auth.uid()) as is_mine
    from public.studies s
   where s.status <> 'deleted' and (s.status <> 'hidden' or s.author_id = auth.uid())
     and not exists (select 1 from public.blocks k where k.blocker_id = auth.uid() and k.blocked_id = s.author_id);

create or replace view public.materials_v as
  select m.id, m.label, m.level, m.subject_code, m.area, m.title,
         case when m.status = 'visible' or m.author_id = auth.uid() then m.body else '' end as body,
         m.like_count, m.status, m.created_at, m.updated_at, (m.author_id = auth.uid()) as is_mine,
         exists (select 1 from public.material_likes l where l.material_id = m.id and l.user_id = auth.uid()) as liked
    from public.materials m
   where m.status <> 'deleted' and (m.status = 'visible' or m.author_id = auth.uid())
     and not exists (select 1 from public.blocks k where k.blocker_id = auth.uid() and k.blocked_id = m.author_id);

create or replace view public.mock_reviews_v as
  select r.id, r.exam_id, r.label, r.rating, r.difficulty, r.body, r.created_at, (r.author_id = auth.uid()) as is_mine
    from public.mock_reviews r
   where r.status = 'visible'
     and not exists (select 1 from public.blocks k where k.blocker_id = auth.uid() and k.blocked_id = r.author_id);

create or replace view public.mock_exams_v as
  select e.*, (select count(*) from public.mock_reviews r where r.exam_id = e.id and r.status = 'visible') as review_count,
         (select round(avg(rating), 1) from public.mock_reviews r where r.exam_id = e.id and r.status = 'visible') as rating_avg,
         (select round(avg(difficulty), 1) from public.mock_reviews r where r.exam_id = e.id and r.status = 'visible') as difficulty_avg
    from public.mock_exams e;

create or replace view public.my_mock_scores_v as
  select id, level, subject_code, year, exam_id, mock_score, real_score, created_at from public.mock_scores where author_id = auth.uid();

grant select on public.studies_v, public.materials_v, public.mock_reviews_v, public.mock_exams_v to anon, authenticated;
grant select on public.my_mock_scores_v to authenticated;

/* 점수 비교 통계: 모의 점수 구간(5점)별 실제 1차 평균. 표본 5명 미만 구간은 숨김 */
create or replace function public.mock_score_stats(p_level text, p_subject text default null)
returns table (band int, n bigint, mock_avg numeric, real_avg numeric, diff_avg numeric)
language sql stable security definer set search_path = public as $$
  select (floor(mock_score / 5) * 5)::int as band, count(*), round(avg(mock_score), 1), round(avg(real_score), 1), round(avg(real_score - mock_score), 1)
    from public.mock_scores
   where level = p_level and real_score is not null and (p_subject is null or subject_code = p_subject)
   group by 1 having count(*) >= 5 order by 1;
$$;
grant execute on function public.mock_score_stats(text, text) to anon, authenticated;

/* ───── 쓰기 함수 ───── */
create or replace function public.create_study(p_level text, p_subject text, p_regions text[], p_stage text, p_mode text, p_capacity int, p_title text, p_body text, p_verification uuid default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_label text; v_id bigint;
begin
  v_label := public.check_writer(p_verification, p_title || ' ' || p_body);
  if (select count(*) from public.studies where author_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception '스터디 모집 글은 하루 5개까지 쓸 수 있어요';
  end if;
  insert into public.studies (author_id, label, level, subject_code, regions, stage, mode, capacity, title, body)
  values (auth.uid(), v_label, p_level, nullif(p_subject, ''), coalesce(p_regions, '{}'), p_stage, p_mode, p_capacity, trim(p_title), trim(p_body))
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.set_study_status(p_id bigint, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('open', 'closed', 'deleted') then raise exception '상태가 올바르지 않아요'; end if;
  update public.studies set status = p_status where id = p_id and (author_id = auth.uid() or public.is_admin()) and status <> 'deleted';
  if not found then raise exception '내 모집 글만 바꿀 수 있어요'; end if;
end; $$;

create or replace function public.create_material(p_level text, p_subject text, p_area text, p_title text, p_body text, p_verification uuid default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_label text; v_id bigint;
begin
  v_label := public.check_writer(p_verification, p_title || ' ' || p_body);
  if p_body ~* '(drive\.google|dropbox|mega\.nz|pdf\s*(파일|공유)|파일\s*공유|링크\s*드려요)' then
    raise exception '자료 파일·링크 공유는 할 수 없어요. 직접 정리한 내용만 올려 주세요';
  end if;
  insert into public.materials (author_id, label, level, subject_code, area, title, body)
  values (auth.uid(), v_label, p_level, nullif(p_subject, ''), p_area, trim(p_title), trim(p_body)) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.update_material(p_id bigint, p_title text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.check_writer(null, p_title || ' ' || p_body);
  update public.materials set title = trim(p_title), body = trim(p_body), updated_at = now() where id = p_id and author_id = auth.uid() and status <> 'deleted';
  if not found then raise exception '내 자료만 고칠 수 있어요'; end if;
end; $$;

create or replace function public.delete_material(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.materials set status = 'deleted' where id = p_id and (author_id = auth.uid() or public.is_admin());
  if not found then raise exception '내 자료만 지울 수 있어요'; end if;
end; $$;

create or replace function public.toggle_material_like(p_id bigint) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from public.verifications where user_id = auth.uid() and status = 'approved') then raise exception '인증한 회원만 공감할 수 있어요'; end if;
  if exists (select 1 from public.materials where id = p_id and author_id = auth.uid()) then raise exception '내 자료에는 공감할 수 없어요'; end if;
  delete from public.material_likes where material_id = p_id and user_id = auth.uid();
  if not found then insert into public.material_likes values (p_id, auth.uid()); end if;
  update public.materials set like_count = (select count(*) from public.material_likes where material_id = p_id) where id = p_id returning like_count into n;
  return n;
end; $$;

create or replace function public.upsert_mock_review(p_exam bigint, p_rating int, p_difficulty int, p_body text, p_verification uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_label text;
begin
  v_label := public.check_writer(p_verification, p_body);
  insert into public.mock_reviews (exam_id, author_id, label, rating, difficulty, body)
  values (p_exam, auth.uid(), v_label, p_rating, p_difficulty, trim(p_body))
  on conflict (exam_id, author_id) do update set rating = excluded.rating, difficulty = excluded.difficulty, body = excluded.body, label = excluded.label, created_at = now();
end; $$;

create or replace function public.delete_mock_review(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.mock_reviews set status = 'deleted' where id = p_id and (author_id = auth.uid() or public.is_admin());
end; $$;

create or replace function public.add_mock_score(p_level text, p_subject text, p_year int, p_exam bigint, p_mock numeric, p_real numeric) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if (select count(*) from public.mock_scores where author_id = auth.uid()) >= 30 then raise exception '점수는 30개까지 기록할 수 있어요'; end if;
  insert into public.mock_scores (author_id, level, subject_code, year, exam_id, mock_score, real_score)
  values (auth.uid(), p_level, nullif(p_subject, ''), p_year, p_exam, p_mock, p_real) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.delete_mock_score(p_id bigint) returns void
language sql security definer set search_path = public as $$
  delete from public.mock_scores where id = p_id and author_id = auth.uid();
$$;

/* 운영자: 모의고사 일정 등록·삭제 */
create or replace function public.admin_add_mock_exam(p_name text, p_provider text, p_level text, p_subject text, p_date date, p_url text, p_note text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  insert into public.mock_exams (name, provider, level, subject_code, exam_date, apply_url, note)
  values (trim(p_name), trim(p_provider), p_level, nullif(p_subject, ''), p_date, nullif(trim(p_url), ''), nullif(trim(p_note), '')) returning id into v_id;
  return v_id;
end; $$;
create or replace function public.admin_delete_mock_exam(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  delete from public.mock_exams where id = p_id;
end; $$;

/* ───── 신고·차단·쪽지 대상 넓히기 (스터디·자료·모의고사 후기) ───── */
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'comment', 'message', 'study', 'material', 'mock_review'));

create or replace function public.author_of(p_type text, p_id bigint) returns uuid
language sql stable security definer set search_path = public as $$
  select case p_type
    when 'post' then (select author_id from public.posts where id = p_id)
    when 'comment' then (select author_id from public.comments where id = p_id)
    when 'message' then (select sender_id from public.messages where id = p_id)
    when 'study' then (select author_id from public.studies where id = p_id)
    when 'material' then (select author_id from public.materials where id = p_id)
    when 'mock_review' then (select author_id from public.mock_reviews where id = p_id)
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
