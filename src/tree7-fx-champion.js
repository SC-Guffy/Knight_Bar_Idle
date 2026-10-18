'use strict';
// 시즌7 스킬 빌드 트리 — 챔피언 줄기(파이터 → 스트라이커 → 챔피언) 새 스킬·융합 연출 (docs/specs/skill-tree-all.md)
// 그림은 새로 뽑지 않고 파이터 계열 시트를 다시 짠다 (코드는 위치·개수·궤적·크기·타이밍·색 램프만):
//  맹호 난타 = XE03 주먹 잔상이 기사 둘레를 돌며(호랑이) XK 대신 XE02 발톱 세 줄로 할퀸다 · 철갑 직권 = 숨 모으는 XE13 고리 → XE06 강철 주먹 + XE02 줄이 화면 끝까지 ·
//  권풍 = XE07 바람 쐐기가 주먹 잔상을 달고 가로줄로 날아간다 · 사방 권격 = XE07 쐐기 방사 + XE13 퍼지는 고리 · 융합 = 두 부모 연출 이어 붙이기.
// 모습(칸마다): a.mast 0~3 — 개수·크기·불 램프(★★)·금빛(★★★)이 오른다. 변형은 내 기사만 (t7Sh).
// 이 파일은 tree7-fx.js 뒤에 불러온다.

