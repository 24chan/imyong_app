-- 임용맵 DB 처음 설정 (테이블 + 권한 + 샘플 데이터). Supabase SQL Editor에 통째로 붙여넣고 Run, 한 번만.


-- 구분 값
create type exam_level as enum ('elementary', 'secondary');           -- 초등 / 중등
create type selection_stage as enum ('preliminary', 'confirmed');      -- 사전예고 / 확정
create type schedule_event as enum (
  'pre_notice', 'plan', 'receipt_start', 'receipt_end',
  'first_exam', 'first_result', 'second_exam', 'final_result'
);

-- 기준 데이터
create table regions (
  code text primary key,
  name text not null,
  short_name text not null,
  sort int not null
);

create table subjects (
  code text primary key,
  name text not null,
  grp text not null,
  sort int not null,
  is_active boolean not null default true
);

create table sources (
  id text primary key,
  title text not null,       -- 예: '2027학년도 공립 초등교사 임용시험 시행계획'
  publisher text not null,   -- 예: '서울특별시교육청'
  url text,
  created_at timestamptz not null default now()
);

-- 선발 인원 (사전예고/확정)
create table selection_counts (
  id bigint generated always as identity primary key,
  year int not null,                                  -- 학년도
  level exam_level not null,
  region text not null references regions(code),
  subject text references subjects(code),             -- 초등은 비움
  stage selection_stage not null,
  general int not null,                               -- 일반
  disabled int not null default 0,                    -- 장애
  total int not null,
  source_id text not null references sources(id),
  base_date date not null,                            -- 기준일
  check ((level = 'elementary' and subject is null) or (level = 'secondary' and subject is not null)),
  unique nulls not distinct (year, level, region, subject, stage)
);

-- 시험 결과 (올해는 접수 인원만 있고 나머지는 비움)
create table exam_results (
  id bigint generated always as identity primary key,
  year int not null,
  level exam_level not null,
  region text not null references regions(code),
  subject text references subjects(code),
  applicants int,              -- 접수
  takers int,                  -- 실제 응시
  first_passed int,            -- 1차 합격
  first_cutoff numeric(5,2),   -- 1차 합격선
  final_passed int,            -- 최종 합격
  source_id text not null references sources(id),
  base_date date not null,
  check ((level = 'elementary' and subject is null) or (level = 'secondary' and subject is not null)),
  unique nulls not distinct (year, level, region, subject)
);

-- 일정
create table exam_schedules (
  id bigint generated always as identity primary key,
  year int not null,
  level exam_level not null,
  region text not null references regions(code),
  event schedule_event not null,
  date date not null,
  source_id text not null references sources(id),
  unique (year, level, region, event)
);

create index on selection_counts (level, subject);
create index on exam_results (level, subject);
create index on exam_schedules (level, year);

-- 오류 신고 (앱에서 쓰기만 가능, 읽기는 운영자만)
create table error_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  target text not null,        -- 예: 'selection_counts:2027:elementary:seoul'
  message text not null check (char_length(message) between 1 and 1000),
  status text not null default 'open'
);

-- 권한(RLS): 통계는 누구나 읽기, 쓰기는 운영자(대시보드)만
alter table regions enable row level security;
alter table subjects enable row level security;
alter table sources enable row level security;
alter table selection_counts enable row level security;
alter table exam_results enable row level security;
alter table exam_schedules enable row level security;
alter table error_reports enable row level security;

create policy "누구나 읽기" on regions for select to anon, authenticated using (true);
create policy "누구나 읽기" on subjects for select to anon, authenticated using (true);
create policy "누구나 읽기" on sources for select to anon, authenticated using (true);
create policy "누구나 읽기" on selection_counts for select to anon, authenticated using (true);
create policy "누구나 읽기" on exam_results for select to anon, authenticated using (true);
create policy "누구나 읽기" on exam_schedules for select to anon, authenticated using (true);
create policy "누구나 신고" on error_reports for insert to anon, authenticated with check (status = 'open');

-- 기준 데이터 넣기
insert into regions (code, name, short_name, sort) values
  ('seoul', '서울특별시', '서울', 1), ('busan', '부산광역시', '부산', 2), ('daegu', '대구광역시', '대구', 3),
  ('incheon', '인천광역시', '인천', 4), ('gwangju', '광주광역시', '광주', 5), ('daejeon', '대전광역시', '대전', 6),
  ('ulsan', '울산광역시', '울산', 7), ('sejong', '세종특별자치시', '세종', 8), ('gyeonggi', '경기도', '경기', 9),
  ('gangwon', '강원특별자치도', '강원', 10), ('chungbuk', '충청북도', '충북', 11), ('chungnam', '충청남도', '충남', 12),
  ('jeonbuk', '전북특별자치도', '전북', 13), ('jeonnam', '전라남도', '전남', 14), ('gyeongbuk', '경상북도', '경북', 15),
  ('gyeongnam', '경상남도', '경남', 16), ('jeju', '제주특별자치도', '제주', 17);

