"""공개 자료 앱 안 보기 조사: 평가원(기출)·법령정보센터·NCIC(교육과정)가 해외(GitHub 서버)에서 열리는지, 목록 구조는 어떤지"""
import re
import ssl
import urllib.request

UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
URLS = [
    'https://www.kice.re.kr',
    'https://www.kice.re.kr/boardCnts/list.do?boardID=1500211&m=030306&s=kice',
    'https://www.kice.re.kr/boardCnts/list.do?type=default&page=1&m=030306&s=kice&boardID=1500211',
    'https://www.law.go.kr/법령/교육공무원법',
    'https://www.law.go.kr/lsInfoP.do?lsiSeq=0&efYd=0',
    'https://www.law.go.kr/DRF/lawSearch.do?OC=test&target=law&type=XML&query=교육공무원법',
    'https://ncic.go.kr',
    'https://ncic.go.kr/mobile.dwn.ogf.inventoryList.do',
]
for u in URLS:
    try:
        q = urllib.request.quote(u, safe=':/?&=.%')
        r = urllib.request.urlopen(urllib.request.Request(q, headers={'User-Agent': UA}), timeout=30, context=ctx)
        h = r.read().decode(r.headers.get_content_charset() or 'utf-8', 'ignore')
        title = re.search(r'<title>(.*?)</title>', h, re.S)
        print('OK', r.status, len(h), u, '|', (title.group(1).strip()[:60] if title else ''))
        for m in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>([^<]{2,40})</a>', h)[:0]:
            pass
        if 'kice' in u:
            for t in re.findall(r'(\d{4}학년도[^<]{0,60}(?:임용|교사)[^<]{0,40})', h)[:15]:
                print('   ', t.strip())
            for m in set(re.findall(r'boardID=\d+[^"\']*m=0303\d+[^"\']*', h)):
                print('    link', m[:100])
    except Exception as e:  # noqa: BLE001
        print('FAIL', u, e)
