'use strict';
// 3차 궁극기 「종언의 겁화」 연출 (archmage). 수치·단계는 src/classes.js 의 SKILLS.apocalypse, 공통 레터박스·컷인은 src/skills.js 의 drawUltScreen.
//  Lv1 「화염 강하」 지팡이를 치켜들면 하늘이 붉게 타오르며 불타는 구름이 깔리고 — 불의 비가 하단바 전체에 비스듬히 쏟아져 땅이 불붙는다
//  ★   「종언의 겁화」 하늘에 하단바만 한 마법진이 열려 룬이 돌고 — 겁화의 운석이 하단바 곳곳에 쏟아지다가, 마지막에 거대한 운석이 떨어진다
//  ★★  「태양 붕괴」 하늘의 붉은 태양에 금이 가며 빛이 새어 나오고 — 태양이 쪼개져 불타는 조각들이 하단바 곳곳에 떨어지고, 남은 심이 한 점으로 오그라들었다 터진다
//  ★★★ 「세계의 끝」 기사 발밑에서 불길이 번져 하단바가 통째로 불바다가 되고, 불기둥이 솟는다 — 하늘이 갈라져 하얀 겁화가 쏟아지고, 하얀 불의 벽이 하단바를 끝에서 끝까지 삼킨다
// 시전 내내 이어지는 큰 그림은 시전 시작에 한 번 만든 연출(뒤 레이어 하늘·마법진·태양 / 앞 레이어 불비·운석·불바다)이 시간표대로 그리고,
// 타격 순간(hit)은 대상 자리에 떨어지는 불만 더한다.

const AP_FIRE = ['#fff0a0', '#ffb02e', '#ff5a1f', '#c0200c'];      // 불꽃 아래(심)→위(끝)
const AP_WHITE = ['#ffffff', '#fff8dc', '#ffe9a8', '#ffc45a'];     // 하얀 겁화
// 텍스처 램프 (src/vfx-mage.js): AP_FIRE → 겁화 램프(숙련 단계는 지금 시전의 fxVis 로), AP_WHITE → 하얀 겁화 램프
const AP_WHITE_RAMP = ['#7a3a10', '#e08a30', '#ffd890', '#fff6e0', '#ffffff'];
const AP_CLOUD = ['#1a0604', '#3a0c06', '#6a1a0a', '#b8401a', '#ff8a3a'];   // 불빛에 물든 구름 (C15 를 다시 칠함)
function apRamp(pal) { if (pal === AP_WHITE) return AP_WHITE_RAMP; const m = MASTERY_VIS.indexOf(fxVis); return mgRamp('inferno', m < 0 ? 3 : m); }
const bzModAp = (v, m) => ((v % m) + m) % m;
// 불바다: F16 시트를 [x0, x1] 에 이어 깐다 (배율 sc, 마지막 장은 잘라 낸다). hang 이면 위(top)에 거꾸로 매단다 (하늘의 틈에서 쏟아지는 불)
function apFireSea(x0, x1, sc, al, pal, seed = 0, top = 6, hang = false) {
  const s = VFX_SHEETS.f16;
  if (!s || !s.lv || al <= 0 || x1 <= x0) return;
  const tw = s.fw * sc * VFX_DOT, ramp = apRamp(pal), f = mgLoop('f16', 12, seed);
  for (let x = x0, j = 0; x < x1; x += tw, j++) {
    const w = Math.min(tw, x1 - x);
    vfxDraw(ctx, 'f16', ramp, (f + j) % s.frames, x + w / 2, hang ? top : groundY() + 1, { scale: sc, anchor: 'b', flipY: hang, crop: [0, w / tw], flip: j % 2 === 1, alpha: al });
  }
}
// 정해진 난수 (같은 i 는 늘 같은 값) — 프레임마다 모양이 흔들리지 않게
const apN = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function apCenter(a) {
  const t = a.targets();
  return t.length ? t.reduce((s, p) => s + p.x, 0) / t.length : a.tx();
}
const apMid = (a, pad = 60) => Math.max(pad, Math.min(W - pad, mix(a.x(), apCenter(a), 0.55)));
// 지팡이 끝(마력 구슬) 화면 위치 — 자세의 bowA·lift 를 따라간다 (world.js heroRig·drawStaff)
function apTip(a) {
  const p = castPose(a.owner) || {}, face = p.facing != null ? p.facing : a.dir;
  const ang = staffAngle(p.bowA || 0), sa = face > 0 ? ang : Math.PI - ang;
  const hx = a.px() + face * (5 * PX + Math.round((p.skew || 0) * 3 * PX)), hy = groundY() - (p.lift || 0) - HAND_Y * (p.sy || 1);
  return { x: hx + Math.cos(sa) * 32, y: hy + Math.sin(sa) * 32 };
}

