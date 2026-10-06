'use strict';
// 3차 궁극기 「용황 강림」 연출 (dragonlord). 수치·단계는 src/classes.js 의 SKILLS.dragonEmperor, 공통 레터박스·컷인은 src/skills.js 의 drawUltScreen.
//  Lv1 「흑룡 소환」 창을 하늘로 치켜들면 하단바가 보랏빛으로 가라앉고, 검은 용 한 마리가 뒤에서 날아와 적에게 불을 뿜으며 지나가다
//                  머리 위에서 불덩이를 내리꽂는다
//  ★ 「용황 강림」 하늘이 가로로 찢어져 빛이 새고, 그 틈에서 거대한 용황이 쏟아져 내려와 하단바를 휘감아 날며 땅을 불태운 뒤
//                  적에게 머리부터 내리꽂힌다 (불기둥)
//  ★★ 「쌍룡 강림」 용황 둘이 양쪽 끝에서 마주 날아와 교차하며 불을 쏟는다 — 하단바 전체가 불바다가 되고, 둘이 X 자로 내리꽂힌다
//  ★★★ 「용신의 심판」 하단바보다 큰 용신의 눈이 하늘에 뜨고, 눈길이 닿는 곳마다 불똥이 떨어진다 — 하단바의 빛을 빨아들인 눈동자가
//                  가늘어지는 순간 하늘에서 숨결이 내리꽂혀 땅 전체가 분홍빛 용암으로 녹아내린다
// 용은 스프라이트가 아니라 경로를 따라 마디를 이어 그린다: 머리가 지나간 길(dePath)을 몸 길이만큼 거슬러 올라가 마디를 놓는다(deBody)

const DE_PAL = {
  // 흑룡: 검은 몸, 분홍 불꽃 갈기
  black: { out: '#030106', body: '#1a0e26', dark: '#0b0612', scale: '#3e2456', belly: '#5e2e70', mane: '#ff4dd2', mane2: '#7a1a62', horn: '#d8c8e8', eye: '#ff4dd2' },
  // 용황: 자홍빛 몸, 금빛 배·뿔
  emperor: { out: '#1c0628', body: '#7e1a8a', dark: '#4a0f58', scale: '#d23cb0', belly: '#ffd27a', mane: '#ff9fe8', mane2: '#ff4dd2', horn: '#fff0c0', eye: '#ffe066' },
  // 쌍룡의 둘째: 보랏빛 몸, 흰 갈기
  violet: { out: '#0e0626', body: '#4c28b8', dark: '#2a1470', scale: '#a688ff', belly: '#d8ccff', mane: '#e8dcff', mane2: '#9a5cff', horn: '#f6f0ff', eye: '#ffe066' },
};
const DE_FIRE = ['#8a1f6a', '#ff4dd2', '#ff9fe8', '#ffffff'];
const DE_FIRE_V = ['#4a1aa0', '#a46cff', '#e0c8ff', '#ffffff'];

// 키프레임 [[t, x, y], ...] 을 매끄럽게 잇는 경로 (Catmull-Rom). 범위 밖은 양끝 방향으로 곧게 늘인다
function dePath(keys) {
  const n = keys.length;
  const lin = (p, q, t) => { const k = (t - p[0]) / (q[0] - p[0]); return { x: p[1] + (q[1] - p[1]) * k, y: p[2] + (q[2] - p[2]) * k }; };
  return (t) => {
    if (t <= keys[0][0]) return lin(keys[0], keys[1], t);
    if (t >= keys[n - 1][0]) return lin(keys[n - 2], keys[n - 1], t);
    let i = 0;
    while (keys[i + 1][0] < t) i++;
    const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(n - 1, i + 2)];
    const dt = p2[0] - p1[0], s = (t - p1[0]) / dt, s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    const tan = (a, b, j) => ((b[j] - a[j]) / Math.max(1e-6, b[0] - a[0])) * dt;
    return {
      x: h00 * p1[1] + h10 * tan(p0, p2, 1) + h01 * p2[1] + h11 * tan(p1, p3, 1),
      y: h00 * p1[2] + h10 * tan(p0, p2, 2) + h01 * p2[2] + h11 * tan(p1, p3, 2),
    };
  };
}
// 머리가 지나온 길을 거슬러 올라가며 몸 길이 L 을 N 마디로 나눈 점들 (머리 → 꼬리). 빠르게 날든 느리게 날든 몸 길이는 같다
function deBody(path, t, L, N) {
  const gap = L / N, pts = [path(t)];
  let prev = pts[0], acc = 0, tt = t;
  for (let it = 0; it < 1600 && pts.length <= N; it++) {
    tt -= 1 / 240;
    const p = path(tt);
    let fx = prev.x, fy = prev.y, seg = Math.hypot(p.x - fx, p.y - fy);
    while (seg > 1e-6 && acc + seg >= gap && pts.length <= N) {
      const k = (gap - acc) / seg;
      fx += (p.x - fx) * k; fy += (p.y - fy) * k;
      pts.push({ x: fx, y: fy });
      seg = Math.hypot(p.x - fx, p.y - fy); acc = 0;
    }
    acc += seg; prev = p;
  }
  return pts;
}
function deCircle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill(); }
function dePoly(pts) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); }

