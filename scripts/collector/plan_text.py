"""중등 시행계획 '선발예정 과목 및 인원' 표 (글자 배치로 읽기)
표가 두 칸으로 나란히 있고, 보건·영양·사서·전문상담이 초등/중등 줄로 나뉘는 모양을 읽는다.
검사: 줄마다 일반+장애=소계, 과목 줄을 모두 더하면 '합계' 줄과 같아야만 결과를 돌려줌 (하나라도 어긋나면 빈 목록).
사용: python plan_text.py <pdf>...
"""
import re
import subprocess
import sys

TOK = re.compile(r'[^\s\d]+(?:\s?\([^)]*\))?|\d+')
GROUP = {'보건': 'health', '영양': 'nutrition', '사서': 'librarian', '전문상담': 'counsel', '전문': 'counsel', '상담': 'counsel'}
LEVEL = re.compile(r'^(초등|중등|유치원|중|초)$')


def _subject(label):
    import parse_secondary
    return parse_secondary.subject_code(label, allow_other=True)


def section(text):
    """'선발예정 과목' 머리글부터 첫 '합계' 줄까지 (공립 표만)"""
    lines = text.splitlines()
    start = next((i for i, l in enumerate(lines) if re.search(r'선발\s*예정\s*과목', l)), None)
    if start is None:
        return []
    out = []
    for l in lines[start:start + 80]:
        out.append(l)
        if re.search(r'합\s*계|총\s*계', l) and re.search(r'\d', l):
            break
    return out


def parse_lines(lines):
    rows, total = [], None
    entries = []  # (줄 번호, 글자 위치, 라벨들, 숫자들)
    for li, line in enumerate(lines):
        m = re.search(r'합\s*계.*?(\d+)\s*과목\D+(\d[\d,]*)\s*명', line)  # '합계 18과목, 87명'
        if m:
            total = (None, None, int(m.group(2).replace(',', '')))
            continue
        line = re.sub(r'(?<=\d),(?=\d{3})', '', line)  # 1,717 → 1717
        line = re.sub(r'(?<!\S)[-‐–]+(?!\S)', '0', line)  # 빈칸 '-' → 0
        line = re.sub(r'\([^)]*\d[^)]*\)', lambda m: ' ' * len(m.group(0)), line)  # '합계(27과목)' 같은 괄호 숫자 지움
        toks = [(m.start(), m.group(0)) for m in TOK.finditer(line)]
        i = 0
        while i < len(toks):
            if toks[i][1].isdigit():
                i += 1
                continue
            labels = []
            while i < len(toks) and not toks[i][1].isdigit():
                labels.append(toks[i])
                i += 1
            nums = []
            while i < len(toks) and toks[i][1].isdigit():
                nums.append(int(toks[i][1]))
                i += 1
            entries.append((li, labels[-1][0], [t for _, t in labels], nums, labels))
    # 무리 단어(보건·영양 …)만 있는 줄 위치
    group_marks = [(li, lx, GROUP[t]) for li, _, _, _, labels in entries for lx, t in labels if t in GROUP]
    for li, x, labs, nums, _ in entries:
        lab = labs[-1]
        if len(nums) >= 3 and nums[0] + nums[1] == nums[2]:
            g, d, t = nums[:3]
        elif len(nums) >= 2 and nums[0] == nums[1]:
            g, d, t = nums[0], 0, nums[0]
        else:
            continue
        if re.search(r'합\s*계', ' '.join(labs)):
            total = (g, d, t)
            continue
        if re.search(r'소\s*계', lab):
            continue
        if LEVEL.match(lab):
            grp = next((GROUP[t] for t in labs[:-1] if t in GROUP), None)
            if grp is None:
                near = [(abs(gl - li), gl > li, gc) for gl, gx, gc in group_marks if abs(gl - li) <= 2 and gx < x and x - gx < 25]
                grp = min(near)[2] if near else None
            if grp is None:
                return [], None, f'무리 못 찾음: {li} {labs}'
            code = grp if lab in ('중등', '중') else f'x:{grp}_{lab}'
        else:
            code = GROUP.get(lab) or ('nutrition' if re.fullmatch(r'영양\(초등[·ㆍ・‧․]중등\)', lab) else None) or _subject(lab)
            if code is None and re.fullmatch(r'[가-힣·‧․ㆍ・()舊 ]{2,12}', lab) and not re.search(r'과목|인원|구분|연번|일반|장애|단위', lab):
                code = 'x:' + lab  # 기계·농공 등 앱 목록에 없는 과목 (합계 검사에만 씀)
            if code is None:
                continue
        rows.append((code, g, d, t))
    return rows, total, None


def parse(path):
    text = subprocess.run(['pdftotext', '-layout', path, '-'], capture_output=True, text=True, timeout=60).stdout
    rows, total, err = parse_lines(section(text))
    if err or not total or not rows:
        return [], err or '합계 줄 없음'
    s = tuple(sum(r[i] for r in rows) for i in (1, 2, 3))
    if total[0] is None:
        s = (None, None, s[2])
    if s != total:
        return [], f'합 {s} != 합계 {total}'
    return rows, None


if __name__ == '__main__':
    import os
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    for p in sys.argv[1:]:
        rows, err = parse(p)
        print(p.split('/')[-1], len(rows), err or '', [r for r in rows if not r[0].startswith('x')][:4])
