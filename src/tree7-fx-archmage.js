'use strict';
// 시즌7 스킬 빌드 트리 — 대마도사 줄기(마법사 → 화염술사 → 대마도사) 새 스킬·융합 연출 (docs/specs/skill-tree-all.md)
// 그림은 새로 뽑지 않고 지금 마법사 시트를 다시 짠다 (VFX 규칙: 코드는 위치·크기·개수·궤적·타이밍·색 램프만):
//  불꽃 고리 = E36 불꽃 꽃 여럿이 기사 둘레를 고리로 돌고 발밑에 C9 마법진 (화염 회오리의 E35 깔때기를 적 발밑에 세우는 것과 다르다)
//  화염 광선 = P7 불덩이가 지팡이 끝에 맺혔다가 F16 불바다 띠를 가로로 화면 끝까지 쏘아 보낸다 (메테오의 하늘 낙하와 다르다)
//  화염탄 = P8 혜성이 포물선으로 던져져 땅에 닿으면 E36 불꽃 꽃 · 불길 폭풍 = 기사에서 사방으로 E36 불꽃 꽃이 줄지어 번져 나간다 + C3 고리
//  융합 = 두 부모의 그림을 이어 붙인다. 색은 바탕의 노란 불과 달리 짙은 잉걸 램프(붉은 주황), ★★★ 는 금빛 램프
// 모습(칸마다): a.mast 0~3 (src/tree7.js T7_STAGE_AT) — 개수·크기·금빛이 단계마다 오른다.
// 변형은 내 기사(owner 'hero')만 (t7Sh) — 결투·레이드 재생에선 기본 모양.
// 이 파일은 tree7-fx.js 뒤에 불러온다. 새 스킬 id 에만 연출을 단다 (기존 SKILL_FX 는 건드리지 않는다).

const AM_EMBER = ['#2a0608', '#8a1410', '#f0451a', '#ff9a3a', '#ffe9b0'];    // 잉걸 램프 (바탕 화염의 노란 주황과 구분)
const AM_GOLD = ['#4a1a08', '#b8481a', '#ffa030', '#ffdf6a', '#ffffff'];     // ★★★ 금빛 불
const AM_DIM = ['#1a0404', '#4a0c0c', '#7a1a14', '#a8301c', '#c85028'];      // 메아리(반투명)용 어두운 램프
const amRamp = (a) => ((a.mast || 0) >= 3 ? AM_GOLD : AM_EMBER);
const amKeys = (t, keys) => ilKeys(t, keys.slice().sort((p, q) => p[0] - q[0]));

// 자세: spin 지팡이로 원을 그린다 · thrust 치켜들었다 내리찍는다 · fan 옆으로 쓸어 던진다 · raise 하늘로 들고 버틴다
function amPose(kind) {
  return (u, a) => {
    const d = a.k ? a.k.dur : 1, t = u * d, H = a.k ? a.k.hits : [[0.5]];
    const h0 = H[0][0] * d, hL = H[H.length - 1][0] * d;
    if (kind === 'spin') {
      const k = easeOut(segU(u, 0, 0.12)) * (1 - segU(u, 0.88, 1)), s = Math.sin(t * 10);
      return { bowA: (-0.3 + 0.12 * s) * k, pull: 10 * k, dx: Math.sin(t * 10 + 1.2) * 1.2 * k, skew: 0.05 * s * k, lift: 2 * k, sy: 1 + 0.03 * k };
    }
    if (kind === 'thrust') return amKeys(t, [[0, {}], [Math.max(0.05, h0 - 0.35), { bowA: -0.6, pull: 8, dx: -1, sy: 1.02 }], [Math.max(0.1, h0 - 0.04), { bowA: -0.9, pull: 12, lift: 2, sy: 1.04 }],
      [h0 + 0.05, { bowA: 0.55, pull: 0, dx: 4, skew: 0.12, sy: 0.95 }], [Math.max(h0 + 0.5, hL + 0.3), {}]]);
    if (kind === 'fan') return amKeys(t, [[0, {}], [Math.max(0.05, h0 - 0.18), { bowA: -0.8, pull: 8, dx: -2 }], [hL + 0.05, { bowA: 0.6, pull: 0, dx: 4, skew: 0.12 }], [hL + 0.5, {}]]);
    return amKeys(t, [[0, {}], [0.25, { bowA: -1.3, pull: 10, lift: 3, sy: 1.06, skew: -0.1 }], [Math.max(0.3, hL), { bowA: -1.35, pull: 12, lift: 5, sy: 1.06 }],
      [hL + 0.12, { bowA: 0.7, pull: 0, dx: 3, sy: 0.9, skew: 0.14 }], [hL + 0.5, {}]]);
  };
}

