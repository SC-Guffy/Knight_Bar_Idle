'use strict';
// 장비·전리품·강화 규칙. core.js 처럼 DOM을 모르고 S 상태만 바꾼다.
//  - 가방:        상자 { k: 'box', g, s, boss } — 캠프에서 열면 아래 전리품들이 나온다 (openBox)
//  - 전리품:      { k: 'gear', slot, g, s, t, roll } | { k: 'curio', id, g, s } | { k: 'use', id }
//  - 장비 창고:   S.gear.inv = [{ id, slot, g, s, t, roll, en? }]   (t = GEAR_ITEMS 키, roll = 능력치 편차, en = 마법부여 옵션 { k, v })
//  - 장착:        S.gear.eq = { weapon: id|null, armor, ring }
//  - 강화 단계:   S.gear.enh = { weapon: 0.., armor, ring }  — 부위에 붙어 있어서 장비를 바꿔도 유지
//  - 기본 위력:   무기·갑옷은 착용한 기사의 레벨을 따라 커진다 (gearLvOf). 장비의 s 는 판매가에만 쓴다
//  - 최고 기록:   S.gear.top = { weapon: 0.., armor, ring }  — 초기화돼도 남는 부위별 최고 강화 단계

const freshGear = () => ({
  inv: [], eq: { weapon: null, armor: null, ring: null }, enh: { weapon: 0, armor: 0, ring: 0 }, top: { weapon: 0, armor: 0, ring: 0 }, seq: 0,
  auto: true,            // 전리품을 챙길 때 더 좋은 장비를 자동 장착
  sellG: SELL_FILTER_DEFAULT.slice(),   // 일괄 판매에 넣을 등급
  sellSet: false,                        // 세트 장비도 일괄 판매에 넣을지 (기본은 뺀다)
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
  if (GEAR_ITEMS[it.t] && GEAR_ITEMS[it.t].slot === it.slot) {
    // 고유 장비는 도감 등급을 따른다 (등급이 조정된 고유 장비도 새 등급으로)
    if (GEAR_ITEMS[it.t].raid) it.g = GEAR_ITEMS[it.t].g;
    return it;
  }
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

// 세트 장비 = 레이드 보스 고유 장비. 화면에서는 원래 등급 대신 '세트' 등급으로 보이고 일괄 판매에서 빠진다
const isSetGear = (it) => !!(it && it.t && GEAR_ITEMS[it.t] && GEAR_ITEMS[it.t].raid);
const gearGrade = (it) => (isSetGear(it) ? SET_GRADE : GRADES[it.g]);
const lootColor = (it) => (it.k === 'gear' || it.k == null ? gearGrade(it) : GRADES[lootGrade(it)]).color;
// 이름 글자 효과 클래스 (세트는 전용 효과)
const gnClass = (it) => (isSetGear(it) ? 'gn gs' : `gn g${it.g}`);
// '전설 무기' / '슬라임 왕가 세트 무기'
const gearKindText = (it) => (isSetGear(it) ? `${RAID_BOSSES[GEAR_ITEMS[it.t].raid].set.name} 세트` : GRADES[it.g].name) + ' ' + GEAR_SLOTS[it.slot].name;

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

// 무기·갑옷 기본 위력 레벨 = 기사 레벨 (모든 장비가 같은 레벨 → 같은 부위는 등급이 곧 서열). 장신구는 레벨 없음 → 1
const gearLvOf = (slot) => (slot === 'ring' ? 1 : S.level);
// enh·lvl: 적용할 강화 단계·위력 레벨 (기본은 지금 값). 능력치는 위력 레벨·등급·roll 로 정해진다
function gearStat(it, enh = S.gear.enh[it.slot], lvl = gearLvOf(it.slot)) {
  const b = gearBase(it.slot, it.g, it.roll, lvl);
  const m = enhanceMultAt(enh), soft = softEnhMultAt(enh);
  const out = {};
  for (const k of Object.keys(b)) out[k] = b[k] * (SOFT_ENH[k] ? soft : m);
  return out;
}
// 같은 부위 장비끼리 비교하는 점수 (장신구는 치명 확률과 피해를 기대 피해 증가로 환산)
// 고유 장비의 특수 효과와 마법부여 옵션은 대략 그만큼 점수를 올려 준다 (골드·경험치는 전투력이 아니라 조금만)
function gearScore(it) {
  const st = gearStat(it, 0);
  const base = it.slot === 'ring' ? st.crit * 2.5 + st.critMult * 0.3 : it.slot === 'weapon' ? st.atk * (1 + st.aspdPct) : st.hp;
  const sp = { ...(GEAR_ITEMS[it.t].sp || {}) };
  if (it.en) sp[it.en.k] = (sp[it.en.k] || 0) + it.en.v;
  let k = 1;
  for (const [key, v] of Object.entries(sp)) k += key === 'heal' ? v * 10 : key === 'goldPct' || key === 'expPct' ? v * 0.3 : key === 'crit' ? v * 3 : v;
  return base * k;
}
// 고유 장비 특수 효과 글 (없으면 '')
function gearSpecialText(it) {
  const sp = GEAR_ITEMS[it.t] && GEAR_ITEMS[it.t].sp;
  return sp ? Object.entries(sp).map(([k, v]) => `${SPECIAL_STATS[k].name} ${SPECIAL_STATS[k].fmt(v)}`).join(' · ') : '';
}
// 마법부여 옵션 글 (없으면 '')
const gearEnchantText = (it) => (it && it.en && SPECIAL_STATS[it.en.k] ? `${SPECIAL_STATS[it.en.k].name} ${SPECIAL_STATS[it.en.k].fmt(it.en.v)}` : '');
function gearStatText(st) {
  if (st.atk != null) return `⚔️ ${fmt(st.atk)}${st.aspdPct ? ` · 💨 +${Math.round(st.aspdPct * 100)}%` : ''}`;
  if (st.hp != null) return `❤️ ${fmt(st.hp)}`;
  return `💥 +${(st.crit * 100).toFixed(1)}% · 피해 +${Math.round(st.critMult * 100)}%`;
}
// 장비를 팔면 골드와 함께 💠 강화석이 나온다 (등급별 고정)
const gearSellStones = (it) => Math.floor(GEAR_STONES[it.g] * salvageMultAt(forgeFacLv('salvage')));
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
    if (it.en && it.en.k in out) out[it.en.k] += it.en.v;
  }
  for (const s of raidSets()) for (const t of s.tiers) if (t.on) for (const k of Object.keys(t.sp)) out[k] += t.sp[k];
  return out;
}

