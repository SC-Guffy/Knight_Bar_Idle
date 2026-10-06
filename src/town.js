'use strict';
// 캠프 창 🏘 마을 탭의 작은 2.5D(아이소메트릭) 마을.
// 도트 느낌을 살리려고 작은 버퍼(1칸 = TS css px)에 기둥(1px 세로줄) 단위로 그리고 키워서 붙인다.
// 이름표·기사는 키운 뒤 원래 해상도로 덧그린다. 건물을 누르면 고르고, 기사가 그 건물 앞으로 걸어간다.

const TS = 2;                 // 버퍼 1칸 = 2 css px
const townUi = { sel: null, hover: null, hero: null, hits: [], last: 0 };

// 마을 배치 (버퍼 좌표, 원점 = 광장 중심 기준 바닥). x 는 창이 좁으면 좁혀 쓴다
const TOWN_LAYOUT = {
  training: { x: -104, y: 2 },
  inn: { x: -36, y: -20 },
  forge: { x: 36, y: -20 },
  storage: { x: 104, y: 2 },
};
const TOWN_ROOF = { training: ['#c0503f', '#8e3529'], inn: ['#4a78b8', '#2f5185'], storage: ['#7f9440', '#596b2a'], forge: ['#5f5a68', '#413d4a'] };
const STRAW = ['#d6b05a', '#a8843a'];

const townTier = (lv) => (lv < 5 ? 0 : lv < 10 ? 1 : lv < 15 ? 2 : 3);
function townSel() {
  if (!townUi.sel || !BUILDINGS[townUi.sel]) {
    townUi.sel = S.build ? S.build.id : Object.keys(BUILDINGS).find(canBuild) || 'training';
  }
  return townUi.sel;
}

// 건물 모양: 바닥 반폭 hw(짝수), 벽 높이 h, 지붕 높이 r
function townShape(id) {
  const tier = townTier(S.bld[id]);
  const hw = 16 + tier * 2;
  return { tier, hw, hh: hw / 2, h: 12 + tier * 5, r: 12 + tier };
}

// ───────────────────────── 도트 도형 ─────────────────────────
// 반폭 hw 마름모의 x 기둥에서 위·아래로 퍼지는 칸 수
const isoE = (cx, hw, x) => ((x < cx ? x - (cx - hw) : cx + hw - 1 - x) >> 1);

function isoDiamond(b, cx, cy, hw, col) {
  b.fillStyle = col;
  for (let x = cx - hw; x < cx + hw; x++) { const e = isoE(cx, hw, x); b.fillRect(x, cy - e, 1, e * 2 + 1); }
}
function isoOutline(b, cx, cy, hw, col) {
  b.fillStyle = col;
  for (let x = cx - hw; x < cx + hw; x++) { const e = isoE(cx, hw, x); b.fillRect(x, cy - e, 1, 1); b.fillRect(x, cy + e, 1, 1); }
}
// 벽: 왼쪽 면은 밝게, 오른쪽 면은 어둡게. stripe 칸마다 줄무늬(판자·돌)
function isoWalls(b, cx, cy, hw, h, colL, colR, line, stripe = 3) {
  for (let x = cx - hw; x < cx + hw; x++) {
    const e = isoE(cx, hw, x), bot = cy + e;
    b.fillStyle = x < cx ? colL : colR;
    b.fillRect(x, bot - h + 1, 1, h);
    b.fillStyle = line;
    for (let k = stripe; k < h; k += stripe) b.fillRect(x, bot - k, 1, 1);
  }
  b.fillStyle = 'rgba(0,0,0,.25)';
  b.fillRect(cx, cy + isoE(cx, hw, cx) - h + 1, 1, h);     // 앞 모서리
}
// 벽면 위의 창·문 (면의 기울기를 따라 그린다). side: -1 왼쪽 면, 1 오른쪽 면, at: 모서리에서 떨어진 칸
function isoPatch(b, cx, cy, hw, side, at, w, up, hgt, col) {
  b.fillStyle = col;
  for (let i = 0; i < w; i++) {
    const x = side < 0 ? cx - at - i - 1 : cx + at + i;
    b.fillRect(x, cy + isoE(cx, hw, x) - up - hgt + 1, 1, hgt);
  }
}
// 사각뿔 지붕 (처마가 2칸 나온다). 줄무늬는 처마와 나란히
function isoRoof(b, cx, top, hw, r, colL, colR) {
  const w = hw + 2;
  for (let x = cx - w; x < cx + w; x++) {
    const e = isoE(cx, w, x), k = x < cx ? x - (cx - w) : cx + w - 1 - x;
    const y0 = top - Math.round((r * k) / w), y1 = top + e;
    b.fillStyle = x < cx ? colL : colR;
    b.fillRect(x, y0, 1, y1 - y0 + 1);
    b.fillStyle = 'rgba(0,0,0,.16)';
    for (let y = y1 - 3; y > y0; y -= 3) b.fillRect(x, y, 1, 1);
  }
  b.fillStyle = 'rgba(0,0,0,.35)';
  for (let x = cx - w; x < cx + w; x++) b.fillRect(x, top + isoE(cx, w, x), 1, 1);   // 처마 그림자 선
}

