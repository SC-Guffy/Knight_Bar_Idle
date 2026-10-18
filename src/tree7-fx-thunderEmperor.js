'use strict';
// 시즌7 스킬 빌드 트리 — 뇌제 줄기(마법사 → 뇌전술사 → 뇌제) 새 스킬·융합 연출 (docs/specs/skill-tree-all.md)
// 그림은 새로 뽑지 않고 지금 마법사 시트를 다시 짠다 (VFX 규칙: 코드는 위치·크기·개수·궤적·타이밍·색 램프만):
//  뇌전 구체 = E41 구전 여럿이 기사 둘레를 돌며 P11 번개 줄로 서로·기사와 이어진다 (연쇄 번개의 구전 하나 굴리기와 다르다)
//  섬뢰 = 지팡이 끝에 E41 전하가 맺혔다가 P11/P12 번개 줄이 화면 끝까지 가로로 꽂힌다 (마력 폭발의 한 발 폭발과 다르다)
//  뇌전 화살 = P11 번개 줄 토막이 부채꼴로 날아가는 화살 + P4 촉 · 뇌운 폭풍 = C15 먹구름 + 기사 가슴에서 사방으로 뻗는 번개 + K27 연결 방전
//  융합 = 두 부모의 그림을 이어 붙인다. 색은 바탕 스킬의 연보라와 달리 청백 램프, ★★★ 는 뇌제 금빛 (MG_RAMP.tempest)
// 모습(칸마다): a.mast 0~3 (src/tree7.js T7_STAGE_AT) — 개수·크기·금빛이 단계마다 오른다.
// 변형은 내 기사(owner 'hero')만 (t7Sh) — 결투·레이드 재생에선 기본 모양.
// 이 파일은 tree7-fx.js 뒤에 불러온다. 새 스킬 id 에만 연출을 단다 (기존 SKILL_FX 는 건드리지 않는다).

const TE_COOL = ['#241a5c', '#5a56d4', '#a6b0ff', '#e4ecff', '#ffffff'];     // 청백 번개 램프 (바탕 연쇄 번개의 연보라와 구분)
const TE_DIM = ['#12103a', '#26276e', '#40449a', '#5c62b8', '#7e86d0'];      // 메아리(반투명)용 어두운 램프
const teRamp = (a) => ((a.mast || 0) >= 3 ? mgRamp('tempest', 3) : TE_COOL);
const teSheet = (a) => ((a.mast || 0) >= 3 ? 'p12' : 'p11');
const teKeys = (t, keys) => ilKeys(t, keys.slice().sort((p, q) => p[0] - q[0]));

// 자세: spin 지팡이를 휘젓는다 · thrust 치켜들었다 내리찍는다 · fan 옆으로 쓸어 쏜다 · raise 하늘로 들고 버틴다
function tePose(kind) {
  return (u, a) => {
    const d = a.k ? a.k.dur : 1, t = u * d, H = a.k ? a.k.hits : [[0.5]];
    const h0 = H[0][0] * d, hL = H[H.length - 1][0] * d;
    if (kind === 'spin') {
      const k = easeOut(segU(u, 0, 0.12)) * (1 - segU(u, 0.88, 1)), s = Math.sin(t * 14);
      return { bowA: (-0.45 + 0.3 * s) * k, pull: 9 * k, dx: Math.sin(t * 14 + 1.2) * 1.2 * k, skew: 0.06 * s * k, lift: 2 * k, sy: 1 + 0.03 * k };
    }
    if (kind === 'thrust') return teKeys(t, [[0, {}], [Math.max(0.05, h0 - 0.3), { bowA: -0.5, pull: 6, dx: -1 }], [Math.max(0.1, h0 - 0.04), { bowA: -1.1, pull: 12, lift: 3, sy: 1.05, skew: -0.1 }],
      [h0 + 0.05, { bowA: 0.7, pull: 0, dx: 4, skew: 0.14, sy: 0.94 }], [Math.max(h0 + 0.5, hL + 0.3), {}]]);
    if (kind === 'fan') return teKeys(t, [[0, {}], [Math.max(0.05, h0 - 0.15), { bowA: -0.9, pull: 8, dx: -1 }], [hL + 0.05, { bowA: 0.5, pull: 0, dx: 3, skew: 0.1 }], [hL + 0.45, {}]]);
    return teKeys(t, [[0, {}], [0.25, { bowA: -1.3, pull: 10, lift: 3, sy: 1.06, skew: -0.1 }], [Math.max(0.3, hL), { bowA: -1.35, pull: 12, lift: 5, sy: 1.06 }],
      [hL + 0.12, { bowA: 0.6, pull: 0, dx: 3, sy: 0.92, skew: 0.12 }], [hL + 0.5, {}]]);
  };
}

