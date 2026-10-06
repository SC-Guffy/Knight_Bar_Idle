'use strict';
// 3차 궁극기 「천붕」 연출 (warlord). 수치·단계는 src/classes.js 의 SKILLS.worldBreaker, 공통 레터박스·컷인은 src/skills.js 의 drawUltScreen.
//  Lv1 「대지 분쇄」 하늘 높이 뛰어올랐다가 내려찍으면 균열이 하단바 양끝까지 달리고 — 다음 순간 균열을 따라 바위판이 줄줄이 솟구친다
//  ★ 「천붕」 하늘에 금이 가 조각이 떨어지고, 거대한 도끼창 그림자가 적 위로 떨어져 박힌다 — 하단바 땅이 파도처럼 들썩이고,
//            마지막에 그림자가 산산이 부서진다
//  ★★ 「천붕지열」 녹아내린 도끼창으로 내려찍으면 용암 균열이 하단바 끝까지 달리며 용암 기둥이 줄줄이 솟구치고,
//            마지막에 적 발밑에서 하늘까지 닿는 용암 기둥이 터진다
//  ★★★ 「종말의 일격」 하단바 위에 거인의 도끼가 나타나 크게 휘둘러 내리찍고 — 땅이 판째로 뜯겨 뒤집히며 하늘로 솟았다가,
//            공중에서 부서져 한꺼번에 쏟아진다 (뜯긴 자리에는 시뻘건 땅속이 드러난다)
// 레터박스(아래 16px)가 땅선을 덮으므로, 땅의 연출은 그 위(groundY() - 6 근처)에서 보이게 그린다

const WB_ROCK = ['#2a1a12', '#5a4030', '#8a6a4a', '#6b5a44'];
const WB_LAVA = ['#5a1404', '#ff5a1f', '#ffb040', '#fff0b0'];
const WB_STEEL = { dark: '#1c1e24', mid: '#3a3e48', light: '#6a707c', shine: '#c8ccd4', gold: '#ffd257' };

const wbDur = (a) => (a.k ? a.k.dur : 2.6);
const wbHitT = (a) => (a.k ? a.k.hits.map((h) => h[0] * a.k.dur) : [1.4, 2.3]);
const wbEnv = (t, from, to, fin, fout) => Math.min(clamp01((t - from) / fin), clamp01((to - t) / fout));
const wbBase = () => groundY() - 7;        // 레터박스 바로 위: 땅이 갈라지는 연출이 보이는 높이
function wbPoly(pts) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
// 내려찍는 자리 (도끼창 날 앞)
function wbSlamX(a) { return a.x() + a.dir * 34; }

// 하늘을 덮는 어둠 + 아래에서 올라오는 땅의 열기
function wbSky(a, life, color, dim, heat, from = 0.15) {
  backFx(a, 0, life, (u) => {
    const t = u * life, k = wbEnv(t, from, life - 0.15, 0.45, 0.35);
    dimBand(dim * k, color);
    if (heat > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = heat * k;
      const g = ctx.createLinearGradient(0, 30, 0, groundY());
      g.addColorStop(0, 'rgba(255,90,31,0)'); g.addColorStop(1, 'rgba(255,90,31,0.7)');
      ctx.fillStyle = g; ctx.fillRect(-20, 30, W + 40, groundY() - 30);
      ctx.restore();
    }
  });
}

// ── 균열: x0 에서 하단바 양끝까지 지그재그로 달리고 가지를 친다. 틈에서 빛(lava 면 용암빛)이 새어 오른다 ──
function wbFissure(a, x0, life, lava, grow = 0.3) {
  const by = wbBase(), sides = [];
  for (const s of [-1, 1]) {
    const pts = [[x0, by]], br = [];
    for (let x = x0 + s * 12, i = 1; s > 0 ? x < W + 20 : x > -20; x += s * rand(9, 15), i++) {
      pts.push([x, by + rand(-2.5, 1.5)]);
      if (i % 5 === 0) br.push({ i, pts: [[x, by], [x + s * rand(6, 12), by - rand(5, 11)], [x + s * rand(12, 22), by - rand(8, 16)]] });
    }
    sides.push({ pts, br });
  }
  const far = Math.max(x0, W - x0) + 20, glow = lava ? WB_LAVA : ['#3a1a08', '#ff7a2a', '#ffc070', '#fff0d0'];
  aFx(a, 0, life, (u) => {
    const t = u * life, reach = far * easeOut(Math.min(1, t / (grow * (far / 700 + 0.4)))), fade = u > 0.75 ? (1 - u) / 0.25 : 1;
    const pulse = 0.75 + 0.25 * Math.sin(clock * 10);
    ctx.save();
    ctx.globalAlpha = fade;
    // 틈에서 위로 새는 빛
    ctx.globalCompositeOperation = 'lighter';
    const L = Math.max(0, x0 - reach), R = Math.min(W, x0 + reach);
    const gh = lava ? 40 : 30, g = ctx.createLinearGradient(0, by - gh, 0, by + 4);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, glow[1]);
    ctx.globalAlpha = fade * (lava ? 0.6 : 0.45) * pulse;
    ctx.fillStyle = g; ctx.fillRect(L, by - gh, R - L, gh + 4);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = fade;
    for (const S of sides) {
      const vis = S.pts.filter(([x]) => Math.abs(x - x0) <= reach);
      if (vis.length < 2) continue;
      const line = (P, w, c) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };
      line(vis, lava ? 7 : 6, '#140a06');
      line(vis, lava ? 4 : 3, glow[1]);
      line(vis, 1.5, glow[3]);
      for (const B of S.br) if (Math.abs(B.pts[0][0] - x0) <= reach) { line(B.pts, 3, '#140a06'); line(B.pts, 1, glow[2]); }
    }
    ctx.restore();
  }, null, (u) => {
    const t = u * life, reach = far * easeOut(Math.min(1, t / (grow * (far / 700 + 0.4))));
    if (u > 0.7) return;
    // 균열 끝에서 흙먼지와 불티
    for (const s of [-1, 1]) {
      const x = x0 + s * reach;
      if (x < -10 || x > W + 10) continue;
      parts.push({ x: x + rand(-6, 6), y: by - 2, vx: rand(-20, 20), vy: rand(-50, -20), g: -10, size: 4, color: Math.random() < 0.5 ? '#8a7a68' : '#a8946a', life: rand(0.4, 0.7), t: 0 });
      parts.push({ x, y: by, vx: s * rand(10, 60), vy: rand(-120, -40), g: 360, size: Math.random() < 0.4 ? 3 : 2, color: Math.random() < 0.5 ? WB_ROCK[2] : glow[1], life: rand(0.3, 0.6), t: 0 });
    }
  });
}

