import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, View } from 'react-native';
import { TextInput } from '../../components/TextField';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip, PrimaryButton, Txt } from '../../components/ui';
import { ago, appealSanction, blockAuthor, Post, REPORT_REASONS, reportContent, ReportTarget, Sanction, SANCTION_LABEL } from '../../data/community';
import { getMyVerifications, Verification } from '../../data/verify';
import { regionByCode } from '../../data/regions';
import { subjectByCode } from '../../data/subjects';
import { useAuth } from '../../store/Auth';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/** 라벨 배지 (학교·교사 라벨) */
export function LabelBadge({ label, small }: { label: string; small?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: small ? 6 : 8, paddingVertical: small ? 1 : 2, borderRadius: radius.pill, backgroundColor: colors.brand + '1A' }}>
      <Txt variant="sub" color="brand" style={{ fontWeight: '700', fontSize: small ? 11 : 12 }}>
        {label}
      </Txt>
    </View>
  );
}

/** 에브리타임식 글 한 줄: 굵은 제목, 두 줄 미리보기, 아래 라벨·시간·공감·댓글 */
/** 말머리 이름 (중등 과목 / 지역) */
export const tagName = (p: Post) => (p.tagSubject ? subjectByCode(p.tagSubject)?.name ?? null : p.tagRegion ? regionByCode(p.tagRegion)?.shortName ?? null : null);

export function PostRow({ post, showBoard, flat }: { post: Post; showBoard?: boolean; flat?: boolean }) {
  const { colors } = useTheme();
  const hot = post.likeCount >= 10;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/community/[id]', params: { id: String(post.id) } })}
      accessibilityRole="button"
      style={({ pressed }) => ({
        // 시안 A: 글마다 흰 카드 (flat = 흰 카드 안 목록: 줄로 나눔)
        paddingVertical: flat ? space.md : 14,
        paddingHorizontal: space.lg,
        marginHorizontal: flat ? 0 : space.md,
        marginBottom: flat ? 0 : space.sm,
        borderRadius: flat ? 0 : radius.lg,
        borderTopWidth: flat ? 1 : 0,
        borderTopColor: colors.line,
        gap: 4,
        backgroundColor: pressed ? colors.surface : colors.background,
      })}
    >
      {showBoard && (
        <View style={{ alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.cat.blue.bg }}>
          <Txt style={{ fontSize: 11.5, fontWeight: '700', color: colors.cat.blue.fg }}>{post.boardName}</Txt>
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {hot && !showBoard && (
          <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, backgroundColor: colors.cat.coral.bg }}>
            <Txt style={{ fontSize: 11, fontWeight: '800', color: colors.cat.coral.fg }}>HOT</Txt>
          </View>
        )}
        <Txt style={{ fontWeight: '600', fontSize: 15.5, flex: 1 }} numberOfLines={1}>
          {post.status === 'hidden' ? '🔒 ' : ''}
          {tagName(post) ? <Txt style={{ fontWeight: '600', fontSize: 15.5, color: colors.cat.blue.fg }}>[{tagName(post)}] </Txt> : null}
          {post.title}
        </Txt>
      </View>
      {!!post.body && (
        <Txt variant="sub" color="text" numberOfLines={2} style={{ opacity: 0.8 }}>
          {post.body}
        </Txt>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 2 }}>
        {post.nickname && (
          <Txt variant="sub" style={{ fontSize: 12.5, fontWeight: '800', color: colors.text }} numberOfLines={1}>
            {post.nickname}
          </Txt>
        )}
        <LabelBadge label={post.label} small />
        <Txt variant="sub" style={Date.now() - new Date(post.createdAt).getTime() < 3600e3 ? { fontSize: 12, color: colors.hot, fontWeight: '800' } : { fontSize: 12 }}>
          {ago(post.createdAt)}
        </Txt>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name={post.liked ? 'heart' : 'heart-outline'} size={14} color={hot ? colors.hot : colors.textSub} />
          <Txt variant="sub" style={{ fontSize: 12, color: hot ? colors.hot : colors.textSub, fontWeight: hot ? '800' : '400' }}>
            {post.likeCount}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name="chatbubble-outline" size={14} color={colors.brand} />
          <Txt variant="sub" color="brand" style={{ fontSize: 12 }}>
            {post.commentCount}
          </Txt>
        </View>
      </View>
    </Pressable>
  );
}

/** 바텀시트 틀 — 2026-11-24: 뒤 화면 전체를 어둡게, 시트는 테두리·손잡이·닫기 버튼으로 경계가 또렷하게 */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000000A6', justifyContent: 'flex-end' }}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} accessibilityLabel="닫기" />
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.line,
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
            paddingBottom: space.lg + insets.bottom,
            gap: space.md,
            maxWidth: 640,
            width: '100%',
            alignSelf: 'center',
            elevation: 24,
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: -4 },
          }}
        >
          <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Txt variant="heading" style={{ flex: 1 }}>
              {title}
            </Txt>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityLabel="닫기"
              style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** 신고 시트: 사유 고르고(필요하면 설명) 보내기 + 이 사람 차단 */
