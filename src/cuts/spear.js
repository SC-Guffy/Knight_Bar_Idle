'use strict';
// 평타 컷 (절충안): 창 계열 (창 · 용창 · 용황창 — 창기사·용기병·용황). README '평타 애니메이션 — 컷 방식'
//  팔·다리 그림은 dev/cuts/spear.py 가 이 파일 끝 블록(sp_*)에 굽고, 컷 표는 이 파일이 모션 객체에 단다 (mo.cuts / mo.ready)
//  장병기 공용 도트 그리기(poleCells·drawPoleCut)도 여기 둔다 — lance.js·halberd.js 가 같이 쓴다 (index.html 에서 spear.js 가 먼저 로드된다)
//
// 장병기 컷 키: wa 자루 각도(0 앞, 음수 위) · ext 자루가 앞손 앞으로 미끄러져 나간 길이(px) — 창날 끝은 앞손에서 ext + (len + 3.5)·PX
//  bgrip 뒷손이 쥐는 자리 (앞손에서 자루 뒤쪽으로 칸, C = PX/2). 자루 끝(물미)은 앞손에서 back − ext/C 칸 뒤 — bgrip 은 그보다 짧게
//  찌르기: 예비에선 앞손이 자루 앞쪽을, 뒷손이 물미 가까이를 넓게 쥐고(ext 음수), 찌를 때 자루가 앞손 사이로 미끄러져 나가 두 손이 모인다(ext 양수, bgrip 작게)

// ── 장병기 도트 (팔다리와 같은 1.5px 칸, 외곽선) ──
// 손(h) 칸을 가운데로 하는 격자에 자루 방향 d(칸)·옆 q(칸, + 는 자루 각도 기준 시계 방향 = 수평일 때 아래) 자리를 찍는다
function poleCells(ang) {
  const cs = Math.cos(ang), sn = Math.sin(ang), cells = new Map(), m = Math.max(Math.abs(cs), Math.abs(sn));
  const at = (d, q) => Math.round(cs * d - sn * q) + ',' + Math.round(sn * d + cs * q);
  return {
    cells, at,
    put: (d, q, col, keep = false) => { const k = at(d, q); if (!keep || !cells.has(k)) cells.set(k, col); },
    // d0 ~ d1 를 긴 축으로 한 칸씩 (빈틈 없는 픽셀 직선)
    line: (d0, d1, q, col, keep = false) => {
      const n = Math.max(1, Math.round(Math.abs(d1 - d0) * m));
      for (let k = 0; k <= n; k++) { const key = at(d0 + (d1 - d0) * k / n, q); if (!keep || !cells.has(key)) cells.set(key, col); }
    },
    // 날: d0 ~ d1 구간에서 옆 폭 q0(d)~q1(d) 를 반 칸 간격으로 메운다. col(d, q) 로 색
    fill: (d0, d1, q0, q1, col) => {
      for (let d = d0; d <= d1 + 0.01; d += 0.5) {
        const a = q0(d), b = q1(d);
        for (let q = a; q <= b + 0.01; q += 0.5) cells.set(at(d, q), col(d, q));
      }
    },
  };
}
// 무기 빛(용창·천마창 등): 날 둘레에 은은한 빛 (칼 drawBladeCells 와 같은 방식)
function poleGlow(g, w, h, ang, d0, d1, width = 2.5) {
  if (!w.glow) return;
  const C = PX / 2, cs = Math.cos(ang), sn = Math.sin(ang);
  g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = w.glow; g.globalAlpha *= 0.32; g.lineWidth = PX * width; g.lineCap = 'round';
  g.beginPath(); g.moveTo(h[0] + cs * d0 * C, h[1] + sn * d0 * C); g.lineTo(h[0] + cs * d1 * C, h[1] + sn * d1 * C); g.stroke(); g.restore();
}
// 자루: 앞손 기준 from ~ to (칸). 한 칸 굵기 — 외곽선과 함께 4.5px 막대가 된다
const poleLum = (col) => { const n = parseInt(col.slice(1), 16); return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255; };
function poleShaft(P, w, from, to, white) {
  const c = white ? '#ffffff' : poleLum(w.shaft) < 0.2 ? spriteShadeCol(w.shaft, 1) : w.shaft;     // 아주 어두운 자루(용창·용황창)는 외곽선에 묻히지 않게 한 단계 밝게
  P.line(from, to, 0, c);
  // 물미(자루 끝 쇠): 두 칸
  P.line(from, from + 1, 0, white ? '#ffffff' : (w.glow ? spriteShadeCol(w.tip, -1) : '#4a4f5c'));
}

