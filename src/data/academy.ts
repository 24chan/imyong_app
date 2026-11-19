import { supabase } from '../lib/supabase';
import type { Level } from '../store/AppSettings';

// 학원·인강: 강의 목록 · 수강 인증 · 후기(수강 인증자만) · 일정 · 광고(따로 표시)

export type Area = 'pedagogy' | 'major' | 'second';
export const LECTURE_AREA: Record<Area, string> = { pedagogy: '교육학', major: '전공', second: '2차' };
export const EVENT_KIND = { open: '개강', special: '특강', mock: '모의고사' } as const;

export type Lecture = {
  id: number; academyName: string; instructor: string; title: string; level: Level; area: Area; subjectCode: string | null; url: string | null;
  reviewCount: number; ratingAvg: number | null; deliveryAvg: number | null; materialAvg: number | null; careAvg: number | null;
  myEnrollment: 'pending' | 'approved' | 'rejected' | null;
};
export type LectureReview = { id: number; lectureId: number; label: string; rating: number; delivery: number; material: number; care: number; body: string; createdAt: string; isMine: boolean };
export type AcademyEvent = { id: number; kind: keyof typeof EVENT_KIND; title: string; startsOn: string; endsOn: string | null; level: Level; area: Area | null; subjectCode: string | null; url: string | null; academyName: string | null };
export type Ad = { id: number; title: string; body: string | null; url: string | null; academyName: string | null };

function err(e: { message?: string } | null, what: string): Error {
  const m = e?.message ?? '';
  if (/[가-힣]/.test(m)) return new Error(m);
  if (/does not exist|schema cache|Could not find/i.test(m)) return new Error('서버 준비가 덜 됐어요 (0013 SQL 실행 필요)');
  if (/network|fetch/i.test(m)) return new Error('인터넷 연결을 확인해 주세요');
  return new Error(`${what}: ${m}`);
}
async function rpc<T>(fn: string, args: Record<string, unknown>, what: string): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw err(error, what);
  return data as T;
}
const n = (v: string | number | null) => (v == null ? null : Number(v));

type LecRow = { id: number; academy_name: string; instructor: string; title: string; level: Level; area: Area; subject_code: string | null; url: string | null; review_count: number; rating_avg: string | null; delivery_avg: string | null; material_avg: string | null; care_avg: string | null; my_enrollment: Lecture['myEnrollment'] };
const toLec = (r: LecRow): Lecture => ({
  id: r.id, academyName: r.academy_name, instructor: r.instructor, title: r.title, level: r.level, area: r.area, subjectCode: r.subject_code, url: r.url,
  reviewCount: Number(r.review_count), ratingAvg: n(r.rating_avg), deliveryAvg: n(r.delivery_avg), materialAvg: n(r.material_avg), careAvg: n(r.care_avg), myEnrollment: r.my_enrollment,
});

/** 모드에 맞는 강의: 초등 = 교육학 + 초등, 중등 = 교육학 + 내 과목 전공 (+2차) */
export async function listLectures(level: Level, area: Area | null, subject: string | null): Promise<Lecture[]> {
  let q = supabase.from('lectures_v').select('*').eq('level', level).limit(200);
  if (area) q = q.eq('area', area);
  if (subject && area !== 'pedagogy') q = q.or(`subject_code.eq.${subject},area.neq.major`);
  const { data, error } = await q;
  if (error) throw err(error, '강의');
  return (data as LecRow[]).map(toLec);
}
export async function getLecture(id: number): Promise<Lecture | null> {
  const { data, error } = await supabase.from('lectures_v').select('*').eq('id', id).maybeSingle();
  if (error) throw err(error, '강의');
  return data ? toLec(data as LecRow) : null;
}
export async function listLectureReviews(id: number): Promise<LectureReview[]> {
  const { data, error } = await supabase.from('lecture_reviews_v').select('*').eq('lecture_id', id).order('created_at', { ascending: false });
  if (error) throw err(error, '후기');
  return (data ?? []).map((r: { id: number; lecture_id: number; label: string; rating: number; delivery: number; material: number; care: number; body: string; created_at: string; is_mine: boolean | null }) => ({
    id: r.id, lectureId: r.lecture_id, label: r.label, rating: r.rating, delivery: r.delivery, material: r.material, care: r.care, body: r.body, createdAt: r.created_at, isMine: !!r.is_mine,
  }));
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const x = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63);
    if (o < len) out[o++] = (x >> 16) & 255;
    if (o < len) out[o++] = (x >> 8) & 255;
    if (o < len) out[o++] = x & 255;
  }
  return out;
}

