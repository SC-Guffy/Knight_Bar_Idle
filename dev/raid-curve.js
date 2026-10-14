'use strict';
// 레이드 난이도 곡선 (개발용, 밸런스 점검). AI 기사 성장 곡선(server/bot-curve.json)의 기사로 보스마다
//  혼자 · 혼자 + AI 3 · 사람 4 의 승률을 최고 스테이지별로 시뮬해, 승률 50% 가 되는 최고 스테이지와 승률이 10%→90% 로 바뀌는 폭을 찍는다.
//  docs/specs/raid-difficulty.md 의 기대 곡선 표를 다시 잴 때 쓴다.
//  node dev/raid-curve.js [--bosses lichking,flamedragon] [--seeds 4] [--bot 1]   (--bot: 혼자+AI 3 의 AI 전투력 배수, 기본 server/bots.js RAID_BOT_POWER)
const path = require('path');
const { RAID_BOSSES, simulateRaid } = require('../server/raid');
const { curveAt, RAID_BOT_POWER } = require('../server/bots');
const CURVE = require('../server/bot-curve.json');

const argv = process.argv.slice(2), opt = { bosses: null, seeds: 4, bot: RAID_BOT_POWER };
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--bosses') opt.bosses = argv[++i].split(',');
  else if (argv[i] === '--seeds') opt.seeds = Number(argv[++i]);
  else if (argv[i] === '--bot') opt.bot = Number(argv[++i]);
}
const LINES = Object.keys(CURVE.lines);
const scaled = (p, f) => ({ ...p, atk: p.atk * f, maxHp: p.maxHp * f, power: Math.round(p.power * f) });

// 최고 스테이지 best 인 기사(계열마다)가 이 구성으로 싸울 때의 승률
function winRate(boss, best, kind) {
  let win = 0, n = 0;
  LINES.forEach((line, li) => {
    const me = curveAt(line, best);
    for (let s = 0; s < opt.seeds; s++) {
      let team, party;
      if (kind === 'solo') { team = [me]; party = 1; }
      else if (kind === 'ai') { team = [me, ...[1, 2, 3].map((k) => { const p = curveAt(LINES[(li + k * 3) % LINES.length], best); return scaled(p, (me.power * opt.bot) / p.power); })]; party = 2.5; }
      else { team = [me, ...[1, 2, 3].map((k) => curveAt(LINES[(li + k * 5) % LINES.length], best))]; party = 4; }
      if (simulateRaid(boss, team, (li * 7919 + s * 104729 + best * 31) >>> 0, party).won) win++;
      n++;
    }
  });
  return win / n;
}
// 승률이 처음 p 이상이 되는 최고 스테이지 (입장 − 40 ~ + 120 에서 이분 탐색, 승률은 단조라고 본다)
function stageAt(boss, kind, p) {
  let lo = Math.max(1, RAID_BOSSES[boss].stage - 40), hi = RAID_BOSSES[boss].stage + 120;
  if (winRate(boss, hi, kind) < p) return null;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (winRate(boss, mid, kind) >= p) hi = mid; else lo = mid + 1; }
  return lo;
}
const ids = opt.bosses || Object.keys(RAID_BOSSES);
console.log('보스 (입장)'.padEnd(22) + ['혼자', '혼자+AI3', '사람4'].map((k) => k.padStart(18)).join(''));
console.log(''.padEnd(22) + ['', '', ''].map(() => '50%(+입장) 10→90%'.padStart(18)).join(''));
for (const id of ids) {
  const e = RAID_BOSSES[id].stage;
  const cells = ['solo', 'ai', 'four'].map((k) => {
    const s50 = stageAt(id, k, 0.5), s10 = stageAt(id, k, 0.1), s90 = stageAt(id, k, 0.9);
    if (s50 == null) return '-'.padStart(18);
    return `${s50}(${s50 - e >= 0 ? '+' : ''}${s50 - e}) ${s10 != null && s90 != null ? s90 - s10 : '-'}`.padStart(18);
  });
  console.log(`${id} (${e})`.padEnd(22) + cells.join(''));
}
