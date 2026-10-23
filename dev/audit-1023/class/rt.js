'use strict';
const R=require('path').resolve(__dirname, '../../..');
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(R+'/index.html','utf8');
const srcs=[...html.matchAll(/<script src="(src\/[^"]+)"><\/script>/g)].map(m=>m[1]).filter(p=>!['src/ui.js','src/net.js','src/app-gate.js'].includes(p));
function stub(){ const f=function(){}; return new Proxy(f,{get:(t,k)=>{ if(k===Symbol.toPrimitive) return ()=>0; if(k==='length')return 0; if (k in t && k!=='prototype') return t[k]; return P;}, apply:()=>P, construct:()=>P, set:()=>true}); }
const P=stub();
const ctx={console,Math:Object.create(Math),Date,JSON,Object,Array,Number,String,Boolean,Symbol,Map,Set,WeakMap,Promise,RegExp,Error,TypeError,Infinity,NaN,isFinite,isNaN,parseInt,parseFloat,URLSearchParams,Float32Array,Uint8Array,Uint8ClampedArray,Int32Array,
 localStorage:{getItem:()=>null,setItem(){},removeItem(){}},performance:{now:()=>Date.now()},location:{search:'',hostname:'localhost',href:''},navigator:{userAgent:''},
 document:P, Image:function(){return P;}, requestAnimationFrame(){},setTimeout(){},clearTimeout(){},setInterval(){},addEventListener(){},fetch:()=>new Promise(()=>{}),devicePixelRatio:1,innerWidth:800,innerHeight:600,matchMedia:()=>({matches:false,addEventListener(){}}),
 OffscreenCanvas:function(){return P;}, Path2D:function(){return P;}};
ctx.window=ctx;ctx.globalThis=ctx;ctx.self=ctx;
vm.createContext(ctx);
const errs=[];
for (const s of srcs){ try{ vm.runInContext(fs.readFileSync(R+'/'+s,'utf8'),ctx,{filename:s}); }catch(e){ errs.push(s+': '+e.message.slice(0,100)); } }
module.exports={ctx,errs};
if(require.main===module){ console.log(errs.join('\n')||'ok'); console.log(typeof ctx.update, vm.runInContext('typeof updateExpedition',ctx)); }
