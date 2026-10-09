'use strict';
// 연쇄 번개 연출 (electromancer). 수치·단계는 src/classes.js 의 SKILLS.chainLightning
//  Lv1 「전격」 지팡이 끝에서 번개 한 줄기가 대상에게 곧게 꽂힌다
//  ★ 「연쇄 번개」 지팡이 끝이 타닥거리다 번개가 날아가 — 맞은 적에서 다음 적으로 세 번 건너뛴다 (맞은 자리에 전기 가시)
//  ★★ 「뇌전 구체」 지팡이 끝에 구전(球電)이 맺혀 떠오르고, 앞으로 굴러가며 둘레의 적에게 계속 번개를 튀긴다
//  ★★★ 「뇌신의 손」 하늘이 어두워지고 대상 위로 번개로 된 거대한 손이 내려와 — 손가락 끝마다 번개를 꽂다가 움켜쥐며 터뜨린다
// 번개 줄은 world.js 의 drawLightning · arcFx 를 쓴다 (평타 번개탄과 같은 모양). 하단바 전체를 덮지 않는다
// 자세·지팡이 끝 위치는 iceLance.js 의 ilKeys · ilTip 을 그대로 쓴다 (지팡이 직업 공통)

const CL_COL = { main: '#b7e3ff', rgb: '183,227,255', core: '#ffffff', gold: '#ffe066' };

