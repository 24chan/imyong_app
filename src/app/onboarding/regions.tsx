import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { RegionPicker } from '../../components/pickers';
import { PrimaryButton, Screen, Txt } from '../../components/ui';
import { REGIONS } from '../../data/regions';
import { SUBJECTS } from '../../data/subjects';
import { StepHeader } from '../../features/onboarding/StepHeader';
import { Level, useAppSettings } from '../../store/AppSettings';
import { space } from '../../theme/tokens';

// 온보딩 ③ 관심 지역 (여러 개 선택, 건너뛰기 가능)
export default function OnboardingRegions() {
  const params = useLocalSearchParams<{ level: Level; subject?: string }>();
  const { update } = useAppSettings();
  const [regions, setRegions] = useState<string[]>([]);
  const secondary = params.level === 'secondary';
  const subjectName = SUBJECTS.find((x) => x.code === params.subject)?.name ?? '';

  const finish = (codes: string[]) => {
    update({
      onboarded: true,
      level: params.level,
      subjectCode: params.level === 'secondary' ? (params.subject ?? null) : null,
      regionCodes: codes,
    });
    router.replace('/');
  };

  return (
    <Screen>
      <StepHeader
        step={secondary ? 3 : 2}
        total={secondary ? 3 : 2}
        title="관심 있는 지역은요?"
        desc="여러 곳을 골라도 돼요. 홈에서 이 지역의 선발 인원을 먼저 보여드려요. 다른 사람에게는 공개되지 않아요."
      />
      <RegionPicker value={regions} onChange={setRegions} />
      <Txt variant="sub">
        {secondary ? `중등 · ${subjectName}` : '초등'}
        {regions.length ? ` · ${regions.map((c) => REGIONS.find((r) => r.code === c)?.shortName ?? c).join(', ')}` : ' · 아직 고른 지역 없음'}
      </Txt>
      <View style={{ marginTop: space.lg, gap: space.sm }}>
        <PrimaryButton label={regions.length ? `${regions.length}곳으로 시작하기` : '시작하기'} onPress={() => finish(regions)} disabled={regions.length === 0} />
        <PrimaryButton label="나중에 고를게요" variant="ghost" onPress={() => finish([])} />
      </View>
    </Screen>
  );
}
