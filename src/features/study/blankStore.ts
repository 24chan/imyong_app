import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

// 빈칸 암기 기록 (2026-11-28 사용자 요청) — 이 기기 안에만 저장
// - custom: 내가 직접 고른 빈칸(낱말 번호들)
// - stats: 빈칸을 열고 맞음/틀림을 누른 기록 → 오답 회독·영역별 암기율
// 키: `${자료}|${영역}|${글 해시}` — 자료 글이 그대로면 다음에도 같은 칸으로 이어짐
const KEY = 'blank:v1';

export type Stat = { r: number; w: number; t: number; last: 'r' | 'w' };
type State = { custom: Record<string, number[]>; stats: Record<string, Stat> };

let state: State = { custom: {}, stats: {} };
let loaded = false;
const subs = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  subs.forEach((f) => f());
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, 400); // 여러 번 눌러도 한 번에 저장
}

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(KEY)
    .then((v) => {
      if (!v) return;
      const s = JSON.parse(v) as Partial<State>;
      state = { custom: s.custom ?? {}, stats: s.stats ?? {} };
      subs.forEach((f) => f());
    })
    .catch(() => {});
}

function subscribe(f: () => void) {
  load();
  subs.add(f);
  return () => subs.delete(f);
}

export function useBlankState(): State {
  return useSyncExternalStore(subscribe, () => state);
}

/** 칸 하나만 지켜봄 — 다른 칸을 눌러도 이 칸은 다시 그리지 않음(성능) */
export function useBlankItem(key: string): { custom?: number[]; stat?: Stat } {
  const custom = useSyncExternalStore(subscribe, () => state.custom[key]);
  const stat = useSyncExternalStore(subscribe, () => state.stats[key]);
  return { custom, stat };
}

export function hashText(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export const itemKey = (scope: string, group: string, text: string) => `${scope}|${group}|${hashText(text)}`;

export function toggleCustom(key: string, idx: number) {
  const cur = new Set(state.custom[key] ?? []);
  if (cur.has(idx)) cur.delete(idx);
  else cur.add(idx);
  const custom = { ...state.custom };
  if (cur.size) custom[key] = [...cur].sort((a, b) => a - b);
  else delete custom[key];
  state = { ...state, custom };
  emit();
}

export function mark(key: string, ok: boolean) {
  const p = state.stats[key] ?? { r: 0, w: 0, t: 0, last: 'r' as const };
  state = { ...state, stats: { ...state.stats, [key]: { r: p.r + (ok ? 1 : 0), w: p.w + (ok ? 0 : 1), t: Date.now(), last: ok ? 'r' : 'w' } } };
  emit();
}

export function clearScope(scope: string, what: 'custom' | 'stats') {
  const next = { ...state[what] } as Record<string, unknown>;
  Object.keys(next).forEach((k) => k.startsWith(`${scope}|`) && delete next[k]);
  state = { ...state, [what]: next } as State;
  emit();
}

/** 자료 하나(scope)의 영역별 암기율: 마지막으로 맞음을 누른 칸 / 기록이 있는 칸 */
export function scopeSummary(s: State, scope: string) {
  const groups = new Map<string, { done: number; ok: number; wrong: number }>();
  let done = 0;
  let ok = 0;
  for (const [k, v] of Object.entries(s.stats)) {
    if (!k.startsWith(`${scope}|`)) continue;
    const g = k.split('|')[1] || '기타';
    const x = groups.get(g) ?? { done: 0, ok: 0, wrong: 0 };
    x.done += 1;
    if (v.last === 'r') x.ok += 1;
    else x.wrong += 1;
    groups.set(g, x);
    done += 1;
    if (v.last === 'r') ok += 1;
  }
  return { done, ok, groups: [...groups.entries()].sort((a, b) => a[1].ok / a[1].done - b[1].ok / b[1].done) };
}
