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
g = req('https://www.goe.go.kr/recruit/ad/func/pb/hnfpPbancList.do', {'mi': '10500', 'currPage': '1', 'srchOcptCd': 'D', 'srchOcptNm': '사립학교 교원정규채용', 'srchEcptDl': 'N'})
i = g.find('function goView'); print('GOVIEW', g[i:i+700])
for q in ['q_jobCategory=jd001', 'q_jobCategory=jd002']:
    s = req('https://work.sen.go.kr/work/search/recInfo/BD_selectSrchRecInfo.do?' + q + '&q_rowPerPage=50')
    i = s.find('rcrtSn=')
    j = s.rfind('<li', 0, i)
    print('\nSEN', q, s[j:j+2200])
    k = s.find('totalCount'); print('TOTAL', clean(s[k-200:k+200]) if k > 0 else clean(s[s.find('총'):s.find('총')+60]))
    print([clean(x)[:80] for x in re.findall(r'<li[^>]*>(?:(?!</li>).)*rcrtSn=\d+(?:(?!</li>).)*</li>', s, re.S)][:12])
