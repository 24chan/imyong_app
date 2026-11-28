import { cached } from './repository';
import { supabase } from '../lib/supabase';

// 1분 퀴즈 문제은행 (2026-11-28 승인: 출제 기준·15유형, 초등 전체 시험 범위)
// review/quizgen.py 가 교육과정 원문·내체표 핵심어·기출 연결로 만들고 자동 검증한 문제 → raw-files/raw/quiz/quiz_elementary.json
const URL = 'https://raw.githubusercontent.com/24chan/imyong_app/raw-files/raw/quiz/quiz_elementary.json';

/** id, t 유형, s 교과, q 문제, c 선지, a 정답 번호, f 원문 근거, g 위치, x 기출 빈출(1) */
export type QuizItem = { id: string; t: string; s: string; q: string; c: string[]; a: number; f: string; g: string; x: 0 | 1 };
export type QuizBank = { built: string; count: number; items: QuizItem[] };

export const QUIZ_SUBJECTS = ['총론', '국어', '사회', '도덕', '수학', '과학', '실과', '체육', '음악', '미술', '영어', '통합교과', '창체'];

export function getQuizBank(): Promise<QuizBank | null> {
  return cached('quiz:elementary', async () => {
    const res = await fetch(URL);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`퀴즈를 불러오지 못했어요 (${res.status})`);
    return (await res.json()) as QuizBank;
  });
}

/** 오답률은 20명 이상 푼 문제만 보여 줌 */
export const MIN_TRIES = 20;
export type QuizStat = { tries: number; wrong: number };

/** 문제별 푼 사람 수·틀린 수 (서버 SQL 0010 실행 전이면 빈 값) */
export async function getQuizStats(ids: string[]): Promise<Record<string, QuizStat>> {
  try {
    const { data, error } = await supabase.from('quiz_stats').select('qid,tries,wrong').in('qid', ids);
    if (error || !data) return {};
    return Object.fromEntries(data.map((r: { qid: string; tries: number; wrong: number }) => [r.qid, { tries: r.tries, wrong: r.wrong }]));
  } catch {
    return {};
  }
}

/** 한 문제 풀이 기록(익명, 누가 풀었는지는 남기지 않음) */
export function recordQuizAnswer(qid: string, correct: boolean) {
  supabase.rpc('record_quiz_answer', { p_qid: qid, p_correct: correct }).then(
    () => {},
    () => {},
  );
}
