'use strict';
// 블리자드 연출 (cryomancer). 수치·단계는 src/classes.js 의 SKILLS.blizzard
//  Lv1 「서리 바람」 지팡이를 앞으로 내밀면 찬 바람 줄기가 물결치며 불어 가고, 서리 가루가 실려 흩날린다
//  ★ 「블리자드」 지팡이를 치켜 돌리면 대상 둘레에 비스듬한 눈보라가 몰아치고 — 맞을 때마다 적 몸에 얼음 결정이 달라붙고 땅에 눈이 쌓인다
//  ★★ 「빙설 폭풍」 대상 위 하늘에 먹구름이 끼고, 더 넓고 짙은 눈보라에 우박이 섞여 떨어져 튄다
//  ★★★ 「영구 동토」 지팡이를 땅에 꽂으면 앞쪽 땅이 통째로 빙판으로 얼어붙고 — 눈보라 끝에 다시 내리꽂으면
//        빙판에서 육각 얼음 결정 무더기가 부채꼴로 솟구쳤다가 산산이 깨진다
// 하단바 전체를 덮지 않는다: 눈보라·먹구름·빙판은 기사 앞 대상 둘레(반경 radius)에서만

const BZ = { line: '#1b3f6a', dark: '#5fb4dc', light: '#d8f4ff', glow: '#9fe8ff', snow: '#f4fbff' };

// 지팡이 끝(마력 구슬) 화면 위치 — world.js heroRig·drawStaff 와 같은 셈
function bzTip(a) {
  const p = castPose(a.owner) || {}, sy = p.sy || 1, k = p.skew || 0;
  const face = p.facing != null ? p.facing : a.dir;
  const st = (WEAPONS[CLASSES[a.cls].weapon] || {}).staff || { len: 8 };
  const hx = a.px() + face * (5 * PX + Math.round(k * 3 * PX));
  const hy = groundY() - (p.lift || 0) - sprCells(SPR.knightLegs[0]) * PX * sy - 3 * PX;
  const ang = staffAngle(p.bowA || 0), L = (st.len + 1.6) * PX;
  return { x: hx + face * Math.cos(ang) * L, y: hy + Math.sin(ang) * L };
}

// 키 자세 사이를 부드럽게 잇는다: keys = [[초, { bowA, pull, dx, sy, skew, lift }], ...]
function bzKeys(t, keys) {
  let i = 1;
  while (i < keys.length - 1 && keys[i][0] < t) i++;
  const [t0, p0] = keys[i - 1], [t1, p1] = keys[i];
  const v = clamp01((t - t0) / Math.max(0.001, t1 - t0)), w = v * v * (3 - 2 * v);
  const out = {};
  for (const key of ['bowA', 'pull', 'dx', 'sy', 'skew', 'lift']) {
    const d = key === 'sy' ? 1 : 0;
    out[key] = mix(p0[key] != null ? p0[key] : d, p1[key] != null ? p1[key] : d, w);
  }
  return out;
}
const BZ_CLOUD = ['#16304e', '#2c5478', '#4f86ad', '#86bcdc', '#cdeefc'];   // 서리 구름 램프 (C15 를 다시 칠함)
const bzMod = (v, m) => ((v % m) + m) % m;
const bzEnv = (t, life, inT = 0.25, outT = 0.3) => Math.min(1, t / inT, Math.max(0, (life - t) / outT));

// ── Lv1 서리 바람: 지팡이 끝에서 물결치는 바람 줄기와 서리 가루가 대상 너머까지 불어 간다 ──
function bzWind(a, life, reach) {
  // Lv1 서리 바람: E38 눈보라 타일 토막이 지팡이 끝에서 대상 너머까지 불어 간다 (눈 가루는 작은 보조 불티)
  const gusts = [], flakes = [], d = a.dir, ramp = mgA(a, 'frost');
  let acc = 0;
  aFx(a, 0, life, (u) => {
    for (const g of gusts) {
      const k = g.t / g.life;
      vfxDraw(ctx, 'e38', ramp, (g.f + Math.floor(g.t * 12)) % 5, g.x, g.y, { scale: 2 / 3, crop: [g.c, g.c + 0.4], rot: d > 0 ? -0.55 : 0.55, flip: d < 0, alpha: Math.sin(Math.PI * k) * 0.85 });
    }
    ctx.save();
    for (const f of flakes) { ctx.globalAlpha = Math.min(1, (f.life - f.t) * 4); ctx.fillStyle = f.c; ctx.fillRect(Math.round(f.x), Math.round(f.y + Math.sin(f.ph + f.t * 9) * 3), f.s, f.s); }
    ctx.restore();
  }, null, (u, dt) => {
    const t = u * life;
    acc += dt;
    if (t > 0.25 && t < life - 0.25 && acc > 0.12) {
      acc = 0;
      const p = bzTip(a);
      gusts.push({ x: p.x + d * 10, y: p.y + rand(-8, 10), t: 0, life: rand(0.4, 0.55), v: rand(240, 300), f: Math.floor(rand(0, 5)), c: rand(0, 0.6) });
      flakes.push({ x: p.x, y: p.y + rand(-4, 6), vx: d * rand(110, 190), vy: rand(-8, 14), ph: rand(0, 6), t: 0, life: rand(0.6, 0.9), s: Math.random() < 0.3 ? 2 : 1, c: Math.random() < 0.6 ? '#ffffff' : BZ.glow });
    }
    for (const g of gusts) { g.t += dt; g.x += d * g.v * dt; }
    for (const f of flakes) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    for (const L of [gusts, flakes]) for (let i = L.length - 1; i >= 0; i--) if (L[i].t >= L[i].life || Math.abs(L[i].x - a.x()) > reach) L.splice(i, 1);
  });
}

