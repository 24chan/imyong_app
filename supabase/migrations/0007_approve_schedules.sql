/* 0007: 승인 함수 확장 — 일정 묶음(exam_schedules)도 승인으로 반영
   사용법은 그대로: select * from approve_ingest(); */
begin;

create or replace function approve_schedules(p_ids bigint[] default null)
returns table (approved_bundles int, written_rows int)
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
  e record;
  v_src text;
  v_year int;
  n_b int := 0;
  n_r int := 0;
begin
  for q in
    select * from ingest_queue
    where status = 'pending' and doc_type = 'exam_schedules'
      and (case when p_ids is null then note = '검증 통과' else id = any(p_ids) end)
    order by id
  loop
    v_year := (q.parsed->>'year')::int;
    v_src := 'sched-' || q.region || '-' || v_year || '-' || q.level;
    insert into sources (id, title, publisher, url)
    values (v_src, q.parsed->>'title', coalesce((select name from regions where code = q.region), q.region) || '교육청',
            q.parsed->>'source_url')
    on conflict (id) do update set title = excluded.title, url = excluded.url;

    /* 같은 지역·학년도의 샘플 일정은 지움 */
    delete from exam_schedules
     where year = v_year and level = q.level and region = q.region and source_id = 'sample';

    for e in select key, value from jsonb_each_text(q.parsed->'events') loop
      insert into exam_schedules (year, level, region, event, date, source_id)
      values (v_year, q.level, q.region, e.key::schedule_event, e.value::date, v_src)
      on conflict (year, level, region, event) do update set date = excluded.date, source_id = excluded.source_id;
      n_r := n_r + 1;
    end loop;

    update ingest_queue set status = 'approved' where id = q.id;
    n_b := n_b + 1;
  end loop;
  return query select n_b, n_r;
end $$;
revoke all on function approve_schedules(bigint[]) from public, anon, authenticated;

/* approve_ingest() 하나로 숫자와 일정을 함께 승인 (반환: 숫자 묶음 + 일정 묶음 합계) */
create or replace function approve_ingest_all()
returns table (approved_bundles int, written_rows int)
language sql
security definer
set search_path = public
as $$
  with a as (select * from approve_ingest()), b as (select * from approve_schedules())
  select a.approved_bundles + b.approved_bundles, a.written_rows + b.written_rows from a, b;
$$;
revoke all on function approve_ingest_all() from public, anon, authenticated;

commit;

select doc_type, count(*) as pending from ingest_queue where status = 'pending' group by doc_type;
