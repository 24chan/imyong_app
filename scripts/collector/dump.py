"""원문 파일(pdf/hwpx/xlsx) → 표를 '|' 로 구분한 텍스트 행 목록으로 변환 (파서 공통 입력)
사용: python dump.py <파일>   (확인용 출력)
"""
import re
import sys
import zipfile
import xml.etree.ElementTree as ET


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
                        rows.append(['[표]'])
                        for tr in ch:
                            if _local(tr.tag) != 'tr':
                                continue
                            rows.append([text_of(tc) for tc in tr if _local(tc.tag) == 'tc'])
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
        rows.append([f'[시트] {ws.title}'])
        for r in ws.iter_rows(values_only=True):
            cells = ['' if v is None else re.sub(r'\s+', ' ', str(v)).strip() for v in r]
            while cells and cells[-1] == '':
                cells.pop()
            if any(cells):
                rows.append(cells)
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


def rows_of(path):
    ext = path.rsplit('.', 1)[-1].lower()
    if ext == 'hwpx':
        return hwpx_rows(path)
    if ext in ('xlsx', 'xlsm'):
        return xlsx_rows(path)
    if ext == 'pdf':
        return pdf_rows(path)
    raise ValueError(f'지원 안 함: {ext}')


if __name__ == '__main__':
    for r in rows_of(sys.argv[1]):
        print(' | '.join(r))
