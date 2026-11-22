/* 0027 사진·PDF 제보를 일정에도 (2026-11-22 사용자 요청)
   실습학교 제보 표(practice_tips)에 '무엇에 대한 제보인지(topic)' 칸 추가: practice(실습학교) / event(일정)
   일정 제보: 학원 공지 캡처·사진·PDF·주소만 보내도 됨 → 운영자가 일정으로 옮겨 적고 첨부는 바로 삭제
   여러 번 실행해도 안전 */

alter table public.practice_tips add column if not exists topic text not null default 'practice';
alter table public.practice_tips drop constraint if exists practice_tips_topic_check;
alter table public.practice_tips add constraint practice_tips_topic_check check (topic in ('practice', 'event'));

create or replace function public.submit_file_tip(p_topic text, p_univ text, p_year int, p_note text, p_url text, p_files text[])
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; f text;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if p_topic not in ('practice', 'event') then raise exception '제보 종류가 올바르지 않아요'; end if;
  if (select count(*) from public.practice_tips where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception '제보는 하루 10건까지 할 수 있어요';
  end if;
  if coalesce(cardinality(p_files), 0) = 0 and nullif(trim(coalesce(p_url, '')), '') is null and char_length(trim(coalesce(p_note, ''))) < 4 then
    raise exception '사진·PDF·주소·내용 중 하나는 넣어 주세요';
  end if;
  foreach f in array coalesce(p_files, '{}') loop
    if split_part(f, '/', 1) <> auth.uid()::text then raise exception '첨부 파일이 올바르지 않아요'; end if;
  end loop;
  insert into public.practice_tips (topic, univ, year, note, url, file_paths)
  values (p_topic, coalesce(nullif(trim(p_univ), ''), case when p_topic = 'event' then '일정' else '기타' end), p_year,
          nullif(trim(coalesce(p_note, '')), ''), nullif(trim(coalesce(p_url, '')), ''), coalesce(p_files, '{}'))
  returning id into v_id;
  return v_id;
end $$;

/* 운영자 보기에 종류 칸 추가 (새 칸은 맨 뒤) */
create or replace view public.admin_practice_tips_v as
  select id, univ, year, note, url, file_paths, created_at, topic
    from public.practice_tips where status = 'pending' and public.is_admin();
grant select on public.admin_practice_tips_v to authenticated;

revoke all on function public.submit_file_tip(text, text, int, text, text, text[]) from public, anon;
grant execute on function public.submit_file_tip(text, text, int, text, text, text[]) to authenticated;

select '0027 완료' as result;
