'use strict';
// 시즌7 스킬 빌드 트리 — 시제품: 검사 → 검성 → 검신 한 줄기 (docs/specs/skill-tree-swordsaint.md · 방향은 docs/specs/skill-build-tree.md)
// 이 줄기 캐릭터(TREE7_CLS)는 스킬 숙련도(📖)·스킬별 트리 V2·숙련 별을 쓰지 않고, 레벨업마다 받는 🌟 포인트로 이 트리를 찍는다.
//  - 포인트 = 레벨 − 1. 노드 = 스탯 · 액티브(5칸, 칸마다 모습) · 변형(갈래마다 택1 한 쌍) · 키스톤(대가 있음) · 융합 · 궁극기 · 궁극기 변형(셋 중 하나)
//  - 전투에는 장착 칸(1~4) 의 액티브·융합 + 궁극기만 나온다 (core.js unlockedSkills 분기)
//  - 위력·쿨타임·모습·고유 특수는 core.js 의 skillPow·skillCd·skillStage·skillSpec·heroSkill 이 여기 t7* 를 부른다
//  - 1단계(규칙·수치): 연출이 필요한 변형·키스톤 일부는 평균 피해 배율(ev)로 근사한다 — 3단계 연출 때 실제 규칙으로 바꾼다 (T7_NODES 의 approx)
// 노드 배치·아이콘은 시안 dev/review/skill-build-tree.html 과 같다 (화면은 2단계에서 ui.js).
// 이 파일은 classes.js(SKILLS·CLASSES) 다음, core.js 앞에 불러온다 (freshState 가 freshT7 을 쓴다).

// 견습 기사(0차)는 넣지 않는다 — 모든 계열이 거쳐 가서, 넣으면 다른 14줄기도 바뀐다. 검사로 전직하면 그동안 쌓인 포인트(레벨 − 1)를 한꺼번에 찍는다.
// 1차 검사는 성기사·대검전사 줄기도 거쳐 가서, 시제품에선 이 줄기를 고른 캐릭터(S.t7.pick)만 켠다 — 다른 줄기는 하나도 안 바뀌게.
//  (시즌7 정식: 1차 계열 공용 줄기로 모두 켠다.) 고르는 법: 게임은 ?t7=1 (2단계 UI), 봇은 --line swordsaint
const TREE7_CLS = ['swordsman', 'blademaster', 'swordsaint'];
const t7On = (cls = S.cls) => !T7_OFF && TREE7_CLS.includes(cls) && (cls !== 'swordsman' || !!(S.t7 && S.t7.pick));
let T7_OFF = false;   // 측정용: 켜면 이 줄기도 지금 시스템 (dev/lifespan-bot.js --old 1)
const T7_PICK_URL = typeof location !== 'undefined' && /[?&]t7=1(&|$)/.test(location.search || '');   // 게임 주소 ?t7=1 → 이 캐릭터를 시제품 줄기로 (core.js loadState)

// 종류별 비용·최대 칸 (스펙 "노드 종류·비용")
const T7_SPEC = {
  stat: { cost: 1, max: 3 }, active: { cost: 2, max: 5 }, mod: { cost: 4, max: 1 }, key: { cost: 7, max: 1 },
  ult: { cost: 2, max: 5 }, fusion: { cost: 4, max: 3 }, uvar: { cost: 6, max: 1 },
};
// 액티브·궁극기 칸 → 위력·쿨 배수, 융합 칸 → 배수
const T7_RANK = { pow: 0.15, cd: 0.06 }, T7_FUSE = { pow: 0.25, cd: 0.08 };
// 전체 위력 눈금: 트리 스킬 위력 × T7_TUNE.pow (봇으로 지금 시스템과 진행 속도를 맞춘 값, docs/specs/skill-tree-swordsaint.md 진행 기록)
const T7_TUNE = { pow: 0.4 };
// 칸 → 숙련 모습 단계 (1칸 0 · 2·3칸 ★ · 4칸 ★★ · 5칸 ★★★)
const T7_STAGE_AT = [0, 0, 1, 1, 2, 3];