// ───────────────────────── 바닥 (크기가 바뀔 때만 다시 그림) ─────────────────────────
let townGround = null;
function townSpread(LW) { return Math.max(0.55, Math.min(1, (LW / 2 - 34) / 110)); }
function townPos(id, LW, LH) {
  const p = TOWN_LAYOUT[id], k = townSpread(LW);
  return { x: Math.round(LW / 2 + p.x * k), y: LH - 30 + p.y };
}

function makeTownGround(LW, LH) {
  const c = document.createElement('canvas');
  c.width = LW; c.height = LH;
  const b = c.getContext('2d');
  const ox = Math.round(LW / 2), oy = LH - 30;
  b.fillStyle = '#4c8a3a'; b.fillRect(0, 0, LW, LH);
  // 바둑판 잔디 타일
  for (let i = -40; i < 40; i++) for (let j = -40; j < 40; j++) {
    if ((i + j) & 1) continue;
    const x = ox + (i - j) * 8, y = oy + (i + j) * 4;
    if (x < -10 || x > LW + 10 || y < -6 || y > LH + 6) continue;
    isoDiamond(b, x, y, 8, '#52923f');
  }
  // 고정 난수 (매번 같은 마을)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // 광장과 길
  const plaza = { x: ox, y: oy + 8 };
  for (const id of Object.keys(BUILDINGS)) {
    const p = townPos(id, LW, LH);
    const tx = p.x, ty = p.y + 14;
    const n = Math.ceil(Math.hypot(tx - plaza.x, ty - plaza.y) / 3);
    for (let s = 0; s <= n; s++) {
      const x = Math.round(plaza.x + ((tx - plaza.x) * s) / n), y = Math.round(plaza.y + ((ty - plaza.y) * s) / n);
      isoDiamond(b, x, y, 8, '#a98a5c');
    }
  }
  isoDiamond(b, plaza.x, plaza.y, 30, '#a98a5c');
  isoDiamond(b, plaza.x, plaza.y, 26, '#b9996a');
  // 길 위 자갈
  for (let k = 0; k < 40; k++) {
    const x = Math.round(plaza.x + (rnd() - 0.5) * 50), y = Math.round(plaza.y + (rnd() - 0.5) * 24);
    if (Math.abs(x - plaza.x) / 26 + Math.abs(y - plaza.y) / 13 < 1) { b.fillStyle = rnd() < 0.5 ? '#9c7f55' : '#c8ab7c'; b.fillRect(x, y, 2, 1); }
  }
  // 풀숲·꽃
  for (let k = 0; k < LW * LH / 260; k++) {
    const x = Math.floor(rnd() * LW), y = Math.floor(rnd() * LH);
    const r = rnd();
    b.fillStyle = r < 0.08 ? '#ff9fbf' : r < 0.14 ? '#fff0a0' : r < 0.55 ? '#64a84c' : '#3f7a30';
    b.fillRect(x, y, 1, r < 0.14 ? 1 : 2);
  }
  // 가장자리 나무 (마을 자리는 비운다)
  const trees = [];
  for (let k = 0; k < 90; k++) {
    const x = Math.floor(rnd() * LW), y = Math.floor(8 + rnd() * (LH + 10));
    const dx = (x - ox) / (townSpread(LW) * 150), dy = (y - oy + 10) / 52;
    if (dx * dx + dy * dy < 1) continue;
    if (trees.some((t) => Math.abs(t.x - x) < 9 && Math.abs(t.y - y) < 6)) continue;
    trees.push({ x, y, r: rnd() });
  }
  trees.sort((a, c2) => a.y - c2.y);
  for (const t of trees) townTree(b, t.x, t.y, t.r);
  return { c, LW, LH };
}

