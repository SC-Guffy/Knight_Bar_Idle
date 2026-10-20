'use strict';
// 시즌7 스킬 빌드 트리 — 시제품: 검사 → 검성 → 검신 한 줄기 (docs/specs/skill-tree-swordsaint.md · 방향은 docs/specs/skill-build-tree.md)
// 이 줄기 캐릭터(TREE7_CLS)는 스킬 숙련도(📖)·스킬별 트리 V2·숙련 별을 쓰지 않고, 레벨업마다 받는 🌟 포인트로 이 트리를 찍는다.
//  - 포인트 = 레벨 − 1. 노드 = 스탯 · 액티브(5칸, 칸마다 모습) · 변형(갈래마다 택1 한 쌍) · 키스톤(대가 있음) · 융합 · 궁극기 · 궁극기 변형(셋 중 하나)
//  - 전투에는 장착 칸(1~4) 의 액티브·융합 + 궁극기만 나온다 (core.js unlockedSkills 분기)
//  - 위력·쿨타임·모습·고유 특수는 core.js 의 skillPow·skillCd·skillStage·skillSpec·heroSkill 이 여기 t7* 를 부른다
//  - 1단계(규칙·수치): 연출이 필요한 변형·키스톤 일부는 평균 피해 배율(ev)로 근사한다 — 3단계 연출 때 실제 규칙으로 바꾼다 (T7_NODES 의 approx)
// 노드 배치·아이콘은 시안 dev/review/skill-build-tree.html 과 같다 (화면은 2단계에서 ui.js).
// 이 파일은 classes.js(SKILLS·CLASSES) 다음, core.js 앞에 불러온다 (freshState 가 freshT7 을 쓴다).

// 견습 기사(0차)는 넣지 않는다. 1차로 전직하면 그동안 쌓인 포인트(레벨 − 1)를 한꺼번에 찍는다.
// 15줄기 모두 같은 틀 (docs/specs/skill-tree-all.md): 노드 id 는 "칸" 이름이고(검성 시제품 이름 그대로 — slash 1차 스킬 · gale·iaido 2차 스킬 둘 ·
//  whirl·flash·wave·storm 새 스킬 넷 · f_ab·f_bk·f_ak 융합 · ult 궁극기), 줄기마다 칸 → 실제 SKILLS id 를 T7_LINES 에 둔다 (src/tree7-l-*.js).
//  캐릭터의 줄기가 바뀌면 t7Sync 가 노드의 sk·T7_BY_SKILL 을 그 줄기 것으로 다시 채운다. 1차 직업은 갈래가 없어 같은 1차의 줄기 아무거나(줄기 노드만 쓴다).
const TREE7_CLS = [];   // 트리를 쓰는 직업 (t7DefLine 이 채운다)
const t7On = (cls = S.cls) => !T7_OFF && (T7_OPEN || S7_DEV) && TREE7_CLS.includes(cls);
let T7_OFF = false;   // 측정용: 켜면 이 줄기도 지금 시스템 (dev/lifespan-bot.js --old 1). 배포 스위치는 src/data.js T7_OPEN
const T7_PICK_URL = typeof location !== 'undefined' && /[?&]t7=1(&|$)/.test(location.search || '');   // 게임 주소 ?t7=1 → 이 캐릭터를 시제품 줄기로 (core.js loadState)

// 종류별 비용·최대 칸 (스펙 "노드 종류·비용")
// 2안 (docs/specs/skill-tree-v3.md): 스킬 Lv = 위력·쿨만 (🌟1, 융합 🌟2) · 모습(look)은 스킬 안 ★ 카드 · 스탯은 길 위의 점(한 번이면 끝)
const T7_SPEC = {
  stat: { cost: 3, max: 1 }, active: { cost: 1, max: 5 }, mod: { cost: 4, max: 1 }, key: { cost: 7, max: 1 },
  ult: { cost: 1, max: 5 }, fusion: { cost: 2, max: 3 }, uvar: { cost: 6, max: 1 }, look: { cost: 2, max: 3 }, hub: { cost: 0, max: 0 },
};
const t7Cost = (n) => n.cost || T7_SPEC[n.t].cost;
const t7MaxN = (n) => n.max || T7_SPEC[n.t].max;   // 노드별 최대 칸 (융합 모습은 2)
// 액티브·궁극기 칸 → 위력·쿨 배수, 융합 칸 → 배수
const T7_RANK = { pow: 0.15, cd: 0.06 }, T7_FUSE = { pow: 0.25, cd: 0.08 };
// 전체 위력 눈금: 트리 스킬 위력 × T7_TUNE.pow (봇으로 지금 시스템과 진행 속도를 맞춘 값, docs/specs/skill-tree-swordsaint.md 진행 기록)
const T7_TUNE = { pow: 0.4 };
// 옛 규칙(0.27): 칸 → 모습 단계 (1칸 0 · 2·3칸 ★ · 4칸 ★★ · 5칸 ★★★, 융합 1칸 0 · 2칸 ★★ · 3칸 ★★★) — 지금은 세이브 옮기기(t7Migrate)에만 쓴다
const T7_STAGE_AT = [0, 0, 1, 1, 2, 3], T7_FUSE_STAGE_AT = [0, 0, 2, 3];

