import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

// 1분 퀴즈 오답 노트 (기기에만 저장). 틀리면 자동으로 들어가고, 오답 다시 풀기에서 맞히면 빠짐
const KEY = 'quiz:v1';
type State = { wrong: Record<string, number>; solved: number };
let state: State = { wrong: {}, solved: 0 };
const subs = new Set<() => void>();
let loaded = false;

function emit() {
  subs.forEach((f) => f());
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(KEY)
    .then((v) => {
      if (v) {
        state = { ...state, ...JSON.parse(v) };
        subs.forEach((f) => f());
      }
    })
    .catch(() => {});
}

export function markAnswer(id: string, correct: boolean, fromWrongNote: boolean) {
  const wrong = { ...state.wrong };
  if (!correct) wrong[id] = Date.now();
  else if (fromWrongNote) delete wrong[id];
  state = { wrong, solved: state.solved + 1 };
  emit();
}

export function useQuizStore(): State {
  load();
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
}
