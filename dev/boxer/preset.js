'use strict';
// 파이터 계열 실제 게임 확인용 상태 (개발용, docs/specs/boxer-class.md "확인 방법").
// 오프라인 게임(index.html?server=http://127.0.0.1:9)을 열고 약 8초 뒤 콘솔에서:
//   await new Promise((ok) => { const s = document.createElement('script'); s.src = 'dev/boxer/preset.js?t=' + Date.now(); s.onload = ok; document.body.appendChild(s); });
//   boxerPreset('striker')          // 직업 (fighter·striker·kickboxer·qigong·champion·tempest·grandmaster), 숙련 단계 0~3, 필드 스테이지
//   boxerPreset('kickboxer', 2, 30) // ★★ 모습, 스테이지 30 (무리가 많은 곳)
// 그 직업으로 바로 전직한 기사(1차 Lv30 · 2차 Lv75 · 3차 Lv110, 스킬 전부 해금)로 원정을 바로 시작한다.
// 기 게이지 막대는 체력바 위 스킬 칸 아래. 시전 기록은 qiSt().log, 지금 기는 qiSt().v · 투지는 qiSt().tj.
//   boxerWatch()  — 0.5초마다 기·투지·시전을 콘솔에 찍는다 (boxerWatch(false) 로 끔)
// 세이브에 남으니 끝나면 다른 상태로 덮거나 계정을 지운다.
window.boxerPreset = (cls = 'fighter', stage = 1, field = 12) => {
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
  Object.assign(knight, { x: toWorld(CAMP_X), swing: -1, pending: false, cds: {}, down: 0, qi: null });
  lapReady = false;
  startExpedition();
  save(); renderHud();
  return { cls, stage, level: S.level, skills: skillsOf(cls).map((k) => `${k.id}(${qiIsMain(k.id, cls) ? '주 기술' : '투지'} ${qiCostOf(k, cls)})`) };
};
let boxerTimer = null;
window.boxerWatch = (on = true) => {
  clearInterval(boxerTimer);
  if (!on) return 'off';
  let seen = 0;
  boxerTimer = setInterval(() => {
    if (!qiOn()) return;
    const q = qiSt(), log = q.log.slice(seen);
    seen = q.log.length;
    console.log(`기 ${q.v.toFixed(1)} · 투지 ${JSON.stringify(Object.fromEntries(Object.entries(q.tj).map(([k, v]) => [k, Math.round(v)])))}${q.aw > 0 ? ` · 각성 ${q.aw.toFixed(1)}초` : ''} · 교전 ${knight.fighting ? 'O' : 'X'}${log.length ? ' · 시전 ' + log.map((e) => `${e.id}${e.mul > 1 ? '(3단)' : ''}`).join(', ') : ''}`);
  }, 500);
  return 'on';
};
