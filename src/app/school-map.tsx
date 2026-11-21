import { router, Stack } from 'expo-router';
import { ViewModeBanner } from '../components/ModeToggle';
import { Card, PrimaryButton, Screen, Txt } from '../components/ui';
import { NationalSchoolMap } from '../features/region/NationalSchoolMap';
import { useAppSettings } from '../store/AppSettings';

// 전국 학교 지도 (홈 바로가기 '학교 지도'): 초등 = 초등학교, 중등 = 중·고등학교
export default function NationalSchoolMapScreen() {
  const { viewLevel } = useAppSettings();
  const elem = viewLevel === 'elementary';
  return (
    <Screen>
      <Stack.Screen options={{ title: elem ? '전국 초등학교 지도' : '전국 중·고등학교 지도' }} />
      <ViewModeBanner />
      <Txt variant="sub">
        지도나 아래 지역을 누르면 그 지역 학교 지도가 열려요. 확대해서 학교 이름과 위치를 볼 수 있어요.
      </Txt>
      <Card>
        <NationalSchoolMap level={viewLevel} maxHeight={520} showChips />
      </Card>
      <PrimaryButton label="학교 이름으로 찾기" variant="ghost" onPress={() => router.push({ pathname: '/search', params: { cat: 'school' } })} />
      <Txt variant="sub">출처: 공공데이터포털 전국초중등학교위치표준데이터 (매달 갱신)</Txt>
    </Screen>
  );
}
