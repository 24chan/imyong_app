import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { PrimaryButton, Screen, SelectCard } from '../../components/ui';
import { StepHeader } from '../../features/onboarding/StepHeader';
import { Level } from '../../store/AppSettings';
import { space } from '../../theme/tokens';

// 온보딩 ① 초등 / 중등 선택
export default function OnboardingLevel() {
  const [level, setLevel] = useState<Level | null>(null);

  const next = () => {
    if (level === 'secondary') router.push({ pathname: '/onboarding/subject', params: { level } });
    else router.push({ pathname: '/onboarding/regions', params: { level: 'elementary' } });
  };

  return (
    <Screen>
      <StepHeader
        step={1}
        total={level === 'elementary' ? 2 : 3}
        title="어떤 임용을 준비하나요?"
        desc="홈과 모든 탭이 선택한 시험에 맞춰 보여요. 나중에 설정에서 바꿀 수 있어요."
      />
      <SelectCard
        title="초등 임용"
        desc="교대·초등교육과 · 지역 단위로 선발 인원·경쟁률 비교"
        selected={level === 'elementary'}
        onPress={() => setLevel('elementary')}
      />
      <SelectCard
        title="중등 임용"
        desc="사범대 · 과목을 고른 뒤 지역별 선발 인원·경쟁률 비교"
        selected={level === 'secondary'}
        onPress={() => setLevel('secondary')}
      />
      <View style={{ marginTop: space.lg }}>
        <PrimaryButton label="다음" onPress={next} disabled={!level} />
      </View>
    </Screen>
  );
}
