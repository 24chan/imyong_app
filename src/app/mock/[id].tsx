import Ionicons from '@expo/vector-icons/Ionicons';
import { openLink } from '../../lib/openLink';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { TextInput } from '../../components/TextField';
import { Card, PrimaryButton, Screen, Txt } from '../../components/ui';
import { ago } from '../../data/community';
import { deleteMockReview, getMockExam, listMockReviews, MockExam, MockReview, upsertMockReview } from '../../data/study';
import { LabelBadge, needWriterAlert, ReportSheet, useWriterLabels } from '../../features/community/parts';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

function Stars({ value, onChange, icon = 'star' }: { value: number; onChange?: (n: number) => void; icon?: 'star' | 'flame' }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} disabled={!onChange} onPress={() => onChange?.(n)} hitSlop={4}>
          <Ionicons name={n <= value ? icon : (`${icon}-outline` as 'star-outline')} size={onChange ? 26 : 14} color={icon === 'star' ? colors.accent : colors.down} />
        </Pressable>
      ))}
    </View>
  );
}

// 모의고사: 일정·신청 링크, 후기(만족도·난이도), 점수 비교로 이동
export default function MockDetail() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const examId = Number(id);
  const { uid, labels } = useWriterLabels();
  const [exam, setExam] = useState<MockExam | null | undefined>(undefined);
  const [reviews, setReviews] = useState<MockReview[]>([]);
  const [rating, setRating] = useState(0);
  const [difficulty, setDifficulty] = useState(0);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ type: 'mock_review'; id: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const [e, r] = await Promise.all([getMockExam(examId), listMockReviews(examId)]);
      setExam(e);
      setReviews(r);
      const mine = r.find((x) => x.isMine);
      if (mine) {
        setRating(mine.rating);
        setDifficulty(mine.difficulty);
        setBody(mine.body);
      }
    } catch {
      setExam(null);
    }
  }, [examId]);
  useEffect(() => {
    load();
  }, [load]);

  if (exam === undefined) return <ActivityIndicator color={colors.brand} style={{ marginTop: space.xl }} />;
  if (!exam)
    return (
      <Screen>
        <Txt>모의고사를 찾을 수 없어요.</Txt>
      </Screen>
    );

  const save = async () => {
    if (needWriterAlert(uid, labels)) return;
    setBusy(true);
    try {
      await upsertMockReview(examId, rating, difficulty, body);
      await load();
      Alert.alert('후기를 남겼어요');
    } catch (e) {
      Alert.alert('저장하지 못했어요', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: '모의고사' }} />
      <Txt variant="title">{exam.name}</Txt>
      <Txt variant="sub">
        {exam.provider} · {exam.examDate ?? '일정 미정'}
      </Txt>
      {exam.note && <Txt>{exam.note}</Txt>}
      {exam.applyUrl && <PrimaryButton label="주관처 안내 열기" variant="ghost" onPress={() => openLink(exam.applyUrl, exam.name)} />}
      <Txt variant="sub">학원·주관처의 광고가 아니라 수험생 후기만 모아요.</Txt>

      <Card>
        <Txt variant="heading">내 후기</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt>만족도</Txt>
          <Stars value={rating} onChange={setRating} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt>난이도</Txt>
          <Stars value={difficulty} onChange={setDifficulty} icon="flame" />
        </View>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="문항 수준, 실제 시험과 비슷했는지, 해설 등 (문제 내용 그대로 옮기기는 금지)"
          placeholderTextColor={colors.textSub}
          multiline
          style={{ minHeight: 90, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, color: colors.text, backgroundColor: colors.background }}
        />
        <PrimaryButton label={busy ? '저장 중…' : '후기 저장'} onPress={save} disabled={busy || !rating || !difficulty || body.trim().length < 5} />
      </Card>

      <PrimaryButton label="점수 비교 (모의 vs 실제)" variant="ghost" onPress={() => router.push({ pathname: '/mock/scores', params: { exam: String(examId) } })} />

      <Txt variant="heading">
        후기 {reviews.length}
        {exam.ratingAvg != null ? ` · 만족 ${exam.ratingAvg} · 난이도 ${exam.difficultyAvg}` : ''}
      </Txt>
      {reviews.map((r) => (
        <View key={r.id} style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: space.sm, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <LabelBadge label={r.label} small />
            <Stars value={r.rating} />
            <Stars value={r.difficulty} icon="flame" />
            <View style={{ flex: 1 }} />
            <Txt variant="sub" style={{ fontSize: 12 }}>
              {ago(r.createdAt)}
            </Txt>
          </View>
          <Txt>{r.body}</Txt>
          {r.isMine ? (
            <Pressable onPress={() => deleteMockReview(r.id).then(load)}>
              <Txt variant="sub">삭제</Txt>
            </Pressable>
          ) : (
            <Pressable onPress={() => (uid ? setReport({ type: 'mock_review', id: r.id }) : needWriterAlert(uid, labels))}>
              <Txt variant="sub">신고</Txt>
            </Pressable>
          )}
        </View>
      ))}
      <ReportSheet target={report} onClose={() => setReport(null)} onBlocked={load} />
    </Screen>
  );
}
