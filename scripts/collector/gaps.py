"""지역·TO 탭 빈칸 보고서: DB의 선발 인원·접수(경쟁률)·합격선을 학년도×지역(중등은 ×과목)으로 세어
무엇이 비었는지 출력 (+ GitHub 요약). 비밀키로 읽기만 함."""
import json, os, urllib.request
from collections import defaultdict

URL = os.environ.get('SUPABASE_URL', 'https://wckaybzamhvmhxiacmnx.supabase.co').rstrip('/')
KEY = os.environ['SUPABASE_SECRET_KEY']
YEARS = [2024, 2025, 2026, 2027]
REG = ['seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon', 'ulsan', 'sejong', 'gyeonggi', 'gangwon', 'chungbuk', 'chungnam',
       'jeonbuk', 'jeonnam', 'gyeongbuk', 'gyeongnam', 'jeju']


def get(path):
    out, off = [], 0
    while True:
        req = urllib.request.Request(f'{URL}/rest/v1/{path}&limit=1000&offset={off}', headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}'})
        rows = json.loads(urllib.request.urlopen(req, timeout=60).read())
        out += rows
        if len(rows) < 1000:
            return out
        off += 1000


sel = get('selection_counts?select=year,level,region,subject,stage,total,source_id')
res = get('exam_results?select=year,level,region,subject,category,applicants,first_cutoff,final_cutoff,first_passed,final_passed,source_id')
subs = get('subjects?select=code,name')
print('행 수: 선발', len(sel), '결과', len(res))

S = defaultdict(dict)  # (level,year,region,subject) -> {pre, conf}
for r in sel:
    if (r.get('source_id') or '').startswith('sample'):
        continue
    S[(r['level'], r['year'], r['region'], r['subject'])][r['stage']] = r['total']
R = defaultdict(dict)
for r in res:
    if (r.get('source_id') or '').startswith('sample'):
        continue
    d = R[(r['level'], r['year'], r['region'], r['subject'])]
    for c in ('applicants', 'first_cutoff', 'final_cutoff', 'first_passed', 'final_passed'):
        if r.get(c) is not None:
            d[c] = True
lines = []


def p(s=''):
    print(s)
    lines.append(s)


FIELDS = [('선발(확정)', lambda s, r: 'confirmed' in s), ('선발(예고)', lambda s, r: 'preliminary' in s), ('접수/경쟁률', lambda s, r: r.get('applicants')),
          ('1차 합격선', lambda s, r: r.get('first_cutoff')), ('최종 합격선', lambda s, r: r.get('final_cutoff'))]

p('## 초등 빈칸 (지역 이름 = 빈 곳)')
for y in YEARS:
    p(f'### {y}학년도')
    for name, ok in FIELDS:
        miss = [g for g in REG if not ok(S.get(('elementary', y, g, None), {}), R.get(('elementary', y, g, None), {}))]
        p(f'- {name}: ' + ('✅ 전부 있음' if not miss else f'{len(miss)}곳 빔 — ' + ', '.join(miss)))

p('\n## 중등 빈칸 (지역×과목 칸 수, 자료가 하나라도 있는 과목만)')
sub_codes = sorted({k[3] for k in list(S) + list(R) if k[0] == 'secondary' and k[3]})
p(f'과목 수(자료 있음): {len(sub_codes)} / 전체 {len(subs)}')
for y in YEARS:
    p(f'### {y}학년도')
    cells = [(g, sc) for g in REG for sc in sub_codes]
    # 그 해 그 지역에서 선발이 있는(확정 또는 예고) 칸만 분모로
    exist = [(g, sc) for g, sc in cells if S.get(('secondary', y, g, sc))]
    p(f'- 선발 자료 있는 칸: {len(exist)}')
    for name, ok in FIELDS[2:]:
        miss = [(g, sc) for g, sc in exist if not ok(S.get(('secondary', y, g, sc), {}), R.get(('secondary', y, g, sc), {}))]
        by = defaultdict(int)
        for g, _ in miss:
            by[g] += 1
        p(f'- {name}: {len(exist) - len(miss)}/{len(exist)} 채움' + (f' — 지역별 빈칸 ' + ', '.join(f'{g} {n}' for g, n in sorted(by.items(), key=lambda t: -t[1])) if miss else ''))
    regs_with = sorted({g for g, sc in exist})
    p(f'- 선발 자료가 아예 없는 지역: ' + (', '.join(g for g in REG if g not in regs_with) or '없음'))
    conf = sum(1 for g, sc in exist if 'confirmed' in S[('secondary', y, g, sc)])
    p(f'- 확정 인원 있는 칸 {conf} / 예고만 있는 칸 {len(exist) - conf}')

if os.environ.get('GITHUB_STEP_SUMMARY'):
    open(os.environ['GITHUB_STEP_SUMMARY'], 'a').write('\n'.join(lines))

# 승인 대기 자료 (approve_ingest_all 로 들어갈 것)
q = get('ingest_queue?select=status,parsed,source_url,file_url')
st = defaultdict(int)
for r in q:
    st[r.get('status')] += 1
print('\n## 수집 대기열 상태', dict(st))
pend = [r for r in q if r.get('status') in ('pending', 'parsed', 'new', 'review')]
for r in pend[:60]:
    pr = r.get('parsed') or {}
    if isinstance(pr, str):
        try:
            pr = json.loads(pr)
        except Exception:  # noqa: BLE001
            pr = {}
    recs = pr.get('records') if isinstance(pr, dict) else pr
    recs = recs if isinstance(recs, list) else []
    keys = sorted({(x.get('level'), x.get('year'), x.get('region')) for x in recs if isinstance(x, dict)})[:6]
    print('-', r.get('status'), len(recs), '행', keys, (r.get('file_url') or r.get('source_url') or '')[-60:])
