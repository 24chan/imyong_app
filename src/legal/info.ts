// 약관·개인정보처리방침에 들어가는 운영자 정보.
// 빈칸('')은 화면에 "(정하는 중)"으로 보여요. 출시 전에 꼭 채우기.

export const LEGAL = {
  appName: '임용몽땅',
  /** 운영자 이름 (개인정보 보호책임자). 사업자 등록을 하면 상호·대표자로 바꾸기 */
  operator: '',
  /** 문의·개인정보 요청을 받을 메일 */
  contactEmail: '',
  /** Supabase 서버 지역 — 대시보드 Project Settings → General → Region 에서 확인 (예: 대한민국 서울) */
  serverRegion: '',
  /** 시행일 (예: 2027-01-15). 출시 날짜로 */
  effectiveDate: '',
  /**
   * 약관·처리방침 버전. 내용을 크게 바꾸면 1 올리기 →
   * 로그인한 사람에게 다시 동의 화면이 떠요.
   */
  version: 2, // 2026-11-22 닉네임·알림 추가로 다시 동의
};

export function fill(value: string, what: string): string {
  return value.trim() ? value : `(${what} 정하는 중)`;
}

/** 가입 때 서버(로그인 정보)에 같이 남기는 동의 기록 */
export function consentRecord() {
  return { terms_version: LEGAL.version, terms_agreed_at: new Date().toISOString() };
}

export function hasConsented(meta: Record<string, unknown> | undefined | null): boolean {
  return Number(meta?.terms_version ?? 0) >= LEGAL.version;
}
