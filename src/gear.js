'use strict';
// 장비·전리품·강화 규칙. core.js 처럼 DOM을 모르고 S 상태만 바꾼다.
//  - 가방:        상자 { k: 'box', g, s, boss } — 캠프에서 열면 아래 전리품들이 나온다 (openBox)
//  - 전리품:      { k: 'gear', slot, g, s, t, roll } | { k: 'curio', id, g, s } | { k: 'use', id }
//  - 장비 창고:   S.gear.inv = [{ id, slot, g, s, t, roll }]   (t = GEAR_ITEMS 키, roll = 능력치 편차)
//  - 장착:        S.gear.eq = { weapon: id|null, armor, ring }
//  - 강화 단계:   S.gear.enh = { weapon: 0.., armor, ring }  — 부위에 붙어 있어서 장비를 바꿔도 유지
//  - 최고 기록:   S.gear.top = { weapon: 0.., armor, ring }  — 초기화돼도 남는 부위별 최고 강화 단계

const freshGear = () => ({
  inv: [], eq: { weapon: null, armor: null, ring: null }, enh: { weapon: 0, armor: 0, ring: 0 }, top: { weapon: 0, armor: 0, ring: 0 }, seq: 0,
  auto: true,            // 전리품을 챙길 때 더 좋은 장비를 자동 장착
});

// ───────────────────────── 전리품 뽑기 ─────────────────────────
function pickWeighted(table, wOf) {
  const ids = Object.keys(table);
  let r = Math.random() * ids.reduce((a, id) => a + wOf(id), 0);
  for (const id of ids) { r -= wOf(id); if (r <= 0) return id; }
  return ids[0];
}

// g: 등급 인덱스, s: 스테이지, boss: 보스 드랍
function rollLoot(g, s, boss) {
  const kind = pickWeighted(LOOT_KIND_W, (k) => (boss ? LOOT_KIND_W_BOSS : LOOT_KIND_W)[k]);
  if (kind === 'use') return { k: 'use', id: pickWeighted(SUPPLIES, (id) => SUPPLIES[id].w) };
  if (kind === 'curio') return { k: 'curio', id: pickWeighted(CURIOS, (id) => CURIOS[id].w), g, s };
  const slot = pickWeighted(GEAR_SLOTS, () => 1);
  const pool = gearItemsOf(slot, g);
  return {
    k: 'gear', slot, g, s,
    t: pool[Math.floor(Math.random() * pool.length)],
    roll: Math.round((0.9 + Math.random() * 0.2) * 100) / 100,
  };
}
// 레이드 고유 장비(raid)는 일반 상자에서 나오지 않는다
const gearItemsOf = (slot, g) => Object.keys(GEAR_ITEMS).filter((t) => GEAR_ITEMS[t].slot === slot && GEAR_ITEMS[t].g === g && !GEAR_ITEMS[t].raid);

// 도감이 생기기 전 장비({ n: 이름 인덱스 })나 도감에서 빠진 장비는 같은 부위·등급의 장비로 바꾼다
function fixGearItem(it) {
  if (GEAR_ITEMS[it.t] && GEAR_ITEMS[it.t].slot === it.slot) return it;
  const pool = gearItemsOf(it.slot, it.g);
  it.t = pool[(it.n || 0) % pool.length];
  delete it.n;
  return it;
}

// 상자를 연다: 첫 내용물은 상자 등급, 나머지는 한 등급 아래
function openBox(b) {
  const [lo, hi] = LOOT_BOXES[b.g].n;
  const n = lo + Math.floor(Math.random() * (hi - lo + 1));
  const out = [];
  for (let i = 0; i < n; i++) out.push(rollLoot(i === 0 ? b.g : Math.max(0, b.g - 1), b.s, !!b.boss && i === 0));
  return out;
}

// 가방 무게. 상자가 생기기 전 세이브에 남아 있는 낱개 전리품은 1
const lootWeight = (it) => (it.k === 'box' ? LOOT_BOXES[it.g].w : 1);

// 예전 세이브의 미감정 상자 { g, s } 는 같은 등급의 전리품 상자로 바꾼다
const upgradeOldLoot = (b) => (!b.k ? { k: 'box', g: b.g || 0, s: b.s || 1 } : b.k === 'gear' ? fixGearItem(b) : b);

// 전리품·상자 표시용 등급 (소비 아이템은 종류별 고정)
const lootGrade = (it) => (it.k === 'use' ? SUPPLY_GRADE[it.id] || 0 : it.g);

function lootIcon(it) {
  if (it.k === 'box') return '📦';
  if (it.k === 'gear') return GEAR_ITEMS[it.t].icon;
  if (it.k === 'curio') return CURIOS[it.id].icon;
  return SUPPLIES[it.id].icon;
}
function lootName(it) {
  if (it.k === 'box') return LOOT_BOXES[it.g].name;
  if (it.k === 'gear') return gearName(it);
  if (it.k === 'curio') return CURIOS[it.id].name;
  return SUPPLIES[it.id].name;
}

