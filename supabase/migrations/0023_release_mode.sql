/* 0023 출시 모드: 학원·정리 자료로 채운 칸만 한 번에 숨기기 / 다시 보이기 (2026-11-22)
   - 수집기가 묶음마다 어느 칸이 정리 자료에서 왔는지 records[].compiled 로 적어 둠
   - 숨기기: select * from hide_compiled();   (해당 칸만 비움, 교육청 원문 칸은 그대로)
   - 다시 보이기: select * from show_compiled();
   여러 번 실행해도 괜찮아요. */
begin;

create or replace function public.hide_compiled() returns table (cleared_rows int)
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with x as (
    select r->>'region' as region, (r->>'year')::int as year, (r->>'level')::exam_level as level,
           nullif(r->>'subject', '') as subject, r->>'category' as category, r->'compiled' as c
      from ingest_queue q, jsonb_array_elements(q.parsed->'records') r
     where q.status = 'approved' and q.doc_type = 'exam_results' and jsonb_array_length(coalesce(r->'compiled', '[]')) > 0
  )
  update exam_results e set
    selected     = case when x.c ? 'selected'     then null else e.selected end,
    applicants   = case when x.c ? 'applicants'   then null else e.applicants end,
    takers       = case when x.c ? 'takers'       then null else e.takers end,
    first_passed = case when x.c ? 'first_passed' then null else e.first_passed end,
    first_cutoff = case when x.c ? 'first_cutoff' then null else e.first_cutoff end,
    final_passed = case when x.c ? 'final_passed' then null else e.final_passed end,
    final_cutoff = case when x.c ? 'final_cutoff' then null else e.final_cutoff end
    from x
   where e.region = x.region and e.year = x.year and e.level = x.level
     and e.subject is not distinct from x.subject and e.category = x.category;
  get diagnostics n = row_count;
  /* 중등 과목별 선발(지도용)도 정리 자료에서만 온 것은 지움 */
  delete from selection_counts s
   using ingest_queue q, jsonb_array_elements(q.parsed->'records') r
   where q.status = 'approved' and q.doc_type = 'exam_results' and q.level = 'secondary'
     and coalesce(r->'compiled', '[]') ? 'selected' and r->>'category' = 'general'
     and s.stage = 'confirmed' and s.level = 'secondary' and s.region = r->>'region'
     and s.year = (r->>'year')::int and s.subject = r->>'subject';
  return query select n;
end; $$;

create or replace function public.show_compiled() returns table (approved_bundles int, written_rows int)
language plpgsql security definer set search_path = public as $$
declare ids bigint[];
begin
  select array_agg(id) into ids from ingest_queue
   where status = 'approved' and doc_type = 'exam_results' and parsed::text like '%"compiled"%';
  update ingest_queue set status = 'pending' where id = any(ids);
  return query select * from approve_ingest(ids);
end; $$;

revoke all on function public.hide_compiled() from public, anon, authenticated;
revoke all on function public.show_compiled() from public, anon, authenticated;

commit;
