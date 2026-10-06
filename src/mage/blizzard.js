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
  const hy = groundY() - (p.lift || 0) - SPR.knightLegs[0].length * PX * sy - 3 * PX;
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
const bzMod = (v, m) => ((v % m) + m) % m;
const bzEnv = (t, life, inT = 0.25, outT = 0.3) => Math.min(1, t / inT, Math.max(0, (life - t) / outT));

// ── Lv1 서리 바람: 지팡이 끝에서 물결치는 바람 줄기와 서리 가루가 대상 너머까지 불어 간다 ──
function bzWind(a, life, reach) {
  const gusts = [], flakes = [], d = a.dir;
  let acc = 0;
  aFx(a, 0, life, (u) => {
    ctx.save();
    ctx.lineCap = 'round';
    for (const g of gusts) {
      const k = g.t / g.life, al = Math.sin(Math.PI * k) * 0.75;
      ctx.globalAlpha = al; ctx.strokeStyle = BZ.light; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let s = 0; s <= 8; s++) {
        const x = g.x - d * s * 5, y = g.y + Math.sin(g.ph + s * 0.8 + g.t * 14) * 2.5;
        s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    for (const f of flakes) { ctx.globalAlpha = Math.min(1, (f.life - f.t) * 4); ctx.fillStyle = f.c; ctx.fillRect(Math.round(f.x), Math.round(f.y + Math.sin(f.ph + f.t * 9) * 3), f.s, f.s); }
    ctx.restore();
  }, null, (u, dt) => {
    const t = u * life;
    acc += dt;
    if (t > 0.25 && t < life - 0.25 && acc > 0.07) {
      acc = 0;
      const p = bzTip(a);
      gusts.push({ x: p.x, y: p.y + rand(-10, 12), ph: rand(0, 6), t: 0, life: rand(0.4, 0.55), v: rand(240, 300) });
      for (let i = 0; i < 2; i++) flakes.push({ x: p.x, y: p.y + rand(-4, 6), vx: d * rand(110, 190), vy: rand(-8, 14), ph: rand(0, 6), t: 0, life: rand(0.6, 0.9), s: Math.random() < 0.3 ? 2 : 1, c: Math.random() < 0.6 ? '#ffffff' : BZ.glow });
    }
    for (const g of gusts) { g.t += dt; g.x += d * g.v * dt; }
    for (const f of flakes) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    for (const L of [gusts, flakes]) for (let i = L.length - 1; i >= 0; i--) if (L[i].t >= L[i].life || Math.abs(L[i].x - a.x()) > reach) L.splice(i, 1);
  });
}

// ── 눈보라 구역: cx 둘레 반경 R 안에서만 비스듬히 몰아치는 눈 + 바닥을 쓸고 가는 바람 소용돌이 + 쌓이는 눈 ──
//  o: { n 눈송이 수, slant 기울기, speed 낙하 속도, top 구역 위쪽 y, gusts 소용돌이 수, pile 눈이 쌓이는 높이, hail 우박 }
function bzStorm(a, life, R, o) {
  const cx = a.tx(), d = a.dir, gy = groundY(), top = o.top, h = gy - top;
  const fl = [];
  for (let i = 0; i < o.n; i++) fl.push([Math.random(), Math.random(), rand(0.7, 1.3), Math.random() < 0.5 ? 2 : 1, Math.random() < 0.7]);
  const edge = (x) => Math.max(0, 1 - ((x - cx) / R) ** 2);
  const hail = [];
  let hailAcc = 0;
  aFx(a, 0, life, (u) => {
    const t = u * life, k = bzEnv(t, life);
    if (k <= 0) return;
    ctx.save();
    // 눈송이: 바람 쪽(d)으로 비스듬히 그어지는 짧은 줄
    for (const [sx, sy, sp, s, white] of fl) {
      const yy = bzMod(sy + t * o.speed * sp / h, 1), y = top + yy * h;
      const x = cx - R + bzMod(sx * 2 * R + d * (o.slant * yy * h + t * 60 * sp), 2 * R);
      const al = edge(x) * k;
      if (al < 0.05) continue;
      ctx.globalAlpha = al;
      ctx.fillStyle = white ? BZ.snow : BZ.glow;
      ctx.fillRect(Math.round(x), Math.round(y), s, s);
      ctx.globalAlpha = al * 0.5;
      ctx.fillRect(Math.round(x - d * o.slant * 4), Math.round(y - 5), 1, 4);
    }
    // 바닥을 쓸고 가는 바람 소용돌이 (말려 올라가는 흰 호)
    ctx.lineCap = 'round';
    for (let j = 0; j < o.gusts; j++) {
      const x = cx - R + bzMod(j * (2 * R / o.gusts) + d * t * 150, 2 * R), y = gy - 8 - (j % 3) * 9;
      const al = edge(x) * k;
      if (al < 0.05) continue;
      const sp = 9 + (j % 2) * 4;
      ctx.globalAlpha = al * 0.85; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
      ctx.save(); ctx.translate(x, y); ctx.scale(d, 1);
      ctx.beginPath(); ctx.ellipse(0, 0, sp, sp * 0.45, 0, Math.PI * 0.15, Math.PI * 1.35); ctx.stroke();
      ctx.globalAlpha = al * 0.5; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-sp * 0.2, sp * 0.45); ctx.lineTo(-sp - 22, sp * 0.45); ctx.stroke();
      ctx.restore();
    }
    // 쌓이는 눈 (언덕진 흰 띠)
    if (o.pile) {
      const pile = o.pile * Math.min(1, t / (life * 0.7)) * (u > 0.85 ? (1 - u) / 0.15 : 1);
      for (let x = cx - R; x < cx + R; x += 3) {
        const hh = pile * edge(x) * (0.7 + 0.3 * Math.sin(x * 0.35));
        if (hh < 0.6) continue;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = BZ.glow; ctx.fillRect(Math.round(x), Math.round(gy - hh), 3, Math.ceil(hh));
        ctx.fillStyle = BZ.snow; ctx.fillRect(Math.round(x), Math.round(gy - hh), 3, Math.max(1, Math.ceil(hh * 0.6)));
      }
    }
    // 우박: 테두리 있는 굵은 얼음 알갱이가 빠르게 떨어져 땅에서 튄다
    for (const p of hail) {
      ctx.globalAlpha = Math.min(1, (p.life - p.t) * 5) * k;
      ctx.fillStyle = BZ.line; ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 4, 4);
      ctx.fillStyle = BZ.light; ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 1, 1);
      if (!p.bounced) { ctx.globalAlpha *= 0.4; ctx.fillStyle = BZ.light; ctx.fillRect(Math.round(p.x - p.vx * 0.02), Math.round(p.y - 7), 1, 5); }
    }
    ctx.restore();
  }, null, (u, dt) => {
    if (!o.hail) return;
    const t = u * life;
    hailAcc += dt;
    if (t > 0.3 && t < life - 0.3 && hailAcc > 0.06) {
      hailAcc = 0;
      hail.push({ x: cx + rand(-R, R) * 0.85 - d * 20, y: top - 4, vx: d * rand(40, 80), vy: rand(260, 340), t: 0, life: 0.9, bounced: false });
    }
    for (const p of hail) {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.bounced) p.vy += 600 * dt;
      if (!p.bounced && p.y >= gy - 2) {
        p.bounced = true; p.y = gy - 2; p.vy = -rand(60, 110); p.vx *= 0.6; p.life = p.t + 0.3;
        parts.push({ x: p.x, y: gy - 2, vx: rand(-40, 40), vy: rand(-60, -20), g: 300, size: 1, color: '#ffffff', life: 0.2, t: 0 });
      }
    }
    for (let i = hail.length - 1; i >= 0; i--) if (hail[i].t >= hail[i].life) hail.splice(i, 1);
  });
}

