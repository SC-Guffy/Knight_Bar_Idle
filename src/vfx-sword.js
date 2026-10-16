'use strict';
// ⑤-4 검사 계열 VFX 텍스처 (docs/specs/skill-vfx.md "퀄업 순서" ⑤-4). 공통 기반은 src/vfx-tex.js (시트 로더·다시 칠하기·연출 정지).
// 이 파일: 검사 계열 시트 목록, 숙련 단계 도구(swFx·swScale), 평타 궤적·명중 연결. 스킬 연출은 원래 파일(skills.js·jobs/greatswordsman.js·ult/*.js)
// 안에서 이 시트들을 그린다.
//  성기사(paladin)·검성(blademaster)·대검전사(greatswordsman) / 성좌기사(archon)·검신(swordsaint)·파천검왕(tyrant)

// 시트 목록 — 번호는 스펙 텍스처 목록과 같다. frames: 가로로 이어 붙인 프레임 수
const VFX_SWORD = {
  // W 무기 궤적 (키 그림 한 장 + 코드 재생, vfx-tex.js vfxSmear). smear: 휘두르기 배율 (없으면 2/3)
  w1a: { frames: 1 },              // W1a 성좌검: 초승달 궤적 + 뒤에 흩어진 별 (성좌기사)
  w3: { frames: 1 },               // W3 쌍검: 나란한 가는 호 두 줄 (검성, 칼마다 하나씩)
  w3a: { frames: 1 },              // W3a 월광쌍검: 겹친 초승달 둘 + 꽃잎 (검신)
  w4: { frames: 1, smear: 1 },     // W4 대검: 두꺼운 띠, 꼬리가 깨진다 (대검전사)
  w4a: { frames: 1, smear: 1 },    // W4a 파천대검: 두꺼운 띠, 가장자리가 불꽃 균열 (파천검왕)
  // H 평타 명중 (직업마다 하나, 2/3 배 — 치명은 1배)
  h06: { frames: 5, scale: 2 / 3 },  // 성기사: 금빛 작은 십자 낙인
  h07: { frames: 5, scale: 2 / 3 },  // 검성: 붉은 두 줄 X + 핏방울
  h08: { frames: 5, scale: 2 / 3 },  // 대검전사: 납작한 수평 충격 + 쇳조각
  h18: { frames: 5, scale: 2 / 3 },  // 성좌기사: 별 십자 + 별자리 점선
  h19: { frames: 5, scale: 2 / 3 },  // 검신: 초승달 둘 교차 + 꽃잎
  h20: { frames: 5, scale: 2 / 3 },  // 파천검왕: 불꽃 균열이 갈라지는 대검 충격
  // 심판의 일격
  e05: { frames: 1 },              // 성검 (아래를 향한 한 자루)
  e06: { frames: 5 },              // 대천사: 0 들어 올림 → 4 내리침
  e44: { frames: 5 },              // 성광 빛기둥 (심판 ★ 빛기둥·★★★ 하늘의 빛·성역 ★★★ 붕괴)
  k05: { frames: 5 },              // 심판 명중: 성광 십자 낙인 + 빛기둥 착지 (바닥 기준)
  // 성역
  e07: { frames: 1 },              // 바닥 성문양 (Lv1 「성광」은 이것만)
  e07b: { frames: 5 },             // 빛 기둥 울타리 루프
  e08: { frames: 1 },              // 성당 실루엣 (★★★)
  k06: { frames: 5 },              // 성역 명중: 경계에 튕기는 금빛 파동
  // 질풍난무
  e09: { frames: 5 },              // 시간 정지 붉은 검선: 0 멈춤 → 부서짐
  k07: { frames: 5 },              // 질풍난무 명중: 붉은 X + 핏빛 잔영
  // 일섬
  e10: { frames: 1 },              // 핏빛 달
  e11: { frames: 5 },              // 칼집 일섬 (가로로 늘여 하단바를 가른다)
  k08: { frames: 5 },              // 일섬 명중: 가로로 갈라지는 붉은 틈 + 핏방울
  // 대검 횡참
  e12: { frames: 5 },              // 대검 참격파 (앞으로 날아간다)
  e13: { frames: 1 },              // 단두대 대검 (아래를 향한 거대 날)
  k09: { frames: 5 },              // 횡참 명중: 수평 참격 충격 + 쇳조각
  // 돌진 격돌
  e14: { frames: 5 },              // 땅 파임: 갈아엎은 고랑 + 흙덩이
  k10: { frames: 5 },              // 돌진 명중: 어깨 충돌 원뿔 충격파 + 흙
  // 성좌 강림
  f01: { frames: 1 },              // 밤하늘 배경 (하단바 전체)
  f02: { frames: 5 },              // 기사 성좌
  f02s: { frames: 5 },             // 별 반짝임 루프 (성좌 강림의 별 — sjSpark)
  f03: { frames: 5 },              // 창세의 빛
  k29: { frames: 5 },              // 성좌 강림 막타: 별 폭발 낙인
  // 천검
  f04: { frames: 5 },              // 분홍 검선 + 꽃잎 (늘여서 쓴다)
  k30: { frames: 5 },              // 천검 막타: 천 갈래 검선
  // 파천참
  f05: { frames: 1 },              // 붉은 하늘 배경
  f06: { frames: 1, keepInk: true },              // 그림자 대검 (하늘의 대검·대검 비)
  f07: { frames: 5 },              // 세계참 빛 틈
  k31: { frames: 5 },              // 파천참 막타: 세상을 가르는 세로 틈 + 불길
  f22: { frames: 5 },              // 땅 베임: 곧은 칼자국 + 불길 루프 (전쟁군주의 지그재그 균열과 나눈다)
};
for (const [id, s] of Object.entries(VFX_SWORD)) {
  VFX_SHEETS[id] = s;
  if (typeof Image === 'undefined') continue;
  s.img = new Image();
  s.img.onload = () => vfxQuantize(s);
  s.img.src = vfxBase + id + '.png';
}
// 무기 → 평타 궤적 (휘두르기, 찌르기). 성검은 장검 궤적 W1 을 금빛으로 다시 칠해 쓴다
Object.assign(VFX_WEAPON, {
  holySword: ['w1', 'w2'], starBlade: ['w1a', 'w2'],
  dualBlades: ['w3'], moonBlades: ['w3a'],
  greatsword: ['w4'], doomBlade: ['w4a'],
});
// 평타 끝의 벡터 원형 섬광(world.js drawAtkFx burst) 대신 H 시트 (⑤-2 의 texHit 표시와 같이)
for (const wid of ['holySword', 'starBlade', 'dualBlades', 'moonBlades', 'greatsword', 'doomBlade']) if (WEAPONS[wid]) WEAPONS[wid].texHit = true;
Object.assign(VFX_BASIC_HIT, { paladin: 'h06', blademaster: 'h07', greatswordsman: 'h08', archon: 'h18', swordsaint: 'h19', tyrant: 'h20' });