// 창: 자루 + 받침(창날 소켓) + 잎 모양 창날 (끝은 흰 한 칸). w.len 은 PX 단위 — 창날 밑동이 원점(앞손 + ext)에서 len·PX
const SP_BACK = 14;      // 물미: 원점에서 뒤로 14칸 (7PX)
const SP_HEAD = [1, 1.5, 2, 2, 1.5, 1.5, 1, 1, 0.5, 0.5];          // 창날 옆 폭 (밑동 → 끝, 칸)
function drawSpearCut(g, w, Ly, cut, white, r) {
  const C = PX / 2, h = Ly.hand, ang = Ly.wa, e = (cut.ext || 0) / C, L = w.len * 2;
  const P = poleCells(ang);
  const tipC = white ? '#ffffff' : w.tip, tipS = white ? '#ffffff' : spriteShadeCol(w.tip, -1), sock = white ? '#ffffff' : (w.glow || '#b0b6c2');
  poleShaft(P, w, e - SP_BACK, e + L - 1, white);
  // 창날: 잎 모양 — 위(빛) 쪽은 밝게, 아래 쪽은 그늘, 가운데 능선
  const hw = (d) => SP_HEAD[Math.max(0, Math.min(SP_HEAD.length - 1, Math.floor(d - (e + L))))];
  P.fill(e + L, e + L + SP_HEAD.length - 0.5, (d) => -hw(d), (d) => hw(d), (d, q) => q > 0.3 ? tipS : tipC);
  P.put(e + L + SP_HEAD.length, 0, '#ffffff');
  // 받침: 창날 밑동 두 칸, 폭 ±1
  P.fill(e + L - 2, e + L - 1, () => -1, () => 1, () => sock);
  poleGlow(g, w, h, ang, e + L - 1, e + L + SP_HEAD.length - 1, 2);
  drawCellSet(g, P.cells, h[0], h[1], true);
}
// 장병기 스미어: 앞 컷 → 이 컷 사이에 날 부분(끝에서 head 칸)이 지나온 자리 (t0: 앞 컷 쪽 몇 할은 건너뛴다 — 큰 호가 너무 길어지지 않게). 찌르기처럼 각도가 거의 같으면 날 둘레 ±1.5칸 폭의 속도선이 된다
//  새 쪽 절반은 흰색, 옛 쪽은 무기 잔상 색으로 옅어진다 (drawCutSmear 와 같은 색 규칙)
function drawPoleSmear(g, w, h0, a0, h1, a1, tip, head, wide = 1.5, t0 = 0) {
  const C = PX / 2, age = new Map();
  const span = Math.abs(a1 - a0) * tip + Math.hypot(h1[0] - h0[0], h1[1] - h0[1]) / C, N = Math.max(12, Math.ceil(span * 2.5));
  for (let s = 0; s <= N; s++) {
    const t = t0 + (1 - t0) * s / N, hx = h0[0] + (h1[0] - h0[0]) * t, hy = h0[1] + (h1[1] - h0[1]) * t, a = a0 + (a1 - a0) * t, cs = Math.cos(a), sn = Math.sin(a);
    for (let u = tip - head; u <= tip + 0.5; u += 0.5) for (let q = -wide; q <= wide; q += 0.5) {
      const i = Math.round((hx + (cs * u - sn * q) * C - h1[0]) / C), j = Math.round((hy + (sn * u + cs * q) * C - h1[1]) / C), k = i + ',' + j;
      if (!age.has(k) || age.get(k) < t) age.set(k, t);
    }
  }
  const cells = new Map(), rgb = w.trail || '255,255,255';
  for (const [k, t0k] of age) { const t = (t0k - t0) / (1 - t0); if (t < 0.97) cells.set(k, t > 0.55 ? 'rgba(255,255,255,0.85)' : `rgba(${rgb},${(0.25 + 0.55 * t / 0.55).toFixed(2)})`); }
  drawCellSet(g, cells, h1[0], h1[1], false);
}
// 창 스미어: 창끝 길이는 이 컷의 ext 로 (앞 컷에서 손이 끌고 온 만큼 창날 자리가 띠로 남는다)
function spearSmear(g, w, L0, Ly, cut) {
  const C = PX / 2, tip = (cut.ext || 0) / C + w.len * 2 + SP_HEAD.length;
  const line = Math.abs(Ly.wa - L0.wa) < 0.3;          // 곧은 찌르기면 창날 둘레 속도선, 휘두르며 내리꽂으면 창날이 그린 호
  drawPoleSmear(g, w, L0.hand, L0.wa, Ly.hand, Ly.wa, tip, SP_HEAD.length + (line ? 4 : 0), line ? 1.5 : 0.5);
}
const spearReach = (w, cut) => w.len + (cut.ext || 0) / PX + 3;
// 뒷손: 컷에 bgrip 이 없으면 물미 바로 앞(물미에서 1.5칸)을 쥔다 — 자루가 앞손 사이로 미끄러져 나가도(ext) 뒷손은 물미를 밀고 따라간다
const poleBackHand = (back) => (w, Ly, cut) => {
  const C = PX / 2, a = cut.wa || 0, b = cut.bgrip != null ? cut.bgrip : back - (cut.ext || 0) / C - 1.5;
  return [Ly.hand[0] - Math.cos(a) * b * C, Ly.hand[1] - Math.sin(a) * b * C];
};

