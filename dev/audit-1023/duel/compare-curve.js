'use strict';
// 봇 곡선 전후 비교 (docs/specs/duel-rebalance-1023.md "bot-curve 영향").
//   node dev/audit-1023/duel/compare-curve.js server/bot-curve.json 새0.json[,새1.json,...] [스테이지,...]
// 같은 최고 스테이지에서 계열별 전투력·공격력·체력 비(새/옛, 새 곡선 여러 벌이면 기하 평균) · 스킬 수·결투 배율 · 그 스테이지의 레벨(교관 승부 curveAtLevel) · 12일 최종 스테이지
const L = require('./lib');
const oldC = L.loadCurve(process.argv[2]);
const newCs = process.argv[3].split(',').map(L.loadCurve);
const stages = (process.argv[4] || '60,100,140,200').split(',').map(Number);
const oA = L.makeCurveAt(oldC), nA = newCs.map(L.makeCurveAt);
const g = (xs) => Math.exp(xs.reduce((a, x) => a + Math.log(x), 0) / xs.length);
const last = (c, l) => c.lines[l][c.lines[l].length - 1];
console.log('계열'.padEnd(15) + stages.map((s) => `St${s} 전투력·공·체 비 / Lv 옛→새`.padEnd(34)).join('') + '스킬 옛→새 · 배율 · 12일 최종 St 옛→새');
const tot = stages.map(() => []);
for (const l of L.LINES) {
  const cells = stages.map((s, i) => {
    const o = oA(l, s), ns = nA.map((f) => f(l, s));
    const pr = g(ns.map((n) => n.power / o.power)); tot[i].push(pr);
    return `${pr.toFixed(2)}·${g(ns.map((n) => n.atk / o.atk)).toFixed(2)}·${g(ns.map((n) => n.maxHp / o.maxHp)).toFixed(2)} / ${o.level}→${Math.round(ns.reduce((a, n) => a + n.level, 0) / ns.length)}`.padEnd(34);
  });
  const o = oA(l, 140), ns = nA.map((f) => f(l, 140));
  console.log(l.padEnd(15) + cells.join('') + `${o.skills.length}→${ns.map((n) => n.skills.length).join('/')} · ${ns.map((n) => (n.duel || 1).toFixed(2)).join('/')} · ${last(oldC, l)[0]}→${newCs.map((c) => last(c, l)[0]).join('/')}`);
}
console.log('기하 평균'.padEnd(15) + tot.map((xs) => `${g(xs).toFixed(2)} (최소 ${Math.min(...xs).toFixed(2)} 최대 ${Math.max(...xs).toFixed(2)})`.padEnd(34)).join(''));