(function () {
  const FIRE = QI_FIRE_RAMP;
  const col = (a) => (a.mast === 2 ? FIRE : a.color);
  const pick = (arr, m) => arr[Math.max(0, Math.min(3, m || 0))];

  // 한 줄기: (x,y) 에서 ang 방향으로 dist 만큼 날아가는 시트. 왼쪽으로 가도 그림이 뒤집혀 서 있게 (flip + 회전 π)
  function ray(id, x, y, ang, dist, o = {}) {
    const c = Math.cos(ang), s = Math.sin(ang), left = c < 0, nf = VFX_SHEETS[id] ? VFX_SHEETS[id].frames : 1;
    skFx(null, o.delay || 0, o.life || 0.32, (u) => {
      for (let k = 0; k < (o.trail || 1); k++) {
        const uu = u - k * 0.07;
        if (uu < 0) continue;
        const e = easeOut(uu);
        vfxDraw(ctx, id, o.color, o.loop ? Math.floor(clock * 14) % nf : Math.min(nf - 1, Math.floor(u * nf)), x + c * dist * e, y + s * dist * e,
          { scale: o.scale || 2 / 3, flip: left, rot: ang + (left ? Math.PI : 0), alpha: (u > 0.7 ? (1 - u) / 0.3 : 1) * [1, 0.45, 0.2][k] * (o.alpha == null ? 1 : o.alpha) });
      }
    });
  }
  // 화면 끝까지 한 줄: XE02 섬광 줄 토막을 앞으로 이어 깐다 (토막 간격 = 토막 너비)
  function row(a, y, o = {}) {
    const d = a.dir, sc = o.scale || 1, step = o.step || 46 * sc, x0 = a.x() + d * 34;
    for (let j = 0; ; j++) {
      const x = x0 + d * j * step;
      if (x < 0 || x > W) break;
      texFx('xe02', x, y, o.color || col(a), { scale: sc, life: 0.26, delay: (o.delay || 0) + j * 0.018, flip: d < 0, alpha: o.alpha, fade: 0.4 });
    }
  }
  // 호랑이 발톱: 비스듬한 XE02 줄 세 개를 나란히
  function claws(a, t, big) {
    const ang = a.dir > 0 ? 0.9 : Math.PI - 0.9, px = -Math.sin(ang), py = Math.cos(ang);
    for (let k = -1; k <= 1; k++) texFx('xe02', t.x + px * k * 7, t.y + py * k * 7, col(a), { scale: big ? 1 : 2 / 3, rot: ang, flip: a.dir < 0, life: 0.2, delay: (k + 1) * 0.015, fade: 0.4 });
  }
  // 바닥에 퍼지는 고리
  const ring = (x, y, sc, life, color, delay = 0) => texFx('xe13', x, y, color, { scale: sc, life, delay, fade: 0.4 });

  // ── 맹호 난타 (whirl) ── 주먹 잔상이 기사 둘레를 돈다: 1칸 하나 · ★ 둘 · ★★ 셋(불) · ★★★ 넷(금빛). 발톱 자국으로 할퀸다
  //  제자리 포효(grow): 반지름·주먹이 한 단계 커져 제자리 · 추격 주먹(follow): 도는 중심이 대상에게 날아가 붙는다
  const whirl = {
    ...SKILL_FX.ironRush,
    tick: null,
    cues: (a) => [[0.01, (a) => {
      const m = a.mast || 0, grow = t7Sh(a, 'grow'), follow = t7Sh(a, 'follow'), n = pick([1, 2, 3, 4], m);
      const fs = pick(grow ? [1, 1, 4 / 3, 4 / 3] : [2 / 3, 2 / 3, 1, 1], m), R = pick([30, 34, 38, 42], m) * (grow ? 1.7 : 1), rs = pick(grow ? [1, 1, 4 / 3, 4 / 3] : [2 / 3, 2 / 3, 1, 1], m);
      aFx(a, 0, a.k.dur, (u) => {
        const gy = groundY(), cx = follow ? mix(a.x(), a.tx(), easeOut(Math.min(1, u / 0.35))) : a.x(), c = col(a), fade = Math.min(1, u / 0.1, (1 - u) / 0.15);
        for (let j = 0; j < n; j++) for (let k = 0; k < 3; k++) {
          const th = clock * 10 + (j * Math.PI * 2) / n - k * 0.32;
          vfxDraw(ctx, 'xe03', c, Math.floor(clock * 14) % 4, cx + Math.cos(th) * R, gy - 30 + Math.sin(th) * R * 0.3,
            { scale: fs, flip: Math.sin(th) > 0, alpha: fade * [1, 0.5, 0.25][k] });
        }
        vfxDraw(ctx, 'xe13', c, Math.floor(clock * 12) % 6, cx, gy - 2, { scale: rs, alpha: 0.5 * fade });
      });
    }]],
    hit(a, i) {
      if (i % 3 === 0) ring(a.x(), groundY() - 2, (a.mast || 0) >= 2 ? 1 : 2 / 3, 0.3, col(a));
      if (i % 3 === 1) qiDust(a, 2);
    },
    hitTex(a, t, share, i, n) {
      claws(a, { x: t.x + rand(-6, 6), y: t.y + rand(-8, 6) }, i === n - 1 && (a.mast || 0) >= 2);
      if (i === n - 1) qiHitTex('xh3', a, t, a.mast >= 2, { life: 0.22 });
    },
  };
  SKILL_FX['ch_whirl'] = whirl;

  // ── 철갑 직권 (flash) ── 숨을 모으며(XE13 고리가 오므라든다) 정권 → 마지막 타에 XE06 강철 주먹이 XE02 줄을 깔며 화면 끝까지
  //  ★ 부터 강철 주먹 · ★★★ 주먹 둘 + 굵은 줄. 잔향 직권(after): 0.5초 뒤 흐린 줄 한 번 더 · 삼중 직권(triple): 위·가운데·아래 세 줄
  SKILL_FX['ch_flash'] = {
    ...SKILL_FX.crushFist,
    cues: (a) => [[0.02, (a) => {
      const T = Math.max(0.2, a.k.hits[0][0] * a.k.dur - 0.05);
      aFx(a, 0, T, (u) => {
        const gy = groundY(), x = a.px(), c = col(a), sc = u < 0.33 ? 4 / 3 : u < 0.66 ? 1 : 2 / 3;
        vfxDraw(ctx, 'xe13', c, Math.floor(clock * 12) % 6, x, gy - 24, { scale: sc, alpha: 0.35 + 0.55 * u });
        for (let j = 0; j < 4; j++) {
          const an = clock * 6 + (j * Math.PI) / 2, r = 8 + 38 * (1 - u);
          vfxDraw(ctx, 'xe11', '#ffe8a8', Math.floor(clock * 12) % 4, x + Math.cos(an) * r, gy - 24 + Math.sin(an) * r * 0.6, { scale: 2 / 3, alpha: 0.9 * u });
        }
      });
    }]],
    hitTex(a, t) { qiHitTex('xk07', a, t, false, { scale: (a.mast || 0) >= 2 ? 1 : 2 / 3, life: 0.3 }); },
    hit(a, i, n) {
      const tri = t7Sh(a, 'triple');
      if (i !== n - 1 && !tri) return;
      if (tri && i % 3) return;
      const y = a.ty(), m = a.mast || 0, d = a.dir, edge = d > 0 ? W - a.x() : a.x();
      qiDust(a, 6);
      if (tri) for (const dy of [-14, 0, 14]) row(a, y + dy, { scale: 2 / 3, step: 30 });
      else row(a, y, { scale: m >= 3 ? 4 / 3 : 1 });
      if (m >= 1) for (let k = 0; k < (m >= 3 ? 2 : 1); k++)
        texFx('xe06', a.x() + d * 40, y, col(a), { scale: 2 / 3, life: 0.3, delay: k * 0.08, alpha: k ? 0.6 : 1, flip: d < 0, fade: 0.3, move: (u) => [d * edge * easeOut(u), 0] });
      qiFrontTex('xe01', a, 0.3, { len: 60, scale: m >= 2 ? 4 / 3 : 1, y });
      if (t7Sh(a, 'after') && i === n - 1) row(a, y + 3, { delay: 0.5, alpha: 0.55, color: '#b99a7a', scale: m >= 3 ? 4 / 3 : 1 });
      impact({ stop: 0.08, shake: 0.25 });
    },
  };

  // ── 권풍 (wave) ── 주먹 잔상을 달고 XE07 바람 쐐기가 가로줄로 날아간다: 1칸 1발 · ★ 3발 · ★★ 5발 · ★★★ 7발 금빛. 관통(k_pierce)이면 더 멀리
  SKILL_FX['ch_wave'] = {
    ...SKILL_FX.oneTwo,
    cues: () => [],
    hit(a, i) {
      if (i) return;
      const m = a.mast || 0, n = pick([1, 3, 5, 7], m), d = a.dir, h = qiHand(a), dist = t7Sh(a, 'pierce') ? 300 : 170;
      for (let j = 0; j < n; j++) {
        const c = j - (n - 1) / 2, ang = d > 0 ? c * 0.07 - 0.02 : Math.PI - (c * 0.07 - 0.02);
        const y = h.y + c * 8, x = h.x + d * 16, opt = { delay: j * 0.03, color: col(a) };
        ray('xe07', x, y, ang, dist, { ...opt, scale: m >= 3 ? 1 : 2 / 3 });
        ray('xe03', x + d * 10, y, ang, dist, { ...opt, scale: 2 / 3, alpha: 0.8, trail: 2 });
      }
      impact({ shake: 0.1 });
    },
    hitTex(a, t) { qiHitTex('xh3', a, t, false, { life: 0.18 }); },
  };

  // ── 사방 권격 (storm) ── 제자리에서 XE07 쐐기가 주먹 잔상과 함께 사방으로, 바닥엔 XE13 고리가 퍼진다: 1칸 4방향 · ★ 8방향 · ★★ 8방향 크게 · ★★★ 12방향 금빛
  //  분열(k_split): 맞은 자리에서 쐐기가 두 갈래 · 범위(관통 노드): 더 멀리
  SKILL_FX['ch_storm'] = {
    ...SKILL_FX.ironRush,
    tick: null,
    hit(a, i) {
      if (i) return;
      const m = a.mast || 0, n = pick([4, 8, 8, 12], m), cx = a.x(), cy = groundY() - 26, dist = t7Sh(a, 'pierce') ? 150 : 120, c = col(a);
      for (let j = 0; j < n; j++) {
        const ang = (j / n) * Math.PI * 2 + 0.2;
        ray('xe07', cx, cy, ang, dist, { scale: m >= 2 ? 1 : 2 / 3, life: 0.36, color: c });
        ray('xe03', cx, cy, ang, dist * 0.8, { scale: 2 / 3, life: 0.3, color: c, alpha: 0.7 });
      }
      [2 / 3, 1, 4 / 3].forEach((sc, k) => ring(cx, groundY() - 6, sc, 0.34, c, k * 0.07));
      qiDust(a, 8);
      impact({ stop: 0.05, shake: 0.2 });
    },
    hitTex(a, t) {
      texFx('xh3', t.x, t.y, a.color, { scale: 2 / 3, life: 0.2, rot: rand(-0.6, 0.6), fade: 0.4 });
      if (t7Sh(a, 'split')) for (const s of [-1, 1]) ray('xe07', t.x, t.y, s * 0.6 + (a.dir > 0 ? 0 : Math.PI), 60, { scale: 2 / 3, life: 0.25, color: col(a) });
    },
  };

  // ── 융합 ──
  // 연타 붕권: 연타 러시(주먹 잔상 다발) 그대로 → 마지막 타가 붕권: 먼지 + XE05 관통 원뿔 + XE01 충격파 + 큰 XK03
  SKILL_FX['ch_f_ab'] = {
    ...SKILL_FX.ironRush,
    hit(a, i, n) {
      if (i !== n - 1) return;
      const m = a.mast || 0;
      qiDust(a, 8);
      qiFrontTex('xe05', a, 0.32, { off: 34, len: 42 + 12 * m, scale: m >= 2 ? 4 / 3 : 1 });
      qiFrontTex('xe01', a, 0.3, { off: 20, len: 50, scale: m >= 2 ? 4 / 3 : 1, delay: 0.04 });
      ring(a.tx(), groundY() - 4, m >= 2 ? 1 : 2 / 3, 0.34, col(a));
      impact({ stop: 0.1, shake: 0.35 });
    },
    hitTex(a, t, share, i, n) {
      if (i === n - 1) qiHitTex('xk03', a, t, true, { scale: (a.mast || 0) >= 3 ? 4 / 3 : 1, life: 0.4 });
      else SKILL_FX.ironRush.hitTex(a, t, share, i, n);
    },
  };
  // 관통 권풍: 붕권이 지나간 줄에 권풍(XE07 쐐기)이 남았다가 차례로 터진다 (XK01)
  SKILL_FX['ch_f_bk'] = {
    ...SKILL_FX.crushFist,
    hit(a, i, n) {
      SKILL_FX.crushFist.hit(a, i, n);
      if (i !== n - 1) return;
      const y = a.ty(), d = a.dir;
      for (let j = 1; j <= 6; j++) {
        const x = a.x() + d * (40 + j * 58);
        if (x < 0 || x > W) break;
        texFx('xe07', x, y, col(a), { scale: 2 / 3, life: 0.22, delay: 0.1 + j * 0.06, flip: d < 0, fade: 0.4 });
        texFx('xk01', x, y + 4, col(a), { scale: 2 / 3, life: 0.24, delay: 0.22 + j * 0.06, fade: 0.4 });
      }
    },
  };
  // 난타 권풍: 맹호 난타가 도는 동안 타격마다 권풍이 사방으로 흩뿌려진다
  SKILL_FX['ch_f_ak'] = {
    ...whirl,
    hit(a, i, n) {
      whirl.hit(a, i, n);
      const m = a.mast || 0;
      for (let j = 0; j < 2 + m; j++) ray('xe07', a.x(), groundY() - 28, rand(0, Math.PI * 2), 90, { scale: 2 / 3, life: 0.3, color: col(a) });
    },
  };
})();
