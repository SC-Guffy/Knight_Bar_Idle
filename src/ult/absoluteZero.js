'use strict';
// 3차 궁극기 「절대영도」 연출 (frostlord). 수치·단계는 src/classes.js 의 SKILLS.absoluteZero
Object.assign(SKILL_FX, {
  absoluteZero: {
    pose(u, a) { return bowPullPose(u, a); },
    hit(a) { for (const t of a.targets()) hitFx(t.x, t.y, a.color, 1.2); impact({ stop: 0.04, shake: 0.15 }); },
    kb: 10,
  },
});
