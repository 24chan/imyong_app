import { useEffect } from 'react';
import { Alert, Linking, Pressable, Switch, View } from 'react-native';
import { Card, Txt } from '../../components/ui';
import { useAppSettings } from '../../store/AppSettings';
import { useSavedJobs } from '../../store/savedJobs';
import { space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { alertsAvailable, enableAlerts, rescheduleAlerts, setAlertPrefs, useAlertPrefs, useSavedSchedule } from './alerts';

/** 앱 맨 위에 한 번: 설정·저장 공고·관심 지역이 바뀌면 기기 알림을 다시 예약 */
export function useAlertSync() {
  const { settings, viewLevel } = useAppSettings();
  const prefs = useAlertPrefs();
  const jobs = useSavedJobs();
  const saved = useSavedSchedule();
  const level = settings.level ?? viewLevel;
  useEffect(() => {
    const t = setTimeout(() => {
      rescheduleAlerts({ level, regions: settings.regionCodes, jobs }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [prefs, jobs, saved, level, settings.regionCodes]);
}

export function AlertSettingsCard() {
  const { colors } = useTheme();
  const prefs = useAlertPrefs();
  const available = alertsAvailable();

  const toggleMain = async (on: boolean) => {
    if (!on) return setAlertPrefs({ enabled: false });
    const ok = await enableAlerts();
    if (!ok)
      Alert.alert('알림 권한이 꺼져 있어요', '휴대폰 설정 → 앱 → 임용몽땅 → 알림에서 허용해 주세요.', [
        { text: '닫기', style: 'cancel' },
        { text: '설정 열기', onPress: () => Linking.openSettings() },
      ]);
  };

  const Row = ({ label, sub, value, onChange, disabled }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, opacity: disabled ? 0.45 : 1 }}>
      <View style={{ flex: 1 }}>
        <Txt style={{ fontWeight: '700' }}>{label}</Txt>
        {sub && <Txt variant="sub">{sub}</Txt>}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.brand, false: colors.line }} />
    </View>
  );

  return (
    <Card>
      <Txt variant="heading">알림</Txt>
      {!available ? (
        <Txt variant="sub">이 설치 파일에는 알림 기능이 없어요. 새 버전을 설치하면 쓸 수 있어요.</Txt>
      ) : (
        <View style={{ gap: space.md }}>
          <Row label="알림 받기" sub="오전 9시에만 보내요. 알림 내용은 이 기기 안에서만 정해져요." value={prefs.enabled} onChange={toggleMain} />
          <Row label="저장한 채용 공고 마감" sub="마감 3일 전·1일 전" value={prefs.jobs} onChange={(v) => setAlertPrefs({ jobs: v })} disabled={!prefs.enabled} />
          <Row label="관심 지역 원서 접수" sub="접수 시작일, 마감 3일 전" value={prefs.receipt} onChange={(v) => setAlertPrefs({ receipt: v })} disabled={!prefs.enabled} />
          <Row label="일정 탭에서 고른 일정" sub="하루 전 (일정 옆 종 버튼)" value={prefs.schedule} onChange={(v) => setAlertPrefs({ schedule: v })} disabled={!prefs.enabled} />
          <Pressable onPress={() => Linking.openSettings()}>
            <Txt variant="sub" color="brand" style={{ textDecorationLine: 'underline' }}>
              휴대폰 알림 설정 열기
            </Txt>
          </Pressable>
        </View>
      )}
    </Card>
  );
}
