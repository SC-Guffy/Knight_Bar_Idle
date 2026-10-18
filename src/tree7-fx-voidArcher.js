'use strict';
// 시즌7 스킬 빌드 트리 — 차원궁사 줄기 새 스킬·융합 연출 (docs/specs/skill-tree-all.md, 모델은 src/tree7-fx.js 검성 연출)
// 그림은 새로 뽑지 않고 지금 시트를 재사용한다 (VFX 규칙: 코드는 위치·크기·개수·궤적·타이밍·색 램프만). 색은 보랏빛 균열·별:
//  마탄 궤도 = C9 바닥 마법진 위로 P5 공허탄이 꼬리를 끌며 기사 둘레를 돌고, 한 발씩 곡선으로 적을 쫓는다 (바탕 유도 마탄의 등 뒤 마법진·곧은 쏘기와 다르게) ·
//  공간 절단 = F23 공허 찢김 띠가 줄을 따라 열렸다 닫히고 E45 흰 균열 줄이 속을 흐른다, 맞은 자리엔 F13 균열 (바탕은 K19 마탄 파열) ·
//  공허 화살 = P5 공허탄이 F13 균열 문으로 들어가 사라졌다가 적 앞 균열에서 튀어나온다 (공간 도약) · 유성 낙하 = 하늘의 F13 틈에서 E33 유성이 사방에 떨어져 K36 균열로 터진다 ·
//  융합 = 두 부모 연출 잇기 (성운 연격 = 별빛 화살비 + 마지막에 사방에서 모여드는 공허탄이 E28 성운으로 터짐, 단층 유성 = 찢긴 줄에 유성, 궤도 유성우 = 궤도 + 유성).
// 모습: a.mast 0~3 — 개수·크기가 단계마다 오르고 ★★★ 는 흰 별빛이 더해진다. 변형(shape)은 내 기사(owner 'hero')만 (t7Sh).
// 이 파일은 tree7-fx.js 뒤에 불러온다. 줄기 안에서만 쓰는 도구는 즉시 실행 함수 안에 둔다.

