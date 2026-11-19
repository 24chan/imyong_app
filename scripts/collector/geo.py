"""시군구 경계(admdongkor, 통계청 행정구역 기반) → 지역별 JSON (학교 지도 배경)
결과: raw/geo/<지역>.json = {"version": 키, "sgg": [{"n": 시군구, "p": [[[lng,lat],...], ...]}]}
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
            by.setdefault(reg, []).append({'n': sgg.replace(sido, '').strip() or sgg, 'p': rs})
    os.makedirs(OUT, exist_ok=True)
    for reg, items in by.items():
        json.dump({'version': key, 'sgg': items}, open(os.path.join(OUT, f'{reg}.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
        print(reg, len(items), os.path.getsize(os.path.join(OUT, f'{reg}.json')) // 1024, 'KB')
    json.dump({'version': key, 'updated': time.strftime('%Y-%m-%d'), 'source': 'admdongkor (통계청 행정구역 경계 기반)'},
              open(os.path.join(OUT, 'meta.json'), 'w'), ensure_ascii=False)


if __name__ == '__main__':
    main()
