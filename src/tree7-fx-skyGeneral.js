'use strict';
// 시즌7 스킬 빌드 트리 — 천마장군 줄기 새 스킬·융합 7종의 연출 (바탕 연출 대신 따로 짠 것, docs/specs/skill-tree-all.md)
// 그림은 새로 뽑지 않고 지금 시트만 다시 짠다 (VFX 규칙: 코드는 위치·크기·개수·궤적·타이밍·색 램프만). 기병·금빛·창이 주제 (방패 벽 연출은 쓰지 않는다):
//  방진 선회 = E23r 기병이 기사 둘레를 달린다 + C18 발밑 고리 · 번개 돌격 = E26 금빛 창줄 + P12 번개 띠 + 화면을 가르는 천마(E23r) ·
//  투창 = E37 금빛 창이 부채꼴로 · 기병 폭풍 = E23r 기병이 좌우로 질주 + E37 창이 방사 · 철벽 돌격 = E24 방패 대열을 앞세운 돌격 ·
//  뇌창 투척 = 돌격 줄 위로 E37b 창이 내리꽂혀 번개로 터진다 · 군단 선회 = E24 방패 대열이 돌며 E37 창을 흩뿌린다.
// 모습: a.mast 0~3 — 개수·크기·금빛이 오른다. 변형 모양(shape)은 내 기사만 (t7Sh). 이 파일은 src/tree7-fx.js 뒤에 불러온다.