insert into subjects (code, name, grp, sort) values
  ('korean', '국어', '언어', 1), ('english', '영어', '언어', 2), ('math', '수학', '수리', 3),
  ('social', '일반사회', '사회', 4), ('history', '역사', '사회', 5), ('geography', '지리', '사회', 6),
  ('ethics', '도덕·윤리', '사회', 7), ('physics', '물리', '과학', 8), ('chemistry', '화학', '과학', 9),
  ('biology', '생물', '과학', 10), ('earth', '지구과학', '과학', 11), ('pe', '체육', '예체능', 12),
  ('music', '음악', '예체능', 13), ('art', '미술', '예체능', 14), ('tech', '기술', '기술·가정', 15),
  ('homeec', '가정', '기술·가정', 16), ('info', '정보·컴퓨터', '기술·가정', 17), ('hanmun', '한문', '언어', 18),
  ('japanese', '일본어', '언어', 19), ('chinese', '중국어', '언어', 20), ('health', '보건', '비교과', 21),
  ('counsel', '전문상담', '비교과', 22), ('librarian', '사서', '비교과', 23), ('nutrition', '영양', '비교과', 24),
  ('special', '특수(중등)', '특수', 25);


insert into sources (id, title, publisher, url)
values ('sample', '샘플 데이터 (실제 수치 아님)', '임용맵 개발용', null)
on conflict (id) do nothing;

-- 같은 순서로 같은 난수를 만드는 도우미 (이 실행 동안만 존재)
create function pg_temp.rnd() returns float8 language plpgsql as $$
declare s bigint := current_setting('imyong.seed')::bigint;
begin
  s := (s * 1664525 + 1013904223) % 4294967296;
  perform set_config('imyong.seed', s::text, false);
  return s::float8 / 4294967296;
end $$;
create function pg_temp.btw(a float8, b float8) returns float8 language sql as $$ select a + (b - a) * pg_temp.rnd() $$;
create function pg_temp.rd(x float8) returns int language sql as $$ select floor(x + 0.5)::int $$;

create function pg_temp.add_series(lv exam_level, rg text, sb text, base float8, comp float8, cutbase float8)
returns void language plpgsql as $$
declare
  sz float8 := base; y int; conf int; pre int; tot int; dis int; st selection_stage;
  app int; tak int; fp int; cut float8;
begin
  for y in 2018..2027 loop
    sz := greatest(0, sz * pg_temp.btw(0.86, 1.06));
    conf := pg_temp.rd(sz);
    pre := greatest(0, pg_temp.rd(conf * pg_temp.btw(0.94, 1.04)));
    foreach st in array array['preliminary', 'confirmed']::selection_stage[] loop
      tot := case when st = 'preliminary' then pre else conf end;
      dis := pg_temp.rd(tot * pg_temp.btw(0.04, 0.07));
      insert into selection_counts (year, level, region, subject, stage, general, disabled, total, source_id, base_date)
      values (y, lv, rg, sb, st, tot - dis, dis, tot, 'sample',
        make_date(y - 1, case when st = 'preliminary' then 8 else 9 end,
          case when st = 'preliminary' then 10 when lv = 'elementary' then 5 else 25 end));
    end loop;
    continue when conf = 0;
    app := pg_temp.rd(conf * comp * pg_temp.btw(0.75, 1.3));
    if y = 2027 then
      insert into exam_results (year, level, region, subject, applicants, source_id, base_date)
      values (y, lv, rg, sb, app, 'sample', make_date(y - 1, 10, 20));
    else
      tak := pg_temp.rd(app * pg_temp.btw(0.85, 0.95));
      fp := least(tak, pg_temp.rd(conf * 1.5));
      cut := floor((cutbase + pg_temp.btw(-6, 6)) * 10 + 0.5) / 10;
      insert into exam_results (year, level, region, subject, applicants, takers, first_passed, first_cutoff, final_passed, source_id, base_date)
      values (y, lv, rg, sb, app, tak, fp, cut, least(fp, conf), 'sample',
        make_date(y, 1, case when lv = 'elementary' then 10 else 25 end));
    end if;
  end loop;
end $$;

do $$
declare
  r record; s record; base float8; comp float8; cutb float8; shift int; lv exam_level; e record;
