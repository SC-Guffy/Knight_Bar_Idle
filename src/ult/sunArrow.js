'use strict';
// 3차 궁극기 「태양 관통」 연출 (deadeye). 수치·단계는 src/classes.js 의 SKILLS.sunArrow, 공통 레터박스·컷인은 src/skills.js 의 drawUltScreen.
//  Lv1 「일점 사격」 하단바가 어두워지고 조준선이 사방에서 한 점으로 모인다 — 빛의 화살 한 줄기가 하단바 끝까지 꿰뚫는다
//  ★   「태양 관통」 하늘로 쏜 화살이 태양을 꿰뚫고 — 태양빛이 굵은 광선이 되어 땅을 긋고 하단바 끝까지 달린다
//  ★★  「천벌의 화살」 하늘 가득 화살 그림자가 떠오르고, 태양 광선이 하단바를 쓸고 지나가면 그 뒤로 화살비가 쏟아진다
//  ★★★ 「태양 낙하」 하늘이 붉게 저물고 거대한 태양이 하단바로 떨어져 내린다 — 홍염이 적을 휘감고, 빛이 하단바를 하얗게 태운 뒤 열기가 일렁인다
// 시전 내내 이어지는 큰 그림은 시전 시작에 한 번 만든 연출(뒤 레이어 하늘·태양 / 앞 레이어 조준선·광선·열기)이 시간표대로 그리고,
// 타격 순간(hit)은 그 자리에 꽂히는 빛만 더한다.

const SA_UP = [0, 0.95, 0.95, 0.9];        // ★ 이상: 하늘로 화살을 쏘아 올리는 시점(초)
const SA_PIERCE = 0.2;                     // 쏘아 올린 화살이 태양에 닿기까지(초)

// 대상들의 가운데 x
function saCenter(a) {
  const t = a.targets();
  return t.length ? t.reduce((s, p) => s + p.x, 0) / t.length : a.tx();
}
const saEdge = (a) => (a.dir > 0 ? W + 40 : -40);

