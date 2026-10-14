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
// (옛 마름모 윤곽 mbDiamond 는 E04·K04 텍스처로 바뀌었다)
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
  const s0 = mbTip(a), trail = [], ramp = mgA(a, 'mana');
  aFx(a, 0, life, (u) => {
    const tx = a.tx(), ty = a.ty(), e = easeIn(u) * 0.4 + u * 0.6;
    const x = mix(s0.x, tx, e), y = mix(s0.y, ty, e) - Math.sin(Math.PI * u) * 6;
    trail.push([x, y]); if (trail.length > 6) trail.shift();
    // P4 마력탄을 크게: 지나온 자리에 흐린 사본 둘, 머리는 4/3배
    const ang = Math.atan2(ty - s0.y, tx - s0.x);
    for (const j of [1, 3]) if (trail[trail.length - 1 - j]) vfxDraw(ctx, 'p4', ramp, (mgLoop('p4', 15) + j) % 3, trail[trail.length - 1 - j][0], trail[trail.length - 1 - j][1], { scale: 1, rot: ang, alpha: 0.5 / j });
    vfxDraw(ctx, 'p4', ramp, mgLoop('p4', 15), x, y, { scale: 4 / 3, rot: ang });
  });
}

// ── ★: 부풀어 오르는 마력 구체 ── 테두리가 일렁이고 안에서 소용돌이가 돈다. popAt 초에 사라진다 (터짐은 hit)
function mbSphereFx(a, life, popAt) {
  const pos = () => ({ x: a.tx() - a.dir * 8, y: a.ty() - 2 }), ramp = mgA(a, 'mana');
  aFx(a, 0, life, (u) => {
    const t = u * life;
    if (t >= popAt) return;
    // 마력 구체 = K04 겹 마름모 결정의 첫 그림이 계단으로 부풀며(2/3 → 1 → 4/3배) 일렁인다
    const g = clamp01(t / popAt), { x, y } = pos(), sc = g < 0.4 ? 2 / 3 : g < 0.8 ? 1 : 4 / 3;
    const jit = Math.floor(clock * 20) % 2;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    vfxDraw(ctx, 'k04', ramp, 0, x, y + jit, { scale: sc, alpha: 0.95 });
    ctx.restore();
  }, null, (u) => {
    const t = u * life;
    if (t >= popAt - 0.04) return;
    // 지팡이 끝에서 구체로 마력이 흘러 들어간다 (작은 보조 불티)
    const s = mbTip(a), { x, y } = pos();
    if (Math.random() < 0.8) {
      const k = rand(0, 0.3);
      parts.push({ x: mix(s.x, x, k), y: mix(s.y, y, k), vx: (x - s.x) * 3, vy: (y - s.y) * 3 - 10, g: 0, size: 2, color: Math.random() < 0.5 ? a.color : '#ffffff', life: 0.22, t: 0, add: true });
    }
  });
}
// 구체가 터진다: 하얀 섬광 + 마름모 파문 두 겹 + 마력 조각
function mbPopFx(a, x, y, size) {
  // E04 마름모 노바가 한 번 터진다 (size 1 = 1배, Lv1 0.45 = 2/3배·앞 4프레임)
  const big = size >= 0.8;
  mgFx(a, 'e04', x, y, mgA(a, 'mana'), { scale: big ? 1 : 2 / 3, life: big ? 0.42 : 0.3, frames: big ? 99 : 4, fade: 0.3, add: true });
  mbShards(a, x, y, 6 * size, 150 * size, 0.5, [a.color, '#ffffff', MB_LIGHT]);
}

// ── ★★: 육망성 마법진 ── 땅에 납작하게 펼쳐지는 이중 원 + 두 삼각형 + 둘레를 도는 사각 룬 글자
function mbSigilFx(a, life, flashAt) {
  // C9 바닥 마법진이 펼쳐져(2/3 → 1배) 돌고, 폭발 순간마다 4/3배로 번쩍인다. 둘레에 룬 불티가 피어오른다
  const cx = a.tx(), gy = groundY() + 1, rx = 30, ramp = mgA(a, 'mana');
  aFx(a, 0, life, (u) => {
    const t = u * life, out = u > 0.85 ? (1 - u) / 0.15 : 1;
    const fl = flashAt.reduce((m, f) => Math.max(m, 1 - Math.abs(t - f) / 0.08), 0);
    const sc = t < 0.08 ? 2 / 3 : fl > 0.3 ? 4 / 3 : 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    vfxDraw(ctx, 'c9', ramp, mgLoop('c9', 10), cx, gy, { scale: sc, anchor: 'b', alpha: out * (0.8 + 0.2 * Math.max(0, fl)) });
    ctx.restore();
  }, null, (u) => {
    if (Math.random() < 0.5 && u < 0.85) parts.push({ x: cx + rand(-rx, rx) * 0.8, y: gy - 2, vx: 0, vy: rand(-50, -25), g: 0, size: 2, color: Math.random() < 0.5 ? a.color : '#ffffff', life: 0.35, t: 0, add: true });
  });
}
// 마법진에서 마력 블록이 솟구친다: 크고 작은 사각 블록이 기둥처럼 쌓여 올랐다가 위로 흩어진다
function mbEruptFx(a, x, h, w, life) {
  // E04b 마력 블록 기둥이 마법진에서 솟구쳤다가 위로 흩어진다 (h 60px 이상이면 4/3배)
  mgFx(a, 'e04b', x, groundY() + 1, mgA(a, 'mana'), { scale: h >= 60 ? 4 / 3 : 1, life, anchor: 'b', fade: 0.3, add: true });
}

