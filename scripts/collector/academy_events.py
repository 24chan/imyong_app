"""학원 일정 자동 수집 (2026-11-23 사용자 요청: 2차 대비·개강·모의고사·설명회 등, 초등·중등)
학원 누리집 첫 화면 + 공지/이벤트/설명회 목록에서 '날짜 + 종류 말'이 함께 있는 제목만 골라 일정으로 만든다.
- 날짜는 요일이 맞아야(예: 12/4(금)) 또는 'N월 N일' 꼴일 때만 믿음 → 엉뚱한 숫자 거름
- 오늘 기준 지난 7일 ~ 앞으로 300일 안의 날짜만
- 저장: 학원 이름·제목·날짜·종류·초등/중등·과목·공지 주소(사실만). 홍보 문구(★, 할인 등)는 지움
사용: python academy_events.py <out_dir> [--apply]   (--apply 이면 Supabase academy_events에 넣고 갱신)"""
import datetime as dt
import html as htmllib
import json
import os
import re
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import crawl  # noqa: E402

crawl.DELAY[0] = 1.0
KST = dt.timezone(dt.timedelta(hours=9))
TODAY = dt.datetime.now(KST).date()

# level: None = 초등·중등 모두 다루는 곳(글에 초등/중등 말이 없으면 둘 다로)
SITES = [
    {'code': 'hackers', 'name': '해커스임용', 'home': 'https://teacher.hackers.com/', 'level': None,
     'extra': ['https://mteacher.hackers.com/bbs/notice/main/notice_main_list', 'https://mteacher.hackers.com/bbs/lec_plan/main/lec_plan_main_list']},
    {'code': 'gschool', 'name': 'G스쿨', 'home': 'https://www.g-school.co.kr/', 'level': 'secondary',
     'extra': ['https://m.g-school.co.kr/customer/list.jsp?board_cate_code=GBC5', 'https://m.g-school.co.kr/customer/list.jsp?board_cate_code=GBC4']},
    {'code': 'ssamplus', 'name': 'KG에듀원 희소·쌤플러스', 'home': 'https://www.ssamplus.com/', 'level': None},
    {'code': 'pmg', 'name': '박문각임용', 'home': 'https://www.pmg.co.kr/', 'level': None, 'mixed': True},
    {'code': 'imyongcom', 'name': '임용닷컴', 'home': 'https://www.imyong.com/', 'level': None},
]
FOLLOW = re.compile(r'공지|이벤트|설명회|개강|강의\s*일정|모의고사|특강|notice|event', re.I)
KIND = [  # 앞에 있는 것이 먼저
    ('mock', re.compile(r'모의고사|모의평가|전국\s*모의')),
    ('briefing', re.compile(r'설명회')),
    ('online', re.compile(r'인강\s*오픈|온라인\s*오픈|강의\s*오픈|OPEN', re.I)),
    ('open', re.compile(r'개강')),
    ('special', re.compile(r'특강|클리닉|캠프')),
    ('open', re.compile(r'대비반|모집|직강|합격반')),
]
SECOND = re.compile(r'2차|면접|수업\s*실연|수업\s*나눔|지도안|심층')
SUBJECTS = [('korean', '국어'), ('english', '영어'), ('math', '수학'), ('social', '일반사회'), ('history', '역사'),
            ('geography', '지리'), ('ethics', '도덕|윤리'), ('physics', '물리'), ('chemistry', '화학'), ('biology', '생물'),
            ('earth', '지구과학'), ('pe', '체육'), ('music', '음악'), ('art', '미술'), ('tech', '기술'), ('homeec', '가정'),
            ('info', '정보|컴퓨터'), ('hanmun', '한문'), ('japanese', '일본어'), ('chinese', '중국어'), ('health', '보건'),
            ('counsel', '전문상담'), ('librarian', '사서'), ('nutrition', '영양'), ('special', '특수')]
WD = '월화수목금토일'
DATE = re.compile(
    r'(?:(20\d{2})\s*[.\-/년]\s*)?(\d{1,2})\s*(?:[./]|월\s*)\s*(\d{1,2})\s*일?\s*(?:\(\s*([월화수목금토일])\s*\))?')
NOISE = re.compile(r'[★☆♥♡◆◇■□▶▷●○※✔✅🔥💯👏📢]+|\s*(?:안내|공지)\s*$|\bNEW\b|할인|이벤트\s*진행|무료\s*(?=설명회)', re.I)


def clean(s):
    s = htmllib.unescape(re.sub(r'<[^>]+>', ' ', s))
    return re.sub(r'\s+', ' ', s).strip()


