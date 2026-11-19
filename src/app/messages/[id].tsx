import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Linking, Platform, Pressable, View } from 'react-native';
import { TextInput } from '../../components/TextField';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '../../components/ui';
import { blockAuthor, getMessages, leaveConversation, Message, messageImageUrls, sendMessage } from '../../data/community';
import { ReportSheet, Sheet } from '../../features/community/parts';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// 쪽지 대화: 글자·사진, 길게 눌러 신고, 메뉴에서 차단·나가기
export default function ThreadScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id, other } = useLocalSearchParams<{ id: string; other?: string }>();
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState<{ type: 'message'; id: number } | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(async () => {
    try {
      const m = await getMessages(id);
      setMsgs(m);
      setError(null);
      const paths = m.map((x) => x.imagePath).filter((p): p is string => !!p);
      if (paths.length) setUrls(await messageImageUrls(paths));
    } catch (e) {
      setError((e as Error).message);
      setMsgs([]);
    }
  }, [id]);
  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // 15초마다 새 쪽지 확인
    return () => clearInterval(t);
  }, [load]);

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('사진 접근 권한이 필요해요');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
    if (!res.canceled && res.assets[0]?.base64) setPhoto({ uri: res.assets[0].uri, base64: res.assets[0].base64 });
  };

  const send = async () => {
    if (!text.trim() && !photo) return;
    setSending(true);
    try {
      await sendMessage(id, text.trim(), photo?.base64);
      setText('');
      setPhoto(null);
      await load();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      Alert.alert('보내지 못했어요', (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          title: other ? `익명 · ${other}` : '쪽지',
          headerRight: () => (
            <Pressable onPress={() => setMenu(true)} hitSlop={10} accessibilityLabel="대화 메뉴">
              <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      {msgs === null ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: space.xl }} />
      ) : (
        <FlatList
          ref={listRef}
          data={msgs}
          keyExtractor={(m) => String(m.id)}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          contentContainerStyle={{ padding: space.md, gap: space.sm, maxWidth: 820, width: '100%', alignSelf: 'center' }}
          ListHeaderComponent={
            <View style={{ alignItems: 'center', paddingVertical: space.sm, gap: 4 }}>
              <Txt variant="sub" style={{ textAlign: 'center' }}>
                상대가 답장하기 전에는 3통까지 보낼 수 있어요. 불쾌한 쪽지는 길게 눌러 신고해 주세요.
              </Txt>
              {error && <Txt color="down">{error}</Txt>}
            </View>
          }
          renderItem={({ item: m }) => (
            <Pressable
              onLongPress={() => !m.isMine && setReport({ type: 'message', id: m.id })}
              delayLongPress={350}
              style={{ alignSelf: m.isMine ? 'flex-end' : 'flex-start', maxWidth: '78%', gap: 2, alignItems: m.isMine ? 'flex-end' : 'flex-start' }}
            >
              {m.imagePath && urls[m.imagePath] && (
                <Pressable onPress={() => Linking.openURL(urls[m.imagePath as string])}>
                  <Image source={{ uri: urls[m.imagePath] }} style={{ width: 200, height: 200, borderRadius: radius.md, backgroundColor: colors.line }} />
                </Pressable>
              )}
              {!!m.body && (
                <View
                  style={{
                    backgroundColor: m.isMine ? colors.brand : colors.surface,
                    borderRadius: radius.xl,
                    borderBottomRightRadius: m.isMine ? 4 : radius.lg,
                    borderBottomLeftRadius: m.isMine ? radius.lg : 4,
                    paddingHorizontal: space.md,
                    paddingVertical: 9,
                  }}
                >
                  <Txt color={m.isMine ? 'background' : 'text'} selectable>
                    {m.body}
                  </Txt>
                </View>
              )}
              <Txt variant="sub" style={{ fontSize: 11 }}>
                {new Date(m.createdAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}
                {m.isMine && m.readAt ? ' · 읽음' : ''}
              </Txt>
            </Pressable>
          )}
        />
      )}

      <View style={{ borderTopWidth: 1, borderTopColor: colors.line, padding: space.sm, paddingBottom: space.sm + insets.bottom, gap: 6 }}>
        {photo && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Image source={{ uri: photo.uri }} style={{ width: 56, height: 56, borderRadius: radius.sm }} />
            <Pressable onPress={() => setPhoto(null)} hitSlop={8}>
              <Ionicons name="close-circle" size={22} color={colors.textSub} />
            </Pressable>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
          <Pressable onPress={pick} accessibilityLabel="사진 보내기" style={{ padding: 9 }}>
            <Ionicons name="image-outline" size={24} color={colors.textSub} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="쪽지 입력"
            placeholderTextColor={colors.textSub}
            multiline
            style={{ flex: 1, maxHeight: 120, backgroundColor: colors.surface, borderRadius: radius.xl, paddingHorizontal: space.md, paddingVertical: 10, color: colors.text, fontSize: 15 }}
          />
          <Pressable
            onPress={send}
            disabled={sending || (!text.trim() && !photo)}
            accessibilityLabel="보내기"
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: text.trim() || photo ? colors.brand : colors.line, alignItems: 'center', justifyContent: 'center' }}
          >
            {sending ? <ActivityIndicator color={colors.background} /> : <Ionicons name="arrow-up" size={20} color={colors.background} />}
          </Pressable>
        </View>
      </View>

      <Sheet visible={menu} onClose={() => setMenu(false)} title="대화">
        <Pressable
          style={{ paddingVertical: space.md }}
          onPress={() => {
            setMenu(false);
            Alert.alert('상대를 차단할까요?', '차단하면 서로 쪽지를 보낼 수 없고, 상대의 글·댓글도 안 보여요.', [
              { text: '취소', style: 'cancel' },
              { text: '차단', style: 'destructive', onPress: () => blockAuthor('conversation', id).then(() => router.back()).catch((e) => Alert.alert('차단하지 못했어요', (e as Error).message)) },
            ]);
          }}
        >
          <Txt color="down" style={{ fontWeight: '700' }}>
            차단하기
          </Txt>
        </Pressable>
        <Pressable
          style={{ paddingVertical: space.md }}
          onPress={() => {
            setMenu(false);
            Alert.alert('대화를 나갈까요?', '양쪽 모두에게서 대화가 지워져요.', [
              { text: '취소', style: 'cancel' },
              { text: '나가기', style: 'destructive', onPress: () => leaveConversation(id).then(() => router.back()).catch((e) => Alert.alert('나가지 못했어요', (e as Error).message)) },
            ]);
          }}
        >
          <Txt style={{ fontWeight: '700' }}>대화 나가기</Txt>
        </Pressable>
        <Txt variant="sub">신고는 상대 쪽지를 길게 눌러서 할 수 있어요.</Txt>
      </Sheet>
      <ReportSheet target={report} onClose={() => setReport(null)} onBlocked={() => router.back()} />
    </KeyboardAvoidingView>
  );
}
