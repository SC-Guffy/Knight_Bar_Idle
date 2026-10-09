'use strict';
// 평타 컷 (절충안): 대검 계열 (대검 · 파천대검 — 대검전사·파천검왕). README '평타 애니메이션 — 컷 방식'
//  팔·다리 그림은 dev/cuts/greatsword.py 가 이 파일 끝 블록(gs_*)에 굽고, 컷 표는 이 파일이 모션 객체에 단다 (mo.cuts / mo.ready)
//  대검은 몸집만한 판때기(slab) — 쉴 땐 한 손으로 어깨에 걸치고(가츠), 휘두를 땐 두 손으로 자루를 쥔다.
//  뒷손은 자루 아래(폼멜 쪽)를 쥔다: bgrip = 앞손에서 자루 뒤로 칸. bgrip: 0 이면 뒷손을 놓는다(어깨에 걸친 대기)
//  smear: true 내려찍기(칼이 지나온 호) · 'flat' 수평 휩쓸기(허리 높이 납작한 타원 띠 — 칼끝이 몸 앞쪽으로 돌아 나온다)
(() => {
  const C = PX / 2;
  const GRIP = 7, BGRIP = 4.4;                 // 자루 길이·뒷손 기본 자리 (칸)

  // ── 대검 도트: 손 칸을 가운데로, 칼 방향 u·옆 v(+ 는 날 쪽, 수평일 때 아래) 로 칸을 채운다 ──
  function slabCells(w, ang, len, white) {
    const cs = Math.cos(ang), sn = Math.sin(ang), L = len * 2, hw = 2.6;
    const sh = (c, d) => (white ? '#ffffff' : spriteShadeCol(c, d));
    const bladeC = white ? '#ffffff' : w.blade, backC = sh(w.blade, 1), darkC = sh(w.blade, -1), edgeC = white ? '#ffffff' : w.edge || '#9aa0ac';
    const hiltC = white ? '#ffffff' : w.hilt, gripC = white ? '#ffffff' : '#2a2018', wrapC = white ? '#ffffff' : '#4a3a30';
    const cells = new Map(), R = Math.ceil(L + 4);
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      const u = i * cs + j * sn, v = -i * sn + j * cs;
      let col = null;
      if (u >= -GRIP - 1.6 && u < -GRIP && Math.abs(v) <= 1.4) col = hiltC;                         // 폼멜
      else if (u >= -GRIP && u < 0.4 && Math.abs(v) <= 0.9) col = Math.floor(-u / 1.6) % 2 ? wrapC : gripC;   // 가죽 감은 긴 자루
      else if (u >= 0.4 && u < 2.0 && Math.abs(v) <= 4.2) col = hiltC;                              // 날밑
      else if (u >= 2.0 && u <= L + 2) {
        const back = u > L - 3 ? -hw + (u - (L - 3)) * 1.25 : -hw;                                 // 칼끝: 등 쪽이 비스듬히 깎인다
        const edge = u > L ? hw - (u - L) * 1.4 : hw;
        if (v >= back - 0.01 && v <= edge + 0.01) {
          col = v > edge - 1.05 ? edgeC : v < back + 1.05 ? backC : bladeC;
          if (col === bladeC && (Math.abs(u - 7) < 0.5 || Math.abs(u - 15) < 0.5) && Math.abs(v) < hw - 1.5) col = darkC;   // 긁힌 자국
          if (col === bladeC && Math.abs(v + 0.3) < 0.5 && u > 3 && u < L - 4) col = darkC;          // 가운데 홈
        }
      }
      if (col) cells.set(i + ',' + j, col);
    }
    return cells;
  }
  function drawSlabCells(g, w, h, ang, len, white) {
    const cs = Math.cos(ang), sn = Math.sin(ang), L = len * 2;
    if (w.glow && !white) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = w.glow; g.globalAlpha *= 0.16; g.lineWidth = PX * 3.6; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(h[0] + cs * 3 * C, h[1] + sn * 3 * C); g.lineTo(h[0] + cs * (L - 1) * C, h[1] + sn * (L - 1) * C); g.stroke(); g.restore();
    }
    drawCellSet(g, slabCells(w, ang, len, white), h[0], h[1], true);
  }
  // 칼이 지나온 자리 (칸): 넓은 판때기라 띠가 두껍다 — 새 쪽 절반은 흰색, 옛 쪽은 잔상 색으로 옅어진다
  function slabSmear(g, w, h0, a0, h1, a1, len) {
    const L = len * 2, age = new Map(), t0 = 0.55, uMin = L * 0.55;
    const span = Math.abs(a1 - a0) * (L + 2) + Math.hypot(h1[0] - h0[0], h1[1] - h0[1]) / C, N = Math.max(14, Math.ceil(span * 2.5));
    for (let s = 0; s <= N; s++) {
      const t = t0 + (1 - t0) * s / N, hx = h0[0] + (h1[0] - h0[0]) * t, hy = h0[1] + (h1[1] - h0[1]) * t, a = a0 + (a1 - a0) * t, tt = (t - t0) / (1 - t0);
      for (let u = uMin; u <= L + 2; u += 0.4) {
        const k = Math.round((hx + Math.cos(a) * u * C - h1[0]) / C) + ',' + Math.round((hy + Math.sin(a) * u * C - h1[1]) / C);
        if (!age.has(k) || age.get(k) < tt) age.set(k, tt);
      }
    }
    smearPaint(g, w, age, h1);
  }
  // 수평 휩쓸기: 칼끝이 허리 높이에서 몸 뒤 → 몸 앞(보는 쪽) → 앞으로 돈다. 위에서 살짝 내려다본 납작한 타원 띠
  function flatSmear(g, w, L0, Ly, len) {
    const age = new Map(), cx = Ly.x, cy = Ly.hand[1] - 0.5 * C;
    const Ro = (Ly.hand[0] - cx) / C + len * 2 + 2, Ri = Ro * 0.4, k = 0.3, N = 90;
    for (let s = 0; s <= N; s++) {
      const t = s / N, th = Math.PI * 0.8 * (1 - t);              // 몸 옆(뒤쪽) → 몸 앞을 돌아 → 앞
      for (let r = Ri; r <= Ro; r += 0.45) {
        const x = cx + Math.cos(th) * r * C, y = cy + Math.sin(th) * r * k * C;
        const key = Math.round((x - Ly.hand[0]) / C) + ',' + Math.round((y - Ly.hand[1]) / C);
        if (!age.has(key) || age.get(key) < t) age.set(key, t);
      }
    }
    smearPaint(g, w, age, Ly.hand);
  }
  function smearPaint(g, w, age, h) {
    const cells = new Map(), rgb = w.trail || '255,255,255';
    for (const [k, t] of age) cells.set(k, t > 0.7 ? 'rgba(255,255,255,0.8)' : `rgba(${rgb},${(0.1 + 0.45 * t / 0.7).toFixed(2)})`);
    drawCellSet(g, cells, h[0], h[1], false);
  }

  // 칼이 머리 뒤로 지나가는 컷(어깨에 걸침·머리 뒤로 넘김)은 wlayer: 'head' — 엔진이 칼을 머리보다 먼저 그린다

  const GS_DEF = {
    // 뒷손: 자루 아래를 쥔다 (bgrip 칸, 기본 BGRIP). bgrip: 0 이면 놓는다
    backHand(w, Ly, cut, r) {
      const b = cut.bgrip != null ? cut.bgrip : BGRIP;
      if (!b) return null;
      return [Ly.hand[0] - Math.cos(r.wa) * b * C, Ly.hand[1] - Math.sin(r.wa) * b * C];
    },
    draw(g, w, Ly, cut, white, r) {
      drawSlabCells(g, w, Ly.hand, r.wa, w.len * (r.stretch > 1 ? 1.05 : 1), white);
    },
    reach: (w) => w.len + 1,
    smear(g, w, L0, Ly, cut) {
      if (cut.smear === 'flat') flatSmear(g, w, L0, Ly, w.len);
      else slabSmear(g, w, L0.hand, L0.wa, Ly.hand, Ly.wa, w.len);
    },
  };
  CUT_WEAPON.greatsword = GS_DEF;
  CUT_WEAPON.doomBlade = GS_DEF;

  // ── 컷 표 ──
  // 대기: 대검을 한 손으로 어깨에 걸치고 넓게 버틴다 (뒷손은 허리 옆에 늘어뜨림)
  const READY = { fa: 'gs_rest', ba: 'gsb_free', bgrip: 0, legs: 'gs_set', wa: -2.35, dx: 0, skew: 0.03, sy: 1, sx: 1, hs: 0.02, hd: [0, 0], cape: 0.12, wlayer: 'head' };
  const RECOVER = { fa: 'gs_recover', ba: 'gsb_recover', bfront: 'body', bgrip: 3.2, legs: 'gs_rise', wa: -2.2, dx: 3, skew: 0.06, sy: 0.98, sx: 0.93, hs: 0.04, hd: [0.1, 0.1], cape: 0.35, wlayer: 'head' };
  // 1 내려찍기: 어깨에서 들어 머리 뒤까지 넘겨(뒷발에 무게, 몸을 젖힘) → 앞발을 크게 내디디며 온몸으로 내리찍고 무릎이 꺾여 가라앉는다 (칼끝이 땅을 때린다)
  const CHOP = [
    { until: 0.1,  fa: 'gs_raise',  ba: 'gsb_raise',  bfront: 'body', legs: 'gs_set',  wa: -2.05, dx: -1, skew: -0.05, sy: 1.02, sx: 0.93, hs: -0.04, hd: [-0.1, -0.1],  cape: 0.15, wlayer: 'head' },
    { until: 0.3,  fa: 'gs_windup', ba: 'gsb_windup', bgrip: 3.4,     legs: 'gs_load', wa: -3.55, dx: -4, skew: -0.22, sy: 1.05, sx: 0.9,  hs: -0.12, hd: [-0.4, -0.3],  cape: -0.05, wlayer: 'head' },
    { until: 0.46, fa: 'gs_chop',   ba: 'gsb_chop',   bfront: 'body', legs: 'gs_slam', wa: 0.3,   dx: 6,  skew: 0.36,  sy: 0.9,  sx: 0.94, hs: 0.2,   hd: [0.5, 0.7],    cape: 1.0, smear: true },
    { until: 0.7,  fa: 'gs_dig',    ba: 'gsb_dig',    bfront: 'body', legs: 'gs_slam', wa: 0.4,   dx: 6,  skew: 0.3,   sy: 0.9,  sx: 0.94, hs: 0.16,  hd: [0.4, 0.6],    cape: 0.75 },
    { until: 1, ...RECOVER },
  ];
  // 2 수평 휩쓸기: 허리를 비틀어 대검을 뒷허리로 끌어가(등이 보인다) → 몸을 풀며 허리 높이로 크게 휩쓴다(넓고 낮은 런지)
  const SWEEP = [
    { until: 0.1,  fa: 'gs_coilA',  ba: 'gsb_coilA',  legs: 'gs_load',  wa: -2.75, dx: -2, skew: -0.08, sy: 0.98, sx: 0.9,  hs: -0.03, hd: [-0.2, 0],     cape: 0.12, wlayer: 'head' },
    { until: 0.3,  fa: 'gs_coil',   ba: 'gsb_coil',   legs: 'gs_coil',  wa: -3.18, dx: -4, skew: -0.14, sy: 0.95, sx: 0.84, hs: -0.06, hd: [-0.35, 0.1],  cape: 0.0 },
    { until: 0.46, fa: 'gs_sweep',  ba: 'gsb_sweep',  bfront: 'body', legs: 'gs_sweep', wa: 0.06,  dx: 7,  skew: 0.3,   sy: 0.92, sx: 0.94, hs: 0.06,  hd: [0.4, 0.3],    cape: 1.0, smear: 'flat' },
    { until: 0.7,  fa: 'gs_sweepF', ba: 'gsb_sweepF', bfront: 'body', legs: 'gs_sweep', wa: 0.22,  dx: 7,  skew: 0.26,  sy: 0.93, sx: 0.94, hs: 0.1,   hd: [0.3, 0.4],    cape: 0.8 },
    { until: 1, ...RECOVER },
  ];
  const list = HERO_ATK.greatsword;          // doomBlade 는 같은 배열(별칭)
  Object.assign(list[0], { cuts: CHOP, ready: READY });
  Object.assign(list[1], { cuts: SWEEP, ready: READY });

  // 개발용: 컷마다 뒷어깨 → 뒷손(칸) — dev/cuts/greatsword.py 의 뒷팔(gsb_*) 손 자리에 넣는다
  window.gsMeasure = (id = 'greatswordsman') => {
    const w = WEAPONS[CLASSES[id].weapon], out = {};
    for (const [n, mo] of HERO_ATK[w.id].entries()) [mo.ready, ...mo.cuts].forEach((cut, i) => {
      const Ly = cutLayout(w, 0, 0, {}, cut), r = cutRig(w, Ly, cut), bh = GS_DEF.backHand(w, Ly, cut, r);
      out[`${n}-${i} ${cut.ba}`] = bh ? [+((bh[0] - Ly.bs[0]) / C).toFixed(1), +((bh[1] - Ly.bs[1]) / C).toFixed(1)] : null;
    });
    return out;
  };
})();

