/* 실제 데이터: 초등 2024~2027학년도 시도별 선발 인원 (사전예고 / 모집공고=확정) */
/* 출처: 교육부 보도참고자료 「2027학년도 공립 유치원·초등·특수(유치원·초등)교사 임용후보자 선정경쟁시험 모집공고 현황」 (2026.9.9) */
/* 원본 파일: supabase/data/sources/moe_20260909_elementary_recruit.hwpx, 생성: scripts/moe_elementary_to_sql.py */
/* 검증: 학년도·단계별 17개 시도 합계 = 전국 합계 (2027 확정 2821, 2026 3113, 2025 4272, 2024 3157) */
/* 0003 실행 후 SQL Editor에서 한 번 Run */

begin;

/* 초등 샘플 지우기 (중등 샘플은 유지) */
delete from exam_schedules where source_id = 'sample' and level = 'elementary';
delete from exam_results where source_id = 'sample' and level = 'elementary';
delete from selection_counts where source_id = 'sample' and level = 'elementary';

insert into sources (id, title, publisher, url) values
  ('moe-20260909-elem', '2027학년도 공립 유치원·초등·특수(유치원·초등)교사 임용시험 모집공고 현황 (보도참고자료, 2026.9.9)', '교육부', null),
  ('goe-20260909-plan', '2027학년도 경기도 유치원·초등학교·특수학교(유치원·초등)교사 임용후보자 선정경쟁시험 시행계획 공고 (제2026-386호)', '경기도교육청', 'https://www.goe.go.kr/resource/goe/na/bbs_2583/2026/09/31e2613b-70c6-46ac-9ea3-e261b4353116.pdf')
on conflict (id) do update set title = excluded.title, publisher = excluded.publisher, url = excluded.url;

