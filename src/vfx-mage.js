'use strict';
// ⑤-1 마법사 계열 VFX 텍스처 (docs/specs/skill-vfx.md "⑤-1 마법사 계열"). 공통 기반은 src/vfx-tex.js.
//  시트 등록 · 속성 색 램프 · 텍스처 번개 줄 · 지팡이 궤적(W8) · 투사체(P) · 평타 명중(H)
//  스킬 그림(E·F·K)은 각 스킬 파일(src/mage/*.js, src/ult/{apocalypse,absoluteZero,thunderJudgment}.js)이 이 도구로 그린다.

// 시트 (번호 = 스펙 텍스처 목록). frames 는 가로로 이어 붙인 프레임 수, 나머지는 그릴 때 기본값 메모
vfxAddSheets({
  w8: { frames: 1 },     // W8 지팡이 구슬 궤적 (키 그림 한 장, 머리가 오른쪽) — 마법사 계열 7종이 속성 램프로 다시 칠함
  h05: { frames: 5 },    // H05 마법사: 작은 마름모 마력 파열
  h15: { frames: 5 },    // H15 화염술사: 불덩이 꽃
  h16: { frames: 5 },    // H16 빙결술사: 서리 결정 파쇄
  h17: { frames: 5 },    // H17 뇌전술사: 가지 친 방전
  h27: { frames: 5 },    // H27 대마도사: 땅에서 솟는 겁화 기둥 (바닥 기준)
  h28: { frames: 5 },    // H28 빙결의 군주: 땅에서 솟는 빙하 가시 (바닥 기준)
  h29: { frames: 5 },    // H29 뇌제: 왕관 문양 방전
  p4: { frames: 3 },     // P4 마력탄
  p7: { frames: 3 },     // P7 화염탄 (둥근 불덩이)
  p8: { frames: 3 },     // P8 겁화탄 (길쭉한 혜성)
  p9: { frames: 1 },     // P9 얼음 결정 (짧은 마름모)
  p10: { frames: 1 },    // P10 빙하 창끝 (길다)
  p11: { frames: 3 },    // P11 번개 줄 타일 (가늘다, 이어 붙인다)
  p12: { frames: 3 },    // P12 뇌제 번개 타일 (굵고 금빛 마디)
  e04: { frames: 7 },    // E04 마력 폭발: 마름모 노바
  e04b: { frames: 5 },   // E04b 마력 폭발 ★★: 마력 블록 기둥 (바닥 기준)
  k04: { frames: 4 },    // K04 마력 폭발 명중: 겹 마름모 파열
  c9: { frames: 5 },     // C9 바닥 마법진 (납작, 공용)
  e33: { frames: 5 },    // E33 운석 (불꼬리가 왼쪽 위)
  e34: { soft: true, frames: 7 },    // E34 돔 폭발 + 용암 웅덩이 (바닥 기준)
  k23: { soft: true, frames: 7 },    // K23 메테오 명중: 용암 튐 + 바위 조각 (바닥 기준)
  e35: { soft: true, frames: 5 },    // E35 불 회오리 몸통 루프 (바닥 기준)
  e36: { frames: 5 },    // E36 불꽃 꽃
  k24: { frames: 5 },    // K24 화염 회오리 명중: 소용돌이 불티
  e37: { frames: 1 },    // E37 얼음창 (끝이 오른쪽)
  e37b: { frames: 1 },   // E37b 거대 빙창 (끝이 아래)
  k25: { frames: 5 },    // K25 얼음창 명중: 얼음 꽂힘 + 서리꽃
  e38: { frames: 5 },    // E38 눈보라 타일 + 우박
  e39: { frames: 7 },    // E39 프리즘 결정 군 (솟았다가 깨진다, 바닥 기준)
  e39b: { frames: 1 },   // E39b 영구 동토 빙판 타일 (가로로 이어 붙인다)
  k26: { frames: 5 },    // K26 블리자드 명중: 서리 막
  e40: { frames: 7 },    // E40 번개 손 (손가락이 아래)
  e41: { frames: 5 },    // E41 구전
  k27: { frames: 5 },    // K27 연쇄 번개 명중: 연결 지점 방전 (좌우로 튄다)
  e42: { frames: 5 },    // E42 기둥 번개 (위 → 아래, 바닥 기준)
  k28: { frames: 4 },    // K28 낙뢰 명중: 착탄 섬광 + 그을음 (바닥 기준)
  c15: { soft: true, frames: 5 },    // C15 먹구름 (공용)
  c3: { frames: 5 },     // C3 충격파 바닥 고리 (납작, 공용)
  f16: { soft: true, frames: 5 },    // F16 종언의 겁화: 불바다 루프 240×40 (바닥 기준)
  f17: { soft: true, frames: 7 },    // F17 종언의 겁화: 붉은 태양 붕괴
  k38: { soft: true, frames: 7 },    // K38 종언의 겁화 막타: 하얀 불의 벽 (바닥 기준)
  f18: { frames: 5 },    // F18 절대영도: 빙하 산맥 + 오로라 배경 240×100
  f19: { frames: 7 },    // F19 절대영도: 거대 눈꽃 + 유리 파편
  k39: { frames: 7 },    // K39 절대영도 막타: 전신 결빙 → 산산조각 (바닥 기준)
  f20: { soft: true, frames: 7 },    // F20 뇌제 강림: 뇌신 거인
  f21: { frames: 5 },    // F21 뇌제 강림: 번개 왕좌 + 그물
  k40: { frames: 7 },    // K40 뇌제 강림 막타: 왕관 번개 직격 (바닥 기준)
});

