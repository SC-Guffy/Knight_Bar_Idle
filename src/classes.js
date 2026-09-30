'use strict';
// 전직 트리: 무기, 직업별 스탯 보정, 직업별 외형(스프라이트·팔레트·장식).
// 새 직업은 WEAPONS 에 무기를, CLASSES 에 항목을 추가하면 트리·전투·외형이 모두 따라온다.

// ───────────────────────── 무기 ─────────────────────────
// kind: melee | ranged.  motion(근접): swing 휘두르기 | dual 쌍검 | thrust 찌르기 | sweep 휩쓸기
// targets: 한 번에 때리는 최대 수 (근접은 사거리 안, 원거리는 shots 발을 나눠 쏨)
const WEAPONS = {
  sword:       { name: '장검',   kind: 'melee',  motion: 'swing',  range: 14, targets: 1, len: 7,  blade: '#e8edf5', hilt: '#ffd257', trail: '255,255,255' },
  knightSword: { name: '기사검', kind: 'melee',  motion: 'swing',  range: 16, targets: 1, len: 8,  blade: '#f4f8ff', hilt: '#3d7bff', trail: '140,180,255' },
  holySword:   { name: '성검',   kind: 'melee',  motion: 'swing',  range: 16, targets: 1, len: 9,  blade: '#fff3b0', hilt: '#ffcc33', trail: '255,215,90', glow: '#ffd257' },
  dualBlades:  { name: '쌍검',   kind: 'melee',  motion: 'dual',   range: 14, targets: 1, len: 7,  blade: '#ff6a6a', hilt: '#2a2b33', trail: '255,70,70' },
  spear:       { name: '창',     kind: 'melee',  motion: 'thrust', range: 34, targets: 2, len: 15, shaft: '#8a5a2b', tip: '#e8edf5', trail: '230,230,230' },
  dragonSpear: { name: '용창',   kind: 'melee',  motion: 'thrust', range: 36, targets: 2, len: 17, shaft: '#3b2458', tip: '#c0a0ff', trail: '190,150,255', glow: '#a070ff' },
  halberd:     { name: '할버드', kind: 'melee',  motion: 'sweep',  range: 40, targets: 9, len: 17, shaft: '#6b4a2b', tip: '#c9d1dd', trail: '255,150,60' },
  bow:         { name: '단궁',   kind: 'ranged', range: 150, targets: 1, shots: 1, size: 11, wood: '#8a5a2b', arrow: { speed: 420, color: '#e8d9b0' } },
  longbow:     { name: '장궁',   kind: 'ranged', range: 230, targets: 1, shots: 1, size: 15, wood: '#3b2a1a', arrow: { speed: 760, color: '#f4f1e8', trail: '255,255,220' } },
  arcaneBow:   { name: '마력궁', kind: 'ranged', range: 170, targets: 3, shots: 3, shotMult: 0.45, size: 12, wood: '#3a55b0', glow: '#6ff3ff',
    arrow: { speed: 360, color: '#6ff3ff', magic: true } },
};

// ───────────────────────── 전직 조건 ─────────────────────────
const CLASS_REQ = {
  1: { level: 20, mana: 10, gold: 500 },
  2: { level: 45, mana: 80, gold: 50000 },
};

