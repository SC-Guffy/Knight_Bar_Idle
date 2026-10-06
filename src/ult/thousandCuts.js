'use strict';
// 3차 궁극기 「천검」 연출 (swordsaint). 수치·단계는 src/classes.js 의 SKILLS.thousandCuts, 공통 레터박스·컷인은 src/skills.js 의 drawUltScreen.
//  모든 단계 공통: 칼자루에 손을 얹고 웅크렸다가 → 모습이 사라지고(보이지 않는 속도로 베는 중) → 제자리에 나타나 칼을 거두는 "딸깍" 순간 모든 검선이 한꺼번에 갈라진다
//  Lv1 「천검」 하단바가 어둑해지고 하단바를 가로지르는 긴 검선 네 줄이 허공에 멈춰 있다가, 칼을 거두면 벌어지며 터진다
//  ★ 「천검·만화」 하단바가 흑백으로 멎고, 사방에서 수십 갈래 검선이 그어지며 분홍 잔상이 번쩍인다 — 칼을 거두는 순간 색이 돌아오며 한 번에 터진다
//  ★★ 「천검·벚꽃폭풍」 저녁빛 하늘에 벚꽃잎이 폭풍처럼 몰아치다 하나하나 칼날로 변해 적에게 꽂히고, 적 둘레로 소용돌이쳤다가 하단바 전체로 흩어지며 벤다
//  ★★★ 「무명검·천지개벽」 흑백 세상에 꽃잎 칼날과 검선이 가득 차고, 하단바를 가로로 벤 한 칼에 위아래가 두 동강 나 어긋났다가 — 칼을 거두는 순간 다시 붙으며 그 틈으로 빛이 터진다
// 이 파일의 도구는 모두 tc 로 시작한다 (다른 궁극기 파일과 이름이 겹치지 않게)

const TC_PINK = '#ff6a8a', TC_PETALS = ['#ffb7c8', '#ff8fab', '#ffd6e0', '#ff6a8a'];
const tcHitT = (a, i) => a.k.hits[i][0] * a.k.dur;
const tcLastT = (a) => tcHitT(a, a.k.hits.length - 1);
const tcSplitT = (a) => tcHitT(a, a.k.hits.length - 2);          // ★★★ 하단바를 두 동강 내는 한 칼 (마지막 바로 앞 타격)
function tcAim(a, i) {
  const list = a.targets(i);
  return list[i % list.length] || { x: a.tx(), y: a.ty() };
}

// ── 기사 자세: 웅크려 칼자루에 손 → 발도와 함께 사라짐 → (tf-0.42) 제자리에 나타나 → 천천히 칼을 거두고 tf 에 딸깍 ──
function tcPoseCore(t, tf, D) {
  if (t < 0.3) { const s = easeOut(t / 0.3); return { sy: 1 - 0.14 * s, skew: 0.16 * s, wa: mix(-1.0, 2.5, s), wa2: mix(-0.5, 2.7, s) }; }
  if (t < 0.38) { const d = easeOut(segU(t, 0.3, 0.38)); return { wa: mix(2.5, 0.15, d), wa2: mix(2.7, 0.35, d), skew: 0.4, dx: 12 * d, sy: 0.9, alpha: 1 - d }; }
  if (t < tf - 0.42) return { wa: 0.15, wa2: 0.35, skew: 0.3, sy: 0.92, alpha: 0 };
  if (t < tf) {
    const k = segU(t, tf - 0.42, tf - 0.3), e = easeIn(segU(t, tf - 0.26, tf));
    return { wa: mix(0.15, 2.3, e), wa2: mix(0.35, 2.6, e), skew: mix(0.3, 0.05, e), sy: mix(0.92, 1, e), alpha: k };
  }
  const r = easeOut(segU(t, tf + 0.12, D));
  return { wa: mix(2.3, -1.0, r), wa2: mix(2.6, -0.6, r), skew: 0.05 * (1 - r) };
}

