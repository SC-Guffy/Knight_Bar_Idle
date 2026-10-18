'use strict';
// 시즌7 스킬 빌드 트리 — 파천검왕(tyrant) 줄기 새 스킬·융합 7종의 자기 연출 (docs/specs/skill-tree-all.md "연출")
// 그림은 새로 뽑지 않고 지금 시트를 재사용한다 (VFX 규칙: 코드는 위치·크기·개수·궤적·타이밍·색 램프만, 크기는 2/3·1·4/3·2):
//  철퇴 회전 = E12 대검 참격파를 기사 주위 타원 궤도로 돌리고 발밑 C8 균열 · 관통 돌격 = F22 땅 베임 불길 줄을 화면 끝까지 + K31 불길 틈 ·
//  참마도 파동 = E12 붉은 참격파가 줄지어 굴러간다 + K09 · 대검 폭풍 = F06 그림자 대검이 땅에 꽂히고 K10 충격 원뿔이 사방으로 + C8 + C3 ·
//  철벽 돌파 = C3 충격 고리가 앞서 달리다 E13 단두대 대검이 떨어진다 · 단두 충격파 = F22 불길 줄 위에서 K10 충격이 차례로 솟는다 ·
//  폭군의 선풍 = 철퇴 회전 궤도 + 매 타 K10 충격이 사방으로.
// 검성(tree7-fx.js: E43 초승달·E11 일섬·E20)과 겹치지 않게 붉은색·금빛, 무겁고 땅을 가르는 그림만 쓴다.
// 모습(칸마다): a.mast 0~3 (src/tree7.js T7_STAGE_AT) — 개수·크기·금빛이 단계마다 오른다. 변형은 내 기사(owner 'hero')만 (t7Sh).
// 이 파일은 tree7-fx.js 뒤에 불러온다 (SKILL_FX 에 새 스킬 id 로 따로 등록 — 바탕 연출을 빌리지 않는다).