// ── 컷 레이어 greatsword (자동 생성: dev/cutgen.py — 손으로 고칠 칸은 생성기의 FIX 에) ──
addCutSprites({
  gs_rest: { sh: [1.5, 1.5], hd: [5, 4], rows: [
    '.LL....',
    'LLAA...',
    'LAAa...',
    'LAAaSS.',
    'LAALSSS',
    'LAAAsSs',
    'LAAaa..',
    'LAaa...',
    '.a.....',
  ] },
  gs_raise: { sh: [1.5, 1.5], hd: [4, 1], rows: [
    '.LLSS..',
    'LLASSS.',
    'AAAsSs.',
    '.AAAAA.',
    '..AAAA.',
    '...AAA.',
    '...AAAa',
    '....aa.',
  ] },
  gs_windup: { sh: [2.5, 8.5], hd: [1, 1], rows: [
    'SS.....',
    'SSSL...',
    'sSsAA..',
    '..AAAAA',
    '...aLAa',
    '...LAAa',
    '...LAa.',
    '..LAAa.',
    '.LLAa..',
    '.AAaa..',
    '..aa...',
  ] },
  gs_chop: { sh: [1.5, 1.5], hd: [10, 7], rows: [
    '.LL.........',
    'LLAA........',
    'AAAAA.......',
    '.AAAA.......',
    '..AAAA......',
    '...AAALLL...',
    '....AAAAASS.',
    '.....aaaaSSS',
    '.........sSs',
  ] },
  gs_dig: { sh: [1.5, 1.5], hd: [9, 9], rows: [
    '.LL........',
    'LLAA.......',
    'AAAA.......',
    '.AAAA......',
    '..AAAA.....',
    '..AAAA.....',
    '...AAAAL...',
    '....AAAAL..',
    '......AASSA',
    '........SSS',
    '........sSs',
  ] },
  gs_recover: { sh: [1.5, 1.5], hd: [5, 4], rows: [
    '.LL....',
    'LLAA...',
    'LAAa...',
    'LAA.SS.',
    'LAALSSS',
    'LALAsSs',
    'LAAa...',
    'AAa....',
    'aa.....',
  ] },
  gs_coilA: { sh: [6.5, 1.5], hd: [4, 6], rows: [
    '....LLLL.',
    'LLLLLAAAA',
    'AAAAAAAaa',
    '.AAAaaaa.',
    '..AAA....',
    '..ASS....',
    '...SSS...',
    '...sSs...',
  ] },
  gs_coil: { sh: [6.5, 1.5], hd: [1, 7], rows: [
    '...LLLLL.',
    'LLAAAAAAA',
    'LAAAAAAaa',
    'LAaaaaaa.',
    'LAa......',
    'LA.......',
    'SS.......',
    'SSS......',
    'sSs......',
  ] },
  gs_sweep: { sh: [1.5, 1.5], hd: [11, 6], rows: [
    '.LL..........',
    'LLAA.........',
    'AAAAA........',
    '.AAAAA.......',
    '..AAAAA......',
    '....AAAALLSS.',
    '.....AAAAASSS',
    '........aasSs',
  ] },
  gs_sweepF: { sh: [1.5, 1.5], hd: [9, 8], rows: [
    '.LL........',
    'LLAA.......',
    'AAAA.......',
    '.AAAA......',
    '..AAA......',
    '..AAAA.....',
    '...AAAAL...',
    '....aAAASS.',
    '......aASSS',
    '........sSs',
  ] },
  gsb_free: { sh: [2.5, 1.5], hd: [1, 11], rows: [
    '..LL.',
    '.LLAA',
    '.LAAa',
    '.LAa.',
    'LAAa.',
    'LAa..',
    'LAa..',
    'AAa..',
    'AAa..',
    'LAA..',
    'SSS..',
    'SSS..',
    'sSs..',
  ] },
  gsb_raise: { sh: [1.5, 1.5], hd: [11, 4], rows: [
    '.LL..........',
    'LLAL.........',
    'AAAAAL.......',
    '.aAAAAALLLSS.',
    '...aAAAAAASSS',
    '.....aaaaasSs',
  ] },
  gsb_windup: { sh: [1.5, 10.5], hd: [8, 1], rows: [
    '.......SSA',
    '.......SSS',
    '.......sSs',
    '.......AA.',
    '......LAa.',
    '......LAa.',
    '.....LAA..',
    '....LAAa..',
    '...LAAa...',
    '.LLAAa....',
    'LLAaa.....',
    'AAaa......',
    '.aa.......',
  ] },
  gsb_chop: { sh: [1.5, 1.5], hd: [11, 5], rows: [
    '.LL..........',
    'LLAL.........',
    'AAAAA........',
    '.aAAAAL......',
    '...AAAALLLSS.',
    '.....AAAAASSS',
    '..........sSs',
  ] },
  gsb_dig: { sh: [1.5, 1.5], hd: [10, 7], rows: [
    '.LL.........',
    'LLAA........',
    'AAAAA.......',
    '.AAAA.......',
    '..AAAA......',
    '...AAALLL...',
    '....AAAAASSA',
    '.......aaSSS',
    '.........sSs',
  ] },
  gsb_recover: { sh: [1.5, 1.5], hd: [12, 6], rows: [
    '.LL...........',
    'LLAA..........',
    'AAAAA.........',
    '.AAAAAL.......',
    '...AAAALL.....',
    '....AAAAAALSS.',
    '......aaaAASSS',
    '...........sSs',
  ] },
  gsb_coilA: { sh: [1.5, 1.5], hd: [8, 7], rows: [
    '.LL.......',
    'LLAA......',
    'AAAA......',
    '.AAA......',
    '.AAA......',
    '..AAA.....',
    '..AALLLSS.',
    '...AAAASSS',
    '.......sSs',
  ] },
  gsb_coil: { sh: [1.5, 1.5], hd: [8, 6], rows: [
    '.LL.......',
    'LLAA......',
    'AAAA......',
    '.AAA......',
    '.AAA......',
    '..AA...SS.',
    '..AALLLSSS',
    '..AAAAAsSs',
    '...a......',
  ] },
  gsb_sweep: { sh: [1.5, 1.5], hd: [12, 5], rows: [
    '.LL...........',
    'LLAL..........',
    'AAAAAL........',
    '.aAAAAL.......',
    '...AAAALLLLSS.',
    '.....AAAAAASSS',
    '...........sSs',
  ] },
  gsb_sweepF: { sh: [1.5, 1.5], hd: [10, 6], rows: [
    '.LL.........',
    'LLAA........',
    'AAAA........',
    '.AAAA.......',
    '..AAAA......',
    '...AAALLLSS.',
    '....AAAAASSS',
    '.....aaaasSs',
  ] },
}, {
  gs_set: { hip: [8, 2], g: 7.0, rows: [
    '...ppp....mll....',
    '..pppq....mlln...',
    '..pppq....mlll...',
    '..ppqq....mllln..',
    '.pppq......mlln..',
    '.pppq.......mll..',
    'pppq........mll..',
    'jjjj........KKKkk',
    'jjjj........KKKkk',
  ] },
  gs_load: { hip: [8, 2], g: 6.3, rows: [
    '...ppp....mll......',
    '...pppq...mlll.....',
    '...pppp...lllll....',
    '....pppq...lllln...',
    '...ppppq....lllln..',
    '.pppppq......mlll..',
    'jjjjjq........KKKkk',
    'jjjjj.........KKKkk',
  ] },
  gs_slam: { hip: [11, 2], g: 4.6, rows: [
    '......ppp....mllllm....',
    '.....pppq....mlllllln..',
    '.....pppq....llllllln..',
    '...pppppq......lllmln..',
    'jjjjjppq..........KKKkk',
    'jjjjjppq..........KKKkk',
    'jjjjjqq...........KKKkk',
  ] },
  gs_coil: { hip: [7, 2], g: 6.0, rows: [
    '..ppp....mll......',
    '..pppp...mllll....',
    '..ppppp..llllll...',
    '...pppp...lllll...',
    '..ppppq.....llln..',
    '.ppppqq......lln..',
    'jjjjj........KKKkk',
    'jjjjj........KKKkk',
  ] },
  gs_sweep: { hip: [12, 2], g: 5.2, rows: [
    '.......ppp....mlll.....',
    '.....ppppq....mllllll..',
    '....ppppqq....lllllll..',
    '...ppppqq......lllllln.',
    '.pppppq...........mlln.',
    'jjjjjq.............KKKk',
    'jjjjj..............KKKk',
  ] },
  gs_rise: { hip: [8, 2], g: 6.6, rows: [
    '...ppp....mll....',
    '...ppq....mlll...',
    '..pppq....llll...',
    '..pppq.....llll..',
    '..pppq.....mlln..',
    '.pppq.......mll..',
    'jjjjj.......KKKkk',
    'jjjjj.......KKKkk',
    'jjjjj.......KKKkk',
  ] },
});
// ── 컷 레이어 greatsword 끝 ──
