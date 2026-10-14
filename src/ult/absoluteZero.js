'use strict';
// 3차 궁극기 「절대영도」 연출 (frostlord). 수치·단계는 src/classes.js 의 SKILLS.absoluteZero, 공통 레터박스·컷인은 src/skills.js 의 drawUltScreen.
//  Lv1 「빙결」 지팡이 끝에서 서리가 땅을 타고 번져 고사리 같은 얼음꽃이 자라고 — 적이 얼음 덩어리에 갇혔다가, 금이 가며 깨진다
//  ★   「절대영도」 온도가 빠져나가듯 하단바의 색이 바래며 하얀 서리막이 퍼져 온통 얼어붙고 — 유리처럼 금이 쩍쩍 가다가 한꺼번에 산산이 부서진다
//  ★★  「시간 동결」 하늘에 얼음 시계가 떠 바늘이 미친 듯 돌다 멎는 순간 하단바가 푸른 정지 화면이 되고 — 얼음 결정이 하나씩 솟아 멈춰 있다가 동시에 깨지며 색이 돌아온다
//  ★★★ 「영원의 겨울」 눈보라 속 하늘에서 거대한 눈꽃 결정이 내려와 땅에 박히며 하단바 전체를 덮는 빙하가 되고 — 금이 가던 빙하가 통째로 부서지며 눈보라가 휩쓴다
// 시전 내내 이어지는 큰 그림은 시전 시작에 한 번 만든 연출(뒤 레이어 냉기·시계·눈꽃 / 앞 레이어 서리·서리막·빙하)이 시간표대로 그리고,
// 타격 순간(hit)은 얼음이 갇히고 금 가고 깨지는 것만 더한다.

const AZ_ICE = ['#ffffff', '#cff6ff', '#8fdcff', '#4aa8e0'];
// 텍스처 램프 (src/vfx-mage.js 빙하 램프, 숙련 단계는 지금 시전의 fxVis 로) · 밝은 램프(번쩍임)
const AZ_RAMP = () => { const m = MASTERY_VIS.indexOf(fxVis); return mgRamp('glacier', m < 0 ? 3 : m); };
const AZ_LIT = () => AZ_RAMP().map((c) => mixHex(c, '#ffffff', 0.5));
// 정해진 난수 (같은 i 는 늘 같은 값)
const azN = (i) => { const s = Math.sin(i * 91.7 + 47.3) * 24634.6345; return s - Math.floor(s); };

function azCenter(a) {
  const t = a.targets();
  return t.length ? t.reduce((s, p) => s + p.x, 0) / t.length : a.tx();
}
const azMid = (a, pad = 60) => Math.max(pad, Math.min(W - pad, mix(a.x(), azCenter(a), 0.55)));
// 지팡이 끝 화면 위치 (world.js heroRig·drawStaff 를 따른다)
function azTip(a) {
  const p = castPose(a.owner) || {}, face = p.facing != null ? p.facing : a.dir;
  const ang = staffAngle(p.bowA || 0), sa = face > 0 ? ang : Math.PI - ang;
  const hx = a.px() + face * (5 * PX + Math.round((p.skew || 0) * 3 * PX)), hy = groundY() - (p.lift || 0) - HAND_Y * (p.sy || 1);
  return { x: hx + Math.cos(sa) * 32, y: hy + Math.sin(sa) * 32 };
}

