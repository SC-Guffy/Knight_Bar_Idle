'use strict';
// 밸런스 수치, 테이블, 스프라이트. 로직은 core.js, 화면은 world.js / ui.js.

// ───────────────────────── 기본 상수 ─────────────────────────
const PX = 3;                   // 도트 1칸 = 3px
const BAR_H = 150;              // 하단바 높이 (main.js 의 BAR_HEIGHT 와 같아야 함)
const FPS = 30;
const WALK_SPEED = 42;          // px/s
const RETURN_SPEED = 80;
const MOB_GAP = 170;              // 한 바퀴(스테이지)에 깔리는 일반 몬스터 간격(px)
const SAVE_KEY = 'knight-bar-save-v1';
const CAMP_X = 64;              // 캠프에서 기사가 앉는 화면 x

// 개발용 시간 배속 (KB_SPEED=20 npm start). 스태미나·휴식·건설·부상 시간에만 적용
const TIME_SCALE = Math.max(1, Number(new URLSearchParams(location.search).get('speed')) || 1);

// ───────────────────────── 원정 / 캠프 ─────────────────────────
const STAMINA_DRAIN = 2.5 / 60;       // 초당 소모 → 스태미나 100 = 40분 원정
const MIN_DEPART_STAMINA = 20;
const DEFEAT_STAMINA = 10;            // 쓰러지면 잃는 스태미나
const DEFEAT_DOWN_SEC = 2.5;          // 쓰러져 있는 시간
const BOX_DROP = 0.05;                // 일반 몬스터 전리품 드랍률 (보스는 100%)
const POTION_AT = 0.3;                // 체력 30% 이하에서 물약 자동 사용
const CAMP_HEAL_PER_SEC = 0.1;        // 캠프에서 초당 최대 체력의 10% 회복

// ───────────────────────── 전투 거리 ─────────────────────────
const MELEE_REACH = 14;               // 몬스터 공격 사거리 (몸 반폭 제외)
const MONSTER_SPEED = 24;             // 몬스터가 기사에게 다가오는 속도 px/s
const AGGRO_RANGE = 260;              // 이 거리 안에 들어오면 몬스터가 다가온다

// ───────────────────────── 건물 ─────────────────────────
const BUILD_MAX = 20;
const trainCapAt = (lv) => 10 * lv;
const maxStaminaAt = (lv) => 100 + 25 * (lv - 1);
const restSecAt = (lv) => (20 * 60) / (1 + 0.15 * (lv - 1));   // 0 → 최대 스태미나까지
const bagCapAt = (lv) => 20 + 6 * (lv - 1);
const forgeMultAt = (lv) => Math.pow(1.3, lv - 1);
const buildTimeAt = (lv) => 60 * Math.pow(1.8, lv - 1);          // lv → lv+1 소요 시간(초)

const BUILDINGS = {
  training: {
    name: '훈련장', icon: '🎯', mul: { gold: 1, wood: 1, ore: 0.6, mana: 0.6 },
    effect: (lv) => `훈련 최대 Lv ${trainCapAt(lv)}`,
  },
  inn: {
    name: '여관', icon: '🛏️', mul: { gold: 1, wood: 1.3, ore: 0.4, mana: 0.8 },
    effect: (lv) => `스태미나 ${maxStaminaAt(lv)} · 완전 휴식 ${Math.round(restSecAt(lv) / 60)}분`,
  },
  storage: {
    name: '창고', icon: '📦', mul: { gold: 0.8, wood: 1.5, ore: 0.3, mana: 0.6 },
    effect: (lv) => `가방 ${bagCapAt(lv)}칸`,
  },
  forge: {
    name: '대장간', icon: '⚒️', mul: { gold: 1.2, wood: 0.4, ore: 1.6, mana: 1.4 },
    effect: (lv) => `무기 공격력 ×${forgeMultAt(lv).toFixed(2)}`,
  },
};

function buildCost(id, lv) {
  const m = BUILDINGS[id].mul;
  return {
    gold: Math.floor(40 * Math.pow(1.9, lv - 1) * m.gold),
    wood: Math.floor(20 * Math.pow(2, lv - 1) * m.wood),
    ore: Math.floor(12 * Math.pow(2, lv - 1) * m.ore),
    mana: lv >= 2 ? Math.floor(4 * Math.pow(1.9, lv - 2) * m.mana) : 0,
  };
}

// ───────────────────────── 재화 / 보급품 ─────────────────────────
const MATERIALS = {
  wood: { name: '목재', icon: '🪵' },
  ore: { name: '철광석', icon: '🪨' },
  mana: { name: '마력석', icon: '💎' },
};

