'use strict';
// 🏰 성벽 지키기 규칙. core.js·tower.js 처럼 DOM 을 모르고 S 상태만 바꾼다. 하단바 연출(성벽·웨이브·지원군)은 castle-view.js, 캠프 화면은 castle-ui.js.
// 스펙: docs/specs/castle-defense.md
//  S.books = 📕 수련의 서 (교관 수련 재화 — 교관 스펙도 이 이름을 쓴다)
//  S.castle = {
//    best: 깬 최고 단계 (0 = 아직 없음), bricks: 🧱 성벽돌,
//    up: { wall, watch, moat, banner, archer, catapult } 업그레이드 Lv (0~CASTLE_UP_MAX),
//    tixDay, tixUsed: 오늘 쓴 무료 입장권 · tixExtra: 산 입장권 (최대 CASTLE_TICKET_HOLD, 자정에 안 사라짐) · buyDay, bought: 오늘 산 장수,
//    run: 진행 중인 도전 { lv, wave 나온 웨이브 수, waveLeft [웨이브별 남은 수], kills, pts, wallHp, wallMax, downs, first, t0 시작 시각(ms), t 판 안 시간(초), nextAt 다음 웨이브 시각, tLast 10웨이브가 나온 시각, log [웨이브 시작 시각] } | null,
//    last: 마지막 결과 { lv, reason, waves, kills, pts, downs, bricks, books, first, best, dur, at, seen } | null,
//  }
// 규칙
//  - 최고 스테이지 CASTLE_UNLOCK_STAGE 에 열린다. 도전 단계 = 깬 최고 + 1 (최대 30). 단계 L 의 적 = 스테이지 7L − 6 급 (castleStage, 1단계 1 · 30단계 204).
//  - 10웨이브 (5·10웨이브는 보스), 잡몹 130. 1.5초마다 5마리가 흩어져 몰려온다. 다음 웨이브는 앞 웨이브 시작 10초(+망루) 뒤, 앞 웨이브를 다 잡으면 1초 뒤.
//  - 1:n 포위 (2차 개편 10-15): 줄을 서지 않고 기사 앞에 겹겹이 붙어 붙은 몬스터가 모두 친다. 잡몹 체력 ×1 · 공격력 ×2.4 (보스는 체력 ×2·×2.31, 공격력 ×2·×2.16).
//    쓰러지면 5초 뒤 일어나고, 그동안 성벽에 닿은 몬스터가 성벽을 친다. 🔥 끓는 기름 (20초 쿨): 성문 앞 무리에 지원군 위력 ×3 + 화상.
//  - 10웨이브가 나온 뒤 120초 안에 다 잡아야 한다. 성벽 내구도 0 이면 즉시 실패.
//  - 보상: 🧱 = 처치 점수 × (1 + L/30), 첫 돌파는 ×2. 📕 = 막은 웨이브 × (0.34 + 0.0033L) (확률 올림). 소탕 = 최고 단계 다 막은 몫.

