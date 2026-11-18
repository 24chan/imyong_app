import type { DataQuery, ExamResult, RegionSummary, SelectionCount, Source } from '../types/data';
import { REGIONS } from './regions';
import examResultsJson from './sample/exam_results.json';
import selectionJson from './sample/selection_counts.json';
import sourcesJson from './sample/sources.json';

// 데이터 창구. 지금은 샘플 JSON을 읽고, 나중에 이 파일만 Supabase 조회로 바꿉니다.
// 화면은 여기 있는 함수만 사용하세요.

export const IS_SAMPLE_DATA = true;

const selection = selectionJson as SelectionCount[];
const results = examResultsJson as ExamResult[];
const sources = sourcesJson as Source[];

const sameKey = (q: DataQuery) => (r: { level: string; subject: string | null }) =>
  r.level === q.level && (q.level === 'elementary' ? r.subject === null : r.subject === (q.subject ?? null));

const pct = (num: number | null, den: number | null) =>
  num != null && den ? Math.round((num / den) * 1000) / 10 : null;
const ratio = (num: number | null, den: number | null) =>
  num != null && den ? Math.round((num / den) * 100) / 100 : null;

/** 데이터가 있는 학년도 목록 (최근 순) */
export async function getYears(): Promise<number[]> {
  return [...new Set(selection.map((r) => r.year))].sort((a, b) => b - a);
}

/** 중등에서 샘플 데이터가 있는 과목 code 목록 */
export async function getAvailableSubjects(): Promise<string[]> {
  return [...new Set(selection.filter((r) => r.level === 'secondary').map((r) => r.subject!))];
}

function summarize(q: DataQuery, year: number, region: string): RegionSummary {
  const match = sameKey(q);
  const rows = selection.filter((r) => match(r) && r.region === region);
  const pick = (y: number, stage: 'preliminary' | 'confirmed') =>
    rows.find((r) => r.year === y && r.stage === stage) ?? null;
  const pre = pick(year, 'preliminary');
  const conf = pick(year, 'confirmed');
  const prev = pick(year - 1, 'confirmed');
  const sel = conf ?? pre;
  const res = results.find((r) => match(r) && r.region === region && r.year === year) ?? null;
  const selectionN = sel?.total ?? null;
  const change = selectionN != null && prev ? selectionN - prev.total : null;
  const dates = [sel?.baseDate, res?.baseDate].filter(Boolean) as string[];
  const sourceId = res?.sourceId ?? sel?.sourceId;
  return {
    year,
    level: q.level,
    region,
    subject: q.level === 'elementary' ? null : (q.subject ?? null),
    selection: selectionN,
    selectionStage: sel?.stage ?? null,
    preliminary: pre?.total ?? null,
    confirmed: conf?.total ?? null,
    prevSelection: prev?.total ?? null,
    change,
    changeRate: change != null && prev?.total ? pct(change, prev.total) : null,
    applicants: res?.applicants ?? null,
    takers: res?.takers ?? null,
    ratioApplied: ratio(res?.applicants ?? null, selectionN),
    ratioActual: ratio(res?.takers ?? null, selectionN),
    firstCutoff: res?.firstCutoff ?? null,
    passRateApplied: pct(res?.finalPassed ?? null, res?.applicants ?? null),
    passRateActual: pct(res?.finalPassed ?? null, res?.takers ?? null),
    source: sources.find((s) => s.id === sourceId) ?? null,
    baseDate: dates.sort().at(-1) ?? null,
  };
}

/** 한 해의 17개 시도 요약 (지도·목록용) */
export async function getRegionSummaries(q: DataQuery, year: number): Promise<RegionSummary[]> {
  return REGIONS.map((r) => summarize(q, year, r.code));
}

/** 한 지역의 연도별 요약 (추이 그래프용, 오래된 순) */
export async function getRegionTrend(q: DataQuery, region: string): Promise<RegionSummary[]> {
  const years = (await getYears()).slice().reverse();
  return years.map((y) => summarize(q, y, region));
}
