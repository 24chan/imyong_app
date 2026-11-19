/* v1 설치 5/9 — 순서대로 실행하세요. 여러 번 실행해도 안전해요. */
/* 모의고사 점수 vs 실제 1차 점수 (본인 기록, 통계는 5명 이상일 때만) */
create table if not exists public.mock_scores (
  id bigint generated always as identity primary key,
  author_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('elementary', 'secondary')),
  subject_code text references public.subjects(code),
  year int not null check (year between 2020 and 2100),       /* 응시한 학년도 */
  exam_id bigint references public.mock_exams(id) on delete set null,
  mock_score numeric(5,2) not null check (mock_score between 0 and 100),
  real_score numeric(5,2) check (real_score between 0 and 100),
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['studies','materials','material_likes','mock_reviews','mock_scores'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
alter table public.mock_exams enable row level security;
drop policy if exists "누구나 읽기" on public.mock_exams;
create policy "누구나 읽기" on public.mock_exams for select to anon, authenticated using (true);
grant select on public.mock_exams to anon, authenticated;

/* ───── 읽기 view ───── */
create or replace view public.studies_v as
  select s.id, s.label, s.level, s.subject_code, s.regions, s.stage, s.mode, s.capacity, s.title,
         case when s.status in ('open', 'closed') or s.author_id = auth.uid() then s.body else '' end as body,
         s.status, s.created_at, (s.author_id = auth.uid()) as is_mine
    from public.studies s
   where s.status <> 'deleted' and (s.status <> 'hidden' or s.author_id = auth.uid())
     and not exists (select 1 from public.blocks k where k.blocker_id = auth.uid() and k.blocked_id = s.author_id);

create or replace view public.materials_v as
  select m.id, m.label, m.level, m.subject_code, m.area, m.title,
         case when m.status = 'visible' or m.author_id = auth.uid() then m.body else '' end as body,
         m.like_count, m.status, m.created_at, m.updated_at, (m.author_id = auth.uid()) as is_mine,
         exists (select 1 from public.material_likes l where l.material_id = m.id and l.user_id = auth.uid()) as liked
    from public.materials m
   where m.status <> 'deleted' and (m.status = 'visible' or m.author_id = auth.uid())
     and not exists (select 1 from public.blocks k where k.blocker_id = auth.uid() and k.blocked_id = m.author_id);

create or replace view public.mock_reviews_v as
  select r.id, r.exam_id, r.label, r.rating, r.difficulty, r.body, r.created_at, (r.author_id = auth.uid()) as is_mine
    from public.mock_reviews r
   where r.status = 'visible'
     and not exists (select 1 from public.blocks k where k.blocker_id = auth.uid() and k.blocked_id = r.author_id);

create or replace view public.mock_exams_v as
  select e.*, (select count(*) from public.mock_reviews r where r.exam_id = e.id and r.status = 'visible') as review_count,
         (select round(avg(rating), 1) from public.mock_reviews r where r.exam_id = e.id and r.status = 'visible') as rating_avg,
         (select round(avg(difficulty), 1) from public.mock_reviews r where r.exam_id = e.id and r.status = 'visible') as difficulty_avg
    from public.mock_exams e;

create or replace view public.my_mock_scores_v as
  select id, level, subject_code, year, exam_id, mock_score, real_score, created_at from public.mock_scores where author_id = auth.uid();

grant select on public.studies_v, public.materials_v, public.mock_reviews_v, public.mock_exams_v to anon, authenticated;
grant select on public.my_mock_scores_v to authenticated;

/* 점수 비교 통계: 모의 점수 구간(5점)별 실제 1차 평균. 표본 5명 미만 구간은 숨김 */
create or replace function public.mock_score_stats(p_level text, p_subject text default null)
returns table (band int, n bigint, mock_avg numeric, real_avg numeric, diff_avg numeric)
language sql stable security definer set search_path = public as $$
  select (floor(mock_score / 5) * 5)::int as band, count(*), round(avg(mock_score), 1), round(avg(real_score), 1), round(avg(real_score - mock_score), 1)
    from public.mock_scores
   where level = p_level and real_score is not null and (p_subject is null or subject_code = p_subject)
   group by 1 having count(*) >= 5 order by 1;
$$;
grant execute on function public.mock_score_stats(text, text) to anon, authenticated;

/* ───── 쓰기 함수 ───── */
create or replace function public.create_study(p_level text, p_subject text, p_regions text[], p_stage text, p_mode text, p_capacity int, p_title text, p_body text, p_verification uuid default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_label text; v_id bigint;
begin
  v_label := public.check_writer(p_verification, p_title || ' ' || p_body);
  if (select count(*) from public.studies where author_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception '스터디 모집 글은 하루 5개까지 쓸 수 있어요';
  end if;
  insert into public.studies (author_id, label, level, subject_code, regions, stage, mode, capacity, title, body)
  values (auth.uid(), v_label, p_level, nullif(p_subject, ''), coalesce(p_regions, '{}'), p_stage, p_mode, p_capacity, trim(p_title), trim(p_body))
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.set_study_status(p_id bigint, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('open', 'closed', 'deleted') then raise exception '상태가 올바르지 않아요'; end if;
  update public.studies set status = p_status where id = p_id and (author_id = auth.uid() or public.is_admin()) and status <> 'deleted';
  if not found then raise exception '내 모집 글만 바꿀 수 있어요'; end if;
end; $$;

create or replace function public.create_material(p_level text, p_subject text, p_area text, p_title text, p_body text, p_verification uuid default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_label text; v_id bigint;
begin
  v_label := public.check_writer(p_verification, p_title || ' ' || p_body);
  if p_body ~* '(drive\.google|dropbox|mega\.nz|pdf\s*(파일|공유)|파일\s*공유|링크\s*드려요)' then
    raise exception '자료 파일·링크 공유는 할 수 없어요. 직접 정리한 내용만 올려 주세요';
  end if;
  insert into public.materials (author_id, label, level, subject_code, area, title, body)
  values (auth.uid(), v_label, p_level, nullif(p_subject, ''), p_area, trim(p_title), trim(p_body)) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.update_material(p_id bigint, p_title text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.check_writer(null, p_title || ' ' || p_body);
  update public.materials set title = trim(p_title), body = trim(p_body), updated_at = now() where id = p_id and author_id = auth.uid() and status <> 'deleted';
  if not found then raise exception '내 자료만 고칠 수 있어요'; end if;
end; $$;

create or replace function public.delete_material(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.materials set status = 'deleted' where id = p_id and (author_id = auth.uid() or public.is_admin());
  if not found then raise exception '내 자료만 지울 수 있어요'; end if;
end; $$;

create or replace function public.toggle_material_like(p_id bigint) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from public.verifications where user_id = auth.uid() and status = 'approved') then raise exception '인증한 회원만 공감할 수 있어요'; end if;
  if exists (select 1 from public.materials where id = p_id and author_id = auth.uid()) then raise exception '내 자료에는 공감할 수 없어요'; end if;
  delete from public.material_likes where material_id = p_id and user_id = auth.uid();
  if not found then insert into public.material_likes values (p_id, auth.uid()); end if;
  update public.materials set like_count = (select count(*) from public.material_likes where material_id = p_id) where id = p_id returning like_count into n;
  return n;
end; $$;

create or replace function public.upsert_mock_review(p_exam bigint, p_rating int, p_difficulty int, p_body text, p_verification uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_label text;
begin
  v_label := public.check_writer(p_verification, p_body);
  insert into public.mock_reviews (exam_id, author_id, label, rating, difficulty, body)
  values (p_exam, auth.uid(), v_label, p_rating, p_difficulty, trim(p_body))
  on conflict (exam_id, author_id) do update set rating = excluded.rating, difficulty = excluded.difficulty, body = excluded.body, label = excluded.label, created_at = now();
end; $$;

create or replace function public.delete_mock_review(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.mock_reviews set status = 'deleted' where id = p_id and (author_id = auth.uid() or public.is_admin());
end; $$;

create or replace function public.add_mock_score(p_level text, p_subject text, p_year int, p_exam bigint, p_mock numeric, p_real numeric) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if (select count(*) from public.mock_scores where author_id = auth.uid()) >= 30 then raise exception '점수는 30개까지 기록할 수 있어요'; end if;
  insert into public.mock_scores (author_id, level, subject_code, year, exam_id, mock_score, real_score)
  values (auth.uid(), p_level, nullif(p_subject, ''), p_year, p_exam, p_mock, p_real) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.delete_mock_score(p_id bigint) returns void
language sql security definer set search_path = public as $$
  delete from public.mock_scores where id = p_id and author_id = auth.uid();
$$;

/* 운영자: 모의고사 일정 등록·삭제 */
create or replace function public.admin_add_mock_exam(p_name text, p_provider text, p_level text, p_subject text, p_date date, p_url text, p_note text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  insert into public.mock_exams (name, provider, level, subject_code, exam_date, apply_url, note)
  values (trim(p_name), trim(p_provider), p_level, nullif(p_subject, ''), p_date, nullif(trim(p_url), ''), nullif(trim(p_note), '')) returning id into v_id;
  return v_id;
end; $$;
create or replace function public.admin_delete_mock_exam(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  delete from public.mock_exams where id = p_id;
end; $$;

/* ───── 신고·차단·쪽지 대상 넓히기 (스터디·자료·모의고사 후기) ───── */
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'comment', 'message', 'study', 'material', 'mock_review'));

create or replace function public.author_of(p_type text, p_id bigint) returns uuid
language sql stable security definer set search_path = public as $$
  select case p_type
    when 'post' then (select author_id from public.posts where id = p_id)
    when 'comment' then (select author_id from public.comments where id = p_id)
    when 'message' then (select sender_id from public.messages where id = p_id)
    when 'study' then (select author_id from public.studies where id = p_id)
    when 'material' then (select author_id from public.materials where id = p_id)
    when 'mock_review' then (select author_id from public.mock_reviews where id = p_id)
  end;
$$;
revoke all on function public.author_of(text, bigint) from public, anon, authenticated;

select '5/9 완료' as result;
