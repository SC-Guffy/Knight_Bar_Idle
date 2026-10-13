'use strict';
// 2차 훈련 🎓 교관 수련 규칙. core.js·raid.js 처럼 DOM 을 모르고 S 상태만 바꾼다 (무대·연출은 mentor-stage.js).
// 스펙: docs/specs/training-mentors.md · 수치: data.js MENTORS·MENTOR_*
//  S.mentor = {
//    stars: 교관별 받은 별 [0~5, …] (MENTORS 순서),
//    eye: 지금 별에서 실패한 횟수 (눈도장 — 다음 확률 +MENTOR_EYE 씩, 별을 받으면 0). 교관은 차례로만 만나므로 하나면 된다,
//    wins: 서버 승부 결과 id (같은 결과로 두 번 별을 받지 않도록), duelDay: 마지막으로 승부를 건 날 (레드닷은 하루 한 번만)
//  }
// 규칙
//  - 1차 훈련 네 가지가 모두 Lv TRAIN_MAX 여야 열린다. 교관은 순서대로 — 앞 교관 별 5개 + 훈련장 Lv MENTORS[i].bld.
//  - ★1~4: 골드를 내고 확률로 받는다 (실패해도 별은 그대로). ★5: 교관과의 승부 — 서버가 계산한다 (server/index.js /api/mentor/duel).
//  - 별 보너스는 gearBonus() 에 더해져 stats()·profile() 로 그대로 흘러간다. ★5 는 별 하나 몫 × MENTOR_LAST_X.
//  - MENTOR_ON(data.js) 이 꺼져 있으면 교관을 만날 수 없고 별 보너스도 없다. S.mentor 는 그대로 남겨 다시 켜면 돌아온다.

const freshMentor = () => ({ stars: MENTORS.map(() => 0), eye: 0, wins: [], duelDay: '' });

const trainDone = () => TRAINING.every((u) => (S.train[u.id] || 0) >= TRAIN_MAX);
const mentorStarsOf = (i) => (S.mentor.stars[i] || 0);
const mentorStarSum = () => MENTORS.reduce((a, m, i) => a + mentorStarsOf(i), 0);
const mentorDone = (i) => mentorStarsOf(i) >= MENTOR_STARS;
// 지금 수련할 교관 (모두 수료했으면 MENTORS.length)
const mentorCur = () => { const i = MENTORS.findIndex((m, k) => !mentorDone(k)); return i < 0 ? MENTORS.length : i; };

// 교관 i 를 만날 수 없는 이유 ('' = 만날 수 있음)
function mentorLock(i) {
  if (!MENTOR_ON) return '준비 중';
  if (!trainDone()) return `1차 훈련 네 가지를 Lv ${TRAIN_MAX} 까지`;
  if (i > 0 && !mentorDone(i - 1)) return `${MENTORS[i - 1].name} 수료 필요`;
  if (S.bld.training < MENTORS[i].bld) return `훈련장 Lv ${MENTORS[i].bld}`;
  return '';
}
const mentorOpen = (i) => i < MENTORS.length && mentorLock(i) === '';

// 다음 별(1~5)의 1회 비용 — 최고 스테이지 몬스터 골드 기준이라 나중에 찍어도 싸지지 않는다
const mentorCostAt = (star) => Math.floor(monsterStats(S.best, false).gold * MENTOR_GOLD * Math.pow(MENTOR_GROW, star - 1));
const mentorCost = (i = mentorCur()) => mentorCostAt(Math.min(MENTOR_STARS, mentorStarsOf(i) + 1));
// 지금 별의 성공 확률 (눈도장 포함)
// 뒤 교관일수록 기본 확률·눈도장 모두 MENTOR_HARD 배 (확률은 1%p 단위로 반올림)
const mentorEye = (i = mentorCur()) => Math.round(MENTOR_EYE * (MENTOR_HARD[i] || 1) * 1000) / 1000;
const mentorRate = (i = mentorCur()) => Math.min(1, Math.round((MENTOR_RATE[mentorStarsOf(i)] || 0) * (MENTOR_HARD[i] || 1) * 100) / 100 + S.mentor.eye * mentorEye(i));
// 다음이 승부(★5) 차례인가
const mentorDuelTurn = (i = mentorCur()) => mentorStarsOf(i) === MENTOR_STARS - 1;

