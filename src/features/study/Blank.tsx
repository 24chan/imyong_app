import { createContext, memo, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Txt } from '../../components/ui';
import { useAccess } from '../../lib/access';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { isDelim, keyIdx, tokenize, Vocab } from './keywords';
import { cancelDraft, clearScope, commitDraft, itemKey, mark, resetDraft, scopeSummary, startDraft, toggleCustom, useBlankItem, useBlankState } from './blankStore';

// 빈칸 암기 (2026-11-24 처음, 2026-11-28 확장 — 경인교대 인증 회원 전용, lib/access.ts 'blank')
// 모드: 전체 가리기 / 핵심어만(스마트) / 내 빈칸(직접 고른 낱말, 편집·저장) / 틀린 것만(오답 회독)
// 칸을 열고 맞음·틀림을 누르면 기록 → 영역별 암기율. 기록·내 빈칸은 이 기기에만 저장
export type BlankMode = 'off' | 'all' | 'smart' | 'mine' | 'wrong';
type Ctx = { mode: BlankMode; editing: boolean; round: number; scope: string; vocab: Vocab | null };
const BlankCtx = createContext<Ctx>({ mode: 'off', editing: false, round: 0, scope: '', vocab: null });

/** vocab: 그 교과 개념어 사전(keywords.ts buildVocab) — '핵심어만'이 이 낱말만 가림. 없으면 일반 규칙 */
export function BlankScope({ blank, scope, vocab = null, children }: { blank: ReturnType<typeof useBlank>; scope: string; vocab?: Vocab | null; children: ReactNode }) {
  const value = useMemo(() => ({ mode: blank.mode, editing: blank.editing, round: blank.round, scope, vocab }), [blank.mode, blank.editing, blank.round, scope, vocab]);
  return <BlankCtx.Provider value={value}>{children}</BlankCtx.Provider>;
}

export function useBlank() {
  const [mode, setMode] = useState<BlankMode>('off');
  const [editing, setEditing] = useState(false);
  const [round, setRound] = useState(0);
  return { mode, setMode, editing, setEditing, round, reset: () => setRound((r) => r + 1) };
}

// 2026-11-28 사용자 요청: 처음엔 '빈칸 암기 모드' 단추 하나 → 누르면 켜지고 1 전체 가리기 · 2 핵심어 가리기 · 3 빈칸 만들기 · 4 오답
// '3 내 빈칸' → 내가 만든 빈칸으로 가림, 단추 다시 가리기·편집. '편집'을 눌러야 편집: 낱말 한 번 누르면 빈칸, 다시 누르면 없어짐, 단추는 초기화·저장만
const MODES: { k: Exclude<BlankMode, 'off'>; label: string; hint: string }[] = [
  { k: 'all', label: '1 전체 가리기', hint: '칸을 통째로 가려요. 누르면 보여요' },
  { k: 'smart', label: '2 핵심어 가리기', hint: '교과 핵심어만 가려요. 가린 곳을 누르면 보여요' },
  { k: 'mine', label: '3 내 빈칸', hint: '내가 만든 빈칸만 가려요. 빈칸을 고르거나 고치려면 「편집」을 누르세요' },
  { k: 'wrong', label: '4 오답', hint: '틀림을 눌렀던 칸만 다시 가려요' },
];

