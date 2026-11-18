"""중등(과목별) 공고 표 → 지역·연도·과목·구분별 숫자
표 모양: 과목이 행, (선발/지원/1차 합격/최종 합격/합격선) × (일반/장애/계)가 2단 머리글 열.
사용: python parse_secondary.py <raw 폴더> [출력.json]
"""
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dump import rows_of  # noqa: E402
from parse_results import SKIP_FILE, num, norm, tables  # noqa: E402

SUBJECTS = {
    'korean': r'국어', 'english': r'영어', 'math': r'수학', 'social': r'일반사회|공통사회', 'history': r'역사',
    'geography': r'지리', 'ethics': r'도덕[·ㆍ・‧.]?윤리|윤리', 'physics': r'물리', 'chemistry': r'화학',
    'biology': r'생물', 'earth': r'지구과학', 'pe': r'체육', 'music': r'음악', 'art': r'미술',
    'tech': r'기술', 'homeec': r'가정', 'info': r'정보[·ㆍ・‧.]?컴퓨터', 'hanmun': r'한문',
    'japanese': r'일본어', 'chinese': r'중국어', 'health': r'보건', 'counsel': r'전문상담|상담',
    'librarian': r'사서', 'nutrition': r'영양', 'special': r'특수(\(중등\)|학교\(중등\)|교사\(중등\))?',
}
_SUBJ = [(code, re.compile(rf'^(?:{rx})(?:교사)?$')) for code, rx in SUBJECTS.items()]


def subject_code(label, allow_other=False):
    t = re.sub(r'[\s\d.]+', '', label or '')  # 연번·공백 제거
    t = re.sub(r'^\d+', '', t)
    if re.search(r'\(초\w*\)$', t):
        return None  # 보건(초등) 등은 초등 몫
    t = re.sub(r'\((중|중등)\)$', '', t)
    if t.startswith('특수') and '중' in t:
        t = '특수(중등)'
    if not t or re.search(r'계|합계|소계|총계', t):
        return None
    for code, rx in _SUBJ:
        if rx.match(t):
            return code
    # 앱 과목 목록에 없는 과목(기계·상업 등): 합계 검증에만 씀
    if allow_other and re.fullmatch(r'[가-힣·ㆍ・‧()]{1,10}', t) and not re.search(r'학교|학원|법인|재단|교육|교과|^합$|합|계$|공통|전체|소계|선발|인원|구분', t):
        return 'x:' + t
    return None


def col_metric(t, doc_type):
    t = norm(t)
    if not t or re.search(r'율|경쟁|비고|증감|남\)|여\)|공립만|사립만|동시|순위|과목|분야|구분|연번|교과', t):
        return None
    first = '1차' in t or '제1차' in t
    final = '최종' in t or '2차' in t
    if '합격선' in t or '커트' in t:
        if first or (doc_type == 'first_pass' and not final):
            return 'first_cutoff'
        return 'final_cutoff'
    if '합격' in t or (final and '선발' in t and '예정' not in t):
        if first or (doc_type == 'first_pass' and not final):
            return 'first_passed'
        return 'final_passed'
    if '지원' in t or '접수' in t:
        return 'applicants'
    if '응시' in t:
        return 'second_takers' if '2차' in t else 'takers'
    if '선발' in t or '모집' in t or '예정' in t:
        return 'selected'
    return None


def col_cat(t):
    t = norm(t)
    if re.search(r'일반', t):
        return 'general'
    if re.search(r'장애', t):
        return 'disabled'
    if re.search(r'지역', t):
        return 'regional'
    if re.search(r'(^|[^가-힣])계$|합계|소계|^계', t):
        return 'total'
    return 'all'


def has_num(r):
    return any(num(c) is not None for c in r)


def parse_wide(tbl, doc_type):
    """[(과목코드, 구분, {지표: 값})]"""
    start = None
    for i, r in enumerate(tbl):
        lab = next((c for c in r[:3] if c.strip() and num(c) is None), '')
        if subject_code(lab) and has_num(r):
            start = i
            break
    if start is None:
        return []
    # 머리글 줄: 숫자 없고 글자가 2칸 이상 (제목 한 줄짜리는 제외 — 제목이 모든 칸에 번지지 않게)
    hdr = [r for r in tbl[max(0, start - 4):start] if not has_num(r) and sum(1 for c in r if c.strip()) >= 2]
    if not hdr:
        return []
    width = max(len(r) for r in tbl[start:start + 5] + hdr)
    filled = []
    for hi, r in enumerate(hdr):
        r = list(r) + [''] * (width - len(r))
        if hi < len(hdr) - 1:  # 위쪽 머리글은 병합 칸을 오른쪽으로 채움
            last = ''
            for j in range(width):
                if r[j].strip():
                    last = r[j]
                elif j > 0:
                    r[j] = last
        filled.append(r)
    texts = [' '.join(f[j] for f in filled) for j in range(width)]
    cols = [(j, col_metric(t, doc_type), col_cat(t)) for j, t in enumerate(texts)]
    cols = [c for c in cols if c[1]]
    if not cols:
        return []
    out = []
    first_metric_col = min(c[0] for c in cols)
    known = sum(1 for r in tbl[start:] if subject_code(' '.join(c for c in r[:first_metric_col] if c.strip()).split(' ')[-1]))
    for r in tbl[start:]:
        r = list(r) + [''] * (width - len(r))
        lab = ' '.join(c for c in r[:first_metric_col] if c.strip())
        last = lab.split(' ')[-1] if lab else ''
        dis_row = bool(re.search(r'\(장애[^)]*\)', lab))
        if dis_row:
            last = re.sub(r'\(장애[^)]*\)', '', last)
            lab = re.sub(r'\(장애[^)]*\)', '', lab)
        code = subject_code(last) or subject_code(lab) or (subject_code(last, allow_other=True) if known >= 5 and has_num(r) else None)
        if not code:
            continue
        recs = {}
        for j, m, cat in cols:
            v = num(r[j])
            if v is None:
                continue
            recs.setdefault(cat, {})[m] = v
        cats = set(recs)
        if cats & {'general', 'disabled', 'regional'}:
            recs.pop('total', None)
            recs.pop('all', None)
        elif 'total' in recs:
            recs['all'] = {**recs.pop('total'), **recs.get('all', {})}
        for cat, rec in recs.items():
            out.append((code, 'disabled' if dis_row and cat in ('all', 'general') else cat, rec))
    return out


