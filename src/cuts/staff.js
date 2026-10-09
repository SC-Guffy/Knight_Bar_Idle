'use strict';
// 평타 컷 (절충안): 지팡이(마법사) 계열 — 견습 지팡이·화염·서리·뇌전 지팡이 (3차 겁화·빙하·뇌제의 홀은 별칭으로 같은 배열). README '평타 애니메이션 — 컷 방식'
// 팔·다리 그림은 dev/cuts/staff.py 가 굽고(이 파일 끝 'staff' 블록), 컷 표는 아래에서 기존 모션 객체에 속성(cuts·ready·charge)만 단다.
//
// 원칙: 지팡이는 앞손 하나로 쥐고(손이 자루를 덮는다), 뒷손은 빈손(편 손)으로 마력을 모으거나 내뻗어 균형을 잡는다.
//  컷 흐름: 들며 마력 모으기 → 끝까지 모음(가장 길게) → 내지르기(s = 0.45 마법이 나가는 순간이 이 컷 안, 지팡이 끝 궤적·섬광) → 여운 → 거두기
//  무게: 모을 때 뒷발에 싣고 몸을 젖히며(skew 음수·고개 들림·옆모습 sx < 0.95), 내지를 때 한 발 내디뎌 몸을 싣고 망토가 날린다.
//  컷 키는 world.js '컷 모드' 주석 — 지팡이는 bowA(지팡이 기울기: staffAngle = -1.25 + 1.6·bowA, 0 이면 앞으로 비스듬히 세움, 0.78 이면 수평)·pull(구슬에 모인 마력 0~13)
//  이 파일만의 키: mana 뒷손에 마력이 모인다(모션의 charge 가 그 손에 그려진다) · arc 내지르는 컷에서 구슬이 지나온 자리(앞 컷의 bowA 에서) — 둘 다 아래 CUT_WEAPON 이 읽는다

