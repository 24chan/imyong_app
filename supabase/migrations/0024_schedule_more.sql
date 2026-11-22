/* 0024: 일정 탭 보강 (C-1)
   ① 일정 종류 추가: 설명회(briefing)·인강 오픈(online)·기타(etc)
   ② 장소/온라인 칸(place)
   ③ 이용자 일정 제보 → 운영자 승인하면 일정에 들어감
   여러 번 실행해도 안전 */

alter table public.academy_events drop constraint if exists academy_events_kind_check;
alter table public.academy_events add constraint academy_events_kind_check
  check (kind in ('open', 'special', 'mock', 'briefing', 'online', 'etc'));
alter table public.academy_events add column if not exists place text check (place is null or char_length(place) <= 100);

/* 보기(view)는 칸이 늘면 다시 만들어야 해요 */
drop view if exists public.academy_events_v;
create view public.academy_events_v as
  select e.id, e.academy_id, e.lecture_id, e.kind, e.title, e.starts_on, e.ends_on, e.level, e.area, e.subject_code, e.url, e.place, e.created_at,
         a.name as academy_name
    from public.academy_events e left join public.academies a on a.id = e.academy_id;
grant select on public.academy_events_v to anon, authenticated;

/* 운영자 일정 등록: 장소 칸 추가 (옛 9칸 함수는 지움) */
drop function if exists public.admin_add_event(text, text, text, date, date, text, text, text, text);
create or replace function public.admin_add_event(p_academy text, p_kind text, p_title text, p_starts date, p_ends date, p_level text, p_area text, p_subject text, p_url text, p_place text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_ac bigint; v_id bigint;
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  if nullif(trim(p_academy), '') is not null then
    insert into public.academies (name) values (trim(p_academy)) on conflict (name) do nothing;
    select id into v_ac from public.academies where name = trim(p_academy);
  end if;
  insert into public.academy_events (academy_id, kind, title, starts_on, ends_on, level, area, subject_code, url, place)
  values (v_ac, p_kind, trim(p_title), p_starts, p_ends, p_level, nullif(p_area, ''), nullif(p_subject, ''), nullif(trim(p_url), ''), nullif(trim(coalesce(p_place, '')), ''))
  returning id into v_id;
  return v_id;
end $$;

/* 이용자 일정 제보 (누가 보냈는지는 운영자에게도 안 보임) */
create table if not exists public.event_tips (
  id bigserial primary key,
  kind text not null check (kind in ('open', 'special', 'mock', 'briefing', 'online', 'etc')),
  title text not null check (char_length(title) between 4 and 120),
  academy text check (academy is null or char_length(academy) <= 60),
  starts_on date not null,
  ends_on date,
  level text not null check (level in ('elementary', 'secondary')),
  subject_code text references public.subjects(code),
  place text check (place is null or char_length(place) <= 100),
  url text check (url is null or url ~ '^https?://'),
  user_id uuid default auth.uid(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  event_id bigint references public.academy_events(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (ends_on is null or ends_on >= starts_on)
);
alter table public.event_tips enable row level security;
revoke all on public.event_tips from anon, authenticated;

create or replace view public.admin_event_tips_v as
  select id, kind, title, academy, starts_on, ends_on, level, subject_code, place, url, created_at
    from public.event_tips where status = 'pending' and public.is_admin();
grant select on public.admin_event_tips_v to authenticated;

create or replace function public.submit_event_tip(p_kind text, p_title text, p_academy text, p_starts date, p_ends date, p_level text, p_subject text, p_place text, p_url text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if (select count(*) from public.event_tips where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception '제보는 하루 10건까지 할 수 있어요';
  end if;
  if p_starts < current_date - 7 or p_starts > current_date + 400 then raise exception '날짜를 다시 확인해 주세요'; end if;
  if exists (select 1 from public.event_tips where status <> 'rejected' and starts_on = p_starts and lower(title) = lower(trim(p_title))) then
    raise exception '이미 제보된 일정이에요';
  end if;
  insert into public.event_tips (kind, title, academy, starts_on, ends_on, level, subject_code, place, url)
  values (p_kind, trim(p_title), nullif(trim(coalesce(p_academy, '')), ''), p_starts, p_ends, p_level,
          nullif(p_subject, ''), nullif(trim(coalesce(p_place, '')), ''), nullif(trim(coalesce(p_url, '')), ''))
  returning id into v_id;
  return v_id;
end $$;

/* 승인하면 일정(academy_events)에 넣고, 거절하면 표시만 */
create or replace function public.admin_review_event_tip(p_id bigint, p_approve boolean, p_title text)
returns void language plpgsql security definer set search_path = public as $$
declare t public.event_tips; v_ev bigint;
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  select * into t from public.event_tips where id = p_id and status = 'pending';
  if not found then raise exception '이미 처리된 제보예요'; end if;
  if p_approve then
    v_ev := public.admin_add_event(coalesce(t.academy, ''), t.kind, coalesce(nullif(trim(p_title), ''), t.title), t.starts_on, t.ends_on,
                                   t.level, case when t.subject_code is not null then 'major' else '' end, coalesce(t.subject_code, ''), coalesce(t.url, ''), coalesce(t.place, ''));
  end if;
  update public.event_tips
     set status = case when p_approve then 'approved' else 'rejected' end, event_id = v_ev, reviewed_at = now()
   where id = p_id;
end $$;

revoke all on function public.admin_add_event(text, text, text, date, date, text, text, text, text, text) from public, anon;
revoke all on function public.submit_event_tip(text, text, text, date, date, text, text, text, text) from public, anon;
revoke all on function public.admin_review_event_tip(bigint, boolean, text) from public, anon;
grant execute on function public.admin_add_event(text, text, text, date, date, text, text, text, text, text) to authenticated;
grant execute on function public.submit_event_tip(text, text, text, date, date, text, text, text, text) to authenticated;
grant execute on function public.admin_review_event_tip(bigint, boolean, text) to authenticated;

select '0024 완료' as result;
