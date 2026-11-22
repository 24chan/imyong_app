import type { Level } from '../store/AppSettings';

// 평가원 임용 기출 '목록' (collector-kice). 파일은 평가원 서버에서 바로 열어요(앱이 복사해 두지 않음).
export type PastExamFile = { name: string; key: string };
export type PastExam = { id: string; year: number; kind: string; title: string; date: string; files: PastExamFile[] };
export type PastExamList = { level: Level; source: string; page: string; file_url: string; updated: string; items: PastExam[] };

const BASE = 'https://raw.githubusercontent.com/24chan/imyong_app/raw-files/raw/resources';
const cache = new Map<Level, { at: number; data: PastExamList }>();

export async function getPastExams(level: Level): Promise<PastExamList | null> {
  const c = cache.get(level);
  if (c && Date.now() - c.at < 30 * 60 * 1000) return c.data;
  const res = await fetch(`${BASE}/kice_${level}.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`기출 목록을 불러오지 못했어요 (${res.status})`);
  const data = (await res.json()) as PastExamList;
  cache.set(level, { at: Date.now(), data });
  return data;
}

export const fileUrl = (list: PastExamList, f: PastExamFile) => `${list.file_url}${f.key}`;

/** 파일 이름에서 보기 좋은 이름: '2026_중등1차_국어_전공A.pdf' → '국어 전공A' */
export function prettyFile(name: string) {
  return name
    .replace(/\.(pdf|hwp|hwpx)$/i, '')
    .replace(/^\d{4}(학년도)?_?/, '')
    .replace(/중등1차_|중등2차_/, '')
    .replace(/_/g, ' ')
    .trim();
}
