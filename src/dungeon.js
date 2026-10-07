'use strict';
// 갈림길 던전 규칙. core.js 처럼 DOM 을 모르고 S 상태만 바꾼다. 하단바 연출(걷기·전투·문)은 world.js 의 updateDungeon, 선택 화면은 ui.js.
//  S.dg = {
//    tixDay, tixUsed: 오늘 쓴 입장권 수 (하루 DG_TICKETS 장),
//    clr: { easy, normal, hard, hell } 난이도별 완주(보스 3마리) 횟수 — 완주한 난이도 다음 난이도와 새 방이 열린다,
//    pol: 방침 { target 목표 재화, risky 전투 방 감수, gate 귀환 기준 승률, fast 바로 자동 선택 },
//    run: 진행 중인 도전 | null,
//    last: 마지막 결과 { reason, diff, sec, rooms, got, lost, cards, kills, dur, at, seen } | null,
//  }
//  run = { diff, stage0 첫 구간 스테이지, sec 구간(0~2), ri 구간에서 지난 방 수, uv 재화 1칸 값, bag 배낭(아직 내 것이 아님),
//          cards, buff, curse, keys, rerolls, chain, room 지금 방, fight 싸울 몬스터 목록 | null, prompt 고를 것 | null, inFight,
//          kills, rooms, t0 }
// 규칙
//  - 구간 3개 × (갈림길 → 방) 4번 → 귀환문 → 보스. 체력은 방에서 방으로 이어지고 저절로 차지 않는다 (물약도 못 쓴다).
//  - 방에서 얻은 재화는 배낭에 담기고, 나와야 확정된다. 귀환문에서 나가거나 완주하면 100%, 쓰러지면 절반 (올인 카드는 전부).
//  - 보스를 잡으면 배낭 ×DG_BOSS_MULT + 보물(목표 재화) + 카드 한 장.
//  - 난이도는 내 전투력 기준이다: dgLimitStage = 지금 능력치로 보스를 겨우 잡는 스테이지, 거기서 DG_DIFFS.off 만큼 뺀 스테이지에서 싸운다.
//    스테이지 3 차이로 '무피해 → 전멸' 이 갈려서, 고정 스테이지로 두면 대부분의 단계가 너무 쉽거나 불가능해진다.
//    보스는 같은 스테이지 몹보다 훨씬 세게(체력 ×14·공격력 ×2.6 기준) 둬서 구간 끝 보스가 체력의 20~45% 를 깎는다 → 귀환문이 진짜 고민이 된다.
//  - 재화 1칸 값(dgUnitValue): 한 재화만 쫓아 보통 난이도를 신중하게 완주하면(약 45칸)
//    목재·철광석·마력석은 내 건물 다음 레벨 비용의 약 60%, 골드는 사냥 30분치, 강화석·비전서는 보조 수급 정도.

const DG_UNLOCK_STAGE = 15;
const DG_TICKETS = 3;
const DG_SECTIONS = 3;
const DG_ROOMS = 4;                 // 구간마다 보스 전에 지나는 방 수
const DG_PICK_SEC = 8;              // 고르지 않으면 이 시간 뒤 방침대로
const DG_GATE_SEC = 10;
const DG_BOSS_MULT = 1.5;
const DG_ALLIN_MULT = 2.5;
const DG_CARD_REROLLS = 2;
const DG_MOB_CD = 1.4;              // 승률 계산용 몬스터 공격 간격 (MONSTERS[].atkCd 기본값)

