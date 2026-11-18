"""수집기 2단계: 임용 공고(2024~2027학년도) 첨부파일 내려받기 + 분류
결과: raw/<지역>/<파일>, raw/manifest.json  (워크플로가 raw-files 브랜치에 올림)
사용: python fetch.py [지역...]
"""
import hashlib
import json
import os
import re
import sys
import time
import urllib.request
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import crawl  # noqa: E402

OUT = os.environ.get('RAW_DIR', 'raw')
MAX_PAGES = int(os.environ.get('MAX_PAGES', '15'))
ANY_YEAR = re.compile(r'20(\d\d)\s*학년도')

# 문서 종류 (위에서부터 먼저 맞는 것)
TYPES = [
    ('final_pass', re.compile(r'최종\s*합격')),
    ('first_pass', re.compile(r'(1|제\s*1|１)\s*차[^,]{0,25}합격')),
    ('receipt', re.compile(r'(접수|지원).{0,6}(현황|결과|인원)|지원자\s*현황|경쟁률')),
    ('attend', re.compile(r'응시\s*(현황|및\s*결시|자\s*및\s*결시)|응[·ㆍ\s]*결시')),
    ('plan', re.compile(r'시행\s*계획')),
    ('prelim', re.compile(r'사전\s*예고')),
]
SKIP_TITLE = re.compile(r'한국사|소명|연수|제출\s*서류|수정\s*동의|정정\s*기간|연기|추가\s*합격자\s*등록')
SKIP_UNLESS_PASS = re.compile(r'장소|유의\s*사항')  # '1차 합격자 및 2차 시험 장소'는 살림
DAILY = re.compile(r'\d\s*일\s*차|\d+\.\s*\d+\.\s*\d+\s*\.?\s*\d*\s*시\s*기준')
FINAL_WORD = re.compile(r'최종|마감')
SKIP_FILE = re.compile(r'미리보기|새창|서식|양식|유의\s*사항|접수\s*(방법|요령)|원서\s*접수\s*안내|수정\s*동의|매뉴얼|답안지|변경\s*사항|품질인증')
FILE_EXT = re.compile(r'\.(pdf|hwpx?|xlsx?)\b', re.I)


def level_of(title):
    if re.search(r'중등|보건|사서|전문상담|영양', title) and not re.search(r'초등', title):
        return 'secondary'
    if re.search(r'초등|유치원|유[·ㆍ.]\s*초', title):
        return 'elementary'
    return None


def classify(title):
    # 사립학교 위탁 선발 공고 (공·사립 함께 내는 본 공고는 제외)
    if '사립' in title and re.search(r'위탁|공동\s*전형', title) and not re.search(r'공\s*[·ㆍ.,‧]?\s*사립|국\s*[·ㆍ.,‧]\s*공|공립|위탁\s*포함', title):
        return 'private'
    if SKIP_TITLE.search(title) or (SKIP_UNLESS_PASS.search(title) and '합격' not in title):
        return None
    for name, rx in TYPES:
        if rx.search(title):
            if name == 'receipt' and DAILY.search(title) and not FINAL_WORD.search(title) \
                    and not re.search(r'5\s*일\s*차|장애', title):
                return None  # 접수 'n일차'는 건너뛰고 최종만
            return name
    return None


def form_url(html, base, form_name, **over):
    """게시판 검색 form 의 모든 값(hidden/select/text)을 모아 GET 주소로 (서울·울산·경남: q_currPage 만 붙이면 '잘못된 URL')"""
    from urllib.parse import urlencode, urljoin
    m = re.search(r'<form[^>]*name="%s"[^>]*>(.*?)</form>' % form_name, html, re.S)
    if not m:
        return None
    tag = re.match(r'<form[^>]*>', m.group(0)).group(0)
    action = (re.search(r'action="([^"]*)"', tag) or [None, ''])[1]
    pairs = []
    for inp in re.findall(r'<input[^>]*>', m.group(1)):
        n = re.search(r'name="([^"]+)"', inp)
        if not n or re.search(r'type="(checkbox|radio|submit|button|image)"', inp):
            continue
        v = re.search(r'value="([^"]*)"', inp)
        pairs.append((n.group(1), v.group(1) if v else ''))
    for sel in re.findall(r'<select[^>]*name="([^"]+)"[^>]*>(.*?)</select>', m.group(1), re.S):
        opts = re.findall(r'<option([^>]*)>', sel[1])
        pick = next((o for o in opts if 'selected' in o), opts[0] if opts else '')
        v = re.search(r'value="([^"]*)"', pick)
        pairs.append((sel[0], v.group(1) if v else ''))
    d = dict(pairs)
    d.update({k: str(v) for k, v in over.items()})
    return urljoin(base, action) + '?' + urlencode(d)