const CASTLE_UNLOCK_STAGE = 40;
const CASTLE_MAX_LV = 30;               // 10-16 단계 축소: 1~100 (단계당 스테이지 +2) → 1~30 (+7). 적 범위는 같은 1~204
const CASTLE_TICKETS = 3;                 // 하루 무료 입장권
const CASTLE_TICKET_GOLD = 300;           // 구매 기준값 = 최고 스테이지 몹 골드 × 300 (탑과 같음, 사냥 30분치)
const CASTLE_TICKET_HOLD = SUB_TICKET_HOLD;   // 산 입장권 보유 한도 (탑·미궁과 같음, data.js)
// 단계 L 의 적 = 스테이지 CASTLE_STAGE0 + CASTLE_STAGE_PER × L. 0.22.0 압축 재조정 20 + 2L → 10 + 2L, 2차 개편(1:n, 10-15) 10 + 2L → −8 + 2L (템포 조정 뒤 실측에 맞춤, 1단계는 스테이지 1 로 바닥)
//  (1:n 이 같은 적 스테이지에서 약 4단계 어려워서 당겼다 — 업그레이드 0 이면 최고 스테이지 100 에서 약 33단계 = 스테이지 70, 1차와 같은 진행감)
//  10-16 사용자: "단계가 너무 잘게 쪼개져 깨는 게 너무 쉽다" → −8 + 2L (1~100) 을 7L − 6 (1~30) 으로. 한 단계 = 체력·공격력 합쳐 약 2배
const CASTLE_STAGE0 = -6, CASTLE_STAGE_PER = 7;
const castleStage = (L) => Math.max(1, Math.round(CASTLE_STAGE0 + CASTLE_STAGE_PER * L));
// 웨이브 구성: n 일반 몬스터, b 보스 (1 = 보스 체력 ×2, 2 = 거대 보스 체력 ×2.31)
//  2차 개편(1:n): 마릿수는 1차와 같은 130 (×2·×1.5 는 단일 대상 기사가 공격 횟수에 막혀 뺐다), 대신 5마리씩 흩어져 몰려온다
const CASTLE_WAVES = [{ n: 10 }, { n: 11 }, { n: 12 }, { n: 13 }, { n: 10, b: 1 }, { n: 14 }, { n: 15 }, { n: 16 }, { n: 17 }, { n: 12, b: 2 }];
// 몬스터 배율은 0.21.0 성장 압축(docs/specs/growth-compression.md)에 맞춰 탑처럼 지수 0.28 로 줄였다 (압축 전 체력 ×12·×20, 공격력 ×4, 보스 ×3·×4)
const CASTLE_BOSS_HP = [0, 2, 2.31];
// 잡몹은 같은 스테이지 잡몹 대비 체력 ×1 · 공격력 ×2.4 (1:n — 붙은 수만큼 맞는다. 1차 1:1 은 체력 ×1 · 공격력 ×1.47)
const CASTLE_MOB_HP = 1;
const CASTLE_ATK_MULT = 2.4;
const CASTLE_BOSS_ATK = [0, 2, 2.16];     // 보스 공격력 = 같은 스테이지 잡몹 ×2 · 거대 보스 ×2.16 (1차와 같은 절대값)
const CASTLE_BOSS_CD = 2;                 // 보스 공격 간격
const CASTLE_BOSS_PTS = 10, CASTLE_MOB_PTS = 1;   // 처치 점수: 일반 1, 보스 10 → 다 잡으면 150 (1차와 같은 보상)
const CASTLE_FULL_PTS = CASTLE_WAVES.reduce((a, w) => a + w.n * CASTLE_MOB_PTS + (w.b ? CASTLE_BOSS_PTS : 0), 0);
// 적 스테이지에 따라 마릿수가 는다: 표 × min(1, 0.48 + 0.01 × 적 스테이지) (스테이지 1 은 49% → 52 부터 100%. 옛 1~100 단계의 0.4 + 0.02L 와 같은 곡선). 무리 압박(초당 몰려오는 수)은 단계와 상관없어서,
//  막 열린 기사(최고 40, 공속 1·체력 100 언저리)는 1단계 무리에도 맞아 죽었다 (10-15 템포 조정 중 발견). 잡몹 한 마리 점수는 130 / 그 단계 마릿수 → 다 잡으면 늘 150점
const CASTLE_COUNT_K0 = 0.48, CASTLE_COUNT_PER = 0.01;
const castleWaveN = (L, wi) => Math.max(3, Math.round(CASTLE_WAVES[wi].n * Math.min(1, CASTLE_COUNT_K0 + CASTLE_COUNT_PER * castleStage(L))));
const castleMobTotal = (L) => CASTLE_WAVES.reduce((a, w, wi) => a + castleWaveN(L, wi), 0);
const castleMobPts = (L) => (CASTLE_MOB_PTS * CASTLE_WAVES.reduce((a, w) => a + w.n, 0)) / castleMobTotal(L);
// 템포 (10-15 사용자: "웨이브 사이 템포가 늘어진다, 한 판이 너무 길지 않게"): 간격 12 → 10초, 다 잡으면 3초 → 1초 뒤 다음 웨이브.
//  잡몹 260 × 체력 0.4 → 130 × 체력 1 (한 발에 한 마리 잡는 기사는 마릿수가 많으면 화력과 상관없이 공격 횟수에 막혀서). 판 약 128초 → 약 103초.
//  남은 수 CASTLE_EARLY_LEFT 마리 이하에서 바로 부르는 안은 압박이 너무 커서(신궁 한계 31 → 11) 0 으로 둔다
const CASTLE_WAVE_GAP = 10;               // 웨이브 간격 (망루 +CASTLE_WATCH_PER 초/Lv)
const CASTLE_EARLY = 1, CASTLE_EARLY_LEFT = 0;   // 지금 웨이브를 다 잡으면 1초 뒤 다음 웨이브
const CASTLE_LIMIT_SEC = 120;             // 10웨이브가 나온 뒤 제한 시간
const CASTLE_RESPAWN_SEC = 5;             // 쓰러지면 이 초 뒤 성문 앞에서 체력 가득으로 일어난다
const CASTLE_LANE_SEC = 5, CASTLE_BOSS_LANE_SEC = 7;    // 몬스터가 전장(성문 앞 480px)을 건너는 시간 (해자 +3%/Lv). 1차 12·16초 — 원거리가 다가오는 동안 다 잡아 전혀 안 붙어서 줄였다
const CASTLE_LANE_MAX = 480;              // 전장 길이 상한 px. 성벽은 화면 왼쪽 끝, 그 오른쪽 480px 가 전장 (창이 넓으면 몬스터가 화면 끝에서 달려와 전장에 들어선다)
const CASTLE_WALL_HP = 100;               // 성벽 내구도 (성벽 보강 +15/Lv)
const CASTLE_WALL_HIT = { mob: { dmg: 1, cd: 1.4 }, boss: { dmg: 24, cd: 2 } };   // 잡몹 1차 3 → 1 (마릿수 ×2 라 한 번 쓰러지면 바로 무너졌다)   // 기사가 쓰러진 동안 성벽에 닿은 몬스터가 주는 피해
const CASTLE_REGEN = 0.05;                // 사거리 안에 몬스터가 없을 때 초당 최대 체력의 5% 회복
const CASTLE_SPD_JIT = [0.75, 1.3];      // 잡몹 빠르기 편차 (×) — 무리 안에서 흩어져 달려와 기사 앞에서 뭉친다 (10-15 사용자: 처음부터 뭉쳐 오지 말고 우르르)
const CASTLE_SPAWN_PACK = 5, CASTLE_SPAWN_GAP = 1.5;     // 한 웨이브는 1.5초마다 5마리씩 그 칸 안에서 제각각 튀어나온다 (일정한 간격으로 한 마리씩 흘러오면 '처치 > 등장' 여부로 낭떠러지가 생긴다)
// 🔥 끓는 기름: 쿨타임 · 성문 앞 범위 px · 즉시 피해(지원군 위력 ×) · 화상(초당 지원군 위력 ×, 초) · 살아남은 적 기절(초, 데어서 멈칫 — 보스는 절반)
const CASTLE_OIL_CD = 15, CASTLE_OIL_R = 90, CASTLE_OIL_K = 6, CASTLE_OIL_BURN = 1, CASTLE_OIL_BURN_SEC = 3, CASTLE_OIL_STUN = 1.5;
const CASTLE_BRICK_PER = 30;              // 🧱 = 점수 × (1 + L/30) (10-16 단계 축소 전 1 + L/100 — 끝 단계에서 ×2 그대로)
const CASTLE_BOOK_K0 = 0.34, CASTLE_BOOK_K1 = 0.0033;    // 📕 = 막은 웨이브 × (0.34 + 0.0033L) (축소 전 0.001L)
// 업그레이드 6종 (각 Lv10, 비용 18 × 1.4^n 을 5 단위로)
const CASTLE_UP_MAX = 10;
// 업그레이드 Lv 당 효과 (성벽 보강 내구도 · 망루 초 · 해자 이동 시간 · 군기 공격력 · 투석기 배율)
//  초당 피해 쪽(군기·궁수대·투석기)은 압축 곡선에서 같은 %가 스테이지 3~4칸어치라 줄였다 (압축 전 군기 5%·궁수 ×0.08·투석기 0.3). 시간·내구도 쪽은 그대로
const CASTLE_WALL_PER = 15, CASTLE_WATCH_PER = 0.5, CASTLE_MOAT_PER = 0.03, CASTLE_BANNER_PER = 0.0125, CASTLE_CAT_PER = 0.075;
const CASTLE_ARCHER_PER = 0.02;           // 궁수대 초당 피해 = 지원군 위력 × CASTLE_ARCHER_PER × Lv
const CASTLE_UPS = [
  { id: 'wall',     icon: '🧱', name: '성벽 보강', per: `내구도 +${CASTLE_WALL_PER}`,             fx: (lv) => `내구도 ${CASTLE_WALL_HP + CASTLE_WALL_PER * lv}` },
  { id: 'watch',    icon: '⏳', name: '망루',     per: `웨이브 간격 +${CASTLE_WATCH_PER}초`,      fx: (lv) => `웨이브 간격 ${+(CASTLE_WAVE_GAP + CASTLE_WATCH_PER * lv).toFixed(1)}초` },
  { id: 'moat',     icon: '🌊', name: '해자',     per: `몬스터 이동 시간 +${+(CASTLE_MOAT_PER * 100).toFixed(1)}%`,    fx: (lv) => `이동 시간 +${+(CASTLE_MOAT_PER * 100 * lv).toFixed(1)}%` },
  { id: 'banner',   icon: '🚩', name: '군기',     per: `기사 공격력 +${+(CASTLE_BANNER_PER * 100).toFixed(1)}%`,         fx: (lv) => `공격력 +${+(CASTLE_BANNER_PER * 100 * lv).toFixed(1)}%` },
  { id: 'archer',   icon: '🏹', name: '궁수대',   per: `기사 초당 피해 ×${CASTLE_ARCHER_PER}`,       fx: (lv) => (lv ? `궁수 ${castleArchers(lv)}명 · 기사 초당 피해 ×${(CASTLE_ARCHER_PER * lv).toFixed(2)}` : '궁수 없음') },
  { id: 'catapult', icon: '💥', name: '투석기',   per: `6초마다 광역 ×(1+${CASTLE_CAT_PER}Lv)`, fx: (lv) => (lv ? `6초마다 반경 48px 초당 피해 ×${(1 + CASTLE_CAT_PER * lv).toFixed(2)}` : '투석기 없음') },
];
const CASTLE_UP_IDS = CASTLE_UPS.map((u) => u.id);
const castleUpCostAt = (n) => Math.round((18 * Math.pow(1.4, n)) / 5) * 5;
const castleArchers = (lv) => Math.min(4, Math.ceil(lv / 3));
// 지원군 위력 = 기사의 단일 대상 초당 피해 (dpsOf, 군기 포함). 공격력(stats().atk)만 쓰면 스킬 비중이 큰 후반 기사(초당 피해 = 공격력 × 4~100)에서
//  지원군이 사실상 0 이 되어서, 스펙 시뮬의 가정(지원군 기준 ≈ 기사 처치 속도)대로 초당 피해에 묶었다 (2026-10-14 구현 중 변경, castle-defense.md)
const castlePow = (st = stats()) => dpsOf(st);
const CASTLE_CAT_SEC = 6, CASTLE_CAT_R = 48;
const CASTLE_MENTOR_SEC = 10, CASTLE_MENTOR_PER = 0.1;   // 교관: 10초마다 지원군 위력 × 0.1 × 별 (압축 전 0.4 — 궁수대처럼 4분의 1)

