'use strict';
// 시즌7 스킬 빌드 트리 — 검사 1차 줄기 글 + 검성 → 검신 줄기 (docs/specs/skill-tree-all.md · 시제품 docs/specs/skill-tree-swordsaint.md)
// 화면 글의 기본값(src/tree7-ui.js T7_UI)이 이 줄기 글이라 ui 는 비워 둔다. 연출은 src/tree7-fx.js (이 줄기만 새로 짠 연출이 있다)

t7DefStem('swordsman', { ui: {} });

t7DefLine({
  id: 'swordsaint', cls: ['swordsman', 'blademaster', 'swordsaint'],
  sk: { slash: 'steelCleave', gale: 'gale', iaido: 'iaido', ult: 'thousandCuts' },
  // 새 스킬·융합: 바탕 스킬(base)의 타격·모습을 빌리고 쿨·범위·위력 배율(t7mul)만 다르다. stageName = 트리 칸마다 모습 이름 (1칸 · 2~3칸 · 4칸 · 5칸)
  newSkills: {
    whirl: { id: 'whirl', base: 'gale', name: '검무 회오리', icon: '🌀', cd: 12, radius: 70, t7mul: 0.9, stageName: ['검무', '쌍 회오리', '칼날 회오리', '천검무'],
      desc: '칼날 회오리가 기사 주위를 돌며 벤다.' },
    flash: { id: 'flash', base: 'iaido', name: '섬광 베기', icon: '⚡', cd: 18, radius: 260, t7mul: 1.0, stageName: ['섬광', '섬광 베기', '뇌광', '천섬'],
      desc: '잠깐 멈췄다가 화면 끝까지 한 줄로 베어 지나간다.' },
    wave: { id: 'wave', base: 'steelCleave', name: '비검', icon: '🌙', cd: 9, t7mul: 0.9, stageName: ['비검', '삼연 비검', '오연 비검', '비검 난무'],
      desc: '초승달 검기를 부채꼴로 날린다.' },
    storm: { id: 'storm', base: 'steelCleave', name: '검기 폭풍', icon: '✴️', cd: 13, area: 'all', radius: 120, t7mul: 0.85, stageName: ['검기 방사', '팔방 검기', '검기 폭풍', '검기 대폭풍'],
      desc: '사방으로 검기를 뿜는다.' },
    f_ab: { id: 'f_ab', base: 'gale', name: '질풍 일섬', icon: '💫', cd: 14, t7mul: 1.5, stageName: ['질풍 일섬', '질풍 일섬', '질풍 일섬·분신', '월하 일섬'],
      desc: '융합(연타+발도). 난무 마지막 타가 일섬으로 돌진한다.' },
    f_bk: { id: 'f_bk', base: 'iaido', name: '섬광 검기', icon: '🌠', cd: 18, t7mul: 1.4, stageName: ['섬광 검기', '섬광 검기', '섬광 검기·납도', '적월 검기'],
      desc: '융합(발도+검기). 일섬이 지나간 줄에 검기가 남아 터진다.' },
    f_ak: { id: 'f_ak', base: 'gale', name: '칼날 폭풍', icon: '🌪️', cd: 14, radius: 90, t7mul: 1.3, stageName: ['칼날 폭풍', '칼날 폭풍', '칼날 폭풍·분신', '월하 폭풍'],
      desc: '융합(연타+검기). 회오리가 돌며 검기를 흩뿌린다.' },
  },
  lanes: { a: { tip: '난무 +3타·검무 회오리·만검' }, b: { tip: '처형·일섬·섬광 베기·일도양단' }, k: { tip: '관통·검기 폭풍·분열·검우' } },
  ui: {},
});
