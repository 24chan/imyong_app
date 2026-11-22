import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { RegionPicker, SubjectPicker } from '../components/pickers';
import { AccountCard } from '../features/account/AccountCard';
import { AlertSettingsCard } from '../features/alerts/AlertSettings';
import { CommunitySettings } from '../features/account/CommunitySettings';
import { Card, PrimaryButton, Screen, Segmented, Txt } from '../components/ui';
import { Level, ThemePref, useAppSettings } from '../store/AppSettings';
import { checkServer, clearDataCache } from '../data/repository';
import { fill, LEGAL } from '../legal/info';
import { useAsync } from '../data/useAsync';
import { space } from '../theme/tokens';


export default function SettingsScreen() {
  const { settings, update, reset, bumpDataVersion } = useAppSettings();
  const server = useAsync(checkServer, []);
  // 중등으로 바꿀 때 과목이 없으면 과목을 고른 뒤에 저장
  const [pendingLevel, setPendingLevel] = useState<Level | null>(null);
  const shownLevel = pendingLevel ?? settings.level ?? 'elementary';

  const changeLevel = (level: Level) => {
    if (level === 'secondary' && !settings.subjectCode) {
      setPendingLevel('secondary');
      return;
    }
    setPendingLevel(null);
    update({ level });
  };

  const changeSubject = (code: string) => {
    setPendingLevel(null);
    update({ subjectCode: code, level: 'secondary' });
  };

  const confirmReset = () =>
    Alert.alert('처음 화면부터 다시 할까요?', '저장된 모드·과목·관심 지역이 지워져요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '다시 하기',
        style: 'destructive',
        onPress: () => {
          reset();
          router.replace('/onboarding');
        },
      },
    ]);

  return (
    <Screen>
      <AccountCard />
      <CommunitySettings />

      <Card>
        <Txt variant="heading">화면 테마</Txt>
        <Segmented<ThemePref>
          value={settings.themePref}
          onChange={(themePref) => update({ themePref })}
          options={[
            { value: 'system', label: '시스템' },
            { value: 'light', label: '라이트' },
            { value: 'dark', label: '다크' },
          ]}
        />
        <Txt variant="sub">'시스템'은 휴대폰의 다크 모드 설정을 따라가요.</Txt>
      </Card>

      <Card>
        <Txt variant="heading">시험 구분</Txt>
        <Segmented<Level>
          value={shownLevel}
          onChange={changeLevel}
          options={[
            { value: 'elementary', label: '초등' },
            { value: 'secondary', label: '중등' },
          ]}
        />
        {shownLevel === 'secondary' && (
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            <Txt variant="heading">과목</Txt>
            {pendingLevel === 'secondary' && (
              <Txt variant="sub" color="accent">
                중등은 과목을 골라야 바뀌어요.
              </Txt>
            )}
            <SubjectPicker value={settings.subjectCode} onChange={changeSubject} />
          </View>
        )}
      </Card>

      <Card>
        <Txt variant="heading">관심 지역</Txt>
        <Txt variant="sub">다른 사람에게는 공개되지 않아요.</Txt>
        <RegionPicker value={settings.regionCodes} onChange={(regionCodes) => update({ regionCodes })} />
      </Card>

      <AlertSettingsCard />

      <Card>
        <Txt variant="heading">데이터</Txt>
        <Txt variant="sub">
          서버(Supabase)에서 불러와요.{' '}
          {server.loading ? '연결 확인 중…' : server.data?.ok ? `연결됨 · ${server.data.message}` : `연결 안 됨 · ${server.data?.message ?? server.error?.message ?? ''}`}
        </Txt>
        <PrimaryButton
          label="데이터 새로고침"
          variant="ghost"
          onPress={() => {
            clearDataCache();
            bumpDataVersion();
          }}
        />
      </Card>

      <Card>
        <Txt variant="heading">약관 · 정책</Txt>
        <View style={{ gap: space.xs }}>
          <PrimaryButton label="이용약관" variant="ghost" onPress={() => router.push('/legal/terms')} />
          <PrimaryButton label="개인정보처리방침" variant="ghost" onPress={() => router.push('/legal/privacy')} />
          <PrimaryButton label="커뮤니티 이용 규칙" variant="ghost" onPress={() => router.push('/rules')} />
        </View>
        <Txt variant="sub">
          문의 · 개인정보 요청: {fill(LEGAL.contactEmail, '문의 메일')}
        </Txt>
      </Card>

      <PrimaryButton label="처음 화면부터 다시 하기" variant="ghost" onPress={confirmReset} />
    </Screen>
  );
}