// 냉기: 하단바를 짙은 남빛으로 가라앉히고 위아래 가장자리에 서늘한 빛 (뒤 레이어)
function azCold(dark, glow, rgb = '2,10,26') {
  // 냉기: 하단바를 짙은 남빛으로 가라앉힌다 (궁극기라 하단바 전체 가능). 위아래 가장자리 빛은 F18 배경·서리막이 맡는다
  if (dark > 0) dimBand(dark, rgb);
}
// 얼음 결정 기둥 (육각 기둥을 옆에서 본 모양): 밝은 왼면·어두운 오른면·하얀 모서리
function azSpike(x, by, h, w, al = 1, lean = 0, glint = 0) {
  // 얼음 결정 기둥 = K39 결빙 시트의 앞 프레임(솟은 결정 무더기). 높이 h 에 맞는 배율, glint 면 밝은 램프로 깜박인다
  if (h < 2 || al <= 0) return;
  const sc = h < 36 ? 2 / 3 : h < 54 ? 1 : 4 / 3, f = Math.min(2, Math.floor(h / 20));
  vfxDraw(ctx, 'k39', glint && Math.floor(clock * 6 + x) % 5 === 0 ? AZ_LIT() : AZ_RAMP(), f, x, by + 1, { scale: sc, anchor: 'b', flip: lean < 0, alpha: al });
}
// 눈꽃 (여섯 갈래, 갈래마다 잔가지 두 쌍)
function azFlake(x, y, r, rot, al = 1, col = '#ffffff', w = 1) {
  // 눈꽃 = F19 거대 눈꽃 (반지름 r 에 맞는 배율 1/3·2/3·1·4/3·2, 60° 대칭이라 회전은 15° 계단)
  if (r < 1 || al <= 0) return;
  const sc = r < 8 ? 1 / 3 : r < 20 ? 2 / 3 : r < 34 ? 1 : r < 48 ? 4 / 3 : 2;
  vfxDraw(ctx, 'f19', AZ_RAMP(), 0, x, y, { scale: sc, rot: Math.round(rot / 0.2618) * 0.2618, alpha: al });
}
// 금 한 갈래를 만든다: (x, y) 에서 ang 방향으로 마디마다 꺾이며 뻗고, 가끔 곁가지를 친다
function azCrackPath(x, y, ang, len, out, depth = 0) {
  // 금 한 갈래 = F19b 유리 금 도장 하나 (자리·방향·크기). 길이 len 에 맞는 배율
  out.push({ x, y, rot: Math.round(ang / 0.785) * 0.785, sc: len < 60 ? 2 / 3 : len < 120 ? 1 : 4 / 3, p: 1 });
}
// 금 여러 갈래를 진행도 p(0→1) 만큼 그린다 (하얀 심 + 하늘빛 번짐)
function azCracks(list, p, al = 1) {
  // 금 도장들을 진행도 p 로 (덜 자란 금은 작은 배율로 먼저 보인다)
  if (!list.length || al <= 0) return;
  for (const c of list) {
    const q = c.p != null ? c.p : p;
    if (q <= 0) continue;
    vfxDraw(ctx, 'f19b', AZ_LIT(), 0, c.x, c.y, { scale: q < 0.5 ? c.sc * 0.5 : c.sc, rot: c.rot, alpha: al * 0.75 });
  }
}
// 얼음 파편 한 무더기: 다각형 조각들이 튀어 돌며 떨어진다 (앞 레이어)
function azShatter(a, x, y, n, speed, size, life = 0.8) {
  // 얼음 파편 = P10 빙하 창끝 조각을 돌리며 흩뿌린다 (45° 계단 회전)
  const sh = [], ramp = AZ_RAMP(), sc = size >= 5 ? 1 : 2 / 3;
  for (let k = 0; k < Math.max(3, Math.round(n * 0.6)); k++) {
    const ang = rand(0, Math.PI * 2), v = rand(0.3, 1) * speed;
    sh.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - speed * 0.4, r: rand(0, 6), vr: rand(-12, 12) });
  }
  let last = 0;
  aFx(a, 0, life, (u) => {
    const dt = Math.max(0, Math.min(0.05, u * life - last)); last = u * life;
    for (const p of sh) {
      p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      if (p.y > groundY() - 2) { p.y = groundY() - 2; p.vy *= -0.3; p.vx *= 0.6; }
      vfxDraw(ctx, 'p10', ramp, 0, p.x, p.y, { scale: sc, rot: Math.round(p.r / 0.785) * 0.785, alpha: 1 - easeIn(u) });
    }
  });
  burst(x, y, Math.round(n * 0.4), ['#ffffff', '#cff6ff', '#8fdcff'], speed * 0.9, 2, 300);
}

// ── Lv1 빙결: 땅을 타고 번지는 서리 → 얼음 덩어리 → 깨짐 ──
function azFrostStage(a) {
  // Lv1 빙결: 지팡이 끝에서 서리(E39b 빙판 토막)가 땅을 타고 양쪽으로 번지고, 번진 자리마다 작은 결정(K39 첫 그림)이 돋는다
  const d = a.k.dur, hits = a.k.hits.map((h) => h[0] * d), lock = hits[0], fin = hits[hits.length - 1], life = d + 0.5, gy = groundY();
  const x0 = a.x() + a.dir * 18, reachMax = Math.max(80, Math.abs(azCenter(a) - x0) + 50);
  const ferns = [];
  for (let s = 14; s < W + 80; s += rand(26, 40)) for (const sg of [1, -1]) {
    const x = x0 + sg * s;
    if (x < -20 || x > W + 20) continue;
    ferns.push({ x, s, h: rand(14, 26) * (s < reachMax ? 1 : 0.6), lean: rand(-1, 1) });
  }
  const reach = (t) => easeOut(segU(t, 0.25, lock - 0.05)) * (W + 80);
  backFx(a, 0, life, (u) => {
    const t = u * life, ramp = easeOut(clamp01(t / 0.7)), out = 1 - segU(t, fin + 0.15, life);
    azCold(0.48 * ramp * out, 0.8 * ramp * out);
  });
  aFx(a, 0, life, (u) => {
    const t = u * life, R = reach(t), out = 1 - segU(t, fin + 0.1, life), s = VFX_SHEETS.e39b;
    if (s && s.lv && R > 2) {
      const tw = s.fw * (2 / 3) * VFX_DOT;
      for (const sg of [1, -1]) for (let x = 0; x < R; x += tw) {
        const w = Math.min(tw, R - x);
        vfxDraw(ctx, 'e39b', AZ_RAMP(), 0, x0 + sg * (x + w / 2), gy + 4, { scale: 2 / 3, anchor: 'b', crop: [0, w / tw], flip: sg < 0, alpha: 0.9 * out });
      }
    }
    for (const sg of [1, -1]) if (R < W + 70) azFlake(x0 + sg * R, gy - 6, 6, t * 4, 0.9 * out);
    for (const f of ferns) if (f.s <= R) azSpike(f.x, gy, f.h * easeOut(clamp01((R - f.s) / 30)), 6, out, f.lean);
  }, null, (u) => {
    const t = u * life;
    if (t < lock && Math.random() < 0.7) {
      const tp = azTip(a), ang = rand(0, Math.PI * 2), r = rand(18, 36);
      parts.push({ x: tp.x + Math.cos(ang) * r, y: tp.y + Math.sin(ang) * r, vx: -Math.cos(ang) * r * 3, vy: -Math.sin(ang) * r * 3, g: 0, size: 2, color: Math.random() < 0.5 ? '#cff6ff' : '#ffffff', life: 0.3, t: 0, add: true });
    }
  });
}
// 얼음 덩어리: 대상을 감싸며 아래부터 차오르고, 마지막이 다가오면 금이 번진다
function azIceBlock(a, x, until, big = false) {
  // 얼음 덩어리 = K39 결빙: 앞 프레임까지 차올라 버티고, 끝이 다가오면 금 간 프레임으로 넘어가 떨린다 (깨지는 건 막타의 hitTex)
  const gy = groundY(), n = VFX_SHEETS.k39.frames, life = until;
  aFx(a, 0, life, (u) => {
    const t = u * life, crack = segU(t, life - 0.45, life - 0.02);
    const f = t < 0.16 ? Math.floor(t / 0.06) : crack > 0 ? Math.min(n - 3, 3 + Math.floor(crack * 2)) : 2;
    vfxDraw(ctx, 'k39', AZ_RAMP(), f, x + (crack > 0.6 ? rand(-1, 1) : 0), gy + 2, { scale: big ? 4 / 3 : 1, anchor: 'b', alpha: 0.92 });
  });
  burst(x, gy - 20, 6, ['#ffffff', '#cff6ff'], 90, 2, 0);
}

