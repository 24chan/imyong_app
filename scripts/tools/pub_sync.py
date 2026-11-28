"""공개 자료를 Supabase 공개 저장소 'pub'에 맞춰 올림 (2026-11-28: GitHub 저장소 비공개 전환 대비).
앱이 읽는 파일만: raw/<공통 자료 폴더>/** 와 공고 그림·PDF(raw/<지역>/img, raw/<지역>/pdf).
바뀐 파일만 올림(pub/_manifest.json 에 sha1 기록). 저장소 안 경로는 raw-files 와 같게 'raw/...'.
사용: python pub_sync.py <raw-files 폴더>   환경변수: SUPABASE_URL, SUPABASE_SECRET_KEY"""
import hashlib, json, mimetypes, os, sys, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

URL = os.environ.get('SUPABASE_URL', 'https://wckaybzamhvmhxiacmnx.supabase.co').rstrip('/')
KEY = os.environ.get('SUPABASE_SECRET_KEY', '')
H = {'apikey': KEY, 'Authorization': f'Bearer {KEY}'}
COMMON = ['changes', 'curriculum', 'practice', 'resources', 'ncic', 'jobs', 'schools', 'private', 'geo', 'schoolinfo']


def req(method, path, data=None, headers=None):
    r = urllib.request.Request(URL + path, method=method, data=data, headers={**H, **(headers or {})})
    with urllib.request.urlopen(r, timeout=120) as res:
        return res.read()


def ensure_bucket():
    try:
        req('GET', '/storage/v1/bucket/pub')
    except urllib.error.HTTPError:
        req('POST', '/storage/v1/bucket', json.dumps({'id': 'pub', 'name': 'pub', 'public': True, 'file_size_limit': 52428800}).encode(), {'Content-Type': 'application/json'})
        print('공개 저장소 pub 만듦')


def files(root: Path):
    raw = root / 'raw'
    for d in COMMON:
        yield from (p for p in (raw / d).rglob('*') if p.is_file())
    for d in raw.iterdir():
        for sub in ('img', 'pdf'):
            if (d / sub).is_dir():
                yield from (p for p in (d / sub).iterdir() if p.is_file())


def main():
    if not KEY:
        sys.exit('SUPABASE_SECRET_KEY 없음')
    root = Path(sys.argv[1])
    ensure_bucket()
    try:
        old = json.loads(req('GET', '/storage/v1/object/public/pub/_manifest.json'))
    except Exception:
        old = {}
    now, todo = {}, []
    for p in files(root):
        rel = p.relative_to(root).as_posix()
        h = hashlib.sha1(p.read_bytes()).hexdigest()
        now[rel] = h
        if old.get(rel) != h:
            todo.append(p)

    def up(p):
        rel = p.relative_to(root).as_posix()
        ct = mimetypes.guess_type(rel)[0] or ('application/json' if rel.endswith('.json') else 'application/octet-stream')
        req('POST', f'/storage/v1/object/pub/{rel}', p.read_bytes(), {'Content-Type': ct, 'x-upsert': 'true', 'cache-control': 'max-age=600'})

    def safe(p):
        for _ in range(3):
            try:
                up(p)
                return None
            except Exception as e:  # noqa: BLE001
                err = e
        return f'{p.relative_to(root)}: {err}'

    with ThreadPoolExecutor(8) as ex:
        errs = [e for e in ex.map(safe, todo) if e]
    if errs:
        print('\n'.join(errs[:20]))
        sys.exit(f'{len(errs)}개 실패')
    req('POST', '/storage/v1/object/pub/_manifest.json', json.dumps(now).encode(), {'Content-Type': 'application/json', 'x-upsert': 'true', 'cache-control': 'no-cache'})
    print(f'전체 {len(now)}개 중 {len(todo)}개 올림')


if __name__ == '__main__':
    main()