(function () {
  const VA_VIO = '#b070ff', VA_MAG = '#ff4dff', VA_PALE = '#e8c8ff', VA_STAR = '#ffffff';
  const mz = (a) => { const h = hand(a); return { x: h.x + a.dir * 8, y: h.y }; };
  const tg = (a, i) => a.targets(i)[0] || { x: a.tx(), y: a.ty() };
  const own = (a, id) => a.id === id;
  const orb = (x, y, rot, sc, al = 1) => vfxDraw(ctx, 'p5', 'raw', vfxLoopF('p5', 12), x, y, { rot, scale: sc, alpha: al });
  const rift = (x, y, sc = 2 / 3, delay = 0, o = {}) => texFx('f13', x, y, o.color || VA_VIO, { scale: sc, life: o.life || 0.5, delay, fade: 0.4, ...o.tex });
  // 유성 한 발 (E33, 불꼬리가 왼쪽 위 → 머리가 오른쪽 아래): 하늘에서 x1 로 떨어져 K36 균열 + H25 섬광으로 터진다
  function meteor(x1, delay = 0, sc = 2 / 3, o = {}) {
    const gy = groundY() - 4, x0 = x1 + (o.from != null ? o.from : (Math.random() < 0.5 ? -1 : 1) * rand(24, 56)), y0 = -20, rot = Math.atan2(gy - y0, x1 - x0) - Math.PI / 4;
    skFx(null, delay, 0.2, (u) => { const k = 0.5 * u + 0.5 * u * u; vfxDraw(ctx, 'e33', o.color || VA_VIO, vfxLoopF('e33', 14), mix(x0, x1, k), mix(y0, gy, k), { rot, scale: sc, alpha: 1 }); }, () => {
      texFx('k19', x1, gy - 8, VA_VIO, { scale: sc >= 1 ? 4 / 3 : 1, life: 0.35, fade: 0.4 });
      texFx('h25', x1, gy - 8, VA_MAG, { scale: sc >= 1 ? 1 : 2 / 3, life: 0.3 });
      if (o.star) texFx('k20', x1, gy - 14, VA_STAR, { scale: 2 / 3, life: 0.3 });
    });
  }
  const aimPose = (fireAt) => (u, a) => {
    const d = a.k.dur, t = u * d, f = fireAt(a);
    if (t < f - 0.05) { const k = easeOut(segU(t, 0, Math.max(0.1, f - 0.1))); return { pull: 10 * k, bowA: -0.25 * k, sy: 1 - 0.04 * k }; }
    const r = segU(t, f - 0.05, Math.min(d, f + 0.35));
    return { pull: 0, bowA: -0.25 * (1 - r), dx: -4 * Math.sin(Math.PI * Math.min(1, r * 1.6)) };
  };

  // ── 마탄 궤도 (whirl) ── 발밑 C9 마법진 위로 P5 공허탄이 꼬리를 끌며 기사 둘레를 돈다: 1칸 1발 · ★ 2발 · ★★ 3발 크게 · ★★★ 4발 + 흰 별빛.
  //  확장 궤도(a_grow): 2배 반경 · 한 단계 큰 구슬로 제자리 · 추적 궤도(a_follow): 궤도가 대상에게 날아가 붙는다. 맞힐 때마다 한 발이 곡선으로 적을 쫓아 간다
  function orbit(a) {
    const m = a.mast || 0, W_ = own(a, 'va_whirl'), grow = W_ && t7Sh(a, 'grow'), follow = W_ && t7Sh(a, 'follow');
    const n = [1, 2, 3, 5][m], life = a.k.dur, R = grow ? 58 : m >= 3 ? 42 : 30, sc = grow ? (m >= 3 ? 4 / 3 : 1) : m >= 2 ? 1 : 2 / 3;
    const cxAt = (t) => (follow ? mix(a.x(), a.tx() - a.dir * 26, easeOut(Math.min(1, t / 0.35))) : a.x());
    a.t7pos = (j, t) => { const ang = t * 3.4 + (j * Math.PI * 2) / n; return [cxAt(t) + Math.cos(ang) * R, groundY() - 32 + Math.sin(ang) * R * 0.45 + Math.sin(t * 5 + j) * 2, Math.atan2(Math.cos(ang) * 0.45, -Math.sin(ang))]; };
    a.t7sc = sc;
    aFx(a, 0, life, (u) => {
      const t = u * life, al = Math.min(1, t / 0.12, (life - t) / 0.15);
      vfxDraw(ctx, 'c9', VA_VIO, vfxLoopF('c9', 8), cxAt(t), groundY() + 2, { scale: grow || m >= 3 ? 2 : 1, alpha: 0.8 * al });
      for (let j = 0; j < n; j++) for (let k = 3; k >= 0; k--) { const [x, y, rot] = a.t7pos(j, t - k * 0.05); orb(x, y, rot, sc, al * (k ? 0.5 - k * 0.12 : 1)); }
    });
    if (m >= 3) for (let i = 0; i < 5; i++) texFx('c16', a.x() + rand(-30, 30), groundY() - rand(20, 60), VA_STAR, { scale: 1, life: 0.6, delay: i * 0.3 });
  }
  // 궤도 한 발이 휘어 적을 쫓는다 (곡선)
  function chaseShot(a, i, to) {
    if (!a.t7pos) return;
    const m = a.mast || 0, n = [1, 2, 3, 5][m], [x, y] = a.t7pos(i % n, a.u * a.k.dur), T = to || tg(a, i), cx = (x + T.x) / 2, cy = Math.min(y, T.y) - 26;
    skFx(null, 0, 0.18, (u) => {
      const q = (v) => [(1 - v) ** 2 * x + 2 * (1 - v) * v * cx + v * v * T.x, (1 - v) ** 2 * y + 2 * (1 - v) * v * cy + v * v * T.y];
      for (let k = 2; k >= 0; k--) { const v = Math.max(0, u - k * 0.06), [px, py] = q(v), [nx, ny] = q(Math.min(1, v + 0.03)); orb(px, py, Math.atan2(ny - py, nx - px), a.t7sc, k ? 0.5 - k * 0.15 : 1); }
    });
  }
  const whirlFx = {
    ...SKILL_FX.homingBolts,
    cues: () => [[0.01, orbit]],
    hit(a, i) { chaseShot(a, i); impact({ shake: 0.05 }); },
    hitTex(a, t, share, i, n) {
      const m = a.mast || 0;
      texFx('h25', t.x, t.y, VA_VIO, { scale: m >= 2 ? 4 / 3 : 1, life: 0.28, delay: 0.12 });
      if (i === n - 1) texFx('k19', t.x, t.y, VA_VIO, { scale: 4 / 3, life: 0.35, delay: 0.12 });
    },
  };
  SKILL_FX.va_whirl = whirlFx;

  // ── 공간 절단 (flash) ── 화살이 지나간 줄을 따라 F23 공허 찢김 띠가 화면 끝까지 열렸다가 닫힌다 (속을 E45 흰 균열 줄이 흐르고 선두에 P5 공허탄). 맞은 자리에 F13 균열이 열린다.
  //  ★ 부터 띠가 두꺼워지고 ★★★ 는 별빛 + 끝의 K36. 잔향 절단(b_after): 0.5초 뒤 반투명 줄 한 번 더 · 삼중 균열(b_triple): 위·가운데·아래 세 줄
  function tear(a, o = {}) {
    const M = mz(a), d = a.dir, y = M.y + (o.dy || 0), end = d > 0 ? W + 10 : -10, sc = o.scale || 2 / 3, dl = o.delay || 0, al = o.alpha == null ? 1 : o.alpha, col = o.color || VA_VIO;
    skFx(null, dl, 0.75, (u) => {
      const t = u * 0.75, reach = easeOut(Math.min(1, t / 0.16)), open = u < 0.25 ? easeOut(u / 0.25) : 1 - easeIn((u - 0.25) / 0.75), L = Math.abs(end - M.x) * reach;
      if (open < 0.04) return;
      vfxTileRun(ctx, 'f23', col, vfxLoopF('f23', 10), M.x, y, L, d, { scale: sc, sy: Math.max(0.1, open) * (o.thin ? 0.7 : 1), vary: false, overlap: 0, alpha: al * 0.95 });
      swLine(ctx, 'e45', VA_STAR, vfxLoopF('e45', 12), M.x, y, M.x + d * L, y, { scale: 2 / 3, alpha: al * open * 0.85 });
      if (reach < 1) orb(M.x + d * L, y, d > 0 ? 0 : Math.PI, 2 / 3, al);
    });
    if (!o.thin) for (let j = 0; j < 6; j++) texFx('c16', M.x + d * Math.abs(end - M.x) * (j + 1) / 7, y + rand(-8, 8), VA_PALE, { scale: 1, life: 0.5, delay: dl + 0.1 + j * 0.03, move: (v) => [0, -8 * v] });
  }
  const plan = (a) => {
    const hits = a.k.hits, n = hits.length, d = a.k.dur, f = own(a, 'va_flash'), tri = f && t7Sh(a, 'triple'), aft = f && t7Sh(a, 'after'), orig = tri ? n / 3 : aft ? n / 2 : n;
    return { fire: Math.max(0.15, hits[0][0] * d - 0.08), tri, aft, ghost: aft ? (hits[orig][0] - hits[0][0]) * d : 0 };
  };
  const flashFx = {
    ...SKILL_FX.homingBolts,
    pose: aimPose((a) => plan(a).fire),
    cues: (a) => {
      const p = plan(a), d = a.k.dur, m = a.mast || 0, sc = [2 / 3, 2 / 3, 1, 4 / 3][m];
      return [[p.fire / d, (a) => {
        if (p.tri) for (let j = 0; j < 3; j++) tear(a, { dy: (j - 1) * 16, scale: 2 / 3, delay: j * 0.04, thin: j !== 1 });
        else tear(a, { scale: sc });
        if (p.aft) tear(a, { scale: sc, delay: p.ghost, alpha: 0.55, color: '#7a5aa8', thin: true });
        const M = mz(a); texFx('h25', M.x + a.dir * 6, M.y, VA_MAG, { scale: 2 / 3, life: 0.25 });
        if (m >= 3) texFx('k20', M.x + a.dir * 12, M.y, VA_STAR, { scale: 1, life: 0.3 });
        impact({ stop: 0.08, shake: 0.28 });
      }]];
    },
    hitTex(a, t, share, i, n) {
      const m = a.mast || 0;
      if (own(a, 'va_flash') && t7Sh(a, 'triple') && i % 3) { texFx('h25', t.x, t.y, VA_VIO, { scale: 2 / 3, life: 0.25 }); return; }
      rift(t.x, t.y, 2 / 3, 0.04, { life: 0.5 });
      texFx('h25', t.x, t.y, VA_MAG, { scale: m >= 2 ? 4 / 3 : 1, life: 0.3, delay: 0.04 });
      if (m >= 3 && i === n - 1) texFx('k19', t.x, t.y, VA_VIO, { scale: 2, life: 0.4, delay: 0.08 });
    },
    hit(a, i, n) { if (i === n - 1) impact({ stop: 0.06, shake: 0.2 }); },
  };
  SKILL_FX.va_flash = flashFx;

  // ── 공허 화살 (wave) ── P5 공허탄이 기사 앞 F13 균열 문으로 빨려 들어가 사라졌다가, 적 앞 균열에서 튀어나와 꽂힌다: 1칸 1발 · ★ 3발 · ★★ 5발 · ★★★ 7발 + 흰 별빛.
  //  차원 관통(k_pierce)이면 적을 맞히고도 멈추지 않고 줄 끝까지 뚫고 나간다
  function volley(a) {
    const m = a.mast || 0, n = [1, 3, 5, 7][m], M = mz(a), d = a.dir, T = tg(a, 0), pierce = t7Sh(a, 'pierce');
    const xin = M.x + d * 44, xout = d > 0 ? Math.max(xin + 40, T.x - 56) : Math.min(xin - 40, T.x + 56), far = pierce ? d * 320 : 0;
    rift(xin, M.y, 2 / 3, 0, { life: 0.4 });
    rift(xout, T.y, 2 / 3, 0.07, { life: 0.5 });
    for (let j = 0; j < n; j++) {
      const f = n > 1 ? j / (n - 1) - 0.5 : 0, dl = j * 0.035, y0 = M.y + f * 4, yo = T.y + f * 14, xe = pierce ? xout + far : T.x, ye = T.y + f * 26;
      skFx(null, dl, 0.36, (u) => {
        const t = u * 0.36, rot = d > 0 ? 0 : Math.PI;
        if (t < 0.08) { const k = t / 0.08; orb(mix(M.x, xin, k), y0, rot, 2 / 3, 1 - 0.7 * k * k); }
        else if (t >= 0.16) { const k = Math.min(1, (t - 0.16) / 0.12), x = mix(xout, xe, k), y = mix(yo, ye, k); for (let q = 2; q >= 0; q--) orb(mix(xout, xe, Math.max(0, k - q * 0.1)), mix(yo, ye, Math.max(0, k - q * 0.1)), Math.atan2(ye - yo, xe - xout), 2 / 3, q ? 0.5 - q * 0.15 : 1); }
      });
      texFx('h25', pierce ? mix(xout, xe, 0.6) : xe, ye, VA_MAG, { scale: 2 / 3, life: 0.28, delay: dl + 0.28 });
      if (m >= 3) texFx('k20', xe, ye - 8, VA_STAR, { scale: 2 / 3, life: 0.3, delay: dl + 0.3 });
    }
    impact({ shake: 0.1 });
  }
  SKILL_FX.va_wave = {
    ...SKILL_FX.homingBolts,
    pose: aimPose((a) => Math.max(0.15, a.k.hits[0][0] * a.k.dur - 0.1)),
    cues: (a) => [[Math.max(0.15, a.k.hits[0][0] * a.k.dur - 0.3) / a.k.dur, volley]],
    hitTex(a, t) { texFx('k19', t.x, t.y, VA_VIO, { scale: 2 / 3, life: 0.26, frames: 4 }); },
    hit() {},
  };

  // ── 유성 낙하 (storm) ── 하늘에 F13 균열이 가로로 열리고, 거기서 E33 유성이 기사 둘레 고리로 떨어져 K36 균열로 터진다: 1칸 4개 · ★ 8개 · ★★ 8개 크게 · ★★★ 12개 + 흰 별.
  //  유성 분열(k_split): 처음 맞은 자리에서 작은 유성 둘이 좌우로 튀어 떨어진다
  SKILL_FX.va_storm = {
    ...SKILL_FX.starfall,
    cues: (a) => {
      const d = a.k.dur, m = a.mast || 0, t0 = 0.2 * d;
      return [[0.2, (a) => {
        const M = mz(a), x = a.x();
        texShotFx('p5', M.x, M.y - 6, x, 14, 0.2, 'raw', { scale: 2 / 3, tail: 2 });
        aFx(a, 0.2, d - t0 - 0.25, (u) => vfxDraw(ctx, 'f13', VA_VIO, vfxLoopF('f13', 10), x, 18, { scale: m >= 2 ? 1 : 2 / 3, rot: Math.PI / 2, alpha: Math.min(1, u * 6, (1 - u) * 5) }));
      }]];
    },
    hit(a, i, n) {
      const m = a.mast || 0, N = [4, 8, 10, 16][m], st = own(a, 'va_storm'), split = st && t7Sh(a, 'split'), orig = split ? n / 2 : n;
      if (i >= orig) return;
      const per = Math.ceil(N / orig), rad = 120 * (st && t7Sh(a, 'pierce') ? 1.2 : 1), cx = a.x();
      for (let q = 0; q < per; q++) {
        const idx = i * per + q;
        if (idx >= N) break;
        const ang = (idx / N) * Math.PI * 2 + (a.dir > 0 ? 0 : Math.PI);
        meteor(cx + Math.cos(ang) * rad * (0.55 + 0.45 * Math.abs(Math.sin(ang * 2))), q * 0.025, m >= 2 ? 1 : 2 / 3, { star: m >= 3 });
      }
      impact({ shake: 0.06 });
    },
    hitTex(a, t, share, i, n) {
      const m = a.mast || 0, split = own(a, 'va_storm') && t7Sh(a, 'split');
      texFx('h25', t.x, t.y, VA_VIO, { scale: m >= 2 ? 1 : 2 / 3, life: 0.28, delay: 0.15 });
      if (split && i >= n / 2) for (const s of [-1, 1]) meteor(t.x + s * 60, 0.02, 2 / 3, { from: -s * 34 });
    },
  };

  // ── 융합 ──
  // 성운 연격: 별빛 화살비(바탕 연출) 마지막 타 직전, 사방에서 P5 공허탄이 대상 위 한 점으로 모여들어 E28 성운이 열리고 K36 으로 터진다
  const base1 = SKILL_FX.starfall;
  SKILL_FX.va_f_ab = {
    ...base1,
    cues: (a) => {
      const d = a.k.dur, last = a.k.hits[a.k.hits.length - 1][0] * d, t0 = Math.max(0.1, last - 0.3);
      return [...base1.cues(a), [t0 / d, (a) => {
        const m = a.mast || 0, n = [4, 6, 10, 14][m], x = a.tx(), y = a.ty() - 14;
        for (let j = 0; j < n; j++) {
          const ang = (j / n) * Math.PI * 2, x0 = x + Math.cos(ang) * 95, y0 = y + Math.sin(ang) * 55;
          texShotFx('p5', x0, y0, x, y, Math.max(0.15, last - t0 - 0.02), 'raw', { scale: m >= 2 ? 1 : 2 / 3, tail: 3, ease: easeIn, delay: j * 0.01 });
        }
      }]].sort((p, q) => p[0] - q[0]);
    },
    hit(a, i, n) {
      base1.hit(a, i, n);
      if (i !== n - 1) return;
      const m = a.mast || 0, x = a.tx(), y = a.ty() - 14;
      aFx(a, 0, 0.45, (u) => vfxDraw(ctx, 'e28', VA_VIO, vfxLoopF('e28', 12), x, y, { scale: m >= 3 ? 4 / 3 : m >= 2 ? 1 : 2 / 3, alpha: u < 0.7 ? 1 : (1 - u) / 0.3 }));
      texFx('k19', x, y, VA_VIO, { scale: m >= 3 ? 2 : 4 / 3, life: 0.5, fade: 0.4 });
      texFx('h25', x, y, VA_MAG, { scale: 4 / 3, life: 0.35 });
      if (m >= 3) texFx('k20', x, y - 6, VA_STAR, { scale: 4 / 3, life: 0.45 });
      impact({ stop: 0.14, shake: 0.45 });
    },
  };
  // 단층 유성: 공간이 찢긴 줄(공간 절단 연출)을 따라 하늘에서 유성이 앞에서부터 차례로 떨어져 터진다 (★★★ 은 크게 + 별)
  SKILL_FX.va_f_bk = {
    ...flashFx,
    cues: (a) => {
      const d = a.k.dur, m = a.mast || 0, p = plan(a), cs = flashFx.cues(a);
      cs.push([p.fire / d + 0.01, (a) => {
        const M = mz(a);
        for (let j = 1; j <= 6; j++) {
          const x = M.x + a.dir * (36 + j * 58);
          if (x < 0 || x > W) break;
          meteor(x, 0.14 + j * 0.07, m >= 3 ? 4 / 3 : 2 / 3, { star: m >= 3 });
        }
      }]);
      return cs.sort((p, q) => p[0] - q[0]);
    },
    hitTex(a, t) { rift(t.x, t.y, 2 / 3, 0.04, { life: 0.45 }); texFx('h25', t.x, t.y, VA_MAG, { scale: 1, life: 0.28, delay: 0.04 }); },
  };
  // 궤도 유성우: 마탄 궤도(바탕 연출)가 돌며 타격마다 궤도의 공허탄이 하늘로 솟았다가 유성이 되어 기사 둘레에 떨어진다
  SKILL_FX.va_f_ak = {
    ...whirlFx,
    hit(a, i) {
      if (!a.t7pos) return;
      const m = a.mast || 0, n = [1, 2, 3, 5][m], [x, y] = a.t7pos(i % n, a.u * a.k.dur);
      texShotFx('p5', x, y, x, -14, 0.14, 'raw', { scale: a.t7sc, tail: 1, ease: easeOut });
      for (let q = 0; q < 2 + m * 2; q++) meteor(a.x() + rand(-110, 110), 0.1 + q * 0.03, m >= 2 ? 1 : 2 / 3, { star: m >= 3 });
      impact({ shake: 0.06 });
    },
  };
})();