// ── ★ 절대영도: 색이 빠지며 하얗게 얼어붙는 하단바 → 유리처럼 금 → 한꺼번에 부서짐 ──
function azWhiteStage(a) {
  const d = a.k.dur, hits = a.k.hits.map((h) => h[0] * d), lock = hits[0], fin = hits[hits.length - 1], life = d + 0.8;
  const x0 = a.x(), far = Math.max(x0, W - x0) + 40, Y0 = 16, Y1 = H - 16;
  const R = (t) => easeIn(segU(t, 0.3, lock)) * far;
  a.azCracks = [];
  a.azShattered = false;
  // 하얀 서리막을 이룰 유리 조각 (부서질 때 쓰는 삼각형 격자 — 가장자리 점은 고정, 안쪽 점은 흔든다)
  const cw = 46, cols = Math.ceil((W + 80) / cw), rows = 3, grid = [];
  for (let i = 0; i <= cols; i++) {
    grid.push([]);
    for (let j = 0; j <= rows; j++) {
      const inner = j > 0 && j < rows;
      grid[i].push([-40 + i * cw + (inner ? rand(-12, 12) : 0), mix(Y0, Y1, j / rows) + (inner ? rand(-10, 10) : 0)]);
    }
  }
  const tris = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const A = grid[i][j], B = grid[i + 1][j], C = grid[i + 1][j + 1], D = grid[i][j + 1];
    for (const tri of (i + j) % 2 ? [[A, B, C], [A, C, D]] : [[A, B, D], [B, C, D]]) {
      const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      tris.push({ cx, cy, pts: tri.map(([px, py]) => [px - cx, py - cy]) });
    }
  }
  a.azTris = tris;
  backFx(a, 0, life, (u) => {
    const t = u * life, ramp = easeOut(clamp01(t / 0.6)), out = 1 - segU(t, fin + 0.3, life);
    azCold(0.45 * ramp * out, 0.6 * ramp * out, '4,12,24');
  });
  // 앞 레이어: 지나간 자리의 색을 빼고(채도) 하얀 서리막을 덮는다
  aFx(a, 0, fin, (u) => {
    const t = u * fin, r = R(t), lx = Math.max(-60, x0 - r), rx = Math.min(W + 60, x0 + r);
    if (rx <= lx) return;
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = `rgba(128,128,128,${0.85 * segU(t, 0.3, 0.6)})`;
    ctx.fillRect(lx, Y0, rx - lx, Y1 - Y0);
    ctx.globalCompositeOperation = 'source-over';
    const frozen = segU(t, lock - 0.05, lock + 0.1);
    ctx.fillStyle = `rgba(228,246,255,${0.42 + 0.24 * frozen})`;
    ctx.fillRect(lx, Y0, rx - lx, Y1 - Y0);
    // 위아래 가장자리에 서리 결정(F19 작은 눈꽃)이 돋는다
    ctx.restore();
    for (let x = Math.ceil(lx / 40) * 40; x < rx; x += 40) { azFlake(x, Y0 + 4, 7, x, 0.6 + 0.4 * frozen); azFlake(x + 20, Y1 - 4, 7, x + 1, 0.6 + 0.4 * frozen); }
    ctx.save();
    // 얼어붙는 앞머리: 하얀 서리가 결정 모양으로 번진다
    ctx.restore();
    for (const ex of [x0 - r, x0 + r]) {
      if (ex < -40 || ex > W + 40 || t > lock) continue;
      for (let k = 0; k < 4; k++) azFlake(ex, mix(Y0 + 10, Y1 - 10, k / 3), 12, t * 3 + k, 0.9);
    }
    azCracks(a.azCracks, 1);
  }, null, (u) => {
    const t = u * fin;
    if (t < lock && Math.random() < 0.8) {
      const tp = azTip(a), ang = rand(0, Math.PI * 2), rr = rand(20, 48);
      parts.push({ x: tp.x + Math.cos(ang) * rr, y: tp.y + Math.sin(ang) * rr, vx: -Math.cos(ang) * rr * 3, vy: -Math.sin(ang) * rr * 3, g: 0, size: 2, color: '#ffffff', life: 0.3, t: 0, add: true });
    }
  });
}
// ★ 잔타: 맞은 자리에서 서리막에 금이 쩍 간다
function azGlassCrack(a, x, y, big) {
  // ★ 잔타: 맞은 자리에서 서리막에 유리 금(F19b)이 쩍 간다 — 작게 먼저, 0.12초 뒤 제 크기
  const list = [];
  const n = big ? 3 : 1 + Math.floor(rand(0, 2));
  for (let k = 0; k < n; k++) azCrackPath(x + rand(-10, 10), y + rand(-8, 8), rand(0, Math.PI * 2), big ? rand(90, 200) : rand(50, 110), list);
  for (const c of list) { c.p = 0; a.azCracks.push(c); }
  aFx(a, 0, 0.12, (u) => { for (const c of list) c.p = u; }, () => { for (const c of list) c.p = 1; });
  texFx('f19', x, y, AZ_LIT(), { life: 0.2, scale: 1 / 3, fade: 0.5 });
  burst(x, y, 6, ['#ffffff', '#cff6ff'], 110, 2, 260);
}
// ★ 마무리: 서리막이 삼각형 유리 조각이 되어 한꺼번에 터져 나간다
function azGlassBreak(a) {
  // ★ 마무리: 서리막이 유리 조각(P10)이 되어 한꺼번에 터져 나가고, 가운데에 거대 눈꽃(F19)이 번쩍 핀다. 흰 섬광 α 0.6·0.15초
  const tris = a.azTris || [], X = azCenter(a), Y = groundY() - 30, life = 1.1, ramp = AZ_RAMP();
  const pick = tris.filter((_, k) => k % 3 === 0);
  for (const tr of pick) {
    const dx = tr.cx - X, dy = tr.cy - Y, dist = Math.hypot(dx, dy) || 1, pow = 260 * Math.max(0.25, 1 - dist / (W * 0.8));
    Object.assign(tr, { x: tr.cx, y: tr.cy, vx: dx / dist * pow + rand(-30, 30), vy: dy / dist * pow * 0.6 - rand(40, 140), r: rand(0, 6), vr: rand(-6, 6), delay: dist / 1400 });
  }
  let last = 0;
  aFx(a, 0, 0.15, (u) => dimBand(0.6 * (1 - u), '235,250,255'));
  mgFx(a, 'f19', X, Y - 10, AZ_LIT(), { scale: 2, life: 0.6, fade: 0.5 });
  aFx(a, 0, life, (u) => {
    const t = u * life, dt = Math.max(0, Math.min(0.05, t - last)); last = t;
    for (const tr of pick) {
      const go = t > tr.delay;
      if (go) { tr.vy += 380 * dt; tr.x += tr.vx * dt; tr.y += tr.vy * dt; tr.r += tr.vr * dt; }
      vfxDraw(ctx, 'p10', ramp, 0, tr.x, tr.y, { scale: go && t - tr.delay > 0.3 ? 2 / 3 : 1, rot: Math.round(tr.r / 0.785) * 0.785, alpha: 1 - easeIn(u) });
    }
  });
  for (let k = 0; k < 24; k++) parts.push({ x: rand(0, W), y: rand(18, groundY() - 4), vx: rand(-80, 80), vy: rand(-120, 0), g: 200, size: 2, color: AZ_ICE[k % 3], life: rand(0.5, 1), t: 0, add: true });
}

