'use strict';
// dev/review/mentors.html 의 "지금 화면" 보조 스크립트 — 게임(index.html) iframe 안에 <script src> 로 넣는다.
// 게임 CSP 가 eval 을 막아서, MENTOR_ON(const) 을 보는 함수 셋을 그 줄만 뺀 사본으로 여기 다시 선언한다.
// 원본: src/mentor.js mentorLock·mentorBonus, src/ui.js viewTraining (season6 724b746 기준). 게임 파일은 바꾸지 않는다.
/* global S, MENTORS, MENTOR_STARS, TRAIN_MAX, trainDone, mentorDone, mentorSpAt, mentorOpen, mentorCur, mentorStarsOf, mentorDuelTurn, mentorRate,
   mentorPlayTry, viewTrain1, viewMentor, fmt, trainAtkAt, trainHpAt, defRedAt, FORTUNE_PER_LV, openCamp, renderCamp, townUi, mentorUi */

function mentorLock(i) {
  if (!trainDone()) return `1차 훈련 네 가지를 Lv ${TRAIN_MAX} 까지`;
  if (i > 0 && !mentorDone(i - 1)) return `${MENTORS[i - 1].name} 수료 필요`;
  if (S.bld.training < MENTORS[i].bld) return `훈련장 Lv ${MENTORS[i].bld}`;
  return '';
}
function mentorBonus() {
  const out = {};
  if (!S.mentor) return out;
  MENTORS.forEach((m, i) => { for (const [k, v] of Object.entries(mentorSpAt(i))) if (v) out[k] = (out[k] || 0) + v; });
  return out;
}
function viewTraining() {
  if (!trainDone()) return viewTrain1() + `<div class="chips"><span class="chip">🔒 🎓 교관 수련 — 1차 훈련 네 가지를 Lv ${TRAIN_MAX} 까지</span></div>`;
  const done = `<div class="chips"><span class="chip">✅ 1차 훈련 수료 · ⚔️ 맨몸 공격 ${fmt(trainAtkAt(TRAIN_MAX))} · 🛡️ 체력 ${fmt(trainHpAt(TRAIN_MAX))} · 방어 -${(defRedAt(TRAIN_MAX) * 100).toFixed(1)}% · 💰 수완 +${Math.round(TRAIN_MAX * FORTUNE_PER_LV * 100)}%</span></div>`;
  if (!mentorOpen(0) && !mentorDone(0)) return done + `<div class="chips"><span class="chip">🔒 🎓 교관 수련 — ${mentorLock(0)}</span></div>`;
  return done + viewMentor();
}

// 검토 페이지가 부르는 손잡이
window.__mentorReview = {
  // stars·eye 상태로 마을 → 훈련장 → 교관 무대를 연다
  apply(stars, eye) {
    S.phase = 'camp'; S.best = Math.max(S.best, 60); S.stage = S.best; S.level = Math.max(S.level, 60);
    for (const k of Object.keys(S.train)) S.train[k] = TRAIN_MAX;      // 지금 코드의 1차 수료 조건 (TRAIN_MAX = 200)
    S.bld.training = 10; S.gold = 1e12;
    S.mentor = { stars: stars.slice(), eye, wins: [], duelDay: '' };
    openCamp(); campTab = 'town'; townUi.sel = 'training'; mentorUi.anim = null; mentorUi.view = mentorCur(); renderCamp();
    const c = document.querySelector('canvas.mstage');
    if (c) c.scrollIntoView({ block: 'center' });
    const b = document.querySelector('.mbar b');
    return b ? b.textContent : '';
  },
  // 지금 교관의 수련 연출 (ok: 성공/탈락). 별·골드는 바꾸지 않는다
  play(ok) {
    const i = mentorCur();
    if (i >= MENTORS.length || mentorDuelTurn(i)) return false;
    mentorUi.anim = null;
    mentorPlayTry(i, { ok, star: mentorStarsOf(i) + 1, rate: mentorRate(i) });
    const c = document.querySelector('canvas.mstage');
    if (c) c.scrollIntoView({ block: 'center' });
    return true;
  },
};