// 하단바 전체를 덮는 어둠 (뒤 레이어). from 부터 to 까지, 들어올 때만 부드럽게 — 칼을 거두는 순간 툭 걷힌다
function tcDimFx(a, from, to, al, rgb) {
  backFx(a, from, to - from, (u) => dimBand(al * Math.min(1, (u * (to - from)) / 0.15), rgb));
}
// 흑백: 이미 그려진 하단바(기사·몬스터·땅)의 채도를 빼서 시간이 멎은 듯 보이게 한다. 이보다 나중에 그리는 검선·꽃잎만 색이 남는다
function tcGrayFx(a, from, to, al = 1) {
  aFx(a, from, to - from, (u) => {
    const k = al * Math.min(1, (u * (to - from)) / 0.12);
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = k;
    ctx.fillStyle = '#1c1c1c';               // 채도 0 인 어두운 회색 — 비어 있던(투명한) 곳은 어둡게 덮인다
    ctx.fillRect(-60, -240, W + 120, H + 480);
    ctx.restore();
  });
}
// 하단바 전체가 잠깐 번쩍인다
function tcFlash(a, rgb, al, life) {
  aFx(a, 0, life, (u) => dimBand(al * (1 - u) * (1 - u), rgb));
}

// ── 검선: 허공에 그어진 채 멈춰 있다가, 칼을 거두는 순간(a.tcRel) 양쪽으로 벌어지며 터진다. 목록 하나를 연출 하나가 그린다 ──
function tcLinesFx(a, life) {
  const L = (a.tcLines = []);
  aFx(a, 0, life, () => {
    const rel = a.tcRel != null ? clock - a.tcRel : -1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of L) {
      const age = clock - l.at;
      if (age < 0) continue;
      const ca = Math.cos(l.ang), sa = Math.sin(l.ang), grow = easeOut(Math.min(1, age / 0.06));
      const x0 = l.x - ca * l.len / 2, y0 = l.y - sa * l.len / 2, x1 = x0 + ca * l.len * grow, y1 = y0 + sa * l.len * grow;
      if (rel < 0) {
        // 멈춘 검선: 그어지는 순간은 굵고 하얗게, 그 뒤엔 머리카락처럼 가늘게 떨린다
        const fl = 0.7 + 0.3 * Math.sin(clock * 34 + l.ph);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
        if (age < 0.1) { ctx.globalAlpha = 1 - age / 0.1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.stroke(); }
        ctx.globalAlpha = 0.45 * fl; ctx.strokeStyle = l.c; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.globalAlpha = 0.95; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8; ctx.stroke();
        continue;
      }
      const r = rel / 0.55;
      if (r >= 1) continue;
      // 터짐: 검선이 법선 쪽으로 벌어져 틈이 생기고, 틈 안이 분홍빛으로 탄다
      const f = 1 - r, gap = 1 + l.gap * easeOut(Math.min(1, r / 0.35)), nx = -sa * gap / 2, ny = ca * gap / 2;
      ctx.globalAlpha = 0.55 * f; ctx.fillStyle = l.c;
      ctx.beginPath(); ctx.moveTo(x0 + nx, y0 + ny); ctx.lineTo(x1 + nx, y1 + ny); ctx.lineTo(x1 - nx, y1 - ny); ctx.lineTo(x0 - nx, y0 - ny); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = f; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0 + nx, y0 + ny); ctx.lineTo(x1 + nx, y1 + ny); ctx.moveTo(x0 - nx, y0 - ny); ctx.lineTo(x1 - nx, y1 - ny); ctx.stroke();
      if (r < 0.18) { ctx.globalAlpha = 1 - r / 0.18; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
    }
    ctx.restore();
  });
}
function tcAddLine(a, x, y, ang, len, delay = 0, gap = 8, c = TC_PINK) {
  if (a.tcLines) a.tcLines.push({ x, y, ang, len, at: clock + delay, ph: rand(0, 6), gap, c });
}
// 칼을 거둔 순간 검선마다 꽃잎 같은 불티가 흩어진다
function tcLineSparks(a) {
  for (const l of a.tcLines || []) {
    for (let j = 0; j < 3; j++) {
      const f = rand(-0.4, 0.4), x = l.x + Math.cos(l.ang) * l.len * f, y = l.y + Math.sin(l.ang) * l.len * f;
      if (x < -10 || x > W + 10 || y < 0 || y > groundY()) continue;
      parts.push({ x, y, vx: rand(-80, 80), vy: rand(-120, 20), g: 160, size: j ? 2 : 3, color: TC_PETALS[(j + 1) % 4], life: rand(0.4, 0.7), t: 0, add: true });
    }
  }
}

