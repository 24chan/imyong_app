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
    print('1단계', len(root), [n.get('title') for n in root][:30])
    print('예시 노드', json.dumps(root[0], ensure_ascii=False)[:600])
    result = []
    # 2022 개정 가지만 내려감 (깊이 6까지)
    stack = [(n, 1) for n in root if '2022' in str(n.get('title', ''))]
    seen = 0
    LIMIT = 40 if '--sample' in sys.argv else 4000
    while stack and seen < LIMIT:
        n, depth = stack.pop(0)
        seen += 1
        d = n.get('data', n)
        title = re.sub(r'<[^>]+>', '', str(n.get('title', '')))
        if n.get('lazy') or n.get('folder'):
            kids = nodes({'invDepth': d.get('invDepth') or 1, 'degreeCode': d.get('degreeCode'),
                          'classCode': d.get('classCode'), 'subjectCode': d.get('subjectCode'), 'subjectDefCode': d.get('subjectDefCode'),
                          'openYear': d.get('openYear'), 'openMonth': d.get('openMonth'), 'ref': d.get('ref')})
            print('  ' * depth + f'[{title}] → {len(kids)}')
            for k in kids:
                k.setdefault('_path', (n.get('_path') or []) + [title])
                stack.append((k, depth + 1))
        else:
            fl = files(n)
            if '--sample' in sys.argv and len(result) < 3:
                html = view(d)
                open(os.path.join(out, f'view_{d.get("rootIdx")}.html'), 'w').write(html)
                print('    본문 쪽', len(html))
            print('  ' * depth + f'· {title} 파일 {len(fl)}')
            result.append({'path': (n.get('_path') or []) + [title], 'node': {k: v for k, v in n.items() if k != '_path'}, 'files': fl})
    json.dump(result, open(os.path.join(out, 'curriculum.json'), 'w'), ensure_ascii=False, indent=1)
    print('문서', len(result), '파일', sum(len(r['files']) for r in result))


if __name__ == '__main__':
    main()
