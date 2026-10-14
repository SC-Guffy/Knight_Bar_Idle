'use strict';
// 낙뢰 연출 (electromancer). 수치·단계는 src/classes.js 의 SKILLS.thunderstorm
//  Lv1 「벼락」 지팡이를 치켜들면 하늘에서 벼락 한 줄기가 대상에게 떨어진다
//  ★ 「낙뢰」 지팡이를 든 채 하늘이 번쩍이고, 벼락 넷이 차례로 내리꽂힌다 (맞은 자리에 전기 가시)
//  ★★ 「뇌운」 대상 위 하늘에 먹구름이 모여 비가 뿌리고, 번개가 비처럼 쏟아진다
//  ★★★ 「뇌제의 심판」 하늘이 어두워지고 구름 사이가 하얗게 갈라지다 — 거대한 뇌전 기둥이 내리꽂혀 모두 띄우고, 둘레로 번개가 번진다
// 하단바 전체를 덮지 않는다: 구름·벼락은 대상 둘레에만. ★★★ 는 "위에서 꽂는" 피니시 (하늘 균열 + 거대 기둥) — 연쇄 번개 ★★★ 의 가로 사슬과 나눈다

// 뇌전 색: 연보라 + 연노랑 빛 (빙결과 띄움, skill-vfx.md ⑤-1). 그림은 C15 먹구름 · E42 기둥 번개 · K28 착탄 · 텍스처 번개(P11)
const TS_COL = { main: '#b58cff', rgb: '181,140,255', core: '#ffffff', gold: '#fff2a0' };
const TS_CLOUD = MG_RAMP.cloud;

