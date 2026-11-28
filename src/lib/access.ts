import { useCallback } from 'react';
import { useAuth } from '../store/Auth';

// 기능별 공개 범위 (2026-11-28 사용자 결정)
// - 검색하면 누구나 찾을 수 있는 자료(고시문 원문, 공고·일정, 모집인원·합격선, 커뮤니티 등): 전체 공개 → 여기 넣지 않음
// - 자료를 가공해 임용에 더 도움이 되게 만든 것: 경인교대 인증 회원만(운영자는 확인용으로 항상)
// - 볼 수 없는 사람에게는 메뉴·버튼·안내를 아예 그리지 않음(안내 문구도 없음)
// 나중에 유료로 바꿀 때: 규칙에 { paid: true } 를 넣고 아래 can() 에 결제 권한 확인만 더하면 됨
// 2026-11-28 수정: 내용 체계표 자체는 전체 공개, 빈칸 암기(가공 기능)만 경인교대
export type Feature = 'exam-analysis' | 'concept-tree' | 'blank';

type Rule = { univ?: string[]; paid?: boolean };

const RULES: Record<Feature, Rule> = {
  'exam-analysis': { univ: ['ginue'] },
  'concept-tree': { univ: ['ginue'] },
  blank: { univ: ['ginue'] },
};

export function canUse(f: Feature, who: { isAdmin: boolean; univCodes: string[] }): boolean {
  if (who.isAdmin) return true;
  const r = RULES[f];
  if (r.univ && who.univCodes.some((c) => r.univ!.includes(c))) return true;
  return false;
}

/** 화면에서: const can = useAccess(); {can('exam-analysis') && <메뉴 />} */
export function useAccess() {
  const { isAdmin, univCodes } = useAuth();
  return useCallback((f: Feature) => canUse(f, { isAdmin, univCodes }), [isAdmin, univCodes]);
}
