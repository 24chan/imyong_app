"""평가원 기출 게시판 찾기: 게시판별 글 제목, 글 보기 주소, 첨부 파일 주소 모양"""
import re
import ssl
import urllib.request
from html import unescape

UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
B = 'https://www.kice.re.kr'
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': UA}), timeout=30, context=ctx).read().decode('utf-8', 'ignore')
clean = lambda s: re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', ' ', s))).strip()

home = get(B + '/boardCnts/list.do?boardID=1500211&m=030306&s=kice')
# 메뉴에서 '기출' 들어간 링크
for href, txt in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', home, re.S):
    t = clean(txt)
    if re.search(r'기출|임용|교원', t) and len(t) < 40:
        print('MENU', t, '→', href[:140])
for bid, m in [('1500209', '030303'), ('1500210', '030304'), ('1500211', '030305'), ('1500212', '030306'), ('1500213', '030307')]:
    u = f'{B}/boardCnts/list.do?boardID={bid}&m={m}&s=kice'
    try:
        h = get(u)
        tt = clean((re.search(r'<title>(.*?)</title>', h, re.S) or [0, ''])[1])
        heads = [clean(x) for x in re.findall(r'<h[23][^>]*>(.*?)</h[23]>', h, re.S)][:4]
        print('\nBOARD', bid, m, tt, heads)
        rows = re.findall(r'<tr.*?</tr>', h, re.S)
        for tr in rows[1:8]:
            a = re.search(r'href="([^"]*view\.do[^"]*)"[^>]*>(.*?)</a>', tr, re.S)
            if a:
                print('  ROW', clean(a.group(2))[:70], '|', unescape(a.group(1))[:150])
        v = re.search(r'href="([^"]*view\.do[^"]*)"', h)
        if v:
            vu = unescape(v.group(1))
            vh = get(vu if vu.startswith('http') else B + vu if vu.startswith('/') else B + '/boardCnts/' + vu)
            for f in re.findall(r'href="([^"]*(?:fileDown|download|FileDown)[^"]*)"[^>]*>(.*?)</a>', vh, re.S)[:6]:
                print('  FILE', clean(f[1])[:60], '|', unescape(f[0])[:160])
            for f in re.findall(r"(fn_?[a-zA-Z]*[Dd]own[a-zA-Z]*\([^)]*\))", vh)[:6]:
                print('  JS', f[:160])
    except Exception as e:  # noqa: BLE001
        print('FAIL', bid, e)
