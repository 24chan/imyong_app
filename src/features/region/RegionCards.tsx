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

/** 격자형: 한 줄에 두 지역 (정사각형에 가까운 카드) */
export function RegionTile({ row: r, info, onPress }: CardProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ width: '48.5%' }}>
      <Card style={{ aspectRatio: 1, justifyContent: 'space-between', padding: space.md }}>
        <View style={{ gap: space.xs }}>
          <Txt variant="heading">{regionByCode(r.region)?.shortName}</Txt>
          {info && <StatusBadge status={info.status} />}
        </View>
        <View style={{ gap: space.xs }}>
          <Txt variant="number">
            {r.selection != null ? r.selection.toLocaleString() : '—'}
            <Txt variant="sub"> 명</Txt>
          </Txt>
          <ChangeBadge change={r.change} rate={r.changeRate} />
          <Txt variant="sub" numberOfLines={1}>
            {stageLabel(r.selectionStage)}
            {r.ratioApplied != null ? ` · ${r.ratioApplied} : 1` : ''}
          </Txt>
        </View>
      </Card>
    </Pressable>
  );
}
