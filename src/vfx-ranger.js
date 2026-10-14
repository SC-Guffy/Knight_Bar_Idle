'use strict';
// ⑤-3 레인저 계열 VFX 텍스처 (docs/specs/skill-vfx.md "퀄업 순서" ⑤-3). 공통 기반은 src/vfx-tex.js.
//  직업: 레인저·저격수·마궁수·석궁사수·신궁·차원궁사·공성포수
//  시트: P(투사체) · H(평타 명중) · E(스킬 본체) · K(스킬 명중) · F(궁극기). 번호는 스펙 텍스처 목록과 같다.
//  color: 'raw' = 시트 원래 색 (불·연기·나무·쇠가 섞인 그림), 없으면 그릴 때 준 직업 색 램프로 다시 칠한다.
//  scale: 기본 배율 (시트를 스펙보다 큰 캔버스로 뽑은 것은 2/3), back: 원거리 명중을 대상 가운데에서 날아온 쪽으로 옮기는 거리(px)

vfxRegister({
  // P 투사체 (원정·결투·레이드 공용 drawProjectile)
  p1: { frames: 1, color: 'raw' },                 // P1 단궁 화살 (레인저 + 연사)
  p2: { frames: 1, color: 'raw', scale: 2 / 3 },   // P2 장궁 화살 + 꼬리 (저격수 + 헤드샷)
  p3: { frames: 5, color: 'raw', scale: 2 / 3 },   // P3 태양 화살, 불꽃 꼬리 루프 (신궁)
  p5: { frames: 5, color: 'raw' },                 // P5 공허탄, 빨려 드는 꼬리 루프 (차원궁사)
  p6: { frames: 1, color: 'raw', scale: 2 / 3 },   // P6 공성 거대 살, 포탄형 촉 (공성포수)
  // H 평타 명중 — 직업마다 하나
  h04: { frames: 5, color: 'raw', back: 4, life: 0.22 },               // H04 레인저: 화살 박힘 (떨리는 깃 + 나무 조각)
  h12: { frames: 5, scale: 2 / 3, back: 2, life: 0.18 },               // H12 저격수: 탄흔 고리 + 뒤로 튀는 파편
  h13: { frames: 5, scale: 2 / 3, life: 0.22 },                         // H13 마궁수: 청록 육망성 룬 고리 터짐
  h14: { frames: 5, color: 'raw', scale: 2 / 3, back: 4, life: 0.2 },  // H14 석궁사수: 나무 쪼개짐 + 쇳조각
  h24: { frames: 5, color: 'raw', scale: 2 / 3, life: 0.22 },          // H24 신궁: 작은 태양 섬광 + 홍염 고리
  h25: { frames: 4, scale: 2 / 3, life: 0.24 },                         // H25 차원궁사: 안으로 빨려드는 공허 균열
  h26: { frames: 5, color: 'raw', scale: 2 / 3, life: 0.28 },          // H26 공성포수: 작은 포격 폭발 + 벽돌 조각
  // E 스킬 본체
  e03: { frames: 1 },     // E03 연사 ★★: 세 갈래로 갈라지는 초록 화살
  e25: { frames: 1 },     // E25 헤드샷: 조준경 (이중 고리 + 십자선)
  e26: { frames: 1 },     // E26 철갑 관통탄: 꼬인 관통 빔 (화살촉 머리) — 가로로 늘여 화면 끝까지
  e27: { frames: 1 },     // E27 유도 마탄: 청록 구슬 + 초승달 꼬리
  e28: { frames: 5 },     // E28 유도 마탄 ★★★: 특이점 (기울어진 강착 원반 루프)
  e29: { frames: 1 },     // E29 별빛 화살비: 떨어지는 별 화살 (오각별 촉 + 반짝이 꼬리)
  e30: { frames: 5, color: 'raw' },   // E30 별빛 화살비 ★★★: 밤하늘 조각 + 오로라 루프
  e31: { frames: 5, color: 'raw' },   // E31 폭열탄 ★★★: 버섯구름 (대공성포 막타도 쓴다)
  e32: { frames: 1, color: 'raw' },   // E32 다연장 사격: 땅에 꽂힌 쇠뇌 살
  // K 스킬 명중 — 스킬마다 하나
  k03: { frames: 5, color: 'raw' },   // K03 연사: 화살 다발 박힘 + 녹색 깃털
  k17: { frames: 5 },                 // K17 헤드샷: 정수리 섬광 + 조준 고리 + 유리 금
  k18: { frames: 5, color: 'raw' },   // K18 철갑 관통탄: 철판이 뚫리는 구멍 + 쇳조각
  k19: { frames: 5 },                 // K19 유도 마탄: 청록 마탄 파열 + 룬 조각
  k20: { frames: 5 },                 // K20 별빛 화살비: 별 착지 반짝임 + 별 조각
  k21: { frames: 5, color: 'raw' },   // K21 폭열탄: 불덩이 폭발 + 연기 고리 (석궁사수·공성포수 전용 폭발 시트)
  k22: { frames: 5, color: 'raw' },   // K22 다연장 사격: 연속 박힘 쇳조각
  k35: { frames: 5, color: 'raw' },   // K35 태양 관통 막타: 태양 폭발 홍염
  k36: { frames: 5 },                 // K36 차원 붕괴 막타: 블랙홀 수축 → 폭발
  k37: { frames: 5, color: 'raw' },   // K37 대공성포 막타: 요새 붕괴 대폭발
  // F 궁극기
  f12: { frames: 4, color: 'raw' },   // F12 태양 관통: 태양 + 홍염 루프 (키·1번 프레임 + 둘을 180° 돌린 것 — 애니 3~5번은 모양이 달라져 뺐다)
  f13: { frames: 5 },                 // F13 차원 붕괴: 공허 균열 + 소용돌이 루프
  f14: { frames: 1 },                 // F14 차원 붕괴: 휘는 시공간 격자 (240×100 도트, 하단바 전체)
  f15: { frames: 1, color: 'raw' },   // F15 대공성포: 불붙은 포탄
});
// 무기 → 투사체 시트. 마궁수 마력탄(P4)은 마법사 계열(⑤-1), 석궁사수 쇠뇌 살은 도트 오브젝트 그대로
const VFX_PROJ = { bow: 'p1', longbow: 'p2', sunBow: 'p3', voidBow: 'p5', siegeBallista: 'p6' };
Object.assign(VFX_BASIC_HIT, { ranger: 'h04', marksman: 'h12', arcaneArcher: 'h13', arbalest: 'h14', deadeye: 'h24', voidArcher: 'h25', siegeMaster: 'h26' });

