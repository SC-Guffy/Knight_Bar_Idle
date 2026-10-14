'use strict';
// VFX 텍스처 (docs/specs/skill-vfx.md "공통 개선 후보"·⑤-0): 이펙트 그림은 PixelLab 으로 뽑은 스프라이트 시트로 그린다.
// 코드는 위치·크기·회전·타이밍·색 램프만 맡는다.
//  시트: src/vfx/<id>.png, 프레임을 가로로 이어 붙인 한 장. 불러올 때 명암을 5단 램프로 정리(양자화)해 두고,
//        그릴 때 직업 색 램프 [직업색×0.4 → 직업색 → 흰색] 으로 다시 칠한다. 밝기 0.2 미만은 몸 외곽선 색 #0b0d14.
//  크기: 1도트 = 캐릭터 몸 도트 = PX/2 = 게임 1.5px. 배율은 2/3·1·4/3·2 (화면 배율 2배에서 기기 2·3·4·6px = 정수) 만 쓴다. nearest.
//  연출 정지(fxHold): 평타 명중·스킬 잔타는 화면 그림만 잠깐 멈춘다 — render() 가 마지막 화면을 그대로 둔다.
//        게임 시간(update: 전투·건설·타이머)은 그대로 흐른다. 게임 정지(hitstop)는 스킬 막타·궁극기에만 쓴다.

const VFX_DOT = PX / 2;
const VFX_SCALES = [2 / 3, 1, 4 / 3, 2];
// 시트 목록. 번호는 스펙 텍스처 목록과 같다 (W 무기 궤적 · H 평타 명중 · E 스킬 본체 · K 스킬 명중)
const VFX_SHEETS = {
  w1: { frames: 5 },     // W1 장검 휘두르기 궤적 — 키 그림(0번) 한 장만 쓰고 코드로 재생한다
  w2: { frames: 1 },     // W2 장검 찌르기 줄 (키 그림 한 장)
  h01: { frames: 4, scale: 2 / 3 },   // H01 견습 기사 평타 명중: 짧은 사선 + 양끝 불티 (스펙 24도트 → 32도트 시트를 2/3 로)
  h02: { frames: 5, scale: 2 / 3 },   // H02 검사 평타 명중: 별 섬광 + 교차 검흔 (⑤-0 시험 H1). 1배는 맞은 대상 얼굴을 다 가려서 2/3
  e43: { frames: 5 },    // E43 강철 베기 초승달 참격파 (⑤-0 시험 C1)
  c17: { frames: 5 },    // C17 시전 오라: 속이 빈 불꽃 테두리 루프 (40종 공용, 기사 뒤에 바닥 기준)
  c18: { frames: 5 },    // C18 발밑 빛 고리 루프 48×16 (64×32 로 뽑아 nearest 로 납작하게). ★★ 이상, ★★★ 는 금빛 고리를 한 겹 더
  k01: { frames: 5 },    // K01 강철 베기 명중: 땅 위 충격선(20번째 줄) + 아래 균열 + 강철 파편 3조각 (v2, 바닥 기준)
};
// 무기 → 평타 궤적 시트 (휘두르기, 찌르기). 직업 → 평타 명중 시트. 없으면 예전 그림
const VFX_WEAPON = { sword: ['w1', 'w2'], knightSword: ['w1', 'w2'] };
const VFX_BASIC_HIT = { squire: 'h01', swordsman: 'h02' };

const vfxBase = (() => {
  const s = typeof document !== 'undefined' && document.currentScript && document.currentScript.src;
  return s ? s.replace(/[^/]*$/, '') + 'vfx/' : 'src/vfx/';
})();
// 시트를 등록하고 불러온다. 계열 패치 파일(src/vfx-*.js)도 이것으로 자기 시트를 더한다
function vfxRegister(sheets) {
  for (const [id, s] of Object.entries(sheets)) {
    VFX_SHEETS[id] = s;
    if (typeof Image === 'undefined') continue;
    s.img = new Image();
    s.img.onload = () => vfxQuantize(s);
    s.img.src = vfxBase + id + '.png';
  }
}
vfxRegister({ ...VFX_SHEETS });
const vfxAddSheets = vfxRegister;   // ⑤-1 src/vfx-mage.js 가 쓰는 이름

