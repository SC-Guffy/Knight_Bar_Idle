'use strict';
// 15줄기 한 표: 전투력 DPS(dpsOf) · EHP · 레이드 혼자 DPS · 오프라인 처치 · 실시간 처치 · 실시간÷오프라인 (docs/specs/class-balance-1023.md)
//  지수 = 값 ÷ 15줄기 기하평균 (빌드 a·b·k 기하평균). 3차 Lv170 · 장비 없음 · 숙련 26 · 진화·연계 켬 · 범용 영웅 룬 + 무한·잔영
//  RT_ONLY=champion,tempest BASE=저장한 JSON: 실시간은 그 줄기만 돌리고 나머지는 BASE 의 값을 쓴다 (패치가 그 줄기만 바꿀 때)
//  PATCH=D,E,J,N STG=50 SEC=900 B=a,b,k RT=1 node dev/audit-1023/class/sum.js   (RT=0 이면 실시간 생략, OUT=파일 이면 JSON 저장)
require('./patch.js');
const vm = require('vm');
const { profs, lines } = require('./league2.js');
const { simulateBossFight, RAID_BOSSES } = require(__dirname + '/../../../server/raid.js');
const E = process.env;
const LV = 170, STG = Number(E.STG || 50), SEC = Number(E.SEC || 900), B = (E.B || 'a,b,k').split(','), RT = E.RT !== '0';
const gm = (a) => Math.exp(a.reduce((s, x) => s + Math.log(Math.max(1e-9, x)), 0) / a.length);
const rows = Object.fromEntries(lines.map((l) => [l, {}]));