def texts(html, base):
    """링크 글자·이미지 대체 글자·title 속성 + 링크 주소"""
    out = []
    for m in re.finditer(r'<a\b([^>]*)>(.*?)</a>', html, re.S | re.I):
        attrs, inner = m.group(1), m.group(2)
        href = re.search(r'href\s*=\s*["\']([^"\']+)', attrs)
        if href:
            hv = htmllib.unescape(href.group(1))
            if hv.startswith('//'):
                hv = 'https:' + hv
            href = re.match(r'(.*)', hv)
        url = urllib.parse.urljoin(base, href.group(1)) if href and not href.group(1).startswith(('javascript', '#', 'mailto')) else base
        bits = [clean(inner)]
        bits += [clean(x) for x in re.findall(r'alt\s*=\s*["\']([^"\']{6,})', inner)]
        t = re.search(r'title\s*=\s*["\']([^"\']{6,})', attrs)
        if t:
            bits.append(clean(t.group(1)))
        for b in bits:
            if 6 <= len(b) <= 140:
                out.append((b, url))
    return out


def pick_date(s, first=False):
    """요일이 맞는 날짜(또는 'N월 N일')를 오늘 기준 -7~+300일 안에서 고름.
    여러 개면 요일 있는 것 → 종류 말(개강·설명회…)에 가까운 것"""
    kpos = [m.start() for _, rx in KIND for m in rx.finditer(s)]
    cands = []
    for m in DATE.finditer(s):
        y, mo, d, w = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4)
        korean = '월' in m.group(0) and '일' in m.group(0)
        near = re.match(r'\s*(?:\)|일)?\s*(?:[-~]\s*)?(?:개강|진행|시행|오픈|OPEN|시작|설명회|특강|모의고사)', s[m.end():m.end() + 12], re.I)
        if not (1 <= mo <= 12 and 1 <= d <= 31) or not (w or korean or near):
            continue
        years = [int(y)] if y else [TODAY.year - 1, TODAY.year, TODAY.year + 1]
        for yy in years:
            try:
                day = dt.date(yy, mo, d)
            except ValueError:
                continue
            if w and WD[day.weekday()] != w:
                continue
            if -7 <= (day - TODAY).days <= 300:
                dist = min((abs(k - m.end()) for k in kpos), default=999)
                cands.append((0 if w else 1, dist, day, m))
                break
    if not cands:
        return None, None
    cands.sort(key=(lambda c: c[3].start()) if first else (lambda c: (c[0], c[1])))
    return cands[0][2], cands[0][3]


SKIP = re.compile(r'유아|유치원|공무원|소방|경찰|간호|노무|감평|세무|중개사|주택관리|법원|등기|7급|9급|편입|마감\s*임박|당첨|후기\s*이벤트|성적|순위|정오|발송|배송|OMR|장학생|강사\s*모집|적중|결제|내\s*강의실|이용\s*방법|FAQ|사이트', re.I)
TEACH = re.compile(r'임용|초등|중등|교육학|전공|교원|교사|2차|수업\s*실연|면접')


def classify(title, site, url=''):
    if SKIP.search(title):
        return None
    if site.get('mixed') and not (TEACH.search(title) or '/pta/' in url.lower()):
        return None  # 여러 시험을 같이 다루는 곳(박문각): 임용 글만
    kind = next((k for k, rx in KIND if rx.search(title)), None)
    if not kind:
        return None
    if re.search(r'초등', title):
        levels = ['elementary']
    elif re.search(r'중등|교육학|전공', title) or site['level'] == 'secondary':
        levels = ['secondary']
    else:
        levels = ['elementary', 'secondary']
    subject = None
    if levels == ['secondary'] or 'secondary' in levels:
        for code, pat in SUBJECTS:
            if re.search(pat, title):
                subject = code
                levels = ['secondary']
                break
    return kind, levels, subject


BODY_KEY = re.compile(r'개강일?|일\s*시|일\s*정|진행일?|시행일?|날\s*짜|기\s*간|오픈|시작')


def body_date(html):
    """글 본문에서 '개강일: 11월 30일(월)'처럼 열쇠말 가까이 있는 날짜"""
    text = clean(re.sub(r'<(script|style)\b.*?</\1>', ' ', html, flags=re.S | re.I))
    for km in BODY_KEY.finditer(text):
        seg = text[km.start():km.start() + 40]
        day, _ = pick_date(seg, first=True)
        if day:
            return day
    return None


def tidy(title, m):
    t = NOISE.sub(' ', title)
    t = re.sub(r'\s*[-–~:]\s*$', '', t)
    t = re.sub(r'\s+', ' ', t).strip(' -–!~')
    return t[:80]


