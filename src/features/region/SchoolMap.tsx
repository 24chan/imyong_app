import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, GestureResponderEvent, LayoutChangeEvent, PanResponder, Pressable, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { Txt } from '../../components/ui';
import { getRegionDong, getRegionGeo, RegionDong, RegionGeo } from '../../data/repository';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { School, SchoolFound } from '../../types/data';

const MAX_ZOOM = 12; // 처음 화면 대비 최대 확대
const TAP_PX = 22;
const DONG_ZOOM = 2.2; // 이만큼 확대하면 읍면동 경계·이름

type Shape = { key: string; name: string; d: string; lx: number; ly: number; bw: number; x0: number; x1: number; y0: number; y1: number };
// 경계 → 지도 경로 + 이름 위치(자료에 있으면 그 점, 없으면 가장 큰 덩어리 가운데) + 범위
function toShapes(items: { n: string; c?: [number, number] | null; p: [number, number][][] }[], pre: string): Shape[] {
  return items.map((f, i) => {
    let best: [number, number][] = f.p[0] ?? [];
    let bestArea = 0;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const d = f.p
      .map((ring) => {
        let a = 0;
        for (let j = 0; j < ring.length - 1; j++) a += ring[j][0] * ring[j + 1][1] - ring[j + 1][0] * ring[j][1];
        if (Math.abs(a) > bestArea) {
          bestArea = Math.abs(a);
          best = ring;
        }
        return (
          'M' +
          ring
            .map(([lng, lat]) => {
              const x = X(lng), y = Y(lat);
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
              return `${x.toFixed(4)},${y.toFixed(4)}`;
            })
            .join('L') +
          'Z'
        );
      })
      .join('');
    const xs = best.map((p) => X(p[0]));
    const ys = best.map((p) => Y(p[1]));
    const bx0 = Math.min(...xs), bx1 = Math.max(...xs), by0 = Math.min(...ys), by1 = Math.max(...ys);
    const lx = f.c ? X(f.c[0]) : (bx0 + bx1) / 2;
    const ly = f.c ? Y(f.c[1]) : (by0 + by1) / 2;
    return { key: `${pre}${f.n}-${i}`, name: f.n, d, lx, ly, bw: bx1 - bx0, x0, x1, y0, y1 };
  });
}

// 지도 좌표: 경도 그대로, 위도는 메르카토르 (단위 = 도). 위아래가 같은 비율로 보임
const merc = (lat: number) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
const X = (lng: number) => lng;
const Y = (lat: number) => -merc(lat);

export type SchoolMapHandle = { focus: (s: School) => void };

type Props = {
  region: string;
  schools: School[]; // 지도에 그릴 학교 (이미 필터된 것)
  frameFrom: School[]; // 처음 화면 범위 계산용 (학교급 전체)
  selected: School | null;
  onSelect: (s: School | null) => void;
  showSigungu: boolean;
};

/** 설립별 색 (토큰만 사용) */
export function useFoundColor() {
  const { colors } = useTheme();
  return (f: SchoolFound) => (f === 'p' ? colors.brand : f === 's' ? colors.accent : colors.textSub);
}

/** 범례·목록에 쓰는 작은 모양: 공립 ●, 사립 ■, 국립 ◆ */
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

type View4 = { x: number; y: number; w: number; h: number };
type Touch = { locationX: number; locationY: number };
const dist = (a: Touch, b: Touch) => Math.hypot(a.locationX - b.locationX, a.locationY - b.locationY);

/**
 * 지역 학교 지도: 시군구 경계(통계청 행정구역 기반) 위에 학교 점.
 * 두 손가락으로 확대·축소, 끌어서 이동. 손을 떼면 그 배율로 다시 그려서 확대해도 선명함.
 */
