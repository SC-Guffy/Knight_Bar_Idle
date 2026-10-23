'use strict';
// 스킬 룬 — 줍는 변형 (docs/specs/skill-runes.md, 스킬 재기획 2단계 · 숙련 src/skm.js 와 한 릴리스)
//  룬 = { id, g } 효과 하나 + 등급 (0 일반 · 1 고급 · 2 희귀 · 3 영웅 · 4 전설). 어느 스킬에나 끼운다.
//  범용 룬 14 = SPEC_TYPES 효과 (영웅 값 = 옛 고유 특수 다 찍은 값, 낮은 등급 ×0.4·0.6·0.8) · 모양 룬 4 (희귀·영웅) · 전설 7 = 옛 키스톤 (대가 포함)
//  룬 칸: 숙련 ★ 에 1칸 · ★★★ 에 2칸. 캠프에서 무료로 끼우고 뺀다. 같은 룬(id)은 한 스킬에 하나, 전설은 한 스킬에 하나, 같은 전설은 하나만 효과
//  얻기: 원정 상자 덤 (상자 등급 = 룬 등급, 영웅까지) · 전설은 레이드 상자 · 탑 10층 첫 돌파 · 영웅 3개 합치기
// 세이브: S.runes = [{ id, g }] 주머니 · S.t7.rs = { 스킬 id: [{ id, g }] } 끼운 것