// ── 바위판 솟구침: 균열을 따라 바위판이 기울어진 채 솟았다가 가라앉는다 (x0 에서 바깥으로 물결처럼) ──
function wbJut(a, x0, life, hmax = 22) {
  const by = wbBase() + 4, slabs = [];
  for (let x = 6; x < W; x += rand(14, 22)) slabs.push({ x, w: rand(10, 18), h: rand(0.5, 1) * hmax, tilt: rand(-0.35, 0.35), d: Math.abs(x - x0) / 1500 });
  aFx(a, 0, life, (u) => {
    const t = u * life;
    ctx.save();
    for (const S of slabs) {
      const k = segU(t, S.d, S.d + 0.08), out = t > life - 0.35 ? (life - t) / 0.35 : 1, h = S.h * easeOut(k) * out;
      if (h < 1) continue;
      const lean = S.tilt * h, x = S.x;
      ctx.fillStyle = WB_ROCK[0]; wbPoly([[x - S.w / 2 - 1, by + 2], [x - S.w / 2 + lean - 1, by - h - 1], [x + S.w / 2 + lean + 1, by - h + S.tilt * 6 - 1], [x + S.w / 2 + 1, by + 2]]); ctx.fill();
      ctx.fillStyle = WB_ROCK[1]; wbPoly([[x - S.w / 2, by], [x - S.w / 2 + lean, by - h], [x + S.w / 2 + lean, by - h + S.tilt * 6], [x + S.w / 2, by]]); ctx.fill();
      ctx.fillStyle = WB_ROCK[3]; wbPoly([[x - S.w / 2 + lean, by - h], [x + S.w / 2 + lean, by - h + S.tilt * 6], [x + S.w / 2 + lean, by - h + S.tilt * 6 + 3], [x - S.w / 2 + lean, by - h + 3]]); ctx.fill();
      ctx.fillStyle = '#8fbf5a'; ctx.fillRect(Math.round(x - S.w / 2 + lean), Math.round(by - h - 1), Math.round(S.w * 0.6), 2);
    }
    ctx.restore();
  });
  for (const S of slabs) skLater(a, S.d, () => { if (Math.random() < 0.5) debris(S.x, 2, WB_ROCK.slice(1)); });
}

