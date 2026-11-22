/* 0021 보안 점검 고친 것 (2026-11-22)
   1. 닉네임 바꾼 날짜(nickname_changed_at)를 앱에서 직접 지워 30일 제한을 피할 수 있던 문제 → 함수로만 바뀌게
   2. 운영자 함수·학교 메일 인증 함수: 로그인 안 한 사람(anon)의 호출 권한 회수 (안에서도 막고 있었지만 이중으로)
   3. 알림 구독 등록: 1분에 300건 넘게 몰리면 잠시 거절 (가짜 토큰 대량 등록 막기)
   여러 번 실행해도 괜찮아요. */
begin;

create or replace function public.guard_nickname() returns trigger
language plpgsql set search_path = public as $$
begin
  if (tg_op = 'INSERT' and (new.nickname is not null or new.nickname_changed_at is not null))
     or (tg_op = 'UPDATE' and (new.nickname is distinct from old.nickname or new.nickname_changed_at is distinct from old.nickname_changed_at)) then
    if coalesce(current_setting('app.nickname_ok', true), '') <> '1' then
      raise exception '닉네임은 설정 화면에서 바꿔 주세요';
    end if;
  end if;
  return new;
end; $$;

revoke execute on function public.review_verification(uuid, boolean, text, text) from public, anon;
revoke execute on function public.verify_school_email() from public, anon;

create or replace function public.upsert_push_sub(p_token text, p_level text, p_regions text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$' then raise exception '알림 토큰이 올바르지 않아요'; end if;
  if p_level not in ('elementary', 'secondary') then raise exception '시험 구분이 올바르지 않아요'; end if;
  if coalesce(array_length(p_regions, 1), 0) > 17
     or exists (select 1 from unnest(coalesce(p_regions, '{}')) r where r not in (select code from public.regions)) then
    raise exception '지역이 올바르지 않아요';
  end if;
  if (select count(*) from public.push_subs where updated_at > now() - interval '1 minute') > 300 then
    raise exception '잠시 뒤에 다시 시도해 주세요';
  end if;
  insert into public.push_subs (token, level, regions) values (p_token, p_level, coalesce(p_regions, '{}'))
  on conflict (token) do update set level = excluded.level, regions = excluded.regions, updated_at = now();
end; $$;

commit;
