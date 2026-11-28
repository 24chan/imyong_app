import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { Card, ListRow, Txt } from '../../components/ui';
import { clearBlocks, getDmOff, setDmOff } from '../../data/community';
import { useAuth } from '../../store/Auth';
import { useTheme } from '../../theme/useTheme';

/** 설정 → 커뮤니티: 쪽지 받기, 차단 모두 풀기, 스크랩·규칙 */
export function CommunitySettings() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const [dmOn, setDmOn] = useState(true);
  useEffect(() => {
    if (uid) getDmOff(uid).then((off) => setDmOn(!off));
  }, [uid]);
  if (!uid) return null;
  return (
    <Card>
      <Txt variant="heading">커뮤니티</Txt>
      <View>
        <ListRow
          first
          icon="mail-outline"
          cat="blue"
          label="쪽지 받기"
          sub="끄면 새 쪽지 대화를 받지 않아요"
          right={
            <Switch
              value={dmOn}
              onValueChange={(v) => {
                setDmOn(v);
                setDmOff(!v).catch((e) => {
                  setDmOn(!v);
                  Alert.alert('바꾸지 못했어요', (e as Error).message);
                });
              }}
              trackColor={{ true: colors.brand, false: colors.line }}
            />
          }
        />
        <ListRow icon="bookmark-outline" cat="amber" label="내 스크랩" onPress={() => router.push('/scraps')} />
        <ListRow icon="document-text-outline" cat="teal" label="이용 규칙" onPress={() => router.push('/rules')} />
        <ListRow
          icon="hand-left-outline"
          cat="gray"
          label="차단 모두 풀기"
          onPress={() =>
            Alert.alert('차단한 사람을 모두 풀까요?', '', [
              { text: '취소', style: 'cancel' },
              { text: '모두 풀기', onPress: () => clearBlocks().then((n) => Alert.alert(`${n}명 차단을 풀었어요`)).catch((e) => Alert.alert('풀지 못했어요', (e as Error).message)) },
            ])
          }
        />
      </View>
    </Card>
  );
}