// ── 눈보라 구역: cx 둘레 반경 R 안에서만 비스듬히 몰아치는 눈 + 바닥을 쓸고 가는 바람 소용돌이 + 쌓이는 눈 ──
//  o: { n 눈송이 수, slant 기울기, speed 낙하 속도, top 구역 위쪽 y, gusts 소용돌이 수, pile 눈이 쌓이는 높이, hail 우박 }
function bzStorm(a, life, R, o) {
  // 눈보라 구역 = E38 눈보라 타일을 cx 둘레 반경 R 안에 깔아 비스듬히 흘려 보낸다 (바람 쪽 d 로). 가장자리 타일은 흐리게.
  //  o.pile: 바닥에 쌓이는 눈 = E39b 빙판 타일 토막 · o.speed: 흐르는 속도 · o.top: 구역 위쪽 y
  const cx = a.tx(), d = a.dir, gy = groundY(), top = o.top, ramp = mgA(a, 'frost');
  aFx(a, 0, life, (u) => {
    const t = u * life, k = bzEnv(t, life);
    const s = VFX_SHEETS.e38;
    if (k <= 0 || !s || !s.lv) return;
    const sc = 2 / 3, tw = s.fw * sc * VFX_DOT, th = s.h * sc * VFX_DOT;
    const ox = bzMod(d * t * o.speed * 0.6, tw), oy = bzMod(t * o.speed, th), f = mgLoop('e38', 10);
    ctx.save();
    ctx.beginPath(); ctx.rect(cx - R, top, R * 2, gy - top); ctx.clip();
    // 타일 사이 빈 구석이 네모로 보이지 않게 반 칸씩 겹치고, 줄마다 엇갈리게(가로 반 칸 밀기·프레임 다르게) 깐다
    const sx = tw * 0.55, sy = th * 0.6;
    for (let y = top - th + bzMod(oy, sy), r = 0; y < gy; y += sy, r++) for (let x = cx - R - tw + bzMod(ox, sx) + (r % 2) * sx * 0.5, c = 0; x < cx + R; x += sx, c++) {
      const e = Math.max(0, 1 - ((x + tw / 2 - cx) / (R + tw * 0.3)) ** 2) * Math.min(1, (y + th - top) / (th * 1.2));
      if (e < 0.05) continue;
      vfxDraw(ctx, 'e38', ramp, (f + r + c) % 5, x + tw / 2, y + th / 2, { scale: sc, flip: d < 0, alpha: k * e * e * 0.85 });   // 가장자리로 갈수록 빠르게 옅어진다 (구역 경계가 네모로 보이지 않게)
    }
    ctx.restore();
    if (o.pile) {
      const pile = Math.min(1, t / (life * 0.7)) * (u > 0.85 ? (1 - u) / 0.15 : 1), w = R * 1.6 * pile, sh = VFX_SHEETS.e39b;
      if (sh && sh.lv && w > 4) vfxDraw(ctx, 'e39b', ramp, 0, cx, gy + 3, { scale: 2 / 3, anchor: 'b', crop: [0, Math.min(1, w / (sh.fw * sc * VFX_DOT))], sx: 1, alpha: 0.8 });
    }
  });
}

