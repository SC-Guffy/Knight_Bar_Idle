// 재료의 미궁 슬롯에서 💎 마력석·💠 강화석을 뺀다 (docs/specs/dungeon-slot-roles.md). 남은 그림 4종(💰🪵🪨📖)이 그 비중을 나눠 가진다.
//  TOMES_KEEP (기본 true): 📖 비전서는 한 판 몫이 지금과 같도록 1칸 값을 (남은 비중/전체 비중) 배로 줄인다 — 숙련도 속도는 그대로, 늘어난 몫은 💰🪵🪨 로.
var TOMES_KEEP = typeof TOMES_KEEP === 'boolean' ? TOMES_KEEP : true;
const _wAll = DG_RES_IDS.reduce((a, r) => a + DG_RES[r].w, 0);
delete DG_RES.mana; delete DG_RES.stones;
DG_RES_IDS.splice(0, DG_RES_IDS.length, ...Object.keys(DG_RES));
const _wNew = DG_RES_IDS.reduce((a, r) => a + DG_RES[r].w, 0);
const _dg4 = dgUnitValue; dgUnitValue = function (r, best = S.best) { const v = _dg4(r, best); return r === 'tomes' && TOMES_KEEP ? v * _wNew / _wAll : v; };
