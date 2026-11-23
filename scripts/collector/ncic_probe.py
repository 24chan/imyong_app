"""조사: NCIC(국가교육과정정보센터)에서 2022 개정 교육과정 원문 파일 주소 찾기 → <out>/ (확인용)
첫 화면 + 교육과정 관련 링크 쪽을 저장하고, 파일 내려받기처럼 보이는 링크·자바스크립트 함수를 links.json에 모음"""
import json
import os
import re
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import crawl  # noqa: E402

crawl.DELAY[0] = 1.0
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
START = ['https://www.law.go.kr/행정규칙/초ㆍ중등학교 교육과정', 'https://www.law.go.kr/행정규칙/초ㆍ중등학교교육과정', 'https://www.law.go.kr/admRulSc.do?menuId=5&query=' + urllib.parse.quote('초ㆍ중등학교 교육과정')]
KEY = re.compile(r'admRulInfoP|admRulLsInfoP|lsBylInfo|bylList|별책|별표|교육과정|고시|원문|문서|총론|각론|2022|자료|inventory|org/|dwn|file|down', re.I)
FILE = re.compile(r'flDownload|bylFl|\.pdf|\.hwp|fileDown|download|dwn|attach|FileDown|fn_?[a-zA-Z]*[Dd]own', re.I)
seen, queue, found, log = set(), list(START), [], []
n = 0
while queue and n < 20:
    url = queue.pop(0)
    if url in seen:
        continue
    seen.add(url)
    try:
        final, html = crawl.get(url, timeout=50)
    except Exception as e:  # noqa: BLE001
        log.append({'url': url, 'error': str(e)[:200]})
        continue
    n += 1
    fn = f'{n:02d}' + ('.js' if url.endswith('.js') else '.html')
    open(os.path.join(out, fn), 'w').write(html)
    log.append({'url': url, 'final': final, 'file': fn, 'len': len(html)})
    host = urllib.parse.urlparse(final).netloc
    for t, h, a in crawl.anchors(html, final):
        blob = f'{t} {h} {a}'
        a = json.dumps(a, ensure_ascii=False)
        if FILE.search(blob):
            found.append({'page': final, 'text': t[:80], 'href': h[:300], 'attrs': a[:300]})
        if re.search(r'(ncic\.(go|re)|law\.go)\.kr$', host.split(':')[0]) and re.search(r'(ncic\.(go|re)|law\.go)\.kr$', urllib.parse.urlparse(h).netloc) and KEY.search(t + ' ' + h) and h not in seen and len(queue) < 120:
            queue.append(h)
    for m in re.finditer(r'(?:onclick|href)\s*=\s*"(javascript:)?\s*([A-Za-z_]+\([^"]{0,200}\))"', html):
        if FILE.search(m.group(2)):
            found.append({'page': final, 'js': m.group(2)[:300]})
    for m in re.finditer(r'function\s+([A-Za-z_]*[Dd]own[A-Za-z_]*)\s*\(([^)]*)\)\s*\{(.{0,600})', html, re.S):
        found.append({'page': final, 'func': m.group(1), 'args': m.group(2), 'body': re.sub(r'\s+', ' ', m.group(3))[:600]})
json.dump({'log': log, 'found': found}, open(os.path.join(out, 'links.json'), 'w'), ensure_ascii=False, indent=1)
for l in log:
    print('[쪽]', l)
print('찾은 링크', len(found))
