import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { consentRecord, hasConsented } from '../legal/info';
import { supabase } from '../lib/supabase';
import { useAppSettings } from './AppSettings';

// 로그인 상태. 로그인하지 않아도 데이터는 모두 볼 수 있고, 글쓰기·댓글만 로그인(+인증) 후에 허용합니다.

type AuthValue = {
  ready: boolean; // 저장된 로그인 정보를 다 불러왔는지
  session: Session | null;
  email: string | null;
  isAdmin: boolean;
  /** 승인된 학교 인증의 대학 코드 (예: 'ginue'). 경인교대 전용 메뉴 노출에 씀 (lib/access.ts) */
  univCodes: string[];
  /** 인증이 승인된 뒤 다시 불러오기 */
  refreshAccess: () => void;
  /** agreed: 로그인 화면에서 약관에 동의했는지 (처음 가입이면 동의 기록이 계정에 같이 남음) */
  sendCode: (email: string, agreed: boolean) => Promise<void>;
  /** 구글·카카오로 시작 (2026-11-22 사용자 요청). 취소하면 false */
  signInWithProvider: (provider: 'google' | 'kakao', agreed: boolean) => Promise<boolean>;
  verifyCode: (email: string, code: string) => Promise<void>;
  agreeTerms: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

/** 마지막 소셜 로그인에서 앱이 돌아오길 기다린 주소(문제 생기면 화면에 보여 줘서 진단) */
let lastRedirect = '';
/** 로그인 정보를 꺼낼 때만 쓰는 무작위 번호(32바이트 → 64자). 암호학적 난수 사용
 *  expo-crypto 는 새로 설치한 앱(다음 APK)부터 들어 있어서, 예전 앱에서는 기기 내장 crypto → 마지막 수단 Math.random 순서로 씀 */
function makeNonce(): string {
  const hex = (b: ArrayLike<number>) => Array.from(b, (x) => (x & 255).toString(16).padStart(2, '0')).join('');
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const C = require('expo-crypto') as typeof import('expo-crypto');
    return hex(C.getRandomBytes(32));
  } catch {
    /* 예전 앱: 모듈 없음 */
  }
  const g = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (g?.getRandomValues) return hex(g.getRandomValues(new Uint8Array(32)));
  let out = '';
  while (out.length < 64) out += Math.random().toString(16).slice(2);
  return out.slice(0, 64);
}
const AUTH_BOUNCE = 'https://24chan.github.io/imyong_app/auth.html';
export const getLastRedirect = () => lastRedirect;

/** 로그인 후 돌아온 주소(#access_token=…)에서 세션 꺼내기. 처리했으면 true */
async function applyAuthUrl(url: string): Promise<boolean> {
  if (!url.includes('auth-callback')) return false;
  const frag = url.split('#')[1] ?? url.split('?')[1] ?? '';
  const q = new URLSearchParams(frag);
  const err = q.get('error_description') || q.get('error');
  if (err) throw new Error(decodeURIComponent(err));
  const access_token = q.get('access_token');
  const refresh_token = q.get('refresh_token');
  if (!access_token || !refresh_token) return false;
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return true;
}

/** Supabase 오류 → 쉬운 한국어 */
export function authErrorText(e: unknown): string {
  const m = (e as { message?: string; status?: number })?.message ?? String(e);
  const status = (e as { status?: number })?.status;
  if (status === 429 || /rate limit|security purposes|too many/i.test(m)) return '메일을 너무 자주 보냈어요. 1~2분 뒤에 다시 해 주세요.';
  if (/expired|invalid|token/i.test(m)) return '코드가 맞지 않거나 시간이 지났어요. 메일의 숫자를 다시 확인해 주세요.';
  if (/email.*(invalid|valid)|invalid.*email/i.test(m)) return '이메일 주소 형식을 확인해 주세요.';
  if (/network|fetch/i.test(m)) return '인터넷 연결을 확인해 주세요.';
  if (/delete_my_account|function/i.test(m)) return '서버 준비가 덜 됐어요 (0009 SQL 실행 필요).';
  return m;
}

