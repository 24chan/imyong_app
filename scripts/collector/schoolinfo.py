"""학교알리미 OpenAPI → 지역별 학교 정보 JSON (지도에서 학교를 누르면 보이는 정보)
결과: raw/schoolinfo/<지역>.json = {"year": 공시연도, "s": {"학교명|e/m/h": {...}}}
  st 학생 수, bm/gw 남/여 학생, cl 학급 수, avg 학급당 학생, t 교원 수, tm/tw 남/여 교원,
  coed 남녀공학 구분, est 설립연도, hp 홈페이지
출처: 학교알리미(schoolinfo.go.kr) 공시 정보. 키: SCHOOLINFO_KEY
"""
import json, os, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

KEY = os.environ.get('SCHOOLINFO_KEY', '').strip()
OUT = sys.argv[1] if len(sys.argv) > 1 else 'raw/schoolinfo'
BASE = 'https://www.schoolinfo.go.kr/openApi.do'
KIND = {'02': 'e', '03': 'm', '04': 'h'}
# 강원·전북 특별자치도는 새 코드(51·52)와 옛 코드(42·45)를 둘 다 시도
OLD_SIDO = {'51': '42', '52': '45'}


def sgg_codes():
    """시군구 코드(5자리) 목록: admdongkor 최신 행정구역에서"""
    import admdongkor as adk
    vers = adk.versions()
    keys = sorted(str(v.get('key') if isinstance(v, dict) else v) for v in (vers if isinstance(vers, (list, tuple)) else list(vers)))
    g = adk.get(keys[-1], 'sgg', crs='EPSG:4326')
    cols = list(g.columns)
    print('행정구역 열', cols)
    code_col = next((c for c in cols if c.lower() in ('sgg', 'sggcd', 'sgg_cd', 'sggcode')), None) or next(c for c in cols if 'sgg' in c.lower() and 'nm' not in c.lower())
    codes = sorted({str(v)[:5] for v in g[code_col] if str(v)[:5].isdigit()})
    out = []
    for c in codes:
        out.append(c)
        if c[:2] in OLD_SIDO:
            out.append(OLD_SIDO[c[:2]] + c[2:])
    return out
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


def call(api, sgg, knd, yr):
    q = urllib.parse.urlencode({'apiKey': KEY, 'apiType': api, 'pbanYr': yr, 'schulKndCode': knd, 'sidoCode': sgg[:2], 'sggCode': sgg})
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
    test, msg = call('63', '11140', '02', yr)
    if not test:
        print(yr, '자료 없음:', msg, '→ 작년')
        yr = str(int(yr) - 1)
    print('공시 연도', yr)
    codes = sgg_codes()
    print('시군구 코드', len(codes))

    def one(task):
        sgg, knd = task
        base, _ = call('0', sgg, knd, yr)
        if not base:
            return sgg, knd, [], {}
        extra = {api: call(api, sgg, knd, yr)[0] for api in ('63', '62', '22')}
        return sgg, knd, base, extra

    by = {}  # 학교코드 → 정보
    tasks = [(c, k) for k in KIND for c in codes]
    done = 0
    with ThreadPoolExecutor(max_workers=6) as ex:
        for sgg, knd, base, extra in ex.map(one, tasks):
            done += 1
            kind = KIND[knd]
            for r in base:
                code = r.get('SCHUL_CODE')
                reg = region_of(r.get('ADRCD_NM') or r.get('SCHUL_RDNMA'))
                if not code or not reg or code in by:
                    continue
                fy = str(r.get('FOND_YMD') or '')[:4]
                by[code] = {'_r': reg, '_n': r.get('SCHUL_NM', '').strip(), '_k': kind,
                            'coed': r.get('COEDU_SC_CODE') or None, 'est': int(fy) if fy.isdigit() else None,
                            'hp': (r.get('HMPG_ADRES') or '').strip() or None}
            for api, rows in extra.items():
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
            if done % 100 == 0:
                print('진행', done, '/', len(tasks), '학교', len(by))
    print('학교 수', len(by), '학생 수 있음', sum(1 for s in by.values() if 'st' in s), '교원 수 있음', sum(1 for s in by.values() if 't' in s))
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
