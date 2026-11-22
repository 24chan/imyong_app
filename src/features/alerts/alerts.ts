import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';
import type { TeacherJob } from '../../data/jobs';
import { EVENT_LABEL } from '../../data/receiptStatus';
import { regionByCode } from '../../data/regions';
import { getSchedules } from '../../data/repository';
import type { Level } from '../../store/AppSettings';
import Constants from 'expo-constants';
import { supabase } from '../../lib/supabase';

// 알림 1단계 (2026-11-22 승인): 기기 안에서만 예약하는 알림. 서버에 아무것도 보내지 않음.
// - 저장한 채용 공고 마감 3일 전·1일 전
// - 관심 지역 원서 접수 시작일, 마감 3일 전
// - 일정 탭에서 '알림 받기' 누른 일정: 하루 전
// 예약 시각은 모두 오전 9시(방해 금지 시간 밖). iOS 예약 한도(64개)를 넘지 않게 가까운 것 60개만.

// 설치된 앱(옛 APK)에 알림 모듈이 없을 수 있어 조심스럽게 불러옴 → 없으면 알림 기능만 꺼짐
type N = typeof import('expo-notifications');
let mod: N | null | undefined;
function notif(): N | null {
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-notifications') as N;
    mod.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
  } catch {
    mod = null;
  }
  return mod;
}
export const alertsAvailable = () => notif() !== null;

// ───── 설정 (기기에만) ─────
export type AlertPrefs = { enabled: boolean; jobs: boolean; receipt: boolean; schedule: boolean; news: boolean };
const PREF_KEY = 'alerts.prefs.v1';
const SAVED_KEY = 'alerts.savedSchedule.v1';
const DEFAULT: AlertPrefs = { enabled: false, jobs: true, receipt: true, schedule: true, news: true };
export type SavedSchedule = { key: string; date: string; title: string; sub?: string };

let prefs: AlertPrefs = DEFAULT;
let savedSchedule: SavedSchedule[] = [];
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load() {
  loaded ??= Promise.all([AsyncStorage.getItem(PREF_KEY), AsyncStorage.getItem(SAVED_KEY)])
    .then(([p, s]) => {
      if (p) prefs = { ...DEFAULT, ...JSON.parse(p) };
      if (s) savedSchedule = JSON.parse(s);
      emit();
    })
    .catch(() => {});
  return loaded;
}

const sub = (l: () => void) => {
  load();
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const useAlertPrefs = () => useSyncExternalStore(sub, () => prefs);
export const useSavedSchedule = () => useSyncExternalStore(sub, () => savedSchedule);

/** 알림 켜기: 권한을 물어보고, 거절하면 false */
export async function enableAlerts(): Promise<boolean> {
  const n = notif();
  if (!n) return false;
  let st = await n.getPermissionsAsync();
  if (!st.granted) st = await n.requestPermissionsAsync();
  if (!st.granted) return false;
  if (Platform.OS === 'android') {
    await n.setNotificationChannelAsync('default', { name: '임용 알림', importance: n.AndroidImportance.DEFAULT });
  }
  await setAlertPrefs({ enabled: true });
  return true;
}

export async function setAlertPrefs(p: Partial<AlertPrefs>) {
  await load();
  prefs = { ...prefs, ...p };
  emit();
  await AsyncStorage.setItem(PREF_KEY, JSON.stringify(prefs)).catch(() => {});
}

export async function toggleSavedSchedule(item: SavedSchedule) {
  await load();
  savedSchedule = savedSchedule.some((x) => x.key === item.key) ? savedSchedule.filter((x) => x.key !== item.key) : [...savedSchedule, item];
  emit();
  await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(savedSchedule)).catch(() => {});
}