// 불꽃 혀 하나 (도트): 바닥(bx, by)에서 높이 h, 폭 w. 바깥 불 → 안쪽 심 두 겹, 위로 갈수록 가늘어지며 흔들린다
function apFlame(bx, by, h, w, t, seed, al = 1, pal = AP_FIRE) {
  // 불꽃 혀 하나 = F16 불바다 시트의 좁은 토막 (폭 w×2, 높이 h 에 맞는 배율). pal: AP_FIRE(겁화 램프) | AP_WHITE(하얀 겁화)
  if (h < 2 || al <= 0) return;
  const s = VFX_SHEETS.f16;
  if (!s || !s.lv) return;
  const sc = h < 24 ? 2 / 3 : h < 44 ? 1 : h < 70 ? 4 / 3 : 2, wd = Math.max(6, w * 2) / (sc * VFX_DOT), u0 = apN(Math.round(seed) + 17) * Math.max(0, 1 - wd / s.fw);
  vfxDraw(ctx, 'f16', apRamp(pal), mgLoop('f16', 12, seed), bx, by + 1, { scale: sc, anchor: 'b', crop: [u0, Math.min(1, u0 + wd / s.fw)], alpha: al });
}
// 불타는 하늘: 하단바를 검붉게 가라앉히고, 위쪽에 아랫면이 불빛에 물든 구름이 흐른다 (뒤 레이어)
function apSky(a, dark, glow, t, rgb = '26,3,0') {
  // 불타는 하늘: 하단바를 검붉게 가라앉히고(dimBand, 궁극기라 전체 가능), 위쪽에 아랫면이 불빛에 물든 구름(C15 불구름 램프)이 흐른다
  if (dark > 0) dimBand(dark, rgb);
  if (glow <= 0) return;
  const tw = mgPx('c15', 4 / 3), scroll = bzModAp(t * 14 * -a.dir, tw);
  for (let x = -tw + scroll; x < W + tw; x += tw * 0.8) vfxDraw(ctx, 'c15', AP_CLOUD, mgLoop('c15', 5, Math.round(x)), x, 24, { scale: 4 / 3, flip: Math.round(x / tw) % 2 === 0, alpha: 0.9 * glow });
}
// 땅이 붉게 달아오른다 (불바다·불비 밑)
function apGroundGlow(x0, x1, al, hgt = 30) {
  // 땅이 달아오른다: 낮은 F16 불길을 구간에 깔아 흐리게
  if (al <= 0 || x1 <= x0) return;
  apFireSea(x0, x1, 2 / 3, al * 0.45, AP_FIRE, 9);
}
// 불덩이 하나 (운석·불방울 공용): 꼬리 칸들이 지나온 길에 줄지어 식어 간다
function apFireball(x, y, vx, vy, r, al = 1, rock = true) {
  // 불덩이: 큰 운석(rock, r > 5) = E33 운석 (반지름에 맞는 배율, 낙하 방향으로 돌림), 작은 불방울·조각 = P8 겁화탄 (진행 방향으로)
  const ang = Math.atan2(vy, vx);
  if (rock && r > 5) {
    const sc = r <= 8 ? 1 : r <= 12 ? 4 / 3 : 2, fl = vx < 0, base = Math.atan2(vy, Math.abs(vx)) - Math.PI / 4;
    vfxDraw(ctx, 'e33', apRamp(AP_FIRE), mgLoop('e33', 12), x, y, { scale: sc, flip: fl, rot: fl ? -base : base, alpha: al });
    return;
  }
  vfxDraw(ctx, 'p8', apRamp(AP_FIRE), mgLoop('p8', 15, Math.round(x)), x, y, { scale: r >= 4 ? 1 : 2 / 3, rot: ang, alpha: al });
}
// 떨어진 자리의 폭발: 불꽃 반구 + 흙 고리 + 잠깐 남는 불길
function apBlast(a, x, size, white = false) {
  // 떨어진 자리의 폭발 = E34 돔 폭발 (size 16 이하 2/3배, 26 이하 1배, 그 위 4/3배). 하얀 겁화는 흰 램프
  const ramp = apRamp(white ? AP_WHITE : AP_FIRE);
  mgFx(a, 'e34', x, groundY() + 2, ramp, { scale: size <= 16 ? 2 / 3 : size <= 26 ? 1 : 4 / 3, life: 0.55, anchor: 'b', fade: 0.35 });
  burst(x, groundY() - 4, Math.round(size * 0.3), [ramp[4], ramp[3], ramp[2], '#5a2a14'], 60 + size * 5, 2, 380);
}

