'use strict';
// AI 기사(봇) 성장 곡선 굽기 (개발용). 진행 봇(dev/progress-bot.js)의 게임 vm 으로 3차 직업 계열마다 며칠치 진행을 돌려,
// 최고 스테이지가 오를 때마다 클라이언트가 서버에 올리는 것과 똑같은 전투 프로필(core.js profile())을 찍어 server/bot-curve.json 에 남긴다.
// 서버(server/bots.js)는 봇의 최고 스테이지에 맞는 줄을 골라(사이는 로그 보간) 봇의 랭킹·결투·레이드·월드 보스 능력치로 쓴다.
//  node dev/bot-curve.js [--days 12] [--every 3]
// 진행 봇의 하루(원정 → 정리·자동 장착·판매 → 레이드 3회 → 강화 → 건설 → 훈련)에 더해:
//  전직(조건이 되는 대로 그 계열 다음 직업으로) · 비전서(레이드 상자 + 탑 몫 하루 4권)를 가장 낮은 스킬부터 먹이고 트리 노드를 찍는다.
// 24시간 켜 둔 봇이라 시간축은 실제 유저보다 빠르다 — 그래서 시간이 아니라 '최고 스테이지 → 능력치' 표로만 쓴다.
const fs = require('fs'), path = require('path');
const { makeGame } = require('./progress-bot');
const vm = require('vm');

const DAY = 86400, TICK = 60, TOWER_TOMES_PER_DAY = 4;
// 3차 직업 = 계열. 시즌5 새 직업(파천검왕·천마장군·공성포수·뇌제와 그 2차 대검전사·랜서·석궁사수·뇌전술사)도 같은 비중
const LINES = ['tyrant', 'skyGeneral', 'siegeMaster', 'thunderEmperor', 'archon', 'swordsaint', 'dragonlord', 'warlord', 'deadeye', 'voidArcher', 'archmage', 'frostlord'];

const r3 = (x) => (Math.abs(x) >= 1000 ? Math.round(x) : Math.round(x * 1000) / 1000);

