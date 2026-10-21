'use strict';
// 기사단 (docs/specs/guild.md 2단계): Electron 앱의 창 API(window.bar)는 바깥 페이지(src/guild.js)가 보이는 기사 것만 앱으로 보내게 중계한다.
// iframe 에는 앱이 bar 를 넣어 주지 않으므로, 가장 먼저 불리는 이 파일에서 바깥이 준 대리 객체를 건다
try { if (!window.bar && window.parent !== window && window.parent.guildHost && window.parent.guildHost.barFor) window.bar = window.parent.guildHost.barFor(window); } catch {}
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
const GAME_VERSION = '0.29.5';
// 시즌7 기능 스위치. false 면 배포 주소(GitHub Pages·Electron 등)에서는 꺼져 있고, 로컬 개발 주소(localhost·127.0.0.1·*.localhost·*.test, 봇의 가짜 location 포함)에서만 켜진다.
//  아래 DEV_HOST(배속용)와 달리 file: 은 넣지 않는다 — Electron 앱이 파일로 열 때 플레이어에게 켜지지 않게.
//  시즌7 정식 공개 때 true 로 바꾼다.
const S7_DEV = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$|\.test$/.test(location.hostname || '');
// 기사단 (docs/specs/guild.md): 꺼져 있으면 ?guild=1 을 무시하고 보통 게임으로 연다. src/guild.js 의 GUILD_OPEN 도 같이 바꾼다
const GUILD_OPEN = true;   // 시즌7 오픈 (2026-10-18 impl-guild-open) — 켜지면 모든 플레이어가 기사단(로그인 화면)부터 시작
const guildAllowed = () => GUILD_OPEN || S7_DEV;
// 스킬 빌드 트리 (docs/specs/skill-tree-swordsaint.md, src/tree7.js): 켜면 검성·검신(그리고 ?t7=1 로 고른 검사)이 바로 새 트리로 바뀐다.
//  켤 때는 server/index.js SAVE_MIN_VERSION 도 그 버전으로 올린다 (예전 버전은 세이브의 t7 을 버리고 올린다)
const T7_OPEN = true;   // 2026-10-18 시즌7 공개: 15줄기 모두 (docs/specs/skill-tree-all.md)
const CAMP_X = 64;              // 캠프에서 기사가 앉는 화면 x

// 개발용 시간 배속 (KB_SPEED=20 npm start). 스태미나·휴식·건설·부상 시간에만 적용
// 로컬(개발 서버·파일)에서만 받는다 — 배포 주소에서 ?speed= 를 받으면 누구나 시간을 N배로 돌려 재화를 찍어 낸다
const DEV_HOST = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
// ── 게임 시계 ──
// 하루 충전·오프라인 보상은 기기 시계가 아니라 서버 시각으로 잰다. 서버 응답마다 X-Server-Time 으로 기기 시계와의 차이(skew)를 맞추고(src/net.js),
// 그 사이 기기 시계가 튀면(바꿨거나 절전에서 깨어남) 단조 시계(performance.now)와 어긋나므로 다음 서버 응답까지 시각을 믿지 않는다(known=false)
const srvClock = { skew: 0, known: false, wall: Date.now(), mono: performance.now() };
try { srvClock.skew = Number(localStorage.getItem('kb_clock_skew')) || 0; } catch {}
function gameNow() {
  const wall = Date.now(), mono = performance.now();
  if (Math.abs((wall - srvClock.wall) - (mono - srvClock.mono)) > 5000) srvClock.known = false;
  srvClock.wall = wall; srvClock.mono = mono;
  return wall + srvClock.skew;
}
function setServerTime(t) {
  if (!Number.isFinite(t) || t <= 0) return;
  gameNow();
  srvClock.skew = t - Date.now();
  const first = !srvClock.known;
  srvClock.known = true;
  try { localStorage.setItem('kb_clock_skew', String(Math.round(srvClock.skew))); } catch {}
  if (first) hooks.onClockKnown();
}
const TIME_SCALE = DEV_HOST ? Math.max(1, Number(new URLSearchParams(location.search).get('speed')) || 1) : 1;

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
const TOWER_STAGE_PER = 2;            //  한 층 오를 때마다 체력 ×1.12 · 공격력 ×1.08 (0.21.0 성장 압축 전엔 ×1.49 · ×1.36)
// 탑 몬스터는 "덜 맞고 세게 친다": 막히는 층에서 서로 오래 버티며 늘어지지 않고 확실히 쓰러져 실패하게
// 정예·보스 배율은 0.21.0 성장 압축에서 같은 비율(지수 0.28)로 줄였다 — 압축 전 ×2 · ×2.2 는 약 4스테이지어치였는데 그대로 두면 15스테이지어치가 돼 6층쯤 덜 오른다
const TOWER_ELITE_HP = 1.21;          // 탑의 일반 몬스터는 정예: 같은 스테이지 몬스터의 체력 ×1.21 · 공격력 ×1.25
const TOWER_ELITE_ATK = 1.25;
const TOWER_BOSS_HP = 1.21;           // 10층 보스는 같은 스테이지 보스보다 체력 ×1.21 · 공격력 ×1.14 더 (바로 아래층 정예보다 확실히 세게)
const TOWER_BOSS_ATK = 1.14;
// 무리 층: 층 번호 끝자리가 TOWER_PACK_FLOORS 인 층은 정예 무리 TOWER_PACK_N 마리 (종류는 마리마다 따로 뽑는다)
//  마리당 체력 = 정예 × TOWER_PACK_HP (합 1.2배 — 마리 사이엔 싸우지 않아 쉬워지는 몫), 공격력 = 정예 × TOWER_PACK_ATK, 골드·경험치 = 정예 ÷ 마리 수
const TOWER_PACK_FLOORS = [3, 6, 9];
const TOWER_PACK_N = 3;
const TOWER_PACK_HP = 0.4;
const TOWER_PACK_ATK = 1;
const TOWER_ENRAGE_SEC = 10;          // 한 층에서 이만큼 싸우면 광폭화: 그 뒤 TOWER_ENRAGE_DOUBLE 초마다 공격력 2배씩 (10초 ×1, 15초 ×4, 20초 ×16, 25초 ×64…)
const TOWER_ENRAGE_DOUBLE = 2.5;
// 탑 비전서: 올라가며 깬 층 하나에 1권 (하루 한도 없음) + 10층 단위 첫 돌파 묶음.
//  입장권은 하루 TOWER_TICKETS 장 — 도전 입장 또는 소탕(입장 없이 최고 층 수만큼 📖)에 1장씩 (tower.js)
//  도전 입장은 소탕분(최고 층 수)을 기본 보장 + 깬 층마다 1권 — 소탕보다 손해 보는 일이 없다
//  숙련도는 스킬 하나 Lv30 에 239권
const TOWER_TICKETS = 3;
// 탑·미궁 입장권 추가 구매 (tower.js buyTowerTicket · dungeon.js buyDgTicket). 골드만 든다 (docs/specs/ticket-buy.md).
//  가격 = 최고 스테이지 몬스터 골드 × 기준값(TOWER_TICKET_GOLD · DG_TICKET_GOLD) × subTicketMult(오늘 n번째 구매)
//  원정은 약 6초에 1마리 → 몬스터 골드 × 300 ≈ 사냥 30분치 (골드 보너스 제외). 탑은 30분치, 미궁은 한 판 보상이 커서 1시간치
//  오늘 n번째 구매 배율: 0.5 → 1 → 2 → 3.5 → 6 → 그 뒤 × 1.7씩 → 하루 2~3장은 사냥 골드로 무리 없이, 4장째부터는 확 부담스러워진다
//  구매 수는 콘텐츠마다 따로 센다. 산 입장권은 자정에 사라지지 않고 SUB_TICKET_HOLD 장까지 모아 둘 수 있다 (무료 입장권을 먼저 쓴다)
const TOWER_TICKET_GOLD = 300;
const DG_TICKET_GOLD = 600;
const SUB_TICKET_STEPS = [0.5, 1, 2, 3.5, 6];
const SUB_TICKET_GROW = 1.7;
const SUB_TICKET_HOLD = 5;
function subTicketMult(n) {
  const last = SUB_TICKET_STEPS.length - 1;
  return n <= last ? SUB_TICKET_STEPS[n] : SUB_TICKET_STEPS[last] * Math.pow(SUB_TICKET_GROW, n - last);
}
const BOSS_TOME_DROP = 0.15;          // 원정 보스가 📖 비전서를 떨굴 확률 (스킬 숙련도, classes.js)
const POTION_AT = 0.3;                // 체력 30% 이하에서 물약 자동 사용
const CAMP_HEAL_PER_SEC = 0.1;        // 캠프에서 초당 최대 체력의 10% 회복

// ───────────────────────── 전투 거리 ─────────────────────────
const MELEE_REACH = 14;               // 몬스터 공격 사거리 (몸 반폭 제외)
const MONSTER_SPEED = 24;             // 몬스터가 기사에게 다가오는 속도 px/s
const AGGRO_RANGE = 260;              // 이 거리 안에 들어오면 몬스터가 다가온다

// ───────────────────────── 건물 ─────────────────────────
const BUILD_MAX = 20;
// 🎓 교관 수련 (src/mentor.js) 스위치. 0.20.6 에 껐다가 시즌6 에 📕 수련의 서 확정 상승으로 다시 켰다 (docs/specs/training-mentors.md).
//  1차 훈련 한도와는 연결하지 않는다 — 켜고 꺼도 훈련은 훈련장 Lv × 10 (최대 200). 끄면 교관을 만날 수 없고 별 보너스도 없다 (별은 세이브에 남는다)
const MENTOR_ON = true;
const TRAIN_MAX = 10 * BUILD_MAX;
const trainCapAt = (lv) => 10 * Math.min(lv, TRAIN_MAX / 10);
// 초반엔 원정이 4분이라 자주 손봐야 하고, 여관을 올릴수록 길어져 방치가 된다
// (Lv5 약 11분 · Lv10 약 42분 · Lv15 약 2.6시간 · Lv20 약 10시간)
const maxStaminaAt = (lv) => Math.round(20 * Math.pow(1.3, lv - 1)) * 5;
const restSecAt = (lv) => 180 * Math.pow(1.1, lv - 1);          // 0 → 최대 스태미나까지 (Lv1 3분 · Lv20 약 18분)
// 가방 (0.20.3): 여관 안의 별도 업그레이드. 무게 10 + 2/Lv, 최대 Lv = 여관 Lv (대장간 시설과 같은 규칙), 비용은 같은 Lv 여관 목재의 1/4 (바로 오름)
//  최대 48 이라 여관 12(원정 72분) 즈음부터는 스태미나보다 가방이 먼저 찬다 (사용자 결정 — 0.19.32 는 최대 여관 Lv × 8 · 목재 50×1.06^Lv)
const bagCapAt = (lv) => 10 + 2 * (lv - 1);                     // 가방이 들 수 있는 무게 (상자마다 무게가 다름)
const bagUpCost = (lv) => Math.floor(buildCost('inn', lv).wood / 4);   // lv → lv+1 목재
const oldBagUpCost = (lv) => Math.round(50 * Math.pow(1.06, lv - 1));  // 0.19.32 비용 (core.js migrate 환급용)
// 창고 비축 (0.19.31): 가만히 있어도 목재·철광석이 시간당 쌓이고, STOCK_HOURS 시간분까지 모인다. 서버 시각으로 흐른다 (core.js settleStock)
const STOCK_BASE = { wood: 10, ore: 7 }, STOCK_GROW = 1.3, STOCK_HOURS = 12;
const stockRateAt = (k, lv) => Math.round(STOCK_BASE[k] * Math.pow(STOCK_GROW, lv - 1));   // 시간당
const stockCapAt = (k, lv) => stockRateAt(k, lv) * STOCK_HOURS;
// 창고 교역: 창고 Lv TRADE_LV 부터 골드로 목재·철광석을 산다. 한 번에 TRADE_HOURS 시간 생산량과 다음 건물 비용 평균의 TRADE_SHARE 중 큰 쪽
//  (0.20.15 — 2시간 생산량만으론 건물 비용을 못 따라가 남는 골드를 재료로 바꿀 길이 없었다), 하루 5 + Lv 회 (목재·철광석 공용)
//  가격 = 최고 스테이지 잡몹 골드 × TRADE_GOLD × TRADE_GROW^(오늘 교역한 횟수) — 골드가 스테이지를 따라 기하급수로 느는 경제라 가격도 스테이지를 따라간다
const TRADE_LV = 5, TRADE_HOURS = 2, TRADE_GOLD = 200, TRADE_GROW = 1.3, TRADE_SHARE = 0.1;
const tradesAt = (lv) => (lv >= TRADE_LV ? 5 + lv : 0);
const buildTimeAt = (lv) => 60 * Math.pow(1.8, lv - 1);          // lv → lv+1 소요 시간(초)
// 건설 즉시 완료 (0.21.1): 남은 1분당 최고 스테이지 잡몹 골드 × BUILD_RUSH_GOLD (원정 1시간 ≈ 잡몹 263마리라 남은 1시간 ≈ 원정 30분 골드). 기다릴수록 싸진다
const BUILD_RUSH_GOLD = 2.2;

