import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { RegionPicker } from '../../components/pickers';
import { PrimaryButton, Screen, Txt } from '../../components/ui';
import { Level, useAppSettings } from '../../store/AppSettings';
import { space } from '../../theme/tokens';

// 온보딩 ③ 관심 지역 (여러 개 선택, 건너뛰기 가능)
export default function OnboardingRegions() {
  const params = useLocalSearchParams<{ level: Level; subject?: string }>();
  const { update } = useAppSettings();
  const [regions, setRegions] = useState<string[]>([]);

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
      <View style={{ gap: space.xs, marginBottom: space.sm }}>
        <Txt variant="title">관심 있는 지역은요?</Txt>
        <Txt variant="sub">홈에서 이 지역의 선발 인원을 먼저 보여드려요. 다른 사람에게는 공개되지 않아요.</Txt>
      </View>
      <RegionPicker value={regions} onChange={setRegions} />
      <View style={{ marginTop: space.lg, gap: space.sm }}>
        <PrimaryButton label="시작하기" onPress={() => finish(regions)} disabled={regions.length === 0} />
        <PrimaryButton label="나중에 고를게요" variant="ghost" onPress={() => finish([])} />
      </View>
    </Screen>
  );
}
