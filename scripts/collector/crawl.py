"""수집기 1단계: 교육청 임용 게시판 → 공고 목록 → 상세 → 첨부파일 링크
결과는 로그로 출력 (아직 DB 저장 안 함). 사용: python crawl.py [지역...]
"""
import http.cookiejar
import json
import time
import re
import ssl
import sys
import urllib.request
from html import unescape
from urllib.parse import urljoin

UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'
CTX_LOOSE = ssl.create_default_context()
CTX_LOOSE.check_hostname = False
CTX_LOOSE.verify_mode = ssl.CERT_NONE  # 인증서 체인이 불완전한 곳(울산 등) 공개 공고 읽기 전용

A_RE = re.compile(r'<a\b([^>]*)>(.*?)</a>', re.S | re.I)
ATTR_RE = re.compile(r'([\w-]+)\s*=\s*"([^"]*)"', re.I)
TAG_RE = re.compile(r'<[^>]+>')
YEAR_RE = re.compile(r'20(2[4-7])\s*학년도')
TEACHER_RE = re.compile(r'(유치원|초등|중등|특수)')
TOPIC_RE = re.compile(r'(시행계획|사전\s*예고|접수\s*(현황|결과)|응시|합격|경쟁률|선발)')
FILE_RE = re.compile(r'(download|filedown|fileDown|atchFile|FileDown|getFile|\.hwpx?\b|\.pdf\b|\.xlsx?\b)', re.I)

# 목록 페이지 → 상세 링크 만드는 방법
#   href: a 태그 href 그대로 / dataid: data-id 값을 detail 템플릿에 / onclick: 정규식 그룹을 detail 템플릿에
BOARDS = {
    'seoul': {'list': ['https://www.sen.go.kr/user/bbs/BD_selectBbsList.do?q_bbsSn=1094'], 'mode': 'href', 'pages': 1},
    'ulsan': {'list': ['https://use.go.kr/user/bbs/BD_selectBbsList.do?q_bbsSn=1913'], 'mode': 'href', 'pages': 1},
    'incheon': {'warm': 'https://www.ice.go.kr/ice/main.do',
                'list': ['https://www.ice.go.kr/ice/na/ntt/selectAllNttList.do?bbsAllTy=exam&mi=12237&currPage={p}'],
                'mode': 'href'},
    'chungbuk': {'list': ['https://www.cbe.go.kr/cbe/na/ntt/selectNttList.do?mi=11700&bbsId=1793&currPage={p}',
                          'https://www.cbe.go.kr/cbe/na/ntt/selectNttList.do?mi=11700&bbsId=1794&currPage={p}'],
                 'mode': 'dataid', 'detail': 'https://www.cbe.go.kr/cbe/na/ntt/selectNttInfo.do?mi=11700&nttSn={id}'},
    'busan': {'list': ['https://www.pen.go.kr/main/na/ntt/selectNttList.do?mi=30361&bbsId=2342&currPage={p}'],
              'mode': 'dataid', 'detail': 'https://www.pen.go.kr/main/na/ntt/selectNttInfo.do?mi=30361&bbsId=2342&nttSn={id}'},
    'gwangju': {'list': ['https://gen.go.kr/xboard/board.php?tbnum=49&page={p}'], 'mode': 'href'},
    'daejeon': {'list': ['https://www.dje.go.kr/boardCnts/list.do?boardID=64&m=031701&s=dje&page={p}'],
                'mode': 'onclick', 'onclick': r"goView\('64'\s*,\s*'(\d+)'",
                'detail': 'https://www.dje.go.kr/boardCnts/view.do?boardID=64&boardSeq={id}&lev=0&s=dje&m=031701'},
    'gyeonggi': {'list': ['https://www.goe.go.kr/goe/na/ntt/selectNttList.do?mi=10154&bbsId=2583&currPage={p}'],
                 'mode': 'dataid', 'detail': 'https://www.goe.go.kr/goe/na/ntt/selectNttInfo.do?mi=10154&bbsId=2583&nttSn={id}'},
    'gangwon': {'list': ['https://www.gwe.go.kr/main/bbs/list.do?key=bTIzMDcyMTA1ODIyNTA=&pageIndex={p}'],
                'mode': 'onclick', 'onclick': r"goView\('(\d+)'",
                'detail': 'https://www.gwe.go.kr/main/bbs/view.do?key=bTIzMDcyMTA1ODIyNTA=&bbsSn={id}'},
    'jeonbuk': {'list': ['https://www.jbe.go.kr/board/list.jbe?boardId=BBS_0000043&menuCd=DOM_000000103004001000&paging=ok&startPage={p}',
                         'https://www.jbe.go.kr/board/list.jbe?boardId=BBS_0000043&menuCd=DOM_000000103004002000&paging=ok&startPage={p}'],
                'mode': 'href'},
    'gyeongbuk': {'list': ['https://www.gbe.kr/main/na/ntt/selectNttList.do?mi=3538&bbsId=1882&currPage={p}'],
                  'mode': 'dataid', 'detail': 'https://www.gbe.kr/main/na/ntt/selectNttInfo.do?mi=3538&bbsId=1882&nttSn={id}'},
    'gyeongnam': {'list': ['https://www.gne.go.kr/user/bbs/BD_selectBbsList.do?q_bbsSn=1251'], 'mode': 'href', 'pages': 1},
    'jeju': {'list': ['https://www.jje.go.kr/board/list.jje?boardId=BBS_0000002&paging=ok&startPage={p}'], 'mode': 'href'},
}

