'use strict';
// 재료의 미궁 규칙. core.js 처럼 DOM 을 모르고 S 상태만 바꾼다. 하단바 연출(걷기·전투·덩어리 까기·보스 자루)은 world.js 의 updateDungeon, 카드 고르는 화면은 ui.js.
//  S.dg = {
//    tixDay, tixUsed: 오늘 쓴 입장권 수 (하루 DG_TICKETS 장),
//    clr: { easy, normal, hard, hell } 난이도별 완주(보스 3마리) 횟수 — 완주한 난이도 다음 난이도가 열린다,
//    pol: { diff 고른 난이도, fast 카드를 바로 자동으로 고름 },
//    run: 진행 중인 도전 | null,
//    last: 마지막 결과 { reason, diff, sec, bosses, rooms, got, kills, chunks, cards, dur, at, first, seen } | null,
//  }
//  run = { diff, stage0 첫 구간 스테이지, sec 구간(0~2), ri 구간에서 지난 방 수, uv 재화 1칸 값, bag 배낭,
//          cards 고른 카드 id 목록, fx 이번 판 지속 효과 { def, up, magnet, mend, allin, map }, next 다음 방·보스 한정 효과 { vein, sack, hand, bossHp },
//          pending 아직 안 깐 덩어리 목록 (깨지는 순간 배낭에 들어간다), sack 보스 자루 | null,
//          room 지금 방 { res, vein } | { id: 'boss' }, fight 싸울 몬스터 목록 | null, prompt 고를 것 | null, inFight,
//          kills, rooms, bosses, chunks 주운 덩어리 수 { s, m, l, xl }, t0 }
// 규칙
//  - 고를 것 없이 쭉 밀고 나간다: 구간 3개 × (방 4개 → 보스). 방마다 몬스터 3마리, 방에는 재화 테마(숲길=목재, 갱도=철광석…)가 있다.
//  - 몬스터를 잡을 때마다 돌덩이가 떨어지고, 깨지면 그 방 재화의 덩어리(소·중·대·특대)가 나온다. 크기는 깨질 때 공개된다.
//  - 보스는 자루(DG_SACK)를 메고 있다: 체력 10% 깎일 때마다 하나씩 튀어나오고, DG_SACK_LEAK_AT 초 뒤부터 DG_SACK_LEAK_EVERY 초마다 하나씩 삼킨다
//    (빨리 잡을수록 많이). 처치하면 특대 확정.
//  - 체력은 방에서 방으로 이어지고 저절로 차지 않는다 (물약도 못 쓴다). 쓰러져도 모은 자원은 모두 가져간다 — 잃는 건 도박·보물 지도뿐.
//  - 보스를 잡으면 카드 3장 중 1장 (DG_CARDS, 일반 70%·희귀 25%·전설 5%). 회복 카드는 보장하지 않는다 — 안 뜨면 그게 긴장이다.
//    마지막 보스 뒤엔 즉시 효과(증폭·도박·행운)만.
//  - 난이도는 내 전투력 기준이다: dgLimitStage = 지금 능력치로 보스를 겨우 잡는 스테이지, 거기서 DG_DIFFS.off 만큼 뺀 스테이지에서 싸운다.
//    스테이지 3 차이로 '무피해 → 전멸' 이 갈려서, 고정 스테이지로 두면 대부분의 단계가 너무 쉽거나 불가능해진다.
//    보스는 같은 스테이지 몹보다 훨씬 세게(체력 ×14·공격력 ×2.6 기준) 둬서 구간 끝 보스가 체력의 20~45% 를 깎는다.
//  - 재화 1칸 값(dgUnitValue): 카드 없이 완주하면(DG_RUN_UNITS 칸) 목재·철광석·마력석은 내 건물 다음 레벨 비용의 약 60%,
//    골드는 사냥 30분치, 강화석·비전서는 보조 수급 정도. 재화 여섯에 나뉘고 카드가 ×1.5~2 를 얹어서 한 판에 재화당 다음 레벨의 25% 쯤.

