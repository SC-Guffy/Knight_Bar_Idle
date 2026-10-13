'use strict';
// ⑤-0 텍스처 시험 패치 (개발용, 게임 src 는 고치지 않는다). dev/skills.html?patch=vfx-trial 로 불러온다.
// PixelLab 으로 뽑은 시트(dev/vfx-trial/*.png, 가로로 프레임 5칸)를 기존 그리기 함수 대신 그린다:
//  - 근접 평타 잔상 drawCutSmear(사각 칸)      → W1 장검 궤적 (휘두를 때)
//  - 평타 명중 (없던 것)                         → H1 명중 섬광
//  - 강철 베기 초승달 crescentFx(점 찍기)          → C1 초승달 참격
//  - 스킬 타격 hitFx(벡터 방사선) · crescentMarkFx → H1 명중 섬광
// 크기: 시트 1도트 = 캐릭터 몸 도트 = PX/2 게임 px. 색: 명암을 5단으로 나눠 직업 색 램프로 다시 칠한다.
// window.vfxTrial.on(true|false) 로 켜고 끈다 (전후 비교 캡처용).
(function () {
  const DOT = PX / 2;
  const SHEETS = { w1: { frames: 5 }, h1: { frames: 5 }, c1: { frames: 5 } };
  for (const [k, s] of Object.entries(SHEETS)) { s.img = new Image(); s.img.src = '../dev/vfx-trial/' + k + '.png'; }

  // 명암 5단 → 직업 색 램프 (어두운 외곽선은 그대로)
  const cache = new Map();
  function tinted(key, rgb) {
    const id = key + '|' + rgb;
    if (cache.has(id)) return cache.get(id);
    const s = SHEETS[key], img = s.img;
    if (!img.complete || !img.naturalWidth) return null;
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height), p = d.data;
    const [r, gg, b] = rgb.split(',').map(Number), dark = [r * 0.38, gg * 0.38, b * 0.45];
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 24) { p[i + 3] = 0; continue; }
      const l = (0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]) / 255;
      if (l < 0.2) { p[i] = 11; p[i + 1] = 13; p[i + 2] = 20; p[i + 3] = 255; continue; }   // 외곽선 #0b0d14
      const t = Math.round(((l - 0.2) / 0.8) * 4) / 4;                                        // 5단 (0, .25, .5, .75, 1)
      const mix = (a, c, k) => a + (c - a) * k;
      const out = t <= 0.5 ? [0, 1, 2].map((j) => mix(dark[j], [r, gg, b][j], t * 2)) : [0, 1, 2].map((j) => mix([r, gg, b][j], 255, (t - 0.5) * 2));
      p[i] = out[0]; p[i + 1] = out[1]; p[i + 2] = out[2]; p[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    cache.set(id, cv);
    return cv;
  }

  const live = [];   // { key, x, y, t, life, rgb, flip, scale, rot }
  function spawn(key, x, y, life, rgb, o = {}) { live.push({ key, x, y, t: 0, life, rgb, flip: !!o.flip, scale: o.scale || 1, rot: o.rot || 0 }); }
  const hexRgb = (c) => {
    if (!c) return '255,255,255';
    if (c.startsWith('#')) { const n = parseInt(c.slice(1, 7), 16); return `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`; }
    const m = c.match(/(\d+)\D+(\d+)\D+(\d+)/); return m ? `${m[1]},${m[2]},${m[3]}` : '255,255,255';
  };

  function drawLive(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const e = live[i]; e.t += dt;
      if (e.t >= e.life) { live.splice(i, 1); continue; }
      const s = SHEETS[e.key], cv = tinted(e.key, e.rgb); if (!cv) continue;
      const fw = cv.width / s.frames, fh = cv.height, f = Math.min(s.frames - 1, Math.floor(e.t / e.life * s.frames));
      const w = fw * DOT * e.scale, h = fh * DOT * e.scale;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(Math.round(e.x), Math.round(e.y));
      if (e.rot) ctx.rotate(e.rot);
      if (e.flip) ctx.scale(-1, 1);
      ctx.drawImage(cv, f * fw, 0, fw, fh, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  const orig = { drawCutSmear, crescentFx, crescentMarkFx, hitFx, hitMonster, releaseAttack, render };
  let on = false, lastT = null;
  const patched = {
    drawCutSmear() {},                                                    // 사각 칸 잔상 대신 W1 (releaseAttack 에서)
    releaseAttack(st) {
      if (st.kind !== 'ranged') {
        const w = heroWeapon(), f = knight.facing || 1;
        spawn('w1', toScreen(knight.x) + f * 22, groundY() - 28, 0.16, w.trail || '255,255,255', { flip: f < 0 });
      }
      return orig.releaseAttack(st);
    },
    hitMonster(m, mult, o) {
      const r = orig.hitMonster(m, mult, o);
      if (!castOf('hero')) spawn('h1', toScreen(m.x) + rand(-3, 3), groundY() - 22 + rand(-4, 4), 0.2, heroWeapon().trail || '255,255,255');
      return r;
    },
    crescentFx(x, y, r, a0, a1, dir, color, width, life) {
      const k = Math.max(1, Math.round((r * (0.75 + 0.25 * fxVis)) / 22));
      spawn('c1', x + (dir < 0 ? -1 : 1) * r * 0.9, y, Math.max(0.22, life), hexRgb(color), { flip: dir < 0, scale: k });   // 초승달 호는 반지름 r 바깥에 그려지므로 그만큼 앞으로
    },
    crescentMarkFx() {},
    hitFx(x, y, color, pow = 1) { spawn('h1', x, y, 0.2, hexRgb(color), { scale: pow * fxVis >= 2 ? 2 : 1 }); },
    render() {
      orig.render();
      // 시간: step() 으로 진행하면 그 시간(simT), 그냥 재생 중이면 실제 시간, 일시정지면 멈춤
      const T = window.skillTest && skillTest.state, sim = T ? T.simT : 0, real = performance.now() / 1000;
      let dt = 0;
      if (lastT && sim !== lastT.sim) dt = sim - lastT.sim;
      else if (lastT && !(T && T.paused)) dt = Math.min(0.05, real - lastT.real);
      lastT = { sim, real };
      ctx.save(); drawLive(dt); ctx.restore();
    },
  };
  function apply(v) {
    on = v; live.length = 0;
    for (const k of Object.keys(orig)) window[k] = v ? patched[k] : orig[k];
  }
  // skillTest.step 은 1/60 씩 진행하므로 그 시간을 그대로 쓴다
  if (window.skillTest) {
    const step0 = skillTest.step;
    skillTest.state.simT = 0;
    skillTest.step = (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { skillTest.state.simT += 1 / 60; step0(1 / 60); } };
  }
  window.vfxTrial = { on: apply, isOn: () => on, live, tinted, SHEETS };
  apply(true);
  // 재생 줄에 켬/끔 버튼 (T 키도 같음)
  const btn = document.createElement('button');
  const label = () => { btn.textContent = on ? '🧪 텍스처 시험: 켬' : '🧪 텍스처 시험: 끔 (지금 모습)'; btn.classList.toggle('on', on); };
  btn.onclick = () => { apply(!on); label(); };
  window.addEventListener('keydown', (e) => { if (e.key === 't' || e.key === 'T') { apply(!on); label(); } });
  const row = document.getElementById('pause') && document.getElementById('pause').parentElement;
  if (row) row.appendChild(btn);
  label();
})();
