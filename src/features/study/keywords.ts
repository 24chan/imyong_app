import type { CsSubject } from '../../data/contentSystem';
import R from './keywordRules.json';

// 빈칸 암기 '핵심어만' (2026-11-28 사용자 전수조사 반영)
// 예전: 흔한 말만 빼고 2글자 이상이면 다 가림 → 한 문장의 70~80%가 가려짐
// 지금: 그 교과 내용 체계표 '지식·이해' 칸(내용 요소·하위 범주)에 나오는 개념어만 가림(교과별 개념어 사전)
//  + 과정·기능의 '○○하기'는 ○○(추론·요약 등)만 + 1글자 핵심어(힘·열·빛…) 예외 + 교과 이름·공통 일반어·활용꼴 제외
// 규칙 목록은 keywordRules.json 한 곳(검토표 만들기도 같은 파일)
export type Vocab = { subject: string; words: Set<string> };

const STOP = new Set<string>(R.stop);
const ONE = new Set<string>(R.one);
const JOSA = new RegExp(`(${R.josa})$`);
const END = new RegExp(`(${R.end})$`);

export function core(w: string) {
  return w.replace(/[()[\]{}.,:;'"‘’“”?!~…]/g, '').replace(/^·+|·+$/g, '').replace(JOSA, '');
}

/** 개념어가 될 수 있는 말인지. noun: 지식·이해 칸 낱말이면 '밀기·당기기'처럼 -기 명사 허용 */
function okCore(c: string, subject: string, noun = false) {
  if (!c || c === subject || STOP.has(c)) return false;
  if (c.length < 2) return ONE.has(c);
  if (/^[0-9A-Za-z]+$/.test(c)) return false;
  if (END.test(c) && !(noun && (c.includes('·') || (c.endsWith('기') && !c.endsWith('하기'))))) return false;
  return true;
}

/** 교과별 개념어 사전: 지식·이해 칸의 내용 요소 + 하위 범주 이름 */
export function buildVocab(s: CsSubject): Vocab {
  const words = new Set<string>();
  const add = (text: string) =>
    text.split(/\s+/).forEach((t) => {
      const c = core(t);
      if (okCore(c, s.subject, true)) words.add(c);
    });
  for (const a of s.areas)
    for (const r of a.rows) {
      if (!r.cat.startsWith('지식')) continue;
      add(r.sub || '');
      r.cells.forEach((c) => c.items.forEach(add));
    }
  return { subject: s.subject, words };
}

/** 가릴 낱말 자리(띄어쓰기 포함 토큰 배열 기준) */
export function keyIdx(tokens: string[], vocab: Vocab | null) {
  const out = new Set<number>();
  tokens.forEach((t, i) => {
    if (/^\s+$/.test(t)) return;
    const c = core(t);
    if (vocab ? vocab.words.has(c) : okCore(c, '')) {
      if (c.length === 1 && /^(있|없)/.test(tokens[i + 2] ?? '')) return; // '할 수 있다'의 수
      out.add(i);
      return;
    }
    if (c.endsWith('하기') && !c.includes('·')) {
      const st = c.slice(0, -2);
      if (st.length >= 2 && okCore(st, vocab?.subject ?? '')) out.add(i);
    }
  });
  return out;
}
