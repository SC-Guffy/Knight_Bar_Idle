'use strict';
// 진행 봇 (개발용, 밸런스 점검). 게임 src 를 Node vm 에 올려 7일치 진행을 빠르게 돌리고 재화 수입·지출과 스테이지 도달 시각을 표로 낸다.
//  node dev/progress-bot.js [--days 5] [--seeds 12] [--rev HEAD~1 --rev HEAD ...]
//  --rev 를 여러 개 주면 그 커밋들의 src 를 각각 불러 나란히 비교한다 (없으면 작업 트리의 src 하나만).
// 봇의 하루: 원정(스태미나 다 쓰면 귀환) → 가방 정리·자동 장착·안 낀 장비 전부 판매 → 레이드 3회(4인 파티로 이길 수 있는 가장 센 보스, 이긴다고 가정)
//  → 강화(+15 까지, 그 위는 보호 주문서가 있을 때만) → 건설 → 훈련 → 스태미나 차면 다시 원정. 탑·월드 보스·결투는 돌리지 않는다.
// 수치는 '24시간 켜 둔 봇' 기준이라 실제 플레이어보다 빠르다. 변경 전후의 차이를 보는 용도다.
const vm = require('vm'), fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const FILES = ['data', 'classes', 'gear', 'raid', 'season', 'tower', 'worldboss', 'dungeon', 'core'];
const DAY = 86400, TICK = 60, STAGES = [20, 40, 60, 80, 100, 120, 140];

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
    if (rev) { try { src = cp.execFileSync('git', ['show', `${rev}:src/${f}.js`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { continue; } } // 그 커밋에 아직 없는 파일(예: 0.12.0 이전의 dungeon.js)은 건너뜀
    else src = fs.readFileSync(path.join(ROOT, 'src', f + '.js'), 'utf8');
    vm.runInContext(src, ctx, { filename: f + '.js' });
  }
  return ctx;
}

function runOne({ days, seed, rev }) {
  let s = seed * 9301 + 49297; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const ctx = makeGame(rev); ctx.Math.random = rnd;
  const A = vm.runInContext(`({ S: () => S, simulate, advanceCamp, startExpedition, departBlocker, openBox, claimLoot, sellGear, doTrainAll, startBuild, enhance, enhanceBlocker,
    settleRaid, claimRaidChest, raidStageOf, RAID_BOSSES, RAID_TICKET_FREE, BUILDINGS, GEAR_SLOTS, isEquipped, isSetGear, autoEquip, trainCapAt })`, ctx);
  const S = A.S(); S.gear.auto = true;
  const inc = { expGold: 0, curioGold: 0, raidGold: 0, saleGold: 0, bossStones: 0, saleStones: 0, raidGear: [0, 0, 0, 0, 0, 0, 0, 0], raids: 0, trips: 0 };
  const spend = { train: 0, build: 0, enhStone: 0, enhOre: 0, buildOre: 0 };
  const reach = {}; let rid = 0, t = 0, lastDay = -1;
  const sell = () => { const l = S.gear.inv.filter((x) => !A.isEquipped(x) && !A.isSetGear(x)); if (!l.length) return; const g0 = S.gold, s0 = S.stones; A.sellGear(l); inc.saleGold += S.gold - g0; inc.saleStones += S.stones - s0; };
  const chores = () => {
    for (const it of S.bag) for (const x of (it.k === 'box' ? A.openBox(it) : [it])) inc.curioGold += A.claimLoot(x).gold || 0;
    S.bag = [];
    if (S.report) { inc.expGold += S.report.gold || 0; inc.bossStones += S.report.stones || 0; inc.trips += S.report.trips || 1; S.report = null; }
    A.autoEquip(); sell();
    const day = Math.floor(t / DAY);
    if (day !== lastDay) { lastDay = day; S.raid.tickets = A.RAID_TICKET_FREE; }
    while (S.raid.tickets > 0) {
      const ids = Object.keys(A.RAID_BOSSES).filter((id) => A.raidStageOf(A.RAID_BOSSES[id], 4) <= S.best);
      if (!ids.length) break;
      const g0 = S.gold;
      A.settleRaid({ id: 'r' + (++rid), boss: ids[ids.length - 1], members: ['me', 'a', 'b', 'c'].map((nickname) => ({ nickname })),
        fight: { won: true, mvp: rnd() < 0.25 ? 0 : 1, contrib: [{}, {}, {}, {}], dur: 60, timeout: false } }, 'me');
      inc.raidGold += S.gold - g0; inc.raids++;
      while (S.raid.chests.length) for (const x of A.claimRaidChest(0)) inc.raidGear[x.it.g]++;
      sell();
    }
    for (const slot of Object.keys(A.GEAR_SLOTS)) for (let i = 0; i < 300 && !A.enhanceBlocker(slot) && (S.gear.enh[slot] < 15 || S.items.protect > 0); i++) {
      const s0 = S.stones, o0 = S.mats.ore; A.enhance(slot, S.gear.enh[slot] >= 15); spend.enhStone += s0 - S.stones; spend.enhOre += o0 - S.mats.ore;
    }
    for (const id of Object.keys(A.BUILDINGS)) { const g0 = S.gold, o0 = S.mats.ore; if (A.startBuild(id)) { spend.build += g0 - S.gold; spend.buildOre += o0 - S.mats.ore; } }
    { const g0 = S.gold; A.doTrainAll(); spend.train += g0 - S.gold; }
  };
  while (t < days * DAY) {
    if (S.phase === 'expedition') { A.simulate(TICK); if (S.phase === 'returning') A.simulate(0); }
    else { chores(); if (!A.departBlocker()) A.startExpedition(); else A.advanceCamp(TICK); }
    t += TICK;
    for (const th of STAGES) if (reach[th] == null && S.best >= th) reach[th] = t / 3600;
  }
  chores();
  return { best: S.best, gold: S.gold, stones: S.stones, ore: S.mats.ore, reach, inc, spend, trainCap: 4 * A.trainCapAt(S.bld.training),
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
  row('건물 Lv 합계', (r) => r.bld); row('원정 횟수', (r) => r.inc.trips); row('레이드 횟수', (r) => r.inc.raids);
  row('레이드 장비 전설 이상', (r) => r.inc.raidGear.slice(4).reduce((a, b) => a + b, 0));
  row('골드: 판매 / 원정', (r) => r.inc.saleGold / (r.inc.expGold + r.inc.curioGold), pct);
  row('골드: 레이드 / 원정', (r) => r.inc.raidGold / (r.inc.expGold + r.inc.curioGold), pct);
  row('골드: 남은 것 / 원정', (r) => r.gold / (r.inc.expGold + r.inc.curioGold), pct);
  row('강화석: 판매', (r) => r.inc.saleStones); row('강화석: 원정 보스', (r) => r.inc.bossStones); row('강화석: 강화 지출', (r) => r.spend.enhStone); row('강화석: 남은 것', (r) => r.stones);
  row('철광석: 강화 지출', (r) => r.spend.enhOre); row('철광석: 건물 지출', (r) => r.spend.buildOre); row('철광석: 남은 것', (r) => r.ore);
}
main();
