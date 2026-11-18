import { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ViewModeBanner } from '../components/ModeToggle';
import { Chip, Screen, Txt } from '../components/ui';
import { getNotices, getRegionSummaries } from '../data/repository';
import { useAsync } from '../data/useAsync';
import { NOTICE_LABEL, NoticeBoard, NoticeRow } from '../features/news/NoticeList';
import { useRegionFilters } from '../features/region/useRegionFilters';
import { useAppSettings } from '../store/AppSettings';
import { space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import type { NoticeType, RegionSummary } from '../types/data';

const TYPES: (NoticeType | 'all')[] = ['all', 'plan', 'receipt', 'first_pass', 'final_pass', 'prelim', 'private'];

// 임용 소식 전체: 교육청 공고 모음 (원문 링크). 숫자는 승인된 앱 데이터에서
export default function NewsScreen() {
  const { colors } = useTheme();
  const { settings } = useAppSettings();
  const f = useRegionFilters();
  const [onlyMine, setOnlyMine] = useState(settings.regionCodes.length > 0);
  const [type, setType] = useState<NoticeType | 'all'>('all');

  const notices = useAsync(() => getNotices(f.viewLevel, 300), [f.viewLevel]);
  const years = useMemo(() => [...new Set((notices.data ?? []).map((x) => x.year))].slice(0, 4), [notices.data]);
  const sums = useAsync(
    () =>
      f.ready && !f.isSecondary
        ? Promise.all(years.map((y) => getRegionSummaries(f.query, y)))
        : Promise.resolve([] as RegionSummary[][]),
    [f.ready, f.query, years.join(',')],
  );
  const byKey = new Map<string, RegionSummary>();
  (sums.data ?? []).flat().forEach((s) => byKey.set(`${s.year}:${s.region}`, s));

  const mine = settings.regionCodes;
  const list = (notices.data ?? []).filter(
    (x) => (!onlyMine || mine.includes(x.region)) && (type === 'all' || x.docType === type),
  );

  return (
    <Screen>
      <ViewModeBanner />
      <Txt variant="sub">
        교육청 게시판에 올라온 임용 공고를 매일 모아요. 누르면 원문이 열려요. 숫자는 검수를 마친 자료만 보여줘요.
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Chip label="전체 지역" selected={!onlyMine} onPress={() => setOnlyMine(false)} />
        <Chip label="관심 지역" selected={onlyMine} onPress={() => setOnlyMine(true)} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {TYPES.map((t) => (
          <Chip key={t} label={t === 'all' ? '전체' : NOTICE_LABEL[t]} selected={type === t} onPress={() => setType(t)} />
        ))}
      </View>
      {notices.loading && <ActivityIndicator color={colors.brand} />}
      {!notices.loading && list.length === 0 && (
        <Txt variant="sub">
          {onlyMine && mine.length === 0 ? '설정에서 관심 지역을 고르면 그 지역 소식만 볼 수 있어요.' : '아직 모인 소식이 없어요.'}
        </Txt>
      )}
      {list.length > 0 && (
        <NoticeBoard title={`${type === 'all' ? '전체' : NOTICE_LABEL[type]} · ${list.length}건`}>
          {list.map((x, i) => (
            <NoticeRow
              key={x.url}
              item={x}
              summary={byKey.get(`${x.year}:${x.region}`)}
              highlight={mine.includes(x.region)}
              last={i === list.length - 1}
            />
          ))}
        </NoticeBoard>
      )}
    </Screen>
  );
}
