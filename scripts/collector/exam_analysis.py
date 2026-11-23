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


def download(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return True
    for i in range(3):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=120)
            data = r.read()
            if data[:4] != b'%PDF':
                log('PDF 아님', url[:120], data[:60])
                return False
            open(path, 'wb').write(data)
            time.sleep(0.8)
            return True
        except Exception as e:  # noqa: BLE001
            log('받기 실패', i, url[:120], str(e)[:100])
            time.sleep(3 * (i + 1))
    return False


def pdf_text(path):
    try:
        out = subprocess.run(['pdftotext', '-layout', '-enc', 'UTF-8', path, '-'], capture_output=True, timeout=180, check=True).stdout
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
    ('교수·학습', re.compile(r'^\s*(?:가\.|3\.|4\.)?\s*교수\s*[·ㆍ\.]?\s*학습(?!\s*및\s*평가\s*$)')),
    ('교수·학습 및 평가', re.compile(r'^\s*3\.\s*교수\s*[·ㆍ]?\s*학습\s*및\s*평가')),
    ('평가', re.compile(r'^\s*(?:나\.|4\.|5\.)?\s*평\s*가\s*$')),
]
CODE_RE = re.compile(r'\[(\d{1,2})([가-힣]{1,3})(\d{2})\s*-\s*(\d{2})\]')


def split_units(text, subject, era):
    """원문 글 → 칸 목록. 성취기준은 코드 하나가 한 칸, 나머지는 문단 묶음(최대 600자)"""
    units, sec, buf = [], '앞부분', []
    area = ''

    def flush():
        t = re.sub(r'\s+', ' ', ' '.join(buf)).strip()
        if len(t) >= 20:
            units.append({'subject': subject, 'era': era, 'section': sec, 'area': area, 'code': '', 'text': t})
        buf.clear()

    lines = [ln.rstrip() for ln in text.splitlines()]
    for ln in lines:
        s = ln.strip()
        if not s or re.fullmatch(r'[-\d\s]+', s):
            continue
        hit = next((name for name, rx in SEC_RE if rx.match(s) and len(s) < 30), None)
        if hit:
            flush()
            sec = '교수·학습 및 평가' if hit == '교수·학습 및 평가' else hit
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
            code = cm.group(0).replace(' ', '')
            units.append({'subject': subject, 'era': era, 'section': '성취기준', 'area': area, 'code': code, 'text': s[cm.start():]})
            continue
        if units and units[-1]['code'] and not buf and sec == '성취기준' and len(units[-1]['text']) < 400 and not s.startswith(('(', '[', '①')):
            units[-1]['text'] += ' ' + s  # 성취기준 문장이 줄바꿈으로 이어짐
            continue
        buf.append(s)
        if sum(len(b) for b in buf) > 600:
            flush()
    flush()
    return units


# ---------- 기출 문항 나누기 ----------
Q_RE = re.compile(r'^\s{0,6}(\d{1,2})\s*\.\s+\S')


def split_questions(text):
    """기출 글 → {번호: 글}. 1번부터 차례로 나오는 번호만 문항 시작으로 봄"""
    qs, cur, want = {}, None, 1
    for ln in text.splitlines():
        m = Q_RE.match(ln)
        if m and int(m.group(1)) == want:
            cur = want
            want += 1
            qs[cur] = ln[m.end() - 1:]
            continue
        if cur:
            qs[cur] += '\n' + ln
    return {k: re.sub(r'\s+', ' ', v) for k, v in qs.items()}


