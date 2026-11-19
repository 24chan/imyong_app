"""사립·법인 정교사(신규교사) 채용 공고 모으기 → raw/jobs/teacher_jobs.json

출처 ① 정책브리핑 채용정보(korea.kr, 인사혁신처 나라일터 자료): 시도교육청 소속 학교 공고
     ② 경기도교육청 구인구직 '사립학교 교원정규채용' 분류
     ③ 서울교육일자리포털(work.sen.go.kr): 직무분야가 '정규교원'인 공고
기간제·시간강사·공무직 등은 빼고 신규(정규) 교사 공고만 남김. 같은 공고는 제목으로 한 번만.
사용: python jobs.py raw/jobs
"""
import http.cookiejar
import json
import os
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, timedelta
from html import unescape

UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'
LIST = 'https://www.korea.kr/archive/recruitInfoList.do'
VIEW = 'https://www.korea.kr/archive/recruitInfoView.do?dataId='
KEYWORDS = ['신규교사', '신규 교사', '신규교원', '교원 신규', '정규교원', '정규교사', '정교사', '교사 채용', '교원 채용', '중등학교교사', '선정경쟁', '임용후보자', '공개채용', '학교법인']
TEACH = re.compile(r'교사|교원')
INCLUDE = re.compile(r'신규|정규|정교사|공개\s*(채용|전형)|선정\s*경쟁|임용\s*후보자')
EXCLUDE = re.compile(r'기간제|시간\s*강사|계약제|계약직|대체|방과후|공무직|실무사|보안관|유치원|돌봄|늘봄|조리|사무|직원|조교|연구|전담|병원|미화|청사|시설|강사|코치|원어민|합격자|결과|겸임|기간\s*교사|협력|사감|관리\s*교사|생활관|지도\s*교사|계학제|담임\s*교사|면접\s*(시험|대상|안내)')
HARD = re.compile(r'유치원|교장|교감|원어민|방과후|초빙|강사|사감|돌봄|늘봄')  # 어느 출처든 무조건 제외
SCHOOL = re.compile(r'초등학교|중학교|고등학교|학교법인|학원|중·고|교육청')
REGION = [
    ('서울', 'seoul'), ('부산', 'busan'), ('대구', 'daegu'), ('인천', 'incheon'), ('광주광역시', 'gwangju'), ('대전', 'daejeon'),
    ('울산', 'ulsan'), ('세종', 'sejong'), ('경기', 'gyeonggi'), ('강원', 'gangwon'), ('충청북도', 'chungbuk'), ('충북', 'chungbuk'),
    ('충청남도', 'chungnam'), ('충남', 'chungnam'), ('전북', 'jeonbuk'), ('전라북도', 'jeonbuk'), ('전라남도', 'jeonnam'), ('전남', 'jeonnam'),
    ('경상북도', 'gyeongbuk'), ('경북', 'gyeongbuk'), ('경상남도', 'gyeongnam'), ('경남', 'gyeongnam'), ('제주', 'jeju'),
]

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
OP = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()), urllib.request.HTTPSHandler(context=ctx))


def post(url, data):
    for i in range(4):
        try:
            body = urllib.parse.urlencode(data).encode()
            r = OP.open(urllib.request.Request(url, data=body, headers={'User-Agent': UA, 'Referer': LIST}), timeout=40)
            return r.read().decode(r.headers.get_content_charset() or 'utf-8', 'ignore')
        except Exception as e:  # noqa: BLE001
            print('  재시도', i + 1, e)
            time.sleep(6 * (i + 1))
    return ''


clean = lambda s: re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', ' ', s))).strip()


def region_of(org, title):
    if '전남광주' in org:
        return 'gwangju' if '광주' in title and '전남' not in title else 'jeonnam'
    for k, v in REGION:
        if k in org:
            return v
    for k, v in REGION:
        if k in title:
            return v
    return None


