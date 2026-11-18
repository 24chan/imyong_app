import { useEffect, useMemo, useState } from 'react';
import { getAvailableSubjects, getYears } from '../../data/repository';
import { useAsync } from '../../data/useAsync';
import { useAppSettings } from '../../store/AppSettings';

/** 지역·TO와 지역 비교에서 같이 쓰는 연도·과목 선택 */
export function useRegionFilters(initialYear?: number | null) {
  const { settings, viewLevel } = useAppSettings();
  const isSecondary = viewLevel === 'secondary';

  const years = useAsync(() => getYears(viewLevel), [viewLevel]);
  const subjects = useAsync(getAvailableSubjects, []);
  const latestYear = years.data?.[0] ?? null;

  const [year, setYear] = useState<number | null>(initialYear ?? null);
  useEffect(() => {
    // 처음이거나, 모드를 바꿨는데 그 모드에 없는 학년도면 최신 학년도로
    if (latestYear != null && (year == null || (years.data && !years.data.includes(year)))) setYear(latestYear);
  }, [latestYear, year, years.data]);

  // 중등: 내 과목을 기본으로, 샘플이 없는 과목이면 첫 과목
  const [subject, setSubject] = useState<string | null>(null);
  const mySubjectHasData = !!settings.subjectCode && !!subjects.data?.includes(settings.subjectCode);
  useEffect(() => {
    if (!subjects.data) return;
    setSubject(mySubjectHasData ? settings.subjectCode : subjects.data[0]);
  }, [subjects.data, settings.subjectCode, mySubjectHasData]);

  const query = useMemo(
    () => ({ level: viewLevel, subject: isSecondary ? subject : null }),
    [viewLevel, isSecondary, subject],
  );

  return {
    viewLevel,
    isSecondary,
    years: years.data,
    latestYear,
    year,
    setYear,
    isLatest: year != null && year === latestYear,
    subjects: subjects.data,
    subject,
    setSubject,
    /** 내 과목(중등)이 샘플에 없을 때 안내용 */
    mySubjectMissing: settings.level === 'secondary' && !!settings.subjectCode && !mySubjectHasData,
    query,
    ready: year != null && (!isSecondary || subject != null),
  };
}
