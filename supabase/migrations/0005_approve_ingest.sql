/* 0005: 검수 대기열(ingest_queue) → 앱 데이터(exam_results) 승인 함수
   사용: select * from approve_ingest();        검증 통과한 대기 묶음 전부 승인
         select * from approve_ingest(array[3,5]);  번호(id)를 골라 승인
   (주석은 한 줄로 붙여넣어도 되게 모두 이 형식) */
begin;

create or replace function approve_ingest(p_ids bigint[] default null)
returns table (approved_bundles int, written_rows int)
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
  r jsonb;
  v_src text;
  v_year int;
  n_b int := 0;
  n_r int := 0;
begin
  for q in
    select * from ingest_queue
    where status = 'pending' and doc_type = 'exam_results'
      and (case when p_ids is null then note = '검증 통과' else id = any(p_ids) end)
    order by id
  loop
    v_year := (q.parsed->>'year')::int;
    v_src := 'ingest-' || q.region || '-' || v_year || '-' || q.level;
    insert into sources (id, title, publisher, url)
    values (v_src, q.title, coalesce((select name from regions where code = q.region), q.region) || '교육청',
            q.parsed->'sources'->>0)
    on conflict (id) do update set title = excluded.title, publisher = excluded.publisher, url = excluded.url;

    for r in select * from jsonb_array_elements(q.parsed->'records') loop
      insert into exam_results (year, level, region, subject, category, selected, applicants, takers,
                                first_passed, first_cutoff, final_passed, final_cutoff, source_id, base_date)
      values ((r->>'year')::int, (r->>'level')::exam_level, r->>'region', nullif(r->>'subject', ''), r->>'category',
              (r->>'selected')::numeric::int, (r->>'applicants')::numeric::int, (r->>'takers')::numeric::int,
              (r->>'first_passed')::numeric::int, (r->>'first_cutoff')::numeric,
              (r->>'final_passed')::numeric::int, (r->>'final_cutoff')::numeric, v_src, current_date)
      on conflict on constraint exam_results_uniq do update set
        selected = coalesce(excluded.selected, exam_results.selected),
        applicants = coalesce(excluded.applicants, exam_results.applicants),
        takers = coalesce(excluded.takers, exam_results.takers),
        first_passed = coalesce(excluded.first_passed, exam_results.first_passed),
        first_cutoff = coalesce(excluded.first_cutoff, exam_results.first_cutoff),
        final_passed = coalesce(excluded.final_passed, exam_results.final_passed),
        final_cutoff = coalesce(excluded.final_cutoff, exam_results.final_cutoff),
        source_id = excluded.source_id,
        base_date = excluded.base_date;
      n_r := n_r + 1;
    end loop;

    update ingest_queue set status = 'approved' where id = q.id;
    n_b := n_b + 1;
  end loop;
  return query select n_b, n_r;
end $$;

/* 앱(anon)에서는 실행 못 하게 */
revoke all on function approve_ingest(bigint[]) from public, anon, authenticated;

commit;

/* 승인 대기 목록 보기 */
select id, region, parsed->>'year' as year, note from ingest_queue where status = 'pending' order by region, year;