// ── Lv1 화염 강하: 불타는 하늘 → 불의 비 ──
function apRainStage(a) {
  const d = a.k.dur, fin = a.k.hits[a.k.hits.length - 1][0] * d, life = d + 0.6, gy = groundY();
  const drops = [], embers = [];
  a.apRainBoost = 0;
  backFx(a, 0, life, (u) => {
    const t = u * life, ramp = easeOut(clamp01(t / 0.9)), out = 1 - segU(t, fin + 0.2, life);
    apSky(a, 0.55 * ramp * out, ramp * out, t);
    apGroundGlow(-40, W + 40, segU(t, 0.9, 1.4) * out * 0.7, 24);
  });
  aFx(a, 0, life, (u) => {
    const t = u * life, ramp = apRamp(AP_FIRE);
    // 불의 비: 비스듬히 떨어지는 작은 겁화탄(P8 2/3배)
    for (const p of drops) vfxDraw(ctx, 'p8', ramp, p.f, p.x, p.y, { scale: 2 / 3, rot: Math.atan2(p.vy, p.vx) });
    // 떨어진 자리마다 작은 불이 붙었다 사그라든다
    for (const e of embers) apFlame(e.x, gy, e.h * (1 - e.t / e.life), 4, t, e.x, 1 - e.t / e.life);
  }, null, (u, dt) => {
    const t = u * life, rate = (t < fin + 0.15 ? segU(t, 0.55, 1.1) * (40 + 40 * a.apRainBoost) : 0) * Math.max(1, W / 480);
    a.apRainBoost = Math.max(0, a.apRainBoost - dt * 2);
    for (let n = rate * dt + Math.random(); n >= 1; n--) {
      drops.push({ x: rand(-60, W + 60), y: rand(-10, 14), vx: a.dir * rand(70, 110), vy: rand(300, 380), f: Math.floor(rand(0, 3)) });
    }
    for (const p of drops) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y >= gy - 2) {
        p.dead = true;
        if (Math.random() < 0.35) embers.push({ x: p.x, h: rand(10, 16), t: 0, life: rand(0.25, 0.5) });
        if (Math.random() < 0.4) parts.push({ x: p.x, y: gy - 2, vx: rand(-50, 50), vy: rand(-90, -30), g: 360, size: 2, color: Math.random() < 0.5 ? '#ffb02e' : '#ff5a1f', life: 0.3, t: 0, add: true });
      }
    }
    for (const e of embers) e.t += dt;
    for (let i = drops.length - 1; i >= 0; i--) if (drops[i].dead) drops.splice(i, 1);
    for (let i = embers.length - 1; i >= 0; i--) if (embers[i].t >= embers[i].life) embers.splice(i, 1);
  });
}
// 대상에 쏟아지는 굵은 불방울 (비스듬히 떨어져 터진다)
function apBigDrop(a, tx, ty, r, delay, onLand) {
  const life = 0.16, x0 = tx - a.dir * 40, y0 = ty - 110;
  aFx(a, delay, life, (u) => {
    const p = easeIn(u);
    apFireball(mix(x0, tx, p), mix(y0, ty, p), tx - x0, ty - y0, r, 1, false);
  }, onLand);
}
// Lv1 마무리: 하늘이 한 번 크게 쏟아지고 하단바 땅 전체가 불붙는다
function apRainFinish(a) {
  // Lv1 마무리: 하늘이 한 번 크게 쏟아지고 하단바 땅 전체가 불붙는다 (F16 불바다를 끝에서 끝까지)
  const life = 0.8;
  a.apRainBoost = 1.5;
  aFx(a, 0, 0.15, (u) => dimBand(0.35 * (1 - u), '255,140,60'));
  aFx(a, 0, life, (u) => {
    const grow = clamp01(u * 4), fade = 1 - easeIn(segU(u, 0.35, 1));
    apFireSea(-40, W + 40, grow < 0.5 ? 2 / 3 : 1, 0.95 * fade, AP_FIRE, 1);
  });
}

