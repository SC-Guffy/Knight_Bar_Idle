'use strict';
// 시즌7 결투 리그 (docs/specs/skill-runes.md "결투"): 15줄기 × 빌드 a·b·k × Lv130·170 프로필을 게임 코드로 만들어(숙련·룬 포함)
// 서버 결투 계산(server/duel.js simulateDuel, 프로필은 server/index.js sanitizeProfile 그대로)으로 리그전 → 줄기별 승률.
//   node dev/duel-league.js            지금 배율(src/tree7.js T7_DUEL_LINE)로 리그 승률
//   node dev/duel-league.js --fit      줄기별 배율을 승률 50% 쪽으로 맞춰 새 값을 출력 (곱셈 갱신 8번)
// 같은 Lv 끼리 붙인다. 장비·훈련은 없음(같은 출발선) — 직업·스킬·숙련·룬 차이만 본다.
const fs = require('fs'), path = require('path'), vm = require('vm');
const { makeGame } = require('./progress-bot');
const { simulateDuel } = require('../server/duel.js');
// 서버의 프로필 정리(num · sanitizeProfile)를 그대로 가져온다 (server/index.js 는 불러오면 서버가 떠서 글을 잘라 쓴다)
const SRC = fs.readFileSync(path.join(__dirname, '../server/index.js'), 'utf8');
const cut = (from) => { const i = SRC.indexOf(from); const j = SRC.indexOf('\n}', i); const k = SRC.indexOf('\n};', i); return SRC.slice(i, (k > 0 && k < j ? k + 3 : j + 2)); };
const sanitizeProfile = new Function(`${cut('const num = ')}\n${cut('function sanitizeProfile')}\nreturn sanitizeProfile;`)();

const FIT = process.argv.includes("--fit"), ROUNDS = FIT ? 14 : 1, N = 10;
const c = makeGame();
const lines = vm.runInContext('Object.keys(T7_LINES)', c);
// 프로필: 숙련 Lv(130 → 21 · 170 → 26, 봇 중앙값) · 룬 주머니 = 범용 영웅 하나씩 + 전설 무한·잔영 → 봇 끼우기 · 장착 칸 4
const profs = [];
for (const id of lines) for (const b of ['a', 'b', 'k']) for (const lv of [130, 170]) {
  const p = vm.runInContext(`(() => {
    const L = T7_LINES[${JSON.stringify(id)}];
    S = freshState(); S.cls = L.cls[2]; S.level = ${lv}; S.best = S.stage = ${lv - 10}; S.gold = 1e30; S.mats.mana = 1e6;
    const mlv = ${lv >= 170 ? 26 : 21};
    for (const slot of SKM_SLOTS) if (L.sk[slot]) S.skm[L.sk[slot]] = SKM_NEED[SKM_GRADE(slot)][mlv - 1];
    S.runes = [...RUNE_GENERIC.map((id) => ({ id, g: 3 })), { id: 'endless', g: 4 }, { id: 'echo', g: 4 }];
    t7AutoSpend('${b}');
    return profile();
  })()`, c);
  profs.push({ line: id, b, lv, p: sanitizeProfile(JSON.parse(JSON.stringify(p))) });
}
// 지금 배율
const mult = Object.fromEntries(lines.map((l) => [l, vm.runInContext(`T7_DUEL_LINE[${JSON.stringify(l)}] || 1`, c)]));
let wr = {};
for (let round = 0; round < ROUNDS; round++) {
  const win = Object.fromEntries(lines.map((l) => [l, 0])), games = { ...win };
  let seed = 7;
  for (const A of profs) for (const B of profs) {
    if (A.line === B.line || A.lv !== B.lv) continue;
    const pa = { ...A.p, duel: mult[A.line] }, pb = { ...B.p, duel: mult[B.line] };
    for (let k = 0; k < N; k++) {
      const r = simulateDuel(pa, pb, seed++);
      const w = r.winner === 'a' ? A.line : B.line;
      win[w]++; games[A.line]++; games[B.line]++;
    }
  }
  wr = Object.fromEntries(lines.map((l) => [l, win[l] / games[l]]));
  const spread = Math.max(...Object.values(wr)) - Math.min(...Object.values(wr));
  console.log(`${FIT ? `round ${round + 1}` : '리그'} 승률 폭 ${(spread * 100).toFixed(0)}%p · ` + lines.map((l) => `${l} ${(wr[l] * 100).toFixed(0)}%`).join(' · '));
  if (!FIT) break;
  for (const l of lines) mult[l] = Math.min(3, Math.max(0.3, mult[l] * Math.pow(0.5 / Math.max(0.02, wr[l]), 0.6)));
}
if (FIT) console.log('\nconst T7_DUEL_LINE = {\n' + lines.map((l) => `  ${l}: ${mult[l].toFixed(2)},`).join('\n') + '\n};');
