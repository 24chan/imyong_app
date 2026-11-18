import { supabase } from '../lib/supabase';
import type { Level } from '../store/AppSettings';
import type {
  DataQuery,
  ExamResult,
  RegionSummary,
  ScheduleEvent,
  SelectionCount,
  Source,
} from '../types/data';
import { REGIONS } from './regions';

// 데이터 창구. Supabase(서버 DB)에서 읽고, 같은 앱 실행 동안은 기억(캐시)해 둡니다.
// 화면은 여기 있는 함수만 사용하세요.

/** 샘플(가짜) 출처인지. 화면의 '샘플 데이터' 배지에 사용 */
export const isSampleSource = (sourceId: string | null | undefined) => sourceId === 'sample';

// ───── 서버에서 읽기 + 캐시 ─────

const cache = new Map<string, Promise<unknown>>();
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) {
    const p = load().catch((e) => {
      cache.delete(key); // 실패하면 다음에 다시 시도
      throw e;
    });
    cache.set(key, p);
  }
  return cache.get(key) as Promise<T>;
}

/** 설정의 '데이터 새로고침'에서 사용 */
export function clearDataCache() {
  cache.clear();
}

class DataError extends Error {
  constructor(what: string, message: string) {
    super(`${what}: ${message}`);
  }
}

type SelRow = {
  year: number; level: Level; region: string; subject: string | null; stage: 'preliminary' | 'confirmed';
  general: number | null; disabled: number | null; total: number; source_id: string; base_date: string;
};
type ResRow = {
  year: number; level: Level; region: string; subject: string | null; applicants: number | null;
  takers: number | null; first_passed: number | null; first_cutoff: number | null; final_passed: number | null;
  source_id: string; base_date: string;
};
type SchRow = { year: number; level: Level; region: string; event: ScheduleEvent['event']; date: string; source_id: string };

const subjectFilter = (q: DataQuery) => (q.level === 'elementary' ? null : (q.subject ?? null));

/** 한 모드(·과목)의 선발 인원 + 시험 결과 (최대 약 500행) */
function loadDataset(q: DataQuery) {
  const subject = subjectFilter(q);
  return cached(`ds:${q.level}:${subject}`, async () => {
    let sq = supabase
      .from('selection_counts')
      .select('year,level,region,subject,stage,general,disabled,total,source_id,base_date')
      .eq('level', q.level);
    let rq = supabase
      .from('exam_results')
      .select('year,level,region,subject,applicants,takers,first_passed,first_cutoff,final_passed,source_id,base_date')
      .eq('level', q.level);
    sq = subject ? sq.eq('subject', subject) : sq.is('subject', null);
    rq = subject ? rq.eq('subject', subject) : rq.is('subject', null);
    const [s, r] = await Promise.all([sq, rq]);
    if (s.error) throw new DataError('선발 인원', s.error.message);
    if (r.error) throw new DataError('시험 결과', r.error.message);
    const selection: SelectionCount[] = (s.data as SelRow[]).map((x) => ({
      year: x.year, level: x.level, region: x.region, subject: x.subject, stage: x.stage,
      general: x.general, disabled: x.disabled, total: x.total, sourceId: x.source_id, baseDate: x.base_date,
    }));
    const results: ExamResult[] = (r.data as ResRow[]).map((x) => ({
      year: x.year, level: x.level, region: x.region, subject: x.subject, applicants: x.applicants ?? 0,
      takers: x.takers, firstPassed: x.first_passed,
      firstCutoff: x.first_cutoff != null ? Number(x.first_cutoff) : null,
      finalPassed: x.final_passed, sourceId: x.source_id, baseDate: x.base_date,
    }));
    return { selection, results };
  });
}

function loadSources() {
  return cached('sources', async () => {
    const { data, error } = await supabase.from('sources').select('id,title,publisher,url');
    if (error) throw new DataError('출처', error.message);
    return data as Source[];
  });
}

// ───── 화면에서 쓰는 함수 ─────

/** 데이터가 있는 학년도 목록 (최근 순). 모드별로 다를 수 있음 */
export async function getYears(level: Level = 'elementary'): Promise<number[]> {
  return cached(`years:${level}`, async () => {
    const { data, error } = await supabase
      .from('selection_counts')
      .select('year')
      .eq('level', level)
      .order('year', { ascending: false })
      .limit(1000);
    if (error) throw new DataError('학년도', error.message);
    return [...new Set((data as { year: number }[]).map((r) => r.year))];
  });
}

