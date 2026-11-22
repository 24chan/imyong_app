/* 0019 게시판 정리 + 닉네임 (2026-11-22 사용자 승인)
   - 게시판 47개 → 5개(자유·초등·중등·합격 수기·지역 이야기) + HOT(자동) + 스터디 모집(따로 있음)
   - 과목·지역 게시판 → 말머리(tag_subject, tag_region). 기존 글은 자동으로 옮김
   - 글·댓글마다 '익명' 또는 '닉네임' 선택. 한 글 안에서는 처음 고른 방식으로 고정(익명 번호와 닉네임이 이어지지 않게)
   Supabase SQL Editor 에 통째로 붙여 넣고 Run. 여러 번 실행해도 괜찮아요. */
begin;

/* ───── 1. 닉네임 ───── */
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists nickname_changed_at timestamptz;
create unique index if not exists profiles_nickname_uniq on public.profiles (lower(nickname)) where nickname is not null;

/* 앱이 프로필을 직접 고칠 수 있어서, 닉네임은 set_nickname 함수로만 바뀌게 막음 */
create or replace function public.guard_nickname() returns trigger
language plpgsql set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.nickname is not null)
     or (tg_op = 'UPDATE' and new.nickname is distinct from old.nickname) then
    if coalesce(current_setting('app.nickname_ok', true), '') <> '1' then
      raise exception '닉네임은 설정 화면에서 바꿔 주세요';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists profiles_guard_nickname on public.profiles;
create trigger profiles_guard_nickname before insert or update on public.profiles
  for each row execute function public.guard_nickname();

create or replace function public.set_nickname(p_nickname text) returns text
language plpgsql security definer set search_path = public as $$
declare
  n text := trim(coalesce(p_nickname, ''));
  last timestamptz;
  w text;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if char_length(n) < 2 or char_length(n) > 10 then raise exception '닉네임은 2~10자로 써 주세요'; end if;
  if n !~ '^[가-힣A-Za-z0-9_]+$' then raise exception '닉네임은 한글·영문·숫자·_ 만 쓸 수 있어요'; end if;
  if lower(n) ~ '(익명|글쓴이|운영|관리자|admin|임용몽땅)' then raise exception '쓸 수 없는 닉네임이에요'; end if;
  /* 지역 노출 금지 규칙: 지역 이름이 들어간 닉네임 막기 */
  if exists (select 1 from public.regions r where position(r.short_name in n) > 0 or position(r.name in n) > 0) then
    raise exception '지역 이름은 닉네임에 쓸 수 없어요';
  end if;
  select word into w from public.banned_words where position(word in lower(n)) > 0 limit 1;
  if w is not null then raise exception '쓸 수 없는 표현이 들어 있어요 (운영 규칙)'; end if;
  select nickname_changed_at into last from public.profiles where id = auth.uid();
  if last is not null and last > now() - interval '30 days' then
    raise exception '닉네임은 30일에 한 번 바꿀 수 있어요 (%부터)', to_char((last + interval '30 days') at time zone 'Asia/Seoul', 'MM-DD');
  end if;
  if exists (select 1 from public.profiles where lower(nickname) = lower(n) and id <> auth.uid()) then
    raise exception '이미 쓰는 닉네임이에요';
  end if;
  perform set_config('app.nickname_ok', '1', true);
  update public.profiles set nickname = n, nickname_changed_at = now(), updated_at = now() where id = auth.uid();
  if not found then raise exception '프로필을 먼저 만들어 주세요 (처음 설정)'; end if;
  perform set_config('app.nickname_ok', '', true);
  return n;
end; $$;
revoke all on function public.set_nickname(text) from public, anon;
grant execute on function public.set_nickname(text) to authenticated;

/* ───── 2. 글·댓글 칸 ───── */
alter table public.posts add column if not exists tag_subject text references public.subjects(code);
alter table public.posts add column if not exists tag_region text references public.regions(code);
alter table public.posts add column if not exists nickname text;      /* null = 익명. 쓸 때의 닉네임을 그대로 남김 */
alter table public.comments add column if not exists nickname text;
alter table public.post_anon add column if not exists use_nickname boolean not null default false;
create index if not exists posts_board_subject on public.posts (board_id, tag_subject, id desc);
create index if not exists posts_board_region on public.posts (board_id, tag_region, id desc);

