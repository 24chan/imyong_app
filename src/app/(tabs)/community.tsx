import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { ViewModeBanner } from '../../components/ModeToggle';
import { Txt } from '../../components/ui';
import { Board, getBoards, listPosts, mySanctions, Post, Sanction, unreadCount } from '../../data/community';
import { useAppSettings } from '../../store/AppSettings';
import { useAuth } from '../../store/Auth';
import { PostRow, SanctionBanner, needWriterAlert, useWriterLabels } from '../../features/community/parts';
import { StudyBoard } from '../../features/study/StudyBoard';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// 커뮤니티: 모드에 맞는 기본 게시판(초등 / 내 과목) + HOT·자유·합격 수기·지역 게시판
export default function CommunityScreen() {
  const { colors } = useTheme();
  const { settings, viewLevel } = useAppSettings();
  const { session } = useAuth();
  const { uid, labels } = useWriterLabels();
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardErr, setBoardErr] = useState<string | null>(null);
  const defaultBoard = viewLevel === 'elementary' ? 'elem' : settings.subjectCode ? `sub_${settings.subjectCode}` : 'sec';
  const [board, setBoard] = useState<string>(defaultBoard);
  const [showAll, setShowAll] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [sanction, setSanction] = useState<Sanction | null>(null);

  useEffect(() => setBoard(defaultBoard), [defaultBoard]);
  // 홈 메뉴 '스터디'에서 들어오면 스터디 모집 칸
  const params = useLocalSearchParams<{ board?: string }>();
  useEffect(() => {
    if (params.board) setBoard(params.board);
  }, [params.board]);
  const isStudy = board === 'study';
  useEffect(() => {
    getBoards()
      .then(setBoards)
      .catch((e) => setBoardErr((e as Error).message));
  }, []);

  const load = useCallback(
    async (reset: boolean) => {
      if (board === 'study') {
        setPosts([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const before = reset ? undefined : posts.at(-1)?.id;
        const rows = await listPosts(board, before);
        setPosts((p) => (reset ? rows : [...p, ...rows]));
        setMore(rows.length >= 20);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [board, posts],
  );

  // 게시판을 바꾸거나 화면에 돌아올 때 새로 불러오기
  useFocusEffect(
    useCallback(() => {
      load(true);
      if (session) {
        unreadCount().then(setUnread);
        mySanctions()
          .then((s) => setSanction(s.find((x) => x.active || (x.level === 'warning' && Date.now() - new Date(x.startsAt).getTime() < 7 * 864e5)) ?? null))
          .catch(() => setSanction(null));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [board, session]),
  );

  const byId = useMemo(() => Object.fromEntries(boards.map((b) => [b.id, b])), [boards]);
  const quick = useMemo(() => {
    const ids = ['hot', defaultBoard, 'study', 'free', 'review'];
    if (viewLevel === 'secondary' && defaultBoard !== 'sec') ids.push('sec');
    // 관심 지역은 첫 번째 하나만 (나머지는 '다른 게시판'에서)
    if (settings.regionCodes[0]) ids.push(`reg_${settings.regionCodes[0]}`);
    return [...new Set(ids)];
  }, [defaultBoard, viewLevel, settings.regionCodes]);
  const nameOf = (id: string) => (id === 'hot' ? 'HOT' : id === 'study' ? '스터디 모집' : byId[id]?.name ?? (id === 'elem' ? '초등' : id));

  const write = () => {
    if (needWriterAlert(uid, labels)) return;
    if (isStudy) return router.push('/study/new');
    router.push({ pathname: '/community/write', params: { board: board === 'hot' ? defaultBoard : board } });
  };

  const BoardChip = ({ id }: { id: string }) => {
    const on = board === id;
    return (
      <Pressable
        onPress={() => {
          setBoard(id);
          setShowAll(false);
        }}
        style={{
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: radius.pill,
          backgroundColor: on ? colors.brand : colors.surface,
          borderWidth: 1,
          borderColor: on ? colors.brand : colors.line,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {id === 'hot' && <Ionicons name="flame" size={14} color={on ? colors.background : colors.down} />}
        {id === 'study' && <Ionicons name="people" size={14} color={on ? colors.background : colors.cat.green.fg} />}
        <Txt style={{ fontWeight: '700', fontSize: 14 }} color={on ? 'background' : 'text'}>
          {nameOf(id)}
        </Txt>
      </Pressable>
    );
  };

  const header = (
    <View style={{ gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm }}>
      <ViewModeBanner />
      {sanction && <SanctionBanner s={sanction} onChanged={() => mySanctions().then((s) => setSanction(s[0] ?? null))} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Txt variant="title" style={{ flex: 1 }}>
          {nameOf(board)}
          {board === 'hot' ? ' 게시판' : ''}
        </Txt>
        <IconBtn icon="bookmark-outline" label="스크랩" onPress={() => (session ? router.push('/scraps') : needWriterAlert(null, null))} />
        <IconBtn icon="mail-outline" label="쪽지함" badge={unread} onPress={() => (session ? router.push('/messages') : needWriterAlert(null, null))} />
      </View>
      {board === 'hot' && <Txt variant="sub">공감 10개 이상 받은 글이 모여요.</Txt>}
      {isStudy && <Txt variant="sub">지역·과목·1차/2차·온오프라인으로 스터디원을 모아요.</Txt>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {quick.map((id) => (
          <BoardChip key={id} id={id} />
        ))}
        <Pressable
          onPress={() => setShowAll((v) => !v)}
          style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', gap: 4, alignItems: 'center' }}
        >
          <Txt style={{ fontWeight: '700', fontSize: 14 }}>다른 게시판</Txt>
          <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={14} color={colors.text} />
        </Pressable>
      </ScrollView>
      {showAll && (
        <View style={{ gap: space.sm }}>
          {/* 초등 모드에서는 과목 게시판을 숨김 */}
          {(viewLevel === 'elementary' ? (['level', 'region'] as const) : (['level', 'subject', 'region'] as const)).map((k) => (
            <View key={k} style={{ gap: 6 }}>
              <Txt variant="sub">{k === 'level' ? '구분' : k === 'subject' ? '과목' : '지역'}</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {boards
                  .filter((b) => b.kind === k && !quick.includes(b.id))
                  .map((b) => (
                    <BoardChip key={b.id} id={b.id} />
                  ))}
              </View>
            </View>
          ))}
        </View>
      )}
      {boardErr && <Txt color="down">{boardErr}</Txt>}
      {error && <Txt color="down">{error}</Txt>}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={posts}
        keyExtractor={(p) => String(p.id)}
        ListHeaderComponent={header}
        renderItem={({ item }) => <PostRow post={item} showBoard={board === 'hot'} />}
        onEndReached={() => more && !loading && posts.length > 0 && load(false)}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(true)} tintColor={colors.brand} />}
        ListEmptyComponent={
          isStudy ? (
            <View style={{ paddingHorizontal: space.lg }}>
              <StudyBoard />
            </View>
          ) : loading ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: space.xl }} />
          ) : (
            <View style={{ alignItems: 'center', padding: space.xl, gap: space.sm }}>
              <Ionicons name="chatbubbles-outline" size={36} color={colors.textSub} />
              <Txt variant="sub">{board === 'hot' ? '아직 HOT 글이 없어요.' : '첫 글을 남겨 보세요.'}</Txt>
            </View>
          )
        }
        ListFooterComponent={
          <Pressable onPress={() => router.push('/rules')} style={{ padding: space.lg, alignItems: 'center' }}>
            <Txt variant="sub" style={{ textDecorationLine: 'underline' }}>
              커뮤니티 이용 규칙
            </Txt>
          </Pressable>
        }
        contentContainerStyle={{ paddingBottom: 96, maxWidth: 820, width: '100%', alignSelf: 'center' }}
      />
      <Pressable
        onPress={write}
        accessibilityRole="button"
        accessibilityLabel="글쓰기"
        style={{
          position: 'absolute',
          right: space.lg,
          bottom: space.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 18,
          paddingVertical: 13,
          borderRadius: radius.pill,
          backgroundColor: colors.brand,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 4,
        }}
      >
        <Ionicons name={isStudy ? 'people' : 'create-outline'} size={18} color={colors.background} />
        <Txt style={{ fontWeight: '800' }} color="background">
          {isStudy ? '스터디 모집' : '글쓰기'}
        </Txt>
      </Pressable>
    </View>
  );
}

function IconBtn({ icon, label, onPress, badge }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; badge?: number }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={{ padding: 6 }}>
      <Ionicons name={icon} size={24} color={colors.text} />
      {!!badge && badge > 0 && (
        <View style={{ position: 'absolute', top: 0, right: 0, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.down, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <Txt style={{ fontSize: 11, fontWeight: '800' }} color="background">
            {badge > 99 ? '99+' : badge}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}
