import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Txt } from '../../components/ui';
import { getMyNickname } from '../../data/community';
import { useAuth } from '../../store/Auth';
import { radius } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// 글·댓글마다 '익명' 또는 '닉네임' 고르기 (2026-11-22 사용자 승인)
export function useMyNickname() {
  const { session } = useAuth();
  const [nickname, setNick] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      getMyNickname()
        .then((n) => setNick(n.nickname))
        .catch(() => setNick(null));
    }, [session]),
  );
  return nickname;
}

export function AuthorMode({
  value,
  onChange,
  nickname,
  locked,
  compact,
}: {
  value: boolean;
  onChange: (useNickname: boolean) => void;
  nickname: string | null;
  /** 한 글 안에서 이미 정해진 방식이면 바꿀 수 없음 */
  locked?: boolean;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const pick = (v: boolean) => {
    if (locked) {
      Alert.alert('이 글에서는 바꿀 수 없어요', '한 글 안에서는 처음 고른 방식(익명/닉네임)으로 댓글이 달려요. 익명 번호와 닉네임이 이어지지 않게 하려는 거예요.');
      return;
    }
    if (v && !nickname) {
      Alert.alert('닉네임이 아직 없어요', '설정에서 닉네임을 먼저 정해 주세요.', [
        { text: '취소', style: 'cancel' },
        { text: '닉네임 정하기', onPress: () => router.push('/nickname') },
      ]);
      return;
    }
    onChange(v);
  };
  const opt = (v: boolean, label: string) => {
    const on = value === v;
    return (
      <Pressable
        key={label}
        onPress={() => pick(v)}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        style={{
          paddingHorizontal: compact ? 10 : 14,
          paddingVertical: compact ? 5 : 8,
          borderRadius: radius.pill,
          backgroundColor: on ? colors.cat.green.bg : colors.background,
          borderWidth: 1,
          borderColor: on ? colors.cat.green.fg : colors.line,
          opacity: locked && !on ? 0.4 : 1,
        }}
      >
        <Txt style={{ fontSize: compact ? 12.5 : 14, fontWeight: '700', color: on ? colors.cat.green.fg : colors.textSub }} numberOfLines={1}>
          {label}
        </Txt>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {!compact && <Txt variant="sub">작성자 표시</Txt>}
      {opt(false, '익명')}
      {opt(true, nickname ? `닉네임 · ${nickname}` : '닉네임')}
    </View>
  );
}
