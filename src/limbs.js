'use strict';
// 손으로 찍은 팔 스프라이트 (2026-10). 팔을 코드 선으로 긋지 않고, 자세별로 그려 둔 팔 그림 중 가장 가까운 것을 골라 어깨에 붙인다.
//  글자: L 윗면(밝음) · A 팔 · a 아랫면(어두움) · S 손(장갑) · s 손 아랫면. 외곽선은 자동(outline). 칸은 몸통과 같은 1.5px (PX/2)
//  sh: 어깨 칸 [x, y] · hd: 손 칸 [x, y] — 뼈대가 바라는 손 위치(어깨 기준 벡터)에 가장 가까운 자세를 고르고, 무기는 그 그림의 손에 붙인다 (world.js armSpriteFor)
//  모든 자세는 오른쪽을 보는 기준. 왼팔(뒷팔)은 같은 그림을 한 단계 어둡게 쓴다
const ARM_POSES = [
  // 늘어뜨림: 윗팔이 곧게 내려오고 아랫팔이 앞으로 살짝 (검을 허리 앞에 쥔 쉬는 자세)
  { name: 'hang', sh: [2, 1], hd: [5, 9.5], rows: [
    '.LLL...',
    '.LAA...',
    '.AAa...',
    '.AAa...',
    '.AAa...',
    '..AAL..',
    '..aAA..',
    '...AAL.',
    '...aAA.',
    '....SSS',
    '....sSs',
  ] },
  // 앞아래: 내려베기 끝·팔로스루 — 팔이 앞으로 비스듬히 내려간다
  { name: 'fwdDown', sh: [2, 1], hd: [7, 7.5], rows: [
    '.LLL......',
    '.LAA......',
    '.AAAL.....',
    '..aAAL....',
    '...aAAL...',
    '....aAAL..',
    '.....aAAS.',
    '......SSS.',
    '......sSs.',
  ] },
  // 앞: 찌르기 — 어깨 높이로 쭉 뻗는다
  { name: 'fwd', sh: [2, 1.5], hd: [10.5, 2.5], rows: [
    '.LLLLLLLLL..',
    '.LAAAAAAAAS.',
    '.AAAAAAAAASS',
    '.aaaaaaaaaSs',
    '..........s.',
  ] },
  // 앞위: 올려베기 끝 — 팔이 앞으로 비스듬히 올라간다
  { name: 'fwdUp', sh: [1.5, 7.5], hd: [7.5, 0.5], rows: [
    '.......SS',
    '......SSs',
    '.....LAs.',
    '....LAA..',
    '...LAAa..',
    '..LAAa...',
    '.LAAa....',
    '.AAa.....',
    '.aa......',
  ] },
  // 위: 검을 머리 옆으로 곧게 치켜든다
  { name: 'up', sh: [2, 9.5], hd: [2, 0.5], rows: [
    '.SSS..',
    '.sSs..',
    '.LAA..',
    '.LAA..',
    '.AAa..',
    '.AAa..',
    '.AAa..',
    '.AAa..',
    '.AAa..',
    '.AAa..',
    '.aaa..',
  ] },
  // 머리뒤: 내려베기 예비 — 팔꿈치가 앞·위로 서고 아랫팔이 머리 뒤로 넘어간다
  { name: 'overBack', sh: [6, 7.5], hd: [1, 0.5], rows: [
    'SSS.LLL..',
    'sSsAAAL..',
    '..aaAAA..',
    '.....AAa.',
    '.....AAa.',
    '.....AAa.',
    '.....AAa.',
    '.....AAa.',
    '......aa.',
  ] },
  // 뒤: 찌르기 예비 — 팔을 뒤로 당긴다 (어깨 높이)
  { name: 'back', sh: [7, 1.5], hd: [3, 1.5], rows: [
    '..SSS.LLL',
    '..SSSAAAA',
    '..sSsAAAa',
    '.....aaa.',
  ] },
  // 뒤아래: 올려베기 예비 — 팔을 허리 뒤로 내린다
  { name: 'backLow', sh: [6.5, 1], hd: [1, 6.5], rows: [
    '.....LLL',
    '.....LAA',
    '....LAAa',
    '...LAAa.',
    '..LAAa..',
    '.SAAa...',
    'SSSa....',
    'sSs.....',
  ] },
  // 아래: 팔을 곧게 늘어뜨린다 (뒷팔 기본·걷기)
  { name: 'down', sh: [2, 1], hd: [2, 9.5], rows: [
    '.LLL',
    '.LAA',
    '.AAa',
    '.AAa',
    '.AAa',
    '.AAa',
    '.AAa',
    '.AAa',
    '.AAa',
    '.SSS',
    '.sSs',
  ] },
  // 뒤로 흔듦: 걷기 — 팔이 뒤로 비스듬히
  { name: 'swingBack', sh: [5, 1], hd: [1.5, 7.5], rows: [
    '....LLL',
    '....LAA',
    '...LAAa',
    '...AAa.',
    '..LAAa.',
    '..AAa..',
    '.SSAa..',
    '.SSS...',
    '.sSs...',
  ] },
];
// 외곽선을 두르고(1칸 패딩 → 닻 자리 +1) 쓰기 좋게 정리
for (const p of ARM_POSES) {
  const w = Math.max(...p.rows.map((r) => r.length));
  p.rows = outline(p.rows.map((r) => r.padEnd(w, '.')));
  p.sh = [p.sh[0] + 1, p.sh[1] + 1]; p.hd = [p.hd[0] + 1, p.hd[1] + 1];
  p.vec = [(p.hd[0] - p.sh[0]), (p.hd[1] - p.sh[1])];          // 어깨→손 (칸)
}

