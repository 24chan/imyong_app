import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ViewModeBanner } from '../components/ModeToggle';
import { Card, PrimaryButton, Screen, Segmented, Txt } from '../components/ui';
import { MyScraps } from '../features/practice/MyScraps';
import { PracticeTab } from '../features/practice/PracticeTab';
import { NationalSchoolMap } from '../features/region/NationalSchoolMap';
import { useAppSettings } from '../store/AppSettings';
import { useScraps } from '../store/schoolScraps';

// 전국 학교 지도 (홈 바로가기 '학교 지도'): 초등 = 초등학교, 중등 = 중·고등학교
// 2026-11-22: 탭 — 전체 학교 / 실습초(교대 실습학교) / 스크랩
type Tab = 'all' | 'practice' | 'scraps';
export default function NationalSchoolMapScreen() {
  const { viewLevel } = useAppSettings();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab ?? 'all');
  const scraps = useScraps();
  const elem = viewLevel === 'elementary';
  return (
    <Screen>
      <Stack.Screen options={{ title: elem ? '전국 초등학교 지도' : '전국 중·고등학교 지도' }} />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: '전체 학교' },
          { value: 'practice', label: '실습초' },
          { value: 'scraps', label: `스크랩${scraps.length ? ` ${scraps.length}` : ''}` },
        ]}
      />
      {tab === 'all' && (
        <>
          <ViewModeBanner />
          <Txt variant="sub">
            두 손가락으로 확대하고, 학교를 누르면 이름과 위치가 보여요. ☆를 누르면 '스크랩'에 모여요.
          </Txt>
          <Card>
            <NationalSchoolMap level={viewLevel} maxHeight={520} showChips />
          </Card>
          <PrimaryButton label="학교 이름으로 찾기" variant="ghost" onPress={() => router.push({ pathname: '/search', params: { cat: 'school' } })} />
          <Txt variant="sub">출처: 공공데이터포털 전국초중등학교위치표준데이터 (매달 갱신)</Txt>
        </>
      )}
      {tab === 'practice' && <PracticeTab />}
      {tab === 'scraps' && <MyScraps />}
    </Screen>
  );
}
