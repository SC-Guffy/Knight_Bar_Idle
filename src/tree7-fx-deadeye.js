'use strict';
// 시즌7 스킬 빌드 트리 — 신궁 줄기 새 스킬·융합 연출 (docs/specs/skill-tree-all.md, 모델은 src/tree7-fx.js 검성 연출)
// 그림은 새로 뽑지 않고 지금 시트를 재사용한다 (VFX 규칙: 코드는 위치·크기·개수·궤적·타이밍·색 램프만). 색은 태양 금빛·흰 광선:
//  관통 선회 = P3 태양 화살이 기사 둘레 궤도를 돌며 꼬리(잔상)를 끌고, 한 발씩 떨어져 나가 적을 꿰뚫는다 (바탕 철갑 관통탄의 한 줄 빔과 다르게) ·
//  일섬 저격 = 숨 고르는 동안 E11 조준 줄이 화면 끝까지 → 쏘면 F30 흰 금빛 굵은 줄 + P3 머리가 화면 끝까지, 맞은 자리에 K35 홍염 (바탕 헤드샷의 조준경·K17 과 다르게) ·
//  추격탄 = P3 태양 화살이 휘어 쫓는 곡선으로 날아가 H24 섬광 · 광휘 화살비 = H24 작은 태양이 하늘에 떠올라 P3 광선이 사방 고리로 뻗는다 (K20 별 착지) ·
//  융합 = 두 부모 연출 잇기 (연환 저격 = 관통탄 + 마지막에 조준경·흰 줄 급소 저격, 광휘 일발 = 저격 줄 + 줄에 남는 H24 빛, 선회 화살비 = 선회탄 + 빛 화살 흩뿌리기).
// 모습: a.mast 0~3 — 개수·크기가 단계마다 오르고 ★★★ 는 금빛 + 홍염이 더해진다. 변형(shape)은 내 기사(owner 'hero')만 (t7Sh).
// 이 파일은 tree7-fx.js 뒤에 불러온다. 줄기 안에서만 쓰는 도구는 즉시 실행 함수 안에 둔다.

