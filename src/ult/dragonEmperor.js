'use strict';
// 3차 궁극기 「용황 강림」 연출 (dragonlord). 수치·단계는 src/classes.js 의 SKILLS.dragonEmperor, 공통 레터박스·컷인은 src/skills.js 의 drawUltScreen.
//  Lv1 「흑룡 소환」 창을 하늘로 치켜들면 하단바가 보랏빛으로 가라앉고, 검은 용 한 마리가 뒤에서 날아와 적에게 불을 뿜으며 지나가다
//                  머리 위에서 불덩이를 내리꽂는다
//  ★ 「용황 강림」 하늘이 가로로 찢어져 빛이 새고, 그 틈에서 거대한 용황이 쏟아져 내려와 하단바를 휘감아 날며 땅을 불태운 뒤
//                  적에게 머리부터 내리꽂힌다 (불기둥)
//  ★★ 「쌍룡 강림」 용황 둘이 양쪽 끝에서 마주 날아와 교차하며 불을 쏟는다 — 하단바 전체가 불바다가 되고, 둘이 X 자로 내리꽂힌다
//  ★★★ 「용신의 심판」 하단바보다 큰 용신의 눈이 하늘에 뜨고, 눈길이 닿는 곳마다 불똥이 떨어진다 — 하단바의 빛을 빨아들인 눈동자가
//                  가늘어지는 순간 하늘에서 숨결이 내리꽂혀 땅 전체가 분홍빛 용암으로 녹아내린다
// 용은 경로를 따라 마디를 이어 그린다: 머리가 지나간 길(dePath)을 몸 길이만큼 거슬러 올라가 마디를 놓는다(deBody)
// 그림은 PixelLab 시트 (src/vfx-spear.js vfxDragon): 용황·쌍룡 = F08 머리 + 몸통 마디, 흑룡 = E15 머리 + 마디 (용추락과 같은 용).
//  숨결·불꽃 줄 E17 (용의 숨결과 같은 불꽃) · 불덩이 폭발·명중 K32 · ★★★ 용신의 눈 배경 F09

const DE_PAL = {
  // 흑룡: 검은 몸, 분홍 불꽃 갈기
  black: { out: '#030106', body: '#1a0e26', dark: '#0b0612', scale: '#3e2456', belly: '#5e2e70', mane: '#ff4dd2', mane2: '#7a1a62', horn: '#d8c8e8', eye: '#ff4dd2' },
  // 용황: 자홍빛 몸, 금빛 배·뿔
  emperor: { out: '#1c0628', body: '#7e1a8a', dark: '#4a0f58', scale: '#d23cb0', belly: '#ffd27a', mane: '#ff9fe8', mane2: '#ff4dd2', horn: '#fff0c0', eye: '#ffe066' },
  // 쌍룡의 둘째: 보랏빛 몸, 흰 갈기
  violet: { out: '#0e0626', body: '#4c28b8', dark: '#2a1470', scale: '#a688ff', belly: '#d8ccff', mane: '#e8dcff', mane2: '#9a5cff', horn: '#f6f0ff', eye: '#ffe066' },
};
const DE_FIRE = ['#8a1f6a', '#ff4dd2', '#ff9fe8', '#ffffff'];
// 팔레트 → 시트 (머리·마디)와 다시 칠할 색
const DE_TEX = { black: ['e15h', 'e15s', '#6a3a8a'], emperor: ['f08h', 'f08s', '#e04cc0'], violet: ['f08h', 'f08s', '#9a7cff'] };
const DE_FIRE_V = ['#4a1aa0', '#a46cff', '#e0c8ff', '#ffffff'];

// 키프레임 [[t, x, y], ...] 을 매끄럽게 잇는 경로 (Catmull-Rom). 범위 밖은 양끝 방향으로 곧게 늘인다
function dePath(keys) {
  const n = keys.length;
  const lin = (p, q, t) => { const k = (t - p[0]) / (q[0] - p[0]); return { x: p[1] + (q[1] - p[1]) * k, y: p[2] + (q[2] - p[2]) * k }; };
  return (t) => {
    if (t <= keys[0][0]) return lin(keys[0], keys[1], t);
    if (t >= keys[n - 1][0]) return lin(keys[n - 2], keys[n - 1], t);
    let i = 0;
    while (keys[i + 1][0] < t) i++;
    const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(n - 1, i + 2)];
    const dt = p2[0] - p1[0], s = (t - p1[0]) / dt, s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    const tan = (a, b, j) => ((b[j] - a[j]) / Math.max(1e-6, b[0] - a[0])) * dt;
    return {
      x: h00 * p1[1] + h10 * tan(p0, p2, 1) + h01 * p2[1] + h11 * tan(p1, p3, 1),
      y: h00 * p1[2] + h10 * tan(p0, p2, 2) + h01 * p2[2] + h11 * tan(p1, p3, 2),
    };
  };
}
// 머리가 지나온 길을 거슬러 올라가며 몸 길이 L 을 N 마디로 나눈 점들 (머리 → 꼬리). 빠르게 날든 느리게 날든 몸 길이는 같다
function deBody(path, t, L, N) {
  const gap = L / N, pts = [path(t)];
  let prev = pts[0], acc = 0, tt = t;
  for (let it = 0; it < 1600 && pts.length <= N; it++) {
    tt -= 1 / 240;
    const p = path(tt);
    let fx = prev.x, fy = prev.y, seg = Math.hypot(p.x - fx, p.y - fy);
    while (seg > 1e-6 && acc + seg >= gap && pts.length <= N) {
      const k = (gap - acc) / seg;
      fx += (p.x - fx) * k; fy += (p.y - fy) * k;
      pts.push({ x: fx, y: fy });
      seg = Math.hypot(p.x - fx, p.y - fy); acc = 0;
    }
    acc += seg; prev = p;
  }
  return pts;
}
function deCircle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill(); }
function dePoly(pts) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); }

