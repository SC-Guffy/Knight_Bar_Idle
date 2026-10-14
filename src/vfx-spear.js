'use strict';
// ⑤-2 창기사 계열 VFX 텍스처 (docs/specs/skill-vfx.md "퀄업 순서" ⑤-2). 공통 기반(시트 로더·다시 칠하기·연출 정지)은 src/vfx-tex.js.
//  창기사·용기병·할버디어·랜서·용황·전쟁군주·천마장군의 평타 궤적(W)·평타 명중(H)·스킬 본체(E)·스킬 명중(K)·궁극기(F) 시트를 등록하고,
//  계열 스킬 연출(src/skills.js · src/jobs/cavalier.js · src/ult/*.js)이 부르는 텍스처 그리기 도구를 둔다.
//  시트 원본·요청 설정은 dev/vfx2/ (run.py · jobs.py · req/ · raw/).

const VFX_SPEAR_SHEETS = {
  // W 평타 궤적 — 키 그림 한 장 + 코드 재생. 찌르기 줄은 오른쪽 끝이 창끝
  w5: { frames: 1 },    // 창 찌르기: 나선이 감긴 속도선 (창기사, 관통 찌르기 Lv1)
  w5a: { frames: 1 },   // 용창: 비늘 무늬 속도선 (용기병)
  w5b: { frames: 1 },   // 용황창: 불꽃 혀가 감기는 줄 (용황)
  w6: { frames: 1 },    // 할버드 넓은 호 (할버디어, 대회전 Lv1·★)
  w6a: { frames: 1 },   // 종말 도끼창: 톱니 도끼날 잔상 (전쟁군주)
  w7: { frames: 1 },    // 돌격창 긴 원뿔 속도선 (랜서, 기병 돌격 빛줄)
  w7a: { frames: 1 },   // 천마창: 금빛 줄 + 흩날리는 깃털 (천마장군, 천마군단 창비)
  // H 평타 명중 (직업마다, 32도트 시트를 2/3 로)
  h03: { frames: 5, scale: 2 / 3 }, h09: { frames: 5, scale: 2 / 3 }, h10: { frames: 5, scale: 2 / 3 }, h11: { frames: 5, scale: 2 / 3 },
  h21: { frames: 5, scale: 2 / 3 }, h22: { frames: 5, scale: 2 / 3 }, h23: { frames: 5, scale: 2 / 3 },
  // E 1·2차 스킬 본체
  e02: { frames: 5 },   // 관통 찌르기 ★★★ 드릴 창 (오른쪽이 창끝, 루프)
  e15: { frames: 5 },   // 용추락 ★ 보라 와이번 급강하 (머리가 아래)
  e15h: { frames: 1 },  // 용 머리 (오른쪽을 본다) — 용추락 ★★★ 유성룡, 용황 강림 Lv1 흑룡
  e15s: { frames: 1 },  // 용 몸통 마디 (가로, 등이 위) — 같이 쓴다
  e16: { frames: 5 },   // 용추락 착지: 용 발톱 자국 세 줄 (빛났다 사그라든다)
  e17: { frames: 5 },   // 용의 숨결 불꽃 원뿔 (왼쪽이 입, 오른쪽으로 넓어진다, 루프) — 용황 강림 숨결도
  e18: { frames: 5 },   // 용왕의 광선 타일 (가로로 이어 붙인다)
  e19: { frames: 5 },   // 대회전 ★★·★★★ 흙 회오리 (바닥 기준, 루프)
  e20: { frames: 5 },   // 대회전 ★★★ 도끼날 고리 (납작하게 눕혀 기사 둘레에, 루프)
  e21: { frames: 5 },   // 대지 가르기: 바위판 융기 (바닥 기준, 한 번)
  e22: { frames: 5 },   // 대지 가르기 ★★★ 용암 간헐천 (바닥 기준, 한 번)
  e23: { frames: 5 },   // 기병 돌격 ★★★ 빛의 천마 질주 (오른쪽을 본다, 루프) — 천마군단도
  e24: { frames: 5 },   // 방패 벽: 문장 방패 셋이 선 벽면 (솟아오른 뒤 테두리가 빛난다)
  // K 스킬 명중 (스킬마다)
  k02: { frames: 5 }, k11: { frames: 5 }, k12: { frames: 5 }, k13: { frames: 5 }, k14: { frames: 5 }, k15: { frames: 5 }, k16: { frames: 5 },
  k32: { frames: 5 }, k33: { frames: 5 }, k34: { frames: 5 },
  // F 궁극기
  f08h: { frames: 1 },  // 용황 머리 (뿔 왕관·갈기)
  f08s: { frames: 1 },  // 용황 몸통 마디
  f10: { frames: 5 },   // 천붕 ★★★ 거인의 도끼 (날이 아래)
  f10l: { frames: 5 },  // 천붕 ★★ 용암 기둥
  e23r: { frames: 5 },  // 천마군단: 빛의 기병 (말 + 창 든 기수)
  f09: { frames: 1 },   // 용황 강림 ★★★ 용신의 눈 + 용암 땅 배경 (240×100 도트, 다시 칠하지 않고 원래 색으로 — deGodEye)
  f11: { frames: 1 },   // 천마군단 ★★★ 기병대 행렬 (금빛으로 다시 칠해 하늘을 지나가는 그림자로)
};
const VFX_SPEAR_WEAPON = { spear: 'w5', dragonSpear: 'w5a', wyrmSpear: 'w5b', halberd: 'w6', doomAxe: 'w6a', lance: 'w7', holyLance: 'w7a' };
for (const wid of Object.keys(VFX_SPEAR_WEAPON)) if (WEAPONS[wid]) WEAPONS[wid].texHit = true;    // 평타 끝의 벡터 원 섬광 대신 H 시트
Object.assign(VFX_BASIC_HIT, { lancer: 'h03', dragoon: 'h09', halberdier: 'h10', cavalier: 'h11', dragonlord: 'h21', warlord: 'h22', skyGeneral: 'h23' });

