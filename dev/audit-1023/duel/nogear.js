'use strict';
// 장비 없는 Lv130·170 리그 (dev/audit-1023/class/league2.js 프로필 — 빌드 a·b·k 가 같은 상태라 빌드 차이를 깨끗하게 본다)에서 규칙·배율 비교.
//   SC='{"fullRate":true,"DUEL_SEC":7.5,"HP_MULT":0.5}' MULT=cur|none|배율.json N=10 node dev/audit-1023/duel/nogear.js
const fs = require('fs');
const L = require('./lib');
const { profs: P, lines } = require('../class/league2.js');
const SC = JSON.parse(process.env.SC || '{}'), MODE = process.env.MULT || 'cur', N = Number(process.env.N || 10);
const D = L.loadDuel({ ...SC, ...(MODE === 'none' ? { noMult: true } : {}) });
const cur = Object.fromEntries(lines.map((l) => [l, P.find((x) => x.line === l).p.duel || 1]));
const mult = MODE === 'cur' || MODE === 'none' ? cur : JSON.parse(fs.readFileSync(MODE, 'utf8'));
const all = {}, ball = {};
for (const lv of [...new Set(P.map((x) => x.lv))]) {
  const profs = P.filter((x) => x.lv === lv).map((x) => ({ line: x.line, b: x.b, p: x.p }));
  const r = L.league(D, profs, { N, mult, seed0: 7 });
  const v = Object.values(r.wr);
  console.log(`Lv${lv}: 평균 ${r.mean.toFixed(1)}초 · 3초 안 ${L.pct(r.lt3)}% · 시간 종료 ${(r.timeout * 100).toFixed(1)}% · 근접 ${L.pct(r.melee)}% · 줄기 ${L.pct(Math.min(...v))}~${L.pct(Math.max(...v))}% · 긴 쌍 ${r.longest.map(([k, d]) => k + ' ' + d.toFixed(0)).join(', ')}`);
  for (const l of lines) { all[l] = (all[l] || []).concat(r.wr[l]); for (const b of ['a', 'b', 'k']) (ball[l + '/' + b] = ball[l + '/' + b] || []).push(r.bwr[l + '/' + b]); }
}
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sp = [];
for (const l of lines) {
  const bs = ['a', 'b', 'k'].map((b) => avg(ball[l + '/' + b])); sp.push(Math.max(...bs) - Math.min(...bs));
  console.log(`${l.padEnd(15)} Lv별 ${all[l].map(L.pct).join(' ')} | 빌드 a/b/k ${bs.map(L.pct).join('/')} | 배율 ${(MODE === 'none' ? 1 : mult[l]).toFixed(2)}`);
}
const av = lines.map((l) => avg(all[l]));
console.log(`줄기 평균 ${L.pct(Math.min(...av))}~${L.pct(Math.max(...av))}% · 빌드 폭 최대 ${L.pct(Math.max(...sp))}%p 평균 ${L.pct(avg(sp))}%p`);
