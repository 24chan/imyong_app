/* 0008: 승인 함수에 중등(과목별) 반영 추가 — 샘플 행 정리 + selection_counts(확정) 기록
   사용법 그대로: select * from approve_ingest_all(); */
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

    /* 중등: 실제 자료가 들어오는 지역·학년도의 샘플(가짜) 행은 과목 상관없이 모두 지움 (진짜와 가짜가 섞이지 않게) */
    if q.level = 'secondary' then
      delete from exam_results where source_id = 'sample' and year = v_year and level = 'secondary' and region = q.region;
      delete from selection_counts where source_id = 'sample' and year = v_year and level = 'secondary' and region = q.region;
      delete from exam_schedules where source_id = 'sample' and year = v_year and level = 'secondary' and region = q.region;
    end if;

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

    /* 중등: 과목별 선발 인원을 selection_counts(확정)에도 넣음 (지도·목록용) */
    if q.level = 'secondary' then
      insert into selection_counts (year, level, region, subject, stage, general, disabled, regional, total, source_id, base_date)
      select v_year, 'secondary', q.region, x->>'subject', 'confirmed',
             max(case when x->>'category' = 'general' then (x->>'selected')::numeric::int end),
             max(case when x->>'category' = 'disabled' then (x->>'selected')::numeric::int end),
             max(case when x->>'category' = 'regional' then (x->>'selected')::numeric::int end),
             coalesce(max(case when x->>'category' = 'all' then (x->>'selected')::numeric::int end),
                      sum(case when x->>'category' in ('general', 'disabled', 'regional') then (x->>'selected')::numeric::int else 0 end)::int),
             v_src, current_date
        from jsonb_array_elements(q.parsed->'records') x
       where x->>'selected' is not null
       group by x->>'subject'
      on conflict (year, level, region, subject, stage) do update set
        general = excluded.general, disabled = excluded.disabled, regional = excluded.regional,
        total = excluded.total, source_id = excluded.source_id, base_date = excluded.base_date;
    end if;

    update ingest_queue set status = 'approved' where id = q.id;
    n_b := n_b + 1;
  end loop;
  return query select n_b, n_r;
end $$;

revoke all on function approve_ingest(bigint[]) from public, anon, authenticated;

commit;

select level, doc_type, count(*) as pending from ingest_queue where status = 'pending' group by level, doc_type order by 1, 2;
