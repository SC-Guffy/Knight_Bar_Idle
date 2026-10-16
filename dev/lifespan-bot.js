'use strict';
// 수명 봇 (개발용, docs/specs/balance-lifespan.md). progress-bot 의 하루를 N일 돌리며 하루마다 스냅샷 → JSON. 접속 패턴(--mode bot|heavy|casual)으로 실제 유저 근사, --rush 1 은 남는 골드로 건설 즉시 완료.
//  node dev/lifespan-bot.js --days 60 --seeds 15 --mode heavy --out life-heavy.json
//  --line <3차 id>: 그 계열만 시드 수만큼 · --build a|b|k: 시즌7 트리(src/tree7.js) 줄기의 포인트 쓰기 순서 (검사 계열, docs/specs/skill-tree-swordsaint.md)
//  --cap <시간>: 원정 한 번 길이 상한 (그 시간이 되면 귀환, docs/specs/skill-build-tree.md) · 결과에 원정마다 trips 기록
//  bot: 24시간 매 분 관리 · heavy: 08~24시 매시간 · casual: 8·12·19·23시 4번
const vm = require('vm');

const { makeGame, mentorApi, playMentors } = require('./progress-bot');
const DAY = 86400, TICK = 60;
const LINES = ['tyrant', 'skyGeneral', 'siegeMaster', 'thunderEmperor', 'archon', 'swordsaint', 'dragonlord', 'warlord', 'deadeye', 'voidArcher', 'archmage', 'frostlord', 'champion', 'tempest', 'grandmaster'];
// hours: 정각 체크인, active: [시작,끝) 시간대는 화면을 켜 두고 계속 관리, first: 첫날 몰입 시간
const MODES = { bot: null,
  heavy: { hours: [8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23], active: [20, 22], first: 4 },
  casual: { hours: [8, 12, 19, 23], active: [21, 22], first: 2 } };

function playCastle(C, S, t, cs) {
  if (!C || !C.castleUnlocked() || C.castleTickets() <= 0) return;
  if (cs.openAt == null) cs.openAt = t / 3600;
  const lim = C.castleLimitLv();
  while (C.castleTickets() > 0) {
    if (S.castle.best < lim && C.startCastle()) {
      const r = S.castle.run; r.wave = C.CASTLE_WAVES.length; r.waveLeft = C.CASTLE_WAVES.map(() => 0); r.pts = C.CASTLE_FULL_PTS;
      C.endCastle('clear'); S.phase = 'camp';
    } else if (!C.sweepCastle()) break;
  }
  for (let k = 0; k < 100; k++) {
    const id = C.CASTLE_UP_IDS.filter((i) => !C.castleUpBlocker(i)).sort((a, b) => S.castle.up[a] - S.castle.up[b])[0];
    if (!id || !C.castleUpgrade(id)) break;
  }
}

