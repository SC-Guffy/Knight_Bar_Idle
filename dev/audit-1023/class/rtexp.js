const vm=require('vm');
const {ctx,errs}=require('./rt.js');
const STG=Number(process.env.STG||60), SEC=Number(process.env.SEC||300), LV=Number(process.env.LV||170);
const only=process.env.ONLY?process.env.ONLY.split(','):null;
const run=(code)=>vm.runInContext(code,ctx);
run(`var __k=0; { const __rk=rewardKill; rewardKill=function(m){__k++; return __rk(m);}; } save=()=>{}; toast=()=>{}; render=()=>{}; showBanner=()=>{};`);
const lines=run('Object.keys(T7_LINES)').filter(l=>!only||only.includes(l));
const builds=(process.env.B||'a,b,k').split(',');
const setup=(id,b)=>`(() => {
    const L = T7_LINES['${id}'];
    S = freshState(); S.cls = L.cls[2]; S.level = ${LV}; S.best = ${LV-10}; S.stage=${STG}; S.gold = 1e30; S.mats.mana = 1e6;
    const mlv = ${LV >= 170 ? 26 : 21};
    for (const slot of SKM_SLOTS) if (L.sk[slot]) S.skm[L.sk[slot]] = SKM_NEED[SKM_GRADE(slot)][mlv - 1];
    S.runes = [...RUNE_GENERIC.map((id) => ({ id, g: 3 })), { id: 'endless', g: 4 }, { id: 'echo', g: 4 }];
    if (${LV} >= 170 && typeof EVO_FUSE !== 'undefined') {
      for (const [f, [a, b]] of Object.entries(EVO_FUSE)) S.combo.p[L.sk[a] + '>' + L.sk[b]] = 3000;
      for (const m of ['gale', 'whirl', 'iaido', 'flash', 'wave', 'storm']) S.combo.p[L.sk.ult + '>' + L.sk[m]] = 1000;
    }
    t7AutoSpend('${b}');
    S.items.potion = 1e6;
  })()`;
process.stderr.write('lines '+lines.length+'\n'); const out=[];
for (const id of lines) for (const b of builds) {
  // offline
  run(setup(id,b)); run(`W=900; S.stamina=1e9; startExpedition(); S.stamina=1e9; S.run.farm=true; S.hp=stats().maxHp;`);
  const k0=run('S.trip ? JSON.stringify({k:S.trip.kills||0}) : "{}"');
  let offK=0; run('__k=0');
  run(`simulate(${SEC})`); offK=run('__k'); const offDef=run('S.trip.defeats||0');
  // realtime
  run(setup(id,b)); run(`W=900; S.stamina=1e9; startExpedition(); S.stamina=1e9; S.run.farm=true; S.hp=stats().maxHp; __k=0; monsters=[]; shots=[]; casts=[]; lapReady=false; Object.assign(knight,{x:0,down:0,cds:{},fighting:false,swing:-1});`);
  let er=null;
  try { run(`__e=0; for (let i=0;i<${SEC*30};i++){ try{ update(1/30);}catch(e){__e++; casts=[]; skfx=[]; } if(S.phase!=='expedition'){ break; } }`); er=run('__e')?'errs '+run('__e'):null; } catch(e){ er=e.message.slice(0,120)+" @ "+(e.stack.split("\n")[1]||""); }
  if(process.env.DBG) console.log(run('JSON.stringify({n:monsters.length,kx:knight.x,wl:worldLen(),hp:S.hp,m0:monsters[0]&&{x:monsters[0].x,hp:monsters[0].hp}})')); const rtK=run('__k'), ph=run('S.phase');
  out.push({id,b,offK,rtK,ratio:offK? rtK/offK:0,ph,er});
  console.log(id.padEnd(15),b,'offline',String(offK).padStart(5),'realtime',String(rtK).padStart(5),'rt/off',(offK?rtK/offK:0).toFixed(2), ph, er||'');
}
