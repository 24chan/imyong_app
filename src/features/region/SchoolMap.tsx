import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentRef, forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, View } from 'react-native';
import Svg, { Circle, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { Txt } from '../../components/ui';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { School, SchoolFound } from '../../types/data';

const ZOOMS = [1, 2, 3, 5];
const TAP_RADIUS = 22; // 이 거리(px) 안의 가장 가까운 학교를 선택

export type SchoolMapHandle = { focus: (s: School) => void };

type Props = {
  schools: School[]; // 지도에 그릴 학교 (이미 필터된 것)
  selected: School | null;
  onSelect: (s: School | null) => void;
  showSigungu: boolean; // 세종처럼 시군구가 없는 곳은 false
};

/** 설립별 색 (토큰만 사용) */
export function useFoundColor() {
  const { colors } = useTheme();
  return (f: SchoolFound) => (f === 'p' ? colors.brand : f === 's' ? colors.accent : colors.textSub);
}

/** 범례·목록에 쓰는 작은 모양: 공립 ●, 사립 ■, 국립 ◆ (색만으로 구분하지 않도록) */
export function FoundMark({ found, size = 10 }: { found: SchoolFound; size?: number }) {
  const color = useFoundColor()(found);
  const h = size / 2;
  return (
    <Svg width={size} height={size}>
      {found === 'p' && <Circle cx={h} cy={h} r={h} fill={color} />}
      {found === 's' && <Rect x={0.5} y={0.5} width={size - 1} height={size - 1} rx={1.5} fill={color} />}
      {found === 'n' && <Polygon points={`${h},0 ${size},${h} ${h},${size} 0,${h}`} fill={color} />}
    </Svg>
  );
}

/** 섬 등 멀리 떨어진 학교 때문에 지도가 작아지지 않도록 2~98% 범위로 틀을 잡음 */
function frameOf(all: School[]) {
  const q = (xs: number[], p: number) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))];
  };
  const lats = all.map((s) => s.lat);
  const lngs = all.map((s) => s.lng);
  const trim = all.length > 60 ? 0.02 : 0;
  let [lat0, lat1, lng0, lng1] = [q(lats, trim), q(lats, 1 - trim), q(lngs, trim), q(lngs, 1 - trim)];
  const padLat = Math.max((lat1 - lat0) * 0.06, 0.01);
  const padLng = Math.max((lng1 - lng0) * 0.06, 0.01);
  lat0 -= padLat;
  lat1 += padLat;
  lng0 -= padLng;
  lng1 += padLng;
  const k = Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180); // 경도 1도의 실제 길이 보정
  return { lat0, lat1, lng0, lng1, k, aspect: (lat1 - lat0) / ((lng1 - lng0) * k) };
}

/**
 * 지역 학교 점 지도. +/− 로 확대하고 손가락으로 끌어 이동.
 * 점을 누르면 가장 가까운 학교를 선택.
 */