const freshCastle = () => ({ v: 2, best: 0, bricks: 0, up: Object.fromEntries(CASTLE_UP_IDS.map((id) => [id, 0])), tixDay: '', tixUsed: 0, tixExtra: 0, buyDay: '', bought: 0, run: null, last: null });
// 옛 세이브: up 에 없는 항목을 0 으로
// v2 (10-16 단계 축소): 옛 최고 단계(1~100, 적 −8 + 2L)를 그 적 스테이지 이하인 새 단계(1~30, 7L − 6)로 내린다
const castleLvFromOld = (L) => (L > 0 ? Math.min(CASTLE_MAX_LV, Math.max(1, Math.floor((Math.max(1, -8 + 2 * L) + 6) / 7))) : 0);
function migrateCastle(c) {
  c.up = Object.assign(Object.fromEntries(CASTLE_UP_IDS.map((id) => [id, 0])), c.up || {});
  if ((c.v || 1) < 2) {
    c.best = castleLvFromOld(c.best || 0);
    if (c.run) c.run.lv = Math.max(1, castleLvFromOld(c.run.lv));
    if (c.last) c.last.lv = castleLvFromOld(c.last.lv), c.last.best = castleLvFromOld(c.last.best || 0);
    c.v = 2;
  }
}

const castleUnlocked = () => S.best >= CASTLE_UNLOCK_STAGE;
const castleNextLv = () => Math.min(CASTLE_MAX_LV, S.castle.best + 1);
const castleActive = () => S.phase === 'castle' && !!S.castle.run;
const castleUp = (id) => S.castle.up[id] || 0;
// stats() 가 곱하는 성벽 배율 (core.js) — 🚩 군기. 랭킹·결투용 stats(true) 에는 넣지 않는다
const castleFx = () => ({ atk: CASTLE_BANNER_PER * castleUp('banner') });
const castleWallMax = () => CASTLE_WALL_HP + CASTLE_WALL_PER * castleUp('wall');
const castleWaveGap = () => CASTLE_WAVE_GAP + CASTLE_WATCH_PER * castleUp('watch');
const castleLaneSec = (boss) => (boss ? CASTLE_BOSS_LANE_SEC : CASTLE_LANE_SEC) * (1 + CASTLE_MOAT_PER * castleUp('moat'));