// price 는 최고 스테이지의 몬스터 골드 × 배수
const SUPPLIES = {
  lunch:  { name: '도시락',     icon: '🍱', price: 30, w: 35, desc: '캠프에서 먹으면 스태미나 +50' },
  potion: { name: '회복 물약',  icon: '🧪', price: 20, w: 40, desc: '원정 중 체력 30% 이하에서 자동 사용 (쓰러짐 방지)' },
  charm:  { name: '행운의 부적', icon: '🍀', price: 60, w: 12, desc: '이번 원정 동안 좋은 등급의 전리품이 더 잘 나옴' },
  elixir: { name: '투지의 영약', icon: '🔥', price: 60, w: 13, desc: '이번 원정 동안 공격력 +30%' },
  protect: { name: '보호 주문서', icon: '📜', price: 400, w: 4, desc: '강화 실패로 단계가 떨어지거나 초기화될 때 대신 부서져서 막아 줌' },
};
// 가방에서 소비 아이템이 나올 때 테두리 색으로 쓰는 등급
const SUPPLY_GRADE = { lunch: 0, potion: 0, charm: 2, elixir: 2, protect: 3 };

// ───────────────────────── 전리품 등급 ─────────────────────────
// 장비·골동품 공통. stat: 장비 능력치 배수, sell: 판매가(몬스터 골드 배수), res: 골동품 재화 배수
// 원정 1회(전리품 약 20개, 보스 3마리 기준) 장비 기대치: 영웅 4~5회에 1개, 전설 약 40회에 1개 (부적을 쓰면 약 20회)
const GRADES = [
  { name: '일반', color: '#b8bcc6', w: 64,  stat: 1,   sell: 3,  res: 1 },
  { name: '고급', color: '#5fcf5a', w: 26,  stat: 1.5, sell: 6,  res: 2 },
  { name: '희귀', color: '#4aa3ff', w: 8,   stat: 2.2, sell: 12, res: 4 },
  { name: '영웅', color: '#b36bff', w: 1.8, stat: 3.2, sell: 30, res: 8 },
  { name: '전설', color: '#ff9f1c', w: 0.2, stat: 4.6, sell: 80, res: 18 },
];
const CHARM_BONUS = [0.5, 1, 1.6, 2, 2];     // 행운의 부적: 등급별 가중치 배수 (전설은 2배까지만)

// 가방에 들어오는 전리품 종류 비율 (보스는 장비가 더 잘 나온다)
const LOOT_KIND_W = { gear: 40, curio: 45, use: 15 };
const LOOT_KIND_W_BOSS = { gear: 65, curio: 25, use: 10 };

// ───────────────────────── 장비 ─────────────────────────
// 능력치는 드랍된 스테이지(s)와 등급으로 정해지고, 강화 단계(부위별)가 곱해진다.
//  무기: 공격력 (대장간 배율을 받음) · 갑옷: 체력 · 반지: 치명 확률 + 치명 피해
const GEAR_SLOTS = {
  weapon: { name: '무기', icon: '🗡️' },
  armor:  { name: '갑옷', icon: '🛡️' },
  ring:   { name: '반지', icon: '💍' },
};

