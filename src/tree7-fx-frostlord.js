'use strict';
// 시즌7 스킬 빌드 트리 — 빙결의 군주 줄기(마법사 → 빙결술사 → 빙결의 군주) 새 스킬·융합 연출 (docs/specs/skill-tree-all.md)
// 그림은 새로 뽑지 않고 지금 마법사 시트를 다시 짠다 (VFX 규칙: 코드는 위치·크기·개수·궤적·타이밍·색 램프만):
//  서리 소용돌이 = P9 얼음 결정 여럿이 기사 둘레를 접선 방향으로 돈다 (★★ 부터 안쪽 고리가 거꾸로) + 발밑 C3 서리 고리 (블리자드의 E38 눈보라 타일 깔기와 다르다)
//  빙창 관통 = 지팡이 끝에 P9 결정이 맺혔다가 E37 거대 빙창이 화면 끝까지 꿰뚫고, 지난 자리에 E39b 빙판 줄이 남는다 (얼음창의 한 자루 쏘기와 다르다)
//  얼음 파편 = P9 결정이 팽이처럼 돌며 곧게 날아가 H16 서리 결정으로 깨진다 · 눈보라 폭풍 = 기사에서 사방으로 E38 눈보라 토막이 뻗고 K26 서리 막
//  융합 = 두 부모의 그림을 이어 붙인다. 색은 바탕의 푸른 얼음과 달리 창백한 청백 램프, ★★★ 는 금빛 서리
// 모습: a.mast 0~3 (찍은 모습 노드 ★·★★·★★★, src/tree7.js t7Stage) — 개수·크기·금빛이 단계마다 오른다.
// 변형은 내 기사(owner 'hero')만 (t7Sh) — 결투·레이드 재생에선 기본 모양.
// 이 파일은 tree7-fx.js 뒤에 불러온다. 새 스킬 id 에만 연출을 단다 (기존 SKILL_FX 는 건드리지 않는다).

const FL_PALE = ['#2a4a78', '#74b4dc', '#c0ecff', '#f0fcff', '#ffffff'];     // 창백한 청백 램프
const FL_GOLD = ['#4a8ac8', '#a8e0ff', '#e0f8ff', '#ffffff', '#ffffff'];     // ★★★ 눈부신 청백 서리
const FL_DIM = ['#0c1830', '#1c3458', '#2c5078', '#4a7098', '#6a90b0'];      // 메아리(반투명)용 어두운 램프
const flRamp = (a) => ((a.mast || 0) >= 3 ? FL_GOLD : FL_PALE);
const flKeys = (t, keys) => ilKeys(t, keys.slice().sort((p, q) => p[0] - q[0]));
const flSnap = (r) => Math.round(r / 0.785) * 0.785;      // 결정은 45도 단위로 돈다 (도트가 뭉개지지 않게)

// 자세: spin 지팡이를 천천히 휘젓는다 · thrust 치켜들었다 내리찍는다 · fan 옆으로 쓸어 쏜다 · raise 하늘로 들고 버틴다
function flPose(kind) {
  return (u, a) => {
    const d = a.k ? a.k.dur : 1, t = u * d, H = a.k ? a.k.hits : [[0.5]];
    const h0 = H[0][0] * d, hL = H[H.length - 1][0] * d;
    if (kind === 'spin') {
      const k = easeOut(segU(u, 0, 0.12)) * (1 - segU(u, 0.88, 1)), s = Math.sin(t * 8);
      return { bowA: (-0.5 + 0.2 * s) * k, pull: 7 * k, dx: Math.sin(t * 8 + 1) * 0.8 * k, skew: 0.04 * s * k, lift: 1 * k, sy: 1 + 0.02 * k };
    }
    if (kind === 'thrust') return flKeys(t, [[0, {}], [Math.max(0.05, h0 - 0.35), { bowA: -0.4, pull: 5, dx: -1 }], [Math.max(0.1, h0 - 0.04), { bowA: -0.6, pull: 10, lift: 1, sy: 1.03 }],
      [h0 + 0.05, { bowA: 0.4, pull: 0, dx: 3, skew: 0.08, sy: 0.97 }], [Math.max(h0 + 0.5, hL + 0.3), {}]]);
    if (kind === 'fan') return flKeys(t, [[0, {}], [Math.max(0.05, h0 - 0.18), { bowA: -0.7, pull: 7, dx: -1 }], [hL + 0.05, { bowA: 0.45, pull: 0, dx: 3, skew: 0.08 }], [hL + 0.5, {}]]);
    return flKeys(t, [[0, {}], [0.25, { bowA: -1.2, pull: 9, lift: 3, sy: 1.05, skew: -0.08 }], [Math.max(0.3, hL), { bowA: -1.25, pull: 11, lift: 4, sy: 1.05 }],
      [hL + 0.12, { bowA: 0.5, pull: 0, dx: 3, sy: 0.93, skew: 0.1 }], [hL + 0.5, {}]]);
  };
}