// 용 한 마리: pts 머리→꼬리, o = { r 굵기, pal, open 입 벌림 0~1, side 등 쪽(오른쪽으로 나는 용은 -1), alpha }
// 기운 → 등지느러미 → 다리 → 테두리 → 몸 → 배 비늘 → 비늘 무늬 → 꼬리 불꽃 → 머리(갈기·뿔·턱·이빨·눈·수염) 순서로 그린다
function deDragon(pts, o) {
  const P = o.pal, n = pts.length, R = o.r, side = o.side || -1;
  if (n < 4) return;
  const rad = (i) => { const s = i / (n - 1); return R * (s < 0.08 ? 0.72 + 0.28 * s / 0.08 : Math.max(0.1, 1 - 0.9 * Math.pow((s - 0.08) / 0.92, 1.15))); };
  // 마디마다 몸이 향하는 방향(머리 쪽)과 등 쪽 법선
  const fr = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = a.x - b.x, ty = a.y - b.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    return { tx, ty, nx: -ty * side, ny: tx * side };      // (nx, ny) 등 쪽
  });
  ctx.save();
  const ga = o.alpha == null ? 1 : o.alpha;
  // 몸을 감싼 용의 기운
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = P.mane2;
  ctx.globalAlpha = ga * 0.12;
  for (let i = 0; i < n; i += 3) deCircle(pts[i].x, pts[i].y, rad(i) * 1.9);
  ctx.globalAlpha = ga;
  ctx.globalCompositeOperation = 'source-over';
  // 등지느러미: 뒤로 젖혀진 가시가 마디마다 일렁인다
  for (let i = 3; i < n - 2; i += 2) {
    const p = pts[i], f = fr[i], r = rad(i), L = r * (1.1 + 0.25 * Math.sin(clock * 14 + i));
    const bx = p.x + f.nx * r * 0.7, by = p.y + f.ny * r * 0.7;
    const tipx = bx + f.nx * L - f.tx * L * 0.8, tipy = by + f.ny * L - f.ty * L * 0.8;
    ctx.fillStyle = P.out;
    dePoly([[bx + f.tx * r * 0.9, by + f.ty * r * 0.9], [tipx, tipy], [bx - f.tx * r * 0.7, by - f.ty * r * 0.7]]);
    ctx.fillStyle = i % 4 === 1 ? P.mane : P.mane2;
    dePoly([[bx + f.tx * r * 0.6, by + f.ty * r * 0.6], [tipx - f.nx, tipy - f.ny], [bx - f.tx * r * 0.4, by - f.ty * r * 0.4]]);
  }
  // 다리 넷 (몸통 앞뒤 두 쌍): 배 쪽으로 뻗어 발톱을 오므렸다 편다
  ctx.lineCap = 'round';
  for (const fi of [0.2, 0.24, 0.52, 0.56]) {
    const i = Math.round(fi * (n - 1)), p = pts[i], f = fr[i], r = rad(i), sw = Math.sin(clock * 9 + fi * 20);
    const kx = p.x - f.nx * r * 1.6 - f.tx * r * (0.6 + 0.3 * sw), ky = p.y - f.ny * r * 1.6 - f.ty * r * (0.6 + 0.3 * sw);
    const fx = kx - f.nx * r * 0.9 + f.tx * r * 0.5, fy = ky - f.ny * r * 0.9 + f.ty * r * 0.5;
    ctx.strokeStyle = P.out; ctx.lineWidth = r * 0.75;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.strokeStyle = P.dark; ctx.lineWidth = r * 0.45;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.strokeStyle = P.horn; ctx.lineWidth = Math.max(1, r * 0.16);
    for (let c = -1; c <= 1; c++) {
      ctx.beginPath(); ctx.moveTo(fx, fy);
      ctx.lineTo(fx - f.nx * r * 0.5 + f.tx * r * (0.35 * c + 0.3), fy - f.ny * r * 0.5 + f.ty * r * (0.35 * c + 0.3)); ctx.stroke();
    }
  }
  // 테두리 → 몸
  ctx.fillStyle = P.out;
  for (let i = n - 1; i >= 0; i--) deCircle(pts[i].x, pts[i].y, rad(i) + 1.5);
  ctx.fillStyle = P.body;
  for (let i = n - 1; i >= 0; i--) deCircle(pts[i].x, pts[i].y, rad(i));
  // 등 쪽 그림자 줄 + 배 비늘 띠
  ctx.fillStyle = P.dark;
  for (let i = n - 1; i >= 0; i--) { const r = rad(i); deCircle(pts[i].x + fr[i].nx * r * 0.5, pts[i].y + fr[i].ny * r * 0.5, r * 0.42); }
  ctx.fillStyle = P.belly;
  for (let i = n - 1; i >= 1; i--) { const r = rad(i); deCircle(pts[i].x - fr[i].nx * r * 0.52, pts[i].y - fr[i].ny * r * 0.52, r * 0.34); }
  // 배 비늘 마디 줄
  ctx.strokeStyle = P.dark; ctx.lineWidth = 1;
  for (let i = 2; i < n - 1; i += 2) {
    const r = rad(i), cx = pts[i].x - fr[i].nx * r * 0.52, cy = pts[i].y - fr[i].ny * r * 0.52;
    ctx.beginPath(); ctx.moveTo(cx + fr[i].nx * r * 0.34, cy + fr[i].ny * r * 0.34); ctx.lineTo(cx - fr[i].nx * r * 0.34, cy - fr[i].ny * r * 0.34); ctx.stroke();
  }
  // 등 비늘: 반짝이는 V 무늬
  ctx.fillStyle = P.scale;
  for (let i = 1; i < n - 2; i += 2) {
    const r = rad(i); if (r < 2.5) continue;
    const cx = pts[i].x + fr[i].nx * r * 0.2, cy = pts[i].y + fr[i].ny * r * 0.2, f = fr[i];
    dePoly([[cx + f.tx * r * 0.35, cy + f.ty * r * 0.35], [cx - f.tx * r * 0.2 + f.nx * r * 0.35, cy - f.ty * r * 0.2 + f.ny * r * 0.35],
      [cx - f.tx * r * 0.05, cy - f.ty * r * 0.05], [cx - f.tx * r * 0.2 - f.nx * r * 0.3, cy - f.ty * r * 0.2 - f.ny * r * 0.3]]);
  }
  // 꼬리 끝 불꽃 술
  {
    const p = pts[n - 1], f = fr[n - 1], L = R * 1.6;
    for (let j = -1; j <= 1; j++) {
      const w = Math.sin(clock * 16 + j) * R * 0.4;
      ctx.fillStyle = j ? P.mane2 : P.mane;
      dePoly([[p.x + f.nx * R * 0.3, p.y + f.ny * R * 0.3], [p.x - f.tx * L + f.nx * (j * R * 0.7 + w), p.y - f.ty * L + f.ny * (j * R * 0.7 + w)], [p.x - f.nx * R * 0.3, p.y - f.ny * R * 0.3]]);
    }
  }
  deHead(pts[0], Math.atan2(fr[0].ty, fr[0].tx), R, P, o.open || 0, side);
  ctx.restore();
}
// 용 머리: 앞이 +x 인 좌표에서 그린다 (등 쪽이 위로 오게 뒤집는다)
function deHead(h, ang, R, P, open, side) {
  const k = R / 6.5;
  ctx.save();
  ctx.translate(h.x, h.y); ctx.rotate(ang); ctx.scale(1, -side);
  const Q = (pts) => dePoly(pts.map(([x, y]) => [x * k, y * k]));
  // 갈기: 머리 뒤로 흩날리는 불꽃 혀
  for (let j = 0; j < 7; j++) {
    const by = -5 + j * 1.6, L = 11 + 4 * Math.sin(clock * 13 + j * 1.3), up = -2.5 + j * 0.9;
    ctx.fillStyle = j % 2 ? P.mane2 : P.mane;
    Q([[-2, by - 1.2], [-2 - L, by + up + Math.sin(clock * 17 + j) * 1.5], [-2, by + 1.2]]);
  }
  // 뿔 두 개 (뒤로 길게 휘었다)
  ctx.lineCap = 'round';
  for (const [x0, cx, cy, ex, ey, w] of [[0, -7, -11, -17, -11, 1], [2, -4, -14, -12, -16, 0.8]]) {
    ctx.strokeStyle = P.out; ctx.lineWidth = 3.4 * k * w;
    ctx.beginPath(); ctx.moveTo(x0 * k, -5 * k); ctx.quadraticCurveTo(cx * k, cy * k, ex * k, ey * k); ctx.stroke();
    ctx.strokeStyle = P.horn; ctx.lineWidth = 1.8 * k * w;
    ctx.beginPath(); ctx.moveTo(x0 * k, -5 * k); ctx.quadraticCurveTo(cx * k, cy * k, ex * k, ey * k); ctx.stroke();
  }
  // 아래턱 (벌어진다)
  ctx.save();
  ctx.translate(-1 * k, 2 * k); ctx.rotate(open * 0.6);
  ctx.fillStyle = P.out; Q([[-1, -2], [17.5, -0.5], [16.5, 2.8], [1, 5]]);
  ctx.fillStyle = P.body; Q([[0, -1.2], [16.5, 0], [15.5, 2], [1.5, 4]]);
  ctx.fillStyle = P.belly; Q([[2, 2.5], [14, 1.6], [13, 2.6], [2, 3.8]]);
  ctx.fillStyle = '#ffffff';
  for (let x = 5; x < 16; x += 2.6) Q([[x, -0.6], [x + 0.8, -2.6], [x + 1.6, -0.6]]);
  // 턱수염 가시
  ctx.fillStyle = P.mane2;
  for (let j = 0; j < 3; j++) Q([[2 + j * 3, 4], [-3 + j * 3, 8 + j], [5 + j * 3, 3.6]]);
  ctx.restore();
  // 벌린 입 안의 불빛
  if (open > 0.05) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= Math.min(1, open * 1.5);
    ctx.fillStyle = '#ff9fe8'; Q([[2, 1.5], [19, 0.5], [18, 2 + open * 10]]);
    ctx.fillStyle = '#ffffff'; Q([[6, 2], [18, 1], [17, 2 + open * 6]]);
    ctx.restore();
  }
  // 위 머리뼈
  ctx.fillStyle = P.out; Q([[-7, -5.6], [0, -7.2], [7.5, -5.6], [14, -3.6], [19.6, -2], [20.6, 0.6], [17.5, 2.2], [4, 2.8], [-5, 3.6], [-8, 0]]);
  ctx.fillStyle = P.body; Q([[-6, -4.8], [0, -6.3], [7, -4.8], [13.5, -2.9], [19, -1.4], [19.6, 0.4], [17, 1.4], [4, 2], [-4.5, 2.8], [-7, 0]]);
  ctx.fillStyle = P.scale; Q([[-3, -5.3], [6, -4.9], [13, -3], [6, -3.6]]);       // 이마에서 콧등까지 빛나는 능선
  ctx.fillStyle = P.dark; Q([[1, -4.6], [8, -4.4], [6, -3.2]]);                   // 눈두덩
  ctx.fillStyle = '#ffffff';
  for (let x = 6; x < 18; x += 2.6) Q([[x, 1.7], [x + 0.8, 3.8], [x + 1.6, 1.6]]);
  // 콧구멍
  ctx.fillStyle = P.out; Q([[17.5, -1.4], [18.6, -1.4], [18.6, -0.6], [17.5, -0.6]]);
  // 눈: 빛나는 세로 동공
  ctx.shadowColor = P.eye; ctx.shadowBlur = 10;
  ctx.fillStyle = P.eye; ctx.beginPath(); ctx.ellipse(4.2 * k, -2.6 * k, 2.3 * k, 1.15 * k, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = P.out; ctx.fillRect(4.0 * k, -3.5 * k, 0.6 * k, 1.8 * k);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(5 * k, -3.2 * k, 0.6 * k, 0.6 * k);
  // 수염: 코끝에서 뒤로 길게 흩날린다
  ctx.strokeStyle = P.mane; ctx.lineWidth = Math.max(1, 0.7 * k);
  for (const s of [1, -1]) {
    ctx.beginPath(); ctx.moveTo(17 * k, 0.5 * k);
    ctx.bezierCurveTo(10 * k, (6 + 3 * Math.sin(clock * 8 + s)) * k, 0, (2 + s * 4 + 3 * Math.sin(clock * 6 + s)) * k, (-14 + s * 2) * k, (7 + 5 * Math.sin(clock * 7 + s * 2)) * k);
    ctx.stroke();
  }
  ctx.restore();
}
// 입의 화면 위치 (머리 앞쪽)
function deMouth(pts, R) {
  const a = pts[0], b = pts[1] || a, l = Math.hypot(a.x - b.x, a.y - b.y) || 1, k = R / 6.5;
  return { x: a.x + (a.x - b.x) / l * 18 * k, y: a.y + (a.y - b.y) / l * 18 * k + 1.5 * k };
}

