'use strict';
// 시즌7 스킬 빌드 트리 — 성좌기사(archon) 줄기 새 스킬·융합 7종의 자기 연출 (docs/specs/skill-tree-all.md "연출")
// 그림은 새로 뽑지 않고 지금 시트를 재사용한다 (VFX 규칙: 코드는 위치·크기·개수·궤적·타이밍·색 램프만, 크기는 2/3·1·4/3·2):
//  성광 선회 = C18 빛 고리(광륜)가 기사 몸을 위아래로 훑으며 돈다 + F02S 별 · 천벌의 빛줄기 = 기도 뒤 E44 빛기둥이 화면 끝까지 차례로 내리꽂히고 F03 빛줄기 ·
//  성검 파동 = E44 빛 가시 네 개를 모은 십자 빛이 사선 대형으로 날아간다 + C16 · 별빛 폭풍 = K29 별 폭발 + F02S 별들이 사방으로 + E07 성문양 ·
//  성역 심판 = E07·E07B 성문양과 빛 울타리가 가라앉는 순간 E44 빛기둥 · 십자 천벌 = 빛기둥이 지난 자리마다 십자 빛이 남았다 K29 로 터진다 ·
//  성광 폭풍 = 성광 선회 광륜 + 매 타 십자 빛이 사방으로.
// 검성(E43 초승달·E11 일섬)·파천검왕(붉은 E12·F22)과 겹치지 않게 흰 금빛 별·빛만 쓴다.
// 모습(칸마다): a.mast 0~3 (src/tree7.js T7_STAGE_AT) — 개수·크기·금빛이 단계마다 오른다. 변형은 내 기사(owner 'hero')만 (t7Sh).
// 이 파일은 tree7-fx.js 뒤에 불러온다 (SKILL_FX 에 새 스킬 id 로 따로 등록 — 바탕 연출을 빌리지 않는다).