// 맞은 자리의 연결 방전 (K27): ★★ 부터 크게
function teZap(a, x, y, sc) {
  texFx('k27', x, y, teRamp(a), { life: 0.24, scale: sc || ((a.mast || 0) >= 2 ? 1 : 2 / 3), fade: 0.35, flip: Math.random() < 0.5 });
}
// 지팡이 끝에 전하가 맺힌다 (E41): 2/3 → 1 → 4/3 로 부푼다. 끝나면 작은 번개 가닥이 튄다
function teChargeFx(a, until) {
  const ramp = teRamp(a);
  aFx(a, 0, until, (u) => {
    const p = ilTip(a), sc = u < 0.4 ? 2 / 3 : u < 0.8 ? 1 : 4 / 3;
    vfxDraw(ctx, 'e41', ramp, mgLoop('e41', 14), p.x, p.y, { scale: sc, alpha: Math.min(1, u * 5), flip: Math.floor(clock * 7) % 2 === 0 });
    if (Math.floor(clock * 18) % 3 === 0) { const an = rand(0, Math.PI * 2); mgBolt(p.x, p.y, p.x + Math.cos(an) * 16 * sc, p.y + Math.sin(an) * 12 * sc, ramp, { scale: 2 / 3, alpha: 0.8 }); }
  });
}
// 화면 끝까지 가로로 꽂히는 번개 한 줄 (P11 가는 줄 / ★★★ P12 굵은 금빛 마디). y 높이, 기사 앞 → 화면 끝
function teLine(a, y, o = {}) {
  const x0 = a.x() + a.dir * 14, x1 = a.dir > 0 ? W : 0, ramp = o.ramp || teRamp(a), sheet = teSheet(a), sc = o.scale || 2 / 3, seed = rand(0, 90);
  skFx(null, o.delay || 0, o.life || 0.4, (u) => {
    if (u > 0.55 && Math.floor(u * 30) % 2) return;
    const xe = mix(x0, x1, easeOut(Math.min(1, u / 0.15))), al = (o.alpha == null ? 1 : o.alpha) * (1 - u * 0.6);
    mgBolt(x0, y, xe, y, ramp, { sheet, scale: sc, seed, alpha: al, jag: 0.5 });
    mgBolt(x0, y + 3, xe, y + 3, ramp, { sheet, scale: 2 / 3, seed: seed + 7, alpha: al * 0.6, jag: 0.8 });
  });
}
// 기사 둘레를 도는 구전 여럿 (E41) — P11 줄로 서로·기사 가슴과 이어진다. a.teOrb 에 지금 자리들을 둔다
function teOrbitFx(a, o) {
  const ramp = teRamp(a);
  a.teOrb = [];
  aFx(a, 0, o.life, (u) => {
    const al = Math.min(1, u / 0.12) * (u > 0.85 ? (1 - u) / 0.15 : 1);
    const cx = o.follow ? mix(a.x(), a.tx(), easeOut(Math.min(1, u / 0.35))) : a.x(), cy = groundY() - 30, pts = [];
    for (let j = 0; j < o.n; j++) {
      const an = clock * 8 + (j * Math.PI * 2) / o.n;
      pts.push([cx + Math.cos(an) * o.rx, cy + Math.sin(an) * o.rx * 0.45]);
    }
    a.teOrb = pts;
    const f = Math.floor(clock * 14);
    for (let j = 0; j < pts.length; j++) {
      const [x, y] = pts[j];
      if (Math.floor(clock * 15 + j) % 3) mgBolt(cx, cy, x, y, ramp, { scale: 2 / 3, seed: j * 5, alpha: 0.65 * al });
      if (pts.length > 1 && (pts.length > 2 || j === 0)) { const [nx, ny] = pts[(j + 1) % pts.length]; mgBolt(x, y, nx, ny, ramp, { scale: 2 / 3, seed: j * 9 + 3, alpha: 0.8 * al }); }
    }
    for (let j = 0; j < pts.length; j++) vfxDraw(ctx, 'e41', ramp, (f + j) % 5, pts[j][0], pts[j][1], { scale: o.sc, alpha: al, flip: (f + j) % 2 === 0 });
  });
}
// 구전에서 대상으로 튀는 번개 (구전이 없으면 기사 가슴에서)
function teOrbZap(a, i, targets) {
  const orbs = a.teOrb && a.teOrb.length ? a.teOrb : [[a.x(), groundY() - 30]];
  targets.forEach((t, j) => {
    const [ox, oy] = orbs[(i + j) % orbs.length];
    mgArcFx(ox, oy, t.x, t.y, teRamp(a), 0.16, { scale: 2 / 3 });
  });
}
const teOrbOpts = (a, life, small) => {
  const m = a.mast || 0, grow = t7Sh(a, 'grow'), follow = t7Sh(a, 'follow');
  const sc = grow ? (m >= 3 ? 2 : 4 / 3) : m >= 2 ? 1 : 2 / 3;
  return { life, follow, n: small ? Math.max(1, m + 1 - (m >= 2 ? 1 : 0)) : [1, 2, 3, 4][m], sc, rx: grow ? 48 : 30 + 4 * m };
};