const BUILDINGS = {
  training: {
    name: '훈련장', icon: '🎯', mul: { gold: 1, wood: 1, ore: 0.6, mana: 0.6 },
    effect: (lv) => `훈련 최대 Lv ${trainCapAt(lv)}`,
  },
  inn: {
    name: '여관', icon: '🛏️', mul: { gold: 1, wood: 1.3, ore: 0.4, mana: 0.8 },
    effect: (lv) => `원정 ${fmtTime(maxStaminaAt(lv) / STAMINA_DRAIN)} · 완전 휴식 ${fmtTime(restSecAt(lv))} · 가방 최대 Lv ${lv}`,
  },
  storage: {
    name: '창고', icon: '📦', mul: { gold: 0.8, wood: 1.5, ore: 0.3, mana: 0.6 },
    effect: (lv) => `🪵 ${stockRateAt('wood', lv)}/h · 🪨 ${stockRateAt('ore', lv)}/h · 최대 ${STOCK_HOURS}시간${lv >= TRADE_LV ? ` · 교역 하루 ${tradesAt(lv)}회` : ''}`,
  },
  forge: {
    name: '대장간', icon: '⚒️', mul: { gold: 1.2, wood: 0.4, ore: 1.6, mana: 1.4 },
    effect: (lv) => `⚒️ 부위 강화 · 시설 최대 Lv ${lv}`,
  },
};

// 건물 최대 Lv (건물마다 max 가 있으면 그것, 없으면 BUILD_MAX)
const bldMax = (id) => BUILDINGS[id].max || BUILD_MAX;
// 목재·철광석은 Lv BUILD_MAT_KNEE 까지 ×2, 그 위로는 ×BUILD_MAT_LATE (0.20.15 — ×2 그대로면 Lv15 16만·Lv20 1,000만 목재로 수입이 못 따라갔다)
const BUILD_MAT_KNEE = 8, BUILD_MAT_LATE = 1.5;
const buildMatGrow = (lv) => Math.pow(2, Math.min(lv, BUILD_MAT_KNEE) - 1) * Math.pow(BUILD_MAT_LATE, Math.max(0, lv - BUILD_MAT_KNEE));
function buildCost(id, lv) {
  const m = BUILDINGS[id].mul;
  return {
    gold: Math.floor(40 * Math.pow(1.9, lv - 1) * m.gold),
    wood: Math.floor(20 * buildMatGrow(lv) * m.wood),
    ore: Math.floor(12 * buildMatGrow(lv) * m.ore),
    // 💎 마력석은 0.23.2 에 뺐다 — 마력석은 고강화(+10~)·전직 재료 (docs/specs/currency-roles.md). 비용 칩·canAfford 가 0 을 그대로 넘기게 키는 남긴다
    mana: 0,
  };
}

// ───────────────────────── 대장간 시설 ─────────────────────────
// 대장간은 능력치를 주지 않고 장비를 다루는 시설을 품는다. 시설마다 따로 올리고(재화 즉시 소모), 대장간 Lv 이 시설의 최대 Lv 이다.
// 무기·갑옷의 기본 위력은 기사 레벨이 정한다 (data.js gearAtkAt) — 0.12 의 재련·재련로는 0.13.3 에서 없어졌다 (core.js migrate 가 환급)
// 부위 강화(S.gear.enh)도 대장간 화면에서 한다 — 시설 Lv 과는 무관하고 💠 강화석만 묶는다 (ui.js viewForge)
const TEMPER_CAP = 20, TEMPER_RATE = 0.005, TEMPER_DOWN = 0.015;   // 담금질대 — 아래 설명 참고
const FORGE_FAC = {
  salvage: { name: '분해대', icon: '🧰', desc: '장비를 분해할 때 나오는 💠 강화석이 늘어나요',
    effect: (lv) => (lv ? `판매 강화석 ×${salvageMultAt(lv).toFixed(1)}` : '아직 없음') },
  enchant: { name: '옵션 재굴림대', icon: '🎲', desc: '🎲 재굴림권으로 장비 옵션 한 줄을 다시 굴려요 — Lv 이 오를수록 품질 바닥이 오르고 쓰레기 옵션이 줄어요',
    effect: (lv) => (lv ? `품질 ${Math.round(enchantQualAt(lv) * 100)}~100% · 쓰레기 −${lv}%p` : '아직 없음') },
  temper: { name: '담금질대', icon: '🔥', desc: `+${TEMPER_CAP}까지 가는 강화의 성공 확률을 올리고 하락을 줄여요 — +${TEMPER_CAP} 이상에서 시도하는 강화엔 효과가 없어요`,
    effect: (lv) => (lv ? `성공 +${(TEMPER_RATE * lv * 100).toFixed(1)}%p · 하락 −${Math.round(TEMPER_DOWN * lv * 100)}%` : '아직 없음') },
};
// 담금질대 (0.19.24): +0 ~ +19 에서 시도하는 강화만 완화한다 (+20 이상은 그대로 어렵게). 초기화 확률은 건드리지 않는다.
//  성공 +0.5%p/Lv (Lv20 +10%p), 실패 시 하락 비율 ×(1 − 0.015·Lv) (Lv20 −30%, 0.19.24 의 −3%/Lv 는 과하다는 피드백으로 0.19.25 에서 절반)
//  기대 시도 (0 → +20, 보호 주문서 없이): Lv0 약 91회 · Lv20 약 48회 (0.21 초기화 절반 뒤. 그 전엔 112 · 54)
//  (0.12.2 의 연마대(anvil)는 0.12.3 에서 빠졌고 core.js migrate 가 s.forge.anvil 을 환급·삭제하므로 id 를 다시 쓰지 않는다)
// 분해대: 판매 강화석 ×(1 + 0.1·Lv) (Lv20 ×3)
const salvageMultAt = (lv) => 1 + 0.1 * lv;
// 옵션 재굴림대 (시즌6, 0.18 의 마법부여대(it.en)를 대신한다 — 시설 id 'enchant' 와 Lv 은 그대로)
//  장비 옵션 줄(it.op, 아래 GEAR_OPTS) 하나를 🎲 재굴림권 1장으로 다시 굴린다.
//  0.23.1 에 💠 강화석·💎 마력석 비용을 뺐다 — 강화석은 강화 전용으로 두고, 재굴림은 재굴림권(상점 없음, 드랍만)이 묶는다
//  품질 바닥 enchantQualAt(Lv) (Lv당 4%, Lv20 80%), 쓰레기 옵션 확률 −1%p/Lv (최소 OPT_JUNK_MIN)
const enchantQualAt = (lv) => Math.min(1, 0.04 * lv);
const rerollCost = () => ({ reroll: 1 });

// ───────────────────────── 장비 옵션 줄 (시즌6) ─────────────────────────
// 장비를 얻을 때 등급별 줄 수(OPT_LINES)만큼 옵션을 미리 굴려 둔다. 줄 i(0부터)는 그 부위 강화가 OPT_STEP·(i+1) 에 닿으면 켜진다
//  (강화 단계는 부위에 붙어 있으므로 장비를 바꿔 껴도 켜진 줄 수는 부위 강화를 따른다).
//  값 = (lo + (hi − lo)·q) × OPT_MULT[등급], q 는 품질 0~1 (S ≥ 0.9 · A ≥ 0.65 · B ≥ 0.35 · C). 같은 옵션이 여러 줄이면 합산.
//  먼저 OPT_JUNK[등급] 확률로 쓰레기 옵션(junk)을 고르고, 아니면 나머지에서 균등하게 고른다.
const OPT_STEP = 5;
// 줄 수는 등급 색을 따른다 (0.21: 일반 0 · 고급 1 · … · 초월·태초 6, 6번째 줄은 +30). 태초는 줄 대신 값 배율로 차이를 둔다 (1.75 → 2.0).
//  그 전에 얻은 장비의 줄은 줄이지 않는다 (일반 1줄·고급 2줄 그대로 — core.js migrate gearV 9)
const OPT_LINES = [0, 1, 2, 3, 4, 5, 6, 6];
const OPT_MULT = [0.4, 0.55, 0.7, 0.85, 1, 1.2, 1.45, 2.0];
const OPT_JUNK = [0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.06];
const OPT_JUNK_MIN = 0.03;
const OPT_RANKS = [[0.9, 'S'], [0.65, 'A'], [0.35, 'B'], [0, 'C']];
const STA_SAVE_MAX = 0.3;          // 스태미나 소모 감소 합산 상한
const GEAR_OPTS = {
  // 전투
  atkPct:   { lo: 0.03,  hi: 0.10 },
  hpPct:    { lo: 0.03,  hi: 0.10 },
  aspdPct:  { lo: 0.02,  hi: 0.06 },
  crit:     { lo: 0.01,  hi: 0.03 },
  critMult: { lo: 0.05,  hi: 0.20 },
  guard:    { lo: 0.02,  hi: 0.06 },
  heal:     { lo: 0.002, hi: 0.008 },
  bossDmg:  { lo: 0.05,  hi: 0.15 },
  skillDmg: { lo: 0.05,  hi: 0.15 },
  execute:  { lo: 0.08,  hi: 0.20 },
  firstHit: { lo: 0.20,  hi: 0.60 },
  // 원정·경제
  goldPct:  { lo: 0.05,  hi: 0.20 },
  expPct:   { lo: 0.05,  hi: 0.20 },
  staSave:  { lo: 0.03,  hi: 0.08 },
  lootPct:  { lo: 0.03,  hi: 0.10 },
  matPct:   { lo: 0.05,  hi: 0.15 },
  stonePct: { lo: 0.05,  hi: 0.15 },
  tomePct:  { lo: 0.03,  hi: 0.10 },
  bagCap:   { lo: 1,     hi: 3 },
  // 쓰레기 (효과는 있지만 체감이 거의 없다)
  sellPct:    { lo: 0.02, hi: 0.06, junk: true },
  lunchPct:   { lo: 0.02, hi: 0.05, junk: true },
  potionSave: { lo: 0.02, hi: 0.05, junk: true },
  walkSpd:    { lo: 0.03, hi: 0.08, junk: true },
  curioGold:  { lo: 0.03, hi: 0.08, junk: true },
  restPct:    { lo: 0.01, hi: 0.03, junk: true },
};
const optRank = (q) => OPT_RANKS.find(([t]) => q >= t)[1];
const optValueAt = (k, q, g) => { const o = GEAR_OPTS[k]; return Math.round((o.lo + (o.hi - o.lo) * q) * OPT_MULT[g] * 10000) / 10000; };
// 건물·시설은 능력치를 직접 주지 않는다 (0.13.1 의 공명로는 0.13.2 에서 빠짐, core.js migrate 가 환급)
// 시설 lv → lv+1 비용. 0.23.2: 🪨 철광석 절반(20 → 10 · 1.7^Lv) — 시설 3종이 대장간 건물 한 레벨의 약 1.7배를 먹어 건물을 막았다,
//  💎 마력석은 뺐다 (마력석은 고강화·전직 재료, docs/specs/currency-roles.md)
function forgeFacCost(id, lv) {
  return {
    gold: Math.floor(150 * Math.pow(1.75, lv)),
    wood: 0,
    ore: Math.floor(10 * Math.pow(1.7, lv)),
    mana: 0,
  };
}

// ───────────────────────── 재화 / 보급품 ─────────────────────────
const MATERIALS = {
  wood: { name: '목재', icon: '🪵' },
  ore: { name: '철광석', icon: '🪨' },
  mana: { name: '마력석', icon: '💎' },
};

// price 는 최고 스테이지의 몬스터 골드 × 배수, w 는 상자 소비 아이템 칸 가중치, shop: false 는 상점에서 안 팖 (드롭 전용)
const SUPPLIES = {
  lunch:  { name: '도시락',     icon: '🍱', price: 15, w: 35, desc: '캠프에서 먹으면 최대 스태미나의 50% 회복' },
  potion: { name: '회복 물약',  icon: '🧪', price: 10, w: 40, desc: '원정 중 체력 30% 이하에서 자동 사용 (쓰러짐 방지)' },
  charm:  { name: '행운의 부적', icon: '🍀', price: 30, w: 12, desc: '이번 원정 동안 좋은 등급의 전리품이 더 잘 나옴' },
  elixir: { name: '투지의 영약', icon: '🔥', price: 30, w: 13, desc: '이번 원정 동안 공격력 +30%' },
  protect: { name: '보호 주문서', icon: '📜', price: 0, w: 60, shop: false, desc: '강화할 때 1장 써서, 실패로 단계가 떨어지거나 초기화되는 걸 막아 줌 (원정 상자·레이드 처치 상자·월드 보스에서 나옴)' },
  // 재굴림권: 상점에 없다(shop: false) — 원정 상자·레이드 처치 상자·월드 보스 보상에서만 (REROLL_DROP)
  reroll: { name: '재굴림권', icon: '🎲', price: 0, w: 0, shop: false, desc: '대장간 🎲 옵션 재굴림대에서 장비 옵션 한 줄을 다시 굴림' },
};
// 보호 주문서 드랍 확률: 레이드 처치 상자 1개당 / 월드 보스 하루 보상(잡은 날은 kill)
//  (보호 주문서는 원정 상자가 주 공급처 — protect-scroll-drop.md. 레이드·월드 보스 몫은 덤)
const RARE_DROP = {
  raid: { protect: 0.06 },
  wb:   { protect: 0.15 },
  wbKill: { protect: 0.3 },
};
// 재굴림권은 확률 뽑기가 아니라 넉넉히 뿌린다 (reroll-drop.md)
//  box: 원정 상자 하나 열 때마다 확률 (원정 1회 상자 약 13개 → 평균 약 0.5장, 2판에 1장꼴)
//  raid / wb: 레이드 처치 상자 하나 · 월드 보스 하루 보상마다 [최소, 최대]장 확정
const REROLL_DROP = { box: 0.04, raid: [3, 5], wb: [3, 5] };
// ───────────────────────── 우편함 ─────────────────────────
// 모든 기사에게 보내는 우편. id 는 한 번 정하면 바꾸지 않는다 (받았는지를 S.mail.got 에 id 로 남긴다).
// at ~ until 사이에만 우편함에 보인다. reward: { items: { 보급품 id: 개수 }, gold, stones, tomes, raidTickets }
// raidTickets 는 구매 상한(RAID_TICKET_MAX)을 넘겨서도 쌓인다
// 시즌3 강화 확률 사과 편지(sorry-enhance-1007·-b)는 시즌4 리셋과, 시즌4 시작 편지는 시즌5 리셋과, 시즌5 편지(season5-start·시즌 중 업데이트·사과 우편 6통)는 시즌6 리셋과, season6-start 는 10-20 시즌7 리셋과 함께 뺐다
const MAIL = [
  {
    id: 'season7-restart',
    at: Date.parse('2026-10-20T00:00:00+09:00'),
    until: Date.parse('2026-11-03T00:00:00+09:00'),
    from: '기사 키우기 개발자',
    title: '시즌7 「불도게자 강주수」 시작! 모두 같은 줄에서 다시 출발해요',
    body: [
      '시즌7 「불도게자 강주수」가 새로 시작돼요. 공정한 경쟁을 위해 기록을 한 번 초기화했어요. 지금까지의 순위는 🏆 랭킹 탭의 명예의 전당에 남겨 두었어요.',
      '시즌7에는 🛡️ 기사단(여러 기사 동시 진행)과 새 스킬 빌드 트리가 열려 있어요. 처음부터 다시 키워 보세요.',
      '불편을 드려 죄송한 마음과 감사의 마음을 담아 출발 선물을 보내 드려요. 이번엔 🍱 도시락을 넉넉하게 담았어요. 우편함에서 받아 가세요!',
    ],
    reward: { items: { lunch: 10, charm: 1, elixir: 1, potion: 3 } },
  },
];

