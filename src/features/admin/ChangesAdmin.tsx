import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Txt } from '../../components/ui';
import { useAsync } from '../../data/useAsync';
import { supabase } from '../../lib/supabase';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// 운영자 알림 (2026-11-28): admin-alert 워크플로가 하루 두 번 모은 변경·경고(raw/changes/latest.json)
const URL = 'https://raw.githubusercontent.com/24chan/imyong_app/raw-files/raw/changes/latest.json';
type Entry = { checked: string; changes: { kind: string; n: number; examples: string[] }[]; warnings: string[] };

async function load(): Promise<(Entry & { history: Entry[] }) | null> {
  const r = await fetch(`${URL}?t=${Date.now()}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`불러오지 못했어요 (${r.status})`);
  return r.json();
}

/** 운영자 기기 푸시 등록(알림 권한이 있을 때만, 묻지 않음 → 없으면 안내) */
export function useAdminPushRegister(isAdmin: boolean) {
  const [state, setState] = useState<'idle' | 'ok' | 'no-perm' | 'unsupported'>('idle');
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const n = require('expo-notifications') as typeof import('expo-notifications');
        let st = await n.getPermissionsAsync();
        if (!st.granted && st.canAskAgain) st = await n.requestPermissionsAsync();
        if (!st.granted) return setState('no-perm');
        const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
        const { data: token } = await n.getExpoPushTokenAsync({ projectId });
        const { error } = await supabase.rpc('register_admin_push', { p_token: token });
        setState(error ? 'unsupported' : 'ok');
      } catch {
        setState('unsupported'); // Expo Go(안드로이드)·옛 설치 파일
      }
    })();
  }, [isAdmin]);
  return state;
}

export function ChangesAdmin({ push }: { push: ReturnType<typeof useAdminPushRegister> }) {
  const { colors } = useTheme();
  const d = useAsync(load, []);
  const box = { backgroundColor: colors.background, borderRadius: radius.xl, padding: space.lg, gap: space.sm };
  return (
    <View style={{ gap: space.md }}>
      <Txt variant="sub" style={{ fontSize: 12.5 }}>
        하루 두 번(오전 9시대·저녁 7시대) 자동 수집으로 바뀐 것과 승인 대기, 수집이 멈춘 곳을 모아 이 폰으로 알려요.{' '}
        {push === 'ok' ? '이 폰은 알림 받기로 등록됐어요.' : push === 'no-perm' ? '알림 권한을 켜야 받을 수 있어요.' : push === 'unsupported' ? '새 버전 앱(APK)에서 알림을 받을 수 있어요(SQL 0031 실행 필요).' : ''}
      </Txt>
      {d.loading && !d.data && <ActivityIndicator color={colors.brand} />}
      {!d.loading && !d.data && <Txt variant="sub">아직 기록이 없어요. 첫 확인 뒤에 보여요.</Txt>}
      {(d.data?.history ?? []).map((e, i) => (
        <View key={i} style={box}>
          <Txt style={{ fontWeight: '700' }}>{e.checked}</Txt>
          {e.warnings.map((w, j) => (
            <Txt key={`w${j}`} style={{ color: colors.down, fontSize: 13.5 }}>
              ⚠️ {w}
            </Txt>
          ))}
          {e.changes.map((c, j) => (
            <View key={`c${j}`} style={{ gap: 2 }}>
              <Txt style={{ fontSize: 14, fontWeight: '600' }}>
                {c.kind} {c.n}
              </Txt>
              {c.examples.map((x, k) => (
                <Txt key={k} variant="sub" style={{ fontSize: 12.5 }}>
                  · {x}
                </Txt>
              ))}
            </View>
          ))}
          {!e.warnings.length && !e.changes.length && <Txt variant="sub">바뀐 것 없음</Txt>}
        </View>
      ))}
    </View>
  );
}
