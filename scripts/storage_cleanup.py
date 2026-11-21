"""남은 사진 파일 정리 (0016 orphan_storage_objects 결과를 Storage API로 삭제).
환경변수: SUPABASE_URL, SUPABASE_SECRET_KEY. 키가 없으면 아무것도 안 함."""
import json, os, sys, urllib.request
from collections import defaultdict

URL = os.environ.get('SUPABASE_URL', 'https://wckaybzamhvmhxiacmnx.supabase.co').rstrip('/')
KEY = os.environ.get('SUPABASE_SECRET_KEY', '')


def call(method, path, body=None):
    req = urllib.request.Request(
        URL + path, method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b'null')


def main():
    if not KEY:
        print('SUPABASE_SECRET_KEY 없음 → 건너뜀')
        return
    rows = call('POST', '/rest/v1/rpc/orphan_storage_objects', {})
    by_bucket = defaultdict(list)
    for r in rows:
        by_bucket[r['bucket']].append(r['path'])
    total = 0
    for bucket, paths in by_bucket.items():
        for i in range(0, len(paths), 100):
            chunk = paths[i:i + 100]
            call('DELETE', f'/storage/v1/object/{bucket}', {'prefixes': chunk})
            total += len(chunk)
        print(f'{bucket}: {len(paths)}개 삭제')
    print(f'합계 {total}개 삭제 (파일 이름은 출력하지 않음)')


if __name__ == '__main__':
    try:
        main()
    except urllib.error.HTTPError as e:
        print('실패', e.code, e.read()[:300].decode('utf-8', 'replace'))
        if e.code == 404:
            print('→ 0016_storage_cleanup.sql 을 아직 실행하지 않은 것 같아요')
        sys.exit(1)