// 노드: id, t 종류, lane (c 줄기 / a 연타 / b 발도 / k 검기), tier 필요 전직 차수, req 앞 노드(하나라도), min 그 갈래 포인트 하한,
//  sk 액티브·융합·궁극기가 가리키는 SKILLS id, lanes 융합이 요구하는 두 갈래, pair 같은 값끼리 택1,
//  fx 효과 (아래 t7Mods 가 읽는다): { stat:{키:칸당}, pow:{스킬:배}, cd:{스킬:배}, ev:{스킬:배} 결투·전투력 평균 배율, spec:{스킬:{type,v,…}}, shape:이름,
//     rule:이름 (전투 규칙 — src/tree7-fx.js t7OnHit·t7OnEnd·t7OnBasic), basic: 평타 피해 배율, basicDps: 평타 DPS 평균 배율(dpsOf), evAll: 모든 스킬 평균 배율,
//     duel: 결투에서만 공격력 배율 (1:1·6~7초 첫 폭딜 싸움이라 광역·쿨 줄이기 갈래가 손해 — server/duel.js 가 profile.duel 을 곱한다. 레이드·원정은 그대로) }
// 판 (디아블로 4 식, docs/specs/skill-tree-v3.md "3안"): 허브 6개가 줄기로 이어지고, 스킬·키스톤·스탯 점 사슬이 자기 허브에서 뻗는다. 메인 스킬(slash)·궁극기는 1Lv 공짜(free).
//  스킬 바깥으로 모습(look) 사슬, 옆에 변형(mod·uvar). 조건은 "앞을 배우면"(req 하나라도 · reqAll 모두) + 전직 차수, 그리고 택1(pair)·셋 중 하나(uvar)
const T7_NODES = [
  // 허브 (디아블로 4 식 줄기, 2026-10-20 사용자): 찍지 않는 길목. 전직 차수가 되면 열리고 앞 허브와 줄기로 이어진다. 노드는 모두 자기 허브에서 뻗는다
  { id: 'hub_c', t: 'hub', lane: 'c', tier: 1, req: [] },
  { id: 'hub_a', t: 'hub', lane: 'a', tier: 2, req: ['hub_c'] },
  { id: 'hub_b', t: 'hub', lane: 'b', tier: 2, req: ['hub_a'] },
  { id: 'hub_k', t: 'hub', lane: 'k', tier: 2, req: ['hub_b'] },
  { id: 'hub_f', t: 'hub', lane: 'f', tier: 2, req: ['hub_k'] },
  { id: 'hub_u', t: 'hub', lane: 'u', tier: 3, req: ['hub_f'] },
  { id: 'slash', t: 'active', lane: 'c', tier: 1, req: ['hub_c'], free: 1, sk: null, slot: 1 },
  { id: 's_twin', t: 'mod', lane: 'c', tier: 1, req: ['slash'], fx: { shape: 'twin' } },
  { id: 'k_wave', t: 'mod', lane: 'c', tier: 1, req: ['slash'], fx: { shape: 'slashWave' } },   // 참격파: 메인 스킬을 바꾸는 효과라 검기 줄 → 메인 스킬 변형으로 (2안)
  { id: 'k_blade', t: 'key', lane: 'c', tier: 1, req: ['hub_c'], fx: { rule: 'blade', powAll: 0.9, evAll: 1.18 } },   // 평타 3타마다 모든 스킬 쿨 −0.5초 (t7OnBasic)
  // 스탯 점 (4안, 노드 줄이기 2026-10-20): 종류마다 하나, 🌟3 에 옛 점 3개 몫. 시작 허브 3개는 1차부터, 연타·검기 허브에 하나씩(2차)
  { id: 'c_atk', t: 'stat', lane: 'c', tier: 1, req: ['hub_c'], fx: { stat: { atk: 0.06 } } },
  { id: 'c_crit', t: 'stat', lane: 'c', tier: 1, req: ['hub_c'], fx: { stat: { crit: 0.045 } } },
  { id: 'c_hp', t: 'stat', lane: 'c', tier: 1, req: ['hub_c'], fx: { stat: { hp: 0.09 } } },
  { id: 'c_spd', t: 'stat', lane: 'c', tier: 2, req: ['hub_a'], fx: { stat: { aspd: 0.06 } } },
  { id: 'c_def', t: 'stat', lane: 'c', tier: 2, req: ['hub_k'], fx: { stat: { guard: 0.06 } } },

  { id: 'gale', t: 'active', lane: 'a', tier: 2, req: ['hub_a'], sk: null, slot: 1 },
  { id: 'a_more', t: 'mod', lane: 'a', tier: 2, req: ['gale'], fx: { shape: 'more' } },
  { id: 'a_bleed', t: 'mod', lane: 'a', tier: 2, req: ['gale'], fx: { spec: { gale: { type: 'dot', name: '출혈', icon: '🩸', v: 0.4, dur: 3 } } } },
  { id: 'whirl', t: 'active', lane: 'a', tier: 2, req: ['hub_a'], sk: null, slot: 1 },
  { id: 'a_follow', t: 'mod', lane: 'a', tier: 2, req: ['whirl'], pair: 'pa', fx: { shape: 'follow' } },   // 회오리가 적에게 날아가 붙는다 (범위 +60px, 연출은 tree7-fx)
  { id: 'a_grow', t: 'mod', lane: 'a', tier: 2, req: ['whirl'], pair: 'pa', fx: { shape: 'grow', ev: { whirl: 1.1 } } },
  { id: 'a_key', t: 'key', lane: 'a', tier: 2, req: ['hub_a'], fx: { rule: 'frenzy', basic: 0.85, basicDps: 1.02 } },   // 스킬 명중마다 공속 +4% 겹침(최대 10, 3초) · 평타 피해 −15%
  { id: 'a_k3', t: 'key', lane: 'a', tier: 3, req: ['a_key'], fx: { rule: 'endless', ev: { gale: 1.3 }, cd: { gale: 1.25 } } },   // 질풍난무가 끝나면 30% 로 바로 한 번 더
  { id: 'uv_a', t: 'uvar', lane: 'a', tier: 3, req: ['ult'], fx: { shape: 'uvA', ev: { ult: 1.05 }, duel: 1.2 } },

  { id: 'iaido', t: 'active', lane: 'b', tier: 2, req: ['hub_b'], sk: null, slot: 1 },
  { id: 'b_reset', t: 'mod', lane: 'b', tier: 2, req: ['iaido'], fx: { rule: 'echo', ev: { iaido: 1.2 } } },   // 일섬으로 처치하면 잔상이 가장 가까운 적을 50% 로
  { id: 'b_exec', t: 'mod', lane: 'b', tier: 2, req: ['iaido'], fx: { spec: { iaido: { type: 'exec', name: '처형', icon: '🗡️', v: 1.0, thr: 0.25 } } } },
  { id: 'flash', t: 'active', lane: 'b', tier: 2, req: ['hub_b'], sk: null, slot: 1 },
  { id: 'b_after', t: 'mod', lane: 'b', tier: 2, req: ['flash'], pair: 'pb', fx: { shape: 'after' } },
  { id: 'b_triple', t: 'mod', lane: 'b', tier: 2, req: ['flash'], pair: 'pb', fx: { shape: 'triple' } },
  { id: 'b_key', t: 'key', lane: 'b', tier: 2, req: ['hub_b'], fx: { pow: { iaido: 1.17, flash: 1.17 }, cd: { iaido: 1.3, flash: 1.3 } } },
  { id: 'b_k3', t: 'key', lane: 'b', tier: 3, req: ['b_key'], fx: { stat: { atkMul: 2.6, noCrit: 1 } } },   // 모든 피해 ×2.6 (봇: 2.3 이면 발도 빌드가 10일차 240 에 멈춤), 치명 0 (확정 치명 스킬도 일반타 — t7NoCrit). 1.35 는 확정 치명 3.3배를 잃는 값을 못 메워 0.6배 손해였다
  { id: 'uv_b', t: 'uvar', lane: 'b', tier: 3, req: ['ult'], fx: { shape: 'uvB', pow: { ult: 1.2 }, duel: 0.95 } },

  { id: 'wave', t: 'active', lane: 'k', tier: 2, req: ['hub_k'], sk: null, slot: 1 },
  { id: 'k_pierce', t: 'mod', lane: 'k', tier: 2, req: ['wave'], fx: { shape: 'pierce' } },   // 비검이 첫 적에서 멈추지 않고 줄로 뚫는다 · 검기 폭풍 범위 +20%
  { id: 'storm', t: 'active', lane: 'k', tier: 2, req: ['hub_k'], sk: null, slot: 1 },
  { id: 'k_split', t: 'mod', lane: 'k', tier: 2, req: ['storm'], pair: 'pk', fx: { shape: 'split' } },
  { id: 'k_homing', t: 'mod', lane: 'k', tier: 2, req: ['storm'], pair: 'pk', fx: { spec: { storm: { type: 'boss', name: '유도', icon: '🎯', v: 0.5 } } } },
  { id: 'k_key', t: 'key', lane: 'k', tier: 2, req: ['hub_k'], fx: { stat: { rangeMul: 3 }, basic: 0.8, basicDps: 0.9 } },   // 평타가 검기로 (사거리 ×3, 검기 그림) · 평타 피해 −20%
  { id: 'k_k3', t: 'key', lane: 'k', tier: 3, req: ['k_key'], fx: { rule: 'myriad', ev: { wave: 1.25, storm: 1.25 }, powNot: { lane: 'k', v: 0.8 } } },   // 검기 스킬 명중마다 다른 검기 스킬 쿨 −0.3초
  { id: 'uv_k', t: 'uvar', lane: 'k', tier: 3, req: ['ult'], fx: { shape: 'uvK', ev: { ult: 1.1 }, duel: 1.4 } },   // duel: 결투 전용 공격력 (t7Duel — 검기는 광역·쿨 줄이기가 1:1 에서 안 먹어서 ×1.4, 연타 ×1.2, 발도 ×0.95. 맞대결 60판으로 맞춤)

  { id: 'ult', t: 'ult', lane: 'c', tier: 3, req: ['hub_u'], free: 1, sk: null, slot: 1 },   // 3차 전직 때 1Lv 공짜 (메인 스킬처럼)
  { id: 'f_ab', t: 'fusion', lanes: ['a', 'b'], tier: 2, req: ['hub_f'], reqAll: ['whirl', 'flash'], sk: null, slot: 1 },   // 융합: 두 줄의 둘째 스킬을 모두 배우면
  { id: 'f_bk', t: 'fusion', lanes: ['b', 'k'], tier: 2, req: ['hub_f'], reqAll: ['flash', 'storm'], sk: null, slot: 1 },
  { id: 'f_ak', t: 'fusion', lanes: ['a', 'k'], tier: 2, req: ['hub_f'], reqAll: ['whirl', 'storm'], sk: null, slot: 1 },
];
// 모습 노드 (4안): 스킬마다 하나 <스킬>_look — 칸 = ★ 단계 (액티브·궁극기 ★~★★★ 3칸, 융합 ★★~★★★ 2칸 = st0 1 만큼 밀림). 칸마다 🌟2, 마지막 칸만 그 스킬 최대 Lv
const T7_LOOK = {};
for (const n of T7_NODES.filter((x) => x.slot)) {
  const f = n.t === 'fusion';
  T7_LOOK[n.id] = { id: `${n.id}_look`, t: 'look', lane: n.lane, tier: n.tier, of: n.id, req: [n.id], ...(f ? { max: 2, st0: 1 } : {}) };
}
T7_NODES.push(...Object.values(T7_LOOK));
const t7LookSt = (l, r) => (r > 0 ? r + (l.st0 || 0) : 0);   // 모습 노드 칸 → ★ 단계
const T7_BY = Object.fromEntries(T7_NODES.map((n) => [n.id, n]));
const T7_BY_SKILL = {};   // 실제 스킬 id → 노드 (지금 캐릭터의 줄기, t7Sync)
const T7_SLOTS_SK = T7_NODES.filter((n) => n.slot).map((n) => n.id);   // 스킬 칸 노드 id