/** 중등에서 데이터가 있는 과목 code 목록 (과목 순서대로) */
export async function getAvailableSubjects(): Promise<string[]> {
  return cached('subjects-with-data', async () => {
    const years = await getYears('secondary');
    if (!years.length) return [];
    const { data, error } = await supabase
      .from('selection_counts')
      .select('subject, subjects(sort)')
      .eq('level', 'secondary')
      .eq('stage', 'confirmed')
      .eq('year', years[0]);
    if (error) throw new DataError('과목', error.message);
    const rows = data as unknown as { subject: string; subjects: { sort: number } | null }[];
    const sortOf = new Map(rows.map((r) => [r.subject, r.subjects?.sort ?? 999]));
    return [...sortOf.keys()].sort((a, b) => sortOf.get(a)! - sortOf.get(b)!);
  });
}

/** 한 해·한 모드의 일정 (시도별). region을 주면 그 지역만 */
export async function getSchedules(level: Level, year: number, region?: string): Promise<ScheduleEvent[]> {
  const all = await cached(`sch:${level}:${year}`, async () => {
    const { data, error } = await supabase
      .from('exam_schedules')
      .select('year,level,region,event,date,source_id')
      .eq('level', level)
      .eq('year', year);
    if (error) throw new DataError('일정', error.message);
    return (data as SchRow[]).map((x) => ({ ...x, sourceId: x.source_id }) as ScheduleEvent);
  });
  return all.filter((s) => !region || s.region === region).sort((a, b) => a.date.localeCompare(b.date));
}

const pct = (num: number | null, den: number | null) =>
  num != null && den ? Math.round((num / den) * 1000) / 10 : null;
const ratio = (num: number | null, den: number | null) =>
  num != null && den ? Math.round((num / den) * 100) / 100 : null;

function summarize(
  q: DataQuery,
  ds: { selection: SelectionCount[]; results: ExamResult[] },
  sources: Source[],
  year: number,
  region: string,
): RegionSummary {
  const rows = ds.selection.filter((r) => r.region === region);
  const pick = (y: number, stage: 'preliminary' | 'confirmed') =>
    rows.find((r) => r.year === y && r.stage === stage) ?? null;
  const pre = pick(year, 'preliminary');
  const conf = pick(year, 'confirmed');
  const prev = pick(year - 1, 'confirmed');
  const sel = conf ?? pre;
  const res = ds.results.find((r) => r.region === region && r.year === year) ?? null;
  const selectionN = sel?.total ?? null;
  const change = selectionN != null && prev ? selectionN - prev.total : null;
  const dates = [sel?.baseDate, res?.baseDate].filter(Boolean) as string[];
  const sourceId = res?.sourceId ?? sel?.sourceId;
  return {
    year,
    level: q.level,
    region,
    subject: subjectFilter(q),
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
  const [ds, sources] = await Promise.all([loadDataset(q), loadSources()]);
  return REGIONS.map((r) => summarize(q, ds, sources, year, r.code));
}

/** 한 지역의 연도별 요약 (추이 그래프용, 오래된 순) */
export async function getRegionTrend(q: DataQuery, region: string): Promise<RegionSummary[]> {
  const [ds, sources, years] = await Promise.all([loadDataset(q), loadSources(), getYears(q.level)]);
  return years
    .slice()
    .reverse()
    .map((y) => summarize(q, ds, sources, y, region));
}

/** 오류 신고 저장 */
export async function submitErrorReport(target: string, message: string) {
  const { error } = await supabase.from('error_reports').insert({ target, message });
  if (error) throw new DataError('오류 신고', error.message);
}

/** 서버 연결 확인 (설정 화면용) */
export async function checkServer(): Promise<{ ok: boolean; message: string }> {
  const { count, error } = await supabase.from('regions').select('code', { count: 'exact', head: true });
  if (error) return { ok: false, message: error.message };
  return { ok: (count ?? 0) > 0, message: `시도 ${count ?? 0}개 확인` };
}
