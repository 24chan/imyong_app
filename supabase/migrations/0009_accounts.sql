/* 0009 계정: 프로필(초등·중등, 과목) + 운영자 + 내 계정 삭제
   Supabase SQL Editor 에 통째로 붙여 넣고 Run.  여러 번 실행해도 괜찮아요. */

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  level text not null default 'elementary' check (level in ('elementary', 'secondary')),
  subject_code text references public.subjects(code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint secondary_needs_subject check (level = 'elementary' or subject_code is not null)
);

alter table public.profiles enable row level security;

drop policy if exists "내 프로필 읽기" on public.profiles;
create policy "내 프로필 읽기" on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "내 프로필 만들기" on public.profiles;
create policy "내 프로필 만들기" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "내 프로필 고치기" on public.profiles;
create policy "내 프로필 고치기" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

grant select, insert, update on public.profiles to authenticated;

/* 운영자 목록: 앱에서는 못 바꾸고 SQL Editor 에서만 등록
   등록 예: insert into public.admins (user_id) select id from auth.users where email = '내메일@example.com'; */
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "내가 운영자인지 읽기" on public.admins;
create policy "내가 운영자인지 읽기" on public.admins for select to authenticated using (auth.uid() = user_id);
grant select on public.admins to authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

/* 내 계정 삭제 (앱스토어 필수 기능). 프로필 등 연결된 자료는 함께 지워짐 */
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

select 'profiles' as "만든 것", count(*) as "행 수" from public.profiles;
