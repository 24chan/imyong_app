import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from 'react-native';
import { ViewModeBanner } from '../../components/ModeToggle';
import { Chip, Screen, Segmented, Txt } from '../../components/ui';
import { AcademyEvent, EVENT_KIND, listEvents } from '../../data/academy';
import { dDayLabel, EVENT_LABEL } from '../../data/receiptStatus';
import { regionByCode } from '../../data/regions';
import { getSchedules } from '../../data/repository';
import { useRegionFilters } from '../../features/region/useRegionFilters';
import { useAppSettings, useToday } from '../../store/AppSettings';
import type { CatKey } from '../../theme/tokens';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// 일정 탭 (2026-11-21 탭 개편 안 2): 임용 공식 일정(교육청) + 학원 개강·특강·모의고사 한곳에, 목록/달력
type Kind = 'official' | 'open' | 'special' | 'mock';
type Item = { key: string; date: string; endsOn?: string | null; kind: Kind; title: string; sub?: string; url?: string | null };
const KIND_LABEL: Record<Kind, string> = { official: '임용 일정', open: EVENT_KIND.open, special: EVENT_KIND.special, mock: EVENT_KIND.mock };
const KIND_CAT: Record<Kind, CatKey> = { official: 'teal', open: 'blue', special: 'purple', mock: 'coral' };
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export default function ScheduleScreen() {
  const { colors } = useTheme();
  const { settings, viewLevel } = useAppSettings();
  const today = useToday();
  const f = useRegionFilters();
  const regions = settings.regionCodes.length ? settings.regionCodes : ['seoul'];
  const [region, setRegion] = useState(regions[0]);
  const [view, setView] = useState<'list' | 'month'>('list');
  const [kinds, setKinds] = useState<Set<Kind>>(new Set(['official', 'open', 'special', 'mock']));
  const [month, setMonth] = useState(() => new Date(`${today}T00:00:00`));
  const [day, setDay] = useState<string | null>(null);
  const [official, setOfficial] = useState<Item[] | null>(null);
  const [academy, setAcademy] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const r = regions.includes(region) ? region : regions[0];

  useFocusEffect(
    useCallback(() => {
      if (!f.latestYear) return;
      setError(null);
      // 학년도 일정은 전년도 가을~그해 2월이라 최근 두 학년도를 함께
      Promise.all([getSchedules(viewLevel, f.latestYear, r), getSchedules(viewLevel, f.latestYear + 1, r).catch(() => [])])
        .then(([a, b]) =>
          setOfficial(
            [...a, ...b].map((e) => ({
              key: `o-${e.year}-${e.event}-${e.date}`,
              date: e.date,
              kind: 'official' as const,
              title: EVENT_LABEL[e.event],
              sub: `${regionByCode(e.region)?.shortName} · ${e.year}학년도`,
            })),
          ),
        )
        .catch((e) => setError((e as Error).message));
      // 학원 일정: 보고 있는 달 앞뒤 넉넉히
      const from = new Date(month.getFullYear(), month.getMonth() - 1, 1);
      const to = new Date(month.getFullYear(), month.getMonth() + 3, 0);
      listEvents(viewLevel, `${ym(from)}-01`, `${ym(to)}-${String(to.getDate()).padStart(2, '0')}`)
        .then((list: AcademyEvent[]) =>
          setAcademy(list.map((e) => ({ key: `a-${e.id}`, date: e.startsOn, endsOn: e.endsOn, kind: e.kind, title: e.title, sub: e.academyName ?? undefined, url: e.url }))),
        )
        .catch(() => setAcademy([]));
    }, [viewLevel, f.latestYear, r, month]),
  );

  const items = useMemo(
    () => [...(official ?? []), ...(academy ?? [])].filter((i) => kinds.has(i.kind)).sort((a, b) => a.date.localeCompare(b.date)),
    [official, academy, kinds],
  );
  const toggle = (k: Kind) => {
    const n = new Set(kinds);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    setKinds(n.size ? n : new Set([k]));
  };

  const Badge = ({ k }: { k: Kind }) => (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.cat[KIND_CAT[k]].bg }}>
      <Txt style={{ fontSize: 12, fontWeight: '800', color: colors.cat[KIND_CAT[k]].fg }}>{KIND_LABEL[k]}</Txt>
    </View>
  );
  const Row = ({ i, first }: { i: Item; first: boolean }) => {
    const past = i.date < today;
    return (
      <Pressable
        disabled={!i.url}
        onPress={() => i.url && Linking.openURL(i.url)}
        style={{ flexDirection: 'row', gap: space.md, padding: space.md, borderTopWidth: first ? 0 : 1, borderTopColor: colors.line, opacity: past ? 0.5 : 1 }}
      >
        <View style={{ width: 46, alignItems: 'center' }}>
          <Txt style={{ fontWeight: '800', fontSize: 19 }}>{Number(i.date.slice(8))}</Txt>
          <Txt variant="sub" style={{ fontSize: 12 }}>
            {Number(i.date.slice(5, 7))}월 {WEEK[new Date(`${i.date}T00:00:00`).getDay()]}
          </Txt>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Badge k={i.kind} />
            {!past && <Txt variant="sub" style={{ fontWeight: '800' }}>{dDayLabel(i.date, today)}</Txt>}
          </View>
          <Txt style={{ fontWeight: '700' }}>{i.title}</Txt>
          {(i.sub || i.endsOn) && (
            <Txt variant="sub">
              {[i.sub, i.endsOn ? `~ ${i.endsOn.slice(5).replace('-', '.')}` : null].filter(Boolean).join(' · ')}
            </Txt>
          )}
        </View>
        {i.url && <Ionicons name="open-outline" size={16} color={colors.textSub} />}
      </Pressable>
    );
  };

  const List = ({ list }: { list: Item[] }) =>
    list.length === 0 ? (
      <Txt variant="sub">일정이 없어요.</Txt>
    ) : (
      <View style={{ borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
        {list.map((i, n) => (
          <Row key={i.key} i={i} first={n === 0} />
        ))}
      </View>
    );

  // 목록: 오늘 이후 먼저, 지난 일정은 아래 접어서
  const upcoming = items.filter((i) => (i.endsOn ?? i.date) >= today);
  const past = items.filter((i) => (i.endsOn ?? i.date) < today).reverse();
  const [showPast, setShowPast] = useState(false);

  // 달력 칸
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, d) => `${ym(month)}-${String(d + 1).padStart(2, '0')}`)];
  while (cells.length % 7) cells.push(null);
  const byDate = useMemo(() => {
    const m = new Map<string, Item[]>();
    items.forEach((i) => m.set(i.date, [...(m.get(i.date) ?? []), i]));
    return m;
  }, [items]);

  return (
    <Screen>
      <ViewModeBanner />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {regions.map((code) => (
          <Chip key={code} label={regionByCode(code)?.shortName ?? code} selected={r === code} onPress={() => setRegion(code)} />
        ))}
      </ScrollView>
      {!settings.regionCodes.length && <Txt variant="sub">관심 지역을 고르면 그 지역 일정이 보여요. 지금은 서울 예시예요.</Txt>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {(Object.keys(KIND_LABEL) as Kind[]).map((k) => {
          const on = kinds.has(k);
          return (
            <Pressable
              key={k}
              onPress={() => toggle(k)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? colors.cat[KIND_CAT[k]].fg : colors.line, backgroundColor: on ? colors.cat[KIND_CAT[k]].bg : colors.background }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.cat[KIND_CAT[k]].fg }} />
              <Txt style={{ fontSize: 13.5, fontWeight: '700', color: on ? colors.cat[KIND_CAT[k]].fg : colors.textSub }}>{KIND_LABEL[k]}</Txt>
            </Pressable>
          );
        })}
      </View>
      <Segmented
        options={[
          { value: 'list', label: '목록' },
          { value: 'month', label: '달력' },
        ]}
        value={view}
        onChange={setView}
      />
      {error && <Txt color="down">{error}</Txt>}

      {official === null ? (
        <ActivityIndicator color={colors.brand} />
      ) : view === 'list' ? (
        <>
          <List list={upcoming} />
          {past.length > 0 && (
            <Pressable onPress={() => setShowPast((v) => !v)} style={{ alignSelf: 'center', padding: space.sm }}>
              <Txt variant="sub" style={{ fontWeight: '700' }}>
                지난 일정 {past.length}개 {showPast ? '접기' : '보기'}
              </Txt>
            </Pressable>
          )}
          {showPast && <List list={past} />}
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
            <Pressable onPress={() => (setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)), setDay(null))} hitSlop={10} accessibilityLabel="이전 달">
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Txt variant="heading">
              {month.getFullYear()}년 {month.getMonth() + 1}월
            </Txt>
            <Pressable onPress={() => (setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)), setDay(null))} hitSlop={10} accessibilityLabel="다음 달">
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </Pressable>
          </View>
          <View style={{ borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, padding: space.sm }}>
            <View style={{ flexDirection: 'row' }}>
              {WEEK.map((w, i) => (
                <Txt key={w} variant="sub" style={{ flex: 1, textAlign: 'center', fontWeight: '700', color: i === 0 ? colors.down : colors.textSub }}>
                  {w}
                </Txt>
              ))}
            </View>
            {Array.from({ length: cells.length / 7 }, (_, w) => (
              <View key={w} style={{ flexDirection: 'row' }}>
                {cells.slice(w * 7, w * 7 + 7).map((d, i) => {
                  const list = d ? byDate.get(d) ?? [] : [];
                  const sel = d === day;
                  const isToday = d === today;
                  return (
                    <Pressable
                      key={i}
                      disabled={!d}
                      onPress={() => d && setDay(sel ? null : d)}
                      style={{ flex: 1, aspectRatio: 0.9, alignItems: 'center', paddingTop: 6, gap: 3, borderRadius: radius.md, backgroundColor: sel ? colors.cat.teal.bg : 'transparent' }}
                    >
                      {d && (
                        <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? colors.brand : 'transparent' }}>
                          <Txt style={{ fontSize: 14, fontWeight: isToday ? '800' : '500', color: isToday ? colors.background : i === 0 ? colors.down : colors.text }}>{Number(d.slice(8))}</Txt>
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', gap: 2 }}>
                        {[...new Set(list.map((x) => x.kind))].slice(0, 4).map((k) => (
                          <View key={k} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.cat[KIND_CAT[k]].fg }} />
                        ))}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <List list={day ? byDate.get(day) ?? [] : items.filter((i) => i.date.startsWith(ym(month)))} />
        </>
      )}
      <Txt variant="sub" style={{ fontSize: 12 }}>
        임용 일정은 교육청 시행계획 공고 기준이에요. 학원 일정은 운영자가 확인해 올려요(광고 아님).
      </Txt>
    </Screen>
  );
}
