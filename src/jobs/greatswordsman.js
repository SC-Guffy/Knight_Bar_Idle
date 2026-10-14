'use strict';
// 대검전사 연출 (greatswordsman). 수치·단계는 src/classes.js 의 SKILLS.wideCleave · ramCharge
// ── 대검 횡참 ──
//  Lv1 「횡베기」 제자리에서 대검을 옆으로 한 번 — 짧은 호만 남는다
//  ★ 「대검 횡참」 대검을 등 뒤까지 넘겨 온몸으로 돌려 휘두르면, 붉은 참격파가 앞으로 날아가 일직선을 가른다
//  ★★ 「왕복 횡참」 휘두른 반동으로 한 바퀴 돌아서서 반대 손으로 한 번 더 — 참격파도 둘, 잔상이 겹친다
//  ★★★ 「단두대」 두 번 베고 대검을 머리 위로 천천히 치켜들면 몸보다 큰 강철 날이 되어 하늘을 가리고 —
//        단두대처럼 떨어져 앞을 전부 가른다 (땅이 갈라지고 바위 송곳이 줄줄이 솟는다)
// ── 돌진 격돌 ──
//  Lv1 「어깨 들이받기」 짧게 달려들어 어깨로 들이받는다
//  ★ 「돌진 격돌」 대검 끝을 땅에 끌며 불티를 튀기고 돌진해 — 끝에서 올려베어 적을 띄운다
//  ★★ 「철벽 돌파」 더 멀리 달리고 지나간 땅이 갈라지며, 뛰어올라 대검을 내리꽂아 충격파를 퍼뜨린다
//  ★★★ 「패왕 돌격」 붉은 잔상을 끌며 하단바를 가로질러 달리고 — 높이 솟구쳐 거대한 대검으로 내리찍어 모두 띄운다
// 하단바 전체를 덮지 않는다: 참격파·균열은 대상 쪽 일직선에만
// 그림은 PixelLab 시트 (src/vfx-sword.js): e12 참격파 · e13 단두대 대검 · k09 횡참 명중 / e14 땅 파임 · k10 돌진 명중 (어깨 충돌)
//  두 스킬의 마무리는 부품부터 다르다: 횡참 = 하늘에서 떨어지는 거대한 날 + 앞으로 갈라지는 참격, 돌진 격돌 = 어깨로 들이받는 원뿔 충격 + 땅을 갈아엎는 고랑

const GS_COL = { main: '#ff8a5c', hot: '#ffd0a0', dark: '#7a2a1a', steel: '#d8dde8' };

// 참격파: 대검이 지나간 자리에서 붉은 초승달이 앞으로 날아간다 (기존 waveFx 보다 넓고 납작하게)
function gsWaveFx(a, x0, dist, life = 0.45, size = 1, delay = 0) {
  const d = a.dir, y = groundY() - HAND_Y + 2, sc = swScale(size >= 1.1 ? 4 / 3 : 1, a.mast || 0);
  skFx(null, delay, life, (u) => {
    const x = x0 + d * dist * easeOut(u), fade = u > 0.6 ? (1 - u) / 0.4 : 1;
    vfxDraw(ctx, 'e12', a.color, Math.min(4, Math.floor(u * 5)), x, y, { scale: sc, flip: d < 0, alpha: fade });
  }, null, (u) => {
    if (Math.random() > 0.3) return;
    const x = x0 + d * dist * easeOut(u);
    parts.push({ x: x + rand(-4, 4), y: y + rand(-20, 20), vx: -d * rand(20, 60), vy: rand(-20, 20), g: 0, size: 2, color: Math.random() < 0.5 ? GS_COL.main : '#ffffff', life: 0.25, t: 0, add: true });
  });
}

