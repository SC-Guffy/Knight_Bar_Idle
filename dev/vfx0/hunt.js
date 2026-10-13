'use strict';
// ⑤-0 진행 손실 측정 (개발용): 실제 게임 루프 update(1/FPS) 를 10분(게임 시간) 돌려 원정 골드를 잰다.
// 오프라인 게임 페이지(index.html?server=http://127.0.0.1:9)를 열고 8초 기다린 뒤 콘솔에서:
//   await new Promise((ok) => { const s = document.createElement('script'); s.src = 'dev/vfx0/hunt.js?t=' + Date.now(); s.onload = ok; document.body.appendChild(s); });
//   await hunt({ cls: 'swordsaint', stage: 3, seed: 1 })     // stage = 스킬 숙련 단계 0(Lv1)~3(★★★)
// 같은 seed 로 옛 코드(퀄업 전)와 새 코드에서 돌려 골드를 비교한다. 난수는 Math.random 을 시드 고정 함수로 바꾼다.
// 그리기(render)는 하지 않는다 — 진행은 update 만 정한다. 히트스톱(게임 정지)으로 멈춘 시간도 함께 센다.
(function () {
  const STAGE_LV = [1, 10, 20, 30];
  function seeded(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // width: 하단바 폭(px). 숨은 탭은 창 폭이 0 이라 월드 길이가 망가지므로 고정한다
  window.hunt = async ({ cls = 'swordsaint', stage = 3, seed = 1, sec = 600, field = 40, width = 1280 } = {}) => {
    const rnd0 = Math.random, W0 = W;
    W = width;
    Math.random = seeded(seed);
    try {
      window.save = () => {};                         // 측정 상태를 세이브에 남기지 않는다
      if (typeof campOpen !== 'undefined' && campOpen && typeof closeCamp === 'function') closeCamp();
      S.cls = cls; S.level = 120; S.best = S.stage = field;
      S.train.atk = 40; S.train.hp = 40; S.train.def = 30;
      for (const k of skillsOf(cls)) {
        S.mast[k.id] = skillTomesAt(STAGE_LV[stage], skillTierOf(k.id));
        const n = {}; let stars = 0;
        for (const tier of skillTreeOf(k)) for (const nd of tier) if (nd.kind === 'star' && stars < stage) { n[nd.id] = 1; stars++; }
        S.tree[k.id] = { n, use: stage };
      }
      S.phase = 'camp'; S.trip = null; S.stamina = 1e9; S.bag = [];   // 가방은 매 프레임 비운다 (가득 차서 돌아가지 않게)
      monsters = []; shots = []; casts = []; skfx = []; parts = []; effects = []; floaters = []; hitstop = 0;
      if (typeof fxHold !== 'undefined') fxHold = 0;
      Object.assign(knight, { x: toWorld(CAMP_X), swing: -1, pending: false, cds: {}, down: 0, combo: 0, atkTimer: 0, fighting: false, dash: null, ward: null });
      lapReady = false;
      startExpedition();
      S.stamina = 1e9;
      const g0 = S.gold, dt = 1 / FPS, n = Math.round(sec / dt);
      let stopT = 0, holdN = 0, kills0 = S.trip.kills, holdPrev = 0;
      for (let i = 0; i < n; i++) {
        if (hitstop > 0) stopT += Math.min(hitstop, dt);
        S.bag.length = 0;
        update(dt);
        if (typeof fxHold !== 'undefined') { if (fxHold > holdPrev + 1e-6) holdN++; holdPrev = fxHold; }
        if (S.phase !== 'expedition') { S.stamina = 1e9; S.phase = 'camp'; startExpedition(); }
      }
      return { cls, stage, seed, gold: Math.round(S.gold - g0), kills: S.trip.kills - kills0, stageNow: S.stage, gameStopSec: +stopT.toFixed(2), visHolds: holdN };
    } finally { Math.random = rnd0; W = W0; }
  };
})();
