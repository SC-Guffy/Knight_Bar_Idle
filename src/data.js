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
const GRADES = [
  { name: '일반', color: '#b8bcc6', w: 62,  stat: 1,   sell: 3,  res: 1 },
  { name: '고급', color: '#5fcf5a', w: 25,  stat: 1.5, sell: 6,  res: 2 },
  { name: '희귀', color: '#4aa3ff', w: 9,   stat: 2.2, sell: 12, res: 4 },
  { name: '영웅', color: '#b36bff', w: 3.5, stat: 3.2, sell: 30, res: 8 },
  { name: '전설', color: '#ff9f1c', w: 0.5, stat: 4.6, sell: 80, res: 18 },
];
const CHARM_BONUS = [0.5, 1, 1.8, 2.5, 3];

// 가방에 들어오는 전리품 종류 비율 (보스는 장비가 더 잘 나온다)
const LOOT_KIND_W = { gear: 40, curio: 45, use: 15 };
const LOOT_KIND_W_BOSS = { gear: 65, curio: 25, use: 10 };

// ───────────────────────── 장비 ─────────────────────────
// 능력치는 드랍된 스테이지(s)와 등급으로 정해지고, 강화 단계(부위별)가 곱해진다.
//  무기: 공격력 (대장간 배율을 받음) · 갑옷: 체력 · 반지: 치명 확률 + 치명 피해
const GEAR_SLOTS = {
  weapon: { name: '무기', icon: '🗡️', nouns: ['검', '도끼', '창', '활', '망치', '단검'] },
  armor:  { name: '갑옷', icon: '🛡️', nouns: ['가죽 갑옷', '사슬 갑옷', '판금 갑옷', '로브', '흉갑'] },
  ring:   { name: '반지', icon: '💍', nouns: ['반지', '인장 반지', '가락지', '고리'] },
};
const GEAR_PREFIX = ['낡은', '단단한', '정교한', '영웅의', '전설의'];
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
// 0에서 시작한 기대 시도 횟수: +10 약 17회 · +15 약 50회 · +20 약 200회 · +25 약 3,500회
const ENHANCE_MAX = 25;
const ENHANCE = [
  // +1 ~ +5: 실패해도 유지
  { rate: 0.95, down: 0,    reset: 0 },
  { rate: 0.90, down: 0,    reset: 0 },
  { rate: 0.85, down: 0,    reset: 0 },
  { rate: 0.80, down: 0,    reset: 0 },
  { rate: 0.75, down: 0,    reset: 0 },
  // +6 ~ +10: 실패하면 가끔 하락
  { rate: 0.70, down: 0.3,  reset: 0 },
  { rate: 0.65, down: 0.3,  reset: 0 },
  { rate: 0.60, down: 0.35, reset: 0 },
  { rate: 0.55, down: 0.35, reset: 0 },
  { rate: 0.50, down: 0.4,  reset: 0 },
  // +11 ~ +15: 실패하면 절반 이상 하락
  { rate: 0.45, down: 0.5,  reset: 0 },
  { rate: 0.43, down: 0.5,  reset: 0 },
  { rate: 0.41, down: 0.55, reset: 0 },
  { rate: 0.39, down: 0.55, reset: 0 },
  { rate: 0.37, down: 0.6,  reset: 0 },
  // +16 ~ +20: 하락 + 초기화 위험
  { rate: 0.35, down: 0.45, reset: 0.01 },
  { rate: 0.33, down: 0.45, reset: 0.015 },
  { rate: 0.31, down: 0.45, reset: 0.02 },
  { rate: 0.29, down: 0.45, reset: 0.025 },
  { rate: 0.27, down: 0.45, reset: 0.03 },
  // +21 ~ +25: 초기화 위험 큼
  { rate: 0.25, down: 0.4,  reset: 0.035 },
  { rate: 0.23, down: 0.4,  reset: 0.04 },
  { rate: 0.21, down: 0.4,  reset: 0.045 },
  { rate: 0.19, down: 0.4,  reset: 0.05 },
  { rate: 0.17, down: 0.4,  reset: 0.06 },
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
