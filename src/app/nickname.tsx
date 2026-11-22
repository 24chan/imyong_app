import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { TextInput } from '../components/TextField';
import { PrimaryButton, Screen, Txt } from '../components/ui';
import { getMyNickname, setNickname } from '../data/community';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

// 닉네임 정하기: 글·댓글에서 '닉네임'을 고를 때 보이는 이름
export default function NicknameScreen() {
  const { colors } = useTheme();
  const [cur, setCur] = useState<{ nickname: string | null; changedAt: string | null } | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMyNickname()
      .then((n) => {
        setCur(n);
        setText(n.nickname ?? '');
      })
      .catch((e) => Alert.alert('불러오지 못했어요', (e as Error).message));
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await setNickname(text);
      Alert.alert('닉네임을 정했어요', '글·댓글을 쓸 때 익명 대신 닉네임을 고를 수 있어요.', [{ text: '확인', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('정하지 못했어요', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const valid = /^[가-힣A-Za-z0-9_]{2,10}$/.test(text.trim());

  return (
    <>
      <Stack.Screen options={{ title: '닉네임' }} />
      <Screen>
        {cur === null ? (
          <ActivityIndicator color={colors.brand} />
        ) : (
          <View style={{ gap: space.md }}>
            <Txt variant="heading">{cur.nickname ? `지금 닉네임: ${cur.nickname}` : '닉네임을 정해 주세요'}</Txt>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="2~10자, 한글·영문·숫자·_"
              placeholderTextColor={colors.textSub}
              maxLength={10}
              autoCapitalize="none"
              style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, fontSize: 17, color: colors.text }}
            />
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, gap: 4 }}>
              <Txt variant="sub">· 글·댓글마다 익명/닉네임을 고를 수 있어요. 기본은 익명이에요.</Txt>
              <Txt variant="sub">· 닉네임으로 쓴 글은 같은 사람이 쓴 걸 다른 사람이 알 수 있어요.</Txt>
              <Txt variant="sub">· 실명, 지역 이름, 학교 이름은 쓰지 마세요 (지역 이름은 막혀 있어요).</Txt>
              <Txt variant="sub">· 30일에 한 번 바꿀 수 있어요. 이미 쓴 글의 닉네임은 그대로예요.</Txt>
            </View>
            <PrimaryButton label={busy ? '저장 중…' : '저장'} onPress={save} disabled={busy || !valid || text.trim() === cur.nickname} />
          </View>
        )}
      </Screen>
    </>
  );
}
