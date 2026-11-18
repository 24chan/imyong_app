import { View } from 'react-native';
import { IS_SAMPLE_DATA } from '../data/repository';
import type { Source } from '../types/data';
import { radius } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Txt } from './ui';

/** 전년 대비 증감 배지: 증가 초록, 감소 빨강 */
export function ChangeBadge({ change, rate }: { change: number | null; rate?: number | null }) {
  const { colors } = useTheme();
  if (change == null) return <Txt variant="sub">전년 자료 없음</Txt>;
  const tone = change > 0 ? colors.up : change < 0 ? colors.down : colors.textSub;
  const sign = change > 0 ? '▲' : change < 0 ? '▼' : '–';
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: tone,
      }}
    >
      <Txt variant="sub" style={{ color: tone, fontWeight: '700' }}>
        {sign} {Math.abs(change).toLocaleString()}명{rate != null ? ` (${Math.abs(rate)}%)` : ''}
      </Txt>
    </View>
  );
}

/** 샘플 데이터임을 알리는 배지 */
export function SampleBadge() {
  const { colors } = useTheme();
  if (!IS_SAMPLE_DATA) return null;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.pill,
        backgroundColor: colors.accent,
      }}
    >
      <Txt variant="sub" color="background" style={{ fontWeight: '800' }}>
        샘플 데이터 · 실제 수치 아님
      </Txt>
    </View>
  );
}

/** 모든 수치 아래에 붙이는 출처·기준일 */
export function SourceNote({ source, baseDate }: { source: Source | null; baseDate: string | null }) {
  return (
    <Txt variant="sub">
      출처: {source ? `${source.publisher} · ${source.title}` : '—'} | 기준일: {baseDate ?? '—'}
    </Txt>
  );
}

export const stageLabel = (stage: 'preliminary' | 'confirmed' | null) =>
  stage === 'confirmed' ? '확정' : stage === 'preliminary' ? '사전예고' : '';
