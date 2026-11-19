/* 0012 스터디 모집 · 공부 자료 · 모의고사 (일정·후기·점수 비교)
   - 공부 자료는 직접 쓴 글만 (파일·사진 업로드 없음 → 교재·강의 PDF 공유 차단)
   - 쓰기는 인증 회원만(0011 의 check_writer), 신고·숨김·제재는 커뮤니티와 같은 방식
   0011 다음에 실행. 여러 번 실행해도 괜찮아요. */

create table if not exists public.studies (
  id bigint generated always as identity primary key,
  author_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  level text not null check (level in ('elementary', 'secondary')),
  subject_code text references public.subjects(code),
  regions text[] not null default '{}',          /* 오프라인 지역 (시도 코드) */
  stage text not null check (stage in ('first', 'second', 'both')),
  mode text not null check (mode in ('online', 'offline', 'both')),
  capacity int not null check (capacity between 2 and 30),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 3000),
  status text not null default 'open' check (status in ('open', 'closed', 'hidden', 'deleted')),
  created_at timestamptz not null default now()
);
create index if not exists studies_list on public.studies (level, status, id desc);

create table if not exists public.materials (
  id bigint generated always as identity primary key,
  author_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  level text not null check (level in ('elementary', 'secondary')),
  subject_code text references public.subjects(code),
  area text not null default 'major' check (area in ('pedagogy', 'major', 'second', 'etc')),  /* 교육학·전공·2차·기타 */
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 20 and 20000),
  like_count int not null default 0,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists materials_list on public.materials (level, id desc);
