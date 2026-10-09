'use strict';
// 평타 컷 (절충안): 돌격창 계열 (돌격창 · 천마창 — 랜서·천마장군). README '평타 애니메이션 — 컷 방식'
//  팔·다리 그림은 dev/cuts/lance.py 가 이 파일 끝 블록(ln_*)에 굽고, 컷 표는 이 파일이 모션 객체에 단다 (mo.cuts / mo.ready)
//  방패를 든 기사: 돌격창은 앞손 한 손으로 겨드랑이에 끼어 쥐고(뒷손은 자루를 쥐지 않는다 — backHand null),
//  방패는 뒷손에 든다(shield: 'bh'). 방패를 몸 앞에 세우는 컷은 bfront: 'body' (가슴 위에, 창·앞팔보다 아래)
//  도트 도구(poleCells·poleGlow·drawPoleSmear)는 spear.js 에 있다

// 돌격창: 손 앞 둥근 보호판(vamplate) + 끝으로 갈수록 가늘어지는 원뿔 창날, 손 뒤로 짧은 손잡이·물미. ext 는 쓰지 않는다(한 손으로 통째로 내지른다)
const LN_BACK = 4;       // 손 뒤 손잡이 (칸) — 짧아야 어깨에 메었을 때 투구를 가로지르지 않는다
function drawLanceCut(g, w, Ly, cut, white, r) {
  const h = Ly.hand, ang = Ly.wa, L = w.len * 2 + 7, P = poleCells(ang);
  const tipC = white ? '#ffffff' : w.tip, tipS = white ? '#ffffff' : spriteShadeCol(w.tip, -1), plate = white ? '#ffffff' : (w.glow || '#b0b6c2');
  const plateS = white ? '#ffffff' : spriteShadeCol(plate, -1);
  poleShaft(P, w, -LN_BACK, 2, white);
  // 원뿔: 보호판 앞(4칸)에서 옆 폭 2.5 → 끝(L)에서 0. 위 쪽 밝게, 아래 쪽 그늘, 가운데 아래로 홈 한 줄
  const hw = (d) => Math.max(0, 2.5 * (1 - (d - 4) / (L - 4)));
  P.fill(4, L - 0.5, (d) => -Math.round(hw(d) * 2) / 2, (d) => Math.round(hw(d) * 2) / 2, (d, q) => q > 0.6 ? tipS : tipC);
  P.put(L, 0, '#ffffff');
  // 보호판: 2.5 ~ 3.5 칸, 옆 폭 ±3 (둥글게 — 끝 칸은 좁게)
  P.fill(2, 3.5, (d) => d < 2.5 ? -2 : -3, (d) => d < 2.5 ? 2 : 3, (d, q) => q > 0.5 ? plateS : plate);
  poleGlow(g, w, h, ang, 4, L - 1, 1.6);
  drawCellSet(g, P.cells, h[0], h[1], true);
}
function lanceSmear(g, w, L0, Ly, cut) {
  const line = Math.abs(Ly.wa - L0.wa) < 0.3;
  drawPoleSmear(g, w, L0.hand, L0.wa, Ly.hand, Ly.wa, w.len * 2 + 7, line ? 18 : 10, line ? 2 : 0.5);
}

// ── 컷 표 ──
// 1 방패 뒤 낮은 찌르기: 방패를 앞에 세운 채 창을 허리춤 뒤로 당기며 뒷발에 무게 → 깊은 런지로 방패째 돌진하며 낮게 눕힌 창을 내지른다
// 2 어깨 위 내려찌르기: 창을 어깨 위로 치켜 메고(방패는 앞을 막는다) → 앞발을 내디디며 어깨 위에서 앞·아래로 내리꽂는다
const LN_READY = { fa: 'ln_ready', ba: 'ln_bGuardS', legs: 'set', wa: -0.14, dx: 0, skew: 0.02, sy: 1, sx: 0.94, hs: 0, hd: [0, 0], cape: 0.1, shield: 'bh', bfront: 'body' };
const LN_RECOVER = { fa: 'ln_recover', ba: 'ln_bGuardS', legs: 'recover', wa: -0.08, dx: 3, skew: 0.08, sy: 0.98, sx: 0.94, hs: 0.04, hd: [0.1, 0.15], cape: 0.35, shield: 'bh', bfront: 'body' };
const LN_LOW_CUTS = [
  { until: 0.12, fa: 'ln_pull',     ba: 'ln_bGuardS',  legs: 'load',      wa: -0.06, dx: -1, skew: -0.08, sy: 0.97, sx: 0.93, hs: -0.03, hd: [-0.15, 0.05], cape: 0.1, shield: 'bh', bfront: 'body' },
  { until: 0.31, fa: 'ln_pullFull', ba: 'ln_bGuardS',  legs: 'load',      wa: -0.02, dx: -3, skew: -0.16, sy: 0.93, sx: 0.9,  hs: -0.05, hd: [-0.3, 0.1],   cape: 0.0, shield: 'bh', bfront: 'body' },
  { until: 0.45, fa: 'ln_thrust',   ba: 'ln_bCharge',  legs: 'lungeDeep', wa: 0.03,  dx: 9,  skew: 0.36, sy: 0.88, sx: 0.94, hs: -0.02, hd: [0.4, 0.15],   cape: 1.0, smear: 'tip', shield: 'bh', bfront: 'body' },
  { until: 0.65, fa: 'ln_follow',   ba: 'ln_bCharge',  legs: 'lungeDeep', wa: 0.06,  dx: 8,  skew: 0.3,  sy: 0.9,  sx: 0.94, hs: 0,     hd: [0.3, 0.15],   cape: 0.75, shield: 'bh', bfront: 'body' },
  { until: 1, ...LN_RECOVER },
];
const LN_HIGH_CUTS = [
  { until: 0.12, fa: 'ln_lift',     ba: 'ln_bGuardS',  legs: 'set',       wa: -0.3,  dx: -1, skew: -0.06, sy: 1.02, sx: 0.93, hs: -0.05, hd: [-0.1, -0.1],  cape: 0.15, shield: 'bh', bfront: 'body' },
  { until: 0.31, fa: 'ln_high',     ba: 'ln_bGuardS',  legs: 'load',      wa: -0.05, dx: -3, skew: -0.16, sy: 1.04, sx: 0.9,  hs: -0.1,  hd: [-0.3, -0.25], cape: -0.05, shield: 'bh', bfront: 'body', wlayer: 'head' },
  { until: 0.45, fa: 'ln_stab',     ba: 'ln_bCharge',  legs: 'lunge',     wa: 0.3,   dx: 7,  skew: 0.32, sy: 0.9,  sx: 0.94, hs: 0.14,  hd: [0.4, 0.5],    cape: 0.95, smear: 'tip', shield: 'bh', bfront: 'body' },
  { until: 0.65, fa: 'ln_stabLow',  ba: 'ln_bCharge',  legs: 'lunge',     wa: 0.36,  dx: 7,  skew: 0.28, sy: 0.91, sx: 0.94, hs: 0.12,  hd: [0.3, 0.45],   cape: 0.7, shield: 'bh', bfront: 'body' },
  { until: 1, ...LN_RECOVER },
];
Object.assign(HERO_ATK.lance[0], { cuts: LN_LOW_CUTS, ready: LN_READY });
Object.assign(HERO_ATK.lance[1], { cuts: LN_HIGH_CUTS, ready: LN_READY });
for (const id of ['lance', 'holyLance']) CUT_WEAPON[id] = { draw: drawLanceCut, reach: (w) => w.len + 3.5, smear: lanceSmear, backHand: () => null };

