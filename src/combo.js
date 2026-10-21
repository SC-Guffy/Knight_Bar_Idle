'use strict';
// 스킬 연계 — 시전 순서 퍼즐 (docs/specs/skill-combo.md, 스킬 재기획 3단계 · 0.30.0 진화와 한 릴리스)
//  장착 순서 = 시전 순서 (돌고 돈다). 앞 스킬 시전이 끝나고 2초 안에 장착 순서상 "바로 다음 칸" 스킬이 나가면 연계 → 이번 시전 +20%.
//  궁극기는 순서 밖 — 준비되면 먼저, 앞·뒤 어느 칸과도 연계. 다음 칸이 1초 안에 준비되면 기다렸다 잇는다 (파이터 기 계열은 기다리지 않는다).
//  꼬리표 짝이 맞으면 합동기 6가지 (추격·연쇄·집중·폭발 돌파·충전·파편). 기록 S.combo 는 4단계 진화(src/evolve.js)가 읽는다.
//  오프라인·결투·레이드는 시간을 돌리지 않아 평균 배율 comboEv (지금 장착·쿨로 600초 시뮬) → core.js skillEv 에 곱한다 (서버 변경 없음).
// 이 파일은 rune.js 다음에 불러온다. 꼬리표 시안: dev/review/skill-combo-tags.js (검토 페이지)

const COMBO_RULE = { win: 2, wait: 1, bonus: 0.2 };
// 꼬리표: rush 돌진 · single 단일 · area 광역 · shot 투사체 · zone 장판 · buff 강화
const COMBO_TAG = { rush: { ic: '⚔️', n: '돌진' }, single: { ic: '🎯', n: '단일' }, area: { ic: '🌀', n: '광역' }, shot: { ic: '➶', n: '투사체' }, zone: { ic: '🔥', n: '장판' }, buff: { ic: '✨', n: '강화' } };
// 15줄기 × 8칸 (칸 이름: slash · gale · iaido · wave · whirl · flash · storm · ult). 진화 스킬(f_*)은 바탕 스킬(t7base) 칸의 꼬리표
const COMBO_TAGS = {
  swordsaint:     { slash: 'single', gale: 'area',   iaido: 'rush',   wave: 'shot', whirl: 'zone', flash: 'rush',   storm: 'area', ult: 'area' },
  tyrant:         { slash: 'single', gale: 'rush',   iaido: 'area',   wave: 'shot', whirl: 'zone', flash: 'rush',   storm: 'area', ult: 'area' },
  archon:         { slash: 'single', gale: 'buff',   iaido: 'single', wave: 'shot', whirl: 'zone', flash: 'area',   storm: 'area', ult: 'area' },
  skyGeneral:     { slash: 'single', gale: 'buff',   iaido: 'rush',   wave: 'shot', whirl: 'zone', flash: 'rush',   storm: 'area', ult: 'area' },
  dragonlord:     { slash: 'single', gale: 'zone',   iaido: 'rush',   wave: 'shot', whirl: 'zone', flash: 'shot',   storm: 'area', ult: 'area' },
  warlord:        { slash: 'single', gale: 'area',   iaido: 'rush',   wave: 'shot', whirl: 'zone', flash: 'zone',   storm: 'area', ult: 'area' },
  siegeMaster:    { slash: 'single', gale: 'shot',   iaido: 'area',   wave: 'shot', whirl: 'zone', flash: 'shot',   storm: 'area', ult: 'shot' },
  deadeye:        { slash: 'single', gale: 'shot',   iaido: 'single', wave: 'shot', whirl: 'zone', flash: 'single', storm: 'area', ult: 'shot' },
  voidArcher:     { slash: 'single', gale: 'zone',   iaido: 'shot',   wave: 'shot', whirl: 'zone', flash: 'area',   storm: 'area', ult: 'area' },
  thunderEmperor: { slash: 'single', gale: 'area',   iaido: 'zone',   wave: 'shot', whirl: 'zone', flash: 'single', storm: 'area', ult: 'area' },
  archmage:       { slash: 'single', gale: 'zone',   iaido: 'area',   wave: 'shot', whirl: 'zone', flash: 'shot',   storm: 'area', ult: 'zone' },
  frostlord:      { slash: 'single', gale: 'zone',   iaido: 'shot',   wave: 'shot', whirl: 'zone', flash: 'shot',   storm: 'area', ult: 'zone' },
  champion:       { slash: 'single', gale: 'rush',   iaido: 'single', wave: 'shot', whirl: 'zone', flash: 'shot',   storm: 'area', ult: 'area' },
  tempest:        { slash: 'single', gale: 'area',   iaido: 'rush',   wave: 'shot', whirl: 'zone', flash: 'rush',   storm: 'area', ult: 'area' },
  grandmaster:    { slash: 'single', gale: 'buff',   iaido: 'shot',   wave: 'shot', whirl: 'zone', flash: 'shot',   storm: 'area', ult: 'area' },
};
// 합동기: [앞 꼬리표, 뒤 꼬리표('*' 아무거나)] — mul 이번 시전 배율 (연계 +20% 포함) · crit 확정 치명 · range 범위 + · burst/shard 덧피해
const COMBO_JOINTS = [
  { a: 'rush', b: 'single', id: 'chase', n: '추격', mul: 1, crit: 1, ev: 1.4 },
  { a: 'area', b: 'area', id: 'chain', n: '연쇄', mul: 1.2, range: 0.3, ev: 1.2 },
  { a: 'shot', b: 'shot', id: 'focus', n: '집중', mul: 1.44, ev: 1.4 },
  { a: 'zone', b: 'rush', id: 'burst', n: '폭발 돌파', mul: 1.2, burst: 0.3, ev: 1.35 },
  { a: 'buff', b: '*', id: 'charge', n: '충전', mul: 1.4, ev: 1.4 },
  { a: 'single', b: 'area', id: 'shard', n: '파편', mul: 1.2, shard: 0.5, ev: 1.2 },
];
const comboJointOf = (ta, tb) => (ta && tb ? COMBO_JOINTS.find((j) => j.a === ta && (j.b === tb || j.b === '*')) || null : null);
// 스킬 → 꼬리표 (지금 줄기)
function comboTag(sk) {
  const L = typeof t7L === 'function' ? t7L() : null;
  if (!L || !sk) return null;
  let slot = L.slotOf[sk];
  if (slot && slot.startsWith('f_') && SKILLS[sk] && SKILLS[sk].t7base) slot = L.slotOf[SKILLS[sk].t7base] || slot;
  const T = COMBO_TAGS[L.id];
  return (T && slot && T[slot]) || null;
}
const comboOn = () => typeof t7On === 'function' && t7On();
const comboS = () => (S.combo = S.combo || { n: 0, p: {}, j: {} });
// 장착 순서 (궁극기 빼고)
const comboOrd = () => (comboOn() ? t7Skills().filter((sk) => !(SKILLS[sk] && SKILLS[sk].ult)) : []);
const comboNextOf = (sk, ord = comboOrd()) => { if (!ord.length) return null; const i = ord.indexOf(sk); return ord[(i + 1) % ord.length]; };

