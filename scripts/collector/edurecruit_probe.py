"""조사(읽기만): 나이스 교직원 온라인채용(edurecruit.go.kr) 공고 목록을 자동으로 가져올 수 있는지.
넥사크로 앱이라 첫 화면은 비어 있음 → 불러오는 스크립트·설정 파일에서 데이터 주소(.do, SSV/XML)를 찾는다."""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import crawl  # noqa: E402

seen = set()


def show(url, depth=0):
    if url in seen or depth > 2 or len(seen) > 40:
        return
    seen.add(url)
    try:
        final, body = crawl.get(url, timeout=30)
    except Exception as e:  # noqa: BLE001
        print(f'{"  " * depth}✗ {url} {type(e).__name__} {str(e)[:80]}')
        return
    print(f'{"  " * depth}● {final} len={len(body)}')
    hits = sorted(set(re.findall(r'["\'](/[^"\'\s<>]{2,120}\.(?:do|xfdl\.js|xjs|js|xml|json))["\']', body)))
    for h in hits[:30]:
        print(f'{"  " * depth}   - {h}')
    for kw in ('svcurl', 'serviceurl', 'Services', 'prefixid', 'url=', 'transaction(', 'nexacro', 'ajax', 'fetch('):
        for m in list(re.finditer(re.escape(kw), body, re.I))[:2]:
            print(f'{"  " * depth}   [{kw}] ' + re.sub(r'\s+', ' ', body[max(0, m.start() - 80):m.start() + 160]))
    base = '/'.join(final.split('/')[:3])
    for h in hits:
        if re.search(r'environment|typedef|appvariables|svc|service|config|main|index|start|recruit|ntc|notice|job', h, re.I):
            show(base + h, depth + 1)


for u in ['https://edurecruit.go.kr/', 'https://www.edurecruit.go.kr/', 'https://edurecruit.go.kr/index.html',
          'https://edurecruit.go.kr/environment.xml', 'https://edurecruit.go.kr/typedefinition.xml']:
    show(u)
