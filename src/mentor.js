'use strict';
// 🎓 교관 수련 규칙. core.js·raid.js 처럼 DOM 을 모르고 S 상태만 바꾼다 (무대·연출은 mentor-stage.js).
// 스펙: docs/specs/training-mentors.md · 수치: data.js MENTORS·MENTOR_*
//  S.mentor = {
//    stars: 교관별 받은 별 [0~5, …] (MENTORS 순서),
//    wins: 서버 승부 결과 id (같은 결과로 두 번 별을 받지 않도록, 최근 20개),
//    duel: { day, n } 오늘(todayKey) 건 승부 수 — 서버가 진짜로 세고(server/index.js) 응답의 left 로 맞춘다. 화면·레드닷용
//  }
//  S.books = 📕 수련의 서 (🏰 성벽 지키기에서 얻는다)
// 규칙
//  - 최고 스테이지 MENTOR_OPEN_STAGE 에서 열린다. 교관은 순서대로 — 앞 교관 별 5개.
//  - ★1~4: 📕 MENTOR_BOOKS[i][별−1] 권을 내면 확정으로 별 하나. ★5: 교관과의 승부 — 서버가 계산한다 (server/index.js /api/mentor/duel), 하루 MENTOR_DUEL_DAY 번.
//  - 별 보너스는 gearBonus() 에 더해져 stats()·profile() 로 그대로 흘러간다. ★5 는 별 하나 몫 × MENTOR_LAST_X.
//  - MENTOR_ON(data.js) 이 꺼져 있으면 교관을 만날 수 없고 별 보너스도 없다. S.mentor 는 그대로 남겨 다시 켜면 돌아온다.

const freshMentor = () => ({ stars: MENTORS.map(() => 0), wins: [], duel: { day: '', n: 0 } });
// 옛 세이브 (0.20.0 판: eye 눈도장 · duelDay) → 시즌6 판. 받은 별은 그대로 둔다
function migrateMentor(m) {
  if (!Array.isArray(m.stars)) m.stars = [];
  m.stars = MENTORS.map((x, i) => Math.max(0, Math.min(MENTOR_STARS, Math.floor(m.stars[i]) || 0)));
  if (!Array.isArray(m.wins)) m.wins = [];
  // migrate 의 병합으로 새 duel 이 먼저 들어와 있을 수 있다 — 옛 duelDay 가 있으면 그 날로
  if (!m.duel || typeof m.duel !== 'object' || (m.duelDay && !m.duel.day)) m.duel = { day: m.duelDay || '', n: 0 };
  m.duel.n = Math.max(0, Math.min(MENTOR_DUEL_DAY, Math.floor(m.duel.n) || 0));
  delete m.eye; delete m.duelDay;
  return m;
}

const mentorStarsOf = (i) => (S.mentor.stars[i] || 0);
const mentorStarSum = () => MENTORS.reduce((a, m, i) => a + mentorStarsOf(i), 0);
const mentorDone = (i) => mentorStarsOf(i) >= MENTOR_STARS;
const mentorAllDone = () => MENTORS.every((m, i) => mentorDone(i));
// 지금 수련할 교관 (모두 수료했으면 MENTORS.length)
const mentorCur = () => { const i = MENTORS.findIndex((m, k) => !mentorDone(k)); return i < 0 ? MENTORS.length : i; };

// 교관 i 를 만날 수 없는 이유 ('' = 만날 수 있음)
function mentorLock(i) {
  if (!MENTOR_ON) return '준비 중';
  if (S.best < MENTOR_OPEN_STAGE) return `최고 스테이지 ${MENTOR_OPEN_STAGE}`;
  if (i > 0 && !mentorDone(i - 1)) return `${MENTORS[i - 1].name} 수료 필요`;
  return '';
}
const mentorOpen = (i) => i < MENTORS.length && mentorLock(i) === '';
// 다음이 승부(★5) 차례인가
const mentorDuelTurn = (i = mentorCur()) => mentorStarsOf(i) === MENTOR_STARS - 1;
// 다음 별(★1~4)에 드는 📕 (승부 차례·수료면 0)
const mentorNeed = (i = mentorCur()) => (i < MENTORS.length ? (MENTOR_BOOKS[i][mentorStarsOf(i)] || 0) : 0);
const mentorBooks = () => S.books || 0;

