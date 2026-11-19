import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { TextInput } from '../../components/TextField';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '../../components/ui';
import {
  ago,
  anonName,
  Comment,
  createComment,
  deleteComment,
  deletePost,
  getPost,
  listComments,
  Post,
  startConversation,
  toggleCommentLike,
  togglePostLike,
  toggleScrap,
} from '../../data/community';
import { LabelBadge, LabelChooser, needWriterAlert, ReportSheet, Sheet, useWriterLabels } from '../../features/community/parts';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// 글 보기: 본문, 공감·스크랩, 댓글(익명 번호·글쓴이 표시), 신고·차단·쪽지
export default function PostScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);
  const { uid, labels } = useWriterLabels();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState<{ type: 'post' | 'comment'; id: number } | null>(null);
  const [menu, setMenu] = useState<{ kind: 'post' } | { kind: 'comment'; c: Comment } | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, cs] = await Promise.all([getPost(postId), listComments(postId)]);
      setPost(p);
      setComments(cs);
      setError(p ? null : '글을 찾을 수 없어요 (삭제됐거나 가려진 글)');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [postId]);
  useEffect(() => {
    load();
  }, [load]);

  const guard = () => needWriterAlert(uid, labels);

  const like = async () => {
    if (!post || guard()) return;
    try {
      const n = await togglePostLike(post.id);
      setPost({ ...post, likeCount: n, liked: !post.liked });
    } catch (e) {
      Alert.alert('공감하지 못했어요', (e as Error).message);
    }
  };
  const scrap = async () => {
    if (!post) return;
    if (!uid) return needWriterAlert(uid, labels);
    try {
      const on = await toggleScrap(post.id);
      setPost({ ...post, scrapped: on, scrapCount: post.scrapCount + (on ? 1 : -1) });
    } catch (e) {
      Alert.alert('스크랩하지 못했어요', (e as Error).message);
    }
  };
  const send = async () => {
    if (!text.trim() || guard()) return;
    setSending(true);
    try {
      await createComment(postId, text.trim(), replyTo?.parentId ?? replyTo?.id ?? null, label);
      setText('');
      setReplyTo(null);
      await load();
    } catch (e) {
      Alert.alert('댓글을 쓰지 못했어요', (e as Error).message);
    } finally {
      setSending(false);
    }
  };
  const dm = async (type: 'post' | 'comment', targetId: number) => {
    setMenu(null);
    if (guard()) return;
    try {
      const conv = await startConversation(type, targetId, label);
      router.push({ pathname: '/messages/[id]', params: { id: conv } });
    } catch (e) {
      Alert.alert('쪽지를 보낼 수 없어요', (e as Error).message);
    }
  };

  if (loading) return <ActivityIndicator color={colors.brand} style={{ marginTop: space.xl }} />;
  if (!post)
    return (
      <View style={{ padding: space.lg }}>
        <Stack.Screen options={{ title: '' }} />
        <Txt>{error}</Txt>
      </View>
    );

  // 댓글 → 원댓글 아래 답글 묶음
  const roots = comments.filter((c) => !c.parentId);
  const replies = (rid: number) => comments.filter((c) => c.parentId === rid);

  const CommentView = ({ c, reply }: { c: Comment; reply?: boolean }) => (
    <View style={{ flexDirection: 'row', gap: space.sm, paddingVertical: space.sm, paddingLeft: reply ? space.xl : 0, borderTopWidth: reply ? 0 : 1, borderTopColor: colors.line }}>
      {reply && <Ionicons name="return-down-forward" size={16} color={colors.textSub} style={{ marginTop: 2 }} />}
      <View style={{ flex: 1, gap: 3, backgroundColor: reply ? colors.surface : 'transparent', borderRadius: radius.md, padding: reply ? space.sm : 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Txt style={{ fontWeight: '800', fontSize: 14 }} color={c.anonNo === 0 ? 'brand' : 'text'}>
            {anonName(c.anonNo)}
          </Txt>
          <LabelBadge label={c.label} small />
          <View style={{ flex: 1 }} />
          {c.status === 'visible' && (
            <Pressable onPress={() => setMenu({ kind: 'comment', c })} hitSlop={10} accessibilityLabel="댓글 메뉴">
              <Ionicons name="ellipsis-horizontal" size={16} color={colors.textSub} />
            </Pressable>
          )}
        </View>
        <Txt color={c.status === 'visible' ? 'text' : 'textSub'}>{c.body}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Txt variant="sub" style={{ fontSize: 12 }}>
            {ago(c.createdAt)}
          </Txt>
          {c.status === 'visible' && (
            <>
              <Pressable
                hitSlop={8}
                onPress={async () => {
                  if (guard()) return;
                  try {
                    const n = await toggleCommentLike(c.id);
                    setComments((cs) => cs.map((x) => (x.id === c.id ? { ...x, likeCount: n, liked: !x.liked } : x)));
                  } catch (e) {
                    Alert.alert('공감하지 못했어요', (e as Error).message);
                  }
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
              >
                <Ionicons name={c.liked ? 'heart' : 'heart-outline'} size={13} color={c.liked ? colors.down : colors.textSub} />
                <Txt variant="sub" style={{ fontSize: 12 }}>
                  {c.likeCount || '공감'}
                </Txt>
              </Pressable>
              {!reply && (
                <Pressable hitSlop={8} onPress={() => setReplyTo(c)}>
                  <Txt variant="sub" style={{ fontSize: 12 }}>
                    답글
                  </Txt>
                </Pressable>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          title: post.boardName,
          headerRight: () => (
            <Pressable onPress={() => setMenu({ kind: 'post' })} hitSlop={10} accessibilityLabel="글 메뉴">
              <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, maxWidth: 820, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Txt style={{ fontWeight: '800' }}>{post.isMine ? '나' : '익명'}</Txt>
          <LabelBadge label={post.label} />
          <Txt variant="sub">{ago(post.createdAt)}</Txt>
        </View>
        {post.status === 'hidden' && (
          <Txt variant="sub" color="down">
            신고가 쌓여 다른 사람에게는 가려진 글이에요. 운영자가 확인하고 있어요.
          </Txt>
        )}
        <Txt variant="title" style={{ fontSize: 22 }}>
          {post.title}
        </Txt>
        <Txt style={{ fontSize: 16, lineHeight: 25 }} selectable>
          {post.body}
        </Txt>
        <View style={{ flexDirection: 'row', gap: space.lg, paddingTop: space.sm }}>
          <Stat icon={post.liked ? 'heart' : 'heart-outline'} color={colors.down} n={post.likeCount} />
          <Stat icon="chatbubble-outline" color={colors.brand} n={post.commentCount} />
          <Stat icon={post.scrapped ? 'bookmark' : 'bookmark-outline'} color={colors.accent} n={post.scrapCount} />
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <ActionBtn icon={post.liked ? 'heart' : 'heart-outline'} label="공감" onPress={like} active={post.liked} disabled={post.isMine} />
          <ActionBtn icon={post.scrapped ? 'bookmark' : 'bookmark-outline'} label="스크랩" onPress={scrap} active={post.scrapped} />
          {!post.isMine && <ActionBtn icon="mail-outline" label="쪽지" onPress={() => dm('post', post.id)} />}
        </View>

        <View style={{ marginTop: space.md }}>
          {roots.map((c) => (
            <View key={c.id}>
              <CommentView c={c} />
              {replies(c.id).map((r) => (
                <CommentView key={r.id} c={r} reply />
              ))}
            </View>
          ))}
          {comments.length === 0 && <Txt variant="sub">첫 댓글을 남겨 보세요.</Txt>}
        </View>
      </ScrollView>

      {/* 댓글 입력 */}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.line, padding: space.sm, paddingBottom: space.sm + insets.bottom, gap: 6, backgroundColor: colors.background }}>
        {replyTo && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm }}>
            <Txt variant="sub" style={{ flex: 1 }} numberOfLines={1}>
              {anonName(replyTo.anonNo)}에게 답글: {replyTo.body}
            </Txt>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.textSub} />
            </Pressable>
          </View>
        )}
        {labels && labels.length > 1 && (
          <View style={{ paddingHorizontal: space.sm }}>
            <LabelChooser labels={labels} value={label} onChange={setLabel} />
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={uid ? '댓글을 입력하세요 (익명)' : '로그인·인증 후 댓글을 쓸 수 있어요'}
            placeholderTextColor={colors.textSub}
            multiline
            onFocus={() => guard()}
            style={{ flex: 1, maxHeight: 120, backgroundColor: colors.surface, borderRadius: radius.xl, paddingHorizontal: space.md, paddingVertical: 10, color: colors.text, fontSize: 15 }}
          />
          <Pressable
            onPress={send}
            disabled={!text.trim() || sending}
            accessibilityLabel="댓글 보내기"
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: text.trim() ? colors.brand : colors.line, alignItems: 'center', justifyContent: 'center' }}
          >
            {sending ? <ActivityIndicator color={colors.background} /> : <Ionicons name="arrow-up" size={20} color={colors.background} />}
          </Pressable>
        </View>
      </View>

      {/* 메뉴 */}
      <Sheet visible={!!menu} onClose={() => setMenu(null)} title={menu?.kind === 'comment' ? '댓글' : '글'}>
        {menu?.kind === 'post' &&
          (post.isMine ? (
            <>
              <MenuItem icon="create-outline" label="수정" onPress={() => { setMenu(null); router.push({ pathname: '/community/write', params: { edit: String(post.id) } }); }} />
              <MenuItem
                icon="trash-outline"
                label="삭제"
                danger
                onPress={() =>
                  Alert.alert('글을 삭제할까요?', '', [
                    { text: '취소', style: 'cancel' },
                    { text: '삭제', style: 'destructive', onPress: () => deletePost(post.id).then(() => router.back()).catch((e) => Alert.alert('삭제하지 못했어요', (e as Error).message)) },
                  ])
                }
              />
            </>
          ) : (
            <>
              <MenuItem icon="mail-outline" label="쪽지 보내기" onPress={() => dm('post', post.id)} />
              <MenuItem icon="alert-circle-outline" label="신고 · 차단" danger onPress={() => { setMenu(null); if (!uid) return needWriterAlert(uid, labels); setReport({ type: 'post', id: post.id }); }} />
            </>
          ))}
        {menu?.kind === 'comment' &&
          (menu.c.isMine ? (
            <MenuItem
              icon="trash-outline"
              label="댓글 삭제"
              danger
              onPress={() => {
                const cid = menu.c.id;
                setMenu(null);
                deleteComment(cid).then(load).catch((e) => Alert.alert('삭제하지 못했어요', (e as Error).message));
              }}
            />
          ) : (
            <>
              <MenuItem icon="mail-outline" label="쪽지 보내기" onPress={() => dm('comment', menu.c.id)} />
              <MenuItem icon="alert-circle-outline" label="신고 · 차단" danger onPress={() => { const cid = menu.c.id; setMenu(null); if (!uid) return needWriterAlert(uid, labels); setReport({ type: 'comment', id: cid }); }} />
            </>
          ))}
      </Sheet>
      <ReportSheet target={report} onClose={() => setReport(null)} onBlocked={() => (report?.type === 'post' ? router.back() : load())} />
    </KeyboardAvoidingView>
  );
}

function Stat({ icon, color, n }: { icon: keyof typeof Ionicons.glyphMap; color: string; n: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={icon} size={16} color={color} />
      <Txt style={{ color, fontWeight: '700' }}>{n}</Txt>
    </View>
  );
}

function ActionBtn({ icon, label, onPress, active, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; active?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: active ? colors.text : colors.line,
        backgroundColor: colors.surface,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Ionicons name={icon} size={16} color={colors.text} />
      <Txt variant="sub" color="text" style={{ fontWeight: '700' }}>
        {label}
      </Txt>
    </Pressable>
  );
}

function MenuItem({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md }}>
      <Ionicons name={icon} size={20} color={danger ? colors.down : colors.text} />
      <Txt style={{ fontWeight: '600' }} color={danger ? 'down' : 'text'}>
        {label}
      </Txt>
    </Pressable>
  );
}
