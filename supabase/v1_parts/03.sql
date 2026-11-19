/* v1 설치 3/9 — 순서대로 실행하세요. 여러 번 실행해도 안전해요. */
create or replace view public.my_sanctions_v as
  select id, level, reason, starts_at, ends_at, appeal, appeal_status,
         (level in ('write_7d', 'write_30d', 'permanent') and (ends_at is null or ends_at > now()) and coalesce(appeal_status, '') <> 'accepted') as active
    from public.sanctions where user_id = auth.uid();

grant select on public.posts_v, public.comments_v, public.hot_posts_v to anon, authenticated;
grant select on public.my_scraps_v, public.my_conversations_v, public.my_sanctions_v to authenticated;

/* ───── 쓰기 함수 ───── */
create or replace function public.create_post(p_board text, p_title text, p_body text, p_verification uuid default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_label text; v_id bigint;
begin
  v_label := public.check_writer(p_verification, p_title || ' ' || p_body);
  if (select count(*) from public.posts where author_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    raise exception '글은 1시간에 10개까지 쓸 수 있어요';
  end if;
  if not exists (select 1 from public.boards where id = p_board) then raise exception '게시판이 없어요'; end if;
  insert into public.posts (board_id, author_id, label, title, body) values (p_board, auth.uid(), v_label, trim(p_title), trim(p_body))
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.update_post(p_id bigint, p_title text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.check_writer(null, p_title || ' ' || p_body);
  update public.posts set title = trim(p_title), body = trim(p_body), updated_at = now()
   where id = p_id and author_id = auth.uid() and status <> 'deleted';
  if not found then raise exception '내 글만 고칠 수 있어요'; end if;
end; $$;

create or replace function public.delete_post(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.posts set status = 'deleted' where id = p_id and (author_id = auth.uid() or public.is_admin());
  if not found then raise exception '내 글만 지울 수 있어요'; end if;
end; $$;

create or replace function public.create_comment(p_post bigint, p_body text, p_parent bigint default null, p_verification uuid default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_label text; v_no int; v_author uuid; v_id bigint;
begin
  v_label := public.check_writer(p_verification, p_body);
  select author_id into v_author from public.posts where id = p_post and status = 'visible';
  if v_author is null then raise exception '댓글을 달 수 없는 글이에요'; end if;
  if exists (select 1 from public.blocks where blocker_id = v_author and blocked_id = auth.uid()) then
    raise exception '댓글을 달 수 없는 글이에요';
  end if;
  if (select count(*) from public.comments where author_id = auth.uid() and created_at > now() - interval '10 minutes') >= 20 then
    raise exception '댓글을 너무 빨리 쓰고 있어요. 잠시 뒤에 써 주세요';
  end if;
  if v_author = auth.uid() then
    v_no := 0;
  else
    select anon_no into v_no from public.post_anon where post_id = p_post and user_id = auth.uid();
    if v_no is null then
      perform 1 from public.posts where id = p_post for update; /* 번호 겹치지 않게 */
      select coalesce(max(anon_no), 0) + 1 into v_no from public.post_anon where post_id = p_post;
      insert into public.post_anon (post_id, user_id, anon_no) values (p_post, auth.uid(), v_no);
    end if;
  end if;
  insert into public.comments (post_id, parent_id, author_id, label, anon_no, body)
  values (p_post, p_parent, auth.uid(), v_label, v_no, trim(p_body)) returning id into v_id;
  update public.posts set comment_count = comment_count + 1 where id = p_post;
  return v_id;
end; $$;

create or replace function public.delete_comment(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_post bigint;
begin
  update public.comments set status = 'deleted' where id = p_id and status <> 'deleted' and (author_id = auth.uid() or public.is_admin())
  returning post_id into v_post;
  if v_post is null then raise exception '내 댓글만 지울 수 있어요'; end if;
  update public.posts set comment_count = greatest(comment_count - 1, 0) where id = v_post;
end; $$;

/* 공감·스크랩: 누르면 켜고 다시 누르면 끔. 돌려주는 값 = 새 개수 */
create or replace function public.toggle_post_like(p_id bigint) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if not exists (select 1 from public.verifications where user_id = auth.uid() and status = 'approved') then
    raise exception '인증한 회원만 공감할 수 있어요';
  end if;
  if exists (select 1 from public.posts where id = p_id and author_id = auth.uid()) then raise exception '내 글에는 공감할 수 없어요'; end if;
  delete from public.post_likes where post_id = p_id and user_id = auth.uid();
  if not found then insert into public.post_likes values (p_id, auth.uid()); end if;
  update public.posts set like_count = (select count(*) from public.post_likes where post_id = p_id) where id = p_id returning like_count into n;
  return n;
end; $$;

create or replace function public.toggle_comment_like(p_id bigint) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if not exists (select 1 from public.verifications where user_id = auth.uid() and status = 'approved') then
    raise exception '인증한 회원만 공감할 수 있어요';
  end if;
  delete from public.comment_likes where comment_id = p_id and user_id = auth.uid();
  if not found then insert into public.comment_likes values (p_id, auth.uid()); end if;
  update public.comments set like_count = (select count(*) from public.comment_likes where comment_id = p_id) where id = p_id returning like_count into n;
  return n;
end; $$;

create or replace function public.toggle_scrap(p_id bigint) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  delete from public.scraps where post_id = p_id and user_id = auth.uid();
  if found then
    update public.posts set scrap_count = greatest(scrap_count - 1, 0) where id = p_id;
    return false;
  end if;
  insert into public.scraps (post_id, user_id) values (p_id, auth.uid());
  update public.posts set scrap_count = scrap_count + 1 where id = p_id;
  return true;
end; $$;

/* 대상(글·댓글·쪽지) → 작성자 id (앱에는 안 보냄) */
create or replace function public.author_of(p_type text, p_id bigint) returns uuid
language sql stable security definer set search_path = public as $$
  select case p_type
    when 'post' then (select author_id from public.posts where id = p_id)
    when 'comment' then (select author_id from public.comments where id = p_id)
    when 'message' then (select sender_id from public.messages where id = p_id)
  end;
$$;
revoke all on function public.author_of(text, bigint) from public, anon, authenticated;

/* 신고: 서로 다른 5명이 신고하면 자동 숨김 (운영자가 최종 판단) */
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
    if p_type = 'post' then update public.posts set status = 'hidden', hidden_reason = '신고 누적' where id = p_id and status = 'visible';
    elsif p_type = 'comment' then update public.comments set status = 'hidden' where id = p_id and status = 'visible';
    end if;
  end if;
  return n;
end; $$;

/* 차단: 글·댓글·쪽지 대화 상대를 차단 (상대 id 는 안 보여줌) */
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

create or replace function public.clear_blocks() returns int
language sql security definer set search_path = public as $$
  with d as (delete from public.blocks where blocker_id = auth.uid() returning 1) select count(*)::int from d;
$$;

/* 제재 이의 신청 */
create or replace function public.appeal_sanction(p_id bigint, p_text text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.sanctions set appeal = trim(p_text), appeal_status = 'open'
   where id = p_id and user_id = auth.uid() and appeal_status is null;
  if not found then raise exception '이의 신청은 제재마다 한 번만 할 수 있어요'; end if;
end; $$;

/* ───── 쪽지 함수 ───── */
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

create or replace function public.is_conv_member(p_conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversations where id = p_conv and auth.uid() in (a_id, b_id));
$$;

select '3/9 완료' as result;