function vfxRegister(sheets) {
  for (const [id, s] of Object.entries(sheets)) {
    VFX_SHEETS[id] = s;
    if (typeof Image === 'undefined') continue;
    s.img = new Image();
    s.img.onload = () => vfxQuantize(s);
    s.img.src = vfxBase + id + '.png';
  }
}
vfxRegister(VFX_SPEAR_SHEETS);

// 시트 한 장의 화면 폭(px)
const vfxW = (id, sc = 1) => (VFX_SHEETS[id] && VFX_SHEETS[id].fw || 0) * sc * VFX_DOT;

// ───────── 장병기 평타 궤적 ─────────
// 창·돌격창(찌르기): 궤적 줄의 오른쪽 끝(창끝)을 이번 컷의 창날 끝에, 자루 각도로. 할버드(휩쓸기): 장검처럼 날이 지난 호 가운데에 볼록한 쪽이 날 끝을 보게.
//  tipC: 앞손에서 날 끝까지 (칸, C = PX/2). 내 기사면 명중 순간 같은 자리에서 늘이며 사라진다 (vfx-tex.js vfxBasicRelease 가 p.draw 를 부른다)
function vfxPoleSmear(g, w, L0, Ly, tipC) {
  const id = VFX_SPEAR_WEAPON[w.id], s = id && VFX_SHEETS[id];
  if (!s || !s.lv) return false;
  const C = PX / 2, h1 = Ly.hand, a1 = Ly.wa, a0 = L0.wa, rgb = w.trail || '255,255,255', L = tipC * C;
  let p;
  if (w.motion === 'sweep') {
    // 할버드는 머리 위를 넘어 크게 휘두르므로(1.5~3.7rad) 호 가운데를 끝 쪽(남은 30%)에 둔다 — 가운데 각도에 두면 머리 위에 뜬다
    const am = a1 - (a1 - a0) * 0.3, sc = 1, flipY = a1 < a0;
    p = { x: h1[0] + Math.cos(am) * L * 0.7, y: h1[1] + Math.sin(am) * L * 0.7, rot: am - s.bulge + (flipY ? s.bulge * 2 : 0), flipY };
    p.draw = (g2, c, mode, q) => vfxDraw(g2, id, c, 0, p.x, p.y, mode === 'thin'
      ? { scale: sc, rot: p.rot, flipY: p.flipY, sy: 0.7, alpha: 0.95 }
      : { scale: sc, rot: p.rot + 0.16 * q * (flipY ? -1 : 1), flipY: p.flipY, sx: 1 + 0.15 * q, sy: 1 - 0.2 * q, alpha: 1 - 0.75 * q });
  } else {
    const sc = id === 'w7' || id === 'w7a' ? 1 : 2 / 3, half = vfxW(id, sc) / 2, tx = h1[0] + Math.cos(a1) * L, ty = h1[1] + Math.sin(a1) * L;
    p = { x: tx - Math.cos(a1) * half, y: ty - Math.sin(a1) * half, rot: a1 };
    // 늘일 때는 창끝 쪽으로 밀려 나간다 (꼬리는 제자리)
    p.draw = (g2, c, mode, q) => {
      const k = mode === 'thin' ? 0 : q, ex = half * 0.35 * k;
      vfxDraw(g2, id, c, 0, p.x + Math.cos(a1) * ex, p.y + Math.sin(a1) * ex, mode === 'thin'
        ? { scale: sc, rot: a1, sy: 0.8, alpha: 0.95 }
        : { scale: sc, rot: a1, sx: 1 + 0.35 * k, sy: 1 - 0.3 * k, alpha: 1 - 0.75 * k });
    };
  }
  p.draw(g, rgb, 'thin', 0);
  if (vfxCut.main && vfxCut.T) {
    const off = g === ctx ? [0, 0] : heroSoft.off || [0, 0];
    const Q = vfxCut.T.inverse().multiply(new DOMMatrix([1, 0, 0, 1, off[0], off[1]])).multiply(g.getTransform());
    vfxCut.last = { p, rgb, Q, at: clock };
  }
  return true;
}
// 창·할버드·돌격창 컷의 스미어(src/cuts/*.js)를 텍스처로 바꾼다 (시트가 아직 안 불러졌으면 예전 도트 스미어)
for (const wid of Object.keys(VFX_SPEAR_WEAPON)) {
  const cw = typeof CUT_WEAPON !== 'undefined' && CUT_WEAPON[wid];
  if (!cw || !cw.smear) continue;
  const old = cw.smear;
  cw.smear = (g, w, L0, Ly, cut, r, info) => {
    const C = PX / 2, tipC = w.motion === 'sweep' ? (cut.ext || 0) / C + w.len * 2 + 6
      : w.lance ? w.len * 2 + 7 : (cut.ext || 0) / C + w.len * 2 + 10;
    if (!vfxPoleSmear(g, w, L0, Ly, tipC)) old(g, w, L0, Ly, cut, r, info);
  };
}

