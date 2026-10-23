'use strict';
const R=require('path').resolve(__dirname, '../../..');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { makeGame } = require(R+'/dev/progress-bot');
const { simulateDuel } = require(R+'/server/duel.js');
const { curveAt } = require(R+'/server/bots.js');
const SRC = fs.readFileSync(R+'/server/index.js', 'utf8');
const cut = (from) => { const i = SRC.indexOf(from); const j = SRC.indexOf('\n}', i); const k = SRC.indexOf('\n};', i); return SRC.slice(i, (k > 0 && k < j ? k + 3 : j + 2)); };
const sanitizeProfile = new Function(`${cut('const num = ')}\n${cut('function sanitizeProfile')}\nreturn sanitizeProfile;`)();
const N = Number(process.env.N||10), RAW = !!process.env.RAW;
const c = makeGame();
const lines = vm.runInContext('Object.keys(T7_LINES)', c);
const LVS=(process.env.LVS||'130,170').split(',').map(Number);
const profs = [];
for (const id of lines) for (const b of ['a', 'b', 'k']) for (const lv of LVS) {
  const p = vm.runInContext(`(() => {
    const L = T7_LINES[${JSON.stringify(id)}];
    S = freshState(); S.cls = L.cls[2]; S.level = ${lv}; S.best = S.stage = ${lv - 10}; S.gold = 1e30; S.mats.mana = 1e6;
    const mlv = ${lv >= 170 ? 26 : 21};
    for (const slot of SKM_SLOTS) if (L.sk[slot]) S.skm[L.sk[slot]] = SKM_NEED[SKM_GRADE(slot)][mlv - 1];
    S.runes = [...RUNE_GENERIC.map((id) => ({ id, g: 3 })), { id: 'endless', g: 4 }, { id: 'echo', g: 4 }];
    if (${lv} >= 170 && typeof EVO_FUSE !== 'undefined') {
      for (const [f, [a, b]] of Object.entries(EVO_FUSE)) S.combo.p[L.sk[a] + '>' + L.sk[b]] = 3000;
      for (const m of ['gale', 'whirl', 'iaido', 'flash', 'wave', 'storm']) S.combo.p[L.sk.ult + '>' + L.sk[m]] = 1000;
    }
    t7AutoSpend('${b}');
    const pr = profile();
    const st=stats(true); pr.__dps = dpsOf(st); pr.__hp=st.maxHp; pr.__guard=st.guard;
    return pr;
  })()`, c);
  const sp = sanitizeProfile(JSON.parse(JSON.stringify(p)));
  profs.push({ line: id, b, lv, p: sp, dps: p.__dps, power: p.__power, raw: p });
}
module.exports={profs,lines,c};
if (require.main===module){
const mult = Object.fromEntries(lines.map((l) => [l, RAW?1:vm.runInContext(`T7_DUEL_LINE[${JSON.stringify(l)}] || 1`, c)]));
const key=(x)=>x.line+'/'+x.b;
const win={}, games={}, lvW={}, lvG={}; let durs=[], tos=0, n=0; const pairDur={}; const pairW={};
let seed=7;
for (const A of profs) for (const B of profs) {
  if (A.line === B.line || A.lv !== B.lv) continue;
  const pa = { ...A.p, duel: mult[A.line] }, pb = { ...B.p, duel: mult[B.line] };
  for (let k = 0; k < N; k++) {
    const r = simulateDuel(pa, pb, seed++);
    const W = r.winner==='a'?A:B;
    for (const X of [A,B]) { games[key(X)]=(games[key(X)]||0)+1; const kl=X.line+'@'+X.lv; lvG[kl]=(lvG[kl]||0)+1; }
    win[key(W)]=(win[key(W)]||0)+1; const kl=W.line+'@'+W.lv; lvW[kl]=(lvW[kl]||0)+1;
    durs.push(r.dur); if (r.timeout) tos++; n++;
    const pk=[A.line,B.line].sort().join('-'); (pairDur[pk]=pairDur[pk]||[]).push(r.dur);
    const pw=A.line+'>'+B.line; pairW[pw]=(pairW[pw]||0)+(r.winner==='a'?1:0); pairW[pw+'#']=(pairW[pw+'#']||0)+1;
  }
}
durs.sort((a,b)=>a-b);
console.log('dur mean',(durs.reduce((a,b)=>a+b,0)/n).toFixed(1),'p10',durs[n*0.1|0],'p50',durs[n/2|0],'p90',durs[n*0.9|0],'<3s',(durs.filter(d=>d<3).length/n*100).toFixed(0)+'%','timeout',(tos/n*100).toFixed(1)+'%');
for (const l of lines) console.log(l.padEnd(15), ['a','b','k'].map(b=>b+' '+((win[l+'/'+b]||0)/games[l+'/'+b]*100).toFixed(0).padStart(3)+'%').join('  '), '|', LVS.map(lv=>lv+':'+((lvW[l+'@'+lv]||0)/lvG[l+'@'+lv]*100).toFixed(0)+'%').join(' '), 'range', profs.find(p=>p.line===l).p.range);
const pd=Object.entries(pairDur).map(([k,v])=>[k,v.reduce((a,b)=>a+b,0)/v.length]).sort((a,b)=>a[1]-b[1]);
console.log('shortest pairs', pd.slice(0,5).map(([k,v])=>k+' '+v.toFixed(1)).join(', '));
console.log('longest pairs', pd.slice(-5).map(([k,v])=>k+' '+v.toFixed(1)).join(', '));
// worst matchups
const mw=[]; for (const A of lines) for (const B of lines) if (A<B){ const w=(pairW[A+'>'+B]+ (pairW[B+'>'+A+'#']-pairW[B+'>'+A]))/(pairW[A+'>'+B+'#']+pairW[B+'>'+A+'#']); mw.push([A+' vs '+B,w]); }
mw.sort((a,b)=>Math.abs(b[1]-.5)-Math.abs(a[1]-.5));
console.log('most lopsided', mw.slice(0,10).map(([k,v])=>k+' '+(v*100).toFixed(0)+'%').join(', '));
// melee vs ranged
let mr=0,mn=0; for (const A of lines) for (const B of lines) if (A!==B){ const ra=profs.find(p=>p.line===A).p.range, rb=profs.find(p=>p.line===B).p.range; if (ra<100&&rb>=100){ mr+=pairW[A+'>'+B]+(pairW[B+'>'+A+'#']-pairW[B+'>'+A]); mn+=pairW[A+'>'+B+'#']+pairW[B+'>'+A+'#']; } }
console.log('melee vs ranged melee win', (mr/mn*100).toFixed(0)+'%');
}
