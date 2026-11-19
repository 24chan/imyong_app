import { supabase } from '../lib/supabase';

// 커뮤니티·쪽지·신고·제재 데이터 창구. 글쓴이 id 는 서버가 절대 내려주지 않고, '내 것인지(isMine)'만 알려줍니다.

export type Board = { id: string; name: string; kind: 'all' | 'level' | 'subject' | 'region' | 'review'; level: string | null; subjectCode: string | null; region: string | null };
export type Post = {
  id: number;
  boardId: string;
  boardName: string;
  label: string;
  title: string;
  body: string;
  likeCount: number;
  commentCount: number;
  scrapCount: number;
  status: 'visible' | 'hidden' | 'deleted';
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
  liked: boolean;
  scrapped: boolean;
};
export type Comment = {
  id: number;
  postId: number;
  parentId: number | null;
  label: string;
  anonNo: number;
  body: string;
  likeCount: number;
  status: 'visible' | 'hidden' | 'deleted';
  createdAt: string;
  isMine: boolean;
  liked: boolean;
};
export type Conversation = { id: string; otherLabel: string; myLabel: string; originTitle: string | null; lastAt: string; lastBody: string | null; unread: number; blocked: boolean };
export type Message = { id: number; body: string | null; imagePath: string | null; createdAt: string; isMine: boolean; readAt: string | null };
export type Sanction = { id: number; level: 'warning' | 'write_7d' | 'write_30d' | 'permanent'; reason: string; startsAt: string; endsAt: string | null; appeal: string | null; appealStatus: 'open' | 'accepted' | 'rejected' | null; active: boolean };

export const HOT_LIKES = 10;
export const REPORT_REASONS = ['욕설·비하', '정치·혐오', '광고·홍보', '실명·개인정보 노출', '교재·강의 자료 공유', '음란·불쾌', '도배·낚시', '기타'];
export const SANCTION_LABEL: Record<Sanction['level'], string> = {
  warning: '경고',
  write_7d: '글쓰기 7일 제한',
  write_30d: '글쓰기 30일 제한',
  permanent: '영구 제한',
};

/** 서버 오류 → 쉬운 한국어 (함수가 보낸 한국어 메시지는 그대로) */
function err(e: { message?: string } | null, what: string): Error {
  const m = e?.message ?? '';
  if (/[가-힣]/.test(m)) return new Error(m.replace(/^.*?ERROR:\s*/, ''));
  if (/does not exist|schema cache|Could not find/i.test(m)) return new Error('서버 준비가 덜 됐어요 (0011 SQL 실행 필요)');
  if (/network|fetch/i.test(m)) return new Error('인터넷 연결을 확인해 주세요');
  return new Error(`${what}: ${m}`);
}

const POST_COLS = 'id,board_id,board_name,label,title,body,like_count,comment_count,scrap_count,status,created_at,updated_at,is_mine,liked,scrapped';
type PostRow = {
  id: number; board_id: string; board_name: string; label: string; title: string; body: string; like_count: number; comment_count: number;
  scrap_count: number; status: Post['status']; created_at: string; updated_at: string; is_mine: boolean | null; liked: boolean | null; scrapped: boolean | null;
};
const toPost = (r: PostRow): Post => ({
  id: r.id, boardId: r.board_id, boardName: r.board_name, label: r.label, title: r.title, body: r.body, likeCount: r.like_count,
  commentCount: r.comment_count, scrapCount: r.scrap_count, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at,
  isMine: !!r.is_mine, liked: !!r.liked, scrapped: !!r.scrapped,
});

export async function getBoards(): Promise<Board[]> {
  const { data, error } = await supabase.from('boards').select('id,name,kind,level,subject_code,region,sort').order('sort');
  if (error) throw err(error, '게시판');
  return (data ?? []).map((b: { id: string; name: string; kind: Board['kind']; level: string | null; subject_code: string | null; region: string | null }) => ({
    id: b.id, name: b.name, kind: b.kind, level: b.level, subjectCode: b.subject_code, region: b.region,
  }));
}

/** 게시판 글 목록 (board = 'hot' 이면 HOT 게시판). before = 이 id 보다 오래된 것 (더 보기) */
export async function listPosts(board: string, before?: number, limit = 20): Promise<Post[]> {
  let q = supabase.from(board === 'hot' ? 'hot_posts_v' : 'posts_v').select(POST_COLS).order('id', { ascending: false }).limit(limit);
  if (board !== 'hot') q = q.eq('board_id', board);
  if (before) q = q.lt('id', before);
  const { data, error } = await q;
  if (error) throw err(error, '글 목록');
  return (data as PostRow[]).map(toPost);
}