// 노드: id, t 종류, lane (c 줄기 / a 연타 / b 발도 / k 검기), tier 필요 전직 차수, req 앞 노드(하나라도), min 그 갈래 포인트 하한,
//  sk 액티브·융합·궁극기가 가리키는 SKILLS id, lanes 융합이 요구하는 두 갈래, pair 같은 값끼리 택1,
//  fx 효과 (아래 t7Mods 가 읽는다): { stat:{키:칸당}, pow:{스킬:배}, cd:{스킬:배}, ev:{스킬:배} 결투·전투력 평균 배율, spec:{스킬:{type,v,…}}, shape:이름,
//     rule:이름 (전투 규칙 — src/tree7-fx.js t7OnHit·t7OnEnd·t7OnBasic), basic: 평타 피해 배율, basicDps: 평타 DPS 평균 배율(dpsOf), evAll: 모든 스킬 평균 배율,
//     duel: 결투에서만 공격력 배율 (1:1·6~7초 첫 폭딜 싸움이라 광역·쿨 줄이기 갈래가 손해 — server/duel.js 가 profile.duel 을 곱한다. 레이드·원정은 그대로) }
const T7_NODES = [
  { id: 'c_atk', t: 'stat', lane: 'c', tier: 0, req: [], fx: { stat: { atk: 0.02 } } },
  { id: 'c_hp', t: 'stat', lane: 'c', tier: 0, req: [], fx: { stat: { hp: 0.03 } } },
  { id: 'c_spd', t: 'stat', lane: 'c', tier: 0, req: ['c_atk'], fx: { stat: { aspd: 0.02 } } },
  { id: 'c_crit', t: 'stat', lane: 'c', tier: 0, req: ['c_hp'], fx: { stat: { crit: 0.015 } } },
  { id: 'c_def', t: 'stat', lane: 'c', tier: 0, req: ['c_hp'], fx: { stat: { guard: 0.02 } } },
  { id: 'slash', t: 'active', lane: 'c', tier: 1, req: ['c_atk', 'c_hp'], sk: 'steelCleave' },
  { id: 's_twin', t: 'mod', lane: 'c', tier: 1, req: ['slash'], fx: { shape: 'twin' } },
  { id: 'k_blade', t: 'key', lane: 'c', tier: 1, req: ['slash'], fx: { rule: 'blade', powAll: 0.9, evAll: 1.18 } },   // 평타 3타마다 모든 스킬 쿨 −0.5초 (t7OnBasic)

  { id: 'gale', t: 'active', lane: 'a', tier: 2, req: ['slash'], sk: 'gale' },
  { id: 'a_more', t: 'mod', lane: 'a', tier: 2, req: ['gale'], fx: { shape: 'more' } },
  { id: 'a_bleed', t: 'mod', lane: 'a', tier: 2, req: ['gale'], fx: { spec: { gale: { type: 'dot', name: '출혈', icon: '🩸', v: 0.4, dur: 3 } } } },
  { id: 'whirl', t: 'active', lane: 'a', tier: 2, req: ['a_more', 'a_bleed'], sk: 'whirl' },
  { id: 'a_follow', t: 'mod', lane: 'a', tier: 2, req: ['whirl'], pair: 'pa', fx: { shape: 'follow' } },   // 회오리가 적에게 날아가 붙는다 (범위 +60px, 연출은 tree7-fx)
  { id: 'a_grow', t: 'mod', lane: 'a', tier: 2, req: ['whirl'], pair: 'pa', fx: { shape: 'grow', ev: { whirl: 1.1 } } },
  { id: 'a_key', t: 'key', lane: 'a', tier: 2, req: ['a_follow', 'a_grow'], fx: { rule: 'frenzy', basic: 0.85, basicDps: 1.02 } },   // 스킬 명중마다 공속 +4% 겹침(최대 10, 3초) · 평타 피해 −15%
  { id: 'a_k3', t: 'key', lane: 'a', tier: 3, min: 12, req: ['a_key'], fx: { rule: 'endless', ev: { gale: 1.3 }, cd: { gale: 1.25 } } },   // 질풍난무가 끝나면 30% 로 바로 한 번 더
  { id: 'uv_a', t: 'uvar', lane: 'a', tier: 3, req: ['ult'], fx: { shape: 'uvA', ev: { thousandCuts: 1.05 }, duel: 1.2 } },

  { id: 'iaido', t: 'active', lane: 'b', tier: 2, req: ['slash'], sk: 'iaido' },
  { id: 'b_reset', t: 'mod', lane: 'b', tier: 2, req: ['iaido'], fx: { rule: 'echo', ev: { iaido: 1.2 } } },   // 일섬으로 처치하면 잔상이 가장 가까운 적을 50% 로
  { id: 'b_exec', t: 'mod', lane: 'b', tier: 2, req: ['iaido'], fx: { spec: { iaido: { type: 'exec', name: '처형', icon: '🗡️', v: 1.0, thr: 0.25 } } } },
  { id: 'flash', t: 'active', lane: 'b', tier: 2, req: ['b_reset', 'b_exec'], sk: 'flash' },
  { id: 'b_after', t: 'mod', lane: 'b', tier: 2, req: ['flash'], pair: 'pb', fx: { shape: 'after' } },
  { id: 'b_triple', t: 'mod', lane: 'b', tier: 2, req: ['flash'], pair: 'pb', fx: { shape: 'triple' } },
  { id: 'b_key', t: 'key', lane: 'b', tier: 2, req: ['b_after', 'b_triple'], fx: { pow: { iaido: 1.17, flash: 1.17 }, cd: { iaido: 1.3, flash: 1.3 } } },
  { id: 'b_k3', t: 'key', lane: 'b', tier: 3, min: 12, req: ['b_key'], fx: { stat: { atkMul: 2.6, noCrit: 1 } } },   // 모든 피해 ×2.6 (봇: 2.3 이면 발도 빌드가 10일차 240 에 멈춤), 치명 0 (확정 치명 스킬도 일반타 — t7NoCrit). 1.35 는 확정 치명 3.3배를 잃는 값을 못 메워 0.6배 손해였다
  { id: 'uv_b', t: 'uvar', lane: 'b', tier: 3, req: ['ult'], fx: { shape: 'uvB', pow: { thousandCuts: 1.2 }, duel: 0.95 } },

  { id: 'wave', t: 'active', lane: 'k', tier: 2, req: ['slash'], sk: 'wave' },
  { id: 'k_wave', t: 'mod', lane: 'k', tier: 2, req: ['wave'], fx: { shape: 'slashWave' } },
  { id: 'k_pierce', t: 'mod', lane: 'k', tier: 2, req: ['wave'], fx: { shape: 'pierce' } },   // 비검이 첫 적에서 멈추지 않고 줄로 뚫는다 · 검기 폭풍 범위 +20%
  { id: 'storm', t: 'active', lane: 'k', tier: 2, req: ['k_wave', 'k_pierce'], sk: 'storm' },
  { id: 'k_split', t: 'mod', lane: 'k', tier: 2, req: ['storm'], pair: 'pk', fx: { shape: 'split' } },
  { id: 'k_homing', t: 'mod', lane: 'k', tier: 2, req: ['storm'], pair: 'pk', fx: { spec: { storm: { type: 'boss', name: '유도', icon: '🎯', v: 0.5 } } } },
  { id: 'k_key', t: 'key', lane: 'k', tier: 2, req: ['k_split', 'k_homing'], fx: { stat: { rangeMul: 3 }, basic: 0.8, basicDps: 0.9 } },   // 평타가 검기로 (사거리 ×3, 검기 그림) · 평타 피해 −20%
  { id: 'k_k3', t: 'key', lane: 'k', tier: 3, min: 12, req: ['k_key'], fx: { rule: 'myriad', ev: { wave: 1.25, storm: 1.25 }, powNot: { lane: 'k', v: 0.8 } } },   // 검기 스킬 명중마다 다른 검기 스킬 쿨 −0.3초
  { id: 'uv_k', t: 'uvar', lane: 'k', tier: 3, req: ['ult'], fx: { shape: 'uvK', ev: { thousandCuts: 1.1 }, duel: 1.4 } },   // duel: 결투 전용 공격력 (t7Duel — 검기는 광역·쿨 줄이기가 1:1 에서 안 먹어서 ×1.4, 연타 ×1.2, 발도 ×0.95. 맞대결 60판으로 맞춤)

  { id: 'ult', t: 'ult', lane: 'c', tier: 3, req: ['slash'], sk: 'thousandCuts' },
  { id: 'f_ab', t: 'fusion', lanes: ['a', 'b'], tier: 2, req: [], sk: 'f_ab' },
  { id: 'f_bk', t: 'fusion', lanes: ['b', 'k'], tier: 2, req: [], sk: 'f_bk' },
  { id: 'f_ak', t: 'fusion', lanes: ['a', 'k'], tier: 2, req: [], sk: 'f_ak' },
];
const T7_BY = Object.fromEntries(T7_NODES.map((n) => [n.id, n]));
const T7_BY_SKILL = Object.fromEntries(T7_NODES.filter((n) => n.sk).map((n) => [n.sk, n]));
// 스킬 → 갈래 (만검귀종처럼 "검기 스킬" 을 가리는 데)
const t7LaneOf = (sk) => (T7_BY_SKILL[sk] ? T7_BY_SKILL[sk].lane || null : null);

