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
type CutoffKind = 'first' | 'final';
const YEARS_SHOWN = 5; // 최근 5개 학년도만 (공식 자료가 2024학년도부터)

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

// 접수/응시 기준 버튼 대신: 교육청마다 공개하는 숫자가 달라서 있는 쪽을 자동으로 씀
// 경쟁률은 접수 기준 우선(없으면 응시), 합격률은 응시 기준 우선(없으면 접수)
type Picked = { v: number | null; basis?: '접수' | '응시' };
const pick = (r: RegionSummary, m: TrendMetric, c: CutoffKind): Picked => {
  if (m === 'selection') return { v: r.selection };
  if (m === 'cutoff') return { v: c === 'first' ? r.firstCutoff : r.finalCutoff };
  if (m === 'ratio')
    return r.ratioApplied != null ? { v: r.ratioApplied, basis: '접수' } : { v: r.ratioActual, basis: r.ratioActual != null ? '응시' : undefined };
  return r.passRateActual != null
    ? { v: r.passRateActual, basis: '응시' }
    : { v: r.passRateApplied, basis: r.passRateApplied != null ? '접수' : undefined };
};

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
  const [cutoff, setCutoff] = useState<CutoffKind>('first');
  const [sel, setSel] = useState(-1);

  const regions = compare.list;
  const trends = useAsync(
    () =>
      f.ready && regions.length
        ? Promise.all(regions.map((code) => getRegionTrend(f.query, code)))
        : Promise.resolve([] as RegionSummary[][]),
    [f.ready, f.query, regions.join(',')],
  );

  const sliced = (trends.data ?? []).map((t) => t.slice(-YEARS_SHOWN));
  const years = sliced[0]?.map((r) => r.year) ?? [];
  const selIdx = sel >= 0 && sel < years.length ? sel : years.length - 1;
  const picked = sliced.map((t) => t.map((r) => pick(r, metric, cutoff)));
  const series: Series[] = sliced.map((t, i) => ({
    key: regions[i],
    label: regionByCode(regions[i])?.shortName ?? regions[i],
    ...STYLES[i],
    values: picked[i].map((p) => p.v),
  }));
  // 접수·응시 기준이 섞이면 표에 기준을 함께 적음
  const bases = new Set(picked.flat().map((p) => p.basis).filter(Boolean));
  const mixed = bases.size > 1;
  const onlyBasis = bases.size === 1 ? [...bases][0] : null;

  const pickRegion = (code: string) => {
    if (!compare.toggle(code)) Alert.alert('최대 3개 지역까지 겹쳐 볼 수 있어요', '하나를 빼고 다시 골라 주세요.');
  };

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
      {metric === 'cutoff' && (
        <Segmented<CutoffKind>
          value={cutoff}
          onChange={setCutoff}
          options={[
            { value: 'first', label: '1차 합격선' },
            { value: 'final', label: '최종 합격선' },
          ]}
        />
      )}

      {trends.loading && <ActivityIndicator color={colors.brand} />}

      {regions.length === 0 ? (
        <Txt variant="sub">위에서 지역을 하나 이상 골라 주세요.</Txt>
      ) : (
        years.length > 0 && (
          <>
            <Card>
              <Txt variant="heading">
                {metric === 'cutoff' ? (cutoff === 'first' ? '1차 합격선' : '최종 합격선') : METRICS.find((m) => m.value === metric)?.label} 추이
                {onlyBasis ? ` (${onlyBasis} 기준)` : ''}
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
                <Txt variant="sub">{f.latestYear}학년도는 시험이 진행 중이라 비어 있을 수 있어요.</Txt>
              )}
              {metric === 'ratio' && <Txt variant="sub">경쟁률 = 지원(없으면 응시) 인원 ÷ 선발 인원. 교육청마다 공개하는 숫자가 달라요.</Txt>}
              {metric === 'passRate' && <Txt variant="sub">합격률 = 최종 합격 ÷ 1차 응시(없으면 지원) 인원.</Txt>}
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
                    {series.map((s, si) => {
                      const p = picked[si][i];
                      return (
                        <Txt key={s.key} variant="sub" color="text" style={{ flex: 1, textAlign: 'right' }}>
                          {p.v != null ? format(p.v, metric) + (mixed && p.basis ? ` (${p.basis})` : '') : '—'}
                        </Txt>
                      );
                    })}
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