const DG_UNLOCK_STAGE = 15;
const DG_TICKETS = 3;
const DG_SECTIONS = 3;
const DG_ROOMS = 4;                 // 구간마다 보스 전에 지나는 방 수
const DG_ROOM_MOBS = 3;             // 방마다 몬스터 수
const DG_PICK_SEC = 8;              // 카드를 고르지 않으면 이 시간 뒤 자동으로
const DG_AMP_MULT = 1.5;
const DG_GAMBLE_MULT = 3;
const DG_GAMBLE_WIN = 0.5;
const DG_DEF_RED = 0.3;             // 🛡️ 한 번에 받는 피해 −30% (곱해서 쌓임)
const DG_UP_CHANCE = 0.4;           // ⛏️ 한 장에 덩어리가 한 단계 커질 확률 +40%
const DG_MAP_WIN = 1.5, DG_MAP_LOSE = 0.5;
const DG_REWIND_BOSS = 0.6;         // ⏪ 다음 보스 체력 ×0.6
const DG_LUCKY = [1.2, 2];
const DG_MOB_CD = 1.4;              // 승률 계산용 몬스터 공격 간격 (MONSTERS[].atkCd 기본값)
// 보스 자루: 들어 있는 덩어리 (큰 자루는 두 배), 삼키기 시작하는 시각과 간격
const DG_SACK = ['s', 's', 's', 's', 's', 'm', 'm', 'm', 'l', 'l'];
const DG_SACK_LEAK_AT = 6, DG_SACK_LEAK_EVERY = 1.5;

