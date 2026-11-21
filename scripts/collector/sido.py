"""지역별 시군구 경계(raw/geo/<지역>.json)를 합쳐 전국 지도용 시도 경계 한 파일로.
결과: raw/geo/sido.json = {"version": 키, "sido": [{"r": 지역 코드, "c": [lng,lat], "p": [[[lng,lat],...], ...]}]}
(collector-geo 가 geo.py 다음에 실행. 경계 출처는 geo.py 와 같음: admdongkor, CC BY 4.0)
"""
import glob
import json
import os
import sys

from shapely.geometry import Polygon
from shapely.ops import unary_union

GEO = sys.argv[1] if len(sys.argv) > 1 else 'raw/geo'


def main():
    out, version = [], None
    for f in sorted(glob.glob(os.path.join(GEO, '*.json'))):
        reg = os.path.basename(f)[:-5]
        if reg in ('meta', 'sido'):
            continue
        d = json.load(open(f))
        version = d.get('version', version)
        polys = [Polygon(r) for s in d['sgg'] for r in s['p'] if len(r) >= 4]
        polys = [p if p.is_valid else p.buffer(0) for p in polys]
        # 시군구 사이 작은 틈을 메우고 합친 뒤 단순하게
        g = unary_union([p.buffer(0.003) for p in polys]).buffer(-0.003).simplify(0.004, preserve_topology=True)
        parts = [g] if g.geom_type == 'Polygon' else list(g.geoms)
        rings = []
        for p in parts:
            if p.area < 0.0004:  # 아주 작은 섬은 생략
                continue
            ring = [[round(x, 3), round(y, 3)] for x, y in p.exterior.coords]
            if len(ring) >= 4:
                rings.append(ring)
        big = max(parts, key=lambda p: p.area)
        pt = big.representative_point()
        out.append({'r': reg, 'c': [round(pt.x, 3), round(pt.y, 3)], 'p': rings})
        print(reg, len(rings), sum(len(r) for r in rings))
    path = os.path.join(GEO, 'sido.json')
    json.dump({'version': version, 'sido': out}, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('sido.json', os.path.getsize(path) // 1024, 'KB')


if __name__ == '__main__':
    main()