insert into selection_counts (year, level, region, subject, stage, general, disabled, regional, total, source_id, base_date) values
  (2027, 'elementary', 'seoul', null, 'preliminary', null, null, null, 267, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'seoul', null, 'confirmed', null, null, null, 267, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'seoul', null, 'preliminary', null, null, null, 212, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'seoul', null, 'confirmed', null, null, null, 212, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'seoul', null, 'preliminary', null, null, null, 265, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'seoul', null, 'confirmed', null, null, null, 265, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'seoul', null, 'preliminary', null, null, null, 110, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'seoul', null, 'confirmed', null, null, null, 110, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'jeonnam', null, 'preliminary', null, null, null, 162, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'jeonnam', null, 'confirmed', null, null, null, 162, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'jeonnam', null, 'preliminary', null, null, null, 131, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'jeonnam', null, 'confirmed', null, null, null, 131, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'jeonnam', null, 'preliminary', null, null, null, 128, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'jeonnam', null, 'confirmed', null, null, null, 155, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'jeonnam', null, 'preliminary', null, null, null, 150, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'jeonnam', null, 'confirmed', null, null, null, 150, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'gwangju', null, 'preliminary', null, null, null, 3, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'gwangju', null, 'confirmed', null, null, null, 3, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'gwangju', null, 'preliminary', null, null, null, 30, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'gwangju', null, 'confirmed', null, null, null, 30, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'gwangju', null, 'preliminary', null, null, null, 45, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'gwangju', null, 'confirmed', null, null, null, 45, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'gwangju', null, 'preliminary', null, null, null, 6, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'gwangju', null, 'confirmed', null, null, null, 6, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'busan', null, 'preliminary', null, null, null, 173, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'busan', null, 'confirmed', null, null, null, 173, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'busan', null, 'preliminary', null, null, null, 276, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'busan', null, 'confirmed', null, null, null, 276, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'busan', null, 'preliminary', null, null, null, 411, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'busan', null, 'confirmed', null, null, null, 411, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'busan', null, 'preliminary', null, null, null, 331, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'busan', null, 'confirmed', null, null, null, 331, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'daegu', null, 'preliminary', null, null, null, 132, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'daegu', null, 'confirmed', null, null, null, 132, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'daegu', null, 'preliminary', null, null, null, 78, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'daegu', null, 'confirmed', null, null, null, 78, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'daegu', null, 'preliminary', null, null, null, 73, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'daegu', null, 'confirmed', null, null, null, 73, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'daegu', null, 'preliminary', null, null, null, 30, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'daegu', null, 'confirmed', null, null, null, 30, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'incheon', null, 'preliminary', null, null, null, 238, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'incheon', null, 'confirmed', null, null, null, 238, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'incheon', null, 'preliminary', null, null, null, 190, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'incheon', null, 'confirmed', null, null, null, 190, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'incheon', null, 'preliminary', null, null, null, 224, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'incheon', null, 'confirmed', null, null, null, 224, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'incheon', null, 'preliminary', null, null, null, 160, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'incheon', null, 'confirmed', null, null, null, 160, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'daejeon', null, 'preliminary', null, null, null, 4, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'daejeon', null, 'confirmed', null, null, null, 4, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'daejeon', null, 'preliminary', null, null, null, 34, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'daejeon', null, 'confirmed', null, null, null, 34, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'daejeon', null, 'preliminary', null, null, null, 43, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'daejeon', null, 'confirmed', null, null, null, 43, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'daejeon', null, 'preliminary', null, null, null, 10, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'daejeon', null, 'confirmed', null, null, null, 10, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'ulsan', null, 'preliminary', null, null, null, 68, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'ulsan', null, 'confirmed', null, null, null, 68, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'ulsan', null, 'preliminary', null, null, null, 66, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'ulsan', null, 'confirmed', null, null, null, 66, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'ulsan', null, 'preliminary', null, null, null, 102, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'ulsan', null, 'confirmed', null, null, null, 102, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'ulsan', null, 'preliminary', null, null, null, 96, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'ulsan', null, 'confirmed', null, null, null, 96, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'sejong', null, 'preliminary', null, null, null, 4, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'sejong', null, 'confirmed', null, null, null, 4, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'sejong', null, 'preliminary', null, null, null, 7, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'sejong', null, 'confirmed', null, null, null, 7, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'sejong', null, 'preliminary', null, null, null, 39, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'sejong', null, 'confirmed', null, null, null, 39, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'sejong', null, 'preliminary', null, null, null, 10, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'sejong', null, 'confirmed', null, null, null, 10, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'gyeonggi', null, 'preliminary', null, null, null, 883, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'gyeonggi', null, 'confirmed', null, null, null, 883, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'gyeonggi', null, 'preliminary', null, null, null, 1077, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'gyeonggi', null, 'confirmed', null, null, null, 1077, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'gyeonggi', null, 'preliminary', null, null, null, 1765, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'gyeonggi', null, 'confirmed', null, null, null, 1765, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'gyeonggi', null, 'preliminary', null, null, null, 1325, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'gyeonggi', null, 'confirmed', null, null, null, 1325, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'gangwon', null, 'preliminary', null, null, null, 160, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'gangwon', null, 'confirmed', null, null, null, 160, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'gangwon', null, 'preliminary', null, null, null, 129, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'gangwon', null, 'confirmed', null, null, null, 129, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'gangwon', null, 'preliminary', null, null, null, 112, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'gangwon', null, 'confirmed', null, null, null, 112, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'gangwon', null, 'preliminary', null, null, null, 75, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'gangwon', null, 'confirmed', null, null, null, 75, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'chungbuk', null, 'preliminary', null, null, null, 75, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'chungbuk', null, 'confirmed', null, null, null, 75, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'chungbuk', null, 'preliminary', null, null, null, 78, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'chungbuk', null, 'confirmed', null, null, null, 78, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'chungbuk', null, 'preliminary', null, null, null, 83, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'chungbuk', null, 'confirmed', null, null, null, 83, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'chungbuk', null, 'preliminary', null, null, null, 26, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'chungbuk', null, 'confirmed', null, null, null, 32, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'chungnam', null, 'preliminary', null, null, null, 233, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'chungnam', null, 'confirmed', null, null, null, 233, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'chungnam', null, 'preliminary', null, null, null, 263, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'chungnam', null, 'confirmed', null, null, null, 263, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'chungnam', null, 'preliminary', null, null, null, 250, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'chungnam', null, 'confirmed', null, null, null, 250, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'chungnam', null, 'preliminary', null, null, null, 199, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'chungnam', null, 'confirmed', null, null, null, 242, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'jeonbuk', null, 'preliminary', null, null, null, 52, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'jeonbuk', null, 'confirmed', null, null, null, 52, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'jeonbuk', null, 'preliminary', null, null, null, 58, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'jeonbuk', null, 'confirmed', null, null, null, 58, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'jeonbuk', null, 'preliminary', null, null, null, 111, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'jeonbuk', null, 'confirmed', null, null, null, 111, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'jeonbuk', null, 'preliminary', null, null, null, 41, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'jeonbuk', null, 'confirmed', null, null, null, 41, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'gyeongbuk', null, 'preliminary', null, null, null, 192, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'gyeongbuk', null, 'confirmed', null, null, null, 192, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'gyeongbuk', null, 'preliminary', null, null, null, 294, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'gyeongbuk', null, 'confirmed', null, null, null, 294, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'gyeongbuk', null, 'preliminary', null, null, null, 318, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'gyeongbuk', null, 'confirmed', null, null, null, 318, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'gyeongbuk', null, 'preliminary', null, null, null, 274, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'gyeongbuk', null, 'confirmed', null, null, null, 274, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'gyeongnam', null, 'preliminary', null, null, null, 149, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'gyeongnam', null, 'confirmed', null, null, null, 149, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'gyeongnam', null, 'preliminary', null, null, null, 130, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'gyeongnam', null, 'confirmed', null, null, null, 130, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'gyeongnam', null, 'preliminary', null, null, null, 182, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'gyeongnam', null, 'confirmed', null, null, null, 182, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'gyeongnam', null, 'preliminary', null, null, null, 178, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'gyeongnam', null, 'confirmed', null, null, null, 178, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'jeju', null, 'preliminary', null, null, null, 26, 'moe-20260909-elem', '2026-09-09'),
  (2027, 'elementary', 'jeju', null, 'confirmed', null, null, null, 26, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'jeju', null, 'preliminary', null, null, null, 60, 'moe-20260909-elem', '2026-09-09'),
  (2026, 'elementary', 'jeju', null, 'confirmed', null, null, null, 60, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'jeju', null, 'preliminary', null, null, null, 94, 'moe-20260909-elem', '2026-09-09'),
  (2025, 'elementary', 'jeju', null, 'confirmed', null, null, null, 94, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'jeju', null, 'preliminary', null, null, null, 87, 'moe-20260909-elem', '2026-09-09'),
  (2024, 'elementary', 'jeju', null, 'confirmed', null, null, null, 87, 'moe-20260909-elem', '2026-09-09');

/* 경기 2027 확정: 공고 원문의 일반/장애/지역 (일반 815, 장애 68, 지역 구분모집 없음) */
update selection_counts set general = 815, disabled = 68, regional = 0, source_id = 'goe-20260909-plan'
  where year = 2027 and level = 'elementary' and region = 'gyeonggi' and stage = 'confirmed' and total = 883;

/* 2027 일정: 사전예고 8/5, 시행계획(모집공고) 9/9 = 교육부 / 나머지는 수집기가 교육청 공고에서 채움 */
insert into exam_schedules (year, level, region, event, date, source_id)
select 2027, 'elementary', r.code, e.ev::schedule_event, e.d, 'moe-20260909-elem'
from regions r cross join (values ('plan', date '2026-09-09')) as e(ev, d)
on conflict (year, level, region, event) do nothing;

commit;

select count(*) as 초등_선발인원_행수, sum(total) filter (where year = 2027 and stage = 'confirmed') as 확정2027_합계
from selection_counts where level = 'elementary';