// 용 한 마리: pts 머리→꼬리, o = { r 굵기, pal, open 입 벌림(시트는 벌린 입 한 장), side 등 쪽(오른쪽으로 나는 용은 -1), alpha }
function deDragon(pts, o) {
  const T = DE_TEX[Object.keys(DE_PAL).find((k) => DE_PAL[k] === o.pal) || 'emperor'];
  vfxDragon(pts, { head: T[0], seg: T[1], color: T[2], r: o.r, side: o.side, alpha: o.alpha });
}
// 입의 화면 위치 (머리 앞쪽)
function deMouth(pts, R) {
  const a = pts[0], b = pts[1] || a, l = Math.hypot(a.x - b.x, a.y - b.y) || 1, k = R / 6.5;
  return { x: a.x + (a.x - b.x) / l * 18 * k, y: a.y + (a.y - b.y) / l * 18 * k + 1.5 * k };
}

// 화염 숨결: (x0,y0)에서 (x1,y1)까지 넓어지는 불꽃 원뿔(E17)을 늘여 돌린다. w1: 끝 반폭(px)
function deBreath(x0, y0, x1, y1, w0, w1, alpha, fire = DE_FIRE) {
  const S = VFX_SHEETS.e17;
  if (alpha <= 0 || !S) return;
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  vfxDraw(ctx, 'e17', fire[1], vfxLoop('e17', 14), (x0 + x1) / 2, (y0 + y1) / 2, { rot: Math.atan2(dy, dx), sx: L / (S.fw * VFX_DOT), sy: Math.max(0.5, (w1 * 2.2) / (S.h * VFX_DOT)), alpha });
}
// 숨결 원뿔을 따라 불티가 흩어진다
function deBreathParts(x0, y0, x1, y1, n, fire = DE_FIRE) {
  for (let i = 0; i < n; i++) {
    const s = Math.random(), x = mix(x0, x1, s), y = mix(y0, y1, s);
    parts.push({ x, y, vx: (x1 - x0) * rand(0.4, 1) + rand(-40, 40), vy: (y1 - y0) * rand(0.4, 1) + rand(-40, 20), g: -40, size: Math.random() < 0.35 ? 3 : 2, color: fire[1 + (i % 3)], life: rand(0.2, 0.4), t: 0, add: true });
  }
}
// 땅을 따라 넘실대는 불꽃 줄 (x0~x1, 높이 hgt): 위로 세운 불꽃 원뿔(E17)을 촘촘히 늘어세운다 — 장마다 프레임·높이를 엇갈린다
function deFireRow(x0, x1, hgt, alpha, fire = DE_FIRE, seed = 0) {
  if (x1 < x0) [x0, x1] = [x1, x0];
  x0 = Math.max(-8, x0); x1 = Math.min(W + 8, x1);
  const S = VFX_SHEETS.e17;
  if (x1 - x0 < 2 || hgt < 1 || alpha <= 0 || !S) return;
  const gy = groundY() - 2, fw = S.fw * VFX_DOT, step = 16;
  for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
    const ph = x * 0.37 + seed, h = hgt * (1.6 + 0.4 * Math.sin(clock * 11 + ph));
    vfxDraw(ctx, 'e17', fire[1], (Math.floor(clock * 12 + ph) % 5 + 5) % 5, x, gy - h / 2, { rot: -Math.PI / 2, sx: h / fw, sy: 0.45, alpha: alpha * 0.9 });
  }
}
// 불덩이 폭발(K32 분홍 용염 폭발): 바닥 기준, size 1 = 보통. 불티는 보조
function deBlast(a, x, size, fire = DE_FIRE, life = 0.8) {
  const gy = groundY() - 2, sc = size >= 2 ? 2 : size >= 1.3 ? 4 / 3 : 1;
  texFx('k32', x, gy + 4, fire[1], { anchor: 'b', scale: sc, life: life * 0.7, fade: 0.35 });
  for (let j = 0; j < Math.round(12 * size); j++) {
    const ang = rand(-Math.PI, 0), v = rand(80, 260) * Math.sqrt(size);
    parts.push({ x: x + rand(-8, 8), y: gy - 10, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, g: 260, size: 2, color: fire[1 + (j % 3)], life: rand(0.4, 0.8), t: 0, add: true });
  }
}
// 공용 타이밍
const deDur = (a) => (a.k ? a.k.dur : 2.8);
const deHitT = (a) => (a.k ? a.k.hits.map((h) => h[0] * a.k.dur) : [2.5]);
// 창끝 (하늘로 치켜든 창의 끝)
function deTip(a) { const g = gripOf(a); return { x: g.x + Math.cos(g.ang) * 34, y: g.y + Math.sin(g.ang) * 34 }; }
// 기사 앞쪽으로 s 만큼 떨어진 화면 x
const deFwd = (a, s) => a.x() + a.dir * s;
// 뒤쪽 화면 끝 · 앞쪽 화면 끝 (화면 밖 여유 m)
const deBackEdge = (a, m = 0) => (a.dir > 0 ? -m : W + m);
const deFrontEdge = (a, m = 0) => (a.dir > 0 ? W + m : -m);
// from~to 사이에서 1, 들어올 때 fin 초 · 나갈 때 fout 초 동안 부드럽게
const deEnv = (t, from, to, fin, fout) => Math.min(clamp01((t - from) / fin), clamp01((to - t) / fout));

