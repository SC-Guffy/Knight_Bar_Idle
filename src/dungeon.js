'use strict';
// 재료의 미궁 규칙. core.js 처럼 DOM 을 모르고 S 상태만 바꾼다. 하단바 연출(걷기·전투·덩어리)은 world.js 의 updateDungeon, 보상 고르기 화면은 ui.js.
//  S.dg = {
//    tixDay, tixUsed: 오늘 쓴 입장권 수 (하루 DG_TICKETS 장),
//    clr: { easy, normal, hard, hell } 난이도별 완주(보스 3마리) 횟수 — 완주한 난이도 다음 난이도가 열린다,
//    pol: { diff 고른 난이도, fast 보상을 바로 자동으로 고름 },
//    run: 진행 중인 도전 | null,
//    last: 마지막 결과 { reason, diff, sec, bosses, rooms, got, kills, chunks, boons, dur, at, first, seen } | null,
//  }
//  run = { diff, stage0 첫 구간 스테이지, sec 구간(0~2), ri 구간에서 지난 방 수, uv 재화 1칸 값, bag 배낭,
//          boons { amp, heal, def, gamble } 고른 보상 횟수, taken 받는 피해 배율 보정(음수), room 지금 방 { res } | { id: 'boss' },
//          fight 싸울 몬스터 목록 | null, prompt 고를 것 | null, inFight, kills, rooms, bosses, chunks 주운 덩어리 수 { s, m, l, xl }, t0 }
// 규칙
//  - 고를 것 없이 쭉 밀고 나간다: 구간 3개 × (방 4개 → 보스). 방마다 몬스터 3마리, 방에는 재화 테마(숲길=목재, 갱도=철광석…)가 있다.
//  - 몬스터를 잡을 때마다 그 방 재화의 덩어리(소·중·대·특대)를 줍는다. 보스는 특대 덩어리를 확정으로 떨어뜨린다.
//  - 체력은 방에서 방으로 이어지고 저절로 차지 않는다 (물약도 못 쓴다). 쓰러져도 모은 자원은 모두 가져간다 — 잃는 건 '도박'뿐.
//  - 보스를 잡으면 보상 하나: 💰 자원 증폭(배낭 ×1.5) · ❤️ 체력 회복 · 🛡️ 방어력 증가 · 🎲 도박(배낭 ×3 or 전부 잃음). 마지막 보스 뒤엔 증폭·도박만.
//  - 난이도는 내 전투력 기준이다: dgLimitStage = 지금 능력치로 보스를 겨우 잡는 스테이지, 거기서 DG_DIFFS.off 만큼 뺀 스테이지에서 싸운다.
//    스테이지 3 차이로 '무피해 → 전멸' 이 갈려서, 고정 스테이지로 두면 대부분의 단계가 너무 쉽거나 불가능해진다.
//    보스는 같은 스테이지 몹보다 훨씬 세게(체력 ×14·공격력 ×2.6 기준) 둬서 구간 끝 보스가 체력의 20~45% 를 깎는다 → 회복·방어 보상이 진짜 고민이 된다.
//  - 재화 1칸 값(dgUnitValue): 보통 난이도를 보상 없이 완주하면(DG_RUN_UNITS 칸) 목재·철광석·마력석은 내 건물 다음 레벨 비용의 약 60%,
//    골드는 사냥 30분치, 강화석·비전서는 보조 수급 정도. 증폭을 고르면 그 위에 ×1.5 씩.

const DG_UNLOCK_STAGE = 15;
const DG_TICKETS = 3;
const DG_SECTIONS = 3;
const DG_ROOMS = 4;                 // 구간마다 보스 전에 지나는 방 수
const DG_ROOM_MOBS = 3;             // 방마다 몬스터 수
const DG_PICK_SEC = 8;              // 보상을 고르지 않으면 이 시간 뒤 자동으로
const DG_AMP_MULT = 1.5;
const DG_GAMBLE_MULT = 3;
const DG_GAMBLE_WIN = 0.5;
const DG_DEF_RED = 0.3;             // 🛡️ 한 번에 받는 피해 −30% (곱해서 쌓임)
const DG_MOB_CD = 1.4;              // 승률 계산용 몬스터 공격 간격 (MONSTERS[].atkCd 기본값)

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
// 보스 보상. final: 마지막 보스 뒤에도 고를 수 있는 것
const DG_BOONS = {
  amp:    { icon: '💰', name: '자원 증폭', desc: `배낭의 자원 ×${DG_AMP_MULT}`, final: true },
  heal:   { icon: '❤️', name: '체력 회복', desc: '체력을 모두 회복' },
  def:    { icon: '🛡️', name: '방어력 증가', desc: `받는 피해 −${Math.round(DG_DEF_RED * 100)}% (이번 판)` },
  gamble: { icon: '🎲', name: '도박', desc: `${Math.round(DG_GAMBLE_WIN * 100)}% 배낭 ×${DG_GAMBLE_MULT} · 아니면 전부 잃음`, final: true, risk: true },
};
const DG_BOON_IDS = Object.keys(DG_BOONS);

