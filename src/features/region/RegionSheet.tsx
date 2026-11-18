import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChangeBadge, SampleBadge, SourceNote, StatusBadge, stageLabel } from '../../components/DataBits';
import { PrimaryButton, Txt } from '../../components/ui';
import type { ReceiptInfo } from '../../data/receiptStatus';
import { regionByCode } from '../../data/regions';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { RegionSummary } from '../../types/data';
import { CompareButton } from './CompareButton';

type Props = {
  row: RegionSummary | null;
  info: ReceiptInfo | null;
  title: string; // 예: '2027학년도 초등'
  onClose: () => void;
  onOpenDetail: (region: string) => void;
  onReport: (region: string) => void;
};

/** 지도에서 지역을 누르면 아래에서 올라오는 상세 */
export function RegionSheet({ row, info, title, onClose, onOpenDetail, onReport }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!row} transparent animationType="slide" onRequestClose={onClose}>
      {/* 바깥을 누르면 닫힘 */}
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="닫기" />
      {row && (
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: radius.lg * 1.5,
            borderTopRightRadius: radius.lg * 1.5,
            borderTopWidth: 1,
            borderColor: colors.line,
            padding: space.lg,
            paddingBottom: space.lg + insets.bottom,
            gap: space.sm,
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
            <Txt variant="title">{regionByCode(row.region)?.shortName}</Txt>
            {info && <StatusBadge status={info.status} />}
          </View>
          <Txt variant="sub">{title}</Txt>
          {info && <Txt variant="sub">{info.detail}</Txt>}

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
            <Txt variant="number">{row.selection?.toLocaleString() ?? '—'}</Txt>
            <Txt variant="sub" style={{ marginBottom: 5 }}>
              명 · {stageLabel(row.selectionStage)}
              {row.preliminary != null && row.confirmed != null ? ` (사전예고 ${row.preliminary} → 확정 ${row.confirmed})` : ''}
            </Txt>
          </View>
          <ChangeBadge change={row.change} rate={row.changeRate} />

          <View style={{ gap: 2 }}>
            <Line label="경쟁률 (접수 / 응시)" value={`${row.ratioApplied ?? '—'} / ${row.ratioActual ?? '—'} : 1`} />
            <Line label="1차 합격선" value={row.firstCutoff != null ? `${row.firstCutoff}점` : '—'} />
          </View>

          <SampleBadge />
          <SourceNote source={row.source} baseDate={row.baseDate} />

          <View style={{ gap: space.xs, marginTop: space.xs }}>
            <PrimaryButton label="추이·그래프 보기" onPress={() => onOpenDetail(row.region)} />
            <CompareButton region={row.region} />
            <PrimaryButton
              label="오류 신고"
              variant="ghost"
              onPress={() => onReport(row.region)}
            />
          </View>
        </View>
      )}
    </Modal>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Txt variant="sub">{label}</Txt>
      <Txt variant="sub" color="text" style={{ fontWeight: '700' }}>
        {value}
      </Txt>
    </View>
  );
}
