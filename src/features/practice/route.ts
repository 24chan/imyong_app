import { Linking } from 'react-native';

// 카카오맵 대중교통 길찾기 열기. 앱이 있으면 앱, 없으면 카카오맵 웹.
// 내 위치에서 가는 길은 카카오맵이 직접 위치를 써요 → 우리 앱은 위치를 받지 않음(위치 권한·처리방침 변경 없음)
type P = { name: string; lat: number; lng: number };
const enc = encodeURIComponent;

export async function openTransitRoute(to: P, from?: P) {
  const app = `kakaomap://route?${from ? `sp=${from.lat},${from.lng}&` : ''}ep=${to.lat},${to.lng}&by=PUBLICTRANSIT`;
  const web = from
    ? `https://map.kakao.com/link/from/${enc(from.name)},${from.lat},${from.lng}/to/${enc(to.name)},${to.lat},${to.lng}`
    : `https://map.kakao.com/link/to/${enc(to.name)},${to.lat},${to.lng}`;
  try {
    await Linking.openURL(app);
  } catch {
    await Linking.openURL(web).catch(() => {});
  }
}
