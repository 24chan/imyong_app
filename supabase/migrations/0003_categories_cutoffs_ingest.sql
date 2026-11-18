-- 0003: 지역 구분모집, 일반/장애/지역별 결과, 최종(2차) 합격선, 자동 수집 '검수 대기' 칸
-- Supabase SQL Editor에서 한 번 Run (0002는 실행하지 않았다면 건너뛰어도 됨)

begin;

-- 1) 선발 인원: 일반/장애는 공개 안 된 경우 비움 + 지역 구분모집 칸
alter table selection_counts alter column general drop not null;
alter table selection_counts alter column disabled drop not null;
alter table selection_counts alter column disabled drop default;
alter table selection_counts add column if not exists regional int;  -- 지역 구분모집 (없으면 비움)

-- 2) 시험 결과: 구분(전체/일반/장애/지역)별로 한 줄씩 + 최종 합격선
alter table exam_results add column if not exists category text not null default 'all'
  check (category in ('all', 'general', 'disabled', 'regional'));
alter table exam_results add column if not exists selected int;         -- 이 구분의 선발(모집) 인원
alter table exam_results add column if not exists final_cutoff numeric(6,2);  -- 최종(1+2차 합산) 합격선
alter table exam_results alter column applicants drop not null;

-- 기존 고유 조건(연도·모드·지역·과목)을 지우고 구분까지 포함해 다시 만듦
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'exam_results'::regclass and contype = 'u'
  loop
    execute format('alter table exam_results drop constraint %I', c);
  end loop;
end $$;
alter table exam_results add constraint exam_results_uniq
  unique nulls not distinct (year, level, region, subject, category);

-- 3) 자동 수집기가 넣는 '검수 대기' 칸 (앱에서는 안 보임, 운영자만)
create table if not exists ingest_queue (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  region text references regions(code),
  level exam_level,
  doc_type text not null,          -- 예: plan(시행계획), receipt(접수현황), first_result(1차 합격), final_result(최종 합격)
  title text not null,
  source_url text not null,
  file_url text,
  parsed jsonb,                    -- 수집기가 뽑은 숫자 (검수 전)
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'error')),
  note text,
  unique (source_url, file_url)
);
alter table ingest_queue enable row level security;  -- 정책 없음 = 앱(anon)은 읽기·쓰기 불가

commit;

select 'ok' as result;
