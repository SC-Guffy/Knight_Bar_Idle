'use strict';
// 평타 컷 (절충안): 석궁 계열 — 거대 석궁(석궁사수)·공성 석궁(공성포수, ballista 별칭).
// 팔·다리 그림은 dev/cuts/crossbow.py 가 이 파일 끝 'crossbow' 블록에 굽고, 컷 표는 아래에서 HERO_ATK.ballista[n] 에 cuts·ready 로 단다 (README '평타 애니메이션 — 컷 방식')
//
// 석궁은 CUT_WEAPON 으로 1.5px 도트 격자에 찍는다 (원래 drawCrossbow 의 생김새·색: 나무 몸체 w.wood·개머리판·쇠 방아쇠 틀·쇠 활대 w.steel·시위·살 w.arrow.color).
//  앞손(Ly.hand)이 몸체 아래 손잡이를 쥐고(몸체 줄은 손 위로 GRIP_UP px), 뒷손은 뒷팔 그림의 손 자리 — 그림을 개머리 아래를 받치도록 그렸다 (crossbow.py STOCK).
//  pull 은 시위를 걸어 당긴 거리(px), arrow false 면 살이 날아가고 없다, twang 이면 놓은 직후 시위가 떨린다.
//  컷 원칙: 들어 올림 → 어깨에 견착해 조준(가장 길게, 볼을 개머리에 붙임) → 발사(s = 0.45 가 이 컷 안: 큰 반동 — 앞코가 들리고 몸이 뒤로 밀리며 망토가 날림) → 여운 → 거두기.
//  무겁고 묵직하게: 반동 디딤(dx)이 크고, 팔꿈치는 늘 아래로 처져 무게를 받친다.
(() => {
  const C = PX / 2, GRIP_UP = 2.25;
  const cellPut = (m, O, x, y, col, keep = false) => { const k = Math.round((x - O[0]) / C) + ',' + Math.round((y - O[1]) / C); if (!keep || !m.has(k)) m.set(k, col); };
  const cellLine = (m, O, p, q, col) => {
    const i0 = (p[0] - O[0]) / C, j0 = (p[1] - O[1]) / C, i1 = (q[0] - O[0]) / C, j1 = (q[1] - O[1]) / C, n = Math.max(1, Math.round(Math.max(Math.abs(i1 - i0), Math.abs(j1 - j0))));
    for (let k = 0; k <= n; k++) m.set(Math.round(i0 + (i1 - i0) * k / n) + ',' + Math.round(j0 + (j1 - j0) * k / n), col);
  };
  function drawCrossbowCut(g, w, Ly, cut, white, r) {
    const h = Ly.hand, a = cut.bowA || 0, ca = Math.cos(a), sa = Math.sin(a), R = w.size, pull = cut.pull || 0;
    const O = [h[0] + GRIP_UP * sa, h[1] - GRIP_UP * ca];           // 몸체 가운데 줄: 손잡이(주먹) 위로 GRIP_UP — 몸체가 팔 위에 얹혀 보인다
    const W = (u, v) => [O[0] + u * ca - v * sa, O[1] + u * sa + v * ca];
    r.fh = O;                                                         // 발사 섬광(drawAtkFx)이 몸체 줄을 따른다
    const wh = (c) => (white ? '#ffffff' : c);
    const wood = wh(w.wood), woodL = wh(spriteShadeCol(w.wood, 1)), woodD = wh(spriteShadeCol(w.wood, -1)), steel = wh(w.steel || '#9a9aa6'), steelD = wh(spriteShadeCol(w.steel || '#9a9aa6', -1));
    const m = new Map();
    const area = (u0, u1, v0, v1, col) => { for (let u = u0; u <= u1 + 0.01; u += C * 0.5) for (let v = v0; v <= v1 + 0.01; v += C * 0.5) cellPut(m, O, ...W(u, v), col); };
    // 몸체(두 칸 두께, 윗줄 밝게) · 개머리판 · 방아쇠 틀
    area(-0.7 * R, 1.05 * R, 0, 1.2, wood);
    area(-0.7 * R, 1.05 * R, -1.3, -0.6, woodL);
    area(-0.7 * R, -0.42 * R, 1.2, 4.2, woodD);
    area(0.1 * R, 0.1 * R + 2.5, -2.5, 2.5, steel);
    area(-1.5, 0, 1.2, GRIP_UP + 0.5, woodD);                       // 손잡이 (주먹 속으로)
    // 활대 (쇠, 가운데가 앞으로 휜 곡선 — 당길수록 끝이 조금 뒤로)
    const fx = 0.9 * R, flex = Math.min(2, pull * 0.12), Rv = 0.8 * R - flex * 0.3;
    const prod = (s) => { const k = (1 - s) * (1 - s) + s * s; return [fx - flex * k + 2 * s * (1 - s) * (0.35 * R + flex), Rv * (2 * s - 1)]; };
    for (let i = 0; i <= 40; i++) { const s = i / 40, p = prod(s); cellPut(m, O, ...W(p[0], p[1]), Math.abs(2 * s - 1) > 0.85 ? steelD : steel); if (Math.abs(2 * s - 1) < 0.45) cellPut(m, O, ...W(p[0] + C * 0.9, p[1]), steel, true); }
    // 살
    const sx = fx - 2 - pull;
    if (cut.arrow !== false) {
      cellLine(m, O, W(sx, -C * 0.6), W(fx + 9, -C * 0.6), wh(w.arrow.color));
      const head = wh('#c9c2b4');
      for (const [u, v] of [[fx + 10.5, -C * 0.6], [fx + 12, -C * 0.6], [fx + 13.5, -C * 0.6], [fx + 10.5, -C * 1.6], [fx + 10.5, C * 0.4]]) cellPut(m, O, ...W(u, v), head);
    }
    const tip0 = W(...prod(0)), tip1 = W(...prod(1)), nock = W(sx, -C * 0.6);
    const sm = new Map(), strC = wh('#e4ddcc');
    if (cut.twang) {
      for (const [off, col] of [[fx + C, strC], [fx - C * 1.5, white ? '#ffffff' : 'rgba(255,255,255,0.4)']]) { const mid = W(off, 0); cellLine(sm, O, tip0, mid, col); cellLine(sm, O, mid, tip1, col); }
      drawCellSet(g, sm, O[0], O[1], false);
      drawCellSet(g, m, O[0], O[1], true);
    } else {
      cellLine(sm, O, tip0, nock, strC); cellLine(sm, O, nock, tip1, strC);
      drawCellSet(g, m, O[0], O[1], true);
      drawCellSet(g, sm, O[0], O[1], false);
    }
  }
  // 살이 나가는 자리(heroMuzzle): 몸체 줄(손 위 GRIP_UP)의 앞코
  const muzzle = (w, Ly, cut) => { const a = cut.bowA || 0, h = Ly.hand, L = w.size * 0.9 + 10; return [h[0] + GRIP_UP * Math.sin(a) + L * Math.cos(a), h[1] - GRIP_UP * Math.cos(a) + L * Math.sin(a)]; };
  const CB_CUT = { backHand: (w, Ly) => [Ly.bs[0] + Ly.ba.vec[0] * C, Ly.bs[1] + Ly.ba.vec[1] * C], draw: drawCrossbowCut, muzzle };
  CUT_WEAPON.ballista = CB_CUT; CUT_WEAPON.siegeBallista = CB_CUT;

  // ── 컷 표 ── fa/ba 는 crossbow.py POSES 이름(cb_f·cb_b + 자세) — 같은 자세의 앞팔·뒷팔을 짝지어 쓴다 (bowA 도 그 자세의 값)
  //  bfront 'body': 뒷팔이 가슴 앞을 지나 석궁 밑을 받친다 (석궁이 손을 덮는다)
  const P = (name) => ({ fa: 'cb_f' + name, ba: 'cb_b' + name, bfront: 'body' });
  const READY = { ...P('Ready'), legs: 'cb_stand', bowA: 0.3, pull: 10, dx: 0, skew: 0.04, sy: 1, sx: 0.92, hs: 0.02, hd: [0, 0.05], cape: 0.1 };
  // 1 어깨에 견착하고 장전해 쏘면 큰 반동
  const SHOULDER = [
    { until: 0.14, ...P('Lift'),    legs: 'cb_brace',  bowA: 0.12,  pull: 10, dx: -1, skew: -0.02, sy: 1.01, sx: 0.92, hs: 0.02,  hd: [0.1, 0.1],   cape: 0.1 },
    { until: 0.44, ...P('Aim'),     legs: 'cb_brace',  bowA: 0,     pull: 13, dx: -2, skew: 0.05,  sy: 0.98, sx: 0.9,  hs: 0.07,  hd: [0.2, 0.6],   cape: 0 },
    { until: 0.56, ...P('Kick'),    legs: 'cb_recoil', bowA: -0.3,  pull: 0, arrow: false, twang: true, dx: -9, skew: -0.22, sy: 1, sx: 0.91, hs: -0.12, hd: [-0.4, -0.1], cape: 1.0 },
    { until: 0.76, ...P('Settle'),  legs: 'cb_settle', bowA: -0.12, pull: 0, arrow: false, dx: -7, skew: -0.1, sy: 0.99, sx: 0.92, hs: -0.04, hd: [-0.15, 0.05], cape: 0.5 },
    { until: 1,    ...P('Recover'), legs: 'cb_stand',  bowA: 0.2,   pull: 0, arrow: false, dx: -3, skew: 0,    sy: 1,    sx: 0.92, hs: 0.02,  hd: [0, 0.05],    cape: 0.2 },
  ];
  // 2 무릎 꿇고 낮게 쏘기
  const KNEEL = [
    { until: 0.16, ...P('Lift'),    legs: 'cb_kneel',     bowA: 0.1,   pull: 10, dx: 0,  skew: 0.02,  sy: 1,    sx: 0.92, hs: 0.03,  hd: [0.1, 0.15],  cape: 0.05 },
    { until: 0.44, ...P('Aim'),     legs: 'cb_kneel',     bowA: 0.02,  pull: 13, dx: -1, skew: 0.05,  sy: 0.98, sx: 0.9,  hs: 0.07,  hd: [0.2, 0.6],   cape: 0 },
    { until: 0.56, ...P('Kick'),    legs: 'cb_kneelBack', bowA: -0.26, pull: 0, arrow: false, twang: true, dx: -7, skew: -0.18, sy: 1, sx: 0.91, hs: -0.1, hd: [-0.35, -0.1], cape: 0.9 },
    { until: 0.76, ...P('Settle'),  legs: 'cb_kneelBack', bowA: -0.1,  pull: 0, arrow: false, dx: -6, skew: -0.08, sy: 1, sx: 0.92, hs: -0.03, hd: [-0.15, 0.05], cape: 0.45 },
    { until: 1,    ...P('Recover'), legs: 'cb_half',      bowA: 0.2,   pull: 0, arrow: false, dx: -3, skew: 0.04,  sy: 0.99, sx: 0.92, hs: 0.02,  hd: [0, 0.1],     cape: 0.2 },
  ];
  const set = (mo, cuts) => { if (mo) { mo.cuts = cuts; mo.ready = READY; } };
  set(HERO_ATK.ballista[0], SHOULDER);         // siegeBallista 는 ballista 배열을 함께 쓴다
  set(HERO_ATK.ballista[1], KNEEL);
})();

