'use strict';
// 3차 궁극기 「천마군단」 연출 (skyGeneral — 천마장군). 수치·단계는 src/classes.js 의 SKILLS.cavalryLegion, 레터박스·컷인은 src/skills.js 의 drawUltScreen.
//  Lv1 「천마 돌격」 빛의 천마를 타고 하단바를 끝까지 가로질러 돌격하고, 뒤따라 충격파가 땅을 쓸고 간다
//  ★ 「천마군단」 하늘에서 빛의 기병대가 줄지어 내려와 기사와 함께 하단바를 가로지른다
//  ★★ 「천공 기병대」 기병대가 하늘을 날며 창을 내리꽂고, 빛의 창이 비처럼 하단바에 쏟아진다
//  ★★★ 「신성 군단의 진격」 하단바 전체가 황금빛으로 물들고 거대한 천마 군단의 그림자가 지나가며 — 마지막 창 한 자루가 땅에 박혀 모두 띄운다
// 랜서의 cvHorseFx(빛의 천마)·cvDust 를 다시 쓴다 (src/jobs/cavalier.js)
// 그림은 PixelLab 시트 (src/vfx-spear.js): 빛의 기병 E23r · 천마 E23 · 창비 W7a · 군단 그림자 F11 · 명중 K34

const LG_COL = { main: '#cfe8ff', gold: '#ffd257', hot: '#ffffff', rgb: '207,232,255' };
const lgDur = (a) => (a.k ? a.k.dur : 2.8);
const lgHitT = (a) => (a.k ? a.k.hits.map((h) => h[0] * a.k.dur) : [1.3, 2.5]);
const lgEnv = (t, from, to, fin, fout) => Math.min(clamp01((t - from) / fin), clamp01((to - t) / fout));
const lgBase = () => groundY() - 7;

function lgSky(a, life, dim, gold, color = '4,8,24') {
  backFx(a, 0, life, (u) => {
    const t = u * life, k = lgEnv(t, 0.15, life - 0.15, 0.4, 0.3);
    dimBand(dim * k, color);
    if (gold > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = gold * k;
      const g = ctx.createLinearGradient(0, 0, 0, groundY());
      g.addColorStop(0, 'rgba(255,210,87,0.5)'); g.addColorStop(1, 'rgba(255,210,87,0)');
      ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, groundY() + 20);
      ctx.restore();
    }
  });
}
// 빛의 기병 하나(E23r: 말 + 창 든 기수): (x, y) 발밑, d 방향, 크기 s, 질주 프레임은 ph 로 엇갈린다
function lgRider(x, y, d, s, al, ph) {
  vfxDraw(ctx, 'e23r', LG_COL.main, Math.floor(ph) % 5, x, y + 2, { anchor: 'b', scale: s >= 1 ? 1 : 2 / 3, flip: d < 0, alpha: al });
}
// ★ 하늘에서 내려와 하단바를 가로지르는 기병대 n 기 (from 초부터, run 초 동안 끝까지)
function lgLegionFx(a, life, from, run, n, fly = false) {
  const d = a.dir, riders = [];
  for (let i = 0; i < n; i++) riders.push({ delay: i * 0.08, y: fly ? 30 + (i % 3) * 22 : lgBase() - 2 - (i % 2) * 6, s: fly ? 0.7 : 0.8 + (i % 2) * 0.15, ph: rand(0, 6) });
  a.lgRiders = riders;
  backFx(a, 0, life, (u) => {
    const t = u * life;
    for (const r of riders) {
      const k = clamp01((t - from - r.delay) / run);
      if (k <= 0 || k >= 1) continue;
      const x0 = d > 0 ? -40 : W + 40, x1 = d > 0 ? W + 60 : -60;
      const x = mix(x0, x1, k), drop = fly ? 0 : Math.max(0, 1 - k * 4) * 60;
      r.x = x; r.yNow = r.y - drop + Math.sin(clock * 10 + r.ph) * 2;
      lgRider(x, r.yNow, d, r.s, 0.9 * Math.min(1, k * 6) * Math.min(1, (1 - k) * 6), clock * 14 + r.ph);
    }
  }, null, (u) => {
    const t = u * life;
    for (const r of riders) { const k = clamp01((t - from - r.delay) / run); if (k > 0 && k < 1 && r.x != null && Math.random() < 0.4) parts.push({ x: r.x - d * rand(0, 20), y: (r.yNow || r.y), vx: -d * rand(40, 100), vy: rand(-40, 10), g: 0, size: 2, color: Math.random() < 0.5 ? LG_COL.main : LG_COL.gold, life: 0.3, t: 0, add: true }); }
  });
}
// 빛의 창(W7a 천마창 속도선을 세로로)이 하늘에서 떨어져 박힌다 — 박힌 뒤 짧게 남았다 사라진다
function lgLanceDrop(x, delay = 0, stick = 0.5) {
  const gy = lgBase(), x0 = x + rand(-4, 4), ang = Math.PI / 2 + rand(-0.2, 0.2), L = 40;
  const draw = (y, al) => vfxDraw(ctx, 'w7a', LG_COL.gold, 0, x0 - Math.cos(ang) * L / 2, y - Math.sin(ang) * L / 2, { rot: ang, sx: L / Math.max(1, vfxW('w7a')), alpha: al });
  skFx(null, delay, 0.12, (u) => draw(mix(-20, gy, easeIn(u)), 1), () => {
    skFx(null, 0, stick, (u) => draw(gy + 2, u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4));
    texFx('k34', x0, gy, LG_COL.gold, { anchor: 'b', scale: 2 / 3, frames: 3, life: 0.22 });
  });
}
// ★★★ 거대한 군단의 그림자: 하늘 가득 기병대 행렬(F11)이 금빛 그림자로 지나간다 (두 줄이 엇갈려)
function lgGreatLegionFx(a, life, from, run) {
  const d = a.dir, rows = [{ delay: 0, y: 70, sc: 4 / 3 }, { delay: 0.12, y: 46, sc: 1 }];
  backFx(a, 0, life, (u) => {
    const t = u * life;
    for (const r of rows) {
      const k = clamp01((t - from - r.delay) / run);
      if (k <= 0 || k >= 1) continue;
      const x = mix(d > 0 ? -200 : W + 200, d > 0 ? W + 220 : -220, k);
      vfxDraw(ctx, 'f11', LG_COL.gold, 0, x, r.y + Math.sin(clock * 6 + r.y) * 2, { anchor: 'b', scale: r.sc, flip: d < 0, alpha: 0.5 * Math.min(1, k * 5) * Math.min(1, (1 - k) * 5) });
    }
  });
}