function runLine(line, { days, every, seed }) {
  let s = seed * 9301 + 49297; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const ctx = makeGame(); ctx.Math.random = rnd;
  const A = vm.runInContext(`({ S: () => S, simulate, advanceCamp, startExpedition, departBlocker, openBox, claimLoot, sellGear, doTrainAll, startBuild, enhance, enhanceBlocker,
    settleRaid, claimRaidChest, raidStageOf, RAID_BOSSES, RAID_TICKET_FREE, BUILDINGS, GEAR_SLOTS, isEquipped, isSetGear, autoEquip,
    classPath, changeClass, skillsOf, feedTomes, skillLv, treeNodesOf, SKILLS, canInvest, investNode, profile })`, ctx);
  const S = A.S(); S.gear.auto = true;
  const chain = A.classPath(line).slice(1);       // squire 다음부터
  const rows = []; let nextAt = 1, t = 0, lastDay = -1, rid = 0;
  const sell = () => { const l = S.gear.inv.filter((x) => !A.isEquipped(x) && !A.isSetGear(x)); if (l.length) A.sellGear(l); };
  const skills = () => {
    const ids = A.skillsOf(S.cls).map((k) => k.id);
    for (let guard = 0; S.tomes > 0 && guard < 200; guard++) {
      const id = ids.slice().sort((a, b) => A.skillLv(a) - A.skillLv(b))[0];
      if (!id || !A.feedTomes(id, 1)) break;
    }
    // 트리: 열린 노드를 앞에서부터 (공격·쿨타임 특화가 번갈아 있고 진화 문은 조건이 되면 연다)
    for (const id of ids) for (const nid of Object.keys(A.treeNodesOf(A.SKILLS[id]))) for (let i = 0; i < 40 && A.canInvest(id, nid); i++) A.investNode(id, nid);
  };
  const chores = () => {
    for (const it of S.bag) for (const x of (it.k === 'box' ? A.openBox(it) : [it])) A.claimLoot(x);
    S.bag = []; S.report = null;
    A.autoEquip(); sell();
    const day = Math.floor(t / DAY);
    if (day !== lastDay) { lastDay = day; S.raid.tickets = A.RAID_TICKET_FREE; S.tomes += TOWER_TOMES_PER_DAY; }
    while (S.raid.tickets > 0) {
      const ids = Object.keys(A.RAID_BOSSES).filter((id) => A.raidStageOf(A.RAID_BOSSES[id], 4) <= S.best);
      if (!ids.length) break;
      A.settleRaid({ id: 'r' + (++rid), boss: ids[ids.length - 1], members: ['me', 'a', 'b', 'c'].map((nickname) => ({ nickname })),
        fight: { won: true, mvp: rnd() < 0.25 ? 0 : 1, contrib: [{}, {}, {}, {}], dur: 60, timeout: false } }, 'me');
      while (S.raid.chests.length) A.claimRaidChest(0);
      sell();
    }
    for (let next = chain[chain.indexOf(S.cls) + 1]; next && A.changeClass(next); next = chain[chain.indexOf(S.cls) + 1]);
    skills();
    for (const slot of Object.keys(A.GEAR_SLOTS)) for (let i = 0; i < 300 && !A.enhanceBlocker(slot) && (S.gear.enh[slot] < 15 || S.items.protect > 0); i++) A.enhance(slot, S.gear.enh[slot] >= 15);
    for (const id of Object.keys(A.BUILDINGS)) A.startBuild(id);
    A.doTrainAll();
  };
  const snap = () => {
    const p = A.profile();
    rows.push([p.best, p.level, p.cls, r3(p.atk), r3(p.maxHp), r3(p.aspd), r3(p.crit), r3(p.critMult), p.range, p.shots, r3(p.shotMult), r3(p.guard), r3(p.heal), p.power,
      p.skills.map((k) => ({ ...k, cd: r3(k.cd), dur: r3(k.dur), mult: r3(k.mult), ...(k.cp ? { cp: r3(k.cp) } : {}), ...(k.lc ? { lc: r3(k.lc) } : {}) }))]);
  };
  while (t < days * DAY) {
    if (S.phase === 'expedition') { A.simulate(TICK); if (S.phase === 'returning') A.simulate(0); }
    else {
      chores();
      // 캠프에서 정비를 마친 순간의 능력치를 찍는다 (원정 버프 없이 — 서버에 올라가는 값과 같음)
      if (S.best >= nextAt) { snap(); nextAt = S.best + every; }
      if (!A.departBlocker()) A.startExpedition(); else A.advanceCamp(TICK);
    }
    t += TICK;
  }
  chores(); snap();
  return rows;
}

function main() {
  const argv = process.argv.slice(2), opt = { days: 12, every: 3 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--days') opt.days = Number(argv[++i]);
    else if (argv[i] === '--every') opt.every = Number(argv[++i]);
  }
  const out = { v: 1, made: new Date().toISOString().slice(0, 10), days: opt.days,
    cols: ['best', 'level', 'cls', 'atk', 'maxHp', 'aspd', 'crit', 'critMult', 'range', 'shots', 'shotMult', 'guard', 'heal', 'power', 'skills'], lines: {} };
  LINES.forEach((line, i) => {
    const t0 = Date.now();
    out.lines[line] = runLine(line, { ...opt, seed: i + 1 });
    const L = out.lines[line], last = L[L.length - 1];
    console.log(`${line.padEnd(15)} ${String(L.length).padStart(4)}줄 · 최고 스테이지 ${last[0]} · Lv ${last[1]} · ${last[2]} · ${((Date.now() - t0) / 1000).toFixed(1)}초`);
  });
  const file = path.join(__dirname, '..', 'server', 'bot-curve.json');
  fs.writeFileSync(file, JSON.stringify(out));
  console.log(`→ ${path.relative(process.cwd(), file)} (${(fs.statSync(file).size / 1024).toFixed(0)}KB)`);
}
main();
