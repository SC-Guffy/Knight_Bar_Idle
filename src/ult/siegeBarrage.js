'use strict';
// 3차 궁극기 「대공성포」 연출 (siegeMaster — 공성포수). 수치·단계는 src/classes.js 의 SKILLS.siegeBarrage, 레터박스·컷인은 src/skills.js 의 drawUltScreen.
//  Lv1 「공성 노포」 옆에 거대한 공성 노포를 세워 굵은 살을 하단바 끝까지 쏘고, 둘째 살이 적 앞에서 터진다
//  ★ 「대공성포」 기사만 한 공성포가 세워지고 — 불타는 포탄 살이 하단바를 가로질러 거대한 폭발을 일으킨다
//  ★★ 「화포 일제 사격」 공성포가 돌며 포탄을 하늘로 연달아 쏘아 올려, 하단바 전체에 폭발이 쏟아진다
//  ★★★ 「요새 붕괴」 하단바 끝에 적의 요새 실루엣이 솟고 — 대공성포 일격에 요새가 무너지며 돌과 불이 하단바 전체를 덮는다
// 석궁사수의 abBlastFx(폭발)·abMushroomFx(버섯구름)·abArcFx(포물선 포탄)·abMuzzle 과 저격수의 ballistaFx·ballistaBoltFx 를 다시 쓴다

const SG_COL = { fire: '#ff7a2a', hot: '#ffe066', smoke: '#3a3030', stone: '#5a6578', stone2: '#7f8a9c', wood: '#5a3a1e' };
const sgDur = (a) => (a.k ? a.k.dur : 2.6);
const sgHitT = (a) => (a.k ? a.k.hits.map((h) => h[0] * a.k.dur) : [1.4, 2.4]);
const sgEnv = (t, from, to, fin, fout) => Math.min(clamp01((t - from) / fin), clamp01((to - t) / fout));
const sgBase = () => groundY() - 7;

