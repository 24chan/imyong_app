"""사립학교 위탁 채용 표 → raw/private/<지역>.json (앱 '사립 위탁 채용' 화면용)
교육청 공고 안의 '법인명 · 학교명 · 과목 · 인원' 표를 찾아 줄마다 뽑음.
사용: python -I parse_private.py <raw 폴더>
"""
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dump import rows_of  # noqa: E402

ELEM = re.compile(r'^(초등|유치원|특수\s*\((유|유치원|초|초등)\))$')
URL = re.compile(r'https?://\S+|www\.\S+')


def clean(t):
    return re.sub(r'\s+', ' ', (t or '').replace('\n', ' ')).strip()


def school_of(t):
    """'유석초등학교\nhttps://...' → ('유석초등학교', 'https://...')"""
    t = t or ''
    url = (URL.search(t) or [None])[0] if URL.search(t) else None
    name = clean(URL.sub(' ', t))
    return name, url


def header_map(cells):
    if re.search(r'접수|응시|지원\s*(인원|자)|경쟁', ''.join(c or '' for c in cells)):
        return None  # 접수현황 표 (지원자 수)는 채용 인원이 아님
    m = {}
    for i, c in enumerate(cells):
        c = re.sub(r'\s+', '', c or '')
        if '법인' in c and 'corp' not in m:
            m['corp'] = i
        elif '위탁방법' in c or '지원방법' in c:
            m['method'] = i
        elif '학교' in c and 'school' not in m:
            m['school'] = i
        elif re.search(r'과목|분야|교과', c) and 'subj' not in m:
            m['subj'] = i
        elif '인원' in c:
            m['count'] = i
    return m if {'corp', 'subj', 'count'} <= m.keys() else None


def to_int(t):
    m = re.search(r'\d+', (t or '').replace(',', ''))
    return int(m.group()) if m else None


def records_pdf(path):
    import pdfplumber
    out = []
    state = {}
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            words = page.extract_words()
            for tbl in page.find_tables():
                rows = tbl.rows
                def text(c):
                    # 글자 중심이 칸 안에 있는 것만 (작은 칸은 글자가 선 밖으로 살짝 넘침)
                    if not c:
                        return None
                    inside = lambda o: o.get('object_type') != 'char' or (  # noqa: E731
                        c[0] <= (o['x0'] + o['x1']) / 2 <= c[2] and c[1] <= (o['top'] + o['bottom']) / 2 <= c[3])
                    return page.filter(inside).extract_text() or ''
                hm = None
                start = 0
                for i, r in enumerate(rows[:3]):
                    hm = header_map([text(c) for c in r.cells])
                    if hm:
                        start = i + 1
                        hdr = r.cells
                        break
                if not hm:
                    # 앞 쪽에서 이어지는 표 (머리글이 없으면 앞 표의 칸 위치를 씀)
                    if not state.get('hm') or len(rows[0].cells) != len(state['hdr']):
                        continue
                    hm, hdr = state['hm'], state['hdr']
                    hdr = [rows[0].cells[i] or hdr[i] for i in range(len(hdr))]
                state['hm'], state['hdr'] = hm, hdr
                cx = hdr[hm['count']]
                for r in rows[start:]:
                    cells = r.cells
                    if len(cells) != len(hdr):
                        continue
                    corp_t = text(cells[hm['corp']])
                    if corp_t is not None and '합계' in clean(corp_t) + clean(text(cells[0]) or ''):
                        continue
                    if corp_t is not None and clean(corp_t):
                        state['corp'] = clean(corp_t)
                    if 'method' in hm and cells[hm['method']] is not None and clean(text(cells[hm['method']])):
                        state['method'] = clean(text(cells[hm['method']]))
                    if 'school' in hm and cells[hm['school']] is not None and clean(text(cells[hm['school']])):
                        state['school'], state['url'] = school_of(text(cells[hm['school']]))
                    sc = cells[hm['subj']]
                    if sc is None:
                        continue
                    subj = clean(text(sc))
                    if not subj or re.search(r'합계|과목|분야', subj):
                        continue
                    # 인원 칸은 표 선이 없는 경우가 많아, 같은 높이의 숫자를 좌표로 찾음
                    ct = text(cells[hm['count']]) if cells[hm['count']] is not None else None
                    if ct is None or not re.search(r'\d', ct):
                        ct = ' '.join(w['text'] for w in words
                                      if w['x0'] >= cx[0] - 2 and w['x1'] <= cx[2] + 2 and sc[1] - 1 <= (w['top'] + w['bottom']) / 2 <= sc[3] + 1)
                    nums = [int(x) for x in re.findall(r'\d+', ct.replace(',', ''))]
                    toks = subj.split()
                    if len(toks) > 1 and len(nums) == len(toks):
                        # 한 칸에 과목 여러 개가 줄바꿈으로 들어간 표 (제주): 과목마다 인원 짝짓기
                        for t, k in zip(toks, nums):
                            out.append({'corp': state.get('corp'), 'method': state.get('method'), 'school': state.get('school'),
                                        'url': state.get('url'), 'subject': t, 'count': k})
                        continue
                    n = nums[0] if len(nums) == 1 else None
                    out.append({'corp': state.get('corp'), 'method': state.get('method'), 'school': state.get('school'),
                                'url': state.get('url'), 'subject': subj, 'count': n})
    return out


