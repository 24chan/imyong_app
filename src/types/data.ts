import type { Level } from '../store/AppSettings';

// DB 테이블과 같은 모양 (나중에 Supabase로 바꿔도 화면 코드는 그대로)

export type Stage = 'preliminary' | 'confirmed'; // 사전예고 / 확정

/** selection_counts: 선발 인원 */
export type SelectionCount = {
  year: number; // 학년도
  level: Level;
  region: string;
  subject: string | null; // 초등은 null
  stage: Stage;
  general: number | null; // 일반 (공개 안 된 경우 null)
  disabled: number | null; // 장애 (공개 안 된 경우 null)
  total: number;
  sourceId: string;
  baseDate: string; // 기준일 YYYY-MM-DD
};

/** exam_results: 시험 결과 (올해는 접수 현황만 있고 나머지는 null) */
export type ExamResult = {
  year: number;
  level: Level;
  region: string;
  subject: string | null;
  applicants: number; // 접수
  takers: number | null; // 실제 응시
  firstPassed: number | null; // 1차 합격
  firstCutoff: number | null; // 1차 합격선
  finalPassed: number | null; // 최종 합격
  sourceId: string;
  baseDate: string;
};

export type Source = { id: string; title: string; publisher: string; url: string | null };

/** v_region_summary: 지역별 한 해 요약 (증감·경쟁률·합격률 계산 포함) */
export type RegionSummary = {
  year: number;
  level: Level;
  region: string;
  subject: string | null;
  selection: number | null; // 확정 인원(없으면 사전예고)
  selectionStage: Stage | null;
  preliminary: number | null;
  confirmed: number | null;
  prevSelection: number | null; // 전년 확정
  change: number | null; // 전년 대비 증감 (명)
  changeRate: number | null; // 전년 대비 증감률 (%)
  applicants: number | null;
  takers: number | null;
  ratioApplied: number | null; // 경쟁률 (접수 기준) = 접수 / 선발
  ratioActual: number | null; // 경쟁률 (응시 기준) = 응시 / 선발
  firstCutoff: number | null;
  passRateApplied: number | null; // 합격률 (접수 기준, %) = 최종 합격 / 접수
  passRateActual: number | null; // 합격률 (응시 기준, %) = 최종 합격 / 응시
  source: Source | null;
  baseDate: string | null; // 가장 최근 기준일
};

/** exam_schedules: 일정 */
export type ScheduleEventType =
  | 'pre_notice' // 선발 인원 사전예고
  | 'plan' // 시행계획 공고
  | 'receipt_start' // 원서 접수 시작
  | 'receipt_end' // 원서 접수 마감
  | 'first_exam' // 1차 시험
  | 'first_result' // 1차 합격 발표
  | 'second_exam' // 2차 시험
  | 'final_result'; // 최종 합격 발표

export type ScheduleEvent = {
  year: number;
  level: Level;
  region: string;
  event: ScheduleEventType;
  date: string; // YYYY-MM-DD
  sourceId: string;
};

export type DataQuery = { level: Level; subject?: string | null };