// 장착 칸: [필요 레벨, 필요 차수, 비용 종류, 값 or 함수]
const T7_SLOTS = [null, null, { tier: 2, lv: 50, gold: 300 }, { lv: 80, mana: 300 }, { lv: 120, mana: 1500 }];
const T7_RESET_GOLD = 100;   // 전체 초기화 = 최고 스테이지 잡몹 골드 × 100 (원정 약 20분)

function freshT7() { return { pick: T7_PICK_URL, rk: {}, eq: [], slots: 1, use: {}, camp: {} }; }   // pick: 1차 검사 단계부터 시제품 트리를 쓴다   // camp: 이번 캠프에서 새로 찍은 칸 (무료 되돌리기)
const t7S = () => S.t7 || (S.t7 = freshT7());
const t7Rank = (id) => t7S().rk[id] || 0;
const t7Pts = () => Math.max(0, S.level - 1);
const t7Spent = () => T7_NODES.reduce((a, n) => a + t7Rank(n.id) * T7_SPEC[n.t].cost, 0);
const t7Left = () => t7Pts() - t7Spent();
const t7LanePts = (l) => T7_NODES.reduce((a, n) => a + (n.lane === l && n.t !== 'fusion' ? t7Rank(n.id) * T7_SPEC[n.t].cost : 0), 0);
const t7Tier = () => (CLASSES[S.cls] ? CLASSES[S.cls].tier : 0);
const t7PairTaken = (n) => n.pair && T7_NODES.some((x) => x.pair === n.pair && x.id !== n.id && t7Rank(x.id) > 0);
// 규칙상 열려 있는지 (포인트와 상관없이)
function t7Open(n) {
  if (typeof n === 'string') n = T7_BY[n];
  if (!n || t7Tier() < n.tier) return false;
  if (n.t === 'fusion') return n.lanes.every((l) => t7LanePts(l) >= 6);
  if (n.t === 'uvar' && T7_NODES.some((x) => x.t === 'uvar' && x.id !== n.id && t7Rank(x.id) > 0)) return false;
  if (t7PairTaken(n)) return false;
  if (n.min && t7LanePts(n.lane) - t7Rank(n.id) * T7_SPEC[n.t].cost < n.min) return false;
  return !n.req.length || n.req.some((r) => t7Rank(r) > 0);
}
const t7CanAdd = (id) => { const n = T7_BY[id]; return !!n && t7On() && t7Open(n) && t7Rank(id) < T7_SPEC[n.t].max && t7Left() >= T7_SPEC[n.t].cost; };
const t7Valid = () => T7_NODES.every((n) => !(t7Rank(n.id) > 0) || t7Open(n)) && t7Spent() <= t7Pts();
// 한 칸 찍기. 새 액티브·융합이면 빈 칸에 자동 장착
function t7Add(id) {
  if (!t7CanAdd(id)) return false;
  const s = t7S(), n = T7_BY[id];
  s.rk[id] = (s.rk[id] || 0) + 1;
  s.camp[id] = (s.camp[id] || 0) + 1;
  if ((n.t === 'active' || n.t === 'fusion') && s.rk[id] === 1 && s.eq.length < t7Slots() && !s.eq.includes(n.sk)) s.eq.push(n.sk);
  return true;
}
// 이번 캠프에서 새로 찍은 칸만 무료로 되돌린다 (다른 노드가 기대고 있으면 못 뺀다)
function t7Undo(id) {
  const s = t7S(), n = T7_BY[id];
  if (!n || !(s.camp[id] > 0)) return false;
  s.rk[id]--; s.camp[id]--;
  if (!t7Valid()) { s.rk[id]++; s.camp[id]++; return false; }
  if (!s.rk[id]) { delete s.rk[id]; if (n.sk) s.eq = s.eq.filter((x) => x !== n.sk); }
  return true;
}
const t7ResetCost = () => Math.ceil(monsterStats(Math.max(1, S.best), false).gold * T7_RESET_GOLD);
// 전체 초기화 (캠프에서, 골드). 쓴 포인트는 전부 돌아온다
function t7Reset() {
  if (S.phase !== 'camp' || !t7Spent()) return false;
  const c = t7ResetCost();
  if (S.gold < c) return false;
  S.gold -= c;
  const s = t7S();
  s.rk = {}; s.eq = []; s.use = {}; s.camp = {};
  return true;
}
// 원정을 떠나면 "이번 캠프" 가 끝난다
const t7EndCamp = () => { if (S.t7) S.t7.camp = {}; };

