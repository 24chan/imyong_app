import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Card, PrimaryButton, Screen, Txt } from '../../components/ui';
import { fill, LEGAL } from '../../legal/info';
import { privacySections } from '../../legal/privacy';
import { termsSections } from '../../legal/terms';
import { space } from '../../theme/tokens';

// 이용약관 / 개인정보처리방침 보기
export default function LegalDocScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const isPrivacy = doc === 'privacy';
  const sections = isPrivacy ? privacySections() : termsSections();
  const title = isPrivacy ? '개인정보처리방침' : '이용약관';

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Txt variant="sub">
        {LEGAL.appName} · 버전 {LEGAL.version} · 시행일 {fill(LEGAL.effectiveDate, '시행일')}
      </Txt>
      {sections.map((s) => (
        <Card key={s.title}>
          <Txt variant="heading">{s.title}</Txt>
          <View style={{ gap: space.xs }}>
            {s.body.map((t, i) => (
              <Txt key={i}>{t}</Txt>
            ))}
          </View>
        </Card>
      ))}
      {!isPrivacy && (
        <PrimaryButton label="커뮤니티 이용 규칙 보기" variant="ghost" onPress={() => router.push('/rules')} />
      )}
    </Screen>
  );
}
