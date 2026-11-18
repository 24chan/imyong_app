"""자동 수집기 0단계: GitHub Actions 서버에서 17개 교육청 사이트에 접속되는지 확인
(해외 IP를 막는 공공기관 사이트가 있어서 먼저 확인)
결과는 로그와 probe_result.json 으로 남김
"""
import json
import time
import urllib.request

SITES = {
    'seoul': ['https://www.sen.go.kr/user/bbs/BD_selectBbsList.do?q_bbsSn=1094'],
    'busan': ['https://www.pen.go.kr/main/na/ntt/selectNttList.do?mi=30361&bbsId=2342'],
    'daegu': ['https://www.dge.go.kr/main/main.do'],
    'incheon': ['https://www.ice.go.kr/ice/na/ntt/selectNttList.do?mi=10991&bbsId=1777'],
    'gwangju': ['https://gen.go.kr/xboard/board.php?tbnum=49'],
    'daejeon': ['https://www.dje.go.kr/main.do?s=djeNew'],
    'ulsan': ['https://use.go.kr/use/index.do'],
    'sejong': ['https://www.sje.go.kr/sje/main.do'],
    'gyeonggi': ['https://www.goe.go.kr/resource/goe/na/bbs_2583/2026/09/31e2613b-70c6-46ac-9ea3-e261b4353116.pdf'],
    'gangwon': ['https://www.gwe.go.kr/main/bbs/list.do?key=m2307210582250'],
    'chungbuk': ['https://www.cbe.go.kr/'],
    'chungnam': ['https://www.cne.go.kr/'],
    'jeonbuk': ['https://www.jbe.go.kr/'],
    'jeonnam': ['https://www.jne.go.kr/'],
    'gyeongbuk': ['https://www.gbe.kr/main/na/ntt/selectNttList.do?mi=3538&bbsId=1882'],
    'gyeongnam': ['https://www.gne.go.kr/user/bbs/BD_selectBbsList.do?q_bbsSn=1251'],
    'jeju': ['https://www.jje.go.kr/'],
}

UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'


def probe(url):
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9'})
        with urllib.request.urlopen(req, timeout=25) as r:
            body = r.read(400_000)
            text = body.decode('utf-8', 'ignore')
            return {
                'ok': True,
                'status': r.status,
                'final_url': r.geturl(),
                'bytes': len(body),
                'type': r.headers.get('Content-Type'),
                'has_임용': '임용' in text,
                'has_2027': '2027' in text,
                'sec': round(time.time() - t0, 1),
            }
    except Exception as e:  # noqa: BLE001
        return {'ok': False, 'error': f'{type(e).__name__}: {e}'[:200], 'sec': round(time.time() - t0, 1)}


def main():
    result = {}
    for region, urls in SITES.items():
        for u in urls:
            res = probe(u)
            result[region] = {'url': u, **res}
            mark = 'OK ' if res['ok'] else 'ERR'
            print(f"{mark} {region:10s} {res.get('status', '')} {res.get('bytes', '')}B 임용={res.get('has_임용')} 2027={res.get('has_2027')} {res.get('error', '')}")
    ok = sum(1 for v in result.values() if v['ok'])
    print(f'\n접속 성공 {ok}/17')
    with open('probe_result.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
