import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SubjectPicker } from '../../components/pickers';
import { PrimaryButton, Screen, Txt } from '../../components/ui';
import { space } from '../../theme/tokens';

// 온보딩 ② 과목 선택 (중등만, 필수)
export default function OnboardingSubject() {
  const [subject, setSubject] = useState<string | null>(null);

  return (
    <Screen>
      <View style={{ gap: space.xs, marginBottom: space.sm }}>
        <Txt variant="title">어떤 과목인가요?</Txt>
        <Txt variant="sub">중등은 과목 선택이 필수예요. 선발 인원·게시판·강의가 이 과목 기준으로 보여요.</Txt>
      </View>
      <SubjectPicker value={subject} onChange={setSubject} />
      <View style={{ marginTop: space.lg }}>
        <PrimaryButton
          label="다음"
          disabled={!subject}
          onPress={() =>
            router.push({ pathname: '/onboarding/regions', params: { level: 'secondary', subject: subject! } })
          }
        />
      </View>
    </Screen>
  );
}
