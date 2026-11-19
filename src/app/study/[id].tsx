import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { Card, PrimaryButton, Screen, Txt } from '../../components/ui';
import { ago, startConversation } from '../../data/community';
import { regionByCode } from '../../data/regions';
import { getStudy, MODE_LABEL, setStudyStatus, STAGE_LABEL, Study } from '../../data/study';
import { subjectByCode } from '../../data/subjects';
import { LabelBadge, needWriterAlert, ReportSheet, useWriterLabels } from '../../features/community/parts';
import { space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

export default function StudyDetail() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { uid, labels } = useWriterLabels();
  const [s, setS] = useState<Study | null | undefined>(undefined);
  const [report, setReport] = useState<{ type: 'study'; id: number } | null>(null);
  const load = useCallback(() => getStudy(Number(id)).then(setS).catch(() => setS(null)), [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (s === undefined) return <ActivityIndicator color={colors.brand} style={{ marginTop: space.xl }} />;
  if (!s)
    return (
      <Screen>
        <Txt>모집 글을 찾을 수 없어요.</Txt>
      </Screen>
    );

  const ask = async () => {
    if (needWriterAlert(uid, labels)) return;
    try {
      const conv = await startConversation('study', s.id);
      router.push({ pathname: '/messages/[id]', params: { id: conv, other: s.label } });
    } catch (e) {
      Alert.alert('쪽지를 보낼 수 없어요', (e as Error).message);
    }
  };
  const tags = [
    s.status === 'open' ? '모집 중' : '마감',
    s.level === 'elementary' ? '초등' : `중등 ${subjectByCode(s.subjectCode)?.name ?? ''}`,
    STAGE_LABEL[s.stage],
    MODE_LABEL[s.mode],
    ...s.regions.map((r) => regionByCode(r)?.shortName ?? r),
    `${s.capacity}명`,
  ];

  return (
    <Screen>
      <Stack.Screen options={{ title: '스터디' }} />
      <Txt variant="sub">{tags.join(' · ')}</Txt>
      <Txt variant="title">{s.title}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <LabelBadge label={s.label} />
        <Txt variant="sub">{ago(s.createdAt)}</Txt>
      </View>
      <Card>
        <Txt style={{ fontSize: 16, lineHeight: 25 }} selectable>
          {s.body}
        </Txt>
      </Card>
      {s.isMine ? (
        <>
          <PrimaryButton
            label={s.status === 'open' ? '모집 마감하기' : '다시 모집하기'}
            onPress={() => setStudyStatus(s.id, s.status === 'open' ? 'closed' : 'open').then(load).catch((e) => Alert.alert('바꾸지 못했어요', (e as Error).message))}
          />
          <PrimaryButton
            label="삭제"
            variant="ghost"
            onPress={() =>
              Alert.alert('모집 글을 삭제할까요?', '', [
                { text: '취소', style: 'cancel' },
                { text: '삭제', style: 'destructive', onPress: () => setStudyStatus(s.id, 'deleted').then(() => router.back()) },
              ])
            }
          />
        </>
      ) : (
        <>
          {s.status === 'open' && <PrimaryButton label="쪽지로 참여 문의" onPress={ask} />}
          <PrimaryButton label="신고 · 차단" variant="ghost" onPress={() => (uid ? setReport({ type: 'study', id: s.id }) : needWriterAlert(uid, labels))} />
        </>
      )}
      <ReportSheet target={report} onClose={() => setReport(null)} onBlocked={() => router.back()} />
    </Screen>
  );
}
