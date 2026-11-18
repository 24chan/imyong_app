"""시행계획 공고 → 지역별 시험 일정 (원서 접수, 1차 시험, 1차 발표, 2차 시험, 최종 발표)
날짜마다 '그 학년도에 있을 수 있는 달'인지 확인해서 엉뚱한 날짜(예: 서류 제출일)를 거름.
사용: python parse_schedule.py <raw 폴더>
"""
import glob
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dump import rows_of  # noqa: E402

D = r'(20\d\d)\s*[.\-년]\s*(\d{1,2})\s*[.\-월]\s*(\d{1,2})'
PATTERNS = {
    'receipt': re.compile(r'(?:원서\s*)?접수\s*기간[^\n]{0,15}?' + D + r'[^\n]{0,40}?[~∼～\-]\s*(?:(20\d\d)\s*\.\s*)?(\d{1,2})\s*\.\s*(\d{1,2})'),
    'first_result': re.compile(r'(?:제\s*)?1\s*차\s*(?:시험\s*)?합격자?\s*(?:발표|공고)?[^\n]{0,40}?' + D),
    'final_result': re.compile(r'최종\s*합격자?\s*(?:발표|공고)?[^\n]{0,40}?' + D),
    'first_exam': re.compile(r'(?:제\s*)?1\s*차\s*(?:시험)?\s*(?:일|일자|일시|시행일)?\s*[:：]?[^\n합]{0,25}?' + D),
    'second_exam': re.compile(r'(?:제\s*)?2\s*차\s*(?:시험)?\s*(?:일|일자|일시|시행일)?\s*[:：]?[^\n합]{0,25}?' + D),
}
# 학년도 Y 기준으로 있을 수 있는 (연도 차이, 달)
ALLOWED = {
    'receipt_start': {(-1, 9), (-1, 10)},
    'first_exam': {(-1, 11)},
    'first_result': {(-1, 11), (-1, 12)},
    'second_exam': {(0, 1), (0, 2)},
    'final_result': {(0, 1), (0, 2)},
}


def text_of(path):
    if path.endswith('.pdf'):
        return subprocess.run(['pdftotext', '-layout', path, '-'], capture_output=True, text=True, timeout=60).stdout
    return '\n'.join('  '.join(c for c in r if c) for r in rows_of(path))


def ok(event, year, y, m):
    return (y - year, m) in ALLOWED[event]


def extract(text, year):
    ev = {}
    t = re.sub(r'[ \t]+', ' ', text)
    # 발표를 먼저 찾아야 '1차 시험'이 '1차 시험 합격자 발표' 날짜를 가져가지 않음
    for key in ('receipt', 'first_result', 'final_result', 'first_exam', 'second_exam'):
        for m in PATTERNS[key].finditer(t):
            g = m.groups()
            if key == 'receipt':
                y1, m1, d1 = int(g[0]), int(g[1]), int(g[2])
                y2 = int(g[3]) if g[3] else y1
                m2, d2 = int(g[4]), int(g[5])
                if ok('receipt_start', year, y1, m1) and ok('receipt_start', year, y2, m2) and 'receipt_start' not in ev:
                    ev['receipt_start'] = f'{y1:04d}-{m1:02d}-{d1:02d}'
                    ev['receipt_end'] = f'{y2:04d}-{m2:02d}-{d2:02d}'
                continue
            y, mo, d = int(g[-3]), int(g[-2]), int(g[-1])
            if key in ev or not ok(key, year, y, mo) or not (1 <= d <= 31):
                continue
            date = f'{y:04d}-{mo:02d}-{d:02d}'
            if key in ('first_exam', 'second_exam') and date in (ev.get('first_result'), ev.get('final_result')):
                continue
            ev[key] = date
    return ev


def consistent(ev):
    order = ['receipt_start', 'receipt_end', 'first_exam', 'first_result', 'second_exam', 'final_result']
    ds = [ev[k] for k in order if k in ev]
    return ds == sorted(ds)