def split_side_by_side(tbl):
    """'연번|과목|일반|장애|소계 | 연번|과목|일반|장애|소계' 처럼 좌우로 두 번 반복된 표를 둘로 나눔"""
    for r in tbl[:4]:
        idx = [j for j, c in enumerate(r) if re.search(r'과\s*목', c)]
        if len(idx) >= 2:
            starts = []
            for j in idx:
                k = j - 1 if j > 0 and re.search(r'연\s*번|순', r[j - 1]) else j
                starts.append(k)
            bounds = starts + [max(len(x) for x in tbl)]
            return [[row[a:b] for row in tbl] for a, b in zip(bounds, bounds[1:])]
    return [tbl]


TOK = re.compile(r'\S+(?: \S+)*')
VAL = re.compile(r'^(?:[\d,]+(?:\.\d+)?|-|비공개|없음)$')


def parse_layout_wide(path, doc_type):
    """표 선이 안 잡히는 PDF(경기 등): 글자 배치로 과목 행 × (지표·구분) 열 읽기"""
    import subprocess
    text = subprocess.run(['pdftotext', '-layout', path, '-'], capture_output=True, text=True, timeout=60).stdout
    lines = text.splitlines()
    out, ctx = [], ''
    i = 0
    while i < len(lines):
        ln = lines[i]
        subs = [(m.start(), m.group(0)) for m in re.finditer(r'\S+', ln)]
        cats = [t for _, t in subs if re.fullmatch(r'일반|장애|합계|계|소계|지역', t)]
        if len(cats) < 4 or len(cats) < len(subs) - 2:
            if ln.strip() and len(ln.strip()) < 40:
                ctx = ln.strip()
            i += 1
            continue
        sub_toks = [(x, t) for x, t in subs if re.fullmatch(r'일반|장애|합계|계|소계|지역', t)]
        # 위 1~3줄에서 지표 머리글 찾기
        groups = []
        for back in range(1, 4):
            if i - back < 0:
                break
            g = [(m.start(), m.group(0)) for m in TOK.finditer(lines[i - back])]
            g = [(x, t) for x, t in g if col_metric(t, doc_type)]
            if len(g) >= 2:
                groups = g
                break
        if not groups:
            i += 1
            continue
        # 구분 칸을 '일반'에서 시작하는 묶음으로 나누고, 묶음 가운데와 가장 가까운 지표 머리글에 붙임 (머리글이 가운데 정렬이라)
        runs = []
        for x, t in sub_toks:
            if t == '일반' or not runs:
                runs.append([])
            runs[-1].append((x, t))
        cols = []
        for run in runs:
            cx = sum(x for x, _ in run) / len(run)
            g = min(groups, key=lambda gg: abs(gg[0] + len(gg[1]) / 2 - cx))
            for _, t in run:
                cols.append((col_metric(g[1], doc_type), col_cat(t)))
        skip = bool(re.search(r'사립|국립|위탁', ctx))
        j = i + 1
        while j < len(lines) and j - i < 60:
            toks = [m.group(0) for m in re.finditer(r'\S+', lines[j])]
            if not toks:
                j += 1
                continue
            toks = [x for tk in toks for x in tk.split(' ')] if False else toks
            k = 0
            while k < len(toks) and not VAL.match(toks[k]):
                k += 1
            label, vals = ' '.join(toks[:k]), toks[k:]
            if re.search(r'사립|국립|위탁', label):
                skip = True
            if k == 0 or not vals:
                if re.match(r'^\s*\d+\s', lines[j]) or re.search(r'공립|사립|국립', lines[j]):
                    skip = bool(re.search(r'사립|국립|위탁', lines[j]))
                j += 1
                if len(toks) > 6 and not k:
                    break
                continue
            code = subject_code(label.split(' ')[-1]) or subject_code(label)
            if code and not skip and len(vals) == len(cols):
                recs = {}
                for (m, c), v in zip(cols, vals):
                    nv = num(v)
                    if m and nv is not None:
                        recs.setdefault(c, {})[m] = nv
                if recs.keys() & {'general', 'disabled'}:
                    recs.pop('total', None)
                    recs.pop('all', None)
                for c, rec in recs.items():
                    out.append((code, 'all' if c == 'total' else c, rec))
            j += 1
        i = j
    return out


