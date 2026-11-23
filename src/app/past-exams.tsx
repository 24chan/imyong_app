import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from 'react-native';
import { ViewModeBanner } from '../components/ModeToggle';
import { Chip, Screen, Txt } from '../components/ui';
import { fileUrl, getPastExams, prettyFile } from '../data/pastExams';
import { SUBJECTS, subjectByCode } from '../data/subjects';
import { useAsync } from '../data/useAsync';
import { useAppSettings } from '../store/AppSettings';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { openLink } from '../lib/openLink';

// 기출문제 (2026-11-22 승인): 목록은 앱 안, 파일은 평가원 서버에서 바로 열어 앱 안에서 미리보기
export default function PastExamsScreen() {
  const { colors } = useTheme();
  const { viewLevel, settings } = useAppSettings();
  const list = useAsync(() => getPastExams(viewLevel), [viewLevel]);
  const items = list.data?.items ?? [];
  const years = useMemo(() => [...new Set(items.map((x) => x.year))].sort((a, b) => b - a), [items]);
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => setYear(null), [viewLevel]);
  const y = year ?? years[0] ?? null;

  // 중등: 내 과목 + 교육학 먼저, 칩으로 바꾸기
  const mySub = viewLevel === 'secondary' ? subjectByCode(settings.subjectCode)?.name ?? null : null;
  const [sub, setSub] = useState<string | null>(null);
  const subjectName = sub ?? mySub;
  const subNames = useMemo(() => ['전체', '교육학', ...SUBJECTS.map((s) => s.name)], []);
  const matchSub = (title: string) => {
    if (viewLevel !== 'secondary' || !subjectName || subjectName === '전체') return true;
    const t = title.replace(/\s/g, '');
    return t.startsWith(subjectName.replace(/\s/g, '')) || (subjectName !== '교육학' && t.startsWith('교육학'));
  };
  // 초등: 같은 글에 유치원·특수 파일도 함께 있어서 초등학교 파일만 (없으면 전부)
  const filesOf = (x: (typeof items)[number]) => {
    if (viewLevel !== 'elementary') return x.files;
    const e = x.files.filter((f) => f.name.includes('초등학교'));
    return e.length ? e : x.files;
  };
  const titleOf = (x: (typeof items)[number]) =>
    viewLevel === 'elementary' ? `${x.year}학년도 1차 · ${prettyFile(filesOf(x)[0]?.name ?? '').replace('초등학교', '').trim() || x.title}` : `${x.year}학년도 ${x.title}`;
  const shown = items.filter((x) => x.year === y && matchSub(x.title));

  return (
    <>
      <Stack.Screen options={{ title: '기출문제' }} />
      <Screen>
        <ViewModeBanner />
        <Txt variant="sub">한국교육과정평가원이 공개한 {viewLevel === 'elementary' ? '초등' : '중등'} 임용 1차 문제·정답이에요. 누르면 앱 안에서 바로 보고, 위의 버튼으로 파일을 받을 수 있어요.</Txt>
        {list.loading && !list.data ? (
          <ActivityIndicator color={colors.brand} />
        ) : !list.data ? (
          <Txt variant="sub">{list.error ? list.error.message : '기출 목록을 모으는 중이에요. 잠시 뒤에 다시 열어 주세요.'}</Txt>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {years.map((yy) => (
                <Chip key={yy} label={`${yy}학년도`} selected={y === yy} onPress={() => setYear(yy)} />
              ))}
            </ScrollView>
            {viewLevel === 'secondary' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {[...(mySub ? [mySub] : []), ...subNames.filter((n) => n !== mySub)].map((n) => (
                  <Chip key={n} label={n} selected={(subjectName ?? '전체') === n} onPress={() => setSub(n)} />
                ))}
              </ScrollView>
            )}
            {shown.length === 0 ? (
              <Txt variant="sub">이 조건의 기출이 없어요.</Txt>
            ) : (
              <View style={{ borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
                {shown.map((x, i) => (
                  <View key={x.id} style={{ padding: space.md, gap: space.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: colors.cat[x.kind.includes('정답') ? 'green' : 'coral'].bg }}>
                        <Txt style={{ fontSize: 12, fontWeight: '800', color: colors.cat[x.kind.includes('정답') ? 'green' : 'coral'].fg }}>{x.kind}</Txt>
                      </View>
                      <Txt style={{ fontWeight: '800', flex: 1 }} numberOfLines={2}>
                        {titleOf(x)}
                      </Txt>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {filesOf(x).map((f) => (
                        <Pressable
                          key={f.key}
                          onPress={() => router.push({ pathname: '/pdf', params: { url: fileUrl(list.data!, f), title: prettyFile(f.name), page: list.data!.page } })}
                          accessibilityRole="button"
                          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: pressed ? colors.surface : colors.background })}
                        >
                          <Ionicons name="document-text-outline" size={15} color={colors.cat.blue.fg} />
                          <Txt style={{ fontSize: 13.5, fontWeight: '700' }}>{prettyFile(f.name).replace('초등학교 ', '')}</Txt>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
            <Pressable onPress={() => openLink(list.data!.page, '평가원 기출문제')}>
              <Txt variant="sub" color="brand" style={{ textDecorationLine: 'underline' }}>
                출처: 한국교육과정평가원 기출문제 게시판 (목록 갱신 {list.data.updated})
              </Txt>
            </Pressable>
          </>
        )}
      </Screen>
    </>
  );
}