def level_of(org, title):
    s = org + ' ' + title
    if re.search(r'초등', s) and not re.search(r'중학교|고등학교|중·고|고교', s):
        return 'elementary'
    if re.search(r'중학교|고등학교|중·고|고교|여중|여고|중등|고등', s):
        return 'secondary'
    return None


def is_teacher_job(r):
    """학교(초·중·고) 신규·정규 교사 공고만. 대학 본부·병원 등은 제외"""
    t, org = r['title'], r['org']
    if HARD.search(t + ' ' + org):
        return False
    if not (TEACH.search(t) and INCLUDE.search(t)) or EXCLUDE.search(t):
        return False
    if not SCHOOL.search(org + ' ' + t):
        return False
    if '대학교' in org and not re.search(r'부속|부설|초등학교|중학교|고등학교', org):
        return False
    return True


def rows(html):
    tb = re.search(r'<tbody.*?</tbody>', html, re.S)
    if not tb:
        return []
    out = []
    for tr in re.findall(r'<tr.*?</tr>', tb.group(0), re.S):
        m = re.search(r'dataId=(\d+)', tr)
        tds = re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S)
        if not m or len(tds) < 4:
            continue
        out.append({'id': m.group(1), 'title': clean(tds[0]), 'org': clean(tds[1]),
                    'posted': clean(tds[2]).replace('.', '-'), 'deadline': clean(tds[3]).replace('.', '-')})
    return out


def get(url):
    for i in range(3):
        try:
            r = OP.open(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=40)
            return r.read().decode(r.headers.get_content_charset() or 'utf-8', 'ignore')
        except Exception as e:  # noqa: BLE001
            print('  재시도', i + 1, e)
            time.sleep(6 * (i + 1))
    return ''


def collect_goe():
    """경기 구인구직: '사립학교 교원정규채용' 분류 (교원 정규채용만 모인 칸)"""
    out = {}
    for page in range(1, 40):
        h = post('https://www.goe.go.kr/recruit/ad/func/pb/hnfpPbancList.do',
                 {'mi': '10500', 'currPage': page, 'srchOcptCd': 'D', 'srchOcptNm': '사립학교 교원정규채용', 'srchEcptDl': 'N'})
        items = re.findall(r"goView\('(\d+)'\);\">(.*?)</a>", h, re.S)
        if not items:
            break
        for sn, body in items:
            spans = [clean(x) for x in re.findall(r'<span>(.*?)</span>', body, re.S)]
            title = clean((re.search(r'class="cont_tit">(.*?)</p>', body, re.S) or [None, ''])[1])
            posted = next((x.split(':')[1].strip().replace('/', '-') for x in spans if x.startswith('등록일')), '')
            period = re.search(r'접수기간</em>\s*([\d/]+)\s*~\s*([\d/]+)', body)
            if not title or not posted:
                continue
            out['goe-' + sn] = {'id': 'goe-' + sn, 'title': title, 'org': '경기도교육청 ' + (spans[0] if spans else ''),
                                'posted': posted, 'deadline': period.group(2).replace('/', '-') if period else None,
                                'url': f'https://www.goe.go.kr/recruit/ad/func/pb/hnfpPbancInfoView.do?pbancSn={sn}&mi=10500',
                                'source': '경기도교육청 구인구직'}
        time.sleep(1.2)
    print('경기 사립 정규채용', len(out))
    return out


