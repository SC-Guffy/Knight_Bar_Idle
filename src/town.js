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
const townTier = (lv) => (lv < 5 ? 0 : lv < 10 ? 1 : lv < 15 ? 2 : 3);
// 이 건물에 지금 할 수 있는 일이 있는가 — 건설, 훈련장의 훈련, 대장간의 시설 올리기. 마을 탭 레드닷·건물 이름표의 점·기본 선택이 모두 이걸 본다
// (안의 버튼이 빨갛게 뛰면 탭·이름표에도 점이 있어야 한다는 원칙)
function townTodo(id) {
  if (canBuild(id)) return true;
  if (id === 'training') return TRAINING.some(canTrain);
  if (id === 'forge') return Object.keys(FORGE_FAC).some((f) => forgeFacBlocker(f) === '');
  return false;
}
function townSel() {
  if (!townUi.sel || !BUILDINGS[townUi.sel]) {
    townUi.sel = S.build ? S.build.id : Object.keys(BUILDINGS).find(townTodo) || 'training';
  }
  return townUi.sel;
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
// 건물마다 바닥 기준 아이소 좌표 (u: 오른쪽 아래, v: 왼쪽 아래, z: 위)로 면을 하나씩 칠한다.
// 면은 1px 세로줄로 채워서(fillPoly) 안티앨리어싱 없이 도트처럼 또렷하게.
let townBB = null;          // 지금 그리는 건물이 칠한 범위 (클릭 판정·이름표 위치)
const shadeCache = {};
function shade(c, k) {
  const key = c + k;
  if (!shadeCache[key]) {
    const n = parseInt(c.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    shadeCache[key] = `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  return shadeCache[key];
}
function fillPoly(b, pts, col) {
  let x0 = Infinity, x1 = -Infinity;
  for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; }
  b.fillStyle = col;
  for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
    const xc = x + 0.5;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], c = pts[(i + 1) % pts.length];
      if ((xc < a[0]) === (xc < c[0])) continue;
      const y = a[1] + ((c[1] - a[1]) * (xc - a[0])) / (c[0] - a[0]);
      if (y < lo) lo = y; if (y > hi) hi = y;
    }
    if (lo > hi) continue;
    const y0 = Math.round(lo), y1 = Math.max(y0 + 1, Math.round(hi));
    b.fillRect(x, y0, 1, y1 - y0);
    if (townBB) { townBB.x0 = Math.min(townBB.x0, x); townBB.x1 = Math.max(townBB.x1, x); townBB.y0 = Math.min(townBB.y0, y0); townBB.y1 = Math.max(townBB.y1, y1); }
  }
}
function isoKit(b, cx, cy) {
  const P = (u, v, z) => [cx + u - v, cy + (u + v) / 2 - z];
  const K = {
    b, P,
    quad: (pts, col) => fillPoly(b, pts.map((p) => P(p[0], p[1], p[2])), col),
    // 상자: 윗면 밝게, 왼쪽 앞면(+v) 기본, 오른쪽 앞면(+u) 어둡게
    box(u0, u1, v0, v1, z0, z1, c, top = true) {
      if (top) K.quad([[u0, v0, z1], [u1, v0, z1], [u1, v1, z1], [u0, v1, z1]], shade(c, 1.18));
      K.quad([[u0, v1, z0], [u1, v1, z0], [u1, v1, z1], [u0, v1, z1]], c);
      K.quad([[u1, v0, z0], [u1, v1, z0], [u1, v1, z1], [u1, v0, z1]], shade(c, 0.74));
    },
    L: (v, u0, u1, z0, z1, col) => K.quad([[u0, v, z0], [u1, v, z0], [u1, v, z1], [u0, v, z1]], col),   // 왼쪽 앞면(v 고정) 위 사각형
    R: (u, v0, v1, z0, z1, col) => K.quad([[u, v0, z0], [u, v1, z0], [u, v1, z1], [u, v0, z1]], col),   // 오른쪽 앞면(u 고정) 위 사각형
    line(a, c, col) {
      const p = P(...a), q = P(...c), n = Math.max(1, Math.ceil(Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1]))));
      b.fillStyle = col;
      for (let i = 0; i <= n; i++) b.fillRect(Math.floor(p[0] + ((q[0] - p[0]) * i) / n), Math.round(p[1] + ((q[1] - p[1]) * i) / n), 1, 1);
    },
    dot: (u, v, z, col, w = 1, h = 1) => { const p = P(u, v, z); b.fillStyle = col; b.fillRect(Math.floor(p[0]), Math.round(p[1]), w, h); },
    // 박공지붕: 용마루가 u 방향 (박공 삼각형이 오른쪽 앞면에 보인다). o = 처마 길이
    gableU(u0, u1, v0, v1, z, rh, c, wall, o = 2, stripe = 3) {
      const vm = (v0 + v1) / 2, zr = z + rh;
      K.quad([[u0 - o, v0 - o, z], [u1 + o, v0 - o, z], [u1 + o, vm, zr], [u0 - o, vm, zr]], shade(c, 0.62));
      K.quad([[u1, v0, z], [u1, v1, z], [u1, vm, zr]], wall);
      K.quad([[u0 - o, v1 + o, z], [u1 + o, v1 + o, z], [u1 + o, vm, zr], [u0 - o, vm, zr]], c);
      for (let k = stripe; k < rh; k += stripe) {
        const f = k / rh, v = v1 + o - (v1 + o - vm) * f;
        K.line([u0 - o, v, z + rh * f], [u1 + o, v, z + rh * f], shade(c, 0.82));
      }
      K.line([u0 - o, v1 + o, z], [u1 + o, v1 + o, z], shade(c, 0.6));
      K.line([u1 + o, v1 + o, z], [u1 + o, vm, zr], shade(c, 1.25));
      K.line([u0 - o, vm, zr], [u1 + o, vm, zr], shade(c, 1.3));
    },
    // 박공지붕: 용마루가 v 방향 (박공 삼각형이 왼쪽 앞면에 보인다)
    gableV(u0, u1, v0, v1, z, rh, c, wall, o = 2, stripe = 3) {
      const um = (u0 + u1) / 2, zr = z + rh;
      K.quad([[u0 - o, v0 - o, z], [u0 - o, v1 + o, z], [um, v1 + o, zr], [um, v0 - o, zr]], shade(c, 0.62));
      K.quad([[u0, v1, z], [u1, v1, z], [um, v1, zr]], wall);
      K.quad([[u1 + o, v0 - o, z], [u1 + o, v1 + o, z], [um, v1 + o, zr], [um, v0 - o, zr]], shade(c, 0.8));
      for (let k = stripe; k < rh; k += stripe) {
        const f = k / rh, u = u1 + o - (u1 + o - um) * f;
        K.line([u, v0 - o, z + rh * f], [u, v1 + o, z + rh * f], shade(c, 0.66));
      }
      K.line([u1 + o, v0 - o, z], [u1 + o, v1 + o, z], shade(c, 0.5));
      K.line([u0 - o, v1 + o, z], [um, v1 + o, zr], shade(c, 1.25));
      K.line([um, v1 + o, zr], [u1 + o, v1 + o, z], shade(c, 1.1));
    },
    // 사각뿔 지붕
    hip(u0, u1, v0, v1, z, rh, c, o = 1) {
      const um = (u0 + u1) / 2, vm = (v0 + v1) / 2, A = [um, vm, z + rh];
      K.quad([[u0 - o, v1 + o, z], [u1 + o, v1 + o, z], A], c);
      K.quad([[u1 + o, v0 - o, z], [u1 + o, v1 + o, z], A], shade(c, 0.74));
    },
    // 창: 왼쪽 앞면 / 오른쪽 앞면
    winL(v, u, z, w, h, glass, frame = '#3b2a1c') { K.L(v, u - 1, u + w + 1, z - 1, z + h + 1, frame); K.L(v, u, u + w, z, z + h, glass); },
    winR(u, v, z, w, h, glass, frame = '#3b2a1c') { K.R(u, v - 1, v + w + 1, z - 1, z + h + 1, frame); K.R(u, v, v + w, z, z + h, glass); },
  };
  return K;
}
const disc = (b, x, y, r, col) => {
  b.fillStyle = col;
  for (let dy = -r; dy < r; dy++) { const w = Math.round(Math.sqrt(r * r - (dy + 0.5) ** 2)); b.fillRect(Math.round(x - w), Math.round(y + dy), w * 2, 1); }
};
function smoke(b, x, y, t, n, col, speed = 0.5, rise = 18) {
  for (let i = 0; i < n; i++) {
    const ph = (t * speed + i / n) % 1;
    b.globalAlpha = 0.55 * (1 - ph);
    b.fillStyle = col;
    const s = 2 + Math.round(ph * 3);
    b.fillRect(Math.round(x + Math.sin(ph * 5 + i) * 2 + ph * 6 - s / 2), Math.round(y - ph * rise - s / 2), s, s);
  }
  b.globalAlpha = 1;
}
const flick = (t, seed) => Math.sin(t * 3.1 + seed) * 0.5 + Math.sin(t * 7.3 + seed * 2) * 0.3 > -0.5;

// ── 훈련장: 울타리 친 모래 연무장, 줄무늬 천막, 허수아비·과녁·무기 거치대 (Lv15 망루) ──
function drawTraining(K, tier, t) {
  const A = 13 + tier;
  const wood = '#8a5a30', post = (u, v, h = 6) => K.box(u - 0.5, u + 0.5, v - 0.5, v + 0.5, 0, h, wood);
  K.quad([[-A, -A, 0], [A, -A, 0], [A, A, 0], [-A, A, 0]], '#c9ad74');
  K.quad([[-A + 1, -A + 1, 0], [A - 1, -A + 1, 0], [A - 1, A - 1, 0], [-A + 1, A - 1, 0]], '#dcc28c');
  for (let i = 0; i < 26; i++) K.dot(-A + 2 + ((i * 7.3) % (A * 2 - 4)), -A + 2 + ((i * 11.7) % (A * 2 - 4)), 0, i & 1 ? '#c4a672' : '#e8d3a2');
  // 뒤쪽 울타리 (Lv10 부터 돌담)
  const fence = (a, c) => {
    const n = Math.round(Math.hypot(c[0] - a[0], c[1] - a[1]) / 4);
    if (tier >= 2) {
      for (let i = 0; i < n; i++) {
        const u0 = a[0] + ((c[0] - a[0]) * i) / n, v0 = a[1] + ((c[1] - a[1]) * i) / n, u1 = a[0] + ((c[0] - a[0]) * (i + 1)) / n, v1 = a[1] + ((c[1] - a[1]) * (i + 1)) / n;
        K.box(Math.min(u0, u1) - 0.7, Math.max(u0, u1) + 0.7, Math.min(v0, v1) - 0.7, Math.max(v0, v1) + 0.7, 0, i & 1 ? 4 : 6, '#9a958c');
      }
      return;
    }
    for (let i = 0; i <= n; i++) post(a[0] + ((c[0] - a[0]) * i) / n, a[1] + ((c[1] - a[1]) * i) / n);
    K.line([a[0], a[1], 5], [c[0], c[1], 5], '#a8743f'); K.line([a[0], a[1], 3], [c[0], c[1], 3], '#7a4e28');
  };
  fence([-A, -A], [A, -A]); fence([-A, -A], [-A, A]);
  // 천막 (뒤 모서리) — Lv5 부터 빨강·흰 줄무늬
  const p0 = -A + 2, p1 = -A + 11;
  post(p0, p0, 10); post(p1, p0, 10);
  K.box(p0 + 1, p0 + 6, p0 + 2, p1 - 1, 0, 2, '#7a5230');            // 벤치
  K.box(p0 + 2, p0 + 5, p1 - 4, p1 - 1, 2, 5, '#6b3f22');            // 궤짝
  K.line([p0 + 2, p1 - 4, 4], [p0 + 5, p1 - 4, 4], '#d4a24a');
  post(p0, p1, 10); post(p1, p1, 10);
  const um = (p0 + p1) / 2, zr = 15 + tier;
  K.quad([[p0 - 1, p0 - 1, 10], [p0 - 1, p1 + 1, 10], [um, p1 + 1, zr], [um, p0 - 1, zr]], tier ? '#9a2f26' : '#7a6a4a');
  const strips = 6;
  for (let i = 0; i < strips; i++) {
    const va = p0 - 1 + ((p1 - p0 + 2) * i) / strips, vb = p0 - 1 + ((p1 - p0 + 2) * (i + 1)) / strips;
    K.quad([[p1 + 1, va, 10], [p1 + 1, vb, 10], [um, vb, zr], [um, va, zr]], tier ? (i & 1 ? '#f2ebe0' : '#c8392e') : i & 1 ? '#b8a27a' : '#a08a62');
  }
  K.quad([[p0, p1 + 1, 10], [p1, p1 + 1, 10], [um, p1 + 1, zr]], tier ? '#e8e0d2' : '#9a8460');
  for (let i = 0; i <= strips; i++) {           // 천막 끝자락 술
    const v = p0 - 1 + ((p1 - p0 + 2) * i) / strips;
    K.dot(p1 + 1, v, 10 - 1, tier ? '#ffd257' : '#6b5a3a');
  }
  if (tier >= 1) { K.line([um, p1 + 1, zr], [um, p1 + 1, zr + 5], '#5a3a22'); K.quad([[um, p1 + 1, zr + 5], [um, p1 + 4, zr + 4], [um, p1 + 1, zr + 3]], '#ffd257'); }
  // 무기 거치대
  const rv = A - 4;
  K.box(-A + 3, -A + 4, rv - 5, rv - 4, 0, 7, wood); K.box(-A + 3, -A + 4, rv, rv + 1, 0, 7, wood);
  K.line([-A + 3.5, rv - 4, 6], [-A + 3.5, rv, 6], '#5a3a22');
  [[rv - 3, '#d8dce4', 12], [rv - 1.5, '#b0b6c2', 10], [rv, '#c0884a', 13]].forEach(([v, c, h], i) => {
    K.line([-A + 4, v, 1], [-A + 4, v, h], c);
    K.dot(-A + 4, v, h, i === 2 ? '#d8dce4' : '#ffd257');
  });
  // 과녁 (뒤 오른쪽) — 화살이 박혀 있다
  const tg = (u, v) => {
    K.line([u - 1, v, 0], [u, v, 9], '#6b4526'); K.line([u + 1, v, 0], [u, v, 9], '#6b4526');
    const [x, y] = K.P(u, v, 10);
    disc(K.b, x, y, 5, '#f4efe2'); disc(K.b, x, y, 4, '#c0392b'); disc(K.b, x, y, 3, '#f4efe2'); disc(K.b, x, y, 2, '#c0392b'); disc(K.b, x, y, 1, '#ffd257');
    K.b.fillStyle = '#5a3a22'; K.b.fillRect(Math.round(x) + 1, Math.round(y) - 2, 3, 1);
    K.b.fillStyle = '#f4efe2'; K.b.fillRect(Math.round(x) + 4, Math.round(y) - 3, 1, 2);
  };
  tg(A - 5, -A + 4);
  if (tier >= 2) tg(A - 10, -A + 3);
  // 허수아비 (가끔 맞고 흔들린다)
  const dummy = (u, v, k) => {
    const hit = ((t * 0.7 + k * 0.37) % 1) < 0.12, w = hit ? Math.round(Math.sin(t * 40) * 1) : 0;
    K.b.fillStyle = 'rgba(0,0,0,.18)'; const s = K.P(u, v, 0); K.b.fillRect(Math.round(s[0]) - 3, Math.round(s[1]), 6, 2);
    K.box(u - 0.5, u + 0.5, v - 0.5, v + 0.5, 0, 6, wood);
    K.box(u - 2 + w, u + 2 + w, v - 1.5, v + 1.5, 5, 12, '#d6b05a');
    K.line([u - 2 + w, v + 1.5, 8], [u + 2 + w, v + 1.5, 8], '#8a6a2a');
    K.line([u - 5 + w, v + 1.5, 10], [u + 5 + w, v + 1.5, 10], '#7a5230');
    K.box(u - 1.5 + w, u + 1.5 + w, v - 1, v + 1, 12, 15, '#e8cf8a');
    K.dot(u - 0.5 + w, v + 1, 14, '#3a2a1a'); K.dot(u + 0.8 + w, v + 1, 14, '#3a2a1a');
    if (hit) { const q = K.P(u + w, v + 2, 10); K.b.fillStyle = '#fff6c0'; K.b.fillRect(Math.round(q[0]) - 3, Math.round(q[1]) - 1, 2, 1); K.b.fillRect(Math.round(q[0]) + 2, Math.round(q[1]) - 3, 1, 1); }
  };
  const dummies = [[3, 3], [9, -6], [-5, 9], [10, 7]];
  for (let i = 0; i < 1 + tier; i++) dummy(dummies[i][0], dummies[i][1], i);
  // 앞 울타리 (오른쪽 앞면 가운데는 출입구)
  fence([-A, A], [A, A]);
  fence([A, -A], [A, -4]); fence([A, 4], [A, A]);
  post(A, -3, 9); post(A, 3, 9);
  if (tier >= 1) {
    K.line([A, -3, 9], [A, 3, 9], '#6b4526');
    K.R(A + 0.6, -2, 2, 6, 8.5, '#9a2f26'); K.line([A + 0.6, -2, 6], [A + 0.6, 2, 6], '#ffd257');
  }
  // Lv15: 망루 (왼쪽 모서리)
  if (tier >= 3) {
    const u = -A - 1, v = A - 3;
    K.box(u - 2, u + 2, v - 2, v + 2, 0, 20, '#7a5230');
    K.L(v + 2, u - 1, u + 1, 12, 15, '#2a1d14');
    K.box(u - 3.5, u + 3.5, v - 3.5, v + 3.5, 20, 22, '#9a6a3a');
    K.hip(u - 3.5, u + 3.5, v - 3.5, v + 3.5, 22, 7, '#9a2f26');
    const wave = Math.round(Math.sin(t * 4));
    K.line([u, v, 29], [u, v, 35], '#5a3a22');
    K.quad([[u, v, 35], [u, v + 5, 34 + wave], [u, v, 32]], '#ffd257');
  }
}

// ── 여관: 돌 1층 위에 튀어나온 목조 골조 2층, 붉은 기와 박공지붕, 간판·창·꽃 화분·굴뚝 연기 ──
function drawInn(K, tier, t) {
  const a = 9 + tier, d = 7 + (tier >> 1), lit = (s) => (flick(t, s) ? '#ffd46b' : '#f2b850');
  const f1 = tier ? 10 : 11, two = tier >= 1, f2 = two ? f1 + 9 + tier : f1;
  const beam = '#5a3a22';
  // 1층
  K.box(-a, a, -d, d, 0, f1, tier ? '#a39c90' : '#e6d6b0');
  if (tier) {            // 돌 쌓은 무늬
    for (let z = 2; z < f1; z += 3) { K.line([-a, d, z], [a, d, z], '#8a8378'); K.line([a, -d, z], [a, d, z], '#6e675e'); }
    for (let i = 0; i < 18; i++) K.dot(-a + ((i * 5.3) % (2 * a)), d, 1 + ((i * 3) % (f1 - 1)), '#857d72', 2, 1);
  } else {
    for (let u = -a; u <= a; u += 6) K.L(d, u, u + 1, 0, f1, beam);
    K.line([-a, d, f1 - 1], [a, d, f1 - 1], beam);
  }
  // 1층 창 (왼쪽 앞면)
  for (let u = -a + 3; u < a - 4; u += 7) { K.winL(d, u, 3, 3, 4, lit(u)); K.L(d, u - 1, u + 4, 2, 2.6, '#6b4526'); }
  // 오른쪽 앞면: 아치 문 + 등불
  K.R(a, -2.5, 2.5, 0, 8, '#3b2617'); K.R(a, -2, 2, 0, 7, '#7a4a28'); K.R(a, -0.2, 0.2, 0, 7, '#4a2c18');
  K.dot(a, 1.2, 3.5, '#ffd257');
  const ln = K.P(a, 3.8, 6); disc(K.b, ln[0] + 1, ln[1], 3, 'rgba(255,200,90,.25)'); K.b.fillStyle = lit(9); K.b.fillRect(Math.round(ln[0]), Math.round(ln[1]) - 1, 2, 3);
  // 2층 (튀어나온 목조 골조)
  if (two) {
    const A = a + 1, D = d + 1;
    K.box(-A, A, -D, D, f1, f2, '#efe0bb');
    K.line([-A, D, f1], [A, D, f1], beam); K.line([A, -D, f1], [A, D, f1], '#3e2817');
    for (let u = -A; u <= A; u += 5) K.L(D, u, u + 1, f1, f2, beam);
    for (let u = -A; u + 5 <= A; u += 10) { K.line([u + 1, D, f1], [u + 5, D, f2], beam); K.line([u + 5, D, f1], [u + 1, D, f2], beam); }
    for (let v = -D; v <= D; v += 5) K.R(A, v, v + 1, f1, f2, '#3e2817');
    for (let u = -A + 6; u < A - 4; u += 10) {
      K.winL(D, u + 0.5, f1 + 3, 3, 4, lit(u + 3));
      K.L(D, u - 1.5, u, f1 + 2, f1 + 8, '#3f6b3a'); K.L(D, u + 4, u + 5.5, f1 + 2, f1 + 8, '#3f6b3a');     // 덧문
      K.L(D + 0.6, u - 0.5, u + 4.5, f1 + 1, f1 + 2.4, '#6b4526');                                        // 꽃 화분
      [0, 1.5, 3, 4].forEach((k, i) => K.dot(u + k, D + 0.6, f1 + 2.4, ['#ff7aa8', '#ffd257', '#ff5a6a', '#ffffff'][i]));
    }
  }
  const z = f2, rh = 9 + tier * 2;
  // 굴뚝 (지붕 뒤)
  K.box(-a + 2, -a + 5, -d + 1, -d + 4, z, z + rh + 4, '#8a4b3a');
  for (let k = z + 2; k < z + rh + 4; k += 2) K.line([-a + 2, -d + 4, k], [-a + 5, -d + 4, k], '#6e3a2c');
  K.box(-a + 1.5, -a + 5.5, -d + 0.5, -d + 4.5, z + rh + 4, z + rh + 5, '#5a3328');
  const ch = K.P(-a + 3.5, -d + 2.5, z + rh + 6);
  smoke(K.b, ch[0], ch[1], t, 5, '#e2e2e6', 0.45);
  // 지붕: Lv1~4 초가, 그다음부터 붉은 기와
  const two2 = two ? 1 : 0;
  K.gableU(-a - two2, a + two2, -d - two2, d + two2, z, rh, tier ? '#b0402c' : '#cfa75a', two ? '#e6d4ac' : '#d8c69e', 2, tier ? 2 : 3);
  // 박공 둥근 창
  const gw = K.P(a + two2, 0, z + rh * 0.4);
  disc(K.b, gw[0], gw[1], 2, '#3b2a1c'); K.b.fillStyle = lit(4); K.b.fillRect(Math.round(gw[0]) - 1, Math.round(gw[1]) - 1, 2, 2);
  // Lv10: 지붕 채광창 (앞 경사면 위)
  if (tier >= 2) {
    const v1 = d + two2 + 2, vm = 0, onRoof = (u, f) => [u, v1 - (v1 - vm) * f, z + rh * f];
    for (const u of [-a + 3, 2]) {
      K.quad([onRoof(u - 0.6, 0.3), onRoof(u + 3.6, 0.3), onRoof(u + 3.6, 0.62), onRoof(u - 0.6, 0.62)], '#3b2a1c');
      K.quad([onRoof(u, 0.36), onRoof(u + 3, 0.36), onRoof(u + 3, 0.56), onRoof(u, 0.56)], lit(u + 11));
    }
  }
  // 걸린 간판 (오른쪽 모서리)
  const sw = Math.sin(t * 1.6) * 0.8, sz = two ? f1 + 1 : f1 - 1;
  K.line([a, d, sz + 3], [a + 6, d, sz + 3], '#3b2617');
  const sp = K.P(a + 5, d, sz + 2.5);
  K.b.fillStyle = '#3b2617'; K.b.fillRect(Math.round(sp[0] - 3 + sw), Math.round(sp[1]), 1, 2); K.b.fillRect(Math.round(sp[0] + 2 + sw), Math.round(sp[1]), 1, 2);
  K.b.fillStyle = tier >= 3 ? '#ffd257' : '#8a5a2b'; K.b.fillRect(Math.round(sp[0] - 4 + sw), Math.round(sp[1] + 2), 8, 5);
  K.b.fillStyle = tier >= 3 ? '#8a5a2b' : '#ffd257'; K.b.fillRect(Math.round(sp[0] - 2 + sw), Math.round(sp[1] + 3), 3, 3); K.b.fillRect(Math.round(sp[0] + 1 + sw), Math.round(sp[1] + 4), 1, 1);
  // 문 앞 통·벤치
  K.box(a + 2, a + 4, -6, -4, 0, 4, '#7a4e2a'); K.line([a + 4, -6, 1], [a + 4, -4, 1], '#3a2a1a'); K.line([a + 4, -6, 3], [a + 4, -4, 3], '#3a2a1a');
  K.box(-3, 3, d + 2, d + 3, 0, 2, '#7a5230');
  // Lv15: 처마 따라 깃발 줄
  if (tier >= 3) {
    for (let i = 0; i <= 10; i++) {
      const u = -a - 1 + ((2 * a + 2) * i) / 10, sag = Math.sin((i / 10) * Math.PI) * 2;
      K.dot(u, d + 2, f1 - 1 - sag, ['#ff5a6a', '#ffd257', '#5ab0ff', '#7ad06a'][i % 4], 1, 2);
    }
  }
}

// ── 창고: 붉은 헛간(Lv1~4 나무 창고), X자 큰 문, 건초 다락, 사일로·짐수레·상자 더미 ──
function drawStorage(K, tier, t) {
  const u0 = -12 - tier * 2, u1 = 9, d = 7 + (tier >> 1), h = 10 + tier * 2;
  const wall = tier ? '#a8402e' : '#9a6a3a', trim = tier ? '#f2ebe0' : '#6b4526';
  // 사일로 (뒤 왼쪽, Lv10 부터 · Lv15 두 개)
  const silo = (u, v, hh) => {
    for (let k = 0; k < 6; k++) K.box(u - 3 + k * 0.0, u + 3, v - 3, v + 3, 0, hh, k ? '#c9c4bb' : '#c9c4bb', false);
    K.box(u - 3, u + 3, v - 3, v + 3, 0, hh, '#c9c4bb');
    for (let z = 4; z < hh; z += 4) { K.line([u - 3, v + 3, z], [u + 3, v + 3, z], '#8a857e'); K.line([u + 3, v - 3, z], [u + 3, v + 3, z], '#6e6a64'); }
    K.hip(u - 3, u + 3, v - 3, v + 3, hh, 5, '#6a7f9a', 1);
  };
  if (tier >= 3) silo(u0 + 1, -d - 8, h + 16);
  if (tier >= 2) silo(u0 - 4, -d - 1, h + 12);
  // 헛간 몸체
  K.box(u0, u1, -d, d, 0, h, wall);
  for (let u = u0 + 2; u < u1; u += 2) K.L(d, u, u + 0.4, 0, h, shade(wall, 0.82));        // 세로 판자
  for (let v = -d + 2; v < d; v += 2) K.R(u1, v, v + 0.4, 0, h, shade(wall, 0.6));
  K.L(d, u0, u0 + 1, 0, h, trim); K.R(u1, d - 1, d, 0, h, trim); K.R(u1, -d, -d + 1, 0, h, trim);
  // 옆면 창 (X 덧문)
  for (let u = u0 + 4; u < u1 - 5; u += 8) { K.L(d, u, u + 4, h - 7, h - 2, trim); K.L(d, u + 0.6, u + 3.4, h - 6.4, h - 2.6, '#3a2418'); K.line([u + 0.6, d, h - 6.4], [u + 3.4, d, h - 2.6], trim); }
  // 박공 쪽 큰 문 (X 버팀)
  const dw = Math.min(d - 1, 4.5);
  K.R(u1, -dw - 0.6, dw + 0.6, 0, 9, trim);
  K.R(u1, -dw, dw, 0, 8.4, tier ? '#8e3424' : '#7a5230');
  K.line([u1, -dw, 0], [u1, 0, 8.4], trim); K.line([u1, 0, 0], [u1, -dw, 8.4], trim);
  K.line([u1, 0, 0], [u1, dw, 8.4], trim); K.line([u1, dw, 0], [u1, 0, 8.4], trim);
  K.R(u1, -0.2, 0.2, 0, 8.4, trim);
  // 지붕 + 건초 다락문
  const rh = 9 + tier;
  K.gableU(u0, u1, -d, d, h, rh, tier ? '#4f4a52' : '#cfa75a', shade(wall, 0.74), 1, tier ? 2 : 3);
  K.R(u1, -2, 2, h + 1, h + 5, trim); K.R(u1, -1.4, 1.4, h + 1.5, h + 4.5, '#2a1a12');
  K.R(u1, -1.2, 1.2, h + 1.5, h + 2.6, '#e8c860'); K.dot(u1, 1.4, h + 1.5, '#e8c860');
  K.line([u1 + 2, 0, h + rh + 1], [u1 + 4, 0, h + rh - 2], '#3a2a1a');           // 도르래 들보
  K.dot(u1 + 4, 0, h + rh - 4, '#8a857e', 1, 3);
  // 풍향계 닭 (Lv15)
  if (tier >= 3) {
    const um = (u0 + u1) / 2;
    K.line([um, 0, h + rh], [um, 0, h + rh + 6], '#3a3840');
    const q = K.P(um, 0, h + rh + 7), f = Math.sin(t * 0.8) > 0 ? 1 : -1;
    K.b.fillStyle = '#ffd257'; K.b.fillRect(Math.round(q[0]) - 2, Math.round(q[1]), 5, 2); K.b.fillRect(Math.round(q[0]) + f * 2, Math.round(q[1]) - 2, 1, 2);
  }
  // 상자·통·포대 (오른쪽 앞)
  const crate = (u, v, z, s) => {
    K.box(u - s, u + s, v - s, v + s, z, z + s * 2, '#b98a52');
    K.line([u - s, v + s, z], [u + s, v + s, z + s * 2], '#7a5230'); K.line([u + s, v - s, z], [u + s, v + s, z + s * 2], '#6b4526');
  };
  crate(u1 + 4, d + 1, 0, 2); crate(u1 + 4, d - 4, 0, 2); crate(u1 + 4, d - 1.5, 4, 2);
  if (tier >= 1) crate(u1 + 9, d - 3, 0, 1.6);
  const barrel = (u, v) => {
    K.box(u - 1.5, u + 1.5, v - 1.5, v + 1.5, 0, 5, '#8a5428');
    K.line([u - 1.5, v + 1.5, 1], [u + 1.5, v + 1.5, 1], '#3a2a1a'); K.line([u - 1.5, v + 1.5, 4], [u + 1.5, v + 1.5, 4], '#3a2a1a');
  };
  barrel(u0 + 2, d + 3); barrel(u0 + 5.5, d + 3.5);
  K.box(u0 + 8, u0 + 11, d + 2, d + 4, 0, 3, '#e3d3a6'); K.dot(u0 + 9, d + 4, 3, '#b8a07a', 2, 1);       // 곡물 포대
  // 짐수레 (Lv5 부터)
  if (tier >= 1) {
    const cu = u1 + 11, cv = d + 6;
    K.box(cu - 4, cu + 4, cv - 2.5, cv + 2.5, 3, 5, '#9a6a3a');
    K.box(cu - 3, cu + 2, cv - 2, cv + 2, 5, 8, '#e8c860');              // 건초
    K.line([cu + 4, cv, 4], [cu + 9, cv, 2], '#6b4526');
    const w1 = K.P(cu, cv + 2.6, 2.5), w2 = K.P(cu, cv - 2.6, 2.5);
    disc(K.b, w2[0], w2[1], 3, '#4a3220'); disc(K.b, w1[0], w1[1], 3, '#5a3a22'); disc(K.b, w1[0], w1[1], 1, '#a8743f');
  }
}

// ── 대장간: 돌 작업장 + 큰 벽돌 굴뚝, 앞쪽 차양 아래 화로·모루·담금 통, 불꽃 ──
function drawForge(K, tier, t) {
  const a = 8 + tier, d0 = -8 - tier, d1 = 4, h = 10 + tier * 2;
  const stone = tier ? '#7e7b84' : '#8a6a44';
  // 굴뚝 (뒤) — 2개 (Lv10)
  const chim = (u, v, hh) => {
    K.box(u - 2.5, u + 2.5, v - 2.5, v + 2.5, 0, hh, '#8b4a3a');
    for (let z = 2; z < hh; z += 2) { K.line([u - 2.5, v + 2.5, z], [u + 2.5, v + 2.5, z], '#6e3a2c'); K.line([u + 2.5, v - 2.5, z], [u + 2.5, v + 2.5, z], '#5a2e22'); }
    for (let z = 3; z < hh; z += 4) { K.dot(u - 1, v + 2.5, z, '#6e3a2c'); K.dot(u + 2.5, v, z + 2, '#4a2418'); }
    K.box(u - 3, u + 3, v - 3, v + 3, hh, hh + 1.5, '#4a4650');
    const top = K.P(u, v, hh + 2);
    K.b.fillStyle = flick(t, u) ? '#ff8a2a' : '#ff5a1a'; K.b.fillRect(Math.round(top[0]) - 1, Math.round(top[1]) + 1, 3, 1);
    smoke(K.b, top[0], top[1], t + u, 6, '#7d7a80', 0.7, 24);
  };
  chim(-a + 3, d0 + 3, h + 14 + tier * 3);
  if (tier >= 2) chim(a - 3, d0 + 3, h + 10 + tier * 2);
  // 몸체 (돌 쌓기, Lv1~4 나무)
  K.box(-a, a, d0, d1, 0, h, stone);
  if (tier) {
    for (let z = 2; z < h; z += 2) {
      K.line([-a, d1, z], [a, d1, z], shade(stone, 0.8)); K.line([a, d0, z], [a, d1, z], shade(stone, 0.55));
      for (let u = -a + (z & 2 ? 1 : 3); u < a; u += 4) K.dot(u, d1, z + 1, shade(stone, 0.82));
    }
  } else {
    for (let u = -a + 2; u < a; u += 3) K.L(d1, u, u + 0.4, 0, h, '#6b5032');
  }
  // 오른쪽 앞면 창 (불빛)
  K.winR(a, d0 + 3, 4, 3, 3, flick(t, 2) ? '#ffb04a' : '#ff8a2a');
  // 지붕 (낮은 박공, 슬레이트)
  const rh = 6 + tier;
  K.gableV(-a, a, d0, d1, h, rh, tier ? '#3f3d4a' : '#9a7a4a', shade(stone, 0.9), 1, 2);
  // 앞쪽 차양 (경사 지붕) 아래 작업장
  const v2 = d1 + 9;
  K.quad([[-a, d1, 0], [a, d1, 0], [a, v2, 0], [-a, v2, 0]], '#6e6a62');                     // 돌바닥
  for (let i = 0; i < 10; i++) K.dot(-a + 1 + ((i * 5.7) % (2 * a - 2)), d1 + 1 + ((i * 3.1) % 7), 0, '#5e5a54', 2, 1);
  // 화로 (뒤 벽에 붙은 큰 아궁이)
  const glow = 0.25 + 0.12 * Math.sin(t * 6) + 0.06 * Math.sin(t * 17);
  K.L(d1, -a + 2, -a + 9, 0, 8, '#4a4650'); K.L(d1, -a + 3, -a + 8, 1, 6.5, '#2a1a14');
  K.L(d1, -a + 3.5, -a + 7.5, 1, 4, flick(t, 1) ? '#ff8a2a' : '#ff6a1a'); K.L(d1, -a + 4.5, -a + 6.5, 1, 2.6, '#ffd257');
  const fp = K.P(-a + 5.5, d1 + 2, 3);
  disc(K.b, fp[0], fp[1], 9, `rgba(255,140,40,${glow.toFixed(2)})`);
  // 풀무 (Lv5)
  if (tier >= 1) { K.box(-a + 9.5, -a + 12.5, d1 + 0.5, d1 + 3, 1, 4, '#6b4526'); K.quad([[-a + 9.5, d1 + 3, 4], [-a + 12.5, d1 + 3, 4], [-a + 11, d1 + 3, 6 + Math.sin(t * 3)]], '#4a3220'); }
  // 모루 + 망치질 불꽃
  const au = 2, av = d1 + 5;
  K.box(au - 1, au + 1, av - 1, av + 1, 0, 3, '#3a3840');
  K.box(au - 3, au + 3, av - 1.5, av + 1.5, 3, 5, '#55525c');
  K.box(au + 3, au + 4.5, av - 0.7, av + 0.7, 4, 5, '#55525c');
  const ph = (t * 1.4) % 1, hz = ph < 0.15 ? 6 : 6 + Math.min(1, (ph - 0.15) / 0.5) * 5;
  K.line([au - 1, av, hz], [au - 1, av + 3, hz + 2], '#7a5230'); K.box(au - 2, au, av - 0.7, av + 0.7, hz - 1, hz + 1, '#2a2830');
  K.dot(au + 1, av, 5, tier >= 3 ? '#9ad8ff' : '#ff9f3a', 3, 1);
  if (ph < 0.3) {
    const s = K.P(au, av, 6);
    for (let i = 0; i < 6; i++) {
      K.b.fillStyle = i & 1 ? '#ffd257' : '#ff8a2a';
      K.b.fillRect(Math.round(s[0] + Math.cos(i * 1.1 + 0.4) * ph * 30), Math.round(s[1] - Math.sin(i * 0.8 + 0.5) * ph * 22 + ph * ph * 40), 1, 1);
    }
  }
  // 담금 통 (김)
  K.box(a - 4, a - 1, av - 1.5, av + 1.5, 0, 4, '#7a4e2a'); K.quad([[a - 3.5, av - 1, 4], [a - 1.5, av - 1, 4], [a - 1.5, av + 1, 4], [a - 3.5, av + 1, 4]], '#4a7aa0');
  const st = K.P(a - 2.5, av, 5); smoke(K.b, st[0], st[1], t, 3, '#dfe6ee', 0.9, 10);
  // 무기 걸이 (Lv10)
  if (tier >= 2) {
    K.L(d1, a - 7, a - 1, 6, 6.6, '#5a3a22');
    [a - 6, a - 4, a - 2].forEach((u, i) => K.line([u, d1 + 0.3, 1.5], [u, d1 + 0.3, 6.3 + (i & 1)], '#d8dce4'));
  }
  // 화로 위 짧은 차양 (작업장은 앞이 트여 있다)
  const ac = tier ? '#4a4856' : '#8a6a3a', ae = d1 + 3.5;
  K.quad([[-a - 1, d1, h - 1], [a + 1, d1, h - 1], [a + 1, ae, h - 4], [-a - 1, ae, h - 4]], ac);
  K.quad([[a + 1, d1, h - 1], [a + 1, ae, h - 4], [a + 1, ae, h - 5], [a + 1, d1, h - 2]], shade(ac, 0.6));
  for (let u = -a + 1; u < a; u += 2) K.line([u, d1, h - 1], [u, ae, h - 4], shade(ac, 0.82));
  K.line([-a - 1, ae, h - 4], [a + 1, ae, h - 4], shade(ac, 0.55));
  // Lv15: 차양 끝 금빛 간판(망치)
  if (tier >= 3) { const q = K.P(a + 1, ae, h - 5); K.b.fillStyle = '#ffd257'; K.b.fillRect(Math.round(q[0]) - 1, Math.round(q[1]), 5, 4); K.b.fillStyle = '#3a3840'; K.b.fillRect(Math.round(q[0]), Math.round(q[1]) + 1, 3, 1); K.b.fillRect(Math.round(q[0]) + 1, Math.round(q[1]) + 1, 1, 3); }
}

const TOWN_DRAW = { training: drawTraining, inn: drawInn, storage: drawStorage, forge: drawForge };

function drawTownBuilding(b, id, p, t) {
  const tier = townTier(S.bld[id]), cx = p.x, cy = p.y;
  const sel = townSel() === id, hov = townUi.hover === id;
  const r = id === 'training' ? 15 + tier : id === 'storage' ? 14 + tier : 13 + tier;
  // 그림자 + 고른 건물 바닥 표시
  isoDiamond(b, cx + 2, cy + 1, r * 2, 'rgba(0,0,0,.16)');
  if (sel || hov) {
    const a = sel ? 0.55 + 0.35 * Math.sin(t * 5) : 0.35;
    isoDiamond(b, cx, cy, r * 2 + 6, `rgba(255,210,87,${(a * 0.3).toFixed(2)})`);
    isoOutline(b, cx, cy, r * 2 + 6, `rgba(255,210,87,${a.toFixed(2)})`);
  }
  const K = isoKit(b, cx, cy);
  townBB = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  TOWN_DRAW[id](K, tier, t);
  const bb = townBB;
  townBB = null;
  // 공사 중: 비계 + 망치 불똥
  if (S.build && S.build.id === id) {
    const top = bb.y0 + 6, xs = [bb.x0 + 2, Math.round((bb.x0 + bb.x1) / 2), bb.x1 - 2];
    b.fillStyle = '#8a6a3a';
    for (const x of xs) b.fillRect(x, top, 1, cy + 4 - top);
    for (let y = top + 4; y < cy; y += 7) b.fillRect(bb.x0 + 2, y, bb.x1 - bb.x0 - 3, 1);
    const ph = (t * 1.6) % 1;
    if (ph < 0.35) {
      b.fillStyle = ph < 0.15 ? '#fff6c0' : '#ffb13b';
      for (let i = 0; i < 4; i++) b.fillRect(xs[1] - 6 + Math.round(Math.cos(i * 1.7) * ph * 18), top + 2 - Math.round(Math.sin(i * 1.1 + 0.5) * ph * 14), 1, 1);
    }
  }
  return { x0: bb.x0 - 2, x1: bb.x1 + 2, y0: bb.y0 - 2, y1: Math.max(bb.y1, cy + 4) + 2, cx, top: bb.y0, front: bb.y1 };
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
    tags.push({ id, x: (hit.x0 + hit.x1) / 2, y: hit.top - 2 });
  }

  // 기사가 고른 건물 앞으로 걸어간다
  const sel = townSel(), sp = townPos(sel, LW, LH), sh = townUi.hits.find((h) => h.id === sel);
  const goal = { x: sp.x + 4, y: Math.min(LH - 4, (sh ? sh.front : sp.y + 10) + 6) };
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
  } else if (townTodo(id)) {
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