(function () {
  const DE_SUN = '#ffd24a', DE_WHITE = '#fff6d0', DE_GOLD = '#fff0b8';
  const mz = (a) => { const h = hand(a); return { x: h.x + a.dir * 8, y: h.y }; };
  const tg = (a, i) => a.targets(i)[0] || { x: a.tx(), y: a.ty() };
  const own = (a, id) => a.id === id;
  const arrow = (x, y, rot, sc, al = 1) => vfxDraw(ctx, 'p3', 'raw', vfxLoopF('p3', 14), x, y, { rot, scale: sc, alpha: al });
  // 태양 빛 한 점 (H24: 작은 태양 섬광 + 홍염 고리)
  const flare = (x, y, sc = 2 / 3, delay = 0) => texFx('h24', x, y, 'raw', { scale: sc, life: 0.3, delay, fade: 0.3 });
  // 하늘에서 사방으로 뻗는 빛 화살 한 발: (sx, sy) → (x1, y1), 닿으면 K20 별 + H24 섬광
  function ray(sx, sy, x1, y1, delay, sc, gold) {
    texShotFx('p3', sx, sy, x1, y1, 0.13, 'raw', { scale: sc, delay, tail: 2, ease: easeIn, onLand: () => { texFx('k20', x1, y1 - 4, gold ? DE_GOLD : DE_SUN, { scale: 2 / 3, life: 0.3 }); flare(x1, y1 - 4, 2 / 3); } });
  }
  // 궁수 자세: 숨을 고르며 몸을 낮추고 시위를 당겼다가 (fire 초) 쏜 뒤 반동
  const aimPose = (fireAt) => (u, a) => {
    const d = a.k.dur, t = u * d, f = fireAt(a);
    if (t < f - 0.05) { const k = easeOut(segU(t, 0, Math.max(0.1, f - 0.1))); return { sy: 1 - 0.14 * k, dx: -2 * k, pull: 11 * k }; }
    if (t < f + 0.12) { const r = easeOut(segU(t, f - 0.05, f + 0.05)); return { sy: 0.86, dx: -2 - 6 * r, pull: 0 }; }
    const r = segU(t, f + 0.12, d);
    return { sy: mix(0.86, 1, r), dx: -8 * (1 - r), pull: 0 };
  };

  // ── 관통 선회 (whirl) ── P3 태양 화살이 기사 둘레 궤도를 돈다 (꼬리 잔상 셋): 1칸 1발 · ★ 2발 · ★★ 크게 · ★★★ 3발 + 금빛 고리.
  //  정지 궤도(a_grow): 2배 반경 · 한 단계 큰 화살로 제자리 · 추적 선회(a_follow): 궤도가 대상에게 날아가 붙는다. 맞힐 때마다 한 발이 궤도에서 튀어나가 적을 꿰뚫는다
  function orbit(a) {
    const m = a.mast || 0, W_ = own(a, 'de_whirl'), grow = W_ && t7Sh(a, 'grow'), follow = W_ && t7Sh(a, 'follow');
    const n = [1, 2, 2, 3][m], life = a.k.dur, R = grow ? 58 : 32, sc = grow ? (m >= 3 ? 4 / 3 : 1) : m >= 2 ? 1 : 2 / 3;
    const cxAt = (t) => (follow ? mix(a.x(), a.tx() - a.dir * 26, easeOut(Math.min(1, t / 0.35))) : a.x());
    a.t7pos = (j, t) => { const ang = t * 4.2 + (j * Math.PI * 2) / n; return [cxAt(t) + Math.cos(ang) * R, groundY() - 30 + Math.sin(ang) * R * 0.5, Math.atan2(Math.cos(ang) * 0.5, -Math.sin(ang))]; };
    a.t7sc = sc;
    aFx(a, 0, life, (u) => {
      const t = u * life, al = Math.min(1, t / 0.12, (life - t) / 0.15);
      vfxDraw(ctx, 'c18', m >= 3 ? DE_GOLD : DE_SUN, vfxLoopF('c18', 10), cxAt(t), groundY() + 3, { scale: grow ? 2 : 1, alpha: 0.6 * al });
      for (let j = 0; j < n; j++) for (let k = 3; k >= 0; k--) { const [x, y, rot] = a.t7pos(j, t - k * 0.045); arrow(x, y, rot, sc, al * (k ? 0.5 - k * 0.12 : 1)); }
    });
  }
  const whirlFx = {
    ...SKILL_FX.armorPiercer,
    pose: (u, a) => { const t = u * a.k.dur; return { pull: 6 + 4 * Math.sin(t * 12), bowA: -0.4 + 0.2 * Math.sin(t * 6), skew: -0.05 }; },
    tick: undefined,
    cues: () => [[0.01, orbit]],
    hit(a, i) {
      if (!a.t7pos) return;
      const m = a.mast || 0, n = [1, 2, 2, 3][m], [x, y] = a.t7pos(i % n, a.u * a.k.dur), T = tg(a, i), d = T.x >= x ? 1 : -1;
      texShotFx('p3', x, y, T.x + d * 70, T.y, 0.1, 'raw', { scale: a.t7sc, tail: 2 });
      impact({ shake: 0.06 });
    },
    hitTex(a, t) { const m = a.mast || 0; flare(t.x, t.y, m >= 2 ? 1 : 2 / 3); if (m >= 1) texFx('k20', t.x, t.y - 6, m >= 3 ? DE_GOLD : DE_SUN, { scale: 2 / 3, life: 0.3, delay: 0.05 }); },
  };
  SKILL_FX.de_whirl = whirlFx;

  // ── 일섬 저격 (flash) ── 숨을 멈추는 동안 E11 조준 줄이 화면 끝까지 희미하게 걸리고, 쏘면 F30 굵은 흰 금빛 줄 + P3 머리가 화면 끝까지 달린다.
  //  맞은 자리에 K35 홍염. ★ 부터 굵어지고 ★★★ 는 금빛 + 줄 끝 섬광. 잔상 사격(b_after): 0.5초 뒤 반투명 줄 한 번 더 · 삼점 사격(b_triple): 위·가운데·아래 세 줄
  function beam(a, o = {}) {
    const M = mz(a), d = a.dir, y = M.y + (o.dy || 0), end = d > 0 ? W + 30 : -30, sc = o.scale || 1, dl = o.delay || 0, al = o.alpha == null ? 1 : o.alpha, col = o.color || DE_WHITE;
    skFx(null, dl, 0.45, (u) => {
      const t = u * 0.45, fly = easeOut(Math.min(1, t / 0.12)), hx = mix(M.x, end, fly), out = t < 0.14 ? 1 : 1 - (t - 0.14) / 0.31;
      swLine(ctx, 'f30', col, 0, M.x, y, hx, y, { scale: sc * 2 / 3, sy: 0.3 + 0.7 * out, alpha: al * Math.min(1, out * 1.5) });
      swLine(ctx, 'f30', DE_SUN, 0, M.x, y, hx, y, { scale: sc * 2 / 3, sy: (0.3 + 0.7 * out) * 1.8, alpha: al * 0.35 * out });
      if (fly < 1 || t < 0.2) arrow(hx, y, d > 0 ? 0 : Math.PI, sc >= 1 ? 1 : 2 / 3, al * (fly >= 1 ? Math.max(0, 1 - (t - 0.12) / 0.08) : 1));
    });
    if (!o.small) for (let j = 0; j < 6; j++) { const p = (j + 1) / 7; texFx('c16', M.x + d * Math.abs(end - M.x) * p, y + rand(-6, 6), DE_GOLD, { scale: 1, life: 0.4, delay: dl + 0.12 * (1 - Math.cbrt(1 - p)), move: (v) => [0, -8 * v] }); }
  }
  const plan = (a) => {
    const hits = a.k.hits, n = hits.length, d = a.k.dur, f = own(a, 'de_flash'), tri = f && t7Sh(a, 'triple'), aft = f && t7Sh(a, 'after'), orig = tri ? n / 3 : aft ? n / 2 : n;
    return { fire: Math.max(0.15, hits[0][0] * d - 0.06), tri, aft, ghost: aft ? (hits[orig][0] - hits[0][0]) * d : 0 };
  };
  const flashFx = {
    ...SKILL_FX.headshot,
    pose: aimPose((a) => plan(a).fire),
    cues: (a) => {
      const p = plan(a), d = a.k.dur, m = a.mast || 0, sc = [2 / 3, 1, 1, 4 / 3][m];
      return [
        // 숨 고르기: 대상 높이에 조준 줄이 화면 끝까지 걸린다 (깜박임)
        [0.04 / d, (a) => aFx(a, 0, Math.max(0.1, p.fire - 0.04), (u) => {
          const M = mz(a), y = a.ty() - 6, end = a.dir > 0 ? W : 0, grow = easeOut(Math.min(1, u * 3));
          swLine(ctx, 'e11', DE_SUN, 3, M.x, y, mix(M.x, end, grow), y, { scale: 2 / 3, alpha: 0.35 + 0.25 * Math.sin(clock * 30) * (u > 0.7 ? 1 : 0.3) });
          texFx('c16', M.x + a.dir * 6, M.y - 2, DE_GOLD, { scale: 1, life: 0.1 });
        })],
        [p.fire / d, (a) => {
          if (p.tri) for (let j = 0; j < 3; j++) beam(a, { dy: (j - 1) * 14, scale: 2 / 3, delay: j * 0.04, small: j !== 1 });
          else beam(a, { scale: sc });
          if (p.aft) beam(a, { scale: sc, delay: p.ghost, alpha: 0.55, color: '#d8c9a0', small: true });
          const M = mz(a); burst(M.x, M.y, 8, [DE_WHITE, DE_SUN], 80, 2, 0); flare(M.x + a.dir * 8, M.y, 2 / 3);
          if (m >= 3) texFx('k20', M.x + a.dir * 12, M.y, DE_GOLD, { scale: 1, life: 0.3 });
          impact({ stop: 0.1, shake: 0.3 });
        }],
      ];
    },
    hitTex(a, t, share, i) {
      const m = a.mast || 0;
      if (own(a, 'de_flash') && t7Sh(a, 'triple') && i % 3) { flare(t.x, t.y, 2 / 3); return; }
      texFx('k35', t.x, t.y, 'raw', { scale: m >= 2 ? 1 : 2 / 3, life: 0.35 });
      if (m >= 3) texFx('k20', t.x, t.y - 10, DE_GOLD, { scale: 4 / 3, life: 0.4, delay: 0.05 });
    },
    hit(a, i, n) { if (i === n - 1) impact({ stop: 0.1, shake: 0.2 }); },
  };
  SKILL_FX.de_flash = flashFx;

  // ── 추격탄 (wave) ── P3 태양 화살이 휘어 쫓는 곡선으로 날아가 H24 섬광: 1칸 1발 · ★ 3발 · ★★ 5발 · ★★★ 7발 금빛.
  //  화살마다 위·아래로 번갈아 휘어(곡선 크기 달라서 부채꼴) 대상에게 모인다. 관통 강화(k_pierce)면 닿고도 멈추지 않고 줄 끝까지 뚫고 나간다
  function chase(a) {
    const m = a.mast || 0, n = [1, 3, 5, 7][m], M = mz(a), d = a.dir, T = tg(a, 0), pierce = t7Sh(a, 'pierce'), sc = m >= 2 ? 1 : 2 / 3;
    for (let j = 0; j < n; j++) {
      const f = n > 1 ? j / (n - 1) - 0.5 : 0, side = j % 2 ? -1 : 1, bend = (n > 1 ? 14 + 10 * Math.abs(f) * 4 : 0) * side;
      const ex = pierce ? M.x + d * Math.max(Math.abs(T.x - M.x) + 170, 300) : T.x, ey = T.y + f * 16, cx = (M.x + ex) / 2, cy = (M.y + ey) / 2 - bend, life = 0.16 + Math.abs(ex - M.x) / 1500;
      const pos = (u) => [(1 - u) ** 2 * M.x + 2 * (1 - u) * u * cx + u * u * ex, (1 - u) ** 2 * M.y + 2 * (1 - u) * u * cy + u * u * ey];
      skFx(null, j * 0.035, life, (u) => {
        for (let k = 3; k >= 0; k--) { const v = Math.max(0, u - k * 0.05), [x, y] = pos(v), [x2, y2] = pos(Math.min(1, v + 0.03)); arrow(x, y, Math.atan2(y2 - y, x2 - x), sc, k ? 0.5 - k * 0.12 : 1); }
      }, () => { flare(ex, ey, 2 / 3); if (m >= 3) texFx('k20', ex, ey - 6, DE_GOLD, { scale: 2 / 3, life: 0.3 }); });
    }
    const h = mz(a); burst(h.x, h.y, 4 + m * 2, [DE_WHITE, DE_SUN], 70, 2, 0);
    impact({ shake: 0.1 });
  }
  SKILL_FX.de_wave = {
    ...SKILL_FX.armorPiercer,
    pose: aimPose((a) => Math.max(0.15, a.k.hits[0][0] * a.k.dur - 0.1)),
    tick: undefined,
    cues: (a) => [[Math.max(0.15, a.k.hits[0][0] * a.k.dur - 0.14) / a.k.dur, chase]],
    hitTex(a, t) { texFx('k20', t.x, t.y, DE_SUN, { scale: 2 / 3, life: 0.28, frames: 4 }); },
    hit() {},
  };

  // ── 광휘 화살비 (storm) ── 하늘에 H24 작은 태양이 떠올라 커지고, 터지듯 P3 광선이 기사 둘레 고리로 사방에 뻗는다: 1칸 4줄기 · ★ 8줄기 · ★★ 8줄기 크게 · ★★★ 12줄기 + 금빛.
  //  분광(k_split): 처음 맞은 자리에서 빛 화살 둘이 좌우로 갈라진다
  function sun(a) {
    const m = a.mast || 0, d = a.k.dur, T0 = a.k.hits[0][0] * d, x = a.x(), y = 30;
    aFx(a, 0, d, (u) => {
      const t = u * d, k = easeOut(Math.min(1, t / T0)), al = Math.min(1, t / 0.25, (d - t) / 0.3);
      const sc = k < 0.4 ? 2 / 3 : k < 0.85 ? 1 : m >= 3 ? 2 : 4 / 3;
      vfxDraw(ctx, 'h24', 'raw', Math.floor(clock * 9) % 2, x, y, { scale: sc, alpha: al });
      if (m >= 2) vfxDraw(ctx, 'h24', 'raw', (Math.floor(clock * 9) + 1) % 2, x, y, { scale: sc, rot: clock * 1.5, alpha: al * 0.4 });
    }, null, (u) => { if (Math.random() < 0.5) gatherFx(x, y, [DE_SUN, '#ffffff'], 1, 30); });
  }
  SKILL_FX.de_storm = {
    ...SKILL_FX.starfall,
    cues: (a) => {
      const d = a.k.dur;
      return [[0.01, sun], [0.1 / d, (a) => { const M = mz(a); texShotFx('p3', M.x, M.y - 6, a.x(), 30, 0.22, 'raw', { scale: 2 / 3, tail: 2 }); burst(M.x, M.y, 6, [DE_WHITE, DE_SUN], 70, 2, 0); }]];
    },
    hit(a, i, n) {
      const m = a.mast || 0, N = [4, 8, 8, 12][m], st = own(a, 'de_storm'), split = st && t7Sh(a, 'split'), orig = split ? n / 2 : n;
      if (i >= orig) return;
      const per = Math.ceil(N / orig), rad = 120 * (st && t7Sh(a, 'pierce') ? 1.2 : 1), cx = a.x(), sx = cx, sy = 32;
      for (let q = 0; q < per; q++) {
        const idx = i * per + q;
        if (idx >= N) break;
        const ang = (idx / N) * Math.PI * 2 + (a.dir > 0 ? 0 : Math.PI);
        ray(sx, sy, cx + Math.cos(ang) * rad * (0.55 + 0.45 * Math.abs(Math.sin(ang * 2))), groundY() - 4 + Math.sin(ang) * 5, q * 0.02, m >= 2 ? 1 : 2 / 3, m >= 3);
      }
      impact({ shake: 0.06 });
    },
    hitTex(a, t, share, i, n) {
      const m = a.mast || 0, split = own(a, 'de_storm') && t7Sh(a, 'split');
      flare(t.x, t.y, m >= 2 ? 1 : 2 / 3);
      if (m >= 3 && i === n - 1) texFx('k35', t.x, t.y, 'raw', { scale: 2 / 3, life: 0.4 });
      if (split && i >= n / 2) for (const s of [-1, 1]) ray(t.x, t.y - 8, t.x + s * 60, groundY() - 6, 0, 2 / 3, false);
    },
  };

  // ── 융합 ──
  // 연환 저격: 철갑 관통탄(바탕 연출) 마지막 타 직전에 조준경(E25)이 대상 급소에 걸려 좁혀지고, 흰 금빛 줄(F30)이 급소를 꿰뚫어 화면 끝까지 — 급소 저격!
  const base1 = SKILL_FX.armorPiercer;
  SKILL_FX.de_f_ab = {
    ...base1,
    cues: (a) => {
      const d = a.k.dur, m = a.mast || 0, last = a.k.hits[a.k.hits.length - 1][0] * d, t0 = Math.max(0.1, last - 0.3);
      return [...base1.cues(a), [t0 / d, (a) => aFx(a, 0, last - t0 + 0.05, (u) => {
        const x = a.tx(), y = a.ty() - 8;
        vfxDraw(ctx, 'e25', DE_SUN, 0, x, y, { scale: u < 0.5 ? 1 : 2 / 3, alpha: Math.min(1, u * 5) * 0.9 });
        if (Math.sin(clock * 30) > 0) texFx('c16', x, y, '#ff5a4a', { scale: 2 / 3, life: 0.06 });
      })]].sort((p, q) => p[0] - q[0]);
    },
    hit(a, i, n) {
      base1.hit(a, i, n);
      if (i !== n - 1) return;
      const m = a.mast || 0, T = tg(a, i);
      beam(a, { dy: T.y - mz(a).y - 8, scale: m >= 3 ? 1 : 2 / 3 });
      texFx('k17', T.x, T.y - 8, DE_WHITE, { scale: m >= 3 ? 4 / 3 : 1, life: 0.4 });
      addFloater('급소 저격!', T.x, (T.top || T.y - 20) - 22, DE_SUN, 13);
      impact({ stop: 0.14, shake: 0.4 });
    },
  };
  // 광휘 일발: 저격 줄(일섬 저격 연출)이 지나간 줄에 H24 빛이 남아 앞에서부터 차례로 터진다 (★★★ 은 K35 홍염이 끝에)
  SKILL_FX.de_f_bk = {
    ...flashFx,
    cues: (a) => {
      const d = a.k.dur, m = a.mast || 0, p = plan(a), cs = flashFx.cues(a);
      cs.push([p.fire / d + 0.01, (a) => {
        const M = mz(a), y = M.y + 2;
        for (let j = 1; j <= 7; j++) {
          const x = M.x + a.dir * (30 + j * 52);
          if (x < 0 || x > W) break;
          const dl = 0.12 + j * 0.06;
          flare(x, y, m >= 2 ? 1 : 2 / 3, dl);
          texFx('c16', x, y - 12, DE_GOLD, { scale: 1, life: 0.5, delay: dl + 0.1, move: (u) => [0, -10 * u] });
          if (m >= 3 && j === 7) texFx('k35', x, y, 'raw', { scale: 2 / 3, life: 0.4, delay: dl });
        }
      }]);
      return cs.sort((p, q) => p[0] - q[0]);
    },
    hitTex(a, t) { flare(t.x, t.y, 2 / 3); texFx('k20', t.x, t.y - 6, DE_SUN, { scale: 2 / 3, life: 0.3 }); },
  };
  // 선회 화살비: 선회탄(관통 선회 연출)이 돌며 타격마다 궤도에서 빛 화살을 기사 둘레로 흩뿌린다 (K20 별 착지)
  SKILL_FX.de_f_ak = {
    ...whirlFx,
    hit(a, i) {
      if (!a.t7pos) return;
      const m = a.mast || 0, n = [1, 2, 2, 3][m], [x, y] = a.t7pos(i % n, a.u * a.k.dur);
      for (let q = 0; q < 2 + m; q++) ray(x, y, a.x() + rand(-110, 110), groundY() - 4 + rand(-3, 3), q * 0.03, a.t7sc, m >= 3);
      impact({ shake: 0.06 });
    },
  };
})();
