'use strict';
// 석궁사수 연출 (arbalest). 수치·단계는 src/classes.js 의 SKILLS.blastBolt · boltStorm
// ── 폭열탄 ──
//  Lv1 「무거운 한 발」 묵직한 쇠뇌 살 한 발이 곧게 날아가 박힌다
//  ★ 「폭열탄」 폭약 통을 단 살이 날아가 맞은 자리에서 주황 폭발 — 파편과 검은 연기, 그을음
//  ★★ 「산탄 폭열탄」 살이 공중에서 셋으로 갈라져 대상 앞·뒤에 차례로 떨어져 터진다
//  ★★★ 「공성 폭격」 석궁을 하늘로 치켜들어 거대한 폭탄 살을 쏘아 올리면 — 포물선을 그리며 떨어져 버섯구름처럼 터진다 (땅이 패이고 하얀 섬광)
// ── 다연장 사격 ──
//  Lv1 「이연발」 살 두 발을 잇달아
//  ★ 「다연장 사격」 탄창을 돌려 다섯 발 — 쏠 때마다 탄피(빈 살통)가 튀고 반동으로 몸이 밀린다
//  ★★ 「쇠비」 하늘로 쏘아 올린 살들이 쇠비가 되어 적 머리 위에 쏟아져 박힌다
//  ★★★ 「강철 폭풍」 석궁이 통째로 돌며 사방에 살을 뿌리고 — 마지막에 거대한 살이 일직선을 꿰어 화면 가장자리에 박힌다 (ballistaBoltFx)
// 하단바 전체를 덮지 않는다: 쇠비도 대상 둘레에만 떨어진다

const AB_COL = { main: '#ffb86b', fire: '#ff7a2a', smoke: '#3a3030', steel: '#c9c2b4', wood: '#8a5a2b' };

