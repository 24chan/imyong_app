"""정제 자료를 Supabase 비공개 저장소 'pro'에 올림 (2026-11-28 보안 보강).
공개 GitHub(raw-files)에 두지 않고, 경인교대 인증 회원·운영자만 앱에서 읽게 함 (0034 SQL의 'pro read' 규칙).
사용: python pro_upload.py <로컬 폴더> <저장소 안 경로 앞부분>   예) raw/analysis analysis
환경변수: SUPABASE_URL, SUPABASE_SECRET_KEY"""
import os, sys, urllib.request, urllib.error
from pathlib import Path

URL = os.environ.get('SUPABASE_URL', 'https://wckaybzamhvmhxiacmnx.supabase.co').rstrip('/')
KEY = os.environ.get('SUPABASE_SECRET_KEY', '')


def put(path: str, data: bytes):
    req = urllib.request.Request(
        f'{URL}/storage/v1/object/pro/{path}', method='POST', data=data,
        headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json', 'x-upsert': 'true', 'cache-control': 'max-age=300'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.status


def main():
    src, prefix = Path(sys.argv[1]), sys.argv[2].strip('/')
    if not KEY:
        sys.exit('SUPABASE_SECRET_KEY 없음')
    n = 0
    for f in sorted(src.rglob('*.json')):
        rel = f.relative_to(src).as_posix()
        try:
            put(f'{prefix}/{rel}', f.read_bytes())
            n += 1
        except urllib.error.HTTPError as e:
            sys.exit(f'올리기 실패 {rel}: HTTP {e.code} {e.read()[:300]!r}')
    print(f'pro/{prefix}: {n}개 올림')


if __name__ == '__main__':
    main()
