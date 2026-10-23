'use strict';
// 결투 규칙 실험 한 판 (docs/specs/duel-rebalance-1023.md). 저장소 루트에서:
//   CURVES=c0.json,c1.json,c2.json SC='{"START_DIST":320}' FIT=1 LO=0.85 HI=1.25 node dev/audit-1023/duel/rig.js
//  CURVES: bake-curve.js 로 구운 곡선들 (BUILD=mix 시드 0·1·2 = 계열마다 빌드 a·b·k 한 벌씩)
//  SC: lib.loadDuel 덮어쓰기 (START_DIST·DUEL_HP·DUEL_SEC·MAX_T·fullRate·rush·noMult) · DHP='60:2,100:2.5,140:3' 스테이지별 DUEL_HP
//  MULT: 'cur'(곡선에 실린 지금 배율, 기본) | 'none'(배율 끔) | 파일.json(줄기별 배율) · FIT=1: 그 규칙에서 배율을 다시 맞춘다 (LO~HI)
//  STAGES (기본 60,100,140) · N 조합당 판 수 (기본 30) · RAW=1 이면 전투력 정규화 안 함(같은 진행도) · OUT=결과.json
const fs = require('fs');
const L = require('./lib');
const files = (process.env.CURVES || '').split(',').filter(Boolean);
if (!files.length) throw new Error('CURVES 필요');
const curves = files.map((f) => L.makeCurveAt(L.loadCurve(f)));
const STAGES = (process.env.STAGES || '60,100,140').split(',').map(Number);
const N = Number(process.env.N || 30), RAW = !!process.env.RAW;
const SC = JSON.parse(process.env.SC || '{}');
const DHP = Object.fromEntries((process.env.DHP || '').split(',').filter(Boolean).map((x) => x.split(':').map(Number)));
const MODE = process.env.MULT || 'cur';
const lines = L.LINES;

const sets = STAGES.map((st) => {
  const D = L.loadDuel({ ...SC, ...(DHP[st] ? { DUEL_HP: DHP[st] } : {}), ...(MODE === 'none' && !process.env.FIT ? { noMult: true } : {}) });
  let profs = [];
  curves.forEach((ca, ci) => {
    let ps = lines.map((line) => ({ line, ci, p: ca(line, st) }));
    if (!RAW) { const n = L.normalize(ps.map((x) => x.p)); ps = ps.map((x, i) => ({ ...x, p: n[i] })); }
    profs.push(...ps.map((x) => ({ ...x, b: x.p.build })));
  });
  return { st, D, profs };
});
let mult = null;
if (MODE !== 'cur' && MODE !== 'none') mult = JSON.parse(fs.readFileSync(MODE, 'utf8'));
if (process.env.FIT) {
  const cur = Object.fromEntries(lines.map((l) => [l, sets[0].profs.find((x) => x.line === l).p.duel || 1]));
  mult = L.fit(sets, lines, { rounds: Number(process.env.ROUNDS || 8), N: Number(process.env.FN || 10), lo: Number(process.env.LO || 0.3), hi: Number(process.env.HI || 3), start: MODE === 'none' ? null : cur });
}
const out = { SC, DHP, MODE, fit: !!process.env.FIT, mult, stages: {} };
const allWr = Object.fromEntries(lines.map((l) => [l, 0]));
for (const s of sets) {
  const r = L.league(s.D, s.profs, { N, mult, seed0: 1 });
  out.stages[s.st] = r;
  for (const l of lines) allWr[l] += r.wr[l] / sets.length;
  const v = Object.values(r.wr);
  console.log(`St${s.st}: 평균 ${r.mean.toFixed(1)}초 · p10 ${r.p10} p50 ${r.p50} p90 ${r.p90} · 3초 안 ${L.pct(r.lt3)}% · 시간 종료 ${(r.timeout * 100).toFixed(1)}% · 근접 승률 ${L.pct(r.melee)}% · 줄기 승률 ${L.pct(Math.min(...v))}~${L.pct(Math.max(...v))}% · 긴 쌍 ${r.longest.map(([k, d]) => k + ' ' + d.toFixed(0)).join(', ')}`);
}
const bspread = [];
for (const l of lines) {
  const row = sets.map((s) => L.pct(out.stages[s.st].wr[l])).join(' ');
  const bs = ['a', 'b', 'k'].map((b) => { const xs = sets.map((s) => out.stages[s.st].bwr[l + '/' + b]).filter((x) => x != null); return xs.length ? xs.reduce((a, c) => a + c, 0) / xs.length : null; });
  const bv = bs.filter((x) => x != null); if (bv.length > 1) bspread.push(Math.max(...bv) - Math.min(...bv));
  console.log(`${l.padEnd(15)} ${row} | 평균 ${L.pct(allWr[l])}% | 빌드 a/b/k ${bs.map(L.pct).join('/')} | 배율 ${(mult ? mult[l] : sets[0].profs.find((x) => x.line === l).p.duel || 1).toFixed(2)}`);
}
const av = Object.values(allWr);
console.log(`줄기 평균 승률 ${L.pct(Math.min(...av))}~${L.pct(Math.max(...av))}% · 같은 줄기 빌드 폭 최대 ${L.pct(Math.max(...bspread))}%p 평균 ${L.pct(bspread.reduce((a, b) => a + b, 0) / bspread.length)}%p`);
if (mult) console.log('배율 ' + JSON.stringify(Object.fromEntries(Object.entries(mult).map(([k, v]) => [k, +v.toFixed(2)]))));
out.allWr = allWr;
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