// ── 실제 전투 (src/skills.js tryCastSkill) ──
// 지금 연계 상태: knight.cmb = { sk 앞 스킬, end 끝난 시각(clock), pow 한 타 평균 배율, tot 시전 합, hit [맞힌 적] } — 세이브하지 않는다
// 개발 확인용 로그: 콘솔에서 window.COMBO_LOG = [] 를 넣으면 시전·연계·기다림이 쌓인다 (스펙 수용 기준)
const comboLog = (e) => { if (typeof window !== 'undefined' && Array.isArray(window.COMBO_LOG)) window.COMBO_LOG.push({ t: +clock.toFixed(2), ...e }); };
// 시전 고르기 순서: 궁극기 → 다음 칸 → (다음 칸이 1초 안이면 기다림 = 빈 목록) → 나머지 앞 칸부터
function comboPickOrder(list, only) {
  if (!comboOn() || only || (typeof qiOn === 'function' && qiOn())) return list;
  const ult = list.filter((sk) => SKILLS[sk] && SKILLS[sk].ult), ord = comboOrd(), last = knight.cmb;
  if (!ord.length) return list;
  const nx = last && ord.includes(last.sk) ? comboNextOf(last.sk, ord) : ord[0];
  const ultReady = ult.some((sk) => !(knight.cds[sk] > 0));
  const cdNx = knight.cds[nx] || 0;
  if (!ultReady && cdNx > 0 && last && cdNx <= COMBO_RULE.wait && clock - last.end + cdNx <= COMBO_RULE.win) { if (!knight.comboWait) comboLog({ wait: nx, cd: +cdNx.toFixed(2) }); knight.comboWait = true; return []; }   // 기다렸다 잇는다 (평타·이동은 그대로)
  knight.comboWait = false;
  return [...ult, nx, ...ord.filter((sk) => sk !== nx)].filter((sk, i, a) => a.indexOf(sk) === i && list.includes(sk));
}
// 시전을 시작할 때: 연계면 이번 시전 효과를 돌려주고 기록·글자 (아니면 null)
function comboStart(sk, focus) {
  if (!comboOn()) return null;
  const last = knight.cmb, isUlt = (x) => SKILLS[x] && SKILLS[x].ult;
  if (!last || last.sk === sk || clock - last.end > COMBO_RULE.win || (!isUlt(sk) && !isUlt(last.sk) && comboNextOf(last.sk) !== sk)) { knight.comboChain = 1; comboLog({ cast: sk, combo: false }); return null; }   // 바로 다음 칸만 (궁극기 앞뒤는 어디든)
  const j = comboJointOf(comboTag(last.sk), comboTag(sk));
  const c = comboS(), key = `${last.sk}>${sk}`;
  c.n++; c.p[key] = (c.p[key] || 0) + 1;
  if (j) c.j[j.id] = (c.j[j.id] || 0) + 1;
  knight.comboChain = (knight.comboChain || 1) + 1;
  comboLog({ cast: sk, combo: key, joint: j ? j.id : null, gap: +(clock - last.end).toFixed(2) });
  // 작은 떠오르는 글자 (연출 등급표: 1·2차는 12px 글자 + 국소 효과만)
  const tag = j ? `${COMBO_TAG[j.a] ? COMBO_TAG[j.a].ic : ''}${COMBO_TAG[j.b] ? COMBO_TAG[j.b].ic : '✦'} ${j.n}` : `🔗 연계${knight.comboChain >= 3 ? ` ×${knight.comboChain}` : ''}`;
  addFloater(tag, toScreen(knight.x), groundY() - 96, j ? '#ffe9a8' : '#bfe9ff', 12);
  // 덧피해: 폭발 돌파 = 앞 장판 한 타의 30% 를 대상에 · 파편 = 앞 스킬에 맞은 적(최대 3)이 터져 둘레 60px 에 50%
  if (j && j.burst && focus && last.tot) hitMonster(focus, last.tot * j.burst, { nocrit: true, kb: 6, color: '#ffb060' });
  if (j && j.shard && last.pow) for (const m0 of (last.hit || []).slice(0, 3)) {
    if (!m0 || m0.dying) continue;
    for (const m of monsters) if (m !== m0 && !m.dying && m.hp > 0 && Math.abs(m.x - m0.x) <= 60) hitMonster(m, last.pow * j.shard, { nocrit: true, kb: 4, color: '#ffd0a0' });
  }
  return { mul: j ? j.mul : 1 + COMBO_RULE.bonus, crit: !!(j && j.crit), range: (j && j.range) || 0, joint: j ? j.id : null };
}
// 타격 기록 (onHit): 맞힌 적 · 한 타 배율
function comboHit(a, list, mult) {
  if (!comboOn()) return;
  a.cmbHit = a.cmbHit || []; a.cmbPow = a.cmbPow || [];
  for (const m of list) if (!a.cmbHit.includes(m)) a.cmbHit.push(m);
  a.cmbPow.push(mult);
}
// 시전이 끝날 때 (onEnd): 다음 연계의 기준
function comboEnd(sk, a) {
  if (!comboOn()) return;
  const pw = (a && a.cmbPow) || [];
  const tot = pw.reduce((x, y) => x + y, 0);
  knight.cmb = { sk, end: clock, pow: pw.length ? tot / pw.length : 0, tot, hit: (a && a.cmbHit) || [] };   // pow 한 타 평균 · tot 한 번 시전 합
}
// 교전이 끝나면(걷기) 사슬도 끊긴다 — 2초 창이 알아서 끊으니 사슬 수만
function comboTick() { if (knight.cmb && clock - knight.cmb.end > COMBO_RULE.win) knight.comboChain = 1; }

