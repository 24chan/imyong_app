"""수집기 3단계: 1차·최종 합격 공고 표 → 지역·연도·구분별 숫자
(선발예정, 지원, 응시, 1차 합격 인원·합격선, 최종 합격 인원·합격선)

사용: python parse_results.py <raw 폴더> [출력.json]
지금은 초등(유치원·특수 제외)만. 중등(과목별)은 다음 단계.
"""
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dump import rows_of  # noqa: E402

SKIP_FILE = re.compile(r'연수|제출\s*서류|서류\s*제출|인력풀|위임장|약도|실기|진행|대기실|경력합산|카드뉴스|목록표|신청서|안내문')
CAT_RE = re.compile(r'일반|장애|지역(?:구분|제한)?')
CAT_NAME = {'일반': 'general', '장애': 'disabled'}
NONE_WORDS = ('-', '', '비공개', '없음', '해당없음', '미공개', '–', '—')


def norm(s):
    return re.sub(r'\s+', '', s or '')


def num(s):
    s = (s or '').strip()
    if norm(s) in NONE_WORDS:
        return None
    m = re.fullmatch(r'([\d,]+(?:\.\d+)?)\s*명?', s)
    if not m:
        return None
    v = m.group(1).replace(',', '')
    return float(v) if '.' in v else int(v)


def metric_of(h, doc_type):
    """표 머리글 → 지표 이름"""
    h = norm(h)
    if not h or re.search(r'분야|구분|과목|교과', h):
        return None
    if '선발' in h or '모집' in h:
        return 'selected' if '인원' in h or '예정' in h or h in ('선발', '모집') else None
    if '지원' in h or '접수' in h:
        return 'applicants'
    if '응시' in h:
        return 'second_takers' if '2차' in h else 'takers'
    first = '1차' in h
    final = '최종' in h or ('2차' in h and '합격' in h)
    if '합격선' in h or ('합격' in h and '점' in h):
        if first or (doc_type == 'first_pass' and not final):
            return 'first_cutoff'
        return 'final_cutoff'
    if '합격' in h and ('인원' in h or '자수' in h or h.endswith('합격') or h.endswith('합격자')):
        if first or (doc_type == 'first_pass' and not final):
            return 'first_passed'
        return 'final_passed'
    return None


def is_elem_field(label):
    t = norm(label)
    if re.search(r'특수|유치원|사립|국립|법인|학원|학교\(|초등학교\(|\(.*학교', t):
        return False
    return '초등' in t


def tables(rows):
    cur = None
    for r in rows:
        if r == ['[표]']:
            cur = []
        elif r == ['[/표]']:
            if cur:
                yield cur
            cur = None
        elif cur is not None:
            cur.append(r)


def parse_table(tbl, doc_type):
    """표 하나 → [(분야라벨, 구분, {지표: 값})]"""
    # 머리글: 지표가 2개 이상 잡히는 첫 행
    hi, metrics = None, None
    for i, r in enumerate(tbl[:3]):
        ms = [metric_of(c, doc_type) for c in r]
        if sum(1 for m in ms if m) >= 2 and any(m and ('passed' in m or 'cutoff' in m) for m in ms):
            hi, metrics = i, ms
            break
    if hi is None:
        return []
    head0 = norm(tbl[hi][0])
    if re.search(r'사립|법인|학교명', head0):
        return []
    # 지표가 있는 머리글 칸을 오른쪽 기준 위치로 (병합 칸 때문에 행마다 칸 수가 달라서)
    nh = len(metrics)
    first_m = next(i for i, m in enumerate(metrics) if m)
    kfull = nh - first_m  # 첫 지표 칸부터 끝까지 칸 수
    out, field = [], ''
    for r in tbl[hi + 1:]:
        if not any(c.strip() for c in r):
            continue
        k = min(kfull, len(r) - 1) if len(r) > 1 else 0  # 오른쪽에서 맞출 칸 수
        vals = r[len(r) - k:] if k else []
        labels = r[:len(r) - k]
        mets = metrics[nh - k:]
        # 분야·구분 라벨
        lab = ' '.join(c for c in labels if c.strip())
        cats_txt = ''
        for c in labels:
            if CAT_RE.search(norm(c)) and len(norm(c)) <= 20:
                cats_txt = c
        name_part = norm(lab)
        if cats_txt:
            name_part = norm(lab.replace(cats_txt, ''))
        if name_part and not CAT_RE.fullmatch(name_part):
            field = name_part
        if re.search(r'합계|총계|계$', field):
            continue
        cats = [m.group(0) for m in CAT_RE.finditer(norm(cats_txt))] or ['전체']
        # 한 칸에 여러 구분이 겹친 경우(경기 PDF: '일반 장애' / '995 82')
        split_vals = [re.split(r'\s+', v.strip()) if v.strip() else [] for v in vals]
        for ci, cat in enumerate(cats):
            rec = {}
            for m, sv in zip(mets, split_vals):
                if not m:
                    continue
                if len(cats) == 1:
                    rec[m] = num(' '.join(sv)) if len(sv) <= 1 or sv[-1] == '명' else num(sv[0])
                else:
                    rec[m] = num(sv[ci]) if ci < len(sv) else None
            ckey = 'regional' if cat.startswith('지역') else CAT_NAME.get(cat, 'all')
            out.append((field, ckey, rec))
    return out