// 보이지 않는 속도의 흔적: 대상 곁에 분홍 잔상이 베는 자세로 아주 잠깐 번쩍인다
function tcFlickerFx(a, x, facing) {
  const pose = { mode: 'fight', swing: -1, t: clock, wa: rand(-2.3, 1.2), wa2: rand(-2, 1.2), skew: 0.4, sy: 0.9, facing };
  skFx(null, 0, 0.16, (u) => {
    drawHero(ctx, a.cls, x, groundY(), { ...pose, tint: u < 0.3 ? '#ffffff' : TC_PINK, alpha: 0.7 * (1 - u) });
  });
}
// 발도와 함께 사라지는 순간: 칼빛 한 줄 + 꽃잎이 흩어진다
function tcVanishFx(a) {
  const x = a.x(), y = groundY() - 22, d = a.dir;
  skFx(null, 0, 0.3, (u) => {
    const grow = easeOut(Math.min(1, u / 0.15)), f = 1 - u;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = f; ctx.fillStyle = TC_PINK; ctx.fillRect(Math.min(x, x + d * 90 * grow), y - 2, 90 * grow, 4);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.min(x, x + d * 90 * grow), y - 0.5, 90 * grow, 1);
    ctx.restore();
  });
  for (let i = 0; i < 16; i++) parts.push({ x: x + rand(-6, 6), y: groundY() - rand(4, 36), vx: d * rand(20, 160), vy: rand(-60, 10), g: 40, size: Math.random() < 0.3 ? 3 : 2, color: TC_PETALS[i % 4], life: rand(0.4, 0.8), t: 0 });
}
// 딸깍: 칼을 거두는 손에서 하얀 불꽃과 작은 고리
function tcClickFx(a) {
  const h = hand(a);
  skFx(null, 0, 0.3, (u) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1 - u; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(h.x, h.y, 3 + 14 * easeOut(u), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(h.x - 10 * (1 - u), h.y - 0.5, 20 * (1 - u), 1); ctx.fillRect(h.x - 0.5, h.y - 10 * (1 - u), 1, 20 * (1 - u));
    ctx.restore();
  });
  for (let i = 0; i < 8; i++) parts.push({ x: h.x, y: h.y, vx: rand(-70, 70), vy: rand(-90, -20), g: 300, size: 1, color: '#fff3c0', life: 0.25, t: 0, add: true });
}
// 가는 X 자 칼자국 (타격 자국)
function tcNick(x, y, size, life = 0.3) {
  const a0 = rand(-0.5, 0.5);
  skFx(null, 0, life, (u) => {
    const L = size * Math.min(1, u / 0.15), f = 1 - u;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const an of [a0 + 0.8, a0 - 0.8]) {
      const ca = Math.cos(an) * L, sa = Math.sin(an) * L;
      ctx.globalAlpha = 0.6 * f; ctx.strokeStyle = TC_PINK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - ca, y - sa); ctx.lineTo(x + ca, y + sa); ctx.stroke();
      ctx.globalAlpha = f; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
  });
}