// ── ★ 종언의 겁화: 하늘의 대마법진 → 운석우 → 거대 운석 ──
function apCircle(a) {
  if (!a.apC) a.apC = { X: apMid(a, 80), Y: 34, RX: Math.min(W * 0.46, 250), RY: 12 };
  return a.apC;
}
function apCircleDraw(C, open, t, al, flare) {
  // 하늘의 대마법진 = C9 바닥 마법진 시트를 크게 (×4, 납작하게). 열리는 동안 계단으로 커지고, 운석이 빠질 때 밝은 램프로 번쩍인다
  if (al <= 0 || open <= 0) return;
  const { X, Y, RX } = C, sc = open < 0.35 ? 2 : open < 0.7 ? 3 : 4;
  const ramp = flare > 0.3 ? apRamp(AP_WHITE) : apRamp(AP_FIRE);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  vfxDraw(ctx, 'c9', ramp, mgLoop('c9', 8), X, Y, { scale: sc, sx: Math.min(1.4, (RX * 2) / mgPx('c9', 4)), sy: 0.45, alpha: al * Math.min(1, open * 1.5) });
  vfxDraw(ctx, 'c9', ramp, mgLoop('c9', 10, 2), X, Y, { scale: sc / 2, flip: true, sy: 0.45, alpha: al * segU(open, 0.6, 1) });
  ctx.restore();
}
function apCircleStage(a) {
  const d = a.k.dur, hits = a.k.hits.map((h) => h[0] * d), first = hits[0], fin = hits[hits.length - 1], life = d + 0.7;
  const C = apCircle(a), gy = groundY(), rocks = [];
  let next = 0.95;
  a.apFlare = 0;
  backFx(a, 0, life, (u) => {
    const t = u * life, ramp = easeOut(clamp01(t / 0.7)), out = 1 - segU(t, fin + 0.25, life);
    apSky(a, 0.62 * ramp * out, 0.7 * ramp * out, t, '24,2,4');
    apCircleDraw(C, segU(t, 0.25, 1.05), t, out, a.apFlare);
    a.apFlare = Math.max(0, a.apFlare - 0.04);
  });
  aFx(a, 0, life, (u) => {
    const t = u * life;
    // 지팡이 끝에서 마법진까지 솟는 불줄기 = 겁화탄(P8)을 줄지어 이은 줄
    if (t > 0.2 && t < first) {
      const tp = apTip(a), k = segU(t, 0.2, 0.45), f = 1 - segU(t, first - 0.25, first), top = mix(tp.y, C.Y, k);
      if (tp.y - top > 6) mgBolt(tp.x, tp.y, tp.x, top, apRamp(AP_FIRE), { sheet: 'p8', scale: 2 / 3, jag: 0.1, alpha: f });
    }
    for (const r of rocks) {
      const p = clamp01((t - r.t0) / r.dur);
      if (p <= 0 || p >= 1) continue;
      const q = easeIn(p);
      apFireball(mix(r.x0, r.x1, q), mix(C.Y, gy - 3, q), r.x1 - r.x0, gy - C.Y, r.r);
    }
    apGroundGlow(-40, W + 40, segU(t, 1.2, 1.6) * (1 - segU(t, fin + 0.2, life)) * 0.8, 26);
  }, null, (u) => {
    const t = u * life;
    // 잔 운석: 마법진 곳곳에서 떨어져 하단바 전체에 쏟아진다 (넓은 창이면 더 자주)
    if (t >= next && t < fin - 0.1) {
      next = t + mix(0.16, 0.06, segU(t, 1.0, 1.6)) * Math.min(1, 520 / Math.max(300, W));
      const x0 = C.X + rand(-0.95, 0.95) * C.RX, x1 = Math.max(-20, Math.min(W + 20, x0 + a.dir * rand(10, 60)));
      const r = { x0, x1, t0: t, dur: rand(0.35, 0.5), r: rand(2.5, 4) };
      rocks.push(r);
      skLater(a, r.dur, () => { apBlast(a, x1, 14 + r.r * 2); impact({ shake: 0.05 }); });
    }
  });
}
// ★ 잔타: 마법진에서 대상에게 내리꽂히는 운석
function apMeteorAt(a, tx, ty, r) {
  const C = apCircle(a), x0 = tx - a.dir * 30, life = 0.14;
  a.apFlare = Math.max(a.apFlare || 0, 0.5);
  aFx(a, 0, life, (u) => { const p = easeIn(u); apFireball(mix(x0, tx, p), mix(C.Y, ty, p), tx - x0, ty - C.Y, r); }, () => apBlast(a, tx, 20));
}
// ★ 마무리: 마법진 한가운데서 거대한 운석이 빠져나와 떨어진다
function apGreatMeteor(a, life) {
  // ★ 마무리: 마법진 한가운데서 거대한 E33 운석이 빠져나와 떨어진다 (계단으로 커진다)
  const C = apCircle(a), x1 = apCenter(a), gy = groundY();
  aFx(a, 0, life, (u) => {
    a.apFlare = 1;
    const p = easeIn(u), x = mix(C.X, x1, p), y = mix(C.Y - 6, gy - 16, p), r = mix(6, 15, easeOut(u));
    apFireball(x, y, x1 - C.X, gy - C.Y, r);
  }, null, () => { if (Math.random() < 0.8) parts.push({ x: mix(C.X, x1, 0.5) + rand(-40, 40), y: rand(20, 60), vx: rand(-20, 20), vy: rand(20, 60), g: 0, size: 2, color: '#ffb02e', life: 0.4, t: 0, add: true }); });
}
function apGreatBlast(a, x) {
  // ★ 거대 운석 착탄: E34 돔 폭발 2배 + 땅 고리(C3) 2배 + 치솟는 불기둥(F16) — 흰 섬광은 α 0.55·0.15초
  const gy = groundY(), ramp = apRamp(AP_FIRE);
  aFx(a, 0, 0.15, (u) => dimBand(0.55 * (1 - u), '255,200,140'));
  mgFx(a, 'e34', x, gy + 2, ramp, { scale: 2, life: 0.9, anchor: 'b', fade: 0.35 });
  mgFx(a, 'c3', x, gy + 2, ramp, { scale: 2, life: 0.7, anchor: 'b', fade: 0.45 });
  aFx(a, 0, 0.8, (u) => { const f = 1 - easeIn(u); apFlame(x, gy, 90 * easeOut(clamp01(u * 3)) * f, 24, clock, 40, f); });
  for (let k = 0; k < 20; k++) parts.push({ x: x + rand(-20, 20), y: gy - 4, vx: rand(-300, 300), vy: rand(-280, -60), g: 420, size: 2, color: ['#ffb02e', '#ff5a1f', '#fff0a0', '#4a1a0a'][k % 4], life: rand(0.5, 0.9), t: 0, add: k % 4 !== 3 });
}