// ── 컷 표 ──
// 1 가슴 높이 찌르기: 창대를 뒤로 당겨(앞손은 가슴 앞, 뒷손은 물미를 쥐고 허리 뒤로) 뒷발에 무게 → 깊은 런지로 몸을 낮추며 쭉 내지른다(창대가 앞손 사이로 미끄러져 나가 두 손이 모인다)
// 2 내려찌르기: 창을 머리 높이로 치켜들어 창끝을 세웠다가(뒷손은 물미를 가슴 앞에) → 앞발을 내디디며 위에서 아래로 내리꽂는다
const SP_READY = { fa: 'sp_ready', ba: 'sp_bReady', legs: 'set', wa: -0.32, ext: 4, dx: 0, skew: 0.02, sy: 1, sx: 0.97, hs: 0, hd: [0, 0], cape: 0.1 };
const SP_RECOVER = { fa: 'sp_recover', ba: 'sp_bRecover', legs: 'recover', wa: -0.22, ext: 3, dx: 3, skew: 0.08, sy: 0.98, sx: 0.98, hs: 0.04, hd: [0.1, 0.15], cape: 0.35 };
const SP_THRUST_CUTS = [
  { until: 0.12, fa: 'sp_pull',     ba: 'sp_bPull',     legs: 'load',      wa: -0.14, ext: -1, dx: -1, skew: -0.08, sy: 0.98, sx: 0.93, hs: -0.03, hd: [-0.15, 0],   cape: 0.1 },
  { until: 0.31, fa: 'sp_pullFull', ba: 'sp_bPullFull', legs: 'load',      wa: -0.1,  ext: -3, dx: -3, skew: -0.18, sy: 0.95, sx: 0.88, hs: -0.06, hd: [-0.35, 0],   cape: 0.0 },
  { until: 0.45, fa: 'sp_thrust',   ba: 'sp_bThrust',   legs: 'lungeDeep', wa: -0.02, ext: 9,  dx: 8,  skew: 0.36, sy: 0.88, sx: 0.93, hs: -0.02, hd: [0.4, 0.1],   cape: 1.0, smear: 'tip' },
  { until: 0.65, fa: 'sp_follow',   ba: 'sp_bFollow',   legs: 'lungeDeep', wa: 0.02,  ext: 7,  dx: 7,  skew: 0.3,  sy: 0.9,  sx: 0.94, hs: 0,     hd: [0.3, 0.15],  cape: 0.75 },
  { until: 1, ...SP_RECOVER },
];
const SP_DOWN_CUTS = [
  { until: 0.12, fa: 'sp_lift',     ba: 'sp_bLift',     legs: 'set',       wa: -0.45, ext: -2, bgrip: 8,  dx: -1, skew: -0.06, sy: 1.02, sx: 0.93, hs: -0.05, hd: [-0.1, -0.1], cape: 0.15 },
  { until: 0.31, fa: 'sp_high',     ba: 'sp_bHigh',     legs: 'load',      wa: -0.75, ext: -4, bgrip: 14, dx: -3, skew: -0.16, sy: 1.05, sx: 0.9,  hs: -0.1,  hd: [-0.3, -0.3], cape: -0.05, lift: 1 },
  { until: 0.45, fa: 'sp_stab',     ba: 'sp_bStab',     legs: 'lunge',     wa: 0.18,  ext: 7,  dx: 6,  skew: 0.32, sy: 0.9,  sx: 0.94, hs: 0.14,  hd: [0.4, 0.5],   cape: 0.95, smear: 'tip' },
  { until: 0.65, fa: 'sp_stabLow',  ba: 'sp_bStabLow',  legs: 'lunge',     wa: 0.24,  ext: 5,  dx: 6,  skew: 0.28, sy: 0.91, sx: 0.94, hs: 0.12,  hd: [0.3, 0.45],  cape: 0.7 },
  { until: 1, ...SP_RECOVER },
];
Object.assign(HERO_ATK.spear[0], { cuts: SP_THRUST_CUTS, ready: SP_READY });
Object.assign(HERO_ATK.spear[1], { cuts: SP_DOWN_CUTS, ready: SP_READY });
Object.assign(HERO_ATK.dragonSpear[0], { cuts: SP_THRUST_CUTS, ready: SP_READY });
// 용기병·용황 2: 웅크렸다가 창끝을 세우며 뛰어올라(lift) → 떨어지며 내리꽂는다 (뼈대 시절 '뛰어올라 내리꽂기'를 이었다)
const DS_DOWN_CUTS = [
  { until: 0.12, fa: 'sp_lift',     ba: 'sp_bLift',     legs: 'crouch',    wa: -0.45, ext: -2, bgrip: 8,  dx: -1, skew: -0.04, sy: 0.95, sx: 0.93, hs: -0.03, hd: [-0.1, 0.1],  cape: 0.1 },
  { until: 0.31, fa: 'sp_high',     ba: 'sp_bHigh',     legs: 'sp_jump',   wa: -0.75, ext: -4, bgrip: 14, dx: 1,  skew: -0.1,  sy: 1.04, sx: 0.9,  hs: -0.1,  hd: [-0.3, -0.3], cape: -0.1, lift: 11 },
  { until: 0.45, fa: 'sp_stab',     ba: 'sp_bStab',     legs: 'lungeDeep', wa: 0.24,  ext: 8,  dx: 8,  skew: 0.36, sy: 0.88, sx: 0.94, hs: 0.16,  hd: [0.4, 0.55],  cape: 1.0, smear: 'tip' },
  { until: 0.65, fa: 'sp_stabLow',  ba: 'sp_bStabLow',  legs: 'lungeDeep', wa: 0.28,  ext: 6,  dx: 8,  skew: 0.3,  sy: 0.89, sx: 0.94, hs: 0.12,  hd: [0.3, 0.5],   cape: 0.75 },
  { until: 1, ...SP_RECOVER },
];
Object.assign(HERO_ATK.dragonSpear[1], { cuts: DS_DOWN_CUTS, ready: SP_READY });
for (const id of ['spear', 'dragonSpear', 'wyrmSpear']) CUT_WEAPON[id] = { draw: drawSpearCut, reach: spearReach, smear: spearSmear, backHand: poleBackHand(SP_BACK) };

