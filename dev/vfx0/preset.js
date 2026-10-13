'use strict';
// ⑤-0 실제 게임 확인용 상태 (개발용). 오프라인 게임 페이지(index.html?server=http://127.0.0.1:9)를 열고 8초 뒤 콘솔에서:
//   await new Promise((ok) => { const s = document.createElement('script'); s.src = 'dev/vfx0/preset.js?t=' + Date.now(); s.onload = ok; document.body.appendChild(s); });
//   vfx0Preset('swordsman', 1)      // 직업, 스킬 숙련 단계 0(Lv1)~3(★★★). 'squire' 면 견습 기사 평타만
// 원정을 바로 시작한다. 세이브에 남으니 끝나면 계정을 지우거나 다른 상태로 덮는다.
window.vfx0Preset = (cls = 'swordsman', stage = 1, field = 12) => {
  const LV = [1, 10, 20, 30];
  if (typeof campOpen !== 'undefined' && campOpen) closeCamp();
  S.cls = cls; S.level = 60; S.best = S.stage = field;
  S.train.atk = 25; S.train.hp = 25; S.train.def = 15;
  for (const k of skillsOf(cls)) {
    S.mast[k.id] = skillTomesAt(LV[stage], skillTierOf(k.id));
    const n = {}; let stars = 0;
    for (const tier of skillTreeOf(k)) for (const nd of tier) if (nd.kind === 'star' && stars < stage) { n[nd.id] = 1; stars++; }
    S.tree[k.id] = { n, use: stage };
  }
  S.bag = []; S.phase = 'camp'; S.trip = null; S.stamina = maxStamina();
  monsters = []; shots = []; casts = []; skfx = [];
  Object.assign(knight, { x: toWorld(CAMP_X), swing: -1, pending: false, cds: {}, down: 0 });
  lapReady = false;
  startExpedition();
  save(); renderHud();
  return { cls, stage, phase: S.phase, skills: skillsOf(cls).map((k) => k.id) };
};
