// 안 G-A 📖 비전서: 탑 소탕·입장 보장 비전서를 '최고 층 수' → TW_A + 최고 층 / TW_B (반올림, 최고 층보다 많이 주지 않음)
//  docs/specs/currency-surplus-1023.md · 쓰는 법: node dev/currency-bot.js --patch dev/audit-1023/patches/surplus-g-tower.js
var TW_A = typeof TW_A === 'number' ? TW_A : 8, TW_B = typeof TW_B === 'number' ? TW_B : 5;
function towerSweepTomes(best = S.tower.best) { return best > 0 ? Math.min(best, Math.round(TW_A + best / TW_B)) : 0; }
function sweepTower() {
  if (!towerSweepReady()) return 0;
  useTowerTicket();
  const n = towerSweepTomes();
  S.tomes += n;
  return n;
}
// 도전 입장의 '먼저 받는 소탕분'도 같은 식 (startTower 의 base) — 봇은 소탕만 쓰지만 실제 규칙과 맞춰 둔다
const _stG = startTower;
startTower = function () {
  const b = S.tower.best, t0 = S.tomes, ok = _stG();
  if (ok) { const base = towerSweepTomes(b); S.tomes = t0 + base; S.tower.run.tomes = base; S.tower.run.base = base; }
  return ok;
};
