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
// 게임 버전. 캠프 창 탭 줄 오른쪽 끝에 나온다. 게임 업데이트를 푸시할 때 올린다.
const GAME_VERSION = '0.13.3';
const CAMP_X = 64;              // 캠프에서 기사가 앉는 화면 x

// 개발용 시간 배속 (KB_SPEED=20 npm start). 스태미나·휴식·건설·부상 시간에만 적용
const TIME_SCALE = Math.max(1, Number(new URLSearchParams(location.search).get('speed')) || 1);

// ───────────────────────── 원정 / 캠프 ─────────────────────────
const STAMINA_DRAIN = 25 / 60;        // 초당 소모 → 스태미나 100 = 4분 원정
const MIN_DEPART_RATIO = 0.2;         // 최대 스태미나의 20% 이상 있어야 출발
const DEFEAT_STAMINA = 10;            // 쓰러지면 잃는 스태미나 (약 24초 분량)
const LUNCH_RATIO = 0.5;              // 도시락: 최대 스태미나의 50% 회복
const DEFEAT_DOWN_SEC = 2.5;          // 쓰러져 있는 시간
const BOX_DROP = 0.05;                // 일반 몬스터 전리품 상자 드랍률 (보스는 100%)
// 도전의 탑 (src/tower.js)
const TOWER_UNLOCK_STAGE = 30;        // 이 스테이지에 도달하면 열린다
const TOWER_STAGE0 = 25;              // 층 난이도 = 스테이지 TOWER_STAGE0 + 층 × TOWER_STAGE_PER (1층 = 27, 10층 = 45, 20층 = 65, 50층 = 125스테이지)
const TOWER_STAGE_PER = 2;            //  한 층 오를 때마다 체력 ×1.51 · 공격력 ×1.37 — 계단은 남기되, 층당 3스테이지(×1.86)는 후반에 기사 성장이 못 따라가 거의 안 올라서 완화
// 탑 몬스터는 "덜 맞고 세게 친다": 막히는 층에서 서로 오래 버티며 늘어지지 않고 확실히 쓰러져 실패하게
const TOWER_ELITE_HP = 2;             // 탑의 일반 몬스터는 정예: 같은 스테이지 몬스터의 체력 ×2 · 공격력 ×2.2
const TOWER_ELITE_ATK = 2.2;
const TOWER_BOSS_HP = 2;              // 10층 보스는 같은 스테이지 보스보다 체력 ×2 · 공격력 ×1.6 더 (바로 아래층 정예보다 확실히 세게)
const TOWER_BOSS_ATK = 1.6;
const TOWER_ENRAGE_SEC = 10;          // 한 층에서 이만큼 싸우면 광폭화: 그 뒤 TOWER_ENRAGE_DOUBLE 초마다 공격력 2배씩 (10초 ×1, 15초 ×4, 20초 ×16, 25초 ×64…)
const TOWER_ENRAGE_DOUBLE = 2.5;
// 탑 비전서: 올라가며 깬 층 하나에 1권 (하루 한도 없음) + 10층 단위 첫 돌파 묶음.
//  입장권은 하루 TOWER_TICKETS 장 — 도전 입장 또는 소탕(입장 없이 최고 층 수만큼 📖)에 1장씩 (tower.js)
//  숙련도는 스킬 하나 Lv30 에 239권 — 최고 15층이면 하루 소탕 15 + 등반 35권
const TOWER_TICKETS = 3;
// 탑 입장권 추가 구매 (tower.js buyTowerTicket). 입장권 1장 ≈ 소탕 한 번(최고 층 수만큼 📖)이라 레이드 입장권보다 훨씬 비싸게.
//  골드 기준값 = 최고 스테이지 몬스터 골드 × TOWER_TICKET_GOLD. 원정은 약 6초에 1마리 → 몬스터 골드 × 300 ≈ 사냥 30분치 (골드 보너스 제외)
//  오늘 n번째 구매 배율: 0.5(15분) → 1(30분) → 2(1시간) → 3.5(1시간 45분) → 6(3시간) → 그 뒤 × 1.7씩
//  → 하루 2~3장은 사냥 골드로 무리 없이, 4장째부터는 확 부담스러워진다. 마력석은 두 번째 구매부터
//  산 입장권은 자정에 사라지지 않고 TOWER_TICKET_HOLD 장까지 모아 둘 수 있다 (무료 입장권을 먼저 쓴다)
const TOWER_TICKET_GOLD = 300;
const TOWER_TICKET_MANA = 4;           // 기준 마력석: 이 값 + 최고 스테이지 / 20 (× 배율, 첫 구매는 없음)
const TOWER_TICKET_STEPS = [0.5, 1, 2, 3.5, 6];
const TOWER_TICKET_GROW = 1.7;
const TOWER_TICKET_HOLD = 5;
const BOSS_TOME_DROP = 0.15;          // 원정 보스가 📖 비전서를 떨굴 확률 (스킬 숙련도, classes.js)
const POTION_AT = 0.3;                // 체력 30% 이하에서 물약 자동 사용
const CAMP_HEAL_PER_SEC = 0.1;        // 캠프에서 초당 최대 체력의 10% 회복

// ───────────────────────── 전투 거리 ─────────────────────────
const MELEE_REACH = 14;               // 몬스터 공격 사거리 (몸 반폭 제외)
const MONSTER_SPEED = 24;             // 몬스터가 기사에게 다가오는 속도 px/s
const AGGRO_RANGE = 260;              // 이 거리 안에 들어오면 몬스터가 다가온다

// ───────────────────────── 건물 ─────────────────────────
const BUILD_MAX = 20;
const trainCapAt = (lv) => 10 * lv;
// 초반엔 원정이 4분이라 자주 손봐야 하고, 여관을 올릴수록 길어져 방치가 된다
// (Lv5 약 11분 · Lv10 약 42분 · Lv15 약 2.6시간 · Lv20 약 10시간)
const maxStaminaAt = (lv) => Math.round(20 * Math.pow(1.3, lv - 1)) * 5;
const restSecAt = (lv) => 180 * Math.pow(1.1, lv - 1);          // 0 → 최대 스태미나까지 (Lv1 3분 · Lv20 약 18분)
const bagCapAt = (lv) => 20 + 6 * (lv - 1);                     // 가방이 들 수 있는 무게 (상자마다 무게가 다름)
const buildTimeAt = (lv) => 60 * Math.pow(1.8, lv - 1);          // lv → lv+1 소요 시간(초)

const BUILDINGS = {
  training: {
    name: '훈련장', icon: '🎯', mul: { gold: 1, wood: 1, ore: 0.6, mana: 0.6 },
    effect: (lv) => `훈련 최대 Lv ${trainCapAt(lv)}`,
  },
  inn: {
    name: '여관', icon: '🛏️', mul: { gold: 1, wood: 1.3, ore: 0.4, mana: 0.8 },
    effect: (lv) => `원정 ${fmtTime(maxStaminaAt(lv) / STAMINA_DRAIN)} · 완전 휴식 ${fmtTime(restSecAt(lv))}`,
  },
  storage: {
    name: '창고', icon: '📦', mul: { gold: 0.8, wood: 1.5, ore: 0.3, mana: 0.6 },
    effect: (lv) => `가방 무게 ${bagCapAt(lv)}`,
  },
  forge: {
    name: '대장간', icon: '⚒️', mul: { gold: 1.2, wood: 0.4, ore: 1.6, mana: 1.4 },
    effect: (lv) => `대장간 시설 최대 Lv ${lv}`,
  },
};

function buildCost(id, lv) {
  const m = BUILDINGS[id].mul;
  return {
    gold: Math.floor(40 * Math.pow(1.9, lv - 1) * m.gold),
    wood: Math.floor(20 * Math.pow(2, lv - 1) * m.wood),
    ore: Math.floor(12 * Math.pow(2, lv - 1) * m.ore),
    // 마력석은 Lv5 → 6 부터 (초반 마력석은 전직·강화 몫으로 남도록), 오르는 폭도 목재·철광석보다 완만하게
    mana: lv >= 5 ? Math.floor(4 * Math.pow(1.7, lv - 5) * m.mana) : 0,
  };
}

