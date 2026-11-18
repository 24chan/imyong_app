import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { ChangeBadge, SampleBadge, SourceNote, StatusBadge, stageLabel } from '../../components/DataBits';
import { ViewModeBanner } from '../../components/ModeToggle';
import { Card, Chip, Screen, Txt } from '../../components/ui';
import { getReceiptInfo } from '../../data/receiptStatus';
import { regionByCode } from '../../data/regions';
import { getAvailableSubjects, getRegionSummaries, getSchedules, getYears } from '../../data/repository';
import { subjectByCode } from '../../data/subjects';
import { useAsync } from '../../data/useAsync';
import { useAppSettings, useToday } from '../../store/AppSettings';
import { space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// 지역·TO — 연도별 시도 선발 인원 목록. 지역을 누르면 상세(추이 그래프)로.
// 3단계에서 지도·바텀시트가 추가됩니다.
export default function RegionScreen() {
  const { settings, viewLevel } = useAppSettings();
  const { colors } = useTheme();
  const today = useToday();
  const isSecondary = viewLevel === 'secondary';

  const years = useAsync(getYears, []);
  const subjects = useAsync(getAvailableSubjects, []);
  const latestYear = years.data?.[0] ?? null;
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => {
    if (latestYear != null && year == null) setYear(latestYear);
  }, [latestYear, year]);
  const isLatest = year != null && year === latestYear;

  // 중등: 내 과목을 기본으로, 샘플이 없는 과목이면 첫 과목
  const [subject, setSubject] = useState<string | null>(null);
  const mySubjectHasData = !!settings.subjectCode && !!subjects.data?.includes(settings.subjectCode);
  useEffect(() => {
    if (!subjects.data) return;
    setSubject(mySubjectHasData ? settings.subjectCode : subjects.data[0]);
  }, [subjects.data, settings.subjectCode, mySubjectHasData]);

  const query = useMemo(
    () => ({ level: viewLevel, subject: isSecondary ? subject : null }),
    [viewLevel, isSecondary, subject],
  );
  const ready = year != null && (!isSecondary || subject != null);
  const rows = useAsync(
    () => (ready ? getRegionSummaries(query, year!) : Promise.resolve([])),
    [ready, query, year],
  );
  const schedules = useAsync(
    () => (isLatest ? getSchedules(viewLevel, year!) : Promise.resolve([])),
    [isLatest, viewLevel, year],
  );

  const statusOf = (region: string) =>
    getReceiptInfo((schedules.data ?? []).filter((s) => s.region === region), today);

  const openDetail = (region: string) =>
    router.push({
      pathname: '/regions/[code]',
      params: { code: region, level: viewLevel, subject: isSecondary ? (subject ?? '') : '', year: String(year) },
    });

  return (
    <Screen>
      <ViewModeBanner />

      <View style={{ gap: space.xs }}>
        <SampleBadge />
        <Txt variant="title">
          {isSecondary ? `중등 · ${subjectByCode(subject)?.name ?? ''}` : '초등'} 선발 인원
        </Txt>
        <Txt variant="sub">지역을 누르면 선발 인원·경쟁률 추이 그래프가 나와요.</Txt>
      </View>

      {/* 연도 선택 */}
      {years.data && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {years.data.map((y) => (
            <Chip key={y} label={`${y}학년도`} selected={year === y} onPress={() => setYear(y)} />
          ))}
        </ScrollView>
      )}

      {/* 중등: 과목 선택 */}
      {isSecondary && subjects.data && (
        <View style={{ gap: space.xs }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {subjects.data.map((code) => (
              <Chip
                key={code}
                label={subjectByCode(code)?.name ?? code}
                selected={subject === code}
                onPress={() => setSubject(code)}
              />
            ))}
          </ScrollView>
          {settings.level === 'secondary' && settings.subjectCode && !mySubjectHasData && (
            <Txt variant="sub" color="accent">
              내 과목({subjectByCode(settings.subjectCode)?.name})은 아직 샘플 데이터가 없어요.
            </Txt>
          )}
        </View>
      )}

      {rows.loading && <ActivityIndicator color={colors.brand} style={{ marginTop: space.xl }} />}
      {rows.error && <Txt color="down">데이터를 불러오지 못했어요: {rows.error.message}</Txt>}

      {rows.data?.map((r) => {
        const info = isLatest ? statusOf(r.region) : null;
        return (
          <Pressable key={r.region} onPress={() => openDetail(r.region)} accessibilityRole="button">
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ flex: 1, gap: space.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                  <Txt variant="heading">{regionByCode(r.region)?.shortName}</Txt>
                  {info && <StatusBadge status={info.status} />}
                </View>
                <ChangeBadge change={r.change} rate={r.changeRate} />
                {info && <Txt variant="sub">{info.detail}</Txt>}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <Txt variant="number">
                  {r.selection != null ? r.selection.toLocaleString() : '—'}
                  <Txt variant="sub"> 명</Txt>
                </Txt>
                <Txt variant="sub">
                  {stageLabel(r.selectionStage)}
                  {r.ratioApplied != null ? ` · ${r.ratioApplied} : 1` : ''}
                </Txt>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSub} />
            </Card>
          </Pressable>
        );
      })}

      {rows.data && rows.data.length > 0 && (
        <>
          <Txt variant="sub">경쟁률은 접수 기준이에요. 응시 기준은 지역 상세에서 볼 수 있어요.</Txt>
          <SourceNote source={rows.data[0].source} baseDate={rows.data[0].baseDate} />
        </>
      )}
    </Screen>
  );
}
