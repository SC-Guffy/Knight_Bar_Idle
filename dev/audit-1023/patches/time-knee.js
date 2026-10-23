// 안 (a) 건설 시간 꺾기: Lv BT_KNEE 까지 60·1.8^(Lv−1)초 그대로, 그 위로는 ×BT_LATE/Lv (src/data.js buildTimeAt 대신 — const 라 startBuild 를 바꿔 끼운다)
var BT_KNEE = typeof BT_KNEE === 'number' ? BT_KNEE : 12;
var BT_LATE = typeof BT_LATE === 'number' ? BT_LATE : 1.4;
var buildTimeAtP = (lv) => 60 * Math.pow(1.8, Math.min(lv, BT_KNEE) - 1) * Math.pow(BT_LATE, Math.max(0, lv - BT_KNEE));
startBuild = function (id) {
  const lv = S.bld[id];
  const cost = buildCost(id, lv);
  if (S.build || lv >= bldMax(id) || !canAfford(cost)) return false;
  S.gold -= cost.gold;
  S.mats.wood -= cost.wood; S.mats.ore -= cost.ore; S.mats.mana -= cost.mana;
  const total = buildTimeAtP(lv);
  S.build = { id, remain: total, total };
  return true;
};
