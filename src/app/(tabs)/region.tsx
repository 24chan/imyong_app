import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SampleBadge, SourcesSummary } from '../../components/DataBits';
import { ViewModeBanner } from '../../components/ModeToggle';
import { Screen, Segmented, Txt } from '../../components/ui';
import { getReceiptInfo } from '../../data/receiptStatus';
import { regionByCode } from '../../data/regions';
import { getRegionSummaries, getSchedules } from '../../data/repository';
import { subjectByCode } from '../../data/subjects';
import { useAsync } from '../../data/useAsync';
import { FilterChips } from '../../features/region/FilterChips';
import { KoreaMap } from '../../features/region/KoreaMap';
import { METRIC_OPTIONS, MapMetric } from '../../features/region/metrics';
import { RegionRow, RegionTile } from '../../features/region/RegionCards';
import { RegionSheet } from '../../features/region/RegionSheet';
import { useRegionFilters } from '../../features/region/useRegionFilters';
import { RegionView, useAppSettings, useCompare, useToday } from '../../store/AppSettings';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const VIEW_OPTIONS: { value: RegionView; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { value: 'map', icon: 'map-outline', label: '지도로 보기' },
  { value: 'list', icon: 'list-outline', label: '한 줄씩 보기' },
  { value: 'grid', icon: 'grid-outline', label: '세 칸씩 보기' },
];

// 지역·TO: 지도 / 한 줄 / 두 칸 보기. 지도에서 지역을 누르면 바텀시트, 목록에서 누르면 지역 상세.
export default function RegionScreen() {
  const { settings, update } = useAppSettings();
  const { colors } = useTheme();
  const today = useToday();
  const compare = useCompare();
  const f = useRegionFilters();
  const view = settings.regionView;

  const [metric, setMetric] = useState<MapMetric>('selection');
  const [sheetRegion, setSheetRegion] = useState<string | null>(null);

  const rows = useAsync(
    () => (f.ready ? getRegionSummaries(f.query, f.year!) : Promise.resolve([])),
    [f.ready, f.query, f.year],
  );
  const schedules = useAsync(
    () => (f.isLatest ? getSchedules(f.viewLevel, f.year!) : Promise.resolve([])),
    [f.isLatest, f.viewLevel, f.year],
  );

  const statusOf = (region: string) =>
    f.isLatest ? getReceiptInfo((schedules.data ?? []).filter((s) => s.region === region), today) : null;

  const openDetail = (region: string) => {
    setSheetRegion(null);
    router.push({
      pathname: '/regions/[code]',
      params: {
        code: region,
        level: f.viewLevel,
        subject: f.isSecondary ? (f.subject ?? '') : '',
        year: String(f.year),
      },
    });
  };

  const modeTitle = f.isSecondary ? `중등 · ${subjectByCode(f.subject)?.name ?? ''}` : '초등';
  const sheetRow = rows.data?.find((r) => r.region === sheetRegion) ?? null;

  return (
    <Screen>
      <ViewModeBanner />

      {/* 제목 + 오른쪽 위 보기 방식 선택 */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
        <View style={{ flex: 1, gap: space.xs }}>
          <SampleBadge sourceIds={(rows.data ?? []).map((r) => r.source?.id)} />
          <Txt variant="title">{modeTitle} 선발 인원</Txt>
        </View>
        <View
          style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 3, gap: 2 }}
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
                style={{ width: 40, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: active ? colors.brand : 'transparent' }}
              >
                <Ionicons name={o.icon} size={20} color={active ? colors.background : colors.textSub} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 비교 지역(최대 3개)으로 나란히 보기 / 추이 겹쳐 보기 */}
      <View style={{ gap: space.xs }}>
        <View style={{ flexDirection: 'row', paddingVertical: 16, paddingHorizontal: space.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.background }}>
          {[
            { href: '/compare' as const, icon: 'git-compare-outline' as const, label: '지역 비교' },
            { href: '/trend' as const, icon: 'trending-up-outline' as const, label: '추이' },
            { href: '/univ-pass' as const, icon: 'school-outline' as const, label: '대학별 합격률' },
          ].map((b) => (
            <Pressable key={b.href} onPress={() => router.push(b.href)} accessibilityRole="button" style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={b.icon} size={22} color={colors.brand} />
              </View>
              <Txt style={{ fontSize: 12.5, fontWeight: '700' }}>{b.label}</Txt>
            </Pressable>
          ))}
        </View>
        <Txt variant="sub">
          비교 지역:{' '}
          {compare.list.length > 0
            ? compare.list.map((c) => regionByCode(c)?.shortName).join(', ')
            : '아직 없음 (지역을 눌러 "비교에 추가")'}
        </Txt>
      </View>

      <FilterChips f={f} />

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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {rows.data.map((r) => (
                <RegionTile key={r.region} row={r} info={statusOf(r.region)} onPress={() => openDetail(r.region)} />
              ))}
            </View>
          )}

          <Txt variant="sub">경쟁률은 접수 기준이에요. 응시 기준은 지역 상세에서 볼 수 있어요.</Txt>
          <SourcesSummary rows={rows.data} />
        </>
      )}

      <RegionSheet
        row={sheetRow}
        info={sheetRegion ? statusOf(sheetRegion) : null}
        title={`${f.year}학년도 ${modeTitle}`}
        onClose={() => setSheetRegion(null)}
        onOpenDetail={openDetail}
        onOpenSchools={(region) => {
          setSheetRegion(null);
          router.push({ pathname: '/schools', params: { region, level: f.viewLevel } });
        }}
        onReport={(region) => {
          setSheetRegion(null);
          router.push({
            pathname: '/report',
            params: {
              target: `region:${f.year}:${f.viewLevel}:${f.isSecondary ? f.subject : '-'}:${region}`,
              label: `${f.year}학년도 ${modeTitle} · ${regionByCode(region)?.shortName}`,
            },
          });
        }}
      />
    </Screen>
  );
}
