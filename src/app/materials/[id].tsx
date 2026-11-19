import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { PrimaryButton, Screen, Txt } from '../../components/ui';
import { ago } from '../../data/community';
import { AREA_LABEL, deleteMaterial, getMaterial, Material, toggleMaterialLike } from '../../data/study';
import { subjectByCode } from '../../data/subjects';
import { LabelBadge, needWriterAlert, ReportSheet, useWriterLabels } from '../../features/community/parts';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

export default function MaterialDetail() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { uid, labels } = useWriterLabels();
  const [m, setM] = useState<Material | null | undefined>(undefined);
  const [report, setReport] = useState<{ type: 'material'; id: number } | null>(null);
  const load = useCallback(() => getMaterial(Number(id)).then(setM).catch(() => setM(null)), [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (m === undefined) return <ActivityIndicator color={colors.brand} style={{ marginTop: space.xl }} />;
  if (!m)
    return (
      <Screen>
        <Txt>자료를 찾을 수 없어요.</Txt>
      </Screen>
    );
  const like = async () => {
    if (needWriterAlert(uid, labels)) return;
    try {
      const n = await toggleMaterialLike(m.id);
      setM({ ...m, likeCount: n, liked: !m.liked });
    } catch (e) {
      Alert.alert('공감하지 못했어요', (e as Error).message);
    }
  };
  return (
    <Screen>
      <Stack.Screen options={{ title: '공부 자료' }} />
      <Txt variant="sub">
        {AREA_LABEL[m.area]}
        {m.subjectCode ? ` · ${subjectByCode(m.subjectCode)?.name}` : ''}
      </Txt>
      <Txt variant="title">{m.title}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <LabelBadge label={m.label} />
        <Txt variant="sub">{ago(m.createdAt)}</Txt>
      </View>
      <Txt style={{ fontSize: 16, lineHeight: 26 }} selectable>
        {m.body}
      </Txt>
      <Pressable
        onPress={like}
        disabled={m.isMine}
        style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, opacity: m.isMine ? 0.5 : 1 }}
      >
        <Ionicons name={m.liked ? 'heart' : 'heart-outline'} size={18} color={colors.down} />
        <Txt style={{ fontWeight: '700' }}>도움돼요 {m.likeCount}</Txt>
      </Pressable>
      {m.isMine ? (
        <>
          <PrimaryButton label="수정" variant="ghost" onPress={() => router.push({ pathname: '/materials/write', params: { edit: String(m.id) } })} />
          <PrimaryButton
            label="삭제"
            variant="ghost"
            onPress={() =>
              Alert.alert('자료를 삭제할까요?', '', [
                { text: '취소', style: 'cancel' },
                { text: '삭제', style: 'destructive', onPress: () => deleteMaterial(m.id).then(() => router.back()) },
              ])
            }
          />
        </>
      ) : (
        <PrimaryButton label="신고 · 차단" variant="ghost" onPress={() => (uid ? setReport({ type: 'material', id: m.id }) : needWriterAlert(uid, labels))} />
      )}
      <ReportSheet target={report} onClose={() => setReport(null)} onBlocked={() => router.back()} />
    </Screen>
  );
}
