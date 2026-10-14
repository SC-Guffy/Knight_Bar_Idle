'use strict';
// 3차 궁극기 「파천참」 연출 (tyrant — 파천검왕). 수치·단계는 src/classes.js 의 SKILLS.skyBreak, 공통 레터박스·컷인은 src/skills.js 의 drawUltScreen.
//  Lv1 「파천참」 높이 뛰어올라 몸집만 한 대검으로 내리그으면 하단바 땅이 끝까지 갈라지고 균열을 따라 불길이 솟는다
//  ★ 「파천·천지절단」 하단바 위 하늘에 하늘만 한 대검 그림자가 떠올라 가로로 휘둘러지고 — 하늘과 땅이 어긋났다가 맞물린다
//  ★★ 「파천·백검난무」 하늘에서 수십 자루의 대검이 비처럼 쏟아져 꽂히고, 마지막에 거대한 날이 떨어져 전부 쓸어 낸다
//  ★★★ 「세계참」 하단바가 세로로 둘로 갈라져 양쪽으로 벌어지고 — 틈으로 빛이 쏟아지다 닫히며 모든 것을 띄운다
// 대검전사의 gsGuillotineFx(손에 든 거대 날)를 다시 쓰되 그림은 파천의 그림자 대검(f06)으로 바꾼다 (src/jobs/greatswordsman.js)
// 그림은 PixelLab 시트 (src/vfx-sword.js): f05 붉은 하늘 · f06 그림자 대검 · f07 세계참 빛 틈 · f22 땅 베임 · k31 세로 틈 (막타)
//  땅은 전쟁군주(천붕)의 지그재그 균열(wbFissure)과 나눈다: 파천참은 칼로 그은 듯한 곧은 베임 + 불길

const SB_COL = { main: '#ff5a2a', hot: '#ffd0a0', steel: '#2e3038', edge: '#9aa0ac', gold: '#ffd257' };
const sbDur = (a) => (a.k ? a.k.dur : 2.6);
const sbHitT = (a) => (a.k ? a.k.hits.map((h) => h[0] * a.k.dur) : [1.5, 2.4]);
const sbEnv = (t, from, to, fin, fout) => Math.min(clamp01((t - from) / fin), clamp01((to - t) / fout));
const sbBase = () => groundY() - 7;

