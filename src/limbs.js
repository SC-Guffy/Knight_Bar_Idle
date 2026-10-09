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
