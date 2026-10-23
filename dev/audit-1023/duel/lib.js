'use strict';
// 결투 재정비 실험 공용 (docs/specs/duel-rebalance-1023.md). src/·server/ 파일은 고치지 않는다 —
//  loadDuel(over): server/duel.js 글을 읽어 상수·규칙을 바꾼 사본을 메모리에서 만든다
//  curveProfiles(files, best): 곡선 파일(dev/audit-1023/duel/bake-curve.js 결과, 또는 server/bot-curve.json)에서 계열별 프로필 (sanitizeProfile 거침)
const fs = require('fs'), path = require('path');
const R = path.resolve(__dirname, '../../..');
const DUEL_SRC = fs.readFileSync(path.join(R, 'server/duel.js'), 'utf8');
const SRC = fs.readFileSync(path.join(R, 'server/index.js'), 'utf8');
const cut = (from) => { const i = SRC.indexOf(from); const j = SRC.indexOf('\n}', i); const k = SRC.indexOf('\n};', i); return SRC.slice(i, (k > 0 && k < j ? k + 3 : j + 2)); };
const sanitizeProfile = new Function(`${cut('const num = ')}\n${cut('function sanitizeProfile')}\nreturn sanitizeProfile;`)();

// over: { START_DIST, DUEL_HP, DUEL_SEC, HP_MULT, MAX_T, WALK, fullRate: true (체력 배수에 스킬 DPS 포함),
//         rush: { at, per } (결투 광폭화: at 초부터 초당 받는 피해 +per, 직업 공통), noMult: true (결투 배율 끔) }
function loadDuel(over = {}) {
  let s = DUEL_SRC;
  for (const k of ['START_DIST', 'DUEL_HP', 'DUEL_SEC', 'HP_MULT', 'MAX_T', 'WALK']) {
    if (over[k] == null) continue;
    const re = new RegExp(`const ${k} = [^;]+;`);
    if (!re.test(s)) throw new Error('없는 상수 ' + k);
    s = s.replace(re, `const ${k} = ${over[k]};`);
  }
  if (over.fullRate) {
    // 체력 배수 기준 DPS 에 스킬(쿨타임 평균)까지 넣는다 — 평타만 보던 DUEL_SEC 을 '전체 DPS 로 이 초 버팀' 으로
    s = s.replace('const rateOf = (p) => p.atk * (1 + p.crit * (p.critMult - 1)) * p.shots * p.shotMult * p.aspd;',
      `const rateOf = (p) => { const c = 1 + p.crit * (p.critMult - 1), b = p.atk * c * p.shots * p.shotMult * p.aspd;
  let busy = 0, sk = 0; for (const k of p.skills || []) { const cd = Math.max(1, k.cd || 10); busy += (k.dur || 0) / cd; sk += p.atk * k.mult * (k.crit ? p.critMult : 1 + Math.min(0.8, p.crit + (k.cp || 0)) * (p.critMult - 1)) / cd; }
  return b * Math.max(0.3, 1 - busy) + sk * ${over.skillW == null ? 1 : over.skillW}; };`);
  }
  if (over.rush) {
    const { at, per } = over.rush;
    s = s.replace('* (1 - op.p.guard) * wardCut(op, t);', `* (1 - op.p.guard) * wardCut(op, t) * (t > ${at} ? 1 + (t - ${at}) * ${per} : 1);`);
  }
  if (over.wardFirst) {
    // 보호막(ward) 스킬의 첫 준비를 개전 wardFirst 초 뒤로 (직업 공통 결투 규칙). 파이터 투지 보호막(기막)은 투지 칸을 비우고 시작
    const X = over.wardFirst;
    s = s.replace('({ ...s, left: 0.3 + i * 1.5,', `({ ...s, left: s.ward ? Math.max(${X}, 0.3 + i * 1.5) : 0.3 + i * 1.5,`);
    s = s.replace('  if (r < 1) for (const s of me.skills) if (s.need) s.tj = s.need * r;', '  if (r < 1) for (const s of me.skills) if (s.need) s.tj = s.need * r;\n  for (const s of me.skills) if (s.need && s.ward) s.tj = 0;');
  }
  if (over.wardScale != null) s = s.replace('guard: sk.ward.guard,', `guard: sk.ward.guard * ${over.wardScale},`);
  if (over.noMult) s = s.replace('if (pa.duel) pa =', 'if (false) pa =').replace('if (pb.duel) pb =', 'if (false) pb =');
  const m = { exports: {} };
  new Function('module', 'exports', 'require', s)(m, m.exports, require);
  return m.exports;
}