/* ───── 3. 게시판 정리 ───── */
insert into public.boards (id, name, kind, level, sort) values
  ('free', '자유', 'all', null, 1),
  ('elem', '초등', 'level', 'elementary', 2),
  ('sec', '중등', 'level', 'secondary', 3),
  ('review', '합격 수기', 'review', null, 4),
  ('region', '지역 이야기', 'region', null, 5)
on conflict (id) do update set name = excluded.name, kind = excluded.kind, level = excluded.level, sort = excluded.sort,
  subject_code = null, region = null;

update public.posts p set board_id = 'sec', tag_subject = b.subject_code
  from public.boards b where b.id = p.board_id and b.kind = 'subject';
update public.posts p set board_id = 'region', tag_region = b.region
  from public.boards b where b.id = p.board_id and b.kind = 'region' and b.id <> 'region';
delete from public.boards where id not in ('free', 'elem', 'sec', 'review', 'region');

/* ───── 4. 읽기 view (새 칸은 맨 뒤에) ───── */
drop view if exists public.my_scraps_v;
drop view if exists public.hot_posts_v;
create or replace view public.posts_v as
  select p.id, p.board_id, b.name as board_name, p.label, p.title,
         case when p.status = 'visible' or p.author_id = auth.uid() or p.hidden_until < now() then p.body else '' end as body,
         p.like_count, p.comment_count, p.scrap_count, p.status, p.created_at, p.updated_at,
         (p.author_id = auth.uid()) as is_mine,
         exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()) as liked,
         exists (select 1 from public.scraps s where s.post_id = p.id and s.user_id = auth.uid()) as scrapped,
         p.tag_subject, p.tag_region, p.nickname
    from public.posts p join public.boards b on b.id = p.board_id
   where p.status <> 'deleted'
     and (p.status = 'visible' or p.author_id = auth.uid() or (p.hidden_until is not null and p.hidden_until < now()))
     and not exists (select 1 from public.blocks k where k.blocker_id = auth.uid() and k.blocked_id = p.author_id);

create or replace view public.comments_v as
  select c.id, c.post_id, c.parent_id, c.label, c.anon_no,
         case when c.status = 'visible' then c.body when c.status = 'deleted' then '삭제된 댓글이에요' else '숨겨진 댓글이에요' end as body,
         c.like_count, c.status, c.created_at, (c.author_id = auth.uid()) as is_mine,
         exists (select 1 from public.comment_likes l where l.comment_id = c.id and l.user_id = auth.uid()) as liked,
         c.nickname
    from public.comments c
   where not exists (select 1 from public.blocks k where k.blocker_id = auth.uid() and k.blocked_id = c.author_id);

create view public.hot_posts_v as
  select * from public.posts_v where status = 'visible' and like_count >= 10;
create view public.my_scraps_v as
  select v.*, s.created_at as scrapped_at from public.scraps s join public.posts_v v on v.id = s.post_id where s.user_id = auth.uid();
grant select on public.posts_v, public.comments_v, public.hot_posts_v to anon, authenticated;
grant select on public.my_scraps_v to authenticated;

/* 내 닉네임 (설정 화면) */
create or replace view public.my_nickname_v as
  select nickname, nickname_changed_at from public.profiles where id = auth.uid();
grant select on public.my_nickname_v to authenticated;

/* ───── 5. 쓰기 함수 (옛 모양은 지움: 같은 이름이 두 개면 앱 호출이 헷갈림) ───── */
drop function if exists public.create_post(text, text, text, uuid);
drop function if exists public.create_comment(bigint, text, bigint, uuid);

create or replace function public.my_nickname_or_fail() returns text
language plpgsql stable security definer set search_path = public as $$
declare n text;
begin
  select nickname into n from public.profiles where id = auth.uid();
  if n is null then raise exception '닉네임을 먼저 정해 주세요 (설정 → 닉네임)'; end if;
  return n;
end; $$;
revoke all on function public.my_nickname_or_fail() from public, anon, authenticated;

create or replace function public.create_post(p_board text, p_title text, p_body text, p_verification uuid default null,
  p_subject text default null, p_region text default null, p_use_nickname boolean default false) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_label text; v_id bigint; v_nick text; b public.boards%rowtype;
