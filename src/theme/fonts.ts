// 앱 글꼴: Pretendard (OFL 1.1). 굵기마다 파일이 따로라 굵기 → 글꼴 이름으로 바꿔 씀
export const FONT_FILES = {
  'Pretendard-Regular': require('../../assets/fonts/Pretendard-Regular.otf'),
  'Pretendard-Medium': require('../../assets/fonts/Pretendard-Medium.otf'),
  'Pretendard-SemiBold': require('../../assets/fonts/Pretendard-SemiBold.otf'),
  'Pretendard-Bold': require('../../assets/fonts/Pretendard-Bold.otf'),
  'Pretendard-ExtraBold': require('../../assets/fonts/Pretendard-ExtraBold.otf'),
};

export type FontName = keyof typeof FONT_FILES;

export function fontFor(weight?: string | number | null): FontName {
  const w = weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : Number(weight) || 400;
  if (w >= 800) return 'Pretendard-ExtraBold';
  if (w >= 700) return 'Pretendard-Bold';
  if (w >= 600) return 'Pretendard-SemiBold';
  if (w >= 500) return 'Pretendard-Medium';
  return 'Pretendard-Regular';
}
