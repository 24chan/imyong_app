"""수집기 1단계 준비: 교육청 임용 게시판 목록에서 '2027' + 임용 관련 링크가 어떻게 생겼는지 조사
(사이트마다 게시판 구조가 달라서, 실제 HTML의 링크 모양을 먼저 확인)
"""
import re
import ssl
import urllib.request
from html import unescape
from urllib.parse import urljoin

BOARDS = {
    'seoul': 'https://www.sen.go.kr/user/bbs/BD_selectBbsList.do?q_bbsSn=1094',
    'busan': 'https://www.pen.go.kr/main/na/ntt/selectNttList.do?mi=30361&bbsId=2342',
    'daegu': 'https://www.dge.go.kr/main/main.do',
    'incheon': 'https://www.ice.go.kr/ice/na/ntt/selectNttList.do?mi=10991&bbsId=1777',
    'gwangju': 'https://gen.go.kr/xboard/board.php?tbnum=49',
    'daejeon': 'https://www.dje.go.kr/main.do?s=djeNew',
    'ulsan': 'https://use.go.kr/use/index.do',
    'sejong': 'https://www.sje.go.kr/sje/main.do',
    'gyeonggi': 'https://www.goe.go.kr/goe/na/ntt/selectNttList.do?mi=10154&bbsId=2583',
    'gangwon': 'https://www.gwe.go.kr/main/bbs/list.do?key=bTIzMDcyMTA1ODIyNTA=',
    'chungbuk': 'https://www.cbe.go.kr/',
    'chungnam': 'https://www.cne.go.kr/',
    'jeonbuk': 'https://www.jbe.go.kr/',
    'jeonnam': 'https://www.jne.go.kr/',
    'gyeongbuk': 'https://www.gbe.kr/main/na/ntt/selectNttList.do?mi=3538&bbsId=1882',
    'gyeongnam': 'https://www.gne.go.kr/user/bbs/BD_selectBbsList.do?q_bbsSn=1251',
    'jeju': 'https://www.jje.go.kr/',
}
UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'
CTX_LOOSE = ssl.create_default_context()
CTX_LOOSE.check_hostname = False
CTX_LOOSE.verify_mode = ssl.CERT_NONE  # 울산처럼 인증서 체인이 불완전한 곳 (공개 공고 읽기 전용)

A_RE = re.compile(r'<a\b([^>]*)>(.*?)</a>', re.S | re.I)
ATTR_RE = re.compile(r'(href|onclick|data-[\w-]+)\s*=\s*"([^"]*)"', re.I)
TAG_RE = re.compile(r'<[^>]+>')


def get(url, loose=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9'})
    with urllib.request.urlopen(req, timeout=40, context=CTX_LOOSE if loose else None) as r:
        raw = r.read()
        ct = r.headers.get_content_charset() or 'utf-8'
        return r.geturl(), raw.decode(ct, 'ignore')


def main():
    for region, url in BOARDS.items():
        print(f'\n===== {region} {url}')
        for loose in (False, True):
            try:
                final, html = get(url, loose)
                break
            except Exception as e:  # noqa: BLE001
                err = f'{type(e).__name__}: {e}'
                html = None
        if html is None:
            print('  실패:', err[:150])
            continue
        print(f'  final={final} len={len(html)}')
        if len(html) < 3000:
            print('  짧은 페이지:', re.sub(r'\s+', ' ', html)[:600])
        n = 0
        for attrs, inner in A_RE.findall(html):
            text = re.sub(r'\s+', ' ', unescape(TAG_RE.sub('', inner))).strip()
            if '2027' not in text or not any(k in text for k in ('임용', '교사', '선정경쟁')):
                continue
            at = dict((k.lower(), v) for k, v in ATTR_RE.findall(attrs))
            href = at.get('href', '')
            print(f'  - {text[:90]}')
            print(f'      href={urljoin(final, unescape(href))[:200]}')
            for k, v in at.items():
                if k != 'href':
                    print(f'      {k}={unescape(v)[:160]}')
            n += 1
            if n >= 6:
                break
        if n == 0:
            print('  2027 임용 링크 없음')


if __name__ == '__main__':
    main()
