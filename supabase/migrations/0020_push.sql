/* 0020 새 공고 푸시 알림 (알림 2단계, 2026-11-22 승인)
   - 계정과 연결하지 않는 '익명 구독 목록': 기기 푸시 토큰 + 시험 구분 + 관심 지역만
   - 앱은 함수로 등록·해제만 할 수 있고, 목록은 아무도 읽지 못함(발송기만 비밀키로 읽음)
   - 공고(notices)에 pushed_at 을 두어 한 번만 보냄. 이미 있는 공고는 '보낸 것'으로 표시
   Supabase SQL Editor 에 통째로 붙여 넣고 Run. 여러 번 실행해도 괜찮아요. */
begin;

create table if not exists public.push_subs (
  token text primary key,
  level text not null check (level in ('elementary', 'secondary')),
  regions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
revoke all on public.push_subs from anon, authenticated;

alter table public.notices add column if not exists pushed_at timestamptz;
update public.notices set pushed_at = now() where pushed_at is null and created_at < now();

create or replace function public.upsert_push_sub(p_token text, p_level text, p_regions text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$' then raise exception '알림 토큰이 올바르지 않아요'; end if;
  if p_level not in ('elementary', 'secondary') then raise exception '시험 구분이 올바르지 않아요'; end if;
  if coalesce(array_length(p_regions, 1), 0) > 17
     or exists (select 1 from unnest(coalesce(p_regions, '{}')) r where r not in (select code from public.regions)) then
    raise exception '지역이 올바르지 않아요';
  end if;
  insert into public.push_subs (token, level, regions) values (p_token, p_level, coalesce(p_regions, '{}'))
  on conflict (token) do update set level = excluded.level, regions = excluded.regions, updated_at = now();
end; $$;

create or replace function public.delete_push_sub(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subs where token = p_token;
$$;

revoke all on function public.upsert_push_sub(text, text, text[]) from public;
revoke all on function public.delete_push_sub(text) from public;
grant execute on function public.upsert_push_sub(text, text, text[]) to anon, authenticated;
grant execute on function public.delete_push_sub(text) to anon, authenticated;

commit;

select (select count(*) from public.push_subs) as "구독 기기", (select count(*) from public.notices where pushed_at is null) as "보낼 공고";
