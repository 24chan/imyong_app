"""평가원 교원임용시험 기출문제 '목록'만 모으기 → raw/resources/kice_{elementary,secondary}.json
파일은 복사하지 않음 (지문 저작권 문제). 앱은 평가원 내려받기 주소(fileDown.do?fileSeq=…)를 바로 엶.
게시판: 초등 boardID=1500213(m=030307), 중등 boardID=1500212(m=030306)
사용: python kice.py raw/resources"""
import json
import os
import re
import ssl
import sys
import time
import urllib.request
from html import unescape

UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
B = 'https://www.kice.re.kr'
BOARDS = {'elementary': ('1500213', '030307'), 'secondary': ('1500212', '030306')}
MIN_YEAR = 2014  # 지금 시험 체제(서답형) 시작


def get(url):
    for i in range(4):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=40, context=ctx)
            return r.read().decode('utf-8', 'ignore')
        except Exception as e:  # noqa: BLE001
            print('  재시도', i + 1, e)
            time.sleep(5 * (i + 1))
    return ''


clean = lambda s: re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', ' ', s))).strip()


def rows(html):
    tb = re.search(r'<tbody.*?</tbody>', html, re.S)
    if not tb:
        return []
    out = []
    for tr in re.findall(r'<tr.*?</tr>', tb.group(0), re.S):
        tds = re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S)
        if len(tds) < 6:
            continue
        a = re.search(r'title="([^"]*)"', tds[3])
        files = [{'name': unescape(n), 'key': k} for k, n in re.findall(r"fn_fileDown\('([0-9a-f]+)'\);\"\s*title='([^']*)'", tds[5])]
        year = clean(tds[1])
        if not year.isdigit():
            continue
        out.append({'id': clean(tds[0]), 'year': int(year), 'kind': clean(tds[2]), 'title': unescape(a.group(1)) if a else clean(tds[3]),
                    'date': clean(tds[4]), 'files': files})
    return out


def crawl(level):
    bid, m = BOARDS[level]
    out = []
    for page in range(1, 200):
        rs = rows(get(f'{B}/boardCnts/list.do?boardID={bid}&m={m}&s=kice&page={page}'))
        if not rs:
            break
        out += rs
        if min(r['year'] for r in rs) < MIN_YEAR:
            break
        time.sleep(1.0)
    out = [r for r in out if r['year'] >= MIN_YEAR and r['files']]
    print(level, len(out), '건', '학년도', sorted({r['year'] for r in out})[-3:] if out else '')
    return out


def main(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    for level in BOARDS:
        items = crawl(level)
        if not items:
            print(level, '목록이 비어서 덮어쓰지 않음')
            continue
        bid, m = BOARDS[level]
        data = {'level': level, 'source': '한국교육과정평가원 기출문제', 'page': f'{B}/boardCnts/list.do?boardID={bid}&m={m}&s=kice',
                'file_url': f'{B}/boardCnts/fileDown.do?fileSeq=', 'updated': time.strftime('%Y-%m-%d'), 'items': items}
        with open(os.path.join(out_dir, f'kice_{level}.json'), 'w') as f:
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'raw/resources')
