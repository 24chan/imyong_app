/* 0016 남은 사진 파일 정리
   계정·대화가 지워지거나, 쪽지가 운영자에게 삭제되거나, 올리다 실패한 사진은
   DB에서 아무도 가리키지 않는데 파일만 남음 → 하루 지난 것만 골라서 알려 주는 함수.
   실제 삭제는 GitHub Actions(storage-cleanup)가 Storage API로 함 (SQL로 직접 지우는 건 Supabase가 막음).
   비밀키(service_role)로만 부를 수 있음. */

create or replace function public.orphan_storage_objects()
returns table (bucket text, path text)
language sql stable security definer set search_path = public, storage as $$
  select o.bucket_id::text, o.name::text
  from storage.objects o
  where o.created_at < now() - interval '1 day'
    and (
      (o.bucket_id = 'dm-images'
        and not exists (select 1 from public.messages m where m.image_path = o.name))
      or (o.bucket_id = 'verify-docs'
        and not exists (select 1 from public.verifications v where o.name = any (v.doc_paths)))
      or (o.bucket_id = 'enroll-docs'
        and not exists (select 1 from public.enrollments e where o.name = any (e.doc_paths)))
      or (o.bucket_id = 'pass-docs'
        and not exists (select 1 from public.pass_certs p where o.name = any (p.doc_paths)))
    )
  order by o.created_at
  limit 1000;
$$;

revoke all on function public.orphan_storage_objects() from public, anon, authenticated;
grant execute on function public.orphan_storage_objects() to service_role;

select count(*) as "지금 정리 대상 사진 수" from public.orphan_storage_objects();
