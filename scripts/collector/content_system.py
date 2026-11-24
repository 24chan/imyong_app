"""내용 체계표(내체표) 모아보기 + 개념 구조도 (2026-11-24 사용자 요청)
NCIC 교육과정 고시문(한글 파일)의 '내용 체계' 표를 표 구조 그대로 뽑아 JSON으로.
고시문은 저작권 보호 대상이 아님(저작권법 제7조).
사용:
  python content_system.py <raw 폴더> <out 폴더> probe   → 국어·수학 한글 파일을 xhtml로 바꿔 out/debug 에 (표 모양 확인용)
  python content_system.py <raw 폴더> <out 폴더>         → out/content_system_elementary.json
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
from html.parser import HTMLParser

UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36'


def download(url, path):
    for i in range(3):
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=120).read()
            if data[:4] != b'\xd0\xcf\x11\xe0':
                print('한글 파일 아님', url, data[:20])
                return False
            open(path, 'wb').write(data)
            time.sleep(0.8)
            return True
        except Exception as e:  # noqa: BLE001
            print('받기 실패', i, url, e)
            time.sleep(3 * (i + 1))
    return False


def to_xhtml(hwp, outdir):
    os.makedirs(outdir, exist_ok=True)
    subprocess.run(['hwp5html', '--output', outdir, hwp], check=True, timeout=600, capture_output=True)
    for f in os.listdir(outdir):
        if f.endswith('.xhtml') or f.endswith('.html'):
            return os.path.join(outdir, f)
    raise RuntimeError('xhtml 없음')


class Doc(HTMLParser):
    """xhtml → 차례대로 [('p', 글) | ('table', [[{t, rs, cs}]])] (표 안 표는 글로 합침)"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items = []
        self.depth = 0
        self.rows = None
        self.cell = None
        self.buf = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'table':
            self.depth += 1
            if self.depth == 1:
                self.flush()
                self.rows = []
        elif self.depth == 1 and tag == 'tr':
            self.rows.append([])
        elif self.depth == 1 and tag in ('td', 'th'):
            self.cell = {'t': [], 'rs': int(a.get('rowspan', 1) or 1), 'cs': int(a.get('colspan', 1) or 1)}
        elif tag in ('p', 'br') and self.cell is not None:
            self.cell['t'].append('\n')
        elif tag == 'p' and self.depth == 0:
            self.flush()

    def handle_endtag(self, tag):
        if tag == 'table':
            if self.depth == 1 and self.rows is not None:
                self.items.append(('table', [[{'t': clean(''.join(c['t'])), 'rs': c['rs'], 'cs': c['cs']} for c in r] for r in self.rows if r]))
                self.rows = None
            self.depth -= 1
        elif self.depth == 1 and tag in ('td', 'th') and self.cell is not None:
            self.rows[-1].append(self.cell)
            self.cell = None
        elif tag == 'p' and self.depth == 0:
            self.flush()

    def handle_data(self, d):
        if self.cell is not None:
            self.cell['t'].append(d)
        elif self.depth == 0:
            self.buf.append(d)

    def flush(self):
        t = clean(''.join(self.buf))
        if t:
            self.items.append(('p', t))
        self.buf = []


def clean(t):
    t = re.sub(r'[ \t ]+', ' ', t)
    t = re.sub(r'\s*\n\s*', '\n', t)
    return t.strip()


def grid(rows):
    """rowspan/colspan 펼친 격자: g[r][c] = (글, 원래 칸 번호)"""
    g, occ, cid = [], {}, 0
    for r, row in enumerate(rows):
        g.append([])
        c = 0
        for cell in row:
            while (r, c) in occ:
                c += 1
            for dr in range(cell['rs']):
                for dc in range(cell['cs']):
                    occ[(r + dr, c + dc)] = (cell['t'], cid)
            c += cell['cs']
            cid += 1
    nrow = max((k[0] for k in occ), default=-1) + 1
    ncol = max((k[1] for k in occ), default=-1) + 1
    return [[occ.get((r, c), ('', -1)) for c in range(ncol)] for r in range(nrow)]


GRADE_RE = re.compile(r'(\d)\s*[~∼～-]\s*(\d)\s*학년')
BULLET = '⋅·•ㆍ∙-–▪ '


def dot(t):
    return t.replace('⋅', '·').replace('ㆍ', '·').replace('∙', '·')


def norm(t):
    """칸 이름: 줄바꿈은 '·' 뒤면 붙이고 아니면 띄움 ('지식·\\n이해' → '지식·이해', '듣기·말하기\\n맥락' → '듣기·말하기 맥락')"""
    t = dot(t or '').strip()
    return re.sub(r'\s+', ' ', re.sub(r'·\s*\n\s*', '·', t)).strip()


def items_of(t):
    return [dot(x.strip().lstrip(BULLET).strip()) for x in (t or '').split('\n') if x.strip().lstrip(BULLET).strip()]


