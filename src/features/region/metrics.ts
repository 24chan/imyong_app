import type { RegionSummary } from '../../types/data';

// 지도 상단 탭: 선발 인원 / 경쟁률 / 합격선
export type MapMetric = 'selection' | 'ratio' | 'cutoff';

export const METRIC_OPTIONS: { value: MapMetric; label: string }[] = [
  { value: 'selection', label: '선발 인원' },
  { value: 'ratio', label: '경쟁률' },
  { value: 'cutoff', label: '합격선' },
];

export const metricValue = (r: RegionSummary, m: MapMetric) =>
  m === 'selection' ? r.selection : m === 'ratio' ? r.ratioApplied : r.firstCutoff;

export const formatMetric = (v: number | null, m: MapMetric) => {
  if (v == null) return '—';
  if (m === 'selection') return v.toLocaleString();
  if (m === 'ratio') return v.toFixed(2);
  return v.toFixed(1);
};

/**
 * 지도 색칠 규칙
 * - 선발 인원: 전년 대비 증감률로 색 (증가 up / 감소 down, 정도에 따라 진하기)
 * - 경쟁률·합격선: 값이 클수록 진한 brand 한 가지 색 (4단계, 사분위)
 */
export type Fill = { tone: 'up' | 'down' | 'brand' | 'neutral' | 'none'; level: 0 | 1 | 2 | 3 };

export const OPACITY = [0, 0.35, 0.6, 0.9] as const;

export const CHANGE_STEPS = [3, 10, 20]; // 증감률 % 경계

export function changeFill(rate: number | null): Fill {
  if (rate == null) return { tone: 'none', level: 0 };
  const a = Math.abs(rate);
  if (a < CHANGE_STEPS[0]) return { tone: 'neutral', level: 0 };
  const level = a < CHANGE_STEPS[1] ? 1 : a < CHANGE_STEPS[2] ? 2 : 3;
  return { tone: rate > 0 ? 'up' : 'down', level };
}

/** 사분위 경계 (값 3개) */
export function quartiles(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return s.length ? [q(0.25), q(0.5), q(0.75)] : [];
}

export function valueFill(v: number | null, qs: number[]): Fill {
  if (v == null || qs.length < 3) return { tone: 'none', level: 0 };
  if (v < qs[0]) return { tone: 'brand', level: 0 };
  return { tone: 'brand', level: v < qs[1] ? 1 : v < qs[2] ? 2 : 3 };
}

export function fillFor(r: RegionSummary, m: MapMetric, qs: number[]): Fill {
  return m === 'selection' ? changeFill(r.changeRate) : valueFill(metricValue(r, m), qs);
}
