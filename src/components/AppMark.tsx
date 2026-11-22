import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';

/** 앱 아이콘(책 + 오르는 점 셋)을 그대로 그린 작은 표시 — assets/icon.png와 같은 모양, 색은 토큰 */
export function AppMark({ size = 30 }: { size?: number }) {
  const { colors, scheme } = useTheme();
  const bg = scheme === 'dark' ? colors.surface : colors.brand;
  const fg = scheme === 'dark' ? colors.brand : colors.background;
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel="임용몽땅">
      <Rect x={0} y={0} width={1024} height={1024} rx={230} fill={bg} />
      <Circle cx={354} cy={436} r={53} fill={fg} />
      <Circle cx={512} cy={356} r={53} fill={fg} />
      <Circle cx={670} cy={260} r={57} fill={colors.accent} />
      <Path d="M177 611 Q 362 476 512 585 L 512 664 Q 362 556 177 683 Z" fill={fg} />
      <Path d="M512 585 Q 662 476 847 611 L 847 683 Q 662 556 512 664 Z" fill={fg} opacity={0.82} />
    </Svg>
  );
}
