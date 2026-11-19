import { supabase } from '../lib/supabase';
import type { Level } from '../store/AppSettings';

// 스터디 모집 · 공부 자료 · 모의고사 (일정·후기·점수 비교)

export type Study = {
  id: number; label: string; level: Level; subjectCode: string | null; regions: string[];
  stage: 'first' | 'second' | 'both'; mode: 'online' | 'offline' | 'both'; capacity: number;
  title: string; body: string; status: 'open' | 'closed' | 'hidden'; createdAt: string; isMine: boolean;
};
export type Material = {
  id: number; label: string; level: Level; subjectCode: string | null; area: 'pedagogy' | 'major' | 'second' | 'etc';
  title: string; body: string; likeCount: number; status: string; createdAt: string; isMine: boolean; liked: boolean;
};
export type MockExam = {
  id: number; name: string; provider: string; level: Level; subjectCode: string | null; examDate: string | null;
  applyUrl: string | null; note: string | null; reviewCount: number; ratingAvg: number | null; difficultyAvg: number | null;
};
export type MockReview = { id: number; examId: number; label: string; rating: number; difficulty: number; body: string; createdAt: string; isMine: boolean };
export type MockScore = { id: number; level: Level; subjectCode: string | null; year: number; examId: number | null; mockScore: number; realScore: number | null };
export type ScoreBand = { band: number; n: number; mockAvg: number; realAvg: number; diffAvg: number };

export const STAGE_LABEL = { first: '1차', second: '2차', both: '1·2차' } as const;
export const MODE_LABEL = { online: '온라인', offline: '오프라인', both: '온·오프' } as const;
export const AREA_LABEL = { pedagogy: '교육학', major: '전공', second: '2차(면접·수업실연)', etc: '기타' } as const;

function err(e: { message?: string } | null, what: string): Error {
  const m = e?.message ?? '';
  if (/[가-힣]/.test(m)) return new Error(m);
  if (/does not exist|schema cache|Could not find/i.test(m)) return new Error('서버 준비가 덜 됐어요 (0012 SQL 실행 필요)');
  if (/network|fetch/i.test(m)) return new Error('인터넷 연결을 확인해 주세요');
  return new Error(`${what}: ${m}`);
}
async function rpc<T>(fn: string, args: Record<string, unknown>, what: string): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw err(error, what);
  return data as T;
}

// ───── 스터디 ─────
type StudyRow = { id: number; label: string; level: Level; subject_code: string | null; regions: string[]; stage: Study['stage']; mode: Study['mode']; capacity: number; title: string; body: string; status: Study['status']; created_at: string; is_mine: boolean | null };
const toStudy = (r: StudyRow): Study => ({
  id: r.id, label: r.label, level: r.level, subjectCode: r.subject_code, regions: r.regions ?? [], stage: r.stage, mode: r.mode,
  capacity: r.capacity, title: r.title, body: r.body, status: r.status, createdAt: r.created_at, isMine: !!r.is_mine,
});

export async function listStudies(f: { level: Level; subject?: string | null; region?: string | null; stage?: Study['stage'] | null; mode?: Study['mode'] | null; openOnly?: boolean }): Promise<Study[]> {
  let q = supabase.from('studies_v').select('*').eq('level', f.level).order('id', { ascending: false }).limit(60);
  if (f.subject) q = q.eq('subject_code', f.subject);
  if (f.region) q = q.contains('regions', [f.region]);
  if (f.stage) q = q.in('stage', [f.stage, 'both']);
  if (f.mode) q = q.in('mode', [f.mode, 'both']);
  if (f.openOnly) q = q.eq('status', 'open');
  const { data, error } = await q;
  if (error) throw err(error, '스터디');
  return (data as StudyRow[]).map(toStudy);
}
export async function getStudy(id: number): Promise<Study | null> {
  const { data, error } = await supabase.from('studies_v').select('*').eq('id', id).maybeSingle();
  if (error) throw err(error, '스터디');
  return data ? toStudy(data as StudyRow) : null;
}
export const createStudy = (s: { level: Level; subject: string | null; regions: string[]; stage: Study['stage']; mode: Study['mode']; capacity: number; title: string; body: string; verificationId?: string | null }) =>
  rpc<number>('create_study', {
    p_level: s.level, p_subject: s.subject ?? '', p_regions: s.regions, p_stage: s.stage, p_mode: s.mode, p_capacity: s.capacity,
    p_title: s.title, p_body: s.body, p_verification: s.verificationId ?? null,
  }, '스터디 모집');
export const setStudyStatus = (id: number, status: 'open' | 'closed' | 'deleted') => rpc<void>('set_study_status', { p_id: id, p_status: status }, '스터디');

// ───── 공부 자료 ─────
type MatRow = { id: number; label: string; level: Level; subject_code: string | null; area: Material['area']; title: string; body: string; like_count: number; status: string; created_at: string; is_mine: boolean | null; liked: boolean | null };
const toMat = (r: MatRow): Material => ({
  id: r.id, label: r.label, level: r.level, subjectCode: r.subject_code, area: r.area, title: r.title, body: r.body, likeCount: r.like_count,
  status: r.status, createdAt: r.created_at, isMine: !!r.is_mine, liked: !!r.liked,
});
export async function listMaterials(f: { level: Level; subject?: string | null; area?: Material['area'] | null; sort: 'new' | 'like' }): Promise<Material[]> {
  let q = supabase.from('materials_v').select('*').eq('level', f.level).limit(60);
  if (f.subject) q = q.or(`subject_code.eq.${f.subject},area.eq.pedagogy,area.eq.second`);
  if (f.area) q = q.eq('area', f.area);
  q = f.sort === 'like' ? q.order('like_count', { ascending: false }).order('id', { ascending: false }) : q.order('id', { ascending: false });
  const { data, error } = await q;
  if (error) throw err(error, '공부 자료');
  return (data as MatRow[]).map(toMat);
}
export async function getMaterial(id: number): Promise<Material | null> {
  const { data, error } = await supabase.from('materials_v').select('*').eq('id', id).maybeSingle();
  if (error) throw err(error, '공부 자료');
  return data ? toMat(data as MatRow) : null;
}
export const createMaterial = (m: { level: Level; subject: string | null; area: Material['area']; title: string; body: string; verificationId?: string | null }) =>
  rpc<number>('create_material', { p_level: m.level, p_subject: m.subject ?? '', p_area: m.area, p_title: m.title, p_body: m.body, p_verification: m.verificationId ?? null }, '자료 올리기');
