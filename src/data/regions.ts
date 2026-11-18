// 17개 시도 (DB regions 테이블과 같은 code 사용)
export type Region = { code: string; name: string; shortName: string };

export const REGIONS: Region[] = [
  { code: 'seoul', name: '서울특별시', shortName: '서울' },
  { code: 'busan', name: '부산광역시', shortName: '부산' },
  { code: 'daegu', name: '대구광역시', shortName: '대구' },
  { code: 'incheon', name: '인천광역시', shortName: '인천' },
  { code: 'gwangju', name: '광주광역시', shortName: '광주' },
  { code: 'daejeon', name: '대전광역시', shortName: '대전' },
  { code: 'ulsan', name: '울산광역시', shortName: '울산' },
  { code: 'sejong', name: '세종특별자치시', shortName: '세종' },
  { code: 'gyeonggi', name: '경기도', shortName: '경기' },
  { code: 'gangwon', name: '강원특별자치도', shortName: '강원' },
  { code: 'chungbuk', name: '충청북도', shortName: '충북' },
  { code: 'chungnam', name: '충청남도', shortName: '충남' },
  { code: 'jeonbuk', name: '전북특별자치도', shortName: '전북' },
  { code: 'jeonnam', name: '전라남도', shortName: '전남' },
  { code: 'gyeongbuk', name: '경상북도', shortName: '경북' },
  { code: 'gyeongnam', name: '경상남도', shortName: '경남' },
  { code: 'jeju', name: '제주특별자치도', shortName: '제주' },
];

export const regionByCode = (code: string) => REGIONS.find((r) => r.code === code);