(function () {
  const AR_COL = '#ffe9a0', AR_PALE = '#fff8dc';
  const col = (a) => ((a.mast || 0) >= 3 ? mixHex(AR_COL, MASTERY_GOLD, 0.5) : AR_COL);
  const pick = (m, arr) => arr[Math.max(0, Math.min(arr.length - 1, m || 0))];
  const hitF = (a, j) => a.k.hits[Math.min(j, a.k.hits.length - 1)][0];
  const bigHit = (a) => a.k.hits.reduce((b, h, i) => (h[1] > a.k.hits[b][1] ? i : b), 0);
  const clampX = (x) => Math.max(48, Math.min(W - 48, x));

  // 성검을 하늘로 들어 올렸다가(h0 직전까지 기도) 내려친다
  function prayPose(u, h0, a) {
    const w0 = Math.max(0.15, h0 - 0.3), w1 = Math.max(w0 + 0.05, h0 - 0.04);
    if (u < w0) { const r = easeOut(u / w0); return { wa: mix(-1.0, -1.75, r), sy: 1 + 0.08 * r, skew: -0.1 * r, lift: 12 * r }; }
    if (u < w1) return { wa: -1.75 + 0.04 * Math.sin(clock * 40), sy: 1.08, skew: -0.1, lift: 12 + Math.sin(clock * 8) };
    if (u < h0) { const d = easeIn(segU(u, w1, h0)); return { wa: mix(-1.75, 0.95, d), sy: mix(1.08, 0.84, d), skew: mix(-0.1, 0.4, d), lift: 12 * (1 - d) }; }
    if (u < h0 + 0.1) return { wa: 0.95, sy: 0.86, skew: 0.4 };
    const r = easeOut(segU(u, h0 + 0.1, Math.max(h0 + 0.2, 0.98)));
    return { wa: mix(0.95, -1.0, r), sy: mix(0.86, 1, r), skew: 0.4 * (1 - r) };
  }
  // 성검을 머리 위로 든 채 몸을 가볍게 띄운다 (광륜 · 별빛)
  const haloPose = (u) => ({ wa: -1.57 + 0.12 * Math.sin(u * 20), lift: 6 + 4 * Math.sin(u * 14), sy: 1.04 });

  // 십자 빛: E44 빛 가시 네 개 (위 · 아래 짧게 · 좌우). rot 만큼 돌린다. 한 개가 32×64 도트라 sy 로 줄여 쓴다
  function crossDraw(x, y, c, f, sc, alpha, rot = 0, lm = 1) {
    for (const [r, fy, len] of [[0, 0, 0.55], [0, 1, 0.35], [Math.PI / 2, 0, 0.45], [-Math.PI / 2, 0, 0.45]])
      vfxDraw(ctx, 'e44', c, f, x, y, { anchor: 'b', scale: sc, rot: rot + r, flipY: !!fy, sx: 0.6, sy: len * lm, alpha });
  }
  // 십자 빛 한 발: (x,y) 에서 ang 방향으로 dist 만큼 날아가며 천천히 돈다. 뒤로 작은 별가루(C16)
  function crossShot(x, y, ang, dist, o = {}) {
    const life = o.life || 0.4, c = o.color || AR_COL, sc = o.scale || 2 / 3, d0 = o.delay || 0;
    skFx(null, d0, life, (u) => {
      const e = easeOut(u), px = x + Math.cos(ang) * dist * e, py = y + Math.sin(ang) * dist * e, al = u < 0.65 ? 1 : (1 - u) / 0.35;
      for (let k = 1; k <= 3; k++) { const v = Math.max(0, e - k * 0.07); vfxDraw(ctx, 'c16', AR_PALE, Math.floor(clock * 12 + k) % 4, x + Math.cos(ang) * dist * v, y + Math.sin(ang) * dist * v, { scale: 2 / 3, alpha: al * (1 - k * 0.28) }); }
      crossDraw(px, py, c, Math.min(4, Math.floor(u * 5)), sc, al, u * 0.8, o.lm || 1);
    });
  }
  // 별 한 발: F02S 4갈래 별이 날아간다
  function starShot(x, y, ang, dist, o = {}) {
    const life = o.life || 0.4, c = o.color || AR_COL, sc = o.scale || 2 / 3, d0 = o.delay || 0;
    skFx(null, d0, life, (u) => {
      const e = easeOut(u), al = u < 0.6 ? 1 : (1 - u) / 0.4;
      for (let k = 1; k <= 3; k++) { const v = Math.max(0, e - k * 0.08); vfxDraw(ctx, 'c16', AR_PALE, Math.floor(clock * 12 + k) % 4, x + Math.cos(ang) * dist * v, y + Math.sin(ang) * dist * v, { scale: 2 / 3, alpha: al * (1 - k * 0.28) }); }
      vfxDraw(ctx, 'f02s', c, Math.floor(clock * 12) % 5, x + Math.cos(ang) * dist * e, y + Math.sin(ang) * dist * e, { scale: sc, alpha: al });
    });
  }
  // 광륜: C18 빛 고리들이 기사 몸을 위아래로 훑으며 돈다. 고리 가장자리를 별(F02S)이 돈다. follow: 대상에게 날아가 붙는다
  function halos(a, o) {
    const life = a.k.dur, c = o.col || col(a), R = 24 * 1.5 * o.sc;
    for (let r = 0; r < o.n; r++) {
      aFx(a, 0, life, (u) => {
        const cx = o.follow ? mix(a.px(), a.tx(), easeOut(Math.min(1, u / 0.35))) : a.px();
        const k = Math.min(1, u / 0.12) * (u > 0.88 ? (1 - u) / 0.12 : 1);
        const y = Math.max(groundY() - 62, Math.min(groundY() - 6, groundY() - 28 - (r - (o.n - 1) / 2) * 15 + Math.sin(u * Math.PI * 4 + r * 2.1) * 14));
        vfxDraw(ctx, 'c18', c, Math.floor(clock * 14 + r) % 5, cx, y, { scale: o.sc, alpha: k * 0.95 });
        for (let j = 0; j < 2; j++) {
          const th = u * life * 5 + j * Math.PI + r;
          vfxDraw(ctx, 'f02s', AR_PALE, Math.floor(clock * 12 + j) % 5, cx + Math.cos(th) * R, y + Math.sin(th) * R * 0.33, { scale: 2 / 3, alpha: k * (Math.sin(th) > 0 ? 1 : 0.6) });
        }
      });
    }
    // 발밑 성문양
    aFx(a, 0, life, (u) => {
      const cx = o.follow ? mix(a.px(), a.tx(), easeOut(Math.min(1, u / 0.35))) : a.px();
      vfxDraw(ctx, 'e07', c, 0, cx, groundY() - 1, { scale: o.sc >= 1 ? 1 : 2 / 3, alpha: Math.min(1, u / 0.12) * (u > 0.88 ? (1 - u) / 0.12 : 1) * (0.7 + 0.3 * Math.sin(clock * 5)) });
    });
  }
  // 빛기둥 한 줄기 (E44, 바닥 기준). x 에서 delay 뒤 내리꽂힌다
  const pillar = (x, o = {}) => texFx('e44', clampX(x), groundY() + (o.dy || 0), o.color || AR_COL, { anchor: 'b', scale: o.scale || 1, sx: o.sx || 0.5, life: o.life || 0.4, delay: o.delay || 0, alpha: o.alpha == null ? 1 : o.alpha, fade: 0.4 });

  // ── 성광 선회 (ar_whirl, 바탕 심판의 일격) ── 빛의 고리가 몸을 위아래로 훑으며 돈다. 1칸 하나 · ★ 둘 · ★★ 크게 · ★★★ 셋 + 금빛
  //  제자리 성지(a_grow): 한 단계 크게 · 인도하는 광륜(a_follow): 고리가 대상에게 날아가 붙는다
  SKILL_FX.ar_whirl = {
    pose: (u) => haloPose(u),
    cues: () => [[0.01, (a) => {
      const m = a.mast || 0, grow = t7Sh(a, 'grow'), follow = t7Sh(a, 'follow');
      halos(a, { n: pick(m, [1, 2, 2, 3]), sc: pick(m + (grow ? 1 : 0), [2 / 3, 2 / 3, 1, 4 / 3, 2]), follow });
      impact({ shake: 0.06 });
    }]],
    hit(a, i) { for (const t of a.targets(i)) for (let j = 0; j < 2; j++) parts.push({ x: t.x + rand(-8, 8), y: t.y + rand(-10, 10), vx: rand(-20, 20), vy: rand(-70, -30), g: -20, size: 2, color: j ? '#ffffff' : '#ffe08a', life: 0.5, t: 0, add: true }); },
    hitTex(a, t) { texFx('k29', t.x, t.y, col(a), { scale: 2 / 3, frames: 3, life: 0.24, fade: 0.4, alpha: 0.9 }); },
  };

  // ── 천벌의 빛줄기 (ar_flash, 바탕 심판의 일격) ── 잠깐 기도한 뒤, 빛기둥이 앞에서 화면 끝까지 차례로 내리꽂힌다. ★ 부터 촘촘하게
  //  메아리 천벌(b_after): 0.5초 뒤 더 옅은 줄 · 삼위 천벌(b_triple): 앞뒤 세 줄
  function sweep(a, o = {}) {
    const m = a.mast || 0, dir = a.dir, x0 = a.px() + dir * 44, x1 = dir > 0 ? W - 48 : 48, step = o.step || pick(m, [64, 52, 44, 36]);
    const n = Math.floor(Math.abs(x1 - x0) / step);
    for (let j = 0; j <= n; j++) {
      const x = x0 + dir * j * step;
      pillar(x, { delay: (o.delay || 0) + j * 0.035, scale: o.scale || pick(m, [2 / 3, 1, 1, 4 / 3]), dy: o.dy || 0, alpha: o.alpha, color: o.color, life: 0.38 });
    }
  }
  SKILL_FX.ar_flash = {
    pose: (u, a) => prayPose(u, hitF(a, bigHit(a)), a),
    cues: () => [[0.02, (a) => {
      // 기도: 발밑 성문양이 펼쳐지고 별이 칼끝으로 모여든다
      const h = hitF(a, bigHit(a)) * a.k.dur;
      aFx(a, 0, h, (u) => vfxDraw(ctx, 'e07', col(a), 0, a.px(), groundY() - 1, { scale: 1, alpha: Math.min(1, u / 0.3) * (0.7 + 0.3 * Math.sin(clock * 9)) }));
      for (let j = 0; j < 6; j++) {
        const ang = rand(0, Math.PI * 2), r = rand(34, 56), d = rand(0, h * 0.7);
        skLater(a, d, () => { const g = gripOf(a), tx = g.x + Math.cos(g.ang) * 30, ty = g.y + Math.sin(g.ang) * 30; texFx('f02s', tx + Math.cos(ang) * r, ty + Math.sin(ang) * r, AR_PALE, { scale: 2 / 3, life: 0.3, fade: 0.4, move: (u) => [-Math.cos(ang) * r * u, -Math.sin(ang) * r * u] }); });
      }
    }]],
    hit(a, i) {
      if (i !== bigHit(a)) { for (const t of a.targets(i)) pillar(t.x, { scale: 2 / 3, life: 0.3 }); return; }
      const triple = t7Sh(a, 'triple');
      if (triple) for (const [dy, dx, al] of [[-8, 0, 0.8], [0, 22, 1], [8, 44, 0.8]]) sweep(a, { scale: 2 / 3, step: 66, dy, alpha: al, delay: dx / 900 });
      else sweep(a);
      if (t7Sh(a, 'after')) sweep(a, { delay: 0.5, alpha: 0.5, color: '#cfe0ff', scale: 2 / 3 });
      impact({ stop: 0.1, shake: 0.35 });
    },
    hitTex(a, t, share, i) { texFx('f03', t.x, groundY() + 2, col(a), { anchor: 'b', scale: 2 / 3, frames: 4, life: 0.4, fade: 0.4 }); },
  };

  // ── 성검 파동 (ar_wave, 바탕 강철 베기) ── 십자 모양 빛이 사선 대형으로 날아간다: 1칸 1발 · ★ 3발 · ★★ 5발 · ★★★ 7발 금빛. 관통(k_pierce)이면 더 멀리
  SKILL_FX.ar_wave = {
    pose: (u, a) => prayPose(u, hitF(a, 0), a),
    cues: () => [],
    hit(a, i) {
      if (i) return;
      const m = a.mast || 0, n = pick(m, [1, 3, 5, 7]), g = gripOf(a), y0 = Math.min(g.y, groundY() - 34), pierce = t7Sh(a, 'pierce');
      const dist = pierce ? 320 : Math.min(260, Math.max(80, Math.abs(a.tx() - g.x) + 20));
      for (let j = 0; j < n; j++) {
        const row = Math.ceil(j / 2), side = j % 2 ? -1 : 1, y = Math.max(groundY() - 70, Math.min(groundY() - 8, y0 + side * row * 18));
        crossShot(g.x + a.dir * (14 - row * 22), y, a.dir > 0 ? 0 : Math.PI, dist - row * 14, { delay: row * 0.07, scale: 2 / 3, lm: m >= 3 ? 0.6 : m >= 2 ? 0.8 : 1, color: col(a) });
      }
      impact({ shake: 0.12 });
    },
    hitTex(a, t) { texFx('k29', t.x, t.y, col(a), { scale: 2 / 3, frames: 3, life: 0.22, fade: 0.4 }); },
  };

  // ── 별빛 폭풍 (ar_storm, 바탕 강철 베기) ── 큰 별이 터지며(K29) 작은 별들이 사방으로: 1칸 4방향 · ★ 8 · ★★ 8 크게 · ★★★ 12 금빛
  //  분열(k_split): 맞은 자리에서 별이 두 갈래로
  SKILL_FX.ar_storm = {
    pose(u, a) {
      const h = hitF(a, bigHit(a)), w = Math.max(0.12, h - 0.25);
      if (u < w) { const r = easeOut(u / w); return { wa: mix(-1.0, -1.57, r), lift: 10 * r, sy: 1 + 0.06 * r }; }
      if (u < h) return { wa: -1.57, lift: 10 + Math.sin(clock * 30) * 1.2, sy: 1.06 };
      return { wa: mix(-1.57, 1.57, easeOut(segU(u, h, h + 0.12))), lift: 10 * (1 - segU(u, h, h + 0.12)), sy: mix(1.06, 0.92, segU(u, h, h + 0.12)) };
    },
    cues: () => [],
    hit(a, i) {
      if (i !== bigHit(a)) return;
      const m = a.mast || 0, n = pick(m, [4, 8, 8, 12]), cx = a.px(), cy = groundY() - 30, dist = (t7Sh(a, 'pierce') ? 150 : 120) + (m >= 3 ? 30 : 0), c = col(a);
      texFx('k29', cx, cy, c, { scale: pick(m, [2 / 3, 1, 1, 4 / 3]), life: 0.4, fade: 0.4 });
      texFx('e07', cx, groundY() - 1, c, { scale: pick(m, [2 / 3, 1, 1, 4 / 3]), life: 0.5, fade: 0.5 });
      for (let j = 0; j < n; j++) starShot(cx, cy, (j / n) * Math.PI * 2 + (m ? Math.PI / n : 0), dist, { scale: m >= 3 ? 4 / 3 : m >= 2 ? 1 : 2 / 3, color: c, life: m >= 3 ? 0.55 : 0.4 });
      impact({ stop: 0.06, shake: 0.25 });
    },
    hitTex(a, t) {
      texFx('f02s', t.x, t.y, col(a), { scale: 2 / 3, life: 0.26, fade: 0.4 });
      if (t7Sh(a, 'split')) for (const s of [-1, 1]) starShot(t.x, t.y, (a.dir > 0 ? 0 : Math.PI) + s * 0.8, 60, { life: 0.26 });
    },
  };

  // ── 성역 심판 (ar_f_ab: 성역 + 심판) ── 발밑 성문양과 빛 울타리(E07·E07B)가 솟았다가 가라앉는 순간 — 심판의 빛기둥(E44)이 내리꽂힌다
  SKILL_FX.ar_f_ab = {
    pose(u, a) {
      const hb = hitF(a, bigHit(a)), p1 = Math.max(0.15, 0.3 * hb), p2 = Math.max(p1 + 0.05, 0.55 * hb);
      if (u < p1) { const d = easeIn(u / p1); return { wa: mix(-1.0, 1.57, d), sy: mix(1, 0.86, d) }; }
      if (u < p2) return { wa: 1.57, sy: 0.9 };
      if (u < p2 + 0.12) { const r = easeOut((u - p2) / 0.12); return { wa: mix(1.57, -1.75, r), sy: mix(0.9, 1.08, r), lift: 12 * r }; }
      if (u < hb - 0.04) return { wa: -1.75 + 0.04 * Math.sin(clock * 40), sy: 1.08, skew: -0.1, lift: 12 };
      return prayPose(u, hb, a);
    },
    cues: () => [[0.06, (a) => {
      // 성역: 성문양 + 빛 울타리가 솟았다가 심판 직전에 가라앉는다
      const hb = hitF(a, bigHit(a)) * a.k.dur, life = Math.max(0.4, hb - 0.06), m = a.mast || 0, sc = m >= 2 ? 1 : 2 / 3;
      aFx(a, 0, life, (u) => {
        const x = a.px(), g = easeOut(Math.min(1, u / 0.3)), sink = u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1, al = Math.min(1, u / 0.15) * sink;
        vfxDraw(ctx, 'e07', col(a), 0, x, groundY() - 1, { scale: sc, alpha: al * (0.75 + 0.25 * Math.sin(clock * 6)) });
        vfxDraw(ctx, 'e07b', col(a), Math.floor(clock * 8) % 5, x, groundY() - 1, { anchor: 'b', scale: sc, sy: Math.max(0.01, g * sink), alpha: al * 0.9 });
      });
    }]],
    hit(a, i, n) {
      if (i !== bigHit(a)) {
        // 성역의 파문: 둘레로 튕겨 나가는 금빛 파동 (K06)
        for (const s of [-1, 1]) texFx('k06', a.px() + s * 44, groundY() - 16, col(a), { scale: 2 / 3, alpha: 0.85, life: 0.36, flip: s < 0, fade: 0.4, move: (u) => [s * 24 * easeOut(u), 0] });
        return;
      }
      for (const t of a.targets(i)) {
        pillar(t.x, { scale: pick(a.mast, [1, 4 / 3, 4 / 3, 2]), sx: (a.mast || 0) >= 3 ? 1.6 : 0.8, life: 0.5 });
        if ((a.mast || 0) >= 3) for (const s of [-1, 1]) pillar(t.x + s * 30, { scale: 4 / 3, sx: 0.7, life: 0.45, delay: 0.06 });
        if ((a.mast || 0) >= 3) for (const d of [0, 0.12]) texFx('c18', t.x, groundY() - 4, col(a), { scale: 2, life: 0.4, delay: d, fade: 0.5 });
        if ((a.mast || 0) >= 3) texFx('k29', t.x, groundY() - 30, col(a), { scale: 4 / 3, life: 0.4, delay: 0.1, fade: 0.4 });
      }
      impact({ stop: 0.14, shake: 0.45 });
    },
    hitTex(a, t, share, i) {
      if (i === bigHit(a)) texFx('k05', t.x, groundY() + 2, col(a), { anchor: 'b', scale: pick(a.mast, [2 / 3, 1, 1, 4 / 3]), life: 0.4, fade: 0.3 });
      else texFx('k06', t.x - a.dir * 8, t.y, col(a), { scale: 2 / 3, life: 0.3, flip: a.dir > 0, fade: 0.4 });
    },
  };

  // ── 십자 천벌 (ar_f_bk: 심판 + 파동) ── 빛줄기가 지나간 자리마다 십자 빛이 남았다가 차례로 터진다
  SKILL_FX.ar_f_bk = {
    pose: (u, a) => prayPose(u, hitF(a, bigHit(a)), a),
    cues: () => [],
    hit(a, i) {
      if (i !== bigHit(a)) { for (const t of a.targets(i)) pillar(t.x, { scale: 2 / 3, life: 0.3 }); return; }
      const m = a.mast || 0, N = pick(m, [3, 4, 5, 7]), x0 = a.px() + a.dir * 50, c = col(a), step = 62;
      for (let j = 0; j < N; j++) {
        const x = x0 + a.dir * j * step;
        if (x < 56 || x > W - 56) break;
        pillar(x, { delay: j * 0.08, scale: pick(m, [2 / 3, 1, 1, 2]), sx: m >= 3 ? 0.8 : 0.5, life: 0.36 });
        // 남은 십자 빛 — 잠깐 떠서 깜박이다 터진다
        const born = j * 0.08 + 0.1, boom = 0.5 + j * 0.06;
        skFx(null, born, boom - born + 0.1, (u) => {
          const t = u * (boom - born + 0.1), k = Math.min(1, t / 0.1), blink = t > boom - born - 0.12 && Math.floor(t * 40) % 2 ? 0.4 : 1, out = t > boom - born ? 0 : 1;
          crossDraw(x, groundY() - 30, c, Math.floor(clock * 10) % 5, m >= 3 ? 1 : 2 / 3, k * blink * out, clock * 0.5);
        });
        skLater(a, boom, () => {
          texFx('k29', x, groundY() - 30, c, { scale: pick(m, [2 / 3, 2 / 3, 1, 2]), life: 0.34, fade: 0.4 });
          if (m >= 3) texFx('c18', x, groundY() - 6, c, { scale: 2, life: 0.4, fade: 0.5 });
          if (j === N - 1 || j === 0) impact({ stop: 0.05, shake: 0.22 });
        });
      }
      impact({ stop: 0.1, shake: 0.3 });
    },
    hitTex(a, t, share, i) { texFx('k29', t.x, t.y, col(a), { scale: i === bigHit(a) ? 1 : 2 / 3, frames: 4, life: 0.3, fade: 0.4 }); },
  };

  // ── 성광 폭풍 (ar_f_ak: 성역 + 파동) ── 성광 선회의 광륜이 돌면서, 매 타마다 십자 빛이 사방으로 흩어진다
  SKILL_FX.ar_f_ak = {
    pose: (u) => haloPose(u),
    cues: () => [[0.01, (a) => {
      const m = a.mast || 0;
      halos(a, { n: pick(m, [1, 2, 2, 3]), sc: pick(m, [2 / 3, 1, 1, 4 / 3]) });
      impact({ shake: 0.06 });
    }]],
    hit(a, i) {
      const m = a.mast || 0, k = pick(m, [3, 4, 5, 6]), cx = a.px(), cy = groundY() - 30, off = rand(0, Math.PI * 2);
      for (let j = 0; j < k; j++) crossShot(cx, cy, off + (j / k) * Math.PI * 2, 95, { scale: 2 / 3, life: 0.34, color: col(a) });
      texFx('k29', cx, cy, col(a), { scale: 2 / 3, frames: 3, life: 0.24, fade: 0.4 });
      impact({ shake: 0.1 });
    },
    hitTex(a, t) { texFx('f02s', t.x, t.y, col(a), { scale: 2 / 3, life: 0.26, fade: 0.4 }); },
  };
})();
