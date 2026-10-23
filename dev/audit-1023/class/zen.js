const vm=require('vm');
const L2=require('./league2.js'); const {profs,lines,c}=L2;
const {simulateDuel}=require(__dirname + '/../../../server/duel.js');
const fs=require('fs');const SRC=fs.readFileSync(__dirname + '/../../../server/index.js','utf8');
const cut=(from)=>{const i=SRC.indexOf(from);const j=SRC.indexOf('\n}',i);const k=SRC.indexOf('\n};',i);return SRC.slice(i,(k>0&&k<j?k+3:j+2));};
const sanitize=new Function(`${cut('const num = ')}\n${cut('function sanitizeProfile')}\nreturn sanitizeProfile;`)();
const run=x=>vm.runInContext(x,c);
run('RUNE_BOT_LEG.zen=99');
const mult=Object.fromEntries(lines.map(l=>[l,run(`T7_DUEL_LINE['${l}']||1`)]));
for (const lv of [130,170]) { const res=[];
for (const id of lines) {
  const z=sanitize(JSON.parse(JSON.stringify(run(`(() => { const L = T7_LINES['${id}']; S = freshState(); S.cls = L.cls[2]; S.level = ${lv}; S.best = ${lv-10}; S.gold=1e30; S.mats.mana=1e6;
   for (const slot of SKM_SLOTS) if (L.sk[slot]) S.skm[L.sk[slot]] = SKM_NEED[SKM_GRADE(slot)][${lv>=170?25:20}];
   S.runes = [...RUNE_GENERIC.map((id) => ({ id, g: 3 })), { id: 'zen', g: 4 }, { id: 'echo', g: 4 }];
   t7AutoSpend('a'); return profile(); })()`))));
  const base=profs.find(p=>p.line===id&&p.b==='a'&&p.lv===lv).p;
  let wz=0,wb=0,n=0,s=1;
  for (const B of profs) if (B.lv===lv && B.line!==id) for (let k=0;k<6;k++){ const pb={...B.p,duel:mult[B.line]};
    if (simulateDuel({...z,duel:mult[id]},pb,s).winner==='a') wz++; if (simulateDuel({...base,duel:mult[id]},pb,s).winner==='a') wb++; s++; n++; }
  res.push(id+' '+(wb/n*100).toFixed(0)+'→'+(wz/n*100).toFixed(0));
}
console.log('Lv',lv,'빌드 a 결투 승률 (끝없는→무념):', res.join(', ')); }
