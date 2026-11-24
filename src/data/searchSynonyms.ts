import { ELEM_ORDER } from './contentSystem';

// 검색 동의어 표 (2026-11-24 사용자 요청): 수험생 줄임말·다른 말로 찾아도 공부 메뉴가 맨 위에 뜨게
// words 중 하나가 검색어에 들어 있거나 검색어가 words 중 하나에 들어 있으면 그 메뉴를 보여 줌(띄어쓰기·대소문자 무시)
export type StudyMenu = { key: string; title: string; desc: string; words: string[]; path: string; params?: Record<string, string>; level?: 'elementary' };

export const STUDY_MENUS: StudyMenu[] = [
  {
    key: 'cs',
    title: '내용 체계표(내체표) 모아보기 · 빈칸 암기',
    desc: '2022 개정 교과별 내용 체계 표',
    words: ['내체표', '내용체계표', '내용체계', '체계표', '내용요소', '핵심아이디어', '빈칸암기', '빈칸'],
    path: '/content-system',
    level: 'elementary',
  },
  {
    key: 'tree',
    title: '과목별 개념 구조도',
    desc: '교과 → 영역 → 범주 → 학년군 → 내용 요소',
    words: ['구조도', '개념구조도', '개념도', '마인드맵', '트리', '인출'],
    path: '/concept-tree',
    level: 'elementary',
  },
  {
    key: 'cur',
    title: '교육과정 원문 (총론·각론)',
    desc: '2022·2015 개정 고시문을 앱 안에서',
    words: ['교육과정', '고시문', '총론', '각론', '성취기준', '교육론', '원문'],
    path: '/curriculum',
  },
  {
    key: 'ana',
    title: '기출 분석 (초등 교육과정 A·B)',
    desc: '형광펜 원문·출제 지도·핵심어·안 나온 곳',
    words: ['기출분석', '출제분석', '출제지도', '형광펜', '핵심어', '빈출', '안나온곳'],
    path: '/exam-analysis',
    level: 'elementary',
  },
  {
    key: 'past',
    title: '임용 1차 기출문제',
    desc: '평가원 공개 문제지·정답',
    words: ['기출', '기출문제', '문제지', '평가원', '정답'],
    path: '/past-exams',
  },
  {
    key: 'second',
    title: '2차 문제 (면접·수업실연)',
    desc: '지역별 2차 방식과 공고',
    words: ['2차', '면접', '수업실연', '실연', '수업나눔'],
    path: '/second-exam',
  },
  {
    key: 'law',
    title: '교직논술 관련 법령',
    desc: '교육기본법·초·중등교육법 등',
    words: ['교직논술', '논술', '법령', '교육기본법', '초중등교육법', '교육공무원법', '교권'],
    path: '/academy',
    params: { tab: 'public' },
  },
];

const n = (s: string) => s.replace(/[\s·ㆍ.]/g, '').toLowerCase();

/** 검색어에 맞는 공부 메뉴 (동의어 포함) */
export function matchStudyMenus(q: string, level: 'elementary' | 'secondary'): StudyMenu[] {
  const t = n(q);
  if (t.length < 2) return [];
  return STUDY_MENUS.filter((m) => (!m.level || m.level === level) && m.words.some((w) => t.includes(n(w)) || (t.length >= 2 && n(w).includes(t))));
}

/** '국어 내체표'처럼 교과 이름이 같이 있으면 그 교과 내용 체계로 바로 */
export function matchSubjects(q: string): string[] {
  const t = n(q);
  return ELEM_ORDER.filter((s) => t.includes(n(s)));
}

export const ELEM_SUBJECTS_FOR_CS = ['국어', '사회', '도덕', '수학', '과학', '실과', '체육', '음악', '미술', '영어', '통합교과'];
