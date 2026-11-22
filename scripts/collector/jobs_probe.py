"""B-7 조사용: 사립 정규 채용 공고를 더 모을 수 있는 곳 찾기 (읽기만, 저장 안 함)
① 정책브리핑(나라일터) 최근 공고 중 '교사/교원' + '법인/사립/정규/신규' 인데 지금 거르기에서 빠진 것 → 지역별로 보여 줌
② 17개 교육청 첫 화면이 해외(GitHub 서버)에서 열리는지, '구인·채용' 메뉴 주소가 무엇인지"""
import re
import sys
import time
import urllib.request
from collections import Counter, defaultdict
from datetime import date, timedelta

sys.path.insert(0, 'scripts/collector')
import jobs  # noqa: E402

OFFICES = {
    'seoul': 'https://www.sen.go.kr', 'busan': 'https://www.pen.go.kr', 'daegu': 'https://www.dge.go.kr', 'incheon': 'https://www.ice.go.kr',
    'gwangju': 'https://www.gen.go.kr', 'daejeon': 'https://www.dje.go.kr', 'ulsan': 'https://www.use.go.kr', 'sejong': 'https://www.sje.go.kr',
    'gyeonggi': 'https://www.goe.go.kr', 'gangwon': 'https://www.gwe.go.kr', 'chungbuk': 'https://www.cbe.go.kr', 'chungnam': 'https://www.cne.go.kr',
    'jeonbuk': 'https://www.jbe.go.kr', 'jeonnam': 'https://www.jne.go.kr', 'gyeongbuk': 'https://www.gbe.kr', 'gyeongnam': 'https://www.gne.go.kr',
    'jeju': 'https://www.jje.go.kr',
}


def part1():
    start = (date.today() - timedelta(days=400)).isoformat()
    cand = {}
    for kw in ['사립', '법인', '정교사', '신규교사', '교원 채용', '교사 채용', '정규교원']:
        for page in range(1, 25):
            html = jobs.post(jobs.LIST, {'pageIndex': page, 'metaId': 'job', 'srchWord': kw, 'startDate': start,
                                         'endDate': date.today().isoformat(), 'srchDateType': 'regiDate'})
            rs = jobs.rows(html)
            if not rs:
                break
            for r in rs:
                t = r['title']
                if jobs.TEACH.search(t) and re.search(r'법인|사립|정규|신규|정교사|공개', t) and not re.search(r'기간제|시간\s*강사|계약제|대체|공무직|실무사|사무직원|행정', t):
                    cand[r['id']] = r
            time.sleep(1.0)
    kept = {k: r for k, r in cand.items() if jobs.is_teacher_job(r)}
    miss = {k: r for k, r in cand.items() if k not in kept}
    by = defaultdict(list)
    for r in miss.values():
        by[jobs.region_of(r['org'], r['title'])].append(r)
    print('\n== ① 후보', len(cand), '지금 거르기 통과', len(kept), '빠진 것', len(miss))
    print('통과 지역:', Counter(jobs.region_of(r['org'], r['title']) for r in kept.values()).most_common())
    for reg, rs in sorted(by.items(), key=lambda x: -len(x[1])):
        print(f'\n[{reg}] 빠진 {len(rs)}건')
        for r in rs[:12]:
            print('  -', r['posted'], '|', r['org'][:30], '|', r['title'][:80])


def part2():
    print('\n== ② 교육청 누리집')
    for reg, base in OFFICES.items():
        try:
            r = jobs.OP.open(urllib.request.Request(base, headers={'User-Agent': jobs.UA}), timeout=25)
            h = r.read().decode(r.headers.get_content_charset() or 'utf-8', 'ignore')
            links = set()
            for href, txt in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', h, re.S):
                t = jobs.clean(txt)
                if re.search(r'구인|채용|일자리|인력', t) and len(t) < 30:
                    links.add(f'{t} → {href[:120]}')
            print(f'[{reg}] 열림 {r.status} 길이 {len(h)}')
            for l in sorted(links)[:10]:
                print('   ', l)
        except Exception as e:  # noqa: BLE001
            print(f'[{reg}] 안 열림: {e}')


if __name__ == '__main__':
    part2()
    part1()