const DG_DIFFS = [
  { id: 'easy',   name: '쉬움',   off: -9, mult: 1 },
  { id: 'normal', name: '보통',   off: -7, mult: 1.4 },
  { id: 'hard',   name: '어려움', off: -6, mult: 1.7 },
  { id: 'hell',   name: '지옥',   off: -5, mult: 2.2 },
];
// 재화 — room: 이 재화가 나오는 재화 방, w: 문 가중치
const DG_RES = {
  gold:   { name: '골드',   icon: '💰', room: '금광',        w: 9 },
  wood:   { name: '목재',   icon: '🪵', room: '숲길',        w: 11 },
  ore:    { name: '철광석', icon: '🪨', room: '갱도',        w: 11 },
  mana:   { name: '마력석', icon: '💎', room: '수정굴',      w: 9 },
  stones: { name: '강화석', icon: '💠', room: '정동석 동굴', w: 8 },
  tomes:  { name: '비전서', icon: '📖', room: '고대 서고',   w: 7 },
};
const DG_RES_IDS = Object.keys(DG_RES);
// 방 — fam: res 재화 · fight 전투 · trade 거래 · luck 운, w: 문 가중치, need: 이 난이도(DG_DIFFS 번호)를 완주하면 열림 (-1 = 처음부터)
//  hasRes: 문에 재화가 붙는 방, units: 깨면 받는 재화 칸 수, mobs: 싸울 몬스터 (n 마리, kind normal|elite)
const DG_ROOMS_DEF = {
  res:      { fam: 'res',   name: '재화 방',     icon: '',   w: 55, need: -1, hasRes: true, units: 1, mobs: { n: 3, kind: 'normal' } },
  elite:    { fam: 'fight', name: '정예 둥지',   icon: '🔥', w: 10, need: -1, hasRes: true, units: 2, mobs: { n: 3, kind: 'elite' }, desc: '정예 3마리 · 보상 2배 · 카드 1장' },
  gauntlet: { fam: 'fight', name: '연전',        icon: '⚔️', w: 5,  need: 2,  hasRes: true, units: 3, mobs: { n: 7, kind: 'normal' }, desc: '몹 7마리 연속 · 보상 3배' },
  altar:    { fam: 'fight', name: '저주 제단',   icon: '🩸', w: 3,  need: 3,  hasRes: true, units: 4, desc: '큰 보상을 바로, 대신 저주' },
  camp:     { fam: 'trade', name: '야영지',      icon: '⛺', w: 7,  need: -1, desc: '체력 회복 / 정비' },
  merchant: { fam: 'trade', name: '떠돌이 상인', icon: '🛒', w: 5,  need: 1,  desc: '배낭 재화로 카드 사기' },
  exchange: { fam: 'trade', name: '환전소',      icon: '🔀', w: 5,  need: 1,  desc: '배낭 재화를 목표 재화로' },
  unknown:  { fam: 'luck',  name: '미지의 방',   icon: '❓', w: 5,  need: 2,  desc: '보물 · 함정 · 카드 중 하나' },
  gamble:   { fam: 'luck',  name: '도박사',      icon: '🎲', w: 3,  need: 2,  desc: '배낭 재화 하나를 걸고 두 배 or 꽝' },
  seal:     { fam: 'luck',  name: '봉인된 문',   icon: '🗝️', w: 2,  need: 3,  units: 8, desc: '열쇠로 열면 큰 보물' },
  jackpot:  { fam: 'luck',  name: '잭팟',        icon: '🌟', w: 10, need: -1, hasRes: true, units: 6, mobs: { n: 3, kind: 'normal' }, desc: '같은 재화 카드 3장 시너지' },
};
const DG_FAMS = { res: '재화', fight: '전투', trade: '거래', luck: '운' };
// 저주 제단의 저주 (문에 미리 정해져 보인다)
const DG_CURSES = {
  taken:  { name: '받는 피해 +25%' },
  bossHp: { name: '다음 보스 체력 +50%' },
  wound:  { name: '지금 체력 30% 잃음' },
};
// 카드 — rar: 0 일반 · 1 희귀 · 2 전설, tag: 재화 id | fight | trade | gamble. 재화 카드는 같은 걸 여러 장 가질 수 있다 (같은 재화 3장 = 잭팟 방)
const DG_CARDS = {
  atk:      { rar: 0, tag: 'fight', icon: '⚔️', name: '전투의 함성',   desc: '공격력 +20%', fx: { atk: 0.2 } },
  hide:     { rar: 0, tag: 'fight', icon: '🛡️', name: '두꺼운 가죽',   desc: '받는 피해 −20%', fx: { taken: -0.2 } },
  mend:     { rar: 1, tag: 'fight', icon: '💚', name: '전장의 숨결',   desc: '전투 방을 깰 때마다 체력 8% 회복', fx: { roomHeal: 0.08 } },
  slayer:   { rar: 1, tag: 'fight', icon: '👑', name: '보스 사냥꾼',   desc: '보스에게 주는 피해 +40%', fx: { bossDmg: 0.4 } },
  feast:    { rar: 1, tag: 'fight', icon: '🍖', name: '포식',          desc: '정예 둥지를 깨면 체력 25% 회복', fx: { eliteHeal: 0.25 } },
  broker:   { rar: 1, tag: 'trade', icon: '⚖️', name: '거상의 저울',   desc: '환전소에서 손해 없이 바꿈', fx: { exch: 1 }, one: true },
  haggle:   { rar: 0, tag: 'trade', icon: '🏷️', name: '흥정',          desc: '상인 카드값 40% 할인', fx: { disc: 0.4 }, one: true },
  dice:     { rar: 1, tag: 'trade', icon: '🎲', name: '손때 묻은 주사위', desc: '도박 승률 50% → 60%', fx: { gamble: 0.1 }, one: true },
  key:      { rar: 0, tag: 'trade', icon: '🗝️', name: '녹슨 열쇠',     desc: '봉인된 문 열쇠 +1', fx: {}, key: 1 },
  allin:    { rar: 2, tag: 'gamble', icon: '🎰', name: '올인',         desc: `보스를 잡으면 배낭 ×${DG_ALLIN_MULT} (원래 ×${DG_BOSS_MULT}), 쓰러지면 배낭을 전부 잃음`, fx: { allin: 1 }, one: true },
  greedy:   { rar: 2, tag: 'gamble', icon: '🤑', name: '욕심쟁이',     desc: '목표 재화 획득 +80%, 받는 피해 +30%', fx: { greedy: 1, taken: 0.3 }, one: true },
  chain:    { rar: 2, tag: 'gamble', icon: '🔗', name: '연쇄 채굴',    desc: '같은 재화 방을 연달아 깨면 +15%씩 쌓임 (끊기면 처음부터)', fx: { chain: 0.15 }, one: true },
};
for (const r of DG_RES_IDS) {
  const d = DG_RES[r];
  DG_CARDS[r + '1'] = { rar: 0, tag: r, icon: d.icon, name: `${d.name} 감별안`, desc: `${d.name} 획득 +30%`, fx: { gain: { [r]: 0.3 } } };
  DG_CARDS[r + '2'] = { rar: 1, tag: r, icon: d.icon, name: `${d.name} 지도`, desc: `${d.room} 문이 두 배로 자주 · ${d.name} 획득 +15%`, fx: { gain: { [r]: 0.15 }, door: { [r]: 1 } } };
}
const DG_RAR = [{ name: '일반', w: 70 }, { name: '희귀', w: 25 }, { name: '전설', w: 5 }];

