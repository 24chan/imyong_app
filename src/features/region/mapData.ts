import koreaMap from '@svg-maps/south-korea';

// 시도 경계 지도 데이터
// 출처: svg-maps (Victor Cazanave), 원본 mapsvg.com — CC BY 4.0 (화면에 출처 표시 필수)
export const MAP_CREDIT = '지도: svg-maps(Victor Cazanave)·mapsvg.com, CC BY 4.0';

// 원본 viewBox(0 0 524 631)에 말풍선 자리를 위해 좌우·위아래 여백을 더함
export const VIEWBOX = { x: -80, y: -10, w: 690, h: 650 };

const ID_TO_CODE: Record<string, string> = {
  'north-chungcheong': 'chungbuk',
  'south-chungcheong': 'chungnam',
  'north-jeolla': 'jeonbuk',
  'south-jeolla': 'jeonnam',
  'north-gyeongsang': 'gyeongbuk',
  'south-gyeongsang': 'gyeongnam',
};

type RawMap = { locations: { id: string; name: string; path: string }[] };

export const REGION_PATHS: { code: string; path: string }[] = (koreaMap as unknown as RawMap).locations.map(
  (l) => ({ code: ID_TO_CODE[l.id] ?? l.id, path: l.path }),
);

/**
 * 말풍선 위치 (viewBox 좌표). point가 있으면 작은 지역이라
 * 바다 쪽에 말풍선을 두고 지역 점(point)까지 선을 그음
 */
export const LABELS: Record<string, { x: number; y: number; point?: [number, number] }> = {
  gyeonggi: { x: 110, y: 72 },
  gangwon: { x: 275, y: 85 },
  chungbuk: { x: 245, y: 205 },
  chungnam: { x: 115, y: 225 },
  jeonbuk: { x: 165, y: 345 },
  jeonnam: { x: 95, y: 465 },
  gyeongbuk: { x: 372, y: 240 },
  gyeongnam: { x: 275, y: 410 },
  jeju: { x: 112, y: 608 },
  seoul: { x: -25, y: 70, point: [152, 127] },
  incheon: { x: -25, y: 140, point: [111, 136] },
  sejong: { x: -25, y: 275, point: [177, 252] },
  daejeon: { x: -25, y: 345, point: [192, 274] },
  gwangju: { x: -25, y: 420, point: [140, 408] },
  daegu: { x: 495, y: 295, point: [300, 336] },
  ulsan: { x: 510, y: 365, point: [364, 367] },
  busan: { x: 470, y: 432, point: [345, 402] },
};
