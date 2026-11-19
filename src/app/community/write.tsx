import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { TextInput } from '../../components/TextField';
import { Chip, PrimaryButton, Txt } from '../../components/ui';
import { Board, createPost, getBoards, getPost, updatePost } from '../../data/community';
import { LabelChooser, useWriterLabels } from '../../features/community/parts';
import { useAppSettings } from '../../store/AppSettings';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const RULES = ['교재·강의 PDF 등 자료 공유 금지', '실명·지역 등 개인정보 노출 금지', '학원·인강 광고 금지', '정치·혐오·비하 금지'];

// 글쓰기·수정
export default function WriteScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ board?: string; edit?: string }>();
  const editId = params.edit ? Number(params.edit) : null;
  const { settings } = useAppSettings();
  const { labels } = useWriterLabels();
  const [boards, setBoards] = useState<Board[]>([]);
  const [board, setBoard] = useState(params.board ?? 'free');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [label, setLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickBoard, setPickBoard] = useState(false);

  useEffect(() => {
    getBoards().then(setBoards).catch(() => {});
    if (editId)
      getPost(editId).then((p) => {
        if (!p) return;
        setTitle(p.title);
        setBody(p.body);
        setBoard(p.boardId);
      });
  }, [editId]);

  const boardName = boards.find((b) => b.id === board)?.name ?? board;
  // 고르기 쉬운 순서: 자유·합격 수기·초등/중등·내 과목·관심 지역 → 나머지
  const ordered = useMemo(() => {
    const top = ['free', 'review', 'elem', 'sec', settings.subjectCode ? `sub_${settings.subjectCode}` : '', ...settings.regionCodes.map((r) => `reg_${r}`)];
    return [...boards].sort((a, b) => {
      const ia = top.indexOf(a.id);
      const ib = top.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [boards, settings.subjectCode, settings.regionCodes]);

  const submit = async () => {
    setBusy(true);
    try {
      if (editId) {
        await updatePost(editId, title, body);
        router.back();
      } else {
        const id = await createPost(board, title, body, label);
        router.replace({ pathname: '/community/[id]', params: { id: String(id) } });
      }
    } catch (e) {
      Alert.alert('저장하지 못했어요', (e as Error).message);
      setBusy(false);
    }
  };

  const input = { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, color: colors.text, backgroundColor: colors.background } as const;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: editId ? '글 수정' : '글쓰기' }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, maxWidth: 820, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {!editId && (
          <View style={{ gap: space.sm }}>
            <Pressable onPress={() => setPickBoard((v) => !v)} style={[input, { flexDirection: 'row', justifyContent: 'space-between' }]}>
              <Txt style={{ fontWeight: '700' }}>게시판: {boardName}</Txt>
              <Txt variant="sub">{pickBoard ? '닫기' : '바꾸기'}</Txt>
            </Pressable>
            {pickBoard && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {ordered.map((b) => (
                  <Chip
                    key={b.id}
                    label={b.name}
                    selected={b.id === board}
                    onPress={() => {
                      setBoard(b.id);
                      setPickBoard(false);
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        )}
        {labels === null ? <ActivityIndicator color={colors.brand} /> : <LabelChooser labels={labels} value={label} onChange={setLabel} />}
        <TextInput value={title} onChangeText={setTitle} placeholder="제목" placeholderTextColor={colors.textSub} maxLength={100} style={[input, { fontSize: 17, fontWeight: '700' }]} />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="내용을 입력하세요. 다른 사람에게는 라벨만 보여요."
          placeholderTextColor={colors.textSub}
          multiline
          textAlignVertical="top"
          maxLength={10000}
          style={[input, { minHeight: 240, fontSize: 16, lineHeight: 24 }]}
        />
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, gap: 4 }}>
          {RULES.map((r) => (
            <Txt key={r} variant="sub">
              · {r}
            </Txt>
          ))}
          <Pressable onPress={() => router.push('/rules')}>
            <Txt variant="sub" color="brand" style={{ textDecorationLine: 'underline' }}>
              이용 규칙 전체 보기
            </Txt>
          </Pressable>
        </View>
        <PrimaryButton label={busy ? '저장 중…' : editId ? '수정 완료' : '올리기'} onPress={submit} disabled={busy || !title.trim() || !body.trim()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
