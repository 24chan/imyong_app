import { View } from 'react-native';
import { Txt } from '../../components/ui';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/** 처음 실행 단계 표시: "1 / 3" + 진행 막대 + 제목·설명 */
export function StepHeader({ step, total, title, desc }: { step: number; total: number; title: string; desc: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.sm, marginBottom: space.sm }}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${total}단계 중 ${step}단계`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
      >
        <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
          {Array.from({ length: total }, (_, i) => (
            <View
              key={i}
              style={{ flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: i < step ? colors.brand : colors.line }}
            />
          ))}
        </View>
        <Txt variant="sub" style={{ fontWeight: '700' }}>
          {step} / {total}
        </Txt>
      </View>
      <Txt variant="title">{title}</Txt>
      <Txt variant="sub">{desc}</Txt>
    </View>
  );
}
