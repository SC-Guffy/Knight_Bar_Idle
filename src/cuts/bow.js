'use strict';
// 평타 컷 (절충안): 활 계열 — 단궁(레인저)·장궁(저격수)·마력궁(마궁수)·태양궁(신궁, 장궁 별칭)·공허궁(차원궁사, 마력궁 별칭).
// 팔·다리 그림은 dev/cuts/bow.py 가 이 파일 끝 'bow' 블록에 굽고, 컷 표는 아래에서 모션 객체(HERO_ATK.bow[n] 등)에 cuts·ready 로 단다 (README '평타 애니메이션 — 컷 방식')
//
// 활은 CUT_WEAPON 으로 팔다리와 같은 1.5px 도트 격자에 찍는다 (원래 drawBow 의 생김새·색: 활대 w.wood, 줌통 가운데가 앞으로 휜 곡선, 시위, 화살 w.arrow.color).
//  앞손(Ly.hand)이 줌통을 쥐고, 뒷손은 늘 뒷팔 그림의 손 자리(어깨 + 그림의 어깨→손)에 있다.
//  컷에 pull 이 있으면(시위를 당기는 컷) 활 기울기는 뒷손 → 앞손 방향, 당김은 두 손 거리 − 줌통 자리로 정해진다 — 시위가 뒷손에 정확히 이어진다.
//  pull 이 없으면 활은 bowA 로 기울고 시위는 곧다. twang: true 면 놓은 직후 시위가 떨린다(겹쳐 그린 흐린 시위).
//  화살: 마력궁처럼 여러 발 쏘는 활(w.shots > 1)은 시위에 화살을 부채꼴로 여러 대 메긴다.
//  컷 원칙: 들어 메기기 → 당기기 → 끝까지 당겨 조준(가장 길게) → 놓기(s = 0.45 가 이 컷 안, 반동으로 몸이 뒤로·활이 들림·망토 날림) → 여운
(() => {
  const C = PX / 2;
  const handOf = (Ly) => [Ly.bs[0] + Ly.ba.vec[0] * C, Ly.bs[1] + Ly.ba.vec[1] * C];
  // 활의 자리: 기울기 a, 줌통 뒤 시위 줄 fh, 당김 pull (px)
  function bowGeom(w, Ly, cut, bh) {
    const h = Ly.hand, gx = w.size * 0.375;
    if (cut.pull && bh) {
      const dx = h[0] - bh[0], dy = h[1] - bh[1], d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      return { a, gx, pull: Math.max(0, d - gx), fh: [h[0] - gx * Math.cos(a), h[1] - gx * Math.sin(a)] };
    }
    const a = cut.bowA || 0;
    return { a, gx, pull: 0, fh: [h[0] - gx * Math.cos(a), h[1] - gx * Math.sin(a)] };
  }
  // 칸 찍기: 손 칸을 원점으로 하는 격자 (팔 그림과 같은 격자)
  const cellPut = (m, O, x, y, col, keep = false) => { const k = Math.round((x - O[0]) / C) + ',' + Math.round((y - O[1]) / C); if (!keep || !m.has(k)) m.set(k, col); };
  // 픽셀 직선: 긴 축으로 한 칸씩 (계단이 두 칸 두께로 뭉치지 않게)
  const cellLine = (m, O, p, q, col) => {
    const i0 = (p[0] - O[0]) / C, j0 = (p[1] - O[1]) / C, i1 = (q[0] - O[0]) / C, j1 = (q[1] - O[1]) / C, n = Math.max(1, Math.round(Math.max(Math.abs(i1 - i0), Math.abs(j1 - j0))));
    for (let k = 0; k <= n; k++) m.set(Math.round(i0 + (i1 - i0) * k / n) + ',' + Math.round(j0 + (j1 - j0) * k / n), col);
  };

  function drawBowCut(g, w, Ly, cut, white, r) {
    const bh = r.bh || null, B = bowGeom(w, Ly, cut, bh), O = Ly.hand;
    const ca = Math.cos(B.a), sa = Math.sin(B.a), R = w.size;
    const W = (u, v) => [B.fh[0] + u * ca - v * sa, B.fh[1] + u * sa + v * ca];
    r.bowA = B.a; r.fh = B.fh; r.pull = B.pull;                  // 놓는 섬광(drawAtkFx)이 이 자리를 쓴다
    const wood = white ? '#ffffff' : w.wood, woodL = white ? '#ffffff' : spriteShadeCol(w.wood, 1), tipC = white ? '#ffffff' : w.glow || spriteShadeCol(w.wood, 1);
    const strC = white ? '#ffffff' : w.glow ? w.glow : '#d9d2c0';
    // 활대: 당길수록 끝이 뒤로 휜다 (줌통 자리는 그대로)
    const flex = Math.min(R * 0.18, B.pull * 0.13), Rv = R - flex * 0.35, ctrl = R * 0.75 + flex;
    const limb = (s) => { const k = (1 - s) * (1 - s) + s * s; return [k * -flex + 2 * s * (1 - s) * ctrl, Rv * (2 * s - 1)]; };
    const m = new Map();
    for (let i = 0; i <= 48; i++) {
      const s = i / 48, [u, v] = limb(s), p = W(u, v);
      cellPut(m, O, p[0], p[1], Math.abs(2 * s - 1) > 0.86 ? tipC : wood);
      if (Math.abs(2 * s - 1) < 0.5) { const q = W(u + C * 0.9, v); cellPut(m, O, q[0], q[1], woodL, true); }
    }
    const tip0 = W(...limb(0)), tip1 = W(...limb(1)), nock = W(-B.pull, 0);
    // 화살 (시위에 메긴 것)
    const arrowOn = B.pull > 0 && cut.arrow !== false;
    if (arrowOn) {
      const n = w.shots > 1 ? w.shots : 1, shaft = white ? '#ffffff' : w.arrow.color, head = white ? '#ffffff' : w.arrow.magic ? '#ffffff' : '#c9d1dd';
      const fl = white ? '#ffffff' : w.arrow.magic ? w.arrow.color : '#c8423a';
      for (let k = 0; k < n; k++) {
        const da = (k - (n - 1) / 2) * 0.14, c2 = Math.cos(B.a + da), s2 = Math.sin(B.a + da);
        const L = B.pull + B.gx + 5 - Math.abs(da) * 10, P = (t, v = 0) => [nock[0] + t * c2 - v * s2, nock[1] + t * s2 + v * c2];
        cellLine(m, O, P(C), P(L), shaft);
        for (const t of [L + C, L + 2 * C]) cellPut(m, O, ...P(t), head);
        cellPut(m, O, ...P(L, -C), head); cellPut(m, O, ...P(L, C), head);
        cellPut(m, O, ...P(C, -C), fl); cellPut(m, O, ...P(C, C), fl); cellPut(m, O, ...P(2 * C, -C), fl);
      }
    }
    if (w.glow && !white) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = w.glow; g.globalAlpha *= 0.28; g.lineWidth = PX * 2; g.lineCap = 'round';
      g.beginPath(); for (let i = 0; i <= 12; i++) { const p = W(...limb(i / 12)); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke(); g.restore();
    }
    // 시위: 외곽선 없이 한 칸 줄. 놓은 직후(twang)엔 앞뒤로 떨린 시위 둘을 활대 밑에 겹친다
    const sm = new Map();
    if (cut.twang) {
      for (const [off, col] of [[C * 1.2, strC], [-C * 1.2, white ? '#ffffff' : 'rgba(255,255,255,0.4)']]) { const mid = W(off, 0); cellLine(sm, O, tip0, mid, col); cellLine(sm, O, mid, tip1, col); }
      drawCellSet(g, sm, O[0], O[1], false);
      drawCellSet(g, m, O[0], O[1], true);
    } else {
      cellLine(sm, O, tip0, nock, strC); cellLine(sm, O, nock, tip1, strC);
      drawCellSet(g, m, O[0], O[1], true);
      drawCellSet(g, sm, O[0], O[1], false);
    }
    if (arrowOn && w.arrow.magic && !white) {                     // 마력 화살: 화살촉이 빛난다
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = w.glow || w.arrow.color; g.globalAlpha *= 0.35;
      const tp = [nock[0] + (B.pull + B.gx + 6) * ca, nock[1] + (B.pull + B.gx + 6) * sa];
      g.beginPath(); g.arc(tp[0], tp[1], 3.5, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }
  // 화살이 나가는 자리(heroMuzzle): 줌통을 쥔 주먹 위 화살 받침 — 놓는 컷이라 활이 조금 들린 자리지만 시위를 떠난 화살이 거기서 날아간다
  const BOW_CUT = { backHand: (w, Ly) => handOf(Ly), draw: drawBowCut, muzzle: (w, Ly) => [Ly.hand[0] + C, Ly.hand[1] - C] };
  for (const id of ['bow', 'longbow', 'arcaneBow', 'sunBow', 'voidBow']) CUT_WEAPON[id] = BOW_CUT;

  // ── 컷 표 ──
  //  fa 앞팔(활) · ba 뒷팔(시위) · legs 다리 · pull: 1 이면 시위를 당긴 컷(당김은 두 손 거리로) · bowA 시위를 놓았을 때 활 기울기 · arrow false 화살 없음
  //  bfront 'over': 시위 당기는 팔을 활 위·몸 앞에 (손이 시위와 화살 끝을 덮는다)
  const READY = { fa: 'bw_fReady', ba: 'bw_bReady', legs: 'bw_stance', bowA: 0.3, arrow: false, dx: 0, skew: 0.03, sy: 1, sx: 0.97, hs: 0, hd: [0, 0], cape: 0.1 };
  // 1 레인저: 가슴 높이로 당겨 쏘기
  const CHEST = [
    { until: 0.1,  fa: 'bw_fLift',   ba: 'bw_bNock',    legs: 'bw_stance', pull: 1, bfront: 'over', dx: 0,  skew: 0,     sy: 1,    sx: 0.92, hs: 0.02,  hd: [0.1, 0.1],   cape: 0.1 },
    { until: 0.24, fa: 'bw_fSet',    ba: 'bw_bFull',    legs: 'bw_stance', pull: 1, bfront: 'over', dx: -1, skew: -0.02, sy: 1.01, sx: 0.91, hs: 0.03,  hd: [0, 0.2],     cape: 0.05 },
    { until: 0.44, fa: 'bw_fAim',    ba: 'bw_bFull',    legs: 'bw_stance', pull: 1, bfront: 'over', dx: -1, skew: -0.06, sy: 1.02, sx: 0.9,  hs: 0.08,  hd: [-0.15, 0.7], cape: 0 },
    { until: 0.56, fa: 'bw_fKick',   ba: 'bw_bRelease', legs: 'bw_recoil', bowA: 0.3, arrow: false, twang: true, dx: -3, skew: -0.12, sy: 1.01, sx: 0.91, hs: -0.06, hd: [-0.25, -0.1], cape: 0.55 },
    { until: 1,    fa: 'bw_fFollow', ba: 'bw_bAfter',   legs: 'bw_stance', bowA: -0.1, arrow: false, dx: -2, skew: -0.05, sy: 1,    sx: 0.92, hs: 0,     hd: [-0.1, 0],    cape: 0.25 },
  ];
  // 2 레인저: 허리춤에서 몸을 숙여 재빨리 쏘기 (예비동작이 짧다)
  const HIP = [
    { until: 0.16, fa: 'bw_fLow',     ba: 'bw_bNockLow',    legs: 'bw_crouch', pull: 1, bfront: 'over', dx: 2, skew: 0.12, sy: 0.95, sx: 0.92, hs: 0.08, hd: [0.2, 0.3],  cape: 0.1 },
    { until: 0.44, fa: 'bw_fLow',     ba: 'bw_bLowFull',    legs: 'bw_crouch', pull: 1, bfront: 'over', dx: 2, skew: 0.14, sy: 0.93, sx: 0.9,  hs: 0.1,  hd: [0.25, 0.4], cape: 0.05 },
    { until: 0.58, fa: 'bw_fLowKick', ba: 'bw_bReleaseLow', legs: 'bw_crouch', bowA: 0.3, arrow: false, twang: true, dx: 0, skew: 0.06, sy: 0.95, sx: 0.92, hs: 0.02, hd: [0.05, 0.2], cape: 0.5 },
    { until: 1,    fa: 'bw_fFollow',  ba: 'bw_bAfter',      legs: 'bw_stance', bowA: 0, arrow: false, dx: 1, skew: 0.05, sy: 0.99, sx: 0.93, hs: 0.02, hd: [0, 0.05], cape: 0.2 },
  ];
  // 3 저격수·신궁: 서서 끝까지(귀까지) 당겨 오래 조준하고, 놓는 순간 큰 반동
  const LONG_STAND = [
    { until: 0.1,  fa: 'bw_fLift',    ba: 'bw_bNock',     legs: 'bw_stance',    pull: 1, bfront: 'over', dx: 0,  skew: 0,     sy: 1.01, sx: 0.92, hs: 0.02,  hd: [0.1, 0.1],   cape: 0.1 },
    { until: 0.22, fa: 'bw_fSet',     ba: 'bw_bFull',     legs: 'bw_stance',    pull: 1, bfront: 'over', dx: -1, skew: -0.03, sy: 1.02, sx: 0.91, hs: 0.03,  hd: [0, 0.2],     cape: 0.05 },
    { until: 0.44, fa: 'bw_fAimLong', ba: 'bw_bFullDeep', legs: 'bw_stance',    pull: 1, bfront: 'over', dx: -2, skew: -0.1,  sy: 1.03, sx: 0.9,  hs: 0.09,  hd: [-0.2, 0.75], cape: 0 },
    { until: 0.56, fa: 'bw_fKick',    ba: 'bw_bFling',    legs: 'bw_recoilBig', bowA: 0.4, arrow: false, twang: true, dx: -6, skew: -0.2, sy: 1, sx: 0.91, hs: -0.1, hd: [-0.4, -0.15], cape: 0.95 },
    { until: 1,    fa: 'bw_fFollow',  ba: 'bw_bAfter',    legs: 'bw_recoil',    bowA: -0.15, arrow: false, dx: -4, skew: -0.08, sy: 1, sx: 0.92, hs: -0.02, hd: [-0.15, 0], cape: 0.4 },
  ];
  // 4 저격수·신궁: 무릎 꿇고 낮게 조준해 쏘기
  const LONG_KNEEL = [
    { until: 0.12, fa: 'bw_fLift',    ba: 'bw_bNock',     legs: 'bw_kneel',     pull: 1, bfront: 'over', dx: 0,  skew: 0.04,  sy: 1,    sx: 0.92, hs: 0.04,  hd: [0.1, 0.15],  cape: 0.05 },
    { until: 0.44, fa: 'bw_fAimLong', ba: 'bw_bFullDeep', legs: 'bw_kneel',     pull: 1, bfront: 'over', dx: -1, skew: -0.04, sy: 1.01, sx: 0.9,  hs: 0.09,  hd: [-0.2, 0.75], cape: 0 },
    { until: 0.56, fa: 'bw_fKick',    ba: 'bw_bFling',    legs: 'bw_kneelBack', bowA: 0.35, arrow: false, twang: true, dx: -5, skew: -0.16, sy: 1, sx: 0.91, hs: -0.08, hd: [-0.35, -0.1], cape: 0.8 },
    { until: 0.76, fa: 'bw_fFollow',  ba: 'bw_bAfter',    legs: 'bw_kneelBack', bowA: -0.15, arrow: false, dx: -4, skew: -0.08, sy: 1, sx: 0.92, hs: 0, hd: [-0.15, 0.05], cape: 0.35 },
    { until: 1,    fa: 'bw_fFollow',  ba: 'bw_bAfter',    legs: 'bw_crouch',    bowA: 0, arrow: false, dx: -2, skew: 0.02, sy: 0.98, sx: 0.93, hs: 0, hd: [0, 0.05], cape: 0.2 },
  ];
  // 5 마궁수·차원궁사: 떠오르며 시위에 마력을 모아 여러 발
  const ARC_FLOAT = [
    { until: 0.12, fa: 'bw_fLift',   ba: 'bw_bNock',    legs: 'bw_float', pull: 1, bfront: 'over', lift: 1, dx: 0,  skew: -0.02, sy: 1.02, sx: 0.92, hs: 0.02,  hd: [0.1, 0.1],   cape: 0.15 },
    { until: 0.26, fa: 'bw_fSet',    ba: 'bw_bFull',    legs: 'bw_float', pull: 1, bfront: 'over', lift: 2, dx: -1, skew: -0.04, sy: 1.03, sx: 0.91, hs: 0.03,  hd: [0, 0.2],     cape: 0.2 },
    { until: 0.44, fa: 'bw_fAim',    ba: 'bw_bFull',    legs: 'bw_float', pull: 1, bfront: 'over', lift: 3, dx: -1, skew: -0.08, sy: 1.04, sx: 0.9,  hs: 0.08,  hd: [-0.15, 0.7], cape: 0.25 },
    { until: 0.56, fa: 'bw_fKick',   ba: 'bw_bRelease', legs: 'bw_float', bowA: 0.3, arrow: false, twang: true, lift: 3, dx: -3, skew: -0.14, sy: 1.02, sx: 0.91, hs: -0.06, hd: [-0.25, -0.1], cape: 0.7 },
    { until: 1,    fa: 'bw_fFollow', ba: 'bw_bAfter',   legs: 'bw_float', bowA: -0.1, arrow: false, lift: 1, dx: -2, skew: -0.05, sy: 1.01, sx: 0.92, hs: 0, hd: [-0.1, 0], cape: 0.35 },
  ];
  // 6 마궁수·차원궁사: 활을 비스듬히 위로 치켜들어 쏘기
  const ARC_HIGH = [
    { until: 0.12, fa: 'bw_fLift',     ba: 'bw_bNock',     legs: 'bw_stance', pull: 1, bfront: 'over', lift: 1, dx: 0,  skew: -0.03, sy: 1.03, sx: 0.92, hs: -0.02, hd: [0.05, 0],    cape: 0.15 },
    { until: 0.44, fa: 'bw_fHigh',     ba: 'bw_bFull',     legs: 'bw_stance', pull: 1, bfront: 'over', lift: 2, dx: -1, skew: -0.12, sy: 1.06, sx: 0.9,  hs: -0.06, hd: [-0.15, 0.55], cape: 0.15 },
    { until: 0.56, fa: 'bw_fHighKick', ba: 'bw_bRelease',  legs: 'bw_recoil', bowA: -0.25, arrow: false, twang: true, lift: 2, dx: -4, skew: -0.18, sy: 1.04, sx: 0.91, hs: -0.12, hd: [-0.3, -0.2], cape: 0.75 },
    { until: 0.76, fa: 'bw_fKick',     ba: 'bw_bAfter',    legs: 'bw_recoil', bowA: -0.3, arrow: false, lift: 1, dx: -3, skew: -0.1, sy: 1.02, sx: 0.92, hs: -0.04, hd: [-0.15, -0.05], cape: 0.4 },
    { until: 1,    fa: 'bw_fFollow',   ba: 'bw_bAfter',    legs: 'bw_stance', bowA: -0.1, arrow: false, dx: -1, skew: -0.03, sy: 1, sx: 0.93, hs: 0, hd: [0, 0], cape: 0.2 },
  ];
  const set = (mo, cuts, ready) => { if (mo) { mo.cuts = cuts; mo.ready = ready; } };
  set(HERO_ATK.bow[0], CHEST, READY);
  set(HERO_ATK.bow[1], HIP, READY);
  set(HERO_ATK.longbow[0], LONG_STAND, READY);            // sunBow 은 longbow 배열을 함께 쓴다
  set(HERO_ATK.longbow[1], LONG_KNEEL, READY);
  const ARC_READY = { ...READY, legs: 'bw_float', cape: 0.2 };          // 마궁수·차원궁사는 몸 그림의 hover 만큼 늘 떠 있다(엔진)
  set(HERO_ATK.arcaneBow[0], ARC_FLOAT, ARC_READY);         // voidBow 는 arcaneBow 배열을 함께 쓴다
  set(HERO_ATK.arcaneBow[1], ARC_HIGH, ARC_READY);
})();

// ── 컷 레이어 bow (자동 생성: dev/cutgen.py — 손으로 고칠 칸은 생성기의 FIX 에) ──
addCutSprites({
  bw_fReady: { sh: [0.5, 0.5], hd: [4, 9], rows: [
    'LA....',
    'AAa...',
    'AAA...',
    'AAA...',
    'LAA...',
    'LAA...',
    '.AAA..',
    '.AAA..',
    '..ASS.',
    '...SSS',
    '...sSs',
  ] },
  bw_fLift: { sh: [0.5, 0.5], hd: [9, 2], rows: [
    'LAA........',
    'AAAA...LSS.',
    'AAAAALLASSS',
    '..AAAAAasSs',
    '...AAa.....',
  ] },
  bw_fSet: { sh: [0.5, 0.5], hd: [9, 1], rows: [
    'LALLL..LSS.',
    'AAAAALAASSS',
    '.aaaAaaasSs',
  ] },
  bw_fAim: { sh: [0.5, 1.5], hd: [10, 1], rows: [
    '.........SS.',
    'LALLLLLLLSSS',
    'AAAAAAAAasSs',
    '.aaaaa......',
  ] },
  bw_fAimLong: { sh: [0.5, 1.5], hd: [11, 1], rows: [
    '.L........SS.',
    'LALLLLLLAASSS',
    'AAAAAAAAaasSs',
    '.aaaaa.......',
  ] },
  bw_fKick: { sh: [0.5, 3.5], hd: [9, 1], rows: [
    '........SS.',
    '.......LSSS',
    '.LLLLLLAsSs',
    'LAAAAAAaa..',
    'AAaaaa.....',
  ] },
  bw_fFollow: { sh: [0.5, 0.5], hd: [9, 2], rows: [
    'LALL.......',
    'AAAAALLLSSA',
    '.aaAAAAASSS',
    '........sSs',
  ] },
  bw_fLow: { sh: [0.5, 0.5], hd: [8, 5], rows: [
    'LAA.......',
    'AAA.......',
    'AAAA......',
    '.AAAA.....',
    '..AAALLSS.',
    '...AAAASSS',
    '......asSs',
  ] },
  bw_fLowKick: { sh: [0.5, 0.5], hd: [9, 3], rows: [
    'LAA........',
    'AAAA.......',
    'AAAAA.LLSS.',
    '..AAAAAASSS',
    '...AAaaasSs',
  ] },
  bw_fHigh: { sh: [0.5, 4.5], hd: [8, 1], rows: [
    '.......SS.',
    '......LSSS',
    '....LLAsSs',
    '.LLLAAaa..',
    'LAAAaa....',
    'Aaaa......',
  ] },
  bw_fHighKick: { sh: [0.5, 5.5], hd: [7, 1], rows: [
    '......SSA',
    '.....LSSS',
    '....LAsSs',
    '...LAAa..',
    '.LLAAa...',
    'LAAa.....',
    'Aaa......',
  ] },
  bw_bReady: { sh: [1.5, 0.5], hd: [2, 11], rows: [
    '.LA.',
    'LAA.',
    'LAA.',
    'LAA.',
    'LAa.',
    'LAa.',
    'AAA.',
    'LAA.',
    '.AA.',
    '.AA.',
    '.SSS',
    '.SSS',
    '.sSs',
  ] },
  bw_bNock: { sh: [0.5, 0.5], hd: [9, 1], rows: [
    'LALL....SS.',
    'AAAALLLLSSS',
    '.aAAAAAAsSs',
    '...aaaa....',
  ] },
  bw_bFull: { sh: [5.5, 1.5], hd: [7, 2], rows: [
    'LLLLLL...',
    'AAAAAASS.',
    '..aaAASSS',
    '......sSs',
  ] },
  bw_bFullDeep: { sh: [5.5, 1.5], hd: [6, 2], rows: [
    'LALLLL..',
    'AAAAASS.',
    '..aaaSSS',
    '.....sSs',
  ] },
  bw_bRelease: { sh: [9.5, 1.5], hd: [1, 3], rows: [
    '....LLLLLL.',
    '..LLAAAAAAA',
    '.SAAaaaaAAa',
    'SSSa.......',
    '.s.........',
  ] },
  bw_bFling: { sh: [10.5, 2.5], hd: [1, 2], rows: [
    '.....LL.....',
    '.SLAAAAALLL.',
    'SSSaaaaAAAAA',
    '.s......aaAa',
  ] },
  bw_bAfter: { sh: [5.5, 0.5], hd: [1, 8], rows: [
    '....LLA',
    '...LLAa',
    '..LAAaa',
    '.LAAa..',
    '.LAa...',
    '.LA....',
    '.Aa....',
    '.Sa....',
    'SSS....',
    '.s.....',
  ] },
  bw_bNockLow: { sh: [0.5, 0.5], hd: [9, 5], rows: [
    'LA.........',
    'AAA........',
    'AAAA.......',
    '.AAA.......',
    '.AAALLLLSS.',
    '..AAAAAASSS',
    '...aaaaasSs',
  ] },
  bw_bLowFull: { sh: [2.5, 0.5], hd: [6, 5], rows: [
    '..LA....',
    '.LAa....',
    'LAAa....',
    'LAa.....',
    'AAAALSS.',
    'aaaAASSS',
    '.....sSs',
  ] },
  bw_bReleaseLow: { sh: [8.5, 0.5], hd: [1, 6], rows: [
    '.......LLA',
    '......LAAa',
    '....LLAAa.',
    '...LAAaa..',
    '..LAaa....',
    '.SAa......',
    'SSS.......',
    '.s........',
  ] },
}, {
  bw_stance: { hip: [8, 2], g: 7.0, rows: [
    '...ppp....mll....',
    '..pppq....mlln...',
    '..pppq....mlln...',
    '..pppq....mlll...',
    '..ppq......mlln..',
    '.pppq......mlln..',
    '.ppq........mln..',
    'jjjjj.......KKKkk',
    'jjjjj.......KKKkk',
  ] },
  bw_recoil: { hip: [8, 2], g: 6.8, rows: [
    '...ppp....mll.....',
    '...ppq....mlln....',
    '...pppq...mlll....',
    '...pppq....llln...',
    '...pppq....mlll...',
    '..pppq......mlln..',
    '.pppq........lll..',
    'jjjjj........KKKkk',
    'jjjjj........KKKkk',
  ] },
  bw_recoilBig: { hip: [8, 2], g: 6.5, rows: [
    '...ppp....mll......',
    '...pppq...mlll.....',
    '...pppq...lllll....',
    '...pppq....lllll...',
    '..ppppq.....llll...',
    '.ppppqq......llll..',
    'jjjjq.........lKKkk',
    'jjjj...........KKkk',
    'jjjj...........KKkk',
  ] },
  bw_crouch: { hip: [7, 2], g: 6.0, rows: [
    '..ppp....mll....',
    '..pppp...mllll..',
    '..pppp...llllll.',
    '...pppp...lllll.',
    '..ppppq.....mln.',
    '.ppppq......mln.',
    'jjjjj......kKKKk',
    'jjjjj......kKKKk',
  ] },
  bw_kneel: { hip: [9, 2], g: 4.4, rows: [
    '....ppp....mlllml..',
    '....ppp....mllllln.',
    '....pppq...lllllln.',
    '..pppppq.......mln.',
    'jjjppppq......kKKKk',
    'jjjppppq......kKKKk',
    '..qqqqq............',
  ] },
  bw_kneelBack: { hip: [10, 2], g: 4.6, rows: [
    '.....ppp....mllll...',
    '.....ppq....mlllll..',
    '.....ppq....llllll..',
    '.....ppq......lllln.',
    '.ppppppq........KKKk',
    'jjjppppq........KKKk',
    'jjjqqqpq........KKKk',
  ] },
  bw_float: { hip: [7, 2], g: 7.2, rows: [
    '..ppp....mll..',
    '..ppq....mll..',
    '..pppq...mlln.',
    '..pppq...mlln.',
    '..pppq...mmln.',
    'ppppqq....mln.',
    'jjjq......mln.',
    'jjj......kKKKk',
    '.........kKKKk',
  ] },
});
// ── 컷 레이어 bow 끝 ──

// 차원궁(차원궁사)은 마력궁 연속기와 컷을 그대로 쓰되, 마력이 모이고 터지는 색만 공허궁 빛(보라)으로 — legacy.js 에선 같은 배열을 공유하는 별칭이었다
HERO_ATK.voidBow = HERO_ATK.arcaneBow.map((mo) => ({
  ...mo,
  ...(mo.charge ? { charge: [mo.charge[0], mo.charge[1], '255,77,255'] } : {}),
  ...(mo.burst ? { burst: [mo.burst[0], '255,150,255', mo.burst[2]] } : {}),
}));
