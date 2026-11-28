import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Chip, Screen, Txt } from '../components/ui';
import { getQuizBank, getQuizStats, MIN_TRIES, QUIZ_SUBJECTS, QuizItem, QuizStat, recordQuizAnswer } from '../data/quiz';
import { useAsync } from '../data/useAsync';
import { markAnswer, useQuizStore } from '../features/quiz/quizStore';
import { Gate } from '../features/study/Gate';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

// 1분 퀴즈 (2026-11-28 사용자 승인: 출제 기준·15유형·샘플 보완 3가지 반영)
// 담백한 학습 도구: 연속 기록·배지 없음. 한 세트 5문제, 한 손으로 탭.
// 맞히면 0.5초 뒤 다음 문제, 틀리면 정답과 원문 근거를 보여 주고 '다음'을 눌러 넘어감.
const SET = 5;

type Phase = 'pick' | 'solve' | 'done';
type Answer = { item: QuizItem; picked: number };

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function QuizInner() {
  const { colors } = useTheme();
  const bank = useAsync(() => getQuizBank(), []);
  const store = useQuizStore();
  const [subj, setSubj] = useState<string>('전체');
  const [examOnly, setExamOnly] = useState(false);
  const [wrongOnly, setWrongOnly] = useState(false);
  const [phase, setPhase] = useState<Phase>('pick');
  const [set, setSet] = useState<QuizItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [stats, setStats] = useState<Record<string, QuizStat>>({});
  const [fromWrong, setFromWrong] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const items = bank.data?.items ?? [];
  const wrongCount = Object.keys(store.wrong).length;
  const pool = useMemo(
    () =>
      items.filter(
        (q) => (subj === '전체' || q.s === subj) && (!examOnly || q.x === 1) && (!wrongOnly || store.wrong[q.id]),
      ),
    [items, subj, examOnly, wrongOnly, store.wrong],
  );

  const start = (list: QuizItem[], wrongNote: boolean) => {
    const s = shuffle(list).slice(0, SET);
    if (!s.length) return;
    setSet(s);
    setIdx(0);
    setPicked(null);
    setAnswers([]);
    setFromWrong(wrongNote);
    setPhase('solve');
    getQuizStats(s.map((q) => q.id)).then(setStats);
  };

  const next = (ans: Answer[]) => {
    if (idx + 1 >= set.length) {
      setAnswers(ans);
      setPhase('done');
    } else {
      setIdx(idx + 1);
      setPicked(null);
    }
  };

  const choose = (i: number) => {
    if (picked !== null) return;
    const q = set[idx];
    const ok = i === q.a;
    setPicked(i);
    markAnswer(q.id, ok, fromWrong);
    recordQuizAnswer(q.id, ok);
    const ans = [...answers, { item: q, picked: i }];
    setAnswers(ans);
    if (ok) timer.current = setTimeout(() => next(ans), 500);
  };

  if (bank.loading && !bank.data) return <ActivityIndicator color={colors.brand} />;
  if (!bank.data) return <Txt variant="sub">{bank.error ? bank.error.message : '퀴즈를 준비하는 중이에요. 잠시 뒤에 다시 열어 주세요.'}</Txt>;

  // ───── 고르기
  if (phase === 'pick') {
    return (
      <View style={{ gap: space.lg }}>
        <Txt variant="sub">교육과정 원문·내용 체계·성취기준·총론에서 자동으로 만든 {bank.data.count.toLocaleString()}문제 중 5문제씩 풀어요.</Txt>
        <View style={{ gap: space.sm }}>
          <Txt style={{ fontWeight: '700' }}>교과</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {['전체', ...QUIZ_SUBJECTS].map((s) => (
              <Chip key={s} label={s} selected={subj === s} onPress={() => setSubj(s)} />
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip label="★ 기출 빈출만" selected={examOnly} onPress={() => setExamOnly((v) => !v)} />
          <Chip label={`내 오답만 ${wrongCount}`} selected={wrongOnly} onPress={() => setWrongOnly((v) => !v)} />
        </View>
        <Pressable
          onPress={() => start(pool, wrongOnly)}
          disabled={!pool.length}
          accessibilityRole="button"
          style={({ pressed }) => ({ height: 54, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', opacity: !pool.length ? 0.4 : pressed ? 0.85 : 1 })}
        >
          <Txt style={{ color: colors.background, fontWeight: '800', fontSize: 17 }}>{pool.length ? '5문제 시작' : '조건에 맞는 문제가 없어요'}</Txt>
        </Pressable>
        <Txt variant="sub" style={{ fontSize: 12.5 }}>
          문제 {pool.length.toLocaleString()}개 · 틀린 문제는 오답 노트에 자동으로 모여요. 오답만 풀어서 맞히면 노트에서 빠져요.
        </Txt>
      </View>
    );
  }

  // ───── 결과
  if (phase === 'done') {
    const score = answers.filter((a) => a.picked === a.item.a).length;
    const wrongs = answers.filter((a) => a.picked !== a.item.a);
    return (
      <View style={{ gap: space.lg }}>
        <View style={{ alignItems: 'center', gap: 4, paddingVertical: space.lg }}>
          <Txt style={{ fontSize: 44, fontWeight: '900', color: colors.text }}>
            {score} <Txt style={{ fontSize: 26, fontWeight: '700', color: colors.textSub }}>/ {answers.length}</Txt>
          </Txt>
          <Txt variant="sub">{wrongs.length ? `틀린 ${wrongs.length}문제는 오답 노트에 넣었어요` : '모두 맞혔어요'}</Txt>
        </View>
        {wrongs.map((a) => (
          <WrongCard key={a.item.id} a={a} />
        ))}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {!!wrongs.length && (
            <Pressable onPress={() => start(wrongs.map((w) => w.item), true)} accessibilityRole="button" style={({ pressed }) => ({ flex: 1, height: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.brand, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
              <Txt style={{ fontWeight: '800', color: colors.brand }}>오답 다시 풀기</Txt>
            </Pressable>
          )}
          <Pressable onPress={() => start(pool, wrongOnly)} accessibilityRole="button" style={({ pressed }) => ({ flex: 1, height: 52, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
            <Txt style={{ fontWeight: '800', color: colors.background }}>한 번 더</Txt>
          </Pressable>
        </View>
        <Pressable onPress={() => setPhase('pick')} hitSlop={8} style={{ alignSelf: 'center' }}>
          <Txt style={{ fontWeight: '700', color: colors.textSub }}>교과·조건 다시 고르기</Txt>
        </Pressable>
      </View>
    );
  }

  // ───── 풀기
  const q = set[idx];
  const st = stats[q.id];
  const done = picked !== null;
  const ok = picked === q.a;
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Txt style={{ fontWeight: '900', fontSize: 16 }}>
          {idx + 1} <Txt style={{ color: colors.textSub, fontWeight: '700' }}>/ {set.length}</Txt>
        </Txt>
        <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.line }}>
          <View style={{ width: `${((idx + (done ? 1 : 0)) / set.length) * 100}%`, height: 4, borderRadius: 2, backgroundColor: colors.brand }} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <Txt variant="sub" style={{ fontSize: 12.5 }}>
          {q.t} · {q.g || q.s}
        </Txt>
        {q.x === 1 && <Txt style={{ fontSize: 12.5, fontWeight: '800', color: colors.cat.amber.fg }}>★ 기출</Txt>}
        {st && st.tries >= MIN_TRIES && (
          <Txt style={{ fontSize: 12.5, fontWeight: '800', color: colors.down }}>오답률 {Math.round((st.wrong / st.tries) * 100)}%</Txt>
        )}
      </View>
      <Txt style={{ fontSize: 17.5, lineHeight: 27, fontWeight: '600' }}>{q.q}</Txt>
      <View style={{ gap: space.sm }}>
        {q.c.map((c, i) => {
          const isAns = i === q.a;
          const mine = i === picked;
          const border = done && isAns ? colors.up : done && mine ? colors.down : colors.line;
          const bg = done && isAns ? colors.cat.teal.bg : done && mine ? colors.cat.coral.bg : colors.background;
          return (
            <Pressable
              key={i}
              onPress={() => choose(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: mine }}
              style={({ pressed }) => ({ minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: border, backgroundColor: pressed && !done ? colors.surface : bg })}
            >
              <Txt style={{ width: 20, fontWeight: '800', color: colors.textSub }}>{i + 1}</Txt>
              <Txt style={{ flex: 1, fontSize: 16, fontWeight: done && isAns ? '800' : '500' }}>{c}</Txt>
              {done && isAns && <Ionicons name="checkmark-circle" size={20} color={colors.up} />}
              {done && mine && !isAns && <Ionicons name="close-circle" size={20} color={colors.down} />}
            </Pressable>
          );
        })}
      </View>
      {done && (
        <View style={{ gap: space.sm }}>
          <Txt style={{ fontWeight: '800', color: ok ? colors.up : colors.down }}>{ok ? '정답이에요' : `정답: ${q.c[q.a]}`}</Txt>
          {!ok && (
            <>
              <View style={{ padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, gap: 4 }}>
                <Txt variant="sub" style={{ fontSize: 12 }}>원문 근거</Txt>
                <Txt style={{ fontSize: 14.5, lineHeight: 22 }}>{q.f}</Txt>
              </View>
              <Pressable onPress={() => next(answers)} accessibilityRole="button" style={({ pressed }) => ({ height: 52, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
                <Txt style={{ fontWeight: '800', color: colors.background }}>{idx + 1 >= set.length ? '결과 보기' : '다음'}</Txt>
              </Pressable>
            </>
          )}
          <Pressable
            onPress={() => router.push({ pathname: '/report', params: { target: `quiz:${q.id}`, label: `1분 퀴즈 · ${q.t}` } })}
            hitSlop={8}
            style={{ alignSelf: 'flex-end' }}
          >
            <Txt variant="sub" style={{ fontSize: 12.5, textDecorationLine: 'underline' }}>문제가 이상해요</Txt>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function WrongCard({ a }: { a: Answer }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" style={{ padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.background, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Ionicons name="close-circle" size={18} color={colors.down} />
        <Txt numberOfLines={open ? undefined : 1} style={{ flex: 1, fontWeight: '600' }}>
          {a.item.q}
        </Txt>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSub} />
      </View>
      {open && (
        <View style={{ gap: 4, paddingLeft: 26 }}>
          <Txt style={{ fontSize: 14 }}>
            내 답 <Txt style={{ color: colors.down, fontWeight: '700' }}>{a.item.c[a.picked]}</Txt> · 정답 <Txt style={{ color: colors.up, fontWeight: '800' }}>{a.item.c[a.item.a]}</Txt>
          </Txt>
          <Txt variant="sub" style={{ fontSize: 13, lineHeight: 20 }}>{a.item.f}</Txt>
        </View>
      )}
    </Pressable>
  );
}

export default function QuizScreen() {
  return (
    <Gate feature="quiz">
      <Stack.Screen options={{ title: '1분 퀴즈' }} />
      <Screen>
        <QuizInner />
      </Screen>
    </Gate>
  );
}
