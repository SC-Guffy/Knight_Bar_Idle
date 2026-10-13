'use strict';
// dev/review/mentors.html 의 "지금 화면" 보조 스크립트 — 게임(index.html) iframe 안에 <script src> 로 넣는다.
// 시즌6 판은 MENTOR_ON 이 켜져 있어서 게임 함수를 덮어쓰지 않는다. 상태만 만들어 훈련장 🎓 교관 탭을 연다.
/* global S, MENTORS, mentorCur, mentorStarsOf, mentorDuelTurn, mentorPlayTry, openCamp, renderCamp, townUi, mentorUi */

window.__mentorReview = {
  // stars·📕 상태로 마을 → 훈련장 → 🎓 교관 탭을 연다
  apply(stars, books = 30) {
    S.phase = 'camp'; S.best = Math.max(S.best, 60); S.stage = S.best; S.level = Math.max(S.level, 60);
    S.books = books;
    S.mentor = { stars: stars.slice(), wins: [], duel: { day: '', n: 0 } };
    openCamp(); campTab = 'town'; townUi.sel = 'training'; townUi.trainTab = 'mentor'; mentorUi.anim = null; mentorUi.view = mentorCur(); renderCamp();
    const c = document.querySelector('canvas.mstage');
    if (c) c.scrollIntoView({ block: 'center' });
    const b = document.querySelector('.mbar b');
    return b ? b.textContent : '';
  },
  // 지금 교관의 수련 연출. 별·📕 은 바꾸지 않는다
  play() {
    const i = mentorCur();
    if (i >= MENTORS.length || mentorDuelTurn(i)) return false;
    mentorUi.anim = null;
    mentorPlayTry(i, { ok: true, star: mentorStarsOf(i) + 1 });
    const c = document.querySelector('canvas.mstage');
    if (c) c.scrollIntoView({ block: 'center' });
    return true;
  },
};
