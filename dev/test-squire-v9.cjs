const fs=require('fs'),vm=require('vm'),cp=require('child_process'),assert=require('assert');
const metaText=fs.readFileSync('src/sprites/meta.js','utf8'),current=fs.readFileSync('src/sprites.js','utf8');
function context(source){const c=vm.createContext({PX:3,CLASSES:{},location:{search:''}});vm.runInContext(metaText+'\n'+source+'\nthis.select=sheetFrame;this.metas=SHEET_META;',c);return c}
const now=context(current),before=context(cp.execFileSync('git',['show','HEAD:src/sprites.js'],{encoding:'utf8'}));let count=0;
for(const [id,m] of Object.entries(now.metas))for(let i=0;i<=100;i++)for(const extra of [{},{combo:1},{ranged:true},{mode:'walk',walkT:i/10},{mode:'stand',t:i/10},{mode:'sit',t:i/10}]){
 const pose={swing:i/100,...extra};const a=now.select(m,pose);assert(a.f>=0&&a.f<m.anims[a.anim].frames);
 if(id!=='squire')assert.deepStrictEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(before.select(m,pose))));count++;
}
const m=now.metas.squire;assert.strictEqual(now.select(m,{swing:.34999}).f,2);assert.strictEqual(now.select(m,{swing:.35}).f,3);assert.strictEqual(now.select(m,{swing:1}).f,7);
const timeline=[];for(let ms=0;ms<385;ms+=5)timeline.push({ms,...now.select(m,{swing:ms/385})});
fs.writeFileSync('docs/motion-audit/generated/squire-cut-v9/game-timeline.json',JSON.stringify(timeline));
console.log(count+' frame selections valid; all other classes match previous selection; squire hit exactly 35%.');
