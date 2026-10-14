'use strict';
// 화염 회오리 연출 (pyromancer). 수치·단계는 src/classes.js 의 SKILLS.flameVortex
//  Lv1 「불기둥」 지팡이로 원을 그리면 적 발밑이 달아오르다 불기둥이 솟아 타격마다 치솟는다
//  ★ 「화염 회오리」 불꽃 세 가닥이 꼬이며 도는 깔때기 회오리가 적을 감싸고, 불티가 둘레를 돈다
//  ★★ 「쌍둥이 회오리」 적 양쪽에서 회오리 둘이 일어 휘감아 다가오고 — 맞부딪혀 더 큰 하나로 합쳐진다
//  ★★★ 「화염 폭풍」 하늘 끝까지 닿는 화염 폭풍이 둘레의 불티를 빨아올리고, 꼭대기에 불구름이 돈다
//                   — 마지막에 위에서부터 차례로 터져 내려와 땅에서 불의 벽이 양쪽으로 퍼진다

const FV_FIRE = { core: '#fff2c0', hot: '#ffcf4a', mid: '#ff7a2a', deep: '#c8301a', dark: '#5a160c' };
const FV_CLOUD = ['#1a0806', '#4a1208', '#8a2410', '#d8501a', '#ff9a3a'];   // 불구름 램프 (C15 먹구름을 다시 칠함)
// 불 색: Lv1·★ 은 회색빛으로 바래고, ★★★ 는 금빛이 살짝 섞인다
function fvPal(a) {
  const m = a.mast || 0, out = {};
  for (const key in FV_FIRE) {
    let c = FV_FIRE[key];
    if (m < 2) c = mixHex(c, MASTERY_FADE[0], MASTERY_FADE[1 + m] * 0.8);
    else if (m >= 3) c = mixHex(c, MASTERY_GOLD, 0.15);
    out[key] = c;
  }
  out.ramp = mgA(a, 'fire');          // 텍스처 램프 (src/vfx-mage.js)
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
  // 불기둥 = F16 불바다 시트의 좁은 토막(폭 w×2.4)을 세운다. 높이 h 에 맞는 배율 (2/3·1·4/3)
  if (k <= 0 || h < 2) return;
  const s = VFX_SHEETS.f16;
  if (!s || !s.lv) return;
  const sc = h < 34 ? 2 / 3 : h < 52 ? 1 : 4 / 3, wd = (w * 2.4) / (sc * VFX_DOT), u0 = mgHash(Math.round(seed * 7) + 3) * Math.max(0, 1 - wd / s.fw);
  vfxDraw(ctx, 'f16', pal.ramp, mgLoop('f16', 12, seed), x, gy + 1, { scale: sc, anchor: 'b', crop: [u0, Math.min(1, u0 + wd / s.fw)], alpha: Math.min(1, k * 1.4) });
}
// 회오리: 깔때기(아래 좁고 위 넓다) 안을 불꽃 세 가닥이 꼬이며 돈다. 앞쪽 가닥은 밝게, 뒤쪽은 어둡게.
// cut: 이 y 보다 위는 그리지 않는다 (★★★ 위에서부터 터져 내릴 때)
function fvTwister(x, gy, h, wBot, wTop, k, pal, ph, cut = -999) {
  // 회오리 = E35 불 회오리 몸통 루프. 높이 h 에 맞는 배율 (2/3 = 96px · 1 = 144px · 4/3), cut 보다 위는 잘라 낸다 (★★★ 위에서부터 터져 내릴 때)
  if (k <= 0 || h < 3) return;
  const sc = h < 110 ? 2 / 3 : h < 160 ? 1 : 4 / 3, full = mgPx('e35', sc) * 2;   // 시트 높이 = 폭 × 2
  ctx.save();
  if (cut > -999) { ctx.beginPath(); ctx.rect(x - 300, cut, 600, 1000); ctx.clip(); }
  vfxDraw(ctx, 'e35', pal.ramp, Math.floor(ph * 1.6) % 5, x, gy + 2, { scale: sc, anchor: 'b', sy: Math.max(0.5, Math.min(1, h / full)), flip: ph < 0, alpha: Math.min(1, k) });
  ctx.restore();
}
// 회오리 둘레를 도는 불티 (draw 안에서 회오리 위치를 따라간다)
function fvEmbers(x, gy, h, w, ph, k, pal, n) {
  // 회오리 둘레를 도는 불티 (작은 보조 불티, 수를 줄였다)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < Math.ceil(n / 2); i++) {
    const v = ((i * 0.37 + ph * 0.08) % 1), an = ph * 1.7 + i * 2.4, r = w * (0.9 + v * 0.9);
    ctx.globalAlpha = k * (Math.sin(an) > 0 ? 0.95 : 0.4) * (1 - v * 0.5);
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
    // 솟기 전: 땅의 C3 고리가 붉게 맥박친다
    if (t < rise) { vfxDraw(ctx, 'c3', pal.ramp, Math.floor(clock * 14) % 3, x, gy + 1, { scale: 2 / 3, anchor: 'b', alpha: 0.5 + 0.4 * (t / rise) }); return; }
    const s = t - rise, up = clamp01(s / 0.12), out = u > 0.82 ? (1 - u) / 0.18 : 1;
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
    mgFx(a, 'c3', cx, gy + 1, pal.ramp, { scale: 4 / 3, life: 0.4, anchor: 'b', fade: 0.4 });
    mgFx(a, 'e36', cx, gy - 30, pal.ramp, { scale: 1, life: 0.35, fade: 0.3 });
    burst(cx, gy - 30, 10, [pal.core, pal.hot, pal.mid], 170, 2, 120);
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
    // 꼭대기의 불구름: C15 먹구름을 불빛 램프로, 좌우 두 장이 서로 반대로 흐른다
    if (t < fallAt) {
      const sc = grow < 0.5 ? 1 : 4 / 3, dx = Math.sin(ph * 0.15) * 8;
      vfxDraw(ctx, 'c15', FV_CLOUD, mgLoop('c15', 6), cx - 34 + dx, 14, { scale: sc, alpha: 0.9 * grow });
      vfxDraw(ctx, 'c15', FV_CLOUD, mgLoop('c15', 6, 2), cx + 34 - dx, 10, { scale: sc, flip: true, alpha: 0.9 * grow });
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
  // 불꽃 송이 = E36 불꽃 꽃이 피었다 진다 (R 12 이하 2/3배, 그 위 1배)
  mgFx(a, 'e36', x, y, pal.ramp, { scale: R <= 12 ? 2 / 3 : 1, life: 0.35, fade: 0.3, rot: rand(-0.4, 0.4) });
}
// 마지막: 땅에서 불의 벽이 양쪽으로 밀려 나간다
function fvWallFx(a, x, pal) {
  // 마지막: 땅에서 불의 벽(F16 토막)이 양쪽으로 밀려 나간다
  const gy = groundY();
  aFx(a, 0, 0.6, (u) => {
    const e = easeOut(u), k = 1 - u;
    for (const sd of [-1, 1]) fvPillar(x + sd * (10 + 90 * e), gy, 30 * k + 14, 7, k, pal, sd * 3);
    fvPillar(x, gy, 54 * k + 10, 14, k, pal, 0);
  });
  burst(x, gy - 10, 16, [pal.core, pal.hot, pal.mid, pal.deep], 220, 2, 260);
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
    // 명중 그림 K24 (불꽃 소용돌이에 휘말린 불티): Lv1 앞 3프레임, ★ 4프레임, ★★ 이상 전부. 2/3배, 돌아가는 쪽으로 좌우 반전
    hitTex(a, t, share, i, n) {
      const m = a.mast || 0;
      mgFx(a, 'k24', t.x + rand(-4, 4), t.y + rand(-8, 6), mgA(a, 'fire'), { scale: m >= 3 && i === n - 2 ? 1 : 2 / 3, life: 0.26, frames: [3, 4, 5, 5][m], fade: 0.3, flip: i % 2 === 1 });
    },
    kb: 6,
  },
});