// ── 줄기 (15개) ──
// t7DefLine({ id: 3차 직업, cls: [1차, 2차, 3차], sk: { slash, gale, iaido, ult }  (지금 스킬),
//   newSkills: { whirl|flash|wave|storm|f_ab|f_bk|f_ak: { id, base, name, icon, ...SKILLS 덮어쓸 값 } }, lanes: { a|b|k: { name, sub } },
//   ui: { 노드 id: { n, d, looks, cost, ic } }, duel: { a, b, k } 궁극기 변형별 결투 배율, tune: { pow } 줄기 위력 눈금(T7_TUNE 대신), fx: { 노드 id: 효과 덮어쓰기 } })  — 1차 줄기 공용 글은 t7DefStem(1차, { ui })
const T7_LINES = {}, T7_STEMS = {}, T7_FX_BASE = {}, T7_LINE_OF = {};
function t7DefStem(first, o) { T7_STEMS[first] = o; }
// 줄기별 결투 배율 (궁극기 변형을 찍은 갈래 기준, t7Duel). 맞대결 3쌍 + 지금 시스템 상대 3쌍이 50% 가까이 되게 Lv130·170 결투로 찾은 값
//  (2026-10-18, 스크래치 tune-duel.js: sanitizeProfile → server/duel.js 40판 좌표 하강). t7DefLine 의 duel 이 있으면 그것
//  2026-10-19 다시: 시즌 리셋으로 모두 트리라 "15줄기 리그(빌드 a·b·k, Lv130·170) 승률 50%" + "줄기 안 맞대결 50%" 기준으로 (스크래치 league.js --fit --inner).
//   리그 38~59% · 근접 vs 원거리 48% · 줄기 안 맞대결 14~50/60. 지금 시스템(옛 스킬) 상대 승률은 이제 보지 않는다 (옛 시스템 캐릭터가 없다)
// 0.29 (숙련·룬): 궁극기 변형이 없어져 줄기별 결투 배율 하나 (t7Duel). dev/duel-league.js --fit 으로 맞춘 값 — 15줄기 × 빌드 3 × Lv130·170 리그 승률 50% 쪽
let T7_DUEL_LINE = {   // 2026-10-20 리그 승률 47~53% (폭 3%p, 배율 없이는 12~88%)
  swordsaint: 0.78, tyrant: 0.81, archon: 0.92, skyGeneral: 0.69, dragonlord: 1.03, warlord: 1.01, siegeMaster: 1.27, deadeye: 1.17,
  voidArcher: 1.64, thunderEmperor: 1.70, archmage: 1.92, frostlord: 1.33, champion: 0.74, tempest: 1.19, grandmaster: 1.20,
};
function t7DefLine(L) {
  const sk = { ...L.sk };
  for (const [slot, o] of Object.entries(L.newSkills)) {
    const { id, base, ...rest } = o;
    SKILLS[id] = { ...SKILLS[base], ...rest, id, cls: L.cls[1], lv: 0, t7: true, t7base: base, t7slot: slot, ult: false };   // 궁극기를 바탕으로 해도 새 스킬은 장착 칸 스킬 (ult 를 물려받으면 장착·시전이 안 됐다)
    if (typeof SKILL_CP !== 'undefined' && SKILL_CP[id]) { SKILLS[id].emoji = rest.icon; SKILLS[id].icon = String.fromCharCode(SKILL_CP[id]); }   // 구운 도트 아이콘 (dev/icon-art/t7-*.js → make-icons) — classes.js 와 같은 방식
    T7_FX_BASE[id] = base;
    sk[slot] = id;
  }
  // 무념(b_k3) 배율: ×2.6 은 확정 치명(3.3배)을 잃는 검성 일섬·섬광 베기 기준. 갈래 b 스킬이 확정 치명이 아니면 평범한 치명 기대값(~1.9배)만 잃어서 ×1.9
  if (SKILLS[L.sk.iaido] && !SKILLS[L.sk.iaido].crit && !(L.fx && L.fx.b_k3)) {
    L.fx = { ...L.fx, b_k3: { stat: { atkMul: 1.9, noCrit: 1 } } };
    const u = L.ui && L.ui.b_k3;
    if (u && u.d) u.d = u.d.replace('×2.6', '×1.9').replace('+160%', '+90%');
  }
  T7_LINES[L.id] = { ...L, sk, slotOf: Object.fromEntries(Object.entries(sk).map(([a, b]) => [b, a])) };
  for (const c of L.cls) if (!TREE7_CLS.includes(c)) TREE7_CLS.push(c);
  if (!T7_LINE_OF[L.cls[0]]) T7_LINE_OF[L.cls[0]] = L.id;   // 1차 직업 → 대표 줄기 (줄기 노드만 쓴다)
  T7_LINE_OF[L.cls[1]] = T7_LINE_OF[L.cls[2]] = L.id;
}
// 지금 캐릭터의 줄기 (없으면 null)
let t7SyncedCls = null;
const t7L = () => { if (S.cls !== t7SyncedCls) t7Sync(); return T7_LINES[T7_LINE_OF[S.cls]] || null; };
function t7Sync() {
  t7SyncedCls = S.cls;
  const L = T7_LINES[T7_LINE_OF[S.cls]];
  for (const k of Object.keys(T7_BY_SKILL)) delete T7_BY_SKILL[k];
  if (!L) return;
  for (const id of T7_SLOTS_SK) { const n = T7_BY[id]; n.sk = L.sk[id]; if (n.sk) T7_BY_SKILL[n.sk] = n; }
  t7ModsKey = '';
}
// 효과 키(칸 이름) → 지금 줄기의 스킬 id
const t7SkKey = (k) => { const L = t7L(); return (L && L.sk[k]) || k; };
// 스킬 → 갈래 (만검귀종처럼 "검기 스킬" 을 가리는 데)
const t7LaneOf = (sk) => { t7L(); return T7_BY_SKILL[sk] ? T7_BY_SKILL[sk].lane || null : null; };