def collect():
    found, pages_log, cands = {}, [], []

    def add(site, t, u, day, m, c, ptitle):
        if not c:
            return
        kind, levels, subject = c
        title = tidy(t, m)
        core = re.sub(r'[\d/.()월화수목금토일\s]|개강|설명회|신청|하기|바로가기|모의고사|특강', '', title)
        if len(core) < 6 and ptitle:
            title = (ptitle + ' · ' + title)[:80]
        for lv in levels:
            key = f"{site['code']}|{day}|{kind}|{lv}|{re.sub(r'[^가-힣A-Za-z0-9]', '', title)[:40]}"
            found.setdefault(key, {
                'source_key': key, 'academy': site['name'], 'kind': kind, 'title': title,
                'starts_on': day.isoformat(), 'level': lv, 'area': 'second' if SECOND.search(t) else None,
                'subject_code': subject, 'url': u, 'raw': t,
            })
    for site in SITES:
        try:
            base, html = crawl.get(site['home'])
        except Exception as e:  # noqa: BLE001
            pages_log.append({'site': site['code'], 'url': site['home'], 'error': str(e)[:200]})
            continue
        pages = [(base, html)]
        host = urllib.parse.urlparse(base).netloc.split(':')[0].removeprefix('www.')
        follow = []
        for t, u in texts(html, base):
            if FOLLOW.search(t) and host in u and u not in follow and u != base:
                follow.append(u)
        for u in site.get('extra', []) + follow[:12]:
            try:
                pages.append(crawl.get(u, referer=base))
            except Exception as e:  # noqa: BLE001
                pages_log.append({'site': site['code'], 'url': u, 'error': str(e)[:200]})
        undated = []
        for purl, phtml in pages:
            items = texts(phtml, purl)
            ptitle = clean((re.search(r'<title[^>]*>(.*?)</title>', phtml, re.S | re.I) or re.match(r'()', '')).group(1))[:60]
            pages_log.append({'site': site['code'], 'url': purl, 'links': len(items)})
            for t, u in items:
                if any(rx.search(t) for _, rx in KIND) and not SKIP.search(t):
                    cands.append({'site': site['code'], 'text': t, 'url': u})
                day, m = pick_date(t)
                c = classify(t, site, u)
                if not day:
                    if c and host in u and u != purl and re.search(r'2028|2차|설명회|개강', t) and u not in [x[1] for x in undated]:
                        undated.append((t, u))
                    continue
                if not c:
                    continue
                add(site, t, u, day, m, c, ptitle)
        for t, u in undated[:20]:  # 제목에 날짜가 없는 글: 본문에서 찾기
            try:
                _, bh = crawl.get(u, referer=base)
            except Exception as e:  # noqa: BLE001
                pages_log.append({'site': site['code'], 'url': u, 'error': str(e)[:200]})
                continue
            day = body_date(bh)
            pages_log.append({'site': site['code'], 'url': u, 'body_date': str(day) if day else None})
            if day:
                add(site, t, u, day, None, classify(t, site, u), '')
    return list(found.values()), pages_log, cands


def apply(events):
    url, key = os.environ['SUPABASE_URL'].rstrip('/'), os.environ['SUPABASE_SECRET_KEY']
    h = {'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}

    def call(method, path, body=None, prefer=None):
        hh = dict(h)
        if prefer:
            hh['Prefer'] = prefer
        req = urllib.request.Request(f'{url}/rest/v1/{path}', method=method, headers=hh,
                                     data=json.dumps(body).encode() if body is not None else None)
        with urllib.request.urlopen(req, timeout=60) as r:
            txt = r.read().decode()
            return json.loads(txt) if txt else None

    names = sorted({e['academy'] for e in events})
    if names:
        call('POST', 'academies?on_conflict=name', [{'name': n} for n in names], 'resolution=merge-duplicates,return=minimal')
    ids = {a['name']: a['id'] for a in call('GET', 'academies?select=id,name')}
    rows = [{k: e[k] for k in ('source_key', 'kind', 'title', 'starts_on', 'level', 'area', 'subject_code', 'url')}
            | {'academy_id': ids[e['academy']], 'source': 'auto'} for e in events]
    for i in range(0, len(rows), 200):
        call('POST', 'academy_events?on_conflict=source_key', rows[i:i + 200], 'resolution=merge-duplicates,return=minimal')
    print(f'DB 반영: {len(rows)}건 (같은 글은 덮어씀)')


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    events, log, cands = collect()
    events.sort(key=lambda e: (e['starts_on'], e['academy']))
    json.dump({'built': dt.datetime.now(KST).isoformat(timespec='seconds'), 'events': events, 'pages': log, 'candidates': cands[:600]},
              open(os.path.join(out, 'academy_events.json'), 'w'), ensure_ascii=False, indent=1)
    for p in log:
        print('[쪽]', p)
    for e in events:
        print('[일정]', e['starts_on'], e['academy'], e['kind'], e['level'], e['subject_code'] or '-', '|', e['title'])
    print(f'일정 {len(events)}건')
    if '--apply' in sys.argv and events:
        apply(events)


if __name__ == '__main__':
    main()
