import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Card, PrimaryButton, Screen, Segmented, Txt } from '../components/ui';
import { regionByCode } from '../data/regions';
import { getSchoolMeta, getSchools } from '../data/repository';
import { useAsync } from '../data/useAsync';
import { PrivateLink } from '../features/news/PrivateLink';
import { FoundMark, SchoolMap, SchoolMapHandle } from '../features/region/SchoolMap';
import type { Level } from '../store/AppSettings';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import type { School, SchoolFound, SchoolKind } from '../types/data';

const KIND_LABEL: Record<SchoolKind, string> = { e: '초', m: '중', h: '고' };
const FOUND_LABEL: Record<SchoolFound, string> = { p: '공립', s: '사립', n: '국립' };
const LIST_STEP = 30;

type SecFilter = 'mh' | 'm' | 'h';
type FoundFilter = 'all' | SchoolFound;

// 지역 학교 지도: 공립·사립·국립 학교 위치를 색과 모양으로 구분
export default function SchoolsScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ region: string; level: Level }>();
  const level: Level = params.level === 'secondary' ? 'secondary' : 'elementary';
  const region = regionByCode(params.region);
  const data = useAsync(() => getSchools(params.region), [params.region]);
  const meta = useAsync(() => getSchoolMeta(), []);

  const [sec, setSec] = useState<SecFilter>('mh');
  const [found, setFound] = useState<FoundFilter>('all');
  const [selected, setSelected] = useState<School | null>(null);
  const [listN, setListN] = useState(LIST_STEP);
  const mapRef = useRef<SchoolMapHandle>(null);

  // 모드에 맞는 학교급 (초등 모드 → 초등학교, 중등 모드 → 중·고)
  const levelSchools = useMemo(() => {
    const all = data.data ?? [];
    if (level === 'elementary') return all.filter((s) => s.kind === 'e');
    return all.filter((s) => (sec === 'mh' ? s.kind !== 'e' : s.kind === sec));
  }, [data.data, level, sec]);
  const shown = useMemo(
    () => (found === 'all' ? levelSchools : levelSchools.filter((s) => s.found === found)),
    [levelSchools, found],
  );
  const count = (f: SchoolFound) => levelSchools.filter((s) => s.found === f).length;
  // 목록: 사립·국립을 먼저 (공립은 수가 많아 지도 위주로)
  const listed = useMemo(() => {
    const src = found === 'all' ? levelSchools.filter((s) => s.found !== 'p') : shown;
    return [...src].sort((a, b) => a.sigungu.localeCompare(b.sigungu, 'ko') || a.name.localeCompare(b.name, 'ko'));
  }, [levelSchools, shown, found]);

  const title = `${region?.shortName ?? ''} 학교 지도`;
  const filters: { value: FoundFilter; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'p', label: `공립 ${count('p')}` },
    { value: 's', label: `사립 ${count('s')}` },
    ...(count('n') ? [{ value: 'n' as const, label: `국립 ${count('n')}` }] : []),
  ];

  const pick = (s: School) => {
    setSelected(s);
    mapRef.current?.focus(s);
  };

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Screen>
        {data.loading && !data.data ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: space.xl }} />
        ) : data.error ? (
          <Card>
            <Txt variant="heading">학교 위치를 불러오지 못했어요</Txt>
            <Txt variant="sub">인터넷 연결을 확인하고 다시 들어와 주세요. ({data.error.message})</Txt>
          </Card>
        ) : (
          <>
            <Txt variant="sub">
              {level === 'elementary' ? '초등학교' : '중·고등학교'} 위치예요. 사립학교 교사는 공립 임용시험과 따로 뽑아요(일부는
              교육청에 1차 시험 위탁).
            </Txt>

            <PrivateLink region={params.region} />

            {level === 'secondary' && (
              <Segmented
                compact
                options={[
                  { value: 'mh', label: '중·고 전체' },
                  { value: 'm', label: '중학교' },
                  { value: 'h', label: '고등학교' },
                ]}
                value={sec}
                onChange={(v) => {
                  setSec(v);
                  setSelected(null);
                }}
              />
            )}
            <Segmented
              compact
              options={filters}
              value={found}
              onChange={(v) => {
                setFound(v);
                setSelected(null);
                setListN(LIST_STEP);
              }}
            />

            <SchoolMap
              ref={mapRef}
              schools={shown}
              frameFrom={levelSchools}
              selected={selected}
              onSelect={setSelected}
              showSigungu={params.region !== 'sejong'}
            />

            {/* 범례 (색 + 모양) */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
              {(['p', 's', 'n'] as SchoolFound[])
                .filter((f) => count(f) > 0)
                .map((f) => (
                  <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <FoundMark found={f} />
                    <Txt variant="sub" color="text">
                      {FOUND_LABEL[f]} {count(f).toLocaleString()}곳
                    </Txt>
                  </View>
                ))}
            </View>

            {selected ? (
              <SchoolRow school={selected} highlight onPress={() => setSelected(null)} />
            ) : (
              <Txt variant="sub">점을 누르면 학교 이름이 보여요. + 로 확대한 뒤 끌어서 움직일 수 있어요.</Txt>
            )}

            <Card style={{ gap: 0, paddingVertical: space.sm }}>
              <Txt variant="heading" style={{ paddingVertical: space.sm }}>
                {found === 'all' ? '사립·국립 학교' : `${FOUND_LABEL[found]} 학교`} {listed.length}곳
              </Txt>
              {listed.length === 0 && <Txt variant="sub">해당하는 학교가 없어요.</Txt>}
              {listed.slice(0, listN).map((s) => (
                <SchoolRow key={`${s.name}-${s.lat}`} school={s} onPress={() => pick(s)} highlight={s === selected} />
              ))}
            </Card>
            {listed.length > listN && (
              <PrimaryButton label={`더 보기 (${listed.length - listN}곳 남음)`} variant="ghost" onPress={() => setListN((n) => n + LIST_STEP)} />
            )}

            <Txt variant="sub">
              출처: {meta.data?.source ?? '공공데이터포털 전국초중등학교위치표준데이터'}
              {meta.data?.updated ? ` · ${meta.data.updated} 기준` : ''} · 운영 중인 본교·분교
            </Txt>
          </>
        )}
      </Screen>
    </>
  );
}

function SchoolRow({ school: s, onPress, highlight }: { school: School; onPress: () => void; highlight?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${s.name}, ${FOUND_LABEL[s.found]}, ${s.sigungu}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingVertical: 11,
        paddingHorizontal: highlight ? space.md : 0,
        borderRadius: radius.md,
        borderBottomWidth: highlight ? 0 : 1,
        borderBottomColor: colors.line,
        borderWidth: highlight ? 1.5 : 0,
        borderColor: colors.brand,
        backgroundColor: highlight ? colors.background : 'transparent',
      }}
    >
      <FoundMark found={s.found} size={11} />
      <View style={{ flex: 1 }}>
        <Txt style={{ fontWeight: '700' }}>{s.name}</Txt>
        <Txt variant="sub">
          {FOUND_LABEL[s.found]} · {KIND_LABEL[s.kind]}등 · {s.sigungu || '—'}
        </Txt>
      </View>
      {!highlight && <Txt variant="sub">지도</Txt>}
    </Pressable>
  );
}