// 먹구름: cx 둘레 w 폭. 비가 뿌리고 가끔 구름 안이 번쩍인다
function tsCloudFx(cx, w, life, delay = 0, ramp = TS_CLOUD) {
  // 먹구름 = C15 시트를 폭 w 만큼 이어 붙인다 (4/3배 한 장 ≈ 128px). 가끔 구름 속이 번쩍인다 (밝은 램프로 한두 프레임)
  let flash = 0;
  const n = Math.max(2, Math.round(w / 110)), lit = ramp.map((c) => mixHex(c, '#ffffff', 0.45));
  skFx(null, delay, life, (u) => {
    const t = u * life, cy = groundY() - 120, k = Math.min(1, t / 0.4), out = t > life - 0.35 ? (life - t) / 0.35 : 1;
    if (Math.random() < 0.02) flash = 3;
    if (flash > 0) flash--;
    for (let i = 0; i < n; i++) {
      const x = cx + (i - (n - 1) / 2) * (w / n) * k;
      vfxDraw(ctx, 'c15', flash && i === 1 ? lit : ramp, mgLoop('c15', 5, i * 2), x, cy + (i % 2) * 6, { scale: 4 / 3, flip: i % 2 === 1, alpha: k * out });
    }
  });
}
// 하늘의 번쩍임: 대상 둘레 하늘이 하얗게 밝았다 사라진다
function tsSkyFlash(cx, alpha = 0.5, life = 0.18) {
  // 하늘의 번쩍임: 대상 위 구름 자리에 밝은 램프 C15 가 잠깐 떠올랐다 사라진다
  const lit = TS_CLOUD.map((c) => mixHex(c, '#ffffff', 0.6));
  skFx(null, 0, life, (u) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    vfxDraw(ctx, 'c15', lit, 1, cx, groundY() - 120, { scale: 2, alpha: alpha * (1 - u) });
    ctx.restore();
  });
}
// 벼락 한 줄기 = E42 기둥 번개 + 불티 (착탄 K28 은 hitTex)
function tsStrike(x, size = 1, ramp = mgRamp('storm')) {
  // 벼락 한 줄기 = E42 기둥 번개 (2/3배, 땅 기준) + 불티. 착탄 그림 K28 은 hitTex 가
  texFx('e42', x, groundY() + 2, ramp, { life: 0.22, scale: size > 1.2 ? 1 : 2 / 3, anchor: 'b', fade: 0.4, flip: Math.random() < 0.5 });
  burst(x, groundY() - 8, Math.round(6 * size), [TS_COL.core, TS_COL.main, TS_COL.gold], 150 * size, 2, 200);
}
// ★★★ 하늘이 갈라진다: 위쪽에 하얀 균열이 가로로 번지며 벌어진다
function tsSkyCrackFx(cx, life, ramp = mgRamp('storm')) {
  // ★★★ 하늘이 갈라진다: 구름 아래로 가로 번개 균열(굵은 텍스처 번개)이 번지며 벌어지고, 갈라진 틈에서 짧은 가닥이 늘어진다
  const y = 14, pts = [];
  for (let i = 0; i < 4; i++) pts.push(cx - 120 + i * 80 + rand(-10, 10));
  skFx(null, 0, life, (u) => {
    const k = easeOut(Math.min(1, u / 0.6)), fade = u > 0.85 ? (1 - u) / 0.15 : 1, half = 120 * k;
    mgBolt(cx - half, y, cx + half, y + 2, ramp, { scale: 4 / 3, jag: 0.25, seed: 3, alpha: fade });
    mgBolt(cx - half * 0.8, y + 5, cx + half * 0.8, y + 6, ramp, { scale: 2 / 3, jag: 0.5, seed: 9, alpha: 0.7 * fade });
    if (Math.floor(clock * 20) % 3 === 0) for (const px of pts) if (Math.abs(px - cx) < half) mgBolt(px, y, px + rand(-14, 14), y + rand(18, 34), ramp, { scale: 2 / 3, alpha: 0.8 * fade });
  });
}
// ★★★ 뇌전 기둥: 하늘에서 땅까지 굵은 번개 기둥 (가운데 하얀 기둥 + 둘레에 꺾인 번개 줄)
function tsPillarBolt(x, life = 0.5, ramp = mgRamp('storm'), sc = 4 / 3) {
  // ★★★ 뇌전 기둥 = E42 기둥 번개를 크게 (4/3배, 땅 기준). 처음 0.1초는 2배로 번쩍인다
  skFx(null, 0, life, (u) => {
    const f = Math.min(4, Math.floor(u * 6)), fade = u > 0.6 ? (1 - u) / 0.4 : 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    vfxDraw(ctx, 'e42', ramp, f, x, groundY() + 2, { scale: u < 0.2 ? sc * 1.5 : sc, anchor: 'b', alpha: fade });
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
      if (m >= 1 && t > 0.3 && t < d - 0.3 && Math.random() < 0.35) { const p = ilTip(a); const an = rand(0, Math.PI * 2), L = rand(8, 14); mgArcFx(p.x, p.y, p.x + Math.cos(an) * L, p.y + Math.sin(an) * L, mgA(a, 'storm'), 0.06, { scale: 2 / 3, jag: 0.15 }); }
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
        ...hits.map((h, j) => [(h[0] * d - 0.1) / d, (a) => { tsSkyFlash(a.tx(), 0.3, 0.12); if (j % 2) tsStrike(a.tx() + rand(-70, 70), 0.7, mgA(a, 'storm')); }]),
      ];
      const fin = hits[hits.length - 1][0] * d;
      return [
        [0.01, (a) => aFx(a, 0, fin + 0.25, (u) => { const t = u * (fin + 0.25); dimSpan(a.tx() - 110, a.tx() + 110, 0.45 * Math.min(1, t / 0.5) * (t > fin ? Math.max(0, 1 - (t - fin) / 0.25) : 1), '5,5,25'); })],   // 구름(폭 190) 아래 구간만
        [0.1 / d, (a) => tsCloudFx(a.tx(), 190, fin - 0.1 + 0.3)],
        [0.35 / d, (a) => { const p = ilTip(a); starFx(p.x, p.y, 12, TS_COL.main, 0.3); impact({ shake: 0.08 }); }],
        ...hits.slice(0, -1).map((h, j) => [(h[0] * d - 0.1) / d, (a) => { tsSkyFlash(a.tx(), 0.35, 0.12); if (j % 2) tsStrike(a.tx() + rand(-80, 80), 0.7, mgA(a, 'storm')); }]),
        [(fin - 0.55) / d, (a) => tsSkyCrackFx(a.tx(), 0.75, mgA(a, 'storm'))],
        [(fin - 0.02) / d, (a) => {
          const x = a.tx(), gy = groundY();
          impact({ stop: 0.22, shake: 0.7 });
          tsPillarBolt(x, 0.55, mgA(a, 'storm'), 2);
          mgRing(x, mgA(a, 'storm'), 2, 0.6);
          debris(x, 10, ['#2a2a3a', TS_COL.main, TS_COL.core], 1.6);
        }],
      ];
    },
    hit(a, i, n) {
      const m = a.mast, tg = a.targets(i), last = i === n - 1;
      const ramp = mgA(a, 'storm');
      if (m === 0) { const t = tg[0] || { x: a.tx(), y: a.ty() }; tsStrike(t.x, 0.8, ramp); impact({ stop: 0.04, shake: 0.15 }); return; }
      if (m === 1) { const t = tg[i % Math.max(1, tg.length)] || { x: a.tx(), y: a.ty() }; tsStrike(t.x, 1, ramp); impact({ stop: 0.04, shake: 0.18 }); return; }
      if (m === 2) { for (const t of tg) if (Math.random() < 0.7 || tg.length === 1) tsStrike(t.x + rand(-6, 6), 0.8, ramp); impact({ shake: 0.1 }); return; }
      if (!last) { for (const t of tg) if (Math.random() < 0.6 || tg.length === 1) tsStrike(t.x + rand(-6, 6), 0.8, ramp); impact({ shake: 0.1 }); return; }
      for (const t of tg) burst(t.x, t.y, 12, [TS_COL.core, TS_COL.main, TS_COL.gold], 240, 2, 280);
    },
    // 명중 그림 K28 (낙뢰 착탄 섬광 + 그을음, 땅 기준): Lv1 앞 3프레임, ★ 4프레임, ★★ 이상 전부. 2/3배, ★★★ 기둥 막타만 4/3배
    hitTex(a, t, share, i, n) {
      const m = a.mast || 0, big = m >= 3 && i === n - 1;
      mgFx(a, 'k28', t.x + rand(-3, 3), groundY() + 2, mgA(a, 'storm'), { scale: big ? 4 / 3 : 2 / 3, life: big ? 0.42 : 0.28, frames: [3, 4, 5, 5][m], anchor: 'b', fade: 0.35, flip: Math.random() < 0.5 });
    },
    kb: 6,
  },
});