def records_rows(path):
    out = []
    hm = None
    state = {}
    for cells in rows_of(path):
        if cells == ['[/표]']:
            hm = None  # 표가 끝나면 머리글도 끝
            continue
        if not isinstance(cells, list) or len(cells) < 3:
            continue
        h = header_map(cells)
        if h:
            hm, state = h, {}
            continue
        if not hm or len(cells) <= max(hm.values()):
            continue
        if '합계' in ''.join(cells[:3]):
            continue
        if clean(cells[hm['corp']]):
            state['corp'] = clean(cells[hm['corp']])
        if 'method' in hm and clean(cells[hm['method']]):
            state['method'] = clean(cells[hm['method']])
        if 'school' in hm and clean(cells[hm['school']]):
            state['school'], state['url'] = school_of(cells[hm['school']])
        subj = clean(cells[hm['subj']])
        if not subj or re.search(r'합계|과목|분야', subj):
            continue
        nums = [int(x) for x in re.findall(r'\d+', (cells[hm['count']] or '').replace(',', ''))]
        toks = subj.split()
        pairs = list(zip(toks, nums)) if len(toks) > 1 and len(nums) == len(toks) else [(subj, nums[0] if len(nums) == 1 else None)]
        for t, k in pairs:
            out.append({'corp': state.get('corp'), 'method': state.get('method'), 'school': state.get('school'),
                        'url': state.get('url'), 'subject': t, 'count': k})
    return out


BAD = re.compile(r'장애|시험|신청|※|영역|편의|휴대|기준|서류|평가|배점|합계')
TOTAL = re.compile(r'^(소\s*계|계|합\s*계|총\s*계)$')


def norm_subject(t):
    t = clean(t)
    t = re.sub(r'^특수\s*(학교|교사)?\s*\(\s*', '특수(', t)  # 특수학교 (초등), 특수교사(초등) → 특수(초등)
    t = re.sub(r'^특수\((유|유치원)\)', '특수(유)', t)
    t = re.sub(r'^(특수\([^)]*\))\s*교사$', r'\1', t)
    t = re.sub(r'^초등\s*(학교)?\s*(교사)?$', '초등', t)  # 초등학교교사 → 초등
    return re.sub(r'\s*교사$', '', t).strip()


def valid(r):
    """표 머리글이 우연히 맞은 다른 표(장애 유형·시험 과목 등)를 걸러냄"""
    if not (r['corp'] and r['school'] and r['subject'] and r['count']):
        return False
    if not (1 <= r['count'] <= 50) or '학교' not in r['school'] or len(r['school']) > 40:
        return False
    if len(r['subject']) > 20 or re.search(r'\d', r['subject']) or TOTAL.match(r['subject']) \
            or BAD.search(r['subject'] + r['corp'] + r['school']):
        return False
    return 2 <= len(r['corp']) <= 30


def method_label(t):
    k = re.sub(r'[\s·ㆍ‧.]', '', t or '')
    if '동시' in k:
        return '공·사립 동시지원'
    if '복수' in k:
        return '사립 복수지원'
    return clean(t) or None


