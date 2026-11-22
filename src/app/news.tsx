import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { markNewsSeen, useSeenNews } from '../store/seenNews';
import { ActivityIndicator, View } from 'react-native';
import { ViewModeBanner } from '../components/ModeToggle';
import { Chip, PrimaryButton, Screen, Segmented, Txt } from '../components/ui';
import { getTeacherJobs, isOpen, jobsFor } from '../data/jobs';
import { getNotices, getRegionSummaries } from '../data/repository';
import { useAsync } from '../data/useAsync';
import { JobBoard, JobTipButton, MoreJobLinks } from '../features/news/JobList';
import { NOTICE_LABEL, NoticeBoard, NoticeRow } from '../features/news/NoticeList';
import { PrivateLink } from '../features/news/PrivateLink';
import { useRegionFilters } from '../features/region/useRegionFilters';
import { useAppSettings, useToday } from '../store/AppSettings';
import { byDeadline, removeClosedJobs, useSavedJobs } from '../store/savedJobs';
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
  const saved = useSavedJobs();
  const [jobSort, setJobSort] = useState<'deadline' | 'recent'>('deadline');
  const [onlySaved, setOnlySaved] = useState(false);

  const notices = useAsync(() => getNotices(f.viewLevel, 300), [f.viewLevel]);
  // B-8: 들어올 때 안 본 공고를 기억해 점으로 보여 주고, 모두 '본 것'으로 표시
  const seen = useSeenNews();
  const unreadAtOpen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!seen.ready || !notices.data || unreadAtOpen.current) return;
    const urls = notices.data.map((x) => x.url);
    unreadAtOpen.current = new Set(seen.init ? urls.filter((u) => !seen.urls.has(u)) : []);
    markNewsSeen(urls);
  }, [seen, notices.data]);
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
  // 학교별(사립·법인) 정교사 채용: 기본은 마감 가까운 순
  const jobs = jobsFor(jobsAll.data ?? [], f.viewLevel, onlyMine ? mine : undefined).sort(
    jobSort === 'deadline' ? byDeadline(today) : (a, b) => Number(isOpen(b, today)) - Number(isOpen(a, today)),
  );
  // 저장한 공고: 지역·학교급 필터와 상관없이 모두 (내가 고른 것이라서)
  const savedSorted = [...saved].sort(byDeadline(today));
  const savedClosed = saved.filter((j) => !isOpen(j, today)).length;
  const shownJobs = onlySaved ? savedSorted : jobs;

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
          <Txt variant="sub">사립·법인 학교가 직접 뽑는 정교사(신규교사) 공고예요. 나라일터와 서울·경기 교육청 채용 게시판을 매일 모으고, 제보도 받아요. 누르면 원문이 열려요.</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Chip label="모든 공고" selected={!onlySaved} onPress={() => setOnlySaved(false)} />
            <Chip label={`저장한 공고 ${saved.length}`} selected={onlySaved} onPress={() => setOnlySaved(true)} />
          </View>
          {!onlySaved && (
            <Segmented
              compact
              options={[
                { value: 'deadline', label: '마감 가까운 순' },
                { value: 'recent', label: '최신순' },
              ]}
              value={jobSort}
              onChange={setJobSort}
            />
          )}
          {jobsAll.loading && !onlySaved && <ActivityIndicator color={colors.brand} />}
          {!jobsAll.loading && !onlySaved && jobs.length === 0 && <Txt variant="sub">조건에 맞는 공고가 아직 없어요.</Txt>}
          {onlySaved && saved.length === 0 && (
            <Txt variant="sub">공고 오른쪽의 책갈피를 누르면 여기에 모여요. 저장한 공고는 이 휴대폰에만 남아요.</Txt>
          )}
          {shownJobs.length > 0 && (
            <JobBoard
              jobs={shownJobs}
              title={`${onlySaved ? '저장한 공고' : '학교별 채용'} · ${shownJobs.filter((j) => isOpen(j, today)).length}건 모집 중`}
            />
          )}
          {onlySaved && savedClosed > 0 && (
            <PrimaryButton label={`마감 지난 공고 ${savedClosed}건 지우기`} variant="ghost" onPress={() => removeClosedJobs(today)} />
          )}
          {!onlySaved && <JobTipButton level={f.viewLevel} />}
          {!onlySaved && <MoreJobLinks />}
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
              unread={!!unreadAtOpen.current?.has(x.url)}
              last={i === list.length - 1}
            />
          ))}
        </NoticeBoard>
      )}
      {type === 'all' && jobs.some((j) => isOpen(j, today)) && (
        <JobBoard
          jobs={jobs.filter((j) => isOpen(j, today)).sort(byDeadline(today)).slice(0, 5)}
          title="학교별 채용 · 마감 가까운 순"
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
