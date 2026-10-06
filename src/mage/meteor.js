'use strict';
// 메테오 연출 (pyromancer). 수치·단계는 src/classes.js 의 SKILLS.meteor
Object.assign(SKILL_FX, {
  meteor: {
    pose(u, a) { return bowPullPose(u, a); },
    hit(a) { for (const t of a.targets()) hitFx(t.x, t.y, a.color, 1.2); impact({ stop: 0.04, shake: 0.15 }); },
    kb: 10,
  },
});