// 하늘의 어둠 + 땅의 열기
function sbSky(a, life, dim, heat) {
  backFx(a, 0, life, (u) => {
    const t = u * life, k = sbEnv(t, 0.15, life - 0.15, 0.4, 0.3);
    swBackdrop('f05', SB_COL.main, Math.min(1, (dim + heat) * 1.15) * k);
  });
}
// 하단바 끝까지 달리는 땅 베임 + 불길 (양쪽으로). 곧은 칼자국 시트(f22)를 칸마다 이어 붙인다
function sbFissureFx(a, x0, life, grow = 0.35) {
  const by = sbBase(), far = Math.max(x0, W - x0) + 20;
  aFx(a, 0, life, (u) => {
    const t = u * life, reach = far * easeOut(Math.min(1, t / grow)), fade = u > 0.75 ? (1 - u) / 0.25 : 1;
    const s = VFX_SHEETS.f22, tw = (s.fw || 64) * VFX_DOT;
    for (const d of [-1, 1]) for (let k = 0; k * tw < reach; k++) {
      const x = x0 + d * (k + 0.5) * tw, f = (Math.floor(clock * 10) + k * 2) % 5;
      vfxDraw(ctx, 'f22', SB_COL.main, f, x, by + 4, { anchor: 'b', flip: (k + (d > 0 ? 0 : 1)) % 2 === 1, alpha: fade * (k * tw + tw > reach ? 0.6 : 1) });
    }
  }, null, (u) => {
    const t = u * life, reach = far * easeOut(Math.min(1, t / grow));
    if (Math.random() > 0.5) return;
    const x = x0 + rand(-reach, reach);
    if (x > 0 && x < W) parts.push({ x, y: by, vx: rand(-15, 15), vy: rand(-110, -50), g: 120, size: 2, color: Math.random() < 0.5 ? SB_COL.main : SB_COL.hot, life: rand(0.3, 0.6), t: 0, add: true });
  });
}
// 하늘에 뜨는 거대한 대검 그림자 (f06): (cx, cy) 를 가운데로 ang 방향, 길이 len (배율 2/3·1·4/3·2 중 가까운 것에 늘림으로 맞춘다)
function sbShadowBlade(cx, cy, ang, len, alpha, glow = 0) {
  const s = VFX_SHEETS.f06;
  if (!s || !s.lv) return;
  const h = s.h * VFX_DOT, sc = len > h * 1.6 ? 2 : len > h * 1.1 ? 4 / 3 : len > h * 0.8 ? 1 : 2 / 3;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(ang - Math.PI / 2);
  vfxDraw(ctx, 'f06', SB_COL.main, 0, 0, 0, { scale: sc, sy: len / (h * sc), alpha: alpha * (glow ? 0.9 + 0.1 * Math.sin(clock * 10) : 1) });
  ctx.restore();
}
// ★★ 하늘에서 떨어져 박히는 대검 한 자루
function sbRainBlade(x, delay, len = 34, stick = 0.7) {
  const gy = sbBase(), x0 = x + rand(-5, 5), ang = Math.PI / 2 + rand(-0.25, 0.25);
  skFx(null, delay, 0.14, (u) => {
    const y = mix(-30, gy, easeIn(u));
    sbShadowBlade(x0 - Math.cos(ang) * len * 0.4, y - Math.sin(ang) * len * 0.4, ang, len * 1.6, 1);
  }, () => {
    skFx(null, 0, stick, (u) => { const al = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4, wob = ang + Math.sin(u * 50) * 0.03 * (1 - u); sbShadowBlade(x0 - Math.cos(wob) * len * 0.5, gy + 2 - Math.sin(wob) * len * 0.5, wob, len * 1.6, al); });
    burst(x0, gy - 4, 4, [SB_COL.main, SB_COL.hot, '#c9b38a'], 90, 2, 240);
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
    const s = VFX_SHEETS.f07, sc = groundY() > 150 ? 4 / 3 : 1, fw = (s.fw || 32) * VFX_DOT * sc;
    const f = t < closeAt ? Math.min(3, Math.floor((t - openAt) / 0.08)) : 4;
    vfxDraw(ctx, 'f07', SB_COL.hot, f, x, groundY() + 4, { anchor: 'b', scale: sc, sx: Math.max(0.15, (gap * 2.4) / fw) });
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
        [(ts - 0.45) / D, (a) => gsGuillotineFx(a, 0, (m >= 3 ? tf : ts) - (ts - 0.45) + 0.25, 0.3, 'f06', SB_COL.main)],
      ];
    },
    hit(a, i, n) {
      const m = Math.min(3, a.mast || 0), last = i === n - 1, D = sbDur(a), ht = sbHitT(a), x0 = hand(a).x + a.dir * 40, tx = a.tx(), by = sbBase();
      const rocks = ['#5a4a42', '#c9b38a', SB_COL.main, SB_COL.hot];
      if (i === 0) {
        texFx('k31', x0, sbBase() + 4, SB_COL.main, { anchor: 'b', scale: m >= 2 ? 4 / 3 : 1, life: 0.45, fade: 0.35 });
        debris(x0, 12 + 4 * m, rocks, 1.7);
        sbFissureFx(a, x0, D - ht[0] + 0.3, 0.35);
        aFx(a, 0, 0.15, (u) => dimBand(0.45 * (1 - u), '255,200,170'));
        impact({ stop: m >= 3 ? 0.2 : 0.15, shake: 0.7 });
        for (const t of a.targets(0)) burst(t.x, t.y, 14, rocks, 180, 3, 260);
        return;
      }
      if (!last) {
        for (const t of a.targets(i)) { burst(t.x, t.y, 4, [SB_COL.main, '#ffffff', SB_COL.hot], 140); if (m === 0 && i === 1) sbRainBlade(t.x, 0, 30, 0.4); }
        if (m === 1) { for (let x = 20; x < W; x += 70) debris(x + rand(-10, 10), 2, rocks, 1.2); }
        impact({ stop: 0.03, shake: 0.22 });
        return;
      }
      // 마지막 일격
      const k31 = (sc) => texFx('k31', tx, sbBase() + 4, SB_COL.main, { anchor: 'b', scale: sc, life: 0.55, fade: 0.35 });
      if (m === 1) { k31(4 / 3); for (let x = 30; x < W; x += 90) texFx('k31', x + rand(-10, 10), sbBase() + 4, SB_COL.main, { anchor: 'b', scale: 2 / 3, delay: Math.abs(x - tx) / 900, life: 0.4, fade: 0.4 }); aFx(a, 0, 0.15, (u) => dimBand(0.55 * (1 - u), '255,210,180')); impact({ stop: 0.22, shake: 0.85 }); }
      else if (m === 2) { k31(4 / 3); debris(tx, 14, rocks, 2); for (let x = 20; x < W; x += 45) sbRainBlade(x + rand(-8, 8), rand(0, 0.08), 26, 0.45); aFx(a, 0, 0.15, (u) => dimBand(0.55 * (1 - u), '255,210,180')); impact({ stop: 0.22, shake: 0.85 }); }
      else if (m >= 3) { k31(2); debris(tx, 16, rocks, 2.2); aFx(a, 0, 0.15, (u) => dimBand(0.6 * (1 - u), '255,245,230')); impact({ stop: 0.3, shake: 0.95 }); }
      else { k31(1); debris(tx, 10, rocks, 1.6); impact({ stop: 0.16, shake: 0.7 }); }
      for (const t of a.targets(i)) burst(t.x, t.y, 8, rocks, 220, 3, 280);
    },
    hitTex(a, t, share, i, n) {
      const big = i === 0 || i === n - 1;
      texFx('k31', t.x, t.y + 30, a.color, { anchor: 'b', scale: big ? 1 : 2 / 3, life: 0.35, fade: 0.35, frames: big ? 5 : 3 });
    },
    kb: 22,
  },
});
