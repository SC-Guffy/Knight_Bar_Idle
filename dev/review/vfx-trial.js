'use strict';
// ⑤-0 텍스처 시험 패치 (개발용, 게임 src 는 고치지 않는다). dev/skills.html?patch=vfx-trial 로 불러온다.
// PixelLab 으로 뽑은 시트(dev/vfx-trial/*.png, 가로로 프레임 5칸)를 기존 그리기 함수 대신 그린다:
//  - 근접 평타 잔상 drawCutSmear(사각 칸)      → W1 키 그림 한 장 (v2: 손·휘두르는 각도에 맞춰 얇게, 명중 뒤 늘이기·감쇠·회전 3~4프레임)
//  - 평타 명중 (없던 것)                         → H1 명중 섬광 (PixelLab 애니 5프레임)
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
  function spawn(key, x, y, life, rgb, o = {}) { live.push({ key, x, y, t: 0, life, rgb, flip: !!o.flip, scale: o.scale || 1, rot: o.rot || 0, proc: o.proc, spin: o.spin }); }

  // W1 키 그림의 볼록한 쪽 방향 (불투명 픽셀 무게중심 - 테두리 상자 중심). 회전할 때 볼록한 쪽이 칼끝 방향을 보게 맞춘다
  let w1Base = null;
  function w1BaseAngle() {
    if (w1Base != null) return w1Base;
    const img = SHEETS.w1.img; if (!img.complete || !img.naturalWidth) return 0;
    const fw = img.naturalWidth / SHEETS.w1.frames, fh = img.naturalHeight, cv = document.createElement('canvas'); cv.width = fw; cv.height = fh;
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, fw, fh).data;
    let n = 0, sx = 0, sy = 0, x0 = fw, y0 = fh, x1 = 0, y1 = 0;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (d[(y * fw + x) * 4 + 3] > 24) { n++; sx += x; sy += y; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    w1Base = n ? Math.atan2(sy / n - (y0 + y1) / 2, sx / n - (x0 + x1) / 2) : 0;
    return w1Base;
  }
  const W1_SCALE = 2 / 3;   // 검흔 크기: 시트 1도트 = 게임 1px (캐릭터 도트 1.5px 의 2/3). 화면 배율 2배에서 기기 2px = 정수라 도트가 깨지지 않는다
  const hexRgb = (c) => {
    if (!c) return '255,255,255';
    if (c.startsWith('#')) { const n = parseInt(c.slice(1, 7), 16); return `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`; }
    const m = c.match(/(\d+)\D+(\d+)\D+(\d+)/); return m ? `${m[1]},${m[2]},${m[3]}` : '255,255,255';
  };

  function drawLive(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const e = live[i]; e.t += dt;
      if (e.t >= e.life) { live.splice(i, 1); continue; }
      const sk = e.key === 'w1key' ? 'w1' : e.key;
      const s = SHEETS[sk], cv = tinted(sk, e.rgb); if (!cv) continue;
      const fw = cv.width / s.frames, fh = cv.height;
      let f = Math.min(s.frames - 1, Math.floor(e.t / e.life * s.frames)), sx = 1, sy = 1, rot = e.rot || 0, al = 1;
      if (e.key === 'w1key') {
        // 키 그림(0번 프레임) 한 장만 쓴다. 휘두르는 중: 얇게 / 명중 뒤: 3~4단계로 늘이며 흐려지고 조금 더 돈다
        f = 0;
        if (e.proc === 'thin') { sy = 0.6; al = 0.95; }
        else { const q = Math.min(3, Math.floor(e.t / e.life * 4)) / 3; sx = 1 + 0.18 * q; sy = 1 - 0.25 * q; rot += 0.18 * q * (e.spin || 1); al = 1 - 0.75 * q; }
      }
      const w = fw * DOT * e.scale * sx, h = fh * DOT * e.scale * sy;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = al;
      ctx.translate(Math.round(e.x), Math.round(e.y));
      if (rot) ctx.rotate(rot);
      if (e.flip) ctx.scale(-1, 1);
      ctx.drawImage(cv, f * fw, 0, fw, fh, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  const orig = { drawHero, drawCutSmear, crescentFx, crescentMarkFx, hitFx, hitMonster, releaseAttack, render };
  let heroBox = null, lastSmear = null;
  let on = false, lastT = null;
  const patched = {
    // 기사는 작은 보조 캔버스에 그린 뒤 화면에 붙인다 (world.js drawHero). 잔상 함수 안 좌표를 화면 좌표로 되돌리려고 그 오프셋을 기록한다
    drawHero(g, id, x, gy, pose) {
      const T = g.getTransform();
      if (pose.tint || pose.onlyWeapon || pose.flash) heroBox = { bx: 0, by: 0, T, direct: true };
      else {
        const dxa = Math.abs(pose.dx || 0), lift = Math.max(0, pose.lift || 0);
        const P = [[x - 100 - dxa, gy - 150 - lift], [x + 100 + dxa, gy - 150 - lift], [x - 100 - dxa, gy + 12], [x + 100 + dxa, gy + 12]];
        heroBox = { bx: Math.floor(Math.min(...P.map(([u, v]) => T.a * u + T.c * v + T.e))), by: Math.floor(Math.min(...P.map(([u, v]) => T.b * u + T.d * v + T.f))), T };
      }
      return orig.drawHero(g, id, x, gy, pose);
    },
    // 사각 칸 잔상 대신: 손(h1)에서 칼끝 쪽으로 칼 길이의 62% 지점에 W1 키 그림을 얇게, 볼록한 쪽이 칼끝을 보게
    drawCutSmear(g, w, h0, a0, h1, a1, len) {
      if (!heroBox) return;
      const M = g.getTransform(), off = heroBox.direct || g === ctx ? [0, 0] : [heroBox.bx, heroBox.by], Ti = heroBox.T.inverse();
      const toGame = (px, py) => { const dx = M.a * px + M.c * py + M.e + off[0], dy = M.b * px + M.d * py + M.f + off[1]; return [Ti.a * dx + Ti.c * dy + Ti.e, Ti.b * dx + Ti.d * dy + Ti.f]; };
      const L = len * 2 * (PX / 2), am = (a0 + a1) / 2;
      const c = toGame(h1[0] + Math.cos(am) * L * 0.62, h1[1] + Math.sin(am) * L * 0.62), tip = toGame(h1[0] + Math.cos(am) * L, h1[1] + Math.sin(am) * L);
      const ang = Math.atan2(tip[1] - c[1], tip[0] - c[0]), spin = Math.sign((a1 - a0) * (M.a * M.d - M.b * M.c)) || 1;
      lastSmear = { x: c[0], y: c[1], rot: ang - w1BaseAngle(), spin, rgb: w.trail || '255,255,255' };
      spawn('w1key', c[0], c[1], 0.02, lastSmear.rgb, { rot: lastSmear.rot, scale: W1_SCALE, proc: 'thin' });
    },
    // 명중 순간: 마지막 잔상 자리에서 키 그림이 늘어나며 흐려진다 (4단계, 0.12초)
    releaseAttack(st) {
      if (st.kind !== 'ranged' && lastSmear) spawn('w1key', lastSmear.x, lastSmear.y, 0.12, lastSmear.rgb, { rot: lastSmear.rot, scale: W1_SCALE, proc: 'fade', spin: lastSmear.spin });
      lastSmear = null;
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
