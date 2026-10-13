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
//  - 최고 스테이지 CASTLE_UNLOCK_STAGE 에 열린다. 도전 단계 = 깬 최고 + 1 (최대 100). 단계 L 의 적 = 스테이지 20 + 2L 급.
//  - 10웨이브 (5·10웨이브는 보스). 다음 웨이브는 앞 웨이브 시작 12초(+망루) 뒤, 앞 웨이브를 다 잡으면 3초 뒤.
//  - 기사가 성문 앞에서 몸으로 막는다. 몬스터 공격력 ×4 (보스 ×12·×16). 쓰러지면 5초 뒤 일어나고, 그동안 성벽에 닿은 몬스터가 성벽을 친다.
//  - 10웨이브가 나온 뒤 120초 안에 다 잡아야 한다. 성벽 내구도 0 이면 즉시 실패.
//  - 보상: 🧱 = 처치 점수 × (1 + L/100), 첫 돌파는 ×2. 📕 = 막은 웨이브 × (0.34 + 0.001L) (확률 올림). 소탕 = 최고 단계 다 막은 몫.

const CASTLE_UNLOCK_STAGE = 40;
const CASTLE_MAX_LV = 100;
const CASTLE_TICKETS = 3;                 // 하루 무료 입장권
const CASTLE_TICKET_GOLD = 300;           // 구매 기준값 = 최고 스테이지 몹 골드 × 300 (탑과 같음, 사냥 30분치)
const CASTLE_TICKET_HOLD = SUB_TICKET_HOLD;   // 산 입장권 보유 한도 (탑·미궁과 같음, data.js)
const castleStage = (L) => 20 + 2 * L;
// 웨이브 구성: n 일반 몬스터, b 보스 (1 = 보스 체력 ×12, 2 = 거대 보스 체력 ×20)
const CASTLE_WAVES = [{ n: 10 }, { n: 11 }, { n: 12 }, { n: 13 }, { n: 10, b: 1 }, { n: 14 }, { n: 15 }, { n: 16 }, { n: 17 }, { n: 12, b: 2 }];
const CASTLE_BOSS_HP = [0, 12, 20];
const CASTLE_ATK_MULT = 4;                // 기사를 칠 때 몬스터 공격력 (같은 스테이지 일반 몬스터 ×4)
const CASTLE_BOSS_ATK = [0, 3, 4];        // 보스는 그 × 3 (= ×12), 거대 보스 × 4 (= ×16)
const CASTLE_BOSS_CD = 2;                 // 보스 공격 간격
const CASTLE_BOSS_PTS = 10;               // 처치 점수: 일반 1, 보스 10 → 다 잡으면 150
const CASTLE_FULL_PTS = CASTLE_WAVES.reduce((a, w) => a + w.n + (w.b ? CASTLE_BOSS_PTS : 0), 0);
const CASTLE_WAVE_GAP = 12;               // 웨이브 간격 (망루 +0.5초/Lv)
const CASTLE_EARLY = 3;                   // 앞 웨이브를 다 잡으면 이 초 뒤에 다음 웨이브
const CASTLE_LIMIT_SEC = 120;             // 10웨이브가 나온 뒤 제한 시간
const CASTLE_RESPAWN_SEC = 5;             // 쓰러지면 이 초 뒤 성문 앞에서 체력 가득으로 일어난다
const CASTLE_LANE_SEC = 12, CASTLE_BOSS_LANE_SEC = 16;   // 몬스터가 레인을 건너는 시간 (해자 +3%/Lv)
const CASTLE_LANE_MAX = 480;              // 레인 길이 상한 px (창 폭에 따라 광역기에 걸리는 마릿수가 달라지지 않게)
const CASTLE_WALL_HP = 100;               // 성벽 내구도 (성벽 보강 +15/Lv)
const CASTLE_WALL_HIT = { mob: { dmg: 3, cd: 1.4 }, boss: { dmg: 24, cd: 2 } };   // 기사가 쓰러진 동안 성벽에 닿은 몬스터가 주는 피해
const CASTLE_REGEN = 0.05;                // 사거리 안에 몬스터가 없을 때 초당 최대 체력의 5% 회복
const CASTLE_SPAWN_PACK = 4, CASTLE_SPAWN_GAP = 0.5;     // 한 웨이브는 4마리씩 0.5초 간격으로 쏟아져 나온다
const CASTLE_BRICK_PER = 100;             // 🧱 = 점수 × (1 + L/100)
const CASTLE_BOOK_K0 = 0.34, CASTLE_BOOK_K1 = 0.001;     // 📕 = 막은 웨이브 × (0.34 + 0.001L)
// 업그레이드 6종 (각 Lv10, 비용 18 × 1.4^n 을 5 단위로)
const CASTLE_UP_MAX = 10;
const CASTLE_UPS = [
  { id: 'wall',     icon: '🧱', name: '성벽 보강', per: '내구도 +15',             fx: (lv) => `내구도 ${CASTLE_WALL_HP + 15 * lv}` },
  { id: 'watch',    icon: '⏳', name: '망루',     per: '웨이브 간격 +0.5초',      fx: (lv) => `웨이브 간격 ${CASTLE_WAVE_GAP + 0.5 * lv}초` },
  { id: 'moat',     icon: '🌊', name: '해자',     per: '몬스터 이동 시간 +3%',    fx: (lv) => `이동 시간 +${3 * lv}%` },
  { id: 'banner',   icon: '🚩', name: '군기',     per: '기사 공격력 +5%',         fx: (lv) => `공격력 +${5 * lv}%` },
  { id: 'archer',   icon: '🏹', name: '궁수대',   per: '기사 초당 피해 ×0.08',       fx: (lv) => (lv ? `궁수 ${castleArchers(lv)}명 · 기사 초당 피해 ×${(0.08 * lv).toFixed(2)}` : '궁수 없음') },
  { id: 'catapult', icon: '💥', name: '투석기',   per: '6초마다 광역 ×(1+0.3Lv)', fx: (lv) => (lv ? `6초마다 반경 48px 초당 피해 ×${(1 + 0.3 * lv).toFixed(1)}` : '투석기 없음') },
];
const CASTLE_UP_IDS = CASTLE_UPS.map((u) => u.id);
const castleUpCostAt = (n) => Math.round((18 * Math.pow(1.4, n)) / 5) * 5;
const castleArchers = (lv) => Math.min(4, Math.ceil(lv / 3));
const CASTLE_ARCHER_PER = 0.08;           // 궁수대 초당 피해 = 지원군 위력 × 0.08 × Lv
// 지원군 위력 = 기사의 단일 대상 초당 피해 (dpsOf, 군기 포함). 공격력(stats().atk)만 쓰면 스킬 비중이 큰 후반 기사(초당 피해 = 공격력 × 4~100)에서
//  지원군이 사실상 0 이 되어서, 스펙 시뮬의 가정(지원군 기준 ≈ 기사 처치 속도)대로 초당 피해에 묶었다 (2026-10-14 구현 중 변경, castle-defense.md)
const castlePow = (st = stats()) => dpsOf(st);
const CASTLE_CAT_SEC = 6, CASTLE_CAT_R = 48;
const CASTLE_MENTOR_SEC = 10, CASTLE_MENTOR_PER = 0.4;   // 교관: 10초마다 지원군 위력 × 0.4 × 별

