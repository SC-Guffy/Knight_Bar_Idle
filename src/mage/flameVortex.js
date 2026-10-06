'use strict';
// 화염 회오리 연출 (pyromancer). 수치·단계는 src/classes.js 의 SKILLS.flameVortex
//  Lv1 「불기둥」 지팡이로 원을 그리면 적 발밑이 달아오르다 불기둥이 솟아 타격마다 치솟는다
//  ★ 「화염 회오리」 불꽃 세 가닥이 꼬이며 도는 깔때기 회오리가 적을 감싸고, 불티가 둘레를 돈다
//  ★★ 「쌍둥이 회오리」 적 양쪽에서 회오리 둘이 일어 휘감아 다가오고 — 맞부딪혀 더 큰 하나로 합쳐진다
//  ★★★ 「화염 폭풍」 하늘 끝까지 닿는 화염 폭풍이 둘레의 불티를 빨아올리고, 꼭대기에 불구름이 돈다
//                   — 마지막에 위에서부터 차례로 터져 내려와 땅에서 불의 벽이 양쪽으로 퍼진다

const FV_FIRE = { core: '#fff2c0', hot: '#ffcf4a', mid: '#ff7a2a', deep: '#c8301a', dark: '#5a160c' };
// 불 색: Lv1·★ 은 회색빛으로 바래고, ★★★ 는 금빛이 살짝 섞인다
function fvPal(a) {
  const m = a.mast || 0, out = {};
  for (const key in FV_FIRE) {
    let c = FV_FIRE[key];
    if (m < 2) c = mixHex(c, MASTERY_FADE[0], MASTERY_FADE[1 + m] * 0.8);
    else if (m >= 3) c = mixHex(c, MASTERY_GOLD, 0.15);
    out[key] = c;
  }
  return out;
}
// 지팡이로 허공에 원을 그리며 불을 휘젓는다. ★★★ 는 떠올라 휘젓다가 폭발 순간 내려찍는다
function fvPose(u, a) {
  const m = a.mast || 0, t = u * (a.k ? a.k.dur : 1.6);
  const endU = m >= 3 ? 0.84 : 0.88;
  const win = easeOut(segU(u, 0, 0.12)), wout = 1 - segU(u, endU, 1);
  const k = win * wout, sp = 13 + 2 * m;
  const p = {
    bowA: (-0.3 + 0.12 * Math.sin(t * sp)) * k, pull: (8 + 3 * Math.min(2, m)) * k,
    dx: Math.sin(t * sp + 1.2) * 1.2 * k, skew: 0.05 * Math.sin(t * sp) * k, lift: (m >= 3 ? 5 : m >= 2 ? 2 : 0) * k, sy: 1 + 0.03 * k,
  };
  if (m >= 3 && u > endU) {
    // 내려찍기: 지팡이를 앞으로 꽂고 몸을 숙였다가 돌아온다
    const s = easeOut(segU(u, endU, endU + 0.04)), r = segU(u, endU + 0.06, 1);
    p.bowA = mix(0, 0.75, s) * (1 - r); p.skew = 0.16 * s * (1 - r); p.sy = 1 - 0.08 * s * (1 - r); p.dx = 2.5 * s * (1 - r); p.pull = 0; p.lift = 0;
  }
  return p;
}