// ── 보상 ──
const castleBricksOf = (L, pts) => Math.round(pts * (1 + L / CASTLE_BRICK_PER));
const castleBooksEv = (L, waves) => waves * (CASTLE_BOOK_K0 + CASTLE_BOOK_K1 * L);
const castleBooksOf = (L, waves) => dgRound(castleBooksEv(L, waves));
const castleSweepBricks = () => castleBricksOf(S.castle.best, CASTLE_FULL_PTS);

// ── 입장권 ──
function castleFreeTickets() {
  if (newDay(S.castle.tixDay)) { S.castle.tixDay = todayKey(); S.castle.tixUsed = 0; }
  return Math.max(0, CASTLE_TICKETS - S.castle.tixUsed);
}
const castleTickets = () => castleFreeTickets() + (S.castle.tixExtra || 0);
const useCastleTicket = () => { if (castleFreeTickets() > 0) S.castle.tixUsed++; else S.castle.tixExtra = Math.max(0, S.castle.tixExtra - 1); };
const castleTicketsBoughtToday = () => (newDay(S.castle.buyDay) ? 0 : S.castle.bought);
// 오늘 n번째 구매 가격 — 탑·미궁과 같은 공통 곡선 (data.js subTicketMult, ticket-buy.md)
const castleTicketPrice = () => ({ gold: Math.max(1, Math.floor(monsterStats(priceBest(), false).gold * CASTLE_TICKET_GOLD * subTicketMult(castleTicketsBoughtToday()))) });
// 성벽 졸업 (0.31.0, docs/specs/currency-surplus-1023.md L): 30단계 · 업그레이드 6종 최대 · 교관 별 다 — 🧱·📕 쓸 곳이 더 없다.
//  보상·도전·소탕은 그대로 두고, 입장권 구매와 '입장권 남음' 레드닷만 끈다
const castleDone = () => S.castle.best >= CASTLE_MAX_LV && CASTLE_UP_IDS.every((id) => castleUp(id) >= CASTLE_UP_MAX)
  && (typeof MENTOR_ON === 'undefined' || !MENTOR_ON || mentorAllDone());
function castleTicketBlocker() {
  if (!castleUnlocked()) return `스테이지 ${CASTLE_UNLOCK_STAGE} 도달 시 열려요`;
  if (castleDone()) return '성벽·교관을 모두 마쳤어요 — 더 받을 게 없어요';
  if (!srvClock.known) return '서버 시각 확인 중';   // 탑·미궁과 같이 — 모르는 채 어제 장수로 쓰고 다시 채워지지 않게
  if ((S.castle.tixExtra || 0) >= CASTLE_TICKET_HOLD) return `산 입장권은 ${CASTLE_TICKET_HOLD}장까지 가질 수 있어요`;
  if (S.gold < castleTicketPrice().gold) return '골드 부족';
  return '';
}
function buyCastleTicket() {
  if (castleTicketBlocker()) return false;
  S.gold -= castleTicketPrice().gold;
  if (newDay(S.castle.buyDay)) { S.castle.buyDay = todayKey(); S.castle.bought = 0; }
  S.castle.bought++;
  S.castle.tixExtra = (S.castle.tixExtra || 0) + 1;
  return true;
}