// 석궁 활대 앞(살이 나가는 자리) 화면 위치 — world.js heroRig·drawCrossbow 와 같은 셈
function abMuzzle(a) {
  const p = castPose(a.owner) || {}, sy = p.sy || 1, k = p.skew || 0;
  const face = p.facing != null ? p.facing : a.dir;
  const w = WEAPONS[CLASSES[a.cls].weapon], L = (w.size || 14) * 0.9 + 12;
  const hx = a.px() + face * (5 * PX + Math.round(k * 3 * PX));
  const hy = groundY() - (p.lift || 0) - sprCells(SPR.knightLegs[0]) * PX * sy - 3 * PX;
  const ang = p.bowA || 0;
  return { x: hx + face * Math.cos(ang) * L, y: hy + Math.sin(ang) * L, ang: face > 0 ? ang : Math.PI - ang };
}
// 쇠뇌 살 한 자루 (끝이 (x, y), ang 방향). bomb 이면 뒤쪽에 폭약 통
function abBolt(x, y, ang, len = 16, bomb = false, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = AB_COL.wood; ctx.fillRect(-len, -1.5, len - 2, 3);
  ctx.fillStyle = AB_COL.steel; ctx.beginPath(); ctx.moveTo(-3, -3.5); ctx.lineTo(4, 0); ctx.lineTo(-3, 3.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8d9b0'; ctx.fillRect(-len, -3.5, 4, 2); ctx.fillRect(-len, 1.5, 4, 2);
  if (bomb) { ctx.fillStyle = '#4a3a30'; ctx.fillRect(-len * 0.7, -4, 7, 8); ctx.fillStyle = AB_COL.fire; ctx.fillRect(-len * 0.7 + 2, -5, 3, 1.5 + Math.random()); }
  ctx.restore();
}
// 날아가는 살: (x0, y0) 에서 (x1, y1) 까지 hitT 초. 뒤에 가죽색 꼬리. bomb 이면 폭약 통에서 불티
function abFlyFx(x0, y0, x1, y1, hitT, bomb = false, len = 16) {
  const ang = Math.atan2(y1 - y0, x1 - x0);
  skFx(null, 0, hitT, (u) => {
    const x = mix(x0, x1, u), y = mix(y0, y1, u);
    ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(230,210,160,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - Math.cos(ang) * 30, y - Math.sin(ang) * 30); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
    abBolt(x, y, ang, len, bomb);
  }, null, (u) => { if (bomb && Math.random() < 0.7) { const x = mix(x0, x1, u), y = mix(y0, y1, u); parts.push({ x, y, vx: rand(-20, 20), vy: rand(-20, 10), g: 40, size: 1.5, color: Math.random() < 0.5 ? AB_COL.fire : '#ffe066', life: 0.2, t: 0, add: true }); } });
}
// 포물선으로 날아가는 폭탄 살 (★★ 산탄 조각 · ★★★ 공성 폭격). peak 는 꼭대기 높이(px, 화면 위쪽이 작다)
function abArcFx(x0, y0, x1, y1, flight, peak, bomb = true, len = 16, onLand) {
  skFx(null, 0, flight, (u) => {
    const x = mix(x0, x1, u), y = mix(y0, y1, u) - (peak) * 4 * u * (1 - u);
    const nu = Math.min(1, u + 0.02), nx = mix(x0, x1, nu), ny = mix(y0, y1, nu) - peak * 4 * nu * (1 - nu);
    abBolt(x, y, Math.atan2(ny - y, nx - x), len, bomb);
  }, onLand, (u) => { if (Math.random() < 0.6) { const x = mix(x0, x1, u), y = mix(y0, y1, u) - peak * 4 * u * (1 - u); parts.push({ x, y, vx: rand(-10, 10), vy: rand(-10, 10), g: 0, size: 2, color: '#6a6a6a', life: 0.35, t: 0 }); } });
}
// 폭발: 주황 불덩이 → 검은 연기 뭉치 + 파편 + 충격 고리 + 땅의 그을음
function abBlastFx(x, y, size = 1) {
  size *= 0.8 + 0.2 * fxVis;
  skFx(null, 0, 0.45, (u) => {
    const r = (10 + 26 * easeOut(Math.min(1, u * 2))) * size, fade = u < 0.3 ? 1 : 1 - (u - 0.3) / 0.7;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade;
    ctx.fillStyle = AB_COL.fire; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r * 0.25 * (1 - u), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
  const puffs = [];
  for (let i = 0; i < Math.round(6 * size); i++) puffs.push({ an: rand(0, Math.PI * 2), v: rand(20, 50) * size, r: rand(6, 11) * size });
  skFx(null, 0.08, 0.9, (u) => {
    ctx.save(); ctx.globalAlpha = (1 - u) * 0.8; ctx.fillStyle = AB_COL.smoke;
    for (const p of puffs) { ctx.beginPath(); ctx.arc(x + Math.cos(p.an) * p.v * u * 1.2, y - 10 * u + Math.sin(p.an) * p.v * u * 0.7, p.r * (0.6 + u), 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  });
  burst(x, y, Math.round(14 * size), [AB_COL.fire, '#ffe066', AB_COL.steel], 180 * size, 2, 260);
  ringFx(x, AB_COL.main, 1.1 * size, 0.45);
  scorchFx(x, groundY() - 2, AB_COL.smoke, 0.9);
}
// ★★★ 버섯구름: 큰 폭발 뒤 불기둥이 솟고 머리가 부풀어 오른다
function abMushroomFx(x, life = 1.2) {
  const gy = groundY();
  skFx(null, 0, life, (u) => {
    const h = 70 * easeOut(Math.min(1, u * 1.6)), fade = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = AB_COL.smoke; ctx.fillRect(x - 9, gy - h, 18, h);
    ctx.fillStyle = AB_COL.fire; ctx.globalAlpha = fade * 0.5 * (1 - u); ctx.fillRect(x - 5, gy - h, 10, h);
    ctx.globalAlpha = fade;
    for (const [dx, r] of [[-18, 14], [0, 20], [18, 14], [-8, 12], [8, 12]]) { ctx.fillStyle = '#4a4040'; ctx.beginPath(); ctx.arc(x + dx * (0.6 + u * 0.6), gy - h - 4, r * (0.5 + u * 0.7), 0, Math.PI * 2); ctx.fill(); }
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade * (1 - u) * 0.8;
    ctx.fillStyle = AB_COL.fire; ctx.beginPath(); ctx.arc(x, gy - h - 4, 16 * (0.5 + u), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
}
// 쏠 때 튀는 빈 살통(탄피)
function abShell(a) {
  const h = hand(a);
  parts.push({ x: h.x - a.dir * 4, y: h.y - 2, vx: -a.dir * rand(30, 70), vy: rand(-90, -50), g: 320, size: 2, color: AB_COL.steel, life: 0.5, t: 0 });
}
// 총구 섬광 + 흙먼지 반동
function abMuzzleFlash(a, size = 1) {
  const m = abMuzzle(a);
  burst(m.x, m.y, Math.round(6 * size), ['#ffffff', '#ffe066'], 70 * size, 2, 0);
  starFx(m.x, m.y, 10 * size, '#ffe8c0', 0.16);
  for (let i = 0; i < 4; i++) parts.push({ x: a.px() - a.dir * 6, y: groundY() - 2, vx: -a.dir * rand(40, 100), vy: rand(-40, -10), g: 200, size: 2, color: '#c9b38a', life: 0.35, t: 0 });
}
// 하늘에서 떨어져 박히는 살 (★★ 쇠비): x 에 0.14초에 꽂히고 잠깐 떨린다
function abRainBolt(x, delay = 0, stick = 0.5) {
  const gy = groundY(), x0 = x + rand(-6, 6), ang = Math.PI / 2 + rand(-0.2, 0.2);
  skFx(null, delay, 0.14, (u) => {
    const y = mix(-20, gy - 2, easeIn(u));
    ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(230,210,160,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0 - Math.cos(ang) * 40, y - 40); ctx.lineTo(x0, y); ctx.stroke(); ctx.restore();
    abBolt(x0, y, ang, 14);
  }, () => {
    skFx(null, 0, stick, (u) => abBolt(x0 + Math.sin(u * 60) * (1 - u) * 1.5, gy - 2 + 3, ang, 14, false, u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4));
    burst(x0, gy - 3, 4, ['#c9b38a', AB_COL.steel], 70, 2, 220);
  });
}
// ★★★ 사방으로 뿌리는 살: 기사 둘레의 무작위 점으로 날아가 박힌다
function abSprayBolt(a) {
  const m = abMuzzle(a), far = a.dir * rand(40, 150), y1 = groundY() - rand(2, 40), x1 = a.px() + far + rand(-20, 20);
  abFlyFx(m.x, m.y, x1, y1, 0.08, false, 14);
  skFx(null, 0.08, 0.35, (u) => abBolt(x1, y1, Math.atan2(y1 - m.y, x1 - m.x), 14, false, 1 - u));
}

// 견착 자세 (★ 폭열탄·다연장의 틀): pull 로 장전하고 shoot 순간 반동(dx 뒤로, skew 뒤로)
function abBracePose(t, pullTo, shootAt, recoil = 6, bowA = 0) {
  if (t < pullTo) { const k = easeOut(t / pullTo); return { pull: 12 * k, skew: -0.06 * k, sy: 1 - 0.04 * k, bowA }; }
  if (t < shootAt) return { pull: 12 + Math.sin(clock * 20) * 0.5, skew: -0.08, sy: 0.96, bowA };
  if (t < shootAt + 0.1) { const r = easeOut(segU(t, shootAt, shootAt + 0.1)); return { pull: 0, dx: -recoil * r, skew: -0.08 - 0.14 * r, sy: 0.96, bowA: bowA - 0.15 * r }; }
  return null;
}

Object.assign(SKILL_FX, {
  blastBolt: {
    pose(u, a) {
      const m = a.mast || 0, d = a.k ? a.k.dur : 1.1, t = u * d, hits = a.k ? a.k.hits : [[0.6]];
      if (m === 0) {
        const p = abBracePose(t, 0.3, hits[0][0] * d - 0.06, 4);
        if (p) return p;
        const r = easeOut(segU(t, hits[0][0] * d + 0.04, d)); return { dx: -4 * (1 - r), skew: -0.2 * (1 - r), bowA: -0.15 * (1 - r) };
      }
      if (m <= 2) {
        const fire = hits[0][0] * d - 0.08, p = abBracePose(t, 0.42, fire, 7);
        if (p) return p;
        if (t < fire + 0.3) return { dx: -7, skew: -0.22, sy: 0.96, bowA: -0.15 };
        const r = easeOut(segU(t, fire + 0.3, d)); return { dx: -7 * (1 - r), skew: -0.22 * (1 - r), bowA: -0.15 * (1 - r) };
      }
      // ★★★ 하늘로 겨눈다 (bowA -1.0): 장전 → 발사(0.45) → 큰 반동 → 떨어질 때까지 고개를 들고 본다 → 복귀
      if (t < 0.45) { const p = abBracePose(t, 0.35, 0.45, 10, -1.0); if (p) return p; }
      if (t < 0.55) { const r = easeOut(segU(t, 0.45, 0.55)); return { pull: 0, dx: -10 * r, skew: -0.28 * r, sy: 0.92, bowA: -1.0 - 0.25 * r }; }
      if (t < 1.6) { const r = segU(t, 0.55, 1.6); return { pull: 0, dx: -10 + 4 * r, skew: -0.28 + 0.1 * r, sy: 0.92 + 0.04 * r, bowA: -1.25 + 0.6 * r }; }
      if (t < 1.75) return { pull: 0, dx: -6, skew: -0.3, sy: 0.9, bowA: -0.4 };
      const r = easeOut(segU(t, 1.75, d)); return { pull: 0, dx: -6 * (1 - r), skew: -0.3 * (1 - r), sy: mix(0.9, 1, r), bowA: -0.4 * (1 - r) };
    },
    tick(a, u) {
      const m = a.mast, d = a.k.dur, t = u * d;
      if (!m) return;
      const fire = m >= 3 ? 0.45 : a.k.hits[0][0] * d - 0.08;
      if (t > 0.1 && t < fire && Math.random() < 0.5) { const mz = abMuzzle(a); parts.push({ x: mz.x - a.dir * rand(4, 12), y: mz.y + rand(-3, 3), vx: 0, vy: rand(-25, -10), g: 0, size: 1.5, color: Math.random() < 0.5 ? AB_COL.fire : '#ffe066', life: 0.25, t: 0, add: true }); }
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast, hits = a.k.hits;
      if (m === 0) return [[(hits[0][0] * d - 0.06) / d, (a) => { const mz = abMuzzle(a); abFlyFx(mz.x, mz.y, a.tx(), a.ty(), 0.06); abMuzzleFlash(a, 0.8); abShell(a); impact({ shake: 0.1 }); }]];
      if (m === 1) return [[(hits[0][0] * d - 0.08) / d, (a) => { const mz = abMuzzle(a); abFlyFx(mz.x, mz.y, a.tx(), a.ty(), 0.08, true); abMuzzleFlash(a); abShell(a); impact({ stop: 0.03, shake: 0.18 }); }]];
      if (m === 2) {
        const fire = hits[0][0] * d - 0.08;
        return [[fire / d, (a) => {
          const mz = abMuzzle(a), tx = a.tx(), ty = a.ty(), mx = mix(mz.x, tx, 0.55), my = mix(mz.y, ty, 0.55) - 10;
          abMuzzleFlash(a); abShell(a); impact({ stop: 0.03, shake: 0.18 });
          abFlyFx(mz.x, mz.y, mx, my, 0.05, true);
          // 갈라지는 순간 작은 섬광, 조각 셋이 타격 시점에 맞춰 떨어진다
          skLater(a, 0.05, () => {
            burst(mx, my, 8, ['#ffe066', '#ffffff'], 90, 2, 0);
            hits.forEach((h, j) => { const land = h[0] * d - fire - 0.05, lx = a.targets(j)[0] ? a.targets(j)[0].x : tx; abArcFx(mx, my, lx + (j - 1) * 22, groundY() - 4, Math.max(0.06, land), 18 + j * 6, true, 11); });
          });
        }]];
      }
      const land = hits[1][0] * d;
      return [
        [0.45 / d, (a) => {
          const mz = abMuzzle(a), tx = a.tx();
          abMuzzleFlash(a, 1.6); abShell(a); impact({ stop: 0.06, shake: 0.35 });
          ringFx(a.px(), AB_COL.main, 0.8, 0.35);
          abArcFx(mz.x, mz.y, tx, groundY() - 4, land - 0.47, 140, true, 26);
        }],
        [(land - 0.25) / d, (a) => { const x = a.tx(); skFx(null, 0, 0.25, (u) => { ctx.save(); ctx.globalAlpha = 0.5 * u; ctx.fillStyle = '#1b1d27'; ctx.beginPath(); ctx.ellipse(x, groundY() - 1, 24 * u, 5 * u, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }); }],
        [(land - 0.01) / d, (a) => {
          const x = a.tx();
          impact({ stop: 0.18, shake: 0.7 });
          abBlastFx(x, groundY() - 12, 2.2);
          abMushroomFx(x);
          craterFx(x, 1.0);
          debris(x, 24, ['#5a4a42', '#c9b38a', AB_COL.fire], 1.9);
          skFx(null, 0, 0.3, (u) => dimBand(0.7 * (1 - u), '255,240,220'));
        }],
      ];
    },
    hit(a, i, n) {
      const m = a.mast, tg = a.targets(i);
      if (m === 0) { for (const t of tg) burst(t.x, t.y, 8, [AB_COL.steel, '#ffffff'], 120); impact({ stop: 0.05, shake: 0.15 }); return; }
      if (m === 1) { const t = tg[0] || { x: a.tx(), y: a.ty() }; abBlastFx(t.x, t.y, 1.2); impact({ stop: 0.1, shake: 0.4 }); return; }
      if (m === 2) { const t = tg[0] || { x: a.tx(), y: a.ty() }; abBlastFx(t.x + (i - 1) * 22, t.y + 6, 0.9); impact({ stop: 0.05, shake: 0.25 }); return; }
      if (i === 0) { for (const t of tg) burst(t.x, t.y, 6, ['#ffffff', '#ffe066'], 90); return; }
      for (const t of tg) burst(t.x, t.y, 16, [AB_COL.fire, '#ffe066', '#ffffff'], 220, 3, 280);
    },
    marks(a, t, pow, i) { if (a.mast === 0 || (a.mast >= 3 && i === 0)) drillFx(t.x, t.y, a.dir, AB_COL.steel, 0.45); },
    kb: 22, launch: false,
  },

  boltStorm: {
    pose(u, a) {
      const m = a.mast || 0, d = a.k ? a.k.dur : 1.6, t = u * d, hits = a.k ? a.k.hits : [[0.5]];
      if (m === 0) { const p = bowPullPose(u, a, 8); p.skew = -0.05; return p; }
      if (m === 1) {
        // 쏠 때마다 반동: 가장 가까운 타격 시점 뒤 0.1초 동안 뒤로 밀린다
        let rec = 0;
        for (const h of hits) { const ht = h[0] * d; if (t >= ht - 0.02 && t < ht + 0.12) rec = Math.max(rec, 1 - segU(t, ht - 0.02, ht + 0.12)); }
        const p = bowPullPose(u, a, 10); p.skew = -0.08 - 0.12 * rec; p.dx = (p.dx || 0) - 5 * rec; p.sy = 0.96; return p;
      }
      if (m === 2) {
        // 하늘을 향해 장전(0~0.5) → 발사(0.55) → 반동 → 떨어지는 살을 본다 → 복귀
        if (t < 0.5) { const k = easeOut(t / 0.5); return { pull: 12 * k, bowA: -1.2 * k, skew: -0.1 * k, sy: 1 - 0.05 * k }; }
        if (t < 0.55) return { pull: 12, bowA: -1.2, skew: -0.1, sy: 0.95 };
        if (t < 0.7) { const r = easeOut(segU(t, 0.55, 0.7)); return { pull: 0, bowA: -1.2 - 0.2 * r, dx: -8 * r, skew: -0.1 - 0.16 * r, sy: 0.95 }; }
        if (t < d - 0.3) { const r = segU(t, 0.7, d - 0.3); return { pull: 0, bowA: -1.4 + 0.9 * r, dx: -8 + 4 * r, skew: -0.26 + 0.12 * r, sy: 0.95 + 0.03 * r }; }
        const r = easeOut(segU(t, d - 0.3, d)); return { pull: 0, bowA: -0.5 * (1 - r), dx: -4 * (1 - r), skew: -0.14 * (1 - r) };
      }
      // ★★★ 강철 폭풍: 장전(0~0.4) → 석궁이 돌며(0.5~1.9, bowA 가 두 바퀴) 살을 뿌린다 → 앞을 겨눠 거대한 살(2.06) → 반동 → 복귀
      const fin = hits[hits.length - 1][0] * d;
      if (t < 0.4) { const k = easeOut(t / 0.4); return { pull: 12 * k, skew: -0.08 * k, sy: 1 - 0.06 * k, lift: 2 * k }; }
      if (t < 0.5) return { pull: 12, skew: -0.08, sy: 0.94, lift: 2 };
      if (t < 1.9) { const s = segU(t, 0.5, 1.9), e = s < 0.5 ? 2 * s * s : 1 - 2 * (1 - s) ** 2; return { pull: 6 + 6 * Math.abs(Math.sin(t * 40)), bowA: -e * Math.PI * 4, skew: 0.05 * Math.sin(t * 20), sy: 0.94, lift: 4 + 2 * Math.sin(t * 16) }; }
      if (t < fin - 0.06) { const r = easeOut(segU(t, 1.9, fin - 0.06)); return { pull: 13 * r, bowA: 0, skew: -0.1 * r, sy: 0.92, lift: 4 * (1 - r) }; }
      if (t < fin + 0.1) { const r = easeOut(segU(t, fin - 0.06, fin + 0.1)); return { pull: 13 * (1 - r), bowA: -0.2 * r, dx: -14 * r, skew: -0.1 - 0.28 * r, sy: 0.92 }; }
      const r = easeOut(segU(t, fin + 0.1, d)); return { pull: 0, bowA: -0.2 * (1 - r), dx: -14 * (1 - r), skew: -0.38 * (1 - r), sy: mix(0.92, 1, r) };
    },
    tick(a, u) {
      const m = a.mast, d = a.k.dur, t = u * d;
      if (m >= 3 && t > 0.5 && t < 1.9) {
        a.abSpray = (a.abSpray || 0) + 1;
        if (a.abSpray % 4 === 0) { abSprayBolt(a); abShell(a); if (a.abSpray % 8 === 0) impact({ shake: 0.06 }); }
      }
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast, hits = a.k.hits;
      if (m === 0) return hits.map((h) => [(h[0] * d - 0.05) / d, (a) => { const mz = abMuzzle(a); abFlyFx(mz.x, mz.y, a.tx(), a.ty(), 0.05, false, 14); abMuzzleFlash(a, 0.7); }]);
      if (m === 1) return hits.map((h, j) => [(h[0] * d - 0.06) / d, (a) => {
        const mz = abMuzzle(a), tg = a.targets(j), t = tg[j % Math.max(1, tg.length)] || { x: a.tx(), y: a.ty() };
        abFlyFx(mz.x, mz.y, t.x, t.y + rand(-6, 6), 0.06, false, 14); abMuzzleFlash(a, 0.9); abShell(a); impact({ shake: 0.08 });
      }]);
      if (m === 2) return [
        [0.55 / d, (a) => {
          const mz = abMuzzle(a);
          abMuzzleFlash(a, 1.3); impact({ stop: 0.04, shake: 0.25 });
          for (let j = 0; j < 4; j++) abShell(a);
          // 하늘로 올라가는 살 다발
          for (let j = 0; j < 5; j++) { const x1 = mz.x + a.dir * (30 + j * 14) + rand(-6, 6); skFx(null, j * 0.02, 0.22, (u) => abBolt(mix(mz.x, x1, u), mix(mz.y, -30, easeOut(u)), Math.atan2(-30 - mz.y, x1 - mz.x), 14, false, 1 - u * 0.5)); }
        }],
        ...hits.map((h, j) => [(h[0] * d - 0.14) / d, (a) => {
          const tg = a.targets(j), cx = tg.length ? tg[j % tg.length].x : a.tx();
          abRainBolt(cx + rand(-14, 14), 0); abRainBolt(cx + rand(-40, 40), 0.03, 0.4);
          if (j % 2) abRainBolt(cx + rand(-50, 50), 0.06, 0.35);
        }]),
      ];
      const fin = hits[hits.length - 1][0] * d;
      return [
        [0.5 / d, (a) => { ringFx(a.px(), AB_COL.main, 1.0, 0.4); impact({ shake: 0.1 }); }],
        [(fin - 0.08) / d, (a) => {
          abMuzzleFlash(a, 1.8); impact({ stop: 0.1, shake: 0.5 });
          ballistaBoltFx(a, groundY() - 24, 1.0);
          for (let j = 0; j < 8; j++) parts.push({ x: a.px(), y: groundY() - 2, vx: -a.dir * rand(60, 160), vy: rand(-70, -10), g: 200, size: 3, color: '#c9b38a', life: 0.45, t: 0 });
          skFx(null, 0, 0.2, (u) => dimBand(0.4 * (1 - u), '255,240,220'));
        }],
      ];
    },
    hit(a, i, n) {
      const m = a.mast, tg = a.targets(i), last = i === n - 1;
      if (m === 0) { for (const t of tg) burst(t.x, t.y, 5, [AB_COL.steel, '#ffffff'], 100); impact({ shake: 0.06 }); return; }
      if (m >= 3 && last) { for (const t of tg) { burst(t.x, t.y, 22, [AB_COL.steel, '#ffffff', AB_COL.main], 220, 3, 280); starFx(t.x, t.y, 14, '#ffe8c0', 0.3); } return; }
      for (const t of tg) burst(t.x, t.y, m === 2 ? 6 : 8, [AB_COL.steel, '#ffffff', '#c9b38a'], 130, 2, 240);
      impact(m === 1 ? { stop: 0.02, shake: 0.1 } : { shake: 0.06 });
    },
    marks(a, t, pow, i, n) {
      if (a.mast === 0) return;
      if (a.mast >= 3 && i === n - 1) { drillFx(t.x, t.y, a.dir, AB_COL.main, 0.6); slashMarkFx(t.x, t.y, Math.PI / 2, 28 + 8 * pow, '#ffffff', 2.5, 0.4, 0.04); return; }
      if (a.mast === 2) { crackFx(t.x, t.y + 6, AB_COL.steel, 0.4); return; }
      if (i % 2 === 0) drillFx(t.x, t.y + rand(-4, 4), a.dir, AB_COL.steel, 0.4);
    },
    kb: 16,
  },
});
