/* 0015: 사립 채용 공고 제보 — 로그인한 사람이 공고 링크를 제보 → 운영자 승인 → 임용 소식에 보임. 여러 번 실행해도 안전 */
create table if not exists public.job_tips (
  id bigserial primary key,
  url text not null check (url ~ '^https?://'),
  title text not null check (char_length(title) between 4 and 200),
  region text,
  level text check (level in ('elementary', 'secondary')),
  note text check (note is null or char_length(note) <= 500),
  user_id uuid default auth.uid(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index if not exists job_tips_url on public.job_tips (url);
alter table public.job_tips enable row level security;
revoke all on public.job_tips from anon, authenticated;

/* 승인된 제보만 (누가 제보했는지는 안 보임) */
create or replace view public.job_tips_v as
  select id, url, title, region, level, created_at from public.job_tips where status = 'approved';
grant select on public.job_tips_v to anon, authenticated;

/* 운영자용: 검토 대기 목록 */
create or replace view public.admin_job_tips_v as
  select id, url, title, region, level, note, created_at from public.job_tips
   where status = 'pending' and public.is_admin();
grant select on public.admin_job_tips_v to authenticated;

create or replace function public.submit_job_tip(p_url text, p_title text, p_region text, p_level text, p_note text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if (select count(*) from public.job_tips where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception '제보는 하루 10건까지 할 수 있어요';
  end if;
  if exists (select 1 from public.job_tips where url = trim(p_url)) then
    raise exception '이미 제보된 공고예요';
  end if;
  insert into public.job_tips (url, title, region, level, note)
  values (trim(p_url), trim(p_title), nullif(p_region, ''), nullif(p_level, ''), nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_review_job_tip(p_id bigint, p_approve boolean, p_title text, p_region text, p_level text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  update public.job_tips
     set status = case when p_approve then 'approved' else 'rejected' end,
         title = coalesce(nullif(trim(p_title), ''), title),
         region = coalesce(nullif(p_region, ''), region),
         level = coalesce(nullif(p_level, ''), level),
         reviewed_at = now()
   where id = p_id;
end $$;

revoke all on function public.submit_job_tip(text, text, text, text, text) from public, anon;
revoke all on function public.admin_review_job_tip(bigint, boolean, text, text, text) from public, anon;
grant execute on function public.submit_job_tip(text, text, text, text, text) to authenticated;
grant execute on function public.admin_review_job_tip(bigint, boolean, text, text, text) to authenticated;

select '0015 완료' as result;
