"""새 공고 푸시 발송 (알림 2단계).
아직 안 보낸 공고(notices.pushed_at is null, 최근 3일 게시)를 관심 지역이 맞는 구독 기기에 Expo 푸시로 보냄.
- 기기 하나에 공고가 3건 넘으면 '새 공고 N건' 하나로 묶음
- Expo가 '등록 안 된 기기'라고 답하면 구독 목록에서 지움
- 밤 10시~아침 8시(KST)에는 보내지 않음 (워크플로 시간으로 지킴 + 여기서 한 번 더 확인)"""
import datetime as dt
import json
import os
import urllib.parse
import urllib.request
from collections import defaultdict

URL = os.environ.get('SUPABASE_URL', 'https://wckaybzamhvmhxiacmnx.supabase.co').rstrip('/')
KEY = os.environ['SUPABASE_SECRET_KEY']
H = {'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'}
KST = dt.timezone(dt.timedelta(hours=9))
DOC = {'prelim': '선발 인원 사전예고', 'plan': '시행계획 공고', 'receipt': '원서 접수 현황', 'attend': '응시 현황',
       'first_pass': '1차 합격 발표', 'final_pass': '최종 합격 발표', 'private': '사립 채용 공고'}
REG = {'seoul': '서울', 'busan': '부산', 'daegu': '대구', 'incheon': '인천', 'gwangju': '광주', 'daejeon': '대전', 'ulsan': '울산',
       'sejong': '세종', 'gyeonggi': '경기', 'gangwon': '강원', 'chungbuk': '충북', 'chungnam': '충남', 'jeonbuk': '전북',
       'jeonnam': '전남', 'gyeongbuk': '경북', 'gyeongnam': '경남', 'jeju': '제주'}


def rest(method, path, body=None):
    req = urllib.request.Request(f'{URL}/rest/v1/{path}', method=method, headers={**H, 'Prefer': 'return=minimal'},
                                 data=json.dumps(body).encode() if body is not None else None)
    r = urllib.request.urlopen(req, timeout=60).read()
    return json.loads(r) if r else None


def main():
    now = dt.datetime.now(KST)
    if not (8 <= now.hour < 22) and os.environ.get('FORCE') != '1':
        print('방해 금지 시간이라 건너뜀', now.isoformat())
        return
    since = (now.date() - dt.timedelta(days=3)).isoformat()
    notices = rest('GET', f'notices?select=id,region,level,doc_type,title,posted_at&pushed_at=is.null&order=id&limit=500') or []
    fresh = [n for n in notices if (n.get('posted_at') or since) >= since]
    print('안 보낸 공고', len(notices), '보낼 공고(최근 3일)', len(fresh))
    subs = rest('GET', 'push_subs?select=token,level,regions&limit=100000') or []
    print('구독 기기', len(subs))

    per = defaultdict(list)  # token -> notices
    for s in subs:
        for n in fresh:
            if n['level'] == s['level'] and n['region'] in (s['regions'] or []):
                per[s['token']].append(n)

    msgs = []
    for tok, ns in per.items():
        if len(ns) > 3:
            regs = sorted({REG.get(n['region'], n['region']) for n in ns})
            msgs.append({'to': tok, 'title': f'관심 지역 새 공고 {len(ns)}건', 'body': ' · '.join(regs), 'data': {'url': '/news'}, 'channelId': 'default'})
        else:
            for n in ns:
                msgs.append({'to': tok, 'title': f"{REG.get(n['region'], n['region'])} {DOC.get(n['doc_type'], '새 공고')}",
                             'body': n['title'][:120], 'data': {'url': '/news'}, 'channelId': 'default'})
    print('보낼 알림', len(msgs))

    dead = set()
    for i in range(0, len(msgs), 100):
        batch = msgs[i:i + 100]
        req = urllib.request.Request('https://exp.host/--/api/v2/push/send', method='POST',
                                     headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
                                     data=json.dumps(batch).encode())
        res = json.loads(urllib.request.urlopen(req, timeout=60).read())
        for m, t in zip(batch, res.get('data', [])):
            if t.get('status') == 'error' and (t.get('details') or {}).get('error') == 'DeviceNotRegistered':
                dead.add(m['to'])
    for tok in dead:
        rest('DELETE', f'push_subs?token=eq.{urllib.parse.quote(tok)}')
    print('지운 기기', len(dead))

    # 보낸(또는 오래돼서 안 보낼) 공고 표시
    ids = [n['id'] for n in notices]
    for i in range(0, len(ids), 200):
        rest('PATCH', f"notices?id=in.({','.join(map(str, ids[i:i + 200]))})", {'pushed_at': now.isoformat()})
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as f:
            f.write(f'공고 {len(fresh)}건 → 알림 {len(msgs)}개, 구독 {len(subs)}대, 정리 {len(dead)}대\n')


if __name__ == '__main__':
    main()