// ── Lv1 흑룡 소환 ──
function deStage0(a) {
  const D = deDur(a), ht = deHitT(a), tf = ht[ht.length - 1], d = a.dir, life = D + 0.4;
  const tx0 = a.tx(), xa = deBackEdge(a, 160), xb = deFrontEdge(a, 420);
  const path = dePath([[0.6, xa, 30], [1.0, a.x() - d * 20, 48], [1.45, mix(a.x(), tx0, 0.5), 62], [tf - 0.1, tx0 - d * 12, 34], [tf + 0.5, xb, 20]]);
  const R = 9, L = 250, b0 = ht[0] - 0.12, b1 = ht[ht.length - 2] + 0.08;
  // 하늘이 보랏빛으로 가라앉고, 흑룡이 지나간다
  backFx(a, 0, life, (u) => {
    const t = u * life;
    dimBand(0.42 * deEnv(t, 0.2, D + 0.2, 0.5, 0.4), '14,0,22');
    if (t < 0.55) return;
    const pts = deBody(path, t, L, 34), br = (t > b0 && t < b1) || (t > tf - 0.2 && t < tf);
    deDragon(pts, { r: R, pal: DE_PAL.black, open: br ? 1 : 0.15, side: -d, alpha: Math.min(1, (t - 0.55) / 0.15) });
  });
  // 앞 레이어: 창끝 신호, 적에게 뿜는 불길, 불타는 땅
  aFx(a, 0, life, (u) => {
    const t = u * life;
    if (t > 0.45 && t < 0.8) {
      const tip = deTip(a), k = 1 - segU(t, 0.45, 0.8);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = k; ctx.fillStyle = '#ff4dd2'; ctx.fillRect(tip.x - 2, 0, 4, tip.y);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(tip.x - 0.5, 0, 1, tip.y);
      ctx.restore();
    }
    const tx = a.tx();
    if (t > b0 && t < b1) {
      const m = deMouth(deBody(path, t, L, 34), R);
      deBreath(m.x, m.y, tx, groundY() - 16, 3, 16, deEnv(t, b0, b1, 0.08, 0.1));
    }
    if (t > ht[0]) deFireRow(tx - 26, tx + 26, 12 * Math.min(1, (t - ht[0]) / 0.2), deEnv(t, ht[0], life, 0.1, 0.35), DE_FIRE, 1);
  }, null, (u) => {
    const t = u * life;
    if (t > b0 && t < b1) { const m = deMouth(deBody(path, t, L, 34), R); deBreathParts(m.x, m.y, a.tx(), groundY() - 16, 2); }
  });
  // 마무리: 머리 위에서 불덩이를 내리꽂는다
  const m0 = deMouth(deBody(path, tf - 0.16, L, 34), R);
  aFx(a, tf - 0.16, 0.16, (u) => {
    const m = m0, x = mix(m.x, a.tx(), easeIn(u)), y = mix(m.y, groundY() - 14, easeIn(u));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#ff4dd2'; ctx.lineWidth = 7; ctx.globalAlpha = 0.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(x, y); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = '#ff9fe8'; deCircle(x, y, 8); ctx.fillStyle = '#ffffff'; deCircle(x, y, 4);
    ctx.restore();
  });
}