// 수련 한 번을 할 수 없는 이유 ('' = 가능)
function mentorTryBlocker(i = mentorCur()) {
  if (i >= MENTORS.length) return '모든 교관 수료';
  const lock = mentorLock(i);
  if (lock) return lock;
  if (S.phase !== 'camp') return '캠프에서만';
  if (mentorDuelTurn(i)) return '승부 차례';
  if (S.gold < mentorCost(i)) return '골드 부족';
  return '';
}
// ★1~4 수련 한 번. 결과를 먼저 정하고 연출은 mentor-stage.js 가 튼다. { ok, star(받은 별 번호 또는 도전한 별), rate } | null
function mentorTry(i = mentorCur()) {
  if (mentorTryBlocker(i)) return null;
  const rate = mentorRate(i), star = mentorStarsOf(i) + 1;
  S.gold -= mentorCost(i);
  const ok = Math.random() < rate;
  if (ok) { S.mentor.stars[i] = star; S.mentor.eye = 0; } else S.mentor.eye++;
  return { ok, star, rate };
}

// 승부(★5)를 걸 수 없는 이유 ('' = 가능)
function mentorDuelBlocker(i = mentorCur()) {
  if (i >= MENTORS.length) return '모든 교관 수료';
  const lock = mentorLock(i);
  if (lock) return lock;
  if (S.phase !== 'camp') return '캠프에서만';
  if (!mentorDuelTurn(i)) return `★${MENTOR_STARS - 1} 까지 먼저`;
  if (S.gold < mentorCost(i)) return '골드 부족';
  return '';
}
// 승부 도전비를 낸다 (서버 요청 전에). 요청이 실패하면 mentorRefund 로 돌려준다
function mentorPayDuel(i = mentorCur()) {
  if (mentorDuelBlocker(i)) return 0;
  const c = mentorCost(i);
  S.gold -= c;
  S.mentor.duelDay = todayKey();
  return c;
}
const mentorRefund = (gold) => { S.gold += gold; };
// 서버 승부 결과 반영 — 이기면 ★5 (같은 결과 id 는 한 번만)
function mentorSettle(i, res) {
  if (!res || !res.id || S.mentor.wins.includes(res.id)) return false;
  S.mentor.wins.push(res.id);
  if (S.mentor.wins.length > 20) S.mentor.wins.shift();
  if (!res.won || mentorStarsOf(i) !== MENTOR_STARS - 1) return false;
  S.mentor.stars[i] = MENTOR_STARS;
  S.mentor.eye = 0;
  return true;
}

// 레드닷: 수련은 비용의 2배 골드가 있을 때, 승부는 오늘 아직 안 걸었고 도전비가 있을 때
function mentorTodo() {
  const i = mentorCur();
  if (!mentorOpen(i)) return false;
  return mentorDuelTurn(i) ? S.mentor.duelDay !== todayKey() && S.gold >= mentorCost(i) : S.gold >= 2 * mentorCost(i);
}

// 별 n 개가 주는 몫 (★1~4 하나씩, ★5 는 MENTOR_LAST_X 배)
const mentorUnits = (n) => Math.min(n, MENTOR_STARS - 1) + (n >= MENTOR_STARS ? MENTOR_LAST_X : 0);
// 교관 i 의 별 n 개 보너스 { 키: 값 }
function mentorSpAt(i, n = mentorStarsOf(i)) {
  const u = mentorUnits(n), out = {};
  if (u) for (const [k, v] of Object.entries(MENTORS[i].sp)) out[k] = Math.round(v * u * 10000) / 10000;
  return out;
}
// gearBonus() 에 더하는 교관 수련 보너스 합계
function mentorBonus() {
  const out = {};
  if (!MENTOR_ON || !S.mentor) return out;
  MENTORS.forEach((m, i) => { for (const [k, v] of Object.entries(mentorSpAt(i))) if (v) out[k] = (out[k] || 0) + v; });
  return out;
}
