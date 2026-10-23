'use strict';
// 사람 대 AI 결투 (같은 최고 스테이지, 정규화 없음 — 실서비스 봇 프로필은 curveAt × 편차 g, 여기선 g = 1).
//   OLD=server/bot-curve.json NEW=c0.json,c1.json,c2.json [SC=..] [MULT=배율.json] node dev/audit-1023/duel/vsai.js
// 사람 = 새 곡선(시즌7 숙련) 프로필 + 결투 배율. AI 는 세 경우:
//  ① 지금: 옛 곡선(옛 스킬, t7 없음 → 서버가 스킬 3개만, 결투 배율 없음)
//  ② 곡선만 다시 굽기: 새 곡선이지만 서버 toProfile 이 t7·duel 을 안 실음 (스킬 3개, 배율 없음)
//  ③ 다시 굽기 + 서버가 t7·duel 칸을 읽음 (사람과 같은 규칙)
const fs = require('fs');
const L = require('./lib');
const oldA = L.makeCurveAt(L.loadCurve(process.env.OLD || L.R + '/server/bot-curve.json'));
const news = process.env.NEW.split(',').map((f) => L.makeCurveAt(L.loadCurve(f)));
const SC = JSON.parse(process.env.SC || '{}'), D = L.loadDuel(SC);
const mult = process.env.MULT ? JSON.parse(fs.readFileSync(process.env.MULT, 'utf8')) : null;
const N = Number(process.env.N || 6);
const strip = (p) => { const { t7, duel, build, power, ...r } = p; const s = L.sanitizeProfile(r); s.power = power; return s; };
const withM = (p, l) => (mult ? { ...p, duel: mult[l] } : p);
for (const st of (process.env.STAGES || '60,100,140').split(',').map(Number)) {
  const res = { 1: {}, 2: {}, 3: {} };
  let seed = 1;
  for (const l of L.LINES) for (const k of [1, 2, 3]) {
    let w = 0, n = 0;
    news.forEach((ca, ci) => {
      const me = withM(ca(l, st), l);
      for (const ol of L.LINES) {
        const ai = k === 1 ? oldA(ol, st) : k === 2 ? strip(news[(ci + 1) % news.length](ol, st)) : withM(news[(ci + 1) % news.length](ol, st), ol);
        for (let j = 0; j < N; j++) { if (D.simulateDuel(me, ai, seed++).winner === 'a') w++; n++; }
      }
    });
    res[k][l] = w / n;
  }
  const avg = (o) => Object.values(o).reduce((a, b) => a + b, 0) / L.LINES.length;
  const rng = (o) => `${L.pct(Math.min(...Object.values(o)))}~${L.pct(Math.max(...Object.values(o)))}`;
  console.log(`St${st} 사람 승률 평균 · 폭: ①지금 ${L.pct(avg(res[1]))}% (${rng(res[1])}) · ②곡선만 ${L.pct(avg(res[2]))}% (${rng(res[2])}) · ③곡선+서버 ${L.pct(avg(res[3]))}% (${rng(res[3])})`);
  if (process.env.V) for (const l of L.LINES) console.log('  ' + l.padEnd(15) + [1, 2, 3].map((k) => L.pct(res[k][l])).join(' '));
}
