/* 0030 (2026-11-23)
   1) 운영자 추가: imyonghelp@gmail.com (그 메일로 한 번이라도 로그인한 뒤에 실행해야 들어가요. 다시 실행해도 됨)
   2) 작성자 확인(수사기관 협조용): 운영자만, 사유를 꼭 적고, 누가 언제 왜 봤는지 기록이 남음
   3) 학원 일정 자동 수집용 칸: source('auto'), source_key(같은 글 한 번만), hidden(운영자가 숨긴 자동 일정은 다시 안 보임) */

/* 1) 운영자 추가 */
insert into public.admins (user_id)
select id from auth.users where lower(email) = 'imyonghelp@gmail.com'
on conflict do nothing;

/* 2) 작성자 확인 + 열람 기록 */
create table if not exists public.admin_reveal_log (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id) on delete set null,
  target_type text not null,
  target_id text not null,
  target_user uuid,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.admin_reveal_log enable row level security;
/* 앱에서 직접 읽기·쓰기 불가. 아래 함수로만 */

create or replace function public.admin_reveal_author(p_type text, p_id text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_users uuid[];
  v_out jsonb := '[]'::jsonb;
  v_u uuid;
  v_logins jsonb;
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception '확인 사유를 5자 이상 적어 주세요 (예: ○○경찰서 공문 2026-123)'; end if;

  if p_type = 'conversation' then
    select array[a_id, b_id] into v_users from public.conversations where id = p_id::uuid;
  elsif p_type = 'user' then
    v_users := array[p_id::uuid];
  else
    v_users := array[public.author_of(p_type, p_id::bigint)];
  end if;
  if v_users is null or v_users[1] is null then raise exception '대상을 찾을 수 없어요'; end if;

  /* 열람 기록은 3년 보관 */
  delete from public.admin_reveal_log where created_at < now() - interval '3 years';

  foreach v_u in array v_users loop
    insert into public.admin_reveal_log (admin_id, target_type, target_id, target_user, reason)
    values (auth.uid(), p_type, p_id, v_u, trim(p_reason));

    /* 최근 로그인 기록(IP 포함): Supabase가 남기는 기록이 있을 때만, 최대 10개 */
    v_logins := '[]'::jsonb;
    if to_regclass('auth.audit_log_entries') is not null then
      execute $q$
        select coalesce(jsonb_agg(x order by x->>'at' desc), '[]'::jsonb) from (
          select jsonb_build_object('at', created_at, 'ip', ip_address, 'action', payload->>'action') as x
            from auth.audit_log_entries
           where payload->>'actor_id' = $1::text
           order by created_at desc limit 10) s
      $q$ into v_logins using v_u;
    end if;

    v_out := v_out || jsonb_build_object(
      'user_id', v_u,
      'email', (select email from auth.users where id = v_u),
      'provider', (select raw_app_meta_data->>'provider' from auth.users where id = v_u),
      'joined_at', (select created_at from auth.users where id = v_u),
      'last_sign_in_at', (select last_sign_in_at from auth.users where id = v_u),
      'nickname', (select nickname from public.profiles where id = v_u),
      'verifications', (select coalesce(jsonb_agg(jsonb_build_object('kind', v.kind, 'method', v.method, 'status', v.status, 'label', coalesce(v.label, v.univ_input, v.univ_code), 'at', v.created_at)), '[]'::jsonb)
                          from public.verifications v where v.user_id = v_u),
      'sanctions', (select count(*) from public.sanctions s where s.user_id = v_u),
      'recent_logins', v_logins
    );
  end loop;
  return v_out;
end $$;
revoke all on function public.admin_reveal_author(text, text, text) from public, anon;
grant execute on function public.admin_reveal_author(text, text, text) to authenticated;

/* 운영자: 열람 기록 보기 (최근 200개) */
create or replace function public.admin_reveal_history() returns table (created_at timestamptz, admin_email text, target_type text, target_id text, reason text)
language sql stable security definer set search_path = public, auth as $$
  select l.created_at, (select email from auth.users where id = l.admin_id), l.target_type, l.target_id, l.reason
    from public.admin_reveal_log l
   where public.is_admin()
   order by l.created_at desc limit 200;
$$;
revoke all on function public.admin_reveal_history() from public, anon;
grant execute on function public.admin_reveal_history() to authenticated;

/* 3) 학원 일정 자동 수집 */
alter table public.academy_events add column if not exists source text not null default 'manual';
alter table public.academy_events add column if not exists source_key text;
alter table public.academy_events add column if not exists hidden boolean not null default false;
create unique index if not exists academy_events_source_key on public.academy_events (source_key);

drop view if exists public.academy_events_v;
create view public.academy_events_v as
  select e.id, e.academy_id, e.lecture_id, e.kind, e.title, e.starts_on, e.ends_on, e.level, e.area, e.subject_code, e.url, e.place, e.created_at,
         a.name as academy_name, e.source
    from public.academy_events e left join public.academies a on a.id = e.academy_id
   where not e.hidden;
grant select on public.academy_events_v to anon, authenticated;

/* 운영자: 잘못 읽힌 자동 일정 숨기기 (다음 날 다시 수집돼도 계속 숨김) */
create or replace function public.admin_hide_event(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  update public.academy_events set hidden = true where id = p_id;
end $$;
revoke all on function public.admin_hide_event(bigint) from public, anon;
grant execute on function public.admin_hide_event(bigint) to authenticated;

select '0030 완료' as result,
       (select count(*) from public.admins) as 운영자수;
