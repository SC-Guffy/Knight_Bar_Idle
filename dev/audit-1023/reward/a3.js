const vm=require('vm');const {makeGame}=require('../../progress-bot.js');
const ctx=makeGame('.');const R=(s)=>vm.runInContext(s,ctx);
for (const tags of [['shot','shot','shot','shot'],['buff','shot','buff','shot'],['single','area','area','area']]) for (const cds of [[3,3,3,3],[5,6,8,10],[1,1,1,1]]) {
 const sk=tags.map((t,i)=>({id:'s'+i,tag:t,cd:cds[i],dur:0.6,ult:false}));
 ctx.__sk=sk;
 const r=R(`(()=>{const on=comboSim(__sk,COMBO_RULE),off=comboSim(__sk,{win:0,wait:0,bonus:0});const a=__sk.reduce((x,s)=>x+on.per[s.id],0),b=__sk.reduce((x,s)=>x+off.per[s.id],0);return (a/b).toFixed(3)+' perMin '+on.perMin.toFixed(1)})()`);
 console.log(tags.join(','),cds.join(','),r);
}
