'use strict';
// 3차 궁극기 「절대영도」 연출 (frostlord). 수치·단계는 src/classes.js 의 SKILLS.absoluteZero, 공통 레터박스·컷인은 src/skills.js 의 drawUltScreen.
//  Lv1 「빙결」 지팡이 끝에서 서리가 땅을 타고 번져 고사리 같은 얼음꽃이 자라고 — 적이 얼음 덩어리에 갇혔다가, 금이 가며 깨진다
//  ★   「절대영도」 온도가 빠져나가듯 하단바의 색이 바래며 하얀 서리막이 퍼져 온통 얼어붙고 — 유리처럼 금이 쩍쩍 가다가 한꺼번에 산산이 부서진다
//  ★★  「시간 동결」 하늘에 얼음 시계가 떠 바늘이 미친 듯 돌다 멎는 순간 하단바가 푸른 정지 화면이 되고 — 얼음 결정이 하나씩 솟아 멈춰 있다가 동시에 깨지며 색이 돌아온다
//  ★★★ 「영원의 겨울」 눈보라 속 하늘에서 거대한 눈꽃 결정이 내려와 땅에 박히며 하단바 전체를 덮는 빙하가 되고 — 금이 가던 빙하가 통째로 부서지며 눈보라가 휩쓴다
// 시전 내내 이어지는 큰 그림은 시전 시작에 한 번 만든 연출(뒤 레이어 냉기·시계·눈꽃 / 앞 레이어 서리·서리막·빙하)이 시간표대로 그리고,
// 타격 순간(hit)은 얼음이 갇히고 금 가고 깨지는 것만 더한다.

