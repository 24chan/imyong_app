/* 0022 쪽지 보안 점검 고친 것 (2026-11-22)
   1. 대화를 나가면(지워지면) '하루 20개' 숫자가 줄어 제한을 피할 수 있던 문제 → 시작 기록을 따로 남겨서 셈
   2. '쪽지 받기 끄기'가 새 대화만 막고 이미 있는 대화의 쪽지는 계속 오던 문제 → 끄면 받는 쪽지도 막음
   여러 번 실행해도 괜찮아요. */
begin;

create table if not exists public.dm_starts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists dm_starts_user on public.dm_starts (user_id, created_at desc);
alter table public.dm_starts enable row level security;
revoke all on public.dm_starts from anon, authenticated;
/* 지금 있는 대화도 오늘 숫자에 넣기 */
insert into public.dm_starts (user_id, created_at)
  select a_id, created_at from public.conversations c
   where created_at > now() - interval '1 day'
     and not exists (select 1 from public.dm_starts s where s.user_id = c.a_id and s.created_at = c.created_at);

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
  /* 하루 20개: 대화를 나가도(지워도) 줄지 않게 따로 센 기록으로 */
  if (select count(*) from public.dm_starts where user_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception '새 쪽지 대화는 하루 20개까지 시작할 수 있어요';
  end if;
  insert into public.dm_starts (user_id) values (auth.uid());
  insert into public.conversations (a_id, b_id, a_label, b_label, origin_title)
  values (auth.uid(), v_other, v_label, v_other_label, left(v_title, 60)) returning id into v_id;
  return v_id;
end; $$;


create or replace function public.send_message(p_conv uuid, p_body text, p_image text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare c public.conversations%rowtype; v_other uuid; v_id bigint; v_run int;
begin
  perform public.check_writer(null, p_body);
  select * into c from public.conversations where id = p_conv and auth.uid() in (a_id, b_id);
  if c.id is null then raise exception '대화를 찾을 수 없어요'; end if;
  v_other := case when c.a_id = auth.uid() then c.b_id else c.a_id end;
  if exists (select 1 from public.blocks where (blocker_id = v_other and blocked_id = auth.uid()) or (blocker_id = auth.uid() and blocked_id = v_other)) then
    raise exception '쪽지를 보낼 수 없는 상대예요';
  end if;
  if coalesce((select dm_off from public.profiles where id = v_other), false) then raise exception '상대가 쪽지 받기를 꺼 두었어요'; end if;
  /* 상대가 답장하기 전에는 3통까지 */
  select count(*) into v_run from public.messages
   where conversation_id = p_conv and sender_id = auth.uid()
     and id > coalesce((select max(id) from public.messages where conversation_id = p_conv and sender_id = v_other), 0);
  if v_run >= 3 then raise exception '상대가 답장하기 전에는 3통까지 보낼 수 있어요'; end if;
  if p_image is not null and split_part(p_image, '/', 1) <> p_conv::text then raise exception '사진 경로가 올바르지 않아요'; end if;
  insert into public.messages (conversation_id, sender_id, body, image_path)
  values (p_conv, auth.uid(), nullif(trim(coalesce(p_body, '')), ''), p_image) returning id into v_id;
  update public.conversations set last_at = now() where id = p_conv;
  return v_id;
end; $$;


commit;
