import { supabase } from '../lib/supabase';
import type { Level } from '../store/AppSettings';

// 학교·교사 인증. 사진은 비공개 저장소(verify-docs)에 잠깐 두고 운영자가 확인하면 바로 지웁니다.

export type Univ = { code: string; name: string; label: string; kind: 'edu' | 'sabeom' | 'elem'; emailDomains: string[] };
export type VerifyKind = 'school' | 'teacher';
export type VerifyMethod = 'email' | 'student_id' | 'kakao' | 'certificate' | 'employment' | 'license' | 'contract';
export type Verification = {
  id: string;
  userId: string;
  kind: VerifyKind;
  method: VerifyMethod;
  univCode: string | null;
  univInput: string | null;
  teacherLevel: Level | null;
  subjectCode: string | null;
  showSubject: boolean;
  label: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason: string | null;
  docPaths: string[];
  createdAt: string;
};

export const METHOD_LABEL: Record<VerifyMethod, string> = {
  email: '학교 메일',
  student_id: '학생증',
  kakao: '톡학생증',
  certificate: '재학·졸업증명서',
  employment: '재직증명서',
  license: '교원자격증',
  contract: '기간제 계약서',
};

const BUCKET = 'verify-docs';

function friendly(e: { message?: string } | null, what: string): Error {
  const m = e?.message ?? '';
  if (/relation .* does not exist|schema cache|verifications|univs/.test(m) && /not|exist|find/i.test(m))
    return new Error('서버 준비가 덜 됐어요 (0010 SQL 실행 필요)');
  if (/bucket/i.test(m)) return new Error('사진 저장소가 아직 없어요 (0010 SQL 실행 필요)');
  if (/network|fetch/i.test(m)) return new Error('인터넷 연결을 확인해 주세요');
  return new Error(`${what}: ${m}`);
}

export async function getUnivs(): Promise<Univ[]> {
  const { data, error } = await supabase.from('univs').select('code,name,label,kind,email_domains,sort').order('sort').order('name');
  if (error) throw friendly(error, '학교 목록');
  return (data ?? []).map((u: { code: string; name: string; label: string; kind: Univ['kind']; email_domains: string[] }) => ({
    code: u.code,
    name: u.name,
    label: u.label,
    kind: u.kind,
    emailDomains: u.email_domains ?? [],
  }));
}

type Row = {
  id: string; user_id: string; kind: VerifyKind; method: VerifyMethod; univ_code: string | null; univ_input: string | null;
  teacher_level: Level | null; subject_code: string | null; show_subject: boolean; label: string | null;
  status: Verification['status']; reject_reason: string | null; doc_paths: string[] | null; created_at: string;
};
const toV = (r: Row): Verification => ({
  id: r.id, userId: r.user_id, kind: r.kind, method: r.method, univCode: r.univ_code, univInput: r.univ_input,
  teacherLevel: r.teacher_level, subjectCode: r.subject_code, showSubject: r.show_subject, label: r.label,
  status: r.status, rejectReason: r.reject_reason, docPaths: r.doc_paths ?? [], createdAt: r.created_at,
});

/** 내 인증 (운영자는 RLS 때문에 모두 보이므로 내 것만 거름) */
export async function getMyVerifications(uid: string): Promise<Verification[]> {
  const { data, error } = await supabase.from('verifications').select('*').eq('user_id', uid).order('created_at', { ascending: false });
  if (error) throw friendly(error, '내 인증');
  return (data as Row[]).map(toV);
}

/** 로그인한 메일이 교대 메일이면 바로 승인. 돌려주는 값 = 라벨 */
export async function verifySchoolEmail(): Promise<string> {
  const { data, error } = await supabase.rpc('verify_school_email');
  if (error) throw new Error(error.message.replace(/^.*?: /, ''));
  return data as string;
}

// base64 → 바이트 (사진 올리기용, 외부 패키지 없이)
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

const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export type DocRequest = {
  kind: VerifyKind;
  method: Exclude<VerifyMethod, 'email'>;
  univCode?: string | null;
  univInput?: string | null;
  teacherLevel?: Level | null;
  subjectCode?: string | null;
  imagesBase64: string[];
};

/** 사진 인증 신청: 사진 올리기 → 신청서 저장 (실패하면 올린 사진도 지움) */
export async function submitDocVerification(uid: string, req: DocRequest): Promise<void> {
  const paths: string[] = [];
  try {
    for (const b64 of req.imagesBase64) {
      const path = `${uid}/${rid()}.jpg`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, b64ToBytes(b64), { contentType: 'image/jpeg', upsert: false });
      if (error) throw friendly(error, '사진 올리기');
      paths.push(path);
    }
    const { error } = await supabase.from('verifications').insert({
      user_id: uid,
      kind: req.kind,
      method: req.method,
      univ_code: req.kind === 'school' ? req.univCode ?? null : null,
      univ_input: req.kind === 'school' && !req.univCode ? req.univInput?.trim() || null : null,
      teacher_level: req.kind === 'teacher' ? req.teacherLevel ?? null : null,
      subject_code: req.kind === 'teacher' && req.teacherLevel === 'secondary' ? req.subjectCode ?? null : null,
      doc_paths: paths,
    });
    if (error) throw friendly(error, '신청 저장');
  } catch (e) {
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    throw e;
  }
}

/** 대기 중 신청 취소: 사진도 지움 */
export async function cancelVerification(v: Verification): Promise<void> {
  if (v.docPaths.length) await supabase.storage.from(BUCKET).remove(v.docPaths);
  const { error } = await supabase.from('verifications').delete().eq('id', v.id);
  if (error) throw friendly(error, '취소');
}

export async function setShowSubject(id: string, show: boolean): Promise<void> {
  const { error } = await supabase.from('verifications').update({ show_subject: show }).eq('id', id);
  if (error) throw friendly(error, '과목 표시');
}

// ───── 운영자 ─────

export async function getPendingVerifications(): Promise<Verification[]> {
  const { data, error } = await supabase.from('verifications').select('*').eq('status', 'pending').order('created_at');
  if (error) throw friendly(error, '검수 목록');
  return (data as Row[]).map(toV);
}

/** 사진 임시 주소 (10분) */
export async function signedDocUrls(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 600);
  if (error) throw friendly(error, '사진 보기');
  return (data ?? []).map((d) => d.signedUrl).filter((u): u is string => !!u);
}

/** 승인·거절: 사진을 먼저 지우고 결과 저장 */
export async function reviewVerification(v: Verification, approve: boolean, opts: { reason?: string; label?: string } = {}): Promise<string | null> {
  if (v.docPaths.length) {
    const { error } = await supabase.storage.from(BUCKET).remove(v.docPaths);
    if (error) throw friendly(error, '사진 삭제');
  }
  const { data, error } = await supabase.rpc('review_verification', {
    p_id: v.id,
    p_approve: approve,
    p_reason: opts.reason ?? null,
    p_label: opts.label ?? null,
  });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}
