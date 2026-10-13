'use strict';
// 🎓 교관 승부 (2차 훈련 ★5) — 교관의 전투 프로필. 규칙은 src/mentor.js, 스펙은 docs/specs/training-mentors.md.
// 교관 = 내 레벨·내 계열의 '기준 기사'(server/bot-curve.json — 진행 봇이 원정·레이드·강화·건설·훈련·전직·숙련도를 골고루 한 기사) × 배수 k.
//  거울 대결이라 직업 상성이 없다 — 이기고 지는 건 "내 레벨에서 장비·강화·숙련도·교관 별을 기준보다 잘 갖췄는가" 뿐.
//  (교관마다 정한 계열로 싸우게 했더니 상성 때문에 어떤 계열은 2주 내내 첫 교관을 못 넘었다 — 10-13 봇 시뮬)
// k 는 dev/mentor-sim.js 로 맞춘다: 기준 기사 본인이 교관과 싸웠을 때 계열 12개 평균 승률이 win 이 되게.
// 순서·id 는 src/data.js MENTORS 와 같아야 한다.
const { curveAtLevel } = require('./bots');
const CURVE = require('./bot-curve.json');

// win: 기준 기사 본인의 목표 승률 (교관이 뒤로 갈수록 더 잘 갖춰야 한다)
const MENTOR_DUEL = [
  { id: 'sword',  win: 0.55 },
  { id: 'shield', win: 0.50 },
  { id: 'hunter', win: 0.45 },
  { id: 'brute',  win: 0.40 },
  { id: 'sage',   win: 0.35 },
];
// 직업 → 기준 곡선 계열: 그 직업을 거쳐 가는 첫 계열 (표의 cls 칸으로 찾는다). 모르는 직업이면 첫 계열
const CLS_COL = CURVE.cols.indexOf('cls');
const lineOfCls = {};
for (const [line, rows] of Object.entries(CURVE.lines)) for (const r of rows) if (!(r[CLS_COL] in lineOfCls)) lineOfCls[r[CLS_COL]] = line;
const lineFor = (cls) => lineOfCls[cls] || Object.keys(CURVE.lines)[0];
// 배수 k: 계열마다·교관마다 레벨별 [[레벨, k], …] (server/mentor-k.json — node dev/mentor-sim.js --table 로 굽는다, 봇 곡선을 다시 구우면 같이 다시).
//  계열마다 따로인 까닭: 같은 배수라도 한 방이 큰 계열은 승률이 확 꺾여서(빙결군주 1% · 검성 12%) 계열별로 목표 승률에 맞춘다.
//  다른 콘텐츠의 직업 밸런스는 건드리지 않는다 — 그 계열의 '기준 기사'에 대한 교관 세기만 맞추는 것
const MENTOR_K = require('./mentor-k.json');
const kAt = (i, level, line) => {
  const t = (MENTOR_K[line] || {})[MENTOR_DUEL[i].id];
  if (!t) return 1;
  if (level <= t[0][0]) return t[0][1];
  for (let j = 1; j < t.length; j++) {
    if (level <= t[j][0]) { const [l0, k0] = t[j - 1], [l1, k1] = t[j]; return Math.exp(Math.log(k0) + (Math.log(k1) - Math.log(k0)) * (level - l0) / (l1 - l0)); }
  }
  return t[t.length - 1][1];
};

// 교관 i 가 레벨 level · 직업 cls 기사를 상대할 때의 프로필 (k 를 주면 그 배수로 — 보정용)
function mentorProfile(i, level, cls, k = kAt(i, level, lineFor(cls))) {
  const p = curveAtLevel(lineFor(cls), level);
  // 공격력·체력을 둘 다 k 배 → 전투력(√(DPS×체력))도 k 배
  return { ...p, atk: p.atk * k, maxHp: p.maxHp * k, power: Math.round(p.power * k) };
}

module.exports = { MENTOR_DUEL, mentorProfile, kAt, lineFor };