// 거대 대검: 손에 든 대검 위에 몸만 한 강철 날을 덧그린다 (gripOf 가 실제 무기 각도를 따라간다). grow 0→1 로 자라고 glow 는 ★★★ 금빛
//  시트는 칼끝이 아래(자루가 위)인 세로 그림 — 자루 끝을 손에 맞추고 칼 각도(g.ang)로 돌린다. grow 0→1 로 자란다
function gsGiantBlade(a, grow, alpha = 1, glow = 0, id = 'e13', color = GS_COL.steel) {
  const g = gripOf(a), s = VFX_SHEETS[id];
  if (!s || !s.lv || grow <= 0) return;
  const sc = 1, L = s.h * sc * VFX_DOT * grow, hilt = 10 * grow;
  ctx.save();
  ctx.translate(g.x, g.y); ctx.rotate(g.ang - Math.PI / 2);                       // 시트의 아래(+y)가 칼끝 쪽
  vfxDraw(ctx, id, color, 0, 0, L / 2 - hilt, { scale: sc, sx: 0.6 + 0.4 * grow, sy: grow, alpha: alpha * (0.9 + 0.1 * glow) });
  ctx.restore();
}
// ★★★ 단두대: from 초부터 life 동안 대검이 자라고 (hold 까지), 그 뒤엔 그대로 따라가다 사라진다. id·color: 대검 시트 (파천참은 f06)
function gsGuillotineFx(a, from, life, growFor, id = 'e13', color = GS_COL.steel) {
  aFx(a, from, life, (u) => {
    const t = u * life, grow = easeOut(Math.min(1, t / growFor)), out = u > 0.9 ? (1 - u) / 0.1 : 1;
    gsGiantBlade(a, grow, out, 0.6 + 0.4 * Math.sin(clock * 10), id, color);
  }, null, (u) => {
    if (u * life > growFor || Math.random() > 0.5) return;
    const g = gripOf(a);
    parts.push({ x: g.x + Math.cos(g.ang) * rand(10, 60), y: g.y + Math.sin(g.ang) * rand(10, 60), vx: rand(-15, 15), vy: rand(-30, -10), g: 0, size: 2, color: Math.random() < 0.5 ? GS_COL.main : '#ffffff', life: 0.3, t: 0, add: true });
  });
}
// 땅에 끄는 대검 끝의 불티
function gsSparks(x, dir, n = 2) {
  for (let i = 0; i < n; i++) parts.push({ x: x + rand(-3, 3), y: groundY() - 1, vx: -dir * rand(40, 120), vy: rand(-90, -30), g: 260, size: Math.random() < 0.3 ? 2 : 1, color: Math.random() < 0.5 ? '#ffd257' : GS_COL.main, life: rand(0.2, 0.4), t: 0, add: true });
}
// 돌진 잔상: 붉은 기사 실루엣이 자리마다 남는다
function gsAfterimage(a) { ghostFx(a, a.px(), a.dir, GS_COL.main, 0.22, castPose(a.owner) || {}, 0.3); }
// 횡참 ★★★: 단두대가 떨어진 자리에서 앞으로 참격 충격(k09)이 줄줄이 갈라 나간다
function gsCleaveLine(a, x0, far) {
  const n = Math.max(2, Math.round(far / 34));
  for (let i = 0; i < n; i++) skLater(a, i * 0.035, () => texFx('k09', x0 + a.dir * (24 + i * 34), groundY() - 10, a.color, { scale: 1, flip: a.dir < 0, life: 0.3, fade: 0.35 }));
}
// 돌진 격돌: 땅 파임 (e14 고랑 + 흙덩이) + 어깨 충돌 원뿔(k10). pow 1 = 내리찍기, 2 = 패왕 돌격 (크게)
//  흙 고랑은 어두워서 하단바 양 끝(40px)에 걸치면 바탕화면 쪽 밝기가 바뀐다 — 끝에서 떨어뜨린다 (스펙 하단바 규칙)
function gsGouge(a, x, pow = 1) {
  const sc = pow >= 2 ? 4 / 3 : 1, half = 32 * VFX_DOT * sc + 40, gx = Math.max(half, Math.min(W - half, x));
  texFx('e14', gx, groundY() + 6, '#c9b38a', { anchor: 'b', scale: sc, flip: a.dir < 0, life: 0.6, fade: 0.35 });
  texFx('k10', Math.max(64, Math.min(W - 64, gx + a.dir * 10)), groundY() - 14, a.color, { scale: 1, flip: a.dir < 0, life: 0.35, fade: 0.3 });
}
// 달리며 대검 끝으로 땅을 갈아엎은 자리: 시전자 뒤로 고랑이 차례로 남는다
function gsGougeTrail(a, x0, dist) {
  const n = Math.max(1, Math.round(dist / 48));
  for (let i = 0; i < n; i++) skLater(a, i * 0.08, () => { const x = x0 + a.dir * i * 48; if (x > 72 && x < W - 72) texFx('e14', x, groundY() + 6, '#a8946a', { anchor: 'b', scale: 2 / 3, flip: a.dir < 0, frames: 3, life: 0.5, fade: 0.4 }); });
}