// ── ★★ 태양 붕괴: 금 간 붉은 태양 → 쪼개진 조각이 하단바에 쏟아진다 → 남은 심이 오그라들었다 터진다 ──
function apSunStage(a) {
  // ★★ 태양 붕괴 = F17 붉은 태양 (앞 프레임: 금이 가며 빛이 샌다 → 뒤 프레임: 쪼개진다). 쪼개진 조각은 E33 운석이 되어 하단바 곳곳에 떨어지고,
  //  남은 심(흰 램프 P8)이 계단으로 오그라들었다가 터진다 (apCoreNova)
  const d = a.k.dur, hits = a.k.hits.map((h) => h[0] * d), fin = hits[hits.length - 1], life = d + 0.8, gy = groundY();
  const X = apMid(a, 60), Y = 42, BREAK = 1.38, n = 9, nf = VFX_SHEETS.f17.frames;
  const frags = Array.from({ length: n }, (_, k) => {
    const mid = (k / n) * Math.PI * 2, lx = mix(-10, W + 10, (k + 0.5) / n) + rand(-20, 20);
    return { mid, lx, t1: BREAK + 0.2 + rand(0, 0.15), land: mix(BREAK + 0.6, fin - 0.15, apN(k * 3.1)), done: false };
  });
  const fragPos = (f, t) => {
    const sx = X + Math.cos(f.mid) * 22, sy = Y + Math.sin(f.mid) * 18;
    if (t < f.t1) { const s = segU(t, BREAK, f.t1); return { x: mix(X, sx, s), y: mix(Y, sy, s) }; }
    const p = segU(t, f.t1, f.land);
    return { x: mix(sx, f.lx, p), y: mix(sy, gy - 6, p * p) };
  };
  a.apCore = { X, Y };
  backFx(a, 0, life, (u) => {
    const t = u * life, ramp = easeOut(clamp01(t / 0.8)), out = 1 - segU(t, fin + 0.3, life);
    dimBand(0.72 * ramp * out, '24,2,2');
    if (t >= BREAK + 0.3) return;
    const rise = easeOut(clamp01(t / 0.6)), crack = segU(t, 0.9, BREAK);
    const f = t < BREAK ? Math.min(nf - 4, Math.floor(crack * (nf - 3))) : Math.min(nf - 1, nf - 3 + Math.floor((t - BREAK) / 0.1));
    const sc = t < BREAK && Math.floor(t * (8 + crack * 30)) % 2 ? 4 / 3 : 4 / 3;
    vfxDraw(ctx, 'f17', apRamp(AP_FIRE), f, X, mix(Y + 20, Y, rise), { scale: sc, alpha: rise * (t > BREAK ? 1 - (t - BREAK) / 0.3 : 1) });
  });
  aFx(a, 0, life, (u) => {
    const t = u * life;
    apGroundGlow(-40, W + 40, segU(t, BREAK + 0.6, BREAK + 1.0) * (1 - segU(t, fin + 0.3, life)) * 0.7, 26);
    if (t < BREAK) return;
    for (const f of frags) {
      if (f.done) continue;
      const P = fragPos(f, t), P0 = fragPos(f, t - 0.05);
      apFireball(P.x, P.y, (P.x - P0.x) || 0.1, (P.y - P0.y) || 1, t > f.t1 ? 7 : 6, 1, true);
      if (t >= f.land) { f.done = true; apBlast(a, f.lx, 24); impact({ shake: 0.12 }); }
    }
    // 남은 심: 하얗게 달아올라 계단으로 오그라든다 (4/3 → 1 → 2/3배)
    if (t >= fin) return;
    const shrink = segU(t, fin - 0.45, fin), sc = shrink < 0.33 ? 4 / 3 : shrink < 0.66 ? 1 : 2 / 3;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    vfxDraw(ctx, 'p8', apRamp(AP_WHITE), mgLoop('p8', 20), X + (Math.floor(t * 40) % 2), Y, { scale: sc, rot: t * 6 });
    ctx.restore();
    if (shrink > 0 && Math.random() < 0.6) {
      const ang = rand(0, Math.PI * 2), far = rand(60, 180);
      parts.push({ x: X + Math.cos(ang) * far, y: Y + Math.sin(ang) * far * 0.6, vx: -Math.cos(ang) * far * 3, vy: -Math.sin(ang) * far * 1.8, g: 0, size: 2, color: '#fff0a0', life: 0.3, t: 0, add: true });
    }
  });
}
// ★★ 잔타: 심에서 떨어져 나온 작은 불조각이 대상에게 꽂힌다
function apShardAt(a, tx, ty, big) {
  const C = a.apCore || { X: tx, Y: 30 }, life = 0.15;
  aFx(a, 0, life, (u) => {
    const p = easeIn(u);
    apFireball(mix(C.X, tx, p), mix(C.Y, ty, p), tx - C.X, ty - C.Y, big ? 9 : 3, 1, true);
  }, () => apBlast(a, tx, big ? 26 : 16));
}
// ★★ 마무리: 오그라든 심이 터진다 — 하단바 전체를 휩쓰는 충격파, 땅이 한꺼번에 불붙고 불티가 쏟아진다
function apCoreNova(a) {
  // ★★ 마무리: 오그라든 심이 터진다 — 하늘에서 C3 충격 고리가 하단바 끝까지 퍼지고, 땅이 한꺼번에 불붙는다 (F16 불바다). 흰 섬광 α 0.55·0.15초
  const C = a.apCore, life = 1.1, ramp = apRamp(AP_WHITE);
  aFx(a, 0, 0.15, (u) => dimBand(0.55 * (1 - u), '255,210,170'));
  aFx(a, 0, life, (u) => {
    const f = 1 - u, sc = u < 0.15 ? 2 : u < 0.35 ? 3 : 4;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    vfxDraw(ctx, 'c3', ramp, Math.min(4, Math.floor(u * 6)), C.X, C.Y + 10, { scale: sc, alpha: f });
    ctx.restore();
    apFireSea(-20, W + 20, 1, f, AP_FIRE, 5);
  });
  mgFx(a, 'f17', C.X, C.Y, apRamp(AP_FIRE), { scale: 4 / 3, life: 0.5, frames: 99, fade: 0.5 });
  for (let k = 0; k < 24; k++) parts.push({ x: C.X + rand(-6, 6), y: C.Y + rand(-6, 6), vx: rand(-360, 360), vy: rand(-160, 200), g: 220, size: 2, color: ['#ffffff', '#fff0a0', '#ffb02e', '#ff3b1f'][k % 4], life: rand(0.6, 1.1), t: 0, add: true });
}

