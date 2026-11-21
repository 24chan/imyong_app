import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';
import { ChangeBadge, StatusBadge, stageLabel } from '../../components/DataBits';
import { Card, Txt } from '../../components/ui';
import type { ReceiptInfo } from '../../data/receiptStatus';
import { regionByCode } from '../../data/regions';
import { space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { RegionSummary } from '../../types/data';

type CardProps = { row: RegionSummary; info: ReceiptInfo | null; onPress: () => void };

/** 목록형: 한 줄에 한 지역 */
export function RegionRow({ row: r, info, onPress }: CardProps) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ flex: 1, gap: space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
            <Txt variant="heading">{regionByCode(r.region)?.shortName}</Txt>
            {info && <StatusBadge status={info.status} />}
          </View>
          <ChangeBadge change={r.change} rate={r.changeRate} />
          {info && <Txt variant="sub">{info.detail}</Txt>}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Txt variant="number">
            {r.selection != null ? r.selection.toLocaleString() : '—'}
            <Txt variant="sub"> 명</Txt>
          </Txt>
          <Txt variant="sub">
            {stageLabel(r.selectionStage)}
            {r.ratioApplied != null ? ` · ${r.ratioApplied} : 1` : ''}
          </Txt>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSub} />
      </Card>
    </Pressable>
  );
}

/** 격자형: 한 줄에 세 지역 (홈과 같은 정사각형 칸) */
export function RegionTile({ row: r, info, onPress }: CardProps) {
  const { colors } = useTheme();
  const tone = r.change == null ? colors.textSub : r.change > 0 ? colors.up : r.change < 0 ? colors.down : colors.textSub;
  const sign = r.change == null ? '' : r.change > 0 ? '▲ ' : r.change < 0 ? '▼ ' : '– ';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${regionByCode(r.region)?.shortName} 선발 ${r.selection ?? '자료 없음'}명`}
      style={({ pressed }) => ({ width: '31.8%', aspectRatio: 1, backgroundColor: pressed ? colors.surface : colors.background, borderWidth: 1, borderColor: info?.status === 'open' ? colors.cat.green.fg : colors.line, borderRadius: 18, padding: 12, justifyContent: 'space-between' })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt style={{ fontSize: 15, fontWeight: '800' }}>{regionByCode(r.region)?.shortName}</Txt>
        <Ionicons name="chevron-forward" size={14} color={colors.textSub} />
      </View>
      <View style={{ gap: 2 }}>
        <Txt style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }} numberOfLines={1} adjustsFontSizeToFit>
          {r.selection != null ? r.selection.toLocaleString() : '—'}
          <Txt variant="sub"> 명</Txt>
        </Txt>
        <Txt style={{ fontSize: 12.5, fontWeight: '800', color: tone }} numberOfLines={1}>
          {r.change == null ? '전년 자료 없음' : `${sign}${Math.abs(r.change).toLocaleString()}`}
        </Txt>
        <Txt variant="sub" style={{ fontSize: 11.5 }} numberOfLines={1}>
          {info?.status === 'open' ? <Txt variant="sub" style={{ fontSize: 11.5, fontWeight: '800', color: colors.cat.green.fg }}>● 접수 중</Txt> : `${stageLabel(r.selectionStage)}${r.ratioApplied != null ? ` · ${r.ratioApplied}:1` : ''}`}
        </Txt>
      </View>
    </Pressable>
  );
}
