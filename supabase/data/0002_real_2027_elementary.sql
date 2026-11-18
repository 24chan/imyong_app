-- 실제 데이터 1차: 2027학년도 공립 초등 선발 인원(17개 시도) + 일정
-- 근거: 교육부·시도교육청 발표와 그 보도 (2026-11-18 Claude 수집, 사용자 검수 후 실행)
-- 검증: 사전예고 17개 시도 합계 = 2,821명 = 교육부 발표 전국 합계
-- Supabase SQL Editor에서 한 번 Run. 처음부터 끝까지 한 묶음(트랜잭션)이라 중간에 실패하면 아무것도 바뀌지 않아요.

begin;

-- 1) 일반/장애 구분이 공개 안 된 지역이 있어 비워둘 수 있게
alter table selection_counts alter column general drop not null;
alter table selection_counts alter column disabled drop not null;
alter table selection_counts alter column disabled drop default;

-- 2) 초등 샘플 지우기 (중등 샘플은 실제 데이터가 들어올 때까지 '샘플' 배지와 함께 유지)
delete from exam_schedules where source_id = 'sample' and level = 'elementary';
delete from exam_results where source_id = 'sample' and level = 'elementary';
delete from selection_counts where source_id = 'sample' and level = 'elementary';

-- 3) 출처
insert into sources (id, title, publisher, url) values
  ('moe-2027-prenotice', '2027학년도 공립 교원 임용시험 사전예고 현황 (2026.8.5)', '교육부', 'https://eiec.kdi.re.kr/policy/materialView.do?num=285081'),
  ('e2027-common', '2027학년도 유·초 임용 공통 일정 (여러 시도 공고·보도 종합)', '시도교육청', 'https://m.dailian.co.kr/news/view/1674835'),
  ('e2027-seoul-pre', '2027학년도 초등 사전예고 (보도)', '서울특별시교육청', 'https://www.mt.co.kr/policy/2026/08/05/2026080417101235609'),
  ('e2027-busan-pre', '2027학년도 초등 사전예고 (보도)', '부산광역시교육청', 'https://www.inews24.com/view/1992184'),
  ('e2027-busan-plan', '2027학년도 유·초 시행계획 일정 (보도)', '부산광역시교육청', 'https://www.fnnews.com/news/202609091001125910'),
  ('e2027-daegu-pre', '2027학년도 초등 사전예고 (보도)', '대구광역시교육청', 'https://nocutnews.co.kr/news/6558422'),
  ('e2027-daegu-plan', '2027학년도 시행계획 (보도)', '대구광역시교육청', 'https://kbmaeil.com/article/20260909500644'),
  ('e2027-gyeonggi-pre', '2027학년도 초등 사전예고 (보도)', '경기도교육청', 'https://www.mt.co.kr/policy/2026/08/05/2026080417101235609'),
  ('e2027-incheon-pre', '2027학년도 초등 사전예고 (보도)', '인천광역시교육청', 'https://www.inews24.com/view/1992353'),
  ('e2027-jnkj-pre', '2027학년도 유·초 사전예고 (보도)', '전남광주통합특별시교육청', 'https://www.mt.co.kr/policy/2026/08/05/2026080510405778359'),
  ('e2027-daejeon-plan', '2027학년도 유·초 시행계획 (보도)', '대전광역시교육청', 'https://m.news.nate.com/view/20260909n28949'),
  ('e2027-ulsan-pre', '2027학년도 유·초 사전예고 (보도)', '울산광역시교육청', 'https://nocutnews.co.kr/news/6558437'),
  ('e2027-sejong-plan', '2027학년도 유·초 시행계획 (보도, 사전예고와 동일)', '세종특별자치시교육청', 'https://www.news-home.co.kr/news/articleView.html?idxno=73576'),
  ('e2027-gyeonggi-plan', '2027학년도 유·초 시행계획 공고', '경기도교육청', 'https://www.goe.go.kr/goe/na/ntt/selectNttInfo.do?nttSn=2370767'),
  ('e2027-gangwon-pre', '2027학년도 사전예고 (보도)', '강원특별자치도교육청', 'https://nocutnews.co.kr/news/6558703'),
  ('e2027-chungbuk-pre', '2027학년도 사전예고 (보도)', '충청북도교육청', 'https://www.news1.kr/amp/local/sejong-chungbuk/6249744'),
  ('e2027-chungnam-pre', '2027학년도 사전예고 (보도)', '충청남도교육청', 'https://www.newsfreezone.co.kr/news/articleView.html?idxno=702567'),
  ('e2027-chungnam-plan', '2027학년도 유·초 시행계획 (보도)', '충청남도교육청', 'https://www.todaychungnam.net/news/articleView.html?idxno=475112'),
  ('e2027-jeonbuk-pre', '2027학년도 사전예고 (보도)', '전북특별자치도교육청', 'https://www.segye.com/newsView/20260805514330'),
  ('e2027-gyeongbuk-pre', '2027학년도 사전예고 (보도)', '경상북도교육청', 'https://kbmaeil.com/article/20260805500298'),
  ('e2027-gyeongbuk-plan', '2027학년도 유·초 시행계획 (보도)', '경상북도교육청', 'https://kbmaeil.com/article/20260909500289'),
  ('e2027-gyeongnam-pre', '2027학년도 사전예고 (보도)', '경상남도교육청', 'https://nocutnews.co.kr/news/6558645'),
  ('e2027-jeju-plan', '2027학년도 유·초 시행계획 (보도, 사전예고와 동일)', '제주특별자치도교육청', 'https://www.fnnews.com/news/202609101348061353')
