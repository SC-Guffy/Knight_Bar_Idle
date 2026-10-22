'use strict';
// 재료의 미궁 = 보스 러시 + 슬롯머신. core.js 처럼 DOM 을 모르고 S 상태만 바꾼다. 하단바 연출(보스·슬롯머신·쏟아지는 재화)은 world.js 의 updateDungeon.
//  S.dg = {
//    tixDay, tixUsed: 오늘 쓴 무료 입장권 수 (하루 DG_TICKETS 장),
//    tixExtra: 사서 가진 입장권 (자정에 사라지지 않음, 무료를 다 쓴 뒤에 쓴다, 최대 SUB_TICKET_HOLD),
//    buyDay, bought: 오늘(buyDay) 산 장수 — 살수록 비싸진다 (탑과 따로 센다),
//    best: 한 판에 가장 많이 잡은 보스 수, perfects: 통산 퍼펙트 횟수,
//    run: 진행 중인 도전 | null,
//    last: 마지막 결과 { reason, bosses, got, kills, spins, dur, at, best(신기록), seen } | null,
//  }
//  run = { stage0 첫 보스 스테이지, k 잡은 보스 수, uv 재화 1칸 값, bag 배낭, fight 싸울 보스 | null, inFight,
//          slot 지금 돌릴 슬롯 결과 | null { reels, tier, payout, mult, paid }, spins { diff, pair, perfect } 결과 수, kills, t0 }
// 규칙
//  - 고를 것이 없다. 보스가 한 마리씩 나오고, 잡을 때마다 슬롯머신을 한 번 돌린다. 보스는 한 마리마다 1 스테이지씩 세진다.
//  - 슬롯은 3칸, 칸마다 재화 4종(💰🪵🪨📖) 중 하나 (0.28.6 에 💎 마력석·💠 강화석을 뺐다 — 한 판 수십 개라 다른 수급처에 묻혀서, docs/specs/dungeon-slot-roles.md). 결과는 세 가지 — 셋 다 다름(각각 소량) · 2연속(그 재화 중량 + 나머지 소량) · 3연속 퍼펙트(그 재화 대량).
//    등급은 DG_SLOT_TIERS 확률로 먼저 정하고 그에 맞는 그림을 뽑는다 (칸 셋이 독립이면 퍼펙트가 2.8% 뿐이라 너무 안 터진다).
//    보상은 잡은 보스 수에 따라 ×(1 + DG_BOSS_BONUS × k) — 깊이 갈수록 한 번이 크다.
//  - 체력은 저절로 차지 않지만(물약도 못 쓴다) 보스를 잡으면 DG_HEAL 만큼 찬다. 쓰러져도 모은 자원은 모두 가져간다. 언제든 나갈 수 있다.
//  - 난이도는 내 전투력 기준이다: dgLimitStage = 지금 능력치로 보스를 겨우 잡는 스테이지. 첫 보스는 거기서 DG_OFF0 만큼 아래, 한 마리마다 +DG_STEP.
//    보스 하나마다 기대 피해가 ×1.46 (스테이지당 ×1.10 이 4칸, 0.21.0 성장 압축 전엔 스테이지당 ×1.44 · 1칸) 이라 누구나 8~9 마리쯤에서 쓰러진다 (시뮬: 중앙 9, 10%~90% 가 8~9). 성장하면 같은 '보스 9' 가 더 센 놈이고 보상도 커진다.
//  - 재화 1칸 값(dgUnitValue): 한 판 기대 칸(DG_RUN_UNITS)이 목재·철광석은 내 건물 다음 레벨 비용 평균의 DG_RUN_SHARE 배가 되게 (마력석은 스테이지 기준, 0.23.2) —
//    재화 여섯에 나뉘어 한 판에 목재·철광석이 다음 레벨의 약 60%, 하루 입장권 3장이면 약 1.8 레벨어치. 골드는 나누기 전 사냥 60분치(한 판 실제 몫은 사냥 약 10분치).
//    0.22.3 에 전부 ×2, 강화석은 ×3 (사용자 "수급량이 너무 작아" — 그 전엔 재화당 다음 레벨의 25%, 강화석 한 판 9~23개).
//    0.28.6 에 💎💠 를 빼서 그림 비중 합이 55 → 38: 💰🪵🪨 의 한 판 몫은 저절로 ×1.45, 📖 비전서만 DG_TOMES_KEEP 로 한 판 몫을 그대로 둔다 (숙련도 속도 유지).
//  - 입장권: 하루 DG_TICKETS 장 무료. 더 필요하면 골드로 산다 (dgTicketPrice, 탑과 같은 곡선 · 기준값 DG_TICKET_GOLD)

