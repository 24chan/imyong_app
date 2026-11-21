import pdfplumber, re, json, sys
REG = {'서울':'seoul','경기':'gyeonggi','인천':'incheon','세종':'sejong','부산':'busan','대전':'daejeon','대구':'daegu','광주':'gwangju','울산':'ulsan',
       '강원':'gangwon','충북':'chungbuk','충남':'chungnam','경북':'gyeongbuk','경남':'gyeongnam','전북':'jeonbuk','전남':'jeonnam','제주':'jeju'}
SUBJ = {'국어':'korean','영어':'english','수학':'math','일반사회':'social','역사':'history','지리':'geography','도덕윤리':'ethics','도덕·윤리':'ethics','윤리':'ethics',
        '물리':'physics','화학':'chemistry','생물':'biology','지구과학':'earth','체육':'pe','음악':'music','미술':'art','기술':'tech','가정':'homeec',
        '정보컴퓨터':'info','정보':'info','정보·컴퓨터':'info','한문':'hanmun','일본어':'japanese','중국어':'chinese','보건':'health','전문상담':'counsel','사서':'librarian','영양':'nutrition','특수':'special'}
CAT = {'일반':'general','장애':'disabled','지역':'regional','계':'total'}
ROLE7 = ['selected','applicants','rate','first_passed','first_cutoff','final_passed','final_cutoff']

def num(s):
    s = s.replace(',', '').strip()
    if not s or s in '-–': return None
    try: return float(s)
    except ValueError: return None

def parse(path, year, roles=None):
    out = []
    with pdfplumber.open(path) as pdf:
        for pi, p in enumerate(pdf.pages):
            ws = p.extract_words()
            # 칸 머리: 모집 위치로 과목 칸(7칸)을 잡고, 글자 머리(지원·경쟁률·합격인원·합격선)가 있으면 그 위치로 보정
            mojip = sorted([w for w in ws if w['text'] in ('모집', '모집계') and w['top'] < 140], key=lambda w: w['x0'])
            jiwon = [w for w in ws if w['text'] == '지원' and w['top'] < 140]
            if not mojip or not jiwon: continue
            head_top = min(w['top'] for w in mojip)
            cx = lambda w: (w['x0'] + w['x1']) / 2
            d = min(abs(cx(j) - cx(mojip[0])) for j in jiwon)
            # 과목 이름: 머리 줄 위쪽 띠의 글자 (모르는 과목도 넣어서 칸이 엉뚱한 과목에 붙지 않게)
            band = [w for w in ws if 45 < w['top'] < head_top - 2 and w['text'] not in ('구분', '1차', '최종')]
            names = []
            for w in band:
                t = w['text']
                if t in ('(초등)', '(중등)'): continue
                below = [u['text'] for u in band if u['text'] in ('(초등)', '(중등)') and 3 < u['top'] - w['top'] < 16 and abs(cx(u) - cx(w)) < 14]
                code = None if (below and below[0] == '(초등)') else SUBJ.get(t.replace(' ', ''))
                names.append((cx(w), code))
            # 같은 위치의 글자 조각은 하나로
            gaps = [cx(b) - cx(a) for a, b in zip(mojip, mojip[1:])]
            nslot = max(1, min(7, round(min(gaps) / d))) if gaps else 7
            slots = []
            for m in mojip:
                for k in range(nslot):
                    x = cx(m) + k * d
                    nm = min(names, key=lambda n: abs(n[0] - (cx(m) + (nslot - 1) / 2 * d)), default=(0, None))
                    slots.append({'cx': x, 'role': ROLE7[k], 'subj': nm[1]})
            # 앞 페이지에서 넘어온 칸: 첫 '모집'보다 왼쪽에 있는 '최종'/'합격선' 머리
            lead = sorted([w for w in ws if w['text'] in ('합격인원', '합격선') and w['top'] < 140 and cx(w) < cx(mojip[0]) - 5], key=cx)
            if lead and names:
                nm = min(names, key=lambda n: abs(n[0] - cx(lead[0])))
                roles = ROLE7[7 - len(lead):]
                for w, r in zip(lead, roles):
                    slots.append({'cx': cx(w), 'role': r, 'subj': nm[1]})
            slots = [s for s in sorted(slots, key=lambda s: s['cx'])]
            first_x = min(s['cx'] for s in slots) - d / 2
            for i, s in enumerate(slots):
                s['lo'] = (slots[i-1]['cx'] + s['cx']) / 2 if i else s['cx'] - d / 2
                s['hi'] = (slots[i+1]['cx'] + s['cx']) / 2 if i + 1 < len(slots) else s['cx'] + d / 2
            labels = [w for w in ws if w['x1'] < first_x and w['top'] > 100]
            regs = sorted([w for w in labels if w['text'] in REG], key=lambda w: w['top'])
            cats = [w for w in labels if w['text'] in CAT]
            if not regs: continue
            chars = p.chars
            for c in cats:
                rt = c['top']
                if rt < regs[0]['top'] - 14: continue
                near = min(regs, key=lambda r: abs(r['top'] - rt))
                if abs(near['top'] - rt) > 24: continue
                reg = REG[near['text']]
                rowc = [ch for ch in chars if abs(ch['top'] - rt) < 3.5 and ch['x0'] >= first_x]
                vals = {}
                for s in slots:
                    txt = ''.join(ch['text'] for ch in sorted(rowc, key=lambda ch: ch['x0']) if s['lo'] <= (ch['x0']+ch['x1'])/2 < s['hi'])
                    v = num(txt)
                    if v is not None and s['subj']: vals.setdefault(s['subj'], {})[s['role']] = v
                for subj, v in vals.items():
                    out.append({'region': reg, 'year': year, 'subject': subj, 'category': CAT[c['text']], **v, '_page': pi})
    # 같은 지역·과목·구분이 페이지 사이에 나뉘면 합침
    m = {}
    for r in out:
        k = (r['region'], r['year'], r['subject'], r['category'])
        m.setdefault(k, {}).update({x: y for x, y in r.items()})
    return list(m.values())

if __name__ == '__main__':
    recs = parse(sys.argv[1], int(sys.argv[2]))
    print(len(recs))
    for r in recs[:5]: print(r)
    json.dump(recs, open(sys.argv[3], 'w'), ensure_ascii=False)
