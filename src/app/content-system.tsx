import { Gate } from '../features/study/Gate';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Chip, Screen, Txt } from '../components/ui';
import { CsArea, getContentSystem } from '../data/contentSystem';
import { useAsync } from '../data/useAsync';
import { BlankBar, BlankScope, BlankText, useBlank } from '../features/study/Blank';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

// 내용 체계표(내체표) 모아보기 + 빈칸 암기 (2026-11-24 사용자 요청)
// 2022 개정 초등 교육과정 고시문의 '내용 체계' 표만 교과별로. 빈칸 모드: 내용 요소 칸을 가리고 눌러서 확인
function ContentSystemScreenInner() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ subject?: string }>();
  const data = useAsync(() => getContentSystem(), []);
  const subjects = data.data?.subjects ?? [];
  const [pick, setPick] = useState<string | null>(params.subject ?? null);
  const subj = subjects.find((s) => s.subject === pick) ?? subjects.find((s) => params.subject && s.subject.includes(params.subject)) ?? subjects[0];
  const blank = useBlank();

  return (
    <>
      <Stack.Screen options={{ title: '내용 체계표' }} />
      <Screen>
        {data.loading && !data.data ? (
          <ActivityIndicator color={colors.brand} />
        ) : !subj ? (
          <Txt variant="sub">{data.error ? data.error.message : '내용 체계표를 만드는 중이에요. 잠시 뒤에 다시 열어 주세요.'}</Txt>
        ) : (
          <>
            <Txt variant="sub" style={{ fontSize: 12.5 }}>
              2022 개정 초등 교육과정 고시문의 '내용 체계' 표만 교과별로 모았어요. 출처: NCIC 교육과정 원문 (기준 {data.data?.built}).
            </Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {subjects.map((s) => (
                <Chip key={s.subject} label={s.subject} selected={s.subject === subj.subject} onPress={() => setPick(s.subject)} />
              ))}
            </ScrollView>
            <BlankBar on={blank.on} onToggle={blank.setOn} onReset={blank.reset} />
            <BlankScope on={blank.on} round={blank.round}>
              {subj.areas.map((a, i) => (
                <AreaCard key={`${subj.subject}-${i}`} a={a} />
              ))}
            </BlankScope>
            <View style={{ flexDirection: 'row', gap: space.md, flexWrap: 'wrap' }}>
              <Pressable onPress={() => router.push({ pathname: '/concept-tree', params: { subject: subj.subject } })} hitSlop={8}>
                <Txt style={{ fontWeight: '700', color: colors.brand }}>{subj.subject} 개념 구조도 ›</Txt>
              </Pressable>
              <Pressable onPress={() => router.push('/curriculum')} hitSlop={8}>
                <Txt style={{ fontWeight: '700', color: colors.textSub }}>원문 고시문 보기 ›</Txt>
              </Pressable>
            </View>
          </>
        )}
      </Screen>
    </>
  );
}

function AreaCard({ a }: { a: CsArea }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [ideas, setIdeas] = useState(false);
  // 좁은 화면은 옆으로 밀어서 보기, 넓은 화면(태블릿)은 화면 폭에 맞춤
  const labelW = 112;
  const colW = Math.max(150, Math.floor((Math.min(width, 1100) - 2 * space.lg - 2 * space.lg - labelW) / Math.max(1, a.grades.length)));
  const firstOfCat = useMemo(() => a.rows.map((r, i) => i === 0 || a.rows[i - 1].cat !== r.cat), [a.rows]);
  const cell = { borderColor: colors.line, borderRightWidth: 1, borderBottomWidth: 1, padding: 8 };

  return (
    <View style={{ backgroundColor: colors.background, borderRadius: radius.xl, padding: space.lg, gap: space.sm }}>
      <Txt style={{ fontSize: 17, fontWeight: '700' }}>{a.area}</Txt>
      {a.ideas.length > 0 && (
        <Pressable onPress={() => setIdeas((v) => !v)} accessibilityRole="button">
          <Txt style={{ fontSize: 13, fontWeight: '600', color: colors.brand }}>
            핵심 아이디어 {a.ideas.length}개 {ideas ? '접기 ▲' : '펼치기 ▼'}
          </Txt>
        </Pressable>
      )}
      {ideas && (
        <View style={{ gap: 6, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface }}>
          {a.ideas.map((t, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 6 }}>
              <Txt variant="sub">•</Txt>
              <View style={{ flex: 1 }}>
                <BlankText text={t} size={13} />
              </View>
            </View>
          ))}
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={{ borderLeftWidth: 1, borderTopWidth: 1, borderColor: colors.line }}>
          <View style={{ flexDirection: 'row', backgroundColor: colors.surface }}>
            <View style={[cell, { width: labelW }]}>
              <Txt style={{ fontSize: 12.5, fontWeight: '700' }}>범주</Txt>
            </View>
            {a.grades.map((g) => (
              <View key={g} style={[cell, { width: colW }]}>
                <Txt style={{ fontSize: 12.5, fontWeight: '700', textAlign: 'center' }}>{g}학년</Txt>
              </View>
            ))}
          </View>
          {a.rows.map((r, ri) => (
            <View key={ri} style={{ flexDirection: 'row' }}>
              <View style={[cell, { width: labelW, backgroundColor: colors.surface }]}>
                {firstOfCat[ri] && <Txt style={{ fontSize: 12, fontWeight: '700', color: colors.brand }}>{r.cat}</Txt>}
                {!!r.sub && <Txt style={{ fontSize: 12.5, fontWeight: '600' }}>{r.sub}</Txt>}
              </View>
              {r.cells.map((c, ci) => (
                <View key={ci} style={[cell, { width: colW * c.span, gap: 4 }]}>
                  {c.items.length === 0 ? (
                    <Txt variant="sub" style={{ fontSize: 12 }}>
                      –
                    </Txt>
                  ) : (
                    c.items.map((t, ti) => <BlankText key={ti} text={t} />)
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}


// 2026-11-28: 경인교대 인증 회원·운영자만 (lib/access.ts)
export default function ContentSystemScreen() {
  return (
    <Gate feature="content-system">
      <ContentSystemScreenInner />
    </Gate>
  );
}
