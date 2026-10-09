'use strict';
// 평타 컷 (절충안): 쌍검 계열 (쌍검 · 월광쌍검 — 검성·검신). README '평타 애니메이션 — 컷 방식'
//  팔·다리 그림은 dev/cuts/dual.py 가 이 파일 끝 블록(dl_*)에 굽고, 컷 표는 이 파일이 모션 객체에 단다 (mo.cuts / mo.ready)
//  두 손에 칼 한 자루씩: wa 앞손 칼 · wb 뒷손 칼(뒷팔 그림의 손에 붙는다, 엔진이 그린다)
//  smear: true 앞손 칼만 · 'b' 뒷손 칼만 · 'both' 두 칼 다 (X 베기) — 뒷손 칼 자리는 앞 컷의 wb 에서 이 컷의 wb 까지
(() => {
  const C = PX / 2;
  const backHandOf = (L) => [L.bs[0] + L.ba.vec[0] * C, L.bs[1] + L.ba.vec[1] * C];
  const DL_DEF = {
    smear(g, w, L0, Ly, cut) {
      if (cut.smear === true || cut.smear === 'both') drawCutSmear(g, w, L0.hand, L0.wa, Ly.hand, Ly.wa, w.len);
      if ((cut.smear === 'b' || cut.smear === 'both') && cut.wb0 != null) drawCutSmear(g, w, backHandOf(L0), cut.wb0, backHandOf(Ly), cut.wb, w.len - 1);
    },
  };
  CUT_WEAPON.dualBlades = DL_DEF;
  CUT_WEAPON.moonBlades = DL_DEF;

  // ── 컷 표 ── cape: 목도리 꼬리 날림 (0 아래로 늘어짐 ~ 1 뒤로 수평, 끝이 살짝 들린다)
  // 대기: 무릎을 살짝 굽혀 가볍게 서고, 앞손 칼은 적을 겨누고 뒷손 칼은 거꾸로 뒤로 늘어뜨린다
  const READY = { fa: 'dl_ready', ba: 'dlb_ready', legs: 'dl_ready', wa: -0.55, wb: 2.75, dx: 0, skew: 0.04, sy: 1, sx: 1, hs: 0.02, hd: [0, 0], cape: 0.25 };
  const RECOVER = { fa: 'dl_recover', ba: 'dlb_recover', legs: 'recover', wa: -0.35, wb: 2.6, dx: 3, skew: 0.08, sy: 0.98, sx: 1, hs: 0.04, hd: [0.1, 0.1], cape: 0.4 };
  // 1 앞손 내려베기 → 뒷손 올려베기: 앞손 칼을 머리 위로 넘기고 뒷손은 뒤로 젖혀(뒷발에 무게) → 앞손으로 내려베고 →
  //   몸을 틀며 뒷손 칼을 아래에서 위로 퍼올린다 (판정은 앞손 내려베기, 뒷손은 이어지는 두 번째 칼)
  const CHAIN = [
    { until: 0.1,  fa: 'dl_raise',  ba: 'dlb_low',   legs: 'set',       wa: -1.9,  wb: 2.85, dx: -1, skew: -0.06, sy: 1.02, sx: 0.96, hs: -0.04, hd: [-0.1, -0.1],  cape: 0.2 },
    { until: 0.3,  fa: 'dl_windup', ba: 'dlb_back',  legs: 'load',      wa: -2.6,  wb: 2.95, dx: -3, skew: -0.18, sy: 1.05, sx: 0.9,  hs: -0.1,  hd: [-0.3, -0.3],  cape: 0.15 },
    { until: 0.42, fa: 'dl_strike', ba: 'dlb_cock',  legs: 'lunge',     wa: 0.7,   wb: 2.75, dx: 5,  skew: 0.3,   sy: 0.92, sx: 1.06, hs: 0.15,  hd: [0.4, 0.55],   cape: 0.9, smear: true },
    { until: 0.64, fa: 'dl_follow', ba: 'dlb_up',    legs: 'rise',      wa: 0.95,  wb: -1.15, dx: 6, skew: 0.16,  sy: 1.04, sx: 0.93, lift: 2, hs: -0.02, hd: [0.2, -0.2], cape: 0.8, smear: 'b', bfront: 'body' },
    { until: 1, ...RECOVER },
  ];
  // 2 X 베기: 두 칼을 머리 앞에서 X 자로 겹쳐 들어 올렸다가(살짝 뜬다) → 깊은 런지로 내려앉으며 두 칼을 엇갈려 갈라 벤다
  const CROSS = [
    { until: 0.12, fa: 'dl_xRaise', ba: 'dlb_xRaise', bfront: 'body', legs: 'set',       wa: -1.75, wb: -0.6, dx: -1, skew: -0.05, sy: 1.02, sx: 0.94, hs: -0.03, hd: [-0.1, -0.1], cape: 0.2 },
    { until: 0.3,  fa: 'dl_xHigh',  ba: 'dlb_xHigh',  bfront: 'body', legs: 'load',      wa: -2.3,  wb: -0.55, dx: -2, skew: -0.14, sy: 1.06, sx: 0.92, lift: 2, hs: -0.1, hd: [-0.3, -0.35], cape: 0.15 },
    { until: 0.44, fa: 'dl_xCut',   ba: 'dlb_xCut',                   legs: 'lungeDeep', wa: 0.85,  wb: 2.2,  dx: 7,  skew: 0.34,  sy: 0.88, sx: 1.06, hs: 0.18,  hd: [0.45, 0.6],  cape: 1.0, smear: 'both' },
    { until: 0.64, fa: 'dl_xFollow',ba: 'dlb_xFollow',                legs: 'lungeDeep', wa: 1.2,   wb: 2.5,  dx: 7,  skew: 0.28,  sy: 0.9,  sx: 1.04, hs: 0.14,  hd: [0.35, 0.5],  cape: 0.75 },
    { until: 1, ...RECOVER },
  ];
  for (const cuts of [CHAIN, CROSS]) cuts.forEach((k, i) => { if (i && (k.smear === 'b' || k.smear === 'both')) k.wb0 = cuts[i - 1].wb; });
  const list = HERO_ATK.dualBlades;          // moonBlades 는 같은 배열(별칭)
  Object.assign(list[0], { cuts: CHAIN, ready: READY });
  Object.assign(list[1], { cuts: CROSS, ready: READY });
})();

