// VFX 빈 곳 점검 측정 (2026-10-16, docs/specs/skill-vfx.md "빈 곳 채우기 계획")
// dev/skills.html 을 연 뒤 콘솔에서:
//   await new Promise((ok) => { const s = document.createElement('script'); s.src = 'review/vfx-gaps-probe.js?t=' + Date.now(); s.onload = ok; document.body.appendChild(s); });
//   gapProbe.run(['swordsman', 'paladin'])   // 직업 몇 개씩 (한 번에 20초 안쪽), 결과는 gapProbe.out 에 쌓인다
//   gapProbe.table()                         // 스킬 × 단계: T[쓴 시트] fr=fillRect v=벡터 g=gradient MISS=안 그려진 시트
// 평소 화면(시전 안 함) 60프레임을 빼고 남은 프레임당 그리기 수다. 시트 이름 뒤 * 는 QI_TEX_FALLBACK 대체 그림.
window.gapProbe = (() => {
  const T = skillTest.state; T.paused = true; T.auto = false; T.basic = false;
  const P = CanvasRenderingContext2D.prototype, C = { on: false };
  const keys = ['arc', 'ellipse', 'createRadialGradient', 'createLinearGradient', 'fillRect', 'stroke', 'fill', 'lineTo', 'drawImage', 'quadraticCurveTo', 'bezierCurveTo'];
  let cnt = {}, ids = {}, miss = {};
  for (const k of keys) { const o = P[k]; P[k] = function (...a) { if (C.on) cnt[k] = (cnt[k] || 0) + 1; return o.apply(this, a); }; }
  const ovd = window.vfxDraw;
  window.vfxDraw = function (g, id, ...r) { const res = ovd.call(this, g, id, ...r); if (C.on) { ids[id] = (ids[id] || 0) + 1; if (res === false) miss[id] = 1; } return res; };
  function rec(frames, castId) {
    cnt = {}; ids = {}; miss = {}; C.on = true;
    if (castId) skillTest.cast(castId);
    for (let i = 0; i < frames; i++) skillTest.step(1 / 60);
    C.on = false;
    return { cnt, ids, miss };
  }
  const out = {};
  function doClass(cls) {
    skillTest.setClass(cls); T.auto = false; T.basic = false;
    const base = rec(60).cnt, per = {};
    for (const k in base) per[k] = base[k] / 60;
    out[cls] = {};
    for (const k of classSkillsOf(cls)) for (let st = 0; st < 4; st++) {
      skillTest.setClass(cls); skillTest.setStage(st); T.auto = false; T.basic = false; skillTest.step(0.3);
      const ka = skillAt(k.id, 30, st), fr = Math.round(((ka.dur || 1) + 1.2 + (ka.ward ? ka.ward.dur : 0)) * 60);
      let r; try { r = rec(fr, k.id); } catch (e) { r = { err: String(e), cnt: {}, ids: {}, miss: {} }; }
      const ex = {};
      for (const kk of keys) { const v = (r.cnt[kk] || 0) - (per[kk] || 0) * fr; if (Math.abs(v) > 0.5) ex[kk] = Math.round((v / fr) * 10) / 10; }
      (out[cls][k.id] ||= [])[st] = { ex, ids: r.ids, miss: r.miss, err: r.err };
    }
  }
  function table() {
    const alias = typeof QI_TEX_FALLBACK === 'undefined' ? [] : Object.entries(QI_TEX_FALLBACK).filter(([a, b]) => VFX_SHEETS[a] === VFX_SHEETS[b]).map(([a]) => a);
    const rows = [];
    for (const [cls, o] of Object.entries(out)) for (const [id, sts] of Object.entries(o)) rows.push([cls, id, ...sts.map((s) => {
      const e = s.ex, v = Math.round(((e.arc || 0) + (e.ellipse || 0) + (e.stroke || 0) + (e.lineTo || 0) / 4 + (e.quadraticCurveTo || 0) + (e.bezierCurveTo || 0)) * 10) / 10;
      const g = Math.round(((e.createRadialGradient || 0) + (e.createLinearGradient || 0)) * 10) / 10;
      return `${s.err ? 'ERR ' : ''}T[${Object.keys(s.ids).map((i) => (alias.includes(i) ? i + '*' : i)).join(',')}] fr=${e.fillRect || 0} v=${v} g=${g}${Object.keys(s.miss).length ? ' MISS=' + Object.keys(s.miss) : ''}`;
    })].join(' | '));
    return rows.join('\n');
  }
  return { run: (list) => list.forEach(doClass), table, out };
})();