// 화염 숨결: (x0,y0)에서 (x1,y1)까지 넓어지는 불꽃 원뿔. 가장자리가 일렁이고 흰 심이 떨린다
function deBreath(x0, y0, x1, y1, w0, w1, alpha, fire = DE_FIRE) {
  if (alpha <= 0) return;
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, st = 14;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [sc, col, al] of [[1.25, fire[0], 0.45], [1, fire[1], 0.6], [0.6, fire[2], 0.7], [0.22, fire[3], 0.85]]) {
    ctx.globalAlpha = alpha * al; ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i <= st; i++) {
      const s = i / st, w = mix(w0, w1, s) * sc * (1 + 0.18 * Math.sin(clock * 40 + s * 11 + sc * 3));
      const x = x0 + dx * s + nx * w, y = y0 + dy * s + ny * w; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    for (let i = st; i >= 0; i--) {
      const s = i / st, w = mix(w0, w1, s) * sc * (1 + 0.18 * Math.sin(clock * 37 + s * 13 - sc * 2));
      ctx.lineTo(x0 + dx * s - nx * w, y0 + dy * s - ny * w);
    }
    ctx.closePath(); ctx.fill();
  }
  // 닿은 자리에서 퍼지는 불빛
  ctx.globalAlpha = alpha * 0.6;
  const g = ctx.createRadialGradient(x1, y1, 1, x1, y1, w1 * 1.8);
  g.addColorStop(0, fire[2]); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(x1 - w1 * 1.8, y1 - w1 * 1.8, w1 * 3.6, w1 * 3.6);
  ctx.restore();
}
// 숨결 원뿔을 따라 불티가 흩어진다
function deBreathParts(x0, y0, x1, y1, n, fire = DE_FIRE) {
  for (let i = 0; i < n; i++) {
    const s = Math.random(), x = mix(x0, x1, s), y = mix(y0, y1, s);
    parts.push({ x, y, vx: (x1 - x0) * rand(0.4, 1) + rand(-40, 40), vy: (y1 - y0) * rand(0.4, 1) + rand(-40, 20), g: -40, size: Math.random() < 0.35 ? 3 : 2, color: fire[1 + (i % 3)], life: rand(0.2, 0.4), t: 0, add: true });
  }
}
// 땅을 따라 넘실대는 불꽃 줄 (x0~x1, 높이 hgt)
function deFireRow(x0, x1, hgt, alpha, fire = DE_FIRE, seed = 0) {
  if (x1 < x0) [x0, x1] = [x1, x0];
  x0 = Math.max(-8, x0); x1 = Math.min(W + 8, x1);
  if (x1 - x0 < 2 || hgt < 1 || alpha <= 0) return;
  const gy = groundY() - 4;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha * 0.55;
  const g = ctx.createLinearGradient(0, gy - hgt * 1.6, 0, gy + 4);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, fire[1]);
  ctx.fillStyle = g; ctx.fillRect(x0, gy - hgt * 1.6, x1 - x0, hgt * 1.6 + 6);
  for (let x = Math.ceil(x0 / 6) * 6; x <= x1; x += 6) {
    const ph = x * 0.37 + seed, h = hgt * (0.55 + 0.3 * Math.sin(clock * 11 + ph) + 0.15 * Math.sin(clock * 23 + ph * 2.3));
    const sw = Math.sin(clock * 9 + ph) * 3;
    ctx.globalAlpha = alpha * 0.8; ctx.fillStyle = fire[1];
    dePoly([[x - 5, gy + 4], [x + sw, gy - h], [x + 5, gy + 4]]);
    ctx.fillStyle = fire[2];
    dePoly([[x - 2.5, gy + 4], [x + sw * 0.6, gy - h * 0.6], [x + 2.5, gy + 4]]);
    ctx.globalAlpha = alpha * 0.7; ctx.fillStyle = fire[3];
    dePoly([[x - 1, gy + 4], [x + sw * 0.3, gy - h * 0.25], [x + 1, gy + 4]]);
  }
  ctx.restore();
}
// 불덩이 폭발: 둥근 화염 고리가 퍼지고 가운데에서 불기둥이 솟는다 (size 1 = 보통)
function deBlast(a, x, size, fire = DE_FIRE, life = 0.8) {
  const gy = groundY() - 4, tongues = Array.from({ length: 16 }, (_, j) => ({ ang: (j / 16) * Math.PI * 2 + rand(-0.1, 0.1), l: rand(0.7, 1.2) }));
  aFx(a, 0, life, (u) => {
    const e = easeOut(Math.min(1, u / 0.35)), fade = u < 0.4 ? 1 : 1 - (u - 0.4) / 0.6, R = 44 * size * e, cy = gy - 22 * size;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 불기둥
    const ph = 160 * size * Math.min(1, u / 0.2), pw = 18 * size * (1 - u * 0.6);
    ctx.globalAlpha = fade * 0.7;
    const g = ctx.createLinearGradient(x - pw, 0, x + pw, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, fire[1]); g.addColorStop(0.5, fire[3]); g.addColorStop(0.7, fire[1]); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - pw, gy - ph, pw * 2, ph + 6);
    // 화염 고리: 혀가 사방으로 뻗는다
    for (const T of tongues) {
      const r0 = R * 0.4, r1 = R * T.l * (1 + 0.1 * Math.sin(clock * 30 + T.ang * 5));
      const ca = Math.cos(T.ang), sa = Math.sin(T.ang) * 0.55, nx = -sa, ny = ca;
      ctx.globalAlpha = fade * 0.75; ctx.fillStyle = fire[1];
      dePoly([[x + ca * r0 + nx * 6 * size, cy + sa * r0 + ny * 6 * size], [x + ca * r1, cy + sa * r1], [x + ca * r0 - nx * 6 * size, cy + sa * r0 - ny * 6 * size]]);
      ctx.fillStyle = fire[2]; ctx.globalAlpha = fade * 0.7;
      dePoly([[x + ca * r0 + nx * 3 * size, cy + sa * r0 + ny * 3 * size], [x + ca * r1 * 0.75, cy + sa * r1 * 0.75], [x + ca * r0 - nx * 3 * size, cy + sa * r0 - ny * 3 * size]]);
    }
    // 가운데 섬광
    ctx.globalAlpha = (1 - u) * 0.9;
    const c = ctx.createRadialGradient(x, cy, 1, x, cy, 30 * size);
    c.addColorStop(0, '#ffffff'); c.addColorStop(0.4, fire[2]); c.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = c; ctx.fillRect(x - 30 * size, cy - 30 * size, 60 * size, 60 * size);
    ctx.restore();
  });
  for (let j = 0; j < Math.round(26 * size); j++) {
    const ang = rand(-Math.PI, 0), v = rand(80, 260) * Math.sqrt(size);
    parts.push({ x: x + rand(-8, 8), y: gy - 10, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, g: 260, size: Math.random() < 0.4 ? 3 : 2, color: fire[1 + (j % 3)], life: rand(0.4, 0.8), t: 0, add: true });
  }
}
// 공용 타이밍
const deDur = (a) => (a.k ? a.k.dur : 2.8);
const deHitT = (a) => (a.k ? a.k.hits.map((h) => h[0] * a.k.dur) : [2.5]);
// 창끝 (하늘로 치켜든 창의 끝)
function deTip(a) { const g = gripOf(a); return { x: g.x + Math.cos(g.ang) * 34, y: g.y + Math.sin(g.ang) * 34 }; }
// 기사 앞쪽으로 s 만큼 떨어진 화면 x
const deFwd = (a, s) => a.x() + a.dir * s;
// 뒤쪽 화면 끝 · 앞쪽 화면 끝 (화면 밖 여유 m)
const deBackEdge = (a, m = 0) => (a.dir > 0 ? -m : W + m);
const deFrontEdge = (a, m = 0) => (a.dir > 0 ? W + m : -m);
// from~to 사이에서 1, 들어올 때 fin 초 · 나갈 때 fout 초 동안 부드럽게
const deEnv = (t, from, to, fin, fout) => Math.min(clamp01((t - from) / fin), clamp01((to - t) / fout));

