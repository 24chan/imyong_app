/* 1분 퀴즈 문제별 오답률 (2026-11-28). 누가 풀었는지는 남기지 않고 문제별 숫자만 셈 */
create table if not exists public.quiz_stats (
  qid text primary key,
  tries integer not null default 0,
  wrong integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.quiz_stats enable row level security;

drop policy if exists "quiz_stats read" on public.quiz_stats;
create policy "quiz_stats read" on public.quiz_stats for select using (true);
/* 직접 쓰기는 막고, 아래 함수로만 1씩 올림 */

create or replace function public.record_quiz_answer(p_qid text, p_correct boolean)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.quiz_stats (qid, tries, wrong)
  values (left(p_qid, 20), 1, case when p_correct then 0 else 1 end)
  on conflict (qid) do update
    set tries = quiz_stats.tries + 1,
        wrong = quiz_stats.wrong + (case when p_correct then 0 else 1 end),
        updated_at = now();
$$;

grant execute on function public.record_quiz_answer(text, boolean) to anon, authenticated;
notify pgrst, 'reload schema';
