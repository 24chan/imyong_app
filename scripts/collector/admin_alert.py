"""운영자 알림 (2026-11-28 사용자 요청)
자동으로 바뀐 것(새 공고·학원 일정·승인 대기)과 수집이 멈춘 것(오래 갱신 안 됨)을 모아 운영자 폰으로 푸시.
결과는 raw/changes/latest.json 에도 남겨 앱 운영자 화면에서 볼 수 있게.
사용: python admin_alert.py <raw-files 폴더>
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone

URL = os.environ.get('SUPABASE_URL', 'https://wckaybzamhvmhxiacmnx.supabase.co').rstrip('/') + '/rest/v1/'
KEY = os.environ.get('SUPABASE_SECRET_KEY', '')
H = {'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'}
KST = timezone(timedelta(hours=9))

# 수집 결과 파일 → 이 날수보다 오래 안 바뀌면 '멈춤' 경고
STALE = [
    ('학원 일정 자동 수집', 'raw/academy/academy_events.json', 3),
    ('교육청 공고 수집(서울 예시)', 'raw/seoul', 3),
    ('평가원 기출 목록', 'raw/resources/kice_elementary.json', 10),
    ('교육과정 원문 목록', 'raw/ncic/curriculum.json', 10),
    # 기출 분석은 2026-11-28부터 비공개 저장소(pro)에 올려서 여기서 확인하지 않음
    ('실습학교 목록', 'raw/practice', 40),
]


def rest(path):
    req = urllib.request.Request(URL + path, headers=H)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b'null')


def count(path):
    req = urllib.request.Request(URL + path, headers={**H, 'Prefer': 'count=exact', 'Range': '0-0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        cr = r.headers.get('Content-Range', '*/0')
    return int(cr.split('/')[-1] or 0)


def last_change_days(repo, path):
    out = subprocess.run(['git', '-C', repo, 'log', '-1', '--format=%ct', '--', path], capture_output=True, text=True).stdout.strip()
    if not out:
        return None
    return (time.time() - int(out)) / 86400


def main():
    repo = sys.argv[1]
    since = (datetime.now(timezone.utc) - timedelta(hours=26)).strftime('%Y-%m-%dT%H:%M:%SZ')
    items, warns = [], []
    if KEY:
        try:
            n = rest(f'notices?select=region,level,doc_type,title&created_at=gte.{since}&order=created_at.desc&limit=200') or []
            if n:
                items.append({'kind': '새 공고', 'n': len(n), 'examples': [f"{x.get('region')} {x.get('title', '')[:40]}" for x in n[:5]]})
        except Exception as e:  # noqa: BLE001
            warns.append(f'공고 확인 실패: {str(e)[:60]}')
        try:
            ev = rest(f'academy_events?select=title,starts_on,source&created_at=gte.{since}&order=created_at.desc&limit=200') or []
            if ev:
                items.append({'kind': '새 학원 일정', 'n': len(ev), 'examples': [f"{x.get('starts_on')} {x.get('title', '')[:40]}" for x in ev[:5]]})
        except Exception as e:  # noqa: BLE001
            warns.append(f'학원 일정 확인 실패: {str(e)[:60]}')
        for label, path in [('승인 대기 수집 자료', 'ingest_queue?status=eq.pending&select=id'), ('승인 대기 일정 제보', 'event_tips?status=eq.pending&select=id'), ('승인 대기 인증', 'verifications?status=eq.pending&select=id')]:
            try:
                c = count(path)
                if c:
                    items.append({'kind': label, 'n': c, 'examples': []})
            except Exception:  # noqa: BLE001
                pass  # 표가 없거나 이름이 다르면 건너뜀
    else:
        warns.append('비밀키가 없어 서버 변경은 확인하지 못함')
    for label, path, days in STALE:
        d = last_change_days(repo, path)
        if d is None:
            continue
        if d > days:
            warns.append(f'{label}: {d:.0f}일째 갱신 없음(기준 {days}일) — 자동 수집이 멈췄는지 확인')
    now = datetime.now(KST).strftime('%Y-%m-%d %H:%M')
    out = {'checked': now, 'changes': items, 'warnings': warns}
    os.makedirs(os.path.join(repo, 'raw', 'changes'), exist_ok=True)
    hist_p = os.path.join(repo, 'raw', 'changes', 'latest.json')
    try:
        hist = json.load(open(hist_p)).get('history', [])
    except Exception:  # noqa: BLE001
        hist = []
    hist = ([{'checked': now, 'changes': items, 'warnings': warns}] + hist)[:30]
    json.dump({**out, 'history': hist}, open(hist_p, 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(out, ensure_ascii=False, indent=1))

    if not KEY or (not items and not warns):
        return
    try:
        tokens = [r['token'] for r in (rest('admin_push?select=token') or []) if r.get('token')]
    except Exception as e:  # noqa: BLE001
        print('운영자 기기 목록을 못 읽음(SQL 0031 실행 전?)', str(e)[:80])
        return
    if not tokens:
        print('운영자 기기 토큰 없음(앱 운영자 화면을 한 번 열면 등록)')
        return
    title = '임용몽땅 운영 알림' + (' ⚠️' if warns else '')
    body = ' · '.join([f"{i['kind']} {i['n']}" for i in items] + ([f'경고 {len(warns)}건'] if warns else []))[:180]
    msgs = [{'to': t, 'title': title, 'body': body, 'data': {'url': '/admin?tab=changes'}, 'sound': 'default'} for t in tokens]
    req = urllib.request.Request('https://exp.host/--/api/v2/push/send', data=json.dumps(msgs).encode(), headers={'Content-Type': 'application/json', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        print('푸시', r.status, r.read()[:300])


if __name__ == '__main__':
    main()
