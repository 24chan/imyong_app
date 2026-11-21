import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { TeacherJob } from '../data/jobs';

// 저장(찜)한 학교별 채용 공고 — 기기에만 저장 (관심 지역과 같은 방식, 로그인 필요 없음)
// 공고가 목록에서 빠져도 보이도록 공고 내용을 같이 저장해요.

const KEY = 'savedJobs.v1';
let saved: TeacherJob[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) {
        saved = JSON.parse(raw);
        emit();
      }
    })
    .catch(() => {});
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => {});
}

export function toggleSavedJob(job: TeacherJob) {
  saved = saved.some((j) => j.url === job.url) ? saved.filter((j) => j.url !== job.url) : [...saved, job];
  persist();
  emit();
}

/** 마감 지난 저장 공고 한꺼번에 지우기 */
export function removeClosedJobs(today: string) {
  saved = saved.filter((j) => !j.deadline || j.deadline >= today);
  persist();
  emit();
}

export function useSavedJobs(): TeacherJob[] {
  load();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => saved,
  );
}

/** 마감 가까운 순: 모집 중(마감일 빠른 순) → 마감일 없는 모집 중(최신순) → 마감 지난 것(최근 마감 순) */
export function byDeadline(today: string) {
  const rank = (j: TeacherJob) => (j.deadline ? (j.deadline >= today ? 0 : 2) : 1);
  return (a: TeacherJob, b: TeacherJob) => {
    const r = rank(a) - rank(b);
    if (r) return r;
    if (rank(a) === 0) return a.deadline! < b.deadline! ? -1 : a.deadline! > b.deadline! ? 1 : 0;
    if (rank(a) === 2) return a.deadline! < b.deadline! ? 1 : -1;
    return a.posted < b.posted ? 1 : a.posted > b.posted ? -1 : 0;
  };
}