// ── Lv1 흑룡 소환 ──
function deStage0(a) {
  const D = deDur(a), ht = deHitT(a), tf = ht[ht.length - 1], d = a.dir, life = D + 0.4;
  const tx0 = a.tx(), xa = deBackEdge(a, 160), xb = deFrontEdge(a, 420);
  const path = dePath([[0.6, xa, 30], [1.0, a.x() - d * 20, 48], [1.45, mix(a.x(), tx0, 0.5), 62], [tf - 0.1, tx0 - d * 12, 34], [tf + 0.5, xb, 20]]);
  const R = 9, L = 250, b0 = ht[0] - 0.12, b1 = ht[ht.length - 2] + 0.08;
  // 하늘이 보랏빛으로 가라앉고, 흑룡이 지나간다
  backFx(a, 0, life, (u) => {
    const t = u * life;
    dimBand(0.42 * deEnv(t, 0.2, D + 0.2, 0.5, 0.4), '14,0,22');
    if (t < 0.55) return;
    const pts = deBody(path, t, L, 34), br = (t > b0 && t < b1) || (t > tf - 0.2 && t < tf);
    deDragon(pts, { r: R, pal: DE_PAL.black, open: br ? 1 : 0.15, side: -d, alpha: Math.min(1, (t - 0.55) / 0.15) });
  });
  // 앞 레이어: 창끝 신호, 적에게 뿜는 불길, 불타는 땅
  aFx(a, 0, life, (u) => {
    const t = u * life;
    if (t > 0.45 && t < 0.8) {
      const tip = deTip(a), k = 1 - segU(t, 0.45, 0.8);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = k; ctx.fillStyle = '#ff4dd2'; ctx.fillRect(tip.x - 2, 0, 4, tip.y);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(tip.x - 0.5, 0, 1, tip.y);
      ctx.restore();
    }
    const tx = a.tx();
    if (t > b0 && t < b1) {
      const m = deMouth(deBody(path, t, L, 34), R);
      deBreath(m.x, m.y, tx, groundY() - 16, 3, 16, deEnv(t, b0, b1, 0.08, 0.1));
    }
    if (t > ht[0]) deFireRow(tx - 26, tx + 26, 12 * Math.min(1, (t - ht[0]) / 0.2), deEnv(t, ht[0], life, 0.1, 0.35), DE_FIRE, 1);
  }, null, (u) => {
    const t = u * life;
    if (t > b0 && t < b1) { const m = deMouth(deBody(path, t, L, 34), R); deBreathParts(m.x, m.y, a.tx(), groundY() - 16, 2); }
  });
  // 마무리: 머리 위에서 불덩이를 내리꽂는다
  const m0 = deMouth(deBody(path, tf - 0.16, L, 34), R);
  aFx(a, tf - 0.16, 0.16, (u) => {
    const m = m0, x = mix(m.x, a.tx(), easeIn(u)), y = mix(m.y, groundY() - 14, easeIn(u));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#ff4dd2'; ctx.lineWidth = 7; ctx.globalAlpha = 0.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(x, y); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = '#ff9fe8'; deCircle(x, y, 8); ctx.fillStyle = '#ffffff'; deCircle(x, y, 4);
    ctx.restore();
  });
}

