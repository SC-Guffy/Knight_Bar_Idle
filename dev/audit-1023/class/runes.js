const vm=require('vm');const {makeGame}=require('../../progress-bot');
const c=makeGame(); const run=x=>vm.runInContext(x,c);
const lines=run('Object.keys(T7_LINES)');
const ids=run('[...RUNE_GENERIC.map(id=>({id,g:3})), ...RUNE_SHAPES.map(id=>({id,g:3})), ...RUNE_LEG_IDS.map(id=>({id,g:4}))]');
const tot={}; const best={};
for (const id of lines) {
  run(`(() => { const L = T7_LINES['${id}']; S = freshState(); S.cls = L.cls[2]; S.level = 170; S.best = 160; S.gold=1e30; S.mats.mana=1e6;
   for (const slot of SKM_SLOTS) if (L.sk[slot]) S.skm[L.sk[slot]] = SKM_NEED[SKM_GRADE(slot)][25];
   S.runes=[]; t7AutoSpend('a'); for (const sk of t7Skills()) while (runesOf(sk).length) runeUnsock(sk,0); })()`);
  const base=run('dpsOf(stats(true))');
  const eq=run('[...t7Skills()]');
  const row=[];
  for (const r of ids) {
    // best single socket: try each equipped skill (and for scope all, just once)
    let bestV=0;
    for (const sk of eq) {
      const v=run(`(() => { S.runes=[${JSON.stringify(r)}]; const ok=runeSocket('${sk}',0); const d=ok?dpsOf(stats(true)):0; for (const s of t7Skills()) while (runesOf(s).length) runeUnsock(s,0); S.runes=[]; return d; })()`);
      bestV=Math.max(bestV,v);
    }
    const g=bestV/base; row.push([r.id,g]); tot[r.id]=(tot[r.id]||0)+Math.log(Math.max(1e-6,g));
  }
  row.sort((a,b)=>b[1]-a[1]); best[id]=row;
  console.log(id.padEnd(15), row.slice(0,4).map(([k,v])=>k+' '+v.toFixed(2)).join(' '), ' | worst', row.slice(-3).map(([k,v])=>k+' '+v.toFixed(2)).join(' '));
}
console.log('\n평균 DPS 배율 (한 칸, 가장 좋은 스킬에)');
console.log(Object.entries(tot).map(([k,v])=>[k,Math.exp(v/lines.length)]).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' '+v.toFixed(3)).join(', '));
