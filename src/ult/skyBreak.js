'use strict';
// 3차 궁극기 「파천참」 연출 (tyrant — 파천검왕). 수치·단계는 src/classes.js 의 SKILLS.skyBreak, 공통 레터박스·컷인은 src/skills.js 의 drawUltScreen.
//  Lv1 「파천참」 높이 뛰어올라 몸집만 한 대검으로 내리그으면 하단바 땅이 끝까지 갈라지고 균열을 따라 불길이 솟는다
//  ★ 「파천·천지절단」 하단바 위 하늘에 하늘만 한 대검 그림자가 떠올라 가로로 휘둘러지고 — 하늘과 땅이 어긋났다가 맞물린다
//  ★★ 「파천·백검난무」 하늘에서 수십 자루의 대검이 비처럼 쏟아져 꽂히고, 마지막에 거대한 날이 떨어져 전부 쓸어 낸다
//  ★★★ 「세계참」 하단바가 세로로 둘로 갈라져 양쪽으로 벌어지고 — 틈으로 빛이 쏟아지다 닫히며 모든 것을 띄운다
// 대검전사의 gsGiantBlade(손에 든 거대 날)·gsSlamLine 을 다시 쓴다 (src/jobs/greatswordsman.js)

const SB_COL = { main: '#ff5a2a', hot: '#ffd0a0', steel: '#2e3038', edge: '#9aa0ac', gold: '#ffd257' };
const sbDur = (a) => (a.k ? a.k.dur : 2.6);
const sbHitT = (a) => (a.k ? a.k.hits.map((h) => h[0] * a.k.dur) : [1.5, 2.4]);
const sbEnv = (t, from, to, fin, fout) => Math.min(clamp01((t - from) / fin), clamp01((to - t) / fout));
const sbBase = () => groundY() - 7;