// ───────── 스킬 텍스처 도구 ─────────
// 루프 프레임: 초당 fps, seed 로 시작을 엇갈린다
function vfxLoop(id, fps = 10, seed = 0) { const s = VFX_SHEETS[id]; return s ? Math.floor(clock * fps + seed) % s.frames : 0; }

// 찌르기 줄(W5·W7 계열 키 그림)을 x0 에서 dir 쪽으로 len 만큼 늘여 그린다 (오른쪽 끝 = 창끝이 x0 + dir·len). 한 번 재생 (skfx)
//  o: { scale, life, delay, sy, move(u) → 앞으로 밀려 나가는 거리 }
function vfxThrustLine(id, x0, y, dir, len, color, o = {}) {
  const sc = o.scale || 1, life = o.life || 0.2;
  skFx(null, o.delay || 0, life, (u) => {
    const w0 = vfxW(id, sc);
    if (!w0) return;
    const sx = Math.max(0.4, len / w0), ex = o.move ? o.move(u) : 0, k = Math.min(1, u / 0.25);
    vfxDraw(ctx, id, color, 0, x0 + dir * (len / 2 + ex), y, { scale: sc, sx: sx * (0.6 + 0.4 * k), sy: (o.sy || 1) * (1 - 0.35 * u), flip: dir < 0, alpha: u > 0.6 ? (1 - u) / 0.4 : 1 });
  });
}