const DG_DIFFS = [
  { id: 'easy',   name: '쉬움',   off: -9, mult: 1 },
  { id: 'normal', name: '보통',   off: -7, mult: 1.4 },
  { id: 'hard',   name: '어려움', off: -6, mult: 1.7 },
  { id: 'hell',   name: '지옥',   off: -5, mult: 2.2 },
];
// 재화 — room: 이 재화가 나오는 방 이름, w: 방 테마 가중치
const DG_RES = {
  gold:   { name: '골드',   icon: '💰', room: '금광',        w: 9 },
  wood:   { name: '목재',   icon: '🪵', room: '숲길',        w: 11 },
  ore:    { name: '철광석', icon: '🪨', room: '갱도',        w: 11 },
  mana:   { name: '마력석', icon: '💎', room: '수정굴',      w: 9 },
  stones: { name: '강화석', icon: '💠', room: '정동석 동굴', w: 8 },
  tomes:  { name: '비전서', icon: '📖', room: '고대 서고',   w: 7 },
};
const DG_RES_IDS = Object.keys(DG_RES);
// 덩어리 — units: 재화 칸 수, w: 몬스터가 떨어뜨릴 가중치
const DG_CHUNKS = [
  { id: 's',  name: '소',   units: 1,  w: 60 },
  { id: 'm',  name: '중',   units: 3,  w: 27 },
  { id: 'l',  name: '대',   units: 8,  w: 10 },
  { id: 'xl', name: '특대', units: 20, w: 3 },
];
const DG_CHUNK_BY = Object.fromEntries(DG_CHUNKS.map((c) => [c.id, c]));
const DG_CHUNK_IDX = Object.fromEntries(DG_CHUNKS.map((c, i) => [c.id, i]));
// 보스 카드 — rar: 0 일반 · 1 희귀 · 2 전설. final: 마지막 보스 뒤에 나옴, finalOnly: 마지막에만, risk: 잃을 수 있음(자동 선택이 피함)
const DG_CARDS = {
  amp:    { rar: 0, icon: '💰', name: '자원 증폭',   desc: `배낭 ×${DG_AMP_MULT}`, final: true },
  heal:   { rar: 0, icon: '❤️', name: '체력 회복',   desc: '체력을 모두 회복', lifesaver: true },
  def:    { rar: 0, icon: '🛡️', name: '단단한 가죽', desc: `받는 피해 −${Math.round(DG_DEF_RED * 100)}% (이번 판 · 겹침)` },
  pick:   { rar: 0, icon: '⛏️', name: '큰 곡괭이',   desc: `덩어리가 한 단계 커질 확률 +${Math.round(DG_UP_CHANCE * 100)}% (이번 판 · 겹침)` },
  vein:   { rar: 1, icon: '🌟', name: '특대 광맥',   desc: '다음 방 덩어리가 전부 특대' },
  sack:   { rar: 1, icon: '🎒', name: '큰 자루',     desc: `다음 보스 자루 ${DG_SACK.length * 2}개 · 삼키지 않음` },
  hand:   { rar: 1, icon: '👑', name: '황금 손',     desc: '다음 보스가 특대 3개' },
  magnet: { rar: 1, icon: '🧲', name: '자석',        desc: '모든 몬스터가 덩어리 하나 더 (이번 판)' },
  mend:   { rar: 1, icon: '💚', name: '전장의 숨결', desc: '방을 깰 때마다 체력 8% 회복 (이번 판)', lifesaver: true },
  gamble: { rar: 2, icon: '🎲', name: '도박',        desc: `${Math.round(DG_GAMBLE_WIN * 100)}% 배낭 ×${DG_GAMBLE_MULT} · 아니면 전부 잃음`, final: true, risk: true },
  allin:  { rar: 2, icon: '🔥', name: '올인',        desc: '덩어리 ×2 · 받는 피해 +50% (이번 판)', risk: true },
  map:    { rar: 2, icon: '🗺️', name: '보물 지도',   desc: `완주하면 배낭 ×${DG_MAP_WIN} · 못 하면 절반`, risk: true },
  rewind: { rar: 2, icon: '⏪', name: '시간 역행',   desc: `체력 전부 회복 · 다음 보스 체력 −${Math.round((1 - DG_REWIND_BOSS) * 100)}%`, lifesaver: true },
  lucky:  { rar: 1, icon: '🍀', name: '행운',        desc: `배낭 ×${DG_LUCKY[0]} ~ ×${DG_LUCKY[1]} (랜덤)`, final: true, finalOnly: true },
};
const DG_CARD_IDS = Object.keys(DG_CARDS);
const DG_RAR = [{ name: '일반', w: 70 }, { name: '희귀', w: 25 }, { name: '전설', w: 5 }];

const freshDungeon = () => ({
  tixDay: '', tixUsed: 0, clr: { easy: 0, normal: 0, hard: 0, hell: 0 },
  pol: { diff: 0, fast: false }, run: null, last: null,
});

const dgUnlocked = () => S.best >= DG_UNLOCK_STAGE;
const dgRand = (a, b) => a + Math.random() * (b - a);
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

