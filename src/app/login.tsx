import { router, Stack } from 'expo-router';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from 'react-native';
import { TextInput } from '../components/TextField';
import { Card, PrimaryButton, Screen, Txt } from '../components/ui';
import { allAgreed, ConsentBox, NO_CONSENT } from '../features/account/ConsentBox';
import { authErrorText, useAuth } from '../store/Auth';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SEC = 60;

// 로그인·가입: 이메일로 받은 6자리 코드를 넣으면 끝 (처음이면 자동으로 가입)
export default function LoginScreen() {
  const { colors } = useTheme();
  const { sendCode, verifyCode, session } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [consent, setConsent] = useState(NO_CONSENT);
  const codeRef = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  // 로그인되면 이전 화면으로
  useEffect(() => {
    if (session) router.back();
  }, [session]);

  const send = async () => {
    if (!allAgreed(consent)) {
      setError('필수 항목에 모두 동의해 주세요.');
      return;
    }
    if (!EMAIL.test(email.trim())) {
      setError('이메일 주소 형식을 확인해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendCode(email, true);
      setStep('code');
      setWait(RESEND_SEC);
      setTimeout(() => codeRef.current?.focus(), 300);
    } catch (e) {
      setError(authErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (value.trim().length < 6) return;
    setBusy(true);
    setError(null);
    try {
      await verifyCode(email, value);
    } catch (e) {
      setError(authErrorText(e));
      setBusy(false);
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    fontSize: 17,
  } as const;

  return (
    <>
      <Stack.Screen options={{ title: '로그인 · 가입' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen>
          <Txt variant="title">{step === 'email' ? '이메일로 시작하기' : '메일함을 확인해 주세요'}</Txt>
          <Txt variant="sub">
            {step === 'email'
              ? '처음이면 자동으로 가입돼요. 비밀번호는 없어요. 로그인하지 않아도 자료는 모두 볼 수 있고, 글쓰기·댓글은 로그인과 인증 후에 할 수 있어요.'
              : `${email.trim()} 로 보낸 6자리 숫자를 넣어 주세요. 코드는 1시간 동안 쓸 수 있어요. 메일이 안 보이면 스팸함도 확인해 주세요.`}
          </Txt>

          <Card>
            {step === 'email' ? (
              <>
                <Txt variant="heading">이메일</Txt>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="example@gmail.com"
                  placeholderTextColor={colors.textSub}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                  returnKeyType="send"
                  onSubmitEditing={send}
                  style={inputStyle}
                  accessibilityLabel="이메일 주소"
                />
                <Txt variant="sub">학교 메일이 아니어도 돼요. 학교 인증은 로그인한 뒤 따로 해요.</Txt>
              </>
            ) : (
              <>
                <Txt variant="heading">인증 코드</Txt>
                <TextInput
                  ref={codeRef}
                  value={code}
                  onChangeText={(t) => {
                    const v = t.replace(/\D/g, '').slice(0, 6);
                    setCode(v);
                    if (v.length === 6) verify(v);
                  }}
                  placeholder="6자리 숫자"
                  placeholderTextColor={colors.textSub}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={6}
                  style={[inputStyle, { fontSize: 24, letterSpacing: 8, textAlign: 'center' }]}
                  accessibilityLabel="인증 코드 6자리"
                />
              </>
            )}
            {error && <Txt color="down">{error}</Txt>}
          </Card>

          {step === 'email' && (
            <Card>
              <ConsentBox value={consent} onChange={setConsent} />
            </Card>
          )}

          {busy ? (
            <ActivityIndicator color={colors.brand} />
          ) : step === 'email' ? (
            <PrimaryButton label="동의하고 인증 코드 받기" onPress={send} disabled={!email.trim() || !allAgreed(consent)} />
          ) : (
            <View style={{ gap: space.xs }}>
              <PrimaryButton label="확인" onPress={() => verify()} disabled={code.length < 6} />
              <PrimaryButton
                label={wait > 0 ? `새 코드는 ${wait}초 뒤에 받을 수 있어요` : '새 코드 받기'}
                variant="ghost"
                disabled={wait > 0}
                onPress={send}
              />
              <PrimaryButton
                label="이메일 다시 입력"
                variant="ghost"
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setError(null);
                }}
              />
            </View>
          )}
        </Screen>
      </KeyboardAvoidingView>
    </>
  );
}