export const updateMaterial = (id: number, title: string, body: string) => rpc<void>('update_material', { p_id: id, p_title: title, p_body: body }, '자료 수정');
export const deleteMaterial = (id: number) => rpc<void>('delete_material', { p_id: id }, '자료 삭제');
export const toggleMaterialLike = (id: number) => rpc<number>('toggle_material_like', { p_id: id }, '공감');

// ───── 모의고사 ─────
type ExamRow = { id: number; name: string; provider: string; level: Level; subject_code: string | null; exam_date: string | null; apply_url: string | null; note: string | null; review_count: number; rating_avg: string | null; difficulty_avg: string | null };
const toExam = (r: ExamRow): MockExam => ({
  id: r.id, name: r.name, provider: r.provider, level: r.level, subjectCode: r.subject_code, examDate: r.exam_date, applyUrl: r.apply_url,
  note: r.note, reviewCount: Number(r.review_count), ratingAvg: r.rating_avg == null ? null : Number(r.rating_avg), difficultyAvg: r.difficulty_avg == null ? null : Number(r.difficulty_avg),
});
export async function listMockExams(level: Level, subject?: string | null): Promise<MockExam[]> {
  let q = supabase.from('mock_exams_v').select('*').eq('level', level).order('exam_date', { ascending: false, nullsFirst: false }).limit(100);
  if (subject) q = q.or(`subject_code.is.null,subject_code.eq.${subject}`);
  const { data, error } = await q;
  if (error) throw err(error, '모의고사');
  return (data as ExamRow[]).map(toExam);
}
export async function getMockExam(id: number): Promise<MockExam | null> {
  const { data, error } = await supabase.from('mock_exams_v').select('*').eq('id', id).maybeSingle();
  if (error) throw err(error, '모의고사');
  return data ? toExam(data as ExamRow) : null;
}
export async function listMockReviews(examId: number): Promise<MockReview[]> {
  const { data, error } = await supabase.from('mock_reviews_v').select('*').eq('exam_id', examId).order('created_at', { ascending: false });
  if (error) throw err(error, '후기');
  return (data ?? []).map((r: { id: number; exam_id: number; label: string; rating: number; difficulty: number; body: string; created_at: string; is_mine: boolean | null }) => ({
    id: r.id, examId: r.exam_id, label: r.label, rating: r.rating, difficulty: r.difficulty, body: r.body, createdAt: r.created_at, isMine: !!r.is_mine,
  }));
}
export const upsertMockReview = (examId: number, rating: number, difficulty: number, body: string, verificationId?: string | null) =>
  rpc<void>('upsert_mock_review', { p_exam: examId, p_rating: rating, p_difficulty: difficulty, p_body: body, p_verification: verificationId ?? null }, '후기');
export const deleteMockReview = (id: number) => rpc<void>('delete_mock_review', { p_id: id }, '후기 삭제');

export async function myMockScores(): Promise<MockScore[]> {
  const { data, error } = await supabase.from('my_mock_scores_v').select('*').order('created_at', { ascending: false });
  if (error) throw err(error, '내 점수');
  return (data ?? []).map((s: { id: number; level: Level; subject_code: string | null; year: number; exam_id: number | null; mock_score: string; real_score: string | null }) => ({
    id: s.id, level: s.level, subjectCode: s.subject_code, year: s.year, examId: s.exam_id, mockScore: Number(s.mock_score), realScore: s.real_score == null ? null : Number(s.real_score),
  }));
}
export const addMockScore = (s: { level: Level; subject: string | null; year: number; examId: number | null; mock: number; real: number | null }) =>
  rpc<number>('add_mock_score', { p_level: s.level, p_subject: s.subject ?? '', p_year: s.year, p_exam: s.examId, p_mock: s.mock, p_real: s.real }, '점수 기록');
export const deleteMockScore = (id: number) => rpc<void>('delete_mock_score', { p_id: id }, '점수 삭제');
export async function mockScoreStats(level: Level, subject?: string | null): Promise<ScoreBand[]> {
  const rows = await rpc<{ band: number; n: number; mock_avg: string; real_avg: string; diff_avg: string }[]>('mock_score_stats', { p_level: level, p_subject: subject ?? null }, '점수 통계');
  return rows.map((r) => ({ band: r.band, n: Number(r.n), mockAvg: Number(r.mock_avg), realAvg: Number(r.real_avg), diffAvg: Number(r.diff_avg) }));
}
export const adminAddMockExam = (e: { name: string; provider: string; level: Level; subject: string | null; date: string | null; url: string; note: string }) =>
  rpc<number>('admin_add_mock_exam', { p_name: e.name, p_provider: e.provider, p_level: e.level, p_subject: e.subject ?? '', p_date: e.date, p_url: e.url, p_note: e.note }, '모의고사 등록');
export const adminDeleteMockExam = (id: number) => rpc<void>('admin_delete_mock_exam', { p_id: id }, '모의고사 삭제');
