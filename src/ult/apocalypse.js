'use strict';
// 3차 궁극기 「종언의 겁화」 연출 (archmage). 수치·단계는 src/classes.js 의 SKILLS.apocalypse, 공통 레터박스·컷인은 src/skills.js 의 drawUltScreen.
//  Lv1 「화염 강하」 지팡이를 치켜들면 하늘이 붉게 타오르며 불타는 구름이 깔리고 — 불의 비가 하단바 전체에 비스듬히 쏟아져 땅이 불붙는다
//  ★   「종언의 겁화」 하늘에 하단바만 한 마법진이 열려 룬이 돌고 — 겁화의 운석이 하단바 곳곳에 쏟아지다가, 마지막에 거대한 운석이 떨어진다
//  ★★  「태양 붕괴」 하늘의 붉은 태양에 금이 가며 빛이 새어 나오고 — 태양이 쪼개져 불타는 조각들이 하단바 곳곳에 떨어지고, 남은 심이 한 점으로 오그라들었다 터진다
//  ★★★ 「세계의 끝」 기사 발밑에서 불길이 번져 하단바가 통째로 불바다가 되고, 불기둥이 솟는다 — 하늘이 갈라져 하얀 겁화가 쏟아지고, 하얀 불의 벽이 하단바를 끝에서 끝까지 삼킨다
// 시전 내내 이어지는 큰 그림은 시전 시작에 한 번 만든 연출(뒤 레이어 하늘·마법진·태양 / 앞 레이어 불비·운석·불바다)이 시간표대로 그리고,
// 타격 순간(hit)은 대상 자리에 떨어지는 불만 더한다.

const AP_FIRE = ['#fff0a0', '#ffb02e', '#ff5a1f', '#c0200c'];      // 불꽃 아래(심)→위(끝)
const AP_WHITE = ['#ffffff', '#fff8dc', '#ffe9a8', '#ffc45a'];     // 하얀 겁화
// 정해진 난수 (같은 i 는 늘 같은 값) — 프레임마다 모양이 흔들리지 않게
const apN = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function apCenter(a) {
  const t = a.targets();
  return t.length ? t.reduce((s, p) => s + p.x, 0) / t.length : a.tx();
}
const apMid = (a, pad = 60) => Math.max(pad, Math.min(W - pad, mix(a.x(), apCenter(a), 0.55)));
// 지팡이 끝(마력 구슬) 화면 위치 — 자세의 bowA·lift 를 따라간다 (world.js heroRig·drawStaff)
function apTip(a) {
  const p = castPose(a.owner) || {}, face = p.facing != null ? p.facing : a.dir;
  const ang = staffAngle(p.bowA || 0), sa = face > 0 ? ang : Math.PI - ang;
  const hx = a.px() + face * (5 * PX + Math.round((p.skew || 0) * 3 * PX)), hy = groundY() - (p.lift || 0) - HAND_Y * (p.sy || 1);
  return { x: hx + Math.cos(sa) * 32, y: hy + Math.sin(sa) * 32 };
}