export function ReportSheet({
  target,
  onClose,
  onBlocked,
}: {
  target: { type: ReportTarget; id: number } | null;
  onClose: () => void;
  onBlocked?: () => void;
}) {
  const { colors } = useTheme();
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setReason(null);
    setDetail('');
  }, [target]);
  if (!target) return null;
  const send = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await reportContent(target.type, target.id, reason, detail.trim() || undefined);
      Alert.alert('신고했어요', '운영자가 확인해요. 같은 내용 신고가 쌓이면 자동으로 가려져요.');
      onClose();
    } catch (e) {
      Alert.alert('신고하지 못했어요', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const block = () =>
    Alert.alert('이 사람을 차단할까요?', '차단하면 이 사람의 글·댓글이 안 보이고 쪽지도 주고받을 수 없어요. 설정에서 모두 풀 수 있어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '차단',
        style: 'destructive',
        onPress: () =>
          blockAuthor(target.type, target.id)
            .then(() => {
              onClose();
              onBlocked?.();
            })
            .catch((e) => Alert.alert('차단하지 못했어요', (e as Error).message)),
      },
    ]);
  return (
    <Sheet visible onClose={onClose} title="신고하기">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {REPORT_REASONS.map((r) => (
          <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
        ))}
      </View>
      <TextInput
        value={detail}
        onChangeText={setDetail}
        placeholder="자세한 설명 (선택)"
        placeholderTextColor={colors.textSub}
        multiline
        style={{ minHeight: 60, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, color: colors.text }}
      />
      <PrimaryButton label={busy ? '보내는 중…' : '신고 보내기'} onPress={send} disabled={!reason || busy} />
      <PrimaryButton label="이 사람 차단하기" variant="ghost" onPress={block} />
    </Sheet>
  );
}

/** 글쓸 라벨 고르기 (인증이 여러 개일 때). 인증이 없으면 인증 안내 */
export function useWriterLabels() {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const [list, setList] = useState<Verification[] | null>(null);
  useEffect(() => {
    if (!uid) {
      setList([]);
      return;
    }
    getMyVerifications(uid)
      .then((v) => setList(v.filter((x) => x.status === 'approved')))
      .catch(() => setList([]));
  }, [uid]);
  return { uid, labels: list };
}

export function LabelChooser({ labels, value, onChange }: { labels: Verification[]; value: string | null; onChange: (id: string) => void }) {
  if (labels.length <= 1) return null;
  return (
    <View style={{ gap: space.xs }}>
      <Txt variant="sub">어떤 라벨로 쓸까요?</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {labels.map((v) => (
          <Chip key={v.id} label={v.label ?? ''} selected={(value ?? labels[0].id) === v.id} onPress={() => onChange(v.id)} />
        ))}
      </View>
    </View>
  );
}

/** 로그인·인증이 안 됐을 때 쓰기 버튼 대신 보여 줄 안내 */
export function needWriterAlert(uid: string | null, labels: Verification[] | null): boolean {
  if (!uid) {
    Alert.alert('로그인이 필요해요', '글·댓글·쪽지는 로그인하고 인증한 뒤에 쓸 수 있어요.', [
      { text: '취소', style: 'cancel' },
      { text: '로그인', onPress: () => router.push('/login') },
    ]);
    return true;
  }
  if (labels && labels.length === 0) {
    Alert.alert('인증이 필요해요', '학교 또는 교사 인증을 하면 글·댓글·쪽지를 쓸 수 있어요.', [
      { text: '취소', style: 'cancel' },
      { text: '인증하기', onPress: () => router.push('/verify') },
    ]);
    return true;
  }
  return false;
}

/** 이용 제한 안내 + 이의 신청 */
export function SanctionBanner({ s, onChanged }: { s: Sanction; onChanged: () => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const until = s.endsAt ? new Date(s.endsAt).toLocaleString('ko-KR') : '무기한';
  return (
    <View style={{ borderWidth: 1, borderColor: colors.down + '66', backgroundColor: colors.down + '12', borderRadius: radius.xl, padding: space.md, gap: space.xs }}>
      <Txt style={{ fontWeight: '800' }} color="down">
        {SANCTION_LABEL[s.level]}
        {s.level !== 'warning' ? ` · ${until}까지` : ''}
      </Txt>
      <Txt variant="sub" color="text">
        사유: {s.reason}
      </Txt>
      {s.appealStatus === 'open' && <Txt variant="sub">이의 신청을 확인하고 있어요.</Txt>}
      {s.appealStatus === 'rejected' && <Txt variant="sub">이의 신청이 받아들여지지 않았어요.</Txt>}
      {!s.appealStatus && s.level !== 'warning' && (
        <PrimaryButton label="이의 신청" variant="ghost" onPress={() => setOpen(true)} />
      )}
      <Sheet visible={open} onClose={() => setOpen(false)} title="이의 신청">
        <Txt variant="sub">왜 제한이 잘못됐다고 생각하는지 적어 주세요. 운영자가 확인해요. (한 번만 할 수 있어요)</Txt>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder="내용"
          placeholderTextColor={colors.textSub}
          style={{ minHeight: 100, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, color: colors.text }}
        />
        <PrimaryButton
          label="보내기"
          disabled={text.trim().length < 5}
          onPress={() =>
            appealSanction(s.id, text)
              .then(() => {
                setOpen(false);
                onChanged();
              })
              .catch((e) => Alert.alert('보내지 못했어요', (e as Error).message))
          }
        />
      </Sheet>
    </View>
  );
}