// 하늘의 어둠 + 땅의 열기
function sbSky(a, life, dim, heat, color = '20,6,0') {
  backFx(a, 0, life, (u) => {
    const t = u * life, k = sbEnv(t, 0.15, life - 0.15, 0.4, 0.3);
    dimBand(dim * k, color);
    if (heat > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = heat * k;
      const g = ctx.createLinearGradient(0, 40, 0, groundY());
      g.addColorStop(0, 'rgba(255,90,42,0)'); g.addColorStop(1, 'rgba(255,90,42,0.6)');
      ctx.fillStyle = g; ctx.fillRect(-20, 40, W + 40, groundY() - 40);
      ctx.restore();
    }
  });
}
// 하단바 끝까지 달리는 균열 + 불길 (양쪽으로)
function sbFissureFx(a, x0, life, grow = 0.35) {
  const by = sbBase(), sides = [];
  for (const s of [-1, 1]) { const pts = [[x0, by]]; for (let x = x0 + s * 12; s > 0 ? x < W + 20 : x > -20; x += s * rand(9, 15)) pts.push([x, by + rand(-2.5, 1.5)]); sides.push(pts); }
  const far = Math.max(x0, W - x0) + 20;
  aFx(a, 0, life, (u) => {
    const t = u * life, reach = far * easeOut(Math.min(1, t / grow)), fade = u > 0.75 ? (1 - u) / 0.25 : 1;
    ctx.save(); ctx.globalAlpha = fade;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, by - 36, 0, by + 4);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, SB_COL.main);
    ctx.fillStyle = g; ctx.globalAlpha = fade * (0.5 + 0.2 * Math.sin(clock * 12));
    ctx.fillRect(Math.max(0, x0 - reach), by - 36, Math.min(W, x0 + reach) - Math.max(0, x0 - reach), 40);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = fade;
    ctx.strokeStyle = '#1a0806'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    for (const pts of sides) { ctx.beginPath(); pts.forEach(([x, y], i) => { if (Math.abs(x - x0) > reach) return; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); }
    ctx.strokeStyle = SB_COL.hot; ctx.lineWidth = 1;
    for (const pts of sides) { ctx.beginPath(); pts.forEach(([x, y], i) => { if (Math.abs(x - x0) > reach) return; i ? ctx.lineTo(x, y - 1) : ctx.moveTo(x, y - 1); }); ctx.stroke(); }
    ctx.restore();
  }, null, (u) => {
    const t = u * life, reach = far * easeOut(Math.min(1, t / grow));
    if (Math.random() > 0.8) return;
    const x = x0 + rand(-reach, reach);
    if (x > 0 && x < W) parts.push({ x, y: by, vx: rand(-15, 15), vy: rand(-110, -50), g: 120, size: 2, color: Math.random() < 0.5 ? SB_COL.main : SB_COL.hot, life: rand(0.3, 0.6), t: 0, add: true });
  });
}
// 하늘에 뜨는 거대한 대검 그림자: (cx, cy) 를 중심으로 ang 방향, 길이 len
function sbShadowBlade(cx, cy, ang, len, alpha, glow = 0) {
  const th = len * 0.11;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy); ctx.rotate(ang);
  if (glow) { ctx.shadowColor = SB_COL.main; ctx.shadowBlur = glow; }
  ctx.fillStyle = '#1a0c0c'; ctx.fillRect(-len * 0.55 - len * 0.16, -th * 0.25, len * 0.16, th * 0.5);    // 손잡이
  ctx.fillStyle = '#3a1414'; ctx.fillRect(-len * 0.55 - 4, -th * 0.9, 8, th * 1.8);                   // 가드
  ctx.fillStyle = '#0f0808';
  ctx.beginPath(); ctx.moveTo(-len * 0.55, -th / 2); ctx.lineTo(len * 0.5, -th / 2); ctx.lineTo(len * 0.56, th * 0.1); ctx.lineTo(len * 0.52, th / 2); ctx.lineTo(-len * 0.55, th / 2); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = SB_COL.main; ctx.globalAlpha = alpha * (0.7 + 0.3 * Math.sin(clock * 10)); ctx.fillRect(-len * 0.55, th / 2 - 2, len * 1.05, 2);   // 날 선
  ctx.restore();
}
// ★★ 하늘에서 떨어져 박히는 대검 한 자루
function sbRainBlade(x, delay, len = 34, stick = 0.7) {
  const gy = sbBase(), x0 = x + rand(-5, 5), ang = Math.PI / 2 + rand(-0.25, 0.25);
  skFx(null, delay, 0.14, (u) => {
    const y = mix(-30, gy, easeIn(u));
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = SB_COL.main; ctx.fillRect(x0 - 1, y - 70, 2, 60); ctx.restore();
    ctx.save(); ctx.translate(x0, y); ctx.rotate(ang - Math.PI); ctx.translate(-x0, -y); sbShadowBlade(x0 + len * 0.1, y, 0, len, 1); ctx.restore();
  }, () => {
    skFx(null, 0, stick, (u) => { const al = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4; ctx.save(); ctx.translate(x0, gy + 2); ctx.rotate(ang - Math.PI + Math.sin(u * 50) * 0.03 * (1 - u)); sbShadowBlade(len * 0.1, 0, 0, len, al); ctx.restore(); });
    burst(x0, gy - 4, 6, [SB_COL.main, SB_COL.hot, '#c9b38a'], 90, 2, 240);
    debris(x0, 4, ['#5a4a42', '#c9b38a']);
  });
}
// ★★★ 세계참: 하단바가 세로로 갈라져 양쪽으로 벌어진다 — 틈에서 빛. open(t) 0→1 벌어짐, 닫힐 때 쾅
function sbWorldSplitFx(a, x, life, openAt, closeAt) {
  aFx(a, 0, life, (u) => {
    const t = u * life;
    const open = t < openAt ? 0 : t < closeAt ? easeOut(Math.min(1, (t - openAt) / 0.35)) : Math.max(0, 1 - (t - closeAt) / 0.12);
    const gap = 26 * open;
    if (gap <= 0.5) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(x - gap, 0, x + gap, 0);
    g.addColorStop(0, 'rgba(255,230,200,0)'); g.addColorStop(0.5, 'rgba(255,245,230,0.95)'); g.addColorStop(1, 'rgba(255,230,200,0)');
    ctx.fillStyle = g; ctx.fillRect(x - gap, -20, gap * 2, H + 40);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1.5, -20, 3, H + 40);
    ctx.restore();
    // 갈라진 양쪽 가장자리: 어긋난 검은 띠
    ctx.save(); ctx.fillStyle = '#05060a';
    ctx.fillRect(x - gap - 3, -20, 3, H + 40); ctx.fillRect(x + gap, -20, 3, H + 40);
    ctx.restore();
  }, null, (u) => {
    const t = u * life;
    if (t < openAt || t > closeAt || Math.random() > 0.7) return;
    parts.push({ x: x + rand(-20, 20), y: rand(0, groundY()), vx: rand(-60, 60), vy: rand(-80, 20), g: 0, size: 2, color: Math.random() < 0.5 ? '#ffffff' : SB_COL.hot, life: 0.3, t: 0, add: true });
  });
}

