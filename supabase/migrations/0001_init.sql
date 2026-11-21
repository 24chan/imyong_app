-- 임용몽땅 DB 1단계: 통계 테이블 + 읽기 권한 + 오류 신고
-- Supabase → SQL Editor에 붙여넣고 Run. (한 번만 실행)

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
