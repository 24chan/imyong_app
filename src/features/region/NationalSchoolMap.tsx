import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, GestureResponderEvent, PanResponder, Pressable, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { Chip, Txt } from '../../components/ui';
import { regionByCode, REGIONS } from '../../data/regions';
import { getAllSchools, getSidoGeo, SchoolWithRegion } from '../../data/repository';
import { useAsync } from '../../data/useAsync';
import type { Level } from '../../store/AppSettings';
import type { CatKey } from '../../theme/tokens';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { SchoolFound } from '../../types/data';
import { toggleScrap, useIsScrapped } from '../../store/schoolScraps';
import { PracticeReviews } from '../practice/PracticeReviews';
import { SchoolInfoBox } from './SchoolInfoBox';
import { FoundMark, useFoundColor } from './SchoolMap';

// 지도 좌표: 경도 그대로, 위도는 메르카토르 (SchoolMap과 같은 방식)
const merc = (lat: number) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
const X = (lng: number) => lng;
const Y = (lat: number) => -merc(lat);
const FOUND_LABEL: Record<SchoolFound, string> = { p: '공립', s: '사립', n: '국립' };
const KIND_LABEL = { e: '초등학교', m: '중학교', h: '고등학교' } as const;
const MAX_ZOOM = 14;

// 이웃한 지역끼리 다른 색 (지역 칠하기)
export const REGION_CAT: Record<string, CatKey> = {
  gyeonggi: 'teal', seoul: 'amber', incheon: 'blue', gangwon: 'purple', chungbuk: 'blue', chungnam: 'purple', sejong: 'amber',
  daejeon: 'teal', jeonbuk: 'amber', gyeongbuk: 'teal', daegu: 'amber', gyeongnam: 'purple', jeonnam: 'blue', gwangju: 'amber',
  busan: 'teal', ulsan: 'blue', jeju: 'purple',
};
const METRO = new Set(['seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon', 'ulsan', 'sejong']);
// 이름표 자리 손보기 (경기 이름이 서울과 겹쳐서)
const LABEL_AT: Record<string, [number, number]> = { gyeonggi: [127.27, 37.93], incheon: [126.55, 37.47], chungnam: [126.8, 36.45] };

export const schoolsForLevel = (all: SchoolWithRegion[], level: Level) =>
  // 울릉도·독도(경도 130.5 넘음)는 전국 지도에서 빼고 경북 지역 지도에서 봐요
  all.filter((s) => (level === 'elementary' ? s.kind === 'e' : s.kind !== 'e') && s.lng < 130.5 && s.lat > 33);

export function openRegionSchools(region: string, level: Level, school?: string) {
  router.push({ pathname: '/schools', params: { region, level, ...(school ? { q: school } : {}) } });
}

type View4 = { x: number; y: number; w: number; h: number };
type Touch = { locationX: number; locationY: number };
const dist = (a: Touch, b: Touch) => Math.hypot(a.locationX - b.locationX, a.locationY - b.locationY);

/**
 * 전국 학교 지도: 초등 모드 = 전국 초등학교, 중등 모드 = 전국 중·고등학교.
 * 시도 경계 + 지역 색 + 이름표 위에 학교 점. 두 손가락으로 확대·축소, 확대한 뒤엔 끌어서 이동.
 * 학교 수천 곳을 설립별로 Path 하나에 묶어 그려서 가벼움. 학교를 누르면 아래 카드.
 */