def doc_rank(m):
    t = m['title'] + ' ' + m['file_name']
    if m['type'] in ('first_pass', 'final_pass'):
        return 0
    if m['type'] == 'plan':
        return 1
    if m['type'] == 'receipt':
        if re.search(r'최종|마감|결과', t):
            return 2
        return 9
    if m['type'] == 'attend':
        return 3
    return 9


def main(raw, out_path=None):
    docs = []
    for mf in sorted(glob.glob(os.path.join(raw, '*', 'manifest.json'))):
        docs += [m for m in json.load(open(mf)) if m['level'] == 'secondary']
    docs.sort(key=doc_rank)
    merged, log, agreements = {}, [], {}
    for m in docs:
        if doc_rank(m) >= 9:
            continue
        ext = m['path'].rsplit('.', 1)[-1]
        path = os.path.join(raw, m['path'])
        if ext == 'hwp' and not os.path.exists(path + '.xhtml'):
            continue
        if ext not in ('pdf', 'hwpx', 'xlsx', 'xls', 'hwp'):
            continue
        if SKIP_FILE.search(m['file_name']) or re.search(r'사립|위탁', m['file_name']):
            continue
        try:
            recs = []
            ctx = ''
            cur_tbl = None
            for r in rows_of(path):
                if r == ['[표]']:
                    cur_tbl = []
                elif r == ['[/표]']:
                    if cur_tbl is not None:
                        head = ' '.join(' '.join(x) for x in cur_tbl[:2])
                        if not re.search(r'사립|국립|위탁|법인', ctx + ' ' + head):
                            rr = [x for part in split_side_by_side(cur_tbl) for x in parse_wide(part, m['type'])]
                            if re.search(r'장애', ctx) and not any(c != 'all' for _, c, _ in rr):
                                rr = [(a, 'disabled', b) for a, _, b in rr]
                            recs += rr
                    cur_tbl = None
                elif cur_tbl is not None:
                    cur_tbl.append(r)
                elif len(r) == 1 and r[0].strip():
                    ctx = r[0][-60:]  # 표 바로 앞 문단 (예: '[사립]', '나. 장애인 구분모집')
            if path.endswith('.pdf') and len({c for c, _, _ in recs if not c.startswith('x:')}) < 5:
                recs = parse_layout_wide(path, m['type'])
        except Exception as e:  # noqa: BLE001
            log.append(f"ERR {m['path']} {e}")
            continue
        got = 0
        seen_in_doc = set()
        for code, cat, rec in recs:
            if (code, cat) in seen_in_doc:
                continue  # 한 문서 안에서는 먼저 나온 표(공립 본표)만
            seen_in_doc.add((code, cat))
            if cat == 'all' and m['type'] == 'receipt' and '장애' in m['title'] + m['file_name']:
                cat = 'disabled'
            key = (m['region'], m['year'], 'secondary', code, cat)
            cur = merged.setdefault(key, {'sources': []})
            agree = agreements.setdefault(key, {'docs': set(), 'conflict': False})
            for k, v in rec.items():
                if k in cur and cur[k] != v:
                    log.append(f"충돌 {key} {k}: {cur[k]} vs {v} ({m['path']})")
                    if k == 'selected':
                        agree['conflict'] = True
                    continue
                cur[k] = v
                if k == 'selected':
                    agree['docs'].add(m['post_url'])  # 같은 선발 인원을 준 서로 다른 공고
            if m['post_url'] not in cur['sources']:
                cur['sources'].append(m['post_url'])
            got += 1
        log.append(f"{'OK ' if got else '-- '}{m['region']} {m['year']} {m['type']} {m['path'].split('/')[-1]} rows={got}")
    has_cat = {k[:4] for k in merged if k[4] in ('general', 'disabled', 'regional')}
    for k, v in merged.items():
        a = agreements.get(k, {'docs': set(), 'conflict': False})
        v['agree'] = len(a['docs'])
        v['conflict'] = a['conflict']
    out = [{'region': k[0], 'year': k[1], 'level': k[2], 'subject': k[3], 'category': k[4], **v}
           for k, v in sorted(merged.items(), key=lambda x: (x[0][0], x[0][1], x[0][3], x[0][4]))
           if not (k[4] == 'all' and k[:4] in has_cat)
           and not (k[3].startswith('x:') and re.search(r'교과|합|계|공통|전체|소계|선발|인원|구분', k[3]))]
    if out_path:
        json.dump(out, open(out_path, 'w'), ensure_ascii=False, indent=1)
    return out, log


if __name__ == '__main__':
    o, lg = main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    print('\n'.join(x for x in lg if not x.startswith('-- ')))
    print('행', len(o))
