import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { ViewModeBanner } from '../components/ModeToggle';
import { Chip, Screen, Txt } from '../components/ui';
import { REGIONS } from '../data/regions';
import { getNotices } from '../data/repository';
import { useAsync } from '../data/useAsync';
import { NoticeBoard, NoticeRow } from '../features/news/NoticeList';
import { useRegionFilters } from '../features/region/useRegionFilters';
import { useAppSettings } from '../store/AppSettings';
import { space } from '../theme/tokens';

// 2차 시험 (2026-11-22): 2차 방식(면접·수업실연·영어 등)은 지역마다 다르고 시행계획 공고와 1차 합격 발표에 실려 있어서,
// 지역별로 그 공고를 모아 앱 안에서 바로 보게 함 (공고문 그림 + 아래 원문 링크 = 임용 소식과 같은 화면)
export default function SecondExamScreen() {
  const { settings } = useAppSettings();
  const f = useRegionFilters();
  const notices = useAsync(() => getNotices(f.viewLevel, 300), [f.viewLevel]);
  const first = settings.regionCodes[0] ?? 'seoul';
  const [region, setRegion] = useState(first);
  const order = useMemo(() => [...settings.regionCodes, ...REGIONS.map((r) => r.code).filter((c) => !settings.regionCodes.includes(c))], [settings.regionCodes]);
  const list = useMemo(
    () => (notices.data ?? []).filter((n) => n.region === region && (n.docType === 'plan' || n.docType === 'first_pass')).slice(0, 8),
    [notices.data, region],
  );

  return (
    <>
      <Stack.Screen options={{ title: '2차 시험' }} />
      <Screen>
        <ViewModeBanner />
        <Txt variant="sub">
          2차(면접·수업실연·수업나눔·영어 등) 방식과 날짜는 지역마다 달라요. 시행계획 공고와 1차 합격 발표에 자세히 나와요. 누르면 앱 안에서 공고문을 보고, 아래에서 원문·첨부 파일을 받을 수 있어요.
        </Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {order.map((c) => (
            <Chip key={c} label={REGIONS.find((r) => r.code === c)?.shortName ?? c} selected={region === c} onPress={() => setRegion(c)} />
          ))}
        </ScrollView>
        {notices.loading && !notices.data ? (
          <ActivityIndicator />
        ) : list.length === 0 ? (
          <Txt variant="sub">이 지역은 아직 모인 공고가 없어요. 교육청 공고가 올라오면 자동으로 들어와요.</Txt>
        ) : (
          <View style={{ gap: space.sm }}>
            <NoticeBoard title={`${REGIONS.find((r) => r.code === region)?.shortName} · 시행계획·1차 합격 발표`}>
              {list.map((x, i) => (
                <NoticeRow key={x.url} item={x} last={i === list.length - 1} />
              ))}
            </NoticeBoard>
          </View>
        )}
      </Screen>
    </>
  );
}