// ── ★ 용황 강림 ──
// 하늘의 틈: 하단바 위쪽을 가로지르는 들쭉날쭉한 균열이 벌어지며 새하얀 빛이 새고, 빛살이 땅까지 쏟아진다
function deRift(a, life, openFrom, openTo, closeAt) {
  const pts = [];
  backFx(a, 0, life, (u) => {
    const t = u * life, w = W + 40;
    if (!pts.length || pts.w !== w) { pts.length = 0; pts.w = w; for (let x = -20; x <= w; x += 22) pts.push([x, rand(-5, 5), rand(0.6, 1.3)]); }
    const o = easeOut(segU(t, openFrom, openTo)) * (t > closeAt ? Math.max(0, 1 - (t - closeAt) / 0.35) : 1);
    if (o <= 0) return;
    const y = 30;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const x = ((i + 0.5) / 9) * W + Math.sin(clock * 0.8 + i) * 20, w0 = 10 + (i % 3) * 6;
      ctx.globalAlpha = 0.1 * o;
      ctx.fillStyle = '#ff9fe8';
      dePoly([[x - w0, y], [x + w0, y], [x + w0 * 2.6 + 20, groundY()], [x - w0 * 2.6 + 20, groundY()]]);
    }
    ctx.globalAlpha = 0.5 * o;
    const g = ctx.createLinearGradient(0, y - 24, 0, y + 30);
    g.addColorStop(0, 'rgba(255,77,210,0)'); g.addColorStop(0.45, 'rgba(255,77,210,0.8)'); g.addColorStop(1, 'rgba(255,77,210,0)');
    ctx.fillStyle = g; ctx.fillRect(-20, y - 24, W + 40, 54);
    ctx.globalCompositeOperation = 'source-over';
    for (const [col, sc] of [['#3a0f4a', 1.6], ['#ffd0f4', 1], ['#ffffff', 0.45]]) {
      ctx.globalAlpha = o; ctx.fillStyle = col;
      ctx.beginPath();
      pts.forEach(([x, dy, k], i) => { const yy = y + dy - 7 * o * k * sc; i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); });
      for (let i = pts.length - 1; i >= 0; i--) { const [x, dy, k] = pts[i]; ctx.lineTo(x, y + dy + 6 * o * (2 - k) * sc); }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }, null, (u) => {
    const t = u * life;
    if (t < openFrom || t > closeAt || Math.random() > 0.6) return;
    // 깨진 하늘 조각이 떨어진다
    parts.push({ x: rand(0, W), y: 32, vx: rand(-20, 20), vy: rand(20, 80), g: 240, size: Math.random() < 0.4 ? 4 : 3, color: Math.random() < 0.5 ? '#3a0f4a' : '#ff9fe8', life: rand(0.5, 0.9), t: 0 });
  });
}
function deStage1(a) {
  const D = deDur(a), ht = deHitT(a), tf = ht[ht.length - 1], d = a.dir, life = D + 0.4, gy = groundY();
  const tx0 = a.tx(), xBack = Math.max(40, Math.min(220, Math.abs(a.x() - deBackEdge(a)) - 30));
  const xFront = Math.abs(deFrontEdge(a) - a.x()) - 50;
  const f = (s) => deFwd(a, s);
  // 틈에서 쏟아져 내려와 → 낮게 앞으로 휩쓸고 → 앞쪽 끝에서 솟아 하늘을 되돌아오다 → 적에게 머리부터 내리꽂힌다
  const path = dePath([
    [0.75, f(-xBack), -140], [1.05, f(-xBack * 0.8), 40], [1.3, f(-xBack * 0.2), 104], [1.7, f(xFront * 0.55), 100],
    [1.98, f(xFront), 62], [2.16, f(xFront * 0.82), 24], [2.34, f(mix(xFront, (tx0 - a.x()) * d, 0.5)), 26],
    [tf, tx0, gy + 6], [tf + 0.3, tx0 + d * 40, gy + 260],
  ]);
  const R = 12, L = Math.max(300, Math.min(620, W * 0.5)), N = 46;
  let fireFrom = null, fireTo = null;
  backFx(a, 0, life, (u) => { dimBand(0.55 * deEnv(u * life, 0.15, D + 0.25, 0.5, 0.4), '14,0,22'); });
  deRift(a, life, 0.45, 0.95, tf + 0.1);
  backFx(a, 0, life, (u) => {
    const t = u * life;
    if (t < 0.7) return;
    deDragon(deBody(path, t, L, N), { r: R, pal: DE_PAL.emperor, open: t > 1.15 && t < tf ? 1 : 0.2, side: -d });
  });
  aFx(a, 0, life, (u) => {
    const t = u * life;
    if (fireFrom != null) deFireRow(fireFrom, fireTo, (t < tf ? 18 : 18 + 20 * deEnv(t, tf, life, 0.05, 0.4)), deEnv(t, 0, life, 0.01, 0.45), DE_FIRE, 3);
    if (t > 1.15 && t < 2.4) {
      const m = deMouth(deBody(path, t, L, N), R);
      deBreath(m.x, m.y, m.x + d * 30, gy - 8, 4, 22, deEnv(t, 1.15, 2.4, 0.1, 0.12));
    }
  }, null, (u) => {
    const t = u * life;
    if (t > 1.15 && t < 2.4) {
      const m = deMouth(deBody(path, t, L, N), R), ex = m.x + d * 30;
      if (fireFrom == null) { fireFrom = ex; fireTo = ex; }
      fireFrom = Math.min(fireFrom, ex); fireTo = Math.max(fireTo, ex);
      deBreathParts(m.x, m.y, ex, gy - 8, 3);
    }
  });
}