// 불꽃 꽃 한 송이 (E36) 를 땅 가까이에 피운다
function amFlower(a, x, y, sc, delay, o = {}) {
  texFx('e36', x, y, amRamp(a), { scale: sc, life: o.life || 0.34, delay: delay || 0, fade: 0.3, rot: o.rot || 0, flip: Math.random() < 0.5 });
}
// 맞은 자리: 소용돌이 불티 (K24) — ★★ 부터 크게
function amSpark(a, x, y, sc) {
  texFx('k24', x, y, amRamp(a), { scale: sc || ((a.mast || 0) >= 2 ? 1 : 2 / 3), life: 0.26, fade: 0.3, flip: Math.random() < 0.5 });
}
// 지팡이 끝에 불덩이가 맺힌다 (P7): 2/3 → 1 → 4/3
function amChargeFx(a, until) {
  const ramp = amRamp(a);
  aFx(a, 0, until, (u) => {
    const p = ilTip(a), m = a.mast || 0, sc = m >= 3 ? (u < 0.4 ? 4 / 3 : 2) : u < 0.4 ? 1 : 4 / 3;
    vfxDraw(ctx, 'p7', ramp, mgLoop('p7', 15), p.x, p.y, { scale: sc, alpha: Math.min(1, u * 5), flip: a.dir < 0 });
    if (Math.floor(clock * 20) % 3 === 0) parts.push({ x: p.x + rand(-5, 5), y: p.y + rand(-4, 4), vx: rand(-20, 20), vy: rand(-60, -20), g: -10, size: 2, color: ramp[3], life: 0.3, t: 0, add: true });
  });
}
// 화면 끝까지 가로로 쏘는 불 줄기 (F16 불바다 띠를 이어 붙인다). y = 줄기 한가운데
function amBeam(a, y, o = {}) {
  const x0 = a.x() + a.dir * 14, x1 = a.dir > 0 ? W : 0, ramp = o.ramp || amRamp(a), sc = o.scale || 2 / 3;
  skFx(null, o.delay || 0, o.life || 0.5, (u) => {
    const len = Math.abs(x1 - x0) * easeOut(Math.min(1, u / 0.18)), al = (o.alpha == null ? 1 : o.alpha) * (u < 0.5 ? 1 : (1 - u) / 0.5);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';      // 불바다 띠의 어두운 바탕이 네모로 비치지 않게 더해 그린다
    vfxTileRun(ctx, 'f16', ramp, mgLoop('f16', 14), x0, y + 12 * sc, len, a.dir, { scale: sc, anchor: 'b', alpha: al, overlap: 6 });
    ctx.restore();
  });
}
// 기사 둘레를 도는 불꽃 고리 (E36 여럿) + 발밑 마법진 (C9). a.amOrb 에 지금 자리들을 둔다
function amOrbitFx(a, o) {
  const ramp = amRamp(a);
  a.amOrb = [];
  aFx(a, 0, o.life, (u) => {
    const al = Math.min(1, u / 0.12) * (u > 0.85 ? (1 - u) / 0.15 : 1);
    const cx = o.follow ? mix(a.x(), a.tx(), easeOut(Math.min(1, u / 0.35))) : a.x(), cy = groundY() - 26, pts = [], f = Math.floor(clock * 12);
    vfxDraw(ctx, 'c9', ramp, mgLoop('c9', 10), cx, groundY() + 2, { scale: o.grow ? 4 / 3 : 1, anchor: 'b', alpha: 0.7 * al });
    for (let j = 0; j < o.n; j++) {
      const an = -clock * 7 + (j * Math.PI * 2) / o.n;
      pts.push([cx + Math.cos(an) * o.rx, cy + Math.sin(an) * o.rx * 0.4, Math.sin(an)]);
    }
    a.amOrb = pts;
    pts.slice().sort((p, q) => p[2] - q[2]).forEach((p, j) => vfxDraw(ctx, 'e36', ramp, (f + j) % 5, p[0], p[1], { scale: o.sc, alpha: al * (p[2] < 0 ? 0.6 : 0.85), flip: j % 2 === 0 }));
  });
}
// 고리의 불꽃 하나가 대상에게 튀어 간다 (P7 불덩이가 빠르게 날아감)
function amOrbShot(a, i, targets) {
  const orbs = a.amOrb && a.amOrb.length ? a.amOrb : [[a.x(), groundY() - 26]], ramp = amRamp(a);
  targets.forEach((t, j) => {
    const [ox, oy] = orbs[(i + j) % orbs.length];
    skFx(null, 0, 0.16, (u) => vfxDraw(ctx, 'p7', ramp, mgLoop('p7', 15), mix(ox, t.x, easeIn(u)), mix(oy, t.y, easeIn(u)), { scale: 1, rot: Math.atan2(t.y - oy, t.x - ox), alpha: 1 - u * 0.3 }));
  });
}
const amOrbOpts = (a, life, small) => {
  const m = a.mast || 0, grow = t7Sh(a, 'grow'), follow = t7Sh(a, 'follow');
  const sc = grow ? 1 : 2 / 3;      // E36 은 32도트라 고리 하나하나는 작게 (불바다 grow 만 1배). ★ 단계는 개수·반지름·금빛으로 키운다
  return { life, follow, grow, n: small ? [4, 5, 6, 8][m] : [4, 6, 6, 8][m], sc: small ? 1 : sc, rx: grow ? 54 : small ? 40 + 4 * m : m >= 3 ? 48 : 30 + 4 * m };
};