// ── 장착 칸 ──
const t7Slots = () => t7S().slots || 1;
// 다음 칸을 여는 데 모자란 것 (문자열) 또는 null. 비용은 { gold | mana }
function t7SlotNeed() {
  const n = t7Slots() + 1, r = T7_SLOTS[n];
  if (!r) return '최대';
  if (r.tier && t7Tier() < r.tier) return '2차 전직 필요';
  if (S.level < r.lv) return `Lv ${r.lv} 필요`;
  const c = t7SlotCost();
  if (c.gold && S.gold < c.gold) return '골드 부족';
  if (c.mana && S.mats.mana < c.mana) return '마력석 부족';
  return null;
}
function t7SlotCost() {
  const r = T7_SLOTS[t7Slots() + 1];
  if (!r) return {};
  return r.gold ? { gold: Math.ceil(monsterStats(Math.max(1, S.best), false).gold * r.gold) } : { mana: r.mana };
}
function t7BuySlot() {
  if (t7SlotNeed()) return false;
  const c = t7SlotCost();
  if (c.gold) S.gold -= c.gold;
  if (c.mana) S.mats.mana -= c.mana;
  t7S().slots++;
  // 배운 액티브가 칸을 기다리고 있으면 바로 채운다
  const s = t7S();
  for (const n of T7_NODES) if ((n.t === 'active' || n.t === 'fusion') && t7Rank(n.id) > 0 && !s.eq.includes(n.sk) && s.eq.length < s.slots) s.eq.push(n.sk);
  return true;
}
// 장착/해제 (캠프 아무 때나, 무료). 순서 = 시전 순서
function t7Equip(sk) {
  const s = t7S(), n = T7_BY_SKILL[sk];
  if (!n || n.t === 'ult' || !(t7Rank(n.id) > 0)) return false;
  if (s.eq.includes(sk)) { s.eq = s.eq.filter((x) => x !== sk); return true; }
  if (s.eq.length >= t7Slots()) return false;
  s.eq.push(sk);
  return true;
}
// 전투에 나오는 스킬 (장착 순서 + 궁극기). core.js unlockedSkills 가 부른다
function t7Skills() {
  const s = t7S(), out = s.eq.filter((sk) => T7_BY_SKILL[sk] && t7Rank(T7_BY_SKILL[sk].id) > 0).slice(0, t7Slots());
  if (t7Rank('ult') > 0 && t7Tier() >= 3) out.unshift('thousandCuts');   // 궁극기는 맨 앞 (쿨이 길어 먼저 쓰는 게 이득)
  return out;
}