function townTree(b, x, y, r) {
  const s = r < 0.3 ? 0 : 1;
  b.fillStyle = 'rgba(0,0,0,.2)'; b.fillRect(x - 5, y, 10, 2);
  b.fillStyle = '#6b4526'; b.fillRect(x - 1, y - 5, 2, 6);
  const [lo, mid, hi, dk] = r < 0.5 ? ['#2f6b2a', '#3c8434', '#58a648', '#24521f'] : ['#2c6040', '#367a4e', '#4f9a62', '#204a30'];
  b.fillStyle = lo; b.fillRect(x - 7 - s, y - 11, 14 + s * 2, 6);
  b.fillStyle = mid; b.fillRect(x - 6 - s, y - 15 - s, 12 + s * 2, 5);
  b.fillStyle = hi; b.fillRect(x - 4, y - 19 - s * 2, 8, 4); b.fillRect(x - 2, y - 21 - s * 2, 4, 2);
  b.fillStyle = dk; b.fillRect(x + 1, y - 11, 6 + s, 6); b.fillRect(x + 2, y - 15 - s, 4 + s, 4);
}

// ───────────────────────── 건물 ─────────────────────────
function drawTownBuilding(b, id, p, t) {
  const sh = townShape(id), { tier, hw, hh, h, r } = sh;
  const cx = p.x, cy = p.y, top = cy - h + 1 - 0;
  const sel = townSel() === id, hov = townUi.hover === id;
  const building = S.build && S.build.id === id;

  // 그림자 + 고른 건물 바닥 표시
  isoDiamond(b, cx + 2, cy + 1, hw + 4, 'rgba(0,0,0,.18)');
  if (sel || hov) {
    const a = sel ? 0.55 + 0.35 * Math.sin(t * 5) : 0.35;
    isoDiamond(b, cx, cy, hw + 6, `rgba(255,210,87,${(a * 0.35).toFixed(2)})`);
    isoOutline(b, cx, cy, hw + 6, `rgba(255,210,87,${a.toFixed(2)})`);
  }

  // 벽 (Lv5 부터 돌 기단)
  const walls = { training: ['#b27c45', '#83592f'], inn: ['#d9c7a1', '#a9967a'], storage: ['#a07a4c', '#755633'], forge: ['#8d8a90', '#66636b'] }[id];
  isoWalls(b, cx, cy, hw, h, walls[0], walls[1], 'rgba(0,0,0,.12)', id === 'forge' ? 2 : 3);
  if (tier >= 1) {
    const sb = Math.min(h - 4, 4 + tier);
    for (let x = cx - hw; x < cx + hw; x++) {
      const e = isoE(cx, hw, x);
      b.fillStyle = x < cx ? '#9a968e' : '#706c66';
      b.fillRect(x, cy + e - sb + 1, 1, sb);
      if ((x + (e & 2)) % 4 === 0) { b.fillStyle = 'rgba(0,0,0,.22)'; b.fillRect(x, cy + e - sb + 1, 1, sb); }
    }
  }
  // 창문 (왼쪽 면) · 문 (오른쪽 면)
  const lit = id === 'inn' || id === 'forge';
  const glow = lit ? (Math.sin(t * 3 + cx) > -0.6 ? '#ffd46b' : '#f0b850') : '#3a2f3f';
  const winUp = Math.max(5, h - 7);
  isoPatch(b, cx, cy, hw, -1, 4, 3, winUp, 4, '#4a3524');
  isoPatch(b, cx, cy, hw, -1, 5, 2, winUp + 1, 2, glow);
  if (hw >= 18) { isoPatch(b, cx, cy, hw, -1, hw - 8, 3, winUp, 4, '#4a3524'); isoPatch(b, cx, cy, hw, -1, hw - 7, 2, winUp + 1, 2, glow); }
  if (tier >= 2) { isoPatch(b, cx, cy, hw, 1, hw - 8, 3, winUp, 4, '#4a3524'); isoPatch(b, cx, cy, hw, 1, hw - 7, 2, winUp + 1, 2, glow); }
  const doorW = id === 'storage' ? 7 : 4;
  isoPatch(b, cx, cy, hw, 1, 3, doorW, 0, 8, '#3b2617');
  isoPatch(b, cx, cy, hw, 1, 4, doorW - 2, 0, 7, id === 'forge' ? (Math.sin(t * 9) > 0 ? '#ff8a2a' : '#ff6a1a') : '#5a3a22');

  // 굴뚝 (여관·대장간) — 지붕 뒤쪽에 서 있으니 지붕보다 먼저
  const roofTop = top - 1;
  let chim = null;
  if (id === 'inn' || id === 'forge' || tier >= 2) {
    const chx = cx + Math.round(hw * 0.35), chy = roofTop - Math.round(r * 0.45);
    b.fillStyle = '#7a6f6a'; b.fillRect(chx, chy - 8, 3, 10);
    b.fillStyle = '#5a504c'; b.fillRect(chx + 2, chy - 8, 2, 10);
    b.fillStyle = '#3b3431'; b.fillRect(chx - 1, chy - 9, 6, 2);
    chim = { x: chx + 1, y: chy - 10 };
  }
  // 지붕: Lv1~4 초가, 그다음부터 건물 색
  const [rl, rr] = tier === 0 ? STRAW : TOWN_ROOF[id];
  isoRoof(b, cx, roofTop, hw, r, rl, rr);
  if (tier >= 3) {       // 금빛 용마루 + 깃발
    b.fillStyle = '#ffd257'; b.fillRect(cx - 1, roofTop - r - 1, 2, 2);
    b.fillStyle = '#6b4526'; b.fillRect(cx, roofTop - r - 12, 1, 12);
    const wave = Math.round(Math.sin(t * 4) * 1);
    b.fillStyle = TOWN_ROOF[id][0]; b.fillRect(cx + 1, roofTop - r - 12, 6, 2); b.fillRect(cx + 1, roofTop - r - 10 + wave, 5, 2);
    b.fillStyle = '#ffd257'; b.fillRect(cx + 1, roofTop - r - 12, 1, 4);
  }
  // 연기
  if (chim) {
    for (let i = 0; i < 4; i++) {
      const ph = (t * (id === 'forge' ? 0.8 : 0.5) + i / 4) % 1;
      b.globalAlpha = 0.55 * (1 - ph);
      b.fillStyle = id === 'forge' ? '#9a9aa0' : '#d8d8dc';
      const sz = 2 + Math.round(ph * 2);
      b.fillRect(Math.round(chim.x + Math.sin(ph * 5 + i) * 2 + ph * 5), Math.round(chim.y - ph * 18), sz, sz);
    }
    b.globalAlpha = 1;
  }

  drawTownProp(b, id, cx, cy, hw, hh, t);

  // 공사 중: 비계 + 망치 불똥
  if (building) {
    b.fillStyle = '#8a6a3a';
    const poles = [cx - hw - 2, cx - 1, cx + hw + 1];
    for (const x of poles) { const e = isoE(cx, hw + 2, Math.min(cx + hw + 1, x)); b.fillRect(x, roofTop - r + 2, 1, cy + e - (roofTop - r + 2) + 2); }
    for (let k = 0; k < 3; k++) {
      const yy = cy - Math.round((h * (k + 1)) / 3);
      for (let x = cx - hw - 2; x < cx + hw + 2; x++) { b.fillRect(x, yy + isoE(cx, hw + 2, x) + 1, 1, 1); }
    }
    const ph = (t * 1.6) % 1;
    if (ph < 0.35) {
      b.fillStyle = ph < 0.15 ? '#fff6c0' : '#ffb13b';
      const sx = cx - Math.round(hw * 0.4), sy = roofTop - 2;
      for (let i = 0; i < 4; i++) b.fillRect(sx + Math.round(Math.cos(i * 1.7) * ph * 18), sy - Math.round(Math.sin(i * 1.1 + 0.5) * ph * 14), 1, 1);
    }
  }
  return { x0: cx - hw - 4, x1: cx + hw + 4, y0: roofTop - r - 4, y1: cy + hh + 4, cx, top: roofTop - r };
}

