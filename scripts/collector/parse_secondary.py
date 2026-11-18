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
    hdr = [r for r in tbl[max(0, start - 4):start] if not has_num(r) and len(r) > 2]
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
            out.append((code, cat, rec))
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
    merged, log = {}, []
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
                            rr = parse_wide(cur_tbl, m['type'])
                            if re.search(r'장애', ctx) and not any(c != 'all' for _, c, _ in rr):
                                rr = [(a, 'disabled', b) for a, _, b in rr]
                            recs += rr
                    cur_tbl = None
                elif cur_tbl is not None:
                    cur_tbl.append(r)
                elif len(r) == 1 and r[0].strip():
                    ctx = r[0][-60:]  # 표 바로 앞 문단 (예: '[사립]', '나. 장애인 구분모집')
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
            for k, v in rec.items():
                if k in cur and cur[k] != v:
                    log.append(f"충돌 {key} {k}: {cur[k]} vs {v} ({m['path']})")
                    continue
                cur[k] = v
            if m['post_url'] not in cur['sources']:
                cur['sources'].append(m['post_url'])
            got += 1
        log.append(f"{'OK ' if got else '-- '}{m['region']} {m['year']} {m['type']} {m['path'].split('/')[-1]} rows={got}")
    out = [{'region': k[0], 'year': k[1], 'level': k[2], 'subject': k[3], 'category': k[4], **v}
           for k, v in sorted(merged.items(), key=lambda x: (x[0][0], x[0][1], x[0][3], x[0][4]))]
    if out_path:
        json.dump(out, open(out_path, 'w'), ensure_ascii=False, indent=1)
    return out, log


if __name__ == '__main__':
    o, lg = main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    print('\n'.join(x for x in lg if not x.startswith('-- ')))
    print('행', len(o))
