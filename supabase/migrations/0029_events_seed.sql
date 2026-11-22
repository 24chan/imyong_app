/* 0029 학원 일정 첫 등록 (2026-11-23, 학원 누리집에서 직접 확인한 것만)
   - 날짜는 각 학원 누리집 공지 기준. 바뀔 수 있어 안내 주소를 함께 넣음
   - 같은 일정이 이미 있으면 다시 넣지 않음(여러 번 실행해도 됨) */

insert into public.academies (name) values ('KG에듀원 희소·쌤플러스'), ('G스쿨'), ('해커스임용')
on conflict (name) do nothing;

with v(academy, kind, title, starts_on, ends_on, level, area, subject_code, url, place) as (values
  ('KG에듀원 희소·쌤플러스', 'briefing', '2028 희소 티처스 설명회 (현장)', date '2026-12-12', null::date, 'elementary', null, null, 'https://www.ssamplus.com/', '현장'),
  ('KG에듀원 희소·쌤플러스', 'briefing', '2028 희소 티처스 설명회 (현장)', date '2026-12-12', null::date, 'secondary', null, null, 'https://www.ssamplus.com/', '현장'),
  ('KG에듀원 희소·쌤플러스', 'briefing', '2028 희소 티처스 설명회 (온라인)', date '2026-12-14', null::date, 'elementary', null, null, 'https://www.ssamplus.com/', '온라인'),
  ('KG에듀원 희소·쌤플러스', 'briefing', '2028 희소 티처스 설명회 (온라인)', date '2026-12-14', null::date, 'secondary', null, null, 'https://www.ssamplus.com/', '온라인'),
  ('G스쿨', 'open', '[김태이 화학교육론] 2027 12월 2차 대비반 (수업실연·지도안)', date '2026-11-30', date '2026-12-22', 'secondary', 'second', 'chemistry', 'https://www.g-school.co.kr/lecture/lectureTeacherIntro.jsp?teacher_code=TAC20231214113321792', null),
  ('G스쿨', 'open', '[최연식 미술] 2027 2차 대비반 (수업실연·지도안 특강)', date '2026-12-02', null::date, 'secondary', 'second', 'art', 'https://www.g-school.co.kr/', null),
  ('해커스임용', 'open', '[고세훈 교육학] 2027 2차 대비반 (직강·인강)', date '2026-12-04', null::date, 'secondary', 'second', null, 'https://teacher.hackers.com/', null)
)
insert into public.academy_events (academy_id, kind, title, starts_on, ends_on, level, area, subject_code, url, place)
select a.id, v.kind, v.title, v.starts_on, v.ends_on, v.level, v.area, v.subject_code, v.url, v.place
from v join public.academies a on a.name = v.academy
where not exists (
  select 1 from public.academy_events e
  where e.title = v.title and e.starts_on = v.starts_on and e.level = v.level
);

select '0029 완료' as result, count(*) as 학원일정 from public.academy_events;
