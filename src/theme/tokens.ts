// SPEC.md 5. 디자인 — 색 토큰. 화면 코드에서는 이 값만 사용하고 색을 직접 쓰지 않습니다.
export type ColorTokens = {
  /** 화면 바탕 (2026-11-23 시안 A: 연회색 바탕 + 흰 카드) */
  canvas: string;
  background: string; // 카드·입력칸 바탕 (다크에서는 바탕보다 밝음)
  surface: string; // 카드
  text: string;
  textSub: string;
  line: string;
  brand: string;
  up: string; // 증가
  down: string; // 감소
  accent: string;
  /** 카테고리 색 (2026-11-21 승인): 메뉴 아이콘·지역 칠하기 등. bg = 연한 바탕, fg = 진한 아이콘·글자 */
  cat: Record<CatKey, { bg: string; fg: string }>;
};

export type CatKey = 'teal' | 'blue' | 'purple' | 'coral' | 'amber' | 'pink' | 'green' | 'gray';

export const lightColors: ColorTokens = {
  canvas: '#F2F4F7',
  background: '#FFFFFF',
  surface: '#F6F8FA',
  text: '#1B2A3A',
  textSub: '#5B6B7C',
  line: '#E3E8EE',
  brand: '#1F5E54',
  up: '#1F5E54',
  down: '#C8553D',
  accent: '#E8A33D',
  cat: {
    teal: { bg: '#E1F5EE', fg: '#0F6E56' },
    blue: { bg: '#E6F1FB', fg: '#185FA5' },
    purple: { bg: '#EEEDFE', fg: '#534AB7' },
    coral: { bg: '#FAECE7', fg: '#993C1D' },
    amber: { bg: '#FAEEDA', fg: '#854F0B' },
    pink: { bg: '#FBEAF0', fg: '#993556' },
    green: { bg: '#EAF3DE', fg: '#3B6D11' },
    gray: { bg: '#F1EFE8', fg: '#5F5E5A' },
  },
};

export const darkColors: ColorTokens = {
  canvas: '#0F1514',
  background: '#18201F',
  surface: '#202A28',
  text: '#E8EEED',
  textSub: '#93A3A1',
  line: '#26302F',
  brand: '#4FB3A0',
  up: '#5CC9A7',
  down: '#E8826B',
  accent: '#F0B860',
  cat: {
    teal: { bg: '#0E2B25', fg: '#5DCAA5' },
    blue: { bg: '#0F2235', fg: '#85B7EB' },
    purple: { bg: '#1F1C3D', fg: '#AFA9EC' },
    coral: { bg: '#33190F', fg: '#F0997B' },
    amber: { bg: '#30220C', fg: '#EF9F27' },
    pink: { bg: '#331624', fg: '#ED93B1' },
    green: { bg: '#18280C', fg: '#97C459' },
    gray: { bg: '#232625', fg: '#B4B2A9' },
  },
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