// ── 평균 배율 (오프라인 · 결투 · 레이드 · 전투력) ──
// 지금 장착·쿨·시전 시간으로 600초 시뮬 두 번(연계 규칙 / 연계 없음) → 스킬마다 피해 비, 짝·합동기 분당 수
let comboCacheKey = '', comboCacheVal = null;
function comboSim(skills, rule, sec = 600) {
  const dt = 0.05, ord = skills.filter((s) => !s.ult), ult = skills.find((s) => s.ult);
  const cd = Object.fromEntries(skills.map((s) => [s.id, 0])), per = Object.fromEntries(skills.map((s) => [s.id, 0])), pair = {}, joint = {};
  let t = 0, busyTo = 0, lastEnd = -99, last = null, lastIdx = -1, combos = 0;
  while (t < sec) {
    for (const s of skills) cd[s.id] -= dt;
    if (t >= busyTo) {
      let pick = null;
      if (ult && cd[ult.id] <= 0) pick = ult;
      else if (ord.length) {
        const nx = ord[(lastIdx + 1) % ord.length];
        if (cd[nx.id] <= 0) pick = nx;
        else if (rule.wait > 0 && last && cd[nx.id] <= rule.wait && t - lastEnd + cd[nx.id] <= rule.win) pick = null;
        else pick = ord.find((s) => cd[s.id] <= 0) || null;
      }
      if (pick) {
        const inOrder = !last || last.ult || pick.ult || ord.indexOf(pick) === (lastIdx + 1) % ord.length;
        const combo = rule.bonus > 0 && !!last && last !== pick && t - lastEnd <= rule.win && inOrder;
        const j = combo ? comboJointOf(last.tag, pick.tag) : null;
        per[pick.id] += pick.cd * (!combo ? 1 : j ? j.ev : 1 + rule.bonus);
        if (combo) { combos++; const key = `${last.id}>${pick.id}`; pair[key] = (pair[key] || 0) + 1; if (j) joint[j.id] = (joint[j.id] || 0) + 1; }
        cd[pick.id] = pick.cd; busyTo = t + pick.dur; lastEnd = busyTo; last = pick;
        if (!pick.ult) lastIdx = ord.indexOf(pick);
      }
    }
    t += dt;
  }
  const m = sec / 60;
  for (const k in pair) pair[k] /= m;
  for (const k in joint) joint[k] /= m;
  return { per, pair, joint, perMin: combos / m };
}
function comboStats() {
  if (!comboOn()) return null;
  const list = t7Skills();
  const skills = list.map((id) => ({ id, tag: comboTag(id), cd: Math.max(0.5, skillCd(id)), dur: Math.max(0.2, (SKILLS[id].dur || 0.6)), ult: !!SKILLS[id].ult }));
  const key = JSON.stringify(skills);
  if (key === comboCacheKey) return comboCacheVal;
  const on = comboSim(skills, COMBO_RULE), off = comboSim(skills, { win: 0, wait: 0, bonus: 0 });
  const ev = {};
  for (const s of skills) ev[s.id] = off.per[s.id] > 0 ? on.per[s.id] / off.per[s.id] : 1;
  const tot0 = skills.reduce((a, s) => a + off.per[s.id], 0), tot1 = skills.reduce((a, s) => a + on.per[s.id], 0);
  comboCacheKey = key;
  comboCacheVal = { ev, pair: on.pair, joint: on.joint, perMin: on.perMin, uplift: tot0 ? tot1 / tot0 - 1 : 0, rate: on.perMin };
  return comboCacheVal;
}
const comboEv = (sk) => { const c = comboStats(); return (c && c.ev[sk]) || 1; };
// 오프라인 원정 (core.js simulate): 싸운 시간만큼 짝·합동기 기록을 분당 수로 쌓는다
function comboSimFight(fight) {
  const c = comboStats();
  if (!c || !(fight > 0)) return;
  const s = comboS(), m = fight / 60;
  for (const [k, v] of Object.entries(c.pair)) { s.p[k] = (s.p[k] || 0) + v * m; s.n += v * m; }
  for (const [k, v] of Object.entries(c.joint)) s.j[k] = (s.j[k] || 0) + v * m;
}
// 원정 기록 (core.js startExpedition · 귀환 보고)
function comboTripStart(t) { if (comboOn()) t.combo0 = { n: comboS().n, p: { ...comboS().p } }; }
function comboTripLine(t) {
  if (!t || !t.combo0 || !comboOn()) return null;
  const s = comboS(), dn = Math.round(s.n - t.combo0.n);
  if (dn <= 0) return null;
  let best = null, bv = 0;
  for (const [k, v] of Object.entries(s.p)) { const d = v - (t.combo0.p[k] || 0); if (d > bv) { bv = d; best = k; } }
  return { n: dn, best, bv: Math.round(bv) };
}