/** 수강 인증 신청: 사진 올리고 신청 (실패하면 사진 삭제) */
export async function requestEnrollment(uid: string, lectureId: number, imagesBase64: string[]): Promise<void> {
  const paths: string[] = [];
  try {
    for (const b of imagesBase64) {
      const path = `${uid}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}.jpg`;
      const { error } = await supabase.storage.from('enroll-docs').upload(path, b64ToBytes(b), { contentType: 'image/jpeg' });
      if (error) throw err(error, '사진 올리기');
      paths.push(path);
    }
    await rpc<number>('request_enrollment', { p_lecture: lectureId, p_paths: paths }, '수강 인증');
  } catch (e) {
    if (paths.length) await supabase.storage.from('enroll-docs').remove(paths);
    throw e;
  }
}
export const upsertLectureReview = (id: number, r: { rating: number; delivery: number; material: number; care: number; body: string }, verificationId?: string | null) =>
  rpc<void>('upsert_lecture_review', { p_lecture: id, p_rating: r.rating, p_delivery: r.delivery, p_material: r.material, p_care: r.care, p_body: r.body, p_verification: verificationId ?? null }, '후기');
export const deleteLectureReview = (id: number) => rpc<void>('delete_lecture_review', { p_id: id }, '후기 삭제');
export const requestLecture = (text: string) => rpc<void>('request_lecture', { p_text: text }, '강의 추가 요청');

export async function listEvents(level: Level, from: string, to: string): Promise<AcademyEvent[]> {
  const { data, error } = await supabase.from('academy_events_v').select('*').eq('level', level).gte('starts_on', from).lte('starts_on', to).order('starts_on');
  if (error) throw err(error, '일정');
  return (data ?? []).map((e: { id: number; kind: AcademyEvent['kind']; title: string; starts_on: string; ends_on: string | null; level: Level; area: Area | null; subject_code: string | null; url: string | null; academy_name: string | null }) => ({
    id: e.id, kind: e.kind, title: e.title, startsOn: e.starts_on, endsOn: e.ends_on, level: e.level, area: e.area, subjectCode: e.subject_code, url: e.url, academyName: e.academy_name,
  }));
}
export async function listAds(level: Level): Promise<Ad[]> {
  const { data, error } = await supabase.from('ads_v').select('*').or(`level.is.null,level.eq.${level}`).limit(3);
  if (error) return [];
  return (data ?? []).map((a: { id: number; title: string; body: string | null; url: string | null; academy_name: string | null }) => ({ id: a.id, title: a.title, body: a.body, url: a.url, academyName: a.academy_name }));
}

// ───── 운영자 ─────
export type PendingEnrollment = { id: number; lectureTitle: string; instructor: string; academyName: string; docPaths: string[]; createdAt: string };
export async function adminEnrollments(): Promise<PendingEnrollment[]> {
  const { data, error } = await supabase.from('admin_enrollments_v').select('*').order('created_at');
  if (error) throw err(error, '수강 인증');
  return (data ?? []).map((e: { id: number; lecture_title: string; instructor: string; academy_name: string; doc_paths: string[]; created_at: string }) => ({
    id: e.id, lectureTitle: e.lecture_title, instructor: e.instructor, academyName: e.academy_name, docPaths: e.doc_paths ?? [], createdAt: e.created_at,
  }));
}
export async function enrollDocUrls(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const { data } = await supabase.storage.from('enroll-docs').createSignedUrls(paths, 600);
  return (data ?? []).map((d) => d.signedUrl).filter((u): u is string => !!u);
}
export async function adminReviewEnrollment(e: PendingEnrollment, approve: boolean, reason?: string): Promise<void> {
  if (e.docPaths.length) await supabase.storage.from('enroll-docs').remove(e.docPaths);
  await rpc<void>('admin_review_enrollment', { p_id: e.id, p_approve: approve, p_reason: reason ?? null }, '수강 인증 처리');
}
export async function adminLectureRequests(): Promise<{ id: number; text: string; createdAt: string }[]> {
  const { data } = await supabase.from('admin_lecture_requests_v').select('*').order('created_at');
  return (data ?? []).map((r: { id: number; text: string; created_at: string }) => ({ id: r.id, text: r.text, createdAt: r.created_at }));
}
export const adminAddLecture = (l: { academy: string; instructor: string; title: string; level: Level; area: Area; subject: string | null; url: string }) =>
  rpc<number>('admin_add_lecture', { p_academy: l.academy, p_instructor: l.instructor, p_title: l.title, p_level: l.level, p_area: l.area, p_subject: l.subject ?? '', p_url: l.url }, '강의 등록');
export const adminAddEvent = (e: { academy: string; kind: AcademyEvent['kind']; title: string; starts: string; ends: string | null; level: Level; area: Area | null; subject: string | null; url: string }) =>
  rpc<number>('admin_add_event', { p_academy: e.academy, p_kind: e.kind, p_title: e.title, p_starts: e.starts, p_ends: e.ends, p_level: e.level, p_area: e.area ?? '', p_subject: e.subject ?? '', p_url: e.url }, '일정 등록');
export const adminDelete = (table: 'lectures' | 'academy_events' | 'ads' | 'lecture_requests', id: number) => rpc<void>('admin_delete', { p_table: table, p_id: id }, '삭제');
