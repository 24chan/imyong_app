import { cached } from './repository';

// 교육과정 원문 (2026-11-24 사용자 승인): NCIC 원문 인벤토리 목록을 수집(ncic 워크플로)해 raw-files에 둔 것
const URL = 'https://wckaybzamhvmhxiacmnx.supabase.co/storage/v1/object/public/pub/raw/ncic/curriculum.json';

export type CurFile = { name: string; ext: string; seq: string; year: string; url: string };
export type CurDoc = {
  era: string; // '2022 개정 시기'
  school: string; // '초등학교(2022.12)'
  subject: string; // '국어'
  sections: { title: string; path: string[]; seq: string }[];
  files: CurFile[];
};
export type Curriculum = { source: string; page: string; docs: CurDoc[] };

export function getCurriculum(): Promise<Curriculum | null> {
  return cached('curriculum', async () => {
    const res = await fetch(URL);
    if (!res.ok) return null;
    return (await res.json()) as Curriculum;
  });
}

/** '초등학교(2022.12)' → { base: '초등학교', ver: '2022.12' } */
export const splitSchool = (s: string) => {
  const m = s.match(/^(.*?)\((\d{4}\.\d{2})\)$/);
  return m ? { base: m[1].trim(), ver: m[2] } : { base: s, ver: '' };
};

/** 파일 이름에서 '(2022 개정)', '_국가교육위원회 고시 …' 같은 꼬리를 줄여 보기 좋게 */
export const prettyCurFile = (n: string) =>
  n
    .replace(/\.(pdf|hwp|hwpx)$/i, '')
    .replace(/^\(20\d\d\s*개정\)\s*/, '')
    .replace(/_/g, ' ')
    .trim();
