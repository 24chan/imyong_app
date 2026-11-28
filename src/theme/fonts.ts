// 앱 글꼴: Pretendard (OFL 1.1). 굵기마다 파일이 따로라 굵기 → 글꼴 이름으로 바꿔 씀
// 2026-11-28 용량 정리: Medium(500) 파일을 빼고 500은 Regular로. 남은 4종은 한글 11,172자·영문·기호만 남긴 부분 글꼴(가나·기타 문자 뺌, 7.9MB → 약 5.3MB)
export const FONT_FILES = {
  'Pretendard-Regular': require('../../assets/fonts/Pretendard-Regular.otf'),
  'Pretendard-SemiBold': require('../../assets/fonts/Pretendard-SemiBold.otf'),
  'Pretendard-Bold': require('../../assets/fonts/Pretendard-Bold.otf'),
  'Pretendard-ExtraBold': require('../../assets/fonts/Pretendard-ExtraBold.otf'),
};

export type FontName = keyof typeof FONT_FILES;

export function fontFor(weight?: string | number | null): FontName {
  const w = weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : Number(weight) || 400;
  if (w >= 800) return 'Pretendard-ExtraBold'; // 2026-11-28 개편: 제목·큰 숫자
  if (w >= 700) return 'Pretendard-Bold';
  if (w >= 600) return 'Pretendard-SemiBold';
  return 'Pretendard-Regular';
}
