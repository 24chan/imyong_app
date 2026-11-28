/* 0031 운영자 알림 (2026-11-28 사용자 요청)
   자동 수집(공고·학원 일정·시험 일정·승인 대기)이 바뀌거나 수집이 멈추면 운영자 폰으로 푸시.
   운영자 기기 토큰만 따로 저장(운영자만 등록 가능, 앱에서는 읽을 수 없음 — 수집 작업이 비밀키로 읽음) */
create table if not exists public.admin_push (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);
alter table public.admin_push enable row level security;
revoke all on public.admin_push from anon, authenticated;

create or replace function public.register_admin_push(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not admin';
  end if;
  if p_token is null or length(p_token) > 200 or p_token !~ '^ExponentPushToken\[' then
    raise exception 'bad token';
  end if;
  insert into public.admin_push(user_id, token, updated_at) values (auth.uid(), p_token, now())
  on conflict (user_id) do update set token = excluded.token, updated_at = now();
end;
$$;
revoke all on function public.register_admin_push(text) from public, anon;
grant execute on function public.register_admin_push(text) to authenticated;
