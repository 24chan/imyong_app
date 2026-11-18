import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { PrimaryButton, Screen, Txt } from '../components/ui';
import { submitErrorReport } from '../data/repository';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

// 오류 신고: 숫자가 공고와 다를 때. 이름·연락처는 받지 않음.
export default function ReportScreen() {
  const { target, label } = useLocalSearchParams<{ target: string; label?: string }>();
  const { colors } = useTheme();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await submitErrorReport(target ?? 'unknown', message.trim());
      Alert.alert('신고가 접수됐어요', '확인 후 고칠게요. 고마워요!', [{ text: '확인', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('보내지 못했어요', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Txt variant="heading">{label ?? '데이터'}</Txt>
      <Txt variant="sub">어떤 숫자가 공고와 다른지 적어 주세요. 공고 링크나 쪽수를 함께 적어 주시면 빨리 고칠 수 있어요.</Txt>
      <TextInput
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={1000}
        placeholder="예: 서울 2027학년도 확정 인원이 공고(9/5)에는 320명이에요"
        placeholderTextColor={colors.textSub}
        style={{
          minHeight: 140,
          textAlignVertical: 'top',
          padding: space.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.surface,
          color: colors.text,
          fontSize: 15,
        }}
      />
      <View style={{ gap: space.sm }}>
        <PrimaryButton label={busy ? '보내는 중…' : '신고 보내기'} onPress={submit} disabled={busy || !message.trim()} />
        <Txt variant="sub">이름·연락처는 저장하지 않아요.</Txt>
      </View>
    </Screen>
  );
}
