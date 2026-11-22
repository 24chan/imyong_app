import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, GestureResponderEvent, PanResponder, Pressable, View } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Txt } from '../../components/ui';
import { regionByCode } from '../../data/regions';
import { getSidoGeo } from '../../data/repository';
import { useAsync } from '../../data/useAsync';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { REGION_CAT } from '../region/NationalSchoolMap';
import { useFoundColor } from '../region/SchoolMap';

// 실습초 지도: 지역·TO 지도처럼 시도 색 + 두 손가락 확대·축소·이동 + 버튼. 확대하면 학교 이름이 보여요.
const merc = (lat: number) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
const X = (lng: number) => lng;
const Y = (lat: number) => -merc(lat);
const MAX_ZOOM = 10;
type V4 = { x: number; y: number; w: number; h: number };
type T = { locationX: number; locationY: number };
const dist = (a: T, b: T) => Math.hypot(a.locationX - b.locationX, a.locationY - b.locationY);

export type MapPoint = { id: string; name: string; lat: number; lng: number; found: 'p' | 's' | 'n' };
export type MapCampus = { id: string; name: string; lat: number; lng: number };

export function PracticeMap({ points, campuses, picked, onPick }: { points: MapPoint[]; campuses: MapCampus[]; picked: string | null; onPick: (id: string | null) => void }) {
  const { colors } = useTheme();
  const colorOf = useFoundColor();
  const geo = useAsync(() => getSidoGeo(), []);
  const [cw, setCw] = useState(0);

  // 처음 화면: 학교 + 캠퍼스가 다 보이는 범위
  const initial = useMemo<V4 | null>(() => {
    const ps = [...points, ...campuses];
    if (!ps.length) return null;
    const xs = ps.map((p) => X(p.lng)), ys = ps.map((p) => Y(p.lat));
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const pad = Math.max(x1 - x0, y1 - y0, 0.05) * 0.12;
    return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
  }, [points, campuses]);

  const W = Math.max(1, Math.floor(cw));
  const H = initial ? Math.max(220, Math.min(380, Math.round((W * initial.h) / initial.w))) : 1;
  const fit = (v: V4): V4 => {
    if (!initial) return v;
    const base = Math.max(initial.w, initial.h * (W / H));
    const w = Math.min(base * 1.6, Math.max(base / MAX_ZOOM, Math.max(v.w, v.h * (W / H))));
    const h = w * (H / W);
    const cx = Math.min(Math.max(v.x + v.w / 2, initial.x), initial.x + initial.w);
    const cy = Math.min(Math.max(v.y + v.h / 2, initial.y), initial.y + initial.h);
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  };
  const [view, setView] = useState<V4>({ x: 0, y: 0, w: 1, h: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    if (initial && W > 1) setView(fit(initial));
  }, [initial, W, H]); // eslint-disable-line react-hooks/exhaustive-deps

  const k = W / view.w;
  const u = 1 / k;
  const zoom = initial ? Math.max(initial.w, initial.h * (W / H)) / view.w : 1;

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
    setView(fit({ x: v.x + (W / 2 + (-W / 2 - tx) / s) / kk, y: v.y + (H / 2 + (-H / 2 - ty) / s) / kk, w: v.w / s, h: v.h / s }));
  };
  const zoomBy = (f: number) => {
    const v = viewRef.current;
    setView(fit({ x: v.x + (v.w - v.w / f) / 2, y: v.y + (v.h - v.h / f) / 2, w: v.w / f, h: v.h / f }));
  };
  const pickAt = (sx: number, sy: number) => {
    const v = viewRef.current;
    const kk = W / v.w;
    const mx = v.x + sx / kk, my = v.y + sy / kk;
    let best: string | null = null;
    let bd = (24 / kk) ** 2;
    for (const p of fns.current.points) {
      const d = (X(p.lng) - mx) ** 2 + (Y(p.lat) - my) ** 2;
      if (d < bd) (bd = d), (best = p.id);
    }
    fns.current.onPick(best);
  };
  const fns = useRef({ commit, pickAt, points, onPick, W, H });
  fns.current = { commit, pickAt, points, onPick, W, H };
  const g = useRef({ mode: 'none' as 'none' | 'pan' | 'pinch', s0: 1, tx0: 0, ty0: 0, d0: 1, mx0: 0, my0: 0, x0: 0, y0: 0, t0: 0, moved: false });
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: (e) => e.nativeEvent.touches.length >= 2,
      onPanResponderTerminationRequest: () => g.current.mode === 'none',
      onPanResponderGrant: (e) => {
        Object.assign(g.current, { t0: Date.now(), moved: false, mode: 'none', x0: e.nativeEvent.locationX, y0: e.nativeEvent.locationY });
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const { W: w, H: h } = fns.current;
        const t = e.nativeEvent.touches;
        const st = g.current;
        const cur = live.current;
        if (t.length >= 2) {
          const mx = (t[0].locationX + t[1].locationX) / 2, my = (t[0].locationY + t[1].locationY) / 2;
          const d = Math.max(10, dist(t[0], t[1]));
          if (st.mode !== 'pinch') Object.assign(st, { mode: 'pinch', s0: cur.s, tx0: cur.tx, ty0: cur.ty, d0: d, mx0: mx, my0: my });
          const s = Math.min(8, Math.max(0.4, (st.s0 * d) / st.d0));
          const qx = w / 2 + (st.mx0 - w / 2 - st.tx0) / st.s0, qy = h / 2 + (st.my0 - h / 2 - st.ty0) / st.s0;
          setLive(s, mx - w / 2 - s * (qx - w / 2), my - h / 2 - s * (qy - h / 2));
          st.moved = true;
        } else if (t.length === 1) {
          const x = t[0].locationX, y = t[0].locationY;
          if (st.mode !== 'pan') Object.assign(st, { mode: 'pan', tx0: cur.tx, ty0: cur.ty, x0: x, y0: y, moved: st.mode === 'pinch' || st.moved });
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

  const shapes = useMemo(
    () =>
      (geo.data?.sido ?? []).map((s) => ({
        r: s.r,
        c: s.c,
        d: s.p.map((ring) => 'M' + ring.map(([lng, lat]) => `${X(lng).toFixed(3)} ${Y(lat).toFixed(3)}`).join('L') + 'Z').join(''),
      })),
    [geo.data],
  );
  const px = (lng: number, lat: number) => [(X(lng) - view.x) * k, (Y(lat) - view.y) * k] as const;

  // 이름표: 지역 이름(축소) / 학교 이름(확대 2.2배 이상, 겹치면 생략) / 캠퍼스는 항상
  const labels = useMemo(() => {
    const boxes: [number, number, number, number][] = [];
    const out: { key: string; x: number; y: number; t: string; kind: 'campus' | 'school' | 'region' }[] = [];
    const tryAdd = (key: string, x: number, y: number, t: string, kind: 'campus' | 'school' | 'region', fs: number) => {
      if (x < -20 || x > W + 20 || y < -10 || y > H + 10) return;
      const hw = (t.length * fs) / 2 + 2;
      const b: [number, number, number, number] = [x - hw, y - fs, x + hw, y + 2];
      if (boxes.some((o) => o[0] < b[2] && b[0] < o[2] && o[1] < b[3] && b[1] < o[3])) return;
      boxes.push(b);
      out.push({ key, x, y, t, kind });
    };
    campuses.forEach((c) => {
      const [x, y] = px(c.lng, c.lat);
      tryAdd(`c-${c.id}`, x, y - 10, c.name.replace('캠퍼스', '캠'), 'campus', 12);
    });
    if (picked) {
      const p = points.find((q) => q.id === picked);
      if (p) {
        const [x, y] = px(p.lng, p.lat);
        tryAdd(`s-${p.id}`, x, y - 9, p.name, 'school', 11);
      }
    }
    if (zoom >= 2.2)
      points.forEach((p) => {
        const [x, y] = px(p.lng, p.lat);
        tryAdd(`s-${p.id}`, x, y - 8, p.name, 'school', 11);
      });
    shapes.forEach((s) => {
      if (!['seoul', 'incheon', 'gyeonggi'].includes(s.r)) return;
      const [x, y] = px(s.c[0], s.c[1]);
      tryAdd(`r-${s.r}`, x, y, regionByCode(s.r)?.shortName ?? s.r, 'region', 13);
    });
    return out;
  }, [campuses, points, picked, zoom, shapes, view, k, W, H]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!initial || W <= 1)
    return <View style={{ height: initial ? 240 : 0 }} onLayout={(e) => setCw(e.nativeEvent.layout.width)} />;

  return (
    <View onLayout={(e) => setCw(e.nativeEvent.layout.width)} style={{ width: '100%' }}>
      <View style={{ width: W, height: H, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface }}>
        <View style={{ width: W, height: H }} {...responder.panHandlers} accessibilityLabel="실습학교 지도. 두 손가락으로 확대, 점을 누르면 학교 카드">
          <Animated.View pointerEvents="none" style={{ width: W, height: H, transform: [{ translateX: aX }, { translateY: aY }, { scale: aS }] }}>
            <Svg width={W} height={H} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}>
              {shapes.map((s) => (
                <Path key={s.r} d={s.d} fill={colors.cat[REGION_CAT[s.r] ?? 'gray'].bg} />
              ))}
              {shapes.map((s) => (
                <Path key={`o-${s.r}`} d={s.d} fill="none" stroke={colors.textSub} strokeOpacity={0.5} strokeWidth={1 * u} strokeLinejoin="round" />
              ))}
              {points.map((p) => (
                <Circle
                  key={p.id}
                  cx={X(p.lng)}
                  cy={Y(p.lat)}
                  r={(picked === p.id ? 7 : zoom >= 2.2 ? 5 : 4.2) * u}
                  fill={colorOf(p.found)}
                  stroke={picked === p.id ? colors.text : colors.background}
                  strokeWidth={(picked === p.id ? 2.2 : 1.2) * u}
                />
              ))}
              {campuses.map((c) => (
                <Rect key={c.id} x={X(c.lng) - 7 * u} y={Y(c.lat) - 7 * u} width={14 * u} height={14 * u} rx={3.5 * u} fill={colors.accent} stroke={colors.background} strokeWidth={1.6 * u} />
              ))}
            </Svg>
            <Svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
              {labels.map((l) => {
                const fs = l.kind === 'region' ? 13 : l.kind === 'campus' ? 12 : 11;
                const fill = l.kind === 'region' ? colors.textSub : colors.text;
                return (
                  <G key={l.key}>
                    <SvgText x={l.x} y={l.y} fontSize={fs} fontFamily="Pretendard-Bold" textAnchor="middle" stroke={colors.background} strokeWidth={3.5} strokeLinejoin="round" fill={colors.background}>
                      {l.t}
                    </SvgText>
                    <SvgText x={l.x} y={l.y} fontSize={fs} fontFamily="Pretendard-Bold" textAnchor="middle" fill={fill}>
                      {l.t}
                    </SvgText>
                  </G>
                );
              })}
            </Svg>
          </Animated.View>
        </View>
        <View style={{ position: 'absolute', right: space.sm, top: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.background, overflow: 'hidden' }}>
          {[
            { icon: 'add' as const, label: '확대', on: () => zoomBy(2) },
            { icon: 'remove' as const, label: '축소', on: () => zoomBy(0.5) },
          ].map((b, i) => (
            <Pressable key={b.icon} onPress={b.on} accessibilityRole="button" accessibilityLabel={b.label} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
              <Ionicons name={b.icon} size={20} color={colors.text} />
            </Pressable>
          ))}
        </View>
        {zoom > 1.05 && (
          <Pressable
            onPress={() => setView(fit(initial))}
            accessibilityRole="button"
            style={{ position: 'absolute', left: space.sm, top: space.sm, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line }}
          >
            <Ionicons name="scan-outline" size={14} color={colors.text} />
            <Txt variant="sub" color="text" style={{ fontWeight: '700' }}>
              전체 보기
            </Txt>
          </Pressable>
        )}
      </View>
    </View>
  );
}