const freshDungeon = () => ({
  tixDay: '', tixUsed: 0, clr: { easy: 0, normal: 0, hard: 0, hell: 0 },
  pol: { target: 'ore', risky: false, gate: 0.6, fast: false }, run: null, last: null,
});

const dgUnlocked = () => S.best >= DG_UNLOCK_STAGE;
const dgRand = (a, b) => a + Math.random() * (b - a);
const dgPick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function dgPickW(list, wOf) {
  let r = Math.random() * list.reduce((a, x) => a + wOf(x), 0);
  for (const x of list) { r -= wOf(x); if (r <= 0) return x; }
  return list[list.length - 1];
}
// 소수 보상은 확률로 올림해서 정수로 (비전서 0.4권 → 40% 확률로 1권)
const dgRound = (x) => Math.floor(x) + (Math.random() < x - Math.floor(x) ? 1 : 0);

// ── 입장권 ──
function dgTickets() {
  if (S.dg.tixDay !== todayKey()) { S.dg.tixDay = todayKey(); S.dg.tixUsed = 0; }
  return Math.max(0, DG_TICKETS - S.dg.tixUsed);
}
// 이 난이도(번호)를 고를 수 있나: 바로 앞 난이도를 한 번 완주해야 열린다
const dgDiffOpen = (i) => i === 0 || S.dg.clr[DG_DIFFS[i - 1].id] > 0;
// 완주한 가장 높은 난이도 번호 (-1 = 아직 없음) — 방 해금 기준
const dgTopClear = () => { let t = -1; DG_DIFFS.forEach((d, i) => { if (S.dg.clr[d.id] > 0) t = i; }); return t; };
const dgRoomOpen = (id) => dgTopClear() >= DG_ROOMS_DEF[id].need;

// ── 전투력 기준 스테이지 ──
// 던전 몬스터. kind: normal(원정과 같은 몬스터) · elite(체력 ×2 · 공격력 ×2.2) · boss
function dgMob(stage, kind) {
  const n = monsterStats(stage, false);
  if (kind === 'elite') return { ...n, hp: n.hp * 2, atk: n.atk * 2.2, gold: 0, exp: n.exp * 2 };
  if (kind === 'boss') return { hp: 14 * Math.pow(1.23, stage - 1) * 14, atk: 3 * Math.pow(1.17, stage - 1) * 2.6, gold: 0, exp: n.exp * 12, boss: true };
  return { ...n, gold: 0 };
}
// 지금 능력치로 보스와 싸우면 잃는 체력(최대 체력 비율)의 기대값. o: 카드·저주 효과 (dgFx)
function dgBossLoss(stage, st = stats(true), fx = null) {
  const b = dgMob(stage, 'boss');
  const hp = b.hp * (fx && fx.bossHp ? 1 + fx.bossHp : 1);
  const dps = dpsOf(st) * (fx ? (1 + fx.atk) * (1 + fx.bossDmg) : 1);
  const taken = fx ? Math.max(0.2, 1 + fx.taken) : 1;
  return (hp / dps) * (b.atk / DG_MOB_CD) * (1 - st.guard) * taken / st.maxHp;
}
// 보스를 겨우 잡는(기대 피해가 체력을 다 쓰는) 스테이지
function dgLimitStage() {
  const st = stats(true);
  let lo = 1, hi = 4000;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (dgBossLoss(mid, st) >= 1) hi = mid; else lo = mid + 1; }
  return lo;
}
const dgStageOf = (i) => Math.max(1, dgLimitStage() + DG_DIFFS[i].off);

