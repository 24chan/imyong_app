/* 0030 (2026-11-23)
   1) 운영자 추가: imyonghelp@gmail.com (그 메일로 한 번이라도 로그인한 뒤에 실행해야 들어가요. 다시 실행해도 됨)
   2) 작성자 확인(수사기관 협조용): 운영자만
   3) 학원 일정 자동 수집용 칸: source('auto'), source_key(같은 글 한 번만), hidden(운영자가 숨긴 자동 일정은 다시 안 보임) */

/* 1) 운영자 추가 */
insert into public.admins (user_id)
select id from auth.users where lower(email) = 'imyonghelp@gmail.com'
on conflict do nothing;

/* 2) 작성자 확인(수사기관 협조용): 운영자만 (2026-11-23 사용자 결정: 사유 입력·열람 기록 없음)
   예전 판(사유·기록 있는 것)을 이미 실행했어도 이 파일을 다시 실행하면 바뀜 */
drop function if exists public.admin_reveal_author(text, text, text);
drop function if exists public.admin_reveal_history();
drop table if exists public.admin_reveal_log;

create or replace function public.admin_reveal_author(p_type text, p_id text) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_users uuid[];
  v_out jsonb := '[]'::jsonb;
  v_u uuid;
  v_logins jsonb;
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;

  if p_type = 'conversation' then
    select array[a_id, b_id] into v_users from public.conversations where id = p_id::uuid;
  elsif p_type = 'user' then
    v_users := array[p_id::uuid];
  else
    v_users := array[public.author_of(p_type, p_id::bigint)];
  end if;
  if v_users is null or v_users[1] is null then raise exception '대상을 찾을 수 없어요'; end if;

  foreach v_u in array v_users loop
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
revoke all on function public.admin_reveal_author(text, text) from public, anon;
grant execute on function public.admin_reveal_author(text, text) to authenticated;

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