// 속성 색 램프 [어두움 → 밝음] 5단. 뇌전은 빙결(청백)과 띄우려고 연보라 + 연노랑 빛, 뇌제는 금빛
const MG_RAMP = {
  mana: ['#1a2660', '#2f58b8', '#62a6f0', '#b4e2ff', '#ffffff'],
  fire: ['#5a160c', '#c8301a', '#ff7a2a', '#ffcf4a', '#fff6d0'],
  inferno: ['#2a0608', '#7a0e14', '#d8261a', '#ff8a3a', '#fff0c0'],
  frost: ['#1b3f6a', '#3f88c0', '#7fd0f0', '#c8f2ff', '#ffffff'],
  glacier: ['#141e4a', '#2e4ea0', '#7ea4e8', '#d6e6ff', '#ffffff'],
  storm: ['#24124a', '#5a32a8', '#a77bff', '#e8d8ff', '#fff6c8'],
  tempest: ['#3a2410', '#a0681a', '#f0b830', '#ffe98a', '#ffffff'],
  cloud: ['#121019', '#24222f', '#3a384a', '#5a5870', '#8a88a4'],
  rock: ['#1a0e0a', '#3a2420', '#6a3a26', '#ff7a2a', '#ffd257'],
};
const MG_EL = { mage: 'mana', pyromancer: 'fire', archmage: 'inferno', cryomancer: 'frost', frostlord: 'glacier', electromancer: 'storm', thunderEmperor: 'tempest' };
const MG_WEAPON_EL = { wand: 'mana', flameStaff: 'fire', infernoStaff: 'inferno', frostStaff: 'frost', glacierStaff: 'glacier', stormStaff: 'storm', tempestStaff: 'tempest' };
// 숙련 단계를 섞은 램프: Lv1·★ 은 회색으로 바래고(MASTERY_FADE), ★★★ 는 금빛이 살짝 (가장 어두운 단은 그대로)
const mgRampCache = new Map();
function mgRamp(el, mast = 2) {
  const key = el + mast;
  if (mgRampCache.has(key)) return mgRampCache.get(key);
  const base = MG_RAMP[el] || MG_RAMP.mana;
  const r = base.map((c, i) => (mast < 2 ? mixHex(c, MASTERY_FADE[0], MASTERY_FADE[1 + mast] * 0.8) : mast >= 3 && i ? mixHex(c, MASTERY_GOLD, 0.15) : c));
  mgRampCache.set(key, r);
  return r;
}
// 시전(a)의 속성 램프
const mgA = (a, el) => mgRamp(el || MG_EL[a.cls] || 'mana', a.mast || 0);
// 시트 한 장의 화면 크기(px)
const mgPx = (id, sc = 1) => (VFX_SHEETS[id] ? VFX_SHEETS[id].fw * sc * VFX_DOT : 0);
const mgHash = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