// ── 전투력 기준 스테이지 ──
// 던전 몬스터. kind: normal(원정과 같은 몬스터) · boss
function dgMob(stage, kind) {
  const n = monsterStats(stage, false);
  if (kind === 'boss') return { hp: 14 * Math.pow(1.23, stage - 1) * 14, atk: 3 * Math.pow(1.17, stage - 1) * 2.6, gold: 0, exp: n.exp * 12, boss: true };
  return { ...n, gold: 0 };
}
// 지금 능력치로 보스와 싸우면 잃는 체력(최대 체력 비율)의 기대값. fx: 카드 효과 (dgFx)
function dgBossLoss(stage, st = stats(true), fx = null) {
  const b = dgMob(stage, 'boss');
  const taken = fx ? Math.max(0.2, 1 + fx.taken) : 1;
  return (b.hp / dpsOf(st)) * (b.atk / DG_MOB_CD) * (1 - st.guard) * taken / st.maxHp;
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
// 카드 없이 완주하면 줍는 덩어리 칸 수의 기대값: 방 몬스터 (DG_SECTIONS×DG_ROOMS×DG_ROOM_MOBS 마리 × 평균 덩어리) + 보스 (자루 전부 + 특대)
const DG_CHUNK_AVG = DG_CHUNKS.reduce((a, c) => a + c.units * c.w, 0) / DG_CHUNKS.reduce((a, c) => a + c.w, 0);
const DG_SACK_UNITS = DG_SACK.reduce((a, id) => a + DG_CHUNK_BY[id].units, 0);
const DG_RUN_UNITS = DG_SECTIONS * DG_ROOMS * DG_ROOM_MOBS * DG_CHUNK_AVG + DG_SECTIONS * (DG_SACK_UNITS + DG_CHUNK_BY.xl.units);
// 목재·철광석·마력석은 내 건물 레벨 기준: 건물 4개의 다음 레벨 비용 평균 × DG_BLD_SHARE 를 카드 없는 완주(DG_RUN_UNITS 칸)에 나눠 준다
//  (스테이지와 건물 레벨은 따로 논다 — 스테이지 130 에 건물 Lv7~8 인 기사도 있다). 건물을 올릴수록 함께 늘어서 어느 구간에서든 체감이 같다
//  골드·강화석·비전서는 최고 스테이지 기준 (골드는 사냥 30분치, 강화석·비전서는 보조 수급)
const DG_BLD_SHARE = 0.6;
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

// ── 카드 효과 (stats() 가 곱하는 던전 배율, core.js) ──
function dgFx(run = S.dg.run) {
  const fx = { atk: 0, taken: 0 };
  if (!run || !run.fx) return fx;
  fx.taken = Math.pow(1 - DG_DEF_RED, run.fx.def || 0) * (run.fx.allin ? 1.5 : 1) - 1;
  return fx;
}
const dgActive = () => S.phase === 'dungeon' && !!S.dg.run;

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
    cards: [], fx: { def: 0, up: 0, magnet: 0, mend: 0, allin: 0, map: 0 }, next: { vein: 0, sack: 0, hand: 0, bossHp: 1 },
    pending: [], sack: null, room: null, fight: null, prompt: null, inFight: false,
    kills: 0, rooms: 0, bosses: 0, chunks: { s: 0, m: 0, l: 0, xl: 0 }, t0: Date.now(),
  };
  S.phase = 'dungeon';
  S.hp = stats().maxHp;
  dgRoomStart();
  return true;
}
// reason: clear 완주 · down 쓰러짐 · retreat 나가기 · offline 앱을 꺼서 — 어떻게 끝나든 배낭은 전부 가져간다 (보물 지도만 완주 여부로 갈린다)
function endDungeon(reason) {
  const run = S.dg.run;
  if (!run) return null;
  dgFlushPending(run);
  let mapMult = 1;
  if (run.fx && run.fx.map && reason !== 'offline') mapMult = reason === 'clear' ? DG_MAP_WIN : DG_MAP_LOSE;
  const got = {};
  for (const r of DG_RES_IDS) got[r] = Math.floor((run.bag[r] || 0) * mapMult);
  S.gold += got.gold; S.mats.wood += got.wood; S.mats.ore += got.ore; S.mats.mana += got.mana; S.stones += got.stones; S.tomes += got.tomes;
  const d = DG_DIFFS[run.diff], first = reason === 'clear' && !S.dg.clr[d.id];
  if (reason === 'clear') S.dg.clr[d.id]++;
  const at = Date.now();
  S.dg.last = {
    reason, diff: run.diff, sec: run.sec, bosses: run.bosses || 0, rooms: run.rooms, got, kills: run.kills, mapMult,
    chunks: run.chunks || { s: 0, m: 0, l: 0, xl: 0 }, cards: (run.cards || []).slice(),
    dur: reason === 'offline' ? 0 : (at - run.t0) / 1000, at, first, seen: false,
  };
  S.dg.run = null;          // phase 는 부른 쪽이 캠프로 돌린다 (하단바는 귀환 연출이 끝난 뒤, 오프라인은 바로)
  return S.dg.last;
}

