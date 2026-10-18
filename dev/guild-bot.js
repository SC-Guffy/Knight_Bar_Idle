'use strict';
// 기사단 진행 봇 (docs/specs/guild.md 4단계). 기사 여러 명을 같은 봇 시계로 나란히 돌려, 기사단 효과 크기와 공용 경제(건설 시간 벽)를 본다.
//  node dev/guild-bot.js [--days 7] [--seeds 3] [--knights 5]
//  기사 1명(기사단 없음, 보통 게임) 과 기사 N명(기사단) 을 같은 봇 하루로 돌려 나란히 표로 낸다.
// 게임은 기사마다 vm 하나(dev/progress-bot.js makeGame)에 올리고, 가짜 GUILD_HOST 로 공용 상태 하나를 묶는다 — 실제 guild.html 과 같은 bindShared·advanceBuildNow.
// 봇의 하루는 progress-bot 과 같다(원정 → 정산·장착·판매 → 창고·교역 → 레이드 3회 → 전직·비전서 → 강화 → 건설 → 훈련 → 성벽·교관).
// 슬롯: 회관 Lv 로 열린 칸만 기사가 돌고, 칸이 열리는 순간 새 기사를 만든다(따라잡기 적용). 기사마다 다른 계열(첫 기사는 시드로, 나머지는 안 쓴 계열 순).
// 수치는 '24시간 켜 둔 봇' 기준이라 실제보다 빠르다 — 1명 대비 비율로 본다.
const vm = require('vm');
const { makeGame, mentorApi, playMentors, castleApi, playCastle, LINES, TOWER_TOMES_PER_DAY, DAY, TICK } = require('./progress-bot');

const FAMILY_LINES = { swordsman: 'swordsaint', lancer: 'dragonlord', ranger: 'deadeye', mage: 'archmage', fighter: 'champion' };
const HALL_MARKS = [8, 12, 14];   // 슬롯 3·4·5칸이 열리는 회관 Lv
// 수치 맞추기용 (환경 변수): GUILD_SLOTS=1,3,6,10 (슬롯 2~5칸이 열리는 회관 Lv) · HALL_MUL=1.5 (회관 비용 배율) · HALL_FIRST=1 (회관을 먼저 짓기)
//  FX_SCALE=1 (계열 효과 단당 크기 배율) · HALL_START=15 (처음부터 회관 Lv — 효과 최대치 보기) · HALL_MAX=15 (회관 최대 Lv)
//  확정 수치 재현(10-17): HALL_FIRST=1 node dev/guild-bot.js --days 7 --seeds 5
//  SHARED_GOLD=0 (골드는 기사별 — 목재·철광석·마을만 공용인 안 비교)
//  TUNE_JSON='{"hallPerTier":3,"divPer":0,"catchupExp":1}' (src/core.js GUILD_TUNE 덮어쓰기 — 효과·따라잡기를 하나씩 꺼 보기)
const TUNE = { slots: process.env.GUILD_SLOTS ? process.env.GUILD_SLOTS.split(',').map(Number) : null, hallMul: process.env.HALL_MUL ? Number(process.env.HALL_MUL) : null,
  hallFirst: !!process.env.HALL_FIRST, fxScale: Number(process.env.FX_SCALE || 1), hallStart: Number(process.env.HALL_START || 1),
  hallMax: process.env.HALL_MAX ? Number(process.env.HALL_MAX) : null, tune: process.env.TUNE_JSON ? JSON.parse(process.env.TUNE_JSON) : null };

function freshShared() {
  return { gold: 0, wood: 0, ore: 0, bld: { training: 1, inn: 1, storage: 1, forge: 1, hall: 1 }, stock: { wood: 0, ore: 0, at: 0, tradeDay: '', trades: 0 }, forge: {}, build: null };
}

