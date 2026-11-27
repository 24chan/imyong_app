import { router, Stack } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { Screen, Txt } from '../../components/ui';
import { Feature, useAccess } from '../../lib/access';
import { useTheme } from '../../theme/useTheme';

/** 볼 수 없는 사람이 주소로 바로 들어오면 일반 '없는 화면'처럼 보여 줌(전용 기능이라는 말 없이) */
export function Gate({ feature, children }: { feature: Feature; children: ReactNode }) {
  const can = useAccess();
  const { colors } = useTheme();
  if (can(feature)) return <>{children}</>;
  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <Screen>
        <Txt variant="sub">찾는 화면이 없어요.</Txt>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={8}>
          <Txt style={{ fontWeight: '700', color: colors.brand }}>돌아가기 ›</Txt>
        </Pressable>
      </Screen>
    </>
  );
}