// 시트 색: 시트에 color 가 있으면 그것('raw'), 없으면 c
const vfxCol = (id, c) => (VFX_SHEETS[id] && VFX_SHEETS[id].color) || c;
// 루프 시트의 지금 프레임 (초당 fps)
const vfxLoopF = (id, fps = 10, seed = 0) => Math.floor(clock * fps + seed) % ((VFX_SHEETS[id] && VFX_SHEETS[id].frames) || 1);
// 배율을 도트가 깨지지 않는 값 중 가장 가까운 것으로 (1/3 단위: 화면 배율 2배에서 기기 1px 단위)
function vfxNearScale(s) {
  const q = Math.max(1, Math.round(s * 3)) / 3;
  return q > 2 ? Math.round(s * 1.5) / 1.5 : q;
}

// 원거리 평타 한 발 (world.js drawProjectile 첫 줄). 시트가 있는 무기면 그리고 true
function vfxProjectile(sh) {
  const id = VFX_PROJ[sh.w.id], s = id && VFX_SHEETS[id];
  if (!s || !s.lv) return false;
  return vfxDraw(ctx, id, vfxCol(id, sh.w.arrow.color), vfxLoopF(id, 12), sh.x, sh.y, { rot: sh.a, scale: s.scale || 1 });
}

// 날아가는 시트 한 장: (x0,y0) → (x1,y1) 을 life 초에, 진행 방향으로 돌려서. o: vfxDraw 옵션 + { ease, arc 포물선 높이, onLand, tail 잔상 수 }
function texShotFx(id, x0, y0, x1, y1, life, color, o = {}) {
  const pos = (u) => { const k = o.ease ? o.ease(u) : u; return [mix(x0, x1, k), mix(y0, y1, k) - (o.arc || 0) * 4 * k * (1 - k)]; };
  skFx(null, o.delay || 0, life, (u) => {
    const [x, y] = pos(u), [nx, ny] = pos(Math.min(1, u + 0.02)), rot = Math.atan2(ny - y, nx - x) || Math.atan2(y1 - y0, x1 - x0);
    for (let j = o.tail || 0; j >= 1; j--) { const [tx, ty] = pos(Math.max(0, u - j * 0.06)); vfxDraw(ctx, id, vfxCol(id, color), 0, tx, ty, { ...o, rot, alpha: (o.alpha || 1) * (0.5 - j * 0.12) }); }
    vfxDraw(ctx, id, vfxCol(id, color), vfxLoopF(id, 12), x, y, { ...o, rot });
  }, o.onLand || null);
}
// 명중 시트 한 번 (스킬 hitTex 공용): 숙련 단계로 크기·프레임 수 (Lv1 = 앞 3프레임·2/3배, ★ 4프레임, ★★ 이상 전부, big = 한 단계 크게)
function texHit(id, x, y, a, o = {}) {
  const m = a.mast || 0, s = VFX_SHEETS[id] || {}, base = o.scale || s.scale || 1;
  const sc = vfxNearScale(base * (m === 0 ? 2 / 3 : 1) * (o.big ? 4 / 3 : 1) * (m >= 3 && o.big ? 1.5 : 1));
  texFx(id, x, y, vfxCol(id, a.color), { life: o.life || 0.28, frames: [3, 4, 5, 5][m], scale: sc, flip: a.dir < 0, fade: 0.3, anchor: o.anchor, delay: o.delay });
}