const freshDungeon = () => ({
  tixDay: '', tixUsed: 0, clr: { easy: 0, normal: 0, hard: 0, hell: 0 },
  pol: { diff: 0, fast: false }, run: null, last: null,
});

const dgUnlocked = () => S.best >= DG_UNLOCK_STAGE;
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

// ── 전투력 기준 스테이지 ──
// 던전 몬스터. kind: normal(원정과 같은 몬스터) · boss
function dgMob(stage, kind) {
  const n = monsterStats(stage, false);
  if (kind === 'boss') return { hp: 14 * Math.pow(1.23, stage - 1) * 14, atk: 3 * Math.pow(1.17, stage - 1) * 2.6, gold: 0, exp: n.exp * 12, boss: true };
  return { ...n, gold: 0 };
}
// 지금 능력치로 보스와 싸우면 잃는 체력(최대 체력 비율)의 기대값. fx: 보상 효과 (dgFx)
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
// 보상 없이 완주하면 줍는 덩어리 칸 수의 기대값: 방 몬스터 (DG_SECTIONS×DG_ROOMS×DG_ROOM_MOBS 마리 × 평균 덩어리) + 보스 (특대 확정)
const DG_CHUNK_AVG = DG_CHUNKS.reduce((a, c) => a + c.units * c.w, 0) / DG_CHUNKS.reduce((a, c) => a + c.w, 0);
const DG_RUN_UNITS = DG_SECTIONS * DG_ROOMS * DG_ROOM_MOBS * DG_CHUNK_AVG + DG_SECTIONS * DG_CHUNK_BY.xl.units;
// 목재·철광석·마력석은 내 건물 레벨 기준: 건물 4개의 다음 레벨 비용 평균 × DG_BLD_SHARE 를 보통 난이도 완주(DG_RUN_UNITS 칸)에 나눠 준다
//  → 한 판 완주하면 다음 레벨 비용의 약 60% (하루 입장권 3장을 재화 여섯에 나눠 받으니 늘 살짝 모자라게). 건물을 올릴수록 함께 늘어서 어느 구간에서든 체감이 같다
//    (스테이지와 건물 레벨은 따로 논다 — 스테이지 130 에 건물 Lv7~8 인 기사도 있다)
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

// ── 보상 효과 (stats() 가 곱하는 던전 배율, core.js) ──
function dgFx(run = S.dg.run) {
  const fx = { atk: 0, taken: 0 };
  if (!run) return fx;
  fx.taken = -(1 - Math.pow(1 - DG_DEF_RED, (run.boons && run.boons.def) || 0));
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
    boons: { amp: 0, heal: 0, def: 0, gamble: 0 }, room: null, fight: null, prompt: null, inFight: false,
    kills: 0, rooms: 0, bosses: 0, chunks: { s: 0, m: 0, l: 0, xl: 0 }, t0: Date.now(),
  };
  S.phase = 'dungeon';
  S.hp = stats().maxHp;
  dgRoomStart();
  return true;
}
// reason: clear 완주 · down 쓰러짐 · retreat 나가기 · offline 앱을 꺼서 — 어떻게 끝나든 배낭은 전부 가져간다
function endDungeon(reason) {
  const run = S.dg.run;
  if (!run) return null;
  const got = {};
  for (const r of DG_RES_IDS) got[r] = Math.floor(run.bag[r] || 0);
  S.gold += got.gold; S.mats.wood += got.wood; S.mats.ore += got.ore; S.mats.mana += got.mana; S.stones += got.stones; S.tomes += got.tomes;
  const d = DG_DIFFS[run.diff], first = reason === 'clear' && !S.dg.clr[d.id];
  if (reason === 'clear') S.dg.clr[d.id]++;
  const at = Date.now();
  S.dg.last = {
    reason, diff: run.diff, sec: run.sec, bosses: run.bosses || 0, rooms: run.rooms, got, kills: run.kills,
    chunks: run.chunks || { s: 0, m: 0, l: 0, xl: 0 }, boons: run.boons || {},
    dur: reason === 'offline' ? 0 : (at - run.t0) / 1000, at, first, seen: false,
  };
  S.dg.run = null;          // phase 는 부른 쪽이 캠프로 돌린다 (하단바는 귀환 연출이 끝난 뒤, 오프라인은 바로)
  return S.dg.last;
}

// ── 배낭 ──
// 재화 units 칸을 배낭에 넣는다 (난이도 배율 반영). 넣은 양을 돌려준다
function dgGain(r, units, run = S.dg.run) {
  const amt = Math.max(1, dgRound(units * run.uv[r] * DG_DIFFS[run.diff].mult));
  run.bag[r] += amt;
  return amt;
}
const dgBagUnits = (run) => DG_RES_IDS.reduce((a, r) => a + run.bag[r] / run.uv[r], 0);