// ── 단계마다 하늘·땅 연출 ──
function sbStage0(a) {
  const D = sbDur(a), life = D + 0.3;
  sbSky(a, life, 0.4, 0.15);
}
function sbStage1(a) {
  const D = sbDur(a), ht = sbHitT(a), ts = ht[0], tf = ht[ht.length - 1], life = D + 0.35, d = a.dir, cx = a.tx();
  sbSky(a, life, 0.55, 0.2, '28,6,0');
  // 하늘의 대검 그림자: ts 전에 떠올라 가로로 휘둘러진다 (tf 에 베어 지나간다)
  backFx(a, 0, life, (u) => {
    const t = u * life;
    if (t < 0.5 || t > tf + 0.3) return;
    const rise = easeOut(Math.min(1, (t - 0.5) / 0.5)), swing = t < ts ? 0 : t < tf ? easeIn(segU(t, ts, tf)) : 1;
    const ang = (d > 0 ? -0.5 : Math.PI + 0.5) + d * swing * 1.1, y = 40 + 20 * swing, len = 300 * rise;
    const fade = t > tf ? 1 - (t - tf) / 0.3 : 1;
    sbShadowBlade(cx, y, ang, len, 0.92 * fade, 10 * rise);
  });
}
function sbStage2(a) {
  const D = sbDur(a), ht = sbHitT(a), life = D + 0.35, cx = a.tx();
  sbSky(a, life, 0.55, 0.25, '28,6,0');
  // 타격마다 대검이 비처럼: 가운데 타격들(1 ~ n-2)에 맞춰 둘씩
  ht.slice(1, -1).forEach((t, j) => { skLater(a, t - 0.14, () => { sbRainBlade(cx + (j % 2 ? 1 : -1) * rand(20, 120)); sbRainBlade(rand(20, W - 20), 0.03, 28, 0.5); }); });
}
function sbStage3(a) {
  const D = sbDur(a), ht = sbHitT(a), life = D + 0.4, cx = a.tx(), tf = ht[ht.length - 1];
  sbSky(a, life, 0.6, 0.3, '30,4,0');
  ht.slice(1, -2).forEach((t, j) => { skLater(a, t - 0.14, () => sbRainBlade(cx + (j % 2 ? 1 : -1) * rand(10, 140), 0, 30, 0.5)); });
  sbWorldSplitFx(a, cx, life, ht[ht.length - 2] - 0.05, tf - 0.02);
}

