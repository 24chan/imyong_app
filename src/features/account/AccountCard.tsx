import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { Card, PrimaryButton, Txt } from '../../components/ui';
import { useAsync } from '../../data/useAsync';
import { getMyVerifications } from '../../data/verify';
import { authErrorText, useAuth } from '../../store/Auth';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/** 설정·커뮤니티에 보이는 계정 카드: 로그인 전 → 시작하기, 로그인 후 → 메일·로그아웃·계정 삭제 */
export function AccountCard({ compact }: { compact?: boolean }) {
  const { session, email, isAdmin, signOut, deleteAccount } = useAuth();
  const { colors } = useTheme();
  const uid = session?.user.id ?? null;
  const [tick, setTick] = useState(0);
  useFocusEffect(useCallback(() => setTick((n) => n + 1), [])); // 인증 화면에서 돌아오면 다시 불러오기
  const mine = useAsync(() => (uid ? getMyVerifications(uid) : Promise.resolve([])), [uid, tick]);
  const labels = (mine.data ?? []).filter((v) => v.status === 'approved').map((v) => v.label ?? '');
  const pending = (mine.data ?? []).some((v) => v.status === 'pending');

  if (!session) {
    return (
      <Card>
        <Txt variant="heading">로그인 · 가입</Txt>
        <Txt variant="sub">글쓰기·댓글은 로그인하고 학교 또는 교사 인증을 하면 할 수 있어요. 자료 보기는 로그인 없이도 돼요.</Txt>
        <PrimaryButton label="이메일로 시작하기" onPress={() => router.push('/login')} />
      </Card>
    );
  }

  const confirmDelete = () =>
    Alert.alert('계정을 삭제할까요?', '인증 정보와 계정이 바로 지워지고 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => deleteAccount().catch((e) => Alert.alert('삭제하지 못했어요', authErrorText(e))),
      },
    ]);

  return (
    <Card>
      <Txt variant="heading">내 계정</Txt>
      <Txt>{email}</Txt>
      {labels.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
          {labels.map((l) => (
            <View key={l} style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.brand + '22' }}>
              <Txt variant="sub" color="brand" style={{ fontWeight: '700' }}>
                {l}
              </Txt>
            </View>
          ))}
        </View>
      ) : (
        <Txt variant="sub">{pending ? '인증 확인 중이에요.' : '아직 인증 전이에요. 인증하면 글·댓글·쪽지를 쓸 수 있어요.'}</Txt>
      )}
      <Txt variant="sub">{isAdmin ? '운영자 · ' : ''}다른 사람에게는 이메일이 보이지 않고 라벨만 보여요.</Txt>
      <PrimaryButton label={labels.length ? '인증 관리' : '학교·교사 인증하기'} variant={labels.length ? 'ghost' : 'solid'} onPress={() => router.push('/verify')} />
      <PrimaryButton label="닉네임 (글·댓글에서 익명 대신 고를 때)" variant="ghost" onPress={() => router.push('/nickname')} />
      {isAdmin && <PrimaryButton label="운영자 메뉴 (인증 검수)" variant="ghost" onPress={() => router.push('/admin')} />}
      {!compact && (
        <View style={{ gap: space.xs }}>
          <PrimaryButton label="로그아웃" variant="ghost" onPress={() => signOut()} />
          <PrimaryButton label="계정 삭제" variant="ghost" onPress={confirmDelete} />
        </View>
      )}
    </Card>
  );
}