// ── 재화 1칸 값 ──
// 목재·철광석·마력석은 내 건물 레벨 기준: 건물 4개의 다음 레벨 비용 평균 × DG_BLD_SHARE 를 보통 난이도 신중한 1판(약 DG_RUN_UNITS 칸)에 나눠 준다
//  → 한 재화만 쫓아 보통을 완주하면 다음 레벨 비용의 약 60% (하루 입장권 3장을 나눠 쓰면 늘 살짝 모자라게). 건물을 올릴수록 함께 늘어서 어느 구간에서든 체감이 같다
//    (스테이지와 건물 레벨은 따로 논다 — 스테이지 130 에 건물 Lv7~8 인 기사도 있다)
//  골드·강화석·비전서는 최고 스테이지 기준 (골드는 사냥 30분치, 강화석·비전서는 보조 수급)
const DG_BLD_SHARE = 0.6;
const DG_RUN_UNITS = 45;
function dgNextBuildCost(k) {
  const ids = Object.keys(BUILDINGS);
  const sum = ids.reduce((a, id) => a + buildCost(id, Math.min(S.bld[id], BUILD_MAX - 1))[k], 0);
  return sum / ids.length;
}
function dgUnitValue(r, best = S.best) {
  switch (r) {
    case 'gold': return monsterStats(best, false).gold * 300 / DG_RUN_UNITS;
    case 'wood': return Math.max(1, dgNextBuildCost('wood') * DG_BLD_SHARE / DG_RUN_UNITS);
    case 'ore': return Math.max(1, dgNextBuildCost('ore') * DG_BLD_SHARE / DG_RUN_UNITS);
    // 마력석은 건물 Lv5 부터 들어서 그 전엔 전직·탑 입장권 몫으로 조금
    case 'mana': return Math.max(0.4, dgNextBuildCost('mana') * DG_BLD_SHARE / DG_RUN_UNITS);
    case 'stones': return (40 + 0.4 * best) / DG_RUN_UNITS;
    case 'tomes': return (8 + best / 8) / DG_RUN_UNITS;
  }
  return 0;
}

// ── 카드 효과 합치기 ──
function dgFx(run = S.dg.run) {
  const fx = { gain: {}, door: {}, atk: 0, taken: 0, roomHeal: 0, bossDmg: 0, eliteHeal: 0, exch: 0, disc: 0, gamble: 0, allin: 0, greedy: 0, chain: 0, bossHp: 0 };
  if (!run) return fx;
  for (const id of run.cards) {
    const f = DG_CARDS[id].fx;
    for (const k of Object.keys(f)) {
      if (k === 'gain' || k === 'door') for (const r of Object.keys(f[k])) fx[k][r] = (fx[k][r] || 0) + f[k][r];
      else fx[k] += f[k];
    }
  }
  fx.atk += run.buff.atk || 0;
  if (run.curse.taken) fx.taken += 0.25 * run.curse.taken;
  if (run.curse.bossHp) fx.bossHp += 0.5 * run.curse.bossHp;
  return fx;
}
// stats() 가 곱하는 던전 배율 (core.js)
const dgActive = () => S.phase === 'dungeon' && !!S.dg.run;
// 같은 재화 카드 수
const dgResCards = (r, run = S.dg.run) => run.cards.filter((id) => DG_CARDS[id].tag === r).length;
const dgSynergy = (r, run = S.dg.run) => dgResCards(r, run) >= 3;

// ── 시작 / 끝 ──
function dgBlocker(i = 0) {
  if (!dgUnlocked()) return `스테이지 ${DG_UNLOCK_STAGE} 도달 시 열려요`;
  if (S.phase !== 'camp') return '캠프에서만 들어갈 수 있어요';
  if (!dgDiffOpen(i)) return `${DG_DIFFS[i - 1].name}을(를) 한 번 완주하면 열려요`;
  if (dgTickets() <= 0) return '입장권이 없어요 (자정에 충전)';
  return '';
}
function startDungeon(i) {
  if (dgBlocker(i)) return false;
  S.dg.tixUsed++;
  const uv = {};
  for (const r of DG_RES_IDS) uv[r] = dgUnitValue(r);
  S.dg.run = {
    diff: i, stage0: dgStageOf(i), sec: 0, ri: 0, uv, bag: Object.fromEntries(DG_RES_IDS.map((r) => [r, 0])),
    cards: [], buff: {}, curse: {}, keys: 0, rerolls: DG_CARD_REROLLS, chain: null, room: null, fight: null, prompt: null, inFight: false,
    kills: 0, rooms: 0, bosses: 0, t0: Date.now(),
  };
  S.phase = 'dungeon';
  S.hp = stats().maxHp;
  dgFork();
  return true;
}
// reason: exit 귀환문 · clear 완주 · down 쓰러짐 · retreat 후퇴 · offline 앱을 꺼서
function endDungeon(reason) {
  const run = S.dg.run;
  if (!run) return null;
  const fx = dgFx(run);
  const keep = reason === 'exit' || reason === 'clear' || (reason === 'offline' && !run.inFight) ? 1 : fx.allin && reason === 'down' ? 0 : 0.5;
  const got = {}, lost = {};
  for (const r of DG_RES_IDS) {
    got[r] = Math.floor(run.bag[r] * keep);
    lost[r] = run.bag[r] - got[r];
  }
  S.gold += got.gold; S.mats.wood += got.wood; S.mats.ore += got.ore; S.mats.mana += got.mana; S.stones += got.stones; S.tomes += got.tomes;
  const d = DG_DIFFS[run.diff], first = reason === 'clear' && !S.dg.clr[d.id];
  if (reason === 'clear') S.dg.clr[d.id]++;
  const at = Date.now();
  S.dg.last = {
    reason, diff: run.diff, sec: run.sec, bosses: run.bosses, rooms: run.rooms, got, lost, keep, cards: run.cards.slice(), kills: run.kills,
    dur: reason === 'offline' ? 0 : (at - run.t0) / 1000, at, first, seen: false,
  };
  S.dg.run = null;          // phase 는 부른 쪽이 캠프로 돌린다 (하단바는 귀환 연출이 끝난 뒤, 오프라인은 바로)
  return S.dg.last;
}