// 곡선 한 벌에서 계열 line 의 최고 스테이지 best 프로필 (server/bots.js curveAt 과 같은 보간 — 로그 보간 atk·maxHp·power, 나머지는 아래 줄)
function makeCurveAt(curve) {
  const COL = Object.fromEntries(curve.cols.map((c, i) => [c, i]));
  const lerpLog = (a, b, t) => (a > 0 && b > 0 ? Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t) : a + (b - a) * t);
  return (line, best) => {
    const rows = curve.lines[line], v = (r, c) => r[COL[c]];
    let lo = rows[0], hi = rows[0], t = 0;
    for (let i = 1; i < rows.length; i++) if (v(rows[i], 'best') > best) { lo = rows[i - 1]; hi = rows[i]; t = Math.max(0, (best - v(lo, 'best')) / Math.max(1, v(hi, 'best') - v(lo, 'best'))); break; }
    if (best >= v(rows[rows.length - 1], 'best')) { lo = hi = rows[rows.length - 1]; t = 0; }
    const p = {
      cls: v(lo, 'cls'), level: Math.round(v(lo, 'level') + (v(hi, 'level') - v(lo, 'level')) * t), best,
      atk: lerpLog(v(lo, 'atk'), v(hi, 'atk'), t), maxHp: lerpLog(v(lo, 'maxHp'), v(hi, 'maxHp'), t), power: lerpLog(v(lo, 'power'), v(hi, 'power'), t),
      aspd: v(lo, 'aspd'), crit: v(lo, 'crit'), critMult: v(lo, 'critMult'), range: v(lo, 'range'), shots: v(lo, 'shots'), shotMult: v(lo, 'shotMult'),
      guard: v(lo, 'guard'), heal: v(lo, 'heal'), leap: null, skills: v(lo, 'skills').map((s) => ({ ...s })), gc: 1,
      ...(v(lo, 'qi') ? { qi: { ...v(lo, 'qi') } } : {}),
    };
    if (COL.duel != null) { p.t7 = 1; if (v(lo, 'duel') !== 1) p.duel = v(lo, 'duel'); p.build = v(lo, 'build'); }
    const sp = sanitizeProfile(p);
    sp.build = p.build || '-';
    sp.power = p.power;
    return sp;
  };
}
const loadCurve = (f) => JSON.parse(fs.readFileSync(path.resolve(f), 'utf8'));
const LINES = ['tyrant', 'skyGeneral', 'siegeMaster', 'thunderEmperor', 'archon', 'swordsaint', 'dragonlord', 'warlord', 'deadeye', 'voidArcher', 'archmage', 'frostlord', 'champion', 'tempest', 'grandmaster'];
const MELEE = (p) => p.range < 100;

// 전투력 정규화: 공격력·체력에 같은 배수 → 모두 그 스테이지 기하 평균 전투력 (dev/duel-balance.js 와 같음)
function normalize(ps) {
  const avg = Math.exp(ps.reduce((a, p) => a + Math.log(p.power), 0) / ps.length);
  return ps.map((p) => { const g = avg / p.power; return { ...p, atk: p.atk * g, maxHp: p.maxHp * g, power: avg }; });
}

// 리그: profs = [{ line, b, p }] — 다른 줄기끼리 N 판씩. mult: 줄기별 결투 배율 (없으면 p.duel 그대로, noMult 면 1)
function league(D, profs, { N = 30, mult = null, seed0 = 1 } = {}) {
  const win = {}, games = {}, bw = {}, bg = {};
  const durs = []; let to = 0, mr = 0, mn = 0; const pair = {};
  let seed = seed0;
  for (const A of profs) for (const B of profs) {
    if (A.line === B.line) continue;
    const pa = mult ? { ...A.p, duel: mult[A.line] } : A.p, pb = mult ? { ...B.p, duel: mult[B.line] } : B.p;
    for (let k = 0; k < N; k++) {
      const r = D.simulateDuel(pa, pb, seed++);
      const W = r.winner === 'a' ? A : B;
      win[W.line] = (win[W.line] || 0) + 1; games[A.line] = (games[A.line] || 0) + 1; games[B.line] = (games[B.line] || 0) + 1;
      const kb = (X) => X.line + '/' + X.b;
      bw[kb(W)] = (bw[kb(W)] || 0) + 1; bg[kb(A)] = (bg[kb(A)] || 0) + 1; bg[kb(B)] = (bg[kb(B)] || 0) + 1;
      durs.push(r.dur); if (r.timeout) to++;
      const pk = [A.line, B.line].sort().join('-'); (pair[pk] = pair[pk] || []).push(r.dur);
      if (MELEE(A.p) !== MELEE(B.p)) { mn++; if (MELEE(W.p)) mr++; }
    }
  }
  durs.sort((x, y) => x - y);
  const n = durs.length, wr = {};
  for (const l of Object.keys(games)) wr[l] = (win[l] || 0) / games[l];
  const bwr = {}; for (const k of Object.keys(bg)) bwr[k] = (bw[k] || 0) / bg[k];
  const pd = Object.entries(pair).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]).sort((a, b) => b[1] - a[1]);
  return { wr, bwr, melee: mn ? mr / mn : null, mean: durs.reduce((a, b) => a + b, 0) / n, p10: durs[n * 0.1 | 0], p50: durs[n / 2 | 0], p90: durs[n * 0.9 | 0],
    lt3: durs.filter((d) => d < 3).length / n, timeout: to / n, longest: pd.slice(0, 3), n };
}

// 줄기별 배율을 승률 50% 쪽으로 (dev/duel-league.js --fit 과 같은 곱셈 갱신). sets: [{ profs, D }] (스테이지별) 의 평균 승률로
function fit(sets, lines, { rounds = 8, N = 12, lo = 0.3, hi = 3, start = null } = {}) {
  const mult = Object.fromEntries(lines.map((l) => [l, start ? start[l] : 1]));
  for (let r = 0; r < rounds; r++) {
    const acc = Object.fromEntries(lines.map((l) => [l, 0]));
    for (const { D, profs } of sets) { const res = league(D, profs, { N, mult }); for (const l of lines) acc[l] += res.wr[l] / sets.length; }
    for (const l of lines) mult[l] = Math.min(hi, Math.max(lo, mult[l] * Math.pow(0.5 / Math.max(0.02, acc[l]), 0.6)));
  }
  return mult;
}

const pct = (x) => (x == null ? '  -' : (x * 100).toFixed(0).padStart(3));
module.exports = { loadDuel, makeCurveAt, loadCurve, sanitizeProfile, LINES, MELEE, normalize, league, fit, pct, R };