export async function listMyScraps(): Promise<Post[]> {
  const { data, error } = await supabase.from('my_scraps_v').select(POST_COLS).order('scrapped_at', { ascending: false }).limit(100);
  if (error) throw err(error, '스크랩');
  return (data as PostRow[]).map(toPost);
}

export async function getPost(id: number): Promise<Post | null> {
  const { data, error } = await supabase.from('posts_v').select(POST_COLS).eq('id', id).maybeSingle();
  if (error) throw err(error, '글');
  return data ? toPost(data as PostRow) : null;
}

export async function listComments(postId: number): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments_v')
    .select('id,post_id,parent_id,label,anon_no,body,like_count,status,created_at,is_mine,liked')
    .eq('post_id', postId)
    .order('id');
  if (error) throw err(error, '댓글');
  return (data ?? []).map(
    (c: { id: number; post_id: number; parent_id: number | null; label: string; anon_no: number; body: string; like_count: number; status: Comment['status']; created_at: string; is_mine: boolean | null; liked: boolean | null }) => ({
      id: c.id, postId: c.post_id, parentId: c.parent_id, label: c.label, anonNo: c.anon_no, body: c.body, likeCount: c.like_count,
      status: c.status, createdAt: c.created_at, isMine: !!c.is_mine, liked: !!c.liked,
    }),
  );
}

async function rpc<T>(fn: string, args: Record<string, unknown>, what: string): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw err(error, what);
  return data as T;
}

export const createPost = (board: string, title: string, body: string, verificationId?: string | null) =>
  rpc<number>('create_post', { p_board: board, p_title: title, p_body: body, p_verification: verificationId ?? null }, '글쓰기');
export const updatePost = (id: number, title: string, body: string) => rpc<void>('update_post', { p_id: id, p_title: title, p_body: body }, '글 수정');
export const deletePost = (id: number) => rpc<void>('delete_post', { p_id: id }, '글 삭제');
export const createComment = (postId: number, body: string, parentId?: number | null, verificationId?: string | null) =>
  rpc<number>('create_comment', { p_post: postId, p_body: body, p_parent: parentId ?? null, p_verification: verificationId ?? null }, '댓글');
export const deleteComment = (id: number) => rpc<void>('delete_comment', { p_id: id }, '댓글 삭제');
export const togglePostLike = (id: number) => rpc<number>('toggle_post_like', { p_id: id }, '공감');
export const toggleCommentLike = (id: number) => rpc<number>('toggle_comment_like', { p_id: id }, '공감');
export const toggleScrap = (id: number) => rpc<boolean>('toggle_scrap', { p_id: id }, '스크랩');
export const reportContent = (type: 'post' | 'comment' | 'message', id: number, reason: string, detail?: string) =>
  rpc<number>('report_content', { p_type: type, p_id: id, p_reason: reason, p_detail: detail ?? null }, '신고');
export const blockAuthor = (type: 'post' | 'comment' | 'message' | 'conversation', id: number | string) =>
  rpc<void>('block_author', { p_type: type, p_id: String(id) }, '차단');
export const clearBlocks = () => rpc<number>('clear_blocks', {}, '차단 해제');

// ───── 제재 ─────
export async function mySanctions(): Promise<Sanction[]> {
  const { data, error } = await supabase.from('my_sanctions_v').select('*').order('starts_at', { ascending: false });
  if (error) throw err(error, '이용 제한');
  return (data ?? []).map(
    (s: { id: number; level: Sanction['level']; reason: string; starts_at: string; ends_at: string | null; appeal: string | null; appeal_status: Sanction['appealStatus']; active: boolean }) => ({
      id: s.id, level: s.level, reason: s.reason, startsAt: s.starts_at, endsAt: s.ends_at, appeal: s.appeal, appealStatus: s.appeal_status, active: s.active,
    }),
  );
}
export const appealSanction = (id: number, text: string) => rpc<void>('appeal_sanction', { p_id: id, p_text: text }, '이의 신청');

// ───── 쪽지 ─────
export async function listConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase.from('my_conversations_v').select('*').order('last_at', { ascending: false });
  if (error) throw err(error, '쪽지함');
  return (data ?? []).map(
    (c: { id: string; other_label: string; my_label: string; origin_title: string | null; last_at: string; last_body: string | null; unread: number; blocked: boolean }) => ({
      id: c.id, otherLabel: c.other_label, myLabel: c.my_label, originTitle: c.origin_title, lastAt: c.last_at, lastBody: c.last_body,
      unread: Number(c.unread), blocked: c.blocked,
    }),
  );
}
export const startConversation = (type: 'post' | 'comment', id: number, verificationId?: string | null) =>
  rpc<string>('start_conversation', { p_type: type, p_id: id, p_verification: verificationId ?? null }, '쪽지');
