// 추천안 묶음 (docs/specs/currency-surplus-1023.md): G-A 탑 소탕 8 + 층/5 · G-B Lv20 위 1권 = +5 (Lv29 까지) · H-A 판매 강화석 6등급 90 · 7등급 150 · 🔮 마력석 5 → 4
//  쓰는 법: node dev/currency-bot.js --patch dev/audit-1023/patches/surplus-rec.js · lifespan-bot: --eval "$(cat dev/audit-1023/patches/surplus-rec.js)"
var GEM_AMT = 4;
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
// 안 G-B 📖 비전서: Lv20 위로도 바치기 — 1권 = 경험치 +TOME_HI (Lv20 까지는 +20 그대로), Lv FEED_TOP 까지만 (★★★ Lv30 은 써야 온다)
//  docs/specs/currency-surplus-1023.md · 쓰는 법: node dev/currency-bot.js --patch dev/audit-1023/patches/surplus-g-feed.js
//  lifespan-bot: --eval "$(cat dev/audit-1023/patches/surplus-g-feed.js)"
var TOME_HI = typeof TOME_HI === 'number' ? TOME_HI : 5, FEED_TOP = typeof FEED_TOP === 'number' ? FEED_TOP : 29;
function skmFeedSplit(sk) {   // [Lv20 까지 권 수, Lv20~FEED_TOP 권 수]
  const need = SKM_NEED[skmGrade(sk)], x = skmXp(sk), cap = need[SKM_TOME_CAP - 1], top = need[FEED_TOP - 1];
  const lo = Math.max(0, Math.ceil((cap - x) / SKM_TOME));
  const hi = Math.max(0, Math.ceil((top - Math.max(x + lo * SKM_TOME, cap)) / TOME_HI));
  return [lo, hi];
}
function skmFeedMax(sk) { const [lo, hi] = skmFeedSplit(sk); return lo + hi; }
function skmFeed(sk, n) {
  const [lo, hi] = skmFeedSplit(sk), use = Math.min(n, S.tomes || 0, lo + hi);
  if (use <= 0) return 0;
  S.tomes -= use;
  const a = Math.min(use, lo);
  skmGain(sk, a * SKM_TOME + (use - a) * TOME_HI);
  return use;
}
// 안 H-A 💠 강화석·💎 마력석 수급 줄이기 (+30 까지 📜 보호 주문서와 같이 묶이게)
//  - 판매 강화석 GEAR_STONES 6등급 150 → STONE6 (기본 90) · 7등급 400 → STONE7 (기본 150). 0~5등급은 그대로
//  - 원정 골동품 🔮 빛바랜 보석 마력석 CURIOS.gem.amt 5 → GEM_AMT (기본 5 = 그대로, 추천안 surplus-rec.js 는 4)
//  docs/specs/currency-surplus-1023.md · 쓰는 법: node dev/currency-bot.js --patch dev/audit-1023/patches/surplus-h-stones.js
//  lifespan-bot: --eval "$(cat dev/audit-1023/patches/surplus-h-stones.js)"   (값을 바꾸려면 앞에 "var STONE7 = 100;" 처럼 붙인다)
var STONE6 = typeof STONE6 === 'number' ? STONE6 : 90, STONE7 = typeof STONE7 === 'number' ? STONE7 : 150, GEM_AMT = typeof GEM_AMT === 'number' ? GEM_AMT : 5;
GEAR_STONES[6] = STONE6;
GEAR_STONES[7] = STONE7;
CURIOS.gem.amt = GEM_AMT;