// ── ★★ 쌍룡 강림 ──
function deStage2(a) {
  const D = deDur(a), ht = deHitT(a), tf = ht[ht.length - 1], d = a.dir, life = D + 0.4, gy = groundY();
  const tx0 = a.tx(), xs = [deBackEdge(a, 140), deFrontEdge(a, 140)];
  // 용 둘: 양 끝에서 마주 날아와 적 위에서 교차 → 반대쪽 끝까지 → 솟아올라 X 자로 내리꽂힌다 (하나는 높게, 하나는 낮게 엇갈린다)
  const mk = (from, to, hi) => {
    const s = from < to ? 1 : -1;
    return dePath([
      [0.7, from, hi ? 30 : 96], [1.2, mix(from, tx0, 0.6), hi ? 50 : 80], [1.55, tx0, hi ? 92 : 36], [1.95, mix(tx0, to, 0.55), hi ? 104 : 30],
      [2.25, mix(tx0, to, 0.8), hi ? 40 : 64], [2.45, mix(tx0, to, 0.5), -10], [tf, tx0 - s * 4, gy + 6], [tf + 0.3, tx0 + s * 60, gy + 260],
    ]);
  };
  const paths = [mk(xs[0], xs[1], true), mk(xs[1], xs[0], false)];
  const pals = [DE_PAL.emperor, DE_PAL.violet], fires = [DE_FIRE, DE_FIRE_V];
  const R = 10, L = Math.max(260, Math.min(520, W * 0.42)), N = 42;
  const burnt = [null, null];
  backFx(a, 0, life, (u) => {
    const t = u * life;
    // 불바다가 번질수록 하늘이 붉게 달아오른다
    dimBand(0.5 * deEnv(t, 0.15, D + 0.25, 0.5, 0.4), '22,0,14');
    const heat = deEnv(t, 1.3, D + 0.3, 0.8, 0.4);
    if (heat > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 * heat;
      const g = ctx.createLinearGradient(0, 40, 0, gy);
      g.addColorStop(0, 'rgba(255,40,120,0)'); g.addColorStop(1, 'rgba(255,60,140,0.8)');
      ctx.fillStyle = g; ctx.fillRect(-20, 40, W + 40, gy - 40);
      ctx.restore();
    }
    if (t < 0.65) return;
    paths.forEach((p, j) => deDragon(deBody(p, t, L, N), { r: R, pal: pals[j], open: t > 1.0 && t < tf ? 1 : 0.2, side: (j ? 1 : -1) * d }));
  });
  aFx(a, 0, life, (u) => {
    const t = u * life;
    // 불바다: 숨결이 지나간 자리가 타오르고, 다 번지면 하단바 전체가 불길
    const sea = deEnv(t, 0, life, 0.01, 0.45), surge = t > tf ? 1 + 1.3 * Math.max(0, 1 - (t - tf) / 0.5) : 1;
    burnt.forEach((b, j) => { if (b) deFireRow(b[0], b[1], (16 + 10 * segU(t, 1.4, 2.4)) * surge, sea, fires[j], j * 7); });
    if (t > 2.0) deFireRow(0, W, 26 * surge, sea * segU(t, 2.0, 2.4), DE_FIRE, 13);
    if (t > 1.0 && t < 2.32) {
      const k = deEnv(t, 1.0, 2.32, 0.1, 0.12);
      paths.forEach((p, j) => { const m = deMouth(deBody(p, t, L, N), R); deBreath(m.x, m.y, m.x + (j ? -d : d) * 24, gy - 8, 3.5, 20, k, fires[j]); });
    }
    // 교차하는 순간 두 용의 기운이 부딪혀 번쩍인다
    if (t > 1.5 && t < 1.8) {
      const k = 1 - segU(t, 1.5, 1.8), y = 64;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k;
      const g = ctx.createRadialGradient(tx0, y, 2, tx0, y, 70);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#ff9fe8'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(tx0 - 70, y - 70, 140, 140);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, y - 1, W, 2 * k);
      ctx.restore();
    }
  }, null, (u) => {
    const t = u * life;
    if (t <= 1.0 || t >= 2.32) return;
    paths.forEach((p, j) => {
      const m = deMouth(deBody(p, t, L, N), R), ex = m.x + (j ? -d : d) * 24;
      burnt[j] = burnt[j] ? [Math.min(burnt[j][0], ex), Math.max(burnt[j][1], ex)] : [ex, ex];
      deBreathParts(m.x, m.y, ex, gy - 8, 2, fires[j]);
    });
    if (Math.random() < 0.8) parts.push({ x: rand(0, W), y: gy - rand(4, 20), vx: rand(-20, 20), vy: rand(-90, -40), g: -20, size: 2, color: Math.random() < 0.5 ? '#ff9fe8' : '#ffd27a', life: rand(0.5, 0.9), t: 0, add: true });
  });
}

