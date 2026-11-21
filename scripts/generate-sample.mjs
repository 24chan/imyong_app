// 샘플 데이터 생성기 — 실제 수치가 아닙니다. 화면 개발·확인용.
// 실행: node scripts/generate-sample.mjs  → src/data/sample/*.json 을 다시 만듭니다.
// 같은 시드(seed)를 쓰므로 여러 번 실행해도 결과가 같습니다.
import { writeFileSync } from 'node:fs';

let seed = 20261118;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const between = (a, b) => a + (b - a) * rand();
const round1 = (n) => Math.round(n * 10) / 10;

const YEARS = Array.from({ length: 10 }, (_, i) => 2018 + i); // 2018~2027학년도
const CURRENT = 2027; // 지금(2026년 가을) 진행 중인 시험의 학년도
const SOURCE_ID = 'sample';

// 초등: 시도별 기본 규모와 경쟁 정도 (가상의 값)
const ELEM = {
  seoul: [320, 2.2], busan: [260, 1.4], daegu: [150, 1.5], incheon: [420, 1.6],
  gwangju: [50, 2.0], daejeon: [80, 1.9], ulsan: [120, 1.3], sejong: [70, 2.3],
  gyeonggi: [1500, 1.2], gangwon: [320, 0.9], chungbuk: [300, 1.0], chungnam: [460, 0.9],
  jeonbuk: [160, 1.1], jeonnam: [360, 0.8], gyeongbuk: [460, 0.9], gyeongnam: [520, 1.0],
  jeju: [100, 1.6],
};
// 중등: 샘플을 만드는 과목과 과목별 규모·경쟁 정도
const SEC_SUBJECTS = {
  korean: [1.0, 9], english: [1.0, 8], math: [1.1, 7], social: [0.4, 13],
  history: [0.4, 14], biology: [0.4, 11], pe: [0.6, 12], info: [0.5, 6],
};
const REGION_WEIGHT = {
  seoul: 1.6, busan: 0.9, daegu: 0.7, incheon: 0.8, gwangju: 0.4, daejeon: 0.4, ulsan: 0.3,
  sejong: 0.3, gyeonggi: 3.0, gangwon: 0.6, chungbuk: 0.6, chungnam: 0.8, jeonbuk: 0.6,
  jeonnam: 0.7, gyeongbuk: 0.8, gyeongnam: 1.0, jeju: 0.3,
};

const selection = [];
const results = [];

function addSeries(level, region, subject, base, competition, cutoffBase) {
  let size = base;
  for (const year of YEARS) {
    // 해마다 조금씩 줄어드는 흐름 + 흔들림
    size = Math.max(0, size * between(0.86, 1.06));
    const confirmed = Math.round(size);
    const preliminary = Math.max(0, Math.round(confirmed * between(0.94, 1.04)));
    for (const [stage, total] of [['preliminary', preliminary], ['confirmed', confirmed]]) {
      const disabled = Math.round(total * between(0.04, 0.07));
      selection.push({
        year, level, region, subject, stage,
        general: total - disabled, disabled, total,
        sourceId: SOURCE_ID,
        baseDate: `${year - 1}-${stage === 'preliminary' ? '08-10' : level === 'elementary' ? '09-05' : '09-25'}`,
      });
    }
    if (confirmed === 0) continue;
    const applicants = Math.round(confirmed * competition * between(0.75, 1.3));
    const isCurrent = year === CURRENT; // 올해는 접수 현황까지만 있음
    const takers = isCurrent ? null : Math.round(applicants * between(0.85, 0.95));
    const firstPassed = isCurrent ? null : Math.min(takers, Math.round(confirmed * 1.5));
    const finalPassed = isCurrent ? null : Math.min(firstPassed, confirmed);
    results.push({
      year, level, region, subject,
      applicants, takers, firstPassed,
      firstCutoff: isCurrent ? null : round1(cutoffBase + between(-6, 6)),
      finalPassed,
      sourceId: SOURCE_ID,
      baseDate: isCurrent ? `${year - 1}-10-20` : `${year}-01-${level === 'elementary' ? '10' : '25'}`,
    });
  }
}

for (const [region, [base, comp]] of Object.entries(ELEM)) {
  addSeries('elementary', region, null, base * 1.6, comp, 58 + comp * 6);
}
for (const [subject, [scale, comp]] of Object.entries(SEC_SUBJECTS)) {
  for (const [region, w] of Object.entries(REGION_WEIGHT)) {
    addSeries('secondary', region, subject, 18 * scale * w * between(0.7, 1.3), comp * between(0.7, 1.3), 62 + between(-4, 8));
  }
}

// 일정 (exam_schedules): 올해(2027학년도)만. 시도마다 며칠씩 다르게.
const schedules = [];
const pad = (n) => String(n).padStart(2, '0');
const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const PLAN = {
  elementary: {
    pre_notice: '2026-08-07', plan: '2026-09-04', receipt_start: '2026-10-05', receipt_end: '2026-10-09',
    first_exam: '2026-11-07', first_result: '2026-12-04', second_exam: '2027-01-07', final_result: '2027-01-29',
  },
  secondary: {
    pre_notice: '2026-08-07', plan: '2026-09-25', receipt_start: '2026-10-13', receipt_end: '2026-10-19',
    first_exam: '2026-11-28', first_result: '2026-12-25', second_exam: '2027-01-20', final_result: '2027-02-10',
  },
};
for (const level of ['elementary', 'secondary']) {
  for (const region of Object.keys(ELEM)) {
    const shift = Math.floor(between(0, 4)); // 시도별 0~3일 차이
    for (const [event, date] of Object.entries(PLAN[level])) {
      const sameNationwide = event === 'first_exam'; // 1차 시험일은 전국 같은 날
      schedules.push({
        year: CURRENT, level, region, event,
        date: sameNationwide ? date : addDays(date, event === 'pre_notice' ? 0 : shift),
        sourceId: SOURCE_ID,
      });
    }
  }
}

const sources = [
  {
    id: SOURCE_ID,
    title: '샘플 데이터 (실제 수치 아님)',
    publisher: '임용몽땅 개발용',
    url: null,
  },
];

const out = (name, data) =>
  writeFileSync(new URL(`../src/data/sample/${name}.json`, import.meta.url), JSON.stringify(data));
out('selection_counts', selection);
out('exam_results', results);
out('sources', sources);
out('exam_schedules', schedules);
console.log(`selection_counts ${selection.length}행, exam_results ${results.length}행`);
