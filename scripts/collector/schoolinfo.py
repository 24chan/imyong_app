"""학교알리미 OpenAPI → 지역별 학교 정보 JSON (지도에서 학교를 누르면 보이는 정보)
결과: raw/schoolinfo/<지역>.json = {"year": 공시연도, "s": {"학교명|e/m/h": {...}}}
  st 학생 수, bm/gw 남/여 학생, cl 학급 수, avg 학급당 학생, t 교원 수, tm/tw 남/여 교원,
  coed 남녀공학 구분, est 설립연도, hp 홈페이지
출처: 학교알리미(schoolinfo.go.kr) 공시 정보. 키: SCHOOLINFO_KEY
"""
import json, os, sys, time, urllib.parse, urllib.request

KEY = os.environ.get('SCHOOLINFO_KEY', '').strip()
OUT = sys.argv[1] if len(sys.argv) > 1 else 'raw/schoolinfo'
BASE = 'https://www.schoolinfo.go.kr/openApi.do'
KIND = {'02': 'e', '03': 'm', '04': 'h'}
# 학교알리미 시도 코드(옛 코드와 새 특별자치도 코드 모두 시도, 같은 학교는 한 번만)
SIDO_CODES = ['11', '26', '27', '28', '29', '30', '31', '36', '41', '42', '51', '43', '44', '45', '52', '46', '47', '48', '50']
PREFIX = [('서울', 'seoul'), ('부산', 'busan'), ('대구', 'daegu'), ('인천', 'incheon'), ('광주', 'gwangju'), ('대전', 'daejeon'), ('울산', 'ulsan'),
          ('세종', 'sejong'), ('경기', 'gyeonggi'), ('강원', 'gangwon'), ('충청북', 'chungbuk'), ('충청남', 'chungnam'), ('전북', 'jeonbuk'),
          ('전라북', 'jeonbuk'), ('전라남', 'jeonnam'), ('전남', 'jeonnam'), ('경상북', 'gyeongbuk'), ('경상남', 'gyeongnam'), ('제주', 'jeju')]
GWANGJU_GU = {'동구', '서구', '남구', '북구', '광산구'}


def region_of(addr):
    addr = (addr or '').strip()
    first, _, rest = addr.partition(' ')
    if first.startswith('전남광주'):  # 2026.7 통합: 임용은 아직 따로 → 광주 5개 구만 광주
        return 'gwangju' if rest.split(' ')[0] in GWANGJU_GU else 'jeonnam'
    for k, v in PREFIX:
        if first.startswith(k):
            return v
    return None


def call(api, sido, knd, yr):
    q = urllib.parse.urlencode({'apiKey': KEY, 'apiType': api, 'pbanYr': yr, 'schulKndCode': knd, 'sidoCode': sido})
    for i in range(3):
        try:
            req = urllib.request.Request(f'{BASE}?{q}', headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=60) as r:
                d = json.loads(r.read().decode('utf-8', 'replace'))
            return d.get('list') or [], d.get('resultMsg')
        except Exception as e:  # noqa: BLE001
            if i == 2:
                return [], f'오류 {str(e)[:80]}'
            time.sleep(3)


def num(v):
    try:
        return int(str(v).split('(')[0].replace(',', '').strip())
    except Exception:  # noqa: BLE001
        try:
            return round(float(v), 1)
        except Exception:  # noqa: BLE001
            return None


def main():
    if not KEY:
        print('SCHOOLINFO_KEY 없음 → 건너뜀')
        return
    yr = os.environ.get('YEAR') or time.strftime('%Y')
    # 올해 자료가 아직 없으면(5월 공시 전) 작년
    test, msg = call('63', '11', '02', yr)
    if not test:
        print(yr, '자료 없음:', msg, '→ 작년')
        yr = str(int(yr) - 1)
    print('공시 연도', yr)
    by = {}  # 학교코드 → 정보
    for knd, kind in KIND.items():
        for sido in SIDO_CODES:
            base, _ = call('0', sido, knd, yr)
            if not base:
                continue
            for r in base:
                code = r.get('SCHUL_CODE')
                reg = region_of(r.get('ADRCD_NM') or r.get('SCHUL_RDNMA'))
                if not code or not reg or code in by:
                    continue
                fy = str(r.get('FOND_YMD') or '')[:4]
                by[code] = {'_r': reg, '_n': r.get('SCHUL_NM', '').strip(), '_k': kind,
                            'coed': r.get('COEDU_SC_CODE') or None, 'est': int(fy) if fy.isdigit() else None,
                            'hp': (r.get('HMPG_ADRES') or '').strip() or None}
            for api in ('63', '62', '22'):
                rows, _ = call(api, sido, knd, yr)
                for r in rows:
                    s = by.get(r.get('SCHUL_CODE'))
                    if not s or r.get('PBAN_EXCP_YN') == 'Y':
                        continue
                    if api == '63':
                        s.update(st=num(r.get('SUM')), bm=num(r.get('COL_MSUM')), gw=num(r.get('COL_WSUM')))
                    elif api == '62':
                        s.update(cl=num(r.get('COL_SUM')), avg=num(r.get('AVG_FGR_SUM')))
                    else:
                        s.update(t=num(r.get('COL_S')), tm=num(r.get('COL_SM')), tw=num(r.get('COL_SW')))
            print(knd, sido, '누적', len(by))
    out = {}
    for s in by.values():
        key = f"{s['_n']}|{s['_k']}"
        rec = {k: v for k, v in s.items() if not k.startswith('_') and v is not None}
        out.setdefault(s['_r'], {})[key] = rec
    os.makedirs(OUT, exist_ok=True)
    for reg, items in out.items():
        path = os.path.join(OUT, f'{reg}.json')
        json.dump({'year': int(yr), 's': items}, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))
        print(reg, len(items), os.path.getsize(path) // 1024, 'KB')
    json.dump({'year': int(yr), 'updated': time.strftime('%Y-%m-%d'), 'count': len(by),
               'source': '학교알리미(schoolinfo.go.kr) 공시 정보'}, open(os.path.join(OUT, 'meta.json'), 'w'), ensure_ascii=False)


if __name__ == '__main__':
    main()
