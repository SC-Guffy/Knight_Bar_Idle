'use strict';
// 시즌7 스킬 빌드 트리 — 공성포수 줄기 새 스킬·융합 연출 (docs/specs/skill-tree-all.md, 모델은 src/tree7-fx.js 검성 연출)
// 그림은 새로 뽑지 않고 지금 시트를 재사용한다 (VFX 규칙: 코드는 위치·크기·개수·궤적·타이밍·색 램프만). 색은 철·연기·불:
//  회전 포대 = F29 노포가 기사 둘레를 돌며 P6 쇠뇌 살을 쏜다 (바탕 다연장 사격의 살 다발과 달리 포대 자체가 돈다) ·
//  파성 꿰뚫기 = P6 거대 살 + F30 굵은 줄이 화면 끝까지 · C8 땅 균열 · E32 가장자리에 꽂힌 살 (바탕 폭열탄의 포물선 폭탄과 달리 일직선) ·
//  화약 쇠뇌살 = P6 살이 부채꼴 일제 사격, 뒤에 C6 포연 · 철우 포화 = E32 쇠뇌 살이 기사 둘레 고리에 쏟아져 박히고 K21 이 터진다 ·
//  융합 = 두 부모 연출 잇기 (연장 폭격 = 다연장 + 거대 폭탄 살, 파성 포화 = 파성 줄 + 줄을 따라 터지는 불씨, 회전 철우 = 포대 + 쇠 소나기).
// 모습: a.mast 0~3 — 개수·크기가 단계마다 오르고 ★★★ 는 금빛 섬광이 더해진다. 변형(shape)은 내 기사(owner 'hero')만 (t7Sh).
// 이 파일은 tree7-fx.js 뒤에 불러온다 (t7Sh 등을 쓴다). 줄기 안에서만 쓰는 도구는 즉시 실행 함수 안에 둔다.