// ── 배낭 ──
// 재화 units 칸을 배낭에 넣는다 (난이도·카드·연쇄 배율 반영). 넣은 양을 돌려준다
function dgGain(r, units, run = S.dg.run) {
  const fx = dgFx(run);
  let mult = DG_DIFFS[run.diff].mult * (1 + (fx.gain[r] || 0) + (fx.greedy && r === S.dg.pol.target ? 0.8 : 0));
  if (fx.chain && run.chain && run.chain.r === r) mult *= 1 + fx.chain * (run.chain.n - 1);
  const amt = Math.max(1, dgRound(units * run.uv[r] * mult));
  run.bag[r] += amt;
  return amt;
}
// 배낭에서 가장 많은(값 기준) 재화 순서. except 는 뺀다
const dgBagOrder = (run, except) => DG_RES_IDS.filter((r) => r !== except && run.bag[r] > 0).sort((a, b) => run.bag[b] / run.uv[b] - run.bag[a] / run.uv[a]);
const dgBagUnits = (run) => DG_RES_IDS.reduce((a, r) => a + run.bag[r] / run.uv[r], 0);

// ── 갈림길 ──
// 문 하나: { id 방, res 재화(있으면), curse 저주(제단) }
function dgDoorWeight(id) {
  const d = DG_ROOMS_DEF[id], run = S.dg.run;
  if (!dgRoomOpen(id)) return 0;
  if (id === 'seal' && run.keys <= 0) return 0;
  if (id === 'jackpot' && !DG_RES_IDS.some((r) => dgSynergy(r))) return 0;
  return d.w;
}
function dgDoorRes(id) {
  const run = S.dg.run, fx = dgFx(run);
  const list = id === 'jackpot' ? DG_RES_IDS.filter((r) => dgSynergy(r)) : DG_RES_IDS;
  return dgPickW(list, (r) => DG_RES[r].w * (r === S.dg.pol.target ? 2 : 1) * (1 + (fx.door[r] || 0)));
}
function dgMakeDoors() {
  const ids = Object.keys(DG_ROOMS_DEF);
  const doors = [], key = (d) => d.id + (d.res || '');
  for (let guard = 0; doors.length < 3 && guard < 60; guard++) {
    const id = dgPickW(ids, dgDoorWeight);
    const door = { id };
    if (DG_ROOMS_DEF[id].hasRes) door.res = dgDoorRes(id);
    if (id === 'altar') door.curse = dgPick(Object.keys(DG_CURSES));
    if (doors.some((d) => key(d) === key(door)) || (DG_ROOMS_DEF[id].fam !== 'res' && doors.some((d) => d.id === id))) continue;
    doors.push(door);
  }
  // 재화 문은 하나 이상
  if (!doors.some((d) => d.id === 'res')) doors[Math.floor(Math.random() * doors.length)] = { id: 'res', res: dgDoorRes('res') };
  return doors;
}
function dgFork() {
  const run = S.dg.run;
  run.room = null; run.fight = null;
  run.prompt = { kind: 'fork', opts: dgMakeDoors(), left: DG_PICK_SEC };
}
// 문 이름 / 한 줄 설명 (화면용)
function dgDoorName(d) {
  if (d.id === 'res') return `${DG_RES[d.res].room}`;
  return DG_ROOMS_DEF[d.id].name;
}
function dgDoorIcon(d) { return d.id === 'res' ? DG_RES[d.res].icon : DG_ROOMS_DEF[d.id].icon; }
function dgDoorDesc(d) {
  const def = DG_ROOMS_DEF[d.id];
  if (d.id === 'res') return `${DG_RES[d.res].name} · 몹 3마리`;
  if (d.id === 'altar') return `${DG_RES[d.res].icon} 큰 보상 · ${DG_CURSES[d.curse].name}`;
  if (def.hasRes) return `${DG_RES[d.res].icon} ${def.desc}`;
  return def.desc;
}

// ── 고르기 ──
// 지금 프롬프트에서 i 번 선택지를 고른다. 화면에 띄울 결과 { text, sub } 를 돌려준다 (없으면 null)
function dgChoose(i) {
  const run = S.dg.run;
  if (!run || !run.prompt) return null;
  const p = run.prompt, o = p.opts[i];
  if (!o || o.off) return null;
  run.prompt = null;
  if (p.kind === 'fork') return dgEnter(o);
  if (p.kind === 'card') {
    if (o.reroll) { dgCardPrompt(p.why, true); return null; }
    if (!o.skip) dgTakeCard(o.card);
    dgAfterCard(p.why);
    return o.skip ? null : { text: `${DG_CARDS[o.card].icon} ${DG_CARDS[o.card].name}`, sub: DG_CARDS[o.card].desc, card: o.card };
  }
  if (p.kind === 'gate') {
    if (o.exit) { endDungeon('exit'); return { end: true }; }
    dgBossFight();
    return null;
  }
  if (p.kind === 'event') return dgEvent(p.room, o);
  return null;
}