/** 빈칸 암기 모드 (경인교대 인증 회원에게만 보임) */
export function BlankBar({ blank, scope }: { blank: ReturnType<typeof useBlank>; scope: string }) {
  const { colors } = useTheme();
  const can = useAccess();
  const st = useBlankState();
  const [open, setOpen] = useState(false);
  const sum = useMemo(() => scopeSummary(st, scope), [st, scope]);
  const setEditingRef = useRef(blank.setEditing);
  setEditingRef.current = blank.setEditing;
  useEffect(
    () => () => {
      cancelDraft(); // 화면·탭을 나가면 저장 안 한 편집은 버림
      setEditingRef.current(false);
    },
    [],
  );
  if (!can('blank')) return null;

  if (blank.mode === 'off')
    return (
      <Pressable
        onPress={() => {
          blank.setMode('all');
          blank.reset();
        }}
        accessibilityRole="button"
        style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.accent, backgroundColor: colors.cat.amber.bg }}
      >
        <Txt style={{ fontSize: 14, fontWeight: '700', color: colors.cat.amber.fg }}>★ 빈칸 암기 모드</Txt>
      </Pressable>
    );

  const box = { gap: space.sm, padding: space.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.accent, backgroundColor: colors.cat.amber.bg };

  // 빈칸 만들기(편집): 초기화·저장만
  if (blank.editing)
    return (
      <View style={box}>
        <Txt style={{ fontWeight: '700', color: colors.cat.amber.fg }}>★ 내 빈칸 편집</Txt>
        <Txt variant="sub" style={{ fontSize: 12.5 }}>
          가릴 낱말을 한 번 누르면 빈칸, 다시 누르면 없어져요.
        </Txt>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SmallBtn
            label="초기화"
            onPress={() => Alert.alert('초기화', '이 자료에서 만든 빈칸을 모두 없앨까요? (저장을 눌러야 반영돼요)', [{ text: '취소' }, { text: '초기화', style: 'destructive', onPress: resetDraft }])}
          />
          <SmallBtn
            label="저장"
            strong
            onPress={() => {
              commitDraft();
              blank.setEditing(false);
              blank.reset();
            }}
          />
        </View>
      </View>
    );

  const hint = MODES.find((m) => m.k === blank.mode)?.hint;
  return (
    <View style={box}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Txt style={{ flex: 1, fontWeight: '700', color: colors.cat.amber.fg }}>★ 빈칸 암기 모드</Txt>
        <Pressable
          onPress={() => {
            blank.setMode('off');
            blank.setEditing(false);
          }}
          accessibilityRole="button"
          accessibilityLabel="빈칸 암기 모드 끄기"
          hitSlop={10}
        >
          <Txt style={{ fontSize: 13, fontWeight: '700', color: colors.textSub }}>끄기 ✕</Txt>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {MODES.map((m) => {
          const sel = blank.mode === m.k;
          return (
            <Pressable
              key={m.k}
              onPress={() => {
                blank.setMode(m.k);
                blank.setEditing(false);
                blank.reset();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: sel ? colors.cat.amber.fg : colors.line, backgroundColor: sel ? colors.cat.amber.fg : colors.background }}
            >
              <Txt style={{ fontSize: 13, fontWeight: '700', color: sel ? colors.background : colors.text }}>{m.label}</Txt>
            </Pressable>
          );
        })}
      </ScrollView>
      {!!hint && (
        <Txt variant="sub" style={{ fontSize: 12.5 }}>
          {hint}
        </Txt>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <SmallBtn label="다시 가리기" onPress={blank.reset} />
        {blank.mode === 'mine' && (
          <SmallBtn
            label="편집"
            strong
            onPress={() => {
              startDraft(scope);
              blank.setEditing(true);
            }}
          />
        )}
        <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" hitSlop={6} style={{ flex: 1 }}>
          <Txt style={{ fontSize: 12.5, fontWeight: '600', color: colors.cat.amber.fg }}>
            암기율 {sum.done ? `${Math.round((sum.ok / sum.done) * 100)}% (${sum.ok}/${sum.done}칸) ${open ? '▲' : '영역별 ▼'}` : '— 가린 곳을 열고 맞음·틀림을 눌러요'}
          </Txt>
        </Pressable>
      </View>
      {open && sum.done > 0 && (
        <View style={{ gap: 6 }}>
          {sum.groups.map(([g, v]) => (
            <View key={g} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Txt style={{ width: 120, fontSize: 12.5 }} numberOfLines={1}>
                {g}
              </Txt>
              <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round((v.ok / v.done) * 100)}%`, height: 8, backgroundColor: colors.up }} />
              </View>
              <Txt variant="sub" style={{ width: 70, fontSize: 12, textAlign: 'right' }}>
                {Math.round((v.ok / v.done) * 100)}% · 틀림 {v.wrong}
              </Txt>
            </View>
          ))}
          <Pressable
            onPress={() => Alert.alert('기록 지우기', '이 자료의 맞음·틀림 기록을 지울까요?', [{ text: '취소' }, { text: '지우기', style: 'destructive', onPress: () => clearScope(scope, 'stats') }])}
            hitSlop={6}
          >
            <Txt variant="sub" style={{ fontSize: 12 }}>
              기록 지우기
            </Txt>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function SmallBtn({ label, onPress, strong }: { label: string; onPress: () => void; strong?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.cat.amber.fg, backgroundColor: strong ? colors.cat.amber.fg : 'transparent' }}>
      <Txt style={{ fontSize: 12.5, fontWeight: '700', color: strong ? colors.background : colors.cat.amber.fg }}>{label}</Txt>
    </Pressable>
  );
}

// 가린 낱말: 안드로이드는 겹친 Text의 'transparent' 글자색을 무시해 글자가 보임 → 글자색을 바탕색과 같게
/** 가릴 수 있는 글. group: 암기율을 묶을 이름(영역 등) */
export const BlankText = memo(function BlankText({ text, size = 13.5, bold, group = '' }: { text: string; size?: number; bold?: boolean; group?: string }) {
  const { mode, editing, round, scope, vocab } = useContext(BlankCtx);
  const can = useAccess();
  const { colors } = useTheme();
  const [shown, setShown] = useState<Set<number> | 'all'>(new Set());
  useEffect(() => setShown(new Set()), [mode, round]);
  const key = itemKey(scope, group, text);
  const { custom, stat } = useBlankItem(key);
  const tokens = useMemo(() => tokenize(text), [text]);
  const words = useMemo(() => tokens.map((t, i) => (isDelim(t) ? -1 : i)).filter((i) => i >= 0), [tokens]);
  const lineH = size * 1.5;
  const base = { fontSize: size, lineHeight: lineH, fontWeight: (bold ? '600' : '400') as '600' | '400', color: colors.text };

  const active = can('blank') && mode !== 'off';
  if (!active) return <Txt style={base}>{text}</Txt>;

  // 편집: 낱말을 눌러 내 빈칸으로 고르기(저장)
  if (mode === 'mine' && editing) {
    const sel = new Set(custom ?? []);
    return (
      <Text style={base}>
        {tokens.map((t, i) =>
          isDelim(t) ? (
            t
          ) : (
            <Text
              key={i}
              onPress={() => toggleCustom(key, i)}
              style={sel.has(i) ? { backgroundColor: colors.cat.amber.fg, color: colors.background, fontWeight: '700' } : { textDecorationLine: 'underline', textDecorationColor: colors.line }}
            >
              {t}
            </Text>
          ),
        )}
      </Text>
    );
  }

  // 어떤 낱말을 가릴지
  let hide: Set<number>;
  if (mode === 'all') hide = new Set(words);
  else if (mode === 'smart') hide = keyIdx(tokens, vocab);
  else if (mode === 'mine') hide = new Set(custom ?? []);
  else hide = stat?.last === 'w' ? new Set(words) : new Set(); // 틀린 것만
  if (!hide.size) return <Txt style={[base, mode === 'wrong' ? { opacity: 0.45 } : null]}>{text}</Txt>;

  const isShown = (i: number) => shown === 'all' || shown.has(i);
  const anyShown = shown === 'all' || [...hide].some((i) => isShown(i));
  const reveal = (i: number) => setShown((p) => (p === 'all' ? p : new Set(p).add(i)));
  const allHidden = mode === 'all' || mode === 'wrong';

  return (
    <View style={{ gap: 4 }}>
      {allHidden && !anyShown ? (
        <Pressable onPress={() => setShown('all')} accessibilityRole="button" accessibilityLabel="가린 칸, 눌러서 보기">
          <View style={{ borderRadius: 6, backgroundColor: colors.cat.amber.bg, borderWidth: 1, borderColor: colors.cat.amber.fg, borderStyle: 'dashed', paddingHorizontal: 4 }}>
            <Txt style={[base, { opacity: 0 }]}>{text}</Txt>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Txt style={{ fontSize: 12, fontWeight: '700', color: colors.cat.amber.fg }}>?</Txt>
            </View>
          </View>
        </Pressable>
      ) : (
        <Text style={base}>
          {tokens.map((t, i) =>
            hide.has(i) && !isShown(i) ? (
              <Text key={i} onPress={() => reveal(i)} accessibilityLabel="가린 낱말, 눌러서 보기" style={{ color: colors.cat.amber.bg, backgroundColor: colors.cat.amber.bg, textDecorationLine: 'underline', textDecorationColor: colors.cat.amber.fg }}>
                {t}
              </Text>
            ) : (
              <Text key={i} style={hide.has(i) ? { color: colors.cat.amber.fg, fontWeight: '700' } : undefined}>
                {t}
              </Text>
            ),
          )}
        </Text>
      )}
      {anyShown && <MarkButtons k={key} />}
    </View>
  );
});

function MarkButtons({ k }: { k: string }) {
  const { colors } = useTheme();
  const [done, setDone] = useState<null | boolean>(null);
  if (done !== null)
    return (
      <Txt variant="sub" style={{ fontSize: 11.5 }}>
        {done ? '맞음 기록' : '틀림 기록 · 틀린 것만에서 다시 나와요'}
      </Txt>
    );
  const b = (ok: boolean) => (
    <Pressable
      onPress={() => {
        mark(k, ok);
        setDone(ok);
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={ok ? '맞음' : '틀림'}
      style={{ paddingHorizontal: 9, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1, borderColor: ok ? colors.up : colors.down }}
    >
      <Txt style={{ fontSize: 11.5, fontWeight: '700', color: ok ? colors.up : colors.down }}>{ok ? '✓ 맞음' : '✗ 틀림'}</Txt>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {b(true)}
      {b(false)}
    </View>
  );
}
