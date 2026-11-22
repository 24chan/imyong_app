"""법령 본문 받는 길 + NCIC 교육과정 파일 목록 찾기"""
import re
import ssl
import urllib.parse
import urllib.request
from html import unescape

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
def get(u, data=None):
    r = urllib.request.urlopen(urllib.request.Request(u, data=data, headers={'User-Agent': UA}), timeout=30, context=ctx)
    return r.read().decode(r.headers.get_content_charset() or 'utf-8', 'ignore')
clean = lambda s: re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', ' ', s))).strip()

h = get('https://www.law.go.kr/' + urllib.parse.quote('법령/교육공무원법'))
seq = re.findall(r'lsiSeq[=:\s"\']+(\d+)', h)[:5]
print('lsiSeq', seq)
for m in re.findall(r'(src|href|action)="([^"]*(?:lsInfo|lsEfInfo|lsBdy)[^"]*)"', h)[:8]:
    print('LINK', m[1][:150])
if seq:
    for path in [f'/LSW/lsInfoP.do?lsiSeq={seq[0]}', f'/LSW/lsInfoR.do?lsiSeq={seq[0]}', f'/lsInfoP.do?lsiSeq={seq[0]}']:
        try:
            t = get('https://www.law.go.kr' + path)
            arts = re.findall(r'제\d+조(?:의\d+)?\s*\(([^)]{1,30})\)', clean(t))
            print('TRY', path, len(t), '조문수', len(arts), arts[:6])
            i = clean(t).find('제1조')
            print('   ', clean(t)[i:i + 300])
        except Exception as e:  # noqa: BLE001
            print('TRY', path, e)

print('\n== NCIC')
n = get('https://ncic.go.kr')
for href, txt in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', n, re.S):
    t = clean(txt)
    if re.search(r'교육과정|고시|원문|문서|총론|각론|자료', t) and len(t) < 30:
        print('NLINK', t, '→', href[:150])
