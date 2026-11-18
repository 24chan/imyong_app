/* 0006: 홈 '임용 소식' — 수집기가 찾은 교육청 공고 목록 (제목·원문 링크·종류·등록일)
   숫자는 여기 넣지 않음. 앱이 승인된 exam_results 에서 같이 보여줌 */
begin;

create table if not exists notices (
  id bigint generated always as identity primary key,
  url text not null unique,
  region text not null references regions(code),
  level exam_level not null,
  year int not null,
  doc_type text not null check (doc_type in ('prelim', 'plan', 'receipt', 'attend', 'first_pass', 'final_pass', 'private')),
  title text not null,
  posted_at date,
  files jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists notices_recent on notices (level, posted_at desc nulls last);

alter table notices enable row level security;
drop policy if exists notices_read on notices;
create policy notices_read on notices for select to anon, authenticated using (true);
grant select on notices to anon, authenticated;

commit;

select 'ok' as result;
