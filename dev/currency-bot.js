'use strict';
// 재화 역할 점검 봇 (개발용, docs/specs/currency-roles.md). dev/progress-bot.js 의 게임 vm 을 빌려, 같은 봇의 하루를 돌리면서
//  재화마다 "어디서 얼마 들어오고(수급처) 어디로 얼마 나갔는지(소모처)"를 장부로 적고, 소모처마다 "무슨 재화가 모자라서 못 샀는지"를 센다.
//  node dev/currency-bot.js [--days 7] [--seeds 12] [--rev HEAD] [--json out.json] [--no-dg] [--no-forge] [--raid-buy N] [--patch dev/currency-patches/a.js]
//  --patch: 게임 src 를 올린 뒤 그 파일을 같은 vm 에서 실행한다 (비용 함수를 바꿔 끼워 제안 수치를 미리 재 보기용)
// progress-bot 과 다른 점 (실제 유저에 더 가깝게):
//  - 🎰 재료의 미궁: 하루 무료 3판을 기대값으로 받는다 (dgUnitValue × 한 판 기대 칸 × 그림 비중 — 실제로 싸우진 않음). --no-dg 로 끔
//  - ⚒️ 대장간 시설(분해대·재굴림대·담금질대): 건물 다음에 싼 것부터 올린다. --no-forge 로 끔
//  - 🎟️ 레이드 입장권: 하루 N장 더 산다 (--raid-buy, 기본 0)
//  - 탑 비전서 하루 4권 가정·월드 보스·결투 시즌 없음은 progress-bot 과 같음
const vm = require('vm'), fs = require('fs');
const { makeGame, mentorApi, playMentors } = require('./progress-bot');
const DAY = 86400, TICK = 60, TOWER_TOMES_PER_DAY = 4;
const LINES = ['tyrant', 'skyGeneral', 'siegeMaster', 'thunderEmperor', 'archon', 'swordsaint', 'dragonlord', 'warlord', 'deadeye', 'voidArcher', 'archmage', 'frostlord'];
const KEYS = ['gold', 'wood', 'ore', 'mana', 'stones', 'tomes', 'books', 'bricks', 'reroll', 'protect'];