// ───────────────────────── 장비 능력치 ─────────────────────────
const gearName = (it) => GEAR_ITEMS[it.t].name;
const gearDesc = (it) => GEAR_ITEMS[it.t].desc;
const gearById = (id) => S.gear.inv.find((x) => x.id === id) || null;
const equipped = (slot) => gearById(S.gear.eq[slot]);
const isEquipped = (it) => S.gear.eq[it.slot] === it.id;

// enh: 적용할 강화 단계 (기본은 그 부위의 현재 단계)
function gearStat(it, enh = S.gear.enh[it.slot]) {
  const b = gearBase(it.slot, it.g, it.s, it.roll);
  const m = enhanceMultAt(enh), soft = softEnhMultAt(enh);
  const out = {};
  for (const k of Object.keys(b)) out[k] = b[k] * (SOFT_ENH[k] ? soft : m);
  return out;
}
// 같은 부위 장비끼리 비교하는 점수 (장신구는 치명 확률과 피해를 기대 피해 증가로 환산)
// 고유 장비의 특수 효과는 대략 그만큼 점수를 올려 준다 (골드·경험치는 전투력이 아니라 조금만)
function gearScore(it) {
  const st = gearStat(it, 0);
  const base = it.slot === 'ring' ? st.crit * 2.5 + st.critMult * 0.3 : it.slot === 'weapon' ? st.atk * (1 + st.aspdPct) : st.hp;
  const sp = GEAR_ITEMS[it.t].sp;
  if (!sp) return base;
  let k = 1;
  for (const [key, v] of Object.entries(sp)) k += key === 'heal' ? v * 10 : key === 'goldPct' || key === 'expPct' ? v * 0.3 : key === 'crit' ? v * 3 : v;
  return base * k;
}
// 고유 장비 특수 효과 글 (없으면 '')
function gearSpecialText(it) {
  const sp = GEAR_ITEMS[it.t] && GEAR_ITEMS[it.t].sp;
  return sp ? Object.entries(sp).map(([k, v]) => `${SPECIAL_STATS[k].name} ${SPECIAL_STATS[k].fmt(v)}`).join(' · ') : '';
}
function gearStatText(st) {
  if (st.atk != null) return `⚔️ +${fmt(st.atk)}${st.aspdPct ? ` · 💨 +${Math.round(st.aspdPct * 100)}%` : ''}`;
  if (st.hp != null) return `❤️ +${fmt(st.hp)}`;
  return `💥 +${(st.crit * 100).toFixed(1)}% · 피해 +${Math.round(st.critMult * 100)}%`;
}
const gearSellPrice = (it) => Math.floor(monsterStats(it.s, false).gold * GRADES[it.g].sell * it.roll);

// stats() 가 합치는 장착 장비 보너스 (고유 장비의 특수 효과 포함)
function gearBonus() {
  const out = { atk: 0, hp: 0, crit: 0, critMult: 0 };
  for (const k of Object.keys(SPECIAL_STATS)) if (!(k in out)) out[k] = 0;
  for (const slot of Object.keys(GEAR_SLOTS)) {
    const it = equipped(slot);
    if (!it) continue;
    const st = gearStat(it);
    for (const k of Object.keys(st)) out[k] += st[k];
    const sp = GEAR_ITEMS[it.t].sp;
    if (sp) for (const k of Object.keys(sp)) out[k] += sp[k];
  }
  for (const s of raidSets()) for (const t of s.tiers) if (t.on) for (const k of Object.keys(t.sp)) out[k] += t.sp[k];
  return out;
}

// ───────────────────────── 레이드 세트 ─────────────────────────
// 같은 보스의 고유 장비를 2부위·3부위 끼면 그 보스의 세트 효과(RAID_BOSSES[보스].set)가 붙는다.
// 낀 고유 장비가 있는 세트마다 { boss, n: 낀 부위 수, tiers: [{ need, sp, on }] }
function raidSets() {
  const n = {};
  for (const slot of Object.keys(GEAR_SLOTS)) {
    const it = equipped(slot), b = it && GEAR_ITEMS[it.t].raid;
    if (b) n[b] = (n[b] || 0) + 1;
  }
  return Object.keys(n).map((boss) => ({
    boss, n: n[boss],
    tiers: [2, 3].map((need) => ({ need, sp: RAID_BOSSES[boss].set[need], on: n[boss] >= need })),
  }));
}
const spText = (sp) => Object.entries(sp).map(([k, v]) => `${SPECIAL_STATS[k].name} ${SPECIAL_STATS[k].fmt(v)}`).join(' · ');
// 세트 효과 설명 (지금 낀 부위 수 기준). 레이드 장비가 아니면 ''
function setText(boss) {
  const set = RAID_BOSSES[boss].set, cur = raidSets().find((x) => x.boss === boss);
  const n = cur ? cur.n : 0;
  return `🔗 ${set.name} (${n}/3) — ` + [2, 3].map((need) => `${n >= need ? '✅' : '▫️'} ${need}세트: ${spText(set[need])}`).join(' / ');
}