// ── ★★★ 세계의 끝: 불바다 → 하늘이 갈라짐 → 하얀 겁화가 끝에서 끝까지 ──
function apEndStage(a) {
  // ★★★ 세계의 끝: 기사 발밑에서 불바다(F16)가 하단바 끝까지 번지고 → 하늘이 갈라져(위쪽에 거꾸로 매달린 하얀 겁화 F16) →
  //  하얀 불의 벽(K38 앞머리 + 흰 램프 F16)이 하단바를 끝에서 끝까지 삼킨다
  const d = a.k.dur, hits = a.k.hits.map((h) => h[0] * d), fin = hits[hits.length - 1], open = hits[hits.length - 2], life = d + 1.0, gy = groundY();
  const x0 = a.x(), CRACK = 1.75, wallFrom = open + 0.04;
  const startX = a.dir > 0 ? -50 : W + 50, endX = a.dir > 0 ? W + 50 : -50;
  const cx = apMid(a, 40), crack = [];
  for (let x = -20; x <= W + 20; x += 10) crack.push([x, 26]);
  const wallX = (t) => { const p = segU(t, wallFrom, fin); return mix(startX, endX, p * p * (3 - 2 * p)); };
  a.apEnd = { crack };
  backFx(a, 0, life, (u) => {
    const t = u * life, ramp = easeOut(clamp01(t / 0.8)), out = 1 - segU(t, fin + 0.4, life);
    dimBand(0.78 * ramp * out, '22,2,0');
    // 하늘의 틈: 가운데서 양끝으로 번지는 거꾸로 매달린 하얀 불길 (틈이 열리면 커진다)
    if (t > CRACK && t < fin + 0.3) {
      const grow = easeOut(segU(t, CRACK, CRACK + 0.5)), big = t > open - 0.05, fade = 1 - segU(t, fin, fin + 0.3), half = grow * (W / 2 + 40);
      apFireSea(cx - half, cx + half, big ? 1 : 2 / 3, fade, AP_WHITE, 21, 6, true);
    }
  });
  aFx(a, 0, life, (u) => {
    const t = u * life, reach = easeOut(segU(t, 0.12, 1.0)) * (W + 100), out = 1 - segU(t, fin + 0.5, life);
    const wx = wallX(t), wallOn = t > wallFrom, tall = segU(t, 1.0, 2.4);
    // 불바다: 하얀 벽이 지나간 자리는 하얀 불이 그린다
    let lo = Math.max(-40, x0 - reach), hi = Math.min(W + 40, x0 + reach);
    if (wallOn) { if (a.dir > 0) lo = Math.max(lo, wx); else hi = Math.min(hi, wx); }
    if (hi > lo) apFireSea(lo, hi, tall > 0.5 ? 4 / 3 : 1, 0.95 * out, AP_FIRE, 3);
    if (!wallOn) return;
    const fade = 1 - segU(t, fin + 0.15, life), w0 = Math.min(startX, wx), w1 = Math.max(startX, wx);
    dimSpan(w0, w1, 0.2 * fade, '255,248,230', 20);
    apFireSea(w0, w1, 4 / 3, fade * 0.85, AP_WHITE, 50);
    vfxDraw(ctx, 'k38', apRamp(AP_WHITE), mgLoop('k38', 12), wx, gy + 4, { scale: 2, anchor: 'b', flip: a.dir < 0, alpha: fade });
  }, null, (u) => {
    const t = u * life;
    if (t > 0.3 && t < fin && Math.random() < 0.6) {
      const reach = easeOut(segU(t, 0.12, 1.0)) * (W + 100);
      parts.push({ x: x0 + rand(-reach, reach), y: gy - rand(4, 20), vx: rand(-15, 15), vy: rand(-110, -40), g: -40, size: 2, color: AP_FIRE[Math.floor(rand(0, 3))], life: rand(0.5, 1), t: 0, add: true });
    }
    if (t > wallFrom && t < fin) {
      const wx = wallX(t);
      parts.push({ x: wx + rand(-10, 10), y: rand(20, gy), vx: a.dir * rand(120, 260), vy: rand(-80, 20), g: 0, size: 2, color: Math.random() < 0.6 ? '#ffffff' : '#ffe9a8', life: 0.35, t: 0, add: true });
    }
  });
}
// ★★★ 잔타: 불바다에서 대상 발밑으로 불기둥이 솟는다
function apGeyser(a, tx, big) {
  // ★★★ 잔타: 불바다에서 대상 발밑으로 불기둥(F16 좁은 토막, 크게)이 솟고 겁화탄(P8)이 위로 튄다
  const gy = groundY(), life = 0.5, hgt = big ? 120 : 80;
  aFx(a, 0, life, (u) => {
    const up = easeOut(clamp01(u * 4)), f = 1 - easeIn(u);
    apFlame(tx, gy + 2, hgt * up * (0.6 + 0.4 * f), big ? 22 : 15, clock, tx, f);
    if (u < 0.5) vfxDraw(ctx, 'p8', apRamp(AP_WHITE), mgLoop('p8', 15), tx, gy - hgt * up, { scale: big ? 4 / 3 : 1, rot: -Math.PI / 2, alpha: 1 - u * 2 });
  });
  for (let k = 0; k < 4; k++) parts.push({ x: tx + rand(-6, 6), y: gy - 10, vx: rand(-40, 40), vy: rand(-320, -180), g: 380, size: 2, color: k % 2 ? '#ffb02e' : '#fff0a0', life: rand(0.4, 0.7), t: 0, add: true });
}
// ★★★ 하늘이 열리는 순간: 틈에서 하얀 겁화가 대상마다 내리꽂힌다
function apSkyFall(a, tx) {
  // ★★★ 하늘이 열리는 순간: 틈에서 하얀 겁화탄(P8 흰 램프)이 대상마다 내리꽂혀 하얗게 터진다
  const E = a.apEnd, gy = groundY(), life = 0.18;
  const y0 = E ? E.crack[Math.max(0, Math.min(E.crack.length - 1, Math.round((tx + 20) / 10)))][1] : 26;
  aFx(a, 0, life, (u) => {
    const p = easeIn(u), y = mix(y0, gy - 6, p);
    vfxDraw(ctx, 'p8', apRamp(AP_WHITE), mgLoop('p8', 15), tx, y - 10, { scale: 4 / 3, rot: Math.PI / 2, alpha: 0.4 });
    vfxDraw(ctx, 'p8', apRamp(AP_WHITE), mgLoop('p8', 15, 1), tx, y, { scale: 2, rot: Math.PI / 2 });
  }, () => apBlast(a, tx, 30, true));
}

