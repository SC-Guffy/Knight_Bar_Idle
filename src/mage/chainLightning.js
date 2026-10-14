'use strict';
// 연쇄 번개 연출 (electromancer). 수치·단계는 src/classes.js 의 SKILLS.chainLightning
//  Lv1 「전격」 지팡이 끝에서 번개 한 줄기가 대상에게 곧게 꽂힌다
//  ★ 「연쇄 번개」 지팡이 끝이 타닥거리다 번개가 날아가 — 맞은 적에서 다음 적으로 세 번 건너뛴다 (맞은 자리에 전기 가시)
//  ★★ 「뇌전 구체」 지팡이 끝에 구전(球電)이 맺혀 떠오르고, 앞으로 굴러가며 둘레의 적에게 계속 번개를 튀긴다
//  ★★★ 「뇌신의 손」 하늘이 어두워지고 대상 위로 번개로 된 거대한 손(E40)이 내려와 — 손가락 끝마다 번개를 꽂다가 움켜쥐면
//        대상들을 가로로 잇는 번개 사슬이 차례로 터진다 (줄로 잇는 피니시 — 위에서 꽂는 낙뢰 ★★★ 와 다르다)
// 번개 줄은 src/vfx-mage.js 의 mgBolt · mgArcFx (P11 번개 타일을 이어 붙인다, 평타 번개탄과 같은 모양). 하단바 전체를 덮지 않는다
// 자세·지팡이 끝 위치는 iceLance.js 의 ilKeys · ilTip 을 그대로 쓴다 (지팡이 직업 공통)

// 뇌전 색: 빙결(청백)과 띄우려고 연보라 + 연노랑 빛 (skill-vfx.md ⑤-1). 그림은 src/vfx-mage.js 의 텍스처 번개(P11)·E40·E41·K27
const CL_COL = { main: '#b58cff', rgb: '181,140,255', core: '#ffffff', gold: '#fff2a0' };