// ───────── 숙련 단계 (스펙 K: Lv1 = 작게·앞 프레임만, ★ = 원래, ★★ = 전체 프레임, ★★★ = 한 단계 크게 + 금빛 램프) ─────────
// 배율은 2/3·1·4/3·2 중에서만 (화면 배율 2배에서 기기 정수 px). 색은 시전 색 a.color 가 이미 단계별로 섞여 있다 (skills.js startCast)
function swScale(base, m, up = 0) {
  let i = VFX_SCALES.findIndex((s) => Math.abs(s - base) < 0.01);
  if (i < 0) i = 1;
  i += (m === 0 ? -1 : m >= 3 ? 1 : 0) + up;
  return VFX_SCALES[Math.max(0, Math.min(VFX_SCALES.length - 1, i))];
}
const swFrames = (n, m) => (m === 0 ? Math.max(2, Math.ceil(n * 0.6)) : m === 1 ? Math.max(2, n - 1) : n);
// 스킬 텍스처 한 번 재생 (skfx — 히트스톱·연출 정지와 같이 멈춘다). o: texFx 옵션 + { color, fixed: 배율을 숙련 단계로 바꾸지 않음 }
function swFx(a, id, x, y, o = {}) {
  const m = a ? a.mast || 0 : 2, s = VFX_SHEETS[id];
  if (!s) return;
  texFx(id, x, y, o.color || (a && a.color) || '#ffffff', { ...o, scale: o.fixed ? o.scale || 1 : swScale(o.scale || 1, m), frames: o.frames || swFrames(s.frames, m) });
}
// 시트 한 프레임을 위치 함수 at(u) → [x, y] 로 따라가며 그린다 (시전자를 따라가는 것, 날아가는 것)
function swFollow(a, id, life, at, o = {}) {
  const s = VFX_SHEETS[id];
  if (!s) return;
  const n = o.frames || s.frames, fade = o.fade == null ? 0.3 : o.fade;
  (a ? (d, l, f) => aFx(a, d, l, f) : (d, l, f) => skFx(null, d, l, f))(o.delay || 0, life, (u) => {
    const f = o.loop ? Math.floor(clock * (o.fps || 10)) % n : Math.min(n - 1, Math.floor(u * n));
    const p = at(u), al = (u > 1 - fade ? (1 - u) / fade : 1) * (o.fadeIn ? Math.min(1, u / o.fadeIn) : 1);
    if (p) vfxDraw(ctx, id, o.color || (a && a.color) || '#ffffff', f, p[0], p[1], { ...o, ...(p[2] || {}), alpha: (o.alpha == null ? 1 : o.alpha) * al });
  });
}
// 가는 선 시트(e09·e11·f04)를 (x0,y0)→(x1,y1) 에 맞춰 늘여 그린다. 선 시트는 가로가 길이 방향이다
function swLine(g, id, color, f, x0, y0, x1, y1, o = {}) {
  const s = VFX_SHEETS[id];
  if (!s || !s.lv) return;
  const L = Math.hypot(x1 - x0, y1 - y0), sc = o.scale || 1;
  vfxDraw(g, id, color, f, (x0 + x1) / 2, (y0 + y1) / 2, { ...o, scale: sc, rot: Math.atan2(y1 - y0, x1 - x0), sx: L / (s.fw * sc * VFX_DOT) * (o.over || 1) });
}