// 대마도사 궁극기 자세: 지팡이를 머리 위로 치켜들고 (★ 이상은 떠올라) 마력을 모았다가, 마지막에 앞으로 내리친다
function apPose(u, a) {
  const m = (a && a.mast) || 0, D = a && a.k ? a.k.dur : 2.7, t = u * D;
  const hits = a && a.k ? a.k.hits : [[0.5], [0.9]], first = hits[0][0] * D, fin = hits[hits.length - 1][0] * D;
  const up = easeOut(clamp01(t / 0.35)), hover = m ? (m >= 2 ? 8 : 5) * easeOut(segU(t, 0.2, 1.0)) + Math.sin(t * 5) * 1.2 * up : 0;
  const charge = 13 * easeOut(segU(t, 0.1, first));
  if (t < fin - 0.3) {
    const pulse = t > first ? 2 * Math.sin(t * 30) : 0;
    return { bowA: mix(0, -0.25, up), pull: Math.min(13, charge + pulse), lift: hover, sy: mix(1, 1.04, up) };
  }
  if (t < fin) {
    const w = easeOut(segU(t, fin - 0.3, fin - 0.05));
    return { bowA: mix(-0.25, -0.45, w), pull: 13, lift: hover + 2 * w, sy: 1.05, skew: -0.08 * w };
  }
  const r = easeOut(segU(t, fin, fin + 0.1));
  return { bowA: mix(-0.45, 0.65, r), pull: 13 * (1 - r), lift: hover * (1 - r * 0.6), sy: mix(1.05, 0.93, r), skew: 0.12 * r, dx: 3 * r };
}

