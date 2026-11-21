"""학교알리미 OpenAPI 살펴보기: 키가 있는지, 해외(GitHub)에서 접속되는지, apiType 번호별로 어떤 자료인지.
키 값은 출력하지 않음."""
import json, os, sys, urllib.parse, urllib.request

KEY = os.environ.get('SCHOOLINFO_KEY', '').strip()
BASE = 'https://www.schoolinfo.go.kr/openApi.do'
print('키 등록:', '있음' if KEY else '없음 (GitHub Secret SCHOOLINFO_KEY)', f'(길이 {len(KEY)})')
if not KEY:
    sys.exit(1)


def call(**p):
    q = urllib.parse.urlencode({'apiKey': KEY, **p})
    req = urllib.request.Request(f'{BASE}?{q}', headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8', 'replace')


lo, hi = int(os.environ.get('LO', '0')), int(os.environ.get('HI', '70'))
yr = os.environ.get('YEAR', '2026')
for t in range(lo, hi + 1):
    try:
        raw = call(apiType=str(t), pbanYr=yr, schulKndCode='02', sidoCode='11', sggCode='11140')
    except Exception as e:  # noqa: BLE001
        print(t, '접속 실패', str(e)[:150])
        if t == lo:
            sys.exit(1)
        continue
    try:
        d = json.loads(raw)
    except Exception:  # noqa: BLE001
        print(t, 'JSON 아님', raw[:120].replace('\n', ' '))
        continue
    lst = d.get('list') or []
    if not lst:
        print(t, d.get('resultCode'), d.get('resultMsg'))
        continue
    first = lst[0]
    print(f'== {t}: {len(lst)}건, 항목 {len(first)}개')
    print('   ', json.dumps(first, ensure_ascii=False)[:900])
