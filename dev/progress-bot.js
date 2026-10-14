'use strict';
// 진행 봇 (개발용, 밸런스 점검). 게임 src 를 Node vm 에 올려 7일치 진행을 빠르게 돌리고 재화 수입·지출과 스테이지 도달 시각을 표로 낸다.
//  node dev/progress-bot.js [--days 5] [--seeds 12] [--rev HEAD~1 --rev HEAD ...]
//  --rev 를 여러 개 주면 그 커밋들의 src 를 각각 불러 나란히 비교한다 (없으면 작업 트리의 src 하나만). --rev . 은 작업 트리.
//  🎓 교관 수련(2차 훈련)이 있는 src 면: 훈련 뒤 남는 골드로 수련하고(비용 2배 이상일 때), 승부(★5)는 하루 한 번 server/duel.js 로 바로 계산한다.
// 봇의 하루: 원정(스태미나 다 쓰면 귀환) → 가방 정리·자동 장착·안 낀 장비 전부 판매 → 창고 비축 수령·교역(목재·철광석 중 적은 쪽, 하루 횟수 다) → 레이드 3회(4인 파티로 이길 수 있는 가장 센 보스, 이긴다고 가정)
//  → 전직(시드마다 3차 계열 하나를 정해 조건이 되는 대로) · 비전서(레이드 상자 + 탑 몫 하루 4권)를 낮은 스킬부터 먹이고 트리 노드 찍기
//  → 강화(+15 까지, 그 위는 보호 주문서가 있을 때만) → 건설 → 훈련 → 스태미나 차면 다시 원정. 탑·월드 보스·결투는 돌리지 않는다.
//  전직·스킬은 0.21.0 성장 압축에서 넣었다 — 곡선이 완만해져 전직 배율·스킬 비중이 커져서, 안 하면 실제 유저보다 한참 느려진다 (dev/bot-curve.js 와 같은 방식)
// 수치는 '24시간 켜 둔 봇' 기준이라 실제 플레이어보다 빠르다. 변경 전후의 차이를 보는 용도다.
const vm = require('vm'), fs = require('fs'), path = require('path'), cp = require('child_process');
const { simulateDuel } = require('../server/duel');
const { mentorProfile } = require('../server/mentor');
const ROOT = path.join(__dirname, '..');
const FILES = ['data', 'classes', 'gear', 'raid', 'season', 'tower', 'worldboss', 'dungeon', 'mentor', 'core'];
const DAY = 86400, TICK = 60, STAGES = [20, 40, 60, 80, 100, 120, 140, 160, 180];
const LINES = ['tyrant', 'skyGeneral', 'siegeMaster', 'thunderEmperor', 'archon', 'swordsaint', 'dragonlord', 'warlord', 'deadeye', 'voidArcher', 'archmage', 'frostlord'];
const TOWER_TOMES_PER_DAY = 4;

