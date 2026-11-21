import { Stack } from 'expo-router';
import { useTheme } from '../../theme/useTheme';

export default function OnboardingLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerBackTitle: '이전',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: '임용몽땅 시작하기' }} />
      <Stack.Screen name="subject" options={{ title: '과목 선택' }} />
      <Stack.Screen name="regions" options={{ title: '관심 지역' }} />
    </Stack>
  );
}
