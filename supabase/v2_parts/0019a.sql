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

commit;