// 지팡이 끝의 타닥거림: 끝 둘레에서 짧은 번개 가닥이 무작위로 튄다
function clCrackle(a, r = 10, n = 2) {
  const p = ilTip(a);
  for (let i = 0; i < n; i++) {
    const an = rand(0, Math.PI * 2), L = rand(r * 0.5, r);
    skFx(null, 0, 0.06, () => drawLightning(ctx, p.x, p.y, p.x + Math.cos(an) * L, p.y + Math.sin(an) * L, CL_COL.core, CL_COL.rgb, 1, i * 3, 0.9));
  }
}
// 맞은 적 둘레의 전기 가시 (타격 자국 대신): 짧은 번개 가닥 몇 개가 잠깐 떨린다
function clSparks(t, n = 3, life = 0.4) {
  const list = [];
  for (let j = 0; j < n; j++) list.push([rand(0, Math.PI * 2), rand(8, 16), rand(0, 100)]);
  skFx(null, 0, life, (u) => {
    if (Math.floor(u * 20) % 3 === 2) return;
    for (const [an, L, sd] of list) drawLightning(ctx, t.x, t.y, t.x + Math.cos(an) * L, t.y + Math.sin(an) * L * 0.6, CL_COL.core, CL_COL.rgb, 1, sd, 1 - u);
  });
}
// 번개가 꽂힌 자리: 하얀 섬광 + 파란 파편
function clZap(x, y, size = 1) {
  burst(x, y, Math.round(10 * size), [CL_COL.core, CL_COL.main, CL_COL.gold], 160 * size, 2, 140);
  skFx(null, 0, 0.14, (u) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - u; ctx.fillStyle = CL_COL.core; ctx.beginPath(); ctx.arc(x, y, 8 * size * (1 - u * 0.5), 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
}
// ★★ 구전: 지팡이 끝에 맺혀(form 초) 떠오른 뒤 앞으로 굴러간다 (roll 구간, dist 만큼). a.clBall 에 지금 자리를 둔다
function clBallFx(a, life, form, rollFrom, rollTo, dist) {
  a.clBall = null;
  aFx(a, 0, life, (u) => {
    const t = u * life, tip = ilTip(a), gy = groundY();
    let x, y, r;
    if (t < form) { const k = easeOut(t / form); x = tip.x; y = tip.y; r = 4 + 6 * k; }
    else if (t < rollFrom) { const k = easeOut(segU(t, form, rollFrom)); x = mix(tip.x, tip.x + a.dir * 16, k); y = mix(tip.y, gy - 30, k); r = 10; }
    else { const k = easeOut(segU(t, rollFrom, rollTo)); x = tip.x + a.dir * (16 + dist * k); y = gy - 30 + Math.sin(t * 6) * 3; r = 10 + Math.sin(t * 30) * 1; }
    const out = u > 0.9 ? (1 - u) / 0.1 : 1;
    a.clBall = { x, y };
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = out;
    ctx.shadowColor = CL_COL.main; ctx.shadowBlur = 16;
    ctx.fillStyle = `rgba(${CL_COL.rgb},0.55)`; ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = CL_COL.core; ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    for (let i = 0; i < 3; i++) { const an = clock * 9 + i * 2.1, L = r * 1.8; drawLightning(ctx, x, y, x + Math.cos(an) * L, y + Math.sin(an) * L, CL_COL.core, CL_COL.rgb, 1, i * 5 + Math.floor(clock * 20), 0.8 * out); }
    ctx.restore();
  }, null, (u) => {
    const b = a.clBall;
    if (!b || Math.random() > 0.5) return;
    parts.push({ x: b.x + rand(-6, 6), y: b.y + rand(-6, 6), vx: rand(-20, 20), vy: rand(-20, 20), g: 0, size: 1.5, color: Math.random() < 0.5 ? CL_COL.core : CL_COL.main, life: 0.2, t: 0, add: true });
  });
}
// ★★★ 뇌신의 손: 대상 위 하늘에서 손바닥(타원)과 손가락 다섯(번개 줄)이 내려온다. grab 이후엔 손가락이 오므라들고 clench 에 터진다
function clHandFx(a, life, descend, grab, clench) {
  const cx = a.tx();
  a.clHand = { x: cx, y: 0, tips: [] };
  aFx(a, 0, life, (u) => {
    const t = u * life, gy = groundY();
    const down = easeOut(Math.min(1, t / descend)), py = -40 + down * (gy - 110 + 40);
    const cl = t > grab ? easeIn(Math.min(1, (t - grab) / Math.max(0.01, clench - grab))) : 0;
    const out = t > clench ? Math.max(0, 1 - (t - clench) / 0.25) : 1;
    const flick = Math.floor(clock * 30) % 7 === 0 ? 0.6 : 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = out * flick;
    ctx.shadowColor = CL_COL.main; ctx.shadowBlur = 18;
    ctx.fillStyle = `rgba(${CL_COL.rgb},0.4)`; ctx.beginPath(); ctx.ellipse(cx, py, 30 * (1 - cl * 0.3), 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(cx, py, 18 * (1 - cl * 0.3), 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    const tips = [];
    for (let i = 0; i < 5; i++) {
      const spread = (i - 2) * 26 * (1 - cl * 0.85), len = (46 + (i === 2 ? 10 : 0)) * (1 - cl * 0.45);
      const x0 = cx + (i - 2) * 11, y0 = py + 12, x1 = cx + spread, y1 = y0 + len;
      drawLightning(ctx, x0, y0, x1, y1, CL_COL.core, CL_COL.rgb, 3, i * 11, 0.95 * out * flick);
      tips.push([x1, y1]);
    }
    a.clHand = { x: cx, y: py, tips };
    ctx.restore();
  }, null, (u) => {
    const h = a.clHand;
    if (!h || Math.random() > 0.6) return;
    const [tx, ty] = h.tips[Math.floor(Math.random() * h.tips.length)] || [h.x, h.y];
    parts.push({ x: tx + rand(-4, 4), y: ty, vx: rand(-15, 15), vy: rand(10, 40), g: 60, size: 1.5, color: Math.random() < 0.5 ? CL_COL.core : CL_COL.main, life: 0.3, t: 0, add: true });
  });
}
// 연쇄: 대상 목록을 차례로 잇는 번개 (i 번째 타격은 i 번째 적까지의 줄)
function clChainTo(a, from, tg, i, width = 2) {
  const t = tg[i % Math.max(1, tg.length)] || { x: a.tx(), y: a.ty() };
  arcFx(from.x, from.y, t.x, t.y, CL_COL.core, CL_COL.rgb, 0.2, width);
  return t;
}

Object.assign(SKILL_FX, {
  chainLightning: {
    pose(u, a) {
      const m = a.mast || 0, d = a.k ? a.k.dur : 1, t = u * d;
      if (m === 0) return ilKeys(t, [[0, {}], [0.22, { bowA: -0.5, pull: 8, dx: -1 }], [0.34, { bowA: -0.55, pull: 10, dx: -1 }], [0.4, { bowA: 0.45, pull: 0, dx: 3, skew: 0.1 }], [0.7, {}]]);
      if (m === 1) return ilKeys(t, [[0, {}], [0.2, { bowA: -0.6, pull: 6, dx: -1, sy: 1.02 }], [0.44, { bowA: -0.7, pull: 13, dx: -2, skew: -0.08, sy: 1.04 }],
        [0.5, { bowA: 0.5, pull: 0, dx: 4, skew: 0.14, sy: 0.96 }], [0.72, { bowA: 0.35, dx: 2, skew: 0.06 }], [1, {}]]);
      if (m === 2) return ilKeys(t, [[0, {}], [0.25, { bowA: -0.3, pull: 10, dx: -1, sy: 1.03 }], [0.5, { bowA: -0.35, pull: 13, dx: -1, sy: 1.04, lift: 2 }],
        [0.62, { bowA: 0.3, pull: 4, dx: 3, skew: 0.1, sy: 0.98 }], [1.4, { bowA: 0.25, pull: 4, dx: 3, skew: 0.08 }], [1.6, {}]]);
      // ★★★: 지팡이를 하늘로 치켜들고(0.3~1.5) 손이 내려오는 동안 떠 있다가, 움켜쥘 때 내리긋는다(1.72)
      return ilKeys(t, [[0, {}], [0.3, { bowA: -1.3, pull: 10, sy: 1.06, lift: 3, skew: -0.1 }], [1.5, { bowA: -1.35, pull: 13, sy: 1.06, lift: 5, skew: -0.12 }],
        [1.6, { bowA: -1.5, pull: 13, sy: 1.1, lift: 7, skew: -0.14 }], [1.72, { bowA: 0.8, pull: 0, dx: 4, sy: 0.9, skew: 0.18 }], [1.85, { bowA: 0.6, dx: 3, sy: 0.94, skew: 0.1 }], [2.0, {}]]);
    },
    tick(a, u) {
      const m = a.mast, d = a.k.dur, t = u * d;
      if (m === 1 && t > 0.15 && t < 0.46 && Math.random() < 0.6) clCrackle(a, 8 + 10 * segU(t, 0.15, 0.46), 1);
      if (m === 2 && t > 0.2 && t < 0.55 && Math.random() < 0.4) clCrackle(a, 8, 1);
      if (m >= 3 && t > 0.3 && t < 1.6 && Math.random() < 0.3) clCrackle(a, 12, 1);
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast, hits = a.k.hits;
      if (m === 0) return [[(hits[0][0] * d - 0.03) / d, (a) => { const p = ilTip(a); arcFx(p.x, p.y, a.tx(), a.ty(), CL_COL.core, CL_COL.rgb, 0.16, 1.5); burst(p.x, p.y, 4, [CL_COL.core, CL_COL.main], 60, 2, 0); }]];
      if (m === 1) return [[(hits[0][0] * d - 0.03) / d, (a) => {
        const p = ilTip(a), tg = a.targets(0);
        a.clLast = clChainTo(a, p, tg, 0, 2.5);
        burst(p.x, p.y, 8, [CL_COL.core, CL_COL.main], 80, 2, 0); starFx(p.x, p.y, 10, CL_COL.main, 0.2);
        impact({ shake: 0.1 });
      }]];
      if (m === 2) return [[0.01, (a) => clBallFx(a, d - 0.02, 0.35, 0.55, d - 0.1, Math.max(60, ...a.targets().map((t) => Math.abs(t.x - a.px()) - 10)))], [0.55 / d, (a) => { const p = ilTip(a); burst(p.x, p.y, 8, [CL_COL.core, CL_COL.main], 80, 2, 0); }]];
      const clench = hits[3][0] * d;
      return [
        [0.01, (a) => aFx(a, 0, clench + 0.2, (u) => { const t = u * (clench + 0.2); dimBand(0.38 * Math.min(1, t / 0.4) * (t > clench ? Math.max(0, 1 - (t - clench) / 0.2) : 1), '5,5,25'); })],
        [0.3 / d, (a) => { clHandFx(a, clench - 0.3 + 0.25, 0.55, hits[2][0] * d - 0.3, clench - 0.3); const p = ilTip(a); starFx(p.x, p.y, 12, CL_COL.main, 0.3); }],
        [(clench - 0.02) / d, (a) => {
          const x = a.tx(), gy = groundY();
          impact({ stop: 0.18, shake: 0.6 });
          pillarFx(x, CL_COL.main, 36, 0.5);
          ringFx(x, CL_COL.main, 1.8, 0.55); ringFx(x, CL_COL.core, 1.1, 0.4);
          for (let i = 0; i < 6; i++) { const an = rand(0, Math.PI * 2), L = rand(40, 90); arcFx(x, gy - 30, x + Math.cos(an) * L, gy - 30 + Math.sin(an) * L * 0.5, CL_COL.core, CL_COL.rgb, 0.25, 2, i * 0.02); }
          skFx(null, 0, 0.3, (u) => dimBand(0.75 * (1 - u), '230,240,255'));
        }],
      ];
    },
    hit(a, i, n) {
      const m = a.mast, tg = a.targets(i), last = i === n - 1;
      if (m === 0) { for (const t of tg) clZap(t.x, t.y, 0.7); impact({ shake: 0.06 }); return; }
      if (m === 1) {
        // 건너뛰기: 직전에 맞은 적에서 이번 적으로
        const from = a.clLast || ilTip(a), t = tg[i % Math.max(1, tg.length)] || { x: a.tx(), y: a.ty() };
        if (i > 0) arcFx(from.x, from.y, t.x, t.y, CL_COL.core, CL_COL.rgb, 0.2, 2);
        a.clLast = t;
        clZap(t.x, t.y, i === 0 ? 1.1 : 0.9);
        impact({ stop: 0.03, shake: 0.12 });
        return;
      }
      if (m === 2) {
        const b = a.clBall || ilTip(a);
        for (const t of tg) { arcFx(b.x, b.y, t.x, t.y, CL_COL.core, CL_COL.rgb, 0.16, 1.5); clZap(t.x, t.y, 0.7); }
        impact({ shake: 0.08 });
        return;
      }
      if (!last) {
        const h = a.clHand, tip = h && h.tips[i * 2] ? h.tips[i * 2] : [a.tx(), 0];
        for (const t of tg) { arcFx(tip[0], tip[1], t.x, t.y, CL_COL.core, CL_COL.rgb, 0.2, 2); clZap(t.x, t.y, 0.8); }
        impact({ stop: 0.03, shake: 0.14 });
        return;
      }
      for (const t of tg) { clZap(t.x, t.y, 1.8); burst(t.x, t.y, 16, [CL_COL.core, CL_COL.main, CL_COL.gold], 220, 3, 260); }
    },
    marks(a, t, pow, i, n) {
      const m = a.mast;
      if (m === 0) return;
      clSparks(t, m >= 3 && i === n - 1 ? 5 : 3, m >= 3 && i === n - 1 ? 0.55 : 0.4);
    },
    kb: 8,
  },
});
