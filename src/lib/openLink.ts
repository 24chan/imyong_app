import { router } from 'expo-router';
import { Linking } from 'react-native';
import { OFFICIAL_HOSTS } from './webview';

/** 링크 열기 (2026-11-22 사용자 요청: 웬만하면 앱 안에서)
 * - 공식 사이트의 PDF → 앱 안 PDF 미리보기
 * - 공식 사이트(go.kr·re.kr 등) 페이지 → 앱 안 보기
 * - 그 밖(학원·광고·한글 파일 등) → 바깥 브라우저 */
export function openLink(url: string | null | undefined, title?: string) {
  if (!url) return;
  const official = OFFICIAL_HOSTS.test(url);
  if (official && (/\.pdf($|\?)/i.test(url) || /fileDown\.do/i.test(url))) {
    router.push({ pathname: '/pdf', params: { url, title: title ?? 'PDF' } });
  } else if (official && !/\.(hwp|hwpx|xlsx?|zip|docx?)($|\?)/i.test(url)) {
    router.push({ pathname: '/web', params: { url, title: title ?? '자료 보기' } });
  } else {
    Linking.openURL(url).catch(() => {});
  }
}
