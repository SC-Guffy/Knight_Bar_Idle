'use strict';
// 랜서 연출 (cavalier). 수치·단계는 src/classes.js 의 SKILLS.cavalryCharge · shieldWall
// ── 기병 돌격 ──
//  Lv1 「찌르기 돌진」 창을 내리고 짧게 달려들어 찌른다
//  ★ 「기병 돌격」 방패를 앞세우고 창을 눕혀 흙먼지를 일으키며 돌진 — 창끝의 푸른 빛줄이 일직선을 꿰뚫는다
//  ★★ 「왕복 돌격」 지나친 뒤 미끄러지며 돌아서서(등을 보인다) 반대쪽으로 한 번 더 — 잔상이 겹친다
//  ★★★ 「천마 돌격」 발밑에 빛의 천마가 나타나 기사를 태우고 하단바를 가로질러 달린다 — 발굽마다 빛이 튀고 끝에서 충격파
// ── 방패 벽 ──
//  Lv1 「방패 들기」 앞쪽에 문장 방패 벽(E24)이 작게 선다 (3초)
//  ★ 「방패 벽」 방패를 땅에 박으면 문장 방패 셋이 벽처럼 솟는다 (4초), 테두리가 빛난다
//  ★★ 「철옹성」 방패 벽 둘레에 작은 방패 넷이 떠서 돌며 지킨다
//  (성기사 성역의 빛 원·돔과 겹치지 않게, 앞을 막는 "벽면"으로 형태를 나눴다 — 스펙 색깔놀이 점검)
//  ★★★ 「불굴의 성벽」 양옆에 성가퀴가 있는 돌 성벽이 솟고 — 끝날 때 무너지며 충격파 (finish)
// 하단바 전체를 덮지 않는다: 천마의 질주도 기사가 달린 자리에만 빛이 남는다
// 그림은 PixelLab 시트 (src/vfx-spear.js): 창끝 빛줄 W7(천마장군 W7a) · 천마 E23 · 방패 벽 E24 · 명중 K15·K16

const CV_COL = { main: '#9fd8ff', hot: '#e8f6ff', deep: '#2f4f8a', steel: '#d8dde8' };

// 창끝의 빛줄: 돌진하는 동안 창끝에서 앞으로 뻗는 돌격창 속도선(W7 키 그림, 천마장군은 W7a). hand 자리 기준, ext 만큼 앞
function cvLanceLight(a, life) {
  const id = a.cls === 'skyGeneral' ? 'w7a' : 'w7';
  aFx(a, 0, life, (u) => {
    const h = hand(a), p = castPose(a.owner) || {}, L = 70 + (p.ext || 0) * 2, out = u > 0.85 ? (1 - u) / 0.15 : 1, w0 = vfxW(id);
    if (w0) vfxDraw(ctx, id, a.color, 0, h.x + a.dir * L / 2, h.y, { sx: L / w0, flip: a.dir < 0, alpha: out });
  }, null, () => { const h = hand(a); if (Math.random() < 0.6) parts.push({ x: h.x + a.dir * rand(20, 60), y: h.y + rand(-3, 3), vx: -a.dir * rand(40, 90), vy: rand(-15, 15), g: 0, size: 2, color: Math.random() < 0.5 ? CV_COL.main : '#ffffff', life: 0.25, t: 0, add: true }); });
}
// 돌진 흙먼지: 발뒤꿈치에서 뒤로 흩어지는 먼지
function cvDust(a, n = 2) {
  for (let i = 0; i < n; i++) parts.push({ x: a.px() - a.dir * rand(4, 10), y: groundY() - rand(0, 3), vx: -a.dir * rand(30, 80), vy: rand(-30, -8), g: 140, size: Math.random() < 0.4 ? 3 : 2, color: Math.random() < 0.6 ? '#c9b38a' : '#e8dcc0', life: rand(0.3, 0.5), t: 0 });
}
function cvAfterimage(a, tint = CV_COL.main) { ghostFx(a, a.px(), (castPose(a.owner) || {}).facing || a.dir, tint, 0.2, castPose(a.owner) || {}, 0.28); }