on conflict (id) do update set title = excluded.title, publisher = excluded.publisher, url = excluded.url;

-- 4) 선발 인원 (초등, 장애 포함 총원. 일반/장애는 공개된 지역만)
insert into selection_counts (year, level, region, subject, stage, general, disabled, total, source_id, base_date) values
  -- 사전예고 (2026-08-05)
  (2027, 'elementary', 'seoul',     null, 'preliminary', null, null, 267, 'e2027-seoul-pre',     '2026-08-05'),
  (2027, 'elementary', 'busan',     null, 'preliminary', null, null, 173, 'e2027-busan-pre',     '2026-08-05'),
  (2027, 'elementary', 'daegu',     null, 'preliminary', null, null, 132, 'e2027-daegu-pre',     '2026-08-05'),
  (2027, 'elementary', 'incheon',   null, 'preliminary', null, null, 238, 'e2027-incheon-pre',   '2026-08-05'),
  (2027, 'elementary', 'gwangju',   null, 'preliminary', null, null,   3, 'e2027-jnkj-pre',      '2026-08-05'),
  (2027, 'elementary', 'ulsan',     null, 'preliminary',   62,    6,  68, 'e2027-ulsan-pre',     '2026-08-05'),
  (2027, 'elementary', 'sejong',    null, 'preliminary', null, null,   4, 'e2027-sejong-plan',   '2026-08-05'),
  (2027, 'elementary', 'gyeonggi',  null, 'preliminary', null, null, 883, 'e2027-gyeonggi-pre',  '2026-08-05'),
  (2027, 'elementary', 'gangwon',   null, 'preliminary', null, null, 160, 'e2027-gangwon-pre',   '2026-08-05'),
  (2027, 'elementary', 'chungbuk',  null, 'preliminary', null, null,  75, 'e2027-chungbuk-pre',  '2026-08-05'),
  (2027, 'elementary', 'chungnam',  null, 'preliminary', null, null, 233, 'e2027-chungnam-pre',  '2026-08-05'),
  (2027, 'elementary', 'jeonbuk',   null, 'preliminary',   47,    5,  52, 'e2027-jeonbuk-pre',   '2026-08-05'),
  (2027, 'elementary', 'jeonnam',   null, 'preliminary', null, null, 162, 'e2027-jnkj-pre',      '2026-08-05'),
  (2027, 'elementary', 'gyeongbuk', null, 'preliminary', null, null, 192, 'e2027-gyeongbuk-pre', '2026-08-05'),
  (2027, 'elementary', 'gyeongnam', null, 'preliminary', null, null, 149, 'e2027-gyeongnam-pre', '2026-08-05'),
  (2027, 'elementary', 'jeju',      null, 'preliminary',   24,    2,  26, 'e2027-jeju-plan',     '2026-08-05'),
  -- 확정 = 시행계획 공고 (2026-09-09). 확인된 지역만, 나머지는 확인되면 추가
  (2027, 'elementary', 'daegu',     null, 'confirmed',   null, null, 132, 'e2027-daegu-plan',    '2026-09-09'),
  (2027, 'elementary', 'daejeon',   null, 'confirmed',      3,    1,   4, 'e2027-daejeon-plan',  '2026-09-09'),
  (2027, 'elementary', 'sejong',    null, 'confirmed',   null, null,   4, 'e2027-sejong-plan',   '2026-09-09'),
  (2027, 'elementary', 'gyeonggi',  null, 'confirmed',   null, null, 883, 'e2027-gyeonggi-plan', '2026-09-09'),
  (2027, 'elementary', 'chungnam',  null, 'confirmed',   null, null, 233, 'e2027-chungnam-plan', '2026-09-09'),
  (2027, 'elementary', 'gyeongbuk', null, 'confirmed',   null, null, 192, 'e2027-gyeongbuk-plan','2026-09-09'),
  (2027, 'elementary', 'jeju',      null, 'confirmed',     24,    2,  26, 'e2027-jeju-plan',     '2026-09-09');

