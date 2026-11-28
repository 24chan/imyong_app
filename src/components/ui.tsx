import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fontFor } from '../theme/fonts';
import { CatKey, radius, space } from '../theme/tokens';
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
  // 2026-11-28 개편: 화면 제목 24·800 / 카드 제목 17·800 / 본문 15.5 / 보조 13·500
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  heading: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },
  body: { fontSize: 15.5, lineHeight: 23 },
  sub: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  number: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
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
  const { colors, scheme } = useTheme();
  return (
    <View
      style={[
        // 시안 A (2026-11-23): 연회색 바탕 위 흰 카드, 테두리 없음
        // 2026-11-28: 다크 모드는 카드와 바탕 차이가 작아 얇은 테두리로 칸을 나눔
        { backgroundColor: colors.background, borderRadius: radius.xl, padding: space.lg, gap: space.sm, borderWidth: scheme === 'dark' ? 1 : 0, borderColor: colors.line },
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
  variant?: 'solid' | 'ghost' | 'outline';
}) {
  const { colors } = useTheme();
  const solid = variant === 'solid';
  const outline = variant === 'outline';
  // 2026-11-28 디자인 마무리: ghost 도 '누르는 단추'로 보이게 연한 칸 + 얇은 테두리(글자만 떠 있던 문제)
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: solid || outline ? 54 : 48,
        paddingHorizontal: space.lg,
        borderRadius: 14,
        backgroundColor: solid ? colors.brand : outline ? colors.background : colors.surface,
        borderWidth: solid ? 0 : 1,
        borderColor: outline ? colors.brand : colors.line,
        opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
      })}
    >
      <Txt style={{ fontWeight: solid || outline ? '800' : '700', fontSize: solid || outline ? 16 : 15 }} color={solid ? 'background' : outline ? 'brand' : 'text'}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** 설정·메뉴 목록 한 줄: 왼쪽 색 아이콘 + 이름(+설명) + 오른쪽 화살표, 줄 사이 구분선 (2026-11-28 디자인 마무리) */
export function ListRow({
  icon,
  cat = 'gray',
  label,
  sub,
  onPress,
  danger,
  first,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  cat?: CatKey;
  label: string;
  sub?: string;
  onPress?: () => void;
  danger?: boolean;
  first?: boolean;
  right?: ReactNode;
}) {
  const { colors } = useTheme();
  const tone = danger ? { bg: colors.cat.coral.bg, fg: colors.down } : colors.cat[cat];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: 56,
        paddingVertical: 10,
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth * 2,
        borderTopColor: colors.line,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={tone.fg} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Txt style={{ fontSize: 16, fontWeight: '600', color: danger ? colors.down : colors.text }}>{label}</Txt>
        {!!sub && <Txt variant="sub" style={{ fontSize: 12.5 }}>{sub}</Txt>}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textSub} /> : null)}
    </Pressable>
  );
}

/** 카드 위 작은 묶음 이름 */
export function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <Txt variant="sub" style={{ fontSize: 13, fontWeight: '700', marginTop: space.sm, marginLeft: 4 }}>
      {children}
    </Txt>
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
