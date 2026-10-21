'use strict';
// 스킬 진화 — 시즌 목표 (docs/specs/skill-evolve.md, 스킬 재기획 4단계 · 0.30.0 연계와 한 릴리스)
//  스킬 진화(융합 f_ab·f_bk·f_ak): 재료 두 스킬 숙련 ★★ + 둘을 연계로 이은 횟수 300 (방향 상관없이, src/combo.js S.combo.p) → 영구 해금.
//   장착하면 재료 둘이 빠진다 (두 칸 → 한 칸). 위력 ≈ 재료 DPS 합 × 0.9. ★★ (숙련 Lv20) 로 태어나 써서 ★★★.
//  궁극기 진화(변형 uv_a·uv_b·uv_k): 궁극기 ★★ + 궁극기와 그 줄 스킬을 이은 연계 300 → 줄마다 해금, 셋 중 하나를 골라 쓴다.
// 세이브: S.evo = { got: [열린 칸 이름], uv: 쓰는 궁극기 변형 칸 이름 | null }. 이 파일은 combo.js 다음에 불러온다.

const EVO_FUSE = { f_ab: ['whirl', 'flash'], f_bk: ['flash', 'storm'], f_ak: ['whirl', 'storm'] };
const EVO_UV = { uv_a: ['gale', 'whirl'], uv_b: ['iaido', 'flash'], uv_k: ['wave', 'storm'] };
const EVO_NEED = { lv: 20, combo: 300, ultLv: 20, ultCombo: 300, pow: 0.9 };
const evoS = () => (S.evo = S.evo || { got: [], uv: null });
const evoGot = (slot) => evoS().got.includes(slot);
const evoSk = (slot) => { const L = typeof t7L === 'function' ? t7L() : null; return L ? L.sk[slot] : null; };
const evoPair = (a, b) => { const p = (S.combo && S.combo.p) || {}; return (p[`${a}>${b}`] || 0) + (p[`${b}>${a}`] || 0); };
// 진행: { mats: [{ slot, sk, lv, need, ok, own }], combo, need, ok, got }
function evoProg(slot) {
  const L = t7L();
  if (!L) return null;
  const isUv = !!EVO_UV[slot], mats = (isUv ? ['ult'] : EVO_FUSE[slot]).map((m) => {
    const sk = L.sk[m], own = skmOwnedSlot(m), lv = own ? skmLv(sk) : 0, need = isUv ? EVO_NEED.ultLv : EVO_NEED.lv;
    return { slot: m, sk, lv, need, own, ok: own && lv >= need };
  });
  const combo = isUv ? EVO_UV[slot].reduce((a, m) => a + evoPair(L.sk.ult, L.sk[m]), 0) : evoPair(L.sk[EVO_FUSE[slot][0]], L.sk[EVO_FUSE[slot][1]]);
  const need = isUv ? EVO_NEED.ultCombo : EVO_NEED.combo;
  return { mats, combo, need, ok: mats.every((x) => x.ok) && combo >= need, got: evoGot(slot) };
}
// 조건을 채운 진화를 연다 (캠프 도착·불러오기 — tree7.js t7AutoTick). 새로 열린 칸 이름 목록
function evoCheck() {
  if (!t7On() || t7Tier() < 2) return [];
  const s = evoS(), fresh = [];
  for (const slot of [...Object.keys(EVO_FUSE), ...(t7Tier() >= 3 ? Object.keys(EVO_UV) : [])]) {
    if (s.got.includes(slot) || !evoSk(slot) && !EVO_UV[slot]) continue;
    const p = evoProg(slot);
    if (!p || !p.ok) continue;
    s.got.push(slot); fresh.push(slot);
    if (EVO_FUSE[slot]) { const sk = evoSk(slot); S.skm = S.skm || {}; S.skm[sk] = Math.max(S.skm[sk] || 0, SKM_NEED[2][EVO_NEED.lv - 1]); }   // ★★ 로 태어난다
    if (EVO_UV[slot] && !s.uv) s.uv = slot;   // 처음 연 궁극기 변형은 바로 쓴다
  }
  return fresh;
}
// 진화 스킬 → 재료 스킬 id 둘 · 재료 → 그걸 쓰는 진화 스킬 id 들
const evoMatsOf = (sk) => { const L = t7L(), slot = L && L.slotOf[sk]; return slot && EVO_FUSE[slot] ? EVO_FUSE[slot].map((m) => L.sk[m]) : []; };
const evoUsersOf = (sk) => { const L = t7L(), slot = L && L.slotOf[sk]; return L ? Object.keys(EVO_FUSE).filter((f) => EVO_FUSE[f].includes(slot)).map((f) => L.sk[f]) : []; };
// 진화 스킬 위력 눈금: 재료 둘의 초당 피해 합 × 0.9 ÷ 진화 스킬 초당 피해 (★★ 모습 기준, t7mul·쿨 포함 — 숙련·룬은 따로 곱해진다)
const evoScaleCache = {};
function evoScale(sk) {
  if (evoScaleCache[sk] != null) return evoScaleCache[sk];
  const mats = evoMatsOf(sk);
  if (mats.length !== 2) return 1;
  const D = (x) => { const k = skillAt(x, 1, 2); return k.hits.reduce((a, h) => a + h[1], 0) * ((SKILLS[x] && SKILLS[x].t7mul) || 1) / Math.max(1, SKILLS[x].cd); };
  const f = D(sk);
  return (evoScaleCache[sk] = f > 0 ? (EVO_NEED.pow * (D(mats[0]) + D(mats[1]))) / f : 1);
}
// 다음 진화 (가장 가까운 것 하나 — 스킬 탭 위 칩): 아직 안 연 것 중 진행률이 가장 높은 것
function evoNext() {
  const L = t7L();
  if (!L || t7Tier() < 2) return null;
  let best = null;
  for (const slot of [...Object.keys(EVO_FUSE), ...(t7Tier() >= 3 ? Object.keys(EVO_UV) : [])]) {
    if (evoGot(slot)) continue;
    const p = evoProg(slot);
    if (!p || p.mats.some((m) => !m.own)) continue;
    const r = (p.mats.reduce((a, m) => a + Math.min(1, m.lv / m.need), 0) / p.mats.length + Math.min(1, p.combo / p.need)) / 2;
    if (!best || r > best.r) best = { slot, r, p };
  }
  return best;
}