// 램프 양자화: 픽셀마다 0 = 빈칸, 1 = 외곽선, 2~6 = 밝기 5단 (0·.25·.5·.75·1). 시트에 soft 가 있으면 어두운 픽셀도 2단으로
function vfxQuantize(s) {
  const img = s.img, w = img.naturalWidth, h = img.naturalHeight;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
  const p = g.getImageData(0, 0, w, h).data, lv = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (p[i * 4 + 3] < 24) continue;
    const l = (0.3 * p[i * 4] + 0.59 * p[i * 4 + 1] + 0.11 * p[i * 4 + 2]) / 255;
    // 외곽선(1)은 거의 무채색인 아주 어두운 픽셀만. 짙은 빨강·갈색처럼 색이 있는 어두운 픽셀(불꽃 꼬리·흙)은 램프의 가장 어두운 단(2)
    const r = p[i * 4], gg = p[i * 4 + 1], b = p[i * 4 + 2], ink = Math.max(r, gg, b) < 48 && Math.max(r, gg, b) - Math.min(r, gg, b) < 28;
    lv[i] = l < 0.2 ? (s.soft || !ink ? 2 : 1) : 2 + Math.round(((l - 0.2) / 0.8) * 4);   // soft: 연기처럼 어두운 덩어리가 큰 시트는 외곽선색 대신 램프의 가장 어두운 단
  }
  // 화면을 거의 채우는 그림(밤하늘 배경 등)은 외곽선이 없으니 건드리지 않는다
  let filled = 0;
  for (let i = 0; i < w * h; i++) if (lv[i]) filled++;
  if (filled < w * h * 0.6) vfxStripOutline(lv, w, h, s.frames, p);
  Object.assign(s, { w, h, fw: w / s.frames, lv, tint: new Map(), src: p });
  // 볼록한 쪽 방향 (0번 프레임의 불투명 픽셀 무게중심 − 테두리 상자 중심). 궤적을 돌릴 때 볼록한 쪽이 칼끝을 보게 한다
  let n = 0, sx = 0, sy = 0, x0 = s.fw, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < s.fw; x++) if (lv[y * w + x]) { n++; sx += x; sy += y; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  s.bulge = n ? Math.atan2(sy / n - (y0 + y1) / 2, sx / n - (x0 + x1) / 2) : 0;
}

// 검은 외곽선·지저분한 파티클 걷어 내기 (2026-10-15 사용자: "검은색 아웃라인 들어간 지저분한 파티클은 싫다").
//  ① 바깥 외곽선: 어두운 픽셀(lv 1) 중 빈칸·그림 가장자리에서 어두운 픽셀만 밟아 닿는 것은 지운다 (두꺼운 외곽선도 한 번에).
//  ② 그림 안쪽에 남은 어두운 픽셀은 검정이 아니라 램프의 가장 어두운 단(2)으로 올린다.
//  ③ 외곽선을 벗긴 뒤 홀로 떨어진 1픽셀 점은 지운다. 프레임 경계를 넘어 이어 보지 않는다.
function vfxStripOutline(lv, w, h, frames, p) {
  const fw = w / (frames || 1), q = [];
  const fx = (i) => Math.floor((i % w) / fw);
  for (let i = 0; i < w * h; i++) {
    if (lv[i] !== 1) continue;
    const x = i % w, y = (i / w) | 0, f = fx(i);
    const edge = x === f * fw || x === (f + 1) * fw - 1 || y === 0 || y === h - 1
      || (x > 0 && fx(i - 1) === f && !lv[i - 1]) || (x < w - 1 && fx(i + 1) === f && !lv[i + 1])
      || (y > 0 && !lv[i - w]) || (y < h - 1 && !lv[i + w]);
    if (edge) { lv[i] = 0; q.push(i); }
  }
  while (q.length) {
    const i = q.pop(), x = i % w, f = fx(i);
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j < 0 || j >= w * h || lv[j] !== 1 || fx(j) !== f) continue;
      lv[j] = 0; q.push(j);
    }
  }
  // 안쪽에 남은 검은 픽셀: 둘레 색(검정 아닌 이웃들의 평균)으로 메워 얼룩 없이 덩어리에 녹인다
  for (let i = 0; i < w * h; i++) {
    if (lv[i] !== 1) continue;
    const x = i % w; let n = 0, r = 0, g = 0, b = 0;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j < 0 || j >= w * h || lv[j] < 2) continue;
      n++; r += p[j * 4]; g += p[j * 4 + 1]; b += p[j * 4 + 2];
    }
    lv[i] = 2;
    if (n) { p[i * 4] = r / n; p[i * 4 + 1] = g / n; p[i * 4 + 2] = b / n; }
  }
  for (let i = 0; i < w * h; i++) {
    if (!lv[i]) continue;
    const x = i % w, f = fx(i);
    let alone = true;
    for (let dy = -1; dy <= 1 && alone; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, j = i + dy * w + dx;
      if (xx < 0 || xx >= w || j < 0 || j >= w * h || fx(j) !== f) continue;
      if (lv[j]) { alone = false; break; }
    }
    if (alone) lv[i] = 0;
  }
}