(function () {
  const TY_RED = '#e0482e', TY_DARK = '#9a2a1c', TY_DIRT = '#a8946a';
  const col = (a) => ((a.mast || 0) >= 3 ? mixHex(TY_RED, MASTERY_GOLD, 0.4) : TY_RED);
  const pick = (m, arr) => arr[Math.max(0, Math.min(arr.length - 1, m || 0))];
  const hitF = (a, j) => a.k.hits[Math.min(j, a.k.hits.length - 1)][0];               // 타격 j 의 시점 (0~1)
  const bigHit = (a) => a.k.hits.reduce((b, h, i) => (h[1] > a.k.hits[b][1] ? i : b), 0);   // 가장 센 타격 번호
  const clampX = (x) => Math.max(48, Math.min(W - 48, x));                            // 하단바 양 끝(40px)은 비운다

  // 대검 내려치기 자세: 등 뒤로 넘겼다가(h0 직전) 내리친다
  function slamPose(u, h0) {
    const w0 = Math.max(0.12, h0 - 0.3), w1 = Math.max(w0 + 0.05, h0 - 0.03);
    if (u < w0) { const w = easeOut(u / w0); return { wa: mix(-2.35, -2.8, w), skew: -0.2 * w, sy: 1 - 0.06 * w, dx: -3 * w }; }
    if (u < w1) { const d = easeIn(segU(u, w0, w1)); return { wa: mix(-2.8, 1.0, d), skew: mix(-0.2, 0.35, d), sy: mix(0.94, 0.88, d), dx: mix(-3, 8, d), lift: 4 * Math.sin(Math.PI * d) }; }
    if (u < w1 + 0.12) return { wa: 1.0, skew: 0.35, sy: 0.9, dx: 8 };
    const r = easeOut(segU(u, w1 + 0.12, Math.max(w1 + 0.22, 0.98)));
    return { wa: mix(1.0, -2.35, r), skew: 0.35 * (1 - r), dx: 8 * (1 - r), sy: mix(0.9, 1, r) };
  }
  // 대검을 쥔 채 제자리에서 도는 자세 (몸이 앞·뒤를 번갈아 보인다)
  function spinPose(u, a, turns) {
    const th = u * turns * Math.PI * 2, s = Math.sin(th);
    return { wa: -2.35 + th, skew: 0.14 * s, sy: 1 - 0.05 * Math.abs(s), lift: 2 * Math.abs(s), facing: (Math.cos(th * 0.5) >= 0 ? 1 : -1) * a.dir };
  }

  // 대검 참격파(E12)가 기사 주위 낮은 타원 궤도를 돈다. 앞쪽(아래)이 또렷, 뒤쪽은 흐리다. follow: 궤도 중심이 대상에게 굴러가 붙는다
  function orbit(a, o) {
    const life = a.k.dur, c = o.col || col(a);
    for (let j = 0; j < o.n; j++) {
      aFx(a, 0, life, (u) => {
        const cx = o.follow ? mix(a.px(), a.tx(), easeOut(Math.min(1, u / 0.35))) : a.px();
        const th = (u * o.turns + j / o.n) * Math.PI * 2, sn = Math.sin(th), cs = Math.cos(th);
        const al = Math.min(1, u / 0.1) * (u > 0.88 ? (1 - u) / 0.12 : 1) * (sn > 0 ? 1 : 0.55);
        vfxDraw(ctx, 'e12', c, Math.floor(clock * 14 + j) % 3, cx + cs * o.R, groundY() - 22 + sn * o.R * 0.22, { scale: o.sc, flip: sn > 0, alpha: al });
      });
    }
    // 발밑 갈라진 땅 (C8) 이 대검 끝이 긁는 동안 번쩍인다
    aFx(a, 0, life, (u) => {
      const cx = o.follow ? mix(a.px(), a.tx(), easeOut(Math.min(1, u / 0.35))) : a.px();
      const al = Math.min(1, u / 0.1) * (u > 0.88 ? (1 - u) / 0.12 : 1) * 0.9;
      for (const s of [-1, 1]) vfxDraw(ctx, 'c8', TY_DIRT, 2 + Math.floor(clock * 10 + (s > 0 ? 2 : 0)) % 4, cx + s * o.R * 0.55, groundY() + 1, { scale: o.sc >= 1 ? 1 : 2 / 3, flip: s < 0, alpha: al });
    }, null, () => { if (Math.random() < 0.3) parts.push({ x: a.px() + rand(-o.R, o.R), y: groundY() - 2, vx: rand(-60, 60), vy: rand(-70, -20), g: 260, size: 2, color: Math.random() < 0.5 ? TY_DIRT : TY_RED, life: 0.4, t: 0 }); });
  }
  // 충격 원뿔(K10)을 중심에서 ang 방향으로 쏜다
  function cone(x, y, ang, dist, o = {}) {
    const lf = Math.cos(ang) < 0;
    texFx('k10', x, y, o.color || TY_RED, { scale: o.scale || 2 / 3, life: o.life || 0.34, rot: ang + (lf ? Math.PI : 0), flip: lf, fade: 0.3, delay: o.delay || 0,
      move: (u) => [Math.cos(ang) * dist * easeOut(u), Math.sin(ang) * dist * easeOut(u)] });
  }
  // 땅 위로 번지는 충격 고리 (C3)
  const ring = (x, o = {}) => texFx('c3', x, groundY() - 4, o.color || TY_RED, { scale: o.scale || 2 / 3, life: o.life || 0.4, fade: 0.4, delay: o.delay || 0, rot: o.rot || 0, alpha: 0.9 });

  // ── 철퇴 회전 (ty_whirl, 바탕 횡참) ── 대검을 쥐고 팽이처럼 돈다. 1칸 대검 하나 · ★ 둘(마주 보고) · ★★ 크게 · ★★★ 셋 + 금빛
  //  제자리 맷돌(a_grow): 궤도가 한 단계 크게 · 추격 회전(a_follow): 궤도가 대상에게 굴러가 붙는다
  SKILL_FX.ty_whirl = {
    pose: (u, a) => spinPose(u, a, 2 + (a.mast || 0)),
    cues: (a) => [[0.01, (a) => {
      const m = a.mast || 0, grow = t7Sh(a, 'grow'), follow = t7Sh(a, 'follow');
      const sc = pick(m + (grow ? 1 : 0), [2 / 3, 2 / 3, 1, 4 / 3, 2]);
      orbit(a, { n: pick(m, [1, 2, 2, 3]), R: pick(m, [34, 40, 46, 52]) * (grow ? 1.5 : 1), sc, turns: 2 + m, follow });
      impact({ shake: 0.1 });
    }]],
    hit(a, i, n) { for (const t of a.targets(i)) debris(t.x, 2 + (a.mast || 0), [TY_DIRT, TY_RED], 0.8); },
    hitTex(a, t, share, i, n) {
      const m = a.mast || 0;
      ring(t.x, { scale: m >= 2 ? 1 : 2 / 3, life: 0.32 });
    },
  };

  // ── 관통 돌격 (ty_flash, 바탕 돌진 격돌) ── 대검을 앞세워 달리면 지나간 땅에 불길 줄(F22)이 화면 끝까지 그어진다
  //  잔상 돌격(b_after): 0.5초 뒤 어두운 줄이 한 번 더 · 삼중 돌격(b_triple): 줄 세 가닥
  function scar(a, y, o = {}) {
    const x0 = a.x() + a.dir * 14, x1 = clampX(a.dir > 0 ? W - 48 : 48), full = Math.abs(x1 - x0), sc = o.scale || 2 / 3, c = o.color || col(a);
    skFx(null, o.delay || 0, o.life || 0.9, (u) => {
      const len = full * easeOut(Math.min(1, u / 0.22)), al = (o.alpha == null ? 1 : o.alpha) * (u < 0.55 ? 1 : (1 - u) / 0.45);
      vfxTileRun(ctx, 'f22', c, Math.floor(clock * 12) % 5, x0, y, len, a.dir, { scale: sc, alpha: al, vary: false, overlap: 2 });
    });
  }
  SKILL_FX.ty_flash = {
    pose(u, a) {
      const m = a.mast || 0, D = pick(m, [30, 54, 90, 130]), de = Math.max(0.4, hitF(a, 0)), last = a.k.hits[a.k.hits.length - 1][0];
      if (u < 0.22) { const c = easeOut(u / 0.22); return { sy: 1 - 0.12 * c, skew: -0.25 * c, dx: -5 * c, wa: mix(-2.35, 1.3, c) }; }
      if (u < de) { const s = easeOut(segU(u, 0.22, de)); return { sy: 0.9, skew: 0.42, dx: mix(-5, D, s), wa: 1.3 + Math.sin(clock * 40) * 0.04 }; }
      if (u < last + 0.06) return { sy: 0.9, skew: 0.35, dx: D, wa: 1.3 };
      const r = easeOut(segU(u, last + 0.06, Math.max(last + 0.16, 0.98)));
      return { sy: mix(0.9, 1, r), skew: 0.35 * (1 - r), dx: D * (1 - r), wa: mix(1.3, -2.35, r) };
    },
    tick(a, u, dt) {
      const de = Math.max(0.4, hitF(a, 0));
      if (u < 0.22 || u > de || (a.mast || 0) < 1) return;
      a.tyGhost = (a.tyGhost || 0) - dt;
      if (a.tyGhost <= 0) { a.tyGhost = 0.06; ghostFx(a, a.px(), a.dir, TY_DARK, 0.2, castPose(a.owner) || {}, 0.3); }
    },
    cues: (a) => [[0.22, (a) => {
      const m = a.mast || 0, y = groundY() - 7, sc = m >= 2 ? 1 : 2 / 3;
      debris(a.px(), 2, [TY_DIRT], 0.8);
      impact({ shake: 0.1 });
      if (t7Sh(a, 'triple')) for (const dy of [-9, 0, 9]) scar(a, y + dy, { scale: 2 / 3, alpha: 0.9 });
      else scar(a, y, { scale: sc });
      if (t7Sh(a, 'after')) scar(a, y + 3, { delay: 0.5, alpha: 0.55, color: TY_DARK, scale: sc });
    }]],
    hit(a, i, n) {
      const m = a.mast || 0;
      if (i < n - 1) return;
      // 마지막 타: 붉은 대검 참격파가 화면 끝까지 한 줄로 뚫고 나간다
      const x0 = a.px() + a.dir * 24, dist = Math.abs(clampX(a.dir > 0 ? W - 48 : 48) - x0);
      texFx('e12', x0, groundY() - 30, col(a), { scale: pick(m, [2 / 3, 1, 1, 4 / 3]), life: 0.5, flip: a.dir < 0, fade: 0.3, move: (u) => [a.dir * dist * easeOut(u), 0] });
      impact({ stop: 0.08, shake: 0.35 });
      ring(a.px() + a.dir * 24, { scale: pick(m, [1, 1, 4 / 3, 2]) });
      if (m >= 3) texFx('k31', a.px() + a.dir * 24, groundY() + 2, col(a), { anchor: 'b', scale: 1, life: 0.4, fade: 0.35 });
      if (m >= 2) for (let j = 1; j <= 2; j++) ring(a.px() + a.dir * (24 + j * 48), { scale: 1, delay: j * 0.08 });
    },
    hitTex(a, t, share, i, n) {
      const last = i === n - 1;
      texFx('k31', t.x, groundY() + 2, col(a), { anchor: 'b', scale: (a.mast || 0) >= 3 ? 4 / 3 : last ? 1 : 2 / 3, life: last ? 0.4 : 0.3, fade: 0.35 });
    },
  };

  // ── 참마도 파동 (ty_wave, 바탕 강철 베기) ── 폭이 넓은 붉은 참격파(E12)가 줄지어 굴러간다: 1칸 1줄 · ★ 3줄 · ★★ 5줄 · ★★★ 7줄 크게. 관통(k_pierce)이면 끝없이
  SKILL_FX.ty_wave = {
    pose: (u, a) => slamPose(u, hitF(a, 0)),
    cues: () => [],
    hit(a, i) {
      if (i) return;
      const m = a.mast || 0, n = pick(m, [1, 3, 5, 7]), g = gripOf(a), y0 = Math.min(g.y, groundY() - 30), pierce = t7Sh(a, 'pierce');
      const dist = pierce ? 320 : Math.min(260, Math.max(80, Math.abs(a.tx() - g.x) + 20));
      for (let j = 0; j < n; j++) {
        const row = Math.ceil(j / 2), y = Math.max(groundY() - 70, Math.min(groundY() - 8, y0 + (j % 2 ? -1 : 1) * row * 7)), life = 0.42;
        const sc = j === 0 ? pick(m, [2 / 3, 1, 1, 4 / 3]) : pick(m, [2 / 3, 2 / 3, 2 / 3, 1]), x0 = g.x + a.dir * 10;
        texFx('e12', x0, y, col(a), { scale: sc, life, delay: j * 0.07, flip: a.dir < 0, fade: 0.3, move: (u) => [a.dir * dist * easeOut(u), 0] });
        skLater(a, j * 0.07, () => debris(x0, 2, [TY_DIRT, TY_RED], 0.7));
      }
      impact({ shake: 0.15 });
    },
    hitTex(a, t) { texFx('k09', t.x, t.y, col(a), { scale: 2 / 3, life: 0.26, flip: a.dir < 0, fade: 0.35 }); },
  };

  // ── 대검 폭풍 (ty_storm, 바탕 강철 베기) ── 대검을 땅에 내리꽂으면 그림자 대검(F06)이 서고 충격 원뿔(K10)이 사방으로: 1칸 4갈래 · ★ 8 · ★★ 8 크게 · ★★★ 12 금빛
  //  분열(k_split): 맞은 자리에서 충격이 두 갈래로 갈라진다
  SKILL_FX.ty_storm = {
    pose(u, a) {
      const h = hitF(a, bigHit(a)), w0 = Math.max(0.12, h - 0.2);
      if (u < w0) { const r = easeOut(u / w0); return { wa: mix(-2.35, -1.7, r), sy: mix(1, 1.08, r), lift: 8 * r, dx: -2 * r }; }
      if (u < h) { const d = easeIn(segU(u, w0, h)); return { wa: mix(-1.7, 1.57, d), skew: mix(0, 0.3, d), sy: mix(1.08, 0.84, d), lift: 8 * (1 - d), dx: mix(-2, 8, d) }; }
      return { wa: 1.57, skew: 0.3, sy: mix(0.84, 0.96, segU(u, h, 1)), dx: 8 + Math.sin(clock * 50) * 0.6 * (1 - u) };
    },
    cues: () => [],
    hit(a, i) {
      if (i !== bigHit(a)) return;
      const m = a.mast || 0, n = pick(m, [4, 8, 8, 12]), cx = a.px() + a.dir * 14, cy = groundY() - 20, dist = t7Sh(a, 'pierce') ? 150 : 120, c = col(a);
      // 땅에 꽂힌 그림자 대검
      texFx('f06', cx, groundY() + 4, c, { anchor: 'b', scale: m >= 3 ? 1 : 2 / 3, life: 0.8, fade: 0.45, move: (u) => [0, -46 * (1 - easeOut(Math.min(1, u / 0.12)))] });
      for (let j = 0; j < n; j++) cone(cx, cy, (j / n) * Math.PI * 2 + (m ? Math.PI / n : 0), dist, { scale: m >= 2 ? 1 : 2 / 3, color: c, life: 0.38 });
      for (const s of [-1, 1]) texFx('c8', cx + s * 30, groundY() + 1, TY_DIRT, { scale: 1, flip: s < 0, life: 0.55, fade: 0.4, move: (u) => [s * 40 * easeOut(u), 0] });
      ring(cx, { scale: pick(m, [1, 1, 4 / 3, 2]) });
      if (m >= 3) for (const d of [0.1, 0.2]) ring(cx, { scale: 2, delay: d, life: 0.5 });
      debris(cx, 8 + 2 * m, [TY_DIRT, TY_RED, '#5a4a42'], 1.5);
      impact({ stop: 0.06, shake: 0.35 });
    },
    hitTex(a, t) {
      const away = t.x < a.px();
      texFx('k10', t.x, t.y, col(a), { scale: 2 / 3, life: 0.26, flip: away, fade: 0.35 });
      if (t7Sh(a, 'split')) for (const s of [-1, 1]) cone(t.x, t.y, (away ? Math.PI : 0) + s * 0.8, 60, { life: 0.26 });
    },
  };

  // ── 철벽 돌파 (ty_f_ab: 돌진 + 단두) ── 충격 고리(C3, 세워서)가 앞서 달려 벽을 부수고 — 끝에 단두대 대검(E13)이 떨어져 마무리
  SKILL_FX.ty_f_ab = {
    pose: (u, a) => SKILL_FX.ramCharge.pose(u, a),
    tick(a, u, dt) {
      if ((a.mast || 0) < 1) return;
      a.tyRing = (a.tyRing || 0) - dt;
      if (u < 0.2 || u > 0.7 || a.tyRing > 0) return;
      a.tyRing = 0.11;
      const x = a.px() + a.dir * 22, c = col(a);
      texFx('c3', x, groundY() - 22, c, { scale: pick(a.mast, [2 / 3, 2 / 3, 1, 1]), rot: Math.PI / 2, life: 0.28, fade: 0.5, alpha: 0.85, move: (v) => [a.dir * 26 * v, 0] });
      debris(a.px(), 1, [TY_DIRT, TY_RED], 0.8);
    },
    cues: (a) => {
      const d = a.k.dur, hs = a.k.hits, drop = hs[hs.length - 1][0] * d;
      return [[0.2, (a) => { debris(a.px(), 5, [TY_DIRT, TY_RED], 1.2); impact({ shake: 0.08 }); }],
        // 단두대 대검이 마지막 타 직전에 하늘에서 떨어진다
        [Math.max(0.25, (drop - 0.3) / d), (a) => {
          const x = a.tx(), m = a.mast || 0;
          texFx('e13', x, 0, col(a), { anchor: 'b', scale: m >= 3 ? 2 : m >= 2 ? 4 / 3 : 1, life: 0.42, fade: 0.2, move: (u) => [0, (groundY() + 8) * easeIn(Math.min(1, u / 0.7))] });
        }]];
    },
    hit(a, i, n) {
      if (i < n - 1) { for (const t of a.targets(i)) ring(t.x, { scale: 2 / 3, life: 0.3 }); return; }
      const m = a.mast || 0, x = a.tx();
      impact({ stop: 0.14, shake: 0.5 });
      texFx('e14', clampX(x), groundY() + 6, TY_DIRT, { anchor: 'b', scale: m >= 3 ? 4 / 3 : 1, life: 0.6, fade: 0.35 });
      ring(x, { scale: pick(m, [1, 1, 4 / 3, 2]) });
      if (m >= 3) ring(x, { scale: 2, delay: 0.12 });
      debris(x, 10 + 4 * m, [TY_DIRT, TY_RED, '#5a4a42'], 1.6);
    },
    hitTex(a, t, share, i, n) {
      const last = i === n - 1;
      if (last) texFx('k09', t.x, t.y, col(a), { scale: pick(a.mast, [1, 1, 4 / 3, 4 / 3]), rot: Math.PI / 2, life: 0.4, fade: 0.3 });
      else texFx('k31', t.x, groundY() + 2, col(a), { anchor: 'b', scale: 2 / 3, life: 0.28, fade: 0.35, frames: 3 });
    },
  };

  // ── 단두 충격파 (ty_f_bk: 단두 + 충격파) ── 횡참이 지나간 줄에 불길 줄(F22)이 남고, 줄 위에서 충격(K10)이 차례로 솟구쳐 터진다
  SKILL_FX.ty_f_bk = {
    pose: (u, a) => SKILL_FX.wideCleave.pose(u, a),
    cues: () => [],
    hit(a, i, n) {
      if (i < n - 1) { impact({ shake: 0.1 }); return; }
      const m = a.mast || 0, c = col(a), x0 = a.x() + a.dir * 30, N = pick(m, [3, 4, 5, 7]), step = 52;
      scar(a, groundY() - 7, { scale: m >= 2 ? 1 : 2 / 3, life: 1.0 });
      for (let j = 1; j <= N; j++) {
        const x = x0 + a.dir * j * step;
        if (x < 56 || x > W - 56) break;
        skLater(a, 0.12 + j * 0.07, () => {
          texFx('k10', x, groundY() - 16, c, { scale: m >= 3 ? 1 : 2 / 3, rot: -Math.PI / 2, life: 0.38, fade: 0.3 });
          ring(x, { scale: 2 / 3, life: 0.35 });
          debris(x, 3, [TY_DIRT, TY_RED], 0.9);
          if (j === N) impact({ stop: 0.06, shake: 0.35 });
        });
      }
      impact({ stop: 0.1, shake: 0.3 });
    },
    hitTex(a, t, share, i, n) { texFx('k31', t.x, groundY() + 2, col(a), { anchor: 'b', scale: i === n - 1 ? 1 : 2 / 3, life: 0.34, fade: 0.35 }); },
  };

  // ── 폭군의 선풍 (ty_f_ak: 돌진 + 충격파) ── 철퇴 회전의 궤도에서, 매 타마다 충격 원뿔(K10)이 사방으로 흩어진다
  SKILL_FX.ty_f_ak = {
    pose: (u, a) => spinPose(u, a, 3 + (a.mast || 0)),
    cues: () => [[0.01, (a) => {
      const m = a.mast || 0;
      orbit(a, { n: pick(m, [2, 2, 3, 3]), R: pick(m, [38, 44, 50, 56]), sc: pick(m, [2 / 3, 1, 1, 4 / 3]), turns: 3 + m });
      impact({ shake: 0.1 });
    }]],
    hit(a, i, n) {
      const m = a.mast || 0, k = pick(m, [4, 6, 6, 8]), cx = a.px(), cy = groundY() - 22, off = rand(0, Math.PI * 2);
      for (let j = 0; j < k; j++) cone(cx, cy, off + (j / k) * Math.PI * 2, 100, { scale: 2 / 3, life: 0.32 });
      ring(cx, { scale: pick(m, [1, 1, 4 / 3, 4 / 3]), life: 0.34 });
      impact({ shake: 0.12 });
    },
    hitTex(a, t) { texFx('k10', t.x, t.y, col(a), { scale: 2 / 3, life: 0.26, flip: t.x < a.px(), fade: 0.35 }); },
  };
})();
