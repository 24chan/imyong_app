import { cached } from './repository';

// 교대 실습학교 목록 (raw-files/raw/practice/<교대>.json, practice-build 워크플로가 학사공지 표 + 학교 위치로 만듦)
export type Campus = { name: string; addr: string; lat: number; lng: number };
export type PracticeSchool = {
  name: string;
  short: string;
  region: string;
  sigungu: string;
  found: 'p' | 's' | 'n';
  lat: number;
  lng: number;
  km: Record<string, number>;
  transit_min: Record<string, number>;
};
export type PracticeSession = {
  id: string;
  year: number;
  term: number;
  kind: string;
  grade: number | null;
  period?: string;
  source: { title: string; by: string; date: string };
  schools: { id: string; block: string }[];
};
export type PracticeData = {
  univ: string;
  name: string;
  campuses: Record<string, Campus>;
  grade_campus: Record<string, string>;
  sessions: PracticeSession[];
  schools: Record<string, PracticeSchool>;
  built: string;
  notes: string[];
};

/** 실습학교 목록이 있는 교대 (늘어나면 여기에 추가) */
export const PRACTICE_UNIVS = [{ code: 'ginue', name: '경인교대', univCodes: ['ginue'] }] as const;

const BASE = 'https://raw.githubusercontent.com/24chan/imyong_app/raw-files/raw/practice';

export async function getPractice(univ: string): Promise<PracticeData | null> {
  return cached(`practice:${univ}`, async () => {
    const res = await fetch(`${BASE}/${univ}.json`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`실습학교 목록을 못 받았어요 (HTTP ${res.status})`);
    return (await res.json()) as PracticeData;
  });
}

/** 실습 이름: '2학년 · 1학기 참관실습' — 학년을 모르면 실습 이름만 */
export const sessionLabel = (s: PracticeSession, withYear = false) =>
  `${withYear ? `${s.year} ` : ''}${s.grade ? `${s.grade}학년 · ` : ''}${s.term}학기 ${s.kind}`;
