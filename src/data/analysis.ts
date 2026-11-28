import { cached, proJson } from './repository';
import { fileUrl, getPastExams } from './pastExams';
import type { Level } from '../store/AppSettings';

// 기출 분석 (2026-11-24 사용자 승인): exam-analysis 워크플로가 만든 raw-files/raw/analysis/<level>.json
// 교육과정 원문 칸(고시문) + 칸마다 출제 기록(연도·A/B·번호, 원문에서 겹친 곳) + 통계. 문항 글은 들어 있지 않음
// 2026-11-28 보안 보강: 공개 GitHub 대신 Supabase 비공개 저장소 pro/analysis (경인교대 인증 회원·운영자만)

export type Unit = { id: number; subject: string; era: '2022' | '2015'; section: string; area: string; code: string; text: string; file?: { name: string; url: string } | null };
/** 문항 자리 (2026-11-24): 쪽(1부터) + [왼쪽, 위, 오른쪽, 아래]를 쪽 크기에 대한 비율(0~1)로.
 *  src: text(글자 PDF 위치) / ocr(그림 PDF 글자 읽기) / manual(사람이 넣은 값) — 모두 같은 구조 */
export type Region = { p: number; r: [number, number, number, number] };
/** 문항 자리. next: 다음 단·쪽으로 이어지는 부분(물음 등, 2026-11-28) */
export type Box = Region & { src?: 'text' | 'ocr' | 'manual'; more?: boolean; next?: Region[] };
export type Hit = { y: number; p: string; n: number; s: number; h: [number, number][] };
export type Analysis = {
  level: Level;
  built: string;
  note: string;
  years: number[];
  subjects: { name: string; file: string; units: number; hit_units: number }[];
  questions: { year: number; paper: string; no: number; subject: string | null }[];
  /** 문항 자리만: '2019B' → '6' → Box. 문항 그림·글은 없음 */
  boxes?: Record<string, Record<string, Box>>;
  /** '2019B' → 분석에 쓴 평가원 문제지(초등학교) — 앱도 이 파일을 엶 */
  papers?: Record<string, { name: string; url: string; page: string }>;
  stats: {
    subject_year: Record<string, Record<string, number>>;
    section_share: Record<string, Record<string, number>>;
    top_terms: Record<string, { term: string; total: number; years: Record<string, number>; area?: string; cat?: string }[]>;
    untouched_recent5: Record<string, { code: string; area: string; id: number; text: string }[]>;
    new_terms_2022: Record<string, string[]>;
  };
};

export function getAnalysis(level: Level): Promise<Analysis | null> {
  return cached(`analysis:${level}`, async () => {
    const d = await proJson<Analysis>(`analysis/${level}.json`);
    if (!d) throw new Error('기출 분석을 불러오지 못했어요. 로그인·인증 상태를 확인해 주세요'); // 실패는 저장하지 않아 다음에 다시 시도
    return d;
  });
}

/** 교과 하나의 원문 칸 + 출제 기록 (요약과 따로 받음: 크기 줄이기) */
export type SubjectData = { subject: string; units: Unit[]; hits: Record<string, Hit[]> };
export function getAnalysisSubject(level: Level, file: string): Promise<SubjectData | null> {
  return cached(`analysis:${level}:${file}`, async () => {
    const d = await proJson<SubjectData>(`analysis/${level}/${file}`);
    if (!d) throw new Error('교과 자료를 불러오지 못했어요');
    return d;
  });
}

/** 연도·A/B → 평가원 문제지 주소 (앱 안 PDF 보기용)
 *  2026-11-24 고침: 같은 연도에 '유치원교사 추가 임용' 글이 먼저 걸려 유치원 문제지가 열리던 문제 → 분석에 쓴 파일(papers)을 그대로 쓰고,
 *  없을 때만 '초등' 시험 글의 '초등학교' 파일(특수·유치원 제외)을 찾음 */
export async function examPdf(level: Level, year: number, paper: string, a?: Analysis | null): Promise<{ url: string; page: string } | null> {
  const fixed = a?.papers?.[`${year}${paper}`];
  const list = await getPastExams(level);
  if (fixed) return { url: fixed.url, page: fixed.page || list?.page || '' };
  if (!list) return null;
  const isElemFile = (n: string) => n.includes('초등학교') && !n.includes('특수') && !n.includes('유치원');
  const it = list.items.find(
    (x) => x.year === year && x.kind === '문제' && new RegExp(`교육과정\\s*${paper}`).test(x.title) && x.title.includes('초등') && !x.title.includes('유치원교사') && x.files.some((f) => isElemFile(f.name)),
  );
  const f = it?.files.find((x) => isElemFile(x.name));
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