// ── ★★ 시간 동결: 얼음 시계 → 푸른 정지 화면 → 결정이 하나씩 솟고 → 동시에 깨진다 ──
function azClockDraw(X, Y, R, t, stopT, al, crack = 0) {
  // 얼음 시계 = F19 거대 눈꽃이 시계판이 되어 미친 듯 돌다가 멎고, 바늘 둘은 P10 빙하 창끝 (짧은 시침 2/3배, 긴 분침 1배)
  if (al <= 0) return;
  const p = clamp01(t / stopT), turn = 46 * (1 - (1 - p) ** 2);
  const mA = -Math.PI / 2 + turn, hA = -Math.PI / 2 + turn / 12 + 0.9, ramp = AZ_RAMP();
  vfxDraw(ctx, 'f19', ramp, Math.min(2, Math.floor(p * 3)), X, Y, { scale: R > 40 ? 2 : 4 / 3, rot: Math.round((turn * 0.2) / 0.2618) * 0.2618, alpha: al * 0.9 });
  const hand = (ang, len, sc) => vfxDraw(ctx, 'p10', AZ_LIT(), 0, X + Math.cos(ang) * len / 2, Y + Math.sin(ang) * len / 2, { scale: sc, rot: ang, alpha: al });
  hand(hA, R * 0.5, 2 / 3);
  hand(mA, R * 0.8, 1);
}
function azTimeStage(a) {
  const d = a.k.dur, hits = a.k.hits.map((h) => h[0] * d), STOP = hits[0], fin = hits[hits.length - 1], life = d + 0.7;
  const X = azMid(a, 70), Y = 74, R = 50, gy = groundY();
  a.azSpikes = [];
  a.azStop = { X, Y, R, fin };
  // 멎은 하늘에 걸린 눈송이들 (정지 화면 속에서 움직이지 않는다)
  const flakes = [];
  for (let k = 0; k < Math.round(W / 14); k++) flakes.push([rand(0, W), rand(20, gy - 10), rand(1.5, 3.5), rand(0, 1)]);
  backFx(a, 0, life, (u) => {
    const t = u * life, ramp = easeOut(clamp01(t / 0.6)), out = 1 - segU(t, fin + 0.1, fin + 0.4);
    azCold(0.55 * ramp * out, 0.5 * ramp * out, '2,8,22');
    if (t < fin) azClockDraw(X, Y, R * mix(0.7, 1, easeOut(clamp01(t / 0.5))), t, STOP, Math.min(1, t / 0.35) * (t > STOP ? 0.75 : 1));
  });
  // 앞 레이어: 멎는 순간부터 하단바가 푸른 정지 화면이 된다 (색은 남빛 하나로, 밝기만 남는다)
  aFx(a, 0, life, (u) => {
    const t = u * life;
    if (t < STOP) return;
    const k = Math.min(1, (t - STOP) / 0.08) * (1 - segU(t, fin, fin + 0.2));
    if (k <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = `rgba(70,150,255,${0.85 * k})`;
    ctx.fillRect(-60, 16, W + 120, H - 32);
    ctx.globalCompositeOperation = 'source-over';
    // 정지 화면의 가는 주사선과 네 귀퉁이 표식
    ctx.fillStyle = `rgba(200,240,255,${0.06 * k})`;
    for (let y = 18; y < H - 16; y += 3) ctx.fillRect(0, y, W, 1);
    ctx.fillStyle = `rgba(207,246,255,${0.8 * k})`;
    for (const [cx, sx] of [[8, 1], [W - 8, -1]]) for (const [cy, sy] of [[22, 1], [H - 22, -1]]) { ctx.fillRect(cx, cy, 10 * sx, 2); ctx.fillRect(cx, cy, 2, 10 * sy); }
    // 멈춘 눈송이
    ctx.fillStyle = '#ffffff';
    for (const [fx, fy, s, b] of flakes) { ctx.globalAlpha = k * (0.5 + 0.5 * b); ctx.fillRect(Math.round(fx), Math.round(fy), Math.round(s), Math.round(s)); }
    ctx.restore();
    // 시계 바늘이 멎은 자리에서 정지 고리가 한 번 퍼진다
    const r = clamp01((t - STOP) / 0.5);
    if (r < 1) vfxDraw(ctx, 'c3', AZ_LIT(), Math.min(4, Math.floor(r * 5)), X, Y + 10, { scale: r < 0.3 ? 2 : r < 0.6 ? 3 : 4, alpha: 1 - r });
  });
  // 솟은 결정들 (정지 화면 위에 그려 혼자 빛난다)
  aFx(a, 0, life, (u) => {
    const t = u * life;
    for (const s of a.azSpikes) {
      if (s.broken) continue;
      const g = easeOut(clamp01((clock - s.at) / 0.12));
      // 깨지기 직전엔 모든 결정이 바르르 떨며 빛난다 (밝은 램프 깜박임)
      const shiver = t > fin - 0.2 && t < fin;
      azSpike(s.x + (shiver ? rand(-1, 1) : 0), gy + 1, s.h * g, s.w, 1, s.lean, shiver ? 1 : 0.5);
    }
  });
}
// ★★ 잔타: 대상 자리와 하단바 곳곳에서 결정이 하나씩 솟아 그대로 멈춘다
function azRaiseSpike(a, x, big) {
  a.azSpikes.push({ x, h: big ? rand(56, 66) : rand(30, 46), w: 10, lean: rand(-6, 6), at: clock });
  burst(x, groundY() - 4, 4, ['#ffffff', '#cff6ff'], 80, 2, 300);
}
// ★★ 마무리: 결정이 동시에 깨지고, 시계도 부서지며 색이 돌아온다
function azTimeBreak(a) {
  // ★★ 마무리: 결정이 동시에 깨지고(K39 뒤 프레임), 시계 눈꽃도 부서지며 색이 돌아온다. 흰 섬광 α 0.6·0.15초
  const S = a.azStop, gy = groundY(), ramp = AZ_RAMP(), n = VFX_SHEETS.k39.frames;
  aFx(a, 0, 0.15, (u) => dimBand(0.6 * (1 - u), '230,248,255'));
  for (const s of a.azSpikes) {
    s.broken = true;
    const sc = s.h < 36 ? 2 / 3 : s.h < 54 ? 1 : 4 / 3;
    aFx(a, 0, 0.4, (u) => vfxDraw(ctx, 'k39', ramp, Math.min(n - 1, n - 3 + Math.floor(u * 3)), s.x, gy + 1, { scale: sc, anchor: 'b', flip: s.lean < 0, alpha: 1 - easeIn(u) }));
    azShatter(a, s.x, gy - s.h * 0.5, 5, 220, 4, 0.8);
  }
  if (S) {
    mgFx(a, 'f19', S.X, S.Y, AZ_LIT(), { scale: 2, life: 0.4, fade: 0.6 });
    mgFx(a, 'c3', S.X, S.Y + 20, ramp, { scale: 4, life: 0.5, fade: 0.5 });
    azShatter(a, S.X, S.Y, 10, 240, 5, 0.9);
  }
}

// F18 빙하 산맥 + 오로라 (240×100 도트 = 하단바 높이). [x0, x1] 구간만, 하단바가 넓으면 좌우 반전해 이어 붙인다
function azGlacierBg(al, x0, x1) {
  const s = VFX_SHEETS.f18;
  if (!s || !s.lv || al <= 0 || x1 <= x0) return;
  const tw = s.fw * VFX_DOT, f = mgLoop('f18', 6);
  for (let L = Math.floor(x0 / tw) * tw, j = Math.floor(x0 / tw); L < x1; L += tw, j++) {
    const a0 = Math.max(0, (x0 - L) / tw), a1 = Math.min(1, (x1 - L) / tw);
    if (a1 <= a0) continue;
    const c0 = j % 2 ? 1 - a1 : a0, c1 = j % 2 ? 1 - a0 : a1;
    vfxDraw(ctx, 'f18', AZ_RAMP(), f, L + tw * (a0 + a1) / 2, groundY() + 2, { anchor: 'b', crop: [c0, c1], flip: j % 2 === 1, alpha: al });
  }
}

// ── ★★★ 영원의 겨울: 눈보라 속 거대 눈꽃 → 빙하 → 금 → 통째로 부서지며 눈보라 ──
function azWinterStage(a) {
  const d = a.k.dur, hits = a.k.hits.map((h) => h[0] * d), LAND = hits[0], BIG = hits[hits.length - 2], fin = hits[hits.length - 1], life = d + 1.4;
  const X = azMid(a, 80), gy = groundY(), STEP = 6, n = Math.ceil((W + 80) / STEP);
  // 빙하 윤곽: 칸마다 높이 (큰 봉우리 몇 개 + 잔 들쭉날쭉)
  const peaks = Array.from({ length: Math.max(4, Math.round(W / 110)) }, () => [rand(-20, W + 20), rand(30, 60), rand(30, 70)]);
  const top = [];
  for (let i = 0; i <= n; i++) {
    const x = -40 + i * STEP;
    let h = 44 + 8 * Math.sin(x * 0.03) + rand(-4, 4);
    for (const [px, ph, pw] of peaks) h += ph * Math.max(0, 1 - Math.abs(x - px) / pw);
    top.push([x, gy - Math.min(108, h)]);
  }
  a.azGlacier = { top, X };
  a.azCracks = [];
  // 눈보라 결: 내리는 눈 (처음엔 조용히, 빙하가 깨진 뒤엔 옆으로 휩쓴다)
  const snow = [];
  const spread = (t) => easeOut(segU(t, LAND, LAND + 0.4)) * (W + 100);
  const flakeY = (t) => { const p = segU(t, 0.3, LAND); return mix(-50, gy - 52, p * p); };
  backFx(a, 0, life, (u) => {
    const t = u * life, ramp = easeOut(clamp01(t / 0.8)), out = 1 - segU(t, fin + 0.6, life);
    azCold(0.66 * ramp * out, 0.45 * ramp * out, '2,6,18');
    // 하늘: F18 빙하 산맥 + 오로라 배경이 서서히 떠오른다 (하단바 폭이 넓으면 좌우 반전해 이어 붙인다)
    azGlacierBg(ramp * out * 0.85, 0, W + 80);
    // 내려오는 거대 눈꽃(F19 2배): 천천히 돌며, 땅에 닿기 직전 빠르게 떨어진다
    if (t > 0.25 && t < LAND + 0.05) azFlake(X, flakeY(t), mix(44, 58, segU(t, 0.3, LAND)), t * 0.8, 1);
  });
  // 앞 레이어: 빙하 + 눈
  aFx(a, 0, life, (u) => {
    const t = u * life;
    if (t > LAND && t < fin) {
      const R = spread(t), sh = t > BIG && t < fin ? rand(-1, 1) : 0;
      // 빙하: 눈꽃이 박힌 자리에서 F18 산맥이 양쪽으로 번져 앞을 덮는다 (반투명, 안의 기사·적이 비친다)
      ctx.save(); ctx.translate(sh, 0);
      azGlacierBg(0.55, Math.max(-40, X - R), Math.min(W + 40, X + R));
      ctx.restore();
      azCracks(a.azCracks, 1);
    }
    // 눈: 처음엔 비스듬히 내리고, 깨진 뒤엔 눈보라가 되어 옆으로 휩쓴다
    ctx.save();
    for (const s of snow) {
      ctx.globalAlpha = s.al;
      ctx.fillStyle = '#ffffff';
      if (s.storm) ctx.fillRect(Math.round(s.x), Math.round(s.y), Math.round(s.len), 1);
      else ctx.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s);
    }
    ctx.restore();
    // 마지막: 하얀 눈보라 안개가 하단바를 덮었다가 걷힌다
    if (t > fin) { const k = t - fin; dimBand((k < 0.1 ? k / 0.1 : 1 - segU(k, 0.3, life - fin)) * 0.45, '235,248,255'); }
  }, null, (u, dt) => {
    const t = u * life, storm = t > fin;
    const rate = (storm ? 260 * (1 - segU(t, fin + 0.5, life)) : 40 + 60 * segU(t, 0.3, LAND)) * Math.max(1, W / 480);
    for (let c = rate * dt + Math.random(); c >= 1; c--) {
      if (storm) snow.push({ storm: true, x: a.dir > 0 ? rand(-80, W * 0.5) : rand(W * 0.5, W + 80), y: rand(18, gy), vx: a.dir * rand(500, 800), vy: rand(-20, 40), len: rand(8, 22), al: rand(0.4, 0.9), life: 0.8 });
      else snow.push({ x: rand(-40, W + 40), y: rand(10, 18), vx: a.dir * rand(10, 40), vy: rand(30, 70), s: Math.random() < 0.3 ? 3 : 2, al: rand(0.5, 1), life: 3 });
    }
    for (const s of snow) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; if (!s.storm) s.x += Math.sin(clock * 2 + s.y * 0.1) * 0.3; }
    for (let i = snow.length - 1; i >= 0; i--) { const s = snow[i]; if (s.life <= 0 || s.y > gy || s.x < -120 || s.x > W + 120) snow.splice(i, 1); }
  });
}
// ★★★ 눈꽃이 땅에 박히는 순간: 섬광 + 땅을 따라 달리는 냉기 고리
function azWinterLand(a) {
  // ★★★ 눈꽃이 땅에 박히는 순간: 섬광(α 0.6·0.15초) + 땅을 따라 달리는 냉기 고리(C3 ×4)
  const G = a.azGlacier, gy = groundY();
  aFx(a, 0, 0.15, (u) => dimBand(0.6 * (1 - u), '230,248,255'));
  mgFx(a, 'c3', G.X, gy + 2, AZ_RAMP(), { scale: 4, life: 0.6, anchor: 'b', fade: 0.5 });
  mgFx(a, 'f19', G.X, gy - 50, AZ_LIT(), { scale: 2, life: 0.35, frames: 99, fade: 0.5 });
  for (let k = 0; k < 18; k++) parts.push({ x: G.X + rand(-30, 30), y: gy - rand(10, 60), vx: rand(-260, 260), vy: rand(-220, -40), g: 360, size: 2, color: AZ_ICE[k % 3], life: rand(0.5, 0.9), t: 0, add: true });
}
// ★★★ 마무리: 빙하가 큰 덩어리로 쪼개져 튀어 오르고 무너진다
function azGlacierBreak(a) {
  // ★★★ 마무리: 빙하가 통째로 부서진다 — 하단바 곳곳에서 K39 결빙이 깨지는 프레임 + 빙하 조각(P10)이 튀어 오른다. 흰 섬광 α 0.6·0.15초
  const G = a.azGlacier, gy = groundY(), ramp = AZ_RAMP(), n = VFX_SHEETS.k39.frames;
  if (!G) return;
  aFx(a, 0, 0.15, (u) => dimBand(0.6 * (1 - u), '240,250,255'));
  G.broken = clock;
  for (let x = 30; x < W; x += 70) {
    const big = Math.abs(x - G.X) < 60;
    aFx(a, rand(0, 0.08), 0.45, (u) => vfxDraw(ctx, 'k39', ramp, Math.min(n - 1, n - 3 + Math.floor(u * 3)), x, gy + 2, { scale: big ? 2 : 4 / 3, anchor: 'b', flip: x % 140 < 70, alpha: 1 - easeIn(u) }));
    azShatter(a, x, gy - 40, 4, 260, 3, 1.0);
  }
}
// ★★★ 큰 금: 빙하를 위에서 아래로 쪼개는 금이 하단바 곳곳에 한꺼번에
function azGlacierSplit(a) {
  // ★★★ 큰 금: 빙하를 쪼개는 유리 금(F19b)이 하단바 곳곳에 한꺼번에
  const G = a.azGlacier;
  if (!G) return;
  for (let k = 0; k < Math.max(5, Math.round(W / 80)); k++) azCrackPath(rand(10, W - 10), groundY() - rand(30, 70), Math.PI / 2 + rand(-0.3, 0.3), 90, a.azCracks);
}

