import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import { AppSettingsProvider, useAppSettings } from '../store/AppSettings';
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
        <Stack.Screen name="trend" options={{ title: '추이·합격률', headerBackTitle: '지역·TO' }} />
        <Stack.Screen name="report" options={{ title: '오류 신고', presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppSettingsProvider>
      <RootStack />
    </AppSettingsProvider>
  );
}
