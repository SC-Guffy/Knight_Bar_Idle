'use strict';
// 3차 궁극기 「뇌제 강림」 연출 (thunderEmperor — 뇌제). 수치·단계는 src/classes.js 의 SKILLS.thunderJudgment, 레터박스·컷인은 src/skills.js 의 drawUltScreen.
//  ⑤-1 새 콘셉트 (skill-vfx.md): 2차 낙뢰 ★★★ 부품(하늘 균열·기둥 번개)을 다시 쓰지 않는다. 금빛 번개 + 뇌신 거인 + 왕관 번개.
//  Lv1 「뇌제의 벼락」 하단바 하늘이 먹구름(C15)으로 덮이고 금빛 벼락 한 줄기가 적에게 내리꽂혀 왕관 모양(K40)으로 터진 뒤, 땅을 따라 번개가 양끝까지 번진다
//  ★ 「뇌제 강림」 먹구름 위로 번개로 된 뇌신 거인(F20)이 떠올라 팔을 내리치면 하단바 전체에 금빛 벼락이 쏟아진다
//  ★★ 「만뢰」 거인 아래로 하늘 끝에서 끝까지 금빛 번개 그물이 얽히고, 수십 줄기 벼락이 땅을 두드린다
//  ★★★ 「천둥의 왕좌」 거인이 번개의 왕좌(F21)에 앉고 하단바가 하얗게 멎으면 — 모든 적의 머리 위로 왕관 번개(K40)가 내리꽂혀 띄운다
// 그림: src/vfx-mage.js 의 텍스처 번개(P12 굵은 금빛 마디 타일 mgBolt), 먹구름 tsCloudFx(C15), K40 왕관 번개. 막타 흰 섬광은 α ≤ 0.6·0.15초 (마지막 그림이 보이게)

const TJ_COL = { main: '#ffe27a', rgb: '255,226,122', core: '#ffffff', gold: '#f0b830' };
const tjDur = (a) => (a.k ? a.k.dur : 2.7);
const tjHitT = (a) => (a.k ? a.k.hits.map((h) => h[0] * a.k.dur) : [1.35, 2.5]);
const tjEnv = (t, from, to, fin, fout) => Math.min(clamp01((t - from) / fin), clamp01((to - t) / fout));
const tjBase = () => groundY() - 7;
const tjRamp = (a) => mgA(a, 'tempest');
const TJ_CLOUD = ['#14100c', '#2a2218', '#463a26', '#6e5a34', '#a68c4c'];   // 금빛이 비치는 먹구름 (C15 를 다시 칠함)