export const SchoolMap = forwardRef<SchoolMapHandle, Props>(function SchoolMap({ region, schools, frameFrom, selected, onSelect, showSigungu }, ref) {
  const { colors } = useTheme();
  const colorOf = useFoundColor();
  const win = useWindowDimensions();
  const [cw, setCw] = useState(0);
  const [geo, setGeo] = useState<RegionGeo | null | undefined>(undefined);

  useEffect(() => {
    setGeo(undefined);
    getRegionGeo(region).then(setGeo);
  }, [region]);

  const shapes = useMemo(() => (geo ? toShapes(geo.sgg, 'g') : []), [geo]);
  const [dong, setDong] = useState<RegionDong | null | undefined>(undefined);
  useEffect(() => setDong(undefined), [region]);
  const dongShapes = useMemo(() => (dong ? toShapes(dong.dong, 'd') : []), [dong]);

  // 전체 범위(경계+학교)와 처음 화면(학교 2~98% 범위)
  const extent = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    geo?.sgg.forEach((f) => f.p.forEach((r) => r.forEach(([lng, lat]) => (xs.push(X(lng)), ys.push(Y(lat))))));
    frameFrom.forEach((s) => (xs.push(X(s.lng)), ys.push(Y(s.lat))));
    if (!xs.length) return { x: 126, y: -40, w: 1, h: 1 };
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }, [geo, frameFrom]);
  const initial = useMemo(() => {
    const q = (a: number[], p: number) => {
      const s = [...a].sort((u, v) => u - v);
      return s[Math.round((s.length - 1) * p)];
    };
    if (frameFrom.length < 5) return extent;
    const xs = frameFrom.map((s) => X(s.lng));
    const ys = frameFrom.map((s) => Y(s.lat));
    const x0 = q(xs, 0.02), x1 = q(xs, 0.98), y0 = q(ys, 0.02), y1 = q(ys, 0.98);
    const pad = Math.max(x1 - x0, y1 - y0) * 0.08;
    return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
  }, [frameFrom, extent]);

  // 화면 크기: 처음 화면 비율, 폭 최대 760, 높이는 화면의 62% 이하
  const maxW = Math.min(cw, 760);
  const maxH = Math.max(280, win.height * 0.62);
  const aspect = initial.h / initial.w;
  const W = Math.max(1, Math.round(Math.min(maxW, maxH / aspect)));
  const H = Math.max(1, Math.round(W * aspect));

  const fit = (v: { x: number; y: number; w: number; h: number }): View4 => {
    // 화면 비율에 맞추고(가운데 기준) 줌 범위·전체 범위 안으로
    const cx = v.x + v.w / 2;
    const cy = v.y + v.h / 2;
    let w = Math.max(v.w, v.h * (W / H));
    const minW = initial.w / MAX_ZOOM;
    const maxWw = Math.max(extent.w, extent.h * (W / H), initial.w) * 1.1;
    w = Math.min(maxWw, Math.max(minW, w));
    const h = w * (H / W);
    const ex0 = extent.x - w * 0.3, ex1 = extent.x + extent.w + w * 0.3;
    const ey0 = extent.y - h * 0.3, ey1 = extent.y + extent.h + h * 0.3;
    const x = Math.min(Math.max(cx - w / 2, ex0), Math.max(ex0, ex1 - w));
    const y = Math.min(Math.max(cy - h / 2, ey0), Math.max(ey0, ey1 - h));
    return { x, y, w, h };
  };

  const [view, setView] = useState<View4>(() => initial);
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    if (W > 1) setView(fit(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, W, H]);

  const k = W / view.w; // 지도 1단위 = k px
  const zoom = initial.w / view.w;
  const showDong = zoom >= DONG_ZOOM;
  useEffect(() => {
    if (showDong && dong === undefined) getRegionDong(region).then(setDong);
  }, [showDong, dong, region]);

  // 손가락으로 움직이는 동안만 화면 변형(빠름) → 떼면 그 배율로 다시 그림(선명)
  const live = useRef({ s: 1, tx: 0, ty: 0 });
  const aS = useRef(new Animated.Value(1)).current;
  const aX = useRef(new Animated.Value(0)).current;
  const aY = useRef(new Animated.Value(0)).current;
  const setLive = (s: number, tx: number, ty: number) => {
    live.current = { s, tx, ty };
    aS.setValue(s);
    aX.setValue(tx);
    aY.setValue(ty);
  };
  useLayoutEffect(() => setLive(1, 0, 0), [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => {
    const { s, tx, ty } = live.current;
    if (s === 1 && tx === 0 && ty === 0) return;
    const v = viewRef.current;
    const kk = W / v.w;
    // 화면 왼쪽 위(0,0)가 가리키는 지도 좌표
    const x = v.x + (W / 2 + (0 - W / 2 - tx) / s) / kk;
    const y = v.y + (H / 2 + (0 - H / 2 - ty) / s) / kk;
    setView(fit({ x, y, w: v.w / s, h: v.h / s }));
  };

  const pickAt = (sx: number, sy: number) => {
    const v = viewRef.current;
    const kk = W / v.w;
    const mx = v.x + sx / kk;
    const my = v.y + sy / kk;
    const lim = TAP_PX / kk;
    let best: School | null = null;
    let bd = lim * lim;
    for (const s of fns.current.schools) {
      const d = (X(s.lng) - mx) ** 2 + (Y(s.lat) - my) ** 2;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    onSelect(best);
  };

  const fns = useRef({ commit, pickAt, schools, W, H });
  fns.current = { commit, pickAt, schools, W, H };
  const g = useRef({ mode: 'none' as 'none' | 'pan' | 'pinch', s0: 1, tx0: 0, ty0: 0, d0: 1, mx0: 0, my0: 0, x0: 0, y0: 0, t0: 0, moved: false });

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: (e) => e.nativeEvent.touches.length >= 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const st = g.current;
        st.t0 = Date.now();
        st.moved = false;
        st.mode = 'none';
        st.x0 = e.nativeEvent.locationX;
        st.y0 = e.nativeEvent.locationY;
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const { W: w, H: h } = fns.current;
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
          const s = Math.min(8, Math.max(0.25, (st.s0 * d) / st.d0));
          const qx = w / 2 + (st.mx0 - w / 2 - st.tx0) / st.s0;
          const qy = h / 2 + (st.my0 - h / 2 - st.ty0) / st.s0;
          setLive(s, mx - w / 2 - s * (qx - w / 2), my - h / 2 - s * (qy - h / 2));
          st.moved = true;
        } else if (t.length === 1) {
          const x = t[0].locationX;
          const y = t[0].locationY;
          if (st.mode !== 'pan') {
            if (st.mode === 'pinch') st.moved = true;
            st.mode = 'pan';
            st.tx0 = cur.tx;
            st.ty0 = cur.ty;
            st.x0 = x;
            st.y0 = y;
          }
          if (Math.hypot(x - st.x0, y - st.y0) > 6) st.moved = true;
          if (st.moved) setLive(cur.s, st.tx0 + (x - st.x0), st.ty0 + (y - st.y0));
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

  const zoomBy = (f: number) => {
    const v = viewRef.current;
    setView(fit({ x: v.x + (v.w - v.w / f) / 2, y: v.y + (v.h - v.h / f) / 2, w: v.w / f, h: v.h / f }));
  };
  useImperativeHandle(ref, () => ({
    focus: (s: School) => {
      const w = Math.min(viewRef.current.w, initial.w / 4);
      const h = w * (H / W);
      setView(fit({ x: X(s.lng) - w / 2, y: Y(s.lat) - h / 2, w, h }));
    },
  }));

  const ordered = useMemo(() => {
    const rank = { p: 0, n: 1, s: 2 } as const;
    return [...schools].sort((a, b) => rank[a.found] - rank[b.found]);
  }, [schools]);

  const u = 1 / k; // 화면 1px 의 지도 길이
  const r = (zoom >= 3 ? 4.5 : 3.6) * u;
  const mark = (s: School, key: string, size: number, ring: string, ringW: number) => {
    const x = X(s.lng);
    const y = Y(s.lat);
    const fill = colorOf(s.found);
    if (s.found === 's') return <Rect key={key} x={x - size} y={y - size} width={size * 2} height={size * 2} rx={size * 0.25} fill={fill} stroke={ring} strokeWidth={ringW} />;
    if (s.found === 'n')
      return <Polygon key={key} points={`${x},${y - size * 1.35} ${x + size * 1.35},${y} ${x},${y + size * 1.35} ${x - size * 1.35},${y}`} fill={fill} stroke={ring} strokeWidth={ringW} />;
    return <Circle key={key} cx={x} cy={y} r={size} fill={fill} stroke={ring} strokeWidth={ringW} />;
  };
  // 화면 밖 점은 그리지 않음 (확대했을 때 빠르게)
  const pad = 20 * u;
  const visible = ordered.filter((s) => {
    const x = X(s.lng);
    const y = Y(s.lat);
    return x > view.x - pad && x < view.x + view.w + pad && y > view.y - pad && y < view.y + view.h + pad;
  });
  const dots = visible.map((s, i) => mark(s, `s-${i}`, r, colors.background, 1.2 * u));
  // 화면 안 읍면동 경계만
  const inView = (sh: Shape) => sh.x1 > view.x && sh.x0 < view.x + view.w && sh.y1 > view.y && sh.y0 < view.y + view.h;
  const dongVisible = showDong ? dongShapes.filter(inView) : [];

  // 이름표: 화면 좌표(px)로 따로 그림. 시군구 먼저, 확대하면 읍면동. 겹치면 생략
  const labels = useMemo(() => {
    const out: { key: string; x: number; y: number; t: string; big: boolean }[] = [];
    const boxes: [number, number, number, number][] = [];
    const put = (sh: Shape, big: boolean, minW: number) => {
      const x = (sh.lx - view.x) * k;
      const y = (sh.ly - view.y) * k;
      if (x < 0 || x > W || y < 0 || y > H || sh.bw * k < minW) return;
      const fsz = big ? 13 : 10.5;
      const hw = (sh.name.length * fsz * 0.95) / 2 + 3;
      const hh = fsz * 0.75;
      const box: [number, number, number, number] = [x - hw, y - hh, x + hw, y + hh];
      if (boxes.some((o) => o[0] < box[2] && box[0] < o[2] && o[1] < box[3] && box[1] < o[3])) return;
      boxes.push(box);
      out.push({ key: sh.key, x, y, t: sh.name, big });
    };
    if (showSigungu) shapes.forEach((sh) => put(sh, true, 30));
    dongVisible.forEach((sh) => put(sh, false, 24));
    return out;
  }, [shapes, dongVisible, view, k, W, H, showSigungu]); // eslint-disable-line react-hooks/exhaustive-deps

  const onLayout = (e: LayoutChangeEvent) => setCw(Math.floor(e.nativeEvent.layout.width));

  return (
    <View onLayout={onLayout} style={{ gap: space.xs, alignItems: 'center' }}>
      {cw > 0 && (
        <View style={{ width: W, height: H, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: 'hidden' }}>
          <View style={{ width: W, height: H }} {...responder.panHandlers} accessibilityLabel="학교 지도. 두 손가락으로 확대, 점을 누르면 학교 이름">
            <Animated.View pointerEvents="none" style={{ width: W, height: H, transform: [{ translateX: aX }, { translateY: aY }, { scale: aS }] }}>
              <Svg width={W} height={H} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}>
                {shapes.map((s, i) => (
                  <Path key={s.key} d={s.d} fill={i % 2 ? colors.background : colors.brand + '0D'} />
                ))}
                {dongVisible.map((sh) => (
                  <Path key={sh.key} d={sh.d} fill="none" stroke={colors.textSub} strokeOpacity={0.22} strokeWidth={0.7 * u} strokeDasharray={`${3 * u},${2 * u}`} />
                ))}
                {shapes.map((s) => (
                  <Path key={`o-${s.key}`} d={s.d} fill="none" stroke={colors.textSub} strokeOpacity={0.45} strokeWidth={1.1 * u} strokeLinejoin="round" />
                ))}
                <G>{dots}</G>
                {selected && mark(selected, 'sel', r + 3 * u, colors.text, 2.4 * u)}
              </Svg>
              {/* 이름표는 화면 픽셀 좌표로 (아주 작은 글자 크기는 안드로이드에서 안 그려짐) */}
              <Svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
                {labels.map((l) => (
                  <G key={`t-${l.key}`}>
                    <SvgText x={l.x} y={l.y + (l.big ? 4.5 : 3.5)} fontSize={l.big ? 13 : 10.5} fontWeight={l.big ? '700' : '500'} textAnchor="middle" stroke={colors.background} strokeWidth={3.5} strokeLinejoin="round" fill={colors.background}>
                      {l.t}
                    </SvgText>
                    <SvgText x={l.x} y={l.y + (l.big ? 4.5 : 3.5)} fontSize={l.big ? 13 : 10.5} fontWeight={l.big ? '700' : '500'} textAnchor="middle" fill={l.big ? colors.text : colors.textSub}>
                      {l.t}
                    </SvgText>
                  </G>
                ))}
              </Svg>
            </Animated.View>
          </View>
          {geo === undefined && <ActivityIndicator color={colors.brand} style={{ position: 'absolute', top: H / 2 - 10, left: W / 2 - 10 }} />}

          <View style={{ position: 'absolute', right: space.sm, top: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.background, overflow: 'hidden' }}>
            {[
              { icon: 'add' as const, label: '확대', on: () => zoomBy(2), dis: zoom >= MAX_ZOOM - 0.01 },
              { icon: 'remove' as const, label: '축소', on: () => zoomBy(0.5), dis: false },
            ].map((b, i) => (
              <Pressable
                key={b.icon}
                onPress={b.on}
                disabled={b.dis}
                accessibilityRole="button"
                accessibilityLabel={b.label}
                style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderTopWidth: i ? 1 : 0, borderTopColor: colors.line, opacity: b.dis ? 0.35 : 1 }}
              >
                <Ionicons name={b.icon} size={22} color={colors.text} />
              </Pressable>
            ))}
          </View>
          {Math.abs(zoom - 1) > 0.05 && (
            <Pressable
              onPress={() => setView(fit(initial))}
              style={{ position: 'absolute', left: space.sm, top: space.sm, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line }}
            >
              <Ionicons name="scan-outline" size={14} color={colors.text} />
              <Txt variant="sub" color="text" style={{ fontWeight: '700' }}>
                처음 화면
              </Txt>
            </Pressable>
          )}
        </View>
      )}
      <Txt variant="sub" style={{ alignSelf: 'stretch' }}>
        두 손가락으로 확대·축소하고 끌어서 움직여요. 점을 누르면 학교 이름이 보여요. 크게 확대하면 동 이름도 보여요. 경계: 통계청 SGIS 기반 admdongkor(github.com/vuski/admdongkor, CC BY 4.0)
      </Txt>
    </View>
  );
});