// 맞은 자리의 서리 막 (K26) — ★★ 부터 크게
function flFrost(a, x, y, sc) {
  texFx('k26', x, y, flRamp(a), { scale: sc || ((a.mast || 0) >= 2 ? 1 : 2 / 3), life: 0.28, fade: 0.3, flip: Math.random() < 0.5 });
}
// 얼음 결정 한 개가 (x0,y0) → (x1,y1) 로 날아간다 (P9). spin 이면 팽이처럼 돈다. 끝에서 H16 서리 결정으로 깨진다
function flShard(a, x0, y0, x1, y1, o = {}) {
  const ramp = flRamp(a), life = o.life || 0.3, ang = Math.atan2(y1 - y0, x1 - x0), sc = o.scale || 1, ph = rand(0, 6);
  skFx(null, o.delay || 0, life, (u) => {
    const k = o.ease === 'in' ? easeIn(u) : easeOut(u), x = mix(x0, x1, k), y = mix(y0, y1, k), al = u > 0.8 ? (1 - u) / 0.2 : 1;
    if (o.lance) {
      const fy = Math.cos(ang) < 0;
      for (let g = o.big ? 5 : 3; g >= 1; g--) { const kk = Math.max(0, k - g * 0.07); vfxDraw(ctx, 'e37', ramp, 0, mix(x0, x1, kk), mix(y0, y1, kk), { scale: sc, rot: ang, flipY: fy, alpha: (o.big ? 0.5 : 0.3) / g * al }); }
      vfxDraw(ctx, 'e37', ramp, 0, x, y, { scale: sc, rot: ang, flipY: fy, alpha: al });
      return;
    }
    for (let g = 3; g >= 1; g--) { const kk = Math.max(0, k - g * 0.08); vfxDraw(ctx, 'p9', ramp, 0, mix(x0, x1, kk), mix(y0, y1, kk), { scale: 2 / 3, rot: o.spin ? flSnap(ph + clock * 10 - g) : ang, alpha: 0.35 / g * al }); }
    vfxDraw(ctx, 'p9', ramp, 0, x, y, { scale: sc, rot: o.spin ? flSnap(ph + clock * 10) : ang, alpha: al });
  }, o.shatter === false ? null : () => (o.lance ? (texFx('k25', x1, y1, ramp, { scale: o.big ? 4 / 3 : 2 / 3, life: 0.32, fade: 0.4, flip: Math.random() < 0.5 }), o.big && texFx('h16', x1, y1, ramp, { scale: 4 / 3, life: 0.26, fade: 0.4 })) : texFx('h16', x1, y1, ramp, { scale: 2 / 3, life: 0.22, fade: 0.4, flip: Math.random() < 0.5 })));
}
// 지팡이 끝에 결정이 맺힌다 (P9): 1 → 4/3 → 2 로 부푼다
function flChargeFx(a, until) {
  const ramp = flRamp(a);
  aFx(a, 0, until, (u) => {
    const p = ilTip(a), sc = u < 0.4 ? 1 : u < 0.8 ? 4 / 3 : 2;
    vfxDraw(ctx, 'p9', ramp, 0, p.x, p.y, { scale: sc, rot: flSnap(clock * 6), alpha: Math.min(1, u * 5) });
    vfxDraw(ctx, 'p9', ramp, 0, p.x, p.y, { scale: 2 / 3, rot: flSnap(clock * 6 + 0.785), alpha: Math.min(1, u * 5) * 0.8 });
  });
}
// 화면 끝까지 꿰뚫는 빙창 (E37, 끝이 오른쪽) + 지난 자리에 남는 빙판 줄 (E39b). y 높이, ★★★ 는 2배 크기
function flLance(a, y, o = {}) {
  const x0 = a.x() + a.dir * 14, x1 = a.dir > 0 ? W + 80 : -80, ramp = o.ramp || flRamp(a), sc = o.scale || 1, sp = 48 * sc * VFX_DOT;
  skFx(null, o.delay || 0, o.life || 0.5, (u) => {
    const head = mix(x0, x1, easeIn(Math.min(1, u / 0.32))), al = (o.alpha == null ? 1 : o.alpha) * (u < 0.55 ? 1 : (1 - u) / 0.45);
    const len = Math.abs(head - x0);
    vfxTileRun(ctx, 'e39b', ramp, 0, x0, y + 2, len, a.dir, { scale: 2 / 3, alpha: 0.7 * al, overlap: 4 });
    for (let g = 1; g <= 3; g++) { const gx = head - a.dir * g * sp * 0.55; if ((gx - x0) * a.dir > 0) vfxDraw(ctx, 'e37', ramp, 0, gx, y, { scale: sc, flip: a.dir < 0, alpha: 0.4 * al / g }); }
    vfxDraw(ctx, 'e37', ramp, 0, head, y, { scale: sc, sx: sc >= 2 ? 1.5 : 1, flip: a.dir < 0, alpha: al });
  });
}
// 기사 둘레를 도는 얼음 결정 고리 (P9 여럿, 접선 방향) + 발밑 서리 고리 (C3). a.flOrb 에 지금 자리들을 둔다
function flOrbitFx(a, o) {
  const ramp = flRamp(a);
  a.flOrb = [];
  aFx(a, 0, o.life, (u) => {
    const al = Math.min(1, u / 0.12) * (u > 0.85 ? (1 - u) / 0.15 : 1);
    const cx = o.follow ? mix(a.x(), a.tx(), easeOut(Math.min(1, u / 0.35))) : a.x(), cy = groundY() - 26, pts = [];
    vfxDraw(ctx, 'c3', ramp, mgLoop('c3', 8), cx, groundY() + 2, { scale: o.grow ? 1 : 2 / 3, anchor: 'b', alpha: 0.6 * al });
    const ring = (n, r, dirn, sc) => {
      for (let j = 0; j < n; j++) {
        const an = clock * 5 * dirn + (j * Math.PI * 2) / n, x = cx + Math.cos(an) * r, y = cy + Math.sin(an) * r * 0.42;
        pts.push([x, y, an]);
        vfxDraw(ctx, 'p9', ramp, 0, x, y, { scale: sc, rot: flSnap(an + Math.PI / 2 + (dirn < 0 ? Math.PI : 0)), alpha: al * (Math.sin(an) < 0 ? 0.7 : 1) });
      }
    };
    if (o.n2) { ring(o.n - o.n2, o.rx, 1, o.sc); ring(o.n2, o.rx * 0.6, -1, o.sc > 1 ? 1 : 2 / 3); }
    else ring(o.n, o.rx, 1, o.sc);
    a.flOrb = pts;
  });
}
// 고리의 결정 하나가 대상에게 꽂힌다
function flOrbShot(a, i, targets) {
  const orbs = a.flOrb && a.flOrb.length ? a.flOrb : [[a.x(), groundY() - 26]];
  targets.forEach((t, j) => { const [ox, oy] = orbs[(i + j) % orbs.length]; flShard(a, ox, oy, t.x, t.y, { life: 0.16, scale: 4 / 3, ease: 'in' }); });
}
const flOrbOpts = (a, life, small) => {
  const m = a.mast || 0, grow = t7Sh(a, 'grow'), follow = t7Sh(a, 'follow'), n = small ? [3, 4, 6, 8][m] : [4, 6, 8, 10][m];
  return { life, follow, grow, n, n2: m >= 2 ? Math.floor(n / 3) : 0, sc: grow ? (m >= 3 ? 2 : 4 / 3) : m >= 2 ? 4 / 3 : 1, rx: grow ? 50 : 30 + 4 * m };
};

