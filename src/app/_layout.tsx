import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import { AppSettingsProvider, useAppSettings } from '../store/AppSettings';
import { AuthProvider } from '../store/Auth';
import { useTheme } from '../theme/useTheme';

function RootStack() {
  const { hydrated } = useAppSettings();
  const { scheme, colors } = useTheme();

  // 화면 전환 때 뒤 배경이 하얗게 번쩍이지 않도록
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  // 저장된 설정을 불러오기 전에는 빈 배경만 보여줌
  if (!hydrated) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
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
        <Stack.Screen name="verify" options={{ title: '학교·교사 인증', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="admin" options={{ title: '운영자', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="login" options={{ title: '로그인 · 가입', presentation: 'modal' }} />
        <Stack.Screen name="report" options={{ title: '오류 신고', presentation: 'modal' }} />
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