// ── 벚꽃 폭풍: 하단바 폭 전체에 꽃잎이 바람을 타고 흐르다가 blade 시각부터 칼날로 변하고, vortexAt 부터 대상 둘레로 소용돌이치며 모였다가, a.tcRel 에 사방으로 흩어진다 ──
function tcPetalStormFx(a, from, life, bladeAt, vortexAt, n) {
  const gy0 = groundY(), ps = [];
  for (let i = 0; i < n; i++) ps.push({ x: rand(-20, W + 20), y: rand(18, gy0 - 4), by: 0, sp: rand(140, 320), ph: rand(0, 6), wob: rand(4, 14), s: Math.random() < 0.3 ? 3 : 2, c: TC_PETALS[i % 4], vx: 0, vy: 0, px: 0, py: 0 });
  for (const p of ps) { p.by = p.y; p.px = p.x; p.py = p.y; }
  let t = 0, burst = false;
  aFx(a, from, life, () => {
    const k = Math.min(1, t / 0.3), b = clamp01((t + from - bladeAt) / 0.3), rel = a.tcRel != null ? clock - a.tcRel : -1;
    const f = rel < 0 ? k : Math.max(0, 1 - rel / 0.55);
    if (f <= 0) return;
    ctx.save();
    for (const p of ps) {
      const dx = p.x - p.px, dy = p.y - p.py, m = Math.hypot(dx, dy) || 1;
      if (b < 0.3) {
        // 꽃잎: 팔랑이며 뒤집힌다 (폭이 줄었다 늘었다)
        const w = Math.max(1, Math.round(p.s * Math.abs(Math.sin(p.ph + clock * 9))));
        ctx.globalAlpha = f * 0.9; ctx.fillStyle = p.c;
        ctx.fillRect(Math.round(p.x - w / 2), Math.round(p.y - p.s / 2), w, p.s - (p.s > 2 ? 1 : 0));
      } else {
        // 칼날: 움직이는 방향으로 길게 뻗은 분홍 칼조각, 가운데 하얀 날
        const len = 3 + 8 * b, ux = dx / m, uy = dy / m;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = f * 0.85; ctx.strokeStyle = p.c; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x - ux * len, p.y - uy * len); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.globalAlpha = f; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(p.x - ux * len * 0.5, p.y - uy * len * 0.5); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.restore();
  }, null, (u, dt) => {
    t = u * life;
    const now = t + from, cx = a.tx(), cy = a.ty(), gy = groundY(), rel = a.tcRel != null;
    if (rel && !burst) {
      // 칼을 거둔 순간: 모였던 꽃잎이 칼날이 되어 사방으로 터져 나간다
      burst = true;
      for (const p of ps) { const an = Math.atan2(p.y - cy, p.x - cx) + rand(-0.3, 0.3), v = rand(260, 620); p.vx = Math.cos(an) * v; p.vy = Math.sin(an) * v * 0.6; }
    }
    for (const p of ps) {
      p.px = p.x; p.py = p.y;
      if (burst) { p.x += p.vx * dt; p.y += p.vy * dt; continue; }
      if (now >= vortexAt) {
        // 소용돌이: 대상 둘레를 돌며 반지름이 줄어든다
        const ox = p.x - cx, oy = (p.y - cy) * 1.6, r = Math.hypot(ox, oy), an = Math.atan2(oy, ox) + dt * (5 + 60 / (r + 10)) * a.dir;
        const nr = Math.max(8, r * (1 - dt * 2.6));
        p.x = cx + Math.cos(an) * nr; p.y = cy + (Math.sin(an) * nr) / 1.6;
        continue;
      }
      // 바람: 시전 방향으로 흐르며 물결치고, 끝을 넘으면 반대편에서 다시 들어온다
      p.x += a.dir * p.sp * dt * (0.5 + 0.5 * Math.min(1, t / 0.4));
      p.y = p.by + Math.sin(p.ph + now * 4 + p.x * 0.02) * p.wob;
      if (p.x > W + 20) { p.x -= W + 40; p.px = p.x; }
      if (p.x < -20) { p.x += W + 40; p.px = p.x; }
      p.y = Math.max(10, Math.min(gy - 3, p.y));
    }
  });
}
// 꽃잎 칼날 다섯 장이 사방에서 대상에게 꽂힌다 (life 초 뒤에 닿는다)
function tcPetalDartFx(a, tx, ty, life, n = 5) {
  const darts = Array.from({ length: n }, () => { const an = rand(0, Math.PI * 2), r = rand(50, 110); return { x0: tx + Math.cos(an) * r, y0: Math.max(14, ty + Math.sin(an) * r * 0.6), c: TC_PETALS[Math.floor(rand(0, 4))] }; });
  aFx(a, 0, life, (u) => {
    const e = easeIn(u);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const d of darts) {
      const x = mix(d.x0, tx, e), y = mix(d.y0, ty, e), bx = mix(d.x0, tx, Math.max(0, e - 0.25)), by = mix(d.y0, ty, Math.max(0, e - 0.25));
      ctx.globalAlpha = 0.9; ctx.strokeStyle = d.c; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(x, y); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8; ctx.stroke();
    }
    ctx.restore();
  });
}

