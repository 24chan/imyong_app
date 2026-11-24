"""기출 분석 1단계: 초등 교육과정 A·B (2026-11-24 사용자 승인)
교육과정 원문(NCIC, 고시문)과 평가원 기출을 글자로 바꿔, 문항마다 원문의 어느 칸(성격·목표/내용 체계/성취기준/교수·학습/평가)에서
나왔는지 자동으로 이어 붙이고 통계를 만든다.
- 앱에 저장하는 것: 교육과정 원문 칸(고시문, 저작권 보호 대상 아님), 칸마다 '몇 년 몇 번에 나왔나', 겹친 말(원문에 있는 말만), 통계
- 저장하지 않는 것: 기출 문항 글 (평가원 저작물) → 작업 중에만 쓰고 버림
사용: python exam_analysis.py <raw 폴더(raw-files의 raw)> <out_dir>"""
import collections
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.request

UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36'
ELEM_SUBJECTS = ['국어', '수학', '사회', '도덕', '과학', '실과', '체육', '음악', '미술', '영어', '바른 생활', '슬기로운 생활', '즐거운 생활', '창의적 체험활동', '총론']
LOG = []


def log(*a):
    s = ' '.join(str(x) for x in a)
    print(s)
    LOG.append(s)


def subj_name(s):
    s = s.replace(' ', '')
    if s.startswith('실과'):
        return '실과'
    if '바른생활' in s or '슬기로운' in s or '즐거운생활' in s or s == '통합교과':
        return '통합교과'
    return {'창의적체험활동': '창체'}.get(s, s)


def download(url, path, magic=b'%PDF'):
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return True
    for i in range(3):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=120)
            data = r.read()
            if data[:len(magic)] != magic:
                log('파일 형식 다름', url[:120], data[:20])
                return False
            open(path, 'wb').write(data)
            time.sleep(0.8)
            return True
        except Exception as e:  # noqa: BLE001
            log('받기 실패', i, url[:120], str(e)[:100])
            time.sleep(3 * (i + 1))
    return False


def pdf_text(path, layout=True):
    try:
        out = subprocess.run(['pdftotext'] + (['-layout'] if layout else []) + ['-enc', 'UTF-8', path, '-'], capture_output=True, timeout=180, check=True).stdout
        return out.decode('utf-8', 'ignore')
    except Exception as e:  # noqa: BLE001
        log('글자 뽑기 실패', path, e)
        return ''


# ---------- 교육과정 원문 칸 나누기 ----------
SEC_RE = [
    ('성격', re.compile(r'^\s*(?:1\.|가\.)?\s*성\s*격')),
    ('목표', re.compile(r'^\s*(?:2\.|나\.)?\s*목\s*표')),
    ('성격·목표', re.compile(r'^\s*1\.\s*성격\s*및\s*목표')),
    ('내용 체계', re.compile(r'^\s*(?:가\.|3\.)?\s*내용\s*체계')),
    ('성취기준', re.compile(r'^\s*(?:나\.|2\.)?\s*성취\s*기준')),
    ('교수·학습', re.compile(r'^\s*(?:가\.|3\.|4\.)?\s*교수\s*[·ㆍ⋅∙・\.]?\s*학습(?!\s*및\s*평가\s*$)')),
    ('교수·학습 및 평가', re.compile(r'^\s*3\.\s*교수\s*[·ㆍ⋅∙・]?\s*학습\s*및\s*평가')),
    ('평가', re.compile(r'^\s*(?:나\.|4\.|5\.)?\s*평\s*가\s*$')),
]
CODE_RE = re.compile(r'\[\s*(\d{1,2})\s*([가-힣]{1,3})\s*(\d{2})\s*[-‐‑–−~]\s*(\d{2})\s*\]')


def hwp_text_tables(path):
    """2026-11-24 고침: hwp5txt는 표를 '<표>'로만 남겨 표 안의 성취기준 문장이 빠졌음 → hwp5html로 표 칸 글까지.
    표는 칸마다 한 줄로(성취기준 표는 칸 하나가 성취기준 하나)"""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import content_system as cs  # 같은 폴더(내용 체계표 수집기)의 변환·표 읽기
    d = tempfile.mkdtemp()
    try:
        xh = cs.to_xhtml(path, d)
        doc = cs.Doc()
        doc.feed(open(xh, encoding='utf-8', errors='ignore').read())
    except Exception as e:  # noqa: BLE001
        log('한글 표 글 뽑기 실패 → hwp5txt', path, str(e)[:100])
        return hwp_text(path)
    lines = []
    for kind, v in doc.items:
        if kind == 'p':
            lines.append(v)
        else:
            # 2026-11-24 고침: 내용 체계표 등에서 중학교·고등학교 칸은 빼고 읽기
            g = cs.grid(v)
            drop_cols = {c for r in g[:5] for c, (t, _) in enumerate(r) if re.search(r'중학교|고등학교', t or '')}
            seen_ids = set()
            rows = []
            for r in g:
                cells = []
                for c, (t, cid) in enumerate(r):
                    if c in drop_cols or cid in seen_ids or cid == -1:
                        continue
                    seen_ids.add(cid)
                    cells.append({'t': t})
                rows.append(cells)
            for row in rows:
                for cell in row:
                    t = cell['t']
                    if not t:
                        continue
                    if CODE_RE.match(t.strip()):
                        # 칸 하나에 성취기준이 여러 개 있으면 코드마다 한 줄로(줄바꿈으로 이어진 문장은 붙임)
                        for piece in re.split(r'\n(?=\s*\[\s*\d{1,2}\s*[가-힣]{1,3}\s*\d{2}\s*[-‐‑–−~]\s*\d{2}\s*\])', t):
                            lines.append(re.sub(r'\s*\n\s*', ' ', piece))
                    else:
                        lines.extend(t.split('\n'))
    return '\n'.join(lines)


def hwp_text(path):
    try:
        out = subprocess.run(['hwp5txt', path], capture_output=True, timeout=300, check=True).stdout
        return out.decode('utf-8', 'ignore')
    except Exception as e:  # noqa: BLE001
        log('한글 글자 뽑기 실패', path, str(e)[:100])
        return ''


def broken(t):
    """글꼴 문제로 깨진 글자(한글 아닌 기호가 대부분)"""
    ko = len(re.findall(r'[가-힣]', t))
    return ko < len(t) * 0.25


