// 중등 임용 과목 (DB subjects 테이블과 같은 code 사용). 운영하면서 추가·수정합니다.
export type Subject = { code: string; name: string; group: string };

export const SUBJECTS: Subject[] = [
  { code: 'korean', name: '국어', group: '언어' },
  { code: 'english', name: '영어', group: '언어' },
  { code: 'math', name: '수학', group: '수리' },
  { code: 'social', name: '일반사회', group: '사회' },
  { code: 'history', name: '역사', group: '사회' },
  { code: 'geography', name: '지리', group: '사회' },
  { code: 'ethics', name: '도덕·윤리', group: '사회' },
  { code: 'physics', name: '물리', group: '과학' },
  { code: 'chemistry', name: '화학', group: '과학' },
  { code: 'biology', name: '생물', group: '과학' },
  { code: 'earth', name: '지구과학', group: '과학' },
  { code: 'pe', name: '체육', group: '예체능' },
  { code: 'music', name: '음악', group: '예체능' },
  { code: 'art', name: '미술', group: '예체능' },
  { code: 'tech', name: '기술', group: '기술·가정' },
  { code: 'homeec', name: '가정', group: '기술·가정' },
  { code: 'info', name: '정보·컴퓨터', group: '기술·가정' },
  { code: 'hanmun', name: '한문', group: '언어' },
  { code: 'japanese', name: '일본어', group: '언어' },
  { code: 'chinese', name: '중국어', group: '언어' },
  { code: 'health', name: '보건', group: '비교과' },
  { code: 'counsel', name: '전문상담', group: '비교과' },
  { code: 'librarian', name: '사서', group: '비교과' },
  { code: 'nutrition', name: '영양', group: '비교과' },
  { code: 'special', name: '특수(중등)', group: '특수' },
];

export const subjectByCode = (code: string | null | undefined) =>
  code ? SUBJECTS.find((s) => s.code === code) : undefined;