// ★★ 대상 위 하늘에만 끼는 먹구름 (울퉁불퉁한 덩어리가 천천히 흐른다)
function bzCloud(a, life, R) {
  const cx = a.tx(), lumps = [];
  for (let i = 0; i < 16; i++) lumps.push([rand(-1, 1) * (R + 30), rand(-4, 14), rand(9, 17), rand(0, 6)]);
  backFx(a, 0, life, (u) => {
    const t = u * life, k = bzEnv(t, life, 0.4, 0.4);
    ctx.save();
    for (const [col, dy, sc, al] of [['#3c4a5e', 4, 1, 0.8], ['#6b7c94', -1, 0.8, 0.75], ['#9fb2c8', -4, 0.5, 0.5]]) {
      ctx.globalAlpha = al * k; ctx.fillStyle = col;
      ctx.beginPath();
      for (const [ox, oy, r, ph] of lumps) {
        const x = cx + ox + Math.sin(t * 0.8 + ph) * 4 + a.dir * t * 6, y = oy + dy - 8 * (1 - k);
        ctx.moveTo(x + r * sc, y); ctx.arc(x, y, r * sc, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();
  });
}

// 맞을 때마다 적 몸에 얼음 결정이 달라붙는다: 시전이 끝날 때까지 남았다가 함께 깨져 흩어진다
function bzCrust(a, life) {
  const list = [];
  a.bzCrust = list;
  aFx(a, 0, life, () => {
    ctx.save();
    for (const c of list) {
      const t = c.t0 != null ? Math.min(1, (clock - c.t0) / 0.12) : 1;
      ctx.save();
      ctx.translate(c.x, c.y); ctx.rotate(c.r);
      const s = c.s * easeOut(t);
      ctx.fillStyle = BZ.line; ctx.beginPath(); ctx.moveTo(0, -s - 1); ctx.lineTo(s * 0.6 + 1, 0); ctx.lineTo(0, s + 1); ctx.lineTo(-s * 0.6 - 1, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = BZ.dark; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.6, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.6, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = BZ.light; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.6, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-0.5, -s * 0.7, 1, s * 0.5);
      ctx.restore();
    }
    ctx.restore();
  }, () => {
    for (const c of list) burst(c.x, c.y, 3, ['#ffffff', BZ.glow, BZ.light], 110, 2, 300);
  });
}
function bzAddCrust(a, t, n) {
  if (!a.bzCrust) return;
  for (let j = 0; j < n; j++) a.bzCrust.push({ x: t.x + rand(-7, 7), y: t.y + rand(-12, 10), r: rand(-0.6, 0.6), s: rand(3, 5.5), t0: clock });
  if (a.bzCrust.length > 24) a.bzCrust.splice(0, a.bzCrust.length - 24);
}

// ★★ 큰 우박 한 알이 대상 머리 위로 내리꽂힌다 (타격 시점에 닿게 flight 초 먼저 던진다)
function bzBigHail(a, flight) {
  const t = a.targets()[0] || { x: a.tx(), y: a.ty() }, x1 = t.x, y1 = (t.top || t.y - 14) + 2, x0 = x1 - a.dir * 26, y0 = -6;
  skFx(null, 0, flight, (u) => {
    const x = mix(x0, x1, u), y = mix(y0, y1, easeIn(u));
    ctx.save();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = BZ.light; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - (x1 - x0) * 0.25, y - 22); ctx.lineTo(x, y); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = BZ.line; ctx.fillRect(Math.round(x) - 4, Math.round(y) - 4, 8, 8);
    ctx.fillStyle = BZ.dark; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6);
    ctx.fillStyle = BZ.light; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 3, 4, 3);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 2, 1);
    ctx.restore();
  });
}