function lgStage0(a) { lgSky(a, lgDur(a) + 0.3, 0.42, 0); }
function lgStage1(a) {
  const D = lgDur(a), ht = lgHitT(a), life = D + 0.35;
  lgSky(a, life, 0.5, 0.12);
  lgLegionFx(a, life, 0.45, ht[ht.length - 1] - 0.45 + 0.2, 6);
}
function lgStage2(a) {
  const D = lgDur(a), ht = lgHitT(a), life = D + 0.35, cx = a.tx();
  lgSky(a, life, 0.55, 0.18);
  lgLegionFx(a, life, 0.4, ht[ht.length - 1] - 0.4 + 0.2, 8, true);
  ht.slice(1, -1).forEach((t, j) => skLater(a, t - 0.12, () => { lgLanceDrop(cx + (j % 2 ? 1 : -1) * rand(10, 110)); lgLanceDrop(rand(20, W - 20), 0.03, 0.4); }));
}
function lgStage3(a) {
  const D = lgDur(a), ht = lgHitT(a), life = D + 0.4, cx = a.tx(), tf = ht[ht.length - 1];
  lgSky(a, life, 0.6, 0.35, '20,14,0');
  lgGreatLegionFx(a, life, 0.4, tf - 0.5);
  lgLegionFx(a, life, 0.5, tf - 0.6, 8);
  ht.slice(1, -2).forEach((t, j) => skLater(a, t - 0.12, () => lgLanceDrop(cx + (j % 2 ? 1 : -1) * rand(10, 140), 0, 0.4)));
}