// ── 뇌전 구체 (whirl) ── 구전이 기사 둘레를 돈다: 1칸 하나 · ★ 둘 · ★★ 셋 크게 · ★★★ 넷 금빛
//  정전기 폭주(a_grow): 한 단계 큰 구전이 넓게 · 쫓는 뇌구(a_follow): 구전들이 대상에게 날아가 붙는다
SKILL_FX.te_whirl = {
  pose: tePose('spin'),
  cues: (a) => [[0.01, (a) => teOrbitFx(a, teOrbOpts(a, a.k.dur - 0.02))]],
  hit(a, i) { teOrbZap(a, i, a.targets(i)); },
  hitTex(a, t) { teZap(a, t.x, t.y); },
  kb: 4,
  marks: null,
};

// ── 섬뢰 (flash) ── 지팡이 끝에 전하를 모았다가 화면 끝까지 한 줄기 번개: ★★★ 는 굵은 금빛 줄
//  메아리 벼락(b_after): 0.5초 뒤 어두운 줄 한 번 더 · 삼중 벼락(b_triple): 위·가운데·아래 세 줄이 연달아
SKILL_FX.te_flash = {
  pose: tePose('thrust'),
  cues: (a) => [[0.01, (a) => teChargeFx(a, Math.max(0.2, a.k.hits[0][0] * a.k.dur - 0.04))]],
  hit(a, i, n) {
    if (i !== n - 1) { for (const t of a.targets(i)) mgArcFx(ilTip(a).x, ilTip(a).y, t.x, t.y, teRamp(a), 0.14, { scale: 2 / 3 }); return; }
    const y = a.ty(), m = a.mast || 0, sc = m >= 3 ? 1 : 2 / 3;
    if (t7Sh(a, 'triple')) [-14, 0, 14].forEach((dy, j) => teLine(a, y + dy, { delay: j * 0.09, scale: 2 / 3 }));
    else teLine(a, y, { scale: sc });
    if (t7Sh(a, 'after')) teLine(a, y + 3, { delay: 0.5, alpha: 0.55, ramp: TE_DIM, scale: sc });
    const p = ilTip(a); texFx('e41', p.x, p.y, teRamp(a), { scale: 4 / 3, life: 0.2, fade: 0.5 });
    impact({ stop: 0.08, shake: 0.25 });
  },
  hitTex(a, t, share, i, n) { teZap(a, t.x, t.y, i === n - 1 && (a.mast || 0) >= 2 ? 4 / 3 : null); },
  kb: 8,
  marks: null,
};

