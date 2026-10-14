'use strict';
// ⑤-4 프레임 비용 (개발용): dev/skills.html 에서 dev/vfx0/cap.js 다음에 불러 perfSet() — 항목마다 tick+render 600프레임 평균(ms).
// 다른 작업이 같이 돌면 값이 흔들리므로, 전(옛 코드 탭)·후 탭에서 번갈아 여러 번 재고 가장 낮은 값을 쓴다.
window.PERF_SET = [['paladin', null], ['tyrant', null], ['paladin', 'judgment'], ['paladin', 'sanctuary'], ['blademaster', 'iaido'], ['greatswordsman', 'wideCleave'],
  ['archon', 'starJudgment'], ['tyrant', 'skyBreak'], ['swordsaint', 'thousandCuts']];
window.perfSet = async (frames = 600) => {
  const res = {};
  for (const [c, sk] of PERF_SET) res[c + '/' + (sk || 'basic')] = await capPerf(c, sk, 3, frames);
  return res;
};
