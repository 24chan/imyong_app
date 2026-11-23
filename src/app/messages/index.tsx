import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Txt } from '../../components/ui';
import { ago, Conversation, listConversations } from '../../data/community';
import { LabelBadge } from '../../features/community/parts';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// 쪽지함
export default function MessagesScreen() {
  const { colors } = useTheme();
  const [list, setList] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    listConversations()
      .then((l) => {
        setList(l);
        setError(null);
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  useFocusEffect(load);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: '쪽지함' }} />
      {list === null && !error ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: space.xl }} />
      ) : (
        <FlatList
          data={list ?? []}
          keyExtractor={(c) => c.id}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.brand} />}
          contentContainerStyle={{ maxWidth: 820, width: '100%', alignSelf: 'center' }}
          ListHeaderComponent={
            <View style={{ padding: space.lg, gap: 4 }}>
              <Txt variant="sub">쪽지는 글·댓글의 메뉴에서 '쪽지 보내기'로 시작해요. 상대에게는 라벨만 보여요.</Txt>
              {error && <Txt color="down">{error}</Txt>}
            </View>
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', padding: space.xl, gap: space.sm }}>
              <Ionicons name="mail-open-outline" size={36} color={colors.textSub} />
              <Txt variant="sub">아직 주고받은 쪽지가 없어요.</Txt>
            </View>
          }
          renderItem={({ item: c }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/messages/[id]', params: { id: c.id, other: c.otherLabel } })}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                padding: space.md,
                paddingHorizontal: space.lg,
                borderBottomWidth: 1,
                borderBottomColor: colors.line,
                backgroundColor: pressed ? colors.surface : 'transparent',
                opacity: c.blocked ? 0.5 : 1,
              })}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand + '1A', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person" size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Txt style={{ fontWeight: '800' }}>익명</Txt>
                  <LabelBadge label={c.otherLabel} small />
                  <View style={{ flex: 1 }} />
                  <Txt variant="sub" style={{ fontSize: 12 }}>
                    {ago(c.lastAt)}
                  </Txt>
                </View>
                <Txt variant="sub" numberOfLines={1}>
                  {c.blocked ? '차단한 상대예요' : c.lastBody ?? (c.originTitle ? `'${c.originTitle}' 글에서 시작` : '')}
                </Txt>
              </View>
              {c.unread > 0 && !c.blocked && (
                <View style={{ minWidth: 20, height: 20, borderRadius: radius.pill, backgroundColor: colors.down, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                  <Txt style={{ fontSize: 11, fontWeight: '800' }} color="background">
                    {c.unread}
                  </Txt>
                </View>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