// ── ★ 용황 강림 ──
// 하늘의 틈: 하단바 위쪽을 가로지르는 들쭉날쭉한 균열이 벌어지며 새하얀 빛이 새고, 빛살이 땅까지 쏟아진다
function deRift(a, life, openFrom, openTo, closeAt) {
  const pts = [];
  backFx(a, 0, life, (u) => {
    const t = u * life, w = W + 40;
    if (!pts.length || pts.w !== w) { pts.length = 0; pts.w = w; for (let x = -20; x <= w; x += 22) pts.push([x, rand(-5, 5), rand(0.6, 1.3)]); }
    const o = easeOut(segU(t, openFrom, openTo)) * (t > closeAt ? Math.max(0, 1 - (t - closeAt) / 0.35) : 1);
    if (o <= 0) return;
    const y = 30;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const x = ((i + 0.5) / 9) * W + Math.sin(clock * 0.8 + i) * 20, w0 = 10 + (i % 3) * 6;
      ctx.globalAlpha = 0.1 * o;
      ctx.fillStyle = '#ff9fe8';
      dePoly([[x - w0, y], [x + w0, y], [x + w0 * 2.6 + 20, groundY()], [x - w0 * 2.6 + 20, groundY()]]);
    }
    ctx.globalAlpha = 0.5 * o;
    const g = ctx.createLinearGradient(0, y - 24, 0, y + 30);
    g.addColorStop(0, 'rgba(255,77,210,0)'); g.addColorStop(0.45, 'rgba(255,77,210,0.8)'); g.addColorStop(1, 'rgba(255,77,210,0)');
    ctx.fillStyle = g; ctx.fillRect(-20, y - 24, W + 40, 54);
    ctx.globalCompositeOperation = 'source-over';
    for (const [col, sc] of [['#3a0f4a', 1.6], ['#ffd0f4', 1], ['#ffffff', 0.45]]) {
      ctx.globalAlpha = o; ctx.fillStyle = col;
      ctx.beginPath();
      pts.forEach(([x, dy, k], i) => { const yy = y + dy - 7 * o * k * sc; i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); });
      for (let i = pts.length - 1; i >= 0; i--) { const [x, dy, k] = pts[i]; ctx.lineTo(x, y + dy + 6 * o * (2 - k) * sc); }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }, null, (u) => {
    const t = u * life;
    if (t < openFrom || t > closeAt || Math.random() > 0.6) return;
    // 깨진 하늘 조각이 떨어진다
    parts.push({ x: rand(0, W), y: 32, vx: rand(-20, 20), vy: rand(20, 80), g: 240, size: Math.random() < 0.4 ? 4 : 3, color: Math.random() < 0.5 ? '#3a0f4a' : '#ff9fe8', life: rand(0.5, 0.9), t: 0 });
  });
}
function deStage1(a) {
  const D = deDur(a), ht = deHitT(a), tf = ht[ht.length - 1], d = a.dir, life = D + 0.4, gy = groundY();
  const tx0 = a.tx(), xBack = Math.max(40, Math.min(220, Math.abs(a.x() - deBackEdge(a)) - 30));
  const xFront = Math.abs(deFrontEdge(a) - a.x()) - 50;
  const f = (s) => deFwd(a, s);
  // 틈에서 쏟아져 내려와 → 낮게 앞으로 휩쓸고 → 앞쪽 끝에서 솟아 하늘을 되돌아오다 → 적에게 머리부터 내리꽂힌다
  const path = dePath([
    [0.75, f(-xBack), -140], [1.05, f(-xBack * 0.8), 40], [1.3, f(-xBack * 0.2), 104], [1.7, f(xFront * 0.55), 100],
    [1.98, f(xFront), 62], [2.16, f(xFront * 0.82), 24], [2.34, f(mix(xFront, (tx0 - a.x()) * d, 0.5)), 26],
    [tf, tx0, gy + 6], [tf + 0.3, tx0 + d * 40, gy + 260],
  ]);
  const R = 12, L = Math.max(300, Math.min(620, W * 0.5)), N = 46;
  let fireFrom = null, fireTo = null;
  backFx(a, 0, life, (u) => { dimBand(0.55 * deEnv(u * life, 0.15, D + 0.25, 0.5, 0.4), '14,0,22'); });
  deRift(a, life, 0.45, 0.95, tf + 0.1);
  backFx(a, 0, life, (u) => {
    const t = u * life;
    if (t < 0.7) return;
    deDragon(deBody(path, t, L, N), { r: R, pal: DE_PAL.emperor, open: t > 1.15 && t < tf ? 1 : 0.2, side: -d });
  });
  aFx(a, 0, life, (u) => {
    const t = u * life;
    if (fireFrom != null) deFireRow(fireFrom, fireTo, (t < tf ? 18 : 18 + 20 * deEnv(t, tf, life, 0.05, 0.4)), deEnv(t, 0, life, 0.01, 0.45), DE_FIRE, 3);
    if (t > 1.15 && t < 2.4) {
      const m = deMouth(deBody(path, t, L, N), R);
      deBreath(m.x, m.y, m.x + d * 30, gy - 8, 4, 22, deEnv(t, 1.15, 2.4, 0.1, 0.12));
    }
  }, null, (u) => {
    const t = u * life;
    if (t > 1.15 && t < 2.4) {
      const m = deMouth(deBody(path, t, L, N), R), ex = m.x + d * 30;
      if (fireFrom == null) { fireFrom = ex; fireTo = ex; }
      fireFrom = Math.min(fireFrom, ex); fireTo = Math.max(fireTo, ex);
      deBreathParts(m.x, m.y, ex, gy - 8, 3);
    }
  });
}

