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
  onAccountGone: () => {},
  onTowerEnd: (_result) => {},
  onDungeonEnd: (_result) => {},
};

// ───────────────────────── 상태 / 저장 ─────────────────────────
function freshState() {
  return {
    v: 2,
    level: 1, exp: 0, gold: 0,
    mats: { wood: 0, ore: 0, mana: 0 },
    stage: 1, best: 1,
    run: { kills: 0, total: 8, farm: false, cleared: false },  // 현재 바퀴 진행. total=이번 바퀴 몬스터 수, cleared=보스 처치, farm=쓰러져서 이번 원정은 보스 없이 사냥
    train: { atk: 0, hp: 0, def: 0, fortune: 0 },
    bld: { training: 1, inn: 1, storage: 1, forge: 1 },
    forge: { reforge: 1 },                  // 대장간 시설 Lv (data.js FORGE_FAC) — 최대 Lv 은 대장간 건물 Lv
    build: null,                            // { id, remain, total }
    items: { lunch: 1, potion: 2, charm: 0, elixir: 0, protect: 0 },
    gear: freshGear(),                      // 장비 창고·장착·부위별 강화 단계 (gear.js)
    cls: 'squire',                          // 현재 직업 (CLASSES 키)
    mast: {},                               // 스킬 숙련도: 스킬 id → 먹인 비전서 누적 권수 (classes.js SKILL_MAX·skillNeed)
    mastV: 5,                               // 5: mast 가 권수, 레벨당 최대 15권 (4: 30권, 3: 10권, 2: 20권, 1: 옛 경험치, 1권 = 10)
    tomes: 0,                               // 📖 비전서
    stones: 0,                              // 💠 강화석 (장비 강화 전용, gear.js)
    gearV: 4,                               // 3: 아이템 레벨이 부위(S.gear.lvl)에 붙음 · 2: 장비마다 s 절대값 · 1: 등급 %
    phase: 'camp',                          // camp | expedition | returning | tower | dungeon
    stamina: 100, hp: null,
    bag: [],                                // 원정 전리품 상자 (gear.js 참고)
    trip: null,                             // 진행 중인 원정 기록
    report: null,                           // 확인 안 한 원정 기록
    raid: freshRaid(),                      // 보스 레이드: 입장권·처치 상자·마지막 정산 (raid.js)
    season: freshSeason(),                  // 결투 시즌: 받은 시즌 보상 (season.js)
    mail: { got: [] },                      // 우편함: 보상을 받은 우편 id (data.js MAIL)
    duelSeen: 0,                            // 받은 결투(우편함)에서 읽은 마지막 기록 id (ui.js inbox)
    tower: freshTower(),                    // 도전의 탑: 최고 층·진행 중인 도전 (tower.js)
    dg: freshDungeon(),                     // 갈림길 던전: 입장권·완주 기록·방침·진행 중인 도전 (dungeon.js)
    wb: freshWb(),                          // 월드 보스: 받은 보상·마지막 정산 (worldboss.js)
    guide: {},                              // 처음 하는 일 안내(FTUE)에서 이미 본 단계 (ui.js guideTick)
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
  s.bag = (s.bag || []).map(upgradeOldLoot);     // v2 초기의 미감정 상자 → 전리품 상자
  // 공속·치명 훈련이 없어졌다: 올려 둔 단계만큼 쓴 골드를 돌려준다
  let refund = 0;
  for (const [id, u] of Object.entries(OLD_TRAINING)) {
    for (let i = 0; i < (s.train[id] || 0); i++) refund += Math.floor(u.base * Math.pow(u.grow, i));
    delete s.train[id];
  }
  if (refund > 0) {
    s.gold += refund;
    s.notice = `🎯 훈련 개편 — 공속·치명 훈련이 방어·수완으로 바뀌어서 쓴 골드 ${fmt(refund)}을 돌려드렸어요`;
  }
  // 잠깐 있었던 거물 사냥(boss) 훈련은 비용 곡선이 같은 수완으로 단계를 옮긴다
  // 스킬 숙련도 도입: 모두 Lv1 에서 시작한다 (Lv1 은 예전 스킬 배율의 ×0.85)
  if (!o.mast && !s.notice) s.notice = '📖 스킬 숙련도 도입 — 스킬 한 방은 세졌지만 쿨타임이 3배로 길어졌어요. 비전서를 먹여 Lv30까지 키우면 쿨타임이 줄고 위력이 오릅니다 (전직 탭)';
  // 숙련도가 경험치(1권 = 10) → 비전서 권수로: 먹였던 권수 그대로 옮긴다 (요구량이 줄어서 레벨은 오른다)
  if (o.mast && (o.mastV || 1) < 2) for (const id of Object.keys(s.mast)) s.mast[id] = Math.min(SKILL_TOME_MAX, Math.round(s.mast[id] / 10));
  // 요구량이 바뀌면(mastV 2: 레벨당 최대 20권, 3: 10권, 4: 30권 → 5: 15권) 지금 레벨과 칸 비율은 그대로 두고 새 곡선의 누적 권수로 옮긴다
  if (o.mast && (o.mastV || 1) < 5) {
    const oldMax = { 3: 10, 4: 30 }[o.mastV] || 20;
    for (const id of Object.keys(s.mast)) {
      let lv = 1, left = s.mast[id];
      while (lv < SKILL_MAX && left >= skillNeedWith(oldMax, lv)) { left -= skillNeedWith(oldMax, lv); lv++; }
      s.mast[id] = lv >= SKILL_MAX ? SKILL_TOME_MAX : skillTomesAt(lv) + Math.floor(left / skillNeedWith(oldMax, lv) * skillNeed(lv));
    }
  }
  s.mastV = 5;
  // 강화 비용이 골드 → 💠 강화석으로 바뀌었다: 처음 한 번 조금 넣어 준다
  if (!('stones' in o)) {
    s.stones = STONE_GIFT;
    if (!s.notice) s.notice = `💠 강화석 도입 — 장비 강화는 이제 골드 대신 강화석을 써요. 원정 보스·장비 판매로 얻고, 시작 선물로 ${STONE_GIFT}개를 드렸어요`;
  }
  if (s.train.boss) s.train.fortune = (s.train.fortune || 0) + s.train.boss;
  delete s.train.boss;
  s.gear.inv.forEach(fixGearItem);
  // 성장 개편(gearV 2): 장비가 아이템 레벨 절대값이 됐다. 예전 레이드 상자 장비(전설 이상·세트)는 s 가 보스 입장 스테이지라
  //  너무 낮아지므로 최고 스테이지로 올려 준다. 훈련 단계는 그대로 두고 새 공식만 적용한다
  if ((o.gearV || 1) < 2) {
    for (const it of s.gear.inv) if (it.g >= 4 || isSetGear(it)) it.s = Math.max(it.s || 1, s.best || 1);
    for (const c of s.raid.chests || []) c.s = Math.max(c.s || 1, s.best || 1);
    s.notice = '⚖️ 성장 개편 — 이제 공격력·체력은 장비가 책임지고, 훈련은 초반을 끌어 주다가 % 보너스로 바뀌어요. 무기·갑옷 부위의 아이템 레벨은 대장간 🔥 재련(장비 탭)으로 올려요. 같은 부위 장비는 등급이 곧 서열이에요';
  }
  // gearV 3: 아이템 레벨이 장비 → 부위로. 지금 낀 장비의 레벨을 그 부위 레벨로 옮긴다 (재련로도 최소 Lv1)
  if ((o.gearV || 1) < 3) {
    for (const slot of ['weapon', 'armor']) {
      const it = s.gear.inv.find((x) => x.id === s.gear.eq[slot]);
      s.gear.lvl[slot] = Math.max(s.gear.lvl[slot] || 1, it ? it.s || 1 : 1);
    }
    s.forge.reforge = Math.max(1, s.forge.reforge || 0);
    if ((o.gearV || 1) >= 2) s.notice = '🔥 아이템 레벨이 장비에서 부위로 옮겨졌어요 — 이제 같은 부위 장비는 등급이 곧 서열이에요. 무기·갑옷 레벨은 대장간 재련(장비 탭)으로 올려요. 지금 낀 장비의 레벨을 그대로 옮겨 드렸어요';
  }
  // gearV 4: 재련 한도가 재련로 Lv × 15 로 바뀌었다 — 예전 대장간 Lv 만큼 재련로를 올려 둔다
  if ((o.gearV || 1) < 4) s.forge.reforge = Math.max(s.forge.reforge || 1, Math.min(BUILD_MAX, s.bld.forge || 1));
  s.gearV = 4;
  // 연마대(0.12.2, 강화 성공 확률 보너스)가 빠졌다: 올린 데 쓴 재화를 돌려준다
  if (s.forge.anvil) {
    const back = { gold: 0, ore: 0, mana: 0 };
    for (let i = 0; i < s.forge.anvil; i++) { const c = forgeFacCost('anvil', i); back.gold += c.gold; back.ore += c.ore; back.mana += c.mana; }
    s.gold += back.gold; s.mats.ore += back.ore; s.mats.mana += back.mana;
    delete s.forge.anvil;
    s.notice = `⚒️ 연마대가 빠졌어요 — 강화는 아껴서 키우는 성장이라 확률 보너스를 없앴어요. 쓴 골드 ${fmt(back.gold)} · 철광석 ${fmt(back.ore)} · 마력석 ${fmt(back.mana)}을 돌려드렸어요`;
  }
  // 탑 기록은 curve 가 없으면 옛 곡선 기록 (freshTower 기본값이 덮어쓰기 전에 원본으로 판단)
  if (o.tower && o.tower.curve !== TOWER_CURVE) { s.tower.curve = o.tower.curve || 1; migrateTower(s.tower); }
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

// 모든 전투 수치는 여기 한 곳에서 합친다 (레벨·훈련·직업·무기·장비·원정 버프).
// base=true 면 원정 버프(영약)를 빼고 계산한다 (랭킹·결투용)
function stats(base = false) {
  const c = heroClass(), w = WEAPONS[c.weapon], m = c.mods;
  const t = S.train;
  const gb = gearBonus();
  // 절대값 = 기본·훈련·레벨 + 무기 공격력 / 갑옷 체력 (아이템 레벨). 여기에 훈련 %·직업·특수 효과 배율이 곱해진다
  let atk = (trainAtkAt(t.atk) + (S.level - 1) * 1.5 + gb.atk)
    * trainPctAt(t.atk) * (m.atk || 1) * (1 + gb.atkPct);
  if (!base && S.trip && S.trip.buffs.elixir) atk *= 1.3;
  const maxHp = (trainHpAt(t.hp) + (S.level - 1) * 8 + gb.hp) * trainPctAt(t.hp) * (m.hp || 1) * (1 + gb.hpPct);
  const aspd = 0.9 * (m.aspd || 1) * (1 + gb.aspdPct);
  const crit = Math.min(0.8, 0.05 + (m.crit || 0) + gb.crit);
  const defRed = defRedAt(t.def);
  // 갈림길 던전 안: 카드·정비·저주 (dungeon.js dgFx). 랭킹·결투용(base)에는 넣지 않는다
  const dg = !base && dgActive() ? dgFx() : null;
  if (dg) atk *= 1 + dg.atk;
  return {
    atk, maxHp, aspd, crit, critMult: 2.5 + (m.critMult || 0) + gb.critMult,
    kind: w.kind, range: w.range, targets: w.targets, shots: w.shots || 1, shotMult: w.shotMult || 1,
    // 받는 피해 감소: 직업·장비(최대 60%)와 방어 훈련을 곱으로 합친다 (최대 85%)
    guard: Math.min(dg ? 0.95 : 0.85, 1 - (1 - Math.min(0.6, (m.guard || 0) + gb.guard)) * (1 - defRed) * (dg ? Math.max(0.2, 1 + dg.taken) : 1)), defRed,
    heal: Math.min(0.1, (m.heal || 0) + gb.heal), skills: unlockedSkills(),
  };
}
// 지금 레벨에서 쓸 수 있는 스킬 id (먼저 쓸 순서 = 해금 레벨 높은 순)
const unlockedSkills = () => skillsOf(S.cls).filter((k) => S.level >= k.lv).reverse().map((k) => k.id);

// 스킬 숙련도 (classes.js). lv 는 1~SKILL_MAX. skillPow 는 SKILLS 배율에 곱하는 한 방 위력, skillCd 는 숙련도가 반영된 쿨타임(초)
const skillLv = (id) => skillLvOf(S.mast[mastKey(id)] || 0).lv;
const skillPow = (id) => skillPowAt(SKILLS[id], skillLv(id), S.cls);
const skillCd = (id) => skillCdOf(SKILLS[id], skillLv(id), S.cls);
// 이 스킬에 비전서를 n권까지 먹인다 (만렙에서 남는 만큼은 쓰지 않는다). { used, from, to } 또는 null
function feedTomes(id, n) {
  const k = SKILLS[id];
  if (!k || !skillsOf(S.cls).includes(k)) return null;
  const key = mastKey(id), have = S.mast[key] || 0;
  const used = Math.min(n, S.tomes, SKILL_TOME_MAX - have);
  if (used <= 0) return null;
  const from = skillLv(id);
  S.tomes -= used;
  S.mast[key] = have + used;
  return { used, from, to: skillLv(id) };
}
// 지금 가진 비전서로 레벨을 하나라도 올릴 수 있는 내 스킬이 있는가 (레드닷)
const canLevelSkill = () => skillsOf(S.cls).some((k) => {
  const s = skillLvOf(S.mast[mastKey(k.id)] || 0);
  return s.lv < SKILL_MAX && S.tomes >= s.need - s.have;
});

// 한 마리를 상대로 한 초당 피해 (연발·스킬 포함). 스킬을 쓰는 동안은 평타를 멈춘다
function dpsOf(st) {
  const perHit = st.atk * (1 + st.crit * (st.critMult - 1));
  let busy = 0, extra = 0;
  for (const id of st.skills || []) {
    const k = skillAt(id, skillLv(id));
    const cd = skillCd(id);
    busy += k.dur / cd;
    extra += (k.crit ? st.atk * st.critMult : perHit) * skillMult(k) * skillPow(id) / cd;
  }
  return perHit * st.shots * st.shotMult * st.aspd * Math.max(0.3, 1 - busy) + extra;
}
const powerOf = (st) => Math.round(Math.sqrt(dpsOf(st) * st.maxHp) * 10);

// 서버에 올리는 공개 전투 정보. 랭킹 표시와 결투 계산에 쓰인다.
function profile() {
  const st = stats(true);
  return {
    cls: S.cls, level: S.level, best: S.best, power: powerOf(st),
    atk: st.atk, maxHp: st.maxHp, aspd: st.aspd, crit: st.crit, critMult: st.critMult,
    range: st.range, shots: st.shots, shotMult: st.shotMult, guard: st.guard, heal: st.heal,
    // 결투·레이드는 서버가 계산하므로 스킬은 수치만 넘긴다 (id 는 재생할 때 연출을 고르는 데 쓴다)
    skills: st.skills.map((id) => {
      const k = skillAt(id, skillLv(id));
      return { id, lv: skillLv(id), cd: skillCd(id), dur: k.dur, mult: skillMult(k) * skillPow(id), crit: !!k.crit, ...(k.ward ? { ward: { dur: k.ward.dur, guard: k.ward.guard, heal: k.ward.heal } } : {}) };
    }),
  };
}

const maxStamina = () => maxStaminaAt(S.bld.inn);
const minDepartStamina = () => Math.ceil(maxStamina() * MIN_DEPART_RATIO);
const bagCap = () => bagCapAt(S.bld.storage);
const bagWeight = () => S.bag.reduce((a, it) => a + lootWeight(it), 0);
// 무게가 조금이라도 남아 있으면 상자를 하나 더 얹는다 (마지막 상자는 조금 넘쳐도 들고 온다)
const bagFull = () => bagWeight() >= bagCap();
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
// 골드가 되는 데까지 다음 단계가 가장 싼 훈련부터 하나씩 올린다 → 네 훈련에 드는 골드가 대충 고르게 나뉜다
function doTrainAll() {
  let n = 0;
  for (;;) {
    const u = TRAINING.filter(x => S.train[x.id] < trainMax(x) && S.gold >= trainCost(x))
      .sort((a, b) => trainCost(a) - trainCost(b))[0];
    if (!u || !doTrain(u.id)) return n;
    n++;
  }
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
  // 1차 스킬은 2차 직업이 물려받으므로 숙련도도 그대로 둔다 (classes.js skillsOf)
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

// ───────────────────────── 우편함 ─────────────────────────
// 지금 우편함에 보이는 우편 (새 것부터)
const mailList = () => MAIL.filter((m) => Date.now() >= m.at && Date.now() < m.until).sort((a, b) => b.at - a.at);
const mailGot = (m) => S.mail.got.includes(m.id);
const mailUnclaimed = () => mailList().filter((m) => !mailGot(m)).length;
// 우편 보상을 받는다. 받은 우편이면 false
function claimMail(id) {
  const m = mailList().find((x) => x.id === id);
  if (!m || mailGot(m)) return false;
  const r = m.reward || {};
  for (const [k, n] of Object.entries(r.items || {})) S.items[k] = (S.items[k] || 0) + n;
  S.gold += r.gold || 0; S.stones += r.stones || 0; S.tomes += r.tomes || 0;
  S.mail.got.push(m.id);
  return true;
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
  if (S.phase === 'dungeon') return false;      // 던전에선 체력이 자원이라 물약을 못 쓴다
  const max = stats().maxHp;
  if (S.hp >= max * POTION_AT || S.items.potion <= 0) return false;
  S.items.potion--;
  S.hp = max;
  if (S.trip) S.trip.potions++;
  return true;
}

// ───────────────────────── 전리품 ─────────────────────────
// 전리품 상자 등급. 보스는 일반 등급이 안 나오고, 행운의 부적은 좋은 등급 가중치를 올린다. 내용물은 gear.js 의 openBox
// 원정 상자 등급: 영웅까지만 (전설 이상은 레이드 처치 상자에서만 나온다)
function rollGrade(boss, charm) {
  const w = GRADES.map((g, i) => (boss && i === 0 || i > EXPEDITION_GRADE_MAX ? 0 : g.w) * (charm ? CHARM_BONUS[i] : 1));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return 0;
}

// ───────────────────────── 원정 ─────────────────────────
function departBlocker() {
  if (S.phase !== 'camp') return '원정 중';
  if (S.stamina < minDepartStamina()) return `스태미나 ${minDepartStamina()} 이상 필요`;
  if (bagFull()) return '가방이 가득 참 — 상자를 먼저 열어주세요';
  return null;
}

function startExpedition({ charm = false, elixir = false } = {}) {
  if (departBlocker()) return false;
  if (charm && S.items.charm > 0) S.items.charm--; else charm = false;
  if (elixir && S.items.elixir > 0) S.items.elixir--; else elixir = false;
  S.trip = {
    start: Date.now(), dur: 0, kills: 0, bosses: 0, gold: 0, xp: 0, levels: 0,
    stageFrom: S.stage, stageTo: S.stage, boxes: GRADES.map(() => 0),
    potions: 0, crises: 0, deaths: 0, tomes: 0, stones: 0, bossFail: false, reason: null, buffs: { charm, elixir },
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
    for (const k of ['dur', 'kills', 'bosses', 'gold', 'xp', 'levels', 'potions', 'crises', 'deaths', 'tomes', 'stones']) r[k] = (r[k] || 0) + (t[k] || 0);
    t.boxes.forEach((n, i) => { r.boxes[i] = (r.boxes[i] || 0) + n; });
    r.stageTo = t.stageTo; r.reason = t.reason; r.bossFail = r.bossFail || t.bossFail;
    r.trips = (r.trips || 1) + 1;
  } else {
    S.report = t;
  }
  if (!silent) hooks.onArrive();
}

// 몬스터 처치 보상 (실시간·오프라인 공용). 연출용 정보를 돌려준다.
// 수완 훈련의 골드·경험치 보너스, 그리고 장비(고유 효과·세트)까지 합친 획득 배율
const fortuneBonus = () => S.train.fortune * FORTUNE_PER_LV;
const goldMult = () => 1 + fortuneBonus() + gearBonus().goldPct;
const expMult = () => 1 + fortuneBonus() + gearBonus().expPct;

function rewardKill(m) {
  const t = S.trip;
  const gold = m.gold * goldMult(), exp = m.exp * expMult();
  S.gold += gold; t.gold += gold;
  t.kills++; if (m.boss) t.bosses++;
  if (m.boss) { S.stones += BOSS_STONES; t.stones = (t.stones || 0) + BOSS_STONES; }
  t.xp += exp;
  t.levels += gainExp(exp);
  let loot = null;
  if ((m.boss || Math.random() < BOX_DROP) && !bagFull()) {
    loot = { k: 'box', g: rollGrade(m.boss, t.buffs.charm), s: S.stage };
    if (m.boss) loot.boss = 1;
    S.bag.push(loot);
    t.boxes[loot.g] = (t.boxes[loot.g] || 0) + 1;
  }
  // 보스는 낮은 확률로 비전서를 떨군다 (가방 무게와 상관없이 바로 챙긴다)
  let tome = false;
  if (m.boss && Math.random() < BOSS_TOME_DROP) { S.tomes++; t.tomes = (t.tomes || 0) + 1; tome = true; }
  S.run.kills++;
  if (m.boss) S.run.cleared = true;
  return { loot, tome };
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
  if (S.phase !== 'camp' && S.phase !== 'dungeon') return;
  S.stamina = Math.min(maxStamina(), S.stamina + (maxStamina() / restSecAt(S.bld.inn)) * sec);   // 던전은 스태미나를 안 써서 그동안에도 쉰다
  if (S.phase !== 'camp') return;
  const max = stats().maxHp;
  S.hp = Math.min(max, S.hp + max * CAMP_HEAL_PER_SEC * sec);
}

// 앱이 꺼져 있었거나 절전으로 멈춘 시간을 한 번에 계산한다.
// 전투는 "걷기 + 몬스터 1마리 처치"를 한 사이클로 근사하고, 바퀴의 몬스터를 다 잡으면 다음 바퀴로 넘어간다.
function simulate(sec) {
  advanceBuild(sec);
  // 탑은 오프라인으로 진행하지 않는다: 멈춰 있던 동안(앱을 껐거나 절전) 그 층에서 끝낸 것으로 정산
  if (S.phase === 'tower') { endTower('offline'); S.phase = 'camp'; }
  if (S.phase === 'dungeon') { endDungeon('offline'); S.phase = 'camp'; }
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
    if (bagFull()) endExpedition('bag', true);
  }
  if (t > 0) advanceCamp(t);
}

const REASON_TEXT = {
  stamina: '스태미나를 모두 써서 캠프로 돌아왔습니다.',
  bag: '가방이 가득 차서 캠프로 돌아왔습니다.',
  manual: '귀환 명령을 받고 돌아왔습니다.',
};
