"""전국초중등학교위치표준데이터(공공데이터포털 API) → 지역별 학교 목록 JSON (지도에 공립·사립 점 표시용)
환경변수 DATA_GO_KR_KEY (일반 인증키 Encoding). 결과: raw/schools/<지역>.json, raw/schools/meta.json
각 항목: [학교명, 학교급(e=초 m=중 h=고), 설립(p=공립 s=사립 n=국립), 위도, 경도, 시군구]
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.error
import urllib.request

KEY = os.environ.get('DATA_GO_KR_KEY', '').strip()
URL = 'https://api.data.go.kr/openapi/tn_pubr_public_elesch_mskul_lc_api'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'raw/schools'
REG = [('서울', 'seoul'), ('부산', 'busan'), ('대구', 'daegu'), ('인천', 'incheon'), ('광주', 'gwangju'), ('대전', 'daejeon'),
       ('울산', 'ulsan'), ('세종', 'sejong'), ('경기', 'gyeonggi'), ('강원', 'gangwon'), ('충청북', 'chungbuk'), ('충북', 'chungbuk'),
       ('충청남', 'chungnam'), ('충남', 'chungnam'), ('전라북', 'jeonbuk'), ('전북', 'jeonbuk'), ('전라남', 'jeonnam'), ('전남', 'jeonnam'),
       ('경상북', 'gyeongbuk'), ('경북', 'gyeongbuk'), ('경상남', 'gyeongnam'), ('경남', 'gyeongnam'), ('제주', 'jeju')]


def region_of(*texts):
    for t in texts:
        t = (t or '').strip()
        for k, v in REG:
            if t.startswith(k):
                return v
    return None


def get(page, rows=1000):
    key = KEY if '%' in KEY else urllib.parse.quote(KEY, safe='')
    url = f'{URL}?serviceKey={key}&pageNo={page}&numOfRows={rows}&type=json'
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'imyong-collector'}), timeout=60) as r:
                raw = r.read().decode('utf-8', 'replace')
            try:
                return json.loads(raw)
            except ValueError:
                print('JSON 아님:', raw[:400].replace(KEY, '***'))
                return {}
        except urllib.error.HTTPError as e:
            print('HTTP', e.code, e.read()[:300].decode('utf-8', 'replace').replace(KEY, '***'))
            time.sleep(5)
        except Exception as e:  # noqa: BLE001
            print('재시도', page, str(e).replace(KEY, '***'))
            time.sleep(5)
    raise RuntimeError('API 실패')


def body_of(d):
    b = (d.get('response') or d).get('body') or {}
    it = b.get('items') or []
    if isinstance(it, dict):
        it = it.get('item') or []
    if isinstance(it, dict):
        it = [it]
    return int(b.get('totalCount') or 0), it


def main():
    if not KEY:
        print('DATA_GO_KR_KEY 없음')
        return 1
    first = get(1)
    total, items = body_of(first)
    print('header', (first.get('response') or first).get('header'), 'total', total)
    if not total:
        print('응답 일부:', json.dumps(first, ensure_ascii=False)[:400])
    if items:
        print('항목 예시 키:', list(items[0].keys()))
    pages = (total + 999) // 1000
    for p in range(2, pages + 1):
        items += body_of(get(p))[1]
    by = {}
    skipped = 0
    for it in items:
        if (it.get('operSttus') or '운영') not in ('운영', ''):
            continue
        kind = {'초등학교': 'e', '중학교': 'm', '고등학교': 'h'}.get(it.get('schoolSe'))
        fond = {'공립': 'p', '사립': 's', '국립': 'n'}.get(it.get('fondType'))
        try:
            lat, lng = float(it.get('latitude')), float(it.get('longitude'))
        except (TypeError, ValueError):
            skipped += 1
            continue
        reg = region_of(it.get('rdnmadr'), it.get('lnmadr'), it.get('cddcNm'))  # 주소 우선 (광주 학교가 전남 교육청 코드로 들어온 경우 대비)
        if not (kind and fond and reg and 33 < lat < 39 and 124 < lng < 132):
            skipped += 1
            continue
        addr = it.get('rdnmadr') or it.get('lnmadr') or ''
        sigungu = (addr.split(' ')[1:2] or [''])[0]
        by.setdefault(reg, []).append([it.get('schoolNm', ''), kind, fond, round(lat, 5), round(lng, 5), sigungu])
    os.makedirs(OUT, exist_ok=True)
    meta = {'updated': time.strftime('%Y-%m-%d'), 'source': '공공데이터포털 전국초중등학교위치표준데이터 (한국교육시설안전원)',
            'counts': {}}
    for reg, rows in by.items():
        rows.sort(key=lambda r: (r[1], r[0]))
        json.dump(rows, open(os.path.join(OUT, f'{reg}.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
        meta['counts'][reg] = {k: sum(1 for r in rows if r[1] == k) for k in 'emh'}
    json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
    print('지역', len(by), '학교', sum(len(v) for v in by.values()), '제외', skipped)
    return 0


if __name__ == '__main__':
    sys.exit(main())
