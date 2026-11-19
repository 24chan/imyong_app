/* 학원 집계(KG에듀원) 자료 빼기 — 수집 정리(collector-ingest)가 끝난 뒤 실행. 여러 번 실행해도 안전 */
delete from exam_results
where source_id in (select id from sources where title like '%학원 집계%' or url like '%ssamplus%');
delete from sources
where (title like '%학원 집계%' or url like '%ssamplus%')
  and id not in (select source_id from exam_results)
  and id not in (select source_id from selection_counts)
  and id not in (select source_id from exam_schedules);
delete from ingest_queue where title like '%학원 집계%' or parsed::text like '%ssamplus%';
select * from approve_ingest_all();