(function () {
  const GOLD = '#ffd36a', SKY = '#9fd8ff', DUST = '#d8c9a4';
  // 숙련 단계 색: Lv1·★ 는 회색을 섞고 ★★★ 는 금빛 (startCast 의 a.color 와 같은 규칙)
  const tone = (a, c) => { const m = a.mast || 0; return m >= 3 ? mixHex(c, MASTERY_GOLD, 0.45) : m < 2 ? mixHex(c, MASTERY_FADE[0], MASTERY_FADE[1 + m]) : c; };
  const puff = (x, delay = 0, sc = 2 / 3) => texFx('c6', x + rand(-6, 6), groundY() - 2, DUST, { scale: sc, life: 0.5, delay, fade: 0.5, anchor: 'b' });
  const T1 = (a) => a.k.hits[0][0] * a.k.dur, TL = (a) => a.k.hits[a.k.hits.length - 1][0] * a.k.dur;
  const farD = (a) => Math.max(90, a.dir > 0 ? W - 24 - a.x() : a.x() - 24);
  // 웅크렸다가 [t0, t1] 동안 D 만큼 내달리고 tHold 까지 서 있다가 돌아온다
  function dashPose(t, d, t0, t1, tHold, D) {
    tHold = Math.min(tHold, d - 0.12);
    if (t < t0) { const c = easeOut(t / t0); return { sy: 1 - 0.1 * c, skew: -0.2 * c, dx: -3 * c, wa: mix(-1.3, -0.1, c), ext: -3 * c }; }
    if (t < t1) { const s = easeOut(segU(t, t0, t1)); return { sy: 0.94, skew: 0.38, dx: mix(-3, D, s), wa: 0, ext: 12 }; }
    if (t < tHold) return { sy: 0.96, skew: 0.3, dx: D, wa: 0, ext: 10 };
    const r = easeOut(segU(t, tHold, d));
    return { skew: 0.3 * (1 - r), dx: D * (1 - r), wa: mix(0, -1.3, r), ext: 10 * (1 - r) };
  }
  // 창 한 자루(E37)가 ang 방향으로 날아간다. 지나간 자리에 돌격창 속도선(W7)이 꼬리로 따라온다
  function lance(a, x, y, ang, dist, o = {}) {
    const c = Math.cos(ang), s = Math.sin(ang), mv = (u) => [c * dist * easeOut(u), Math.min(s * dist * easeOut(u), groundY() + 4 - y)], col = o.color || GOLD;
    texFx('e37', x, y, col, { scale: o.scale || 2 / 3, life: o.life || 0.38, rot: ang, fade: 0.3, delay: o.delay || 0, move: mv });
    if (!o.noTail) texFx('w7', x - c * 26, y - s * 26, col, { scale: 2 / 3, life: o.life || 0.38, rot: ang, fade: 0.5, alpha: 0.7, delay: o.delay || 0, move: mv });
  }
  // 둘레를 도는 그림 (기병·방패 대열). 땅 위 타원 궤도, 오른쪽으로 갈 때 오른쪽을 본다
  function orbit(a, id, life, o) {
    swFollow(a, id, life, (u) => {
      const th = o.phase + u * life * o.w, c = o.cx(u);
      return [c + Math.cos(th) * o.R, groundY() + 3 + Math.sin(th) * 6, { flip: Math.sin(th) > 0 }];
    }, { loop: true, fps: o.fps || 12, anchor: 'b', scale: o.sc, color: o.color, fadeIn: 0.12 });
  }
  // 화면을 가로지르는 돌격 줄: E26 금빛 창줄 + P12 번개 띠 + 앞서 달리는 천마(E23r)
  function dashLine(a, y, o = {}) {
    const dir = a.dir, x0 = a.x() - dir * 10, x1 = dir > 0 ? W + 30 : -30, life = o.life || 0.45, col = o.color || GOLD, sc = o.sc || 2 / 3;
    skFx(null, o.delay || 0, life, (u) => {
      const hx = x0 + (x1 - x0) * easeOut(Math.min(1, u / 0.35)), al = (o.alpha == null ? 1 : o.alpha) * (u < 0.55 ? 1 : (1 - u) / 0.45);
      swLine(ctx, 'e26', col, 0, x0, y, hx, y, { scale: sc, alpha: al });
      vfxTileRun(ctx, 'p12', SKY, Math.floor(u * 9) % 3, x0, y - 4, Math.abs(hx - x0), dir, { scale: 2 / 3, alpha: al });
      if (u < 0.5) vfxDraw(ctx, 'e23r', col, Math.floor(clock * 14) % 5, hx, groundY() + 2, { anchor: 'b', scale: sc, flip: dir < 0, alpha: al });
    });
    for (let x = x0 + dir * 40; dir > 0 ? x < x1 : x > x1; x += dir * 70) puff(x, 0.05 + Math.abs(x - x0) / 1400, 2 / 3);
  }

  // ── 방진 선회 (whirl) ── 기병이 기사 둘레를 돈다. 1칸 한 기 · ★ 두 기(마주 보고) · ★★ 크게 · ★★★ 세 기 + 금빛
  //  제자리 철벽(a_grow): 한 단계 크게 제자리 · 추격 선회(a_follow): 기병 무리가 대상에게 날아가 붙는다
  SKILL_FX.sg_whirl = {
    pose(u) { const s = Math.sin(u * Math.PI * 4); return { wa: -0.3 + 0.25 * s, wa2: -0.6, skew: 0.1 * s, ext: 3, sy: 0.97 }; },
    cues: (a) => [[0.01, (a) => {
      const m = a.mast || 0, grow = t7Sh(a, 'grow'), follow = t7Sh(a, 'follow'), life = a.k.dur;
      const sc = grow ? (m >= 3 ? 2 : 4 / 3) : m >= 2 ? 1 : 2 / 3, n = grow ? [1, 1, 1, 1][m] : [1, 2, 2, 2][m], R = 22 + 34 * sc, col = tone(a, GOLD);
      const cx = (u) => (follow ? mix(a.x(), a.tx(), easeOut(Math.min(1, u / 0.35))) : a.x());
      for (let j = 0; j < n; j++) orbit(a, 'e23r', life, { phase: (j / n) * Math.PI * 2, w: (Math.PI * 4) / life, R, cx, sc: Math.min(sc, 4 / 3), color: col });
      swFollow(a, 'c18', life, (u) => [cx(u), groundY() + 2], { loop: true, fps: 12, anchor: 'b', scale: sc >= 2 ? 2 : sc >= 4 / 3 ? 4 / 3 : 1, color: col, fadeIn: 0.15 });
      for (let k = 0; k < 6 + 2 * m; k++) puff(a.x() + rand(-R, R), k * 0.05, 2 / 3);
    }]],
    hit(a) { ringFx(a.x(), tone(a, GOLD), (a.mast || 0) >= 2 ? 1.2 : 0.8, 0.4); impact({ shake: 0.08 }); },
    hitTex(a, t) { texFx('k34', t.x, groundY() + 3, tone(a, GOLD), { anchor: 'b', scale: 2 / 3, frames: 4, life: 0.26, flip: a.dir < 0, fade: 0.3 }); },
    kb: 20,
  };

  // ── 번개 돌격 (flash) ── 말발굽이 번쩍(k27) → 한 번에 화면 끝까지: 금빛 창줄 + 번개 띠 + 천마. ★★ 크게 · ★★★ 더 크게 + 금빛
  //  잔뢰(b_after): 0.5초 뒤 하늘빛 반투명 줄 한 번 더 · 삼중 뇌격(b_triple): 천마 세 마리가 위·가운데·아래 세 줄로
  SKILL_FX.sg_flash = {
    pose(u, a) {
      const d = a.k.dur, t0 = Math.max(0.12, T1(a) - 0.16);
      return dashPose(u * d, d, t0, T1(a), TL(a) + 0.1, farD(a));
    },
    cues: (a) => {
      const d = a.k.dur, t0 = Math.max(0.12, T1(a) - 0.16);
      return [[t0 / d, (a) => {
        const m = a.mast || 0, y = groundY() - 20, sc = [2 / 3, 1, 1, 4 / 3][m], col = tone(a, GOLD);
        ringFx(a.x(), SKY, m >= 3 ? 1.6 : 1.0, 0.4);
        if (m >= 3) ringFx(a.x(), GOLD, 2.0, 0.5);
        texFx('k27', a.x(), groundY() - 4, SKY, { scale: 2 / 3, life: 0.3, fade: 0.4 });
        if (t7Sh(a, 'triple')) [-12, 0, 12].forEach((dy, j) => dashLine(a, y + dy, { delay: j * 0.05, sc: 2 / 3, color: col }));
        else dashLine(a, y, { sc, color: col });
        if (t7Sh(a, 'after')) dashLine(a, y + 3, { delay: 0.5, alpha: 0.5, color: SKY, sc });
        impact({ stop: 0.06, shake: 0.3 });
      }]];
    },
    hit(a, i, n) { impact(i === n - 1 ? { stop: 0.1, shake: 0.35 } : { shake: 0.08 }); },
    hitTex(a, t) { texFx('k27', t.x, t.y, tone(a, GOLD), { scale: 2 / 3, frames: 4, life: 0.24, fade: 0.35 }); },
    kb: 28, launch: true,
  };

  // ── 투창 (wave) ── 말 위에서 창을 던진다: 금빛 창(E37)이 부채꼴로. 1칸 1자루 · ★ 3 · ★★ 5 · ★★★ 7 (크게). 관통(k_pierce) 이면 더 멀리
  SKILL_FX.sg_wave = {
    pose(u, a) {
      const d = a.k.dur, t = u * d, T = Math.max(0.1, T1(a));
      if (t < T - 0.06) { const c = easeOut(t / (T - 0.06)); return { wa: mix(-1.3, -2.4, c), skew: -0.2 * c, ext: -3 * c, sy: 1 - 0.06 * c }; }
      if (t < T + 0.04) { const s = easeOut(segU(t, T - 0.06, T + 0.04)); return { wa: mix(-2.4, -0.1, s), skew: mix(-0.2, 0.25, s), ext: mix(-3, 10, s) }; }
      const r = easeOut(segU(t, T + 0.04, d)); return { wa: mix(-0.1, -1.3, r), skew: 0.25 * (1 - r), ext: 10 * (1 - r) };
    },
    cues: () => [],
    hit(a, i) {
      if (i) return;
      const m = a.mast || 0, n = [1, 3, 5, 7][m], g = gripOf(a), dist = t7Sh(a, 'pierce') ? 300 : 170, y0 = Math.min(g.y, groundY() - 34), col = tone(a, GOLD);
      for (let j = 0; j < n; j++) {
        const off = n > 1 ? (j / (n - 1) - 0.65) * 0.5 : -0.03;
        lance(a, g.x + a.dir * 12, y0, a.dir > 0 ? off : Math.PI - off, dist, { delay: j * 0.03, scale: m >= 3 ? 1 : 2 / 3, color: col });
      }
      puff(g.x - a.dir * 8, 0, 2 / 3);
      impact({ shake: 0.1 });
    },
    hitTex(a, t) { texFx('k34', t.x, t.y + 6, tone(a, GOLD), { scale: 2 / 3, frames: 4, life: 0.24, flip: a.dir < 0, fade: 0.3 }); },
  };

  // ── 기병 폭풍 (storm) ── 기병이 좌우로 질주하고(E23r + 흙먼지) 창이 사방으로 뻗는다(E37). 창 1칸 4 · ★ 8 · ★★ 8 크게 · ★★★ 12 금빛, 기병은 2·4·4·6기
  //  분열창(k_split): 맞은 자리에서 창이 두 갈래로 · 관통(k_pierce) 이면 범위 +20%
  SKILL_FX.sg_storm = {
    pose(u) { const s = Math.sin(u * Math.PI * 8); return { wa: -0.6 + 1.0 * s, ext: 4 * Math.abs(s), lift: 3 * Math.abs(Math.sin(u * Math.PI * 4)), skew: 0.1 * s }; },
    cues: () => [],
    hit(a, i) {
      if (i) return;
      const m = a.mast || 0, n = [4, 8, 8, 12][m], nR = [2, 4, 4, 4][m], cx = a.x(), cy = groundY() - 26, dist = t7Sh(a, 'pierce') ? 150 : 120, sc = m >= 2 ? 1 : 2 / 3, col = tone(a, GOLD);
      for (let j = 0; j < n; j++) lance(a, cx, cy, (j / n) * Math.PI * 2 + (n === 4 ? Math.PI / 4 : 0), dist, { scale: sc, life: 0.36, color: col });
      for (let j = 0; j < nR; j++) {
        const side = j % 2 ? 1 : -1, reach = 130 + 28 * (j >> 1), dy = ((j >> 1) % 3 - 1) * 4;
        swFollow(null, 'e23r', 0.55, (u) => [cx + side * reach * easeOut(u), groundY() + 3 + dy], { loop: true, fps: 14, anchor: 'b', scale: 2 / 3, color: col, delay: j * 0.03, flip: side < 0 });
        for (let k = 1; k <= 3; k++) puff(cx + side * (reach * k) / 4, j * 0.03 + k * 0.08, 2 / 3);
      }
      ringFx(cx, col, m >= 2 ? 1.4 : 1, 0.45);
      impact({ stop: 0.05, shake: 0.2 });
    },
    hitTex(a, t) {
      texFx('k34', t.x, groundY() + 3, tone(a, GOLD), { anchor: 'b', scale: 2 / 3, frames: 4, life: 0.24, fade: 0.3 });
      if (t7Sh(a, 'split')) for (const s of [-1, 1]) lance(a, t.x, t.y, s * 0.6 + (a.dir > 0 ? 0 : Math.PI), 60, { scale: 2 / 3, life: 0.25, noTail: true });
    },
    kb: 18,
  };

  // ── 철벽 돌격 (f_ab) ── 방패(E24 대열)를 앞세운 돌격: 천마 잔상이 뒤따르고 방패 문양(K16)이 찍힌다
  SKILL_FX.sg_f_ab = {
    pose(u, a) {
      const d = a.k.dur, t0 = Math.max(0.15, T1(a) - 0.35);
      return dashPose(u * d, d, t0, T1(a) + 0.05, TL(a) + 0.12, Math.min(farD(a), Math.max(100, Math.abs(a.tx() - a.x()) + 40)));
    },
    cues: (a) => {
      const d = a.k.dur, t0 = Math.max(0.15, T1(a) - 0.35);
      return [[t0 / d, (a) => {
        const m = a.mast || 0, sc = [2 / 3, 2 / 3, 1, 4 / 3][m], col = tone(a, GOLD), life = Math.max(0.3, TL(a) - t0 + 0.25), h = gripOf(a);
        swFollow(a, 'e24', life, () => [a.px() + a.dir * 26, groundY() + 2], { loop: true, fps: 10, anchor: 'b', scale: sc, color: col, flip: a.dir < 0, fadeIn: 0.1 });
        vfxThrustLine('w7a', h.x + a.dir * 20, h.y, a.dir, 90, col, { life: 0.3, move: (u) => 12 * easeOut(u) });
        let last = 0;
        aFx(a, 0, life, null, null, () => { if (clock - last > 0.06) { last = clock; puff(a.px() - a.dir * 18, 0, 2 / 3); } });
        if (m >= 3) {
          swFollow(a, 'e24', life, () => [a.px() + a.dir * 66, groundY() + 2], { loop: true, fps: 10, anchor: 'b', scale: sc, color: col, flip: a.dir < 0, fadeIn: 0.1 });
        }
        impact({ shake: 0.1 });
      }]];
    },
    hit(a, i, n) {
      const x = a.px() + a.dir * 30, m = a.mast || 0;
      ringFx(x, tone(a, GOLD), m >= 3 ? 1.7 : 0.9, 0.35);
      if (i === n - 1) {   // 마지막 타: 부딪친 자리에 방패 벽이 솟고 충격파가 땅을 쓴다
        const wx = a.tx() + a.dir * 8;
        for (let j = -1; j <= 1; j++) texFx('e24', wx + j * 34, groundY() + 2, tone(a, GOLD), { anchor: 'b', scale: m >= 2 ? 1 : 2 / 3, frames: 5, life: 0.9, delay: Math.abs(j) * 0.05, fade: 0.35 });
        ringFx(wx, SKY, m >= 2 ? 2 : 1.4, 0.6);
        ringFx(wx, tone(a, GOLD), m >= 2 ? 1.4 : 1, 0.5);
      }
 impact(i === n - 1 ? { stop: 0.1, shake: 0.35 } : { stop: 0.03, shake: 0.12 }); },
    hitTex(a, t, share, i, n) {
      const big = i === n - 1;
      texFx('k16', t.x, t.y, tone(a, GOLD), { scale: big && (a.mast || 0) >= 1 ? 1 : 2 / 3, frames: 5, life: 0.3, fade: 0.3 });
      if (big) texFx('k34', t.x, groundY() + 3, tone(a, GOLD), { anchor: 'b', scale: 2 / 3, frames: 4, life: 0.26, fade: 0.3 });
    },
    kb: 26, launch: true,
  };

  // ── 뇌창 투척 (f_bk) ── 번개 돌격이 지나간 줄 위로 창(E37b)이 차례로 내리꽂히고 — 잠깐 뒤 번개(K27)로 터진다. 창 4·5·6·8자루
  SKILL_FX.sg_f_bk = {
    pose(u, a) {
      const d = a.k.dur, t0 = Math.max(0.12, T1(a) - 0.2);
      return dashPose(u * d, d, t0, T1(a), TL(a) + 0.1, Math.min(farD(a), 300));
    },
    cues: (a) => {
      const d = a.k.dur, t0 = Math.max(0.12, T1(a) - 0.2);
      return [[t0 / d, (a) => {
        const m = a.mast || 0, n = [4, 5, 6, 8][m], sc = m >= 2 ? 1 : 2 / 3, col = tone(a, GOLD), step = Math.min(70, 300 / n);
        dashLine(a, groundY() - 20, { sc: 2 / 3, color: col, life: 0.4 });
        for (let j = 1; j <= n; j++) {
          const x = a.x() + a.dir * (30 + j * step), dl = 0.1 + j * 0.05;
          if (x < 0 || x > W) break;
          texFx('e37b', x, groundY() - 30, col, { scale: sc, life: 0.85, delay: dl, fade: 0.2, move: (u) => [0, u < 0.25 ? mix(-170, 0, easeIn(u / 0.25)) : 0] });
          texFx('k27', x, groundY() - 14, SKY, { scale: 2 / 3, life: 0.3, delay: dl + 0.55, fade: 0.4 });
          texFx('k34', x, groundY() + 4, col, { anchor: 'b', scale: 2 / 3, frames: 4, life: 0.26, delay: dl + 0.55, fade: 0.3 });
        }
        impact({ stop: 0.06, shake: 0.25 });
      }]];
    },
    hit(a, i, n) { impact(i === n - 1 ? { stop: 0.08, shake: 0.3 } : { shake: 0.08 }); },
    hitTex(a, t) { texFx('k27', t.x, t.y, tone(a, GOLD), { scale: 2 / 3, frames: 4, life: 0.24, fade: 0.35 }); },
    kb: 8,
  };

  // ── 군단 선회 (f_ak) ── 방패 대열(E24)이 기사 둘레를 돌고, 맞을 때마다 창(E37)이 별처럼 흩뿌려진다 (타격마다 각도가 돈다)
  SKILL_FX.sg_f_ak = {
    pose(u) { const s = Math.sin(u * Math.PI * 6); return { wa: -0.5 + 0.8 * s, wa2: -0.6 - 0.5 * s, skew: 0.12 * s, ext: 2 }; },
    cues: (a) => [[0.01, (a) => {
      const m = a.mast || 0, life = a.k.dur, sc = m >= 2 ? 1 : 2 / 3, R = 22 + 34 * sc, col = tone(a, GOLD), cx = () => a.x();
      for (let j = 0; j < 2 + (m >= 3 ? 1 : 0); j++) orbit(a, 'e24', life, { phase: (j / (2 + (m >= 3 ? 1 : 0))) * Math.PI * 2, w: (Math.PI * 3) / life, R, cx, sc, color: col, fps: 10 });
      swFollow(a, 'c18', life, () => [a.x(), groundY() + 2], { loop: true, fps: 12, anchor: 'b', scale: sc >= 1 ? 4 / 3 : 1, color: SKY, fadeIn: 0.15 });
    }]],
    hit(a, i) {
      const n = 3 + (a.mast || 0), cx = a.x(), cy = groundY() - 26, col = tone(a, GOLD);
      for (let j = 0; j < n; j++) lance(a, cx, cy, (j / n) * Math.PI * 2 + i * 0.5, 100, { scale: 2 / 3, life: 0.3, color: col, noTail: true });
      ringFx(cx, SKY, 0.8, 0.35);
      impact({ shake: 0.1 });
    },
    hitTex(a, t) { texFx('k34', t.x, groundY() + 3, tone(a, GOLD), { anchor: 'b', scale: 2 / 3, frames: 4, life: 0.24, fade: 0.3 }); },
    kb: 20,
  };
})();
