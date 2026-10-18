'use strict';
// 시즌7 스킬 빌드 트리 — 그랜드마스터 줄기(파이터 → 기공사 → 그랜드마스터) 새 스킬·융합 연출 (docs/specs/skill-tree-all.md)
// 그림은 새로 뽑지 않고 파이터 계열 시트를 다시 짠다 (코드는 위치·개수·궤적·크기·타이밍·색만):
//  주천 기환 = XE13 기의 고리가 몸 둘레에 쌓여 오르내리고 XE10 기탄 두 알(음양)이 돈다 · 관천 장풍 = 손에 XE10 이 자라다가 F30 굵은 광선이 화면 끝까지 ·
//  기탄 = XP1 작은 기탄이 꼬리를 끌며 부채꼴로 · 기공 폭풍 = 기돔 XE12 + 고리 XE13 이 퍼지고 XP1 기탄이 사방으로 · 융합 = 두 부모 연출 이어 붙이기.
// 모습(칸마다): a.mast 0~3 — 개수·크기·금빛이 오른다. 변형은 내 기사만 (t7Sh). 이 파일은 tree7-fx.js 뒤에 불러온다.

(function () {
  const pick = (arr, m) => arr[Math.max(0, Math.min(3, m || 0))];
  const WHITE_QI = '#eaf6ff', BEAM = '#7fd8ff';

  // 한 줄기: (x,y) 에서 ang 방향으로 dist 만큼 날아가는 시트. 왼쪽으로 가도 그림이 뒤집혀 서 있게 (flip + 회전 π). loop: 프레임을 돌린다
  function ray(id, x, y, ang, dist, o = {}) {
    const c = Math.cos(ang), s = Math.sin(ang), left = c < 0, nf = VFX_SHEETS[id] ? VFX_SHEETS[id].frames : 1;
    skFx(null, o.delay || 0, o.life || 0.32, (u) => {
      for (let k = 0; k < (o.trail || 1); k++) {
        const uu = u - k * 0.07;
        if (uu < 0) continue;
        const e = easeOut(uu);
        for (const off of o.off || [0]) vfxDraw(ctx, id, o.color, o.loop ? Math.floor(clock * 14) % nf : Math.min(nf - 1, Math.floor(u * nf)), x + c * (dist * e + off), y + s * (dist * e + off),
          { scale: o.scale || 2 / 3, flip: left, rot: ang + (left ? Math.PI : 0) + (o.rotAdd || 0), alpha: (u > 0.7 ? (1 - u) / 0.3 : 1) * [1, 0.45, 0.2][k] * (o.alpha == null ? 1 : o.alpha) });
      }
    });
    if (o.pop) texFx('xe11', x + c * dist, y + s * dist, o.popColor || o.color, { scale: 2 / 3, life: 0.2, delay: (o.delay || 0) + (o.life || 0.32) * 0.85 });
  }
  // 손바닥에 기탄이 자란다 (장풍을 쏘기 전까지): 크기 2/3 → 1 → 4/3, 둘레의 XE11 알갱이가 빨려 든다
  function charge(a, T, atBody) {
    aFx(a, 0, T, (u) => {
      const h = atBody ? { x: a.px(), y: groundY() - 26 } : qiHand(a), sc = u < 0.4 ? 2 / 3 : u < 0.8 ? 1 : 4 / 3;
      vfxDraw(ctx, atBody ? 'xe10' : 'xe13', a.color, Math.floor(clock * 14) % 4, h.x + (atBody ? 0 : a.dir * 10), h.y, { scale: atBody ? sc : sc * 0.5 > 2 / 3 ? 2 / 3 : 2 / 3, rot: atBody ? 0 : Math.PI / 2, flip: a.dir < 0, alpha: Math.min(1, u * 3) * 0.9 });
      for (let j = 0; j < 4; j++) {
        const an = clock * 7 + (j * Math.PI) / 2, r = 6 + 34 * (1 - u);
        vfxDraw(ctx, 'xe11', '#ffe8a8', Math.floor(clock * 12) % 4, h.x + Math.cos(an) * r, h.y + Math.sin(an) * r * 0.7, { scale: 2 / 3, alpha: 0.9 * u });
      }
    });
  }
  // 화면 끝까지 한 줄: F30 굵은 광선 타일을 손에서 길게 뻗는다 (코어는 흰 심을 얇게 한 겹 더)
  function beam(a, y, o = {}) {
    const d = a.dir, sc = o.scale || 1, x0 = a.x() + d * 24, life = o.life || 0.45, len = d > 0 ? W - x0 : x0;
    skFx(null, o.delay || 0, life, (u) => {
      const f = Math.min(3, Math.floor(u * 8) % 4), l = len * easeOut(Math.min(1, u / 0.2)), al = (o.alpha == null ? 1 : o.alpha) * (u < 0.6 ? 1 : (1 - u) / 0.4);
      vfxTileRun(ctx, 'f30', o.color || a.color, f, x0, y, l, d, { scale: sc, alpha: al, vary: false });
      vfxTileRun(ctx, 'f30', '#ffffff', f, x0, y, l, d, { scale: sc * 0.5 > 2 / 3 ? sc * 0.5 : 2 / 3, alpha: al * 0.7, vary: false });
    });
    if (false) texFx('xe10', x0 + d * 20, y, o.color || a.color, { scale: sc >= 1 ? 4 / 3 : 1, delay: o.delay || 0, life: 0.3, flip: d < 0, fade: 0.4, move: (u) => [d * len * easeOut(Math.min(1, u / 0.7)), 0] });
  }

  // ── 주천 기환 (whirl) ── 기의 고리(XE13)가 몸 둘레에 쌓여 오르내리고 기탄(XE10) 알이 음양처럼 돈다: 1칸 고리 하나·알 둘 · ★ 고리 둘 · ★★ 알 셋 · ★★★ 알 넷 금빛
  //  제자리 대주천(grow): 한 단계 커져 제자리 · 쫓는 기환(follow): 중심이 대상에게 날아가 붙는다
  const whirl = {
    ...SKILL_FX.oneTwo,
    cues: (a) => [[0.01, (a) => {
      const m = a.mast || 0, grow = t7Sh(a, 'grow'), follow = t7Sh(a, 'follow'), rings = pick([1, 2, 2, 2], m), orbs = pick([2, 2, 3, 3], m);
      const rs = pick(grow ? [1, 1, 4 / 3, 4 / 3] : [2 / 3, 2 / 3, 1, 1], m), R = pick([30, 34, 38, 42], m) * (grow ? 1.7 : 1);
      aFx(a, 0, a.k.dur, (u) => {
        const gy = groundY(), cx = follow ? mix(a.x(), a.tx(), easeOut(Math.min(1, u / 0.35))) : a.x(), fade = Math.min(1, u / 0.1, (1 - u) / 0.15);
        for (let j = 0; j < rings; j++)
          vfxDraw(ctx, 'xe13', a.color, Math.floor(clock * 10 + j * 2) % 6, cx, gy - 16 - j * 18 + Math.sin(clock * 3 + j * 2) * 5, { scale: rs, flip: j % 2 === 1, alpha: 0.8 * fade });
        for (let k = 0; k < orbs; k++) for (let q = 0; q < 2; q++) {
          const th = clock * 7 + (k * Math.PI * 2) / orbs - q * 0.3;
          vfxDraw(ctx, 'xe10', k % 2 ? WHITE_QI : a.color, Math.floor(clock * 14) % 4, cx + Math.cos(th) * R, gy - 32 + Math.sin(th) * R * 0.5,
            { scale: 2 / 3, flip: Math.sin(th) > 0, alpha: fade * (q ? 0.4 : 1) });
        }
      });
    }]],
    hit(a, i) { if (i % 2 === 0) texFx('xe13', a.x(), groundY() - 24, a.color, { scale: (a.mast || 0) >= 2 ? 1 : 2 / 3, life: 0.3, fade: 0.4 }); },
    hitTex(a, t, share, i, n) {
      texFx('xh6', t.x + rand(-6, 6), t.y + rand(-8, 6), a.color, { scale: 2 / 3, life: 0.2, fade: 0.3 });
      if (i === n - 1) qiHitTex('xk06', a, t, a.mast >= 2);
    },
  };
  SKILL_FX['gm_whirl'] = whirl;

  // ── 관천 장풍 (flash) ── 손에 기탄이 자라다가(XE10) → 마지막 타에 F30 굵은 광선이 화면 끝까지, 기탄이 앞서 달린다
  //  ★★★ 광선이 굵다. 잔향 관천(after): 0.5초 뒤 흐린 광선 한 번 더 · 삼중 관천(triple): 위·가운데·아래 세 줄
  SKILL_FX['gm_flash'] = {
    ...SKILL_FX.palmBlast,
    cues: (a) => [[0.02, (a) => charge(a, Math.max(0.2, a.k.hits[0][0] * a.k.dur - 0.16))]],
    hitTex(a, t) { qiHitTex('xh7', a, t, false, { scale: (a.mast || 0) >= 2 ? 1 : 2 / 3, life: 0.22 }); },
    hit(a, i, n) {
      const tri = t7Sh(a, 'triple');
      if (i !== n - 1 && !tri) return;
      if (tri && i % 3) return;
      const y = a.ty(), m = a.mast || 0;
      if (tri) for (const dy of [-14, 0, 14]) beam(a, y + dy, { scale: 2 / 3, color: BEAM });
      else beam(a, y, { scale: m >= 3 ? 4 / 3 : 1, color: BEAM });
      if (t7Sh(a, 'after') && i === n - 1) beam(a, y + 3, { delay: 0.5, alpha: 0.55, color: '#c8d8ff', scale: m >= 3 ? 4 / 3 : 1, noOrb: true });
      texFx('xe13', a.tx(), y, BEAM, { scale: m >= 2 ? 1 : 2 / 3, life: 0.35, fade: 0.3, rot: Math.PI / 2 });
      impact({ stop: 0.08, shake: 0.25 });
    },
  };

  // ── 기탄 (wave) ── 손끝에서 XP1 작은 기탄이 꼬리를 끌며 부채꼴로 날아가 끝에서 톡 터진다: 1칸 1발 · ★ 3발 · ★★ 5발 · ★★★ 7발 금빛. 관통(k_pierce)이면 더 멀리
  SKILL_FX['gm_wave'] = {
    ...SKILL_FX.palmBlast,
    cues: () => [],
    hit(a, i) {
      if (i) return;
      const m = a.mast || 0, n = pick([1, 3, 5, 7], m), d = a.dir, h = qiHand(a), dist = t7Sh(a, 'pierce') ? 300 : 170;
      for (let j = 0; j < n; j++) {
        const c = j - (n - 1) / 2, t = c * 0.11 - 0.03;
        ray('xe13', h.x + d * 8, h.y, d > 0 ? t : Math.PI - t, dist, { delay: j * 0.04, scale: pick([4 / 3, 4 / 3, 4 / 3, 2], m), life: 0.4, color: WHITE_QI, off: [0, 3, 6], loop: true, trail: 3, pop: true, popColor: WHITE_QI, rotAdd: Math.PI / 2 });
        ray('xe13', h.x + d * 8, h.y, d > 0 ? t : Math.PI - t, dist, { delay: j * 0.04 + 0.05, scale: pick([4 / 3, 4 / 3, 4 / 3, 2], m), life: 0.4, color: j % 2 ? '#8fd8ff' : '#ffffff', off: [-3], trail: 2, alpha: 0.8, rotAdd: Math.PI / 2 });
      }
      impact({ shake: 0.1 });
    },
    hitTex(a, t) { qiHitTex('xh6', a, t, false, { scale: 2 / 3, life: 0.18 }); },
  };

  // ── 기공 폭풍 (storm) ── 몸에 기를 모았다가(XE10) 기돔(XE12)·고리(XE13)가 퍼지며 XP1 기탄이 사방으로: 1칸 4방향 · ★ 8방향 · ★★ 8방향 크게 · ★★★ 12방향 금빛
  //  분열(k_split): 맞은 자리에서 기탄이 두 갈래
  SKILL_FX['gm_storm'] = {
    ...SKILL_FX.palmBlast,
    cues: (a) => [[0.02, (a) => charge(a, Math.max(0.2, a.k.hits[0][0] * a.k.dur - 0.16), true)]],
    hit(a, i) {
      if (i) return;
      const m = a.mast || 0, n = pick([4, 8, 8, 12], m), cx = a.x(), cy = groundY() - 26, dist = t7Sh(a, 'pierce') ? 150 : 120;
      for (let j = 0; j < n; j++) ray('xp1', cx, cy, (j / n) * Math.PI * 2 + 0.2, dist, { scale: m >= 2 ? 1 : 2 / 3, life: 0.38, color: a.color, loop: true, trail: 2, pop: true });
      [2 / 3, 1, 4 / 3].forEach((sc, k) => {
        texFx('xe12', cx, groundY() + 1, a.color, { anchor: 'b', scale: sc, life: 0.34, delay: k * 0.07, alpha: 0.6, fade: 0.5 });
        texFx('xe13', cx, groundY() - 6, a.color, { scale: sc, life: 0.34, delay: k * 0.07, fade: 0.4 });
      });
      impact({ stop: 0.05, shake: 0.2 });
    },
    hitTex(a, t) {
      texFx('xh6', t.x, t.y, a.color, { scale: 2 / 3, life: 0.2, rot: rand(-0.6, 0.6), fade: 0.4 });
      if (t7Sh(a, 'split')) for (const s of [-1, 1]) ray('xp1', t.x, t.y, s * 0.6 + (a.dir > 0 ? 0 : Math.PI), 60, { scale: 2 / 3, life: 0.25, color: a.color, loop: true, pop: true });
    },
  };

  // ── 융합 ──
  // 순환 장풍: 기돔(XE12)이 쳐졌다가 풀리며 손바닥으로 오므라들고(기가 모인다) → 장풍(기탄 XE10) + 마지막 타에 XE11 알갱이가 터진다
  const palm = SKILL_FX.palmBlast;
  SKILL_FX['gm_f_ab'] = {
    ...palm,
    cues: (a) => [...palm.cues(a), [0.02, (a) => {
      const T = Math.max(0.2, a.k.hits[0][0] * a.k.dur - 0.1);
      aFx(a, 0, T, (u) => {
        const gy = groundY(), sc = u < 0.33 ? 4 / 3 : u < 0.66 ? 1 : 2 / 3, f = Math.floor(clock * 10) % 5;
        vfxDraw(ctx, 'xe12', a.color, f, a.px(), gy + 1, { anchor: 'b', scale: sc, alpha: 0.6 * Math.min(1, u * 4) });
        const h = qiHand(a);
        for (let j = 0; j < 4; j++) {
          const an = (j / 4) * Math.PI * 2 + 0.5, e = easeIn(u);
          vfxDraw(ctx, 'xe11', '#ffe8a8', Math.floor(clock * 12) % 4, mix(a.px() + Math.cos(an) * 34, h.x, e), mix(gy - 24 + Math.sin(an) * 22, h.y, e), { scale: 2 / 3, alpha: 0.9 * u });
        }
      });
    }]].sort((p, q) => p[0] - q[0]),
    hit(a, i, n) {
      palm.hit(a, i, n);
      if (i !== n - 1) return;
      const t = a.targets(i)[0] || { x: a.tx(), y: a.ty() };
      for (let j = 0; j < 4 + (a.mast || 0); j++) {
        const an = (j / (4 + (a.mast || 0))) * Math.PI * 2;
        texFx('xe11', t.x, t.y, a.color, { life: 0.35, move: (u) => [Math.cos(an) * 36 * easeOut(u), Math.sin(an) * 28 * easeOut(u)] });
      }
    },
  };
  // 관통 기탄: 장풍이 지나간 줄에 기탄(XE10)이 남았다가 차례로 터진다 (XK06)
  SKILL_FX['gm_f_bk'] = {
    ...palm,
    hit(a, i, n) {
      palm.hit(a, i, n);
      if (i !== n - 1) return;
      const y = a.ty(), d = a.dir;
      beam(a, y, { scale: (a.mast || 0) >= 3 ? 4 / 3 : 1, color: '#ffd257' });
      if ((a.mast || 0) >= 3) for (const dy of [-16, 16]) beam(a, y + dy, { scale: 2 / 3, color: '#ffe8a8', delay: 0.06 });
      for (let j = 1; j <= 6; j++) {
        const x = a.x() + d * (40 + j * 52);
        if (x < 0 || x > W) break;
        const sc = (a.mast || 0) >= 3 ? 4 / 3 : 2 / 3;
        texFx('xe05', x, y, '#ffd257', { scale: sc, life: 0.3, delay: 0.1 + j * 0.06, flip: d < 0, fade: 0.4 });
        texFx('xk06', x, y + 2, a.color, { scale: sc, life: 0.24, delay: 0.22 + j * 0.06, fade: 0.4 });
      }
    },
  };
  // 기환 폭풍: 주천 기환이 도는 동안 타격마다 기탄(XP1)이 사방으로 흩뿌려진다
  SKILL_FX['gm_f_ak'] = {
    ...whirl,
    hit(a, i, n) {
      whirl.hit(a, i, n);
      for (let j = 0; j < 2 + (a.mast || 0); j++) ray('xp1', a.x(), groundY() - 28, rand(0, Math.PI * 2), 90, { scale: 2 / 3, life: 0.3, color: a.color, loop: true, trail: 2, pop: true });
    },
  };
})();
