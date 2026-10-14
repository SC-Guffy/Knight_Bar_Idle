'use strict';
// 성장 출처별 몫 (개발용, 밸런스 점검). 진행 봇의 게임 vm 으로 계열 하나를 며칠 돌리면서 최고 스테이지가 오를 때마다
//  전투력(core.js powerOf)을 '훈련을 0으로' · '장비를 벗기면' 했을 때와 비교해, 시작(Lv1 맨몸)부터 지금까지 쌓인 전투력 성장(로그) 중
//  훈련·장비가 각각 몇 %를 맡았는지 찍는다. 체감 비율(훈련 : 장비)을 맞출 때 쓴다 — docs/specs/growth-compression.md
//  node dev/growth-share.js [--days 10] [--every 20] [--lines tyrant,archmage] [--rev <커밋>]
const vm = require('vm');
const { makeGame } = require('./progress-bot');

const DAY = 86400, TICK = 60;
const argv = process.argv.slice(2), opt = { days: 10, every: 20, lines: ['tyrant', 'archmage', 'deadeye'], rev: undefined };
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--days') opt.days = Number(argv[++i]);
  else if (argv[i] === '--every') opt.every = Number(argv[++i]);
  else if (argv[i] === '--lines') opt.lines = argv[++i].split(',');
  else if (argv[i] === '--rev') opt.rev = argv[++i];
}

function runLine(line, seed) {
  let s = seed * 9301 + 49297; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const ctx = makeGame(opt.rev); ctx.Math.random = rnd;
  const A = vm.runInContext(`({ S: () => S, simulate, advanceCamp, startExpedition, departBlocker, openBox, claimLoot, sellGear, doTrainAll, startBuild, enhance, enhanceBlocker,
    settleRaid, claimRaidChest, raidStageOf, RAID_BOSSES, RAID_TICKET_FREE, GEAR_SLOTS, isEquipped, isSetGear, autoEquip, BUILDINGS,
    classPath, changeClass, skillsOf, feedTomes, skillLv, treeNodesOf, SKILLS, canInvest, investNode, stats, powerOf, fmt })`, ctx);
  const S = A.S(); S.gear.auto = true;
  const chain = A.classPath(line).slice(1);
  let t = 0, lastDay = -1, rid = 0, nextAt = opt.every;
  const sell = () => { const l = S.gear.inv.filter((x) => !A.isEquipped(x) && !A.isSetGear(x)); if (l.length) A.sellGear(l); };
  const chores = () => {
    for (const it of S.bag) for (const x of (it.k === 'box' ? A.openBox(it) : [it])) A.claimLoot(x);
    S.bag = []; S.report = null;
    A.autoEquip(); sell();
    const day = Math.floor(t / DAY);
    if (day !== lastDay) { lastDay = day; S.raid.tickets = A.RAID_TICKET_FREE; S.tomes += 4; }
    while (S.raid.tickets > 0) {
      const ids = Object.keys(A.RAID_BOSSES).filter((id) => A.RAID_BOSSES[id].stage <= S.best && A.raidStageOf(A.RAID_BOSSES[id], 4) <= S.best);
      if (!ids.length) break;
      A.settleRaid({ id: 'r' + (++rid), boss: ids[ids.length - 1], members: ['me', 'a', 'b', 'c'].map((nickname) => ({ nickname })),
        fight: { won: true, mvp: rnd() < 0.25 ? 0 : 1, contrib: [{}, {}, {}, {}], dur: 60, timeout: false } }, 'me');
      while (S.raid.chests.length) A.claimRaidChest(0);
      sell();
    }
    for (let next = chain[chain.indexOf(S.cls) + 1]; next && A.changeClass(next); next = chain[chain.indexOf(S.cls) + 1]);
    const ids = A.skillsOf(S.cls).map((k) => k.id);
    for (let g = 0; S.tomes > 0 && g < 200; g++) { const id = ids.slice().sort((a, b) => A.skillLv(a) - A.skillLv(b))[0]; if (!id || !A.feedTomes(id, 1)) break; }
    for (const id of ids) for (const nid of Object.keys(A.treeNodesOf(A.SKILLS[id]))) for (let i = 0; i < 40 && A.canInvest(id, nid); i++) A.investNode(id, nid);
    for (const slot of Object.keys(A.GEAR_SLOTS)) for (let i = 0; i < 300 && !A.enhanceBlocker(slot) && (S.gear.enh[slot] < 15 || S.items.protect > 0); i++) A.enhance(slot, S.gear.enh[slot] >= 15);
    for (const id of Object.keys(A.BUILDINGS)) A.startBuild(id);
    A.doTrainAll();
  };
  // 훈련(공격력·체력·방어)을 0 으로 · 장비를 모두 벗긴 전투력
  const pow = () => A.powerOf(A.stats(true));
  const noTrain = () => { const k = { ...S.train }; S.train.atk = S.train.hp = S.train.def = 0; const p = pow(); Object.assign(S.train, k); return p; };
  const noGear = () => { const k = { ...S.gear.eq }; for (const sl of Object.keys(S.gear.eq)) S.gear.eq[sl] = null; const p = pow(); Object.assign(S.gear.eq, k); return p; };
  const P0 = pow(), rows = [];
  const snap = () => {
    const p = pow(), L = Math.log(p / P0);
    const st = A.stats(true);
    rows.push({ best: S.best, lv: S.level, h: t / 3600, p, atk: st.atk, hp: st.maxHp, train: Math.log(p / noTrain()) / L, gear: Math.log(p / noGear()) / L, t: `${S.train.atk}/${S.train.hp}/${S.train.def}`, enh: `${S.gear.enh.weapon}/${S.gear.enh.armor}/${S.gear.enh.ring}` });
  };
  while (t < opt.days * DAY) {
    if (S.phase === 'expedition') { A.simulate(TICK); if (S.phase === 'returning') A.simulate(0); }
    else {
      chores();
      if (S.best >= nextAt) { snap(); nextAt = Math.floor(S.best / opt.every) * opt.every + opt.every; }
      if (!A.departBlocker()) A.startExpedition(); else A.advanceCamp(TICK);
    }
    t += TICK; ctx.__T += TICK * 1000;
  }
  chores(); snap();
  return { rows, fmt: A.fmt };
}

const pc = (x) => (x * 100).toFixed(0).padStart(4) + '%';
opt.lines.forEach((line, i) => {
  const { rows, fmt } = runLine(line, i + 1);
  console.log(`── ${line}`);
  console.log('스테이지  Lv   시간    전투력     공격력     체력   훈련몫 장비몫  훈련(공/체/방)  강화');
  for (const r of rows) console.log(`${String(r.best).padStart(6)} ${String(r.lv).padStart(4)} ${r.h.toFixed(0).padStart(5)}h ${fmt(r.p).padStart(9)} ${fmt(r.atk).padStart(9)} ${fmt(r.hp).padStart(8)} ${pc(r.train)}  ${pc(r.gear)}   ${r.t.padEnd(14)} ${r.enh}`);
});