// 장비 도감. 부위·등급마다 고유한 이름·설명·도트 아이콘을 가진다 (드랍 시 같은 부위·등급에서 하나를 고름).
//  spr: GEAR_SPR 모양, pal: 모양 글자별 색 (B 본체 · b 그늘 · W 광택 · H 손잡이/테두리 · G 장식 · J 보석)
const IRON = { B: '#b8bcc6', b: '#7d8290', W: '#eef1f6' };
const WOOD = '#7a4a22', LEATHER = '#8a5a2b', GOLD = '#ffd257';
const GEAR_ITEMS = {
  // ── 무기 ──
  rust_sword:   { slot: 'weapon', g: 0, name: '녹슨 장검', icon: '🗡️', spr: 'sword', desc: '창고 구석에서 굴러다니던 검. 그래도 날은 서 있다.',
    pal: { B: '#a8805e', b: '#6b4530', W: '#d2b08f', H: WOOD, G: '#6b4530', J: '#6b4530' } },
  wood_axe:     { slot: 'weapon', g: 0, name: '나무꾼의 손도끼', icon: '🪓', spr: 'axe', desc: '장작 패던 도끼. 고블린 머리도 잘 쪼갠다.',
    pal: { ...IRON, H: WOOD, G: '#5e3818', J: WOOD } },
  hunter_bow:   { slot: 'weapon', g: 0, name: '사냥꾼의 단궁', icon: '🏹', spr: 'bow', desc: '토끼 사냥용이었지만 박쥐도 곧잘 맞춘다.',
    pal: { B: '#e9e4d4', b: '#b8b0a0', W: '#e9e4d4', H: WOOD, G: LEATHER, J: '#b8b0a0' } },
  guard_sword:  { slot: 'weapon', g: 1, name: '경비대 제식검', icon: '🗡️', spr: 'sword', desc: '왕국 경비대의 표준 검. 무게 중심이 잘 잡혀 있다.',
    pal: { ...IRON, H: LEATHER, G: '#c9a227', J: '#3a5a9e' } },
  steel_spear:  { slot: 'weapon', g: 1, name: '강철 장창', icon: '🔱', spr: 'spear', desc: '끝을 날카롭게 벼린 창. 적이 닿기 전에 찌른다.',
    pal: { ...IRON, H: WOOD, G: '#c9a227', J: '#c9a227' } },
  smith_hammer: { slot: 'weapon', g: 1, name: '대장장이의 망치', icon: '🔨', spr: 'hammer', desc: '모루를 두드리던 망치. 해골을 두드려도 잘 든다.',
    pal: { B: '#8c95a6', b: '#5a6070', W: '#c9d1dd', H: WOOD, G: '#5a6070', J: '#e0443c' } },
  frost_blade:  { slot: 'weapon', g: 2, name: '서리 칼날', icon: '🗡️', spr: 'sword', desc: '칼날에 늘 서리가 맺혀 있다. 베인 자리가 얼어붙는다.',
    pal: { B: '#8fd8ff', b: '#3f8fd1', W: '#e8fbff', H: '#2a4a6a', G: '#cfeeff', J: '#4aa3ff' } },
  thunder_maul: { slot: 'weapon', g: 2, name: '천둥 망치', icon: '🔨', spr: 'hammer', desc: '내려칠 때마다 먼 곳에서 천둥이 울린다.',
    pal: { B: '#ffd84a', b: '#c79a12', W: '#fffbe0', H: '#4b3a7a', G: '#7cc4ff', J: '#7cc4ff' } },
  wind_bow:     { slot: 'weapon', g: 2, name: '바람새의 활', icon: '🏹', spr: 'bow', desc: '시위를 당기면 깃털 같은 바람이 인다.',
    pal: { B: '#e8fffb', b: '#8affd9', W: '#e8fffb', H: '#3fb8a8', G: '#ffffff', J: '#8affd9' } },
  blood_scythe: { slot: 'weapon', g: 3, name: '흡혈의 낫', icon: '🩸', spr: 'scythe', desc: '베어 낸 적의 피를 마신다는 저주받은 낫.',
    pal: { B: '#d94a5a', b: '#7a1d2a', W: '#ffb3b8', H: '#2e1d24', G: '#7a1d2a', J: '#ff3b4b' } },
  dragon_blade: { slot: 'weapon', g: 3, name: '용비늘 대검', icon: '🐉', spr: 'greatsword', desc: '용의 비늘을 두드려 펴서 만든 거대한 검.',
    pal: { B: '#4fcf8a', b: '#1f7a4a', W: '#c8ffe0', H: '#5a3a1a', G: '#ffb13b', J: '#ff5a2b' } },
  star_staff:   { slot: 'weapon', g: 3, name: '별빛 지팡이', icon: '🪄', spr: 'staff', desc: '밤하늘에서 떨어진 별 조각이 끝에 박혀 있다.',
    pal: { B: '#b3a6ff', b: '#6a5bd6', W: '#ffffff', H: '#4b3a7a', G: GOLD, J: '#b3a6ff' } },
  solaris:      { slot: 'weapon', g: 4, name: '태양검 솔라리스', icon: '☀️', spr: 'greatsword', desc: '태양의 불꽃을 벼려 만든 검. 칼집에 넣어도 빛이 샌다.',
    pal: { B: '#ffd257', b: '#e08a1a', W: '#fffbe0', H: '#b3261e', G: '#ff7a1a', J: '#ff3b1f' } },
  abyss_trident:{ slot: 'weapon', g: 4, name: '심연의 삼지창', icon: '🔱', spr: 'trident', desc: '바다 밑바닥에서 건져 올린 창. 쥐면 파도 소리가 들린다.',
    pal: { B: '#6a5bff', b: '#2a1f6b', W: '#b6a8ff', H: '#1b1d27', G: '#7a5bff', J: '#35ffd0' } },
  yggdrasil:    { slot: 'weapon', g: 4, name: '세계수의 활 이그드라실', icon: '🌳', spr: 'bow', desc: '세계수의 가지로 만든 활. 쏜 화살에서 새싹이 돋는다.',
    pal: { B: '#fff6c2', b: '#d9c87a', W: '#fff6c2', H: '#6b8f3a', G: GOLD, J: '#7dff8a' } },

  // ── 갑옷 ──
  rag_tunic:    { slot: 'armor', g: 0, name: '누더기 가죽옷', icon: '🧥', spr: 'tunic', desc: '여기저기 기운 자국투성이. 없는 것보단 낫다.',
    pal: { B: '#8a6240', b: '#5e3f26', W: '#a8805e', H: '#6b4a2b', G: '#4a3420', J: '#9a8a70' } },
  old_chain:    { slot: 'armor', g: 0, name: '헌 사슬 조끼', icon: '⛓️', spr: 'chain', desc: '고리 몇 개가 빠져 있다. 바람이 잘 통한다.',
    pal: { B: '#7d8290', b: '#565a66', W: '#b8bcc6', H: '#5e3f26', G: '#4a3420', J: '#8c95a6' } },
  novice_robe:  { slot: 'armor', g: 0, name: '견습생 로브', icon: '🥋', spr: 'robe', desc: '마법학교 견습생들이 입는 헐렁한 로브.',
    pal: { B: '#6a7a9a', b: '#4a5670', W: '#8a9aba', H: '#4a5670', G: '#c9b98a', J: '#c9b98a' } },
  guard_plate:  { slot: 'armor', g: 1, name: '경비대 흉갑', icon: '🛡️', spr: 'plate', desc: '성문을 지키는 경비대의 흉갑. 창 한두 번은 막아 준다.',
    pal: { B: '#aab2c0', b: '#6f7788', W: '#e8ecf2', H: '#6f7788', G: '#c9a227', J: '#3a5a9e' } },
  wolf_leather: { slot: 'armor', g: 1, name: '늑대가죽 갑옷', icon: '🐺', spr: 'tunic', desc: '숲 늑대의 두꺼운 가죽을 덧댔다. 아직 늑대 냄새가 난다.',
    pal: { B: '#9aa0a8', b: '#6a707a', W: '#c9cdd4', H: '#5e3f26', G: '#3b2a1a', J: '#e9e4d4' } },
  monk_robe:    { slot: 'armor', g: 1, name: '수도사의 법의', icon: '📿', spr: 'robe', desc: '산속 수도원의 법의. 입으면 마음이 차분해진다.',
    pal: { B: '#b07a3a', b: '#7a4f22', W: '#d09a5a', H: '#7a4f22', G: '#e9d9a8', J: '#e0443c' } },
  silver_plate: { slot: 'armor', g: 2, name: '은빛 판금 갑옷', icon: '🛡️', spr: 'plate', desc: '달빛을 받으면 은은하게 빛나는 판금.',
    pal: { B: '#dfe6f0', b: '#9aa6ba', W: '#ffffff', H: '#9aa6ba', G: '#4aa3ff', J: '#4aa3ff' } },
  frost_wolf:   { slot: 'armor', g: 2, name: '서리늑대 갑옷', icon: '❄️', spr: 'tunic', desc: '북방 설원의 서리늑대 가죽. 한기를 막고 칼날을 튕겨 낸다.',
    pal: { B: '#cfeeff', b: '#7ab8e0', W: '#ffffff', H: '#3f6f9a', G: '#2a4a6a', J: '#8fd8ff' } },
  arcane_robe:  { slot: 'armor', g: 2, name: '비전술사의 로브', icon: '🔮', spr: 'robe', desc: '소매 안쪽에 방어 마법진이 수놓아져 있다.',
    pal: { B: '#3b4fb8', b: '#26327a', W: '#5b72e0', H: '#26327a', G: GOLD, J: '#7cc4ff' } },
  dragon_mail:  { slot: 'armor', g: 3, name: '용비늘 갑옷', icon: '🐲', spr: 'chain', desc: '용의 비늘을 한 장씩 엮었다. 불길 속에서도 뜨겁지 않다.',
    pal: { B: '#3fae6a', b: '#1f6b3f', W: '#9dffc4', H: '#5a3a1a', G: '#ffb13b', J: '#ff5a2b' } },
  crusader:     { slot: 'armor', g: 3, name: '성전사의 판금', icon: '✝️', spr: 'plate', desc: '수많은 성전을 견딘 갑옷. 흠집 하나하나가 훈장이다.',
    pal: { B: '#f4f1e8', b: '#b8b0a0', W: '#ffffff', H: '#b8b0a0', G: GOLD, J: '#e0443c' } },
  shadow_shroud:{ slot: 'armor', g: 3, name: '그림자 수의', icon: '🌑', spr: 'robe', desc: '입으면 발소리가 사라지고 그림자가 짙어진다.',
    pal: { B: '#3a344a', b: '#1b1824', W: '#5a5270', H: '#1b1824', G: '#8a4fd1', J: '#c99bff' } },
  phoenix:      { slot: 'armor', g: 4, name: '불사조의 갑주', icon: '🔥', spr: 'plate', desc: '불사조의 깃털이 엮여 있다. 쓰러져도 다시 일어날 것만 같다.',
    pal: { B: '#ff7a1a', b: '#b3261e', W: '#ffe066', H: '#b3261e', G: GOLD, J: '#fff6c2' } },
  celestial:    { slot: 'armor', g: 4, name: '천공의 성갑', icon: '☁️', spr: 'chain', desc: '구름 위 성채의 기사단장이 입던 갑옷. 깃털처럼 가볍다.',
    pal: { B: '#e8f4ff', b: '#9ac4ff', W: '#ffffff', H: GOLD, G: GOLD, J: '#7cc4ff' } },

  // ── 반지 ──
  copper_band:  { slot: 'ring', g: 0, name: '구리 가락지', icon: '💍', spr: 'band', desc: '시장에서 산 싸구려 반지. 끼면 손가락이 초록색이 된다.',
    pal: { B: '#c7773a', b: '#8a4f22', W: '#f0b07a', H: '#8a4f22', G: '#8a4f22', J: '#8a4f22' } },
  pebble_ring:  { slot: 'ring', g: 0, name: '조약돌 반지', icon: '🪨', spr: 'gem', desc: '냇가에서 주운 예쁜 돌을 박았다. 행운이 깃들었다나.',
    pal: { B: '#9a8a70', b: '#6b5e4a', W: '#c9b98a', H: '#6b5e4a', G: '#6b5e4a', J: '#8c95a6' } },
  silver_band:  { slot: 'ring', g: 1, name: '은반지', icon: '💍', spr: 'band', desc: '매끈하게 다듬은 은반지. 안쪽에 누군가의 이름이 새겨져 있다.',
    pal: { B: '#dfe6f0', b: '#9aa6ba', W: '#ffffff', H: '#9aa6ba', G: '#9aa6ba', J: '#9aa6ba' } },
  amber_ring:   { slot: 'ring', g: 1, name: '호박 반지', icon: '🟠', spr: 'gem', desc: '호박 속에 작은 벌레가 갇혀 있다. 천 년째 잠들어 있다.',
    pal: { B: '#c9a227', b: '#8a6a12', W: '#ffe98a', H: '#8a6a12', G: '#8a6a12', J: '#ff9f1c' } },
  sapphire_ring:{ slot: 'ring', g: 2, name: '사파이어 반지', icon: '💎', spr: 'gem', desc: '깊은 바다색 보석. 들여다보면 물결이 일렁인다.',
    pal: { B: '#dfe6f0', b: '#9aa6ba', W: '#ffffff', H: '#9aa6ba', G: '#9aa6ba', J: '#2a6bff' } },
  owl_signet:   { slot: 'ring', g: 2, name: '올빼미 인장 반지', icon: '🦉', spr: 'signet', desc: '현자의 가문에 전해지는 인장. 약점이 눈에 들어온다.',
    pal: { B: '#c9a227', b: '#8a6a12', W: '#ffffff', H: '#8a6a12', G: '#8a6a12', J: '#4aa3ff' } },
  vampire_ring: { slot: 'ring', g: 3, name: '흡혈귀의 반지', icon: '🦇', spr: 'gem', desc: '끼는 순간 손가락이 서늘해진다. 붉은 보석이 맥박처럼 뛴다.',
    pal: { B: '#3a344a', b: '#1b1824', W: '#8a8aa0', H: '#1b1824', G: '#1b1824', J: '#ff2b3b' } },
  storm_ring:   { slot: 'ring', g: 3, name: '폭풍의 고리', icon: '⚡', spr: 'gem', desc: '보석 안에 작은 번개가 갇혀 쉴 새 없이 부딪힌다.',
    pal: { B: '#7cc4ff', b: '#3d6bd6', W: '#ffffff', H: '#3d6bd6', G: '#3d6bd6', J: '#ffe066' } },
  kings_seal:   { slot: 'ring', g: 4, name: '왕의 인장 반지', icon: '👑', spr: 'signet', desc: '잃어버린 왕국의 마지막 왕이 끼던 반지.',
    pal: { B: GOLD, b: '#c98a12', W: '#fffbe0', H: '#c98a12', G: '#c98a12', J: '#e0443c' } },
  ouroboros:    { slot: 'ring', g: 4, name: '무한의 고리 우로보로스', icon: '🐍', spr: 'ouro', desc: '제 꼬리를 문 뱀. 끝도 시작도 없다.',
    pal: { B: '#35ffd0', b: '#1f8a7a', W: '#e8fffb', H: '#1f8a7a', G: '#1f8a7a', J: '#ff3b4b' } },
};
const gearStageMult = (s) => Math.pow(1.18, s - 1);
function gearBase(slot, g, s, roll) {
  const k = GRADES[g].stat * roll;
  if (slot === 'weapon') return { atk: 6 * gearStageMult(s) * k };
  if (slot === 'armor') return { hp: 40 * gearStageMult(s) * k };
  const ringS = 1 + 0.02 * (s - 1);
  return { crit: 0.01 * k * ringS, critMult: 0.12 * k * ringS };
}