// ★★ 대상 위 하늘에만 끼는 먹구름 (울퉁불퉁한 덩어리가 천천히 흐른다)
function bzCloud(a, life, R) {
  // ★★ 대상 위 하늘에만 끼는 먹구름 = C15 세 장 (서리 구름 램프), 천천히 흐른다
  const cx = a.tx();
  backFx(a, 0, life, (u) => {
    const t = u * life, k = bzEnv(t, life, 0.4, 0.4);
    for (let j = -1; j <= 1; j++) vfxDraw(ctx, 'c15', BZ_CLOUD, mgLoop('c15', 5, j + 1), cx + j * (R * 0.75) + a.dir * t * 6, 6 + (j === 0 ? -4 : 2) - 8 * (1 - k), { scale: 4 / 3, flip: j > 0, alpha: 0.9 * k });
  });
}

// 맞을 때마다 적 몸에 얼음 결정이 달라붙는다: 시전이 끝날 때까지 남았다가 함께 깨져 흩어진다
function bzCrust(a, life) {
  // 맞을 때마다 적 몸에 K26 서리 막이 달라붙는다 (앞 3프레임까지 자라 버티다가) 시전이 끝날 때 남은 프레임으로 함께 깨져 흩어진다
  const list = [], ramp = mgA(a, 'frost');
  a.bzCrust = list;
  aFx(a, 0, life, () => {
    for (const c of list) vfxDraw(ctx, 'k26', ramp, Math.min(2, Math.floor((clock - c.t0) / 0.06)), c.x, c.y, { scale: 2 / 3, flip: c.flip });
  }, () => {
    for (const c of list.slice(-6)) texFx('k26', c.x, c.y, ramp, { life: 0.2, scale: 2 / 3, flip: c.flip, frames: 5, fade: 0.5, move: () => [0, 0] });
  });
}
function bzAddCrust(a, t, n) {
  if (!a.bzCrust) return;
  for (let j = 0; j < Math.min(1, n); j++) a.bzCrust.push({ x: t.x + rand(-6, 6), y: t.y + rand(-10, 8), t0: clock, flip: Math.random() < 0.5 });
  if (a.bzCrust.length > 8) a.bzCrust.splice(0, a.bzCrust.length - 8);
}

// ★★ 큰 우박 한 알이 대상 머리 위로 내리꽂힌다 (타격 시점에 닿게 flight 초 먼저 던진다)
function bzBigHail(a, flight) {
  // ★★ 큰 우박 = P9 결정을 4/3배로 아래로 겨눠 떨어뜨린다 (흐린 사본 하나가 뒤따른다)
  const t = a.targets()[0] || { x: a.tx(), y: a.ty() }, x1 = t.x, y1 = (t.top || t.y - 14) + 2, x0 = x1 - a.dir * 26, y0 = -6, ramp = mgA(a, 'frost');
  const ang = Math.atan2(y1 - y0, x1 - x0);
  skFx(null, 0, flight, (u) => {
    const x = mix(x0, x1, u), y = mix(y0, y1, easeIn(u));
    vfxDraw(ctx, 'p9', ramp, 0, x - Math.cos(ang) * 12, y - Math.sin(ang) * 12, { scale: 1, rot: ang, alpha: 0.35 });
    vfxDraw(ctx, 'p9', ramp, 0, x, y, { scale: 4 / 3, rot: ang });
  });
}