// 불꽃 혀 하나 (도트): 바닥(bx, by)에서 높이 h, 폭 w. 바깥 불 → 안쪽 심 두 겹, 위로 갈수록 가늘어지며 흔들린다
function apFlame(bx, by, h, w, t, seed, al = 1, pal = AP_FIRE) {
  if (h < 2 || al <= 0) return;
  const n = Math.max(2, Math.min(12, Math.ceil(h / 4))), step = h / n;
  ctx.globalAlpha = al;
  for (let i = 0; i < n; i++) {
    const f = i / n, sway = Math.sin(t * 9 + seed * 5.3 + f * 4) * f * w * 0.55;
    const ww = Math.max(1, w * (1 - f * 0.8) * (0.85 + 0.15 * Math.sin(t * 17 + seed * 3 + i)));
    const x = Math.round(bx + sway - ww / 2), y = Math.round(by - (i + 1) * step);
    ctx.fillStyle = pal[Math.min(3, 1 + Math.floor(f * 3))];
    ctx.fillRect(x, y, Math.round(ww), Math.ceil(step) + 1);
    if (f < 0.6) { ctx.fillStyle = pal[f < 0.3 ? 0 : 1]; ctx.fillRect(Math.round(x + ww * 0.3), y, Math.max(1, Math.round(ww * 0.4)), Math.ceil(step) + 1); }
  }
  ctx.globalAlpha = 1;
}
// 불타는 하늘: 하단바를 검붉게 가라앉히고, 위쪽에 아랫면이 불빛에 물든 구름이 흐른다 (뒤 레이어)
function apSky(a, dark, glow, t, rgb = '26,3,0') {
  if (dark > 0) dimBand(dark, rgb);
  if (glow <= 0) return;
  ctx.save();
  const g = ctx.createLinearGradient(0, 16, 0, H - 10);
  g.addColorStop(0, `rgba(255,70,20,${0.5 * glow})`); g.addColorStop(0.45, `rgba(200,30,10,${0.16 * glow})`); g.addColorStop(1, `rgba(255,90,20,${0.2 * glow})`);
  ctx.fillStyle = g; ctx.fillRect(-60, 0, W + 120, H);
  // 구름: 8px 칸마다 높이가 다른 검은 덩어리, 아랫단이 불빛으로 깜박인다
  const scroll = t * 14 * -a.dir;
  for (let x = -16; x < W + 16; x += 8) {
    const i = Math.floor((x - scroll) / 8), off = ((x - scroll) % 8 + 8) % 8;
    const h = 8 + Math.round(9 * apN(i) + 5 * apN(i * 0.37 + 4)), X = Math.round(x - off);
    ctx.globalAlpha = 0.85 * glow;
    ctx.fillStyle = '#2a0805'; ctx.fillRect(X, 14, 9, h + 2);
    ctx.globalAlpha = (0.55 + 0.35 * Math.sin(t * 6 + i * 1.7)) * glow;
    ctx.fillStyle = apN(i + 9) < 0.5 ? '#ff5a1f' : '#ffb02e'; ctx.fillRect(X, 14 + h, 9, 2);
  }
  ctx.restore();
}
// 땅이 붉게 달아오른다 (불바다·불비 밑)
function apGroundGlow(x0, x1, al, hgt = 30) {
  if (al <= 0 || x1 <= x0) return;
  const gy = groundY();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, gy - hgt, 0, gy);
  g.addColorStop(0, 'rgba(255,60,10,0)'); g.addColorStop(1, `rgba(255,110,30,${0.6 * al})`);
  ctx.fillStyle = g; ctx.fillRect(x0, gy - hgt, x1 - x0, hgt);
  ctx.restore();
}
// 불덩이 하나 (운석·불방울 공용): 꼬리 칸들이 지나온 길에 줄지어 식어 간다
function apFireball(x, y, vx, vy, r, al = 1, rock = true) {
  const L = Math.hypot(vx, vy) || 1, ux = vx / L, uy = vy / L, tail = r * 7;
  ctx.save();
  ctx.globalAlpha = al;
  ctx.globalCompositeOperation = 'lighter';
  for (let s = tail; s > 0; s -= Math.max(2, r * 0.6)) {
    const f = s / tail, q = Math.max(2, Math.round(r * 1.6 * (1 - f) + 1));
    ctx.fillStyle = f > 0.6 ? 'rgba(200,30,10,0.45)' : f > 0.3 ? 'rgba(255,90,30,0.6)' : 'rgba(255,190,70,0.8)';
    const wob = Math.sin(s * 0.8 + clock * 30) * r * 0.3 * f;
    if (r > 5) { ctx.beginPath(); ctx.arc(x - ux * s - uy * wob, y - uy * s + ux * wob, q * 0.55, 0, Math.PI * 2); ctx.fill(); }
    else ctx.fillRect(Math.round(x - ux * s - uy * wob - q / 2), Math.round(y - uy * s + ux * wob - q / 2), q, q);
  }
  ctx.fillStyle = 'rgba(255,120,40,0.4)';
  ctx.beginPath(); ctx.arc(x, y, r * 2, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  const R = Math.round(r);
  if (rock && r > 5) {
    // 큰 운석: 울퉁불퉁한 검은 바위에 앞쪽이 녹아 빛나고 용암 금이 간다
    ctx.fillStyle = '#3a0c06';
    ctx.beginPath();
    for (let k = 0; k < 9; k++) { const ang = (k / 9) * Math.PI * 2, rr = r * (0.82 + 0.18 * apN(k + 5)); ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff5a1f';
    ctx.beginPath(); ctx.arc(x + ux * r * 0.35, y + uy * r * 0.35, r * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd257';
    ctx.beginPath(); ctx.arc(x + ux * r * 0.55, y + uy * r * 0.55, r * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) { const ang = k * 2.1 + 0.5; ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(ang) * r * 0.8, y - Math.sin(ang) * r * 0.8); }
    ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x + ux * r * 0.7) - 2, Math.round(y + uy * r * 0.7) - 2, 4, 4);
    ctx.restore();
    return;
  }
  if (rock) { ctx.fillStyle = '#3a0c06'; ctx.fillRect(Math.round(x) - R, Math.round(y) - R, R * 2, R * 2); }
  ctx.fillStyle = '#ffb02e'; ctx.fillRect(Math.round(x + ux * R * 0.4) - Math.ceil(R * 0.7), Math.round(y + uy * R * 0.4) - Math.ceil(R * 0.7), Math.ceil(R * 1.4), Math.ceil(R * 1.4));
  ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x + ux * R * 0.6) - 1, Math.round(y + uy * R * 0.6) - 1, Math.max(2, Math.round(R * 0.6)), Math.max(2, Math.round(R * 0.6)));
  ctx.restore();
}
// 떨어진 자리의 폭발: 불꽃 반구 + 흙 고리 + 잠깐 남는 불길
function apBlast(a, x, size, white = false) {
  const gy = groundY(), pal = white ? AP_WHITE : AP_FIRE, life = 0.55;
  aFx(a, 0, life, (u) => {
    const r = size * (0.5 + 1.2 * easeOut(clamp01(u * 2.2)));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, gy - 2, 1, x, gy - 2, r);
    g.addColorStop(0, `rgba(255,250,220,${0.9 * (1 - u)})`); g.addColorStop(0.5, white ? `rgba(255,240,200,${0.5 * (1 - u)})` : `rgba(255,120,30,${0.6 * (1 - u)})`); g.addColorStop(1, 'rgba(255,40,10,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, gy - 2 - r, r * 2, r);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 1 - u;
    ctx.strokeStyle = pal[1]; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, gy - 2, r * 1.3, r * 0.25, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    for (let k = 0; k < 3; k++) apFlame(x + (k - 1) * size * 0.35, gy, size * (0.9 - Math.abs(k - 1) * 0.3) * (1 - easeIn(u)), size * 0.35, clock, x + k, 1 - u, pal);
  });
  burst(x, gy - 4, Math.round(size * 0.6), [pal[0], pal[1], pal[2], '#5a2a14'], 60 + size * 5, 2, 380);
}

