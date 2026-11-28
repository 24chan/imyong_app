import { Stack } from 'expo-router';
import { useTheme } from '../../theme/useTheme';

export default function OnboardingLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: 'Pretendard-Bold' },
        headerBackTitleStyle: { fontFamily: 'Pretendard-SemiBold' },
        headerBackTitle: '이전',
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="index" options={{ title: '임용몽땅 시작하기' }} />
      <Stack.Screen name="subject" options={{ title: '임용몽땅 시작하기' }} />
      <Stack.Screen name="regions" options={{ title: '임용몽땅 시작하기' }} />
    </Stack>
  );
}
