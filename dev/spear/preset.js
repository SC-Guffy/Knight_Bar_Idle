'use strict';
// 창기사 계열 통짜 시트 실제 게임 확인용 상태 (개발용, docs/specs/legacy-class-sheets.md).
// 오프라인 게임(index.html?server=http://127.0.0.1:9)을 열고 약 8초 뒤 콘솔에서:
//   await new Promise((ok) => { const s = document.createElement('script'); s.src = 'dev/spear/preset.js?t=' + Date.now(); s.onload = ok; document.body.appendChild(s); });
//   spearPreset('dragoon')            // 직업 (lancer·dragoon·halberdier·cavalier·dragonlord·warlord·skyGeneral), 숙련 단계 0~3, 필드 스테이지
//   spearPreset('warlord', 3, 30)     // ★★★, 스테이지 30
//   SHEET_ON.dragoon = false          // 바로 예전 조립식으로 (전후 비교). 주소에 &sheets=0 이면 전부 꺼진다
// 그 직업으로 바로 전직한 기사(1차 Lv30 · 2차 Lv75 · 3차 Lv110, 스킬 전부 해금)로 원정을 바로 시작한다. 세이브에 남는다.
window.spearPreset = (cls = 'dragoon', stage = 1, field = 12) => {
  const LV = [1, 10, 20, 30], tier = CLASSES[cls].tier;
  if (typeof campOpen !== 'undefined' && campOpen) closeCamp();
  S.cls = cls; S.level = [1, 30, 75, 110][tier]; S.best = Math.max(S.best, field); S.stage = field;
  S.train.atk = 25; S.train.hp = 25; S.train.def = 15;
  for (const k of skillsOf(cls)) {
    S.mast[k.id] = skillTomesAt(LV[stage], skillTierOf(k.id));
    const n = {}; let stars = 0;
    for (const t of skillTreeOf(k)) for (const nd of t) if (nd.kind === 'star' && stars < stage) { n[nd.id] = 1; stars++; }
    S.tree[k.id] = { n, use: stage };
  }
  S.bag = []; S.phase = 'camp'; S.trip = null; S.stamina = maxStamina();
  monsters = []; shots = []; casts = []; skfx = [];
  Object.assign(knight, { x: toWorld(CAMP_X), swing: -1, pending: false, cds: {}, down: 0 });
  lapReady = false;
  startExpedition();
  save(); renderHud();
  return { cls, stage, level: S.level, sheet: heroSheetOn(cls), skills: skillsOf(cls).map((k) => k.id) };
};
