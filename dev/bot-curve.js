'use strict';
// AI 기사(봇) 성장 곡선 굽기 (개발용). 진행 봇(dev/progress-bot.js)의 게임 vm 으로 3차 직업 계열마다 며칠치 진행을 돌려,
// 최고 스테이지가 오를 때마다 클라이언트가 서버에 올리는 것과 똑같은 전투 프로필(core.js profile())을 찍어 server/bot-curve.json 에 남긴다.
// 서버(server/bots.js)는 봇의 최고 스테이지에 맞는 줄을 골라(사이는 로그 보간) 봇의 랭킹·결투·레이드·월드 보스 능력치로 쓴다.
//  node dev/bot-curve.js [--days 12] [--every 3] [--seed 0] [--out 파일] [--dry] [--rev <커밋>]
//  --seed: 시드 묶음 번호, 밸런스 점검용으로 여러 벌 구울 때. --out: 다른 파일에 쓰기
//  🎓 교관 수련도 한다 (progress-bot playMentors). --dry: 파일을 쓰지 않고 계열마다 1차 수료·교관 별 시각만 찍는다 (교관 난이도 확인용)
//  --rev: 그 커밋의 src 로 돌린다 (--dry 와 함께, 전체 봇으로 밸런스 전후 비교 — 끝에 스테이지 도달 시각 중앙값)
//  --line <계열>: 그 계열만 (시드 그대로). MENTOR_LOG=1 이면 교관 승부마다 레벨·양쪽 전투력을 찍는다
// 진행 봇의 하루(원정 → 정리·자동 장착·판매 → 레이드 3회 → 강화 → 건설 → 훈련)에 더해:
//  전직(조건이 되는 대로 그 계열 다음 직업으로) · 비전서(레이드 상자 + 탑 몫 하루 4권)를 가장 낮은 스킬부터 먹이고 트리 노드를 찍는다.
// 24시간 켜 둔 봇이라 시간축은 실제 유저보다 빠르다 — 그래서 시간이 아니라 '최고 스테이지 → 능력치' 표로만 쓴다.
const fs = require('fs'), path = require('path');
const { makeGame, mentorApi, playMentors } = require('./progress-bot');
const vm = require('vm');

const DAY = 86400, TICK = 60, TOWER_TOMES_PER_DAY = 4;
// 3차 직업 = 계열. 시즌5 새 직업(파천검왕·천마장군·공성포수·뇌제와 그 2차 대검전사·랜서·석궁사수·뇌전술사)도 같은 비중
const LINES = ['tyrant', 'skyGeneral', 'siegeMaster', 'thunderEmperor', 'archon', 'swordsaint', 'dragonlord', 'warlord', 'deadeye', 'voidArcher', 'archmage', 'frostlord'];

const r3 = (x) => (Math.abs(x) >= 1000 ? Math.round(x) : Math.round(x * 1000) / 1000);

const REACH = [80, 100, 120, 140, 160];
function runLine(line, { days, every, seed, rev }) {
  let s = seed * 9301 + 49297; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const ctx = makeGame(rev); ctx.Math.random = rnd;
  const A = vm.runInContext(`({ S: () => S, simulate, advanceCamp, startExpedition, departBlocker, openBox, claimLoot, sellGear, doTrainAll, startBuild, enhance, enhanceBlocker,
    settleRaid, claimRaidChest, raidStageOf, RAID_BOSSES, RAID_TICKET_FREE, BUILDINGS, GEAR_SLOTS, isEquipped, isSetGear, autoEquip,
    classPath, changeClass, skillsOf, feedTomes, skillLv, treeNodesOf, SKILLS, canInvest, investNode, profile })`, ctx);
  const S = A.S(); S.gear.auto = true;
  const M = mentorApi(ctx), ms = { duelDay: -1, mid: 0, starAt: {}, spent: 0 };
  const chain = A.classPath(line).slice(1);       // squire 다음부터
  const rows = []; let nextAt = 1, t = 0, lastDay = -1, rid = 0;
  const reach = {};
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
      const ids = Object.keys(A.RAID_BOSSES).filter((id) => A.RAID_BOSSES[id].stage <= S.best && A.raidStageOf(A.RAID_BOSSES[id], 4) <= S.best);
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
    if (M) playMentors(M, S, day, t, ms);
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
    for (const th of REACH) if (reach[th] == null && S.best >= th) reach[th] = t / 3600;
  }
  chores(); snap();
  rows.mentor = { ...ms, stars: M ? M.mentorStarSum() : 0, level: S.level, best: S.best, reach };
  return rows;
}

function main() {
  const argv = process.argv.slice(2), opt = { days: 12, every: 3 };
  let seedSet = 0, outFile = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--days') opt.days = Number(argv[++i]);
    else if (argv[i] === '--every') opt.every = Number(argv[++i]);
    else if (argv[i] === '--dry') opt.dry = true;
    else if (argv[i] === '--rev') opt.rev = argv[++i];
    else if (argv[i] === '--line') opt.only = argv[++i];   // 한 계열만 (--dry 디버그용, 시드는 그대로)
    else if (argv[i] === '--seed') seedSet = Number(argv[++i]);
    else if (argv[i] === '--out') outFile = path.resolve(argv[++i]);
  }
  const out = { v: 1, made: new Date().toISOString().slice(0, 10), days: opt.days,
    cols: ['best', 'level', 'cls', 'atk', 'maxHp', 'aspd', 'crit', 'critMult', 'range', 'shots', 'shotMult', 'guard', 'heal', 'power', 'skills'], lines: {} };
  LINES.forEach((line, i) => {
    if (opt.only && line !== opt.only) return;
    const t0 = Date.now();
    out.lines[line] = runLine(line, { ...opt, seed: i + 1 + seedSet * 100 });
    const L = out.lines[line], last = L[L.length - 1];
    console.log(`${line.padEnd(15)} ${String(L.length).padStart(4)}줄 · 최고 스테이지 ${last[0]} · Lv ${last[1]} · ${last[2]} · ${((Date.now() - t0) / 1000).toFixed(1)}초`);
    const m = L.mentor, h = (x) => (x == null ? '-' : x.toFixed(0) + 'h');
    console.log(`${''.padEnd(15)} 🎓 1차 수료 ${h(m.doneAt)} · 별 ${m.stars}/25 · 별 5/10/15/20/25 = ${[5, 10, 15, 20, 25].map((n) => h(m.starAt[n])).join(' / ')} · 훈련장 Lv6~14 = ${[6, 7, 8, 9, 10, 11, 12, 13, 14].map((n) => h((m.hallAt || {})[n])).join(' ')}`);
  });
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  const ms = LINES.filter((l) => out.lines[l]).map((l) => out.lines[l].mentor);
  console.log(`중앙값 · 최종 스테이지 ${med(ms.map((m) => m.best))} · Lv ${med(ms.map((m) => m.level))} · 도달 ${REACH.map((th) => { const v = med(ms.map((m) => m.reach[th] ?? 9999)); return `${th}:${v === 9999 ? '-' : v.toFixed(0) + 'h'}`; }).join(' ')}`);
  if (opt.dry) return;
  const file = outFile || path.join(__dirname, '..', 'server', 'bot-curve.json');
  fs.writeFileSync(file, JSON.stringify(out));
  console.log(`→ ${path.relative(process.cwd(), file)} (${(fs.statSync(file).size / 1024).toFixed(0)}KB)`);
}
main();
