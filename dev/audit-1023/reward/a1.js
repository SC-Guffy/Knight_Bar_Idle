const vm=require('vm');const {makeGame}=require('../../progress-bot.js');
const ctx=makeGame('.');const R=(s)=>vm.runInContext(s,ctx);
R('S = (typeof freshSave==="function"?freshSave():S)');
console.log(R('typeof S'), R('Object.keys(S).slice(0,80).join(",")'));
for (const st of [1,15,30,40,65,100,150,200,250,300]) {
  R(`S.best=S.stage=${st}`);
  const o=R(`({M:monsterStats(${st},false).gold, raidT:ticketPrice().gold, towerT:towerTicketPrice().gold, dgT:dgTicketPrice().gold, cT:castleTicketPrice().gold, bl:bossLoot(${st}).gold, bl15:bossLoot(${st},1.5).gold})`);
  console.log(st, JSON.stringify(o));
}