// ★★★ 천마: 기사 발밑에 빛의 천마(E23)가 나타나 기사를 태운다 — 달리는 동안 질주 프레임, 아니면 첫 장. backFx 라 기사 뒤에 그려진다
function cvHorseFx(a, life, runFrom, runTo) {
  backFx(a, 0, life, (u) => {
    const t = u * life, inA = easeOut(Math.min(1, t / 0.25)), out = t > life - 0.25 ? (life - t) / 0.25 : 1;
    const running = t > runFrom && t < runTo;
    // 숙련 색(a.color)은 너무 옅어 흰 잔상에 묻힌다 → 말은 정해진 하늘색 램프 (천마장군은 금빛)
    vfxDraw(ctx, 'e23', a.cls === 'skyGeneral' ? '#d8b850' : '#6fa4e0', running ? vfxLoop('e23', 14) : 0, a.px() - a.dir * 6, groundY() + 3, { anchor: 'b', scale: 2 / 3, sy: 0.4 + 0.6 * inA, flip: a.dir < 0, alpha: 0.85 * inA * out });
  }, null, (u) => {
    const t = u * life;
    if (t < runFrom || t > runTo) return;
    for (let i = 0; i < 2; i++) parts.push({ x: a.px() - a.dir * rand(0, 24), y: groundY() - 1, vx: -a.dir * rand(40, 110), vy: rand(-70, -20), g: 200, size: 2, color: Math.random() < 0.5 ? CV_COL.main : '#ffffff', life: rand(0.25, 0.45), t: 0, add: true });
    cvDust(a, 1);
  });
}

// 방패 벽: 기사 앞에 문장 방패 셋이 선 벽면(E24)이 솟아오르고(앞 0.35초 동안 프레임 0~4), 서 있는 동안 테두리가 빛난다(3·4 번갈아). wardFade 로 들어오고 나간다
function cvShieldWallFx(a, life, sc = 1, al = 1) {
  aFx(a, 0, life, (u) => {
    const t = u * life, f = t < 0.35 ? Math.floor(t / 0.35 * 5) : 3 + (Math.floor(clock * 4) % 2);
    vfxDraw(ctx, 'e24', a.color, Math.min(4, f), a.x() + a.dir * 30 * sc, groundY() + 2, { anchor: 'b', scale: sc, flip: a.dir < 0, alpha: al * wardFade(u, life) });
  });
}
// 작은 방패 하나 (떠 있는 호위 방패·성벽 장식)
// 호위 방패 하나: E24 방패 벽 시트의 맨 앞 방패(오른쪽 절반)만 잘라 2/3 배로 (s 는 예전 크기 인자, 지금은 밝기만)
function cvMiniShield(x, y, s, f) {
  vfxDraw(ctx, 'e24', CV_COL.main, 4, x, y, { crop: [0.5, 1], scale: 2 / 3, alpha: f });
}
// ★★ 철옹성: 방패 벽 + 둘레를 도는 호위 방패 넷
function cvRampartFx(a, life) {
  aFx(a, 0, life, (u) => {
    const x = a.x(), gy = groundY(), f = wardFade(u, life), g = easeOut(Math.min(1, u * life / 0.35));
    for (let i = 0; i < 4; i++) {
      const an = clock * 1.6 + i * Math.PI / 2, sx = x + Math.cos(an) * 44 * g, sy = gy - 24 - Math.sin(an) * 7 * g + Math.sin(clock * 4 + i) * 2;
      cvMiniShield(sx, sy, 1.1, f * (0.6 + 0.4 * (Math.sin(an) + 1) / 2));
    }
  });
}
// ★★★ 불굴의 성벽: 양옆에 성가퀴 달린 돌 성벽이 솟는다 (방패 벽은 cues 가 따로 세운다). 끝나면 cvWallFallFx 가 무너뜨린다
function cvWallShape(x, gy, k, side) {
  const w = 20, h = 46 * k, bx = x + side * 48;
  ctx.fillStyle = '#5a6578'; ctx.fillRect(bx - w / 2, gy - h, w, h);
  ctx.fillStyle = '#7f8a9c';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) ctx.fillRect(bx - w / 2 + 2 + c * 9 + (r % 2) * 4, gy - h + 4 + r * 10, 6, 7);
  for (let i = 0; i < 3; i++) ctx.fillRect(bx - w / 2 + i * 8, gy - h - 5, 5, 5);     // 성가퀴
  cvMiniShield(bx, gy - h * 0.55, 1, 1);
}
function cvFortressFx(a, life) {
  aFx(a, 0, life, (u) => {
    const x = a.x(), gy = groundY(), f = wardFade(u, life), k = easeOut(Math.min(1, u * life / 0.4));
    ctx.save();
    ctx.globalAlpha = f;
    for (const s of [-1, 1]) cvWallShape(x, gy, k, s);
    // 성벽 사이를 잇는 빛줄
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = CV_COL.main; ctx.lineWidth = 1.5; ctx.globalAlpha = f * (0.5 + 0.3 * Math.sin(clock * 6));
    ctx.beginPath(); ctx.moveTo(x - 38, gy - 44 * k); ctx.lineTo(x + 38, gy - 44 * k); ctx.stroke();
    ctx.restore();
  }, null, (u) => { if (u * life < 0.4 && Math.random() < 0.8) for (const s of [-1, 1]) debris(a.x() + s * 48, 1, ['#7f8a9c', '#c9b38a']); });
}
function cvWallFallFx(a) {
  const x = a.x(), gy = groundY();
  ringFx(x, CV_COL.main, 1.5, 0.5); ringFx(x, '#ffffff', 1.0, 0.4);
  for (const s of [-1, 1]) { debris(x + s * 48, 16, ['#5a6578', '#7f8a9c', CV_COL.main], 1.5); for (let j = 0; j < 6; j++) parts.push({ x: x + s * rand(30, 60), y: gy - rand(10, 46), vx: s * rand(40, 120), vy: rand(-80, -20), g: 300, size: 3, color: j % 2 ? '#5a6578' : '#7f8a9c', life: rand(0.5, 0.8), t: 0 }); }
  impact({ stop: 0.08, shake: 0.35 });
}
// 방패 강타: 방패 앞으로 흙먼지가 밀려 나간다 (맞는 그림은 대상 위 K16 — shieldWall.hitTex)
function cvBashFx(a, size = 1) {
  for (let j = 0; j < Math.round(6 * size); j++) parts.push({ x: a.px() + a.dir * 14, y: groundY() - 2, vx: a.dir * rand(60, 140), vy: rand(-50, -10), g: 200, size: 2, color: j % 2 ? '#c9b38a' : CV_COL.hot, life: 0.4, t: 0 });
}

