import { supabase } from '../lib/supabase';

// 실습초: 목록 제보(사진·PDF 첨부) + 실습 후기 (0026)
const BUCKET = 'practice-tips';
const friendly = (e: { message: string }, what: string) => {
  const m = e.message ?? '';
  if (/practice_|bucket|does not exist|schema cache/i.test(m)) return new Error(`${what}: 0026 SQL을 먼저 실행해 주세요`);
  return new Error(m.replace(/^.*?ERROR:\s*/, ''));
};
async function rpc<T>(fn: string, args: Record<string, unknown>, what: string): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw friendly(error, what);
  return data as T;
}
const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// base64 → 바이트 (외부 패키지 없이, verify.ts와 같은 방식)
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63);
    if (o < len) out[o++] = (n >> 16) & 255;
    if (o < len) out[o++] = (n >> 8) & 255;
    if (o < len) out[o++] = n & 255;
  }
  return out;
}

export type TipFile = { uri: string; name: string; mime: string; base64?: string | null };

async function bytesOf(f: TipFile): Promise<ArrayBuffer> {
  if (f.base64) return b64ToBytes(f.base64).buffer as ArrayBuffer;
  const res = await fetch(f.uri);
  return res.arrayBuffer();
}

/** 제보 보내기: 첨부 올리기 → 제보 저장 (실패하면 올린 파일 지움) */
export async function submitPracticeTip(uid: string, t: { univ: string; year: number | null; note: string; url: string; files: TipFile[] }) {
  const paths: string[] = [];
  try {
    for (const f of t.files.slice(0, 5)) {
      const ext = f.mime === 'application/pdf' ? 'pdf' : f.mime === 'image/png' ? 'png' : 'jpg';
      const path = `${uid}/${rid()}.${ext}`;
      const body = await bytesOf(f);
      if (body.byteLength > 15 * 1024 * 1024) throw new Error('파일 하나는 15MB까지 올릴 수 있어요');
      const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: f.mime, upsert: false });
      if (error) throw friendly(error, '첨부 올리기');
      paths.push(path);
    }
    await rpc<number>('submit_practice_tip', { p_univ: t.univ, p_year: t.year, p_note: t.note, p_url: t.url, p_files: paths }, '제보');
  } catch (e) {
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    throw e;
  }
}

export type PracticeTip = { id: number; univ: string; year: number | null; note: string | null; url: string | null; file_paths: string[]; created_at: string };
export async function listPracticeTips(): Promise<PracticeTip[]> {
  const { data, error } = await supabase.from('admin_practice_tips_v').select('*').order('created_at');
  if (error) throw friendly(error, '실습 제보');
  return (data ?? []) as PracticeTip[];
}
export async function tipFileUrls(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 600);
  if (error) throw friendly(error, '첨부 보기');
  return (data ?? []).map((d) => d.signedUrl ?? '');
}
/** 처리(목록에 반영함/거절) → 첨부 바로 삭제 */
export async function finishPracticeTip(id: number, done: boolean) {
  const files = await rpc<string[]>('admin_finish_practice_tip', { p_id: id, p_done: done }, '제보 처리');
  if (files?.length) await supabase.storage.from(BUCKET).remove(files);
}

// ───── 실습 후기 ─────
export type PracticeReview = { id: number; school: string; year: number; atmosphere: number; guidance: number; commute: number; recommend: boolean; body: string; created_at: string; is_mine: boolean };
export async function listPracticeReviews(school: string): Promise<PracticeReview[]> {
  const { data, error } = await supabase.from('practice_reviews_v').select('*').eq('school', school).order('created_at', { ascending: false });
  if (error) throw friendly(error, '실습 후기');
  return (data ?? []) as PracticeReview[];
}
export const savePracticeReview = (r: { school: string; year: number; atmosphere: number; guidance: number; commute: number; recommend: boolean; body: string }) =>
  rpc<void>('upsert_practice_review', {
    p_school: r.school, p_year: r.year, p_atmosphere: r.atmosphere, p_guidance: r.guidance, p_commute: r.commute, p_recommend: r.recommend, p_body: r.body,
  }, '실습 후기');
export const deletePracticeReview = (id: number) => rpc<void>('delete_practice_review', { p_id: id }, '실습 후기 삭제');