// ───────────────────────── 직업별 몸통 스프라이트 (11×13, 오른쪽을 봄) ─────────────────────────
// 다리는 공용(SPR.knightLegs). 팔레트 글자: h/H 투구, v 눈, a/A 갑옷, y 장식, b 벨트, l/k 다리, 그 외 직업 전용
const BODY = {
  squire: [
    '.....rr....',
    '....rrr....',
    '...hhhhh...',
    '..hHHHHHh..',
    '..hHvvvvh..',
    '..hHHHHHh..',
    '...hhhhh...',
    '..aAAAAAa..',
    '.aAAAyAAAa.',
    '.aAAAyAAAa.',
    '.aAAAAAAAa.',
    '..bbbybbb..',
    '..aAAAAAa..',
  ],
  swordsman: [
    '....rrr....',
    '...rrrr....',
    '...hhhhh...',
    '..hHHHHHh..',
    '..hHvvvvh..',
    '..hHHyHHh..',
    '...hhhhh...',
    '..aATTTAa..',
    '.aAATyTAAa.',
    '.aAATTTAAa.',
    '.aAATTTAAa.',
    '..bbbybbb..',
    '..aATTTAa..',
  ],
  lancer: [
    '.....y.....',
    '....hhh....',
    '...hHHHh...',
    '..hHHHHHh..',
    '..hHHvvvh..',
    '.hhHHHHHh..',
    '...hhhhh...',
    '..aAAAAAa..',
    '.aAAyAyAAa.',
    '.aAAAyAAAa.',
    '.aAAAAAAAa.',
    '..bbbbbbb..',
    '..aAAAAAa..',
  ],
  ranger: [
    '...........',
    '....ggg....',
    '...gGGGg...',
    '..gGGGGGg..',
    '..gGGsese..',
    '..gGGssss..',
    '...gGsss...',
    '..gLLLLLg..',
    '.gLLLyLLLg.',
    '.gLLLyLLLg.',
    '.gLLLLLLLg.',
    '..bbbybbb..',
    '..LLLLLLL..',
  ],
  paladin: [
    '.....yy....',
    '....yyy....',
    '...hhhhh...',
    '.whHHHHHh..',
    'wwhHvvvvh..',
    '.whHHHHHh..',
    '...hhhhh...',
    '..aAAAAAa..',
    '.aAAAyAAAa.',
    '.aAyyyyyAa.',
    '.aAAAyAAAa.',
    '..bbbybbb..',
    '..aAAAAAa..',
  ],
  blademaster: [
    '..n.....n..',
    '..nn...nn..',
    '...hhhhh...',
    '..hHHHHHh..',
    '..hHvvvvh..',
    '..hHHHHHh..',
    '...hhhhh...',
    '..aAAAAAa..',
    '.aARAAARAa.',
    '.aAARARAAa.',
    '.aAAARAAAa.',
    '..bbbRbbb..',
    '..aAAAAAa..',
  ],
  dragoon: [
    'nn.........',
    '.nnhhhh....',
    '...hHHHh...',
    '..hHHHHHhh.',
    '..hHHvvvHh.',
    '..hHHHHHh..',
    '...hhhhh...',
    '..aAAAAAa..',
    '.aAAAyAAAa.',
    '.ayAAAAAya.',
    '.aAAAyAAAa.',
    '..bbbybbb..',
    '..aAAAAAa..',
  ],
  halberdier: [
    '...........',
    '...hhhhh...',
    '..hHHHHHh..',
    '..hHHHHHh..',
    '..hvvvvvh..',
    '..hHHyHHh..',
    '..hhhhhhh..',
    'aaAAAAAAAaa',
    'aAAAAyAAAAa',
    '.aAAAyAAAa.',
    '.aAAAAAAAa.',
    '..bbbybbb..',
    '..aAAAAAa..',
  ],
  marksman: [
    '...........',
    '....ggg....',
    '...gGGGg...',
    '..gGGGGGg..',
    '..gGGmeme..',
    '..gGGmmmm..',
    '...gGmmm...',
    '..gLLLLLg..',
    '.gLLLLLLLg.',
    '.gLLyyyLLg.',
    '.gLLLLLLLg.',
    '..bbbbbbb..',
    '.gLLLLLLLg.',
  ],
  arcaneArcher: [
    '....c......',
    '....ggg....',
    '...gGGGg...',
    '..gGGGGGg..',
    '..gGGsese..',
    '..gGGssss..',
    '...gGsss...',
    '..gLLcLLg..',
    '.gLLLcLLLg.',
    '.gLLcccLLg.',
    '.gLLLcLLLg.',
    '..bbbcbbb..',
    '.gLLLLLLLg.',
  ],
};