// 작은 눈꽃 자국 (검흔 대신): 여섯 갈래 별표가 반짝 그어졌다 사라진다
function bzFlakeMark(x, y, size, life = 0.35) {
  const rot = rand(0, 1);
  skFx(null, 0, life, (u) => {
    const s = size * easeOut(Math.min(1, u / 0.2));
    ctx.save();
    ctx.globalAlpha = 1 - u; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) { const an = rot + i * Math.PI / 3; ctx.moveTo(x - Math.cos(an) * s, y - Math.sin(an) * s); ctx.lineTo(x + Math.cos(an) * s, y + Math.sin(an) * s); }
    ctx.stroke();
    ctx.restore();
  });
}

// ── ★★★ 영구 동토 ──
// 빙판: 지팡이를 꽂은 자리(x0)에서 앞쪽으로 spreadT 초 동안 번져 대상 너머(x1)까지 땅을 덮는다.
// 매끈한 윗면 반사광, 육각으로 금 간 얼음 무늬, 가장자리의 서리 가시. 위로는 낮은 냉기 안개가 흐른다
function bzPermafrost(a, life, x0, x1, spreadT, glowAt) {
  const gy = groundY(), d = Math.sign(x1 - x0) || a.dir, span = Math.abs(x1 - x0);
  const cracks = [];
  for (let x = 0; x < span; x += rand(10, 16)) cracks.push([x, rand(-1, 1), rand(4, 8)]);
  const mist = [];
  for (let i = 0; i < 10; i++) mist.push([Math.random(), rand(6, 12), rand(0, 6), rand(0.6, 1.2)]);
  const st = { front: 0 };
  a.bzSheet = st;
  backFx(a, 0, life, (u) => {
    const t = u * life, grow = easeOut(Math.min(1, t / spreadT)), out = u > 0.92 ? (1 - u) / 0.08 : 1, len = span * grow;
    st.front = x0 + d * len;
    const lo = Math.min(x0, st.front), glow = t > glowAt ? Math.min(1, (t - glowAt) / 0.25) : 0;
    ctx.save();
    ctx.globalAlpha = 0.8 * out;
    // 얼음 두께: 땅 위 3px + 땅속 7px
    ctx.fillStyle = '#7fc4e4'; ctx.fillRect(lo, gy - 3, len, 10);
    ctx.fillStyle = BZ.light; ctx.fillRect(lo, gy - 3, len, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(lo, gy - 3, len, 1);
    // 반사광: 빙판을 따라 미끄러지는 흰 빗금
    ctx.globalAlpha = 0.7 * out;
    for (let j = 0; j < 4; j++) {
      const gx = x0 + d * bzMod(t * 90 + j * span / 4, Math.max(1, span));
      if (Math.abs(gx - x0) > len) continue;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(gx), gy, 6, 1); ctx.fillRect(Math.round(gx) + 2, gy + 2, 4, 1);
    }
    // 금 간 무늬 (끝무렵엔 금 사이로 빛이 샌다)
    ctx.strokeStyle = glow ? mixHex('#3f7fae', '#ffffff', glow) : '#3f7fae'; ctx.lineWidth = 1;
    if (glow) { ctx.shadowColor = BZ.glow; ctx.shadowBlur = 6 * glow; }
    ctx.beginPath();
    for (const [cx, s, w] of cracks) {
      if (cx > len) break;
      const x = x0 + d * cx;
      ctx.moveTo(x, gy - 1); ctx.lineTo(x + d * w * 0.5, gy + 2 + s); ctx.lineTo(x + d * w, gy + 1); ctx.lineTo(x + d * w * 0.5, gy + 6);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 번지는 끝의 서리 가시
    if (grow < 1) { ctx.fillStyle = '#ffffff'; for (let j = 0; j < 4; j++) ctx.fillRect(Math.round(st.front - d * j * 3), gy - 3 - (j % 2 ? 2 : 4), 1, j % 2 ? 2 : 4); }
    // 낮게 흐르는 냉기 안개
    ctx.globalCompositeOperation = 'lighter';
    for (const [f, r, ph, sp] of mist) {
      const mx = x0 + d * bzMod(f * span + t * 25 * sp, Math.max(1, span));
      if (Math.abs(mx - x0) > len) continue;
      ctx.globalAlpha = 0.16 * out * (0.6 + 0.4 * Math.sin(clock * 2 + ph));
      ctx.fillStyle = '#cfefff';
      ctx.beginPath(); ctx.ellipse(mx, gy - 4, r * 1.8, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  });
}
// 빙판 위 대상 발밑에 육각 서리 고리가 맥박친다
function bzHexPulse(x, size, life = 0.4) {
  skFx(null, 0, life, (u) => {
    const gy = groundY(), r = size * easeOut(u);
    ctx.save();
    ctx.globalAlpha = 0.9 * (1 - u); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) { const an = i * Math.PI / 3; const px = x + Math.cos(an) * r, py = gy - 1 + Math.sin(an) * r * 0.25; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
    ctx.restore();
  });
}
// 육각 얼음 결정 기둥 하나: 밑동(x, y)에서 ang 쪽으로 len, 폭 wid. 세 면의 명암과 납작하게 깎인 끝
function bzPrism(x, y, ang, len, wid, alpha = 1) {
  if (len < 1) return;
  const h = wid / 2, tipL = Math.min(len * 0.3, wid * 0.9);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.globalAlpha = alpha;
  const path = (pts) => { ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); };
  path([[0, -h], [len - tipL, -h], [len, -h * 0.25], [len, h * 0.25], [len - tipL, h], [0, h]]);
  ctx.strokeStyle = BZ.line; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = BZ.dark; ctx.fill();
  ctx.fillStyle = BZ.light; path([[0, -h], [len - tipL, -h], [len, -h * 0.25], [len - tipL * 0.6, -h * 0.1], [0, -h * 0.25]]); ctx.fill();
  ctx.fillStyle = '#ffffff'; path([[len - tipL, -h], [len, -h * 0.25], [len, h * 0.25], [len - tipL * 0.4, 0]]); ctx.fill();
  ctx.fillStyle = 'rgba(27,63,106,0.35)'; ctx.fillRect(0, h * 0.35, len - tipL, h * 0.65);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(2, -h * 0.6, (len - tipL) * 0.7, 1);
  ctx.restore();
}
// 얼음 결정 무더기: 빙판에서 부채꼴로 솟구쳐(0.08초) 버티다가 hold 초 뒤 금이 가며 산산이 깨진다
function bzCrystalBurst(a, xs, hold) {
  const gy = groundY() + 2;
  xs.forEach((cx, ci) => {
    const big = ci === 0, n = big ? 5 : 3, prisms = [];
    for (let j = 0; j < n; j++) {
      const f = n === 1 ? 0 : j / (n - 1) - 0.5;
      prisms.push({ ang: -Math.PI / 2 + f * (big ? 1.4 : 1.1) + rand(-0.08, 0.08), len: (big ? 58 : 34) * (1 - Math.abs(f) * 0.6) * rand(0.85, 1.1), wid: big ? 13 : 9, ox: f * (big ? 10 : 6) });
    }
    const dl = ci * 0.035;
    skFx(null, dl, hold, (u) => {
      const t = u * hold, g = easeOut(Math.min(1, 0.45 + t / 0.08)), crack = t > hold - 0.1 ? (t - (hold - 0.1)) / 0.1 : 0;
      for (const p of prisms) bzPrism(cx + p.ox, gy, p.ang, p.len * g, p.wid);
      if (crack > 0) {
        ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.globalAlpha = 0.9;
        ctx.beginPath();
        for (const p of prisms) {
          const L = p.len * 0.8, mx = cx + p.ox + Math.cos(p.ang) * L * 0.5, my = gy + Math.sin(p.ang) * L * 0.5, k = 6 * crack;
          ctx.moveTo(mx - k, my - k * 0.4); ctx.lineTo(mx, my + k * 0.3); ctx.lineTo(mx + k * 0.8, my - k * 0.6);
        }
        ctx.stroke(); ctx.restore();
      }
    }, () => {
      // 산산이 깨진다: 결정 조각이 돌며 흩어지고 반짝임이 남는다
      const shards = [];
      for (const p of prisms) for (let j = 0; j < 4; j++) {
        const L = p.len * (j + 0.5) / 4, an = rand(0, Math.PI * 2), v = rand(60, 170) * (big ? 1.2 : 1);
        shards.push({ x: cx + p.ox + Math.cos(p.ang) * L, y: gy + Math.sin(p.ang) * L, vx: Math.cos(an) * v, vy: Math.sin(an) * v - 90, r: rand(0, 6), vr: rand(-12, 12), s: p.wid * rand(0.35, 0.6), light: j % 2 === 0 });
      }
      skFx(null, 0, 0.75, (u) => {
        const t = u * 0.75;
        ctx.save();
        ctx.globalAlpha = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
        for (const s of shards) {
          ctx.save();
          ctx.translate(s.x + s.vx * t, Math.min(groundY() - 1, s.y + s.vy * t + 300 * t * t)); ctx.rotate(s.r + s.vr * t);
          ctx.fillStyle = BZ.line; ctx.beginPath(); ctx.moveTo(s.s + 1, 0); ctx.lineTo(-s.s * 0.6 - 1, -s.s * 0.6 - 1); ctx.lineTo(-s.s * 0.5, s.s * 0.6 + 1); ctx.closePath(); ctx.fill();
          ctx.fillStyle = s.light ? BZ.light : BZ.dark; ctx.beginPath(); ctx.moveTo(s.s, 0); ctx.lineTo(-s.s * 0.6, -s.s * 0.6); ctx.lineTo(-s.s * 0.5, s.s * 0.6); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      });
      for (let j = 0; j < (big ? 4 : 2); j++) starFx(cx + rand(-14, 14), gy - rand(8, big ? 44 : 26), big ? 7 : 5, '#ffffff', 0.35);
      burst(cx, gy - 12, big ? 16 : 8, ['#ffffff', BZ.glow, BZ.light], big ? 170 : 120, 2, 260);
      if (big) { ringFx(cx, BZ.glow, 1.3, 0.5); ringFx(cx, '#ffffff', 0.8, 0.4); impact({ stop: 0.08, shake: 0.35 }); }
    });
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
          ringFx(p.x, BZ.glow, 0.7, 0.4);
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
        if (m === 2 && i % 3 === 2) for (const t of tg) { burst(t.x, (t.top || t.y - 14) + 2, 10, ['#ffffff', BZ.light, BZ.dark], 140, 2, 300); bzFlakeMark(t.x, (t.top || t.y - 14) + 2, 8); }
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
    // 검흔 대신 작은 눈꽃이 반짝인다 (Lv1 은 없이)
    marks(a, t) { if (a.mast) bzFlakeMark(t.x + rand(-6, 6), t.y + rand(-8, 6), 4 + a.mast); },
    kb: 6,
  },
});
