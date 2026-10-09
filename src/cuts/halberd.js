'use strict';
// 평타 컷 (절충안): 할버드 계열 (할버드 · 종말의 도끼창 — 할버디어·전쟁군주). README '평타 애니메이션 — 컷 방식'
//  팔·다리 그림은 dev/cuts/halberd.py 가 이 파일 끝 블록(hb_*)에 굽고, 컷 표는 이 파일이 모션 객체에 단다 (mo.cuts / mo.ready)
//  도끼날 달린 긴 자루를 두 손으로 크게 휘둘러 휩쓴다(범위 공격) — 허리를 크게 돌리고(sx: 예비는 옆·등, 타격은 가슴을 연다) 양손이 원을 그린다.
//  뒷손은 앞손에서 자루 뒤쪽으로 bgrip 칸 (컷마다 정한다). 도트 도구(poleCells·poleGlow·poleShaft)는 spear.js 에 있다

// 할버드: 자루 + 도끼날(자루 각도 기준 시계 방향 쪽 = 내려칠 때 앞서가는 쪽) + 끝 창날 + 반대쪽 갈고리, 날 밑 쇠 띠
const HB_BACK = 13;      // 물미: 원점(앞손 + ext)에서 뒤로 13칸
function drawHalberdCut(g, w, Ly, cut, white, r) {
  const C = PX / 2, h = Ly.hand, ang = Ly.wa, e = (cut.ext || 0) / C, L = e + w.len * 2, P = poleCells(ang);
  const tipC = white ? '#ffffff' : w.tip, tipS = white ? '#ffffff' : spriteShadeCol(w.tip, -1), band = white ? '#ffffff' : (w.glow || '#8a8f9c');
  const edge = white ? '#ffffff' : '#f4f6fa';
  poleShaft(P, w, e - HB_BACK, L + 1, white);
  // 도끼날: 자루에서 1칸 떨어져 바깥으로 5칸 — 밑동은 좁고 날 끝(바깥 줄)으로 갈수록 넓어지는 부채꼴. 날 끝 줄은 밝게, 자루 쪽은 그늘
  const mid = L - 4.5;
  P.fill(mid - 3.5, mid + 3.5, (d) => 1 + Math.max(0, Math.abs(d - mid) - 1) * 1.6, () => 5.5, (d, q) => q >= 5 ? edge : q < 2.5 ? tipS : tipC);
  // 끝 창날: 자루 끝에서 6칸, 폭 ±1 → 0
  P.fill(L + 1, L + 6, (d) => d < L + 4 ? -1 : 0, (d) => d < L + 4 ? 1 : 0, (d, q) => q > 0.4 ? tipS : tipC);
  P.put(L + 7, 0, '#ffffff');
  // 갈고리: 반대쪽으로 3칸, 끝이 날 쪽으로 휜다
  P.fill(L - 4, L - 3, () => -2, () => -1, () => tipS); P.put(L - 4.5, -3, tipC); P.put(L - 5.5, -3, tipC);
  // 날 밑 쇠 띠 (두 칸, 폭 ±1)
  P.fill(L - 9, L - 8, () => -1, () => 1, () => band);
  poleGlow(g, w, h, ang, L - 7, L + 5, 2.2);
  drawCellSet(g, P.cells, h[0], h[1], true);
}
// 할버드 스미어: 도끼날·끝이 지나온 넓은 호 (날 쪽 바깥까지)
function halberdSmear(g, w, L0, Ly, cut) {
  const C = PX / 2, tip = (cut.ext || 0) / C + w.len * 2 + 6;
  drawPoleSmear(g, w, L0.hand, L0.wa, Ly.hand, Ly.wa, tip, 14, 2.5, 0.4);
}

