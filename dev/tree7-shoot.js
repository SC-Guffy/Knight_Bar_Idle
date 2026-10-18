'use strict';
// 시즌7 트리 새 스킬 연출 캡처 (검수용, docs/specs/skill-tree-all.md "연출"). 스킬 시뮬레이터(dev/skills.html) 콘솔에 이 파일 내용을 붙여 넣고:
//   await T7SHOOT(T7JOBS())              → 15줄기 × 새 스킬 7 × (1칸·★★★) + 바탕 스킬 ★★★ 띠 PNG 250장
//   await T7SHOOT([{ name, cls, id, st, mods: ['a_grow'] }])   → 하나씩 (mods = 변형 노드)
// 띠: 시전 직후부터 0.2초 간격 10장, 기사 기준 440×240 자르기. 받는 쪽: python -I dev/shot-recv.py dev/shots (127.0.0.1:8798) → dev/shots/<name>.png
// 시뮬레이터 시간은 window.skillTest.step 으로 직접 민다 (숨은 창에서도 같은 장면).
window.T7SHOOT = async (jobs, { n = 10, dt = 0.2, w = 440, h = 240, pre = 0.05 } = {}) => {
  const t = window.skillTest, cv = document.getElementById('c'), out = [];
  for (const j of jobs) {
    try {
      t.setClass(j.cls); t.state.skill = j.id; t.state.lock = true; t.setStage(j.st);
      for (const m of j.mods || []) S.t7.rk[m] = 1;
      t.step(0.8); t.cast(j.id); const ok = !!castOf('hero'); t.step(pre);
      const kx = toScreen(knight.x);
      const sx = Math.max(0, Math.min(cv.width - w, kx - 90)), sy = Math.max(0, cv.height - h);
      const strip = document.createElement('canvas'); strip.width = w * n + (n - 1) * 4; strip.height = h;
      const g = strip.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#111420'; g.fillRect(0, 0, strip.width, h);
      for (let i = 0; i < n; i++) { t.step(dt); g.drawImage(cv, sx, sy, w, h, i * (w + 4), 0, w, h); }
      const r = await fetch('http://127.0.0.1:8798/save?name=' + encodeURIComponent(j.name), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: strip.toDataURL('image/png') });
      out.push(j.name + (ok ? '' : ' NOCAST') + (r.ok ? '' : ' FAIL'));
    } catch (e) { out.push(j.name + ' ERR ' + String(e).slice(0, 160)); }
  }
  return out;
};
window.T7JOBS = (lines = Object.keys(T7_LINES)) => {
  const jobs = [], seen = new Set(), SLOTS = ['whirl', 'flash', 'wave', 'storm', 'f_ab', 'f_bk', 'f_ak'];
  for (const id of lines) { const L = T7_LINES[id]; for (const slot of SLOTS) for (const st of [0, 3]) jobs.push({ name: `t7-${L.id}-${slot}-${st}`, cls: L.cls[2], id: L.sk[slot], st }); }
  for (const id of lines) { const L = T7_LINES[id]; for (const slot of SLOTS) { const b = SKILLS[L.sk[slot]].t7base; if (seen.has(L.id + b)) continue; seen.add(L.id + b); jobs.push({ name: `base-${L.id}-${b}`, cls: L.cls[2], id: b, st: 3 }); } }
  return jobs;
};