// ───────────────────────── 가방 → 창고 ─────────────────────────
// 상자에서 나온 전리품 1개를 챙긴다: 장비는 창고로(자동 장착이 켜져 있으면 더 좋은 걸 바로 낌), 골동품은 팔아서 재화로, 소비 아이템은 보급품으로.
// 받은 재화와, 장비였으면 창고에서의 id(gearId)를 돌려준다
function claimLoot(it) {
  const got = { gold: 0, wood: 0, ore: 0, mana: 0 };
  if (it.k === 'gear') {
    const { k, ...g } = it;
    got.gearId = ++S.gear.seq;
    S.gear.inv.push({ id: got.gearId, ...g });
    if (S.gear.auto) autoEquip();
  } else if (it.k === 'curio') {
    const c = CURIOS[it.id];
    const jitter = 0.8 + Math.random() * 0.4;
    const scale = c.res === 'gold' ? monsterStats(it.s, false).gold : 1 + (it.s - 1) * 0.04;
    got[c.res] = Math.max(1, Math.round(c.amt * GRADES[it.g].res * scale * jitter));
    S.gold += got.gold;
    S.mats.wood += got.wood; S.mats.ore += got.ore; S.mats.mana += got.mana;
  } else {
    S.items[it.id] = (S.items[it.id] || 0) + 1;
  }
  return got;
}

// ───────────────────────── 장착 / 판매 ─────────────────────────
function equipGear(id) {
  const it = gearById(id);
  if (!it) return false;
  const oldMax = stats().maxHp;
  S.gear.eq[it.slot] = id;
  keepHpRatio(oldMax);
  return true;
}
// 부위마다 창고에서 가장 좋은 장비를 낀다. 바뀐 부위 수를 돌려준다
function autoEquip() {
  const oldMax = stats().maxHp;
  let changed = 0;
  for (const slot of Object.keys(GEAR_SLOTS)) {
    const best = S.gear.inv.filter((x) => x.slot === slot).sort((a, b) => gearScore(b) - gearScore(a))[0];
    if (best && S.gear.eq[slot] !== best.id) { S.gear.eq[slot] = best.id; changed++; }
  }
  keepHpRatio(oldMax);
  return changed;
}
// 갑옷을 바꿔 최대 체력이 변해도 체력 비율은 그대로
function keepHpRatio(oldMax) {
  const max = stats().maxHp;
  if (S.hp != null && oldMax > 0) S.hp = Math.min(max, (S.hp / oldMax) * max);
}

function sellGear(list) {
  const ids = new Set(list.filter((x) => !isEquipped(x)).map((x) => x.id));
  let gold = 0;
  S.gear.inv = S.gear.inv.filter((x) => {
    if (!ids.has(x.id)) return true;
    gold += gearSellPrice(x);
    return false;
  });
  S.gold += gold;
  return { n: ids.size, gold };
}

// ───────────────────────── 강화 ─────────────────────────
const enhanceCostOf = (slot) => enhanceCost(S.gear.enh[slot], S.best);
function enhanceBlocker(slot) {
  const L = S.gear.enh[slot];
  if (L >= ENHANCE_MAX) return '최대 강화';
  if (S.phase !== 'camp') return '캠프에서만 강화할 수 있어요';
  const c = enhanceCostOf(slot);
  if (S.gold < c.gold) return '골드 부족';
  if (S.mats.ore < c.ore) return '철광석 부족';
  if (S.mats.mana < c.mana) return '마력석 부족';
  return '';
}
// 결과: { result: 'up'|'keep'|'down'|'reset'|'saved', from, to }
// protect=true 면 하락·초기화가 나왔을 때 보호 주문서가 대신 부서진다 ('saved')
function enhance(slot, protect = false) {
  if (enhanceBlocker(slot)) return null;
  const from = S.gear.enh[slot];
  const e = ENHANCE[from];
  const c = enhanceCostOf(slot);
  const oldMax = stats().maxHp;
  S.gold -= c.gold; S.mats.ore -= c.ore; S.mats.mana -= c.mana;

  let result;
  if (Math.random() < e.rate) {
    result = 'up';
  } else {
    const r = Math.random();
    result = r < e.reset ? 'reset' : r < e.reset + e.down ? 'down' : 'keep';
    if (result !== 'keep' && protect && S.items.protect > 0) { S.items.protect--; result = 'saved'; }
  }
  S.gear.enh[slot] = result === 'up' ? from + 1 : result === 'down' ? from - 1 : result === 'reset' ? 0 : from;
  S.gear.top[slot] = Math.max(S.gear.top[slot] || 0, S.gear.enh[slot]);
  keepHpRatio(oldMax);
  return { result, from, to: S.gear.enh[slot] };
}
