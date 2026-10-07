'use strict';
// 도전의 탑 규칙. core.js 처럼 DOM 을 모르고 S 상태만 바꾼다. 화면 연출(층 오르기·추락)은 world.js 의 updateTower.
//  S.tower = {
//    best: 지금까지 깬 가장 높은 층 (0 = 아직 없음),
//    paid: 첫 돌파 묶음을 받은 가장 높은 10층 단위 (난이도 개편 전 기록을 옮길 때 같은 묶음을 두 번 주지 않게),
//    curve: 층 난이도 곡선 버전 (TOWER_CURVE 와 다르면 best 를 새 곡선으로 옮긴다),
//    tixDay, tixUsed: 오늘(자정 기준) 쓴 무료 입장권 수 — 하루 TOWER_TICKETS 장, 도전 입장이나 소탕에 1장씩,
//    tixExtra: 사서 가진 입장권 (자정에 사라지지 않음, 무료를 다 쓴 뒤에 쓴다, 최대 TOWER_TICKET_HOLD),
//    buyDay, bought: 오늘(buyDay) 산 장수 — 살수록 비싸진다,
//    run: 진행 중인 도전 { start 시작 층, floor 지금 층, cleared 이번에 깬 층 수, kills, gold, exp, tomes, firsts: [첫 돌파 층],
//          t0 시작 시각, lv0 시작 레벨, best0 시작 전 최고 층 } | null,
//    last: 마지막 도전 결과 { start, reached, cleared, kills, gold, exp, tomes, firsts, reason, best, best0, dur, levels, at,
//          seen: false 면 아직 정산 화면을 안 봄 (캠프를 열면 탑 탭에 정산이 뜬다) } | null,
//  }
// 규칙
//  - 원정과 같은 스태미나를 같은 속도(STAMINA_DRAIN)로 쓴다. 스태미나가 바닥나거나 쓰러지거나 후퇴하면 끝.
//  - 시작은 체크포인트(깬 10층 단위 다음 층)부터. 층마다 정예 몬스터 1마리, 10층마다 보스.
//  - 층 난이도는 스테이지 TOWER_STAGE0 + 층 × TOWER_STAGE_PER. 정예는 체력 ×TOWER_ELITE_HP · 공격력 ×TOWER_ELITE_ATK, 보스는 체력 ×TOWER_BOSS_HP · 공격력 ×TOWER_BOSS_ATK.
//  - 한 층에서 TOWER_ENRAGE_SEC 초 넘게 싸우면 몬스터가 광폭화해 공격력이 계속 두 배씩 오른다 (towerRage) → 못 넘는 층은 금방 쓰러져 끝난다.
//  - 보상: 처치 골드·경험치(정예라 원정 몬스터의 3배) + 📖 비전서 — 층을 깰 때마다 1권 (하루 한도 없음 — 입장권으로만 제한)
//          + 10층 단위 첫 돌파 때 묶음(towerFirstTomes). 오프라인 진행은 없다(앱을 껐다 켜면 그 층에서 끝낸 것으로 정산).
//  - 입장권: 하루 TOWER_TICKETS 장. 도전 입장 1장, 또는 소탕 1장(입장·스태미나 없이 최고 층 수만큼 📖, 층 보상 한도와 따로)
//    더 필요하면 골드(+마력석)로 산다 — 하루 안에서 살수록 비싸진다 (towerTicketPrice)

