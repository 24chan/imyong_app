import re, urllib.request, urllib.parse, http.cookiejar, ssl
UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()), urllib.request.HTTPSHandler(context=ctx))
def req(url, data=None):
    body = urllib.parse.urlencode(data).encode() if data else None
    try:
        r = op.open(urllib.request.Request(url, data=body, headers={'User-Agent': UA}), timeout=40)
        return r.read().decode(r.headers.get_content_charset() or 'utf-8', 'ignore')
    except Exception as e: return 'ERR ' + str(e)
clean = lambda s: re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', s)).strip()
g = req('https://www.goe.go.kr/recruit/ad/func/pb/hnfpPbancList.do?mi=10500')
i = g.find('사립학교 교원정규채용'); print('GOE OPT', g[i-1200:i+300])
s = req('https://work.sen.go.kr/work/search/recInfo/BD_selectSrchRecInfo.do')
i = s.find('<form'); print('\nSEN FORMS', [ (m.group(0)[:200]) for m in re.finditer(r'<form[^>]*>', s)])
print('SEN INPUTS', re.findall(r'<(?:input|select)[^>]*name="([^"]+)"', s)[:60])
j = s.find('사립'); print('SEN 사립', s[max(0,j-1500):j+500] if j>0 else None)
k = s.find('<tbody'); print('SEN TBODY', s[k:k+2500] if k>0 else s[s.find('BD_selectRecDetail')-1500:s.find('BD_selectRecDetail')+800])