// ── 방 / 보스 ──
// 다음 방: 재화 테마를 정하고(바로 앞 방과 다른 것) 몬스터 3마리를 세운다
function dgRoomStart() {
  const run = S.dg.run, prev = run.room && run.room.res;
  const res = dgPickW(DG_RES_IDS.filter((r) => r !== prev), (r) => DG_RES[r].w);
  const st = run.stage0 + run.sec;
  run.room = { res };
  run.rooms++;
  run.fight = { kind: 'normal', mobs: Array.from({ length: DG_ROOM_MOBS }, () => dgMob(st, 'normal')), stage: st };
  run.inFight = true;
  run.prompt = null;
}
function dgBossFight() {
  const run = S.dg.run, st = run.stage0 + run.sec;
  run.room = { id: 'boss' };
  run.fight = { kind: 'boss', mobs: [dgMob(st, 'boss')], stage: st };
  run.inFight = true;
  run.prompt = null;
}
const dgRoomName = (room) => room && room.id === 'boss' ? '보스' : room ? DG_RES[room.res].room : '';
const dgLastSec = (run = S.dg.run) => run.sec >= DG_SECTIONS - 1;

// 던전 몬스터 처치: 경험치 + 덩어리 하나. 주운 덩어리 { res, size, amt } 를 돌려준다 (화면에서 띄운다)
function dgKill(m) {
  const run = S.dg.run;
  if (!run) return null;
  run.kills++;
  if (m.exp) gainExp(m.exp * expMult());
  const size = m.boss ? DG_CHUNK_BY.xl : dgPickW(DG_CHUNKS, (c) => c.w);
  const res = m.boss ? dgPickW(DG_RES_IDS, (r) => DG_RES[r].w) : run.room.res;
  const amt = dgGain(res, size.units);
  run.chunks[size.id]++;
  return { res, size, amt };
}

// 싸움이 끝난 방 정산. 화면에 띄울 결과를 돌려준다 (없으면 null)
function dgRoomCleared() {
  const run = S.dg.run;
  run.fight = null; run.inFight = false;
  if (run.room.id === 'boss') return dgBossCleared();
  run.ri++;
  if (run.ri >= DG_ROOMS) dgBossFight();
  else dgRoomStart();
  return null;
}
function dgBossCleared() {
  const run = S.dg.run;
  run.bosses++;
  const final = dgLastSec(run);
  run.prompt = { kind: 'boon', final, opts: DG_BOON_IDS.filter((id) => !final || DG_BOONS[id].final).map((id) => ({ id })), left: DG_PICK_SEC };
  return { text: '👑 보스 처치!', sub: final ? '마지막 보상을 고르세요' : '보상 하나를 고르세요', big: true };
}

// ── 보상 고르기 ──
// 지금 프롬프트에서 i 번 선택지를 고른다. 화면에 띄울 결과 { text, sub, bad, big, end } 를 돌려준다 (없으면 null)
function dgChoose(i) {
  const run = S.dg.run;
  if (!run || !run.prompt) return null;
  const p = run.prompt, o = p.opts[i];
  if (!o) return null;
  run.prompt = null;
  const b = DG_BOONS[o.id];
  run.boons[o.id]++;
  let out = null;
  switch (o.id) {
    case 'amp':
      for (const r of DG_RES_IDS) run.bag[r] = Math.floor(run.bag[r] * DG_AMP_MULT);
      out = { text: `${b.icon} 자원 증폭!`, sub: `배낭 ×${DG_AMP_MULT}`, big: true };
      break;
    case 'heal': {
      const max = stats().maxHp, heal = max - S.hp;
      S.hp = max;
      out = { text: `${b.icon} 체력 회복`, sub: `+${Math.round(100 * heal / max)}%` };
      break;
    }
    case 'def':
      out = { text: `${b.icon} 방어력 증가`, sub: `받는 피해 −${Math.round(100 * (1 - Math.pow(1 - DG_DEF_RED, run.boons.def)))}%` };
      break;
    case 'gamble': {
      const win = Math.random() < DG_GAMBLE_WIN;
      for (const r of DG_RES_IDS) run.bag[r] = win ? Math.floor(run.bag[r] * DG_GAMBLE_MULT) : 0;
      out = win ? { text: '🎲 대박!', sub: `배낭 ×${DG_GAMBLE_MULT}`, big: true } : { text: '🎲 꽝…', sub: '배낭을 전부 잃었어요', bad: true };
      break;
    }
  }
  if (p.final) { endDungeon('clear'); out.end = true; return out; }
  run.sec++; run.ri = 0;
  dgRoomStart();
  return out;
}

// 고르지 않았을 때 (또는 '바로 자동 선택') 고를 선택지 번호: 체력이 반 아래면 회복, 아직 낮으면 방어, 아니면 증폭. 도박은 알아서 하지 않는다
function dgAutoPick() {
  const run = S.dg.run, p = run && run.prompt;
  if (!p) return -1;
  const hp = Math.max(0, S.hp) / stats().maxHp;
  const idx = (id) => p.opts.findIndex((o) => o.id === id);
  let want = 'amp';
  if (!p.final && hp < 0.5) want = 'heal';
  else if (!p.final && hp < 0.8 && run.boons.def < 2) want = 'def';
  const i = idx(want);
  return i >= 0 ? i : Math.max(0, idx('amp'));
}
const dgAuto = () => dgChoose(dgAutoPick());