// ── 효과 ──
// 찍은 노드의 효과를 모은다 (캐시: 찍은 상태가 바뀌면 다시)
let t7ModsKey = '', t7ModsVal = null;
function t7Mods() {
  const key = JSON.stringify(t7S().rk) + S.cls;
  if (key === t7ModsKey) return t7ModsVal;
  const m = { stat: {}, pow: {}, cd: {}, ev: {}, spec: {}, shape: new Set(), rules: new Set(), cdAll: 1, powAll: 1, evAll: 1, basic: 1, basicDps: 1, duel: 1, powNot: [] };
  for (const n of T7_NODES) {
    const r = t7Rank(n.id), f = n.fx;
    if (!r || !f) continue;
    if (f.stat) for (const k in f.stat) m.stat[k] = k === 'atkMul' ? (m.stat[k] || 1) * f.stat[k] : (m.stat[k] || 0) + f.stat[k] * r;
    for (const g of ['pow', 'cd', 'ev']) if (f[g]) for (const sk in f[g]) m[g][sk] = (m[g][sk] || 1) * f[g][sk];
    if (f.spec) Object.assign(m.spec, f.spec);
    if (f.shape) m.shape.add(f.shape);
    if (f.rule) m.rules.add(f.rule);
    for (const g of ['evAll', 'basic', 'basicDps', 'duel']) if (f[g]) m[g] *= f[g];
    if (f.cdAll) m.cdAll *= f.cdAll;
    if (f.powAll) m.powAll *= f.powAll;
    if (f.powNot) m.powNot.push(f.powNot);
  }
  t7ModsKey = key; t7ModsVal = m;
  return m;
}
// stats() 보정: 공격 % · 체력 % · 공속 % · 치명 · 받는 피해 · 키스톤 배수
function t7Stats(st) {
  const s = t7Mods().stat;
  st.atk *= (1 + (s.atk || 0)) * (s.atkMul || 1);
  st.maxHp *= 1 + (s.hp || 0);
  st.aspd *= 1 + (s.aspd || 0);
  st.crit = s.noCrit ? 0 : Math.min(0.8, st.crit + (s.crit || 0));
  if (s.guard) st.guard = Math.min(0.85, 1 - (1 - st.guard) * (1 - s.guard));
  if (s.rangeMul) st.range *= s.rangeMul;   // 심검: 평타 사거리
  return st;
}
const t7NodeOf = (sk) => T7_BY_SKILL[sk];
// 칸 수 (궁극기·융합 포함)
const t7SkillRank = (sk) => (T7_BY_SKILL[sk] ? t7Rank(T7_BY_SKILL[sk].id) : 0);
// 한 방 위력 배수 (기준 = 지금 트리 V2 0칸 값, core.js skillPow 가 곱한다)
function t7Pow(sk) {
  const n = T7_BY_SKILL[sk], r = Math.max(1, t7SkillRank(sk)), m = t7Mods(), R = n && n.t === 'fusion' ? T7_FUSE : T7_RANK;
  let p = T7_TUNE.pow * (1 + R.pow * (r - 1)) * (m.pow[sk] || 1) * m.powAll * ((SKILLS[sk] && SKILLS[sk].t7mul) || 1);
  for (const x of m.powNot) if (t7LaneOf(sk) !== x.lane) p *= x.v;
  return p;
}
// 쿨타임 배수
function t7Cd(sk) {
  const n = T7_BY_SKILL[sk], r = Math.max(1, t7SkillRank(sk)), m = t7Mods(), R = n && n.t === 'fusion' ? T7_FUSE : T7_RANK;
  return (1 - R.cd * (r - 1)) * (m.cd[sk] || 1) * m.cdAll;
}
// 모습 단계 (0~3): 칸에서 정해지고, 캠프에서 낮은 모습을 골라 쓸 수 있다 (S.t7.use)
function t7Stage(sk) {
  const max = T7_STAGE_AT[Math.min(5, t7SkillRank(sk))] || 0, use = t7S().use[sk];
  return use == null ? max : Math.max(0, Math.min(max, use));
}
// 고유 특수 (지금 SPEC_TYPES 효과 재사용) — 없으면 null
const t7Spec = (sk) => t7Mods().spec[sk] || null;
// 결투·레이드·전투력용 평균 피해 배율 (연출이 필요한 근사 효과 + 고유 특수 ev)
function t7Ev(sk) {
  const sp = t7Spec(sk);
  return (t7Mods().ev[sk] || 1) * t7Mods().evAll * (sp ? 1 + sp.v * SPEC_TYPES[sp.type].ev : 1);
}
// 전투 규칙이 켜졌는가 (src/tree7-fx.js) · 평타 피해 배율 (world.js releaseAttack) · 평타 DPS 평균 배율 (core.js dpsOf)
const t7Rule = (name) => t7On() && t7Mods().rules.has(name);
// 무념(b_k3): 치명이 전혀 안 터진다 — 확정 치명 스킬(일섬·섬광 베기·천검)도 일반타 (core.js dpsOf·profile, skills.js, world.js hitMonster)
// 결투 전용 공격력 배율 (궁극기 변형 셋 중 하나에 붙음, fx.duel). 다른 갈래 3차 키스톤까지 찍을수록 줄어든다 (트리를 거의 다 찍으면 갈래 약점이 없어져서) — 하나 1 · 둘 ½ · 셋 0
function t7Duel() {
  if (!t7On()) return 1;
  const f = t7Mods().duel, n = ['a_k3', 'b_k3', 'k_k3'].filter((id) => t7Rank(id) > 0).length;
  return 1 + (f - 1) * Math.max(0, Math.min(1, 1 - (n - 1) / 2));
}
const t7NoCrit = () => t7On() && !!t7Mods().stat.noCrit;
const t7BasicMul = () => (t7On() ? t7Mods().basic : 1);
const t7BasicDps = () => (t7On() ? t7Mods().basic * t7Mods().basicDps : 1);
// 변형이 바꾼 기술 모양 (타격 추가·범위). k = skillAt 결과 (숙련 모습이 반영된 것)
const t7ShapeCache = {};
function t7Shape(sk, k) {
  const m = t7Mods(), sh = m.shape, key = sk + k.stage + '|' + [...sh].join(',');
  if (t7ShapeCache[key]) return t7ShapeCache[key];
  let s = k;
  const big = (hits) => hits.reduce((a, h) => (h[1] > a[1] ? h : a), hits[0]);
  const after = (t, dt) => Math.min(0.98, t + dt / s.dur);
  if (sk === 'steelCleave' && sh.has('twin')) { const b = big(s.hits); s = { ...s, hits: [...s.hits, [after(b[0], 0.15), b[1] * 0.6]] }; }
  if (sk === 'steelCleave' && sh.has('slashWave')) { const b = big(s.hits); s = { ...s, hits: [...s.hits, [after(b[0], 0.2), b[1] * 0.5, { area: 'line', reach: 3 }]] }; }
  if (sk === 'gale' && sh.has('more')) {
    const small = s.hits.filter((h) => h === s.hits.reduce((a, x) => (x[1] < a[1] ? x : a), s.hits[0]));
    const extra = small.slice(0, 3).map((h, i) => [Math.min(0.97, h[0] + 0.03 * (i + 1)), h[1]]);
    s = { ...s, hits: [...s.hits.map((h) => (small.includes(h) ? [h[0], h[1] * 0.85, ...h.slice(2)] : h)), ...extra.map((h) => [h[0], h[1] * 0.85])] };
  }
  if (sk === 'whirl' && sh.has('grow')) s = { ...s, radius: (s.radius || 40) * 2 };
  if (sk === 'whirl' && sh.has('follow')) s = { ...s, radius: (s.radius || 40) + 60 };
  // 비검: 관통 전엔 앞의 한 적만(투사체가 첫 적에서 멈춘다), 관통이면 앞 줄 전부 · 검기 폭풍은 관통이면 범위 +20%
  if (sk === 'wave') s = { ...s, area: sh.has('pierce') ? 'line' : 'single', reach: 4, hits: s.hits.map((h) => [h[0], h[1]]) };
  if (sk === 'storm' && sh.has('pierce')) s = { ...s, radius: (s.radius || 120) * 1.2 };
  if (sk === 'flash' && sh.has('after')) s = { ...s, hits: [...s.hits, ...s.hits.map((h) => [after(h[0], 0.5), h[1] * 0.5, ...h.slice(2)])] };
  if (sk === 'flash' && sh.has('triple')) s = { ...s, hits: s.hits.flatMap((h) => [0, 0.04, 0.08].map((d) => [Math.min(0.98, h[0] + d), h[1] * 0.5, ...h.slice(2)])) };
  if (sk === 'storm' && sh.has('split')) s = { ...s, hits: [...s.hits, ...s.hits.map((h) => [after(h[0], 0.15), h[1] * 0.5, { area: 'all', radius: 60 }])] };
  if (sk === 'thousandCuts' && sh.has('uvA')) s = { ...s, hits: s.hits.flatMap((h) => [[h[0], h[1] * 0.5], [Math.min(0.98, h[0] + 0.02), h[1] * 0.5]]) };
  // 일도양단: 타격 수·시점은 그대로(천검 연출이 타격 순서를 쓴다), 피해의 80% 를 마지막 한 칼에 몰아준다
  if (sk === 'thousandCuts' && sh.has('uvB')) { const tot = s.hits.reduce((a, h) => a + h[1], 0), n = s.hits.length; s = { ...s, hits: s.hits.map((h, i) => [h[0], i === n - 1 ? tot * 0.8 : (tot * 0.2) / (n - 1), ...h.slice(2)]) }; }
  if (sk === 'thousandCuts' && sh.has('uvK')) s = { ...s, radius: (s.radius || 230) * 1.3 };
  return (t7ShapeCache[key] = s);
}

