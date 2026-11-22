import { useEffect } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { markNewsSeen, unseenOf, useSeenNews } from '../../store/seenNews';
import { SampleBadge } from '../../components/DataBits';
import { useModeLabel, ViewModeBanner } from '../../components/ModeToggle';
import { Txt } from '../../components/ui';
import { AppMark } from '../../components/AppMark';
import { daysUntil, dDayLabel, EVENT_LABEL, getReceiptInfo, shortDate } from '../../data/receiptStatus';
import { regionByCode } from '../../data/regions';
import { getNotices, getRegionSummaries, getSchedules } from '../../data/repository';
import { subjectByCode } from '../../data/subjects';
import { NationalSchoolMap } from '../../features/region/NationalSchoolMap';
import { useAsync } from '../../data/useAsync';
import { HomeHotPosts } from '../../features/community/HomeHotPosts';
import { NoticeBoard, NoticeRow } from '../../features/news/NoticeList';
import { useRegionFilters } from '../../features/region/useRegionFilters';
import { Level, useAppSettings, useToday } from '../../store/AppSettings';
import { getTeacherJobs, isOpen, jobsFor } from '../../data/jobs';
import { CatKey, radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { ScheduleEventType } from '../../types/data';

// D-day로 크게 보여줄 주요 일정
const KEY_EVENTS: ScheduleEventType[] = ['receipt_start', 'receipt_end', 'first_exam', 'first_result', 'second_exam', 'final_result'];

// 홈: D-day·일정, 관심 지역 선발 인원, 바로가기, (v1) 새 스터디·인기글
export default function HomeScreen() {
  const { settings, viewLevel, setViewLevel } = useAppSettings();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const today = useToday();
  const modeLabel = useModeLabel();
  const f = useRegionFilters();
  const interest = settings.regionCodes;
  // 일정 기준 지역: 첫 번째 관심 지역 (없으면 서울로 예시)
  const scheduleRegion = interest[0] ?? 'seoul';

  const rows = useAsync(
    () => (f.ready ? getRegionSummaries(f.query, f.latestYear!) : Promise.resolve([])),
    [f.ready, f.query, f.latestYear],
  );
  const schedules = useAsync(
    () => (f.latestYear ? getSchedules(f.viewLevel, f.latestYear) : Promise.resolve([])),
    [f.viewLevel, f.latestYear],
  );

  const notices = useAsync(() => getNotices(f.viewLevel, 300), [f.viewLevel]);
  // 관심 지역 소식 먼저, 없으면 전체에서 최근 4개
  const allNotices = notices.data ?? [];
  const mineNotices = allNotices.filter((x) => interest.includes(x.region));
  const homeNotices = (mineNotices.length >= 2 ? mineNotices : allNotices).slice(0, 4);
  // B-8 새 소식: 관심 지역(없으면 전체) 공고 중 안 본 것
  const seen = useSeenNews();
  const newsPool = (interest.length ? mineNotices : allNotices).map((x) => x.url);
  const unseen = unseenOf(seen, newsPool);
  useEffect(() => {
    if (seen.ready && !seen.init && notices.data) markNewsSeen((notices.data ?? []).map((x) => x.url));
  }, [seen.ready, seen.init, notices.data]);
  const summaryOf = (year: number, region: string) =>
    year === f.latestYear ? (rows.data ?? []).find((r) => r.region === region) : undefined;

  const regionEvents = (schedules.data ?? []).filter((s) => s.region === scheduleRegion);
  const nextKey = regionEvents.find((e) => KEY_EVENTS.includes(e.event) && daysUntil(e.date, today) >= 0) ?? null;
  const upcoming = regionEvents.filter((e) => daysUntil(e.date, today) >= 0).slice(0, 4);
  const statusOf = (region: string) =>
    getReceiptInfo((schedules.data ?? []).filter((s) => s.region === region), today);

  const interestRows = (rows.data ?? []).filter((r) => interest.includes(r.region));
  const subjectNote =
    f.isSecondary && f.mySubjectMissing
      ? `내 과목(${subjectByCode(settings.subjectCode)?.name})은 샘플이 없어 ${subjectByCode(f.subject)?.name}(으)로 보여드려요.`
      : null;

  const openDetail = (region: string) =>
    router.push({
      pathname: '/regions/[code]',
      params: { code: region, level: f.viewLevel, subject: f.isSecondary ? (f.subject ?? '') : '', year: String(f.latestYear) },
    });

  const jobs = useAsync(() => getTeacherJobs(), []);
  const openJobs = jobsFor(jobs.data ?? [], viewLevel).filter((j) => isOpen(j, today)).length;
  const onBrand = colors.background; // 브랜드색 위 글자 (라이트: 흰색, 다크: 아주 어두운 색)
  const nextAfter = nextKey ? upcoming.find((e) => e !== nextKey && KEY_EVENTS.includes(e.event)) : undefined;
  const receipt = getReceiptInfo(regionEvents, today);
  const card = { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line, borderRadius: 20, overflow: 'hidden' as const };
  // 색 아이콘 메뉴 (에브리타임 참고, 2026-11-21 시안 승인)
  const menu: { icon: keyof typeof Ionicons.glyphMap; label: string; cat: CatKey; go: () => void; badge?: number }[] = [
    { icon: 'school-outline', label: '학교 지도', cat: 'teal', go: () => router.push('/school-map') },
    { icon: 'map-outline', label: '선발 지도', cat: 'blue', go: () => router.navigate('/region') },
    { icon: 'git-compare-outline', label: '지역 비교', cat: 'purple', go: () => router.push('/compare') },
    { icon: 'trending-up-outline', label: '추이', cat: 'coral', go: () => router.push('/trend') },
    { icon: 'briefcase-outline', label: '사립 채용', cat: 'amber', go: () => router.push({ pathname: '/news', params: { type: 'jobs' } }), badge: openJobs },
    { icon: 'calendar-outline', label: '일정', cat: 'pink', go: () => router.navigate('/schedule') },
    { icon: 'people-outline', label: '스터디', cat: 'green', go: () => router.navigate({ pathname: '/community', params: { board: 'study' } }) },
    { icon: 'megaphone-outline', label: '임용 소식', cat: 'gray', go: () => router.push('/news'), badge: unseen.length },
  ];
  const SectionHead = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
      <Txt style={{ fontSize: 18, fontWeight: '800' }}>{title}</Txt>
      {action && (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Txt variant="sub" style={{ fontWeight: '700' }}>
            {action} ›
          </Txt>
        </Pressable>
      )}
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: space.xl * 2 }}>
      {focused && <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />}

      {/* 머리: 앱 이름 + 초등/중등 + 검색·설정 */}
      <View style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <AppMark size={30} />
        <Txt style={{ fontSize: 21, fontWeight: '800', letterSpacing: -0.5 }}>임용몽땅</Txt>
        <View style={{ flexDirection: 'row', marginLeft: 4, padding: 2, borderRadius: radius.pill, backgroundColor: colors.surface }}>
          {(['elementary', 'secondary'] as Level[]).map((lv) => {
            const on = viewLevel === lv;
            return (
              <Pressable
                key={lv}
                onPress={() => setViewLevel(lv)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{ paddingHorizontal: 11, height: 28, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: on ? colors.cat.teal.bg : 'transparent' }}
              >
                <Txt style={{ fontSize: 13, fontWeight: '800', color: on ? colors.cat.teal.fg : colors.textSub }}>{lv === 'elementary' ? '초등' : '중등'}</Txt>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => router.push('/search')} accessibilityLabel="통합 검색" hitSlop={6} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="search" size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => router.push('/settings')} accessibilityLabel="설정" hitSlop={6} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="settings-outline" size={23} color={colors.text} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: space.lg, gap: 22, paddingTop: space.sm }}>
        {/* D-day 카드 */}
        <View style={{ backgroundColor: colors.brand, borderRadius: 22, padding: 20, gap: 6 }}>
          {nextKey ? (
            <>
              <Txt style={{ color: onBrand, fontSize: 14, opacity: 0.85 }}>
                {regionByCode(scheduleRegion)?.shortName} · {EVENT_LABEL[nextKey.event]}까지
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
                <Txt style={{ color: onBrand, fontSize: 46, fontWeight: '800', letterSpacing: -1.5, lineHeight: 52 }}>{dDayLabel(nextKey.date, today)}</Txt>
                <Txt style={{ color: onBrand, fontSize: 15, opacity: 0.85 }}>{shortDate(nextKey.date)}</Txt>
              </View>
              {nextAfter && (
                <Txt style={{ color: onBrand, fontSize: 13.5, opacity: 0.85 }}>
                  다음은 {EVENT_LABEL[nextAfter.event]} {shortDate(nextAfter.date)}
                </Txt>
              )}
            </>
          ) : (
            <Txt style={{ color: onBrand, fontSize: 19, fontWeight: '800' }}>올해 일정이 모두 끝났어요. 다음 시행계획을 기다려요.</Txt>
          )}
          {receipt && (
            <View style={{ alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 11, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: onBrand + '26' }}>
              <Txt style={{ color: onBrand, fontSize: 12.5, fontWeight: '800' }}>{receipt.detail}</Txt>
            </View>
          )}
          {interest.length === 0 && <Txt style={{ color: onBrand, fontSize: 12.5, opacity: 0.8 }}>서울 일정 예시예요. 관심 지역을 고르면 그 지역 일정으로 바뀌어요.</Txt>}
        </View>

        {/* 색 아이콘 메뉴 */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 }}>
          {menu.map((b) => (
            <Pressable key={b.label} onPress={b.go} accessibilityRole="button" accessibilityLabel={b.label} style={{ width: '25%', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: colors.cat[b.cat].bg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={b.icon} size={26} color={colors.cat[b.cat].fg} />
                {!!b.badge && (
                  <View style={{ position: 'absolute', top: -4, right: -6, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: colors.down, alignItems: 'center', justifyContent: 'center' }}>
                    <Txt style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>{b.badge > 99 ? '99+' : b.badge}</Txt>
                  </View>
                )}
              </View>
              <Txt style={{ fontSize: 13, fontWeight: '600' }}>{b.label}</Txt>
            </Pressable>
          ))}
        </View>

        <ViewModeBanner />
        <SampleBadge sourceIds={(rows.data ?? []).map((r) => r.source?.id)} />

        {/* 관심 지역: 정사각형 칸 */}
        <View style={{ gap: space.sm + 2 }}>
          <SectionHead title={`관심 지역 ${f.isSecondary ? `× ${subjectByCode(f.subject)?.name ?? ''} ` : ''}선발 인원`} action="편집" onAction={() => router.push('/settings')} />
          {subjectNote && (
            <Txt variant="sub" color="accent">
              {subjectNote}
            </Txt>
          )}
          {interest.length === 0 ? (
            <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" style={{ backgroundColor: colors.surface, borderRadius: 18, padding: space.lg, gap: space.xs }}>
              <Txt>관심 지역을 고르면 선발 인원과 증감을 바로 볼 수 있어요.</Txt>
              <Txt color="brand" style={{ fontWeight: '800' }}>
                관심 지역 고르기 ›
              </Txt>
            </Pressable>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {interestRows.map((r) => {
                const info = statusOf(r.region);
                const tone = r.change == null ? colors.textSub : r.change > 0 ? colors.up : r.change < 0 ? colors.down : colors.textSub;
                const sign = r.change == null ? '' : r.change > 0 ? '▲ ' : r.change < 0 ? '▼ ' : '– ';
                return (
                  <Pressable
                    key={r.region}
                    onPress={() => openDetail(r.region)}
                    accessibilityRole="button"
                    accessibilityLabel={`${regionByCode(r.region)?.shortName} 선발 ${r.selection ?? '자료 없음'}명`}
                    style={{ width: '48.5%', minHeight: 112, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, justifyContent: 'space-between' }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Txt style={{ fontSize: 15, fontWeight: '800' }}>{regionByCode(r.region)?.shortName}</Txt>
                      <Ionicons name="chevron-forward" size={14} color={colors.textSub} />
                    </View>
                    <View style={{ gap: 2 }}>
                      <Txt style={{ fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }} numberOfLines={1} adjustsFontSizeToFit>
                        {r.selection?.toLocaleString() ?? '—'}
                        <Txt variant="sub"> 명</Txt>
                      </Txt>
                      <Txt style={{ fontSize: 13.5, fontWeight: '800', color: tone }} numberOfLines={1}>
                        {r.change == null ? '전년 자료 없음' : `${sign}${Math.abs(r.change).toLocaleString()}`}
                      </Txt>
                      {info?.status === 'open' && (
                        <Txt variant="sub" color="brand" style={{ fontSize: 11.5, fontWeight: '800' }}>
                          ● 접수 중
                        </Txt>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* 전국 학교 지도: 초등 = 초등학교, 중등 = 중·고등학교 */}
        <View style={{ gap: space.sm + 2 }}>
          <SectionHead title={`전국 ${viewLevel === 'elementary' ? '초등학교' : '중·고등학교'} 지도`} action="크게 보기" onAction={() => router.push('/school-map')} />
          <View style={[card, { padding: space.md, gap: space.sm }]}>
            <NationalSchoolMap level={viewLevel} maxHeight={420} />
          </View>
        </View>

        {/* 임용 소식 */}
        <NoticeBoard
          title="임용 소식"
          action={
            <Pressable onPress={() => router.push('/news')} hitSlop={8} accessibilityRole="button">
              <Txt variant="sub" color="brand" style={{ fontWeight: '800' }}>
                전체
              </Txt>
            </Pressable>
          }
        >
          {homeNotices.length === 0 ? (
            <Txt variant="sub" style={{ padding: space.lg }}>
              교육청 공고를 모으는 중이에요. 곧 사전예고·시행계획·접수 현황·합격 발표가 올라와요.
            </Txt>
          ) : (
            homeNotices.map((x, i) => (
              <NoticeRow key={x.url} unread={unseen.includes(x.url)} item={x} summary={summaryOf(x.year, x.region)} highlight={interest.includes(x.region)} last={i === homeNotices.length - 1} />
            ))
          )}
        </NoticeBoard>

        {/* 커뮤니티 인기글 */}
        <HomeHotPosts />
      </View>
    </ScrollView>
  );
}

