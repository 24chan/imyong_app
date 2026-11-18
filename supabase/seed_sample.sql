-- 샘플 데이터 (실제 수치 아님) — 앱 화면 확인용
-- 0001_init.sql 실행 후 SQL Editor에서 한 번 Run.
-- scripts/generate-sample.mjs 와 같은 계산(같은 시드)이라 앱에 들어 있던 샘플과 숫자가 똑같습니다.
-- 실제 데이터를 넣을 때는 맨 아래 '샘플 지우기'를 실행하세요.

insert into sources (id, title, publisher, url)
values ('sample', '샘플 데이터 (실제 수치 아님)', '임용맵 개발용', null)
on conflict (id) do nothing;

-- 같은 순서로 같은 난수를 만드는 도우미 (이 실행 동안만 존재)
create function pg_temp.rnd() returns float8 language plpgsql as $$
declare s bigint := current_setting('imyong.seed')::bigint;
begin
  s := (s * 1664525 + 1013904223) % 4294967296;
  perform set_config('imyong.seed', s::text, false);
  return s::float8 / 4294967296;
end $$;
create function pg_temp.btw(a float8, b float8) returns float8 language sql as $$ select a + (b - a) * pg_temp.rnd() $$;
create function pg_temp.rd(x float8) returns int language sql as $$ select floor(x + 0.5)::int $$;

create function pg_temp.add_series(lv exam_level, rg text, sb text, base float8, comp float8, cutbase float8)
returns void language plpgsql as $$
declare
  sz float8 := base; y int; conf int; pre int; tot int; dis int; st selection_stage;
  app int; tak int; fp int; cut float8;
begin
  for y in 2018..2027 loop
    sz := greatest(0, sz * pg_temp.btw(0.86, 1.06));
    conf := pg_temp.rd(sz);
    pre := greatest(0, pg_temp.rd(conf * pg_temp.btw(0.94, 1.04)));
    foreach st in array array['preliminary', 'confirmed']::selection_stage[] loop
      tot := case when st = 'preliminary' then pre else conf end;
      dis := pg_temp.rd(tot * pg_temp.btw(0.04, 0.07));
      insert into selection_counts (year, level, region, subject, stage, general, disabled, total, source_id, base_date)
      values (y, lv, rg, sb, st, tot - dis, dis, tot, 'sample',
        make_date(y - 1, case when st = 'preliminary' then 8 else 9 end,
          case when st = 'preliminary' then 10 when lv = 'elementary' then 5 else 25 end));
    end loop;
    continue when conf = 0;
    app := pg_temp.rd(conf * comp * pg_temp.btw(0.75, 1.3));
    if y = 2027 then
      insert into exam_results (year, level, region, subject, applicants, source_id, base_date)
      values (y, lv, rg, sb, app, 'sample', make_date(y - 1, 10, 20));
    else
      tak := pg_temp.rd(app * pg_temp.btw(0.85, 0.95));
      fp := least(tak, pg_temp.rd(conf * 1.5));
      cut := floor((cutbase + pg_temp.btw(-6, 6)) * 10 + 0.5) / 10;
      insert into exam_results (year, level, region, subject, applicants, takers, first_passed, first_cutoff, final_passed, source_id, base_date)
      values (y, lv, rg, sb, app, tak, fp, cut, least(fp, conf), 'sample',
        make_date(y, 1, case when lv = 'elementary' then 10 else 25 end));
    end if;
  end loop;
end $$;

do $$
declare
  r record; s record; base float8; comp float8; cutb float8; shift int; lv exam_level; e record;
