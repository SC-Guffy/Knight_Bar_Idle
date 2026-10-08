'use strict';
// 재료의 미궁 = 보스 러시 + 슬롯머신. core.js 처럼 DOM 을 모르고 S 상태만 바꾼다. 하단바 연출(보스·슬롯머신·쏟아지는 재화)은 world.js 의 updateDungeon.
//  S.dg = {
//    tixDay, tixUsed: 오늘 쓴 입장권 수 (하루 DG_TICKETS 장),
//    best: 한 판에 가장 많이 잡은 보스 수, perfects: 통산 퍼펙트 횟수,
//    run: 진행 중인 도전 | null,
//    last: 마지막 결과 { reason, bosses, got, kills, spins, dur, at, best(신기록), seen } | null,
//  }
//  run = { stage0 첫 보스 스테이지, k 잡은 보스 수, uv 재화 1칸 값, bag 배낭, fight 싸울 보스 | null, inFight,
//          slot 지금 돌릴 슬롯 결과 | null { reels, tier, payout, mult, paid }, spins { diff, pair, perfect } 결과 수, kills, t0 }
// 규칙
//  - 고를 것이 없다. 보스가 한 마리씩 나오고, 잡을 때마다 슬롯머신을 한 번 돌린다. 보스는 한 마리마다 1 스테이지씩 세진다.
//  - 슬롯은 3칸, 칸마다 재화 6종 중 하나. 결과는 세 가지 — 셋 다 다름(각각 소량) · 2연속(그 재화 중량 + 나머지 소량) · 3연속 퍼펙트(그 재화 대량).
//    등급은 DG_SLOT_TIERS 확률로 먼저 정하고 그에 맞는 그림을 뽑는다 (칸 셋이 독립이면 퍼펙트가 2.8% 뿐이라 너무 안 터진다).
//    보상은 잡은 보스 수에 따라 ×(1 + DG_BOSS_BONUS × k) — 깊이 갈수록 한 번이 크다.
//  - 체력은 저절로 차지 않지만(물약도 못 쓴다) 보스를 잡으면 DG_HEAL 만큼 찬다. 쓰러져도 모은 자원은 모두 가져간다. 언제든 나갈 수 있다.
//  - 난이도는 내 전투력 기준이다: dgLimitStage = 지금 능력치로 보스를 겨우 잡는 스테이지. 첫 보스는 거기서 DG_OFF0 만큼 아래, 한 마리마다 +1.
//    스테이지당 기대 피해가 ×1.44 라 누구나 8~9 마리쯤에서 쓰러진다 (시뮬: 중앙 9, 10%~90% 가 8~9). 성장하면 같은 '보스 9' 가 더 센 놈이고 보상도 커진다.
//  - 재화 1칸 값(dgUnitValue): 한 판 기대 칸(DG_RUN_UNITS)이 목재·철광석·마력석은 내 건물 다음 레벨 비용 평균의 DG_RUN_SHARE 배가 되게 —
//    재화 여섯에 나뉘니 한 판에 재화당 다음 레벨의 25% 쯤, 하루 입장권 3장이면 75% ("살짝 모자란 듯"). 골드는 사냥 30분치, 강화석·비전서는 보조 수급.

const DG_UNLOCK_STAGE = 15;
const DG_TICKETS = 3;
const DG_OFF0 = -10;                // 첫 보스 = 한계 스테이지 − 10
const DG_STEP = 1;                  // 보스마다 스테이지 +1
const DG_HEAL = 0.1;                // 보스를 잡으면 체력 10% 회복
const DG_BOSS_BONUS = 0.25;         // 보스 k(0부터) 의 슬롯 보상 ×(1 + 0.25k)
const DG_MOB_CD = 1.4;              // 승률 계산용 몬스터 공격 간격 (MONSTERS[].atkCd 기본값)
// 슬롯 결과 등급 — w: 확률 가중치, big: 맞춘 재화 칸 수, small: 나머지 칸 수
const DG_SLOT_TIERS = {
  diff:    { name: '3종',    w: 45, big: 0,  small: 1 },     // 셋 다 다름: 세 재화 1칸씩
  pair:    { name: '2연속',  w: 50, big: 6,  small: 1 },     // 둘 같음: 그 재화 6칸 + 나머지 1칸
  perfect: { name: '퍼펙트', w: 5,  big: 40, small: 0 },     // 셋 같음: 그 재화 40칸
};
const DG_SLOT_TIER_IDS = Object.keys(DG_SLOT_TIERS);

// 재화 — w: 슬롯 그림 가중치
const DG_RES = {
  gold:   { name: '골드',   icon: '💰', w: 9 },
  wood:   { name: '목재',   icon: '🪵', w: 11 },
  ore:    { name: '철광석', icon: '🪨', w: 11 },
  mana:   { name: '마력석', icon: '💎', w: 9 },
  stones: { name: '강화석', icon: '💠', w: 8 },
  tomes:  { name: '비전서', icon: '📖', w: 7 },
};
const DG_RES_IDS = Object.keys(DG_RES);

const freshDungeon = () => ({ tixDay: '', tixUsed: 0, best: 0, perfects: 0, run: null, last: null });