// 횡참의 기본 자세 (★): 등 뒤로 넘겼다가 허리를 돌려 수평으로 휘두른다. sw 는 휘두르는 순간(0~1 비율)
function gsCleaveBase(u, sw = 0.55) {
  const w0 = sw - 0.18, w1 = sw + 0.04;
  if (u < w0) { const w = easeOut(segU(u, 0, w0)); return { wa: mix(-2.35, -2.9, w), skew: -0.25 * w, sy: 1 - 0.08 * w, dx: -4 * w }; }
  if (u < w1) { const d = easeIn(segU(u, w0, w1)); return { wa: mix(-2.9, 0.35, d), skew: mix(-0.25, 0.35, d), sy: mix(0.92, 0.9, d), dx: mix(-4, 7, d), lift: 5 * Math.sin(Math.PI * d) }; }
  if (u < w1 + 0.2) { const h = segU(u, w1, w1 + 0.2); return { wa: 0.35 + 0.15 * h, skew: 0.35 - 0.1 * h, sy: mix(0.9, 1, h), dx: 7 }; }
  const r = easeOut(segU(u, w1 + 0.2, 1));
  return { wa: mix(0.5, -2.35, r), skew: 0.25 * (1 - r), dx: 7 * (1 - r) };
}

Object.assign(SKILL_FX, {
  wideCleave: {
    pose(u, a) {
      const m = a.mast || 0, d = a.k ? a.k.dur : 1.1, t = u * d;
      if (m === 0) {
        if (t < 0.28) { const w = easeOut(t / 0.28); return { wa: mix(-2.35, -2.6, w), skew: -0.12 * w, dx: -2 * w }; }
        if (t < 0.42) { const s = easeIn(segU(t, 0.28, 0.42)); return { wa: mix(-2.6, 0.3, s), skew: mix(-0.12, 0.25, s), dx: mix(-2, 4, s) }; }
        if (t < 0.6) return { wa: 0.3, skew: 0.25, dx: 4 };
        const r = easeOut(segU(t, 0.6, 0.8)); return { wa: mix(0.3, -2.35, r), skew: 0.25 * (1 - r), dx: 4 * (1 - r) };
      }
      if (m === 1) return gsCleaveBase(u, 0.55);
      if (m === 2) {
        // 첫 횡참(0~0.63) → 관성으로 돌아서며(등을 보인다) → 두 번째 횡참(1.08) → 복귀
        if (t < 0.7) return gsCleaveBase(t / 1.15, 0.55);
        if (t < 0.95) { const s = segU(t, 0.7, 0.95); return { facing: -1, wa: mix(0.5, -2.6, easeOut(s)), skew: -0.2, sy: 0.94, dx: -(7 + 4 * s) }; }
        if (t < 1.08) { const s = easeIn(segU(t, 0.95, 1.08)); return { wa: mix(-2.9, 0.35, s), skew: mix(-0.25, 0.35, s), dx: mix(11, 16, s), lift: 5 * Math.sin(Math.PI * s) }; }
        if (t < 1.25) return { wa: 0.4, skew: 0.3, dx: 16 };
        const r = easeOut(segU(t, 1.25, 1.5)); return { wa: mix(0.4, -2.35, r), skew: 0.3 * (1 - r), dx: 16 * (1 - r) };
      }
      // ★★★: 빠른 횡참 둘(0.8·1.04) → 대검을 머리 위로 천천히 (1.1~1.58) → 단두대 낙하(1.72) → 복귀
      if (t < 0.86) return gsCleaveBase(t / 1.1, 0.72);
      if (t < 1.1) { const s = segU(t, 0.86, 1.1); const p = gsCleaveBase(0.4 + 0.3 * s, 0.55); p.dx = 7; return p; }
      if (t < 1.58) { const s = easeOut(segU(t, 1.1, 1.58)); return { wa: mix(0.5, -1.62, s), skew: -0.12 * s, sy: 1 + 0.08 * s, dx: 7 - 3 * s, lift: 4 * s + Math.sin(clock * 9) * s }; }
      if (t < 1.72) { const s = easeIn(segU(t, 1.58, 1.72)); return { wa: mix(-1.62, 1.25, s), skew: mix(-0.12, 0.42, s), sy: mix(1.08, 0.82, s), sx: mix(1, 1.1, s), dx: mix(4, 12, s), lift: 4 * (1 - s) }; }
      if (t < 1.86) return { wa: 1.25, skew: 0.42, sy: 0.82, sx: 1.1, dx: 12 };
      const r = easeOut(segU(t, 1.86, 2.0)); return { wa: mix(1.25, -2.35, r), skew: 0.42 * (1 - r), sy: mix(0.82, 1, r), sx: mix(1.1, 1, r), dx: 12 * (1 - r) };
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast, hits = a.k.hits;
      if (m === 0) return [];
      const wave = (j, size = 1) => [(hits[j][0] * d - 0.04) / d, (a) => {
        const h = hand(a), tg = a.targets(j), far = Math.max(90, ...tg.map((t) => Math.abs(t.x - a.px()) + 40));
        gsWaveFx(a, h.x + a.dir * 16, far, 0.45, size);
        hopDustFx(a.px());
        impact({ shake: 0.12 });
      }];
      if (m === 1) return [wave(0)];
      if (m === 2) return [wave(0), [0.74 / d, (a) => gsAfterimage(a)], [0.88 / d, (a) => gsAfterimage(a)], wave(1, 1.15)];
      const drop = hits[2][0] * d;
      return [
        wave(0, 0.8), wave(1, 0.8),
        [1.1 / d, (a) => gsGuillotineFx(a, 0, drop - 1.1 + 0.3, 0.42)],
        [1.2 / d, (a) => aFx(a, 0, drop - 1.2, (u) => dimSpan(a.px() - a.dir * 30, a.tx() + a.dir * 40, 0.28 * Math.min(1, u * 4) * (u > 0.85 ? (1 - u) / 0.15 : 1), '20,5,0'))],   // 시전자~대상 구간만
        [(drop - 0.02) / d, (a) => {
          const h = hand(a), x0 = h.x + a.dir * 44, tg = a.targets(2), far = Math.max(150, ...tg.map((t) => Math.abs(t.x - a.px()) + 50));
          impact({ stop: 0.16, shake: 0.6 });
          texFx('k09', x0, groundY() - 24, a.color, { scale: 4 / 3, rot: Math.PI / 2, life: 0.45, fade: 0.35 });   // 날이 떨어진 자리: 세로로 선 횡참 충격
          debris(x0, 10, ['#5a4a42', '#c9b38a', GS_COL.main], 1.6);
          gsCleaveLine(a, x0, far);
          skFx(null, 0, 0.15, (u) => localFlash(x0, groundY() - 16, 46, 0.3 * (1 - u), '255,220,200'));   // 낙하 지점 둘레만
        }],
      ];
    },
    hit(a, i, n) {
      const m = a.mast, tg = a.targets(i), last = i === n - 1;
      if (m === 0) { for (const t of tg) burst(t.x, t.y, 3, [GS_COL.hot, '#ffffff'], 90); impact({ shake: 0.08 }); return; }
      if (m >= 3 && last) { for (const t of tg) burst(t.x, t.y, 8, [GS_COL.main, '#ffffff', GS_COL.steel], 200, 3, 260); return; }
      for (const t of tg) burst(t.x, t.y, 4, [GS_COL.main, '#ffffff', GS_COL.hot], 150);
      impact(last ? { stop: 0.08, shake: 0.28 } : { stop: 0.04, shake: 0.15 });
    },
    // 명중: 수평 참격 충격 + 쇳조각 (k09). ★★★ 단두대는 세로로 세워 크게
    hitTex(a, t, share, i, n) {
      const m = a.mast || 0, big = m >= 3 && i === n - 1;
      texFx('k09', t.x, t.y + (big ? 0 : rand(-3, 3)), a.color, { scale: swScale(1, m, big ? 1 : 0), rot: big ? Math.PI / 2 : 0, frames: swFrames(5, m), life: big ? 0.45 : 0.35, flip: a.dir < 0, fade: 0.3 });
    },
    kb: 20,
  },

  ramCharge: {
    pose(u, a) {
      const m = a.mast || 0, d = a.k ? a.k.dur : 1.5, t = u * d;
      if (m === 0) {
        if (t < 0.3) { const c = easeOut(t / 0.3); return { sy: 1 - 0.1 * c, skew: -0.2 * c, dx: -4 * c, wa: -2.35 }; }
        if (t < 0.52) { const s = easeOut(segU(t, 0.3, 0.52)); return { sy: 0.92, skew: mix(-0.2, 0.35, s), dx: mix(-4, 24, s), wa: -2.5 }; }
        if (t < 0.72) { const r = segU(t, 0.52, 0.72); return { skew: 0.35 - 0.1 * r, dx: 24 - 4 * r, wa: -2.5, sy: 0.92 + 0.08 * r }; }
        const r = easeOut(segU(t, 0.72, 1)); return { dx: 20 * (1 - r), skew: 0.25 * (1 - r), wa: mix(-2.5, -2.35, r) };
      }
      if (m === 1) {
        if (t < 0.3) { const c = easeOut(t / 0.3); return { sy: 1 - 0.12 * c, skew: -0.25 * c, dx: -5 * c, wa: mix(-2.35, 1.3, c) }; }
        if (t < 0.78) { const s = easeOut(segU(t, 0.3, 0.78)); return { sy: 0.9, skew: 0.4, dx: mix(-5, 48, s), wa: 1.3 + Math.sin(clock * 40) * 0.04 }; }
        if (t < 0.95) { const s = segU(t, 0.78, 0.95); return { sy: 0.9, skew: 0.4 - 0.1 * s, dx: 48, wa: 1.3 }; }
        if (t < 1.08) { const s = easeIn(segU(t, 0.95, 1.08)); return { sy: mix(0.9, 1.1, s), skew: mix(0.3, -0.1, s), dx: 48 + 4 * s, wa: mix(1.3, -2.2, s), lift: 12 * s }; }
        if (t < 1.25) { const h = segU(t, 1.08, 1.25); return { sy: 1.1 - 0.1 * h, skew: -0.1, dx: 52, wa: -2.2, lift: 12 * (1 - h) }; }
        const r = easeOut(segU(t, 1.25, 1.5)); return { dx: 52 * (1 - r), wa: mix(-2.2, -2.35, r), skew: -0.1 * (1 - r) };
      }
      if (m === 2) {
        if (t < 0.3) { const c = easeOut(t / 0.3); return { sy: 1 - 0.12 * c, skew: -0.25 * c, dx: -5 * c, wa: mix(-2.35, 1.3, c) }; }
        if (t < 1.0) { const s = easeOut(segU(t, 0.3, 1.0)); return { sy: 0.9, skew: 0.42, dx: mix(-5, 88, s), wa: 1.3 + Math.sin(clock * 40) * 0.04 }; }
        if (t < 1.25) { const s = easeOut(segU(t, 1.0, 1.25)); return { sy: 1 + 0.08 * s, skew: mix(0.42, -0.15, s), dx: 88 + 6 * s, wa: mix(1.3, -2.6, s), lift: 28 * Math.sin((Math.PI / 2) * s) }; }
        if (t < 1.4) { const s = easeIn(segU(t, 1.25, 1.4)); return { sy: mix(1.08, 0.82, s), sx: mix(1, 1.1, s), skew: mix(-0.15, 0.42, s), dx: 94 + 4 * s, wa: mix(-2.6, 1.15, s), lift: 28 * (1 - s) }; }
        if (t < 1.58) return { sy: 0.82, sx: 1.1, skew: 0.42, dx: 98, wa: 1.15 };
        const r = easeOut(segU(t, 1.58, 1.8)); return { dx: 98 * (1 - r), wa: mix(1.15, -2.35, r), skew: 0.42 * (1 - r), sy: mix(0.82, 1, r), sx: mix(1.1, 1, r) };
      }
      // ★★★ 패왕 돌격: 길게 웅크렸다가 하단바를 가로질러 달리고(0.35~1.35), 높이 솟구쳐(1.5~1.85) 거대 대검으로 내리찍는다(1.98)
      if (t < 0.35) { const c = easeOut(t / 0.35); return { sy: 1 - 0.16 * c, sx: 1 + 0.06 * c, skew: -0.3 * c, dx: -8 * c, wa: mix(-2.35, 1.3, c) }; }
      if (t < 1.35) { const s = easeOut(segU(t, 0.35, 1.35)); return { sy: 0.88, skew: 0.45, dx: mix(-8, 130, s), wa: 1.3 + Math.sin(clock * 40) * 0.05 }; }
      if (t < 1.5) { const s = segU(t, 1.35, 1.5); return { sy: 0.88 + 0.04 * s, skew: 0.45 - 0.3 * s, dx: 130 + 4 * s, wa: mix(1.3, -2.0, s) }; }
      if (t < 1.85) { const s = easeOut(segU(t, 1.5, 1.85)); return { sy: 1.1, skew: -0.15, dx: 134 + 8 * s, wa: mix(-2.0, -2.8, s), lift: 64 * Math.sin((Math.PI / 2) * s) }; }
      if (t < 1.98) { const s = easeIn(segU(t, 1.85, 1.98)); return { sy: mix(1.1, 0.8, s), sx: mix(1, 1.12, s), skew: mix(-0.15, 0.45, s), dx: 142 + 6 * s, wa: mix(-2.8, 1.25, s), lift: 64 * (1 - s) }; }
      if (t < 2.14) return { sy: 0.8, sx: 1.12, skew: 0.45, dx: 148, wa: 1.25 };
      const r = easeOut(segU(t, 2.14, 2.3)); return { dx: 148 * (1 - r), wa: mix(1.25, -2.35, r), skew: 0.45 * (1 - r), sy: mix(0.8, 1, r), sx: mix(1.12, 1, r) };
    },
    // 돌진하는 동안 대검 끝이 땅을 긁어 불티가 튄다 (★ 이상), ★★★ 는 잔상도 남긴다
    tick(a, u, dt) {
      const m = a.mast, d = a.k.dur, t = u * d;
      if (!m) return;
      const run = m === 1 ? [0.3, 0.78] : m === 2 ? [0.3, 1.0] : [0.35, 1.35];
      if (t < run[0] || t > run[1]) return;
      gsSparks(a.px() + a.dir * 12, a.dir, m >= 3 ? 3 : 2);
      if (m >= 2 && Math.random() < 0.35) parts.push({ x: a.px() - a.dir * 8, y: groundY() - rand(0, 4), vx: -a.dir * rand(30, 70), vy: rand(-25, -8), g: 120, size: 3, color: '#c9b38a', life: 0.35, t: 0 });
      a.gsGhost = (a.gsGhost || 0) + dt;
      if (m >= 3 && a.gsGhost > 0.07) { a.gsGhost = 0; gsAfterimage(a); }
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast, hits = a.k.hits;
      if (m === 0) return [[0.3, (a) => hopDustFx(a.px())]];
      const start = [0.3 / d, (a) => { hopDustFx(a.px()); impact({ shake: 0.08 }); }];
      // ★ 올려베기: 대검 궤적(W4)을 세워 아래에서 위로
      if (m === 1) return [start, [(hits[1][0] * d - 0.06) / d, (a) => { const h = hand(a); texFx('w4', h.x + a.dir * 16, h.y - 10, a.color, { scale: 1, rot: -Math.PI / 2, flip: a.dir < 0, life: 0.25, fade: 0.6 }); }]];
      if (m === 2) return [
        start,
        [0.55 / d, (a) => gsGougeTrail(a, a.px() - a.dir * 10, 70)],
        [(hits[2][0] * d - 0.02) / d, (a) => {
          const x = hand(a).x + a.dir * 20;
          impact({ stop: 0.1, shake: 0.4 });
          gsGouge(a, x, 1); debris(x, 8, ['#5a4a42', '#c9b38a', GS_COL.main], 1.4);
        }],
      ];
      // ★★★ 패왕 돌격: 달려 나가 대상에 어깨로 부딪히고(돌진 끝), 솟구쳐 내리찍으면 땅이 크게 갈아엎어진다 — 거대 대검(횡참 단두대)은 쓰지 않는다
      const slam = hits[3][0] * d;
      return [
        start,
        [0.8 / d, (a) => gsGougeTrail(a, a.px() - a.dir * 20, 120)],
        [1.35 / d, (a) => { const x = Math.max(64, Math.min(W - 64, a.px() + a.dir * 14)); texFx('k10', x, groundY() - 16, a.color, { scale: 1, flip: a.dir < 0, life: 0.35, fade: 0.3 }); impact({ shake: 0.3 }); }],
        [1.55 / d, (a) => aFx(a, 0, slam - 1.55, (u) => dimSpan(a.px() - a.dir * 30, a.tx() + a.dir * 40, 0.25 * Math.min(1, u * 3) * (u > 0.85 ? (1 - u) / 0.15 : 1), '20,5,0'))],   // 시전자~대상 구간만
        [(slam - 0.02) / d, (a) => {
          const x = hand(a).x + a.dir * 30;
          impact({ stop: 0.18, shake: 0.65 });
          gsGouge(a, x, 2);
          debris(x, 12, ['#5a4a42', '#c9b38a', GS_COL.main, GS_COL.steel], 1.8);
          const fx0 = Math.max(90, Math.min(W - 90, x));
          skFx(null, 0, 0.15, (u) => localFlash(fx0, groundY() - 16, 46, 0.3 * (1 - u), '255,230,210'));   // 내려찍는 지점 둘레만 (하단바 끝에는 닿지 않게)
        }],
      ];
    },
    hit(a, i, n) {
      const m = a.mast, tg = a.targets(i), last = i === n - 1;
      if (m === 0) { for (const t of tg) burst(t.x, t.y, 3, [GS_COL.hot, '#ffffff'], 100); impact({ stop: 0.04, shake: 0.12 }); return; }
      if (last) {
        for (const t of tg) burst(t.x, t.y, m >= 3 ? 8 : 6, [GS_COL.main, '#ffffff', GS_COL.hot], m >= 3 ? 220 : 170, 3, 280);
        if (m === 1) impact({ stop: 0.08, shake: 0.3 });
        return;
      }
      for (const t of tg) burst(t.x, t.y, 3, [GS_COL.main, '#ffffff'], 120);
      impact({ stop: 0.03, shake: 0.12 });
    },
    // 명중: 어깨 충돌 원뿔 충격파 + 흙 (k10) — 들이받는 쪽(앞)으로 터진다. 마무리는 조금 길게
    hitTex(a, t, share, i, n) {
      const m = a.mast || 0, last = i === n - 1;
      texFx('k10', t.x - a.dir * 4, t.y + 2, a.color, { scale: swScale(2 / 3, m), frames: swFrames(5, m), life: last ? 0.42 : 0.35, flip: a.dir < 0, fade: 0.3 });
    },
    kb: 26, launch: true,
  },
});
