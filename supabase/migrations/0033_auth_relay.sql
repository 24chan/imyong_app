-- 로그인 전달함 (2026-11-28): 카카오·Google 로그인 뒤 브라우저가 앱을 못 여는 기기에서
-- 돌아오기 페이지(auth.html)가 로그인 정보를 잠깐 맡겨 두면, 앱이 자기만 아는 긴 무작위 번호로 한 번만 꺼내 감.
-- 꺼내면 바로 지워지고, 안 꺼내도 10분 뒤 지워짐. 표는 아무도 직접 못 읽음(함수로만)
create table if not exists public.auth_relay (
  nonce text primary key,
  payload text not null,
  created_at timestamptz not null default now()
);
alter table public.auth_relay enable row level security;
revoke all on public.auth_relay from anon, authenticated;

create or replace function public.put_auth_relay(p_nonce text, p_payload text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(p_nonce) < 32 or length(p_nonce) > 80 or length(p_payload) > 8000 then
    raise exception 'bad input';
  end if;
  delete from public.auth_relay where created_at < now() - interval '10 minutes';
  insert into public.auth_relay (nonce, payload) values (p_nonce, p_payload)
  on conflict (nonce) do nothing;
end $$;

create or replace function public.take_auth_relay(p_nonce text)
returns text language plpgsql security definer set search_path = public as $$
declare v text;
begin
  delete from public.auth_relay
   where nonce = p_nonce and created_at > now() - interval '10 minutes'
  returning payload into v;
  return v;
end $$;

grant execute on function public.put_auth_relay(text, text) to anon, authenticated;
grant execute on function public.take_auth_relay(text) to anon, authenticated;

-- 앱·웹이 새 함수를 바로 찾게 서버 목록 새로 고침
notify pgrst, 'reload schema';

-- 확인: 아래 결과에 put_auth_relay, take_auth_relay 두 줄이 보이면 성공
select proname from pg_proc where proname in ('put_auth_relay', 'take_auth_relay');