// 'r,g,b' · '#rrggbb' · 'rgb(a)(…)' → [r, g, b]
function vfxRgb(c) {
  if (Array.isArray(c)) return c;
  if (!c) return [255, 255, 255];
  if (c[0] === '#') { const n = parseInt(c.slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  const m = String(c).match(/(\d+)\D+(\d+)\D+(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : [255, 255, 255];
}
// 직업 색으로 다시 칠한 시트 (색마다 한 번 만들어 둔다). 아직 안 불러왔으면 null
//  color: 직업 색 하나 → 램프 [색×0.4 → 색 → 흰색] / 'raw' → 시트의 원래 색 그대로 (불·연기·쇠가 섞인 폭발, 화살처럼
//         여러 색이 한 그림에 있어야 하는 것. 밝기 0.2 미만은 똑같이 외곽선 색) / [[r,g,b] × 5] → 그 램프 (어두운 쪽부터)
//  cpu: 기사 보조 캔버스(willReadFrequently = CPU 캔버스, world.js drawHero)에 그릴 사본. GPU 캔버스를 CPU 캔버스에 그리면
//       매번 GPU 에서 읽어 와 프레임이 몇 ms 씩 늘어난다 (⑤-0 fps 측정에서 확인)
//  color 가 색 5개 배열이면 그대로 램프 [어두움 → 밝음] 으로 쓴다 (불: 검붉음 → 주황 → 노랑 → 흰빛처럼 색상이 바뀌는 램프)
function vfxSheet(id, color, cpu = false) {
  const s = VFX_SHEETS[id];
  if (!s || !s.lv) return null;
  // color: 직업색 하나 | 'raw'(시트 원래 색) | 램프 배열 [어두움 → 밝음] ([r,g,b] 배열들 또는 '#rrggbb' 5개 — 불처럼 색상이 바뀌는 램프)
  const custom = Array.isArray(color) && (Array.isArray(color[0]) || color.length === 5), raw = color === 'raw';
  const rgb = raw || custom ? null : vfxRgb(color), key = (raw ? 'raw' : custom ? color.join('|') : rgb.join(',')) + (cpu ? '|cpu' : '');
  if (s.tint.has(key)) return s.tint.get(key);
  let ramp = [[11, 13, 20]];
  if (custom) ramp = ramp.concat(color.map(vfxRgb));
  else if (rgb) {
    const dark = [rgb[0] * 0.38, rgb[1] * 0.38, rgb[2] * 0.45];
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      ramp.push(t <= 0.5 ? dark.map((d, j) => d + (rgb[j] - d) * t * 2) : rgb.map((c, j) => c + (255 - c) * (t - 0.5) * 2));
    }
  }
  const cv = document.createElement('canvas'); cv.width = s.w; cv.height = s.h;
  const g = cv.getContext('2d', cpu ? { willReadFrequently: true } : undefined), d = g.createImageData(s.w, s.h), p = d.data;
  for (let i = 0; i < s.lv.length; i++) {
    const v = s.lv[i];
    if (!v) continue;
    const c = raw && v > 1 ? [s.src[i * 4], s.src[i * 4 + 1], s.src[i * 4 + 2]] : ramp[v - 1];
    p[i * 4] = c[0]; p[i * 4 + 1] = c[1]; p[i * 4 + 2] = c[2]; p[i * 4 + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  s.tint.set(key, cv);
  return cv;
}

// 프레임 하나를 g 의 지금 좌표계에 그린다. o: { scale 배율, rot 회전, flip 좌우, flipY 상하, sx·sy 늘림, alpha, anchor 'c' 가운데 | 'b' 아래 가운데,
//   crop [u0, u1] 프레임의 가로 일부만 (넓은 시트의 한 토막, 0~1) }
function vfxDraw(g, id, color, f, x, y, o = {}) {
  const s = VFX_SHEETS[id], cv = vfxSheet(id, color, g !== ctx && typeof heroSoft !== 'undefined' && g === heroSoft.g);
  if (!cv) return false;
  const c0 = o.crop ? Math.round(o.crop[0] * s.fw) : 0, cw = o.crop ? Math.max(1, Math.round(o.crop[1] * s.fw) - c0) : s.fw;
  const sc = (o.scale || 1) * VFX_DOT, w = cw * sc * (o.sx || 1), h = s.h * sc * (o.sy || 1);
  g.save();
  g.imageSmoothingEnabled = false;
  if (o.alpha != null) g.globalAlpha *= o.alpha;
  g.translate(Math.round(x), Math.round(y));
  if (o.rot) g.rotate(o.rot);
  if (o.flip || o.flipY) g.scale(o.flip ? -1 : 1, o.flipY ? -1 : 1);
  g.drawImage(cv, Math.max(0, Math.min(s.frames - 1, f)) * s.fw + c0, 0, cw, s.h, -w / 2, o.anchor === 'b' ? -h : -h / 2, w, h);
  g.restore();
  return true;
}

// 시트 애니메이션을 한 번 재생한다 (스킬 이펙트 목록 skfx 에 얹는다 → 히트스톱·연출 정지와 같이 멈춘다)
//  o: vfxDraw 옵션 + { life 초, delay, frames 쓸 프레임 수(앞에서부터), fade 마지막 몇 할 동안 흐려짐, move(u) → [dx, dy] }
function texFx(id, x, y, color, o = {}) {
  const life = o.life || 0.25, n = Math.min(o.frames || 99, VFX_SHEETS[id] ? VFX_SHEETS[id].frames : 1), fade = o.fade == null ? 0.3 : o.fade;
  skFx(null, o.delay || 0, life, (u) => {
    const f = Math.min(n - 1, Math.floor(u * n)), mv = o.move ? o.move(u) : [0, 0];
    const al = u > 1 - fade ? (1 - u) / fade : 1;
    vfxDraw(ctx, id, color, f, x + mv[0], y + mv[1], { ...o, alpha: (o.alpha == null ? 1 : o.alpha) * al });
  });
}

// ───────── 연출 정지 ─────────
let fxHold = 0;              // 남은 연출 정지(초). update 가 게임 dt 로 줄인다 (히트스톱 중에도)
let fxHoldShown = true;      // 정지가 걸린 프레임(맞는 순간)은 한 번 그린 뒤 멈춘다
// stop: 스펙 기준표의 stop 값 (impact 와 같게 ×1.3). 프레임 사이에 끝나 안 보이는 일이 없게 반 프레임을 더한다
function visStop(stop) {
  if (!(stop > 0)) return;
  const sec = stop * 1.3 + 0.5 / FPS;
  if (sec > fxHold) { fxHold = sec; fxHoldShown = false; }
}
function fxHoldTick(dt) { fxHold = Math.max(0, fxHold - dt); }
// render() 첫 줄: true 면 이번 프레임은 그리지 않는다 (캔버스에 마지막 화면이 남는다)
function fxHoldSkip() {
  if (fxHold <= 0) return false;
  if (!fxHoldShown) { fxHoldShown = true; return false; }
  return true;
}

// ───────── 평타 ─────────
// 근접 잔상 (world.js drawCutSmear 가 먼저 부른다). 텍스처가 있는 무기면 그리고 true.
//  휘두르기: 손(h1)에서 칼끝 쪽 62% 지점에 W 키 그림을 얇게(세로 60%), 볼록한 쪽이 칼끝을 보게. 올려베기는 상하를 뒤집는다
//  찌르기(tipOnly): 칼끝 앞에 찌르기 줄을 칼 방향으로
//  내 기사(drawKnight)면 그린 자리를 게임 좌표계로 기억해 두었다가, 명중 순간 같은 자리에서 늘이며 사라지게 한다 (vfxBasicRelease)
const vfxCut = { main: false, T: null, last: null };
function vfxSmear(g, w, h0, a0, h1, a1, len, tipOnly) {
  const ids = VFX_WEAPON[w.id], id = ids && ids[tipOnly ? 1 : 0], s = id && VFX_SHEETS[id];
  if (!s || !s.lv) return false;
  const L = len * PX, rgb = w.trail || '255,255,255';
  let p;
  if (tipOnly) p = { id, x: h1[0] + Math.cos(a1) * L * 0.8, y: h1[1] + Math.sin(a1) * L * 0.8, rot: a1, flipY: false };
  else {
    const am = (a0 + a1) / 2;
    p = { id, x: h1[0] + Math.cos(am) * L * 0.62, y: h1[1] + Math.sin(am) * L * 0.62, rot: am - s.bulge, flipY: a1 < a0, spin: a1 < a0 ? -1 : 1 };
  }
  vfxSmearDraw(g, p, rgb, 'thin', 0);
  if (vfxCut.main && vfxCut.T) {
    const off = g === ctx ? [0, 0] : heroSoft.off || [0, 0];
    const Q = vfxCut.T.inverse().multiply(new DOMMatrix([1, 0, 0, 1, off[0], off[1]])).multiply(g.getTransform());
    vfxCut.last = { p, rgb, Q, at: clock };
  }
  return true;
}
// 한 장을 상태에 맞춰 그린다. thin: 휘두르는 중 / fade: 명중 뒤 4단계로 늘이며 흐려지고 조금 더 돈다 (q = 0~1)
function vfxSmearDraw(g, p, rgb, mode, q) {
  if (p.draw) return p.draw(g, rgb, mode, q);                 // 무기 계열 파일이 자기 그리기를 준 잔상 (src/vfx-spear.js 장병기)
  const tip = p.id === 'w2';
  const o = { scale: tip ? 1 : VFX_SHEETS[p.id].smear || 2 / 3, rot: p.rot, flipY: p.flipY };
  if (mode === 'thin') { o.sy = tip ? 1 : 0.6; o.alpha = 0.95; }
  else { o.sx = 1 + (tip ? 0.35 : 0.18) * q; o.sy = 1 - 0.25 * q; o.rot += tip ? 0 : 0.18 * q * (p.spin || 1); o.alpha = 1 - 0.75 * q; }
  if (p.flat) { o.sy = mode === 'thin' ? 0.3 : 0.45 * (1 - 0.25 * q); o.rot = 0; }   // 대검 수평 휩쓸기: 호를 위아래로 납작하게 (src/vfx-sword.js)
  // 휘두르기는 회전한 뒤 상하 반전 (볼록한 축 기준) — vfxDraw 의 회전 → 반전 순서와 맞추려고 각도를 되돌려 넣는다
  if (o.flipY && !tip) { o.rot = p.rot + VFX_SHEETS[p.id].bulge * 2; }
  vfxDraw(g, p.id, rgb, 0, p.x, p.y, o);
}
// releaseAttack(근접): 마지막 잔상 자리에서 키 그림이 0.12초 동안 늘어나며 사라진다
function vfxBasicRelease() {
  const c = vfxCut.last;
  vfxCut.last = null;
  if (!c || clock - c.at > 0.3) return;
  skFx(null, 0, 0.12, (u) => {
    const Q = c.Q;
    ctx.save();
    ctx.transform(Q.a, Q.b, Q.c, Q.d, Q.e, Q.f);
    vfxSmearDraw(ctx, c.p, c.rgb, 'fade', Math.min(3, Math.floor(u * 4)) / 3);
    ctx.restore();
  });
}
// 평타가 맞았다 (원정·탑·던전의 내 기사): 직업 명중 그림 + 연출 정지 (치명이면 더 길게 + 약한 흔들림)
//  ranged: 원거리 착탄 — 날아온 쪽(기사 쪽)을 향해 대상 가운데에. 시트의 color 가 있으면 그 색('raw' 등), 없으면 무기 색
//  VFX_BASIC_HIT 값이 함수면 그 직업이 직접 그린다: fn(m, crit, ranged)
function vfxBasicHit(m, crit, ranged) {
  const id = VFX_BASIC_HIT[S.cls];
  if (typeof id === 'function') { if (!m.killed) id(m, crit, ranged); }   // 직업이 직접 그린다 (⑤-1 마법사 계열 src/vfx-mage.js)
  else if (id && ranged && VFX_SHEETS[id] && !m.killed) {
    const s = VFX_SHEETS[id], f = knight.facing || 1, x = toScreen(m.x) + m.kb - f * (s.back || 3) + rand(-1, 1), y = Math.max(monsterTop(m) + 14, monsterMidY(m)) + rand(-2, 3);   // 얼굴을 가리지 않게 몸통에
    texFx(id, x, y, s.color || heroWeapon().trail || heroWeapon().arrow.color, { life: s.life || 0.2, scale: crit ? ((s.scale || 1) < 1 ? 1 : 4 / 3) : s.scale || 1, fade: 0.3, flip: f < 0 });
  } else if (id && !ranged && VFX_SHEETS[id] && !m.killed) {   // 아직 시트가 없는 직업(예: 파이터 xh2~xh5)은 건너뛴다
    // 대상 가운데에서 칼끝 쪽(기사 쪽)으로 조금, 얼굴보다 아래(몸통)에 — 얼굴을 가리지 않게
    const x = toScreen(m.x) + m.kb - (knight.facing || 1) * 5 + rand(-2, 2), y = Math.max(monsterTop(m) + 14, monsterMidY(m)) + rand(-2, 2);
    const sc = crit ? 1 : VFX_SHEETS[id].scale || 1;                // 치명은 1배 (평소 2/3)
    texFx(id, x, y, heroWeapon().trail || '255,255,255', { life: id === 'h01' ? 0.16 : 0.2, scale: sc, fade: 0.25, flip: Math.random() < 0.5 });
  }
  let stop = ranged ? (crit ? 0.03 : 0) : crit ? 0.05 : 0.025;
  if (stats().aspd >= 2) stop /= 2;                 // 공속이 빠르면 끊겨 보이지 않게 절반
  visStop(stop);
  if (crit && !ranged) { shake = Math.max(shake, 0.08); shakeAmp = Math.max(shakeAmp, 3.6); }
}

// 원거리 무기 텍스처 (계열 패치가 채운다, 예: src/vfx-mage.js). VFX_RANGED[무기 id] = {
//   proj(sh) 투사체 (world.js drawProjectile 이 먼저 부른다 — ⑤-3 의 vfxProjectile(VFX_PROJ) 보다 앞) · arc(x0, y0, x1, y1, life, delay) 맞은 적에서 번지는 줄 · flash(g, x, y, u) 쏘는 순간 무기 끝 섬광 }
//  그렸으면 true, 없으면 예전 그림
const VFX_RANGED = {};
function vfxRangedProj(sh) { const f = VFX_RANGED[sh.w.id]; return !!(f && f.proj && f.proj(sh)); }
function vfxShotArc(w, x0, y0, x1, y1, life, delay = 0) { const f = VFX_RANGED[w.id]; return !!(f && f.arc && f.arc(x0, y0, x1, y1, life, delay)); }
function vfxCastFlash(g, w, x, y, u) { const f = VFX_RANGED[w.id]; return !!(f && f.flash && f.flash(g, x, y, u)); }
// 화면 크기 px 에 가장 가까운 허용 배율 (시트가 dots 도트일 때). 크기가 계속 변하는 연출도 배율은 계단으로만 바뀐다
function vfxFit(px, dots, scales = VFX_SCALES) {
  let best = scales[0];
  for (const k of scales) if (Math.abs(k * dots * VFX_DOT - px) < Math.abs(best * dots * VFX_DOT - px)) best = k;
  return best;
}

// ───────── 시전 오라 (공용, skills.js drawAuras 가 부른다) ─────────
// 숙련 ★ 부터: C17 불꽃 테두리 (★ 2/3배·흐리게, ★★ 이상 1배). ★★ 부터 발밑 C18 룬 고리, ★★★ 는 바깥에 금빛 고리 한 겹 더.
// k: 시전 진행에 따른 세기(0~1, 켜졌다 꺼짐). 루프는 초당 10프레임, 시전마다 시작 프레임을 달리한다
function vfxAura(x, y, gy, mast, color, k, seed = 0) {
  if (!mast || k <= 0.02) return;
  const f = Math.floor(clock * 10 + seed) % 5, t2 = mast >= 2;
  vfxDraw(ctx, 'c17', color, f, x, y, { anchor: 'b', scale: t2 ? 1 : 2 / 3, alpha: (t2 ? 0.8 : 0.55) * k });
  if (!t2) return;
  if (mast >= 3) vfxDraw(ctx, 'c18', MASTERY_GOLD, (f + 2) % 5, x, gy, { scale: 1, alpha: 0.55 * k, flip: true });
  vfxDraw(ctx, 'c18', color, f, x, gy, { scale: 2 / 3, alpha: 0.85 * k });
}