// 가방에서 소비 아이템이 나올 때 테두리 색으로 쓰는 등급
const SUPPLY_GRADE = { lunch: 0, potion: 0, charm: 2, elixir: 2, protect: 3, reroll: 4 };

// ───────────────────────── 전리품 등급 ─────────────────────────
// 장비·골동품 공통. stat: 장비 능력치 배수, sell: 판매가(몬스터 골드 배수), res: 골동품 재화 배수
// 장비 수급은 둘로 나뉜다: 원정은 일반~영웅(짜바리 위주, 영웅은 가끔 터지는 대박), 전설 이상은 레이드 처치 상자에서만.
// 시즌6 희소성 개편: 원정 1회(상자 약 13개, 보스 3마리 기준) 장비 기대치 영웅 약 15회에 1개 (부적을 쓰면 2배). 희귀·영웅은 필드가 깊어야 나온다 (GRADE_FROM)
const GRADES = [
  { name: '일반', color: '#b8bcc6', w: 70,  stat: 1,   sell: 3,  res: 1 },
  { name: '고급', color: '#5fcf5a', w: 24,  stat: 1.5, sell: 6,  res: 2 },
  { name: '희귀', color: '#4aa3ff', w: 5.5, stat: 2.2, sell: 12, res: 4 },
  { name: '영웅', color: '#b36bff', w: 0.5, stat: 3.2, sell: 30, res: 8 },
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
// 원정 상자 등급이 나오기 시작하는 스테이지 (희귀 필드 2 · 영웅 필드 4)
const GRADE_FROM = [1, 1, 21, 61];
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
//   시즌 5 보스(심연의 감시자 ~ 종언의 성좌신)도 태초 — 등급은 더 없으니 특수 효과 크기와 세트 효과로 오른다
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
  // ── 시즌 5 보스 고유 장비: 모두 태초급 능력치, 뒤 보스일수록 특수 효과가 조금씩 세진다 ──
  // 👁️ 심연의 감시자
  abyss_scythe:  { slot: 'weapon', g: 7, raid: 'abysswatcher', name: '심연 응시자의 낫', icon: '🌑', spr: 'scythe', sp: { atkPct: 0.2, crit: 0.03 },
    desc: '감시자의 눈꺼풀 가시를 날로 벼렸다. 휘두른 자리에 잠깐 균열이 남는다.',
    pal: { B: '#7a4fd1', b: '#3a1a6b', W: '#e0f8ff', H: '#0d0818', G: '#5ad1ff', J: '#ff3b8a' } },
  rift_robe:     { slot: 'armor', g: 7, raid: 'abysswatcher', name: '균열 직조 로브', icon: '🕳️', spr: 'robe', sp: { guard: 0.12, hpPct: 0.12 },
    desc: '심연의 실로 짠 로브. 날아드는 칼날 몇은 옷자락 속 어둠으로 빠져 사라진다.',
    pal: { B: '#3a1a6b', b: '#0d0818', W: '#7a4fd1', H: '#0d0818', G: '#5ad1ff', J: '#5ad1ff' } },
  watcher_eye:   { slot: 'ring', g: 7, raid: 'abysswatcher', name: '감시자의 눈동자', icon: '👁️', spr: 'signet', sp: { crit: 0.06, critMult: 0.3 },
    desc: '아직 깜빡이는 감시자의 눈동자를 박았다. 상대의 급소가 저절로 눈에 들어온다.',
    pal: { B: '#3a1a6b', b: '#0d0818', W: '#f0e8ff', H: '#0d0818', G: '#7a4fd1', J: '#ff3b8a' } },
  // 🦅 천공의 그리폰 왕
  griffin_lance: { slot: 'weapon', g: 7, raid: 'skygriffin', name: '그리폰 깃 창', icon: '🪶', spr: 'spear', sp: { aspdPct: 0.14, atkPct: 0.1 },
    desc: '그리폰 왕의 첫째 깃을 창대에 감았다. 찌를 때마다 바람이 손을 밀어 준다.',
    pal: { B: '#e8f0ff', b: '#3a6bb8', W: '#ffffff', H: '#8a6a3a', G: '#ffd257', J: '#9fd8ff' } },
  gale_mail:     { slot: 'armor', g: 7, raid: 'skygriffin', name: '폭풍깃 사슬갑옷', icon: '🌬️', spr: 'chain', sp: { hpPct: 0.18, guard: 0.08 },
    desc: '사슬 고리마다 깃털을 엮었다. 가볍기는 깃털 같고 질기기는 사슬 같다.',
    pal: { B: '#c9d8f0', b: '#3a6bb8', W: '#ffffff', H: '#8a6a3a', G: '#ffd257', J: '#9fd8ff' } },
  sky_feather:   { slot: 'ring', g: 7, raid: 'skygriffin', name: '천공의 깃털 팔찌', icon: '🪽', spr: 'band', sp: { aspdPct: 0.1, expPct: 0.25 },
    desc: '그리폰 왕이 떨군 솜털 한 올을 금실로 감았다. 차고 있으면 몸이 반 뼘 뜬다.',
    pal: { B: '#ffd257', b: '#c79a12', W: '#ffffff', H: '#c79a12', G: '#c79a12', J: '#9fd8ff' } },
  // 🪱 모래폭풍 대왕충
  worm_fang_axe: { slot: 'weapon', g: 7, raid: 'sandworm', name: '대왕충 이빨 도끼', icon: '🦷', spr: 'axe', sp: { atkPct: 0.22 },
    desc: '대왕충의 고리 이빨 하나를 통째로 날로 썼다. 바위도 모래처럼 씹힌다.',
    pal: { B: '#f4f1e8', b: '#b8925a', W: '#ffffff', H: '#5a3e1e', G: '#e8b56a', J: '#8a1f1f' } },
  dune_carapace: { slot: 'armor', g: 7, raid: 'sandworm', name: '사구 껍질 갑주', icon: '🏜️', spr: 'plate', sp: { hpPct: 0.22, guard: 0.06 },
    desc: '대왕충이 허물로 벗은 마디를 이어 붙였다. 모래 폭풍 한가운데서도 끄떡없다.',
    pal: { B: '#e8b56a', b: '#c98b4a', W: '#fff1c2', H: '#5a3e1e', G: '#5a3e1e', J: '#8a1f1f' } },
  desert_heart:  { slot: 'ring', g: 7, raid: 'sandworm', name: '사막의 심장석', icon: '🟠', spr: 'gem', sp: { goldPct: 0.3, crit: 0.05 },
    desc: '대왕충 뱃속에서 백 년을 굴러 둥글어진 보석. 삼킨 금화의 기운이 배어 있다.',
    pal: { B: '#c98b4a', b: '#5a3e1e', W: '#fff1c2', H: '#5a3e1e', G: '#5a3e1e', J: '#ff9f1c' } },
  // 🦑 심해의 크라켄
  sea_trident:   { slot: 'weapon', g: 7, raid: 'kraken', name: '해신의 삼지창', icon: '🔱', spr: 'trident', sp: { atkPct: 0.2, aspdPct: 0.08 },
    desc: '가라앉은 신전의 신상이 쥐고 있던 삼지창. 크라켄이 왜 이걸 지켰는지는 아무도 모른다.',
    pal: { B: '#9fe8ff', b: '#2a8ad1', W: '#ffffff', H: '#1f4a6b', G: '#ffe066', J: '#ff6b8a' } },
  coral_plate:   { slot: 'armor', g: 7, raid: 'kraken', name: '심해 산호 갑주', icon: '🪸', spr: 'plate', sp: { guard: 0.13, hpPct: 0.14 },
    desc: '신전 기둥을 덮던 산호를 갑옷으로 길렀다. 금이 가도 바닷물만 끼얹으면 다시 자란다.',
    pal: { B: '#ff6b8a', b: '#b3264a', W: '#ffb3c6', H: '#1f4a6b', G: '#ffe066', J: '#9fe8ff' } },
  ink_pearl:     { slot: 'ring', g: 7, raid: 'kraken', name: '먹물 진주 고리', icon: '🦪', spr: 'ouro', sp: { heal: 0.006, critMult: 0.35 },
    desc: '크라켄의 먹물이 굳어 생긴 검은 진주. 상처에 대면 먹물처럼 번져 메운다.',
    pal: { B: '#1f4a6b', b: '#0d2438', W: '#9fe8ff', H: '#0d2438', G: '#0d2438', J: '#1b1d27' } },
  // 🧚 요정 여왕 티타니아
  titania_bow:   { slot: 'weapon', g: 7, raid: 'fairyqueen', name: '티타니아의 덩굴 활', icon: '🏹', spr: 'bow', sp: { aspdPct: 0.15, crit: 0.05 },
    desc: '살아 있는 덩굴로 만든 활. 시위를 당기면 활대에서 꽃이 핀다.',
    pal: { B: '#3a9a5a', b: '#1f5a33', W: '#c9ffd9', H: '#1f5a33', G: '#ff9ff3', J: '#ffd257' } },
  petal_robe:    { slot: 'armor', g: 7, raid: 'fairyqueen', name: '꽃잎 비단 로브', icon: '🌸', spr: 'robe', sp: { hpPct: 0.2, heal: 0.006 },
    desc: '요정들이 천 송이 꽃잎을 한 장씩 꿰매 지었다. 입고 있으면 상처에서 꽃향기가 난다.',
    pal: { B: '#ffc2f0', b: '#d16bb8', W: '#ffffff', H: '#3a9a5a', G: '#ffd257', J: '#7dffb0' } },
  fairy_wreath:  { slot: 'ring', g: 7, raid: 'fairyqueen', name: '요정 여왕의 화관', icon: '💐', spr: 'crown', sp: { expPct: 0.3, critMult: 0.4 },
    desc: '여왕이 쓰던 꽃 화관. 시들지 않고, 쓴 사람의 머릿속까지 맑게 한다.',
    pal: { B: '#7dffb0', b: '#3a9a5a', W: '#ffffff', H: '#3a9a5a', G: '#ff9ff3', J: '#ff9ff3' } },
  // 🤖 고대 병기 콜로서스
  colossus_blade: { slot: 'weapon', g: 7, raid: 'colossus', name: '콜로서스 동력 대검', icon: '⚙️', spr: 'greatsword', sp: { atkPct: 0.25, critMult: 0.3 },
    desc: '콜로서스의 팔에서 떼어 낸 날. 손잡이를 쥐면 아직도 동력로가 웅웅 돈다.',
    pal: { B: '#c9cdd4', b: '#5a5f6a', W: '#3ee8ff', H: '#2a2a33', G: '#c9a227', J: '#3ee8ff' } },
  alloy_plate:   { slot: 'armor', g: 7, raid: 'colossus', name: '고대 합금 장갑', icon: '🛡️', spr: 'plate', sp: { guard: 0.14, hpPct: 0.16 },
    desc: '지금은 아무도 만들 줄 모르는 합금판. 천 년을 비바람에 맞고도 녹 하나 없다.',
    pal: { B: '#8a8f9a', b: '#3a3a44', W: '#c9cdd4', H: '#2a2a33', G: '#c9a227', J: '#3ee8ff' } },
  power_core:    { slot: 'ring', g: 7, raid: 'colossus', name: '동력핵 반지', icon: '🔋', spr: 'signet', sp: { aspdPct: 0.15, crit: 0.06 },
    desc: '콜로서스의 보조 동력핵을 반지에 박았다. 손끝이 찌릿하며 저절로 빨라진다.',
    pal: { B: '#8a8f9a', b: '#3a3a44', W: '#ffffff', H: '#3a3a44', G: '#c9a227', J: '#3ee8ff' } },
  // 🕷️ 수정 여왕 거미
  crystal_fang:  { slot: 'weapon', g: 7, raid: 'crystalspider', name: '수정 송곳니 검', icon: '💎', spr: 'sword', sp: { atkPct: 0.22, crit: 0.07 },
    desc: '여왕 거미의 송곳니가 그대로 수정이 됐다. 빛을 받으면 칼날이 일곱 빛으로 갈라진다.',
    pal: { B: '#e0d0ff', b: '#c98bff', W: '#ffffff', H: '#3a2a5a', G: '#ff4dff', J: '#9fe8ff' } },
  silk_mail:     { slot: 'armor', g: 7, raid: 'crystalspider', name: '수정 거미줄 갑옷', icon: '🕸️', spr: 'chain', sp: { guard: 0.14, hpPct: 0.18 },
    desc: '수정 가루가 엉긴 거미줄을 겹겹이 짰다. 칼날이 걸리면 빠지지 않는다.',
    pal: { B: '#c9c0e0', b: '#5a2a8a', W: '#ffffff', H: '#1b1530', G: '#ff4dff', J: '#9fe8ff' } },
  prism_heart:   { slot: 'ring', g: 7, raid: 'crystalspider', name: '프리즘 심장', icon: '🔮', spr: 'gem', sp: { critMult: 0.6, goldPct: 0.2 },
    desc: '여왕 거미 등에서 가장 크게 자란 수정. 한 줄기 빛이 들어가면 일곱 줄기로 나온다.',
    pal: { B: '#3a2a5a', b: '#1b1530', W: '#ffffff', H: '#1b1530', G: '#1b1530', J: '#ff9ff3' } },
  // 🌩️ 폭풍의 정령왕
  storm_staff:   { slot: 'weapon', g: 7, raid: 'stormlord', name: '뇌운의 지팡이', icon: '⚡', spr: 'staff', sp: { aspdPct: 0.18, atkPct: 0.15 },
    desc: '끝에 작은 먹구름이 걸려 떠나지 않는다. 휘두를 때마다 구름 속에서 우르릉 소리가 난다.',
    pal: { B: '#ffe066', b: '#5a6b8a', W: '#ffffff', H: '#2a3448', G: '#9fd8ff', J: '#ffe066' } },
  thunder_coat:  { slot: 'armor', g: 7, raid: 'stormlord', name: '번개 깃 외투', icon: '🌪️', spr: 'tunic', sp: { hpPct: 0.25, guard: 0.1 },
    desc: '정령왕의 구름 자락을 꿰매 입었다. 다가오는 칼날에 먼저 벼락이 튄다.',
    pal: { B: '#5a6b8a', b: '#2a3448', W: '#9fd8ff', H: '#ffe066', G: '#ffe066', J: '#ffe066' } },
  thunder_band:  { slot: 'ring', g: 7, raid: 'stormlord', name: '천둥 고리', icon: '🌩️', spr: 'band', sp: { crit: 0.08, critMult: 0.5 },
    desc: '고리 안에서 번개 한 줄기가 쉬지 않고 돈다. 치명타 때마다 그 번개가 따라 나간다.',
    pal: { B: '#5a6b8a', b: '#2a3448', W: '#ffffff', H: '#2a3448', G: '#2a3448', J: '#ffe066' } },
  // 🌠 종언의 성좌신
  astra:         { slot: 'weapon', g: 7, raid: 'starend', name: '종언의 성검 아스트라', icon: '🌟', spr: 'greatsword', sp: { atkPct: 0.3, critMult: 0.5 },
    desc: '별 하나를 통째로 벼린 검. 칼끝이 지나간 자리에 별똥별이 진다.',
    pal: { B: '#ffffff', b: '#c9b8ff', W: '#ffffff', H: '#2a2060', G: '#ffd257', J: '#ffd257' } },
  nebula_plate:  { slot: 'armor', g: 7, raid: 'starend', name: '성운 갑주', icon: '🌌', spr: 'plate', sp: { guard: 0.15, hpPct: 0.2 },
    desc: '갑옷 안쪽에서 작은 성운이 천천히 돈다. 칼날은 그 우주의 끝까지 닿지 못한다.',
    pal: { B: '#2a2060', b: '#0d0a2a', W: '#c9b8ff', H: '#0d0a2a', G: '#ffd257', J: '#ffffff' } },
  last_star:     { slot: 'ring', g: 7, raid: 'starend', name: '마지막 별의 고리', icon: '💫', spr: 'ouro', sp: { aspdPct: 0.15, crit: 0.08, expPct: 0.3 },
    desc: '성좌신이 지키던 마지막 별을 고리에 가뒀다. 끼고 있는 동안 세상은 끝나지 않는다.',
    pal: { B: '#ffd257', b: '#c79a12', W: '#ffffff', H: '#c79a12', G: '#c79a12', J: '#c9b8ff' } },
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
  // 시즌6 장비 옵션 줄 (GEAR_OPTS)
  bossDmg:  { name: '보스 피해', fmt: (v) => `+${pct1(v)}%` },
  skillDmg: { name: '스킬 피해', fmt: (v) => `+${pct1(v)}%` },
  execute:  { name: '처형 (체력 30%↓ 적)', fmt: (v) => `+${pct1(v)}%` },
  firstHit: { name: '첫 타격 피해', fmt: (v) => `+${pct1(v)}%` },
  staSave:  { name: '스태미나 소모', fmt: (v) => `-${pct1(v)}%` },
  lootPct:  { name: '전리품 상자 획득', fmt: (v) => `+${pct1(v)}%` },
  matPct:   { name: '목재·철광석·마력석 획득', fmt: (v) => `+${pct1(v)}%` },
  stonePct: { name: '강화석 획득', fmt: (v) => `+${pct1(v)}%` },
  tomePct:  { name: '비전서 추가 확률', fmt: (v) => `+${pct1(v)}%p` },
  bagCap:   { name: '가방 무게', fmt: (v) => `+${v.toFixed(1)}` },
  sellPct:    { name: '장비 판매 골드', fmt: (v) => `+${pct1(v)}%` },
  lunchPct:   { name: '도시락 회복량', fmt: (v) => `+${pct1(v)}%` },
  potionSave: { name: '물약 아낄 확률', fmt: (v) => `${pct1(v)}%` },
  walkSpd:    { name: '귀환 걸음 속도', fmt: (v) => `+${pct1(v)}%` },
  curioGold:  { name: '옛 금화 골드', fmt: (v) => `+${pct1(v)}%` },
  restPct:    { name: '캠프 휴식 속도', fmt: (v) => `+${pct1(v)}%` },
};
// ───────────────────────── 고유 발동 효과 (시즌6, docs/specs/unique-procs.md) ─────────────────────────
// 이름 있는 장비(ITEM_PROCS, GEAR_ITEMS 키)와 레이드 3세트(SET_PROCS, RAID_BOSSES 키)가 전투 행동을 바꾼다. 필드 동작은 src/procs.js.
//  type: PROC_TYPES 키 · name: 효과 이름 · say: 발동 말풍선 · color: 연출 색
//  ev: 서버 전투(레이드·결투)·자동 장착용 한 마리 기준 평균 피해 증가 · hv: 같은 기준 생존력(체력) 증가 — 상황형이라 대략값
//  한 장비가 효과 둘을 가지면 배열
const PROC_TYPES = {
  burn:     { text: (p) => `타격마다 ${p.poison ? '독' : '화상'} 1중첩 (최대 ${p.max}), 중첩당 초당 공격력 ×${pct1(p.v)}%` },
  chain:    { text: (p) => `치명타 때 근처 적 ${p.n}마리에 ${p.fire ? '화염 폭발' : '번개'} ×${pct1(p.mult)}%` },
  nova:     { text: (p) => `적을 쓰러뜨리면 ${p.mult ? `주변 폭발 ×${pct1(p.mult)}%` : ''}${p.mult && p.heal ? ' · ' : ''}${p.heal ? `체력 ${pct1(p.heal)}% 회복` : ''}` },
  meteor:   { text: (p) => `${p.every}초마다 ${p.n > 1 ? `${p.n}발 ` : ''}${p.beam ? '포격' : p.star ? '별똥별' : '불기둥'} ×${pct1(p.mult)}%` },
  throw:    { text: (p) => `${p.every}타마다 무기 투척 — 관통 ×${pct1(p.mult)}%${p.back ? `, 돌아오며 ×${pct1(p.back)}%` : ''}` },
  reap:     { text: (p) => `체력 ${pct1(p.thr)}% 이하 일반 적 즉사 · 체력 30% 이하 보스 피해 +${pct1(p.boss)}%` },
  stack:    { text: (p) => `처치마다 공격 속도 +${pct1(p.v)}% (최대 ${p.max}중첩, ${p.dur}초 동안 처치 없으면 사라짐)` },
  rebirth:  { text: (p) => `원정마다 한 번, 쓰러질 때 체력 ${pct1(p.heal)}%로 되살아남` },
  aegis:    { text: (p) => `체력이 50% 아래로 떨어지면 최대 체력 ${pct1(p.v)}% 보호막 (${p.cd}초마다)` },
  thorns:   { text: (p) => `받은 피해의 ${pct1(p.v)}%를 되돌려 줌` },
  dodge:    { text: (p) => `${pct1(p.v)}% 확률로 피해를 흘려보냄` },
  fortune:  { text: (p) => (p.every ? `${p.every}번째 처치마다 골드 ×${p.x}` : `처치마다 ${pct1(p.chance)}% 확률로 골드 ×${p.x}`) },
  cdreset:  { text: (p) => `스킬을 쓸 때 ${pct1(p.v)}% 확률로 쿨타임 즉시 초기화 (파이터 계열은 기 게이지 50% 충전)` },
  eclipse:  { text: (p) => `${p.every}초마다 ${p.dur}초간 일식 — 치명 확률 +${pct1(p.crit)}%p` },
  firsthit: { text: (p) => `적마다 첫 타격 확정 치명 · 치명 피해 +${pct1(p.critMult)}%` },
  summon:   { text: (p) => `적을 쓰러뜨리면 해골 병사가 ${p.dur}초 동안 함께 싸움 (공격력 ×${pct1(p.mult)}%)` },
  freeze:   { text: (p) => `타격 시 ${pct1(p.chance)}% 확률로 ${p.dur}초 빙결` },
  gaze:     { text: (p) => `체력 ${pct1(p.thr)}% 이하 적이 받는 피해 +${pct1(p.v)}%` },
  quake:    { text: (p) => `${p.every}번째 처치마다 개미지옥 — 주변 적 ×${pct1(p.mult)}%` },
};
const ITEM_PROCS = {
  solaris:        { type: 'burn', v: 0.08, max: 5, dur: 3, color: '#ffb13b', name: '태양의 낙인', say: '솔라리스!', ev: 0.1 },
  abyss_trident:  { type: 'chain', n: 2, mult: 0.5, color: '#5ad1ff', name: '갈라지는 파도', say: '심연의 파도!', ev: 0.06 },
  yggdrasil:      { type: 'nova', mult: 0.4, heal: 0.03, radius: 50, color: '#7dffb0', name: '새싹 돋음', say: '이그드라실!', ev: 0.05, hv: 0.05 },
  ragnarok:       { type: 'meteor', every: 8, n: 1, mult: 2.5, color: '#ff7a1f', name: '종말의 불기둥', say: '라그나로크!', ev: 0.16 },
  gungnir:        { type: 'throw', every: 5, mult: 1.5, back: 0.75, color: '#ffe066', name: '반드시 돌아오는 창', say: '궁니르!', ev: 0.18 },
  void_scythe:    { type: 'reap', thr: 0.12, boss: 0.3, color: '#9a5cff', name: '공허의 수확', say: '공허의 낫!', ev: 0.2 },
  astral_staff:   { type: 'meteor', every: 6, n: 3, mult: 1.5, star: true, color: '#c9b8ff', name: '성좌 낙하', say: '성좌의 홀!', ev: 0.22 },
  genesis: [
    { type: 'throw', every: 4, mult: 2, back: 0, color: '#ffffff', name: '창세의 빛', say: '제네시스!', ev: 0.24 },
    { type: 'nova', mult: 0.6, radius: 60, color: '#fff3b0', name: '창세의 여파', say: '', ev: 0.06 },
  ],
  phoenix:        { type: 'rebirth', heal: 0.5, color: '#ff9f1c', name: '불사조의 날개', say: '불사조!', hv: 0.15 },
  celestial:      { type: 'aegis', v: 0.15, cd: 30, color: '#9fd8ff', name: '천공의 가호', say: '천공의 가호!', hv: 0.12 },
  titan_plate:    { type: 'thorns', v: 0.25, color: '#c9a26a', name: '거신의 반격', say: '거신!', ev: 0.04, hv: 0.08 },
  valkyrie:       { type: 'stack', v: 0.03, max: 8, dur: 6, color: '#e8f0ff', name: '영혼 거두기', say: '발키리!', ev: 0.15 },
  starlight_robe: { type: 'dodge', v: 0.08, color: '#c9b8ff', name: '은하수 장막', say: '흘려보냄!', hv: 0.09 },
  primordial: [
    { type: 'rebirth', heal: 0.5, color: '#f4f0ff', name: '태초의 숨결', say: '태초!', hv: 0.15 },
    { type: 'aegis', v: 0.2, cd: 30, color: '#f4f0ff', name: '태초의 수호', say: '태초의 수호!', hv: 0.15 },
  ],
  kings_seal:     { type: 'fortune', chance: 0.03, x: 5, color: '#ffd257', name: '왕의 하사금', say: '왕의 인장!' },
  ouroboros:      { type: 'cdreset', v: 0.12, color: '#7dffd0', name: '꼬리를 무는 뱀', say: '우로보로스!', ev: 0.08 },
  draupnir:       { type: 'fortune', every: 9, x: 8, color: '#ffd257', name: '아홉째 밤의 팔찌', say: '드라우프니르!' },
  dragon_heart:   { type: 'chain', n: 3, mult: 0.8, fire: true, color: '#ff6b3d', name: '용의 숨결', say: '용심장!', ev: 0.1 },
  eclipse_ring:   { type: 'eclipse', every: 20, dur: 5, crit: 0.25, color: '#ffcf6b', name: '일식', say: '일식!', ev: 0.12 },
  origin_ring:    { type: 'firsthit', critMult: 1, color: '#ffffff', name: '근원의 일격', say: '근원!', ev: 0.15 },
};
// 레이드 3세트 효과에 얹는 발동 (수치 세트 효과는 RAID_BOSSES[보스].set 그대로). 슬라임 킹·고블린 족장은 영웅급이라 없음
const SET_PROCS = {
  lichking:      { type: 'summon', dur: 3, mult: 0.3, color: '#e9e4d4', name: '망자 소환', say: '일어나라!', ev: 0.06 },
  boglord:       { type: 'burn', v: 0.05, max: 5, dur: 3, poison: true, color: '#9fdb5a', name: '독안개', say: '', ev: 0.06 },
  flamedragon:   { type: 'meteor', every: 10, n: 1, mult: 2, color: '#ff7a1f', name: '화염 숨결', say: '화염룡의 분노!', ev: 0.1 },
  frostgiant:    { type: 'freeze', chance: 0.1, dur: 1, color: '#9fe8ff', name: '만년설 빙결', say: '', hv: 0.06 },
  demonking:     { type: 'nova', mult: 0.8, radius: 60, color: '#c06bff', name: '흑염 폭발', say: '', ev: 0.06 },
  abysswatcher:  { type: 'gaze', thr: 0.3, v: 0.25, color: '#9a5cff', name: '심연의 응시', say: '', ev: 0.08 },
  skygriffin:    { type: 'stack', v: 0.04, max: 6, dur: 6, color: '#9fd8ff', name: '천공 질주', say: '천공의 패자!', ev: 0.12 },
  sandworm:      { type: 'quake', every: 5, mult: 2, radius: 120, color: '#e8b56a', name: '개미지옥', say: '개미지옥!', ev: 0.08 },
  kraken:        { type: 'thorns', v: 0.2, color: '#2a8ad1', name: '먹물 반격', say: '', ev: 0.03, hv: 0.06 },
  fairyqueen:    { type: 'nova', mult: 0, heal: 0.04, radius: 0, color: '#ff9ff3', name: '꽃잎 회복', say: '', hv: 0.08 },
  colossus:      { type: 'meteor', every: 12, n: 1, mult: 3, beam: true, color: '#ff4d4d', name: '궤도 포격', say: '궤도 포격!', ev: 0.1 },
  crystalspider: { type: 'chain', n: 2, mult: 0.7, color: '#ff9ff3', name: '프리즘 굴절', say: '', ev: 0.07 },
  stormlord:     { type: 'chain', n: 3, mult: 0.6, color: '#ffe066', name: '만뢰', say: '만뢰!', ev: 0.09 },
  starend: [
    { type: 'meteor', every: 8, n: 5, mult: 1.5, star: true, color: '#ffd257', name: '별의 종언', say: '별의 종언!', ev: 0.2 },
    { type: 'rebirth', heal: 0.5, color: '#c9b8ff', name: '마지막 별', say: '마지막 별!', hv: 0.15 },
  ],
};
const procList = (x) => (!x ? [] : Array.isArray(x) ? x : [x]);
const procText = (p) => PROC_TYPES[p.type].text(p);

