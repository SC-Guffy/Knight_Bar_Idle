// 안 (c) 건설 줄 2칸: 첫 줄이 차 있으면 다른 건물을 둘째 줄(S.build2)에 짓는다. 시간·비용 그대로. 즉시 완료는 첫 줄만 (봇 측정용 단순화)
//  기사단 공용 건설(GUILD_HOST)에는 쓰지 않는다
var _sbQ = startBuild, _abQ = advanceBuildNow;
startBuild = function (id) {
  if (!S.build) return _sbQ(id);
  if (S.build2 || S.build.id === id) return false;
  const lv = S.bld[id], cost = buildCost(id, lv);
  if (lv >= bldMax(id) || !canAfford(cost)) return false;
  S.gold -= cost.gold; S.mats.wood -= cost.wood; S.mats.ore -= cost.ore; S.mats.mana -= cost.mana;
  const total = (typeof buildTimeAtP === 'function' ? buildTimeAtP : buildTimeAt)(lv);
  S.build2 = { id, remain: total, total };
  return true;
};
advanceBuildNow = function (sec) {
  _abQ(sec);
  const b = S.build2;
  if (!b) return;
  b.remain -= sec;
  if (b.remain <= 0) {
    if (b.id === 'storage') settleStock();
    S.bld[b.id]++; S.build2 = null;
    if (b.id === 'inn') S.stamina = Math.min(maxStamina(), S.stamina);
    hooks.onBuilt(b.id);
  }
};
