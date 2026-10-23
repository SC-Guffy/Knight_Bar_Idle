const {profs,lines}=require('./league2.js');
const {simulateBossFight,RAID_BOSSES}=require(__dirname + '/../../../server/raid.js');
const def=RAID_BOSSES.demonking;
for (const lv of [130,170]) {
  const P=profs.filter(p=>p.lv===lv);
  const gm=(f)=>Math.exp(P.reduce((a,p)=>a+Math.log(f(p)),0)/P.length);
  const mHp=gm(p=>p.p.maxHp);
  const atk=mHp*0.06;   // boss hit
  const res={};
  for (const pr of P) {
    let dmg=0,surv=0; const N=8;
    for (let s=0;s<N;s++){ const r=simulateBossFight('demonking',def,{hp:1e30,max:1e30,atk},[pr.p],s+1,{maxT:60,enrageT:999});
      dmg+=r.contrib[0].dmg/ r.dur; const die=r.events.find(e=>e.die!=null); surv+= die?die.t:60; }
    (res[pr.line]=res[pr.line]||[]).push({b:pr.b,dps:dmg/N,surv:surv/N});
  }
  const md=Math.exp(Object.values(res).flat().reduce((a,x)=>a+Math.log(x.dps),0)/(lines.length*3));
  console.log('== raid solo Lv',lv,'(dps 지수 a/b/k · 생존초 a/b/k, 60초 상한)');
  for (const l of lines) console.log(l.padEnd(15), res[l].map(x=>(x.dps/md).toFixed(2)).join('/'), ' surv', res[l].map(x=>x.surv.toFixed(0)).join('/'));
}