// 수련 한 번을 할 수 없는 이유 ('' = 가능)
function mentorTryBlocker(i = mentorCur()) {
  if (i >= MENTORS.length) return '모든 교관 수료';
  const lock = mentorLock(i);
  if (lock) return lock;
  if (S.phase !== 'camp') return '캠프에서만';
  if (mentorDuelTurn(i)) return '승부 차례';
  if (mentorBooks() < mentorNeed(i)) return '📕 부족';
  return '';
}
// ★1~4 수련 한 번 — 📕 을 내고 별 하나 (확률 없음). 연출은 mentor-stage.js 가 튼다. { ok: true, star, books } | null
function mentorTry(i = mentorCur()) {
  if (mentorTryBlocker(i)) return null;
  const need = mentorNeed(i), star = mentorStarsOf(i) + 1;
  S.books = mentorBooks() - need;
  S.mentor.stars[i] = star;
  return { ok: true, star, books: need };
}

// 오늘 남은 승부 수 (서버가 진짜로 센다 — 이 값은 화면·레드닷용)
const mentorDuelLeft = () => (S.mentor.duel.day === todayKey() ? Math.max(0, MENTOR_DUEL_DAY - S.mentor.duel.n) : MENTOR_DUEL_DAY);
// 서버가 알려 준 오늘 남은 횟수로 맞춘다
function mentorDuelSync(left) {
  if (!Number.isFinite(left)) return;
  S.mentor.duel = { day: todayKey(), n: Math.max(0, Math.min(MENTOR_DUEL_DAY, MENTOR_DUEL_DAY - left)) };
}
// 첫 교관 승부는 최고 스테이지 MENTOR_FIRST_DUEL_STAGE 부터 (0.22.1 — server/index.js 도 같은 조건)
const mentorDuelStageLock = (i) => (i === 0 && S.best < MENTOR_FIRST_DUEL_STAGE ? `최고 스테이지 ${MENTOR_FIRST_DUEL_STAGE} 부터 승부` : '');
// 승부(★5)를 걸 수 없는 이유 ('' = 가능)
function mentorDuelBlocker(i = mentorCur()) {
  if (i >= MENTORS.length) return '모든 교관 수료';
  const lock = mentorLock(i);
  if (lock) return lock;
  if (S.phase !== 'camp') return '캠프에서만';
  if (!mentorDuelTurn(i)) return `★${MENTOR_STARS - 1} 까지 먼저`;
  if (mentorDuelStageLock(i)) return mentorDuelStageLock(i);
  if (mentorDuelLeft() <= 0) return '오늘 승부를 모두 했어요';
  return '';
}
// 서버 승부 결과 반영 — 오늘 횟수를 맞추고, 이기면 ★5 (같은 결과 id 는 한 번만)
function mentorSettle(i, res) {
  if (!res || !res.id || S.mentor.wins.includes(res.id)) return false;
  mentorDuelSync(res.left);
  S.mentor.wins.push(res.id);
  if (S.mentor.wins.length > 20) S.mentor.wins.shift();
  if (!res.won || mentorStarsOf(i) !== MENTOR_STARS - 1) return false;
  S.mentor.stars[i] = MENTOR_STARS;
  return true;
}

// 레드닷: ★1~4 는 📕 이 다음 별 요구량 이상, ★5 는 오늘 남은 승부가 있고 오늘 아직 한 번도 안 걸었을 때 (서버 연결이 있을 때만)
function mentorTodo() {
  const i = mentorCur();
  if (!mentorOpen(i)) return false;
  if (!mentorDuelTurn(i)) return mentorBooks() >= mentorNeed(i);
  if (mentorDuelStageLock(i)) return false;
  if (typeof activeToken === 'function' && !activeToken()) return false;
  return mentorDuelLeft() > 0 && (S.mentor.duel.day !== todayKey() || S.mentor.duel.n === 0);
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

// 별이 기사를 얼마나 바꾸는지 재는 스냅샷 (화면 안내용 — 랭킹·결투와 같은 stats(true)·powerOf)
const mentorSnap = () => { const st = stats(true); return { st, gb: gearBonus(), power: powerOf(st) }; };
// 교관 i 의 별을 잠깐 n 개로 바꿔서 잰다
function mentorSnapAt(i, n) {
  const keep = S.mentor.stars[i];
  S.mentor.stars[i] = n;
  try { return mentorSnap(); } finally { S.mentor.stars[i] = keep; }
}