// ── 소탕: 입장권 1장으로 깬 최고 단계를 10웨이브 다 막은 몫 ──
const castleSweepReady = () => castleUnlocked() && srvClock.known && S.castle.best > 0 && castleTickets() > 0 && !S.castle.run;
function sweepCastle() {
  if (!castleSweepReady()) return null;
  useCastleTicket();
  const L = S.castle.best, bricks = castleSweepBricks(), books = castleBooksOf(L, CASTLE_WAVES.length);
  S.castle.bricks += bricks; S.books = (S.books || 0) + books;
  return { lv: L, bricks, books };
}

// ── 업그레이드 ──
const castleUpCost = (id) => castleUpCostAt(castleUp(id));
function castleUpBlocker(id) {
  if (castleUp(id) >= CASTLE_UP_MAX) return '최대 Lv';
  if (S.castle.run) return '도전 중';
  if (S.castle.bricks < castleUpCost(id)) return '🧱 부족';
  return '';
}
function castleUpgrade(id) {
  if (!CASTLE_UP_IDS.includes(id) || castleUpBlocker(id)) return false;
  S.castle.bricks -= castleUpCost(id);
  S.castle.up[id] = castleUp(id) + 1;
  return true;
}
const castleUpReady = () => CASTLE_UP_IDS.some((id) => !castleUpBlocker(id));

// ── 성벽 위 교관: CASTLE_MENTOR_ON·MENTOR_ON 이고 별 1개 이상인 교관 [{ i, id, stars }] ──
// 2차 개편(10-15)에서 껐다 — 사용자: "교관이 파동 날리고 하는데 없어도 될 듯". 무리 포위·기름에 눈이 가게. 코드(castle-view.js 특기·그림)는 남겨 둔다.
// (함수 선언이라 개발 중 콘솔에서 window.castleMentors 를 바꿔 미리 볼 수 있다)
const CASTLE_MENTOR_ON = false;
function castleMentors() {
  return CASTLE_MENTOR_ON && typeof MENTOR_ON !== 'undefined' && MENTOR_ON && S.mentor ? MENTORS.map((m, i) => ({ i, id: m.id, stars: S.mentor.stars[i] || 0 })).filter((m) => m.stars > 0) : [];
}

