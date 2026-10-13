'use strict';
// 🏰 성벽 지키기 난이도 시뮬 (개발용). 봇 곡선(server/bot-curve.json, 계열 12개)의 최고 스테이지별 능력치로
// castle.js 의 간이 웨이브 시뮬(castleSimRun)을 돌려 계열마다 막을 수 있는 단계(한계 단계)를 찍는다.
//  node dev/castle-sim.js [--best 40,60,80,100,120,140,160,180,200] [--ups 0|10] [--stars 0..5]
// 수용 기준 (castle-defense.md): 업그레이드 0 · 최고 100 줄의 한계 단계가 계열 모두 28~42, 최고−최저 8 이하. 업그레이드 전부 Lv10 · 최고 200 줄 85~95.
// 처치 속도: 봇 곡선 줄의 능력치로 dpsOf 와 같은 식(평타 + 스킬, cd·dur·mult). 광역: 무기 targets (+원거리 splash 1) + 스킬 몫 0.5.
const fs = require('fs'), path = require('path');
const { makeGame } = require('./progress-bot');
const vm = require('vm');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BESTS = arg('best', '40,60,80,100,120,140,160,180,200').split(',').map(Number);
const curve = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'server', 'bot-curve.json'), 'utf8'));
const ctx = makeGame();
const G = vm.runInContext('({ castleSimRun, castleLimitLv, CASTLE_UP_IDS, CLASSES, WEAPONS })', ctx);
const col = (row, k) => row[curve.cols.indexOf(k)];

// 봇 곡선 줄 하나 → 시뮬 입력
function inputOf(row, up, stars) {
  const atk = col(row, 'atk'), crit = col(row, 'crit'), cm = col(row, 'critMult'), aspd = col(row, 'aspd');
  const perHit = atk * (1 + crit * (cm - 1));
  let busy = 0, extra = 0;
  for (const k of col(row, 'skills') || []) { busy += k.dur / k.cd; extra += (k.crit ? atk * cm : perHit) * k.mult / k.cd; }
  const dps = perHit * col(row, 'shots') * col(row, 'shotMult') * aspd * Math.max(0.3, 1 - busy) + extra;
  const w = G.WEAPONS[G.CLASSES[col(row, 'cls')].weapon];
  const aoe = Math.max(1, w.targets || 1) + (w.kind === 'ranged' && w.splash ? 1 : 0) + 0.5;
  const maxHp = col(row, 'maxHp');
  return { dps, atk, maxHp, guard: col(row, 'guard'), heal: col(row, 'heal') * maxHp * aspd, range: col(row, 'range'), aoe, up, stars };
}
// 그 최고 스테이지에 가장 가까운(넘지 않는) 줄
const rowAt = (lines, B) => lines.filter((r) => col(r, 'best') <= B).pop() || lines[0];

function table(upLv, starN) {
  const up = Object.fromEntries(G.CASTLE_UP_IDS.map((id) => [id, upLv]));
  const stars = starN ? [starN, starN, starN, starN, starN] : [];
  const out = {};
  console.log(`\n업그레이드 Lv${upLv}${starN ? ` · 교관 별 ${starN}×5` : ''} — 계열별 한계 단계 (내 최고 스테이지 B 줄)`);
  console.log(['계열'.padEnd(16), ...BESTS.map((b) => String(b).padStart(5))].join(''));
  for (const [line, rows] of Object.entries(curve.lines)) {
    const cells = BESTS.map((B) => {
      const r = rowAt(rows, B);
      if (col(r, 'best') < B - 15) return null;      // 곡선이 그 스테이지까지 안 닿음
      return G.castleLimitLv({ ...inputOf(r, up, stars) });
    });
    out[line] = cells;
    console.log([line.padEnd(16), ...cells.map((c) => String(c == null ? '-' : c).padStart(5))].join(''));
  }
  const sum = BESTS.map((B, i) => { const v = Object.values(out).map((c) => c[i]).filter((x) => x != null); return v.length ? { min: Math.min(...v), max: Math.max(...v), med: v.sort((a, b) => a - b)[v.length >> 1] } : null; });
  console.log(['최저/중앙/최고'.padEnd(16), ...sum.map((s) => (s ? `${s.min}/${s.med}/${s.max}` : '-').padStart(12))].join(''));
  console.log(`기대 (B−31.5)/2: ${BESTS.map((B) => ((B - 31.5) / 2).toFixed(0)).join(' ')}`);
  return { out, sum };
}

const ups = arg('ups');
if (ups != null) table(Number(ups), Number(arg('stars', 0)));
else { table(0, 0); table(10, 0); }
