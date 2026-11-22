// 옛 설치 파일에는 웹뷰 모듈이 없을 수 있어 조심스럽게 불러옴 → 없으면 null (화면은 '열기' 버튼만)
type WV = typeof import('react-native-webview');
let wv: WV | null | undefined;
export function webview(): WV | null {
  if (wv !== undefined) return wv;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    wv = require('react-native-webview') as WV;
  } catch {
    wv = null;
  }
  return wv;
}

/** 앱 안 보기에서 열어도 되는 공식 사이트 (그 밖은 바깥 브라우저로) */
export const OFFICIAL_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(go\.kr|re\.kr|or\.kr|kice\.re\.kr|textbook114\.com|google\.com)(\/|$)/;
