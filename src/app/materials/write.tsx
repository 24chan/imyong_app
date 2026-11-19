import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { TextInput } from '../../components/TextField';
import { SubjectPicker } from '../../components/pickers';
import { Card, Chip, PrimaryButton, Segmented, Txt } from '../../components/ui';
import { AREA_LABEL, createMaterial, getMaterial, Material, updateMaterial } from '../../data/study';
import { LabelChooser, useWriterLabels } from '../../features/community/parts';
import { Level, useAppSettings } from '../../store/AppSettings';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// 공부 자료 올리기: 글로만 (파일·사진 없음)
export default function WriteMaterial() {
  const { colors } = useTheme();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editId = edit ? Number(edit) : null;
  const { settings, viewLevel } = useAppSettings();
  const { labels } = useWriterLabels();
  const [level, setLevel] = useState<Level>(viewLevel);
  const [subject, setSubject] = useState<string | null>(viewLevel === 'secondary' ? settings.subjectCode : null);
  const [area, setArea] = useState<Material['area']>('pedagogy');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [label, setLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editId)
      getMaterial(editId).then((m) => {
        if (!m) return;
        setTitle(m.title);
        setBody(m.body);
      });
  }, [editId]);

  const submit = async () => {
    setBusy(true);
    try {
      if (editId) {
        await updateMaterial(editId, title, body);
        router.back();
      } else {
        const id = await createMaterial({ level, subject: level === 'secondary' && area === 'major' ? subject : null, area, title, body, verificationId: label });
        router.replace({ pathname: '/materials/[id]', params: { id: String(id) } });
      }
    } catch (e) {
      Alert.alert('올리지 못했어요', (e as Error).message);
      setBusy(false);
    }
  };
  const input = { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, color: colors.text, backgroundColor: colors.background } as const;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: editId ? '자료 수정' : '자료 올리기' }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, maxWidth: 820, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: colors.accent + '18', borderRadius: radius.md, padding: space.md }}>
          <Txt variant="sub" color="text">
            직접 정리한 요약·노트·암기법만 올려 주세요. 교재·강의 내용을 그대로 옮기거나 PDF·파일 링크를 공유하면 삭제되고 이용이 제한돼요.
          </Txt>
        </View>
        {!editId && (
          <Card>
            <Segmented<Level> value={level} onChange={setLevel} options={[{ value: 'elementary', label: '초등' }, { value: 'secondary', label: '중등' }]} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {(Object.keys(AREA_LABEL) as Material['area'][]).map((a) => (
                <Chip key={a} label={AREA_LABEL[a]} selected={area === a} onPress={() => setArea(a)} />
              ))}
            </View>
            {level === 'secondary' && area === 'major' && <SubjectPicker value={subject} onChange={setSubject} />}
          </Card>
        )}
        {labels && <LabelChooser labels={labels} value={label} onChange={setLabel} />}
        <TextInput value={title} onChangeText={setTitle} placeholder="제목 (예: 교육과정 개정 핵심 정리)" placeholderTextColor={colors.textSub} maxLength={100} style={[input, { fontWeight: '700', fontSize: 16 }]} />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="내용 (20자 이상)"
          placeholderTextColor={colors.textSub}
          multiline
          textAlignVertical="top"
          maxLength={20000}
          style={[input, { minHeight: 280, fontSize: 15, lineHeight: 23 }]}
        />
        <PrimaryButton
          label={busy ? '올리는 중…' : editId ? '수정 완료' : '올리기'}
          onPress={submit}
          disabled={busy || !title.trim() || body.trim().length < 20 || (!editId && level === 'secondary' && area === 'major' && !subject)}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
