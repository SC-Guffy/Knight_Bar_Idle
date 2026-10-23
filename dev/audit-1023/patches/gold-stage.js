// 안 (b) 골드 비용을 스테이지에 묶기: 건물·대장간 시설·전직 2·3차 골드 = priceBest() 잡몹 골드 × 마리 수
//  건물 Lv L → L+1: BG_MOBS × BG_GROW^(L−1) × 건물 골드 배율(mul.gold) 마리 (진행 봇 원정 1시간 ≈ 263마리)
//  대장간 시설 Lv L → L+1: FG_MOBS × BG_GROW^L 마리 · 전직 2차 CG2 · 3차 CG3 마리 (1차 500 골드 그대로)
//  목재·철광석·마력석은 그대로
var BG_MOBS = typeof BG_MOBS === 'number' ? BG_MOBS : 60;
var BG_GROW = typeof BG_GROW === 'number' ? BG_GROW : 1.3;
var FG_MOBS = typeof FG_MOBS === 'number' ? FG_MOBS : 20;
var CG2 = typeof CG2 === 'number' ? CG2 : 600, CG3 = typeof CG3 === 'number' ? CG3 : 3000;
var mobGoldP = () => monsterStats(priceBest(), false).gold;
var _bcG = buildCost;
buildCost = function (id, lv) { const c = _bcG(id, lv); c.gold = Math.ceil(mobGoldP() * BG_MOBS * Math.pow(BG_GROW, lv - 1) * BUILDINGS[id].mul.gold); return c; };
var _ffG = forgeFacCost;
forgeFacCost = function (id, lv) { const c = _ffG(id, lv); c.gold = Math.ceil(mobGoldP() * FG_MOBS * Math.pow(BG_GROW, lv)); return c; };
// 전직 골드: CLASS_REQ 는 const 객체라 값만 바꾼다 — 부를 때마다 지금 기준으로 다시 맞춘다
var _cbG = classBlocker, _ccG = changeClass;
var syncClassGold = () => { CLASS_REQ[2].gold = Math.ceil(mobGoldP() * CG2); CLASS_REQ[3].gold = Math.ceil(mobGoldP() * CG3); };
classBlocker = function (id) { syncClassGold(); return _cbG(id); };
changeClass = function (id) { syncClassGold(); return _ccG(id); };
