'use strict';
// 직업·룬 밸런스 시험 패치 (docs/specs/class-balance-1023.md). src/ 를 고치지 않고, 파일을 읽을 때 글자 바꾸기로 덮어쓴다.
//  PATCH=D,E,J,N node dev/audit-1023/class/sum.js     (빈 값 = 지금 코드)
//  이 파일을 다른 실험 스크립트보다 먼저 require 해야 한다 (fs.readFileSync 를 감싼다 — progress-bot makeGame·rt.js 모두 이걸로 src 를 읽는다)
//  수치 바꿔 보기 (기본값 = 스펙 제안값): QI_CH=4.5 QI_TP=8.5 QI_GM=8 MODS='tempest.atk=3.5,grandmaster.atk=2.95' ZEN_K=1.12 ZEN_CS=1.2 ZEN_BOT=30 SS_ATK=1.5 SS_ASPD=1.85 N_FR=0.95 N_MY=0.9 N_RE=0.9 N_RED=1 N_FRV=0.04 N_MYS=0.3
const fs = require('fs');
const E = process.env;
const want = (E.PATCH || '').split(',').map((s) => s.trim()).filter(Boolean);
const has = (n) => want.includes(n) || want.includes(n[0]);
const num = (k, d) => (E[k] != null && E[k] !== '' ? Number(E[k]) : d);

