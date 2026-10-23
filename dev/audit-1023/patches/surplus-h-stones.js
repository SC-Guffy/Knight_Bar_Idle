// 안 H-A 💠 강화석·💎 마력석 수급 줄이기 (+30 까지 📜 보호 주문서와 같이 묶이게)
//  - 판매 강화석 GEAR_STONES 6등급 150 → STONE6 (기본 90) · 7등급 400 → STONE7 (기본 150). 0~5등급은 그대로
//  - 원정 골동품 🔮 빛바랜 보석 마력석 CURIOS.gem.amt 5 → GEM_AMT (기본 5 = 그대로, 추천안 surplus-rec.js 는 4)
//  docs/specs/currency-surplus-1023.md · 쓰는 법: node dev/currency-bot.js --patch dev/audit-1023/patches/surplus-h-stones.js
//  lifespan-bot: --eval "$(cat dev/audit-1023/patches/surplus-h-stones.js)"   (값을 바꾸려면 앞에 "var STONE7 = 100;" 처럼 붙인다)
var STONE6 = typeof STONE6 === 'number' ? STONE6 : 90, STONE7 = typeof STONE7 === 'number' ? STONE7 : 150, GEM_AMT = typeof GEM_AMT === 'number' ? GEM_AMT : 5;
GEAR_STONES[6] = STONE6;
GEAR_STONES[7] = STONE7;
CURIOS.gem.amt = GEM_AMT;
