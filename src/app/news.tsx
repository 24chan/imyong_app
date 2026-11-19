import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ViewModeBanner } from '../components/ModeToggle';
import { Chip, Screen, Txt } from '../components/ui';
import { getTeacherJobs, isOpen, jobsFor } from '../data/jobs';
import { getNotices, getRegionSummaries } from '../data/repository';
import { useAsync } from '../data/useAsync';
import { JobBoard, JobTipButton } from '../features/news/JobList';
import { NOTICE_LABEL, NoticeBoard, NoticeRow } from '../features/news/NoticeList';
import { PrivateLink } from '../features/news/PrivateLink';
import { useRegionFilters } from '../features/region/useRegionFilters';
import { useAppSettings, useToday } from '../store/AppSettings';
import { space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import type { NoticeType, RegionSummary } from '../types/data';

type Filter = NoticeType | 'all' | 'jobs';
const TYPES: Filter[] = ['all', 'jobs', 'plan', 'receipt', 'first_pass', 'final_pass', 'prelim', 'private'];

// 임용 소식 전체: 교육청 공고 모음 (원문 링크). 숫자는 승인된 앱 데이터에서
export default function NewsScreen() {
  const { colors } = useTheme();
  const { settings } = useAppSettings();
  const f = useRegionFilters();
  const [onlyMine, setOnlyMine] = useState(settings.regionCodes.length > 0);
  const params = useLocalSearchParams<{ type?: string }>();
  const [type, setType] = useState<Filter>(params.type === 'jobs' ? 'jobs' : 'all');
  const today = useToday();
  const jobsAll = useAsync(() => getTeacherJobs(), []);

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
  const list = type === 'jobs' ? [] : (notices.data ?? []).filter(
    (x) => (!onlyMine || mine.includes(x.region)) && (type === 'all' || x.docType === type),
  );
  // 학교별(사립·법인) 정교사 채용: 마감 전 먼저
  const jobs = jobsFor(jobsAll.data ?? [], f.viewLevel, onlyMine ? mine : undefined).sort(
    (a, b) => Number(isOpen(b, today)) - Number(isOpen(a, today)),
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
          <Chip key={t} label={t === 'all' ? '전체' : t === 'jobs' ? '학교별 채용' : NOTICE_LABEL[t]} selected={type === t} onPress={() => setType(t)} />
        ))}
      </View>
      {type === 'private' && <PrivateLink />}
      {type === 'jobs' && (
        <>
          <Txt variant="sub">사립·법인 학교가 직접 뽑는 정교사(신규교사) 공고예요. 나라일터에 올라온 공고를 매일 모으고, 제보도 받아요. 누르면 원문이 열려요.</Txt>
          {jobsAll.loading && <ActivityIndicator color={colors.brand} />}
          {!jobsAll.loading && jobs.length === 0 && <Txt variant="sub">조건에 맞는 공고가 아직 없어요.</Txt>}
          {jobs.length > 0 && <JobBoard jobs={jobs} title={`학교별 채용 · ${jobs.filter((j) => isOpen(j, today)).length}건 모집 중`} />}
          <JobTipButton level={f.viewLevel} />
        </>
      )}
      {type !== 'jobs' && notices.loading && <ActivityIndicator color={colors.brand} />}
      {type !== 'jobs' && !notices.loading && list.length === 0 && (
        <Txt variant="sub">
          {onlyMine && mine.length === 0 ? '설정에서 관심 지역을 고르면 그 지역 소식만 볼 수 있어요.' : '아직 모인 소식이 없어요.'}
        </Txt>
      )}
      {list.length > 0 && (
        <NoticeBoard title={`${type === 'all' || type === 'jobs' ? '전체' : NOTICE_LABEL[type]} · ${list.length}건`}>
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
      {type === 'all' && jobs.some((j) => isOpen(j, today)) && (
        <JobBoard
          jobs={jobs.filter((j) => isOpen(j, today)).slice(0, 5)}
          title="학교별 채용 · 모집 중"
          footer={
            <Txt color="brand" style={{ fontWeight: '800', padding: space.lg, paddingTop: space.sm }} onPress={() => setType('jobs')}>
              전체 보기 ›
            </Txt>
          }
        />
      )}
    </Screen>
  );
}