// ── 컷 레이어 lance (자동 생성: dev/cutgen.py — 손으로 고칠 칸은 생성기의 FIX 에) ──
addCutSprites({
  ln_ready: { sh: [1.5, 0.5], hd: [5, 7], rows: [
    '.LA....',
    'LAA....',
    'LAA....',
    'LAA....',
    'LAA....',
    'LAAL...',
    '.AAASS.',
    '...aSSS',
    '....sSs',
  ] },
  ln_pull: { sh: [3.5, 0.5], hd: [5, 7], rows: [
    '...LA..',
    '..LAa..',
    '.LLAa..',
    '.LAa...',
    'LAAa...',
    'AAAAL..',
    '..AASS.',
    '....SSS',
    '....sSs',
  ] },
  ln_pullFull: { sh: [4.5, 0.5], hd: [4, 6], rows: [
    '...LLA',
    '..LLAa',
    '.LLAaa',
    'LAAa..',
    'AAAA..',
    '.AASS.',
    '..ASSS',
    '...sSs',
  ] },
  ln_thrust: { sh: [0.5, 0.5], hd: [11, 3], rows: [
    'LALL.........',
    'AAAALL.......',
    '.aAAAAALLLSS.',
    '....aAAAAASSS',
    '..........sSs',
  ] },
  ln_follow: { sh: [0.5, 0.5], hd: [10, 4], rows: [
    'LAL.........',
    'AAAAL.......',
    '.AAAAAL.....',
    '...AAAAAASS.',
    '.....aaaaSSS',
    '.........sSs',
  ] },
  ln_recover: { sh: [0.5, 0.5], hd: [5, 6], rows: [
    'LA.....',
    'AAa....',
    'AAa....',
    'AAA....',
    'AAA....',
    'LAALSS.',
    '.aAASSS',
    '....sSs',
  ] },
  ln_lift: { sh: [0.5, 3.5], hd: [4, 1], rows: [
    '...SS.',
    '...SSS',
    '...sSs',
    'LALLAa',
    'AAAAAa',
    '.aAAAa',
    '....a.',
  ] },
  ln_high: { sh: [0.5, 5.5], hd: [4, 1], rows: [
    '...SS.',
    '...SSS',
    '...sSs',
    '...LA.',
    '...LAa',
    'LALLAA',
    'AAAAAa',
    '.aaa..',
  ] },
  ln_stab: { sh: [0.5, 0.5], hd: [10, 2], rows: [
    'LALL........',
    'AAAAALLLLSS.',
    '.aaAAAAAASSS',
    '....aaaaasSs',
  ] },
  ln_stabLow: { sh: [0.5, 0.5], hd: [9, 4], rows: [
    'LAL........',
    'AAAA.......',
    '.AAAALL....',
    '..aAAAAASSA',
    '....AaaaSSS',
    '........sSs',
  ] },
  ln_bGuard: { sh: [0.5, 0.5], hd: [9, 4], rows: [
    'LAA........',
    'AAA........',
    'AAAA.......',
    '.AAAALLLSS.',
    '..AAAAAASSS',
    '...Aaaa.sSs',
  ] },
  ln_bGuardS: { sh: [0.5, 0.5], hd: [9, 2], rows: [
    'LAA........',
    'AAAA....SS.',
    'AAAAALLLSSS',
    '..AAAAAasSs',
    '...AAaa....',
  ] },
  ln_bCharge: { sh: [0.5, 0.5], hd: [10, 1], rows: [
    'LAL......SS.',
    'AAAAL.LLLSSS',
    '.aAAALAAasSs',
    '...aAAaa....',
  ] },
}, {
});
// ── 컷 레이어 lance 끝 ──
