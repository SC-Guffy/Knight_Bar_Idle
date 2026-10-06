'use strict';
// 3차 궁극기 「성좌 강림」 연출 (archon). 수치·단계는 src/classes.js 의 SKILLS.starJudgment, 공통 레터박스·컷인은 src/skills.js 의 drawUltScreen.
//  Lv1 「성좌의 빛」 하단바가 은하수 낀 밤하늘로 물들고 별똥 셋이 떨어진 뒤, 하늘에서 빛을 모은 큰 별 하나가 내리꽂힌다
//  ★ 「성좌 강림」 별이 하나씩 켜지며 선으로 이어져 하단바만 한 기사 성좌가 떠오르고, 성좌의 별이 적을 쏘다가 — 성좌의 검이 하단바를 내리긋는다
//  ★★ 「십이성좌」 열두 성좌가 하늘에 차례로 켜지며 별비가 쏟아지고, 마지막에 모든 별이 적 위 한 점으로 모여 터진다
//  ★★★ 「창세의 빛」 성운 낀 하늘에 금이 가 빛이 새고, 하늘의 별이 한꺼번에 떨어진 뒤 — 하늘이 활짝 열려 새하얀 빛이 하단바 전체를 덮는다
// 이 파일의 도구는 모두 sj 로 시작한다 (다른 궁극기 파일과 이름이 겹치지 않게)

const SJ_BLUE = '#9fd8ff', SJ_PALE = '#dff2ff', SJ_GOLD = '#fff0b8';
const sjHitT = (a, i) => a.k.hits[i][0] * a.k.dur;               // i 번째 타격 시각(초)
const sjLastT = (a) => sjHitT(a, a.k.hits.length - 1);
// 타격 i 의 대상 중 하나 (여러 마리면 돌아가며)
function sjAim(a, i) {
  const list = a.targets(i);
  return list[i % list.length] || { x: a.tx(), y: a.ty() };
}

// 네 갈래 별: 가늘고 긴 마름모 팔 네 개와 하얀 심
function sjSpark(x, y, r, col, al = 1) {
  if (r < 0.5 || al <= 0) return;
  const q = Math.max(1, r * 0.2);
  ctx.save();
  ctx.globalAlpha = al;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x + q, y - q); ctx.lineTo(x + r, y); ctx.lineTo(x + q, y + q);
  ctx.lineTo(x, y + r); ctx.lineTo(x - q, y + q); ctx.lineTo(x - r, y); ctx.lineTo(x - q, y - q);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff';
  const c = Math.max(2, Math.round(r * 0.3));
  ctx.fillRect(Math.round(x - c / 2), Math.round(y - c / 2), c, c);
  ctx.restore();
}
// 잠깐 반짝이고 사라지는 별 (타격 자국)
function sjTwinkle(x, y, r, col, life = 0.3, delay = 0) {
  skFx(null, delay, life, (u) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    sjSpark(x, y, r * Math.sin(Math.PI * Math.min(1, u * 1.4 + 0.15)), col, 1 - u * 0.4);
    ctx.restore();
  });
}
// 하단바 전체가 잠깐 번쩍인다
function sjFlash(a, rgb, al, life, delay = 0) {
  aFx(a, delay, life, (u) => dimBand(al * (1 - u) * (1 - u), rgb));
}