// ── 불꽃 고리 (whirl) ── 불꽃 꽃이 기사 둘레를 고리로 돈다: 1칸 4송이 · ★ 6송이 · ★★ 6송이 크게 · ★★★ 8송이 금빛
//  불바다(a_grow): 고리가 넓고 마법진이 커진다 · 쫓는 불씨(a_follow): 고리가 대상에게 날아가 붙는다
SKILL_FX.am_whirl = {
  pose: amPose('spin'),
  cues: () => [[0.01, (a) => amOrbitFx(a, amOrbOpts(a, a.k.dur - 0.02))]],
  hit(a, i) { amOrbShot(a, i, a.targets(i)); },
  hitTex(a, t) { amSpark(a, t.x, t.y); },
  kb: 4,
  marks: null,
};

// ── 화염 광선 (flash) ── 지팡이 끝에 불덩이를 모았다가 화면 끝까지 불 줄기를 쏜다 (★★★ 굵고 금빛)
//  낙하의 메아리(b_after): 0.5초 뒤 어두운 줄기 한 번 더 · 삼중 열선(b_triple): 위·가운데·아래 세 줄기가 연달아
SKILL_FX.am_flash = {
  pose: amPose('thrust'),
  cues: () => [[0.01, (a) => amChargeFx(a, Math.max(0.2, a.k.hits[0][0] * a.k.dur - 0.04))]],
  hit(a, i, n) {
    if (i !== n - 1) { for (const t of a.targets(i)) { const p = ilTip(a); skFx(null, 0, 0.14, (u) => vfxDraw(ctx, 'p7', amRamp(a), mgLoop('p7', 15), mix(p.x, t.x, u), mix(p.y, t.y, u), { scale: 1, alpha: 1 - u * 0.3 })); } return; }
    const y = a.ty(), m = a.mast || 0, sc = m >= 3 ? 4 / 3 : m >= 2 ? 1 : 2 / 3;
    if (t7Sh(a, 'triple')) [-16, 0, 16].forEach((dy, j) => amBeam(a, y + dy, { delay: j * 0.09, scale: 2 / 3 }));
    else amBeam(a, y, { scale: sc });
    if (t7Sh(a, 'after')) amBeam(a, y + 3, { delay: 0.5, alpha: 0.55, ramp: AM_DIM, scale: sc });
    const p = ilTip(a); texFx('p7', p.x, p.y, amRamp(a), { scale: 2, life: 0.2, fade: 0.5, flip: a.dir < 0 });
    impact({ stop: 0.08, shake: 0.25 });
  },
  hitTex(a, t, share, i, n) {
    texFx('k23', t.x, groundY() + 2, amRamp(a), { scale: i === n - 1 && (a.mast || 0) >= 2 ? 1 : 2 / 3, life: 0.34, anchor: 'b', fade: 0.3, flip: Math.random() < 0.5 });
  },
  kb: 8,
  marks: null,
};