// ───────── 텍스처 번개 줄 ─────────
// (x0, y0) → (x1, y1) 을 번개 타일(P11 가는 줄 / P12 굵은 금빛 마디)로 잇는다. 마디마다 옆으로 꺾이고, 프레임은 초당 20번 바뀐다
//  o: { sheet, scale, seed, jag 꺾임 세기(타일 길이 비율), alpha }
function mgBolt(x0, y0, x1, y1, ramp, o = {}) {
  const id = o.sheet || 'p11', s = VFX_SHEETS[id];
  if (!s || !s.lv) return;
  const sc = o.scale || 2 / 3, tw = s.fw * sc * VFX_DOT, L = Math.hypot(x1 - x0, y1 - y0);
  if (L < 2) return;
  const n = Math.max(1, Math.round(L / tw)), nx = -(y1 - y0) / L, ny = (x1 - x0) / L, seed = (o.seed || 0) + Math.floor(clock * 12) * 7.3;
  const jag = (o.jag == null ? 0.3 : o.jag) * tw, pts = [[x0, y0]];
  for (let i = 1; i < n; i++) { const k = (mgHash(seed + i) - 0.5) * 2 * jag; pts.push([mix(x0, x1, i / n) + nx * k, mix(y0, y1, i / n) + ny * k]); }
  pts.push([x1, y1]);
  const f = Math.floor(clock * 20 + (o.seed || 0)) % s.frames;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], len = Math.hypot(bx - ax, by - ay);
    vfxDraw(ctx, id, ramp, (f + i) % s.frames, (ax + bx) / 2, (ay + by) / 2, { scale: sc, rot: Math.atan2(by - ay, bx - ax), sx: len / tw, flipY: mgHash(seed + i * 3.1) < 0.5, alpha: o.alpha == null ? 1 : o.alpha });
  }
}
// 잠깐 남는 텍스처 번개 (arcFx 대신). 뒤 절반은 깜빡이며 사라진다
function mgArcFx(x0, y0, x1, y1, ramp, life = 0.2, o = {}, delay = 0) {
  const seed = Math.random() * 100;
  skFx(null, delay, life, (u) => { if (u > 0.5 && Math.floor(u * 30) % 2) return; mgBolt(x0, y0, x1, y1, ramp, { ...o, seed, alpha: (o.alpha == null ? 1 : o.alpha) * (1 - u * 0.5) }); });
}