const TOWER_CURVE = 3;   // 1: 스테이지 10 + 층×2 (0.10.0) → 2: 25 + 층×3 (0.10.3) → 3: 25 + 층×2 (후반이 너무 가팔라서 완화)
// 곡선 버전별 층 → 스테이지 (옛 기록을 옮길 때 쓴다)
const TOWER_CURVE_STAGE = { 1: (f) => 10 + f * 2, 2: (f) => 25 + f * 3 };
const freshTower = () => ({ best: 0, paid: 0, curve: TOWER_CURVE, tixDay: '', tixUsed: 0, tixExtra: 0, buyDay: '', bought: 0, run: null, last: null });
// 옛 곡선의 최고 층을 같은 스테이지 급의 새 층으로 옮긴다 (체크포인트가 감당 못 할 높이가 되지 않게)
function migrateTower(t) {
  if (t.curve === TOWER_CURVE) return;
  t.paid = Math.max(t.paid || 0, Math.floor((t.best || 0) / 10) * 10);
  const old = TOWER_CURVE_STAGE[t.curve] || TOWER_CURVE_STAGE[1];
  t.best = Math.max(0, Math.floor((old(t.best || 0) - TOWER_STAGE0) / TOWER_STAGE_PER));
  t.curve = TOWER_CURVE;
}

const towerUnlocked = () => S.best >= TOWER_UNLOCK_STAGE;
const towerCheckpoint = () => Math.floor(S.tower.best / 10) * 10 + 1;
const towerStage = (floor) => TOWER_STAGE0 + Math.round(floor * TOWER_STAGE_PER);
const towerBossFloor = (floor) => floor % 10 === 0;
// 10층 단위 첫 돌파 비전서: 10층 4권, 20층 5권, … (높을수록 조금씩 많이)
const towerFirstTomes = (floor) => 3 + floor / 10;
// 이 층에 나오는 몬스터 { type, boss, hp, atk, gold, exp }
function towerMonster(floor) {
  const stage = towerStage(floor), boss = towerBossFloor(floor);
  const st = monsterStats(stage, boss);
  const pool = monsterPool(stage);
  const type = boss ? zoneOf(stage).boss : pool[Math.floor(Math.random() * pool.length)];
  return boss ? { type, ...st, hp: st.hp * TOWER_BOSS_HP, atk: st.atk * TOWER_BOSS_ATK } : { type, ...st, hp: st.hp * TOWER_ELITE_HP, atk: st.atk * TOWER_ELITE_ATK, gold: st.gold * 3, exp: st.exp * 3 };
}

// 한 층에서 t초 싸웠을 때 몬스터 공격력 배율 (광폭화)
const towerRage = (t) => (t < TOWER_ENRAGE_SEC ? 1 : Math.pow(2, (t - TOWER_ENRAGE_SEC) / TOWER_ENRAGE_DOUBLE));

function towerBlocker() {
  if (!towerUnlocked()) return `스테이지 ${TOWER_UNLOCK_STAGE} 도달 시 열려요`;
  if (S.phase !== 'camp') return '캠프에서만 도전할 수 있어요';
  if (towerTickets() <= 0) return '입장권이 없어요 (자정에 충전 · 구매 가능)';
  if (S.stamina < minDepartStamina()) return `스태미나 ${minDepartStamina()} 이상 필요 (휴식 중)`;
  return '';
}

function startTower() {
  if (towerBlocker()) return false;
  const start = towerCheckpoint();
  useTowerTicket();
  S.tower.run = { start, floor: start, cleared: 0, kills: 0, gold: 0, exp: 0, tomes: 0, firsts: [], t0: Date.now(), lv0: S.level, best0: S.tower.best };
  S.phase = 'tower';
  S.hp = stats().maxHp;
  return true;
}

// 오늘 남은 무료 입장권
function towerFreeTickets() {
  if (S.tower.tixDay !== todayKey()) { S.tower.tixDay = todayKey(); S.tower.tixUsed = 0; }
  return Math.max(0, TOWER_TICKETS - S.tower.tixUsed);
}
// 지금 쓸 수 있는 입장권 (무료 + 산 것)
const towerTickets = () => towerFreeTickets() + (S.tower.tixExtra || 0);
// 무료 입장권부터 쓴다
const useTowerTicket = () => { if (towerFreeTickets() > 0) S.tower.tixUsed++; else S.tower.tixExtra = Math.max(0, S.tower.tixExtra - 1); };