// 기사 한 명: 게임 vm + 봇 하루 (progress-bot runOne 의 기사 몫)
function makeKnight({ host, seed, line, clock, rnd }) {
  const ctx = makeGame(null, host);
  ctx.Math.random = rnd;
  if (host) vm.runInContext(`(${(t) => {
    if (t.slots) GUILD_SLOT_LV.splice(0, GUILD_SLOT_LV.length, ...t.slots);
    if (t.hallMul) BUILDINGS.hall.mul = { gold: t.hallMul, wood: t.hallMul, ore: t.hallMul, mana: 0 };
    for (const k of Object.keys(GUILD_FX)) GUILD_FX[k].per *= t.fxScale;
    if (t.hallMax) BUILDINGS.hall.max = t.hallMax;
    if (t.tune) Object.assign(GUILD_TUNE, t.tune);
  }})(${JSON.stringify(TUNE)})`, ctx);
  ctx.__T = clock.T;
  const A = vm.runInContext(`({ S: () => S, simulate, advanceCamp, startExpedition, departBlocker, openBox, claimLoot, sellGear, doTrainAll, startBuild, enhance, enhanceBlocker,
    settleRaid, claimRaidChest, bagWeight, bagCap, upgradeBag, claimStock, trade, tradeBlocker, raidStageOf, RAID_BOSSES, RAID_TICKET_FREE, BUILDINGS, GEAR_SLOTS,
    isEquipped, isSetGear, autoEquip, classPath, changeClass, skillsOf, feedTomes, skillLv, treeNodesOf, SKILLS, canInvest, investNode, profile, advanceBuildNow,
    rushPrice, guildFx: typeof guildFx === 'function' ? guildFx : () => null })`, ctx);
  const C = castleApi(ctx), cs = { openAt: null, books: 0, runs: 0, firsts: 0, doneAt: null };
  const M = mentorApi(ctx), ms = { duelDay: -1, mid: 0, starAt: {}, noAssume: !!C };
  const S = A.S(); S.gear.auto = true;
  if (host) host.bindShared(S);   // 실제 게임은 loadState 가 부른다 — 봇은 freshState 그대로라 여기서 묶는다
  const chain = A.classPath(line).slice(1);
  let rid = 0, lastDay = -1;
  const sell = () => { const l = S.gear.inv.filter((x) => !A.isEquipped(x) && !A.isSetGear(x)); if (l.length) A.sellGear(l); };
  const classUp = () => {
    for (let next = chain[chain.indexOf(S.cls) + 1]; next && A.changeClass(next); next = chain[chain.indexOf(S.cls) + 1]);
    const ids = A.skillsOf(S.cls).map((k) => k.id);
    for (let g = 0; S.tomes > 0 && g < 200; g++) { const id = ids.slice().sort((a, b) => A.skillLv(a) - A.skillLv(b))[0]; if (!id || !A.feedTomes(id, 1)) break; }
    for (const id of ids) for (const nid of Object.keys(A.treeNodesOf(A.SKILLS[id]))) for (let i = 0; i < 40 && A.canInvest(id, nid); i++) A.investNode(id, nid);
  };
  const chores = () => {
    const w = A.bagWeight();
    for (const it of S.bag) for (const x of (it.k === 'box' ? A.openBox(it) : [it])) A.claimLoot(x);
    S.bag = [];
    if (S.report) S.report = null;
    A.autoEquip(); sell();
    if (S.bagHit) while (A.bagCap() < w * 1.3) { if (!A.upgradeBag()) break; }
    A.claimStock();
    while (!A.tradeBlocker()) { const k = S.mats.wood <= S.mats.ore * 1.5 ? 'wood' : 'ore'; if (!A.trade(k)) break; }
    const day = Math.floor(clock.t / DAY);
    if (day !== lastDay) { lastDay = day; S.raid.tickets = A.RAID_TICKET_FREE; S.tomes += TOWER_TOMES_PER_DAY; }
    while (S.raid.tickets > 0) {
      const ids = Object.keys(A.RAID_BOSSES).filter((id) => A.RAID_BOSSES[id].stage <= S.best && A.raidStageOf(A.RAID_BOSSES[id], 4) <= S.best);
      if (!ids.length) break;
      A.settleRaid({ id: 'r' + (++rid), boss: ids[ids.length - 1], members: ['me', 'a', 'b', 'c'].map((nickname) => ({ nickname })),
        fight: { won: true, mvp: rnd() < 0.25 ? 0 : 1, contrib: [{}, {}, {}, {}], dur: 60, timeout: false } }, 'me');
      while (S.raid.chests.length) A.claimRaidChest(0);
      sell();
    }
    classUp();
    for (const slot of Object.keys(A.GEAR_SLOTS)) for (let i = 0; i < 300 && !A.enhanceBlocker(slot) && (S.gear.enh[slot] < 15 || S.items.protect > 0); i++) A.enhance(slot, S.gear.enh[slot] >= 15);
    for (const id of TUNE.hallFirst && A.BUILDINGS.hall ? ['hall', ...Object.keys(A.BUILDINGS)] : Object.keys(A.BUILDINGS)) A.startBuild(id);
    A.doTrainAll();
    playCastle(C, S, clock.t, cs);
    if (M) playMentors(M, S, day, clock.t, ms);
  };
  const step = () => {
    ctx.__T = clock.T;
    if (S.phase === 'expedition') { A.simulate(TICK); if (S.phase === 'returning') A.simulate(0); }
    else { chores(); if (!A.departBlocker()) A.startExpedition(); else A.advanceCamp(TICK); }
  };
  return { ctx, A, S, step, chores };
}

