'use strict';
// 3차 궁극기 「뇌제 강림」 연출 (thunderEmperor — 뇌제). 수치·단계는 src/classes.js 의 SKILLS.thunderJudgment, 레터박스·컷인은 src/skills.js 의 drawUltScreen.
//  Lv1 「뇌제의 벼락」 하단바 하늘이 먹구름으로 덮이고 거대한 벼락 한 줄기가 적을 꿰뚫은 뒤, 땅을 따라 번개가 양끝까지 번진다
//  ★ 「뇌제 강림」 번개로 된 뇌제의 형상이 하늘에 떠올라 손을 내리치면 하단바 전체에 벼락이 쏟아진다
//  ★★ 「만뢰」 하단바 하늘 끝에서 끝까지 번개가 그물처럼 얽히고, 수십 줄기 벼락이 땅을 두드린다
//  ★★★ 「천둥의 왕좌」 하늘에 번개의 왕좌가 나타나 하단바가 하얗게 멎고 — 왕좌에서 내리는 거대한 벼락 기둥이 모든 것을 띄운다
// 뇌전술사의 tsCloudFx·tsPillarBolt·tsStrike·clSparks 와 world.js 의 drawLightning·arcFx 를 다시 쓴다

const TJ_COL = { main: '#e0f0ff', rgb: '220,240,255', core: '#ffffff', gold: '#ffe066' };
const tjDur = (a) => (a.k ? a.k.dur : 2.7);
const tjHitT = (a) => (a.k ? a.k.hits.map((h) => h[0] * a.k.dur) : [1.35, 2.5]);
const tjEnv = (t, from, to, fin, fout) => Math.min(clamp01((t - from) / fin), clamp01((to - t) / fout));
const tjBase = () => groundY() - 7;

function tjSky(a, life, dim, color = '4,4,20') {
  backFx(a, 0, life, (u) => { const t = u * life; dimBand(dim * tjEnv(t, 0.15, life - 0.15, 0.4, 0.3), color); });
}
// 하단바 전체를 덮는 먹구름 띠 (세 덩이)
function tjCloudBand(a, life) { for (let i = 0; i < 3; i++) tsCloudFx(W * (0.2 + 0.3 * i), 200, life, 0.05 * i); }
// 땅을 따라 양끝까지 번지는 번개
function tjGroundArcs(x0, n = 6, life = 0.3) {
  const by = tjBase();
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) { const xa = x0 + s * i * 70, xb = x0 + s * (i + 1) * 70; if (xa < -20 || xa > W + 20) break; arcFx(xa, by - 2, xb, by - 2 - rand(0, 6), TJ_COL.core, TJ_COL.rgb, life, 2, 0.04 * i); }
}
// ★ 뇌제의 형상: 하늘 가운데 번개로 그려진 거대한 상반신 (머리 고리·어깨·두 팔). raise→strike 사이 팔을 치켜들었다 내리친다
function tjEmperorFx(a, life, from, strikeAt) {
  const cx = W / 2;
  backFx(a, 0, life, (u) => {
    const t = u * life;
    if (t < from) return;
    const k = easeOut(Math.min(1, (t - from) / 0.5)), out = t > strikeAt + 0.5 ? Math.max(0, 1 - (t - strikeAt - 0.5) / 0.3) : 1;
    const arm = t < strikeAt ? easeOut(clamp01((t - from - 0.3) / Math.max(0.2, strikeAt - from - 0.5))) : 1, down = t >= strikeAt ? 1 : 0;
    const flick = Math.floor(clock * 30) % 9 === 0 ? 0.5 : 1, al = k * out * flick, cy = 22, seed = Math.floor(clock * 12);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al;
    ctx.shadowColor = TJ_COL.main; ctx.shadowBlur = 16;
    ctx.strokeStyle = TJ_COL.main; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 10 * k, 0, Math.PI * 2); ctx.stroke();                                   // 머리
    ctx.fillStyle = 'rgba(224,240,255,0.25)'; ctx.beginPath(); ctx.ellipse(cx, cy + 34 * k, 60 * k, 20 * k, 0, Math.PI, 0); ctx.fill();   // 어깨
    ctx.shadowBlur = 0;
    for (const s of [-1, 1]) {
      const sx = cx + s * 50 * k, sy = cy + 26 * k;
      const ex = sx + s * 50 * k, ey = down ? cy + 90 * k : sy - 40 * arm * k + 10 * k;      // 팔: 치켜들었다가 내리친다
      drawLightning(ctx, sx, sy, ex, ey, TJ_COL.core, TJ_COL.rgb, 3, seed + s * 3, al);
      if (down) drawLightning(ctx, ex, ey, ex + s * 20, groundY() - 2, TJ_COL.core, TJ_COL.rgb, 2, seed + s * 7, al * 0.8);
    }
    ctx.restore();
  });
}
// ★★ 하늘의 번개 그물: 하단바 끝에서 끝까지 번개 줄이 얽힌다 (매 프레임 다른 모양)
function tjSkyNetFx(a, life, from) {
  const knots = [];
  for (let i = 0; i < 9; i++) knots.push([W * i / 8 + rand(-10, 10), 14 + rand(0, 30)]);
  backFx(a, 0, life, (u) => {
    const t = u * life;
    if (t < from) return;
    const k = Math.min(1, (t - from) / 0.4), out = t > life - 0.3 ? (life - t) / 0.3 : 1, al = k * out * (Math.floor(clock * 24) % 5 === 0 ? 0.4 : 0.85), seed = Math.floor(clock * 10);
    for (let i = 0; i + 1 < knots.length; i++) drawLightning(ctx, knots[i][0], knots[i][1], knots[i + 1][0], knots[i + 1][1], TJ_COL.core, TJ_COL.rgb, 2, seed + i, al);
    for (let i = 1; i + 1 < knots.length; i += 2) drawLightning(ctx, knots[i][0], knots[i][1], knots[i][0] + rand(-10, 10), knots[i][1] + 40, TJ_COL.main, TJ_COL.rgb, 1, seed + i * 3, al * 0.6);
  });
}
// ★★★ 번개의 왕좌: 하늘 가운데 등받이 높은 의자 실루엣이 번개로 그려지고, 그 위에 앉은 형상 — strikeAt 에 기둥이 내린다
function tjThroneFx(a, life, from, strikeAt) {
  const cx = W / 2;
  backFx(a, 0, life, (u) => {
    const t = u * life;
    if (t < from) return;
    const k = easeOut(Math.min(1, (t - from) / 0.6)), out = t > strikeAt + 0.4 ? Math.max(0, 1 - (t - strikeAt - 0.4) / 0.3) : 1;
    const al = k * out * (Math.floor(clock * 30) % 11 === 0 ? 0.5 : 1), seed = Math.floor(clock * 8), top = 6, bottom = 70;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al;
    // 등받이 두 기둥 + 가로대 + 팔걸이
    for (const s of [-1, 1]) { drawLightning(ctx, cx + s * 34 * k, bottom, cx + s * 34 * k, top, TJ_COL.core, TJ_COL.rgb, 3, seed + s, al); drawLightning(ctx, cx + s * 34 * k, bottom - 24, cx + s * 56 * k, bottom - 22, TJ_COL.main, TJ_COL.rgb, 2, seed + s * 5, al); }
    drawLightning(ctx, cx - 34 * k, top + 4, cx + 34 * k, top + 4, TJ_COL.core, TJ_COL.rgb, 3, seed + 9, al);
    drawLightning(ctx, cx - 56 * k, bottom - 22, cx + 56 * k, bottom - 22, TJ_COL.core, TJ_COL.rgb, 2, seed + 11, al);
    // 앉은 형상: 머리 고리 + 어깨
    ctx.shadowColor = TJ_COL.main; ctx.shadowBlur = 14; ctx.strokeStyle = TJ_COL.core; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, top + 22, 8 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(224,240,255,0.3)'; ctx.beginPath(); ctx.ellipse(cx, bottom - 26, 30 * k, 14 * k, 0, Math.PI, 0); ctx.fill();
    ctx.restore();
  });
}

