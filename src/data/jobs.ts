import { supabase } from '../lib/supabase';
import type { Level } from '../store/AppSettings';

/** 학교별(사립·법인) 정교사 채용 공고 한 건 */
export type TeacherJob = {
  id: string;
  title: string;
  org: string;
  region: string | null;
  level: Level | null;
  posted: string; // YYYY-MM-DD
  deadline: string | null;
  url: string;
  source: string;
  tip?: boolean; // 이용자 제보(운영자 승인)
};

const JOBS_URL = 'https://raw.githubusercontent.com/24chan/imyong_app/raw-files/raw/jobs/teacher_jobs.json';
let cache: { at: number; data: TeacherJob[] } | null = null;

/** 자동 수집(나라일터) + 승인된 제보를 합쳐 최신순 */
export async function getTeacherJobs(force = false): Promise<TeacherJob[]> {
  if (cache && !force && Date.now() - cache.at < 10 * 60 * 1000) return cache.data;
  const [auto, tips] = await Promise.all([
    fetch(JOBS_URL)
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs?: TeacherJob[] }) => j.jobs ?? [])
      .catch(() => [] as TeacherJob[]),
    supabase
      .from('job_tips_v')
      .select('id,url,title,region,level,created_at')
      .order('created_at', { ascending: false })
      .limit(300)
      .then(({ data, error }) =>
        error
          ? []
          : (data ?? []).map(
              (t: { id: number; url: string; title: string; region: string | null; level: Level | null; created_at: string }) => ({
                id: `tip-${t.id}`,
                title: t.title,
                org: '이용자 제보',
                region: t.region,
                level: t.level,
                posted: t.created_at.slice(0, 10),
                deadline: null,
                url: t.url,
                source: '이용자 제보(운영자 확인)',
                tip: true,
              }),
            ),
      ),
  ]);
  const seen = new Set<string>();
  const data = [...auto, ...tips]
    .filter((j) => (seen.has(j.url) ? false : (seen.add(j.url), true)))
    .sort((a, b) => (a.posted < b.posted ? 1 : a.posted > b.posted ? -1 : 0));
  cache = { at: Date.now(), data };
  return data;
}

/** 모드에 맞는 공고 (학교급을 모르면 둘 다에 보임) */
export const jobsFor = (jobs: TeacherJob[], level: Level, regions?: string[]) =>
  jobs.filter((j) => (!j.level || j.level === level) && (!regions || !regions.length || (j.region && regions.includes(j.region))));

export const isOpen = (j: TeacherJob, today: string) => !j.deadline || j.deadline >= today;

export async function submitJobTip(p: { url: string; title: string; region: string | null; level: Level | null; note: string }) {
  const { error } = await supabase.rpc('submit_job_tip', {
    p_url: p.url,
    p_title: p.title,
    p_region: p.region ?? '',
    p_level: p.level ?? '',
    p_note: p.note,
  });
  if (error) throw new Error(/function|schema cache/.test(error.message) ? '제보 기능 준비 중이에요 (운영자 SQL 실행 전)' : error.message);
}

export type JobTip = { id: number; url: string; title: string; region: string | null; level: Level | null; note: string | null; created_at: string };

export async function listPendingTips(): Promise<JobTip[]> {
  const { data, error } = await supabase.from('admin_job_tips_v').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return data as JobTip[];
}

export async function reviewJobTip(id: number, approve: boolean, title?: string) {
  const { error } = await supabase.rpc('admin_review_job_tip', { p_id: id, p_approve: approve, p_title: title ?? '', p_region: '', p_level: '' });
  if (error) throw new Error(error.message);
  cache = null;
}
