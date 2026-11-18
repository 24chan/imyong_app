import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { ChangeBadge, SampleBadge, SourceNote, stageLabel } from '../../components/DataBits';
import { ViewModeBanner } from '../../components/ModeToggle';
import { Card, Chip, Screen, Txt } from '../../components/ui';
import { regionByCode } from '../../data/regions';
import { getAvailableSubjects, getRegionSummaries, getYears } from '../../data/repository';
import { subjectByCode } from '../../data/subjects';
import { useAsync } from '../../data/useAsync';
import { useAppSettings } from '../../store/AppSettings';
import { space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// 지역·TO — 2단계: 올해 선발 인원 목록. 3단계에서 지도·바텀시트가 추가됩니다.
export default function RegionScreen() {
  const { settings, viewLevel } = useAppSettings();
  const { colors } = useTheme();
  const isSecondary = viewLevel === 'secondary';

  const years = useAsync(getYears, []);
  const subjects = useAsync(getAvailableSubjects, []);
  const year = years.data?.[0] ?? null;

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

  return (
    <Screen>
      <ViewModeBanner />

      <View style={{ gap: space.xs }}>
        <SampleBadge />
        <Txt variant="title">
          {year ? `${year}학년도 ` : ''}
          {isSecondary ? `중등 · ${subjectByCode(subject)?.name ?? ''}` : '초등'} 선발 인원
        </Txt>
        <Txt variant="sub">시도별 인원과 전년 대비 증감이에요. 전국 지도는 다음 단계에서 추가돼요.</Txt>
      </View>

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

      {rows.data?.map((r) => (
        <Card key={r.region} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, gap: space.xs }}>
            <Txt variant="heading">{regionByCode(r.region)?.shortName}</Txt>
            <ChangeBadge change={r.change} rate={r.changeRate} />
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Txt variant="number">
              {r.selection != null ? r.selection.toLocaleString() : '—'}
              <Txt variant="sub"> 명</Txt>
            </Txt>
            <Txt variant="sub">
              {stageLabel(r.selectionStage)}
              {r.ratioApplied != null ? ` · 경쟁률 ${r.ratioApplied} : 1 (접수)` : ''}
            </Txt>
          </View>
        </Card>
      ))}

      {rows.data && rows.data.length > 0 && (
        <SourceNote source={rows.data[0].source} baseDate={rows.data[0].baseDate} />
      )}
    </Screen>
  );
}
