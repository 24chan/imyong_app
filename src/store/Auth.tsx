import type { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAppSettings } from './AppSettings';

// 로그인 상태. 로그인하지 않아도 데이터는 모두 볼 수 있고, 글쓰기·댓글만 로그인(+인증) 후에 허용합니다.

type AuthValue = {
  ready: boolean; // 저장된 로그인 정보를 다 불러왔는지
  session: Session | null;
  email: string | null;
  isAdmin: boolean;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

/** Supabase 오류 → 쉬운 한국어 */
export function authErrorText(e: unknown): string {
  const m = (e as { message?: string; status?: number })?.message ?? String(e);
  const status = (e as { status?: number })?.status;
  if (status === 429 || /rate limit|security purposes|too many/i.test(m)) return '메일을 너무 자주 보냈어요. 1~2분 뒤에 다시 해 주세요.';
  if (/expired|invalid|token/i.test(m)) return '코드가 맞지 않거나 시간이 지났어요. 메일의 6자리 숫자를 다시 확인해 주세요.';
  if (/email.*(invalid|valid)|invalid.*email/i.test(m)) return '이메일 주소 형식을 확인해 주세요.';
  if (/network|fetch/i.test(m)) return '인터넷 연결을 확인해 주세요.';
  if (/delete_my_account|function/i.test(m)) return '서버 준비가 덜 됐어요 (0009 SQL 실행 필요).';
  return m;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { settings } = useAppSettings();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

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

  const sendCode = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    if (error) throw error;
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const deleteAccount = useCallback(async () => {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ ready, session, email: session?.user.email ?? null, isAdmin, sendCode, verifyCode, signOut, deleteAccount }),
    [ready, session, isAdmin, sendCode, verifyCode, signOut, deleteAccount],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error('AuthProvider 안에서만 사용');
  return v;
}