// ── ★ 하늘이 깨진다: 적 위쪽 하늘에 금이 사방으로 가고, 깨진 조각이 주황 테두리를 남기며 떨어진다 ──
function wbSkyCrack(a, cx, from, life) {
  const rays = Array.from({ length: 9 }, (_, j) => {
    const A = Math.PI * (0.05 + 0.9 * j / 8) + rand(-0.1, 0.1), pts = [[0, 0]];
    let x = 0, y = 0;
    for (let s = 0; s < 6; s++) { x += Math.cos(A + rand(-0.4, 0.4)) * rand(18, 34); y += Math.sin(A + rand(-0.4, 0.4)) * rand(6, 12); pts.push([x, y]); }
    return pts;
  });
  const shards = Array.from({ length: 12 }, () => ({ x: rand(-120, 120), y: rand(0, 22), r: rand(5, 11), rot: rand(0, 6), vr: rand(-6, 6), at: rand(0.25, 0.6), vx: rand(-30, 30) }));
  backFx(a, from, life, (u) => {
    const t = u * life, grow = easeOut(Math.min(1, t / 0.25)), fade = u > 0.8 ? (1 - u) / 0.2 : 1, y0 = 18;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.lineJoin = 'round';
    for (const P of rays) {
      const m = Math.max(2, Math.round(P.length * grow));
      for (const [w, c] of [[4, '#0a0402'], [1.5, '#ff7a2a']]) {
        ctx.strokeStyle = c; ctx.lineWidth = w;
        ctx.beginPath(); P.slice(0, m).forEach(([x, y], i) => (i ? ctx.lineTo(cx + x, y0 + y) : ctx.moveTo(cx + x, y0 + y))); ctx.stroke();
      }
    }
    // 떨어지는 하늘 조각
    for (const S of shards) {
      if (t < S.at) continue;
      const tt = t - S.at, x = cx + S.x + S.vx * tt, y = y0 + S.y + 160 * tt * tt * 2.2;
      if (y > groundY()) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(S.rot + S.vr * tt);
      ctx.fillStyle = '#120806'; wbPoly([[-S.r, -S.r * 0.4], [S.r * 0.2, -S.r], [S.r, S.r * 0.3], [-S.r * 0.3, S.r * 0.8]]); ctx.fill();
      ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  });
}
// 거대한 도끼창 그림자 (창끝이 아래). x 화면 위치, yTip 창끝 높이, d 날이 향하는 쪽
function wbHalberdShadow(x, yTip, d, alpha, sc = 1.35) {
  ctx.save();
  ctx.translate(x, yTip); ctx.scale(d * sc, sc);
  ctx.globalAlpha = alpha;
  ctx.shadowColor = '#ff7a2a'; ctx.shadowBlur = 10;
  const shapes = [
    [[-5, -26], [5, -26], [5, -420], [-5, -420]],                                                         // 자루
    [[0, 0], [-8, -28], [8, -28]],                                                                         // 창끝
    [[5, -34], [30, -28], [50, -40], [57, -58], [49, -77], [28, -88], [5, -82]],                           // 도끼날
    [[-5, -44], [-32, -34], [-24, -52], [-5, -64]],                                                        // 뒷갈고리
    [[-9, -84], [9, -84], [9, -92], [-9, -92]],                                                            // 띠
  ];
  for (const P of shapes) {
    wbPoly(P); ctx.fillStyle = '#120804'; ctx.fill();
    ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = 2.6 / sc; ctx.stroke();
  }
  ctx.shadowBlur = 0;
  // 날에 서린 빛
  ctx.strokeStyle = '#ffd0a0'; ctx.lineWidth = 1.2 / sc;
  ctx.beginPath(); ctx.moveTo(30, -28); ctx.lineTo(50, -40); ctx.lineTo(57, -58); ctx.lineTo(49, -77); ctx.lineTo(28, -88); ctx.stroke();
  ctx.restore();
}
// 들썩이는 땅: 하단바 바닥이 흙 띠로 솟아, 충격파가 지나가는 자리마다 위로 들렸다 내려앉는다
// pulses: [[시각, 높이]], x0 진원
function wbHeave(a, x0, life, pulses, startAt) {
  const by = wbBase() + 3;
  const hAt = (x, t) => {
    let h = 0;
    for (const [pt, A] of pulses) {
      const dt = t - pt; if (dt < 0 || dt > 1.4) continue;
      const front = 520 * dt, dx = Math.abs(x - x0) - front;
      h += A * Math.exp(-(dx * dx) / 900) * (1 - dt / 1.4) + A * 0.25 * Math.exp(-((Math.abs(x - x0) - front * 0.6) ** 2) / 1600) * (1 - dt / 1.4);
    }
    return h;
  };
  backFx(a, 0, life, (u) => {
    const t = u * life;
    if (t < startAt) return;
    const show = wbEnv(t, startAt, life, 0.1, 0.3);
    ctx.save();
    ctx.globalAlpha = show;
    ctx.beginPath(); ctx.moveTo(-4, groundY() + 10);
    const top = [];
    for (let x = -4; x <= W + 6; x += 6) { const y = by - hAt(x, t); top.push([x, y]); ctx.lineTo(x, y); }
    ctx.lineTo(W + 6, groundY() + 10); ctx.closePath();
    ctx.fillStyle = '#4a3828'; ctx.fill();
    ctx.strokeStyle = '#c9a878'; ctx.lineWidth = 2;
    ctx.beginPath(); top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    ctx.fillStyle = '#8fbf5a';
    for (let i = 1; i < top.length; i += 2) ctx.fillRect(Math.round(top[i][0]), Math.round(top[i][1]) - 2, 2, 2);
    ctx.restore();
  }, null, (u) => {
    const t = u * life;
    for (const [pt] of pulses) {
      const dt = t - pt; if (dt < 0 || dt > 0.9) continue;
      for (const s of [-1, 1]) {
        const x = x0 + s * 520 * dt;
        if (x < 0 || x > W || Math.random() > 0.7) continue;
        parts.push({ x, y: by - 6, vx: s * rand(0, 60), vy: rand(-160, -60), g: 420, size: Math.random() < 0.4 ? 3 : 2, color: WB_ROCK[1 + Math.floor(Math.random() * 3)], life: rand(0.35, 0.6), t: 0 });
      }
    }
  });
}

// ── ★★ 용암 기둥: 땅이 붉게 부풀다가 울퉁불퉁한 용암 기둥이 솟고, 꼭대기에서 용암 방울이 튄다 ──
function wbLavaPillar(a, x, delay, h, w, life = 0.8) {
  const by = wbBase() + 3;
  aFx(a, delay, life, (u) => {
    const t = u * life, rise = easeOut(Math.min(1, t / 0.14)), fall = u > 0.55 ? easeIn((u - 0.55) / 0.45) : 0;
    const top = by - h * rise * (1 - fall), hh = by - top;
    ctx.save();
    // 밑동의 붉은 열기
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.6 * (1 - u * 0.6);
    const g = ctx.createRadialGradient(x, by, 1, x, by, w * 2.2);
    g.addColorStop(0, WB_LAVA[2]); g.addColorStop(1, 'rgba(255,90,31,0)');
    ctx.fillStyle = g; ctx.fillRect(x - w * 2.2, by - w * 2.2, w * 4.4, w * 2.2 + 6);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (hh > 2) {
      for (const [k, c] of [[1.25, WB_LAVA[0]], [1, WB_LAVA[1]], [0.6, WB_LAVA[2]], [0.22, WB_LAVA[3]]]) {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.moveTo(x - w * k * 0.6, by + 4);
        for (let y = by; y >= top; y -= 5) ctx.lineTo(x - (w / 2) * k * (1 + 0.18 * Math.sin(y * 0.3 + clock * 22)), y);
        ctx.lineTo(x, top - 3 * k);
        for (let y = top; y <= by; y += 5) ctx.lineTo(x + (w / 2) * k * (1 + 0.18 * Math.sin(y * 0.27 - clock * 19)), y);
        ctx.lineTo(x + w * k * 0.6, by + 4); ctx.closePath(); ctx.fill();
      }
      // 꼭대기에서 부글거리는 머리
      ctx.fillStyle = WB_LAVA[1]; ctx.beginPath(); ctx.arc(x, top, w * 0.75, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = WB_LAVA[2]; ctx.beginPath(); ctx.arc(x - 1, top - 1, w * 0.45, 0, Math.PI * 2); ctx.fill();
      // 식어 굳은 껍질 조각
      ctx.fillStyle = 'rgba(40,10,4,0.8)';
      for (let y = top + 8; y < by - 4; y += 13) ctx.fillRect(Math.round(x - w * 0.4 + ((y * 7) % 5)), Math.round(y), 3, 2);
    }
    ctx.restore();
  }, null, (u) => {
    if (u > 0.6 || Math.random() > 0.85) return;
    const t = u * life, top = by - h * easeOut(Math.min(1, t / 0.14));
    parts.push({ x: x + rand(-w / 2, w / 2), y: top, vx: rand(-110, 110), vy: rand(-170, -50), g: 420, size: Math.random() < 0.4 ? 4 : 3, color: Math.random() < 0.6 ? WB_LAVA[1] : WB_LAVA[2], life: rand(0.5, 0.8), t: 0, add: true });
    if (Math.random() < 0.3) parts.push({ x: x + rand(-w, w), y: by - 2, vx: rand(-60, 60), vy: rand(-200, -90), g: 500, size: 3, color: WB_ROCK[0], life: 0.7, t: 0 });
  });
}

// ── ★★★ 거인의 도끼 ──
// 거대한 도끼를 자루 아래 끝(pivot, 하단바 밑)에서 θ 각도로 그린다. 날은 +y(휘두르는 쪽)에 있다. 좌우는 d 로 뒤집는다
function wbGiantAxe(px, py, ang, d, alpha, rune, L) {
  ctx.save();
  ctx.translate(px, py); ctx.scale(d, 1); ctx.rotate(ang);
  ctx.globalAlpha = alpha;
  const S = WB_STEEL, k = 1.35;
  // 자루
  ctx.fillStyle = '#0c0604'; ctx.fillRect(0, -6, L + 20, 12);
  ctx.fillStyle = '#4a2410'; ctx.fillRect(0, -4, L + 20, 8);
  ctx.fillStyle = '#7a3a18'; ctx.fillRect(0, -4, L + 20, 2);
  for (let s = 40; s < L - 60; s += 46) { ctx.fillStyle = S.gold; ctx.fillRect(s, -6, 5, 12); }
  const P = (pts) => wbPoly(pts.map(([x, y]) => [L + x * k, y * k]));
  // 도끼날 (휘두르는 쪽): 어두운 테두리 → 강철 → 밝은 날 → 흰 날끝
  const blade = [[14, 4], [22, 30], [16, 52], [-4, 66], [-28, 66], [-48, 54], [-56, 32], [-44, 4]];
  ctx.shadowColor = '#ff7a2a'; ctx.shadowBlur = 16 * rune;
  P(blade); ctx.fillStyle = '#0c0d10'; ctx.fill();
  ctx.shadowBlur = 0;
  P([[11, 6], [18, 30], [12, 50], [-4, 62], [-27, 62], [-45, 51], [-52, 31], [-41, 6]]); ctx.fillStyle = S.mid; ctx.fill();
  P([[16, 34], [10, 50], [-4, 60], [-27, 60], [-44, 50], [-49, 36], [-38, 46], [-22, 52], [-4, 50], [8, 42]]); ctx.fillStyle = S.light; ctx.fill();
  P([[13, 46], [-4, 58], [-27, 58], [-42, 50], [-26, 55], [-4, 54]]); ctx.fillStyle = '#ffffff'; ctx.fill();
  // 날에 새겨진 룬이 주황으로 달아오른다
  ctx.fillStyle = mixHex('#5a2410', '#ffb040', rune);
  for (const [x, y] of [[-6, 18], [-18, 26], [-30, 18], [-14, 38], [-34, 34]]) P([[x, y], [x + 4, y - 4], [x + 8, y], [x + 4, y + 4]]);
  // 뒤쪽 뿔과 창끝
  P([[-8, -4], [-2, -34], [6, -4]]); ctx.fillStyle = '#0c0d10'; ctx.fill();
  P([[-6, -5], [-2, -30], [4, -5]]); ctx.fillStyle = S.light; ctx.fill();
  P([[16, -6], [56, 0], [16, 6]]); ctx.fillStyle = '#0c0d10'; ctx.fill();
  P([[18, -4], [52, 0], [18, 4]]); ctx.fillStyle = S.shine; ctx.fill();
  // 목 장식 (금 띠)
  P([[-48, -8], [18, -8], [18, 8], [-48, 8]]); ctx.fillStyle = '#0c0d10'; ctx.fill();
  P([[-46, -6], [16, -6], [16, 6], [-46, 6]]); ctx.fillStyle = S.dark; ctx.fill();
  ctx.fillStyle = S.gold;
  for (const x of [-40, -16, 8]) P([[x, -6], [x + 4, -6], [x + 4, 6], [x, 6]]);
  ctx.restore();
}
// 뜯겨 나간 땅 아래로 드러난 시뻘건 땅속
function wbUnderground(alpha) {
  if (alpha <= 0) return;
  const by = wbBase() + 3;
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, by - 12, 0, by + 10);
  g.addColorStop(0, 'rgba(255,90,31,0)'); g.addColorStop(0.5, '#ff5a1f'); g.addColorStop(1, '#5a1404');
  ctx.fillStyle = g; ctx.fillRect(-20, by - 12, W + 40, 22);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = '#ffb040';
  for (let x = 0; x < W; x += 19) { const ph = (clock * 1.3 + x * 0.071) % 1; ctx.globalAlpha = alpha * (1 - ph) * 0.8; ctx.fillRect(x, by - 2 - ph * 6, 2, 2); }
  ctx.restore();
}
// 뒤집히는 땅판 하나 (x, y 중심, w 폭, th 두께, rot 회전): 윗면 흙·풀 → 바위 몸통 → 아랫면 뿌리·검은 바위와 열기
function wbSlab(x, y, w, th, rot, glow) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  const hw = w / 2, hh = th / 2;
  ctx.fillStyle = '#140a06'; wbPoly([[-hw - 1, -hh - 1], [hw + 1, -hh - 1], [hw + 1, hh - 2], [hw * 0.5, hh + 5], [0, hh + 2], [-hw * 0.4, hh + 6], [-hw - 1, hh - 1]]); ctx.fill();
  ctx.fillStyle = WB_ROCK[1]; ctx.fillRect(-hw, -hh, w, th);
  ctx.fillStyle = WB_ROCK[0]; ctx.fillRect(-hw, -hh + th * 0.55, w, 2); ctx.fillRect(-hw + w * 0.2, -hh + th * 0.3, w * 0.4, 1);
  ctx.fillStyle = WB_ROCK[3]; ctx.fillRect(-hw, -hh, w, 4);
  ctx.fillStyle = '#8fbf5a'; ctx.fillRect(-hw, -hh - 1, w, 2);
  for (let i = -hw + 2; i < hw - 2; i += 5) ctx.fillRect(i, -hh - 3, 1, 2);
  // 아랫면: 뜯겨 나온 뿌리와 달아오른 바위
  ctx.fillStyle = mixHex('#2a1a12', '#ff5a1f', glow);
  wbPoly([[-hw, hh], [hw, hh], [hw * 0.5, hh + 4], [0, hh + 1.5], [-hw * 0.4, hh + 5]]); ctx.fill();
  ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-hw * 0.3, hh); ctx.lineTo(-hw * 0.4, hh + 7); ctx.moveTo(hw * 0.2, hh); ctx.lineTo(hw * 0.3, hh + 6); ctx.stroke();
  ctx.restore();
}

