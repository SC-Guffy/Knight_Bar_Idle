const {profs,lines}=require('./league2.js');
for (const lv of [130,170]) {
  const P=profs.filter(p=>p.lv===lv);
  const gm=(f)=>Math.exp(P.reduce((a,p)=>a+Math.log(f(p)),0)/P.length);
  const md=gm(p=>p.dps), mh=gm(p=>p.raw.__hp/(1-p.raw.__guard));
  console.log('== Lv',lv,'(dps · ehp 지수, 평균=1.00)');
  for (const l of lines){ const r=['a','b','k'].map(b=>P.find(p=>p.line===l&&p.b===b)); console.log(l.padEnd(15), 'rng',String(r[0].p.range).padStart(3), 'dps', r.map(p=>(p.dps/md).toFixed(2)).join('/'), ' ehp', (r[0].raw.__hp/(1-r[0].raw.__guard)/mh).toFixed(2), 'guard',r[0].raw.__guard.toFixed(2),'heal',r[0].p.heal, 'skills', r[0].p.skills.length, 'aspd',r[0].p.aspd.toFixed(2)); }
}