// 돌격 자세의 틀: 웅크림(0~c0) → 질주(c0~c1, dx 0→D) → 멈춤(c1~h) → 복귀(h~1)
function cvChargePose(u, c0, c1, h, D, wa = 0) {
  if (u < c0) { const c = easeOut(u / c0); return { sy: 1 - 0.1 * c, skew: -0.2 * c, dx: -4 * c, wa: mix(-1.3, wa - 0.1, c), ext: -3 * c }; }
  if (u < c1) { const s = easeOut(segU(u, c0, c1)); return { sy: 0.92, skew: 0.38, dx: mix(-4, D, s), wa: wa + Math.sin(clock * 30) * 0.02, ext: mix(-3, 10, Math.min(1, s * 2)) }; }
  if (u < h) { const r = segU(u, c1, h); return { sy: 0.92 + 0.06 * r, skew: 0.38 - 0.12 * r, dx: D, wa, ext: 10 - 4 * r }; }
  const r = easeOut(segU(u, h, 1)); return { dx: D * (1 - r), skew: 0.26 * (1 - r), wa: mix(wa, -1.3, r), ext: 6 * (1 - r) };
}

Object.assign(SKILL_FX, {
  cavalryCharge: {
    pose(u, a) {
      const m = a.mast || 0, d = a.k ? a.k.dur : 1.2, t = u * d;
      if (m === 0) return cvChargePose(u, 0.25, 0.5, 0.7, 24, -0.05);
      if (m === 1) return cvChargePose(u, 0.22, 0.5, 0.75, 56, 0);
      if (m === 2) {
        // 돌진(0.65) → 미끄러지며 돌아선다(0.65~0.95, 등을 보인다) → 되돌아 돌진(0.95~1.29) → 복귀
        if (t < 0.68) return cvChargePose(t / 1.3, 0.17, 0.5, 0.75, 58, 0);
        if (t < 0.95) { const s = easeOut(segU(t, 0.68, 0.95)); return { facing: -1, sy: 0.94, skew: -0.2 * s, dx: -(58 + 6 * s), wa: mix(0, -0.1, s), ext: -3 * s }; }
        if (t < 1.3) { const s = easeOut(segU(t, 0.95, 1.3)); return { facing: -1, sy: 0.92, skew: 0.38, dx: -mix(64, 4, s), wa: 0 + Math.sin(clock * 30) * 0.02, ext: 10 }; }
        if (t < 1.45) { const r = segU(t, 1.3, 1.45); return { facing: -1, sy: 0.96, skew: 0.26, dx: -4, wa: 0, ext: 8 - 4 * r }; }
        const r = easeOut(segU(t, 1.45, 1.7)); return { dx: 4 * (1 - r), skew: 0.2 * (1 - r), wa: mix(0, -1.3, r), ext: 4 * (1 - r) };
      }
      // ★★★ 천마: 웅크림(0.3) → 천마가 나타나 올라탄다(0.3~0.55, lift 14) → 질주(0.55~1.45, dx 170) → 충격파·멈춤(1.76) → 천마가 사라지며 내려와 복귀
      if (t < 0.3) { const c = easeOut(t / 0.3); return { sy: 1 - 0.12 * c, skew: -0.22 * c, dx: -4 * c, wa: mix(-1.3, -0.1, c), ext: -3 * c }; }
      if (t < 0.55) { const s = easeOut(segU(t, 0.3, 0.55)); return { sy: 0.92 + 0.06 * s, skew: -0.22 + 0.5 * s, dx: -4 + 6 * s, wa: 0, ext: 4 * s, lift: 14 * s }; }
      if (t < 1.45) { const s = easeOut(segU(t, 0.55, 1.45)); return { sy: 0.98, skew: 0.3, dx: mix(2, 170, s), wa: Math.sin(clock * 30) * 0.03, ext: 12, lift: 14 + Math.abs(Math.sin(clock * 11)) * 3 }; }
      if (t < 1.78) { const r = segU(t, 1.45, 1.78); return { sy: 0.98, skew: 0.3 - 0.1 * r, dx: 170 + 4 * r, wa: 0, ext: 12 - 4 * r, lift: 14 }; }
      if (t < 1.95) { const s = easeIn(segU(t, 1.78, 1.95)); return { sy: mix(0.98, 0.9, s), skew: 0.2, dx: 174, wa: 0, ext: 8, lift: 14 * (1 - s) }; }
      const r = easeOut(segU(t, 1.95, 2.1)); return { dx: 174 * (1 - r), skew: 0.2 * (1 - r), wa: mix(0, -1.3, r), ext: 8 * (1 - r), sy: mix(0.9, 1, r) };
    },
    tick(a, u, dt) {
      const m = a.mast, d = a.k.dur, t = u * d;
      if (!m) return;
      const run = m === 1 ? [0.26, 0.6] : m === 2 ? [0.22, 0.65, 0.95, 1.3] : [0.55, 1.45];
      const going = (t > run[0] && t < run[1]) || (run[2] != null && t > run[2] && t < run[3]);
      if (!going) return;
      cvDust(a, m >= 3 ? 1 : 2);
      a.cvGhost = (a.cvGhost || 0) + dt;
      if (m >= 2 && a.cvGhost > 0.08) { a.cvGhost = 0; cvAfterimage(a); }
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast, hits = a.k.hits;
      if (m === 0) return [[0.25, (a) => hopDustFx(a.px())]];
      const start = (at) => [at / d, (a) => { hopDustFx(a.px()); impact({ shake: 0.08 }); }];
      // 찌르는 순간 창끝에서 앞으로 꿰뚫는 속도선 (W7)
      const pierce = (a, f = 1, len = 100) => { const h = hand(a); vfxThrustLine('w7', h.x + f * a.dir * 20, h.y, f * a.dir, len, a.color, { life: 0.25, move: (u) => 12 * easeOut(u) }); };
      if (m === 1) return [start(0.26), [0.27 / d, (a) => cvLanceLight(a, 0.4)], [(hits[0][0] * d - 0.03) / d, (a) => pierce(a)]];
      if (m === 2) return [
        start(0.22), [0.23 / d, (a) => cvLanceLight(a, 0.45)],
        [(hits[0][0] * d - 0.03) / d, (a) => pierce(a)],
        [0.7 / d, (a) => { for (let j = 0; j < 8; j++) parts.push({ x: a.px() + a.dir * 4, y: groundY() - 1, vx: a.dir * rand(30, 90), vy: rand(-40, -10), g: 180, size: 2, color: '#c9b38a', life: 0.4, t: 0 }); }],
        [0.96 / d, (a) => { hopDustFx(a.px()); cvLanceLight(a, 0.38); impact({ shake: 0.08 }); }],
        [(hits[1][0] * d - 0.03) / d, (a) => pierce(a, -((castPose(a.owner) || {}).facing || 1))],
      ];
      const boom = hits[3][0] * d;
      return [
        [0.3 / d, (a) => { cvHorseFx(a, boom - 0.3 + 0.3, 0.25, 1.15); gatherFx(a.px(), groundY() - 20, [CV_COL.main, '#ffffff'], 3, 30); }],
        [0.55 / d, (a) => { ringFx(a.px(), CV_COL.main, 1.0, 0.4); impact({ shake: 0.12 }); cvLanceLight(a, boom - 0.55); }],
        ...hits.slice(0, 3).map((h) => [(h[0] * d - 0.03) / d, (a) => pierce(a, 1, 90)]),
        [(boom - 0.02) / d, (a) => {
          // 멈추는 자리의 창끝 돌파 충격(K15)이 터진다 (하단바 끝 가까이라 1배 — 양 끝 밝기 기준)
          const x = a.px() + a.dir * 30;
          impact({ stop: 0.14, shake: 0.55 });
          ringFx(x, CV_COL.main, 1.8, 0.55);
          texFx('k15', x - a.dir * 44, groundY() - 18, a.color, { scale: 1, life: 0.4, flip: a.dir < 0, fade: 0.3 });
          debris(x, 14, ['#c9b38a', CV_COL.main, '#ffffff'], 1.6);
          skFx(null, 0, 0.25, (u) => localFlash(x - a.dir * 50, groundY() - 14, 44, 0.45 * (1 - u), '200,230,255'));   // 충격파 지점 둘레만
        }],
      ];
    },
    hit(a, i, n) {
      const m = a.mast, last = i === n - 1;
      if (m === 0) { impact({ stop: 0.04, shake: 0.1 }); return; }
      if (m >= 3 && last) return;
      impact(m >= 3 ? { stop: 0.03, shake: 0.12 } : { stop: 0.08, shake: 0.3 });
    },
    // 명중 그림 K15 (창끝 돌파 충격 + 말발굽 먼지). ★★ 되돌아 찌르는 둘째 타격은 반대로 뒤집는다
    hitTex(a, t, share, i, n) {
      const back = a.mast === 2 && i === 1 ? -((castPose(a.owner) || {}).facing || 1) : 1;
      vfxSkillHit('k15', { mast: a.mast, color: a.color, dir: a.dir * back }, t, share, i, n, { dx: 4 });
    },
    kb: 28, launch: true,
  },

  shieldWall: {
    pose(u, a) {
      const m = a.mast || 0, d = a.k ? a.k.dur : 1.0, t = u * d, hits = a.k ? a.k.hits : [[0.5]];
      // 창을 세워 땅에 짚고(wa -1.57) 몸을 낮춘다. 타격마다 앞으로 짧게 밀친다 (dx 튀기)
      let push = 0;
      for (const h of hits) { const ht = h[0] * d; if (t > ht - 0.08 && t < ht + 0.12) push = Math.max(push, Math.sin(Math.PI * segU(t, ht - 0.08, ht + 0.12))); }
      if (t < 0.3) { const r = easeOut(t / 0.3); return { wa: mix(-1.3, -1.57, r), ext: -4 * r, sy: 1 - 0.1 * r, skew: -0.08 * r, dx: 6 * push }; }
      if (m >= 3 && t < 0.45) { const r = segU(t, 0.3, 0.45); return { wa: -1.57, ext: -4, sy: 0.9 + 0.12 * r, skew: -0.08 - 0.08 * r, lift: 6 * r, dx: 6 * push }; }
      return { wa: -1.57, ext: -4, sy: m >= 3 ? mix(1.02, 0.94, segU(t, 0.45, 0.6)) : 0.9 + 0.06 * segU(t, 0.3, 1), skew: -0.08 + 0.2 * push, dx: 8 * push };
    },
    cues: (a) => {
      const k = a.k, s = k.stage || 0, d = k.dur, life = d * (1 - 0.3) + k.ward.dur;
      return [[0.3, (a) => {
        if (s === 0) { cvShieldWallFx(a, life, 2 / 3, 0.8); return; }
        const x = a.x();
        impact({ stop: 0.06, shake: 0.15 });
        ringFx(x, CV_COL.main, 1.2, 0.5); debris(x + a.dir * 10, 10, ['#c9b38a', CV_COL.main]);
        cvShieldWallFx(a, life);
        if (s === 1) return;
        for (let j = 0; j < 12; j++) parts.push({ x: x + rand(-18, 18), y: groundY() - rand(4, 36), vx: rand(-12, 12), vy: rand(-70, -35), g: -15, size: 3, color: j % 2 ? CV_COL.main : '#ffffff', life: 0.8, t: 0, add: true });
        if (s === 2) cvRampartFx(a, life); else cvFortressFx(a, life);
      }]];
    },
    hit(a, i, n) {
      const m = a.mast, last = i === n - 1;
      cvBashFx(a, m >= 3 && last ? 1.6 : m >= 2 ? 1.2 : 1);
      impact(m >= 3 && last ? { stop: 0.1, shake: 0.4 } : { stop: 0.04, shake: 0.15 });
    },
    finish(a) { cvWallFallFx(a); },
    // 명중 그림 K16 (방패 문양이 찍히는 둔탁한 충격)
    hitTex(a, t, share, i, n) { vfxSkillHit('k16', a, t, share, i, n, { dx: 2 }); },
    kb: 22,
  },
});