-- 5) 일정 (초등)
-- 전국 공통: 사전예고 8/5, 시행계획 9/9, 원서접수 9/28~10/2, 1차 11/7, 2차 시작 1/6
insert into exam_schedules (year, level, region, event, date, source_id)
select 2027, 'elementary', r.code, e.ev::schedule_event, e.d, e.src
from regions r
cross join (values
  ('pre_notice',    date '2026-08-05', 'moe-2027-prenotice'),
  ('plan',          date '2026-09-09', 'moe-2027-prenotice'),
  ('receipt_start', date '2026-09-28', 'e2027-common'),
  ('receipt_end',   date '2026-10-02', 'e2027-common'),
  ('first_exam',    date '2026-11-07', 'e2027-common'),
  ('second_exam',   date '2027-01-06', 'e2027-common')
) as e(ev, d, src);

-- 지역별로 확인된 발표일
insert into exam_schedules (year, level, region, event, date, source_id) values
  (2027, 'elementary', 'busan',     'first_result', '2026-12-09', 'e2027-busan-plan'),
  (2027, 'elementary', 'daejeon',   'first_result', '2026-12-09', 'e2027-daejeon-plan'),
  (2027, 'elementary', 'busan',     'final_result', '2027-01-27', 'e2027-busan-plan'),
  (2027, 'elementary', 'daejeon',   'final_result', '2027-01-27', 'e2027-daejeon-plan'),
  (2027, 'elementary', 'sejong',    'final_result', '2027-01-27', 'e2027-sejong-plan'),
  (2027, 'elementary', 'chungnam',  'final_result', '2027-01-27', 'e2027-chungnam-plan'),
  (2027, 'elementary', 'gyeongbuk', 'final_result', '2027-01-27', 'e2027-gyeongbuk-plan');

commit;

-- 확인: 사전예고 합계 2817 + 대전(사전예고 미확인) = 교육부 합계 2821 과 맞는지
select
  (select sum(total) from selection_counts where year = 2027 and level = 'elementary' and stage = 'preliminary') as 사전예고_합계,
  (select count(*) from selection_counts where year = 2027 and level = 'elementary') as 초등_행수,
  (select count(*) from exam_schedules where year = 2027 and level = 'elementary') as 초등_일정수;