def main(raw):
    out = []
    for mf in sorted(glob.glob(os.path.join(raw, '*', 'manifest.json'))):
        docs = [m for m in json.load(open(mf)) if m['type'] == 'plan']
        posts = {}
        pp = os.path.join(os.path.dirname(mf), 'posts.json')
        if os.path.exists(pp):
            posts = json.load(open(pp))
        best = {}
        for m in docs:
            if re.search(r'서식|신청서|FAQ|질문|접수\s*(방법|안내|요령)|사립|위탁|변경\s*내용', m['file_name']):
                continue
            path = os.path.join(raw, m['path'])
            if m['path'].endswith('.hwp'):
                path += '.xhtml'
            if not os.path.exists(path) or not re.search(r'\.(pdf|hwpx|xhtml)$', path):
                continue
            try:
                ev = extract(text_of(path), m['year'])
            except Exception:  # noqa: BLE001
                continue
            k = (m['region'], m['year'], m['level'])
            # 변경 공고가 있으면 나중 것이 우선 (같은 개수면 '변경'이 들어간 파일)
            score = (len(ev), '변경' in m['file_name'] + m['title'])
            if consistent(ev) and (k not in best or score > best[k][0]):
                plan_date = posts.get(m['post_url'], {}).get('posted_at')
                if plan_date:
                    ev = {'plan': plan_date, **ev}
                best[k] = (score, ev, m['post_url'], m['title'])
        for (region, year, level), (_, ev, url, title) in best.items():
            out.append({'region': region, 'year': year, 'level': level, 'events': ev, 'source_url': url, 'title': title})
    return consensus(out)


NATIONAL = ('receipt_start', 'receipt_end', 'first_exam', 'first_result', 'final_result')
REGIONS = ['seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon', 'ulsan', 'sejong', 'gyeonggi', 'gangwon',
           'chungbuk', 'chungnam', 'jeonbuk', 'jeonnam', 'gyeongbuk', 'gyeongnam', 'jeju']


def consensus(found):
    """원서 접수·1차 시험·1차 발표·최종 발표는 전국 같은 날 → 여러 교육청 값의 다수결(3곳 이상 일치)로 확정.
    2차 시험은 지역마다 하루 이틀 다름 → 그 지역 값이 다수결 날짜 ±3일 안일 때만 그 지역 값."""
    from collections import Counter
    from datetime import date
    groups = {}
    for r in found:
        groups.setdefault((r['year'], r['level']), []).append(r)
    out = []
    for (year, level), rs in groups.items():
        mode = {}
        for ev in NATIONAL + ('second_exam',):
            c = Counter(r['events'][ev] for r in rs if ev in r['events'])
            if c:
                d, n = c.most_common(1)[0]
                if n >= 3:
                    mode[ev] = (d, n, len(rs))
        by_region = {r['region']: r for r in rs}
        for region in REGIONS:
            r = by_region.get(region)
            ev = {}
            for k in NATIONAL:
                if k in mode:
                    ev[k] = mode[k][0]
            if 'second_exam' in mode:
                own = r['events'].get('second_exam') if r else None
                md = mode['second_exam'][0]
                near = own and abs((date.fromisoformat(own) - date.fromisoformat(md)).days) <= 3
                ev['second_exam'] = own if near else md
            if r and 'plan' in r['events']:
                ev['plan'] = r['events']['plan']
            if not ev:
                continue
            out.append({'region': region, 'year': year, 'level': level, 'events': ev,
                        'source_url': r['source_url'] if r else None,
                        'title': r['title'] if r else f'{year}학년도 {"초등" if level == "elementary" else "중등"} 전국 공통 일정 (교육청 시행계획 {len(rs)}곳 다수결)',
                        'support': {k: f'{v[1]}/{v[2]}' for k, v in mode.items()}})
    return out


if __name__ == '__main__':
    for r in sorted(main(sys.argv[1]), key=lambda x: (x['year'], x['region'], x['level'])):
        print(r['year'], r['region'], r['level'][:4], len(r['events']), r['events'])
