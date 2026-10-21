'use strict';
// 연계 규칙 변형별로 15줄기 × 대표 장착 × 모든 장착 순서를 돌려 연계율·스킬 피해 증가 폭을 본다 (docs/specs/skill-combo.md "시뮬레이션")
//   node dev/review/skill-combo-run.js            규칙 변형 비교 (요약)
//   node dev/review/skill-combo-run.js --lines    채택 규칙으로 줄기별 표
const { simCombo, COMBO_RULE } = require('./skill-combo-sim.js');
const { COMBO_TAGS } = require('./skill-combo-tags.js');
const DATA = require('./skill-combo-data.js');
const CDM = 1 - 0.008 * 19;   // 숙련 Lv20 쿨
const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
const SETS = [['slash', 'gale'], ['slash', 'gale', 'iaido'], ['gale', 'iaido', 'wave', 'whirl'], ['iaido', 'flash', 'storm', 'wave']];
const get = (line, slot) => { const k = DATA[line].sk[slot]; return { id: slot, name: k.name, tag: COMBO_TAGS[line][slot], cd: k.cd * CDM, dur: k.dur, ult: slot === 'ult' }; };
function spread(line, set, rule) {
  const r = perms(set).map((p) => { const s = [...(set.length >= 4 ? [get(line, 'ult')] : []), ...p.map((x) => get(line, x))]; const st = simCombo(s, 1200, rule).stat; return { o: p, u: st.uplift, rate: st.rate, pm: st.perMin }; });
  r.sort((a, b) => a.u - b.u);
  return { lo: r[0], hi: r[r.length - 1], mid: r[r.length >> 1] };
}
const pc = (x) => `${(x * 100).toFixed(0)}%`;
if (process.argv.includes('--lines')) {
  const rows = {};
  for (const line of Object.keys(COMBO_TAGS)) rows[line] = SETS.map((set) => { const s = spread(line, set, COMBO_RULE); return { set, lo: s.lo.u, hi: s.hi.u, rlo: s.lo.rate, rhi: s.hi.rate, pm: s.hi.pm, best: s.hi.o, worst: s.lo.o }; });
  console.log(JSON.stringify(rows));
} else {
  const RULES = {
    '아무 스킬이나 2초 (순서 무관)': { win: 2, wait: 1, bonus: 0.2, strict: false },
    '다음 칸만 2초 + 1초 기다림 (채택 시안)': { win: 2, wait: 1, bonus: 0.2, strict: true },
    '다음 칸만 2초, 기다림 없음': { win: 2, wait: 0, bonus: 0.2, strict: true },
    '다음 칸만 1초 + 1초 기다림': { win: 1, wait: 1, bonus: 0.2, strict: true },
  };
  for (const [n, rule] of Object.entries(RULES)) {
    const by = SETS.map(() => ({ lo: 0, hi: 0, gap: 0, rate: 0 }));
    const lines = Object.keys(COMBO_TAGS);
    for (const line of lines) SETS.forEach((set, i) => { const s = spread(line, set, rule); by[i].lo += s.lo.u / lines.length; by[i].hi += s.hi.u / lines.length; by[i].gap = Math.max(by[i].gap, s.hi.u - s.lo.u); by[i].rate += s.mid.rate / lines.length; });
    console.log(n);
    SETS.forEach((set, i) => console.log(`  ${set.length}칸${set.length >= 4 ? '+궁' : ''} 평균 피해 +${pc(by[i].lo)}~+${pc(by[i].hi)} · 순서 차이 최대 ${pc(by[i].gap)}p · 연계율 ${pc(by[i].rate)}`));
  }
}
