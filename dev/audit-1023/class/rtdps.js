'use strict';
// 실시간 원정에서 실제로 넣은 피해 ÷ dpsOf (교전 1초당) · 넘친 피해(오버킬) 몫 — 실시간과 오프라인이 어디서 갈리는지
//  PATCH=D ONLY=champion,swordsaint B=a SEC=900 node dev/audit-1023/class/rtdps.js
require('./patch.js');
const vm = require('vm');
const { ctx } = require('./rt.js');
const run = (c) => vm.runInContext(c, ctx);
const E = process.env, SEC = Number(E.SEC || 900), STG = Number(E.STG || 50), B = (E.B || 'a').split(',');
let seed = 7; ctx.Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
run(`var __k=0, __raw=0, __eff=0, __fight=0, __mob=0; { const __rk=rewardKill; rewardKill=function(m){__k++; return __rk(m);}; }
 { const h=hitMonster; hitMonster=function(m,...a){ const h0=Math.max(0,m.hp); const r=h(m,...a); const d=h0-m.hp; __raw+=Math.max(0,d); __eff+=Math.min(h0,Math.max(0,d)); return r; }; }
 save=()=>{}; toast=()=>{}; render=()=>{}; showBanner=()=>{};`);
const lines = run('Object.keys(T7_LINES)').filter((l) => !E.ONLY || E.ONLY.split(',').includes(l));
for (const id of lines) for (const b of B) {
  seed = 7;
  run(`(() => { const L = T7_LINES['${id}'];
    S = freshState(); S.cls = L.cls[2]; S.level = 170; S.best = 160; S.stage=${STG}; S.gold = 1e30; S.mats.mana = 1e6;
    for (const slot of SKM_SLOTS) if (L.sk[slot]) S.skm[L.sk[slot]] = SKM_NEED[SKM_GRADE(slot)][25];
    S.runes = [...RUNE_GENERIC.map((id) => ({ id, g: 3 })), { id: 'endless', g: 4 }, { id: 'echo', g: 4 }];
    for (const [f, [a, b]] of Object.entries(EVO_FUSE)) S.combo.p[L.sk[a] + '>' + L.sk[b]] = 3000;
    for (const m of ['gale', 'whirl', 'iaido', 'flash', 'wave', 'storm']) S.combo.p[L.sk.ult + '>' + L.sk[m]] = 1000;
    t7AutoSpend('${b}'); S.items.potion = 1e6; })()`);
  run(`W=900; S.stamina=1e9; startExpedition(); S.stamina=1e9; S.run.farm=true; S.hp=stats().maxHp; __k=0; __raw=0; __eff=0; __fight=0; __mob=0; monsters=[]; shots=[]; casts=[]; lapReady=false; Object.assign(knight,{x:0,down:0,cds:{},fighting:false,swing:-1,qi:null});`);
  run(`for (let i=0;i<${SEC * 30};i++){ try{ update(1/30);}catch(e){ casts=[]; skfx=[]; } if (knight.fighting) __fight+=1/30; if(S.phase!=='expedition') break; }`);
  const r = JSON.parse(run(`JSON.stringify({k:__k, raw:__raw, eff:__eff, fight:__fight, dps:dpsOf(stats(true)), mhp: monsterStats(S.stage,false).hp})`));
  console.log(id.padEnd(15), b, 'kills', String(r.k).padStart(3), '교전', (r.fight / SEC * 100).toFixed(0) + '%', ' 실제피해/교전초 ÷ dpsOf', (r.raw / r.fight / r.dps).toFixed(2), ' 유효(오버킬 뺌)', (r.eff / r.raw).toFixed(2), ' 잡몹 체력÷dpsOf', (r.mhp / r.dps).toFixed(1) + 's');
}
