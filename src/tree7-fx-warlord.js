'use strict';
// 시즌7 스킬 빌드 트리 — 전쟁군주 줄기 새 스킬·융합 7종의 연출 (바탕 연출 대신 따로 짠 것, docs/specs/skill-tree-all.md)
// 그림은 새로 뽑지 않고 지금 시트만 다시 짠다 (VFX 규칙: 코드는 위치·크기·개수·궤적·타이밍·색 램프만). 강철 도끼창 호 + 땅·용암이 주제 (바탕의 흙 회오리·도끼날 고리는 쓰지 않는다):
//  전부 회전 = W6A 도끼창 날이 기사 둘레를 철의 바퀴로 돈다 · 지열참 = E14 고랑 + F22 용암 불길 띠 + K09 강철 불꽃 + E22 용암 간헐천이 화면 끝까지 ·
//  투척 도끼창 = W6A 도끼날이 빙글빙글 돌며 날아간다(잔상 둘) · 전장 폭풍 = C3 충격 고리 + E21 바위판이 좌우로 줄지어 솟고 W6 강철 호가 위로 ·
//  회전 분쇄 = 도끼 바퀴가 돌다가 마지막 타에 C8 균열 + E21 + E22 · 열진 투척 = C8 균열 틈마다 도끼날이 떨어져 꽂히고 E22 로 터진다 ·
//  철폭풍 = W6 도끼 바퀴가 세로로 돌며 타격마다 W6A 파편을 사방으로.
// 모습: a.mast 0~3 — 개수·크기·금빛이 오른다. 변형 모양(shape)은 내 기사만 (t7Sh). 이 파일은 src/tree7-fx.js 뒤에 불러온다.