Object.assign(SKILL_FX, {
  cavalryLegion: {
    // 창을 치켜들고(0.3) 천마가 나타나 올라탄다 → 질주(첫 타~끝에서 둘째 타, dx 가 하단바 끝까지) → 마지막 일격에 창을 내리꽂는다 → 돌아온다
    pose(u, a) {
      const D = lgDur(a), t = u * D, ht = lgHitT(a), ts = ht[0], tf = ht[ht.length - 1], m = a.mast || 0;
      const far = Math.max(120, W - 80 - a.x());
      if (t < 0.3) { const c = easeOut(t / 0.3); return { wa: mix(-1.3, -1.57, c), ext: -3 * c, sy: 1 + 0.06 * c, skew: -0.1 * c, lift: 3 * c }; }
      if (t < ts - 0.3) { const s = easeOut(segU(t, 0.3, ts - 0.3)); return { wa: mix(-1.57, 0, s), ext: mix(-3, 8, s), sy: 1.0, skew: 0.3 * s, lift: 14 * s, dx: 2 * s }; }
      if (t < tf - 0.4) { const s = easeOut(segU(t, ts - 0.3, tf - 0.4)); return { wa: Math.sin(clock * 30) * 0.03, ext: 12, sy: 0.98, skew: 0.3, lift: 14 + Math.abs(Math.sin(clock * 11)) * 3, dx: far * s }; }
      if (t < tf - 0.14) { const r = easeOut(segU(t, tf - 0.4, tf - 0.14)); return { wa: mix(0, -1.2, r), ext: 10, sy: 1.05, skew: mix(0.3, -0.15, r), lift: 14 + 30 * r, dx: far }; }
      if (t < tf) { const s = easeIn(segU(t, tf - 0.14, tf)); return { wa: mix(-1.2, 1.1, s), ext: 12, sy: mix(1.05, 0.86, s), skew: mix(-0.15, 0.4, s), lift: 44 * (1 - s), dx: far + 6 * s }; }
      const hold = Math.max(tf + 0.25, D - 0.35);
      if (t < hold) return { wa: 1.1, ext: 10, sy: 0.88, skew: 0.4, dx: far + 6 };
      const r = easeOut(segU(t, hold, D)); return { wa: mix(1.1, -1.3, r), ext: 10 * (1 - r), sy: mix(0.88, 1, r), skew: 0.4 * (1 - r), dx: (far + 6) * (1 - r) };
    },
    tick(a, u, dt) {
      const D = lgDur(a), t = u * D, ht = lgHitT(a), ts = ht[0], tf = ht[ht.length - 1];
      if (t > ts - 0.3 && t < tf - 0.4) { cvDust(a, 2); a.lgGhost = (a.lgGhost || 0) + dt; if (a.lgGhost > 0.07) { a.lgGhost = 0; cvAfterimage(a, LG_COL.gold); } }
    },
    cues: (a) => {
      const D = lgDur(a), ht = lgHitT(a), ts = ht[0], tf = ht[ht.length - 1], m = Math.min(3, a.mast || 0);
      return [
        [0, (a) => [lgStage0, lgStage1, lgStage2, lgStage3][m](a)],
        [0.3 / D, (a) => { cvHorseFx(a, tf - 0.3 + 0.2, ts - 0.3, tf - 0.4); gatherFx(a.px(), groundY() - 20, [LG_COL.main, LG_COL.gold], 3, 34); }],
        [(ts - 0.3) / D, (a) => { ringFx(a.px(), LG_COL.gold, 1.2, 0.45); impact({ shake: 0.15 }); cvLanceLight(a, tf - ts + 0.3); }],
      ];
    },
    hit(a, i, n) {
      const m = Math.min(3, a.mast || 0), last = i === n - 1, tx = a.tx(), by = lgBase();
      if (!last) {
        if (i === 0) { waveFx(a, a.px() + a.dir * 20, groundY() - 14, Math.max(160, W - a.px()), LG_COL.main, 0.6, 1.8); impact({ stop: 0.06, shake: 0.35 }); }
        else impact({ stop: 0.02, shake: 0.18 });
        return;
      }
      const x = a.px() + a.dir * 24;
      ringFx(x, LG_COL.gold, m >= 3 ? 3 : 2.2, 0.6); ringFx(x, '#ffffff', 1.2, 0.4);
      for (let gx = 10; gx < W; gx += 50) { ringFx(gx, LG_COL.main, 0.6, 0.5); if (m >= 2) lgLanceDrop(gx + rand(-10, 10), rand(0, 0.1), 0.4); }
      debris(x, 22, ['#c9b38a', LG_COL.main, LG_COL.gold], 1.8);
      texFx('k34', x + a.dir * 10, lgBase() + 6, LG_COL.gold, { anchor: 'b', scale: m >= 3 ? 2 : 4 / 3, life: 0.45, flip: a.dir < 0, fade: 0.3 });
      aFx(a, 0, 0.15, (u) => dimBand((m >= 3 ? 0.6 : 0.45) * (1 - u), '255,245,220'));        // 막타 섬광: α ≤ 0.6, 0.15초 (스펙 정지 기준표)
      impact({ stop: m >= 3 ? 0.28 : 0.2, shake: m >= 3 ? 0.95 : 0.8 });
    },
    // 명중 그림 K34 (금빛 창 다발 충격): 잔타는 작게, 막타는 크게
    hitTex(a, t, share, i, n) { vfxSkillHit('k34', a, t, share, i, n, { ground: true, gpad: 2 }); },
    kb: 26, launch: true,
  },
});