begin
  perform set_config('imyong.seed', '20261118', false);

  -- 초등: 시도별 규모·경쟁 정도
  for r in select * from (values
    (1, 'seoul', 320, 2.2), (2, 'busan', 260, 1.4), (3, 'daegu', 150, 1.5), (4, 'incheon', 420, 1.6),
    (5, 'gwangju', 50, 2.0), (6, 'daejeon', 80, 1.9), (7, 'ulsan', 120, 1.3), (8, 'sejong', 70, 2.3),
    (9, 'gyeonggi', 1500, 1.2), (10, 'gangwon', 320, 0.9), (11, 'chungbuk', 300, 1.0), (12, 'chungnam', 460, 0.9),
    (13, 'jeonbuk', 160, 1.1), (14, 'jeonnam', 360, 0.8), (15, 'gyeongbuk', 460, 0.9), (16, 'gyeongnam', 520, 1.0),
    (17, 'jeju', 100, 1.6)) v(o, code, base, comp) order by o
  loop
    perform pg_temp.add_series('elementary', r.code, null, r.base::float8 * 1.6::float8, r.comp::float8, 58::float8 + r.comp::float8 * 6::float8);
  end loop;

  -- 중등: 과목 × 시도
  for s in select * from (values
    (1, 'korean', 1.0, 9), (2, 'english', 1.0, 8), (3, 'math', 1.1, 7), (4, 'social', 0.4, 13),
    (5, 'history', 0.4, 14), (6, 'biology', 0.4, 11), (7, 'pe', 0.6, 12), (8, 'info', 0.5, 6)) v(o, code, scale, comp) order by o
  loop
    for r in select * from (values
      (1, 'seoul', 1.6), (2, 'busan', 0.9), (3, 'daegu', 0.7), (4, 'incheon', 0.8), (5, 'gwangju', 0.4),
      (6, 'daejeon', 0.4), (7, 'ulsan', 0.3), (8, 'sejong', 0.3), (9, 'gyeonggi', 3.0), (10, 'gangwon', 0.6),
      (11, 'chungbuk', 0.6), (12, 'chungnam', 0.8), (13, 'jeonbuk', 0.6), (14, 'jeonnam', 0.7),
      (15, 'gyeongbuk', 0.8), (16, 'gyeongnam', 1.0), (17, 'jeju', 0.3)) v(o, code, w) order by o
    loop
      base := 18::float8 * s.scale::float8 * r.w::float8 * pg_temp.btw(0.7, 1.3);
      comp := s.comp::float8 * pg_temp.btw(0.7, 1.3);
      cutb := 62::float8 + pg_temp.btw(-4, 8);
      perform pg_temp.add_series('secondary', r.code, s.code, base, comp, cutb);
    end loop;
  end loop;

  -- 일정 (2027학년도만, 시도마다 0~3일 차이, 1차 시험일은 전국 동일)
  foreach lv in array array['elementary', 'secondary']::exam_level[] loop
    for r in select code from regions order by sort loop
      shift := floor(pg_temp.btw(0, 4))::int;
      for e in select * from (values
        (1, 'pre_notice', date '2026-08-07', date '2026-08-07'),
        (2, 'plan', date '2026-09-04', date '2026-09-25'),
        (3, 'receipt_start', date '2026-10-05', date '2026-10-13'),
        (4, 'receipt_end', date '2026-10-09', date '2026-10-19'),
        (5, 'first_exam', date '2026-11-07', date '2026-11-28'),
        (6, 'first_result', date '2026-12-04', date '2026-12-25'),
        (7, 'second_exam', date '2027-01-07', date '2027-01-20'),
        (8, 'final_result', date '2027-01-29', date '2027-02-10')) v(o, ev, d_el, d_sec) order by o
      loop
        insert into exam_schedules (year, level, region, event, date, source_id)
        values (2027, lv, r.code, e.ev::schedule_event,
          (case when lv = 'elementary' then e.d_el else e.d_sec end)
            + case when e.ev in ('first_exam', 'pre_notice') then 0 else shift end,
          'sample');
      end loop;
    end loop;
  end loop;
end $$;

-- 확인: 아래 세 숫자가 3060 / 1530 / 272 이면 성공
select
  (select count(*) from selection_counts) as selection_counts,
  (select count(*) from exam_results) as exam_results,
  (select count(*) from exam_schedules) as exam_schedules;

-- ───── 샘플 지우기 (실제 데이터 넣기 전에 실행) ─────
-- delete from exam_schedules where source_id = 'sample';
-- delete from exam_results where source_id = 'sample';
-- delete from selection_counts where source_id = 'sample';