def parse_file(path, doc_type):
    res = []
    for tbl in tables(rows_of(path)):
        res.extend(parse_table(tbl, doc_type))
    if path.endswith('.pdf') and not any(is_elem_field(f) for f, _, _ in res):
        res = parse_layout(path, doc_type)  # 표 선 없는 PDF
    elif path.endswith('.pdf') and any(is_elem_field(f) and not any(k.endswith('cutoff') for k in r) for f, _, r in res):
        # 표 추출에서 합격선 칸이 빠지는 경우(서울) 배치 파서 값으로 보충
        lay = {(f, c): r for f, c, r in parse_layout(path, doc_type)}
        res = [(f, c, {**lay.get((f, c), {}), **{k: v for k, v in r.items() if v is not None}}) for f, c, r in res]
    return res


def main(raw, out_path=None):
    merged = {}
    log = []
    for mf in sorted(glob.glob(os.path.join(raw, '*', 'manifest.json'))):
        for m in json.load(open(mf)):
            if m['type'] not in ('first_pass', 'final_pass') or m['level'] != 'elementary':
                continue
            ext = m['path'].rsplit('.', 1)[-1]
            if ext == 'hwp' and os.path.exists(os.path.join(raw, m['path'] + '.xhtml')):
                ext = 'hwp'  # hwp5html 변환본 사용
            elif ext not in ('pdf', 'hwpx', 'xlsx'):
                continue
            if SKIP_FILE.search(m['file_name']):
                continue
            try:
                recs = parse_file(os.path.join(raw, m['path']), m['type'])
            except Exception as e:  # noqa: BLE001
                log.append(f"ERR {m['path']} {e}")
                continue
            got = 0
            for field, cat, rec in recs:
                if not is_elem_field(field):
                    continue
                if field.startswith('국립') or '국립' in field:
                    continue
                key = (m['region'], m['year'], 'elementary', None, cat)
                cur = merged.setdefault(key, {'sources': []})
                for k, v in rec.items():
                    if v is None:
                        continue
                    if k in cur and cur[k] != v:
                        log.append(f"충돌 {key} {k}: {cur[k]} vs {v} ({m['path']})")
                        continue
                    cur[k] = v
                if m['post_url'] not in cur['sources']:
                    cur['sources'].append(m['post_url'])
                got += 1
            log.append(f"{'OK ' if got else '-- '}{m['region']} {m['year']} {m['type']} {m['path'].split('/')[-1]} rows={got}")
    out = []
    for (region, year, level, subject, cat), v in sorted(merged.items(), key=lambda x: (x[0][0], x[0][1], x[0][4])):
        out.append({'region': region, 'year': year, 'level': level, 'subject': subject, 'category': cat, **v})
    if out_path:
        json.dump(out, open(out_path, 'w'), ensure_ascii=False, indent=1)
    return out, log


