import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { ViewModeBanner } from '../components/ModeToggle';
import { Chip, Screen, Txt } from '../components/ui';
import { CurDoc, getCurriculum, prettyCurFile, splitSchool } from '../data/curriculum';
import { subjectByCode } from '../data/subjects';
import { useAsync } from '../data/useAsync';
import { openLink } from '../lib/openLink';
import { useAppSettings } from '../store/AppSettings';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

// 교육과정 원문 (2026-11-24 사용자 승인: 앱 안에서 최대한 해결)
// NCIC 원문 인벤토리 목록을 수집해 두고, 교과별 고시문 PDF를 앱 안에서 바로 봄. 위에는 원문 페이지·파일 받기.
export default function CurriculumScreen() {
  const { colors } = useTheme();
  const { viewLevel, settings } = useAppSettings();
  const data = useAsync(() => getCurriculum(), []);
  const docs = data.data?.docs ?? [];

  const eras = useMemo(() => [...new Set(docs.map((d) => d.era))].sort().reverse(), [docs]);
  const [era, setEra] = useState<string | null>(null);
  const e = era ?? eras[0] ?? null;

  // 학교급(이름의 날짜는 판: 2022.12 처음 고시, 2026.01 일부개정 등)
  const inEra = docs.filter((d) => d.era === e);
  const bases = useMemo(() => {
    const order = ['초등학교', '중학교', '고등학교', '초ㆍ중등학교', '특수교육'];
    const bs = [...new Set(inEra.map((d) => splitSchool(d.school).base))];
    return bs.sort((a, b) => (order.indexOf(a) + 99) % 99 - ((order.indexOf(b) + 99) % 99));
  }, [inEra]);
  const defBase = viewLevel === 'elementary' ? '초등학교' : '중학교';
  const [base, setBase] = useState<string | null>(null);
  useEffect(() => setBase(null), [viewLevel, e]);
  const b = base && bases.includes(base) ? base : bases.includes(defBase) ? defBase : bases[0];
  const versions = useMemo(
    () => [...new Set(inEra.filter((d) => splitSchool(d.school).base === b).map((d) => splitSchool(d.school).ver))].sort(),
    [inEra, b],
  );
  const [ver, setVer] = useState<string | null>(null);
  useEffect(() => setVer(null), [b, e]);
  const v = ver && versions.includes(ver) ? ver : versions[0];

  // 중등: 내 과목 먼저
  const mySub = viewLevel === 'secondary' ? subjectByCode(settings.subjectCode)?.name ?? null : null;
  const list = inEra
    .filter((d) => splitSchool(d.school).base === b && splitSchool(d.school).ver === v)
    .sort((x, y) => {
      const rank = (d: CurDoc) => (d.subject === '총론' ? 0 : mySub && d.subject.includes(mySub) ? 1 : 2);
      return rank(x) - rank(y);
    });
  const [open, setOpen] = useState<string | null>(null);

  const openFile = (d: CurDoc, f: CurDoc['files'][number]) => {
    if (f.ext === 'pdf') {
      router.push({ pathname: '/pdf', params: { url: f.url, title: `${d.subject} 교육과정`, page: data.data?.page, pageLabel: 'NCIC 원문 페이지' } });
    } else {
      openLink(f.url, prettyCurFile(f.name));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: '교육과정 원문' }} />
      <Screen>
        <ViewModeBanner />
        <View style={{ backgroundColor: colors.background, borderRadius: radius.xl, padding: space.lg, gap: 6 }}>
          <Txt style={{ fontWeight: '700' }}>시험 범위</Txt>
          <Txt variant="sub">
            {viewLevel === 'elementary'
              ? '2027학년도 공고 기준 1차 교육과정 A·B는 "초등학교 교육과정 전 영역", 2022 개정 교육과정이에요. 각론마다 성격·목표, 내용 체계·성취기준, 교수·학습 및 평가(교육론)가 들어 있어요.'
              : '중등 전공은 교과교육학(25~35%)과 교과내용학으로 나뉘어요. 교과교육학의 기본이 되는 내 과목 각론과 총론이에요.'}
          </Txt>
          <Txt variant="sub" style={{ fontSize: 12 }}>
            최신 일부개정은 국가교육위원회 고시 제2026-1호(2026. 1. 21.)예요. 내 시험에 어느 고시가 적용되는지는 지역 시행계획 공고에서 꼭 확인하세요.
          </Txt>
        </View>
        {data.loading && !data.data ? (
          <ActivityIndicator color={colors.brand} />
        ) : !data.data ? (
          <Txt variant="sub">{data.error ? data.error.message : '교육과정 목록을 모으는 중이에요. 잠시 뒤에 다시 열어 주세요.'}</Txt>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {eras.map((x) => (
                <Chip key={x} label={x.replace(' 시기', '')} selected={e === x} onPress={() => setEra(x)} />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {bases.map((x) => (
                <Chip key={x} label={x} selected={b === x} onPress={() => setBase(x)} />
              ))}
            </ScrollView>
            {versions.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {versions.map((x, i) => (
                  <Chip key={x} label={`${x} ${i === 0 ? '고시' : '일부개정'}`} selected={v === x} onPress={() => setVer(x)} />
                ))}
              </ScrollView>
            )}
            {list.length === 0 ? (
              <Txt variant="sub">이 조건의 교육과정이 없어요.</Txt>
            ) : (
              <View style={{ borderRadius: radius.xl, backgroundColor: colors.background, overflow: 'hidden' }}>
                {list.map((d, i) => {
                  const k = `${d.school}|${d.subject}`;
                  const files = [...d.files].sort((x, y) => (x.ext === 'pdf' ? 0 : 1) - (y.ext === 'pdf' ? 0 : 1));
                  return (
                    <View key={k} style={{ paddingVertical: space.md, paddingHorizontal: space.lg, gap: space.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                      <Pressable onPress={() => setOpen(open === k ? null : k)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }} accessibilityRole="button">
                        <Txt style={{ fontWeight: '600', fontSize: 15.5, flex: 1 }}>
                          {d.subject}
                          {mySub && d.subject.includes(mySub) ? <Txt style={{ color: colors.cat.teal.fg, fontSize: 12.5, fontWeight: '700' }}>  내 과목</Txt> : null}
                        </Txt>
                        {d.sections.length > 0 && (
                          <>
                            <Txt variant="sub" style={{ fontSize: 12.5 }}>목차 {d.sections.length}</Txt>
                            <Ionicons name={open === k ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSub} />
                          </>
                        )}
                      </Pressable>
                      {open === k && (
                        <View style={{ gap: 2, paddingLeft: 4 }}>
                          {d.sections.map((s) => (
                            <Txt key={s.seq ?? s.title} variant="sub" style={{ fontSize: 13 }}>
                              · {s.title}
                            </Txt>
                          ))}
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {files.length === 0 && <Txt variant="sub" style={{ fontSize: 12.5 }}>파일 없음</Txt>}
                        {files.map((f) => (
                          <Pressable
                            key={f.seq}
                            onPress={() => openFile(d, f)}
                            accessibilityRole="button"
                            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: pressed ? colors.surface : colors.background, maxWidth: '100%' })}
                          >
                            <Ionicons name={f.ext === 'pdf' ? 'document-text-outline' : 'download-outline'} size={15} color={f.ext === 'pdf' ? colors.cat.teal.fg : colors.textSub} />
                            <Txt style={{ fontSize: 13, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
                              {f.ext === 'pdf' ? '앱에서 보기' : `${f.ext.toUpperCase()} 받기`} · {prettyCurFile(f.name).slice(0, 28)}
                            </Txt>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
            <Txt variant="sub" style={{ fontSize: 12 }}>
              출처: 국가교육과정정보센터(NCIC) 원문 인벤토리. 교육과정 고시문은 저작권 보호 대상이 아니라서 앱 안에서 바로 보여줘요.
            </Txt>
          </>
        )}
      </Screen>
    </>
  );
}
