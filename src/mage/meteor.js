'use strict';
// 메테오 연출 (pyromancer). 수치·단계는 src/classes.js 의 SKILLS.meteor
//  Lv1 「불덩이 낙하」 지팡이를 들면 하늘에서 작은 불덩이 하나가 비스듬히 떨어져 톡 튄다
//  ★ 「메테오」 용암이 갈라진 운석이 불꼬리를 길게 끌며 내리꽂히고 — 불꽃이 위로 솟구치며 땅이 그을린다
//  ★★ 「유성우」 운석 셋이 차례로 떨어진다 — 떨어진 자리마다 땅에 불길이 남아 일렁인다
//  ★★★ 「겁화 운석」 땅에 커지는 그림자와 열기 고리가 먼저 깔리고, 하늘 끝에서 거대한 운석이 천천히 다가오다 내리꽂힌다
//                   — 섬광 돔·땅을 훑는 충격파 두 번, 사방으로 튄 용암 덩이가 떨어진 자리에 웅덩이로 남는다

// 불 색: Lv1·★ 은 직업색처럼 회색빛으로 바래고, ★★★ 는 금빛이 살짝 섞인다
const MT_FIRE = { core: '#fff4c8', hot: '#ffd257', mid: '#ff7a2a', deep: '#d2381a', dark: '#6a1e10', rock: '#3a2420', rockLit: '#6a3a26' };
function mtPal(a) {
  const m = a.mast || 0, out = {};
  for (const key in MT_FIRE) {
    let c = MT_FIRE[key];
    if (m < 2) c = mixHex(c, MASTERY_FADE[0], MASTERY_FADE[1 + m] * 0.8);
    else if (m >= 3 && key !== 'rock') c = mixHex(c, MASTERY_GOLD, 0.15);
    out[key] = c;
  }
  out.ramp = mgA(a, 'fire');          // 텍스처 램프 (src/vfx-mage.js)
  return out;
}
// 고정 난수: 운석 표면 무늬가 매 프레임 바뀌지 않게
const mtHash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };

// 자세 키프레임 [[u, {bowA, pull, dx, lift, skew, sy}]] 사이를 부드럽게 잇는다
function mtKeys(u, keys) {
  let i = 0;
  while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
  const [u0, p0] = keys[i], [u1, p1] = keys[i + 1];
  let s = clamp01((u - u0) / Math.max(1e-4, u1 - u0));
  s = s * s * (3 - 2 * s);
  const out = {};
  for (const [key, d] of [['bowA', 0], ['pull', 0], ['dx', 0], ['lift', 0], ['skew', 0], ['sy', 1]]) out[key] = mix(p0[key] ?? d, p1[key] ?? d, s);
  return out;
}
// 지팡이를 하늘로 세워(bowA -0.2 가 거의 수직) 불러내고, 떨어지는 순간 적을 향해 내리긋는다
const MT_POSE = [
  [[0, {}], [0.3, { bowA: -0.24, pull: 10, lift: 1 }], [0.6, { bowA: -0.25, pull: 12, lift: 1 }], [0.68, { bowA: 0.61, pull: 0, skew: 0.08, dx: 1 }], [1, {}]],
  [[0, {}], [0.25, { bowA: -0.29, pull: 13, sy: 1.05, lift: 2 }], [0.64, { bowA: -0.27, pull: 13, lift: 2, sy: 1.05 }], [0.72, { bowA: 0.76, pull: 0, skew: 0.12, dx: 2, sy: 0.94 }], [1, {}]],
  [[0, {}], [0.2, { bowA: -0.31, pull: 13, lift: 2 }], [0.5, { bowA: -0.29, pull: 13, lift: 2 }], [0.56, { bowA: 0.55, pull: 6, skew: 0.06 }], [0.62, { bowA: -0.24, pull: 10, lift: 1 }],
    [0.69, { bowA: 0.55, pull: 6, skew: 0.08 }], [0.74, { bowA: -0.25, pull: 11, lift: 1 }], [0.81, { bowA: 0.78, pull: 0, skew: 0.14, dx: 2, sy: 0.94 }], [1, {}]],
  [[0, {}], [0.15, { bowA: -0.36, pull: 13, lift: 4, sy: 1.06 }], [0.62, { bowA: -0.39, pull: 13, lift: 8, sy: 1.07, skew: -0.08 }], [0.73, { bowA: 0.84, pull: 0, lift: 2, skew: 0.16, dx: 3, sy: 0.9 }],
    [0.87, { bowA: 0.71, sy: 0.94, skew: 0.1, dx: 2 }], [1, {}]],
];

