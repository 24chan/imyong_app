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