// ── 덩어리 ──
// 크기 뽑기: 가중치대로, ⛏️ 곡괭이만큼 한 단계 올라갈 확률
function dgRollSize(run = S.dg.run) {
  let i = DG_CHUNK_IDX[dgPickW(DG_CHUNKS, (c) => c.w).id];
  if (run.fx.up && Math.random() < Math.min(1, run.fx.up)) i = Math.min(DG_CHUNKS.length - 1, i + 1);
  return DG_CHUNKS[i];
}
// 덩어리 하나를 만든다 — 양은 지금 정해지지만 배낭엔 깨질 때(dgApplyChunk) 들어간다. { res, size, amt, applied }
function dgMakeChunk(res, size, run = S.dg.run) {
  const amt = Math.max(1, dgRound(size.units * run.uv[res] * DG_DIFFS[run.diff].mult * (run.fx.allin ? 2 : 1)));
  const c = { res, size: size.id, amt, applied: false };
  run.pending.push(c);
  return c;
}
function dgApplyChunk(c, run = S.dg.run) {
  if (!run || c.applied) return;
  c.applied = true;
  run.bag[c.res] += c.amt;
  run.chunks[c.size]++;
  run.pending = run.pending.filter((x) => x !== c);
}
function dgFlushPending(run) {
  for (const c of (run.pending || []).slice()) dgApplyChunk(c, run);
}
const dgBagUnits = (run) => DG_RES_IDS.reduce((a, r) => a + run.bag[r] / run.uv[r], 0);
const dgRandRes = () => dgPickW(DG_RES_IDS, (r) => DG_RES[r].w);

// ── 방 / 보스 ──
// 다음 방: 재화 테마를 정하고(바로 앞 방과 다른 것) 몬스터 3마리를 세운다. 🌟 특대 광맥이 걸려 있으면 이 방은 전부 특대
function dgRoomStart() {
  const run = S.dg.run, prev = run.room && run.room.res;
  const res = dgPickW(DG_RES_IDS.filter((r) => r !== prev), (r) => DG_RES[r].w);
  const st = run.stage0 + run.sec;
  run.room = { res, vein: run.next.vein ? 1 : 0 };
  run.next.vein = 0;
  run.rooms++;
  run.fight = { kind: 'normal', mobs: Array.from({ length: DG_ROOM_MOBS }, () => dgMob(st, 'normal')), stage: st };
  run.inFight = true;
  run.prompt = null;
}
function dgBossFight() {
  const run = S.dg.run, st = run.stage0 + run.sec;
  const b = dgMob(st, 'boss');
  b.hp *= run.next.bossHp;
  run.room = { id: 'boss', hand: run.next.hand ? 3 : 1 };
  run.fight = { kind: 'boss', mobs: [b], stage: st };
  const items = run.next.sack ? DG_SACK.concat(DG_SACK) : DG_SACK.slice();
  run.sack = { items, total: items.length, spilled: 0, lost: 0, noLeak: !!run.next.sack, t: 0, leakT: 0 };
  run.next = { vein: run.next.vein, sack: 0, hand: 0, bossHp: 1 };
  run.inFight = true;
  run.prompt = null;
}
const dgRoomName = (room) => room && room.id === 'boss' ? '보스' : room ? DG_RES[room.res].room : '';
const dgLastSec = (run = S.dg.run) => run.sec >= DG_SECTIONS - 1;

