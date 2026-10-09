'use strict';
// 얼음창 연출 (cryomancer). 수치·단계는 src/classes.js 의 SKILLS.iceLance
//  Lv1 「얼음 화살」 지팡이 끝에서 가느다란 얼음 조각 하나가 곧게 날아간다
//  ★ 「얼음창」 지팡이 끝에 굵은 얼음창이 맺혀 일직선을 꿰뚫고 — 맞은 자리에 서리꽃이 피고 땅에 서리가 번진다
//  ★★ 「얼음창 일제」 등 뒤 허공에 얼음창 셋이 결정처럼 맺혀 떠오르고, 지팡이를 휘두를 때마다 하나씩 날아간다
//  ★★★ 「빙창 폭우」 대상 위 하늘에 얼음창이 하나씩 맺혀 가득 차 네 번에 나눠 쏟아지고 —
//        마지막에 거대한 빙창이 내리꽂혀 땅에 박힌 채 금이 가다가 산산이 깨진다
// 하단바 전체를 덮지 않는다: 하늘의 얼음창도 대상 둘레에만 맺힌다

const IL_ICE = { line: '#1b3f6a', dark: '#5fb4dc', light: '#d8f4ff', glow: '#9fe8ff' };

// 지팡이 끝(마력 구슬) 화면 위치 — world.js heroRig·drawStaff 와 같은 셈 (자세의 손 자리 + 지팡이 각도·길이)
function ilTip(a) {
  const p = castPose(a.owner) || {}, sy = p.sy || 1, k = p.skew || 0;
  const face = p.facing != null ? p.facing : a.dir;
  const st = (WEAPONS[CLASSES[a.cls].weapon] || {}).staff || { len: 8 };
  const hx = a.px() + face * (5 * PX + Math.round(k * 3 * PX));
  const hy = groundY() - (p.lift || 0) - sprCells(SPR.knightLegs[0]) * PX * sy - 3 * PX;
  const ang = staffAngle(p.bowA || 0), L = (st.len + 1.6) * PX;
  return { x: hx + face * Math.cos(ang) * L, y: hy + Math.sin(ang) * L };
}

// 키 자세 사이를 부드럽게 잇는다: keys = [[초, { bowA, pull, dx, sy, skew, lift }], ...]
function ilKeys(t, keys) {
  let i = 1;
  while (i < keys.length - 1 && keys[i][0] < t) i++;
  const [t0, p0] = keys[i - 1], [t1, p1] = keys[i];
  const v = clamp01((t - t0) / Math.max(0.001, t1 - t0)), w = v * v * (3 - 2 * v);
  const out = {};
  for (const key of ['bowA', 'pull', 'dx', 'sy', 'skew', 'lift']) {
    const d = key === 'sy' ? 1 : 0;
    out[key] = mix(p0[key] != null ? p0[key] : d, p1[key] != null ? p1[key] : d, w);
  }
  return out;
}

// 얼음창 한 자루: 끝(x, y)이 ang 방향을 향하고 뒤로 len 만큼. 어두운 테두리 → 아랫면(짙은 청) → 윗면(밝은 청백) → 흰 능선, 꼬리에 결정 가시
function ilLance(x, y, ang, len, wid, alpha = 1, glow = 0) {
  if (len < 2 || alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.globalAlpha = Math.min(1, alpha);
  if (glow) { ctx.shadowColor = IL_ICE.glow; ctx.shadowBlur = glow; }
  const h = wid / 2;
  const body = [[0, 0], [-len * 0.28, -h], [-len * 0.84, -h * 0.62], [-len, 0], [-len * 0.84, h * 0.62], [-len * 0.28, h]];
  const path = (pts) => { ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); };
  // 꼬리 결정 가시 (몸통 뒤로 비스듬히 갈라진다)
  ctx.fillStyle = IL_ICE.dark;
  path([[-len * 0.8, -h * 0.5], [-len - h * 1.1, -h * 1.5], [-len * 0.93, -h * 0.1]]); ctx.fill();
  path([[-len * 0.8, h * 0.5], [-len - h * 1.1, h * 1.5], [-len * 0.93, h * 0.1]]); ctx.fill();
  ctx.strokeStyle = IL_ICE.line; ctx.lineWidth = 1.5;
  path(body); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = IL_ICE.dark; ctx.fill();
  ctx.fillStyle = IL_ICE.light;
  path([[0, 0], [-len * 0.28, -h], [-len * 0.84, -h * 0.62], [-len, 0], [-len * 0.3, h * 0.15]]); ctx.fill();
  // 결정 면의 마디 (빛이 꺾이는 선)
  ctx.strokeStyle = 'rgba(27,63,106,0.45)'; ctx.lineWidth = 1;
  for (const f of [0.5, 0.7]) { ctx.beginPath(); ctx.moveTo(-len * f, -h * 0.85); ctx.lineTo(-len * (f + 0.07), h * 0.7); ctx.stroke(); }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-len * 0.82, -Math.max(1, h * 0.25), len * 0.72, 1);
  ctx.fillRect(-Math.max(2, len * 0.08), -0.5, Math.max(2, len * 0.08), 1);
  ctx.restore();
}

