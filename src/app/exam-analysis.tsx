import { router, Stack } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { Chip, Screen, Segmented, Txt } from '../components/ui';
import { examPdf, getAnalysis, getAnalysisSubject, highlight, Hit, Unit } from '../data/analysis';
import { useAsync } from '../data/useAsync';
import { Sheet } from '../features/community/parts';
import { QuestionClip } from '../features/analysis/QuestionClip';
import { useAppSettings } from '../store/AppSettings';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

// 기출 분석 (2026-11-24 사용자 승인, 1단계: 초등 교육과정 A·B)
// 형광펜 원문 · 통계(칸별 비율, 연도×교과) · 출제 지도 · 핵심어 · 안 나온 곳
type Tab = 'text' | 'stats' | 'map' | 'terms' | 'gaps';
const SECTION_ORDER = ['성격', '목표', '성격·목표', '내용 체계', '성취기준', '교수·학습', '교수·학습 및 평가', '평가', '앞부분'];

export default function ExamAnalysisScreen() {
  const { colors } = useTheme();
  const { viewLevel } = useAppSettings();
  const level = 'elementary'; // 1단계는 초등만
  const data = useAsync(() => getAnalysis(level), []);
  const a = data.data;
  const [tab, setTab] = useState<Tab>('text');
  const subjects = useMemo(() => (a?.subjects ?? []).map((x) => x.name), [a]);
  const [subject, setSubject] = useState<string | null>(null);
  const subj = subject ?? subjects[0] ?? null;
  const subjFile = a?.subjects.find((x) => x.name === subj)?.file ?? null;
  const sd = useAsync(async () => (subjFile ? getAnalysisSubject(level, subjFile) : null), [subjFile]);
  const hitsOf = (id: number) => sd.data?.hits[String(id)] ?? [];
  const [era, setEra] = useState<'2022' | '2015'>('2022');
  const [openId, setOpenId] = useState<number | null>(null);
  useEffect(() => setOpenId(null), [subj, era, tab]);

  const openExam = async (h: Hit) => {
    setOpenId(null);
    const f = await examPdf(level, h.y, h.p, a);
    if (!f) return Alert.alert('문제지를 찾지 못했어요');
    router.push({ pathname: '/pdf', params: { url: f.url, title: `${h.y}학년도 교육과정 ${h.p} ${h.n}번`, page: f.page, pageLabel: '평가원 게시판' } });
  };

  // 출제 지도 팝업: 나온 문항을 평가원 원본에서 그 문항만 잘라 보여 줌(A안, 문항 그림은 저장 안 함)
  const HitClips = ({ hs }: { hs: Hit[] }) => {
    const [more, setMore] = useState(false);
    const uniq = [...new Map([...hs].sort((x, y) => y.y - x.y || x.n - y.n).map((h) => [`${h.y}${h.p}${h.n}`, h])).values()];
    const shown = more ? uniq : uniq.slice(0, 3);
    return (
      <View style={{ gap: space.md }}>
        <Txt variant="sub" style={{ fontSize: 12.5 }}>
          나온 문항 {uniq.length}개 · 평가원 원문에서 그 문항만 보여 줘요
        </Txt>
        {shown.map((h) => (
          <OneClip key={`${h.y}${h.p}${h.n}`} h={h} />
        ))}
        {!more && uniq.length > 3 && (
          <Pressable onPress={() => setMore(true)} accessibilityRole="button" style={{ alignSelf: 'center', padding: space.sm }}>
            <Txt style={{ fontWeight: '700', color: colors.brand }}>{uniq.length - 3}개 더 보기</Txt>
          </Pressable>
        )}
      </View>
    );
  };
  const OneClip = ({ h }: { h: Hit }) => {
    const f = useAsync(() => examPdf(level, h.y, h.p, a), [h.y, h.p, a]);
    const box = a?.boxes?.[`${h.y}${h.p}`]?.[String(h.n)];
    return (
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.cat.coral.bg }}>
            <Txt style={{ fontSize: 12.5, fontWeight: '700', color: colors.cat.coral.fg }}>
              {h.y}학년도 {h.p} {h.n}번
            </Txt>
          </View>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => openExam(h)} accessibilityRole="button" hitSlop={8}>
            <Txt style={{ fontSize: 12.5, fontWeight: '600', color: colors.textSub }}>원문 전체 보기 ›</Txt>
          </Pressable>
        </View>
        {box && f.data ? (
          <>
            <QuestionClip url={f.data.url} box={box} cacheKey={`${h.y}${h.p}-${h.n}`} title={`${h.y}학년도 교육과정 ${h.p} ${h.n}번`} />
          </>
        ) : f.loading ? (
          <ActivityIndicator color={colors.brand} />
        ) : (
          <Txt variant="sub" style={{ fontSize: 12.5 }}>
            이 문항은 자리를 못 찾았어요(그림으로 된 옛 문제지 등). 원문 전체 보기로 확인해 주세요.
          </Txt>
        )}
      </View>
    );
  };

  const HitChips = ({ hs }: { hs: Hit[] }) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {[...hs].sort((x, y) => y.y - x.y || x.n - y.n).map((h) => (
        <Pressable
          key={`${h.y}${h.p}${h.n}`}
          onPress={() => openExam(h)}
          accessibilityRole="button"
          style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.cat.coral.bg }}
        >
          <Txt style={{ fontSize: 12.5, fontWeight: '600', color: colors.cat.coral.fg }}>
            {h.y} {h.p}-{h.n}
          </Txt>
        </Pressable>
      ))}
    </View>
  );

  const UnitCard = ({ u }: { u: Unit }) => {
    const hs = hitsOf(u.id);
    const open = openId === u.id;
    return (
      <Pressable onPress={() => setOpenId(open ? null : u.id)} style={{ paddingVertical: space.md, paddingHorizontal: space.lg, gap: 6, borderTopWidth: 1, borderTopColor: colors.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {!!u.code && <Txt style={{ fontSize: 12.5, fontWeight: '700', color: colors.cat.blue.fg }}>{u.code}</Txt>}
          {!!u.area && <Txt variant="sub" style={{ fontSize: 12 }}>{u.area}</Txt>}
          <View style={{ flex: 1 }} />
          {hs.length > 0 && (
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.cat.coral.bg }}>
              <Txt style={{ fontSize: 12, fontWeight: '700', color: colors.cat.coral.fg }}>{new Set(hs.map((h) => `${h.y}${h.p}${h.n}`)).size}회</Txt>
            </View>
          )}
        </View>
        <Txt style={{ fontSize: 14.5, lineHeight: 22 }} numberOfLines={open ? undefined : 4}>
          {highlight(u.text, hs).map((seg, i) => (
            <Txt
              key={i}
              style={{
                fontSize: 14.5,
                lineHeight: 22,
                backgroundColor: seg.heat ? (seg.heat >= 3 ? colors.cat.amber.fg + '55' : colors.cat.amber.bg) : undefined,
                fontWeight: seg.heat ? '600' : '400',
              }}
            >
              {seg.t}
            </Txt>
          ))}
        </Txt>
        {open && hs.length > 0 && (
          <View style={{ gap: 4 }}>
            <Txt variant="sub" style={{ fontSize: 12.5 }}>나온 문항 (누르면 문제지)</Txt>
            <HitChips hs={hs} />
          </View>
        )}
      </Pressable>
    );
  };

  const body = () => {
    if (!a || !subj) return null;
    const needUnits = tab === 'text' || tab === 'map';
    if (needUnits && sd.loading && !sd.data) return <ActivityIndicator color={colors.brand} />;
    const units = (sd.data?.units ?? []).filter((u) => u.era === era);
    if (tab === 'text') {
      const bySec = new Map<string, Unit[]>();
      units.forEach((u) => bySec.set(u.section, [...(bySec.get(u.section) ?? []), u]));
      const secs = [...bySec.keys()].sort((x, y) => SECTION_ORDER.indexOf(x) - SECTION_ORDER.indexOf(y));
      return (
        <>
          <Segmented options={[{ value: '2022', label: '2022 개정' }, { value: '2015', label: '2015 개정' }]} value={era} onChange={setEra} compact />
          <Txt variant="sub" style={{ fontSize: 12.5 }}>
            노란 곳이 기출에 나온 말이에요(많이 나올수록 진하게). 칸을 누르면 펼쳐지고, 나온 문항을 누르면 문제지가 열려요. {era === '2022' ? '2026학년도까지 기출은 2015 개정 기준이라, 2022 원문에는 같은 내용이 이어진 곳만 칠해져요.' : ''}
          </Txt>
          {secs.map((s) => (
            <View key={s} style={{ gap: 6 }}>
              <Txt variant="sub" style={{ fontSize: 13, fontWeight: '600', paddingHorizontal: 6 }}>
                {s} · {bySec.get(s)!.reduce((n, u) => n + (hitsOf(u.id).length ? 1 : 0), 0)}/{bySec.get(s)!.length}칸 출제
              </Txt>
              <View style={{ backgroundColor: colors.background, borderRadius: radius.xl, overflow: 'hidden', marginTop: -1 }}>
                {bySec.get(s)!.map((u) => <UnitCard key={u.id} u={u} />)}
              </View>
            </View>
          ))}
        </>
      );
    }
    if (tab === 'stats') {
      const share = a.stats.section_share[subj] ?? {};
      const total = Object.values(share).reduce((x, y) => x + y, 0) || 1;
      const secs = Object.entries(share).sort((x, y) => y[1] - x[1]);
      const sy = a.stats.subject_year;
      const subs = Object.keys(sy).sort((x, y) => sumv(sy[y]) - sumv(sy[x]));
      const max = Math.max(1, ...subs.flatMap((s) => Object.values(sy[s])));
      return (
        <>
          <Card title={`${subj} · 원문 어느 칸에서 나왔나`}>
            {secs.length === 0 && <Txt variant="sub">아직 이어진 문항이 없어요.</Txt>}
            {(subj === '총론' || subj === '창체') && (
              <Txt variant="sub" style={{ fontSize: 12 }}>
                {subj}은 교과별 성취기준 편제가 없어서 '성취기준' 비율은 해당 없음이에요.
              </Txt>
            )}
            {secs.map(([s, n]) => (
              <View key={s} style={{ gap: 3 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt style={{ fontSize: 13.5, fontWeight: '600' }}>{s}</Txt>
                  <Txt variant="sub" style={{ fontSize: 13 }}>{Math.round((n / total) * 100)}% · {n}건</Txt>
                </View>
                <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.surface, overflow: 'hidden' }}>
                  <View style={{ width: `${(n / total) * 100}%`, height: 10, backgroundColor: colors.cat.teal.fg }} />
                </View>
              </View>
            ))}
          </Card>
          <Card title="연도 × 교과 (문항 수)">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ gap: 3 }}>
                <View style={{ flexDirection: 'row', gap: 3 }}>
                  <View style={{ width: 74 }} />
                  {a.years.map((y) => (
                    <Txt key={y} variant="sub" style={{ width: 30, textAlign: 'center', fontSize: 11 }}>{String(y).slice(2)}</Txt>
                  ))}
                </View>
                {subs.map((s) => (
                  <View key={s} style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
                    <Txt numberOfLines={1} style={{ width: 74, fontSize: 12.5, fontWeight: s === subj ? '700' : '500' }}>{s}</Txt>
                    {a.years.map((y) => {
                      const n = sy[s]?.[String(y)] ?? 0;
                      return (
                        <View key={y} style={{ width: 30, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: n ? colors.cat.teal.bg : colors.surface, opacity: n ? 0.45 + 0.55 * (n / max) : 1 }}>
                          <Txt style={{ fontSize: 12, fontWeight: '600', color: n ? colors.cat.teal.fg : colors.textSub }}>{n || ''}</Txt>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
            <Txt variant="sub" style={{ fontSize: 12 }}>문항마다 가장 비슷한 교과로 자동 분류했어요(통합 문항은 한 교과로만 셈).</Txt>
            <Txt variant="sub" style={{ fontSize: 12 }}>2015학년도는 그림(스캔) 문제지라 글자를 읽은 3문항만 셌어요.</Txt>
          </Card>
        </>
      );
    }
    if (tab === 'map') {
      const std = units.filter((u) => u.code);
      const areas = [...new Set(std.map((u) => u.area || '영역'))];
      const cnt = (u: Unit) => new Set(hitsOf(u.id).map((h) => `${h.y}${h.p}${h.n}`)).size;
      const max = Math.max(1, ...std.map(cnt));
      const sel = std.find((u) => u.id === openId);
      return (
        <>
          <Segmented options={[{ value: '2022', label: '2022 개정' }, { value: '2015', label: '2015 개정' }]} value={era} onChange={setEra} compact />
          <Txt variant="sub" style={{ fontSize: 12.5 }}>성취기준 하나가 한 칸이에요. 진할수록 많이 나왔고, 빈칸은 안 나온 곳이에요. 칸을 누르면 바로 내용이 떠요.</Txt>
          {std.length === 0 && <Txt variant="sub">성취기준을 찾지 못했어요.</Txt>}
          {areas.map((ar) => (
            <Card key={ar} title={ar}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {std.filter((u) => (u.area || '영역') === ar).map((u) => {
                  const n = cnt(u);
                  return (
                    <Pressable
                      key={u.id}
                      onPress={() => setOpenId(u.id)}
                      accessibilityLabel={`${u.code} ${n}회`}
                      style={{ width: 54, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: n ? colors.cat.coral.fg : colors.surface, opacity: n ? 0.3 + 0.7 * (n / max) : 1, borderWidth: openId === u.id ? 2 : 0, borderColor: colors.text }}
                    >
                      <Txt style={{ fontSize: 10, fontWeight: '700', color: n ? colors.background : colors.textSub }}>{u.code.replace(/[[\]]/g, '')}</Txt>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          ))}
          {/* 2026-11-24 사용자 요청: 맨 아래가 아니라 누른 자리에서 바로 보이게 → 팝업 시트 */}
          <Sheet visible={!!sel} onClose={() => setOpenId(null)} title={sel ? `${sel.code} · ${cnt(sel)}회 나옴` : ''}>
            {sel && (
              <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: space.md }}>
                {!!sel.area && (
                  <Txt variant="sub" style={{ fontSize: 12.5 }}>
                    {subj} · {sel.area}
                  </Txt>
                )}
                <Txt style={{ fontSize: 15, lineHeight: 23 }}>{sel.text}</Txt>
                {hitsOf(sel.id).length ? (
                  <>
                    <HitClips hs={hitsOf(sel.id)} />
                  </>
                ) : (
                  <Txt variant="sub">아직 기출에 안 나왔어요.</Txt>
                )}
              </ScrollView>
            )}
          </Sheet>
        </>
      );
    }
    if (tab === 'terms') {
      const terms = a.stats.top_terms[subj] ?? [];
      const maxT = Math.max(1, ...terms.map((t) => t.total));
      return (
        <Card title={`${subj} · 기출에 나온 핵심 개념`}>
          <Txt variant="sub" style={{ fontSize: 12 }}>
            2022 개정 교육과정 내용 체계의 내용 요소(교육과정이 정한 핵심 개념)가 이 교과 문항에 몇 번 나왔는지예요. 상황을 설명하는 흔한 말은 뺐어요.
          </Txt>
          {terms.length === 0 && <Txt variant="sub">아직 없어요.</Txt>}
          {terms.slice(0, 30).map((t, i) => (
            <View key={t.term} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Txt variant="sub" style={{ width: 20, fontSize: 12 }}>{i + 1}</Txt>
              <View style={{ width: 132 }}>
                <Txt style={{ fontSize: 14, fontWeight: '600' }} numberOfLines={2}>
                  {t.term}
                </Txt>
                {!!t.area && (
                  <Txt variant="sub" style={{ fontSize: 11 }} numberOfLines={1}>
                    {t.area}
                    {t.cat ? ` · ${t.cat}` : ''}
                  </Txt>
                )}
              </View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 22 }}>
                {a.years.map((y) => {
                  const n = t.years[String(y)] ?? 0;
                  return <View key={y} style={{ flex: 1, height: n ? 4 + 18 * (n / maxT) * 3 : 2, maxHeight: 22, borderRadius: 2, backgroundColor: n ? colors.cat.blue.fg : colors.line }} />;
                })}
              </View>
              <Txt style={{ width: 30, textAlign: 'right', fontSize: 13, fontWeight: '700' }}>{t.total}</Txt>
            </View>
          ))}
          <Txt variant="sub" style={{ fontSize: 12 }}>막대는 {a.years[0]}~{a.years[a.years.length - 1]}학년도 해마다 나온 문항 수예요.</Txt>
        </Card>
      );
    }
    const un = a.stats.untouched_recent5[subj] ?? [];
    return (
      <>
        <Card title={`최근 5년 안 나온 성취기준 (2022 개정) · ${un.length}개`}>
          {un.length === 0 && <Txt variant="sub">없어요.</Txt>}
          {un.slice(0, 80).map((x) => (
            <Txt key={x.id} style={{ fontSize: 13.5, lineHeight: 20 }}>
              <Txt style={{ fontSize: 13.5, fontWeight: '700', color: colors.cat.blue.fg }}>{x.code} </Txt>
              {x.text}
            </Txt>
          ))}
        </Card>
        {/* 2026-11-24 검토 반영: '2022 새 용어'는 자동 추출 잡음이 많아 1차 배포에서 숨김(데이터는 그대로 둠) */}
      </>
    );
  };

  function Card({ title, children }: { title: string; children: ReactNode }) {
    return (
      <View style={{ backgroundColor: colors.background, borderRadius: radius.xl, padding: space.lg, gap: space.sm }}>
        <Txt style={{ fontSize: 16, fontWeight: '700' }}>{title}</Txt>
        {children}
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: '기출 분석' }} />
      <View style={{ flex: 1 }}>
        <Screen>
        {viewLevel === 'secondary' && <Txt variant="sub">지금은 초등 교육과정 A·B 분석만 있어요. 중등 교육학·전공은 다음 단계에서 넣을게요.</Txt>}
        {data.loading && !a ? (
          <ActivityIndicator color={colors.brand} />
        ) : !a ? (
          <Txt variant="sub">{data.error ? data.error.message : '기출 분석을 만드는 중이에요. 잠시 뒤에 다시 열어 주세요.'}</Txt>
        ) : (
          <>
            <Txt variant="sub" style={{ fontSize: 12.5 }}>
              {a.years[0]}~{a.years[a.years.length - 1]}학년도 초등 교육과정 A·B {a.questions.length}문항을 교육과정 원문과 자동으로 이었어요. 참고용이에요 (기준 {a.built}).
            </Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {(
                [
                  ['text', '형광펜 원문'],
                  ['stats', '통계'],
                  ['map', '출제 지도'],
                  ['terms', '핵심어'],
                  ['gaps', '안 나온 곳'],
                ] as [Tab, string][]
              ).map(([k, l]) => (
                <Chip key={k} label={l} selected={tab === k} onPress={() => setTab(k)} />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {subjects.map((s) => (
                <Chip key={s} label={s} selected={subj === s} onPress={() => setSubject(s)} />
              ))}
            </ScrollView>
            {body()}
          </>
        )}
        </Screen>
        <Watermark />
      </View>
    </>
  );
}

/** 임용몽땅 워터마크 (2026-11-24 사용자 요청): 화면 위에 옅게 겹쳐 놓고 터치는 아래로 통과 */
function Watermark() {
  const { colors } = useTheme();
  const rows = Array.from({ length: 14 });
  const cols = Array.from({ length: 5 });
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <View
        style={{ position: 'absolute', top: -120, left: -160, right: -160, bottom: -120, transform: [{ rotate: '-24deg' }], justifyContent: 'space-around' }}
      >
        {rows.map((_, r) => (
          <View key={r} style={{ flexDirection: 'row', justifyContent: 'space-around', marginLeft: r % 2 ? 90 : 0 }}>
            {cols.map((__, c) => (
              <Txt key={c} style={{ fontSize: 20, fontWeight: '700', color: colors.text, opacity: 0.06 }}>
                임용몽땅
              </Txt>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const sumv = (o: Record<string, number> | undefined) => Object.values(o ?? {}).reduce((x, y) => x + y, 0);