CSS_RE = re.compile(r'\.Section-\d|position\s*:\s*absolute|font-family\s*:|\{[^{}]*:[^{}]*;[^{}]*\}|@page|text-align\s*:')
ADMIN_RE = re.compile(r'부\s*칙|이\s*고시는|시행한다|게재|고시\s*제\s*\d|시행일|적용\s*시기|학년도부터\s*적용|고시문\s*전문')
UPPER_RE = re.compile(r'중학교|고등학교|고교|학점|단위\s*배당|선택\s*과목|공통\s*과목|9\s*학년|[789]학년|1\s*[~∼～-]\s*3\s*학년')


def keep_text(t):
    """코드 없는 칸 거르기 (2026-11-24 이중 검토 지적): 스타일 코드, 행정 머리말(부칙·시행일·게재 안내), 중·고등만 다루는 글"""
    if CSS_RE.search(t):
        return False
    if ADMIN_RE.search(t) and len(t) < 700:
        return False
    if UPPER_RE.search(t) and not re.search(r'초등|1\s*[~∼～-]\s*2\s*학년|3\s*[~∼～-]\s*4\s*학년|5\s*[~∼～-]\s*6\s*학년', t):
        return False
    return True


BAND_RE = re.compile(r'^\[?\s*(초등학교|중학교|고등학교)\s*\d')


def split_units(text, subject, era):
    """원문 글 → 칸 목록. 성취기준은 코드 하나가 한 칸, 나머지는 문단 묶음(최대 600자)
    한 파일에 중학교·고등학교 과목이 같이 들어 있어서(국어과 교육과정 등) 초등 부분만 남김:
    - '성격'이 새로 나올 때마다 묶음(block)을 나누고, 초등 성취기준 코드(학년 6 이하)가 있는 묶음만 남김
    - 묶음 안에서도 [중학교 1~3학년] 부분, 학년 7 이상 코드는 뺌"""
    units, sec, buf = [], '앞부분', []
    area = ''
    block = 0
    band = ''

    def flush():
        t = re.sub(r'\s+', ' ', ' '.join(buf)).strip()
        if len(t) >= 20 and band not in ('중학교', '고등학교'):
            units.append({'subject': subject, 'era': era, 'section': sec, 'area': area, 'code': '', 'text': t, 'block': block})
        buf.clear()

    lines = []
    for ln in text.splitlines():
        # 그림·표 자리표시 뒤에 제목이 같은 줄로 붙어 나오는 경우가 있어 나눔
        lines.extend(x.strip() for x in re.split(r'<그림>|<표>', ln))
    for s in lines:
        if not s or re.fullmatch(r'[-\d\s]+', s):
            continue
        hit = next((name for name, rx in SEC_RE if rx.match(s) and len(s) < 30), None)
        if hit:
            flush()
            if hit == '성격' and any(u['section'] != '앞부분' for u in units if u['block'] == block):
                block += 1
            sec = '교수·학습 및 평가' if hit == '교수·학습 및 평가' else hit
            band = ''
            continue
        bm = BAND_RE.match(s) if sec == '성취기준' and len(s) < 25 else None
        if bm:
            flush()
            band = bm.group(1)
            continue
        am = re.match(r'^\s*\(\d+\)\s*([가-힣·ㆍ\s]{2,20})$', s)
        if am and sec in ('성취기준', '내용 체계'):
            flush()
            area = am.group(1).strip()
            continue
        cm = CODE_RE.search(s)
        if cm and sec in ('성취기준', '앞부분', '내용 체계'):
            flush()
            sec = '성취기준'
            if int(cm.group(1)) > 6:  # 중·고등 성취기준
                units.append({'subject': subject, 'era': era, 'section': '성취기준', 'area': area, 'code': '', 'text': '', 'block': block, 'drop': True})
                continue
            code = f'[{cm.group(1)}{cm.group(2)}{cm.group(3)}-{cm.group(4)}]'
            units.append({'subject': subject, 'era': era, 'section': '성취기준', 'area': area, 'code': code, 'text': s[cm.start():], 'block': block})
            continue
        if units and units[-1].get('drop') and not buf and sec == '성취기준' and not s.startswith(('(', '[', '①')):
            continue  # 뺀 코드 문장의 이어지는 줄
        if units and units[-1]['code'] and not buf and sec == '성취기준' and len(units[-1]['text']) < 400 and not s.startswith(('(', '[', '①')):
            units[-1]['text'] += ' ' + s  # 성취기준 문장이 줄바꿈으로 이어짐
            continue
        buf.append(s)
        if sum(len(b) for b in buf) > 600:
            flush()
    flush()
    # 같은 코드가 두 번(표 속 성취기준 문장 + 아래 해설) 나오면 한 칸으로: 성취기준 문장 먼저, 해설은 뒤에
    merged, by_code = [], {}
    for u in units:
        if u['code'] and not u.get('drop'):
            if u['code'] in by_code:
                prev = by_code[u['code']]
                body = u['text'][len(u['code']):].strip() if u['text'].startswith(u['code']) else u['text']
                if body and body not in prev['text']:
                    prev['text'] += ' ▶ 해설·고려 사항: ' + body if '▶' not in prev['text'] else ' ' + body
                continue
            by_code[u['code']] = u
        merged.append(u)
    units = [u for u in merged if u.get('drop') or u['code'] or keep_text(u['text'])]
    elem_blocks = {u['block'] for u in units if u['code']}
    if elem_blocks:
        units = [u for u in units if u['block'] in elem_blocks and not u.get('drop')]
    else:
        units = [u for u in units if not u.get('drop')]
    for u in units:
        u.pop('block', None)
    return units


# ---------- 기출 문항 나누기 ----------
Q_RE = re.compile(r'^\s{0,10}(\d{1,2})\s*[.．]\s*(?=\S)')


INSTR = re.compile(r'문답지|시험이 시작되면|감독관|수험\s*번호|답안 작성용')


def _parse_from(lines, start):
    qs, cur, want = {}, None, 1
    for ln in lines[start:]:
        m = Q_RE.match(ln)
        if m and int(m.group(1)) == want:
            cur = want
            want += 1
            qs[cur] = ln[m.end():]
            continue
        if cur:
            qs[cur] += '\n' + ln
    return qs


def split_questions(text):
    """기출 글 → {번호: 글}. '1.'로 시작하는 줄마다 거기서부터 차례 번호를 세 보고, 안내문이 아닌 가장 긴 결과를 씀"""
    lines = text.splitlines()
    best = {}
    for i, ln in enumerate(lines):
        m = Q_RE.match(ln)
        if not (m and m.group(1) == '1'):
            continue
        qs = _parse_from(lines, i)
        if INSTR.search(qs.get(1, '')[:300]):
            continue
        if len(qs) > len(best):
            best = qs
    return {k: re.sub(r'\s+', ' ', v) for k, v in best.items()}