// ── 입장권 구매 ── 오늘 n번째 구매는 TOWER_TICKET_STEPS[n] 배, 표를 넘으면 × TOWER_TICKET_GROW 씩
const towerTicketsBoughtToday = () => (S.tower.buyDay === todayKey() ? S.tower.bought : 0);
function towerTicketPrice() {
  const n = towerTicketsBoughtToday(), last = TOWER_TICKET_STEPS.length - 1;
  const k = n <= last ? TOWER_TICKET_STEPS[n] : TOWER_TICKET_STEPS[last] * Math.pow(TOWER_TICKET_GROW, n - last);
  return {
    gold: Math.max(1, Math.floor(monsterStats(S.best, false).gold * TOWER_TICKET_GOLD * k)),
    mana: n === 0 ? 0 : Math.floor((TOWER_TICKET_MANA + S.best / 20) * k),
  };
}
function towerTicketBlocker() {
  if (!towerUnlocked()) return `스테이지 ${TOWER_UNLOCK_STAGE} 도달 시 열려요`;
  if ((S.tower.tixExtra || 0) >= TOWER_TICKET_HOLD) return `산 입장권은 ${TOWER_TICKET_HOLD}장까지 가질 수 있어요`;
  const p = towerTicketPrice();
  if (S.gold < p.gold) return '골드 부족';
  if (S.mats.mana < p.mana) return '마력석 부족';
  return '';
}
function buyTowerTicket() {
  if (towerTicketBlocker()) return false;
  const p = towerTicketPrice();
  S.gold -= p.gold;
  S.mats.mana -= p.mana;
  if (S.tower.buyDay !== todayKey()) { S.tower.buyDay = todayKey(); S.tower.bought = 0; }
  S.tower.bought++;
  S.tower.tixExtra = (S.tower.tixExtra || 0) + 1;
  return true;
}
// 소탕: 입장권 1장으로 최고 층 수만큼 비전서를 바로 받는다
const towerSweepReady = () => towerUnlocked() && S.tower.best > 0 && towerTickets() > 0 && !S.tower.run;
function sweepTower() {
  if (!towerSweepReady()) return 0;
  useTowerTicket();
  S.tomes += S.tower.best;
  return S.tower.best;
}

// 탑 몬스터 처치 보상 (골드·경험치)
function towerKillReward(m) {
  const r = S.tower.run;
  const gold = m.gold * goldMult(), exp = m.exp * expMult();
  S.gold += gold; r.gold += gold;
  r.kills = (r.kills || 0) + 1;
  r.exp += exp;
  gainExp(exp);
}

// 지금 층을 깼다. { floor, tomes 받은 비전서, first 10층 단위 첫 돌파, record 이번 도전에서 처음 최고 기록을 넘음 }
function clearTowerFloor() {
  const r = S.tower.run, f = r.floor;
  r.cleared++;
  let tomes = 1, first = false, record = false;
  if (f > S.tower.best) {
    if (!r.record) { r.record = true; record = S.tower.best > 0; }
    S.tower.best = f;
    if (f % 10 === 0 && f > (S.tower.paid || 0)) { tomes += towerFirstTomes(f); r.firsts.push(f); first = true; S.tower.paid = f; }
  }
  S.tomes += tomes; r.tomes += tomes;
  r.floor++;
  return { tomes, first, record, floor: f };
}

// 도전 끝: reason = down 쓰러짐 | stamina 지침 | retreat 후퇴 | offline 앱을 꺼서
function endTower(reason) {
  const r = S.tower.run;
  if (!r) return null;
  const at = Date.now();
  S.tower.last = {
    start: r.start, reached: r.floor, cleared: r.cleared, kills: r.kills || 0, gold: r.gold, exp: r.exp, tomes: r.tomes, firsts: r.firsts,
    reason, best: S.tower.best, best0: r.best0 ?? S.tower.best, dur: r.t0 && reason !== 'offline' ? (at - r.t0) / 1000 : 0, levels: r.lv0 ? S.level - r.lv0 : 0, at, seen: false,
  };
  S.tower.run = null;
  return S.tower.last;
}