// 빙결의 군주 궁극기 자세: 지팡이를 치켜들어 냉기를 모았다가, 얼어붙는 순간 땅에 내리꽂는다. 마지막 일격에 한 번 더 들어 내리꽂는다
function azPose(u, a) {
  const m = (a && a.mast) || 0, D = a && a.k ? a.k.dur : 2.7, t = u * D;
  const hits = a && a.k ? a.k.hits : [[0.5], [0.9]], first = hits[0][0] * D, fin = hits[hits.length - 1][0] * D;
  const up = easeOut(clamp01(t / 0.35)), hover = m >= 3 && t < first ? 6 * easeOut(segU(t, 0.2, 0.9)) + Math.sin(t * 4) * up : 0;
  const plant = (t0) => { const r = easeIn(segU(t, t0 - 0.08, t0)); return { bowA: mix(-0.3, 1.25, r), pull: 13 * (1 - r), sy: mix(1.04, 0.9, r), skew: 0.1 * r, dx: 3 * r, lift: hover * (1 - r) }; };
  if (t < first - 0.08) return { bowA: mix(0, -0.3, up), pull: 13 * easeOut(segU(t, 0.1, first - 0.1)), sy: mix(1, 1.04, up), lift: hover };
  if (t < first + 0.02) return plant(first);
  // 꽂은 채 버틴다 (지팡이 끝에서 냉기가 퍼진다)
  if (t < fin - 0.3) return { bowA: 1.25, pull: 4 + 2 * Math.sin(t * 20), sy: 0.92, skew: 0.08, dx: 3 };
  if (t < fin - 0.08) { const r = easeOut(segU(t, fin - 0.3, fin - 0.12)); return { bowA: mix(1.25, -0.3, r), pull: 13 * r, sy: mix(0.92, 1.05, r), skew: 0.08 * (1 - r), dx: 3 * (1 - r) }; }
  return plant(fin);
}