function tjStage0(a) {
  const D = tjDur(a), life = D + 0.3, cx = a.tx();
  tjSky(a, life, 0.45);
  tsCloudFx(cx, 240, life, 0.05);
}
function tjStage1(a) {
  const D = tjDur(a), ht = tjHitT(a), life = D + 0.35, tf = ht[ht.length - 1];
  tjSky(a, life, 0.55);
  tjCloudBand(a, life);
  tjEmperorFx(a, life, 0.35, tf - 0.05);
}
function tjStage2(a) {
  const D = tjDur(a), life = D + 0.35;
  tjSky(a, life, 0.6);
  tjCloudBand(a, life);
  tjSkyNetFx(a, life, 0.4);
}
function tjStage3(a) {
  const D = tjDur(a), ht = tjHitT(a), life = D + 0.4, tf = ht[ht.length - 1];
  tjSky(a, life, 0.65, '2,2,16');
  tjCloudBand(a, life);
  tjSkyNetFx(a, life, 0.4);
  tjThroneFx(a, life, 0.5, tf - 0.05);
  // 마지막 직전 하단바가 하얗게 멎는다
  skLater(a, ht[ht.length - 2] + 0.05, () => aFx(a, 0, tf - ht[ht.length - 2] - 0.05, (u) => dimBand(0.55 * Math.min(1, u * 3), '235,245,255')));
}