// ── 컷 레이어 dual (자동 생성: dev/cutgen.py — 손으로 고칠 칸은 생성기의 FIX 에) ──
addCutSprites({
  dl_ready: { sh: [1.5, 0.5], hd: [6, 8], rows: [
    '.LA.....',
    'LAA.....',
    'LAA.....',
    'LAA.....',
    'LAa.....',
    'LAa.....',
    'AAAAL...',
    '.aaAASS.',
    '....aSSS',
    '.....sSs',
  ] },
  dl_raise: { sh: [0.5, 2.5], hd: [4, 1], rows: [
    '...SS.',
    '...SSS',
    'LAAsSs',
    'AAAAAA',
    '.AAAAA',
    '..AAAA',
    '...AAA',
    '.....a',
  ] },
  dl_windup: { sh: [1.5, 11.5], hd: [1, 1], rows: [
    'SS..',
    'SSS.',
    'sSs.',
    '.AA.',
    '.AAA',
    '.AAA',
    '..AA',
    '.LAA',
    '.LAa',
    '.LAa',
    '.LAa',
    '.AAa',
    '.Aa.',
  ] },
  dl_strike: { sh: [0.5, 0.5], hd: [10, 4], rows: [
    'LAL.........',
    'AAAA........',
    '.AAAAL......',
    '..AAAALLLSS.',
    '....AAAAASSS',
    '.........sSs',
  ] },
  dl_follow: { sh: [0.5, 0.5], hd: [7, 9], rows: [
    'LA.......',
    'AAA......',
    'AAA......',
    '.AA......',
    '.AAA.....',
    '.AAA.....',
    '..AAA....',
    '...AAA...',
    '....AASS.',
    '.....ASSS',
    '......sSs',
  ] },
  dl_recover: { sh: [1.5, 0.5], hd: [6, 7], rows: [
    '.LA.....',
    'LAA.....',
    'LAA.....',
    'LAA.....',
    'LAA.....',
    'LAa.....',
    'LAAAASS.',
    '.aaaASSS',
    '.....sSs',
  ] },
  dl_xRaise: { sh: [0.5, 4.5], hd: [4, 1], rows: [
    '...SS..',
    '...SSS.',
    '...sSs.',
    '....AA.',
    'LALLAAA',
    'AAAAAAA',
    '.aaAAAA',
    '....aaa',
  ] },
  dl_xHigh: { sh: [0.5, 11.5], hd: [1, 1], rows: [
    'SS..',
    'SSS.',
    'sSs.',
    '.AA.',
    '.AA.',
    '.LAA',
    '.LAA',
    '.LAa',
    '.LAa',
    'LAA.',
    'LAa.',
    'LAa.',
    'Aa..',
  ] },
  dl_xCut: { sh: [0.5, 0.5], hd: [10, 5], rows: [
    'LAA.........',
    'AAAA........',
    '.AAAA.......',
    '..AAAAL.....',
    '...AAAAALSS.',
    '.....aaaASSS',
    '.........sSs',
  ] },
  dl_xFollow: { sh: [0.5, 0.5], hd: [8, 8], rows: [
    'LA........',
    'AAA.......',
    'AAA.......',
    '.AAA......',
    '.AAA......',
    '..AAA.....',
    '...AAAL...',
    '....AAASS.',
    '......ASSS',
    '.......sSs',
  ] },
  dlb_ready: { sh: [1.5, 0.5], hd: [3, 10], rows: [
    '.LA..',
    'LAA..',
    'LAa..',
    'LAa..',
    'LA...',
    'AA...',
    'AA...',
    'AAA..',
    '.AAA.',
    '..SS.',
    '..SSS',
    '..sSs',
  ] },
  dlb_low: { sh: [4.5, 0.5], hd: [2, 9], rows: [
    '...LLA',
    '...LAa',
    '..LAaa',
    '.LAa..',
    'LAa...',
    'AAA...',
    '.AA...',
    '.AA...',
    '.SS...',
    '.SSS..',
    '.sSs..',
  ] },
  dlb_back: { sh: [7.5, 0.5], hd: [1, 6], rows: [
    '..LLLLLLA',
    '..AAAAAAa',
    '.LAaaaa..',
    '.LA......',
    '.Aa......',
    'SSa......',
    'SSS......',
    'sSs......',
  ] },
  dlb_cock: { sh: [6.5, 0.5], hd: [1, 7], rows: [
    '....LLLA',
    '..LLAAAa',
    '.LAAaaa.',
    '.AA.....',
    '.Aa.....',
    'LAa.....',
    'SS......',
    'SSS.....',
    'sSs.....',
  ] },
  dlb_up: { sh: [0.5, 5.5], hd: [8, 1], rows: [
    '.......SS.',
    '.......SSS',
    '.......sSs',
    '.......Aa.',
    '......LA..',
    'LALLLLAa..',
    'AAAAAAA...',
  ] },
  dlb_recover: { sh: [3.5, 0.5], hd: [3, 10], rows: [
    '...LA',
    '..LAa',
    '.LAAa',
    '.LAa.',
    'LAa..',
    'AA...',
    'AAA..',
    '.AA..',
    '.AA..',
    '..SS.',
    '..SSS',
    '..sSs',
  ] },
  dlb_xRaise: { sh: [0.5, 3.5], hd: [6, 1], rows: [
    '.....SS.',
    '.....SSS',
    '.....sSs',
    'LAL..LA.',
    'AAAALAA.',
    '.aAAAAA.',
    '...aAAa.',
    '.....a..',
  ] },
  dlb_xHigh: { sh: [0.5, 9.5], hd: [6, 1], rows: [
    '.....SS.',
    '.....SSS',
    '.....sSs',
    '.....LA.',
    '.....Aa.',
    '....LAa.',
    '...LAA..',
    '..LAAa..',
    '.LAAa...',
    'LAaa....',
    'Aaa.....',
  ] },
  dlb_xCut: { sh: [4.5, 0.5], hd: [1, 9], rows: [
    '...LLA',
    '..LLAa',
    '.LLAa.',
    'LAAa..',
    'AAa...',
    'AA....',
    'AA....',
    'LA....',
    'SS....',
    'SSS...',
    'sSs...',
  ] },
  dlb_xFollow: { sh: [5.5, 0.5], hd: [1, 8], rows: [
    '....LLA',
    '..LLAAa',
    'LLAAaa.',
    'LAaa...',
    'LA.....',
    'LA.....',
    'LA.....',
    'SS.....',
    'SSS....',
    'sSs....',
  ] },
}, {
  dl_ready: { hip: [7, 2], g: 7.2, rows: [
    '..ppp....mll...',
    '..ppq....mlll..',
    '..pppq...mlll..',
    '..pppq....llll.',
    '..pppq....mlln.',
    '.pppqq.....mln.',
    '.ppqq......mln.',
    'jjjj......kKKKk',
    'jjjj......kKKKk',
  ] },
});
// ── 컷 레이어 dual 끝 ──