// ───────────────────────── 강화 ─────────────────────────
// 강화 단계는 부위(무기·갑옷·반지)에 붙어 있어서 장비를 바꿔 껴도 유지된다.
// ENHANCE[L] = L → L+1 시도. 실패하면 down 확률로 한 단계 하락, reset 확률로 +0 초기화, 나머지는 유지.
// 0에서 시작한 기대 시도 횟수 (보호 주문서 없이): +10 약 18회 · +15 약 70회 · +20 약 700회 · +25 약 48,000회
const ENHANCE_MAX = 25;
const ENHANCE = [
  // +1 ~ +5: 실패해도 유지
  { rate: 0.95, down: 0,    reset: 0 },
  { rate: 0.90, down: 0,    reset: 0 },
  { rate: 0.85, down: 0,    reset: 0 },
  { rate: 0.80, down: 0,    reset: 0 },
  { rate: 0.75, down: 0,    reset: 0 },
  // +6 ~ +10: 실패하면 절반쯤 하락
  { rate: 0.70, down: 0.4,  reset: 0 },
  { rate: 0.65, down: 0.45, reset: 0 },
  { rate: 0.60, down: 0.5,  reset: 0 },
  { rate: 0.55, down: 0.5,  reset: 0 },
  { rate: 0.50, down: 0.55, reset: 0 },
  // +11 ~ +15: 실패하면 대부분 하락
  { rate: 0.46, down: 0.6,  reset: 0 },
  { rate: 0.43, down: 0.6,  reset: 0 },
  { rate: 0.40, down: 0.65, reset: 0 },
  { rate: 0.37, down: 0.65, reset: 0 },
  { rate: 0.35, down: 0.7,  reset: 0 },
  // +16 ~ +20: 하락 + 초기화 위험
  { rate: 0.33, down: 0.6,  reset: 0.02 },
  { rate: 0.31, down: 0.6,  reset: 0.025 },
  { rate: 0.29, down: 0.6,  reset: 0.03 },
  { rate: 0.27, down: 0.6,  reset: 0.035 },
  { rate: 0.25, down: 0.6,  reset: 0.04 },
  // +21 ~ +25: 초기화 위험 큼
  { rate: 0.24, down: 0.5,  reset: 0.05 },
  { rate: 0.22, down: 0.5,  reset: 0.055 },
  { rate: 0.20, down: 0.5,  reset: 0.06 },
  { rate: 0.18, down: 0.5,  reset: 0.065 },
  { rate: 0.16, down: 0.5,  reset: 0.07 },
];
// 강화 단계가 장비 능력치에 곱하는 배율
const enhanceMultAt = (L) => 1 + 0.12 * L + 0.004 * L * L;
// L → L+1 비용. 골드는 최고 스테이지의 몬스터 골드 기준, 마력석은 +10부터
function enhanceCost(L, bestStage) {
  return {
    gold: Math.floor(monsterStats(bestStage, false).gold * 8 * Math.pow(1.17, L)),
    ore: Math.floor(4 * Math.pow(1.2, L)),
    mana: L >= 10 ? Math.floor(2 * Math.pow(1.22, L - 10)) : 0,
  };
}

