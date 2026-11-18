"""교육부 보도참고자료(2026.9.9) '초등(교과)' 표 → SQL
사용: python3 scripts/moe_elementary_to_sql.py supabase/data/sources/moe_20260909_elementary_recruit.hwpx > supabase/data/0004_moe_elementary_2024_2027.sql
표 모양: 시도 | '27 사전예고 | '27 모집공고 | '26 사전 | '26 모집 | '25 사전 | '25 모집 | '24 사전 | '24 모집
"""
import sys
import xml.etree.ElementTree as ET
import zipfile

REGION = {
    '서울': 'seoul', '부산': 'busan', '대구': 'daegu', '인천': 'incheon', '광주': 'gwangju',
    '대전': 'daejeon', '울산': 'ulsan', '세종': 'sejong', '경기': 'gyeonggi', '강원': 'gangwon',
    '충북': 'chungbuk', '충남': 'chungnam', '전북': 'jeonbuk', '전남': 'jeonnam', '경북': 'gyeongbuk',
    '경남': 'gyeongnam', '제주': 'jeju',
}
YEARS = [2027, 2026, 2025, 2024]


def local(t):
    return t.split('}')[-1]


def cell_text(tc):
    return ''.join(t.text or '' for t in tc.iter() if local(t.tag) == 't').strip()


def tables(path):
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read('Contents/section0.xml'))
    for tbl in root.iter():
        if local(tbl.tag) != 'tbl':
            continue
        rows = []
        for tr in tbl.iter():
            if local(tr.tag) == 'tr':
                rows.append([cell_text(tc) for tc in tr if local(tc.tag) == 'tc'])
        yield rows


def num(s):
    return int(s.replace(',', ''))


def main(path):
    target = None
    for rows in tables(path):
        flat = ' '.join(' '.join(r) for r in rows[:3])
        if '전국' in flat and "’24학년도" in flat and any(r and r[0] == '서울' for r in rows):
            target = rows
            break  # 첫 번째 표 = 초등(교과)
    if target is None:
        sys.exit('초등 표를 찾지 못함')

    data = {}  # region -> list of 8 numbers
    national = None
    for r in target:
        if not r:
            continue
        if r[0] == '전국':
            national = [num(x) for x in r[1:9]]
        elif r[0] in REGION:
            data[REGION[r[0]]] = [num(x) for x in r[1:9]]
        elif r[0] == '전남광주' and len(r) >= 10 and r[1] in REGION:
            data[REGION[r[1]]] = [num(x) for x in r[2:10]]
    if len(data) != 17:
        sys.exit(f'시도 수가 17이 아님: {len(data)}')

    # 검증: 시도 합계 = 전국
    for i in range(8):
        s = sum(v[i] for v in data.values())
        if s != national[i]:
            sys.exit(f'합계 불일치 col{i}: {s} != {national[i]}')

    out = []
    out.append('-- 실제 데이터: 초등 2024~2027학년도 시도별 선발 인원 (사전예고 / 모집공고=확정)')
    out.append('-- 출처: 교육부 보도참고자료 「2027학년도 공립 유치원·초등·특수(유치원·초등)교사 임용후보자 선정경쟁시험 모집공고 현황」 (2026.9.9)')
    out.append('-- 원본 파일: supabase/data/sources/moe_20260909_elementary_recruit.hwpx, 생성: scripts/moe_elementary_to_sql.py')
    out.append(f'-- 검증: 학년도·단계별 17개 시도 합계 = 전국 합계 (2027 확정 {national[1]}, 2026 {national[3]}, 2025 {national[5]}, 2024 {national[7]})')
    out.append('-- 0003 실행 후 SQL Editor에서 한 번 Run')
    out.append('')
    out.append('begin;')
    out.append('')
    out.append("-- 초등 샘플 지우기 (중등 샘플은 유지)")
    out.append("delete from exam_schedules where source_id = 'sample' and level = 'elementary';")
    out.append("delete from exam_results where source_id = 'sample' and level = 'elementary';")
    out.append("delete from selection_counts where source_id = 'sample' and level = 'elementary';")
    out.append('')
    out.append('insert into sources (id, title, publisher, url) values')
    out.append("  ('moe-20260909-elem', '2027학년도 공립 유치원·초등·특수(유치원·초등)교사 임용시험 모집공고 현황 (보도참고자료, 2026.9.9)', '교육부', null),")
    out.append("  ('goe-20260909-plan', '2027학년도 경기도 유치원·초등학교·특수학교(유치원·초등)교사 임용후보자 선정경쟁시험 시행계획 공고 (제2026-386호)', '경기도교육청', 'https://www.goe.go.kr/resource/goe/na/bbs_2583/2026/09/31e2613b-70c6-46ac-9ea3-e261b4353116.pdf')")
    out.append('on conflict (id) do update set title = excluded.title, publisher = excluded.publisher, url = excluded.url;')
    out.append('')
    out.append('insert into selection_counts (year, level, region, subject, stage, general, disabled, regional, total, source_id, base_date) values')
    vals = []
    for code, v in data.items():
        for yi, y in enumerate(YEARS):
            pre, conf = v[yi * 2], v[yi * 2 + 1]
            vals.append(f"  ({y}, 'elementary', '{code}', null, 'preliminary', null, null, null, {pre}, 'moe-20260909-elem', '2026-09-09')")
            vals.append(f"  ({y}, 'elementary', '{code}', null, 'confirmed', null, null, null, {conf}, 'moe-20260909-elem', '2026-09-09')")
    out.append(',\n'.join(vals) + ';')
    out.append('')
    out.append('-- 경기 2027 확정: 공고 원문의 일반/장애/지역 (일반 815, 장애 68, 지역 구분모집 없음)')
    out.append("update selection_counts set general = 815, disabled = 68, regional = 0, source_id = 'goe-20260909-plan'")
    out.append("  where year = 2027 and level = 'elementary' and region = 'gyeonggi' and stage = 'confirmed' and total = 883;")
    out.append('')
    out.append('-- 2027 일정: 사전예고 8/5, 시행계획(모집공고) 9/9 = 교육부 / 나머지는 수집기가 교육청 공고에서 채움')
    out.append("insert into exam_schedules (year, level, region, event, date, source_id)")
    out.append("select 2027, 'elementary', r.code, e.ev::schedule_event, e.d, 'moe-20260909-elem'")
    out.append("from regions r cross join (values ('plan', date '2026-09-09')) as e(ev, d)")
    out.append("on conflict (year, level, region, event) do nothing;")
    out.append('')
    out.append('commit;')
    out.append('')
    out.append("select count(*) as 초등_선발인원_행수, sum(total) filter (where year = 2027 and stage = 'confirmed') as 확정2027_합계")
    out.append("from selection_counts where level = 'elementary';")
    print('\n'.join(out))


if __name__ == '__main__':
    main(sys.argv[1])