/** 본인 폴더(내 id)에 있는 사진 지우기. 실패해도 계정 삭제는 계속 */
async function removeMyFiles(uid: string) {
  for (const bucket of ['verify-docs', 'enroll-docs', 'pass-docs']) {
    try {
      const { data } = await supabase.storage.from(bucket).list(uid, { limit: 1000 });
      const paths = (data ?? []).map((f) => `${uid}/${f.name}`);
      if (paths.length) await supabase.storage.from(bucket).remove(paths);
    } catch {
      /* 사진이 없거나 버킷이 없어도 넘어감 */
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { settings } = useAppSettings();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [univCodes, setUnivCodes] = useState<string[]>([]);
  const [accessTick, setAccessTick] = useState(0);
  const refreshAccess = useCallback(() => setAccessTick((t) => t + 1), []);

  // 브라우저가 앱을 직접 열어 준 경우(Expo Go 등)에도 로그인 처리
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      applyAuthUrl(url).catch(() => {});
    });
    Linking.getInitialURL().then((u) => { if (u) applyAuthUrl(u).catch(() => {}); });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    // 앱이 화면에 있을 때만 로그인 토큰 자동 갱신 (Supabase 권장)
    const appSub = AppState.addEventListener('change', (st) => {
      if (st === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => {
      sub.subscription.unsubscribe();
      appSub.remove();
    };
  }, []);

  const uid = session?.user.id ?? null;

  // 로그인하면 이 기기의 초등/중등·과목 설정을 서버 프로필에도 저장 (커뮤니티 기본 게시판 등에 사용)
  useEffect(() => {
    if (!uid || !settings.level) return;
    if (settings.level === 'secondary' && !settings.subjectCode) return;
    supabase
      .from('profiles')
      .upsert({
        id: uid,
        level: settings.level,
        subject_code: settings.level === 'secondary' ? settings.subjectCode : null,
        updated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.log('프로필 저장 실패', error.message);
      });
  }, [uid, settings.level, settings.subjectCode]);

  useEffect(() => {
    if (!uid) {
      setIsAdmin(false);
      return;
    }
    supabase.rpc('is_admin').then(({ data, error }) => setIsAdmin(!error && data === true));
  }, [uid]);

  // 승인된 학교 인증 → 대학 코드 (2026-11-28: 경인교대 전용 메뉴). 앱이 다시 앞으로 올 때도 확인
  useEffect(() => {
    if (!uid) {
      setUnivCodes([]);
      return;
    }
    let off = false;
    const load = () =>
      supabase
        .from('verifications')
        .select('univ_code')
        .eq('user_id', uid)
        .eq('kind', 'school')
        .eq('status', 'approved')
        .then(({ data, error }) => {
          if (off || error) return;
          const next = [...new Set((data ?? []).map((r: { univ_code: string | null }) => r.univ_code).filter((c): c is string => !!c))].sort();
          setUnivCodes((prev) => (prev.join() === next.join() ? prev : next));
        });
    load();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && load());
    return () => {
      off = true;
      sub.remove();
    };
  }, [uid, accessTick]);

  const agreedAtLogin = useRef(false);

  const sendCode = useCallback(async (email: string, agreed: boolean) => {
    agreedAtLogin.current = agreed;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      // data는 처음 가입할 때만 계정 정보(user_metadata)에 저장됨
      options: { shouldCreateUser: true, data: agreed ? consentRecord() : undefined },
    });
    if (error) throw error;
  }, []);

  // 소셜 로그인: Supabase가 만든 로그인 주소를 앱 안 브라우저로 열고, 돌아온 주소의 토큰으로 로그인
  const signInWithProvider = useCallback(async (provider: 'google' | 'kakao', agreed: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WebBrowser = require('expo-web-browser') as typeof import('expo-web-browser');
    // 앱으로 돌아올 주소. 브라우저가 앱 주소로 바로 못 넘기는 기기가 있어 웹 페이지(auth.html)를 한 번 거침
    const appReturn = Linking.createURL('auth-callback');
    // 브라우저가 앱을 못 여는 기기용: 이 번호로 돌아오기 페이지가 맡긴 로그인 정보를 꺼내 옴
    const nonce = makeNonce();
    const redirectTo = `${AUTH_BOUNCE}?v=5&to=${encodeURIComponent(appReturn)}&n=${nonce}`; // v: 페이지 캐시 피하기
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        // 카카오는 비즈 앱이 아니면 이메일을 못 받음 → 닉네임·사진만 요청
        ...(provider === 'kakao' ? { scopes: 'profile_nickname profile_image' } : {}),
      },
    });
    if (error) throw error;
    lastRedirect = appReturn;
    let relayed = false;
    const take = async () => {
      if (relayed) return true;
      const { data: payload } = await supabase.rpc('take_auth_relay', { p_nonce: nonce });
      if (typeof payload === 'string' && payload) {
        relayed = await applyAuthUrl(`auth-callback#${payload}`);
        if (relayed) {
          // 안드로이드에서 못 닫으면 사용자가 X
          Promise.resolve()
            .then(() => WebBrowser.dismissBrowser())
            .catch(() => {});
        }
      }
      return relayed;
    };
    const timer = setInterval(() => {
      take().catch(() => {});
    }, 1500);
    let res: Awaited<ReturnType<typeof WebBrowser.openAuthSessionAsync>>;
    try {
      res = await WebBrowser.openAuthSessionAsync(data.url, appReturn);
    } finally {
      clearInterval(timer);
    }
    if (res.type === 'success' && (await applyAuthUrl(res.url))) {
      // 앱으로 바로 돌아온 경우
    } else if (!(await take().catch(() => false))) {
      // 브라우저가 앱을 열어 줬거나(위 주소 받기), 전달함에도 없으면 실패
      await new Promise((r) => setTimeout(r, 800));
      if (!(await supabase.auth.getSession()).data.session) return false;
    }
    const s2 = { user: (await supabase.auth.getUser()).data.user };
    if (agreed && !hasConsented(s2.user?.user_metadata)) await supabase.auth.updateUser({ data: consentRecord() }).catch(() => {});
    return true;
  }, []);

  const agreeTerms = useCallback(async () => {
    const { error } = await supabase.auth.updateUser({ data: consentRecord() });
    if (error) throw error;
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    if (error) throw error;
    // 이미 가입했던 사람이 로그인 화면에서 동의했으면 기록을 지금 버전으로 갱신
    if (agreedAtLogin.current && !hasConsented(data.user?.user_metadata)) {
      await supabase.auth.updateUser({ data: consentRecord() }).catch(() => {});
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const deleteAccount = useCallback(async () => {
    // 아직 검수 전인 인증 사진도 함께 지우기 (계정만 지우면 사진 파일은 남음)
    const id = (await supabase.auth.getSession()).data.session?.user.id;
    if (id) await removeMyFiles(id);
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ ready, session, email: session?.user.email ?? null, isAdmin, univCodes, refreshAccess, sendCode, signInWithProvider, verifyCode, agreeTerms, signOut, deleteAccount }),
    [ready, session, isAdmin, univCodes, refreshAccess, sendCode, signInWithProvider, verifyCode, agreeTerms, signOut, deleteAccount],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error('AuthProvider 안에서만 사용');
  return v;
}
