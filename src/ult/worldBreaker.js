'use strict';
// 3차 궁극기 「천붕」 연출 (warlord). 수치·단계는 src/classes.js 의 SKILLS.worldBreaker, 공통 레터박스·컷인은 src/skills.js 의 drawUltScreen.
Object.assign(SKILL_FX, {
  worldBreaker: {
    pose(u) { return { lift: 10 * Math.sin(u * Math.PI) }; },
    hit(a) { for (const t of a.targets()) pillarFx(t.x, a.color, 40, 0.5); impact({ stop: 0.06, shake: 0.3 }); },
    kb: 20,
  },
});
