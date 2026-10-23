'use strict';
// 전설 룬 광란·만검·월광의 실시간 이득 대 오프라인 이득 (docs/specs/class-balance-1023.md N)
//  sum.js 를 RUNE=none|frenzy|myriad|reach 로 돌려 OUT JSON 을 만든 뒤: node dev/audit-1023/class/rune-rt.js <폴더> [접두어]
//  (4번째 장착 스킬의 마지막 룬 한 칸을 그 전설 룬으로 바꾼 것 대 그 칸을 비운 것)
const D = process.argv[2], pre = process.argv[3] || 'rune2-';
const b = require(D + '/' + pre + 'none.json').raw, L = Object.keys(b);
const g = (f) => Math.exp(L.reduce((s, l) => s + Math.log(f(l)), 0) / L.length);
for (const r of ['frenzy', 'myriad', 'reach']) {
  let x; try { x = require(D + '/' + pre + r + '.json').raw; } catch { continue; }
  console.log(r.padEnd(7), '오프라인 처치', g((l) => x[l].off / b[l].off).toFixed(3), ' 실시간 처치', g((l) => x[l].rt / b[l].rt).toFixed(3));
  console.log('   실시간 줄기별', L.map((l) => l.slice(0, 6) + ' ' + (x[l].rt / b[l].rt).toFixed(2)).join(' '));
}
