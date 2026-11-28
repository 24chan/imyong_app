import { cached } from './repository';

// 내용 체계표(내체표) + 개념 구조도 (2026-11-24 사용자 요청)
// content-system 워크플로가 교육과정 고시문(NCIC 한글 파일)의 '내용 체계' 표를 뽑아 만든 raw-files/raw/curriculum/content_system_elementary.json
const URL = 'https://wckaybzamhvmhxiacmnx.supabase.co/storage/v1/object/public/pub/raw/curriculum/content_system_elementary.json';

export type CsCell = { items: string[]; span: number };
export type CsRow = { cat: string; sub: string; cells: CsCell[] };
export type CsArea = { area: string; ideas: string[]; grades: string[]; rows: CsRow[] };
export type CsSubject = { subject: string; era: string; school: string; file: { name: string; url: string }; areas: CsArea[] };
export type ContentSystem = { built: string; source: string; subjects: CsSubject[] };

/** 초등 교과 차례 (교육과정 고시 순서에 가깝게) */
export const ELEM_ORDER = ['국어', '사회', '도덕', '수학', '과학', '실과', '체육', '음악', '미술', '영어', '통합교과', '바른 생활', '슬기로운 생활', '즐거운 생활'];

export function getContentSystem(): Promise<ContentSystem | null> {
  return cached('content-system:elementary', async () => {
    const res = await fetch(URL);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`내용 체계표를 불러오지 못했어요 (${res.status})`);
    const d = (await res.json()) as ContentSystem;
    const rank = (s: string) => {
      const i = ELEM_ORDER.findIndex((x) => s.replace(/\s/g, '').startsWith(x.replace(/\s/g, '')));
      return i < 0 ? 99 : i;
    };
    d.subjects = d.subjects.filter((s) => s.areas.length > 0).sort((a, b) => rank(a.subject) - rank(b.subject));
    return d;
  });
}

/** 개념 구조도 노드: 교과 → 영역 → (핵심 아이디어 | 범주 → 하위 범주 → 학년군 → 내용 요소) */
export type TreeNode = { id: string; label: string; kind: 'subject' | 'area' | 'ideas' | 'cat' | 'sub' | 'grade' | 'leaf'; children: TreeNode[] };

export function buildTree(s: CsSubject): TreeNode {
  const areas: TreeNode[] = s.areas.map((a, ai) => {
    const aid = `${s.subject}/${ai}`;
    const kids: TreeNode[] = [];
    if (a.ideas.length) {
      kids.push({ id: `${aid}/ideas`, label: '핵심 아이디어', kind: 'ideas', children: a.ideas.map((t, i) => ({ id: `${aid}/ideas/${i}`, label: t, kind: 'leaf', children: [] })) });
    }
    const cats = new Map<string, TreeNode>();
    a.rows.forEach((r, ri) => {
      const ck = r.cat || '내용 요소';
      let cat = cats.get(ck);
      if (!cat) {
        cat = { id: `${aid}/c${cats.size}`, label: ck, kind: 'cat', children: [] };
        cats.set(ck, cat);
        kids.push(cat);
      }
      // 칸을 학년군으로 펼침 (합친 칸은 '3~4·5~6'처럼)
      const grades: TreeNode[] = [];
      let gi = 0;
      r.cells.forEach((c, ci) => {
        const labs = a.grades.slice(gi, gi + c.span);
        gi += c.span;
        if (!c.items.length) return;
        grades.push({
          id: `${aid}/r${ri}/g${ci}`,
          label: `${labs.join('·')}학년`,
          kind: 'grade',
          children: c.items.map((t, i) => ({ id: `${aid}/r${ri}/g${ci}/${i}`, label: t, kind: 'leaf', children: [] })),
        });
      });
      if (!grades.length) return;
      if (r.sub) cat.children.push({ id: `${aid}/r${ri}`, label: r.sub, kind: 'sub', children: grades });
      else cat.children.push(...grades);
    });
    return { id: aid, label: a.area, kind: 'area', children: kids };
  });
  return { id: s.subject, label: s.subject, kind: 'subject', children: areas };
}

export function allIds(n: TreeNode, out: string[] = []): string[] {
  if (n.children.length) {
    out.push(n.id);
    n.children.forEach((c) => allIds(c, out));
  }
  return out;
}
