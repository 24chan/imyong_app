/* v1 설치 9/9 — 순서대로 실행하세요. 여러 번 실행해도 안전해요. */
create or replace function public.admin_delete_pass_stat(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  delete from public.univ_pass_stats where id = p_id;
end; $$;

insert into storage.buckets (id, name, public) values ('pass-docs', 'pass-docs', false)
on conflict (id) do update set public = false;
drop policy if exists "합격 인증 사진 올리기" on storage.objects;
create policy "합격 인증 사진 올리기" on storage.objects for insert to authenticated
  with check (bucket_id = 'pass-docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "합격 인증 사진 보기" on storage.objects;
create policy "합격 인증 사진 보기" on storage.objects for select to authenticated
  using (bucket_id = 'pass-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "합격 인증 사진 지우기" on storage.objects;
create policy "합격 인증 사진 지우기" on storage.objects for delete to authenticated
  using (bucket_id = 'pass-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

do $$
declare f text;
begin
  foreach f in array array['request_pass_cert(int,text,text,text[])', 'admin_review_pass_cert(bigint,boolean)',
    'admin_add_pass_stat(text,int,text,text,int,int,int,text,text,text,date)', 'admin_delete_pass_stat(bigint)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select (select count(*) from public.univ_pass_stats) as "대학별 자료 수";

select '9/9 완료' as result;