// ───────────────────────── 골동품 ─────────────────────────
// 챙기면 바로 팔려서 재화가 된다. amt 는 등급 res 배수가 곱해지는 기본량 (gold 는 몬스터 골드 배수)
// 전리품 1개당 기대 재화가 예전 상자 1개와 비슷하도록 맞춘 값 (장비 판매 골드 포함)
const CURIOS = {
  coin:  { name: '옛 금화',     icon: '🪙', res: 'gold', amt: 20, w: 25 },
  idol:  { name: '낡은 목각상', icon: '🗿', res: 'wood', amt: 13, w: 32 },
  helm:  { name: '녹슨 투구',   icon: '⛑️', res: 'ore',  amt: 10, w: 30 },
  gem:   { name: '빛바랜 보석', icon: '🔮', res: 'mana', amt: 3,  w: 13 },
};

// ───────────────────────── 훈련 (골드) ─────────────────────────
const TRAINING = [
  { id: 'atk',  name: '⚔️ 공격력', max: Infinity, base: 10, grow: 1.32, show: (st) => fmt(st.atk) },
  { id: 'hp',   name: '🛡️ 체력',   max: Infinity, base: 10, grow: 1.32, show: (st) => fmt(st.maxHp) },
  { id: 'spd',  name: '💨 공속',   max: 40,       base: 25, grow: 1.55, show: (st) => st.aspd.toFixed(2) + '/s' },
  { id: 'crit', name: '💥 치명',   max: 22,       base: 30, grow: 1.6,  show: (st) => Math.round(st.crit * 100) + '%' },
];

