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
                    if cells[hm['count']] is not None and to_int(text(cells[hm['count']])) is not None:
                        n = to_int(text(cells[hm['count']]))
                    else:
                        hits = [w['text'] for w in words
                                if w['x0'] >= cx[0] - 2 and w['x1'] <= cx[2] + 2 and sc[1] - 1 <= (w['top'] + w['bottom']) / 2 <= sc[3] + 1]
                        n = to_int(' '.join(hits))
                    out.append({'corp': state.get('corp'), 'method': state.get('method'), 'school': state.get('school'),
                                'url': state.get('url'), 'subject': subj, 'count': n})
    return out


def records_rows(path):
    out = []
    hm = None
    state = {}
    for cells in rows_of(path):
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
        out.append({'corp': state.get('corp'), 'method': state.get('method'), 'school': state.get('school'),
                    'url': state.get('url'), 'subject': subj, 'count': to_int(cells[hm['count']])})
    return out


def method_label(t):
    t = re.sub(r'[\s·ㆍ.]', '', t or '')
    if '동시' in t:
        return '공·사립 동시지원'
    if '복수' in t:
        return '사립 복수지원'
    return t or None


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
        found = {}
        for m in sorted(docs, key=lambda m: (m['type'] != 'private', m['type'] != 'plan')):
            path = os.path.join(raw, m['path'])
            if not os.path.exists(path):
                continue
            key = m['year']
            if key in found and found[key]['rank'] < (m['type'] != 'private', m['type'] != 'plan'):
                continue
            try:
                ext = path.rsplit('.', 1)[-1].lower()
                recs = records_pdf(path) if ext == 'pdf' else records_rows(path)
            except Exception as e:  # noqa: BLE001
                print('실패', m['path'], type(e).__name__, e)
                continue
            recs = [r for r in recs if r['corp'] and r['school'] and r['count']]
            if not recs:
                continue
            rank = (m['type'] != 'private', m['type'] != 'plan')
            if key in found and found[key]['rank'] == rank and found[key]['level'] != m['level']:
                # 초등·중등이 따로 올라온 경우 합침
                found[key]['rows'] += recs
                found[key]['sources'].append({'title': m['title'], 'url': m.get('post_url')})
                continue
            found[key] = {'rank': rank, 'level': m['level'], 'rows': recs,
                          'sources': [{'title': m['title'], 'url': m.get('post_url')}],
                          'posted_at': (posts.get(m.get('post_url')) or {}).get('posted_at')}
            print(f"OK {region} {m['year']} {m['type']} {m['path'].split('/')[-1]} 줄={len(recs)} 인원={sum(r['count'] for r in recs)}")
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
            print(r)
        print(len(recs), sum(r['count'] or 0 for r in recs))
    else:
        main(sys.argv[1] if len(sys.argv) > 1 else 'raw')