function tjSky(a, life, dim, color = '4,4,20') {
  backFx(a, 0, life, (u) => { const t = u * life; dimBand(dim * tjEnv(t, 0.15, life - 0.15, 0.4, 0.3), color); });
}
// 하단바 전체를 덮는 먹구름 띠 (세 덩이)
function tjCloudBand(a, life) { for (let i = 0; i < 3; i++) tsCloudFx(W * (0.2 + 0.3 * i), 200, life, 0.05 * i, TJ_CLOUD); }
// 땅을 따라 양끝까지 번지는 금빛 번개 (P12 타일)
function tjGroundArcs(a, x0, n = 6, life = 0.3) {
  const by = tjBase(), ramp = tjRamp(a);
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
    const xa = x0 + s * i * 70, xb = x0 + s * (i + 1) * 70;
    if (xa < -20 || xa > W + 20) break;
    mgArcFx(xa, by - 2, xb, by - 2 - rand(0, 6), ramp, life, { sheet: 'p12', scale: 2 / 3 }, 0.04 * i);
  }
}
// 하늘에서 땅으로 내리꽂는 금빛 벼락 한 줄기 (P12 타일을 세로로)
function tjBolt(a, x, life = 0.2, sc = 2 / 3, delay = 0) {
  mgArcFx(x + rand(-14, 14), -10, x, groundY() - 2, tjRamp(a), life, { sheet: 'p12', scale: sc, jag: 0.35 }, delay);
}
// 왕관 번개 K40 (땅 기준): 대상 머리 위에서 내리꽂혀 왕관 모양으로 갈라진다
function tjCrown(a, x, sc = 1, delay = 0) {
  mgFx(a, 'k40', x, groundY() + 3, tjRamp(a), { scale: sc, life: 0.45, delay, anchor: 'b', fade: 0.3 });
}
// ★ 이상 뇌신 거인 F20: 하단바 가운데 먹구름 위로 떠오른다(rise 0.5초). strikeAt 부터 뒤 프레임(팔을 내리침)으로, 끝나면 흐려진다
function tjGiantFx(a, life, from, strikeAt) {
  const ramp = tjRamp(a), n = VFX_SHEETS.f20.frames;
  backFx(a, 0, life, (u) => {
    const t = u * life;
    if (t < from) return;
    const up = easeOut(Math.min(1, (t - from) / 0.5)), out = t > strikeAt + 0.5 ? Math.max(0, 1 - (t - strikeAt - 0.5) / 0.3) : 1;
    const f = t < strikeAt ? Math.floor(clock * 8) % 3 : Math.min(n - 1, 3 + Math.floor((t - strikeAt) / 0.07));
    const flick = Math.floor(clock * 30) % 11 === 0 ? 0.6 : 1;
    vfxDraw(ctx, 'f20', ramp, f, W / 2, 64 + (1 - up) * 50, { scale: 1, alpha: up * out * flick * 0.92 });
  });
}
// ★★ 이상 하늘의 금빛 번개 그물: 하단바 끝에서 끝까지 매듭을 잇는다 (매 프레임 다른 모양)
function tjSkyNetFx(a, life, from) {
  const knots = [], ramp = tjRamp(a);
  for (let i = 0; i < 7; i++) knots.push([W * i / 6 + rand(-10, 10), 16 + rand(0, 26)]);
  backFx(a, 0, life, (u) => {
    const t = u * life;
    if (t < from) return;
    const k = Math.min(1, (t - from) / 0.4), out = t > life - 0.3 ? (life - t) / 0.3 : 1, al = k * out * (Math.floor(clock * 24) % 5 === 0 ? 0.45 : 0.9);
    for (let i = 0; i + 1 < knots.length; i++) mgBolt(knots[i][0], knots[i][1], knots[i + 1][0], knots[i + 1][1], ramp, { sheet: 'p12', scale: 2 / 3, seed: i, alpha: al });
    for (let i = 1; i + 1 < knots.length; i += 2) mgBolt(knots[i][0], knots[i][1], knots[i][0] + rand(-10, 10), knots[i][1] + 40, ramp, { scale: 2 / 3, seed: i * 3, alpha: al * 0.7 });
  });
}
// ★★★ 번개의 왕좌 F21: 거인 뒤(먼저 그림)에 나타나 그물을 내린다
function tjThroneFx(a, life, from, strikeAt) {
  const ramp = tjRamp(a);
  backFx(a, 0, life, (u) => {
    const t = u * life;
    if (t < from) return;
    const k = Math.min(1, (t - from) / 0.5), out = t > strikeAt + 0.4 ? Math.max(0, 1 - (t - strikeAt - 0.4) / 0.3) : 1;
    vfxDraw(ctx, 'f21', ramp, mgLoop('f21', 10), W / 2, 76, { scale: k < 0.5 ? 1 : 4 / 3, alpha: k * out * 0.9 });
  });
}

