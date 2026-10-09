'use strict';
// 마력 폭발 연출 (mage). 수치·단계는 src/classes.js 의 SKILLS.manaBurst
//  Lv1 「마력탄」 지팡이 끝에 모은 마력을 큰 마력탄 한 발로 쏜다 — 사각 빛알이 꼬리를 끌며 날아가 톡 터진다
//  ★ 「마력 폭발」 적 앞에 마력 구체가 일렁이며 부풀고 — 지팡이를 내밀면 마름모 파문을 남기며 터진다
//  ★★ 「마력 폭풍」 지팡이로 땅을 짚으면 적 발밑에 육망성 마법진이 펼쳐지고, 마력 블록이 두 번 솟구친다
//  ★★★ 「비전 붕괴」 적 머리 위에 기운 비전 고리 셋이 겹쳐 돌며 마력 번개를 두 번 떨구고 — 한 점으로 붕괴해 크게 터진다

const MB_LIGHT = '#e6f6ff';
// 지팡이 끝(구슬) 화면 위치 — world.js heroRig·drawStaff 와 같은 계산 (손 → staffAngle 방향으로 (len + 1.6)칸)
function mbTip(a) {
  const p = castPose(a.owner) || {}, sy = p.sy || 1, k = p.skew || 0;
  const w = WEAPONS[CLASSES[a.cls].weapon] || {}, st = w.staff || { len: 7 };
  const face = p.facing != null ? p.facing : a.dir;
  const ang = staffAngle(p.bowA || 0), L = (st.len + 1.6) * PX;
  const hx = a.px() + face * (5 * PX + Math.round(k * 3 * PX));
  const hy = groundY() - (p.lift || 0) - sprCells(SPR.knightLegs[0]) * PX * sy - 3 * PX;
  return { x: hx + face * Math.cos(ang) * L, y: hy + Math.sin(ang) * L };
}
// 자세 키프레임 [[u, {bowA, pull, dx, lift, skew, sy}]] 사이를 부드럽게 잇는다
function mbKeys(u, keys) {
  let i = 0;
  while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
  const [u0, p0] = keys[i], [u1, p1] = keys[i + 1];
  let s = clamp01((u - u0) / Math.max(1e-4, u1 - u0));
  s = s * s * (3 - 2 * s);
  const out = {};
  for (const [key, d] of [['bowA', 0], ['pull', 0], ['dx', 0], ['lift', 0], ['skew', 0], ['sy', 1]]) out[key] = mix(p0[key] ?? d, p1[key] ?? d, s);
  return out;
}
const MB_POSE = [
  // Lv1: 살짝 들어 모았다가 앞으로 툭 내밀어 쏜다
  [[0, {}], [0.3, { bowA: -0.2, pull: 11, dx: -1.5 }], [0.4, { bowA: 0.68, pull: 0, dx: 2, skew: 0.1 }], [0.7, { bowA: 0.61, dx: 1.5 }], [1, {}]],
  // ★: 높이 들어 구체에 마력을 부어 넣다가, 터지는 순간 적에게 겨눈다
  [[0, {}], [0.35, { bowA: -0.27, pull: 13, dx: -2, sy: 1.04 }], [0.5, { bowA: -0.24, pull: 13, dx: -2, sy: 1.04 }], [0.56, { bowA: 0.71, pull: 3, dx: 2.5, skew: 0.12, sy: 0.96 }], [0.75, { bowA: 0.65, dx: 2, skew: 0.1 }], [1, {}]],
  // ★★: 치켜들었다가 땅을 짚어 마법진 → 다시 들어 → 두 번째 폭발 때 내리꽂는다
  [[0, {}], [0.25, { bowA: -0.38, pull: 12, lift: 2 }], [0.38, { bowA: 1.2, pull: 6, sy: 0.9, skew: 0.12, dx: 1.5 }], [0.5, { bowA: 1.1, pull: 8, sy: 0.95, skew: 0.08, dx: 1 }], [0.63, { bowA: -0.31, pull: 13, lift: 3, sy: 1.04 }], [0.71, { bowA: 0.84, pull: 0, skew: 0.14, dx: 2, sy: 0.93 }], [0.85, { bowA: 0.68, dx: 1.5, skew: 0.08 }], [1, {}]],
  // ★★★: 떠올라 하늘로 지팡이를 세우고 고리에 마력을 붓다가, 붕괴하는 순간 앞으로 내려친다
  [[0, {}], [0.2, { bowA: -0.42, pull: 10, lift: 3, sy: 1.05 }], [0.35, { bowA: -0.36, pull: 13, lift: 5 }], [0.5, { bowA: -0.42, pull: 13, lift: 5 }], [0.76, { bowA: -0.42, pull: 13, lift: 7, skew: -0.1, sy: 1.06 }],
    [0.82, { bowA: 0.84, pull: 0, lift: 2, skew: 0.16, dx: 3, sy: 0.92 }], [0.92, { bowA: 0.74, dx: 2.5, skew: 0.12 }], [1, {}]],
];