// ── ★★★ 용신의 심판 ──
// 용신의 눈(F09): 구름 사이로 뜬 거대한 용의 눈과 용암 줄기가 흐르는 땅 — 하단바 폭에 맞춰 원래 색으로 그린다 (궁극기 배경)
//  open(0~1): 아래에서 떠오르며 짙어진다. 눈 자리는 시트의 가로 50%·세로 22% (deEyeAt)
function deGodEye(open) {
  const S = VFX_SHEETS.f09;
  if (!S || !S.img || !S.img.complete || open <= 0) return;
  const w = W + 8, h = w * S.img.naturalHeight / S.img.naturalWidth, top = groundY() + 4 - h + 10 * (1 - open);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha *= Math.min(1, open * 1.4);
  ctx.drawImage(S.img, -4, Math.round(top), w, h);
  ctx.restore();
}
const deEyeAt = () => { const S = VFX_SHEETS.f09, r = S && S.img && S.img.naturalWidth ? S.img.naturalHeight / S.img.naturalWidth : 100 / 240, h = (W + 8) * r; return { x: W / 2, y: groundY() + 4 - h + h * 0.22 }; };
// 녹아내리는 땅: 분홍빛 용암이 하단바 바닥을 덮고 끓어오른다 (x0~x1 까지 번졌다)
function deMolten(x0, x1, lvl, alpha, seed) {
  if (x1 < x0) [x0, x1] = [x1, x0];
  x0 = Math.max(-4, x0); x1 = Math.min(W + 4, x1);
  if (x1 - x0 < 2 || alpha <= 0) return;
  const base = groundY() - 6, top = (x) => base - lvl * (0.75 + 0.25 * Math.sin(x * 0.05 + clock * 3 + seed)) - 2 * Math.sin(x * 0.17 - clock * 5);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.moveTo(x0, groundY() + 10);
  for (let x = x0; x <= x1; x += 6) ctx.lineTo(x, top(x));
  ctx.lineTo(x1, top(x1)); ctx.lineTo(x1, groundY() + 10); ctx.closePath();
  const g = ctx.createLinearGradient(0, base - lvl - 4, 0, groundY() + 10);
  g.addColorStop(0, '#fff0c0'); g.addColorStop(0.2, '#ff9fe8'); g.addColorStop(0.55, '#ff2a8a'); g.addColorStop(1, '#5a0a3a');
  ctx.fillStyle = g; ctx.fill();
  // 식어 가는 껍질이 C8 균열로 갈라지며 틈에서 빛이 샌다 (땅선을 따라 이어 붙임)
  vfxTileRun(ctx, 'c8', '#ff4dd2', 3 + (Math.floor(clock * 8 + seed) % 2), x0, base - lvl * 0.5 + 3, x1 - x0, 1, { alpha: alpha * 0.85 });
  // 끓는 거품이 터지는 반짝임 (C16)
  ctx.globalCompositeOperation = 'lighter';
  for (let x = x0 + 5; x < x1; x += 23) {
    const ph = (clock * 1.7 + x * 0.13 + seed) % 1;
    vfxDraw(ctx, 'c16', '#fff0c0', Math.floor(ph * 4), x, top(x) - ph * 3, { alpha: alpha * (1 - ph) });
  }
  // 위로 일렁이는 열기
  ctx.globalAlpha = alpha * 0.35;
  const hg = ctx.createLinearGradient(0, base - lvl - 40, 0, base - lvl);
  hg.addColorStop(0, 'rgba(255,77,210,0)'); hg.addColorStop(1, 'rgba(255,77,210,0.9)');
  ctx.fillStyle = hg; ctx.fillRect(x0, base - lvl - 40, x1 - x0, 40);
  ctx.restore();
}
// 용신의 눈에서 떨어지는 불똥 하나: 꼬리를 끌며 떨어져 닿은 자리에서 불꽃이 터진다
function deEmber(a, delay, from, to, life, size) {
  let p0 = null, p1 = null;
  aFx(a, Math.max(0, delay), life, (u) => {
    if (!p0) { p0 = from(); p1 = to(); }
    const e = easeIn(u), x = mix(p0.x, p1.x, e), y = mix(p0.y, p1.y, e);
    // 꼬리를 끄는 불똥: 불꽃 원뿔(E17)을 떨어지는 쪽 반대로 돌려 꼬리처럼 (넓은 끝이 뒤)
    vfxDraw(ctx, 'e17', DE_FIRE[1], vfxLoop('e17', 16), x - (p1.x - p0.x) * 0.06, y - (p1.y - p0.y) * 0.06, { rot: Math.atan2(p0.y - p1.y, p0.x - p1.x), scale: size >= 1 ? 2 / 3 : 2 / 3, sx: size, sy: size });
  }, () => {
    if (!p1) return;
    const fx = p1.x;
    aFx(a, 0, 0.7, (u) => deFireRow(fx - 12 * size, fx + 12 * size, 14 * size * (1 - u * 0.5), 1 - u, DE_FIRE, fx));
    for (let j = 0; j < Math.round(10 * size); j++) parts.push({ x: p1.x, y: p1.y, vx: rand(-90, 90), vy: rand(-140, -30), g: 300, size: 2, color: j % 2 ? '#ff4dd2' : '#ffffff', life: rand(0.3, 0.5), t: 0, add: true });
  });
}
function deStage3(a) {
  const D = deDur(a), ht = deHitT(a), tf = ht[ht.length - 1], tb = ht[ht.length - 2], life = D + 0.45, gy = groundY();
  const eh = 66, iris = deEyeAt;
  // 뒤 레이어: 깊은 어둠 + 용신의 눈
  backFx(a, 0, life, (u) => {
    const t = u * life;
    dimBand(0.72 * deEnv(t, 0.1, D + 0.3, 0.6, 0.4), '8,0,14');
    const open = easeOut(segU(t, 0.55, 1.05)) * (t > D - 0.05 ? Math.max(0, 1 - (t - D + 0.05) / 0.3) : 1);
    deGodEye(open);
  });
  // 녹아내리는 땅 (숨결이 닿은 자리에서 양쪽 끝까지 번진다)
  aFx(a, 0, life, (u) => {
    const t = u * life;
    if (t <= tb) return;
    const s = easeOut(segU(t, tb, tf + 0.1)), x = a.tx(), reach = Math.max(x, W - x) + 20;
    deMolten(x - reach * s, x + reach * s, 6 + 8 * s + (t > tf ? 6 * Math.max(0, 1 - (t - tf) / 0.4) : 0), deEnv(t, tb, life, 0.05, 0.3), 2);
  });
  // 앞 레이어: 빨아들이는 빛, 하늘에서 내리꽂히는 숨결, 마무리 섬광
  aFx(a, 0, life, (u) => {
    const t = u * life, I = iris(), x = a.tx();
    if (t > tb - 0.08 && t < D + 0.15) {
      const big = t > tf - 0.05 ? 1 : 0, k = deEnv(t, tb - 0.08, D + 0.15, 0.08, 0.25);
      const w1 = mix(34, Math.max(160, W * 0.6), easeOut(segU(t, tf - 0.05, tf + 0.08)) * big), w0 = mix(14, eh * 0.9, big);
      deBreath(I.x, I.y, x, gy - 4, w0, w1, k);
    }
    // 하단바 전체가 하얗게 탄다
    if (t > tf - 0.02 && t < tf + 0.15) dimBand(0.6 * (1 - segU(t, tf, tf + 0.15)), '255,220,245');     // 막타 섬광: α ≤ 0.6, 0.15초 (스펙 정지 기준표)
  }, null, (u) => {
    const t = u * life, I = iris();
    if (t > 2.05 && t < tb) {
      // 하단바 곳곳의 빛이 눈동자로 빨려 들어간다
      for (let j = 0; j < 4; j++) {
        const x = rand(0, W), y = gy - rand(0, 30), T = rand(0.3, 0.45);
        parts.push({ x, y, vx: (I.x - x) / T, vy: (I.y - y) / T, g: 0, size: 2, color: j % 2 ? '#ff9fe8' : '#ffffff', life: T, t: 0, add: true });
      }
    } else if (t > tb && t < D) deBreathParts(I.x, I.y, a.tx(), gy - 6, 4);
  });
  // 눈길이 닿는 곳마다 떨어지는 불똥: 타격마다 하나는 적에게, 둘은 하단바 여기저기에
  for (let i = 0; i < ht.length - 2; i++) {
    const at = ht[i] - 0.16;
    deEmber(a, at, iris, () => { const t = a.targets(i)[0]; return { x: t.x, y: t.y }; }, 0.16, 1);
    for (let j = 0; j < 2; j++) { const x = rand(20, W - 20); deEmber(a, at + rand(-0.05, 0.08), iris, () => ({ x, y: gy - 6 }), 0.2, 0.7); }
  }
}
Object.assign(SKILL_FX, {
  dragonEmperor: {
    // 몸을 낮췄다가 → 창을 하늘로 곧게 치켜들고 버틴다(★★★ 는 떠오른다) → 마지막 일격에 맞춰 앞으로 내지르고 → 거둔다
    pose(u, a) {
      const D = deDur(a), t = u * D, ht = deHitT(a), tf = ht[ht.length - 1], up = (a.mast || 0) >= 3 ? 14 : 5;
      if (t < 0.25) { const c = easeOut(t / 0.25); return { sy: 1 - 0.12 * c, sx: 1 + 0.06 * c, wa: mix(-1.3, -0.5, c), skew: 0.1 * c }; }
      if (t < 0.5) { const r = easeOut(segU(t, 0.25, 0.5)); return { wa: mix(-0.5, -1.62, r), lift: up * r, sy: mix(0.88, 1.08, r), skew: mix(0.1, -0.1, r) }; }
      if (t < tf - 0.14) return { wa: -1.62 + Math.sin(clock * 34) * 0.03, lift: up + Math.sin(t * 5) * 2, sy: 1.08, skew: -0.1 };
      if (t < tf) { const s = easeIn(segU(t, tf - 0.14, tf)); return { wa: mix(-1.62, 0, s), ext: 18 * s, dx: 12 * s, lift: up * (1 - s), skew: mix(-0.1, 0.35, s), sy: mix(1.08, 0.95, s) }; }
      const r = easeOut(segU(t, tf + 0.08, D));
      return { wa: mix(0, -1.3, r), ext: 18 * (1 - r), dx: 12 * (1 - r), skew: 0.35 * (1 - r) };
    },
    cues: () => [[0, (a) => [deStage0, deStage1, deStage2, deStage3][Math.min(3, a.mast || 0)](a)]],
    // 치켜든 창끝에 분홍 기운이 모인다
    tick(a, u) {
      const t = u * deDur(a), ht = deHitT(a);
      if (t < 0.4 || t > ht[ht.length - 1] - 0.1 || Math.random() > 0.7) return;
      const tip = deTip(a);
      parts.push({ x: tip.x + rand(-3, 3), y: tip.y + rand(-3, 3), vx: rand(-15, 15), vy: rand(-70, -20), g: -20, size: Math.random() < 0.3 ? 3 : 2, color: Math.random() < 0.6 ? '#ff4dd2' : '#ffffff', life: rand(0.3, 0.5), t: 0, add: true });
    },
    hit(a, i, n) {
      const m = Math.min(3, a.mast || 0), last = i === n - 1, x = a.tx();
      if (!last) {
        if (m === 3 && i === n - 2) { deBlast(a, x, 1.3); impact({ stop: 0.1, shake: 0.5 }); }     // ★★★ 숨결이 처음 땅에 닿는 순간
        else impact({ stop: 0.02, shake: 0.14 });
        return;
      }
      if (m === 0) { deBlast(a, x, 1); impact({ stop: 0.16, shake: 0.6 }); return; }
      // ★·★★: 내리꽂히는 순간 하단바 전체가 분홍빛으로 번쩍인다
      if (m < 3) aFx(a, 0, 0.15, (u) => dimBand(0.45 * (1 - u), '255,170,230'));
      if (m === 1) {
        deBlast(a, x, 1.7, DE_FIRE, 1);
          impact({ stop: 0.2, shake: 0.7 });
        return;
      }
      if (m === 2) { deBlast(a, x - 14, 1.6, DE_FIRE, 1); deBlast(a, x + 14, 1.6, DE_FIRE_V, 1); impact({ stop: 0.22, shake: 0.75 }); return; }
      deBlast(a, x, 2.2, DE_FIRE, 1.1);
      for (const s of [-1, 1]) for (let j = 1; j <= 3; j++) skLater(a, j * 0.05, () => deBlast(a, x + s * j * W * 0.12, 1.1, DE_FIRE, 0.7));
      impact({ stop: 0.26, shake: 0.85 });
    },
    // 명중 그림 K32 (분홍 용염 폭발): 잔타는 작게, 막타는 크게
    hitTex(a, t, share, i, n) { vfxSkillHit('k32', a, t, share, i, n); },
    kb: 20,
  },
});