// 서리꽃: 여섯 갈래 가지가 뻗고 가지마다 잔가지가 돋는 눈꽃이 피었다 진다
function ilBloom(x, y, size, life = 0.6, delay = 0) {
  size *= 0.7 + 0.3 * fxVis;
  const rot = rand(0, Math.PI / 3);
  skFx(null, delay, life, (u) => {
    const g = easeOut(Math.min(1, u / 0.3)), fade = u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45, R = size * g;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot + u * 0.4);
    ctx.lineCap = 'round';
    for (const [col, lw, al] of [[IL_ICE.line, 3, 0.55], [IL_ICE.glow, 2, 0.9], ['#ffffff', 1, 1]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.globalAlpha = al * fade;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const an = (i / 6) * Math.PI * 2, c = Math.cos(an), s = Math.sin(an);
        ctx.moveTo(0, 0); ctx.lineTo(c * R, s * R);
        for (const [f, l] of [[0.45, 0.3], [0.72, 0.22]]) {
          const bx = c * R * f, by = s * R * f;
          for (const sd of [-0.65, 0.65]) { ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(an + sd) * R * l, by + Math.sin(an + sd) * R * l); }
        }
      }
      ctx.stroke();
    }
    ctx.globalAlpha = fade; ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  });
}

// 땅에 번지는 서리: 납작한 청백 얼룩 + 가장자리에 서는 작은 결정 가시
function ilFrostPatch(x, w, life = 1.0, delay = 0) {
  w *= 0.75 + 0.25 * fxVis;
  const ticks = [];
  for (let i = 0; i < Math.round(w / 4); i++) ticks.push([rand(-1, 1), rand(1, 4)]);
  skFx(null, delay, life, (u) => {
    const g = easeOut(Math.min(1, u / 0.25)), fade = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4, gy = groundY(), hw = w * g;
    ctx.save();
    ctx.globalAlpha = 0.45 * fade; ctx.fillStyle = '#cfefff';
    ctx.beginPath(); ctx.ellipse(x, gy, Math.max(0.1, hw), 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.8 * fade; ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(x - hw * 0.6), gy - 1, Math.round(hw * 1.2), 1);
    ctx.fillStyle = IL_ICE.glow;
    for (const [f, h] of ticks) ctx.fillRect(Math.round(x + f * hw), Math.round(gy - h * g), 1, Math.round(h * g));
    ctx.restore();
  });
}

// 얼음 조각이 흩어진다: 삼각 조각이 돌면서 날아가 떨어진다 (조각마다 밝은 면·어두운 면)
function ilShatter(x, y, n, size = 4, speed = 160, life = 0.7) {
  n = Math.max(2, Math.round(n * fxVis));
  const sh = [];
  for (let i = 0; i < n; i++) {
    const an = rand(0, Math.PI * 2), v = rand(0.35, 1) * speed;
    sh.push({ vx: Math.cos(an) * v, vy: Math.sin(an) * v - speed * 0.45, r: rand(0, 6), vr: rand(-14, 14), s: size * rand(0.6, 1.3), light: i % 3 !== 0 });
  }
  skFx(null, 0, life, (u) => {
    const t = u * life;
    ctx.save();
    ctx.globalAlpha = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
    for (const p of sh) {
      const px = x + p.vx * t, py = Math.min(groundY() - 1, y + p.vy * t + 260 * t * t);
      ctx.save();
      ctx.translate(px, py); ctx.rotate(p.r + p.vr * t);
      ctx.fillStyle = p.light ? IL_ICE.light : IL_ICE.dark;
      ctx.beginPath(); ctx.moveTo(p.s, 0); ctx.lineTo(-p.s * 0.6, -p.s * 0.7); ctx.lineTo(-p.s * 0.4, p.s * 0.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-1, -1, 1.5, 1.5);
      ctx.restore();
    }
    ctx.restore();
  });
}

