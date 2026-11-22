"""평가원 기출 게시판 구조 보기 (초등 1500213, 중등 1500212)"""
import re
import ssl
import urllib.request
from html import unescape

UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
B = 'https://www.kice.re.kr'
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': UA}), timeout=30, context=ctx).read().decode('utf-8', 'ignore')

for bid, m in [('1500213', '030307'), ('1500212', '030306')]:
    h = get(f'{B}/boardCnts/list.do?boardID={bid}&m={m}&s=kice')
    i = h.find('<tbody')
    print('\n=== LIST', bid, 'tbody at', i)
    print(h[i:i + 2500] if i >= 0 else h[h.find('boardCnts/view'):][:2500])
    v = re.search(r'(/boardCnts/view\.do\?[^"\']+)', h) or re.search(r"(view\.do\?[^\"']+)", h)
    if v:
        vu = unescape(v.group(1))
        vu = vu if vu.startswith('/') else '/boardCnts/' + vu
        vh = get(B + vu)
        print('\n=== VIEW', vu)
        j = vh.find('첨부')
        print(vh[j - 200:j + 2500] if j >= 0 else vh[:1500])
