/* 로그인 전달함 (2026-11-28). 태블릿에서 복사하면 줄바꿈이 사라져도 되게 줄 주석(--)을 쓰지 않음 */
create table if not exists public.auth_relay (nonce text primary key, payload text not null, created_at timestamptz not null default now());
alter table public.auth_relay enable row level security;
revoke all on public.auth_relay from anon, authenticated;
create or replace function public.put_auth_relay(p_nonce text, p_payload text) returns void language plpgsql security definer set search_path = public as $$ begin if length(p_nonce) < 32 or length(p_nonce) > 80 or length(p_payload) > 8000 then raise exception 'bad input'; end if; delete from public.auth_relay where created_at < now() - interval '10 minutes'; insert into public.auth_relay (nonce, payload) values (p_nonce, p_payload) on conflict (nonce) do nothing; end $$;
create or replace function public.take_auth_relay(p_nonce text) returns text language plpgsql security definer set search_path = public as $$ declare v text; begin delete from public.auth_relay where nonce = p_nonce and created_at > now() - interval '10 minutes' returning payload into v; return v; end $$;
grant execute on function public.put_auth_relay(text, text) to anon, authenticated;
grant execute on function public.take_auth_relay(text) to anon, authenticated;
notify pgrst, 'reload schema';
select proname from pg_proc where proname in ('put_auth_relay', 'take_auth_relay');