function tjStage0(a) {
  const D = tjDur(a), life = D + 0.3, cx = a.tx();
  tjSky(a, life, 0.45);
  tsCloudFx(cx, 240, life, 0.05, TJ_CLOUD);
}
function tjStage1(a) {
  const D = tjDur(a), ht = tjHitT(a), life = D + 0.35, tf = ht[ht.length - 1];
  tjSky(a, life, 0.55);
  tjCloudBand(a, life);
  tjGiantFx(a, life, 0.35, tf - 0.12);
}
function tjStage2(a) {
  const D = tjDur(a), ht = tjHitT(a), life = D + 0.35, tf = ht[ht.length - 1];
  tjSky(a, life, 0.6);
  tjCloudBand(a, life);
  tjSkyNetFx(a, life, 0.4);
  tjGiantFx(a, life, 0.3, tf - 0.12);
}
function tjStage3(a) {
  const D = tjDur(a), ht = tjHitT(a), life = D + 0.4, tf = ht[ht.length - 1];
  tjSky(a, life, 0.65, '2,2,16');
  tjCloudBand(a, life);
  tjThroneFx(a, life, 0.45, tf - 0.12);
  tjSkyNetFx(a, life, 0.4);
  tjGiantFx(a, life, 0.3, tf - 0.12);
  // 마지막 직전 하단바가 하얗게 멎는다 (α 0.22 — 왕좌와 거인이 비쳐 보이게)
  skLater(a, ht[ht.length - 2] + 0.05, () => aFx(a, 0, tf - ht[ht.length - 2] - 0.05, (u) => dimBand(0.22 * Math.min(1, u * 3), '255,248,225')));
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
      if (t > 0.35 && Math.random() < 0.35) { const p = ilTip(a), an = rand(0, Math.PI * 2), L = rand(10, 18); mgArcFx(p.x, p.y, p.x + Math.cos(an) * L, p.y + Math.sin(an) * L, tjRamp(a), 0.06, { sheet: 'p12', scale: 2 / 3, jag: 0.15 }); }
    },
    cues: (a) => {
      const D = tjDur(a), ht = tjHitT(a), m = Math.min(3, a.mast || 0);
      return [
        [0, (a) => [tjStage0, tjStage1, tjStage2, tjStage3][m](a)],
        [0.35 / D, (a) => { const p = ilTip(a); mgArcFx(p.x, p.y, p.x + rand(-30, 30), -10, tjRamp(a), 0.25, { sheet: 'p12', scale: 2 / 3 }); impact({ shake: 0.12 }); }],
        ...ht.slice(0, -1).map((t) => [(t - 0.08) / D, (a) => tsSkyFlash(a.tx(), 0.3, 0.14)]),
      ];
    },
    hit(a, i, n) {
      const m = Math.min(3, a.mast || 0), last = i === n - 1, first = i === 0, tx = a.tx();
      if (first) {
        // 첫 타: 굵은 금빛 벼락 한 줄기 + 왕관 번개, 땅을 따라 양끝까지 번진다
        tjBolt(a, tx, 0.3, 4 / 3);
        tjCrown(a, tx, m >= 2 ? 4 / 3 : 1);
        tjGroundArcs(a, tx, m >= 2 ? 8 : 5);
        aFx(a, 0, 0.15, (u) => dimBand(0.22 * (1 - u), '255,245,220'));
        impact({ stop: 0.12, shake: 0.6 });
        return;
      }
      if (!last) {
        const tg = a.targets(i);
        for (const t of tg) if (Math.random() < 0.7 || tg.length === 1) { tjBolt(a, t.x + rand(-8, 8), 0.18); clSparks(t, 2, 0.3, tjRamp(a)); }
        if (m >= 1) tjBolt(a, rand(20, W - 20), 0.18, 2 / 3);
        if (m >= 2) tjBolt(a, rand(20, W - 20), 0.18, 2 / 3, 0.04);
        impact({ stop: 0.02, shake: 0.2 });
        return;
      }
      // 막타: 모든 대상 머리 위로 왕관 번개 (★★★ 는 하단바 곳곳에도), 땅 번개, 흰 섬광 α 0.6·0.15초
      const tg = a.targets(i);
      if (!tg.length) tg.push({ x: tx, y: a.ty() });
      tg.forEach((t, j) => { tjBolt(a, t.x, 0.3, 1, 0.03 * j); tjCrown(a, t.x, m >= 3 ? 2 : 4 / 3, 0.03 * j); });
      if (m >= 3) for (let x = 40; x < W; x += 80) if (!tg.some((t) => Math.abs(t.x - x) < 40)) tjCrown(a, x + rand(-10, 10), 2 / 3, rand(0.04, 0.14));
      tjGroundArcs(a, tx, 9, 0.35);
      aFx(a, 0, 0.15, (u) => dimBand((m >= 3 ? 0.45 : 0.35) * (1 - u), '255,248,230'));
      impact({ stop: m >= 3 ? 0.3 : 0.22, shake: m >= 3 ? 0.95 : 0.85 });
    },
    // 맞은 자리 둘레에 금빛 번개 가닥 (명중 그림 K40 은 hit 의 tjCrown 이 첫 타·막타에 그린다)
    hitTex(a, t, share, i, n) { if (i > 0 && i < n - 1) return; clSparks(t, 3, 0.4, tjRamp(a)); },
    kb: 10, launch: true,
  },
});