// ── 서리 소용돌이 (whirl) ── 얼음 결정이 기사 둘레를 돈다: 1칸 4개 · ★ 6개 · ★★ 8개(안쪽 고리는 거꾸로) · ★★★ 10개 금빛
//  한파 확산(a_grow): 결정이 한 단계 크고 고리가 넓다 · 쫓는 서리(a_follow): 고리가 대상에게 날아가 붙는다
SKILL_FX.fl_whirl = {
  pose: flPose('spin'),
  cues: () => [[0.01, (a) => flOrbitFx(a, flOrbOpts(a, a.k.dur - 0.02))]],
  hit(a, i) { flOrbShot(a, i, a.targets(i)); },
  hitTex(a, t) { flFrost(a, t.x, t.y); },
  kb: 4,
  marks: null,
};

// ── 빙창 관통 (flash) ── 지팡이 끝에 결정을 모았다가 화면 끝까지 거대한 빙창이 꿰뚫는다: ★★★ 는 2배 크기 금빛 서리
//  서리 메아리(b_after): 0.5초 뒤 어두운 빙창 한 번 더 · 삼중 빙창(b_triple): 위·가운데·아래 세 자루가 연달아
SKILL_FX.fl_flash = {
  pose: flPose('thrust'),
  cues: () => [[0.01, (a) => flChargeFx(a, Math.max(0.2, a.k.hits[0][0] * a.k.dur - 0.04))]],
  hit(a, i, n) {
    if (i !== n - 1) { const p = ilTip(a); for (const t of a.targets(i)) flShard(a, p.x, p.y, t.x, t.y, { life: 0.14, scale: 4 / 3, ease: 'in' }); return; }
    const y = a.ty(), m = a.mast || 0, sc = m >= 3 ? 2 : m >= 2 ? 4 / 3 : 1;
    if (t7Sh(a, 'triple')) [-16, 0, 16].forEach((dy, j) => flLance(a, y + dy, { delay: j * 0.09, scale: 1 }));
    else flLance(a, y, { scale: sc });
    if (t7Sh(a, 'after')) flLance(a, y + 3, { delay: 0.5, alpha: 0.55, ramp: FL_DIM, scale: sc });
    impact({ stop: 0.08, shake: 0.25 });
  },
  hitTex(a, t, share, i, n) { texFx('k25', t.x, t.y, flRamp(a), { scale: i === n - 1 && (a.mast || 0) >= 2 ? 4 / 3 : 2 / 3, life: 0.4, fade: 0.35, flip: Math.random() < 0.5 }); },
  kb: 8,
  marks: null,
};