(function () {
  const STEEL = '#cfd8e4', LAVA = '#ff7a2a', EARTH = '#c9b38a', RED = '#c8402a';
  const tone = (a, c) => { const m = a.mast || 0; return m >= 3 ? mixHex(c, MASTERY_GOLD, 0.45) : m < 2 ? mixHex(c, MASTERY_FADE[0], MASTERY_FADE[1 + m]) : c; };
  const T1 = (a) => a.k.hits[0][0] * a.k.dur, TL = (a) => a.k.hits[a.k.hits.length - 1][0] * a.k.dur;
  const farD = (a) => Math.max(90, a.dir > 0 ? W - 24 - a.x() : a.x() - 24);
  const dust = (x, delay = 0, sc = 2 / 3) => texFx('c6', x + rand(-6, 6), groundY() - 2, EARTH, { scale: sc, life: 0.5, delay, fade: 0.5, anchor: 'b' });
  const geyser = (x, delay, sc) => texFx('e22', x, groundY() + 3, LAVA, { anchor: 'b', scale: sc, life: 0.5, delay, fade: 0.3 });
  // 내려찍기 자세: 도끼창을 머리 위로 들어 떨림(hold) → T 에 찍는다 → 돌아온다
  function chopPose(t, d, T, lunge) {
    const t0 = Math.max(0.05, T - 0.22);
    if (t < t0) { const c = easeOut(t / t0); return { sy: 1 - 0.1 * c, wa: mix(-1.35, -2.6, c), skew: -0.15 * c, lift: 6 * c }; }
    if (t < T) { const s = easeIn(segU(t, t0, T)); return { wa: mix(-2.6, 1.1, s), skew: mix(-0.15, 0.35, s), lift: 6 * (1 - s), dx: lunge * s, sy: mix(0.96, 0.88, s) }; }
    const hold = Math.min(d - 0.1, T + 0.25);
    if (t < hold) return { wa: 1.1, sy: 0.88, skew: 0.35, dx: lunge };
    const r = easeOut(segU(t, hold, d)); return { wa: mix(1.1, -1.35, r), sy: mix(0.88, 1, r), skew: 0.35 * (1 - r), dx: lunge * (1 - r) };
  }
  // 도끼창 날(W6A) 한 장을 중심 (x, y), 각도 rot 로 그린다
  const blade = (id, col, x, y, rot, sc, al) => vfxDraw(ctx, id, col, 0, x, y, { scale: sc, rot, alpha: al });
  // 땅 위로 균열(C8)을 x0 에서 dir 쪽으로 자라게 깐다
  function crack(a, x0, len, o = {}) {
    const dir = a.dir;
    skFx(null, o.delay || 0, o.life || 0.6, (u) => {
      const L = len * easeOut(Math.min(1, u / 0.3)), al = u < 0.6 ? 1 : (1 - u) / 0.4;
      vfxTileRun(ctx, 'c8', o.color || LAVA, Math.min(5, Math.floor(u * 8)), x0, groundY() + 1, L, dir, { scale: o.sc || 1, alpha: al });
    });
  }
  // 둘레를 도는 도끼창 날들 (바퀴). o: { cx(u), cy, R, ry, n, sc, w, id, color, front }
  function wheel(a, life, o) {
    aFx(a, 0, life, (u) => {
      const k = u < 0.12 ? u / 0.12 : u > 0.85 ? (1 - u) / 0.15 : 1, c = o.cx(u), th0 = u * life * o.w;
      for (let j = 0; j < o.n; j++) {
        const th = th0 + (j / o.n) * Math.PI * 2, front = Math.sin(th) > 0;
        for (const [lag, al] of [[0.45, 0.2], [0.22, 0.35], [0, front ? 1 : 0.65]]) {
          const t2 = th - lag;
          blade(o.id, o.color, c + Math.cos(t2) * o.R, o.cy + Math.sin(t2) * o.ry, t2 + (o.rotAdd || 0), o.sc, k * al);
        }
      }
    });
  }
  // 날아가는 도끼날: 빙글빙글 돌며 ang 방향으로, 뒤에 잔상 둘
  function hurl(a, x, y, ang, dist, o = {}) {
    const c = Math.cos(ang), s = Math.sin(ang), life = o.life || 0.4, col = o.color || STEEL, spin = (a.dir > 0 ? 1 : -1) * Math.PI * (o.turns || 6);
    for (const [lag, al] of [[0.1, 0.3], [0.05, 0.5], [0, 1]]) {
      skFx(null, o.delay || 0, life, (u) => {
        const v = Math.max(0, u - lag), e = easeOut(v);
        blade(o.id || 'w6a', col, x + c * dist * e, Math.min(y + s * dist * e, groundY() + 2), v * spin, o.scale || 2 / 3, al * (u > 0.7 ? (1 - u) / 0.3 : 1) * (u < lag ? 0 : 1));
      });
    }
  }

  // ── 전부 회전 (whirl) ── 도끼창 날이 기사 둘레를 철의 바퀴로 돈다 (W6A + 잔상). 1칸 날 둘 · ★ 셋 · ★★ 크게 · ★★★ 넷 + 금빛
  //  제자리 철벽(a_grow): 한 단계 크게 제자리 · 추격 회전(a_follow): 바퀴가 대상에게 굴러가 붙는다
  SKILL_FX.wl_whirl = {
    pose(u) { const s = Math.sin(u * Math.PI * 10); return { wa: -1.2 + 1.5 * s, wa2: -0.6 - 0.8 * s, skew: 0.14 * s, sy: 1 - 0.04 * Math.abs(s) }; },
    cues: (a) => [[0.01, (a) => {
      const m = a.mast || 0, grow = t7Sh(a, 'grow'), follow = t7Sh(a, 'follow'), life = a.k.dur;
      const sc = grow ? (m >= 3 ? 2 : 4 / 3) : m >= 2 ? 1 : 2 / 3, n = grow ? [2, 2, 3, 3][m] : [2, 3, 3, 4][m], col = tone(a, STEEL);
      const cx = (u) => (follow ? mix(a.x(), a.tx(), easeOut(Math.min(1, u / 0.35))) : a.x());
      wheel(a, life, { cx, cy: groundY() - 24, R: 20 + 34 * sc, ry: 9, n, sc, w: (Math.PI * 7) / life, id: 'w6a', color: col });
      ringFx(a.x(), col, sc >= 1 ? 1.2 : 0.8, 0.45);
      for (let k = 0; k < 6 + 2 * m; k++) dust(a.x() + rand(-30, 30), k * 0.06);
    }]],
    hit(a) { ringFx(a.x(), tone(a, STEEL), (a.mast || 0) >= 2 ? 1.2 : 0.8, 0.4); impact({ shake: 0.1 }); },
    hitTex(a, t, share, i, n) { texFx('k09', t.x, t.y, tone(a, STEEL), { scale: i === n - 1 && (a.mast || 0) >= 1 ? 1 : 2 / 3, frames: 5, life: 0.28, rot: rand(-0.4, 0.4), flip: a.dir < 0, fade: 0.3 }); },
    kb: 24,
  };

  // ── 지열참 (flash) ── 내려찍자(잠깐 멈춤) 땅이 한 줄로 화면 끝까지 갈린다: 고랑(E14) + 용암 불길 띠(F22) + 강철 불꽃(K09) + 용암 간헐천(E22). ★★ 크게 · ★★★ 금빛
  //  잔열(b_after): 0.5초 뒤 검붉은 불길 띠 한 번 더 · 삼열 균열(b_triple): 균열이 앞·가운데·뒤 세 줄로
  SKILL_FX.wl_flash = {
    pose(u, a) { return chopPose(u * a.k.dur, a.k.dur, Math.max(0.3, T1(a)), 8); },
    cues: (a) => [[Math.max(0.3, T1(a)) / a.k.dur, (a) => {
      const m = a.mast || 0, g = gripOf(a), x0 = g.x + a.dir * 24, x1 = a.dir > 0 ? W + 30 : -30, len = Math.abs(x1 - x0), sc = m >= 2 ? 1 : 2 / 3, col = tone(a, LAVA);
      const run = (dy, o) => {
        skFx(null, o.delay || 0, 0.65, (u) => {
          const L = len * easeOut(Math.min(1, u / 0.3)), al = (o.alpha == null ? 1 : o.alpha) * (u < 0.55 ? 1 : (1 - u) / 0.45);
          if (!o.onlyFire) vfxTileRun(ctx, 'e14', EARTH, Math.min(4, Math.floor(u * 6)), x0, groundY() + 5 + dy, L, a.dir, { anchor: 'b', scale: sc, alpha: al });
          vfxTileRun(ctx, 'f22', o.color, Math.floor(clock * 12) % 5, x0, groundY() + 3 + dy, L, a.dir, { anchor: 'b', scale: o.fs, alpha: al });
        });
        for (let x = x0 + a.dir * 40, j = 0; a.dir > 0 ? x < x1 : x > x1; x += a.dir * (o.gap || 90), j++) {
          const dl = (o.delay || 0) + Math.abs(x - x0) / 1400;
          if (!o.noGeyser) geyser(x, dl, sc);
          if (!o.onlyFire && j % 2 === 0) texFx('k09', x, groundY() - 10 + dy, STEEL, { scale: 2 / 3, life: 0.3, delay: dl, flip: a.dir < 0, fade: 0.35 });
        }
      };
      if (t7Sh(a, 'triple')) [-6, 0, 6].forEach((dy, j) => run(dy, { color: col, fs: 2 / 3, delay: j * 0.1, gap: 130, noGeyser: j !== 1 }));
      else run(0, { color: col, fs: sc });
      if (t7Sh(a, 'after')) run(0, { color: RED, fs: sc, delay: 0.5, alpha: 0.5, onlyFire: true, noGeyser: true });
      ringFx(x0, col, 1.3, 0.5);
      debris(x0, 14, ['#5a4a42', EARTH, LAVA], 1.3);
      impact({ stop: 0.12, shake: 0.5 });
    }]],
    hit(a, i, n) { impact(i === n - 1 ? { stop: 0.1, shake: 0.35 } : { shake: 0.1 }); },
    hitTex(a, t) { texFx('k23', t.x, groundY() + 3, tone(a, LAVA), { anchor: 'b', scale: 2 / 3, frames: 7, life: 0.32, fade: 0.3 }); },
    kb: 10, launch: true,
  };

  // ── 투척 도끼창 (wave) ── 도끼창 날(W6A)이 빙글빙글 돌며 부채꼴로 날아간다 (잔상 둘). 1칸 1자루 · ★ 3 · ★★ 5 · ★★★ 7 (크게). 관통(k_pierce) 이면 더 멀리
  SKILL_FX.wl_wave = {
    pose(u, a) {
      const d = a.k.dur, t = u * d, T = Math.max(0.1, T1(a));
      if (t < T - 0.06) { const c = easeOut(t / (T - 0.06)); return { wa: mix(-1.35, -2.8, c), skew: -0.22 * c, sy: 1 - 0.06 * c, ext: -2 * c }; }
      if (t < T + 0.04) { const s = easeOut(segU(t, T - 0.06, T + 0.04)); return { wa: mix(-2.8, 0.6, s), skew: mix(-0.22, 0.3, s), ext: mix(-2, 8, s) }; }
      const r = easeOut(segU(t, T + 0.04, d)); return { wa: mix(0.6, -1.35, r), skew: 0.3 * (1 - r), ext: 8 * (1 - r) };
    },
    cues: () => [],
    hit(a, i) {
      if (i) return;
      const m = a.mast || 0, n = [1, 3, 5, 7][m], g = gripOf(a), dist = t7Sh(a, 'pierce') ? 300 : 170, y0 = Math.min(g.y, groundY() - 34), col = tone(a, STEEL);
      for (let j = 0; j < n; j++) {
        const off = n > 1 ? (j / (n - 1) - 0.65) * 0.5 : -0.03;
        hurl(a, g.x + a.dir * 12, y0, a.dir > 0 ? off : Math.PI - off, dist, { delay: j * 0.03, scale: m >= 3 ? 1 : 2 / 3, color: col, id: j % 2 ? 'w6' : 'w6a', life: 0.4 + dist / 2000 });
      }
      dust(g.x - a.dir * 8);
      impact({ shake: 0.1 });
    },
    hitTex(a, t) { texFx('k09', t.x, t.y, tone(a, STEEL), { scale: 2 / 3, frames: 5, life: 0.26, rot: rand(-0.4, 0.4), flip: a.dir < 0, fade: 0.35 }); },
  };

  // ── 전장 폭풍 (storm) ── 충격 고리(C3)가 퍼지며 바위판(E21)이 좌우로 줄지어 솟고 강철 호(W6)가 위로 튄다. 1칸 4 · ★ 8 · ★★ 8 크게 · ★★★ 12 금빛
  //  분열 충격(k_split): 맞은 자리에서 바위가 두 갈래로 · 관통(k_pierce) 이면 범위 +20%
  SKILL_FX.wl_storm = {
    pose(u, a) {
      const t = u * a.k.dur, T = Math.max(0.15, T1(a));
      if (t < T) { const c = easeOut(t / T); return { wa: mix(-1.35, -2.4, c), lift: 8 * c, sy: 1 - 0.06 * c, skew: -0.1 * c }; }
      const r = easeOut(segU(t, T, Math.min(a.k.dur, T + 0.35))); return { wa: mix(1.1, -1.35, r), sy: mix(0.88, 1, r), skew: 0.3 * (1 - r) };
    },
    cues: () => [],
    hit(a, i) {
      if (i) return;
      const m = a.mast || 0, n = [4, 8, 8, 12][m], per = n / 2, cx = a.x(), reach = t7Sh(a, 'pierce') ? 170 : 140, sc = m >= 2 ? 1 : 2 / 3, col = tone(a, STEEL);
      for (const side of [-1, 1]) for (let j = 0; j < per; j++) {
        const x = cx + side * (24 + ((j + 1) * reach) / per), dl = j * 0.05;
        texFx('e21', x, groundY() + 2, EARTH, { anchor: 'b', scale: sc, life: 0.55, delay: dl, flip: side < 0, fade: 0.35 });
        skLater(a, dl, () => debris(x, 3, ['#5a4a42', EARTH]));
      }
      const nA = [2, 4, 4, 6][m];
      for (let j = 0; j < nA; j++) {
        const side = j % 2 ? 1 : -1, ang = side > 0 ? -0.35 - (j >> 1) * 0.35 : Math.PI + 0.35 + (j >> 1) * 0.35;
        hurl(a, cx, groundY() - 20, ang, 90, { scale: 2 / 3, life: 0.35, color: col, id: 'w6', turns: 2, delay: j * 0.02 });
      }
      ringFx(cx, col, m >= 2 ? 1.5 : 1.1, 0.5);
      ringFx(cx, tone(a, EARTH), m >= 2 ? 2.2 : 1.6, 0.6);
      impact({ stop: 0.05, shake: 0.28 });
    },
    hitTex(a, t) {
      texFx('k10', t.x, t.y, tone(a, STEEL), { scale: 2 / 3, life: 0.26, flip: t.x < a.x(), fade: 0.35 });
      if (t7Sh(a, 'split')) for (const s of [-1, 1]) texFx('e21', t.x + s * 30, groundY() + 2, EARTH, { anchor: 'b', scale: 2 / 3, life: 0.4, delay: 0.08, flip: s < 0, fade: 0.35 });
    },
    kb: 22,
  };

  // ── 회전 분쇄 (f_ab) ── 도끼 바퀴가 돌며 쓸다가 — 마지막 타에 땅을 내려찍어 균열(C8) · 바위판(E21) · 용암(E22)
  SKILL_FX.wl_f_ab = {
    pose(u, a) {
      const d = a.k.dur, t = u * d, TLs = Math.max(0.3, TL(a));
      if (t < TLs - 0.2) { const s = Math.sin(t * 28); return { wa: -1.2 + 1.5 * s, wa2: -0.6 - 0.8 * s, skew: 0.14 * s, sy: 1 - 0.04 * Math.abs(s) }; }
      return chopPose(t, d, TLs, 6);
    },
    cues: (a) => [[0.01, (a) => {
      const m = a.mast || 0, life = Math.max(0.3, TL(a) - 0.1), sc = m >= 2 ? 1 : 2 / 3, col = tone(a, STEEL);
      wheel(a, life, { cx: () => a.x(), cy: groundY() - 24, R: 20 + 34 * sc, ry: 9, n: m >= 2 ? 3 : 2, sc, w: (Math.PI * 7) / life, id: 'w6a', color: col });
    }]],
    hit(a, i, n) {
      const m = a.mast || 0;
      if (i < n - 1) { ringFx(a.x(), tone(a, STEEL), 0.8, 0.35); impact({ stop: 0.03, shake: 0.12 }); return; }
      const g = gripOf(a), x0 = g.x + a.dir * 30, far = Math.max(200, Math.abs(a.tx() - x0) + 60), col = tone(a, LAVA);
      crack(a, x0, far, { color: col, sc: m >= 2 ? 4 / 3 : 1 });
      for (let j = 0; j < 4; j++) {
        const x = x0 + a.dir * (30 + j * (far / 4));
        texFx('e21', x, groundY() + 2, EARTH, { anchor: 'b', scale: m >= 2 ? 1 : 2 / 3, life: 0.55, delay: j * 0.05, flip: a.dir < 0, fade: 0.35 });
      }
      if (m >= 2) geyser(x0 + a.dir * far * 0.6, 0.12, 2 / 3);
      ringFx(x0, col, 1.4, 0.5);
      debris(x0, 16, ['#5a4a42', EARTH, LAVA], 1.4);
      impact({ stop: 0.14, shake: 0.5 });
    },
    hitTex(a, t) { texFx('k09', t.x, t.y, tone(a, STEEL), { scale: 2 / 3, frames: 5, life: 0.26, rot: rand(-0.4, 0.4), flip: a.dir < 0, fade: 0.3 }); },
    kb: 20, launch: true,
  };

  // ── 열진 투척 (f_bk) ── 내려찍어 갈라진 땅(C8)의 틈마다 도끼날(W6A)이 돌며 떨어져 꽂히고 — 용암(E22)으로 터진다. 도끼날 3·4·5·6
  SKILL_FX.wl_f_bk = {
    pose(u, a) { return chopPose(u * a.k.dur, a.k.dur, Math.max(0.3, T1(a)), 6); },
    cues: (a) => [[Math.max(0.3, T1(a)) / a.k.dur, (a) => {
      const m = a.mast || 0, n = [3, 4, 5, 6][m], g = gripOf(a), x0 = g.x + a.dir * 24, len = Math.min(farD(a), 330), step = Math.min(70, len / n), col = tone(a, LAVA), sc = m >= 2 ? 1 : 2 / 3;
      crack(a, x0, len, { color: col, sc: 1, life: 0.9 });
      ringFx(x0, col, 1.2, 0.45);
      debris(x0, 12, ['#5a4a42', EARTH, LAVA], 1.2);
      for (let j = 1; j <= n; j++) {
        const x = x0 + a.dir * (j * step - 10), dl = 0.1 + j * 0.06;
        if (x < 0 || x > W) break;
        skFx(null, dl, 0.8, (u) => {
          const f = Math.min(1, u / 0.3), y = mix(-30, groundY() - 12, easeIn(f)), rot = f < 1 ? f * Math.PI * 4 : Math.PI / 2 + (j % 2 ? 0.25 : -0.25);
          blade('w6a', tone(a, STEEL), x, y, rot, sc, u > 0.75 ? (1 - u) / 0.25 : 1);
        });
        geyser(x, dl + 0.45, sc);
        texFx('k09', x, groundY() - 10, STEEL, { scale: 2 / 3, life: 0.3, delay: dl + 0.3, fade: 0.35 });
      }
      impact({ stop: 0.1, shake: 0.4 });
    }]],
    hit(a, i, n) { impact(i === n - 1 ? { stop: 0.08, shake: 0.3 } : { shake: 0.08 }); },
    hitTex(a, t) { texFx('k23', t.x, groundY() + 3, tone(a, LAVA), { anchor: 'b', scale: 2 / 3, frames: 7, life: 0.32, fade: 0.3 }); },
    kb: 8,
  };

  // ── 철폭풍 (f_ak) ── 도끼 바퀴(W6)가 기사 앞에서 세로로 풍차처럼 돌고, 맞을 때마다 도끼날 파편(W6A)을 사방으로 흩뿌린다 (타격마다 각도가 돈다)
  SKILL_FX.wl_f_ak = {
    pose(u) { const s = Math.sin(u * Math.PI * 8); return { wa: -0.8 + 1.4 * s, wa2: -0.6 - 0.7 * s, skew: 0.15 * s, lift: 2 * Math.abs(s) }; },
    cues: (a) => [[0.01, (a) => {
      const m = a.mast || 0, life = a.k.dur, sc = m >= 2 ? 1 : 2 / 3, col = tone(a, STEEL);
      wheel(a, life, { cx: () => a.x() + a.dir * 8, cy: groundY() - 34, R: 14 + 8 * sc, ry: 18 + 18 * sc, n: m >= 3 ? 3 : 2, sc, w: (Math.PI * 6) / life, id: 'w6', color: col });
      swFollow(a, 'c3', life, () => [a.x(), groundY() + 2], { loop: true, fps: 10, anchor: 'b', scale: sc >= 1 ? 4 / 3 : 1, color: tone(a, LAVA), fadeIn: 0.15 });
    }]],
    hit(a, i) {
      const n = 3 + (a.mast || 0), cx = a.x(), cy = groundY() - 26, col = tone(a, STEEL);
      for (let j = 0; j < n; j++) hurl(a, cx, cy, (j / n) * Math.PI * 2 + i * 0.5, 90, { scale: 2 / 3, life: 0.32, color: col, id: 'w6a', turns: 3 });
      ringFx(cx, tone(a, LAVA), 0.8, 0.35);
      impact({ shake: 0.12 });
    },
    hitTex(a, t) { texFx('k09', t.x, t.y, tone(a, STEEL), { scale: 2 / 3, frames: 5, life: 0.26, rot: rand(-0.4, 0.4), flip: a.dir < 0, fade: 0.3 }); },
    kb: 24,
  };
})();
