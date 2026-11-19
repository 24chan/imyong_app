import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { ViewModeBanner } from '../components/ModeToggle';
import { Card, Chip, Screen, Segmented, Txt } from '../components/ui';
import { regionByCode, REGIONS } from '../data/regions';
import { getPrivateOpenings, getPrivateRegions } from '../data/repository';
import { subjectByCode } from '../data/subjects';
import { useAsync } from '../data/useAsync';
import { FoundMark } from '../features/region/SchoolMap';
import { useAppSettings } from '../store/AppSettings';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import type { PrivateOpening } from '../types/data';

const norm = (s: string) => s.replace(/[\s·ㆍ‧・.]/g, '');

// 사립학교 위탁 채용: 교육청이 1차 시험을 대신 치러 주는 사립 법인의 채용 학교·과목·인원
export default function PrivateScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ region?: string }>();
  const { settings, viewLevel } = useAppSettings();
  const regions = useAsync(() => getPrivateRegions(), []);
  const available = useMemo(
    () => REGIONS.filter((r) => (regions.data?.[r.code] ?? []).length > 0).map((r) => r.code),
    [regions.data],
  );
  const [region, setRegion] = useState<string | null>(params.region ?? null);
  useEffect(() => {
    if (region || !available.length) return;
    const mine = settings.regionCodes.find((c) => available.includes(c));
    setRegion(mine ?? available[0]);
  }, [available.join(','), region]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = useAsync(() => (region ? getPrivateOpenings(region) : Promise.resolve([])), [region]);
  const years = (data.data ?? []).map((y) => y.year);
  const [year, setYear] = useState<number | null>(null);
  const cur = (data.data ?? []).find((y) => y.year === year) ?? data.data?.[0] ?? null;

  // 중등: 내 과목만 보기
  const mySubject = viewLevel === 'secondary' ? subjectByCode(settings.subjectCode)?.name ?? null : null;
  const [onlyMine, setOnlyMine] = useState(false);

  const rows = useMemo(() => {
    let rs = (cur?.rows ?? []).filter((r) => r.level === viewLevel);
    if (onlyMine && mySubject) rs = rs.filter((r) => norm(r.subject) === norm(mySubject));
    return rs;
  }, [cur, viewLevel, onlyMine, mySubject]);

  const corps = useMemo(() => {
    const m = new Map<string, { corp: string; method: string | null; schools: Map<string, { url: string | null; items: PrivateOpening[] }> }>();
    for (const r of rows) {
      const c = m.get(r.corp) ?? { corp: r.corp, method: r.method, schools: new Map() };
      const s = c.schools.get(r.school) ?? { url: r.url, items: [] };
      s.items.push(r);
      c.schools.set(r.school, s);
      m.set(r.corp, c);
    }
    return [...m.values()];
  }, [rows]);
  const total = rows.reduce((a, r) => a + r.count, 0);
  const schoolCount = new Set(rows.map((r) => r.school)).size;
  const byMethod = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.method ?? '기타', (m.get(r.method ?? '기타') ?? 0) + r.count));
    return [...m.entries()];
  }, [rows]);

  const regionName = region ? regionByCode(region)?.shortName ?? '' : '';
  return (
    <>
      <Stack.Screen options={{ title: '사립 위탁 채용' }} />
      <Screen>
        <ViewModeBanner />
        <Txt variant="sub">
          사립학교 법인이 교육청에 1차 시험을 맡겨 교사를 뽑는 자리예요. 공고문 표를 그대로 옮겼고, 지원 방법·조건은 원문 공고를 꼭
          확인하세요.
        </Txt>

        {regions.loading ? (
          <ActivityIndicator color={colors.brand} />
        ) : available.length === 0 ? (
          <Card>
            <Txt variant="heading">아직 모인 자료가 없어요</Txt>
            <Txt variant="sub">수집기가 교육청 공고에서 사립 위탁 표를 찾으면 여기에 나와요.</Txt>
          </Card>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {available.map((c) => (
              <Chip
                key={c}
                label={regionByCode(c)?.shortName ?? c}
                selected={c === region}
                onPress={() => {
                  setRegion(c);
                  setYear(null);
                }}
              />
            ))}
          </View>
        )}

        {years.length > 1 && (
          <Segmented
            compact
            options={years.map((y) => ({ value: String(y), label: `${y}학년도` }))}
            value={String(cur?.year ?? years[0])}
            onChange={(v) => setYear(Number(v))}
          />
        )}

        {data.loading && region ? <ActivityIndicator color={colors.brand} /> : null}
        {data.error && <Txt color="down">불러오지 못했어요: {data.error.message}</Txt>}

        {cur && (
          <>
            {/* 요약 */}
            <Card style={{ borderWidth: 1, borderColor: colors.accent + '55', backgroundColor: colors.accent + '14' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <FoundMark found="s" size={12} />
                <Txt variant="heading">
                  {regionName} {cur.year}학년도 {viewLevel === 'elementary' ? '초등·특수(유·초)' : '중등'}
                </Txt>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
                <Txt variant="number">{total}</Txt>
                <Txt variant="sub">
                  명 · {corps.length}개 법인 · {schoolCount}교
                </Txt>
              </View>
              {byMethod.length > 0 && (
                <Txt variant="sub">{byMethod.map(([m, n]) => `${m} ${n}명`).join(' · ')}</Txt>
              )}
            </Card>

            {mySubject && (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Chip label="전체 과목" selected={!onlyMine} onPress={() => setOnlyMine(false)} />
                <Chip label={`내 과목 (${mySubject})`} selected={onlyMine} onPress={() => setOnlyMine(true)} />
              </View>
            )}

            {rows.length === 0 && (
              <Txt variant="sub">
                {onlyMine ? `${mySubject} 채용 자리가 없어요.` : `이 학년도에는 ${viewLevel === 'elementary' ? '초등' : '중등'} 채용 자리가 없어요.`}
              </Txt>
            )}

            {corps.map((c) => (
              <Card key={c.corp} style={{ gap: space.sm, borderWidth: 1, borderColor: colors.line }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                  <Txt variant="heading" style={{ flexShrink: 1 }}>
                    {c.corp}
                  </Txt>
                  {c.method && (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: radius.pill,
                        backgroundColor: colors.accent + '22',
                      }}
                    >
                      <Txt variant="sub" color="text" style={{ fontWeight: '700', fontSize: 12 }}>
                        {c.method}
                      </Txt>
                    </View>
                  )}
                </View>
                {[...c.schools.entries()].map(([name, s]) => (
                  <View key={name} style={{ gap: 4, paddingTop: space.xs, borderTopWidth: 1, borderTopColor: colors.line }}>
                    <Pressable
                      disabled={!s.url}
                      onPress={() => s.url && Linking.openURL(s.url)}
                      accessibilityRole={s.url ? 'link' : undefined}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Txt style={{ fontWeight: '700' }}>{name}</Txt>
                      {s.url && <Ionicons name="open-outline" size={14} color={colors.textSub} />}
                    </Pressable>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {s.items.map((it) => (
                        <View
                          key={it.subject}
                          style={{
                            flexDirection: 'row',
                            gap: 4,
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: radius.pill,
                            borderWidth: 1,
                            borderColor: colors.line,
                            backgroundColor: colors.background,
                          }}
                        >
                          <Txt variant="sub" color="text">
                            {it.subject}
                          </Txt>
                          <Txt variant="sub" color="text" style={{ fontWeight: '800' }}>
                            {it.count}명
                          </Txt>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </Card>
            ))}

            <View style={{ gap: 4 }}>
              <Txt variant="sub">출처 (교육청 공고{cur.postedAt ? ` · ${cur.postedAt}` : ''})</Txt>
              {cur.sources.map((s) => (
                <Pressable key={s.title} disabled={!s.url} onPress={() => s.url && Linking.openURL(s.url)}>
                  <Txt variant="sub" color={s.url ? 'brand' : 'textSub'} style={{ textDecorationLine: s.url ? 'underline' : 'none' }}>
                    {s.title}
                  </Txt>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </Screen>
    </>
  );
}