// 교관 승부(server/duel.js simulateDuel)는 Node 의 Math.random 을 쓴다 → 봇 한 판 동안 그것도 시드로 고정해야 같은 시드가 같은 결과를 낸다
function runGuild(o) {
  const orig = Math.random;
  let d = o.seed * 7919 + 17; Math.random = () => { d = (d * 16807) % 2147483647; return d / 2147483647; };
  try { return runGuildSeeded(o); } finally { Math.random = orig; }
}
function runGuildSeeded({ days, seed, knights }) {
  let s = seed * 9301 + 49297; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const clock = { t: 0, T: Date.UTC(2026, 0, 1, 15) };
  const guild = knights > 1;
  const shared = freshShared();
  shared.bld.hall = TUNE.hallStart;
  const roster = { list: [], rev: 0, sig: '' };
  const host = guild ? {
    full: true,
    bindShared(S) {
      if (process.env.SHARED_GOLD !== '0') Object.defineProperty(S, 'gold', { get: () => shared.gold, set: (v) => { shared.gold = v; }, enumerable: false, configurable: true });
      for (const k of ['wood', 'ore']) Object.defineProperty(S.mats, k, { get: () => shared[k], set: (v) => { shared[k] = v; }, enumerable: false, configurable: true });
      for (const k of ['bld', 'stock', 'forge', 'build']) Object.defineProperty(S, k, { get: () => shared[k], set: (v) => { shared[k] = v; }, enumerable: false, configurable: true });
    },
    roster: () => roster, toast() {}, ready() {}, addKnight() {}, serverLost() {},
  } : null;
  const ks = [];   // { k, line, fam, start, catchAt }
  const fams = [];
  const firstLine = LINES[(seed - 1) % LINES.length];
  const famOf = (line) => vm.runInContext(`classFamily(${JSON.stringify(line)})`, ks[0] ? ks[0].kn.ctx : makeGame(null));
  const addKnight = () => {
    let line;
    if (!ks.length) line = firstLine;
    else line = Object.entries(FAMILY_LINES).find(([f]) => !fams.includes(f))?.[1] || firstLine;
    const kn = makeKnight({ host, seed: seed * 10 + ks.length, line, clock, rnd });
    const fam = famOf(line);
    fams.push(fam);
    ks.push({ kn, line, fam, start: clock.t, catchAt: null, nick: 'k' + ks.length });
  };
  addKnight();
  const lvAt = {};   // 첫 기사가 레벨 L 에 처음 닿은 시각
  const hallAt = {};
  let buildTicks = 0, rushTicks = 0, buildSec = 0;
  const syncRoster = () => {
    const list = ks.map((x) => ({ nick: x.nick, cls: x.kn.S.cls, lv: x.kn.S.level })), sig = JSON.stringify(list);
    if (sig !== roster.sig) { roster.list = list; roster.sig = sig; roster.rev++; }
  };
  const slotLv = TUNE.slots || vm.runInContext('GUILD_SLOT_LV.slice()', ks[0].kn.ctx);   // 게임 값 (src/core.js)
  const slotsOpen = () => 1 + slotLv.filter((x) => shared.bld.hall >= x).length;
  const hallDay = [], slotDay = [];
  while (clock.t < days * DAY) {
    if (guild) {
      while (ks.length < Math.min(knights, slotsOpen())) addKnight();
      syncRoster();
      // 건설 시계: 기사 수와 상관없이 한 번 (실제 guild.html 처럼)
      const k0 = ks[0].kn;
      if (shared.build) {
        buildTicks++; buildSec += TICK;
        if (k0.S.gold >= k0.A.rushPrice()) rushTicks++;
      }
      k0.A.advanceBuildNow(TICK);
    } else {
      const S0 = ks[0].kn.S;
      if (S0.build) { buildTicks++; buildSec += TICK; if (S0.gold >= ks[0].kn.A.rushPrice()) rushTicks++; }
    }
    for (const x of ks) x.kn.step();
    clock.t += TICK; clock.T += TICK * 1000;
    const main = ks[0].kn.S;
    if (lvAt[main.level] == null) for (let L = 1; L <= main.level; L++) if (lvAt[L] == null) lvAt[L] = clock.t;
    for (const x of ks.slice(1)) if (x.catchAt == null && x.kn.S.level >= main.level * 0.8) { x.catchAt = clock.t; x.catchLv = x.kn.S.level; }
    for (const h of HALL_MARKS) if (hallAt[h] == null && (guild ? shared.bld.hall : 0) >= h) hallAt[h] = clock.t / 3600;
    if (clock.t % DAY === 0) { hallDay.push(guild ? shared.bld.hall : 0); slotDay.push(guild ? ks.length : 1); }
  }
  for (const x of ks) x.kn.chores();
  if (guild) syncRoster();
  const main = ks[0].kn;
  const powerOn = main.A.profile().power;
  let powerOff = powerOn, fx = null;
  if (guild) {
    fx = main.A.guildFx();
    const keep = roster.list; roster.list = []; roster.rev++;
    powerOff = main.A.profile().power;
    roster.list = keep; roster.rev++;
  }
  const bld = guild ? shared.bld : main.S.bld;
  // 따라잡기: 새 기사가 (첫 기사 Lv × 0.8) 에 닿기까지 걸린 시간 ÷ 첫 기사가 같은 레벨에 닿은 시간
  const catchRatios = ks.slice(1).filter((x) => x.catchAt != null).map((x) => {
    const own = x.catchAt - x.start, ref = lvAt[x.catchLv] || 1;
    return own / ref;
  });
  return {
    best: main.S.best, level: main.S.level, powerOn, powerOff, gain: powerOn / powerOff - 1,
    train: main.S.train.atk + main.S.train.hp + main.S.train.def + main.S.train.fortune, enh: Object.values(main.S.gear.enh).reduce((a, b) => a + b, 0),
    mentor: main.S.mentor && main.S.mentor.stars ? main.S.mentor.stars.reduce((a, b) => a + b, 0) : 0, goldEnd: main.S.gold,
    levels: ks.map((x) => x.kn.S.level), fams: ks.map((x) => x.fam), fx,
    hallAt, hall: guild ? shared.bld.hall : 0, hallDay, slotDay,
    bldSum: Object.entries(bld).filter(([k]) => k !== 'hall').reduce((a, [, v]) => a + v, 0),
    buildHours: buildSec / 3600, rushShare: buildTicks ? rushTicks / buildTicks : 0,
    gold: main.S.gold, catchRatio: catchRatios.length ? catchRatios.reduce((a, b) => a + b, 0) / catchRatios.length : null,
    knights: ks.length,
  };
}

