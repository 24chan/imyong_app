import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Txt } from '../../components/ui';
import { regionByCode } from '../../data/regions';
import { useToday } from '../../store/AppSettings';
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

// 토큰 색에 투명도만 더해 옅은 배경을 만듦 (#RRGGBB + AA)
const tint = (hex: string, alpha = '1F') => (hex.length === 7 ? hex + alpha : hex);

const daysSince = (date: string | null, today: string) =>
  date ? Math.round((Date.parse(today) - Date.parse(date)) / 86400000) : Infinity;

/** 게시판 한 줄: 종류 배지(색) · 지역 · 날짜 / 굵은 제목 / 숫자 */
export function NoticeRow({
  item,
  summary,
  highlight,
  last,
  unread,
}: {
  item: Notice;
  summary?: RegionSummary;
  highlight?: boolean;
  last?: boolean;
  /** 아직 안 본 공고 (B-8, 기기에만 기억) */
  unread?: boolean;
}) {
  const { colors } = useTheme();
  const today = useToday();
  const nums = noticeNumbers(item.docType, summary);
  const tone = item.docType === 'private' ? colors.accent : item.docType === 'final_pass' || item.docType === 'first_pass' ? colors.up : colors.brand;
  const isNew = daysSince(item.postedAt, today) <= 3;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/notice', params: { url: item.url, level: item.level } })}
      accessibilityRole="button"
      accessibilityHint="공고 내용을 앱에서 봐요"
      style={({ pressed }) => ({
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        gap: 6,
        backgroundColor: pressed ? colors.surface : 'transparent',
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.line,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {unread && <View accessibilityLabel="안 본 공고" style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.hot }} />}
        <View style={{ flexShrink: 0, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: tint(tone) }}>
          <Txt variant="sub" style={{ color: tone, fontWeight: '800', fontSize: 12 }}>
            {NOTICE_LABEL[item.docType]}
          </Txt>
        </View>
        <Txt variant="sub" color="text" style={{ fontWeight: '800' }}>
          {regionByCode(item.region)?.shortName ?? item.region}
        </Txt>
        {highlight && <Ionicons name="star" size={12} color={colors.accent} accessibilityLabel="관심 지역" />}
        <Txt variant="sub" style={{ fontSize: 12 }}>
          {item.postedAt ? item.postedAt.slice(5).replace('-', '.') : `${item.year}학년도`}
        </Txt>
        {isNew && (
          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.hot, alignItems: 'center', justifyContent: 'center' }}>
            <Txt style={{ color: colors.background, fontSize: 10, fontWeight: '900' }}>N</Txt>
          </View>
        )}
        <View style={{ flex: 1 }} />
        {item.images.length > 0 && <Ionicons name="image-outline" size={15} color={colors.textSub} />}
        <Ionicons name="chevron-forward" size={15} color={colors.textSub} />
      </View>
      <Txt numberOfLines={2} style={{ fontSize: 16, fontWeight: '700', lineHeight: 22 }}>
        {item.title}
      </Txt>
      {nums && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="stats-chart" size={12} color={tone} />
          <Txt variant="sub" style={{ color: tone, fontWeight: '700' }}>
            {nums}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

/** 게시판 상자: 색 아이콘 머리글 + 테두리 + 줄 구분 (에브리타임 '즐겨찾는 게시판' 느낌) */
export function NoticeBoard({ title, action, children, icon = 'megaphone' }: { title: string; action?: ReactNode; children: ReactNode; icon?: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderRadius: radius.xl, backgroundColor: colors.background, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xs }}>
        <Ionicons name={icon} size={18} color={colors.brand} />
        <Txt variant="heading" style={{ flex: 1 }}>
          {title}
        </Txt>
        {action}
      </View>
      {children}
    </View>
  );
}
