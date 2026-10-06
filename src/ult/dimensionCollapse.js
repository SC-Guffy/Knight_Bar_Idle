'use strict';
// 3차 궁극기 「차원 붕괴」 연출 (voidArcher). 수치·단계는 src/classes.js 의 SKILLS.dimensionCollapse, 공통 레터박스·컷인은 src/skills.js 의 drawUltScreen.
//  Lv1 「공허탄」 공허를 머금은 검은 화살이 대상 한가운데 박혀 터지고 — 보랏빛 금이 하단바 끝까지 쩍쩍 번졌다가 산산이 깨진다
//  ★   「차원 균열」 쏜 화살이 지나간 자리를 따라 하단바가 지그재그로 찢어지고, 균열 속 공허가 적을 빨아들이며 찢다가 쾅 닫힌다
//  ★★  「블랙홀」 하단바 한가운데 블랙홀이 열려 강착 원반이 돌고, 하단바 전체의 빛줄기·흙덩이가 휘어 빨려 들어가다가 터진다
//  ★★★ 「사건의 지평선」 하단바가 음화처럼 뒤집히고 시공간 격자가 소용돌이친다 — 모든 것이 한 점으로 접혔다가 하얀 빛으로 펼쳐진다
// 시전 내내 이어지는 큰 그림은 시전 시작에 한 번 만든 연출(뒤 레이어 공허·균열·블랙홀 / 앞 레이어 빨려 드는 빛·음화·접힘)이 시간표대로 그리고,
// 타격 순간(hit)은 대상 자리에 찢기는 공허만 더한다.

const DC_FIRE = [0.8, 0.85, 0.85, 0.95];       // 공허 화살을 쏘는 시점(초)
const DC_BOWA = [-0.2, 0, -0.45, -0.35];       // 그때의 활 기울기 (음수 = 위로)
const DC_MAG = '#ff4dff', DC_PALE = '#ffc8ff';

function dcCenter(a) {
  const t = a.targets();
  return t.length ? t.reduce((s, p) => s + p.x, 0) / t.length : a.tx();
}
const dcVoid = (al) => dimBand(al, '10,0,22');
const dcTower = () => typeof towerInside === 'function' && towerInside();

