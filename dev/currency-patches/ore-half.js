// 제안 ① 🪨 대장간 시설 철광석 ×ORE_K (기본 0.5) — 시설 3종이 대장간 건물 한 레벨의 약 1.7배를 먹어 건물을 막는다
var ORE_K = typeof ORE_K === 'number' ? ORE_K : 0.5;
const _ffOre = forgeFacCost;
forgeFacCost = function (id, lv) { const c = _ffOre(id, lv); c.ore = Math.floor(c.ore * ORE_K); return c; };