// ───── 예약 ─────
type Plan = { at: Date; title: string; body: string };
const at9 = (iso: string, daysBefore: number) => {
  const d = new Date(`${iso}T09:00:00`);
  d.setDate(d.getDate() - daysBefore);
  return d;
};
const short = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8))}일`;

/** 학년도: 3월부터는 다음 학년도 시험 준비 */
const examYear = (now: Date) => (now.getMonth() >= 2 ? now.getFullYear() + 1 : now.getFullYear());

export async function planAlerts(o: { level: Level; regions: string[]; jobs: TeacherJob[] }): Promise<Plan[]> {
  await load();
  const now = new Date();
  const out: Plan[] = [];
  if (prefs.jobs) {
    for (const j of o.jobs) {
      if (!j.deadline) continue;
      out.push({ at: at9(j.deadline, 3), title: '저장한 채용 공고 마감 3일 전', body: `${j.org} · ${short(j.deadline)} 마감` });
      out.push({ at: at9(j.deadline, 1), title: '저장한 채용 공고 내일 마감', body: `${j.org} · ${j.title}` });
    }
  }
  if (prefs.receipt && o.regions.length) {
    const y = examYear(now);
    const list = (await Promise.all([y, y + 1].map((yy) => getSchedules(o.level, yy).catch(() => [])))).flat();
    for (const e of list) {
      if (!o.regions.includes(e.region)) continue;
      const name = regionByCode(e.region)?.shortName ?? e.region;
      if (e.event === 'receipt_start') out.push({ at: at9(e.date, 0), title: `${name} 원서 접수 시작`, body: `오늘부터 ${e.year}학년도 원서 접수예요` });
      if (e.event === 'receipt_end') out.push({ at: at9(e.date, 3), title: `${name} 원서 접수 마감 3일 전`, body: `${short(e.date)} 마감 · ${EVENT_LABEL[e.event]}` });
    }
  }
  if (prefs.schedule) {
    for (const s of savedSchedule) out.push({ at: at9(s.date, 1), title: `내일: ${s.title}`, body: [s.sub, short(s.date)].filter(Boolean).join(' · ') });
  }
  return out.filter((p) => p.at.getTime() > now.getTime() + 60_000).sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 60);
}

/** 예약을 모두 지우고 다시 잡기 (앱을 열 때·설정을 바꿀 때) */
export async function rescheduleAlerts(o: { level: Level; regions: string[]; jobs: TeacherJob[] }) {
  const n = notif();
  if (!n) return 0;
  await load();
  await n.cancelAllScheduledNotificationsAsync();
  if (!prefs.enabled) return 0;
  const st = await n.getPermissionsAsync();
  if (!st.granted) return 0;
  const plans = await planAlerts(o);
  for (const p of plans) {
    await n.scheduleNotificationAsync({
      content: { title: p.title, body: p.body },
      trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: p.at, channelId: 'default' },
    });
  }
  return plans.length;
}

// ───── 알림 2단계: 새 공고 푸시 (익명 구독: 토큰 + 시험 구분 + 관심 지역만, 계정과 연결 안 함) ─────
const TOKEN_KEY = 'alerts.pushToken.v1';
let lastSync = '';

/** 켜져 있으면 등록(또는 지역 갱신), 꺼져 있으면 서버 목록에서 지움. 안드로이드 Expo Go 에서는 조용히 건너뜀 */
export async function syncPush(level: Level, regions: string[]) {
  const n = notif();
  if (!n) return;
  await load();
  const want = prefs.enabled && prefs.news && regions.length > 0;
  const saved = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (!want) {
    if (saved) {
      await supabase.rpc('delete_push_sub', { p_token: saved });
      await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
    }
    lastSync = '';
    return;
  }
  const st = await n.getPermissionsAsync();
  if (!st.granted) return;
  const key = `${level}|${[...regions].sort().join(',')}`;
  if (key === lastSync && saved) return;
  try {
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    const { data: token } = await n.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('upsert_push_sub', { p_token: token, p_level: level, p_regions: regions });
    if (error) return;
    if (saved && saved !== token) await supabase.rpc('delete_push_sub', { p_token: saved });
    await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
    lastSync = key;
  } catch {
    // Expo Go(안드로이드)·에뮬레이터 등 푸시를 못 받는 환경
  }
}

/** 알림을 누르면 해당 화면으로 (data.url) */
export function onAlertTap(go: (url: string) => void) {
  const n = notif();
  if (!n) return () => {};
  const sub = n.addNotificationResponseReceivedListener((r) => {
    const url = r.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) go(url);
  });
  return () => sub.remove();
}
