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
g = req('https://www.goe.go.kr/recruit/ad/func/pb/hnfpPbancList.do', {'mi': '10500', 'currPage': '1', 'srchOcptNm': '기간제/사립교원', 'srchOcptCd': 'A', 'adminAt': 'N', 'sysId': 'recruit', 'srchEcptDl': 'Y', 'cmmnCode': 'GOE_AREA_CODE'})
i = g.find('pbancSn'); print('GOE', len(g)); 
for m in list(re.finditer(r'fnView|goView|pbancSn\W', g))[:3]: print('CTX', g[max(0,m.start()-1500):m.start()+300].replace('\n',' ')[:1800]); print('----')
for kw in ['정교사','신규','사립']:
    j = g.find(kw); print(kw, clean(g[max(0,j-300):j+300]) if j>0 else None)
for u in ['https://work.sen.go.kr/work/search/recInfo/BD_selectSrchRecInfo.do', 'https://work.sen.go.kr/work/main/main.do', 'https://job.pusan.ac.kr/', 'https://www.pen.go.kr/', 'https://www.sen.go.kr/user/bbs/BD_selectBbsList.do?q_bbsSn=1151']:
    h = req(u); print('\n####', u, len(h), clean(h)[:300])
    for t in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>([^<]{2,40})</a>', h):
        if re.search('채용|구인|교원', t[1]): print('  ', t[1].strip(), t[0][:120])
