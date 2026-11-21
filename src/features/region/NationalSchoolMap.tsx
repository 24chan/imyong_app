import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, GestureResponderEvent, Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Chip, Txt } from '../../components/ui';
import { regionByCode, REGIONS } from '../../data/regions';
import { getAllSchools, SchoolWithRegion } from '../../data/repository';
import { useAsync } from '../../data/useAsync';
import type { Level } from '../../store/AppSettings';
import { space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { SchoolFound } from '../../types/data';
import { FoundMark, useFoundColor } from './SchoolMap';

// 지도 좌표: 경도 그대로, 위도는 메르카토르 (SchoolMap과 같은 방식)
const merc = (lat: number) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
const FOUND_LABEL: Record<SchoolFound, string> = { p: '공립', s: '사립', n: '국립' };

export const schoolsForLevel = (all: SchoolWithRegion[], level: Level) =>
  // 울릉도·독도(경도 130.5 넘음)는 전국 지도에서 빼고 경북 지역 지도에서 봐요
  all.filter((s) => (level === 'elementary' ? s.kind === 'e' : s.kind !== 'e') && s.lng < 130.5 && s.lat > 33);

export function openRegionSchools(region: string, level: Level) {
  router.push({ pathname: '/schools', params: { region, level } });
}

/**
 * 전국 학교 지도: 초등 모드 = 전국 초등학교, 중등 모드 = 전국 중·고등학교.
 * 학교 수천 곳을 설립별로 하나의 선(Path)으로 묶어 그려서 가벼움. 누른 곳에서 가장 가까운 학교의 지역 지도가 열려요.
 */
export function NationalSchoolMap({ level, maxHeight = 420, showChips = false }: { level: Level; maxHeight?: number; showChips?: boolean }) {
  const { colors } = useTheme();
  const colorOf = useFoundColor();
  const data = useAsync(() => getAllSchools(), []);
  const [w, setW] = useState(0);
  const [tapped, setTapped] = useState<{ x: number; y: number } | null>(null);

  const schools = useMemo(() => schoolsForLevel(data.data ?? [], level), [data.data, level]);

  const geom = useMemo(() => {
    if (!schools.length || !w) return null;
    const xs = schools.map((s) => s.lng);
    const ys = schools.map((s) => -merc(s.lat));
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const pad = 10;
    const k = Math.min((w - pad * 2) / (x1 - x0), (maxHeight - pad * 2) / (y1 - y0));
    const h = (y1 - y0) * k + pad * 2;
    const ox = (w - (x1 - x0) * k) / 2;
    const pts = schools.map((s, i) => ({ s, x: ox + (xs[i] - x0) * k, y: pad + (ys[i] - y0) * k }));
    // 공립은 작게, 사립·국립은 조금 크게 (위에 그림)
    const rp = 1.3, rs = level === 'elementary' ? 2.1 : 1.7;
    const f = (n: number) => n.toFixed(1);
    const d: Record<SchoolFound, string> = { p: '', s: '', n: '' };
    for (const { s, x, y } of pts) {
      if (s.found === 'p') d.p += `M${f(x - rp)} ${f(y)}a${rp} ${rp} 0 1 0 ${rp * 2} 0a${rp} ${rp} 0 1 0 ${-rp * 2} 0`;
      else if (s.found === 's') d.s += `M${f(x - rs)} ${f(y - rs)}h${rs * 2}v${rs * 2}h${-rs * 2}z`;
      else d.n += `M${f(x)} ${f(y - rs * 1.3)}l${rs * 1.3} ${rs * 1.3}l${-rs * 1.3} ${rs * 1.3}l${-rs * 1.3} ${-rs * 1.3}z`;
    }
    return { pts, h, d };
  }, [schools, w, maxHeight, level]);

  const counts = useMemo(() => {
    const c: Record<SchoolFound, number> = { p: 0, s: 0, n: 0 };
    schools.forEach((s) => (c[s.found] += 1));
    return c;
  }, [schools]);
  const byRegion = useMemo(() => {
    const m = new Map<string, number>();
    schools.forEach((s) => m.set(s.region, (m.get(s.region) ?? 0) + 1));
    return m;
  }, [schools]);

  const onTap = (e: GestureResponderEvent) => {
    if (!geom) return;
    const { locationX: x, locationY: y } = e.nativeEvent;
    let best = geom.pts[0];
    let bd = Infinity;
    for (const p of geom.pts) {
      const dd = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (dd < bd) (bd = dd), (best = p);
    }
    if (bd > 40 * 40) return; // 바다 등 학교에서 먼 곳
    setTapped({ x: best.x, y: best.y });
    setTimeout(() => setTapped(null), 600);
    openRegionSchools(best.s.region, level);
  };

  return (
    <View style={{ gap: space.sm }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {data.loading && !data.data ? (
        <View style={{ height: 200, alignItems: 'center', justifyContent: 'center', gap: space.sm }}>
          <ActivityIndicator color={colors.brand} />
          <Txt variant="sub">전국 학교 위치를 받는 중이에요 (처음 한 번)</Txt>
        </View>
      ) : !geom ? (
        <Txt variant="sub">{data.error ? `학교 위치를 불러오지 못했어요: ${data.error.message}` : '학교 위치 자료가 아직 없어요.'}</Txt>
      ) : (
        <Pressable
          onPress={onTap}
          accessibilityRole="button"
          accessibilityLabel="전국 학교 지도. 누른 곳의 지역 학교 지도가 열려요"
          style={{ alignSelf: 'center' }}
        >
          <Svg width={w} height={geom.h}>
            <Path d={geom.d.p} fill={colorOf('p')} fillOpacity={0.55} />
            <Path d={geom.d.n} fill={colorOf('n')} />
            <Path d={geom.d.s} fill={colorOf('s')} />
            {tapped && <Circle cx={tapped.x} cy={tapped.y} r={14} fill="none" stroke={colors.text} strokeWidth={2} />}
          </Svg>
        </Pressable>
      )}

      {geom && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          {(['p', 's', 'n'] as SchoolFound[])
            .filter((f) => counts[f] > 0)
            .map((f) => (
              <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <FoundMark found={f} />
                <Txt variant="sub" color="text">
                  {FOUND_LABEL[f]} {counts[f].toLocaleString()}곳
                </Txt>
              </View>
            ))}
        </View>
      )}

      {geom && showChips && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {REGIONS.filter((r) => byRegion.has(r.code)).map((r) => (
            <Chip
              key={r.code}
              label={`${regionByCode(r.code)?.shortName} ${byRegion.get(r.code)?.toLocaleString()}`}
              selected={false}
              onPress={() => openRegionSchools(r.code, level)}
            />
          ))}
        </View>
      )}
    </View>
  );
}
