'use strict';
// 낙뢰 연출 (electromancer). 수치·단계는 src/classes.js 의 SKILLS.thunderstorm
//  Lv1 「벼락」 지팡이를 치켜들면 하늘에서 벼락 한 줄기가 대상에게 떨어진다
//  ★ 「낙뢰」 지팡이를 든 채 하늘이 번쩍이고, 벼락 넷이 차례로 내리꽂힌다 (맞은 자리에 전기 가시)
//  ★★ 「뇌운」 대상 위 하늘에 먹구름이 모여 비가 뿌리고, 번개가 비처럼 쏟아진다
//  ★★★ 「뇌제의 심판」 하늘이 어두워지고 구름 사이가 하얗게 갈라지다 — 거대한 뇌전 기둥이 내리꽂혀 모두 띄우고, 둘레로 번개가 번진다
// 하단바 전체를 덮지 않는다: 구름·벼락은 대상 둘레에만. 번개 줄은 world.js drawLightning, 벼락은 skills.js boltFx 를 쓴다

const TS_COL = { main: '#b7e3ff', rgb: '183,227,255', core: '#ffffff', cloud: '#2a2d3a', cloud2: '#3d4152' };

// 먹구름: cx 둘레 w 폭. 비가 뿌리고 가끔 구름 안이 번쩍인다
function tsCloudFx(cx, w, life, delay = 0) {
  const puffs = [];
  for (let i = 0; i < 9; i++) puffs.push({ dx: (i - 4) * (w / 8) + rand(-4, 4), r: rand(10, 17), ph: rand(0, 6) });
  let flash = 0;
  skFx(null, delay, life, (u) => {
    const t = u * life, cy = groundY() - 112, k = Math.min(1, t / 0.4), out = t > life - 0.35 ? (life - t) / 0.35 : 1;
    if (Math.random() < 0.02) flash = 1;
    flash = Math.max(0, flash - 0.08);
    ctx.save();
    ctx.globalAlpha = k * out;
    for (const P of puffs) { ctx.fillStyle = TS_COL.cloud; ctx.beginPath(); ctx.arc(cx + P.dx * k, cy + Math.sin(clock * 2 + P.ph) * 2, P.r, 0, Math.PI * 2); ctx.fill(); }
    for (const P of puffs) { ctx.fillStyle = flash ? `rgb(${Math.round(61 + 120 * flash)},${Math.round(65 + 120 * flash)},${Math.round(82 + 140 * flash)})` : TS_COL.cloud2; ctx.beginPath(); ctx.arc(cx + P.dx * k - 2, cy - 3 + Math.sin(clock * 2 + P.ph) * 2, P.r * 0.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = 'rgba(160,190,230,0.45)'; ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) { const rx = cx - w / 2 + ((i * 37 + clock * 120) % w), ry = cy + 12 + ((i * 53 + clock * 260) % 95); ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 8); ctx.stroke(); }
    ctx.restore();
  });
}
// 하늘의 번쩍임: 대상 둘레 하늘이 하얗게 밝았다 사라진다
function tsSkyFlash(cx, alpha = 0.5, life = 0.18) {
  skFx(null, 0, life, (u) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, 10, 10, cx, 10, 160);
    g.addColorStop(0, `rgba(220,235,255,${alpha * (1 - u)})`); g.addColorStop(1, 'rgba(220,235,255,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - 160, -20, 320, 150);
    ctx.restore();
  });
}
// 벼락 한 줄기 + 땅의 섬광 + 파편 (boltFx 를 감싼다)
function tsStrike(x, size = 1) {
  boltFx(x, 0.22);
  burst(x, groundY() - 8, Math.round(10 * size), [TS_COL.core, TS_COL.main, '#ffe066'], 150 * size, 2, 200);
  ringFx(x, TS_COL.main, 0.8 * size, 0.35);
  scorchFx(x, groundY() - 2, '#2a2a3a', 0.6);
}
// ★★★ 하늘이 갈라진다: 위쪽에 하얀 균열이 가로로 번지며 벌어진다
function tsSkyCrackFx(cx, life) {
  const pts = [];
  for (let i = 0; i <= 12; i++) pts.push([cx - 120 + i * 20, 8 + rand(-6, 6)]);
  skFx(null, 0, life, (u) => {
    const k = easeOut(Math.min(1, u / 0.6)), gap = 2 + 10 * k, fade = u > 0.85 ? (1 - u) / 0.15 : 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade;
    ctx.fillStyle = TS_COL.core;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - gap * Math.sin((i / 12) * Math.PI)) : ctx.moveTo(x, y)));
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + gap * Math.sin((i / 12) * Math.PI));
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(${TS_COL.rgb},0.8)`; ctx.lineWidth = 3; ctx.stroke();
    if (Math.floor(clock * 20) % 3 === 0) for (let i = 0; i < 2; i++) { const [x, y] = pts[2 + Math.floor(Math.random() * 9)]; drawLightning(ctx, x, y, x + rand(-20, 20), y + rand(16, 34), TS_COL.core, TS_COL.rgb, 1, i * 7, 0.8 * fade); }
    ctx.restore();
  });
}
// ★★★ 뇌전 기둥: 하늘에서 땅까지 굵은 번개 기둥 (가운데 하얀 기둥 + 둘레에 꺾인 번개 줄)
function tsPillarBolt(x, life = 0.5) {
  const gy = groundY();
  skFx(null, 0, life, (u) => {
    const w = (10 + 30 * easeOut(Math.min(1, u * 3))) * (u > 0.5 ? 1 - (u - 0.5) * 1.6 : 1), fade = u > 0.6 ? (1 - u) / 0.4 : 1;
    if (w <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade;
    ctx.fillStyle = `rgba(${TS_COL.rgb},0.45)`; ctx.fillRect(x - w, -20, w * 2, gy + 20);
    ctx.fillStyle = TS_COL.core; ctx.fillRect(x - w * 0.4, -20, w * 0.8, gy + 20);
    for (let i = 0; i < 3; i++) drawLightning(ctx, x + (i - 1) * w * 0.8, -10, x + rand(-w, w), gy - 2, TS_COL.core, TS_COL.rgb, 2, i * 13, 0.9);
    ctx.fillStyle = TS_COL.core; ctx.beginPath(); ctx.ellipse(x, gy - 2, w * 1.6, w * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
}

Object.assign(SKILL_FX, {
  thunderstorm: {
    pose(u, a) {
      const m = a.mast || 0, d = a.k ? a.k.dur : 1.8, t = u * d;
      if (m === 0) return ilKeys(t, [[0, {}], [0.3, { bowA: -1.2, pull: 8, sy: 1.04, skew: -0.1 }], [0.55, { bowA: -1.3, pull: 10, sy: 1.05, skew: -0.12 }], [0.64, { bowA: 0.6, pull: 0, dx: 3, sy: 0.94, skew: 0.14 }], [1.0, {}]]);
      if (m === 1) {
        // 지팡이를 든 채 벼락마다 짧게 내리긋는다
        const keys = [[0, {}], [0.3, { bowA: -1.3, pull: 10, sy: 1.05, skew: -0.1, lift: 2 }]];
        for (const h of (a.k ? a.k.hits : [])) { const L = h[0] * d; keys.push([L - 0.08, { bowA: -1.3, pull: 12, sy: 1.05, skew: -0.1, lift: 2 }], [L + 0.04, { bowA: -0.8, pull: 8, sy: 1.0, skew: 0.04, dx: 1 }]); }
        keys.push([d - 0.2, { bowA: -0.6, pull: 4 }], [d, {}]);
        return ilKeys(t, keys);
      }
      if (m === 2) return ilKeys(t, [[0, {}], [0.35, { bowA: -1.35, pull: 10, sy: 1.06, skew: -0.12, lift: 3 }], [d - 0.4, { bowA: -1.4, pull: 13, sy: 1.06, skew: -0.14, lift: 5 }], [d - 0.25, { bowA: 0.3, pull: 0, dx: 3, sy: 0.95, skew: 0.12 }], [d, {}]]);
      const fin = a.k ? a.k.hits[a.k.hits.length - 1][0] * d : 2.29;
      return ilKeys(t, [[0, {}], [0.35, { bowA: -1.35, pull: 10, sy: 1.06, skew: -0.12, lift: 3 }], [fin - 0.5, { bowA: -1.45, pull: 13, sy: 1.08, skew: -0.16, lift: 8 }],
        [fin - 0.12, { bowA: -1.6, pull: 13, sy: 1.12, skew: -0.2, lift: 12 }], [fin, { bowA: 0.9, pull: 0, dx: 5, sy: 0.88, skew: 0.22, lift: 0 }], [fin + 0.15, { bowA: 0.7, dx: 4, sy: 0.92, skew: 0.12 }], [d, {}]]);
    },
    tick(a, u) {
      const m = a.mast, d = a.k.dur, t = u * d;
      if (m >= 1 && t > 0.3 && t < d - 0.3 && Math.random() < 0.35) { const p = ilTip(a); const an = rand(0, Math.PI * 2), L = rand(6, 14); skFx(null, 0, 0.06, () => drawLightning(ctx, p.x, p.y, p.x + Math.cos(an) * L, p.y + Math.sin(an) * L, TS_COL.core, TS_COL.rgb, 1, L, 0.9)); }
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast, hits = a.k.hits;
      if (m === 0) return [[(hits[0][0] * d - 0.08) / d, (a) => tsSkyFlash(a.tx(), 0.35)]];
      if (m === 1) return [
        [0.3 / d, (a) => { const p = ilTip(a); starFx(p.x, p.y, 10, TS_COL.main, 0.25); tsSkyFlash(a.tx(), 0.3, 0.3); }],
        ...hits.map((h) => [(h[0] * d - 0.06) / d, (a) => tsSkyFlash(a.tx(), 0.4, 0.14)]),
      ];
      if (m === 2) return [
        [0.1 / d, (a) => { tsCloudFx(a.tx(), 150, d - 0.15); }],
        [0.35 / d, (a) => { const p = ilTip(a); starFx(p.x, p.y, 12, TS_COL.main, 0.3); impact({ shake: 0.08 }); }],
        ...hits.map((h, j) => [(h[0] * d - 0.1) / d, (a) => { tsSkyFlash(a.tx(), 0.3, 0.12); if (j % 2) boltFx(a.tx() + rand(-70, 70), 0.18); }]),
      ];
      const fin = hits[hits.length - 1][0] * d;
      return [
        [0.01, (a) => aFx(a, 0, fin + 0.25, (u) => { const t = u * (fin + 0.25); dimBand(0.45 * Math.min(1, t / 0.5) * (t > fin ? Math.max(0, 1 - (t - fin) / 0.25) : 1), '5,5,25'); })],
        [0.1 / d, (a) => tsCloudFx(a.tx(), 190, fin - 0.1 + 0.3)],
        [0.35 / d, (a) => { const p = ilTip(a); starFx(p.x, p.y, 12, TS_COL.main, 0.3); impact({ shake: 0.08 }); }],
        ...hits.slice(0, -1).map((h, j) => [(h[0] * d - 0.1) / d, (a) => { tsSkyFlash(a.tx(), 0.35, 0.12); if (j % 2) boltFx(a.tx() + rand(-80, 80), 0.18); }]),
        [(fin - 0.55) / d, (a) => tsSkyCrackFx(a.tx(), 0.75)],
        [(fin - 0.02) / d, (a) => {
          const x = a.tx(), gy = groundY();
          impact({ stop: 0.22, shake: 0.7 });
          tsPillarBolt(x, 0.55);
          ringFx(x, TS_COL.main, 2.0, 0.6); ringFx(x, TS_COL.core, 1.2, 0.45);
          for (let i = 0; i < 8; i++) { const an = Math.PI + (i / 7) * Math.PI, L = rand(60, 120); arcFx(x, gy - 10, x + Math.cos(an) * L, gy - 10 + Math.sin(an) * L * 0.5, TS_COL.core, TS_COL.rgb, 0.28, 2, 0.03 + i * 0.02); }
          debris(x, 18, ['#2a2a3a', TS_COL.main, TS_COL.core], 1.8);
          skFx(null, 0, 0.35, (u) => dimBand(0.85 * (1 - u), '235,245,255'));
        }],
      ];
    },
    hit(a, i, n) {
      const m = a.mast, tg = a.targets(i), last = i === n - 1;
      if (m === 0) { const t = tg[0] || { x: a.tx(), y: a.ty() }; tsStrike(t.x, 0.8); impact({ stop: 0.04, shake: 0.15 }); return; }
      if (m === 1) { const t = tg[i % Math.max(1, tg.length)] || { x: a.tx(), y: a.ty() }; tsStrike(t.x, 1); impact({ stop: 0.04, shake: 0.18 }); return; }
      if (m === 2) { for (const t of tg) if (Math.random() < 0.7 || tg.length === 1) tsStrike(t.x + rand(-6, 6), 0.8); impact({ shake: 0.1 }); return; }
      if (!last) { for (const t of tg) if (Math.random() < 0.6 || tg.length === 1) tsStrike(t.x + rand(-6, 6), 0.8); impact({ shake: 0.1 }); return; }
      for (const t of tg) { burst(t.x, t.y, 20, [TS_COL.core, TS_COL.main, '#ffe066'], 240, 3, 280); starFx(t.x, t.y, 16, TS_COL.core, 0.3); }
    },
    marks(a, t, pow, i, n) {
      if (!a.mast) return;
      clSparks(t, a.mast >= 3 && i === n - 1 ? 5 : 2, 0.4);
    },
    kb: 6,
  },
});
