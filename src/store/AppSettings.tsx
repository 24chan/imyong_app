import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// 기기에만 저장되는 사용자 설정 (MVP: 로그인 없음)
export type Level = 'elementary' | 'secondary';
export type ThemePref = 'system' | 'light' | 'dark';
export type RegionView = 'map' | 'list' | 'grid';

export type Settings = {
  onboarded: boolean;
  level: Level | null; // 저장된 모드 (가입 시 선택)
  subjectCode: string | null; // 중등이면 필수
  regionCodes: string[]; // 관심 지역 (화면에 공개되지 않음)
  themePref: ThemePref;
  /** 지역·TO 보기 방식: 지도 / 목록(한 줄) / 격자(2열) */
  regionView: RegionView;
  /** 지역 비교에 담은 지역 (최대 3개) */
  compareRegions: string[];
  /** 개발용: 접수 상태를 다른 날짜로 확인해 볼 때 (출시 전 제거) */
  devDate: string | null;
};

const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  level: null,
  subjectCode: null,
  regionCodes: [],
  themePref: 'system',
  devDate: null,
  regionView: 'map',
  compareRegions: [],
};

const STORAGE_KEY = 'app-settings-v1';

type Ctx = {
  hydrated: boolean;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  /** 상단 토글로 '잠깐 보기' 중인 모드. 저장된 모드는 바뀌지 않음 */
  viewLevel: Level;
  setViewLevel: (level: Level) => void;
  /** 데이터 새로고침 때 1씩 늘어남 (useAsync가 다시 불러옴) */
  dataVersion: number;
  bumpDataVersion: () => void;
};

const AppSettingsContext = createContext<Ctx | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [viewLevel, setViewLevel] = useState<Level>('elementary');
  const [dataVersion, setDataVersion] = useState(0);
  const bumpDataVersion = useCallback(() => setDataVersion((v) => v + 1), []);

  // 앱 시작 시 저장된 설정 불러오기
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  // 저장된 모드가 바뀌면 '잠깐 보기'도 그 모드로 되돌림
  useEffect(() => {
    if (settings.level) setViewLevel(settings.level);
  }, [settings.level]);

  const persist = (next: Settings) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    persist(DEFAULT_SETTINGS);
  }, []);

  const value = useMemo(
    () => ({ hydrated, settings, update, reset, viewLevel, setViewLevel, dataVersion, bumpDataVersion }),
    [hydrated, settings, update, reset, viewLevel, dataVersion, bumpDataVersion],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings는 AppSettingsProvider 안에서만 사용할 수 있어요');
  return ctx;
}

export const levelLabel = (level: Level) => (level === 'elementary' ? '초등' : '중등');

/** 오늘 날짜 (개발용 날짜가 있으면 그 값) */
export function useToday() {
  // 개발용 테스트 날짜는 없앰 (2026-11-22): 항상 실제 오늘
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export const MAX_COMPARE = 3;

/** 지역 비교 담기/빼기. 이미 3개면 false */
export function useCompare() {
  const { settings, update } = useAppSettings();
  const list = settings.compareRegions;
  const has = (code: string) => list.includes(code);
  const toggle = (code: string) => {
    if (has(code)) {
      update({ compareRegions: list.filter((c) => c !== code) });
      return true;
    }
    if (list.length >= MAX_COMPARE) return false;
    update({ compareRegions: [...list, code] });
    return true;
  };
  return { list, has, toggle, set: (codes: string[]) => update({ compareRegions: codes }) };
}