// ── 봇·측정용: 빌드별 포인트 쓰기 순서 (dev/lifespan-bot.js · progress-bot.js --build) ──
const T7_BUILDS = {
  a: ['c_atk', 'c_hp', 'slash', 'slash', 's_twin', 'gale', 'gale', 'gale', 'a_more', 'a_bleed', 'whirl', 'whirl', 'a_grow', 'iaido', 'iaido', 'iaido', 'a_key', 'f_ab', 'gale', 'gale', 'whirl', 'whirl', 'whirl',
    'ult', 'a_k3', 'uv_a', 'ult', 'ult', 'ult', 'ult', 'f_ab', 'f_ab', 'slash', 'slash', 'slash', 'c_spd', 'c_spd', 'c_spd', 'c_atk', 'c_atk', 'c_hp', 'c_hp', 'c_crit', 'c_crit', 'c_crit', 'k_blade'],
  b: ['c_atk', 'c_hp', 'slash', 'slash', 's_twin', 'iaido', 'iaido', 'iaido', 'b_exec', 'b_reset', 'flash', 'flash', 'b_after', 'gale', 'gale', 'gale', 'b_key', 'f_ab', 'iaido', 'iaido', 'flash', 'flash', 'flash',
    'ult', 'b_k3', 'uv_b', 'ult', 'ult', 'ult', 'ult', 'f_ab', 'f_ab', 'slash', 'slash', 'slash', 'c_atk', 'c_atk', 'c_crit', 'c_crit', 'c_crit', 'c_spd', 'c_spd', 'c_spd', 'c_hp', 'c_hp', 'k_blade'],
  k: ['c_atk', 'c_hp', 'slash', 'slash', 'k_wave' /* 비검 전에는 못 찍음 — 건너뜀 */, 's_twin', 'wave', 'wave', 'wave', 'k_wave', 'k_pierce', 'storm', 'storm', 'k_split', 'iaido', 'iaido', 'iaido', 'k_key', 'f_bk',
    'wave', 'wave', 'storm', 'storm', 'storm', 'ult', 'k_k3', 'uv_k', 'ult', 'ult', 'ult', 'ult', 'f_bk', 'f_bk', 'slash', 'slash', 'slash', 'c_atk', 'c_atk', 'c_spd', 'c_spd', 'c_spd', 'c_hp', 'c_hp', 'c_crit', 'c_crit', 'c_crit', 'k_blade'],
};
// 남은 포인트를 빌드 순서대로 쓴다 (못 찍는 건 건너뛰고, 순서를 다 돌면 남는 걸로 아무 노드나 싼 것부터). 장착 칸도 산다
function t7AutoSpend(build = 'a') {
  if (!t7On()) return 0;
  let n = 0;
  for (let guard = 0; guard < 400; guard++) {
    const order = T7_BUILDS[build] || T7_BUILDS.a, want = {};
    let picked = null;
    for (const id of order) { want[id] = (want[id] || 0) + 1; if (t7Rank(id) < want[id] && t7CanAdd(id)) { picked = id; break; } }
    if (!picked) picked = T7_NODES.filter((x) => t7CanAdd(x.id)).sort((p, q) => T7_SPEC[p.t].cost - T7_SPEC[q.t].cost)[0]?.id;
    if (!picked || !t7Add(picked)) break;
    n++;
  }
  while (t7BuySlot()) n++;
  // 장착: 빌드 순서에 먼저 나오는 배운 액티브부터 칸을 채운다
  const s = t7S(), order = T7_BUILDS[build] || T7_BUILDS.a, seen = [];
  for (const id of order) { const x = T7_BY[id]; if (x && (x.t === 'active' || x.t === 'fusion') && t7Rank(id) > 0 && !seen.includes(x.sk)) seen.push(x.sk); }
  s.eq = seen.slice(0, t7Slots());
  return n;
}
// 트리 전체 비용 (택1·궁극기 변형은 하나씩)
function t7PathCost() {
  const seen = new Set();
  return T7_NODES.reduce((a, n) => {
    const g = n.t === 'uvar' ? 'uvar' : n.pair;
    if (g) { if (seen.has(g)) return a; seen.add(g); }
    return a + T7_SPEC[n.t].cost * T7_SPEC[n.t].max;
  }, 0);
}
// 새 스킬의 연출: 3단계 전까지는 같은 계열 스킬의 연출을 빌려 쓴다 (skills.js 가 SKILL_FX 에 이어 붙인다)
const T7_FX_BASE = { whirl: 'gale', flash: 'iaido', wave: 'steelCleave', storm: 'steelCleave', f_ab: 'gale', f_bk: 'iaido', f_ak: 'gale' };