// ── 저녁 하늘 (★★): 짙은 자줏빛에서 아래로 갈수록 분홍빛, 그 위를 바람 줄기가 흐른다 ──
function tcDuskFx(a, life) {
  const winds = Array.from({ length: Math.max(6, Math.round(W / 80)) }, () => [rand(0, 1), rand(20, 110), rand(40, 120), rand(200, 400)]);
  backFx(a, 0, life, (u) => {
    const t = u * life, al = Math.min(1, t / 0.35) * (t > life - 0.35 ? Math.max(0, (life - t) / 0.35) : 1);
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(26,6,30,${0.85 * al})`); g.addColorStop(0.6, `rgba(70,16,48,${0.7 * al})`); g.addColorStop(1, `rgba(140,50,80,${0.55 * al})`);
    ctx.fillStyle = g; ctx.fillRect(-60, -240, W + 120, H + 480);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ffb7c8';
    for (const [fx, y, w, sp] of winds) {
      const x = ((fx * (W + 200) + a.dir * t * sp) % (W + 200) + W + 200) % (W + 200) - 100;
      ctx.globalAlpha = 0.18 * al; ctx.fillRect(x, y + Math.sin(t * 3 + fx * 9) * 3, w, 1);
    }
    ctx.restore();
  });
}

// ── ★★★ 두 동강: 하단바를 split 높이에서 위아래로 잘라 위는 앞으로, 아래는 뒤로 어긋나게 다시 그린다 (지금까지 그려진 그림을 복사해 옮긴다) ──
const tcCv = document.createElement('canvas');
function tcSplitFx(a, life, tf) {
  const y = Math.min(a.ty(), groundY() - 28), D = a.k.dur, t0 = tcSplitT(a);
  aFx(a, 0, life, (u) => {
    const t = t0 + u * life, open = t < tf ? easeOut(clamp01((t - t0) / 0.12)) : 1 - clamp01((t - tf) / 0.05);
    // 탑 안(탑 캔버스)에서는 화면 복사를 하지 않는다 — 틈의 빛줄기만 남는다
    if (open > 0.01 && !(typeof towerInside === 'function' && towerInside())) {
      const off = 24 * open * a.dir, gap = 3 + 6 * open;
      const cv = ctx.canvas, m = ctx.getTransform();
      if (tcCv.width !== cv.width || tcCv.height !== cv.height) { tcCv.width = cv.width; tcCv.height = cv.height; }
      const g = tcCv.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, tcCv.width, tcCv.height);
      g.drawImage(cv, 0, 0);
      const X0 = Math.max(0, Math.round(m.e - 60 * m.a)), X1 = Math.min(cv.width, Math.round(m.e + (W + 60) * m.a));
      const Y0 = Math.max(0, Math.round(m.f - 20 * m.d)), Y1 = Math.min(cv.height, Math.round(m.f + (H + 20) * m.d)), YS = Math.round(m.f + y * m.d);
      const dx = Math.round(off * m.a), dy = Math.round((gap / 2) * m.d);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(X0, Y0, X1 - X0, Y1 - Y0);
      if (YS > Y0) ctx.drawImage(tcCv, X0, Y0, X1 - X0, YS - Y0, X0 + dx, Y0 - dy, X1 - X0, YS - Y0);
      if (Y1 > YS) ctx.drawImage(tcCv, X0, YS, X1 - X0, Y1 - YS, X0 - dx, YS + dy, X1 - X0, Y1 - YS);
      ctx.restore();
      // 틈 속의 빛
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5; ctx.fillStyle = TC_PINK; ctx.fillRect(-60, y - gap, W + 120, gap * 2);
      ctx.globalAlpha = 0.95; ctx.fillStyle = '#ffffff'; ctx.fillRect(-60, y - gap / 3, W + 120, Math.max(1, gap * 0.66));
      ctx.restore();
    }
    // 기사는 어긋난 그림 위에 따로 그린다 (제자리에 나타나 칼을 거두는 모습)
    if (t < tf + 0.02) {
      const p = tcPoseCore(t, tf, D);
      drawHero(ctx, a.cls, a.x(), groundY(), { mode: 'fight', swing: -1, t: clock, ...p, alpha: clamp01((t - (tf - 0.32)) / 0.1), facing: a.dir });
    }
  });
}
// ★★★ 다시 붙는 순간 그 틈에서 터지는 빛: 하단바 폭 전체의 가로 빛줄기가 위아래로 부풀었다 사라진다
function tcSeamBurstFx(a, y) {
  aFx(a, 0, 0.8, (u) => {
    const k = easeOut(Math.min(1, u / 0.12)), f = u < 0.2 ? 1 : 1 - (u - 0.2) / 0.8, h = 4 + 46 * k;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, y - h, 0, y + h);
    g.addColorStop(0, 'rgba(255,106,138,0)'); g.addColorStop(0.35, `rgba(255,140,170,${0.6 * f})`); g.addColorStop(0.5, `rgba(255,255,255,${f})`);
    g.addColorStop(0.65, `rgba(255,140,170,${0.6 * f})`); g.addColorStop(1, 'rgba(255,106,138,0)');
    ctx.fillStyle = g; ctx.fillRect(-60, y - h, W + 120, h * 2);
    ctx.globalAlpha = f; ctx.fillStyle = '#ffffff'; ctx.fillRect(-60, y - 1.5 * (1 - u), W + 120, 3 * (1 - u) + 0.5);
    ctx.restore();
  });
  const n = Math.round(Math.max(30, Math.min(110, W / 14)));
  for (let i = 0; i < n; i++) parts.push({ x: rand(0, W), y: y + rand(-3, 3), vx: rand(-40, 40), vy: (i % 2 ? -1 : 1) * rand(40, 160), g: 60, size: Math.random() < 0.3 ? 3 : 2, color: i % 3 ? TC_PETALS[i % 4] : '#ffffff', life: rand(0.5, 0.9), t: 0, add: true });
}

Object.assign(SKILL_FX, {
  thousandCuts: {
    pose(u, a) {
      const D = a.k ? a.k.dur : 2.4, t = u * D, tf = a.k ? tcLastT(a) : 0.9 * D;
      const p = tcPoseCore(t, tf, D);
      // ★★★ 는 두 동강 난 동안 어긋난 그림 위에 따로 그리므로(tcSplitFx) 원래 자리에선 숨긴다
      if (a.mast >= 3 && a.k && t > 0.38 && t < tf) p.alpha = 0;
      return p;
    },
    cues: (a) => {
      const D = a.k.dur, m = a.mast, n = a.k.hits.length, tf = tcLastT(a), list = [];
      const at = (sec, fn) => list.push([Math.max(0.001, sec / D), fn]);
      // 순서가 중요하다: 흑백 레이어를 먼저 쌓아야 그 뒤의 꽃잎·검선은 색이 남는다
      at(0.01, (a) => {
        if (m === 0) tcDimFx(a, 0.3, tf, 0.42, '24,4,12');
        if (m === 1 || m >= 3) { tcDimFx(a, 0.35, tf, 0.4, '14,12,16'); tcGrayFx(a, 0.35, tf); }
        if (m === 2) tcDuskFx(a, D - 0.02);
        if (m >= 2) tcPetalStormFx(a, 0.3, D - 0.32, m >= 3 ? 0.8 : tcHitT(a, 0) - 0.15, m >= 3 ? 99 : tf - 0.4, Math.round(Math.max(70, Math.min(m >= 3 ? 170 : 240, W / (m >= 3 ? 7 : 5)))));
        tcLinesFx(a, D + 0.6);
      });
      at(0.3, (a) => tcVanishFx(a));
      // ★★: 잔타마다 꽃잎 칼날이 그 타격 순간에 맞춰 꽂힌다
      if (m === 2) for (let i = 0; i < n - 1; i++) at(tcHitT(a, i) - 0.1, (a) => { const tg = tcAim(a, i); tcPetalDartFx(a, tg.x, tg.y, 0.1); });
      if (m >= 3) at(tcSplitT(a), (a) => tcSplitFx(a, tf - tcSplitT(a) + 0.1, tf));
      return list.sort((p, q) => p[0] - q[0]);
    },
    hit(a, i, n) {
      const m = a.mast, last = i === n - 1, tgs = a.targets(i), tg = tcAim(a, i), d = a.dir;
      if (last) {
        // 딸깍 — 칼을 거두는 순간 그어 둔 모든 것이 한꺼번에 갈라진다
        if (m === 2) {
          // 마지막에 하단바 전체를 가르는 큰 사선 다섯 줄이 동시에 생겼다가 바로 터진다
          for (let j = 0; j < 5; j++) tcAddLine(a, (j + 0.5) / 5 * W, mix(30, groundY() - 20, rand(0.2, 0.8)), (j % 2 ? 0.5 : -0.5) + rand(-0.15, 0.15), 240, 0, 12, '#ff8fab');
        }
        a.tcRel = clock;
        tcClickFx(a);
        tcLineSparks(a);
        for (const t of tgs) burst(t.x, t.y, 30, ['#ffffff', TC_PINK, '#ffd6e0'], 220, 3);
        if (m >= 3) {
          tcSeamBurstFx(a, Math.min(a.ty(), groundY() - 28));
          tcFlash(a, '255,220,232', 0.6, 0.4);
          impact({ stop: 0.3, shake: 0.85 });
        } else {
          tcFlash(a, '255,190,210', [0.3, 0.42, 0.5][m], 0.32);
          impact({ stop: [0.16, 0.22, 0.24][m], shake: [0.45, 0.6, 0.7][m] });
        }
        return;
      }
      if (m >= 3 && i === n - 2) {
        // 두 동강: 하단바 끝에서 끝까지 가로로 한 칼
        tcAddLine(a, W / 2, Math.min(a.ty(), groundY() - 28), 0, W + 160, 0, 6, '#ffffff');
        tcFlash(a, '255,255,255', 0.35, 0.18);
        for (const t of tgs) burst(t.x, t.y, 20, ['#ffffff', TC_PINK], 200, 3);
        impact({ stop: 0.12, shake: 0.5 });
        return;
      }
      if (m === 0) {
        // 하단바를 가로지르는 긴 검선 한 줄 (대상을 지나간다)
        const angs = [-0.26, 0.2, -0.1, 0.32];
        tcAddLine(a, tg.x, tg.y + [-8, 6, -2, 10][i % 4], angs[i % 4] * d, W * 1.4, 0, 9);
        tcNick(tg.x, tg.y, 10);
        impact({ stop: 0.03, shake: 0.12 });
        return;
      }
      if (m === 1 || m >= 3) {
        // 사방에서 검선 네 갈래(★★★ 는 꽃잎 칼날이 함께 있어 두 갈래), 그중 하나는 하단바를 길게 가로지른다
        const k = m >= 3 ? 2 : 4;
        for (let j = 0; j < k; j++) {
          const long = j === 0 && i % 2 === 0;
          tcAddLine(a, tg.x + rand(-26, 26), tg.y + rand(-16, 12), long ? rand(-0.3, 0.3) : rand(0, Math.PI), long ? W * 1.3 : rand(80, 200), j * 0.025, long ? 10 : 6);
        }
        tcFlickerFx(a, tg.x + (i % 2 ? 1 : -1) * rand(16, 34), i % 2 ? -1 : 1);
        impact({ stop: 0.012, shake: 0.08 });
        return;
      }
      // ★★: 꽃잎 칼날이 꽂힌 자리에서 꽃잎이 터진다
      for (let j = 0; j < 8; j++) parts.push({ x: tg.x, y: tg.y, vx: rand(-120, 120), vy: rand(-120, 40), g: 120, size: 2, color: TC_PETALS[j % 4], life: rand(0.3, 0.55), t: 0 });
      if (i % 3 === 0) tcAddLine(a, tg.x, tg.y, rand(0, Math.PI), rand(70, 120), 0, 6, '#ff8fab');
      impact({ stop: 0.012, shake: 0.07 });
    },
    // 맞은 자리마다 가는 X 자 칼자국
    marks(a, t, pow) { tcNick(t.x + rand(-5, 5), t.y + rand(-6, 6), 6 + 3 * Math.min(2, pow), 0.28); },
    // 칼자루에 손을 얹고 있는 동안 발밑에서 꽃잎이 일렁인다
    tick(a, u) {
      const t = u * a.k.dur;
      if (t > 0.3 || Math.random() > 0.6) return;
      parts.push({ x: a.x() + rand(-18, 18), y: groundY() - rand(0, 6), vx: rand(-20, 20), vy: rand(-60, -20), g: -10, size: 2, color: TC_PETALS[Math.floor(rand(0, 4))], life: rand(0.3, 0.6), t: 0 });
    },
    kb: 20,
  },
});