def list_all(region, cfg):
    """여러 쪽을 넘기며 2024~2027 임용 공고만. 2023 이하만 나오는 쪽에서 멈춤."""
    out, seen = [], set()
    if cfg.get('warm'):
        try:
            crawl.get(cfg['warm'])
        except Exception as e:  # noqa: BLE001
            print('  warm 실패', e)
    for tmpl in cfg['list']:
        form = cfg.get('form')
        pages = cfg.get('pages', MAX_PAGES) if ('{p}' in tmpl or form) else 1
        prev_links = None
        html, final = None, None
        for p in range(1, pages + 1):
            try:
                url = tmpl.format(p=p)
                if form and p > 1:
                    url = form_url(html, final, form, q_currPage=p)
                    if not url:
                        print('  form 없음')
                        break
                final, html = crawl.get(url)
            except Exception as e:  # noqa: BLE001
                print(f'  p{p} 실패: {type(e).__name__} {str(e)[:80]}')
                break
            links, years, got = set(), [], 0
            for text, href, at in crawl.anchors(html, final):
                if '임용' not in text:
                    continue
                ym = ANY_YEAR.search(text)
                if ym:
                    years.append(2000 + int(ym.group(1)))
                if cfg['mode'] == 'href':
                    link = href
                elif cfg['mode'] == 'dataid':
                    link = cfg['detail'].format(id=at['data-id']) if at.get('data-id') else ''
                else:
                    m = re.search(cfg['onclick'], at.get('onclick', ''))
                    link = cfg['detail'].format(id=m.group(1)) if m else ''
                if not link:
                    continue
                links.add(link)
                if not ym or not (2024 <= 2000 + int(ym.group(1)) <= 2027):
                    continue
                typ, lvl = classify(text), level_of(text)
                if not typ or not lvl or link in seen:
                    continue
                seen.add(link)
                out.append({'region': region, 'year': 2000 + int(ym.group(1)), 'level': lvl, 'type': typ,
                            'title': text[:200], 'post_url': link})
                got += 1
            print(f'  p{p}: 임용글 {len(links)} 대상 {got} 연도 {min(years) if years else "-"}~{max(years) if years else "-"}')
            if p == 1 and pages == 1:
                pag = [f"{t}|{h[:90]}|{a.get('onclick', '')[:60]}" for t, h, a in crawl.anchors(html, final)
                       if t.strip() in ('2', '3', '다음', '다음페이지') or 'Page' in a.get('onclick', '')][:4]
                print('  쪽 넘김 링크:', pag)
                m = re.search(r'function\s+opMovePage\s*\([^)]*\)\s*\{(.{0,400})', html, re.S)
                if m:
                    print('  opMovePage:', re.sub(r'\s+', ' ', m.group(1))[:400])
                for fm in re.finditer(r'<form[^>]*>.*?</form>', html, re.S):
                    if 'q_currPage' in fm.group(0) or 'currPage' in fm.group(0):
                        print('  form:', re.findall(r'<form[^>]*>', fm.group(0))[0][:200],
                              re.findall(r'<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"', fm.group(0))[:15])
                        break
            if not links or links == prev_links:
                break
            if years and max(years) < 2024:
                break
            prev_links = links
    return out


def get_bytes(url, referer):
    time.sleep(crawl.DELAY[0])
    host = url.split('/')[2]
    url = crawl.iri(url)
    req = urllib.request.Request(url, headers={'User-Agent': crawl.UA, 'Referer': referer or crawl.LAST.get(host, '')})
    last = None
    for loose in (False, True):
        try:
            for attempt in range(2):
                try:
                    with crawl.OPENERS[loose].open(req, timeout=120) as r:
                        return r.read(), r.headers.get('Content-Disposition', '')
                except (TimeoutError, ConnectionResetError) as e:
                    last = e
                    time.sleep(5)
            break
        except Exception as e:  # noqa: BLE001
            last = e
            if 'CERTIFICATE' not in str(e).upper():
                break
    raise last