// ── 컷 레이어 spear (자동 생성: dev/cutgen.py — 손으로 고칠 칸은 생성기의 FIX 에) ──
addCutSprites({
  sp_ready: { sh: [0.5, 0.5], hd: [5, 7], rows: [
    'LA.....',
    'AAa....',
    'AAa....',
    'AAA....',
    'AAA....',
    'LALL...',
    'AAAASS.',
    '..aaSSS',
    '....sSs',
  ] },
  sp_pull: { sh: [2.5, 0.5], hd: [5, 6], rows: [
    '..LA...',
    '.LAA...',
    '.LAa...',
    '.LAa...',
    '.AA....',
    'LAALSS.',
    '.aAASSS',
    '....sSs',
  ] },
  sp_pullFull: { sh: [3.5, 0.5], hd: [5, 6], rows: [
    '..LLA..',
    '..LAa..',
    '.LAAa..',
    '.LAa...',
    'LAaL...',
    'AAAASS.',
    '...aSSS',
    '....sSs',
  ] },
  sp_thrust: { sh: [0.5, 1.5], hd: [11, 2], rows: [
    '.L...........',
    'LALLLLLLLLSS.',
    'AAAAAAAAAASSS',
    '.aaaaaaaaasSs',
  ] },
  sp_follow: { sh: [0.5, 0.5], hd: [10, 3], rows: [
    'LALL........',
    'AAAAALL.....',
    '.aaAAAAALSS.',
    '....aaaaASSS',
    '.........sSs',
  ] },
  sp_recover: { sh: [0.5, 0.5], hd: [6, 6], rows: [
    'LA......',
    'AAA.....',
    'AAA.....',
    'AAA.....',
    'LAA.....',
    '.AALLSS.',
    '.AAAASSS',
    '...aasSs',
  ] },
  sp_lift: { sh: [0.5, 1.5], hd: [6, 1], rows: [
    '.....SS.',
    'LAL..SSS',
    'AAAALsSs',
    '.AAAAA..',
    '..aAAa..',
    '....a...',
  ] },
  sp_high: { sh: [0.5, 6.5], hd: [7, 1], rows: [
    '......SS.',
    '......SSS',
    '.....LsSs',
    '....LAa..',
    '....LAa..',
    '.LLLAa...',
    'LAAAa....',
    'Aaa......',
  ] },
  sp_stab: { sh: [0.5, 0.5], hd: [10, 2], rows: [
    'LALL........',
    'AAAAALLL.SS.',
    '.aaAAAAAASSS',
    '....aaaaasSs',
  ] },
  sp_stabLow: { sh: [0.5, 0.5], hd: [10, 4], rows: [
    'LAL.........',
    'AAAA........',
    '.AAAALL.....',
    '..aAAAAAASS.',
    '....AaaaaSSS',
    '.........sSs',
  ] },
  sp_bReady: { sh: [0.5, 0.5], hd: [6, 9], rows: [
    'LA......',
    'AAA.....',
    'AAA.....',
    'AAAA....',
    '.AAA....',
    '.AAA....',
    '..AAA...',
    '...AAA..',
    '....ASS.',
    '.....SSS',
    '.....sSs',
  ] },
  sp_bPull: { sh: [6.5, 0.5], hd: [1, 7], rows: [
    '.....LLA',
    '....LAAa',
    '..LLAAa.',
    '.LAAaa..',
    '.LAa....',
    '.LAa....',
    'SSA.....',
    'SSS.....',
    'sSs.....',
  ] },
  sp_bPullFull: { sh: [8.5, 0.5], hd: [1, 7], rows: [
    '......LLLA',
    '....LLLAAa',
    '...LAAAaa.',
    '..LAaaa...',
    '..LAa.....',
    '.LAa......',
    'SSa.......',
    'SSS.......',
    'sSs.......',
  ] },
  sp_bThrust: { sh: [0.5, 1.5], hd: [10, 1], rows: [
    '.........SS.',
    'LALLLLLLLSSS',
    'AAAAAAAAAsSs',
    '.aaaaaa.....',
  ] },
  sp_bFollow: { sh: [0.5, 0.5], hd: [7, 2], rows: [
    'LAA......',
    'AAAA..SS.',
    'AAAALLSSS',
    '..AAAAsSs',
    '...Aaa...',
  ] },
  sp_bRecover: { sh: [0.5, 0.5], hd: [6, 7], rows: [
    'LA......',
    'AAA.....',
    'AAA.....',
    'AAA.....',
    '.AA.....',
    '.AAL....',
    '.AAAASS.',
    '...aASSS',
    '.....sSs',
  ] },
  sp_bLift: { sh: [0.5, 0.5], hd: [4, 3], rows: [
    'LA....',
    'AAA...',
    'AAASS.',
    'AAASSS',
    '.AAsSs',
    '.Aaa..',
  ] },
  sp_bHigh: { sh: [2.5, 0.5], hd: [4, 4], rows: [
    '.LLA..',
    '.LAa..',
    'LAAa..',
    'AAASS.',
    '.aaSSS',
    '...sSs',
  ] },
  sp_bStab: { sh: [0.5, 1.5], hd: [8, 1], rows: [
    '.......SS.',
    'LAL...LSSS',
    'AAAALLAsSs',
    '.AAAAAa...',
    '..aAaa....',
  ] },
  sp_bStabLow: { sh: [0.5, 0.5], hd: [6, 1], rows: [
    'LAA..SS.',
    'AAA..SSS',
    'AAAALsSs',
    '..AAAa..',
    '...aa...',
  ] },
}, {
  sp_jump: { hip: [6, 2], g: 6.0, rows: [
    '.ppp....mll...',
    '.pppp...mllll.',
    '.ppppp..llllll',
    '..pppp...lllln',
    '.ppppq....mlln',
    'jjjjqq....mln.',
    'jjjj......KKK.',
    'jjjj......KKK.',
  ] },
});
// ── 컷 레이어 spear 끝 ──