(function () {
  const SM_IRON = '#c9c2b4', SM_SMOKE = '#8f8a86', SM_SOOT = '#6a5a4a', SM_GOLD = '#fff0b8';
  const mz = (a) => (typeof abMuzzle === 'function' ? abMuzzle(a) : (() => { const h = hand(a); return { x: h.x + a.dir * 12, y: h.y - 2 }; })());
  const tg = (a, i) => a.targets(i)[0] || { x: a.tx(), y: a.ty() };
  const own = (a, id) => a.id === id;
  // 포연 한 덩이 (C6: 퍼졌다 흩어짐)
  const smoke = (x, y, o = {}) => texFx('c6', x, y, SM_SMOKE, { scale: o.scale || 2 / 3, life: o.life || 0.45, delay: o.delay || 0, fade: 0.5, move: (u) => [0, -14 * u] });
  // 하늘에서 떨어져 박히는 쇠뇌 살 (E32, 촉이 아래): x1 에 박혀 K22 쇳조각 + 포연. boom 이면 K21 불덩이도
  function rain(x1, delay = 0, o = {}) {
    const gy = groundY() - 4, x0 = x1 - rand(10, 30), rot = Math.atan2(gy + 24, x1 - x0) - Math.PI * 0.75, sc = o.scale || 2 / 3;
    skFx(null, delay, 0.18, (u) => { for (let k = 3; k >= 0; k--) { const v = Math.max(0, u - k * 0.06); vfxDraw(ctx, 'e32', 'raw', 0, mix(x0, x1, v), mix(-24, gy, easeIn(v)), { rot, scale: sc, alpha: k ? 0.5 - k * 0.12 : 1 }); } }, () => {
      texFx('k22', x1, gy - 4, 'raw', { scale: 2 / 3, life: 0.25, frames: 4 });
      smoke(x1, gy - 8);
      if (o.boom) texFx('k21', x1, gy - 10, 'raw', { scale: o.gold ? 4 / 3 : 1, life: 0.3, frames: 4 });
      if (o.gold) texFx('k20', x1, gy - 12, SM_GOLD, { scale: 2 / 3, life: 0.3 });
      skFx(null, 0, 0.9, (u) => vfxDraw(ctx, 'e32', 'raw', 0, x1 + Math.sin(u * 60) * (1 - u) * 1.2, gy - 6, { rot, scale: sc, alpha: u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3 }));
    });
  }
  // 견착 자세 (아래 fire 초에 쏜다): 장전 → 반동 → 복귀
  const posOf = (fireAt, recoil = 8) => (u, a) => {
    const d = a.k.dur, t = u * d, f = fireAt(a), p = abBracePose(t, Math.min(0.4, f * 0.6), f, recoil);
    if (p) return p;
    const r = easeOut(segU(t, f + 0.1, d));
    return { dx: -recoil * (1 - r), skew: -0.22 * (1 - r), bowA: -0.15 * (1 - r) };
  };

  // ── 회전 포대 (whirl) ── 노포(F29)가 기사 둘레 땅을 돈다: 1칸 1대 · ★ 2대 · ★★ 크게 · ★★★ 3대 + 금빛 고리.
  //  거점 포대(a_grow): 2배 반경·한 단계 큰 포대로 제자리 · 추적 포대(a_follow): 포대 고리가 대상에게 날아가 붙는다
  function orbit(a) {
    const m = a.mast || 0, W_ = own(a, 'sm_whirl'), grow = W_ && t7Sh(a, 'grow'), follow = W_ && t7Sh(a, 'follow');
    const n = [1, 2, 2, 3][m], life = a.k.dur, R = grow ? 64 : 38, sc = grow ? (m >= 3 ? 4 / 3 : 1) : m >= 2 ? 1 : 2 / 3;
    const cxAt = (t) => (follow ? mix(a.x(), a.tx() - a.dir * 30, easeOut(Math.min(1, t / 0.35))) : a.x());
    a.t7pos = (j, t) => { const ang = t * 3.6 + (j * Math.PI * 2) / n; return [cxAt(t) + Math.cos(ang) * R, groundY() + 2 + Math.sin(ang) * R * 0.2, ang]; };
    a.t7sc = sc;
    aFx(a, 0, life, (u) => {
      const t = u * life, al = Math.min(1, t / 0.12, (life - t) / 0.15), ring = m >= 3 ? SM_GOLD : SM_IRON;
      vfxDraw(ctx, 'c18', ring, vfxLoopF('c18', 10), cxAt(t), groundY() + 3, { scale: grow ? 2 : 1, alpha: 0.55 * al });
      const order = [];
      for (let j = 0; j < n; j++) order.push([j, ...a.t7pos(j, t)]);
      order.sort((p, q) => Math.sin(p[3]) - Math.sin(q[3]));
      for (const [, x, y, ang] of order) vfxDraw(ctx, 'f29', 'raw', 0, x, y, { anchor: 'b', scale: sc, flip: Math.cos(ang) < 0, alpha: al * (Math.sin(ang) > 0 ? 1 : 0.6) });
    });
    if (m >= 2) for (let i = 0; i < 8; i++) parts.push({ x: a.x() + rand(-24, 24), y: groundY() - 2, vx: rand(-60, 60), vy: rand(-70, -20), g: 240, size: 2, color: i % 2 ? '#c9b38a' : '#a8946a', life: 0.4, t: 0 });
  }
  // 포대 한 대가 대상으로 쏜다
  function turretShot(a, i) {
    if (!a.t7pos) return;
    const m = a.mast || 0, n = [1, 2, 2, 3][m], t = a.u * a.k.dur, [x, y] = a.t7pos(i % n, t), T = tg(a, i), d = T.x >= x ? 1 : -1;
    const sx = x + d * 14 * a.t7sc, sy = y - 36 * a.t7sc;
    texShotFx('p6', sx, sy, T.x, T.y, 0.09, 'raw', { scale: 2 / 3, flipY: d < 0 });
    smoke(sx, sy, { scale: 2 / 3, life: 0.35 });
    burst(sx, sy, 3, ['#ffe066', '#ff7a2a'], 60, 2, 0);
    impact({ shake: 0.05 });
  }
  const whirlFx = {
    ...SKILL_FX.boltStorm,
    tick: undefined,
    cues: () => [[0.01, orbit]],
    hit(a, i) { turretShot(a, i); },
    hitTex(a, t) { texFx('k21', t.x, t.y + 4, 'raw', { scale: (a.mast || 0) >= 2 ? 1 : 2 / 3, life: 0.3, frames: 4, flip: a.dir < 0 }); },
  };
  SKILL_FX.sm_whirl = whirlFx;

  // ── 파성 꿰뚫기 (flash) ── 굵은 파성 살(P6) 한 발이 F30 굵은 줄을 끌며 화면 끝까지 일직선: 땅에 C8 균열, 가는 길마다 C6 포연, 끝에 E32 가 꽂혀 떤다.
  //  ★ 부터 줄이 굵어지고 ★★★ 는 금빛 + 성문 붕괴(막타에 K37 + 버섯구름). 메아리 파성(b_after): 0.5초 뒤 반투명 한 줄 더 · 삼연 파성(b_triple): 위·가운데·아래 세 줄
  function bolt(a, o = {}) {
    const M = mz(a), d = a.dir, y = M.y + (o.dy || 0), end = d > 0 ? W + 30 : -30, sc = o.scale || 1, dl = o.delay || 0, al = o.alpha == null ? 1 : o.alpha, col = o.color || SM_IRON;
    skFx(null, dl, 0.5, (u) => {
      const t = u * 0.5, fly = easeOut(Math.min(1, t / 0.14)), hx = mix(M.x, end, fly), out = t < 0.16 ? 1 : 1 - (t - 0.16) / 0.34;
      swLine(ctx, 'f30', col, 0, M.x, y, hx, y, { scale: sc, sy: 0.35 + 0.65 * out, alpha: al * Math.min(1, out * 1.5) * 0.9 });
      vfxDraw(ctx, 'p6', 'raw', 0, hx, y, { scale: sc, flip: d < 0, alpha: al * (fly >= 1 ? Math.max(0, 1 - (t - 0.14) / 0.1) : 1) });
    });
    const L = Math.abs(end - M.x);
    for (let j = 0; j < 8; j++) { const p = (j + 1) / 9; smoke(M.x + d * L * p, y + rand(-4, 4), { delay: dl + 0.14 * (1 - Math.cbrt(1 - p)) + 0.02, scale: sc >= 1 ? 1 : 2 / 3 }); }
    if (!o.small) {
      skFx(null, dl + 0.03, 0.7, (u) => vfxTileRun(ctx, 'c8', SM_SOOT, Math.min(5, Math.floor(u * 6)), M.x + d * 20, groundY(), Math.abs(a.tx() - M.x) + 90, d, { scale: sc >= 1 ? 1 : 2 / 3, alpha: al * (u < 0.5 ? 1 : 1 - (u - 0.5) / 0.5) }));
      const ex = d > 0 ? W - 10 : 10, rot = abE32Rot(d > 0 ? 0 : Math.PI);
      skFx(null, dl + 0.13, 0.8, (u) => vfxDraw(ctx, 'e32', 'raw', 0, ex + Math.sin(u * 70) * (1 - u) * 2, y, { rot, scale: sc >= 1 ? 1 : 2 / 3, alpha: al * (u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3) }));
    }
  }
  const plan = (a) => {
    const hits = a.k.hits, n = hits.length, d = a.k.dur, f = own(a, 'sm_flash'), tri = f && t7Sh(a, 'triple'), aft = f && t7Sh(a, 'after'), orig = tri ? n / 3 : aft ? n / 2 : n;
    return { fire: Math.max(0.12, hits[0][0] * d - 0.1), tri, aft, ghost: aft ? (hits[orig][0] - hits[0][0]) * d : 0 };
  };
  const flashFx = {
    ...SKILL_FX.blastBolt,
    pose: posOf((a) => plan(a).fire),
    tick: undefined,
    cues: (a) => {
      const p = plan(a), d = a.k.dur, m = a.mast || 0, sc = [2 / 3, 1, 1, 4 / 3][m];
      return [[p.fire / d, (a) => {
        if (p.tri) for (let j = 0; j < 3; j++) bolt(a, { dy: (j - 1) * 16, scale: 2 / 3, delay: j * 0.04, small: j !== 1 });
        else bolt(a, { scale: sc });
        if (p.aft) bolt(a, { scale: sc, delay: p.ghost, alpha: 0.55, color: SM_SMOKE, small: true });
        abMuzzleFlash(a, 1.2); abShell(a);
        if (m >= 3) { const M = mz(a); texFx('k20', M.x + a.dir * 10, M.y, SM_GOLD, { scale: 1, life: 0.3 }); }
        impact({ stop: 0.08, shake: 0.3 });
      }]];
    },
    hitTex(a, t, share, i, n) {
      const m = a.mast || 0, last = i === n - 1;
      if (own(a, 'sm_flash') && t7Sh(a, 'triple') && i % 3) { texFx('k22', t.x, t.y, 'raw', { scale: 2 / 3, life: 0.22, frames: 4 }); return; }
      texFx('k37', t.x, t.y + 6, 'raw', { scale: m >= 3 && last ? 4 / 3 : 2 / 3, life: 0.4, flip: a.dir < 0 });
      if (m >= 3 && last) abMushroomFx(t.x, 1.0, 2 / 3);
    },
    hit(a, i, n) { if (i === n - 1) impact({ stop: 0.06, shake: 0.2 }); },
  };
  SKILL_FX.sm_flash = flashFx;

  // ── 화약 쇠뇌살 (wave) ── 화약 달린 P6 살이 부채꼴 일제 사격: 1칸 1발 · ★ 3발 · ★★ 5발 · ★★★ 7발 + 금빛 섬광. 살마다 C6 포연이 뒤에 남고 닿는 자리에 K21 이 터진다.
  //  관통촉(k_pierce)이면 터지면서도 멈추지 않고 화면 안쪽 멀리까지 날아간다
  function salvo(a) {
    const m = a.mast || 0, n = [1, 3, 5, 7][m], M = mz(a), d = a.dir, T = tg(a, 0), pierce = t7Sh(a, 'pierce');
    const far = pierce ? Math.max(Math.abs(T.x - M.x) + 170, 300) : Math.abs(T.x - M.x);
    for (let j = 0; j < n; j++) {
      const f = n > 1 ? j / (n - 1) - 0.5 : 0, y0 = M.y + f * 6, y1 = T.y + f * 28, xe = M.x + d * far, life = 0.07 + far / 1300, dl = j * 0.035;
      texShotFx('p6', M.x, y0, xe, pierce ? y1 + f * 14 : y1, life, 'raw', { scale: 2 / 3, delay: dl, flipY: d < 0, tail: 1 });
      for (let k = 1; k <= 4; k++) smoke(mix(M.x, xe, k / 5), mix(y0, y1, k / 5), { delay: dl + life * (k / 5), life: 0.4 });
      const pass = pierce ? Math.min(1, Math.abs(T.x - M.x) / far) : 1;
      texFx('k21', mix(M.x, xe, pass), mix(y0, y1, pass), 'raw', { scale: 2 / 3, life: 0.3, delay: dl + life * pass, frames: 4 });
      if (pierce) texFx('k22', xe, y1, 'raw', { scale: 2 / 3, life: 0.25, delay: dl + life, frames: 4 });
    }
    abMuzzleFlash(a, 1 + m * 0.2); abShell(a);
    if (m >= 3) texFx('k20', M.x + d * 12, M.y, SM_GOLD, { scale: 1, life: 0.3 });
    impact({ shake: 0.1 });
  }
  SKILL_FX.sm_wave = {
    ...SKILL_FX.blastBolt,
    pose: posOf((a) => Math.max(0.12, a.k.hits[0][0] * a.k.dur - 0.09), 6),
    tick: undefined,
    cues: (a) => [[Math.max(0.12, a.k.hits[0][0] * a.k.dur - 0.09) / a.k.dur, salvo]],
    hitTex(a, t) { texFx('k22', t.x, t.y, 'raw', { scale: 2 / 3, life: 0.24, frames: 4, flip: a.dir < 0 }); },
    hit() {},
  };

  // ── 철우 포화 (storm) ── 하늘로 쏜 P6 살이 올라갔다가 기사 둘레 고리에 E32 쇠뇌 살이 쏟아져 박힌다: 1칸 4개 · ★ 8개 · ★★ 8개 불덩이 · ★★★ 12개 + 금빛 별.
  //  산탄(k_split): 처음 맞은 자리에서 파편 살 둘이 좌우로 갈라진다
  SKILL_FX.sm_storm = {
    ...SKILL_FX.boltStorm,
    tick: undefined,
    cues: (a) => {
      const d = a.k.dur, m = a.mast || 0, t0 = Math.max(0.1, a.k.hits[0][0] * d - 0.3);
      return [[t0 / d, (a) => {
        const M = mz(a), n = [2, 3, 3, 4][m];
        for (let j = 0; j < n; j++) texShotFx('p6', M.x, M.y, M.x + a.dir * (20 + j * 18), -26, 0.24, 'raw', { scale: 2 / 3, delay: j * 0.03, flipY: false, ease: easeOut });
        smoke(M.x, M.y, { scale: 1 }); abMuzzleFlash(a, 1.2);
        for (let j = 0; j < 3; j++) abShell(a);
        impact({ stop: 0.04, shake: 0.2 });
      }]];
    },
    hit(a, i, n) {
      const m = a.mast || 0, N = [8, 12, 18, 28][m], split = own(a, 'sm_storm') && t7Sh(a, 'split'), orig = split ? n / 2 : n;
      if (i >= orig) return;
      const per = Math.ceil(N / orig), rad = 100 * (own(a, 'sm_storm') && t7Sh(a, 'pierce') ? 1.2 : 1), cx = Math.max(110, Math.min(W - 110, a.tx()));
      for (let q = 0; q < per; q++) {
        const idx = i * per + q;
        if (idx >= N) break;
        rain(cx + ((idx + 0.5) / N * 2 - 1) * rad + rand(-6, 6), q * 0.025, { boom: m >= 1 && (m >= 2 || idx % 2 === 0), gold: m >= 3, scale: m >= 2 ? 4 / 3 : 1 });
      }
    },
    hitTex(a, t, share, i, n) {
      const m = a.mast || 0, split = own(a, 'sm_storm') && t7Sh(a, 'split');
      texFx('k21', t.x, t.y + 6, 'raw', { scale: 2 / 3, life: 0.28, frames: m ? 4 : 3, delay: 0.1 });
      if (split && i >= n / 2) for (const s of [-1, 1]) texShotFx('p6', t.x, t.y - 4, t.x + s * 62, groundY() - 6, 0.2, 'raw', { scale: 2 / 3, arc: 22, flipY: s < 0, onLand: () => texFx('k22', t.x + s * 62, groundY() - 8, 'raw', { scale: 2 / 3, life: 0.25, frames: 4 }) });
    },
  };

  // ── 융합 ──
  // 연장 폭격: 다연장 사격(바탕 연출) 마지막 한 발이 거대한 폭탄 살(P6 2배/4/3배)로 포물선을 그리며 떨어져 터진다 (K21 + 버섯구름)
  const base1 = SKILL_FX.boltStorm;
  SKILL_FX.sm_f_ab = {
    ...base1,
    cues: (a) => {
      const d = a.k.dur, m = a.mast || 0, last = a.k.hits[a.k.hits.length - 1][0] * d, t0 = Math.max(0.1, last - 0.45);
      return [...base1.cues(a), [t0 / d, (a) => {
        const M = mz(a), x1 = a.tx();
        texShotFx('p6', M.x, M.y, x1, groundY() - 8, Math.max(0.2, last - t0 - 0.02), 'raw', { scale: m >= 3 ? 2 : 4 / 3, arc: 110, flipY: a.dir < 0, tail: 2 });
        smoke(M.x, M.y, { scale: 1 }); abMuzzleFlash(a, 1.4); impact({ stop: 0.05, shake: 0.3 });
      }]].sort((p, q) => p[0] - q[0]);
    },
    hit(a, i, n) {
      base1.hit(a, i, n);
      if (i !== n - 1) return;
      const m = a.mast || 0, x = Math.max(80, Math.min(W - 80, a.tx()));
      if (m >= 3) for (const s of [-1, 1]) { abBlastFx(x + s * 48, groundY() - 10, 1.2); ringFx(x + s * 48, SM_IRON, 1, 0.4); }
      ringFx(x, SM_IRON, 1.4, 0.5);
      abBlastFx(x, groundY() - 12, m >= 3 ? 2.6 : 2);
      if (m >= 2) for (const s of [-1, 1]) skFx(null, 0.14, 0, null, () => { abBlastFx(x + s * 60, groundY() - 10, 1.4); texFx('k37', x + s * 60, groundY() - 22, 'raw', { scale: 2 / 3, life: 0.4 }); });
      abMushroomFx(x, 1.0, m >= 2 ? 1 : 2 / 3);
      texFx('k37', x, groundY() - 22, 'raw', { scale: m >= 3 ? 4 / 3 : 1, life: 0.45 });
      if (m >= 3) texFx('k20', x, groundY() - 30, SM_GOLD, { scale: 4 / 3, life: 0.4 });
      impact({ stop: 0.14, shake: 0.55 });
    },
  };
  // 파성 포화: 파성 줄(파성 꿰뚫기 연출)이 지나간 줄에 불씨가 남아, 앞에서부터 K21 로 연달아 터지고 포연이 남는다 (★★★ 은 크게 + 끝에 버섯구름)
  SKILL_FX.sm_f_bk = {
    ...flashFx,
    cues: (a) => {
      const d = a.k.dur, m = a.mast || 0, p = plan(a), cs = flashFx.cues(a);
      cs.push([p.fire / d + 0.01, (a) => {
        const M = mz(a), y = M.y + 4;
        const nE = [4, 5, 7, 9][m], tx0 = Math.max(120, Math.min(W - 120, a.tx())), x0 = tx0 - a.dir * 40 * (nE - 1) / 2;
        for (let j = 1; j <= nE; j++) {
          const x = x0 + a.dir * (j - 1) * 40;
          if (x < 0 || x > W) continue;
          const dl = 0.06 + j * 0.05;
          if (m >= 3) ringFx(x, SM_IRON, 1, 0.4);
          texFx('k21', x, y - 4, 'raw', { scale: [1, 4 / 3, 4 / 3, 2][m], life: 0.5, delay: dl, frames: 5 });
          if (m >= 2) texFx('k37', x, y - 8, 'raw', { scale: m >= 3 ? 1 : 2 / 3, life: 0.4, delay: dl + 0.05 });
          smoke(x, y - 6, { delay: dl + 0.1, life: 0.6 });
          texFx('c16', x, y - 14, SM_GOLD, { scale: 1, life: 0.5, delay: dl + 0.15, move: (u) => [0, -10 * u] });
          if (m >= 3 && j === nE) skFx(null, dl, 0, null, () => abMushroomFx(x, 1.0, 2 / 3));
        }
      }]);
      return cs.sort((p, q) => p[0] - q[0]);
    },
    hitTex(a, t) { texFx('k22', t.x, t.y, 'raw', { scale: 2 / 3, life: 0.25, frames: 4 }); texFx('k21', t.x, t.y + 6, 'raw', { scale: 2 / 3, life: 0.3, frames: 4 }); },
  };
  // 회전 철우: 포대가 돌고(회전 포대 연출) 타격마다 하늘에서 쇠 소나기가 기사 둘레에 쏟아져 박힌다
  SKILL_FX.sm_f_ak = {
    ...whirlFx,
    hit(a, i) {
      turretShot(a, i);
      const m = a.mast || 0;
      for (let q = 0; q < 2 + m; q++) rain(a.x() + rand(-110, 110), 0.04 + q * 0.03, { boom: m >= 2, gold: m >= 3 });
    },
  };
})();
