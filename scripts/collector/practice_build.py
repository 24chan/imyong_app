"""실습학교 목록 만들기: supabase/data/practice/*_src.json + 학교 위치(raw/schools) → raw/practice/<교대>.json
- 공지의 짧은 이름(인천가원초)을 학교 위치 데이터의 정식 이름(인천가원초등학교)과 연결
- 같은 이름이 여러 곳이면 그 교대 캠퍼스에서 가장 가까운 학교
- 캠퍼스 위치: OpenStreetMap(Nominatim)에서 찾고, 못 찾으면 src의 lat/lng
- 직선거리(km). 대중교통 시간은 TRANSIT_KEY가 있을 때만(아직 없음) — 칸만 둠
사용: python practice_build.py <raw 폴더> <src 폴더>
"""
import glob
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request

UA = 'imyong-app-practice/1.0 (github.com/24chan/imyong_app)'
METRO = {'서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종'}  # 광역시 이름은 구 이름과 달라서 구 확인 안 함


def km(a, b):
    r = 6371.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(h)), 1)


def geocode(q):
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({'q': q, 'format': 'json', 'limit': 1, 'countrycodes': 'kr'})
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30) as r:
            js = json.load(r)
        time.sleep(1.2)  # Nominatim 이용 규칙: 1초에 1번 이하
        if js:
            return [round(float(js[0]['lat']), 5), round(float(js[0]['lon']), 5)]
    except Exception as e:  # noqa: BLE001
        print('  위치 못 찾음', q, e)
    return None


def full_names(short):
    s = short.strip()
    s = s.replace('경인교대부설초', '경인교육대학교부설초')
    base = re.sub(r'초$', '초등학교', s) if not s.endswith('초등학교') else s
    out = [base]
    if len(base) > 6:
        out.append(base[2:])  # 지역 이름 없이 등록된 학교 (인천○○초 → ○○초, 안산선일초 → 선일초)
    return out


def main(raw, src_dir):
    schools = {}
    for f in glob.glob(os.path.join(raw, 'schools', '*.json')):
        reg = os.path.basename(f)[:-5]
        if reg == 'meta':
            continue
        for name, kind, found, lat, lng, sgg in json.load(open(f)):
            if kind == 'e':
                schools.setdefault(name, []).append({'region': reg, 'lat': lat, 'lng': lng, 'sigungu': sgg, 'found': found})
    out_dir = os.path.join(raw, 'practice')
    os.makedirs(out_dir, exist_ok=True)
    for sf in sorted(glob.glob(os.path.join(src_dir, '*_src.json'))):
        src = json.load(open(sf))
        camp = {}
        for cid, c in src['campuses'].items():
            pos = geocode(c['addr']) or geocode(c['q']) or ([c['lat'], c['lng']] if 'lat' in c else None)
            if not pos:
                raise SystemExit(f'캠퍼스 위치를 못 찾음: {c}')
            camp[cid] = {**{k: v for k, v in c.items() if k != 'q'}, 'lat': pos[0], 'lng': pos[1]}
            print('캠퍼스', cid, pos)
        sch, missing, sessions = {}, [], []
        for se in src['sessions']:
            ids = []
            for b in se['blocks']:
                regions = b.get('regions') or [b['region']]
                near = camp[b['campus']] if b.get('campus') in camp else next(iter(camp.values()))
                for short in b['schools']:
                    cands = []
                    for i, n in enumerate(full_names(short)):  # 정식 이름 먼저, 없으면 앞 지역 이름 뺀 이름
                        pre = full_names(short)[0][:2] if i else ''
                        cands = [dict(c, name=n) for c in schools.get(n, []) if c['region'] in regions
                                 and (not pre or pre in METRO or c['sigungu'].startswith(pre))]  # '안산선일초' → 안산시의 선일초만
                        if cands:
                            break
                    if not cands:
                        missing.append(f"{se['id']} {short}")
                        continue
                    best = min(cands, key=lambda c: km((c['lat'], c['lng']), (near['lat'], near['lng'])))
                    sid = f"{best['region']}|{best['name']}"
                    if sid not in sch:
                        sch[sid] = {'name': best['name'], 'short': short, 'region': best['region'], 'sigungu': best['sigungu'],
                                    'found': best['found'], 'lat': best['lat'], 'lng': best['lng'],
                                    'km': {cid: km((best['lat'], best['lng']), (c['lat'], c['lng'])) for cid, c in camp.items()},
                                    'transit_min': {}}
                    ids.append({'id': sid, 'block': b['region'], 'campus': b.get('campus') or next(iter(camp))})
            sessions.append({k: v for k, v in se.items() if k != 'blocks'} | {'schools': ids})
        if missing:
            print(f"[{src['univ']}] 연결 못 한 학교(목록에서 뺌):\n  " + '\n  '.join(missing))
        out = {'univ': src['univ'], 'name': src['name'], 'campuses': camp, 'grade_campus': src.get('grade_campus', {}),
               'sessions': sessions, 'schools': sch, 'built': time.strftime('%Y-%m-%d'),
               'missing': missing,
               'notes': ['거리는 캠퍼스에서 학교까지 직선거리', '학교 위치: 공공데이터포털 전국초중등학교위치표준데이터', '캠퍼스 위치: OpenStreetMap']}
        path = os.path.join(out_dir, f"{src['univ']}.json")
        json.dump(out, open(path, 'w'), ensure_ascii=False, indent=1)
        print(f"저장 {path}: 실습 {len(sessions)}개, 학교 {len(sch)}곳")


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
