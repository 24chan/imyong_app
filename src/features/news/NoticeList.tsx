import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, Pressable, View } from 'react-native';
import { Card, Txt } from '../../components/ui';
import { regionByCode } from '../../data/regions';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { Notice, NoticeType, RegionSummary } from '../../types/data';

export const NOTICE_LABEL: Record<NoticeType, string> = {
  prelim: '사전예고',
  plan: '시행계획',
  receipt: '접수 현황',
  attend: '응시 현황',
  first_pass: '1차 합격',
  final_pass: '최종 합격',
  private: '사립 위탁',
};

const n = (v: number | null | undefined, unit = '명') => (v != null ? `${v.toLocaleString()}${unit}` : null);

/** 공고 종류에 맞는 숫자 한 줄 (승인된 앱 데이터에서만) */
export function noticeNumbers(t: NoticeType, s: RegionSummary | undefined): string | null {
  if (!s) return null;
  const parts =
    t === 'receipt'
      ? [n(s.applicants) && `지원 ${n(s.applicants)}`, s.ratioApplied != null && `경쟁률 ${s.ratioApplied}:1`]
      : t === 'attend'
        ? [n(s.takers) && `응시 ${n(s.takers)}`, s.ratioActual != null && `응시 경쟁률 ${s.ratioActual}:1`]
        : t === 'first_pass'
          ? [n(s.firstPassed) && `1차 합격 ${n(s.firstPassed)}`, s.firstCutoff != null && `합격선 ${s.firstCutoff}점`]
          : t === 'final_pass'
            ? [n(s.finalPassed) && `최종 합격 ${n(s.finalPassed)}`, s.finalCutoff != null && `합격선 ${s.finalCutoff}점`]
            : t === 'plan' || t === 'prelim'
              ? [n(s.selection) && `선발 ${n(s.selection)}`]
              : [];
  const text = parts.filter(Boolean).join(' · ');
  return text || null;
}

export function NoticeItem({ item, summary, highlight }: { item: Notice; summary?: RegionSummary; highlight?: boolean }) {
  const { colors } = useTheme();
  const nums = noticeNumbers(item.docType, summary);
  return (
    <Pressable
      onPress={() => Linking.openURL(item.url).catch(() => {})}
      accessibilityRole="link"
      accessibilityHint="교육청 원문 공고를 열어요"
    >
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: item.docType === 'private' ? colors.accent : colors.brand,
            }}
          >
            <Txt variant="sub" color={item.docType === 'private' ? 'accent' : 'brand'} style={{ fontWeight: '700' }}>
              {NOTICE_LABEL[item.docType]}
            </Txt>
          </View>
          <Txt variant="sub" color="text" style={{ fontWeight: '700' }}>
            {regionByCode(item.region)?.shortName ?? item.region}
            {highlight ? ' ★' : ''}
          </Txt>
          <Txt variant="sub">
            {item.year}학년도{item.postedAt ? ` · ${item.postedAt.slice(5).replace('-', '.')}` : ''}
          </Txt>
          <View style={{ flex: 1 }} />
          <Ionicons name="open-outline" size={16} color={colors.textSub} />
        </View>
        <Txt numberOfLines={2}>{item.title}</Txt>
        {nums && (
          <Txt variant="sub" color="brand" style={{ fontWeight: '700' }}>
            {nums}
          </Txt>
        )}
      </Card>
    </Pressable>
  );
}