// 궁극기 배경 시트 (f01 밤하늘 · f05 붉은 하늘, 240×100 도트): 땅선까지 덮도록 배율을 고르고(1 또는 4/3), 하단바 폭이 모자라면
// 좌우를 번갈아 뒤집어 이어 붙인다. 시트보다 하단바가 높으면 위쪽은 시트 맨 윗줄 색(가장 어두운 램프)으로 채운다
function swBackdrop(id, col, al) {
  const s = VFX_SHEETS[id];
  if (!s || !s.lv || al <= 0) return;
  const gy = groundY(), sc = gy > s.h * VFX_DOT * 1.05 ? 4 / 3 : 1, w = s.fw * sc * VFX_DOT, h = s.h * sc * VFX_DOT;
  for (let i = 0, x = 0; x < W; i++, x += w) vfxDraw(ctx, id, col, 0, x + w / 2, gy, { anchor: 'b', scale: sc, flip: i % 2 === 1, alpha: al });
  if (gy > h) { const c = vfxRgb(col); ctx.save(); ctx.globalAlpha = al; ctx.fillStyle = `rgb(${c.map((v) => Math.round(v * 0.38)).join(',')})`; ctx.fillRect(0, 0, W, gy - h + 1); ctx.restore(); }
}

// ───────── 평타 ─────────
// 대검(두 손 판때기)은 drawCutSmear 를 거치지 않는다 (cuts/greatsword.js GS_DEF.smear). 내려찍기는 칼이 지나온 호에,
// 수평 휩쓸기(flat)는 허리 높이에서 눕혀 납작하게 — vfxSmear 와 같은 기록(명중 뒤 늘어나며 사라짐)을 남긴다
function vfxSlabSmear(g, w, L0, Ly, cut) {
  const ids = VFX_WEAPON[w.id], s = ids && VFX_SHEETS[ids[0]];
  if (!s || !s.lv) return false;
  if (cut.smear !== 'flat') return vfxSmear(g, w, L0.hand, L0.wa, Ly.hand, Ly.wa, w.len, false);
  const p = { id: ids[0], x: Ly.hand[0] + (w.len * PX) * 0.45, y: Ly.hand[1] + 2, rot: 0, flipY: false, flat: true };
  vfxSmearDraw(g, p, w.trail || '255,255,255', 'thin', 0);
  if (vfxCut.main && vfxCut.T) {
    const off = g === ctx ? [0, 0] : heroSoft.off || [0, 0];
    const Q = vfxCut.T.inverse().multiply(new DOMMatrix([1, 0, 0, 1, off[0], off[1]])).multiply(g.getTransform());
    vfxCut.last = { p, rgb: w.trail || '255,255,255', Q, at: clock };
  }
  return true;
}
