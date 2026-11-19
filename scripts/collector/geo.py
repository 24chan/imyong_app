"""시군구·읍면동 경계(admdongkor, 통계청 SGIS 기반, CC BY 4.0) → 지역별 JSON (학교 지도 배경)
결과: raw/geo/<지역>.json      = {"version": 키, "sgg": [{"n": 시군구, "c": [lng,lat], "p": [[[lng,lat],...], ...]}]}
      raw/geo/dong/<지역>.json = {"version": 키, "dong": [{"n": 읍면동, "g": 시군구, "c": [lng,lat], "p": [...]}]}
"""
import json
import os
import sys
import time

import admdongkor as adk
from shapely.geometry import mapping

OUT = sys.argv[1] if len(sys.argv) > 1 else 'raw/geo'
SIDO = [('서울', 'seoul'), ('부산', 'busan'), ('대구', 'daegu'), ('인천', 'incheon'), ('광주', 'gwangju'), ('대전', 'daejeon'), ('울산', 'ulsan'),
        ('세종', 'sejong'), ('경기', 'gyeonggi'), ('강원', 'gangwon'), ('충청북', 'chungbuk'), ('충북', 'chungbuk'), ('충청남', 'chungnam'), ('충남', 'chungnam'),
        ('전북', 'jeonbuk'), ('전라북', 'jeonbuk'), ('전라남', 'jeonnam'), ('전남', 'jeonnam'), ('경상북', 'gyeongbuk'), ('경북', 'gyeongbuk'),
        ('경상남', 'gyeongnam'), ('경남', 'gyeongnam'), ('제주', 'jeju')]
GWANGJU_GU = {'동구', '서구', '남구', '북구', '광산구'}


def region_of(sido, sgg):
    sido = (sido or '').strip()
    if sido.startswith('전남광주'):  # 2026.7 통합: 임용은 아직 따로 → 광주 5개 구만 광주
        return 'gwangju' if sgg in GWANGJU_GU else 'jeonnam'
    for k, v in SIDO:
        if sido.startswith(k):
            return v
    return None


def rings(geom, nd=4):
    out = []
    polys = [geom] if geom.geom_type == 'Polygon' else list(geom.geoms) if geom.geom_type == 'MultiPolygon' else []
    for p in polys:
        if p.area < 1e-6:  # 아주 작은 섬은 생략 (약 0.01 km²)
            continue
        ring = [[round(x, nd), round(y, nd)] for x, y in p.exterior.coords]
        if len(ring) >= 4:
            out.append(ring)
    return out


def label_pt(geom):
    # 이름 놓을 자리: 가장 큰 덩어리 안쪽의 점
    polys = [geom] if geom.geom_type == 'Polygon' else list(geom.geoms) if geom.geom_type == 'MultiPolygon' else []
    if not polys:
        return None
    big = max(polys, key=lambda p: p.area)
    pt = big.representative_point()
    return [round(pt.x, 4), round(pt.y, 4)]


def get_dong(key, n_sgg):
    # 읍면동 단계 이름이 버전마다 다를 수 있어 차례로 시도
    tries = [('adm',), ('emd',), ('dong',), ('읍면동',), ()]
    for t in tries:
        try:
            g = adk.get(key, *t, crs='EPSG:4326')
        except Exception as e:  # noqa: BLE001
            print('읍면동 시도 실패', t, str(e)[:120])
            continue
        if len(g) > n_sgg * 3:
            print('읍면동 단계', t, len(g), list(g.columns))
            print(g.drop(columns='geometry').head(3).to_dict('records'))
            return g
    return None


def dong_files(key, gdf_sgg_count, out):
    g = get_dong(key, gdf_sgg_count)
    if g is None:
        print('읍면동 경계를 못 받음 → 생략')
        return
    cols = list(g.columns)
    name_col = next((c for c in cols if c.lower() in ('adm_nm', 'admnm', 'adm_name')), None) or \
        next((c for c in cols if 'nm' in c.lower() or 'name' in c.lower()), None)
    print('이름 열', name_col)
    by = {}
    for _, r in g.iterrows():
        toks = str(r[name_col]).split()
        if len(toks) < 3:
            continue
        sido, dong, sgg = toks[0], toks[-1], ' '.join(toks[1:-1])
        reg = region_of(sido, sgg)
        if not reg:
            continue
        geom = r.geometry.simplify(0.00015, preserve_topology=True)
        rs = rings(geom, 4)
        if rs:
            by.setdefault(reg, []).append({'n': dong, 'g': sgg, 'c': label_pt(geom), 'p': rs})
    os.makedirs(os.path.join(out, 'dong'), exist_ok=True)
    for reg, items in by.items():
        f = os.path.join(out, 'dong', f'{reg}.json')
        json.dump({'version': key, 'dong': items}, open(f, 'w'), ensure_ascii=False, separators=(',', ':'))
        print('읍면동', reg, len(items), os.path.getsize(f) // 1024, 'KB')


def main():
    vers = adk.versions()
    keys = sorted(str(v.get('key') if isinstance(v, dict) else v) for v in (vers if isinstance(vers, (list, tuple)) else list(vers)))
    print('버전 수', len(keys), '마지막', keys[-3:])
    key = keys[-1]
    gdf = adk.get(key, 'sgg', crs='EPSG:4326')
    print('열', list(gdf.columns), len(gdf))
    print(gdf.drop(columns='geometry').head(3).to_dict('records'))
    cols = list(gdf.columns)
    sido_col = next((c for c in cols if 'sido' in c.lower() and ('nm' in c.lower() or 'name' in c.lower())), None)
    sgg_col = next((c for c in cols if 'sgg' in c.lower() and ('nm' in c.lower() or 'name' in c.lower())), None)
    print('사용 열', sido_col, sgg_col)
    by = {}
    for _, r in gdf.iterrows():
        sido, sgg = str(r[sido_col]), str(r[sgg_col])
        reg = region_of(sido, sgg)
        if not reg:
            print('지역 모름', sido, sgg)
            continue
        geom = r.geometry.simplify(0.0004, preserve_topology=True)
        rs = rings(geom)
        if rs:
            by.setdefault(reg, []).append({'n': sgg.replace(sido, '').strip() or sgg, 'c': label_pt(geom), 'p': rs})
    os.makedirs(OUT, exist_ok=True)
    for reg, items in by.items():
        json.dump({'version': key, 'sgg': items}, open(os.path.join(OUT, f'{reg}.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
        print(reg, len(items), os.path.getsize(os.path.join(OUT, f'{reg}.json')) // 1024, 'KB')
    dong_files(key, len(gdf), OUT)
    json.dump({'version': key, 'updated': time.strftime('%Y-%m-%d'), 'source': 'admdongkor (통계청 SGIS 행정구역 경계 기반, CC BY 4.0)'},
              open(os.path.join(OUT, 'meta.json'), 'w'), ensure_ascii=False)


if __name__ == '__main__':
    main()
