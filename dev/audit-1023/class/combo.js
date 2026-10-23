const vm=require('vm');const {makeGame}=require('../../progress-bot');
const c=makeGame(); const run=x=>vm.runInContext(x,c);
const lines=run('Object.keys(T7_LINES)');
const setup=(id,b,evo)=>`(() => { const L = T7_LINES['${id}']; S = freshState(); S.cls = L.cls[2]; S.level = 170; S.best = 160; S.gold=1e30; S.mats.mana=1e6;
   for (const slot of SKM_SLOTS) if (L.sk[slot]) S.skm[L.sk[slot]] = SKM_NEED[SKM_GRADE(slot)][25];
   S.runes = [...RUNE_GENERIC.map((id) => ({ id, g: 3 })), { id: 'endless', g: 4 }, { id: 'echo', g: 4 }];
   ${evo?`for (const [f, [a, b]] of Object.entries(EVO_FUSE)) S.combo.p[L.sk[a] + '>' + L.sk[b]] = 3000;
      for (const m of ['gale', 'whirl', 'iaido', 'flash', 'wave', 'storm']) S.combo.p[L.sk.ult + '>' + L.sk[m]] = 1000;`:''}
   t7AutoSpend('${b}'); const st=stats(true); return {d:dpsOf(st), eq:[...t7Skills()], ev:[...t7Skills()].map(s=>comboEv(s).toFixed(2)).join(',')}; })()`;
const rows=[];
for (const id of lines) { const r=[]; for (const b of ['a','b','k']) { const x=run(setup(id,b,false)), y=run(setup(id,b,true)); r.push((y.d/x.d).toFixed(2)+' ['+y.ev+']'); } console.log(id.padEnd(15), r.join('  ')); }
