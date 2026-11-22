import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

// B-8 새 소식 표시: 본 공고 주소를 기기에만 기억 (서버로 보내지 않음).
// 처음 쓰는 날에는 지금 있는 공고를 모두 '본 것'으로 쳐서 숫자가 갑자기 크게 뜨지 않게 함.
const KEY = 'seenNews.v1';
type State = { ready: boolean; init: boolean; urls: Set<string> };
let st: State = { ready: false, init: false, urls: new Set() };
let loading = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load() {
  if (loading) return;
  loading = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      const v = raw ? (JSON.parse(raw) as { init: boolean; urls: string[] }) : null;
      st = { ready: true, init: !!v?.init, urls: new Set(v?.urls ?? []) };
      emit();
    })
    .catch(() => {
      st = { ...st, ready: true };
      emit();
    });
}

function save() {
  // 최근 600개만 기억
  const urls = [...st.urls].slice(-600);
  AsyncStorage.setItem(KEY, JSON.stringify({ init: st.init, urls })).catch(() => {});
}

/** 지금 보이는 공고들을 '본 것'으로 */
export function markNewsSeen(urls: string[]) {
  if (!st.ready || !urls.length) return;
  const next = new Set(st.urls);
  let changed = !st.init;
  urls.forEach((u) => {
    if (!next.has(u)) {
      next.add(u);
      changed = true;
    }
  });
  if (!changed) return;
  st = { ready: true, init: true, urls: next };
  save();
  emit();
}

export function useSeenNews() {
  load();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => st,
  );
}

/** 안 본 공고 주소들 (처음 쓰는 날은 모두 본 것으로 처리) */
export function unseenOf(s: State, urls: string[]): string[] {
  if (!s.ready) return [];
  if (!s.init) return []; // 첫날: 화면에서 markNewsSeen 으로 초기화
  return urls.filter((u) => !s.urls.has(u));
}
