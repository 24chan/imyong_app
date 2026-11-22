import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Chip, PrimaryButton, Txt } from '../../components/ui';
import { getPractice, PRACTICE_UNIVS, PracticeSchool, sessionLabel } from '../../data/practice';
import { regionByCode } from '../../data/regions';
import { useAsync } from '../../data/useAsync';
import { useAppSettings } from '../../store/AppSettings';
import { useWriterLabels } from '../community/parts';
import { toggleScrap, useIsScrapped } from '../../store/schoolScraps';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { SchoolInfoBox } from '../region/SchoolInfoBox';
import { FoundMark } from '../region/SchoolMap';
import { PracticeMap } from './PracticeMap';
import { PracticeReviews } from './PracticeReviews';
import { PracticeTipButton } from './PracticeTipButton';
import { openTransitRoute } from './route';

// 실습초 탭 (2026-11-22 사용자 승인): 교대 → 학년도 → 실습(학기·종류, 학년을 알면 학년) → 지도 + 목록 + 학교 카드
// 누구나 모든 교대 목록을 볼 수 있음(공개 공지). 거리는 캠퍼스에서 직선거리, 대중교통 시간은 미리 구해 둔 값(있을 때)
type CampusMode = 'auto' | string;
type Row = PracticeSchool & { id: string; block: string; campus: string; d: number; min?: number };


