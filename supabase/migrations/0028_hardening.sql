/* 0028 마무리 보안 점검 (2026-11-22)
   ① 비공개 저장소 5곳: 비공개 확인 + 파일 크기·종류 제한 (지금까지는 앱에서만 막았음)
   ② 실습 후기 하루 10개까지 (여러 학교에 도배 방지)
   여러 번 실행해도 안전 */

/* 비공개 저장소는 확실히 비공개로 (대시보드에서 실수로 공개로 바꿨어도 되돌림) */
update storage.buckets set public = false where id in ('verify-docs', 'enroll-docs', 'pass-docs', 'dm-images', 'practice-tips');

do $$
begin
  update storage.buckets set file_size_limit = 15728640, allowed_mime_types = array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf']
   where id = 'practice-tips';
  update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['image/jpeg', 'image/png', 'image/heic', 'image/webp']
   where id in ('verify-docs', 'enroll-docs', 'pass-docs', 'dm-images');
exception when undefined_column then
  raise notice '저장소 제한 칸이 없는 환경이에요 (건너뜀)';
end $$;

create or replace function public.upsert_practice_review(p_school text, p_year int, p_atmosphere int, p_guidance int, p_commute int, p_recommend boolean, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.check_writer(null, p_body);  /* 로그인·이용 제한·금지어 */
  if not exists (select 1 from public.verifications v join public.univs u on u.code = v.univ_code
                  where v.user_id = auth.uid() and v.status = 'approved' and v.kind = 'school' and u.kind in ('edu', 'elem')) then
    raise exception '교대·초등교육과 학교 인증을 한 사람만 실습 후기를 쓸 수 있어요';
  end if;
  if p_year > extract(year from now())::int + 1 then raise exception '실습한 학년도를 확인해 주세요'; end if;
  if not exists (select 1 from public.practice_reviews where school = p_school and author_id = auth.uid() and year = p_year)
     and (select count(*) from public.practice_reviews where author_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception '실습 후기는 하루 10개까지 쓸 수 있어요';
  end if;
  insert into public.practice_reviews (school, author_id, year, atmosphere, guidance, commute, recommend, body)
  values (p_school, auth.uid(), p_year, p_atmosphere, p_guidance, p_commute, p_recommend, trim(p_body))
  on conflict (school, author_id, year) do update set atmosphere = excluded.atmosphere, guidance = excluded.guidance, commute = excluded.commute,
    recommend = excluded.recommend, body = excluded.body, status = 'visible', created_at = now();
end $$;
revoke all on function public.upsert_practice_review(text, int, int, int, int, boolean, text) from public, anon;
grant execute on function public.upsert_practice_review(text, int, int, int, int, boolean, text) to authenticated;

select '0028 완료' as result;
