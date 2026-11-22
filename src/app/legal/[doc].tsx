import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Card, PrimaryButton, Screen, Txt } from '../../components/ui';
import { fill, LEGAL } from '../../legal/info';
import { privacySections } from '../../legal/privacy';
import { termsSections } from '../../legal/terms';
import { CREDITS } from '../../legal/credits';
import { openLink } from '../../lib/openLink';
import { space } from '../../theme/tokens';

// 이용약관 / 개인정보처리방침 보기
export default function LegalDocScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const isPrivacy = doc === 'privacy';
  if (doc === 'credits')
    return (
      <Screen>
        <Stack.Screen options={{ title: '자료 출처 · 오픈소스' }} />
        {CREDITS.map((c) => (
          <Card key={c.name}>
            <Txt variant="heading">{c.name}</Txt>
            <Txt variant="sub">{c.use}</Txt>
            <Txt variant="sub">{c.license}</Txt>
            <Txt variant="sub" color="brand" onPress={() => openLink(c.url, c.name)}>
              {c.url}
            </Txt>
          </Card>
        ))}
      </Screen>
    );
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