// 0.072 → '7.2', 0.07 → '7' (옵션 줄 표시용)
function pct1(v) { const x = Math.round(v * 1000) / 10; return Number.isInteger(x) ? String(x) : x.toFixed(1); }
// 공속은 무기에서(등급별 고정 %), 치명 확률은 장신구에서(등급별 고정) 얻는다. 둘 다 스테이지와 상관없고 강화로는 조금만 오른다 (SOFT_ENH)
const WEAPON_ASPD = [0, 0.05, 0.1, 0.18, 0.28, 0.4, 0.55, 0.75];
// 무기 공격력·갑옷 체력은 절대값이다. 기본 위력은 착용한 기사의 레벨을 따라 커지고(gearAtkAt·gearHpAt),
//  (등급 stat × 편차)^GEAR_K · 강화 배율^GEAR_K 가 곱해진다. 레벨은 경험치로만 오르고(골드·건물로 못 산다) 내 모든 장비가 같은 레벨을 쓰므로,
//  같은 부위 장비끼리는 등급이 곧 서열이다 (편차도 같이 압축해서 ±10% 로는 한 등급을 못 넘는다).
// 성장 압축 (0.21.0, docs/specs/growth-compression.md): 몬스터가 스테이지마다 ×1.06·×1.04 로 완만해진 만큼
//  레벨 성장·등급·강화 배율도 같은 비율로 줄였다 — 각 행위가 '몇 스테이지어치' 인지는 그대로, 보이는 숫자만 작다.
//  체감(전투력 성장 몫) 훈련 : 장비 ≈ 4 : 6 (dev/growth-share.js)
const GEAR_ATK_GROW = 1.034, GEAR_HP_GROW = 1.0246, GEAR_K = 0.2;
const GEAR_ATK_BASE = 0.5, GEAR_HP_BASE = 1.15;
const gearAtkAt = (lv) => GEAR_ATK_BASE * Math.pow(GEAR_ATK_GROW, lv - 1);
const gearHpAt = (lv) => GEAR_HP_BASE * Math.pow(GEAR_HP_GROW, lv - 1);
function gearBase(slot, g, roll, s) {
  const k = GRADES[g].stat * roll;
  if (slot === 'weapon') return { atk: gearAtkAt(s) * Math.pow(k, GEAR_K), aspdPct: WEAPON_ASPD[g] * roll };
  if (slot === 'armor') return { hp: gearHpAt(s) * Math.pow(k, GEAR_K) };
  // 장신구(치명)는 레벨 성장이 없는 상한형이라 압축하지 않는다
  return { crit: 0.02 * k, critMult: 0.2 * k };
}
// 강화가 공속·치명에는 단계당 4%만 곱해진다 (+25 에서 2배, +30 에서 2.2배)
const SOFT_ENH = { aspdPct: true, crit: true };
const softEnhMultAt = (L) => 1 + 0.04 * L;