def parse_cs_table(rows):
    """2022 내용 체계 표 하나 → {ideas, grades, rows:[{cat, sub, cells:[{items, span}]}]} (초등 학년군만, 못 읽으면 None)"""
    g = grid(rows)
    if len(g) < 4:
        return None
    idea_r = next((r for r, row in enumerate(g) if row and row[0][0].replace(' ', '').startswith('핵심아이디어')), None)
    hr = next((r for r, row in enumerate(g) if sum(1 for t, _ in row if GRADE_RE.search(t or '')) >= 1 and any('학년' in (t or '') for t, _ in row)), None)
    if idea_r is None or hr is None:
        return None
    ideas = []
    seen = {g[idea_r][0][1]}
    for t, cid in g[idea_r][1:]:
        if cid in seen or not t:
            continue
        seen.add(cid)
        ideas.extend(items_of(t))
    school = g[hr - 1] if hr > 0 else []
    cols = []
    for c, (t, cid) in enumerate(g[hr]):
        m = GRADE_RE.search(t or '')
        if not m:
            continue
        sch = school[c][0] if c < len(school) else ''
        if sch and ('중학교' in sch or '고등학교' in sch):
            continue
        a, b = int(m.group(1)), int(m.group(2))
        if b > 6:
            continue
        lab = f'{a}~{b}'
        if lab not in [x[1] for x in cols]:
            cols.append((c, lab))
    if not cols:
        return None
    out_rows = []
    for r in range(hr + 1, len(g)):
        row = g[r]
        cat = norm(row[0][0])
        sub = norm(row[1][0]) if len(row) > 1 and row[1][1] != row[0][1] and row[1][1] not in [row[c][1] for c, _ in cols] else ''
        cells = []
        prev = None
        for c, _ in cols:
            t, cid = row[c] if c < len(row) else ('', -1)
            if prev is not None and cid == prev and cid != -1:
                cells[-1]['span'] += 1
                continue
            cells.append({'items': items_of(t), 'span': 1})
            prev = cid
        if not cat and not sub and not any(x['items'] for x in cells):
            continue
        out_rows.append({'cat': cat, 'sub': sub, 'cells': cells})
    # 범주 칸이 비면 위 범주 이어받기
    last = ''
    for x in out_rows:
        if x['cat']:
            last = x['cat']
        else:
            x['cat'] = last
    return {'ideas': ideas, 'grades': [lab for _, lab in cols], 'rows': out_rows}


AREA_RE = re.compile(r'^\(\s*(\d+)\s*\)\s*(.{2,30})$')


def main():
    raw, out = sys.argv[1], sys.argv[2]
    probe = len(sys.argv) > 3 and sys.argv[3] == 'probe'
    cur = json.load(open(os.path.join(raw, 'ncic', 'curriculum.json')))
    docs = [d for d in cur['docs'] if d['era'].startswith('2022') and '초등' in d['school']]
    pick = {}
    for d in docs:
        hwp = next((f for f in d['files'] if f['ext'] == 'hwp'), None)
        if hwp and (d['subject'] not in pick or d['school'] > pick[d['subject']][0]):
            pick[d['subject']] = (d['school'], hwp, d)
    os.makedirs(out, exist_ok=True)
    work = tempfile.mkdtemp()
    result = []
    for subj, (school, hwp, d) in sorted(pick.items()):
        if probe and subj not in ('국어', '수학'):
            continue
        p = os.path.join(work, f'{hwp["seq"]}.hwp')
        if not download(hwp['url'], p):
            continue
        try:
            xh = to_xhtml(p, os.path.join(work, str(hwp['seq'])))
        except Exception as e:  # noqa: BLE001
            print('바꾸기 실패', subj, e)
            continue
        doc = Doc()
        doc.feed(open(xh, encoding='utf-8', errors='ignore').read())
        if probe:
            dbg = os.path.join(out, 'debug')
            os.makedirs(dbg, exist_ok=True)
            tabs = []
            for kind, v in doc.items:
                if kind == 'table' and '핵심' in json.dumps(v, ensure_ascii=False):
                    tabs.append(v)
            json.dump({'subject': subj, 'tables': tabs[:3], 'items_head': [x for x in doc.items[:80]]}, open(os.path.join(dbg, f'cs_{subj}.json'), 'w'), ensure_ascii=False, indent=1)
            print(subj, '표', sum(1 for k, _ in doc.items if k == 'table'), '내용 체계 후보', len(tabs))
            continue
        tables = []
        paras = []
        for kind, v in doc.items:
            if kind == 'p':
                paras.append(v)
                continue
            t = parse_cs_table(v)
            if not t:
                continue
            area = ''
            for ptxt in reversed(paras[-6:]):
                m = AREA_RE.match(ptxt.strip())
                if m:
                    area = norm(m.group(2))
                    break
            t['area'] = area or f'영역 {len(tables) + 1}'
            t['prev'] = [x[:40] for x in paras[-3:]]  # 확인용(앱은 안 씀)
            tables.append(t)
        print(subj, school, '내용 체계 표', len(tables))
        result.append({'subject': subj, 'era': '2022', 'school': school, 'file': {'name': hwp['name'], 'url': hwp['url']}, 'areas': tables})
    if not probe:
        json.dump({'built': time.strftime('%Y-%m-%d'), 'source': 'NCIC 국가교육과정정보센터 교육과정 고시문(한글 파일)', 'subjects': result},
                  open(os.path.join(out, 'content_system_elementary.json'), 'w'), ensure_ascii=False)


if __name__ == '__main__':
    main()
