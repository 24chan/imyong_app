import { Gate } from '../features/study/Gate';
import { BlankBar, BlankScope, BlankText, useBlank } from '../features/study/Blank';
import { buildVocab } from '../features/study/keywords';
import { getContentSystem } from '../data/contentSystem';
import { router, Stack } from 'expo-router';
import { memo, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Chip, Screen, Segmented, Txt } from '../components/ui';
import { getAnalysis, getAnalysisSubject, highlight, Hit, Unit } from '../data/analysis';
import { useAsync } from '../data/useAsync';
import { useAppSettings } from '../store/AppSettings';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

// 기출 분석 (2026-11-24 사용자 승인, 1단계: 초등 교육과정 A·B)
// 형광펜 원문 · 통계(칸별 비율, 연도×교과) · 출제 지도 · 핵심어 · 안 나온 곳
type Tab = 'text' | 'stats' | 'map' | 'terms' | 'gaps';
const SECTION_ORDER = ['성격', '목표', '성격·목표', '내용 체계', '성취기준', '교수·학습', '교수·학습 및 평가', '평가', '앞부분'];

function ExamAnalysisScreenInner() {
  const blank = useBlank();
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
  const hitsOf = (id: number) => sd.data?.hits[String(id)] ?? NONE;
  const cs = useAsync(() => getContentSystem(), []);
  const vocab = useMemo(() => {
    const s = cs.data?.subjects.find((x) => x.subject === subj);
    return s ? buildVocab(s) : null;
  }, [cs.data, subj]);
  const [era, setEra] = useState<'2022' | '2015'>('2022');
  const [openId, setOpenId] = useState<number | null>(null);
  const [mapW, setMapW] = useState(320); // 출제 지도 칸 줄 너비(한 줄에 몇 칸 들어가는지)
  useEffect(() => setOpenId(null), [subj, era, tab]);


  // 2026-11-28: 형광펜 원문 칩·출제 지도 문항 → 한눈에 보기 화면(지문 왼쪽·물음 오른쪽), 거기서 문제지 전체
  const openQuestion = useCallback((h: Hit) => {
    setOpenId(null);
    router.push({ pathname: '/exam-question', params: { y: String(h.y), p: h.p, n: String(h.n) } });
  }, []);
  const toggleUnit = useCallback((id: number) => setOpenId((o) => (o === id ? null : id)), []);

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
                {bySec.get(s)!.map((u) => <UnitCard key={u.id} u={u} hs={hitsOf(u.id)} open={openId === u.id} onToggle={toggleUnit} onExam={openQuestion} />)}
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
          <BlankBar blank={blank} scope={`ana/${subj}`} />
          {std.length === 0 && <Txt variant="sub">성취기준을 찾지 못했어요.</Txt>}
          {areas.map((ar) => {
            // 2026-11-28 사용자 요청: 팝업 대신 누른 칸이 있는 줄 바로 밑에 내용을 펼침
            const list = std.filter((u) => (u.area || '영역') === ar);
            const per = Math.max(1, Math.floor((mapW + 4) / (54 + 4)));
            const rowsOf: Unit[][] = [];
            for (let i = 0; i < list.length; i += per) rowsOf.push(list.slice(i, i + per));
            return (
              <Card key={ar} title={ar}>
                <View onLayout={(e) => setMapW(e.nativeEvent.layout.width)} style={{ gap: 4 }}>
                  {rowsOf.map((row, ri) => (
                    <View key={ri} style={{ gap: 4 }}>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {row.map((u) => {
                          const n = cnt(u);
                          return (
                            <Pressable
                              key={u.id}
                              onPress={() => setOpenId((o) => (o === u.id ? null : u.id))}
                              accessibilityLabel={`${u.code} ${n}회`}
                              accessibilityState={{ expanded: openId === u.id }}
                              style={{ width: 54, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: n ? colors.cat.coral.fg : colors.surface, opacity: n ? 0.3 + 0.7 * (n / max) : 1, borderWidth: openId === u.id ? 2 : 0, borderColor: colors.text }}
                            >
                              <Txt style={{ fontSize: 10, fontWeight: '700', color: n ? colors.background : colors.textSub }}>{u.code.replace(/[[\]]/g, '')}</Txt>
                            </Pressable>
                          );
                        })}
                      </View>
                      {sel && row.some((u) => u.id === sel.id) && (
                        <View style={{ marginTop: 4, marginBottom: 6, padding: space.md, gap: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Txt style={{ flex: 1, fontSize: 15, fontWeight: '700' }}>
                              {sel.code} · {cnt(sel)}회 나옴
                            </Txt>
                            <Pressable onPress={() => setOpenId(null)} accessibilityRole="button" accessibilityLabel="접기" hitSlop={10}>
                              <Txt style={{ fontSize: 13, fontWeight: '700', color: colors.textSub }}>접기 ▲</Txt>
                            </Pressable>
                          </View>
                          <BlankScope blank={blank} scope={`ana/${subj}`} vocab={vocab}>
                            <BlankText text={sel.text.split(' ▶ ')[0]} size={15} group={sel.area || '기타'} />
                          </BlankScope>
                          {sel.text.includes(' ▶ ') && (
                            <Txt variant="sub" style={{ fontSize: 13, lineHeight: 20 }}>
                              {sel.text.split(' ▶ ').slice(1).join(' ')}
                            </Txt>
                          )}
                          {hitsOf(sel.id).length ? (
                            // 2026-11-28: 형광펜 원문처럼 문항 단추만, 눌러야 그 문항 화면(필기)으로
                            <View style={{ gap: 6 }}>
                              <Txt variant="sub" style={{ fontSize: 12.5 }}>나온 문항 (누르면 그 문항 크게·필기)</Txt>
                              <HitChips hs={hitsOf(sel.id)} onExam={openQuestion} />
                            </View>
                          ) : (
                            <Txt variant="sub">아직 기출에 안 나왔어요.</Txt>
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </Card>
            );
          })}
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
        <BlankBar blank={blank} scope={`ana/${subj}`} />
        <BlankScope blank={blank} scope={`ana/${subj}`} vocab={vocab}>
          <Card title={`최근 5년 안 나온 성취기준 (2022 개정) · ${un.length}개`}>
            {un.length === 0 && <Txt variant="sub">없어요.</Txt>}
            {un.slice(0, 80).map((x) => (
              <View key={x.id} style={{ gap: 2 }}>
                <Txt style={{ fontSize: 13, fontWeight: '700', color: colors.cat.blue.fg }}>{x.code}</Txt>
                <BlankText text={x.text.split(' ▶ ')[0]} group={x.area || '기타'} />
              </View>
            ))}
          </Card>
        </BlankScope>
        {/* 2026-11-24 검토 반영: '2022 새 용어'는 자동 추출 잡음이 많아 1차 배포에서 숨김(데이터는 그대로 둠) */}
      </>
    );
  };


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


// 2026-11-28: 경인교대 인증 회원·운영자만 (lib/access.ts)
export default function ExamAnalysisScreen() {
  return (
    <Gate feature="exam-analysis">
      <ExamAnalysisScreenInner />
    </Gate>
  );
}

/** 카드 틀 (컴포넌트 밖에 두어 다시 그릴 때 안의 상태가 지워지지 않게) */
function Card({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.background, borderRadius: radius.xl, padding: space.lg, gap: space.sm }}>
      <Txt style={{ fontSize: 16, fontWeight: '700' }}>{title}</Txt>
      {children}
    </View>
  );
}

const NONE: Hit[] = [];
const LEVEL = 'elementary' as const;

function HitChips({ hs, onExam }: { hs: Hit[]; onExam: (h: Hit) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {[...hs].sort((x, y) => y.y - x.y || x.n - y.n).map((h) => (
        <Pressable
          key={`${h.y}${h.p}${h.n}`}
          onPress={() => onExam(h)}
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
}

/** 형광펜 원문 칸 — memo: 다른 칸을 펼쳐도 이 칸의 형광펜 계산을 다시 하지 않음 */
const UnitCard = memo(function UnitCard({ u, hs, open, onToggle, onExam }: { u: Unit; hs: Hit[]; open: boolean; onToggle: (id: number) => void; onExam: (h: Hit) => void }) {
  const { colors } = useTheme();
  const segs = useMemo(() => highlight(u.text, hs), [u.text, hs]);
  const times = useMemo(() => new Set(hs.map((h) => `${h.y}${h.p}${h.n}`)).size, [hs]);
  return (
    <Pressable onPress={() => onToggle(u.id)} style={{ paddingVertical: space.md, paddingHorizontal: space.lg, gap: 6, borderTopWidth: 1, borderTopColor: colors.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {!!u.code && <Txt style={{ fontSize: 12.5, fontWeight: '700', color: colors.cat.blue.fg }}>{u.code}</Txt>}
        {!!u.area && <Txt variant="sub" style={{ fontSize: 12 }}>{u.area}</Txt>}
        <View style={{ flex: 1 }} />
        {hs.length > 0 && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.cat.coral.bg }}>
            <Txt style={{ fontSize: 12, fontWeight: '700', color: colors.cat.coral.fg }}>{times}회</Txt>
          </View>
        )}
      </View>
      <Txt style={{ fontSize: 14.5, lineHeight: 22 }} numberOfLines={open ? undefined : 4}>
        {segs.map((seg, i) => (
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
          <Txt variant="sub" style={{ fontSize: 12.5 }}>나온 문항 (누르면 그 문항 크게)</Txt>
          <HitChips hs={hs} onExam={onExam} />
        </View>
      )}
    </Pressable>
  );
});