def collect_sen(pages):
    """서울교육일자리포털: 최근 공고를 넘겨 보며 직무분야 '정규교원'만"""
    out = {}
    for page in range(1, pages + 1):
        h = get(f'https://work.sen.go.kr/work/search/recInfo/BD_selectSrchRecInfo.do?q_currPage={page}&q_rowPerPage=50')
        items = re.findall(r'<li class="flex_cont">(.*?)</li>', h, re.S)
        if not items:
            break
        for it in items:
            sn = re.search(r'q_rcrtSn=(\d+)', it)
            field = clean((re.search(r'직무분야</p>\s*<span[^>]*>(.*?)</span>', it, re.S) or [None, ''])[1])
            title = clean((re.search(r'class="list_title">(.*?)</h4>', it, re.S) or [None, ''])[1])
            head = clean((re.search(r'class="s_title">(.*?)</span>', it, re.S) or [None, ''])[1])
            if not sn or not title:
                continue
            if not field.startswith('정규교원') and not is_teacher_job({'title': title, 'org': head}):
                continue
            school = head.split('|')[0].strip()
            posted = (re.search(r'등록일\s*:\s*([\d-]+)', head) or [None, ''])[1]
            period = re.search(r'접수기간</p>\s*<span[^>]*>[^~]*~\s*([\d.]+)', it)
            out['sen-' + sn.group(1)] = {'id': 'sen-' + sn.group(1), 'title': title, 'org': '서울특별시교육청 ' + school,
                                          'posted': posted, 'deadline': period.group(1).replace('.', '-') if period else None,
                                          'url': f'https://work.sen.go.kr/work/search/recInfo/BD_selectRecDetail.do?q_rcrtSn={sn.group(1)}',
                                          'source': '서울교육일자리포털', 'field': field}
        time.sleep(1.2)
    print('서울 정규교원', len(out))
    return out


norm = lambda t: re.sub(r'[\s()\[\]〈〉<>·,.\-_]', '', t)


def main(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, 'teacher_jobs.json')
    old = {}
    if os.path.exists(path):
        old = {j['id']: j for j in json.load(open(path))['jobs']}
    start = (date.today() - timedelta(days=400)).isoformat()
    found = {}
    for kw in KEYWORDS:
        for page in range(1, 40):
            html = post(LIST, {'pageIndex': page, 'metaId': 'job', 'srchWord': kw, 'startDate': start,
                               'endDate': date.today().isoformat(), 'srchDateType': 'regiDate'})
            rs = rows(html)
            if not rs:
                break
            for r in rs:
                if is_teacher_job(r):
                    found[r['id']] = r
            time.sleep(1.2)
        print(kw, '누적', len(found))
    # 경기·서울 전용 게시판 (교원 정규채용 칸이라 제목 거르기를 덜 엄격하게)
    extra = {**collect_goe(), **collect_sen(40 if not old else 12)}
    for k, v in extra.items():
        if HARD.search(v['title'] + ' ' + v['org']) or (EXCLUDE.search(v['title']) and not v.get('field', '').startswith('정규교원')):
            continue
        found[k] = v
    jobs = {k: v for k, v in old.items()
            if not HARD.search(v['title'] + ' ' + v['org']) and (is_teacher_job(v) or k.startswith(('goe-', 'sen-')))}
    for i, r in found.items():
        jobs[i] = {'url': VIEW + i, 'source': '나라일터(정책브리핑)', **r,
                   'region': region_of(r['org'], r['title']), 'level': level_of(r['org'], r['title'])}
    # 같은 공고가 여러 곳에 올라오면 하나만 (나라일터 우선)
    seen, uniq = set(), {}
    for k, v in sorted(jobs.items(), key=lambda kv: (kv[0].startswith(('goe-', 'sen-')), kv[0])):
        n = norm(v['title'])
        if n in seen:
            continue
        seen.add(n)
        uniq[k] = v
    jobs = uniq
    keep = sorted((j for j in jobs.values() if j['posted'] >= start), key=lambda j: (j['posted'], str(j['id'])), reverse=True)
    json.dump({'updated': date.today().isoformat(), 'source': '나라일터(정책브리핑), 경기도교육청 구인구직, 서울교육일자리포털', 'jobs': keep},
              open(path, 'w'), ensure_ascii=False, indent=0)
    print('저장', len(keep), '건 (새로', len(set(found) - set(old)), ')')
    for j in keep[:15]:
        print(' -', j['posted'], j['region'], j['level'], j['title'][:60], '|', j['org'][:30])


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'raw/jobs')
