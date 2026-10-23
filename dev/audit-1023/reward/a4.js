const vm=require('vm');const {makeGame}=require('../../progress-bot.js');
const ctx=makeGame('.');const R=(s)=>vm.runInContext(s,ctx);
console.log(R('[1,2,3].map(g=>SKM_NEED[g][19]/20)'), R('SKM_SLOTS.length'));
console.log('tower base floor stage', R('[10,20,30,50,80].map(f=>f+":"+(TOWER_STAGE0+f*TOWER_STAGE_PER))'));
// tower elite at floor f vs normal mob at stage s : hp & atk ratio
console.log(R('[1,10,30].map(f=>{const s=TOWER_STAGE0+f*TOWER_STAGE_PER;const e=monsterStats(s,false);let k=s;while(monsterStats(k,false).hp<e.hp*TOWER_ELITE_HP)k++;let a=s;while(monsterStats(a,false).atk<e.atk*TOWER_ELITE_ATK)a++;return f+": hpEq "+k+" atkEq "+a})'));