// 뼈대가 바라는 손 위치(어깨 기준, px)에 가장 가까운 팔 그림. 각도를 길이보다 중시한다
function armPoseFor(dx, dy) {
  const C = PX / 2, d = Math.hypot(dx, dy) || 0.001, ang = Math.atan2(dy, dx);
  let best = null, bs = Infinity;
  for (const p of ARM_POSES) {
    const vx = p.vec[0] * C, vy = p.vec[1] * C, pd = Math.hypot(vx, vy), pa = Math.atan2(vy, vx);
    let da = Math.abs(ang - pa); if (da > Math.PI) da = Math.PI * 2 - da;
    const score = da * 10 + Math.abs(d - pd) / C * 0.6;
    if (score < bs) { bs = score; best = p; }
  }
  return best;
}
// 팔 그림을 어깨(sx, sy)에 붙여 그린다. 돌려주는 값은 그 그림의 손 위치(px) — 무기를 거기 붙인다
function drawArmSprite(g, p, sx, sy, armC, fistC, shade = 0) {
  const C = PX / 2, base = shade < 0 ? spriteShadeCol(armC, -1) : armC, fist = shade < 0 ? spriteShadeCol(fistC, -1) : fistC;
  const col = { L: spriteShadeCol(base, 1), A: base, a: spriteShadeCol(base, -1), S: fist, s: spriteShadeCol(fist, -1), '#': PAL['#'] };
  const ox = sx - (p.sh[0] + 0.5) * C, oy = sy - (p.sh[1] + 0.5) * C;
  for (let r = 0; r < p.rows.length; r++) {
    const row = p.rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      g.fillStyle = col[ch] || base;
      const x0 = Math.round(ox + c * C), x1 = Math.round(ox + (c + 1) * C), y0 = Math.round(oy + r * C), y1 = Math.round(oy + (r + 1) * C);
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  return [sx + p.vec[0] * C, sy + p.vec[1] * C];
}



// ── 평타 컷 레이어 (절충안) ──
// ARM_CUT: 앞팔·뒷팔 그림 { sh 어깨 칸, hd 손 칸, rows, vec 어깨→손 } · LEG_CUT: 두 다리 그림 { hip 골반 아래 가운데(칸 모서리), g 땅까지 칸, rows }
//  다리 글자: l/m/n 앞다리(가운데·빛·그늘) · p/q 뒷다리 · k/K 앞 부츠 · j 뒷 부츠
//  그림은 dev/cutgen.py 가 구워 addCutSprites(팔, 다리) 로 넣는다 — 이 파일 끝(검 계열·공용 'base')과 src/cuts/*.js(무기 계열별, 이름에 계열 접두사)
const ARM_CUT = {}, LEG_CUT = {};
// 팔은 ARM_POSES 와 같은 규칙(외곽선·닻 +1·어깨→손 벡터), 다리는 아래쪽 외곽선 없이(발이 땅에 닿게) 위·옆만 두른다
function addCutSprites(arms = {}, legs = {}) {
  for (const k in arms) {
    const p = arms[k], w = Math.max(...p.rows.map((r) => r.length));
    p.name = k;
    p.rows = outline(p.rows.map((r) => r.padEnd(w, '.')));
    p.sh = [p.sh[0] + 1, p.sh[1] + 1]; p.hd = [p.hd[0] + 1, p.hd[1] + 1];
    p.vec = [p.hd[0] - p.sh[0], p.hd[1] - p.sh[1]];
    ARM_CUT[k] = p;
  }
  for (const k in legs) {
    const p = legs[k], w = Math.max(...p.rows.map((r) => r.length));
    p.name = k;
    p.rows = outline(p.rows.map((r) => r.padEnd(w, '.')), false);
    p.hip = [p.hip[0] + 1, p.hip[1] + 1];
    LEG_CUT[k] = p;
  }
}
// 두 다리 그림을 골반 아래 가운데(hx, hy)에 붙여 그린다. legC 다리 색, bootC 부츠 색, white: 피격 번쩍임
function drawLegSprite(g, p, hx, hy, legC, bootC, white = false) {
  const C = PX / 2, sh = spriteShadeCol, back = sh(legC, -1);
  const col = white ? null : { l: legC, m: sh(legC, 1), n: back, p: back, q: sh(back, -1), k: bootC, K: sh(bootC, 1), j: sh(bootC, -1), '#': PAL['#'] };
  const ox = hx - p.hip[0] * C, oy = hy - p.hip[1] * C;
  for (let r = 0; r < p.rows.length; r++) {
    const row = p.rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      g.fillStyle = white ? (ch === '#' ? PAL['#'] : '#ffffff') : col[ch] || legC;
      const x0 = Math.round(ox + c * C), x1 = Math.round(ox + (c + 1) * C), y0 = Math.round(oy + r * C), y1 = Math.round(oy + (r + 1) * C);
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
}

// ── 컷 레이어 base (자동 생성: dev/cutgen.py — 손으로 고칠 칸은 생성기의 FIX 에) ──
addCutSprites({
  rest: { sh: [1.5, 0.5], hd: [5, 9], rows: [
    '.LA....',
    'LAAa...',
    '.AAa...',
    '.AAa...',
    '.AAa...',
    '.AAa...',
    '.AAA...',
    '..AAA..',
    '...ASSS',
    '....SSS',
    '....sSs',
  ] },
  raise: { sh: [0.5, 0.5], hd: [5, 1], rows: [
    'LA..SSS',
    'AAA.SSS',
    'AAALsSs',
    'AAAAa..',
    'LALAa..',
    'LAAa...',
    '.Aa....',
  ] },
  windup: { sh: [1.5, 12.5], hd: [1, 1], rows: [
    'SSS...',
    'SSS...',
    'sSs...',
    '.AAA..',
    '..AAA.',
    '...AA.',
    '...AAA',
    '...LAa',
    '...LAa',
    '..LAa.',
    '..LAa.',
    '.LAa..',
    '.LAa..',
    '.Aa...',
  ] },
  strike: { sh: [0.5, 0.5], hd: [10, 5], rows: [
    'LAL.........',
    'AAAAL.......',
    '.AAAAL......',
    '..aAAAAL....',
    '....aAAAASSS',
    '.......aASSS',
    '.........sSs',
  ] },
  follow: { sh: [0.5, 0.5], hd: [8, 8], rows: [
    'LAA.......',
    'AAA.......',
    'AAAA......',
    '.AAA......',
    '..AAA.....',
    '..AAAA....',
    '...AAAAL..',
    '.....AASSS',
    '.......SSS',
    '.......sSs',
  ] },
  recover: { sh: [0.5, 0.5], hd: [5, 8], rows: [
    'LA.....',
    'AAa....',
    'AAA....',
    'AAA....',
    'LAA....',
    'LAA....',
    '.AAA...',
    '.aAASSS',
    '...ASSS',
    '....sSs',
  ] },
  lowBack: { sh: [5.5, 0.5], hd: [1, 9], rows: [
    '....LLA',
    '....LAa',
    '...LAAa',
    '..LLAa.',
    '..LAa..',
    '..Aa...',
    '.LAa...',
    '.LA....',
    'SSS....',
    'SSS....',
    'sSs....',
  ] },
  scoop: { sh: [0.5, 5.5], hd: [10, 1], rows: [
    '.........SSS',
    '........LSSS',
    '.......LAsSs',
    '.....LLAa...',
    '.LLLLLAa....',
    'LAAAAAa.....',
    'AAaaa.......',
  ] },
  high: { sh: [0.5, 11.5], hd: [4, 1], rows: [
    '...SSS',
    '...SSS',
    '...sSs',
    '..LAa.',
    '..LAa.',
    '..LA..',
    '..AA..',
    '.LAa..',
    '.LAa..',
    'LAA...',
    'LAa...',
    'LAa...',
    'Aa....',
  ] },
  chamber: { sh: [3.5, 0.5], hd: [5, 6], rows: [
    '..LLA..',
    '..LAa..',
    '.LAAa..',
    'LAAa...',
    'LAL....',
    'AAAASSS',
    '..aASSS',
    '....sSs',
  ] },
  thrust: { sh: [0.5, 0.5], hd: [11, 1], rows: [
    'LALLLLLLL.SSS',
    'AAAAAAAAAASSS',
    '.aaaaaaaaasSs',
  ] },
  bRest: { sh: [1.5, 0.5], hd: [1, 11], rows: [
    '.LA',
    'LAA',
    'LAA',
    'LAA',
    'LAa',
    'LAa',
    'LAa',
    'LAa',
    'LA.',
    'LA.',
    'SSS',
    'SSS',
    'sSs',
  ] },
  bGuard: { sh: [0.5, 0.5], hd: [6, 8], rows: [
    'LA......',
    'AAA.....',
    'AAA.....',
    '.AAA....',
    '.AAA....',
    '..AAA...',
    '..AAAA..',
    '...AASSS',
    '.....SSS',
    '.....sSs',
  ] },
  bFling: { sh: [8.5, 0.5], hd: [1, 7], rows: [
    '.......LLA',
    '.....LLAAa',
    '....LLAAa.',
    '...LAAaa..',
    '..LAaa....',
    '.LAa......',
    'SSS.......',
    'SSS.......',
    'sSs.......',
  ] },
  bFlingHigh: { sh: [9.5, 0.5], hd: [1, 5], rows: [
    '.......LLLA',
    '.....LLAAAa',
    '...LLAAaaa.',
    '..LLAaa....',
    'SSSAa......',
    'SSS........',
    'sSs........',
  ] },
  bRecover: { sh: [3.5, 0.5], hd: [1, 10], rows: [
    '...LA',
    '..LAA',
    '..LAa',
    '..LAa',
    '..AA.',
    '.LAa.',
    '.LAa.',
    '.LA..',
    '.AA..',
    'SSS..',
    'SSS..',
    'sSs..',
  ] },
  bPoint: { sh: [0.5, 0.5], hd: [9, 3], rows: [
    'LALL.......',
    'AAAALL.....',
    '.aAAAAAASSS',
    '....aaaaSSS',
    '........sSs',
  ] },
  bBack: { sh: [9.5, 3.5], hd: [1, 1], rows: [
    'SSS........',
    'SSSLLLL....',
    'sSsAAAAALL.',
    '....aaAAAAA',
    '.......aaAa',
  ] },
}, {
  stand: { hip: [6, 2], g: 7.0, rows: [
    '.ppp....mll..',
    '.ppq....mln..',
    '.ppq....mll..',
    '.ppq....mlln.',
    '.ppq....mlln.',
    '.ppq....mlln.',
    '.ppq....mll..',
    'jjjjj...KKKkk',
    'jjjjj...KKKkk',
  ] },
  set: { hip: [7, 2], g: 7.0, rows: [
    '..ppp....mll...',
    '..ppq....mlln..',
    '.pppq....mlln..',
    '.pppq....mlln..',
    '.pppq.....mll..',
    '.ppqq.....mlln.',
    '.ppq......mlln.',
    'jjjjj.....KKKKk',
    'jjjjj.....KKKKk',
  ] },
  load: { hip: [6, 2], g: 6.5, rows: [
    '.ppp....mll.....',
    '.pppq...mlll....',
    '.pppp...lllll...',
    '..pppp...lllln..',
    '..pppq....llll..',
    '.pppqq.....mll..',
    'jjjj.......mKKkk',
    'jjjj........KKkk',
    'jjjj........KKkk',
  ] },
  lunge: { hip: [10, 2], g: 5.5, rows: [
    '.....ppp....mlll.....',
    '....pppq....mlllll...',
    '...ppppq....lllllln..',
    '..ppppq......llllln..',
    '.ppppq..........mll..',
    'jjjjq...........KKKkk',
    'jjjj............KKKkk',
    'jjjj............KKKkk',
  ] },
  lungeDeep: { hip: [12, 2], g: 5.0, rows: [
    '.......ppp....mllll.....',
    '......pppq....mllllll...',
    '....ppppqq....llllllln..',
    '...ppppqq.......lllmln..',
    '.pppppq............mln..',
    'jjjjj..............KKKkk',
    'jjjjj..............KKKkk',
  ] },
  crouch: { hip: [6, 2], g: 6.0, rows: [
    '.ppp....mll...',
    '.pppp...mllll.',
    '.ppppp..llllll',
    '..pppp...lllln',
    '..pppq.....mln',
    'ppppq.....mlln',
    'jjjj......KKKK',
    'jjjj......KKKK',
  ] },
  rise: { hip: [8, 2], g: 7.5, rows: [
    '...ppp....mll....',
    '...ppq....mlln...',
    '...ppq....mlln...',
    '...ppp....mlll...',
    '..pppp.....mlln..',
    'pppppq.....mlln..',
    'jjjqq.......mln..',
    'jjj.........KKKkk',
    '............KKKkk',
    '............KKKkk',
  ] },
  recover: { hip: [7, 2], g: 6.8, rows: [
    '..ppp....mll...',
    '..ppq....mlln..',
    '..ppq....mlln..',
    '..ppq....mlll..',
    '.pppq.....mlln.',
    '.pppq.....mlln.',
    '.ppq.......mln.',
    'jjjjj......KKKk',
    'jjjjj......KKKk',
  ] },
});
// ── 컷 레이어 base 끝 ──