// ── ★★★ 영구 동토 ──
function bzPermafrost(a, life, x0, x1, spreadT, glowAt) {
  // ★★★ 영구 동토: E39b 빙판 타일이 지팡이를 꽂은 자리(x0)에서 대상 너머(x1)까지 번진다. 끝무렵엔 흰빛 램프로 금 사이가 빛난다
  const d = Math.sign(x1 - x0) || a.dir, span = Math.abs(x1 - x0), st = { front: 0 }, ramp = mgA(a, 'frost'), hot = mgRamp('frost', 3).map((c) => mixHex(c, '#ffffff', 0.35));
  a.bzSheet = st;
  backFx(a, 0, life, (u) => {
    const t = u * life, grow = easeOut(Math.min(1, t / spreadT)), out = u > 0.92 ? (1 - u) / 0.08 : 1, len = span * grow;
    st.front = x0 + d * len;
    const s = VFX_SHEETS.e39b;
    if (!s || !s.lv || len < 2) return;
    const tw = s.fw * (2 / 3) * VFX_DOT, glow = t > glowAt && Math.floor(clock * 16) % 2 === 0;
    for (let x = 0; x < len; x += tw) {
      const w = Math.min(tw, len - x), cx = x0 + d * (x + w / 2);
      vfxDraw(ctx, 'e39b', glow ? hot : ramp, 0, cx, groundY() + 4, { scale: 2 / 3, anchor: 'b', crop: [0, w / tw], flip: d < 0, alpha: 0.95 * out });
    }
  });
}
// 빙판 위 대상 발밑에 서리 고리가 맥박친다
function bzHexPulse(x, size, life = 0.4) {
  // 빙판 위 대상 발밑에 C3 서리 고리가 맥박친다
  const m = MASTERY_VIS.indexOf(fxVis);
  texFx('c3', x, groundY() + 2, mgRamp('frost', m < 0 ? 2 : m), { life, scale: size >= 14 ? 2 / 3 : 1 / 2 * 1, anchor: 'b', fade: 0.4 });
}
// 얼음 결정 무더기: 빙판에서 부채꼴로 솟구쳐(0.08초) 버티다가 hold 초 뒤 금이 가며 산산이 깨진다
function bzCrystalBurst(a, xs, hold) {
  // 얼음 결정 무더기 = E39 프리즘 결정 군 (솟구쳐 버티다가 마지막 프레임들에서 깨진다). 대상 발밑이 가장 크다 (4/3배, 나머지 2/3배)
  const gy = groundY() + 3, ramp = mgA(a, 'frost');
  xs.forEach((cx, ci) => {
    const big = ci === 0, n = VFX_SHEETS.e39.frames;
    skFx(null, ci * 0.035, hold + 0.35, (u) => {
      const t = u * (hold + 0.35), f = t < hold ? Math.min(n - 3, Math.floor(t / 0.04)) : Math.min(n - 1, n - 3 + Math.floor((t - hold) / 0.1));
      vfxDraw(ctx, 'e39', ramp, f, cx, gy, { scale: big ? 4 / 3 : 2 / 3, anchor: 'b', flip: ci % 2 === 1, alpha: t > hold + 0.2 ? 1 - (t - hold - 0.2) / 0.15 : 1 });
    }, () => {
      if (big) { mgRing(cx, ramp, 1.4, 0.5); impact({ stop: 0.08, shake: 0.35 }); }
    });
    skLater(a, ci * 0.035 + hold, () => burst(cx, gy - 12, big ? 10 : 5, ['#ffffff', BZ.glow, BZ.light], big ? 170 : 120, 2, 260));
  });
}