// 장착 칸: [필요 레벨, 필요 차수, 비용 종류, 값 or 함수]
const T7_SLOTS = [null, null, { tier: 2, lv: 50, gold: 30 }, { lv: 80, mana: 300 }, { lv: 120, mana: 1500 }];
const T7_RESET_GOLD = 100;   // 전체 초기화 = 최고 스테이지 잡몹 골드 × 100 (원정 약 20분)

// 2026-10-20 스킬 재기획 1단계 (docs/specs/skill-mastery-s7.md): 트리 포인트·노드 찍기를 없앴다. 스킬은 숙련(src/skm.js)으로 얻고 자란다.
//  T7_NODES 는 칸 이름(slash·gale…)과 줄기 데이터·연출·보스 벽이 쓰는 틀로만 남는다 — 변형·키스톤(mod·key·uvar)은 2단계 룬, 융합은 4단계 진화에서 다시
function freshT7() { return { v: 5, pick: T7_PICK_URL, rk: {}, eq: [], slots: 1, use: {}, got: [], seen: [] }; }   // eq 장착(순서 = 시전 순서) · slots 산 칸 · use 고른 모습 · got 옛 트리에서 옮겨 온 칸 · seen 이미 알린 칸 (새 스킬 자동 장착)
const t7S = () => {
  if (S.cls !== t7SyncedCls) t7Sync();
  if (!S.t7) S.t7 = freshT7();
  if (S.t7.v !== 5) skmMigrate(S.t7);
  return S.t7;
};
// 새로 가진 칸(전직·부모 ★)의 스킬을 빈 장착 칸에 넣는다 (한 번만 — 일부러 뺀 스킬은 다시 넣지 않는다)
function t7FixEq() {
  const s = S.t7, L = t7L();
  if (!s || !L) return [];
  s.seen = s.seen || [];
  const fresh = [];
  for (const slot of SKM_SLOTS) {
    if (slot === 'ult' || s.seen.includes(slot) || !skmOwnedSlot(slot)) continue;
    s.seen.push(slot); fresh.push(slot);
    const sk = L.sk[slot];
    if (sk && !s.eq.includes(sk) && s.eq.length < (s.slots || 1)) s.eq.push(sk);
  }
  return fresh;
}
const t7Tier = () => (CLASSES[S.cls] ? CLASSES[S.cls].tier : 0);
// 노드 "칸 수": 스킬 칸 = 숙련 Lv (가졌으면 1~30, 없으면 0) · 허브 = 열렸으면 1 · 나머지(변형·키스톤·스탯·모습)는 이제 찍지 않아 0
const t7Rank = (id) => {
  const n = T7_BY[id];
  if (!n) return 0;
  if (n.t === 'hub') return t7Tier() >= n.tier ? 1 : 0;
  if (n.slot) { t7S(); return n.sk && skmOwnedSlot(id) ? skmLv(n.sk) : 0; }
  return 0;
};
const t7Spent = () => 0;   // 트리 포인트 없음 (봇·검사 도구 호환)
// 원정을 떠나면 "이번 캠프" 가 끝난다 (옛 되돌리기 기록)
const t7EndCamp = () => { if (S.t7) { S.t7.camp = {}; S.t7.log = []; } };

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
  for (const n of T7_NODES) if (n.t === 'active' && t7Rank(n.id) > 0 && !s.eq.includes(n.sk) && s.eq.length < s.slots) s.eq.push(n.sk);
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
  if (t7Rank('ult') > 0 && t7Tier() >= 3 && T7_BY.ult.sk) out.unshift(T7_BY.ult.sk);   // 궁극기는 맨 앞 (쿨이 길어 먼저 쓰는 게 이득)
  return out;
}