// ── 컷 표 ──
// 1 크게 내려찍기: 할버드를 앞으로 세웠다가(들기) 머리 위를 넘겨 등 뒤까지 젖힌다(뒷발에 무게, 등이 보이게 허리를 돌림) → 앞발을 크게 내디디며 머리 위로 큰 원을 그려 앞·아래로 휩쓸어 내려찍는다
// 2 퍼올려 휩쓸기: 날을 허리 뒤 아래로 내리고 깊이 웅크려 허리를 돌린다 → 몸을 펴며(살짝 뜬다) 아래에서 앞·위로 크게 퍼올려 휩쓴다
const HB_READY = { fa: 'hb_ready', ba: 'hb_bReady', legs: 'set', wa: -1.05, ext: 0, bgrip: 5, dx: 0, skew: 0.02, sy: 1, sx: 0.94, hs: 0, hd: [0, 0], cape: 0.1 };
const HB_RECOVER = { fa: 'hb_recover', ba: 'hb_bRecover', legs: 'recover', wa: -0.8, ext: 0, bgrip: 6, dx: 3, skew: 0.08, sy: 0.98, sx: 0.94, hs: 0.04, hd: [0.1, 0.15], cape: 0.35 };
const HB_DOWN_CUTS = [
  { until: 0.12, fa: 'hb_raise',    ba: 'hb_bRaise',    legs: 'set',       wa: -1.75, ext: 0, bgrip: 4, dx: -1, skew: -0.06, sy: 1.02, sx: 0.93, hs: -0.05, hd: [-0.1, -0.1],  cape: 0.15 },
  { until: 0.31, fa: 'hb_windup',   ba: 'hb_bWindup',   legs: 'load',      wa: -2.75, ext: 0, bgrip: 3.5, dx: -3, skew: -0.2,  sy: 1.05, sx: 0.85, hs: -0.12, hd: [-0.35, -0.3], cape: -0.05 },
  { until: 0.45, fa: 'hb_chop',     ba: 'hb_bChop',     legs: 'lunge',     wa: 0.1,  ext: 0, bgrip: 6, dx: 6,  skew: 0.34, sy: 0.9,  sx: 0.94, hs: 0.16,  hd: [0.45, 0.6],   cape: 1.0, smear: true },
  { until: 0.65, fa: 'hb_chopLow',  ba: 'hb_bChopLow',  legs: 'lunge',     wa: 0.25,  ext: 0, bgrip: 6, dx: 6,  skew: 0.28, sy: 0.91, sx: 0.94, hs: 0.12,  hd: [0.35, 0.55],  cape: 0.7 },
  { until: 1, ...HB_RECOVER },
];
const HB_UP_CUTS = [
  { until: 0.12, fa: 'hb_low',      ba: 'hb_bLow',      legs: 'crouch',    wa: 2.85,  ext: 0, bgrip: 7, dx: -2, skew: -0.08, sy: 0.95, sx: 0.92, hs: -0.03, hd: [-0.1, 0.2],   cape: 0.1 },
  { until: 0.31, fa: 'hb_lowFull',  ba: 'hb_bLowFull',  legs: 'crouch',    wa: 2.95,   ext: 0, bgrip: 7, dx: -3, skew: -0.14, sy: 0.9,  sx: 0.87, hs: -0.06, hd: [-0.3, 0.35],  cape: 0.0 },
  { until: 0.45, fa: 'hb_scoop',    ba: 'hb_bScoop',    legs: 'rise',      wa: -0.95, ext: 0, bgrip: 8, dx: 5,  skew: 0.22, sy: 1.06, sx: 0.94, lift: 4, hs: 0, hd: [0.3, -0.3], cape: 0.95, smear: true },
  { until: 0.65, fa: 'hb_high',     ba: 'hb_bHigh',     legs: 'rise',      wa: -1.75, ext: 0, bgrip: 6, dx: 5,  skew: 0.1,  sy: 1.05, sx: 0.94, lift: 2, hs: -0.04, hd: [0.1, -0.4], cape: 0.75 },
  { until: 1, ...HB_RECOVER },
];
Object.assign(HERO_ATK.halberd[0], { cuts: HB_DOWN_CUTS, ready: HB_READY });
Object.assign(HERO_ATK.halberd[1], { cuts: HB_UP_CUTS, ready: HB_READY });
for (const id of ['halberd', 'doomAxe']) CUT_WEAPON[id] = { draw: drawHalberdCut, reach: (w, cut) => w.len + (cut.ext || 0) / PX + 3, smear: halberdSmear };

