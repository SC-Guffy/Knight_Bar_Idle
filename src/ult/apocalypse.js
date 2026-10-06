'use strict';
// 3차 궁극기 「종언의 겁화」 연출 (archmage). 수치·단계는 src/classes.js 의 SKILLS.apocalypse
Object.assign(SKILL_FX, {
  apocalypse: {
    pose(u, a) { return bowPullPose(u, a); },
    hit(a) { for (const t of a.targets()) hitFx(t.x, t.y, a.color, 1.2); impact({ stop: 0.04, shake: 0.15 }); },
    kb: 10,
  },
});
