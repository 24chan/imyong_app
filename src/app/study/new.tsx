import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { RegionPicker, SubjectPicker } from '../../components/pickers';
import { Card, Chip, PrimaryButton, Segmented, Txt } from '../../components/ui';
import { createStudy, MODE_LABEL, STAGE_LABEL, Study } from '../../data/study';
import { LabelChooser, useWriterLabels } from '../../features/community/parts';
import { Level, useAppSettings } from '../../store/AppSettings';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// 스터디 모집 글쓰기: 태그(구분·과목·1/2차·온오프·지역·인원)
export default function NewStudyScreen() {
  const { colors } = useTheme();
  const { settings, viewLevel } = useAppSettings();
  const { labels } = useWriterLabels();
  const [level, setLevel] = useState<Level>(viewLevel);
  const [subject, setSubject] = useState<string | null>(viewLevel === 'secondary' ? settings.subjectCode : null);
  const [stage, setStage] = useState<Study['stage']>('first');
  const [mode, setMode] = useState<Study['mode']>('online');
  const [regions, setRegions] = useState<string[]>([]);
  const [capacity, setCapacity] = useState(4);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [label, setLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const id = await createStudy({ level, subject: level === 'secondary' ? subject : null, regions: mode === 'online' ? [] : regions, stage, mode, capacity, title, body, verificationId: label });
      router.replace({ pathname: '/study/[id]', params: { id: String(id) } });
    } catch (e) {
      Alert.alert('올리지 못했어요', (e as Error).message);
      setBusy(false);
    }
  };
  const input = { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, color: colors.text, backgroundColor: colors.background } as const;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: '스터디 모집' }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, maxWidth: 820, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Card>
          <Txt variant="heading">구분</Txt>
          <Segmented<Level> value={level} onChange={setLevel} options={[{ value: 'elementary', label: '초등' }, { value: 'secondary', label: '중등' }]} />
          {level === 'secondary' && <SubjectPicker value={subject} onChange={setSubject} />}
        </Card>
        <Card>
          <Txt variant="heading">대비 시험</Txt>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(Object.keys(STAGE_LABEL) as Study['stage'][]).map((s) => (
              <Chip key={s} label={STAGE_LABEL[s]} selected={stage === s} onPress={() => setStage(s)} />
            ))}
          </View>
          <Txt variant="heading">방식</Txt>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(Object.keys(MODE_LABEL) as Study['mode'][]).map((m) => (
              <Chip key={m} label={MODE_LABEL[m]} selected={mode === m} onPress={() => setMode(m)} />
            ))}
          </View>
          {mode !== 'online' && (
            <>
              <Txt variant="sub">만날 지역 (시도 단위까지만, 자세한 장소는 쪽지로)</Txt>
              <RegionPicker value={regions} onChange={setRegions} />
            </>
          )}
          <Txt variant="heading">모집 인원 (나 포함)</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {[2, 3, 4, 5, 6, 8, 10].map((n) => (
              <Chip key={n} label={`${n}명`} selected={capacity === n} onPress={() => setCapacity(n)} />
            ))}
          </View>
        </Card>
        {labels && <LabelChooser labels={labels} value={label} onChange={setLabel} />}
        <TextInput value={title} onChangeText={setTitle} placeholder="제목 (예: 서울 초등 1차 교육학 스터디)" placeholderTextColor={colors.textSub} maxLength={80} style={[input, { fontWeight: '700', fontSize: 16 }]} />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="진행 방식, 요일·시간, 원하는 사람 등을 적어 주세요. 연락처는 적지 말고 쪽지로 받아요."
          placeholderTextColor={colors.textSub}
          multiline
          textAlignVertical="top"
          maxLength={3000}
          style={[input, { minHeight: 180, fontSize: 15, lineHeight: 22 }]}
        />
        <PrimaryButton label={busy ? '올리는 중…' : '모집 글 올리기'} onPress={submit} disabled={busy || !title.trim() || !body.trim() || (level === 'secondary' && !subject) || (mode !== 'online' && regions.length === 0)} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
