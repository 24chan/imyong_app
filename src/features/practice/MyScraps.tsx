import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, View } from 'react-native';
import { Txt } from '../../components/ui';
import { regionByCode } from '../../data/regions';
import { ScrapSchool, setScrapOrder, toggleScrap, useScraps } from '../../store/schoolScraps';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { openRegionSchools } from '../region/NationalSchoolMap';
import { FoundMark } from '../region/SchoolMap';
import { openTransitRoute } from './route';

// 스크랩한 학교 모아보기 (기기에만 저장)
// 2026-11-28: 학교를 꾹 누르면 순서 바꾸기 → 끌어서 위아래로 옮기고 '완료'
const keyOf = (s: ScrapSchool) => `${s.region}|${s.name}`;

export function MyScraps() {
  const { colors } = useTheme();
  const list = useScraps();
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState<ScrapSchool[]>(list);
  const [drag, setDrag] = useState<string | null>(null);
  const rowH = useRef(64);
  const dy = useRef(new Animated.Value(0)).current;
  const st = useRef({ key: '', base: 0 }); // 끄는 중인 학교, 마지막으로 자리 바꾼 뒤의 손가락 위치
  const orderRef = useRef(order);
  orderRef.current = order;

  useEffect(() => {
    if (!editing) setOrder(list);
  }, [list, editing]);

  // 학교마다 하나씩 만들어 두고 계속 씀(다시 그릴 때 새로 만들면 끄는 도중 손가락 위치가 처음부터 다시 셈)
  const cache = useRef(new Map<string, ReturnType<typeof PanResponder.create>>()).current;
  const responder = (k: string) => {
    const hit = cache.get(k);
    if (hit) return hit;
    const r = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        st.current = { key: k, base: 0 };
        dy.setValue(0);
        setDrag(k);
      },
      onPanResponderMove: (_, g) => {
        const off = g.dy - st.current.base;
        const cur = orderRef.current.findIndex((x) => keyOf(x) === k);
        const step = off > rowH.current / 2 ? 1 : off < -rowH.current / 2 ? -1 : 0;
        const to = cur + step;
        if (step && to >= 0 && to < orderRef.current.length) {
          const next = [...orderRef.current];
          const [it] = next.splice(cur, 1);
          next.splice(to, 0, it);
          orderRef.current = next;
          setOrder(next);
          st.current.base += step * rowH.current;
        }
        dy.setValue(g.dy - st.current.base);
      },
      onPanResponderRelease: () => {
        dy.setValue(0);
        setDrag(null);
      },
      onPanResponderTerminate: () => {
        dy.setValue(0);
        setDrag(null);
      },
    });
    cache.set(k, r);
    return r;
  };

  const finish = () => {
    setScrapOrder(orderRef.current);
    setEditing(false);
  };

  if (!list.length)
    return <Txt variant="sub">아직 스크랩한 학교가 없어요. 지도나 실습초 목록에서 학교를 누르고 ☆를 눌러 보세요.</Txt>;
  const rows = editing ? order : list;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm }}>
        <Txt variant="sub" style={{ fontSize: 12, flex: 1 }}>
          {editing ? '≡를 잡고 위아래로 끌어 순서를 바꿔요.' : '스크랩은 이 폰에만 저장돼요. 학교 이름을 누르면 그 지역 학교 지도에서 보여요. 꾹 누르면 순서를 바꿀 수 있어요.'}
        </Txt>
        {editing && (
          <Pressable onPress={finish} accessibilityRole="button" hitSlop={8} style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.brand }}>
            <Txt style={{ fontSize: 13, fontWeight: '700', color: colors.background }}>완료</Txt>
          </Pressable>
        )}
      </View>
      {rows.map((s) => {
        const k = keyOf(s);
        const active = drag === k;
        const body = (
          <>
            <FoundMark found={s.found} size={10} />
            <View style={{ flex: 1 }}>
              <Txt style={{ fontWeight: '700' }}>{s.name}</Txt>
              <Txt variant="sub" style={{ fontSize: 12 }}>
                {regionByCode(s.region)?.shortName} {s.sigungu}
              </Txt>
            </View>
          </>
        );
        const rowStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line };
        if (editing)
          return (
            <Animated.View
              key={k}
              onLayout={(e) => (rowH.current = e.nativeEvent.layout.height)}
              {...responder(k).panHandlers}
              style={[rowStyle, { backgroundColor: active ? colors.surface : 'transparent', zIndex: active ? 2 : 0, transform: [{ translateY: active ? dy : 0 }], borderRadius: active ? radius.md : 0 }]}
            >
              <Ionicons name="reorder-three" size={24} color={colors.textSub} />
              {body}
            </Animated.View>
          );
        return (
          <Pressable key={k} onLongPress={() => setEditing(true)} delayLongPress={350} onPress={() => openRegionSchools(s.region, !s.kind || s.kind === 'e' ? 'elementary' : 'secondary', s.name)} accessibilityRole="button" accessibilityHint="꾹 누르면 순서 바꾸기" style={rowStyle}>
            {body}
            <Pressable onPress={() => openTransitRoute(s)} accessibilityRole="button" accessibilityLabel="내 위치에서 길찾기" hitSlop={8}>
              <Ionicons name="navigate-outline" size={20} color={colors.brand} />
            </Pressable>
            <Pressable onPress={() => toggleScrap(s)} accessibilityRole="button" accessibilityLabel="스크랩 해제" hitSlop={8}>
              <Ionicons name="star" size={22} color={colors.accent} />
            </Pressable>
          </Pressable>
        );
      })}
    </View>
  );
}