// 장착 장비·세트가 stats() 에 더하는 양을 출처별로 나눈 것 (상태창 툴팁용). [{ name, st: { atk?, hp?, crit?, …, atkPct?, goldPct? … } }]
function gearBonusParts() {
  const parts = [];
  for (const slot of Object.keys(GEAR_SLOTS)) {
    const it = equipped(slot);
    if (!it) continue;
    parts.push({ name: `${GEAR_SLOTS[slot].icon} ${gearName(it)} +${S.gear.enh[slot]}`, st: gearStat(it) });
    const sp = GEAR_ITEMS[it.t].sp;
    if (sp) parts.push({ name: `✦ ${gearName(it)} 고유 효과`, st: { ...sp } });
    if (it.en) parts.push({ name: `✨ ${GEAR_SLOTS[slot].name} 마법부여`, st: { [it.en.k]: it.en.v } });
  }
  for (const s of raidSets()) for (const t of s.tiers) if (t.on) parts.push({ name: `🔗 ${RAID_BOSSES[s.boss].set.name} 세트 ${t.need}부위`, st: { ...t.sp } });
  return parts;
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
// ───────────────────────── 자동 장착 (세트 고려) ─────────────────────────
// 장비 조합의 전투 가치: 초당 피해 × 버틸 수 있는 체력(받는 피해 감소·타격 회복 반영).
// 세트 효과·고유 효과·공속·치명이 모두 stats() 에 들어 있으므로 실제로 끼워 보고 잰다.
function loadoutValue(eq) {
  const keep = S.gear.eq;
  S.gear.eq = eq;
  const st = stats(true);
  S.gear.eq = keep;
  return dpsOf(st) * st.maxHp / (1 - st.guard) * (1 + st.heal * st.aspd * 5);
}

// 가장 강한 장비 조합 { weapon, armor, ring }. 부위마다 후보를 추려 모든 조합을 비교한다:
// 일반 장비는 부위별 점수 상위 2개, 세트 장비는 보스(세트)마다 그 부위에서 가장 좋은 것 1개
let loadoutCache = { key: '', eq: null };
function bestLoadout() {
  // 창고 내용·강화·직업·훈련이 같으면 지난 계산을 그대로 쓴다 (탭 배지 때문에 화면을 그릴 때마다 불린다)
  const key = S.gear.inv.map((x) => `${x.id}${x.t}${x.s}${x.g}${x.roll}${x.en ? x.en.k + x.en.v : ''}`).join() + `|${S.cls}|${JSON.stringify(S.gear.enh)}|${S.level}|${JSON.stringify(S.train)}`;
  if (loadoutCache.key === key) return loadoutCache.eq;
  const slots = Object.keys(GEAR_SLOTS);
  const cands = slots.map((slot) => {
    const items = S.gear.inv.filter((x) => x.slot === slot).sort((a, b) => gearScore(b) - gearScore(a));
    const pick = items.filter((x) => !isSetGear(x)).slice(0, 2);
    const seen = new Set();
    for (const x of items) {
      const b = isSetGear(x) && GEAR_ITEMS[x.t].raid;
      if (b && !seen.has(b)) { seen.add(b); pick.push(x); }
    }
    return pick.length ? pick.map((x) => x.id) : [null];
  });
  // 지금 조합보다 확실히 좋을 때만 바꾼다 (같으면 그대로)
  let best = { ...S.gear.eq }, bestV = loadoutValue(best) * 1.0001;
  for (const w of cands[0]) for (const a of cands[1]) for (const r of cands[2]) {
    const eq = { [slots[0]]: w, [slots[1]]: a, [slots[2]]: r };
    const v = loadoutValue(eq);
    if (v > bestV) { best = eq; bestV = v; }
  }
  loadoutCache = { key, eq: best };
  return best;
}

// 이 장비로 바꿔 끼면 전투력(√전투 가치)이 얼마나 변하는지 (0.05 = +5%)
function swapGain(it) {
  const cur = loadoutValue({ ...S.gear.eq }), next = loadoutValue({ ...S.gear.eq, [it.slot]: it.id });
  return cur > 0 ? Math.sqrt(next / cur) - 1 : 1;
}

// 가장 강한 조합으로 바꿔 낀다. 바뀐 부위 수를 돌려준다
function autoEquip() {
  const oldMax = stats().maxHp;
  const best = bestLoadout();
  let changed = 0;
  for (const slot of Object.keys(GEAR_SLOTS)) {
    if (best[slot] != null && S.gear.eq[slot] !== best[slot]) { S.gear.eq[slot] = best[slot]; changed++; }
  }
  keepHpRatio(oldMax);
  return changed;
}
// 갑옷을 바꿔 최대 체력이 변해도 체력 비율은 그대로
function keepHpRatio(oldMax) {
  const max = stats().maxHp;
  if (S.hp != null && oldMax > 0) S.hp = Math.min(max, (S.hp / oldMax) * max);
}

// 일괄 판매 목록: 착용 중이 아니고, 세트 장비는 세트 칩(S.gear.sellSet)으로, 나머지는 등급 칩(S.gear.sellG)으로 고른다
function bulkSellList() {
  const f = S.gear.sellG || SELL_FILTER_DEFAULT;
  return S.gear.inv.filter((x) => !isEquipped(x) && (isSetGear(x) ? S.gear.sellSet : f[x.g]));
}
function sellGear(list) {
  const ids = new Set(list.filter((x) => !isEquipped(x)).map((x) => x.id));
  let gold = 0, stones = 0;
  S.gear.inv = S.gear.inv.filter((x) => {
    if (!ids.has(x.id)) return true;
    gold += gearSellPrice(x); stones += gearSellStones(x);
    return false;
  });
  S.gold += gold; S.stones += stones;
  return { n: ids.size, gold, stones };
}

// ───────────────────────── 강화 ─────────────────────────
const enhanceCostOf = (slot) => enhanceCost(S.gear.enh[slot]);
function enhanceBlocker(slot) {
  const L = S.gear.enh[slot];
  if (L >= ENHANCE_MAX) return '최대 강화';
  if (S.phase !== 'camp') return '캠프에서만 강화할 수 있어요';
  const c = enhanceCostOf(slot);
  if (S.stones < c.stone) return '강화석 부족';
  if (S.mats.ore < c.ore) return '철광석 부족';
  if (S.mats.mana < c.mana) return '마력석 부족';
  return '';
}
// 지금 바로 강화할 수 있는가 (레드닷)
const canEnhance = (slot) => !enhanceBlocker(slot);
// 이 단계에서 실패하면 하락·초기화가 나올 수 있는가 (보호 주문서를 쓸 수 있는 단계)
const enhRisky = (L) => !!(ENHANCE[L] && (ENHANCE[L].down || ENHANCE[L].reset));
// 결과: { result: 'up'|'keep'|'down'|'reset'|'saved', from, to, used }
// protect=true 면 결과와 상관없이 보호 주문서를 1장 쓰고(used), 하락·초기화가 나오면 막아 준다 ('saved').
// 실패해도 유지되는 단계(+0~+4 → +5)에선 쓸 일이 없어서 소모하지 않는다
function enhance(slot, protect = false) {
  if (enhanceBlocker(slot)) return null;
  const from = S.gear.enh[slot];
  const e = ENHANCE[from];
  const c = enhanceCostOf(slot);
  const oldMax = stats().maxHp;
  S.stones -= c.stone; S.mats.ore -= c.ore; S.mats.mana -= c.mana;
  const used = protect && S.items.protect > 0 && enhRisky(from);
  if (used) S.items.protect--;

  let result;
  if (Math.random() < e.rate) {
    result = 'up';
  } else {
    const r = Math.random();
    result = r < e.reset ? 'reset' : r < e.reset + e.down ? 'down' : 'keep';
    if (result !== 'keep' && used) result = 'saved';
  }
  S.gear.enh[slot] = result === 'up' ? from + 1 : result === 'down' ? from - 1 : result === 'reset' ? 0 : from;
  S.gear.top[slot] = Math.max(S.gear.top[slot] || 0, S.gear.enh[slot]);
  keepHpRatio(oldMax);
  return { result, from, to: S.gear.enh[slot], used };
}

// ───────────────────────── 대장간 시설 · 재련 ─────────────────────────
const forgeFacLv = (id) => (S.forge && S.forge[id]) || 0;
function forgeFacBlocker(id) {
  const lv = forgeFacLv(id);
  if (lv >= S.bld.forge) return lv >= BUILD_MAX ? '최대 Lv' : '대장간 Lv 이 더 필요해요';
  if (!canAfford(forgeFacCost(id, lv))) return '재화 부족';
  return '';
}
function upgradeForgeFac(id) {
  if (!FORGE_FAC[id] || forgeFacBlocker(id)) return false;
  const c = forgeFacCost(id, forgeFacLv(id));
  S.gold -= c.gold; S.mats.ore -= c.ore; S.mats.mana -= c.mana;
  S.forge[id] = forgeFacLv(id) + 1;
  return true;
}

// ───────────────────────── 마법부여대 (부가 옵션 붙이기) ─────────────────────────
function enchantBlocker(it) {
  if (!it) return '장비를 골라 주세요';
  if (!forgeFacLv('enchant')) return '마을 대장간에서 ✨ 마법부여대를 먼저 지어야 해요';
  if (S.phase !== 'camp') return '캠프에서만 마법을 부여할 수 있어요';
  const c = enchantCost(it.g);
  if (S.stones < c.stone) return '강화석 부족';
  if (S.mats.mana < c.mana) return '마력석 부족';
  return '';
}
// 옵션을 무작위로 하나 골라 마법부여대 품질 범위에서 값을 굴려 붙인다 (이전 옵션은 사라진다). { from, to } 또는 null
function enchantGear(id) {
  const it = gearById(id);
  if (enchantBlocker(it)) return null;
  const c = enchantCost(it.g), q0 = enchantQualAt(forgeFacLv('enchant')), oldMax = stats().maxHp;
  S.stones -= c.stone; S.mats.mana -= c.mana;
  const from = it.en || null;
  const keys = Object.keys(ENCHANT_OPTS), k = keys[Math.floor(Math.random() * keys.length)];
  it.en = { k, v: enchantValueAt(k, q0 + Math.random() * (1 - q0)) };
  keepHpRatio(oldMax);
  return { from, to: it.en };
}
