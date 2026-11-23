"""공고 첨부 한글 파일(.hwp/.hwpx) → PDF (2026-11-24 사용자 요청: 앱 안에서 보기)
- .hwp: convert_hwp.sh가 만든 .hwp.xhtml(hwp5html)을 크롬으로 인쇄
- .hwpx: 압축 안의 본문 XML에서 문단·표를 꺼내 간단한 HTML로 → 크롬으로 인쇄
결과: raw/<지역>/pdf/<sha1>.pdf (이미 있으면 건너뜀). 공고문은 공문서라 저작권 보호 대상이 아님(저작권법 제7조)
사용: python docs_to_pdf.py <raw 폴더>"""
import glob
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

CSS = """<style>
body{font-family:'Noto Sans CJK KR','Noto Sans KR',sans-serif;font-size:10.5pt;line-height:1.5;margin:14mm}
table{border-collapse:collapse;margin:6px 0;width:auto;max-width:100%}
td,th{border:1px solid #888;padding:2px 4px;vertical-align:top;font-size:9.5pt}
p{margin:2px 0}
</style>"""


def chrome():
    for c in ('google-chrome', 'chromium', 'chromium-browser'):
        if shutil.which(c):
            return c
    return None


def hwpx_html(path):
    """hwpx(압축된 XML) → 문단·표만 살린 HTML"""
    out = []
    with zipfile.ZipFile(path) as z:
        secs = sorted(n for n in z.namelist() if re.match(r'Contents/section\d+\.xml$', n))
        for n in secs:
            x = z.read(n).decode('utf-8', 'ignore')
            # 표: <hp:tbl> … <hp:tr> … <hp:tc> … 글자는 <hp:t>
            def cell_text(s):
                return html.escape(' '.join(re.findall(r'<hp:t>([^<]*)</hp:t>', s)))

            pos = 0
            for tm in re.finditer(r'<hp:tbl\b.*?</hp:tbl>', x, re.S):
                for pm in re.finditer(r'<hp:p\b.*?</hp:p>', x[pos:tm.start()], re.S):
                    t = cell_text(pm.group(0))
                    if t.strip():
                        out.append(f'<p>{t}</p>')
                rows = []
                for tr in re.finditer(r'<hp:tr\b.*?</hp:tr>', tm.group(0), re.S):
                    cells = []
                    for tc in re.finditer(r'<hp:tc\b(.*?)>(.*?)</hp:tc>', tr.group(0), re.S):
                        span = re.search(r'<hp:cellSpan colSpan="(\d+)" rowSpan="(\d+)"', tc.group(2))
                        cs, rs = (span.group(1), span.group(2)) if span else ('1', '1')
                        cells.append(f'<td colspan="{cs}" rowspan="{rs}">{cell_text(tc.group(2))}</td>')
                    rows.append('<tr>' + ''.join(cells) + '</tr>')
                out.append('<table>' + ''.join(rows) + '</table>')
                pos = tm.end()
            for pm in re.finditer(r'<hp:p\b.*?</hp:p>', x[pos:], re.S):
                t = cell_text(pm.group(0))
                if t.strip():
                    out.append(f'<p>{t}</p>')
    return '\n'.join(out)


def main(raw):
    exe = chrome()
    if not exe:
        print('크롬이 없어 PDF 변환 건너뜀')
        return
    made = fail = 0
    for mf in sorted(glob.glob(os.path.join(raw, '*', 'manifest.json'))):
        region_dir = os.path.dirname(mf)
        out_dir = os.path.join(region_dir, 'pdf')
        for m in json.load(open(mf)):
            p = m['path'].lower()
            if not (p.endswith('.hwp') or p.endswith('.hwpx')):
                continue
            src = os.path.join(raw, m['path'])
            dst = os.path.join(out_dir, m['sha1'] + '.pdf')
            if os.path.exists(dst) or not os.path.exists(src):
                continue
            try:
                if p.endswith('.hwp'):
                    if not os.path.exists(src + '.xhtml'):
                        continue
                    body = open(src + '.xhtml', encoding='utf-8', errors='ignore').read()
                    body = re.sub(r'<link[^>]+stylesheet[^>]*>', '', body)
                    body = body.replace('</head>', CSS + '</head>', 1) if '</head>' in body else CSS + body
                else:
                    body = f'<!doctype html><html><head><meta charset="utf-8">{CSS}</head><body>{hwpx_html(src)}</body></html>'
                if len(re.sub(r'<[^>]+>', '', body).strip()) < 20:
                    raise ValueError('본문이 비어 있음')
                os.makedirs(out_dir, exist_ok=True)
                with tempfile.TemporaryDirectory() as td:
                    h = os.path.join(td, 'doc.html')
                    open(h, 'w', encoding='utf-8').write(body)
                    subprocess.run([exe, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer',
                                    f'--print-to-pdf={dst}', 'file://' + h], check=True, timeout=120, capture_output=True)
                if os.path.exists(dst) and os.path.getsize(dst) > 1000:
                    made += 1
                else:
                    raise ValueError('PDF가 비어 있음')
            except Exception as e:  # noqa: BLE001
                fail += 1
                if os.path.exists(dst):
                    os.remove(dst)
                print('PDF 변환 실패', m['path'], str(e)[:120])
    print(f'한글 → PDF {made}개 (실패 {fail})')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'raw')
