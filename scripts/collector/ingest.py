"""수집기 4단계: 뽑은 숫자 → Supabase ingest_queue(검수 대기)
환경변수: SUPABASE_URL, SUPABASE_SECRET_KEY (GitHub Secrets). 키가 없으면 결과만 출력.
사용: python ingest.py <raw 폴더>
"""
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_results  # noqa: E402
import parse_results  # noqa: E402

URL = os.environ.get('SUPABASE_URL', 'https://wckaybzamhvmhxiacmnx.supabase.co').rstrip('/')
KEY = os.environ.get('SUPABASE_SECRET_KEY', '')


def upsert(table, rows, on_conflict):
    req = urllib.request.Request(
        f'{URL}/rest/v1/{table}?on_conflict={on_conflict}',
        data=json.dumps(rows, ensure_ascii=False).encode(),
        method='POST',
        headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json',
                 'Prefer': 'resolution=merge-duplicates,return=minimal'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status


MANUAL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'supabase', 'data', 'manual')


def manual_records():
    """해외 차단 지역: 사용자가 보내준 원문에서 옮겨 적은 값 (supabase/data/manual/*.json)"""
    import glob
    out = []
    for f in sorted(glob.glob(os.path.join(MANUAL_DIR, '*.json'))):
        d = json.load(open(f))
        for r in d.get('elementary', []):
            out.append({'region': d['region'], 'year': d['year'], 'level': 'elementary', 'subject': None,
                        'category': r['category'], **{k: v for k, v in r.items() if k != 'category'},
                        'sources': [d['source_url']]})
    return out


def main(raw):
    recs, log = parse_results.main(raw, os.path.join(raw, 'parsed_elementary.json'))
    recs += manual_records()
    _, problems = check_results.check(recs)
    groups = {}
    for r in recs:
        groups.setdefault((r['region'], r['year'], r['level']), []).append(r)
    rows = []
    for (region, year, level), rs in sorted(groups.items()):
        probs = [p for p in problems if p.startswith(f"('{region}', {year})")]
        srcs = sorted({s for r in rs for s in r['sources']})
        rows.append({
            'region': region, 'level': level, 'doc_type': 'exam_results',
            'title': f'{year}학년도 {region} {level} 선발·지원·1차·최종 합격 (공고 {len(srcs)}건)',
            'source_url': f'parsed:{region}:{year}:{level}',  # 묶음 고유 키 (실제 공고 주소는 parsed.sources)
            'file_url': f'parsed:exam_results:{level}:{year}:{region}',
            'parsed': {'year': year, 'records': rs, 'sources': srcs},
            'status': 'pending',
            'note': '검증 통과' if not probs else '확인 필요: ' + ' / '.join(probs),
        })
    print(f'묶음 {len(rows)}개, 확인 필요 {sum(1 for r in rows if r["note"] != "검증 통과")}개')
    for r in rows:
        print(' ', r['file_url'], r['note'][:100])
    if not KEY:
        print('SUPABASE_SECRET_KEY 없음 → DB 저장은 건너뜀 (GitHub Secrets 에 등록하면 저장됨)')
        return
    # 이미 승인된 묶음은 숫자가 그대로면 다시 올리지 않음 (승인 상태 유지)
    req = urllib.request.Request(f'{URL}/rest/v1/ingest_queue?select=source_url,file_url,parsed,status&doc_type=eq.exam_results',
                                 headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}'})
    with urllib.request.urlopen(req, timeout=60) as r:
        old = {(x['source_url'], x['file_url']): x for x in json.load(r)}
    def same(a, b):
        return json.dumps(a, sort_keys=True, ensure_ascii=False) == json.dumps(b, sort_keys=True, ensure_ascii=False)
    send = [r for r in rows if not ((o := old.get((r['source_url'], r['file_url']))) and same(o['parsed'], r['parsed']))]
    print(f'새로 올리거나 바뀐 묶음 {len(send)}개 (그대로인 {len(rows) - len(send)}개는 건너뜀)')
    for r in send:
        print('  →', r['file_url'], r['note'][:60])
    if not send:
        return
    st = upsert('ingest_queue', send, 'source_url,file_url')
    print('ingest_queue 저장 완료', st)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'raw')
