import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ChangeBadge, SampleBadge, SourceNote, StatusBadge, stageLabel } from '../../components/DataBits';
import { LineChart, Series } from '../../components/LineChart';
import { Card, PrimaryButton, Screen, Txt } from '../../components/ui';
import { EVENT_LABEL, getReceiptInfo, shortDate } from '../../data/receiptStatus';
import { regionByCode } from '../../data/regions';
import { getRegionTrend, getSchedules } from '../../data/repository';
import { subjectByCode } from '../../data/subjects';
import { useAsync } from '../../data/useAsync';
import { Level, useToday } from '../../store/AppSettings';
import { space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// 지역 상세: 접수 상태 + 연도 요약 + 선발 인원·경쟁률 추이 그래프
export default function RegionDetailScreen() {
  const params = useLocalSearchParams<{ code: string; level: Level; subject?: string; year?: string }>();
  const { colors } = useTheme();
  const today = useToday();
  const level: Level = params.level === 'secondary' ? 'secondary' : 'elementary';
  const subject = level === 'secondary' && params.subject ? params.subject : null;
  const region = regionByCode(params.code);
  const query = useMemo(() => ({ level, subject }), [level, subject]);

  const trend = useAsync(() => getRegionTrend(query, params.code), [query, params.code]);
  const rows = trend.data ?? [];
  const latestYear = rows.at(-1)?.year ?? null;
  const schedules = useAsync(
    () => (latestYear ? getSchedules(level, latestYear, params.code) : Promise.resolve([])),
    [level, latestYear, params.code],
  );
  const info = schedules.data ? getReceiptInfo(schedules.data, today) : null;

  // 그래프와 요약이 같은 연도를 보도록
  const [sel, setSel] = useState(-1);
  useEffect(() => {
    if (!rows.length) return;
    const i = rows.findIndex((r) => String(r.year) === params.year);
    setSel(i >= 0 ? i : rows.length - 1);
  }, [rows.length, params.year]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = sel >= 0 ? rows[sel] : null;

  const [showTable, setShowTable] = useState(false);

  const title = `${region?.shortName ?? ''} · ${level === 'elementary' ? '초등' : `중등 ${subjectByCode(subject)?.name ?? ''}`}`;
  const labels = rows.map((r) => `'${String(r.year).slice(2)}`);
  const selectionSeries: Series[] = [
    { key: 'sel', label: '선발 인원', tone: 'brand', shape: 'circle', values: rows.map((r) => r.selection) },
  ];
  const ratioSeries: Series[] = [
    { key: 'applied', label: '접수 기준', tone: 'brand', shape: 'circle', values: rows.map((r) => r.ratioApplied) },
    { key: 'actual', label: '응시 기준', tone: 'accent', shape: 'square', dashed: true, values: rows.map((r) => r.ratioActual) },
  ];

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Screen>
        <SampleBadge />

        {trend.loading && <ActivityIndicator color={colors.brand} style={{ marginTop: space.xl }} />}
        {trend.error && <Txt color="down">데이터를 불러오지 못했어요: {trend.error.message}</Txt>}

        {/* 접수 상태 (올해) */}
        {info && schedules.data && (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Txt variant="heading">{latestYear}학년도 원서 접수</Txt>
              <StatusBadge status={info.status} />
            </View>
            <Txt>{info.detail}</Txt>
            <View style={{ gap: 2, marginTop: space.xs }}>
              {schedules.data.map((e) => {
                const past = e.date < today;
                return (
                  <View key={e.event} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Txt variant="sub" color={past ? 'textSub' : 'text'}>
                      {EVENT_LABEL[e.event]}
                    </Txt>
                    <Txt variant="sub" color={past ? 'textSub' : 'text'} style={{ fontWeight: past ? '400' : '700' }}>
                      {shortDate(e.date)}
                    </Txt>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* 선택한 연도 요약 (그래프를 누르면 바뀜) */}
        {cur && (
          <Card>
            <Txt variant="heading">{cur.year}학년도</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
              <Txt variant="number">{cur.selection?.toLocaleString() ?? '—'}</Txt>
              <Txt variant="sub" style={{ marginBottom: 5 }}>
                명 · {stageLabel(cur.selectionStage)}
                {cur.preliminary != null && cur.confirmed != null ? ` (사전예고 ${cur.preliminary}명 → 확정 ${cur.confirmed}명)` : ''}
              </Txt>
            </View>
            <ChangeBadge change={cur.change} rate={cur.changeRate} />
            <View style={{ gap: 2, marginTop: space.xs }}>
              <Row label="접수 / 응시 인원" value={`${cur.applicants?.toLocaleString() ?? '—'} / ${cur.takers?.toLocaleString() ?? '—'}명`} />
              <Row label="경쟁률 (접수 기준)" value={cur.ratioApplied != null ? `${cur.ratioApplied} : 1` : '—'} />
              <Row label="경쟁률 (응시 기준)" value={cur.ratioActual != null ? `${cur.ratioActual} : 1` : '—'} />
              <Row label="1차 합격선" value={cur.firstCutoff != null ? `${cur.firstCutoff}점` : '—'} />
              <Row
                label="합격률 (접수 / 응시 기준)"
                value={`${cur.passRateApplied ?? '—'}% / ${cur.passRateActual ?? '—'}%`}
              />
            </View>
            {cur.year === latestYear && cur.takers == null && (
              <Txt variant="sub">올해는 시험 전이라 접수 현황까지만 있어요.</Txt>
            )}
          </Card>
        )}

        {rows.length > 0 && sel >= 0 && (
          <>
            <Card>
              <Txt variant="heading">선발 인원 추이</Txt>
              <LineChart
                labels={labels}
                series={selectionSeries}
                selectedIndex={sel}
                onSelect={setSel}
                titleFor={(i) => `${rows[i].year}학년도`}
                formatValue={(v) => `${Math.round(v).toLocaleString()}명`}
              />
            </Card>

            <Card>
              <Txt variant="heading">경쟁률 추이</Txt>
              <LineChart
                labels={labels}
                series={ratioSeries}
                selectedIndex={sel}
                onSelect={setSel}
                titleFor={(i) => `${rows[i].year}학년도`}
                formatValue={(v) => `${Math.round(v * 100) / 100}:1`}
              />
              <Txt variant="sub">접수 기준 = 접수 인원 ÷ 선발 인원, 응시 기준 = 실제 응시 인원 ÷ 선발 인원</Txt>
            </Card>

            <PrimaryButton
              label={showTable ? '표 닫기' : '숫자 표로 보기'}
              variant="ghost"
              onPress={() => setShowTable((v) => !v)}
            />
            {showTable && (
              <Card>
                <TableRow cells={['학년도', '선발', '경쟁률(접수)', '경쟁률(응시)']} header />
                {[...rows].reverse().map((r) => (
                  <TableRow
                    key={r.year}
                    cells={[
                      String(r.year),
                      r.selection?.toLocaleString() ?? '—',
                      r.ratioApplied != null ? `${r.ratioApplied}` : '—',
                      r.ratioActual != null ? `${r.ratioActual}` : '—',
                    ]}
                  />
                ))}
              </Card>
            )}

            <SourceNote source={rows.at(-1)!.source} baseDate={cur?.baseDate ?? null} />
          </>
        )}
      </Screen>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
      <Txt variant="sub">{label}</Txt>
      <Txt variant="sub" color="text" style={{ fontWeight: '700' }}>
        {value}
      </Txt>
    </View>
  );
}

function TableRow({ cells, header }: { cells: string[]; header?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      {cells.map((c, i) => (
        <Txt
          key={i}
          variant="sub"
          color={header ? 'textSub' : 'text'}
          style={{ flex: 1, textAlign: i === 0 ? 'left' : 'right', fontWeight: header ? '700' : '400' }}
        >
          {c}
        </Txt>
      ))}
    </View>
  );
}
