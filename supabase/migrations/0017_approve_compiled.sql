/* 0017: 사용자가 보내준 정리 자료(원문 대조 전) 묶음 승인
   사용: select * from approve_compiled();
   - '원문 대조 못 함(보내준 정리표)' 메모만 붙은 묶음만 승인 (다른 문제가 함께 있는 묶음은 남김)
   - 화면 출처에는 '정리 자료·원문 대조 전'이 표시됨 (묶음 제목) */
begin;

create or replace function approve_compiled()
returns table (approved_bundles int, written_rows int)
language sql
security definer
set search_path = public
as $$
  select * from approve_ingest(array(
    select id from ingest_queue
     where status = 'pending' and doc_type = 'exam_results'
       and note in ('확인 필요: 원문 대조 못 함(보내준 정리표)')
  ));
$$;
revoke all on function approve_compiled() from public, anon, authenticated;

commit;

select note, count(*) from ingest_queue where status = 'pending' group by note order by 2 desc;