// ── 시작 / 끝 ──
function castleBlocker() {
  if (!castleUnlocked()) return `스테이지 ${CASTLE_UNLOCK_STAGE} 도달 시 열려요`;
  if (S.phase !== 'camp') return '캠프에서만 도전할 수 있어요';
  if (!srvClock.known) return '서버 시각 확인 중';
  if (castleTickets() <= 0) return '입장권이 없어요 (자정에 충전 · 구매 가능)';
  return '';
}
function startCastle() {
  if (castleBlocker()) return false;
  useCastleTicket();
  const lv = castleNextLv(), wallMax = castleWallMax();
  S.castle.run = { lv, wave: 0, waveLeft: [], kills: 0, pts: 0, wallHp: wallMax, wallMax, downs: 0, first: lv > S.castle.best, t0: Date.now(), t: 0, nextAt: 1.5, tLast: null, log: [] };
  S.phase = 'castle';
  S.hp = stats().maxHp;
  return true;
}
// 이 웨이브에 나올 몬스터 [{ type, boss(0|1|2), hp, atk, cd, pts }] — 무리 순서대로 (보스는 맨 뒤)
function castleWaveMobs(L, wi) {
  const stage = castleStage(L), w = CASTLE_WAVES[wi], st = monsterStats(stage, false), pool = monsterPool(stage), out = [];
  const n = castleWaveN(L, wi), pts = castleMobPts(L);
  for (let i = 0; i < n; i++) {
    const type = pool[Math.floor(Math.random() * pool.length)];
    out.push({ type, boss: 0, hp: st.hp * CASTLE_MOB_HP, atk: st.atk * CASTLE_ATK_MULT, cd: MONSTERS[type].atkCd || 1.4, pts });
  }
  if (w.b) out.push({ type: zoneOf(stage).boss, boss: w.b, hp: st.hp * CASTLE_BOSS_HP[w.b], atk: st.atk * CASTLE_BOSS_ATK[w.b], cd: CASTLE_BOSS_CD, pts: CASTLE_BOSS_PTS });
  return out;
}
// 다음 웨이브를 연다: 웨이브 번호(0부터)와 몬스터 목록. 화면이 그 목록을 무리로 쏟아낸다
function castleNextWave() {
  const r = S.castle.run;
  if (!r || r.wave >= CASTLE_WAVES.length) return null;
  const wi = r.wave, mobs = castleWaveMobs(r.lv, wi);
  r.waveLeft[wi] = mobs.length;
  r.wave++;
  r.log.push(Math.round(r.t * 10) / 10);
  r.nextAt = r.t + castleWaveGap();
  if (r.wave === CASTLE_WAVES.length) r.tLast = r.t;
  return { wi, mobs, boss: !!CASTLE_WAVES[wi].b, last: r.wave === CASTLE_WAVES.length };
}
// 웨이브 wi 의 몬스터 한 마리를 잡았다. 그 웨이브를 다 잡았으면 true
function castleKill(wi, pts) {
  const r = S.castle.run;
  if (!r) return false;
  r.kills++; r.pts += pts;
  r.waveLeft[wi] = Math.max(0, (r.waveLeft[wi] || 0) - 1);
  // 조기 호출: 지금 나온 마지막 웨이브가 CASTLE_EARLY_LEFT 마리 이하로 남으면 바로 다음 웨이브
  if (wi === r.wave - 1 && r.waveLeft[wi] <= CASTLE_EARLY_LEFT && r.nextAt > r.t + CASTLE_EARLY) r.nextAt = r.t + CASTLE_EARLY;
  return r.waveLeft[wi] === 0;
}
const castleWavesHeld = (r) => r.waveLeft.slice(0, r.wave).filter((n) => n === 0).length;
const castleAllClear = (r) => r.wave >= CASTLE_WAVES.length && castleWavesHeld(r) === CASTLE_WAVES.length;
const castleTimeLeft = (r) => (r.tLast == null ? null : Math.max(0, CASTLE_LIMIT_SEC - (r.t - r.tLast)));
// 성벽이 맞았다. 무너졌으면 true
function castleWallHit(dmg) {
  const r = S.castle.run;
  if (!r) return false;
  r.wallHp = Math.max(0, r.wallHp - dmg);
  return r.wallHp <= 0;
}
// 판 끝: reason = clear 성공 | broken 성벽 붕괴 | timeout 시간 초과 | retreat 후퇴 | offline 앱을 꺼서
function endCastle(reason) {
  const r = S.castle.run;
  if (!r) return null;
  const L = r.lv, waves = castleWavesHeld(r), clear = reason === 'clear' && castleAllClear(r);
  const first = clear && L > S.castle.best;
  let bricks = castleBricksOf(L, r.pts) * (first ? 2 : 1), books = castleBooksOf(L, waves);
  // 바닥 = 최고 단계 소탕분 (0.31.0, docs/specs/castle-fail-floor.md): 새 단계에 도전하다 무너져도 소탕보다 덜 받지 않게 (탑의 입장 보장과 같은 뜻)
  const best0 = S.castle.best;
  const sweepB = best0 > 0 ? castleSweepBricks() : 0, sweepO = best0 > 0 ? castleBooksOf(best0, CASTLE_WAVES.length) : 0;
  const floor = bricks < sweepB || books < sweepO;
  bricks = Math.max(bricks, sweepB); books = Math.max(books, sweepO);
  S.castle.bricks += bricks; S.books = (S.books || 0) + books;
  if (clear && L > S.castle.best) S.castle.best = L;
  const at = Date.now();
  S.castle.last = { lv: L, reason, waves, kills: r.kills, pts: r.pts, downs: r.downs, bricks, books, first, floor, best: S.castle.best, dur: reason === 'offline' ? 0 : Math.round(r.t * 10) / 10, at, seen: false };
  S.castle.run = null;      // phase 는 부른 쪽이 캠프로 돌린다 (하단바는 귀환 연출 뒤, 오프라인은 바로)
  return S.castle.last;
}

