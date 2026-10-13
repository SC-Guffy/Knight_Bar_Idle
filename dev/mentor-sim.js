'use strict';
// 🎓 교관 승부 난이도 보정 (개발용). server/mentor.js 의 배수 k 를 찾는다.
//  계열 12개의 '기준 기사'(server/bot-curve.json 을 레벨로 찾은 프로필)가 같은 레벨 교관(자기 계열 거울 × k)과 결투(server/duel.js simulateDuel)했을 때
//  평균 승률이 교관마다 목표(MENTOR_DUEL[].win)가 되는 k 를 레벨 구간별로 이분 탐색하고, 지금 k 의 승률도 같이 찍는다.
//  node dev/mentor-sim.js [--n 120] [--levels 60,80,100,130,160] [--table | --lines | --weak 0.5]
//  --weak: '레벨만 높은 기사' 확인 — 기준 기사의 공격력·체력을 그 레벨에서 강화·숙련도가 빠진 만큼(×weak) 줄여 교관1 승률을 본다
const { simulateDuel } = require('../server/duel');
const { curveAtLevel } = require('../server/bots');
const { MENTOR_DUEL, mentorProfile } = require('../server/mentor');
const CURVE = require('../server/bot-curve.json');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg('n', 120));
const LEVELS = String(arg('levels', '60,80,100,130,160')).split(',').map(Number);
const WEAK = Number(arg('weak', 0));
const LINES = Object.keys(CURVE.lines);

// 시드를 고정해 k 가 바뀌어도 같은 난수로 비교한다
function winRate(i, level, k, scale = 1, lines = LINES) {   // k 를 안 주면 server/mentor-k.json 표
  let w = 0, n = 0;
  for (const line of lines) {
    const me = curveAtLevel(line, level);
    const pa = { ...me, atk: me.atk * scale, maxHp: me.maxHp * scale };
    const pb = mentorProfile(i, level, me.cls, k);
    for (let s = 0; s < N; s++) { if (simulateDuel(pa, pb, 1000 + s).winner === 'a') w++; n++; }
  }
  return w / n;
}
function solveK(i, level, line) {
  let lo = 0.05, hi = 20;
  for (let it = 0; it < 22; it++) {
    const mid = Math.sqrt(lo * hi);
    if (winRate(i, level, mid, 1, [line]) > MENTOR_DUEL[i].win) lo = mid; else hi = mid;
  }
  return Math.sqrt(lo * hi);
}

if (WEAK) {
  for (const L of LEVELS) console.log(`Lv ${L}  기준 기사 ×${WEAK} → 교관 ${MENTOR_DUEL.map((m, i) => `${m.id} ${(winRate(i, L, undefined, WEAK) * 100).toFixed(0)}%`).join(' · ')}`);
  process.exit(0);
}
// --table: 계열 × 교관 × 레벨 k 표를 server/mentor-k.json 에 쓴다
if (process.argv.includes('--table')) {
  const out = {};
  for (const line of LINES) {
    out[line] = {};
    for (const [i, m] of MENTOR_DUEL.entries()) out[line][m.id] = LEVELS.map((L) => [L, Math.round(solveK(i, L, line) * 1000) / 1000]);
    console.log(line, MENTOR_DUEL.map((m) => `${m.id} ${out[line][m.id].map((x) => x[1]).join('/')}`).join(' · '));
  }
  require('fs').writeFileSync(require('path').join(__dirname, '..', 'server', 'mentor-k.json'), JSON.stringify(out));
  process.exit(0);
}
// --lines: 계열마다 승률 (지금 표)
if (process.argv.includes('--lines')) {
  for (const L of LEVELS) for (const [i, m] of MENTOR_DUEL.entries()) console.log(`Lv ${L} ${m.id.padEnd(6)} 목표 ${Math.round(m.win * 100)}% → ` + LINES.map((line) => `${line.slice(0, 6)} ${Math.round(winRate(i, L, undefined, 1, [line]) * 100)}%`).join(' · '));
  process.exit(0);
}
console.log(`n=${N}/계열 × ${LINES.length}계열 · 지금 표(server/mentor.js MENTOR_K)로 본 승률`);
for (const [i, m] of MENTOR_DUEL.entries()) {
  const now = LEVELS.map((L) => winRate(i, L));
  console.log(`${m.id.padEnd(7)} 목표 ${Math.round(m.win * 100)}%  레벨 ${LEVELS.join('/')} → ${now.map((x) => (x * 100).toFixed(0) + '%').join(' / ')}`);
}