// 대상에 박힌 얼음 가시 몇 개 (타격 자국 대신)
function ilSplinters(a, t, n, life = 0.5) {
  const list = [];
  for (let j = 0; j < n; j++) list.push([rand(-5, 5), rand(-9, 7), (a.dir > 0 ? 0 : Math.PI) + rand(-0.35, 0.35), rand(7, 11)]);
  skFx(null, 0, life, (u) => {
    const al = u < 0.5 ? 1 : 1 - (u - 0.5) / 0.5;
    for (const [ox, oy, an, L] of list) ilLance(t.x + ox + Math.cos(an) * 3, t.y + oy + Math.sin(an) * 3, an, L, 3, al);
  });
}

// 날아가는 얼음창: (x0, y0) 에서 대상(tx, ty)까지 hitT 초에 닿고, far 만큼 같은 방향으로 더 꿰뚫고 나간다.
// 지나간 자리에 차가운 빛 줄기와 서리 가루가 남는다
function ilFlyFx(a, x0, y0, tx, ty, hitT, len, wid, o = {}) {
  const ang = Math.atan2(ty - y0, tx - x0), dist = Math.max(1, Math.hypot(tx - x0, ty - y0)), v = dist / hitT;
  const far = o.far || 0, life = hitT + far / v + 0.05;
  const trail = o.trail != null ? o.trail : 1;
  skFx(null, 0, life, (u) => {
    const t = u * life, d = Math.min(dist + far, v * t), x = x0 + Math.cos(ang) * d, y = y0 + Math.sin(ang) * d;
    const out = far && d > dist ? 1 - (d - dist) / far : 1;
    if (trail) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const tl = Math.max(1, Math.min(d, 60 * trail));
      const g = ctx.createLinearGradient(x - Math.cos(ang) * tl, y - Math.sin(ang) * tl, x, y);
      g.addColorStop(0, 'rgba(159,232,255,0)'); g.addColorStop(1, `rgba(159,232,255,${0.55 * out})`);
      ctx.strokeStyle = g; ctx.lineWidth = Math.max(1, wid * 0.7);
      ctx.beginPath(); ctx.moveTo(x - Math.cos(ang) * tl, y - Math.sin(ang) * tl); ctx.lineTo(x, y); ctx.stroke();
      ctx.restore();
    }
    ilLance(x, y, ang, len, wid, out, o.glow || 0);
  }, null, (u) => {
    if (!trail || Math.random() > 0.7 * trail) return;
    const t = u * life, d = Math.min(dist + far, v * t);
    parts.push({ x: x0 + Math.cos(ang) * d + rand(-3, 3), y: y0 + Math.sin(ang) * d + rand(-2, 2), vx: rand(-15, 15), vy: rand(-10, 25), g: 60, size: Math.random() < 0.3 ? 2 : 1,
      color: Math.random() < 0.5 ? '#ffffff' : IL_ICE.glow, life: rand(0.3, 0.6), t: 0 });
  });
}

// 둘레에서 서리 가루가 (x, y)로 빨려 든다
function ilGather(x, y, r0, r1, sq = 1) {
  const an = rand(0, Math.PI * 2), r = rand(r0, r1);
  parts.push({ x: x + Math.cos(an) * r, y: y + Math.sin(an) * r * sq, vx: -Math.cos(an) * r * 4, vy: -Math.sin(an) * r * sq * 4, g: 0, size: 2,
    color: Math.random() < 0.5 ? '#ffffff' : IL_ICE.glow, life: 0.25, t: 0, add: true });
}