const RUNE_GM = [0.4, 0.6, 0.8, 1.0];   // 일반~영웅 값 배수 (영웅 = 1)
const RUNE_BAG_MAX = 60;
const RUNE_BOX = [0.03, 0.06, 0.12, 0.25];   // 원정 상자를 열 때 룬 덤 확률 (낡은·나무·철제·보물상자)
const RUNE_RAID_LEG = 0.08;                  // 레이드 상자(승리)에서 전설 룬
const RUNE_TINT = 0.3;                       // 끼운 룬 색을 시전 색에 섞는 정도
// 범용 룬: type = SPEC_TYPES 종류 · v 영웅 값 · tag 보스 벽 꼬리표 (shield 보호막 · adds 졸개 · enrage 광폭화) · col 룬 색
const RUNE_DEF = {
  exec: { n: '처형', icon: '🗡️', type: 'exec', v: 0.6, thr: 0.3, tag: 'enrage', col: '#e0504a' },
  boss: { n: '거인 사냥', icon: '👑', type: 'boss', v: 0.6, tag: 'enrage', col: '#d8a030' },
  first: { n: '선봉', icon: '🚩', type: 'first', v: 0.7, col: '#e0d080' },
  solo: { n: '일기토', icon: '⚖️', type: 'solo', v: 0.6, col: '#c0c8e0' },
  crowd: { n: '겁화', icon: '🔥', type: 'crowd', v: 0.5, tag: 'adds', col: '#ff8a30' },
  dot: { n: '출혈', icon: '🩸', type: 'dot', v: 0.45, dur: 3, tag: 'shield', col: '#b0203a' },
  double: { n: '과부하', icon: '⚡', type: 'double', v: 0.3, col: '#f0e060' },
  stack: { n: '가속', icon: '🌀', type: 'stack', v: 0.5, col: '#60d0c0' },
  vuln: { n: '약점', icon: '💢', type: 'vuln', v: 0.3, dur: 4, col: '#a060e0' },
  refund: { n: '재장전', icon: '🔁', type: 'refund', v: 0.15, tag: 'adds', col: '#80c0ff' },
  haste: { n: '속사', icon: '💨', type: 'haste', v: 0.4, dur: 4, tag: 'shield', col: '#a0e0a0' },
  chain: { n: '연결', icon: '✨', type: 'chain', v: 0.3, col: '#fff0a0' },
  range: { n: '확장', icon: '↔️', type: 'range', v: 0.5, tag: 'adds', col: '#80d8ff' },
  overkill: { n: '관통', icon: '➡️', type: 'overkill', v: 0.5, tag: 'adds', col: '#c0a0ff' },
  // 모양 룬 (희귀·영웅만): 이 스킬 타격에 덧타격 — t7Shape (src/tree7.js)
  twin: { n: '한 번 더', icon: '⚔️', shape: 'twin', v: 0.6, tag: 'shield', col: '#e8e8f0', d: '가장 센 타가 0.15초 뒤 한 번 더' },
  after: { n: '잔상', icon: '👻', shape: 'after', v: 0.5, tag: 'shield', col: '#9090c0', d: '0.5초 뒤 잔상이 전체 타격을 한 번 더' },
  burst: { n: '파열', icon: '💥', shape: 'burst', v: 0.5, tag: 'adds', col: '#ffb060', d: '타격마다 맞은 자리에서 작은 폭발 (반경 60)' },
  more: { n: '난무', icon: '🌪️', shape: 'more', v: 3, tag: 'shield', col: '#d0f0ff', d: '작은 타가 늘어난다 (타당 −15%)' },
};
const RUNE_SHAPES = ['twin', 'after', 'burst', 'more'];
const RUNE_GENERIC = Object.keys(RUNE_DEF).filter((id) => !RUNE_DEF[id].shape);
// 전설 룬 = 옛 키스톤 (node: 이름·글을 가져올 트리 노드 — 줄기마다 이름이 다르다) · scope: all 기사 전체 / sk 끼운 스킬
const RUNE_LEG = {
  blade: { node: 'k_blade', icon: '🕰️', scope: 'all', col: '#dfe6f0', d: '평타 3타마다 모든 스킬 쿨 −0.5초', cost: '스킬 피해 −10%' },
  frenzy: { node: 'a_key', icon: '🔥', scope: 'sk', col: '#ff6a6a', d: '이 스킬이 맞힐 때마다 공속 +4% 겹침 (최대 10, 3초)', cost: '평타 피해 −15%' },
  endless: { node: 'a_k3', icon: '♾️', scope: 'sk', col: '#ffe08a', d: '이 스킬이 끝나면 30% 로 쿨 없이 한 번 더', cost: '이 스킬 쿨 +25%' },
  echo: { node: 'b_reset', icon: '👤', scope: 'sk', col: '#9a8fb0', d: '이 스킬로 처치하면 잔상이 가장 가까운 적을 50% 로', cost: '' },
  myriad: { node: 'k_k3', icon: '🗡️', scope: 'sk', col: '#9fd8ff', d: '이 스킬이 맞힐 때마다 다른 스킬 쿨 −0.3초', cost: '다른 스킬 피해 −20%' },
  reach: { node: 'k_key', icon: '🌙', scope: 'all', col: '#9fd8ff', d: '평타 사거리 ×3 (원거리 330 까지)', cost: '평타 피해 −20%' },
  zen: { node: 'b_k3', icon: '☯️', scope: 'all', col: '#f4f0ff', d: '모든 피해 ×(내 치명 기대값 × 1.12) (확정 치명 스킬에 끼우면 ×1.2 더)', cost: '치명 확률 0' },
};
const RUNE_LEG_IDS = Object.keys(RUNE_LEG);
const runeIsLeg = (r) => r.g >= 4;
// 이름·아이콘·색 (전설은 줄기 글 — src/tree7-ui.js t7U)
const runeName = (r) => (runeIsLeg(r) ? (typeof t7U === 'function' ? t7U(RUNE_LEG[r.id].node).n : r.id) : RUNE_DEF[r.id].n);
const runeIcon = (r) => (runeIsLeg(r) ? RUNE_LEG[r.id].icon : RUNE_DEF[r.id].icon);
// 32×32 룬석 그림 (src/skin/runes.png ← dev/rune-icons/build.py, docs/specs/rune-icons.md): 범용·모양 18칸 다음 전설 7칸. 테두리 = 등급 색
const RUNE_CELLS = [...Object.keys(RUNE_DEF), ...RUNE_LEG_IDS.map((id) => 'L-' + id)];
const runeArt = (r) => `<i class="rn${runeIsLeg(r) ? ' leg' : ''}" style="background-position:-${RUNE_CELLS.indexOf(runeIsLeg(r) ? 'L-' + r.id : r.id) * 32}px 0;--gc:${GRADES[r.g].color}"></i>`;
const runeCol = (r) => (runeIsLeg(r) ? RUNE_LEG[r.id].col : RUNE_DEF[r.id].col);
const runeTag = (r) => (runeIsLeg(r) ? null : RUNE_DEF[r.id].tag || null);
// 지금 등급의 값 (범용·모양)
const runeVal = (r) => RUNE_DEF[r.id].v * RUNE_GM[Math.min(3, r.g)];
const runePct = (x) => Math.round(x * 100) + "%";
// 효과 한 줄
function runeText(r) {
  if (runeIsLeg(r)) { const L = RUNE_LEG[r.id]; return `${L.d}${L.cost ? ` · 대가: ${L.cost}` : ''}`; }
  const D = RUNE_DEF[r.id], v = runeVal(r);
  if (D.shape === 'more') return `작은 타 +${Math.max(1, Math.round(v))} (타당 −15%)`;
  if (D.shape) return `${D.d} (${runePct(v)})`;
  return SPEC_TYPES[D.type].desc(v, D);
}