// ── 화염탄 (wave) ── 혜성(P8)이 포물선으로 던져져 땅에 터진다: 1칸 1발 · ★ 3발 · ★★ 5발 · ★★★ 7발 금빛. 발마다 떨어지는 거리가 다르다. 관통(k_pierce)이면 더 멀리
function amLob(a, x, y, dist, o = {}) {
  const ramp = amRamp(a), life = o.life || 0.5, yEnd = groundY() - 10, sc = o.scale || 1;
  const pos = (u) => [x + a.dir * dist * u, mix(y, yEnd, u * u) - 46 * Math.sin(Math.PI * u)];
  skFx(null, o.delay || 0, life, (u) => {
    const [px, py] = pos(u), [qx, qy] = pos(Math.min(1, u + 0.03));
    const ang = Math.atan2(qy - py, qx - px);
    for (let g = 2; g >= 1; g--) { const [gx, gy] = pos(Math.max(0, u - g * 0.06)); vfxDraw(ctx, 'p8', ramp, mgLoop('p8', 15, g), gx, gy, { scale: 2 / 3, rot: ang, flipY: a.dir < 0, alpha: 0.4 / g }); }
    vfxDraw(ctx, 'p8', ramp, mgLoop('p8', 15), px, py, { scale: sc, rot: ang, flipY: a.dir < 0 });
  }, () => { amFlower(a, x + a.dir * dist, groundY() - 14, sc >= 1 ? 1 : 2 / 3, 0); });
}
SKILL_FX.am_wave = {
  pose: amPose('fan'),
  cues: () => [],
  hit(a, i) {
    if (i) return;
    const m = a.mast || 0, n = [1, 3, 5, 7][m], g = ilTip(a), far = t7Sh(a, 'pierce') ? 1.8 : 1, y0 = Math.min(g.y, groundY() - 34);
    for (let j = 0; j < n; j++) {
      const k = n > 1 ? j / (n - 1) : 0.5, dist = (n > 1 ? 100 + 100 * k : 150) * far;
      amLob(a, g.x + a.dir * 8, y0, dist, { delay: j * 0.05, scale: m >= 3 ? 4 / 3 : 1 });
    }
    impact({ shake: 0.1 });
  },
  hitTex(a, t) { amSpark(a, t.x, t.y, 2 / 3); },
  kb: 6,
  marks: null,
};

// ── 불길 폭풍 (storm) ── 기사에서 사방으로 불꽃 꽃이 줄지어 번져 나간다: 1칸 4방향 · ★ 8방향 · ★★ 8방향 크게 · ★★★ 12방향 금빛
//  분화(k_split): 맞은 자리에서 불꽃이 두 갈래로
function amRays(a, i, n) {
  const m = a.mast || 0, cnt = [4, 8, 8, 12][m], sc = m >= 3 ? 1 : 2 / 3, reach = t7Sh(a, 'pierce') ? 2 : 1, cx = a.x(), cy = groundY() - 20;
  const k = i === 0 || i === n - 1 ? cnt : Math.max(2, cnt >> 1), rot = i * 0.4;
  for (let j = 0; j < k; j++) {
    const an = rot + (j / k) * Math.PI * 2;
    for (let r = 1; r <= reach; r++) amFlower(a, cx + Math.cos(an) * (r + 1.5) * 44, cy + Math.sin(an) * (r + 1.5) * 22, sc, r * 0.05 + j * 0.008, { rot: an * 0.3 });
  }
  mgRing(cx, amRamp(a), m >= 2 ? 1.4 : 1, 0.45);
}
SKILL_FX.am_storm = {
  pose: amPose('raise'),
  cues: () => [[0.01, (a) => {
    // 터지기 전: 기사 발밑에서 불 회오리(E35)가 차오른다 (첫 타격까지)
    const until = Math.max(0.2, a.k.hits[0][0] * a.k.dur - 0.02), ramp = amRamp(a);
    aFx(a, 0, until, (u) => vfxDraw(ctx, 'e35', ramp, mgLoop('e35', 12), a.x(), groundY() + 2, { scale: 2 / 3, anchor: 'b', sy: 0.5 + 0.5 * u, alpha: Math.min(1, u * 4) }));
  }]],
  hit(a, i, n) {
    amRays(a, i, n);
    impact({ stop: i === n - 1 ? 0.05 : 0, shake: 0.2 });
  },
  hitTex(a, t) {
    amSpark(a, t.x, t.y, 2 / 3);
    if (t7Sh(a, 'split')) for (const s of [-1, 1]) amFlower(a, t.x + a.dir * 24, t.y + s * 22, 2 / 3, 0.06);
  },
  kb: 6,
  marks: null,
};