# 게시판 주소를 아직 모르는 곳: 메뉴에서 '임용' 들어간 링크 찾기
DISCOVER = {
    'daegu': ['https://www.dge.go.kr/main/main.do', 'https://www.dge.go.kr/sso/index.jsp', 'https://www.dge.go.kr/main/main.do',
              'https://www.dge.go.kr/', 'http://www.dge.go.kr/main/main.do'],
    'chungnam': ['https://www.cne.go.kr/sub/info.do?m=010901&page=01060101&s=cne',
                 'https://www.cne.go.kr/sub/info.do?m=010902&page=01060102&s=cne'],
    'sejong': ['https://www.sje.go.kr/sje/main.do'],
    'jeonnam': ['https://www.jne.go.kr/main/main.do'],
}
MENU_RE = re.compile(r'(교원\s*임용|임용\s*시험|시험\s*정보|시험\s*공고|채용\s*시험|임용\s*정보)')


JAR = http.cookiejar.CookieJar()  # 대구(SSO)·인천처럼 첫 방문 쿠키가 필요한 곳
OPENERS = {
    False: urllib.request.build_opener(urllib.request.HTTPCookieProcessor(JAR)),
    True: urllib.request.build_opener(urllib.request.HTTPCookieProcessor(JAR), urllib.request.HTTPSHandler(context=CTX_LOOSE)),
}


def get(url, timeout=40, referer=None):
    last = None
    time.sleep(0.7)  # 교육청 서버 부담 줄이기
    for loose in (False, True):
        try:
            h = {'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9'}
            if referer:
                h['Referer'] = referer
            req = urllib.request.Request(url, headers=h)
            with OPENERS[loose].open(req, timeout=timeout) as r:
                raw = r.read()
                ct = r.headers.get_content_charset() or ('euc-kr' if b'euc-kr' in raw[:3000].lower() else 'utf-8')
                return r.geturl(), raw.decode(ct, 'ignore')
        except Exception as e:  # noqa: BLE001
            last = e
            if 'CERTIFICATE' not in str(e).upper():
                break
    raise last


def anchors(html, base):
    for attrs, inner in A_RE.findall(html):
        text = re.sub(r'\s+', ' ', unescape(TAG_RE.sub('', inner))).strip()
        at = {k.lower(): unescape(v) for k, v in ATTR_RE.findall(attrs)}
        href = at.get('href', '')
        yield text, (urljoin(base, href) if href and not href.lower().startswith('javascript') and not href.startswith('#') else ''), at


def is_target(title):
    return bool(YEAR_RE.search(title) and '임용' in title and TEACHER_RE.search(title) and TOPIC_RE.search(title))


def list_posts(cfg):
    posts, seen = [], set()
    pages = cfg.get('pages', 3)
    if cfg.get('warm'):
        try:
            get(cfg['warm'])
        except Exception as e:  # noqa: BLE001
            print('  warm 실패', e)
    for tmpl in cfg['list']:
        for p in range(1, pages + 1):
            url = tmpl.format(p=p)
            try:
                final, html = get(url)
            except Exception as e:  # noqa: BLE001
                print(f'  목록 실패 p{p}: {type(e).__name__}: {str(e)[:120]}')
                break
            got = 0
            for text, href, at in anchors(html, final):
                if not is_target(text):
                    continue
                if cfg['mode'] == 'href':
                    link = href
                elif cfg['mode'] == 'dataid':
                    link = cfg['detail'].format(id=at['data-id']) if at.get('data-id') else ''
                else:
                    m = re.search(cfg['onclick'], at.get('onclick', ''))
                    link = cfg['detail'].format(id=m.group(1)) if m else ''
                if not link or link in seen:
                    continue
                seen.add(link)
                posts.append((text[:120], link))
                got += 1
            print(f'  목록 p{p}: {final[:90]} len={len(html)} 대상 {got}건')
            if got == 0 and p == 1:
                if len(html) < 2500:
                    print('    짧음:', re.sub(r'\s+', ' ', html)[:300])
                k = 0
                for text, href, at in anchors(html, final):
                    if '임용' in text or '학년도' in text:
                        print(f'    ? {text[:80]} | {href[:120]} | {json.dumps({a: b[:80] for a, b in at.items() if a != "href"}, ensure_ascii=False)[:200]}')
                        k += 1
                        if k >= 5:
                            break
            if p == 1 and cfg['mode'] == 'onclick' and got:
                m = re.search(r'function\s+goView\s*\([^)]*\)\s*\{(.{0,600})', html, re.S)
                if m:
                    print('  goView 정의:', re.sub(r'\s+', ' ', m.group(1))[:500])
    return posts