let RUSH = 0, CAP = 0, LINE = null, BUILD = 'a', OLD = 0;
function runOne({ days, seed, mode }) {
  let s = seed * 9301 + 49297; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const ctx = makeGame(); ctx.Math.random = rnd;
  if (OLD) vm.runInContext('T7_OFF = true', ctx);
  if (opt.tune) vm.runInContext(`T7_TUNE.pow = ${Number(opt.tune)}`, ctx);   // 측정용: 트리 위력 눈금
  const A = vm.runInContext(`({ S: () => S, simulate, advanceCamp, startExpedition, departBlocker, openBox, claimLoot, sellGear, doTrainAll, startBuild, enhance, enhanceBlocker,
    settleRaid, claimRaidChest, bagWeight, bagCap, upgradeBag, claimStock, trade, tradeBlocker, raidStageOf, RAID_BOSSES, RAID_TICKET_FREE, BUILDINGS, GEAR_SLOTS, isEquipped, isSetGear, autoEquip, trainCapAt, bldMax,
    classPath, changeClass, skillsOf, feedTomes, skillLv, treeNodesOf, SKILLS, canInvest, investNode, CLASSES, profile, TRAIN_MAX, rushBuild, rushPrice, endExpedition, t7On: typeof t7On === 'function' ? t7On : () => false, t7AutoSpend: typeof t7AutoSpend === 'function' ? t7AutoSpend : null, t7Spent: typeof t7Spent === 'function' ? t7Spent : () => 0, t7PathCost: typeof t7PathCost === 'function' ? t7PathCost : () => 1 })`, ctx);
  const C = vm.runInContext(`typeof startCastle === 'function' ? { castleUnlocked, castleTickets, castleLimitLv, startCastle, endCastle, sweepCastle, castleUpgrade, castleUpBlocker, CASTLE_UP_IDS, CASTLE_UP_MAX, CASTLE_WAVES, CASTLE_FULL_PTS } : null`, ctx);
  const cs = {}, M = mentorApi(ctx), ms = { duelDay: -1, mid: 0, starAt: {}, noAssume: !!C };
  const S = A.S(); S.gear.auto = true;
  if (LINE === 'swordsaint' && S.t7) S.t7.pick = true;   // 검사 단계부터 시즌7 트리 (src/tree7.js t7On)
  const line = LINE || LINES[(seed - 1) % LINES.length];
  const chain = A.classPath(line).slice(1);
  const classUp = () => {
    for (let next = chain[chain.indexOf(S.cls) + 1]; next && A.changeClass(next); next = chain[chain.indexOf(S.cls) + 1]);
    if (A.t7On()) { A.t7AutoSpend(BUILD); return; }   // 시즌7 트리 줄기: 비전서·스킬별 트리 대신 🌟 포인트
    const ids = A.skillsOf(S.cls).map((k) => k.id);
    for (let g = 0; S.tomes > 0 && g < 400; g++) { const id = ids.slice().sort((a, b) => A.skillLv(a) - A.skillLv(b))[0]; if (!id || !A.feedTomes(id, 1)) break; }
    for (const id of ids) for (const nid of Object.keys(A.treeNodesOf(A.SKILLS[id]))) for (let i = 0; i < 40 && A.canInvest(id, nid); i++) A.investNode(id, nid);
  };
  let rid = 0, t = 0, lastDay = -1, raidTop = 0;
  const trips = [];
  const sell = () => { const l = S.gear.inv.filter((x) => !A.isEquipped(x) && !A.isSetGear(x)); if (l.length) A.sellGear(l); };
  const chores = () => {
    const w = A.bagWeight();
    for (const it of S.bag) for (const x of (it.k === 'box' ? A.openBox(it) : [it])) A.claimLoot(x);
    if (S.report) { const r = S.report; trips.push({ day: +(t / DAY).toFixed(3), dur: r.dur, trips: r.trips || 1, from: r.stageFrom, to: r.stageTo, bossFail: !!r.bossFail, levels: r.levels, inn: S.bld.inn, lv: S.level }); }
    S.bag = []; S.report = null;
    A.autoEquip(); sell();
    if (S.bagHit) while (A.bagCap() < w * 1.3) { if (!A.upgradeBag()) break; }
    A.claimStock(); while (!A.tradeBlocker()) { const k = S.mats.wood <= S.mats.ore * 1.5 ? 'wood' : 'ore'; A.trade(k); }
    const day = Math.floor(t / DAY);
    if (day !== lastDay) { lastDay = day; S.raid.tickets = A.RAID_TICKET_FREE; S.tomes += 4; }
    while (S.raid.tickets > 0) {
      const ids = Object.keys(A.RAID_BOSSES).filter((id) => A.RAID_BOSSES[id].stage <= S.best && A.raidStageOf(A.RAID_BOSSES[id], 4) <= S.best);
      if (!ids.length) break;
      raidTop = Math.max(raidTop, A.RAID_BOSSES[ids[ids.length - 1]].stage);
      A.settleRaid({ id: 'r' + (++rid), boss: ids[ids.length - 1], members: ['me', 'a', 'b', 'c'].map((nickname) => ({ nickname })),
        fight: { won: true, mvp: rnd() < 0.25 ? 0 : 1, contrib: [{}, {}, {}, {}], dur: 60, timeout: false } }, 'me');
      while (S.raid.chests.length) A.claimRaidChest(0);
      sell();
    }
    classUp();
    for (const slot of Object.keys(A.GEAR_SLOTS)) for (let i = 0; i < 300 && !A.enhanceBlocker(slot) && (S.gear.enh[slot] < 15 || S.items.protect > 0); i++) A.enhance(slot, S.gear.enh[slot] >= 15);
    for (const id of Object.keys(A.BUILDINGS)) A.startBuild(id);
    A.doTrainAll();
    if (RUSH) for (let k = 0; k < 30 && S.build && S.gold >= A.rushPrice() * RUSH; k++) { A.rushBuild(); for (const id of Object.keys(A.BUILDINGS)) A.startBuild(id); A.doTrainAll(); }
    playCastle(C, S, t, cs);
    if (M) playMentors(M, S, day, t, ms);
  };
  const hours = MODES[mode];
  const isCheck = (tt) => { if (!hours) return true; const sec = tt % DAY, h = sec / 3600;
    if (tt < DAY && h >= 15 && h < 15 + hours.first) return true;   // 첫날 (봇 시계 0 = 게임 15시 아님 — 시작 시각 15시로 둔다)
    if (h >= hours.active[0] && h < hours.active[1]) return true;
    return sec % 3600 < TICK && hours.hours.includes(Math.floor(h)); };
  const snaps = [];
  const snap = () => {
    const ids = A.skillsOf(S.cls).map((k) => k.id);
    const p = A.profile();
    snaps.push({ day: t / DAY, best: S.best, level: S.level, tier: A.CLASSES[S.cls].tier,
      bld: Object.values(S.bld).reduce((a, b) => a + b, 0), bldN: Object.keys(S.bld).length,
      train: S.train.atk + S.train.hp + S.train.def + S.train.fortune,
      trainCap: 4 * A.trainCapAt(S.bld.training),
      enh: S.gear.enh.weapon + S.gear.enh.armor + S.gear.enh.ring,
      eq: Object.keys(A.GEAR_SLOTS).map((k) => { const it = S.gear.inv.find((x) => A.isEquipped(x) && x.slot === k); return it ? it.g : -1; }),
      skill: ids.length ? ids.reduce((a, id) => a + A.skillLv(id), 0) / ids.length : 0,
      mentor: M ? M.mentorStarSum() : 0, castle: S.castle ? S.castle.best : 0,
      castleUp: S.castle ? Object.values(S.castle.up).reduce((a, b) => a + b, 0) : 0,
      raidTop, power: p.power, goldLog: Math.log10(Math.max(1, S.gold)),
      ore: S.mats.ore, wood: S.mats.wood, stones: S.stones, mana: S.mats.mana, tomes: S.tomes, t7: A.t7On() ? A.t7Spent() / A.t7PathCost() : null, skills: p.skills.length });
  };
  let nextSnap = DAY;
  while (t < days * DAY) {
    if (S.phase === 'expedition') { A.simulate(TICK); if (CAP && S.phase === 'expedition' && S.trip.dur >= CAP * 3600) A.endExpedition('manual', true); if (S.phase === 'returning') A.simulate(0); }
    else if (isCheck(t)) { chores(); if (!A.departBlocker()) A.startExpedition(); else A.advanceCamp(TICK); }
    else A.advanceCamp(TICK);
    t += TICK; ctx.__T += TICK * 1000;
    if (t >= nextSnap) { snap(); nextSnap += DAY; }
  }
  return { line, snaps, trips };
}

const argv = process.argv.slice(2), opt = { days: 30, seeds: 6, mode: 'bot', out: null };
for (let i = 0; i < argv.length; i++) { const k = argv[i].replace(/^--/, ''); opt[k] = isNaN(Number(argv[i + 1])) ? argv[i + 1] : Number(argv[i + 1]); i++; }
RUSH = Number(opt.rush || 0); CAP = Number(opt.cap || 0); LINE = opt.line || null; BUILD = opt.build || 'a'; OLD = Number(opt.old || 0);
const res = [];
for (let sd = 1; sd <= opt.seeds; sd++) { const t0 = Date.now(); res.push(runOne({ days: opt.days, seed: sd, mode: opt.mode })); console.error(`seed ${sd} ${res.at(-1).line} ${((Date.now() - t0) / 1000).toFixed(0)}s best ${res.at(-1).snaps.at(-1).best}`); }
require('fs').writeFileSync(opt.out || `life-${opt.mode}.json`, JSON.stringify({ opt, res }));