begin
  perform set_config('imyong.seed', '20261118', false);

  -- 초등: 시도별 규모·경쟁 정도
  for r in select * from (values
    (1, 'seoul', 320, 2.2), (2, 'busan', 260, 1.4), (3, 'daegu', 150, 1.5), (4, 'incheon', 420, 1.6),
    (5, 'gwangju', 50, 2.0), (6, 'daejeon', 80, 1.9), (7, 'ulsan', 120, 1.3), (8, 'sejong', 70, 2.3),
    (9, 'gyeonggi', 1500, 1.2), (10, 'gangwon', 320, 0.9), (11, 'chungbuk', 300, 1.0), (12, 'chungnam', 460, 0.9),
    (13, 'jeonbuk', 160, 1.1), (14, 'jeonnam', 360, 0.8), (15, 'gyeongbuk', 460, 0.9), (16, 'gyeongnam', 520, 1.0),
    (17, 'jeju', 100, 1.6)) v(o, code, base, comp) order by o
  loop
    perform pg_temp.add_series('elementary', r.code, null, r.base::float8 * 1.6::float8, r.comp::float8, 58::float8 + r.comp::float8 * 6::float8);
  end loop;

  -- 중등: 과목 × 시도
  for s in select * from (values
    (1, 'korean', 1.0, 9), (2, 'english', 1.0, 8), (3, 'math', 1.1, 7), (4, 'social', 0.4, 13),
    (5, 'history', 0.4, 14), (6, 'biology', 0.4, 11), (7, 'pe', 0.6, 12), (8, 'info', 0.5, 6)) v(o, code, scale, comp) order by o
  loop
    for r in select * from (values
      (1, 'seoul', 1.6), (2, 'busan', 0.9), (3, 'daegu', 0.7), (4, 'incheon', 0.8), (5, 'gwangju', 0.4),
      (6, 'daejeon', 0.4), (7, 'ulsan', 0.3), (8, 'sejong', 0.3), (9, 'gyeonggi', 3.0), (10, 'gangwon', 0.6),
      (11, 'chungbuk', 0.6), (12, 'chungnam', 0.8), (13, 'jeonbuk', 0.6), (14, 'jeonnam', 0.7),
      (15, 'gyeongbuk', 0.8), (16, 'gyeongnam', 1.0), (17, 'jeju', 0.3)) v(o, code, w) order by o
    loop
      base := 18::float8 * s.scale::float8 * r.w::float8 * pg_temp.btw(0.7, 1.3);
      comp := s.comp::float8 * pg_temp.btw(0.7, 1.3);
      cutb := 62::float8 + pg_temp.btw(-4, 8);
      perform pg_temp.add_series('secondary', r.code, s.code, base, comp, cutb);
    end loop;
  end loop;

  -- 일정 (2027학년도만, 시도마다 0~3일 차이, 1차 시험일은 전국 동일)
  foreach lv in array array['elementary', 'secondary']::exam_level[] loop
    for r in select code from regions order by sort loop
      shift := floor(pg_temp.btw(0, 4))::int;
      for e in select * from (values
        (1, 'pre_notice', date '2026-08-07', date '2026-08-07'),
        (2, 'plan', date '2026-09-04', date '2026-09-25'),
        (3, 'receipt_start', date '2026-10-05', date '2026-10-13'),
        (4, 'receipt_end', date '2026-10-09', date '2026-10-19'),
        (5, 'first_exam', date '2026-11-07', date '2026-11-28'),
        (6, 'first_result', date '2026-12-04', date '2026-12-25'),
        (7, 'second_exam', date '2027-01-07', date '2027-01-20'),
        (8, 'final_result', date '2027-01-29', date '2027-02-10')) v(o, ev, d_el, d_sec) order by o
      loop
        insert into exam_schedules (year, level, region, event, date, source_id)
        values (2027, lv, r.code, e.ev::schedule_event,
          (case when lv = 'elementary' then e.d_el else e.d_sec end)
            + case when e.ev in ('first_exam', 'pre_notice') then 0 else shift end,
          'sample');
      end loop;
    end loop;
  end loop;
end $$;

-- 확인: 아래 세 숫자가 3060 / 1530 / 272 이면 성공
select
  (select count(*) from selection_counts) as selection_counts,
  (select count(*) from exam_results) as exam_results,
  (select count(*) from exam_schedules) as exam_schedules;

-- ───── 샘플 지우기 (실제 데이터 넣기 전에 실행) ─────
-- delete from exam_schedules where source_id = 'sample';
-- delete from exam_results where source_id = 'sample';
-- delete from selection_counts where source_id = 'sample';