// 1) 전투력 DPS · EHP · 레이드 혼자 (league2 프로필 = 서버로 가는 값)
const P = profs.filter((p) => p.lv === LV);
const def = RAID_BOSSES.demonking, atk = gm(P.map((p) => p.p.maxHp)) * 0.06;
for (const p of P) {
  let dmg = 0;
  for (let s = 0; s < 8; s++) { const r = simulateBossFight('demonking', def, { hp: 1e30, max: 1e30, atk }, [p.p], s + 1, { maxT: 60, enrageT: 999 }); dmg += r.contrib[0].dmg / r.dur; }
  const R = rows[p.line];
  (R.dps = R.dps || []).push(p.dps); (R.raid = R.raid || []).push(dmg / 8);
  R.ehp = p.raw.__hp / (1 - p.raw.__guard);
}
// 2) 오프라인 simulate · 실시간 world.js update (같은 기사, 같은 스테이지)
if (RT) {
  // 줄기·빌드마다 게임을 새로 올린다 (한 vm 에서 이어 돌리면 앞 줄기의 전역 상태가 남아 처치 수가 ±10% 흔들렸다)
  const fresh = () => { delete require.cache[require.resolve('./rt.js')]; return require('./rt.js').ctx; };
  let ctx, run, seed = 1;
  const boot = () => { ctx = fresh(); run = (c) => vm.runInContext(c, ctx); ctx.Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    run(`var __k=0; { const __rk=rewardKill; rewardKill=function(m){__k++; return __rk(m);}; } save=()=>{}; toast=()=>{}; render=()=>{}; showBanner=()=>{};`); };
  const SEEDS = (E.SEEDS || '7').split(',').map(Number);
  const base = E.BASE ? JSON.parse(require('fs').readFileSync(E.BASE, 'utf8')).raw : null, only = E.RT_ONLY ? E.RT_ONLY.split(',') : null;
  const setup = (id, b) => `(() => { const L = T7_LINES['${id}'];
    S = freshState(); S.cls = L.cls[2]; S.level = ${LV}; S.best = ${LV - 10}; S.stage=${STG}; S.gold = 1e30; S.mats.mana = 1e6;
    for (const slot of SKM_SLOTS) if (L.sk[slot]) S.skm[L.sk[slot]] = SKM_NEED[SKM_GRADE(slot)][25];
    S.runes = [...RUNE_GENERIC.map((id) => ({ id, g: 3 })), { id: 'endless', g: 4 }, { id: 'echo', g: 4 }${E.RUNE && E.RUNE !== 'none' ? `, { id: '${E.RUNE}', g: 4 }` : ''}];
    for (const [f, [a, b]] of Object.entries(EVO_FUSE)) S.combo.p[L.sk[a] + '>' + L.sk[b]] = 3000;
    for (const m of ['gale', 'whirl', 'iaido', 'flash', 'wave', 'storm']) S.combo.p[L.sk.ult + '>' + L.sk[m]] = 1000;
    t7AutoSpend('${b}'); S.items.potion = 1e6;
    ${E.RUNE ? `{ const eq=[...t7Skills()], sk=eq[${Number(E.RUNE_AT || 3)}]; for (const s of eq) { const i=runesOf(s).findIndex(r=>r.id==='${E.RUNE}'); if (i>=0) runeUnsock(s,i); }
      if (runesOf(sk).length) runeUnsock(sk, runesOf(sk).length-1);
      if ('${E.RUNE}' !== 'none') { const i=runeBag().findIndex(r=>r.id==='${E.RUNE}'); if (i<0 || runeWhy(sk, runeBag()[i]) || !runeSocket(sk,i)) throw new Error('rune socket fail ${E.RUNE} '+sk); } }` : ''}
  })()`;
  for (const id of lines) for (const b of B) {
    if (only && !only.includes(id)) { if (b === B[0]) { rows[id].off = [base[id].off]; rows[id].rt = [base[id].rt]; } continue; }
    let off = 0, rt = 0;
    for (const sd of SEEDS) {
    boot(); seed = sd;
    run(setup(id, b)); run(`W=900; S.stamina=1e9; startExpedition(); S.stamina=1e9; S.run.farm=true; S.hp=stats().maxHp; __k=0; simulate(${SEC});`);
    off += run('__k') / SEEDS.length;
    boot(); seed = sd;
    run(setup(id, b)); run(`W=900; S.stamina=1e9; startExpedition(); S.stamina=1e9; S.run.farm=true; S.hp=stats().maxHp; __k=0; monsters=[]; shots=[]; casts=[]; lapReady=false; Object.assign(knight,{x:0,down:0,cds:{},fighting:false,swing:-1,qi:null});`);
    run(`for (let i=0;i<${SEC * 30};i++){ try{ update(1/30);}catch(e){ casts=[]; skfx=[]; } if(S.phase!=='expedition') break; }`);
    rt += run('__k') / SEEDS.length;
    }
    const R = rows[id]; (R.off = R.off || []).push(off); (R.rt = R.rt || []).push(rt);
    process.stderr.write('.');
  }
  process.stderr.write('\n');
}
const keys = ['dps', 'ehp', 'raid', ...(RT ? ['off', 'rt'] : [])];
const v = {}; for (const l of lines) { v[l] = {}; for (const k of keys) v[l][k] = k === 'ehp' ? rows[l].ehp : gm(rows[l][k]); }
const mean = Object.fromEntries(keys.map((k) => [k, gm(lines.map((l) => v[l][k]))]));
const out = {};
console.log(`PATCH=${E.PATCH || '-'}  Lv${LV}  ${RT ? `STG=${STG} SEC=${SEC} B=${B}` : ''}`);
console.log('line            dps   ehp   raid' + (RT ? '  off   rt    rt/off  (kills off/rt)' : ''));
for (const l of lines) {
  const x = Object.fromEntries(keys.map((k) => [k, v[l][k] / mean[k]]));
  if (RT) x.ratio = v[l].rt / v[l].off;
  out[l] = x;
  console.log(l.padEnd(15), keys.map((k) => x[k].toFixed(2).padStart(5)).join(' '), RT ? ` ${x.ratio.toFixed(2)}    (${v[l].off.toFixed(0)}/${v[l].rt.toFixed(0)})` : '');
}
if (E.OUT) require('fs').writeFileSync(E.OUT, JSON.stringify({ patch: E.PATCH || '', env: { STG, SEC, B }, rows: out, raw: v }, null, 1));