create table if not exists public.material_likes (material_id bigint references public.materials(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, primary key (material_id, user_id));

create table if not exists public.mock_exams (
  id bigint generated always as identity primary key,
  name text not null,
  provider text not null,                          /* 주관 (학원·기관) */
  level text not null check (level in ('elementary', 'secondary')),
  subject_code text references public.subjects(code),
  exam_date date,
  apply_url text,
  note text,
  created_at timestamptz not null default now()
);
create table if not exists public.mock_reviews (
  id bigint generated always as identity primary key,
  exam_id bigint not null references public.mock_exams(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  rating int not null check (rating between 1 and 5),
  difficulty int not null check (difficulty between 1 and 5),
  body text not null check (char_length(body) between 5 and 2000),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  unique (exam_id, author_id)
);
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

create or replace function public.report_content(p_type text, p_id bigint, p_reason text, p_detail text default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int; v_author uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  v_author := public.author_of(p_type, p_id);
  if v_author is null then raise exception '신고할 대상을 찾을 수 없어요'; end if;
  if v_author = auth.uid() then raise exception '내 글은 신고할 수 없어요'; end if;
  if p_type = 'message' and not exists (
    select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
     where m.id = p_id and auth.uid() in (c.a_id, c.b_id)) then
    raise exception '신고할 대상을 찾을 수 없어요';
  end if;
  insert into public.reports (target_type, target_id, reporter_id, reason, detail)
  values (p_type, p_id, auth.uid(), p_reason, p_detail)
  on conflict (target_type, target_id, reporter_id) do nothing;
  select count(*) into n from public.reports where target_type = p_type and target_id = p_id and status = 'open';
  if n >= 5 then
    case p_type
      when 'post' then update public.posts set status = 'hidden', hidden_reason = '신고 누적' where id = p_id and status = 'visible';
      when 'comment' then update public.comments set status = 'hidden' where id = p_id and status = 'visible';
      when 'study' then update public.studies set status = 'hidden' where id = p_id and status in ('open', 'closed');
      when 'material' then update public.materials set status = 'hidden' where id = p_id and status = 'visible';
      when 'mock_review' then update public.mock_reviews set status = 'hidden' where id = p_id and status = 'visible';
      else null;
    end case;
  end if;
  return n;
end; $$;

/* 쪽지 시작: 스터디 모집 글에서도 (참여 문의) */
create or replace function public.start_conversation(p_type text, p_id bigint, p_verification uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_label text; v_other uuid; v_other_label text; v_title text; v_id uuid;
begin
  v_label := public.check_writer(p_verification, null);
  v_other := public.author_of(p_type, p_id);
  if v_other is null or v_other = auth.uid() then raise exception '쪽지를 보낼 수 없어요'; end if;
  if p_type = 'post' then select label, title into v_other_label, v_title from public.posts where id = p_id;
  elsif p_type = 'comment' then
    select c.label, p.title into v_other_label, v_title from public.comments c join public.posts p on p.id = c.post_id where c.id = p_id;
  elsif p_type = 'study' then select label, '[스터디] ' || title into v_other_label, v_title from public.studies where id = p_id;
  elsif p_type = 'material' then select label, '[자료] ' || title into v_other_label, v_title from public.materials where id = p_id;
  else raise exception '쪽지를 보낼 수 없어요';
  end if;
  if exists (select 1 from public.blocks where (blocker_id = v_other and blocked_id = auth.uid()) or (blocker_id = auth.uid() and blocked_id = v_other)) then
    raise exception '쪽지를 보낼 수 없는 상대예요';
  end if;
  if coalesce((select dm_off from public.profiles where id = v_other), false) then raise exception '상대가 쪽지 받기를 꺼 두었어요'; end if;
  select id into v_id from public.conversations
   where (a_id = auth.uid() and b_id = v_other) or (a_id = v_other and b_id = auth.uid())
   order by last_at desc limit 1;
  if v_id is not null then return v_id; end if;
  if (select count(*) from public.conversations where a_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception '새 쪽지 대화는 하루 20개까지 시작할 수 있어요';
  end if;
  insert into public.conversations (a_id, b_id, a_label, b_label, origin_title)
  values (auth.uid(), v_other, v_label, v_other_label, left(v_title, 60)) returning id into v_id;
  return v_id;
end; $$;

/* 운영자 신고 목록·처리에 새 대상 추가 */
create or replace view public.admin_reports_v as
  select r.target_type, r.target_id, count(*) as reports, min(r.created_at) as first_at,
         string_agg(distinct r.reason, ', ') as reasons,
         case r.target_type
           when 'post' then (select title || ' — ' || left(body, 200) from public.posts where id = r.target_id)
           when 'comment' then (select left(body, 300) from public.comments where id = r.target_id)
           when 'message' then (select coalesce(left(body, 300), '[사진]') from public.messages where id = r.target_id)
           when 'study' then (select '[스터디] ' || title || ' — ' || left(body, 200) from public.studies where id = r.target_id)
           when 'material' then (select '[자료] ' || title || ' — ' || left(body, 200) from public.materials where id = r.target_id)
           when 'mock_review' then (select '[모의고사 후기] ' || left(body, 300) from public.mock_reviews where id = r.target_id)
         end as content,
         case r.target_type
           when 'post' then (select status from public.posts where id = r.target_id)
           when 'comment' then (select status from public.comments where id = r.target_id)
           when 'study' then (select status from public.studies where id = r.target_id)
           when 'material' then (select status from public.materials where id = r.target_id)
           when 'mock_review' then (select status from public.mock_reviews where id = r.target_id)
           else 'visible'
         end as content_status,
         (select count(*) from public.sanctions s where s.user_id = public.author_of(r.target_type, r.target_id)) as author_sanctions
    from public.reports r
   where r.status = 'open' and public.is_admin()
   group by r.target_type, r.target_id;
grant select on public.admin_reports_v to authenticated;

create or replace function public.admin_resolve(p_type text, p_id bigint, p_action text, p_sanction text default null, p_reason text default null, p_hide_days int default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_end timestamptz; v_status text;
begin
  if not public.is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  if p_action not in ('keep', 'hide', 'delete') then raise exception '처리 방법이 올바르지 않아요'; end if;
  v_author := public.author_of(p_type, p_id);
  if p_type = 'post' then
    if p_action = 'keep' then update public.posts set status = 'visible', hidden_reason = null, hidden_until = null where id = p_id and status = 'hidden';
    elsif p_action = 'hide' then update public.posts set status = 'hidden', hidden_reason = coalesce(p_reason, '운영 규칙 위반'),
      hidden_until = case when p_hide_days is null then null else now() + make_interval(days => least(p_hide_days, 30)) end where id = p_id;
    else update public.posts set status = 'deleted' where id = p_id; end if;
  elsif p_type = 'message' then
    if p_action = 'delete' then update public.messages set body = '운영 규칙 위반으로 삭제된 쪽지예요', image_path = null where id = p_id; end if;
  else
    v_status := case p_action when 'keep' then 'visible' when 'hide' then 'hidden' else 'deleted' end;
    if p_type = 'study' and v_status = 'visible' then v_status := 'open'; end if;
    execute format('update public.%I set status = $1 where id = $2', case p_type when 'comment' then 'comments' when 'study' then 'studies' when 'material' then 'materials' when 'mock_review' then 'mock_reviews' end)
      using v_status, p_id;
  end if;
  update public.reports set status = 'resolved' where target_type = p_type and target_id = p_id;
  if p_sanction is not null and v_author is not null then
    v_end := case p_sanction when 'write_7d' then now() + interval '7 days' when 'write_30d' then now() + interval '30 days' else null end;
    insert into public.sanctions (user_id, level, reason, ends_at) values (v_author, p_sanction, coalesce(p_reason, '운영 규칙 위반'), v_end);
  end if;
end; $$;

create or replace function public.block_author(p_type text, p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare v_target uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if p_type = 'conversation' then
    select case when a_id = auth.uid() then b_id else a_id end into v_target
      from public.conversations where id = p_id::uuid and auth.uid() in (a_id, b_id);
  else
    v_target := public.author_of(p_type, p_id::bigint);
  end if;
  if v_target is null or v_target = auth.uid() then raise exception '차단할 수 없어요'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), v_target) on conflict do nothing;
end; $$;

do $$
declare f text;
begin
  foreach f in array array[
    'create_study(text,text,text[],text,text,int,text,text,uuid)', 'set_study_status(bigint,text)',
    'create_material(text,text,text,text,text,uuid)', 'update_material(bigint,text,text)', 'delete_material(bigint)', 'toggle_material_like(bigint)',
    'upsert_mock_review(bigint,int,int,text,uuid)', 'delete_mock_review(bigint)', 'add_mock_score(text,text,int,bigint,numeric,numeric)', 'delete_mock_score(bigint)',
    'admin_add_mock_exam(text,text,text,text,date,text,text)', 'admin_delete_mock_exam(bigint)',
    'report_content(text,bigint,text,text)', 'start_conversation(text,bigint,uuid)', 'admin_resolve(text,bigint,text,text,text,int)', 'block_author(text,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select (select count(*) from public.mock_exams) as "모의고사 일정 수";