// ───────── 평타 ─────────
// W8 지팡이 구슬 궤적: 내지르는 컷에서 구슬이 지나온 자리에 키 그림 한 장 (머리 = 지금 구슬 자리, 꼬리 = 지나온 쪽)
function mgStaffSmear(g, w, L0, Ly, cut) {
  const el = MG_WEAPON_EL[w.id], s = VFX_SHEETS.w8;
  if (!el || !s || !s.lv) return false;
  const C = PX / 2, D = stOrbDist(w), a0 = staffAngle(cut.arc), a1 = staffAngle(cut.bowA || 0);
  const sx = L0.hand[0] + Math.cos(a0) * D * C, sy = L0.hand[1] + Math.sin(a0) * D * C;
  const ex = Ly.hand[0] + Math.cos(a1) * D * C, ey = Ly.hand[1] + Math.sin(a1) * D * C;
  const ang = Math.atan2(ey - sy, ex - sx), half = 11 * VFX_DOT;
  // 키 그림은 꼬리(왼쪽 아래) → 머리(오른쪽 위) 축이 -0.5rad 기운 21×13 도트. 축을 진행 방향에 맞추고, 머리(가운데에서 축을 따라 11도트)를 구슬 자리에
  g.save(); g.globalCompositeOperation = 'lighter';
  vfxDraw(g, 'w8', mgRamp(el), 0, ex - Math.cos(ang) * half, ey - Math.sin(ang) * half, { rot: ang + 0.5, alpha: 0.9 });
  g.restore();
  return true;
}
// 쏘는 순간 지팡이 끝: 그 무기의 투사체 시트가 크게 맺혔다가 줄어든다
function mgCastFlash(id, el) {
  return (g, x, y, u) => {
    g.save(); g.globalCompositeOperation = 'lighter';
    vfxDraw(g, id, mgRamp(el), Math.floor(u * 3) % VFX_SHEETS[id].frames, x, y, { scale: u < 0.5 ? 4 / 3 : 1, alpha: 1 - u });
    g.restore();
    return !!(VFX_SHEETS[id] && VFX_SHEETS[id].lv);
  };
}
// 투사체: 시트를 날아가는 방향으로 돌려 그린다. ghost 개 만큼 지나온 자리에 흐린 사본 (꼬리)
function mgShot(id, el, o = {}) {
  return (sh) => {
    const s = VFX_SHEETS[id];
    if (!s || !s.lv) return false;
    const ramp = mgRamp(el), f = Math.floor(clock * 15) % s.frames, sc = o.scale || 2 / 3;
    const tr = sh.trail, ng = o.ghost || 0;
    for (let i = 0; i < ng && tr.length > i * 2 + 1; i++) {
      const [gx, gy] = tr[tr.length - 1 - (i * 2 + 1)];
      vfxDraw(ctx, id, ramp, (f + i + 1) % s.frames, gx, gy, { scale: sc, rot: sh.a, alpha: 0.35 / (i + 1) });
    }
    vfxDraw(ctx, id, ramp, f, sh.x, sh.y, { scale: sc, rot: sh.a });
    return true;
  };
}
// 번개 평타: 지팡이 끝에서 지금 자리까지 번개 타일 줄 + 머리에 작은 방전 (속도가 빨라 한두 프레임이면 닿는다)
function mgBoltShot(id, el, o = {}) {
  return (sh) => {
    if (!VFX_SHEETS[id] || !VFX_SHEETS[id].lv) return false;
    mgBolt(sh.ox != null ? sh.ox : sh.x, sh.oy != null ? sh.oy : sh.y, sh.x, sh.y, mgRamp(el), { sheet: id, scale: o.scale, seed: sh.ox || 0 });
    return true;
  };
}
VFX_RANGED.wand = { proj: mgShot('p4', 'mana', { ghost: 2, scale: 4 / 3 }), flash: mgCastFlash('p4', 'mana') };
VFX_RANGED.flameStaff = { proj: mgShot('p7', 'fire', { ghost: 1, scale: 4 / 3 }), flash: mgCastFlash('p7', 'fire') };
VFX_RANGED.infernoStaff = { proj: mgShot('p8', 'inferno', { scale: 1 }), flash: mgCastFlash('p8', 'inferno') };
VFX_RANGED.frostStaff = { proj: mgShot('p9', 'frost', { ghost: 2, scale: 1 }), flash: mgCastFlash('p9', 'frost') };
VFX_RANGED.glacierStaff = { proj: mgShot('p10', 'glacier', { scale: 1 }), flash: mgCastFlash('p9', 'glacier') };
VFX_RANGED.stormStaff = { proj: mgBoltShot('p11', 'storm'), arc: (x0, y0, x1, y1, life, dl) => (mgArcFx(x0, y0, x1, y1, mgRamp('storm'), life, { sheet: 'p11' }, dl), true), flash: mgCastFlash('h17', 'storm') };
VFX_RANGED.tempestStaff = { proj: mgBoltShot('p12', 'tempest', { scale: 1 }), arc: (x0, y0, x1, y1, life, dl) => (mgArcFx(x0, y0, x1, y1, mgRamp('tempest'), life, { sheet: 'p12', scale: 1 }, dl), true), flash: mgCastFlash('h29', 'tempest') };

