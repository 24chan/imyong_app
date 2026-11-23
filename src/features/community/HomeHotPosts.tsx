import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';
import { Txt } from '../../components/ui';
import { listPosts, Post } from '../../data/community';
import { useAppSettings } from '../../store/AppSettings';
import { space } from '../../theme/tokens';
import { NoticeBoard } from '../news/NoticeList';
import { PostRow } from './parts';

/** 홈 '인기글': HOT 글 4개, 없으면 내 모드 게시판의 최신 글 */
export function HomeHotPosts() {
  const { viewLevel } = useAppSettings();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [isHot, setIsHot] = useState(true);
  const fallback = viewLevel === 'elementary' ? 'elem' : 'sec';
  useFocusEffect(
    useCallback(() => {
      listPosts('hot', undefined, 4)
        .then(async (hot) => {
          if (hot.length) {
            setIsHot(true);
            setPosts(hot);
          } else {
            setIsHot(false);
            setPosts(await listPosts(fallback, undefined, 4));
          }
        })
        .catch(() => setPosts([]));
    }, [fallback]),
  );
  return (
    <NoticeBoard
      title={isHot ? '인기글' : '커뮤니티 새 글'}
      icon="flame"
      action={
        <Pressable onPress={() => router.navigate('/community')} hitSlop={8} accessibilityRole="button">
          <Txt variant="sub" style={{ fontWeight: '600' }}>
            커뮤니티 ›
          </Txt>
        </Pressable>
      }
    >
      {posts && posts.length === 0 ? (
        <Txt variant="sub" style={{ padding: space.lg }}>
          아직 글이 없어요. 인증하고 첫 글을 남겨 보세요.
        </Txt>
      ) : (
        (posts ?? []).map((p) => <PostRow key={p.id} post={p} showBoard flat />)
      )}
    </NoticeBoard>
  );
}