# ---- PDF 글자 배치(pdftotext -layout) 기반 보조 파서: 표 선이 없거나 세로 글씨라 표 추출이 안 되는 PDF용 ----
TOKEN = re.compile(r'\S+(?: \S+)*')
NUMTOK = re.compile(r'^(?:[\d,]+(?:\.\d+)?|-|비공개)$')


def layout_text(path):
    import subprocess
    return subprocess.run(['pdftotext', '-layout', path, '-'], capture_output=True, text=True, timeout=60).stdout


def _spans(line):
    return [(m.start(), m.end(), m.group(0)) for m in TOKEN.finditer(line)]


def parse_layout(path, doc_type):
    lines = layout_text(path).splitlines()
    out = []
    i = 0
    while i < len(lines):
        if not re.search(r'선발\s*분야|구\s*분|모집\s*분야|선발예정분야', lines[i]) or '합격' not in ' '.join(lines[i:i + 4]):
            i += 1
            continue
        # 머리글 묶음: 데이터 줄(일반/장애 + 숫자)이 나오기 전까지
        hdr = []
        j = max(0, i - 1)
        while j < len(lines) and not re.search(r'(일\s*반|장\s*애)\s+[\d,-]', lines[j]):
            if lines[j].strip() and not any(len(t) > 20 for _, _, t in _spans(lines[j])):
                hdr.append(lines[j])
            j += 1
            if j - i > 6:
                break
        # 세로로 겹치는 머리글 조각을 한 칸으로
        cols = []
        for ln in hdr:
            for s, e, t in _spans(ln):
                for c in cols:
                    if s <= c['e'] + 1 and e >= c['s'] - 1:
                        c['s'], c['e'] = min(c['s'], s), max(c['e'], e)
                        c['t'] += t
                        break
                else:
                    cols.append({'s': s, 'e': e, 't': t})
        cols = [c for c in cols if metric_of(c['t'], doc_type)]
        for c in cols:
            c['m'] = metric_of(c['t'], doc_type)
        if len(cols) < 2:
            i = j
            continue
        # 데이터 줄
        rows, anchors = [], []
        k = j
        while k < len(lines) and k - j < 40:
            ln = lines[k]
            if re.match(r'\s*(※|\d\s|가\s|나\s|[①-⑳])', ln) and rows:
                break
            sp = _spans(ln)
            left = min(c['s'] for c in cols)
            words = [t for s, e, t in sp if not NUMTOK.match(t) and s < left]  # 비고 칸 글씨는 제외
            cat = next((norm(w) for w in words if re.fullmatch(r'일반|장애|지역\S*|소계|계', norm(w))), None)
            labels = [w for w in words if not re.fullmatch(r'일반|장애|지역\S*|소계|계', norm(w))]
            for w in labels:
                anchors.append((k, norm(w)))
            if cat:
                rec = {}
                for s, e, t in sp:
                    if NUMTOK.match(t):
                        mid = (s + e) / 2
                        c = min(cols, key=lambda c: abs((c['s'] + c['e']) / 2 - mid))
                        if abs((c['s'] + c['e']) / 2 - mid) <= 10:
                            rec[c['m']] = num(t)
                rows.append((k, cat, rec))
            k += 1
        for (ln_no, cat, rec) in rows:
            if cat in ('소계', '계', '합계'):
                continue
            near = sorted(anchors, key=lambda a: (abs(a[0] - ln_no), a[0] < ln_no))
            field = near[0][1] if near else ''
            # 특수학교 묶음: 같은 줄 근처에 '특수' 가 있으면 특수로
            if any('특수' in a[1] for a in anchors if abs(a[0] - ln_no) <= 2) and not re.search(r'^초등', field):
                field = '특수' + field
            if '합계' in field or field == '합':
                continue
            ckey = 'regional' if cat.startswith('지역') else CAT_NAME.get(cat, 'all')
            out.append((field, ckey, rec))
        i = k
    return out


if __name__ == '__main__':
    o, lg = main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    print('\n'.join(lg))
    for r in o:
        print(r['region'], r['year'], r['category'], {k: v for k, v in r.items() if k not in ('region', 'year', 'level', 'subject', 'category', 'sources')})
