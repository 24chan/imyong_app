"""수집기 4단계: 뽑은 숫자 → Supabase ingest_queue(검수 대기)
환경변수: SUPABASE_URL, SUPABASE_SECRET_KEY (GitHub Secrets). 키가 없으면 결과만 출력.
사용: python ingest.py <raw 폴더>
"""
import json
import re
import os
import sys
import urllib.error
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
        for e in d.get('entries', []):  # 학원 집계 등 여러 지역·연도 표 (cols 순서대로)
            for cat in ('general', 'disabled', 'regional'):
                if cat in e:
                    out.append({'region': e['region'], 'year': e['year'], 'level': 'elementary', 'subject': None,
                                'category': cat, **{k: v for k, v in zip(d['cols'], e[cat]) if v is not None},
                                'sources': [d['source_url']] if d.get('source_url') else [], 'source_title': d['source_title']})
        for r in d.get('elementary', []):
            out.append({'region': d['region'], 'year': d['year'], 'level': 'elementary', 'subject': None,
                        'category': r['category'], **{k: v for k, v in r.items() if k != 'category' and not k.startswith('_')},
                        'sources': [d['source_url']]})
    return out


def notices(raw):
    """수집한 공고 목록(raw/<지역>/posts.json) → notices 테이블 (제목·링크만이라 바로 올림)"""
    import glob
    rows = []
    base = 'https://raw.githubusercontent.com/24chan/imyong_app/raw-files/'
    for f in sorted(glob.glob(os.path.join(raw, '*', 'posts.json'))):
        region_dir = os.path.dirname(f)
        mf = os.path.join(region_dir, 'manifest.json')
        manifest = json.load(open(mf)) if os.path.exists(mf) else []
        for url, p in json.load(open(f)).items():
            # 이 공고의 PDF 첨부를 그린 그림 (공고문을 먼저, 최대 6장)
            pdfs = [m for m in manifest if m['post_url'] == url and m['path'].endswith('.pdf')]
            pdfs.sort(key=lambda m: (0 if re.search(r'공고|결과|현황|합격', m['file_name']) else 1, m['file_name']))
            images = []
            for m in pdfs:
                for img in sorted(glob.glob(os.path.join(region_dir, 'img', m['sha1'] + '_p*.jpg'))):
                    images.append(base + os.path.relpath(img, os.path.dirname(os.path.abspath(raw))).replace(os.sep, '/'))
            files = [{**x} for x in p.get('files', [])]
            rows.append({'url': url, 'region': p['region'], 'level': p['level'], 'year': p['year'], 'doc_type': p['type'],
                         'title': p['title'][:300], 'posted_at': p.get('posted_at'),
                         'files': files + ([{'images': images[:6]}] if images else [])})
    print(f'임용 소식 {len(rows)}건 (등록일 있는 글 {sum(1 for r in rows if r["posted_at"])}건)')
    if KEY and rows:
        try:
            for i in range(0, len(rows), 200):
                upsert('notices', rows[i:i + 200], 'url')
            print('notices 저장 완료')
        except urllib.error.HTTPError as e:
            print('notices 저장 실패 (0006 SQL 실행 전이면 정상):', e.code, e.read()[:200])


def schedule_rows(raw):
    import parse_schedule
    rows = []
    for r in parse_schedule.main(raw):
        if r['year'] < 2024:
            continue
        support_ok = all(int(v.split('/')[0]) >= 3 for v in r.get('support', {}).values())
        rows.append({
            'region': r['region'], 'level': r['level'], 'doc_type': 'exam_schedules',
            'title': f"{r['year']}학년도 {r['region']} {r['level']} 시험 일정 ({len(r['events'])}개)",
            'source_url': f"parsed:{r['region']}:{r['year']}:{r['level']}",
            'file_url': f"parsed:exam_schedules:{r['level']}:{r['year']}:{r['region']}",
            'parsed': {'year': r['year'], 'events': r['events'], 'source_url': r['source_url'], 'title': r['title'],
                       'support': r.get('support', {})},
            'status': 'pending',
            'note': '검증 통과' if support_ok and len(r['events']) >= 4 else '확인 필요: 일정 일부만 확인됨',
        })
    print(f'일정 묶음 {len(rows)}개 (확인 필요 {sum(1 for r in rows if r["note"] != "검증 통과")}개)')
    return rows


KNOWN_SUBJECTS = {'korean', 'english', 'math', 'social', 'history', 'geography', 'ethics', 'physics', 'chemistry', 'biology',
                  'earth', 'pe', 'music', 'art', 'tech', 'homeec', 'info', 'hanmun', 'japanese', 'chinese', 'health',
                  'counsel', 'librarian', 'nutrition', 'special'}