def main(raw):
    by_region = {}
    for region in sorted(os.listdir(raw)):
        mf = os.path.join(raw, region, 'manifest.json')
        if not os.path.exists(mf):
            continue
        manifest = json.load(open(mf))
        posts = {}
        pj = os.path.join(raw, region, 'posts.json')
        if os.path.exists(pj):
            posts = json.load(open(pj))
        # 같은 학년도에 위탁 전용 공고가 있으면 그것만, 없으면 시행계획·사전예고 안의 사립 표
        docs = [m for m in manifest if m['type'] in ('private', 'plan', 'prelim')]
        found = {}  # (학년도, 공고 학교급) → 가장 좋은 문서 하나 (위탁 전용 공고 > 시행계획 > 사전예고, 같으면 줄 많은 쪽)
        for m in docs:
            path = os.path.join(raw, m['path'])
            if not os.path.exists(path):
                continue
            rank = (m['type'] != 'private', m['type'] != 'plan')
            key = (m['year'], m['level'])
            if key in found and found[key]['rank'] < rank:
                continue
            try:
                ext = path.rsplit('.', 1)[-1].lower()
                recs = records_pdf(path) if ext == 'pdf' else records_rows(path)
            except Exception as e:  # noqa: BLE001
                print('실패', m['path'], type(e).__name__, e)
                continue
            for r in recs:
                r['subject'] = norm_subject(r['subject'] or '')
                r['school'] = clean(r['school'])
                r['corp'] = re.sub(r'\s*\([^)]*\)$', '', clean(r['corp']))  # '천성원 (대전원명학교)' → '천성원'
            recs = [r for r in recs if valid(r)]
            if not recs:
                continue
            if key in found and found[key]['rank'] == rank and len(found[key]['rows']) >= len(recs):
                continue
            found[key] = {'rank': rank, 'rows': recs, 'sources': [{'title': m['title'], 'url': m.get('post_url')}],
                          'posted_at': (posts.get(m.get('post_url')) or {}).get('posted_at')}
            print(f"OK {region} {m['year']} {m['type']} {m['path'].split('/')[-1]} 줄={len(recs)} 인원={sum(r['count'] for r in recs)}")
        merged = {}
        for (year, _), v in sorted(found.items(), key=lambda kv: kv[1]['rank']):
            cur = merged.setdefault(year, {'rank': v['rank'], 'rows': [], 'sources': [], 'posted_at': v['posted_at']})
            if not cur['rank'][0] and v['rank'][0]:
                continue  # 위탁 전용 공고가 있으면 시행계획 표는 쓰지 않음
            cur['rows'] += v['rows']
            cur['sources'] += [x for x in v['sources'] if x not in cur['sources']]
        found = merged
        for year, v in found.items():
            seen = set()
            rows = []
            for r in v['rows']:
                k = (r['corp'], r['school'], r['subject'])
                if k in seen:
                    continue
                seen.add(k)
                rows.append({**r, 'method': method_label(r['method']),
                             'level': 'elementary' if ELEM.match(r['subject'].replace(' ', '')) else 'secondary'})
            by_region.setdefault(region, []).append({'year': year, 'posted_at': v['posted_at'], 'sources': v['sources'], 'rows': rows})
    out = os.path.join(raw, 'private')
    os.makedirs(out, exist_ok=True)
    for region, years in by_region.items():
        years.sort(key=lambda y: -y['year'])
        json.dump(years, open(os.path.join(out, f'{region}.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump({'updated': time.strftime('%Y-%m-%d'),
               'regions': {r: [y['year'] for y in ys] for r, ys in by_region.items()}},
              open(os.path.join(out, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
    print('지역', len(by_region))


if __name__ == '__main__':
    if len(sys.argv) > 2:  # 파일 하나 시험: parse_private.py test <파일>
        p = sys.argv[2]
        recs = records_pdf(p) if p.endswith('.pdf') else records_rows(p)
        for r in recs:
            r['subject'] = norm_subject(r['subject'] or '')
        recs = [r for r in recs if valid(r)]
        for r in recs:
            print(r)
        print(len(recs), sum(r['count'] or 0 for r in recs))
    else:
        main(sys.argv[1] if len(sys.argv) > 1 else 'raw')