const DG_UNLOCK_STAGE = 15;
const DG_TICKETS = 3;
const DG_OFF0 = -38;                // 첫 보스 = 한계 스테이지 − 38 (압축 전 −10 과 같은 세기 차이)
const DG_STEP = 4;                  // 보스마다 스테이지 +4
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
  tomes:  { name: '비전서', icon: '📖', w: 7 },
};
const DG_RES_IDS = Object.keys(DG_RES);

const freshDungeon = () => ({ tixDay: '', tixUsed: 0, tixExtra: 0, buyDay: '', bought: 0, best: 0, perfects: 0, run: null, last: null });

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
// 오늘 남은 무료 입장권
function dgFreeTickets() {
  if (newDay(S.dg.tixDay)) { S.dg.tixDay = todayKey(); S.dg.tixUsed = 0; }
  return Math.max(0, DG_TICKETS - S.dg.tixUsed);
}
// 지금 쓸 수 있는 입장권 (무료 + 산 것)
const dgTickets = () => dgFreeTickets() + (S.dg.tixExtra || 0);
// 무료 입장권부터 쓴다
const useDgTicket = () => { if (dgFreeTickets() > 0) S.dg.tixUsed++; else S.dg.tixExtra = Math.max(0, (S.dg.tixExtra || 0) - 1); };
// 구매: 오늘 n번째 구매는 subTicketMult(n) 배 (data.js, 탑과 같은 곡선, 구매 수는 따로)
const dgTicketsBoughtToday = () => (newDay(S.dg.buyDay) ? 0 : (S.dg.bought || 0));
function dgTicketPrice() {
  return { gold: Math.max(1, Math.floor(monsterStats(priceBest(), false).gold * DG_TICKET_GOLD * subTicketMult(dgTicketsBoughtToday()))) };
}
function dgTicketBlocker() {
  if (!dgUnlocked()) return `스테이지 ${DG_UNLOCK_STAGE} 도달 시 열려요`;
  if (!srvClock.known) return '서버 시각 확인 중';
  if ((S.dg.tixExtra || 0) >= SUB_TICKET_HOLD) return `산 입장권은 ${SUB_TICKET_HOLD}장까지 가질 수 있어요`;
  if (S.gold < dgTicketPrice().gold) return '골드 부족';
  return '';
}
function buyDgTicket() {
  if (dgTicketBlocker()) return false;
  S.gold -= dgTicketPrice().gold;
  if (newDay(S.dg.buyDay)) { S.dg.buyDay = todayKey(); S.dg.bought = 0; }
  S.dg.bought = (S.dg.bought || 0) + 1;
  S.dg.tixExtra = (S.dg.tixExtra || 0) + 1;
  return true;
}

// ── 전투력 기준 스테이지 ──
// 던전 보스: 같은 스테이지 몹보다 체력 ×14 · 공격력 ×2.6
function dgMob(stage, kind) {
  const n = monsterStats(stage, false);
  if (kind === 'boss') return { hp: 14 * mobHpScale(stage) * 14, atk: 3 * mobAtkScale(stage) * 2.6, gold: 0, exp: n.exp * 12, boss: true };
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
const DG_RUN_SHARE = 3;
const DG_TOMES_KEEP = 38 / 55;      // 📖 1칸 값 보정: 그림이 6종(비중 합 55)일 때와 한 판 몫이 같게 (0.28.6)
function dgNextBuildCost(k) {
  const ids = Object.keys(BUILDINGS).filter((id) => id !== 'hall');   // 기사단 회관은 보상 기준에 넣지 않는다
  const sum = ids.reduce((a, id) => a + buildCost(id, Math.min(S.bld[id], bldMax(id) - 1))[k], 0);
  return sum / ids.length;
}
function dgUnitValue(r, best = S.best) {
  switch (r) {
    case 'gold': return monsterStats(best, false).gold * 600 / DG_RUN_UNITS;   // 나누기 전 사냥 60분치 → 한 판 몫은 약 10분치
    case 'wood': return Math.max(1, dgNextBuildCost('wood') * DG_RUN_SHARE / DG_RUN_UNITS);
    case 'ore': return Math.max(1, dgNextBuildCost('ore') * DG_RUN_SHARE / DG_RUN_UNITS);
    case 'tomes': return (16 + best / 4) * DG_TOMES_KEEP / DG_RUN_UNITS;
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
  if (!srvClock.known) return '서버 시각 확인 중';   // 날짜를 모르는 채 어제 입장권을 쓰면 확인된 뒤 다시 채워진다
  if (dgTickets() <= 0) return '입장권이 없어요 (자정에 충전 · 구매 가능)';
  return '';
}
function startDungeon() {
  if (dgBlocker()) return false;
  useDgTicket();
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
  S.gold += got.gold; S.mats.wood += got.wood; S.mats.ore += got.ore; S.tomes += got.tomes;
  S.mats.mana += Math.floor(run.bag.mana || 0); S.stones += Math.floor(run.bag.stones || 0);   // 0.28.6 전에 시작한 판의 배낭에 남은 💎·💠
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
