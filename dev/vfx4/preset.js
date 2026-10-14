'use strict';
// ⑤-4 실제 게임 확인용 상태 (개발용). 오프라인 게임 페이지(index.html?server=http://127.0.0.1:9)를 열고 8초 뒤 콘솔에서:
//   await new Promise((ok) => { const s = document.createElement('script'); s.src = 'dev/vfx4/preset.js?t=' + Date.now(); s.onload = ok; document.body.appendChild(s); });
//   vfx4Preset('tyrant', 3)     // 성기사 paladin · 검성 blademaster · 대검전사 greatswordsman · 성좌기사 archon · 검신 swordsaint · 파천검왕 tyrant
// ⑤-0 의 vfx0Preset 을 쓰되, 3차 궁극기(레벨 100)가 열리도록 레벨을 올리고 스테이지를 조금 더 깊게 잡는다.
window.vfx4Preset = async (cls = 'paladin', stage = 3, field = 20) => {
  if (typeof vfx0Preset === 'undefined') await new Promise((ok) => { const s = document.createElement('script'); s.src = 'dev/vfx0/preset.js?t=' + Date.now(); s.onload = ok; document.body.appendChild(s); });
  const r = vfx0Preset(cls, stage, field);
  S.level = 120; save(); renderHud();
  return { ...r, level: S.level };
};
