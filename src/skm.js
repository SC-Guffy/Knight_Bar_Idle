'use strict';
// 스킬 숙련 — 쓰면 자란다 (docs/specs/skill-mastery-s7.md, 스킬 재기획 1단계 · 상위 docs/specs/skill-redesign.md)
//  장착해서 데려간 스킬만 시전 1번에 경험치 +1 (원정 화면·미궁·탑·성벽 — skills.js 실제 시전) · 오프라인 원정은 싸운 시간 ÷ 쿨 (core.js simulate)
//  숙련 Lv 1~30: Lv 마다 위력 +2% · 쿨 −0.8%, Lv 10·20·30 에 ★·★★·★★★ 모습. 📖 비전서 1권 = +20 (Lv20 까지만)
//  스킬은 트리 없이 얻는다: 1차 스킬 1차 전직 · 2차 스킬 2차 전직 · 새 스킬 넷 = 부모 ★ + 2차 · 궁극기 3차. 융합·궁극기 변형은 진화(4단계)에서
// 이 파일은 tree7.js(줄기·칸 이름) 다음, core.js 앞에 불러온다. 세이브: S.skm = { 스킬 id: 경험치 } · S.t7.got = 옛 트리에서 옮겨 온 칸(이미 가진 스킬)

// 칸 → 숙련 등급 (1 = 1차 스킬 · 2 = 2차·새 스킬 · 3 = 궁극기) · 등급별 ★ 문턱 (누적 경험치)
const SKM_TH = { 1: [60, 800, 6000], 2: [100, 1500, 11000], 3: [60, 800, 5000] };
const SKM_MAX = 30, SKM_POW = 0.02, SKM_CD = 0.008;
const SKM_TOME = 20, SKM_TOME_CAP = 20;   // 비전서 1권 = 경험치 +20, 바치기로는 Lv20(★★)까지만 — ★★★ 는 써야 온다
const SKM_SIM_EFF = 0.85;                 // 오프라인 원정: 싸운 시간 중 이 스킬을 쓸 수 있던 몫 (다른 스킬을 시전하는 동안은 못 쓴다)
const SKM_UNLOCK = { whirl: 'gale', flash: 'iaido', wave: 'slash', storm: 'wave' };   // 새 스킬 칸 → 부모 칸 (부모 ★ + 2차 전직)
const SKM_GRADE = (slot) => (slot === 'ult' ? 3 : slot === 'slash' ? 1 : 2);
// 등급별 Lv → 누적 경험치 표 (need[lv-1]): Lv1~10 은 문턱까지 ((lv−1)/9)^1.6, Lv10~30 은 두 문턱 사이를 등비로
const SKM_NEED = {};
for (const g of [1, 2, 3]) {
  const th = SKM_TH[g], need = [0];
  for (let lv = 2; lv <= SKM_MAX; lv++) {
    if (lv <= 10) need.push(Math.round(th[0] * Math.pow((lv - 1) / 9, 1.6)));
    else { const seg = Math.floor((lv - 1) / 10), lo = th[seg - 1], hi = th[seg], f = (((lv - 1) % 10) + 1) / 10; need.push(Math.round(lo * Math.pow(hi / lo, f))); }
  }
  SKM_NEED[g] = need;
}
const skmSlot = (sk) => { const n = t7NodeOf(sk); return n ? n.id : null; };
const skmGrade = (sk) => SKM_GRADE(skmSlot(sk));
const skmXp = (sk) => (S.skm && S.skm[sk]) || 0;
const skmLvAt = (g, xp) => { const need = SKM_NEED[g]; let lv = 1; while (lv < SKM_MAX && xp >= need[lv]) lv++; return lv; };
const skmLv = (sk) => skmLvAt(skmGrade(sk), skmXp(sk));
const skmStage = (sk) => Math.min(3, Math.floor(skmLv(sk) / 10));
// 다음 Lv 까지 진행 (0~1, 최대면 1)
function skmProg(sk) {
  const lv = skmLv(sk), need = SKM_NEED[skmGrade(sk)];
  if (lv >= SKM_MAX) return 1;
  return Math.max(0, Math.min(1, (skmXp(sk) - need[lv - 1]) / (need[lv] - need[lv - 1])));
}
// 칸(slash·gale·…)을 가졌는가 — 지금 줄기·전직 차수·부모 숙련으로 정한다 (옛 트리에서 옮겨 온 칸은 got)
function skmOwnedSlot(slot) {
  const L = t7L(), T = t7Tier();
  if (!L || !L.sk[slot]) return false;
  if (S.t7 && S.t7.got && S.t7.got.includes(slot) && T >= (slot === 'ult' ? 3 : slot === 'slash' ? 1 : 2)) return true;
  if (slot === 'slash') return T >= 1;
  if (slot === 'gale' || slot === 'iaido') return T >= 2;
  if (slot === 'ult') return T >= 3;
  const p = SKM_UNLOCK[slot];
  return !!p && T >= 2 && skmOwnedSlot(p) && skmStage(L.sk[p]) >= 1;
}
// 아직 없는 칸의 여는 조건 (글)
function skmLockText(slot) {
  const L = t7L(), p = SKM_UNLOCK[slot];
  if (slot === 'slash') return '1차 전직';
  if (slot === 'gale' || slot === 'iaido') return '2차 전직';
  if (slot === 'ult') return '3차 전직';
  if (!p) return '진화 (나중에)';
  const pn = L && SKILLS[L.sk[p]] ? SKILLS[L.sk[p]].name : p;
  return `${t7Tier() < 2 ? '2차 전직 + ' : ''}${pn} ★ (숙련 Lv10)`;
}
const SKM_SLOTS = ['slash', 'gale', 'iaido', 'wave', 'whirl', 'flash', 'storm', 'ult'];   // 스킬 탭 카드 순서 (메인 → 2차 → 새 스킬 → 궁극기)
// 경험치 더하기 (실제 시전 · 오프라인 계산 · 비전서)
function skmGain(sk, x) {
  if (!x || !t7Has(sk)) return;
  S.skm = S.skm || {};
  S.skm[sk] = (S.skm[sk] || 0) + x;
}
// 오프라인 원정 (core.js simulate): 싸운 시간 fight 초 동안 장착 스킬마다 fight × 0.85 ÷ 쿨 번 시전했다고
function skmSimFight(fight) {
  if (!t7On() || !(fight > 0)) return;
  for (const sk of t7Skills()) skmGain(sk, (fight * SKM_SIM_EFF) / Math.max(1, skillCd(sk)));
}
// 📖 비전서 바치기: n 권까지, Lv20 넘게는 못 올린다. 실제로 쓴 권 수를 돌려준다
function skmFeedMax(sk) {
  const cap = SKM_NEED[skmGrade(sk)][SKM_TOME_CAP - 1];
  return Math.max(0, Math.ceil((cap - skmXp(sk)) / SKM_TOME));
}
function skmFeed(sk, n) {
  const use = Math.min(n, S.tomes || 0, skmFeedMax(sk));
  if (use <= 0) return 0;
  S.tomes -= use;
  skmGain(sk, use * SKM_TOME);
  return use;
}
// 장착 스킬 평균 숙련 Lv (봇 기록용)
const skmEqLv = () => { const e = t7On() ? t7Skills() : []; return e.length ? e.reduce((a, sk) => a + skmLv(sk), 0) / e.length : 0; };
// 원정 기록: 떠날 때 숙련·가진 칸을 적어 두고, 돌아오면 오른 것을 보고에 (core.js startExpedition·arriveCamp)
function skmTripStart(t) {
  if (!t7On()) return;
  t.skm0 = { ...(S.skm || {}) };
  t.got0 = SKM_SLOTS.filter(skmOwnedSlot);
}
// 보고 줄 만들기: [{ sk, lv0, lv1, p0, p1, star, fresh }] — 장착했던 스킬·새로 얻은 스킬
function skmTripLines(t) {
  if (!t || !t.skm0 || !t7On()) return [];
  const L = t7L(), out = [];
  for (const slot of SKM_SLOTS) {
    const sk = L && L.sk[slot];
    if (!sk || !skmOwnedSlot(slot)) continue;
    const fresh = t.got0 && !t.got0.includes(slot), g = skmGrade(sk), x0 = t.skm0[sk] || 0, x1 = skmXp(sk);
    if (x1 <= x0 && !fresh) continue;
    const lv0 = skmLvAt(g, x0), lv1 = skmLvAt(g, x1), need = SKM_NEED[g];
    const pr = (lv, x) => (lv >= SKM_MAX ? 1 : (x - need[lv - 1]) / (need[lv] - need[lv - 1]));
    out.push({ sk, slot, lv0, lv1, p0: pr(lv0, x0), p1: pr(lv1, x1), star: Math.floor(lv1 / 10) > Math.floor(lv0 / 10) ? Math.min(3, Math.floor(lv1 / 10)) : 0, fresh });
  }
  return out;
}
// 0.28 트리 세이브(S.t7.rk) → 시작 숙련: 칸 r · 모습 단계 → Lv = max(2(r−1)+1, 단계 × 10). 가진 칸은 got 에 (새 규칙으로 아직 안 열려도 그대로 쓴다)
//  v1(0.27): 칸 r 에 공짜 칸 없음, 모습 = 옛 칸 표 · v2·v3: 모습 노드 <칸>_s1~3 · v4: 모습 노드 <칸>_look (칸 = 단계, 융합은 +1) · 공짜 칸(slash·ult)은 v2 부터 저장 안 됨
function skmMigrate(s) {
  const from = s.v || 1, old = s.rk || {};
  s.v = 5;
  S.skm = S.skm || {};
  s.got = s.got || [];
  t7Sync();
  const L = T7_LINES[T7_LINE_OF[S.cls]];
  if (L) for (const slot of [...SKM_SLOTS, 'f_ab', 'f_bk', 'f_ak']) {
    const sk = L.sk[slot], n = T7_BY[slot];
    if (!sk || !n) continue;
    const stored = old[slot] || 0, free = from >= 2 && n.free && t7Tier() >= n.tier ? 1 : 0, r = stored + free;
    let st = 0;
    if (from < 2) st = n.t === 'fusion' ? T7_FUSE_STAGE_AT[Math.min(3, r)] : T7_STAGE_AT[Math.min(5, r)];
    else if (from < 4) for (let i = 1; i <= 3; i++) { if (old[`${slot}_s${i}`]) st = i; }
    else { const lr = old[`${slot}_look`] || 0; st = lr ? lr + (n.t === 'fusion' ? 1 : 0) : 0; }
    if (!r || slot.startsWith('f_')) continue;   // 융합은 진화에서 다시 (지금은 버린다)
    const lv = Math.min(SKM_MAX, Math.max(2 * (r - 1) + 1, st * 10));
    S.skm[sk] = Math.max(S.skm[sk] || 0, SKM_NEED[SKM_GRADE(slot)][lv - 1]);
    if (!s.got.includes(slot)) s.got.push(slot);
  }
  s.rk = {}; s.camp = {}; s.log = [];
  if (from > 1 || Object.keys(old).length) s.moved = 'skm';
}
