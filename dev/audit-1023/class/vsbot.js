const {profs,lines}=require('./league2.js');
const {simulateDuel}=require(__dirname + '/../../../server/duel.js');
const {curveAt}=require(__dirname + '/../../../server/bots.js');
const vm=require('vm');
// power proxy = sqrt(dps * ehp) with dps from rate (atk*crit*shots*aspd) plus skills
const pw=(p)=>{ const r=p.atk*(1+p.crit*(p.critMult-1))*p.shots*p.shotMult*p.aspd + p.skills.reduce((a,s)=>a+p.atk*s.mult*(s.crit?p.critMult:1+p.crit*(p.critMult-1))/s.cd,0); return Math.sqrt(r*(p.duel||1)*p.maxHp/(1-p.guard)); };
const out={};
for (const P of profs.filter(p=>p.lv===170)) {
  const me={...P.p, duel: P.p.duel};
  let w=0,n=0;
  for (const l of lines) { const b0=curveAt(l,140); const g=pw(me)/pw(b0); const b={...b0,atk:b0.atk*g,maxHp:b0.maxHp*g};
    for (let k=0;k<6;k++){ const r=simulateDuel(me,b,1000+n); if(r.winner==='a')w++; n++; } }
  (out[P.line]=out[P.line]||[]).push((w/n*100).toFixed(0));
}
for (const l of lines) console.log(l.padEnd(15), 'vs 봇(같은 전투력) 승률 a/b/k', out[l].join('/'));
