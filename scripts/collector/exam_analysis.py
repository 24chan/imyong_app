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
# 문항 그림은 저장하지 않고 '몇 쪽, 어디부터 어디까지'(쪽 크기에 대한 비율) 숫자만 남김.
# 앱이 평가원 원본 PDF를 받아 그 부분만 잘라 보여 줌.
_LINE_RE = re.compile(r'<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</line>', re.S)
_PAGE_RE = re.compile(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', re.S)
_WORD_RE = re.compile(r'<word[^>]*>(.*?)</word>', re.S)
_QSTART = re.compile(r'^(\d{1,2})\s*[.．]')


def question_boxes(path):
    """PDF 글자 위치(pdftotext -bbox-layout)로 문항 번호 줄을 찾아 문항마다 [쪽(1부터), x0, y0, x1, y1] (0~1 비율)"""
    try:
        xml = subprocess.run(['pdftotext', '-bbox-layout', path, '-'], capture_output=True, timeout=180, check=True).stdout.decode('utf-8', 'ignore')
    except Exception as e:  # noqa: BLE001
        log('글자 위치 읽기 실패', path, str(e)[:80])
        return {}
    pages = []
    for pi, (w, h, body) in enumerate(_PAGE_RE.findall(xml)):
        W, H = float(w), float(h)
        lines = []
        for x0, y0, x1, y1, inner in _LINE_RE.findall(body):
            t = ' '.join(_WORD_RE.findall(inner)).strip()
            if t:
                lines.append((float(x0), float(y0), float(x1), float(y1), t))
        two = sum(1 for ln in lines if ln[0] > W * 0.5) > 8 and sum(1 for ln in lines if ln[0] < W * 0.48 and ln[2] > W * 0.52) < len(lines) * 0.15
        pages.append((pi + 1, W, H, lines, two))
    # 번호 줄 후보: (쪽, 단, y, 번호)
    cands = []
    for pg, W, H, lines, two in pages:
        for x0, y0, x1, y1, t in lines:
            m = _QSTART.match(t)
            if not m or y0 > H * 0.95:
                continue
            col = 1 if (two and x0 > W * 0.5) else 0
            left = W * 0.5 if col else 0
            if x0 - left > W * 0.12:  # 줄 맨 앞(단 왼쪽)에 있는 번호만
                continue
            cands.append((pg, col, y0, int(m.group(1))))
    cands.sort()
    # 1부터 차례로 이어지는 번호만 (중간 '1.' 같은 보기 번호 거르기). 가장 긴 줄기를 고름
    best = []
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
    info = {pg: (W, H, lines, two) for pg, W, H, lines, two in pages}
    out = {}
    for k, (pg, col, y, n) in enumerate(best):
        W, H, lines, two = info[pg]
        lo, hi = (W * 0.5, W) if (two and col) else (0, W * 0.5 if two else W)
        nxt = best[k + 1] if k + 1 < len(best) else None
        body = [ln for ln in lines if ln[1] >= y - 1 and ln[1] < H * 0.95 and lo - 2 <= ln[0] < hi]
        if nxt and nxt[0] == pg and nxt[1] == col:
            body = [ln for ln in body if ln[1] < nxt[2] - 1]
        if not body:
            continue
        x0 = max(0.0, min(ln[0] for ln in body) - 8)
        x1 = min(W, max(ln[2] for ln in body) + 8)
        y0 = max(0.0, y - 8)
        y1 = min(H, max(ln[3] for ln in body) + 10)
        if nxt and nxt[0] == pg and nxt[1] == col:
            y1 = max(y1, min(H, nxt[2] - 4))  # 그림·표(글자 없는 부분)도 다음 번호 앞까지 포함
        out[n] = [pg, round(x0 / W, 4), round(y0 / H, 4), round(x1 / W, 4), round(y1 / H, 4)]
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
        if k not in pick or school > pick[k][0]:
            pick[k] = (school, f)
    units = []
    for (era, subj), (school, ff) in sorted(pick.items()):
        t, f = '', None
        if ff['hwp']:
            p = os.path.join(work, f'cur_{ff["hwp"]["seq"]}.hwp')
            if download(ff['hwp']['url'], p, magic=b'\xd0\xcf\x11\xe0'):
                t, f = hwp_text(p), ff['hwp']
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
    for it in kice['items']:
        if it.get('kind') != '문제':
            continue
        paper = 'A' if re.search(r'교육과정\s*A', it['title']) else 'B' if re.search(r'교육과정\s*B', it['title']) else None
        if not paper:
            continue
        f = next((x for x in it['files'] if '초등학교' in x['name']), None)
        if not f:
            continue
        exams.append((it['year'], paper, kice['file_url'] + f['key']))
    questions = []
    boxes = {}
    for year, paper, url in sorted(exams):
        p = os.path.join(work, f'exam_{year}_{paper}.pdf')
        if not download(url, p):
            continue
        txt = pdf_text(p, layout=False)  # 두 단 문제지는 읽는 차례대로
        if len(re.findall(r'[가-힣]', txt)) < 2000:
            txt = ocr_pdf(p)
            log(f'   {year} {paper}: 그림 문제지 → 글자 읽기 {len(txt)}자')
        qs = split_questions(txt)
        bx = question_boxes(p)
        boxes[f'{year}{paper}'] = {str(k): v for k, v in bx.items()}
        log(f'기출 {year} {paper}: 문항 {len(qs)} 위치 {len(bx)} (1번 앞부분: {qs.get(1, "")[:25]})')
        if year in (2019, 2024) and bx:  # 확인용 작은 그림(문항 2개)
            dbg = os.path.join(out, 'debug')
            os.makedirs(dbg, exist_ok=True)
            for n in list(bx)[:2]:
                pg, a, b, c, d = bx[n]
                try:
                    W, H = (float(x) for x in re.search(r'Page size:\s+([\d.]+) x ([\d.]+)', subprocess.run(['pdfinfo', p], capture_output=True).stdout.decode()).groups())
                    r = 50 / 72
                    subprocess.run(['pdftoppm', '-f', str(pg), '-l', str(pg), '-r', '50', '-png', '-singlefile', '-x', str(int(a * W * r)), '-y', str(int(b * H * r)), '-W', str(int((c - a) * W * r)), '-H', str(int((d - b) * H * r)), p, os.path.join(dbg, f'{year}{paper}_{n}')], timeout=60)
                except Exception as e:  # noqa: BLE001
                    log('확인 그림 실패', e)
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
    hits = collections.defaultdict(list)
    q_subject = []
    for q in questions:
        qv = vec(words(q['text']))
        # 문항 교과: 가장 비슷한 칸들의 교과 다수결
        scored = sorted(((sum(qv.get(w, 0) * x for w, x in uvec[i].items()), i) for i in range(len(units))), reverse=True)[:12]
        if not scored or scored[0][0] < 0.08:
            q_subject.append({**{k: q[k] for k in ('year', 'paper', 'no')}, 'subject': None})
            continue
        subj = cue_subject(q['text']) or collections.Counter(units[i]['subject'] for s, i in scored[:6] if s > 0.05).most_common(1)[0][0]
        q_subject.append({**{k: q[k] for k in ('year', 'paper', 'no')}, 'subject': subj})
        for s, i in scored:
            if units[i]['subject'] != subj or s < 0.12:
                continue
            spans = shared_phrases(q['text'], units[i]['text'])
            if s >= 0.2 or spans:
                hits[i].append({'y': q['year'], 'p': q['paper'], 'n': q['no'], 's': round(s, 3), 'h': spans[:12]})

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
    result = {
        'level': 'elementary',
        'built': time.strftime('%Y-%m-%d'),
        'note': '자동 분석(참고용). 교육과정 원문은 NCIC 고시문, 기출은 평가원 공개 문제지. 문항 글은 담지 않음.',
        'years': years,
        'subjects': [{'name': s_, 'file': files[s_], 'units': sum(1 for u in units if u['subject'] == s_),
                      'hit_units': sum(1 for u in units if u['subject'] == s_ and u['id'] in hits)} for s_ in subjects],
        'questions': q_subject,
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
    json.dump(LOG, open(os.path.join(out, 'elementary_log.json'), 'w'), ensure_ascii=False, indent=0)
    log(f'끝: 원문 칸 {len(units)}, 문항 {len(questions)}, 교과 판정 {sum(1 for x in q_subject if x["subject"])}, 연결 {sum(len(v) for v in hits.values())}')


if __name__ == '__main__':
    main()