// 태양 한 덩이: 바깥 햇무리 → 천천히 도는 도트 햇살 → 하얀 심의 원반
function saSun(x, y, r, t, al = 1, rays = 1) {
  if (r < 1 || al <= 0) return;
  ctx.save();
  ctx.globalAlpha = al;
  ctx.globalCompositeOperation = 'lighter';
  let g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.8);
  g.addColorStop(0, 'rgba(255,190,70,0.6)'); g.addColorStop(0.4, 'rgba(255,140,40,0.22)'); g.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 2.8, y - r * 2.8, r * 5.6, r * 5.6);
  if (rays > 0) {
    const n = 18, step = Math.max(3, r / 9);
    for (let i = 0; i < n; i++) {
      const ang = t * 0.5 + (i / n) * Math.PI * 2, len = r * (1.3 + 0.25 * Math.sin(t * 6 + i * 1.7) + (i % 2 ? 0 : 0.45)) * rays;
      for (let s = r * 1.05; s < len; s += step) {
        const f = 1 - (s - r) / Math.max(1, len - r);
        ctx.fillStyle = `rgba(255,${200 + 40 * f | 0},${90 + 60 * f | 0},${0.55 * f})`;
        const q = s < r * 1.4 ? 3 : 2;
        ctx.fillRect(Math.round(x + Math.cos(ang) * s - q / 2), Math.round(y + Math.sin(ang) * s - q / 2), q, q);
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.05, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#fff4b8'); g.addColorStop(0.78, '#ffc43a'); g.addColorStop(1, '#ff7a1a');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
// 거대한 태양의 겉면: 끓어오르는 쌀알 무늬와 테두리에서 고리처럼 솟는 홍염
function saSunSurface(x, y, r, t, al = 1) {
  ctx.save();
  ctx.globalAlpha = al;
  for (let i = 0; i < 70; i++) {
    const ang = i * 2.39996, rr = r * Math.sqrt((i * 0.618) % 1) * 0.92;
    const px = x + Math.cos(ang + t * 0.15) * rr, py = y + Math.sin(ang + t * 0.15) * rr;
    if (Math.sin(t * 9 + i * 3.1) < 0.2) continue;
    ctx.fillStyle = i % 3 ? 'rgba(255,150,40,0.45)' : 'rgba(255,255,230,0.6)';
    const q = 3 + (i % 2) * 3;
    ctx.fillRect(Math.round(px - q / 2), Math.round(py - q / 2), q, q);
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const ang = i * 1.05 + t * 0.4, h = r * (0.18 + 0.12 * Math.sin(t * 3 + i * 2));
    const bx = x + Math.cos(ang) * r, by = y + Math.sin(ang) * r;
    ctx.strokeStyle = i % 2 ? 'rgba(255,90,30,0.75)' : 'rgba(255,170,60,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(bx + Math.cos(ang) * h * 0.4, by + Math.sin(ang) * h * 0.4, h, ang + Math.PI * 0.85, ang + Math.PI * 2.15); ctx.stroke();
  }
  ctx.restore();
}
// 굵은 태양 광선: 주황 번짐 → 금빛 몸통 → 하얀 심, 그 위로 빛 마디가 흐른다
function saBeam(x0, y0, x1, y1, w, al, t) {
  if (w < 0.5 || al <= 0) return;
  const L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L;
  const line = () => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  ctx.save();
  ctx.globalAlpha = al;
  ctx.lineCap = 'butt';
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255,120,30,0.3)'; ctx.lineWidth = w * 2.4; line();
  ctx.strokeStyle = 'rgba(255,200,70,0.75)'; ctx.lineWidth = w; line();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = '#fffbe8'; ctx.lineWidth = Math.max(1, w * 0.4); line();
  ctx.fillStyle = '#ffffff';
  for (let k = 0; k < 10; k++) {
    const s = (t * 700 + k * L / 10) % L, off = Math.sin(k * 7.3 + t * 30) * w * 0.45;
    ctx.fillRect(Math.round(x0 + ux * s - uy * off) - 2, Math.round(y0 + uy * s + ux * off) - 1, 4, 2);
  }
  ctx.restore();
}
// 화살 한 자루 (도트): x, y 는 화살촉 끝
function saArrow(x, y, ang, len, body, head, al = 1) {
  if (al <= 0) return;
  ctx.save();
  ctx.globalAlpha = al;
  ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(ang);
  ctx.fillStyle = body;
  ctx.fillRect(-len, -1, len - 4, 2);
  ctx.fillRect(-len - 2, -3, 5, 2); ctx.fillRect(-len - 2, 1, 5, 2);
  ctx.fillStyle = head;
  ctx.fillRect(-6, -3, 3, 6); ctx.fillRect(-3, -2, 2, 4); ctx.fillRect(-1, -1, 1, 2);
  ctx.restore();
}
// 열기 아지랑이: 지금까지 그린 하단바를 가로줄마다 좌우로 일렁이게 옮겨 그린다 (탑 안에서는 쓰지 않는다)
const saHazeCv = document.createElement('canvas');
function saHaze(amp, t) {
  if (amp < 0.3 || (typeof towerInside === 'function' && towerInside())) return;
  const cv = ctx.canvas;
  if (!cv || !cv.width || !cv.height) return;
  if (saHazeCv.width !== cv.width || saHazeCv.height !== cv.height) { saHazeCv.width = cv.width; saHazeCv.height = cv.height; }
  const g = saHazeCv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  g.drawImage(cv, 0, 0);
  const sc = cv.height / H, band = Math.max(1, Math.round(3 * sc));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let y = 0; y < cv.height; y += band) {
    const gyy = y / sc, off = Math.round(Math.sin(gyy * 0.21 + t * 13) * Math.sin(gyy * 0.05 - t * 3) * amp * sc);
    if (!off) continue;
    ctx.clearRect(0, y, cv.width, band);
    ctx.drawImage(saHazeCv, 0, y, cv.width, band, off, y, cv.width, band);
  }
  ctx.restore();
}
// 노을 하늘: 하단바를 어둡게 물들이고 위쪽은 주황빛으로 (뒤 레이어)
function saDusk(dark, glow, rgb = '24,8,0') {
  if (dark > 0) dimBand(dark, rgb);
  if (glow <= 0) return;
  ctx.save();
  const g = ctx.createLinearGradient(0, 16, 0, H - 16);
  g.addColorStop(0, `rgba(255,150,50,${0.55 * glow})`); g.addColorStop(0.55, `rgba(255,90,30,${0.18 * glow})`); g.addColorStop(1, 'rgba(255,60,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-60, 0, W + 120, H);
  ctx.restore();
}
// 하늘로 쏘아 올린 화살이 태양에 꽂히는 순간: 하얀 고리 + 햇살이 터진다
function saPierceFx(a, sx, sy, size) {
  aFx(a, 0, 0.5, (u) => {
    ctx.save();
    ctx.globalAlpha = 1 - u;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * (1 - u) + 1;
    ctx.beginPath(); ctx.arc(sx, sy, size * (1 + 2.5 * easeOut(u)), 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sx, sy, size * (1.6 + 4 * easeOut(u)), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  });
  burst(sx, sy, 24, ['#ffffff', '#ffe066', '#ff9a2e'], 170, 2, 0);
  impact({ shake: 0.2 });
}
// 하늘로 쏘아 올리는 빛 화살 (손 → 하늘의 한 점)
function saShootUp(a, sx, sy, life = SA_PIERCE) {
  const h = hand(a), x0 = h.x + a.dir * 4, y0 = h.y - 6;
  aFx(a, 0, life + 0.25, (u) => {
    const t = u * (life + 0.25), p = clamp01(t / life), x = mix(x0, sx, p), y = mix(y0, sy, p);
    const tail = clamp01(p - 0.35);
    ctx.save();
    ctx.globalAlpha = p >= 1 ? 1 - (t - life) / 0.25 : 1;
    ctx.strokeStyle = 'rgba(255,224,102,0.6)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(mix(x0, sx, tail), mix(y0, sy, tail)); ctx.lineTo(x, y); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(mix(x0, sx, tail), mix(y0, sy, tail)); ctx.lineTo(x, y); ctx.stroke();
    ctx.restore();
    if (p < 1) saArrow(x, y, Math.atan2(sy - y0, sx - x0), 14, '#fff3b0', '#ffffff');
  });
  burst(x0, y0, 10, ['#ffffff', '#ffe066'], 80, 2, 0);
  impact({ shake: 0.12 });
}

// ── Lv1 일점 사격 ──
function saAimStage(a) {
  const d = a.k.dur, T = a.k.hits[0][0] * d, life = d + 0.4;
  backFx(a, 0, life, (u) => {
    const t = u * life;
    dimBand(t < T ? 0.62 * easeOut(clamp01(t / 0.55)) : 0.62 * (1 - segU(t, T + 0.1, T + 0.7)), '6,4,2');
  });
  aFx(a, 0, T, (u) => {
    const t = u * T, p = easeOut(segU(t, 0.15, T - 0.2)), lock = t > T - 0.28;
    const x = a.tx(), y = a.ty() - 4, al = Math.min(1, t / 0.25);
    const col = lock ? (Math.sin(clock * 50) > 0 ? '#ff4a3a' : '#ffffff') : '#ffe066';
    ctx.save();
    ctx.globalAlpha = 0.55 * al;
    ctx.fillStyle = col;
    // 화면 끝에서 끝까지 이어진 조준선 네 줄이 사방에서 모여든다
    const oy = (1 - p) * 46, ox = (1 - p) * 190;
    ctx.fillRect(-20, Math.round(y - oy), W + 40, 1); ctx.fillRect(-20, Math.round(y + oy * 0.8), W + 40, 1);
    ctx.fillRect(Math.round(x - ox), 0, 1, H); ctx.fillRect(Math.round(x + ox), 0, 1, H);
    // 대각선 두 줄 (하단바 모서리에서 과녁으로)
    ctx.globalAlpha = 0.25 * al * p;
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(a.dir > 0 ? W : 0, 16); ctx.lineTo(x, y); ctx.lineTo(a.dir > 0 ? W : 0, H - 16); ctx.stroke();
    // 눈금: 조준선을 따라 거리 눈금이 흐른다
    ctx.globalAlpha = 0.45 * al;
    for (let k = -12; k <= 12; k++) { const tx = x + k * 14 + ((t * 40) % 14); ctx.fillRect(Math.round(tx), Math.round(y - oy) - (k % 4 ? 1 : 3), 1, k % 4 ? 2 : 6); }
    // 과녁 원: 좁혀지며 돈다
    const r = mix(44, 9, p);
    ctx.globalAlpha = 0.9 * al;
    ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r + 6, t * 3, t * 3 + 1.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r + 6, t * 3 + Math.PI, t * 3 + Math.PI + 1.2); ctx.stroke();
    for (let k = 0; k < 4; k++) { const ang = k * Math.PI / 2 - t * 2; ctx.fillRect(Math.round(x + Math.cos(ang) * (r + 2)) - 1, Math.round(y + Math.sin(ang) * (r + 2)) - 1, 3, 3); }
    if (lock) { ctx.fillStyle = '#ff3b3b'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5); }
    ctx.restore();
    // 시위 끝에 빛이 모여 별처럼 반짝인다
    const h = hand(a), s = 4 + 10 * p + (lock ? 3 * Math.sin(clock * 40) : 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = al;
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(Math.round(h.x + a.dir * 8 - s), Math.round(h.y) - 1, Math.round(s * 2), 2);
    ctx.fillRect(Math.round(h.x + a.dir * 8) - 1, Math.round(h.y - s * 0.6), 2, Math.round(s * 1.2));
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(h.x + a.dir * 8) - 2, Math.round(h.y) - 2, 4, 4);
    ctx.restore();
  }, null, () => {
    if (Math.random() < 0.5) {
      const h = hand(a), ang = rand(0, Math.PI * 2), r = rand(24, 40);
      parts.push({ x: h.x + a.dir * 8 + Math.cos(ang) * r, y: h.y + Math.sin(ang) * r, vx: -Math.cos(ang) * r * 3, vy: -Math.sin(ang) * r * 3, g: 0, size: 2, color: Math.random() < 0.5 ? '#ffe066' : '#ffffff', life: 0.3, t: 0, add: true });
    }
  });
}
// Lv1 의 한 발: 빛의 화살이 손에서 하단바 끝까지 한순간에 꿰뚫는다
function saLightArrowFx(a) {
  const h = hand(a), x0 = h.x + a.dir * 8, y0 = h.y, end = saEdge(a), life = 0.75;
  aFx(a, 0, life, (u) => {
    const t = u * life, hp = easeOut(clamp01(t / 0.1)), hx = mix(x0, end, hp);
    if (t < 0.1) dimBand(0.35 * (1 - t / 0.1), '255,246,214');
    const w = 16 * (1 - easeIn(segU(t, 0.08, life)));
    saBeam(x0, y0, hx, y0, w, 1 - segU(t, 0.5, life), t);
    ctx.save();
    // 하단바를 가로지르는 하얀 섬광 한 줄
    ctx.globalAlpha = 0.8 * (1 - segU(t, 0, 0.3));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-20, Math.round(y0) - 1, W + 40, 2);
    // 시위에서 터지는 세로 충격파
    ctx.globalAlpha = 1 - u;
    ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2;
    for (const k of [0.5, 1]) { ctx.beginPath(); ctx.ellipse(x0 + a.dir * 34 * easeOut(u) * k, y0, 3 + 6 * u, 10 + 34 * easeOut(u) * k, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    if (t < 0.1) saArrow(hx, y0, a.dir > 0 ? 0 : Math.PI, 26, '#ffffff', '#ffffff');
  });
  for (let i = 0; i < 10; i++) parts.push({ x: a.x(), y: groundY() - 2, vx: -a.dir * rand(60, 160), vy: rand(-70, -10), g: 200, size: 3, color: '#c9b38a', life: 0.4, t: 0 });
}

// ── ★ 태양 관통 ──
// 태양 자리: 기사 머리 위 조금 뒤 (광선이 비스듬히 내리꽂히게)
function saSunPos(a, m) {
  const x = a.x() - a.dir * (m >= 2 ? 30 : 10);
  return { x: Math.max(30, Math.min(W - 30, x)), y: m >= 2 ? 32 : 36 };
}
// 태양에서 대상을 지나 땅에 닿는 점
function saGroundHit(sx, sy, px, py) {
  const gy = groundY() - 4, k = (gy - sy) / Math.max(1, py - sy);
  return { x: sx + (px - sx) * k, y: gy };
}
function saSunStage(a) {
  const d = a.k.dur, m = a.mast, up = SA_UP[m], hit = a.k.hits[0][0] * d, last = a.k.hits[a.k.hits.length - 1][0] * d, life = d + 0.5;
  const S = saSunPos(a, m);
  a.saPulse = 0;
  backFx(a, 0, life, (u) => {
    const t = u * life, ramp = easeOut(clamp01(t / 0.8)), out = 1 - segU(t, last + 0.15, life);
    saDusk(0.5 * ramp * out, ramp * out);
    // 태양: 천천히 떠올라 커지고, 꿰뚫린 뒤엔 하얗게 끓어오르다 광선을 뿜고 줄어든다
    const pierced = up + SA_PIERCE, charge = segU(t, pierced, hit);
    let r = mix(8, 15, easeOut(clamp01(t / up)));
    if (t > pierced) r = mix(15, 22, easeOut(charge)) + (t < hit ? Math.sin(clock * 40) * 1.2 * charge : 0);
    if (t > hit) r = mix(22, 12, segU(t, hit, last + 0.4)) + a.saPulse * 4;
    saSun(S.x, S.y, r, t, Math.min(1, t / 0.4) * out, t > pierced ? 1 + charge * 0.8 : 0.7);
    if (t > pierced && t < hit) {
      // 꿰뚫린 자리에서 갈라지는 하얀 금
      ctx.save();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.9;
      for (let k = 0; k < 5; k++) {
        const ang = k * 1.26 + 0.4, l = r * (0.4 + 0.6 * charge);
        ctx.beginPath(); ctx.moveTo(S.x, S.y);
        ctx.lineTo(S.x + Math.cos(ang) * l * 0.5 + Math.sin(k) * 2, S.y + Math.sin(ang) * l * 0.5); ctx.lineTo(S.x + Math.cos(ang + 0.2) * l, S.y + Math.sin(ang + 0.2) * l); ctx.stroke();
      }
      ctx.restore();
    }
  });
  // 대상을 지나 땅까지 내리꽂히는 광선 + 땅을 따라 하단바 끝까지 달리는 불 고랑
  aFx(a, 0, life, (u) => {
    const t = u * life;
    if (t < hit) return;
    const G = saGroundHit(S.x, S.y, a.tx(), a.ty() - 6), end = saEdge(a);
    const fade = 1 - segU(t, last + 0.1, last + 0.5), w = (26 + a.saPulse * 10) * (0.6 + 0.4 * fade);
    a.saPulse = Math.max(0, a.saPulse - 0.05);
    const gx = mix(G.x, end, easeOut(segU(t, hit, hit + 0.3))), gy = groundY();
    saBeam(S.x, S.y, G.x, G.y, w, fade, t);
    // 지나간 땅은 빛이 달린 뒤 붉게 달아올랐다 식는다
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const x0 = Math.min(G.x, gx), x1 = Math.max(G.x, gx);
    const gr = ctx.createLinearGradient(0, gy - 26, 0, gy);
    gr.addColorStop(0, 'rgba(255,120,30,0)'); gr.addColorStop(1, `rgba(255,170,60,${0.7 * fade})`);
    ctx.fillStyle = gr; ctx.fillRect(x0, gy - 26, x1 - x0, 26);
    ctx.fillStyle = `rgba(255,255,230,${fade})`; ctx.fillRect(x0, gy - 4, x1 - x0, 3);
    for (let x = x0; x < x1; x += 9) {
      const f = Math.sin(x * 0.7 + t * 25) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255,${150 + 80 * f | 0},50,${0.8 * fade})`;
      ctx.fillRect(Math.round(x), Math.round(gy - 6 - 10 * f), 3, Math.round(4 + 10 * f));
    }
    ctx.restore();
  }, null, (u) => {
    const t = u * life;
    if (t < hit || t > hit + 0.3) return;
    const G = saGroundHit(S.x, S.y, a.tx(), a.ty() - 6), gx = mix(G.x, saEdge(a), easeOut(segU(t, hit, hit + 0.3)));
    burst(gx, groundY() - 4, 2, ['#ffe066', '#ffffff'], 110, 2, 260);
  });
}

// ── ★★ 천벌의 화살: 하늘 가득 화살 그림자 → 태양 광선이 쓸고 지나가며 화살비 ──
function saRainStage(a) {
  const d = a.k.dur, hit = a.k.hits[0][0] * d, last = a.k.hits[a.k.hits.length - 1][0] * d, life = d + 0.5;
  const S = saSunPos(a, 2), x0 = a.x() + a.dir * 24, end = saEdge(a), sweepEnd = last + 0.05;
  const span = Math.abs(end - x0);
  // 화살 그림자: 하단바 위쪽에 줄지어 (기사 쪽부터 차례로 떠오른다)
  const n = Math.max(16, Math.round(W / 16)), arrows = [];
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n * W + rand(-5, 5), y = 22 + (i % 3) * 13 + rand(-3, 3);
    const far = clamp01((x - x0) * a.dir / span);
    arrows.push({ x, y, show: 0.25 + far * 0.8 + rand(0, 0.15), fall: hit + far * (sweepEnd - hit), ok: (x - x0) * a.dir > -20 });
  }
  const sweepX = (t) => mix(x0, end, segU(t, hit, sweepEnd));
  backFx(a, 0, life, (u) => {
    const t = u * life, ramp = easeOut(clamp01(t / 0.8)), out = 1 - segU(t, last + 0.2, life);
    saDusk(0.58 * ramp * out, ramp * out, '20,6,2');
    const pierced = SA_UP[2] + SA_PIERCE;
    let r = mix(8, 16, easeOut(clamp01(t / SA_UP[2])));
    if (t > pierced) r = mix(16, 24, easeOut(segU(t, pierced, hit)));
    saSun(S.x, S.y, r, t, Math.min(1, t / 0.4) * out, t > pierced ? 1.6 : 0.8);
  });
  aFx(a, 0, life, (u) => {
    const t = u * life, gy = groundY();
    for (const ar of arrows) {
      if (t < ar.show) continue;
      const k = clamp01((t - ar.show) / 0.2), bob = Math.sin(clock * 4 + ar.x) * 1.5;
      if (!ar.ok || t < ar.fall) {
        // 떠 있는 그림자 화살: 짙은 몸에 금빛 테두리가 가물거린다 (광선이 닿기 직전엔 금빛으로 달아오른다)
        const lit = ar.ok && t > ar.fall - 0.25, fade = ar.ok ? 1 : 1 - segU(t, hit, life);
        saArrow(ar.x + 1, ar.y + 14 + bob, Math.PI / 2 + a.dir * 0.12, 14, lit ? '#ffe066' : 'rgba(255,224,102,0.35)', lit ? '#ffffff' : 'rgba(255,224,102,0.5)', k * fade);
        saArrow(ar.x, ar.y + 13 + bob, Math.PI / 2 + a.dir * 0.12, 13, '#2a1608', '#3a2210', k * 0.85 * fade);
        continue;
      }
      // 광선이 지나간 그림자는 빛 화살로 바뀌어 땅에 꽂힌다
      const p = (t - ar.fall) / 0.16;
      if (p > 1) continue;
      const y = mix(ar.y + 13, gy - 4, easeIn(p)), x = ar.x + a.dir * 8 * p;
      ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = '#ffe066'; ctx.fillRect(Math.round(x - a.dir * 2), Math.round(y - 26), 1, 22); ctx.restore();
      saArrow(x, y, Math.PI / 2 + a.dir * 0.12, 16, '#fff3b0', '#ffffff');
      if (!ar.landed && p > 0.9) { ar.landed = true; burst(x, gy - 4, 4, ['#ffe066', '#ffffff', '#ff9a2e'], 90, 2, 260); }
    }
    if (t < hit || t > sweepEnd + 0.35) return;
    // 태양 광선이 하단바를 쓸고 지나간다
    const fade = 1 - segU(t, sweepEnd, sweepEnd + 0.35), gx = sweepX(t);
    saBeam(S.x, S.y, gx, gy - 2, 24 * (0.5 + 0.5 * fade), fade, t);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(gx, gy, 2, gx, gy, 46);
    gr.addColorStop(0, `rgba(255,250,220,${0.9 * fade})`); gr.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = gr; ctx.fillRect(gx - 46, gy - 46, 92, 56);
    ctx.restore();
  }, null, (u) => {
    const t = u * life;
    if (t < hit || t > sweepEnd) return;
    const gx = sweepX(t);
    parts.push({ x: gx, y: groundY() - 3, vx: rand(-80, 80), vy: rand(-160, -60), g: 360, size: 2, color: Math.random() < 0.5 ? '#ffe066' : '#ffffff', life: 0.4, t: 0, add: true });
  });
}
// ★★ 화살비 한 발 (대상을 겨냥한 큰 빛 화살)
function saRainArrowFx(a, tx, ty, big) {
  const life = 0.13, len = big ? 30 : 22, x0 = tx - a.dir * 18;
  aFx(a, 0, life, (u) => {
    const x = mix(x0, tx, u), y = mix(10, ty, easeIn(u));
    ctx.save(); ctx.globalAlpha = 0.7; ctx.strokeStyle = '#ffe066'; ctx.lineWidth = big ? 3 : 2;
    ctx.beginPath(); ctx.moveTo(mix(x0, tx, u * 0.3), 10); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
    saArrow(x, y, Math.atan2(ty - 10, tx - x0), len, '#fffbe8', '#ffffff');
  }, () => {
    burst(tx, ty, big ? 26 : 10, ['#ffffff', '#ffe066', '#ff9a2e'], big ? 190 : 120, 2, 260);
    hitFx(tx, ty, '#ffe066', big ? 2.6 : 1.4);
  });
}

// ── ★★★ 태양 낙하 ──
function saFallStage(a) {
  const d = a.k.dur, hits = a.k.hits.map((h) => h[0] * d), land = hits[1], fin = hits[hits.length - 1], life = d + 1.2;
  const X = Math.max(70, Math.min(W - 70, saCenter(a) + a.dir * 20));
  const sunAt = (t) => {
    const p = segU(t, 1.0, land);
    return { y: mix(-130, groundY() - 22, p * p), r: mix(64, 96, p) };
  };
  a.saFall = { X, sunAt, land, fin };
  backFx(a, 0, life, (u) => {
    const t = u * life, ramp = easeOut(clamp01(t / 0.9)), out = 1 - segU(t, fin + 0.3, life);
    // 하늘이 붉게 저문다 (일식처럼 어두워졌다가 태양이 다가오며 달아오른다)
    const heat = segU(t, 1.2, land);
    saDusk(0.72 * ramp * out, ramp * out * (0.4 + 0.6 * heat), '28,4,0');
    if (t < 1.1 || t > fin + 0.05) return;
    const s = sunAt(t), squash = segU(t, land, land + 0.15);
    // 하단바 전체가 태양빛으로 물든다
    ctx.save();
    const g = ctx.createRadialGradient(X, s.y, s.r * 0.8, X, s.y, s.r * 4.5);
    g.addColorStop(0, `rgba(255,190,80,${0.65 * heat})`); g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = g; ctx.fillRect(-60, 0, W + 120, H);
    ctx.restore();
    // 땅에 닿은 태양은 납작하게 퍼지며 땅을 녹인다 — 기사·적은 그 앞에 검은 그림자로 선다
    ctx.save();
    ctx.translate(X, s.y); ctx.scale(1 + 0.5 * squash, 1 - 0.18 * squash); ctx.translate(-X, -s.y);
    saSun(X, s.y, s.r, t, 1, 1.15);
    saSunSurface(X, s.y, s.r, t);
    ctx.restore();
  });
  aFx(a, 0, life, (u) => {
    const t = u * life, gy = groundY();
    if (t > land && t < fin + 0.2) {
      // 착지: 땅을 따라 하단바 양 끝까지 빛 금이 달리고 불기둥이 줄지어 선다
      const p = easeOut(segU(t, land, land + 0.35)), f = 1 - segU(t, fin, fin + 0.2);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,250,210,${f})`;
      const reach = p * (W + 80);
      ctx.fillRect(Math.round(X - reach), gy - 3, Math.round(reach * 2), 3);
      for (let k = 0; k < 14; k++) {
        const x = X + (k % 2 ? 1 : -1) * (30 + Math.floor(k / 2) * 52) * p, hgt = 14 + 10 * Math.sin(t * 20 + k);
        ctx.fillStyle = `rgba(255,${160 + (k * 13) % 80},60,${0.7 * f})`;
        ctx.fillRect(Math.round(x) - 2, Math.round(gy - hgt), 4, Math.round(hgt));
      }
      ctx.restore();
    }
    // 마지막: 빛이 하단바 전체를 하얗게 태운다
    if (t > fin) {
      const k = t - fin, al = k < 0.06 ? k / 0.06 : 1 - segU(k, 0.2, 1.05);
      dimBand(al, '255,252,236');
      ctx.save();
      ctx.globalAlpha = clamp01(1 - k / 0.7);
      ctx.strokeStyle = '#ffb02e'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(X, gy - 30, 30 + W * easeOut(clamp01(k / 0.7)), 18 + 70 * easeOut(clamp01(k / 0.7)), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // 열기 아지랑이: 태양이 내려오며 시작해 하얗게 탄 뒤까지 일렁인다
    const haze = t < 1.6 ? 0 : t < fin ? 1.4 * segU(t, 1.6, land) + 0.8 * segU(t, land, fin) : 2.2 * (1 - segU(t, fin + 0.3, life));
    saHaze(haze, t);
  }, null, (u) => {
    const t = u * life;
    // 땅에서 불티가 피어오른다
    if (t > 0.2 && t < fin && Math.random() < 0.3 + 0.5 * segU(t, 1.2, land)) {
      parts.push({ x: rand(0, W), y: groundY() - 2, vx: rand(-10, 10), vy: rand(-90, -30), g: -30, size: Math.random() < 0.3 ? 3 : 2, color: ['#ff9a2e', '#ffe066', '#ff4a1f'][Math.floor(rand(0, 3))], life: rand(0.6, 1.1), t: 0, add: true });
    }
  });
}
// 태양 겉면에서 대상으로 홍염 한 줄기가 휘어 휘감는다
function saFlareFx(a, tx, ty, big) {
  const F = a.saFall;
  if (!F) return;
  const s = F.sunAt(Math.min(F.land, castOf(a.owner) ? castOf(a.owner).t : F.land)), sy0 = Math.max(24, s.y);
  const ang = Math.atan2(ty - sy0, tx - F.X), sx = F.X + Math.cos(ang) * s.r * 0.9, sy = Math.max(20, sy0 + Math.sin(ang) * s.r * 0.6);
  const cx = mix(sx, tx, 0.5), cy = Math.max(20, Math.min(sy, ty) - 30 - rand(0, 20)), life = 0.3;
  aFx(a, 0, life, (u) => {
    const head = easeOut(clamp01(u * 2)), tail = clamp01(u * 2 - 0.6);
    ctx.save();
    ctx.lineCap = 'round';
    for (const [w, c] of [[big ? 9 : 6, 'rgba(255,90,30,0.6)'], [big ? 4 : 3, '#ffc43a'], [1.5, '#ffffff']]) {
      ctx.strokeStyle = c; ctx.lineWidth = w * (1 - u * 0.6);
      ctx.beginPath();
      for (let v = tail, first = true; v <= head + 0.001; v += 0.05, first = false) {
        const x = (1 - v) ** 2 * sx + 2 * (1 - v) * v * cx + v * v * tx, y = (1 - v) ** 2 * sy + 2 * (1 - v) * v * cy + v * v * ty;
        if (first) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  });
  skLater(a, life * 0.45, () => { burst(tx, ty, big ? 18 : 8, ['#ffffff', '#ffc43a', '#ff5a1f'], big ? 170 : 110, 2, 120); hitFx(tx, ty, '#ff9a2e', big ? 2 : 1.2); });
}

Object.assign(SKILL_FX, {
  sunArrow: {
    pose(u, a) {
      const m = (a && a.mast) || 0, d = a && a.k ? a.k.dur : 2.6, t = u * d;
      if (m === 0) {
        const R = a && a.k ? a.k.hits[0][0] * d : 1.65;
        if (t < R) return { pull: 13 * easeOut(clamp01((t - 0.1) / (R * 0.75))), sy: 0.93, skew: -0.08, dx: -1 };
        const r = segU(t, R, d);
        return { pull: 0, dx: -1 - 9 * Math.sin(Math.PI * Math.min(1, r * 1.8)), sy: mix(0.93, 1, r), skew: -0.08 * (1 - r) };
      }
      // ★ 이상: 활을 하늘로 치켜들어 힘껏 당겼다가 쏘아 올리고, 태양을 올려다본 채 버틴다
      const up = SA_UP[m], hold = m >= 3 ? d * 0.8 : up + 0.6;
      if (t < up) return { bowA: -1.15 * easeOut(clamp01(t / 0.3)), pull: 13 * easeOut(clamp01((t - 0.15) / (up - 0.2))), sy: 0.94 };
      if (t < up + 0.2) return { bowA: -1.15, pull: 0, dx: -3 * Math.sin(Math.PI * segU(t, up, up + 0.2)), sy: 0.94 };
      if (t < hold) return { bowA: -1.15, pull: 0, sy: 0.94 };
      const r = segU(t, hold, hold + 0.35);
      return { bowA: -1.15 * (1 - r), pull: 0, sy: mix(0.94, 1, r) };
    },
    cues: (a) => {
      const m = a.mast, d = a.k.dur;
      if (m === 0) return [[0, saAimStage]];
      const list = [[0, m === 3 ? saFallStage : m === 2 ? saRainStage : saSunStage]];
      if (m === 3) {
        // 하단바 밖 하늘 높이 쏘아 올린다 — 그 화살이 태양을 끌어 내린다
        list.push([SA_UP[3] / d, (a) => saShootUp(a, a.x() + a.dir * 30, -20, 0.22)]);
      } else {
        list.push([SA_UP[m] / d, (a) => { const S = saSunPos(a, m); saShootUp(a, S.x, S.y); }]);
        list.push([(SA_UP[m] + SA_PIERCE) / d, (a) => { const S = saSunPos(a, m); saPierceFx(a, S.x, S.y, 14); }]);
      }
      return list;
    },
    hit(a, i, n) {
      const m = a.mast, last = i === n - 1, tg = a.targets(i);
      if (m === 0) {
        saLightArrowFx(a);
        for (const t of tg) {
          hitFx(t.x, t.y, '#ffe066', 2.6);
          burst(t.x, t.y, 26, ['#ffffff', '#ffe066', '#ff9a2e'], 200, 2, 0);
          starFx(t.x, t.y, 18, '#ffffff', 0.35);
        }
        impact({ stop: 0.22, shake: 0.5 });
        return;
      }
      if (m === 1) {
        a.saPulse = 1;
        for (const t of tg) {
          hitFx(t.x, t.y - 4, '#ffe066', i === 0 || last ? 2.4 : 1.4);
          burst(t.x, t.y, i === 0 ? 24 : last ? 20 : 8, ['#ffffff', '#ffe066', '#ff9a2e'], i === 0 ? 190 : 130, 2, 120);
        }
        if (i === 0) {
          aFx(a, 0, 0.12, (u) => dimBand(0.4 * (1 - u), '255,240,200'));
          impact({ stop: 0.14, shake: 0.45 });
        } else impact(last ? { stop: 0.2, shake: 0.55 } : { shake: 0.12 });
        return;
      }
      if (m === 2) {
        if (i === 0) {
          for (const t of tg) { hitFx(t.x, t.y, '#ffe066', 2.2); burst(t.x, t.y, 18, ['#ffffff', '#ffe066'], 160, 2, 120); }
          aFx(a, 0, 0.12, (u) => dimBand(0.35 * (1 - u), '255,240,200'));
          impact({ stop: 0.12, shake: 0.4 });
          return;
        }
        for (const t of tg) saRainArrowFx(a, t.x + rand(-6, 6), t.y + rand(-6, 6), last);
        skLater(a, 0.13, () => impact(last ? { stop: 0.22, shake: 0.55 } : { shake: 0.1 }));
        return;
      }
      // ★★★
      if (i === 0) {
        for (const t of tg) saFlareFx(a, t.x, t.y, false);
        impact({ shake: 0.25 });
        return;
      }
      if (i === 1) {
        // 태양이 땅에 닿는 순간
        const F = a.saFall, gy = groundY();
        aFx(a, 0, 0.18, (u) => dimBand(0.55 * (1 - u), '255,236,190'));
        for (let k = 0; k < 40; k++) parts.push({ x: F.X + rand(-80, 80), y: gy - 2, vx: rand(-260, 260), vy: rand(-220, -60), g: 380, size: 3, color: ['#ff9a2e', '#ffe066', '#ffffff', '#7a3a10'][k % 4], life: rand(0.4, 0.8), t: 0 });
        for (const t of tg) hitFx(t.x, t.y, '#ffe066', 2.4);
        impact({ stop: 0.16, shake: 0.6 });
        return;
      }
      if (!last) {
        for (const t of tg) saFlareFx(a, t.x + rand(-8, 8), t.y + rand(-8, 8), false);
        impact({ shake: 0.12 });
        return;
      }
      for (const t of tg) {
        burst(t.x, t.y, 34, ['#ffffff', '#ffe066', '#ff9a2e'], 240, 3, 60);
        hitFx(t.x, t.y, '#ffffff', 3);
      }
      impact({ stop: 0.28, shake: 0.7 });
    },
    kb: 20,
  },
});