def attachments(url):
    final, html = get(url)
    files = []
    for text, href, at in anchors(html, final):
        if '정보공개' in text or '매뉴얼' in text or '뷰어' in text or '품질인증' in text or text in ('미리보기', '미리듣기', 'PDF 다운로드'):
            continue
        oc = at.get('onclick', '')
        blob = ' '.join([href, oc, text, ' '.join(v for k, v in at.items() if k.startswith('data-'))])
        if FILE_RE.search(blob):
            m = re.search(r"https?://[^'\"]+\.(?:pdf|hwpx?|xlsx?)", oc)
            files.append({'name': text[:100], 'href': href or (m.group(0) if m else ''), 'onclick': oc[:160],
                          'data': {k: v[:60] for k, v in at.items() if k.startswith('data-')}})
    # 부산: 업로드 위젯(RAONK) 스크립트 안에 파일 목록
    for name, path in re.findall(r"AddUploadedFile\('\d+',\s*'([^']+)',\s*'(/[^']+)'", html):
        files.append({'name': name[:100], 'href': urljoin(final, path), 'onclick': '', 'data': {}})
    # 경기처럼 파일 주소가 미리보기 onclick 에만 있는 경우 보충
    for f, url in zip([f for f in files if not f['href']], re.findall(r"previewAjax\('([^']+)'", html)):
        f['href'] = url
    nohref = [f for f in files if not f['href']]
    if nohref:
        i = html.find(nohref[0]['name'][:15])
        print('      [원본]', re.sub(r'\s+', ' ', html[max(0, i - 450):i + 150])[:600])
    if not files:
        idx = [m.start() for m in re.finditer(r'(첨부\s*파일|첨부)', html)][-2:]
        for i in idx:
            print('      [문맥]', re.sub(r'\s+', ' ', html[max(0, i - 200):i + 250])[:450])
    return final, len(html), files


def crawl(regions):
    summary = {}
    for region in regions:
        cfg = BOARDS[region]
        print(f'\n===== {region}')
        posts = list_posts(cfg)
        summary[region] = {'posts': len(posts), 'with_files': 0}
        for title, link in posts[:6]:
            print(f'  * {title}\n      {link}')
            try:
                final, n, files = attachments(link)
            except Exception as e:  # noqa: BLE001
                print(f'      상세 실패: {type(e).__name__}: {str(e)[:120]}')
                continue
            if files:
                summary[region]['with_files'] += 1
            print(f'      상세 len={n} 첨부 {len(files)}개')
            for f in files[:5]:
                print(f"        - {f['name']} | {f['href'][:170]} | {f['onclick'][:100]} {f['data'] or ''}")
    return summary


def discover(regions):
    for region in regions:
        print(f'\n===== [탐색] {region}')
        for url in DISCOVER[region]:
            try:
                final, html = get(url, timeout=25, referer=prev if (prev := globals().get('_PREV')) else None)
                globals()['_PREV'] = final
            except Exception as e:  # noqa: BLE001
                print(f'  {url} 실패: {type(e).__name__}: {str(e)[:100]}')
                continue
            print(f'  {url} → {final} len={len(html)}')
            if len(html) < 2000:
                print('    짧음:', re.sub(r'\s+', ' ', html)[:300])
            n = 0
            for text, href, at in anchors(html, final):
                if MENU_RE.search(text) or (YEAR_RE.search(text) and '임용' in text):
                    extra = '' if href else json.dumps({a: b[:90] for a, b in at.items()}, ensure_ascii=False)[:250]
                    print(f'    - {text[:70]} | {href[:160]} | {at.get("onclick", "")[:100]} {extra}')
                    n += 1
                    if n >= 15:
                        break


if __name__ == '__main__':
    args = sys.argv[1:]
    crawl_regions = [r for r in (args or BOARDS) if r in BOARDS]
    disc_regions = [r for r in (args or DISCOVER) if r in DISCOVER]
    s = crawl(crawl_regions)
    discover(disc_regions)
    print('\n요약', json.dumps(s, ensure_ascii=False))