function runOne({ days, seed, rev, dg, forge, raidBuy, patch }) {
  let s = seed * 9301 + 49297; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const ctx = makeGame(rev); ctx.Math.random = rnd;
  if (patch) vm.runInContext(fs.readFileSync(patch, 'utf8'), ctx, { filename: patch });
  const A = vm.runInContext(`({ S: () => S, simulate, advanceCamp, startExpedition, departBlocker, openBox, claimLoot, sellGear, doTrainAll, startBuild, buildCost, bldMax, enhance, enhanceBlocker, enhanceCost,
    settleRaid, claimRaidChest, bagWeight, bagCap, upgradeBag, bagUpCost, claimStock, trade, tradeBlocker, raidStageOf, RAID_BOSSES, RAID_TICKET_FREE, BUILDINGS, GEAR_SLOTS, isEquipped, isSetGear, autoEquip,
    classPath, changeClass, classBlocker, CLASSES, CLASS_REQ, skillsOf, feedTomes, skillLv, treeNodesOf, SKILLS, canInvest, investNode,
    FORGE_FAC, forgeFacCost, forgeFacLv, upgradeForgeFac, forgeFacBlocker,
    buyTicket, ticketBlocker, ticketPrice,
    dgUnlocked, dgUnitValue, DG_RES, DG_RES_IDS, DG_RUN_UNITS, DG_TICKETS })`, ctx);
  const C = vm.runInContext(`typeof startCastle === 'function' ? { castleUnlocked, castleTickets, castleLimitLv, startCastle, endCastle, sweepCastle, castleUpgrade, castleUpBlocker, CASTLE_UP_IDS, CASTLE_UP_MAX, CASTLE_WAVES, CASTLE_FULL_PTS } : null`, ctx);
  const M = mentorApi(ctx), ms = { duelDay: -1, mid: 0, starAt: {}, noAssume: !!C };
  const S = A.S(); S.gear.auto = true;
  const chain = A.classPath(LINES[(seed - 1) % LINES.length]).slice(1);

  // ── 장부: 행동 하나 앞뒤로 재화를 재서 + 는 수급처, − 는 소모처로 ──
  const snap = () => ({ gold: S.gold, wood: S.mats.wood, ore: S.mats.ore, mana: S.mats.mana, stones: S.stones, tomes: S.tomes, books: S.books || 0,
    bricks: S.castle ? S.castle.bricks : 0, reroll: S.items.reroll || 0, protect: S.items.protect || 0 });
  const inc = {}, out = {};
  const led = (tag, fn) => {
    const a = snap(), r = fn(), b = snap();
    for (const k of KEYS) {
      const d = b[k] - a[k];
      if (d > 0) { (inc[k] = inc[k] || {})[tag] = (inc[k][tag] || 0) + d; }
      else if (d < 0) { (out[k] = out[k] || {})[tag] = (out[k][tag] || 0) - d; }
    }
    return r;
  };
  // ── 막힘: 소모처마다 '다음 한 번'을 살 수 없을 때 모자란 재화 ──
  const blocked = {};   // sink → { 재화: 횟수 }, checks: 확인 횟수
  const short = (sink, cost) => {
    const have = snap(); const b = blocked[sink] = blocked[sink] || { checks: 0 };
    b.checks++;
    for (const [k, v] of Object.entries(cost)) if (v > 0 && have[k] < v) b[k] = (b[k] || 0) + 1;
  };
  const daily = [];   // 하루마다 마력석 수급·소모 (그날까지 누적)
  let rid = 0, t = 0, lastDay = -1;

  const sell = () => { const l = S.gear.inv.filter((x) => !A.isEquipped(x) && !A.isSetGear(x)); if (l.length) led('장비 판매', () => A.sellGear(l)); };
  const classUp = () => {
    for (let next = chain[chain.indexOf(S.cls) + 1]; next; next = chain[chain.indexOf(S.cls) + 1]) {
      const req = A.CLASS_REQ[A.CLASSES[next].tier];
      if (S.level >= req.level) short('전직', { mana: req.mana, gold: req.gold });
      if (!led('전직', () => A.changeClass(next))) break;
    }
    const ids = A.skillsOf(S.cls).map((k) => k.id);
    led('스킬 숙련도', () => { for (let g = 0; S.tomes > 0 && g < 200; g++) { const id = ids.slice().sort((a, b) => A.skillLv(a) - A.skillLv(b))[0]; if (!id || !A.feedTomes(id, 1)) break; } });
    for (const id of ids) for (const nid of Object.keys(A.treeNodesOf(A.SKILLS[id]))) for (let i = 0; i < 40 && A.canInvest(id, nid); i++) A.investNode(id, nid);
  };
  const dungeon = () => {
    if (!dg || !A.dgUnlocked()) return;
    const wsum = A.DG_RES_IDS.reduce((a, r) => a + A.DG_RES[r].w, 0);
    led('재료의 미궁', () => {
      for (let n = 0; n < A.DG_TICKETS; n++) {
        const got = {};
        for (const r of A.DG_RES_IDS) got[r] = Math.floor(A.dgUnitValue(r) * A.DG_RUN_UNITS * A.DG_RES[r].w / wsum);
        S.gold += got.gold; S.mats.wood += got.wood; S.mats.ore += got.ore; S.mats.mana += got.mana; S.stones += got.stones; S.tomes += got.tomes;
      }
    });
  };
  const chores = () => {
    const w = A.bagWeight();
    led('원정 상자', () => { for (const it of S.bag) for (const x of (it.k === 'box' ? A.openBox(it) : [it])) A.claimLoot(x); S.bag = []; });
    S.report = null;
    A.autoEquip(); sell();
    if (S.bagHit) { short('가방', { wood: A.bagUpCost(S.bagLv) }); led('가방', () => { while (A.bagCap() < w * 1.3) if (!A.upgradeBag()) break; }); }
    led('창고 비축', () => A.claimStock());
    led('창고 교역', () => { while (!A.tradeBlocker()) A.trade(S.mats.wood <= S.mats.ore * 1.5 ? 'wood' : 'ore'); });
    const day = Math.floor(t / DAY);
    if (day !== lastDay) {
      lastDay = day; S.raid.tickets = A.RAID_TICKET_FREE;
      led('도전의 탑(가정 4권/일)', () => { S.tomes += TOWER_TOMES_PER_DAY; });
      dungeon();
      for (let n = 0; n < raidBuy; n++) { short('레이드 입장권 구매', A.ticketPrice()); if (!led('레이드 입장권 구매', () => A.buyTicket())) break; }
    }
    while (S.raid.tickets > 0) {
      const ids = Object.keys(A.RAID_BOSSES).filter((id) => A.RAID_BOSSES[id].stage <= S.best && A.raidStageOf(A.RAID_BOSSES[id], 4) <= S.best);
      if (!ids.length) break;
      led('레이드 승리', () => A.settleRaid({ id: 'r' + (++rid), boss: ids[ids.length - 1], members: ['me', 'a', 'b', 'c'].map((nickname) => ({ nickname })),
        fight: { won: true, mvp: rnd() < 0.25 ? 0 : 1, contrib: [{}, {}, {}, {}], dur: 60, timeout: false } }, 'me'));
      led('레이드 처치 상자', () => { while (S.raid.chests.length) A.claimRaidChest(0); });
      sell();
    }
    classUp();
    for (const slot of Object.keys(A.GEAR_SLOTS)) {
      for (let i = 0; i < 300 && !A.enhanceBlocker(slot) && (S.gear.enh[slot] < 15 || S.items.protect > 0); i++) led('강화', () => A.enhance(slot, S.gear.enh[slot] >= 15));
      if (S.gear.enh[slot] < 30 && (S.gear.enh[slot] < 15 || S.items.protect > 0)) short('강화', A.enhanceCost(S.gear.enh[slot]));
    }
    for (const id of Object.keys(A.BUILDINGS)) led('건물', () => A.startBuild(id));
    // 건물: 다음 레벨이 가장 싼(골드 기준) 건물을 '다음 한 번'으로 본다
    { const nx = Object.keys(A.BUILDINGS).filter((id) => S.bld[id] < A.bldMax(id)).map((id) => A.buildCost(id, S.bld[id])).sort((a, b) => a.gold - b.gold)[0]; if (nx && !S.build) short('건물', nx); }
    if (forge) {
      for (let k = 0; k < 60; k++) {
        const id = Object.keys(A.FORGE_FAC).filter((f) => A.forgeFacLv(f) < S.bld.forge).sort((a, b) => A.forgeFacLv(a) - A.forgeFacLv(b))[0];
        if (!id) break;
        if (!led('대장간 시설', () => A.upgradeForgeFac(id))) { short('대장간 시설', A.forgeFacCost(id, A.forgeFacLv(id))); break; }
      }
    }
    led('훈련', () => A.doTrainAll());
    if (C && C.castleUnlocked()) led('성벽 지키기', () => {
      const lim = C.castleLimitLv();
      while (C.castleTickets() > 0) {
        if (S.castle.best < lim && C.startCastle()) { const r = S.castle.run; r.wave = C.CASTLE_WAVES.length; r.waveLeft = C.CASTLE_WAVES.map(() => 0); r.pts = C.CASTLE_FULL_PTS; C.endCastle('clear'); S.phase = 'camp'; }
        else if (!C.sweepCastle()) break;
      }
    });
    if (C) led('성벽 업그레이드', () => { for (let k = 0; k < 100; k++) { const id = C.CASTLE_UP_IDS.filter((i) => !C.castleUpBlocker(i)).sort((a, b) => S.castle.up[a] - S.castle.up[b])[0]; if (!id || !C.castleUpgrade(id)) break; } });
    if (M) led('교관 수련', () => playMentors(M, S, day, t, ms));
  };
  while (t < days * DAY) {
    if (S.phase === 'expedition') { led('원정 사냥', () => { A.simulate(TICK); if (S.phase === 'returning') A.simulate(0); }); }
    else { chores(); if (!A.departBlocker()) A.startExpedition(); else A.advanceCamp(TICK); }
    t += TICK; ctx.__T += TICK * 1000;
    if (Math.floor(t / DAY) !== Math.floor((t - TICK) / DAY)) daily.push({ day: Math.floor(t / DAY), best: S.best, inc: JSON.parse(JSON.stringify(inc)), out: JSON.parse(JSON.stringify(out)), have: snap(), bld: { ...S.bld }, enh: { ...S.gear.enh }, forge: { ...S.forge }, cls: S.cls });
  }
  chores();
  return { inc, out, blocked, daily, have: snap(), best: S.best, bld: { ...S.bld }, enh: { ...S.gear.enh }, forge: { ...S.forge }, cls: S.cls };
}