// ── ★★★: 비전 고리 셋 ── 서로 다르게 기운 고리가 자이로처럼 돌다가 collapseAt 무렵 한 점으로 줄어든다
const MB_RINGS = [{ r: 36, tilt: -0.45, flat: 0.3, sp: 2.6 }, { r: 29, tilt: 0.55, flat: 0.36, sp: -3.2 }, { r: 19, tilt: 0.05, flat: 0.9, sp: 4.1 }];
function mbRingsXY(a) { return { x: a.tx(), y: Math.max(30, a.ty() - 54) }; }
function mbRingsFx(a, life, pulses, collapseAt) {
  // 비전 고리 셋 = C9 마법진 시트를 서로 다르게 기울여 자이로처럼 돌린다. 붕괴 직전 계단으로 작아진다. 가운데 핵 = K04 첫 그림
  const ramp = mgA(a, 'mana');
  aFx(a, 0, life, (u) => {
    const t = u * life;
    if (t > collapseAt) return;
    const { x, y } = mbRingsXY(a);
    const open = clamp01(t / 0.25), col = clamp01((t - (collapseAt - 0.24)) / 0.24);
    const pl = pulses.reduce((m, p) => Math.max(m, 1 - Math.abs(t - p) / 0.1), 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    MB_RINGS.forEach((rg, j) => {
      const sc = open < 0.5 || col > 0.66 ? 2 / 3 : col > 0.33 ? 1 : j === 2 ? 1 : 4 / 3;
      const rot = rg.tilt + Math.sin(clock * rg.sp * 0.5) * 0.25 + col * (j - 1) * 1.2;
      vfxDraw(ctx, 'c9', ramp, mgLoop('c9', 12, j * 2), x, y, { scale: sc, rot, sy: j === 2 ? 2 : 1, flip: j === 1, alpha: open * (pl > 0.3 ? 1 : 0.85) });
    });
    vfxDraw(ctx, 'k04', ramp, 0, x, y, { scale: col > 0.5 || pl > 0.3 ? 1 : 2 / 3, alpha: 0.95 });
    ctx.restore();
  }, null, (u) => {
    const t = u * life;
    if (t > collapseAt) return;
    const { x, y } = mbRingsXY(a), s = mbTip(a);
    // 지팡이 끝 → 고리로 마력이 실처럼 올라가고, 붕괴가 가까우면 둘레의 빛이 빨려 든다 (작은 보조 불티)
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
  mgArcFx(x0, y0, x1, y1, mgA(a, 'mana'), 0.16, { sheet: 'p11', jag: 0.35 });
}
// 비전 붕괴: 한 점에서 터지는 큰 폭발 — 하얀 핵, 겹겹이 퍼지는 마름모, 여덟 갈래 빛살, 땅에 떨어지는 파편
function mbNovaFx(a, x, y) {
  // 비전 붕괴: E04 마름모 노바를 4/3배로 + 바닥 충격 고리(C3) + 마름모 조각
  const ramp = mgA(a, 'mana');
  mgFx(a, 'e04', x, y, ramp, { scale: 4 / 3, life: 0.6, fade: 0.35, add: true });
  mgFx(a, 'e04', x, y, ramp, { scale: 2 / 3, life: 0.35, delay: 0.12, fade: 0.4, add: true, flip: true });
  mgRing(x, ramp, 1.6, 0.5);
  mbShards(a, x, y, 14, 210, 0.8, [a.color, '#ffffff', MB_LIGHT, MASTERY_GOLD]);
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
    // 명중 그림 K04 (겹 마름모가 차례로 깨지는 파열): Lv1 앞 3프레임, ★ 4프레임, ★★ 이상 전부. 2/3배, ★★★ 막타(비전 붕괴)만 1배
    hitTex(a, t, share, i, n) {
      const m = a.mast || 0, big = m >= 3 && i === n - 1;
      mgFx(a, 'k04', t.x + rand(-3, 3), t.y + rand(-4, 3), mgA(a, 'mana'), { scale: big ? 1 : 2 / 3, life: big ? 0.34 : 0.26, frames: [3, 4, 5, 5][m], fade: 0.3, flip: Math.random() < 0.5 });
    },
    kb: 10,
  },
});
