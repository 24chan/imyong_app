// SPEC.md 5. 디자인 — 색 토큰. 화면 코드에서는 이 값만 사용하고 색을 직접 쓰지 않습니다.
export type ColorTokens = {
  background: string;
  surface: string; // 카드
  text: string;
  textSub: string;
  line: string;
  brand: string;
  up: string; // 증가
  down: string; // 감소
  accent: string;
};

export const lightColors: ColorTokens = {
  background: '#FFFFFF',
  surface: '#F6F8FA',
  text: '#1B2A3A',
  textSub: '#5B6B7C',
  line: '#E3E8EE',
  brand: '#1F5E54',
  up: '#1F5E54',
  down: '#C8553D',
  accent: '#E8A33D',
};

export const darkColors: ColorTokens = {
  background: '#0F1514',
  surface: '#18201F',
  text: '#E8EEED',
  textSub: '#93A3A1',
  line: '#26302F',
  brand: '#4FB3A0',
  up: '#5CC9A7',
  down: '#E8826B',
  accent: '#F0B860',
};

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
