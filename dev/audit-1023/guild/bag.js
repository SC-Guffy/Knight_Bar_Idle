const vm=require('vm');
const {makeGame}=require('../../progress-bot.js');
const shared={gold:0,wood:1e6,ore:0,bld:{training:1,inn:10,storage:1,forge:1,hall:1},stock:{wood:0,ore:0,at:0,tradeDay:'',trades:0},forge:{},build:null,best:0};
const host={full:true,bindShared(S){Object.defineProperty(S,'gold',{get:()=>shared.gold,set:v=>{shared.gold=v},enumerable:false,configurable:true});
for(const k of['wood','ore'])Object.defineProperty(S.mats,k,{get:()=>shared[k],set:v=>{shared[k]=v},enumerable:false,configurable:true});
for(const k of['bld','stock','forge','build'])Object.defineProperty(S,k,{get:()=>shared[k],set:v=>{shared[k]=v},enumerable:false,configurable:true});
Object.defineProperty(S,'guildBest',{get:()=>shared.best||0,set:v=>{shared.best=v},enumerable:false,configurable:true});},
roster:()=>({list:[],rev:0}),toast(){},ready(){},addKnight(){},serverLost(){}};
const ctx=makeGame(null,host);
const r=vm.runInContext(`loadState(null); for(let i=0;i<5;i++) upgradeBag(); const before={bag:S.bagLv,wood:S.mats.wood}; const j=JSON.stringify(S); loadState(JSON.parse(j)); ({before, after:{bag:S.bagLv,wood:S.mats.wood,inn:S.bld.inn,notice:S.notice}, hasBld:'bld' in JSON.parse(j), hasStock:'stock' in JSON.parse(j)})`,ctx);
console.log(JSON.stringify(r,null,1));
