'use strict';
// 스킬 연계 시안 시뮬레이터 (docs/specs/skill-combo.md) — 검토 페이지(dev/review/skill-combo.html)와 node 둘 다에서 쓴다.
//   node dev/review/skill-combo-sim.js   15줄기 대표 장착으로 연계율·피해 증가를 표로
// 보스 한 마리와 계속 붙어 있는 교전을 가정한다 (평타는 스킬 사이에 끼어도 스킬을 막지 않는다고 본다).
const COMBO_RULE = { win: 2, wait: 1, bonus: 0.2, strict: true };   // strict: 장착 순서상 바로 다음 칸이 이어 나갈 때만 연계 (궁극기는 순서 밖이라 앞뒤 어디든)
// 꼬리표: rush 돌진 · single 단일 · area 광역 · shot 투사체 · zone 장판 · buff 강화
const TAGS = {
  rush: { ic: '⚔️', n: '돌진' }, single: { ic: '🎯', n: '단일' }, area: { ic: '🌀', n: '광역' },
  shot: { ic: '➶', n: '투사체' }, zone: { ic: '🔥', n: '장판' }, buff: { ic: '✨', n: '강화' },
};
// 합동기: [앞, 뒤] → 이름 · 보스전 기대 배율(ev, 연계 +20% 포함) · 설명. 앞이 '*' 면 아무거나
const JOINTS = [
  { a: 'rush', b: 'single', id: 'chase', n: '추격', ev: 1.4, d: '대상 앞으로 순간이동, 확정 치명 (연계 +20% 대신)' },
  { a: 'area', b: 'area', id: 'chain', n: '연쇄', ev: 1.2, d: '연계 +20% · 범위 +30%' },
  { a: 'shot', b: 'shot', id: 'focus', n: '집중', ev: 1.4, d: '모든 발이 앞 스킬이 맞힌 적을 노린다 · 연계 +20% 에 피해 +20%' },
  { a: 'zone', b: 'rush', id: 'burst', n: '폭발 돌파', ev: 1.35, d: '돌진이 장판을 지나며 터뜨린다: 앞 장판 피해의 30% 를 한 번에 · 연계 +20%' },
  { a: 'buff', b: '*', id: 'charge', n: '충전', ev: 1.4, d: '강화가 끝나고 바로 쓴 스킬 피해 +40% (연계 +20% 대신)' },
  { a: 'single', b: 'area', id: 'shard', n: '파편', ev: 1.2, d: '연계 +20% · 앞 스킬에 맞은 적이 터져 둘레에 그 피해의 50% (보스 혼자면 0)' },
];
const jointOf = (ta, tb) => JOINTS.find((j) => j.a === ta && (j.b === tb || j.b === '*')) || null;

// skills: [{ id, name, tag, cd, dur, ult? }] — 궁극기는 순서 밖(준비되면 맨 먼저), 나머지는 장착 순서
// rule: { win, wait, bonus } · wait 0 이면 기다리지 않는다 (지금 규칙: 준비된 것 중 앞 칸부터)
function simCombo(skills, sec = 600, rule = COMBO_RULE, opt = {}) {
  const dt = 0.05, ord = skills.filter((s) => !s.ult), ult = skills.find((s) => s.ult);
  const cd = Object.fromEntries(skills.map((s, i) => [s.id, opt.offset ? (i * 1.3) % s.cd : 0]));
  let t = 0, busyTo = 0, lastEnd = -99, last = null, lastIdx = -1;
  const log = [], stat = { casts: 0, combos: 0, pair: {}, joint: {}, dmg0: 0, dmg1: 0, waits: 0, waitT: 0 };
  let waiting = false;
  while (t < sec) {
    for (const s of skills) cd[s.id] -= dt;
    if (t >= busyTo) {
      let pick = null;
      if (ult && cd[ult.id] <= 0) pick = ult;
      else if (ord.length) {
        const nx = ord[(lastIdx + 1) % ord.length];
        if (cd[nx.id] <= 0) pick = nx;
        else if (rule.wait > 0 && last && cd[nx.id] <= rule.wait && t - lastEnd + cd[nx.id] <= rule.win) { if (!waiting) stat.waits++; waiting = true; stat.waitT += dt; }
        else pick = ord.find((s) => cd[s.id] <= 0) || null;
      }
      if (pick) {
        waiting = false;
        const inOrder = !rule.strict || !last || last.ult || pick.ult || ord.indexOf(pick) === (lastIdx + 1) % ord.length;
        const combo = !!last && t - lastEnd <= rule.win && inOrder;
        const j = combo ? jointOf(last.tag, pick.tag) : null;
        const mul = !combo ? 1 : j ? j.ev : 1 + rule.bonus;
        const base = pick.cd;   // 한 번 시전 피해 ∝ 쿨 (스킬마다 초당 피해가 비슷하게 맞춰져 있다고 본다)
        stat.casts++; stat.dmg0 += base; stat.dmg1 += base * mul;
        if (combo) {
          stat.combos++;
          const key = `${last.id}>${pick.id}`;
          stat.pair[key] = (stat.pair[key] || 0) + 1;
          if (j) stat.joint[j.id] = (stat.joint[j.id] || 0) + 1;
        }
        if (log.length < 400) log.push({ id: pick.id, t0: t, t1: t + pick.dur, combo, joint: j ? j.id : null, gap: last ? t - lastEnd : null });
        cd[pick.id] = pick.cd; busyTo = t + pick.dur; lastEnd = busyTo; last = pick;
        if (!pick.ult) lastIdx = ord.indexOf(pick);
      }
    }
    t += dt;
  }
  stat.rate = stat.casts ? stat.combos / stat.casts : 0;
  stat.perMin = stat.combos / (sec / 60);
  stat.uplift = stat.dmg0 ? stat.dmg1 / stat.dmg0 - 1 : 0;
  stat.castsPerMin = stat.casts / (sec / 60);
  return { stat, log };
}

if (typeof module !== 'undefined') module.exports = { COMBO_RULE, TAGS, JOINTS, jointOf, simCombo };
if (typeof window !== 'undefined') Object.assign(window, { COMBO_RULE, TAGS, JOINTS, jointOf, simCombo });
