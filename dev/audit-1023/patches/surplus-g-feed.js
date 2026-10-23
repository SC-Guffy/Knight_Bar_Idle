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
