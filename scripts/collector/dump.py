"""원문 파일(pdf/hwpx/xlsx) → 표를 '|' 로 구분한 텍스트 행 목록으로 변환 (파서 공통 입력)
사용: python dump.py <파일>   (확인용 출력)
"""
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
import os as _os

sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))


def _local(t):
    return t.split('}')[-1]


def hwpx_rows(path):
    """표의 각 행을 셀 텍스트 리스트로. 표 밖 문단은 [텍스트] 1칸 행."""
    rows = []
    with zipfile.ZipFile(path) as z:
        names = sorted(n for n in z.namelist() if re.match(r'Contents/section\d+\.xml', n))
        for n in names:
            root = ET.fromstring(z.read(n))

            def text_of(el):
                return re.sub(r'\s+', ' ', ''.join(t.text or '' for t in el.iter() if _local(t.tag) == 't')).strip()

            def walk(el):
                for ch in el:
                    tag = _local(ch.tag)
                    if tag == 'tbl':
                        # 셀 주소(colAddr,rowAddr)로 격자에 놓음. 병합된 자리는 빈칸 → 칸 위치가 머리글과 맞음
                        grid = {}
                        ncol = int(ch.get('colCnt') or 0)
                        for tr in ch:
                            if _local(tr.tag) != 'tr':
                                continue
                            for tc in tr:
                                if _local(tc.tag) != 'tc':
                                    continue
                                addr = next((x for x in tc if _local(x.tag) == 'cellAddr'), None)
                                if addr is None:
                                    continue
                                c, r = int(addr.get('colAddr', 0)), int(addr.get('rowAddr', 0))
                                grid[(r, c)] = text_of(tc)
                                ncol = max(ncol, c + 1)
                        rows.append(['[표]'])
                        if grid:
                            for r in range(max(k[0] for k in grid) + 1):
                                rows.append([grid.get((r, c), '') for c in range(ncol)])
                        rows.append(['[/표]'])
                    elif tag == 'p' and not any(_local(x.tag) == 'tbl' for x in ch.iter()):
                        t = text_of(ch)
                        if t:
                            rows.append([t])
                    else:
                        walk(ch)
            walk(root)
    return rows


def xlsx_rows(path):
    import openpyxl
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    rows = []
    for ws in wb.worksheets:
        if rows:
            rows.append(['[/표]'])
        rows.append([f'[시트] {ws.title}'])
        rows.append(['[표]'])
        for r in ws.iter_rows(values_only=True):
            cells = ['' if v is None else re.sub(r'\s+', ' ', str(v)).strip() for v in r]
            # 엑셀은 칸 위치가 머리글과 같으므로 뒤쪽 빈 칸을 지우지 않음(칸 맞춤용)
            if any(cells):
                rows.append(cells)
    if rows:
        rows.append(['[/표]'])
    return rows


def xls_rows(path):
    """구형 엑셀(.xls) — xlrd 필요 (GitHub Actions 에서 설치)"""
    import xlrd
    wb = xlrd.open_workbook(path)
    rows = []
    for sh in wb.sheets():
        rows.append([f'[시트] {sh.name}'])
        rows.append(['[표]'])
        for i in range(sh.nrows):
            cells = []
            for v in sh.row_values(i):
                if isinstance(v, float) and v.is_integer():
                    v = int(v)
                cells.append(re.sub(r'\s+', ' ', str(v)).strip())
            if any(cells):
                rows.append(cells)
        rows.append(['[/표]'])
    return rows


def pdf_rows(path):
    import pdfplumber
    rows = []
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages):
            rows.append([f'[쪽] {i + 1}'])
            tables = page.extract_tables()
            if tables:
                for t in tables:
                    rows.append(['[표]'])
                    for r in t:
                        rows.append([re.sub(r'\s+', ' ', c or '').strip() for c in r])
                    rows.append(['[/표]'])
            else:
                for line in (page.extract_text() or '').splitlines():
                    if line.strip():
                        rows.append([line.strip()])
    return rows


def html_rows(path):
    """hwp5html 로 바꾼 구형 한글(.hwp) 문서 → 표 행 (표 안의 표는 바깥 셀 글자로 합침)"""
    from html.parser import HTMLParser

    class P(HTMLParser):
        def __init__(self):
            super().__init__()
            self.rows, self.depth, self.cell, self.row, self.text = [], 0, None, None, []

        def handle_starttag(self, tag, a):
            if tag == 'table':
                self.depth += 1
                if self.depth == 1:
                    self.flush_text()
                    self.rows.append(['[표]'])
            elif tag == 'tr' and self.depth == 1:
                self.row = []
            elif tag in ('td', 'th') and self.depth == 1:
                self.cell = []
            elif tag in ('p', 'br') and self.cell is not None:
                self.cell.append(' ')
            elif tag == 'p' and self.depth == 0:
                self.flush_text()

        def handle_endtag(self, tag):
            if tag == 'table':
                if self.depth == 1:
                    self.rows.append(['[/표]'])
                self.depth -= 1
            elif tag in ('td', 'th') and self.depth == 1 and self.cell is not None:
                self.row.append(re.sub(r'\s+', ' ', ''.join(self.cell)).strip())
                self.cell = None
            elif tag == 'tr' and self.depth == 1 and self.row is not None:
                if any(self.row):
                    self.rows.append(self.row)
                self.row = None

        def handle_data(self, d):
            if self.cell is not None:
                self.cell.append(d)
            elif self.depth == 0:
                self.text.append(d)

        def flush_text(self):
            t = re.sub(r'\s+', ' ', ''.join(self.text)).strip()
            if t:
                self.rows.append([t])
            self.text = []

    p = P()
    p.feed(open(path, encoding='utf-8', errors='ignore').read())
    p.flush_text()
    return p.rows


def rows_of(path):
    import os
    if path.lower().endswith('.hwp'):
        # 직접 읽기(hwp5.py)가 우선: 셀 주소로 격자를 맞춤. 안 되면 hwp5html 변환본
        try:
            from hwp5 import rows as hwp5_rows
            return hwp5_rows(path)
        except Exception:  # noqa: BLE001
            if os.path.exists(path + '.xhtml'):
                return html_rows(path + '.xhtml')
            raise
    ext = path.rsplit('.', 1)[-1].lower()
    if ext in ('xhtml', 'html'):
        return html_rows(path)
    if ext == 'hwpx':
        return hwpx_rows(path)
    if ext in ('xlsx', 'xlsm'):
        return xlsx_rows(path)
    if ext == 'xls':
        return xls_rows(path)
    if ext == 'pdf':
        return pdf_rows(path)
    raise ValueError(f'지원 안 함: {ext}')


if __name__ == '__main__':
    for r in rows_of(sys.argv[1]):
        print(' | '.join(r))