// ── 뇌전 화살 (wave) ── 번개 줄 토막(P11/P12) 화살이 부채꼴로 날아간다: 1칸 1발 · ★ 3발 · ★★ 5발 · ★★★ 7발 금빛. 관통(k_pierce)이면 더 멀리
function teArrow(a, x, y, ang, dist, o = {}) {
  const ramp = teRamp(a), sheet = teSheet(a), seed = rand(0, 90), life = o.life || 0.34, cs = Math.cos(ang), sn = Math.sin(ang), sc = o.scale || 2 / 3;
  skFx(null, o.delay || 0, life, (u) => {
    const d = dist * easeOut(u), hx = x + cs * d, hy = y + sn * d, tl = Math.min(d, 56), al = u > 0.7 ? (1 - u) / 0.3 : 1;
    mgBolt(hx - cs * tl, hy - sn * tl, hx, hy, ramp, { sheet, scale: sc, seed, alpha: al, jag: 0.35 });
    vfxDraw(ctx, 'p4', ramp, mgLoop('p4', 15), hx, hy, { scale: sc >= 1 ? 4 / 3 : 1, rot: ang, alpha: al });
  }, () => texFx('k27', x + cs * dist, y + sn * dist, ramp, { scale: 2 / 3, life: 0.18, fade: 0.4, frames: 3 }));
}
SKILL_FX.te_wave = {
  pose: tePose('fan'),
  cues: () => [],
  hit(a, i) {
    if (i) return;
    const m = a.mast || 0, n = [1, 3, 5, 7][m], g = ilTip(a), dist = t7Sh(a, 'pierce') ? 320 : 180, y0 = Math.min(g.y, groundY() - 34);
    for (let j = 0; j < n; j++) {
      const ang = (a.dir > 0 ? 0 : Math.PI) + (n > 1 ? (j / (n - 1) - 0.6) * 0.55 : -0.04) * a.dir;
      teArrow(a, g.x + a.dir * 8, y0, ang, dist, { delay: j * 0.03, scale: m >= 3 ? 1 : 2 / 3 });
    }
    impact({ shake: 0.1 });
  },
  hitTex(a, t) { teZap(a, t.x, t.y, 2 / 3); },
  kb: 6,
  marks: null,
};

// ── 뇌운 폭풍 (storm) ── 기사 머리 위에 먹구름(C15)이 뜨고, 가슴에서 사방으로 번개가 뻗는다:
//  1칸 4방향 · ★ 8방향 · ★★ 8방향 크게 · ★★★ 12방향 금빛. 분기 번개(k_split)면 맞은 자리에서 두 갈래
function teRays(a, i, n, o = {}) {
  const m = a.mast || 0, cnt = [4, 8, 8, 12][m], rot = i * 0.42, len = o.len || (t7Sh(a, 'pierce') ? 150 : 120), cx = a.x(), cy = groundY() - 30, ramp = teRamp(a);
  const k = i === 0 || i === n - 1 ? cnt : Math.max(2, cnt >> 1);
  for (let j = 0; j < k; j++) {
    const an = rot + (j / k) * Math.PI * 2, ex = cx + Math.cos(an) * len, ey = cy + Math.sin(an) * len * 0.6;
    mgArcFx(cx, cy, ex, ey, ramp, 0.3, { scale: m >= 2 ? 1 : 2 / 3, jag: 0.4 }, j * 0.012);
    texFx('k27', ex, ey, ramp, { scale: 2 / 3, life: 0.22, delay: 0.05 + j * 0.012, fade: 0.4, frames: 3 });
  }
}
SKILL_FX.te_storm = {
  pose: tePose('raise'),
  cues: () => [[0.01, (a) => {
    const ramp = TE_DIM, life = a.k.dur - 0.02, cx = a.x();
    aFx(a, 0, life, (u) => {
      const k = Math.min(1, u / 0.15) * (u > 0.85 ? (1 - u) / 0.15 : 1);
      for (let j = -1; j <= 1; j++) vfxDraw(ctx, 'c15', ramp, mgLoop('c15', 5, j + 1), cx + j * 40, 12 + (j ? 3 : -3), { scale: (a.mast || 0) >= 2 ? 4 / 3 : 1, flip: j > 0, alpha: 0.75 * k });
    });
  }]],
  hit(a, i, n) {
    teRays(a, i, n);
    const p = { x: a.x(), y: groundY() - 30 };
    texFx('e41', p.x, p.y, teRamp(a), { scale: 4 / 3, life: 0.22, fade: 0.5 });
    impact({ stop: i === n - 1 ? 0.05 : 0, shake: 0.2 });
  },
  hitTex(a, t) {
    teZap(a, t.x, t.y, 2 / 3);
    if (t7Sh(a, 'split')) for (const s of [-1, 1]) mgArcFx(t.x, t.y, t.x + s * 40 * a.dir + 14 * a.dir, t.y + s * 34, teRamp(a), 0.22, { scale: 2 / 3 });
  },
  kb: 6,
  marks: null,
};

