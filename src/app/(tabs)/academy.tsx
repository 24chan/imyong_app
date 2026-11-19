import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, TextInput, View } from 'react-native';
import { ViewModeBanner } from '../../components/ModeToggle';
import { Chip, PrimaryButton, Screen, Txt } from '../../components/ui';
import { AcademyEvent, Ad, Area, EVENT_KIND, LECTURE_AREA, Lecture, listAds, listEvents, listLectures, requestLecture } from '../../data/academy';
import { subjectByCode } from '../../data/subjects';
import { Sheet } from '../../features/community/parts';
import { useAppSettings } from '../../store/AppSettings';
import { useAuth } from '../../store/Auth';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

type Tab = 'lectures' | 'calendar';
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// 학원·인강: 강의 후기(수강 인증자만, 과목별 비교) / 개강·특강·모의고사 일정 / 광고는 따로 표시
export default function AcademyScreen() {
  const { colors } = useTheme();
  const { settings, viewLevel } = useAppSettings();
  const { session } = useAuth();
  const subject = viewLevel === 'secondary' ? settings.subjectCode : null;
  const [tab, setTab] = useState<Tab>('lectures');
  const [area, setArea] = useState<Area | null>(null);
  const [sort, setSort] = useState<'rating' | 'reviews'>('rating');
  const [lectures, setLectures] = useState<Lecture[] | null>(null);
  const [month, setMonth] = useState(() => new Date());
  const [events, setEvents] = useState<AcademyEvent[] | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [reqText, setReqText] = useState('');

  useFocusEffect(
    useCallback(() => {
      setError(null);
      const fail = (e: unknown) => setError((e as Error).message);
      listAds(viewLevel).then(setAds);
      if (tab === 'lectures') listLectures(viewLevel, area, subject).then(setLectures).catch(fail);
      else {
        const from = `${ym(month)}-01`;
        const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
        listEvents(viewLevel, from, `${ym(month)}-${last}`).then(setEvents).catch(fail);
      }
    }, [tab, viewLevel, area, subject, month]),
  );

  // 과목별 비교: 평점(후기 3개 이상 우선) 또는 후기 많은 순
  const sorted = useMemo(() => {
    const list = [...(lectures ?? [])];
    if (sort === 'reviews') return list.sort((a, b) => b.reviewCount - a.reviewCount);
    return list.sort((a, b) => Number(b.reviewCount >= 3) - Number(a.reviewCount >= 3) || (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0));
  }, [lectures, sort]);

  const byDate = useMemo(() => {
    const m = new Map<string, AcademyEvent[]>();
    (events ?? []).forEach((e) => m.set(e.startsOn, [...(m.get(e.startsOn) ?? []), e]));
    return [...m.entries()];
  }, [events]);

  return (
    <Screen>
      <ViewModeBanner />
      {/* 두 가지 메뉴: 아이콘 카드, 고른 것은 초록으로 채움 */}
      <View style={{ flexDirection: 'row', paddingVertical: 16, paddingHorizontal: space.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line }}>
        {(
          [
            { value: 'lectures', icon: 'star-outline', label: '강의 후기' },
            { value: 'calendar', icon: 'calendar-outline', label: '개강·특강 일정' },
          ] as const
        ).map((o) => {
          const on = tab === o.value;
          return (
            <Pressable key={o.value} onPress={() => setTab(o.value)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: on ? colors.brand : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={o.icon} size={22} color={on ? colors.background : colors.brand} />
              </View>
              <Txt style={{ fontSize: 12.5, fontWeight: on ? '800' : '600' }} color={on ? 'text' : 'textSub'}>
                {o.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      <Txt variant="sub">
        {viewLevel === 'elementary' ? '교육학 + 초등' : `교육학 + ${subjectByCode(subject)?.name ?? '중등'} 전공`} 강의예요. 후기는 수강 인증을 받은 사람만 쓸 수 있어요.
      </Txt>
      {error && <Txt color="down">{error}</Txt>}

      {tab === 'lectures' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            <Chip label="전체" selected={!area} onPress={() => setArea(null)} />
            {(Object.keys(LECTURE_AREA) as Area[]).map((a) => (
              <Chip key={a} label={LECTURE_AREA[a]} selected={area === a} onPress={() => setArea(a)} />
            ))}
            <View style={{ width: 1, backgroundColor: colors.line, marginHorizontal: 2 }} />
            <Chip label="평점순" selected={sort === 'rating'} onPress={() => setSort('rating')} />
            <Chip label="후기 많은 순" selected={sort === 'reviews'} onPress={() => setSort('reviews')} />
          </ScrollView>
          {lectures === null ? (
            <ActivityIndicator color={colors.brand} />
          ) : sorted.length === 0 ? (
            <Txt variant="sub">아직 등록된 강의가 없어요. 아래에서 추가를 요청해 주세요.</Txt>
          ) : (
            <View style={{ borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
              {sorted.map((l, i) => (
                <LectureRow key={l.id} l={l} first={i === 0} rank={sort === 'rating' && l.reviewCount >= 3 ? i + 1 : null} />
              ))}
            </View>
          )}
          <PrimaryButton label="찾는 강의가 없나요? 추가 요청" variant="ghost" onPress={() => (session ? setReqOpen(true) : router.push('/login'))} />
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
            <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} hitSlop={10} accessibilityLabel="이전 달">
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Txt variant="heading">
              {month.getFullYear()}년 {month.getMonth() + 1}월
            </Txt>
            <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} hitSlop={10} accessibilityLabel="다음 달">
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </Pressable>
          </View>
          {events === null ? (
            <ActivityIndicator color={colors.brand} />
          ) : byDate.length === 0 ? (
            <Txt variant="sub">이 달에 등록된 일정이 없어요.</Txt>
          ) : (
            <View style={{ borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
            {byDate.map(([date, list], i) => (
              <View key={date} style={{ flexDirection: 'row', gap: space.md, padding: space.md, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.line }}>
                <View style={{ width: 52, alignItems: 'center' }}>
                  <Txt style={{ fontWeight: '800', fontSize: 20 }}>{Number(date.slice(8))}</Txt>
                  <Txt variant="sub">{['일', '월', '화', '수', '목', '금', '토'][new Date(date).getDay()]}</Txt>
                </View>
                <View style={{ flex: 1, gap: space.sm }}>
                  {list.map((e) => (
                    <Pressable key={e.id} disabled={!e.url} onPress={() => e.url && Linking.openURL(e.url)} style={{ gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: (e.kind === 'mock' ? colors.down : e.kind === 'special' ? colors.accent : colors.brand) + '22' }}>
                          <Txt variant="sub" style={{ fontSize: 12, fontWeight: '700', color: e.kind === 'mock' ? colors.down : e.kind === 'special' ? colors.accent : colors.brand }}>
                            {EVENT_KIND[e.kind]}
                          </Txt>
                        </View>
                        {e.academyName && <Txt variant="sub">{e.academyName}</Txt>}
                      </View>
                      <Txt style={{ fontWeight: '700' }}>{e.title}</Txt>
                      {e.endsOn && <Txt variant="sub">~ {e.endsOn}</Txt>}
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            </View>
          )}
        </>
      )}

      {/* 광고는 후기와 섞지 않고 맨 아래 따로 */}
      {ads.length > 0 && (
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          {ads.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => a.url && Linking.openURL(a.url)}
              style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: 18, gap: 2 }}
            >
              <Txt variant="sub" style={{ fontWeight: '800' }}>
                광고{a.academyName ? ` · ${a.academyName}` : ''}
              </Txt>
              <Txt style={{ fontWeight: '700' }}>{a.title}</Txt>
              {a.body && <Txt variant="sub">{a.body}</Txt>}
            </Pressable>
          ))}
        </View>
      )}

      <Sheet visible={reqOpen} onClose={() => setReqOpen(false)} title="강의 추가 요청">
        <Txt variant="sub">학원·강사·강의 이름을 적어 주세요. 운영자가 확인하고 추가해요.</Txt>
        <TextInput
          value={reqText}
          onChangeText={setReqText}
          placeholder="예: ○○학원 ○○○ 강사 전공 수학 기본반"
          placeholderTextColor={colors.textSub}
          style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, color: colors.text }}
        />
        <PrimaryButton
          label="요청 보내기"
          disabled={reqText.trim().length < 2}
          onPress={() =>
            requestLecture(reqText)
              .then(() => {
                setReqOpen(false);
                setReqText('');
                Alert.alert('요청했어요');
              })
              .catch((e) => Alert.alert('보내지 못했어요', (e as Error).message))
          }
        />
      </Sheet>
    </Screen>
  );
}

function LectureRow({ l, rank, first }: { l: Lecture; rank: number | null; first: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/lecture/[id]', params: { id: String(l.id) } })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderTopWidth: first ? 0 : 1, borderTopColor: colors.line }}
    >
      <Txt style={{ width: 24, fontWeight: '800', color: rank && rank <= 3 ? colors.accent : colors.textSub }}>{rank ?? '·'}</Txt>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={{ fontWeight: '800' }} numberOfLines={1}>
          {l.instructor} · {l.title}
        </Txt>
        <Txt variant="sub">
          {l.academyName} · {LECTURE_AREA[l.area]}
          {l.subjectCode ? ` ${subjectByCode(l.subjectCode)?.name ?? ''}` : ''}
        </Txt>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name="star" size={14} color={colors.accent} />
          <Txt style={{ fontWeight: '800' }}>{l.ratingAvg != null ? l.ratingAvg.toFixed(1) : '-'}</Txt>
        </View>
        <Txt variant="sub" style={{ fontSize: 12 }}>
          후기 {l.reviewCount}
        </Txt>
      </View>
    </Pressable>
  );
}