// ── 얼음 파편 (wave) ── 얼음 결정이 팽이처럼 돌며 부채꼴로 날아간다: 1칸 1발 · ★ 3발 · ★★ 5발 · ★★★ 7발 크게 금빛. 관통(k_pierce)이면 더 멀리
SKILL_FX.fl_wave = {
  pose: flPose('fan'),
  cues: () => [],
  hit(a, i) {
    if (i) return;
    const m = a.mast || 0, n = [1, 3, 5, 7][m], g = ilTip(a), dist = t7Sh(a, 'pierce') ? 320 : 180, y0 = Math.min(g.y, groundY() - 34);
    for (let j = 0; j < n; j++) {
      const ang = (a.dir > 0 ? 0 : Math.PI) + (n > 1 ? (j / (n - 1) - 0.6) * 0.55 : -0.04) * a.dir;
      flShard(a, g.x + a.dir * 8, y0, g.x + a.dir * 8 + Math.cos(ang) * dist, y0 + Math.sin(ang) * dist, { delay: j * 0.03, scale: [2 / 3, 2 / 3, 1, 2][m], lance: true, big: m >= 3, life: 0.4 });
    }
    impact({ shake: 0.1 });
  },
  hitTex(a, t) { flFrost(a, t.x, t.y, 2 / 3); },
  kb: 6,
  marks: null,
};