const dgUnlocked = () => S.best >= DG_UNLOCK_STAGE;
const dgRand = (a, b) => a + Math.random() * (b - a);
function dgPickW(list, wOf) {
  let r = Math.random() * list.reduce((a, x) => a + wOf(x), 0);
  for (const x of list) { r -= wOf(x); if (r <= 0) return x; }
  return list[list.length - 1];
}
// 소수 보상은 확률로 올림해서 정수로 (비전서 0.4권 → 40% 확률로 1권)
const dgRound = (x) => Math.floor(x) + (Math.random() < x - Math.floor(x) ? 1 : 0);
const dgRandRes = (except) => dgPickW(DG_RES_IDS.filter((r) => r !== except), (r) => DG_RES[r].w);

// ── 입장권 ──
function dgTickets() {
  if (S.dg.tixDay !== todayKey()) { S.dg.tixDay = todayKey(); S.dg.tixUsed = 0; }
  return Math.max(0, DG_TICKETS - S.dg.tixUsed);
}

// ── 전투력 기준 스테이지 ──
// 던전 보스: 같은 스테이지 몹보다 체력 ×14 · 공격력 ×2.6
function dgMob(stage, kind) {
  const n = monsterStats(stage, false);
  if (kind === 'boss') return { hp: 14 * Math.pow(1.23, stage - 1) * 14, atk: 3 * Math.pow(1.17, stage - 1) * 2.6, gold: 0, exp: n.exp * 12, boss: true };
  return { ...n, gold: 0 };
}
// 지금 능력치로 보스와 싸우면 잃는 체력(최대 체력 비율)의 기대값
function dgBossLoss(stage, st = stats(true)) {
  const b = dgMob(stage, 'boss');
  return (b.hp / dpsOf(st)) * (b.atk / DG_MOB_CD) * (1 - st.guard) / st.maxHp;
}
// 보스를 겨우 잡는(기대 피해가 체력을 다 쓰는) 스테이지
function dgLimitStage() {
  const st = stats(true);
  let lo = 1, hi = 4000;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (dgBossLoss(mid, st) >= 1) hi = mid; else lo = mid + 1; }
  return lo;
}
const dgStage0 = () => Math.max(1, dgLimitStage() + DG_OFF0);
const dgBossStage = (run = S.dg.run) => run.stage0 + run.k * DG_STEP;

// ── 재화 1칸 값 ──
// 슬롯 한 번의 기대 칸 × 한 판 기대 보스 수(DG_RUN_BOSSES, 배율 포함) = 한 판 기대 칸
const DG_SLOT_AVG = (() => { const tot = DG_SLOT_TIER_IDS.reduce((a, id) => a + DG_SLOT_TIERS[id].w, 0); return DG_SLOT_TIER_IDS.reduce((a, id) => { const t = DG_SLOT_TIERS[id]; return a + (t.w / tot) * (t.big ? t.big + t.small : 3 * t.small); }, 0); })();
const DG_RUN_BOSSES = 9;
const DG_RUN_UNITS = DG_SLOT_AVG * Array.from({ length: DG_RUN_BOSSES }, (_, k) => 1 + DG_BOSS_BONUS * k).reduce((a, b) => a + b, 0);
const DG_RUN_SHARE = 1.5;
function dgNextBuildCost(k) {
  const ids = Object.keys(BUILDINGS);
  const sum = ids.reduce((a, id) => a + buildCost(id, Math.min(S.bld[id], BUILD_MAX - 1))[k], 0);
  return sum / ids.length;
}
function dgUnitValue(r, best = S.best) {
  switch (r) {
    case 'gold': return monsterStats(best, false).gold * 300 / DG_RUN_UNITS;
    case 'wood': return Math.max(1, dgNextBuildCost('wood') * DG_RUN_SHARE / DG_RUN_UNITS);
    case 'ore': return Math.max(1, dgNextBuildCost('ore') * DG_RUN_SHARE / DG_RUN_UNITS);
    // 마력석은 건물 Lv5 부터 들어서 그 전엔 전직·탑 입장권 몫으로 조금
    case 'mana': return Math.max(0.4, dgNextBuildCost('mana') * DG_RUN_SHARE / DG_RUN_UNITS);
    case 'stones': return (40 + 0.4 * best) / DG_RUN_UNITS;
    case 'tomes': return (8 + best / 8) / DG_RUN_UNITS;
  }
  return 0;
}

// stats() 가 곱하는 던전 배율 (core.js) — 지금은 없다
const dgFx = () => ({ atk: 0, taken: 0 });
const dgActive = () => S.phase === 'dungeon' && !!S.dg.run;

