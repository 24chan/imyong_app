import { SocialButtons } from '../features/auth/SocialButtons';
import { router, Stack } from 'expo-router';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { TextInput } from '../components/TextField';
import { Card, PrimaryButton, Screen, Txt } from '../components/ui';
import { allAgreed, ConsentBox, NO_CONSENT } from '../features/account/ConsentBox';
import { authErrorText, getLastRedirect, useAuth } from '../store/Auth';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SEC = 60;

// 로그인·가입: 이메일로 받은 6자리 코드를 넣으면 끝 (처음이면 자동으로 가입)
export default function LoginScreen() {
  const { colors } = useTheme();
  const { sendCode, verifyCode, signInWithProvider, session } = useAuth();
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

  const social = async (provider: 'google' | 'kakao') => {
    if (!allAgreed(consent)) {
      setError('필수 항목에 모두 동의해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ok = await signInWithProvider(provider, true);
      if (!ok) setError(`로그인 창이 닫혔어요. 계정을 고른 뒤 흰 화면에 멈췄다면 이 화면을 캡처해 주세요.\n(돌아올 주소: ${getLastRedirect()})`);
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
          <Txt variant="title">{step === 'email' ? '시작하기' : '메일함을 확인해 주세요'}</Txt>
          <Txt variant="sub">
            {step === 'email'
              ? '약관에 동의하고 카카오·Google 계정으로 바로 시작하거나, 이메일 코드로 시작해요. 처음이면 자동으로 가입돼요. 로그인하지 않아도 자료는 모두 볼 수 있어요.'
              : `${email.trim()} 로 보낸 숫자 코드를 넣어 주세요. 코드는 1시간 동안 쓸 수 있어요. 메일이 안 보이면 스팸함도 확인해 주세요.`}
          </Txt>

          {step === 'email' && (
            <Card>
              <ConsentBox value={consent} onChange={setConsent} />
            </Card>
          )}

          {step === 'email' && (
            <View style={{ gap: space.sm }}>
              <SocialButtons onPress={social} disabled={busy} dim={!allAgreed(consent)} />
              <Txt variant="sub" style={{ textAlign: 'center', marginTop: space.sm }}>
                또는 이메일로 시작 (학교 메일이면 로그인과 동시에 학교 인증까지 돼요)
              </Txt>
            </View>
          )}

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
                <Txt variant="sub">학교 메일이 아니어도 돼요. 학교 메일로 시작하면 교대 인증이 바로 끝나요.</Txt>
              </>
            ) : (
              <>
                <Txt variant="heading">인증 코드</Txt>
                <TextInput
                  ref={codeRef}
                  value={code}
                  onChangeText={(t) => {
                    // 2026-11-28: Supabase 설정에 따라 6~10자리라 자동 확인은 안 하고 '확인'으로
                    setCode(t.replace(/\D/g, '').slice(0, 10));
                  }}
                  placeholder="메일에 온 숫자"
                  placeholderTextColor={colors.textSub}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={10}
                  style={[inputStyle, { fontSize: 24, letterSpacing: 8, textAlign: 'center' }]}
                  accessibilityLabel="인증 코드"
                />
              </>
            )}
            {error && <Txt color="down">{error}</Txt>}
          </Card>

          {busy ? (
            <ActivityIndicator color={colors.brand} />
          ) : step === 'email' ? (
            <PrimaryButton label="이메일로 인증 코드 받기" variant="ghost" onPress={send} disabled={!email.trim() || !allAgreed(consent)} />
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
