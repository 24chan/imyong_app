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
    # 스타일 이름 글자가 깨진 파일(과학 등)에서 pyhwp가 멈추지 않게: 깨진 글자는 바꿔 넣고 계속
    code = ("import sys, hwp5.dataio as d; d.decode_utf16le_with_hypua = lambda b: b.decode('utf-16le', 'replace'); "
            "sys.argv = ['hwp5html', '--output', sys.argv[1], sys.argv[2]]; from hwp5.hwp5html import main; main()")
    r = subprocess.run([sys.executable, '-c', code, outdir, hwp], timeout=900, capture_output=True)
    if r.returncode:
        print('hwp5html 오류', r.returncode, r.stderr.decode('utf-8', 'ignore')[-600:])
    for root, _, files in os.walk(outdir):
        for f in files:
            if f.endswith('.xhtml') or f.endswith('.html'):
                return os.path.join(root, f)
    raise RuntimeError('xhtml 없음: ' + str([f for _, _, fs in os.walk(outdir) for f in fs][:10]))


SKIP = ('총론', '창의적', '한국어')


def subj_name(s):
    t = s.replace(' ', '')
    if t.startswith('실과'):
        return '실과'
    if '바른생활' in t or '슬기로운' in t:
        return '통합교과'
    return s


class Doc(HTMLParser):
    """xhtml → 차례대로 [('p', 글) | ('table', [[{t, rs, cs}]])] (표 안 표는 글로 합침)"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items = []
        self.depth = 0
        self.rows = None
        self.cell = None
        self.buf = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('style', 'script', 'head', 'title'):
            self.skip += 1  # 2026-11-24 고침: 스타일 코드(.Section-0 {position: absolute…})가 글로 섞이던 문제
            return
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
        elif self.depth >= 2 and tag in ('tr', 'td', 'th') and self.cell is not None:
            self.cell['t'].append('\n')  # 2026-11-28: 칸 안 작은 표의 칸 경계('가치' | '과학 유용성')가 붙어 '가치과학'이 되던 문제
        elif tag == 'p' and self.depth == 0:
            self.flush()

    def handle_endtag(self, tag):
        if tag in ('style', 'script', 'head', 'title'):
            self.skip = max(0, self.skip - 1)
            return
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
        if self.skip:
            return
        if self.cell is not None:
            self.cell['t'].append(d)
        elif self.depth == 0:
            self.buf.append(d)

    def flush(self):
        t = clean(''.join(self.buf))
        if t:
            self.items.append(('p', t))
        self.buf = []


def items_from_hwpxml(path):
    """hwp5html이 안 되는 파일: hwp5proc xml → 같은 [('p', 글) | ('table', 칸들)] 목록"""
    import xml.etree.ElementTree as ET
    r = subprocess.run(['hwp5proc', 'xml', path], capture_output=True, timeout=900)
    if r.returncode or not r.stdout:
        raise RuntimeError('hwp5proc 오류 ' + r.stderr.decode('utf-8', 'ignore')[-300:])
    root = ET.fromstring(r.stdout)
    items = []

    def para_text(el):
        return ''.join(t.text or '' for t in el.iter('Text'))

    def walk(el, in_table=False):
        for ch in el:
            if ch.tag == 'TableControl' and not in_table:
                rows = []
                for row in ch.iter('TableRow'):
                    cells = []
                    for cell in row.findall('TableCell'):
                        txt = '\n'.join(para_text(pp) for pp in cell.iter('Paragraph'))
                        cells.append({'t': clean(txt), 'rs': int(cell.get('rowspan', 1)), 'cs': int(cell.get('colspan', 1))})
                    rows.append(cells)
                items.append(('table', rows))
            elif ch.tag == 'Paragraph' and not in_table:
                t = clean(''.join(x.text or '' for x in ch.findall('.//LineSeg/Text')) or para_text_direct(ch))
                if t:
                    items.append(('p', t))
                walk(ch, in_table)
            else:
                walk(ch, in_table or ch.tag == 'TableControl')

    def para_text_direct(pp):
        return ''.join(t.text or '' for t in pp.iter('Text') if not any(True for _ in []))

    walk(root)
    return items


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
    t = re.sub(r'^\[(.*)\]$', r'\1', (t or '').strip(), flags=re.S)  # '[지식·이해]' 대괄호 빼기(미술·음악)
    """칸 이름: 줄바꿈은 '·' 뒤면 붙이고 아니면 띄움 ('지식·\\n이해' → '지식·이해', '듣기·말하기\\n맥락' → '듣기·말하기 맥락')"""
    t = dot(t or '').strip()
    t = re.sub(r'\s*\n\s*·', '·', re.sub(r'·\s*\n\s*', '·', t))
    return re.sub(r'\s+', ' ', t).strip()


JOIN_RE = re.compile(r'^(\(|에서|에|을|를|의|과|와|로|으로|하기|및|등)')


GLUED_SCI = re.compile(r'(?<=[가-힣])(?<![명구연])(?=과학)')


def split_glued(tables):
    """2026-11-28 사용자 검토: 과학 가치·태도 칸은 줄마다 한 항목인데 원문 한글 파일에 줄 구분이 없어
    '가치과학 유용성', '감수성과학 창의성'처럼 붙어 나옴 → '과학' 앞에서 나눔(생명과학·지구과학·자연과학은 그대로)"""
    for a in tables:
        for r in a.get('rows', []):
            if not r.get('cat', '').startswith('가치'):
                continue
            for c in r['cells']:
                c['items'] = [p.strip() for it in c['items'] for p in GLUED_SCI.split(it) if p.strip()]


def items_of(t):
    """칸 글 → 내용 요소 목록. 2026-11-24 검토 반영: 글머리표(⋅)가 있으면 글머리표마다 하나, 줄바꿈으로 쪼개진 조각
    ('글 수준\\n에서 고쳐쓰기', '시각과 시간\\n(시, 분)')은 앞 줄에 붙임. 각도 기호 복구"""
    lines = [x.strip() for x in (t or '').split('\n') if x.strip()]
    bullet = any(x[0] in '⋅·•ㆍ∙▪' for x in lines)
    out = []
    for x in lines:
        starts = x[0] in '⋅·•ㆍ∙▪-–'
        body = x.lstrip(BULLET).strip()
        if not body:
            continue
        if out and ((bullet and not starts) or JOIN_RE.match(body)):
            sep = '' if JOIN_RE.match(body) and not body.startswith('(') else ' '
            out[-1] = out[-1] + sep + body
        else:
            out.append(body)
    return [dot(re.sub(r'각도\s*\(\s*\)', '각도(°)', x)) for x in out]


def parse_cs_table(rows):
    """2022 내용 체계 표 하나 → {ideas, grades, rows:[{cat, sub, cells:[{items, span}]}]} (초등 학년군만, 못 읽으면 None)"""
    g = grid(rows)
    if len(g) < 4:
        return None
    if any(re.sub(r'\s', '', t) == '내용요소' for t, _ in g[0]) and any(re.sub(r'\s', '', t) == '영역' for t, _ in g[0]) and not any(GRADE_RE.search(t or '') for row in g[:4] for t, _ in row):
        return parse_area_rows(g)  # 통합교과처럼 '영역 | 핵심 아이디어 | 범주 | 내용 요소' 꼴(학년 칸 없음)
    idea_r = next((r for r, row in enumerate(g) if row and re.sub(r'\s', '', row[0][0]).startswith('핵심아이디어')), None)
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
    emitted = set()  # 위 줄과 합쳐진(rowspan) 칸은 한 번만
    for r in range(hr + 1, len(g)):
        row = g[r]
        cat = norm(row[0][0])
        sub = norm(row[1][0]) if len(row) > 1 and row[1][1] != row[0][1] and row[1][1] not in [row[c][1] for c, _ in cols] and row[1][1] not in emitted else ''
        if sub:
            emitted.add(row[1][1])
        cells = []
        prev = None
        for c, _ in cols:
            t, cid = row[c] if c < len(row) else ('', -1)
            if prev is not None and cid == prev and cid != -1:
                cells[-1]['span'] += 1
                continue
            cells.append({'items': [] if cid in emitted else items_of(t), 'span': 1})
            prev = cid
        for c, _ in cols:
            if c < len(row) and row[c][1] != -1:
                emitted.add(row[c][1])
        if not any(x['items'] for x in cells):
            continue  # 초등 칸이 다 빈 줄(위 칸과 합쳐진 줄, 중학교 전용 하위 범주)
        out_rows.append({'cat': cat, 'sub': sub, 'cells': cells})
    # 범주 칸이 비면 위 범주 이어받기
    last = ''
    for x in out_rows:
        if x['cat']:
            last = x['cat']
        else:
            x['cat'] = last
    return {'ideas': ideas, 'grades': [lab for _, lab in cols], 'rows': out_rows}


SUBJ_CODE = {'바': '바른 생활', '슬': '슬기로운 생활', '즐': '즐거운 생활', '건': '건강한 생활'}


def parse_area_rows(g):
    """'영역 | 핵심 아이디어 | 범주 | 내용 요소 | (성취기준)' 표 → 영역 여러 개 (1~2학년 한 칸)"""
    head = [re.sub(r'\s', '', t) for t, _ in g[0]]
    ci = {k: head.index(k) for k in ('영역', '핵심아이디어', '범주', '내용요소') if k in head}
    if len(ci) < 4:
        return None
    sc = head.index('성취기준') if '성취기준' in head else None
    areas, cur, last_area = [], None, None
    for row in g[1:]:
        at, aid = row[ci['영역']]
        if aid != last_area:
            last_area = aid
            group = ''
            if sc is not None:
                m = re.search(r'\[\s*\d+\s*([가-힣])', row[sc][0] or '')
                group = SUBJ_CODE.get(m.group(1), '') if m else ''
            cur = {'area': (group + ' · ' if group else '') + norm(at), 'ideas': items_of(row[ci['핵심아이디어']][0]), 'grades': ['1~2'], 'rows': []}
            areas.append(cur)
        cat = norm(row[ci['범주']][0])
        items = items_of(row[ci['내용요소']][0])
        if cat or items:
            cur['rows'].append({'cat': cat, 'sub': '', 'cells': [{'items': items, 'span': 1}]})
    return {'multi': areas} if areas else None


AREA_RE = re.compile(r'^\(\s*(\d+)\s*\)\s*(.{2,30})$')


def main():
    raw, out = sys.argv[1], sys.argv[2]
    probe = len(sys.argv) > 3 and sys.argv[3].startswith('probe')
    probe_subj = sys.argv[3].split(':', 1)[1].split(',') if probe and ':' in sys.argv[3] else ['국어', '수학']
    cur = json.load(open(os.path.join(raw, 'ncic', 'curriculum.json')))
    docs = [d for d in cur['docs'] if d['era'].startswith('2022') and '초등' in d['school']]
    pick = {}
    for d in docs:
        hwp = next((f for f in d['files'] if f['ext'] == 'hwp'), None)
        if not hwp or any(k in d['subject'] for k in SKIP):
            continue
        name = subj_name(d['subject'])
        if name not in pick or d['school'] > pick[name][0]:
            pick[name] = (d['school'], hwp, d)
    os.makedirs(out, exist_ok=True)
    work = tempfile.mkdtemp()
    result = []
    for subj, (school, hwp, d) in sorted(pick.items()):
        if probe and subj not in probe_subj:
            continue
        p = os.path.join(work, f'{hwp["seq"]}.hwp')
        if not download(hwp['url'], p):
            continue
        doc = Doc()
        try:
            xh = to_xhtml(p, os.path.join(work, str(hwp['seq'])))
            doc.feed(open(xh, encoding='utf-8', errors='ignore').read())
        except Exception as e:  # noqa: BLE001
            print('바꾸기 실패', subj, e, '→ hwp5proc xml로')
            try:
                doc.items = items_from_hwpxml(p)
            except Exception as e2:  # noqa: BLE001
                print('xml도 실패', subj, e2)
                continue
        if probe:
            dbg = os.path.join(out, 'debug')
            os.makedirs(dbg, exist_ok=True)
            tabs = []
            for kind, v in doc.items:
                if kind == 'table' and '핵심' in json.dumps(v, ensure_ascii=False):
                    tabs.append(v)
            ci = next((k for k, (kind, v) in enumerate(doc.items) if kind == 'p' and re.search(r'내용\s*체계', v)), 0)
            json.dump({'subject': subj, 'tables': tabs[:3], 'near': [x for x in doc.items[ci:ci + 12]]}, open(os.path.join(dbg, f'cs_{subj}.json'), 'w'), ensure_ascii=False, indent=1)
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
            if 'multi' in t:
                tables.extend(t['multi'])
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
        # 영역 이름 띄어쓰기: 문서 속 '(1) 우리는 누구로 살아갈까' 같은 제목과 글자가 같으면 그 제목으로
        heads = {}
        for kind, v in doc.items:
            m = AREA_RE.match(v.strip()) if kind == 'p' else None
            if m:
                heads.setdefault(re.sub(r'\s', '', norm(m.group(2))), norm(m.group(2)))
        for t in tables:
            pre, _, name = t['area'].rpartition(' · ')
            fixed = heads.get(re.sub(r'\s', '', name))
            if fixed:
                t['area'] = (pre + ' · ' if pre else '') + fixed
        print(subj, school, '내용 체계 표', len(tables), [t['area'] for t in tables])
        if subj == '과학':
            split_glued(tables)
        result.append({'subject': subj, 'era': '2022', 'school': school, 'file': {'name': hwp['name'], 'url': hwp['url']}, 'areas': tables})
    if not probe:
        json.dump({'built': time.strftime('%Y-%m-%d'), 'source': 'NCIC 국가교육과정정보센터 교육과정 고시문(한글 파일)', 'subjects': result},
                  open(os.path.join(out, 'content_system_elementary.json'), 'w'), ensure_ascii=False)


if __name__ == '__main__':
    main()