// ── 효과 ──
// 찍은 노드의 효과를 모은다 (캐시: 찍은 상태가 바뀌면 다시)
let t7ModsKey = '', t7ModsVal = null;
function t7Mods() {
  const key = JSON.stringify(t7S().rk) + S.cls + JSON.stringify(t7S().rs || {}) + t7S().eq.join(',') + t7Tier();
  if (key === t7ModsKey) return t7ModsVal;
  const m = { stat: {}, pow: {}, cd: {}, ev: {}, spec: {}, shape: new Set(), rules: new Set(), ruleSk: {}, cdAll: 1, powAll: 1, evAll: 1, basic: 1, basicDps: 1, duel: 1, powNot: [] };
  const L = t7L();
  for (const n of T7_NODES) {
    const r = t7Rank(n.id), f = (L && L.fx && L.fx[n.id]) || n.fx;   // 줄기별 노드 효과 덮어쓰기 (t7DefLine fx)
    if (!r || !f) continue;
    if (f.stat) for (const k in f.stat) m.stat[k] = k === 'atkMul' ? (m.stat[k] || 1) * f.stat[k] : (m.stat[k] || 0) + f.stat[k] * r;
    for (const g of ['pow', 'cd', 'ev']) if (f[g]) for (const k in f[g]) { const sk = t7SkKey(k); m[g][sk] = (m[g][sk] || 1) * f[g][k]; }
    if (f.spec) for (const k in f.spec) m.spec[t7SkKey(k)] = f.spec[k];
    if (f.shape) m.shape.add(f.shape);
    if (f.rule) m.rules.add(f.rule);
    for (const g of ['evAll', 'basic', 'basicDps', 'duel']) if (f[g]) m[g] *= f[g];
    if (f.cdAll) m.cdAll *= f.cdAll;
    if (f.powAll) m.powAll *= f.powAll;
    if (f.powNot) m.powNot.push(f.powNot);
  }
  // 전설 룬 (src/rune.js) = 옛 키스톤 규칙과 대가. scope sk 규칙은 끼운 스킬에만 (ruleSk), 같은 전설은 하나만. 평균 배율(ev)은 옛 노드 값 그대로
  const seen = new Set(), skRule = (name, sk) => (m.ruleSk[name] = m.ruleSk[name] || new Set()).add(sk);
  for (const [sk, on] of Object.entries(runeLive())) for (const r of on) {
    if (!runeIsLeg(r) || seen.has(r.id)) continue;
    seen.add(r.id);
    if (r.id === 'blade') { m.rules.add('blade'); m.powAll *= 0.9; m.evAll *= 1.18; }
    else if (r.id === 'frenzy') { skRule('frenzy', sk); m.basic *= 0.85; m.basicDps *= 1.02; }
    else if (r.id === 'endless') { skRule('endless', sk); m.ev[sk] = (m.ev[sk] || 1) * 1.3; m.cd[sk] = (m.cd[sk] || 1) * 1.25; }
    else if (r.id === 'echo') { skRule('echo', sk); m.ev[sk] = (m.ev[sk] || 1) * 1.2; }
    else if (r.id === 'myriad') { skRule('myriad', sk); m.ev[sk] = (m.ev[sk] || 1) * 1.25; m.powNot.push({ sk, v: 0.8 }); }
    else if (r.id === 'reach') { m.stat.rangeMul = 3; m.basic *= 0.8; m.basicDps *= 0.9; }
    else if (r.id === 'zen') { m.stat.atkMul = (m.stat.atkMul || 1) * (SKILLS[sk] && SKILLS[sk].crit ? 2.6 : 1.9); m.stat.noCrit = 1; }   // 확정 치명 스킬에 끼우면 그 치명 몫(3.3배)을 잃으니 ×2.6
  }
  t7ModsKey = key; t7ModsVal = m;
  return m;
}
// stats() 보정: 공격 % · 체력 % · 공속 % · 치명 · 받는 피해 · 키스톤 배수
// 전직 스탯 (옛 트리 스탯 노드 몫, 이제 자동): 1차 전직 공격 +6% · 치명 +4.5% · 체력 +9% / 2차 전직 + 공속 +6% · 받는 피해 −6%
const T7_TIER_STAT = { 1: { atk: 0.06, crit: 0.045, hp: 0.09 }, 2: { aspd: 0.06, guard: 0.06 } };
function t7Stats(st) {
  const s = { ...t7Mods().stat }, T = t7Tier();
  for (const t of [1, 2]) if (T >= t) for (const [k, v] of Object.entries(T7_TIER_STAT[t])) s[k] = (s[k] || 0) + v;
  st.atk *= (1 + (s.atk || 0)) * (s.atkMul || 1);
  st.maxHp *= 1 + (s.hp || 0);
  st.aspd *= 1 + (s.aspd || 0);
  st.crit = s.noCrit ? 0 : Math.min(0.8, st.crit + (s.crit || 0));
  if (s.guard) st.guard = Math.min(0.85, 1 - (1 - st.guard) * (1 - s.guard));
  if (s.rangeMul) st.range = Math.max(st.range, Math.min(330, st.range * s.rangeMul));   // 심검: 평타 사거리 (원거리 직업은 화면 안 330 까지)
  return st;
}
const t7NodeOf = (sk) => { t7L(); return T7_BY_SKILL[sk]; };
// 칸 수 (궁극기·융합 포함)
const t7SkillRank = (sk) => { t7L(); return T7_BY_SKILL[sk] ? t7Rank(T7_BY_SKILL[sk].id) : 0; };
// 한 방 위력 배수 (기준 = 지금 트리 V2 0칸 값, core.js skillPow 가 곱한다)
// 숙련 (src/skm.js): Lv 마다 위력 +2% · 쿨 −0.8%
function t7Pow(sk) {
  const lv = Math.max(1, t7SkillRank(sk)), m = t7Mods();
  const L = t7L();
  let p = ((L && L.tune && L.tune.pow) || T7_TUNE.pow) * (1 + SKM_POW * (lv - 1)) * (m.pow[sk] || 1) * m.powAll * ((SKILLS[sk] && SKILLS[sk].t7mul) || 1);
  for (const x of m.powNot) if (x.sk ? x.sk !== sk : t7LaneOf(sk) !== x.lane) p *= x.v;   // 만검귀종: 다른 스킬 피해 −20%
  return p;
}
// 쿨타임 배수
function t7Cd(sk) {
  const lv = Math.max(1, t7SkillRank(sk)), m = t7Mods();
  return (1 - SKM_CD * (lv - 1)) * (m.cd[sk] || 1) * m.cdAll;
}
// 모습 단계 (0~3): 숙련 Lv 10·20·30 (src/skm.js). 캠프에서 낮은 모습을 골라 쓸 수 있다 (S.t7.use)
const t7StageMax = (sk) => (t7SkillRank(sk) > 0 ? skmStage(sk) : 0);
function t7Stage(sk) {
  const max = t7StageMax(sk), use = t7S().use[sk];
  return use == null ? max : Math.max(0, Math.min(max, use));
}
// 고유 특수 목록 (SPEC_TYPES 효과 — 범용 룬, src/rune.js). 스킬마다 여러 개
const t7Specs = (sk) => [...(t7Mods().spec[sk] ? [t7Mods().spec[sk]] : []), ...runeSpecs(sk)];
// 결투·레이드·전투력용 평균 피해 배율 (연출이 필요한 근사 효과 + 고유 특수 ev)
function t7Ev(sk) {
  return (t7Mods().ev[sk] || 1) * t7Mods().evAll * t7Specs(sk).reduce((a, sp) => a * (1 + sp.v * SPEC_TYPES[sp.type].ev), 1);
}
// 전투 규칙이 켜졌는가 (src/tree7-fx.js) · 평타 피해 배율 (world.js releaseAttack) · 평타 DPS 평균 배율 (core.js dpsOf)
const t7Rule = (name, sk) => t7On() && (sk ? !!(t7Mods().ruleSk[name] && t7Mods().ruleSk[name].has(sk)) : t7Mods().rules.has(name));   // sk: 끼운 스킬에만 걸리는 전설 룬 규칙
// 무념(b_k3): 치명이 전혀 안 터진다 — 확정 치명 스킬(일섬·섬광 베기·천검)도 일반타 (core.js dpsOf·profile, skills.js, world.js hitMonster)
// 결투 전용 공격력 배율 (궁극기 변형 셋 중 하나에 붙음, fx.duel). 다른 갈래 3차 키스톤까지 찍을수록 줄어든다 (트리를 거의 다 찍으면 갈래 약점이 없어져서) — 하나 1 · 둘 ½ · 셋 0
function t7Duel() {
  if (!t7On()) return 1;
  const L = t7L();
  return (L && T7_DUEL_LINE[L.id]) || 1;
}
const t7NoCrit = () => t7On() && !!t7Mods().stat.noCrit;
const t7BasicMul = () => (t7On() ? t7Mods().basic : 1);
const t7BasicDps = () => (t7On() ? t7Mods().basic * t7Mods().basicDps : 1);
// 변형이 바꾼 기술 모양 (타격 추가·범위). k = skillAt 결과 (숙련 모습이 반영된 것)
const t7ShapeCache = {};
function t7Shape(sk, k) {
  const m = t7Mods(), sh = m.shape, rsh = runeShapes(sk), key = sk + k.stage + '|' + [...sh].join(',') + '|' + rsh.map((x) => x.shape + x.v).join(',');
  if (t7ShapeCache[key]) return t7ShapeCache[key];
  const L = t7L(), slot = (L && L.slotOf[sk]) || sk;   // 칸 이름으로 본다 (slash 1차 · gale·iaido 2차 · whirl·flash·wave·storm 새 · ult)
  let s = k;
  const big = (hits) => hits.reduce((a, h) => (h[1] > a[1] ? h : a), hits[0]);
  const after = (t, dt) => Math.min(0.98, t + dt / s.dur);
  if (slot === 'slash' && sh.has('twin')) { const b = big(s.hits); s = { ...s, hits: [...s.hits, [after(b[0], 0.15), b[1] * 0.6]] }; }
  if (slot === 'slash' && sh.has('slashWave')) { const b = big(s.hits); s = { ...s, hits: [...s.hits, [after(b[0], 0.2), b[1] * 0.5, { area: 'line', reach: 3 }]] }; }
  if (slot === 'gale' && sh.has('more')) {
    const small = s.hits.filter((h) => h === s.hits.reduce((a, x) => (x[1] < a[1] ? x : a), s.hits[0]));
    const extra = small.slice(0, 3).map((h, i) => [Math.min(0.97, h[0] + 0.03 * (i + 1)), h[1]]);
    s = { ...s, hits: [...s.hits.map((h) => (small.includes(h) ? [h[0], h[1] * 0.85, ...h.slice(2)] : h)), ...extra.map((h) => [h[0], h[1] * 0.85])] };
  }
  if (slot === 'whirl' && sh.has('grow')) s = { ...s, radius: (s.radius || 40) * 2 };
  if (slot === 'whirl' && sh.has('follow')) s = { ...s, radius: (s.radius || 40) + 60 };
  // 비검: 관통 전엔 앞의 한 적만(투사체가 첫 적에서 멈춘다), 관통이면 앞 줄 전부 · 검기 폭풍은 관통이면 범위 +20%
  if (slot === 'wave') s = { ...s, area: sh.has('pierce') ? 'line' : 'single', reach: 4, hits: s.hits.map((h) => [h[0], h[1]]) };
  if (slot === 'storm' && sh.has('pierce')) s = { ...s, radius: (s.radius || 120) * 1.2 };
  if (slot === 'flash' && sh.has('after')) s = { ...s, hits: [...s.hits, ...s.hits.map((h) => [after(h[0], 0.5), h[1] * 0.5, ...h.slice(2)])] };
  if (slot === 'flash' && sh.has('triple')) s = { ...s, hits: s.hits.flatMap((h) => [0, 0.04, 0.08].map((d) => [Math.min(0.98, h[0] + d), h[1] * 0.5, ...h.slice(2)])) };
  if (slot === 'storm' && sh.has('split')) s = { ...s, hits: [...s.hits, ...s.hits.map((h) => [after(h[0], 0.15), h[1] * 0.5, { area: 'all', radius: 60 }])] };
  if (slot === 'ult' && sh.has('uvA')) s = { ...s, hits: s.hits.flatMap((h) => [[h[0], h[1] * 0.5], [Math.min(0.98, h[0] + 0.02), h[1] * 0.5]]) };
  // 일도양단: 타격 수·시점은 그대로(천검 연출이 타격 순서를 쓴다), 피해의 80% 를 마지막 한 칼에 몰아준다
  if (slot === 'ult' && sh.has('uvB')) { const tot = s.hits.reduce((a, h) => a + h[1], 0), n = s.hits.length; s = { ...s, hits: s.hits.map((h, i) => [h[0], i === n - 1 ? tot * 0.8 : (tot * 0.2) / (n - 1), ...h.slice(2)]) }; }
  if (slot === 'ult' && sh.has('uvK')) s = { ...s, radius: (s.radius || 230) * 1.3 };
  // 모양 룬 (src/rune.js): 어느 스킬에나 덧타격 — 한 번 더 · 잔상 · 파열 · 난무
  for (const x of rsh) {
    if (x.shape === 'twin') { const b = big(s.hits); s = { ...s, hits: [...s.hits, [after(b[0], 0.15), b[1] * x.v, ...b.slice(2)]] }; }
    else if (x.shape === 'after') s = { ...s, hits: [...s.hits, ...s.hits.map((h) => [after(h[0], 0.5), h[1] * x.v, ...h.slice(2)])] };
    else if (x.shape === 'burst') s = { ...s, hits: [...s.hits, ...s.hits.map((h) => [after(h[0], 0.12), h[1] * x.v, { area: 'all', radius: 60 }])] };
    else if (x.shape === 'more') {
      const lo = s.hits.reduce((a, h) => (h[1] < a[1] ? h : a), s.hits[0]), n = Math.max(1, Math.round(x.v));
      s = { ...s, hits: [...s.hits.map((h) => (h === lo ? [h[0], h[1] * 0.85, ...h.slice(2)] : h)), ...Array.from({ length: n }, (_, i) => [Math.min(0.97, lo[0] + 0.03 * (i + 1)), lo[1] * 0.85, ...lo.slice(2)])] };
    }
  }
  return (t7ShapeCache[key] = s);
}

