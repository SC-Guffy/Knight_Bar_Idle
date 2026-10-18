'use strict';
// 시즌7 스킬 빌드 트리 — 템페스트 줄기(파이터 → 킥복서 → 템페스트) 새 스킬·융합 연출 (docs/specs/skill-tree-all.md)
// 그림은 새로 뽑지 않고 파이터 계열 시트를 다시 짠다 (코드는 위치·개수·궤적·크기·타이밍·색만):
//  선풍 회오리 = XE09 회오리 기둥이 기사 둘레를 돈다(+XE08 띠) · 뇌정 관통각 = 웅크려 XE09 를 모았다가 잔상 발차기들이 XE07 쐐기 줄을 깔며 화면 끝까지 ·
//  풍인각 = XW3A 발차기 호가 나선으로 흔들리며 날아간다 · 폭풍 돌려차기 = XE07 쐐기 방사 + 양옆으로 퍼지는 XE08 띠 + 중심 기둥 · 융합 = 두 부모 연출 이어 붙이기.
// 모습(칸마다): a.mast 0~3 — 개수·크기·금빛이 오른다. 변형은 내 기사만 (t7Sh). 이 파일은 tree7-fx.js 뒤에 불러온다.

(function () {
  const pick = (arr, m) => arr[Math.max(0, Math.min(3, m || 0))];

  // 한 줄기: (x,y) 에서 ang 방향으로 dist 만큼 날아가는 시트. 왼쪽으로 가도 그림이 뒤집혀 서 있게 (flip + 회전 π). wob: 옆으로 흔들리는 폭 (나선)
  function ray(id, x, y, ang, dist, o = {}) {
    const c = Math.cos(ang), s = Math.sin(ang), left = c < 0, nf = VFX_SHEETS[id] ? VFX_SHEETS[id].frames : 1;
    skFx(null, o.delay || 0, o.life || 0.32, (u) => {
      for (let k = 0; k < (o.trail || 1); k++) {
        const uu = u - k * 0.07;
        if (uu < 0) continue;
        const e = easeOut(uu), w = o.wob ? Math.sin(uu * 9 + (o.ph || 0)) * o.wob : 0;
        vfxDraw(ctx, id, o.color, o.f != null ? o.f : Math.min(nf - 1, Math.floor(u * nf)), x + c * dist * e - s * w, y + s * dist * e + c * w,
          { scale: o.scale || 2 / 3, flip: left, rot: ang + (left ? Math.PI : 0), alpha: (u > 0.7 ? (1 - u) / 0.3 : 1) * [1, 0.45, 0.2][k] * (o.alpha == null ? 1 : o.alpha) });
      }
    });
  }
  // 화면 끝까지 한 줄: XE07 바람 쐐기를 앞으로 이어 깐다 (뇌정이라 토막마다 위아래·기울기가 조금씩 어긋난다)
  function row(a, y, o = {}) {
    const d = a.dir, sc = o.scale || 1, step = o.step || 44 * sc, x0 = a.x() + d * 30;
    for (let j = 0; ; j++) {
      const x = x0 + d * j * step;
      if (x < 0 || x > W) break;
      texFx('xe07', x, y + (j % 2 ? 3 : -3), o.color || a.color, { scale: sc, life: 0.26, delay: (o.delay || 0) + j * 0.018, flip: d < 0, rot: (j % 2 ? 0.06 : -0.06) * d, alpha: o.alpha, fade: 0.4 });
    }
  }
  // 발차기 잔상 몇 개를 길 위에 깐다 (지금 자세 그대로, 투명하게)
  function ghosts(a, n, tint, alpha) {
    const p = { ...(castPose(a.owner) || {}), dx: 0 }, span = Math.min(Math.abs(a.tx() - a.x()) + 90, a.dir > 0 ? W - a.x() : a.x());
    for (let q = 1; q <= n; q++) skLater(a, (q - 1) * 0.04, () => ghostFx(a, a.x() + a.dir * span * (q / (n + 1)), a.dir, tint, 0.28, p, alpha));
  }
  // 다리 호 한 번: XW3A 프레임 f (0 앞차기 · 1 돌려차기)
  const kickArc = (a, x, y, f, sc, life) => skFx(null, 0, life, (u) => vfxDraw(ctx, 'xw3a', a.color, f, x, y, { scale: sc, flip: a.dir < 0, sx: 1 + 0.3 * u, alpha: u > 0.6 ? (1 - u) / 0.4 : 1 }));

  // ── 선풍 회오리 (whirl) ── 회오리 기둥(XE09)이 기사 둘레를 돈다: 1칸 하나 · ★ 둘 · ★★ 둘 크게 · ★★★ 셋 + 띠(XE08). 타격마다 다리 호(XW3A)가 휙
  //  제자리 태풍(grow): 한 단계 커져 제자리 · 쫓는 바람(follow): 기둥이 대상에게 날아가 붙는다
  const whirl = {
    ...SKILL_FX.spinKick,
    cues: (a) => [[0.01, (a) => {
      const m = a.mast || 0, grow = t7Sh(a, 'grow'), follow = t7Sh(a, 'follow'), n = pick([1, 2, 2, 3], m);
      const ps = grow ? 4 / 3 : pick([2 / 3, 2 / 3, 1, 1], m), bs = pick(grow ? [1, 1, 4 / 3, 4 / 3] : [2 / 3, 1, 1, 4 / 3], m), R = pick([26, 30, 34, 38], m) * (grow ? 1.6 : 1);
      aFx(a, 0, a.k.dur, (u) => {
        const gy = groundY(), cx = follow ? mix(a.x(), a.tx(), easeOut(Math.min(1, u / 0.35))) : a.x(), fade = Math.min(1, u / 0.1, (1 - u) / 0.15);
        vfxDraw(ctx, 'xe08', a.color, Math.floor(clock * 14) % 5, cx, gy - 14, { scale: bs, flip: Math.floor(clock * 6) % 2 === 1, alpha: 0.6 * fade });
        for (let j = 0; j < n; j++) {
          const th = clock * 8 + (j * Math.PI * 2) / n, front = Math.sin(th) > 0;
          vfxDraw(ctx, 'xe09', a.color, Math.floor(clock * 12 + j) % 6, cx + Math.cos(th) * R, gy + 2 + (front ? 2 : -2), { anchor: 'b', scale: ps, flip: j % 2 === 1, alpha: (front ? 0.95 : 0.55) * fade });
        }
      });
    }]],
    hit(a, i) { kickArc(a, a.x() + a.dir * 12, groundY() - 22, i % 2, (a.mast || 0) >= 2 ? 1 : 2 / 3, 0.2); },
    hitTex(a, t, share, i, n) {
      texFx('xh5', t.x + rand(-6, 6), t.y + rand(-8, 6), a.color, { scale: (a.mast || 0) >= 2 ? 1 : 2 / 3, life: 0.2, rot: rand(0, Math.PI * 2), fade: 0.3 });
      if (i === n - 1) qiHitTex('xk05', a, t, a.mast >= 2);
    },
  };
  SKILL_FX['tp_whirl'] = whirl;

  // ── 뇌정 관통각 (flash) ── 웅크려 회오리(XE09)를 모았다가 → 마지막 타에 잔상 발차기들이 XE07 쐐기 줄을 깔며 화면 끝까지 지나간다
  //  ★★ 부터 대상 자리에 기둥 · ★★★ 줄이 굵다. 잔상 발차기(after): 0.5초 뒤 흐린 줄 한 번 더 · 삼중 관통각(triple): 위·가운데·아래 세 줄
  const flash = {
    ...SKILL_FX.flyingKick,
    cues: (a) => [[0.02, (a) => {
      const T = Math.max(0.2, a.k.hits[0][0] * a.k.dur - 0.05);
      aFx(a, 0, T, (u) => vfxDraw(ctx, 'xe09', a.color, Math.floor(clock * 12) % 6, a.px(), groundY() + 2, { anchor: 'b', scale: 2 / 3, alpha: Math.min(1, u * 3) * 0.8 * Math.min(1, (1 - u) / 0.2) }));
    }]],
    hitTex(a, t) { texFx('xh5', t.x, t.y, a.color, { scale: (a.mast || 0) >= 2 ? 1 : 2 / 3, life: 0.22, rot: rand(-0.4, 0.4), fade: 0.3 }); },
    hit(a, i, n) {
      const tri = t7Sh(a, 'triple');
      if (i !== n - 1 && !tri) return;
      if (tri && i % 3) return;
      const y = a.ty(), m = a.mast || 0;
      if (tri) for (const dy of [-14, 0, 14]) row(a, y + dy, { scale: 2 / 3, step: 30 });
      else row(a, y, { scale: m >= 3 ? 4 / 3 : 1 });
      ghosts(a, tri ? 2 : 4, a.color, 0.4);
      if (m >= 2) texFx('xe09', a.tx(), groundY() + 2, a.color, { anchor: 'b', life: 0.5, scale: m >= 3 ? 1 : 2 / 3, fade: 0.3 });
      if (t7Sh(a, 'after') && i === n - 1) row(a, y + 3, { delay: 0.5, alpha: 0.55, color: '#9ec0d0', scale: m >= 3 ? 4 / 3 : 1 });
      impact({ stop: 0.08, shake: 0.25 });
    },
  };
  SKILL_FX['tp_flash'] = flash;

  // ── 풍인각 (wave) ── 발차기 호(XW3A, 앞차기·돌려차기가 번갈아)가 나선으로 흔들리며 날아간다: 1칸 1발 · ★ 3발 · ★★ 5발 · ★★★ 7발 금빛. 관통(k_pierce)이면 더 멀리
  SKILL_FX['tp_wave'] = {
    ...SKILL_FX.flyingKick,
    cues: () => [],
    hit(a, i) {
      if (i) return;
      const m = a.mast || 0, n = pick([1, 3, 5, 7], m), d = a.dir, h = qiHand(a), dist = t7Sh(a, 'pierce') ? 300 : 170, y0 = Math.min(h.y, groundY() - 20);
      for (let j = 0; j < n; j++) {
        const c = j - (n - 1) / 2, t = c * 0.1 - 0.03;
        ray('xw3a', h.x + d * 10, y0, d > 0 ? t : Math.PI - t, dist, { delay: j * 0.03, scale: m >= 2 ? 1 : 2 / 3, life: 0.36, color: a.color, f: j % 2, wob: 6, ph: j * 1.3, trail: 3 });
      }
      impact({ shake: 0.1 });
    },
    hitTex(a, t) { qiHitTex('xh5', a, t, false, { life: 0.18 }); },
  };

  // ── 폭풍 돌려차기 (storm) ── 돌며 XE07 바람 쐐기가 사방으로 · 양옆으로 XE08 띠가 퍼지고 · ★★ 부터 가운데 기둥(XE09): 1칸 4방향 · ★ 8방향 · ★★ 8방향 크게 · ★★★ 12방향 금빛
  //  분열(k_split): 맞은 자리에서 쐐기가 두 갈래
  SKILL_FX['tp_storm'] = {
    ...SKILL_FX.spinKick,
    cues: () => [],
    hit(a, i) {
      const cx = a.x(), cy = groundY() - 26, m = a.mast || 0;
      if (i) { texFx('xe08', cx, groundY() - 12, a.color, { scale: 2 / 3, life: 0.22, flip: i % 2 === 1, alpha: 0.7 }); return; }
      const n = pick([4, 8, 8, 12], m), dist = t7Sh(a, 'pierce') ? 150 : 120;
      for (let j = 0; j < n; j++) ray('xe07', cx, cy, (j / n) * Math.PI * 2 + 0.2, dist, { scale: m >= 2 ? 1 : 2 / 3, life: 0.36, color: a.color });
      [2 / 3, 1, 4 / 3].forEach((sc, k) => { for (const s of [-1, 1]) texFx('xe08', cx, groundY() - 12, a.color, { scale: sc, life: 0.32, delay: k * 0.07, flip: s < 0, alpha: 0.8, move: (u) => [s * 70 * easeOut(u), 0] }); });
      if (m >= 2) texFx('xe09', cx, groundY() + 2, a.color, { anchor: 'b', life: 0.5, scale: m >= 3 ? 1 : 2 / 3, fade: 0.3 });
      qiDust(a, 8);
      impact({ stop: 0.05, shake: 0.2 });
    },
    hitTex(a, t) {
      texFx('xh5', t.x, t.y, a.color, { scale: 2 / 3, life: 0.2, rot: rand(-0.6, 0.6), fade: 0.4 });
      if (t7Sh(a, 'split')) for (const s of [-1, 1]) ray('xe07', t.x, t.y, s * 0.6 + (a.dir > 0 ? 0 : Math.PI), 60, { scale: 2 / 3, life: 0.25, color: a.color });
    },
  };

  // ── 융합 ──
  // 선풍 돌진각: 회전 발차기(띠 XE08, ★★★ 기둥) 그대로 → 마지막 타에 돌진 발차기: 앞으로 XE07 쐐기 길 + 잔상 셋
  SKILL_FX['tp_f_ab'] = {
    ...SKILL_FX.spinKick,
    hit(a, i, n) {
      SKILL_FX.spinKick.hit(a, i, n);
      if (i !== n - 1) return;
      qiFrontTex('xe07', a, 0.28, { off: 8, len: 70, scale: 4 / 3 });
      row(a, a.ty(), { scale: 2 / 3, step: 32 });
      ghosts(a, 3, a.color, 0.4);
      impact({ stop: 0.1, shake: 0.3 });
    },
  };
  // 뇌풍 관통각: 뇌정 관통각이 지나간 줄에 풍인(XW3A 호)이 남았다가 차례로 터진다 (XK04)
  SKILL_FX['tp_f_bk'] = {
    ...flash,
    hit(a, i, n) {
      flash.hit(a, i, n);
      if (i !== n - 1) return;
      const y = a.ty(), d = a.dir;
      for (let j = 1; j <= 6; j++) {
        const x = a.x() + d * (40 + j * 58);
        if (x < 0 || x > W) break;
        texFx('xw3a', x, y, a.color, { scale: 2 / 3, life: 0.26, delay: 0.1 + j * 0.06, flip: d < 0, frames: 2, fade: 0.4, rot: rand(-0.5, 0.5) });
        texFx('xk04', x, y + 4, a.color, { scale: 2 / 3, life: 0.24, delay: 0.22 + j * 0.06, fade: 0.4 });
      }
    },
  };
  // 칼바람 선풍각: 선풍 회오리가 도는 동안 타격마다 풍인이 사방으로 흩뿌려진다
  SKILL_FX['tp_f_ak'] = {
    ...whirl,
    hit(a, i, n) {
      whirl.hit(a, i, n);
      for (let j = 0; j < 2 + (a.mast || 0); j++) ray('xw3a', a.x(), groundY() - 26, rand(0, Math.PI * 2), 90, { scale: 2 / 3, life: 0.3, color: a.color, f: j % 2, trail: 2 });
    },
  };
})();
