// 결투 밸런스 점검: 봇 성장 곡선(server/bot-curve.json)의 3차 계열 12종을 같은 최고 스테이지끼리 리그전으로 붙여
// 계열별 승률과 근접 vs 원거리 승률을 낸다. 서버 결투 계산(server/duel.js simulateDuel)을 그대로 쓴다.
//   node dev/duel-balance.js [스테이지,…] [판 수] [raw]      예) node dev/duel-balance.js 60,100,140 200
// 기본은 전투력 정규화: 계열마다 곡선상 공격력·체력이 달라 사거리 효과가 묻히므로, 공격력·체력에 같은 배수를 곱해
// 모든 계열의 전투력을 그 스테이지 평균에 맞춘다 (같은 전투력이면 근접 vs 원거리가 50% 근처여야 공정). raw 를 주면 곡선 그대로.
// 근접 = 무기 사거리 100 미만. 같은 진행도라도 장비 편차가 있으니 결과는 경향으로만 본다.
const path = require('path');
const { simulateDuel } = require(path.join(__dirname, '../server/duel.js'));
const { curveAt } = require(path.join(__dirname, '../server/bots.js'));
const CURVE = require(path.join(__dirname, '../server/bot-curve.json'));

const stages = (process.argv[2] || '40,80,120,150').split(',').map(Number);
const N = Number(process.argv[3] || 100);
const RAW = process.argv[4] === 'raw';
const lines = Object.keys(CURVE.lines);
const pct = (w, n) => (n ? ((w / n) * 100).toFixed(0).padStart(3) + '%' : '  - ');

for (const best of stages) {
  const P = Object.fromEntries(lines.map((l) => [l, curveAt(l, best)]));
  if (!RAW) {
    const avg = Math.exp(lines.reduce((a, l) => a + Math.log(P[l].power), 0) / lines.length);
    for (const l of lines) { const g = avg / P[l].power; P[l] = { ...P[l], atk: P[l].atk * g, maxHp: P[l].maxHp * g, power: avg }; }
  }
  const melee = (l) => P[l].range < 100;
  const win = Object.fromEntries(lines.map((l) => [l, 0])), games = { ...win };
  let mr = 0, mrN = 0, firstGap = 0, firstN = 0;
  let seed = 1;
  for (let i = 0; i < lines.length; i++) for (let j = 0; j < lines.length; j++) {
    if (i === j) continue;
    const A = lines[i], B = lines[j];
    for (let k = 0; k < N; k++) {
      const r = simulateDuel(P[A], P[B], seed++);
      const w = r.winner === 'a' ? A : B;
      win[w]++; games[A]++; games[B]++;
      if (melee(A) !== melee(B)) {
        mrN++; if (melee(w)) mr++;
        // 근접이 첫 피해를 넣기까지 원거리가 먼저 때린 시간
        const m = melee(A) ? 'a' : 'b', o = m === 'a' ? 'b' : 'a';
        const tm = (r.events.find((e) => e.by === m) || { t: r.dur }).t, to = (r.events.find((e) => e.by === o) || { t: r.dur }).t;
        firstGap += tm - to; firstN++;
      }
    }
  }
  console.log(`\n== 최고 스테이지 ${best} (조합당 ${N}판) ==`);
  for (const l of [...lines].sort((a, b) => win[b] / games[b] - win[a] / games[a])) {
    console.log(`${l.padEnd(15)} ${melee(l) ? '근접' : '원거리'} ${P[l].cls.padEnd(15)} 사거리 ${String(P[l].range).padStart(3)}  승률 ${pct(win[l], games[l])}`);
  }
  console.log(`근접 vs 원거리: 근접 승률 ${pct(mr, mrN)} · 원거리가 먼저 때린 시간 평균 ${(firstGap / firstN).toFixed(2)}초`);
}