// ── 주머니 · 칸 ──
const runeBag = () => (S.runes = S.runes || []);
const runeSocks = () => { const s = t7S(); return (s.rs = s.rs || {}); };
const runesOf = (sk) => runeSocks()[sk] || [];
// 룬 칸 수: 숙련 ★ 1 · ★★★ 2
const runeCap = (sk) => { const st = typeof skmStage === 'function' ? skmStage(sk) : 0; return st >= 3 ? 2 : st >= 1 ? 1 : 0; };
// 끼울 수 있나 (글: 못 끼우는 이유 또는 null)
function runeWhy(sk, r) {
  const on = runesOf(sk);
  if (on.length >= runeCap(sk)) return runeCap(sk) ? '룬 칸이 다 찼어요' : '숙련 ★ 에 룬 칸이 열려요';
  if (on.some((x) => x.id === r.id && runeIsLeg(x) === runeIsLeg(r))) return '같은 룬은 한 스킬에 하나';
  if (runeIsLeg(r) && on.some(runeIsLeg)) return '전설 룬은 한 스킬에 하나';
  return null;
}
// 주머니 i 번째 룬을 스킬에 끼운다
function runeSocket(sk, i) {
  const bag = runeBag(), r = bag[i];
  if (!r || runeWhy(sk, r)) return false;
  bag.splice(i, 1);
  (runeSocks()[sk] = runesOf(sk).slice()).push(r);
  return true;
}
// 스킬의 j 번째 룬을 뺀다 → 주머니로
function runeUnsock(sk, j) {
  const on = runesOf(sk).slice(), r = on[j];
  if (!r) return false;
  on.splice(j, 1);
  runeSocks()[sk] = on;
  runeBag().push(r);
  return true;
}
// 숙련이 줄 일은 없지만, 칸보다 많이 끼워져 있으면(옛 세이브) 남는 것을 주머니로
function runeFit() {
  const socks = runeSocks();
  for (const [sk, on] of Object.entries(socks)) while (on.length > runeCap(sk)) runeBag().push(on.pop());
}

// ── 얻기 · 합치기 ──
// 등급 g 의 무작위 룬 (모양 룬은 희귀부터, 전설은 RUNE_LEG 에서)
function runeRoll(g) {
  if (g >= 4) return { id: RUNE_LEG_IDS[Math.floor(Math.random() * RUNE_LEG_IDS.length)], g: 4 };
  const pool = g >= 2 ? Object.keys(RUNE_DEF) : RUNE_GENERIC;
  return { id: pool[Math.floor(Math.random() * pool.length)], g };
}
// 주머니에 넣는다 (넘치면 낮은 등급부터 자동 합치기 → 그래도 넘치면 false)
function runeAdd(r) {
  const bag = runeBag();
  if (bag.length >= RUNE_BAG_MAX) runeAutoMerge();
  if (bag.length >= RUNE_BAG_MAX) return false;
  bag.push(r);
  return true;
}
// 합칠 수 있는 묶음: [{ id, g, n }] — 같은 id·같은 등급(일반~영웅) 3개 이상
function runeMergeable() {
  const m = {};
  for (const r of runeBag()) if (r.g < 4) { const k = r.id + ':' + r.g; m[k] = (m[k] || 0) + 1; }
  return Object.entries(m).filter(([, n]) => n >= 3).map(([k, n]) => ({ id: k.split(':')[0], g: +k.split(':')[1], n }));
}
// 같은 룬 3개 → 한 등급 위 (영웅 3개 → 전설 하나 무작위). 새 룬을 돌려준다
function runeMerge(id, g) {
  const bag = runeBag(), idx = [];
  bag.forEach((r, i) => { if (r.id === id && r.g === g && idx.length < 3) idx.push(i); });
  if (idx.length < 3 || g >= 4) return null;
  for (const i of idx.reverse()) bag.splice(i, 1);
  const out = g === 3 ? runeRoll(4) : { id, g: g + 1 };
  bag.push(out);
  return out;
}
function runeAutoMerge() { for (let k = 0; k < 40; k++) { const m = runeMergeable().sort((a, b) => a.g - b.g)[0]; if (!m || !runeMerge(m.id, m.g)) break; } }