// ── 눈보라 폭풍 (storm) ── 기사에서 사방으로 눈보라 토막(E38)이 뻗고 끝마다 서리 막(K26):
//  1칸 4방향 · ★ 8방향 · ★★ 8방향 크게 · ★★★ 12방향 금빛. 분열(k_split)이면 맞은 자리에서 파편이 두 갈래
function flRays(a, i, n) {
  const m = a.mast || 0, cnt = [4, 8, 8, 12][m], sc = m >= 3 ? 1 : 2 / 3, len = t7Sh(a, 'pierce') ? 130 : 105, cx = a.x(), cy = groundY() - 26, ramp = flRamp(a);
  const k = i === 0 || i === n - 1 ? cnt : Math.max(2, cnt >> 1), rot = i * 0.4;
  for (let j = 0; j < k; j++) {
    const an = rot + (j / k) * Math.PI * 2, dx = Math.cos(an), dy = Math.sin(an) * 0.6;
    for (let r = 0; r < (m >= 2 ? 1 : 2); r++) {
      const d0 = (r + 0.7) * (len / 2.2);
      texFx('e38', cx + dx * d0, cy + dy * d0, ramp, { scale: sc, life: 0.4, delay: r * 0.04 + j * 0.006, fade: 0.4, rot: Math.cos(an) < 0 ? an + Math.PI : an, flip: Math.cos(an) < 0,
        crop: [0, 0.5], move: (u) => [dx * 34 * u, dy * 34 * u] });
    }
    if (m >= 2) texFx('f19', cx + dx * len, cy + dy * len, ramp, { scale: 2 / 3, life: 0.4, delay: 0.14 + j * 0.006, fade: 0.4, frames: 5 });
    else texFx('k26', cx + dx * len, cy + dy * len, ramp, { scale: 2 / 3, life: 0.26, delay: 0.14 + j * 0.006, fade: 0.4, frames: 5 });
  }
}
SKILL_FX.fl_storm = {
  pose: flPose('raise'),
  cues: () => [],
  hit(a, i, n) {
    flRays(a, i, n);
    mgRing(a.x(), flRamp(a), (a.mast || 0) >= 2 ? 1.4 : 1, 0.45);
    impact({ stop: i === n - 1 ? 0.05 : 0, shake: 0.2 });
  },
  hitTex(a, t) {
    flFrost(a, t.x, t.y, 2 / 3);
    if (t7Sh(a, 'split')) for (const s of [-1, 1]) flShard(a, t.x, t.y, t.x + a.dir * 34, t.y + s * 34, { life: 0.24, scale: 1, spin: true });
  },
  kb: 6,
  marks: null,
};