export function PracticeTab() {
  const { colors } = useTheme();
  const { viewLevel } = useAppSettings();
  const { labels } = useWriterLabels();
  const [univ, setUniv] = useState<string>(PRACTICE_UNIVS[0].code);
  // 처음엔 내가 인증한 교대 (목록이 있을 때)
  const myUniv = labels?.find((v) => v.kind === 'school' && PRACTICE_UNIVS.some((u) => u.code === v.univCode))?.univCode ?? null;
  useEffect(() => {
    if (myUniv) setUniv(myUniv);
  }, [myUniv]);
  const data = useAsync(() => getPractice(univ), [univ]);
  const d = data.data;

  const years = useMemo(() => [...new Set((d?.sessions ?? []).map((s) => s.year))].sort((a, b) => b - a), [d]);
  const [year, setYear] = useState<number | null>(null);
  const sessions = useMemo(() => (d?.sessions ?? []).filter((s) => s.year === year).sort((a, b) => (a.grade ?? 9) - (b.grade ?? 9) || a.term - b.term), [d, year]);
  const [sid, setSid] = useState<string | null>(null);
  const session = sessions.find((s) => s.id === sid) ?? null;
  const [mode, setMode] = useState<CampusMode>('auto');
  const [area, setArea] = useState<'all' | string>('all');
  const [sort, setSort] = useState<'near' | 'name'>('near');
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => setYear(years[0] ?? null), [years]);
  useEffect(() => setArea('all'), [univ]);
  useEffect(() => setSid(sessions[0]?.id ?? null), [sessions]);
  useEffect(() => {
    setPicked(null);
    setMode(session?.grade && d?.grade_campus[String(session.grade)] ? d.grade_campus[String(session.grade)] : 'auto');
  }, [session, d]);

  const campusOf = (block: string, campus?: string) => {
    if (mode !== 'auto') return mode;
    if (!d) return block;
    if (campus && d.campuses[campus]) return campus;
    return d.campuses[block] ? block : Object.keys(d.campuses)[0];
  };
  const rows: Row[] = useMemo(() => {
    if (!d || !session) return [];
    const r = session.schools
      .filter((x) => area === 'all' || x.block === area)
      .map((x) => {
        const s = d.schools[x.id];
        const campus = campusOf(x.block, x.campus);
        return { ...s, id: x.id, block: x.block, campus, d: s.km[campus] ?? 0, min: s.transit_min?.[campus] };
      });
    return r.sort((a, b) => (sort === 'near' ? (a.min ?? a.d * 4) - (b.min ?? b.d * 4) : a.short.localeCompare(b.short, 'ko')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, session, area, sort, mode]);
  const blocks = useMemo(() => [...new Set(session?.schools.map((x) => x.block) ?? [])], [session]);
  const sel = rows.find((r) => r.id === picked) ?? null;

  if (data.loading) return <ActivityIndicator color={colors.brand} />;
  if (data.error) return <Txt color="down">{data.error.message}</Txt>;
  if (!d) return <Txt variant="sub">실습학교 목록을 준비 중이에요.</Txt>;

  return (
    <View style={{ gap: space.md }}>
      {viewLevel === 'secondary' && (
        <Txt variant="sub" style={{ fontSize: 12 }}>
          사범대 교육실습은 학교마다 신청 방식이 달라(출신 학교 실습 등) 공통 목록이 없어서, 지금은 교대 실습초 목록만 있어요.
        </Txt>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {PRACTICE_UNIVS.map((u) => (
          <Chip key={u.code} label={u.name} selected={univ === u.code} onPress={() => setUniv(u.code)} />
        ))}
        {years.map((y) => (
          <Chip key={y} label={`${y}학년도`} selected={year === y} onPress={() => setYear(y)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {sessions.map((s) => (
          <Chip key={s.id} label={sessionLabel(s)} selected={sid === s.id} onPress={() => setSid(s.id)} />
        ))}
      </View>
      {session && (
        <Txt variant="sub" style={{ fontSize: 12 }}>
          {sessionLabel(session, true)}
          {session.period ? ` · ${session.period}` : ''} · 학교 {session.schools.length}곳
        </Txt>
      )}
      {session && session.schools.length === 0 && (
        <View style={{ gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface }}>
          <Txt>이 실습의 학교 목록은 아직 없어요.</Txt>
          <Txt variant="sub">학사공지 캡처·사진·PDF·주소 무엇이든 보내 주시면 확인해서 올릴게요.</Txt>
          <PracticeTipButton univ={d.name} year={session.year} label="이 실습 목록 제보하기" />
        </View>
      )}
      {Object.keys(d.campuses).length > 1 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Chip label="가까운 캠퍼스 기준" selected={mode === 'auto'} onPress={() => setMode('auto')} />
        {Object.entries(d.campuses).map(([k, c]) => (
          <Chip key={k} label={`${c.name.replace('캠퍼스', '캠')} 기준`} selected={mode === k} onPress={() => setMode(k)} />
        ))}
      </View>}
      {(blocks.length > 1 || (session?.schools.length ?? 0) > 5) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {blocks.length > 1 && <Chip label={`전체 ${session?.schools.length ?? 0}`} selected={area === 'all'} onPress={() => setArea('all')} />}
          {blocks.length > 1 && blocks.map((b) => (
            <Chip key={b} label={`${regionByCode(b)?.shortName ?? b} ${session?.schools.filter((x) => x.block === b).length}`} selected={area === b} onPress={() => setArea(b)} />
          ))}
          <Chip label={sort === 'near' ? '↕ 가까운 순' : '↕ 이름순'} selected={false} onPress={() => setSort(sort === 'near' ? 'name' : 'near')} />
        </View>
      )}

      {rows.length > 0 && (
        <PracticeMap
          points={rows.map((r) => ({ id: r.id, name: r.short, lat: r.lat, lng: r.lng, found: r.found }))}
          campuses={Object.entries(d.campuses).map(([id, c]) => ({ id, name: c.name, lat: c.lat, lng: c.lng }))}
          picked={picked}
          onPick={setPicked}
        />
      )}
      {rows.length > 0 && <Txt variant="sub" style={{ fontSize: 12 }}>■ 캠퍼스 · ● 실습학교 · 두 손가락으로 확대하면 학교 이름이 보여요</Txt>}

      {sel && <SchoolCard row={sel} campuses={d.campuses} year={session?.year ?? new Date().getFullYear()} onClose={() => setPicked(null)} />}

      {rows.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => setPicked(r.id === picked ? null : r.id)}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}
        >
          <FoundMark found={r.found} size={10} />
          <View style={{ flex: 1 }}>
            <Txt style={{ fontWeight: '700' }}>{r.short}</Txt>
            <Txt variant="sub" style={{ fontSize: 12 }}>
              {regionByCode(r.region)?.shortName} {r.sigungu}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt style={{ fontWeight: '700' }}>{r.min ? `약 ${r.min}분` : `${r.d}km`}</Txt>
            <Txt variant="sub" style={{ fontSize: 11 }}>
              {d.campuses[r.campus]?.name.replace('캠퍼스', '캠')}에서{r.min ? ` · ${r.d}km` : ' 직선'}
            </Txt>
          </View>
        </Pressable>
      ))}
      <PracticeTipButton univ={d.name} year={year} label="실습학교 목록 제보 (사진·PDF·주소 무엇이든)" />
      {session && session.schools.length > 0 && (
        <Txt variant="sub" style={{ fontSize: 12 }}>
          출처: {session.source.by} 「{session.source.title}」({session.source.date}). 학교 이름만 옮겼어요(신청 인원은 공지 시점 값이라 뺐어요). 거리는 직선거리, 학교 위치는 공공데이터포털 기준.
        </Txt>
      )}
    </View>
  );
}

function SchoolCard({ row, campuses, year, onClose }: { row: Row; campuses: Record<string, { name: string; lat: number; lng: number }>; year: number; onClose: () => void }) {
  const { colors } = useTheme();
  const scrapped = useIsScrapped(row);
  const campus = campuses[row.campus];
  return (
    <View style={{ gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.cat.teal.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Txt style={{ fontWeight: '800', fontSize: 16 }}>{row.name}</Txt>
          <Txt variant="sub">
            {regionByCode(row.region)?.shortName} {row.sigungu}
          </Txt>
        </View>
        <Pressable
          onPress={() => toggleScrap({ region: row.region, name: row.name, sigungu: row.sigungu, lat: row.lat, lng: row.lng, found: row.found, kind: 'e' })}
          accessibilityRole="button"
          accessibilityLabel={scrapped ? '스크랩 해제' : '스크랩'}
          hitSlop={10}
        >
          <Ionicons name={scrapped ? 'star' : 'star-outline'} size={24} color={scrapped ? colors.accent : colors.textSub} />
        </Pressable>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="닫기" hitSlop={10}>
          <Ionicons name="close" size={22} color={colors.textSub} />
        </Pressable>
      </View>
      {Object.entries(campuses).map(([k, c]) => (
        <Txt key={k}>
          {c.name}에서 직선 {row.km[k]}km{row.transit_min?.[k] ? ` · 대중교통 약 ${row.transit_min[k]}분(평일 기준)` : ''}
        </Txt>
      ))}
      {!Object.keys(row.transit_min ?? {}).length && <Txt variant="sub" style={{ fontSize: 12 }}>대중교통 시간은 준비 중이에요. 아래 버튼으로 카카오맵에서 바로 볼 수 있어요.</Txt>}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton label={`${campus?.name.replace('캠퍼스', '캠')}에서 길찾기`} onPress={() => campus && openTransitRoute(row, { name: campus.name, lat: campus.lat, lng: campus.lng })} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="내 위치에서" variant="ghost" onPress={() => openTransitRoute(row)} />
        </View>
      </View>
      <SchoolInfoBox region={row.region} name={row.name} kind="e" />
      <PracticeReviews school={row.id} defaultYear={year} />
    </View>
  );
}