// ── ★★ 쌍룡 강림 ──
function deStage2(a) {
  const D = deDur(a), ht = deHitT(a), tf = ht[ht.length - 1], d = a.dir, life = D + 0.4, gy = groundY();
  const tx0 = a.tx(), xs = [deBackEdge(a, 140), deFrontEdge(a, 140)];
  // 용 둘: 양 끝에서 마주 날아와 적 위에서 교차 → 반대쪽 끝까지 → 솟아올라 X 자로 내리꽂힌다 (하나는 높게, 하나는 낮게 엇갈린다)
  const mk = (from, to, hi) => {
    const s = from < to ? 1 : -1;
    return dePath([
      [0.7, from, hi ? 30 : 96], [1.2, mix(from, tx0, 0.6), hi ? 50 : 80], [1.55, tx0, hi ? 92 : 36], [1.95, mix(tx0, to, 0.55), hi ? 104 : 30],
      [2.25, mix(tx0, to, 0.8), hi ? 40 : 64], [2.45, mix(tx0, to, 0.5), -10], [tf, tx0 - s * 4, gy + 6], [tf + 0.3, tx0 + s * 60, gy + 260],
    ]);
  };
  const paths = [mk(xs[0], xs[1], true), mk(xs[1], xs[0], false)];
  const pals = [DE_PAL.emperor, DE_PAL.violet], fires = [DE_FIRE, DE_FIRE_V];
  const R = 10, L = Math.max(260, Math.min(520, W * 0.42)), N = 42;
  const burnt = [null, null];
  backFx(a, 0, life, (u) => {
    const t = u * life;
    // 불바다가 번질수록 하늘이 붉게 달아오른다
    dimBand(0.5 * deEnv(t, 0.15, D + 0.25, 0.5, 0.4), '22,0,14');
    const heat = deEnv(t, 1.3, D + 0.3, 0.8, 0.4);
    if (heat > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 * heat;
      const g = ctx.createLinearGradient(0, 40, 0, gy);
      g.addColorStop(0, 'rgba(255,40,120,0)'); g.addColorStop(1, 'rgba(255,60,140,0.8)');
      ctx.fillStyle = g; ctx.fillRect(-20, 40, W + 40, gy - 40);
      ctx.restore();
    }
    if (t < 0.65) return;
    paths.forEach((p, j) => deDragon(deBody(p, t, L, N), { r: R, pal: pals[j], open: t > 1.0 && t < tf ? 1 : 0.2, side: (j ? 1 : -1) * d }));
  });
  aFx(a, 0, life, (u) => {
    const t = u * life;
    // 불바다: 숨결이 지나간 자리가 타오르고, 다 번지면 하단바 전체가 불길
    const sea = deEnv(t, 0, life, 0.01, 0.45), surge = t > tf ? 1 + 1.3 * Math.max(0, 1 - (t - tf) / 0.5) : 1;
    burnt.forEach((b, j) => { if (b) deFireRow(b[0], b[1], (16 + 10 * segU(t, 1.4, 2.4)) * surge, sea, fires[j], j * 7); });
    if (t > 2.0) deFireRow(0, W, 26 * surge, sea * segU(t, 2.0, 2.4), DE_FIRE, 13);
    if (t > 1.0 && t < 2.32) {
      const k = deEnv(t, 1.0, 2.32, 0.1, 0.12);
      paths.forEach((p, j) => { const m = deMouth(deBody(p, t, L, N), R); deBreath(m.x, m.y, m.x + (j ? -d : d) * 24, gy - 8, 3.5, 20, k, fires[j]); });
    }
    // 교차하는 순간 두 용의 기운이 부딪혀 번쩍인다
    if (t > 1.5 && t < 1.8) {
      const k = 1 - segU(t, 1.5, 1.8), y = 64;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k;
      const g = ctx.createRadialGradient(tx0, y, 2, tx0, y, 70);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#ff9fe8'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(tx0 - 70, y - 70, 140, 140);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, y - 1, W, 2 * k);
      ctx.restore();
    }
  }, null, (u) => {
    const t = u * life;
    if (t <= 1.0 || t >= 2.32) return;
    paths.forEach((p, j) => {
      const m = deMouth(deBody(p, t, L, N), R), ex = m.x + (j ? -d : d) * 24;
      burnt[j] = burnt[j] ? [Math.min(burnt[j][0], ex), Math.max(burnt[j][1], ex)] : [ex, ex];
      deBreathParts(m.x, m.y, ex, gy - 8, 2, fires[j]);
    });
    if (Math.random() < 0.8) parts.push({ x: rand(0, W), y: gy - rand(4, 20), vx: rand(-20, 20), vy: rand(-90, -40), g: -20, size: 2, color: Math.random() < 0.5 ? '#ff9fe8' : '#ffd27a', life: rand(0.5, 0.9), t: 0, add: true });
  });
}