// 평타 명중 (원거리 착탄 포함, src/vfx-tex.js vfxBasicHit 가 부른다). 공중 명중은 대상 몸통, 땅에서 솟는 것(H27·H28)은 발밑 바닥 기준
//  크기 2/3 (치명 1배). 연출 정지·흔들림은 vfxBasicHit 이 맡는다
function mgBasicHit(id, el, o = {}) {
  return (m, crit) => {
    const x = toScreen(m.x) + m.kb + rand(-2, 2), sc = (o.scale || 2 / 3) * (crit ? 1.5 : 1);
    const y = o.ground ? groundY() + 2 : Math.max(monsterTop(m) + 14, monsterMidY(m)) + rand(-2, 2);
    texFx(id, x, y, mgRamp(el), { life: o.life || 0.24, scale: sc, fade: 0.25, anchor: o.ground ? 'b' : 'c', flip: Math.random() < 0.5 });
  };
}
VFX_BASIC_HIT.mage = mgBasicHit('h05', 'mana', { life: 0.2, scale: 4 / 3 });   // 10도트 시트라 크게
VFX_BASIC_HIT.pyromancer = mgBasicHit('h15', 'fire');
VFX_BASIC_HIT.archmage = mgBasicHit('h27', 'inferno', { ground: true, life: 0.3 });
VFX_BASIC_HIT.cryomancer = mgBasicHit('h16', 'frost');
VFX_BASIC_HIT.frostlord = mgBasicHit('h28', 'glacier', { ground: true, life: 0.3 });
VFX_BASIC_HIT.electromancer = mgBasicHit('h17', 'storm', { life: 0.2 });
VFX_BASIC_HIT.thunderEmperor = mgBasicHit('h29', 'tempest');

// ───────── 스킬 공용 도구 ─────────
// 텍스처 한 번 재생을 a(시전)에 묶어서 (texFx 와 같고, 시전 주인이 바뀌면 같이 사라진다)
function mgFx(a, id, x, y, ramp, o = {}) {
  const s = VFX_SHEETS[id], life = o.life || 0.3, n = Math.min(o.frames || 99, s ? s.frames : 1), fade = o.fade == null ? 0.3 : o.fade;
  aFx(a, o.delay || 0, life, (u) => {
    const f = Math.min(n - 1, Math.floor(u * n)), mv = o.move ? o.move(u) : [0, 0];
    const al = u > 1 - fade ? (1 - u) / fade : 1;
    if (o.add) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; }
    vfxDraw(ctx, id, ramp, f, (typeof x === 'function' ? x() : x) + mv[0], (typeof y === 'function' ? y() : y) + mv[1], { ...o, alpha: (o.alpha == null ? 1 : o.alpha) * al });
    if (o.add) ctx.restore();
  });
}
// 반복 재생(루프) 프레임: 초당 fps
const mgLoop = (id, fps = 10, seed = 0) => Math.floor(clock * fps + seed) % ((VFX_SHEETS[id] || { frames: 1 }).frames);
// 땅 고리(C3): ringFx 대신. size 1 ≈ 폭 64도트×2/3
function mgRing(x, ramp, size = 1, life = 0.45, y = groundY() + 1) {
  const sc = vfxFit(size * 64, 64, [2 / 3, 1, 4 / 3, 2]);
  texFx('c3', x, y, ramp, { life, scale: sc, anchor: 'b', fade: 0.4 });
}