// ── 시작 / 끝 ──
function dgBlocker() {
  if (!dgUnlocked()) return `스테이지 ${DG_UNLOCK_STAGE} 도달 시 열려요`;
  if (S.phase !== 'camp') return '캠프에서만 들어갈 수 있어요';
  if (dgTickets() <= 0) return '입장권이 없어요 (자정에 충전)';
  return '';
}
function startDungeon() {
  if (dgBlocker()) return false;
  S.dg.tixUsed++;
  const uv = {};
  for (const r of DG_RES_IDS) uv[r] = dgUnitValue(r);
  S.dg.run = {
    stage0: dgStage0(), k: 0, uv, bag: Object.fromEntries(DG_RES_IDS.map((r) => [r, 0])),
    fight: null, inFight: false, slot: null, spins: { diff: 0, pair: 0, perfect: 0 }, kills: 0, t0: Date.now(),
  };
  S.phase = 'dungeon';
  S.hp = stats().maxHp;
  dgBossFight();
  return true;
}
// reason: down 쓰러짐 · retreat 나가기 · offline 앱을 꺼서 — 어떻게 끝나든 배낭은 전부 가져간다
function endDungeon(reason) {
  const run = S.dg.run;
  if (!run) return null;
  if (run.slot && !run.slot.paid) dgSlotPayout(run.slot, run);
  const got = {};
  for (const r of DG_RES_IDS) got[r] = Math.floor(run.bag[r] || 0);
  S.gold += got.gold; S.mats.wood += got.wood; S.mats.ore += got.ore; S.mats.mana += got.mana; S.stones += got.stones; S.tomes += got.tomes;
  const k = run.k || 0, best = k > (S.dg.best || 0);
  if (best) S.dg.best = k;
  const at = Date.now();
  S.dg.last = { reason, bosses: k, got, kills: run.kills, spins: run.spins || { diff: 0, pair: 0, perfect: 0 }, dur: reason === 'offline' ? 0 : (at - run.t0) / 1000, at, best, seen: false };
  S.dg.run = null;          // phase 는 부른 쪽이 캠프로 돌린다 (하단바는 귀환 연출이 끝난 뒤, 오프라인은 바로)
  return S.dg.last;
}

// ── 보스 ──
function dgBossFight() {
  const run = S.dg.run, st = dgBossStage(run);
  run.fight = { kind: 'boss', mobs: [dgMob(st, 'boss')], stage: st };
  run.inFight = true;
  run.slot = null;
}
// 던전 보스 처치: 경험치만 (재화는 슬롯이 준다)
function dgKill(m) {
  const run = S.dg.run;
  if (!run) return;
  run.kills++;
  if (m.exp) gainExp(m.exp * expMult());
}
// 보스가 죽었다: 체력 조금 회복하고 슬롯을 뽑아 둔다 (연출이 끝나면 dgSlotPayout 으로 배낭에 들어간다). 화면에 띄울 결과를 돌려준다
function dgBossCleared() {
  const run = S.dg.run;
  run.fight = null; run.inFight = false;
  run.k++;
  const max = stats().maxHp;
  S.hp = Math.min(max, S.hp + max * DG_HEAL);
  run.slot = dgSpin(run);
  return { text: `👑 보스 ${run.k} 처치!`, sub: `❤️ +${Math.round(DG_HEAL * 100)}% · 🎰 슬롯!` };
}
// 슬롯 다음: 다음 보스
function dgNextBoss() {
  const run = S.dg.run;
  if (!run) return;
  dgBossFight();
}

// ── 슬롯 ──
// 결과 { reels: [재화 ×3], tier, payout: { 재화: 양 }, mult, paid }
function dgSpin(run = S.dg.run) {
  const tier = dgPickW(DG_SLOT_TIER_IDS, (id) => DG_SLOT_TIERS[id].w), t = DG_SLOT_TIERS[tier];
  const mult = 1 + DG_BOSS_BONUS * (run.k - 1);
  let reels;
  if (tier === 'perfect') { const r = dgRandRes(); reels = [r, r, r]; }
  else if (tier === 'pair') { const r = dgRandRes(), o = dgRandRes(r); reels = [r, r, o]; if (Math.random() < 0.4) reels = Math.random() < 0.5 ? [r, o, r] : [o, r, r]; }
  else { const a = dgRandRes(), b = dgRandRes(a); let c = dgRandRes(a); while (c === b) c = dgRandRes(a); reels = [a, b, c]; }
  const units = {};
  for (const r of reels) units[r] = units[r] || 0;
  if (t.big) { const main = reels.find((r) => reels.filter((x) => x === r).length >= 2); units[main] = t.big; for (const r of reels) if (r !== main) units[r] = t.small; }
  else for (const r of reels) units[r] = t.small;
  const payout = {};
  for (const r of Object.keys(units)) payout[r] = Math.max(1, dgRound(units[r] * run.uv[r] * mult));
  run.spins[tier]++;
  if (tier === 'perfect') S.dg.perfects = (S.dg.perfects || 0) + 1;
  return { reels, tier, payout, mult, paid: false };
}
// 슬롯 보상을 배낭에 넣는다 (연출이 끝날 때 · 던전이 끝날 때)
function dgSlotPayout(slot, run = S.dg.run) {
  if (!slot || slot.paid || !run) return;
  slot.paid = true;
  for (const r of Object.keys(slot.payout)) run.bag[r] += slot.payout[r];
}
const dgSlotText = (slot) => Object.keys(slot.payout).map((r) => `${DG_RES[r].icon} +${fmt(slot.payout[r])}`).join(' · ');
