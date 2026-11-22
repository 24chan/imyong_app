"""조사: 교대 홈페이지 공지에서 '실습학교/협력학교' 글 찾기 → raw/practice_probe/<교대>/ 에 글 HTML·첨부·본문 이미지 저장
1) 홈페이지에서 '공지/학사/교육실습' 메뉴 주소 찾기  2) 그 게시판에서 '실습' 검색(K2Web srchWrd 등) + 목록 몇 쪽  3) 실습학교 관련 글 저장
학생 이름 같은 개인정보는 앱에 옮기지 않음(학교 이름만). 저장은 확인용.
사용: python practice_probe.py <out_dir>"""
import json
import os
import re
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import crawl  # noqa: E402

crawl.DELAY[0] = 0.6
# 진주교대처럼 옛 보안 방식 서버도 읽을 수 있게 (공개 공지 읽기 전용)
try:
    import ssl
    import urllib.request
    crawl.CTX_LOOSE.set_ciphers('DEFAULT:@SECLEVEL=0')
    crawl.CTX_LOOSE.options |= getattr(ssl, 'OP_LEGACY_SERVER_CONNECT', 0x4)
    crawl.CTX_LOOSE.minimum_version = ssl.TLSVersion.TLSv1
except Exception:  # noqa: BLE001
    pass
SLOW = {'gnue': 3.0}  # 빨리 요청하면 연결을 끊는 곳
UNIVS = {
    'snue': ('서울교대', 'https://www.snue.ac.kr/'),
    'cnue': ('춘천교대', 'https://www.cnue.ac.kr/'),
    'cje': ('청주교대', 'https://www.cje.ac.kr/ctps/'),
    'gjue': ('공주교대', 'https://www.gjue.ac.kr/html/kor/index.html'),
    'jnue': ('전주교대', 'https://www.jnue.kr/portal/jnue/main/main.do'),
    'gnue': ('광주교대', 'https://www.gnue.ac.kr/'),
    'dnue': ('대구교대', 'https://www.dnue.ac.kr/'),
    'bnue': ('부산교대', 'https://www.bnue.ac.kr/home/main'),
    'cue': ('진주교대', 'https://www.cue.ac.kr/'),
    'knue': ('한국교원대', 'https://www.knue.ac.kr/'),
    'jejunu': ('제주대 교육대학', 'https://www.jejunu.ac.kr/index.htm'),
    'ewha': ('이화여대 초등교육과', 'https://elementary.ewha.ac.kr/'),
    'ginue': ('경인교대', 'https://www.ginue.ac.kr/'),
}
MENU = re.compile(r'공지|학사|교육실습|실습')
# 홈에서 메뉴를 못 찾는 학교: 직접 넣은 게시판 주소 (2차 조사에서 확인한 것)
EXTRA = {
    'cje': ['https://www.cje.ac.kr/ctps/web/content.do?menu_cd=000015',   # 교육실습지원센터 공지사항
            'https://www.cje.ac.kr/ctps/web/content.do?menu_cd=000031'],  # 자료실
}
# 바로 받아 볼 페이지 (조사에서 주소를 찾은 것)
DIRECT = {
    'cje': [(f'교육실습 {n}', f'https://www.cje.ac.kr/ctps/web/content.do?menu_cd={c}')
            for n, c in (('I', '000017'), ('II', '000020'), ('III', '000023'), ('IV', '000026'))],
    'gnue': [('실습학교주소', 'https://www.gnue.ac.kr/index.9is?contentUid=4a9f18ab5c48fe8c015c86391170028a'),
             ('실습운영계획', 'https://www.gnue.ac.kr/index.9is?contentUid=4a9f18ab5c48fe8c015c86387c490287')],
}
HIT = re.compile(r'실습')
STRONG = re.compile(r'(실습\s*(학교|협력|배정|운영)|협력\s*학교|참관\s*실습|수업\s*실습|실무\s*실습|종합\s*실습|실습학교)')
SKIP = re.compile(r'평생교육|해외|글로벌|봉사|심폐|응급|교육대학원|유치원|중등')


