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
function mtRock(x, y, R, rot, pal, dir) {
  const g = Math.max(2, Math.round(R / 6)), c = Math.cos(rot), s = Math.sin(rot);
  const hx = dir * 0.6, hy = 0.8;                      // 달아오른 쪽 (진행 방향)
  ctx.save();
  // 둘레의 열기
  ctx.globalCompositeOperation = 'lighter';
  const gr = ctx.createRadialGradient(x, y, R * 0.5, x, y, R * 2.2);
  gr.addColorStop(0, pal.mid + 'aa'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr; ctx.fillRect(x - R * 2.2, y - R * 2.2, R * 4.4, R * 4.4);
  ctx.globalCompositeOperation = 'source-over';
  for (let j = -R; j <= R; j += g) for (let i = -R; i <= R; i += g) {
    const d = Math.hypot(i + g / 2, j + g / 2);
    if (d > R) continue;
    const ri = Math.round((i * c - j * s) / g), rj = Math.round((i * s + j * c) / g), n = mtHash(ri, rj);
    const lit = ((i * hx + j * hy) / R + 1) / 2;   // 0 뒤쪽 ~ 1 앞쪽
    let col = n < 0.5 ? pal.rock : pal.rockLit;
    if (n > 0.82) col = pal.mid;                    // 갈라진 틈의 용암
    if (n > 0.94) col = pal.hot;
    if (d > R - g && lit > 0.55) col = lit > 0.8 ? pal.core : pal.hot;     // 달아오른 앞 가장자리
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x + i), Math.round(y + j), g, g);
  }
  ctx.restore();
}
// 운석 낙하: (x0, y0) → (x1, y1), 갈수록 빨라진다. 지나간 자리에 가늘어지는 불꼬리와 불티
function mtFallFx(a, x0, y0, x1, y1, R, life, opt = {}) {
  const pal = mtPal(a), trail = [], spin = rand(4, 8) * (a.dir || 1);
  const ease = (u) => (opt.slow ? easeIn(u) * 0.65 + u * 0.35 : u * u * 0.5 + u * 0.5);
  const at = (u) => { const e = ease(u); return [mix(x0, x1, e), mix(y0, y1, e)]; };
  const rad = (u) => (opt.grow ? R * mix(opt.grow, 1, ease(u)) : R);    // 다가올수록 커 보인다
  aFx(a, 0, life, (u) => {
    const [x, y] = at(u);
    trail.push([x, y]); if (trail.length > (opt.tail || 8)) trail.shift();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    // 불꼬리: 바깥 주황 → 안쪽 노랑, 뒤로 갈수록 가늘다
    for (const [col, wk, al] of [[pal.deep, 2.0, 0.45], [pal.mid, 1.4, 0.7], [pal.hot, 0.7, 0.9]]) {
      ctx.strokeStyle = col;
      for (let i = 1; i < trail.length; i++) {
        const k = i / trail.length;
        ctx.globalAlpha = al * k;
        ctx.lineWidth = Math.max(1, rad(u) * wk * k);
        ctx.beginPath(); ctx.moveTo(trail[i - 1][0], trail[i - 1][1]); ctx.lineTo(trail[i][0], trail[i][1]); ctx.stroke();
      }
    }
    ctx.restore();
    mtRock(x, y, Math.round(rad(u)), clock * spin, pal, a.dir);
  }, opt.onLand, (u) => {
    const [x, y] = at(u), n = Math.max(1, Math.round(R / 4));
    for (let i = 0; i < n; i++) {
      parts.push({ x: x + rand(-R, R) * 0.6, y: y + rand(-R, R) * 0.6, vx: (x0 - x1) * rand(0.2, 0.6) + rand(-20, 20), vy: (y0 - y1) * rand(0.1, 0.3) + rand(-30, 0), g: -40,
        size: Math.random() < 0.3 ? 3 : 2, color: [pal.hot, pal.mid, pal.core][i % 3], life: rand(0.2, 0.4), t: 0, add: true });
    }
  });
}
// 떨어진 자리: 그을린 자국(어두운 타원) 위에 식어 가는 붉은 테두리
function mtScorch(a, x, w, life) {
  const gy = groundY(), pal = mtPal(a);
  backFx(a, 0, life, (u) => {
    const k = u > 0.6 ? (1 - u) / 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = 0.55 * k; ctx.fillStyle = '#1a0c08';
    ctx.beginPath(); ctx.ellipse(x, gy, w, w * 0.18 + 1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.8 * k * (1 - u * 0.6); ctx.strokeStyle = pal.mid; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, gy, w * 0.8, w * 0.14 + 1, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  });
}
// 불꽃 혀: 땅에서 일렁이며 솟는 도트 불꽃 (ox 칸마다 높이가 따로 출렁인다). 땅불·분출에 함께 쓴다
function mtFlames(x, gy, halfW, h, k, pal, seed) {
  const cell = 3;
  ctx.save();
  // 불길은 보통 섞기로 칠한다 (lighter 로 겹치면 몸 위에서 하얗게 타 버린다)
  for (let ox = -halfW; ox <= halfW; ox += cell) {
    const edge = 1 - Math.abs(ox) / (halfW + cell);
    const hh = h * k * edge * (0.55 + 0.45 * Math.abs(Math.sin(clock * 11 + ox * 0.7 + seed)));
    for (let y = 0; y < hh; y += cell) {
      const v = y / Math.max(1, hh);
      ctx.globalAlpha = (1 - v * 0.7) * Math.min(1, k * 1.5);
      ctx.fillStyle = v < 0.25 ? pal.core : v < 0.5 ? pal.hot : v < 0.8 ? pal.mid : pal.deep;
      const wob = Math.round(Math.sin(clock * 15 + y * 0.3 + ox) * v * 2);
      ctx.fillRect(Math.round(x + ox + wob), Math.round(gy - y - cell), cell, cell);
    }
  }
  ctx.restore();
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
  const pal = mtPal(a), gy = groundY(), seed = rand(0, 10);
  aFx(a, 0, 0.55, (u) => {
    const k = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85;
    mtFlames(x, gy, 14 * size, 34 * size, k, pal, seed);
    // 옆으로 밀려 나가는 불꽃 둑 (양쪽)
    const spread = 10 + 34 * size * easeOut(u);
    for (const sd of [-1, 1]) mtFlames(x + sd * spread, gy, 5 * size, 12 * size, (1 - u) * 0.9, pal, seed + sd);
  });
  burst(x, gy - 8, Math.round(16 * size), [pal.core, pal.hot, pal.mid, pal.deep], 170 * size, 3, 300);
  mtScorch(a, x, 18 * size, 1.1);
}
// ★★★ 예고: 착탄 자리에 커지는 그림자와 붉게 맥박치는 열기 고리
function mtOmenFx(a, x, life) {
  const gy = groundY(), pal = mtPal(a);
  backFx(a, 0, life, (u) => {
    const g = easeIn(u), k = Math.min(1, u * 4);
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.4 * g; ctx.fillStyle = '#12060a';
    ctx.beginPath(); ctx.ellipse(x, gy, 8 + 40 * g, 2 + 6 * g, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = k * (0.4 + 0.4 * Math.abs(Math.sin(clock * (6 + 14 * g))));
    ctx.strokeStyle = pal.deep; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, gy, 60, 9, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = pal.mid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, gy, 60 * (1 - (clock * 1.5 % 1)), 9 * (1 - (clock * 1.5 % 1)), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }, null, (u) => {
    // 땅에서 열기가 피어오른다 (운석이 가까울수록 많이)
    if (Math.random() < 0.3 + u * 0.6) parts.push({ x: x + rand(-55, 55), y: gy - 2, vx: rand(-6, 6), vy: rand(-60, -25), g: -10, size: 2, color: Math.random() < 0.5 ? pal.mid : pal.deep, life: rand(0.3, 0.5), t: 0, add: true });
  });
}
// ★★★ 착탄 섬광: 땅에 반쯤 묻힌 하얀-주황 빛 돔이 부풀었다 꺼진다 (기사·대상 주변만, 하단바 전체는 덮지 않는다)
function mtDomeFx(a, x, R, life) {
  const gy = groundY(), pal = mtPal(a);
  aFx(a, 0, life, (u) => {
    const r = R * (0.4 + 0.6 * easeOut(u)), k = 1 - u;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath(); ctx.rect(x - r - 2, -40, r * 2 + 4, gy + 41); ctx.clip();
    const gr = ctx.createRadialGradient(x, gy, 0, x, gy, r);
    gr.addColorStop(0, `rgba(255,255,255,${0.95 * k})`); gr.addColorStop(0.35, pal.hot); gr.addColorStop(0.7, pal.deep + '66'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = k; ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(x, gy, r, Math.PI, 0); ctx.fill();
    ctx.restore();
  });
}
// 땅을 훑는 충격파: 양쪽으로 달려가는 불 테두리 + 그 앞에서 흙·돌이 튀어 오른다
function mtShockFx(a, x, reach, life, thick = 1) {
  const gy = groundY(), pal = mtPal(a);
  aFx(a, 0, life, (u) => {
    const e = easeOut(u), r = 8 + reach * e, k = 1 - u;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = k; ctx.strokeStyle = pal.mid; ctx.lineWidth = 4 * thick * k + 1;
    ctx.beginPath(); ctx.ellipse(x, gy - 1, r, 4 + 8 * e * thick, 0, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = pal.core; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, gy - 1, r * 0.96, 3 + 6 * e * thick, 0, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = k * 0.8; ctx.strokeStyle = pal.deep; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, gy, r, 3 + 3 * e, 0, 0, Math.PI); ctx.stroke();
    ctx.restore();
  }, null, (u) => {
    if (u > 0.7 || Math.random() > 0.8) return;
    const r = 8 + reach * easeOut(u);
    for (const sd of [-1, 1]) parts.push({ x: x + sd * r, y: gy - 2, vx: sd * rand(20, 60), vy: rand(-140, -60), g: 420, size: Math.random() < 0.3 ? 3 : 2, color: Math.random() < 0.5 ? '#5a3a2a' : pal.mid, life: rand(0.3, 0.5), t: 0 });
  });
}
// 용암 덩이: 포물선으로 튀었다가 땅에 떨어지면 작은 용암 웅덩이로 남아 식는다
function mtLavaFx(a, x, n, speed, puddleLife) {
  const pal = mtPal(a), gy = groundY(), blobs = [];
  n = Math.max(3, Math.round(n * fxVis));
  for (let i = 0; i < n; i++) {
    const an = -Math.PI / 2 + rand(-1.25, 1.25), v = speed * rand(0.5, 1);
    blobs.push({ x, y: gy - 6, vx: Math.cos(an) * v, vy: Math.sin(an) * v, s: Math.random() < 0.35 ? 4 : 3, land: -1 });
  }
  let last = 0;
  const life = 1.2 + puddleLife;
  aFx(a, 0, life, (u) => {
    const t = u * life, dt = Math.max(0, t - last); last = t;
    ctx.save();
    for (const b of blobs) {
      if (b.land < 0) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 400 * dt;
        if (b.y >= gy - 1 && b.vy > 0) { b.y = gy - 1; b.land = t; }
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1;
        ctx.fillStyle = pal.hot; ctx.fillRect(Math.round(b.x - b.s / 2), Math.round(b.y - b.s / 2), b.s, b.s);
        ctx.fillStyle = pal.core; ctx.fillRect(Math.round(b.x - 1), Math.round(b.y - 1), 1, 1);
        ctx.globalAlpha = 0.5; ctx.fillStyle = pal.mid;
        ctx.fillRect(Math.round(b.x - b.vx * 0.02 - 1), Math.round(b.y - b.vy * 0.02 - 1), 2, 2);
        continue;
      }
      // 웅덩이: 납작하게 퍼졌다가 붉게 식는다
      const v = clamp01((t - b.land) / puddleLife);
      if (v >= 1) continue;
      const w = b.s + 3 * easeOut(Math.min(1, v * 5));
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1 - v;
      ctx.fillStyle = v < 0.4 ? pal.hot : v < 0.75 ? pal.mid : pal.deep;
      ctx.fillRect(Math.round(b.x - w), Math.round(gy - 2), Math.round(w * 2), 2);
      if (v < 0.5) { ctx.fillStyle = pal.core; ctx.fillRect(Math.round(b.x - 1), Math.round(gy - 2), 2, 1); }
    }
    ctx.restore();
  });
}
// ★★★ 땅에 박힌 거대 운석: 갈라진 바위가 반쯤 묻혀 용암 빛을 내다가 식는다
function mtCraterFx(a, x, R, life) {
  const pal = mtPal(a), gy = groundY();
  aFx(a, 0, life, (u) => {
    const k = u > 0.7 ? (1 - u) / 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.beginPath(); ctx.rect(x - R * 2, gy - R * 2, R * 4, R * 2); ctx.clip();      // 땅 위만
    mtRock(x, gy + R * 0.35, R, 0.3, { ...pal, rockLit: u < 0.5 ? pal.deep : pal.rockLit }, 0);
    ctx.restore();
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
    // 맞은 자리에 불씨가 잠깐 붙어 탄다 (화살 긁힌 자국 대신)
    marks(a, t, pow) {
      const pal = mtPal(a), x = t.x + rand(-5, 5), y = t.y + rand(-4, 8), seed = rand(0, 9);
      aFx(a, 0, 0.35, (u) => mtFlames(x, y, 3 + Math.min(4, pow * 2), 8 + 3 * Math.min(2, pow), 1 - u, pal, seed));
    },
    kb: 10,
  },
});