const freshCastle = () => ({ best: 0, bricks: 0, up: Object.fromEntries(CASTLE_UP_IDS.map((id) => [id, 0])), tixDay: '', tixUsed: 0, tixExtra: 0, buyDay: '', bought: 0, run: null, last: null });
// 옛 세이브: up 에 없는 항목을 0 으로
function migrateCastle(c) {
  c.up = Object.assign(Object.fromEntries(CASTLE_UP_IDS.map((id) => [id, 0])), c.up || {});
}

const castleUnlocked = () => S.best >= CASTLE_UNLOCK_STAGE;
const castleNextLv = () => Math.min(CASTLE_MAX_LV, S.castle.best + 1);
const castleActive = () => S.phase === 'castle' && !!S.castle.run;
const castleUp = (id) => S.castle.up[id] || 0;
// stats() 가 곱하는 성벽 배율 (core.js) — 🚩 군기. 랭킹·결투용 stats(true) 에는 넣지 않는다
const castleFx = () => ({ atk: 0.05 * castleUp('banner') });
const castleWallMax = () => CASTLE_WALL_HP + 15 * castleUp('wall');
const castleWaveGap = () => CASTLE_WAVE_GAP + 0.5 * castleUp('watch');
const castleLaneSec = (boss) => (boss ? CASTLE_BOSS_LANE_SEC : CASTLE_LANE_SEC) * (1 + 0.03 * castleUp('moat'));

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
const castleTicketPrice = () => ({ gold: Math.max(1, Math.floor(monsterStats(S.best, false).gold * CASTLE_TICKET_GOLD * subTicketMult(castleTicketsBoughtToday()))) });
function castleTicketBlocker() {
  if (!castleUnlocked()) return `스테이지 ${CASTLE_UNLOCK_STAGE} 도달 시 열려요`;
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
const castleSweepReady = () => castleUnlocked() && S.castle.best > 0 && castleTickets() > 0 && !S.castle.run;
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

// ── 성벽 위 교관: MENTOR_ON 이고 별 1개 이상인 교관 [{ i, id, stars }] ──
// (함수 선언이라 개발 중 콘솔에서 window.castleMentors 를 바꿔 교관이 꺼진 빌드에서도 미리 볼 수 있다)
function castleMentors() {
  return typeof MENTOR_ON !== 'undefined' && MENTOR_ON && S.mentor ? MENTORS.map((m, i) => ({ i, id: m.id, stars: S.mentor.stars[i] || 0 })).filter((m) => m.stars > 0) : [];
}

// ── 시작 / 끝 ──
function castleBlocker() {
  if (!castleUnlocked()) return `스테이지 ${CASTLE_UNLOCK_STAGE} 도달 시 열려요`;
  if (S.phase !== 'camp') return '캠프에서만 도전할 수 있어요';
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
  for (let i = 0; i < w.n; i++) {
    const type = pool[Math.floor(Math.random() * pool.length)];
    out.push({ type, boss: 0, hp: st.hp, atk: st.atk * CASTLE_ATK_MULT, cd: MONSTERS[type].atkCd || 1.4, pts: 1 });
  }
  if (w.b) out.push({ type: zoneOf(stage).boss, boss: w.b, hp: st.hp * CASTLE_BOSS_HP[w.b], atk: st.atk * CASTLE_ATK_MULT * CASTLE_BOSS_ATK[w.b], cd: CASTLE_BOSS_CD, pts: CASTLE_BOSS_PTS });
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
  if (r.waveLeft[wi] > 0) return false;
  // 조기 호출: 지금 나온 마지막 웨이브를 다 잡았으면 3초 뒤 다음 웨이브
  if (wi === r.wave - 1 && r.nextAt > r.t + CASTLE_EARLY) r.nextAt = r.t + CASTLE_EARLY;
  return true;
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
  const bricks = castleBricksOf(L, r.pts) * (first ? 2 : 1), books = castleBooksOf(L, waves);
  S.castle.bricks += bricks; S.books = (S.books || 0) + books;
  if (clear && L > S.castle.best) S.castle.best = L;
  const at = Date.now();
  S.castle.last = { lv: L, reason, waves, kills: r.kills, pts: r.pts, downs: r.downs, bricks, books, first, best: S.castle.best, dur: reason === 'offline' ? 0 : Math.round(r.t * 10) / 10, at, seen: false };
  S.castle.run = null;      // phase 는 부른 쪽이 캠프로 돌린다 (하단바는 귀환 연출 뒤, 오프라인은 바로)
  return S.castle.last;
}

// ── 간이 시뮬 (판정 칩·dev/castle-sim.js) ──
// 실제 전투를 근사한다: 레인 480px, 기사 앞 16px 줄, 몬스터 공격력 ×4, 쓰러지면 5초·성벽 피해, 제한 시간 120초, 웨이브 사이 회복.
//  o = { L, dps 단일 대상 초당 피해 (= 지원군 위력), maxHp, guard, heal(초당 회복량, 흡혈), range px, aoe 한 번에 같이 맞는 수(1~), up, stars [교관별 별] }
// 광역은 "앞 몬스터 근처(30px)에 같이 들어가는 몫"으로 근사한다. 같은 시드라 결과가 고정된다
function castleSimRun(o) {
  let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const u = o.up || {}, lv = (k) => u[k] || 0, LANE = CASTLE_LANE_MAX, dt = 0.1;
  const stage = castleStage(o.L), base = monsterStats(stage, false);
  const gap = CASTLE_WAVE_GAP + 0.5 * lv('watch'), moat = 1 + 0.03 * lv('moat');
  const bannerK = 1 + 0.05 * lv('banner'), dps = o.dps * bannerK, atk = dps;     // 지원군 위력 = 군기 포함 초당 피해
  const arch = atk * CASTLE_ARCHER_PER * lv('archer') + (o.stars || []).reduce((a, s) => a + atk * CASTLE_MENTOR_PER * s / CASTLE_MENTOR_SEC, 0);
  const cat = lv('catapult') ? atk * (1 + 0.3 * lv('catapult')) : 0;
  const reach = (o.range || 20) + 12, mreach = 26;
  let t = 0, wall = CASTLE_WALL_HP + 15 * lv('wall'), kh = o.maxHp, down = 0, downs = 0, mobs = [], wi = 0, nextAt = 1.5, catT = CASTLE_CAT_SEC, tLast = null;
  const left = [];
  while (t < 900) {
    if (wi < 10 && t >= nextAt) {
      const w = CASTLE_WAVES[wi];
      for (let i = 0; i < w.n; i++) mobs.push({ hp: base.hp, x: LANE + Math.floor(i / 4) * 20 + (i % 4) * 6, sp: LANE / (CASTLE_LANE_SEC * moat), w: wi, cd: rnd() * 1.4, atk: base.atk * CASTLE_ATK_MULT, kcd: 1.4, wd: CASTLE_WALL_HIT.mob.dmg, wcd: CASTLE_WALL_HIT.mob.cd });
      if (w.b) mobs.push({ hp: base.hp * CASTLE_BOSS_HP[w.b], x: LANE + 30, sp: LANE / (CASTLE_BOSS_LANE_SEC * moat), w: wi, cd: 0, atk: base.atk * CASTLE_ATK_MULT * CASTLE_BOSS_ATK[w.b], kcd: CASTLE_BOSS_CD, wd: CASTLE_WALL_HIT.boss.dmg, wcd: CASTLE_WALL_HIT.boss.cd, boss: 1 });
      left[wi] = w.n + (w.b ? 1 : 0); wi++; nextAt = t + gap; if (wi === 10) tLast = t;
    }
    mobs.sort((a, b) => a.x - b.x);
    let prev = -1e9;
    for (const m of mobs) { const stop = down > 0 ? 0 : Math.max(mreach * 0.6, prev + 16); if (m.x > stop) m.x = Math.max(stop, m.x - m.sp * dt); prev = m.x; }
    let engaged = false;
    for (const m of mobs) {
      if (m.x > mreach) continue;
      engaged = true; m.cd -= dt; if (m.cd > 0) continue;
      if (down > 0) { m.cd = m.wcd; wall -= m.wd; } else { m.cd = m.kcd; kh -= m.atk * (1 - o.guard); }
    }
    if (wall <= 0) return { ok: false, why: 'broken', downs, t };
    if (tLast != null && t > tLast + CASTLE_LIMIT_SEC) return { ok: false, why: 'timeout', downs, t };
    if (down > 0) { down -= dt; if (down <= 0) kh = o.maxHp; }
    else if (kh <= 0) { downs++; down = CASTLE_RESPAWN_SEC; }
    else {
      const tgt = mobs.filter((m) => m.x <= reach);
      if (!engaged && !tgt.length) kh = Math.min(o.maxHp, kh + o.maxHp * CASTLE_REGEN * dt);
      if (tgt.length) {
        kh = Math.min(o.maxHp, kh + (o.heal || 0) * dt);
        const f = tgt[0], near = tgt.filter((m) => m.x - f.x <= 30).slice(0, Math.ceil(o.aoe || 1));
        near.forEach((m, i) => (m.hp -= dps * dt * (i === 0 ? 1 : Math.min(1, (o.aoe || 1) - i))));
      }
    }
    if (mobs.length) {
      const f = mobs[0]; f.hp -= arch * dt;
      if (cat) { catT -= dt; if (catT <= 0) { catT = CASTLE_CAT_SEC; mobs.filter((m) => m.x - f.x <= CASTLE_CAT_R).forEach((m) => (m.hp -= cat)); } }
    }
    const dead = mobs.filter((m) => m.hp <= 0);
    if (dead.length) {
      mobs = mobs.filter((m) => m.hp > 0);
      for (const m of dead) left[m.w]--;
      if (wi < 10 && wi > 0 && left[wi - 1] === 0 && nextAt > t + CASTLE_EARLY) nextAt = t + CASTLE_EARLY;
    }
    if (wi >= 10 && !mobs.length) return { ok: true, downs, t };
    t += dt;
  }
  return { ok: false, why: 'timeout', downs, t };
}
// 지금 능력치로 시뮬에 넣을 값 (군기는 시뮬이 곱하므로 캠프 능력치 stats(true) 기준)
function castleSimInput(st = stats(true)) {
  const aoe = Math.max(1, st.targets || 1) + (st.kind === 'ranged' && heroWeapon().splash ? 1 : 0) + 0.5;   // 스킬 광역 몫 +0.5
  return { dps: dpsOf(st), maxHp: st.maxHp, guard: st.guard, heal: (st.heal || 0) * st.maxHp * st.aspd, range: st.range, aoe, up: { ...S.castle.up }, stars: castleMentors().map((m) => m.stars) };
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