// 지팡이 끝의 타닥거림: 끝 둘레에서 짧은 번개 가닥이 무작위로 튄다
function clCrackle(a, r = 10, n = 2) {
  const p = ilTip(a), ramp = mgA(a, 'storm');
  for (let i = 0; i < n; i++) {
    const an = rand(0, Math.PI * 2), L = rand(r * 0.6, r);
    mgArcFx(p.x, p.y, p.x + Math.cos(an) * L, p.y + Math.sin(an) * L, ramp, 0.06, { scale: 2 / 3, jag: 0.15 });
  }
}
// 맞은 적 둘레의 전기 가시 (타격 자국 대신): 짧은 번개 가닥 몇 개가 잠깐 떨린다
function clSparks(t, n = 3, life = 0.4, ramp = mgRamp('storm')) {
  // 맞은 적 둘레에 짧은 텍스처 번개 가닥 몇 개가 잠깐 떨린다 (뇌전 계열 공용 — 낙뢰·뇌제가 자기 램프를 넘긴다)
  const list = [];
  for (let j = 0; j < Math.min(3, n); j++) list.push([rand(0, Math.PI * 2), rand(10, 16), rand(0, 100)]);
  skFx(null, 0, life, (u) => {
    if (Math.floor(u * 20) % 3 === 2) return;
    for (const [an, L, sd] of list) mgBolt(t.x, t.y, t.x + Math.cos(an) * L, t.y + Math.sin(an) * L * 0.6, ramp, { scale: 2 / 3, seed: sd, alpha: 1 - u });
  });
}
// 번개가 꽂힌 자리: 하얀 섬광 + 파란 파편
function clZap(x, y, size = 1, ramp = mgRamp('storm')) {
  // 번개가 꽂힌 자리 = K27 연결 지점 방전 (size 1.4 이상 1배·4/3배)
  texFx('k27', x, y, ramp, { life: 0.22 + 0.06 * size, scale: size >= 1.6 ? 4 / 3 : size >= 1 ? 1 : 2 / 3, fade: 0.35, flip: Math.random() < 0.5 });
}
// ★★ 구전: 지팡이 끝에 맺혀(form 초) 떠오른 뒤 앞으로 굴러간다 (roll 구간, dist 만큼). a.clBall 에 지금 자리를 둔다
function clBallFx(a, life, form, rollFrom, rollTo, dist) {
  // ★★ 구전 = E41 루프. 지팡이 끝에 맺혀(form 초, 2/3 → 1배) 떠오른 뒤 앞으로 굴러간다. 둘레로 짧은 텍스처 번개를 튀긴다
  const ramp = mgA(a, 'storm');
  a.clBall = null;
  aFx(a, 0, life, (u) => {
    const t = u * life, tip = ilTip(a), gy = groundY();
    let x, y, sc;
    if (t < form) { x = tip.x; y = tip.y; sc = t < form * 0.5 ? 2 / 3 : 1; }
    else if (t < rollFrom) { const k = easeOut(segU(t, form, rollFrom)); x = mix(tip.x, tip.x + a.dir * 16, k); y = mix(tip.y, gy - 30, k); sc = 1; }
    else { const k = easeOut(segU(t, rollFrom, rollTo)); x = tip.x + a.dir * (16 + dist * k); y = gy - 30 + Math.sin(t * 6) * 3; sc = 4 / 3; }
    const out = u > 0.9 ? (1 - u) / 0.1 : 1;
    a.clBall = { x, y };
    vfxDraw(ctx, 'e41', ramp, mgLoop('e41', 14), x, y, { scale: sc, alpha: out, flip: Math.floor(clock * 7) % 2 === 0 });
    if (Math.floor(clock * 15) % 3 === 0) { const an = rand(0, Math.PI * 2); mgBolt(x, y, x + Math.cos(an) * 20, y + Math.sin(an) * 14, ramp, { scale: 2 / 3, alpha: 0.8 * out }); }
  });
}
// ★★★ 뇌신의 손: 대상 위 하늘에서 손바닥(타원)과 손가락 다섯(번개 줄)이 내려온다. grab 이후엔 손가락이 오므라들고 clench 에 터진다
function clHandFx(a, life, descend, grab, clench) {
  // ★★★ 뇌신의 손 = E40 도트 번개 손 (손가락이 아래). 대상 위 하늘에서 내려오고(descend), grab 부터 손가락을 오므려 clench 에 움켜쥔다 (뒤 프레임들)
  const cx = a.tx(), ramp = mgA(a, 'storm'), n = VFX_SHEETS.e40.frames;
  a.clHand = { x: cx, y: 0, tips: [] };
  aFx(a, 0, life, (u) => {
    const t = u * life, gy = groundY();
    const py = -30 + easeOut(Math.min(1, t / descend)) * (gy - 96 + 30);
    const f = t < grab ? Math.floor(clock * 12) % 3 : Math.min(n - 1, 3 + Math.floor((t - grab) / Math.max(0.03, (clench - grab) / (n - 3))));
    const out = t > clench ? Math.max(0, 1 - (t - clench) / 0.25) : 1, sc = 4 / 3, hw = mgPx('e40', sc);
    vfxDraw(ctx, 'e40', ramp, f, cx, py, { scale: sc, alpha: out });
    // 손가락 끝 다섯 자리 (시트 아래쪽 가장자리를 다섯으로 나눈 곳) — 오므리면 가운데로 모인다
    const cl = t > grab ? Math.min(1, (t - grab) / Math.max(0.01, clench - grab)) : 0, tips = [];
    for (let i = 0; i < 5; i++) tips.push([cx + (i - 2) * hw * 0.18 * (1 - cl * 0.7), py + hw * 0.42 * (1 - cl * 0.3)]);
    a.clHand = { x: cx, y: py, tips };
  });
}
// 연쇄: 대상 목록을 차례로 잇는 번개 (i 번째 타격은 i 번째 적까지의 줄)
function clChainTo(a, from, tg, i, width = 2) {
  const t = tg[i % Math.max(1, tg.length)] || { x: a.tx(), y: a.ty() };
  mgArcFx(from.x, from.y, t.x, t.y, mgA(a, 'storm'), 0.2, { scale: width >= 2.5 ? 1 : 2 / 3 });
  return t;
}

