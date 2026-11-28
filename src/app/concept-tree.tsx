import { Gate } from '../features/study/Gate';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Chip, Screen, Txt } from '../components/ui';
import { allIds, buildTree, getContentSystem, TreeNode } from '../data/contentSystem';
import { useAsync } from '../data/useAsync';
import { BlankBar, BlankScope, BlankText, useBlank } from '../features/study/Blank';
import { buildVocab } from '../features/study/keywords';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

// 과목별 개념 구조도 (2026-11-24 사용자 요청)
// 교과 → 영역 → 범주 → 하위 범주 → 학년군 → 내용 요소. 1차 데이터는 2022 개정 교육과정 '내용 체계' 표에서 자동 생성.
// '전체 접기' 뒤 하나씩 펼치며 떠올리기(인출 테스트), 빈칸 모드로 맨 끝 내용 요소 가리기
const KIND_COLOR = { subject: 'teal', area: 'blue', ideas: 'purple', cat: 'coral', sub: 'amber', grade: 'green', leaf: 'gray' } as const;

function ConceptTreeScreenInner() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ subject?: string }>();
  const data = useAsync(() => getContentSystem(), []);
  const subjects = data.data?.subjects ?? [];
  const [pick, setPick] = useState<string | null>(params.subject ?? null);
  const subj = subjects.find((s) => s.subject === pick) ?? subjects[0];
  const tree = useMemo(() => (subj ? buildTree(subj) : null), [subj]);
  const vocab = useMemo(() => (subj ? buildVocab(subj) : null), [subj]);
  const ids = useMemo(() => (tree ? allIds(tree) : []), [tree]);
  // 처음엔 교과와 영역까지만 펼침
  const [open, setOpen] = useState<Set<string> | null>(null);
  const opened = open ?? new Set(tree ? [tree.id] : []);
  const blank = useBlank();

  const toggle = (id: string) => {
    const n = new Set(opened);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setOpen(n);
  };

  return (
    <>
      <Stack.Screen options={{ title: '개념 구조도' }} />
      <Screen>
        {data.loading && !data.data ? (
          <ActivityIndicator color={colors.brand} />
        ) : !subj || !tree ? (
          <Txt variant="sub">{data.error ? data.error.message : '구조도를 만드는 중이에요. 잠시 뒤에 다시 열어 주세요.'}</Txt>
        ) : (
          <>
            <Txt variant="sub" style={{ fontSize: 12.5 }}>
              2022 개정 교육과정 내용 체계로 자동으로 만든 구조도예요. 다 접고 하나씩 펼치면서 아래에 뭐가 있었는지 떠올려 보세요.
            </Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {subjects.map((s) => (
                <Chip
                  key={s.subject}
                  label={s.subject}
                  selected={s.subject === subj.subject}
                  onPress={() => {
                    setPick(s.subject);
                    setOpen(null);
                  }}
                />
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Chip label="전체 펼치기" selected={false} onPress={() => setOpen(new Set(ids))} />
              <Chip label="전체 접기" selected={false} onPress={() => setOpen(new Set())} />
            </View>
            <BlankBar blank={blank} scope={`tree/${subj.subject}`} />
            <BlankScope blank={blank} scope={`tree/${subj.subject}`} vocab={vocab}>
              <View style={{ backgroundColor: colors.background, borderRadius: radius.xl, padding: space.md }}>
                <Node n={tree} depth={0} opened={opened} toggle={toggle} />
              </View>
            </BlankScope>
            <Pressable onPress={() => router.push({ pathname: '/content-system', params: { subject: subj.subject } })} hitSlop={8}>
              <Txt style={{ fontWeight: '700', color: colors.brand }}>{subj.subject} 내용 체계표로 보기 ›</Txt>
            </Pressable>
          </>
        )}
      </Screen>
    </>
  );
}

function Node({ n, depth, opened, toggle, area = '' }: { n: TreeNode; depth: number; opened: Set<string>; toggle: (id: string) => void; area?: string }) {
  const { colors } = useTheme();
  const c = colors.cat[KIND_COLOR[n.kind]];
  if (n.kind === 'leaf') {
    return (
      <View style={{ flexDirection: 'row', gap: 6, paddingLeft: depth * 14, paddingVertical: 3 }}>
        <Txt style={{ color: colors.textSub }}>·</Txt>
        <View style={{ flex: 1 }}>
          <BlankText text={n.label} group={area} />
        </View>
      </View>
    );
  }
  const isOpen = opened.has(n.id);
  const count = n.children.length;
  return (
    <View>
      <Pressable
        onPress={() => toggle(n.id)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: depth * 14, paddingVertical: 5 }}
      >
        <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.textSub} />
        <View style={{ flexShrink: 1, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: c.bg }}>
          <Txt style={{ fontSize: n.kind === 'subject' ? 16 : n.kind === 'area' ? 15 : 13.5, fontWeight: n.kind === 'subject' || n.kind === 'area' ? '700' : '600', color: c.fg }}>{n.label}</Txt>
        </View>
        {!isOpen && (
          <Txt variant="sub" style={{ fontSize: 12 }}>
            {count}
          </Txt>
        )}
      </Pressable>
      {isOpen && (
        <View style={{ borderLeftWidth: 1, borderLeftColor: colors.line, marginLeft: depth * 14 + 7 }}>
          {n.children.map((k) => (
            <Node key={k.id} n={k} depth={1} opened={opened} toggle={toggle} area={n.kind === 'area' ? n.label : area} />
          ))}
        </View>
      )}
    </View>
  );
}


// 2026-11-28: 경인교대 인증 회원·운영자만 (lib/access.ts)
export default function ConceptTreeScreen() {
  return (
    <Gate feature="concept-tree">
      <ConceptTreeScreenInner />
    </Gate>
  );
}
