"""평가원 fn_fileDown 정의와 실제 내려받기 주소 확인"""
import re
import ssl
import urllib.request

UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
B = 'https://www.kice.re.kr'
h = urllib.request.urlopen(urllib.request.Request(f'{B}/boardCnts/list.do?boardID=1500212&m=030306&s=kice&page=2', headers={'User-Agent': UA}), timeout=30, context=ctx).read().decode('utf-8', 'ignore')
i = h.find('function fn_fileDown')
print(h[i:i + 800])
for js in re.findall(r'<script[^>]+src="([^"]+)"', h):
    if 'board' in js.lower() or 'common' in js.lower():
        try:
            t = urllib.request.urlopen(urllib.request.Request(B + js if js.startswith('/') else js, headers={'User-Agent': UA}), timeout=30, context=ctx).read().decode('utf-8', 'ignore')
            j = t.find('fn_fileDown')
            if j >= 0:
                print('IN', js, t[j:j + 600])
        except Exception as e:  # noqa: BLE001
            print('jsfail', js, e)
print('pages:', sorted(set(re.findall(r'page=(\d+)', h)), key=int)[-3:])
k = re.search(r"fn_fileDown\('([0-9a-f]+)'\)", h).group(1)
for cand in [f'/boardCnts/fileDown.do?fileSeq={k}', f'/common/fileDown.do?fileSeq={k}', f'/boardCnts/fileDown.do?m=030306&s=kice&fileSeq={k}']:
    try:
        r = urllib.request.urlopen(urllib.request.Request(B + cand, headers={'User-Agent': UA}), timeout=30, context=ctx)
        b = r.read(8)
        print('TRY', cand, r.status, r.headers.get('Content-Type'), r.headers.get('Content-Disposition'), b)
    except Exception as e:  # noqa: BLE001
        print('TRY', cand, e)
