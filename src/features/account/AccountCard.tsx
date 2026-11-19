import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import { Card, PrimaryButton, Txt } from '../../components/ui';
import { authErrorText, useAuth } from '../../store/Auth';
import { space } from '../../theme/tokens';

/** 설정·커뮤니티에 보이는 계정 카드: 로그인 전 → 시작하기, 로그인 후 → 메일·로그아웃·계정 삭제 */
export function AccountCard({ compact }: { compact?: boolean }) {
  const { session, email, isAdmin, signOut, deleteAccount } = useAuth();

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
      <Txt variant="sub">
        {isAdmin ? '운영자 · ' : ''}학교·교사 인증은 다음 단계에서 열려요. 다른 사람에게는 이메일이 보이지 않아요.
      </Txt>
      {!compact && (
        <View style={{ gap: space.xs }}>
          <PrimaryButton label="로그아웃" variant="ghost" onPress={() => signOut()} />
          <PrimaryButton label="계정 삭제" variant="ghost" onPress={confirmDelete} />
        </View>
      )}
    </Card>
  );
}