Object.assign(SKILL_FX, {
  absoluteZero: {
    pose: azPose,
    cues: (a) => {
      const m = a.mast, d = a.k.dur, hits = a.k.hits.map((h) => h[0] * d), fin = hits[hits.length - 1];
      const list = [[0, m === 0 ? azFrostStage : m === 1 ? azWhiteStage : m === 2 ? azTimeStage : azWinterStage]];
      // Lv1: 얼음 덩어리는 첫 타격에 생겨 마지막 타격까지 버틴다
      if (m === 0) list.push([hits[0] / d, (a) => { for (const t of a.targets()) azIceBlock(a, t.x, fin - hits[0], true); }]);
      return list;
    },
    hit(a, i, n) {
      const m = a.mast, last = i === n - 1, tg = a.targets(i), gy = groundY();
      if (m === 0) {
        if (!last) {
          for (const t of tg) azFlake(t.x, t.y - 10, 12, rand(0, 3), 0.9);
          impact({ stop: 0.1, shake: 0.25 });
          return;
        }
        aFx(a, 0, 0.14, (u) => dimBand(0.4 * (1 - u), '230,248,255'));
        for (const t of tg) azShatter(a, t.x, gy - 22, 12, 230, 5);
        impact({ stop: 0.22, shake: 0.55 });
        return;
      }
      if (m === 1) {
        if (i === 0) {
          // 온통 얼어붙는 순간
          aFx(a, 0, 0.16, (u) => dimBand(0.5 * (1 - u), '240,250,255'));
          impact({ stop: 0.16, shake: 0.35 });
          return;
        }
        if (last) {
          azGlassBreak(a);
          for (const t of tg) burst(t.x, t.y, 12, AZ_ICE, 240, 2, 200);
          impact({ stop: 0.3, shake: 0.75 });
          return;
        }
        for (const t of tg) azGlassCrack(a, t.x + rand(-6, 6), t.y + rand(-8, 8), false);
        impact({ stop: 0.05, shake: 0.18 });
        return;
      }
      if (m === 2) {
        if (i === 0) {
          // 바늘이 멎는 순간: 째깍 하는 섬광
          aFx(a, 0, 0.12, (u) => dimBand(0.45 * (1 - u), '220,240,255'));
          impact({ stop: 0.25, shake: 0.3 });
          return;
        }
        if (last) {
          azTimeBreak(a);
          for (const t of tg) burst(t.x, t.y, 12, AZ_ICE, 230, 2, 200);
          impact({ stop: 0.3, shake: 0.75 });
          return;
        }
        for (const t of tg) azRaiseSpike(a, t.x + rand(-10, 10), false);
        // 하단바 곳곳에서도 하나씩 (차례로 자리를 옮겨 가며)
        const per = Math.max(1, Math.round(W / 400));            // 넓은 창이면 한 번에 여럿
        for (let j = 0; j < per; j++) azRaiseSpike(a, (((i * per + j) * 0.618034 + 0.1) % 1) * (W - 20) + 10, (i + j) % 3 === 0);
        impact({ shake: 0.12 });
        return;
      }
      // ★★★
      if (i === 0) {
        azWinterLand(a);
        impact({ stop: 0.2, shake: 0.6 });
        return;
      }
      if (last) {
        azGlacierBreak(a);
        for (const t of tg) burst(t.x, t.y, 14, AZ_ICE, 260, 2, 160);
        impact({ stop: 0.32, shake: 0.85 });
        return;
      }
      if (i === n - 2) {
        azGlacierSplit(a);
        aFx(a, 0, 0.14, (u) => dimBand(0.4 * (1 - u), '230,248,255'));
        impact({ stop: 0.18, shake: 0.55 });
        return;
      }
      for (const t of tg) {
        const list = [];
        for (let k = 0; k < 3; k++) azCrackPath(t.x + rand(-6, 6), t.y + rand(-10, 10), rand(0, Math.PI * 2), rand(40, 80), list);
        a.azCracks.push(...list);
      }
      impact({ shake: 0.14 });
    },
    // 명중 그림 K39 (전신 결빙 → 산산조각, 땅 기준)는 막타에만: ★★★ 2배, 그 밖 4/3배. 잔타는 금·결정·서리가 맡는다
    hitTex(a, t, share, i, n) {
      if (i < n - 1) return;
      mgFx(a, 'k39', t.x, groundY() + 2, AZ_LIT(), { scale: a.mast >= 3 ? 2 : 4 / 3, life: 0.5, anchor: 'b', fade: 0.3 });
    },
    kb: 12,
  },
});
