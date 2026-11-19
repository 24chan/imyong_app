/* v1 설치 2/9 — 순서대로 실행하세요. 여러 번 실행해도 안전해요. */
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

select '2/9 완료' as result;