// ★ 지팡이 끝에 얼음창이 결정처럼 자라난다 (from 초부터 life 동안, 대상 쪽을 겨눈다)
function ilFormAtTip(a, from, life, len, wid) {
  aFx(a, from, life, (u) => {
    const p = ilTip(a), ang = Math.atan2(a.ty() - 6 - p.y, a.tx() - p.x), g = easeOut(u);
    const L = len * g;
    ilLance(p.x + Math.cos(ang) * L * 0.75, p.y + Math.sin(ang) * L * 0.75, ang, L, wid * (0.5 + 0.5 * g), 0.6 + 0.4 * g, 6 * g);
  }, null, () => { if (Math.random() < 0.8) { const p = ilTip(a); ilGather(p.x, p.y, 14, 24); } });
}

// ★★ 등 뒤에 떠오르는 얼음창 셋: 서리 가루가 모여 결정이 자라고, 떠서 출렁이며 대상을 겨눈다. fire[j] 초에 날아간다
const IL_BACK = [[-12, -64], [-30, -50], [-26, -80]];
function ilBackTrio(a, life, fire) {
  const born = [0.08, 0.16, 0.24];
  const spot = (j, t) => {
    const [ox, oy] = IL_BACK[j];
    return { x: a.px() + a.dir * ox, y: groundY() + oy + Math.sin(t * 5 + j * 2) * 2 };
  };
  a.ilSpot = spot;
  aFx(a, 0, life, (u) => {
    const t = u * life;
    for (let j = 0; j < 3; j++) {
      if (t < born[j] || t >= fire[j]) continue;
      const g = easeOut(Math.min(1, (t - born[j]) / 0.22)), s = spot(j, t);
      const ang = Math.atan2(a.ty() - 6 - s.y, a.tx() - s.x);
      // 떠 있는 자리 뒤에 세로로 선 작은 마법 고리
      ctx.save();
      ctx.globalAlpha = 0.6 * g; ctx.strokeStyle = IL_ICE.glow; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(s.x - Math.cos(ang) * 14, s.y - Math.sin(ang) * 14, 2.5, 8 * g + 0.1, ang, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      const L = 30 * g;
      ilLance(s.x + Math.cos(ang) * L * 0.5, s.y + Math.sin(ang) * L * 0.5, ang, L, 7 * (0.4 + 0.6 * g), 0.5 + 0.5 * g, 5);
    }
  }, null, (u) => {
    const t = u * life;
    for (let j = 0; j < 3; j++) if (t >= born[j] && t < born[j] + 0.22 && Math.random() < 0.7) { const s = spot(j, t); ilGather(s.x, s.y, 10, 18); }
  });
}

// ★★★ 하늘 가득 맺히는 얼음창: 대상 둘레 하늘에 반짝임과 함께 하나씩 맺혀, 땅을 향해 비스듬히 겨눈다 (넷씩 한 무더기)
function ilSkyLances(a, life) {
  const cx = a.tx(), list = [];
  for (let j = 0; j < 16; j++) {
    const x = cx + (j / 15 - 0.5) * 150 + rand(-6, 6) - a.dir * 20, y = 10 + (j % 3) * 9 + rand(-3, 3);
    const lx = cx + rand(-34, 34);
    list.push({ x, y, lx, ang: Math.atan2(groundY() - 2 - y, lx - x), born: 0.1 + ((j * 7) % 16) * 0.022, grp: (j * 3) % 4, gone: false });
  }
  a.ilSky = list;
  aFx(a, 0, life, (u) => {
    const t = u * life;
    // 대상 위 하늘에만 엷은 냉기 안개
    ctx.save();
    const k = Math.min(1, t / 0.3) * (u > 0.85 ? (1 - u) / 0.15 : 1);
    const g = ctx.createRadialGradient(cx, 18, 4, cx, 18, 100);
    g.addColorStop(0, `rgba(190,240,255,${0.22 * k})`); g.addColorStop(1, 'rgba(190,240,255,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - 100, -20, 200, 80);
    ctx.restore();
    for (const s of list) {
      if (t < s.born || s.gone) continue;
      const f = Math.min(1, (t - s.born) / 0.16), bob = Math.sin(clock * 4 + s.x) * 1.2;
      if (f < 0.5) { ctx.save(); ctx.globalAlpha = 1 - f * 2; ctx.fillStyle = '#ffffff'; ctx.fillRect(s.x - 4, s.y, 9, 1); ctx.fillRect(s.x, s.y - 4, 1, 9); ctx.restore(); }
      const L = 22 * easeOut(f);
      ilLance(s.x + Math.cos(s.ang) * L * 0.5, s.y + bob + Math.sin(s.ang) * L * 0.5, s.ang, L, 5, 0.5 + 0.5 * f, 4);
    }
  });
}
// v 번째 무더기를 떨어뜨린다: 하늘의 얼음창이 땅으로 내리꽂혀 잠깐 박혀 있다가 사라진다
function ilVolley(a, v, flight) {
  const pick = (a.ilSky || []).filter((s) => s.grp === v && !s.gone);
  const tg = a.targets();
  pick.forEach((s, j) => {
    s.gone = true;
    if (j === 0 && tg.length) { s.lx = tg[Math.floor(Math.random() * tg.length)].x; s.ang = Math.atan2(groundY() - 2 - s.y, s.lx - s.x); }
    const gy = groundY() - 2, x0 = s.x + Math.cos(s.ang) * 11, y0 = s.y + Math.sin(s.ang) * 11;
    skFx(null, j * 0.025, flight, (u) => {
      const e = easeIn(u), x = mix(x0, s.lx, e), y = mix(y0, gy, e);
      ilLance(x, y, s.ang, 22, 5, 1, 4);
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - Math.cos(s.ang) * 36, y - Math.sin(s.ang) * 36); ctx.lineTo(x - Math.cos(s.ang) * 22, y - Math.sin(s.ang) * 22); ctx.stroke();
      ctx.restore();
    }, () => {
      skFx(null, 0, 0.45, (u) => ilLance(s.lx + Math.cos(s.ang) * 4, gy + Math.sin(s.ang) * 4, s.ang, 22, 5, u < 0.5 ? 1 : 1 - (u - 0.5) / 0.5));
      burst(s.lx, gy - 2, 5, ['#ffffff', IL_ICE.glow, IL_ICE.light], 90, 2, 280);
      ilFrostPatch(s.lx, 9, 0.6);
    });
  });
}
// 마지막 거대한 빙창: 대상 위에서 냉기를 빨아들이며 life 초 동안 자란다
const IL_GIANT = { len: 66, wid: 16, y: 2 + 66 * 0.7 };
function ilGiantForm(a, life) {
  const x = a.tx();
  a.ilGiantX = x;
  aFx(a, 0, life, (u) => {
    const g = easeOut(u), L = IL_GIANT.len * g, wob = u > 0.75 ? Math.sin(clock * 30) : 0;
    // 둘레를 도는 냉기 고리 두 겹
    ctx.save();
    ctx.globalAlpha = 0.6 * g; ctx.strokeStyle = IL_ICE.glow; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, 12 + L * 0.3, 20 + 5 * Math.sin(clock * 6), 4, 0, clock * 4, clock * 4 + 4.5); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, 6 + L * 0.5, 14, 3, 0, -clock * 5, -clock * 5 + 3.5); ctx.stroke();
    ctx.restore();
    ilLance(x + wob, 2 + L * 0.7, Math.PI / 2, L, IL_GIANT.wid * (0.4 + 0.6 * g), 0.6 + 0.4 * g, 10 * g);
  }, null, () => { if (Math.random() < 0.9) ilGather(x, 30, 30, 52, 0.6); });
}
// 내리꽂혀 땅에 박힌 채 금이 번지다가 산산이 깨진다
function ilGiantDrop(a, flight) {
  const x = a.ilGiantX != null ? a.ilGiantX : a.tx(), gy = groundY(), y0 = IL_GIANT.y, y1 = gy + 8, { len, wid } = IL_GIANT;
  skFx(null, 0, flight, (u) => {
    const y = mix(y0, y1, easeIn(u));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(159,232,255,0.35)';
    ctx.fillRect(x - 5, -10, 10, Math.max(0, y - len + 10)); ctx.restore();
    ilLance(x, y, Math.PI / 2, len, wid, 1, 12);
  }, () => {
    const cracks = [];
    for (let i = 0; i < 7; i++) cracks.push([rand(-4, 4), rand(14, 58), rand(-1, 1)]);
    skFx(null, 0, 0.2, (u) => {
      ilLance(x, y1, Math.PI / 2, len, wid, 1, 12 * (1 - u));
      ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [ox, oy, s] of cracks) {
        const L = 10 * Math.min(1, u * 1.6 + 0.2);
        ctx.moveTo(x + ox, y1 - oy); ctx.lineTo(x + ox + s * L * 0.6, y1 - oy - L * 0.5); ctx.lineTo(x + ox - s * L * 0.3, y1 - oy - L);
      }
      ctx.stroke(); ctx.restore();
    }, () => {
      ilShatter(x, gy - 32, 22, 6, 230, 0.8);
      ilShatter(x, gy - 10, 10, 4, 150, 0.6);
      ilBloom(x, gy - 30, 34, 0.75);
      ilFrostPatch(x, 60, 1.2);
      ringFx(x, IL_ICE.glow, 1.4, 0.5);
      ringFx(x, '#ffffff', 0.9, 0.4);
      impact({ stop: 0.1, shake: 0.4 });
    });
    ringFx(x, IL_ICE.glow, 1.0, 0.4);
    debris(x, 8, ['#cfefff', '#ffffff', '#c9b38a'], 1.4);
  });
}