// ── Lv1 화염 강하: 불타는 하늘 → 불의 비 ──
function apRainStage(a) {
  const d = a.k.dur, fin = a.k.hits[a.k.hits.length - 1][0] * d, life = d + 0.6, gy = groundY();
  const drops = [], embers = [];
  a.apRainBoost = 0;
  backFx(a, 0, life, (u) => {
    const t = u * life, ramp = easeOut(clamp01(t / 0.9)), out = 1 - segU(t, fin + 0.2, life);
    apSky(a, 0.55 * ramp * out, ramp * out, t);
    apGroundGlow(-40, W + 40, segU(t, 0.9, 1.4) * out * 0.7, 24);
  });
  aFx(a, 0, life, (u) => {
    const t = u * life;
    ctx.save();
    for (const p of drops) {
      // 비스듬한 불줄기: 짧은 꼬리 세 칸 + 밝은 머리
      for (let k = 3; k >= 1; k--) {
        ctx.globalAlpha = 0.25 * (4 - k);
        ctx.fillStyle = k > 1 ? '#ff5a1f' : '#ffb02e';
        ctx.fillRect(Math.round(p.x - p.vx * 0.012 * k) - 1, Math.round(p.y - p.vy * 0.012 * k) - 1, p.s, p.s + 1);
      }
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff0a0'; ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, p.s, p.s);
    }
    ctx.restore();
    // 떨어진 자리마다 작은 불이 붙었다 사그라든다
    for (const e of embers) apFlame(e.x, gy, e.h * (1 - e.t / e.life), 4, t, e.x, 1 - e.t / e.life);
  }, null, (u, dt) => {
    const t = u * life, rate = (t < fin + 0.15 ? segU(t, 0.55, 1.1) * (70 + 60 * a.apRainBoost) : 0) * Math.max(1, W / 480);
    a.apRainBoost = Math.max(0, a.apRainBoost - dt * 2);
    for (let n = rate * dt + Math.random(); n >= 1; n--) {
      drops.push({ x: rand(-60, W + 60), y: rand(-10, 14), vx: a.dir * rand(70, 110), vy: rand(300, 380), s: Math.random() < 0.3 ? 3 : 2 });
    }
    for (const p of drops) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y >= gy - 2) {
        p.dead = true;
        if (Math.random() < 0.45) embers.push({ x: p.x, h: rand(5, 11), t: 0, life: rand(0.25, 0.5) });
        if (Math.random() < 0.5) parts.push({ x: p.x, y: gy - 2, vx: rand(-50, 50), vy: rand(-90, -30), g: 360, size: 2, color: Math.random() < 0.5 ? '#ffb02e' : '#ff5a1f', life: 0.3, t: 0, add: true });
      }
    }
    for (const e of embers) e.t += dt;
    for (let i = drops.length - 1; i >= 0; i--) if (drops[i].dead) drops.splice(i, 1);
    for (let i = embers.length - 1; i >= 0; i--) if (embers[i].t >= embers[i].life) embers.splice(i, 1);
  });
}
// 대상에 쏟아지는 굵은 불방울 (비스듬히 떨어져 터진다)
function apBigDrop(a, tx, ty, r, delay, onLand) {
  const life = 0.16, x0 = tx - a.dir * 40, y0 = ty - 110;
  aFx(a, delay, life, (u) => {
    const p = easeIn(u);
    apFireball(mix(x0, tx, p), mix(y0, ty, p), tx - x0, ty - y0, r, 1, false);
  }, onLand);
}
// Lv1 마무리: 하늘이 한 번 크게 쏟아지고 하단바 땅 전체가 불붙는다
function apRainFinish(a) {
  const gy = groundY(), life = 0.8, n = Math.ceil((W + 40) / 10);
  a.apRainBoost = 1.5;
  aFx(a, 0, 0.16, (u) => dimBand(0.35 * (1 - u), '255,140,60'));
  aFx(a, 0, life, (u) => {
    const grow = easeOut(clamp01(u * 4)), fade = 1 - easeIn(segU(u, 0.35, 1));
    apGroundGlow(-40, W + 40, fade, 40);
    for (let i = 0; i < n; i++) apFlame(-20 + i * 10, gy, (10 + 16 * apN(i)) * grow * fade, 7, clock, i, 0.9 * fade);
  });
}