// 운석 한 덩이: 격자 도트로 그린 바위 + 갈라진 틈의 용암 + 떨어지는 쪽(앞아래) 가장자리가 달아올라 빛난다
function mtRock(x, y, R, rot, pal, dir, alpha = 1) {
  // E33 운석 (불꼬리가 왼쪽 위, 오른쪽 아래로 떨어지는 그림). 반지름 R 에 맞는 배율로, 왼쪽으로 떨어지면 좌우 반전
  const sc = R <= 5 ? 2 / 3 : R <= 11 ? 1 : R <= 18 ? 4 / 3 : 2;
  vfxDraw(ctx, 'e33', pal.ramp, mgLoop('e33', 12), x, y, { scale: sc, flip: dir < 0, alpha });
}
// 운석 낙하: (x0, y0) → (x1, y1), 갈수록 빨라진다. 지나간 자리에 가늘어지는 불꼬리와 불티
function mtFallFx(a, x0, y0, x1, y1, R, life, opt = {}) {
  const pal = mtPal(a);
  const ease = (u) => (opt.slow ? easeIn(u) * 0.65 + u * 0.35 : u * u * 0.5 + u * 0.5);
  const at = (u) => { const e = ease(u); return [mix(x0, x1, e), mix(y0, y1, e)]; };
  const rad = (u) => (opt.grow ? R * mix(opt.grow, 1, ease(u)) : R);    // 다가올수록 커 보인다 (배율은 계단)
  aFx(a, 0, life, (u) => {
    const [x, y] = at(u);
    // 불꼬리는 E33 시트에 그려져 있다. 낙하 방향과 시트의 기본 각도(45°) 차이만큼 돌린다
    const ang = Math.atan2(y1 - y0, Math.abs(x1 - x0)) - Math.PI / 4;
    vfxDraw(ctx, 'e33', pal.ramp, mgLoop('e33', 12), x, y, { scale: rad(u) <= 5 ? 2 / 3 : rad(u) <= 11 ? 1 : rad(u) <= 18 ? 4 / 3 : 2, flip: x1 < x0, rot: x1 < x0 ? -ang : ang });
  }, opt.onLand, (u) => {
    const [x, y] = at(u), n = Math.max(1, Math.round(R / 6));
    for (let i = 0; i < n; i++) {
      parts.push({ x: x + rand(-R, R) * 0.6, y: y + rand(-R, R) * 0.6, vx: (x0 - x1) * rand(0.2, 0.6) + rand(-20, 20), vy: (y0 - y1) * rand(0.1, 0.3) + rand(-30, 0), g: -40,
        size: 2, color: [pal.hot, pal.mid, pal.core][i % 3], life: rand(0.2, 0.4), t: 0, add: true });
    }
  });
}
// 떨어진 자리: 그을린 자국(어두운 타원) 위에 식어 가는 붉은 테두리
function mtScorch(a, x, w, life) {
  // 떨어진 자리: C3 바닥 고리가 불빛 램프로 퍼졌다가 식는다 (그을린 자국)
  const pal = mtPal(a);
  backFx(a, 0, life, (u) => {
    vfxDraw(ctx, 'c3', pal.ramp, Math.min(4, Math.floor(u * 6)), x, groundY() + 1, { scale: w >= 14 ? 1 : 2 / 3, anchor: 'b', alpha: (u > 0.6 ? (1 - u) / 0.4 : 1) * 0.8 });
  });
}
// 불꽃 혀: 땅에서 일렁이며 솟는 도트 불꽃 (ox 칸마다 높이가 따로 출렁인다). 땅불·분출에 함께 쓴다
function mtFlames(x, gy, halfW, h, k, pal, seed) {
  // F16 불바다 시트의 한 토막(폭 halfW×2)을 땅에 세운다. 높이 h 에 맞는 배율, 세기 k 로 흐려진다
  if (k <= 0.02) return;
  const s = VFX_SHEETS.f16;
  if (!s || !s.lv) return;
  const sc = h <= 18 ? 2 / 3 : h <= 30 ? 1 : 4 / 3, wDots = (halfW * 2) / (sc * VFX_DOT), u0 = mgHash(Math.round(seed * 10)) * Math.max(0, 1 - wDots / s.fw);
  vfxDraw(ctx, 'f16', pal.ramp, mgLoop('f16', 10, seed), x, gy + 1, { scale: sc, anchor: 'b', crop: [u0, Math.min(1, u0 + wDots / s.fw)], alpha: Math.min(1, k * 1.5) });
}
// 땅에 남는 불길 (★★ 유성우)
function mtGroundFireFx(a, x, halfW, life) {
  const pal = mtPal(a), seed = rand(0, 10);
  aFx(a, 0, life, (u) => {
    const k = Math.min(1, u * life / 0.12) * (u > 0.7 ? (1 - u) / 0.3 : 1);
    mtFlames(x, groundY(), halfW, 22, k, pal, seed);
  }, null, (u) => {
    if (Math.random() < 0.4) parts.push({ x: x + rand(-halfW, halfW), y: groundY() - rand(4, 14), vx: rand(-10, 10), vy: rand(-70, -35), g: -10, size: 2, color: Math.random() < 0.5 ? pal.hot : pal.mid, life: 0.4, t: 0, add: true });
  });
}
// ★ 착탄: 위로 솟는 불꽃 분출 + 옆으로 퍼지는 불꽃 파도 + 불티
function mtBlastFx(a, x, size) {
  // ★ 착탄: E34 돔 폭발(바닥에서 솟는 불·연기 반구 + 용암 웅덩이). size 1 = 1배, 0.6 = 2/3배
  const pal = mtPal(a), gy = groundY();
  mgFx(a, 'e34', x, gy + 2, pal.ramp, { scale: size >= 0.8 ? 1 : 2 / 3, life: 0.6, anchor: 'b', fade: 0.3 });
  burst(x, gy - 8, Math.round(8 * size), [pal.core, pal.hot, pal.mid], 170 * size, 2, 300);
  mtScorch(a, x, 18 * size, 1.1);
}
// ★★★ 예고: 착탄 자리에 커지는 그림자와 붉게 맥박치는 열기 고리
function mtOmenFx(a, x, life) {
  // ★★★ 예고: 착탄 자리 바닥에 C3 고리가 붉게 맥박치며 점점 빨라지고, 열기가 피어오른다
  const gy = groundY(), pal = mtPal(a);
  backFx(a, 0, life, (u) => {
    const g = easeIn(u), sp = 6 + 14 * g, f = Math.floor(clock * sp) % 5;
    vfxDraw(ctx, 'c3', pal.ramp, f, x, gy + 1, { scale: g < 0.4 ? 1 : 4 / 3, anchor: 'b', alpha: Math.min(1, u * 4) * (0.45 + 0.4 * g) });
  }, null, (u) => {
    if (Math.random() < 0.3 + u * 0.6) parts.push({ x: x + rand(-55, 55), y: gy - 2, vx: rand(-6, 6), vy: rand(-60, -25), g: -10, size: 2, color: Math.random() < 0.5 ? pal.mid : pal.deep, life: rand(0.3, 0.5), t: 0, add: true });
  });
}
// ★★★ 착탄 섬광: 땅에 반쯤 묻힌 하얀-주황 빛 돔이 부풀었다 꺼진다 (기사·대상 주변만, 하단바 전체는 덮지 않는다)
function mtDomeFx(a, x, R, life) {
  // ★★★ 착탄 섬광 = E34 돔 폭발 4/3배 (기사·대상 둘레만, 하단바 전체는 덮지 않는다)
  mgFx(a, 'e34', x, groundY() + 2, mtPal(a).ramp, { scale: 4 / 3, life, anchor: 'b', fade: 0.35 });
}
// 땅을 훑는 충격파: 양쪽으로 달려가는 불 테두리 + 그 앞에서 흙·돌이 튀어 오른다
function mtShockFx(a, x, reach, life, thick = 1) {
  // 땅을 훑는 충격파 = C3 바닥 고리 (reach 에 맞는 배율) + 앞에서 흙·돌이 튀어 오른다 (보조 파편)
  const gy = groundY(), pal = mtPal(a);
  mgFx(a, 'c3', x, gy + 1, pal.ramp, { scale: reach >= 120 ? 2 : 4 / 3, life, anchor: 'b', fade: 0.45, sy: thick < 1 ? 0.75 : 1 });
  aFx(a, 0, life, null, null, (u) => {
    if (u > 0.7 || Math.random() > 0.6) return;
    const r = 8 + reach * easeOut(u);
    for (const sd of [-1, 1]) parts.push({ x: x + sd * r, y: gy - 2, vx: sd * rand(20, 60), vy: rand(-140, -60), g: 420, size: 2, color: Math.random() < 0.5 ? '#5a3a2a' : pal.mid, life: rand(0.3, 0.5), t: 0 });
  });
}
// 용암 덩이: 포물선으로 튀었다가 땅에 떨어지면 작은 용암 웅덩이로 남아 식는다
function mtLavaFx(a, x, n, speed, puddleLife) {
  // 사방으로 튄 용암 = K23 용암 튐 시트를 둘레 몇 곳에 차례로 (떨어진 자리에 웅덩이로 식는 그림까지 시트에 있다)
  const pal = mtPal(a), gy = groundY(), k = Math.max(2, Math.round(n / 4 * fxVis));
  for (let i = 0; i < k; i++) {
    const sd = i % 2 ? 1 : -1, dx = sd * speed * rand(0.18, 0.4);
    mgFx(a, 'k23', x + dx, gy + 2, pal.ramp, { scale: 2 / 3, life: 0.5 + puddleLife * 0.4, delay: 0.08 + i * 0.07, anchor: 'b', fade: 0.4, flip: sd < 0 });
  }
}
// ★★★ 땅에 박힌 거대 운석: 갈라진 바위가 반쯤 묻혀 용암 빛을 내다가 식는다
function mtCraterFx(a, x, R, life) {
  // ★★★ 땅에 남은 자리: E34 마지막 그림(용암 웅덩이)이 남아 식고, 둘레에 불길(F16 토막)이 일렁인다
  const pal = mtPal(a), gy = groundY();
  aFx(a, 0, life, (u) => {
    const k = u > 0.7 ? (1 - u) / 0.3 : 1;
    vfxDraw(ctx, 'e34', pal.ramp, VFX_SHEETS.e34.frames - 1, x, gy + 2, { scale: 4 / 3, anchor: 'b', alpha: k });
    mtFlames(x, gy, R * 1.1, 14, k * (1 - u * 0.5), pal, 3);
  });
}

