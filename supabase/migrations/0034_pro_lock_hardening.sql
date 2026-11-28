/* 0034 (2026-11-28) 출시 전 보안 보강. 태블릿 복사에서 줄바꿈이 사라져도 되게 줄 주석(--)을 쓰지 않음 */

/* 1) 로그인 전달함: 진짜 로그인 정보 모양만, 10분 안에 300건 넘으면 거절 */
create or replace function public.put_auth_relay(p_nonce text, p_payload text) returns void language plpgsql security definer set search_path = public as $$ begin if length(p_nonce) < 32 or length(p_nonce) > 80 or p_nonce !~ '^[0-9a-z]+$' or length(p_payload) > 6000 or position('access_token=' in p_payload) = 0 or position('refresh_token=' in p_payload) = 0 then raise exception 'bad input'; end if; delete from public.auth_relay where created_at < now() - interval '10 minutes'; if (select count(*) from public.auth_relay) >= 300 then raise exception 'busy'; end if; insert into public.auth_relay (nonce, payload) values (p_nonce, p_payload) on conflict (nonce) do nothing; end $$;

/* 2) 퀴즈 오답률: 실제 문제 번호(영문 소문자·숫자 10자)만, 문제 수는 5000개까지 */
create or replace function public.record_quiz_answer(p_qid text, p_correct boolean) returns void language plpgsql security definer set search_path = public as $$ begin if p_qid !~ '^[0-9a-f]{10}$' then raise exception 'bad qid'; end if; if not exists (select 1 from public.quiz_stats where qid = p_qid) and (select count(*) from public.quiz_stats) >= 5000 then raise exception 'full'; end if; insert into public.quiz_stats (qid, tries, wrong) values (p_qid, 1, case when p_correct then 0 else 1 end) on conflict (qid) do update set tries = quiz_stats.tries + 1, wrong = quiz_stats.wrong + (case when p_correct then 0 else 1 end), updated_at = now(); end $$;
grant execute on function public.record_quiz_answer(text, boolean) to anon, authenticated;

/* 3) 정제 자료(기출 분석·1분 퀴즈) 잠금: 비공개 저장소 'pro' + 경인교대 인증 회원·운영자만 읽기 */
create or replace function public.can_pro() returns boolean language sql stable security definer set search_path = public as $$ select coalesce(public.is_admin(), false) or exists (select 1 from public.verifications v where v.user_id = auth.uid() and v.kind = 'school' and v.status = 'approved' and v.univ_code = 'ginue') $$;
grant execute on function public.can_pro() to authenticated;
insert into storage.buckets (id, name, public) values ('pro', 'pro', false) on conflict (id) do update set public = false;
drop policy if exists "pro read" on storage.objects;
create policy "pro read" on storage.objects for select to authenticated using (bucket_id = 'pro' and public.can_pro());

notify pgrst, 'reload schema';
select 'ok' as result, (select count(*) from storage.buckets where id = 'pro') as pro_bucket, (select count(*) from pg_proc where proname = 'can_pro') as can_pro;