// ── 컷 레이어 halberd (자동 생성: dev/cutgen.py — 손으로 고칠 칸은 생성기의 FIX 에) ──
addCutSprites({
  hb_ready: { sh: [0.5, 0.5], hd: [5, 3], rows: [
    'LA.....',
    'AAA....',
    'AAAASS.',
    '.AAASSS',
    '.AAAsSs',
    '..AAa..',
  ] },
  hb_raise: { sh: [0.5, 2.5], hd: [3, 1], rows: [
    '..SS..',
    '..SSS.',
    'LAsSs.',
    'AAAAA.',
    'AAAAA.',
    '..AAAA',
    '...Aa.',
  ] },
  hb_windup: { sh: [4.5, 8.5], hd: [1, 1], rows: [
    'SS.....',
    'SSSL...',
    'sSsAAL.',
    '...AAAA',
    '....AAA',
    '....LAa',
    '....LAa',
    '....LAa',
    '....AAa',
    '....Aa.',
  ] },
  hb_chop: { sh: [0.5, 0.5], hd: [9, 3], rows: [
    'LAL........',
    'AAAAL......',
    '.AAAALLLSS.',
    '..aAAAAASSS',
    '....aaaasSs',
  ] },
  hb_chopLow: { sh: [0.5, 0.5], hd: [8, 6], rows: [
    'LAA.......',
    'AAA.......',
    'AAAA......',
    '.AAAA.....',
    '..AAALL...',
    '...AAAASS.',
    '.....aaSSS',
    '.......sSs',
  ] },
  hb_recover: { sh: [0.5, 0.5], hd: [5, 3], rows: [
    'LA.....',
    'AAA....',
    'AAA.SS.',
    '.AAASSS',
    '.AALsSs',
    '..AAa..',
  ] },
  hb_low: { sh: [4.5, 0.5], hd: [1, 7], rows: [
    '...LLA',
    '...LAa',
    '..LAAa',
    '..LAa.',
    '.LAa..',
    '.LAa..',
    'SSa...',
    'SSS...',
    'sSs...',
  ] },
  hb_lowFull: { sh: [5.5, 0.5], hd: [1, 6], rows: [
    '....LLA',
    '...LLAa',
    '..LLAaa',
    '..LAa..',
    '.LAa...',
    'SSa....',
    'SSS....',
    'sSs....',
  ] },
  hb_scoop: { sh: [0.5, 3.5], hd: [8, 1], rows: [
    '.......SS.',
    '......LSSS',
    '.....LAsSs',
    'LALLLLAa..',
    'AAAAAAa...',
    '.aaaaa....',
  ] },
  hb_high: { sh: [0.5, 8.5], hd: [3, 1], rows: [
    '..SS..',
    '..SSS.',
    '..sSs.',
    '..AAA.',
    '...AA.',
    '...AA.',
    '..LLAa',
    'LLAAa.',
    'LAAa..',
    'Aaa...',
  ] },
  hb_bReady: { sh: [0.5, 0.5], hd: [8, 7], rows: [
    'LA........',
    'AAA.......',
    'AAA.......',
    '.AAA......',
    '.AAA......',
    '..AAALL...',
    '...aAAASS.',
    '......aSSS',
    '.......sSs',
  ] },
  hb_bRaise: { sh: [0.5, 0.5], hd: [9, 2], rows: [
    'LAA........',
    'AAAA....SS.',
    'AAAAA.LLSSS',
    '..AAAAAAsSs',
    '...AAaa....',
  ] },
  hb_bWindup: { sh: [0.5, 7.5], hd: [8, 1], rows: [
    '.......SS.',
    '.......SSS',
    '.......sSs',
    '......LAa.',
    '......LA..',
    '.....LAa..',
    '.LLLLLAa..',
    'LAAAAAa...',
    'AAaaa.....',
  ] },
  hb_bChop: { sh: [0.5, 0.5], hd: [8, 2], rows: [
    'LAA.......',
    'AAAA...SSA',
    'AAAAALLSSS',
    '..AAAAAsSs',
    '....Aa....',
  ] },
  hb_bChopLow: { sh: [0.5, 0.5], hd: [7, 4], rows: [
    'LAA......',
    'AAA......',
    'AAAA.....',
    '.AAAALSSA',
    '..AAAASSS',
    '...AaasSs',
  ] },
  hb_bRecover: { sh: [0.5, 0.5], hd: [6, 7], rows: [
    'LA......',
    'AAA.....',
    'AAA.....',
    'AAA.....',
    '.AAA....',
    '.AAAL...',
    '..AAASS.',
    '....aSSS',
    '.....sSs',
  ] },
  hb_bLow: { sh: [0.5, 0.5], hd: [9, 4], rows: [
    'LAA........',
    'AAA........',
    'AAAA.......',
    '.AAAA...SS.',
    '..AAALAASSS',
    '...AAAaasSs',
  ] },
  hb_bLowFull: { sh: [0.5, 0.5], hd: [8, 4], rows: [
    'LAA.......',
    'AAA.......',
    'AAAA......',
    '.AAAA..SS.',
    '..AAAAASSS',
    '...AAaasSs',
  ] },
  hb_bScoop: { sh: [0.5, 0.5], hd: [9, 4], rows: [
    'LAA........',
    'AAA........',
    'AAAA.......',
    '.AAAA.LLSS.',
    '..AAAAAASSS',
    '...AAaaasSs',
  ] },
  hb_bHigh: { sh: [0.5, 3.5], hd: [9, 1], rows: [
    '........SS.',
    '........SSS',
    '.......LsSs',
    'LALLLLLAa..',
    'AAAAAAAa...',
    '.aaaaaa....',
  ] },
}, {
});
// ── 컷 레이어 halberd 끝 ──