export async function getMessages(convId: string, before?: number): Promise<Message[]> {
  const rows = await rpc<{ id: number; body: string | null; image_path: string | null; created_at: string; is_mine: boolean; read_at: string | null }[]>(
    'get_messages',
    { p_conv: convId, p_before: before ?? null },
    '쪽지',
  );
  return rows.map((m) => ({ id: m.id, body: m.body, imagePath: m.image_path, createdAt: m.created_at, isMine: m.is_mine, readAt: m.read_at })).reverse();
}

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

/** 쪽지 보내기 (사진이 있으면 먼저 비공개 저장소에 올림) */
export async function sendMessage(convId: string, body: string, imageBase64?: string | null): Promise<void> {
  let path: string | null = null;
  if (imageBase64) {
    path = `${convId}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}.jpg`;
    const { error } = await supabase.storage.from('dm-images').upload(path, b64ToBytes(imageBase64), { contentType: 'image/jpeg' });
    if (error) throw err(error, '사진 올리기');
  }
  try {
    await rpc<number>('send_message', { p_conv: convId, p_body: body, p_image: path }, '쪽지 보내기');
  } catch (e) {
    if (path) await supabase.storage.from('dm-images').remove([path]);
    throw e;
  }
}
export async function messageImageUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from('dm-images').createSignedUrls(paths, 3600);
  if (error) return {};
  const out: Record<string, string> = {};
  (data ?? []).forEach((d) => {
    if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  });
  return out;
}
export const leaveConversation = (id: string) => rpc<void>('leave_conversation', { p_conv: id }, '대화 나가기');
export const setDmOff = (off: boolean) => rpc<void>('set_dm_off', { p_off: off }, '쪽지 설정');
export async function getDmOff(uid: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('dm_off').eq('id', uid).maybeSingle();
  return !!(data as { dm_off?: boolean } | null)?.dm_off;
}
export async function unreadCount(): Promise<number> {
  const list = await listConversations().catch(() => []);
  return list.reduce((a, c) => a + (c.blocked ? 0 : c.unread), 0);
}

// ───── 운영자 ─────
export type ReportGroup = { targetType: 'post' | 'comment' | 'message'; targetId: number; reports: number; firstAt: string; reasons: string; content: string | null; contentStatus: string; authorSanctions: number };
export async function adminReports(): Promise<ReportGroup[]> {
  const { data, error } = await supabase.from('admin_reports_v').select('*').order('reports', { ascending: false });
  if (error) throw err(error, '신고 목록');
  return (data ?? []).map(
    (r: { target_type: ReportGroup['targetType']; target_id: number; reports: number; first_at: string; reasons: string; content: string | null; content_status: string; author_sanctions: number }) => ({
      targetType: r.target_type, targetId: r.target_id, reports: Number(r.reports), firstAt: r.first_at, reasons: r.reasons, content: r.content,
      contentStatus: r.content_status, authorSanctions: Number(r.author_sanctions),
    }),
  );
}
export const adminResolve = (
  type: ReportGroup['targetType'],
  id: number,
  action: 'keep' | 'hide' | 'delete',
  sanction?: Sanction['level'] | null,
  reason?: string,
  hideDays?: number | null,
) =>
  rpc<void>('admin_resolve', { p_type: type, p_id: id, p_action: action, p_sanction: sanction ?? null, p_reason: reason ?? null, p_hide_days: hideDays ?? null }, '신고 처리');
export async function adminAppeals(): Promise<{ id: number; level: Sanction['level']; reason: string; appeal: string; endsAt: string | null }[]> {
  const { data, error } = await supabase.from('admin_appeals_v').select('*').order('created_at');
  if (error) throw err(error, '이의 신청');
  return (data ?? []).map((a: { id: number; level: Sanction['level']; reason: string; appeal: string; ends_at: string | null }) => ({
    id: a.id, level: a.level, reason: a.reason, appeal: a.appeal, endsAt: a.ends_at,
  }));
}
export const adminAppeal = (id: number, accept: boolean) => rpc<void>('admin_appeal', { p_id: id, p_accept: accept }, '이의 신청 처리');

/** '3분 전' 같은 시간 표시 */
export function ago(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return '방금';
  if (d < 3600) return `${Math.floor(d / 60)}분 전`;
  if (d < 86400) return `${Math.floor(d / 3600)}시간 전`;
  const t = new Date(iso);
  const same = t.getFullYear() === new Date().getFullYear();
  return `${same ? '' : `${t.getFullYear()}.`}${t.getMonth() + 1}.${t.getDate()}`;
}
export const anonName = (n: number) => (n === 0 ? '글쓴이' : `익명${n}`);
