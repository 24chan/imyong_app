import { cached } from './repository';
import { fileUrl, getPastExams } from './pastExams';
import type { Level } from '../store/AppSettings';

// 기출 분석 (2026-11-24 사용자 승인): exam-analysis 워크플로가 만든 raw-files/raw/analysis/<level>.json
// 교육과정 원문 칸(고시문) + 칸마다 출제 기록(연도·A/B·번호, 원문에서 겹친 곳) + 통계. 문항 글은 들어 있지 않음
const BASE = 'https://raw.githubusercontent.com/24chan/imyong_app/raw-files/raw/analysis';

export type Unit = { id: number; subject: string; era: '2022' | '2015'; section: string; area: string; code: string; text: string; file?: { name: string; url: string } | null };
export type Hit = { y: number; p: string; n: number; s: number; h: [number, number][] };
export type Analysis = {
  level: Level;
  built: string;
  note: string;
  years: number[];
  units: Unit[];
  hits: Record<string, Hit[]>;
  questions: { year: number; paper: string; no: number; subject: string | null }[];
  stats: {
    subject_year: Record<string, Record<string, number>>;
    section_share: Record<string, Record<string, number>>;
    top_terms: Record<string, { term: string; total: number; years: Record<string, number> }[]>;
    untouched_recent5: Record<string, { code: string; area: string; id: number }[]>;
    new_terms_2022: Record<string, string[]>;
  };
};

export function getAnalysis(level: Level): Promise<Analysis | null> {
  return cached(`analysis:${level}`, async () => {
    const res = await fetch(`${BASE}/${level}.json`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`기출 분석을 불러오지 못했어요 (${res.status})`);
    return (await res.json()) as Analysis;
  });
}

/** 연도·A/B → 평가원 문제지 주소 (앱 안 PDF 보기용) */
export async function examPdf(level: Level, year: number, paper: string): Promise<{ url: string; page: string } | null> {
  const list = await getPastExams(level);
  if (!list) return null;
  const it = list.items.find((x) => x.year === year && x.kind === '문제' && new RegExp(`교육과정\\s*${paper}`).test(x.title));
  const f = it?.files.find((x) => x.name.includes('초등학교')) ?? it?.files[0];
  return f ? { url: fileUrl(list, f), page: list.page } : null;
}

/** 원문 칸 글을 형광펜 구간으로 나눔: [{t, hot}] (겹친 횟수만큼 진하게) */
export function highlight(text: string, hits: Hit[]): { t: string; heat: number }[] {
  const heat = new Array(text.length + 1).fill(0);
  hits.forEach((h) => h.h.forEach(([a, b]) => {
    for (let i = Math.max(0, a); i < Math.min(text.length, b); i++) heat[i] += 1;
  }));
  const out: { t: string; heat: number }[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || heat[i] !== heat[start]) {
      out.push({ t: text.slice(start, i), heat: heat[start] });
      start = i;
    }
  }
  return out;
}
