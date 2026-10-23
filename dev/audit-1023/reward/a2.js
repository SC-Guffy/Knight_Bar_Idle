const vm=require('vm');const {makeGame}=require('../../progress-bot.js');
const ctx=makeGame('.');const R=(s)=>vm.runInContext(s,ctx);
console.log(R('JSON.stringify(Object.entries(RAID_BOSSES).map(([k,b])=>[k,b.stage]))'));
for (const [k] of R('Object.entries(RAID_BOSSES)')) {
  console.log(k, [1,2,3,4,2.5,3.5].map(p=>p+':'+R(`raidStageAt(RAID_BOSSES.${k},${p}).toFixed(1)`)).join(' '));
}