begin
  v_label := public.check_writer(p_verification, p_title || ' ' || p_body);
  if (select count(*) from public.posts where author_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    raise exception '글은 1시간에 10개까지 쓸 수 있어요';
  end if;
  select * into b from public.boards where id = p_board;
  if b.id is null then raise exception '게시판이 없어요'; end if;
  if p_subject is not null and b.id <> 'sec' then raise exception '과목 말머리는 중등 게시판에서만 붙일 수 있어요'; end if;
  if b.id = 'region' and p_region is null then raise exception '지역 말머리를 골라 주세요'; end if;
  if p_region is not null and b.id <> 'region' then raise exception '지역 말머리는 지역 이야기에서만 붙일 수 있어요'; end if;
  if p_use_nickname then v_nick := public.my_nickname_or_fail(); end if;
  insert into public.posts (board_id, author_id, label, title, body, tag_subject, tag_region, nickname)
  values (p_board, auth.uid(), v_label, trim(p_title), trim(p_body), nullif(p_subject, ''), nullif(p_region, ''), v_nick)
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.create_comment(p_post bigint, p_body text, p_parent bigint default null, p_verification uuid default null,
  p_use_nickname boolean default false) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_label text; v_no int; v_author uuid; v_id bigint; v_nick text; v_mode boolean; v_post_nick text;
begin
  v_label := public.check_writer(p_verification, p_body);
  select author_id, nickname into v_author, v_post_nick from public.posts where id = p_post and status = 'visible';
  if v_author is null then raise exception '댓글을 달 수 없는 글이에요'; end if;
  if exists (select 1 from public.blocks where blocker_id = v_author and blocked_id = auth.uid()) then
    raise exception '댓글을 달 수 없는 글이에요';
  end if;
  if (select count(*) from public.comments where author_id = auth.uid() and created_at > now() - interval '10 minutes') >= 20 then
    raise exception '댓글을 너무 빨리 쓰고 있어요. 잠시 뒤에 써 주세요';
  end if;
  if v_author = auth.uid() then
    v_no := 0;
    v_mode := v_post_nick is not null;            /* 글쓴이는 글을 쓴 방식 그대로 */
  else
    select anon_no, use_nickname into v_no, v_mode from public.post_anon where post_id = p_post and user_id = auth.uid();
    if v_no is null then
      perform 1 from public.posts where id = p_post for update; /* 번호 겹치지 않게 */
      select coalesce(max(anon_no), 0) + 1 into v_no from public.post_anon where post_id = p_post;
      v_mode := coalesce(p_use_nickname, false);
      insert into public.post_anon (post_id, user_id, anon_no, use_nickname) values (p_post, auth.uid(), v_no, v_mode);
    end if;
  end if;
  if v_mode then v_nick := public.my_nickname_or_fail(); end if;
  insert into public.comments (post_id, parent_id, author_id, label, anon_no, body, nickname)
  values (p_post, p_parent, auth.uid(), v_label, v_no, trim(p_body), v_nick) returning id into v_id;
  update public.posts set comment_count = comment_count + 1 where id = p_post;
  return v_id;
end; $$;

/* 이 글에서 내가 쓸 방식 (댓글 입력칸이 미리 알려 주게): null = 아직 안 정함 */
create or replace function public.my_comment_mode(p_post bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select case when p.author_id = auth.uid() then p.nickname is not null
              else (select use_nickname from public.post_anon a where a.post_id = p.id and a.user_id = auth.uid()) end
    from public.posts p where p.id = p_post;
$$;

revoke all on function public.create_post(text, text, text, uuid, text, text, boolean) from public, anon;
revoke all on function public.create_comment(bigint, text, bigint, uuid, boolean) from public, anon;
revoke all on function public.my_comment_mode(bigint) from public, anon;
grant execute on function public.create_post(text, text, text, uuid, text, text, boolean) to authenticated;
grant execute on function public.create_comment(bigint, text, bigint, uuid, boolean) to authenticated;
grant execute on function public.my_comment_mode(bigint) to authenticated;

commit;

select (select count(*) from public.boards) as "게시판 수 (5)",
       (select count(*) from public.posts where tag_subject is not null or tag_region is not null) as "말머리로 옮긴 글";