// ── ★★★ 용신의 심판 ──
// 용신의 눈: 하단바보다 큰 아몬드 모양 눈. 비늘 가죽에 둘러싸여 있고, 금빛 홍채에 세로 동공이 적을 좇는다
function deGodEye(ex, ey, ew, eh, open, look, slit, glow) {
  ctx.save();
  // 눈을 둘러싼 비늘 가죽
  ctx.globalAlpha = Math.min(1, open * 3);
  ctx.save();
  ctx.translate(ex, ey); ctx.scale(1, (eh * 1.3) / (ew * 1.4));
  const sk = ctx.createRadialGradient(0, 0, ew * 0.5, 0, 0, ew * 1.4);
  sk.addColorStop(0, 'rgba(18,5,26,1)'); sk.addColorStop(0.7, 'rgba(18,5,26,0.92)'); sk.addColorStop(1, 'rgba(18,5,26,0)');
  ctx.fillStyle = sk; ctx.beginPath(); ctx.arc(0, 0, ew * 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,77,210,0.22)'; ctx.lineWidth = 1.5;
  for (let r = 0; r < 5; r++) {
    const span = ew * (1.05 + 0.04 * r);
    for (let x = ex - span; x < ex + span; x += 14) {
      const xx = x + (r % 2) * 7;
      ctx.beginPath(); ctx.arc(xx, ey - eh * 1.15 + r * 9, 7, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(xx, ey + eh * 1.15 - r * 9, 7, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
    }
  }
  // 눈꼬리 양쪽 뿔 같은 가시
  ctx.fillStyle = '#2a0c36';
  for (const s of [-1, 1]) {
    dePoly([[ex + s * ew * 0.9, ey - eh * 0.5], [ex + s * ew * 1.55, ey - eh * 1.1], [ex + s * ew * 1.1, ey - eh * 0.15]]);
    dePoly([[ex + s * ew * 0.95, ey + eh * 0.3], [ex + s * ew * 1.45, ey + eh * 0.75], [ex + s * ew * 1.05, ey + eh * 0.05]]);
  }
  // 아몬드 눈매 (open 만큼 벌어진다)
  const top = eh * 1.9 * open, bot = eh * 1.7 * open;
  const almond = () => {
    ctx.beginPath(); ctx.moveTo(ex - ew, ey);
    ctx.quadraticCurveTo(ex, ey - top, ex + ew, ey);
    ctx.quadraticCurveTo(ex, ey + bot, ex - ew, ey); ctx.closePath();
  };
  ctx.globalAlpha = 1;
  ctx.shadowColor = '#ff4dd2'; ctx.shadowBlur = 24 * glow;
  almond(); ctx.fillStyle = '#ff7a3a'; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.save();
  almond(); ctx.clip();
  const g = ctx.createLinearGradient(0, ey - eh, 0, ey + eh);
  g.addColorStop(0, '#c4206a'); g.addColorStop(0.5, '#ffb03a'); g.addColorStop(1, '#c4206a');
  ctx.fillStyle = g; ctx.fillRect(ex - ew, ey - eh, ew * 2, eh * 2);
  // 홍채
  const ix = ex + look, ir = eh * 0.95;
  const ig = ctx.createRadialGradient(ix, ey, 2, ix, ey, ir);
  ig.addColorStop(0, mixHex('#fff6c0', '#ffffff', glow)); ig.addColorStop(0.45, mixHex('#ffcc33', '#ffffff', glow * 0.6)); ig.addColorStop(0.85, '#ff4dd2'); ig.addColorStop(1, '#3a0a3a');
  ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(ix, ey, ir, 0, Math.PI * 2); ctx.fill();
  // 홍채 결 (가는 빛살)
  ctx.strokeStyle = 'rgba(90,10,40,0.45)'; ctx.lineWidth = 1;
  for (let j = 0; j < 28; j++) {
    const A = (j / 28) * Math.PI * 2 + 0.05;
    ctx.beginPath(); ctx.moveTo(ix + Math.cos(A) * ir * 0.3, ey + Math.sin(A) * ir * 0.3); ctx.lineTo(ix + Math.cos(A) * ir * 0.92, ey + Math.sin(A) * ir * 0.92); ctx.stroke();
  }
  // 세로 동공 (slit 이 작을수록 가늘다)
  const pw = ir * (0.08 + 0.22 * slit);
  ctx.shadowColor = '#ff4dd2'; ctx.shadowBlur = 10;
  ctx.fillStyle = '#0a0208';
  ctx.beginPath(); ctx.ellipse(ix, ey, pw, ir * 0.9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  // 젖은 눈빛 하이라이트
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.ellipse(ix - ir * 0.45, ey - ir * 0.45, ir * 0.14, ir * 0.08, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // 눈꺼풀 테두리
  almond(); ctx.strokeStyle = '#05010a'; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = '#ff4dd2'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}
// 녹아내리는 땅: 분홍빛 용암이 하단바 바닥을 덮고 끓어오른다 (x0~x1 까지 번졌다)
function deMolten(x0, x1, lvl, alpha, seed) {
  if (x1 < x0) [x0, x1] = [x1, x0];
  x0 = Math.max(-4, x0); x1 = Math.min(W + 4, x1);
  if (x1 - x0 < 2 || alpha <= 0) return;
  const base = groundY() - 6, top = (x) => base - lvl * (0.75 + 0.25 * Math.sin(x * 0.05 + clock * 3 + seed)) - 2 * Math.sin(x * 0.17 - clock * 5);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.moveTo(x0, groundY() + 10);
  for (let x = x0; x <= x1; x += 6) ctx.lineTo(x, top(x));
  ctx.lineTo(x1, top(x1)); ctx.lineTo(x1, groundY() + 10); ctx.closePath();
  const g = ctx.createLinearGradient(0, base - lvl - 4, 0, groundY() + 10);
  g.addColorStop(0, '#fff0c0'); g.addColorStop(0.2, '#ff9fe8'); g.addColorStop(0.55, '#ff2a8a'); g.addColorStop(1, '#5a0a3a');
  ctx.fillStyle = g; ctx.fill();
  // 식어 가는 검은 껍질 조각이 떠다닌다
  ctx.fillStyle = 'rgba(40,6,30,0.75)';
  for (let x = x0 + 10; x < x1; x += 37) {
    const xx = x + ((clock * 12 + x) % 18) - 9;
    ctx.fillRect(Math.round(xx), Math.round(top(xx) + 4), 8, 2);
  }
  // 끓는 거품
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = '#fff0c0'; ctx.lineWidth = 1;
  for (let x = x0 + 5; x < x1; x += 23) {
    const ph = (clock * 1.7 + x * 0.13 + seed) % 1, r = 1 + 3 * ph;
    ctx.globalAlpha = alpha * (1 - ph);
    ctx.beginPath(); ctx.arc(x, top(x) + 1 - ph * 3, r, Math.PI, 0); ctx.stroke();
  }
  // 위로 일렁이는 열기
  ctx.globalAlpha = alpha * 0.35;
  const hg = ctx.createLinearGradient(0, base - lvl - 40, 0, base - lvl);
  hg.addColorStop(0, 'rgba(255,77,210,0)'); hg.addColorStop(1, 'rgba(255,77,210,0.9)');
  ctx.fillStyle = hg; ctx.fillRect(x0, base - lvl - 40, x1 - x0, 40);
  ctx.restore();
}
// 용신의 눈에서 떨어지는 불똥 하나: 꼬리를 끌며 떨어져 닿은 자리에서 불꽃이 터진다
function deEmber(a, delay, from, to, life, size) {
  let p0 = null, p1 = null;
  aFx(a, Math.max(0, delay), life, (u) => {
    if (!p0) { p0 = from(); p1 = to(); }
    const e = easeIn(u), x = mix(p0.x, p1.x, e), y = mix(p0.y, p1.y, e), tx = mix(p0.x, p1.x, Math.max(0, e - 0.25)), ty = mix(p0.y, p1.y, Math.max(0, e - 0.25));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.strokeStyle = '#ff4dd2'; ctx.globalAlpha = 0.6; ctx.lineWidth = 6 * size;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 1; ctx.lineWidth = 2 * size;
    ctx.beginPath(); ctx.moveTo(mix(tx, x, 0.5), mix(ty, y, 0.5)); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#ff9fe8'; deCircle(x, y, 5 * size); ctx.fillStyle = '#ffffff'; deCircle(x, y, 2.5 * size);
    ctx.restore();
  }, () => {
    if (!p1) return;
    const fx = p1.x;
    aFx(a, 0, 0.7, (u) => deFireRow(fx - 12 * size, fx + 12 * size, 14 * size * (1 - u * 0.5), 1 - u, DE_FIRE, fx));
    for (let j = 0; j < Math.round(10 * size); j++) parts.push({ x: p1.x, y: p1.y, vx: rand(-90, 90), vy: rand(-140, -30), g: 300, size: 2, color: j % 2 ? '#ff4dd2' : '#ffffff', life: rand(0.3, 0.5), t: 0, add: true });
  });
}
function deStage3(a) {
  const D = deDur(a), ht = deHitT(a), tf = ht[ht.length - 1], tb = ht[ht.length - 2], life = D + 0.45, gy = groundY();
  const tx0 = a.tx(), ex = mix(W / 2, tx0, 0.35), ey = 40, ew = Math.max(150, Math.min(440, W * 0.36)), eh = 66;
  const lookOf = () => Math.max(-ew * 0.35, Math.min(ew * 0.35, (a.tx() - ex) * 0.4));
  const iris = () => ({ x: ex + lookOf(), y: ey + eh * 0.25 });
  // 뒤 레이어: 깊은 어둠 + 용신의 눈
  backFx(a, 0, life, (u) => {
    const t = u * life;
    dimBand(0.72 * deEnv(t, 0.1, D + 0.3, 0.6, 0.4), '8,0,14');
    const open = easeOut(segU(t, 0.55, 1.05)) * (t > D - 0.05 ? Math.max(0, 1 - (t - D + 0.05) / 0.3) : 1);
    if (open <= 0) return;
    // 동공은 처음엔 둥글다가 빛을 빨아들일수록 실처럼 가늘어지고, 숨결을 뿜을 때 홍채가 하얗게 달아오른다
    const slit = 1 - segU(t, 2.1, tb), glow = Math.max(segU(t, 2.1, tb) * 0.6, t > tb ? deEnv(t, tb, D, 0.05, 0.3) : 0);
    deGodEye(ex, ey + 6 * (1 - open), ew, eh, open, lookOf(), slit, glow);
  });
  // 녹아내리는 땅 (숨결이 닿은 자리에서 양쪽 끝까지 번진다)
  aFx(a, 0, life, (u) => {
    const t = u * life;
    if (t <= tb) return;
    const s = easeOut(segU(t, tb, tf + 0.1)), x = a.tx(), reach = Math.max(x, W - x) + 20;
    deMolten(x - reach * s, x + reach * s, 6 + 8 * s + (t > tf ? 6 * Math.max(0, 1 - (t - tf) / 0.4) : 0), deEnv(t, tb, life, 0.05, 0.3), 2);
  });
  // 앞 레이어: 빨아들이는 빛, 하늘에서 내리꽂히는 숨결, 마무리 섬광
  aFx(a, 0, life, (u) => {
    const t = u * life, I = iris(), x = a.tx();
    if (t > tb - 0.08 && t < D + 0.15) {
      const big = t > tf - 0.05 ? 1 : 0, k = deEnv(t, tb - 0.08, D + 0.15, 0.08, 0.25);
      const w1 = mix(34, Math.max(160, W * 0.6), easeOut(segU(t, tf - 0.05, tf + 0.08)) * big), w0 = mix(14, eh * 0.9, big);
      deBreath(I.x, I.y, x, gy - 4, w0, w1, k);
    }
    // 하단바 전체가 하얗게 탄다
    if (t > tf - 0.02 && t < tf + 0.35) dimBand(0.75 * (1 - segU(t, tf, tf + 0.35)), '255,220,245');
  }, null, (u) => {
    const t = u * life, I = iris();
    if (t > 2.05 && t < tb) {
      // 하단바 곳곳의 빛이 눈동자로 빨려 들어간다
      for (let j = 0; j < 4; j++) {
        const x = rand(0, W), y = gy - rand(0, 30), T = rand(0.3, 0.45);
        parts.push({ x, y, vx: (I.x - x) / T, vy: (I.y - y) / T, g: 0, size: 2, color: j % 2 ? '#ff9fe8' : '#ffffff', life: T, t: 0, add: true });
      }
    } else if (t > tb && t < D) deBreathParts(I.x, I.y, a.tx(), gy - 6, 4);
  });
  // 눈길이 닿는 곳마다 떨어지는 불똥: 타격마다 하나는 적에게, 둘은 하단바 여기저기에
  for (let i = 0; i < ht.length - 2; i++) {
    const at = ht[i] - 0.16;
    deEmber(a, at, iris, () => { const t = a.targets(i)[0]; return { x: t.x, y: t.y }; }, 0.16, 1);
    for (let j = 0; j < 2; j++) { const x = rand(20, W - 20); deEmber(a, at + rand(-0.05, 0.08), iris, () => ({ x, y: gy - 6 }), 0.2, 0.7); }
  }
}
// 타격 이미지: 분홍 불꽃 비늘이 둥글게 튀어 나가며 사그라든다 (마지막 일격은 크게 여섯 장)
function deScaleMark(x, y, color, big) {
  const n = big ? 6 : 3, s = big ? 1.6 : 1, rot = rand(0, Math.PI);
  skFx(null, 0, 0.42, (u) => {
    const e = easeOut(Math.min(1, u / 0.5)), fade = u < 0.4 ? 1 : 1 - (u - 0.4) / 0.6;
    for (let j = 0; j < n; j++) {
      const A = rot + (j / n) * Math.PI * 2, r = 6 + 16 * s * e;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(x + Math.cos(A) * r, y + Math.sin(A) * r * 0.8); ctx.rotate(A);
      ctx.fillStyle = OUTLINE; dePoly([[-5 * s, -4 * s], [5 * s, 0], [-5 * s, 4 * s], [-3 * s, 0]]);
      ctx.fillStyle = color; dePoly([[-4 * s, -3 * s], [4 * s, 0], [-4 * s, 3 * s], [-2.5 * s, 0]]);
      ctx.fillStyle = '#ffffff'; dePoly([[-1 * s, -1 * s], [3 * s, 0], [-1 * s, 1 * s]]);
      ctx.restore();
    }
  });
}

Object.assign(SKILL_FX, {
  dragonEmperor: {
    // 몸을 낮췄다가 → 창을 하늘로 곧게 치켜들고 버틴다(★★★ 는 떠오른다) → 마지막 일격에 맞춰 앞으로 내지르고 → 거둔다
    pose(u, a) {
      const D = deDur(a), t = u * D, ht = deHitT(a), tf = ht[ht.length - 1], up = (a.mast || 0) >= 3 ? 14 : 5;
      if (t < 0.25) { const c = easeOut(t / 0.25); return { sy: 1 - 0.12 * c, sx: 1 + 0.06 * c, wa: mix(-1.3, -0.5, c), skew: 0.1 * c }; }
      if (t < 0.5) { const r = easeOut(segU(t, 0.25, 0.5)); return { wa: mix(-0.5, -1.62, r), lift: up * r, sy: mix(0.88, 1.08, r), skew: mix(0.1, -0.1, r) }; }
      if (t < tf - 0.14) return { wa: -1.62 + Math.sin(clock * 34) * 0.03, lift: up + Math.sin(t * 5) * 2, sy: 1.08, skew: -0.1 };
      if (t < tf) { const s = easeIn(segU(t, tf - 0.14, tf)); return { wa: mix(-1.62, 0, s), ext: 18 * s, dx: 12 * s, lift: up * (1 - s), skew: mix(-0.1, 0.35, s), sy: mix(1.08, 0.95, s) }; }
      const r = easeOut(segU(t, tf + 0.08, D));
      return { wa: mix(0, -1.3, r), ext: 18 * (1 - r), dx: 12 * (1 - r), skew: 0.35 * (1 - r) };
    },
    cues: () => [[0, (a) => [deStage0, deStage1, deStage2, deStage3][Math.min(3, a.mast || 0)](a)]],
    // 치켜든 창끝에 분홍 기운이 모인다
    tick(a, u) {
      const t = u * deDur(a), ht = deHitT(a);
      if (t < 0.4 || t > ht[ht.length - 1] - 0.1 || Math.random() > 0.7) return;
      const tip = deTip(a);
      parts.push({ x: tip.x + rand(-3, 3), y: tip.y + rand(-3, 3), vx: rand(-15, 15), vy: rand(-70, -20), g: -20, size: Math.random() < 0.3 ? 3 : 2, color: Math.random() < 0.6 ? '#ff4dd2' : '#ffffff', life: rand(0.3, 0.5), t: 0, add: true });
    },
    hit(a, i, n) {
      const m = Math.min(3, a.mast || 0), last = i === n - 1, x = a.tx();
      if (!last) {
        for (const t of a.targets(i)) for (let j = 0; j < 6; j++) parts.push({ x: t.x + rand(-6, 6), y: t.y + rand(-6, 6), vx: rand(-60, 60), vy: rand(-120, -40), g: -30, size: 2, color: DE_FIRE[1 + (j % 3)], life: rand(0.3, 0.5), t: 0, add: true });
        if (m === 3 && i === n - 2) { deBlast(a, x, 1.3); impact({ stop: 0.1, shake: 0.5 }); }     // ★★★ 숨결이 처음 땅에 닿는 순간
        else impact({ stop: 0.02, shake: 0.14 });
        return;
      }
      if (m === 0) { deBlast(a, x, 1); impact({ stop: 0.16, shake: 0.6 }); return; }
      // ★·★★: 내리꽂히는 순간 하단바 전체가 분홍빛으로 번쩍인다
      if (m < 3) aFx(a, 0, 0.3, (u) => dimBand(0.45 * (1 - u), '255,170,230'));
      if (m === 1) {
        deBlast(a, x, 1.7, DE_FIRE, 1);
        for (let j = 0; j < 30; j++) parts.push({ x: x + rand(-60, 60), y: groundY() - 4, vx: rand(-60, 60), vy: rand(-300, -120), g: 380, size: 3, color: j % 3 ? '#5a2a3a' : '#ff9fe8', life: rand(0.5, 0.9), t: 0 });
        impact({ stop: 0.2, shake: 0.7 });
        return;
      }
      if (m === 2) { deBlast(a, x - 14, 1.6, DE_FIRE, 1); deBlast(a, x + 14, 1.6, DE_FIRE_V, 1); impact({ stop: 0.22, shake: 0.75 }); return; }
      deBlast(a, x, 2.2, DE_FIRE, 1.1);
      for (const s of [-1, 1]) for (let j = 1; j <= 3; j++) skLater(a, j * 0.05, () => deBlast(a, x + s * j * W * 0.12, 1.1, DE_FIRE, 0.7));
      impact({ stop: 0.26, shake: 0.85 });
    },
    marks(a, t, pow, i, n) { deScaleMark(t.x, t.y, '#ff4dd2', i === n - 1); },
    kb: 20,
  },
});
