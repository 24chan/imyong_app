import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextProps, View, ViewStyle } from 'react-native';
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
  return <Text {...rest} style={[base, { color: c }, style]} />;
}

const textStyles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800' },
  heading: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
  sub: { fontSize: 13, lineHeight: 19 },
  number: { fontSize: 28, fontWeight: '800' },
});

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const { colors } = useTheme();
  if (!scroll) {
    return <View style={{ flex: 1, backgroundColor: colors.background, padding: space.lg }}>{children}</View>;
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 }}
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
        { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
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
        borderColor: selected ? colors.brand : colors.line,
        backgroundColor: selected ? colors.brand : colors.background,
      }}
    >
      <Txt style={{ fontWeight: '600' }} color={selected ? 'background' : 'text'}>
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
        paddingVertical: 15,
        borderRadius: radius.md,
        backgroundColor: solid ? colors.brand : 'transparent',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Txt style={{ fontWeight: '700', fontSize: 16 }} color={solid ? 'background' : 'textSub'}>
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
        borderRadius: radius.lg,
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
