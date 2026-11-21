import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Card, PrimaryButton, Screen, Txt } from '../../components/ui';
import { allAgreed, ConsentBox, NO_CONSENT } from '../../features/account/ConsentBox';
import { hasConsented, LEGAL } from '../../legal/info';
import { authErrorText, useAuth } from '../../store/Auth';
import { useTheme } from '../../theme/useTheme';

// 로그인한 회원이 아직 지금 버전 약관에 동의하지 않았을 때 뜨는 화면
// (예전에 가입한 회원, 약관 버전이 올라갔을 때)
export default function AgreeScreen() {
  const { colors } = useTheme();
  const { session, agreeTerms, signOut } = useAuth();
  const [consent, setConsent] = useState(NO_CONSENT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = !session || hasConsented(session.user.user_metadata);

  useEffect(() => {
    if (!done) return;
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [done]);

  const agree = async () => {
    setBusy(true);
    setError(null);
    try {
      await agreeTerms();
    } catch (e) {
      setError(authErrorText(e));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: '약관 동의', gestureEnabled: false, headerBackVisible: false }} />
      <Txt variant="title">{LEGAL.version > 1 ? '약관이 바뀌었어요' : '약관에 동의해 주세요'}</Txt>
      <Txt variant="sub">
        로그인한 기능(글쓰기·인증·쪽지)을 계속 쓰려면 동의가 필요해요. 동의하지 않으면 로그아웃되고, 자료 보기는 그대로 할 수 있어요.
      </Txt>
      <Card>
        <ConsentBox value={consent} onChange={setConsent} />
        {error && <Txt color="down">{error}</Txt>}
      </Card>
      {busy ? (
        <ActivityIndicator color={colors.brand} />
      ) : (
        <>
          <PrimaryButton label="동의하고 계속하기" onPress={agree} disabled={!allAgreed(consent)} />
          <PrimaryButton
            label="동의하지 않고 로그아웃"
            variant="ghost"
            onPress={async () => {
              await signOut();
            }}
          />
        </>
      )}
    </Screen>
  );
}