def secondary_rows(raw):
    """중등: 과목마다 '서로 다른 공고 2건 이상이 같은 선발 인원'일 때만 확인된 과목으로 올림.
    지역 합계가 교육부 표와 맞으면 메모에 함께 적음."""
    import check_secondary
    import parse_secondary
    recs, _ = parse_secondary.main(raw)
    status = check_secondary.check(recs)
    groups = {}
    for r in recs:
        groups.setdefault((r['region'], r['year']), []).append(r)
    # 사용자가 보내준 정리표(원문과 대조함): 원문에 없는 칸만 채움
    manual = {}
    mf = os.path.join(MANUAL_DIR, 'secondary_compiled.json')
    if os.path.exists(mf):
        for m in json.load(open(mf))['records']:
            manual.setdefault((m['region'], m['year']), []).append(m)
            groups.setdefault((m['region'], m['year']), [])
    rows = []
    NONSUBJ = {'special', 'health', 'nutrition', 'librarian', 'counsel'}
    for (region, year), rs in sorted(groups.items()):
        # 교육부 표 합계가 맞은 묶음(교과 전체 / 비교과 과목별)은 공고 1건만 있어도 확인된 것으로 봄
        moe_ok_groups = {g for g, v, e, ok in status.get((region, year), []) if e is not None and ok}
        by_subj = {}
        for r in rs:
            by_subj.setdefault(r['subject'], []).append(r)
        keep = []
        for subj, srs in by_subj.items():
            if subj not in KNOWN_SUBJECTS:
                continue
            main_r = next((x for x in srs if x['category'] in ('general', 'all')), None)
            group = subj if subj in NONSUBJ else '교과'
            if not main_r or main_r.get('conflict'):
                continue
            if main_r.get('agree', 0) < 2 and group not in moe_ok_groups:
                continue
            bad = any((x.get('final_passed') or 0) > (x.get('selected') or 10 ** 6) for x in srs)
            if bad:
                continue
            keep += [{k: v for k, v in x.items() if k not in ('agree', 'conflict')} for x in srs if not x.get('conflict')]
        used_manual = False
        for m in manual.get((region, year), []):
            vals = {k: v for k, v in m.items() if k not in ('region', 'year', 'subject')}
            x = next((x for x in keep if x['subject'] == m['subject'] and x['category'] in ('general', 'all')), None)
            if x:
                add = {k: v for k, v in vals.items() if x.get(k) is None}
                x.update(add)
                used_manual = used_manual or bool(add)
            else:
                keep.append({'region': region, 'year': year, 'level': 'secondary', 'subject': m['subject'], 'category': 'general',
                             'sources': [], **vals})
                used_manual = True
        if not keep:
            continue
        n_subj = len({x['subject'] for x in keep})
        moe = status.get((region, year), [])
        moe_ok = [g for g, v, e, ok in moe if e is not None and ok]
        note = f'검증 통과: 공고 2건 이상 일치한 과목 {n_subj}개' + (f' · 교육부 합계 일치({", ".join(moe_ok)})' if moe_ok else '')
        srcs = sorted({sv for x in keep for sv in x['sources']})
        rows.append({
            'region': region, 'level': 'secondary', 'doc_type': 'exam_results',
            'title': f'{year}학년도 {region} 중등 과목별 ({n_subj}과목, 공고 {len(srcs)}건)' if srcs else f'{year}학년도 중등 과목별 합격 현황 (교육청 합격자 발표 기준)',
            'source_url': f'parsed:{region}:{year}:secondary',
            'file_url': f'parsed:exam_results:secondary:{year}:{region}',
            'parsed': {'year': year, 'records': keep, 'sources': srcs},
            'status': 'pending', 'note': '검증 통과' if n_subj >= 5 or used_manual else note.replace('검증 통과', '확인 필요(과목 적음)'),
            '_detail': note,
        })
    print(f'중등 묶음 {len(rows)}개: ' + ', '.join(f"{r['region']}{r['parsed']['year']}={len({x['subject'] for x in r['parsed']['records']})}" for r in rows))
    for r in rows:
        r.pop('_detail')
    return rows


def main(raw):
    notices(raw)
    sched = schedule_rows(raw)
    try:
        sched += secondary_rows(raw)
    except Exception as e:  # noqa: BLE001
        print('중등 처리 실패:', e)
    recs, log = parse_results.main(raw, os.path.join(raw, 'parsed_elementary.json'))
    recs += manual_records()
    _, problems = check_results.check(recs)
    for line in log:
        if 'seoul' in line and ('충돌' in line or 'xls' in line):
            print('  [로그]', line[:200])
    groups = {}
    for r in recs:
        groups.setdefault((r['region'], r['year'], r['level']), []).append(r)
    rows = []
    for (region, year, level), rs in sorted(groups.items()):
        probs = [p for p in problems if p.startswith(f"('{region}', {year})")]
        srcs = sorted({s for r in rs for s in r['sources']})
        ref = next((r['source_title'] for r in rs if r.get('source_title')), None)
        rs = [{k: v for k, v in r.items() if k != 'source_title'} for r in rs]
        rows.append({
            'region': region, 'level': level, 'doc_type': 'exam_results',
            'title': ref or f'{year}학년도 {region} {level} 선발·지원·1차·최종 합격 (공고 {len(srcs)}건)',
            'source_url': f'parsed:{region}:{year}:{level}',  # 묶음 고유 키 (실제 공고 주소는 parsed.sources)
            'file_url': f'parsed:exam_results:{level}:{year}:{region}',
            'parsed': {'year': year, 'records': rs, 'sources': srcs},
            'status': 'pending',
            'note': '검증 통과' if not probs else '확인 필요: ' + ' / '.join(probs),
        })
    rows += sched
    print(f'묶음 {len(rows)}개, 확인 필요 {sum(1 for r in rows if r["note"] != "검증 통과")}개')
    for r in rows:
        print(' ', r['file_url'], r['note'][:100])
        if r['note'] != '검증 통과':
            for x in r['parsed'].get('records', []):
                print('      ', x['category'], {k: v for k, v in x.items() if k not in ('region', 'year', 'level', 'subject', 'category', 'sources')})
    if not KEY:
        print('SUPABASE_SECRET_KEY 없음 → DB 저장은 건너뜀 (GitHub Secrets 에 등록하면 저장됨)')
        return
    # 이미 승인된 묶음은 숫자가 그대로면 다시 올리지 않음 (승인 상태 유지)
    req = urllib.request.Request(f'{URL}/rest/v1/ingest_queue?select=source_url,file_url,parsed,status&limit=5000',
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