// ── 지팡이 그리기: 팔다리와 같은 1.5px 도트 격자. 자루 두 줄(빛 쪽 밝게) · 손 뒤로 나온 자루 끝 · 갈래 머리 장식 · 마력 구슬 (원래 생김새·색 그대로) ──
const ST_ELEM = { wand: 'plain', flameStaff: 'flame', infernoStaff: 'flame', frostStaff: 'frost', glacierStaff: 'frost', stormStaff: 'storm', tempestStaff: 'storm' };
const stOrbDist = (w) => w.staff.len * 2 + 3.2;                 // 손에서 구슬 가운데까지 칸 (= drawAtkFx 섬광 자리 (len + 1.6)·PX)
function stStaffCells(w, ang, pull, white) {
  const st = w.staff, el = ST_ELEM[w.id] || 'plain', cs = Math.cos(ang), sn = Math.sin(ang), L = st.len * 2, cells = new Map();
  const W = (c) => (white ? '#ffffff' : c);
  const wood = W(st.wood), woodL = W(spriteShadeCol(st.wood, 1)), head = W(st.head), headD = W(spriteShadeCol(st.head, -1));
  const orb = W(st.orb), orbL = W(spriteShadeCol(st.orb, 1)), orbD = W(spriteShadeCol(st.orb, -1));
  const m = Math.max(Math.abs(cs), Math.abs(sn)), xMajor = Math.abs(cs) >= Math.abs(sn), off = xMajor ? [0, -1] : [-1, 0];
  const P = (d, v) => [Math.round(cs * d - sn * v), Math.round(sn * d + cs * v)];          // d: 자루를 따라, v: 자루에 직각(아래쪽 +)
  const set = (ij, c, keep = false) => { const k = ij[0] + ',' + ij[1]; if (!keep || !cells.has(k)) cells.set(k, c); };
  const line = (d0, v0, d1, v1, c) => { const n = Math.max(1, Math.ceil(Math.hypot(d1 - d0, v1 - v0) * 1.5)); for (let k = 0; k <= n; k++) set(P(d0 + (d1 - d0) * k / n, v0 + (v1 - v0) * k / n), c); };
  // 자루 (손 뒤로 6칸 ~ 머리 장식 아래)
  const n = Math.round((L + 6) * m);
  for (let k = 0; k <= n; k++) { const [i, j] = P(-6 + (L + 6) * k / n, 0); set([i, j], wood); set([i + off[0], j + off[1]], woodL, true); }
  set(P(-6.6, 0), headD);                                                                   // 물미
  // 머리 장식: 구슬을 감싸 쥔 갈래 (속성마다 모양만 조금 다르다)
  const d0 = L + 3.2, k = Math.min(1, pull / 12), R = 1.7 + 1.4 * k;
  set(P(L - 1, 0), head); set(P(L - 1, -1), head); set(P(L - 1, 1), head); set(P(L - 2, 0), headD);
  if (el === 'flame') {                       // 불꽃처럼 휘어 오르는 세 갈래
    line(L - 1, -1.5, d0, -(R + 1.2), head); line(L - 1, 1.5, d0, R + 1.2, head);
    line(d0, -(R + 1.2), d0 + R + 1.2, -(R * 0.6), headD); line(d0, R + 1.2, d0 + R + 1.2, R * 0.6, headD);
  } else if (el === 'frost') {                // 얼음 결정: 곧은 두 갈래 끝에 가시
    line(L - 1, -1.2, d0 - 0.4, -(R + 1.4), head); line(L - 1, 1.2, d0 - 0.4, R + 1.4, head);
    set(P(d0 - 0.4, -(R + 2.4)), headD); set(P(d0 - 0.4, R + 2.4), headD);
  } else if (el === 'storm') {                // 뇌전: 갈래가 번개처럼 한 번 꺾인다
    line(L - 1, -1.2, L + 0.8, -(R + 1.6), head); line(L + 0.8, -(R + 1.6), d0 + 0.6, -(R + 0.6), head);
    line(L - 1, 1.2, L + 0.8, R + 1.6, head); line(L + 0.8, R + 1.6, d0 + 0.6, R + 0.6, head);
  } else {                                    // 견습: 소박한 두 갈래
    line(L - 1, -1.2, d0 - 0.6, -(R + 0.9), head); line(L - 1, 1.2, d0 - 0.6, R + 0.9, head);
  }
  // 구슬: 위·왼쪽 빛, 아래·오른쪽 그늘, 흰 반짝임 한 칸 (서리는 마름모 결정)
  const cx = cs * d0, cy = sn * d0;
  for (let j = Math.floor(cy - R - 2); j <= Math.ceil(cy + R + 2); j++) {
    for (let i = Math.floor(cx - R - 2); i <= Math.ceil(cx + R + 2); i++) {
      const dx = i - cx, dy = j - cy, inside = el === 'frost' ? Math.abs(dx) + Math.abs(dy) * 0.85 <= R * 1.3 : Math.hypot(dx, dy) <= R + 0.25;
      if (!inside) continue;
      const lit = -(dx * 0.6 + dy * 0.8) / Math.max(R, 0.1);
      cells.set(i + ',' + j, lit > 0.45 ? orbL : lit < -0.6 ? orbD : orb);
    }
  }
  cells.set(Math.round(cx - R * 0.4) + ',' + Math.round(cy - R * 0.45), '#ffffff');
  return { cells, orb: [cx, cy], R };
}
// 뒷손 자리 (어깨 + 팔 그림의 어깨→손)
const stBackHand = (Ly) => { const C = PX / 2; return [Ly.bs[0] + Ly.ba.vec[0] * C, Ly.bs[1] + Ly.ba.vec[1] * C]; };
const ST_CUT = {
  draw(g, w, Ly, cut, white, r) {
    const C = PX / 2, h = Ly.hand, ang = staffAngle(r.bowA), st = w.staff, k = Math.min(1, (r.pull || 0) / 12);
    const S = stStaffCells(w, ang, r.pull || 0, white);
    const ox = h[0] + S.orb[0] * C, oy = h[1] + S.orb[1] * C;
    const tick = typeof clock === 'number' ? clock : 0;
    if (!white) {                                                     // 구슬 둘레 빛 (마력이 모일수록 크고 진하게)
      g.save(); g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(${st.glowRgb},${(0.12 + 0.22 * k).toFixed(2)})`;
      g.beginPath(); g.arc(ox, oy, (S.R + 2 + 3 * k) * C, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    drawCellSet(g, S.cells, h[0], h[1], true);
    if (!white && k > 0.2) {                                          // 모이는 마력: 구슬 둘레를 도는 빛 알갱이 셋 (안쪽으로 빨려 든다)
      const sp = new Map(), rr = S.R + 2.5 + 2 * (1 - ((tick * 1.6) % 1));
      for (let q = 0; q < 3; q++) { const a = tick * 5 + q * 2.09; sp.set(Math.round(S.orb[0] + Math.cos(a) * rr) + ',' + Math.round(S.orb[1] + Math.sin(a) * rr), q ? `rgba(${st.glowRgb},0.9)` : 'rgba(255,255,255,0.95)'); }
      drawCellSet(g, sp, h[0], h[1], false);
    }
    // 뒷손에 모이는 마력: 모션의 charge 를 이 손에 그리게(drawAtkFx 가 r.bh 를 쓴다) + 도트 반짝임
    if (cut.mana) {
      const bh = stBackHand(Ly);
      r.bh = bh;
      if (!white) {
        const sp = new Map(), f = Math.floor(tick * 8) % 2;
        sp.set('0,0', 'rgba(255,255,255,0.95)');
        for (const [a, b] of f ? [[1, 0], [-1, 0], [0, -1], [0, 1]] : [[1, -1], [-1, 1], [-1, -1], [1, 1]]) sp.set(a + ',' + b, `rgba(${st.glowRgb},0.85)`);
        drawCellSet(g, sp, bh[0], bh[1] - C, false);
      }
    }
  },
  // 내지르는 컷: 구슬이 앞 컷 자리에서 지나온 궤적 (옛 쪽은 속성색으로 옅게, 새 쪽은 희게)
  smear(g, w, L0, Ly, cut) {
    if (cut.arc == null) return;
    const C = PX / 2, D = stOrbDist(w), a0 = staffAngle(cut.arc), a1 = staffAngle(cut.bowA || 0);
    const end = [Ly.hand[0] + Math.cos(a1) * D * C, Ly.hand[1] + Math.sin(a1) * D * C], age = new Map();
    const N = 40;
    for (let s = 0; s <= N; s++) {
      const t = s / N, a = a0 + (a1 - a0) * t, hx = L0.hand[0] + (Ly.hand[0] - L0.hand[0]) * t, hy = L0.hand[1] + (Ly.hand[1] - L0.hand[1]) * t;
      const px = hx + Math.cos(a) * D * C, py = hy + Math.sin(a) * D * C, wd = 0.6 + 1.6 * t;     // 새 쪽일수록 굵게
      for (let v = -wd; v <= wd; v += 0.5) {
        const i = Math.round((px - Math.sin(a) * v * C - end[0]) / C), j = Math.round((py + Math.cos(a) * v * C - end[1]) / C), kk = i + ',' + j;
        if (!age.has(kk) || age.get(kk) < t) age.set(kk, t);
      }
    }
    const cells = new Map(), rgb = w.staff.glowRgb;
    for (const [kk, t] of age) cells.set(kk, t > 0.7 ? 'rgba(255,255,255,0.9)' : `rgba(${rgb},${(0.15 + 0.7 * t).toFixed(2)})`);
    g.save(); g.globalCompositeOperation = 'lighter';
    drawCellSet(g, cells, end[0], end[1], false);
    g.restore();
  },
};
for (const id in ST_ELEM) CUT_WEAPON[id] = ST_CUT;

// ── 컷 표 ──
//  until: 0.14 들기 · 0.44 끝까지 모음(가장 길다) · 0.56 내지르기(s = 0.45 마법이 나감) · 0.76 여운 · 1 거두기
const ST_READY = { fa: 'st_ready', ba: 'st_bRest', legs: 'st_ready', bowA: -0.1, pull: 2, dx: 0, skew: -0.02, sy: 1, sx: 1, hs: 0, hd: [0, 0], cape: 0.1 };
const ST_RECOVER = { fa: 'st_recover', ba: 'st_bRecover', legs: 'st_ready', bowA: 0.05, pull: 0, dx: 1, skew: 0.04, sy: 0.99, sx: 1, hs: 0.03, hd: [0.1, 0.1], cape: 0.3 };
// 다섯 컷을 이어 붙인다: 내지르기 컷에 앞 컷의 지팡이 기울기(arc)와 smear 를 달아 구슬 궤적을 그린다
const stCuts = (raise, hold, cast, follow) => [
  { until: 0.14, ...raise },
  { until: 0.44, ...hold },
  { until: 0.56, smear: true, arc: hold.bowA, ...cast },
  { until: 0.76, ...follow },
  { until: 1, ...ST_RECOVER },
];

// 마법사(견습 지팡이)
//  1 겨눠 쏘기: 지팡이를 들어 머리 위로 치켜들며 가슴 앞 빈손에 마력을 모은다 → 한 발 내디디며 지팡이를 앞으로 쭉 내뻗어 쏜다
const ST_WAND_A = stCuts(
  { fa: 'st_raise', ba: 'st_bGather', bfront: 'body', mana: true, legs: 'st_ready', bowA: -0.32, pull: 4, dx: -1, skew: -0.05, sy: 1.01, sx: 0.97, hs: -0.03, hd: [-0.1, -0.1], cape: 0.12 },
  { fa: 'st_high', ba: 'st_bGather', bfront: 'body', mana: true, legs: 'st_lean', bowA: -0.5, pull: 10, dx: -2, skew: -0.12, sy: 1.04, sx: 0.92, hs: -0.08, hd: [-0.3, -0.25], cape: 0 },
  { fa: 'st_cast', ba: 'st_bFling', legs: 'st_step', bowA: 0.62, pull: 0, dx: 4, skew: 0.2, sy: 0.95, sx: 1.05, hs: 0.1, hd: [0.35, 0.3], cape: 0.85 },
  { fa: 'st_follow', ba: 'st_bFling', legs: 'st_step', bowA: 0.5, pull: 0, dx: 4, skew: 0.14, sy: 0.96, sx: 1.03, hs: 0.06, hd: [0.25, 0.25], cape: 0.6 });
//  2 내려 긋기: 지팡이를 머리 뒤로 크게 넘기고 발끝으로 서서 가슴 앞 빈손에 모았다가 → 지팡이를 앞·아래로 크게 내리그으며 쏜다 (빈손은 앞으로 밀어낸다)
const ST_WAND_B = stCuts(
  { fa: 'st_raise', ba: 'st_bGather', bfront: 'body', mana: true, legs: 'st_ready', bowA: -0.2, pull: 4, dx: -1, skew: -0.06, sy: 1.02, sx: 0.97, hs: -0.04, hd: [-0.1, -0.15], cape: 0.12 },
  { fa: 'st_high', ba: 'st_bGather', bfront: 'body', mana: true, legs: 'st_tiptoe', bowA: -0.8, pull: 10, dx: -2, skew: -0.14, sy: 1.06, sx: 0.93, lift: 1, hs: -0.12, hd: [-0.3, -0.4], cape: 0.05 },
  { fa: 'st_castLo', ba: 'st_bPush', legs: 'st_step', bowA: 0.72, pull: 0, dx: 5, skew: 0.26, sy: 0.93, sx: 1.06, hs: 0.14, hd: [0.4, 0.5], cape: 0.95 },
  { fa: 'st_follow', ba: 'st_bPush', legs: 'st_step', bowA: 0.62, pull: 0, dx: 5, skew: 0.18, sy: 0.95, sx: 1.03, hs: 0.1, hd: [0.3, 0.35], cape: 0.65 });

// 화염술사·대마도사: 크게 젖혔다가 온몸으로 내던진다
//  1 불덩이 던지기: 엉덩이 뒤로 내린 빈손에 불을 모으며 지팡이를 어깨 뒤로 젖혀 등 뒤에 세운다(옆모습, 뒷발에 체중) → 크게 내디디며 지팡이와 빈손을 함께 앞으로 내던진다
const ST_FLAME_A = stCuts(
  { fa: 'st_raise', ba: 'st_bLow', mana: true, legs: 'st_ready', bowA: -0.3, pull: 5, dx: -2, skew: -0.08, sy: 1.01, sx: 0.95, hs: -0.05, hd: [-0.15, -0.1], cape: 0.1 },
  { fa: 'st_back', ba: 'st_bLow', mana: true, legs: 'st_lean', bowA: -0.3, pull: 13, dx: -4, skew: -0.2, sy: 1.04, sx: 0.88, hs: -0.12, hd: [-0.45, -0.3], cape: -0.05 },
  { fa: 'st_cast', ba: 'st_bPush', legs: 'st_step', bowA: 0.6, pull: 0, dx: 6, skew: 0.3, sy: 0.92, sx: 1.08, hs: 0.14, hd: [0.45, 0.45], cape: 1.0 },
  { fa: 'st_follow', ba: 'st_bPush', legs: 'st_step', bowA: 0.5, pull: 0, dx: 5, skew: 0.2, sy: 0.94, sx: 1.04, hs: 0.1, hd: [0.3, 0.35], cape: 0.7 });
//  2 내려찍어 던지기: 떠올라 지팡이를 머리 위로 치켜들어 뒤로 넘기고 빈손은 엉덩이 뒤에서 불을 받쳤다가 → 내려오며 머리 위로 한 바퀴 휘둘러 앞으로 내리찍는다
const ST_FLAME_B = stCuts(
  { fa: 'st_raise', ba: 'st_bGather', bfront: 'body', mana: true, legs: 'st_tiptoe', bowA: -0.3, pull: 6, dx: -1, skew: -0.08, sy: 1.04, sx: 0.96, lift: 2, hs: -0.06, hd: [-0.15, -0.25], cape: 0.15 },
  { fa: 'st_high', ba: 'st_bLow', mana: true, legs: 'st_tiptoe', bowA: -0.8, pull: 13, dx: -2, skew: -0.16, sy: 1.07, sx: 0.9, lift: 4, hs: -0.14, hd: [-0.35, -0.45], cape: 0.0 },
  { fa: 'st_castLo', ba: 'st_bFling', legs: 'st_step', bowA: 0.82, pull: 0, dx: 6, skew: 0.32, sy: 0.9, sx: 1.08, hs: 0.18, hd: [0.5, 0.6], cape: 1.0 },
  { fa: 'st_follow', ba: 'st_bFling', legs: 'st_step', bowA: 0.7, pull: 0, dx: 5, skew: 0.22, sy: 0.93, sx: 1.04, hs: 0.12, hd: [0.35, 0.4], cape: 0.7 });

// 빙결술사·빙결의 군주: 작고 정확하게 — 몸은 덜 흔들리고 지팡이 끝은 늘 적을 겨눈다
//  1 겨눠 쏘기: 가슴 앞에서 지팡이 끝을 적에게 겨눈 채 빈손을 대어 냉기를 모은다 → 반 걸음 내디디며 짧게 찔러 쏜다, 뒤로 뻗은 빈손으로 균형
const ST_FROST_A = stCuts(
  { fa: 'st_aim', ba: 'st_bGather', bfront: 'body', mana: true, legs: 'st_ready', bowA: 0.2, pull: 5, dx: -1, skew: -0.04, sy: 1.01, sx: 0.96, hs: -0.02, hd: [-0.1, 0], cape: 0.1 },
  { fa: 'st_aim', ba: 'st_bGather', bfront: 'body', mana: true, legs: 'st_lean', bowA: 0.28, pull: 12, dx: -2, skew: -0.08, sy: 1.02, sx: 0.92, hs: -0.04, hd: [-0.2, -0.05], cape: 0.0 },
  { fa: 'st_cast', ba: 'st_bBack', legs: 'st_step', bowA: 0.76, pull: 0, dx: 4, skew: 0.16, sy: 0.96, sx: 1.05, hs: 0.04, hd: [0.3, 0.15], cape: 0.8 },
  { fa: 'st_cast', ba: 'st_bFling', legs: 'st_step', bowA: 0.7, pull: 0, dx: 4, skew: 0.12, sy: 0.97, sx: 1.03, hs: 0.03, hd: [0.2, 0.15], cape: 0.55 });
//  2 얼음창: 떠오르며 지팡이를 허리 옆으로 당겨 눕히고 빈손을 자루에 대어 냉기를 모은다(옆모습으로 비틂) → 창처럼 곧게 쭉 내찌른다
const ST_FROST_B = stCuts(
  { fa: 'st_aim', ba: 'st_bGather', bfront: 'body', mana: true, legs: 'st_ready', bowA: 0.5, pull: 5, dx: -1, skew: -0.06, sy: 1.02, sx: 0.94, lift: 1, hs: -0.03, hd: [-0.15, -0.05], cape: 0.1 },
  { fa: 'st_chamber', ba: 'st_bGather', bfront: 'body', mana: true, legs: 'st_lean', bowA: 0.78, pull: 12, dx: -3, skew: -0.14, sy: 1.0, sx: 0.88, lift: 2, hs: -0.05, hd: [-0.3, 0], cape: 0.0 },
  { fa: 'st_cast', ba: 'st_bBack', legs: 'st_step', bowA: 0.8, pull: 0, dx: 7, skew: 0.3, sy: 0.92, sx: 1.08, hs: -0.02, hd: [0.4, 0.1], cape: 1.0 },
  { fa: 'st_cast', ba: 'st_bBack', legs: 'st_step', bowA: 0.78, pull: 0, dx: 6, skew: 0.24, sy: 0.94, sx: 1.05, hs: -0.02, hd: [0.3, 0.1], cape: 0.7 });

// 뇌전술사·뇌제: 빠르고 날카롭게 — 짧게 치켜들고 튕기듯
//  1 번개 튕기기: 발끝으로 서며 지팡이를 머리 위로 짧게 치켜들어 번개를 모은다 → 앞·위로 튕기듯 내뻗어 쏜다
const ST_STORM_A = stCuts(
  { fa: 'st_raise', ba: 'st_bGather', bfront: 'body', mana: true, legs: 'st_ready', bowA: -0.3, pull: 5, dx: -1, skew: -0.05, sy: 1.02, sx: 0.97, hs: -0.04, hd: [-0.1, -0.1], cape: 0.12 },
  { fa: 'st_high', ba: 'st_bGather', bfront: 'body', mana: true, legs: 'st_tiptoe', bowA: -0.45, pull: 12, dx: -1, skew: -0.1, sy: 1.05, sx: 0.93, lift: 1, hs: -0.08, hd: [-0.2, -0.3], cape: 0.05 },
  { fa: 'st_castHi', ba: 'st_bFling', legs: 'st_step', bowA: 0.45, pull: 0, dx: 3, skew: 0.16, sy: 0.97, sx: 1.05, hs: 0.04, hd: [0.3, 0.05], cape: 0.85 },
  { fa: 'st_cast', ba: 'st_bFling', legs: 'st_step', bowA: 0.6, pull: 0, dx: 3, skew: 0.1, sy: 0.98, sx: 1.02, hs: 0.04, hd: [0.2, 0.1], cape: 0.55 });
//  2 내리긋기: 몸을 돌려(옆모습) 지팡이를 어깨 뒤로 젖혀 등 뒤에 세우고 빈손으로 적을 겨눈다 → 몸을 풀며 앞·아래로 크게 내리긋는다
const ST_STORM_B = stCuts(
  { fa: 'st_raise', ba: 'st_bGather', bfront: 'body', mana: true, legs: 'st_ready', bowA: -0.3, pull: 5, dx: -1, skew: -0.06, sy: 1.02, sx: 0.94, hs: -0.04, hd: [-0.15, -0.1], cape: 0.12 },
  { fa: 'st_back', ba: 'st_bReach', legs: 'st_lean', bowA: -0.4, pull: 12, dx: -3, skew: -0.16, sy: 1.04, sx: 0.88, lift: 2, hs: -0.1, hd: [-0.35, -0.25], cape: 0.0 },
  { fa: 'st_castLo', ba: 'st_bFling', legs: 'st_step', bowA: 0.85, pull: 0, dx: 5, skew: 0.28, sy: 0.92, sx: 1.08, hs: 0.14, hd: [0.45, 0.5], cape: 0.95 },
  { fa: 'st_follow', ba: 'st_bFling', legs: 'st_step', bowA: 0.72, pull: 0, dx: 4, skew: 0.2, sy: 0.94, sx: 1.04, hs: 0.1, hd: [0.3, 0.35], cape: 0.65 });

// 기존 모션 객체에 속성만 단다 (별칭 infernoStaff·glacierStaff·tempestStaff 는 같은 배열을 공유한다)
{
  const put = (id, list) => list.forEach((cuts, n) => { const mo = HERO_ATK[id] && HERO_ATK[id][n]; if (mo) { mo.cuts = cuts; mo.ready = ST_READY; } });
  put('wand', [ST_WAND_A, ST_WAND_B]);
  put('flameStaff', [ST_FLAME_A, ST_FLAME_B]);
  put('frostStaff', [ST_FROST_A, ST_FROST_B]);
  put('stormStaff', [ST_STORM_A, ST_STORM_B]);
  // 견습 지팡이엔 모이는 마력(charge)이 없었다 — 빈손에 푸른 마력이 모이게 단다
  for (const mo of HERO_ATK.wand || []) if (!mo.charge) mo.charge = [0.1, 0.45, '159,216,255'];
}

// ── 컷 레이어 staff (자동 생성: dev/cutgen.py — 손으로 고칠 칸은 생성기의 FIX 에) ──
addCutSprites({
  st_ready: { sh: [0.5, 0.5], hd: [5, 6], rows: [
    'LA.....',
    'AAa....',
    'AAa....',
    'AAA....',
    'AAA....',
    'LAALSS.',
    '.aAASSS',
    '....sSs',
  ] },
  st_raise: { sh: [0.5, 0.5], hd: [6, 2], rows: [
    'LA......',
    'AAA..SS.',
    'AAA..SSS',
    'AAALLsSs',
    '.AAAAa..',
    '.AAAa...',
    '..aa....',
  ] },
  st_high: { sh: [0.5, 10.5], hd: [2, 1], rows: [
    '.SS..',
    '.SSS.',
    '.sSs.',
    '..AA.',
    '..AA.',
    '..AA.',
    '..LAa',
    '.LAa.',
    '.LAa.',
    'LAa..',
    'LAa..',
    'Aa...',
  ] },
  st_aim: { sh: [0.5, 0.5], hd: [6, 3], rows: [
    'LA......',
    'AAA.....',
    'AAA..SS.',
    'AAALLSSS',
    'LALAAsSs',
    'LAAaa...',
    '.aa.....',
  ] },
  st_chamber: { sh: [3.5, 0.5], hd: [5, 6], rows: [
    '..LLA..',
    '..LAa..',
    '.LAAa..',
    'LAAa...',
    'AALL...',
    'AAAASS.',
    '..aASSS',
    '....sSs',
  ] },
  st_back: { sh: [8.5, 2.5], hd: [1, 4], rows: [
    '.....L....',
    '...LLAALL.',
    '..LLAAAAAA',
    'SSLAa.aaAa',
    'SSSa......',
    'sSs.......',
  ] },
  st_cast: { sh: [0.5, 2.5], hd: [10, 1], rows: [
    '.........SS.',
    '.LLLLLLLLSSS',
    'LAAAAAAAasSs',
    'AAaaaaa.....',
  ] },
  st_castHi: { sh: [0.5, 5.5], hd: [9, 1], rows: [
    '........SS.',
    '......LLSSS',
    '....LLAAsSs',
    '...LLAaa...',
    '.LLAAa.....',
    'LAAaa......',
    'Aaa........',
  ] },
  st_castLo: { sh: [0.5, 0.5], hd: [10, 4], rows: [
    'LALL........',
    'AAAALL......',
    '.aAAAAAL....',
    '....aAAAASS.',
    '.......aASSS',
    '.........sSs',
  ] },
  st_follow: { sh: [0.5, 0.5], hd: [9, 5], rows: [
    'LAA........',
    'AAAA.......',
    'AAAAA......',
    '..AAAALL...',
    '....AAAASS.',
    '......aaSSS',
    '........sSs',
  ] },
  st_recover: { sh: [0.5, 0.5], hd: [5, 7], rows: [
    'LA.....',
    'AAA....',
    'AAA....',
    'AAA....',
    'LAA....',
    '.AAL...',
    '.AAASS.',
    '..aaSSS',
    '....sSs',
  ] },
  st_bRest: { sh: [1.5, 0.5], hd: [2, 10], rows: [
    '.LA.',
    'LAA.',
    'LAA.',
    'LAA.',
    'LAA.',
    'LAa.',
    'LAA.',
    '.AA.',
    '.AA.',
    '.AS.',
    '.SSS',
    '.As.',
  ] },
  st_bGather: { sh: [0.5, 0.5], hd: [6, 3], rows: [
    'LA......',
    'AAA.....',
    'AAA..LSA',
    'AAA.LSSS',
    '.AALAas.',
    '.AAAa...',
    '..aa....',
  ] },
  st_bLow: { sh: [6.5, 0.5], hd: [1, 7], rows: [
    '.....LLA',
    '...LLAAa',
    '..LAAaa.',
    '.LAaa...',
    '.LAa....',
    '.LA.....',
    '.Sa.....',
    'SSS.....',
    '.s......',
  ] },
  st_bReach: { sh: [0.5, 0.5], hd: [10, 1], rows: [
    'LALLLLLLLLS.',
    'AAAAAAAAASSS',
    '.aaaaaaaa.s.',
  ] },
  st_bPush: { sh: [0.5, 0.5], hd: [10, 4], rows: [
    'LAL.........',
    'AAAAL.......',
    '.aAAAALL....',
    '...aAAAAAAS.',
    '.......aaSSS',
    '..........s.',
  ] },
  st_bFling: { sh: [8.5, 0.5], hd: [1, 7], rows: [
    '.......LLA',
    '......LAAa',
    '....LLAAa.',
    '...LAAaa..',
    '..LAAa....',
    '.LAaa.....',
    'LSa.......',
    'SSS.......',
    '.s........',
  ] },
  st_bBack: { sh: [9.5, 1.5], hd: [1, 1], rows: [
    'LSLLLLLLLL.',
    'SSSAAAAAAAA',
    '.s..aaaaAAa',
  ] },
  st_bRecover: { sh: [2.5, 0.5], hd: [1, 10], rows: [
    '..LA',
    '.LAA',
    '.LAA',
    '.LAa',
    '.LAa',
    '.LA.',
    '.AA.',
    '.AA.',
    '.Aa.',
    'LSa.',
    'SSS.',
    '.s..',
  ] },
}, {
  st_ready: { hip: [6, 2], g: 7.0, rows: [
    '.ppp....mll..',
    '.ppq....mll..',
    '.ppq....mlln.',
    'pppq....mlln.',
    'pppq....mmln.',
    'pppq.....mln.',
    'ppq......mln.',
    'jjjj.....KKKk',
    'jjjj.....KKKk',
  ] },
  st_lean: { hip: [7, 2], g: 6.8, rows: [
    '..ppp....mll.....',
    '..pppq...mlll....',
    '..pppq...mlll....',
    '..pppq....llll...',
    '..pppq....mlll...',
    '..pppq.....mlln..',
    '.pppq.......mll..',
    'jjjjj.......KKKkk',
    'jjjjj.......KKKkk',
  ] },
  st_step: { hip: [9, 2], g: 6.2, rows: [
    '....ppp....mll.....',
    '...pppq....mllll...',
    '...pppq....llllll..',
    '..pppq......llllln.',
    '.pppqq........llln.',
    'pppqq..........mln.',
    'jjjj...........KKKk',
    'jjjj...........KKKk',
  ] },
  st_tiptoe: { hip: [7, 2], g: 7.6, rows: [
    '..ppp....mll..',
    '..ppq....mll..',
    '..ppq....mlln.',
    '..ppq....mlln.',
    '..ppq....mlln.',
    '.pppq.....mln.',
    'jjjq......mln.',
    'jjj.......KKKk',
    '..........KKKk',
    '..........KKKk',
  ] },
});
// ── 컷 레이어 staff 끝 ──