Object.assign(SKILL_FX, {
  skyBreak: {
    // 웅크림 → 높이 솟구쳐 대검을 머리 위로 → 내리그음(첫 타) → (가운데 타격 동안) 땅을 짚고 버틴다 → 마지막에 다시 솟구쳐 내리찍는다
    pose(u, a) {
      const D = sbDur(a), t = u * D, ht = sbHitT(a), ts = ht[0], tf = ht[ht.length - 1], m = a.mast || 0;
      const top = [52, 56, 56, 64][Math.min(3, m)];
      if (t < 0.3) { const c = easeOut(t / 0.3); return { sy: 1 - 0.18 * c, sx: 1 + 0.08 * c, wa: mix(-2.35, -2.0, c), skew: -0.15 * c }; }
      if (t < ts - 0.4) { const r = easeOut(segU(t, 0.3, ts - 0.4)); return { lift: top * r, wa: mix(-2.0, -1.62, r), skew: -0.2 * r, sy: mix(0.82, 1.08, Math.min(1, r * 3)) }; }
      if (t < ts - 0.12) { const h = segU(t, ts - 0.4, ts - 0.12); return { lift: top + 3 * Math.sin(h * Math.PI), wa: -1.62 - 0.2 * h, skew: -0.2, sy: 1.06 }; }
      if (t < ts) { const s = easeIn(segU(t, ts - 0.12, ts)); return { lift: top * (1 - s), wa: mix(-1.82, 1.3, s), skew: mix(-0.2, 0.42, s), sy: mix(1.06, 0.82, s), sx: mix(1, 1.1, s), dx: 10 * s }; }
      const second = tf - ts > 0.5;
      if (second && t > tf - 0.42 && t < tf) {
        if (t < tf - 0.14) { const r = easeOut(segU(t, tf - 0.42, tf - 0.14)); return { lift: 40 * r, wa: mix(1.3, -1.7, r), skew: mix(0.42, -0.2, r), sy: 1.05, dx: 10 }; }
        const s = easeIn(segU(t, tf - 0.14, tf)); return { lift: 40 * (1 - s), wa: mix(-1.7, 1.3, s), skew: mix(-0.2, 0.42, s), sy: mix(1.05, 0.82, s), sx: mix(1, 1.12, s), dx: 10 + 4 * s };
      }
      const end = second ? tf : ts, hold = Math.max(end + 0.25, D - 0.35);
      if (t < hold) return { wa: 1.3 + Math.sin(clock * 40) * 0.02 * (t < end + 0.2 ? 1 : 0), sy: 0.84, sx: 1.08, skew: 0.42, dx: second && t > tf ? 14 : 10 };
      const r = easeOut(segU(t, hold, D));
      return { wa: mix(1.3, -2.35, r), sy: mix(0.84, 1, r), sx: mix(1.08, 1, r), skew: 0.42 * (1 - r), dx: 12 * (1 - r) };
    },
    cues: (a) => {
      const D = sbDur(a), ht = sbHitT(a), ts = ht[0], tf = ht[ht.length - 1], m = Math.min(3, a.mast || 0);
      return [
        [0, (a) => [sbStage0, sbStage1, sbStage2, sbStage3][m](a)],
        [0.3 / D, (a) => { ringFx(a.x(), '#c9b38a', 0.8, 0.45); debris(a.x(), 10, ['#c9b38a', '#5a4a42']); impact({ shake: 0.15 }); }],
        // 공중에서 대검이 거대해진다 (첫 내리그음까지, ★★★ 는 마지막 일격까지 유지)
        [(ts - 0.45) / D, (a) => gsGuillotineFx(a, 0, (m >= 3 ? tf : ts) - (ts - 0.45) + 0.25, 0.3)],
      ];
    },
    hit(a, i, n) {
      const m = Math.min(3, a.mast || 0), last = i === n - 1, D = sbDur(a), ht = sbHitT(a), x0 = hand(a).x + a.dir * 40, tx = a.tx(), by = sbBase();
      const rocks = ['#5a4a42', '#c9b38a', SB_COL.main, SB_COL.hot];
      if (i === 0) {
        ringFx(x0, SB_COL.main, 1.6, 0.55); ringFx(x0, '#ffffff', 0.9, 0.3);
        debris(x0, 22 + 6 * m, rocks, 1.7);
        sbFissureFx(a, x0, D - ht[0] + 0.3, 0.35);
        aFx(a, 0, 0.25, (u) => dimBand(0.45 * (1 - u), '255,200,170'));
        impact({ stop: m >= 3 ? 0.2 : 0.15, shake: 0.7 });
        for (const t of a.targets(0)) burst(t.x, t.y, 14, rocks, 180, 3, 260);
        return;
      }
      if (!last) {
        for (const t of a.targets(i)) { burst(t.x, t.y, 8, [SB_COL.main, '#ffffff', SB_COL.hot], 140); if (m === 0 && i === 1) sbRainBlade(t.x, 0, 30, 0.4); }
        if (m === 1) { for (let x = 20; x < W; x += 70) debris(x + rand(-10, 10), 3, rocks, 1.2); }
        impact({ stop: 0.03, shake: 0.22 });
        return;
      }
      // 마지막 일격
      if (m === 1) { ringFx(tx, SB_COL.main, 2.4, 0.6); for (let x = 10; x < W; x += 50) spikeFx(x, 14 + rand(0, 16), SB_COL.main, 0.5); aFx(a, 0, 0.3, (u) => dimBand(0.55 * (1 - u), '255,210,180')); impact({ stop: 0.22, shake: 0.85 }); }
      else if (m === 2) { ringFx(tx, SB_COL.main, 2.4, 0.6); debris(tx, 30, rocks, 2); for (let x = 20; x < W; x += 45) sbRainBlade(x + rand(-8, 8), rand(0, 0.08), 26, 0.45); aFx(a, 0, 0.3, (u) => dimBand(0.55 * (1 - u), '255,210,180')); impact({ stop: 0.22, shake: 0.85 }); }
      else if (m >= 3) { ringFx(tx, '#ffffff', 3, 0.6); for (let x = 10; x < W; x += 40) ringFx(x, SB_COL.hot, 0.6, 0.5); debris(tx, 36, rocks, 2.2); aFx(a, 0, 0.35, (u) => dimBand(0.9 * (1 - u), '255,245,230')); impact({ stop: 0.3, shake: 0.95 }); }
      else { ringFx(tx, SB_COL.main, 1.8, 0.55); debris(tx, 18, rocks, 1.6); impact({ stop: 0.16, shake: 0.7 }); }
      for (const t of a.targets(i)) burst(t.x, t.y, 20, rocks, 220, 3, 280);
    },
    marks(a, t, pow, i, n) {
      const big = i === 0 || i === n - 1;
      slashMarkFx(t.x, t.y, Math.PI / 2 + (a.dir > 0 ? 0.12 : -0.12), (big ? 60 : 36) + 10 * pow, a.color, (big ? 6 : 3.5) + pow, 0.5, 0, 0);
      if (big) slashMarkFx(t.x, t.y, (a.dir > 0 ? 0 : Math.PI) + rand(-0.1, 0.1), 44 + 8 * pow, '#ffffff', 2.5, 0.4, 0.04);
    },
    kb: 22,
  },
});
