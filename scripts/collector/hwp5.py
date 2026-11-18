"""구형 한글(.hwp, HWP 5.x) → 표 행 목록 (dump.hwpx_rows 와 같은 모양)
pyhwp(hwp5html)가 최신 한글 파일을 자주 못 읽어서 직접 읽음. 외부 패키지 없이 표준 라이브러리만 사용.
- 파일 구조: OLE(Compound File) 안의 BodyText/Section0.. 스트림, zlib 압축된 레코드 목록
- 표: 셀마다 (행, 열) 주소가 있어 격자에 놓음. 병합된 자리는 빈칸 → 칸 위치가 머리글과 맞음
"""
import re
import struct
import sys
import zlib

FREESECT, ENDOFCHAIN = 0xFFFFFFFF, 0xFFFFFFFE


class Cfb:
    """최소한의 OLE Compound File 읽기"""

    def __init__(self, data):
        if data[:8] != b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1':
            raise ValueError('OLE 파일 아님')
        self.d = data
        self.ss = 1 << struct.unpack_from('<H', data, 0x1E)[0]
        self.mss = 1 << struct.unpack_from('<H', data, 0x20)[0]
        n_fat, first_dir = struct.unpack_from('<II', data, 0x2C)
        self.cutoff, first_minifat, n_minifat, first_difat, n_difat = struct.unpack_from('<IIIII', data, 0x38)
        difat = list(struct.unpack_from('<109I', data, 0x4C))
        s = first_difat
        for _ in range(n_difat):
            if s in (FREESECT, ENDOFCHAIN):
                break
            vals = struct.unpack_from(f'<{self.ss // 4}I', self.sector(s))
            difat += vals[:-1]
            s = vals[-1]
        self.fat = []
        for s in difat[:n_fat]:
            if s in (FREESECT, ENDOFCHAIN):
                continue
            self.fat += struct.unpack_from(f'<{self.ss // 4}I', self.sector(s))
        dirs = self.chain(first_dir)
        self.entries = []
        for i in range(len(dirs) // 128):
            e = dirs[i * 128:(i + 1) * 128]
            nlen = struct.unpack_from('<H', e, 64)[0]
            name = e[:max(0, nlen - 2)].decode('utf-16-le', 'ignore')
            typ = e[66]
            left, right, child = struct.unpack_from('<iii', e, 68)
            start, size = struct.unpack_from('<II', e, 116)
            self.entries.append({'name': name, 'type': typ, 'left': left, 'right': right, 'child': child, 'start': start, 'size': size})
        root = self.entries[0]
        self.ministream = self.chain(root['start'])[:root['size']] if root['start'] != ENDOFCHAIN else b''
        self.minifat = list(struct.unpack(f'<{len(m) // 4}I', m)) if (m := self.chain(first_minifat) if n_minifat else b'') else []

    def sector(self, s):
        o = (s + 1) * self.ss
        return self.d[o:o + self.ss]

    def chain(self, s):
        out, seen = [], set()
        while s not in (FREESECT, ENDOFCHAIN) and s < len(self.fat) and s not in seen:
            seen.add(s)
            out.append(self.sector(s))
            s = self.fat[s]
        return b''.join(out)

    def minichain(self, s):
        out, seen = [], set()
        while s not in (FREESECT, ENDOFCHAIN) and s < len(self.minifat) and s not in seen:
            seen.add(s)
            out.append(self.ministream[s * self.mss:(s + 1) * self.mss])
            s = self.minifat[s]
        return b''.join(out)

    def children(self, idx):
        """저장소(폴더) 안의 항목 이름 → 번호"""
        out, stack = {}, [self.entries[idx]['child']]
        while stack:
            i = stack.pop()
            if i < 0 or i >= len(self.entries):
                continue
            e = self.entries[i]
            out[e['name']] = i
            stack += [e['left'], e['right']]
        return out

    def read(self, path):
        idx = 0
        for part in path.split('/'):
            kids = self.children(idx)
            if part not in kids:
                return None
            idx = kids[part]
        e = self.entries[idx]
        data = self.minichain(e['start']) if e['size'] < self.cutoff else self.chain(e['start'])
        return data[:e['size']]

    def list(self, folder):
        idx = self.children(0).get(folder)
        return sorted(self.children(idx)) if idx is not None else []


TAG_PARA_HEADER, TAG_PARA_TEXT, TAG_CTRL_HEADER, TAG_LIST_HEADER, TAG_TABLE = 66, 67, 71, 72, 77
# 8글자(16바이트)를 차지하는 조판 부호
WIDE = {1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23}


def records(buf):
    i = 0
    while i + 4 <= len(buf):
        h = struct.unpack_from('<I', buf, i)[0]
        tag, level, size = h & 0x3FF, (h >> 10) & 0x3FF, h >> 20
        i += 4
        if size == 0xFFF:
            size = struct.unpack_from('<I', buf, i)[0]
            i += 4
        yield tag, level, buf[i:i + size]
        i += size


def para_text(b):
    out = []
    i = 0
    n = len(b) // 2
    while i < n:
        c = struct.unpack_from('<H', b, i * 2)[0]
        if c < 32:
            if c in WIDE:
                if c == 9:
                    out.append(' ')
                i += 8
                continue
            if c in (10, 13):
                out.append(' ')
            i += 1
            continue
        out.append(chr(c))
        i += 1
    # 서로게이트 쌍 합치기 + 한글 전용 글꼴 문자(사용자 정의 영역) 버림
    t = ''.join(out).encode('utf-16-le', 'surrogatepass').decode('utf-16-le', 'ignore')
    return re.sub(r'[\ue000-\uf8ff\U000f0000-\U0010ffff]', '', t)


def rows(path):
    data = open(path, 'rb').read()
    cfb = Cfb(data)
    head = cfb.read('FileHeader') or b''
    if not head.startswith(b'HWP Document File'):
        raise ValueError('한글 파일 아님')
    flags = struct.unpack_from('<I', head, 36)[0]
    if flags & 0x2:
        raise ValueError('암호 걸린 문서')
    if flags & 0x4:
        raise ValueError('배포용 문서 (본문 암호화)')
    compressed = bool(flags & 0x1)
    out = []
    sections = sorted(cfb.list('BodyText'), key=lambda s: int(re.sub(r'\D', '', s) or 0))
    for sec in sections:
        raw = cfb.read(f'BodyText/{sec}')
        if raw is None:
            continue
        buf = zlib.decompress(raw, -15) if compressed else raw
        stack = []  # 열린 표: {'level', 'nrows', 'ncols', 'grid', 'cell', 'cell_level'}
        top_text = []

        def close_tables(level):
            # level 이하의 레코드가 나오면 그보다 깊은 표는 끝난 것
            while stack and level <= stack[-1]['level']:
                t = stack.pop()
                if stack:  # 표 안의 표: 바깥 셀 글자로 합침
                    cell = stack[-1]['cell']
                    if cell is not None:
                        stack[-1]['grid'][cell] = (stack[-1]['grid'].get(cell, '') + ' ' + ' '.join(
                            v for _, v in sorted(t['grid'].items()))).strip()
                    continue
                out.append(['[표]'])
                if t['grid']:
                    nr = max(max(r for r, _ in t['grid']) + 1, 0)
                    nc = max(t['ncols'], max(c for _, c in t['grid']) + 1)
                    for r in range(nr):
                        row = [re.sub(r'\s+', ' ', t['grid'].get((r, c), '')).strip() for c in range(nc)]
                        out.append(row)
                out.append(['[/표]'])

        for tag, level, body in records(buf):
            if stack and level <= stack[-1]['level']:
                close_tables(level)
            if tag == TAG_CTRL_HEADER and body[:4] == b' lbt':
                stack.append({'level': level, 'nrows': 0, 'ncols': 0, 'grid': {}, 'cell': None, 'cell_level': level + 1})
            elif tag == TAG_TABLE and stack and level == stack[-1]['level'] + 1 and len(body) >= 8:
                stack[-1]['nrows'], stack[-1]['ncols'] = struct.unpack_from('<HH', body, 4)
            elif tag == TAG_LIST_HEADER and stack and level == stack[-1]['level'] + 1 and len(body) >= 12:
                col, row = struct.unpack_from('<HH', body, 8)
                stack[-1]['cell'] = (row, col)
                stack[-1]['grid'].setdefault((row, col), '')
            elif tag == TAG_PARA_TEXT:
                t = para_text(body)
                if stack and stack[-1]['cell'] is not None:
                    g = stack[-1]['grid']
                    g[stack[-1]['cell']] = (g[stack[-1]['cell']] + ' ' + t).strip()
                elif not stack:
                    t = re.sub(r'\s+', ' ', t).strip()
                    if t:
                        out.append([t])
        close_tables(-1)
    return out


if __name__ == '__main__':
    for r in rows(sys.argv[1]):
        print(' | '.join(r))
