import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { ComponentRef, ReactNode, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { ChangeBadge, SampleBadge, SourcesSummary, StatusBadge, stageLabel } from '../components/DataBits';
import { ViewModeBanner } from '../components/ModeToggle';
import { Chip, PrimaryButton, Screen, Txt } from '../components/ui';
import { getReceiptInfo } from '../data/receiptStatus';
import { REGIONS, regionByCode } from '../data/regions';
import { getRegionSummaries, getSchedules } from '../data/repository';
import { subjectByCode } from '../data/subjects';
import { useAsync } from '../data/useAsync';
import { FilterChips } from '../features/region/FilterChips';
import { useRegionFilters } from '../features/region/useRegionFilters';
import { MAX_COMPARE, useCompare, useToday } from '../store/AppSettings';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import type { RegionSummary } from '../types/data';

// 지역 비교: 2~3개 지역을 나란히 + 이미지 카드로 저장·공유
export default function CompareScreen() {
  const { colors } = useTheme();
  const today = useToday();
  const compare = useCompare();
  const f = useRegionFilters();
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState(false);

  const all = useAsync(
    () => (f.ready ? getRegionSummaries(f.query, f.year!) : Promise.resolve([])),
    [f.ready, f.query, f.year],
  );
  const schedules = useAsync(
    () => (f.isLatest ? getSchedules(f.viewLevel, f.year!) : Promise.resolve([])),
    [f.isLatest, f.viewLevel, f.year],
  );
  const picked = compare.list
    .map((code) => all.data?.find((r) => r.region === code))
    .filter((r): r is RegionSummary => !!r);
  const statusOf = (region: string) =>
    f.isLatest ? getReceiptInfo((schedules.data ?? []).filter((s) => s.region === region), today) : null;

  const modeTitle = f.isSecondary ? `중등 ${subjectByCode(f.subject)?.name ?? ''}` : '초등';

  const pickRegion = (code: string) => {
    if (!compare.toggle(code)) Alert.alert('비교는 최대 3개 지역까지예요', '하나를 빼고 다시 골라 주세요.');
  };

  const capture = () => captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });

  const share = async (uri?: string) => {
    try {
      const file = uri ?? (await capture());
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('이 기기에서는 공유를 쓸 수 없어요');
        return;
      }
      await Sharing.shareAsync(file, { mimeType: 'image/png', dialogTitle: '지역 비교 카드' });
    } catch (e) {
      Alert.alert('공유하지 못했어요', String(e));
    }
  };

  const save = async () => {
    setBusy(true);
    let uri: string | undefined;
    try {
      uri = await capture();
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) throw new Error('사진 저장 권한이 없어요');
      await MediaLibrary.Asset.create(uri);
      Alert.alert('사진에 저장했어요', '갤러리(사진 앱)에서 확인해 보세요.');
    } catch (e) {
      // Expo Go 등에서 저장이 막히면 공유 창으로 대신 저장할 수 있게
      Alert.alert('사진에 바로 저장하지 못했어요', `${e instanceof Error ? e.message : e}\n공유 창에서 "이미지 저장"을 골라 주세요.`, [
        { text: '취소', style: 'cancel' },
        { text: '공유 창 열기', onPress: () => share(uri) },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ViewModeBanner />
      <FilterChips f={f} />

      <View style={{ gap: space.sm }}>
        <Txt variant="heading">
          지역 고르기 ({compare.list.length}/{MAX_COMPARE})
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {REGIONS.map((r) => (
            <Chip key={r.code} label={r.shortName} selected={compare.has(r.code)} onPress={() => pickRegion(r.code)} />
          ))}
        </View>
      </View>

      {all.loading && <ActivityIndicator color={colors.brand} />}

      {picked.length < 2 ? (
        <Txt variant="sub">비교할 지역을 2개 이상 골라 주세요.</Txt>
      ) : (
        <>
          {/* 이 카드가 그대로 이미지로 저장됩니다 */}
          <View
            ref={cardRef}
            collapsable={false}
            style={{
              backgroundColor: colors.background,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.line,
              padding: space.lg,
              gap: space.md,
            }}
          >
            <View style={{ gap: space.xs }}>
              <Txt variant="sub" color="brand" style={{ fontWeight: '800' }}>
                임용맵 · 지역 비교
              </Txt>
              <Txt variant="title">
                {f.year}학년도 {modeTitle}
              </Txt>
              <SampleBadge sourceIds={picked.map((r) => r.source?.id)} />
            </View>

            {/* 지역 이름 */}
            <CompareRow label="" cells={picked.map((r) => <Txt key={r.region} variant="heading">{regionByCode(r.region)?.shortName}</Txt>)} />
            {f.isLatest && (
              <CompareRow
                label="접수 상태"
                cells={picked.map((r) => {
                  const info = statusOf(r.region);
                  return info ? <StatusBadge key={r.region} status={info.status} /> : <Txt key={r.region}>—</Txt>;
                })}
              />
            )}
            <CompareRow
              label="선발 인원"
              cells={picked.map((r) => (
                <View key={r.region}>
                  <Txt variant="number" style={{ fontSize: 24 }}>
                    {r.selection?.toLocaleString() ?? '—'}
                  </Txt>
                  <Txt variant="sub">{stageLabel(r.selectionStage)}</Txt>
                </View>
              ))}
            />
            <CompareRow label="전년 대비" cells={picked.map((r) => <ChangeBadge key={r.region} change={r.change} />)} />
            {picked.some((r) => r.general != null || r.disabled != null || r.regional) && (
              <CompareRow
                label="일반 / 장애 / 지역"
                cells={picked.map((r) => (
                  <Val key={r.region} v={r.general != null || r.disabled != null ? `${r.general ?? '—'} / ${r.disabled ?? '—'} / ${r.regional ?? 0}` : null} />
                ))}
              />
            )}
            <CompareRow label="경쟁률 (접수)" cells={picked.map((r) => <Val key={r.region} v={r.ratioApplied != null ? `${r.ratioApplied} : 1` : null} />)} />
            <CompareRow label="경쟁률 (응시)" cells={picked.map((r) => <Val key={r.region} v={r.ratioActual != null ? `${r.ratioActual} : 1` : null} />)} />
            <CompareRow label="1차 합격 인원" cells={picked.map((r) => <Val key={r.region} v={r.firstPassed != null ? `${r.firstPassed}명` : null} />)} />
            <CompareRow label="1차 합격선" cells={picked.map((r) => <Val key={r.region} v={r.firstCutoff != null ? `${r.firstCutoff}점` : null} />)} />
            <CompareRow label="최종 합격 인원" cells={picked.map((r) => <Val key={r.region} v={r.finalPassed != null ? `${r.finalPassed}명` : null} />)} />
            <CompareRow label="최종 합격선" cells={picked.map((r) => <Val key={r.region} v={r.finalCutoff != null ? `${r.finalCutoff}점` : null} />)} />
            <CompareRow label="합격률 (응시)" cells={picked.map((r) => <Val key={r.region} v={r.passRateActual != null ? `${r.passRateActual}%` : null} />)} />

            <SourcesSummary rows={picked} />
          </View>

          <PrimaryButton label={busy ? '저장 중…' : '이미지로 저장'} onPress={save} disabled={busy} />
          <PrimaryButton label="공유하기" variant="ghost" onPress={() => share()} />
        </>
      )}
    </Screen>
  );
}

function CompareRow({ label, cells }: { label: string; cells: ReactNode[] }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingBottom: space.sm,
        borderBottomWidth: label ? 1 : 0,
        borderBottomColor: colors.line,
      }}
    >
      <Txt variant="sub" style={{ width: 78 }}>
        {label}
      </Txt>
      {cells.map((c, i) => (
        <View key={i} style={{ flex: 1 }}>
          {c}
        </View>
      ))}
    </View>
  );
}

function Val({ v }: { v: string | null }) {
  return (
    <Txt color={v ? 'text' : 'textSub'} style={{ fontWeight: '700' }}>
      {v ?? '—'}
    </Txt>
  );
}
