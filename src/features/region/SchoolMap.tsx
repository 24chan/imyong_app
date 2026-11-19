import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Animated, GestureResponderEvent, LayoutChangeEvent, PanResponder, Pressable, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { Txt } from '../../components/ui';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { School, SchoolFound } from '../../types/data';
import { REGION_PATHS } from './mapData';

const MAX_ZOOM = 8;
const TAP_PX = 22; // 이 거리(화면 px) 안의 가장 가까운 학교를 선택

/**
 * 위도·경도 → 시도 경계 지도(svg-maps) 좌표.
 * 전국 학교 1만2천 곳이 자기 시도 경계 안에 들어오는 비율이 가장 높게(95%) 맞춘 값 (메르카토르 위도)
 */
const PROJ = { a: 93.8341793103451, b: -11762.79245517245, c: -93.51095648746927, d: 3922.9256792641027 };
const merc = (lat: number) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
const px = (lng: number) => PROJ.a * lng + PROJ.b;
const py = (lat: number) => PROJ.c * merc(lat) + PROJ.d;

/** svg-maps 경로(m·z, 상대 좌표)를 점 목록으로 */
function pathPoints(d: string): [number, number][][] {
  const t = d.match(/[mMzZ]|-?[\d.]+(?:e-?\d+)?/g) ?? [];
  const out: [number, number][][] = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let first = true;
  let cmd = 'm';
  let sub: [number, number][] = [];
  while (i < t.length) {
    const k = t[i];
    if (k === 'm' || k === 'M') {
      cmd = k;
      i++;
      let x = +t[i++];
      let y = +t[i++];
      if (k === 'm' && !first) {
        x += cx;
        y += cy;
      }
      cx = sx = x;
      cy = sy = y;
      first = false;
      if (sub.length) out.push(sub);
      sub = [[cx, cy]];
      continue;
    }
    if (k === 'z' || k === 'Z') {
      i++;
      cx = sx;
      cy = sy;
      continue;
    }
    const x = +t[i++];
    const y = +t[i++];
    if (cmd === 'M') {
      cx = x;
      cy = y;
    } else {
      cx += x;
      cy += y;
    }
    sub.push([cx, cy]);
  }
  if (sub.length) out.push(sub);
  return out;
}

export type SchoolMapHandle = { focus: (s: School) => void };