function clChainFinish(a) {
  // ★★★ 피니시 = 줄로 잇는다: 움켜쥔 손에서 대상들을 왼쪽→오른쪽으로 굵은 번개 사슬이 차례로 잇고, 이음매(K27)마다 하나씩 터진다.
  //  낙뢰 ★★★ 처럼 위에서 꽂는 기둥·하늘 균열은 쓰지 않는다
  const ramp = mgA(a, 'storm'), h = a.clHand || { x: a.tx(), y: groundY() - 90 };
  const tg = a.targets().slice().sort((p, q) => p.x - q.x);
  if (!tg.length) tg.push({ x: a.tx(), y: a.ty() });
  const ends = [{ x: tg[0].x - 46, y: tg[0].y + 4 }, ...tg, { x: tg[tg.length - 1].x + 46, y: tg[tg.length - 1].y + 4 }];
  mgArcFx(h.x, h.y + 20, tg[0].x, tg[0].y, ramp, 0.3, { scale: 1 });
  for (let i = 0; i + 1 < ends.length; i++) {
    const p = ends[i], q = ends[i + 1], dl = 0.04 * i;
    mgArcFx(p.x, p.y, q.x, q.y, ramp, 0.42, { scale: 1, jag: 0.4 }, dl);
    mgArcFx(p.x, p.y + 4, q.x, q.y + 4, ramp, 0.3, { scale: 2 / 3, jag: 0.6, alpha: 0.7 }, dl + 0.06);
    texFx('k27', q.x, q.y, ramp, { delay: dl + 0.03, life: 0.34, scale: i + 1 < ends.length - 1 ? 4 / 3 : 2 / 3, fade: 0.35 });
  }
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
      if (m === 0) return [[(hits[0][0] * d - 0.03) / d, (a) => { const p = ilTip(a); mgArcFx(p.x, p.y, a.tx(), a.ty(), mgA(a, 'storm'), 0.16, { scale: 2 / 3 }); burst(p.x, p.y, 4, [CL_COL.core, CL_COL.main], 60, 2, 0); }]];
      if (m === 1) return [[(hits[0][0] * d - 0.03) / d, (a) => {
        const p = ilTip(a), tg = a.targets(0);
        a.clLast = clChainTo(a, p, tg, 0, 2.5);
        burst(p.x, p.y, 8, [CL_COL.core, CL_COL.main], 80, 2, 0); starFx(p.x, p.y, 10, CL_COL.main, 0.2);
        impact({ shake: 0.1 });
      }]];
      if (m === 2) return [[0.01, (a) => clBallFx(a, d - 0.02, 0.35, 0.55, d - 0.1, Math.max(60, ...a.targets().map((t) => Math.abs(t.x - a.px()) - 10)))], [0.55 / d, (a) => { const p = ilTip(a); burst(p.x, p.y, 8, [CL_COL.core, CL_COL.main], 80, 2, 0); }]];
      const clench = hits[3][0] * d;
      return [
        [0.01, (a) => aFx(a, 0, clench + 0.2, (u) => { const t = u * (clench + 0.2); dimSpan(a.px() - a.dir * 30, a.tx() + a.dir * 40, 0.38 * Math.min(1, t / 0.4) * (t > clench ? Math.max(0, 1 - (t - clench) / 0.2) : 1), '5,5,25'); })],   // 손~대상 구간만
        [0.3 / d, (a) => { clHandFx(a, clench - 0.3 + 0.25, 0.55, hits[2][0] * d - 0.3, clench - 0.3); const p = ilTip(a); starFx(p.x, p.y, 12, CL_COL.main, 0.3); }],
        [(clench - 0.02) / d, (a) => {
          impact({ stop: 0.18, shake: 0.6 });
          clChainFinish(a);
        }],
      ];
    },
    hit(a, i, n) {
      const m = a.mast, tg = a.targets(i), last = i === n - 1;
      const ramp = mgA(a, 'storm');
      if (m === 0) { for (const t of tg) clZap(t.x, t.y, 0.7, ramp); impact({ shake: 0.06 }); return; }
      if (m === 1) {
        // 건너뛰기: 직전에 맞은 적에서 이번 적으로
        const from = a.clLast || ilTip(a), t = tg[i % Math.max(1, tg.length)] || { x: a.tx(), y: a.ty() };
        if (i > 0) mgArcFx(from.x, from.y, t.x, t.y, ramp, 0.2, { scale: 2 / 3 });
        a.clLast = t;
        clZap(t.x, t.y, i === 0 ? 1.1 : 0.9, ramp);
        impact({ stop: 0.03, shake: 0.12 });
        return;
      }
      if (m === 2) {
        const b = a.clBall || ilTip(a);
        for (const t of tg) { mgArcFx(b.x, b.y, t.x, t.y, ramp, 0.16, { scale: 2 / 3 }); clZap(t.x, t.y, 0.7, ramp); }
        impact({ shake: 0.08 });
        return;
      }
      if (!last) {
        const h = a.clHand, tip = h && h.tips[i * 2] ? h.tips[i * 2] : [a.tx(), 0];
        for (const t of tg) { mgArcFx(tip[0], tip[1], t.x, t.y, ramp, 0.2, { scale: 2 / 3 }); clZap(t.x, t.y, 0.8, ramp); }
        impact({ stop: 0.03, shake: 0.14 });
        return;
      }
      for (const t of tg) burst(t.x, t.y, 10, [CL_COL.core, CL_COL.main, CL_COL.gold], 220, 2, 260);   // 사슬 이음매의 K27 은 clChainFinish 가
    },
    // 명중 그림 K27 (연결 지점 방전)은 hit 의 clZap·clChainFinish 가 맞는 자리마다 그린다 — 여기서는 옛 검흔·파편을 끈다
    hitTex() {},
    kb: 8,
  },
});