# ---------- 문항 위치 (2026-11-24 사용자 승인 A안) ----------
# 문항 그림·글은 저장하지 않고 '몇 쪽, 어디부터 어디까지'(쪽 크기에 대한 비율 0~1) 숫자만 남김.
# 앱이 평가원 원본 PDF를 받아 그 쪽 하나만 그려서 그 부분만 잘라 보여 줌.
# 구조(모든 출처 공통): boxes['2019B']['6'] = {'p': 쪽(1부터), 'r': [x0, y0, x1, y1], 'src': 'text'|'ocr'|'manual'}
#  - text: 글자 PDF의 글자 위치(pdftotext -bbox-layout)
#  - ocr: 그림 PDF(2014·2015 등)를 글자 읽기(tesseract)한 줄 위치
#  - manual: 사람이 넣은 값(data/exam_boxes_manual.json) — 자동 값보다 먼저
MANUAL_BOXES = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'exam_boxes_manual.json')
_LINE_RE = re.compile(r'<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</line>', re.S)
_PAGE_RE = re.compile(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', re.S)
_WORD_RE = re.compile(r'<word[^>]*>(.*?)</word>', re.S)
_QSTART = re.compile(r'^(\d{1,2})\s*[.．]')


def page_lines_text(path):
    """글자 PDF → 쪽마다 줄 목록 [(x0, y0, x1, y1, 글)] (모두 0~1 비율)"""
    try:
        xml = subprocess.run(['pdftotext', '-bbox-layout', path, '-'], capture_output=True, timeout=180, check=True).stdout.decode('utf-8', 'ignore')
    except Exception as e:  # noqa: BLE001
        log('글자 위치 읽기 실패', path, str(e)[:80])
        return []
    pages = []
    for w, h, body in _PAGE_RE.findall(xml):
        W, H = float(w), float(h)
        lines = []
        for x0, y0, x1, y1, inner in _LINE_RE.findall(body):
            t = ' '.join(_WORD_RE.findall(inner)).strip()
            if t:
                lines.append((float(x0) / W, float(y0) / H, float(x1) / W, float(y1) / H, t))
        pages.append(lines)
    return pages


def page_lines_ocr(path):
    """그림 PDF → 쪽마다 줄 목록 (tesseract 줄 위치, 0~1 비율)"""
    d = tempfile.mkdtemp()
    pages = []
    try:
        subprocess.run(['pdftoppm', '-r', '150', '-gray', '-png', path, os.path.join(d, 'p')], check=True, timeout=300, capture_output=True)
        for f in sorted(os.listdir(d)):
            r = subprocess.run(['tesseract', os.path.join(d, f), '-', '-l', 'kor', '--psm', '4', 'tsv'], capture_output=True, timeout=180)
            rows = [ln.split('\t') for ln in r.stdout.decode('utf-8', 'ignore').splitlines()[1:]]
            W = H = None
            groups = collections.OrderedDict()
            for c in rows:
                if len(c) < 12:
                    continue
                lvl, left, top, wd, ht, txt = int(c[0]), int(c[6]), int(c[7]), int(c[8]), int(c[9]), c[11].strip()
                if lvl == 1:
                    W, H = wd, ht
                if lvl != 5 or not txt:
                    continue
                k = (c[2], c[3], c[4])  # 블록·문단·줄
                g = groups.setdefault(k, [left, top, left + wd, top + ht, []])
                g[0], g[1], g[2], g[3] = min(g[0], left), min(g[1], top), max(g[2], left + wd), max(g[3], top + ht)
                g[4].append(txt)
            if not W:
                pages.append([])
                continue
            pages.append([(g[0] / W, g[1] / H, g[2] / W, g[3] / H, ' '.join(g[4])) for g in groups.values()])
    except Exception as e:  # noqa: BLE001
        log('글자 읽기(OCR) 위치 실패', path, str(e)[:100])
    return pages


def boxes_from_lines(pages, src):
    """쪽마다 줄 위치(0~1) → 문항마다 {'p', 'r', 'src'}. 두 단 문제지면 단마다 따로"""
    info = []
    for pi, lines in enumerate(pages):
        two = sum(1 for ln in lines if ln[0] > 0.5) > 8 and sum(1 for ln in lines if ln[0] < 0.48 and ln[2] > 0.52) < len(lines) * 0.15
        info.append((pi + 1, lines, two))
    cands = []  # (쪽, 단, y, 번호)
    cover = re.compile(r'문답지|감독관|수험번호|답안\s*작성|유의\s*사항|시험이\s*시작되면|필기구|부정행위')
    for pi, (pg, lines, two) in enumerate(info):
        pc = []  # 이 쪽 번호 줄 (단, y, 번호, 글)
        for x0, y0, x1, y1, t in lines:
            m = _QSTART.match(t)
            if not m or y0 > 0.95:
                continue
            col = 1 if x0 > 0.5 else 0  # 줄마다 단 판단(표지처럼 한 쪽에 넓은 줄과 두 단이 섞인 쪽)
            if x0 - (0.5 if col else 0) > 0.12:  # 단 왼쪽 끝 번호만
                continue
            pc.append((col, y0, int(m.group(1)), t))
        pc.sort()
        # 표지 유의 사항: '1. 시험이 시작되면…'부터 번호가 1씩 이어지는 줄은 문항이 아님
        skip = set()
        for a_, c in enumerate(pc):
            if cover.search(c[3]) and a_ not in skip:
                skip.add(a_)
                last = c
                for b_ in range(a_ + 1, len(pc)):
                    d = pc[b_]
                    if d[0] == last[0] and d[2] == last[2] + 1:
                        skip.add(b_)
                        last = d
        if any(c[0] == 1 for c in pc):
            info[pi] = (pg, lines, True)
        cands.extend((pg, c[0], c[1], c[2]) for k_, c in enumerate(pc) if k_ not in skip)
    cands.sort()
    best = []  # 1부터 차례로 이어지는 가장 긴 줄기 (보기 속 '1.' 거르기)
    for i, c in enumerate(cands):
        if c[3] != 1:
            continue
        seq, want = [c], 2
        for d in cands[i + 1:]:
            if d[3] == want:
                seq.append(d)
                want += 1
        if len(seq) > len(best):
            best = seq
    by_pg = {pg: (lines, two) for pg, lines, two in info}
    out = {}
    for k, (pg, col, y, n) in enumerate(best):
        lines, two = by_pg[pg]
        lo, hi = (0.5, 1.0) if (two and col) else (0.0, 0.5 if two else 1.0)
        nxt = best[k + 1] if k + 1 < len(best) else None
        same = bool(nxt and nxt[0] == pg and nxt[1] == col)
        body = [ln for ln in lines if ln[1] >= y - 0.002 and ln[1] < 0.95 and lo - 0.005 <= ln[0] < hi]
        if same:
            body = [ln for ln in body if ln[1] < nxt[2] - 0.002]
        if not body:
            continue
        x0 = max(0.0, min(ln[0] for ln in body) - 0.012)
        x1 = min(1.0, max(ln[2] for ln in body) + 0.012)
        y0 = max(0.0, y - 0.01)
        y1 = min(1.0, max(ln[3] for ln in body) + 0.012)
        if same:
            y1 = max(y1, min(1.0, nxt[2] - 0.005))  # 그림·표(글자 없는 부분)도 다음 번호 앞까지
        out[n] = {'p': pg, 'r': [round(x0, 4), round(y0, 4), round(x1, 4), round(y1, 4)], 'src': src}
        if not same and y1 > 0.88:
            out[n]['more'] = True  # 단·쪽 끝까지 감 → 다음 단·쪽으로 이어질 수 있음(앱에 안내)
    return out


def manual_boxes():
    """사람이 넣은 문항 자리 (같은 구조, src='manual'). 잘못된 값은 건너뜀"""
    try:
        raw = json.load(open(MANUAL_BOXES))
    except FileNotFoundError:
        return {}
    except Exception as e:  # noqa: BLE001
        log('수동 문항 자리 파일 오류', e)
        return {}
    out = {}
    for key, qs in raw.items():
        if key.startswith('_') or not isinstance(qs, dict):
            continue
        for n, b in qs.items():
            try:
                pg, r = int(b['p']), [float(v) for v in b['r']]
                ok = pg >= 1 and len(r) == 4 and all(0 <= v <= 1 for v in r) and r[0] < r[2] and r[1] < r[3]
            except Exception:  # noqa: BLE001
                ok = False
            if not ok:
                log('수동 문항 자리 건너뜀', key, n, b)
                continue
            out.setdefault(key, {})[str(int(n))] = {'p': pg, 'r': [round(v, 4) for v in r], 'src': 'manual'}
    return out


def ocr_pdf(path):
    """그림만 있는 옛 문제지: 쪽마다 그림으로 바꿔 글자 읽기(tesseract 한국어)"""
    d = tempfile.mkdtemp()
    try:
        subprocess.run(['pdftoppm', '-r', '200', '-gray', '-png', path, os.path.join(d, 'p')], check=True, timeout=300, capture_output=True)
        out = []
        for f in sorted(os.listdir(d)):
            r = subprocess.run(['tesseract', os.path.join(d, f), '-', '-l', 'kor', '--psm', '4'], capture_output=True, timeout=180)
            out.append(r.stdout.decode('utf-8', 'ignore'))
        return '\n'.join(out)
    except Exception as e:  # noqa: BLE001
        log('글자 읽기(OCR) 실패', path, str(e)[:100])
        return ''


# ---------- 말 나누기 (형태소 분석기 없이: 한글 덩어리에서 조사 떼기) ----------
JOSA = re.compile(r'(으로서|으로써|에서는|에게서|으로는|이라는|라는|에서|에게|으로|까지|부터|처럼|보다|하고|이며|이고|이다|과의|와의|으로|을|를|이|가|은|는|에|의|와|과|도|로|만|며|고|다)$')
STOP = set('그리고 그러나 다음 다음은 위의 아래 것을 것은 경우 대한 대하여 관련 내용 활동 학생 학생들 교사 학습 수업 지도 제시 설명 쓰시오 서술하시오 고르시오 무엇 어떤 각각 하나 이를 이와 같은 또는 및 등을 등 해당 바탕 통해 위해 따라 있는 있다 한다 하는 하여 한다 점수 점 자료 가 나 다 라 마 바 사 아 자 차 카 타 파 하 ㉠ ㉡ ㉢ ㉣'.split())


EXAM_WORDS = set('초등학교 교육과정 들어갈 고려하여 어떻게 활용하여 해당하 나타난 아니라 작성한 만들어 있도록 지도할 파악하 학년 학년군 교과서 수업 교사 학생 다음 내용 자료 활동 협의 협의회 대화 일부 계획 설명 근거 제시 의미 방법 목적 이유 개정 성취기준 단원 차시 지도 계획안 교수 학습 평가'.split())
EXAM_WORDS |= set('우리 시간 자신 그리 다른 여러 같이 서로 대해 것이 물음 있습니 선생님 이야기 생각 친구 사람 모습 경험 상황 과정 문제 결과 내용을 다양 다양한 중심 관계 특징 특성 바르게 알맞은 적절 적절한 무엇인 무엇을 이것 그것 자기 스스로 함께 모두 각자 이번 오늘 지금 처음 마지막 정도 부분 전체 가지 여기 거기 이때 그때 때문 하기 보기 위한 위하 대한 통한 따른 관한 같은 어떤 모든 이러 그러 저러 활용 이해 탐구 표현 참여 실천 태도 능력 역량 기능 학습자 교수학습 지도안 수업안 다음은 다음과 학급 모둠'.split())
VERBISH = re.compile(r'(하|한|할|함|하여|하는|하고|되|된|될|되는|되어|있는|없는|도록|어|아|여|고|며|면|지|게|서|라|려|던|든|인|으로|에서|였|었|았|겠|습니|니다|하되|되도록|면서|으며|에는|로는|과는|와는|기도|거나|는데|은데|지만|어서|아서|해서|하며|에게|부터)$')


EXAM_WORDS |= set('그런 이런 저런 때는 때에 가장 사실 다시 라는 있을 같다 경우에 안의 년간 합니 이해에 점을 글에 개를 다음 각각 모든 위의 아래 처음 정도 이상 이하 이외 사이 동안 경우 필요 여부 해당 관련 중요 대상 요소'.split())
VERBISH2 = re.compile(r'(나|이나|했|해|으|고자|킬|니|에|었으|였으)$')


def nounish(w):
    if len(w) < 2 or w in EXAM_WORDS or w in STOP or VERBISH.search(w) or VERBISH2.search(w):
        return False
    if len(w) == 2 and w[1] in '을를의에은는이가도와과로':  # 한 글자 말 + 조사(물을, 글에)
        return False
    return True


def words(t):
    out = []
    for w in re.findall(r'[가-힣]{2,}', t):
        w = JOSA.sub('', w) if len(w) > 2 else w
        if len(w) >= 2 and w not in STOP:
            out.append(w)
    return out


def shared_phrases(q, unit_text, n_min=5):
    """원문에 그대로 있는 4어절 이상 겹침(또는 긴 전문어)을 찾아 원문 위치로 돌려줌"""
    qn = re.sub(r'\s+', ' ', q)
    spans = []
    toks = [(m.group(0), m.start()) for m in re.finditer(r'\S+', unit_text)]
    i = 0
    while i < len(toks):
        best = 0
        for L in range(min(12, len(toks) - i), 2, -1):
            seg = unit_text[toks[i][1]: toks[i + L - 1][1] + len(toks[i + L - 1][0])]
            core = re.sub(r'[^\w가-힣 ]', '', seg).strip()
            if len(core) >= n_min * 2 and core in re.sub(r'[^\w가-힣 ]', '', qn):
                best = L
                spans.append([toks[i][1], toks[i + L - 1][1] + len(toks[i + L - 1][0])])
                break
        i += best or 1
    # 한 어절짜리 긴 전문어(5글자 이상)도
    for w, pos in toks:
        cw = JOSA.sub('', re.sub(r'[^가-힣]', '', w))
        if len(cw) >= 5 and cw in qn and not any(a <= pos < b for a, b in spans):
            spans.append([pos, pos + len(w)])
    return sorted(spans)


CUES = [('국어', r'국어'), ('수학', r'수학'), ('사회', r'사회과|사회\s*수업|사회\s*교과'), ('과학', r'과학'), ('도덕', r'도덕'), ('실과', r'실과'),
        ('체육', r'체육'), ('음악', r'음악'), ('미술', r'미술'), ('영어', r'영어'), ('통합교과', r'바른\s*생활|슬기로운\s*생활|즐거운\s*생활|통합\s*교과'),
        ('창체', r'창의적\s*체험\s*활동|동아리\s*활동|자율\s*활동'), ('총론', r'총론|학교\s*교육과정|편성[·ㆍ]?\s*운영')]
CODE_LET = {'국': '국어', '수': '수학', '사': '사회', '과': '과학', '도': '도덕', '실': '실과', '체': '체육', '음': '음악', '미': '미술', '영': '영어', '바': '통합교과', '슬': '통합교과', '즐': '통합교과'}


def cue_counts(t):
    c = collections.Counter()
    for m in CODE_RE.finditer(t):
        if m.group(2)[0] in CODE_LET:
            c['코드:' + CODE_LET[m.group(2)[0]]] += 1
    for name, rx in CUES:
        n = len(re.findall(rx, t))
        if n:
            c[name] += n
    return dict(c)


def decide_subject(t, vote):
    """2026-11-24 이중 검토 반영: 성취기준 코드가 있으면 그 교과. 교과 이름은 3번 이상이거나(동점 없이),
    2번이면서 원문 유사도도 그 교과를 2표 이상 줄 때만 믿음. 그 밖(1번 스침·동점)은 원문 유사도 다수결"""
    codes = collections.Counter(CODE_LET[m.group(2)[0]] for m in CODE_RE.finditer(t) if m.group(2)[0] in CODE_LET)
    if codes:
        return codes.most_common(1)[0][0], 'code'
    c = collections.Counter()
    for name, rx in CUES:
        n = len(re.findall(rx, t))
        if n:
            c[name] += n
    top = c.most_common(2)
    vtop = vote.most_common(1)[0][0] if vote else None
    if top:
        name, n = top[0]
        tie = len(top) > 1 and top[1][1] == n
        if not tie and (n >= 3 or (n >= 2 and vote.get(name, 0) >= 2)) and name not in ('총론', '창체'):
            return name, 'cue'
        if not tie and name in ('총론', '창체') and n >= 3 and vote.get(name, 0) >= 1:
            return name, 'cue'
    if vtop:
        return vtop, 'vote'
    return (top[0][0], 'cue') if top else (None, 'vote')


def cue_subject(t):
    """문항 속 성취기준 코드·교과 이름으로 교과 정하기(가장 많이 나온 것)"""
    c = collections.Counter()
    for m in CODE_RE.finditer(t):
        if m.group(2)[0] in CODE_LET:
            c[CODE_LET[m.group(2)[0]]] += 5
    for name, rx in CUES:
        c[name] += len(re.findall(rx, t)) * (1 if name not in ('총론', '창체') else 0.6)
    if not c:
        return None
    (best, n), = c.most_common(1)
    return best if n >= 1 else None


def main():
    raw, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    work = tempfile.mkdtemp()
    cur = json.load(open(os.path.join(raw, 'ncic', 'curriculum.json')))
    kice = json.load(open(os.path.join(raw, 'resources', 'kice_elementary.json')))

    # 1) 교육과정 원문: 2022 초등학교(2022.12) + 2015 초등학교 교과별 PDF
    docs = []
    for d in cur['docs']:
        school = d['school']
        if not school.startswith('초등학교') or '한국어' in d['subject']:
            continue
        era = '2022' if d['era'].startswith('2022') else '2015' if d['era'].startswith('2015') else None
        if not era:
            continue
        hwps = [f for f in d['files'] if f['ext'] == 'hwp']
        pdfs = [f for f in d['files'] if f['ext'] == 'pdf']
        if not (hwps or pdfs):
            continue
        docs.append((era, school, subj_name(d['subject']), {'hwp': hwps[0] if hwps else None, 'pdf': pdfs[0] if pdfs else None}))
    # 같은 교과에 개정판이 여럿이면 가장 앞(처음 고시) 것 + 최신 것 모두 받지 말고, 학교급 이름의 날짜가 가장 늦은 것 하나
    pick = {}
    for era, school, subj, f in docs:
        k = (era, subj)
        # 2026-11-24 고침: 2015는 처음 고시본(2015.09)을 씀 — 2018.07 일부개정본에 다른 교과(수학 측정 등) 글이 섞여 사회로 잘못 붙던 문제
        newer = school > pick[k][0] if k in pick else True
        if k not in pick or (newer if k[0] == '2022' else not newer):
            pick[k] = (school, f)
    units = []
    # 한글 → 표 글까지 바꾸기는 느려서(문서마다 1~3분) 먼저 받아 두고 4개씩 동시에
    import concurrent.futures as cf
    hwp_paths = {}
    for k, (school, ff) in pick.items():
        if ff['hwp']:
            p = os.path.join(work, f'cur_{ff["hwp"]["seq"]}.hwp')
            if download(ff['hwp']['url'], p, magic=b'\xd0\xcf\x11\xe0'):
                hwp_paths[k] = p
    with cf.ThreadPoolExecutor(4) as ex:
        hwp_texts = dict(zip(hwp_paths, ex.map(hwp_text_tables, hwp_paths.values())))
    for (era, subj), (school, ff) in sorted(pick.items()):
        t, f = '', None
        if (era, subj) in hwp_texts:
            t, f = hwp_texts[(era, subj)], ff['hwp']
        if (not t or broken(t)) and ff['pdf']:
            p = os.path.join(work, f'cur_{ff["pdf"]["seq"]}.pdf')
            if download(ff['pdf']['url'], p):
                t, f = pdf_text(p), ff['pdf']
        if not t or broken(t):
            log(f'원문 {era} {subj}: 글자를 못 읽음')
            continue
        if ff['pdf']:
            f = ff['pdf']  # 앱에서 여는 파일은 PDF
        us = split_units(t, subj, era)
        for u in us:
            u['file'] = {'name': f['name'], 'url': f['url']}
        log(f'원문 {era} {school} {subj}: 글자 {len(t)} 칸 {len(us)} (성취기준 {sum(1 for u in us if u["code"])})')
        units.extend(us)
    CODE_SUBJ = {'국': '국어', '수': '수학', '사': '사회', '과': '과학', '도': '도덕', '실': '실과', '체': '체육', '음': '음악', '미': '미술', '영': '영어', '바': '통합교과', '슬': '통합교과', '즐': '통합교과'}
    fixed = 0
    for u in units:
        m = CODE_RE.match(u['code']) if u['code'] else None
        if m and m.group(2)[0] in CODE_SUBJ and CODE_SUBJ[m.group(2)[0]] != u['subject']:
            u['subject'] = CODE_SUBJ[m.group(2)[0]]
            fixed += 1
    log('성취기준 코드로 교과 바로잡음', fixed)
    # 같은 글이 두 번 들어간 칸(통합교과 두 파일 등) 하나만
    seen_t, uniq = set(), []
    for u in units:
        k = (u['era'], u['subject'], u['text'][:120])
        if k not in seen_t:
            seen_t.add(k)
            uniq.append(u)
    units = [u for u in uniq if not (u['section'] == '앞부분' and len(u['text']) < 40)]
    for i, u in enumerate(units):
        u['id'] = i

    # 2) 기출: 초등학교 교육과정 A·B 문제지
    exams = []
    papers = {}
    for it in kice['items']:
        if it.get('kind') != '문제':
            continue
        paper = 'A' if re.search(r'교육과정\s*A', it['title']) else 'B' if re.search(r'교육과정\s*B', it['title']) else None
        if not paper:
            continue
        # 2026-11-24 고침: 초등 시험만 (유치원 추가 임용·특수학교 파일 섞이지 않게)
        if '초등' not in it['title'] or '유치원교사' in it['title']:
            continue
        f = next((x for x in it['files'] if '초등학교' in x['name'] and '특수' not in x['name'] and '유치원' not in x['name']), None)
        if not f:
            continue
        if any(e[0] == it['year'] and e[1] == paper for e in exams):
            log('같은 연도·A/B 문제지가 둘', it['year'], paper, it['title'])
            continue
        exams.append((it['year'], paper, kice['file_url'] + f['key']))
        papers[f'{it["year"]}{paper}'] = {'name': f['name'], 'url': kice['file_url'] + f['key'], 'page': kice.get('page', '')}
    questions = []
    boxes = {}
    for year, paper, url in sorted(exams):
        p = os.path.join(work, f'exam_{year}_{paper}.pdf')
        if not download(url, p):
            continue
        txt = pdf_text(p, layout=False)  # 두 단 문제지는 읽는 차례대로
        scanned = len(re.findall(r'[가-힣]', txt)) < 2000
        if scanned:
            txt = ocr_pdf(p)
            log(f'   {year} {paper}: 그림 문제지 → 글자 읽기 {len(txt)}자')
        qs = split_questions(txt)
        pl = page_lines_ocr(p) if scanned else page_lines_text(p)
        bx = boxes_from_lines(pl, 'ocr' if scanned else 'text')
        if os.environ.get('DEBUG_BOXES') == str(year):  # 진단: 번호처럼 보이는 줄 머리만 (작업 기록에만)
            for pi, lines in enumerate(pl[:4]):
                print('  쪽', pi + 1, [(round(ln[0], 3), round(ln[1], 3), ln[4][:6]) for ln in lines if re.match(r'^\W{0,2}\d{1,2}\W', ln[4])][:14])
        if not scanned and len(qs) < len(bx):
            # 번호로 못 나눈 문제지(2014 등): 찾은 문항 자리 안의 글자로 문항 글을 만듦(작업 중에만 씀)
            W_, H_ = (float(x) for x in re.search(r'Page size:\s+([\d.]+) x ([\d.]+)', subprocess.run(['pdfinfo', p], capture_output=True).stdout.decode()).groups())
            qs2 = {}
            for n, b in bx.items():
                x0, y0, x1, y1 = b['r']
                try:
                    t = subprocess.run(['pdftotext', '-f', str(b['p']), '-l', str(b['p']), '-x', str(int(x0 * W_)), '-y', str(int(y0 * H_)), '-W', str(int((x1 - x0) * W_)), '-H', str(int((y1 - y0) * H_)), '-enc', 'UTF-8', p, '-'], capture_output=True, timeout=60).stdout.decode('utf-8', 'ignore')
                except Exception:  # noqa: BLE001
                    t = ''
                if len(t.strip()) > 30:
                    qs2[n] = t
            if len(qs) < len(bx) * 0.7 and len(qs2) > len(qs):
                log(f'   {year} {paper}: 문항 자리로 나눔 {len(qs)} → {len(qs2)}')
                qs = qs2
            else:  # 빠진 번호만 자리 글로 채움(2023 B 10·11번처럼)
                add = {n: t for n, t in qs2.items() if n not in qs}
                if add:
                    log(f'   {year} {paper}: 빠진 문항 자리로 채움 {sorted(add)}')
                    qs = {**qs, **add}
        boxes[f'{year}{paper}'] = {str(k): v for k, v in bx.items()}
        log(f'기출 {year} {paper}: 문항 {len(qs)} 자리 {len(bx)}{" (OCR)" if scanned else ""} (1번 앞부분: {qs.get(1, "")[:25]})')
        if not qs:
            log('   번호 같은 줄', [ln[:15] for ln in txt.splitlines() if re.match(r'^\s*\d{1,2}\s*[.)]', ln)][:6])
        for n, t in qs.items():
            questions.append({'year': year, 'paper': paper, 'no': n, 'text': t})

    # 3) 연결: TF-IDF 비슷함 + 원문에 그대로 있는 겹친 말
    df = collections.Counter()
    utoks = []
    for u in units:
        ws = set(words(u['text']))
        utoks.append(ws)
        df.update(ws)
    N = max(len(units), 1)
    idf = {w: math.log(N / (1 + c)) + 1 for w, c in df.items()}

    def vec(ws):
        c = collections.Counter(ws)
        v = {w: (1 + math.log(n)) * idf.get(w, 0) for w, n in c.items() if w in idf}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1
        return {w: x / norm for w, x in v.items()}

    uvec = [vec(words(u['text'])) for u in units]
    subj_idx = collections.defaultdict(list)
    for i, u in enumerate(units):
        subj_idx[u['subject']].append(i)
    hits = collections.defaultdict(list)
    q_subject = []
    review = []
    for q in questions:
        qv = vec(words(q['text']))
        # 문항 교과: 가장 비슷한 칸들의 교과 다수결
        scored = sorted(((sum(qv.get(w, 0) * x for w, x in uvec[i].items()), i) for i in range(len(units))), reverse=True)[:12]
        if not scored or scored[0][0] < 0.08:
            q_subject.append({**{k: q[k] for k in ('year', 'paper', 'no')}, 'subject': None})
            continue
        vote = collections.Counter(units[i]['subject'] for s, i in scored[:6] if s > 0.05)
        subj, how = decide_subject(q['text'], vote)
        cue = how != 'vote'
        q_subject.append({**{k: q[k] for k in ('year', 'paper', 'no')}, 'subject': subj})
        review.append({**{k: q[k] for k in ('year', 'paper', 'no')}, 'subject': subj, 'how': {'code': '문항 속 성취기준 코드', 'cue': '문항 속 교과 이름(2회 이상·단독 1위)', 'vote': '원문과 비슷한 칸 다수결'}[how],
                       'cue_counts': cue_counts(q['text']), 'similar_votes': dict(vote.most_common(4)),
                       'top_units': [{'code': units[i]['code'], 'subject': units[i]['subject'], 'section': units[i]['section'], 'score': round(sc, 3)} for sc, i in scored[:5]]})
        # 2026-11-24 고침: 연결은 정한 교과 칸 안에서만 다시 순위(전체 상위 12칸에 그 교과가 없으면 연결이 0개가 되던 문제)
        same = sorted(((sum(qv.get(w, 0) * x for w, x in uvec[i].items()), i) for i in subj_idx.get(subj, [])), reverse=True)[:8]
        linked = 0
        for k_, (s, i) in enumerate(same):
            if s < 0.1:
                break
            spans = shared_phrases(q['text'], units[i]['text'])
            if s >= 0.18 or spans or (k_ == 0 and s >= 0.1):  # 가장 비슷한 칸 하나는 0.1 이상이면 이음(약한 연결)
                hits[i].append({'y': q['year'], 'p': q['paper'], 'n': q['no'], 's': round(s, 3), 'h': spans[:12]})
                linked += 1

    # 4) 통계
    by_subject_year = collections.defaultdict(lambda: collections.Counter())
    for x in q_subject:
        if x['subject']:
            by_subject_year[x['subject']][x['year']] += 1
    sec_share = collections.defaultdict(collections.Counter)
    for i, hs in hits.items():
        u = units[i]
        sec_share[u['subject']][u['section']] += len(hs)
    term_years = collections.defaultdict(lambda: collections.defaultdict(collections.Counter))
    # 교과다운 말만: 그 교과 원문에서 다른 교과보다 두드러지게 많이 쓰는 말(비중 25% 이상) — '우리·시간' 같은 흔한 말 빼기
    cur_tf = collections.defaultdict(collections.Counter)
    for u in units:
        cur_tf[u['subject']].update(words(u['text']))
    all_tf = collections.Counter()
    for c in cur_tf.values():
        all_tf.update(c)

    def subject_term(subj, w):
        n = cur_tf[subj][w]
        return n >= 2 and nounish(w) and n / all_tf[w] >= 0.25
    for q, x in zip(questions, q_subject):
        if not x['subject']:
            continue
        for w in set(words(q['text'])):
            if subject_term(x['subject'], w):
                term_years[x['subject']][w][q['year']] += 1
    top_terms = {}
    for subj, tw in term_years.items():
        ranked = sorted(tw.items(), key=lambda kv: (-sum(kv[1].values()), kv[0]))[:40]
        top_terms[subj] = [{'term': w, 'total': sum(c.values()), 'years': dict(sorted(c.items()))} for w, c in ranked]
    # 2026-11-24 사용자 요청: 핵심어는 단순히 자주 나온 말이 아니라 '꼭 공부해야 할 핵심 개념' 위주로
    # → 2022 개정 교육과정 '내용 체계'의 내용 요소(교육과정이 정한 핵심 개념)가 그 교과 문항에 나온 횟수.
    #   (평가원은 초등 교육과정 A·B 정답을 공개하지 않아(모은 목록 기준) 정답 글은 쓸 수 없음)
    cs_path = os.path.join(raw, 'curriculum', 'content_system_elementary.json')
    concepts = collections.defaultdict(dict)  # 교과 → 띄어쓰기 없앤 말 → (보이는 말, 영역, 범주)
    fuzzy = collections.defaultdict(dict)  # 긴 항목: 핵심 낱말이 모두 문항에 있으면 나온 것으로(예: '중심 생각 파악하기')
    if os.path.exists(cs_path):
        for sj in json.load(open(cs_path))['subjects']:
            name = subj_name(sj['subject'])
            for ar in sj['areas']:
                for row in ar['rows']:
                    if row['cat'].startswith('가치'):
                        continue  # 흥미·태도 같은 말은 문항 근거로 약함
                    know = row['cat'].startswith('지식')
                    for cell in row['cells']:
                        for it in cell['items']:
                            # 지식·이해: 항목과 쉼표로 나눈 낱말 / 과정·기능: 항목 통째로만('예상·분석' 같은 일반 동사 낱말 빼기), 끝의 '하기' 떼고 5글자 이상
                            parts = {it, *re.split(r'\s*,\s*', it)} if know else {re.sub(r'\s*하기$', '', it)}
                            if not know or len(it) > 10:
                                toks = [w for w in words(re.sub(r'\s*하기$', '', it)) if len(w) >= 2]
                                if len(toks) >= 2:
                                    fuzzy[name][re.sub(r'[\s·]', '', it)] = (it, ar['area'].split(' · ')[-1], row['cat'], set(toks))
                            for part in parts:
                                if not know and len(re.sub(r'\s', '', part)) < 5:
                                    continue
                                part = re.sub(r'\s+', ' ', part).strip(' ·')
                                k = re.sub(r'[\s·]', '', part)
                                if 2 <= len(k) <= 14 and k not in concepts[name]:
                                    concepts[name][k] = (part, ar['area'].split(' · ')[-1], row['cat'])
    qdf = collections.Counter()
    qnorm = [re.sub(r'[\s·ㆍ]', '', q['text']) for q in questions]
    for name, cmap in concepts.items():
        for k in cmap:
            qdf[k] = max(qdf[k], sum(1 for t in qnorm if k in t))
    concept_terms = {}
    for name, cmap in concepts.items():
        cy = collections.defaultdict(collections.Counter)
        for q, x, t in zip(questions, q_subject, qnorm):
            if x['subject'] != name:
                continue
            for k, (disp, area, cat) in cmap.items():
                if k in t and qdf[k] <= max(8, len(questions) * 0.12):  # 거의 모든 문항에 나오는 '대화·발표' 같은 상황 말은 뺌
                    cy[k][q['year']] += 1
            qw = set(words(q['text']))
            for k, (disp, area, cat, toks) in fuzzy.get(name, {}).items():
                if k not in cmap and toks <= qw:
                    cmap[k] = (disp, area, cat)
                    cy[k][q['year']] += 1
                elif k in cmap and toks <= qw and k not in t:
                    cy[k][q['year']] += 1
        ranked = sorted(cy.items(), key=lambda kv: (-sum(kv[1].values()), -len(kv[0])))[:40]
        if ranked:
            concept_terms[name] = [{'term': cmap[k][0], 'area': cmap[k][1], 'cat': cmap[k][2], 'total': sum(c.values()), 'years': dict(sorted(c.items()))} for k, c in ranked]
    log('핵심 개념(내용 요소) 교과', {k: len(v) for k, v in concept_terms.items()})
    if concept_terms:
        top_terms = concept_terms
    years = sorted({q['year'] for q in questions})
    recent = [y for y in years if y >= (max(years) - 4 if years else 0)]
    untouched = collections.defaultdict(list)
    for i, u in enumerate(units):
        if u['code'] and u['era'] == '2022':
            hs = [h for h in hits.get(i, []) if h['y'] in recent]
            if not hs:
                untouched[u['subject']].append({'code': u['code'], 'area': u['area'], 'id': i})
    v15 = set().union(*[words(u['text']) for u in units if u['era'] == '2015']) if any(u['era'] == '2015' for u in units) else set()
    new_terms = collections.defaultdict(list)
    seen_terms = set()
    for q in questions:
        seen_terms.update(words(q['text']))
    tf22 = collections.defaultdict(collections.Counter)
    for u in units:
        if u['era'] == '2022':
            tf22[u['subject']].update(words(u['text']))
    for subj, c in tf22.items():
        # 2015에 없던 말 중 2022 원문에 2번 이상 나오고, 그 교과다운 말(많이 나온 순)
        cand = [w for w, n in c.most_common() if n >= 2 and len(w) >= 3 and w not in v15 and w not in seen_terms and subject_term(subj, w)]
        new_terms[subj] = cand

    subjects = sorted({u['subject'] for u in units}, key=lambda x: -sum(len(hits.get(u['id'], [])) for u in units if u['subject'] == x))
    files = {}
    os.makedirs(os.path.join(out, 'elementary'), exist_ok=True)
    for k, subj in enumerate(subjects):
        su = [u for u in units if u['subject'] == subj]
        fn = f's{k}.json'
        files[subj] = fn
        json.dump({'subject': subj,
                   'units': [{kk: u[kk] for kk in ('id', 'subject', 'era', 'section', 'area', 'code', 'text')} | {'file': u.get('file')} for u in su],
                   'hits': {str(u['id']): hits[u['id']] for u in su if u['id'] in hits}},
                  open(os.path.join(out, 'elementary', fn), 'w'), ensure_ascii=False)
    def snippet(i):
        return re.sub(r'\s+', ' ', units[i]['text'].replace(units[i]['code'], '')).strip()[:100]
    # 사람이 넣은 자리(2014·2015 스캔본 고치기 등)가 자동 값보다 먼저
    man = manual_boxes()
    for key, qs in man.items():
        boxes.setdefault(key, {}).update(qs)
    log('문항 자리: 자동', sum(1 for v in boxes.values() for b in v.values() if b['src'] != 'manual'), '수동', sum(len(v) for v in man.values()))
    result = {
        'level': 'elementary',
        'built': time.strftime('%Y-%m-%d'),
        'note': '자동 분석(참고용). 교육과정 원문은 NCIC 고시문, 기출은 평가원 공개 문제지. 문항 글은 담지 않음.',
        'years': years,
        'subjects': [{'name': s_, 'file': files[s_], 'units': sum(1 for u in units if u['subject'] == s_),
                      'hit_units': sum(1 for u in units if u['subject'] == s_ and u['id'] in hits)} for s_ in subjects],
        'questions': q_subject,
        'papers': papers,  # 연도A/B → 분석에 쓴 평가원 문제지(초등학교) 파일 — 앱이 같은 파일을 열게
        'boxes': boxes,  # 문항 위치만(쪽·비율). 그림·글은 없음
        'stats': {
            'subject_year': {s_: dict(sorted(c.items())) for s_, c in by_subject_year.items()},
            'section_share': {s_: dict(c) for s_, c in sec_share.items()},
            'top_terms': top_terms,
            'untouched_recent5': {s_: [x | {'text': snippet(x['id'])} for x in v] for s_, v in untouched.items()},
            'new_terms_2022': {s_: v[:60] for s_, v in new_terms.items()},
        },
    }
    json.dump(result, open(os.path.join(out, 'elementary.json'), 'w'), ensure_ascii=False)
    # 이중 검토용(문항 글 없음): 문항마다 교과 판정 근거·연결된 성취기준
    for r in review:
        k = f"{r['year']}{r['paper']}"
        r['paper_file'] = papers.get(k, {}).get('name')
        r['paper_url'] = papers.get(k, {}).get('url')
        r['box'] = boxes.get(k, {}).get(str(r['no']))
        r['linked'] = sorted(({'code': units[i]['code'] or units[i]['section'], 'subject': units[i]['subject'], 'era': units[i]['era'], 'score': h['s'], 'text': re.sub(r'\s+', ' ', units[i]['text'])[:120]}
                              for i, hs in hits.items() for h in hs if h['y'] == r['year'] and h['p'] == r['paper'] and h['n'] == r['no']), key=lambda x: -x['score'])[:8]
    json.dump(review, open(os.path.join(out, 'elementary_review.json'), 'w'), ensure_ascii=False)
    json.dump(LOG, open(os.path.join(out, 'elementary_log.json'), 'w'), ensure_ascii=False, indent=0)
    log(f'끝: 원문 칸 {len(units)}, 문항 {len(questions)}, 교과 판정 {sum(1 for x in q_subject if x["subject"])}, 연결 {sum(len(v) for v in hits.values())}')


if __name__ == '__main__':
    main()