function dgEnter(door) {
  const run = S.dg.run, def = DG_ROOMS_DEF[door.id];
  run.room = door;
  run.rooms++;
  if (def.mobs) {
    const st = run.stage0 + run.sec;
    run.fight = { kind: def.mobs.kind, mobs: Array.from({ length: def.mobs.n }, () => dgMob(st, def.mobs.kind)), stage: st };
    run.inFight = true;
    return null;
  }
  // 싸우지 않는 방
  switch (door.id) {
    case 'camp':
      run.prompt = { kind: 'event', room: door, left: DG_PICK_SEC, opts: [
        { id: 'rest', label: '🔥 휴식', desc: '체력 40% 회복' },
        { id: 'drill', label: '⚔️ 정비', desc: '이번 판 공격력 +10%' },
      ] };
      return null;
    case 'merchant': {
      const fx = dgFx(run), top = dgBagOrder(run)[0];
      const price = top ? Math.max(1, Math.floor(run.bag[top] * 0.3 * (1 - fx.disc))) : 0;
      const cards = dgCardChoices(2);
      run.prompt = { kind: 'event', room: door, left: DG_PICK_SEC, opts: [
        ...cards.map((c) => ({ id: 'buy', card: c, label: `${DG_CARDS[c].icon} ${DG_CARDS[c].name}`, desc: top ? `${DG_RES[top].icon} ${fmt(price)} — ${DG_CARDS[c].desc}` : '배낭이 비어 살 수 없어요', res: top, price, off: !top })),
        { id: 'leave', label: '🚪 그냥 간다', desc: '' },
      ] };
      return null;
    }
    case 'exchange': {
      const fx = dgFx(run), to = S.dg.pol.target, rate = fx.exch ? 1 : 0.7;
      const from = dgBagOrder(run, to).slice(0, 2);
      run.prompt = { kind: 'event', room: door, left: DG_PICK_SEC, opts: [
        ...from.map((r) => {
          const out = Math.floor(run.bag[r] / run.uv[r] * run.uv[to] * rate);
          return { id: 'swap', from: r, to, out, label: `${DG_RES[r].icon} → ${DG_RES[to].icon}`, desc: `${DG_RES[r].name} ${fmt(run.bag[r])} → ${DG_RES[to].name} ${fmt(out)}` };
        }),
        { id: 'leave', label: '🚪 그냥 간다', desc: from.length ? '' : '바꿀 재화가 없어요' },
      ] };
      return null;
    }
    case 'gamble': {
      const fx = dgFx(run), win = 0.5 + fx.gamble;
      const bets = dgBagOrder(run).slice(0, 2);
      run.prompt = { kind: 'event', room: door, left: DG_PICK_SEC, opts: [
        ...bets.map((r) => ({ id: 'bet', res: r, win, label: `${DG_RES[r].icon} 건다`, desc: `${Math.round(win * 100)}% → ${fmt(run.bag[r] * 2)} · 실패하면 0` })),
        { id: 'leave', label: '🚪 그냥 간다', desc: bets.length ? '' : '걸 재화가 없어요' },
      ] };
      return null;
    }
    case 'altar':
      run.prompt = { kind: 'event', room: door, left: DG_PICK_SEC, opts: [
        { id: 'take', label: `🩸 받는다`, desc: `${DG_RES[door.res].icon} ${DG_RES[door.res].name} 4칸 · ${DG_CURSES[door.curse].name}` },
        { id: 'leave', label: '🚪 그냥 간다', desc: '' },
      ] };
      return null;
    case 'seal':
      run.prompt = { kind: 'event', room: door, left: DG_PICK_SEC, opts: [
        { id: 'open', label: '🗝️ 연다', desc: `열쇠 1개 → ${DG_RES[S.dg.pol.target].icon} ${DG_RES[S.dg.pol.target].name} 8칸` },
        { id: 'leave', label: '🚪 그냥 간다', desc: '' },
      ] };
      return null;
    case 'unknown': {
      const x = Math.random();
      if (x < 0.5) {
        const r = dgPick(DG_RES_IDS), amt = dgGain(r, 3);
        const key = Math.random() < 0.25;
        if (key) run.keys++;
        dgNext();
        return { text: '✨ 숨겨진 보물!', sub: `${DG_RES[r].icon} +${fmt(amt)}${key ? ' · 🗝️ 열쇠 +1' : ''}`, gain: { [r]: amt } };
      }
      if (x < 0.75) {
        const max = stats().maxHp;
        S.hp = Math.max(1, S.hp - max * 0.25);
        dgNext();
        return { text: '💥 함정!', sub: '체력 25% 잃음', bad: true };
      }
      dgCardPrompt('unknown');
      return { text: '🃏 떠도는 영혼의 선물', sub: '카드 한 장을 고르세요' };
    }
  }
  dgNext();
  return null;
}

