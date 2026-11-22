import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, GestureResponderEvent, Pressable, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { Chip, PrimaryButton, Txt } from '../../components/ui';
import { getPractice, PRACTICE_UNIVS, PracticeSchool, sessionLabel } from '../../data/practice';
import { regionByCode } from '../../data/regions';
import { getSidoGeo } from '../../data/repository';
import { useAsync } from '../../data/useAsync';
import { toggleScrap, useIsScrapped } from '../../store/schoolScraps';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { SchoolInfoBox } from '../region/SchoolInfoBox';
import { FoundMark, useFoundColor } from '../region/SchoolMap';
import { openTransitRoute } from './route';

// 실습초 탭 (2026-11-22 사용자 승인): 교대 → 학년도 → 실습(학기·종류, 학년을 알면 학년) → 지도 + 목록 + 학교 카드
// 누구나 모든 교대 목록을 볼 수 있음(공개 공지). 거리는 캠퍼스에서 직선거리, 대중교통 시간은 미리 구해 둔 값(있을 때)
type CampusMode = 'auto' | string;
type Row = PracticeSchool & { id: string; block: string; campus: string; d: number; min?: number };

const merc = (lat: number) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;

export function PracticeTab() {
  const { colors } = useTheme();
  const colorOf = useFoundColor();
  const [univ, setUniv] = useState<string>(PRACTICE_UNIVS[0].code);
  const data = useAsync(() => getPractice(univ), [univ]);
  const geo = useAsync(() => getSidoGeo(), []);
  const d = data.data;

  const years = useMemo(() => [...new Set((d?.sessions ?? []).map((s) => s.year))].sort((a, b) => b - a), [d]);
  const [year, setYear] = useState<number | null>(null);
  const sessions = useMemo(() => (d?.sessions ?? []).filter((s) => s.year === year), [d, year]);
  const [sid, setSid] = useState<string | null>(null);
  const session = sessions.find((s) => s.id === sid) ?? null;
  const [mode, setMode] = useState<CampusMode>('auto');
  const [area, setArea] = useState<'all' | string>('all');
  const [sort, setSort] = useState<'near' | 'name'>('near');
  const [picked, setPicked] = useState<string | null>(null);
  const [cw, setCw] = useState(0);

  useEffect(() => setYear(years[0] ?? null), [years]);
  useEffect(() => setSid(sessions[sessions.length - 1]?.id ?? null), [sessions]);
  useEffect(() => {
    setPicked(null);
    setMode(session?.grade && d?.grade_campus[String(session.grade)] ? d.grade_campus[String(session.grade)] : 'auto');
  }, [session, d]);

  const campusOf = (block: string) => {
    if (mode !== 'auto') return mode;
    if (!d) return block;
    return d.campuses[block] ? block : Object.keys(d.campuses).find((c) => c !== 'incheon') ?? block;
  };
  const rows: Row[] = useMemo(() => {
    if (!d || !session) return [];
    const r = session.schools
      .filter((x) => area === 'all' || x.block === area)
      .map((x) => {
        const s = d.schools[x.id];
        const campus = campusOf(x.block);
        return { ...s, id: x.id, block: x.block, campus, d: s.km[campus] ?? 0, min: s.transit_min?.[campus] };
      });
    return r.sort((a, b) => (sort === 'near' ? (a.min ?? a.d * 4) - (b.min ?? b.d * 4) : a.short.localeCompare(b.short, 'ko')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, session, area, sort, mode]);
  const blocks = useMemo(() => [...new Set(session?.schools.map((x) => x.block) ?? [])], [session]);
  const sel = rows.find((r) => r.id === picked) ?? null;

  // 작은 지도: 보이는 학교 + 캠퍼스 범위
  const map = useMemo(() => {
    if (!d || !rows.length || !cw) return null;
    const pts = [...rows.map((r) => [r.lng, merc(r.lat)]), ...Object.values(d.campuses).map((c) => [c.lng, merc(c.lat)])];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => -p[1]);
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const pad = Math.max(x1 - x0, y1 - y0) * 0.08 + 0.01;
    x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    const h = Math.min(320, Math.max(200, (cw * (y1 - y0)) / (x1 - x0)));
    const sx = cw / (x1 - x0), sy = h / (y1 - y0), s = Math.min(sx, sy);
    const ox = (cw - (x1 - x0) * s) / 2, oy = (h - (y1 - y0) * s) / 2;
    const P = (lng: number, lat: number): [number, number] => [ox + (lng - x0) * s, oy + (-merc(lat) - y0) * s];
    return { h, P };
  }, [d, rows, cw]);
  const outline = useMemo(() => {
    if (!map || !geo.data) return '';
    return geo.data.sido
      .filter((g) => ['incheon', 'gyeonggi', 'seoul'].includes(g.r))
      .flatMap((g) => g.p.map((ring) => 'M' + ring.map(([lng, lat]) => map.P(lng, lat).map((v) => v.toFixed(1)).join(',')).join('L') + 'Z'))
      .join('');
  }, [map, geo.data]);
  const tapMap = (e: GestureResponderEvent) => {
    if (!map) return;
    const { locationX: x, locationY: y } = e.nativeEvent;
    let best: Row | null = null, bd = 24 * 24;
    rows.forEach((r) => {
      const [px, py] = map.P(r.lng, r.lat);
      const dd = (px - x) ** 2 + (py - y) ** 2;
      if (dd < bd) (bd = dd), (best = r);
    });
    setPicked(best ? (best as Row).id : null);
  };

  if (data.loading) return <ActivityIndicator color={colors.brand} />;
  if (data.error) return <Txt color="down">{data.error.message}</Txt>;
  if (!d) return <Txt variant="sub">실습학교 목록을 준비 중이에요.</Txt>;

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {PRACTICE_UNIVS.map((u) => (
          <Chip key={u.code} label={u.name} selected={univ === u.code} onPress={() => setUniv(u.code)} />
        ))}
        {years.map((y) => (
          <Chip key={y} label={`${y}학년도`} selected={year === y} onPress={() => setYear(y)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {sessions.map((s) => (
          <Chip key={s.id} label={sessionLabel(s)} selected={sid === s.id} onPress={() => setSid(s.id)} />
        ))}
      </View>
      {session && !session.grade && (
        <Txt variant="sub" style={{ fontSize: 12 }}>공지에 학년이 적혀 있지 않아 실습 이름으로 보여요. 학년이 확인되면 함께 표시할게요.</Txt>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Chip label="가까운 캠퍼스 기준" selected={mode === 'auto'} onPress={() => setMode('auto')} />
        {Object.entries(d.campuses).map(([k, c]) => (
          <Chip key={k} label={`${c.name.replace('캠퍼스', '캠')} 기준`} selected={mode === k} onPress={() => setMode(k)} />
        ))}
      </View>
      {blocks.length > 1 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip label={`전체 ${session?.schools.length ?? 0}`} selected={area === 'all'} onPress={() => setArea('all')} />
          {blocks.map((b) => (
            <Chip key={b} label={`${regionByCode(b)?.shortName ?? b} ${session?.schools.filter((x) => x.block === b).length}`} selected={area === b} onPress={() => setArea(b)} />
          ))}
          <Chip label={sort === 'near' ? '↕ 가까운 순' : '↕ 이름순'} selected={false} onPress={() => setSort(sort === 'near' ? 'name' : 'near')} />
        </View>
      )}

      <View onLayout={(e) => setCw(e.nativeEvent.layout.width)} style={{ borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface }}>
        {map && (
          <Pressable onPress={tapMap} accessibilityLabel="실습학교 지도. 점을 누르면 학교 카드가 열려요">
            <Svg width={cw} height={map.h}>
              <Path d={outline} fill={colors.background} stroke={colors.line} strokeWidth={1} />
              {Object.entries(d.campuses).map(([k, c]) => {
                const [x, y] = map.P(c.lng, c.lat);
                return (
                  <G key={k}>
                    <Rect x={x - 6} y={y - 6} width={12} height={12} rx={3} fill={colors.accent} stroke={colors.background} strokeWidth={1.5} />
                  </G>
                );
              })}
              {rows.map((r) => {
                const [x, y] = map.P(r.lng, r.lat);
                return <Circle key={r.id} cx={x} cy={y} r={picked === r.id ? 7 : 4.5} fill={colorOf(r.found)} stroke={picked === r.id ? colors.text : colors.background} strokeWidth={picked === r.id ? 2 : 1} />;
              })}
            </Svg>
          </Pressable>
        )}
      </View>
      <Txt variant="sub" style={{ fontSize: 12 }}>■ 캠퍼스 · ● 실습학교 (점을 누르면 학교 카드)</Txt>

      {sel && <SchoolCard row={sel} campuses={d.campuses} onClose={() => setPicked(null)} />}

      {rows.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => setPicked(r.id === picked ? null : r.id)}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}
        >
          <FoundMark found={r.found} size={10} />
          <View style={{ flex: 1 }}>
            <Txt style={{ fontWeight: '700' }}>{r.short}</Txt>
            <Txt variant="sub" style={{ fontSize: 12 }}>
              {regionByCode(r.region)?.shortName} {r.sigungu}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt style={{ fontWeight: '700' }}>{r.min ? `약 ${r.min}분` : `${r.d}km`}</Txt>
            <Txt variant="sub" style={{ fontSize: 11 }}>
              {d.campuses[r.campus]?.name.replace('캠퍼스', '캠')}에서{r.min ? ` · ${r.d}km` : ' 직선'}
            </Txt>
          </View>
        </Pressable>
      ))}
      {session && (
        <Txt variant="sub" style={{ fontSize: 12 }}>
          출처: {session.source.by} 「{session.source.title}」({session.source.date}). 학교 이름만 옮겼어요(신청 인원은 공지 시점 값이라 뺐어요). 거리는 직선거리, 학교 위치는 공공데이터포털 기준.
        </Txt>
      )}
    </View>
  );
}

function SchoolCard({ row, campuses, onClose }: { row: Row; campuses: Record<string, { name: string; lat: number; lng: number }>; onClose: () => void }) {
  const { colors } = useTheme();
  const scrapped = useIsScrapped(row);
  const campus = campuses[row.campus];
  return (
    <View style={{ gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.cat.teal.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Txt style={{ fontWeight: '800', fontSize: 16 }}>{row.name}</Txt>
          <Txt variant="sub">
            {regionByCode(row.region)?.shortName} {row.sigungu}
          </Txt>
        </View>
        <Pressable
          onPress={() => toggleScrap({ region: row.region, name: row.name, sigungu: row.sigungu, lat: row.lat, lng: row.lng, found: row.found })}
          accessibilityRole="button"
          accessibilityLabel={scrapped ? '스크랩 해제' : '스크랩'}
          hitSlop={10}
        >
          <Ionicons name={scrapped ? 'star' : 'star-outline'} size={24} color={scrapped ? colors.accent : colors.textSub} />
        </Pressable>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="닫기" hitSlop={10}>
          <Ionicons name="close" size={22} color={colors.textSub} />
        </Pressable>
      </View>
      {Object.entries(campuses).map(([k, c]) => (
        <Txt key={k}>
          {c.name}에서 직선 {row.km[k]}km{row.transit_min?.[k] ? ` · 대중교통 약 ${row.transit_min[k]}분(평일 기준)` : ''}
        </Txt>
      ))}
      {!Object.keys(row.transit_min ?? {}).length && <Txt variant="sub" style={{ fontSize: 12 }}>대중교통 시간은 준비 중이에요. 아래 버튼으로 카카오맵에서 바로 볼 수 있어요.</Txt>}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton label={`${campus?.name.replace('캠퍼스', '캠')}에서 길찾기`} onPress={() => campus && openTransitRoute(row, { name: campus.name, lat: campus.lat, lng: campus.lng })} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="내 위치에서" variant="ghost" onPress={() => openTransitRoute(row)} />
        </View>
      </View>
      <SchoolInfoBox region={row.region} name={row.name} kind="e" />
    </View>
  );
}
