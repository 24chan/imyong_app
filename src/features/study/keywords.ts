import type { CsSubject } from '../../data/contentSystem';
import R from './keywordRules.json';

// 빈칸 암기 '핵심어만' (2026-11-28 확정, 사용자 전수조사 3번 반영)
// 교과마다 사람이 고른 핵심어 목록(keywordRules.json subjects: 개념·기능·태도·아이디어)에 있는 말만 가림.
// 선정 기준은 keywordRules.json '_기준'. 검토표(xlsx)도 같은 파일·같은 규칙으로 만듦 → 바꿀 땐 둘 다
export type Vocab = { subject: string; single: Set<string>; phrases: string[][] };

const JOSA = R.josa.split(' ').sort((a, b) => b.length - a.length);
const VERB = R.verb.split(' ').sort((a, b) => b.length - a.length);
const EDGE = /^[.:;'"‘’“”?!~…<>「」]+|[.:;'"‘’“”?!~…<>「」]+$/g;
const DELIM = /^(\s+|[()[\],/]+)$/;
const SUBJECTS = R.subjects as Record<string, Record<string, string[]>>;

/** 낱말과 구분 기호(띄어쓰기·괄호·쉼표·빗금)를 나눔 — 구분 기호는 가리지 않음 */
export function tokenize(text: string) {
  return text.split(/(\s+|[()[\],/]+)/).filter((x) => x.length);
}
export const isDelim = (t: string) => DELIM.test(t);

function variants(t: string) {
  const w = t.replace(EDGE, '');
  const out = new Set([w]);
  for (const j of JOSA) if (w.endsWith(j) && w.length > j.length) out.add(w.slice(0, -j.length));
  for (const v of VERB) if (w.endsWith(v) && w.length - v.length >= 2) out.add(w.slice(0, -v.length)); // '구하기'→'구' 안 만듦
  return out;
}

const cache = new Map<string, Vocab | null>();
export function vocabFor(subject: string): Vocab | null {
  if (cache.has(subject)) return cache.get(subject)!;
  const g = SUBJECTS[subject];
  let v: Vocab | null = null;
  if (g) {
    const single = new Set<string>();
    const phrases: string[][] = [];
    Object.values(g).forEach((lst) => lst.forEach((t) => (t.includes(' ') ? phrases.push(t.split(' ')) : single.add(t))));
    phrases.sort((a, b) => b.length - a.length);
    v = { subject, single, phrases };
  }
  cache.set(subject, v);
  return v;
}
export const buildVocab = (s: CsSubject) => vocabFor(s.subject);

// 목록이 없는 교과(창체·총론 등)용 일반 규칙
const STOP = new Set<string>(R.fallback_stop);
const END = new RegExp(`(${R.fallback_end})$`);
function fallbackHit(t: string) {
  const vs = [...variants(t)];
  const c = vs.reduce((a, b) => (b.length < a.length ? b : a), vs[0]);
  return c.length >= 2 && !STOP.has(c) && !END.test(c) && !/^[0-9A-Za-z]+$/.test(c);
}

/** 가릴 토큰 자리(tokenize 결과 기준) */
export function keyIdx(tokens: string[], vocab: Vocab | null) {
  const out = new Set<number>();
  const words = tokens.map((t, i) => (isDelim(t) ? -1 : i)).filter((i) => i >= 0);
  if (!vocab) {
    words.forEach((i) => fallbackHit(tokens[i]) && out.add(i));
    return out;
  }
  let k = 0;
  while (k < words.length) {
    const i = words[k];
    // 묶음 용어 먼저(긴 것부터). 낱말 사이에 띄어쓰기만 있어야 함
    const ph = vocab.phrases.find((p) => {
      if (k + p.length > words.length) return false;
      const idx = words.slice(k, k + p.length);
      for (let m = 1; m < idx.length; m++) for (let j = idx[m - 1] + 1; j < idx[m]; j++) if (!/^\s+$/.test(tokens[j])) return false;
      return p.every((w, m) => variants(tokens[idx[m]]).has(w));
    });
    if (ph) {
      words.slice(k, k + ph.length).forEach((j) => out.add(j));
      k += ph.length;
      continue;
    }
    let hit: string | undefined = [...variants(tokens[i])].find((v) => vocab.single.has(v));
    if (!hit && tokens[i].includes('·'))
      for (const part of tokens[i].replace(EDGE, '').split('·')) {
        hit = [...variants(part)].find((v) => vocab.single.has(v));
        if (hit) break;
      }
    if (hit && !(hit.length === 1 && /^(있|없)/.test(tokens[words[k + 1]] ?? ''))) out.add(i);
    k++;
  }
  return out;
}
