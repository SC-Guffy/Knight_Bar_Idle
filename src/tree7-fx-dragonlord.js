'use strict';
// 시즌7 스킬 빌드 트리 — 용황 줄기 새 스킬·융합 7종의 연출 (바탕 연출 대신 따로 짠 것, docs/specs/skill-tree-all.md)
// 그림은 새로 뽑지 않고 지금 시트만 다시 짠다 (VFX 규칙: 코드는 위치·크기·개수·궤적·타이밍·색 램프만). 바탕 연출의 보라 용 대신 붉은 주황 화염이 주제:
//  용염 회오리 = E15h 용 머리 + E15s 몸통 마디가 기사를 휘감아 돈다 + K24 소용돌이 · 용섬 = P8 혜성이 화면 끝까지 + F22 불길 띠 + K23 용암 ·
//  용아창 = E12 불꽃 초승달(용의 이빨)이 뱀처럼 굽이쳐 날아간다 + P7 불덩이 꼬리 · 용염 폭풍 = E34 불 돔 + E35 불기둥 + P8 혜성이 사방으로, 끝에서 E36 불꽃 꽃 ·
//  업화 강하 = E17 불꽃을 아래로 쏟으며 솟구쳤다가 E33 유성으로 내리꽂힘 + E34 · 용섬 창기 = 용섬이 지나간 줄에 E12 용아가 땅에서 솟아 E36 으로 터진다 ·
//  용염 선풍 = E35 불기둥 선풍 + 타격마다 E12 용아를 사방으로.
// 모습: a.mast 0~3 — 개수·크기·금빛이 오른다. 변형 모양(shape)은 내 기사만 (t7Sh). 이 파일은 src/tree7-fx.js 뒤에 불러온다.