// ── 봇·측정용: 빌드별 포인트 쓰기 순서 (dev/lifespan-bot.js · progress-bot.js --build) ──
// 봇·측정용 장착 우선순위 (숙련 — 무엇을 데려가느냐가 성장 방향). a 연타 · b 발도 · k 검기
const T7_BUILDS = {
  a: ['gale', 'whirl', 'slash', 'iaido', 'flash', 'wave', 'storm'],
  b: ['iaido', 'flash', 'slash', 'gale', 'whirl', 'wave', 'storm'],
  k: ['wave', 'storm', 'slash', 'iaido', 'flash', 'gale', 'whirl'],
};
// 빌드대로 장착 (가진 스킬만, 우선순위 앞부터 칸 수만큼). buy: 장착 칸도 산다 · tomes: 비전서를 장착 스킬 중 가장 낮은 것부터 바친다 (봇)
function t7AutoSpend(build = 'a', buy = true, tomes = buy) {
  if (!t7On()) return 0;
  let n = 0;
  t7S(); t7FixEq();
  if (buy) while (t7BuySlot()) n++;
  const s = t7S(), L = t7L(), order = T7_BUILDS[build] || T7_BUILDS.a;
  s.eq = order.filter((id) => L && L.sk[id] && skmOwnedSlot(id)).map((id) => L.sk[id]).slice(0, t7Slots());
  if (buy && typeof runeAutoFill === 'function') runeAutoFill({ a: 'shield', b: 'enrage', k: 'adds' }[build]);   // 봇: 룬 합치기·끼우기 (src/rune.js)
  if (tomes) for (let g = 0; g < 50 && S.tomes > 0; g++) {
    const sk = s.eq.filter((x) => skmFeedMax(x) > 0).sort((p, q) => skmXp(p) - skmXp(q))[0];
    if (!sk || !skmFeed(sk, 10)) break;
  }
  return n;
}
// 캠프 도착·불러오기 (core.js): 새로 가진 스킬을 빈 장착 칸에 (돈은 안 쓴다)
function t7AutoTick() {
  if (!t7On() || !S.t7) return;
  t7S(); t7FixEq();
}
const t7PathCost = () => 0;   // 트리 없음 (검사 도구 호환)
// 새 스킬의 연출: 3단계 전까지는 같은 계열 스킬의 연출을 빌려 쓴다 (skills.js 가 SKILL_FX 에 이어 붙인다)