// ── 보스 벽 (4단계, 이 줄기 캐릭터의 원정 1~120 스테이지만) ──
// 일반 보스 체력 ×0.8 · 10칸 중간 보스(10·30·50…) 체력 ×2.5 공격 ×1.5 + 기믹 1 · 20칸 지역 보스(필드 보스) 체력 ×4 공격 ×2 + 기믹 2 (필드 보스 배율 대신)
// 기믹의 실제 규칙은 src/tree7-wall.js (게임), 봇·오프라인 계산(core.js simulate)은 아래 근사: 막는 갈래를 찍었는지(t7Counter 0~1)로 DPS·받는 피해를 깎는다
let T7_WALL_MAX = 120;   // 측정용으로 바꿀 수 있게 let
const T7_GIM = {
  //  pen: 대응 0 일 때 DPS 손실 · cnt: 대응 노드 → 무게 (액티브·융합은 장착해야, 칸 비율만큼) · lane: auto 봇이 갈아탈 갈래
  shield: { icon: '🛡️', name: '보호막', lane: 'a', pen: 0.45, cnt: { a_more: 0.35, whirl: 0.35, uv_a: 0.45, a_key: 0.15, f_ak: 0.15 }, tip: '연타 갈래 (난무 +3타·검무 회오리·만검)' },
  adds: { icon: '👥', name: '졸개', lane: 'k', pen: 0.45, cnt: { k_pierce: 0.35, storm: 0.35, k_split: 0.2, uv_k: 0.45, f_bk: 0.15, f_ak: 0.15 }, tip: '검기 갈래 (관통·검기 폭풍·분열·검우)' },
  enrage: { icon: '🔥', name: '광폭화', lane: 'b', pen: 0.35, cnt: { b_exec: 0.3, iaido: 0.2, flash: 0.3, uv_b: 0.45, b_key: 0.2 }, tip: '발도 갈래 (처형·일섬·섬광 베기·일도양단)' },
  pool: { icon: '🩸', name: '장판', lane: 'c', pen: 0, cnt: { c_hp: 0.5, c_def: 0.5 }, tip: '줄기 스탯 (체력·방어)' },
};
// 배치: 지역 안에서 중간 보스와 지역 보스의 답이 겹치고, 지역마다 답이 바뀐다
const T7_WALLS = { 10: ['enrage'], 20: ['enrage', 'shield'], 30: ['adds'], 40: ['adds', 'pool'], 50: ['pool'], 60: ['pool', 'shield'],
  70: ['shield'], 80: ['shield', 'enrage'], 90: ['adds'], 100: ['adds', 'enrage'], 110: ['shield'], 120: ['enrage', 'adds', 'shield'] };