export const SchoolMap = forwardRef<SchoolMapHandle, Props & { frameFrom: School[] }>(function SchoolMap(
  { schools, selected, onSelect, showSigungu, frameFrom },
  ref,
) {
  const { colors } = useTheme();
  const colorOf = useFoundColor();
  const [vw, setVw] = useState(0);
  const [zi, setZi] = useState(0);
  const z = ZOOMS[zi];
  const hRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const vRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const off = useRef({ x: 0, y: 0 });

  const frame = useMemo(() => frameOf(frameFrom.length ? frameFrom : schools), [frameFrom, schools]);
  const vh = Math.round(Math.min(Math.max(vw * frame.aspect, vw * 0.7), vw * 1.25));
  // 지도 내용 크기: 화면 틀(vw×vh) 안에 비율 유지로 맞춘 뒤 확대
  const base = Math.min(vw / ((frame.lng1 - frame.lng0) * frame.k), vh / (frame.lat1 - frame.lat0));
  const cw = vw * z;
  const ch = vh * z;
  const ox = (vw - (frame.lng1 - frame.lng0) * frame.k * base) / 2;
  const oy = (vh - (frame.lat1 - frame.lat0) * base) / 2;
  const px = (s: { lng: number }) => (ox + (s.lng - frame.lng0) * frame.k * base) * z;
  const py = (s: { lat: number }) => (oy + (frame.lat1 - s.lat) * base) * z;

  const inView = (s: School) => {
    const x = px(s);
    const y = py(s);
    return x >= 0 && y >= 0 && x <= cw && y <= ch;
  };
  // 그리는 순서: 공립 → 국립 → 사립 (사립이 위에 보이도록)
  const ordered = useMemo(() => {
    const rank = { p: 0, n: 1, s: 2 } as const;
    return [...schools].sort((a, b) => rank[a.found] - rank[b.found]);
  }, [schools]);

  const labels = useMemo(() => {
    if (!showSigungu) return [];
    const by = new Map<string, School[]>();
    for (const s of frameFrom) {
      if (!s.sigungu) continue;
      by.set(s.sigungu, [...(by.get(s.sigungu) ?? []), s]);
    }
    const mid = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    return [...by.entries()]
      .filter(([, xs]) => xs.length >= 3)
      .map(([name, xs]) => ({ name, lat: mid(xs.map((s) => s.lat)), lng: mid(xs.map((s) => s.lng)) }));
  }, [frameFrom, showSigungu]);
  const showLabels = labels.length > 0 && (labels.length <= 14 || z >= 2);

  const scrollTo = (x: number, y: number) => {
    const cx = Math.max(0, Math.min(x, cw - vw));
    const cy = Math.max(0, Math.min(y, ch - vh));
    hRef.current?.scrollTo({ x: cx, animated: false });
    vRef.current?.scrollTo({ y: cy, animated: false });
    off.current = { x: cx, y: cy };
  };

  const setZoom = (next: number, center?: { x: number; y: number }) => {
    const nz = ZOOMS[next];
    const c = center ?? { x: (off.current.x + vw / 2) / z, y: (off.current.y + vh / 2) / z }; // 1배 기준 좌표
    setZi(next);
    const ncw = vw * nz;
    const nch = vh * nz;
    requestAnimationFrame(() => {
      const x = Math.max(0, Math.min(c.x * nz - vw / 2, ncw - vw));
      const y = Math.max(0, Math.min(c.y * nz - vh / 2, nch - vh));
      hRef.current?.scrollTo({ x, animated: false });
      vRef.current?.scrollTo({ y, animated: false });
      off.current = { x, y };
    });
  };

  useImperativeHandle(ref, () => ({
    focus: (s: School) => {
      const next = Math.max(zi, 2);
      setZoom(next, { x: px(s) / z, y: py(s) / z });
    },
  }));

  const onTap = (e: GestureResponderEvent) => {
    const { locationX: x, locationY: y } = e.nativeEvent;
    let best: School | null = null;
    let bd = TAP_RADIUS * TAP_RADIUS;
    for (const s of schools) {
      const d = (px(s) - x) ** 2 + (py(s) - y) ** 2;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    onSelect(best);
  };

  const r = 2.6 + z * 0.6; // 점 크기 (확대하면 조금 커짐)
  const mark = (s: School, key: string, size: number, ring: string, ringW: number) => {
    const x = px(s);
    const y = py(s);
    const fill = colorOf(s.found);
    if (s.found === 's')
      return <Rect key={key} x={x - size} y={y - size} width={size * 2} height={size * 2} rx={1} fill={fill} stroke={ring} strokeWidth={ringW} />;
    if (s.found === 'n')
      return (
        <Polygon
          key={key}
          points={`${x},${y - size * 1.25} ${x + size * 1.25},${y} ${x},${y + size * 1.25} ${x - size * 1.25},${y}`}
          fill={fill}
          stroke={ring}
          strokeWidth={ringW}
        />
      );
    return <Circle key={key} cx={x} cy={y} r={size} fill={fill} stroke={ring} strokeWidth={ringW} />;
  };

  // 점 수천 개는 선택이 바뀔 때 다시 그리지 않도록 기억
  const dots = useMemo(
    () => ordered.map((s, i) => mark(s, `s-${i}`, r, colors.surface, 0.8)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ordered, z, vw, vh, frame, colors],
  );

  const onLayout = (e: LayoutChangeEvent) => setVw(Math.floor(e.nativeEvent.layout.width));
  const onH = (e: NativeSyntheticEvent<NativeScrollEvent>) => (off.current.x = e.nativeEvent.contentOffset.x);
  const onV = (e: NativeSyntheticEvent<NativeScrollEvent>) => (off.current.y = e.nativeEvent.contentOffset.y);
  const outside = frameFrom.filter((s) => !inView(s)).length; // 확대 1배에서 틀 밖(먼 섬)

  return (
    <View onLayout={onLayout} style={{ gap: space.xs }}>
      {vw > 0 && (
        <View
          style={{
            width: vw,
            height: vh,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.surface,
            overflow: 'hidden',
          }}
        >
          <ScrollView
            ref={hRef}
            horizontal
            nestedScrollEnabled
            scrollEnabled={z > 1}
            showsHorizontalScrollIndicator={false}
            onScroll={onH}
            scrollEventThrottle={32}
          >
            <ScrollView
              ref={vRef}
              nestedScrollEnabled
              scrollEnabled={z > 1}
              style={{ width: cw, height: vh }}
              showsVerticalScrollIndicator={false}
              onScroll={onV}
              scrollEventThrottle={32}
            >
              <Pressable onPress={onTap} accessibilityLabel="학교 지도. 점을 누르면 학교 이름이 보입니다">
                <Svg width={cw} height={ch}>
                  {showLabels &&
                    labels.map((l) => (
                      <SvgText
                        key={`t-${l.name}`}
                        x={px(l)}
                        y={py(l) - r - 6}
                        fontSize={11}
                        fontWeight="600"
                        fill={colors.textSub}
                        textAnchor="middle"
                        opacity={0.85}
                      >
                        {l.name}
                      </SvgText>
                    ))}
                  {dots}
                  {selected && mark(selected, 'sel', r + 3, colors.text, 2.5)}
                </Svg>
              </Pressable>
            </ScrollView>
          </ScrollView>

          {/* 확대·축소 버튼 */}
          <View style={{ position: 'absolute', right: space.sm, top: space.sm, gap: space.xs }}>
            {[
              { icon: 'add' as const, label: '확대', on: () => zi < ZOOMS.length - 1 && setZoom(zi + 1), dis: zi >= ZOOMS.length - 1 },
              { icon: 'remove' as const, label: '축소', on: () => zi > 0 && setZoom(zi - 1), dis: zi === 0 },
            ].map((b) => (
              <Pressable
                key={b.icon}
                onPress={b.on}
                accessibilityRole="button"
                accessibilityLabel={b.label}
                hitSlop={6}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.line,
                  opacity: b.dis ? 0.4 : 1,
                }}
              >
                <Ionicons name={b.icon} size={22} color={colors.text} />
              </Pressable>
            ))}
          </View>
          {z > 1 && (
            <View
              style={{
                position: 'absolute',
                left: space.sm,
                top: space.sm,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: radius.pill,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Txt variant="sub">{z}배 · 끌어서 이동</Txt>
            </View>
          )}
        </View>
      )}
      {zi === 0 && outside > 0 && <Txt variant="sub">멀리 떨어진 섬 지역 {outside}곳은 지도 틀 밖에 있어요 (아래 목록에는 포함)</Txt>}
    </View>
  );
});
