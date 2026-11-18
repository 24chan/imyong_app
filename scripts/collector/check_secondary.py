"""중등 검증: 과목별 선발 인원 합 = 교육부 시도별 모집공고 인원 (교과 2024~2027, 특수·보건·영양·사서·상담 2026~2027)"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dump import rows_of  # noqa: E402

MOE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'supabase', 'data', 'sources', 'moe_20260930_secondary_recruit.hwpx')
NAMES = {'서울': 'seoul', '부산': 'busan', '대구': 'daegu', '인천': 'incheon', '광주': 'gwangju', '대전': 'daejeon', '울산': 'ulsan',
         '세종': 'sejong', '경기': 'gyeonggi', '강원': 'gangwon', '충북': 'chungbuk', '충남': 'chungnam', '전북': 'jeonbuk',
         '전남': 'jeonnam', '경북': 'gyeongbuk', '경남': 'gyeongnam', '제주': 'jeju'}
NONSUBJ = {'special', 'health', 'nutrition', 'librarian', 'counsel'}


def moe_totals():
    """{(region, year, 그룹): 모집공고 인원}  그룹 = '교과' 또는 과목코드"""
    out, block = {}, None
    for r in rows_of(MOE):
        j = ' '.join(r)
        if r and r[0] == '시도':
            heads = [c for c in r[2:] if c.strip()]
            block = heads
            continue
        if not block or not r or r[0] not in NAMES:
            continue
        vals = [int(c.replace(',', '')) if re.fullmatch(r'[\d,]+', c) else None for c in r[2:]]
        reg = NAMES[r[0]]
        if block[0].startswith('’27'):  # 교과: 27,26,25,24 각 (사전예고, 모집공고)
            for i, y in enumerate((2027, 2026, 2025, 2024)):
                if 2 * i + 1 < len(vals):
                    out[(reg, y, '교과')] = vals[2 * i + 1]
        else:  # 특수 / 보건·영양 / 사서·전문상담: 과목별 27,26 (사전예고, 모집공고)
            codes = {'특수*': 'special', '특수': 'special', '보건': 'health', '영양': 'nutrition', '사서': 'librarian', '전문상담': 'counsel'}
            subj = [codes.get(h) for h in block if codes.get(h)]
            for si, code in enumerate(subj):
                for yi, y in enumerate((2027, 2026)):
                    k = si * 4 + yi * 2 + 1
                    if k < len(vals):
                        out[(reg, y, code)] = vals[k]
    return out


def check(recs):
    moe = moe_totals()
    sums = {}
    for r in recs:
        if r['category'] == 'all' and any(x['category'] != 'all' for x in recs if (x['region'], x['year'], x['subject']) == (r['region'], r['year'], r['subject'])):
            continue
        g = r['subject'] if r['subject'] in NONSUBJ else '교과'
        k = (r['region'], r['year'], g)
        if r['subject'].startswith('x:') and re.search(r'교과|합|계|공통|전체|소계', r['subject']):
            continue
        a, b = sums.get(k, (0, 0))
        v = r.get('selected') or 0
        # 교육부 표는 시도마다 장애 포함/제외가 달라서 두 합을 모두 계산
        sums[k] = (a + (v if r['category'] != 'disabled' else 0), b + v)
    status = {}
    for (reg, y, g), (v1, v2) in sums.items():
        exp = moe.get((reg, y, g))
        ok = exp is not None and exp in (v1, v2)
        v = v1 if exp == v1 else v2
        status.setdefault((reg, y), []).append((g, v, exp, ok))
    return status


if __name__ == '__main__':
    st = check(json.load(open(sys.argv[1])))
    for k in sorted(st):
        bad = [(g, v, e) for g, v, e, ok in st[k] if not ok]
        print(k, '통과' if not bad else f'불일치 {bad}')