// 배율은 봇으로 맞춘 값 (스펙 시작값 중간 2.5·1.5 / 지역 4·2 는 4일차 120 에 머물러 너무 셌다 — 지역 보스는 지금 필드 보스(체력 ×2·공격 ×1.4)보다 체력은 낮추고 기믹을 얹는다)
let T7_WALL_EARLY = 1;   // 10~60 벽 체력 추가 배율 — 측정용. 1.6·2.2 로 올려도 10~30 벽은 그대로 0번이고 40 벽(2차 전직 전)만 50번 넘게 막혀서 1 로 둔다
const T7_WALL_MUL = { boss: { hp: 0.8, atk: 1 }, mid: { hp: 1.3, atk: 1.1 }, region: { hp: 1.6, atk: 1.3 } };
// 기믹 수치 (게임 규칙·봇 근사가 같이 쓴다)
const T7_GIM_RULE = { shieldEvery: 8, shieldHits: 4, addsEvery: 10, addsN: 3, addsHp: 3, enrageAt: 20, enrageAtk: 3, poolEvery: 6, poolDur: 3, poolPct: 0.03 };
function t7Wall(stage) {
  if (!t7On() || stage > T7_WALL_MAX) return null;
  const kind = stage % 10 ? 'boss' : stage % 20 ? 'mid' : 'region';
  const e = kind !== 'boss' && stage <= 60 ? T7_WALL_EARLY : 1;   // 초반 벽(10~60)은 트리가 초반에 세서 그냥 지나가 체력을 더 준다
  return { stage, kind, ...T7_WALL_MUL[kind], hp: T7_WALL_MUL[kind].hp * e, gims: T7_WALLS[stage] || [] };
}
// 보스 몬스터 수치에 벽을 입힌다 (필드 보스 배율은 벽 배율로 바꾼다). 기믹이 있으면 m.wall
function t7BossStats(stage, m) {
  const w = m.boss && t7Wall(stage);
  if (!w) return m;
  const field = stage === zoneOf(stage).to;
  const hp = (m.hp / (field ? FIELD_HP : 1)) * w.hp, atk = (m.atk / (field ? FIELD_ATK : 1)) * w.atk;
  return { ...m, hp, atk, ...(w.gims.length ? { wall: { stage, kind: w.kind, gims: w.gims } } : {}) };
}
// 이 기믹을 막는 노드를 얼마나 찍었나 (0~1)
function t7Counter(g) {
  const s = t7S();
  let c = 0;
  for (const [id, w] of Object.entries(T7_GIM[g].cnt)) {
    const n = T7_BY[id], r = t7Rank(id);
    if (!r || (n.sk && n.t !== 'ult' && !s.eq.includes(n.sk))) continue;
    c += w * r / T7_SPEC[n.t].max;
  }
  return Math.min(1, c);
}
// 봇 근사 (core.js simulate): 벽 보스와 싸울 때 DPS 배율 · 받는 피해 배율(광폭화) · 장판 피해(최대 체력 비율)
//  기믹 3개(마왕성 120)는 하나하나를 0.6 배로 — 한 갈래로 셋을 다 막을 수 없어서
const t7WallDps = (w) => w.gims.reduce((m, g) => m * (1 - T7_GIM[g].pen * (w.gims.length >= 3 ? 0.6 : 1) * (1 - t7Counter(g))), 1);
function t7WallHurt(w, fight) {
  if (!w.gims.includes('enrage') || fight <= T7_GIM_RULE.enrageAt) return 1;
  const R = T7_GIM_RULE;
  // 발도 갈래(처형·섬광 베기·일도양단)는 광폭화 뒤를 짧게 끊는다: 대응만큼 광폭화 구간이 줄어든다
  return (R.enrageAt + (fight - R.enrageAt) * (1 - 0.6 * t7Counter('enrage')) * R.enrageAtk) / fight;
}
const t7WallPool = (w, fight) => (w.gims.includes('pool') ? fight * (T7_GIM_RULE.poolDur / T7_GIM_RULE.poolEvery) * T7_GIM_RULE.poolPct * (1 - 0.7 * t7Counter('pool')) : 0);
// 귀환 보고 한 줄: 가장 덜 대응한 기믹을 추천
function t7WallTip(w) {
  const g = w.gims.slice().sort((p, q) => t7Counter(p) - t7Counter(q))[0];
  return g ? { g, ...T7_GIM[g] } : null;
}
// 원정 기록: 벽 보스에게 진 체력 비율(가장 깊이 깎은 것) · 뚫은 벽
function t7WallNote(m, left) {
  if (!S.trip || !m.wall) return;
  const o = S.trip.wall;
  if (!o || o.stage !== m.wall.stage || left < o.left) S.trip.wall = { stage: m.wall.stage, kind: m.wall.kind, gims: m.wall.gims, left: Math.max(0, left), type: m.type || zoneOf(m.wall.stage).boss };   // 오프라인 계산(simulate)의 보스엔 type 이 없다
}
function t7WallBreak(m) {
  if (!S.trip || !m.wall) return;
  (S.trip.wallBreak = S.trip.wallBreak || []).push(m.wall.stage);
  if (S.trip.wall && S.trip.wall.stage === m.wall.stage) S.trip.wall = null;
}
// auto 봇: 막힌 벽에서 가장 덜 막고 있는 기믹(줄기 스탯으로 막는 장판 빼고)의 갈래 — 이미 반 넘게 막고 있으면 바꾸지 않는다 (초기화 골드 아끼기)
function t7WallBuild(stage) {
  if (t7Tier() < 2) return null;   // 2차 전직 전엔 갈래가 없어 초기화해도 같다
  const g = (T7_WALLS[stage] || []).filter((x) => T7_GIM[x].lane !== 'c').sort((p, q) => t7Counter(p) - t7Counter(q))[0];
  return g && t7Counter(g) < 0.4 ? T7_GIM[g].lane : null;
}
