'use strict';
// 게임 규칙. 화면(DOM/캔버스)을 모르고 S 상태만 바꾼다.
// 연출이 필요한 순간은 hooks 로 알려서 world.js / ui.js 가 처리한다.

const hooks = {
  onLevelUp: () => {},
  onExpeditionEnd: (_reason) => {},
  onArrive: () => {},
  onBuilt: (_id) => {},
  onClassChange: (_id) => {},
  onSave: () => {},
};

// ───────────────────────── 상태 / 저장 ─────────────────────────
function freshState() {
  return {
    v: 2,
    level: 1, exp: 0, gold: 0,
    mats: { wood: 0, ore: 0, mana: 0 },
    stage: 1, best: 1,
    run: { kills: 0, total: 8, farm: false, cleared: false },  // 현재 바퀴 진행. total=이번 바퀴 몬스터 수, cleared=보스 처치, farm=쓰러져서 이번 원정은 보스 없이 사냥
    train: { atk: 0, hp: 0, spd: 0, crit: 0 },
    bld: { training: 1, inn: 1, storage: 1, forge: 1 },
    build: null,                            // { id, remain, total }
    items: { lunch: 1, potion: 2, charm: 0, elixir: 0, protect: 0 },
    gear: freshGear(),                      // 장비 창고·장착·부위별 강화 단계 (gear.js)
    cls: 'squire',                          // 현재 직업 (CLASSES 키)
    phase: 'camp',                          // camp | expedition | returning
    stamina: 100, hp: null,
    bag: [],                                // 원정 전리품 (장비·골동품·소비 아이템, gear.js 참고)
    trip: null,                             // 진행 중인 원정 기록
    report: null,                           // 확인 안 한 원정 기록
    lastSeen: Date.now(),
  };
}

let S = freshState();

function migrate(o) {
  const s = freshState();
  if (!o.v) {
    // v1: 강화가 upg 에 있고 원정 개념이 없던 버전
    Object.assign(s, { level: o.level || 1, exp: o.exp || 0, gold: o.gold || 0, stage: o.stage || 1, best: o.best || 1 });
    if (o.upg) Object.assign(s.train, o.upg);
    return s;
  }
  if (!CLASSES[o.cls]) o.cls = 'squire';
  for (const k of Object.keys(s)) {
    if (!(k in o)) continue;
    const isObj = s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]);
    s[k] = isObj && o[k] ? Object.assign(s[k], o[k]) : o[k];
  }
  s.bag = (s.bag || []).map(upgradeOldLoot);     // v2 초기의 미감정 상자 → 전리품
  s.gear.inv.forEach(fixGearItem);
  return s;
}

// 세이브는 계정(닉네임)마다 따로 둔다. saveKey 가 null 이면(계정 없음) 저장하지 않는다.
let saveKey = null;