// ── 컷 레이어 crossbow (자동 생성: dev/cutgen.py — 손으로 고칠 칸은 생성기의 FIX 에) ──
addCutSprites({
  cb_fReady: { sh: [1.5, 1.5], hd: [6, 7], rows: [
    '.LL.....',
    'LLAA....',
    'LAAa....',
    'LAA.....',
    'LAA.....',
    'LAA.....',
    'LAALLSS.',
    '.AAAASSS',
    '.....sSs',
  ] },
  cb_bReady: { sh: [1.5, 1.5], hd: [7, 5], rows: [
    '.LL......',
    'LLAA.....',
    'LAAA.....',
    '.AAA.....',
    '.AAA..SS.',
    '.LAALLSSS',
    '.LAAAAsSs',
    '..Aaa....',
  ] },
  cb_fLift: { sh: [1.5, 1.5], hd: [8, 4], rows: [
    '.LL.......',
    'LLAA......',
    'AAAA......',
    '.AAA...SS.',
    '..AAALLSSS',
    '..AALAAsSs',
    '...AAaa...',
    '...aa.....',
  ] },
  cb_bLift: { sh: [1.5, 1.5], hd: [9, 3], rows: [
    '.LL........',
    'LLAA.......',
    'AAAA....SS.',
    '.AAAA..LSSS',
    '..AAALLAsSs',
    '...AAAAa...',
    '....Aa.....',
  ] },
  cb_fAim: { sh: [1.5, 1.5], hd: [8, 2], rows: [
    '.LL.......',
    'LLAA...SS.',
    'AAAA...SSS',
    '.AAAA.LsSs',
    '..AAALAa..',
    '...AAAa...',
    '....Aa....',
  ] },
  cb_bAim: { sh: [1.5, 1.5], hd: [9, 2], rows: [
    '.LL........',
    'LLAA....SS.',
    'AAAAA..LSSS',
    '.AAAAALAsSs',
    '...AAAAaa..',
    '....AAa....',
    '.....a.....',
  ] },
  cb_fKick: { sh: [1.5, 1.5], hd: [7, 1], rows: [
    '.LL...SS.',
    'LLAA..SSS',
    'AAAA..sSs',
    '.AAAALAa.',
    '..AAAAa..',
    '...AAAa..',
    '....Aa...',
  ] },
  cb_bKick: { sh: [1.5, 1.5], hd: [9, 2], rows: [
    '.LL........',
    'LLAA....SS.',
    'AAAAA..LSSS',
    '.AAAAALAsSs',
    '...AAAAaa..',
    '....AAa....',
    '.....a.....',
  ] },
  cb_fSettle: { sh: [1.5, 1.5], hd: [7, 2], rows: [
    '.LL......',
    'LLAA..SS.',
    'AAAA..SSS',
    '.AAAALsSs',
    '..AAAAa..',
    '..AAAAa..',
    '...AAa...',
    '....a....',
  ] },
  cb_bSettle: { sh: [1.5, 1.5], hd: [8, 2], rows: [
    '.LL.......',
    'LLAA...SS.',
    'AAAA...SSS',
    '.AAAA.LsSs',
    '..AAALAa..',
    '...AAAa...',
    '....Aa....',
  ] },
  cb_fRecover: { sh: [1.5, 1.5], hd: [7, 5], rows: [
    '.LL......',
    'LLAA.....',
    'LAAA.....',
    '.AAA.....',
    '.AAA..SS.',
    '.LAALLSSS',
    '.LAAAAsSs',
    '..Aaa....',
  ] },
  cb_bRecover: { sh: [1.5, 1.5], hd: [8, 4], rows: [
    '.LL.......',
    'LLAA......',
    'AAAA......',
    '.AAA...SS.',
    '..AAALLSSS',
    '..AALAAsSs',
    '...AAaa...',
    '...aa.....',
  ] },
}, {
  cb_stand: { hip: [7, 2], g: 7.0, rows: [
    '..ppp....mll...',
    '..ppq....mlln..',
    '.pppq....mlln..',
    '.pppq....mlln..',
    '.pppq.....mll..',
    '.ppq......mlln.',
    'pppq.......mln.',
    'jjjj.......KKKk',
    'jjjj.......KKKk',
  ] },
  cb_brace: { hip: [9, 2], g: 6.6, rows: [
    '....ppp....mll....',
    '...pppq....mlll...',
    '...pppq....lllll..',
    '...ppqq.....lllln.',
    '..pppq.......lmln.',
    '.pppq.........mln.',
    'jjjj..........KKKk',
    'jjjj..........KKKk',
    'jjjj..........KKKk',
  ] },
  cb_recoil: { hip: [8, 2], g: 6.3, rows: [
    '...ppp....mll.......',
    '...pppq...mlll......',
    '...pppq...lllll.....',
    '...pppp....lllll....',
    '...pppq.....lllll...',
    '.ppppqq......lllll..',
    'jjjjj.........lKKKkk',
    'jjjjj..........KKKkk',
  ] },
  cb_settle: { hip: [8, 2], g: 6.8, rows: [
    '...ppp....mll....',
    '...ppq....mlll...',
    '...ppq....mlll...',
    '...ppq.....llll..',
    '..pppq.....mlll..',
    '.ppppq......mlln.',
    'pppqq........mln.',
    'jjjj.........KKKk',
    'jjjj.........KKKk',
  ] },
  cb_kneel: { hip: [9, 2], g: 4.4, rows: [
    '....ppp....mlllml..',
    '....ppp....mllllln.',
    '....pppq...lllllln.',
    '..pppppq.......mln.',
    'jjjppppq......kKKKk',
    'jjjppppq......kKKKk',
    '..qqqqq............',
  ] },
  cb_kneelBack: { hip: [10, 2], g: 4.6, rows: [
    '.....ppp....mllll...',
    '.....ppq....mlllll..',
    '.....ppq....llllll..',
    '.....ppq......lllln.',
    '.ppppppq........KKKk',
    'jjjppppq........KKKk',
    'jjjqqqpq........KKKk',
  ] },
  cb_half: { hip: [7, 2], g: 5.6, rows: [
    '..ppp....mlll...',
    '..pppp...mllll..',
    '..ppppp..llllll.',
    '...pppp...lllln.',
    '..ppppq.....mln.',
    'jjjjjq......KKKk',
    'jjjjj.......KKKk',
    'jjjjj.......KKKk',
  ] },
});
// ── 컷 레이어 crossbow 끝 ──