// ───────────────────────── 직업 ─────────────────────────
// mods: atk/hp/aspd 배율, crit 가산, critMult 가산, guard 받는 피해 감소, heal 타격마다 최대 체력 회복 비율
// look: body 스프라이트, pal 색 덮어쓰기, cape/halo/shield 장식, fx 전직 연출 색
const CLASSES = {
  squire: {
    tier: 0, from: null, name: '견습 기사', icon: '🛡️', weapon: 'sword', mods: {},
    desc: '모든 기사의 출발점.',
    look: { body: BODY.squire, pal: {}, fx: '#ffffff' },
  },

  // ── 검 계열 ──
  swordsman: {
    tier: 1, from: 'squire', name: '검사', icon: '⚔️', weapon: 'knightSword',
    mods: { atk: 1.35, hp: 1.25, crit: 0.05 },
    desc: '균형 잡힌 근접 전투. 무난하고 튼튼하다.',
    look: {
      body: BODY.swordsman, fx: '#8fb4ff',
      pal: { r: '#3d7bff', h: '#9aa3b2', H: '#e3e8ef', a: '#8c95a6', A: '#cfd6e0', T: '#2f5fc4' },
      cape: { style: 'cape', color: '#2f5fc4' },
    },
  },
  paladin: {
    tier: 2, from: 'swordsman', name: '성기사', icon: '✨', weapon: 'holySword',
    mods: { atk: 1.7, hp: 1.8, guard: 0.25, heal: 0.02 },
    desc: '성검과 방패. 받는 피해가 줄고 때릴 때마다 회복한다.',
    look: {
      body: BODY.paladin, fx: '#ffd257',
      pal: { h: '#c9b27a', H: '#fff6dc', a: '#d8c28a', A: '#fffaf0', y: '#ffcc33', v: '#3a2a10', b: '#8a6a2a', w: '#ffffff', l: '#d8c28a', k: '#8a6a2a' },
      cape: { style: 'cape', color: '#f4f1e8' },
      halo: true,
      shield: { face: '#fff6dc', rim: '#ffcc33', emblem: '#e0a800' },
    },
  },
  blademaster: {
    tier: 2, from: 'swordsman', name: '검성', icon: '🗡️', weapon: 'dualBlades',
    mods: { atk: 1.8, hp: 1.3, aspd: 1.5, crit: 0.12, critMult: 0.5 },
    desc: '쌍검으로 몰아친다. 매우 빠르고 치명타가 강하다.',
    look: {
      body: BODY.blademaster, fx: '#ff4d4d',
      pal: { n: '#e0303a', h: '#1f2027', H: '#3a3c48', v: '#ff4d4d', a: '#1a1b22', A: '#34363f', R: '#e0303a', b: '#7a1a20', l: '#2a2b33', k: '#7a1a20' },
      cape: { style: 'scarf', color: '#e0303a' },
    },
  },

  // ── 창 계열 ──
  lancer: {
    tier: 1, from: 'squire', name: '창기사', icon: '🔱', weapon: 'spear',
    mods: { atk: 1.4, hp: 1.25, aspd: 0.85 },
    desc: '긴 창으로 멀리서 찌르고 2마리까지 꿰뚫는다.',
    look: {
      body: BODY.lancer, fx: '#9fd49a',
      pal: { h: '#6e5a2e', H: '#b8964a', a: '#3f6b4a', A: '#6fa37a', y: '#e8d27a', l: '#6e5a2e' },
    },
  },
  dragoon: {
    tier: 2, from: 'lancer', name: '용기병', icon: '🐉', weapon: 'dragonSpear',
    mods: { atk: 2.05, hp: 1.6, aspd: 0.85 },
    leap: { every: 6, mult: 3, radius: 70 },
    desc: '6초마다 높이 도약해 내리꽂는다. 주변 적 모두에게 3배 피해.',
    look: {
      body: BODY.dragoon, fx: '#b388ff',
      pal: { n: '#e8e0d0', h: '#3b2458', H: '#6b45a0', v: '#ffcc33', a: '#2e1d47', A: '#5a3a8a', y: '#c0a0ff', b: '#1f1430', l: '#3b2458', k: '#1f1430' },
      cape: { style: 'cape', color: '#5a3a8a' },
    },
  },
  halberdier: {
    tier: 2, from: 'lancer', name: '할버디어', icon: '🪓', weapon: 'halberd',
    mods: { atk: 2.7, hp: 1.9, aspd: 0.75 },
    desc: '묵직한 할버드로 사거리 안의 적을 모두 휩쓸어 밀어낸다.',
    look: {
      body: BODY.halberdier, fx: '#ff9f40',
      pal: { h: '#6a6f7a', H: '#a7adb8', v: '#15161c', a: '#8a4a1a', A: '#c9772e', y: '#ffd257', b: '#3a2410', l: '#6a6f7a', k: '#3a2410' },
    },
  },

  // ── 활 계열 ──
  ranger: {
    tier: 1, from: 'squire', name: '레인저', icon: '🏹', weapon: 'bow',
    mods: { atk: 1.3, hp: 1.0, aspd: 1.1 },
    desc: '멀리서 화살을 쏜다. 적이 다가오는 동안 먼저 때린다.',
    look: {
      body: BODY.ranger, fx: '#7fd06a',
      pal: { g: '#2f5a2a', G: '#4f8a3c', s: '#f0c29a', e: '#1b1d27', L: '#8a5a2b', y: '#d9b36b', b: '#4a3220', l: '#6b4a2b', k: '#3a2616' },
    },
  },
  marksman: {
    tier: 2, from: 'ranger', name: '저격수', icon: '🎯', weapon: 'longbow',
    mods: { atk: 2.5, hp: 1.2, aspd: 0.8, crit: 0.2 },
    desc: '아주 먼 거리에서 강력한 한 발. 치명타 확률이 높다.',
    look: {
      body: BODY.marksman, fx: '#e8e070',
      pal: { g: '#1d2f22', G: '#2f4a35', m: '#3a3a3a', e: '#ffe066', L: '#3b4a3a', y: '#a0a060', b: '#2a2016', l: '#2f3a2e', k: '#1a1a14' },
      cape: { style: 'cloak', color: '#22382a' },
    },
  },
  arcaneArcher: {
    tier: 2, from: 'ranger', name: '마궁수', icon: '🔮', weapon: 'arcaneBow',
    mods: { atk: 1.7, hp: 1.2, aspd: 1.2 },
    desc: '마력 화살 3발을 흩뿌려 여러 적을 동시에 맞힌다.',
    look: {
      body: BODY.arcaneArcher, fx: '#6ff3ff',
      pal: { g: '#1f2f6a', G: '#3a55b0', s: '#f0c29a', e: '#35e0ff', L: '#2a3f8a', c: '#6ff3ff', b: '#1a2450', l: '#2a3f8a', k: '#1a2450' },
      cape: { style: 'cloak', color: '#26398a' },
    },
  },
};

// 트리 화면 배치 순서
const CLASS_TREE = [
  ['squire'],
  ['swordsman', 'lancer', 'ranger'],
  ['paladin', 'blademaster', 'dragoon', 'halberdier', 'marksman', 'arcaneArcher'],
];