def safe(name):
    return re.sub(r'[\\/:*?"<>|\s]+', '_', name).strip('_')[:90]


def main(regions):
    stats = {}
    for region in regions:
        os.makedirs(os.path.join(OUT, region), exist_ok=True)
        manifest_path = os.path.join(OUT, region, 'manifest.json')  # 지역별 목록 (병렬 실행)
        manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else []
        # 분류 규칙이 바뀌면 예전에 받은 파일의 종류도 다시 매김 (파일 이름은 그대로, 파서는 type 값을 봄)
        for m in manifest:
            t = classify(m.get('title', ''))
            if t and t != m.get('type'):
                print(f"  종류 변경 {m.get('type')} → {t}: {m.get('title', '')[:50]}")
                m['type'] = t
        have = {m['file_url'] for m in manifest}
        posts_path = os.path.join(OUT, region, 'posts.json')  # 공고 목록 (홈 '임용 소식'용)
        post_index = json.load(open(posts_path)) if os.path.exists(posts_path) else {}
        for v in post_index.values():
            t = classify(v.get('title', ''))
            if t:
                v['type'] = t
        cfg = crawl.BOARDS[region]
        crawl.DELAY[0] = cfg.get('delay', 0.7)
        print(f'\n===== {region}')
        posts = list_all(region, cfg)
        print(f'  대상 공고 {len(posts)}건:', json.dumps({t: sum(1 for x in posts if x["type"] == t) for t, _ in TYPES}, ensure_ascii=False))
        n_files = 0
        for post in posts:
            try:
                _, _, files, pdate = crawl.attachments(post['post_url'])
                post_index[post['post_url']] = {**post_index.get(post['post_url'], {}), **post, 'posted_at': pdate or post_index.get(post['post_url'], {}).get('posted_at'),
                                           'files': [{'name': f['name'], 'url': f['href']} for f in files if f['href']][:10]}
            except Exception as e:  # noqa: BLE001
                print(f"  상세 실패 {post['title'][:50]}: {type(e).__name__}")
                continue
            for f in files:
                if not f['href'] or SKIP_FILE.search(f['name']) or not FILE_EXT.search(f['name'] + ' ' + f['href']):
                    continue
                if f['href'] in have:
                    continue
                try:
                    data, cd = get_bytes(f['href'], post['post_url'])
                except Exception as e:  # noqa: BLE001
                    print(f"  다운로드 실패 {f['name'][:50]}: {type(e).__name__} {str(e)[:60]}")
                    continue
                if len(data) < 200 or data[:15].lstrip().lower().startswith((b'<!doctype', b'<html', b'<script')):
                    print(f"  파일 아님(HTML) {f['name'][:50]}")
                    continue
                ext = (FILE_EXT.search(f['name'] + ' ') or FILE_EXT.search(f['href'])).group(1).lower()
                sha = hashlib.sha1(data).hexdigest()[:12]
                rel = f"{region}/{post['year']}_{post['level']}_{post['type']}_{sha}.{ext}"
                with open(os.path.join(OUT, rel), 'wb') as fh:
                    fh.write(data)
                manifest.append({**post, 'file_name': f['name'], 'file_url': f['href'], 'path': rel,
                                 'sha1': sha, 'size': len(data), 'fetched_at': time.strftime('%Y-%m-%d')})
                have.add(f['href'])
                n_files += 1
                print(f"  + {rel} ({len(data)//1024}KB) {f['name'][:60]}", flush=True)
                json.dump(manifest, open(manifest_path, 'w'), ensure_ascii=False, indent=1)
        json.dump(post_index, open(posts_path, 'w'), ensure_ascii=False, indent=1)
        stats[region] = {'posts': len(posts), 'new_files': n_files}
        json.dump(manifest, open(manifest_path, 'w'), ensure_ascii=False, indent=1)
    print('\n요약', json.dumps(stats, ensure_ascii=False))


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a in crawl.BOARDS]
    main(args or [r for r in crawl.BOARDS if r != 'incheon'])
