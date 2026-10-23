const vm=require('vm');const {ctx}=require('./rt.js');const run=c=>vm.runInContext(c,ctx);
for (const b of ['a','b','k']) for (const lv of [130,170]) {
run(`(() => { const L = T7_LINES.archon; S = freshState(); S.cls = L.cls[2]; S.level = ${lv}; S.best = ${lv-10}; S.gold=1e30; S.mats.mana=1e6;
 const mlv=${lv>=170?26:21}; for (const slot of SKM_SLOTS) if (L.sk[slot]) S.skm[L.sk[slot]] = SKM_NEED[SKM_GRADE(slot)][mlv - 1];
 S.runes = [...RUNE_GENERIC.map((id) => ({ id, g: 3 })), { id: 'endless', g: 4 }, { id: 'echo', g: 4 }];
 t7AutoSpend('${b}'); })()`);
console.log(b,lv, run(`(()=>{const id=T7_LINES.archon.sk.ult; const k=heroSkill(id); return id+' stage '+skillStage(id)+' hits '+(k.hits&&k.hits.length)+' base '+SKILLS[id].hits.length + ' t7shape ' + (typeof t7Shape==='function'? (t7Shape(id,k).hits||[]).length:'-')})()`));
}
