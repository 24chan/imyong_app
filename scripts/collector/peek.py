"""디버그: 주소를 열어 '임용' 링크 앞부분과 form 구조를 출력. 사용: python peek.py URL..."""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import crawl  # noqa: E402

for url in sys.argv[1:]:
    print('\n#####', url)
    try:
        final, html = crawl.get(url)
    except Exception as e:  # noqa: BLE001
        print('  실패', type(e).__name__, e)
        continue
    print('  final', final, 'len', len(html))
    n = 0
    for t, h, a in crawl.anchors(html, final):
        if '임용' in t:
            print('  -', t[:70], '|', h[:110])
            n += 1
            if n >= 4:
                break
    for fm in re.finditer(r'<form[^>]*>.*?</form>', html, re.S):
        tag = re.findall(r'<form[^>]*>', fm.group(0))[0]
        ins = re.findall(r'<input[^>]*>', fm.group(0))
        names = [re.sub(r'\s+', ' ', i)[:90] for i in ins if 'hidden' in i][:12]
        if names:
            print('  FORM', tag[:160], names)
    for kw in ('없습니다', 'alert(', 'tbody', 'q_rowPerPage', 'q_currPage'):
        i = html.find(kw)
        if i >= 0:
            print(f'  [{kw}]', re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html[i - 100:i + 500]))[:300])
    for m in re.finditer(r'opMovePage', html):
        print('  ctx', re.sub(r'\s+', ' ', html[max(0, m.start() - 200):m.start() + 200])[:400])
        break