Object.assign(SKILL_FX, {
  meteor: {
    pose(u, a) { return mtKeys(u, MT_POSE[a.mast || 0] || MT_POSE[1]); },
    tick(a, u) {
      // 지팡이를 든 동안 발밑에서 불티가 피어오른다
      const m = a.mast || 0, last = a.k.hits[a.k.hits.length - 1][0];
      if (u > last || Math.random() > 0.25 + 0.15 * m) return;
      const pal = mtPal(a), x = a.px();
      parts.push({ x: x + rand(-10, 10), y: groundY() - rand(0, 6), vx: rand(-10, 10), vy: rand(-80, -40), g: -20, size: 2, color: Math.random() < 0.5 ? pal.hot : pal.mid, life: 0.4, t: 0, add: true });
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast || 0, H = a.k.hits, gy = groundY(), dir = a.dir;
      // 낙하 시간 fall 초 전에 출발해서 타격 시점에 땅에 닿는다
      const drop = (hu, fall, fn) => [Math.max(0.01, hu - fall / d), fn];
      if (m === 0) return [drop(H[0][0], 0.24, (a) => { const x = a.tx(); mtFallFx(a, x - dir * 30, -8, x, gy - 4, 4, 0.24, { tail: 5 }); })];
      if (m === 1) return [drop(H[0][0], 0.42, (a) => { const x = a.tx(); mtFallFx(a, x - dir * 95, -20, x, gy - 6, 8, 0.42, { tail: 12 }); })];
      if (m === 2) {
        const offs = [-0.45, 0.42, 0], R = a.k.radius || 70;
        return H.map((hh, j) => drop(hh[0], 0.32, (a) => {
          const x = a.tx() + offs[j] * R * dir;
          (a.mtXs || (a.mtXs = []))[j] = x;
          mtFallFx(a, x - dir * rand(60, 80), -16, x, gy - 6, j === 2 ? 10 : 7, 0.32, { tail: 10 });
        }));
      }
      const land = H[0][0];
      return [
        [0.02, (a) => mtOmenFx(a, a.tx(), land * d - 0.03)],
        [0.1, (a) => {
          const x = a.tx();
          a.mtX = x;
          mtFallFx(a, x - dir * 120, -34, x, gy - 12, 28, (land - 0.1) * d, { tail: 16, slow: true, grow: 0.5 });
          impact({ shake: 0.08 });
        }],
        [land - 0.12, (a) => impact({ shake: 0.18 })],
      ];
    },
    hit(a, i, n) {
      const m = a.mast || 0, pal = mtPal(a), gy = groundY(), last = i === n - 1;
      if (m === 0) {
        const x = a.tx();
        burst(x, gy - 4, 8, [pal.hot, pal.mid, pal.deep], 110, 2, 300);
        mtScorch(a, x, 9, 0.6);
        impact({ shake: 0.1 });
        return;
      }
      if (m === 1) {
        mtBlastFx(a, a.tx(), 1);
        impact({ stop: 0.06, shake: 0.28 });
        return;
      }
      if (m === 2) {
        const x = (a.mtXs || [])[i] != null ? a.mtXs[i] : a.tx();
        mtBlastFx(a, x, last ? 0.85 : 0.6);
        mtGroundFireFx(a, x, last ? 16 : 11, (1 - a.k.hits[i][0]) * a.k.dur + 0.45);
        impact(last ? { stop: 0.08, shake: 0.32 } : { stop: 0.025, shake: 0.14 });
        return;
      }
      const x = a.mtX != null ? a.mtX : a.tx();
      if (i === 0) {
        mtDomeFx(a, x, 78, 0.55);
        mtShockFx(a, x, 95, 0.55, 1);
        mtCraterFx(a, x, 22, (1 - a.k.hits[0][0]) * a.k.dur + 0.5);
        mtLavaFx(a, x, 14, 230, 0.9);
        burst(x, gy - 14, 30, [pal.core, pal.hot, pal.mid, '#ffffff'], 230, 3, 260);
        impact({ stop: 0.2, shake: 0.6 });
        return;
      }
      // 두 번째: 더 멀리 달리는 충격파와 함께 운석 둘레에서 용암이 한 번 더 솟구친다
      mtShockFx(a, x, 130, 0.6, 0.7);
      mtLavaFx(a, x, 10, 190, 0.7);
      for (const sd of [-1, 1]) mtBlastFx(a, x + sd * 30, 0.55);
      impact({ stop: 0.06, shake: 0.35 });
    },
    // 명중 그림 K23 (용암 튐 + 바위 조각, 바닥 기준): Lv1 앞 4프레임 2/3배, ★ 이상 전부, ★★★ 첫 타(거대 운석)만 4/3배
    hitTex(a, t, share, i, n) {
      const m = a.mast || 0, big = m >= 3 && i === 0;
      mgFx(a, 'k23', t.x + rand(-3, 3), groundY() + 2, mgA(a, 'fire'), { scale: big ? 4 / 3 : m >= 2 && i === n - 1 ? 1 : 2 / 3, life: big ? 0.5 : 0.36, frames: m ? 99 : 4, anchor: 'b', fade: 0.3, flip: a.dir < 0 });
    },
    kb: 10,
  },
});
