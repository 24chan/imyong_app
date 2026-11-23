import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import { fontFor } from '../theme/fonts';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

// 공통 UI 조각들. 색은 모두 useTheme()의 토큰에서 가져옵니다.

type TxtProps = TextProps & {
  variant?: 'title' | 'heading' | 'body' | 'sub' | 'number';
  color?: 'text' | 'textSub' | 'brand' | 'up' | 'down' | 'accent' | 'background';
};

export function Txt({ variant = 'body', color, style, ...rest }: TxtProps) {
  const { colors } = useTheme();
  const base = textStyles[variant];
  const c = colors[color ?? (variant === 'sub' ? 'textSub' : 'text')];
  // 굵기에 맞는 Pretendard 파일을 고름 (안드로이드는 굵기 값만으로는 바뀌지 않음)
  const flat: TextStyle = StyleSheet.flatten([base, style]) ?? {};
  const fontFamily = flat.fontFamily ?? fontFor(flat.fontWeight);
  return <Text {...rest} style={[base, { color: c }, style, { fontFamily, fontWeight: undefined }]} />;
}

const textStyles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  heading: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  body: { fontSize: 15.5, lineHeight: 23 },
  sub: { fontSize: 13.5, lineHeight: 20 },
  number: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
});

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const { colors } = useTheme();
  if (!scroll) {
    return <View style={{ flex: 1, backgroundColor: colors.canvas, padding: space.lg }}>{children}</View>;
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl * 2 }}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        // 시안 A (2026-11-23): 연회색 바탕 위 흰 카드, 테두리 없음
        { backgroundColor: colors.background, borderRadius: radius.xl, padding: space.lg, gap: space.sm },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? colors.text : colors.line,
        backgroundColor: selected ? colors.text : colors.background,
      }}
    >
      <Txt style={{ fontWeight: selected ? '700' : '500', color: selected ? colors.canvas : colors.textSub }}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  compact,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.line,
        padding: 3,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              flex: compact ? undefined : 1,
              alignItems: 'center',
              paddingVertical: compact ? 5 : 9,
              paddingHorizontal: compact ? 12 : 8,
              borderRadius: radius.pill,
              backgroundColor: active ? colors.brand : 'transparent',
            }}
          >
            <Txt
              variant={compact ? 'sub' : 'body'}
              style={{ fontWeight: '700' }}
              color={active ? 'background' : 'textSub'}
            >
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  variant = 'solid',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'solid' | 'ghost';
}) {
  const { colors } = useTheme();
  const solid = variant === 'solid';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={{
        alignItems: 'center',
        paddingVertical: 16,
        borderRadius: 14,
        backgroundColor: solid ? colors.brand : 'transparent',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Txt style={{ fontWeight: '800', fontSize: 16 }} color={solid ? 'background' : 'textSub'}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function SelectCard({
  title,
  desc,
  selected,
  onPress,
}: {
  title: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{
        borderRadius: radius.xl,
        padding: space.lg,
        gap: space.xs,
        borderWidth: 2,
        borderColor: selected ? colors.brand : colors.line,
        backgroundColor: colors.surface,
      }}
    >
      <Txt variant="heading" color={selected ? 'brand' : 'text'}>
        {title}
      </Txt>
      <Txt variant="sub">{desc}</Txt>
    </Pressable>
  );
}