// 불기둥: 가운데 하얀 심을 품은 불길이 줄마다 출렁이며 솟고, 끝에서 불 혀가 갈라진다
function fvPillar(x, gy, h, w, k, pal, seed) {
  if (k <= 0 || h < 2) return;
  const cell = 3;
  ctx.save();
  // 불길은 보통 섞기로 칠한다 (lighter 로 겹치면 몸 위에서 하얗게 타 버린다)
  for (let y = 0; y < h; y += cell) {
    const v = y / h;
    const half = w * (1 - v * 0.55) * (0.8 + 0.2 * Math.sin(clock * 18 + y * 0.4 + seed)), sway = Math.sin(clock * 7 + v * 5 + seed) * v * 3;
    const cx = x + sway;
    ctx.globalAlpha = k * (1 - v * 0.55);
    ctx.fillStyle = v > 0.82 ? pal.deep : pal.mid;
    ctx.fillRect(Math.round(cx - half), Math.round(gy - y - cell), Math.round(half * 2), cell);
    const inner = half * (0.55 - v * 0.3);
    if (inner > 0.6) { ctx.fillStyle = v < 0.45 ? pal.core : pal.hot; ctx.fillRect(Math.round(cx - inner), Math.round(gy - y - cell), Math.round(inner * 2), cell); }
  }
  // 꼭대기의 갈라진 불 혀 셋
  for (let j = -1; j <= 1; j++) {
    const fl = 4 + 6 * Math.abs(Math.sin(clock * 13 + j * 2 + seed));
    ctx.globalAlpha = k * 0.7; ctx.fillStyle = pal.deep;
    ctx.fillRect(Math.round(x + j * w * 0.45 - 1), Math.round(gy - h - fl), 3, Math.round(fl));
  }
  ctx.restore();
}
// 회오리: 깔때기(아래 좁고 위 넓다) 안을 불꽃 세 가닥이 꼬이며 돈다. 앞쪽 가닥은 밝게, 뒤쪽은 어둡게.
// cut: 이 y 보다 위는 그리지 않는다 (★★★ 위에서부터 터져 내릴 때)
function fvTwister(x, gy, h, wBot, wTop, k, pal, ph, cut = -999) {
  if (k <= 0 || h < 3) return;
  const cell = 3;
  ctx.save();
  // 불길은 보통 섞기로 칠한다 (lighter 로 겹치면 몸 위에서 하얗게 타 버린다)
  for (let y = 0; y < h; y += cell) {
    const sy = gy - y - cell;
    if (sy < cut) break;
    const v = y / h, w = mix(wBot, wTop, v ** 0.8), cx = x + Math.sin(clock * 3 + v * 4) * v * 5;
    // 깔때기 몸통: 옅게 빛나는 주황 띠 (어둡게 칠하면 바탕화면 위에서 탁해 보인다)
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = k * 0.16 * (1 - v * 0.4);
    ctx.fillStyle = pal.mid;
    ctx.fillRect(Math.round(cx - w), Math.round(sy), Math.round(w * 2), cell);
    ctx.globalCompositeOperation = 'source-over';
    // 불꽃 네 가닥: 위로 갈수록 더 감기며 돈다. 앞쪽은 밝고 굵게, 뒤쪽은 붉고 가늘게
    for (let j = 0; j < 4; j++) {
      const an = ph + j * (Math.PI / 2) + v * 6, depth = Math.sin(an);
      const px = cx + Math.cos(an) * w, front = depth > 0;
      ctx.globalAlpha = k * (front ? 1 : 0.6) * (1 - v * 0.3);
      ctx.fillStyle = front ? (v < 0.25 ? pal.core : j % 2 ? pal.hot : pal.mid) : pal.deep;
      ctx.fillRect(Math.round(px - 2), Math.round(sy), front ? 5 : 3, cell);
    }
  }
  // 발밑: 빨려 드는 불의 소용돌이 고리
  ctx.globalAlpha = k * 0.8;
  for (let i = 0; i < 12; i++) {
    const an = ph * 1.4 + (i / 12) * Math.PI * 2, r = wBot + 6;
    ctx.fillStyle = Math.sin(an) > 0 ? pal.hot : pal.deep;
    ctx.fillRect(Math.round(x + Math.cos(an) * r), Math.round(gy - 2 + Math.sin(an) * 2.5), 2, 2);
  }
  ctx.restore();
}
// 회오리 둘레를 도는 불티 (draw 안에서 회오리 위치를 따라간다)
function fvEmbers(x, gy, h, w, ph, k, pal, n) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const v = ((i * 0.37 + ph * 0.08) % 1), an = ph * 1.7 + i * 2.4, r = w * (0.9 + v * 0.9);
    const front = Math.sin(an) > 0;
    ctx.globalAlpha = k * (front ? 0.95 : 0.4) * (1 - v * 0.5);
    ctx.fillStyle = i % 3 ? pal.hot : pal.core;
    ctx.fillRect(Math.round(x + Math.cos(an) * r), Math.round(gy - v * h), 2, 2);
  }
  ctx.restore();
}

