import { router } from 'expo-router';
import { openLink } from '../lib/openLink';
import { View } from 'react-native';
import { RECEIPT_STATUS_LABEL, ReceiptStatus } from '../data/receiptStatus';
import { isSampleSource } from '../data/repository';
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

/** 화면에 샘플(가짜) 수치가 섞여 있을 때만 보이는 배지. 보여주는 행들의 출처 id를 넘기세요 */
export function SampleBadge({ sourceIds }: { sourceIds: (string | null | undefined)[] }) {
  const { colors } = useTheme();
  if (!sourceIds.some(isSampleSource)) return null;
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

/** 오차 안내 + 제보 (여러 자료를 모은 숫자) */
export function ErrorHint() {
  return (
    <Txt variant="sub" onPress={() => router.push({ pathname: '/report', params: { target: 'data:general', label: '숫자 오차 제보' } })} suppressHighlighting>
      일부 숫자는 여러 자료를 모은 것이라 1~2명 오차가 있을 수 있어요. 다른 점을 보면 알려 주세요.
      <Txt variant="sub" color="brand" style={{ fontWeight: '700' }}> 제보하기 ›</Txt>
    </Txt>
  );
}

/** 모든 수치 아래에 붙이는 출처·기준일. 링크가 있으면 눌러서 원문 열기 */
export function SourceNote({ source, baseDate }: { source: Source | null; baseDate: string | null }) {
  const url = source?.url;
  return (
    <>
    <Txt
      variant="sub"
      onPress={url ? () => openLink(url, '출처') : undefined}
      suppressHighlighting
    >
      출처: {source ? `${source.publisher} · ${source.title}` : '—'} | 기준일: {baseDate ?? '—'}
      {url ? <Txt variant="sub" color="brand" style={{ fontWeight: '700' }}> 원문 보기 ›</Txt> : null}
    </Txt>
    <ErrorHint />
    </>
  );
}

/** 여러 지역을 한 화면에 보여줄 때: 출처가 하나면 그대로, 여러 개면 안내 문구 */
export function SourcesSummary({ rows }: { rows: { source: Source | null; baseDate: string | null }[] }) {
  const ids = new Set(rows.map((r) => r.source?.id ?? '-'));
  if (ids.size <= 1) return <SourceNote source={rows[0]?.source ?? null} baseDate={rows[0]?.baseDate ?? null} />;
  const latest = rows.map((r) => r.baseDate ?? '').sort().at(-1) || '—';
  return (
    <>
      <Txt variant="sub">
        출처: 시도교육청 공고·보도 (지역마다 달라요 — 지역을 누르면 출처와 원문 링크가 보여요) | 최근 기준일: {latest}
      </Txt>
      <ErrorHint />
    </>
  );
}

/** 원서 접수 상태 배지. 색 + 글자로 표시 (색만으로 구분하지 않음) */
export function StatusBadge({ status }: { status: ReceiptStatus }) {
  const { colors } = useTheme();
  const filled = status === 'open';
  const tone = status === 'open' ? colors.brand : status === 'upcoming' ? colors.accent : colors.textSub;
  const icon = status === 'open' ? '●' : status === 'upcoming' ? '◷' : status === 'closed' ? '■' : '○';
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: tone,
        backgroundColor: filled ? tone : 'transparent',
      }}
    >
      <Txt variant="sub" style={{ fontWeight: '700', color: filled ? colors.background : tone }}>
        {icon} {RECEIPT_STATUS_LABEL[status]}
      </Txt>
    </View>
  );
}

export const stageLabel = (stage: 'preliminary' | 'confirmed' | null) =>
  stage === 'confirmed' ? '확정' : stage === 'preliminary' ? '사전예고' : '';