function townBox(b, cx, cy, hw, h, l, r) {
  isoWalls(b, cx, cy, hw, h, l, r, 'rgba(0,0,0,.15)', 3);
  isoDiamond(b, cx, cy - h, hw, l);
  isoOutline(b, cx, cy - h, hw, 'rgba(255,255,255,.18)');
}

// 건물 옆 소품
function drawTownProp(b, id, cx, cy, hw, hh, t) {
  if (id === 'training') {
    // 과녁
    const x = cx + hw + 6, y = cy + 4;
    b.fillStyle = '#6b4526'; b.fillRect(x, y - 9, 2, 10);
    const ring = [['#f4efe2', 5], ['#c0392b', 4], ['#f4efe2', 3], ['#c0392b', 2], ['#ffd257', 1]];
    for (const [c, rr] of ring) { b.fillStyle = c; b.fillRect(x + 1 - rr, y - 14 - rr, rr * 2, rr * 2); }
    // 허수아비
    const dx = cx - hw - 6, dy = cy + 6, sw = Math.sin(t * 2) > 0.95 ? 1 : 0;
    b.fillStyle = '#6b4526'; b.fillRect(dx, dy - 12, 1, 13); b.fillRect(dx - 4, dy - 9, 9, 1);
    b.fillStyle = '#d6b05a'; b.fillRect(dx - 2 + sw, dy - 10, 5, 6); b.fillRect(dx - 1 + sw, dy - 14, 3, 3);
  } else if (id === 'inn') {
    // 간판
    const x = cx + hw - 2, y = cy - 4;
    b.fillStyle = '#4a3524'; b.fillRect(x, y - 10, 1, 4); b.fillRect(x, y - 10, 6, 1);
    const sw = Math.round(Math.sin(t * 1.8));
    b.fillStyle = '#8a5a2b'; b.fillRect(x + 2 + sw, y - 9, 5, 4);
    b.fillStyle = '#ffd257'; b.fillRect(x + 3 + sw, y - 8, 3, 2);
    // 통나무 벤치
    b.fillStyle = '#6b4526'; b.fillRect(cx - hw - 4, cy + 4, 7, 2);
  } else if (id === 'storage') {
    townBox(b, cx + hw + 3, cy + 7, 4, 5, '#b98a52', '#8a6236');
    townBox(b, cx + hw + 10, cy + 3, 4, 5, '#b98a52', '#8a6236');
    townBox(b, cx + hw + 5, cy + 3, 3, 4, '#c99a62', '#9a7246');
    // 통
    b.fillStyle = '#7a4e2a'; b.fillRect(cx - hw - 6, cy + 1, 5, 7);
    b.fillStyle = '#3a2a1a'; b.fillRect(cx - hw - 6, cy + 3, 5, 1); b.fillRect(cx - hw - 6, cy + 6, 5, 1);
  } else if (id === 'forge') {
    // 모루 + 불똥
    const x = cx - hw - 6, y = cy + 6;
    b.fillStyle = '#3a3840'; b.fillRect(x - 2, y - 2, 6, 2); b.fillRect(x - 1, y - 6, 4, 4);
    b.fillStyle = '#55525c'; b.fillRect(x - 4, y - 8, 9, 2); b.fillRect(x + 5, y - 7, 2, 1);
    const ph = (t * 1.3) % 1;
    if (ph < 0.4) {
      for (let i = 0; i < 5; i++) {
        b.fillStyle = i & 1 ? '#ffd257' : '#ff8a2a';
        b.fillRect(x + 1 + Math.round(Math.cos(i * 1.3 + 1) * ph * 16), y - 9 - Math.round(Math.sin(i * 0.7 + 0.6) * ph * 12) + Math.round(ph * ph * 20), 1, 1);
      }
    }
    // 무기 거치대
    b.fillStyle = '#6b4526'; b.fillRect(cx + hw + 3, cy - 2, 6, 1);
    b.fillStyle = '#c8ccd4'; b.fillRect(cx + hw + 4, cy - 9, 1, 9); b.fillRect(cx + hw + 7, cy - 8, 1, 8);
  }
}