# ---------- 말 나누기 (형태소 분석기 없이: 한글 덩어리에서 조사 떼기) ----------
JOSA = re.compile(r'(으로서|으로써|에서는|에게서|으로는|이라는|라는|에서|에게|으로|까지|부터|처럼|보다|하고|이며|이고|이다|과의|와의|으로|을|를|이|가|은|는|에|의|와|과|도|로|만|며|고|다)$')
STOP = set('그리고 그러나 다음 다음은 위의 아래 것을 것은 경우 대한 대하여 관련 내용 활동 학생 학생들 교사 학습 수업 지도 제시 설명 쓰시오 서술하시오 고르시오 무엇 어떤 각각 하나 이를 이와 같은 또는 및 등을 등 해당 바탕 통해 위해 따라 있는 있다 한다 하는 하여 한다 점수 점 자료 가 나 다 라 마 바 사 아 자 차 카 타 파 하 ㉠ ㉡ ㉢ ㉣'.split())


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
        if not school.startswith('초등학교'):
            continue
        era = '2022' if d['era'].startswith('2022') else '2015' if d['era'].startswith('2015') else None
        if not era:
            continue
        pdfs = [f for f in d['files'] if f['ext'] == 'pdf']
        if not pdfs:
            continue
        docs.append((era, school, d['subject'], pdfs[0]))
    # 같은 교과에 개정판이 여럿이면 가장 앞(처음 고시) 것 + 최신 것 모두 받지 말고, 학교급 이름의 날짜가 가장 늦은 것 하나
    pick = {}
    for era, school, subj, f in docs:
        k = (era, subj)
        if k not in pick or school > pick[k][0]:
            pick[k] = (school, f)
    units = []
    for (era, subj), (school, f) in sorted(pick.items()):
        p = os.path.join(work, f'cur_{f["seq"]}.pdf')
        if not download(f['url'], p):
            continue
        t = pdf_text(p)
        us = split_units(t, subj, era)
        for u in us:
            u['file'] = {'name': f['name'], 'url': f['url']}
        log(f'원문 {era} {school} {subj}: 글자 {len(t)} 칸 {len(us)} (성취기준 {sum(1 for u in us if u["code"])})')
        units.extend(us)
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
    for year, paper, url in sorted(exams):
        p = os.path.join(work, f'exam_{year}_{paper}.pdf')
        if not download(url, p):
            continue
        qs = split_questions(pdf_text(p))
        log(f'기출 {year} {paper}: 문항 {len(qs)}')
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
        subj = collections.Counter(units[i]['subject'] for s, i in scored[:6] if s > 0.05).most_common(1)[0][0]
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
    cur_vocab = collections.defaultdict(set)
    for u in units:
        cur_vocab[u['subject']].update(words(u['text']))
    for q, x in zip(questions, q_subject):
        if not x['subject']:
            continue
        for w in set(words(q['text'])):
            if w in cur_vocab[x['subject']] and len(w) >= 3:
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
    for u in units:
        if u['era'] != '2022':
            continue
        for w in set(words(u['text'])):
            if len(w) >= 4 and w not in v15 and w not in seen_terms and w not in new_terms[u['subject']]:
                new_terms[u['subject']].append(w)

    result = {
        'level': 'elementary',
        'built': time.strftime('%Y-%m-%d'),
        'note': '자동 분석(참고용). 교육과정 원문은 NCIC 고시문, 기출은 평가원 공개 문제지. 문항 글은 담지 않음.',
        'years': years,
        'units': [{k: u[k] for k in ('id', 'subject', 'era', 'section', 'area', 'code', 'text')} | {'file': u.get('file')} for u in units],
        'hits': {str(i): hs for i, hs in hits.items()},
        'questions': q_subject,
        'stats': {
            'subject_year': {s: dict(sorted(c.items())) for s, c in by_subject_year.items()},
            'section_share': {s: dict(c) for s, c in sec_share.items()},
            'top_terms': top_terms,
            'untouched_recent5': dict(untouched),
            'new_terms_2022': {s: v[:60] for s, v in new_terms.items()},
        },
    }
    json.dump(result, open(os.path.join(out, 'elementary.json'), 'w'), ensure_ascii=False)
    json.dump(LOG, open(os.path.join(out, 'elementary_log.json'), 'w'), ensure_ascii=False, indent=0)
    log(f'끝: 원문 칸 {len(units)}, 문항 {len(questions)}, 교과 판정 {sum(1 for x in q_subject if x["subject"])}, 연결 {sum(len(v) for v in hits.values())}')


if __name__ == '__main__':
    main()