def save(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(data if isinstance(data, bytes) else data.encode('utf-8'))


def fetch_bytes(url):
    import urllib.request
    req = urllib.request.Request(crawl.iri(url), headers={'User-Agent': crawl.UA, 'Referer': crawl.LAST.get(url.split('/')[2], url)})
    for loose in (False, True):
        try:
            with crawl.OPENERS[loose].open(req, timeout=60) as r:
                return r.read(), r.headers.get('Content-Disposition', ''), r.headers.get_content_type()
        except Exception as e:  # noqa: BLE001
            err = e
    raise err


def search_urls(board):
    """게시판 주소에 '실습' 검색을 붙인 후보들"""
    q = urllib.parse.quote('실습')
    out = [board]
    sep = '&' if '?' in board else '?'
    if 'artclList.do' in board:  # K2Web
        out.append(f'{board}{sep}srchColumn=sj&srchWrd={q}')
    out += [f'{board}{sep}searchCondition=title&searchKeyword={q}', f'{board}{sep}searchType=title&searchWord={q}',
            f'{board}{sep}srchKey=title&srchVal={q}', f'{board}{sep}keyword={q}']
    for p in (2, 3, 4):
        out.append(f'{board}{sep}page={p}')
    return out


def probe(code, name, home, out):
    log = {'univ': code, 'name': name, 'home': home, 'boards': [], 'posts': [], 'errors': []}
    try:
        final, html = crawl.get(home, timeout=40)
        # 스크립트·meta로 넘기는 첫 화면은 따라감 (최대 3번)
        for _ in range(3):
            m = re.search(r'(?i)location(?:\.href|\.replace)?\s*[=(]\s*["\']([^"\']+)["\']', html) \
                or re.search(r'(?i)http-equiv=["\']?refresh["\']?[^>]*content=["\'][^"\']*url=([^"\'>]+)', html)
            if not m or len(html) > 20000:
                break
            nxt = urllib.parse.urljoin(final, m.group(1).strip())
            if nxt == final:
                break
            final, html = crawl.get(nxt, timeout=40)
        save(f'{out}/{code}/home.html', html)
    except Exception as e:  # noqa: BLE001
        log['errors'].append(f'홈 접속 실패: {type(e).__name__} {str(e)[:100]}')
        return log
    boards = []
    log['home_final'] = final
    log['home_len'] = len(html)
    allA = [(t, h) for t, h, _ in crawl.anchors(html, final)]
    log['anchors'] = len(allA)
    log['anchor_sample'] = [f'{t[:20]} {h[:90]}' for t, h in allA if re.search(r'공지|학사|실습|notice|board|bbs', t + h, re.I)][:25]
    m = re.search(r'(?i)(?:location\.href|location\.replace|http-equiv=["\']refresh["\'][^>]*url=)\s*\(?["\']?([^"\'\s>)]+)', html)
    if m:
        log['redirect'] = m.group(1)
    for extra in EXTRA.get(code, []):
        boards.append(('추가', extra))
    for text, href, _ in crawl.anchors(html, final):
        if href and MENU.search(text) and len(text) <= 20 and href.split('/')[2].endswith(home.split('/')[2].replace('www.', '')):
            boards.append((text, href))
    seen_b, posts = set(), {}
    for t, u in DIRECT.get(code, []):
        posts[u] = t
    for text, href in boards[:14]:
        if href in seen_b:
            continue
        seen_b.add(href)
        log['boards'].append(f'{text} {href}')
        for u in search_urls(href)[: (3 if code in SLOW else 9)]:
            try:
                f2, h2 = crawl.get(u, timeout=30)
            except Exception as e:  # noqa: BLE001
                log['errors'].append(f'{u[:90]} {type(e).__name__}')
                continue
            for t, hr, _ in crawl.anchors(h2, f2):
                if hr and HIT.search(t) and STRONG.search(t) and not SKIP.search(t) and len(t) < 120:
                    posts.setdefault(hr, t)
    for i, (href, title) in enumerate(list(posts.items())[:25]):
        entry = {'title': title, 'url': href, 'files': [], 'images': []}
        try:
            final, n, files, date = crawl.attachments(href)
            entry['date'] = date
            _, html = crawl.get(href)
            save(f'{out}/{code}/{i:02d}.html', html)
            for j, fobj in enumerate(files[:6]):
                if not fobj['href']:
                    continue
                try:
                    data, cd, ctype = fetch_bytes(fobj['href'])
                    ext = os.path.splitext(fobj['name'])[1].lower()[:6] or ('.pdf' if 'pdf' in ctype else '.bin')
                    save(f'{out}/{code}/{i:02d}_f{j}{ext}', data)
                    entry['files'].append({'name': fobj['name'], 'saved': f'{i:02d}_f{j}{ext}', 'bytes': len(data)})
                except Exception as e:  # noqa: BLE001
                    entry['files'].append({'name': fobj['name'], 'error': str(e)[:80]})
            # 본문 표가 그림인 경우(경인교대처럼)
            body = html[html.find('<body'):]
            for k, src in enumerate(re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', body)[:40]):
                if re.search(r'logo|icon|btn|common|bullet|banner|footer|header|sns|qr', src, re.I):
                    continue
                u = urllib.parse.urljoin(final, src)
                try:
                    data, _, ctype = fetch_bytes(u)
                    if len(data) < 15000:
                        continue
                    save(f'{out}/{code}/{i:02d}_img{k}.{"png" if "png" in ctype else "jpg"}', data)
                    entry['images'].append(f'{i:02d}_img{k}')
                except Exception:  # noqa: BLE001
                    pass
        except Exception as e:  # noqa: BLE001
            entry['error'] = f'{type(e).__name__} {str(e)[:100]}'
        log['posts'].append(entry)
    return log


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2].split(',') if len(sys.argv) > 2 and sys.argv[2] else list(UNIVS)
    summary = []
    for code in only:
        name, home = UNIVS[code]
        crawl.DELAY[0] = SLOW.get(code, 0.6)
        print(f'== {name}', flush=True)
        lg = probe(code, name, home, out)
        save(f'{out}/{code}/log.json', json.dumps(lg, ensure_ascii=False, indent=1))
        print(f"   게시판 {len(lg['boards'])} · 실습 글 {len(lg['posts'])} · 오류 {len(lg['errors'])}", flush=True)
        for b in lg['boards'][:8]:
            print('   [게시판]', b[:120])
        for p in lg['posts'][:25]:
            print('   [글]', p.get('date'), p['title'][:70], '| 첨부', len(p['files']), '| 그림', len(p['images']), p.get('error', ''))
        for e in lg['errors'][:3]:
            print('   [오류]', e)
        if not lg['boards']:
            print('   [홈]', lg.get('home_final'), lg.get('home_len'), 'a', lg.get('anchors'), 'redirect', lg.get('redirect'))
            for a in lg.get('anchor_sample', [])[:25]:
                print('     ·', a)
        summary.append({'univ': code, 'name': name, 'boards': len(lg['boards']), 'posts': len(lg['posts']), 'errors': lg['errors'][:3]})
    save(f'{out}/summary.json', json.dumps(summary, ensure_ascii=False, indent=1))
