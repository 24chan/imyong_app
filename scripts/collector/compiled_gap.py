"""학원 정리표 값을 빼면 지역·TO 칸이 몇 개 비는지 세기 (DB 안 건드림)
학원 정리표 = manual 폴더의 *compiled*.json, *applicants*.json (경쟁률 기반)
→ 빠지는 칸 목록 = 정보공개청구 대상"""
import glob
import json
import os
import shutil
import sys
import tempfile
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ingest  # noqa: E402
import parse_results  # noqa: E402

FIELDS = ['selected', 'applicants', 'first_passed', 'first_cutoff', 'final_passed', 'final_cutoff']
FNAME = {'selected': '선발', 'applicants': '지원자', 'first_passed': '1차 합격', 'first_cutoff': '1차 합격선', 'final_passed': '최종 합격', 'final_cutoff': '최종 합격선'}
ACADEMY = lambda f: 'compiled' in f or 'applicants' in f


def with_manual(keep):
    tmp = tempfile.mkdtemp()
    for f in glob.glob(os.path.join(ingest.MANUAL_DIR, '*.json')):
        if keep(os.path.basename(f)):
            shutil.copy(f, tmp)
    return tmp


def elem(raw, mdir):
    ingest.MANUAL_DIR = mdir
    recs, _ = parse_results.main(raw, os.path.join(raw, 'parsed_tmp.json'))
    merged = {}
    for r in recs + ingest.manual_records():
        k = (r['region'], r['year'], r['category'])
        m = merged.setdefault(k, {})
        for f in FIELDS:
            if m.get(f) is None and r.get(f) is not None:
                m[f] = r[f]
    return merged


def sec(raw, mdir):
    ingest.MANUAL_DIR = mdir
    out = {}
    for row in ingest.secondary_rows(raw):
        if row.get('doc_type') != 'exam_results':
            continue
        y = row['parsed']['year']
        for r in row['parsed']['records']:
            out[(r['region'], y, r['subject'], r['category'])] = {f: r.get(f) for f in FIELDS}
    return out


def diff(full, orig):
    miss = []
    for k, v in full.items():
        o = orig.get(k, {})
        for f in FIELDS:
            if v.get(f) is not None and o.get(f) is None:
                miss.append((k, f))
    return miss


def main(raw):
    all_dir = with_manual(lambda f: True)
    no_acad = with_manual(lambda f: not ACADEMY(f))
    out = []
    for name, fn in [('초등', elem), ('중등', sec)]:
        full, orig = fn(raw, all_dir), fn(raw, no_acad)
        miss = diff(full, orig)
        filled = sum(1 for v in full.values() for f in FIELDS if v.get(f) is not None)
        out.append(f'\n## {name}: 채워진 칸 {filled}개 중 학원 정리표에서만 온 칸 {len(miss)}개')
        by = Counter((k[1], f) for k, f in miss)
        for (y, f), n in sorted(by.items()):
            out.append(f'- {y}학년도 {FNAME[f]}: {n}칸')
        reg = defaultdict(lambda: defaultdict(set))
        for k, f in miss:
            reg[k[0]][k[1]].add(FNAME[f])
        out.append('지역별 (정보공개청구 대상):')
        for r in sorted(reg):
            out.append(f'- {r}: ' + ' / '.join(f'{y} {",".join(sorted(fs))}' for y, fs in sorted(reg[r].items())))
    text = '\n'.join(out)
    print(text)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        open(os.environ['GITHUB_STEP_SUMMARY'], 'a').write(text + '\n')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'raw')
