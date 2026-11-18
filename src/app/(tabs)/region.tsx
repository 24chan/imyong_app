import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SampleBadge, SourceNote } from '../../components/DataBits';
import { ViewModeBanner } from '../../components/ModeToggle';
import { Chip, Screen, Segmented, Txt } from '../../components/ui';
import { getReceiptInfo } from '../../data/receiptStatus';
import { getAvailableSubjects, getRegionSummaries, getSchedules, getYears } from '../../data/repository';
import { subjectByCode } from '../../data/subjects';
import { useAsync } from '../../data/useAsync';
import { KoreaMap } from '../../features/region/KoreaMap';
import { METRIC_OPTIONS, MapMetric } from '../../features/region/metrics';
import { RegionRow, RegionTile } from '../../features/region/RegionCards';
import { RegionSheet } from '../../features/region/RegionSheet';
import { RegionView, useAppSettings, useToday } from '../../store/AppSettings';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const VIEW_OPTIONS: { value: RegionView; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { value: 'map', icon: 'map-outline', label: '지도로 보기' },
  { value: 'list', icon: 'list-outline', label: '한 줄씩 보기' },
  { value: 'grid', icon: 'grid-outline', label: '두 칸씩 보기' },
];

// 지역·TO: 지도 / 목록 / 격자 보기. 지도에서 지역을 누르면 바텀시트, 목록에서 누르면 지역 상세.
export default function RegionScreen() {
  const { settings, update, viewLevel } = useAppSettings();
  const { colors } = useTheme();
  const today = useToday();
  const isSecondary = viewLevel === 'secondary';
  const view = settings.regionView;

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

  const [metric, setMetric] = useState<MapMetric>('selection');
  const [sheetRegion, setSheetRegion] = useState<string | null>(null);

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
    isLatest ? getReceiptInfo((schedules.data ?? []).filter((s) => s.region === region), today) : null;

  const openDetail = (region: string) => {
    setSheetRegion(null);
    router.push({
      pathname: '/regions/[code]',
      params: { code: region, level: viewLevel, subject: isSecondary ? (subject ?? '') : '', year: String(year) },
    });
  };

  const modeTitle = isSecondary ? `중등 · ${subjectByCode(subject)?.name ?? ''}` : '초등';
  const sheetRow = rows.data?.find((r) => r.region === sheetRegion) ?? null;

  return (
    <Screen>
      <ViewModeBanner />

      {/* 제목 + 오른쪽 위 보기 방식 선택 */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
        <View style={{ flex: 1, gap: space.xs }}>
          <SampleBadge />
          <Txt variant="title">{modeTitle} 선발 인원</Txt>
        </View>
        <View
          style={{
            flexDirection: 'row',
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: radius.md,
            overflow: 'hidden',
          }}
        >
          {VIEW_OPTIONS.map((o) => {
            const active = view === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => update({ regionView: o.value })}
                accessibilityRole="button"
                accessibilityLabel={o.label}
                accessibilityState={{ selected: active }}
                style={{ padding: 8, backgroundColor: active ? colors.brand : colors.background }}
              >
                <Ionicons name={o.icon} size={20} color={active ? colors.background : colors.textSub} />
              </Pressable>
            );
          })}
        </View>
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

      {rows.data && rows.data.length > 0 && (
        <>
          {view === 'map' && (
            <>
              <Segmented<MapMetric> value={metric} onChange={setMetric} options={METRIC_OPTIONS} />
              <KoreaMap rows={rows.data} metric={metric} selected={sheetRegion} onSelect={setSheetRegion} />
              <Txt variant="sub">지역이나 숫자를 누르면 자세히 볼 수 있어요.</Txt>
            </>
          )}

          {view === 'list' &&
            rows.data.map((r) => (
              <RegionRow key={r.region} row={r} info={statusOf(r.region)} onPress={() => openDetail(r.region)} />
            ))}

          {view === 'grid' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md }}>
              {rows.data.map((r) => (
                <RegionTile key={r.region} row={r} info={statusOf(r.region)} onPress={() => openDetail(r.region)} />
              ))}
            </View>
          )}

          <Txt variant="sub">경쟁률은 접수 기준이에요. 응시 기준은 지역 상세에서 볼 수 있어요.</Txt>
          <SourceNote source={rows.data[0].source} baseDate={rows.data[0].baseDate} />
        </>
      )}

      <RegionSheet
        row={sheetRow}
        info={sheetRegion ? statusOf(sheetRegion) : null}
        title={`${year}학년도 ${modeTitle}`}
        onClose={() => setSheetRegion(null)}
        onOpenDetail={openDetail}
      />
    </Screen>
  );
}
