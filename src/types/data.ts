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
  regional: number | null; // 지역 구분모집 (없거나 미공개면 null)
  total: number;
  sourceId: string;
  baseDate: string; // 기준일 YYYY-MM-DD
};

/** exam_results: 시험 결과 (올해는 접수 현황만 있고 나머지는 null) */
export type ResultCategory = 'all' | 'general' | 'disabled' | 'regional';

export type ExamResult = {
  year: number;
  level: Level;
  region: string;
  subject: string | null;
  category: ResultCategory; // 전체 / 일반 / 장애 / 지역
  selected: number | null; // 이 구분의 선발 인원
  applicants: number | null; // 접수
  takers: number | null; // 실제 응시
  firstPassed: number | null; // 1차 합격
  firstCutoff: number | null; // 1차 합격선
  finalPassed: number | null; // 최종 합격
  finalCutoff: number | null; // 최종(1+2차) 합격선
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
  general: number | null; // 선발 인원 중 일반
  disabled: number | null; // 장애
  regional: number | null; // 지역 구분모집
  prevSelection: number | null; // 전년 확정
  change: number | null; // 전년 대비 증감 (명)
  changeRate: number | null; // 전년 대비 증감률 (%)
  applicants: number | null;
  takers: number | null;
  ratioApplied: number | null; // 경쟁률 (접수 기준) = 접수 / 선발
  ratioActual: number | null; // 경쟁률 (응시 기준) = 응시 / 선발
  firstCutoff: number | null; // 1차 합격선 (일반 기준, 없으면 전체)
  firstPassed: number | null; // 1차 합격 인원
  finalPassed: number | null; // 최종 합격 인원
  finalCutoff: number | null; // 최종 합격선 (일반 기준, 없으면 전체)
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

/** 홈 '임용 소식': 수집기가 찾은 교육청 공고 */
export type NoticeType = 'prelim' | 'plan' | 'receipt' | 'attend' | 'first_pass' | 'final_pass' | 'private';
export type Notice = {
  url: string;
  region: string;
  level: 'elementary' | 'secondary';
  year: number;
  docType: NoticeType;
  title: string;
  postedAt: string | null; // YYYY-MM-DD
  files: { name: string; url: string; view?: string }[];
  images: string[]; // 첨부 PDF 앞쪽을 그린 그림 주소 (앱에서 바로 보기)
};

/** 학교 위치 (공공데이터포털 전국초중등학교위치표준데이터) */
export type SchoolKind = 'e' | 'm' | 'h'; // 초·중·고
export type SchoolFound = 'p' | 's' | 'n'; // 공립·사립·국립
export type School = { name: string; kind: SchoolKind; found: SchoolFound; lat: number; lng: number; sigungu: string };
export type SchoolMeta = { updated: string; source: string };

/** 사립학교 위탁 채용 (교육청 공고의 법인·학교·과목·인원 표) */
export type PrivateOpening = {
  corp: string;
  method: string | null; // '공·사립 동시지원' | '사립 복수지원' | 원문
  school: string;
  url: string | null; // 학교 누리집
  subject: string;
  count: number;
  level: Level;
};
export type PrivateYear = {
  year: number;
  postedAt: string | null;
  sources: { title: string; url: string | null }[];
  rows: PrivateOpening[];
};