function save() {
  if (!saveKey) return;
  S.lastSeen = Date.now();
  try { localStorage.setItem(saveKey, JSON.stringify(S)); } catch {}
  hooks.onSave();
}
function readLocalSave(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
// o: 세이브 객체 (없으면 새 기사)
function loadState(o) {
  S = freshState();
  try { if (o) S = migrate(o); } catch {}
  if (S.hp == null) S.hp = stats().maxHp;
}
function resetState() {
  S = freshState();
  S.hp = stats().maxHp;
  save();
}

// ───────────────────────── 스탯 ─────────────────────────
const heroClass = () => CLASSES[S.cls] || CLASSES.squire;
const heroWeapon = () => WEAPONS[heroClass().weapon];

// 모든 전투 수치는 여기 한 곳에서 합친다 (레벨·훈련·대장간·직업·무기·장비·원정 버프).
// base=true 면 원정 버프(영약)를 빼고 계산한다 (랭킹·결투용)
function stats(base = false) {
  const c = heroClass(), w = WEAPONS[c.weapon], m = c.mods;
  const t = S.train;
  const gb = gearBonus();
  // 장비 무기 공격력도 대장간 배율을 받는다
  let atk = ((5 + t.atk * 2.5) * Math.pow(1.07, t.atk) + (S.level - 1) * 1.5 + gb.atk)
    * forgeMultAt(S.bld.forge) * (m.atk || 1);
  if (!base && S.trip && S.trip.buffs.elixir) atk *= 1.3;
  const maxHp = ((60 + t.hp * 18) * Math.pow(1.07, t.hp) + (S.level - 1) * 8 + gb.hp) * (m.hp || 1);
  const aspd = (0.9 + t.spd * 0.08) * (m.aspd || 1);
  const crit = Math.min(0.8, 0.05 + t.crit * 0.025 + (m.crit || 0) + gb.crit);
  return {
    atk, maxHp, aspd, crit, critMult: 2.5 + (m.critMult || 0) + gb.critMult,
    kind: w.kind, range: w.range, targets: w.targets, shots: w.shots || 1, shotMult: w.shotMult || 1,
    guard: m.guard || 0, heal: m.heal || 0, leap: c.leap || null,
  };
}
// 한 마리를 상대로 한 초당 피해 (연발·도약 포함)
function dpsOf(st) {
  const perHit = st.atk * (1 + st.crit * (st.critMult - 1));
  let dps = perHit * st.shots * st.shotMult * st.aspd;
  if (st.leap) dps += (perHit * st.leap.mult) / st.leap.every;
  return dps;
}
const powerOf = (st) => Math.round(Math.sqrt(dpsOf(st) * st.maxHp) * 10);

// 서버에 올리는 공개 전투 정보. 랭킹 표시와 결투 계산에 쓰인다.
function profile() {
  const st = stats(true);
  return {
    cls: S.cls, level: S.level, best: S.best, power: powerOf(st),
    atk: st.atk, maxHp: st.maxHp, aspd: st.aspd, crit: st.crit, critMult: st.critMult,
    range: st.range, shots: st.shots, shotMult: st.shotMult, guard: st.guard, heal: st.heal, leap: st.leap,
  };
}

const maxStamina = () => maxStaminaAt(S.bld.inn);
const minDepartStamina = () => Math.ceil(maxStamina() * MIN_DEPART_RATIO);
const bagCap = () => bagCapAt(S.bld.storage);
const expToNext = () => expToNextAt(S.level);

function gainExp(e) {
  S.exp += e;
  let ups = 0;
  while (S.exp >= expToNext()) {
    S.exp -= expToNext();
    S.level++;
    ups++;
  }
  if (ups) { S.hp = stats().maxHp; hooks.onLevelUp(); }
  return ups;
}

// ───────────────────────── 훈련 ─────────────────────────
const trainCost = (u) => Math.floor(u.base * Math.pow(u.grow, S.train[u.id]));
const trainMax = (u) => Math.min(u.max, trainCapAt(S.bld.training));

function doTrain(id) {
  const u = TRAINING.find(x => x.id === id);
  if (S.phase !== 'camp' || S.train[id] >= trainMax(u) || S.gold < trainCost(u)) return false;
  const oldMax = stats().maxHp;
  S.gold -= trainCost(u);
  S.train[id]++;
  if (id === 'hp') S.hp += stats().maxHp - oldMax;
  return true;
}

// ───────────────────────── 전직 ─────────────────────────
function classPath(id = S.cls) {
  const path = [];
  for (let c = id; c; c = CLASSES[c].from) path.unshift(c);
  return path;
}
function classBlocker(id) {
  const c = CLASSES[id];
  if (c.from !== S.cls) return null;           // 다음 단계가 아님 (UI에서 따로 표시)
  const req = CLASS_REQ[c.tier];
  if (S.phase !== 'camp') return '캠프에서만 전직할 수 있어요';
  if (S.level < req.level) return `Lv ${req.level} 필요`;
  if (S.mats.mana < req.mana) return `💎 ${req.mana} 필요`;
  if (S.gold < req.gold) return `<i class="gc"></i> ${fmt(req.gold)} 필요`;
  return '';
}
function changeClass(id) {
  if (CLASSES[id].from !== S.cls || classBlocker(id)) return false;
  const req = CLASS_REQ[CLASSES[id].tier];
  S.mats.mana -= req.mana;
  S.gold -= req.gold;
  S.cls = id;
  S.hp = stats().maxHp;
  hooks.onClassChange(id);
  return true;
}

// ───────────────────────── 건설 ─────────────────────────
function canAfford(cost) {
  return S.gold >= cost.gold && S.mats.wood >= cost.wood && S.mats.ore >= cost.ore && S.mats.mana >= cost.mana;
}
function startBuild(id) {
  const lv = S.bld[id];
  const cost = buildCost(id, lv);
  if (S.build || lv >= BUILD_MAX || !canAfford(cost)) return false;
  S.gold -= cost.gold;
  S.mats.wood -= cost.wood; S.mats.ore -= cost.ore; S.mats.mana -= cost.mana;
  const total = buildTimeAt(lv);
  S.build = { id, remain: total, total };
  return true;
}
function advanceBuild(sec) {
  if (!S.build) return;
  S.build.remain -= sec;
  if (S.build.remain <= 0) {
    const id = S.build.id;
    S.bld[id]++;
    S.build = null;
    if (id === 'inn') S.stamina = Math.min(maxStamina(), S.stamina);
    hooks.onBuilt(id);
  }
}

// ───────────────────────── 보급품 ─────────────────────────
const supplyPrice = (id) => Math.floor(SUPPLIES[id].price * monsterStats(S.best, false).gold);

function buySupply(id) {
  const p = supplyPrice(id);
  if (S.gold < p) return false;
  S.gold -= p;
  S.items[id]++;
  return true;
}
function eatLunch() {
  if (S.phase !== 'camp' || S.items.lunch <= 0 || S.stamina >= maxStamina()) return false;
  S.items.lunch--;
  S.stamina = Math.min(maxStamina(), S.stamina + maxStamina() * LUNCH_RATIO);
  return true;
}
// 원정 중 체력이 낮으면 물약 자동 사용
function tryPotion() {
  const max = stats().maxHp;
  if (S.hp >= max * POTION_AT || S.items.potion <= 0) return false;
  S.items.potion--;
  S.hp = max;
  S.trip.potions++;
  return true;
}

// ───────────────────────── 전리품 ─────────────────────────
// 전리품 등급. 보스는 일반 등급이 안 나오고, 행운의 부적은 좋은 등급 가중치를 올린다. 종류는 gear.js 의 rollLoot
function rollGrade(boss, charm) {
  const w = GRADES.map((g, i) => (boss && i === 0 ? 0 : g.w) * (charm ? CHARM_BONUS[i] : 1));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return 0;
}

// ───────────────────────── 원정 ─────────────────────────
function departBlocker() {
  if (S.phase !== 'camp') return '원정 중';
  if (S.stamina < minDepartStamina()) return `스태미나 ${minDepartStamina()} 이상 필요`;
  if (S.bag.length >= bagCap()) return '가방이 가득 참 — 전리품을 먼저 챙겨주세요';
  return null;
}

function startExpedition({ charm = false, elixir = false } = {}) {
  if (departBlocker()) return false;
  if (charm && S.items.charm > 0) S.items.charm--; else charm = false;
  if (elixir && S.items.elixir > 0) S.items.elixir--; else elixir = false;
  S.trip = {
    start: Date.now(), dur: 0, kills: 0, bosses: 0, gold: 0, xp: 0, levels: 0,
    stageFrom: S.stage, stageTo: S.stage, boxes: GRADES.map(() => 0),
    potions: 0, crises: 0, deaths: 0, bossFail: false, reason: null, buffs: { charm, elixir },
  };
  S.run.kills = 0; S.run.farm = false; S.run.cleared = false;
  S.hp = stats().maxHp;
  S.phase = 'expedition';
  return true;
}

// 캠프에서 사냥할 필드를 고른다. 열린 필드만 갈 수 있고, 그 필드에서 도달한 가장 높은 스테이지부터 시작한다.
function selectZone(i) {
  if (S.phase !== 'camp' || !ZONES[i] || !zoneUnlocked(i, S.best)) return false;
  S.stage = Math.min(S.best, ZONES[i].to);
  S.run.kills = 0; S.run.cleared = false;
  return true;
}

// reason: stamina | bag | manual.  instant=true 면 걷는 연출 없이 바로 캠프 도착
function endExpedition(reason, instant = false) {
  if (S.phase !== 'expedition') return;
  S.trip.reason = reason;
  S.trip.stageTo = S.stage;
  S.phase = 'returning';
  hooks.onExpeditionEnd(reason);
  if (instant) arriveCamp(true);
}

function arriveCamp(silent = false) {
  if (S.phase !== 'returning') return;
  S.phase = 'camp';
  const t = S.trip;
  S.trip = null;
  if (S.report) {
    // 이전 보고를 안 봤으면 합친다
    const r = S.report;
    for (const k of ['dur', 'kills', 'bosses', 'gold', 'xp', 'levels', 'potions', 'crises', 'deaths']) r[k] += t[k];
    t.boxes.forEach((n, i) => { r.boxes[i] = (r.boxes[i] || 0) + n; });
    r.stageTo = t.stageTo; r.reason = t.reason; r.bossFail = r.bossFail || t.bossFail;
    r.trips = (r.trips || 1) + 1;
  } else {
    S.report = t;
  }
  if (!silent) hooks.onArrive();
}

// 몬스터 처치 보상 (실시간·오프라인 공용). 연출용 정보를 돌려준다.
function rewardKill(m) {
  const t = S.trip;
  S.gold += m.gold; t.gold += m.gold;
  t.kills++; if (m.boss) t.bosses++;
  t.xp += m.exp;
  t.levels += gainExp(m.exp);
  let loot = null;
  if ((m.boss || Math.random() < BOX_DROP) && S.bag.length < bagCap()) {
    loot = rollLoot(rollGrade(m.boss, t.buffs.charm), S.stage, m.boss);
    S.bag.push(loot);
    const bg = lootGrade(loot);
    t.boxes[bg] = (t.boxes[bg] || 0) + 1;
  }
  S.run.kills++;
  if (m.boss) S.run.cleared = true;
  return { loot };
}

// 화면 오른쪽 끝을 지나 한 바퀴를 마쳤을 때. 보스를 잡았으면 다음 스테이지, 아니면 같은 스테이지를 한 바퀴 더.
function finishLap() {
  const stageUp = S.run.cleared;
  if (stageUp) {
    S.stage++;
    S.best = Math.max(S.best, S.stage);
  }
  S.run.kills = 0; S.run.cleared = false;
  return stageUp;
}

// 보스는 바퀴의 마지막(화면 우하단) 몬스터
const isBossNext = () => !S.run.farm && !S.run.cleared && S.run.kills === S.run.total - 1;

// 쓰러짐: 스태미나를 잃고 다시 일어나 이번 원정은 파밍만 한다.
// 보스에게 졌으면 같은 스테이지에서, 일반 몬스터에게 졌으면 한 스테이지 아래에서 (필드 밖으로는 안 내려간다).
function knightDefeated(atBoss) {
  if (!atBoss && S.stage > zoneOf(S.stage).from) S.stage--;
  if (atBoss) S.trip.bossFail = true;
  S.run.kills = 0; S.run.cleared = false; S.run.farm = true;
  S.trip.deaths++;
  S.stamina = Math.max(0, S.stamina - DEFEAT_STAMINA);
  S.hp = stats().maxHp;
}

// 캠프에서 흐르는 시간: 휴식
function advanceCamp(sec) {
  if (S.phase !== 'camp') return;
  S.stamina = Math.min(maxStamina(), S.stamina + (maxStamina() / restSecAt(S.bld.inn)) * sec);
  const max = stats().maxHp;
  S.hp = Math.min(max, S.hp + max * CAMP_HEAL_PER_SEC * sec);
}

// 앱이 꺼져 있었거나 절전으로 멈춘 시간을 한 번에 계산한다.
// 전투는 "걷기 + 몬스터 1마리 처치"를 한 사이클로 근사하고, 바퀴의 몬스터를 다 잡으면 다음 바퀴로 넘어간다.
function simulate(sec) {
  advanceBuild(sec);
  if (S.phase === 'returning') arriveCamp(true);
  let t = sec;
  let guard = 0;
  while (S.phase === 'expedition' && t > 0 && guard++ < 50000) {
    if (S.run.kills >= S.run.total) finishLap();
    const st = stats();
    const boss = isBossNext();
    const m = monsterStats(S.stage, boss);
    const walk = 4.5;
    // 여러 마리를 동시에 때리는 무기는 처치 속도가 조금 빨라진다고 근사
    const fight = m.hp / (dpsOf(st) * (st.targets > 1 ? 1.25 : 1));
    const cycle = walk + fight;
    const staminaLeft = S.stamina / STAMINA_DRAIN;
    if (cycle > t || cycle > staminaLeft) {
      const used = Math.min(t, staminaLeft);
      S.stamina -= used * STAMINA_DRAIN;
      S.trip.dur += used;
      t -= used;
      if (S.stamina <= 0.01) { S.stamina = 0; endExpedition('stamina', true); }
      break;
    }
    t -= cycle;
    S.stamina -= cycle * STAMINA_DRAIN;
    S.trip.dur += cycle;
    S.hp = Math.min(st.maxHp, S.hp + st.maxHp * 0.06 * walk);
    // 사거리가 길면 적이 다가오는 동안은 맞지 않는다. 방어(guard)·타격 회복(heal) 반영
    const exposed = Math.max(0, fight - (st.range - MELEE_REACH) / MONSTER_SPEED);
    S.hp -= (exposed / 1.3) * m.atk * (1 - st.guard);
    S.hp += fight * st.aspd * st.heal * st.maxHp;
    // 체력이 30% 아래로 떨어질 때마다 물약이 최대 체력의 70%를 되돌려 준다고 근사
    while (S.hp < st.maxHp * POTION_AT && S.items.potion > 0) {
      S.items.potion--; S.trip.potions++;
      S.hp += st.maxHp * (1 - POTION_AT);
    }
    if (S.hp <= 0) {
      t -= DEFEAT_DOWN_SEC;
      knightDefeated(boss);
      if (S.stamina <= 0) { endExpedition('stamina', true); break; }
      continue;
    }
    S.hp = Math.min(st.maxHp, S.hp);
    if (S.hp < st.maxHp * 0.25) S.trip.crises++;
    rewardKill(m);
    if (S.bag.length >= bagCap()) endExpedition('bag', true);
  }
  if (t > 0) advanceCamp(t);
}

const REASON_TEXT = {
  stamina: '스태미나를 모두 써서 캠프로 돌아왔습니다.',
  bag: '가방이 가득 차서 캠프로 돌아왔습니다.',
  manual: '귀환 명령을 받고 돌아왔습니다.',
};
