import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { Card, Chip, PrimaryButton, Screen, Txt } from '../../components/ui';
import { addMockScore, deleteMockScore, mockScoreStats, MockScore, myMockScores, ScoreBand } from '../../data/study';
import { subjectByCode } from '../../data/subjects';
import { useAppSettings } from '../../store/AppSettings';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const THIS_YEAR = new Date().getFullYear() + 1; // 학년도 (11월 시험 = 다음 해 학년도)

// 모의고사 점수 vs 실제 1차 점수: 내 기록 + 구간별 통계(5명 이상인 구간만)
export default function ScoresScreen() {
  const { colors } = useTheme();
  const { exam } = useLocalSearchParams<{ exam?: string }>();
  const { settings, viewLevel } = useAppSettings();
  const subject = viewLevel === 'secondary' ? settings.subjectCode : null;
  const [mine, setMine] = useState<MockScore[]>([]);
  const [stats, setStats] = useState<ScoreBand[] | null>(null);
  const [year, setYear] = useState(THIS_YEAR);
  const [mock, setMock] = useState('');
  const [real, setReal] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    myMockScores().then(setMine).catch((e) => setError((e as Error).message));
    mockScoreStats(viewLevel, subject).then(setStats).catch(() => setStats([]));
  }, [viewLevel, subject]);
  useEffect(load, [load]);

  const num = (s: string) => (s.trim() === '' ? null : Number(s));
  const valid = (v: number | null) => v != null && !Number.isNaN(v) && v >= 0 && v <= 100;
  const add = async () => {
    const m = num(mock);
    const r = num(real);
    if (!valid(m) || (r != null && !valid(r))) return Alert.alert('점수는 0~100 사이로 넣어 주세요');
    try {
      await addMockScore({ level: viewLevel, subject, year, examId: exam ? Number(exam) : null, mock: m as number, real: r });
      setMock('');
      setReal('');
      load();
    } catch (e) {
      Alert.alert('저장하지 못했어요', (e as Error).message);
    }
  };
  const input = { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, color: colors.text, backgroundColor: colors.background, fontSize: 16 } as const;

  return (
    <Screen>
      <Stack.Screen options={{ title: '점수 비교' }} />
      <Txt variant="sub">
        {viewLevel === 'elementary' ? '초등' : `중등 ${subjectByCode(subject)?.name ?? ''}`} 기준이에요. 점수는 100점 만점으로 바꿔서 넣어 주세요. 다른 사람에게는 구간별 평균만 보여요.
      </Txt>
      <Card>
        <Txt variant="heading">내 점수 기록</Txt>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2].map((y) => (
            <Chip key={y} label={`${y}학년도`} selected={year === y} onPress={() => setYear(y)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <TextInput value={mock} onChangeText={setMock} placeholder="모의고사 점수" placeholderTextColor={colors.textSub} keyboardType="decimal-pad" style={input} />
          <TextInput value={real} onChangeText={setReal} placeholder="실제 1차 (나중에)" placeholderTextColor={colors.textSub} keyboardType="decimal-pad" style={input} />
        </View>
        <PrimaryButton label="기록하기" onPress={add} disabled={!mock.trim()} />
        {error && <Txt color="down">{error}</Txt>}
        {mine.map((s) => (
          <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm }}>
            <Txt style={{ flex: 1 }}>
              {s.year}학년도 · 모의 {s.mockScore}
              {s.realScore != null ? ` → 실제 ${s.realScore} (${s.realScore - s.mockScore >= 0 ? '+' : ''}${(s.realScore - s.mockScore).toFixed(1)})` : ' · 실제 점수 없음'}
            </Txt>
            <Pressable onPress={() => deleteMockScore(s.id).then(load)} hitSlop={8}>
              <Txt variant="sub">삭제</Txt>
            </Pressable>
          </View>
        ))}
      </Card>

      <Card>
        <Txt variant="heading">다른 수험생들은?</Txt>
        <Txt variant="sub">모의고사 점수 구간별로 실제 1차 점수가 평균 얼마나 달랐는지예요. 5명 이상 모인 구간만 보여요.</Txt>
        {stats && stats.length === 0 && <Txt variant="sub">아직 표본이 부족해요. 실제 점수까지 기록하면 통계가 쌓여요.</Txt>}
        {(stats ?? []).map((b) => (
          <View key={b.band} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line }}>
            <Txt style={{ width: 90, fontWeight: '700' }}>
              {b.band}~{b.band + 4.9}점
            </Txt>
            <Txt style={{ flex: 1 }}>
              실제 평균 {b.realAvg}
            </Txt>
            <Txt style={{ fontWeight: '800', color: b.diffAvg >= 0 ? colors.up : colors.down }}>
              {b.diffAvg >= 0 ? '+' : ''}
              {b.diffAvg}
            </Txt>
            <Txt variant="sub">{b.n}명</Txt>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
