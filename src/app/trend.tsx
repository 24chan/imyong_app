import { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { SampleBadge, SourcesSummary } from '../components/DataBits';
import { LineChart, Series } from '../components/LineChart';
import { ViewModeBanner } from '../components/ModeToggle';
import { Card, Chip, Screen, Segmented, Txt } from '../components/ui';
import { REGIONS, regionByCode } from '../data/regions';
import { getRegionTrend } from '../data/repository';
import { subjectByCode } from '../data/subjects';
import { useAsync } from '../data/useAsync';
import { FilterChips } from '../features/region/FilterChips';
import { useRegionFilters } from '../features/region/useRegionFilters';
import { MAX_COMPARE, useCompare } from '../store/AppSettings';
import { space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import type { RegionSummary } from '../types/data';

type TrendMetric = 'selection' | 'ratio' | 'cutoff' | 'passRate';
type Basis = 'applied' | 'actual';

const METRICS: { value: TrendMetric; label: string }[] = [
  { value: 'selection', label: '선발 인원' },
  { value: 'ratio', label: '경쟁률' },
  { value: 'cutoff', label: '합격선' },
  { value: 'passRate', label: '합격률' },
];

// 지역마다 색 + 선 모양 + 점 모양을 함께 바꿔서 색만으로 구분하지 않게
const STYLES: Pick<Series, 'tone' | 'line' | 'shape'>[] = [
  { tone: 'brand', line: 'solid', shape: 'circle' },
  { tone: 'accent', line: 'dash', shape: 'square' },
  { tone: 'textSub', line: 'dot', shape: 'diamond' },
];

const pick = (r: RegionSummary, m: TrendMetric, b: Basis) =>
  m === 'selection'
    ? r.selection
    : m === 'ratio'
      ? b === 'applied' ? r.ratioApplied : r.ratioActual
      : m === 'cutoff'
        ? r.firstCutoff
        : b === 'applied' ? r.passRateApplied : r.passRateActual;

const format = (v: number, m: TrendMetric) =>
  m === 'selection'
    ? `${Math.round(v).toLocaleString()}명`
    : m === 'ratio'
      ? `${Math.round(v * 100) / 100}:1`
      : m === 'cutoff'
        ? `${Math.round(v * 10) / 10}점`
        : `${Math.round(v * 10) / 10}%`;

// 추이·합격률: 비교 지역(최대 3개)의 연도별 추이를 한 그래프에
export default function TrendScreen() {
  const { colors } = useTheme();
  const compare = useCompare();
  const f = useRegionFilters();
  const [metric, setMetric] = useState<TrendMetric>('ratio');
  const [basis, setBasis] = useState<Basis>('applied');
  const [range, setRange] = useState<'5' | '10'>('10');
  const [sel, setSel] = useState(-1);

  const regions = compare.list;
  const trends = useAsync(
    () =>
      f.ready && regions.length
        ? Promise.all(regions.map((code) => getRegionTrend(f.query, code)))
        : Promise.resolve([] as RegionSummary[][]),
    [f.ready, f.query, regions.join(',')],
  );

  const sliced = (trends.data ?? []).map((t) => (range === '5' ? t.slice(-5) : t));
  const years = sliced[0]?.map((r) => r.year) ?? [];
  const selIdx = sel >= 0 && sel < years.length ? sel : years.length - 1;
  const series: Series[] = sliced.map((t, i) => ({
    key: regions[i],
    label: regionByCode(regions[i])?.shortName ?? regions[i],
    ...STYLES[i],
    values: t.map((r) => pick(r, metric, basis)),
  }));

  const pickRegion = (code: string) => {
    if (!compare.toggle(code)) Alert.alert('최대 3개 지역까지 겹쳐 볼 수 있어요', '하나를 빼고 다시 골라 주세요.');
  };

  const hasBasis = metric === 'ratio' || metric === 'passRate';
  const modeTitle = f.isSecondary ? `중등 ${subjectByCode(f.subject)?.name ?? ''}` : '초등';

  return (
    <Screen>
      <ViewModeBanner />
      <SampleBadge sourceIds={sliced.flatMap((t) => t.map((r) => r.source?.id))} />
      <Txt variant="sub">{modeTitle} · 지역을 최대 3개 골라 연도별 변화를 한 그래프로 비교해요. (지역 비교와 같은 목록을 써요)</Txt>

      {/* 과목 (중등) — 연도 칩은 이 화면에서 쓰지 않음 */}
      {f.isSecondary && <FilterChips f={{ ...f, years: null }} />}

      <View style={{ gap: space.sm }}>
        <Txt variant="heading">
          지역 ({regions.length}/{MAX_COMPARE})
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {REGIONS.map((r) => (
            <Chip key={r.code} label={r.shortName} selected={compare.has(r.code)} onPress={() => pickRegion(r.code)} />
          ))}
        </View>
      </View>

      <Segmented<TrendMetric> value={metric} onChange={setMetric} options={METRICS} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {hasBasis && (
          <View style={{ flex: 1 }}>
            <Segmented<Basis>
              value={basis}
              onChange={setBasis}
              options={[
                { value: 'applied', label: '접수 기준' },
                { value: 'actual', label: '응시 기준' },
              ]}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Segmented<'5' | '10'>
            value={range}
            onChange={setRange}
            options={[
              { value: '5', label: '최근 5년' },
              { value: '10', label: '10년' },
            ]}
          />
        </View>
      </View>

      {trends.loading && <ActivityIndicator color={colors.brand} />}

      {regions.length === 0 ? (
        <Txt variant="sub">위에서 지역을 하나 이상 골라 주세요.</Txt>
      ) : (
        years.length > 0 && (
          <>
            <Card>
              <Txt variant="heading">
                {METRICS.find((m) => m.value === metric)?.label} 추이
                {hasBasis ? ` (${basis === 'applied' ? '접수' : '응시'} 기준)` : ''}
              </Txt>
              <LineChart
                labels={years.map((y) => `'${String(y).slice(2)}`)}
                series={series}
                selectedIndex={selIdx}
                onSelect={setSel}
                titleFor={(i) => `${years[i]}학년도`}
                formatValue={(v) => format(v, metric)}
              />
              {years.at(-1) === f.latestYear && metric !== 'selection' && (
                <Txt variant="sub">{f.latestYear}학년도는 시험 전이라 비어 있을 수 있어요.</Txt>
              )}
            </Card>

            {/* 숫자 표 (색을 못 구분해도 읽을 수 있게) */}
            <Card>
              <View style={{ flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                <Txt variant="sub" style={{ flex: 1, fontWeight: '700' }}>
                  학년도
                </Txt>
                {series.map((s) => (
                  <Txt key={s.key} variant="sub" style={{ flex: 1, textAlign: 'right', fontWeight: '700' }}>
                    {s.label}
                  </Txt>
                ))}
              </View>
              {[...years].reverse().map((y) => {
                const i = years.indexOf(y);
                return (
                  <View key={y} style={{ flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                    <Txt variant="sub" color="text" style={{ flex: 1 }}>
                      {y}
                    </Txt>
                    {series.map((s) => (
                      <Txt key={s.key} variant="sub" color="text" style={{ flex: 1, textAlign: 'right' }}>
                        {s.values[i] != null ? format(s.values[i]!, metric) : '—'}
                      </Txt>
                    ))}
                  </View>
                );
              })}
            </Card>

            <SourcesSummary rows={sliced.flat()} />
          </>
        )
      )}
    </Screen>
  );
}