function makeGame(rev) {
  const ctx = { console, Math: Object.create(Math), Date, JSON, Object, Array, Number, String, Infinity, NaN, isFinite, isNaN, parseInt, parseFloat, URLSearchParams,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, performance: { now: () => Date.now() },
    location: { search: '', hostname: 'localhost' }, navigator: { userAgent: '' },
    document: { getElementById: () => null, querySelector: () => null, createElement: () => ({ getContext: () => null, style: {} }) },
    requestAnimationFrame() {}, setTimeout() {}, clearTimeout() {}, toast() {}, render() {} };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of FILES) {
    let src;
    if (rev && rev !== '.') { try { src = cp.execFileSync('git', ['show', `${rev}:src/${f}.js`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { continue; } } // 그 커밋에 아직 없는 파일(예: 0.12.0 이전의 dungeon.js)은 건너뜀
    else src = fs.readFileSync(path.join(ROOT, 'src', f + '.js'), 'utf8');
    vm.runInContext(src, ctx, { filename: f + '.js' });
  }
  // 게임 시계를 봇 시간으로 (창고 비축·하루 초기화가 봇의 하루를 따라가게). runOne 이 ctx.__T 를 민다
  vm.runInContext('var __T = Date.UTC(2026, 0, 1, 15); srvClock.known = true; gameNow = () => __T;', ctx);
  return ctx;
}

// 🎓 교관 수련 (2차 훈련)을 하는 src 면 그 함수들, 아니면 null
const mentorApi = (ctx) => vm.runInContext(`typeof mentorTry === 'function' ? { mentorCur, mentorOpen, mentorDuelTurn, mentorPayDuel, mentorSettle, mentorTry, mentorCost, mentorStarSum, trainDone, profile, MENTORS } : null`, ctx);
// 교관 수련 한 차례: 수련(★1~4)은 골드가 비용 2배 이상일 때 계속, 승부(★5)는 하루 한 번 (server/duel.js 로 바로 계산).
//  ms = { duelDay, mid, starAt: { 별 합계: 처음 닿은 시간 }, spent, doneAt: 1차 수료 시간 } — 부르는 쪽이 들고 다닌다
function playMentors(M, S, day, t, ms) {
  if (ms.doneAt == null && M.trainDone()) ms.doneAt = t / 3600;
  ms.hallAt = ms.hallAt || {};
  if (ms.hallAt[S.bld.training] == null) ms.hallAt[S.bld.training] = t / 3600;
  for (let k = 0; k < 200; k++) {
    const i = M.mentorCur();
    if (!M.mentorOpen(i)) break;
    if (M.mentorDuelTurn(i)) {
      if (ms.duelDay === day) break;
      ms.duelDay = day;
      const paid = M.mentorPayDuel(i);
      if (!paid) break;
      ms.spent += paid;
      const me = M.profile(), op = mentorProfile(i, S.level, me.cls), won = simulateDuel(me, op).winner === 'a';
      // MENTOR_LOG=1: 승부마다 한 줄 (교관 난이도 이상 추적용)
      if (process.env.MENTOR_LOG) console.log(`  [교관${i + 1}] ${(t / 3600).toFixed(0)}h Lv${S.level} ${me.cls} 나 ${me.power.toExponential(2)} · 교관 ${op.cls} ${op.power.toExponential(2)} → ${won ? '승' : '패'}`);
      M.mentorSettle(i, { id: 'm' + (++ms.mid), won });
      continue;
    }
    if (S.gold < 2 * M.mentorCost(i)) break;
    const g0 = S.gold; M.mentorTry(i); ms.spent += g0 - S.gold;
  }
  for (let n = 5; n <= M.MENTORS.length * 5; n += 5) if (ms.starAt[n] == null && M.mentorStarSum() >= n) ms.starAt[n] = t / 3600;
}

function runOne({ days, seed, rev }) {
  let s = seed * 9301 + 49297; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const ctx = makeGame(rev); ctx.Math.random = rnd;
  const A = vm.runInContext(`({ S: () => S, simulate, advanceCamp, startExpedition, departBlocker, openBox, claimLoot, sellGear, doTrainAll, startBuild, enhance, enhanceBlocker,
    settleRaid, claimRaidChest, bagWeight, bagCap,
    upgradeBag: typeof upgradeBag === 'function' ? upgradeBag : null, bagUpCost: typeof bagUpCost === 'function' ? bagUpCost : null,
    claimStock: typeof claimStock === 'function' ? claimStock : null, trade: typeof trade === 'function' ? trade : null, tradeBlocker: typeof tradeBlocker === 'function' ? tradeBlocker : null, raidStageOf, RAID_BOSSES, RAID_TICKET_FREE, BUILDINGS, GEAR_SLOTS, isEquipped, isSetGear, autoEquip, trainCapAt,
    classPath, changeClass, skillsOf, feedTomes, skillLv, treeNodesOf, SKILLS, canInvest, investNode })`, ctx);
  const M = mentorApi(ctx), ms = { duelDay: -1, mid: 0, starAt: {}, spent: 0 };
  const S = A.S(); S.gear.auto = true;
  const chain = A.classPath(LINES[(seed - 1) % LINES.length]).slice(1);   // squire 다음부터
  const classUp = () => {
    for (let next = chain[chain.indexOf(S.cls) + 1]; next && A.changeClass(next); next = chain[chain.indexOf(S.cls) + 1]);
    const ids = A.skillsOf(S.cls).map((k) => k.id);
    for (let g = 0; S.tomes > 0 && g < 200; g++) { const id = ids.slice().sort((a, b) => A.skillLv(a) - A.skillLv(b))[0]; if (!id || !A.feedTomes(id, 1)) break; }
    for (const id of ids) for (const nid of Object.keys(A.treeNodesOf(A.SKILLS[id]))) for (let i = 0; i < 40 && A.canInvest(id, nid); i++) A.investNode(id, nid);
  };
  const inc = { expGold: 0, curioGold: 0, raidGold: 0, saleGold: 0, bossStones: 0, saleStones: 0, raidGear: [0, 0, 0, 0, 0, 0, 0, 0], raids: 0, trips: 0, kills: 0, dur: 0, stockWood: 0, stockOre: 0, tradeWood: 0, tradeOre: 0, tradeGold: 0 };
  const spend = { train: 0, build: 0, enhStone: 0, enhOre: 0, buildOre: 0, buildWood: 0, bagWood: 0, mentor: 0 };
  const why = {};   // 원정이 끝난 사유별 횟수 (stamina 지침 · bag 가방 가득 · ...)
  const reach = {}; let maxBag = 0, rid = 0, t = 0, lastDay = -1;
  const sell = () => { const l = S.gear.inv.filter((x) => !A.isEquipped(x) && !A.isSetGear(x)); if (!l.length) return; const g0 = S.gold, s0 = S.stones; A.sellGear(l); inc.saleGold += S.gold - g0; inc.saleStones += S.stones - s0; };
  const chores = () => {
    const w = A.bagWeight();
    for (const it of S.bag) for (const x of (it.k === 'box' ? A.openBox(it) : [it])) inc.curioGold += A.claimLoot(x).gold || 0;
    S.bag = [];
    if (S.report) { why[S.report.reason] = (why[S.report.reason] || 0) + (S.report.trips || 1); inc.expGold += S.report.gold || 0; inc.bossStones += S.report.stones || 0; inc.trips += S.report.trips || 1; inc.kills += S.report.kills || 0; inc.dur += S.report.dur || 0; S.report = null; }
    A.autoEquip(); sell();
    // 가방: 가득 차서 돌아왔으면 이번에 든 무게의 1.3배가 될 때까지 올린다
    if (A.upgradeBag && S.bagHit) while (A.bagCap() < w * 1.3) { const w0 = S.mats.wood; if (!A.upgradeBag()) break; spend.bagWood += w0 - S.mats.wood; }
    if (A.claimStock) {
      const g = A.claimStock(); if (g) { inc.stockWood += g.wood; inc.stockOre += g.ore; }
      while (!A.tradeBlocker()) { const k = S.mats.wood <= S.mats.ore * 1.5 ? 'wood' : 'ore', g0 = S.gold, n = A.trade(k); inc.tradeGold += g0 - S.gold; inc[k === 'wood' ? 'tradeWood' : 'tradeOre'] += n; }
    }
    const day = Math.floor(t / DAY);
    if (day !== lastDay) { lastDay = day; S.raid.tickets = A.RAID_TICKET_FREE; S.tomes += TOWER_TOMES_PER_DAY; }
    while (S.raid.tickets > 0) {
      const ids = Object.keys(A.RAID_BOSSES).filter((id) => A.RAID_BOSSES[id].stage <= S.best && A.raidStageOf(A.RAID_BOSSES[id], 4) <= S.best);
      if (!ids.length) break;
      const g0 = S.gold;
      A.settleRaid({ id: 'r' + (++rid), boss: ids[ids.length - 1], members: ['me', 'a', 'b', 'c'].map((nickname) => ({ nickname })),
        fight: { won: true, mvp: rnd() < 0.25 ? 0 : 1, contrib: [{}, {}, {}, {}], dur: 60, timeout: false } }, 'me');
      inc.raidGold += S.gold - g0; inc.raids++;
      while (S.raid.chests.length) for (const x of A.claimRaidChest(0)) inc.raidGear[x.it.g]++;
      sell();
    }
    classUp();
    for (const slot of Object.keys(A.GEAR_SLOTS)) for (let i = 0; i < 300 && !A.enhanceBlocker(slot) && (S.gear.enh[slot] < 15 || S.items.protect > 0); i++) {
      const s0 = S.stones, o0 = S.mats.ore; A.enhance(slot, S.gear.enh[slot] >= 15); spend.enhStone += s0 - S.stones; spend.enhOre += o0 - S.mats.ore;
    }
    for (const id of Object.keys(A.BUILDINGS)) { const g0 = S.gold, o0 = S.mats.ore, w0 = S.mats.wood; if (A.startBuild(id)) { spend.build += g0 - S.gold; spend.buildOre += o0 - S.mats.ore; spend.buildWood += w0 - S.mats.wood; } }
    { const g0 = S.gold; A.doTrainAll(); spend.train += g0 - S.gold; }
    if (M) { playMentors(M, S, day, t, ms); spend.mentor = ms.spent; }
  };
  while (t < days * DAY) {
    if (S.phase === 'expedition') { maxBag = Math.max(maxBag, A.bagWeight() / A.bagCap()); A.simulate(TICK); if (S.phase === 'returning') A.simulate(0); }
    else { chores(); if (!A.departBlocker()) A.startExpedition(); else A.advanceCamp(TICK); }
    t += TICK; ctx.__T += TICK * 1000;
    for (const th of STAGES) if (reach[th] == null && S.best >= th) reach[th] = t / 3600;
  }
  chores();
  return { mentorStars: M ? M.mentorStarSum() : 0, mentorStarAt: ms.starAt, trainDoneAt: ms.doneAt, best: S.best, gold: S.gold, maxBag, bagLv: S.bagLv || 0, stones: S.stones, ore: S.mats.ore, wood: S.mats.wood, why, lv: { ...S.bld }, reach, inc, spend, trainCap: 4 * A.trainCapAt(S.bld.training),
    train: S.train.atk + S.train.hp + S.train.def + S.train.fortune, bld: Object.values(S.bld).reduce((a, b) => a + b, 0),
    enh: S.gear.enh.weapon + S.gear.enh.armor + S.gear.enh.ring,
    eq: Object.keys(A.GEAR_SLOTS).reduce((a, k) => { const it = S.gear.inv.find((x) => A.isEquipped(x) && x.slot === k); return a + (it ? it.g : 0); }, 0) };
}

function main() {
  const argv = process.argv.slice(2), opt = { days: 5, seeds: 12, revs: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--days') opt.days = Number(argv[++i]);
    else if (argv[i] === '--seeds') opt.seeds = Number(argv[++i]);
    else if (argv[i] === '--rev') opt.revs.push(argv[++i]);
  }
  const cols = opt.revs.length ? opt.revs : ['작업 트리'];
  const res = cols.map((c, i) => Array.from({ length: opt.seeds }, (_, s) => runOne({ days: opt.days, seed: s + 1, rev: opt.revs[i] })));
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  const pct = (x) => (x * 100).toFixed(1) + '%';
  const row = (name, f, fmt = (x) => Math.round(x)) => console.log(name.padEnd(26) + res.map((rs) => String(fmt(med(rs.map(f)))).padStart(14)).join(''));
  console.log(`진행 봇 ${opt.days}일 · ${opt.seeds}시드 중앙값`.padEnd(26) + cols.map((c) => c.padStart(14)).join(''));
  row('최종 최고 스테이지', (r) => r.best);
  for (const th of STAGES) row(`스테이지 ${th} 도달(시간)`, (r) => (r.reach[th] == null ? 9999 : r.reach[th]), (x) => (x === 9999 ? '-' : x.toFixed(1)));
  row('장착 등급 합(3부위)', (r) => r.eq); row('강화 합계(3부위)', (r) => r.enh);
  row('훈련 합계', (r) => r.train); row('훈련 상한(훈련장 기준)', (r) => r.trainCap);
  row('1차 훈련 수료 (시간)', (r) => (r.trainDoneAt == null ? 9999 : r.trainDoneAt), (x) => (x === 9999 ? '-' : x.toFixed(1)));
  row('🎓 교관 별 합계', (r) => r.mentorStars);
  for (let n = 5; n <= 25; n += 5) row(`🎓 교관 별 ${n} (시간)`, (r) => (r.mentorStarAt[n] == null ? 9999 : r.mentorStarAt[n]), (x) => (x === 9999 ? '-' : x.toFixed(1)));
  row('골드: 훈련 지출 / 원정', (r) => r.spend.train / (r.inc.expGold + r.inc.curioGold), pct);
  row('골드: 교관 지출 / 원정', (r) => r.spend.mentor / (r.inc.expGold + r.inc.curioGold), pct);
  row('건물 Lv 합계', (r) => r.bld); row('원정 횟수', (r) => r.inc.trips); row('레이드 횟수', (r) => r.inc.raids);
  row('레이드 장비 전설 이상', (r) => r.inc.raidGear.slice(4).reduce((a, b) => a + b, 0));
  row('골드: 수입 합계', (r) => r.inc.expGold + r.inc.curioGold + r.inc.raidGold + r.inc.saleGold);
  row('원정 시간 비율(하루 중)', (r) => r.inc.dur / (opt.days * DAY), pct);
  row('처치 / 원정 1시간', (r) => r.inc.kills / Math.max(1, r.inc.dur / 3600));
  row('골드: 판매 / 원정', (r) => r.inc.saleGold / (r.inc.expGold + r.inc.curioGold), pct);
  row('골드: 레이드 / 원정', (r) => r.inc.raidGold / (r.inc.expGold + r.inc.curioGold), pct);
  row('골드: 남은 것 / 원정', (r) => r.gold / (r.inc.expGold + r.inc.curioGold), pct);
  row('강화석: 판매', (r) => r.inc.saleStones); row('강화석: 원정 보스', (r) => r.inc.bossStones); row('강화석: 강화 지출', (r) => r.spend.enhStone); row('강화석: 남은 것', (r) => r.stones);
  for (const id of ['training', 'inn', 'storage', 'forge']) row(`건물 Lv: ${id}`, (r) => r.lv[id]);
  row('원정 끝: 스태미나 / 가방', (r) => (r.why.stamina || 0) / Math.max(1, r.inc.trips), pct);
  row('가방 최대 찬 비율', (r) => r.maxBag, pct);
  row('가방 Lv', (r) => r.bagLv); row('나무: 가방 지출', (r) => r.spend.bagWood);
  row('원정 끝: 가방 가득', (r) => (r.why.bag || 0) / Math.max(1, r.inc.trips), pct);
  row('나무: 수입', (r) => r.wood + r.spend.buildWood + r.spend.bagWood); row('나무: 건물 지출', (r) => r.spend.buildWood); row('나무: 남은 것', (r) => r.wood);
  row('철광석: 수입', (r) => r.ore + r.spend.buildOre + r.spend.enhOre);
  row('창고: 비축 목재', (r) => r.inc.stockWood); row('창고: 비축 철광석', (r) => r.inc.stockOre);
  row('창고: 교역 목재', (r) => r.inc.tradeWood); row('창고: 교역 철광석', (r) => r.inc.tradeOre);
  row('창고: 교역 골드 / 원정', (r) => r.inc.tradeGold / (r.inc.expGold + r.inc.curioGold), pct);
  row('철광석: 강화 지출', (r) => r.spend.enhOre); row('철광석: 건물 지출', (r) => r.spend.buildOre); row('철광석: 남은 것', (r) => r.ore);
}
// 다른 개발 스크립트(dev/bot-curve.js)가 게임 vm 을 빌려 쓸 수 있게
if (require.main === module) main();
module.exports = { makeGame, mentorApi, playMentors };
