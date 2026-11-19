"""사립·정교사 채용 공고 출처 구조 확인용 (임시)"""
import re, sys, os, urllib.request, urllib.parse, http.cookiejar, ssl
UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()), urllib.request.HTTPSHandler(context=ctx))
def req(url, data=None):
    body = urllib.parse.urlencode(data).encode() if data else None
    r = op.open(urllib.request.Request(url, data=body, headers={'User-Agent': UA}), timeout=40)
    raw = r.read(); return raw.decode(r.headers.get_content_charset() or 'utf-8', 'ignore')
clean = lambda s: re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', s)).strip()
h = req('https://www.korea.kr/archive/recruitInfoList.do')
f = re.search(r'<form id="mainForm".*?</form>', h, re.S).group(0)
print('MAINFORM', re.findall(r'<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"', f))
print('CHECKS', re.findall(r'name="([^"]+)"[^>]*value="([^"]+)"[^>]*>\s*<label[^>]*>([^<]+)', h)[:60])
for kw in ['정교사', '신규교사']:
    h2 = req('https://www.korea.kr/archive/recruitInfoList.do', {'pageIndex': '1', 'metaId': 'job', 'srchWord': kw})
    tb = re.search(r'<tbody.*?</tbody>', h2, re.S)
    print('\n=== korea', kw, 'rows')
    if tb:
        rows = re.findall(r'<tr.*?</tr>', tb.group(0), re.S)
        print(len(rows)); print(rows[0][:1200] if rows else '')
        for r in rows[:10]: print(' -', clean(r)[:150])
    print('TOTAL', clean(h2[h2.find('총'):h2.find('총') + 80]))
g = req('https://www.goe.go.kr/recruit/ad/func/pb/hnfpPbancList.do', {'mi': '10500', 'currPage': '1', 'srchOcptNm': '기간제/사립교원', 'adminAt': 'N'})
print('\n=== goe pagingForm', re.findall(r'<form name="pagingForm".*?</form>', g, re.S)[0][:1500])
items = re.findall(r'<li[^>]*>.*?</li>', g[g.find('채용공고'):], re.S)
for it in [x for x in items if 'pbancSn' in x or 'fnView' in x or 'onclick' in x][:5]: print(' *', it[:600])
print(clean(g)[g.find('정교사') if '정교사' in g else 0:][:600])