// ── Lv1: 달아오르는 땅 → 불기둥 ──
function fvPillarFx(a, life, rise, pulses) {
  const pal = fvPal(a), seed = rand(0, 9);
  aFx(a, 0, life, (u) => {
    const t = u * life, x = a.tx(), gy = groundY();
    // 솟기 전: 땅에 붉은 점이 맥박친다
    if (t < rise) {
      const g = t / rise;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4 + 0.5 * g * Math.abs(Math.sin(clock * 20));
      ctx.fillStyle = pal.mid; ctx.beginPath(); ctx.ellipse(x, gy - 1, 4 + 8 * g, 1.5 + 1.5 * g, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      return;
    }
    const s = t - rise, up = easeOut(clamp01(s / 0.12)), out = u > 0.82 ? (1 - u) / 0.18 : 1;
    const pl = pulses.reduce((m, p) => Math.max(m, 1 - Math.abs(t - p) / 0.09), 0);
    fvPillar(x, gy, (42 + 16 * Math.max(0, pl)) * up * (out < 1 ? 0.6 + 0.4 * out : 1), 8 + 3 * Math.max(0, pl), out, pal, seed);
  }, null, (u) => {
    if (u * life < rise || Math.random() > 0.5) return;
    parts.push({ x: a.tx() + rand(-5, 5), y: groundY() - rand(10, 34), vx: rand(-15, 15), vy: rand(-90, -50), g: -10, size: 2, color: Math.random() < 0.5 ? pal.hot : pal.mid, life: 0.35, t: 0, add: true });
  });
}
// ── ★: 화염 회오리 하나 ──
function fvVortexFx(a, life, H, wb, wt) {
  const pal = fvPal(a);
  aFx(a, 0, life, (u) => {
    const t = u * life, grow = easeOut(clamp01(t / 0.28)), out = u > 0.85 ? (1 - u) / 0.15 : 1;
    // 사라질 때는 위로 풀리며 가늘어진다
    const x = a.tx(), gy = groundY() - (1 - out) * 10, ph = t * 9;
    fvTwister(x, gy, H * grow, wb * (0.5 + 0.5 * grow) * out, wt * grow, out, pal, ph);
    fvEmbers(x, gy, H * grow, wb + 4, ph, out, pal, 10);
  }, null, (u) => {
    if (u > 0.85 || Math.random() > 0.6) return;
    const x = a.tx(), gy = groundY();
    parts.push({ x: x + rand(-wt, wt), y: gy - rand(10, H), vx: rand(-20, 20), vy: rand(-70, -30), g: -10, size: 2, color: Math.random() < 0.5 ? pal.hot : pal.mid, life: 0.35, t: 0, add: true });
  });
}
// ── ★★: 쌍둥이 회오리 → 합쳐진다 ──
function fvTwinFx(a, life, mergeT) {
  const pal = fvPal(a), D = 62;
  aFx(a, 0, life, (u) => {
    const t = u * life, cx = a.tx(), gy = groundY(), out = u > 0.86 ? (1 - u) / 0.14 : 1;
    if (t < mergeT) {
      // 양쪽에서 일어나 휘감으며 다가온다 (서로 반대로 돈다)
      const grow = easeOut(clamp01(t / 0.25)), m = easeIn(clamp01(t / mergeT));
      for (const sd of [-1, 1]) {
        const x = cx + sd * D * (1 - m) + Math.sin(t * 10 + sd) * 3 * (1 - m);
        fvTwister(x, gy, 58 * grow, 6 + 3 * grow, 15 * grow, 1, pal, sd * t * 10);
        fvEmbers(x, gy, 58 * grow, 9, sd * t * 10, 1, pal, 6);
      }
      return;
    }
    // 합쳐진 큰 회오리: 처음엔 부풀었다가 자리 잡는다
    const s = t - mergeT, pop = Math.max(0, 1 - s / 0.2), ph = t * 11;
    fvTwister(cx, gy, 92 + 10 * pop, (13 + 5 * pop) * out, (30 + 8 * pop), out, pal, ph);
    fvEmbers(cx, gy, 92, 18, ph, out, pal, 16);
  }, null, (u) => {
    if (u > 0.86 || Math.random() > 0.7) return;
    const cx = a.tx(), gy = groundY();
    parts.push({ x: cx + rand(-40, 40), y: gy - rand(4, 60), vx: rand(-20, 20), vy: rand(-80, -30), g: -10, size: 2, color: Math.random() < 0.5 ? pal.hot : pal.mid, life: 0.35, t: 0, add: true });
  });
  // 맞부딪히는 순간: 불꽃 고리가 납작하게 퍼진다
  skLater(a, mergeT, () => {
    const cx = a.tx(), gy = groundY();
    aFx(a, 0, 0.4, (u) => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - u;
      ctx.strokeStyle = pal.hot; ctx.lineWidth = 3 * (1 - u) + 1;
      ctx.beginPath(); ctx.ellipse(cx, gy - 30, 10 + 50 * easeOut(u), 4 + 10 * easeOut(u), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = pal.core; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(cx, gy - 30, 6 + 34 * easeOut(u), 2 + 7 * easeOut(u), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    });
    burst(cx, gy - 30, 22, [pal.core, pal.hot, pal.mid], 170, 3, 120);
    impact({ stop: 0.06, shake: 0.25 });
  });
}
// ── ★★★: 하늘까지 닿는 화염 폭풍 ── fallAt 초에 꼭대기부터 차례로 터져 내려와 FALL 초 뒤 땅에서 불의 벽이 된다
function fvStormFx(a, life, fallAt) {
  const pal = fvPal(a), FALL = 0.2;
  aFx(a, 0, life, (u) => {
    const t = u * life, cx = a.tx(), gy = groundY(), H = gy + 20;
    const grow = easeOut(clamp01(t / 0.4)), squeeze = easeIn(segU(t, fallAt - 0.3, fallAt));
    const cut = t < fallAt ? -999 : mix(-20, gy, clamp01((t - fallAt) / FALL));
    if (cut >= gy) return;
    const ph = t * (12 + 10 * squeeze);
    fvTwister(cx, gy, H * grow, (16 + 6 * grow) * (1 - 0.35 * squeeze), (58 * grow) * (1 - 0.45 * squeeze), 1, pal, ph, cut);
    fvEmbers(cx, gy, H * grow * 0.8, 26, ph, 1, pal, 24);
    // 꼭대기의 불구름: 납작하게 도는 어두운 불덩이 고리
    if (t < fallAt) {
      ctx.save();
      for (let i = 0; i < 22; i++) {
        const an = -ph * 0.4 + (i / 22) * Math.PI * 2, r = 70 * grow * (1 - 0.3 * squeeze);
        const y = 10 + Math.sin(an) * 6, s = 4 + (i % 3);
        ctx.globalAlpha = 0.75 * grow;
        ctx.fillStyle = Math.sin(an) > 0 ? pal.deep : pal.dark;
        ctx.fillRect(Math.round(cx + Math.cos(an) * r - s / 2), Math.round(y - s / 2), s, s);
        if (i % 4 === 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = pal.mid; ctx.fillRect(Math.round(cx + Math.cos(an) * r - 1), Math.round(y - 1), 2, 2); ctx.globalCompositeOperation = 'source-over'; }
      }
      ctx.restore();
    }
  }, null, (u) => {
    const t = u * life;
    if (t >= fallAt) return;
    const cx = a.tx(), gy = groundY();
    // 둘레의 불티·흙먼지가 회오리로 빨려 들며 위로 치솟는다
    for (let i = 0; i < 2; i++) {
      const sd = Math.random() < 0.5 ? -1 : 1, d = rand(50, 95), px = cx + sd * d;
      parts.push({ x: px, y: gy - rand(2, 30), vx: -sd * d * 2.2, vy: rand(-140, -60), g: 0, size: 2, color: Math.random() < 0.6 ? pal.hot : '#8a5a3a', life: 0.4, t: 0, add: true });
    }
  });
  // 위에서부터 터져 내려온다: 높이마다 불꽃 송이가 차례로 핀다
  const gy = groundY();
  for (let j = 0; j < 7; j++) {
    const v = j / 6;
    skLater(a, fallAt + FALL * v, () => {
      const cx = a.tx(), y = mix(4, gy - 12, v), R = 10 + 10 * v;
      fvBloomFx(a, cx + rand(-6, 6), y, R, pal);
      if (j % 2 === 0) impact({ shake: 0.12 });
    });
  }
  skLater(a, fallAt + FALL, () => fvWallFx(a, a.tx(), pal));
}
// 불꽃 송이: 한 점에서 꽃잎처럼 여덟 갈래 불꽃이 피었다 진다
function fvBloomFx(a, x, y, R, pal) {
  const rot = rand(0, 1);
  aFx(a, 0, 0.35, (u) => {
    const e = easeOut(u), k = 1 - u;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = k;
    ctx.fillStyle = pal.core; ctx.beginPath(); ctx.arc(x, y, R * 0.6 * (1 - u * 0.8), 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const an = rot + (i / 8) * Math.PI * 2;
      for (let s = 0.3; s <= 1; s += 0.17) {
        const r = R * e * s * (i % 2 ? 0.8 : 1.15);
        ctx.fillStyle = s > 0.8 ? pal.deep : s > 0.5 ? pal.mid : pal.hot;
        ctx.fillRect(Math.round(x + Math.cos(an) * r - 1.5), Math.round(y + Math.sin(an) * r - 1.5), 3, 3);
      }
    }
    ctx.restore();
  });
}
// 마지막: 땅에서 불의 벽이 양쪽으로 밀려 나간다
function fvWallFx(a, x, pal) {
  const gy = groundY();
  aFx(a, 0, 0.6, (u) => {
    const e = easeOut(u), k = 1 - u;
    for (const sd of [-1, 1]) {
      const wx = x + sd * (10 + 90 * e);
      fvPillar(wx, gy, 30 * k + 6, 5, k, pal, sd * 3);
    }
    fvPillar(x, gy, 44 * k, 12 * k + 2, k, pal, 0);
  });
  burst(x, gy - 10, 34, [pal.core, pal.hot, pal.mid, pal.deep], 220, 3, 260);
  impact({ stop: 0.16, shake: 0.5 });
}

Object.assign(SKILL_FX, {
  flameVortex: {
    pose: fvPose,
    tick(a, u) {
      // 휘젓는 지팡이 끝에서 불티가 흩날린다
      if (u > 0.85 || Math.random() > 0.3 + 0.12 * (a.mast || 0)) return;
      const p = castPose(a.owner) || {}, pal = fvPal(a), h = hand(a);
      const ang = staffAngle(p.bowA || 0), L = 9.6 * PX;
      const x = h.x + a.dir * (PX + Math.cos(ang) * L), y = h.y - (p.lift || 0) + Math.sin(ang) * L;
      parts.push({ x: x + rand(-3, 3), y: y + rand(-3, 3), vx: rand(-25, 25), vy: rand(-50, -10), g: -10, size: 2, color: Math.random() < 0.5 ? pal.hot : pal.mid, life: 0.35, t: 0, add: true });
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast || 0, H = a.k.hits;
      if (m === 0) return [[0.12, (a) => fvPillarFx(a, d * 0.82, (H[0][0] - 0.12) * d - 0.06, H.map((hh) => (hh[0] - 0.12) * d))]];
      if (m === 1) return [[0.12, (a) => fvVortexFx(a, d * 0.82, 74, 10, 26)]];
      if (m === 2) return [[0.04, (a) => fvTwinFx(a, d * 0.92, 0.42 * d)]];
      return [[0.02, (a) => { fvStormFx(a, d * 0.96, (H[H.length - 1][0] - 0.02) * d - 0.2); impact({ shake: 0.1 }); }]];   // 꼭대기부터 0.2초 터져 내려와 마지막 타격 때 땅에 닿는다
    },
    hit(a, i, n) {
      const m = a.mast || 0, pal = fvPal(a), last = i === n - 1;
      if (m >= 3 && last) return;   // 마지막 폭발은 fvStormFx 가 위에서부터 터뜨린다
      for (const t of a.targets(i)) {
        // 회오리가 감싸 지나가며 몸에 불꽃을 핥는다 (돌아가는 쪽으로 튄다)
        const sd = i % 2 ? 1 : -1;
        for (let j = 0; j < 3 + m; j++) parts.push({ x: t.x + sd * rand(4, 10), y: t.y + rand(-10, 10), vx: -sd * rand(60, 120), vy: rand(-60, -20), g: 60, size: Math.random() < 0.3 ? 3 : 2, color: [pal.core, pal.hot, pal.mid][j % 3], life: rand(0.2, 0.35), t: 0, add: true });
      }
      impact({ shake: m === 0 ? 0.05 : last ? 0.15 : 0.04 });
    },
    // 맞은 자리에 짧은 불꽃 호가 감긴다 (화살 긁힌 자국 대신)
    marks(a, t, pow, i) {
      const pal = fvPal(a), x = t.x, y = t.y + rand(-8, 6), r = 6 + 2 * Math.min(2, pow), a0 = rand(0, Math.PI * 2), sd = i % 2 ? 1 : -1;
      aFx(a, 0, 0.22, (u) => {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - u;
        ctx.strokeStyle = pal.hot; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(x, y, r + 3 * u, (r + 3 * u) * 0.35, 0, a0 + sd * u * 3, a0 + sd * u * 3 + 2.2); ctx.stroke();
        ctx.restore();
      });
    },
    kb: 6,
  },
});