// 이벤트 방 선택
function dgEvent(room, o) {
  const run = S.dg.run;
  let out = null;
  switch (o.id) {
    case 'rest': { const max = stats().maxHp; S.hp = Math.min(max, S.hp + max * 0.4); out = { text: '🔥 휴식', sub: '체력 +40%' }; break; }
    case 'drill': run.buff.atk = (run.buff.atk || 0) + 0.1; out = { text: '⚔️ 정비', sub: '공격력 +10%' }; break;
    case 'buy':
      run.bag[o.res] -= o.price;
      dgTakeCard(o.card);
      out = { text: `🛒 ${DG_CARDS[o.card].icon} ${DG_CARDS[o.card].name}`, sub: DG_CARDS[o.card].desc, card: o.card };
      break;
    case 'swap':
      run.bag[o.from] = 0; run.bag[o.to] += o.out;
      out = { text: '🔀 환전', sub: `${DG_RES[o.to].icon} +${fmt(o.out)}`, gain: { [o.to]: o.out } };
      break;
    case 'bet': {
      const had = run.bag[o.res];
      if (Math.random() < o.win) { run.bag[o.res] *= 2; out = { text: '🎲 대박!', sub: `${DG_RES[o.res].icon} +${fmt(had)}`, gain: { [o.res]: had } }; }
      else { run.bag[o.res] = 0; out = { text: '🎲 꽝…', sub: `${DG_RES[o.res].icon} −${fmt(had)}`, bad: true }; }
      break;
    }
    case 'take': {
      const amt = dgGain(room.res, DG_ROOMS_DEF.altar.units);
      if (room.curse === 'wound') S.hp = Math.max(1, S.hp - stats().maxHp * 0.3);
      else run.curse[room.curse] = (run.curse[room.curse] || 0) + 1;
      out = { text: '🩸 저주받은 보물', sub: `${DG_RES[room.res].icon} +${fmt(amt)} · ${DG_CURSES[room.curse].name}`, gain: { [room.res]: amt }, bad: true };
      break;
    }
    case 'open': {
      run.keys--;
      const r = S.dg.pol.target, amt = dgGain(r, DG_ROOMS_DEF.seal.units);
      out = { text: '🗝️ 봉인 해제!', sub: `${DG_RES[r].icon} +${fmt(amt)}`, gain: { [r]: amt }, big: true };
      break;
    }
  }
  dgNext();
  return out;
}

// 싸움이 끝난 방 정산. 화면에 띄울 결과를 돌려준다
function dgRoomCleared() {
  const run = S.dg.run, door = run.room;
  run.fight = null; run.inFight = false;
  if (door.id === 'boss') return dgBossCleared();
  const def = DG_ROOMS_DEF[door.id], fx = dgFx(run);
  run.chain = run.chain && run.chain.r === door.res ? { r: door.res, n: run.chain.n + 1 } : { r: door.res, n: 1 };
  const amt = dgGain(door.res, def.units);
  const max = stats().maxHp;
  let heal = fx.roomHeal;
  if (door.id === 'elite') heal += fx.eliteHeal;
  if (heal) S.hp = Math.min(max, S.hp + max * heal);
  let key = false;
  if (door.id === 'elite' && Math.random() < 0.3) { run.keys++; key = true; }
  const out = { text: door.id === 'jackpot' ? '🌟 잭팟!' : `${dgDoorName(door)} 돌파`, sub: `${DG_RES[door.res].icon} +${fmt(amt)}${key ? ' · 🗝️ 열쇠 +1' : ''}${fx.chain && run.chain.n > 1 ? ` · 🔗 ${run.chain.n}연쇄` : ''}`, gain: { [door.res]: amt }, big: door.id === 'jackpot' };
  if (door.id === 'elite') dgCardPrompt('elite');
  else dgNext();
  return out;
}

// 다음으로: 구간의 방을 다 지났으면 귀환문, 아니면 갈림길
function dgNext() {
  const run = S.dg.run;
  if (!run || run.prompt) return;
  run.ri++;
  if (run.ri >= DG_ROOMS) dgGate();
  else dgFork();
}

// ── 귀환문 / 보스 ──
// 보스를 이길 확률(예상): 실제 피해는 기대값의 0.8~1.2 배로 흔들린다고 본다
function dgWinChance(run = S.dg.run) {
  const st = stats(true), fx = dgFx(run);
  const loss = dgBossLoss(run.stage0 + run.sec, st, fx) * stats().maxHp / st.maxHp;
  const hp = Math.max(0, S.hp) / stats().maxHp;
  return Math.max(0, Math.min(1, (hp - loss * 0.8) / (loss * 0.4)));
}
function dgGate() {
  const run = S.dg.run;
  run.room = null; run.fight = null;
  run.prompt = { kind: 'gate', left: DG_GATE_SEC, opts: [{ exit: true }, { fight: true }] };
}
function dgBossFight() {
  const run = S.dg.run, st = run.stage0 + run.sec, fx = dgFx(run);
  const b = dgMob(st, 'boss');
  if (fx.bossHp) b.hp *= 1 + fx.bossHp;
  run.room = { id: 'boss' };
  run.fight = { kind: 'boss', mobs: [b], stage: st };
  run.inFight = true;
}
function dgBossCleared() {
  const run = S.dg.run, fx = dgFx(run);
  const mult = fx.allin ? DG_ALLIN_MULT : DG_BOSS_MULT;
  for (const r of DG_RES_IDS) run.bag[r] = Math.floor(run.bag[r] * mult);
  const t = S.dg.pol.target, amt = dgGain(t, 2);
  run.bosses++;
  run.curse.bossHp = 0;                  // '다음 보스' 저주는 한 번만
  const key = Math.random() < 0.3;
  if (key) run.keys++;
  const last = run.sec >= DG_SECTIONS - 1;
  if (last) { endDungeon('clear'); return { text: '🏆 완주!', sub: `배낭 ×${mult} · ${DG_RES[t].icon} +${fmt(amt)}`, big: true, end: true }; }
  dgCardPrompt('boss');
  return { text: '👑 보스 처치!', sub: `배낭 ×${mult} · 보물 ${DG_RES[t].icon} +${fmt(amt)}${key ? ' · 🗝️ +1' : ''}`, gain: { [t]: amt }, big: true };
}
// 던전 몬스터 처치: 경험치만 (재화는 방을 깨야 들어온다)
function dgKill(m) {
  const run = S.dg.run;
  if (!run) return;
  run.kills++;
  if (m.exp) gainExp(m.exp * expMult());
}