Object.assign(SKILL_FX, {
  blizzard: {
    pose(u, a) {
      const m = a.mast || 0, d = a.k ? a.k.dur : 2, t = u * d;
      if (m === 0) {
        const p = bzKeys(t, [[0, {}], [0.18, { bowA: -0.1, pull: 6, dx: -1 }], [0.3, { bowA: 0.6, pull: 8, dx: 2, skew: 0.08 }], [d - 0.3, { bowA: 0.58, pull: 8, dx: 2, skew: 0.08 }], [d, {}]]);
        p.bowA += 0.05 * Math.sin(t * 14) * bzEnv(t, d, 0.3, 0.3);
        return p;
      }
      if (m <= 2) {
        const hi = m === 2;
        const p = bzKeys(t, [[0, {}], [0.25, { bowA: hi ? -0.3 : -0.2, pull: 11, sy: hi ? 1.06 : 1.04, dx: -1, lift: hi ? 2 : 0 }], [d - 0.3, { bowA: hi ? -0.3 : -0.2, pull: 12, sy: hi ? 1.06 : 1.04, dx: -1, lift: hi ? 2 : 0 }], [d, {}]]);
        // 지팡이를 치켜든 채 휘휘 돌린다
        const env = bzEnv(t, d, 0.35, 0.35);
        p.bowA += (hi ? 0.24 : 0.18) * Math.sin(t * 9) * env;
        p.skew = (p.skew || 0) + 0.05 * Math.sin(t * 9 + 1) * env;
        return p;
      }
      const p = bzKeys(t, [[0, {}], [0.15, { bowA: -0.25, pull: 8, lift: 2, sy: 1.05 }], [0.26, { bowA: 1.25, pull: 4, dx: 2, sy: 0.9, skew: 0.12 }], [0.6, { bowA: 1.2, pull: 4, dx: 2, sy: 0.92, skew: 0.1 }],
        [0.85, { bowA: -0.2, pull: 12, sy: 1.05, lift: 1 }], [1.95, { bowA: -0.2, pull: 12, sy: 1.05, lift: 1 }], [2.08, { bowA: -0.4, pull: 13, lift: 4, sy: 1.08, skew: -0.08 }],
        [2.18, { bowA: 1.25, pull: 0, dx: 3, sy: 0.88, skew: 0.15 }], [2.35, { bowA: 1.15, dx: 2, sy: 0.92, skew: 0.1 }], [2.5, {}]]);
      if (t > 0.85 && t < 1.95) p.bowA += 0.2 * Math.sin((t - 0.85) * 9);
      return p;
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast, R = a.k.radius || 80, hits = a.k.hits;
      if (m === 0) return [[0.01, (a) => bzWind(a, d - 0.02, Math.abs(a.tx() - a.x()) + R + 20)]];
      if (m === 1) return [
        [0.01, (a) => { bzStorm(a, d - 0.02, R, { n: 75, slant: 0.45, speed: 120, top: 20, gusts: 4, pile: 4 }); bzCrust(a, d - 0.02); }],
        [0.2, (a) => { const p = bzTip(a); burst(p.x, p.y, 8, ['#ffffff', BZ.glow], 80, 2, -30); }],
      ];
      if (m === 2) return [
        [0.01, (a) => { bzCloud(a, d - 0.02, R); bzStorm(a, d - 0.02, R, { n: 120, slant: 0.7, speed: 170, top: 14, gusts: 6, pile: 6, hail: true }); bzCrust(a, d - 0.02); }],
        [0.15, (a) => { const p = bzTip(a); burst(p.x, p.y, 10, ['#ffffff', BZ.glow], 90, 2, -30); }],
        ...hits.filter((_, i) => i % 3 === 2).map((h) => [h[0] - 0.12 / d, (a) => bzBigHail(a, 0.12)]),
      ];
      const plunge = 0.26, last = hits[hits.length - 1][0] * d;
      return [
        [plunge / d, (a) => {
          const p = bzTip(a), x1 = a.tx() + a.dir * (R * 0.6);
          bzPermafrost(a, d - plunge - 0.02, p.x, x1, 0.45, last - plunge - 0.4);
          burst(p.x, groundY() - 2, 14, ['#ffffff', BZ.glow, BZ.light], 120, 2, 280);
          mgRing(p.x, mgA(a, 'frost'), 0.8, 0.4);
          impact({ stop: 0.05, shake: 0.25 });
        }],
        [0.7 / d, (a) => bzStorm(a, last - 0.7 + 0.1, R, { n: 60, slant: 0.6, speed: 150, top: 16, gusts: 5, pile: 0 })],
      ];
    },
    hit(a, i, n) {
      const m = a.mast, tg = a.targets(i), last = i === n - 1;
      if (m === 0) { for (const t of tg) burst(t.x + a.dir * 4, t.y, 4, ['#ffffff', '#cfefff'], 60, 1, 60); impact({ shake: 0.04 }); return; }
      if (m <= 2) {
        for (const t of tg) { bzAddCrust(a, t, m === 2 ? 2 : 1); burst(t.x, t.y, 5, ['#ffffff', BZ.glow], 80, 2, 120); }
        if (m === 2 && i % 3 === 2) for (const t of tg) { burst(t.x, (t.top || t.y - 14) + 2, 10, ['#ffffff', BZ.light, BZ.dark], 140, 2, 300); }
        impact(last ? { stop: 0.08, shake: 0.25 } : { shake: m === 2 ? 0.08 : 0.05 });
        return;
      }
      if (!last) {
        const front = a.bzSheet ? a.bzSheet.front : a.x();
        for (const t of tg) {
          if (a.dir * (front - t.x) >= 0) bzHexPulse(t.x, 12 + i);
          burst(t.x, t.y, 4, ['#ffffff', BZ.glow], 70, 2, 120);
        }
        impact({ shake: 0.06 });
        return;
      }
      // 마지막: 빙판에서 얼음 결정 무더기가 솟구쳤다가 깨진다 (대상 발밑이 가장 크다)
      const R = a.k.radius || 110, cx = a.tx(), xs = [cx];
      for (const t of tg) if (Math.abs(t.x - cx) > 20) xs.push(t.x);
      for (const f of [-0.75, -0.4, 0.4]) xs.push(cx + a.dir * f * R);
      bzCrystalBurst(a, xs.slice(0, 7), 0.22);
      impact({ stop: 0.14, shake: 0.5 });
    },
    // 명중 그림 K26 (대상이 얼어붙는 서리 막): Lv1 앞 3프레임, ★ 4프레임, ★★ 이상 전부. 2/3배, ★★★ 막타만 1배
    hitTex(a, t, share, i, n) {
      const m = a.mast || 0, big = m >= 3 && i === n - 1;
      mgFx(a, 'k26', t.x + rand(-4, 4), t.y + rand(-6, 4), mgA(a, 'frost'), { scale: big ? 1 : 2 / 3, life: big ? 0.4 : 0.26, frames: [3, 4, 5, 5][m], fade: 0.3, flip: Math.random() < 0.5 });
    },
    kb: 6,
  },
});
