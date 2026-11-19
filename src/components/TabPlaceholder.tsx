import type React from 'react';
import { View } from 'react-native';
import { useAppSettings } from '../store/AppSettings';
import { space } from '../theme/tokens';
import { useModeLabel, ViewModeBanner } from './ModeToggle';
import { Card, Screen, Txt } from './ui';

/** 아직 만들지 않은 탭의 '준비 중' 화면. 모드에 따라 문구가 바뀝니다. */
export function TabPlaceholder({
  title,
  elementary,
  secondary,
  stage,
  footer,
}: {
  title: string;
  elementary: string[];
  secondary: string[];
  stage: string; // 예: 'MVP 3단계', 'v1'
  footer?: React.ReactNode;
}) {
  const { viewLevel } = useAppSettings();
  const modeLabel = useModeLabel();
  const items = viewLevel === 'elementary' ? elementary : secondary;
  return (
    <Screen>
      <ViewModeBanner />
      <Card>
        <Txt variant="sub" color="brand" style={{ fontWeight: '700' }}>
          {modeLabel} 모드
        </Txt>
        <Txt variant="title">{title}</Txt>
        <Txt variant="sub">준비 중 · {stage}에 만들어요</Txt>
      </Card>
      <Card>
        <Txt variant="heading">이 탭에 들어올 내용</Txt>
        <View style={{ gap: space.xs }}>
          {items.map((t) => (
            <Txt key={t}>• {t}</Txt>
          ))}
        </View>
      </Card>
      {footer}
    </Screen>
  );
}