// 보스를 때릴 때: 깎인 비율(0~1)만큼 자루에서 덩어리가 튀어나온다. 튀어나온 덩어리 목록을 돌려준다
function dgBossHit(lostFrac) {
  const run = S.dg.run, sk = run && run.sack;
  if (!sk) return [];
  const want = Math.min(sk.total, Math.floor(lostFrac * sk.total + 1e-6));
  const out = [];
  while (sk.spilled < want && sk.items.length) {
    const id = sk.items.splice(Math.floor(Math.random() * sk.items.length), 1)[0];
    sk.spilled++;
    out.push(dgMakeChunk(dgRandRes(), DG_CHUNK_BY[id]));
  }
  return out;
}
// 보스전이 길어지면 자루를 삼킨다. 이번에 삼킨 개수를 돌려준다
function dgSackLeak(dt) {
  const run = S.dg.run, sk = run && run.sack;
  if (!sk || sk.noLeak) return 0;
  sk.t += dt;
  if (sk.t < DG_SACK_LEAK_AT) return 0;
  sk.leakT += dt;
  let n = 0;
  while (sk.leakT >= DG_SACK_LEAK_EVERY && sk.items.length) {
    sk.leakT -= DG_SACK_LEAK_EVERY;
    sk.items.splice(Math.floor(Math.random() * sk.items.length), 1);
    sk.lost++; n++;
  }
  return n;
}

// 던전 몬스터 처치: 경험치 + 덩어리. 떨어진 덩어리 목록을 돌려준다 (화면에서 돌덩이로 띄우고, 깨질 때 dgApplyChunk)
function dgKill(m) {
  const run = S.dg.run;
  if (!run) return [];
  run.kills++;
  if (m.exp) gainExp(m.exp * expMult());
  const out = [];
  if (m.boss) {
    for (let i = 0; i < (run.room.hand || 1); i++) out.push(dgMakeChunk(dgRandRes(), DG_CHUNK_BY.xl));
    return out;
  }
  out.push(dgMakeChunk(run.room.res, run.room.vein ? DG_CHUNK_BY.xl : dgRollSize()));
  if (run.fx.magnet) out.push(dgMakeChunk(run.room.res, dgRollSize()));
  return out;
}

// 싸움이 끝난 방 정산. 화면에 띄울 결과를 돌려준다 (없으면 null)
function dgRoomCleared() {
  const run = S.dg.run;
  run.fight = null; run.inFight = false;
  if (run.room.id === 'boss') return dgBossCleared();
  let out = null;
  if (run.fx.mend) { const max = stats().maxHp; S.hp = Math.min(max, S.hp + max * 0.08); out = { text: '💚 +8%', small: true }; }
  run.ri++;
  if (run.ri >= DG_ROOMS) dgBossFight();
  else dgRoomStart();
  return out;
}
function dgBossCleared() {
  const run = S.dg.run;
  run.bosses++;
  run.sack = null;
  const final = dgLastSec(run);
  run.prompt = { kind: 'card', final, opts: dgCardChoices(final).map((id) => ({ id })), left: DG_PICK_SEC };
  return { text: '👑 보스 처치!', sub: final ? '마지막 카드를 고르세요' : '카드 한 장을 고르세요', big: true };
}