// ───────── 단계별 연출 ─────────
// Lv1 대지 분쇄
function wbStage0(a) {
  const D = wbDur(a), ht = wbHitT(a), life = D + 0.3;
  wbSky(a, life, '18,8,0', 0.42, 0);
}
// ★ 천붕
function wbStage1(a) {
  const D = wbDur(a), ht = wbHitT(a), ts = ht[0], tf = ht[ht.length - 1], life = D + 0.35, d = a.dir, tx0 = a.tx();
  wbSky(a, life, '24,8,0', 0.55, 0.15);
  wbSkyCrack(a, tx0, 0.55, ts + 0.3);
  wbHeave(a, tx0, life, [[ts, 24], ...ht.slice(1, -1).map((t) => [t, 12]), [tf, 28]], ts - 0.02);
  // 하늘에서 떨어져 박히는 도끼창 그림자 → 마지막에 부서진다
  backFx(a, 0, life, (u) => {
    const t = u * life;
    if (t < 0.75 || t > tf + 0.02) return;
    const fall = segU(t, 0.75, ts) ** 1.7, yTip = mix(-70, wbBase() + 8, fall);
    const shake = t > ts ? Math.sin(clock * 70) * 1.5 * (1 - segU(t, ts, ts + 0.4)) : 0;
    // 땅에 비친 그림자가 짙어진다
    ctx.save(); ctx.globalAlpha = 0.25 + 0.5 * fall; ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.ellipse(tx0, wbBase() + 2, 20 + 40 * fall, 3 + 3 * fall, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // 떨어지는 동안 위로 길게 남는 속도선
    if (t < ts) {
      ctx.save(); ctx.globalAlpha = 0.35 * fall; ctx.fillStyle = '#ff7a2a';
      for (const dx of [-30, -14, 16, 34]) ctx.fillRect(tx0 + dx * 1.35, yTip - 260, 1, 160);
      ctx.restore();
    }
    wbHalberdShadow(tx0 + shake, yTip, d, Math.min(1, (t - 0.75) / 0.2) * 0.95);
  });
}
// ★★ 천붕지열
function wbStage2(a) {
  const D = wbDur(a), life = D + 0.35;
  wbSky(a, life, '30,6,0', 0.55, 0.3);
  // 하늘에서 불티가 흩날린다
  backFx(a, 0, life, null, null, (u) => {
    if (u * life < 0.6 || Math.random() > 0.7) return;
    parts.push({ x: rand(0, W), y: 16, vx: rand(-30, 10), vy: rand(30, 70), g: 20, size: 2, color: Math.random() < 0.5 ? WB_LAVA[1] : WB_LAVA[2], life: rand(0.8, 1.4), t: 0, add: true });
  });
}
// ★★★ 종말의 일격
function wbStage3(a) {
  const D = wbDur(a), ht = wbHitT(a), ts = ht[0], tf = ht[ht.length - 1], tb = ht[ht.length - 2], life = D + 0.4, d = a.dir, tx0 = a.tx();
  const by = wbBase() + 3;
  wbSky(a, life, '14,4,0', 0.68, 0.1, 0.1);
  // 하늘 위쪽이 핏빛으로 물든다
  backFx(a, 0, life, (u) => {
    const t = u * life, k = wbEnv(t, 0.3, life - 0.1, 0.5, 0.35);
    ctx.save(); ctx.globalAlpha = 0.6 * k;
    const g = ctx.createLinearGradient(0, 0, 0, 90);
    g.addColorStop(0, 'rgba(160,30,10,0.9)'); g.addColorStop(1, 'rgba(160,30,10,0)');
    ctx.fillStyle = g; ctx.fillRect(-20, 0, W + 40, 90);
    ctx.restore();
  });
  // 거인의 도끼: 자루 끝은 하단바 밑. 날끝이 적 자리 땅에 정확히 꽂히도록 각도를 맞춘다
  // 자루 끝이 화면 밖으로 너무 나가면(적이 화면 가장자리에 가까우면) 반대쪽에서 휘두른다 (sw: 휘두르는 쪽)
  const L = 300, py = groundY() + 190, re = Math.hypot(L - 20 * 1.35, 66 * 1.35), phi = Math.atan2(66 * 1.35, L - 20 * 1.35);
  const hitA = Math.asin((by - 2 - py) / re), reach = re * Math.cos(hitA);
  const sw = tx0 - d * reach > 40 && tx0 - d * reach < W - 40 ? d : -d, px = tx0 - sw * reach, angHit = hitA - phi;
  // 치켜든 도끼머리가 화면 안에 보이도록 (좁은 창에서는 덜 젖힌다)
  const cmin = sw > 0 ? (40 - px) / L : (px - W + 40) / L;
  const angUp = Math.min(angHit - 0.35, cmin > Math.cos(-Math.PI / 2 - 0.15) ? -Math.acos(Math.min(1, cmin)) : -Math.PI / 2 - 0.15), angBack = angUp - 0.27;
  backFx(a, 0, life, (u) => {
    const t = u * life;
    if (t < 0.45 || t > ts + 0.75) return;
    const appear = segU(t, 0.45, 0.9), out = t > ts + 0.35 ? 1 - segU(t, ts + 0.35, ts + 0.75) : 1;
    let ang;
    if (t < ts - 0.22) ang = mix(angUp, angBack, easeOut(segU(t, 0.6, ts - 0.22)));
    else if (t < ts) ang = mix(angBack, angHit, easeIn(segU(t, ts - 0.22, ts)));
    else ang = angHit + Math.sin(clock * 60) * 0.004 * (1 - segU(t, ts, ts + 0.3));
    // 내려치는 동안 날이 지나간 자리에 남는 주황 궤적
    if (t > ts - 0.2 && t < ts + 0.2) {
      const k = 1 - segU(t, ts, ts + 0.2), a1 = Math.max(angBack, ang - 0.6);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 * k;
      ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = 46;
      ctx.beginPath();
      for (let s = 0; s <= 12; s++) { const A = mix(a1, ang, s / 12) + phi, x = px + sw * Math.cos(A) * re, y = py + Math.sin(A) * re; s ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      ctx.restore();
    }
    // 나타날 때: 주황 빛가루로 짜여 들어오며 윤곽이 먼저 보인다
    wbGiantAxe(px, py, ang, sw, appear * out, Math.max(appear * 0.6, t > ts - 0.25 ? 1 : 0), L);
  }, null, (u) => {
    const t = u * life;
    if (t < 0.45 || t > 0.95 || Math.random() > 0.8) return;
    const A = mix(angUp, angBack, 0.2) + phi, x = px + sw * Math.cos(A) * re + rand(-40, 40), y = py + Math.sin(A) * re + rand(-30, 30);
    parts.push({ x, y, vx: rand(-20, 20), vy: rand(-30, 30), g: 0, size: 2, color: Math.random() < 0.5 ? '#ff7a2a' : '#ffd257', life: 0.4, t: 0, add: true });
  });
  // 땅판: 하단바 전체를 판으로 나눠, 내려찍은 자리부터 바깥으로 차례로 뜯겨 뒤집히며 솟는다 → 공중에서 부서져 → 한꺼번에 쏟아진다
  const slabs = [];
  for (let x = rand(-10, 10); x < W + 20; ) {
    const w = rand(34, 56);
    slabs.push({ x: x + w / 2, w, th: rand(12, 16), lt: ts + 0.06 + Math.min(0.75, Math.abs(x + w / 2 - tx0) / Math.max(500, W * 0.9)), hy: rand(40, 74), spin: (Math.random() < 0.5 ? -1 : 1) * Math.PI * rand(0.85, 1.15), frags: [] });
    x += w;
  }
  for (const S of slabs) for (let j = 0; j < 3; j++) S.frags.push({ dx: (j - 1) * S.w / 3, w: S.w / 3 + rand(-2, 3), th: S.th * rand(0.8, 1.1), vr: rand(-9, 9), lx: rand(-14, 14) });
  const slabAt = (S, t) => {
    const k = easeOut(segU(t, S.lt, S.lt + 0.5));
    return { y: by - 4 - (S.hy * k) + Math.sin(clock * 3 + S.x) * 2 * k, rot: S.spin * easeOut(segU(t, S.lt, S.lt + 0.7)) };
  };
  backFx(a, 0, life, (u) => {
    const t = u * life;
    if (t < ts) return;
    // 뜯긴 자리 (땅속)
    wbUnderground(wbEnv(t, ts + 0.05, life, 0.25, 0.3) * (t > tf ? 1 - 0.6 * segU(t, tf, tf + 0.3) : 1));
    for (const S of slabs) {
      if (t < S.lt) continue;
      if (t < tb) { const p = slabAt(S, t); wbSlab(S.x, p.y, S.w, S.th, p.rot, segU(t, S.lt, S.lt + 0.4)); continue; }
      // 부서진 조각이 땅으로 쏟아진다 (tf 에 모두 닿는다)
      const p = slabAt(S, tb), fallK = easeIn(segU(t, tb + 0.08, tf));
      if (t > tf + 0.02) continue;
      for (const F of S.frags) {
        const cx = S.x + Math.cos(p.rot) * F.dx + F.lx * fallK, cy = mix(p.y + Math.sin(p.rot) * F.dx - 6 * segU(t, tb, tb + 0.08), by - 3, fallK);
        wbSlab(cx, cy, F.w, F.th, p.rot + F.vr * (t - tb), 1);
        // 떨어지는 동안 위로 남는 흙먼지 꼬리
        if (fallK > 0.05) { ctx.save(); ctx.globalAlpha = 0.35 * fallK; ctx.fillStyle = '#a8946a'; ctx.fillRect(cx - 2, cy - 30 * fallK, 4, 30 * fallK); ctx.restore(); }
      }
    }
  });
  // 판이 부서지는 순간 금빛 섬광 / 다 쏟아지는 순간 하단바 전체가 하얗게 (기사·적 위에 덮는다)
  aFx(a, 0, life, (u) => {
    const t = u * life;
    if (t > tb && t < tb + 0.18) dimBand(0.35 * (1 - segU(t, tb, tb + 0.18)), '255,170,80');
    if (t > tf && t < tf + 0.35) dimBand(0.7 * (1 - segU(t, tf, tf + 0.35)), '255,236,210');
  });
  // 판이 뜯겨 나가는 순간마다 흙과 돌이 튄다
  for (const S of slabs) skLater(a, S.lt, () => { for (let j = 0; j < 5; j++) parts.push({ x: S.x + rand(-S.w / 2, S.w / 2), y: by - 2, vx: rand(-40, 40), vy: rand(-240, -120), g: 420, size: Math.random() < 0.5 ? 3 : 2, color: WB_ROCK[1 + (j % 3)], life: rand(0.5, 0.8), t: 0 }); });
  skLater(a, tf, () => {
    for (const S of slabs) for (let j = 0; j < 4; j++) parts.push({ x: S.x + rand(-S.w / 2, S.w / 2), y: by - 3, vx: rand(-90, 90), vy: rand(-200, -60), g: 380, size: Math.random() < 0.5 ? 3 : 2, color: j % 2 ? '#a8946a' : WB_ROCK[1], life: rand(0.4, 0.8), t: 0 });
  });
}

// 내려찍는 순간 땅을 따라 양쪽으로 번지는 충격 섬광과 진원에서 솟는 흙기둥
function wbGroundFlash(a, x0, life) {
  aFx(a, 0, life, (u) => {
    const by = wbBase(), e = easeOut(u), half = Math.max(x0, W - x0) * e, k = 1 - u;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, by - 26, 0, by + 4);
    g.addColorStop(0, 'rgba(255,122,42,0)'); g.addColorStop(1, 'rgba(255,200,140,0.9)');
    ctx.globalAlpha = 0.8 * k; ctx.fillStyle = g; ctx.fillRect(x0 - half, by - 26, half * 2, 30);
    ctx.globalAlpha = k; ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 - half, by - 1, half * 2, 2);
    ctx.restore();
    // 흙기둥
    ctx.save(); ctx.globalAlpha = 0.8 * k; ctx.fillStyle = '#8a7a68';
    const h = 70 * easeOut(Math.min(1, u * 3)), w = 16 + 20 * u;
    wbPoly([[x0 - w, by + 2], [x0 - w * 0.4, by - h], [x0 + w * 0.4, by - h * 0.9], [x0 + w, by + 2]]); ctx.fill();
    ctx.restore();
  });
}