const AZ_ICE = ['#ffffff', '#cff6ff', '#8fdcff', '#4aa8e0'];
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
  if (dark > 0) dimBand(dark, rgb);
  if (glow <= 0) return;
  ctx.save();
  const g = ctx.createLinearGradient(0, 16, 0, H - 10);
  g.addColorStop(0, `rgba(150,220,255,${0.3 * glow})`); g.addColorStop(0.5, 'rgba(120,200,255,0)'); g.addColorStop(1, `rgba(200,240,255,${0.35 * glow})`);
  ctx.fillStyle = g; ctx.fillRect(-60, 0, W + 120, H);
  ctx.restore();
}
// 얼음 결정 기둥 (육각 기둥을 옆에서 본 모양): 밝은 왼면·어두운 오른면·하얀 모서리
function azSpike(x, by, h, w, al = 1, lean = 0, glint = 0) {
  if (h < 2 || al <= 0) return;
  const tx = x + lean, ty = by - h, sh = Math.min(h * 0.25, w * 0.8);
  ctx.save();
  ctx.globalAlpha = al;
  ctx.fillStyle = 'rgba(207,246,255,0.85)';
  ctx.beginPath(); ctx.moveTo(x - w / 2, by); ctx.lineTo(x - w / 2 + lean * 0.8, ty + sh); ctx.lineTo(tx, ty); ctx.lineTo(x + lean * 0.8, ty + sh); ctx.lineTo(x, by); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(90,170,230,0.85)';
  ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x + lean * 0.8, ty + sh); ctx.lineTo(tx, ty); ctx.lineTo(x + w / 2 + lean * 0.8, ty + sh); ctx.lineTo(x + w / 2, by); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - w / 2, by); ctx.lineTo(x - w / 2 + lean * 0.8, ty + sh); ctx.lineTo(tx, ty); ctx.lineTo(x + w / 2 + lean * 0.8, ty + sh); ctx.stroke();
  if (glint > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,255,255,${glint})`;
    const gy = mix(by, ty, (clock * 1.5 + x * 0.01) % 1);
    ctx.fillRect(Math.round(x - w / 2 + 1), Math.round(gy), Math.round(w - 2), 2);
  }
  ctx.restore();
}
// 눈꽃 (여섯 갈래, 갈래마다 잔가지 두 쌍)
function azFlake(x, y, r, rot, al = 1, col = '#ffffff', w = 1) {
  if (r < 1 || al <= 0) return;
  ctx.save();
  ctx.globalAlpha = al;
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const ang = rot + (k / 6) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang);
    ctx.moveTo(x, y); ctx.lineTo(x + c * r, y + s * r);
    for (const f of [0.45, 0.72]) {
      const bx = x + c * r * f, by = y + s * r * f, bl = r * (f < 0.5 ? 0.3 : 0.2);
      for (const sg of [-1, 1]) { const b = ang + sg * 0.9; ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(b) * bl, by + Math.sin(b) * bl); }
    }
  }
  ctx.stroke();
  ctx.restore();
}
// 금 한 갈래를 만든다: (x, y) 에서 ang 방향으로 마디마다 꺾이며 뻗고, 가끔 곁가지를 친다
function azCrackPath(x, y, ang, len, out, depth = 0) {
  const pts = [[x, y]];
  let px = x, py = y, a0 = ang;
  for (let s = 0; s < len; s += 10) {
    a0 += rand(-0.5, 0.5);
    px += Math.cos(a0) * rand(7, 12); py += Math.sin(a0) * rand(5, 10);
    py = Math.max(18, Math.min(groundY() - 1, py));
    pts.push([px, py]);
    if (depth < 1 && Math.random() < 0.18) azCrackPath(px, py, a0 + rand(-1.2, 1.2), len * 0.4, out, depth + 1);
  }
  out.push(pts);
}
// 금 여러 갈래를 진행도 p(0→1) 만큼 그린다 (하얀 심 + 하늘빛 번짐)
function azCracks(list, p, al = 1) {
  if (!list.length || al <= 0) return;
  ctx.save();
  ctx.globalAlpha = al;
  ctx.lineJoin = 'round';
  for (const [w, c] of [[3, 'rgba(40,120,210,0.6)'], [1.2, '#ffffff']]) {
    ctx.strokeStyle = c; ctx.lineWidth = w;
    ctx.beginPath();
    for (const pts of list) {
      const m = Math.max(2, Math.ceil(pts.length * (pts.p != null ? pts.p : p)));
      for (let j = 0; j < Math.min(m, pts.length); j++) (j ? ctx.lineTo(pts[j][0], pts[j][1]) : ctx.moveTo(pts[j][0], pts[j][1]));
    }
    ctx.stroke();
  }
  ctx.restore();
}
// 얼음 파편 한 무더기: 다각형 조각들이 튀어 돌며 떨어진다 (앞 레이어)
function azShatter(a, x, y, n, speed, size, life = 0.8) {
  const sh = [];
  for (let k = 0; k < n; k++) {
    const ang = rand(0, Math.PI * 2), v = rand(0.3, 1) * speed, s = rand(0.5, 1) * size;
    sh.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - speed * 0.4, r: rand(0, 6), vr: rand(-12, 12), s, pts: [[-s, -s * 0.4], [s * rand(0.2, 0.8), -s], [s, s * rand(0, 0.6)], [-s * rand(0, 0.6), s]] });
  }
  let last = 0;
  aFx(a, 0, life, (u) => {
    const dt = Math.max(0, Math.min(0.05, u * life - last)); last = u * life;
    ctx.save();
    for (const p of sh) {
      p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      if (p.y > groundY() - 2) { p.y = groundY() - 2; p.vy *= -0.3; p.vx *= 0.6; }
      const c = Math.cos(p.r), s = Math.sin(p.r);
      ctx.globalAlpha = 1 - easeIn(u);
      ctx.beginPath();
      p.pts.forEach(([px, py], j) => { const qx = p.x + px * c - py * s, qy = p.y + px * s + py * c; j ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy); });
      ctx.closePath();
      ctx.fillStyle = 'rgba(207,246,255,0.85)'; ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
  });
  burst(x, y, Math.round(n * 0.8), ['#ffffff', '#cff6ff', '#8fdcff'], speed * 0.9, 2, 300);
}

// ── Lv1 빙결: 땅을 타고 번지는 서리 → 얼음 덩어리 → 깨짐 ──
function azFrostStage(a) {
  const d = a.k.dur, hits = a.k.hits.map((h) => h[0] * d), lock = hits[0], fin = hits[hits.length - 1], life = d + 0.5, gy = groundY();
  const x0 = a.x() + a.dir * 18, reachMax = Math.max(80, Math.abs(azCenter(a) - x0) + 50);
  // 서리 고사리: 땅에서 비스듬히 자라는 얼음꽃 (번지는 앞머리가 지나가면 차례로 돋는다)
  const ferns = [];
  for (let s = 6; s < W + 80; s += rand(9, 16)) for (const sg of [1, -1]) {
    const x = x0 + sg * s;
    if (x < -20 || x > W + 20) continue;
    ferns.push({ x, s, h: rand(6, 16) * (s < reachMax ? 1 : 0.6), lean: rand(-0.5, 0.5), seed: azN(x) });
  }
  const reach = (t) => easeOut(segU(t, 0.25, lock - 0.05)) * (W + 80);
  backFx(a, 0, life, (u) => {
    const t = u * life, ramp = easeOut(clamp01(t / 0.7)), out = 1 - segU(t, fin + 0.15, life);
    azCold(0.48 * ramp * out, 0.8 * ramp * out);
  });
  aFx(a, 0, life, (u) => {
    const t = u * life, R = reach(t), out = 1 - segU(t, fin + 0.1, life);
    // 땅의 서리 띠: 하얀 윗줄 + 하늘빛 결정 점
    ctx.save();
    ctx.globalAlpha = out;
    ctx.fillStyle = 'rgba(220,245,255,0.75)';
    ctx.fillRect(Math.round(x0 - R), gy - 3, Math.round(R * 2), 3);
    ctx.fillStyle = '#ffffff';
    for (let s = 0; s < R; s += 7) for (const sg of [1, -1]) ctx.fillRect(Math.round(x0 + sg * s) - 1, gy - 4 - Math.round(azN(s + sg) * 2), 2, 2);
    // 번지는 앞머리: 반짝이는 하얀 결정
    for (const sg of [1, -1]) if (R < W + 70) azFlake(x0 + sg * R, gy - 5, 4, t * 4, 0.9, '#ffffff');
    ctx.strokeStyle = 'rgba(207,246,255,0.9)'; ctx.lineWidth = 1;
    for (const f of ferns) {
      if (f.s > R) continue;
      const g = easeOut(clamp01((R - f.s) / 30)), h = f.h * g;
      ctx.beginPath();
      ctx.moveTo(f.x, gy - 2); const tx = f.x + f.lean * h, ty = gy - 2 - h; ctx.lineTo(tx, ty);
      for (let k = 1; k <= 3; k++) {
        const bx = mix(f.x, tx, k / 4), by = mix(gy - 2, ty, k / 4), bl = h * 0.3 * (1 - k / 5);
        ctx.moveTo(bx, by); ctx.lineTo(bx - bl, by - bl * 0.7); ctx.moveTo(bx, by); ctx.lineTo(bx + bl, by - bl * 0.7);
      }
      ctx.stroke();
    }
    ctx.restore();
  }, null, (u) => {
    const t = u * life;
    // 지팡이 끝으로 냉기가 빨려 든다
    if (t < lock && Math.random() < 0.7) {
      const tp = azTip(a), ang = rand(0, Math.PI * 2), r = rand(18, 36);
      parts.push({ x: tp.x + Math.cos(ang) * r, y: tp.y + Math.sin(ang) * r, vx: -Math.cos(ang) * r * 3, vy: -Math.sin(ang) * r * 3, g: 0, size: 2, color: Math.random() < 0.5 ? '#cff6ff' : '#ffffff', life: 0.3, t: 0, add: true });
    }
  });
}
// 얼음 덩어리: 대상을 감싸며 아래부터 차오르고, 마지막이 다가오면 금이 번진다
function azIceBlock(a, x, until, big = false) {
  const gy = groundY(), w = big ? 34 : 28, h = big ? 50 : 42, cr = [];
  for (let k = 0; k < 4; k++) azCrackPath(x + rand(-4, 4), gy - h * rand(0.3, 0.7), rand(0, Math.PI * 2), 26, cr);
  const life = until;
  aFx(a, 0, life, (u) => {
    const t = u * life, g = easeOut(clamp01(t / 0.16)), top = gy - h * g, crack = segU(t, life - 0.45, life - 0.02);
    const shiver = crack > 0.6 ? rand(-1, 1) : 0, X = x + shiver;
    ctx.save();
    // 반투명한 얼음 몸 (안의 적이 비쳐 보인다)
    const gr = ctx.createLinearGradient(0, top, 0, gy);
    gr.addColorStop(0, 'rgba(230,250,255,0.62)'); gr.addColorStop(1, 'rgba(120,200,245,0.45)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(X - w / 2, gy); ctx.lineTo(X - w / 2 - 2, top + 8); ctx.lineTo(X - w / 4, top); ctx.lineTo(X + w / 3, top + 3); ctx.lineTo(X + w / 2 + 2, top + 10); ctx.lineTo(X + w / 2, gy);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke();
    // 면의 반사광 두 줄
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(Math.round(X - w / 2 + 3), Math.round(top + 6), 2, Math.round((gy - top) * 0.6));
    ctx.fillRect(Math.round(X - w / 2 + 7), Math.round(top + 10), 1, Math.round((gy - top) * 0.35));
    ctx.restore();
    if (crack > 0) azCracks(cr, crack, 1);
  });
  burst(x, gy - h / 2, 10, ['#ffffff', '#cff6ff'], 90, 2, 0);
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
    // 유리면에 비스듬한 반사광이 흐른다
    ctx.fillStyle = `rgba(255,255,255,${0.12 + 0.12 * frozen})`;
    for (let k = 0; k < Math.ceil(W / 70) + 2; k++) {
      const gx = ((k * 70 + t * 60) % (W + 140)) - 70;
      if (gx < lx - 30 || gx > rx) continue;
      ctx.beginPath(); ctx.moveTo(gx, Y0); ctx.lineTo(gx + 10, Y0); ctx.lineTo(gx - 26, Y1); ctx.lineTo(gx - 36, Y1); ctx.closePath(); ctx.fill();
    }
    // 위아래 가장자리에 고드름·서리 결정이 돋는다
    ctx.fillStyle = '#ffffff';
    for (let x = Math.ceil(lx / 6) * 6; x < rx; x += 6) {
      const n = azN(x), h = Math.round(2 + 7 * n * (0.4 + 0.6 * frozen));
      ctx.fillRect(x, Y0, 2, h); if (n > 0.6) ctx.fillRect(x + 2, Y0, 1, Math.round(h * 0.5));
      ctx.fillRect(x, Y1 - Math.round(h * 0.7), 2, Math.round(h * 0.7));
    }
    // 얼어붙는 앞머리: 하얀 서리가 결정 모양으로 번진다
    ctx.restore();
    for (const ex of [x0 - r, x0 + r]) {
      if (ex < -40 || ex > W + 40 || t > lock) continue;
      ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(Math.round(ex) - 1, Y0, 2, Y1 - Y0); ctx.restore();
      for (let k = 0; k < 5; k++) azFlake(ex, mix(Y0 + 10, Y1 - 10, k / 4), 5 + 2 * azN(k + Math.round(ex)), t * 3 + k, 0.9);
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
  const list = [];
  const n = big ? 6 : 3 + Math.floor(rand(0, 2));
  for (let k = 0; k < n; k++) azCrackPath(x, y, (k / n) * Math.PI * 2 + rand(-0.3, 0.3), big ? rand(90, 200) : rand(50, 110), list);
  for (const pts of list) { pts.p = 0; a.azCracks.push(pts); }
  aFx(a, 0, 0.12, (u) => { for (const pts of list) pts.p = easeOut(u); }, () => { for (const pts of list) pts.p = 1; });
  // 충격점: 하얀 별 + 작은 유리 가루
  aFx(a, 0, 0.2, (u) => {
    ctx.save(); ctx.globalAlpha = 1 - u; ctx.fillStyle = '#ffffff';
    const s = 10 * (1 - u) + 3;
    ctx.fillRect(Math.round(x - s), Math.round(y) - 1, Math.round(s * 2), 2); ctx.fillRect(Math.round(x) - 1, Math.round(y - s), 2, Math.round(s * 2));
    ctx.restore();
  });
  burst(x, y, 8, ['#ffffff', '#cff6ff'], 110, 2, 260);
}
// ★ 마무리: 서리막이 삼각형 유리 조각이 되어 한꺼번에 터져 나간다
function azGlassBreak(a) {
  const tris = a.azTris || [], X = azCenter(a), Y = groundY() - 30, life = 1.1;
  for (const tr of tris) {
    const dx = tr.cx - X, dy = tr.cy - Y, dist = Math.hypot(dx, dy) || 1, pow = 260 * Math.max(0.25, 1 - dist / (W * 0.8));
    Object.assign(tr, { x: tr.cx, y: tr.cy, vx: dx / dist * pow + rand(-30, 30), vy: dy / dist * pow * 0.6 - rand(40, 140), r: 0, vr: rand(-6, 6), delay: dist / 1400 });
  }
  let last = 0;
  aFx(a, 0, 0.18, (u) => dimBand(0.6 * (1 - u), '235,250,255'));
  aFx(a, 0, life, (u) => {
    const t = u * life, dt = Math.max(0, Math.min(0.05, t - last)); last = t;
    ctx.save();
    ctx.lineJoin = 'round';
    for (const tr of tris) {
      const go = t > tr.delay;
      if (go) { tr.vy += 380 * dt; tr.x += tr.vx * dt; tr.y += tr.vy * dt; tr.r += tr.vr * dt; }
      const k = go ? 1 - 0.55 * clamp01((t - tr.delay) / 0.6) : 1, c = Math.cos(tr.r) * k, s = Math.sin(tr.r) * k;      // 날아가며 작아진다
      ctx.globalAlpha = 1 - easeIn(u);
      ctx.beginPath();
      tr.pts.forEach(([px, py], j) => { const qx = tr.x + px * c - py * s, qy = tr.y + px * s + py * c; j ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy); });
      ctx.closePath();
      ctx.fillStyle = go ? 'rgba(225,246,255,0.5)' : 'rgba(240,252,255,0.7)'; ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
  });
  for (let k = 0; k < 50; k++) parts.push({ x: rand(0, W), y: rand(18, groundY() - 4), vx: rand(-80, 80), vy: rand(-120, 0), g: 200, size: k % 3 ? 2 : 3, color: AZ_ICE[k % 3], life: rand(0.5, 1), t: 0, add: true });
}

// ── ★★ 시간 동결: 얼음 시계 → 푸른 정지 화면 → 결정이 하나씩 솟고 → 동시에 깨진다 ──
function azClockDraw(X, Y, R, t, stopT, al, crack = 0) {
  if (al <= 0) return;
  // 바늘: 처음엔 미친 듯 돌다가 멎는 순간 딱 선다
  const p = clamp01(t / stopT), turn = 46 * (1 - (1 - p) ** 2);
  const mA = -Math.PI / 2 + turn, hA = -Math.PI / 2 + turn / 12 + 0.9;
  ctx.save();
  ctx.globalAlpha = al;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(X, Y, R * 0.2, X, Y, R * 1.3);
  g.addColorStop(0, 'rgba(120,200,255,0.18)'); g.addColorStop(1, 'rgba(80,160,255,0)');
  ctx.fillStyle = g; ctx.fillRect(X - R * 1.3, Y - R * 1.3, R * 2.6, R * 2.6);
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = '#cff6ff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(207,246,255,0.6)';
  ctx.beginPath(); ctx.arc(X, Y, R - 5, 0, Math.PI * 2); ctx.stroke();
  // 바깥 톱니 (멎기 전엔 돈다)
  ctx.fillStyle = '#8fdcff';
  for (let k = 0; k < 36; k++) { const ang = (k / 36) * Math.PI * 2 + turn * 0.05; ctx.fillRect(Math.round(X + Math.cos(ang) * (R + 3)) - 1, Math.round(Y + Math.sin(ang) * (R + 3)) - 1, 2, 2); }
  // 눈금: 열두 개 (셋·여섯·아홉·열두 시는 눈꽃)
  for (let k = 0; k < 12; k++) {
    const ang = (k / 12) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang);
    if (k % 3 === 0) azFlake(X + c * (R - 11), Y + s * (R - 11), 4, 0, 1, '#ffffff');
    else { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(X + c * (R - 9)) - 1, Math.round(Y + s * (R - 9)) - 1, 2, 2); }
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + Math.cos(hA) * R * 0.45, Y + Math.sin(hA) * R * 0.45); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + Math.cos(mA) * R * 0.78, Y + Math.sin(mA) * R * 0.78); ctx.stroke();
  ctx.fillStyle = '#5ad1ff'; ctx.fillRect(Math.round(X) - 2, Math.round(Y) - 2, 4, 4);
  ctx.restore();
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
    const r = easeOut(clamp01((t - STOP) / 0.5));
    if (r < 1) {
      ctx.save(); ctx.globalAlpha = 1 - r; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(X, Y, R + r * W * 0.6, (R + r * W * 0.6) * 0.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  });
  // 솟은 결정들 (정지 화면 위에 그려 혼자 빛난다)
  aFx(a, 0, life, (u) => {
    const t = u * life;
    for (const s of a.azSpikes) {
      if (s.broken) continue;
      const g = easeOut(clamp01((clock - s.at) / 0.12));
      azSpike(s.x, gy + 1, s.h * g, s.w, 1, s.lean, 0.5);
    }
    if (t > fin - 0.2 && t < fin) {
      // 깨지기 직전: 모든 결정이 바르르 떨며 빛난다
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const s of a.azSpikes) { ctx.fillStyle = 'rgba(200,240,255,0.25)'; ctx.fillRect(Math.round(s.x - s.w), Math.round(gy - s.h), Math.round(s.w * 2), Math.round(s.h)); }
      ctx.restore();
    }
  });
}
// ★★ 잔타: 대상 자리와 하단바 곳곳에서 결정이 하나씩 솟아 그대로 멈춘다
function azRaiseSpike(a, x, big) {
  a.azSpikes.push({ x, h: big ? rand(46, 60) : rand(26, 42), w: big ? 14 : rand(8, 11), lean: rand(-6, 6), at: clock });
  burst(x, groundY() - 4, 6, ['#ffffff', '#cff6ff'], 80, 2, 300);
}
// ★★ 마무리: 결정이 동시에 깨지고, 시계도 부서지며 색이 돌아온다
function azTimeBreak(a) {
  const S = a.azStop, gy = groundY();
  aFx(a, 0, 0.2, (u) => dimBand(0.6 * (1 - u), '230,248,255'));
  for (const s of a.azSpikes) { s.broken = true; azShatter(a, s.x, gy - s.h * 0.5, 7, 220, 4, 0.8); }
  if (S) {
    // 시계 판이 고리째 산산이 흩어진다
    for (let k = 0; k < 30; k++) {
      const ang = (k / 30) * Math.PI * 2;
      parts.push({ x: S.X + Math.cos(ang) * S.R, y: S.Y + Math.sin(ang) * S.R, vx: Math.cos(ang) * rand(120, 240), vy: Math.sin(ang) * rand(120, 240) - 40, g: 300, size: 3, color: k % 2 ? '#cff6ff' : '#ffffff', life: rand(0.5, 0.9), t: 0, add: true });
    }
    aFx(a, 0, 0.5, (u) => {
      ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * (1 - u) + 1;
      ctx.beginPath(); ctx.arc(S.X, S.Y, S.R * (1 + 0.8 * easeOut(u)), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    });
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
    // 하늘의 오로라 띠
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = `rgba(${k ? '120,255,220' : '120,200,255'},${0.08 * ramp * out})`;
      ctx.beginPath(); ctx.moveTo(-20, 30 + k * 8);
      for (let x = -20; x <= W + 20; x += 20) ctx.lineTo(x, 26 + k * 8 + 8 * Math.sin(x * 0.02 + t * 1.5 + k));
      for (let x = W + 20; x >= -20; x -= 20) ctx.lineTo(x, 40 + k * 8 + 10 * Math.sin(x * 0.017 + t * 1.2 + k * 2));
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // 내려오는 거대 눈꽃: 천천히 돌며 빛을 내고, 땅에 닿기 직전 빠르게 떨어진다
    if (t > 0.25 && t < LAND + 0.05) {
      const y = flakeY(t), r = mix(44, 58, segU(t, 0.3, LAND)), rot = t * 0.8;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(X, y, 4, X, y, r * 1.6);
      g.addColorStop(0, 'rgba(200,240,255,0.55)'); g.addColorStop(1, 'rgba(90,180,255,0)');
      ctx.fillStyle = g; ctx.fillRect(X - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2);
      ctx.restore();
      azFlake(X, y, r, rot, 0.95, '#8fdcff', 6);
      azFlake(X, y, r, rot, 1, '#ffffff', 2.5);
      ctx.save(); ctx.fillStyle = '#ffffff'; ctx.beginPath();
      for (let k = 0; k < 6; k++) { const ang = rot + k / 6 * Math.PI * 2; ctx.lineTo(X + Math.cos(ang) * 9, y + Math.sin(ang) * 9); }
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
  });
  // 앞 레이어: 빙하 + 눈
  aFx(a, 0, life, (u) => {
    const t = u * life;
    if (t > LAND && t < fin) {
      const R = spread(t), sh = t > BIG && t < fin ? rand(-1, 1) : 0;
      const vis = top.filter(([x]) => Math.abs(x - X) <= R);
      if (vis.length > 1) {
        ctx.save();
        ctx.translate(sh, 0);
        // 몸: 위는 하얗고 아래로 갈수록 깊은 푸른빛, 안의 기사·적이 비친다
        const g = ctx.createLinearGradient(0, gy - 110, 0, gy);
        g.addColorStop(0, 'rgba(235,250,255,0.72)'); g.addColorStop(0.5, 'rgba(150,215,245,0.55)'); g.addColorStop(1, 'rgba(60,130,200,0.6)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(vis[0][0], gy + 2);
        for (const [x, y] of vis) ctx.lineTo(x, y);
        ctx.lineTo(vis[vis.length - 1][0], gy + 2); ctx.closePath(); ctx.fill();
        // 결: 비스듬한 면 경계선
        ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let j = 0; j < vis.length; j += 4) { const [x, y] = vis[j]; ctx.moveTo(x, y + 2); ctx.lineTo(x + 14 * (azN(x) - 0.5) * 2, gy); }
        ctx.stroke();
        // 꼭대기 테두리: 하얀 눈 덮개
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath(); vis.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        // 번지는 앞머리의 하얀 빛
        ctx.globalCompositeOperation = 'lighter';
        for (const ex of [X - R, X + R]) { ctx.fillStyle = 'rgba(220,250,255,0.5)'; ctx.fillRect(Math.round(ex) - 3, gy - 90, 6, 92); }
        ctx.restore();
        azCracks(a.azCracks, 1);
      }
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
    if (t > fin) {
      const k = t - fin, al = (k < 0.1 ? k / 0.1 : 1 - segU(k, 0.3, life - fin)) * 0.75;
      ctx.save();
      const hz = ctx.createLinearGradient(0, 16, 0, H - 16);
      hz.addColorStop(0, `rgba(235,248,255,${al * 0.6})`); hz.addColorStop(1, `rgba(235,248,255,${al})`);
      ctx.fillStyle = hz; ctx.fillRect(-60, 0, W + 120, H);
      ctx.restore();
    }
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
  const G = a.azGlacier, gy = groundY();
  aFx(a, 0, 0.22, (u) => dimBand(0.7 * (1 - u), '230,248,255'));
  aFx(a, 0, 0.6, (u) => {
    ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(G.X, gy - 2, 20 + W * easeOut(u), 6 + 20 * easeOut(u), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  });
  for (let k = 0; k < 36; k++) parts.push({ x: G.X + rand(-30, 30), y: gy - rand(10, 60), vx: rand(-260, 260), vy: rand(-220, -40), g: 360, size: k % 3 ? 2 : 3, color: AZ_ICE[k % 3], life: rand(0.5, 0.9), t: 0, add: true });
}
// ★★★ 마무리: 빙하가 큰 덩어리로 쪼개져 튀어 오르고 무너진다
function azGlacierBreak(a) {
  const G = a.azGlacier, gy = groundY(), chunks = [];
  if (!G) return;
  const top = G.top;
  for (let i = 0; i < top.length - 1;) {
    const w = 3 + Math.floor(rand(0, 4)), seg = top.slice(i, Math.min(top.length, i + w + 1));
    i += w;
    if (seg.length < 2) break;
    const x0 = seg[0][0], x1 = seg[seg.length - 1][0], cut = gy - rand(14, 34);
    // 위 덩어리 (윤곽 꼭대기 → 들쭉날쭉한 자른 선) 와 아래 덩어리
    const upper = [...seg.map(([x, y]) => [x, Math.min(y, cut - 6)]), [x1, cut + rand(-4, 4)], [x0, cut + rand(-4, 4)]];
    const lower = [[x0, cut], [x1, cut], [x1, gy], [x0, gy]];
    for (const [pts, up] of [[upper, 1], [lower, 0]]) {
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const dx = cx - G.X;
      chunks.push({ x: cx, y: cy, pts: pts.map(([px, py]) => [px - cx, py - cy]), vx: Math.sign(dx || 1) * rand(60, 200) + dx * 0.5, vy: -(up ? rand(220, 380) : rand(80, 180)), r: 0, vr: rand(-4, 4) });
    }
  }
  let last = 0;
  const life = 1.2;
  aFx(a, 0, 0.25, (u) => dimBand(0.85 * (1 - u), '240,250,255'));
  aFx(a, 0, life, (u) => {
    const t = u * life, dt = Math.max(0, Math.min(0.05, t - last)); last = t;
    ctx.save();
    for (const c of chunks) {
      c.vy += 520 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt;
      const k = 1 - 0.5 * u, cs = Math.cos(c.r) * k, sn = Math.sin(c.r) * k;      // 날아가며 작아진다
      ctx.globalAlpha = 1 - easeIn(u);
      ctx.beginPath();
      c.pts.forEach(([px, py], j) => { const qx = c.x + px * cs - py * sn, qy = c.y + px * sn + py * cs; j ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy); });
      ctx.closePath();
      ctx.fillStyle = 'rgba(170,225,250,0.7)'; ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.restore();
  });
}
// ★★★ 큰 금: 빙하를 위에서 아래로 쪼개는 금이 하단바 곳곳에 한꺼번에
function azGlacierSplit(a) {
  const G = a.azGlacier;
  if (!G) return;
  for (let k = 0; k < Math.max(5, Math.round(W / 80)); k++) {
    const x = rand(10, W - 10), j = Math.max(0, Math.min(G.top.length - 1, Math.round((x + 40) / 6)));
    azCrackPath(x, G.top[j][1] + 2, Math.PI / 2 + rand(-0.3, 0.3), 90, a.azCracks);
  }
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
          for (const t of tg) { hitFx(t.x, t.y, '#cff6ff', 1.6); starFx(t.x, t.y - 10, 10, '#ffffff', 0.3); }
          impact({ stop: 0.1, shake: 0.25 });
          return;
        }
        aFx(a, 0, 0.14, (u) => dimBand(0.4 * (1 - u), '230,248,255'));
        for (const t of tg) { azShatter(a, t.x, gy - 22, 12, 230, 5); hitFx(t.x, t.y, '#ffffff', 2.6); }
        impact({ stop: 0.22, shake: 0.55 });
        return;
      }
      if (m === 1) {
        if (i === 0) {
          // 온통 얼어붙는 순간
          aFx(a, 0, 0.16, (u) => dimBand(0.5 * (1 - u), '240,250,255'));
          for (const t of tg) hitFx(t.x, t.y, '#cff6ff', 1.8);
          impact({ stop: 0.16, shake: 0.35 });
          return;
        }
        if (last) {
          azGlassBreak(a);
          for (const t of tg) { hitFx(t.x, t.y, '#ffffff', 3); burst(t.x, t.y, 28, AZ_ICE, 240, 3, 200); }
          impact({ stop: 0.3, shake: 0.75 });
          return;
        }
        for (const t of tg) { azGlassCrack(a, t.x + rand(-6, 6), t.y + rand(-8, 8), false); hitFx(t.x, t.y, '#cff6ff', 1.2); }
        impact({ stop: 0.05, shake: 0.18 });
        return;
      }
      if (m === 2) {
        if (i === 0) {
          // 바늘이 멎는 순간: 째깍 하는 섬광
          aFx(a, 0, 0.12, (u) => dimBand(0.45 * (1 - u), '220,240,255'));
          for (const t of tg) hitFx(t.x, t.y, '#cff6ff', 1.6);
          impact({ stop: 0.25, shake: 0.3 });
          return;
        }
        if (last) {
          azTimeBreak(a);
          for (const t of tg) { hitFx(t.x, t.y, '#ffffff', 3); burst(t.x, t.y, 26, AZ_ICE, 230, 3, 200); }
          impact({ stop: 0.3, shake: 0.75 });
          return;
        }
        for (const t of tg) { azRaiseSpike(a, t.x + rand(-10, 10), false); hitFx(t.x, t.y, '#cff6ff', 1.1); }
        // 하단바 곳곳에서도 하나씩 (차례로 자리를 옮겨 가며)
        const per = Math.max(1, Math.round(W / 400));            // 넓은 창이면 한 번에 여럿
        for (let j = 0; j < per; j++) azRaiseSpike(a, (((i * per + j) * 0.618034 + 0.1) % 1) * (W - 20) + 10, (i + j) % 3 === 0);
        impact({ shake: 0.12 });
        return;
      }
      // ★★★
      if (i === 0) {
        azWinterLand(a);
        for (const t of tg) hitFx(t.x, t.y, '#cff6ff', 2);
        impact({ stop: 0.2, shake: 0.6 });
        return;
      }
      if (last) {
        azGlacierBreak(a);
        for (const t of tg) { hitFx(t.x, t.y, '#ffffff', 3.2); burst(t.x, t.y, 34, AZ_ICE, 260, 3, 160); }
        impact({ stop: 0.32, shake: 0.85 });
        return;
      }
      if (i === n - 2) {
        azGlacierSplit(a);
        aFx(a, 0, 0.14, (u) => dimBand(0.4 * (1 - u), '230,248,255'));
        for (const t of tg) hitFx(t.x, t.y, '#ffffff', 2.4);
        impact({ stop: 0.18, shake: 0.55 });
        return;
      }
      for (const t of tg) {
        const list = [];
        for (let k = 0; k < 3; k++) azCrackPath(t.x + rand(-6, 6), t.y + rand(-10, 10), rand(0, Math.PI * 2), rand(40, 80), list);
        a.azCracks.push(...list);
        hitFx(t.x, t.y, '#cff6ff', 1.3);
      }
      impact({ shake: 0.14 });
    },
    kb: 12,
  },
});