function drawTownFire(b, x, y, t) {
  b.fillStyle = 'rgba(255,170,60,.18)'; isoDiamond(b, x, y, 14, 'rgba(255,170,60,.16)');
  b.fillStyle = '#6b4a2b'; b.fillRect(x - 5, y - 1, 10, 2);
  b.fillStyle = '#4a3220'; b.fillRect(x - 3, y - 3, 6, 2);
  for (const [color, base] of [['#ff5a1f', 6], ['#ff9f1c', 4], ['#ffd257', 2]]) {
    b.fillStyle = color;
    for (let i = -1; i <= 1; i++) {
      const hgt = base + Math.max(0, Math.round(Math.sin(t * 11 + i * 2.1) * 2 + Math.sin(t * 7 + i)));
      b.fillRect(x + i * 2 - 1, y - 3 - hgt, 2, hgt);
    }
  }
}

// ───────────────────────── 한 프레임 ─────────────────────────
let townBuf = null;
function drawTown() {
  const cv = document.querySelector('canvas.town');
  if (!cv) return;
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  if (!w) return;
  const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  const LW = Math.ceil(w / TS), LH = Math.ceil(h / TS);
  if (!townGround || townGround.LW !== LW || townGround.LH !== LH) townGround = makeTownGround(LW, LH);
  if (!townBuf || townBuf.width !== LW || townBuf.height !== LH) { townBuf = document.createElement('canvas'); townBuf.width = LW; townBuf.height = LH; }
  const b = townBuf.getContext('2d');
  const t = clock;
  const dt = Math.min(0.1, Math.max(0, t - townUi.last));
  townUi.last = t;

  b.drawImage(townGround.c, 0, 0);
  const plaza = { x: Math.round(LW / 2), y: LH - 30 + 8 };
  drawTownFire(b, plaza.x, plaza.y, t);

  const ids = Object.keys(BUILDINGS).sort((a, c) => townPos(a, LW, LH).y - townPos(c, LW, LH).y);
  townUi.hits = [];
  const tags = [];
  for (const id of ids) {
    const p = townPos(id, LW, LH);
    const hit = drawTownBuilding(b, id, p, t);
    townUi.hits.push({ id, ...hit });
    tags.push({ id, x: hit.cx, y: hit.top - (townTier(S.bld[id]) >= 3 ? 14 : 3) });
  }

  // 기사가 고른 건물 앞으로 걸어간다
  const sel = townSel(), sp = townPos(sel, LW, LH);
  const goal = { x: sp.x + 4, y: sp.y + townShape(sel).hh + 9 };
  const hero = townUi.hero || (townUi.hero = { x: plaza.x - 10, y: plaza.y + 4, facing: 1, walkT: 0 });
  const dx = goal.x - hero.x, dy = goal.y - hero.y, dist = Math.hypot(dx, dy);
  const walking = dist > 0.8;
  if (walking) {
    const step = Math.min(dist, 44 * dt);
    hero.x += (dx / dist) * step; hero.y += (dy / dist) * step;
    if (Math.abs(dx) > 0.5) hero.facing = dx > 0 ? 1 : -1;
    hero.walkT += dt;
  }
  b.fillStyle = 'rgba(0,0,0,.25)';
  b.fillRect(Math.round(hero.x) - 5, Math.round(hero.y), 10, 2);

  // 키워서 붙이고, 기사·이름표는 원래 해상도로
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, w, h);
  g.drawImage(townBuf, 0, 0, LW * TS, LH * TS);
  drawHero(g, S.cls, Math.round(hero.x * TS), Math.round(hero.y * TS) + 1, {
    mode: walking ? 'walk' : 'stand', walkT: hero.walkT, facing: hero.facing, t, swing: -1,
  });
  for (const tag of tags) drawTownTag(g, tag.id, tag.x * TS, tag.y * TS, t);
}