// ── ★ 종언의 겁화: 하늘의 대마법진 → 운석우 → 거대 운석 ──
function apCircle(a) {
  if (!a.apC) a.apC = { X: apMid(a, 80), Y: 34, RX: Math.min(W * 0.46, 250), RY: 12 };
  return a.apC;
}
// 룬 한 글자 (3×3 칸 무늬 넷 중 하나)
const AP_RUNES = [[1, 0, 1, 0, 1, 0, 1, 0, 1], [1, 1, 1, 0, 1, 0, 1, 0, 1], [0, 1, 0, 1, 1, 1, 1, 0, 1], [1, 1, 0, 0, 1, 1, 1, 0, 0]];
function apRune(x, y, k, c) {
  const r = AP_RUNES[k % AP_RUNES.length];
  ctx.fillStyle = c;
  for (let j = 0; j < 9; j++) if (r[j]) ctx.fillRect(Math.round(x) - 2 + (j % 3), Math.round(y) - 2 + Math.floor(j / 3), 1, 1);
}
function apCircleDraw(C, open, t, al, flare) {
  if (al <= 0 || open <= 0) return;
  const { X, Y, RX, RY } = C, p = easeOut(open), full = Math.PI * 2 * p;
  ctx.save();
  ctx.globalAlpha = al;
  // 아래로 드리운 불빛
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(X, Y, 4, X, Y, RX);
  g.addColorStop(0, `rgba(255,120,40,${0.35 + 0.35 * flare})`); g.addColorStop(1, 'rgba(255,40,10,0)');
  ctx.fillStyle = g;
  ctx.save(); ctx.translate(X, Y); ctx.scale(1, 0.45); ctx.translate(-X, -Y);
  ctx.fillRect(X - RX, Y - RX, RX * 2, RX * 2);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  const ring = (rx, ry, rot, w, c) => {
    ctx.strokeStyle = c; ctx.lineWidth = w;
    ctx.beginPath(); ctx.ellipse(X, Y, rx, ry, 0, rot, rot + full); ctx.stroke();
  };
  ring(RX, RY, t * 0.6, 2, '#ff3b1f');
  ring(RX - 6, RY - 1.5, -t * 0.6, 1, '#ffb02e');
  ring(RX * 0.72, RY * 0.72, t * 0.9, 1.5, '#ff5a1f');
  ring(RX * 0.38, RY * 0.38, -t * 1.4, 1.5, '#ffd257');
  // 바깥 두 고리 사이를 도는 룬 글자
  const n = Math.max(16, Math.round(RX / 9));
  for (let k = 0; k < n * p; k++) {
    const ang = t * 0.6 + (k / n) * Math.PI * 2, fl = 0.6 + 0.4 * Math.sin(t * 8 + k);
    apRune(X + Math.cos(ang) * (RX - 3), Y + Math.sin(ang) * (RY - 0.8), k, fl > 0.85 ? '#ffffff' : '#ffd257');
  }
  // 안쪽 육망성 (두 삼각형) — 고리가 다 그려진 뒤 이어서 그어진다
  const s = segU(open, 0.6, 1);
  if (s > 0) {
    ctx.strokeStyle = flare > 0.2 ? '#ffffff' : '#ff7a2a'; ctx.lineWidth = 1;
    for (const off of [0, Math.PI]) {
      ctx.beginPath();
      for (let k = 0; k <= Math.floor(3 * s); k++) {
        const ang = -t * 0.9 + off + (k / 3) * Math.PI * 2;
        const x = X + Math.cos(ang) * RX * 0.72, y = Y + Math.sin(ang) * RY * 0.72;
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}
function apCircleStage(a) {
  const d = a.k.dur, hits = a.k.hits.map((h) => h[0] * d), first = hits[0], fin = hits[hits.length - 1], life = d + 0.7;
  const C = apCircle(a), gy = groundY(), rocks = [];
  let next = 0.95;
  a.apFlare = 0;
  backFx(a, 0, life, (u) => {
    const t = u * life, ramp = easeOut(clamp01(t / 0.7)), out = 1 - segU(t, fin + 0.25, life);
    apSky(a, 0.62 * ramp * out, 0.7 * ramp * out, t, '24,2,4');
    apCircleDraw(C, segU(t, 0.25, 1.05), t, out, a.apFlare);
    a.apFlare = Math.max(0, a.apFlare - 0.04);
  });
  aFx(a, 0, life, (u) => {
    const t = u * life;
    // 지팡이 끝에서 마법진까지 솟는 불기둥 한 줄
    if (t > 0.2 && t < first) {
      const tp = apTip(a), k = segU(t, 0.2, 0.45), f = 1 - segU(t, first - 0.25, first), top = mix(tp.y, C.Y, k);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,90,30,${0.45 * f})`; ctx.fillRect(Math.round(tp.x) - 3, Math.round(top), 6, Math.round(tp.y - top));
      ctx.fillStyle = `rgba(255,240,200,${0.9 * f})`; ctx.fillRect(Math.round(tp.x) - 1, Math.round(top), 2, Math.round(tp.y - top));
      ctx.restore();
    }
    for (const r of rocks) {
      const p = clamp01((t - r.t0) / r.dur);
      if (p <= 0 || p >= 1) continue;
      const q = easeIn(p);
      apFireball(mix(r.x0, r.x1, q), mix(C.Y, gy - 3, q), r.x1 - r.x0, gy - C.Y, r.r);
    }
    apGroundGlow(-40, W + 40, segU(t, 1.2, 1.6) * (1 - segU(t, fin + 0.2, life)) * 0.8, 26);
  }, null, (u) => {
    const t = u * life;
    // 잔 운석: 마법진 곳곳에서 떨어져 하단바 전체에 쏟아진다 (넓은 창이면 더 자주)
    if (t >= next && t < fin - 0.1) {
      next = t + mix(0.16, 0.06, segU(t, 1.0, 1.6)) * Math.min(1, 520 / Math.max(300, W));
      const x0 = C.X + rand(-0.95, 0.95) * C.RX, x1 = Math.max(-20, Math.min(W + 20, x0 + a.dir * rand(10, 60)));
      const r = { x0, x1, t0: t, dur: rand(0.35, 0.5), r: rand(2.5, 4) };
      rocks.push(r);
      skLater(a, r.dur, () => { apBlast(a, x1, 14 + r.r * 2); impact({ shake: 0.05 }); });
    }
  });
}
// ★ 잔타: 마법진에서 대상에게 내리꽂히는 운석
function apMeteorAt(a, tx, ty, r) {
  const C = apCircle(a), x0 = tx - a.dir * 30, life = 0.14;
  a.apFlare = Math.max(a.apFlare || 0, 0.5);
  aFx(a, 0, life, (u) => { const p = easeIn(u); apFireball(mix(x0, tx, p), mix(C.Y, ty, p), tx - x0, ty - C.Y, r); }, () => {
    apBlast(a, tx, 20);
    hitFx(tx, ty, '#ff7a2a', 1.4);
  });
}
// ★ 마무리: 마법진 한가운데서 거대한 운석이 빠져나와 떨어진다
function apGreatMeteor(a, life) {
  const C = apCircle(a), x1 = apCenter(a), gy = groundY();
  aFx(a, 0, life, (u) => {
    a.apFlare = 1;
    const p = easeIn(u), x = mix(C.X, x1, p), y = mix(C.Y - 6, gy - 16, p), r = mix(6, 15, easeOut(u));
    apFireball(x, y, x1 - C.X, gy - C.Y, r);
    // 공기를 찢는 충격 고리
    ctx.save(); ctx.globalAlpha = 0.5 * u; ctx.strokeStyle = '#ffd257'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, r * 2.4, r * 1.4, Math.atan2(gy - C.Y, x1 - C.X), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }, null, () => { if (Math.random() < 0.8) parts.push({ x: mix(C.X, x1, 0.5) + rand(-40, 40), y: rand(20, 60), vx: rand(-20, 20), vy: rand(20, 60), g: 0, size: 2, color: '#ffb02e', life: 0.4, t: 0, add: true }); });
}
function apGreatBlast(a, x) {
  const gy = groundY(), life = 1.0;
  aFx(a, 0, 0.2, (u) => dimBand(0.6 * (1 - u), '255,200,140'));
  aFx(a, 0, life, (u) => {
    const r = 30 + 170 * easeOut(clamp01(u * 1.6)), f = 1 - easeIn(u);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, gy, 4, x, gy, r);
    g.addColorStop(0, `rgba(255,250,220,${f})`); g.addColorStop(0.4, `rgba(255,140,40,${0.7 * f})`); g.addColorStop(1, 'rgba(200,30,10,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, gy - r, r * 2, r);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = f; ctx.strokeStyle = '#fff0a0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, gy - 3, r * 1.6, r * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    // 치솟는 불기둥
    const ch = 90 * easeOut(clamp01(u * 3));
    for (let k = 0; k < 5; k++) apFlame(x + (k - 2) * 9, gy, ch * (1 - Math.abs(k - 2) * 0.22) * f, 12, clock, k + 40, f);
  });
  for (let k = 0; k < 40; k++) parts.push({ x: x + rand(-20, 20), y: gy - 4, vx: rand(-300, 300), vy: rand(-280, -60), g: 420, size: k % 3 ? 2 : 3, color: ['#ffb02e', '#ff5a1f', '#fff0a0', '#4a1a0a'][k % 4], life: rand(0.5, 0.9), t: 0, add: k % 4 !== 3 });
}

// ── ★★ 태양 붕괴: 금 간 붉은 태양 → 쪼개진 조각이 하단바에 쏟아진다 → 남은 심이 오그라들었다 터진다 ──
function apSunStage(a) {
  const d = a.k.dur, hits = a.k.hits.map((h) => h[0] * d), fin = hits[hits.length - 1], life = d + 0.8, gy = groundY();
  const X = apMid(a, 60), Y = 42, R = 25, BREAK = 1.38, n = 11;      // 금은 이름 컷인이 빠질 무렵부터 (컷인에 가리지 않게)
  // 조각: 원을 지그재그 경계로 n 쪽 나눈다. 쪼개진 뒤 바깥으로 벌어졌다가 하단바 곳곳으로 떨어진다
  const cuts = Array.from({ length: n }, (_, k) => (k / n) * Math.PI * 2 + rand(-0.12, 0.12));
  const frags = cuts.map((a0, k) => {
    const a1 = k + 1 < n ? cuts[k + 1] : cuts[0] + Math.PI * 2, mid = (a0 + a1) / 2, pts = [[Math.cos(mid) * R * 0.2, Math.sin(mid) * R * 0.2]];
    for (let s = 0; s <= 3; s++) { const ang = mix(a0, a1, s / 3), rr = R * (s % 3 ? rand(0.9, 1.05) : 1); pts.push([Math.cos(ang) * rr, Math.sin(ang) * rr]); }
    const lx = mix(-10, W + 10, (k + 0.5) / n) + rand(-20, 20);
    return { pts, mid, lx, t1: BREAK + 0.25 + rand(0, 0.15), land: mix(BREAK + 0.65, fin - 0.15, apN(k * 3.1)), rot: rand(-6, 6), done: false };
  });
  // 갈라지는 금: 경계를 따라 바깥으로 지그재그
  const cracks = cuts.map((ang) => {
    const pts = [[0, 0]];
    for (let s = 1; s <= 5; s++) pts.push([Math.cos(ang) * R * s / 5 + rand(-2, 2), Math.sin(ang) * R * s / 5 + rand(-2, 2)]);
    return pts;
  });
  const fragPos = (f, t) => {
    const dx = Math.cos(f.mid), dy = Math.sin(f.mid);
    const spread = 10 + 12 * easeOut(segU(t, BREAK, f.t1));
    const sx = X + dx * spread, sy = Y + dy * spread * 0.8;
    if (t < f.t1) return { x: sx, y: sy, ang: f.rot * 0.05 * segU(t, BREAK, f.t1) };
    const p = segU(t, f.t1, f.land);
    return { x: mix(sx, f.lx, p), y: mix(sy, gy - 6, p * p), ang: f.rot * (t - f.t1) * 0.3 };
  };
  a.apCore = { X, Y };
  backFx(a, 0, life, (u) => {
    const t = u * life, ramp = easeOut(clamp01(t / 0.8)), out = 1 - segU(t, fin + 0.3, life);
    dimBand(0.72 * ramp * out, '20,2,2');
    // 하늘이 핏빛으로 물든다
    ctx.save();
    const g = ctx.createRadialGradient(X, Y, R, X, Y, Math.max(W, 300));
    g.addColorStop(0, `rgba(255,60,20,${0.45 * ramp * out})`); g.addColorStop(0.35, `rgba(140,10,10,${0.25 * ramp * out})`); g.addColorStop(1, 'rgba(60,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(-60, 0, W + 120, H);
    ctx.restore();
    if (t >= BREAK) return;
    // 붉은 태양: 천천히 떠오르며 맥박치고, 금이 갈수록 그 틈으로 빛이 새어 나온다
    const rise = easeOut(clamp01(t / 0.6)), crack = segU(t, 0.9, BREAK), y = mix(Y + 20, Y, rise);
    const r = R * (1 + 0.04 * Math.sin(t * (8 + crack * 30)));
    ctx.save();
    ctx.globalAlpha = rise;
    ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(X, y, r * 0.6, X, y, r * 2.6);
    hg.addColorStop(0, 'rgba(255,60,20,0.55)'); hg.addColorStop(1, 'rgba(255,20,0,0)');
    ctx.fillStyle = hg; ctx.fillRect(X - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
    // 금 사이로 새는 빛줄기
    if (crack > 0) {
      for (let k = 0; k < n; k++) {
        const ang = cuts[k], len = r * (1.2 + 2.2 * crack) * (0.7 + 0.3 * Math.sin(t * 20 + k));
        ctx.strokeStyle = `rgba(255,220,140,${0.35 * crack})`; ctx.lineWidth = 2 + 3 * crack;
        ctx.beginPath(); ctx.moveTo(X + Math.cos(ang) * r, y + Math.sin(ang) * r); ctx.lineTo(X + Math.cos(ang) * len, y + Math.sin(ang) * len); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    const sg = ctx.createRadialGradient(X - r * 0.3, y - r * 0.3, 1, X, y, r);
    sg.addColorStop(0, '#ff9a5a'); sg.addColorStop(0.5, '#c8240e'); sg.addColorStop(1, '#5a0a06');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(X, y, r, 0, Math.PI * 2); ctx.fill();
    // 겉면의 검은 흑점
    ctx.fillStyle = 'rgba(40,0,0,0.55)';
    for (let k = 0; k < 9; k++) { const ang = k * 2.4 + t * 0.3, rr = r * 0.65 * apN(k + 2); ctx.fillRect(Math.round(X + Math.cos(ang) * rr) - 2, Math.round(y + Math.sin(ang) * rr) - 1, 4, 3); }
    ctx.strokeStyle = '#fff0a0'; ctx.lineWidth = 1.5;
    for (let k = 0; k < n; k++) {
      const c = cracks[k], m = Math.min(c.length, Math.round(c.length * crack * (0.7 + 0.3 * apN(k))));
      if (m < 2) continue;
      ctx.beginPath();
      for (let s = 0; s < m; s++) { const [px, py] = c[s]; if (s) ctx.lineTo(X + px, y + py); else ctx.moveTo(X + px, y + py); }
      ctx.stroke();
    }
    ctx.restore();
  });
  aFx(a, 0, life, (u) => {
    const t = u * life;
    apGroundGlow(-40, W + 40, segU(t, BREAK + 0.6, BREAK + 1.0) * (1 - segU(t, fin + 0.3, life)) * 0.7, 26);
    if (t < BREAK) return;
    // 쪼개진 조각들: 검붉은 몸에 녹은 테두리, 떨어지는 동안 불꼬리를 끈다
    for (const f of frags) {
      if (f.done) continue;
      const P = fragPos(f, t);
      if (t > f.t1) { const P0 = fragPos(f, t - 0.05); apFireball(P.x, P.y, P.x - P0.x, (P.y - P0.y) || 1, 4, 0.8, false); }
      const sc = t > f.t1 ? mix(1, 0.55, segU(t, f.t1, f.land)) : 1, ox = Math.cos(f.mid) * R * 0.5, oy = Math.sin(f.mid) * R * 0.5;
      ctx.save();
      ctx.translate(Math.round(P.x), Math.round(P.y)); ctx.rotate(P.ang); ctx.scale(sc, sc);
      ctx.beginPath();
      f.pts.forEach(([px, py], j) => (j ? ctx.lineTo(px - ox, py - oy) : ctx.moveTo(px - ox, py - oy)));
      ctx.closePath();
      ctx.fillStyle = '#7a1408'; ctx.fill();
      ctx.strokeStyle = '#ffb02e'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#fff0a0'; ctx.lineWidth = 0.8; ctx.stroke();
      // 속은 아직 녹아 있다: 안쪽 작은 용암 덩어리
      ctx.scale(0.5, 0.5);
      ctx.beginPath();
      f.pts.forEach(([px, py], j) => (j ? ctx.lineTo(px - ox, py - oy) : ctx.moveTo(px - ox, py - oy)));
      ctx.closePath();
      ctx.fillStyle = '#ff5a1f'; ctx.fill();
      ctx.restore();
      if (t >= f.land) { f.done = true; apBlast(a, f.lx, 24); impact({ shake: 0.12 }); }
    }
    // 남은 심: 하얗게 달아올라 조금씩 오그라들다가, 마지막에 빛을 빨아들이며 한 점이 된다
    if (t >= fin) return;
    const shrink = segU(t, fin - 0.45, fin), r = mix(R * 0.42, 1.5, easeIn(shrink)) + Math.sin(t * 40) * 0.8;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,140,60,${0.4 + 0.4 * shrink})`;
    ctx.beginPath(); ctx.arc(X, Y, r * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fff8dc'; ctx.beginPath(); ctx.arc(X, Y, Math.max(1, r), 0, Math.PI * 2); ctx.fill();
    if (shrink > 0) {
      // 하단바 곳곳의 빛이 선이 되어 심으로 빨려 든다
      ctx.strokeStyle = `rgba(255,200,120,${0.8 * shrink})`; ctx.lineWidth = 1;
      for (let k = 0; k < 22; k++) {
        const ang = k * 0.2856 + t * 2, far = 40 + 200 * (1 - ((t * 3 + apN(k)) % 1)), near = far * 0.55;
        ctx.beginPath(); ctx.moveTo(X + Math.cos(ang) * far, Y + Math.sin(ang) * far * 0.6); ctx.lineTo(X + Math.cos(ang) * near, Y + Math.sin(ang) * near * 0.6); ctx.stroke();
      }
    }
    ctx.restore();
  });
}
// ★★ 잔타: 심에서 떨어져 나온 작은 불조각이 대상에게 꽂힌다
function apShardAt(a, tx, ty, big) {
  const C = a.apCore || { X: tx, Y: 30 }, life = 0.15;
  aFx(a, 0, life, (u) => {
    const p = easeIn(u);
    apFireball(mix(C.X, tx, p), mix(C.Y, ty, p), tx - C.X, ty - C.Y, big ? 5 : 3, 1, true);
  }, () => { apBlast(a, tx, big ? 26 : 16); hitFx(tx, ty, '#ff5a1f', big ? 2.2 : 1.3); });
}
// ★★ 마무리: 오그라든 심이 터진다 — 하단바 전체를 휩쓰는 충격파, 땅이 한꺼번에 불붙고 불티가 쏟아진다
function apCoreNova(a) {
  const C = a.apCore, gy = groundY(), life = 1.1, n = Math.ceil((W + 40) / 12);
  aFx(a, 0, 0.25, (u) => dimBand(0.75 * (1 - u), '255,210,170'));
  aFx(a, 0, life, (u) => {
    const r = 10 + (W + 200) * easeOut(clamp01(u * 1.4)), f = 1 - u;
    ctx.save();
    ctx.globalAlpha = f;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4 * f + 1;
    ctx.beginPath(); ctx.ellipse(C.X, C.Y, r, r * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ff5a1f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(C.X, C.Y, r * 0.8, r * 0.44, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    for (let i = 0; i < n; i++) {
      const x = -20 + i * 12;
      if (Math.abs(x - C.X) < r) apFlame(x, gy, (14 + 22 * apN(i + 7)) * f, 9, clock, i + 3, f);
    }
  });
  for (let k = 0; k < 50; k++) parts.push({ x: C.X + rand(-6, 6), y: C.Y + rand(-6, 6), vx: rand(-360, 360), vy: rand(-160, 200), g: 220, size: k % 4 ? 2 : 3, color: ['#ffffff', '#fff0a0', '#ffb02e', '#ff3b1f'][k % 4], life: rand(0.6, 1.1), t: 0, add: true });
}

// ── ★★★ 세계의 끝: 불바다 → 하늘이 갈라짐 → 하얀 겁화가 끝에서 끝까지 ──
function apEndStage(a) {
  const d = a.k.dur, hits = a.k.hits.map((h) => h[0] * d), fin = hits[hits.length - 1], open = hits[hits.length - 2], life = d + 1.0, gy = groundY();
  const x0 = a.x(), STEP = 9, n = Math.ceil((W + 60) / STEP), CRACK = 1.75, wallFrom = open + 0.04;
  const startX = a.dir > 0 ? -50 : W + 50, endX = a.dir > 0 ? W + 50 : -50;
  // 하늘의 금: 하단바 위쪽을 가로지르는 지그재그 (가운데서 양쪽 끝으로 달린다)
  const cx = apMid(a, 40), crack = [];
  for (let x = -20; x <= W + 20; x += 10) crack.push([x, 26 + Math.round(rand(-5, 5) + 3 * Math.sin(x * 0.05))]);
  const wallX = (t) => { const p = segU(t, wallFrom, fin); return mix(startX, endX, p * p * (3 - 2 * p)); };
  a.apEnd = { crack };
  backFx(a, 0, life, (u) => {
    const t = u * life, ramp = easeOut(clamp01(t / 0.8)), out = 1 - segU(t, fin + 0.4, life);
    dimBand(0.78 * ramp * out, '22,2,0');
    // 하늘 전체가 불바다의 빛을 받아 아래에서부터 붉게 달아오른다
    ctx.save();
    const g = ctx.createLinearGradient(0, 16, 0, gy);
    g.addColorStop(0, `rgba(60,0,0,${0.3 * ramp * out})`); g.addColorStop(1, `rgba(255,70,10,${0.5 * segU(t, 0.3, 1.2) * out})`);
    ctx.fillStyle = g; ctx.fillRect(-60, 0, W + 120, H);
    ctx.restore();
    // 하늘의 금: 처음엔 가는 실금, 열리면 하얀 틈이 벌어지고 그 아래로 빛살이 내려온다
    if (t > CRACK && t < fin + 0.3) {
      const grow = easeOut(segU(t, CRACK, CRACK + 0.5)), gap = 9 * easeOut(segU(t, open - 0.05, open + 0.2)), fade = 1 - segU(t, fin, fin + 0.3);
      const vis = crack.filter(([x]) => Math.abs(x - cx) <= grow * (W + 40));
      if (vis.length > 1) {
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.globalCompositeOperation = 'lighter';
        // 빛살: 가늘고, 아래로 갈수록 세 마디에 걸쳐 흐려진다
        const ra = 0.22 + 0.3 * segU(t, open - 0.3, open);
        for (const [x, y] of vis) {
          if (apN(x) >= 0.5) continue;
          const len = (40 + 60 * apN(x + 2)) * (0.6 + 0.4 * Math.sin(t * 12 + x)), w = 1 + Math.round(apN(x + 1) * 2);
          for (let s = 0; s < 3; s++) { ctx.fillStyle = `rgba(255,230,180,${ra * (1 - s / 3)})`; ctx.fillRect(x, Math.round(y + len * s / 3), w, Math.round(len / 3)); }
        }
        ctx.globalCompositeOperation = 'source-over';
        if (gap > 0.5) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          vis.forEach(([x, y], j) => (j ? ctx.lineTo(x, y - gap * 0.5 * (0.6 + 0.4 * apN(x))) : ctx.moveTo(x, y - gap * 0.5)));
          for (let j = vis.length - 1; j >= 0; j--) { const [x, y] = vis[j]; ctx.lineTo(x, y + gap * 0.5 * (0.6 + 0.4 * apN(x + 3))); }
          ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = '#fff8dc'; ctx.lineWidth = 1.5;
        ctx.beginPath(); vis.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        ctx.restore();
      }
    }
  });
  // 불바다 (앞 레이어 — 기사와 적의 발을 삼킨다) + 하얀 겁화의 벽
  aFx(a, 0, life, (u) => {
    const t = u * life, reach = easeOut(segU(t, 0.12, 1.0)) * (W + 100), out = 1 - segU(t, fin + 0.5, life);
    const wx = wallX(t), wallOn = t > wallFrom;
    apGroundGlow(Math.max(-40, x0 - reach), Math.min(W + 40, x0 + reach), out, 50);
    for (let i = 0; i < n; i++) {
      const x = -30 + i * STEP, far = Math.abs(x - x0);
      if (far > reach) continue;
      if (wallOn && (x - wx) * a.dir < 0) continue;            // 하얀 벽이 지나간 자리는 하얀 불이 그린다
      const lit = clamp01((reach - far) / 40), tall = 1 + 0.7 * segU(t, 1.0, 2.4);
      apFlame(x, gy + 2, (10 + 18 * apN(i)) * lit * tall * out, 8, t, i, 0.92 * out);
    }
    if (!wallOn) return;
    // 하얀 겁화의 벽: 지나간 자리는 하얗게 타오르고, 앞머리는 하단바 위까지 치솟는 불의 파도
    const fade = 1 - segU(t, fin + 0.15, life), w0 = Math.min(startX, wx), w1 = Math.max(startX, wx);
    ctx.save();
    ctx.fillStyle = `rgba(255,248,230,${0.55 * fade})`; ctx.fillRect(w0, 0, w1 - w0, H);
    ctx.globalCompositeOperation = 'lighter';
    const eg = ctx.createLinearGradient(wx - a.dir * 60, 0, wx + a.dir * 30, 0);
    eg.addColorStop(0, `rgba(255,255,240,${0.7 * fade})`); eg.addColorStop(0.7, `rgba(255,200,80,${0.6 * fade})`); eg.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = eg; ctx.fillRect(Math.min(wx - a.dir * 60, wx + a.dir * 30), 0, 90, H);
    ctx.restore();
    for (let i = 0; i < n; i++) {
      const x = -30 + i * STEP, behind = (wx - x) * a.dir;
      if (behind < 0) continue;
      const crest = Math.max(0, 1 - behind / 90);
      apFlame(x, gy + 2, (40 + 50 * apN(i + 11) + 70 * crest) * fade, 12 + 6 * crest, t, i + 50, fade, AP_WHITE);
    }
  }, null, (u) => {
    const t = u * life;
    // 불바다 위로 불티가 피어오른다
    if (t > 0.3 && t < fin && Math.random() < 0.9) {
      const reach = easeOut(segU(t, 0.12, 1.0)) * (W + 100);
      parts.push({ x: x0 + rand(-reach, reach), y: gy - rand(4, 20), vx: rand(-15, 15), vy: rand(-110, -40), g: -40, size: Math.random() < 0.3 ? 3 : 2, color: AP_FIRE[Math.floor(rand(0, 3))], life: rand(0.5, 1), t: 0, add: true });
    }
    if (t > wallFrom && t < fin) {
      const wx = wallX(t);
      for (let k = 0; k < 2; k++) parts.push({ x: wx + rand(-10, 10), y: rand(20, gy), vx: a.dir * rand(120, 260), vy: rand(-80, 20), g: 0, size: 3, color: Math.random() < 0.6 ? '#ffffff' : '#ffe9a8', life: 0.35, t: 0, add: true });
    }
  });
}
// ★★★ 잔타: 불바다에서 대상 발밑으로 불기둥이 솟는다
function apGeyser(a, tx, big) {
  const gy = groundY(), life = 0.5, hgt = big ? 120 : 80;
  aFx(a, 0, life, (u) => {
    const up = easeOut(clamp01(u * 4)), f = 1 - easeIn(u);
    apFlame(tx, gy + 2, hgt * up * (0.6 + 0.4 * f), big ? 22 : 15, clock, tx, f);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,240,200,${0.6 * (1 - segU(u, 0.1, 0.4))})`; ctx.fillRect(Math.round(tx) - 2, Math.round(gy - hgt * up), 4, Math.round(hgt * up));
    ctx.restore();
  });
  for (let k = 0; k < 8; k++) parts.push({ x: tx + rand(-6, 6), y: gy - 10, vx: rand(-40, 40), vy: rand(-320, -180), g: 380, size: 2, color: k % 2 ? '#ffb02e' : '#fff0a0', life: rand(0.4, 0.7), t: 0, add: true });
}
// ★★★ 하늘이 열리는 순간: 틈에서 하얀 겁화가 대상마다 내리꽂힌다
function apSkyFall(a, tx) {
  const E = a.apEnd, gy = groundY(), life = 0.45;
  const y0 = E ? E.crack[Math.max(0, Math.min(E.crack.length - 1, Math.round((tx + 20) / 10)))][1] : 26;
  aFx(a, 0, life, (u) => {
    const p = easeOut(clamp01(u * 5)), f = 1 - u, y1 = mix(y0, gy, p), w = 14 * f + 4;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,220,140,${0.5 * f})`; ctx.fillRect(Math.round(tx - w), y0, Math.round(w * 2), Math.round(y1 - y0));
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(255,255,255,${f})`; ctx.fillRect(Math.round(tx - w * 0.35), y0, Math.round(w * 0.7), Math.round(y1 - y0));
    ctx.restore();
  });
  apBlast(a, tx, 30, true);
}

// 대마도사 궁극기 자세: 지팡이를 머리 위로 치켜들고 (★ 이상은 떠올라) 마력을 모았다가, 마지막에 앞으로 내리친다
function apPose(u, a) {
  const m = (a && a.mast) || 0, D = a && a.k ? a.k.dur : 2.7, t = u * D;
  const hits = a && a.k ? a.k.hits : [[0.5], [0.9]], first = hits[0][0] * D, fin = hits[hits.length - 1][0] * D;
  const up = easeOut(clamp01(t / 0.35)), hover = m ? (m >= 2 ? 8 : 5) * easeOut(segU(t, 0.2, 1.0)) + Math.sin(t * 5) * 1.2 * up : 0;
  const charge = 13 * easeOut(segU(t, 0.1, first));
  if (t < fin - 0.3) {
    const pulse = t > first ? 2 * Math.sin(t * 30) : 0;
    return { bowA: mix(0, -0.25, up), pull: Math.min(13, charge + pulse), lift: hover, sy: mix(1, 1.04, up) };
  }
  if (t < fin) {
    const w = easeOut(segU(t, fin - 0.3, fin - 0.05));
    return { bowA: mix(-0.25, -0.45, w), pull: 13, lift: hover + 2 * w, sy: 1.05, skew: -0.08 * w };
  }
  const r = easeOut(segU(t, fin, fin + 0.1));
  return { bowA: mix(-0.45, 0.65, r), pull: 13 * (1 - r), lift: hover * (1 - r * 0.6), sy: mix(1.05, 0.93, r), skew: 0.12 * r, dx: 3 * r };
}

Object.assign(SKILL_FX, {
  apocalypse: {
    pose: apPose,
    cues: (a) => {
      const m = a.mast, d = a.k.dur, fin = a.k.hits[a.k.hits.length - 1][0] * d;
      const list = [[0, m === 0 ? apRainStage : m === 1 ? apCircleStage : m === 2 ? apSunStage : apEndStage]];
      if (m === 1) list.push([(fin - 0.5) / d, (a) => apGreatMeteor(a, 0.5)]);
      return list;
    },
    hit(a, i, n) {
      const m = a.mast, last = i === n - 1, tg = a.targets(i);
      if (m === 0) {
        if (last) {
          apRainFinish(a);
          for (const t of tg) { hitFx(t.x, t.y, '#ff7a2a', 2.6); burst(t.x, t.y, 24, AP_FIRE, 200, 2, 200); }
          impact({ stop: 0.2, shake: 0.55 });
          return;
        }
        a.apRainBoost = 1;
        for (const t of tg) for (let k = 0; k < 3; k++) apBigDrop(a, t.x + rand(-8, 8), t.y + rand(-6, 6), 3, k * 0.04, k ? null : () => hitFx(t.x, t.y, '#ff7a2a', 1.5));
        impact({ shake: 0.18 });
        return;
      }
      if (m === 1) {
        if (last) {
          apGreatBlast(a, apCenter(a));
          for (const t of tg) hitFx(t.x, t.y, '#fff0a0', 3);
          impact({ stop: 0.26, shake: 0.7 });
          return;
        }
        for (const t of tg) apMeteorAt(a, t.x + rand(-6, 6), t.y + rand(-4, 4), 4);
        skLater(a, 0.14, () => impact({ shake: 0.16 }));
        return;
      }
      if (m === 2) {
        if (last) {
          apCoreNova(a);
          for (const t of tg) { hitFx(t.x, t.y, '#ffffff', 3); burst(t.x, t.y, 30, AP_FIRE, 230, 3, 120); }
          impact({ stop: 0.28, shake: 0.75 });
          return;
        }
        for (const t of tg) apShardAt(a, t.x + rand(-6, 6), t.y + rand(-4, 4), i % 3 === 2);
        skLater(a, 0.15, () => impact({ shake: i % 3 === 2 ? 0.25 : 0.12 }));
        return;
      }
      // ★★★
      if (last) {
        const gy = groundY();
        aFx(a, 0, 1.0, (u) => dimBand(u < 0.08 ? u / 0.08 : 1 - easeOut(segU(u, 0.15, 1)), '255,252,240'));
        for (const t of tg) { hitFx(t.x, t.y, '#ffffff', 3.2); burst(t.x, t.y, 36, AP_WHITE, 260, 3, 80); }
        for (let k = 0; k < 40; k++) parts.push({ x: rand(0, W), y: gy - rand(0, 80), vx: a.dir * rand(60, 200), vy: rand(-200, -40), g: 100, size: k % 3 ? 2 : 3, color: AP_WHITE[k % 4], life: rand(0.6, 1.2), t: 0, add: true });
        impact({ stop: 0.32, shake: 0.85 });
        return;
      }
      if (i === n - 2) {
        // 하늘이 열린다
        aFx(a, 0, 0.2, (u) => dimBand(0.5 * (1 - u), '255,245,220'));
        for (const t of tg) { apSkyFall(a, t.x); hitFx(t.x, t.y, '#fff8dc', 2.6); }
        impact({ stop: 0.18, shake: 0.6 });
        return;
      }
      for (const t of tg) { apGeyser(a, t.x + rand(-5, 5), i % 4 === 3); hitFx(t.x, t.y, '#ff7a2a', 1.4); }
      // 대상 말고도 불바다 곳곳에서 불기둥이 함께 솟는다
      apGeyser(a, rand(10, W - 10), false);
      impact({ shake: 0.15 });
    },
    kb: 12,
  },
});
