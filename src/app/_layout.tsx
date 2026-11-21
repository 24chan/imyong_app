import { useFonts } from 'expo-font';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import { AppSettingsProvider, useAppSettings } from '../store/AppSettings';
import { hasConsented } from '../legal/info';
import { AuthProvider, useAuth } from '../store/Auth';
import { FONT_FILES } from '../theme/fonts';
import { useTheme } from '../theme/useTheme';

// 글꼴·설정을 다 불러올 때까지 처음 화면(로고)을 유지
SplashScreen.preventAutoHideAsync().catch(() => {});

/** 로그인했는데 지금 버전 약관에 동의 기록이 없으면 동의 화면으로 (예전 가입자·약관 변경) */
function useConsentGate(ready: boolean) {
  const { session } = useAuth();
  const pathname = usePathname();
  const needs = !!session && !hasConsented(session.user.user_metadata);
  useEffect(() => {
    if (!ready || !needs) return;
    // 로그인 화면이 닫히고 동의 기록이 갱신될 시간을 잠깐 기다림. 약관 보기 화면에서는 띄우지 않음
    if (['/login', '/legal', '/onboarding'].some((p) => pathname.startsWith(p))) return;
    const t = setTimeout(() => router.push('/legal/agree'), 800);
    return () => clearTimeout(t);
  }, [ready, needs, pathname]);
}

function RootStack() {
  const { hydrated } = useAppSettings();
  const { scheme, colors } = useTheme();
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);

  // 화면 전환 때 뒤 배경이 하얗게 번쩍이지 않도록
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  // 저장된 설정을 불러오기 전에는 빈 배경만 보여줌
  const ready = hydrated && (fontsLoaded || !!fontError);
  useConsentGate(ready);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: 'Pretendard-Bold' },
          headerBackTitleStyle: { fontFamily: 'Pretendard-Medium' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: '설정' }} />
        <Stack.Screen name="regions/[code]" options={{ title: '', headerBackTitle: '지역·TO' }} />
        <Stack.Screen name="compare" options={{ title: '지역 비교', headerBackTitle: '지역·TO' }} />
        <Stack.Screen name="private" options={{ title: '사립 위탁 채용', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="schools" options={{ title: '학교 지도', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="trend" options={{ title: '추이·합격률', headerBackTitle: '지역·TO' }} />
        <Stack.Screen name="notice" options={{ title: '공고', headerBackTitle: '소식' }} />
        <Stack.Screen name="news" options={{ title: '임용 소식', headerBackTitle: '홈' }} />
        <Stack.Screen name="community/[id]" options={{ title: '', headerBackTitle: '커뮤니티' }} />
        <Stack.Screen name="community/write" options={{ title: '글쓰기', presentation: 'modal' }} />
        <Stack.Screen name="messages/index" options={{ title: '쪽지함', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="messages/[id]" options={{ title: '쪽지', headerBackTitle: '쪽지함' }} />
        <Stack.Screen name="rules" options={{ title: '이용 규칙', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="scraps" options={{ title: '내 스크랩', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="study/[id]" options={{ title: '스터디', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="study/new" options={{ title: '스터디 모집', presentation: 'modal' }} />
        <Stack.Screen name="materials/[id]" options={{ title: '공부 자료', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="materials/write" options={{ title: '자료 올리기', presentation: 'modal' }} />
        <Stack.Screen name="mock/[id]" options={{ title: '모의고사', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="mock/scores" options={{ title: '점수 비교', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="lecture/[id]" options={{ title: '강의', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="univ-pass" options={{ title: '대학별 합격률', headerBackTitle: '지역·TO' }} />
        <Stack.Screen name="verify" options={{ title: '학교·교사 인증', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="admin" options={{ title: '운영자', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="login" options={{ title: '로그인 · 가입', presentation: 'modal' }} />
        <Stack.Screen name="report" options={{ title: '오류 신고', presentation: 'modal' }} />
        <Stack.Screen name="search" options={{ title: '검색', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="legal/[doc]" options={{ title: '', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="legal/agree" options={{ title: '약관 동의', gestureEnabled: false, headerBackVisible: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppSettingsProvider>
      <AuthProvider>
        <RootStack />
      </AuthProvider>
    </AppSettingsProvider>
  );
}