Object.assign(SKILL_FX, {
  thunderJudgment: {
    // 홀을 하늘로 치켜들고(0.35) 떠오른 채 버티다가 → 벼락마다 짧게 흔들리고 → 마지막에 홀을 내리그으며 착지한다
    pose(u, a) {
      const D = tjDur(a), t = u * D, ht = tjHitT(a), tf = ht[ht.length - 1];
      let jolt = 0;
      for (const s of ht) if (t >= s && t < s + 0.1) jolt = Math.max(jolt, 1 - (t - s) / 0.1);
      if (t < 0.35) { const c = easeOut(t / 0.35); return { bowA: -1.35 * c, pull: 10 * c, sy: 1 + 0.06 * c, skew: -0.12 * c, lift: 6 * c }; }
      if (t < tf - 0.14) { const r = segU(t, 0.35, tf - 0.14); return { bowA: -1.4 - 0.1 * r, pull: 12 + jolt * 2, sy: 1.06 + 0.04 * r, skew: -0.14 - 0.06 * jolt, lift: 6 + 10 * r + Math.sin(clock * 5) * 2 + jolt * 3 }; }
      if (t < tf) { const s = easeIn(segU(t, tf - 0.14, tf)); return { bowA: mix(-1.5, 0.9, s), pull: 13 * (1 - s), sy: mix(1.1, 0.88, s), skew: mix(-0.2, 0.22, s), lift: 16 * (1 - s), dx: 5 * s }; }
      const hold = Math.max(tf + 0.2, D - 0.3);
      if (t < hold) return { bowA: 0.8, pull: 0, sy: 0.9, skew: 0.2, dx: 5 };
      const r = easeOut(segU(t, hold, D)); return { bowA: 0.8 * (1 - r), pull: 0, sy: mix(0.9, 1, r), skew: 0.2 * (1 - r), dx: 5 * (1 - r) };
    },
    tick(a, u) {
      const D = tjDur(a), t = u * D;
      if (t > 0.35 && Math.random() < 0.4) { const p = ilTip(a), an = rand(0, Math.PI * 2), L = rand(8, 18); skFx(null, 0, 0.06, () => drawLightning(ctx, p.x, p.y, p.x + Math.cos(an) * L, p.y + Math.sin(an) * L, TJ_COL.core, TJ_COL.rgb, 1, L, 0.9)); }
    },
    cues: (a) => {
      const D = tjDur(a), ht = tjHitT(a), m = Math.min(3, a.mast || 0), tf = ht[ht.length - 1];
      return [
        [0, (a) => [tjStage0, tjStage1, tjStage2, tjStage3][m](a)],
        [0.35 / D, (a) => { const p = ilTip(a); starFx(p.x, p.y, 14, TJ_COL.main, 0.3); arcFx(p.x, p.y, p.x + rand(-30, 30), -10, TJ_COL.core, TJ_COL.rgb, 0.25, 2); impact({ shake: 0.12 }); }],
        ...ht.slice(0, -1).map((t) => [(t - 0.08) / D, (a) => tsSkyFlash(a.tx(), 0.35, 0.14)]),
        [(tf - 0.4) / D, (a) => tsSkyCrackFx(a.tx(), 0.6)],
      ];
    },
    hit(a, i, n) {
      const m = Math.min(3, a.mast || 0), last = i === n - 1, first = i === 0, tx = a.tx(), gy = groundY();
      if (first) {
        tsPillarBolt(tx, 0.4); ringFx(tx, TJ_COL.main, 1.5, 0.5); tjGroundArcs(tx, m >= 2 ? 8 : 5);
        for (const t of a.targets(0)) burst(t.x, t.y, 14, [TJ_COL.core, TJ_COL.main, TJ_COL.gold], 180, 2, 240);
        aFx(a, 0, 0.25, (u) => dimBand(0.5 * (1 - u), '230,240,255'));
        impact({ stop: 0.12, shake: 0.6 });
        return;
      }
      if (!last) {
        const tg = a.targets(i);
        for (const t of tg) if (Math.random() < 0.7 || tg.length === 1) tsStrike(t.x + rand(-8, 8), 0.9);
        if (m >= 1) boltFx(rand(20, W - 20), 0.18);
        if (m >= 2) boltFx(rand(20, W - 20), 0.18);
        impact({ stop: 0.02, shake: 0.2 });
        return;
      }
      tsPillarBolt(tx, 0.6);
      ringFx(tx, TJ_COL.main, m >= 3 ? 3 : 2.2, 0.6); ringFx(tx, TJ_COL.core, 1.3, 0.45);
      for (let x = 20; x < W; x += 36) { boltFx(x + rand(-8, 8), 0.2); ringFx(x, TJ_COL.main, 0.5, 0.5); }
      tjGroundArcs(tx, 9, 0.35);
      for (const t of a.targets(i)) burst(t.x, t.y, 22, [TJ_COL.core, TJ_COL.main, TJ_COL.gold], 240, 3, 280);
      aFx(a, 0, 0.35, (u) => dimBand((m >= 3 ? 0.95 : 0.7) * (1 - u), '240,248,255'));
      impact({ stop: m >= 3 ? 0.3 : 0.22, shake: m >= 3 ? 0.95 : 0.85 });
    },
    marks(a, t, pow, i, n) { clSparks(t, i === 0 || i === n - 1 ? 5 : 2, 0.45); },
    kb: 10, launch: true,
  },
});
