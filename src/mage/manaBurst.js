'use strict';
// 마력 폭발 연출 (mage). 수치·단계는 src/classes.js 의 SKILLS.manaBurst
Object.assign(SKILL_FX, {
  manaBurst: {
    pose(u, a) { return bowPullPose(u, a); },
    hit(a) { for (const t of a.targets()) hitFx(t.x, t.y, a.color, 1.2); impact({ stop: 0.04, shake: 0.15 }); },
    kb: 10,
  },
});