// 밤하늘: 남색으로 물들고 비스듬한 은하수와 별이 반짝인다. deep(★★★)이면 성운이 끼고, 하늘의 별이 dropAt 초부터 떨어져 나가 사라진다
function sjSkyFx(a, life, deep = false, dropAt = 99) {
  const n = Math.round(Math.max(50, Math.min(170, W / 6)));
  const stars = Array.from({ length: n }, () => [Math.random(), rand(0.08, 0.8), rand(0, 6), Math.random() < 0.18]);
  const neb = deep ? Array.from({ length: 5 }, (_, i) => [rand(0.05, 0.95), rand(30, 70), rand(50, 90), i % 2 ? '120,90,255' : '60,200,255']) : [];
  backFx(a, 0, life, (u) => {
    const t = u * life, al = Math.min(1, t / 0.45) * (t > life - 0.4 ? Math.max(0, (life - t) / 0.4) : 1);
    if (al <= 0) return;
    const gy = groundY();
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(3,6,26,${0.88 * al})`); g.addColorStop(0.65, `rgba(12,24,66,${0.74 * al})`); g.addColorStop(1, `rgba(28,48,110,${0.6 * al})`);
    ctx.fillStyle = g; ctx.fillRect(-60, -240, W + 120, H + 480);
    ctx.globalCompositeOperation = 'lighter';
    // 성운: 보랏빛·청록빛 구름이 천천히 흐른다
    for (const [fx, fy, r, rgb] of neb) {
      const x = fx * W + Math.sin(clock * 0.4 + fy) * 10;
      const ng = ctx.createRadialGradient(x, fy, 2, x, fy, r);
      ng.addColorStop(0, `rgba(${rgb},${0.22 * al})`); ng.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = ng; ctx.fillRect(x - r, fy - r, r * 2, r * 2);
    }
    // 은하수: 하단바를 비스듬히 가로지르는 옅은 빛 띠
    ctx.save();
    ctx.translate(W / 2, gy * 0.42); ctx.rotate(-0.1);
    const mg = ctx.createLinearGradient(0, -18, 0, 18);
    mg.addColorStop(0, 'rgba(160,200,255,0)'); mg.addColorStop(0.5, `rgba(170,210,255,${0.16 * al})`); mg.addColorStop(1, 'rgba(160,200,255,0)');
    ctx.fillStyle = mg; ctx.fillRect(-W, -18, W * 2, 36);
    ctx.restore();
    const left = 1 - clamp01((t - dropAt) / 0.9);
    for (const [fx, fy, ph, big] of stars) {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(clock * 2.6 + ph));
      const x = Math.round(fx * W), y = Math.round(fy * gy);
      ctx.globalAlpha = al * tw * left;
      ctx.fillStyle = big ? SJ_PALE : '#ffffff';
      ctx.fillRect(x, y, 1, 1);
      if (big) { ctx.globalAlpha *= 0.6; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5); }
    }
    ctx.restore();
  });
}

// 별똥: 네 갈래 별 머리에 도트 꼬리가 길게 붙어 (x0,y0) 에서 (x1,y1) 로 점점 빨라지며 떨어진다
function sjFallFx(a, delay, life, x0, y0, x1, y1, size, col, onLand) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.max(1, Math.hypot(dx, dy)), ux = dx / L, uy = dy / L;
  aFx(a, delay, life, (u) => {
    const e = 0.45 * u + 0.55 * u * u, x = mix(x0, x1, e), y = mix(y0, y1, e);
    const tail = Math.min(L * e, 26 + size * 10);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let s = 0; s < tail; s += 2) {
      const k = 1 - s / tail, w = Math.max(1, Math.round(size * 1.4 * k));
      ctx.globalAlpha = 0.85 * k;
      ctx.fillStyle = s < 5 ? '#ffffff' : col;
      ctx.fillRect(Math.round(x - ux * s - w / 2), Math.round(y - uy * s - w / 2), w, w);
    }
    sjSpark(x, y, 3 + size * 2, col, 1);
    ctx.restore();
  }, onLand);
}
// 별이 땅에 닿았다: 세로 빛 틈 + 땅에 납작하게 퍼지는 빛 고리 + 네 갈래 섬광 + 별 조각
function sjLandFx(x, y, pow = 1, col = SJ_BLUE) {
  const gy = groundY();
  skFx(null, 0, 0.45, (u) => {
    const k = easeOut(Math.min(1, u / 0.25)), f = 1 - u;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = f;
    const hgt = (34 + 18 * pow) * (1 - 0.5 * u), w = Math.max(1, 3 * pow * f);
    const g = ctx.createLinearGradient(0, gy - hgt, 0, gy);
    g.addColorStop(0, 'rgba(159,216,255,0)'); g.addColorStop(1, 'rgba(230,245,255,0.95)');
    ctx.fillStyle = g; ctx.fillRect(x - w / 2, gy - hgt, w, hgt);
    ctx.strokeStyle = col; ctx.lineWidth = 2 * f + 0.5;
    ctx.beginPath(); ctx.ellipse(x, gy - 1, 6 + 26 * pow * k, 2 + 3 * pow * k, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    sjSpark(x, y, (10 + 6 * pow) * (1 - u * 0.7), col, f);
    ctx.restore();
  });
  for (let j = 0; j < Math.round(6 + 5 * pow); j++) {
    parts.push({ x: x + rand(-4, 4), y: gy - 3, vx: rand(-90, 90) * pow, vy: rand(-170, -50), g: 300, size: j % 3 ? 2 : 3, color: j % 2 ? col : '#ffffff', life: rand(0.35, 0.6), t: 0, add: true });
  }
}
// 큰 별이 터진다: 하얀 원이 부풀고 여덟 갈래 빛살이 돌며 뻗고, 땅을 따라 납작한 충격파가 멀리까지 퍼진다
function sjNovaFx(x, y, R, life = 0.8, col = SJ_BLUE) {
  const gy = groundY(), rot = rand(0, 1);
  skFx(null, 0, life, (u) => {
    const k = easeOut(Math.min(1, u / 0.22)), f = 1 - u;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(x, y, 1, x, y, R * k + 2);
    rg.addColorStop(0, `rgba(255,255,255,${f})`); rg.addColorStop(0.35, `rgba(200,235,255,${0.7 * f})`); rg.addColorStop(1, 'rgba(159,216,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(x - R - 2, y - R - 2, R * 2 + 4, R * 2 + 4);
    ctx.globalAlpha = f;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) {
      const an = rot + u * 0.6 + (i * Math.PI) / 4, len = R * (i % 2 ? 1.1 : 2.2) * k, wd = i % 2 ? 1.5 : 3;
      ctx.save(); ctx.translate(x, y); ctx.rotate(an);
      ctx.beginPath(); ctx.moveTo(0, -wd); ctx.lineTo(len, 0); ctx.lineTo(0, wd); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = col; ctx.lineWidth = 3 * f + 0.5;
    ctx.beginPath(); ctx.ellipse(x, gy - 1, R * 3.2 * k, 4 + 6 * k, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, gy - 1, R * 2.2 * k, 3 + 4 * k, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  });
  for (let j = 0; j < 34; j++) {
    const an = rand(0, Math.PI * 2), v = rand(80, 260);
    parts.push({ x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v - 60, g: 220, size: j % 4 ? 2 : 3, color: j % 3 ? col : j % 2 ? SJ_GOLD : '#ffffff', life: rand(0.5, 0.9), t: 0, add: true });
  }
}

// ── Lv1: 하늘에서 빛을 모으는 큰 별 (from 초 뒤에 나타나 life 초 뒤 대상에게 내리꽂힌다) ──
function sjBigStarFx(a, from, life) {
  const fall = 0.16;
  aFx(a, from, life, (u) => {
    const t = u * life, gy = groundY(), x1 = a.tx(), grow = easeOut(Math.min(1, t / (life - fall)));
    const ft = clamp01((t - (life - fall)) / fall), x = mix(x1 - a.dir * 30, x1, ft), y = mix(32, gy - 12, ft * ft);
    const R = 5 + 9 * grow;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 빛을 빨아들이는 둥근 후광
    const rg = ctx.createRadialGradient(x, y, 1, x, y, R * 3);
    rg.addColorStop(0, 'rgba(220,240,255,0.7)'); rg.addColorStop(1, 'rgba(159,216,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(x - R * 3, y - R * 3, R * 6, R * 6);
    if (ft > 0) { ctx.globalAlpha = 0.8; ctx.fillStyle = SJ_PALE; ctx.fillRect(Math.round(x - 1), 30, 3, Math.max(0, y - 30)); ctx.globalAlpha = 1; }
    // 여덟 갈래 별 (천천히 돈다)
    ctx.translate(x, y); ctx.rotate(t * 1.6);
    ctx.fillStyle = SJ_PALE;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) { const r = i % 2 ? R * 0.38 : i % 4 ? R * 0.75 : R * 1.25, an = (i * Math.PI) / 8; i ? ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r) : ctx.moveTo(Math.cos(an) * r, Math.sin(an) * r); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  }, null, (u) => {
    // 별로 빨려 드는 빛 알갱이
    if (u * life > life - 0.16 || Math.random() > 0.7) return;
    const an = rand(0, Math.PI * 2), d = rand(30, 60), x = a.tx() - a.dir * 30, y = 32;
    parts.push({ x: x + Math.cos(an) * d, y: y + Math.sin(an) * d * 0.6, vx: -Math.cos(an) * d * 3, vy: -Math.sin(an) * d * 1.8, g: 0, size: 2, color: Math.random() < 0.5 ? SJ_BLUE : '#ffffff', life: 0.3, t: 0, add: true });
  });
}

// ── ★: 하단바만 한 기사 성좌. 별이 발끝부터 머리까지 하나씩 켜지며 선으로 이어지고, 들어 올린 성좌의 검이 마지막에 내리긋는다 ──
const SJ_FIG = {
  pts: {
    footL: [-17, -4], footR: [18, -4], kneeL: [-13, -30], kneeR: [13, -31], hipL: [-10, -54], hipR: [10, -54], waist: [0, -58],
    shL: [-15, -86], shR: [15, -86], neck: [0, -92], head: [0, -103],
    sh1: [-25, -83], sh2: [-32, -66], sh3: [-25, -49], sh4: [-18, -66], elbow: [26, -78], hand: [29, -94],
  },
  order: ['footL', 'footR', 'kneeL', 'kneeR', 'hipL', 'hipR', 'waist', 'sh2', 'sh3', 'sh1', 'sh4', 'shL', 'shR', 'neck', 'head', 'elbow', 'hand'],
  lines: [['footL', 'kneeL'], ['kneeL', 'hipL'], ['footR', 'kneeR'], ['kneeR', 'hipR'], ['hipL', 'waist'], ['hipR', 'waist'], ['waist', 'neck'],
    ['neck', 'shL'], ['neck', 'shR'], ['neck', 'head'], ['shR', 'elbow'], ['elbow', 'hand'], ['shL', 'sh1'],
    ['sh1', 'sh2'], ['sh2', 'sh3'], ['sh3', 'sh4'], ['sh4', 'sh1']],
};
const SJ_RAISE = -Math.PI / 2 + 0.25, SJ_BACK = -Math.PI / 2 - 0.55, SJ_DOWN = 0.78;
// 성좌의 검 각도 (오른쪽을 볼 때의 화면 각도): 들고 있다가 → 뒤로 젖혔다가 → 내리긋는다
function sjSwordAng(t, tf) {
  if (t < tf - 0.32) return SJ_RAISE;
  if (t < tf - 0.13) return mix(SJ_RAISE, SJ_BACK, easeOut(segU(t, tf - 0.32, tf - 0.13)));
  return mix(SJ_BACK, SJ_DOWN, easeIn(segU(t, tf - 0.13, tf)));
}
// 별마다 켜지는 시각 (0.25초부터 0.75초 동안 차례로)
function sjFigLit(a) {
  if (!a.sjLit) a.sjLit = Object.fromEntries(SJ_FIG.order.map((p, i) => [p, 0.25 + (i / (SJ_FIG.order.length - 1)) * 0.75]));
  return a.sjLit;
}
// 성좌 위 한 점의 화면 위치 (시전자 뒤에 선다)
function sjFigPt(a, name) {
  const gy = groundY(), sc = (gy - 26) / 108, cx = a.x() - a.dir * 34, [px, py] = SJ_FIG.pts[name];
  return { x: cx + a.dir * px * sc, y: gy - 2 + py * sc };
}
function sjKnightFx(a) {
  const D = a.k.dur, tf = sjLastT(a), lit = sjFigLit(a);
  aFx(a, 0, D, (u) => {
    const t = u * D, out = t > tf + 0.05 ? clamp01(1 - (t - tf - 0.05) / 0.3) : 1;
    if (out <= 0) return;
    const P = {};
    for (const n in SJ_FIG.pts) P[n] = sjFigPt(a, n);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 성좌 몸 둘레의 옅은 빛
    const c = P.waist, gl = ctx.createRadialGradient(c.x, c.y - 20, 4, c.x, c.y - 20, 80);
    gl.addColorStop(0, `rgba(120,180,255,${0.22 * out * clamp01((t - 0.3) / 0.6)})`); gl.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(c.x - 80, c.y - 100, 160, 160);
    // 별을 잇는 선: 두 끝이 켜진 뒤 0.1초 동안 그어진다
    ctx.lineCap = 'round';
    for (const [p, q] of SJ_FIG.lines) {
      const k = clamp01((t - Math.max(lit[p], lit[q])) / 0.1);
      if (k <= 0) continue;
      const x1 = mix(P[p].x, P[q].x, k), y1 = mix(P[p].y, P[q].y, k);
      ctx.globalAlpha = 0.25 * out; ctx.strokeStyle = SJ_BLUE; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(P[p].x, P[p].y); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.globalAlpha = 0.85 * out; ctx.strokeStyle = SJ_PALE; ctx.lineWidth = 1;
      ctx.stroke();
    }
    // 투구: 머리 별 둘레의 작은 별 고리
    if (t > lit.head) {
      ctx.globalAlpha = 0.7 * out; ctx.strokeStyle = SJ_BLUE; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(P.head.x, P.head.y, 7, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const n in SJ_FIG.pts) {
      const lt = t - lit[n];
      if (lt < 0) continue;
      const pop = lt < 0.12 ? 1 + 1.5 * (1 - lt / 0.12) : 1, tw = 0.8 + 0.2 * Math.sin(clock * 9 + P[n].x);
      sjSpark(P[n].x, P[n].y, (n === 'head' || n === 'hand' ? 5 : 3.5) * pop * tw, SJ_BLUE, out);
    }
    // 성좌의 검: 손 별에서 뻗은 별빛 칼날. 내리긋는 동안 지나간 자리가 부채꼴 빛으로 남는다
    const swordOn = clamp01((t - lit.hand - 0.05) / 0.25);
    if (swordOn > 0) {
      // 들고 있는 동안은 짧게(하단바 위로 삐져나가지 않게), 내리그을 때 하단바를 가를 만큼 길게 뻗는다
      const h = P.hand, full = Math.max(120, Math.min(W * 0.7, Math.abs(a.tx() - h.x) * 1.25 + 40));
      const ang = sjSwordAng(t, tf), A = (r) => (a.dir > 0 ? r : Math.PI - r);
      const Ls = mix(26, full, easeOut(clamp01((ang + 0.9) / 1.2))) * easeOut(swordOn);
      if (t > tf - 0.13) {
        const a0 = A(Math.min(ang, -0.9)), a1 = A(ang), fade = t > tf ? clamp01(1 - (t - tf) / 0.3) : 1;
        const wg = ctx.createRadialGradient(h.x, h.y, Ls * 0.2, h.x, h.y, Ls);
        wg.addColorStop(0, 'rgba(159,216,255,0)'); wg.addColorStop(0.8, `rgba(170,220,255,${0.3 * fade})`); wg.addColorStop(1, `rgba(255,255,255,${0.7 * fade})`);
        ctx.fillStyle = wg;
        ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.arc(h.x, h.y, Ls, Math.min(a0, a1), Math.max(a0, a1)); ctx.closePath(); ctx.fill();
      }
      const ca = Math.cos(A(ang)), sa = Math.sin(A(ang)), tx = h.x + ca * Ls, ty = h.y + sa * Ls;
      ctx.strokeStyle = SJ_BLUE; ctx.lineWidth = 5; ctx.globalAlpha = 0.3 * out;
      ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.globalAlpha = out;
      ctx.stroke();
      // 날밑
      const gx = h.x + ca * 10, gy2 = h.y + sa * 10;
      ctx.beginPath(); ctx.moveTo(gx - sa * 9, gy2 + ca * 9); ctx.lineTo(gx + sa * 9, gy2 - ca * 9); ctx.stroke();
      for (const f of [0.35, 0.65]) sjSpark(h.x + ca * Ls * f, h.y + sa * Ls * f, 3, SJ_BLUE, out);
      sjSpark(tx, ty, 6, SJ_PALE, out);
    }
    ctx.restore();
  }, () => {
    // 성좌가 흩어지며 별가루가 떠오른다
    for (const n in SJ_FIG.pts) {
      const p = sjFigPt(a, n);
      parts.push({ x: p.x, y: p.y, vx: rand(-20, 20), vy: rand(-50, -15), g: -10, size: 2, color: Math.random() < 0.5 ? SJ_BLUE : '#ffffff', life: rand(0.4, 0.7), t: 0, add: true });
    }
  });
}
// 하단바를 가로로 끝에서 끝까지 내리그은 성좌의 칼자국
function sjCutFx(cx, y, col = SJ_BLUE, life = 0.7) {
  skFx(null, 0, life, (u) => {
    const grow = easeOut(Math.min(1, u / 0.1)), f = u < 0.3 ? 1 : 1 - (u - 0.3) / 0.7, th = 7 * (1 - u) + 1;
    const x0 = mix(cx, -40, grow), x1 = mix(cx, W + 40, grow);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = f * 0.5; ctx.fillStyle = col; ctx.fillRect(x0, y - th * 1.6, x1 - x0, th * 3.2);
    ctx.globalAlpha = f; ctx.fillStyle = '#ffffff'; ctx.fillRect(x0, y - th / 2, x1 - x0, th);
    ctx.restore();
  });
}

// ── ★★: 열두 성좌. 하늘에 흩어진 작은 별자리 열둘이 왼쪽부터 차례로 켜지고, 각자 별똥을 하나씩 떨군다 ──
function sjZodiacFx(a) {
  const tf = sjLastT(a), n = 12, cons = [];
  for (let i = 0; i < n; i++) {
    const pts = [[(i + 0.5) / n * W + rand(-10, 10), rand(24, 54)]], m = 3 + (i % 3);
    for (let j = 1; j < m; j++) {
      const [px, py] = pts[j - 1], an = rand(0, Math.PI * 2), d = rand(9, 17);
      pts.push([px + Math.cos(an) * d, Math.max(20, Math.min(70, py + Math.sin(an) * d * 0.8))]);
    }
    cons.push({ pts, at: sjHitT(a, i) - 0.42 });
  }
  if (a.dir < 0) cons.reverse().forEach((c, i) => (c.at = sjHitT(a, i) - 0.42));
  a.sjCons = cons;
  const gAt = tf - 0.3;                                        // 모든 별이 한 점으로 모이기 시작
  aFx(a, 0, tf + 0.02, (u) => {
    const t = u * (tf + 0.02), gk = easeIn(clamp01((t - gAt) / 0.25)), P = { x: a.tx(), y: groundY() - 52 };
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const c of cons) {
      const lt = t - c.at;
      if (lt < 0) continue;
      // 선 (모이기 시작하면 사라진다)
      const lk = clamp01(lt / 0.2) * (1 - gk);
      if (lk > 0) {
        ctx.globalAlpha = 0.7 * lk; ctx.strokeStyle = SJ_BLUE; ctx.lineWidth = 1;
        ctx.beginPath();
        c.pts.forEach(([x, y], j) => { if (lt < j * 0.05) return; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.stroke();
      }
      for (let j = 0; j < c.pts.length; j++) {
        const k = lt - j * 0.05;
        if (k < 0) continue;
        const [x0, y0] = c.pts[j], x = mix(x0, P.x, gk), y = mix(y0, P.y, gk);
        if (gk > 0.05) { ctx.globalAlpha = 0.5; ctx.strokeStyle = SJ_PALE; ctx.beginPath(); ctx.moveTo(mix(x0, P.x, gk * 0.7), mix(y0, P.y, gk * 0.7)); ctx.lineTo(x, y); ctx.stroke(); }
        sjSpark(x, y, (j ? 2.5 : 4) * (k < 0.1 ? 1 + 2 * (1 - k / 0.1) : 1), SJ_BLUE, 1);
      }
    }
    // 모여든 별이 한 점에서 부풀어 오른다
    if (gk > 0) {
      const R = 4 + 16 * gk, rg = ctx.createRadialGradient(P.x, P.y, 1, P.x, P.y, R * 2);
      rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(0.4, `rgba(180,225,255,${0.7 * gk})`); rg.addColorStop(1, 'rgba(159,216,255,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = rg; ctx.fillRect(P.x - R * 2, P.y - R * 2, R * 4, R * 4);
    }
    ctx.restore();
  });
}
// 별비: 하단바 전체에 가는 별똥이 비스듬히 쏟아진다 (조각 목록을 이 연출 하나가 관리한다)
function sjRainFx(a, span, rate) {
  const drops = [], life = span + 0.4;
  let acc = 0;
  aFx(a, 0, life, () => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const d of drops) {
      const x = d.x + d.vx * d.t, y = d.y + d.vy * d.t;
      ctx.globalAlpha = 0.8; ctx.strokeStyle = d.c; ctx.lineWidth = d.w;
      ctx.beginPath(); ctx.moveTo(x - d.vx * 0.05, y - d.vy * 0.05); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x - 1), Math.round(y - 1), 2, 2);
    }
    ctx.restore();
  }, null, (u, dt) => {
    if (u * life < span) {
      acc += dt * rate;
      while (acc >= 1) {
        acc -= 1;
        const vy = rand(380, 520);
        drops.push({ x: rand(-40, W + 40), y: rand(-10, 30), vx: -a.dir * vy * rand(0.25, 0.45), vy, t: 0, life: (groundY() - 20) / vy, w: rand(0.8, 1.6), c: Math.random() < 0.3 ? SJ_GOLD : SJ_BLUE });
      }
    }
    for (const d of drops) {
      d.t += dt;
      if (d.t < d.life) continue;
      d.done = true;
      if (Math.random() < 0.5) parts.push({ x: d.x + d.vx * d.t, y: groundY() - 2, vx: rand(-30, 30), vy: rand(-60, -20), g: 200, size: 2, color: SJ_PALE, life: 0.25, t: 0, add: true });
    }
    for (let i = drops.length - 1; i >= 0; i--) if (drops[i].done) drops.splice(i, 1);
  });
}

// ── ★★★: 하늘의 금. 성운 낀 하늘을 가로로 금이 달리며 그 틈으로 빛이 샌다. openAt 에 활짝 벌어지고 genAt 에 더 크게 열린다 ──
function sjRiftFx(a, from, openAt, genAt) {
  const D = a.k.dur, life = D - from, cx0 = a.tx(), pts = [];
  for (let x = -36; x <= W + 36; x += 12) pts.push([x, 30 + rand(-5, 5)]);
  const rays = Array.from({ length: Math.max(6, Math.round(W / 70)) }, () => [rand(0, W), rand(0, 6), rand(8, 18)]);
  a.sjRiftY = (x) => {
    const f = (x + 36) / 12, i = Math.max(0, Math.min(pts.length - 2, Math.floor(f)));
    return mix(pts[i][1], pts[i + 1][1], clamp01(f - i));
  };
  aFx(a, 0, life, (u) => {
    const t = from + u * life, reach = easeOut(clamp01((t - from) / 0.6)) * (Math.max(cx0, W - cx0) + 40);
    const gap = t < openAt ? 1.2 + 1.2 * clamp01((t - from) / (openAt - from)) : t < genAt ? mix(2.4, 10, easeOut(clamp01((t - openAt) / 0.15))) : mix(10, 18, easeOut(clamp01((t - genAt) / 0.1)));
    const out = t > D - 0.3 ? clamp01((D - t) / 0.3) : 1, glow = t < openAt ? 0.35 + 0.35 * clamp01((t - from) / (openAt - from)) : 1;
    const vis = pts.filter(([x]) => Math.abs(x - cx0) <= reach);
    if (vis.length < 2) return;
    const gy = groundY();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 틈에서 비스듬히 내려오는 빛살
    for (const [rx, ph, w] of rays) {
      if (Math.abs(rx - cx0) > reach) continue;
      const y0 = a.sjRiftY(rx), sw = Math.sin(clock * 1.3 + ph) * 8, al = (0.08 + 0.12 * glow) * out;
      const g = ctx.createLinearGradient(0, y0, 0, gy);
      g.addColorStop(0, `rgba(255,250,235,${al})`); g.addColorStop(1, 'rgba(255,250,235,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(rx - w * 0.2, y0); ctx.lineTo(rx + w * 0.2, y0); ctx.lineTo(rx + w * 1.6 + sw - a.dir * 14, gy); ctx.lineTo(rx - w * 1.6 + sw - a.dir * 14, gy); ctx.closePath(); ctx.fill();
    }
    // 금: 위아래로 벌어진 틈을 하얗게 채운다 (바깥은 금빛 번짐)
    const edge = (g2) => {
      ctx.beginPath();
      vis.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - g2 / 2) : ctx.moveTo(x, y - g2 / 2)));
      for (let i = vis.length - 1; i >= 0; i--) ctx.lineTo(vis[i][0], vis[i][1] + g2 / 2 + (i % 2 ? 1 : 0));
      ctx.closePath(); ctx.fill();
    };
    ctx.globalAlpha = 0.35 * out * glow; ctx.fillStyle = SJ_GOLD; edge(gap * 3 + 4);
    ctx.globalAlpha = 0.95 * out; ctx.fillStyle = '#ffffff'; edge(gap);
    ctx.restore();
  });
}
// 하늘의 별이 한꺼번에 떨어진다: 하단바 폭 전체의 작은 별똥이 짧은 시간에 쏟아진다
function sjStarDropFx(a, span) {
  const n = Math.round(Math.max(30, Math.min(140, W / 12)));
  const list = Array.from({ length: n }, () => ({ x: rand(0, W), y: rand(14, 70), at: rand(0, span), life: rand(0.22, 0.34), sz: Math.random() < 0.2 ? 2 : 1 }));
  aFx(a, 0, span + 0.4, (u) => {
    const t = u * (span + 0.4), gy = groundY();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of list) {
      const k = (t - s.at) / s.life;
      if (k < 0 || k > 1.25) continue;
      if (k > 1) { ctx.globalAlpha = 1 - (k - 1) / 0.25; ctx.fillStyle = SJ_PALE; ctx.fillRect(Math.round(s.x + a.dir * 18 - 3), gy - 2, 7, 1); continue; }
      const e = k * k, x = s.x + a.dir * 18 * e, y = mix(s.y, gy - 2, e);
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = s.sz > 1 ? SJ_GOLD : SJ_BLUE; ctx.lineWidth = s.sz;
      ctx.beginPath(); ctx.moveTo(x - a.dir * 5, y - 22 * Math.min(1, k * 3)); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x - s.sz / 2), Math.round(y - s.sz / 2), s.sz + 1, s.sz + 1);
    }
    ctx.restore();
  });
}
// 창세의 빛 (1): 하늘의 틈에서 새하얀 빛기둥이 대상에게 내리꽂힌다
function sjGenesisFx(a, fall) {
  aFx(a, 0, fall, (u) => {
    const x = a.tx(), y0 = a.sjRiftY ? a.sjRiftY(x) : 26, y1 = mix(y0, groundY(), easeIn(u)), w = 10 + 14 * u;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, 'rgba(255,240,184,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,240,184,0)');
    ctx.fillStyle = g; ctx.fillRect(x - w, y0, w * 2, y1 - y0);
    sjSpark(x, y1, 10 + 8 * u, SJ_GOLD, 1);
    ctx.restore();
  });
}
// 창세의 빛 (2): 빛기둥이 옆으로 번져 하단바 전체를 새하얗게 덮었다가 걷히고, 땅 전체에서 빛 알갱이가 떠오른다
function sjGenesisBurst(a) {
  const cx = a.tx(), life = 0.85;
  aFx(a, 0, life, (u) => {
    const spread = easeOut(Math.min(1, u / 0.14)), half = (Math.max(cx, W - cx) + 60) * spread;
    const f = u < 0.14 ? 1 : (1 - (u - 0.14) / 0.86) ** 2, gy = groundY();
    ctx.save();
    const g = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
    g.addColorStop(0, 'rgba(255,240,184,0)'); g.addColorStop(0.08, `rgba(255,244,210,${0.75 * f})`);
    g.addColorStop(0.5, `rgba(255,255,255,${0.9 * f})`);
    g.addColorStop(0.92, `rgba(255,244,210,${0.75 * f})`); g.addColorStop(1, 'rgba(255,240,184,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - half, -240, half * 2, H + 480);
    // 그 안에서 세로 빛줄기가 일렁인다
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = f * 0.45; ctx.fillStyle = SJ_GOLD;
    for (let x = cx - half + (((cx - half) % 23) + 23) % 23; x < cx + half; x += 23) {
      ctx.fillRect(x, 0, 2 + 2 * Math.abs(Math.sin(x * 0.37 + clock * 6)), gy);
    }
    ctx.restore();
  });
  const n = Math.round(Math.max(30, Math.min(120, W / 14)));
  for (let i = 0; i < n; i++) {
    parts.push({ x: rand(0, W), y: groundY() - rand(0, 20), vx: rand(-15, 15), vy: rand(-140, -50), g: -15, size: Math.random() < 0.3 ? 3 : 2, color: i % 3 ? SJ_GOLD : '#ffffff', life: rand(0.6, 1.1), t: 0, add: true });
  }
}

Object.assign(SKILL_FX, {
  starJudgment: {
    // 검을 하늘로 치켜들고 살짝 떠올라 성좌를 부르다가, 마지막 타격에 내리긋는다
    pose(u, a) {
      const D = a.k ? a.k.dur : 2.6, t = u * D, tf = a.k ? sjLastT(a) : 0.86 * D;
      if (t < tf - 0.12) {
        const r = easeOut(segU(t, 0, 0.35)), bob = Math.sin(t * 5) * 1.5 * r;
        return { wa: mix(-1.0, -1.62, r), sy: 1 + 0.06 * r, lift: 7 * r + bob, skew: -0.08 * r };
      }
      if (t < tf) { const d = easeIn(segU(t, tf - 0.12, tf)); return { wa: mix(-1.62, 1.1, d), skew: mix(-0.08, 0.38, d), sy: mix(1.06, 0.86, d), sx: mix(1, 1.1, d), lift: 7 * (1 - d), dx: 5 * d }; }
      const r = easeOut(segU(t, tf + 0.08, D));
      return { wa: mix(1.1, -1.0, r), skew: 0.38 * (1 - r), sy: mix(0.86, 1, r), dx: 5 * (1 - r) };
    },
    cues: (a) => {
      const D = a.k.dur, m = a.mast, n = a.k.hits.length, tf = sjLastT(a), list = [];
      const at = (sec, fn) => list.push([Math.max(0.001, sec / D), fn]);
      at(0.01, (a) => sjSkyFx(a, D - 0.02, m >= 3, m >= 3 ? 1.0 : 99));
      if (m === 0) at(0.7, (a) => sjBigStarFx(a, 0, tf - 0.7));
      if (m === 1) at(0.01, (a) => sjKnightFx(a));
      if (m === 2) {
        at(0.01, (a) => sjZodiacFx(a));
        at(sjHitT(a, 0) - 0.1, (a) => sjRainFx(a, sjHitT(a, n - 2) - sjHitT(a, 0) + 0.25, Math.max(25, W / 9)));
      }
      if (m >= 3) {
        at(0.6, (a) => sjRiftFx(a, 0.6, sjHitT(a, 12), tf));
        at(0.95, (a) => sjStarDropFx(a, 1.25));
        at(tf - 0.2, (a) => sjGenesisFx(a, 0.2));
      }
      // 잔타마다 별똥 하나가 그 타격 순간에 맞춰 떨어진다 (Lv1 은 하늘에서, ★ 는 성좌의 별에서, ★★ 는 그 차례의 성좌에서, ★★★ 는 하늘의 틈에서)
      const smalls = m >= 3 ? 12 : n - 1, fall = m >= 2 ? 0.2 : 0.24;
      for (let i = 0; i < smalls; i++) {
        at(sjHitT(a, i) - fall, (a) => {
          const tg = sjAim(a, i), gy = groundY();
          let x0 = tg.x - a.dir * rand(40, 90), y0 = 4;
          if (m === 1) { const p = sjFigPt(a, SJ_FIG.order[(i * 5 + 3) % SJ_FIG.order.length]); x0 = p.x; y0 = p.y; }
          if (m === 2 && a.sjCons) [x0, y0] = a.sjCons[i].pts[0];
          if (m >= 3) { x0 = tg.x + rand(-60, 60); y0 = a.sjRiftY ? a.sjRiftY(x0) : 26; }
          sjFallFx(a, 0, fall, x0, y0, tg.x, gy - 8, m >= 3 ? 1.6 : m ? 1.3 : 1.5, m >= 3 && i % 2 ? SJ_GOLD : SJ_BLUE);
        });
      }
      return list.sort((p, q) => p[0] - q[0]);
    },
    hit(a, i, n) {
      const m = a.mast, last = i === n - 1, gy = groundY(), tgs = a.targets(i);
      if (!last && !(m >= 3 && i === 12)) {
        const tg = sjAim(a, i);
        sjLandFx(tg.x, gy - 8, m >= 2 ? 0.8 : 1, m >= 3 && i % 2 ? SJ_GOLD : SJ_BLUE);
        for (const t of tgs) if (t !== tg) sjTwinkle(t.x, t.y, 6, SJ_BLUE, 0.25);
        impact({ stop: m >= 2 ? 0.015 : 0.035, shake: m >= 2 ? 0.08 : 0.14 });
        return;
      }
      if (m >= 3 && i === 12) {
        // 하늘이 활짝 열린다: 틈에서 대상마다 가는 빛창이 꽂힌다
        sjFlash(a, '255,250,230', 0.4, 0.3);
        for (const t of tgs) {
          const y0 = a.sjRiftY ? a.sjRiftY(t.x) : 26;
          skFx(null, 0, 0.35, (u) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - u; ctx.fillStyle = SJ_GOLD; ctx.fillRect(t.x - 6, y0, 12, gy - y0); ctx.fillStyle = '#ffffff'; ctx.fillRect(t.x - 2, y0, 4, gy - y0); ctx.restore(); });
          sjLandFx(t.x, gy - 8, 1.4, SJ_GOLD);
        }
        impact({ stop: 0.12, shake: 0.45 });
        return;
      }
      // 마무리 일격
      const tx = a.tx();
      if (m === 0) {
        sjNovaFx(tx, a.ty(), 28, 0.8);
        sjFlash(a, '200,230,255', 0.35, 0.3);
        impact({ stop: 0.16, shake: 0.5 });
      } else if (m === 1) {
        sjCutFx(tx, a.ty(), SJ_BLUE, 0.75);
        for (const t of tgs) sjNovaFx(t.x, t.y, 22, 0.7);
        sjFlash(a, '210,235,255', 0.45, 0.32);
        impact({ stop: 0.2, shake: 0.6 });
      } else if (m === 2) {
        const py = gy - 52;
        sjNovaFx(tx, py, 38, 0.9);
        skFx(null, 0, 0.4, (u) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - u; ctx.fillStyle = '#ffffff'; ctx.fillRect(tx - 3, py, 6, gy - py); ctx.restore(); });
        for (const t of tgs) sjLandFx(t.x, gy - 8, 1.5);
        sjFlash(a, '220,240,255', 0.55, 0.35);
        impact({ stop: 0.22, shake: 0.7 });
      } else {
        sjGenesisBurst(a);
        for (const t of tgs) sjNovaFx(t.x, t.y, 30, 0.9, SJ_GOLD);
        impact({ stop: 0.28, shake: 0.85 });
      }
    },
    // 맞은 자리에 작은 네 갈래 별이 반짝인다
    marks(a, t, pow, i) { sjTwinkle(t.x + rand(-6, 6), t.y + rand(-8, 4), 5 + 2 * Math.min(2, pow), i % 2 ? SJ_PALE : SJ_BLUE, 0.3); },
    // 치켜든 칼끝에서 별가루가 하늘로 흩날린다
    tick(a, u) {
      if (u > 0.85 || Math.random() > 0.5) return;
      const g = gripOf(a), L = 10 * PX;
      parts.push({ x: g.x + Math.cos(g.ang) * L + rand(-3, 3), y: g.y + Math.sin(g.ang) * L, vx: rand(-15, 15), vy: rand(-60, -20), g: -10, size: 2, color: Math.random() < 0.6 ? SJ_BLUE : '#ffffff', life: rand(0.3, 0.5), t: 0, add: true });
    },
    kb: 20,
  },
});
