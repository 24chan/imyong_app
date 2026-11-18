import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { ChangeBadge, SampleBadge, StatusBadge } from '../../components/DataBits';
import { useModeLabel, ViewModeBanner } from '../../components/ModeToggle';
import { Card, Screen, Txt } from '../../components/ui';
import { daysUntil, dDayLabel, EVENT_LABEL, getReceiptInfo, shortDate } from '../../data/receiptStatus';
import { regionByCode } from '../../data/regions';
import { getNotices, getRegionSummaries, getSchedules } from '../../data/repository';
import { subjectByCode } from '../../data/subjects';
import { useAsync } from '../../data/useAsync';
import { NoticeBoard, NoticeRow } from '../../features/news/NoticeList';
import { useRegionFilters } from '../../features/region/useRegionFilters';
import { useAppSettings, useToday } from '../../store/AppSettings';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { ScheduleEventType } from '../../types/data';

// D-day로 크게 보여줄 주요 일정
const KEY_EVENTS: ScheduleEventType[] = ['receipt_start', 'receipt_end', 'first_exam', 'first_result', 'second_exam', 'final_result'];

// 홈: D-day·일정, 관심 지역 선발 인원, 바로가기, (v1) 새 스터디·인기글
export default function HomeScreen() {
  const { settings } = useAppSettings();
  const { colors } = useTheme();
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

  return (
    <Screen>
      <ViewModeBanner />

      <View style={{ gap: space.xs }}>
        <Txt variant="sub" color="brand" style={{ fontWeight: '800' }}>
          {modeLabel} 임용
        </Txt>
        <SampleBadge sourceIds={(rows.data ?? []).map((r) => r.source?.id)} />
      </View>

      {/* D-day */}
      <Card>
        <Txt variant="sub">
          {f.latestYear}학년도 · {regionByCode(scheduleRegion)?.shortName} 일정 기준
          {interest.length === 0 ? ' (관심 지역을 고르면 그 지역 일정으로 바뀌어요)' : ''}
        </Txt>
        {nextKey ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, flexWrap: 'wrap' }}>
            <Txt variant="number" color="brand" style={{ fontSize: 36 }}>
              {dDayLabel(nextKey.date, today)}
            </Txt>
            <Txt variant="heading" style={{ marginBottom: 6 }}>
              {EVENT_LABEL[nextKey.event]} · {shortDate(nextKey.date)}
            </Txt>
          </View>
        ) : (
          <Txt variant="heading">올해 일정이 모두 끝났어요. 다음 시행계획을 기다려요.</Txt>
        )}
        {(() => {
          const info = getReceiptInfo(regionEvents, today);
          return info ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
              <StatusBadge status={info.status} />
              <Txt variant="sub">{info.detail}</Txt>
            </View>
          ) : null;
        })()}
        {upcoming.length > 0 && (
          <View style={{ gap: 2, marginTop: space.xs }}>
            {upcoming.map((e) => (
              <View key={e.event} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Txt variant="sub" color="text">
                  {EVENT_LABEL[e.event]}
                </Txt>
                <Txt variant="sub">
                  {shortDate(e.date)} · {dDayLabel(e.date, today)}
                </Txt>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* 관심 지역 선발 인원 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt variant="heading">
          관심 지역 {f.isSecondary ? `× ${subjectByCode(f.subject)?.name ?? ''} ` : ''}선발 인원
        </Txt>
        <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
          <Txt variant="sub" color="brand" style={{ fontWeight: '700' }}>
            지역 편집
          </Txt>
        </Pressable>
      </View>
      {subjectNote && (
        <Txt variant="sub" color="accent">
          {subjectNote}
        </Txt>
      )}

      {interest.length === 0 ? (
        <Pressable onPress={() => router.push('/settings')} accessibilityRole="button">
          <Card>
            <Txt>관심 지역을 고르면 여기에서 선발 인원과 증감을 바로 볼 수 있어요.</Txt>
            <Txt color="brand" style={{ fontWeight: '700' }}>
              관심 지역 고르기 ›
            </Txt>
          </Card>
        </Pressable>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md }}>
          {interestRows.map((r) => {
            const info = statusOf(r.region);
            return (
              <Pressable
                key={r.region}
                onPress={() => openDetail(r.region)}
                accessibilityRole="button"
                style={{ width: interestRows.length === 1 ? '100%' : '48.5%' }}
              >
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Txt variant="heading">{regionByCode(r.region)?.shortName}</Txt>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSub} />
                  </View>
                  <Txt variant="number">
                    {r.selection?.toLocaleString() ?? '—'}
                    <Txt variant="sub"> 명</Txt>
                  </Txt>
                  <ChangeBadge change={r.change} rate={r.changeRate} />
                  {info && <StatusBadge status={info.status} />}
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* 임용 소식 (교육청 공고 모음) */}
      <NoticeBoard
        title="임용 소식"
        action={
          <Pressable onPress={() => router.push('/news')} hitSlop={8} accessibilityRole="button">
            <Txt variant="sub" color="brand" style={{ fontWeight: '700' }}>
              전체 보기 ›
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
            <NoticeRow
              key={x.url}
              item={x}
              summary={summaryOf(x.year, x.region)}
              highlight={interest.includes(x.region)}
              last={i === homeNotices.length - 1}
            />
          ))
        )}
      </NoticeBoard>

      {/* 바로가기 */}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {[
          { icon: 'map-outline' as const, label: '전국 지도', go: () => router.navigate('/region') },
          { icon: 'git-compare-outline' as const, label: '지역 비교', go: () => router.push('/compare') },
          { icon: 'trending-up-outline' as const, label: '추이 보기', go: () => router.push('/trend') },
        ].map((b) => (
          <Pressable
            key={b.label}
            onPress={b.go}
            accessibilityRole="button"
            style={{
              flex: 1,
              alignItems: 'center',
              gap: 4,
              paddingVertical: space.md,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
            }}
          >
            <Ionicons name={b.icon} size={22} color={colors.brand} />
            <Txt variant="sub" color="text" style={{ fontWeight: '700' }}>
              {b.label}
            </Txt>
          </Pressable>
        ))}
      </View>

      {/* v1에서 열릴 영역 */}
      <Card>
        <Txt variant="heading">새 스터디 · 인기글</Txt>
        <Txt variant="sub">
          {f.isSecondary ? '선택 과목' : '초등'} 스터디 모집과 커뮤니티 인기글이 여기에 보여요. (v1에서 열려요)
        </Txt>
      </Card>
    </Screen>
  );
}