// 스킬 명중(K) 한 장: 숙련 단계로 크기·프레임 (스펙 K 절 — Lv1 = 앞 3프레임, ★ = 4프레임, ★★ 이상 전부, 막타·한 방은 크게).
//  o: { scale 덮어쓰기, ground true 면 바닥 기준(anchor b, groundY + 아래 여백), life, dx 기사 쪽으로 옮김 }
function vfxSkillHit(id, a, t, share, i, n, o = {}) {
  const m = Math.min(3, a.mast || 0), big = share >= 0.5 || (n > 1 && i === n - 1);
  const sc = o.scale || (big && m >= 1 ? 1 : 2 / 3);
  const x = t.x - a.dir * (o.dx || 0), y = o.ground ? groundY() + (o.gpad || 0) * VFX_DOT * sc : t.y;
  texFx(id, x, y, a.color, { scale: sc, frames: [3, 4, 5, 5][m], life: (o.life || 0.28) * (big ? 1.2 : 1), flip: a.dir < 0, fade: 0.25, anchor: o.ground ? 'b' : 'c' });
}

// 경로를 따라 마디를 이은 도트 용 (용추락 ★★★ 유성룡 · 용황 강림). pts 머리 → 꼬리 ({x, y}), 몸통 마디 시트를 마디 사이 방향으로 돌려 꼬리부터 그리고 머리를 얹는다
//  o: { head 머리 시트, seg 마디 시트, color, r 몸 굵기(반지름 px), side 등 쪽 (-1: 오른쪽으로 날 때 등이 위 — deDragon 과 같다), alpha }
function vfxDragon(pts, o) {
  const n = pts.length, H = VFX_SHEETS[o.head], S = VFX_SHEETS[o.seg];
  if (n < 4 || !H || !H.lv || !S || !S.lv) return;
  const R = o.r, flipY = (o.side || -1) > 0, al = o.alpha == null ? 1 : o.alpha;
  const rad = (i) => { const s = i / (n - 1); return R * (s < 0.08 ? 0.8 + 0.2 * s / 0.08 : Math.max(0.12, 1 - 0.88 * Math.pow((s - 0.08) / 0.92, 1.1))); };
  const sh = S.h * VFX_DOT, sw = S.fw * VFX_DOT;
  for (let i = n - 1; i >= 1; i--) {
    const p = pts[i], q = pts[i - 1], dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy);
    if (L < 0.5) continue;
    const th = rad(i) * 2.3;
    vfxDraw(ctx, o.seg, o.color, 0, (p.x + q.x) / 2, (p.y + q.y) / 2, { rot: Math.atan2(dy, dx), sx: (L + th * 0.5) / sw, sy: th / sh, flipY, alpha: al });
  }
  const h = pts[0], b = pts[Math.min(2, n - 1)], ang = Math.atan2(h.y - b.y, h.x - b.x), hs = (R * 3.4) / (H.fw * VFX_DOT);
  vfxDraw(ctx, o.head, o.color, 0, h.x + Math.cos(ang) * R * 0.8, h.y + Math.sin(ang) * R * 0.8, { rot: ang, sx: hs, sy: hs, flipY, alpha: al });
}
