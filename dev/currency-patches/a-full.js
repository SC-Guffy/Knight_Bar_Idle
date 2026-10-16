// 제안 ① 🪨 대장간 시설 철광석 ×ORE_K (기본 0.5) — 시설 3종이 대장간 건물 한 레벨의 약 1.7배를 먹어 건물을 막는다
var ORE_K = typeof ORE_K === 'number' ? ORE_K : 0.5;
const _ffOre = forgeFacCost;
forgeFacCost = function (id, lv) { const c = _ffOre(id, lv); c.ore = Math.floor(c.ore * ORE_K); return c; };
// 안 A 💎 마력석 = 고강화(+10~) 재료: 건물·대장간 시설·레이드 입장권에서 빼고, 강화 마력석 ×MANA_K (기본 3).
//  재료의 미궁 마력석은 건물 비용 대신 (100 + 1.5·최고 스테이지)/판 (그림 비중 곱하기 전, 스테이지 200 에서 지금과 비슷). 💠 강화석 ×STONE_K (기본 1.5)
var MANA_K = typeof MANA_K === 'number' ? MANA_K : 3, STONE_K = typeof STONE_K === 'number' ? STONE_K : 1.5;
enhanceCost = function (L) { return { stone: Math.floor(2 * STONE_K * Math.pow(1.17, L)), mana: L >= 10 ? Math.floor(2 * MANA_K * Math.pow(1.22, L - 10)) : 0 }; };
const _tpA = ticketPrice; ticketPrice = function () { const p = _tpA(); p.mana = 0; return p; };
const _bcA = buildCost; buildCost = function (id, lv) { const c = _bcA(id, lv); c.mana = 0; return c; };
const _fcA = forgeFacCost; forgeFacCost = function (id, lv) { const c = _fcA(id, lv); c.mana = 0; return c; };
const _dgA = dgUnitValue; dgUnitValue = function (r, best = S.best) { return r === 'mana' ? (100 + 1.5 * best) / DG_RUN_UNITS : _dgA(r, best); };
