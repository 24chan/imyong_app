"""자체 검증: 공고에서 뽑은 선발 인원 합(일반+장애+지역)이 교육부 확정 인원과 같은지 등"""
import json
import re
import sys

MOE_SQL = 'supabase/data/0004_moe_elementary_2024_2027.sql'


def moe_totals():
    t = {}
    for m in re.finditer(r"\((\d{4}), 'elementary', '(\w+)', null, 'confirmed', [^,]+, [^,]+, [^,]+, (\d+),", open(MOE_SQL).read()):
        t[(m.group(2), int(m.group(1)))] = int(m.group(3))
    return t


def check(recs):
    moe = moe_totals()
    by = {}
    for r in recs:
        by.setdefault((r['region'], r['year']), []).append(r)
    problems, ok = [], 0
    for key, rs in sorted(by.items()):
        cats = {r['category']: r for r in rs}
        if 'all' in cats and len(cats) > 1:
            problems.append(f'{key} all 과 구분 행이 섞임')
        sel = sum(r.get('selected') or 0 for r in rs if r['category'] != 'all' or len(cats) == 1)
        exp = moe.get(key)
        if exp is not None and sel != exp:
            problems.append(f'{key} 선발 합 {sel} ≠ 교육부 {exp}')
        else:
            ok += 1
        for r in rs:
            fp, sl, fn = r.get('first_passed'), r.get('selected'), r.get('final_passed')
            if fn is not None and sl is not None and fn > sl:
                problems.append(f"{key} {r['category']} 최종합격 {fn} > 선발 {sl}")
            if r['category'] == 'general' and fp is not None and sl and not (sl <= fp <= sl * 2):
                problems.append(f"{key} 일반 1차합격 {fp} 이 선발 {sl} 의 1~2배 밖")
            for c in ('first_cutoff', 'final_cutoff'):
                v = r.get(c)
                lim = 110 if c == 'first_cutoff' else 220
                if v is not None and not (20 <= v <= lim):
                    problems.append(f"{key} {r['category']} {c}={v} 범위 밖")
    return ok, problems


if __name__ == '__main__':
    ok, pr = check(json.load(open(sys.argv[1])))
    print('통과', ok)
    print('\n'.join(pr))