// ── 보스 벽 (4단계, 이 줄기 캐릭터의 원정 1~120 스테이지만) ──
// 일반 보스 체력 ×0.8 · 10칸 중간 보스(10·30·50…) 체력 ×2.5 공격 ×1.5 + 기믹 1 · 20칸 지역 보스(필드 보스) 체력 ×4 공격 ×2 + 기믹 2 (필드 보스 배율 대신)
// 기믹의 실제 규칙은 src/tree7-wall.js (게임), 봇·오프라인 계산(core.js simulate)은 아래 근사: 막는 갈래를 찍었는지(t7Counter 0~1)로 DPS·받는 피해를 깎는다
let T7_WALL_MAX = 120;   // 측정용으로 바꿀 수 있게 let
const T7_GIM = {
  //  pen: 대응 0 일 때 DPS 손실 — 2026-10-20 0.35~0.45 → 0.1 (정답 강요 금지, docs/specs/skill-redesign.md 원칙 ③). 대응은 2단계 룬 꼬리표로 다시 · cnt: 대응 노드 → 무게 (액티브·융합은 장착해야, 칸 비율만큼) · lane: auto 봇이 갈아탈 갈래
  shield: { icon: '🛡️', name: '보호막', lane: 'a', pen: 0.1, cnt: { a_more: 0.35, whirl: 0.35, uv_a: 0.45, a_key: 0.15, f_ak: 0.15 }, tip: '연타 갈래 (난무 +3타·검무 회오리·만검)' },
  adds: { icon: '👥', name: '졸개', lane: 'k', pen: 0.1, cnt: { k_pierce: 0.35, storm: 0.35, k_split: 0.2, uv_k: 0.45, f_bk: 0.15, f_ak: 0.15 }, tip: '검기 갈래 (관통·검기 폭풍·분열·검우)' },
  enrage: { icon: '🔥', name: '광폭화', lane: 'b', pen: 0.1, cnt: { b_exec: 0.3, iaido: 0.2, flash: 0.3, uv_b: 0.45, b_key: 0.2 }, tip: '발도 갈래 (처형·일섬·섬광 베기·일도양단)' },
  pool: { icon: '🩸', name: '장판', lane: 'c', pen: 0, cnt: { c_hp: 0.5, c_def: 0.5 }, tip: '체력·방어 스탯' },
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
// 숙련 단계: 대응 노드(변형·키스톤)를 찍지 않으니, 기본 대응 0.5 (기믹 손실은 pen × 0.5 = 5% 안팎) + 장착 스킬 몫. 장판은 전직 스탯(체력·방어)이 자동이라 2차부터 1
function t7Counter(g) {
  const s = t7S();
  if (g === 'pool') return t7Tier() >= 2 ? 1 : 0.5;
  let c = 0.5 + (runeTags().has(g) ? 0.25 : 0);   // 룬 꼬리표(보호막·졸개·광폭화)를 장착 스킬에 끼웠으면 +0.25 (src/rune.js)
  for (const [id, w] of Object.entries(T7_GIM[g].cnt)) {
    const n = T7_BY[id], r = t7Rank(id);
    if (!r || (n.sk && n.t !== 'ult' && !s.eq.includes(n.sk))) continue;
    c += w * Math.min(1, r / 30);   // 스킬 칸 = 숙련 Lv / 30
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
  if (!g) return null;
  const G = T7_GIM[g], L = t7L(), ln = L && L.lanes && L.lanes[G.lane];   // 줄기마다 갈래 이름이 다르다 (검성 글은 T7_GIM.tip)
  return { g, ...G, tip: ln ? `${ln.name}${ln.tip ? ` (${ln.tip})` : ''}` : G.tip };
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
