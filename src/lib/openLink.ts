import { router } from 'expo-router';
import { Linking } from 'react-native';
import { OFFICIAL_HOSTS } from './webview';

/** 링크 열기 (2026-11-22·24 사용자 요청: 최대한 앱 안에서)
 * - 공식 사이트의 PDF → 앱 안 PDF 미리보기
 * - 웹 페이지(공식·학교·학원 모두) → 앱 안 보기. 공식이 아닌 곳은 위에 '바깥 사이트' 표시
 * - 한글·엑셀 등 파일 → 바깥 앱 (공고 한글 첨부는 수집 때 PDF로 바꿔 둔 것을 따로 엶) */
export function openLink(url: string | null | undefined, title?: string) {
  if (!url) return;
  const official = OFFICIAL_HOSTS.test(url);
  if (official && (/\.pdf($|\?)/i.test(url) || /fileDown\.do/i.test(url))) {
    router.push({ pathname: '/pdf', params: { url, title: title ?? 'PDF' } });
  } else if (/^https?:\/\//i.test(url) && !/\.(hwp|hwpx|xlsx?|zip|docx?|pdf)($|\?)/i.test(url)) {
    router.push({ pathname: '/web', params: { url, title: title ?? '자료 보기' } });
  } else {
    Linking.openURL(url).catch(() => {});
  }
}