function main() {
  const argv = process.argv.slice(2), opt = { days: 7, seeds: 3, knights: 5 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--days') opt.days = Number(argv[++i]);
    else if (argv[i] === '--seeds') opt.seeds = Number(argv[++i]);
    else if (argv[i] === '--knights') opt.knights = Number(argv[++i]);
  }
  const cols = [1, opt.knights];
  const res = cols.map((n) => Array.from({ length: opt.seeds }, (_, s) => {
    const t0 = Date.now(), r = runGuild({ days: opt.days, seed: s + 1, knights: n });
    if (process.env.GUILD_BOT_LOG) console.error(`  기사 ${n}명 시드 ${s + 1}: ${((Date.now() - t0) / 1000).toFixed(0)}s · 본캐 Lv ${r.level} 스테이지 ${r.best} · 기사 Lv ${r.levels.join('/')} · 효과 +${(r.gain * 100).toFixed(1)}%`);
    return r;
  }));
  const med = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
  const f1 = (x) => (x == null ? '-' : x.toFixed(1)), pct = (x) => (x == null ? '-' : (x * 100).toFixed(1) + '%'), int = (x) => (x == null ? '-' : String(Math.round(x)));
  const row = (name, f, fmt = int) => console.log(name.padEnd(30) + res.map((rs) => fmt(med(rs.map(f))).padStart(12)).join(''));
  console.log(`기사단 봇 ${opt.days}일 · ${opt.seeds}시드 중앙값`.padEnd(30) + cols.map((n) => `${n}명`.padStart(12)).join(''));
  row('본캐 최고 스테이지', (r) => r.best);
  row('본캐 레벨', (r) => r.level);
  row('본캐 전투력 (효과 켬)', (r) => r.powerOn, (x) => (x == null ? '-' : x.toExponential(2)));
  row('본캐 전투력 (효과 끔)', (r) => r.powerOff, (x) => (x == null ? '-' : x.toExponential(2)));
  row('기사단 효과 → 본캐 전투력', (r) => r.gain, pct);
  row('본캐 훈련 합', (r) => r.train); row('본캐 강화 합', (r) => r.enh); row('본캐 교관 별 합', (r) => r.mentor);
  row('남은 골드', (r) => r.goldEnd, (x) => (x == null ? '-' : x.toExponential(2)));
  row('기사 수 (마지막)', (r) => r.knights);
  for (let k = 1; k < opt.knights; k++) row(`기사 ${k + 1} 레벨`, (r) => r.levels[k]);
  row('계열 효과 단 합', (r) => (r.fx ? Object.values(r.fx.fam).reduce((a, x) => a + x.tier, 0) : null));
  row('다양성 n', (r) => (r.fx ? r.fx.div : null));
  row('회관 Lv', (r) => r.hall);
  for (const h of HALL_MARKS) row(`회관 Lv${h} 닿음 (일)`, (r) => (r.hallAt[h] == null ? null : r.hallAt[h] / 24), f1);
  for (let d = 0; d < opt.days; d++) row(`${d + 1}일 끝: 회관 Lv · 기사 수`, (r) => (r.hallDay[d] || 0) * 10 + (r.slotDay[d] || 0), (x) => (x == null ? '-' : `${Math.floor(x / 10)} · ${x % 10}`));
  row('마을 건물 Lv 합 (회관 빼고)', (r) => r.bldSum);
  row('건설 중이던 시간 (시간)', (r) => r.buildHours, f1);
  row('그중 즉시 완료 가능했던 비율', (r) => r.rushShare, pct);
  row('따라잡기: 걸린 시간 ÷ 본캐', (r) => r.catchRatio, (x) => (x == null ? '-' : x.toFixed(2)));
}
if (require.main === module) main();
module.exports = { runGuild };