(function () {
  const FIRE = '#ff7a2a', EMBER = '#ffc060', RED = '#d8342a', SMOKE = '#8a5a4a';
  const tone = (a, c) => { const m = a.mast || 0; return m >= 3 ? mixHex(c, MASTERY_GOLD, 0.45) : m < 2 ? mixHex(c, MASTERY_FADE[0], MASTERY_FADE[1 + m]) : c; };
  const T1 = (a) => a.k.hits[0][0] * a.k.dur, TL = (a) => a.k.hits[a.k.hits.length - 1][0] * a.k.dur;
  const farD = (a) => Math.max(90, a.dir > 0 ? W - 24 - a.x() : a.x() - 24);
  const clampY = (y) => Math.min(y, groundY() - 4);
  // 연기 한 덩이 (C6) — 불길 뒤에 남는 검붉은 그을음
  const smoke = (x, delay = 0, sc = 2 / 3) => texFx('c6', x + rand(-6, 6), groundY() - 4, SMOKE, { scale: sc, life: 0.55, delay, fade: 0.5, anchor: 'b' });
  // 불꽃 초승달(E12, 용의 이빨) 한 발: ang 방향으로 굽이치며(amp) 날아간다. 뒤에 불덩이(P7) 둘이 꼬리로 따라온다
  function fang(a, x, y, ang, dist, o = {}) {
    const c = Math.cos(ang), s = Math.sin(ang), lf = c < 0, amp = o.amp == null ? 8 : o.amp, ph = o.ph || 0, life = o.life || 0.4, col = o.color || FIRE;
    const mv = (lag) => (u) => {
      const v = Math.max(0, u - lag), e = easeOut(v), w = Math.sin(v * Math.PI * 3 + ph) * amp * Math.min(1, v * 3);
      return [c * dist * e - s * w, Math.min(s * dist * e + c * w, groundY() + 4 - y)];
    };
    texFx('e12', x, y, col, { scale: o.scale || 2 / 3, life, rot: ang + (lf ? Math.PI : 0), flip: lf, fade: 0.3, delay: o.delay || 0, move: mv(0) });
    if (!o.noTail) for (const lag of [0.1, 0.2]) texFx('p7', x, y, EMBER, { scale: 1, life, rot: ang + (lf ? Math.PI : 0), flip: lf, fade: 0.4, alpha: 0.8, delay: o.delay || 0, move: mv(lag) });
  }
  // 혜성(P8) 한 발: 오른쪽을 보는 겁화탄을 ang 방향으로 쏜다
  function comet(x, y, ang, dist, o = {}) {
    const c = Math.cos(ang), s = Math.sin(ang), lf = c < 0;
    texFx('p8', x, y, o.color || FIRE, { scale: o.scale || 2 / 3, life: o.life || 0.35, rot: ang + (lf ? Math.PI : 0), flip: lf, fade: 0.25, alpha: o.alpha, delay: o.delay || 0,
      move: (u) => [c * dist * easeOut(u), Math.min(s * dist * easeOut(u), groundY() + 4 - y)] });
  }
  // 땅 위로 불길 띠(F22)를 x0 에서 dir 쪽으로 자라게 깐다. 길이 len, 혜성 머리가 앞서간다
  function fireStrip(a, x0, len, o = {}) {
    const dir = a.dir, life = o.life || 0.65;
    skFx(null, o.delay || 0, life, (u) => {
      const L = len * easeOut(Math.min(1, u / 0.3)), al = (o.alpha == null ? 1 : o.alpha) * (u < 0.55 ? 1 : (1 - u) / 0.45);
      vfxTileRun(ctx, 'f22', o.color || FIRE, Math.floor(clock * 12) % 5, x0, groundY() + 3, L, dir, { anchor: 'b', scale: o.sc || 2 / 3, alpha: al });
    });
    for (let x = x0 + dir * 50; dir > 0 ? x < x0 + len : x > x0 - len; x += dir * 90) {
      texFx('k23', x, groundY() + 3, o.color || FIRE, { anchor: 'b', scale: 2 / 3, frames: 7, life: 0.35, delay: (o.delay || 0) + Math.abs(x - x0) / 1500, fade: 0.3 });
      smoke(x, (o.delay || 0) + 0.15 + Math.abs(x - x0) / 1500);
    }
  }

  // ── 용염 회오리 (whirl) ── 불꽃의 용이 기사 둘레를 휘감아 돈다 (E15h 머리 + E15s 몸통 마디). 1칸 한 마리 · ★ 두 마리 · ★★ 크게 · ★★★ 금빛
  //  제자리 업화(a_grow): 한 단계 크게 제자리 · 쫓는 불꽃(a_follow): 용이 대상에게 날아가 붙는다
  SKILL_FX.dl_whirl = {
    pose(u) { const s = Math.sin(u * Math.PI * 6); return { wa: -1.4 - 0.3 * s, wa2: -0.6, lift: 2 * Math.abs(s), skew: -0.08 * s, sy: 1.02 }; },
    cues: (a) => [[0.01, (a) => {
      const m = a.mast || 0, grow = t7Sh(a, 'grow'), follow = t7Sh(a, 'follow'), life = a.k.dur;
      const sc = grow ? (m >= 3 ? 2 : 4 / 3) : m >= 2 ? 1 : 2 / 3, n = grow ? 1 : m >= 1 ? 2 : 1, R = 22 + 34 * sc, w = (Math.PI * 3.5) / life, col = tone(a, FIRE), step = (42 * 1.5 * sc * 0.8) / R;
      const cx = (u) => (follow ? mix(a.x(), a.tx(), easeOut(Math.min(1, u / 0.35))) : a.x());
      const pos = (c, th) => [c + Math.cos(th) * R, groundY() - 26 + Math.sin(th) * Math.min(18, R * 0.3), -Math.sin(th) * R, Math.cos(th) * R * 0.3];
      for (let j = 0; j < n; j++) {
        const ph = j * Math.PI;
        aFx(a, 0, life, (u) => {
          const k = u < 0.12 ? u / 0.12 : u > 0.85 ? (1 - u) / 0.15 : 1, c = cx(u), th0 = ph + u * life * w;
          for (let s = 6; s >= 1; s--) {
            const p = pos(c, th0 - s * step);
            vfxDraw(ctx, 'e15s', col, 0, p[0], p[1], { scale: sc, rot: Math.atan2(p[3], p[2]), alpha: k * (1 - s * 0.07) });
          }
          const p = pos(c, th0);
          vfxDraw(ctx, 'e15h', col, 0, p[0], p[1] - 4, { scale: sc, flip: p[2] < 0, alpha: k });
        });
      }
      swFollow(a, 'c3', life, (u) => [cx(u), groundY() + 2], { loop: true, fps: 10, anchor: 'b', scale: sc >= 2 ? 2 : sc >= 4 / 3 ? 4 / 3 : 1, color: col, fadeIn: 0.15 });
      for (let k = 0; k < 4 + 2 * m; k++) smoke(a.x() + rand(-R, R), k * 0.07);
    }]],
    hit(a) { ringFx(a.x(), tone(a, FIRE), (a.mast || 0) >= 2 ? 1.2 : 0.8, 0.4); impact({ shake: 0.08 }); },
    hitTex(a, t, share, i, n) { texFx('k24', t.x, t.y, tone(a, FIRE), { scale: i === n - 1 && (a.mast || 0) >= 1 ? 1 : 2 / 3, frames: 5, life: 0.3, fade: 0.3 }); },
    kb: 6,
  };

  // ── 용섬 (flash) ── 숨을 모았다가(E36 불꽃 꽃이 맺힘) 한 줄기 혜성(P8)이 화면 끝까지, 지나간 땅에 불길 띠(F22)·용암(K23). ★★ 크게 · ★★★ 금빛
  //  잔화(b_after): 0.5초 뒤 검붉은 반투명 불길 한 번 더 · 삼두 용섬(b_triple): 혜성 세 줄기가 위·가운데·아래로
  SKILL_FX.dl_flash = {
    pose(u, a) {
      const d = a.k.dur, t = u * d, T0 = Math.max(0.2, T1(a) - 0.05);
      if (t < T0) { const c = easeOut(t / T0); return { wa: mix(-1.3, -1.6, c), sy: 1 + 0.06 * c, skew: -0.12 * c, lift: 3 * c, dx: Math.sin(t * 60) * c }; }
      if (t < Math.min(d - 0.1, TL(a) + 0.15)) return { wa: -0.05, ext: 14, skew: 0.2, dx: 3 };
      const r = easeOut(segU(t, Math.min(d - 0.1, TL(a) + 0.15), d)); return { wa: mix(-0.05, -1.3, r), ext: 14 * (1 - r), skew: 0.2 * (1 - r), dx: 3 * (1 - r) };
    },
    tick(a, u) {
      const t = u * a.k.dur, T0 = Math.max(0.2, T1(a) - 0.05);
      if (t < T0) { const g = gripOf(a); gatherFx(g.x + a.dir * 24, g.y - 2, [FIRE, '#ffffff'], 2, 26); }
    },
    cues: (a) => {
      const d = a.k.dur, T0 = Math.max(0.2, T1(a) - 0.05);
      return [
        [0.01, (a) => { const g = gripOf(a); texFx('e36', g.x + a.dir * 24, g.y - 2, tone(a, EMBER), { scale: 2 / 3, life: T0 - 0.04, fade: 0, alpha: 0.9 }); }],
        [T0 / d, (a) => {
          const m = a.mast || 0, g = gripOf(a), col = tone(a, FIRE), x0 = g.x + a.dir * 20, x1 = a.dir > 0 ? W + 60 : -60, len = Math.abs(x1 - x0), sc = [2 / 3, 1, 1, 4 / 3][m];
          const run = (dy, o) => comet(x0, g.y + dy, a.dir > 0 ? 0 : Math.PI, len, { life: 0.38, scale: o.sc, color: o.color, alpha: o.alpha, delay: o.delay });
          if (t7Sh(a, 'triple')) [-14, 0, 14].forEach((dy, j) => run(dy, { sc: 2 / 3, color: col, delay: j * 0.04 }));
          else run(0, { sc, color: col });
          fireStrip(a, x0, len, { color: col, sc: m >= 2 ? 1 : 2 / 3 });
          if (t7Sh(a, 'after')) { run(0, { sc, color: RED, alpha: 0.55, delay: 0.5 }); fireStrip(a, x0, len, { color: RED, alpha: 0.5, delay: 0.5 }); }
          ringFx(x0, col, 1.1, 0.4);
          impact({ stop: 0.06, shake: 0.3 });
        }],
      ];
    },
    hit(a, i, n) { impact(i === n - 1 ? { stop: 0.1, shake: 0.35 } : { shake: 0.08 }); },
    hitTex(a, t) { texFx('k23', t.x, groundY() + 3, tone(a, FIRE), { anchor: 'b', scale: 2 / 3, frames: 7, life: 0.32, fade: 0.3 }); },
    kb: 6,
  };

  // ── 용아창 (wave) ── 창끝에서 불꽃 초승달(용의 이빨)이 뱀처럼 굽이치며 부채꼴로 날아간다. 1칸 1발 · ★ 3 · ★★ 5 · ★★★ 7 (크게). 관통(k_pierce) 이면 더 멀리
  SKILL_FX.dl_wave = {
    pose(u, a) {
      const d = a.k.dur, t = u * d, T = Math.max(0.1, T1(a));
      if (t < T - 0.05) { const c = easeOut(t / (T - 0.05)); return { wa: mix(-1.3, -0.2, c), ext: -4 * c, dx: -4 * c, skew: -0.15 * c, sy: 1 - 0.05 * c }; }
      if (t < T + 0.12) return { wa: 0, ext: 14, dx: 6, skew: 0.2 };
      const r = easeOut(segU(t, T + 0.12, d)); return { wa: mix(0, -1.3, r), ext: 14 * (1 - r), dx: 6 * (1 - r), skew: 0.2 * (1 - r) };
    },
    cues: () => [],
    hit(a, i) {
      if (i) return;
      const m = a.mast || 0, n = [1, 3, 5, 7][m], g = gripOf(a), dist = t7Sh(a, 'pierce') ? 300 : 170, y0 = Math.min(g.y, groundY() - 34), col = tone(a, FIRE);
      for (let j = 0; j < n; j++) {
        const off = n > 1 ? (j / (n - 1) - 0.65) * 0.5 : -0.03;
        fang(a, g.x + a.dir * 14, y0, a.dir > 0 ? off : Math.PI - off, dist, { delay: j * 0.03, scale: m >= 3 ? 1 : 2 / 3, color: col, ph: j * 1.3, amp: 6 + 2 * (j % 3) });
      }
      smoke(g.x - a.dir * 8);
      impact({ shake: 0.1 });
    },
    hitTex(a, t) { texFx('e16', t.x, t.y, tone(a, FIRE), { scale: 2 / 3, frames: 5, life: 0.3, flip: a.dir < 0, fade: 0.3 }); },
  };

  // ── 용염 폭풍 (storm) ── 땅에서 불 돔(E34)·불기둥(E35)이 터지고 혜성(P8)이 사방으로, 끝마다 불꽃 꽃(E36). 1칸 4방향 · ★ 8 · ★★ 8 크게 · ★★★ 12 금빛
  //  분염(k_split): 맞은 자리에서 혜성이 두 갈래로 · 관통(k_pierce) 이면 범위 +20%
  SKILL_FX.dl_storm = {
    pose(u, a) {
      const t = u * a.k.dur, T = Math.max(0.15, T1(a));
      if (t < T) { const c = easeOut(t / T); return { wa: mix(-1.3, -1.57, c), lift: 6 * c, sy: 1 + 0.04 * c }; }
      const r = easeOut(segU(t, T, Math.min(a.k.dur, T + 0.35))); return { wa: mix(1.2, -1.3, r), lift: 0, sy: mix(0.88, 1, r), skew: 0.25 * (1 - r) };
    },
    cues: () => [],
    hit(a, i) {
      if (i) return;
      const m = a.mast || 0, n = [4, 8, 8, 12][m], cx = a.x(), cy = groundY() - 26, dist = t7Sh(a, 'pierce') ? 150 : 120, sc = m >= 2 ? 1 : 2 / 3, col = tone(a, FIRE);
      texFx('e34', cx, groundY() + 2, col, { anchor: 'b', scale: sc, frames: 7, life: 0.55, fade: 0.3 });
      texFx('e35', cx, groundY() + 2, col, { anchor: 'b', scale: sc, life: 0.5, fade: 0.4 });
      for (let j = 0; j < n; j++) {
        const ang = (j / n) * Math.PI * 2 + (n === 4 ? Math.PI / 4 : 0);
        comet(cx, cy, ang, dist, { scale: 2 / 3, life: 0.36, color: col });
        texFx('e36', cx + Math.cos(ang) * dist, clampY(cy + Math.sin(ang) * dist), EMBER, { scale: 2 / 3, life: 0.3, delay: 0.3, fade: 0.4 });
      }
      ringFx(cx, col, m >= 2 ? 1.5 : 1.1, 0.5);
      impact({ stop: 0.05, shake: 0.25 });
    },
    hitTex(a, t) {
      texFx('k23', t.x, groundY() + 3, tone(a, FIRE), { anchor: 'b', scale: 2 / 3, frames: 7, life: 0.3, fade: 0.3 });
      if (t7Sh(a, 'split')) for (const s of [-1, 1]) comet(t.x, t.y, s * 0.6 + (a.dir > 0 ? 0 : Math.PI), 60, { scale: 2 / 3, life: 0.25 });
    },
    kb: 10,
  };

  // ── 업화 강하 (f_ab) ── 발밑으로 불꽃(E17)을 쏟으며 솟구쳤다가 불타는 유성(E33)이 되어 내리꽂힌다 — 착지에 불 돔(E34)
  SKILL_FX.dl_f_ab = {
    pose(u, a) {
      const d = a.k.dur, t = u * d, T = Math.max(0.35, T1(a)), D = Math.max(0, Math.abs(a.tx() - a.x()) - 14), tp = T * 0.55;
      if (t < 0.12) return { sy: 1 - 0.14 * (t / 0.12), wa: -1.3 };
      if (t < tp) { const r = easeOut(segU(t, 0.12, tp)); return { lift: 64 * r, wa: -1.57, sy: 1.06, dx: D * 0.1 * r }; }
      if (t < T) { const f = easeIn(segU(t, tp, T)); return { lift: 64 * (1 - f), dx: mix(D * 0.1, D, f), wa: mix(-1.57, 1.57, f), sy: 1.1 }; }
      const hold = Math.min(d - 0.1, TL(a) + 0.15);
      if (t < hold) return { dx: D, sy: mix(0.86, 1, segU(t, T, T + 0.15)), wa: 1.2 };
      const b = segU(t, hold, d); return { dx: D * (1 - b), lift: 10 * Math.sin(Math.PI * b), wa: -1.3 };
    },
    cues: (a) => {
      const d = a.k.dur, T = Math.max(0.35, T1(a)), tp = T * 0.55;
      return [
        [0.12 / d, (a) => {
          const col = tone(a, FIRE), m = a.mast || 0;
          impact({ shake: 0.12 });
          swFollow(a, 'e17', tp - 0.12 + 0.1, () => { const p = castPose(a.owner) || {}; return [a.px(), groundY() - (p.lift || 0) + 30]; }, { loop: true, fps: 16, rot: Math.PI / 2, scale: m >= 2 ? 1 : 2 / 3, color: col, fadeIn: 0.1 });
          texFx('e34', a.x(), groundY() + 2, col, { anchor: 'b', scale: 2 / 3, frames: 4, life: 0.3, fade: 0.4 });
        }],
        [tp / d, (a) => {
          const col = tone(a, FIRE), m = a.mast || 0;
          swFollow(a, 'e33', T - tp + 0.05, () => { const p = castPose(a.owner) || {}; return [a.px() - a.dir * 8, groundY() - (p.lift || 0) - 26]; }, { loop: true, fps: 16, scale: m >= 2 ? 1 : 2 / 3, flip: a.dir < 0, color: col });
        }],
      ];
    },
    hit(a, i, n) {
      const m = a.mast || 0, x = a.tx() - a.dir * 4, col = tone(a, FIRE);
      if (i > 0) { texFx('e36', x + rand(-34, 34), groundY() - 14, EMBER, { scale: 2 / 3, life: 0.3, fade: 0.4 }); impact({ stop: 0.03, shake: 0.15 }); return; }
      texFx('e34', x, groundY() + 2, col, { anchor: 'b', scale: m >= 2 ? 1 : 2 / 3, frames: 7, life: 0.6, fade: 0.3 });
      ringFx(x, col, m >= 3 ? 1.7 : 1.3, 0.55);
      debris(x, 18, ['#5a4a42', FIRE, EMBER], 1.4);
      for (let k = 0; k < 3; k++) smoke(x + rand(-20, 20), k * 0.06, m >= 2 ? 1 : 2 / 3);
      impact({ stop: 0.12, shake: m >= 3 ? 0.5 : 0.4 });
    },
    hitTex(a, t) { texFx('k23', t.x, groundY() + 3, tone(a, FIRE), { anchor: 'b', scale: 2 / 3, frames: 7, life: 0.32, fade: 0.3 }); },
    kb: 16,
  };

  // ── 용섬 창기 (f_bk) ── 용섬(혜성 + 불길 띠)이 지나간 줄에서 용아(E12)가 땅을 뚫고 솟아 — 불꽃 꽃(E36)으로 터진다. 용아 4·5·6·8
  SKILL_FX.dl_f_bk = {
    pose(u, a) {
      const d = a.k.dur, t = u * d, T0 = Math.max(0.2, T1(a) - 0.05);
      if (t < T0) { const c = easeOut(t / T0); return { wa: mix(-1.3, -1.6, c), sy: 1 + 0.05 * c, skew: -0.1 * c, lift: 2 * c }; }
      const hold = Math.min(d - 0.1, TL(a) + 0.1);
      if (t < hold) return { wa: -0.05, ext: 14, skew: 0.2, dx: 3 };
      const r = easeOut(segU(t, hold, d)); return { wa: mix(-0.05, -1.3, r), ext: 14 * (1 - r), skew: 0.2 * (1 - r), dx: 3 * (1 - r) };
    },
    cues: (a) => {
      const d = a.k.dur, T0 = Math.max(0.2, T1(a) - 0.05);
      return [[T0 / d, (a) => {
        const m = a.mast || 0, n = [4, 5, 6, 8][m], g = gripOf(a), col = tone(a, FIRE), x0 = g.x + a.dir * 20, len = Math.min(farD(a), 330), step = Math.min(60, len / n), sc = m >= 2 ? 1 : 2 / 3;
        comet(x0, g.y, a.dir > 0 ? 0 : Math.PI, len + 40, { life: 0.34, scale: sc, color: col });
        fireStrip(a, x0, len, { color: col, sc: 2 / 3, life: 0.6 });
        for (let j = 1; j <= n; j++) {
          const x = x0 + a.dir * (j * step), dl = 0.12 + j * 0.05;
          if (x < 0 || x > W) break;
          texFx('e12', x, groundY() - 14, col, { scale: sc, life: 0.7, delay: dl, rot: -Math.PI / 2, fade: 0.25, move: (u) => [0, mix(34, 0, easeOut(Math.min(1, u / 0.25)))] });
          texFx('e36', x, groundY() - 34, EMBER, { scale: 2 / 3, life: 0.3, delay: dl + 0.4, fade: 0.4 });
        }
        impact({ stop: 0.06, shake: 0.25 });
      }]];
    },
    hit(a, i, n) { impact(i === n - 1 ? { stop: 0.08, shake: 0.3 } : { shake: 0.08 }); },
    hitTex(a, t) { texFx('k23', t.x, groundY() + 3, tone(a, FIRE), { anchor: 'b', scale: 2 / 3, frames: 7, life: 0.3, fade: 0.3 }); },
    kb: 8,
  };

  // ── 용염 선풍 (f_ak) ── 불기둥(E35) 선풍이 기사를 감싸 돌고, 맞을 때마다 용아(E12)를 사방으로 흩뿌린다 (타격마다 각도가 돈다)
  SKILL_FX.dl_f_ak = {
    pose(u) { const s = Math.sin(u * Math.PI * 8); return { wa: -1.0 + 1.2 * s, wa2: -0.6 - 0.6 * s, skew: 0.14 * s, lift: 2 * Math.abs(s) }; },
    cues: (a) => [[0.01, (a) => {
      const m = a.mast || 0, life = a.k.dur, sc = [2 / 3, 2 / 3, 1, 4 / 3][m], col = tone(a, FIRE);
      swFollow(a, 'e35', life, () => [a.x(), groundY() + 2], { loop: true, fps: 14, anchor: 'b', scale: sc, color: col, fadeIn: 0.15 });
      if (m >= 1) for (const s of [-1, 1]) swFollow(a, 'e35', life, (u) => [a.x() + s * (30 + 22 * sc) + Math.sin(u * 20 + s) * 3, groundY() + 2], { loop: true, fps: 12, anchor: 'b', scale: 2 / 3, color: col, fadeIn: 0.25, alpha: 0.8 });
      swFollow(a, 'c3', life, () => [a.x(), groundY() + 2], { loop: true, fps: 10, anchor: 'b', scale: sc >= 1 ? 4 / 3 : 1, color: col, fadeIn: 0.15 });
    }]],
    hit(a, i) {
      const n = 3 + (a.mast || 0), cx = a.x(), cy = groundY() - 26, col = tone(a, FIRE);
      for (let j = 0; j < n; j++) fang(a, cx, cy, (j / n) * Math.PI * 2 + i * 0.5, 90, { scale: 2 / 3, life: 0.3, color: col, amp: 4, ph: j, noTail: true });
      smoke(cx + rand(-20, 20));
      impact({ shake: 0.1 });
    },
    hitTex(a, t) { texFx('k24', t.x, t.y, tone(a, FIRE), { scale: 2 / 3, frames: 5, life: 0.26, fade: 0.3 }); },
    kb: 6,
  };
})();
