'use strict';
// 3차 궁극기 「천검」 연출 (swordsaint). 수치·단계는 src/classes.js 의 SKILLS.thousandCuts, 공통 레터박스·컷인은 src/skills.js 의 drawUltScreen.
Object.assign(SKILL_FX, {
  thousandCuts: {
    pose(u) { return { lift: 10 * Math.sin(u * Math.PI) }; },
    hit(a) { for (const t of a.targets()) pillarFx(t.x, a.color, 40, 0.5); impact({ stop: 0.06, shake: 0.3 }); },
    kb: 20,
  },
});
