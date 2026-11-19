import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { Txt } from '../components/ui';
import { listMyScraps, Post } from '../data/community';
import { PostRow } from '../features/community/parts';
import { space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

export default function ScrapsScreen() {
  const { colors } = useTheme();
  const [list, setList] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      listMyScraps().then(setList).catch((e) => setError((e as Error).message));
    }, []),
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: '내 스크랩' }} />
      {list === null && !error ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: space.xl }} />
      ) : (
        <FlatList
          data={list ?? []}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => <PostRow post={item} showBoard />}
          contentContainerStyle={{ maxWidth: 820, width: '100%', alignSelf: 'center' }}
          ListEmptyComponent={<Txt variant="sub" style={{ padding: space.lg }}>{error ?? '스크랩한 글이 없어요.'}</Txt>}
        />
      )}
    </View>
  );
}