export function NationalSchoolMap({ level, maxHeight = 420, showChips = false }: { level: Level; maxHeight?: number; showChips?: boolean }) {
  const { colors } = useTheme();
  const colorOf = useFoundColor();
  const data = useAsync(() => getAllSchools(), []);
  const geo = useAsync(() => getSidoGeo(), []);
  const [cw, setCw] = useState(0);
  const [picked, setPicked] = useState<SchoolWithRegion | null>(null);
  // 처음엔 지역만 → 지역을 누르면 그 지역으로 확대하고 그 지역 학교만 (2026-11-22 사용자 요청)
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    setPicked(null);
    setFocus(null);
  }, [level]);

  const allSchools = useMemo(() => schoolsForLevel(data.data ?? [], level), [data.data, level]);
  const schools = useMemo(() => (focus ? allSchools.filter((x) => x.region === focus) : []), [allSchools, focus]);
  const sido = useMemo(() => geo.data?.sido ?? [], [geo.data]);

  // 처음 화면: 육지 경계(없으면 학교) 범위
  const initial = useMemo<View4 | null>(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    sido.forEach((s) => s.p.forEach((r) => r.forEach(([lng, lat]) => lng < 130.5 && (xs.push(X(lng)), ys.push(Y(lat))))));
    if (!xs.length) allSchools.forEach((s) => (xs.push(X(s.lng)), ys.push(Y(s.lat))));
    if (!xs.length) return null;
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const pad = (x1 - x0) * 0.03;
    return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
  }, [sido, allSchools]);

  const W = Math.max(1, Math.floor(cw));
  const H = initial ? Math.max(1, Math.round(Math.min(maxHeight, (W * initial.h) / initial.w))) : 1;

  const fit = (v: View4): View4 => {
    if (!initial) return v;
    const cx = v.x + v.w / 2;
    const cy = v.y + v.h / 2;
    const base = Math.max(initial.w, initial.h * (W / H)); // 전체가 다 보이는 폭
    const w = Math.min(base, Math.max(base / MAX_ZOOM, Math.max(v.w, v.h * (W / H))));
    const h = w * (H / W);
    const bx0 = initial.x + initial.w / 2 - base / 2;
    const by0 = initial.y + initial.h / 2 - (base * (H / W)) / 2;
    const x = Math.min(Math.max(cx - w / 2, bx0), bx0 + base - w);
    const y = Math.min(Math.max(cy - h / 2, by0), by0 + base * (H / W) - h);
    return { x, y, w, h };
  };

  const [view, setView] = useState<View4>({ x: 0, y: 0, w: 1, h: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    if (initial && W > 1) setView(fit(initial));
  }, [initial, W, H]); // eslint-disable-line react-hooks/exhaustive-deps

  const k = W / view.w; // 지도 1단위 = k px
  const zoom = initial ? Math.max(initial.w, initial.h * (W / H)) / view.w : 1;
  const zoomed = zoom > 1.05;

  // 손가락으로 움직이는 동안만 화면 변형 → 떼면 그 배율로 다시 그림
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
    const x = v.x + (W / 2 + (0 - W / 2 - tx) / s) / kk;
    const y = v.y + (H / 2 + (0 - H / 2 - ty) / s) / kk;
    setView(fit({ x, y, w: v.w / s, h: v.h / s }));
  };
  const zoomBy = (f: number) => {
    const v = viewRef.current;
    setView(fit({ x: v.x + (v.w - v.w / f) / 2, y: v.y + (v.h - v.h / f) / 2, w: v.w / f, h: v.h / f }));
  };

  const pickAt = (sx: number, sy: number) => {
    const v = viewRef.current;
    const kk = W / v.w;
    const mx = v.x + sx / kk;
    const my = v.y + sy / kk;
    const hit = fns.current.regionAt(mx, my);
    if (!fns.current.focus || (hit && hit !== fns.current.focus)) {
      if (hit) fns.current.focusRegion(hit);
      return;
    }
    const lim = 22 / kk;
    let best: SchoolWithRegion | null = null;
    let bd = lim * lim;
    for (const s of fns.current.schools) {
      const d = (X(s.lng) - mx) ** 2 + (Y(s.lat) - my) ** 2;
      if (d < bd) (bd = d), (best = s);
    }
    setPicked(best);
  };

  // 지역 경계 (지도 좌표) — 누른 곳 찾기·확대 범위
  const rings = useMemo(
    () => sido.map((x) => ({ r: x.r, rings: x.p.map((ring) => ring.map(([lng, lat]) => [X(lng), Y(lat)] as [number, number])) })),
    [sido],
  );
  const regionAt = (mx: number, my: number): string | null => {
    for (const g0 of rings) {
      let inside = false;
      for (const ring of g0.rings) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i];
          const [xj, yj] = ring[j];
          if (yi > my !== yj > my && mx < ((xj - xi) * (my - yi)) / (yj - yi) + xi) inside = !inside;
        }
      }
      if (inside) return g0.r;
    }
    return null;
  };
  const focusRegion = (r: string) => {
    const g0 = rings.find((x) => x.r === r);
    setPicked(null);
    setFocus(r);
    if (!g0) return;
    const pts = g0.rings.flat().filter(([x]) => x < 130.5);
    const x0 = Math.min(...pts.map((p0) => p0[0])), x1 = Math.max(...pts.map((p0) => p0[0]));
    const y0 = Math.min(...pts.map((p0) => p0[1])), y1 = Math.max(...pts.map((p0) => p0[1]));
    const pad = Math.max(x1 - x0, y1 - y0) * 0.08;
    setView(fit({ x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 }));
  };
  const showAll = () => {
    setFocus(null);
    setPicked(null);
    if (initial) setView(fit(initial));
  };

  const fns = useRef({ commit, pickAt, schools, W, H, zoomed, focus, regionAt, focusRegion });
  fns.current = { commit, pickAt, schools, W, H, zoomed, focus, regionAt, focusRegion };
  const g = useRef({ mode: 'none' as 'none' | 'pan' | 'pinch', s0: 1, tx0: 0, ty0: 0, d0: 1, mx0: 0, my0: 0, x0: 0, y0: 0, t0: 0, moved: false });

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: (e) => e.nativeEvent.touches.length >= 2,
      // 확대 전 한 손가락으로 끌면 화면 스크롤에 양보
      onPanResponderTerminationRequest: () => g.current.mode !== 'pinch' && !fns.current.zoomed,
      onPanResponderGrant: (e) => {
        const st = g.current;
        st.t0 = Date.now();
        st.moved = false;
        st.mode = 'none';
        st.x0 = e.nativeEvent.locationX;
        st.y0 = e.nativeEvent.locationY;
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const { W: w, H: h, zoomed: zd } = fns.current;
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
          const s = Math.min(8, Math.max(0.5, (st.s0 * d) / st.d0));
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
          if (st.moved && (zd || cur.s !== 1)) setLive(cur.s, st.tx0 + (x - st.x0), st.ty0 + (y - st.y0));
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

  // 시도 경계 Path (지도 좌표)
  const shapes = useMemo(
    () =>
      sido.map((s) => ({
        r: s.r,
        d: s.p.map((ring) => 'M' + ring.map(([lng, lat]) => `${X(lng).toFixed(3)} ${Y(lat).toFixed(3)}`).join('L') + 'Z').join(''),
      })),
    [sido],
  );

  // 학교 점: 화면에서 같은 크기로 보이게 배율마다 다시 만듦 (화면 밖 점은 뺌)
  const u = 1 / k;
  const dots = useMemo(() => {
    const d: Record<SchoolFound, string> = { p: '', s: '', n: '' };
    if (!schools.length || W <= 1) return d;
    const big = zoom >= 3;
    const rp = (big ? 2.6 : 1.15) * u;
    const rs = (big ? 3.4 : level === 'elementary' ? 2.1 : 1.7) * u;
    const pad = 10 * u;
    const f = (n: number) => n.toFixed(4);
    for (const s of schools) {
      const x = X(s.lng);
      const y = Y(s.lat);
      if (x < view.x - pad || x > view.x + view.w + pad || y < view.y - pad || y > view.y + view.h + pad) continue;
      if (s.found === 'p') d.p += `M${f(x - rp)} ${f(y)}a${f(rp)} ${f(rp)} 0 1 0 ${f(rp * 2)} 0a${f(rp)} ${f(rp)} 0 1 0 ${f(-rp * 2)} 0`;
      else if (s.found === 's') d.s += `M${f(x - rs)} ${f(y - rs)}h${f(rs * 2)}v${f(rs * 2)}h${f(-rs * 2)}z`;
      else d.n += `M${f(x)} ${f(y - rs * 1.3)}l${f(rs * 1.3)} ${f(rs * 1.3)}l${f(-rs * 1.3)} ${f(rs * 1.3)}l${f(-rs * 1.3)} ${f(-rs * 1.3)}z`;
    }
    return d;
  }, [schools, view, W, level]); // eslint-disable-line react-hooks/exhaustive-deps

  const byRegion = useMemo(() => {
    const m = new Map<string, number>();
    allSchools.forEach((s) => m.set(s.region, (m.get(s.region) ?? 0) + 1));
    return m;
  }, [allSchools]);

  // 지역 이름표 (화면 픽셀 좌표, 겹치면 작은 것 생략)
  const labels = useMemo(() => {
    const boxes: [number, number, number, number][] = [];
    const out: { r: string; x: number; y: number; t: string; big: boolean; n?: number }[] = [];
    const order = [...sido].sort((a, b) => Number(METRO.has(a.r)) - Number(METRO.has(b.r)));
    for (const s of order) {
      const [lng, lat] = LABEL_AT[s.r] ?? s.c;
      const x = (X(lng) - view.x) * k;
      const y = (Y(lat) - view.y) * k;
      if (x < 0 || x > W || y < 0 || y > H) continue;
      const big = !METRO.has(s.r);
      const t = regionByCode(s.r)?.shortName ?? s.r;
      const fsz = big ? 13 : 11;
      const hw = (t.length * fsz) / 2 + 3;
      const box: [number, number, number, number] = [x - hw, y - fsz * 0.7, x + hw, y + fsz * 0.7];
      if (boxes.some((o) => o[0] < box[2] && box[0] < o[2] && o[1] < box[3] && box[1] < o[3])) continue;
      boxes.push(box);
      out.push({ r: s.r, x, y, t, big, n: focus ? undefined : byRegion.get(s.r) });
    }
    return out;
  }, [sido, view, k, W, H, focus, byRegion]);

  const counts = useMemo(() => {
    const c: Record<SchoolFound, number> = { p: 0, s: 0, n: 0 };
    (focus ? schools : allSchools).forEach((s) => (c[s.found] += 1));
    return c;
  }, [schools, allSchools, focus]);

  const loading = (data.loading && !data.data) || (geo.loading && geo.data === undefined);
  const ready = !!initial && W > 1 && allSchools.length > 0;

  return (
    <View style={{ gap: space.sm }} onLayout={(e) => setCw(e.nativeEvent.layout.width)}>
      {loading ? (
        <View style={{ height: 220, alignItems: 'center', justifyContent: 'center', gap: space.sm }}>
          <ActivityIndicator color={colors.brand} />
          <Txt variant="sub">전국 학교 위치를 받는 중이에요 (처음 한 번)</Txt>
        </View>
      ) : !ready ? (
        <Txt variant="sub">{data.error ? `학교 위치를 불러오지 못했어요: ${data.error.message}` : '학교 위치 자료가 아직 없어요.'}</Txt>
      ) : (
        <View style={{ width: W, height: H, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface }}>
          <View style={{ width: W, height: H }} {...responder.panHandlers} accessibilityLabel="전국 학교 지도. 지역을 누르면 그 지역 학교, 학교를 누르면 정보">
            <Animated.View pointerEvents="none" style={{ width: W, height: H, transform: [{ translateX: aX }, { translateY: aY }, { scale: aS }] }}>
              <Svg width={W} height={H} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}>
                {shapes.map((s) => (
                  <Path key={s.r} d={s.d} fill={focus && s.r !== focus ? colors.background : colors.cat[REGION_CAT[s.r] ?? 'gray'].bg} fillOpacity={focus && s.r !== focus ? 0.6 : 1} />
                ))}
                {shapes.map((s) => (
                  <Path key={`o-${s.r}`} d={s.d} fill="none" stroke={colors.textSub} strokeOpacity={0.55} strokeWidth={1 * u} strokeLinejoin="round" />
                ))}
                <Path d={dots.p} fill={colorOf('p')} fillOpacity={0.72} />
                <Path d={dots.n} fill={colorOf('n')} stroke={colors.background} strokeWidth={0.8 * u} />
                <Path d={dots.s} fill={colorOf('s')} stroke={colors.background} strokeWidth={0.8 * u} />
                {picked && <Circle cx={X(picked.lng)} cy={Y(picked.lat)} r={9 * u} fill="none" stroke={colors.text} strokeWidth={2.2 * u} />}
              </Svg>
              <Svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
                {labels.map((l) => (
                  <G key={l.r}>
                    <SvgText x={l.x} y={l.y + (l.big ? 4.5 : 4)} fontSize={l.big ? 13 : 11} fontFamily="Pretendard-Bold" textAnchor="middle" stroke={colors.background} strokeWidth={3.5} strokeLinejoin="round" fill={colors.background}>
                      {l.t}
                    </SvgText>
                    <SvgText x={l.x} y={l.y + (l.big ? 4.5 : 4)} fontSize={l.big ? 13 : 11} fontFamily="Pretendard-Bold" textAnchor="middle" fill={colors.text}>
                      {l.t}
                    </SvgText>
                    {l.n != null && l.big && (
                      <SvgText x={l.x} y={l.y + 18} fontSize={10} fontFamily="Pretendard-Bold" textAnchor="middle" fill={colors.textSub}>
                        {l.n.toLocaleString()}
                      </SvgText>
                    )}
                  </G>
                ))}
              </Svg>
            </Animated.View>
          </View>

          {/* 확대·축소 버튼 */}
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
          {(zoomed || focus) && initial && (
            <Pressable
              onPress={showAll}
              accessibilityRole="button"
              style={{ position: 'absolute', left: space.sm, top: space.sm, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line }}
            >
              <Ionicons name="scan-outline" size={14} color={colors.text} />
              <Txt variant="sub" color="text" style={{ fontWeight: '700' }}>
                전국 보기
              </Txt>
            </Pressable>
          )}
        </View>
      )}

      {/* 누른 학교 */}
      {picked && (
        <View style={{ gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.cat[REGION_CAT[picked.region] ?? 'gray'].bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <FoundMark found={picked.found} size={12} />
            <View style={{ flex: 1 }}>
              <Txt style={{ fontWeight: '800', fontSize: 16 }}>{picked.name}</Txt>
              <Txt variant="sub">
                {regionByCode(picked.region)?.shortName} {picked.sigungu} · {FOUND_LABEL[picked.found]} {KIND_LABEL[picked.kind]}
              </Txt>
            </View>
            <ScrapStar school={picked} />
            <Pressable onPress={() => setPicked(null)} accessibilityRole="button" accessibilityLabel="닫기" hitSlop={10}>
              <Ionicons name="close" size={20} color={colors.textSub} />
            </Pressable>
          </View>
          <SchoolInfoBox region={picked.region} name={picked.name} kind={picked.kind} />
          {picked.kind === 'e' && <PracticeReviews school={`${picked.region}|${picked.name}`} defaultYear={new Date().getFullYear()} />}
          <Pressable onPress={() => openRegionSchools(picked.region, level, picked.name)} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'flex-start' }}>
            <Txt color="brand" style={{ fontWeight: '800' }}>
              주변 학교 지도로 보기 ›
            </Txt>
          </Pressable>
        </View>
      )}

      {ready && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md }}>
          {(['p', 's', 'n'] as SchoolFound[])
            .filter((f) => counts[f] > 0)
            .map((f) => (
              <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <FoundMark found={f} />
                <Txt variant="sub" color="text">
                  {FOUND_LABEL[f]} {counts[f].toLocaleString()}
                </Txt>
              </View>
            ))}
          <Txt variant="sub" style={{ flex: 1, textAlign: 'right' }}>
            {focus ? `${regionByCode(focus)?.shortName} 학교 · 학교를 누르면 정보` : '지역을 누르면 그 지역 학교가 보여요'}
          </Txt>
        </View>
      )}

      {ready && showChips && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {REGIONS.filter((r) => byRegion.has(r.code)).map((r) => (
            <Chip key={r.code} label={`${r.shortName} ${byRegion.get(r.code)?.toLocaleString()}`} selected={focus === r.code} onPress={() => (focus === r.code ? showAll() : focusRegion(r.code))} />
          ))}
        </View>
      )}
    </View>
  );
}

/** 학교 카드의 ☆ 스크랩 (기기에만 저장) */
function ScrapStar({ school }: { school: SchoolWithRegion }) {
  const { colors } = useTheme();
  const on = useIsScrapped(school);
  return (
    <Pressable
      onPress={() => toggleScrap({ region: school.region, name: school.name, sigungu: school.sigungu, lat: school.lat, lng: school.lng, found: school.found })}
      accessibilityRole="button"
      accessibilityLabel={on ? '스크랩 해제' : '스크랩'}
      hitSlop={10}
    >
      <Ionicons name={on ? 'star' : 'star-outline'} size={22} color={on ? colors.accent : colors.textSub} />
    </Pressable>
  );
}
