// 안 B 💎 마력석 = 전직·건설 재료: 강화·레이드 입장권에서 빼고, 건물·대장간 시설 마력석 ×MANA_K (기본 4). 💠 강화 강화석 ×STONE_K (기본 1.5)
//  재료의 미궁 마력석은 건물 비용을 따라가므로 자동으로 ×MANA_K
var MANA_K = typeof MANA_K === 'number' ? MANA_K : 4, STONE_K = typeof STONE_K === 'number' ? STONE_K : 1.5;
enhanceCost = function (L) { return { stone: Math.floor(2 * STONE_K * Math.pow(1.17, L)), mana: 0 }; };
const _tpB = ticketPrice; ticketPrice = function () { const p = _tpB(); p.mana = 0; return p; };
const _bcB = buildCost; buildCost = function (id, lv) { const c = _bcB(id, lv); c.mana = Math.floor(c.mana * MANA_K); return c; };
const _fcB = forgeFacCost; forgeFacCost = function (id, lv) { const c = _fcB(id, lv); c.mana = Math.floor(c.mana * MANA_K); return c; };
