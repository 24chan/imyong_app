import type { Feature } from '../lib/access';
import { ELEM_ORDER } from './contentSystem';

// 검색 동의어 표 (2026-11-24 사용자 요청): 수험생 줄임말·다른 말로 찾아도 공부 메뉴가 맨 위에 뜨게
// words 중 하나가 검색어에 들어 있거나 검색어가 words 중 하나에 들어 있으면 그 메뉴를 보여 줌(띄어쓰기·대소문자 무시)
export type StudyMenu = { key: string; title: string; desc: string; words: string[]; path: string; params?: Record<string, string>; level?: 'elementary'; feature?: Feature };

export const STUDY_MENUS: StudyMenu[] = [
  {
    key: 'cs',
    title: '내용 체계표(내체표) 모아보기',
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
    feature: 'concept-tree',
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
    feature: 'exam-analysis',
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
  // ── 2026-11-28 사용자 요청: 기능·화면 이름으로도 찾기 (메뉴·기능 전체)
  { key: 'practice', title: '실습초 (교육실습 협력학교)', desc: '교대별 실습 학교 목록·실습 후기·제보', words: ['실습', '실습초', '실습학교', '교생', '교육실습', '협력학교', '실습후기', '참관실습'], path: '/school-map', params: { tab: 'practice' }, level: 'elementary' },
  { key: 'scraps', title: '스크랩한 학교', desc: '☆ 누른 학교 모아보기·순서 바꾸기', words: ['스크랩', '즐겨찾기', '찜', '저장한학교', '관심학교'], path: '/school-map', params: { tab: 'scraps' } },
  { key: 'schoolmap', title: '학교 지도', desc: '전국 학교 지도·학교 정보(학교알리미)', words: ['학교지도', '전국학교', '지도', '학교정보', '학교알리미', '학급수', '학생수'], path: '/school-map' },
  { key: 'region', title: '지역·TO', desc: '지역별 선발 인원·경쟁률·합격선', words: ['지역', 'TO', '티오', '선발인원', '선발', '경쟁률', '합격선', '커트라인', '컷', '1차컷'], path: '/(tabs)/region' },
  { key: 'compare', title: '지역 비교', desc: '두 지역 TO·경쟁률·합격선 나란히', words: ['비교', '지역비교'], path: '/compare' },
  { key: 'trend', title: '추이·합격률', desc: '연도별 경쟁률 변동과 합격률', words: ['추이', '합격률', '변동', '그래프', '연도별'], path: '/trend' },
  { key: 'schedule', title: '일정', desc: '시험·접수·설명회·개강 달력과 알림', words: ['일정', '달력', '캘린더', '설명회', '개강', '접수', '원서', '시험일', '발표일', 'D-day', '디데이'], path: '/(tabs)/schedule' },
  { key: 'news', title: '임용 소식 (교육청 공고)', desc: '사전 예고·시행 계획·합격자 발표', words: ['소식', '공고', '사전예고', '시행계획', '합격자', '합격발표', '교육청', '뉴스'], path: '/news' },
  { key: 'private', title: '사립 위탁 채용', desc: '사립학교 교육청 위탁 선발·학교별 채용', words: ['사립', '위탁', '채용', '사립채용', '학교별채용'], path: '/private' },
  { key: 'mock', title: '모의고사', desc: '모의고사 후기·내 점수', words: ['모의고사', '모고', '점수', '성적', '내점수'], path: '/(tabs)/academy', params: { tab: 'mock' } },
  { key: 'lectures', title: '학원·인강 후기', desc: '강의별 별점·후기', words: ['학원', '인강', '강의', '후기', '강사', '별점'], path: '/(tabs)/academy', params: { tab: 'lectures' } },
  { key: 'public', title: '공부 자료', desc: '교육과정·기출·2차·법령 모음', words: ['공부자료', '공개자료', '자료', '공부'], path: '/(tabs)/academy', params: { tab: 'public' } },
  { key: 'blank', title: '빈칸 암기', desc: '내체표·개념 구조도·기출 분석에서 빈칸 암기 모드', words: ['빈칸', '빈칸암기', '암기', '외우기', '오답', '가리기'], path: '/content-system', level: 'elementary', feature: 'blank' },
  { key: 'note', title: '기출 문항 필기', desc: '기출 분석 → 문항 그림에 펜·형광펜으로 쓰기', words: ['필기', '펜', '형광펜', '메모', '문항필기'], path: '/exam-analysis', level: 'elementary', feature: 'exam-analysis' },
  { key: 'b-hot', title: '커뮤니티 · HOT 게시판', desc: '공감 많은 인기 글', words: ['HOT', '핫', '인기글', '인기'], path: '/(tabs)/community', params: { board: 'hot' } },
  { key: 'b-free', title: '커뮤니티 · 자유 게시판', desc: '자유롭게 이야기', words: ['자유', '자유게시판', '커뮤니티', '게시판'], path: '/(tabs)/community', params: { board: 'free' } },
  { key: 'b-elem', title: '커뮤니티 · 초등 게시판', desc: '초등 임용 이야기', words: ['초등게시판', '초등'], path: '/(tabs)/community', params: { board: 'elem' } },
  { key: 'b-sec', title: '커뮤니티 · 중등 게시판', desc: '중등 임용·과목 이야기', words: ['중등게시판', '중등', '과목'], path: '/(tabs)/community', params: { board: 'sec' } },
  { key: 'b-review', title: '커뮤니티 · 합격 수기', desc: '합격한 사람들의 공부 이야기', words: ['합격수기', '수기', '합격후기', '공부법'], path: '/(tabs)/community', params: { board: 'review' } },
  { key: 'b-region', title: '커뮤니티 · 지역 이야기', desc: '지역별 정보와 고민', words: ['지역이야기', '지역게시판'], path: '/(tabs)/community', params: { board: 'region' } },
  { key: 'b-study', title: '커뮤니티 · 스터디 모집', desc: '같이 공부할 사람 찾기', words: ['스터디', '스터디모집', '같이공부', '모집', '그룹스터디'], path: '/(tabs)/community', params: { board: 'study' } },
  { key: 'write', title: '글쓰기', desc: '커뮤니티에 글 쓰기·질문하기', words: ['글쓰기', '질문', '질문하기', '글작성'], path: '/community/write' },
  { key: 'messages', title: '쪽지', desc: '받은 쪽지·대화', words: ['쪽지', '메시지', '메세지', 'DM', '대화'], path: '/messages' },
  { key: 'verify', title: '학교 인증', desc: '교대·사범대 메일 또는 서류로 인증', words: ['인증', '학교인증', '교대인증', '사범대인증', '재학', '학교메일'], path: '/verify' },
  { key: 'nickname', title: '닉네임 바꾸기', desc: '커뮤니티에서 쓰는 이름', words: ['닉네임', '별명', '이름변경'], path: '/nickname' },
  { key: 'settings', title: '설정', desc: '초등·중등 모드, 다크 모드, 알림, 계정', words: ['설정', '다크모드', '라이트모드', '테마', '알림', '푸시', '모드', '초등중등', '로그아웃', '탈퇴', '계정'], path: '/settings' },
  { key: 'rules', title: '커뮤니티 이용 규칙', desc: '누가 쓸 수 있는지·금지 행동', words: ['규칙', '이용규칙', '금지', '신고', '제재'], path: '/rules' },
  { key: 'privacy', title: '개인정보처리방침', desc: '어떤 정보를 어떻게 다루는지', words: ['개인정보', '처리방침', '개인정보처리방침'], path: '/legal/privacy' },
  { key: 'terms', title: '이용약관', desc: '서비스 이용 약관', words: ['약관', '이용약관'], path: '/legal/terms' },
  { key: 'report', title: '오류 신고', desc: '숫자가 공고와 다를 때 알려 주기', words: ['오류', '오류신고', '틀림', '잘못', '제보'], path: '/report' },
];

const n = (s: string) => s.replace(/[\s·ㆍ.]/g, '').toLowerCase();

/** 검색어에 맞는 공부 메뉴 (동의어 포함) */
export function matchStudyMenus(q: string, level: 'elementary' | 'secondary', can: (f: Feature) => boolean = () => true): StudyMenu[] {
  const t = n(q);
  if (t.length < 2) return [];
  // 2026-11-28: 동의어뿐 아니라 메뉴 이름·설명에 들어 있는 말로도. 딱 맞는 것부터
  const score = (m: StudyMenu) => {
    const ws = m.words.map(n);
    if (ws.includes(t) || n(m.title).startsWith(t)) return 3;
    if (n(m.title).includes(t) || ws.some((w) => w.includes(t))) return 2;
    if (ws.some((w) => w.length >= 2 && t.includes(w)) || n(m.desc).includes(t)) return 1;
    return 0;
  };
  return STUDY_MENUS.filter((m) => (!m.level || m.level === level) && (!m.feature || can(m.feature)))
    .map((m) => [m, score(m)] as const)
    .filter(([, sc]) => sc > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m);
}

/** '국어 내체표'처럼 교과 이름이 같이 있으면 그 교과 내용 체계로 바로 */
export function matchSubjects(q: string): string[] {
  const t = n(q);
  return ELEM_ORDER.filter((s) => t.includes(n(s)));
}

export const ELEM_SUBJECTS_FOR_CS = ['국어', '사회', '도덕', '수학', '과학', '실과', '체육', '음악', '미술', '영어', '통합교과'];