// ───────────────────────── 강화 ─────────────────────────
// 강화 단계는 부위(무기·갑옷·반지)에 붙어 있어서 장비를 바꿔 껴도 유지된다.
// ENHANCE[L] = L → L+1 시도. 실패하면 down 확률로 한 단계 하락, reset 확률로 +0 초기화, 나머지는 유지.
// 0에서 시작한 기대 시도 횟수 (보호 주문서 없이): +10 약 15회 · +15 약 35회 · +20 약 91회 · +25 약 540회
// +26~30 은 주문서 구간이다: 실패하면 하락이 성공보다 커서 맨손으로는 +25→+30 기대 약 3.6만 회, 주문서를 쓰면 약 39회 (docs/specs/enhance-30.md)
const ENHANCE_MAX = 30;
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
  // +16 ~ +20: 하락 + 초기화 위험 (초기화는 0.21 에서 절반으로)
  { rate: 0.33, down: 0.25, reset: 0.01 },
  { rate: 0.31, down: 0.25, reset: 0.0125 },
  { rate: 0.29, down: 0.25, reset: 0.015 },
  { rate: 0.27, down: 0.25, reset: 0.0175 },
  { rate: 0.25, down: 0.25, reset: 0.02 },
  // +21 ~ +25: 초기화 위험 (0.21 에서 절반으로)
  { rate: 0.24, down: 0.25, reset: 0.025 },
  { rate: 0.22, down: 0.25, reset: 0.0275 },
  { rate: 0.20, down: 0.25, reset: 0.03 },
  { rate: 0.18, down: 0.25, reset: 0.0325 },
  { rate: 0.16, down: 0.25, reset: 0.035 },
  // +26 ~ +30: 성공률이 낮고 실패하면 자주 하락 — 보호 주문서를 모아 도전하는 구간
  { rate: 0.15, down: 0.3, reset: 0.04 },
  { rate: 0.14, down: 0.3, reset: 0.04 },
  { rate: 0.13, down: 0.3, reset: 0.04 },
  { rate: 0.12, down: 0.3, reset: 0.04 },
  { rate: 0.11, down: 0.3, reset: 0.04 },
];
// L → L+1 시도의 실제 확률 (담금질대 Lv 반영)
function enhanceOddsAt(L, temperLv) {
  const e = ENHANCE[L];
  if (!e || !temperLv || L >= TEMPER_CAP) return e;
  return { rate: Math.min(0.95, e.rate + TEMPER_RATE * temperLv), down: e.down * (1 - TEMPER_DOWN * temperLv), reset: e.reset };
}
// 강화 단계가 장비 능력치에 곱하는 배율
//  +0~+25: 압축 전 1 + 0.12L + 0.004L² 에 GEAR_K 지수 (+10 ×1.21 · +15 ×1.30 · +20 ×1.38 · +25 ×1.454)
//  +26~+30 (0.22.1): +25 값에 단계마다 ×ENH_HI_STEP — 압축식 그대로면 +25→+30 이 +4.7% 뿐이라 (스테이지 1칸 ≈ ×1.06 보다 작음),
//   +30 ×1.891 = +25 의 1.30 배 (스테이지 약 4.5칸어치). +0~+25 는 그대로
const ENH_HI_FROM = 25, ENH_HI_STEP = 1.054;
const enhanceMultBase = (L) => Math.pow(1 + 0.12 * L + 0.004 * L * L, GEAR_K);
const enhanceMultAt = (L) => (L <= ENH_HI_FROM ? enhanceMultBase(L) : enhanceMultBase(ENH_HI_FROM) * Math.pow(ENH_HI_STEP, L - ENH_HI_FROM));
// L → L+1 비용. 💠 강화석은 강화에만 쓰는 재화라 훈련(골드)·건물과 겹치지 않는다. 💎 마력석은 +10부터 — 마력석의 주 소모처 (전직 말고는 강화 전용)
// 0.23.2 (docs/specs/currency-roles.md): 강화석 ×1.5 (2 → 3·1.17^L, 수입의 44% 만 쓰여서), 마력석 ×3 (2 → 6·1.22^(L−10), 건물·시설·레이드 입장권에서 마력석을 빼고 여기로 모음)
// 강화석 기대 소모 (0에서, 보호 주문서 없이): +5 약 21개 · +10 약 110개 · +15 약 480개 (부위마다). +25→+30 을 주문서로 가면 약 8,500개
// 철광석은 0.22.3 에서 뺐다 — 건물과 나눠 쓰는데 강화 쪽이 ×1.2 로 불어 +25→+30 한 부위에 약 1.1만(건물 한 레벨어치)이 들어,
//  강화석보다 철광석이 먼저 떨어졌다. 강화를 묶는 건 💠 강화석 하나 (docs/specs/enhance-30.md "철광석 제외")
function enhanceCost(L) {
  return {
    stone: Math.floor(3 * Math.pow(1.17, L)),
    mana: L >= 10 ? Math.floor(6 * Math.pow(1.22, L - 10)) : 0,
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
// 공격력·체력 훈련은 배율이다 (0.21.0 성장 압축): 최종 공격력 × TRAIN_ATK_GROW^Lv · 체력 × TRAIN_HP_GROW^Lv.
//  장비(레벨·등급·강화)와 함께 몬스터 성장을 따라가는 두 축 — 체감(전투력 성장 몫) 훈련 : 장비 ≈ 4 : 6 (dev/growth-share.js).
//  훈련장을 올려도 무기·갑옷은 세지지 않는다 (골드·건물로 장비 힘을 사지 못하게)
const TRAIN_ATK_GROW = 1.0185, TRAIN_HP_GROW = 1.0303;
const trainAtkMultAt = (t) => Math.pow(TRAIN_ATK_GROW, t);
const trainHpMultAt = (t) => Math.pow(TRAIN_HP_GROW, t);
// 맨몸 능력치 (장비 없이 훈련 0)
const BASE_ATK = 6, BASE_HP = 40;
const TRAINING = [
  { id: 'atk',  name: '⚔️ 공격력', max: TRAIN_MAX, base: 10, grow: 1.32, show: (st) => fmt(st.atk) },
  { id: 'hp',   name: '🛡️ 체력',   max: TRAIN_MAX, base: 10, grow: 1.32, show: (st) => fmt(st.maxHp) },
  { id: 'def',  name: '🛡️ 방어',   max: TRAIN_MAX, base: 15, grow: 1.3,  show: (st) => `-${Math.round(st.defRed * 100)}%` },
  { id: 'fortune', name: '💰 수완', max: TRAIN_MAX, base: 15, grow: 1.3, show: () => `+${Math.round(fortuneBonus() * 100)}%` },
];
// 방어: 받는 피해 감소 = DEF_MAX × 단계 / (단계 + DEF_HALF). 스테이지와 상관없고 올릴수록 효율이 떨어져 DEF_MAX(50%)에는 닿지 않는다
//  (Lv 6 14% · Lv 26 32% · Lv 57 40% · Lv 100 43%)
const DEF_MAX = 0.5, DEF_HALF = 15;
const defRedAt = (t) => DEF_MAX * t / (t + DEF_HALF);
// 수완: 골드·경험치 획득 Lv 당 +3% (몬스터 처치와 레이드 보상에 적용)
const FORTUNE_PER_LV = 0.03;
// ───────────────────────── 🎓 교관 수련 (src/mentor.js, docs/specs/training-mentors.md) ─────────────────────────
// 최고 스테이지 MENTOR_OPEN_STAGE 에서 열리고, 교관 다섯 명을 차례로 찾아가 별 5개씩 받는다 (고르는 게 아니라 결국 전부 올리는 구조).
//  ★1~4: 📕 수련의 서(S.books — 🏰 성벽 지키기에서 얻는다) MENTOR_TRY_BOOKS[교관][별−1] 권을 내고 MENTOR_ODDS% 로 별 하나 (실패 MENTOR_PITY 번 뒤 확정). 골드는 받지 않는다
//  ★5: 교관과의 승부 — 도전비 없음, 하루 MENTOR_DUEL_DAY 번 (서버가 센다, server/index.js)
//  sp: 별 하나 몫 (gearBonus 에 더하는 키) · ★5 는 별 하나 몫의 2배 · 경험치 보너스는 없다 (1차 훈련이 Lv 200 이라 수완이 그대로라서)
//  별 하나 몫은 0.20.0 판의 ×0.6 (10-14 사용자 결정 — 별 25개를 다 받은 14일 봇이 교관 끔보다 +8% 앞서서)
//  승부 상대는 내 레벨·내 계열의 '기준 기사' 거울 × 교관 배수 (server/mentor.js) — 직업 상성 없이 '얼마나 골고루 갖췄나'만 본다
//  bg: 무대 배경 (src/bg/<bg>.png, 'dojo' 는 mentor-stage.js 가 직접 그린다)
const MENTORS = [
  { id: 'sword',  name: '검술 사범',   icon: '🗡️', place: '도장',       bg: 'dojo',    sp: { atkPct: 0.015 } },
  { id: 'shield', name: '방패 교관',   icon: '🛡️', place: '성채 연병장', bg: 'castle',  sp: { hpPct: 0.015, guard: 0.006 } },
  { id: 'hunter', name: '숲의 사냥꾼', icon: '🏹', place: '깊은 숲',     bg: 'fairy',   sp: { aspdPct: 0.009, crit: 0.006 } },
  { id: 'brute',  name: '화산 투사',   icon: '🔥', place: '화산 분화구', bg: 'volcano', sp: { critMult: 0.03, bossDmg: 0.018 } },
  { id: 'sage',   name: '성좌의 은자', icon: '🌌', place: '구름 위',     bg: 'sky',     sp: { skillDmg: 0.018 } },
];
const MENTOR_STARS = 5;
const MENTOR_LAST_X = 2;                       // ★5 는 별 하나 몫 × 2
const MENTOR_OPEN_STAGE = 40;                  // 첫 교관이 열리는 최고 스테이지 (🏰 성벽 지키기 해금과 같은 값)
// ★1~4 확률 수련 (0.24.0, 10-16 사용자 결정 — 확정 상승은 성공률 100% 라 누르는 맛이 없었다)
//  한 번 시도 = 📕 MENTOR_TRY_BOOKS 권, 성공 확률 MENTOR_ODDS % (화면에 그대로 보인다 — 숨은 보정 없음), 같은 별에서 MENTOR_PITY 번 실패하면 다음은 확정.
//  기대 📕 합 107권 (교관별 7.1/16.1/22.1/28.8/33.1) ≈ 0.22 확정 표 110권 — 페이스(★1~4 무료 입장 약 10일) 유지. 10만 번 시뮬 중앙 107 · 상위 10% 124권
const MENTOR_ODDS = [[70, 60, 50, 40], [60, 50, 40, 35], [55, 45, 35, 30], [50, 40, 30, 25], [45, 35, 25, 20]];
const MENTOR_TRY_BOOKS = [[1, 1, 1, 1], [2, 2, 2, 2], [2, 2, 3, 3], [2, 3, 3, 4], [3, 3, 3, 4]];
const MENTOR_PITY = 3;
const MENTOR_DUEL_DAY = 3;                     // ★5 승부 하루 횟수 (한국 시간 자정 초기화)
// 0.22.1: 첫 교관(검술 사범) ★5 승부는 최고 스테이지 이만큼부터 (server/index.js 와 같게). 진행 봇 기준 스테이지 70 ≈ 7시간 → 첫 ★5 약 8시간
const MENTOR_FIRST_DUEL_STAGE = 70;
// 예전 훈련(공속·치명)은 없어졌다. 예전 세이브에 남은 단계는 쓴 골드를 돌려준다 (core.js migrate)
const OLD_TRAINING = { spd: { base: 25, grow: 1.55 }, crit: { base: 30, grow: 1.6 } };

// ───────────────────────── 몬스터 ─────────────────────────
// 잡몹 체력 배율: 한 방에 녹지 않고 두세 대는 맞고 쓰러지게 (보스 체력은 그대로)
const MOB_HP_MULT = 3;
// 스테이지마다 몬스터 체력·공격력 배율 (server/raid.js·worldboss.js 의 MOB_*_GROW 와 같아야 함)
//  0.21.0 성장 압축(docs/specs/growth-compression.md): 1.221 · 1.165 → 1.06 · 1.04. 20스테이지(레이드 보스 간격) 난이도 차가 약 500~1,100배 → 약 7배.
//  장비·훈련 배율도 같은 비율로 줄였다 (gearAtkAt·GEAR_K·trainAtkMultAt)
const MOB_HP_GROW = 1.06, MOB_ATK_GROW = 1.04;
// 스테이지 MOB_LATE_FROM 부터는 더 완만하게 (0.20.12, 압축 전 1.19·1.145 와 같은 비율): 100 이후 레벨·장비가 몬스터를 점점 못 따라가 120~200 이 지나치게 늘어졌다.
//  server/raid.js 의 mobHpScale·mobAtkScale 과 같아야 함
const MOB_LATE_FROM = 100, MOB_LATE_HP_GROW = 1.048, MOB_LATE_ATK_GROW = 1.032;
// 초반 완화 (0.21.0): 스테이지 1 ~ MOB_EARLY_TO 사이는 몬스터를 조금 덜 세게 (1 − A × sin) — 스테이지 1 과 MOB_EARLY_TO 는 그대로.
//  압축 전엔 훈련 맨몸 고정값이 초반에 크게 올라 첫 시간에 20스테이지쯤 갔다. 같은 체감이 나게 가운데(스테이지 20 쯤)를 가장 많이 덜어 준다
const MOB_EARLY_TO = 40, MOB_EARLY_HP = 0.7, MOB_EARLY_ATK = 0.75;
const mobEarly = (s, a) => (s >= MOB_EARLY_TO ? 1 : 1 - a * Math.sin(Math.PI * (Math.max(1, s) - 1) / (MOB_EARLY_TO - 1)));
const mobHpScale = (s) => Math.pow(MOB_HP_GROW, Math.min(s, MOB_LATE_FROM) - 1) * Math.pow(MOB_LATE_HP_GROW, Math.max(0, s - MOB_LATE_FROM)) * mobEarly(s, MOB_EARLY_HP);
const mobAtkScale = (s) => Math.pow(MOB_ATK_GROW, Math.min(s, MOB_LATE_FROM) - 1) * Math.pow(MOB_LATE_ATK_GROW, Math.max(0, s - MOB_LATE_FROM)) * mobEarly(s, MOB_EARLY_ATK);
// 필드 보스 벽 (0.21.0 성장 압축 전엔 ×4 · ×1.6 ≈ 5스테이지어치 — 압축 뒤 진행 봇 도달 시간이 예전과 같아지는 값으로)
const FIELD_HP = 2, FIELD_ATK = 1.4;
function monsterStats(stage, boss) {
  const hp = 14 * mobHpScale(stage);
  const atk = 3 * mobAtkScale(stage);
  const gold = 2 * Math.pow(1.2, stage - 1);
  const exp = 4 * Math.pow(1.16, stage - 1);
  // 필드 마지막 스테이지의 보스(필드 보스)는 필드마다 넘어야 하는 벽이다: 체력 ×FIELD_HP · 공격력 ×FIELD_ATK
  //  (성장이 그만큼 쌓여야 다음 필드로 간다). 보상은 1.5배
  const field = boss && stage === zoneOf(stage).to;
  const f = field ? 1.5 : 1;
  return boss
    ? { hp: hp * 5 * (field ? FIELD_HP : 1), atk: atk * 1.4 * (field ? FIELD_ATK : 1), gold: gold * 10 * f, exp: exp * 6 * f, boss: true }
    : { hp: hp * MOB_HP_MULT, atk, gold, exp, boss: false };
}
// 레이드·월드 보스·결투 시즌 보상의 보스 눈금 (골드·경험치). 필드 보스 ×1.5 는 원정의 벽에만 쓴다 —
//  여기서 쓰면 스테이지가 20의 배수일 때만 튀어서, 더 센 보스(입장+2)를 잡거나 최고 스테이지가 오르면 오히려 덜 받았다.
//  f: 고정 배율 (레이드는 1.5 — 사람 3~4인 파티가 받던 값을 모든 구성에 그대로)
const bossLoot = (stage, f = 1) => { const m = monsterStats(stage, false); return { gold: m.gold * 10 * f, exp: m.exp * 6 * f }; };

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
// K·M·B·T 다음은 aa, ab, … az, ba, … (레이드 후반 보스 체력이 1e57 을 넘어서 ah(1e39) 에서 끝나면 숫자가 길게 찍혔다)
const FMT_UNITS = ['K', 'M', 'B', 'T'].concat(Array.from({ length: 26 * 26 }, (_, i) => String.fromCharCode(97 + Math.floor(i / 26), 97 + (i % 26))));
function fmt(n) {
  if (n < 0) return '-' + fmt(-n);                 // 운영 차감으로 재화가 음수일 수 있다
  if (n < 1000) return String(Math.floor(n));
  let i = -1;
  while (n >= 1000 && i < FMT_UNITS.length - 1) { n /= 1000; i++; }
  return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)) + FMT_UNITS[i];
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
//   전설 이상 장비는 여기서만 나온다. 시즌6 희소성 개편: 보스를 따라 한 칸씩 오르되 그 보스의 최고 등급은 '가끔 터지는 대박'.
//   슬라임 킹 희귀·영웅(전설 3%) → 리치 킹 영웅 위주(신화 2%) → 마왕 전설 위주(태초 0.2%) → 종언의 성좌신 신화 50 · 초월 38 · 태초 12.
//   고유 장비는 처치 상자당 sig 6~18% (뒤 보스일수록 낮음, docs/specs/raid-sig-drop.md). 첫 처치 확정 보장은 없다
//  set: 그 보스 고유 장비 3부위(무기·갑옷·장신구) 세트. 같은 보스 것을 2부위·3부위 끼면 효과가 붙는다 (SPECIAL_STATS 키)
const RAID_BOSSES = {
  slimeking: { name: '슬라임 킹', icon: '👑', stage: 10, spr: 'rb_slimeking', hit: 'leap', aoe: 'quake', fx: ['#4aa3ff', '#bfe3ff'], skill: '왕의 점프',
    pal: { y: '#ffd257', R: '#ff3b4b', B: '#3dffa8', g: '#1f4f9a', G: '#4aa3ff', L: '#d8f0ff', W: '#ffffff', K: '#0d1630', m: '#ff6b8a' },
    set: { name: '슬라임 왕가', 2: { hpPct: 0.08 }, 3: { atkPct: 0.08, aspdPct: 0.05 } },
    desc: '초원의 슬라임들이 모이고 모여 왕이 되었다. 뛰어오를 때마다 땅이 흔들린다.',
    chest: { name: '슬라임 킹의 보물상자', n: [3, 3], w: [0, 0, 60, 37, 3, 0, 0, 0], sig: 0.18, spr: 'chest',
      pal: { B: '#2a5fa8', b: '#173a6b', W: '#4aa3ff', H: '#ffd257', G: '#ffd257', J: '#bfe3ff' } } },
  goblinchief: { name: '고블린 족장', icon: '👺', stage: 20, spr: 'rb_goblinchief', hit: 'axe', aoe: 'whirl', fx: ['#c9a227', '#e8d9a8'], skill: '약탈의 회오리',
    pal: { f: '#e0443c', o: '#ff9f1c', y: '#ffd257', I: '#c9d1dd', h: '#7a4a22', g: '#4a6b1f', G: '#8fae3c', Y: '#ffd257', K: '#1b1d27', W: '#f4f1e8', b: '#4a2a14', B: '#7a2a2a' },
    set: { name: '약탈자의 긍지', 2: { atkPct: 0.1 }, 3: { crit: 0.04, goldPct: 0.2 } },
    desc: '초원의 고블린 부족을 하나로 묶은 족장. 빼앗은 보물이 동굴 천장까지 쌓여 있다.',
    chest: { name: '족장의 약탈품 궤짝', n: [3, 3], w: [0, 0, 40, 52, 8, 0.3, 0, 0], sig: 0.15, spr: 'chest',
      pal: { B: '#6b4420', b: '#3a2410', W: '#8fae3c', H: '#ffd257', G: '#ffd257', J: '#e0443c' } } },
  lichking: { name: '리치 킹', icon: '💀', stage: 40, spr: 'rb_lichking', hit: 'skull', aoe: 'deathwave', fx: ['#7dffb0', '#b38bff'], skill: '죽음의 파동',
    pal: { y: '#ffd257', R: '#ff4d6d', O: '#7dffb0', o: '#e8fff0', p: '#1b1030', k: '#0d0818', W: '#e9e4d4', K: '#0d0818', P: '#3a2463', G: '#7dffb0', s: '#5e3818' },
    set: { name: '불사의 군주', 2: { hpPct: 0.12 }, 3: { guard: 0.06, heal: 0.01 } },
    desc: '묘지의 모든 망자를 거느린 왕. 쓰러뜨려도 성물함이 남아 있는 한 다시 일어난다.',
    chest: { name: '리치 킹의 관', n: [3, 4], w: [0, 0, 20, 60, 18, 2, 0, 0], sig: 0.15, spr: 'jewelbox',
      pal: { B: '#2a1a4a', b: '#150d26', W: '#4a2a6b', H: '#7dffb0', G: '#7dffb0', J: '#ff4d6d' } } },
  boglord: { name: '늪의 군주', icon: '🐊', stage: 60, spr: 'rb_boglord', hit: 'bite', aoe: 'fog', fx: ['#8a6fb8', '#c9b3ff'], skill: '독안개 포효',
    pal: { r: '#6b8f3a', y: '#c9b3ff', c: '#2f4f2a', C: '#4a6b3a', Y: '#d9b3ff', K: '#1b1d27', W: '#f4f1e8', l: '#8a9a5a', t: '#2f4f2a' },
    set: { name: '늪의 지배자', 2: { aspdPct: 0.08 }, 3: { hpPct: 0.15, expPct: 0.15 } },
    desc: '독안개 늪 한가운데 웅크린 거대한 악어. 숨을 내쉴 때마다 늪 전체가 보랏빛으로 물든다.',
    chest: { name: '늪 군주의 이끼 궤', n: [3, 4], w: [0, 0, 8, 60, 28, 4, 0, 0], sig: 0.12, spr: 'chest',
      pal: { B: '#3a5a2a', b: '#1f3315', W: '#8fd8a8', H: '#8a6fb8', G: '#c9b3ff', J: '#ffd257' } } },
  flamedragon: { name: '화염룡', icon: '🐉', stage: 80, spr: 'rb_flamedragon', hit: 'fireball', aoe: 'breath', fx: ['#ff7a1f', '#ffe066'], skill: '화염 숨결',
    pal: { w: '#7a1414', W: '#ff7a1f', h: '#2a1d1d', d: '#b8321f', Y: '#ffe066', K: '#1b0d0a', b: '#ffb13b', t: '#8a1414' },
    set: { name: '화염룡의 분노', 2: { atkPct: 0.15 }, 3: { crit: 0.05, critMult: 0.5 } },
    desc: '화산 동굴 가장 깊은 곳에서 잠든 고룡. 깨어나는 순간 동굴 전체가 용광로가 된다.',
    chest: { name: '화염룡의 보물궤', n: [4, 4], w: [0, 0, 0, 55, 38, 6.5, 0.5, 0], sig: 0.12, spr: 'chest',
      pal: { B: '#b3263e', b: '#6e1424', W: '#ff6b81', H: '#ffd257', G: '#ffd257', J: '#ff9f1c' } } },
  frostgiant: { name: '서리 거인', icon: '🧊', stage: 100, spr: 'rb_frostgiant', hit: 'boulder', aoe: 'icicles', fx: ['#9fe8ff', '#ffffff'], skill: '빙하 내려찍기',
    pal: { I: '#9fe8ff', w: '#e8f6ff', b: '#6a8cc8', E: '#5ad1ff', W: '#ffffff' },
    set: { name: '만년설 거인', 2: { hpPct: 0.2 }, 3: { atkPct: 0.15, guard: 0.08 } },
    desc: '설원의 끝에서 산맥을 베개 삼아 자는 거인. 한 걸음에 눈사태가 난다.',
    chest: { name: '서리 거인의 얼음 성궤', n: [4, 4], w: [0, 0, 0, 40, 50, 9, 1, 0], sig: 0.105, spr: 'jewelbox',
      pal: { B: '#8fbfe0', b: '#3f6f9a', W: '#e8f6ff', H: '#ffffff', G: '#ffffff', J: '#1b6fd1' } } },
  demonking: { name: '마왕', icon: '😈', stage: 130, spr: 'rb_demonking', hit: 'darkorb', aoe: 'hellfire', fx: ['#c06bff', '#ff3b4b'], skill: '멸망의 흑염',
    pal: { h: '#e9e4d4', y: '#ffd257', R: '#ff3b4b', d: '#5a0f2a', W: '#f4f1e8', K: '#150a20', c: '#150a20', C: '#3a1a4a', J: '#c06bff' },
    set: { name: '마왕의 권능', 2: { atkPct: 0.2, hpPct: 0.15 }, 3: { aspdPct: 0.15, crit: 0.08, critMult: 0.5, guard: 0.05 } },
    desc: '마왕성의 옥좌에 앉은 모든 어둠의 주인. 그가 일어서면 하늘이 꺼진다.',
    chest: { name: '마왕의 옥좌 보고', n: [4, 5], w: [0, 0, 0, 25, 58, 15, 2, 0.2], sig: 0.09, spr: 'jewelbox',
      pal: { B: '#2a1540', b: '#150a20', W: '#c06bff', H: '#ffd257', G: '#ffd257', J: '#ff3b4b' } } },
  // ── 시즌 5: 마왕 뒤로 필드마다 한 마리 (그 필드의 마지막 스테이지에서 열린다). 상자는 신화 이상만, 보스를 따라 태초 비율이 오른다
  //  float: 땅에서 떠서 둥실거린다 (world.js raidBossPose)
  abysswatcher: { name: '심연의 감시자', icon: '👁️', stage: 140, spr: 'rb_abysswatcher', hit: 'eyebeam', aoe: 'rift', fx: ['#9a5cff', '#5ad1ff'], skill: '심연 개방', float: true,
    pal: { k: '#0d0818', v: '#3a1a6b', V: '#7a4fd1', W: '#f0e8ff', R: '#ff3b8a', K: '#0a0410', c: '#5ad1ff', C: '#e0f8ff' },
    set: { name: '심연의 시선', 2: { atkPct: 0.22, hpPct: 0.16 }, 3: { aspdPct: 0.15, crit: 0.09, critMult: 0.55, guard: 0.05 } },
    desc: '균열 너머에서 이쪽을 들여다보는 거대한 눈. 눈이 마주친 자는 발밑부터 심연으로 무너진다.',
    chest: { name: '감시자의 균열 함', n: [4, 5], w: [0, 0, 0, 12, 62, 22, 3.5, 0.5], sig: 0.09, spr: 'jewelbox',
      pal: { B: '#2a1a4a', b: '#0d0818', W: '#7a4fd1', H: '#5ad1ff', G: '#5ad1ff', J: '#ff3b8a' } } },
  skygriffin: { name: '천공의 그리폰 왕', icon: '🦅', stage: 160, spr: 'rb_skygriffin', hit: 'feather', aoe: 'gale', fx: ['#9fd8ff', '#ffffff'], skill: '천공 돌풍',
    pal: { w: '#3a6bb8', W: '#e8f0ff', h: '#ffffff', K: '#1b1d27', y: '#ffd257', b: '#c9a26a', B: '#f0dcb0', t: '#8a6a3a', T: '#3a6bb8' },
    set: { name: '천공의 패자', 2: { atkPct: 0.22, aspdPct: 0.12 }, 3: { hpPct: 0.2, crit: 0.09, critMult: 0.7, guard: 0.06 } },
    desc: '하늘에 뜬 섬들을 둥지 삼아 다스리는 그리폰들의 왕. 날개를 한 번 치면 구름이 갈라진다.',
    chest: { name: '그리폰 왕의 황금 둥지', n: [4, 5], w: [0, 0, 0, 5, 60, 29, 5, 1], sig: 0.09, spr: 'chest',
      pal: { B: '#c9a26a', b: '#8a6a3a', W: '#e8f0ff', H: '#ffd257', G: '#ffd257', J: '#3a6bb8' } } },
  sandworm: { name: '모래폭풍 대왕충', icon: '🪱', stage: 180, spr: 'rb_sandworm', hit: 'sandspit', aoe: 'quicksand', fx: ['#e8b56a', '#fff1c2'], skill: '개미지옥',
    pal: { o: '#5a3e1e', K: '#2a1408', t: '#f4f1e8', r: '#8a1f1f', s: '#c98b4a', S: '#e8b56a', d: '#b8925a', D: '#e0c080' },
    set: { name: '모래 폭군', 2: { hpPct: 0.25, aspdPct: 0.15 }, 3: { atkPct: 0.35, guard: 0.08, crit: 0.06, critMult: 0.6, goldPct: 0.3 } },
    desc: '모래폭풍 사막 밑을 헤엄치는 산만 한 벌레. 사구가 움직인다 싶으면 이미 그 입 속이다.',
    chest: { name: '대왕충의 삼킨 보물', n: [5, 5], w: [0, 0, 0, 0, 58, 34, 6.5, 1.5], sig: 0.084, spr: 'chest',
      pal: { B: '#c98b4a', b: '#5a3e1e', W: '#e8b56a', H: '#fff1c2', G: '#ffd257', J: '#2a8ad1' } } },
  kraken: { name: '심해의 크라켄', icon: '🦑', stage: 200, spr: 'rb_kraken', hit: 'inkshot', aoe: 'tidal', fx: ['#2a8ad1', '#9fe8ff'], skill: '대해일',
    pal: { p: '#4a1030', P: '#b3264a', L: '#ff6b8a', Y: '#ffe066', K: '#0a0410', s: '#ffb3c6' },
    set: { name: '심해의 군주', 2: { hpPct: 0.2, heal: 0.006 }, 3: { atkPct: 0.25, aspdPct: 0.15, guard: 0.09, crit: 0.08, critMult: 0.45 } },
    desc: '가라앉은 신전을 제 둥지로 삼은 거대한 두족류. 촉수 하나가 신전 기둥보다 굵다.',
    chest: { name: '가라앉은 신전의 제단 궤', n: [5, 5], w: [0, 0, 0, 0, 50, 40, 8, 2], sig: 0.084, spr: 'jewelbox',
      pal: { B: '#1f4a6b', b: '#0d2438', W: '#9fe8ff', H: '#ffe066', G: '#ffe066', J: '#ff6b8a' } } },
  fairyqueen: { name: '요정 여왕 티타니아', icon: '🧚', stage: 220, spr: 'rb_fairyqueen', hit: 'pixie', aoe: 'thorns', fx: ['#7dffb0', '#ff9ff3'], skill: '가시덩굴 정원',
    pal: { W: '#2f7a4a', L: '#b3ffd9', G: '#ff9ff3', y: '#ffd257', h: '#ffe8a8', f: '#ffd9c2', K: '#1b1d27', d: '#3a9a5a', D: '#c9ffd9' },
    set: { name: '요정 왕실', 2: { aspdPct: 0.15, hpPct: 0.22, expPct: 0.3 }, 3: { atkPct: 0.4, crit: 0.1, critMult: 0.8, guard: 0.08, heal: 0.006 } },
    desc: '요정의 숲 가장 오래된 나무 위의 여왕. 웃으며 손짓하면 숲 전체가 가시로 변한다.',
    chest: { name: '여왕의 꽃잎 보석함', n: [5, 5], w: [0, 0, 0, 0, 40, 46, 11, 3], sig: 0.075, spr: 'jewelbox',
      pal: { B: '#3a9a5a', b: '#1f5a33', W: '#b3ffd9', H: '#ff9ff3', G: '#ffd257', J: '#ff9ff3' } } },
  colossus: { name: '고대 병기 콜로서스', icon: '🤖', stage: 240, spr: 'rb_colossus', hit: 'cannon', aoe: 'laser', fx: ['#ff4d4d', '#3ee8ff'], skill: '궤도 포격',
    pal: { m: '#3a3a44', M: '#8a8f9a', E: '#3ee8ff', g: '#c9a227', c: '#2a2a33', C: '#e0443c' },
    set: { name: '고대 병기', 2: { atkPct: 0.25, guard: 0.06 }, 3: { hpPct: 0.25, aspdPct: 0.15, crit: 0.1, critMult: 0.7 } },
    desc: '유적 깊은 곳에서 천 년 동안 명령을 기다린 병기. 마지막 명령은 "다가오는 것은 모두 없애라".',
    chest: { name: '콜로서스의 동력 금고', n: [5, 6], w: [0, 0, 0, 0, 30, 50, 16, 4], sig: 0.075, spr: 'chest',
      pal: { B: '#5a5f6a', b: '#2a2a33', W: '#8a8f9a', H: '#c9a227', G: '#c9a227', J: '#3ee8ff' } } },
  crystalspider: { name: '수정 여왕 거미', icon: '🕷️', stage: 260, spr: 'rb_crystalspider', hit: 'shard', aoe: 'prism', fx: ['#ff9ff3', '#9fe8ff'], skill: '프리즘 폭쇄',
    pal: { c: '#5a2a8a', C: '#c98bff', W: '#ffffff', s: '#2a2048', S: '#5a4a8a', R: '#ff4dff', K: '#ffffff' },
    set: { name: '수정 여왕', 2: { crit: 0.1, critMult: 0.7 }, 3: { atkPct: 0.35, hpPct: 0.25, aspdPct: 0.18, guard: 0.08 } },
    desc: '등에 수정을 키우며 동굴을 통째로 거미줄로 감싼 여왕. 빛이 들면 동굴 전체가 칼날이 된다.',
    chest: { name: '수정 여왕의 알집', n: [5, 6], w: [0, 0, 0, 0, 20, 52, 22, 6], sig: 0.066, spr: 'jewelbox',
      pal: { B: '#3a2a5a', b: '#1b1530', W: '#c98bff', H: '#9fe8ff', G: '#ffffff', J: '#ff4dff' } } },
  stormlord: { name: '폭풍의 정령왕', icon: '🌩️', stage: 280, spr: 'rb_stormlord', hit: 'bolt', aoe: 'thunder', fx: ['#ffe066', '#9fd8ff'], skill: '만뢰', float: true,
    pal: { c: '#2a3448', C: '#5a6b8a', L: '#8a9ab8', K: '#0d0d1a', Y: '#ffe066', y: '#ffe066' },
    set: { name: '폭풍의 왕', 2: { atkPct: 0.25, aspdPct: 0.18 }, 3: { hpPct: 0.3, crit: 0.1, critMult: 0.8, guard: 0.07 } },
    desc: '봉우리 꼭대기에 걸린 먹구름이 눈을 떴다. 손가락질 한 번에 벼락이 떨어진다.',
    chest: { name: '정령왕의 뇌운 성궤', n: [6, 6], w: [0, 0, 0, 0, 10, 52, 30, 8], sig: 0.06, spr: 'jewelbox',
      pal: { B: '#2a3448', b: '#0d0d1a', W: '#5a6b8a', H: '#ffe066', G: '#ffe066', J: '#9fd8ff' } } },
  starend: { name: '종언의 성좌신', icon: '🌠', stage: 300, spr: 'rb_starend', hit: 'meteor', aoe: 'supernova', fx: ['#ffd257', '#c9b8ff'], skill: '초신성',
    pal: { a: '#ffd257', n: '#1b1450', N: '#3a2e8a', K: '#ffffff', '*': '#ffffff' },
    set: { name: '별의 종언', 2: { atkPct: 0.3, hpPct: 0.25 }, 3: { aspdPct: 0.2, crit: 0.12, critMult: 1, guard: 0.08, heal: 0.005 } },
    desc: '모든 별이 지는 곳에서 마지막 별을 지키는 신. 그 별마저 꺼지면 세상이 끝난다고 한다.',
    chest: { name: '마지막 별의 성궤', n: [6, 6], w: [0, 0, 0, 0, 0, 50, 38, 12], sig: 0.06, spr: 'jewelbox',
      pal: { B: '#2a2060', b: '#0d0a2a', W: '#c9b8ff', H: '#ffd257', G: '#ffd257', J: '#ffffff' } } },
};

// 입장권: 매일 RAID_TICKET_FREE 장까지 무료로 채워 주고, 그 이상은 골드로 산다 (0.23.2 에 💎 마력석을 뺐다 — 탑·미궁·성벽 입장권과 같이 골드만).
// 입장권은 레이드를 클리어했을 때만 1장 쓰인다 (실패하면 그대로 남음).
// 하루 첫 구매는 헐값, 두 번째부터 점점 비싸진다(자정에 초기화). 사서 모으는 건 최대 RAID_TICKET_MAX 장까지
const RAID_TICKET_FREE = 5;           // = RAID_TICKET_MAX: 매일 보유 상한까지 채워 준다 (표기 /5 와 맞춤)
const RAID_TICKET_MAX = 5;
const RAID_TICKET_GOLD = 20;           // 기준 가격: 최고 스테이지 몬스터 골드 × 이 값 (레이드 승리 골드의 약 1/4)
const RAID_TICKET_STEPS = [0.05, 1, 2, 3.5, 6];  // 오늘 n번째 구매의 기준 가격 배율 (첫 구매는 헐값)
const RAID_TICKET_GROW = 1.6;          // 표를 넘어가면 한 장마다 × 1.6
const RAID_MVP_MULT = 1.5;             // MVP 는 재화 1.5배
const RAID_FAIL_MULT = 0;              // 실패하면 보상 없음 (입장권을 안 깎으므로 위로 보상을 주면 무한 파밍이 된다)
// 레이드 보상(재화·경험치) 스테이지 = 입장 스테이지 + RAID_SOLO_ADD − 인원 보정 (src/raid.js settleRaid 에서 내 최고 스테이지로 상한).
// 0.21.0 성장 압축 전엔 보스가 실제로 싸우는 스테이지와 같았는데, 보스 세기는 server/raid.js 가 따로 정하고 보상은 그대로 뒀다 (경제는 2단계)
const RAID_SOLO_ADD = 9;
const RAID_PARTY_GAP = [0, 5, 9, 13];
const raidStageOf = (b, n) => b.stage + RAID_SOLO_ADD - RAID_PARTY_GAP[Math.max(1, Math.min(RAID_PARTY_GAP.length, n)) - 1];

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
  rb_abysswatcher: [[
    '........k..k........',
    '....k...kk.kk...k...',
    '.....kk.kvvk.kk.....',
    '......kkvvvvkk......',
    '....kkvvvvvvvvkk....',
    '...kvvVVVVVVVVvvk...',
    '..kvVWWWWWWWWWWVvk..',
    '.kvVWWRRRRWWWWWWVvk.',
    'kvVWWRRKKRRWWWWWWVvk',
    'kvVWWRKKKKRWWWWWWVvk',
    'kvVWWRKKKKRWWWWWWVvk',
    'kvVWWRRKKRRWWWWWWVvk',
    '.kvVWWRRRRWWWWWWVvk.',
    '..kvVWWWWWWWWWWVvk..',
    '...kvvVVVVVVVVvvk...',
    '....kkvvvvvvvvkk....',
    '......kkvvvvkk......',
    '..c.....kkkk.....c..',
    '.cCc...c....c...cCc.',
    '..c...cCc..cCc...c..',
    '.......c....c.......',
  ]],
  rb_skygriffin: [[
    'ww....................ww',
    'wWw..................wWw',
    'wWWw........hh......wWWw',
    '.wWWw......hhhh....wWWw.',
    '.wWWWw....hKhhhh..wWWWw.',
    '..wWWWw..yyhhhhh.wWWWw..',
    '..wWWWWw.yy.hhhhwWWWWw..',
    '...wWWWWw...hhhwWWWWw...',
    '....wWWWWw.bbbbWWWWw....',
    '.....wwWWWbbBBbbWWw.....',
    '.......wwbbBBBBbbw......',
    '........bbBBBBBBbb......',
    '......yybbBBBBBBbb......',
    '.....yy.bbbBBBBbbb......',
    '........bbbbbbbbbb.ttt..',
    '.........bbbbbbbb.tt.tT.',
    '.........bbb..bbbtt...T.',
    '........bbb....bbb......',
    '........bb......bb......',
    '.......yyy.....yyy......',
  ]],
  rb_sandworm: [[
    '....oooooo..............',
    '..ooKKKKKKoo............',
    '.oKKtKKtKKtKo...........',
    'oKtKKrrrrKKtso..........',
    'oKKKrrrrrrKKsso.........',
    'oKtKrrrrrrKtsso.........',
    'oKKKrrrrrrKKsso.........',
    '.oKtKrrrrKKtsso.........',
    '..ooKKtKKtKossso........',
    '....oooooosSsSsso.......',
    '.........osssssso.......',
    '.........oSsSsSso.......',
    '........ossssssso.......',
    '.......osSsSsSsso.......',
    '......ossssssssso.......',
    '.....osSsSsSsSsso.......',
    '...ddossssssssssodd.....',
    '.ddDDDDDDDDDDDDDDDDDdd..',
    'dDDDdDDDDDDdDDDDDDdDDDd.',
  ]],
  rb_kraken: [[
    '.........pp.........',
    '........pPPp........',
    '.......pPPPPp.......',
    '......pPPPPPPp......',
    '......pPPLPPPp......',
    '.....pPPPLPPPPp.....',
    '.....pPPPPPPPPp.....',
    '....pPPPPPPPPPPp....',
    '....pPPPPPPPPPPp....',
    '....pYYpPPPPpYYp....',
    '....pYKpPPPPpYKp....',
    '.....pPPPPPPPPp.....',
    '....pPpPpPPpPpPp....',
    '...pPp.pPppPp.pPp...',
    '.pPp..pPp..pPp..pPp.',
    'pPp..pPp....pPp..pPp',
    'pp..pPp......pPp..pp',
    '.p..pp...pp...pp..p.',
    'p..pp...pPPp...pp..p',
    '..s..s.s....s.s..s..',
  ]],
  rb_fairyqueen: [[
    '.WW...........y.y.........WW.',
    'WLLW.........yyyyy.......WLLW',
    'WLLLW.......hhffhh......WLLLW',
    'WLLLLW.....hhKffhh.....WLLLLW',
    'WLLGLLW....hhffffh....WLLGLLW',
    '.WLLLLLW...hhhffhh...WLLLLLW.',
    '.WLLLLLLW...hhddhh..WLLLLLLW.',
    '..WLLLLLLW..fdDDdf.WLLLLLLW..',
    '...WWLLLLLW.dDDDDdWLLLLLWW...',
    '.....WWWLLLWdDDDDdWLLLWWW....',
    '......WLLLLWdDDDDdWLLLLW.....',
    '.....WLLLLWfDDDDDDfWLLLLW....',
    '.....WLGLLW.DDDDDD.WLLGLW....',
    '......WLLW.DDDDDDDD.WLLW.....',
    '.......WW.DDDDDDDDDD.WW......',
    '.........DDDDdDDdDDDD........',
    '........DDDDDDDDDDDDDD.......',
    '.......DDdDDDDdDDDDdDDD......',
  ]],
  rb_colossus: [[
    '..........mmmmmm..........',
    '..........mMMMMm..........',
    '.........mmMMMMmm.........',
    '.........mEEEEEMm.........',
    '.........mmMMMMmm.........',
    '....mmmmmmmmmmmmmmmmmm....',
    '...mMMMMMmMMMMMMmMMMMMm...',
    '...mMgMgMmMMggMMmMgMgMm...',
    '...mMMMMMmMMMMMMmMMMMMm...',
    '...mmmmmmmMMEEMMmmmmmmm...',
    'cccccccccmMMEEMMm.mMMMm...',
    'CCCCCCCCcmMMMMMMm.mMMMm...',
    'ccccccccMmMMMMMMm.mMgMm...',
    '.......mMmmmmmmmm.mMMMm...',
    '..........mMMMMm...mmm....',
    '.........mMMmmMMm.........',
    '.........mMm..mMm.........',
    '........mMMm..mMMm........',
    '........mMMm..mMMm........',
    '.......mmmmm..mmmmm.......',
  ]],
  rb_crystalspider: [[
    '........c....c....c........',
    '.......cCc..cCc..cCc.......',
    '.......cCc.cCWCc.cCc.......',
    '......cCWCccCWCccCWCc......',
    '.......ssssssssssssss......',
    '.....sssSSSSSSSSSSSSsss....',
    '..s..ssSSSSSSSSSSSSSSss..s.',
    '.ssRsRsSSSSSSSSSSSSSSSs.ss.',
    'sRRKRKsssSSSSSSSSSSSsss.s.s',
    'sRRRRRs.sssssssssssssss...s',
    '.sssss.s..s..s.s..s...s..s.',
    '.s..s.s..s...s.s...s...s..s',
    's...s.s..s...s..s...s..s..s',
    's..s.s..s....s..s....s..s..',
  ]],
  rb_stormlord: [[
    '......cc.....cc........',
    '....ccLLc...cLLcc......',
    '..cccLLLLcccLLLLLcc....',
    '.cLLCCCCLLCCCCCCLLCc...',
    'cCCKYYCCCCKYYCCCCCCCc..',
    'cCCCCCCCCCCCCCCCCCCCc.y',
    '.cCCCCcCCCCCCcCCCCCc.yy',
    'y.ccCCCCCCCCCCCCCcc.yy.',
    'yy..cCcCCCCCCcCCc...y..',
    '.yy..ccCCCCCCCcc....yy.',
    '..y...cCCcCCCCc.......y',
    '.......cCCCCcc.........',
    '.......ccCCCCc.........',
    '........cCcCc..........',
    '........ccCc...........',
    '.........cCc...........',
    '.........cc............',
    '..........c............',
  ]],
  rb_starend: [[
    '.........aaaaaa.........',
    '......aaa......aaa......',
    '....aa....nnnn....aa....',
    '...a.....nNNNNn.....a...',
    '..a.....nNKNNKNn.....a..',
    '.a......nNNNNNNn......a.',
    '.a.......nNNNNn.......a.',
    'a.....nnnnNNNNnnnn.....a',
    'a...nnNNNNNNNNNNNNnn...a',
    'a..nNN*NNNNNNNNNN*NNn..a',
    'a.nNN..nNNNNNNNNn..NNn.a',
    '.anN...nNN*NNNNNn...Nna.',
    '.a*....nNNNNNN*Nn....*a.',
    '..a....nNNNNNNNNn....a..',
    '...a..nNNNNNNNNNNn..a...',
    '....aanNN*NNNNNNNNnaa...',
    '......nNNNNNNNNNNNNn....',
    '.....nNNNNNNNNNNNNNNn...',
    '....nnnnnnnnnnnnnnnnnn..',
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