type Props = {
  region: string;
  schools: School[]; // 지도에 그릴 학교 (이미 필터된 것)
  frameFrom: School[]; // 틀·시군구 이름 위치 계산용 (학교급 전체)
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

type Touch = { locationX: number; locationY: number };
const dist = (a: Touch, b: Touch) => Math.hypot(a.locationX - b.locationX, a.locationY - b.locationY);

/**
 * 지역 학교 지도: 시도 경계선 + 학교 점.
 * 두 손가락으로 오므렸다 펴서 확대·축소, 확대한 뒤 한 손가락으로 이동, 점을 누르면 학교 선택.
 */
export const SchoolMap = forwardRef<SchoolMapHandle, Props>(function SchoolMap(
  { region, schools, frameFrom, selected, onSelect, showSigungu },
  ref,
) {
  const { colors } = useTheme();
  const colorOf = useFoundColor();
  const win = useWindowDimensions();
  const [cw, setCw] = useState(0);

  // 시도 경계 (가장 큰 덩어리로 틀을 잡고, 섬은 그리기만)
  const outline = useMemo(() => {
    const path = REGION_PATHS.find((r) => r.code === region)?.path ?? '';
    const subs = pathPoints(path);
    const area = (s: [number, number][]) =>
      Math.abs(
        s.reduce((a, p, i) => {
          const q = s[(i + 1) % s.length];
          return a + p[0] * q[1] - q[0] * p[1];
        }, 0) / 2,
      );
    const main = [...subs].sort((x, y) => area(y) - area(x))[0] ?? [];
    return { path, main };
  }, [region]);

  // 화면 틀: 본토 경계 + 학교(1~99%) 범위
  const frame = useMemo(() => {
    const xs = outline.main.map((p) => p[0]);
    const ys = outline.main.map((p) => p[1]);
    const pts = frameFrom.map((s) => [px(s.lng), py(s.lat)]);
    const q = (a: number[], p: number) => {
      const s = [...a].sort((u, v) => u - v);
      return s[Math.round((s.length - 1) * p)];
    };
    if (pts.length > 20) {
      xs.push(q(pts.map((p) => p[0]), 0.01), q(pts.map((p) => p[0]), 0.99));
      ys.push(q(pts.map((p) => p[1]), 0.01), q(pts.map((p) => p[1]), 0.99));
    }
    if (!xs.length) return { x: 0, y: 0, w: 1, h: 1 };
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    const pad = Math.max(x1 - x0, y1 - y0) * 0.05;
    return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
  }, [outline, frameFrom]);

  // 화면 크기: 폭에 맞추되 높이는 화면의 60%를 넘지 않게 (태블릿에서도 한눈에)
  const maxW = Math.min(cw, 760);
  const maxH = Math.max(260, win.height * 0.6);
  const k = Math.min(maxW / frame.w, maxH / frame.h); // 지도 1단위 = k px
  const W = Math.max(1, Math.round(frame.w * k));
  const H = Math.max(1, Math.round(frame.h * k));

  // 확대·이동: 화면 = 가운데 + s·(점 - 가운데) + t
  const [zoom, setZoom] = useState(1); // 손을 뗀 뒤 배율 (점 크기 다시 계산용)
  const live = useRef({ s: 1, tx: 0, ty: 0 });
  const aS = useRef(new Animated.Value(1)).current;
  const aX = useRef(new Animated.Value(0)).current;
  const aY = useRef(new Animated.Value(0)).current;

  const apply = (s: number, tx: number, ty: number) => {
    const sc = Math.min(MAX_ZOOM, Math.max(1, s));
    const limX = ((sc - 1) * W) / 2;
    const limY = ((sc - 1) * H) / 2;
    const x = Math.min(limX, Math.max(-limX, tx));
    const y = Math.min(limY, Math.max(-limY, ty));
    live.current = { s: sc, tx: x, ty: y };
    aS.setValue(sc);
    aX.setValue(x);
    aY.setValue(y);
  };
  const commit = () => setZoom(live.current.s);

  // 화면 좌표 → 지도 좌표
  const toMap = (sx: number, sy: number) => {
    const { s, tx, ty } = live.current;
    const bx = W / 2 + (sx - W / 2 - tx) / s;
    const by = H / 2 + (sy - H / 2 - ty) / s;
    return { x: frame.x + bx / k, y: frame.y + by / k };
  };

  const pickAt = (sx: number, sy: number) => {
    const m = toMap(sx, sy);
    const lim = TAP_PX / (k * live.current.s);
    let best: School | null = null;
    let bd = lim * lim;
    for (const s of schools) {
      const d = (px(s.lng) - m.x) ** 2 + (py(s.lat) - m.y) ** 2;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    onSelect(best);
  };

  const g = useRef({ mode: 'none' as 'none' | 'pan' | 'pinch', s0: 1, tx0: 0, ty0: 0, d0: 1, mx0: 0, my0: 0, x0: 0, y0: 0, t0: 0, moved: false });

  // 매 렌더의 최신 함수 사용 (PanResponder 는 한 번만 만듦)
  const fns = useRef({ apply, commit, pickAt, W, H });
  fns.current = { apply, commit, pickAt, W, H };

  const responder = useRef(
    PanResponder.create({
      // 두 손가락이거나 확대된 상태에서만 지도가 손가락을 가져감 (1배 한 손가락은 화면 스크롤)
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length >= 2 || live.current.s > 1.01,
      onMoveShouldSetPanResponderCapture: (e) => e.nativeEvent.touches.length >= 2 || live.current.s > 1.01,
      onPanResponderTerminationRequest: () => live.current.s <= 1.01 && g.current.mode !== 'pinch',
      onPanResponderGrant: (e) => {
        const st = g.current;
        st.t0 = Date.now();
        st.moved = false;
        st.mode = 'none';
        st.x0 = e.nativeEvent.locationX;
        st.y0 = e.nativeEvent.locationY;
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const { apply: ap, W: w, H: h } = fns.current;
        const t = e.nativeEvent.touches;
        const st = g.current;
        const cur = live.current;
        if (t.length >= 2) {
          const mx = (t[0].locationX + t[1].locationX) / 2;
          const my = (t[0].locationY + t[1].locationY) / 2;
          const d = Math.max(10, dist(t[0], t[1]));
          if (st.mode !== 'pinch') {
            st.mode = 'pinch';
            Object.assign(st, { s0: cur.s, tx0: cur.tx, ty0: cur.ty, d0: d, mx0: mx, my0: my });
          }
          const s = Math.min(MAX_ZOOM, Math.max(1, (st.s0 * d) / st.d0));
          // 처음 두 손가락 가운데 있던 지점이 계속 손가락 가운데에 오도록
          const qx = w / 2 + (st.mx0 - w / 2 - st.tx0) / st.s0;
          const qy = h / 2 + (st.my0 - h / 2 - st.ty0) / st.s0;
          ap(s, mx - w / 2 - s * (qx - w / 2), my - h / 2 - s * (qy - h / 2));
          st.moved = true;
        } else if (t.length === 1) {
          const x = t[0].locationX;
          const y = t[0].locationY;
          if (st.mode !== 'pan') {
            // 처음 또는 두 손가락 → 한 손가락으로 바뀐 시점부터 이어서 이동
            if (st.mode === 'pinch') st.moved = true;
            st.mode = 'pan';
            st.tx0 = cur.tx;
            st.ty0 = cur.ty;
            st.x0 = x;
            st.y0 = y;
          }
          if (Math.hypot(x - st.x0, y - st.y0) > 6) st.moved = true;
          if (cur.s > 1.01) ap(cur.s, st.tx0 + (x - st.x0), st.ty0 + (y - st.y0));
        }
      },
      onPanResponderRelease: (e) => {
        const st = g.current;
        if (!st.moved && Date.now() - st.t0 < 400) fns.current.pickAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
        st.mode = 'none';
        fns.current.commit();
      },
      onPanResponderTerminate: () => {
        g.current.mode = 'none';
        fns.current.commit();
      },
    }),
  ).current;

  const zoomTo = (s: number, mapX?: number, mapY?: number) => {
    const cur = live.current;
    let qx: number;
    let qy: number;
    if (mapX != null && mapY != null) {
      qx = (mapX - frame.x) * k;
      qy = (mapY - frame.y) * k;
    } else {
      // 지금 화면 가운데 기준
      qx = W / 2 - cur.tx / cur.s;
      qy = H / 2 - cur.ty / cur.s;
    }
    apply(s, -s * (qx - W / 2), -s * (qy - H / 2));
    commit();
  };

  useImperativeHandle(ref, () => ({
    focus: (s: School) => zoomTo(Math.max(live.current.s, 3), px(s.lng), py(s.lat)),
  }));

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
      .map(([name, xs]) => ({ name, x: mid(xs.map((s) => px(s.lng))), y: mid(xs.map((s) => py(s.lat))) }));
  }, [frameFrom, showSigungu]);
  const showLabels = labels.length > 0 && (labels.length <= 14 || zoom >= 2);

  // 화면에서 보이는 크기를 일정하게: 지도 단위 = 화면 px / (k·배율)
  const u = 1 / (k * zoom);
  const r = (3 + Math.min(zoom, 4) * 0.5) * u;
  const mark = (s: School, key: string, size: number, ring: string, ringW: number) => {
    const x = px(s.lng);
    const y = py(s.lat);
    const fill = colorOf(s.found);
    if (s.found === 's')
      return <Rect key={key} x={x - size} y={y - size} width={size * 2} height={size * 2} fill={fill} stroke={ring} strokeWidth={ringW} />;
    if (s.found === 'n')
      return (
        <Polygon
          key={key}
          points={`${x},${y - size * 1.3} ${x + size * 1.3},${y} ${x},${y + size * 1.3} ${x - size * 1.3},${y}`}
          fill={fill}
          stroke={ring}
          strokeWidth={ringW}
        />
      );
    return <Circle key={key} cx={x} cy={y} r={size} fill={fill} stroke={ring} strokeWidth={ringW} />;
  };
  const dots = useMemo(
    () => ordered.map((s, i) => mark(s, `s-${i}`, r, colors.background, 0.8 * u)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ordered, zoom, k, colors],
  );

  const onLayout = (e: LayoutChangeEvent) => setCw(Math.floor(e.nativeEvent.layout.width));
  const viewBox = `${frame.x} ${frame.y} ${frame.w} ${frame.h}`;

  return (
    <View onLayout={onLayout} style={{ gap: space.xs, alignItems: 'center' }}>
      {cw > 0 && (
        <View
          style={{
            width: W,
            height: H,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.surface,
            overflow: 'hidden',
          }}
        >
          <View style={{ width: W, height: H }} {...responder.panHandlers} accessibilityLabel="학교 지도. 두 손가락으로 확대, 점을 누르면 학교 이름">
            <Animated.View pointerEvents="none" style={{ width: W, height: H, transform: [{ translateX: aX }, { translateY: aY }, { scale: aS }] }}>
              <Svg width={W} height={H} viewBox={viewBox}>
                <Path d={outline.path} fill={colors.background} stroke={colors.textSub} strokeOpacity={0.5} strokeWidth={1.2 * u} strokeLinejoin="round" />
                {showLabels &&
                  labels.map((l) => (
                    <SvgText key={`t-${l.name}`} x={l.x} y={l.y - r - 5 * u} fontSize={11 * u} fontWeight="600" fill={colors.textSub} textAnchor="middle" opacity={0.9}>
                      {l.name}
                    </SvgText>
                  ))}
                {dots}
                {selected && mark(selected, 'sel', r + 3 * u, colors.text, 2.2 * u)}
              </Svg>
            </Animated.View>
          </View>

          {/* 확대·축소 버튼 (두 손가락 대신 써도 됨) */}
          <View style={{ position: 'absolute', right: space.sm, top: space.sm, gap: space.xs }}>
            {[
              { icon: 'add' as const, label: '확대', on: () => zoomTo(Math.min(MAX_ZOOM, live.current.s * 2)), dis: zoom >= MAX_ZOOM },
              { icon: 'remove' as const, label: '축소', on: () => zoomTo(Math.max(1, live.current.s / 2)), dis: zoom <= 1 },
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
          {zoom > 1.01 && (
            <Pressable
              onPress={() => zoomTo(1)}
              style={{
                position: 'absolute',
                left: space.sm,
                top: space.sm,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: radius.pill,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Txt variant="sub">{zoom.toFixed(1)}배 · 전체 보기</Txt>
            </Pressable>
          )}
        </View>
      )}
      <Txt variant="sub" style={{ alignSelf: 'stretch' }}>
        두 손가락으로 오므렸다 펴서 확대·축소, 확대한 뒤 끌어서 이동해요. 점을 누르면 학교 이름이 보여요.
      </Txt>
    </View>
  );
});