// ── 카드 ──
function dgCardChoices(n) {
  const run = S.dg.run, ids = Object.keys(DG_CARDS).filter((id) => !(DG_CARDS[id].one && run.cards.includes(id)));
  const out = [];
  for (let guard = 0; out.length < n && guard < 80; guard++) {
    const rar = dgPickW([0, 1, 2], (i) => DG_RAR[i].w);
    const pool = ids.filter((id) => DG_CARDS[id].rar === rar && !out.includes(id));
    if (!pool.length) continue;
    out.push(dgPickW(pool, (id) => (DG_CARDS[id].tag === S.dg.pol.target ? 3 : 1)));
  }
  return out;
}
// why: boss | elite | unknown — 고른 뒤 어디로 갈지
function dgCardPrompt(why, reroll = false) {
  const run = S.dg.run;
  if (reroll) run.rerolls--;
  const opts = dgCardChoices(3).map((card) => ({ card }));
  if (run.rerolls > 0) opts.push({ reroll: true });
  opts.push({ skip: true });
  run.prompt = { kind: 'card', why, opts, left: DG_PICK_SEC };
}
function dgTakeCard(id) {
  const run = S.dg.run, c = DG_CARDS[id];
  const had = DG_RES[c.tag] ? dgSynergy(c.tag) : true;
  run.cards.push(id);
  if (c.key) run.keys += c.key;
  run.synergy = !had && DG_RES[c.tag] && dgSynergy(c.tag) ? c.tag : null;     // 이번에 시너지가 완성됐으면 화면에서 알린다
}
function dgAfterCard(why) {
  const run = S.dg.run;
  if (why === 'boss') { run.sec++; run.ri = 0; dgFork(); return; }
  dgNext();
}

// ── 방침 (자동 선택) ──
// 지금 프롬프트에서 방침이 고를 선택지 번호
function dgAutoPick() {
  const run = S.dg.run, p = run && run.prompt, pol = S.dg.pol;
  if (!p) return -1;
  const hp = Math.max(0, S.hp) / stats().maxHp;
  const best = (score) => p.opts.reduce((bi, o, i) => (score(o) > score(p.opts[bi]) ? i : bi), 0);
  if (p.kind === 'fork') {
    return best((d) => {
      const tgt = d.res === pol.target ? 3 : 0;
      switch (d.id) {
        case 'res': return 6 + tgt;
        case 'jackpot': return 12 + tgt;
        case 'camp': return hp < 0.5 ? 11 : 1;
        case 'elite': case 'gauntlet': return pol.risky && hp > 0.6 ? 7 + tgt : 0;
        case 'altar': return pol.risky && hp > 0.7 ? 5 + tgt : -1;
        case 'exchange': return dgBagOrder(run, pol.target).length ? 8 : 2;
        case 'merchant': return dgBagUnits(run) > 4 ? 5 : 1;
        case 'seal': return 10;
        default: return pol.risky ? 4 : 2;
      }
    });
  }
  if (p.kind === 'card') {
    return best((o) => {
      if (o.skip) return 0;
      if (o.reroll) return 0.5;
      const c = DG_CARDS[o.card];
      if (c.tag === pol.target) return 10 + c.rar;
      if (c.tag === 'fight') return (hp < 0.5 && (o.card === 'mend' || o.card === 'feast') ? 9 : 6) + c.rar;
      if (c.tag === 'gamble') return pol.risky ? 8 : 1;
      if (DG_RES[c.tag]) return 3 + c.rar;
      return 2 + c.rar;
    });
  }
  if (p.kind === 'gate') return dgWinChance() < pol.gate ? 0 : 1;
  if (p.kind === 'event') {
    return best((o) => {
      if (o.off) return -5;
      switch (o.id) {
        case 'rest': return hp < 0.75 ? 5 : 1;
        case 'drill': return hp < 0.75 ? 1 : 5;
        case 'buy': return DG_CARDS[o.card].tag === pol.target || DG_CARDS[o.card].tag === 'fight' ? 3 : 0.5;
        case 'swap': return 4 + o.out / run.uv[o.to];
        case 'bet': return pol.risky ? 2 : -1;
        case 'take': return pol.risky ? 2 : -1;
        case 'open': return 10;
        case 'leave': return 0;
      }
      return 0;
    });
  }
  return 0;
}
// 시간이 다 됐을 때 (또는 '바로 자동 선택')
const dgAuto = () => dgChoose(dgAutoPick());
