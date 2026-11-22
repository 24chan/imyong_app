import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

// 스크랩한 초등학교 — 기기에만 저장 (서버로 안 보냄, 로그인 필요 없음)
export type ScrapSchool = { region: string; name: string; sigungu: string; lat: number; lng: number; found: 'p' | 's' | 'n'; at: string };

const KEY = 'schoolScraps.v1';
let saved: ScrapSchool[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const keyOf = (s: { region: string; name: string }) => `${s.region}|${s.name}`;

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

export function toggleScrap(s: Omit<ScrapSchool, 'at'>) {
  const k = keyOf(s);
  saved = saved.some((x) => keyOf(x) === k) ? saved.filter((x) => keyOf(x) !== k) : [{ ...s, at: new Date().toISOString() }, ...saved];
  AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => {});
  emit();
}

export function useScraps(): ScrapSchool[] {
  load();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => saved,
  );
}

export function useIsScrapped(s: { region: string; name: string } | null): boolean {
  const list = useScraps();
  return !!s && list.some((x) => keyOf(x) === keyOf(s));
}
