/* 0025 운영자 통계 (2026-11-22 사용자 승인)
   이미 저장된 정보를 '세기만' 함 — 새로 모으는 정보 없음, 누구인지 알 수 있는 값은 돌려주지 않음(숫자만)
   여러 번 실행해도 안전 */

create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  kst_today timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  r jsonb;
begin
  if not public.is_admin() then raise exception '운영자만 볼 수 있어요'; end if;
  select jsonb_build_object(
    'users', jsonb_build_object(
      'total', (select count(*) from auth.users),
      'new_today', (select count(*) from auth.users where created_at >= kst_today),
      'new_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
      'login_today', (select count(*) from auth.users where last_sign_in_at >= kst_today),
      'login_7d', (select count(*) from auth.users where last_sign_in_at >= now() - interval '7 days'),
      'login_30d', (select count(*) from auth.users where last_sign_in_at >= now() - interval '30 days'),
      'by_provider', (select coalesce(jsonb_object_agg(p, n), '{}') from (
          select coalesce(raw_app_meta_data->>'provider', 'email') p, count(*) n from auth.users group by 1) x),
      'by_level', (select coalesce(jsonb_object_agg(level, n), '{}') from (select level, count(*) n from public.profiles group by 1) x),
      'verified', (select count(distinct user_id) from public.verifications where status = 'approved')
    ),
    'signups_14d', (select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'n', n) order by d), '[]') from (
        select g d, (select count(*) from auth.users u where (u.created_at at time zone 'Asia/Seoul')::date = g::date) n
          from generate_series((now() at time zone 'Asia/Seoul')::date - 13, (now() at time zone 'Asia/Seoul')::date, interval '1 day') g) x),
    'content', jsonb_build_object(
      'posts_today', (select count(*) from public.posts where created_at >= kst_today and status <> 'deleted'),
      'posts_7d', (select count(*) from public.posts where created_at >= now() - interval '7 days' and status <> 'deleted'),
      'posts_total', (select count(*) from public.posts where status <> 'deleted'),
      'comments_7d', (select count(*) from public.comments where created_at >= now() - interval '7 days' and status <> 'deleted'),
      'messages_7d', (select count(*) from public.messages where created_at >= now() - interval '7 days'),
      'studies_total', (select count(*) from public.studies),
      'reviews_total', (select count(*) from public.lecture_reviews) + (select count(*) from public.mock_reviews)
    ),
    'todo', jsonb_build_object(
      'verifications', (select count(*) from public.verifications where status = 'pending'),
      'reports', (select count(distinct (target_type, target_id)) from public.reports where status = 'open'),
      'job_tips', (select count(*) from public.job_tips where status = 'pending'),
      'event_tips', (select count(*) from public.event_tips where status = 'pending')
    ),
    'push_subs', (select count(*) from public.push_subs),
    'at', now()
  ) into r;
  return r;
end $$;

revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

select '0025 완료' as result;
