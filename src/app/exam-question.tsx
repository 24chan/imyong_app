import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Txt } from '../components/ui';
import { Box, examPdf, getAnalysis } from '../data/analysis';
import { useAsync } from '../data/useAsync';
import { NoteCanvas } from '../features/analysis/NoteCanvas';
import { QuestionClip } from '../features/analysis/QuestionClip';
import type { Crop } from '../features/analysis/questionCache';
import { Gate } from '../features/study/Gate';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

// 기출 문항 한눈에 보기 (2026-11-28 사용자 요청)
// 넓은 화면(태블릿 가로 등): 왼쪽 = 문항 앞부분(지문), 오른쪽 = 이어지는 부분(물음) — 화면 높이에 맞춰 끌지 않고 한 번에
// 2026-11-28: 그림이 준비되면 그 자리에서 필기(NoteCanvas) — 다른 화면으로 넘어가지 않음
// 좁은 화면(폰): 위아래로. 그림을 누르면 크게 보기, 위 '문제지 전체 보기'는 평가원 원본 PDF 전체
// 정답: 평가원은 초등 교육과정 정답을 공개하지 않아 정답 보기는 없음
const LEVEL = 'elementary' as const;

function ExamQuestionInner() {
  const { y, p, n } = useLocalSearchParams<{ y: string; p: string; n: string }>();
  const year = Number(y);
  const title = `${year}학년도 교육과정 ${p} ${n}번`;
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const an = useAsync(() => getAnalysis(LEVEL), []);
  const a = an.data;
  const f = useAsync(async () => (a ? examPdf(LEVEL, year, p, a) : null), [a, year, p]);
  const box: Box | undefined = a?.boxes?.[`${year}${p}`]?.[String(n)];
  const parts = box ? [box, ...(box.next ?? [])] : [];
  const wide = width >= 700 && parts.length > 1;
  const fitH = Math.max(320, height - 190); // 머리·여백을 뺀 화면 높이

  const openAll = () => {
    if (!f.data) return;
    router.push({ pathname: '/pdf', params: { url: f.data.url, title, page: f.data.page, pageLabel: '평가원 게시판' } });
  };

  // 2026-11-28: 문항 그림이 다 준비되면 필기 화면(확대·축소, 펜·형광펜·지우개, 자동 저장)으로 바꿈
  const [ready, setReady] = useState<Record<number, Crop>>({});
  const onReady = useCallback((i: number, img: Crop) => setReady((r) => (r[i]?.uri === img.uri ? r : { ...r, [i]: img })), []);
  const imgs = parts.map((_, i) => ready[i]).filter(Boolean) as Crop[];
  const allReady = parts.length > 0 && imgs.length === parts.length;

  const clip = (b: Box, i: number, h?: number) =>
    f.data ? <QuestionClip key={i} url={f.data.url} box={b} cacheKey={`${year}${p}-${n}${i ? `-c${i}` : ''}`} title={title} fitH={h} onPress={() => {}} onReady={(img) => onReady(i, img)} /> : null;

  let body;
  if (an.loading || f.loading) body = <ActivityIndicator color={colors.brand} style={{ marginTop: space.xl }} />;
  else if (!box || !f.data)
    body = (
      <Txt variant="sub" style={{ padding: space.lg }}>
        이 문항은 자리를 못 찾았어요(그림으로 된 옛 문제지 등). 위 '문제지 전체 보기'로 확인해 주세요.
      </Txt>
    );
  else if (allReady) body = <NoteCanvas noteKey={`${year}${p}-${n}`} imgs={imgs} layout={width >= 700 ? 'row' : 'col'} />;
  else if (wide) {
    const rest = parts.slice(1);
    const restH = (fitH - space.sm * (rest.length - 1)) / rest.length;
    body = (
      <View style={{ flex: 1, flexDirection: 'row', gap: space.md, padding: space.md }}>
        <View style={{ flex: 1 }}>{clip(parts[0], 0, fitH)}</View>
        <View style={{ flex: 1, gap: space.sm }}>{rest.map((b, i) => clip(b, i + 1, restH))}</View>
      </View>
    );
  } else if (width >= 700) {
    // 넓은 화면인데 한 칸짜리 문항: 가운데에 화면 높이로
    body = <View style={{ flex: 1, padding: space.md, alignItems: 'center' }}><View style={{ width: Math.min(width - space.md * 2, 900) }}>{clip(parts[0], 0, fitH)}</View></View>;
  } else body = <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm }}>{parts.map((b, i) => clip(b, i))}</ScrollView>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <Pressable onPress={openAll} disabled={!f.data} accessibilityRole="button" hitSlop={8} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line }}>
              <Txt style={{ fontSize: 13, fontWeight: '700', color: f.data ? colors.text : colors.textSub }}>문제지 전체 보기</Txt>
            </Pressable>
          ),
        }}
      />
      {body}
      <Txt variant="sub" style={{ fontSize: 11.5, textAlign: 'center', paddingBottom: space.sm }}>
        평가원 원문 그대로예요 · 두 손가락으로 확대·축소 · 평가원은 초등 교육과정 정답을 공개하지 않아요
      </Txt>
    </View>
  );
}

export default function ExamQuestionScreen() {
  return (
    <Gate feature="exam-analysis">
      <ExamQuestionInner />
    </Gate>
  );
}