// ───────────────────────── 대장간 시설 ─────────────────────────
// 대장간은 능력치를 주지 않고 장비를 다루는 시설을 품는다. 시설마다 따로 올리고(재화 즉시 소모), 대장간 Lv 이 시설의 최대 Lv 이다.
// 무기·갑옷의 위력 레벨은 훈련(공격력·체력)이 정한다 — 0.12 의 재련·재련로는 0.13.3 에서 훈련에 합쳐졌다 (core.js migrate 가 옮김·환급)
const FORGE_FAC = {
  salvage: { name: '분해대', icon: '🧰', desc: '장비를 팔 때 나오는 💠 강화석이 늘어나요',
    effect: (lv) => (lv ? `판매 강화석 ×${salvageMultAt(lv).toFixed(1)}` : '아직 없음') },
  potential: { name: '각인대', icon: '🔮', desc: '장비의 편차(roll)를 다시 굴려요 — Lv 이 오를수록 범위가 좋아져요',
    effect: (lv) => (lv ? `편차 ×${potentialRangeAt(lv).map((v) => v.toFixed(2)).join('~')}` : '아직 없음') },
};
// 강화 확률을 올려 주는 시설은 두지 않는다 (강화는 아껴서 풀어야 하는 성장 — 0.12.2 의 연마대는 0.12.3 에서 빠짐, core.js migrate 가 환급)
// 분해대: 판매 강화석 ×(1 + 0.1·Lv) (Lv20 ×3)
const salvageMultAt = (lv) => 1 + 0.1 * lv;
// 각인대: 다시 굴린 편차의 범위 [0.9 + 0.01·Lv, 1.1 + 0.005·Lv] (Lv20 1.10~1.20).
//  최고 1.2 / 최저 0.9 = 1.33 배라 등급 한 칸(약 1.45배)은 여전히 못 넘는다 → 등급 서열 유지
const potentialRangeAt = (lv) => [0.9 + 0.01 * lv, 1.1 + 0.005 * lv];
// 각인 1회 비용: 💠 강화석 (그 등급 판매량만큼) + 💎 마력석
const potentialCost = (g) => ({ stone: GEAR_STONES[g], mana: 2 + 2 * g });
// 건물·시설은 능력치를 직접 주지 않는다 (0.13.1 의 공명로는 0.13.2 에서 빠짐, core.js migrate 가 환급)
// 시설 lv → lv+1 비용
function forgeFacCost(id, lv) {
  return {
    gold: Math.floor(150 * Math.pow(1.75, lv)),
    wood: 0,
    ore: Math.floor(20 * Math.pow(1.7, lv)),
    mana: lv >= 3 ? Math.floor(5 * Math.pow(1.6, lv - 3)) : 0,
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
  lunch:  { name: '도시락',     icon: '🍱', price: 30, w: 35, desc: '캠프에서 먹으면 최대 스태미나의 50% 회복' },
  potion: { name: '회복 물약',  icon: '🧪', price: 20, w: 40, desc: '원정 중 체력 30% 이하에서 자동 사용 (쓰러짐 방지)' },
  charm:  { name: '행운의 부적', icon: '🍀', price: 60, w: 12, desc: '이번 원정 동안 좋은 등급의 전리품이 더 잘 나옴' },
  elixir: { name: '투지의 영약', icon: '🔥', price: 60, w: 13, desc: '이번 원정 동안 공격력 +30%' },
  protect: { name: '보호 주문서', icon: '📜', price: 400, w: 4, desc: '강화할 때 1장 써서, 실패로 단계가 떨어지거나 초기화되는 걸 막아 줌' },
};
// ───────────────────────── 우편함 ─────────────────────────
// 모든 기사에게 보내는 우편. id 는 한 번 정하면 바꾸지 않는다 (받았는지를 S.mail.got 에 id 로 남긴다).
// at ~ until 사이에만 우편함에 보인다. reward: { items: { 보급품 id: 개수 }, gold, stones, tomes }
const MAIL = [
  {
    id: 'sorry-enhance-1007-b',
    at: Date.parse('2026-10-07T00:00:00+09:00'),
    until: Date.parse('2026-10-22T00:00:00+09:00'),
    from: '기사 키우기 개발자',
    title: '강화 확률 조정 안내와 사과의 편지',
    body: [
      '개발하면서 확률을 너무 가혹하게 잡았어요. 기사님들이 장비 강화에 실패할 때마다 단계가 너무 자주 떨어져서 많이 속상하셨을 거예요. 정말 죄송합니다.',
      '돼야 할 강화가 자꾸 떨어지던 문제를 고쳤어요. v0.11.6부터 실패해도 대부분은 단계가 그대로 유지되도록 하락 확률을 크게 낮췄어요. (실패 시 하락: +6~10 40~55% → 12~20% · +11~15 60~70% → 22~30% · +16 이상 50~60% → 25%)',
      '지금 우편함에서 사과의 마음을 담은 📜 보호 주문서 1장을 받아 가세요.',
      '들려주시는 의견 하나하나 귀담아듣고, 앞으로도 더 즐거운 모험이 되도록 다듬어 갈게요!',
    ],
    reward: { items: { protect: 1 } },
  },
  {
    id: 'sorry-enhance-1007',
    at: Date.parse('2026-10-07T00:00:00+09:00'),
    until: Date.parse('2026-10-22T00:00:00+09:00'),
    from: '기사 키우기 개발자',
    title: '강화 확률 조정 안내와 사과의 편지',
    body: [
      '기사님, 그동안 장비 강화에 실패할 때마다 단계가 너무 자주 떨어져서 많이 속상하셨을 거예요. 확률을 너무 가혹하게 잡은 제 잘못입니다. 정말 죄송합니다.',
      'v0.11.6부터 강화에 실패해도 대부분은 단계가 그대로 유지되도록 하락 확률을 크게 낮췄어요. (실패 시 하락: +6~10 40~55% → 12~20% · +11~15 60~70% → 22~30% · +16 이상 50~60% → 25%)',
      '사과의 마음을 담아 📜 보호 주문서 10장을 보내 드려요. 앞으로도 더 즐거운 모험이 되도록 다듬어 갈게요!',
    ],
    reward: { items: { protect: 10 } },
  },
];

// 가방에서 소비 아이템이 나올 때 테두리 색으로 쓰는 등급
const SUPPLY_GRADE = { lunch: 0, potion: 0, charm: 2, elixir: 2, protect: 3 };

// ───────────────────────── 전리품 등급 ─────────────────────────
// 장비·골동품 공통. stat: 장비 능력치 배수, sell: 판매가(몬스터 골드 배수), res: 골동품 재화 배수
// 장비 수급은 둘로 나뉜다: 원정은 일반~영웅(짜바리 위주, 영웅은 가끔 터지는 대박), 전설 이상은 레이드 처치 상자에서만.
// 원정 1회(상자 약 13개, 보스 3마리 기준) 장비 기대치: 영웅 4~5회에 1개 (부적을 쓰면 2배)
const GRADES = [
  { name: '일반', color: '#b8bcc6', w: 64,  stat: 1,   sell: 3,  res: 1 },
  { name: '고급', color: '#5fcf5a', w: 26,  stat: 1.5, sell: 6,  res: 2 },
  { name: '희귀', color: '#4aa3ff', w: 8,   stat: 2.2, sell: 12, res: 4 },
  { name: '영웅', color: '#b36bff', w: 1.8, stat: 3.2, sell: 30, res: 8 },
  { name: '전설', color: '#ff9f1c', w: 0.2, stat: 4.6, sell: 80, res: 18 },
  { name: '신화', color: '#ff4d6d', w: 0.03,   stat: 6.6,  sell: 200,  res: 40 },
  { name: '초월', color: '#3ee8ff', w: 0.005,  stat: 9.5,  sell: 500,  res: 90 },
  { name: '태초', color: '#f4f0ff', w: 0.0008, stat: 13.7, sell: 1300, res: 200 },
];
// 세트 장비(레이드 보스 고유 장비)는 화면에서 이 등급으로 보인다. 능력치는 장비 도감의 g(원래 등급)를 그대로 쓴다
const SET_GRADE = { name: '세트', color: '#3dffa8' };
// 일괄 판매 등급 필터 기본값: 일반~영웅만 체크
const SELL_FILTER_DEFAULT = [true, true, true, true, false, false, false, false];
// 원정 상자가 나올 수 있는 가장 높은 등급 (영웅). 그 위 등급의 w 는 레이드·옛 세이브 상자에만 쓰인다
const EXPEDITION_GRADE_MAX = 3;
const CHARM_BONUS = [0.5, 1, 1.6, 2, 2, 2, 2, 2];     // 행운의 부적: 등급별 가중치 배수 (전설 이상은 2배까지만)

// ───────────────────────── 전리품 상자 ─────────────────────────
// 원정 중 전리품은 등급별 상자로 가방에 쌓이고, 캠프 정산에서 하나씩 열면 내용물이 나온다.
// 가방은 칸 수가 아니라 무게로 찬다 (평균 상자 무게 약 1.5 → 기본 가방 20에 상자 13개 안팎).
//  w: 무게, n: [최소, 최대] 내용물 수. 첫 내용물은 상자 등급, 나머지는 한 등급 아래(일반은 그대로)
//  spr: GEAR_SPR 모양, pal: 글자별 색 (B 판자 · b 그늘 · W 광택 · H 테두리 · G 자물쇠 · J 보석)
const LOOT_BOXES = [
  { name: '낡은 상자', w: 1, n: [1, 1], spr: 'crate',
    pal: { B: '#8a6a48', b: '#5e4630', W: '#a88a66', H: '#4a3420', G: '#7d8290', J: '#7d8290' } },
  { name: '나무 상자', w: 2, n: [1, 2], spr: 'chest',
    pal: { B: '#a0642e', b: '#6b4420', W: '#c98a4a', H: '#5e3818', G: '#c9a227', J: '#3a2a1a' } },
  { name: '철제 상자', w: 3, n: [2, 2], spr: 'chest',
    pal: { B: '#8c95a6', b: '#5a6070', W: '#c9d1dd', H: '#3d4250', G: '#d8dde6', J: '#4aa3ff' } },
  { name: '기사단 보물상자', w: 4, n: [2, 3], spr: 'chest',
    pal: { B: '#7a2a4a', b: '#4a1830', W: '#a8486a', H: '#ffd257', G: '#ffd257', J: '#b36bff' } },
  // 보석함은 작아서 보물상자보다 가볍다
  { name: '왕가의 보석함', w: 3, n: [3, 3], spr: 'jewelbox',
    pal: { B: '#ffd257', b: '#c79a12', W: '#fffbe0', H: '#e08a1a', G: '#e08a1a', J: '#ff3b4b' } },
  { name: '용의 보물궤', w: 4, n: [3, 4], spr: 'chest',
    pal: { B: '#b3263e', b: '#6e1424', W: '#ff6b81', H: '#ffd257', G: '#ffd257', J: '#ff9f1c' } },
  { name: '별의 성궤', w: 4, n: [4, 4], spr: 'jewelbox',
    pal: { B: '#2a3f8f', b: '#18245a', W: '#3ee8ff', H: '#e8fbff', G: '#e8fbff', J: '#b36bff' } },
  { name: '태초의 함', w: 5, n: [5, 5], spr: 'jewelbox',
    pal: { B: '#f4f0ff', b: '#c9b8ff', W: '#ffffff', H: '#ff9ff3', G: '#ffe066', J: '#7dffd0' } },
];

// 상자에서 나오는 전리품 종류 비율 (보스 상자의 첫 내용물은 장비가 더 잘 나온다)
const LOOT_KIND_W = { gear: 40, curio: 45, use: 15 };
const LOOT_KIND_W_BOSS = { gear: 65, curio: 25, use: 10 };

// ───────────────────────── 장비 ─────────────────────────
// 무기·갑옷은 부위 아이템 레벨(재련)을 따라 커지는 절대값, 장신구는 % 다. 같은 부위에선 등급(과 roll)으로만 서열이 정해지고 강화 단계(부위별)가 곱해진다.
//  드랍된 스테이지(s)는 판매가에만 쓴다 — 등급이 높으면 언제 주웠든 항상 더 세다.
//  무기: 공격력 · 갑옷: 체력 · 장신구(반지·왕관 등): 치명 확률 + 치명 피해
const GEAR_SLOTS = {
  weapon: { name: '무기', icon: '🗡️' },
  armor:  { name: '갑옷', icon: '🛡️' },
  ring:   { name: '장신구', icon: '💍' },
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
  ragnarok:     { slot: 'weapon', g: 5, name: '종말검 라그나로크', icon: '🌋', spr: 'greatsword', desc: '신들의 황혼에 휘둘러졌다는 검. 칼끝에서 재가 흩날린다.',
    pal: { B: '#ff4d6d', b: '#8a0f2a', W: '#ffd0d8', H: '#1b1218', G: '#ff9f1c', J: '#ffe066' } },
  gungnir:      { slot: 'weapon', g: 5, name: '신창 궁니르', icon: '🔱', spr: 'spear', desc: '한 번 던지면 반드시 과녁을 꿰뚫고 주인의 손으로 돌아온다.',
    pal: { B: '#ffe9a8', b: '#c98a12', W: '#ffffff', H: '#5a1a2a', G: '#ff4d6d', J: '#ff4d6d' } },
  void_scythe:  { slot: 'weapon', g: 6, name: '공허의 낫', icon: '🌌', spr: 'scythe', desc: '휘두른 자리의 공간이 찢어진다. 틈 너머로 별이 보인다.',
    pal: { B: '#3ee8ff', b: '#1a2a6b', W: '#e8ffff', H: '#0d0d1a', G: '#b36bff', J: '#ffffff' } },
  astral_staff: { slot: 'weapon', g: 6, name: '성좌의 홀', icon: '✨', spr: 'staff', desc: '별자리 하나를 통째로 깎아 만든 홀. 하늘이 그 손짓을 따른다.',
    pal: { B: '#9af6ff', b: '#3a7ad6', W: '#ffffff', H: '#1a2a6b', G: '#3ee8ff', J: '#ffffff' } },
  genesis:      { slot: 'weapon', g: 7, name: '창세검 제네시스', icon: '🌅', spr: 'sword', desc: '세상이 생기기 전부터 있던 검. 이 검이 첫 빛을 갈랐다.',
    pal: { B: '#ffffff', b: '#c9b8ff', W: '#ffffff', H: '#ffd257', G: '#7dffd0', J: '#ff9ff3' } },

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
  titan_plate:  { slot: 'armor', g: 5, name: '거신의 판금', icon: '⛰️', spr: 'plate', desc: '산을 짊어졌던 거신의 갑옷. 사람이 입기엔 지나치게 튼튼하다.',
    pal: { B: '#c94a5a', b: '#6b1a2a', W: '#ffb3b8', H: '#3a2a1a', G: GOLD, J: '#ffe066' } },
  valkyrie:     { slot: 'armor', g: 5, name: '발키리의 깃갑옷', icon: '🪽', spr: 'chain', desc: '전장의 용사를 데려가던 전사들의 갑옷. 등에서 날개 소리가 난다.',
    pal: { B: '#ffe0e6', b: '#d97a8a', W: '#ffffff', H: '#8a1a2a', G: GOLD, J: '#ff4d6d' } },
  starlight_robe:{ slot: 'armor', g: 6, name: '은하수 성의', icon: '🌠', spr: 'robe', desc: '밤하늘을 오려 지었다. 옷자락 사이로 유성이 흐른다.',
    pal: { B: '#1a2a6b', b: '#0d1238', W: '#3ee8ff', H: '#0d1238', G: '#ffffff', J: '#3ee8ff' } },
  primordial:   { slot: 'armor', g: 7, name: '태초의 성갑', icon: '🕊️', spr: 'plate', desc: '첫 번째 새벽의 빛으로 빚어졌다. 어떤 어둠도 닿지 못한다.',
    pal: { B: '#ffffff', b: '#c9b8ff', W: '#ffffff', H: '#ffd257', G: '#7dffd0', J: '#ff9ff3' } },

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
  draupnir:     { slot: 'ring', g: 5, name: '황금 팔찌 드라우프니르', icon: '💫', spr: 'band', desc: '아흐레 밤마다 똑같은 금반지를 여덟 개씩 낳는다.',
    pal: { B: GOLD, b: '#b3261e', W: '#fffbe0', H: '#b3261e', G: '#b3261e', J: '#ff4d6d' } },
  dragon_heart: { slot: 'ring', g: 5, name: '용심장 반지', icon: '❤️‍🔥', spr: 'gem', desc: '고룡의 심장이 굳어 생긴 보석. 아직도 뛴다.',
    pal: { B: '#3a1a24', b: '#1b0d12', W: '#ff9fae', H: '#1b0d12', G: '#1b0d12', J: '#ff4d6d' } },
  eclipse_ring: { slot: 'ring', g: 6, name: '일식의 고리', icon: '🌘', spr: 'signet', desc: '해와 달이 겹치는 순간을 가둬 두었다. 시간이 잠시 멈춘다.',
    pal: { B: '#1b1d27', b: '#0d0d1a', W: '#3ee8ff', H: '#0d0d1a', G: '#3ee8ff', J: '#ffffff' } },
  origin_ring:  { slot: 'ring', g: 7, name: '근원의 고리', icon: '♾️', spr: 'ouro', desc: '모든 것이 시작된 곳과 끝나는 곳을 하나로 잇는다.',
    pal: { B: '#ffffff', b: '#c9b8ff', W: '#ffffff', H: '#c9b8ff', G: '#c9b8ff', J: '#ff9ff3' } },
};

// ── 레이드 보스 고유 장비 ── (raid: 떨어뜨리는 보스. 일반 상자에서는 나오지 않고 그 보스의 처치 상자에서만 나온다)
//  보스가 뒤로 갈수록 등급과 효과가 오른다: 슬라임 킹·고블린 족장 영웅 → 리치 킹 전설 → 늪의 군주·화염룡 신화 → 서리 거인 초월 → 마왕 태초
//  sp: 특수 효과 — 강화 배율을 받지 않는 고정 보너스 (SPECIAL_STATS 참고)
Object.assign(GEAR_ITEMS, {
  // 👑 슬라임 킹
  jelly_mace:    { slot: 'weapon', g: 3, raid: 'slimeking', name: '말랑 젤리 철퇴', icon: '🔨', spr: 'hammer', sp: { aspdPct: 0.06 },
    desc: '슬라임 킹의 몸에서 떼어 낸 젤리를 굳혔다. 때릴 때마다 통 하고 튀어 올라 손이 빨라진다.',
    pal: { B: '#4aa3ff', b: '#2a5fa8', W: '#bfe3ff', H: '#2a5fa8', G: '#ffd257', J: '#ffd257' } },
  slime_cloak:   { slot: 'armor', g: 3, raid: 'slimeking', name: '점액 왕의 망토', icon: '🫧', spr: 'robe', sp: { guard: 0.04 },
    desc: '끈적한 점액이 칼날을 미끄러뜨린다. 냄새만 빼면 완벽한 방어구.',
    pal: { B: '#4aa3ff', b: '#2a5fa8', W: '#bfe3ff', H: '#2a5fa8', G: '#ffd257', J: '#bfe3ff' } },
  slime_crown:   { slot: 'ring', g: 3, raid: 'slimeking', name: '슬라임 킹의 왕관', icon: '👑', spr: 'crown', sp: { goldPct: 0.1 },
    desc: '왕의 머리 위에서 수백 번 튀어 오르고도 멀쩡했던 왕관. 쓰면 금화가 따라 굴러온다.',
    pal: { B: '#ffd257', b: '#c79a12', W: '#fffbe0', H: '#c79a12', G: '#c79a12', J: '#4aa3ff' } },
  // 👺 고블린 족장
  saw_axe:       { slot: 'weapon', g: 3, raid: 'goblinchief', name: '족장의 톱날 도끼', icon: '🪓', spr: 'axe', sp: { atkPct: 0.12 },
    desc: '날에 이빨처럼 톱니를 갈아 넣었다. 족장은 이걸로 부족 회의를 끝냈다.',
    pal: { B: '#9aa0a8', b: '#5a6070', W: '#e8ecf2', H: '#5a3a1a', G: '#8fae3c', J: '#e0443c' } },
  loot_mail:     { slot: 'armor', g: 3, raid: 'goblinchief', name: '약탈품 누더기 갑옷', icon: '🧥', spr: 'tunic', sp: { hpPct: 0.14 },
    desc: '빼앗은 갑옷 조각을 아무렇게나 이어 붙였다. 생각보다 훨씬 튼튼하다.',
    pal: { B: '#8a6a48', b: '#5e4630', W: '#c9cdd4', H: '#8fae3c', G: '#c9a227', J: '#e0443c' } },
  gold_tooth:    { slot: 'ring', g: 3, raid: 'goblinchief', name: '족장의 금니 목걸이', icon: '🦷', spr: 'gem', sp: { goldPct: 0.15 },
    desc: '족장이 모은 금니를 꿰었다. 금 냄새를 맡는 고블린의 감이 옮아온다.',
    pal: { B: '#ffd257', b: '#c79a12', W: '#fffbe0', H: '#5e4630', G: '#5e4630', J: '#fff6c2' } },
  // 💀 리치 킹
  soul_staff:    { slot: 'weapon', g: 4, raid: 'lichking', name: '영혼 수확자의 홀', icon: '🪄', spr: 'staff', sp: { heal: 0.008 },
    desc: '때린 상대의 생명을 한 줌씩 빨아들여 주인에게 돌려준다.',
    pal: { B: '#7dffb0', b: '#2a8a5a', W: '#e8fff0', H: '#2a1a4a', G: '#ffd257', J: '#7dffb0' } },
  dead_shroud:   { slot: 'armor', g: 4, raid: 'lichking', name: '망자의 수의', icon: '🥀', spr: 'robe', sp: { guard: 0.07 },
    desc: '천 년 묵은 리치 킹의 수의. 산 자의 칼은 이 옷을 반쯤만 벤다.',
    pal: { B: '#2a1a4a', b: '#150d26', W: '#4a2a6b', H: '#150d26', G: '#7dffb0', J: '#7dffb0' } },
  phylactery:    { slot: 'ring', g: 4, raid: 'lichking', name: '리치 킹의 성물함', icon: '⚱️', spr: 'signet', sp: { crit: 0.05 },
    desc: '리치 킹이 영혼을 숨겨 두던 작은 함. 들여다보면 적의 급소가 훤히 보인다.',
    pal: { B: '#e9e4d4', b: '#9a9480', W: '#ffffff', H: '#9a9480', G: '#4a2a6b', J: '#7dffb0' } },
  // 🐊 늪의 군주
  bog_harpoon:   { slot: 'weapon', g: 5, raid: 'boglord', name: '늪 군주의 작살', icon: '🔱', spr: 'trident', sp: { aspdPct: 0.1 },
    desc: '늪 밑바닥에서 사냥감을 꿰던 작살. 찌르고 빼는 손놀림이 빨라진다.',
    pal: { B: '#8fd8a8', b: '#3a6b4a', W: '#e8fff0', H: '#3a2a1a', G: '#8a6fb8', J: '#c9b3ff' } },
  moss_scale:    { slot: 'armor', g: 5, raid: 'boglord', name: '이끼 비늘 갑주', icon: '🐊', spr: 'chain', sp: { hpPct: 0.14 },
    desc: '이끼가 자라는 늪 군주의 비늘. 상처가 나도 금세 이끼가 덮어 버린다.',
    pal: { B: '#4a6b3a', b: '#2a3f20', W: '#b8c98a', H: '#3a2a1a', G: '#ffd257', J: '#8a6fb8' } },
  fog_charm:     { slot: 'ring', g: 5, raid: 'boglord', name: '독안개 부적', icon: '🧿', spr: 'gem', sp: { expPct: 0.2 },
    desc: '늪의 독안개를 가둬 둔 부적. 싸울 때마다 배우는 것이 많아진다.',
    pal: { B: '#4b3a6b', b: '#2a1f40', W: '#c9b3ff', H: '#2a1f40', G: '#2a1f40', J: '#8a6fb8' } },
  // 🐉 화염룡
  fang_blade:    { slot: 'weapon', g: 5, raid: 'flamedragon', name: '화염룡의 송곳니', icon: '🐉', spr: 'greatsword', sp: { atkPct: 0.12 },
    desc: '화염룡의 송곳니를 통째로 벼린 대검. 아직도 이빨 사이로 불씨가 샌다.',
    pal: { B: '#fff1d6', b: '#d9a86a', W: '#ffffff', H: '#b8321f', G: '#ff8a1f', J: '#ff3b1f' } },
  flame_scale:   { slot: 'armor', g: 5, raid: 'flamedragon', name: '용린 화염 갑주', icon: '🔥', spr: 'plate', sp: { guard: 0.09 },
    desc: '화염룡의 가슴 비늘로 만든 갑주. 불길도 칼날도 비늘 위에서 미끄러진다.',
    pal: { B: '#b8321f', b: '#6e1414', W: '#ffb13b', H: '#6e1414', G: '#ffe066', J: '#ff8a1f' } },
  dragon_core:   { slot: 'ring', g: 5, raid: 'flamedragon', name: '불타는 용의 심장', icon: '❤️‍🔥', spr: 'gem', sp: { critMult: 0.4 },
    desc: '쓰러진 화염룡의 심장이 굳은 보석. 치명타마다 용의 분노가 터진다.',
    pal: { B: '#3a1a14', b: '#1b0d0a', W: '#ffb13b', H: '#1b0d0a', G: '#1b0d0a', J: '#ff5a1f' } },
  // 🧊 서리 거인
  glacier_maul:  { slot: 'weapon', g: 6, raid: 'frostgiant', name: '거인의 빙하 망치', icon: '🔨', spr: 'hammer', sp: { atkPct: 0.15 },
    desc: '빙하 한 덩이를 깎아 자루를 박았다. 내려치면 땅이 얼어붙는다.',
    pal: { B: '#cfeeff', b: '#7ab8e0', W: '#ffffff', H: '#3f6f9a', G: '#1b6fd1', J: '#5ad1ff' } },
  giant_plate:   { slot: 'armor', g: 6, raid: 'frostgiant', name: '만년설 거인갑', icon: '🏔️', spr: 'plate', sp: { hpPct: 0.2 },
    desc: '서리 거인의 가슴판을 사람 몸에 맞게 줄였다. 그래도 어지간한 성벽보다 두껍다.',
    pal: { B: '#e8f6ff', b: '#8fbfe0', W: '#ffffff', H: '#3f6f9a', G: '#1b6fd1', J: '#5ad1ff' } },
  frost_eye:     { slot: 'ring', g: 6, raid: 'frostgiant', name: '서리 거인의 눈', icon: '🧊', spr: 'signet', sp: { crit: 0.08 },
    desc: '얼어붙은 거인의 눈동자. 끼고 있으면 적의 움직임이 느리게 보인다.',
    pal: { B: '#cfeeff', b: '#7ab8e0', W: '#ffffff', H: '#7ab8e0', G: '#3f6f9a', J: '#1b6fd1' } },
  // 😈 마왕
  diabolos:      { slot: 'weapon', g: 7, raid: 'demonking', name: '마왕검 디아볼로스', icon: '⚔️', spr: 'greatsword', sp: { atkPct: 0.18, critMult: 0.3 },
    desc: '마왕이 세상을 반으로 가르려던 검. 쥔 자의 분노를 먹고 자란다.',
    pal: { B: '#3a1a4a', b: '#1b0d24', W: '#c06bff', H: '#7a1f3a', G: '#ffd257', J: '#ff3b4b' } },
  dark_armor:    { slot: 'armor', g: 7, raid: 'demonking', name: '마왕의 흑염 갑주', icon: '🖤', spr: 'plate', sp: { guard: 0.12, hpPct: 0.1 },
    desc: '검은 불꽃이 쉬지 않고 타오르는 갑주. 다가오는 칼날을 불꽃이 먼저 삼킨다.',
    pal: { B: '#2a1540', b: '#150a20', W: '#c06bff', H: '#7a1f3a', G: '#ffd257', J: '#ff3b4b' } },
  demon_crown:   { slot: 'ring', g: 7, raid: 'demonking', name: '마왕의 왕관', icon: '👑', spr: 'crown', sp: { aspdPct: 0.12, goldPct: 0.25 },
    desc: '마왕성의 옥좌에서 주운 왕관. 쓰는 순간 온 세상이 나를 위해 움직이는 것 같다.',
    pal: { B: '#3a1a4a', b: '#1b0d24', W: '#c06bff', H: '#ffd257', G: '#ffd257', J: '#ff3b4b' } },
});

// 고유 장비 특수 효과: 이름, 표시 형식. stats() 와 rewardKill() 이 장착 장비의 합을 반영한다
const SPECIAL_STATS = {
  atkPct:   { name: '공격력', fmt: (v) => `+${Math.round(v * 100)}%` },
  hpPct:    { name: '체력', fmt: (v) => `+${Math.round(v * 100)}%` },
  aspdPct:  { name: '공격 속도', fmt: (v) => `+${Math.round(v * 100)}%` },
  crit:     { name: '치명 확률', fmt: (v) => `+${Math.round(v * 100)}%p` },
  critMult: { name: '치명 피해', fmt: (v) => `+${Math.round(v * 100)}%` },
  guard:    { name: '받는 피해', fmt: (v) => `-${Math.round(v * 100)}%` },
  heal:     { name: '타격 시 체력 회복', fmt: (v) => `${(v * 100).toFixed(1)}%` },
  goldPct:  { name: '골드 획득', fmt: (v) => `+${Math.round(v * 100)}%` },
  expPct:   { name: '경험치 획득', fmt: (v) => `+${Math.round(v * 100)}%` },
};
// 공속은 무기에서(등급별 고정 %), 치명 확률은 장신구에서(등급별 고정) 얻는다. 둘 다 스테이지와 상관없고 강화로는 조금만 오른다 (SOFT_ENH)
const WEAPON_ASPD = [0, 0.05, 0.1, 0.18, 0.28, 0.4, 0.55, 0.75];
// 무기 공격력·갑옷 체력은 절대값이다: 위력 레벨(공격력·체력 훈련으로 정해짐, trainGearLvAt)을 따라 커지고(gearAtkAt·gearHpAt),
//  등급 stat·편차·강화 배율이 곱해진다. 레벨이 장비가 아니라 훈련에 붙어 있어서 같은 부위 장비끼리는 등급이 곧 서열이다 (편차 ±10% 로는 한 등급을 못 넘는다).
//  공격력은 스테이지마다 ×1.225, 체력은 ×1.18 — 몬스터 체력(×1.23)보다 조금 느려서 깊이 갈수록 등급·강화가 벽을 넘게 해 준다
const gearAtkAt = (s) => 6.5 * Math.pow(1.225, s);
const gearHpAt = (s) => 30 * Math.pow(1.18, s);
function gearBase(slot, g, roll, s) {
  const k = GRADES[g].stat * roll;
  if (slot === 'weapon') return { atk: gearAtkAt(s) * k, aspdPct: WEAPON_ASPD[g] * roll };
  if (slot === 'armor') return { hp: gearHpAt(s) * k };
  return { crit: 0.02 * k, critMult: 0.2 * k };
}
// 강화가 공속·치명에는 단계당 4%만 곱해진다 (+25 에서 2배)
const SOFT_ENH = { aspdPct: true, crit: true };
const softEnhMultAt = (L) => 1 + 0.04 * L;

// ───────────────────────── 강화 ─────────────────────────
// 강화 단계는 부위(무기·갑옷·반지)에 붙어 있어서 장비를 바꿔 껴도 유지된다.
// ENHANCE[L] = L → L+1 시도. 실패하면 down 확률로 한 단계 하락, reset 확률로 +0 초기화, 나머지는 유지.
// 0에서 시작한 기대 시도 횟수 (보호 주문서 없이): +10 약 15회 · +15 약 35회 · +20 약 110회 · +25 약 1,200회
const ENHANCE_MAX = 25;
const ENHANCE = [
  // +1 ~ +5: 실패해도 유지
  { rate: 0.95, down: 0,    reset: 0 },
  { rate: 0.90, down: 0,    reset: 0 },
  { rate: 0.85, down: 0,    reset: 0 },
  { rate: 0.80, down: 0,    reset: 0 },
  { rate: 0.75, down: 0,    reset: 0 },
  // +6 ~ +10: 실패해도 대부분 유지, 가끔 하락
  { rate: 0.70, down: 0.12, reset: 0 },
  { rate: 0.65, down: 0.14, reset: 0 },
  { rate: 0.60, down: 0.16, reset: 0 },
  { rate: 0.55, down: 0.18, reset: 0 },
  { rate: 0.50, down: 0.2,  reset: 0 },
  // +11 ~ +15: 실패하면 4번에 1번꼴로 하락
  { rate: 0.46, down: 0.22, reset: 0 },
  { rate: 0.43, down: 0.24, reset: 0 },
  { rate: 0.40, down: 0.26, reset: 0 },
  { rate: 0.37, down: 0.28, reset: 0 },
  { rate: 0.35, down: 0.3,  reset: 0 },
  // +16 ~ +20: 하락 + 초기화 위험
  { rate: 0.33, down: 0.25, reset: 0.02 },
  { rate: 0.31, down: 0.25, reset: 0.025 },
  { rate: 0.29, down: 0.25, reset: 0.03 },
  { rate: 0.27, down: 0.25, reset: 0.035 },
  { rate: 0.25, down: 0.25, reset: 0.04 },
  // +21 ~ +25: 초기화 위험 큼
  { rate: 0.24, down: 0.25, reset: 0.05 },
  { rate: 0.22, down: 0.25, reset: 0.055 },
  { rate: 0.20, down: 0.25, reset: 0.06 },
  { rate: 0.18, down: 0.25, reset: 0.065 },
  { rate: 0.16, down: 0.25, reset: 0.07 },
];
// 강화 단계가 장비 능력치에 곱하는 배율
const enhanceMultAt = (L) => 1 + 0.12 * L + 0.004 * L * L;
// L → L+1 비용. 💠 강화석은 강화에만 쓰는 재화라 훈련(골드)과 겹치지 않는다. 철광석은 늘, 마력석은 +10부터
// 강화석 기대 소모 (0에서, 보호 주문서 없이): +5 약 14개 · +10 약 75개 · +15 약 320개 (부위마다)
function enhanceCost(L) {
  return {
    stone: Math.floor(2 * Math.pow(1.17, L)),
    // 철광석은 건물과 나눠 쓰므로 가볍게 (×4 였을 땐 강화를 먼저 하면 건물을 못 올려 진행이 멈췄다 — 강화를 묶는 건 💠 강화석)
    ore: Math.floor(2 * Math.pow(1.2, L)),
    mana: L >= 10 ? Math.floor(2 * Math.pow(1.22, L - 10)) : 0,
  };
}
// 💠 강화석 획득: 원정 보스 처치마다 BOSS_STONES 개, 장비를 팔면 등급별로 GEAR_STONES 개 (원정 1회 약 15~20개)
const BOSS_STONES = 3;
const GEAR_STONES = [1, 2, 4, 10, 25, 60, 150, 400];
// 강화석이 생기기 전 세이브에 처음 한 번 넣어 주는 양 (+0 → +5 를 바로 해 볼 수 있을 만큼)
const STONE_GIFT = 20;

// ───────────────────────── 골동품 ─────────────────────────
// 챙기면 바로 팔려서 재화가 된다. amt 는 등급 res 배수가 곱해지는 기본량 (gold 는 몬스터 골드 배수)
// 전리품 1개당 기대 재화가 예전 상자 1개와 비슷하도록 맞춘 값 (장비 판매 골드 포함)
const CURIOS = {
  coin:  { name: '옛 금화',     icon: '🪙', res: 'gold', amt: 20, w: 25 },
  idol:  { name: '낡은 목각상', icon: '🗿', res: 'wood', amt: 13, w: 32 },
  helm:  { name: '녹슨 투구',   icon: '⛑️', res: 'ore',  amt: 10, w: 30 },
  gem:   { name: '빛바랜 보석', icon: '🔮', res: 'mana', amt: 5,  w: 22 },
};

// ───────────────────────── 훈련 (골드) ─────────────────────────
// 공격력·체력 훈련은 두 가지를 한다
//  1) 맨몸 능력치: 처음엔 단계마다 ×1.286 로 크게 오르다가 TRAIN_SAT 근처에서 포화 (공격력 약 2,200 · 체력 약 13,000) — 장비가 약한 초반을 끌어 준다
//  2) 무기·갑옷 위력 레벨: 공격력 훈련 → 무기 레벨, 체력 훈련 → 갑옷 레벨 (trainGearLvAt, gear.js gearLvOf).
//     낀 장비의 등급·편차·강화가 여기에 그대로 곱해지므로 후반 힘의 대부분은 장비에서 나온다 (등급 한 칸 ≈ 1.45배, 강화 +25 ≈ 6.5배).
//  위력 레벨 = 1 + 0.6·t + 0.007·t² (훈련 10 → 8 · 30 → 25 · 50 → 49 · 90 → 112) — 초반엔 맨몸 훈련이 끌고 뒤로 갈수록 장비가 커진다.
//  훈련 최대 Lv 은 훈련장 Lv × 10. 전체 진행 봇(7일·12회)에서 예전(0.11.13)과 같은 속도: 6/12/24/48/96/168h 60/74/92/112/135/156 (예전 67/79/93/110/140/157)
const TRAIN_GROW = 1.286, TRAIN_SAT = 120;
const trainGearLvAt = (t) => 1 + 0.6 * t + 0.007 * t * t;
// 위력 레벨 L 에 닿는 최소 훈련 단계 (예전 재련 레벨을 훈련으로 옮길 때)
const trainForGearLv = (L) => Math.max(0, Math.ceil((-0.6 + Math.sqrt(0.36 + 0.028 * Math.max(0, L - 1))) / 0.014));
const trainSat = (t) => (Math.pow(TRAIN_GROW, t) - 1) / (1 + Math.pow(TRAIN_GROW, t) / TRAIN_SAT);
const trainAtkAt = (t) => 6 + 18 * trainSat(t);
const trainHpAt = (t) => 40 + 110 * trainSat(t);
const TRAINING = [
  { id: 'atk',  name: '⚔️ 공격력', max: Infinity, base: 10, grow: 1.32, show: (st) => fmt(st.atk) },
  { id: 'hp',   name: '🛡️ 체력',   max: Infinity, base: 10, grow: 1.32, show: (st) => fmt(st.maxHp) },
  { id: 'def',  name: '🛡️ 방어',   max: Infinity, base: 15, grow: 1.3,  show: (st) => `-${Math.round(st.defRed * 100)}%` },
  { id: 'fortune', name: '💰 수완', max: Infinity, base: 15, grow: 1.3, show: () => `+${Math.round(fortuneBonus() * 100)}%` },
];
// 방어: 받는 피해 감소 = DEF_MAX × 단계 / (단계 + DEF_HALF). 스테이지와 상관없고 올릴수록 효율이 떨어져 DEF_MAX(50%)에는 닿지 않는다
//  (Lv 6 14% · Lv 26 32% · Lv 57 40% · Lv 100 43%)
const DEF_MAX = 0.5, DEF_HALF = 15;
const defRedAt = (t) => DEF_MAX * t / (t + DEF_HALF);
// 수완: 골드·경험치 획득 Lv 당 +3% (몬스터 처치와 레이드 보상에 적용)
const FORTUNE_PER_LV = 0.03;
// 예전 훈련(공속·치명)은 없어졌다. 예전 세이브에 남은 단계는 쓴 골드를 돌려준다 (core.js migrate)
const OLD_TRAINING = { spd: { base: 25, grow: 1.55 }, crit: { base: 30, grow: 1.6 } };

// ───────────────────────── 몬스터 ─────────────────────────
// 잡몹 체력 배율: 한 방에 녹지 않고 두세 대는 맞고 쓰러지게 (보스 체력은 그대로)
const MOB_HP_MULT = 3;
function monsterStats(stage, boss) {
  const hp = 14 * Math.pow(1.23, stage - 1);
  const atk = 3 * Math.pow(1.17, stage - 1);
  const gold = 2 * Math.pow(1.2, stage - 1);
  const exp = 4 * Math.pow(1.16, stage - 1);
  // 필드 마지막 스테이지의 보스(필드 보스)는 필드마다 넘어야 하는 벽이다: 체력 ×4 · 공격력 ×1.6
  //  (일반 보스보다 약 5스테이지 더 센 셈 → 성장이 그만큼 쌓여야 다음 필드로 간다). 보상은 1.5배
  const field = boss && stage === zoneOf(stage).to;
  const f = field ? 1.5 : 1;
  return boss
    ? { hp: hp * 5 * (field ? 4 : 1), atk: atk * 1.4 * (field ? 1.6 : 1), gold: gold * 10 * f, exp: exp * 6 * f, boss: true }
    : { hp: hp * MOB_HP_MULT, atk, gold, exp, boss: false };
}

// ───────────────────────── 필드 ─────────────────────────
// 20스테이지마다 필드가 바뀐다. 앞 필드의 마지막 보스를 한 번이라도 잡아야 다음 필드로 갈 수 있다.
// mobs 는 필드 안에서 5스테이지마다 하나씩 더 나온다 (처음엔 앞의 2종). boss 는 매 스테이지 끝의 보스.
// 마지막 필드는 끝이 없고, 20스테이지마다 몬스터 색이 바뀐다.
const ZONES = [
  { name: '푸른 초원', icon: '🌿', from: 1, to: 20, mobs: ['slime', 'rabbit', 'bee', 'mushroom', 'goblin'], boss: 'wolf',
    ground: { deco: 'meadow', line: 'rgba(46, 94, 44, 0.85)', soil: 'rgba(92, 60, 36, 0.8)', grass: 'rgba(88, 170, 70, 0.9)', accent: '#ffd257' } },
  { name: '묘지 무덤', icon: '🪦', from: 21, to: 40, mobs: ['skeleton', 'bat', 'zombie', 'ghost'], boss: 'lich',
    ground: { deco: 'grave', line: 'rgba(60, 64, 58, 0.9)', soil: 'rgba(52, 44, 48, 0.85)', grass: 'rgba(110, 112, 88, 0.9)', accent: '#8a6fb8' } },
  { name: '독안개 늪', icon: '🐸', from: 41, to: 60, mobs: ['frog', 'bogslime', 'snake', 'lizardman'], boss: 'croc',
    ground: { deco: 'swamp', line: 'rgba(58, 90, 50, 0.9)', soil: 'rgba(48, 58, 38, 0.85)', grass: 'rgba(96, 140, 70, 0.9)', accent: '#8a5a2b' } },
  { name: '화산 동굴', icon: '🌋', from: 61, to: 80, mobs: ['imp', 'magmaslime', 'firesnake', 'golem'], boss: 'drake',
    ground: { deco: 'volcano', line: 'rgba(200, 70, 20, 0.9)', soil: 'rgba(58, 36, 30, 0.9)', grass: 'rgba(90, 70, 60, 0.9)', accent: '#ff9f1c' } },
  { name: '얼어붙은 설원', icon: '❄️', from: 81, to: 100, mobs: ['icewolf', 'icebat', 'snowman', 'yeti'], boss: 'icegolem',
    ground: { deco: 'snow', line: 'rgba(232, 244, 255, 0.95)', soil: 'rgba(120, 146, 176, 0.8)', grass: 'rgba(240, 248, 255, 0.95)', accent: '#9fd8ff' } },
  { name: '마왕성', icon: '🏰', from: 101, to: 120, mobs: ['gargoyle', 'demon', 'shade', 'darkknight'], boss: 'demonlord',
    ground: { deco: 'castle', line: 'rgba(90, 70, 110, 0.9)', soil: 'rgba(40, 32, 48, 0.9)', grass: 'rgba(70, 60, 80, 0.9)', accent: '#ff4d4d' } },
  { name: '심연의 균열', icon: '🌑', from: 121, to: 140, mobs: ['riftcrawler', 'abyssslime', 'tendril', 'voidknight'], boss: 'abysseye',
    ground: { deco: 'abyss', line: 'rgba(120, 70, 170, 0.9)', soil: 'rgba(22, 16, 36, 0.92)', grass: 'rgba(80, 52, 112, 0.9)', accent: '#7df9ff' } },
  { name: '천공의 섬', icon: '☁️', from: 141, to: 160, mobs: ['cloudsprite', 'harpy', 'windbee', 'skygolem'], boss: 'griffin',
    ground: { deco: 'sky', line: 'rgba(236, 246, 255, 0.95)', soil: 'rgba(130, 170, 214, 0.75)', grass: 'rgba(214, 236, 255, 0.95)', accent: '#ffe9a0' } },
  { name: '모래폭풍 사막', icon: '🏜️', from: 161, to: 180, mobs: ['scorpion', 'sandsnake', 'jackal', 'mummy'], boss: 'sandworm',
    ground: { deco: 'desert', line: 'rgba(222, 180, 104, 0.95)', soil: 'rgba(150, 108, 60, 0.85)', grass: 'rgba(204, 172, 100, 0.9)', accent: '#e07a3a' } },
  { name: '심해 신전', icon: '🌊', from: 181, to: 200, mobs: ['jellyfish', 'crab', 'eel', 'fishman'], boss: 'kraken',
    ground: { deco: 'deep', line: 'rgba(48, 150, 176, 0.9)', soil: 'rgba(16, 40, 66, 0.9)', grass: 'rgba(60, 150, 136, 0.9)', accent: '#ff8fb1' } },
  { name: '요정의 숲', icon: '🍄', from: 201, to: 220, mobs: ['glowshroom', 'moth', 'pixie', 'thornrabbit'], boss: 'treant',
    ground: { deco: 'fairy', line: 'rgba(84, 164, 112, 0.9)', soil: 'rgba(34, 48, 58, 0.88)', grass: 'rgba(110, 200, 150, 0.9)', accent: '#c9a6ff' } },
  { name: '고대 기계 유적', icon: '⚙️', from: 221, to: 240, mobs: ['automaton', 'drone', 'spiderbot', 'scrapgolem'], boss: 'titan',
    ground: { deco: 'ruins', line: 'rgba(168, 126, 72, 0.9)', soil: 'rgba(58, 52, 46, 0.9)', grass: 'rgba(122, 112, 92, 0.9)', accent: '#5ad1ff' } },
  { name: '수정 동굴', icon: '💎', from: 241, to: 260, mobs: ['crystalslime', 'crystalbeetle', 'crystalbat', 'shardwisp'], boss: 'crystaltortoise',
    ground: { deco: 'crystal', line: 'rgba(150, 124, 232, 0.9)', soil: 'rgba(34, 30, 62, 0.9)', grass: 'rgba(120, 180, 232, 0.9)', accent: '#ff8fe0' } },
  { name: '폭풍의 봉우리', icon: '⚡', from: 261, to: 280, mobs: ['stormwolf', 'thunderbird', 'stormharpy', 'stormspirit'], boss: 'stormgiant',
    ground: { deco: 'storm', line: 'rgba(112, 122, 144, 0.95)', soil: 'rgba(44, 48, 62, 0.9)', grass: 'rgba(132, 142, 162, 0.9)', accent: '#ffe066' } },
  { name: '별의 끝', icon: '🌌', from: 281, to: Infinity, mobs: ['starling', 'nebulajelly', 'orbiter', 'starknight'], boss: 'starwhale',
    ground: { deco: 'cosmos', line: 'rgba(124, 104, 224, 0.9)', soil: 'rgba(14, 12, 34, 0.92)', grass: 'rgba(92, 82, 172, 0.9)', accent: '#fff3a0' } },
];
const zoneIndex = (stage) => ZONES.findIndex((z) => stage <= z.to);
const zoneOf = (stage) => ZONES[zoneIndex(stage)];
// best 는 지금까지 도달한 가장 높은 스테이지 → 필드 첫 스테이지에 도달했으면(= 앞 필드를 깼으면) 열린다
const zoneUnlocked = (i, best) => best >= ZONES[i].from;
const zoneCleared = (i, best) => best > ZONES[i].to;

function monsterPool(stage) {
  const z = zoneOf(stage);
  return z.mobs.slice(0, Math.min(z.mobs.length, 2 + Math.floor((stage - z.from) / 5)));
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
// 몸통은 같고 아랫줄(다리·꼬리)만 번갈아 바뀌는 2프레임
const walk2 = (body, a, b) => [body.concat(a), body.concat(b)];

Object.assign(SPR, {
  rabbit: walk2([
    '.w..Y..w.',
    '.wp.Y.pw.',
    '.wp...pw.',
    '.ww...ww.',
    '.wwwwwww.',
    'wwKwwwKww',
    'wwwwpwwww',
    '.wwwwwww.',
  ], ['.ww...ww.'], ['..ww.ww..']),
  bee: [[
    '.aa.....aa.',
    'aaaa...aaaa',
    '.aaayyyaaa.',
    '..yKyyyKy..',
    '.yyyyyyyyy.',
    '.KKKKKKKKK.',
    '.yyyyyyyyy.',
    '..KKKKKKK..',
    '...yyyyy...',
    '.....K.....',
  ], [
    '...........',
    '...........',
    'aaaayyyaaaa',
    'aayKyyyKyaa',
    '.yyyyyyyyy.',
    '.KKKKKKKKK.',
    '.yyyyyyyyy.',
    '..KKKKKKK..',
    '...yyyyy...',
    '.....K.....',
  ]],
  mushroom: walk2([
    '...rrrr...',
    '.rrWrrrWr.',
    'rrrrrrrrrr',
    'rWrrrrrWrr',
    'rrrrrrrrrr',
    '..cccccc..',
    '..cKccKc..',
    '..cccccc..',
  ], ['..cc..cc..'], ['...cccc...']),
  wolf: walk2([
    '..e.e........',
    '.nnnnn.......',
    'KnRnnnnnnnn.t',
    '.nnnnnnnnnnnt',
    '..wnnnnnnnnt.',
    '...nnnnnnnn..',
  ], ['...n.n..n.n..', '...K.K..K.K..'], ['..n..n.n..n..', '..K..K.K..K..']),
  ghost: walk2([
    '...wwww...',
    '..wwwwww..',
    '.wwKwwKww.',
    '.wwKwwKww.',
    '.wwwwwwww.',
    '.wwwKKwww.',
    'wwwwwwwwww',
    'wwwwwwwwww',
  ], ['w.ww.ww.ww'], ['ww.ww.ww.w']),
  zombie: walk2([
    '..zzzzz..',
    '.zzzzzzz.',
    '.zKzzzKz.',
    '.zzzzzzz.',
    '..zRRRz..',
    '...zzz...',
    'zzccccczz',
    '..cBcBc..',
    '..ccccc..',
  ], ['..c...c..', '..z...z..'], ['...c.c...', '...z.z...']),
  lich: walk2([
    '...ppppp...',
    '..ppWWWpp..',
    '..pWRWRWp..',
    '..pWWWWWp..',
    '..ppWKWpp..',
    '.ppppppppp.',
    '.ppppGpppp.',
    'Wppppppppp.',
    '.ppppppppp.',
    'ppppppppppp',
  ], ['p.ppp.ppp.p'], ['.ppp.p.ppp.']),
  frog: walk2([
    '.ggg...ggg.',
    'gWKgg.ggWKg',
    'ggggggggggg',
    'gggKKKKKggg',
    'glllllllllg',
    '.glllllllg.',
  ], ['gg.g...g.gg'], ['.gg.g.g.gg.']),
  snake: walk2([
    '...sss......',
    '..sKsss.....',
    'rrsssss.....',
    '....sss.....',
    '....sss.....',
  ], ['....ssss..s.', '...sssdssss.', '..ssssssss..'], ['.....ssss.s.', '..ssssdsss..', '...ssssssss.']),
  lizardman: walk2([
    '..LLLLL..',
    '.LLLLLLL.',
    '.LYLLLYL.',
    'LLLLLLLLL',
    '.LKKKKKL.',
    '..LLLLL..',
    '.LlllllL.',
    'LLlllllLL',
    'L.lllll.L',
    '..LLLLL..',
  ], ['..L...L..', '.LL...LL.'], ['...L.L...', '..LL.LL..']),
  croc: walk2([
    '....cc.cc......',
    '...cYccYcc.....',
    'cccccccccccc...',
    'WcWcWcccccccccc',
    'ccccccccccccccc',
    '.WcWclllllllcct',
    '....cccccccccc.',
  ], ['....cc...cc....'], ['.....cc...cc...']),
  imp: walk2([
    'h.......h',
    'hh.rrr.hh',
    '.rrrrrrr.',
    '.rYrrrYr.',
    '.rrrrrrr.',
    '..rKKKr..',
    '...rrr...',
    'w.rrrrr.w',
    'wwrrrrrww',
    '..rrrrr..',
  ], ['..r...r..'], ['...r.r...']),
  golem: walk2([
    '...oooooo...',
    '..oooooooo..',
    '..oYooooYo..',
    '..oooooooo..',
    '.ooooOoooo..',
    'oooooooooooo',
    'oOoooooOoooo',
    'oo.oooooo.oo',
    'oo.ooOooo.oo',
    '...oooooo...',
  ], ['...oo..oo...', '..ooo..ooo..'], ['....oo.oo...', '...ooo.ooo..']),
  drake: [[
    '..hh.....ww....',
    '.dddd...wwww...',
    'dYdddd.wwwwww..',
    'dddddddwwwwwww.',
    'KKdddddddddddd.',
    '...ddbbbbbdddt.',
    '...dbbbbbbddddt',
    '....dddddddd...',
    '....dd...dd....',
  ], [
    '..hh...........',
    '.dddd..........',
    'dYdddd..wwwww..',
    'dddddddwwwwwww.',
    'KKdddddddddddd.',
    '...ddbbbbbdddt.',
    '...dbbbbbbddddt',
    '....dddddddd...',
    '.....dd...dd...',
  ]],
  yeti: walk2([
    '...wwwww...',
    '..wwwwwww..',
    '..wbKbKbw..',
    '..wbbbbbw..',
    '..wbWWWbw..',
    '.wwwwwwwww.',
    'wwwwwwwwwww',
    'ww.wwwww.ww',
    'ww.wwwww.ww',
    'bb.wwwww.bb',
    '...wwwww...',
  ], ['...ww.ww...', '..www.www..'], ['..ww...ww..', '.www...www.']),
  snowman: walk2([
    '..kkkkk..',
    '..kkkkk..',
    '.kkkkkkk.',
    '..sssss..',
    '.sKsssKs.',
    '.sssosss.',
    '..sssss..',
    'bsssssssb',
    'ssssKssss',
    'sssssssss',
    'ssssKssss',
    '.sssssss.',
  ], ['..sssss..'], ['.sssssss.']),
  darkknight: walk2([
    '....rr.....',
    '...hhhhh...',
    '..hhhhhhh..',
    '..hKRKRKh..',
    '..hhhhhhh..',
    '...hhhhh...',
    '.aaaaaaaaa.',
    'aaaaaYaaaaa',
    'a.aaaYaaa.a',
    '..aaaaaaa..',
    '..bbbbbbb..',
  ], ['..aa...aa..', '..kk...kk..'], ['...aa.aa...', '..kk..kk...']),
  demonlord: walk2([
    'h...........h',
    'hh..ddddd..hh',
    '.hhdddddddhh.',
    '...dRdddRd...',
    '...ddddddd...',
    '...dKWKWKd...',
    'ww..ddddd..ww',
    'wwwcccccccwww',
    'wwcccYYYcccww',
    'w.ccccccccc.w',
    '..ccccccccc..',
    '..ccccccccc..',
  ], ['..cc.....cc..'], ['...cc...cc...']),
  // ── 🌑 심연의 균열 ──
  riftcrawler: walk2([
    '........aaaa..',
    '......aaAAaaa.',
    '..ccc.aaaAaaaa',
    '.cRcRcaaaaaaa.',
    '.cccccaaaaaa..',
  ], ['.l.l.l..l.l.l.', 'l..l..l.l..l.l'], ['..l.l.l..l.l.l', '.l..l.l..l..l.']),
  tendril: [[
    '...ttt...',
    '..tYKt...',
    '..tttt...',
    '..ttt....',
    '.ttSt....',
    '..ttt....',
    '...tSt...',
    '...ttt...',
    '....tSt..',
    '...tttt..',
    '..tStt...',
    '.ttttttt.',
    'vvGGvGGvv',
  ], [
    '....ttt..',
    '...tYKt..',
    '...tttt..',
    '....ttt..',
    '....tSt..',
    '....ttt..',
    '...tSt...',
    '...ttt...',
    '..tSt....',
    '..tttt...',
    '...ttSt..',
    '.ttttttt.',
    'vvGvGGGvv',
  ]],
  abysseye: [[
    '..E...E...E..',
    '..e...e...e..',
    '...e..e..e...',
    '....ooooo....',
    '..ooooooooo..',
    '.ooooWWWoooo.',
    '.oooWIIIWooo.',
    'ooooWKIIWoooo',
    'ooooWKIIWoooo',
    '.oooWIIIWooo.',
    '.ooooWWWOooo.',
    '..oKWKWKWoo..',
    '...ooooooo...',
  ], [
    '.E....E....E.',
    '..e...e...e..',
    '...e..e..e...',
    '....ooooo....',
    '..ooooooooo..',
    '.ooooWWWoooo.',
    '.oooWIIIWooo.',
    'ooooWKIIWoooo',
    'ooooWKIIWoooo',
    '.oooWIIIWooo.',
    '.ooooWWWOooo.',
    '..ooKWKWKoo..',
    '...ooooooo...',
  ]],
  // ── ☁️ 천공의 섬 ──
  harpy: [[
    'w...........w',
    'ww...hhh...ww',
    'www.hSSSh.www',
    '.wwwhKSKhwww.',
    '..wwfSSSfww..',
    '....fffff....',
    '.....fff.....',
    '.....Y.Y.....',
  ], [
    '.............',
    '.....hhh.....',
    '....hSSSh....',
    '.wwwhKSKhwww.',
    'wwwwfSSSfwwww',
    'ww..fffff..ww',
    'w....fff....w',
    '.....Y.Y.....',
  ]],
  cloudsprite: [[
    '...ccc.....',
    '..cCCCc.cc.',
    '.cCCCCCcCCc',
    'cCKCCKCCCCc',
    'cCCCCCCCCCc',
    '.cCmmCCCCc.',
    '..ccc.ccc..',
  ], [
    '....ccc....',
    '.cccCCCc...',
    'cCCCCCCCcc.',
    'cCKCCKCCCCc',
    'cCCCCCCCCCc',
    '.cCmmCCCCc.',
    '.ccc..ccc..',
  ]],
  griffin: walk2([
    '.........ww....',
    '........wwww...',
    '..hh...wwwww...',
    '.hhhh.wwwwww...',
    'YhKhhhwwwww....',
    'YYhhhhbbbbbbb.t',
    '..hhhbbbbbbbbbt',
    '...hbbbbbbbbbt.',
    '....bbbbbbbbb..',
  ], ['....Yb....bb...', '...YY.....bb...'], ['.....bY..bb....', '.....YY..bb....']),
  // ── 🏜️ 모래폭풍 사막 ──
  scorpion: walk2([
    '.......sss..',
    '......s...s.',
    '......s...Y.',
    'ss.....s....',
    's.s.ssss....',
    '.sssKssss...',
    'ss..sSSSSs..',
  ], ['...s.s.s.s..'], ['....s.s.s.s.']),
  mummy: walk2([
    '...wwww...',
    '..wwwwww..',
    '..wRwwRw..',
    '..wwwwww..',
    '..dwwwwd..',
    'wwwwwwww..',
    'wwwdwwww..',
    '...wwdww..',
    '...wwwww..',
    '...dwwww..',
    '...wwdww..',
  ], ['...ww.ww..', '...dw.dw..'], ['..ww..ww..', '..dw..dw..']),
  sandworm: [[
    '...oooooo.....',
    '..oKWKWKWo....',
    '.oKKKKKKKKo...',
    '.oKRRRRRRKo...',
    '.oKKKKKKKKo...',
    '..oWKWKWKo....',
    '..sssssssss...',
    '...sSsSsSss...',
    '...sssssssss..',
    '....sSsSsSss..',
    '....sssssssss.',
    '..ddsssssssssd',
    'ddddddddddddd.',
  ], [
    '..............',
    '...oooooo.....',
    '..oKWKWKWo....',
    '.oKKKKKKKKo...',
    '.oKRRRRRRKo...',
    '..oWKWKWKo....',
    '..sssssssss...',
    '...sSsSsSss...',
    '...sssssssss..',
    '....sSsSsSss..',
    '....sssssssss.',
    '..ddsssssssssd',
    'ddddddddddddd.',
  ]],
  // ── 🌊 심해 신전 ──
  jellyfish: [[
    '..jjjjj..',
    '.jJJJJJj.',
    'jJJjJJjJj',
    'jJKJJJKJj',
    'jjjjjjjjj',
    '.t.t.t.t.',
    't.t.t.t.t',
    '.t..t..t.',
  ], [
    '.........',
    '..jjjjj..',
    '.jJJJJJj.',
    'jJKJJJKJj',
    'jjjjjjjjj',
    't.t.t.t.t',
    '.t.t.t.t.',
    't..t..t.t',
  ]],
  crab: walk2([
    '.CC.......CC.',
    'C..C.....C..C',
    '.CCC.K.K.CCC.',
    '...cccccccc..',
    '..cccccccccc.',
  ], ['..c.c...c.c..'], ['.c.c.....c.c.']),
  kraken: [[
    '.....mmmmm.....',
    '...mmMMmmmmm...',
    '..mmMMmmmmmmm..',
    '..mmmmmmmmmmm..',
    '.mmmmmmmmmmmmm.',
    '.mYYmmmmmYYmmm.',
    '.mYKmmmmmYKmmm.',
    '..mmmmmmmmmmm..',
    '.m.mmmmmmmmm.m.',
    'mm.m.mm.mm.m.mm',
    'm..m.m..m..m..m',
    'mm.mm.m.m.mm.mm',
    '.m..m..m..m..m.',
  ], [
    '.....mmmmm.....',
    '...mmMMmmmmm...',
    '..mmMMmmmmmmm..',
    '..mmmmmmmmmmm..',
    '.mmmmmmmmmmmmm.',
    '.mYYmmmmmYYmmm.',
    '.mYKmmmmmYKmmm.',
    '..mmmmmmmmmmm..',
    'm..mmmmmmmmm..m',
    '.m.m.mm.mm.m.m.',
    '.m.m..m.m..m.m.',
    'm..mm.m.m.mm..m',
    'm...m.m..m.m...',
  ]],
  // ── 🍄 요정의 숲 ──
  pixie: [[
    'w.......w',
    'ww.hhh.ww',
    'wwhSSShww',
    '.whKSKhw.',
    '..wSSSw..',
    '...ddd...',
    '...ddd...',
    '...S.S...',
  ], [
    '.........',
    '...hhh...',
    '..hSSSh..',
    'wwhKSKhww',
    'wwwSSSwww',
    'ww.ddd.ww',
    '...ddd...',
    '...S.S...',
  ]],
  moth: [[
    '....a...a....',
    'MM...a.a...MM',
    'MmMM.fff.MMmM',
    'MOmMMfKfMMmOM',
    'MmMM.fff.MMmM',
    '.MmM.fff.MmM.',
    '..MM..f..MM..',
  ], [
    '....a...a....',
    '.....a.a.....',
    '...MMfffMM...',
    '..MOMfKfMOM..',
    '..MmMfffMmM..',
    '...MMfffMM...',
    '......f......',
  ]],
  treant: walk2([
    '...LLL..LLL....',
    '.LLLlLLLLlLLL..',
    'LLlLLLLLLLLlLL.',
    '.LLLLLlLLLLLLL.',
    '..LLLtttttLLL..',
    'b...ttttttt...b',
    'bb.tYtttYtt..bb',
    '.bbttttttttbbb.',
    '...tttDDDttt...',
    '...ttttttttt...',
    '....tttttttt...',
  ], ['...ttt..tt.tt..', '..tt...tt...tt.'], ['...tt.tt..ttt..', '..tt...tt...tt.']),
  // ── ⚙️ 고대 기계 유적 ──
  drone: [[
    '.PPPP.PPPP.',
    '.....I.....',
    '...mmmmm...',
    '..mMMMMMm..',
    '..mCKMMMm..',
    '..mMMMMMm..',
    '...mmmmm...',
    '....m.m....',
  ], [
    '...PPPPP...',
    '.....I.....',
    '...mmmmm...',
    '..mMMMMMm..',
    '..mCKMMMm..',
    '..mMMMMMm..',
    '...mmmmm...',
    '....m.m....',
  ]],
  automaton: walk2([
    '...mmmm...',
    '..mMMMMm..',
    '..mCCMMm..',
    '..mMMMMm..',
    '...mmmm.K.',
    '.bbbbbbbKK',
    'b.bYbbbbK.',
    'b.bbbbbb..',
    'm.bbYbbb..',
    '..bbbbbb..',
  ], ['..m...m...', '..mm..mm..'], ['...m.m....', '..mm.mm...']),
  titan: walk2([
    '.....mmmmm.....',
    '....mMMMMMm....',
    '....mCCMMMm....',
    '....mMMMMMm....',
    '.mmm.mmmmm.mmm.',
    'mMMMmbbbbbmMMMm',
    'mMMmbbYYYbbmMMm',
    'mMm.bbYCYbb.mMm',
    'mMm.bbYYYbb.mMm',
    'mmm.bbbbbbb.mmm',
    'YYY..bbbbb..YYY',
  ], ['....mm...mm....', '...mmm...mmm...'], ['.....mm.mm.....', '....mmm.mmm....']),
  // ── 💎 수정 동굴 ──
  crystalbeetle: walk2([
    '.....c..c...',
    '....cCc.Cc..',
    '...ccCccCcc.',
    '.hbbbbbbbbbb',
    'hKbbbbbbbbbb',
    '.hbbbbbbbbb.',
  ], ['..b.b..b.b..'], ['.b.b..b.b...']),
  shardwisp: [[
    'C...c....',
    '...cCc...',
    '..cCCCc..',
    '.cCWCCCc.',
    'cCKCCCCCc',
    '.cCCCCCc.',
    '..cCCCc..',
    '...cCc..C',
    '....c....',
  ], [
    '....c...C',
    '...cCc...',
    '..cCCCc..',
    '.cCWCCCc.',
    'cCKCCCCCc',
    '.cCCCCCc.',
    '..cCCCc..',
    'C..cCc...',
    '....c....',
  ]],
  crystaltortoise: walk2([
    '.....C...C.....',
    '....CcC.CcC.C..',
    '...cCcCcCcCcC..',
    '...ssssssssss..',
    '..ssSsssSssSss.',
    '.hhsssSssssSsst',
    'hKhssssssssssst',
    'hhhhssssssssss.',
    '.hhhhhhhhhhhh..',
  ], ['..hh.....hh....'], ['...hh...hh.....']),
  // ── ⚡ 폭풍의 봉우리 ──
  thunderbird: [[
    '......ww.......',
    '.....wwww......',
    '....wwYww......',
    '.hh.wwwww......',
    'YhKhbbbbbbbbt..',
    '..hbbbbbbbbbtt.',
    '....bbbb....t..',
  ], [
    '...............',
    '...............',
    '.hh............',
    'YhKhbbbbbbbbt..',
    '..hbbwwwwbbbtt.',
    '....wwYwwbb.t..',
    '.....www.......',
  ]],
  stormspirit: [[
    '..ccccc..',
    '.cCCCCCc.',
    'cCYCCCYCc',
    'cCCCCCCCc',
    '.cCCYCCc.',
    '..cCYCc..',
    '...cYc...',
    '....Y....',
    '...Y.....',
  ], [
    '..ccccc..',
    '.cCCCCCc.',
    'cCYCCCYCc',
    'cCCCCCCCc',
    '.cCCCYCc.',
    '..cCYCc..',
    '...cYc...',
    '....Y....',
    '.....Y...',
  ]],
  stormgiant: walk2([
    '...h.....h.....',
    '...hhmmmmhh....',
    '....mMMMMm.....',
    '....mYSSYm.....',
    'III.SSSSSS.....',
    'III.BBBBBB.....',
    'III.BBBBBBaa...',
    '.i.aBBBBBBaaa..',
    '.iaaaBBBBaaaaa.',
    '.SaaaaaYaaaa.a.',
    '.i..aaaaaaa..S.',
  ], ['....dd...dd....', '...ddd...ddd...'], ['.....dd.dd.....', '....ddd.ddd....']),
  // ── 🌌 별의 끝 ──
  starling: [[
    '.....y.......',
    '.....y.......',
    '....yyy......',
    'yyyyyyyyyyy..',
    '.yyKyyyKyy.t.',
    '..yyyyyyy..tt',
    '..yyy.yyy....',
    '.yy.....yy...',
    'y.........y..',
  ], [
    '.....y.......',
    '.....y.......',
    '....yyy......',
    'yyyyyyyyyyy.t',
    '.yyKyyyKyy...',
    '..yyyyyyy.tt.',
    '..yyy.yyy....',
    '.yy.....yy...',
    'y.........y..',
  ]],
  orbiter: [[
    '.....ppp.....',
    '...ppPPPpp...',
    '..pPWKPPPPp..',
    'r.pPKKPPPPp.r',
    '.rrrrrrrrrrr.',
    '..pPPPPPPPp..',
    '...ppPPPpp...',
    '.....ppp.....',
  ], [
    '.....ppp.....',
    '...ppPPPpp...',
    '..pPWKPPPPp..',
    '..pPKKPPPPp..',
    'rrrrrrrrrrrrr',
    '..pPPPPPPPp..',
    '...ppPPPpp...',
    '.....ppp.....',
  ]],
  starwhale: [[
    '.............tt.',
    '............tt..',
    '....bbbbbb..tt..',
    '..bbbbbbbbbbbt..',
    '.bbYbbsbbbbbbb..',
    'bbbKbbbbbsbbbbb.',
    'bbbbbbbbbbbbbb..',
    'WWWWWWWWWWbbb...',
    '.WWWWWWWWbb.....',
    '...WWW..........',
  ], [
    '................',
    '................',
    '....bbbbbb......',
    '..bbbbbbbbbbbt..',
    '.bbYbbsbbbbbbbtt',
    'bbbKbbbbbsbbbbtt',
    'bbbbbbbbbbbbbb..',
    'WWWWWWWWWWbbb...',
    '.WWWWWWWWbb.....',
    '...WWW..........',
  ]],
});

// 몬스터 정의. spr: 쓸 스프라이트(없으면 id 와 같은 이름), pal: 덮어쓸 색, fly: 공중에 뜬 높이(px),
// fps: 날갯짓·걸음 속도, atkCd: 공격 간격(초), alpha: 반투명
// style: 공격 모션 (bounce 통통 덮치기 · pounce 웅크렸다 물기 · swing 무기 휘두르기 · slam 내려찍기 · dive 급강하 · cast 마력탄, orb 는 탄 색)
const MONSTERS = {
  // 🌿 푸른 초원
  slime:    { name: '슬라임', style: 'bounce' },
  rabbit:   { name: '뿔토끼', style: 'bounce', pal: { w: '#e8dcc8', p: '#f29bb0', Y: '#ffd257' }, fps: 5 },
  bee:      { name: '왕벌', style: 'dive', pal: { y: '#ffcc33', K: '#2a2218', a: '#d8ecff' }, fly: 18, fps: 10, atkCd: 1.0 },
  mushroom: { name: '독버섯', style: 'slam', pal: { r: '#d8433a', W: '#fff3e0', c: '#f0dcb4' } },
  goblin:   { name: '고블린', style: 'swing', pal: { G: '#8fae3c' } },
  wolf:     { name: '초원 늑대왕', style: 'pounce', pal: { n: '#8a8f99', e: '#5e636e', R: '#ffd257', w: '#e9e4d4', t: '#6e737e' }, fps: 6 },
  // 🪦 묘지 무덤
  skeleton: { name: '해골 병사', style: 'swing', pal: { W: '#e9e4d4' } },
  bat:      { name: '흡혈 박쥐', style: 'dive', pal: { D: '#4b2a6b' }, fly: 20, fps: 8, atkCd: 1.0 },
  zombie:   { name: '구울', style: 'slam', pal: { z: '#7fa06a', R: '#6b2a2a', c: '#5a5e8a', B: '#3a3d5e' }, fps: 2 },
  ghost:    { name: '원혼', style: 'dive', pal: { w: '#e8f0ff', K: '#2a2f4a' }, fly: 12, fps: 4, alpha: 0.8 },
  lich:     { name: '리치', style: 'cast', orb: '#7dffb0', pal: { p: '#4a2a6b', W: '#e9e4d4', R: '#7dffb0', G: '#7dffb0' }, fps: 2 },
  // 🐸 독안개 늪
  frog:      { name: '늪 개구리', style: 'bounce', pal: { g: '#4f9a3a', l: '#c8e07a' }, fps: 4 },
  bogslime:  { name: '독 슬라임', style: 'bounce', spr: 'slime', pal: { g: '#4b3a6b', G: '#8a6fb8', L: '#c9b3ff' } },
  snake:     { name: '독사', style: 'pounce', pal: { s: '#6aa84f', d: '#3f6e2e', K: '#1b1d27', r: '#ff4d4d' }, fps: 4 },
  lizardman: { name: '리자드맨', style: 'swing', pal: { L: '#3d8b6a', l: '#a7d49a', Y: '#ffd257' } },
  croc:      { name: '늪지 악어왕', style: 'pounce', pal: { c: '#4a6b3a', Y: '#ffd257', l: '#b8c98a', t: '#4a6b3a' } },
  // 🌋 화산 동굴
  imp:        { name: '임프', style: 'dive', pal: { r: '#d8433a', h: '#2a1d1d', Y: '#ffe066', w: '#6b2a2a' }, fly: 14, fps: 6, atkCd: 1.1 },
  magmaslime: { name: '용암 슬라임', style: 'bounce', spr: 'slime', pal: { g: '#8a2a10', G: '#ff6a1f', L: '#ffe066' } },
  firesnake:  { name: '화염 뱀', style: 'pounce', spr: 'snake', pal: { s: '#e0582a', d: '#ffb13b', K: '#1b1d27', r: '#ffe066' }, fps: 4 },
  golem:      { name: '용암 골렘', style: 'slam', pal: { o: '#6b5e52', O: '#ff7a2a', Y: '#ffb13b' }, fps: 2, atkCd: 1.8 },
  drake:      { name: '화룡', style: 'cast', orb: '#ff8a1f', pal: { d: '#b8321f', h: '#2a1d1d', Y: '#ffe066', w: '#7a1f14', b: '#ffb13b', t: '#b8321f' }, fps: 4 },
  // ❄️ 얼어붙은 설원
  icewolf:  { name: '서리 늑대', style: 'pounce', spr: 'wolf', pal: { n: '#d6ecff', e: '#9cc4e8', R: '#5ad1ff', w: '#ffffff', t: '#b0d4f0' }, fps: 6 },
  icebat:   { name: '얼음 박쥐', style: 'dive', spr: 'bat', pal: { D: '#7fb8e0', p: '#cfe8ff', R: '#1b6fd1' }, fly: 20, fps: 8, atkCd: 1.0 },
  snowman:  { name: '눈사람', style: 'cast', orb: '#f4f8ff', pal: { k: '#1b1d27', s: '#f4f8ff', o: '#ff8a1f', b: '#6b4a2b' }, fps: 2 },
  yeti:     { name: '예티', style: 'slam', pal: { w: '#eef4ff', b: '#6a8cc8', W: '#ffffff' }, fps: 3 },
  icegolem: { name: '빙하 거인', style: 'slam', spr: 'golem', pal: { o: '#8fbfe0', O: '#e8f6ff', Y: '#1b6fd1' }, fps: 2 },
  // 🏰 마왕성
  gargoyle:   { name: '가고일', style: 'dive', spr: 'bat', pal: { D: '#4a4e5a', p: '#7a7e8a', R: '#ffb13b' }, fly: 20, fps: 6, atkCd: 1.0 },
  demon:      { name: '하급 악마', style: 'dive', spr: 'imp', pal: { r: '#5a2a7a', h: '#c9c9c9', Y: '#ff4d4d', w: '#2a1540' }, fly: 14, fps: 6, atkCd: 1.1 },
  shade:      { name: '그림자', style: 'dive', spr: 'ghost', pal: { w: '#3a2f55', K: '#ff4d4d' }, fly: 12, fps: 4, alpha: 0.85 },
  darkknight: { name: '흑기사', style: 'swing', pal: { r: '#8a1f2a', h: '#2e2e3a', K: '#0e0e14', R: '#ff3030', a: '#3a3a4a', Y: '#8a1f2a', b: '#5a1a1a', k: '#1b1b24' } },
  demonlord:  { name: '마왕', style: 'cast', orb: '#c06bff', pal: { h: '#e9e4d4', d: '#7a1f3a', R: '#ffe066', W: '#f4f1e8', w: '#2a1540', c: '#3a1a4a', Y: '#ffd257' } },
  // 🌑 심연의 균열
  riftcrawler: { name: '균열 거미', style: 'pounce', pal: { a: '#5a3a8a', A: '#7df9ff', c: '#7a52a8', R: '#7df9ff', l: '#4a2f6b' }, fps: 6 },
  abyssslime:  { name: '심연 슬라임', style: 'bounce', spr: 'slime', pal: { g: '#3a2455', G: '#6a4a9a', L: '#7df9ff', W: '#7df9ff', K: '#0d0818' } },
  tendril:     { name: '심연 촉수', style: 'slam', pal: { t: '#7a3f9a', S: '#c9a6ff', Y: '#7df9ff', K: '#0d0818', v: '#1b1430', G: '#7df9ff' }, fps: 2, atkCd: 1.6 },
  voidknight:  { name: '공허 기사', style: 'swing', spr: 'darkknight', pal: { r: '#7df9ff', h: '#4a3470', K: '#0d0818', R: '#7df9ff', a: '#5a3f80', Y: '#7df9ff', b: '#2a1d40', k: '#1b1430' } },
  abysseye:    { name: '심연의 감시자', style: 'cast', orb: '#7df9ff', pal: { e: '#4a2f6b', E: '#7df9ff', o: '#3a2455', O: '#8a6fb8', W: '#f4f1e8', I: '#7df9ff', K: '#0d0818' }, fly: 6, fps: 2 },
  // ☁️ 천공의 섬
  cloudsprite: { name: '구름 정령', style: 'cast', orb: '#bfe3ff', pal: { c: '#9fc4e8', C: '#ffffff', K: '#3a5a8a', m: '#ff9fb8' }, fly: 14, fps: 2 },
  harpy:       { name: '하피', style: 'dive', pal: { w: '#c9a66b', h: '#e8d9a8', S: '#f2c9a0', K: '#1b1d27', f: '#8a6a3a', Y: '#ffd257' }, fly: 18, fps: 6, atkCd: 1.0 },
  windbee:     { name: '바람벌', style: 'dive', spr: 'bee', pal: { y: '#9fe8ff', K: '#2a4a6b', a: '#ffffff' }, fly: 18, fps: 10, atkCd: 1.0 },
  skygolem:    { name: '바람 석상', style: 'slam', spr: 'golem', pal: { o: '#c9d4e0', O: '#7fd8ff', Y: '#ffe066' }, fps: 2, atkCd: 1.8 },
  griffin:     { name: '그리폰 왕', style: 'pounce', pal: { h: '#f4f1e8', Y: '#ffb13b', K: '#1b1d27', w: '#b88a3a', b: '#d8a85a', t: '#8a5a2b' }, fps: 4 },
  // 🏜️ 모래폭풍 사막
  scorpion:    { name: '사막 전갈', style: 'pounce', pal: { s: '#b8742a', S: '#e0a050', Y: '#ff4d4d', K: '#1b1d27' }, fps: 6 },
  sandsnake:   { name: '모래 뱀', style: 'pounce', spr: 'snake', pal: { s: '#d8b070', d: '#8a6a3a', K: '#1b1d27', r: '#ff4d4d' }, fps: 4 },
  jackal:      { name: '사막 자칼', style: 'pounce', spr: 'wolf', pal: { n: '#c9944a', e: '#8a5a2b', R: '#ffe066', w: '#f0d9a8', t: '#8a5a2b' }, fps: 6 },
  mummy:       { name: '미라', style: 'slam', pal: { w: '#e0d4b0', d: '#9a8a64', R: '#5ad1ff' }, fps: 2 },
  sandworm:    { name: '거대 모래벌레', style: 'slam', pal: { o: '#a8704a', K: '#3a1a1a', W: '#f4f1e8', R: '#d8433a', s: '#c9945a', S: '#8a5a34', d: '#d8b070' }, fps: 2, atkCd: 1.8 },
  // 🌊 심해 신전
  jellyfish:   { name: '심해 해파리', style: 'dive', pal: { j: '#c06bff', J: '#f0b8ff', K: '#3a1a5a', t: '#e09bff' }, fly: 14, fps: 3, alpha: 0.85 },
  crab:        { name: '신전 게', style: 'pounce', pal: { c: '#d8533a', C: '#ff8a5a', K: '#1b1d27' }, fps: 5 },
  eel:         { name: '전기 뱀장어', style: 'pounce', spr: 'snake', pal: { s: '#2a6b8a', d: '#ffe066', K: '#1b1d27', r: '#ffe066' }, fps: 4 },
  fishman:     { name: '어인 전사', style: 'swing', spr: 'lizardman', pal: { L: '#2a7a9a', l: '#9fe0d8', Y: '#ffe066', K: '#0d2a3a' } },
  kraken:      { name: '크라켄', style: 'cast', orb: '#5ad1ff', pal: { m: '#8a2a5a', M: '#c9508a', Y: '#ffe066', K: '#1b1d27' }, fps: 2 },
  // 🍄 요정의 숲
  glowshroom:  { name: '빛버섯', style: 'slam', spr: 'mushroom', pal: { r: '#4a8adf', W: '#bfffe0', c: '#e0f0ff', K: '#1b2a4a' } },
  moth:        { name: '달빛 나방', style: 'dive', pal: { M: '#9fc4ff', m: '#d8e8ff', O: '#ffd257', a: '#4a5a8a', f: '#6a5a9a', K: '#1b1d27' }, fly: 18, fps: 6, atkCd: 1.0 },
  pixie:       { name: '픽시', style: 'cast', orb: '#ff9fe0', pal: { w: '#bfffe8', h: '#ff8fc8', S: '#ffe0c8', K: '#1b1d27', d: '#7dffb0' }, fly: 16, fps: 8, alpha: 0.95 },
  thornrabbit: { name: '가시 토끼', style: 'bounce', spr: 'rabbit', pal: { w: '#c9b3ff', p: '#7dffb0', Y: '#7dffb0', K: '#1b1d27' }, fps: 5 },
  treant:      { name: '고목 수호자', style: 'slam', pal: { L: '#3d8b5a', l: '#9fe8b0', t: '#6b4a2b', Y: '#ffe066', D: '#2a1a0d', b: '#5a3a1f' }, fps: 2, atkCd: 1.8 },
  // ⚙️ 고대 기계 유적
  automaton:   { name: '태엽 병정', style: 'swing', pal: { m: '#5a5e6a', M: '#9aa0ae', C: '#5ad1ff', K: '#c9a227', b: '#b8862a', Y: '#ffe066' }, fps: 4 },
  drone:       { name: '감시 드론', style: 'cast', orb: '#5ad1ff', pal: { P: '#c9d1dd', I: '#5a5e6a', m: '#4a4e5a', M: '#8a8f9c', C: '#ff4d4d', K: '#1b1d27' }, fly: 18, fps: 10 },
  spiderbot:   { name: '거미 기계', style: 'pounce', spr: 'riftcrawler', pal: { a: '#6a6e7a', A: '#ffb13b', c: '#4a4e5a', R: '#ff4d4d', l: '#3a3d48' }, fps: 7 },
  scrapgolem:  { name: '고철 골렘', style: 'slam', spr: 'golem', pal: { o: '#7a6a52', O: '#5ad1ff', Y: '#ff4d4d' }, fps: 2, atkCd: 1.8 },
  titan:       { name: '고대 거신병', style: 'slam', pal: { m: '#4a4e5a', M: '#8a8f9c', C: '#5ad1ff', b: '#a8782a', Y: '#5ad1ff' }, fps: 2, atkCd: 1.8 },
  // 💎 수정 동굴
  crystalslime:  { name: '수정 슬라임', style: 'bounce', spr: 'slime', pal: { g: '#6a4fc8', G: '#b8a0ff', L: '#ffffff', W: '#ffffff', K: '#2a1a5a' } },
  crystalbeetle: { name: '수정 갑충', style: 'pounce', pal: { c: '#ff8fe0', C: '#ffe0f8', b: '#5a4aa8', h: '#7a6ac8', K: '#ff8fe0' }, fps: 5 },
  crystalbat:    { name: '수정 박쥐', style: 'dive', spr: 'bat', pal: { D: '#8a6fd8', p: '#d8c8ff', R: '#ff8fe0' }, fly: 20, fps: 8, atkCd: 1.0 },
  shardwisp:     { name: '결정 정령', style: 'cast', orb: '#9fe8ff', pal: { c: '#4a8adf', C: '#9fe8ff', W: '#ffffff', K: '#1b2a5a' }, fly: 14, fps: 3 },
  crystaltortoise: { name: '수정 거북왕', style: 'slam', pal: { c: '#c06bff', C: '#ffd0ff', s: '#3a4a6b', S: '#5a7aa8', h: '#7a8a6a', K: '#1b1d27', t: '#7a8a6a' }, fps: 2, atkCd: 1.8 },
  // ⚡ 폭풍의 봉우리
  stormwolf:   { name: '번개 늑대', style: 'pounce', spr: 'wolf', pal: { n: '#6a7294', e: '#ffe066', R: '#ffe066', w: '#c9d1dd', t: '#ffe066' }, fps: 7 },
  thunderbird: { name: '뇌조', style: 'dive', pal: { w: '#3a4a7a', Y: '#ffe066', h: '#c9d1dd', K: '#1b1d27', b: '#5a6a9a', t: '#ffe066' }, fly: 20, fps: 5, atkCd: 1.0 },
  stormharpy:  { name: '폭풍 하피', style: 'dive', spr: 'harpy', pal: { w: '#4a5a8a', h: '#ffe066', S: '#c9d1dd', K: '#1b1d27', f: '#2e3550', Y: '#ffe066' }, fly: 18, fps: 6, atkCd: 1.0 },
  stormspirit: { name: '뇌운 정령', style: 'cast', orb: '#ffe066', pal: { c: '#4a5272', C: '#7a84a8', Y: '#ffe066' }, fly: 14, fps: 6, alpha: 0.9 },
  stormgiant:  { name: '폭풍 거인', style: 'swing', pal: { h: '#e9e4d4', m: '#5a6488', M: '#9aa4c8', Y: '#ffe066', S: '#8fb8e8', B: '#e8f0ff', a: '#3a4468', I: '#c9d1dd', i: '#7a4a22', d: '#2a3048' }, fps: 3 },
  // 🌌 별의 끝
  starling:    { name: '별똥별 정령', style: 'dive', pal: { y: '#fff3a0', K: '#3a2a6b', t: '#9fe8ff' }, fly: 18, fps: 6, atkCd: 1.0 },
  nebulajelly: { name: '성운 해파리', style: 'dive', spr: 'jellyfish', pal: { j: '#5a4ad8', J: '#9f8aff', K: '#fff3a0', t: '#ff8fe0' }, fly: 14, fps: 3, alpha: 0.85 },
  orbiter:     { name: '떠도는 행성', style: 'cast', orb: '#ff8fe0', pal: { p: '#c0603a', P: '#ff9f6a', W: '#fff3a0', K: '#1b1d27', r: '#e0d4ff' }, fly: 12, fps: 2 },
  starknight:  { name: '별의 기사', style: 'swing', spr: 'darkknight', pal: { r: '#fff3a0', h: '#3a2a8a', K: '#0d0820', R: '#fff3a0', a: '#2a2a6b', Y: '#9fe8ff', b: '#1b1a4a', k: '#120f30' } },
  starwhale:   { name: '별고래', style: 'cast', orb: '#fff3a0', pal: { b: '#2a3a8a', W: '#9fb8ff', Y: '#fff3a0', K: '#0d0820', s: '#fff3a0', t: '#2a3a8a' }, fly: 6, fps: 2 },
};

// 장비 아이콘 모양 (12×12). 글자 색은 장비마다 pal 로 정한다. 그릴 때 어두운 외곽선이 자동으로 붙는다
const GEAR_SPR = {
  // ── 전리품 상자 ──
  crate: [
    '............',
    '............',
    '.HHHHHHHHHH.',
    '.HWWWWWWWGH.',
    '.HBBBBBBBBH.',
    '.HbbbbbbbbH.',
    '.HHHHHHHHHH.',
    '.HGBBBBBBBH.',
    '.HBBBBBBBBH.',
    '.HbbbbbbbbH.',
    '.HHHHHHHHHH.',
    '............',
  ],
  chest: [
    '............',
    '..HHHHHHHH..',
    '.HBWWWWWWBH.',
    '.HBBBBBBBBH.',
    '.HbbbbbbbbH.',
    '.HHHHGGHHHH.',
    '.HBBBJJBBBH.',
    '.HBBBGGBBBH.',
    '.HBBBBBBBBH.',
    '.HbbbbbbbbH.',
    '.HHHHHHHHHH.',
    '............',
  ],
  crown: [
    '............',
    '............',
    '.J...JJ...J.',
    '.B..BWWB..B.',
    '.BB.BBBB.BB.',
    '.BWBBBBBBBB.',
    '.BBBBJJBBBB.',
    '.BBBGJJGBBB.',
    '.HHHHHHHHHH.',
    '.bbbbbbbbbb.',
    '............',
    '............',
  ],
  jewelbox: [
    '............',
    '............',
    '....HHHH....',
    '...HBWWBH...',
    '..HBWBBWBH..',
    '..HHHGGHHH..',
    '..HBBJJBBH..',
    '..HBBGGBBH..',
    '..HbbbbbbH..',
    '..HHHHHHHH..',
    '............',
    '............',
  ],
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

// ───────────────────────── 보스 레이드 ─────────────────────────
// 1~4명이 파티를 짜서 보스를 잡는다. 전투는 서버(server/raid.js)가 계산하고, 하단바에서 재생한다.
// id·stage 는 server/raid.js 의 RAID_BOSSES 와 같아야 한다. stage: 입장에 필요한 최고 스테이지 (보스 능력치 기준이기도 함)
//  spr·pal: 레이드 전용 도트(SPR.rb_*)와 색 · hit·aoe: 평타·광역기 연출 종류(world.js RAID_FX) · fx: 연출 색 · skill: 광역기 이름
//  chest: 처치 상자 — n 내용물 수, w 등급(GRADES 순서)별 가중치, sig 고유 장비가 하나 섞일 확률, spr·pal 상자 모양
//   전설 이상 장비는 여기서만 나온다. 첫 보스부터 원정 최고 등급(영웅) 위주로 시작해 보스를 따라 한 칸씩 오른다:
//   슬라임 킹 영웅 위주(전설 15%) → 리치 킹 영웅·전설 반반 → 화염룡 전설 위주 → 마왕 신화 위주(초월·태초 가끔).
//   고유 장비는 잘 안 나온다(sig 3~6%). 보스를 처음 잡으면 첫 처치 상자에는 그 보스의 고유 장비가 반드시 하나 들어 있다
//  set: 그 보스 고유 장비 3부위(무기·갑옷·장신구) 세트. 같은 보스 것을 2부위·3부위 끼면 효과가 붙는다 (SPECIAL_STATS 키)
const RAID_BOSSES = {
  slimeking: { name: '슬라임 킹', icon: '👑', stage: 10, spr: 'rb_slimeking', hit: 'leap', aoe: 'quake', fx: ['#4aa3ff', '#bfe3ff'], skill: '왕의 점프',
    pal: { y: '#ffd257', R: '#ff3b4b', B: '#3dffa8', g: '#1f4f9a', G: '#4aa3ff', L: '#d8f0ff', W: '#ffffff', K: '#0d1630', m: '#ff6b8a' },
    set: { name: '슬라임 왕가', 2: { hpPct: 0.08 }, 3: { atkPct: 0.08, aspdPct: 0.05 } },
    desc: '초원의 슬라임들이 모이고 모여 왕이 되었다. 뛰어오를 때마다 땅이 흔들린다.',
    chest: { name: '슬라임 킹의 보물상자', n: [3, 3], w: [0, 0, 10, 50, 40, 0, 0, 0], sig: 0.06, spr: 'chest',
      pal: { B: '#2a5fa8', b: '#173a6b', W: '#4aa3ff', H: '#ffd257', G: '#ffd257', J: '#bfe3ff' } } },
  goblinchief: { name: '고블린 족장', icon: '👺', stage: 20, spr: 'rb_goblinchief', hit: 'axe', aoe: 'whirl', fx: ['#c9a227', '#e8d9a8'], skill: '약탈의 회오리',
    pal: { f: '#e0443c', o: '#ff9f1c', y: '#ffd257', I: '#c9d1dd', h: '#7a4a22', g: '#4a6b1f', G: '#8fae3c', Y: '#ffd257', K: '#1b1d27', W: '#f4f1e8', b: '#4a2a14', B: '#7a2a2a' },
    set: { name: '약탈자의 긍지', 2: { atkPct: 0.1 }, 3: { crit: 0.04, goldPct: 0.2 } },
    desc: '초원의 고블린 부족을 하나로 묶은 족장. 빼앗은 보물이 동굴 천장까지 쌓여 있다.',
    chest: { name: '족장의 약탈품 궤짝', n: [3, 3], w: [0, 0, 0, 40, 50, 10, 0, 0], sig: 0.05, spr: 'chest',
      pal: { B: '#6b4420', b: '#3a2410', W: '#8fae3c', H: '#ffd257', G: '#ffd257', J: '#e0443c' } } },
  lichking: { name: '리치 킹', icon: '💀', stage: 40, spr: 'rb_lichking', hit: 'skull', aoe: 'deathwave', fx: ['#7dffb0', '#b38bff'], skill: '죽음의 파동',
    pal: { y: '#ffd257', R: '#ff4d6d', O: '#7dffb0', o: '#e8fff0', p: '#1b1030', k: '#0d0818', W: '#e9e4d4', K: '#0d0818', P: '#3a2463', G: '#7dffb0', s: '#5e3818' },
    set: { name: '불사의 군주', 2: { hpPct: 0.12 }, 3: { guard: 0.06, heal: 0.01 } },
    desc: '묘지의 모든 망자를 거느린 왕. 쓰러뜨려도 성물함이 남아 있는 한 다시 일어난다.',
    chest: { name: '리치 킹의 관', n: [3, 4], w: [0, 0, 0, 20, 55, 25, 0, 0], sig: 0.05, spr: 'jewelbox',
      pal: { B: '#2a1a4a', b: '#150d26', W: '#4a2a6b', H: '#7dffb0', G: '#7dffb0', J: '#ff4d6d' } } },
  boglord: { name: '늪의 군주', icon: '🐊', stage: 60, spr: 'rb_boglord', hit: 'bite', aoe: 'fog', fx: ['#8a6fb8', '#c9b3ff'], skill: '독안개 포효',
    pal: { r: '#6b8f3a', y: '#c9b3ff', c: '#2f4f2a', C: '#4a6b3a', Y: '#d9b3ff', K: '#1b1d27', W: '#f4f1e8', l: '#8a9a5a', t: '#2f4f2a' },
    set: { name: '늪의 지배자', 2: { aspdPct: 0.08 }, 3: { hpPct: 0.15, expPct: 0.15 } },
    desc: '독안개 늪 한가운데 웅크린 거대한 악어. 숨을 내쉴 때마다 늪 전체가 보랏빛으로 물든다.',
    chest: { name: '늪 군주의 이끼 궤', n: [3, 4], w: [0, 0, 0, 5, 50, 40, 5, 0], sig: 0.04, spr: 'chest',
      pal: { B: '#3a5a2a', b: '#1f3315', W: '#8fd8a8', H: '#8a6fb8', G: '#c9b3ff', J: '#ffd257' } } },
  flamedragon: { name: '화염룡', icon: '🐉', stage: 80, spr: 'rb_flamedragon', hit: 'fireball', aoe: 'breath', fx: ['#ff7a1f', '#ffe066'], skill: '화염 숨결',
    pal: { w: '#7a1414', W: '#ff7a1f', h: '#2a1d1d', d: '#b8321f', Y: '#ffe066', K: '#1b0d0a', b: '#ffb13b', t: '#8a1414' },
    set: { name: '화염룡의 분노', 2: { atkPct: 0.15 }, 3: { crit: 0.05, critMult: 0.5 } },
    desc: '화산 동굴 가장 깊은 곳에서 잠든 고룡. 깨어나는 순간 동굴 전체가 용광로가 된다.',
    chest: { name: '화염룡의 보물궤', n: [4, 4], w: [0, 0, 0, 0, 40, 45, 15, 0], sig: 0.04, spr: 'chest',
      pal: { B: '#b3263e', b: '#6e1424', W: '#ff6b81', H: '#ffd257', G: '#ffd257', J: '#ff9f1c' } } },
  frostgiant: { name: '서리 거인', icon: '🧊', stage: 100, spr: 'rb_frostgiant', hit: 'boulder', aoe: 'icicles', fx: ['#9fe8ff', '#ffffff'], skill: '빙하 내려찍기',
    pal: { I: '#9fe8ff', w: '#e8f6ff', b: '#6a8cc8', E: '#5ad1ff', W: '#ffffff' },
    set: { name: '만년설 거인', 2: { hpPct: 0.2 }, 3: { atkPct: 0.15, guard: 0.08 } },
    desc: '설원의 끝에서 산맥을 베개 삼아 자는 거인. 한 걸음에 눈사태가 난다.',
    chest: { name: '서리 거인의 얼음 성궤', n: [4, 4], w: [0, 0, 0, 0, 20, 50, 25, 5], sig: 0.035, spr: 'jewelbox',
      pal: { B: '#8fbfe0', b: '#3f6f9a', W: '#e8f6ff', H: '#ffffff', G: '#ffffff', J: '#1b6fd1' } } },
  demonking: { name: '마왕', icon: '😈', stage: 130, spr: 'rb_demonking', hit: 'darkorb', aoe: 'hellfire', fx: ['#c06bff', '#ff3b4b'], skill: '멸망의 흑염',
    pal: { h: '#e9e4d4', y: '#ffd257', R: '#ff3b4b', d: '#5a0f2a', W: '#f4f1e8', K: '#150a20', c: '#150a20', C: '#3a1a4a', J: '#c06bff' },
    set: { name: '마왕의 권능', 2: { atkPct: 0.2, hpPct: 0.15 }, 3: { aspdPct: 0.15, crit: 0.08, critMult: 0.5, guard: 0.05 } },
    desc: '마왕성의 옥좌에 앉은 모든 어둠의 주인. 그가 일어서면 하늘이 꺼진다.',
    chest: { name: '마왕의 옥좌 보고', n: [4, 5], w: [0, 0, 0, 0, 5, 45, 38, 12], sig: 0.03, spr: 'jewelbox',
      pal: { B: '#2a1540', b: '#150a20', W: '#c06bff', H: '#ffd257', G: '#ffd257', J: '#ff3b4b' } } },
};

// 입장권: 매일 RAID_TICKET_FREE 장까지 무료로 채워 주고, 그 이상은 재화로 산다.
// 입장권은 레이드를 클리어했을 때만 1장 쓰인다 (실패하면 그대로 남음).
// 하루 첫 구매는 헐값, 두 번째부터 점점 비싸진다(자정에 초기화). 사서 모으는 건 최대 RAID_TICKET_MAX 장까지
const RAID_TICKET_FREE = 3;
const RAID_TICKET_MAX = 5;
const RAID_TICKET_GOLD = 20;           // 기준 가격: 최고 스테이지 몬스터 골드 × 이 값 (레이드 승리 골드의 약 1/4)
const RAID_TICKET_MANA = 2;            // 기준 마력석: 이 값 + 최고 스테이지 / 20
const RAID_TICKET_STEPS = [0.05, 1, 2, 3.5, 6];  // 오늘 n번째 구매의 기준 가격 배율 (첫 구매는 헐값)
const RAID_TICKET_GROW = 1.6;          // 표를 넘어가면 한 장마다 × 1.6
const RAID_MVP_MULT = 1.5;             // MVP 는 재화 1.5배
const RAID_FAIL_MULT = 0.25;           // 실패하면 재화 25%만, 상자는 없음
// 보스가 실제로 싸우는 스테이지 = 입장 스테이지 × RAID_SOLO_MULT − 인원 보정 (server/raid.js 의 SOLO_MULT·PARTY_GAP 와 같아야 함).
// 보상도 이 '실제로 싸운 스테이지' 기준이다
const RAID_SOLO_MULT = 2;
const RAID_PARTY_GAP = [0, 5, 9, 13];
const raidStageOf = (b, n) => b.stage * RAID_SOLO_MULT - RAID_PARTY_GAP[Math.max(1, Math.min(RAID_PARTY_GAP.length, n)) - 1];

// ───────────────────────── 레이드 보스 도트 ─────────────────────────
// 필드 몬스터와 다른 레이드 전용 외형 (모두 왼쪽 = 파티 쪽을 본다). 글자 색은 RAID_BOSSES[보스].pal
Object.assign(SPR, {
  rb_slimeking: [[
    '.....y..yy..y.....',
    '.....yy.yy.yy.....',
    '.....yyyyyyyy.....',
    '.....yRyyyyBy.....',
    '....gggggggggg....',
    '..ggGGGGGGGGGGgg..',
    '.gGGLLGGGGGGGGGGg.',
    'gGGLLGGGGGGGGGGGGg',
    'gGWWKGGGGGWWKGGGGg',
    'gGWKKGGGGGWKKGGGGg',
    'gGGGGGGGGGGGGGGGGg',
    'gGGGKmmmKGGGGGGGGg',
    'gGGGGKKKGGGGGGGGLg',
    '.gGGGGGGGGGGGGGLg.',
    '..gggggggggggggg..',
  ]],
  rb_goblinchief: [[
    '....f.o.f.......',
    '...ffooooff.....',
    '...yyyyyyyy..II.',
    '..gGGGGGGGGg.III',
    '.gGYKGGGYKGGgIII',
    'GGGGGGGGGGGGGIh.',
    '.gGGWKWKWGGg.h..',
    '..gGGGGGGGg..h..',
    '..bBBBBBBBb.h...',
    '.bBBByyBBBBbh...',
    'GbBBBBBBBBBbG...',
    'G.byyyyyyyyb.G..',
    '..bBBBBBBBBb....',
    '..bBBb..bBBb....',
    '..GGG....GGG....',
    '.bbbb....bbbb...',
  ]],
  rb_lichking: [[
    '....y..y..y....OO',
    '....yyyyyyy...OoO',
    '...pyRyyyRyp...O.',
    '..ppppppppppp..s.',
    '..pkWWWWWWWkp..s.',
    '.ppkWKKWKKWkpp.s.',
    '.ppkWKRWKRWkpp.s.',
    '.ppkWWWKWWWkpp.s.',
    '..pkkWKWKWkkp..s.',
    '..ppkkWWWkkpp..s.',
    '.ppPPppppppPPp.s.',
    'pPPPPppGpppPPPWs.',
    'pPPPpppGppppPPWs.',
    'pPPpppGGGpppPPps.',
    '.pPPppppppppPPp.s',
    '.pPPpppppppppPp.s',
    '..pPPpppppppPPp.s',
    '..ppPPpppppPPpp.s',
    '.ppppppppppppppps',
    'pp.pp.pp.pp.pp...',
  ]],
  rb_boglord: [[
    '..........r.r.r.r.......',
    '.........ryryryryr......',
    '....cccccccccccccccc....',
    '..ccYcccCCCCCCCCCCcccc..',
    '.cccKccCCCCCCCCCCCCCccct',
    'WcWcWcccCCCCCCCCCCCCcctt',
    'cccccccccccccccccccccccc',
    '.WcWcWllllllllllllcccct.',
    '..cccccllllllllllccccc..',
    '...cc..cccc..cccc..cc...',
    '..ccc..cccc..cccc..ccc..',
    '.cccc.ccccc.ccccc.cccc..',
  ]],
  rb_flamedragon: [[
    '..............ww.....ww.',
    '.............wWw....wWw.',
    '............wWWw...wWWw.',
    '..hh.......wWWWw..wWWWw.',
    '.dddd.....wWWWWwwwWWWWw.',
    'dYdddd....wWWWWWWWWWWWw.',
    'ddddddd...ddddddddddddw.',
    'KKdddddddddbbbbbbbddddd.',
    '.KKddddddbbbbbbbbbbdddd.',
    '....ddddbbbbbbbbbbbddddt',
    '.....dddbbbbbbbbbbdddddt',
    '......ddddddddddddddd.tt',
    '.......dd..dd...dd..dd..',
    '......ddd.ddd..ddd.ddd..',
  ]],
  rb_frostgiant: [[
    '..I............I..',
    '..II..wwwwww..II..',
    '...IIwwwwwwwwII...',
    '....wbbbbbbbbw....',
    '....wbEbbbbEbw....',
    '....wbbbbbbbbw....',
    '....wbWIWIWIbw....',
    '...wwwwIIIIwwww...',
    '.wwwwwwwwwwwwwwww.',
    'wwwIIwwwwwwwwIIwww',
    'wwIIIwwwwwwwwIIIww',
    'ww.IIwwwwwwwwII.ww',
    'II..wwwwwwwwww..II',
    'II..wwwwwwwwww..II',
    '....wwwwwwwwww....',
    '....www....www....',
    '....www....www....',
    '...bbbb....bbbb...',
  ]],
  rb_demonking: [[
    'h..................h',
    'hh................hh',
    '.hh....yy.yy.....hh.',
    '..hh...yyyyyy...hh..',
    '...hhdyRyyyRydhh....',
    '.....dddddddddd.....',
    '.....dRRddddRRd.....',
    '.....dddddddddd.....',
    '.....ddWKWKWKdd.....',
    '......dddddddd......',
    '..ccccccddddcccccc..',
    '.cCCCCCcJJJJcCCCCCc.',
    'cCCCCCCcJJJJcCCCCCCc',
    'cCCcCCCccJJccCCCcCCc',
    'cCc.cCCCccccCCCc.cCc',
    'cc..cCCCCCCCCCCc..cc',
    '....cCCCCCCCCCCc....',
    '....cCCCc..cCCCc....',
    '...ccCCCc..cCCCcc...',
    '...cccc......cccc...',
  ]],
});

// ───────────────────────── 월드 보스 ─────────────────────────
// 하루에 한 마리가 나타나고 서버의 모든 기사가 체력 하나를 함께 깎는다 (server/worldboss.js). 보상 규칙은 src/worldboss.js.
// id 는 server/worldboss.js 의 WORLD_BOSSES 와 같아야 한다. 연출 항목(hit·aoe·fx·skill)은 RAID_BOSSES 와 같은 모양이라 레이드 재생(world.js playRaid)을 그대로 쓴다
const WORLD_BOSSES = {
  behemoth: { name: '대지의 베헤모스', icon: '🦣', spr: 'wb_behemoth', hit: 'boulder', aoe: 'quake', fx: ['#c98b4a', '#7dffb0'], skill: '대지 붕괴',
    pal: { d: '#5a3e2e', D: '#8a6244', h: '#e9e4d4', W: '#f4f1e8', Y: '#ffe066', K: '#1b1d27', r: '#5fcf8a', k: '#2e1d10', t: '#5a3e2e' },
    desc: '등에 숲을 짊어지고 걷는 산만 한 짐승. 발을 구를 때마다 대륙이 갈라진다.' },
  hydra: { name: '아홉 머리 히드라', icon: '🐍', spr: 'wb_hydra', hit: 'bite', aoe: 'fog', fx: ['#7dd84a', '#c9b3ff'], skill: '맹독의 숨',
    pal: { g: '#2f7a4a', L: '#9fd88a', Y: '#ffe066', K: '#1b1d27', r: '#ff4d6d', k: '#1f4a2e', t: '#2f7a4a' },
    desc: '머리 하나를 베면 둘이 자란다. 늪 전체가 이 괴물의 숨결로 썩어 간다.' },
  voidwyrm: { name: '공허룡', icon: '🌌', spr: 'wb_voidwyrm', hit: 'darkorb', aoe: 'breath', fx: ['#c06bff', '#ff4dff'], skill: '공허의 숨결',
    pal: { v: '#2a1840', w: '#3a1a5a', W: '#8a4fd1', h: '#c9c9c9', Y: '#ff4dff', K: '#0d0818', J: '#c06bff', t: '#2a1840' },
    desc: '별과 별 사이의 어둠에서 태어난 용. 날갯짓 한 번에 하늘의 빛이 꺼진다.' },
};

// 월드 보스 도트 (모두 왼쪽 = 기사 쪽을 본다). 글자 색은 WORLD_BOSSES[보스].pal
Object.assign(SPR, {
  wb_behemoth: [[
    '...........r...r...r.....',
    '.........rrrrrrrrrrrr....',
    '.hh....ddddddddddddddd...',
    'h..h..ddddddddddddddddd..',
    'h...hddddddddddddddddddd.',
    '...dddddddddddddddddddd..',
    '.ddYKddddDDDDDDDDDddddd..',
    'ddddddddDDDDDDDDDDDDddddt',
    'dddddddDDDDDDDDDDDDDDddtt',
    'WdWddddDDDDDDDDDDDDDDdt..',
    '.W.ddddDDDDDDDDDDDDDdddt.',
    '...ddddddddddddddddddd...',
    '....ddd..ddd....ddd.ddd..',
    '....ddd..ddd....ddd.ddd..',
    '...kkkk.kkkk...kkkk.kkkk.',
  ]],
  wb_hydra: [[
    '..ggg.......ggg.........',
    '.gYgKg.....gYgKg........',
    '.ggggg..ggg.gggg........',
    '.rr..g.gYgKg..gg........',
    '.....g.ggggg..g.........',
    '.....gg.rgg..gg.........',
    '......gg.gg.gg..........',
    '.......ggggggg.....ttt..',
    '.....gggggggggggg.tt....',
    '....gggLLLLLLLggggtt....',
    '....ggLLLLLLLLLgggt.....',
    '....ggLLLLLLLLLggg......',
    '.....ggLLLLLLLggg.......',
    '......ggggggggg.........',
    '.....gg.gg..gg.gg.......',
    '....kkk.kk..kk.kkk......',
  ]],
  wb_voidwyrm: [[
    '...............ww.......',
    '..............wWw.......',
    '......hh.....wWWw...ww..',
    '.....vvvv...wWWWw..wWw..',
    '....vYvvvv.wWWWWwwwWWw..',
    '...vvvvvvvvvvvvvvvvvvw..',
    '..KKvvvvvvvvvvvvvvvvvv..',
    '...KKvvvvvJJJJJJvvvvvv..',
    '.......vvJJJJJJJJvvvvvt.',
    '.......vvvJJJJJJvvvvvtt.',
    '........vvvvvvvvvvvv.tt.',
    '.........vv..vv..vv...t.',
    '........vvv.vvv.vvv.....',
  ]],
});
