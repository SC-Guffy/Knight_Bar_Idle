'use strict';
// 도전의 탑 규칙. core.js 처럼 DOM 을 모르고 S 상태만 바꾼다. 화면 연출(층 오르기·추락)은 world.js 의 updateTower.
//  S.tower = {
//    best: 지금까지 깬 가장 높은 층 (0 = 아직 없음),
//    paid: 첫 돌파 묶음을 받은 가장 높은 10층 단위 (난이도 개편 전 기록을 옮길 때 같은 묶음을 두 번 주지 않게),
//    curve: 층 난이도 곡선 버전 (TOWER_CURVE 와 다르면 best 를 새 곡선으로 옮긴다),
//    day, dayTomes: 오늘(자정 기준) 층 보상으로 받은 비전서 수 (towerDailyCap 까지),
//    run: 진행 중인 도전 { start 시작 층, sweep 아래층 소탕으로 받은 비전서, floor 지금 층, cleared 이번에 깬 층 수, kills, gold, exp, tomes, firsts: [첫 돌파 층],
//          t0 시작 시각, lv0 시작 레벨, best0 시작 전 최고 층 } | null,
//    last: 마지막 도전 결과 { start, reached, cleared, kills, gold, exp, tomes, firsts, reason, best, best0, dur, levels, at,
//          seen: false 면 아직 정산 화면을 안 봄 (캠프를 열면 탑 탭에 정산이 뜬다) } | null,
//  }
// 규칙
//  - 원정과 같은 스태미나를 같은 속도(STAMINA_DRAIN)로 쓴다. 스태미나가 바닥나거나 쓰러지거나 후퇴하면 끝.
//  - 시작은 체크포인트(깬 10층 단위 다음 층)부터. 층마다 정예 몬스터 1마리, 10층마다 보스.
//  - 층 난이도는 스테이지 TOWER_STAGE0 + 층 × TOWER_STAGE_PER. 정예는 체력 ×TOWER_ELITE_HP · 공격력 ×TOWER_ELITE_ATK, 보스는 체력 ×TOWER_BOSS_HP · 공격력 ×TOWER_BOSS_ATK.
//  - 한 층에서 TOWER_ENRAGE_SEC 초 넘게 싸우면 몬스터가 광폭화해 공격력이 계속 두 배씩 오른다 (towerRage) → 못 넘는 층은 금방 쓰러져 끝난다.
//  - 보상: 처치 골드·경험치(정예라 원정 몬스터의 3배) + 📖 비전서 — 층을 깰 때마다 1권, 시작할 때 체크포인트 아래층 소탕으로 층마다 1권
//          (둘 다 합쳐 하루 towerDailyCap 권까지)
//          + 10층 단위 첫 돌파 때 묶음(towerFirstTomes). 오프라인 진행은 없다(앱을 껐다 켜면 그 층에서 끝낸 것으로 정산).

const TOWER_CURVE = 2;   // 1: 스테이지 10 + 층×2 (0.10.0) → 2: 25 + 층×3
const freshTower = () => ({ best: 0, paid: 0, curve: TOWER_CURVE, day: '', dayTomes: 0, run: null, last: null });
// 옛 곡선의 최고 층을 같은 스테이지 급의 새 층으로 옮긴다 (체크포인트가 감당 못 할 높이가 되지 않게)
function migrateTower(t) {
  if (t.curve === TOWER_CURVE) return;
  t.paid = Math.max(t.paid || 0, Math.floor((t.best || 0) / 10) * 10);
  t.best = Math.max(0, Math.floor((10 + (t.best || 0) * 2 - TOWER_STAGE0) / TOWER_STAGE_PER));
  t.curve = TOWER_CURVE;
}

const towerUnlocked = () => S.best >= TOWER_UNLOCK_STAGE;
const towerCheckpoint = () => Math.floor(S.tower.best / 10) * 10 + 1;
const towerStage = (floor) => TOWER_STAGE0 + Math.round(floor * TOWER_STAGE_PER);
const towerBossFloor = (floor) => floor % 10 === 0;
// 10층 단위 첫 돌파 비전서: 10층 4권, 20층 5권, … (높을수록 조금씩 많이)
const towerFirstTomes = (floor) => 3 + floor / 10;
// 오늘(자정 기준) 층 보상으로 받은 비전서 수
function towerDayTomes() {
  if (S.tower.day !== todayKey()) { S.tower.day = todayKey(); S.tower.dayTomes = 0; }
  return S.tower.dayTomes;
}
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
  if (S.stamina < minDepartStamina()) return `스태미나 ${minDepartStamina()} 이상 필요 (휴식 중)`;
  return '';
}

function startTower() {
  if (towerBlocker()) return false;
  const start = towerCheckpoint();
  // 체크포인트 아래층은 소탕: 층마다 1권 (하루 한도 안에서)
  const sweep = Math.max(0, Math.min(start - 1, towerDailyCap() - towerDayTomes()));
  S.tower.dayTomes += sweep; S.tomes += sweep;
  S.tower.run = { start, floor: start, cleared: 0, kills: 0, gold: 0, exp: 0, tomes: sweep, sweep, firsts: [], t0: Date.now(), lv0: S.level, best0: S.tower.best };
  S.phase = 'tower';
  S.hp = stats().maxHp;
  return true;
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
  let tomes = 0, first = false, record = false;
  if (towerDayTomes() < towerDailyCap()) { S.tower.dayTomes++; tomes++; }
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
    start: r.start, reached: r.floor, cleared: r.cleared, sweep: r.sweep || 0, kills: r.kills || 0, gold: r.gold, exp: r.exp, tomes: r.tomes, firsts: r.firsts,
    reason, best: S.tower.best, best0: r.best0 ?? S.tower.best, dur: r.t0 && reason !== 'offline' ? (at - r.t0) / 1000 : 0, levels: r.lv0 ? S.level - r.lv0 : 0, at, seen: false,
  };
  S.tower.run = null;
  return S.tower.last;
}