// 마름모(45° 돈 사각형) 윤곽 — 마력 폭발의 파문 모양
function mbDiamond(x, y, r, color, width, alpha) {
  if (r < 1 || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.stroke();
  ctx.restore();
}
// 마력 조각: 작은 마름모 파편이 날아가며 떨어진다 (parts 는 사각이라 따로 그린다)
function mbShards(a, x, y, n, speed, life, cols) {
  n = Math.max(2, Math.round(n * fxVis));
  const list = [];
  for (let i = 0; i < n; i++) {
    const an = (i / n) * Math.PI * 2 + rand(-0.3, 0.3), v = speed * rand(0.6, 1);
    list.push({ x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v - speed * 0.25, s: rand(2, 4), c: cols[i % cols.length] });
  }
  let last = 0;
  aFx(a, 0, life, (u) => {
    const dt = Math.max(0, u * life - last); last = u * life;
    ctx.save();
    for (const p of list) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 240 * dt; p.vx *= 1 - 2 * dt;
      const s = p.s * (1 - u * 0.6);
      ctx.globalAlpha = 1 - u;
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s * 0.6, p.y); ctx.lineTo(p.x, p.y + s); ctx.lineTo(p.x - s * 0.6, p.y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  });
}

// ── Lv1: 마력탄 ── 사각 빛알이 잔상 꼬리를 끌며 지팡이 끝에서 대상까지 날아간다
function mbBoltFx(a, life) {
  const s0 = mbTip(a), trail = [];
  aFx(a, 0, life, (u) => {
    const tx = a.tx(), ty = a.ty(), e = easeIn(u) * 0.4 + u * 0.6;
    const x = mix(s0.x, tx, e), y = mix(s0.y, ty, e) - Math.sin(Math.PI * u) * 6;
    trail.push([x, y]); if (trail.length > 6) trail.shift();
    trail.forEach(([px, py], j) => dot(px, py, 2 + j * 0.5, a.color, ((j + 1) / trail.length) * 0.5));
    ctx.save();
    ctx.shadowColor = a.color; ctx.shadowBlur = 8;
    dot(x, y, 7, a.color, 0.85); dot(x, y, 3, '#ffffff');
    ctx.restore();
  });
}

// ── ★: 부풀어 오르는 마력 구체 ── 테두리가 일렁이고 안에서 소용돌이가 돈다. popAt 초에 사라진다 (터짐은 hit)
function mbSphereFx(a, life, popAt) {
  const pos = () => ({ x: a.tx() - a.dir * 8, y: a.ty() - 2 });
  aFx(a, 0, life, (u) => {
    const t = u * life;
    if (t >= popAt) return;
    const g = easeOut(clamp01(t / popAt)), { x, y } = pos();
    const R = 3 + 13 * g + Math.sin(clock * 30) * g;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(x, y, 1, x, y, R * 1.6);
    gr.addColorStop(0, 'rgba(230,246,255,0.75)'); gr.addColorStop(0.55, a.color + '88'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(x - R * 1.6, y - R * 1.6, R * 3.2, R * 3.2);
    // 일렁이는 테두리: 각도마다 반지름이 출렁인다
    for (let i = 0; i < 24; i++) {
      const an = (i / 24) * Math.PI * 2, r = R + Math.sin(an * 3 + clock * 14) * 1.6 * g;
      dot(x + Math.cos(an) * r, y + Math.sin(an) * r, 2, i % 3 ? a.color : '#ffffff', 0.9);
    }
    // 안쪽 소용돌이 두 가닥
    for (let j = 0; j < 2; j++) for (let s = 0; s < 6; s++) {
      const an = clock * 9 + j * Math.PI + s * 0.5, r = R * (0.15 + s * 0.12);
      dot(x + Math.cos(an) * r, y + Math.sin(an) * r, 2, MB_LIGHT, 0.7);
    }
    ctx.restore();
  }, null, (u) => {
    const t = u * life;
    if (t >= popAt - 0.04) return;
    // 지팡이 끝에서 구체로 마력이 흘러 들어간다
    const s = mbTip(a), { x, y } = pos();
    if (Math.random() < 0.8) {
      const k = rand(0, 0.3);
      parts.push({ x: mix(s.x, x, k), y: mix(s.y, y, k), vx: (x - s.x) * 3, vy: (y - s.y) * 3 - 10, g: 0, size: 2, color: Math.random() < 0.5 ? a.color : '#ffffff', life: 0.22, t: 0, add: true });
    }
  });
}
// 구체가 터진다: 하얀 섬광 + 마름모 파문 두 겹 + 마력 조각
function mbPopFx(a, x, y, size) {
  aFx(a, 0, 0.42, (u) => {
    const e = easeOut(u);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - u) * 0.9; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, 12 * size * (1 - u * 0.7), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    mbDiamond(x, y, 8 + 30 * size * e, a.color, 3 * (1 - u) + 1, 1 - u);
    mbDiamond(x, y, 4 + 20 * size * easeOut(clamp01(u * 1.3 - 0.15)), '#ffffff', 1.5, (1 - u) * 0.8);
  });
  mbShards(a, x, y, 10 * size, 150 * size, 0.5, [a.color, '#ffffff', MB_LIGHT]);
}

// ── ★★: 육망성 마법진 ── 땅에 납작하게 펼쳐지는 이중 원 + 두 삼각형 + 둘레를 도는 사각 룬 글자
function mbSigilFx(a, life, flashAt) {
  const cx = a.tx(), gy = groundY() - 2, rx = 30, ry = 7;
  aFx(a, 0, life, (u) => {
    const t = u * life, open = easeOut(clamp01(t / 0.16)), out = u > 0.85 ? (1 - u) / 0.15 : 1;
    const fl = flashAt.reduce((m, f) => Math.max(m, 1 - Math.abs(t - f) / 0.08), 0);
    const k = open * out, R = rx * open, Ry = ry * open;
    if (k <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = k * (0.75 + 0.25 * Math.max(0, fl));
    ctx.strokeStyle = fl > 0 ? '#ffffff' : a.color; ctx.lineWidth = 1.5;
    ctx.shadowColor = a.color; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.ellipse(cx, gy, R, Ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, gy, R * 0.78, Ry * 0.78, 0, 0, Math.PI * 2); ctx.stroke();
    // 두 삼각형(육망성)이 천천히 돈다
    for (let tri = 0; tri < 2; tri++) {
      ctx.beginPath();
      for (let i = 0; i <= 3; i++) {
        const an = clock * 1.2 + tri * Math.PI / 3 + (i / 3) * Math.PI * 2;
        const px = cx + Math.cos(an) * R * 0.78, py = gy + Math.sin(an) * Ry * 0.78;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // 둘레의 룬 글자: 2×3 사각 조각이 거꾸로 돈다
    for (let i = 0; i < 8; i++) {
      const an = -clock * 2 + (i / 8) * Math.PI * 2, px = cx + Math.cos(an) * R * 0.89, py = gy + Math.sin(an) * Ry * 0.89;
      ctx.fillStyle = i % 2 ? '#ffffff' : a.color;
      ctx.fillRect(Math.round(px - 1), Math.round(py - 2), 2, 3);
      if (i % 2) ctx.fillRect(Math.round(px + 1), Math.round(py - 2), 1, 1);
    }
    ctx.restore();
  }, null, (u) => {
    if (Math.random() < 0.5 && u < 0.85) parts.push({ x: cx + rand(-rx, rx) * 0.8, y: gy - 1, vx: 0, vy: rand(-50, -25), g: 0, size: 2, color: Math.random() < 0.5 ? a.color : '#ffffff', life: 0.35, t: 0, add: true });
  });
}
// 마법진에서 마력 블록이 솟구친다: 크고 작은 사각 블록이 기둥처럼 쌓여 올랐다가 위로 흩어진다
function mbEruptFx(a, x, h, w, life) {
  const gy = groundY() - 2, blocks = [];
  const n = Math.round(10 * Math.max(0.6, fxVis) * (w / 20));
  for (let i = 0; i < n; i++) blocks.push({ ox: rand(-w / 2, w / 2), s: Math.random() < 0.3 ? 5 : 3, sp: rand(0.7, 1.2), d: rand(0, 0.25) });
  aFx(a, 0, life, (u) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 기둥 몸통: 가운데가 밝은 세로 띠가 솟았다가 가늘어진다
    const rise = easeOut(clamp01(u / 0.3)), thin = 1 - clamp01((u - 0.3) / 0.7);
    const bw = w * 0.6 * thin, top = gy - h * rise;
    if (bw > 0.5) {
      const gr = ctx.createLinearGradient(x - bw, 0, x + bw, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, a.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.7 * thin; ctx.fillStyle = gr; ctx.fillRect(x - bw, top, bw * 2, gy - top);
      ctx.globalAlpha = thin; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x - 1), top, 2, gy - top);
    }
    for (const b of blocks) {
      const v = clamp01((u - b.d) / (1 - b.d));
      if (v <= 0 || v >= 1) continue;
      const y = gy - h * b.sp * easeOut(v) * 1.1, s = b.s * (1 - v * 0.5);
      ctx.globalAlpha = 1 - v;
      ctx.fillStyle = b.s > 4 ? '#ffffff' : a.color;
      ctx.fillRect(Math.round(x + b.ox * (1 + v * 0.6) - s / 2), Math.round(y - s / 2), Math.round(s), Math.round(s));
    }
    ctx.restore();
  });
}

// ── ★★★: 비전 고리 셋 ── 서로 다르게 기운 고리가 자이로처럼 돌다가 collapseAt 무렵 한 점으로 줄어든다
const MB_RINGS = [{ r: 36, tilt: -0.45, flat: 0.3, sp: 2.6 }, { r: 29, tilt: 0.55, flat: 0.36, sp: -3.2 }, { r: 19, tilt: 0.05, flat: 0.9, sp: 4.1 }];
function mbRingsXY(a) { return { x: a.tx(), y: Math.max(30, a.ty() - 54) }; }
function mbRingsFx(a, life, pulses, collapseAt) {
  const t0 = clock;
  aFx(a, 0, life, (u) => {
    const t = u * life;
    if (t > collapseAt) return;
    const { x, y } = mbRingsXY(a);
    const open = easeOut(clamp01(t / 0.25)), col = easeIn(clamp01((t - (collapseAt - 0.24)) / 0.24));
    const pl = pulses.reduce((m, p) => Math.max(m, 1 - Math.abs(t - p) / 0.1), 0);
    const ph = (clock - t0) * (1 + col * 5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 고리 가운데에 모이는 마력 핵
    const core = 1.5 + 2 * open + 4 * col + 2 * Math.max(0, pl);
    const gr = ctx.createRadialGradient(x, y, 0, x, y, core * 3);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, a.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.globalAlpha = 0.9; ctx.fillRect(x - core * 3, y - core * 3, core * 6, core * 6);
    MB_RINGS.forEach((rg, j) => {
      const R = rg.r * open * (1 - col * 0.92) * (1 + 0.12 * Math.max(0, pl)), N = 36;
      const c = Math.cos(rg.tilt + col * (j - 1) * 1.2), s = Math.sin(rg.tilt + col * (j - 1) * 1.2);
      for (let i = 0; i < N; i++) {
        const an = (i / N) * Math.PI * 2 + ph * rg.sp, lx = Math.cos(an) * R, ly = Math.sin(an) * R * rg.flat;
        const front = Math.sin(an) > 0, glyph = i % 7 === 0;
        dot(x + lx * c - ly * s, y + lx * s + ly * c, glyph ? 3 : 2, glyph || pl > 0.3 ? '#ffffff' : a.color, (front ? 1 : 0.45) * open);
      }
    });
    ctx.restore();
  }, null, (u) => {
    const t = u * life;
    if (t > collapseAt) return;
    const { x, y } = mbRingsXY(a), s = mbTip(a);
    // 지팡이 끝 → 고리로 마력이 실처럼 올라가고, 붕괴가 가까우면 둘레의 빛이 빨려 든다
    if (t < collapseAt - 0.28 && Math.random() < 0.7) {
      const k = rand(0, 0.2);
      parts.push({ x: mix(s.x, x, k), y: mix(s.y, y, k), vx: (x - s.x) * 2.6, vy: (y - s.y) * 2.6, g: 0, size: 2, color: Math.random() < 0.5 ? a.color : '#ffffff', life: 0.3, t: 0, add: true });
    }
    if (t > collapseAt - 0.3) for (let i = 0; i < 3; i++) {
      const an = rand(0, Math.PI * 2), d = rand(30, 55), px = x + Math.cos(an) * d, py = y + Math.sin(an) * d * 0.7;
      parts.push({ x: px, y: py, vx: (x - px) * 4.5, vy: (y - py) * 4.5, g: 0, size: 2, color: Math.random() < 0.6 ? a.color : MB_LIGHT, life: 0.2, t: 0, add: true });
    }
  });
}
// 고리에서 대상으로 떨어지는 마력 번개 (꺾인 선, 매번 모양이 다르다)
function mbZapFx(a, x0, y0, x1, y1) {
  const pts = [[x0, y0]];
  for (let i = 1; i < 6; i++) pts.push([mix(x0, x1, i / 6) + rand(-6, 6), mix(y0, y1, i / 6)]);
  pts.push([x1, y1]);
  aFx(a, 0, 0.16, (u) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1 - u;
    for (const [col, wd] of [[a.color, 4], ['#ffffff', 1.5]]) {
      ctx.strokeStyle = col; ctx.lineWidth = wd * (1 - u * 0.5);
      ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
    }
    ctx.restore();
  });
}
// 비전 붕괴: 한 점에서 터지는 큰 폭발 — 하얀 핵, 겹겹이 퍼지는 마름모, 여덟 갈래 빛살, 땅에 떨어지는 파편
function mbNovaFx(a, x, y) {
  const gy = groundY() - 2;
  aFx(a, 0, 0.7, (u) => {
    const e = easeOut(u);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 핵: 하얗게 커졌다가 줄어든다
    const R = 20 * Math.sin(Math.PI * Math.min(1, u * 1.6));
    if (R > 0.5) {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, R * 2);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, a.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.fillRect(x - R * 2, y - R * 2, R * 4, R * 4);
    }
    // 여덟 갈래 빛살: 사각 도트가 바깥으로 줄지어 달린다
    for (let i = 0; i < 8; i++) {
      const an = (i / 8) * Math.PI * 2 + Math.PI / 8, len = (i % 2 ? 40 : 62) * e;
      for (let s = 0.35; s <= 1; s += 0.13) dot(x + Math.cos(an) * len * s, y + Math.sin(an) * len * s * 0.8, s > 0.9 ? 3 : 2, s > 0.9 ? '#ffffff' : a.color, (1 - u) * s);
    }
    // 땅에 비친 붕괴: 납작한 빛 파문
    ctx.globalAlpha = 0.8 * (1 - u); ctx.strokeStyle = a.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, gy, 14 + 70 * e, 3 + 8 * e, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    for (let j = 0; j < 3; j++) {
      const v = clamp01(u * 1.4 - j * 0.14);
      if (v > 0 && v < 1) mbDiamond(x, y, 10 + (36 + j * 20) * easeOut(v), j === 1 ? '#ffffff' : a.color, 3 * (1 - v) + 0.5, 1 - v);
    }
  });
  mbShards(a, x, y, 22, 210, 0.8, [a.color, '#ffffff', MB_LIGHT, MASTERY_GOLD]);
}

Object.assign(SKILL_FX, {
  manaBurst: {
    pose(u, a) { return mbKeys(u, MB_POSE[a.mast || 0] || MB_POSE[1]); },
    tick(a, u) {
      // 모으는 동안 지팡이 끝으로 마력 알갱이가 빨려 든다 (단계가 높을수록 많이)
      const m = a.mast || 0, h = a.k.hits[0][0];
      if (u > h * 0.9 || Math.random() > 0.35 + 0.15 * m) return;
      const s = mbTip(a), an = rand(0, Math.PI * 2), d = rand(10, 16 + 4 * m);
      parts.push({ x: s.x + Math.cos(an) * d, y: s.y + Math.sin(an) * d, vx: -Math.cos(an) * d * 4, vy: -Math.sin(an) * d * 4, g: 0, size: 2, color: Math.random() < 0.6 ? a.color : '#ffffff', life: 0.24, t: 0, add: true });
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast || 0, H = a.k.hits;
      if (m === 0) return [[0.38, (a) => mbBoltFx(a, Math.max(0.06, (H[0][0] - 0.38) * d))]];
      if (m === 1) return [[0.12, (a) => mbSphereFx(a, d, (H[0][0] - 0.12) * d)]];
      if (m === 2) return [[0.38, (a) => { mbSigilFx(a, d * 0.6, H.map((hh) => (hh[0] - 0.38) * d)); impact({ shake: 0.06 }); }]];
      return [[0.04, (a) => mbRingsFx(a, d, H.slice(0, -1).map((hh) => (hh[0] - 0.04) * d), (H[H.length - 1][0] - 0.04) * d)]];
    },
    hit(a, i, n) {
      const m = a.mast || 0, last = i === n - 1;
      if (m === 0) {
        for (const t of a.targets(i)) mbPopFx(a, t.x, t.y, 0.45);
        impact({ shake: 0.08 });
        return;
      }
      if (m === 1) {
        for (const t of a.targets(i)) mbPopFx(a, t.x - a.dir * 8, t.y - 2, 1);
        impact({ stop: 0.03, shake: 0.16 });
        return;
      }
      if (m === 2) {
        if (!last) { mbEruptFx(a, a.tx(), 46, 20, 0.45); impact({ shake: 0.1 }); return; }
        const xs = a.targets(i).map((t) => t.x);
        if (!xs.length) xs.push(a.tx());
        for (const x of xs) { const main = Math.abs(x - a.tx()) < 4; mbEruptFx(a, x, main ? 70 : 48, main ? 30 : 18, 0.55); }
        mbShards(a, a.tx(), groundY() - 4, 12, 140, 0.5, [a.color, '#ffffff']);
        impact({ stop: 0.04, shake: 0.2 });
        return;
      }
      const { x, y } = mbRingsXY(a);
      if (!last) {
        for (const t of a.targets(i)) mbZapFx(a, x, y + 4, t.x, t.y);
        impact({ shake: 0.08 });
        return;
      }
      mbNovaFx(a, x, y + 10);
      for (const t of a.targets(i)) if (Math.abs(t.x - x) > 20) mbZapFx(a, x, y + 10, t.x, t.y);
      impact({ stop: 0.1, shake: 0.35 });
    },
    // 맞은 자리에 작은 마름모 룬이 잠깐 새겨진다 (화살 긁힌 자국 대신)
    marks(a, t, pow) {
      const s = 4 + 2 * Math.min(2, pow), x = t.x + rand(-5, 5), y = t.y + rand(-7, 5);
      aFx(a, 0, 0.3, (u) => mbDiamond(x, y, s * (0.6 + 0.4 * easeOut(u)), u < 0.3 ? '#ffffff' : a.color, 1.5, 1 - u));
    },
    kb: 10,
  },
});
