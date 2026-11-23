"""NCIC(국가교육과정정보센터) 교육과정 원문 목록 수집 → <out>/ncic/curriculum.json (+ 조사용 응답 저장)
- 목록은 NCIC 화면이 쓰는 주소(인벤토리 트리 /api/inv/inventoryNodeList.do, 파일 목록 /api/inv/invFileList.do)를 그대로 부름
- 파일 받기 주소: /inv/org/download.do?year=..&seq=..&orgType=ogi4 (GET)
- 교육과정 고시문은 저작권 보호 대상이 아님(저작권법 제7조). 2026-11-24 사용자 승인: 앱 안에서 보기
사용: python ncic.py <out_dir> [--explore]"""
import http.cookiejar
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

BASE = 'https://ncic.re.kr'
UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36'
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
CSRF = {'token': '', 'header': 'X-CSRF-TOKEN'}
LOG = []


def req(path, data=None, accept='application/json'):
    time.sleep(0.6)
    h = {'User-Agent': UA, 'Referer': BASE + '/inv/org/list.do', 'Accept': accept}
    body = None
    if data is not None:
        d = dict(data)
        if CSRF['token']:
            d['_csrf'] = CSRF['token']
            h[CSRF['header']] = CSRF['token']
        body = urllib.parse.urlencode(d).encode()
        h['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'
        h['X-Requested-With'] = 'XMLHttpRequest'
    r = opener.open(urllib.request.Request(BASE + path, data=body, headers=h), timeout=60)
    return r.read().decode('utf-8', 'ignore')


def start():
    html = req('/inv/org/list.do', accept='text/html')
    m = re.search(r'name="_csrf"\s+value="([^"]+)"', html)
    if m:
        CSRF['token'] = m.group(1)
    hm = re.search(r'name="_csrf_header"\s+content="([^"]+)"', html)
    if hm:
        CSRF['header'] = hm.group(1)
    print('csrf', bool(CSRF['token']), CSRF['header'])


def nodes(params):
    p = {'type': 'ogi4', 'nowTblType': 'org', 'menuType': '1', 'isAdmin': '0', 'nationCode': ''} | {k: ('' if v is None else v) for k, v in params.items()}
    txt = req('/api/inv/inventoryNodeList.do', p)
    LOG.append({'req': p, 'res': txt[:4000]})
    try:
        j = json.loads(txt)
    except ValueError:
        return []
    if isinstance(j, dict):
        for k in ('data', 'list', 'result', 'nodes'):
            if isinstance(j.get(k), list):
                return j[k]
        if isinstance(j.get('data'), dict):
            for v in j['data'].values():
                if isinstance(v, list):
                    return v
    return j if isinstance(j, list) else []


def files(node):
    d = node.get('data', node)
    p = {'invSeq': d.get('rootIdx') or d.get('ref') or '', 'invYear': d.get('openYear', ''), 'orgType': 'ogi4',
         'degreeCode': d.get('degreeCode', ''), 'classCode': d.get('classCode', ''), 'openYear': d.get('openYear', ''),
         'openMonth': d.get('openMonth', ''), 'subjectCode': d.get('subjectCode', ''), 'nationCode': '', 'type': 'org'}
    txt = req('/api/inv/invFileList.do', p)
    LOG.append({'req': p, 'res': txt[:4000]})
    try:
        j = json.loads(txt)
        return (j.get('data') or {}).get('invFiles') or []
    except ValueError:
        return []


def view(node):
    """본문보기 쪽(HTML) — 고시문 본문"""
    p = {'openYear': node.get('openYear', ''), 'seq': node.get('rootIdx') or node.get('ref'), 'location': '', 'orgType': 'ogi4', 'menuType': '1', 'nationCd': ''}
    return req('/inv/org/view.do', p, accept='text/html')


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    try:
        run(out)
    finally:
        json.dump(LOG[:400], open(os.path.join(out, 'log.json'), 'w'), ensure_ascii=False, indent=1)


def run(out):
    start()
    root = nodes({'invDepth': 1})
    print('1단계', [n.get('title') for n in root])

    def kids_of(n):
        ks = nodes({'invDepth': n.get('invDepth') or 1, 'degreeCode': n.get('degreeCode'), 'classCode': n.get('classCode'),
                    'subjectCode': n.get('subjectCode'), 'subjectDefCode': n.get('subjectDefCode'),
                    'openYear': n.get('openYear'), 'openMonth': n.get('openMonth'), 'ref': n.get('ref')})
        for k in ks:
            k['title'] = re.sub(r'<[^>]+>', '', str(k.get('title', '')))
        return ks

    def first_leaf(n, depth=0):
        if not (n.get('lazy') or n.get('folder')):
            return n
        if depth > 5:
            return None
        for k in kids_of(n):
            leaf = first_leaf(k, depth + 1)
            if leaf:
                return leaf
        return None

    sections, files_by = {}, {}
    for era in [n for n in root if re.match(r'20(22|15) 개정', str(n.get('title', '')))]:
        for school in kids_of(era):
            if era['title'].startswith('2015') and '특수' in school['title']:
                continue
            for subj in kids_of(school):
                key = ' > '.join([era['title'], school['title'], subj['title']])
                if not (subj.get('lazy') or subj.get('folder')):
                    secs, leaf = [], subj
                else:
                    chapters = kids_of(subj)
                    secs = [{'title': c['title'], 'seq': c.get('rootIdx') or c.get('ref')} for c in chapters]
                    leaf = None
                    for c in chapters:
                        leaf = first_leaf(c)
                        if leaf:
                            break
                fl = files(leaf) if leaf else []
                sections[key] = secs
                files_by[key] = [{'name': f['fileOrg'], 'ext': (f.get('fileExt') or '').lower(), 'seq': f['orgAttNo'], 'year': f['openYear'],
                                  'url': f"{BASE}/inv/org/download.do?year={f['openYear']}&seq={f['orgAttNo']}&orgType=ogi4"} for f in fl]
                print(f'{key}: 장 {len(secs)} 파일 {len(fl)}')
    docs = []
    for key, secs in sections.items():
        p = key.split(' > ')
        docs.append({'era': p[0], 'school': p[1] if len(p) > 1 else '', 'subject': p[2] if len(p) > 2 else '', 'sections': secs, 'files': files_by.get(key, [])})
    # 받기 주소가 쿠키 없이 열리는지 시험
    probe = next((f for d in docs for f in d['files'] if f['ext'] == 'pdf'), None)
    check = None
    if probe:
        try:
            r = urllib.request.urlopen(urllib.request.Request(probe['url'], headers={'User-Agent': UA}), timeout=60)
            body = r.read(2000)
            check = {'url': probe['url'], 'status': r.status, 'type': r.headers.get('Content-Type'), 'disp': r.headers.get('Content-Disposition'), 'pdf': body[:4] == b'%PDF'}
        except Exception as e:  # noqa: BLE001
            check = {'url': probe['url'], 'error': str(e)[:200]}
        print('받기 시험', check)
    json.dump({'source': '국가교육과정정보센터(NCIC) 원문 인벤토리', 'page': BASE + '/inv/org/list.do', 'download_check': check, 'docs': docs},
              open(os.path.join(out, 'curriculum.json'), 'w'), ensure_ascii=False, indent=1)
    print('교과 문서', len(docs), '파일', sum(len(d['files']) for d in docs))


if __name__ == '__main__':
    main()