// 패치 하나 = [파일 끝 이름, 바꿀 글, 새 글]. 바꿀 글이 정확히 한 번 나와야 한다 (아니면 멈춤)
const P = {
  // ── D. 파이터: 기 게이지 회계 + 충전량 ──
  // D1 dpsOf: 주 기술은 기 게이지 하나를 나눠 쓴다 → 등가 쿨대로 쓰면 초당 드는 기가 충전 속도를 넘는다. 넘친 배수만큼 주 기술 쿨을 늘려 센다
  D1: [
    ['src/core.js',
      `function dpsOf(st) {
  const perHit = st.atk * (1 + st.crit * (st.critMult - 1));
  let busy = 0, extra = 0;
  for (const id of st.skills || []) {
    const k = heroSkill(id);
    const cd = skillCd(id), cp = skillRight(id, 'crit');`,
      `function qiMainScale(list) {
  if (!isQiCls(S.cls)) return 1;
  const r = qiRateOf(S.cls, qiStats(), S.level);
  let use = 0;
  for (const id of list) if (SKILLS[id].qi && qiIsMain(id, S.cls)) use += qiNeedOf(id) / skillCd(id);
  return r > 0 ? Math.max(1, use / r) : 1;
}
function dpsOf(st) {
  const perHit = st.atk * (1 + st.crit * (st.critMult - 1));
  let busy = 0, extra = 0;
  const qs = qiMainScale(st.skills || []);
  for (const id of st.skills || []) {
    const k = heroSkill(id);
    const cd = skillCd(id) * (SKILLS[id].qi && qiIsMain(id, S.cls) ? qs : 1), cp = skillRight(id, 'crit');`],
    // 기 소모량·문턱 (실제 게이지·서버가 쓰는 값). D2 가 없으면 지금처럼 숙련·트리 쿨 배수를 안 본다
    ['src/core.js', `const qiStats = () =>`, `const qiNeedOf = (id) => qiCostOf(SKILLS[id], S.cls, t7Has(id) ? {} : skillBonus(id))${has('D2') ? ' * (t7Has(id) ? t7Cd(id) : 1)' : ''};
const qiStats = () =>`],
  ],
  // D2 시즌7 숙련(Lv 마다 쿨 −0.8%)·트리·무한 룬의 쿨 배수(t7Cd)를 기 소모량·문턱에도 — 지금은 dpsOf 의 등가 쿨에만 걸리고 실제 게이지(원정)·서버(결투·레이드)엔 안 걸린다
  D2: [
    ['src/jobs/fighter.js', `const qiNeed = (id) => qiCostOf(SKILLS[id], S.cls, skillBonus(id));`,
      `const qiNeed = (id) => qiCostOf(SKILLS[id], S.cls, skillBonus(id)) * (t7Has(id) ? t7Cd(id) : 1);`],
    ['src/core.js', `[qiIsMain(id, S.cls) ? 'cost' : 'need']: qiCostOf(SKILLS[id], S.cls, skillBonus(id)),`,
      `[qiIsMain(id, S.cls) ? 'cost' : 'need']: Math.round(qiCostOf(SKILLS[id], S.cls, skillBonus(id)) * (t7Has(id) ? t7Cd(id) : 1) * 10) / 10,`],
  ],
  // D4 기 게이지가 가득일 때 넘치는 기는 투지 칸으로 (주 기술을 하나도 안 끼우면 투지 기술이 영영 안 나가던 것 — 챔피언 b 진화 장착 [궁극기·진화(투지)·붕권·투지·원투])
  D4: [
    ['src/jobs/fighter.js', `  const q = qiSt();
  q.v = Math.min(QI[S.cls].max, q.v + n * (q.aw > 0 ? QI_AWAKEN.mult : 1));`, `  const q = qiSt(), add = n * (q.aw > 0 ? QI_AWAKEN.mult : 1), over = Math.min(add, q.v + add - QI[S.cls].max);
  q.v = Math.min(QI[S.cls].max, q.v + add);
  if (over > 0) for (const o in q.tj) q.tj[o] += over;`],
    ['server/duel.js', `  q.v = Math.min(Q.max, q.v + n * (Q.awaken && t < q.aw ? Q.awaken.mult : 1));`, `  const add = n * (Q.awaken && t < q.aw ? Q.awaken.mult : 1), over = Math.min(add, q.v + add - Q.max);
  q.v = Math.min(Q.max, q.v + add);
  if (over > 0) for (const o of me.skills) if (o.need) o.tj += over;`],
  ],
  // D3 기 충전량 (3차만): 챔피언 평타 2.5 → QI_CH · 템페스트 평타 5.8 → QI_TP · 그랜드마스터 초당 5 → QI_GM
  D3: [
    ['src/fighter-data.js', `champion:    { shape: 'bar', max: 100, hit: 2.5,`, `champion:    { shape: 'bar', max: 100, hit: ${num('QI_CH', 4.5)},`],
    ['src/fighter-data.js', `tempest:     { ...QI_KICK, hit: 5.8,`, `tempest:     { ...QI_KICK, hit: ${num('QI_TP', 8.5)},`],
    ['src/fighter-data.js', `grandmaster: { ...QI_QIGONG, main:`, `grandmaster: { ...QI_QIGONG, perSec: ${num('QI_GM', 8)}, main:`],
  ],
  // D5 직업 mods 덮어쓰기 (MODS="tempest.atk=3.5,grandmaster.qi.hit=3" — 점 앞이 직업, 뒤가 mods 키. qi.키 는 기 규칙: "grandmaster.qi.hit=3")
  D5: [['src/fighter-data.js', `const SHEET_CLASSES = [`, `${(E.MODS != null ? E.MODS : 'tempest.atk=3.5,grandmaster.atk=2.95').split(',').filter(Boolean).map((x) => { const [k, v] = x.split('='); const [c, ...r] = k.split('.'); return r[0] === 'qi' ? `__QI_SET.push(['${c}', '${r[1]}', ${Number(v)}]);` : `CLASSES['${c}'].mods['${r[0]}'] = ${Number(v)};`; }).join('\n')}
const SHEET_CLASSES = [`], ['src/fighter-data.js', `const QI_AWAKEN = {`, `for (const [c, k, v] of __QI_SET) QI[c][k] = v;
const QI_AWAKEN = {`], ['src/fighter-data.js', `'use strict';`, `'use strict';\nvar __QI_SET = [];`]],
  // ── E. 무념: 고정 ×1.9 → 그 기사의 치명 기대값 × ZEN_K (확정 치명 스킬에 끼우면 × ZEN_CS 더) ──
  E: [
    ['src/tree7.js', `else if (r.id === 'zen') { m.stat.atkMul = (m.stat.atkMul || 1) * (SKILLS[sk] && SKILLS[sk].crit ? 2.6 : 1.9); m.stat.noCrit = 1; }`,
      `else if (r.id === 'zen') { m.stat.zen = SKILLS[sk] && SKILLS[sk].crit ? ${num('ZEN_CS', 1.2)} : 1; m.stat.noCrit = 1; }`],
    ['src/tree7.js', `  st.crit = s.noCrit ? 0 : Math.min(0.8, st.crit + (s.crit || 0));`,
      `  if (s.zen) st.atk *= s.zen * ${num('ZEN_K', 1.12)} * (1 + Math.min(0.8, st.crit + (s.crit || 0)) * (st.critMult - 1));
  st.crit = s.noCrit ? 0 : Math.min(0.8, st.crit + (s.crit || 0));`],
    ['src/rune.js', `zen: 2 };`, `zen: ${num('ZEN_BOT', 30)} };`],
  ],
  // ── J. 검신: 공격력 1.7 → SS_ATK · 공속 2.2 → SS_ASPD ──
  J: [['src/classes.js', `mods: { atk: 1.7, hp: 1.87, aspd: 2.2, crit: 0.28, critMult: 0.8, guard: 0.15 },`,
    `mods: { atk: ${num('SS_ATK', 1.5)}, hp: 1.87, aspd: ${num('SS_ASPD', 1.85)}, crit: 0.28, critMult: 0.8, guard: 0.15 },`]],
  // ── N. 룬 오프라인 반영 + 공허궁 ──
  // N1 오프라인 여러 마리 ×1.25 는 한 발이 여러 마리를 같이 때리는 무기만 (공허궁은 4발을 나눠 쏴서 합이 같다)
  N1: [['src/core.js', `(st.targets > 1 ? 1.25 : 1)`, `(st.targets > 1 && !(st.shots > 1) ? 1.25 : 1)`]],
  // N2 광란·만검·월광 대가 줄이기 — 실시간에서도 빈 칸보다 손해였다 (rune-rt.js). N_FR 광란 평타 −15% → · N_MY 만검 다른 스킬 −20% → · N_RE 월광 평타 −20% →, N_RED 월광 오프라인 평균 0.9 →
  N2: [
    ['src/tree7.js', `skRule('frenzy', sk); m.basic *= 0.85; m.basicDps *= 1.02; }`, `skRule('frenzy', sk); m.basic *= ${num('N_FR', 0.95)}; m.basicDps *= 1.02; }`],
    ['src/tree7.js', `m.ev[sk] = (m.ev[sk] || 1) * 1.25; m.powNot.push({ sk, v: 0.8 }); }`, `m.ev[sk] = (m.ev[sk] || 1) * 1.25; m.powNot.push({ sk, v: ${num('N_MY', 0.9)} }); }`],
    ['src/tree7.js', `m.stat.rangeMul = 3; m.basic *= 0.8; m.basicDps *= 0.9; }`, `m.stat.rangeMul = 3; m.basic *= ${num('N_RE', 0.9)}; m.basicDps *= ${num('N_RED', 1)}; }`],
  ],
  // N3 광란·만검 실시간 이득 키우기: 광란 겹당 공속 +4% → N_FRV · 만검 맞힐 때마다 다른 스킬 쿨 −0.3초 → N_MYS
  N3: [
    ['src/tree7-fx.js', `knight.haste = { left: 3, v: 0.04 * knight.frenzy };`, `knight.haste = { left: 3, v: ${num('N_FRV', 0.04)} * knight.frenzy };`],
    ['src/tree7-fx.js', `knight.cds[o] = Math.max(0, knight.cds[o] - 0.3);   // 전설 룬`, `knight.cds[o] = Math.max(0, knight.cds[o] - ${num('N_MYS', 0.3)});   // 전설 룬`],
  ],
};
P.D = [...P.D1, ...P.D2, ...P.D4, ...P.D3, ...P.D5];
P.N = [...P.N1, ...P.N2];

const list = [];
for (const w of want) { if (!P[w]) throw new Error('모르는 패치 ' + w); for (const x of P[w]) if (!list.includes(x)) list.push(x); }
const hit = new Map(list.map((x) => [x, 0]));
const orig = fs.readFileSync;
fs.readFileSync = function (f, ...a) {
  let s = orig.call(this, f, ...a);
  if (typeof s !== 'string' || typeof f !== 'string') return s;
  for (const x of list) {
    if (!f.endsWith(x[0])) continue;
    const n = s.split(x[1]).length - 1;
    if (n !== 1) throw new Error(`패치 글이 ${x[0]} 에 ${n}번 나옴: ${x[1].slice(0, 60)}`);
    s = s.replace(x[1], () => x[2]);
    hit.set(x, hit.get(x) + 1);
  }
  return s;
};
module.exports = { want, hit, P };