// 공허 화살: 검은 심에 자홍 테두리, 보랏빛 꼬리를 끌며 날아간다
function dcVoidArrow(a, x1, y1, life, onLand) {
  const h = hand(a), x0 = h.x + a.dir * 8, y0 = h.y - 2, trail = [];
  aFx(a, 0, life, (u) => {
    const x = mix(x0, x1, u), y = mix(y0, y1, u) - Math.sin(Math.PI * u) * 6;
    trail.push([x, y]); if (trail.length > 10) trail.shift();
    trail.forEach(([px, py], j) => { const k = (j + 1) / trail.length; dot(px, py, 2 + Math.round(3 * k), j % 2 ? DC_MAG : '#6a00a0', k * 0.7); });
    const ang = Math.atan2(y1 - y0, x1 - x0);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(ang);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,77,255,0.45)'; ctx.fillRect(-24, -4, 26, 8);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#12001c'; ctx.fillRect(-22, -1, 18, 2); ctx.fillRect(-7, -4, 4, 8); ctx.fillRect(-3, -3, 2, 6); ctx.fillRect(-1, -1, 2, 2);
    ctx.fillStyle = DC_PALE; ctx.fillRect(-7, -4, 1, 8); ctx.fillRect(-24, -3, 4, 1); ctx.fillRect(-24, 2, 4, 1);
    ctx.restore();
  }, onLand);
  burst(x0, y0, 8, [DC_MAG, '#12001c', '#ffffff'], 70, 2, 0);
}
// 시위 끝에 공허가 모인다: 검은 구슬이 자라며 둘레 빛을 빨아들인다
function dcChargeFx(a, until) {
  aFx(a, 0, until, (u) => {
    const h = hand(a), x = h.x + a.dir * 10, y = h.y - 2, r = 2 + 6 * easeOut(u) + Math.sin(clock * 30) * 0.6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,77,255,${0.35 * u})`;
    ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#0a0012';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = DC_MAG; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }, null, (u) => {
    if (Math.random() < 0.7) {
      const h = hand(a), ang = rand(0, Math.PI * 2), r = rand(20, 44);
      parts.push({ x: h.x + a.dir * 10 + Math.cos(ang) * r, y: h.y - 2 + Math.sin(ang) * r, vx: -Math.cos(ang) * r * 3.2, vy: -Math.sin(ang) * r * 3.2, g: 0, size: 2, color: Math.random() < 0.6 ? DC_MAG : '#ffffff', life: 0.3, t: 0, add: true });
    }
  });
}
// 화면 복사본 (글리치·접힘이 지금까지 그린 하단바를 옮겨 그릴 때 쓴다)
const dcCv = document.createElement('canvas');
function dcSnap() {
  const cv = ctx.canvas;
  if (!cv || !cv.width || !cv.height || dcTower()) return null;
  if (dcCv.width !== cv.width || dcCv.height !== cv.height) { dcCv.width = cv.width; dcCv.height = cv.height; }
  const g = dcCv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  g.drawImage(cv, 0, 0);
  return cv;
}
// 차원 글리치: 하단바의 가로 조각 몇 개가 옆으로 어긋난다
function dcGlitch(n, amp) {
  const cv = dcSnap();
  if (!cv) return;
  const sc = cv.height / H;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < n; i++) {
    const y = Math.round(rand(16, H - 22) * sc), h = Math.round(rand(2, 9) * sc), off = Math.round(rand(-amp, amp) * sc);
    ctx.clearRect(0, y, cv.width, h);
    ctx.drawImage(dcCv, 0, y, cv.width, h, off, y, cv.width, h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35;
    ctx.drawImage(dcCv, 0, y, cv.width, h, off + Math.round(3 * sc), y, cv.width, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
// 시공간이 접힌다: 지금까지 그린 하단바 전체를 점 (vx, vy) 쪽으로 돌리며 줄여 그린다
function dcFold(vx, vy, s, rot) {
  const cv = dcSnap();
  if (!cv) { dcVoid(0.95 * (1 - s)); return; }
  const m = ctx.getTransform(), V = m.transformPoint(new DOMPoint(vx, vy));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#05000a';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.translate(V.x, V.y); ctx.rotate(rot); ctx.scale(s, s * (0.6 + 0.4 * s)); ctx.translate(-V.x, -V.y);
  if (s > 0.004) ctx.drawImage(dcCv, 0, 0);
  ctx.restore();
}

// ── Lv1 공허탄: 박혀 터진 자리에서 보랏빛 금이 하단바 끝까지 번진다 ──
function dcCrackTree(cx, cy) {
  const lines = [];
  const grow = (x, y, ang, maxLen, start, wid, depth) => {
    const pts = [[x, y, start]];
    let len = 0;
    while (len < maxLen) {
      const s = rand(8, 24);
      ang += rand(-0.35, 0.35);
      x += Math.cos(ang) * s; y += Math.sin(ang) * s * 0.6;
      if (y < 20 || y > H - 16) { ang = -ang; y = Math.max(20, Math.min(H - 16, y)); }
      len += s;
      pts.push([x, y, start + len]);
      if (depth < 2 && Math.random() < 0.13) grow(x, y, ang + rand(0.6, 1.1) * (Math.random() < 0.5 ? -1 : 1), maxLen * rand(0.2, 0.4), start + len, wid * 0.6, depth + 1);
      if (x < -20 || x > W + 20) break;
    }
    lines.push({ pts, wid });
  };
  const n = 9;
  for (let i = 0; i < n; i++) {
    // 옆으로 길게 (하단바가 가로로 길어서): 각도를 수평 쪽으로 몰아 준다
    const base = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
    grow(cx, cy, Math.atan2(Math.sin(base) * 0.5, Math.cos(base)), rand(0.55, 1) * Math.max(W - cx, cx) + 40, 0, 3, 0);
  }
  return lines;
}
function dcDrawCracks(lines, reach, al, hot) {
  ctx.save();
  ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
  for (const pass of [0, 1, 2]) {
    ctx.globalCompositeOperation = pass === 0 ? 'lighter' : 'source-over';
    for (const L of lines) {
      if (L.pts[0][2] > reach) continue;
      ctx.globalAlpha = al * (pass === 0 ? 0.35 : 1);
      ctx.strokeStyle = pass === 0 ? DC_MAG : pass === 1 ? (hot ? '#ffffff' : DC_MAG) : (hot ? DC_PALE : '#ffffff');
      ctx.lineWidth = pass === 0 ? L.wid * 3 : pass === 1 ? L.wid : 1;
      ctx.beginPath();
      ctx.moveTo(L.pts[0][0], L.pts[0][1]);
      for (let j = 1; j < L.pts.length; j++) {
        const [x, y, d] = L.pts[j];
        if (d > reach) { const [px, py, pd] = L.pts[j - 1], k = (reach - pd) / (d - pd); ctx.lineTo(mix(px, x, k), mix(py, y, k)); break; }
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}
function dcCrackStage(a) {
  const d = a.k.dur, hits = a.k.hits.map((h) => h[0] * d), F = DC_FIRE[0], land = F + 0.18, fin = hits[hits.length - 1], life = d + 0.6;
  const C = { x: dcCenter(a), y: Math.min(a.ty() - 6, H / 2 + 10) }, lines = dcCrackTree(C.x, C.y), far = Math.max(W - C.x, C.x) + 60;
  a.dcCrack = { C, pulse: 0 };
  dcChargeFx(a, F);
  backFx(a, 0, life, (u) => {
    const t = u * life;
    dcVoid(0.6 * easeOut(clamp01(t / 0.7)) * (1 - segU(t, fin + 0.1, life)));
  });
  aFx(a, 0, life, (u) => {
    const t = u * life;
    if (t < land) return;
    const st = a.dcCrack, after = t > fin;
    // 금은 박힌 순간부터 타격마다 한 번씩 쩍쩍 뻗어 나가 하단바 끝에 닿는다
    const k = hits.filter((h) => h <= t).length, reach = far * Math.min(1, 0.18 + 0.82 * easeOut(segU(t, land, hits[hits.length - 2] + 0.08))) + 6 * Math.sin(k);
    const al = after ? 1 - segU(t, fin + 0.05, fin + 0.45) : 1;
    dcDrawCracks(lines, reach, al, after || st.pulse > 0.5);
    st.pulse = Math.max(0, st.pulse - 0.08);
    // 박힌 공허 구슬: 숨 쉬듯 커졌다 작아지고, 마지막엔 안으로 꺼졌다 터진다
    const r = after ? 0 : 7 + 3 * Math.sin(clock * 12) + 6 * st.pulse - 6 * segU(t, fin - 0.25, fin);
    if (r > 0.5) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,77,255,0.35)';
      ctx.beginPath(); ctx.arc(C.x, C.y, r * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#05000a';
      ctx.beginPath(); ctx.arc(C.x, C.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = DC_PALE; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(C.x, C.y, r + 1, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  });
}

// ── ★ 차원 균열: 화살이 지나간 자리를 따라 하단바가 지그재그로 찢어진다 ──
function dcRiftStage(a) {
  const d = a.k.dur, hits = a.k.hits.map((h) => h[0] * d), F = DC_FIRE[1], fin = hits[hits.length - 1], life = d + 0.5;
  const h0 = hand(a), xs = h0.x + a.dir * 16, xe = a.dir > 0 ? W + 30 : -30, ry = Math.max(46, a.ty() - 12), run = 0.3;
  // 지그재그 꼭짓점: 위·아래 모서리를 따로 흔들어 찢긴 천처럼
  const pts = [];
  for (let s = 0, n = Math.ceil(Math.abs(xe - xs) / 14); s <= n; s++) pts.push({ x: mix(xs, xe, s / n), y: ry + (s % 2 ? -4 : 4) + rand(-2, 2), up: rand(0.5, 1.5), dn: rand(0.5, 1.5), f: s / n });
  const stars = Array.from({ length: 50 }, () => ({ f: rand(0, 1), o: rand(-1, 1), tw: rand(0, 6) }));
  a.dcRift = { pulse: 0, ry };
  const openAt = (p, t) => {
    if (t > fin) return 0;
    const born = F + 0.05 + p.f * run, o = easeOut(clamp01((t - born) / 0.25));
    const taper = Math.min(1, p.f * 10, (1 - p.f) * 6 + 0.4);
    const close = 1 - easeIn(segU(t, fin - 0.08, fin));
    return o * taper * close * (17 + 6 * a.dcRift.pulse + 2 * Math.sin(clock * 9 + p.f * 20));
  };
  dcChargeFx(a, F);
  // 화살이 하단바 끝까지 날아가며 그 뒤로 균열이 찢어진다
  skLater(a, F, () => { dcVoidArrow(a, xe, ry, run, null); impact({ shake: 0.2 }); });
  backFx(a, 0, life, (u) => {
    const t = u * life;
    dcVoid(0.62 * easeOut(clamp01(t / 0.7)) * (1 - segU(t, fin + 0.15, life)));
    if (t < F) return;
    const top = pts.map((p) => [p.x, p.y - openAt(p, t) * p.up]), bot = pts.map((p) => [p.x, p.y + openAt(p, t) * p.dn]);
    if (!top.some((p, j) => bot[j][1] - p[1] > 0.5)) return;
    const path = () => { ctx.beginPath(); top.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); for (let j = bot.length - 1; j >= 0; j--) ctx.lineTo(bot[j][0], bot[j][1]); ctx.closePath(); };
    ctx.save();
    // 바깥 번짐
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,77,255,0.35)'; ctx.lineWidth = 8; path(); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    // 균열 속: 끝없는 공허와 그 안을 흐르는 별
    path(); ctx.fillStyle = '#030006'; ctx.fill();
    ctx.save(); path(); ctx.clip();
    const g = ctx.createLinearGradient(0, ry - 20, 0, ry + 20);
    g.addColorStop(0, 'rgba(120,0,160,0.5)'); g.addColorStop(0.5, 'rgba(10,0,30,0)'); g.addColorStop(1, 'rgba(120,0,160,0.5)');
    ctx.fillStyle = g; ctx.fillRect(Math.min(xs, xe), ry - 24, Math.abs(xe - xs), 48);
    for (const s of stars) {
      const x = mix(xs, xe, (s.f + t * 0.08) % 1), y = ry + s.o * 12;
      ctx.fillStyle = Math.sin(clock * 6 + s.tw) > 0 ? '#ffffff' : DC_PALE;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.restore();
    // 찢긴 모서리: 자홍 테두리에 하얀 날
    ctx.lineJoin = 'miter';
    for (const [edge, c, w] of [[top, DC_MAG, 3], [bot, DC_MAG, 3], [top, '#ffffff', 1], [bot, '#ffffff', 1]]) {
      ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath(); edge.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    }
    ctx.restore();
    a.dcRift.pulse = Math.max(0, a.dcRift.pulse - 0.06);
  }, null, (u) => {
    const t = u * life;
    if (t < F + run || t > fin) return;
    // 하단바 위아래에서 빛 부스러기가 균열로 빨려 든다
    for (let k = 0; k < 2; k++) {
      const x = rand(Math.min(xs, xe), Math.max(xs, xe)), y = Math.random() < 0.5 ? rand(18, ry - 24) : rand(ry + 24, groundY());
      parts.push({ x, y, vx: rand(-20, 20), vy: (ry - y) * 3, g: 0, size: 2, color: Math.random() < 0.5 ? DC_MAG : DC_PALE, life: 0.3, t: 0, add: true });
    }
  });
  // 앞 레이어: 대상에서 균열로 끌려가는 기운
  aFx(a, F + run, fin - F - run, (u) => {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = DC_PALE; ctx.lineWidth = 1;
    for (const tg of a.targets()) {
      for (let k = 0; k < 3; k++) {
        const ph = (clock * 3 + k / 3) % 1, x = tg.x + (k - 1) * 6, y0 = tg.y + 10 - ph * 4;
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, mix(y0, ry + 10, ph)); ctx.stroke();
      }
    }
    ctx.restore();
  });
}
// 찢기는 자국: 대상 위에 검은 틈이 X 자로 벌어졌다 닫힌다
function dcTearFx(x, y, size, life = 0.3) {
  const ang = rand(-0.9, 0.9);
  skFx(null, 0, life, (u) => {
    const open = Math.sin(Math.PI * u) * size * 0.28, len = size * easeOut(clamp01(u * 3));
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    for (const r of [ang, ang + Math.PI / 2]) {
      ctx.save(); ctx.rotate(r);
      ctx.fillStyle = DC_MAG; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, -open - 1.5); ctx.lineTo(len, 0); ctx.lineTo(0, open + 1.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#05000a';
      ctx.beginPath(); ctx.moveTo(-len * 0.85, 0); ctx.lineTo(0, -open); ctx.lineTo(len * 0.85, 0); ctx.lineTo(0, open); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  });
}

// ── ★★ 블랙홀 ──
function dcHoleStage(a) {
  const d = a.k.dur, hits = a.k.hits.map((h) => h[0] * d), F = DC_FIRE[2], open = F + 0.2, fin = hits[hits.length - 1], life = d + 0.7;
  const B = { x: Math.max(60, Math.min(W - 60, dcCenter(a))), y: 64 };
  const disk = Array.from({ length: 70 }, (_, i) => ({ ang: rand(0, Math.PI * 2), rr: rand(1.3, 3.4), c: i % 4 }));
  const flow = [];   // 하단바 곳곳에서 소용돌이치며 빨려 드는 빛줄기·흙덩이 { r, ang, sp, rock }
  a.dcHole = { B, flow, pulse: 0 };
  const radius = (t) => (t < open ? 0 : t < fin - 0.25 ? 15 * easeOut(segU(t, open, open + 0.35)) + 2 * a.dcHole.pulse : mix(15, 3, easeIn(segU(t, fin - 0.25, fin))));
  const P = (r, ang) => [B.x + Math.cos(ang) * r, B.y + Math.sin(ang) * r * 0.45];
  dcChargeFx(a, F);
  backFx(a, 0, life, (u) => {
    const t = u * life;
    dcVoid(0.78 * easeOut(clamp01(t / 0.8)) * (1 - segU(t, fin + 0.1, life)));
    const r = radius(t);
    if (r <= 0.3 || t > fin) return;
    // 중력 렌즈: 블랙홀 둘레의 하늘이 고리처럼 밝게 휘어 보인다
    ctx.save();
    const lg = ctx.createRadialGradient(B.x, B.y, r * 1.2, B.x, B.y, r * 5);
    lg.addColorStop(0, 'rgba(255,170,255,0.5)'); lg.addColorStop(0.35, 'rgba(160,40,200,0.22)'); lg.addColorStop(1, 'rgba(60,0,90,0)');
    ctx.fillStyle = lg; ctx.fillRect(B.x - r * 5, B.y - r * 5, r * 10, r * 10);
    ctx.restore();
  });
  const drawDisk = (t, r, front) => {
    for (const p of disk) {
      const ang = p.ang + t * (6 / p.rr), s = Math.sin(ang);
      if ((s > 0) !== front) continue;
      const [x, y] = P(r * p.rr * 1.4, ang);
      dot(x, y, p.rr < 2 ? 3 : 2, ['#ffffff', '#ffb04d', DC_MAG, '#ff7ab8'][p.c], front ? 0.95 : 0.6);
    }
  };
  aFx(a, 0, life, (u) => {
    const t = u * life, r = radius(t);
    // 빨려 드는 빛줄기: 짧은 호 꼬리를 그린다
    ctx.save();
    ctx.lineCap = 'round';
    for (const f of flow) {
      const [x, y] = P(f.r, f.ang), [px, py] = P(f.r + 6 + f.sp * 0.03, f.ang - 0.12);
      if (f.rock) { dot(x, y, 3, '#8a7a5a', 1); continue; }
      ctx.strokeStyle = f.c; ctx.globalAlpha = Math.min(1, f.r / 30); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
    }
    ctx.restore();
    if (r > 0.3 && t < fin) {
      drawDisk(t, r, false);
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.beginPath(); ctx.arc(B.x, B.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffe8ff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(B.x, B.y, r + 1.5, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.5; ctx.strokeStyle = DC_MAG; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(B.x, B.y, r * 2.3, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      drawDisk(t, r, true);
    }
    // 마지막: 붕괴한 블랙홀이 터지며 하단바 전체로 빛 고리가 퍼진다
    if (t > fin) {
      const k = t - fin, e = easeOut(clamp01(k / 0.45));
      if (k < 0.5) dimBand(0.75 * (1 - k / 0.5), '255,225,255');
      ctx.save();
      for (let j = 0; j < 3; j++) {
        const kk = easeOut(clamp01((k - j * 0.07) / 0.5));
        if (kk <= 0) continue;
        ctx.globalAlpha = 1 - kk;
        ctx.strokeStyle = j === 1 ? '#ffffff' : DC_MAG; ctx.lineWidth = 5 - j;
        ctx.beginPath(); ctx.ellipse(B.x, B.y, 10 + (W * 0.9) * kk, 6 + 80 * kk, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1 - e;
      ctx.fillStyle = '#ffffff';
      for (let j = 0; j < 16; j++) {
        const ang = j / 16 * Math.PI * 2, r0 = 10 + 160 * e, r1 = r0 + 30 + 30 * (j % 2);
        ctx.save(); ctx.translate(B.x, B.y); ctx.scale(1, 0.5); ctx.rotate(ang); ctx.fillRect(r0, -1, r1 - r0, 2); ctx.restore();
      }
      ctx.restore();
    }
  }, null, (u, dt) => {
    const t = u * life, r = radius(t);
    // 빛줄기·흙덩이를 하단바 곳곳에서 불러 와 소용돌이로 빨아들인다
    if (t > open && t < fin - 0.1) {
      for (let k = 0; k < 2; k++) {
        const x = rand(-20, W + 20), y = rand(20, groundY()), dx = x - B.x, dy = (y - B.y) / 0.45;
        flow.push({ r: Math.hypot(dx, dy), ang: Math.atan2(dy, dx), sp: rand(90, 160), c: [DC_MAG, '#ffffff', '#b98cff', '#ffb04d'][k + (Math.random() < 0.5 ? 0 : 2)] });
      }
      if (Math.random() < 0.3) { const x = rand(0, W), dx = x - B.x, dy = (groundY() - 4 - B.y) / 0.45; flow.push({ r: Math.hypot(dx, dy), ang: Math.atan2(dy, dx), sp: rand(60, 110), rock: true }); }
    }
    const pull = t > fin - 0.25 ? 2.2 : 1;
    for (const f of flow) {
      f.sp += 260 * dt * pull;
      f.r -= f.sp * dt * pull;
      f.ang += (90 / Math.max(12, f.r)) * dt * 3 * pull;
    }
    for (let j = flow.length - 1; j >= 0; j--) if (flow[j].r < Math.max(3, r)) flow.splice(j, 1);
    if (t > fin && flow.length) flow.length = 0;
  });
}

// ── ★★★ 사건의 지평선 ──
// 시공간 격자 한 점을 소용돌이(sw)와 끌어당김(pull)만큼 비튼다
function dcWarp(x, y, V, sw, pull) {
  const dx = x - V.x, dy = (y - V.y) * 1.8, r = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx) + sw * Math.exp(-r / 120), r2 = r * (1 - pull * Math.exp(-r / 200));
  return [V.x + Math.cos(ang) * r2, V.y + Math.sin(ang) * r2 / 1.8];
}
function dcGrid(V, sw, pull, color, al) {
  ctx.save();
  ctx.globalAlpha = al;
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -40; x <= W + 40; x += 26) {
    for (let y = 0, j = 0; y <= H; y += 10, j++) { const [px, py] = dcWarp(x, y, V, sw, pull); j ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  }
  for (let y = 4; y <= H; y += 20) {
    for (let x = -40, j = 0; x <= W + 40; x += 14, j++) { const [px, py] = dcWarp(x, y, V, sw, pull); j ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  }
  ctx.stroke();
  ctx.restore();
}
function dcHorizonStage(a) {
  const d = a.k.dur, hits = a.k.hits.map((h) => h[0] * d), F = DC_FIRE[3], flip = F + 0.12, fold = hits[hits.length - 2], fin = hits[hits.length - 1], life = d + 1.1;
  const V = { x: Math.max(60, Math.min(W - 60, dcCenter(a))), y: 72 };
  a.dcHz = { V, glitch: 0 };
  dcChargeFx(a, F);
  backFx(a, 0, life, (u) => {
    const t = u * life;
    if (t < fin) dcVoid(0.86 * easeOut(clamp01(t / 0.7)));
    // 아직 뒤집히기 전: 어둠 속에 자홍 시공간 격자가 떠오른다
    if (t < flip) dcGrid(V, 0.6 * t, 0.05 * t, DC_MAG, 0.3 * clamp01(t / 0.5));
  });
  aFx(a, 0, life, (u) => {
    const t = u * life, hz = a.dcHz;
    if (t > flip && t < fold) {
      // 음화: 지금까지 그린 하단바를 통째로 뒤집는다
      ctx.save();
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-60, -10, W + 120, H + 20);
      ctx.restore();
      if (t < flip + 0.1) dimBand(0.9 * (1 - (t - flip) / 0.1), '255,255,255');
      // 소용돌이치는 시공간: 시간이 갈수록 더 세게 비틀리고 가운데로 끌려 든다
      const k = segU(t, flip, fold);
      dcGrid(V, 0.8 + 5 * k * k + t * 0.6, 0.15 + 0.45 * k, '#2a0038', 0.55);
      dcGrid(V, 0.8 + 5 * k * k + t * 0.6 + 0.25, 0.15 + 0.45 * k, '#c000c0', 0.3);
      // 가운데의 사건의 지평선: 하얀 바탕에 뚫린 검은 구멍과 무지갯빛 테
      const r = 8 + 5 * k + Math.sin(clock * 10) * 1;
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.beginPath(); ctx.arc(V.x, V.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#00e0c0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(V.x, V.y, r + 2, clock * 4, clock * 4 + Math.PI * 1.3); ctx.stroke();
      ctx.strokeStyle = DC_MAG;
      ctx.beginPath(); ctx.arc(V.x, V.y, r + 4, -clock * 5, -clock * 5 + Math.PI * 1.1); ctx.stroke();
      ctx.restore();
      if (hz.glitch > 0) { dcGlitch(3 + Math.round(4 * hz.glitch), 14 * hz.glitch); hz.glitch = Math.max(0, hz.glitch - 0.12); }
    }
    // 접힘: 모든 것이 돌며 한 점으로 빨려 든다
    if (t >= fold && t < fin) {
      const p = segU(t, fold, fin - 0.05), s = 1 - easeIn(p);
      dcGrid(V, 6 + 10 * p, 0.6 + 0.4 * p, '#c000c0', 0.5 * (1 - p));
      dcFold(V.x, V.y, s, p * p * 5);
      // 남은 한 점이 점점 밝아진다
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(V.x, V.y, 0, V.x, V.y, 6 + 20 * p);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, `rgba(255,120,255,${0.8 * p})`); g.addColorStop(1, 'rgba(255,77,255,0)');
      ctx.fillStyle = g; ctx.fillRect(V.x - 30, V.y - 30, 60, 60);
      ctx.restore();
    }
    // 하얀 빛으로 펼쳐진다
    if (t >= fin) {
      const k = t - fin, e = easeOut(clamp01(k / 0.3));
      if (k < 0.08) dcVoid(0.95);
      ctx.save();
      const rad = 4 + (W + 100) * e, al = 1 - segU(k, 0.25, 1.0);
      const g = ctx.createRadialGradient(V.x, V.y, 0, V.x, V.y, rad);
      g.addColorStop(0, `rgba(255,255,255,${al})`); g.addColorStop(0.7, `rgba(255,240,255,${al})`); g.addColorStop(0.9, `rgba(255,120,255,${0.7 * al})`); g.addColorStop(1, 'rgba(0,224,192,0)');
      ctx.fillStyle = g; ctx.fillRect(-60, -10, W + 120, H + 20);
      for (let j = 0; j < 3; j++) {
        const kk = easeOut(clamp01((k - 0.05 - j * 0.08) / 0.6));
        if (kk <= 0 || kk >= 1) continue;
        ctx.globalAlpha = 1 - kk;
        ctx.strokeStyle = ['#ffffff', DC_MAG, '#00e0c0'][j]; ctx.lineWidth = 4 - j;
        ctx.beginPath(); ctx.ellipse(V.x, V.y, 20 + W * kk, 10 + 90 * kk, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
  }, null, (u) => {
    const t = u * life;
    if (t > flip && t < fold && Math.random() < 0.6) {
      // 격자를 따라 검은 부스러기가 소용돌이 안으로
      const x = rand(0, W), y = rand(20, groundY());
      parts.push({ x, y, vx: (V.x - x) * 1.5 + (y - V.y) * 2, vy: (V.y - y) * 1.5 - (x - V.x) * 0.3, g: 0, size: 2, color: Math.random() < 0.5 ? '#000000' : '#00e0c0', life: 0.35, t: 0 });
    }
  });
}

Object.assign(SKILL_FX, {
  dimensionCollapse: {
    pose(u, a) {
      const m = (a && a.mast) || 0, d = a && a.k ? a.k.dur : 2.8, t = u * d, F = DC_FIRE[m], A = DC_BOWA[m];
      const end = a && a.k ? a.k.hits[a.k.hits.length - 1][0] * d : d * 0.9;
      if (t < F) return { pull: 12 * easeOut(clamp01((t - 0.1) / (F - 0.2))), bowA: A * easeOut(clamp01(t / 0.25)), sy: 0.95, dx: -1 };
      if (t < F + 0.2) return { pull: 0, bowA: A, dx: -1 - 4 * Math.sin(Math.PI * segU(t, F, F + 0.2)), sy: 0.95 };
      // 쏜 뒤에는 시위를 반쯤 당긴 채 떨며 공허를 붙들고 있다
      if (t < end) return { pull: 5 + 2 * Math.sin(clock * 30), bowA: A, sy: 0.95, dx: -1 };
      const r = segU(t, end, end + 0.3);
      return { pull: 0, bowA: A * (1 - r), sy: mix(0.95, 1, r), dx: -1 - 5 * Math.sin(Math.PI * r) };
    },
    cues: (a) => {
      const m = a.mast, d = a.k.dur, F = DC_FIRE[m];
      if (m === 0) return [[0, dcCrackStage], [F / d, (a) => { const C = a.dcCrack.C; dcVoidArrow(a, C.x, C.y, 0.18, () => { burst(C.x, C.y, 22, [DC_MAG, '#ffffff', '#12001c'], 160, 2, 0); a.dcCrack.pulse = 1; impact({ stop: 0.06, shake: 0.25 }); }); }]];
      if (m === 1) return [[0, dcRiftStage]];
      if (m === 2) return [[0, dcHoleStage], [F / d, (a) => { const B = a.dcHole.B; dcVoidArrow(a, B.x, B.y, 0.2, () => { burst(B.x, B.y, 24, [DC_MAG, '#ffffff'], 160, 2, 0); impact({ stop: 0.06, shake: 0.3 }); }); }]];
      return [[0, dcHorizonStage], [F / d, (a) => { const V = a.dcHz.V; dcVoidArrow(a, V.x, V.y, 0.12, () => impact({ stop: 0.08, shake: 0.35 })); }]];
    },
    hit(a, i, n) {
      const m = a.mast, last = i === n - 1, tg = a.targets(i);
      if (m === 0) {
        if (last) {
          // 금이 하얗게 달아올랐다가 산산이 깨진다
          const C = a.dcCrack.C;
          aFx(a, 0, 0.2, (u) => dimBand(0.5 * (1 - u), '255,170,255'));
          for (let k = 0; k < 36; k++) { const ang = rand(0, Math.PI * 2), v = rand(80, 280); parts.push({ x: C.x, y: C.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v * 0.6, g: 120, size: Math.random() < 0.4 ? 4 : 2, color: [DC_MAG, '#ffffff', '#12001c', DC_PALE][k % 4], life: rand(0.4, 0.8), t: 0 }); }
          for (const t of tg) { hitFx(t.x, t.y, DC_MAG, 2.6); dcTearFx(t.x, t.y, 16, 0.35); }
          impact({ stop: 0.2, shake: 0.5 });
          return;
        }
        a.dcCrack.pulse = 1;
        for (const t of tg) { dcTearFx(t.x + rand(-6, 6), t.y + rand(-8, 6), 9); burst(t.x, t.y, 6, [DC_MAG, '#ffffff'], 100, 2, 0); }
        impact({ shake: 0.1 });
        return;
      }
      if (m === 1) {
        if (last) {
          // 균열이 쾅 닫힌다: 하단바를 가로지르는 하얀 솔기 + 자홍 섬광
          const ry = a.dcRift.ry;
          aFx(a, 0, 0.45, (u) => {
            if (u < 0.3) dimBand(0.5 * (1 - u / 0.3), '255,160,255');
            ctx.save(); ctx.globalAlpha = 1 - u; ctx.fillStyle = '#ffffff'; ctx.fillRect(-20, Math.round(ry) - 2 + u * 2, W + 40, Math.max(1, 4 * (1 - u))); ctx.restore();
          });
          for (let k = 0; k < 30; k++) parts.push({ x: rand(0, W), y: ry, vx: rand(-40, 40), vy: rand(-160, 160), g: 0, size: Math.random() < 0.3 ? 3 : 2, color: k % 2 ? DC_MAG : '#ffffff', life: rand(0.3, 0.6), t: 0, add: true });
          for (const t of tg) { hitFx(t.x, t.y, DC_MAG, 2.8); burst(t.x, t.y, 24, [DC_MAG, '#ffffff', '#12001c'], 200, 2, 0); }
          impact({ stop: 0.22, shake: 0.55 });
          return;
        }
        a.dcRift.pulse = 1;
        for (const t of tg) {
          dcTearFx(t.x + rand(-8, 8), t.y + rand(-10, 6), 11);
          // 찢긴 조각이 균열로 빨려 든다
          for (let k = 0; k < 4; k++) parts.push({ x: t.x, y: t.y, vx: rand(-30, 30), vy: (a.dcRift.ry - t.y) * 4, g: 0, size: 2, color: k % 2 ? DC_MAG : '#ffffff', life: 0.25, t: 0, add: true });
        }
        impact({ shake: 0.08 });
        return;
      }
      if (m === 2) {
        const B = a.dcHole.B;
        if (last) {
          for (let k = 0; k < 44; k++) { const ang = rand(0, Math.PI * 2), v = rand(120, 320); parts.push({ x: B.x, y: B.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v * 0.5, g: 60, size: Math.random() < 0.4 ? 3 : 2, color: [DC_MAG, '#ffffff', '#ffb04d', '#b98cff'][k % 4], life: rand(0.4, 0.8), t: 0, add: true }); }
          for (const t of tg) { hitFx(t.x, t.y, '#ffffff', 3); burst(t.x, t.y, 22, [DC_MAG, '#ffffff'], 200, 2, 0); }
          impact({ stop: 0.26, shake: 0.65 });
          return;
        }
        a.dcHole.pulse = 1;
        for (const t of tg) {
          dcTearFx(t.x + rand(-6, 6), t.y + rand(-8, 6), 8, 0.22);
          // 맞은 자리의 조각이 블랙홀로 끌려간다
          const dx = t.x - B.x, dy = (t.y - B.y) / 0.45;
          for (let k = 0; k < 3; k++) a.dcHole.flow.push({ r: Math.hypot(dx, dy) + rand(-4, 4), ang: Math.atan2(dy, dx) + rand(-0.05, 0.05), sp: rand(120, 180), c: k % 2 ? '#ffffff' : DC_MAG });
        }
        impact({ shake: 0.06 });
        return;
      }
      // ★★★
      if (i === n - 2) { impact({ stop: 0.1, shake: 0.35 }); return; }   // 접히기 시작
      if (last) {
        for (const t of tg) { hitFx(t.x, t.y, '#ffffff', 3.2); burst(t.x, t.y, 30, ['#ffffff', DC_MAG, '#00e0c0'], 240, 3, 0); }
        impact({ stop: 0.3, shake: 0.75 });
        return;
      }
      a.dcHz.glitch = 1;
      for (const t of tg) { dcTearFx(t.x + rand(-8, 8), t.y + rand(-10, 6), 10, 0.22); burst(t.x, t.y, 5, ['#000000', '#00e0c0', DC_MAG], 110, 2, 0); }
      impact({ shake: 0.08 });
    },
    kb: 20,
  },
});