// ── 간이 시뮬 (판정 칩·dev/castle-sim.js) ──
// 실제 전투를 근사한다 (2차 개편 1:n): 전장 480px, 5마리 무리 1.5초 간격, 줄 없이 기사 앞에 몰려 붙은 몬스터가 모두 친다,
//  쓰러지면 5초·성벽 피해, 제한 시간 120초, 웨이브 사이 회복. 🔥 끓는 기름은 넣지 않는다 (안 눌러도 깨는 기준).
//  o = { L, dps 단일 대상 초당 피해 (= 지원군 위력), maxHp, guard, heal(초당 회복량, 흡혈), range px, aoe 한 번에 같이 맞는 수(1~), up, stars [교관별 별], oil 기름을 쿨마다 쓴다고 볼지 }
// 광역은 "앞 몬스터 근처(30px)에 같이 들어가는 몫"으로 근사한다. 같은 시드라 결과가 고정된다. 반환에 pileMax(붙은 수 최대)·pileAvg
// 시뮬 보정: 간이 시뮬은 기사 자신의 처치 속도를 실제 전투보다 낮게 본다 (스킬 광역·관통·치명 몰림을 다 못 셈) — 봇 세이브 실측에 맞춘 배수
//  2차 개편 실측(10-15, 봇 세이브 최고 100 — 전쟁군주·검성·신궁·대마법사)에 다시 맞췄다: 2.5 → 1.7, 원거리 사거리는 1/4 만 셈, 광역은 3마리까지
//  (실제로는 투사체가 날아가는 시간·과녁 바꾸기·화면 끝에서 달려오는 무리 때문에 다가오는 동안 쏘는 몫이 시뮬보다 훨씬 작다. 그대로 두면 원거리를 6~9단계 높게 봤다)
//  (무리가 70px 두께로 흩어져 서서 할버드 같은 넓은 광역도 실제로는 3마리 남짓만 같이 맞는다)
//  템포 조정 뒤(10-15) 공격 횟수 상한을 넣고 다시 맞췄다: 초당 공격 횟수 = (공속 × 발 수 + 0.4) × 0.7 (투사체·과녁 바꾸기·스킬 시전 중 평타 멈춤),
//  피해 배수 1.7 → 1.0. 실측(전쟁군주 34 · 대마법사 34 · 검성 27 · 신궁 21) 대비 시뮬 36 · 31 · 28 · 23 (±3)
const CASTLE_SIM_DPS = 1.0, CASTLE_SIM_RANGE = 0.25, CASTLE_SIM_AOE = 3, CASTLE_SIM_SKILL_HITS = 0.4, CASTLE_SIM_HITK = 0.7;
function castleSimRun(o) {
  let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const u = o.up || {}, lv = (k) => u[k] || 0, LANE = CASTLE_LANE_MAX, dt = 0.05;
  const stage = castleStage(o.L), base = monsterStats(stage, false);
  const gap = CASTLE_WAVE_GAP + CASTLE_WATCH_PER * lv('watch'), moat = 1 + CASTLE_MOAT_PER * lv('moat');
  const bannerK = 1 + CASTLE_BANNER_PER * lv('banner'), dps = o.dps * bannerK, atk = dps;     // 지원군 위력 = 군기 포함 초당 피해
  const arch = atk * CASTLE_ARCHER_PER * lv('archer') + (o.stars || []).reduce((a, s) => a + atk * CASTLE_MENTOR_PER * s / CASTLE_MENTOR_SEC, 0);
  const cat = lv('catapult') ? atk * (1 + CASTLE_CAT_PER * lv('catapult')) : 0;
  const reach = 20 + Math.max(0, (o.range || 20) - 20) * CASTLE_SIM_RANGE + 12, mreach = 26;
  let t = 0, wall = CASTLE_WALL_HP + CASTLE_WALL_PER * lv('wall'), kh = o.maxHp, down = 0, downs = 0, mobs = [], wi = 0, nextAt = 1.5, catT = CASTLE_CAT_SEC, tLast = null, oilT = 0;
  let pileMax = 0, pileSum = 0, pileN = 0, hitAcc = 0;
  const hits = o.hits || 2;                 // 초당 공격 횟수 (평타 공속 × 발 수 + 스킬 몫)
  const left = [], q = [];
  const out = (r) => ({ ...r, downs, t, pileMax, pileAvg: pileSum / Math.max(1, pileN) });
  while (t < 900) {
    if (wi < 10 && t >= nextAt) {
      const w = CASTLE_WAVES[wi], wn = castleWaveN(o.L, wi);
      for (let i = 0; i < wn; i++) q.push({ at: t + Math.floor(i / CASTLE_SPAWN_PACK) * CASTLE_SPAWN_GAP + rnd() * CASTLE_SPAWN_GAP, m: { hp: base.hp * CASTLE_MOB_HP, sp: LANE / (CASTLE_LANE_SEC * moat) * (CASTLE_SPD_JIT[0] + rnd() * (CASTLE_SPD_JIT[1] - CASTLE_SPD_JIT[0])), w: wi, cd: rnd() * 1.4, atk: base.atk * CASTLE_ATK_MULT, kcd: 1.4, wd: CASTLE_WALL_HIT.mob.dmg, wcd: CASTLE_WALL_HIT.mob.cd } });
      if (w.b) q.push({ at: t + Math.ceil(wn / CASTLE_SPAWN_PACK) * CASTLE_SPAWN_GAP, m: { hp: base.hp * CASTLE_BOSS_HP[w.b], sp: LANE / (CASTLE_BOSS_LANE_SEC * moat), w: wi, cd: 0, atk: base.atk * CASTLE_BOSS_ATK[w.b], kcd: CASTLE_BOSS_CD, wd: CASTLE_WALL_HIT.boss.dmg, wcd: CASTLE_WALL_HIT.boss.cd, boss: 1 } });
      q.sort((a, b) => a.at - b.at);
      left[wi] = wn + (w.b ? 1 : 0); wi++; nextAt = t + gap; if (wi === 10) tLast = t;
    }
    while (q.length && q[0].at <= t) { const e = q.shift(); e.m.x = LANE; mobs.push(e.m); }
    for (const m of mobs) { const stop = down > 0 ? 0 : mreach * 0.6; if (m.x > stop) m.x = Math.max(stop, m.x - m.sp * dt); }
    mobs.sort((a, b) => a.x - b.x);
    let engaged = false, pile = 0;
    for (const m of mobs) {
      if (m.x > mreach) continue;
      engaged = true; pile++; m.cd -= dt; if (m.cd > 0) continue;
      if (down > 0) { m.cd = m.wcd; wall -= m.wd; } else { m.cd = m.kcd; kh -= m.atk * (1 - o.guard); }
    }
    if (pile) { pileMax = Math.max(pileMax, pile); pileSum += pile; pileN++; }
    if (wall <= 0) return out({ ok: false, why: 'broken' });
    if (tLast != null && t > tLast + CASTLE_LIMIT_SEC) return out({ ok: false, why: 'timeout' });
    if (down > 0) { down -= dt; if (down <= 0) kh = o.maxHp; }
    else if (kh <= 0) { downs++; down = CASTLE_RESPAWN_SEC; }
    else {
      const tgt = mobs.filter((m) => m.x <= reach);
      if (!engaged && !tgt.length) kh = Math.min(o.maxHp, kh + o.maxHp * CASTLE_REGEN * dt);
      if (tgt.length) {
        kh = Math.min(o.maxHp, kh + (o.heal || 0) * dt);
        // 공격 횟수 상한: 초당 hits 번만 친다 (한 번에 aoe 마리). 넘친 피해는 버려진다 — 한 발에 한 마리 잡는 기사가 무리에 막히는 것을 본다
        hitAcc += hits * dt;
        const aoe = Math.min(o.aoeCap || CASTLE_SIM_AOE, o.aoe || 1), per = dps * (o.dpsK || CASTLE_SIM_DPS) / hits;
        while (hitAcc >= 1) {
          hitAcc -= 1;
          const live = tgt.filter((m) => m.hp > 0);
          if (!live.length) break;
          const f = live[0];
          live.filter((m) => m.x - f.x <= 30).slice(0, Math.ceil(aoe)).forEach((m, i) => (m.hp -= per * (i === 0 ? 1 : Math.min(1, aoe - i))));
        }
      }
    }
    // 🔥 끓는 기름 (o.oil 일 때만): 쿨마다, 성문 앞에 4마리 이상 몰렸을 때 누른다고 본다 (화상은 즉시 피해에 합쳐 근사)
    if (o.oil) { oilT -= dt; const hit = mobs.filter((m) => m.x <= CASTLE_OIL_R); if (oilT <= 0 && hit.length >= 4) { oilT = CASTLE_OIL_CD; hit.forEach((m) => (m.hp -= atk * (CASTLE_OIL_K + CASTLE_OIL_BURN * CASTLE_OIL_BURN_SEC))); } }
    if (mobs.length) {
      const f = mobs[0]; f.hp -= arch * dt;
      if (cat) { catT -= dt; if (catT <= 0) { catT = CASTLE_CAT_SEC; mobs.filter((m) => m.x - f.x <= CASTLE_CAT_R).forEach((m) => (m.hp -= cat)); } }
    }
    const dead = mobs.filter((m) => m.hp <= 0);
    if (dead.length) {
      mobs = mobs.filter((m) => m.hp > 0);
      for (const m of dead) left[m.w]--;
      if (wi < 10 && wi > 0 && left[wi - 1] <= CASTLE_EARLY_LEFT && nextAt > t + CASTLE_EARLY) nextAt = t + CASTLE_EARLY;
    }
    if (wi >= 10 && !mobs.length && !q.length) return out({ ok: true });
    t += dt;
  }
  return out({ ok: false, why: 'timeout' });
}
// 초당 공격 횟수 = (평타 공속 × 발 수 + 스킬 몫) × CASTLE_SIM_HITK
const castleSimHits = (st) => ((st.aspd || 1) * (st.shots || 1) + CASTLE_SIM_SKILL_HITS) * CASTLE_SIM_HITK;
// 지금 능력치로 시뮬에 넣을 값 (군기는 시뮬이 곱하므로 캠프 능력치 stats(true) 기준)
function castleSimInput(st = stats(true)) {
  const aoe = Math.max(1, st.targets || 1) + (st.kind === 'ranged' && heroWeapon().splash ? 1 : 0) + 0.5;   // 스킬 광역 몫 +0.5
  return { dps: dpsOf(st), hits: castleSimHits(st), maxHp: st.maxHp, guard: st.guard, heal: (st.heal || 0) * st.maxHp * st.aspd, range: st.range, aoe, up: { ...S.castle.up }, stars: castleMentors().map((m) => m.stars) };
}
// 시뮬로 막을 수 있는 가장 높은 단계 (0 = 1단계도 못 막음). 단계가 오를수록 어려워진다고 보고 이분 탐색
function castleLimitLv(inp = castleSimInput()) {
  let lo = 0, hi = CASTLE_MAX_LV;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (castleSimRun({ ...inp, L: mid }).ok) lo = mid; else hi = mid - 1; }
  return lo;
}
// 판정 칩: 한계 단계와 도전 단계를 견준다 → { key: easy|even|hard, text, limit }
let castleVerdictCache = null;
function castleVerdict(L = castleNextLv()) {
  const inp = castleSimInput(), key = JSON.stringify([L, Math.round(inp.dps), Math.round(inp.maxHp), inp.guard.toFixed(3), Math.round(inp.heal), inp.up, inp.stars]);
  if (!castleVerdictCache || castleVerdictCache.key !== key) castleVerdictCache = { key, limit: castleLimitLv(inp) };
  const d = castleVerdictCache.limit - L;
  const v = d >= 2 ? { key: 'easy', text: '여유' } : d >= -1 ? { key: 'even', text: '비슷함' } : { key: 'hard', text: '버거움' };
  return { ...v, limit: castleVerdictCache.limit };
}