function main() {
  const argv = process.argv.slice(2), opt = { days: 7, seeds: 12, rev: null, json: null, dg: true, forge: true, raidBuy: 0, patch: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--days') opt.days = Number(argv[++i]);
    else if (argv[i] === '--seeds') opt.seeds = Number(argv[++i]);
    else if (argv[i] === '--rev') opt.rev = argv[++i];
    else if (argv[i] === '--json') opt.json = argv[++i];
    else if (argv[i] === '--no-dg') opt.dg = false;
    else if (argv[i] === '--no-forge') opt.forge = false;
    else if (argv[i] === '--raid-buy') opt.raidBuy = Number(argv[++i]);
    else if (argv[i] === '--patch') opt.patch = argv[++i];
  }
  const runs = Array.from({ length: opt.seeds }, (_, s) => runOne({ ...opt, seed: s + 1 }));
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)] || 0; };
  const fmt = (x) => (Math.abs(x) >= 1e6 ? x.toExponential(2) : String(Math.round(x)));
  const tags = (side, k) => [...new Set(runs.flatMap((r) => Object.keys((r[side][k]) || {})))];
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const summary = { opt, best: med(runs.map((r) => r.best)), bldSum: med(runs.map((r) => sum(r.bld))), enhSum: med(runs.map((r) => sum(r.enh))), forgeSum: med(runs.map((r) => sum(r.forge))), currencies: {}, blocked: {}, daily: [] };
  console.log(`재화 장부 ${opt.days}일 · ${opt.seeds}시드 중앙값 (미궁 ${opt.dg ? '켬' : '끔'} · 시설 ${opt.forge ? '켬' : '끔'} · 레이드 구매 ${opt.raidBuy}/일${opt.patch ? ' · 패치 ' + opt.patch : ''}) · 최종 스테이지 ${summary.best} · 건물 Lv 합 ${summary.bldSum} · 강화 합 ${summary.enhSum} · 시설 Lv 합 ${summary.forgeSum}`);
  for (const k of KEYS) {
    const tin = tags('inc', k), tout = tags('out', k);
    if (!tin.length && !tout.length) continue;
    const c = summary.currencies[k] = { inc: {}, out: {}, left: med(runs.map((r) => r.have[k])) };
    for (const tg of tin) c.inc[tg] = med(runs.map((r) => (r.inc[k] || {})[tg] || 0));
    for (const tg of tout) c.out[tg] = med(runs.map((r) => (r.out[k] || {})[tg] || 0));
    const si = Object.values(c.inc).reduce((a, b) => a + b, 0), so = Object.values(c.out).reduce((a, b) => a + b, 0);
    c.totalIn = si; c.totalOut = so;
    console.log(`\n■ ${k}  수입 ${fmt(si)} · 지출 ${fmt(so)} · 남음 ${fmt(c.left)} (지출/수입 ${si ? (so / si * 100).toFixed(0) : '-'}%)`);
    for (const [tg, v] of Object.entries(c.inc).sort((a, b) => b[1] - a[1])) console.log(`   + ${tg.padEnd(20)} ${fmt(v).padStart(12)}  ${si ? (v / si * 100).toFixed(1) : 0}%`);
    for (const [tg, v] of Object.entries(c.out).sort((a, b) => b[1] - a[1])) console.log(`   − ${tg.padEnd(20)} ${fmt(v).padStart(12)}  ${so ? (v / so * 100).toFixed(1) : 0}%`);
  }
  console.log('\n■ 소모처별 막힘 (다음 한 번을 확인한 횟수 중 그 재화가 모자랐던 비율, 시드 중앙값)');
  for (const sink of [...new Set(runs.flatMap((r) => Object.keys(r.blocked)))]) {
    const b = summary.blocked[sink] = {};
    for (const k of KEYS) { const v = med(runs.map((r) => { const x = r.blocked[sink]; return x && x.checks ? (x[k] || 0) / x.checks : 0; })); if (v > 0) b[k] = v; }
    console.log(`   ${sink.padEnd(18)} ` + Object.entries(b).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(' · '));
  }
  for (let d = 0; d < opt.days; d++) {
    const rows = runs.map((r) => r.daily[d]).filter(Boolean);
    if (!rows.length) continue;
    const sumK = (row, side, k) => Object.values((row[side][k]) || {}).reduce((a, b) => a + b, 0);
    const day = { day: d + 1, best: med(rows.map((r) => r.best)), bldMax: med(rows.map((r) => Math.max(...Object.values(r.bld)))), enhMax: med(rows.map((r) => Math.max(...Object.values(r.enh)))), cur: {} };
    for (const k of ['gold', 'wood', 'ore', 'mana', 'stones', 'tomes']) {
      day.cur[k] = { inc: med(rows.map((r) => sumK(r, 'inc', k))), out: med(rows.map((r) => sumK(r, 'out', k))), have: med(rows.map((r) => r.have[k])), outBy: {} };
      for (const tg of tags('out', k)) day.cur[k].outBy[tg] = med(rows.map((r) => ((r.out[k] || {})[tg]) || 0));
    }
    summary.daily.push(day);
  }
  console.log('\n■ 마력석 하루 누적 (일: 스테이지 · 수입 / 지출 / 보유 · 지출처)');
  for (const d of summary.daily) console.log(`   ${d.day}일: ${d.best} · ${fmt(d.cur.mana.inc)} / ${fmt(d.cur.mana.out)} / ${fmt(d.cur.mana.have)} · ` + Object.entries(d.cur.mana.outBy).map(([k, v]) => `${k} ${fmt(v)}`).join(' · '));
  if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(summary, null, 1));
}
main();
