'use strict';
// 파이터 실시간 시전 횟수 대 dpsOf 가 가정한 횟수 (docs/specs/class-balance-1023.md D)
//  PATCH=D LINE=champion B=a SEC=900 node dev/audit-1023/class/qilog.js
require('./patch.js');
const vm = require('vm');
const { ctx } = require('./rt.js');
const run = (c) => vm.runInContext(c, ctx);
const E = process.env, id = E.LINE || 'champion', b = E.B || 'a', SEC = Number(E.SEC || 900), STG = Number(E.STG || 50);
let seed = 7; ctx.Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
run(`var __k=0, __c={}, __fight=0, __hits=0, __crit=0; { const __rk=rewardKill; rewardKill=function(m){__k++; return __rk(m);}; } { const q=qiCast; qiCast=function(id){ __c[id]=(__c[id]||0)+1; return q(id); }; } { const o=qiOnBasic; qiOnBasic=function(n,c){ __hits++; if(c) __crit++; return o(n,c); }; } save=()=>{}; toast=()=>{}; render=()=>{}; showBanner=()=>{};`);
run(`(() => { const L = T7_LINES['${id}'];
    S = freshState(); S.cls = L.cls[2]; S.level = 170; S.best = 160; S.stage=${STG}; S.gold = 1e30; S.mats.mana = 1e6;
    for (const slot of SKM_SLOTS) if (L.sk[slot]) S.skm[L.sk[slot]] = SKM_NEED[SKM_GRADE(slot)][25];
    S.runes = [...RUNE_GENERIC.map((id) => ({ id, g: 3 })), { id: 'endless', g: 4 }, { id: 'echo', g: 4 }];
    for (const [f, [a, b]] of Object.entries(EVO_FUSE)) S.combo.p[L.sk[a] + '>' + L.sk[b]] = 3000;
    for (const m of ['gale', 'whirl', 'iaido', 'flash', 'wave', 'storm']) S.combo.p[L.sk.ult + '>' + L.sk[m]] = 1000;
    t7AutoSpend('${b}'); S.items.potion = 1e6; })()`);
run(`W=900; S.stamina=1e9; startExpedition(); S.stamina=1e9; S.run.farm=true; S.hp=stats().maxHp; __k=0; monsters=[]; shots=[]; casts=[]; lapReady=false; Object.assign(knight,{x:0,down:0,cds:{},fighting:false,swing:-1,qi:null});`);
run(`for (let i=0;i<${SEC * 30};i++){ try{ update(1/30);}catch(e){ casts=[]; skfx=[]; } if (knight.fighting) __fight+=1/30; if(S.phase!=='expedition') break; }`);
const st = run(`(() => { const st=stats(true); return { aspd: st.aspd, crit: st.crit, rate: qiRateOf(S.cls, qiStats(), S.level), sk: st.skills.map(id => [id, qiIsMain(id,S.cls)?'M':'N', skillCd(id), typeof qiNeedOf==='function'?qiNeedOf(id):qiCostOf(SKILLS[id],S.cls,{})]) }; })()`);
const fight = run('__fight'), c = run('__c'), hits = run('__hits'), crit = run('__crit');
console.log(`${id}/${b} PATCH=${E.PATCH || '-'} kills ${run('__k')} 교전 ${fight.toFixed(0)}s / ${SEC}s  평타 적중 ${hits} (초당 ${(hits / fight).toFixed(2)}, 가정 aspd ${st.aspd.toFixed(2)})  치명 ${(crit / hits * 100).toFixed(0)}% (가정 ${(st.crit * 100).toFixed(0)}%)  기 충전 가정 ${st.rate.toFixed(2)}/s`);
for (const [k, t, cd, cost] of st.sk) console.log('  ', k.padEnd(14), t, '소모', cost.toFixed(0), '등가쿨', cd, '가정 횟수', (fight / cd).toFixed(1), '실제', c[k] || 0);
