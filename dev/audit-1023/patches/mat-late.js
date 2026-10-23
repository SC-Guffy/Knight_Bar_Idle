// 안 (d) 즉시 완료를 기본 흐름으로 볼 때의 목재·철광석 곡선: Lv BUILD_MAT_KNEE(8) 위 증가율 1.5 → MAT_LATE (src/data.js buildMatGrow)
//  교역 양·미궁 🪵🪨 은 dgNextBuildCost → buildCost 를 따라 같이 줄어든다. 가방 비용(bagUpCost)도 여관 목재를 따른다
var MAT_LATE = typeof MAT_LATE === 'number' ? MAT_LATE : 1.35;
var _bcM = buildCost;
buildCost = function (id, lv) {
  const c = _bcM(id, lv), k = Math.pow(MAT_LATE / BUILD_MAT_LATE, Math.max(0, lv - BUILD_MAT_KNEE));
  c.wood = Math.floor(c.wood * k); c.ore = Math.floor(c.ore * k);
  return c;
};