// ── 카드 ──
// 3장: 등급을 먼저 뽑고(일반 70·희귀 25·전설 5) 그 등급에서 하나. 서로 다른 카드. 마지막 보스 뒤엔 즉시 효과 카드만
function dgCardChoices(final) {
  const ids = DG_CARD_IDS.filter((id) => (final ? DG_CARDS[id].final : !DG_CARDS[id].finalOnly));
  if (final) return ids;
  const out = [];
  for (let guard = 0; out.length < 3 && guard < 80; guard++) {
    const rar = dgPickW([0, 1, 2], (i) => DG_RAR[i].w);
    const pool = ids.filter((id) => DG_CARDS[id].rar === rar && !out.includes(id));
    if (!pool.length) continue;
    out.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return out;
}
// 지금 프롬프트에서 i 번 카드를 고른다. 화면에 띄울 결과 { text, sub, bad, big, end } 를 돌려준다 (없으면 null)
function dgChoose(i) {
  const run = S.dg.run;
  if (!run || !run.prompt) return null;
  const p = run.prompt, o = p.opts[i];
  if (!o) return null;
  run.prompt = null;
  dgFlushPending(run);                 // 아직 안 깨진 돌(보스의 특대 등)도 지금 배낭에 넣고 나서 카드를 적용한다 — 증폭·도박이 그것까지 다룬다
  const c = DG_CARDS[o.id];
  run.cards.push(o.id);
  let out = { text: `${c.icon} ${c.name}`, sub: c.desc };
  const max = stats().maxHp;
  switch (o.id) {
    case 'amp':
      for (const r of DG_RES_IDS) run.bag[r] = Math.floor(run.bag[r] * DG_AMP_MULT);
      out = { text: '💰 자원 증폭!', sub: `배낭 ×${DG_AMP_MULT}`, big: true };
      break;
    case 'heal': out.sub = `+${Math.round(100 * (max - S.hp) / max)}%`; S.hp = max; break;
    case 'def': run.fx.def++; out.sub = `받는 피해 −${Math.round(100 * (1 - Math.pow(1 - DG_DEF_RED, run.fx.def)))}%`; break;
    case 'pick': run.fx.up += DG_UP_CHANCE; out.sub = `한 단계 커질 확률 ${Math.round(100 * Math.min(1, run.fx.up))}%`; break;
    case 'vein': run.next.vein = 1; break;
    case 'sack': run.next.sack = 1; break;
    case 'hand': run.next.hand = 1; break;
    case 'magnet': run.fx.magnet = 1; break;
    case 'mend': run.fx.mend = 1; break;
    case 'allin': run.fx.allin = 1; break;
    case 'map': run.fx.map = 1; break;
    case 'rewind': S.hp = max; run.next.bossHp = DG_REWIND_BOSS; break;
    case 'gamble': {
      const win = Math.random() < DG_GAMBLE_WIN;
      for (const r of DG_RES_IDS) run.bag[r] = win ? Math.floor(run.bag[r] * DG_GAMBLE_MULT) : 0;
      out = win ? { text: '🎲 대박!', sub: `배낭 ×${DG_GAMBLE_MULT}`, big: true } : { text: '🎲 꽝…', sub: '배낭을 전부 잃었어요', bad: true, big: true };
      break;
    }
    case 'lucky': {
      const k = Math.round(dgRand(DG_LUCKY[0], DG_LUCKY[1]) * 10) / 10;
      for (const r of DG_RES_IDS) run.bag[r] = Math.floor(run.bag[r] * k);
      out = { text: `🍀 행운 ×${k}`, sub: `배낭 ×${k}`, big: k >= 1.7 };
      break;
    }
  }
  if (p.final) { endDungeon('clear'); out.end = true; return out; }
  run.sec++; run.ri = 0;
  dgRoomStart();
  return out;
}

// 고르지 않았을 때 (또는 '바로 자동 선택') 고를 카드 번호: 체력이 반 아래면 회복 계열, 아니면 잃을 수 있는 카드(도박·올인·지도)를 뺀 첫 장.
// 마지막엔 증폭 → 행운 순
function dgAutoPick() {
  const run = S.dg.run, p = run && run.prompt;
  if (!p) return -1;
  const hp = Math.max(0, S.hp) / stats().maxHp;
  const idx = (f) => p.opts.findIndex((o) => f(DG_CARDS[o.id], o.id));
  if (p.final) { const a = idx((c, id) => id === 'amp'); if (a >= 0) return a; const l = idx((c, id) => id === 'lucky'); return l >= 0 ? l : 0; }
  if (hp < 0.5) { const h = idx((c) => c.lifesaver); if (h >= 0) return h; }
  const safe = idx((c) => !c.risk);
  return safe >= 0 ? safe : 0;
}
const dgAuto = () => dgChoose(dgAutoPick());