// ── 효과 (src/tree7.js t7Mods·t7Shape·t7Counter, src/core.js skillSpecs, src/skills.js 시전 색) ──
// 효과가 켜진 스킬 = 장착(또는 궁극기) 스킬에 끼운 룬만
const runeLive = () => { if (!t7On()) return {}; const live = {}; for (const sk of t7Skills()) live[sk] = runesOf(sk); return live; };
// 이 스킬의 고유 특수 목록 (범용 룬) — SPEC_TYPES 효과 { type, v, thr, dur, icon, name }
function runeSpecs(sk) {
  return runesOf(sk).filter((r) => !runeIsLeg(r) && RUNE_DEF[r.id].type).map((r) => { const D = RUNE_DEF[r.id]; return { type: D.type, v: runeVal(r), thr: D.thr, dur: D.dur, icon: D.icon, name: D.n }; });
}
// 이 스킬의 모양 룬 [{ shape, v }]
const runeShapes = (sk) => runesOf(sk).filter((r) => !runeIsLeg(r) && RUNE_DEF[r.id].shape).map((r) => ({ shape: RUNE_DEF[r.id].shape, v: runeVal(r) }));
// 이 스킬 시전 색에 섞을 룬 색 (가장 높은 등급)
function runeTint(sk) { const on = runesOf(sk).slice().sort((a, b) => b.g - a.g)[0]; return on ? runeCol(on) : null; }
// 장착 스킬에 끼운 꼬리표 (보스 벽 대응)
const runeTags = () => { const t = new Set(); for (const on of Object.values(runeLive())) for (const r of on) { const g = runeTag(r); if (g) t.add(g); } return t; };

// 옛 0.28 트리의 변형·키스톤 → 룬 지급 (src/skm.js skmMigrate). 변형 = 영웅 범용/모양 룬 · 키스톤 = 전설
const RUNE_FROM_NODE = { s_twin: 'twin', k_wave: 'burst', a_more: 'more', a_bleed: 'dot', a_follow: 'range', a_grow: 'range', b_reset: 'overkill', b_exec: 'exec', b_after: 'after', b_triple: 'after',
  k_pierce: 'overkill', k_split: 'burst', k_homing: 'boss', b_key: 'exec',
  k_blade: 'L:blade', a_key: 'L:frenzy', a_k3: 'L:endless', b_k3: 'L:zen', k_key: 'L:reach', k_k3: 'L:myriad' };
function runeFromOld(old) {
  for (const [node, to] of Object.entries(RUNE_FROM_NODE)) if (old[node]) runeAdd(to.startsWith('L:') ? { id: to.slice(2), g: 4 } : { id: to, g: 3 });
}

// 봇·측정 (dev/lifespan-bot.js via t7AutoSpend): 합칠 수 있으면 합치고, 장착 스킬의 룬을 모두 빼서 가장 좋은 조합으로 다시 끼운다
//  점수: 등급 × 10 (+ 빌드 꼬리표 2). 전설은 이 스킬에만 걸리고 대가가 작은 것(무한·잔영)만 높게, 기사 전체에 대가가 붙는 것(무념·검의 길·심검·만검귀종·광란)은 낮게
const RUNE_BOT_LEG = { endless: 33, echo: 32, frenzy: 12, myriad: 8, blade: 6, reach: 4, zen: 30 };
function runeAutoFill(tag) {
  runeAutoMerge();
  const eq = t7Skills();
  for (const sk of eq) while (runesOf(sk).length) runeUnsock(sk, 0);
  for (const sk of eq) for (let k = 0; k < 2 && runesOf(sk).length < runeCap(sk); k++) {
    const best = runeBag().map((r, i) => ({ r, i, sc: runeIsLeg(r) ? RUNE_BOT_LEG[r.id] || 0 : r.g * 10 + (tag && runeTag(r) === tag ? 2 : 0) })).filter((x) => !runeWhy(sk, x.r)).sort((a, b) => b.sc - a.sc)[0];
    if (!best || !runeSocket(sk, best.i)) break;
  }
}
