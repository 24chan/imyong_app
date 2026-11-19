/* 개발용 샘플 숫자 지우기 — 실제 자료가 없는 칸은 '자료 없음'으로 보이게. 여러 번 실행해도 안전 */
delete from exam_results where source_id = 'sample';
delete from selection_counts where source_id = 'sample';
select level, count(*) as 남은_선발행 from selection_counts group by level;