// ── 융합 ──
// 화염 낙하: 불꽃 고리가 돌다가(불꽃 고리) 막타 직전 하늘에서 운석(E33)이 떨어져 돔 폭발(E34)
SKILL_FX.am_f_ab = {
  pose: amPose('spin'),
  cues: (a) => {
    const d = a.k.dur, hL = a.k.hits[a.k.hits.length - 1][0] * d, at = Math.max(0.03, hL - 0.34);
    return [[0.01, (a) => amOrbitFx(a, amOrbOpts(a, a.k.dur - 0.02, true))], [at / d, (a) => {
      const tx = a.tx(), ty = a.ty(), m = a.mast || 0, sc = m >= 3 ? 4 / 3 : 1, x0 = tx - a.dir * 130, y0 = -30;
      texFx('e33', x0, y0, amRamp(a), { scale: sc, life: 0.36, fade: 0.05, flip: a.dir < 0, move: (u) => [(tx - x0) * easeIn(u), (ty - y0) * easeIn(u)] });
    }]];
  },
  hit(a, i, n) {
    amOrbShot(a, i, a.targets(i));
    if (i !== n - 1) return;
    texFx('e34', a.tx(), groundY() + 2, amRamp(a), { scale: (a.mast || 0) >= 3 ? 4 / 3 : 1, life: 0.6, anchor: 'b', fade: 0.3 });
    impact({ stop: 0.1, shake: 0.35 });
  },
  hitTex(a, t) { amSpark(a, t.x, t.y); },
  kb: 8,
  marks: null,
};
// 열선 폭풍: 화염 광선이 지나간 줄을 따라 불기둥(H27)과 불꽃 꽃이 차례로 터진다
SKILL_FX.am_f_bk = {
  pose: amPose('thrust'),
  cues: () => [[0.01, (a) => amChargeFx(a, Math.max(0.2, a.k.hits[0][0] * a.k.dur - 0.04))]],
  hit(a, i, n) {
    if (i !== n - 1) { for (const t of a.targets(i)) { const p = ilTip(a); skFx(null, 0, 0.14, (u) => vfxDraw(ctx, 'p7', amRamp(a), mgLoop('p7', 15), mix(p.x, t.x, u), mix(p.y, t.y, u), { scale: 1, alpha: 1 - u * 0.3 })); } return; }
    const y = a.ty(), cnt = 4 + (a.mast || 0), m = a.mast || 0;
    if (m >= 3) [-14, 14].forEach((dy) => amBeam(a, y + dy, { scale: 4 / 3 })); else amBeam(a, y, { scale: m >= 2 ? 4 / 3 : 1 });
    for (let j = 1; j <= cnt; j++) {
      const x = a.x() + a.dir * j * 62;
      if (x < 10 || x > W - 10) break;
      texFx('h27', x, groundY() + 2, amRamp(a), { scale: m >= 2 ? 2 : 4 / 3, life: 0.4, delay: 0.1 + j * 0.07, anchor: 'b', fade: 0.3, flip: j % 2 === 0 });
      amFlower(a, x, y, m >= 3 ? 4 / 3 : 1, 0.14 + j * 0.07);
    }
    impact({ stop: 0.08, shake: 0.3 });
  },
  hitTex(a, t) { amSpark(a, t.x, t.y); },
  kb: 8,
  marks: null,
};
// 불꽃 대회전: 불꽃 고리가 돌고, 타격마다 고리의 불꽃 하나하나에서 바깥으로 불꽃이 번진다
SKILL_FX.am_f_ak = {
  pose: amPose('spin'),
  cues: () => [[0.01, (a) => amOrbitFx(a, { ...amOrbOpts(a, a.k.dur - 0.02), n: 3 + Math.min(2, a.mast || 0) })]],
  hit(a, i) {
    const orbs = a.amOrb || [], cx = a.x(), cy = groundY() - 26;
    for (const [ox, oy] of orbs) {
      const an = Math.atan2(oy - cy, (ox - cx) || 0.01);
      for (let r = 1; r <= 2; r++) amFlower(a, ox + Math.cos(an) * r * 30, oy + Math.sin(an) * r * 20, 2 / 3, r * 0.05);
    }
    amOrbShot(a, i, a.targets(i));
  },
  hitTex(a, t) { amSpark(a, t.x, t.y); },
  kb: 4,
  marks: null,
};