// ───────────────────────── 몬스터 ─────────────────────────
function monsterStats(stage, boss) {
  const hp = 14 * Math.pow(1.23, stage - 1);
  const atk = 3 * Math.pow(1.17, stage - 1);
  const gold = 2 * Math.pow(1.2, stage - 1);
  const exp = 4 * Math.pow(1.16, stage - 1);
  return boss
    ? { hp: hp * 5, atk: atk * 1.4, gold: gold * 10, exp: exp * 6, boss: true }
    : { hp, atk, gold, exp, boss: false };
}
function monsterPool(stage) {
  if (stage <= 2) return ['slime'];
  if (stage <= 5) return ['slime', 'bat'];
  if (stage <= 9) return ['slime', 'bat', 'goblin'];
  return ['slime', 'bat', 'goblin', 'skeleton'];
}
const expToNextAt = (lv) => Math.floor(20 * Math.pow(1.22, lv - 1));

// ───────────────────────── 포맷 ─────────────────────────
function fmt(n) {
  if (n < 1000) return String(Math.floor(n));
  const units = ['K', 'M', 'B', 'T', 'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag', 'ah'];
  let i = -1;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)) + units[i];
}
function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h}시간 ${m}분`;
  if (m) return m >= 10 ? `${m}분` : `${m}분 ${s}초`;
  return `${s}초`;
}

// ───────────────────────── 도트 스프라이트 ─────────────────────────
const SPR = {
  knightBody: [
    '.....rr....',
    '....rrr....',
    '...hhhhh...',
    '..hHHHHHh..',
    '..hHvvvvh..',
    '..hHHHHHh..',
    '...hhhhh...',
    '..aAAAAAa..',
    '.aAAAyAAAa.',
    '.aAAAyAAAa.',
    '.aAAAAAAAa.',
    '..bbbybbb..',
    '..aAAAAAa..',
  ],
  knightLegs: [
    ['..ll...ll..', '..ll...ll..', '..kk...kk..'],
    ['...ll.ll...', '...ll.ll...', '..kk..kk...'],
  ],
  knightSit: ['..lllllkk..', '..lllllkk..'],
  tent: [
    '.......TT.......',
    '......TttT......',
    '.....TtttsT.....',
    '....TtttssoT....',
    '...TtttDDssoT...',
    '..TttttDDsssoT..',
    '.TtttttDDssssoT.',
    'TttttttDDsssssoT',
  ],
  crown: ['y.y.y', 'yyyyy', 'yyyyy'],
  slime: [[
    '...gggg...',
    '..gGGGGg..',
    '.gGLGGGGg.',
    '.gGWKGWKg.',
    'gGGGGGGGGg',
    'gGGGGGGGGg',
    '.gggggggg.',
  ], [
    '..........',
    '...gggg...',
    '.ggGLGGgg.',
    'gGGWKGWKGg',
    'gGGGGGGGGg',
    'gGGGGGGGGg',
    '.gggggggg.',
  ]],
  bat: [[
    'D...........D',
    'DD...ppp...DD',
    'DDD.ppppp.DDD',
    '.DDDpRpRpDDD.',
    '..DD.ppp.DD..',
    '......p......',
  ], [
    '.............',
    '.....ppp.....',
    '....ppppp....',
    '.DDDpRpRpDDD.',
    'DDDD.ppp.DDDD',
    'DD....p....DD',
  ]],
  goblin: [[
    '..GGGGG..',
    'GGGGGGGGG',
    '.GGRGGRG.',
    '.GGGGGGG.',
    '..GKKKG..',
    '...GGG...',
    '..BBBBB..',
    '.GBBBBBG.',
    '.GBBBBBG.',
    '..BBBBB..',
    '..B...B..',
    '..G...G..',
  ], [
    '..GGGGG..',
    'GGGGGGGGG',
    '.GGRGGRG.',
    '.GGGGGGG.',
    '..GKKKG..',
    '...GGG...',
    '..BBBBB..',
    '.GBBBBBG.',
    '.GBBBBBG.',
    '..BBBBB..',
    '...B.B...',
    '...G.G...',
  ]],
  skeleton: [[
    '..WWWWW..',
    '.WWWWWWW.',
    '.WKKWKKW.',
    '.WWWWWWW.',
    '..WKWKW..',
    '...WWW...',
    '..W.W.W..',
    '.WWWWWWW.',
    'W.W.W.W.W',
    '..WWWWW..',
    '..W...W..',
    '..W...W..',
    '.WW...WW.',
  ], [
    '..WWWWW..',
    '.WWWWWWW.',
    '.WKKWKKW.',
    '.WWWWWWW.',
    '..WKWKW..',
    '...WWW...',
    '..W.W.W..',
    '.WWWWWWW.',
    'W.W.W.W.W',
    '..WWWWW..',
    '...W.W...',
    '...W.W...',
    '..WW.WW..',
  ]],
};

const PAL = {
  // 기사
  r: '#e0443c', h: '#8c95a6', H: '#c9d1dd', v: '#1b1d27', a: '#3a5a9e', A: '#5b82d6', y: '#ffd257',
  b: '#6b4a2b', l: '#8c95a6', k: '#3b3f4c',
  // 캠프
  T: '#7a4a22', t: '#c98b4a', s: '#a86f38', o: '#5e3818', D: '#2e1d10',
  // 몬스터
  g: '#2f7d3b', G: '#5fcf5a', L: '#b7ff9e', W: '#f4f1e8', K: '#1b1d27',
  p: '#8a4fd1', R: '#ff4d4d', B: '#7a5230',
};
// 같은 글자라도 몬스터마다 색이 다를 때 덮어쓴다 (텐트의 D와 박쥐 날개 D 등)
const MONSTER_PAL = {
  slime: {},
  bat: { D: '#4b2a6b' },
  goblin: { G: '#8fae3c' },
  skeleton: { W: '#e9e4d4' },
};

// 장비 아이콘 모양 (12×12). 글자 색은 장비마다 pal 로 정한다. 그릴 때 어두운 외곽선이 자동으로 붙는다
const GEAR_SPR = {
  sword: [
    '..........WB',
    '.........WBb',
    '........WBb.',
    '.......WBb..',
    '......WBb...',
    '.....WBb....',
    '..G.WBb.....',
    '...GBb......',
    '...JGG......',
    '..H..G......',
    '.H..........',
    'J...........',
  ],
  greatsword: [
    '.........WWB',
    '........WWBb',
    '.......WWBb.',
    '......WWBb..',
    '.....WWBb...',
    '....WWBb....',
    '.G.WWBb.....',
    '..GWBb......',
    '..GJG.......',
    '.H..GG......',
    'H...........',
    'J...........',
  ],
  axe: [
    '......BBb...',
    '.....WBBbb..',
    '....WBBHbbb.',
    '.....WBHbb..',
    '......GH.b..',
    '......H.....',
    '.....H......',
    '....H.......',
    '...H........',
    '..H.........',
    '.H..........',
    'J...........',
  ],
  hammer: [
    '.....BB.....',
    '....WBBb....',
    '...WBBBBb...',
    '....BBHBBb..',
    '.....bBHBb..',
    '......HbJ...',
    '.....H......',
    '....H.......',
    '...H........',
    '..H.........',
    '.H..........',
    'J...........',
  ],
  spear: [
    '..........WB',
    '.........WBb',
    '........WBb.',
    '.......GBb..',
    '......GJ....',
    '.....H......',
    '....H.......',
    '...H........',
    '..H.........',
    '.H..........',
    'H...........',
    '............',
  ],
  trident: [
    '.......W...W',
    '.......B..WB',
    '....W..BWBb.',
    '.....BBBBb..',
    '......GJb...',
    '.....GG.....',
    '....H.......',
    '...H........',
    '..H.........',
    '.H..........',
    'H...........',
    '............',
  ],
  bow: [
    '....HH......',
    '...H.W......',
    '..H...W.....',
    '..H....W....',
    '.H.....W....',
    '.GJ....W....',
    '.GJ....W....',
    '.H.....W....',
    '..H....W....',
    '..H...W.....',
    '...H.W......',
    '....HH......',
  ],
  staff: [
    '.........JJ.',
    '........JWJJ',
    '........JJJb',
    '.......GGb..',
    '......H.....',
    '.....H......',
    '....H.......',
    '...H........',
    '..H.........',
    '.H..........',
    'H...........',
    '............',
  ],
  scythe: [
    '...BBBBBB...',
    '.BBbbbbbWBH.',
    'Bb.......H..',
    'B.......H...',
    '........H...',
    '.......H....',
    '......J.....',
    '.....H......',
    '....H.......',
    '...H........',
    '..H.........',
    '.H..........',
  ],
  tunic: [
    '............',
    '...HH..HH...',
    '..HBBHHBBH..',
    '.HBWBBBBBBH.',
    '.HBWBbbBBBH.',
    '.HHBBbbBBHH.',
    '...BBbbBB...',
    '...BBBBBB...',
    '...GGJGGG...',
    '...BBBBBB...',
    '...BBbbBB...',
    '...bb..bb...',
  ],
  chain: [
    '............',
    '...HH..HH...',
    '..HBWBBWBH..',
    '.HBWBWWBWBH.',
    '.HBBWBBWBBH.',
    '.HHWBWWBWHH.',
    '...BWBBWB...',
    '...WBWWBW...',
    '...GGJGGG...',
    '...BWBBWB...',
    '...BW..WB...',
    '...bb..bb...',
  ],
  plate: [
    '............',
    '..GG....GG..',
    '.GBBG..GBBG.',
    '.GBWBBBBWBG.',
    '..BWBBBBBB..',
    '..BBBJJBBB..',
    '..BbBBBBbB..',
    '...BbBBbB...',
    '...GGGGGG...',
    '...BBbbBB...',
    '...Bb..bB...',
    '............',
  ],
  robe: [
    '....HHHH....',
    '...HBBBBH...',
    '..HBBGGBBH..',
    '..BWBGGBBB..',
    '.BBWBJJBBBB.',
    '.BBBBGGBBBB.',
    '..BBBGGBBb..',
    '..BBBGGBBb..',
    '..BBBGGBbb..',
    '.BBBBGGBBbb.',
    '.BBBBGGBBbb.',
    '.bbbbbbbbbb.',
  ],
  band: [
    '............',
    '............',
    '....BBBB....',
    '...WB..BB...',
    '..WB....Bb..',
    '..B......b..',
    '..B......b..',
    '..B......b..',
    '..Bb....bb..',
    '...bb..bb...',
    '....bbbb....',
    '............',
  ],
  gem: [
    '............',
    '.....JJ.....',
    '....JWJJ....',
    '....JJJJ....',
    '....GBBG....',
    '...B....B...',
    '..W......B..',
    '..B......b..',
    '..b......b..',
    '...b....b...',
    '....bbbb....',
    '............',
  ],
  signet: [
    '............',
    '...GGGGGG...',
    '...GJJJJG...',
    '...GJWJJG...',
    '...GGGGGG...',
    '...B....B...',
    '..W......B..',
    '..B......b..',
    '..b......b..',
    '...b....b...',
    '....bbbb....',
    '............',
  ],
  ouro: [
    '............',
    '....BBBB....',
    '...BJb.WB...',
    '..BbB...WB..',
    '..B......B..',
    '..B......B..',
    '..W......B..',
    '..W......b..',
    '..BB....bb..',
    '...BB..bb...',
    '....bbbb....',
    '............',
  ],
};
