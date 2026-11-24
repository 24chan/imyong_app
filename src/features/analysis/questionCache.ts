import type { Box } from '../../data/analysis';

// 기출 문항 보기 캐시 (2026-11-24 사용자 승인 A안 + 요청 3가지)
// - 평가원 원본 PDF와 잘라낸 문항 그림은 이 기기 안(문서 폴더 kice/)에만 저장 → 다시 열면 바로 보임
// - 서버·저장소에는 문항 그림을 올리지 않음
// - 옛 설치 파일에 파일 모듈이 없으면 null → 화면은 캐시 없이 바로 그리기

type FSMod = typeof import('expo-file-system');
let mod: FSMod | null | undefined;

function fs(): FSMod | null {
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('expo-file-system') as FSMod;
    const d = new m.Directory(m.Paths.document, 'kice');
    if (!d.exists) d.create({ intermediates: true, idempotent: true });
    mod = m;
  } catch {
    mod = null;
  }
  return mod;
}

export const hasDeviceCache = () => fs() !== null;

const KEEP_PDFS = 16; // 문제지 원본은 최근 16개까지만 (한 개 1~5MB)
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36';

function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function dir(m: FSMod, sub: 'pdf' | 'crop') {
  const d = new m.Directory(m.Paths.document, 'kice', sub);
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

/** 잘라낸 그림 이름: 문항 + 쪽 + 비율(바뀌면 새로 그림) */
export const cropName = (key: string, b: Box) => `${key}_p${b.p}_${b.r.map((v) => Math.round(v * 10000)).join('-')}`;

export type Crop = { uri: string; w: number; h: number };

/** 저장된 잘라낸 그림이 있으면 바로 돌려줌 */
export function cachedCrop(name: string): Crop | null {
  const m = fs();
  if (!m) return null;
  try {
    const d = dir(m, 'crop');
    const png = new m.File(d, `${name}.png`);
    const meta = new m.File(d, `${name}.json`);
    if (!png.exists || !meta.exists) return null;
    const { w, h } = JSON.parse(meta.textSync()) as { w: number; h: number };
    return w > 0 && h > 0 ? { uri: png.uri, w, h } : null;
  } catch {
    return null;
  }
}

export async function saveCrop(name: string, pngBase64: string, w: number, h: number): Promise<Crop | null> {
  const m = fs();
  if (!m) return null;
  try {
    const d = dir(m, 'crop');
    const png = new m.File(d, `${name}.png`);
    png.write(pngBase64, { encoding: 'base64' });
    new m.File(d, `${name}.json`).write(JSON.stringify({ w, h }));
    return { uri: png.uri, w, h };
  } catch {
    return null;
  }
}

/** 평가원 원본 PDF: 기기에 있으면 그대로, 없으면 받아서 저장. base64로 돌려줌(그리기 화면에 넘김) */
export async function pdfBase64(url: string): Promise<string> {
  const m = fs();
  if (!m) throw new Error('no-fs');
  const d = dir(m, 'pdf');
  const f = new m.File(d, `${hash(url)}.pdf`);
  if (!f.exists || (f.size ?? 0) < 1000) {
    await m.File.downloadFileAsync(url, f, { idempotent: true, headers: { 'User-Agent': UA, Referer: 'https://www.kice.re.kr/' } });
    prune(m, d);
  }
  const b64 = await f.base64();
  if (!b64.startsWith('JVBER')) {
    // %PDF 로 시작하지 않음 → 오류 쪽을 받은 것
    try {
      f.delete();
    } catch {
      /* 무시 */
    }
    throw new Error('not-pdf');
  }
  return b64;
}

function prune(m: FSMod, d: InstanceType<FSMod['Directory']>) {
  try {
    const files = d.list().filter((x): x is InstanceType<FSMod['File']> => x instanceof m.File);
    if (files.length <= KEEP_PDFS) return;
    files
      .sort((a, b) => (b.modificationTime ?? 0) - (a.modificationTime ?? 0))
      .slice(KEEP_PDFS)
      .forEach((x) => {
        try {
          x.delete();
        } catch {
          /* 무시 */
        }
      });
  } catch {
    /* 무시 */
  }
}

/** 설정 등에서 쓸 수 있게: 저장한 기출 문항 지우기 */
export function clearQuestionCache() {
  const m = fs();
  if (!m) return;
  try {
    const d = new m.Directory(m.Paths.document, 'kice');
    if (d.exists) d.delete();
  } catch {
    /* 무시 */
  }
}
