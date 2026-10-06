'use strict';
// 3차 궁극기 「차원 붕괴」 연출 (voidArcher). 수치·단계는 src/classes.js 의 SKILLS.dimensionCollapse, 공통 레터박스·컷인은 src/skills.js 의 drawUltScreen.
Object.assign(SKILL_FX, {
  dimensionCollapse: {
    pose(u) { return { lift: 10 * Math.sin(u * Math.PI) }; },
    hit(a) { for (const t of a.targets()) pillarFx(t.x, a.color, 40, 0.5); impact({ stop: 0.06, shake: 0.3 }); },
    kb: 20,
  },
});