// ── 타격 이미지: 육중한 주황 파편 넷이 바깥으로 쪼개지며 박힌다 (쇳덩이가 짓누른 자국) ──
function wbCrushMark(x, y, big) {
  const s = big ? 1.7 : 1, rot = rand(0, Math.PI / 2);
  skFx(null, 0, 0.45, (u) => {
    const e = easeOut(Math.min(1, u / 0.3)), fade = u < 0.45 ? 1 : 1 - (u - 0.45) / 0.55;
    for (let j = 0; j < 4; j++) {
      const A = rot + (j * Math.PI) / 2, r = 4 + 12 * s * e;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(x + Math.cos(A) * r, y + Math.sin(A) * r); ctx.rotate(A);
      ctx.fillStyle = '#0b0d14'; wbPoly([[-3 * s, -6 * s], [9 * s, 0], [-3 * s, 6 * s]]); ctx.fill();
      ctx.fillStyle = '#ff7a2a'; wbPoly([[-2 * s, -4.5 * s], [7.5 * s, 0], [-2 * s, 4.5 * s]]); ctx.fill();
      ctx.fillStyle = '#ffffff'; wbPoly([[0, -1.5 * s], [5 * s, 0], [0, 1.5 * s]]); ctx.fill();
      ctx.restore();
    }
    ctx.save(); ctx.globalAlpha = fade * 0.8; ctx.strokeStyle = '#ffd0a0'; ctx.lineWidth = 2 * (1 - u);
    ctx.beginPath(); ctx.arc(x, y, 6 + 18 * s * e, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  });
}

Object.assign(SKILL_FX, {
  worldBreaker: {
    // 웅크렸다가 → 하늘 높이 뛰어올라 도끼창을 등 뒤로 크게 젖히고 → 내려찍는다 → (★ 부터) 마지막 일격에 한 번 더 뛰어 내려찍는다
    pose(u, a) {
      const D = wbDur(a), t = u * D, ht = wbHitT(a), ts = ht[0], tf = ht[ht.length - 1], m = a.mast || 0;
      const top = [46, 52, 52, 56][Math.min(3, m)];
      if (t < 0.3) { const c = easeOut(t / 0.3); return { sy: 1 - 0.18 * c, sx: 1 + 0.08 * c, wa: mix(-1.35, -2.0, c) }; }
      if (t < ts - 0.45) { const r = easeOut(segU(t, 0.3, ts - 0.45)); return { lift: top * r, wa: mix(-2.0, -2.9, r), skew: -0.2 * r, sy: mix(0.82, 1.08, Math.min(1, r * 3)) }; }
      if (t < ts - 0.14) { const h = segU(t, ts - 0.45, ts - 0.14); return { lift: top + 3 * Math.sin(h * Math.PI), wa: -2.9 - 0.15 * h, skew: -0.2, sy: 1.05 }; }
      if (t < ts) { const s = easeIn(segU(t, ts - 0.14, ts)); return { lift: top * (1 - s), wa: mix(-3.05, 1.1, s), skew: mix(-0.2, 0.4, s), sy: mix(1.05, 1.12, s) }; }
      const second = m >= 1 && tf - ts > 0.5;
      if (second && t > tf - 0.4 && t < tf) {
        if (t < tf - 0.13) { const r = easeOut(segU(t, tf - 0.4, tf - 0.13)); return { lift: 34 * r, wa: mix(1.1, -2.8, r), skew: mix(0.4, -0.2, r), sy: 1.05 }; }
        const s = easeIn(segU(t, tf - 0.13, tf)); return { lift: 34 * (1 - s), wa: mix(-2.8, 1.1, s), skew: mix(-0.2, 0.4, s), sy: 1.1 };
      }
      const end = second ? tf : ts, hold = Math.max(end + 0.25, D - 0.35);
      if (t < hold) return { wa: 1.1 + Math.sin(clock * 40) * 0.02 * (t < end + 0.2 ? 1 : 0), sy: 0.84, skew: 0.4 };
      const r = easeOut(segU(t, hold, D));
      return { wa: mix(1.1, -1.35, r), sy: mix(0.84, 1, r), skew: 0.4 * (1 - r) };
    },
    cues: (a) => {
      const D = wbDur(a), ht = wbHitT(a), ts = ht[0], m = Math.min(3, a.mast || 0);
      return [
        [0, (a) => [wbStage0, wbStage1, wbStage2, wbStage3][m](a)],
        // 뛰어오르는 발밑에서 흙먼지 고리
        [0.3 / D, (a) => { ringFx(a.x(), '#c9b38a', 0.8, 0.45); debris(a.x(), 10, ['#c9b38a', '#a8946a', '#6b5a44']); impact({ shake: 0.15 }); }],
        // 공중에서 날이 번쩍인다 (★★ 는 날이 녹아 시뻘겋게 달아오른다)
        [(ts - 0.4) / D, (a) => {
          aFx(a, 0, 0.42, (u) => {
            const g = gripOf(a), L = 30, x = g.x + Math.cos(g.ang) * L, y = g.y + Math.sin(g.ang) * L, k = Math.sin(Math.PI * u);
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k;
            const r = m === 2 ? 22 : 14, gr = ctx.createRadialGradient(x, y, 1, x, y, r);
            gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, m === 2 ? '#ff5a1f' : '#ffb070'); gr.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(x - r * 1.4, y - 0.5, r * 2.8, 1); ctx.fillRect(x - 0.5, y - r * 1.4, 1, r * 2.8);
            ctx.restore();
          }, null, () => {
            if (m !== 2 || Math.random() > 0.8) return;
            const g = gripOf(a), x = g.x + Math.cos(g.ang) * 26, y = g.y + Math.sin(g.ang) * 26;
            parts.push({ x: x + rand(-5, 5), y: y + rand(-5, 5), vx: rand(-30, 30), vy: rand(10, 80), g: 300, size: 2, color: Math.random() < 0.5 ? WB_LAVA[1] : WB_LAVA[2], life: 0.4, t: 0, add: true });
          });
        }],
      ];
    },
    hit(a, i, n) {
      const m = Math.min(3, a.mast || 0), last = i === n - 1, ht = wbHitT(a), D = wbDur(a), x0 = wbSlamX(a), tx = a.tx(), by = wbBase();
      const rocks = ['#5a4030', '#8a6a4a', '#c9b38a', '#ff7a2a'];
      if (i === 0) {
        // 첫 일격: 기사가 내려찍는 자리
        ringFx(x0, '#ff7a2a', m >= 2 ? 1.8 : 1.4, 0.55);
        ringFx(x0, '#ffffff', 0.8, 0.3);
        debris(x0, 20 + 6 * m, rocks, 1.6);
        wbGroundFlash(a, x0, 0.35);
        if (m === 0) wbFissure(a, x0, D - ht[0] + 0.3, false, 0.3);
        if (m === 1) {
          // 그림자 도끼창이 적 자리에 박힌다
          debris(tx, 26, rocks, 1.8);
          ringFx(tx, '#ff7a2a', 2.2, 0.6);
          aFx(a, 0, 0.25, (u) => dimBand(0.4 * (1 - u), '255,150,60'));
        }
        if (m === 2) {
          wbFissure(a, x0, D - ht[0] + 0.3, true, 0.25);
          // 균열을 따라 용암 기둥이 줄줄이 솟는다 (진원에서 가까운 곳부터)
          const step = 64, list = [];
          for (let x = x0 + a.dir * step; x > -20 && x < W + 20; x += a.dir * step) list.push(x);
          for (let x = x0 - a.dir * step * 1.4; x > -20 && x < W + 20; x -= a.dir * step * 1.4) list.push(x);
          const span = Math.max(0.6, ht[ht.length - 2] - ht[0]);
          for (const x of list) wbLavaPillar(a, x + rand(-10, 10), 0.12 + Math.min(1, Math.abs(x - x0) / Math.max(400, W * 0.8)) * span, rand(56, 96), rand(16, 24), 0.85);
        }
        if (m === 3) { aFx(a, 0, 0.3, (u) => dimBand(0.6 * (1 - u), '255,190,120')); ringFx(tx, '#ffd257', 2.6, 0.7); debris(tx, 30, rocks, 2); }
        impact({ stop: m >= 3 ? 0.2 : 0.14, shake: m >= 1 ? 0.75 : 0.6 });
        return;
      }
      if (!last) {
        for (const t of a.targets(i)) {
          debris(t.x, 6, rocks, 1.2);
          if (m === 2) wbLavaPillar(a, t.x, 0, 78, 20, 0.6);
          else burst(t.x, by - 4, 8, ['#ff7a2a', '#c9b38a', '#ffffff'], 140);
        }
        if (m === 3 && i === n - 2) { impact({ stop: 0.08, shake: 0.4 }); return; }       // ★★★ 공중의 땅판이 부서지는 순간
        impact({ stop: 0.03, shake: 0.22 });
        return;
      }
      // 마지막 일격
      if (m === 0) {
        wbJut(a, x0, 1.1, 30);
        for (const t of a.targets(i)) debris(t.x, 14, rocks, 1.6);
        impact({ stop: 0.16, shake: 0.7 });
        return;
      }
      if (m === 1) {
        // 박혀 있던 그림자가 산산이 부서진다
        for (let j = 0; j < 40; j++) parts.push({ x: tx + rand(-30, 60) * a.dir, y: rand(20, by), vx: rand(-160, 160), vy: rand(-200, 40), g: 300, size: Math.random() < 0.4 ? 4 : 3, color: j % 3 ? '#1a0c06' : '#ff7a2a', life: rand(0.5, 0.9), t: 0 });
        ringFx(tx, '#ff7a2a', 2.6, 0.6);
        for (let x = 20; x < W; x += 60) debris(x, 3, rocks, 1.2);
        aFx(a, 0, 0.3, (u) => dimBand(0.5 * (1 - u), '255,180,110'));
        impact({ stop: 0.22, shake: 0.85 });
        return;
      }
      if (m === 2) {
        // 적 발밑에서 하늘까지 닿는 용암 기둥 + 하단바 전체에서 용암이 다시 치솟는다
        wbLavaPillar(a, tx, 0, by - 4, 46, 1.0);
        for (let x = 30; x < W; x += rand(50, 80)) if (Math.abs(x - tx) > 40) wbLavaPillar(a, x, rand(0, 0.12), rand(30, 60), rand(10, 14), 0.6);
        aFx(a, 0, 0.3, (u) => dimBand(0.5 * (1 - u), '255,140,60'));
        impact({ stop: 0.24, shake: 0.85 });
        return;
      }
      ringFx(tx, '#ffffff', 3, 0.6);
      for (let x = 10; x < W; x += 40) ringFx(x, '#c9b38a', 0.6, 0.5);
      impact({ stop: 0.3, shake: 0.95 });
    },
    marks(a, t, pow, i, n) { wbCrushMark(t.x, t.y, i === n - 1 || i === 0); },
    kb: 20,
  },
});
