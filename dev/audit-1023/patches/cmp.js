// lifespan-bot --out JSON 여러 개를 7·10·14·21일 중앙값으로 나란히 (docs/specs/economy-build-gold.md). goldRel = log10(보유 골드 ÷ 최고 스테이지 잡몹 골드)
// node cmp.js a.json b.json ... → 7/10/14/21일 중앙값
const fs=require('fs'), path=require('path');
const med=(a)=>{const b=a.filter(x=>x!=null&&isFinite(x)).sort((x,y)=>x-y);return b.length?b[Math.floor(b.length/2)]:null;};
const days=(process.env.DAYS||'7,10,14,21').split(',').map(Number);
const lg=(s)=>Math.log10(2)+(s-1)*Math.log10(1.2);
const f=(v,d=0)=>v==null?'-':(Math.abs(v)>=1e5?v.toExponential(1):v.toFixed(d));
console.log('name day | best bld train/cap goldRel(log10 잡몹) wood ore enh lv');
for(const fn of process.argv.slice(2)){const J=JSON.parse(fs.readFileSync(fn));const n=path.basename(fn,'.json');
 for(const d of days){const rows=J.res.map(r=>r.snaps[d-1]).filter(Boolean);
  const g=k=>med(rows.map(s=>typeof k==='function'?k(s):s[k]));
  console.log(`${n.padEnd(10)} ${String(d).padStart(2)} | ${f(g('best'))} ${f(g('bld'))} ${f(g('train'))}/${f(g('trainCap'))} ${f(g(s=>s.goldLog-lg(s.best)),1)} ${f(g('wood'))} ${f(g('ore'))} ${f(g('enh'))} ${f(g('level'))}`);}
 // 건물 합 도달일
 const marks=[40,48,56,64,72,80];const out=marks.map(m=>{const ds=J.res.map(r=>{const i=r.snaps.findIndex(s=>s.bld>=m);return i<0?99:i+1;});const v=med(ds);return `${m}:${v>=99?'-':v}`;});
 console.log(`${n.padEnd(10)} 건물합 도달일 ${out.join(' ')}`);
}