Object.assign(SKILL_FX, {
  apocalypse: {
    pose: apPose,
    cues: (a) => {
      const m = a.mast, d = a.k.dur, fin = a.k.hits[a.k.hits.length - 1][0] * d;
      const list = [[0, m === 0 ? apRainStage : m === 1 ? apCircleStage : m === 2 ? apSunStage : apEndStage]];
      if (m === 1) list.push([(fin - 0.5) / d, (a) => apGreatMeteor(a, 0.5)]);
      return list;
    },
    hit(a, i, n) {
      const m = a.mast, last = i === n - 1, tg = a.targets(i);
      if (m === 0) {
        if (last) {
          apRainFinish(a);
          for (const t of tg) burst(t.x, t.y, 12, AP_FIRE, 200, 2, 200);
          impact({ stop: 0.2, shake: 0.55 });
          return;
        }
        a.apRainBoost = 1;
        for (const t of tg) for (let k = 0; k < 3; k++) apBigDrop(a, t.x + rand(-8, 8), t.y + rand(-6, 6), 3, k * 0.04, k ? null : () => apBlast(a, t.x, 14));
        impact({ shake: 0.18 });
        return;
      }
      if (m === 1) {
        if (last) {
          apGreatBlast(a, apCenter(a));
          impact({ stop: 0.26, shake: 0.7 });
          return;
        }
        for (const t of tg) apMeteorAt(a, t.x + rand(-6, 6), t.y + rand(-4, 4), 4);
        skLater(a, 0.14, () => impact({ shake: 0.16 }));
        return;
      }
      if (m === 2) {
        if (last) {
          apCoreNova(a);
          for (const t of tg) burst(t.x, t.y, 14, AP_FIRE, 230, 2, 120);
          impact({ stop: 0.28, shake: 0.75 });
          return;
        }
        for (const t of tg) apShardAt(a, t.x + rand(-6, 6), t.y + rand(-4, 4), i % 3 === 2);
        skLater(a, 0.15, () => impact({ shake: i % 3 === 2 ? 0.25 : 0.12 }));
        return;
      }
      // ★★★
      if (last) {
        const gy = groundY();
        aFx(a, 0, 0.15, (u) => dimBand(0.45 * (1 - u), '255,252,240'));        // 막타 섬광 α 0.45·0.15초 (마지막 그림이 보이게)
        for (const t of tg) burst(t.x, t.y, 16, AP_WHITE, 260, 2, 80);
        for (let k = 0; k < 20; k++) parts.push({ x: rand(0, W), y: gy - rand(0, 80), vx: a.dir * rand(60, 200), vy: rand(-200, -40), g: 100, size: k % 3 ? 2 : 3, color: AP_WHITE[k % 4], life: rand(0.6, 1.2), t: 0, add: true });
        impact({ stop: 0.32, shake: 0.85 });
        return;
      }
      if (i === n - 2) {
        // 하늘이 열린다
        aFx(a, 0, 0.15, (u) => dimBand(0.5 * (1 - u), '255,245,220'));
        for (const t of tg) apSkyFall(a, t.x);
        impact({ stop: 0.18, shake: 0.6 });
        return;
      }
      for (const t of tg) apGeyser(a, t.x + rand(-5, 5), i % 4 === 3);
      // 대상 말고도 불바다 곳곳에서 불기둥이 함께 솟는다
      apGeyser(a, rand(10, W - 10), false);
      impact({ shake: 0.15 });
    },
    // 명중 그림 K38 (하얀 불의 벽 충돌, 땅 기준)은 막타에만: ★★★ 2배, 그 밖 4/3배. 잔타는 떨어지는 불(운석·조각·불기둥)이 맡는다
    hitTex(a, t, share, i, n) {
      if (i < n - 1) return;
      mgFx(a, 'k38', t.x, groundY() + 4, apRamp(AP_WHITE), { scale: a.mast >= 3 ? 2 : 4 / 3, life: 0.55, anchor: 'b', fade: 0.35, flip: a.dir < 0 });
    },
    kb: 12,
  },
});
