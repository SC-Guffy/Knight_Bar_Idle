const vm=require('vm');const {makeGame}=require('../../progress-bot.js');
const ctx=makeGame(null);
console.log(vm.runInContext(`(()=>{const o={};for(const s of [100,200,300]){const g=monsterStats(s,false).gold;o[s]={mobGold:g.toExponential(2),hourHunt:(g*600).toExponential(2),dgTicket1:(g*DG_TICKET_GOLD*0.5).toExponential(2)}};
let c=0,n=0;for(;n<40;n++){c+=subTicketMult(n); if(c>1e6)break;} o.ticketsFor1e6units=n;
S.bld={training:14,inn:13,storage:12,forge:14}; o.nextWood=dgNextBuildCost('wood'); o.nextOre=dgNextBuildCost('ore'); o.uvWood=dgUnitValue('wood'); o.units=DG_RUN_UNITS; return o;})()`,ctx));
