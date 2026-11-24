import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { TextInput } from '../../components/TextField';
import { ViewModeBanner } from '../../components/ModeToggle';
import { Chip, PrimaryButton, Screen, Txt } from '../../components/ui';
import { Ad, Area, LECTURE_AREA, Lecture, listAds, listLectures, requestLecture } from '../../data/academy';
import { PublicResources } from '../../features/study/PublicResources';
import { MockList } from '../../features/study/StudyBoard';
import { subjectByCode } from '../../data/subjects';
import { Sheet } from '../../features/community/parts';
import { useAppSettings } from '../../store/AppSettings';
import { useAuth } from '../../store/Auth';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { openLink } from '../../lib/openLink';

type Tab = 'lectures' | 'mock' | 'public';
const TAB_CAT = { lectures: 'pink', mock: 'coral', public: 'teal' } as const;

// 공부 탭 (2026-11-21 개편): 학원·인강 강의 후기(수강 인증자만) / 모의고사(점수 기록·후기). 학원 일정은 '일정' 탭으로. 광고는 따로 표시
export default function AcademyScreen() {
  const { colors } = useTheme();
  const { settings, viewLevel } = useAppSettings();
  const { session } = useAuth();
  const subject = viewLevel === 'secondary' ? settings.subjectCode : null;
  const [tab, setTab] = useState<Tab>('lectures');
  // 홈 바로가기 '공개 자료'(2026-11-24)에서 tab=public 으로 들어옴
  const params = useLocalSearchParams<{ tab?: string; t?: string }>();
  useEffect(() => {
    if (params.tab === 'public' || params.tab === 'mock' || params.tab === 'lectures') setTab(params.tab);
  }, [params.tab, params.t]);
  const [area, setArea] = useState<Area | null>(null);
  const [sort, setSort] = useState<'rating' | 'reviews'>('rating');
  const [lectures, setLectures] = useState<Lecture[] | null>(null);
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
    }, [tab, viewLevel, area, subject]),
  );

  // 과목별 비교: 평점(후기 3개 이상 우선) 또는 후기 많은 순
  const sorted = useMemo(() => {
    const list = [...(lectures ?? [])];
    if (sort === 'reviews') return list.sort((a, b) => b.reviewCount - a.reviewCount);
    return list.sort((a, b) => Number(b.reviewCount >= 3) - Number(a.reviewCount >= 3) || (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0));
  }, [lectures, sort]);

  return (
    <Screen>
      <ViewModeBanner />
      {/* 두 가지 메뉴: 아이콘 카드, 고른 것은 초록으로 채움 */}
      <View style={{ flexDirection: 'row', paddingVertical: 16, paddingHorizontal: space.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line }}>
        {(
          [
            { value: 'lectures', icon: 'star-outline', label: '학원·인강 후기' },
            { value: 'mock', icon: 'clipboard-outline', label: '모의고사' },
            { value: 'public', icon: 'library-outline', label: '공개 자료' },
          ] as const
        ).map((o) => {
          const on = tab === o.value;
          return (
            <Pressable key={o.value} onPress={() => setTab(o.value)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: on ? colors.cat[TAB_CAT[o.value]].fg : colors.cat[TAB_CAT[o.value]].bg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={o.icon} size={22} color={on ? colors.background : colors.cat[TAB_CAT[o.value]].fg} />
              </View>
              <Txt style={{ fontSize: 12.5, fontWeight: on ? '800' : '600' }} color={on ? 'text' : 'textSub'}>
                {o.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      {tab === 'lectures' && (
        <Txt variant="sub">
          {viewLevel === 'elementary' ? '교육학 + 초등' : `교육학 + ${subjectByCode(subject)?.name ?? '중등'} 전공`} 강의예요. 후기는 수강 인증을 받은 사람만 쓸 수 있어요.
        </Txt>
      )}
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
      ) : tab === 'mock' ? (
        <MockList />
      ) : (
        <PublicResources />
      )}

      {/* 광고는 후기와 섞지 않고 맨 아래 따로 */}
      {ads.length > 0 && (
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          {ads.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => openLink(a.url, a.academyName ?? '광고')}
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
