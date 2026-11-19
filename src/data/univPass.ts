import { supabase } from '../lib/supabase';
import type { Level } from '../store/AppSettings';

// 대학별 합격률: 공식 자료(출처·기준일) + 이용자 합격 인증 수(3명 이상만)

export type PassStat = {
  id: number; univCode: string; year: number; level: Level; subjectCode: string | null; graduates: number | null; applicants: number | null;
  passed: number; basis: string; sourceTitle: string; sourceUrl: string | null; sourceDate: string;
};
export type CertCount = { univCode: string; year: number; level: Level; certified: number };
export type MyCert = { id: number; univCode: string | null; year: number; level: Level; status: 'pending' | 'approved' | 'rejected' };

function err(e: { message?: string } | null, what: string): Error {
  const m = e?.message ?? '';
  if (/[가-힣]/.test(m)) return new Error(m);
  if (/does not exist|schema cache|Could not find/i.test(m)) return new Error('서버 준비가 덜 됐어요 (0014 SQL 실행 필요)');
  return new Error(`${what}: ${m}`);
}

export async function listPassStats(level: Level): Promise<PassStat[]> {
  const { data, error } = await supabase.from('univ_pass_stats').select('*').eq('level', level).order('year', { ascending: false });
  if (error) throw err(error, '대학별 합격률');
  return (data ?? []).map((r: { id: number; univ_code: string; year: number; level: Level; subject_code: string | null; graduates: number | null; applicants: number | null; passed: number; basis: string; source_title: string; source_url: string | null; source_date: string }) => ({
    id: r.id, univCode: r.univ_code, year: r.year, level: r.level, subjectCode: r.subject_code, graduates: r.graduates, applicants: r.applicants, passed: r.passed,
    basis: r.basis, sourceTitle: r.source_title, sourceUrl: r.source_url, sourceDate: r.source_date,
  }));
}
export async function listCertCounts(level: Level): Promise<CertCount[]> {
  const { data } = await supabase.from('pass_cert_counts_v').select('*').eq('level', level);
  return (data ?? []).map((r: { univ_code: string; year: number; level: Level; certified: number }) => ({ univCode: r.univ_code, year: r.year, level: r.level, certified: Number(r.certified) }));
}
export async function myPassCerts(): Promise<MyCert[]> {
  const { data } = await supabase.from('my_pass_certs_v').select('*');
  return (data ?? []).map((r: { id: number; univ_code: string | null; year: number; level: Level; status: MyCert['status'] }) => ({ id: r.id, univCode: r.univ_code, year: r.year, level: r.level, status: r.status }));
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
export async function requestPassCert(uid: string, year: number, level: Level, subject: string | null, base64: string): Promise<void> {
  const path = `${uid}/${Date.now().toString(36)}.jpg`;
  const { error } = await supabase.storage.from('pass-docs').upload(path, b64ToBytes(base64), { contentType: 'image/jpeg' });
  if (error) throw err(error, '사진 올리기');
  const { error: e2 } = await supabase.rpc('request_pass_cert', { p_year: year, p_level: level, p_subject: subject ?? '', p_paths: [path] });
  if (e2) {
    await supabase.storage.from('pass-docs').remove([path]);
    throw err(e2, '합격 인증');
  }
}

// ───── 운영자 ─────
export type PendingCert = { id: number; year: number; level: Level; univLabel: string | null; docPaths: string[] };
export async function adminPassCerts(): Promise<PendingCert[]> {
  const { data, error } = await supabase.from('admin_pass_certs_v').select('*').order('created_at');
  if (error) throw err(error, '합격 인증');
  return (data ?? []).map((r: { id: number; year: number; level: Level; univ_label: string | null; doc_paths: string[] }) => ({ id: r.id, year: r.year, level: r.level, univLabel: r.univ_label, docPaths: r.doc_paths ?? [] }));
}
export async function passDocUrls(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const { data } = await supabase.storage.from('pass-docs').createSignedUrls(paths, 600);
  return (data ?? []).map((d) => d.signedUrl).filter((u): u is string => !!u);
}
export async function adminReviewPassCert(c: PendingCert, approve: boolean): Promise<void> {
  if (c.docPaths.length) await supabase.storage.from('pass-docs').remove(c.docPaths);
  const { error } = await supabase.rpc('admin_review_pass_cert', { p_id: c.id, p_approve: approve });
  if (error) throw err(error, '합격 인증 처리');
}
export async function adminAddPassStat(s: { univ: string; year: number; level: Level; subject: string | null; graduates: number | null; applicants: number | null; passed: number; basis: string; sourceTitle: string; sourceUrl: string; sourceDate: string }) {
  const { error } = await supabase.rpc('admin_add_pass_stat', {
    p_univ: s.univ, p_year: s.year, p_level: s.level, p_subject: s.subject ?? '', p_graduates: s.graduates, p_applicants: s.applicants, p_passed: s.passed,
    p_basis: s.basis, p_source_title: s.sourceTitle, p_source_url: s.sourceUrl, p_source_date: s.sourceDate,
  });
  if (error) throw err(error, '자료 등록');
}
export async function adminDeletePassStat(id: number) {
  const { error } = await supabase.rpc('admin_delete_pass_stat', { p_id: id });
  if (error) throw err(error, '자료 삭제');
}