// ── 융합 ──
// 빙설 관통: 결정 고리가 돌다가(서리 소용돌이) 막타 직전 거대 빙창(E37b, 끝이 아래)이 하늘에서 내리꽂힌다
SKILL_FX.fl_f_ab = {
  pose: flPose('spin'),
  cues: (a) => {
    const d = a.k.dur, hL = a.k.hits[a.k.hits.length - 1][0] * d, at = Math.max(0.03, hL - 0.3);
    return [[0.01, (a) => flOrbitFx(a, flOrbOpts(a, a.k.dur - 0.02, true))], [at / d, (a) => {
      const tx = a.tx(), ty = a.ty(), m = a.mast || 0, sc = m >= 3 ? 2 : m >= 2 ? 4 / 3 : 1, h = 92 * sc * VFX_DOT;
      for (const ox of m >= 3 ? [-46, 0, 46] : [0]) texFx('e37b', tx + ox * a.dir, 0, flRamp(a), { scale: ox ? 4 / 3 : sc, life: 0.3, fade: 0.05, frames: 1, move: (u) => [0, (ty - h / 2 + 10) * easeIn(u) - 40 * (1 - u)] });
    }]];
  },
  hit(a, i, n) {
    flOrbShot(a, i, a.targets(i));
    if (i !== n - 1) return;
    const m = a.mast || 0;
    texFx('e39', a.tx(), groundY() + 2, flRamp(a), { scale: m >= 3 ? 2 : 1, life: 0.5, anchor: 'b', fade: 0.3 });
    if (m >= 3) texFx('k25', a.tx(), a.ty(), flRamp(a), { scale: 2, life: 0.4, fade: 0.4 });
    flLance(a, a.ty(), { scale: m >= 3 ? 2 : 1 });      // 관통: 막타에 빙창이 줄로 꿰뚫는다
    if (m >= 3) for (const dx of [-50, 50]) texFx('e39', a.tx() + dx, groundY() + 2, flRamp(a), { scale: 1, life: 0.5, delay: 0.08, anchor: 'b', fade: 0.3 });
    impact({ stop: 0.1, shake: 0.35 });
  },
  hitTex(a, t) { flFrost(a, t.x, t.y); },
  kb: 8,
  marks: null,
};
// 빙창 폭풍: 빙창이 지나간 줄을 따라 프리즘 결정(E39)이 차례로 솟았다 깨진다
SKILL_FX.fl_f_bk = {
  pose: flPose('thrust'),
  cues: () => [[0.01, (a) => flChargeFx(a, Math.max(0.2, a.k.hits[0][0] * a.k.dur - 0.04))]],
  hit(a, i, n) {
    if (i !== n - 1) { const p = ilTip(a); for (const t of a.targets(i)) flShard(a, p.x, p.y, t.x, t.y, { life: 0.14, scale: 4 / 3, ease: 'in' }); return; }
    const y = a.ty(), m = a.mast || 0, cnt = 5 + m;
    flLance(a, y, { scale: m >= 3 ? 2 : m >= 2 ? 4 / 3 : 1 });
    for (let j = 1; j <= cnt; j++) {
      const x = a.x() + a.dir * j * 56;
      if (x < 10 || x > W - 10) break;
      texFx('e39', x, groundY() + 2, flRamp(a), { scale: m >= 3 ? 4 / 3 : 1, life: 0.55, delay: 0.1 + j * 0.07, anchor: 'b', fade: 0.3, flip: j % 2 === 0 });
    }
    impact({ stop: 0.08, shake: 0.3 });
  },
  hitTex(a, t) { flFrost(a, t.x, t.y); },
  kb: 8,
  marks: null,
};
// 파편 소용돌이: 결정 고리가 돌고, 타격마다 고리의 결정 하나하나가 바깥으로 쏘아져 깨진다
SKILL_FX.fl_f_ak = {
  pose: flPose('spin'),
  cues: () => [[0.01, (a) => flOrbitFx(a, { ...flOrbOpts(a, a.k.dur - 0.02), n: 4 + Math.min(2, a.mast || 0), n2: 0 })]],
  hit(a, i) {
    const orbs = a.flOrb || [], cx = a.x(), cy = groundY() - 26;
    for (const [ox, oy] of orbs) {
      const an = Math.atan2(oy - cy, (ox - cx) || 0.01);
      flShard(a, ox, oy, ox + Math.cos(an) * 80, oy + Math.sin(an) * 56, { life: 0.26, scale: 1, spin: true });
    }
    flOrbShot(a, i, a.targets(i));
  },
  hitTex(a, t) { flFrost(a, t.x, t.y); },
  kb: 4,
  marks: null,
};