// ── 융합 ──
// 뇌광 연쇄: 구전이 돌다가(뇌전 구체) 막타에 화면 끝까지 번개 한 줄(섬뢰)
SKILL_FX.te_f_ab = {
  pose: tePose('spin'),
  cues: (a) => [[0.01, (a) => teOrbitFx(a, teOrbOpts(a, a.k.dur - 0.02, true))]],
  hit(a, i, n) {
    teOrbZap(a, i, a.targets(i));
    if (i !== n - 1) return;
    teLine(a, a.ty(), { scale: (a.mast || 0) >= 3 ? 1 : 2 / 3 });
    impact({ stop: 0.1, shake: 0.3 });
  },
  hitTex(a, t) { teZap(a, t.x, t.y); },
  kb: 8,
  marks: null,
};
// 섬전 폭풍: 섬뢰가 지난 줄을 따라 작은 먹구름이 남았다가 차례로 터진다 (구름 아래로 E42 기둥 번개)
SKILL_FX.te_f_bk = {
  pose: tePose('thrust'),
  cues: (a) => [[0.01, (a) => teChargeFx(a, Math.max(0.2, a.k.hits[0][0] * a.k.dur - 0.04))]],
  hit(a, i, n) {
    if (i !== n - 1) { for (const t of a.targets(i)) mgArcFx(ilTip(a).x, ilTip(a).y, t.x, t.y, teRamp(a), 0.14, { scale: 2 / 3 }); return; }
    const y = a.ty(), ramp = teRamp(a), cnt = 4 + (a.mast || 0);
    teLine(a, y, { scale: (a.mast || 0) >= 3 ? 1 : 2 / 3 });
    for (let j = 1; j <= cnt; j++) {
      const x = a.x() + a.dir * j * 64;
      if (x < 10 || x > W - 10) break;
      const d = 0.1 + j * 0.07;
      texFx('c15', x, y - 46, TE_DIM, { scale: 2 / 3, life: d + 0.3, fade: 0.4, frames: 5, flip: j % 2 === 0 });
      texFx('e42', x, groundY() + 2, ramp, { scale: 2 / 3, life: 0.24, delay: d, anchor: 'b', fade: 0.4, flip: j % 2 === 0 });
      texFx('k27', x, y, ramp, { scale: 2 / 3, life: 0.24, delay: d + 0.04, fade: 0.4 });
    }
    impact({ stop: 0.08, shake: 0.3 });
  },
  hitTex(a, t) { teZap(a, t.x, t.y); },
  kb: 8,
  marks: null,
};
// 뇌구 폭풍: 구전이 돌고, 타격마다 구전 하나하나에서 바깥으로 번개가 튄다
SKILL_FX.te_f_ak = {
  pose: tePose('spin'),
  cues: (a) => [[0.01, (a) => teOrbitFx(a, { ...teOrbOpts(a, a.k.dur - 0.02), n: 2 + Math.min(2, a.mast || 0) })]],
  hit(a, i) {
    const orbs = a.teOrb || [], ramp = teRamp(a), cx = a.x(), cy = groundY() - 30;
    for (const [ox, oy] of orbs) {
      const an = Math.atan2(oy - cy, ox - cx) + rand(-0.3, 0.3), ex = ox + Math.cos(an) * 70, ey = oy + Math.sin(an) * 50;
      mgArcFx(ox, oy, ex, ey, ramp, 0.24, { scale: 2 / 3, jag: 0.4 });
      texFx('k27', ex, ey, ramp, { scale: 2 / 3, life: 0.2, delay: 0.05, fade: 0.4, frames: 3 });
    }
    teOrbZap(a, i, a.targets(i));
  },
  hitTex(a, t) { teZap(a, t.x, t.y); },
  kb: 4,
  marks: null,
};
