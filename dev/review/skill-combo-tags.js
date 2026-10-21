'use strict';
// 스킬 연계 꼬리표 시안 (docs/specs/skill-combo.md 표 1) — 15줄기 × 8칸. 구현 때 src/ 로 옮긴다 (줄기 파일 newSkills·sk 옆 tag)
// 칸 순서: slash(1차) · gale · iaido(2차) · wave · whirl · flash · storm(새 스킬) · ult(궁극기)
const COMBO_TAGS = {
  swordsaint:     { slash: 'single', gale: 'area',   iaido: 'rush',   wave: 'shot', whirl: 'zone', flash: 'rush',   storm: 'area', ult: 'area' },
  tyrant:         { slash: 'single', gale: 'rush',   iaido: 'area',   wave: 'shot', whirl: 'zone', flash: 'rush',   storm: 'area', ult: 'area' },
  archon:         { slash: 'single', gale: 'buff',   iaido: 'single', wave: 'shot', whirl: 'zone', flash: 'area',   storm: 'area', ult: 'area' },
  skyGeneral:     { slash: 'single', gale: 'buff',   iaido: 'rush',   wave: 'shot', whirl: 'zone', flash: 'rush',   storm: 'area', ult: 'area' },
  dragonlord:     { slash: 'single', gale: 'zone',   iaido: 'rush',   wave: 'shot', whirl: 'zone', flash: 'shot',   storm: 'area', ult: 'area' },
  warlord:        { slash: 'single', gale: 'area',   iaido: 'rush',   wave: 'shot', whirl: 'zone', flash: 'zone',   storm: 'area', ult: 'area' },
  siegeMaster:    { slash: 'single', gale: 'shot',   iaido: 'area',   wave: 'shot', whirl: 'zone', flash: 'shot',   storm: 'area', ult: 'shot' },
  deadeye:        { slash: 'single', gale: 'shot',   iaido: 'single', wave: 'shot', whirl: 'zone', flash: 'single', storm: 'area', ult: 'shot' },
  voidArcher:     { slash: 'single', gale: 'zone',   iaido: 'shot',   wave: 'shot', whirl: 'zone', flash: 'area',   storm: 'area', ult: 'area' },
  thunderEmperor: { slash: 'single', gale: 'area',   iaido: 'zone',   wave: 'shot', whirl: 'zone', flash: 'single', storm: 'area', ult: 'area' },
  archmage:       { slash: 'single', gale: 'zone',   iaido: 'area',   wave: 'shot', whirl: 'zone', flash: 'shot',   storm: 'area', ult: 'zone' },
  frostlord:      { slash: 'single', gale: 'zone',   iaido: 'shot',   wave: 'shot', whirl: 'zone', flash: 'shot',   storm: 'area', ult: 'zone' },
  champion:       { slash: 'single', gale: 'rush',   iaido: 'single', wave: 'shot', whirl: 'zone', flash: 'shot',   storm: 'area', ult: 'area' },
  tempest:        { slash: 'single', gale: 'area',   iaido: 'rush',   wave: 'shot', whirl: 'zone', flash: 'rush',   storm: 'area', ult: 'area' },
  grandmaster:    { slash: 'single', gale: 'buff',   iaido: 'shot',   wave: 'shot', whirl: 'zone', flash: 'shot',   storm: 'area', ult: 'area' },
};
if (typeof module !== 'undefined') module.exports = { COMBO_TAGS };
if (typeof window !== 'undefined') window.COMBO_TAGS = COMBO_TAGS;