function sgSky(a, life, dim, heat) {
  backFx(a, 0, life, (u) => {
    const t = u * life, k = sgEnv(t, 0.15, life - 0.15, 0.4, 0.3);
    dimBand(dim * k, '18,10,4');
    if (heat > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = heat * k; const g = ctx.createLinearGradient(0, 40, 0, groundY()); g.addColorStop(0, 'rgba(255,122,42,0)'); g.addColorStop(1, 'rgba(255,122,42,0.6)'); ctx.fillStyle = g; ctx.fillRect(-20, 40, W + 40, groundY() - 40); ctx.restore(); }
  });
}
// 대공성포: 기사 옆에 세워지는 거대한 포 (★ 이상). 바퀴 달린 틀 + 굵은 포신(ang 로 기울고 spin 이면 돈다) + 쏠 때 반동
function sgCannonFx(a, life, shots, angOf) {
  const d = a.dir, x = a.x() - d * 46, gy = groundY();
  a.sgCannon = { x, y: gy - 30 };
  backFx(a, 0, life, (u) => {
    const t = u * life, build = easeOut(Math.min(1, t / 0.4)), out = t > life - 0.25 ? (life - t) / 0.25 : 1;
    let rec = 0;
    for (const s of shots) if (t >= s && t < s + 0.14) rec = 1 - (t - s) / 0.14;
    const ang = angOf(t);
    a.sgCannon = { x: x + d * Math.cos(ang) * 44, y: gy - 30 - 10 * build + Math.sin(ang) * 44, ang };
    ctx.save();
    ctx.globalAlpha = out;
    ctx.translate(x, gy - 2);
    ctx.scale(d, 1);
    const h = 30 * build;
    ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.arc(-14, -6, 7, 0, Math.PI * 2); ctx.arc(14, -6, 7, 0, Math.PI * 2); ctx.fill();   // 바퀴
    ctx.fillStyle = '#5a5a66'; ctx.beginPath(); ctx.arc(-14, -6, 3, 0, Math.PI * 2); ctx.arc(14, -6, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = SG_COL.wood; ctx.fillRect(-22, -h * 0.5 - 4, 44, 8);                                       // 틀
    ctx.fillStyle = '#3a2a18'; ctx.fillRect(-22, -h * 0.5 + 2, 44, 2);
    ctx.fillStyle = '#9a9aa6'; ctx.fillRect(-4, -h - 2, 8, h * 0.5 + 2);                                      // 받침 기둥
    ctx.translate(0, -h - 8 + 10 * (1 - build)); ctx.rotate(ang);                                             // 포신 (회전축)
    ctx.translate(-rec * 10, 0);
    ctx.fillStyle = '#2e3038'; ctx.fillRect(-18, -9, 62, 18);
    ctx.fillStyle = '#4a4e5a'; ctx.fillRect(-18, -9, 62, 4); ctx.fillRect(36, -11, 8, 22);                   // 포구 테
    ctx.fillStyle = '#c9a227'; ctx.fillRect(-10, -10, 3, 20); ctx.fillRect(14, -10, 3, 20);                   // 금테
    if (rec > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,200,100,${0.8 * rec})`; ctx.beginPath(); ctx.arc(46, 0, 5 + 7 * (1 - rec), 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  });
}
// 포구 위치 (포신 끝)
function sgMuzzle(a) { const c = a.sgCannon; return c ? { x: c.x, y: c.y } : abMuzzle(a); }
// 불타는 포탄 살: 포구에서 대상까지 flight 초, 꼬리에 불꽃
function sgShellFx(x0, y0, x1, y1, flight, size = 1) {
  const ang = Math.atan2(y1 - y0, x1 - x0);
  skFx(null, 0, flight, (u) => {
    const x = mix(x0, x1, u), y = mix(y0, y1, u);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,160,60,0.6)'; ctx.lineWidth = 4 * size; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - Math.cos(ang) * 50, y - Math.sin(ang) * 50); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
    abBolt(x, y, ang, 22 * size, true);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = SG_COL.fire; ctx.beginPath(); ctx.arc(x - Math.cos(ang) * 6, y - Math.sin(ang) * 6, 5 * size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }, null, (u) => { if (Math.random() < 0.8) { const x = mix(x0, x1, u), y = mix(y0, y1, u); parts.push({ x, y, vx: rand(-20, 20), vy: rand(-30, 10), g: 40, size: 2, color: Math.random() < 0.5 ? SG_COL.fire : SG_COL.hot, life: 0.3, t: 0, add: true }); } });
}
// ★★★ 요새: 하단바 끝에 솟는 적 요새 실루엣 (성벽 + 탑 둘), 무너질 때 조각으로 흩어진다
function sgFortressFx(a, life, riseAt, fallAt) {
  const d = a.dir, x = d > 0 ? W - 46 : 46, gy = sgBase();
  const blocks = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) blocks.push({ x: x - 30 + c * 15, y: gy - 10 - r * 11, w: 14, h: 10, tower: false });
  for (const tx of [x - 36, x + 36]) for (let r = 0; r < 8; r++) blocks.push({ x: tx - 7, y: gy - 10 - r * 11, w: 14, h: 10, tower: true });
  for (const b of blocks) { b.vx = rand(-120, 120); b.vy = rand(-220, -40); b.vr = rand(-6, 6); }
  backFx(a, 0, life, (u) => {
    const t = u * life;
    if (t < riseAt) return;
    const rise = easeOut(Math.min(1, (t - riseAt) / 0.5)), fall = t > fallAt ? t - fallAt : 0;
    ctx.save();
    for (const b of blocks) {
      let bx = b.x, by = gy - (gy - b.y) * rise, al = 1;
      if (fall > 0) { bx += b.vx * fall; by += b.vy * fall + 300 * fall * fall; al = Math.max(0, 1 - fall / 0.9); if (by > gy) by = gy; }
      ctx.globalAlpha = al;
      ctx.fillStyle = b.tower ? SG_COL.stone2 : SG_COL.stone; ctx.fillRect(bx, by, b.w, b.h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(bx, by + b.h - 2, b.w, 2);
    }
    if (fall <= 0) { ctx.fillStyle = '#a8303a'; for (const tx of [x - 36, x + 36]) { ctx.fillRect(tx - 1, gy - 10 - 8 * 11 * rise - 10, 2, 10); ctx.fillRect(tx + 1, gy - 10 - 8 * 11 * rise - 10, 8, 5); } }   // 깃발
    ctx.restore();
  });
}

function sgStage0(a) {
  const D = sgDur(a), ht = sgHitT(a), life = D + 0.3;
  sgSky(a, life, 0.4, 0.1);
  ballistaFx(a, ht[ht.length - 1] + 0.25, ht.map((t) => t - 0.08));
}
function sgStage1(a) {
  const D = sgDur(a), ht = sgHitT(a), life = D + 0.35;
  sgSky(a, life, 0.5, 0.2);
  sgCannonFx(a, life, ht.map((t) => t - 0.1), () => -0.12);
}
function sgStage2(a) {
  const D = sgDur(a), ht = sgHitT(a), life = D + 0.35, tf = ht[ht.length - 1];
  sgSky(a, life, 0.55, 0.25);
  sgCannonFx(a, life, ht.map((t) => t - 0.12), (t) => (t < ht[0] - 0.4 ? -0.12 : t < tf - 0.4 ? -1.0 - 0.3 * Math.sin((t - ht[0]) * 6) : -0.12));
}
function sgStage3(a) {
  const D = sgDur(a), ht = sgHitT(a), life = D + 0.4, tf = ht[ht.length - 1];
  sgSky(a, life, 0.6, 0.3);
  sgCannonFx(a, life, ht.map((t) => t - 0.12), (t) => (t < ht[0] - 0.4 ? -0.12 : t < ht[ht.length - 2] - 0.3 ? -1.0 - 0.3 * Math.sin((t - ht[0]) * 6) : -0.05));
  sgFortressFx(a, life, 0.2, tf - 0.02);
}

Object.assign(SKILL_FX, {
  siegeBarrage: {
    // 석궁을 내리고 포를 세운다(0.3) → 포 옆에 서서 쏠 때마다 몸이 들썩인다 → 마지막 일격에 크게 밀린다
    pose(u, a) {
      const D = sgDur(a), t = u * D, ht = sgHitT(a), tf = ht[ht.length - 1];
      let rec = 0;
      for (const s of ht) if (t >= s - 0.1 && t < s + 0.08) rec = Math.max(rec, 1 - Math.abs(t - (s - 0.02)) / 0.1);
      if (t < 0.3) { const c = easeOut(t / 0.3); return { pull: 0, bowA: 0.6 * c, sy: 1 - 0.06 * c, skew: -0.1 * c, dx: -3 * c }; }
      if (t < tf + 0.3) return { pull: 10 * rec, bowA: 0.6 - 0.3 * rec, sy: 0.94 - 0.04 * rec, skew: -0.1 - 0.18 * rec, dx: -3 - 8 * rec };
      const r = easeOut(segU(t, tf + 0.3, D)); return { pull: 0, bowA: 0.6 * (1 - r), sy: mix(0.94, 1, r), skew: -0.1 * (1 - r), dx: -3 * (1 - r) };
    },
    cues: (a) => {
      const D = sgDur(a), ht = sgHitT(a), m = Math.min(3, a.mast || 0), tf = ht[ht.length - 1];
      const list = [[0, (a) => [sgStage0, sgStage1, sgStage2, sgStage3][m](a)], [0.3 / D, (a) => { debris(a.x() - a.dir * 46, 12, ['#c9b38a', '#5a4a42']); impact({ shake: 0.2 }); }]];
      if (m === 0) return list.concat(ht.map((t, j) => [(t - 0.1) / D, (a) => { ballistaBoltFx(a, groundY() - 26 + j * 3, 0.9); impact({ stop: 0.06, shake: 0.35 }); for (let i = 0; i < 6; i++) parts.push({ x: a.x() + a.dir * 18, y: groundY() - 2, vx: -a.dir * rand(40, 120), vy: rand(-60, -10), g: 200, size: 3, color: '#c9b38a', life: 0.4, t: 0 }); }]));
      // 포탄: 첫 타·마지막 타는 대상으로 곧게, 가운데는 하늘로 쏘아 올려 하단바 곳곳에 떨어진다
      return list.concat(ht.map((t, j) => [(t - 0.12) / D, (a) => {
        const mz = sgMuzzle(a), last = j === ht.length - 1, first = j === 0;
        burst(mz.x, mz.y, 10, ['#ffffff', SG_COL.hot], 90, 2, 0); impact({ stop: first || last ? 0.06 : 0.03, shake: first || last ? 0.4 : 0.2 });
        if (first || last || m === 1) { sgShellFx(mz.x, mz.y, a.tx(), groundY() - 12, 0.1, last ? 1.6 : 1.1); return; }
        const lx = Math.max(20, Math.min(W - 20, a.tx() + (j % 2 ? 1 : -1) * rand(20, 160)));
        abArcFx(mz.x, mz.y, lx, groundY() - 6, 0.1, 120, true, 22);
      }]));
    },
    hit(a, i, n) {
      const m = Math.min(3, a.mast || 0), last = i === n - 1, first = i === 0, tx = a.tx(), gy = groundY();
      if (m === 0) { for (const t of a.targets(i)) burst(t.x, t.y, 12, ['#c9c2b4', '#ffffff', SG_COL.fire], 160); if (last) { abBlastFx(tx, gy - 12, 1.3); impact({ stop: 0.12, shake: 0.5 }); } return; }
      if (first) { abBlastFx(tx, gy - 12, 1.6); impact({ stop: 0.1, shake: 0.5 }); return; }
      if (!last) { const tg = a.targets(i), t = tg[i % Math.max(1, tg.length)] || { x: tx, y: gy - 12 }; abBlastFx(t.x + rand(-12, 12), gy - 10, 1.0); impact({ stop: 0.03, shake: 0.25 }); return; }
      abBlastFx(tx, gy - 14, m >= 3 ? 2.6 : 2.0); abMushroomFx(tx, 1.2); craterFx(tx, 1.0);
      for (let x = 20; x < W; x += 60) abBlastFx(x + rand(-15, 15), gy - 8, 0.7);
      if (m >= 3) { for (let j = 0; j < 30; j++) parts.push({ x: rand(0, W), y: gy - rand(0, 60), vx: rand(-100, 100), vy: rand(-200, -40), g: 300, size: 3, color: j % 2 ? SG_COL.stone : SG_COL.fire, life: rand(0.5, 0.9), t: 0 }); }
      aFx(a, 0, 0.35, (u) => dimBand((m >= 3 ? 0.9 : 0.6) * (1 - u), '255,235,210'));
      impact({ stop: m >= 3 ? 0.3 : 0.22, shake: m >= 3 ? 0.95 : 0.85 });
    },
    marks(a, t, pow, i, n) { if (i === 0 || i === n - 1) drillFx(t.x, t.y, a.dir, '#ffe8c0', 0.5); else scorchFx(t.x, groundY() - 2, SG_COL.smoke, 0.6); },
    kb: 24, launch: true,
  },
});
