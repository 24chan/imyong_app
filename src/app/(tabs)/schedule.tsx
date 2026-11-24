import Ionicons from '@expo/vector-icons/Ionicons';
import { openLink } from '../../lib/openLink';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/Auth';
import { EventTipButton } from '../../features/schedule/EventTipButton';
import { PracticeTipButton } from '../../features/practice/PracticeTipButton';
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
import { alertsAvailable, enableAlerts, toggleSavedSchedule, useAlertPrefs, useSavedSchedule } from '../../features/alerts/alerts';

// 일정 탭 (2026-11-21 탭 개편 안 2): 임용 공식 일정(교육청) + 학원 개강·특강·모의고사 한곳에, 목록/달력
// C-1 (2026-11-22): 설명회·인강 오픈·기타 종류, 장소 표시, 이용자 일정 제보
type Kind = 'official' | AcademyEvent['kind'];
type Item = { key: string; date: string; endsOn?: string | null; kind: Kind; title: string; sub?: string; url?: string | null };
const KIND_LABEL: Record<Kind, string> = { official: '임용 일정', ...EVENT_KIND };
const KIND_CAT: Record<Kind, CatKey> = { official: 'teal', open: 'blue', special: 'purple', mock: 'coral', briefing: 'pink', online: 'green', etc: 'gray' };
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
/** 달력 칸용 짧은 제목: [강사·과목], 학년도, '안내' 같은 말을 뺌 */
const shortTitle = (t: string) =>
  t.replace(/\[[^\]]*\]|\([^)]*\)|20\d\d학년도|20\d\d|대비|안내|★|☆/g, ' ').replace(/\s+/g, ' ').trim() || t;
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export default function ScheduleScreen() {
  const { colors } = useTheme();
  const { settings, viewLevel } = useAppSettings();
  const today = useToday();
  const f = useRegionFilters();
  const regions = settings.regionCodes.length ? settings.regionCodes : ['seoul'];
  const [region, setRegion] = useState(regions[0]);
  const [view, setView] = useState<'list' | 'month'>('list');
  const [kinds, setKinds] = useState<Set<Kind>>(new Set(Object.keys(KIND_LABEL) as Kind[]));
  const [month, setMonth] = useState(() => new Date(`${today}T00:00:00`));
  const [day, setDay] = useState<string | null>(null);
  const { isAdmin } = useAuth();
  const [official, setOfficial] = useState<Item[] | null>(null);
  const [academy, setAcademy] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alertPrefs = useAlertPrefs();
  const savedSch = useSavedSchedule();
  const bell = useMemo(() => new Set(savedSch.map((x) => x.key)), [savedSch]);
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
          setAcademy(list.filter((e) => !e.subjectCode || !settings.subjectCode || e.subjectCode === settings.subjectCode).map((e) => ({ key: `a-${e.id}`, date: e.startsOn, endsOn: e.endsOn, kind: e.kind, title: e.title, sub: [e.academyName, e.place].filter(Boolean).join(' · ') || undefined, url: e.url }))),
        )
        .catch(() => setAcademy([]));
    }, [viewLevel, f.latestYear, r, month, settings.subjectCode]),
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

  // 운영자: 학원 일정 길게 눌러 숨기기 (잘못 읽힌 자동 수집 일정, 0030)
  const hideEvent = (i: Item) =>
    Alert.alert('이 일정을 숨길까요?', `${i.title}\n자동 수집으로 다시 들어와도 계속 숨겨져요.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '숨기기',
        style: 'destructive',
        onPress: async () => {
          const { error: e } = await supabase.rpc('admin_hide_event', { p_id: Number(i.key.slice(2)) });
          if (e) return Alert.alert('숨기지 못했어요', e.message.includes('admin_hide_event') ? '0030 SQL을 먼저 실행해 주세요' : e.message);
          setAcademy((a) => (a ?? []).filter((x) => x.key !== i.key));
        },
      },
    ]);
  const Badge = ({ k }: { k: Kind }) => (
    <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.cat[KIND_CAT[k]].bg }}>
      <Txt style={{ fontSize: 11.5, fontWeight: '700', color: colors.cat[KIND_CAT[k]].fg }}>{KIND_LABEL[k]}</Txt>
    </View>
  );
  const Row = ({ i, first }: { i: Item; first: boolean }) => {
    const past = i.date < today;
    return (
      <Pressable
        disabled={!i.url && !(isAdmin && i.key.startsWith('a-'))}
        onPress={() => openLink(i.url, i.title)}
        onLongPress={isAdmin && i.key.startsWith('a-') ? () => hideEvent(i) : undefined}
        style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.md, marginHorizontal: space.lg, borderTopWidth: first ? 0 : 1, borderTopColor: colors.line, opacity: past ? 0.5 : 1 }}
      >
        <View style={{ width: 40, alignItems: 'center' }}>
          <Txt style={{ fontWeight: '700', fontSize: 20 }}>{Number(i.date.slice(8))}</Txt>
          <Txt variant="sub" style={{ fontSize: 12 }}>
            {Number(i.date.slice(5, 7))}월 {WEEK[new Date(`${i.date}T00:00:00`).getDay()]}
          </Txt>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Badge k={i.kind} />
            {!past && <Txt variant="sub" style={{ fontWeight: '600', fontSize: 12.5 }}>{dDayLabel(i.date, today)}</Txt>}
          </View>
          <Txt style={{ fontWeight: '600', fontSize: 15 }}>{i.title}</Txt>
          {(i.sub || i.endsOn) && (
            <Txt variant="sub">
              {[i.sub, i.endsOn ? `~ ${i.endsOn.slice(5).replace('-', '.')}` : null].filter(Boolean).join(' · ')}
            </Txt>
          )}
        </View>
        {!past && alertsAvailable() && (
          <Pressable
            onPress={async () => {
              if (!alertPrefs.enabled && !(await enableAlerts())) return;
              await toggleSavedSchedule({ key: i.key, date: i.date, title: i.title, sub: i.sub });
            }}
            hitSlop={10}
            accessibilityLabel={bell.has(i.key) ? '알림 끄기' : '하루 전 알림 받기'}
          >
            <Ionicons name={bell.has(i.key) ? 'notifications' : 'notifications-outline'} size={19} color={bell.has(i.key) ? colors.cat.amber.fg : colors.textSub} />
          </Pressable>
        )}
        {i.url && <Ionicons name="open-outline" size={16} color={colors.textSub} />}
      </Pressable>
    );
  };

  // 시안 A: 달마다 묶어 흰 카드, 묶음 이름은 카드 위 작은 회색 글씨
  const List = ({ list, grouped = true }: { list: Item[]; grouped?: boolean }) => {
    if (list.length === 0) return <Txt variant="sub">일정이 없어요.</Txt>;
    const groups: { label: string; items: Item[] }[] = [];
    list.forEach((i) => {
      const label = grouped ? `${Number(i.date.slice(0, 4))}년 ${Number(i.date.slice(5, 7))}월` : '';
      const g = groups[groups.length - 1];
      if (g && g.label === label) g.items.push(i);
      else groups.push({ label, items: [i] });
    });
    return (
      <View style={{ gap: space.sm }}>
        {groups.map((g) => (
          <View key={g.label || 'all'} style={{ gap: 6 }}>
            {!!g.label && <Txt variant="sub" style={{ fontSize: 13, fontWeight: '600', paddingHorizontal: 6 }}>{g.label}</Txt>}
            <View style={{ borderRadius: radius.xl, backgroundColor: colors.background, overflow: 'hidden', paddingVertical: 2 }}>
              {g.items.map((i, n) => (
                <Row key={i.key} i={i} first={n === 0} />
              ))}
            </View>
          </View>
        ))}
      </View>
    );
  };

  // 목록: 오늘 이후 먼저, 지난 일정은 아래 접어서
  const upcoming = items.filter((i) => (i.endsOn ?? i.date) >= today);
  const past = items.filter((i) => (i.endsOn ?? i.date) < today).reverse();
  const [showPast, setShowPast] = useState(false);
  const nextOfficial = (official ?? []).filter((i) => i.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];

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
      {nextOfficial && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.cat.teal.bg }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="flag-outline" size={20} color={colors.cat.teal.fg} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt style={{ fontSize: 13, fontWeight: '700', color: colors.cat.teal.fg }}>다음 임용 일정 · {nextOfficial.sub}</Txt>
            <Txt style={{ fontSize: 16, fontWeight: '800' }}>
              {nextOfficial.title} {Number(nextOfficial.date.slice(5, 7))}.{Number(nextOfficial.date.slice(8))}
            </Txt>
          </View>
          <Txt style={{ fontSize: 22, fontWeight: '800', color: colors.cat.teal.fg }}>{dDayLabel(nextOfficial.date, today)}</Txt>
        </View>
      )}
      {!settings.regionCodes.length && <Txt variant="sub">관심 지역을 고르면 그 지역 일정이 보여요. 지금은 서울 예시예요.</Txt>}
      {/* 일정 제보 (2026-11-22): 학원 일정은 제보로 채움 — 위에서 바로 보이게 */}
      <View style={{ gap: space.sm, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.cat.pink.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Ionicons name="megaphone-outline" size={18} color={colors.cat.pink.fg} />
          <Txt style={{ flex: 1, fontSize: 16, fontWeight: '700', color: colors.cat.pink.fg }}>학원 일정 제보하기</Txt>
        </View>
        <Txt variant="sub" style={{ fontSize: 13 }}>
          {academy !== null && academy.length === 0 ? '이번 달 학원 일정이 아직 없어요. ' : ''}모의고사·개강·설명회·특강·인강 오픈 무엇이든 알려 주세요. 학원 공지
          캡처·사진·PDF·주소만 보내도 돼요. 운영자가 확인하고 올려요.
        </Txt>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <PracticeTipButton univ="일정" year={null} topic="event" label="캡처·사진으로 제보" variant="primary" />
          </View>
          <View style={{ flex: 1 }}>
            <EventTipButton level={viewLevel} label="직접 입력해 제보" variant="outline" />
          </View>
        </View>
      </View>
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
          <View style={{ borderRadius: radius.xl, backgroundColor: colors.background, padding: 6 }}>
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
                      style={{ flex: 1, minHeight: 78, alignItems: 'stretch', paddingTop: 4, paddingHorizontal: 1, gap: 2, borderRadius: radius.md, backgroundColor: sel ? colors.cat.teal.bg : 'transparent' }}
                    >
                      {d && (
                        <View style={{ alignSelf: 'center', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? colors.brand : 'transparent' }}>
                          <Txt style={{ fontSize: 13.5, fontWeight: isToday ? '700' : '500', color: isToday ? colors.background : i === 0 ? colors.down : colors.text }}>{Number(d.slice(8))}</Txt>
                        </View>
                      )}
                      {/* 2026-11-23: 점 대신 짧은 제목 (칸마다 2개 + 나머지 수) */}
                      {list.slice(0, 2).map((x) => (
                        <View key={x.key} style={{ borderRadius: 4, paddingHorizontal: 2, paddingVertical: 1, backgroundColor: colors.cat[KIND_CAT[x.kind]].bg }}>
                          <Txt numberOfLines={1} style={{ fontSize: 9.5, lineHeight: 12, fontWeight: '600', color: colors.cat[KIND_CAT[x.kind]].fg }}>
                            {shortTitle(x.title)}
                          </Txt>
                        </View>
                      ))}
                      {list.length > 2 && <Txt style={{ fontSize: 9.5, lineHeight: 12, textAlign: 'center', color: colors.textSub }}>+{list.length - 2}</Txt>}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <List grouped={false} list={day ? byDate.get(day) ?? [] : items.filter((i) => i.date.startsWith(ym(month)))} />
        </>
      )}
      <Txt variant="sub" style={{ fontSize: 12 }}>
        임용 일정은 교육청 시행계획 공고 기준이에요. 학원 일정은 학원 누리집 공지에서 매일 자동으로 모으고, 이용자 제보는 운영자가 확인해 올려요(광고 아님). 날짜는 학원 사정으로 바뀔 수 있으니 눌러서 원문을 확인해 주세요.
      </Txt>
    </Screen>
  );
}