Object.assign(SKILL_FX, {
  iceLance: {
    pose(u, a) {
      const m = a.mast || 0, d = a.k ? a.k.dur : 1, t = u * d;
      if (m === 0) return ilKeys(t, [[0, {}], [0.28, { bowA: -0.08, pull: 8, dx: -1 }], [0.38, { bowA: -0.1, pull: 9, dx: -1 }], [0.44, { bowA: 0.55, pull: 0, dx: 2 }], [0.7, {}]]);
      if (m === 1) return ilKeys(t, [[0, {}], [0.15, { bowA: -0.15, pull: 4, dx: -1, sy: 1.02 }], [0.42, { bowA: -0.28, pull: 13, dx: -2, skew: -0.08, sy: 1.03 }],
        [0.48, { bowA: 0.62, pull: 0, dx: 4, skew: 0.12, sy: 0.96 }], [0.72, { bowA: 0.4, dx: 1 }], [1, {}]]);
      if (m === 2) {
        const keys = [[0, {}], [0.25, { bowA: -0.25, pull: 10, sy: 1.04, dx: -1 }], [0.4, { bowA: -0.22, pull: 12, sy: 1.04, dx: -1 }]];
        for (const h of (a.k ? a.k.hits : [])) {
          const L = h[0] * d - 0.12;
          keys.push([L - 0.03, { bowA: -0.2, pull: 9, dx: -1, sy: 1.03 }], [L + 0.04, { bowA: 0.55, pull: 2, dx: 2.5, skew: 0.08, sy: 0.98 }]);
        }
        keys.push([d - 0.1, { bowA: 0.3, dx: 1 }], [d, {}]);
        return ilKeys(t, keys);
      }
      return ilKeys(t, [[0, {}], [0.3, { bowA: -0.25, pull: 13, sy: 1.06, lift: 2, skew: -0.08 }], [1.18, { bowA: -0.22, pull: 12, sy: 1.05, lift: 2, skew: -0.06 }],
        [1.28, { bowA: -0.4, pull: 13, sy: 1.08, lift: 4, skew: -0.1 }], [1.34, { bowA: 0.85, pull: 0, dx: 3, sy: 0.92, skew: 0.15 }], [1.5, { bowA: 0.7, dx: 2, sy: 0.95, skew: 0.08 }], [1.7, {}]]);
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast, hits = a.k.hits;
      if (m === 0) {
        const at = hits[0][0] * d - 0.08;
        return [[at / d, (a) => { const p = ilTip(a); ilFlyFx(a, p.x, p.y, a.tx(), a.ty() - 4, 0.08, 9, 3, { trail: 0.4 }); }]];
      }
      if (m === 1) {
        const at = hits[0][0] * d - 0.1;
        return [
          [0.01, (a) => ilFormAtTip(a, 0.12, at - 0.13, 28, 8)],
          [at / d, (a) => {
            const p = ilTip(a), tg = a.targets(), far = Math.max(60, ...tg.map((t) => Math.abs(t.x - a.tx()) + 50));
            ilFlyFx(a, p.x, p.y, a.tx(), a.ty() - 6, 0.1, 28, 8, { far, glow: 6 });
            burst(p.x, p.y, 8, ['#ffffff', IL_ICE.glow], 80, 2, 0);
            impact({ shake: 0.12 });
          }],
        ];
      }
      if (m === 2) {
        const fire = hits.map((h) => h[0] * d - 0.12);
        return [
          [0.01, (a) => ilBackTrio(a, d - 0.02, fire)],
          ...fire.map((f, j) => [f / d, (a) => {
            const s = a.ilSpot(j, f), tg = a.targets(j), far = Math.max(50, ...tg.map((t) => Math.abs(t.x - a.tx()) + 40));
            ilFlyFx(a, s.x, s.y, a.tx(), a.ty() - 6 + (j - 1) * 5, 0.12, 30, 7, { far, glow: 5 });
            burst(s.x, s.y, 6, ['#ffffff', IL_ICE.glow], 70, 2, 0);
          }]),
        ];
      }
      const drop = hits[hits.length - 1][0] * d - 0.12;
      return [
        [0.01, (a) => ilSkyLances(a, drop)],
        [0.3 / d, (a) => { const p = ilTip(a); starFx(p.x, p.y, 10, IL_ICE.glow, 0.3); burst(p.x, p.y, 10, ['#ffffff', IL_ICE.glow], 90, 2, -40); }],
        ...hits.slice(0, -1).map((h, v) => [(h[0] * d - 0.1) / d, (a) => ilVolley(a, v % 4, 0.1)]),
        [0.75 / d, (a) => ilGiantForm(a, drop - 0.75)],
        [drop / d, (a) => { ilGiantDrop(a, 0.12); impact({ shake: 0.12 }); }],
      ].sort((p, q) => p[0] - q[0]);
    },
    hit(a, i, n) {
      const m = a.mast, last = i === n - 1, tg = a.targets(i);
      if (m === 0) { for (const t of tg) { burst(t.x, t.y, 6, ['#ffffff', '#cfefff'], 90, 2, 200); ilShatter(t.x, t.y, 4, 2.5, 90, 0.45); } impact({ stop: 0.04, shake: 0.08 }); return; }
      if (m === 1) {
        for (const t of tg) { ilBloom(t.x, t.y - 2, 16, 0.7); ilFrostPatch(t.x, 22, 1.1); ilShatter(t.x, t.y, 8, 3, 140, 0.55); }
        impact({ stop: 0.08, shake: 0.25 });
        return;
      }
      if (m === 2) {
        for (const t of tg) { ilBloom(t.x, t.y - 2 + (i - 1) * 5, last ? 20 : 12, 0.6); ilShatter(t.x, t.y, last ? 10 : 5, 3, last ? 170 : 120, 0.55); if (last) ilFrostPatch(t.x, 30, 1.1); }
        impact(last ? { stop: 0.1, shake: 0.32 } : { stop: 0.03, shake: 0.12 });
        return;
      }
      if (!last) { for (const t of tg) ilShatter(t.x, t.y, 4, 3, 110, 0.45); impact({ shake: 0.1 }); return; }
      for (const t of tg) { ilBloom(t.x, t.y - 4, 22, 0.6); burst(t.x, t.y, 20, ['#ffffff', IL_ICE.glow, IL_ICE.light], 180, 3, 260); }
      impact({ stop: 0.16, shake: 0.5 });
    },
    // 검흔 대신 대상에 얼음 가시가 박힌다 (Lv1 은 없이, ★★★ 는 마지막 빙창만)
    marks(a, t, pow, i, n) {
      const m = a.mast;
      if (m === 0 || (m === 3 && i < n - 1)) return;
      ilSplinters(a, t, m >= 2 ? 3 : 2, 0.5);
    },
    kb: 10,
  },
});