function drawTownTag(g, id, x, y, t) {
  const B = BUILDINGS[id], lv = S.bld[id], sel = townSel() === id;
  const building = S.build && S.build.id === id;
  const text = building ? `🔨 ${B.name} · ${fmtTime(S.build.remain)}` : `${B.icon} ${B.name} Lv ${lv}`;
  g.font = '600 11px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif';
  const tw = Math.ceil(g.measureText(text).width) + 14, th = 18;
  const bob = sel ? Math.round(Math.sin(t * 4) * 1.5) : 0;
  const x0 = Math.round(x - tw / 2), y0 = Math.round(y - th - 4 + bob);
  g.fillStyle = sel ? 'rgba(255,177,59,.95)' : townUi.hover === id ? 'rgba(30,30,42,.92)' : 'rgba(18,18,26,.78)';
  g.beginPath(); g.roundRect(x0, y0, tw, th, 9); g.fill();
  g.fillStyle = sel ? '#1a1206' : '#f3efe6';
  g.textBaseline = 'middle';
  g.fillText(text, x0 + 7, y0 + th / 2 + 0.5);
  if (building) {
    const k = 1 - S.build.remain / S.build.total;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0 + 7, y0 + th - 3, tw - 14, 2);
    g.fillStyle = sel ? '#1a1206' : '#ffd257'; g.fillRect(x0 + 7, y0 + th - 3, (tw - 14) * k, 2);
  } else if (canBuild(id)) {
    g.fillStyle = '#ff3b30';
    g.beginPath(); g.arc(x0 + tw - 2, y0 + 2, 4, 0, Math.PI * 2); g.fill();
  }
}

// ───────────────────────── 고르기 ─────────────────────────
function townHitAt(e) {
  const cv = e.target, r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) / TS, y = (e.clientY - r.top) / TS;
  // 앞(아래)에 있는 건물이 먼저
  for (let i = townUi.hits.length - 1; i >= 0; i--) {
    const hb = townUi.hits[i];
    if (x >= hb.x0 && x <= hb.x1 && y >= hb.y0 - 14 && y <= hb.y1) return hb.id;
  }
  return null;
}
document.addEventListener('click', (e) => {
  if (!e.target.matches || !e.target.matches('canvas.town')) return;
  const id = townHitAt(e);
  if (!id || id === townUi.sel) return;
  townUi.sel = id;
  renderCamp();
});
document.addEventListener('mousemove', (e) => {
  if (!e.target.matches || !e.target.matches('canvas.town')) { townUi.hover = null; return; }
  townUi.hover = townHitAt(e);
  e.target.style.cursor = townUi.hover ? 'pointer' : '';
});
