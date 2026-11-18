import type { ScheduleEvent, ScheduleEventType } from '../types/data';

// 원서 접수 상태 계산 (일정 + 오늘 날짜)

export type ReceiptStatus = 'before_notice' | 'upcoming' | 'open' | 'closed';

export const RECEIPT_STATUS_LABEL: Record<ReceiptStatus, string> = {
  before_notice: '공고 전',
  upcoming: '접수 예정',
  open: '접수 중',
  closed: '접수 마감',
};

export const EVENT_LABEL: Record<ScheduleEventType, string> = {
  pre_notice: '선발 인원 사전예고',
  plan: '시행계획 공고',
  receipt_start: '원서 접수 시작',
  receipt_end: '원서 접수 마감',
  first_exam: '1차 시험',
  first_result: '1차 합격 발표',
  second_exam: '2차 시험',
  final_result: '최종 합격 발표',
};

const DAY = 24 * 60 * 60 * 1000;
const toTime = (iso: string) => new Date(`${iso}T00:00:00`).getTime();

/** 오늘(로컬) 날짜를 YYYY-MM-DD로 */
export function todayIso(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** D-day 숫자 (오늘이면 0, 지났으면 음수) */
export const daysUntil = (iso: string, today: string) => Math.round((toTime(iso) - toTime(today)) / DAY);

export const dDayLabel = (iso: string, today: string) => {
  const d = daysUntil(iso, today);
  return d === 0 ? 'D-DAY' : d > 0 ? `D-${d}` : `D+${-d}`;
};

/** 'M/D' 짧은 날짜 */
export const shortDate = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
};

export type ReceiptInfo = {
  status: ReceiptStatus;
  receiptStart: string | null;
  receiptEnd: string | null;
  /** 상태 옆에 붙일 한 줄 설명 */
  detail: string;
  /** 다음 일정 (없으면 null) */
  next: ScheduleEvent | null;
};

/** 한 지역의 일정 목록으로 접수 상태 계산 */
export function getReceiptInfo(events: ScheduleEvent[], today: string): ReceiptInfo | null {
  if (events.length === 0) return null;
  const at = (e: ScheduleEventType) => events.find((x) => x.event === e)?.date ?? null;
  const plan = at('plan');
  const start = at('receipt_start');
  const end = at('receipt_end');
  const next = events.find((e) => e.date >= today) ?? null;

  let status: ReceiptStatus = 'closed';
  let detail = '';
  if (plan && today < plan) {
    status = 'before_notice';
    detail = `시행계획 공고 예정 ${shortDate(plan)}`;
  } else if (start && today < start) {
    status = 'upcoming';
    detail = `${shortDate(start)} 접수 시작 (${dDayLabel(start, today)})`;
  } else if (start && end && today <= end) {
    status = 'open';
    detail = `${shortDate(end)} 마감 (${dDayLabel(end, today)})`;
  } else {
    status = 'closed';
    detail = next ? `다음: ${EVENT_LABEL[next.event]} ${shortDate(next.date)} (${dDayLabel(next.date, today)})` : '올해 일정이 모두 끝났어요';
  }
  return { status, receiptStart: start, receiptEnd: end, detail, next };
}
