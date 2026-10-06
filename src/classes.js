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
  // 마법사 지팡이 (원거리): staff = { len 자루 칸, wood, head, orb 구슬색, glowRgb } — 그리는 법은 world.js drawStaff.
  // arrow.shape 'ice' 얼음창 / magic 마력탄(rgb 꼬리색, size 크기) · splash: 맞은 자리 radius(px) 안의 다른 적도 mult 배율로 (화염)
  wand:        { name: '견습 지팡이', kind: 'ranged', range: 150, targets: 1, shots: 1, staff: { len: 7, wood: '#8a5a2b', head: '#c9a227', orb: '#9fd8ff', glowRgb: '159,216,255' },
    arrow: { speed: 400, color: '#cfe8ff', magic: true, rgb: '159,216,255' } },
  flameStaff:  { name: '화염 지팡이', kind: 'ranged', range: 160, targets: 1, shots: 1, splash: { radius: 40, mult: 0.5 }, glow: '#ff7a2a',
    staff: { len: 8, wood: '#5a2a14', head: '#ffb13b', orb: '#ff6a1f', glowRgb: '255,120,40' },
    arrow: { speed: 340, color: '#ff8a3a', magic: true, rgb: '255,140,60', size: 1.4 } },
  frostStaff:  { name: '서리 지팡이', kind: 'ranged', range: 175, targets: 1, shots: 1, glow: '#9fe8ff',
    staff: { len: 8, wood: '#3f6f9a', head: '#e8f6ff', orb: '#9fe8ff', glowRgb: '159,232,255' },
    arrow: { speed: 560, color: '#e8f8ff', shape: 'ice', rgb: '159,232,255' } },
  // ── 3차 ──
  infernoStaff: { name: '겁화의 지팡이', kind: 'ranged', range: 170, targets: 1, shots: 1, splash: { radius: 52, mult: 0.55 }, glow: '#ff3b1f',
    staff: { len: 9, wood: '#2a0e08', head: '#ffd257', orb: '#ff3b1f', glowRgb: '255,80,30' },
    arrow: { speed: 360, color: '#ff5a2a', magic: true, rgb: '255,100,40', size: 1.7 } },
  glacierStaff: { name: '빙하의 홀', kind: 'ranged', range: 190, targets: 1, shots: 1, glow: '#cff6ff',
    staff: { len: 9, wood: '#1b3f6a', head: '#ffffff', orb: '#cff6ff', glowRgb: '200,245,255' },
    arrow: { speed: 640, color: '#ffffff', shape: 'ice', rgb: '200,245,255' } },
  starBlade:   { name: '성좌검', kind: 'melee',  motion: 'swing',  range: 18, targets: 1, len: 10, blade: '#fffbe6', hilt: '#9fd8ff', trail: '200,230,255', glow: '#cfe8ff' },
  moonBlades:  { name: '월광쌍검', kind: 'melee', motion: 'dual',  range: 16, targets: 1, len: 8,  blade: '#ffe0e8', hilt: '#5a0a18', trail: '255,90,130', glow: '#ff4d6d' },
  wyrmSpear:   { name: '용황창', kind: 'melee',  motion: 'thrust', range: 40, targets: 3, len: 19, shaft: '#1a0a28', tip: '#ffb0f0', trail: '255,120,220', glow: '#ff4dd2' },
  doomAxe:     { name: '종말의 도끼창', kind: 'melee', motion: 'sweep', range: 44, targets: 9, len: 19, shaft: '#3a1a10', tip: '#ffb070', trail: '255,110,40', glow: '#ff7a2a' },
  sunBow:      { name: '태양궁', kind: 'ranged', range: 260, targets: 1, shots: 1, size: 16, wood: '#c9a227', glow: '#ffe066',
    arrow: { speed: 980, color: '#fffbe0', trail: '255,230,120' } },
  voidBow:     { name: '공허궁', kind: 'ranged', range: 190, targets: 4, shots: 4, shotMult: 0.42, size: 13, wood: '#2a1050', glow: '#ff4dff',
    arrow: { speed: 380, color: '#ff8aff', magic: true } },
};

// ───────────────────────── 전직 조건 ─────────────────────────
const CLASS_REQ = {
  1: { level: 20, mana: 0, gold: 500 },      // 첫 전직은 마력석 없이 — 초반엔 마력석이 거의 안 모인다
  2: { level: 50, mana: 40, gold: 50000 },
  3: { level: 100, mana: 150, gold: 5e10 },
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
  // ── 마법사 계열 (뾰족 모자 · 로브) ──
  mage: [
    '.....P.....',
    '....PPp....',
    '...PPppp...',
    '..ppppppp..',
    '.ppyyyyypp.',
    '...sesss...',
    '...sssss...',
    '..rRRyRRr..',
    '.rRRRyRRRr.',
    '.rRRRyRRRr.',
    '.rRRRRRRRr.',
    '..bbbybbb..',
    '..rRRRRRr..',
  ],
  pyromancer: [
    '.....f.....',
    '....fPp....',
    '...PPppp...',
    '..ppppppp..',
    '.ppfyfyfpp.',
    '...sesss...',
    '...sssss...',
    '..rRfRfRr..',
    '.rRRRfRRRr.',
    '.rRRfffRRr.',
    '.rRRRfRRRr.',
    '..bbbfbbb..',
    '.rRRRRRRRr.',
  ],
  cryomancer: [
    '...c...c...',
    '....cPc....',
    '...PPppp...',
    '..ppppppp..',
    '.ppcycycpp.',
    '...sesss...',
    '...sssss...',
    '..rRRcRRr..',
    '.rRRcccRRr.',
    '.rRRRcRRRr.',
    '.rRRRRRRRr.',
    '..bbbcbbb..',
    '.rRRRRRRRr.',
  ],
  // ── 3차 ──
  archon: [
    '..y..y..y..',
    '...yyyyy...',
    '...hhhhh...',
    '.whHHHHHh..',
    'wwhHvvvvh..',
    '.whHHHHHh..',
    '...hhhhh...',
    '.aaAAAAAaa.',
    'aAAAAyAAAAa',
    '.aAyyyyyAa.',
    '.aAAAyAAAa.',
    '..bbbybbb..',
    '..aAAAAAa..',
  ],
  swordsaint: [
    '.n.......n.',
    '.nn.....nn.',
    '..nhhhhhn..',
    '..hHHHHHh..',
    '..hHvvvvh..',
    '..hHHRHHh..',
    '...hhhhh...',
    '..aARARAa..',
    '.aARAAARAa.',
    '.aAARARAAa.',
    '.aAAARAAAa.',
    '..bbbRbbb..',
    '..aARARAa..',
  ],
  dragonlord: [
    'nn.......nn',
    '.nnhhhhhnn.',
    '..nhHHHhn..',
    '..hHHHHHhh.',
    '..hHHvvvHh.',
    '..hHHHHHh..',
    '...hhhhh...',
    '.aaAAAAAaa.',
    'aAAAAyAAAAa',
    '.ayAAyAAya.',
    '.aAAAyAAAa.',
    '..bbbybbb..',
    '..aAAAAAa..',
  ],
  warlord: [
    '.n.......n.',
    '.nnhhhhhnn.',
    '..hHHHHHh..',
    '..hHHHHHh..',
    '..hvvvvvh..',
    '..hHHyHHh..',
    '..hhhhhhh..',
    'aaAAAAAAAaa',
    'aAAyAyAyAAa',
    'aaAAAyAAAaa',
    '.aAAAAAAAa.',
    '..bbbybbb..',
    '..aAAAAAa..',
  ],
  deadeye: [
    '.....y.....',
    '....ggg....',
    '...gGGGg...',
    '..gGGGGGg..',
    '..gGGmeme..',
    '..gGGmmmm..',
    '...gGmmm...',
    '..gLLyLLg..',
    '.gLLLyLLLg.',
    '.gLyyyyyLg.',
    '.gLLLyLLLg.',
    '..bbbbbbb..',
    '.gLLLLLLLg.',
  ],
  voidArcher: [
    '...c...c...',
    '....ccc....',
    '...gGGGg...',
    '..gGGGGGg..',
    '..gGGsese..',
    '..gGGssss..',
    '...gGsss...',
    '..gLLcLLg..',
    '.gLLcccLLg.',
    '.gLcLcLcLg.',
    '.gLLcccLLg.',
    '..bbbcbbb..',
    '.gLLLcLLLg.',
  ],
};

// ───────────────────────── 직업 ─────────────────────────
// mods: atk/hp/aspd 배율, crit 가산, critMult 가산, guard 받는 피해 감소, heal 타격마다 최대 체력 회복 비율
// 공속·치명은 훈련으로 못 올리고 직업(여기)과 장비(무기 공속 · 장신구 치명)에서만 얻는다. 빠른 직업·치명 직업이 확실히 갈리도록
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
    mods: { atk: 1.35, hp: 1.25, aspd: 1.1, crit: 0.08 },
    desc: '균형 잡힌 근접 전투. 무난하고 튼튼하다.',
    look: {
      body: BODY.swordsman, fx: '#8fb4ff',
      pal: { r: '#3d7bff', h: '#9aa3b2', H: '#e3e8ef', a: '#8c95a6', A: '#cfd6e0', T: '#2f5fc4' },
      cape: { style: 'cape', color: '#2f5fc4' },
    },
  },
  paladin: {
    tier: 2, from: 'swordsman', name: '성기사', icon: '✨', weapon: 'holySword',
    mods: { atk: 1.7, hp: 1.8, aspd: 1.05, crit: 0.06, guard: 0.25, heal: 0.02 },
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
    mods: { atk: 1.8, hp: 1.3, aspd: 1.8, crit: 0.2, critMult: 0.5 },
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
    mods: { atk: 1.4, hp: 1.25, aspd: 0.9, crit: 0.06 },
    desc: '긴 창으로 멀리서 찌르고 2마리까지 꿰뚫는다.',
    look: {
      body: BODY.lancer, fx: '#9fd49a',
      pal: { h: '#6e5a2e', H: '#b8964a', a: '#3f6b4a', A: '#6fa37a', y: '#e8d27a', l: '#6e5a2e' },
    },
  },
  dragoon: {
    tier: 2, from: 'lancer', name: '용기병', icon: '🐉', weapon: 'dragonSpear',
    mods: { atk: 2.6, hp: 1.6, aspd: 0.9, crit: 0.1 },
    desc: '용의 힘을 두른 창. 하늘에서 내리꽂고 용의 숨결을 뿜는다.',
    look: {
      body: BODY.dragoon, fx: '#b388ff',
      pal: { n: '#e8e0d0', h: '#3b2458', H: '#6b45a0', v: '#ffcc33', a: '#2e1d47', A: '#5a3a8a', y: '#c0a0ff', b: '#1f1430', l: '#3b2458', k: '#1f1430' },
      cape: { style: 'cape', color: '#5a3a8a' },
    },
  },
  halberdier: {
    tier: 2, from: 'lancer', name: '할버디어', icon: '🪓', weapon: 'halberd',
    mods: { atk: 2.7, hp: 1.9, aspd: 0.8, crit: 0.08 },
    desc: '묵직한 할버드로 사거리 안의 적을 모두 휩쓸어 밀어낸다.',
    look: {
      body: BODY.halberdier, fx: '#ff9f40',
      pal: { h: '#6a6f7a', H: '#a7adb8', v: '#15161c', a: '#8a4a1a', A: '#c9772e', y: '#ffd257', b: '#3a2410', l: '#6a6f7a', k: '#3a2410' },
    },
  },

  // ── 활 계열 ──
  ranger: {
    tier: 1, from: 'squire', name: '레인저', icon: '🏹', weapon: 'bow',
    mods: { atk: 1.3, hp: 1.0, aspd: 1.25, crit: 0.08 },
    desc: '멀리서 화살을 쏜다. 적이 다가오는 동안 먼저 때린다.',
    look: {
      body: BODY.ranger, fx: '#7fd06a',
      pal: { g: '#2f5a2a', G: '#4f8a3c', s: '#f0c29a', e: '#1b1d27', L: '#8a5a2b', y: '#d9b36b', b: '#4a3220', l: '#6b4a2b', k: '#3a2616' },
    },
  },
  marksman: {
    tier: 2, from: 'ranger', name: '저격수', icon: '🎯', weapon: 'longbow',
    mods: { atk: 2.5, hp: 1.2, aspd: 0.8, crit: 0.3, critMult: 0.5 },
    desc: '아주 먼 거리에서 강력한 한 발. 치명타 확률이 높다.',
    look: {
      body: BODY.marksman, fx: '#e8e070',
      pal: { g: '#1d2f22', G: '#2f4a35', m: '#3a3a3a', e: '#ffe066', L: '#3b4a3a', y: '#a0a060', b: '#2a2016', l: '#2f3a2e', k: '#1a1a14' },
      cape: { style: 'cloak', color: '#22382a' },
    },
  },
  arcaneArcher: {
    tier: 2, from: 'ranger', name: '마궁수', icon: '🔮', weapon: 'arcaneBow',
    mods: { atk: 1.7, hp: 1.2, aspd: 1.35, crit: 0.1 },
    desc: '마력 화살 3발을 흩뿌려 여러 적을 동시에 맞힌다.',
    look: {
      body: BODY.arcaneArcher, fx: '#6ff3ff',
      pal: { g: '#1f2f6a', G: '#3a55b0', s: '#f0c29a', e: '#35e0ff', L: '#2a3f8a', c: '#6ff3ff', b: '#1a2450', l: '#2a3f8a', k: '#1a2450' },
      cape: { style: 'cloak', color: '#26398a' },
    },
  },

  // ── 마법사 계열: 지팡이로 마력탄을 쏜다 (원거리). 화염은 맞은 자리 주변까지 태우고, 냉기는 멀리서 빠르고 날카롭게 ──
  mage: {
    tier: 1, from: 'squire', name: '마법사', icon: '🪄', weapon: 'wand',
    mods: { atk: 1.37, hp: 0.95, aspd: 1.05, crit: 0.08 },
    desc: '지팡이로 마력탄을 쏜다. 몸은 약하지만 멀리서 강하게 때린다.',
    look: {
      body: BODY.mage, fx: '#9fd8ff',
      pal: { P: '#3a55b0', p: '#26398a', y: '#ffd257', s: '#f0c29a', e: '#1b1d27', r: '#26398a', R: '#3a55b0', b: '#5a3a1a', l: '#26398a', k: '#1a2450' },
    },
  },
  pyromancer: {
    tier: 2, from: 'mage', name: '화염술사', icon: '🔥', weapon: 'flameStaff',
    mods: { atk: 2.54, hp: 1.15, aspd: 1.0, crit: 0.1 },
    desc: '불덩이를 던진다. 맞은 자리에서 터져 주변 적까지 함께 태운다.',
    look: {
      body: BODY.pyromancer, fx: '#ff7a2a',
      pal: { P: '#a8281a', p: '#7a1a10', f: '#ffb13b', y: '#ffd257', s: '#f0c29a', e: '#1b1d27', r: '#5a1a10', R: '#a8281a', b: '#2a1008', l: '#5a1a10', k: '#2a1008' },
      cape: { style: 'cloak', color: '#5a1a10' },
    },
  },
  cryomancer: {
    tier: 2, from: 'mage', name: '빙결술사', icon: '❄️', weapon: 'frostStaff',
    mods: { atk: 2.29, hp: 1.3, aspd: 1.1, crit: 0.14, guard: 0.1 },
    desc: '얼음창을 멀리서 빠르게 꽂는다. 서리 갑옷이 받는 피해를 줄인다.',
    look: {
      body: BODY.cryomancer, fx: '#9fe8ff',
      pal: { P: '#e8f6ff', p: '#8fbfe0', c: '#5ad1ff', y: '#ffffff', s: '#f0d8e0', e: '#1b6fd1', r: '#3f6f9a', R: '#8fbfe0', b: '#1b3f6a', l: '#3f6f9a', k: '#1b3f6a' },
      cape: { style: 'cloak', color: '#1b3f6a' },
    },
  },

  // ── 3차 (2차마다 하나). 1차 스킬 자리를 궁극기가 대신한다 (숙련도는 그 1차 스킬 것을 그대로 쓴다, SKILLS 의 mastOf) ──
  archon: {
    tier: 3, from: 'paladin', name: '성좌기사', icon: '🌟', weapon: 'starBlade',
    mods: { atk: 2.03, hp: 2.4, aspd: 1.1, crit: 0.08, guard: 0.3, heal: 0.025 },
    desc: '별자리를 두른 성기사. 하늘의 성좌를 불러 내려 전장을 심판한다.',
    look: {
      body: BODY.archon, fx: '#9fd8ff',
      pal: { h: '#8fa8c8', H: '#f4f8ff', a: '#7f9cc8', A: '#eaf2ff', y: '#9fd8ff', v: '#1b2a4a', b: '#3a4f7a', w: '#ffffff', l: '#7f9cc8', k: '#3a4f7a' },
      cape: { style: 'cape', color: '#1f2f5a' },
      halo: true,
      shield: { face: '#eaf2ff', rim: '#9fd8ff', emblem: '#3d7bff' },
    },
  },
  swordsaint: {
    tier: 3, from: 'blademaster', name: '검신', icon: '🌸', weapon: 'moonBlades',
    mods: { atk: 1.74, hp: 1.7, aspd: 2.2, crit: 0.28, critMult: 0.8 },
    desc: '검의 끝에 닿은 자. 칼을 뽑는 순간 전장 전체가 갈라진다.',
    look: {
      body: BODY.swordsaint, fx: '#ff6a8a',
      pal: { n: '#ffd0dc', h: '#14141a', H: '#2a2a34', v: '#ff6a8a', a: '#f4f1e8', A: '#ffffff', R: '#c4203c', b: '#5a0a18', l: '#2a2b33', k: '#5a0a18' },
      cape: { style: 'scarf', color: '#ff6a8a' },
    },
  },
  dragonlord: {
    tier: 3, from: 'dragoon', name: '용황', icon: '🐲', weapon: 'wyrmSpear',
    mods: { atk: 3, hp: 2.1, aspd: 0.95, crit: 0.14 },
    desc: '용들의 왕이 된 기병. 창을 들면 하늘에서 용황이 내려온다.',
    look: {
      body: BODY.dragonlord, fx: '#ff4dd2',
      pal: { n: '#ffe066', h: '#1a0a28', H: '#5a1a6a', v: '#ff4dd2', a: '#1f0f30', A: '#4a1f6a', y: '#ff9fe8', b: '#12081c', l: '#2a1240', k: '#12081c' },
      cape: { style: 'cape', color: '#8a1f6a' },
    },
  },
  warlord: {
    tier: 3, from: 'halberdier', name: '전쟁군주', icon: '⚒️', weapon: 'doomAxe',
    mods: { atk: 3.18, hp: 2.5, aspd: 0.85, crit: 0.1 },
    desc: '전쟁 그 자체가 된 거인. 도끼창을 내리찍으면 땅이 끝까지 무너진다.',
    look: {
      body: BODY.warlord, fx: '#ff7a2a',
      pal: { n: '#e9e4d4', h: '#3a3e48', H: '#6a707c', v: '#ff5a1f', a: '#5a2410', A: '#a8481a', y: '#ffd257', b: '#2a1408', l: '#3a3e48', k: '#2a1408' },
      cape: { style: 'cape', color: '#7a1a10' },
    },
  },
  deadeye: {
    tier: 3, from: 'marksman', name: '신궁', icon: '☀️', weapon: 'sunBow',
    mods: { atk: 2.61, hp: 1.55, aspd: 0.85, crit: 0.4, critMult: 0.8 },
    desc: '태양을 쏘아 떨어뜨렸다는 궁수. 시위를 당기면 하늘이 열린다.',
    look: {
      body: BODY.deadeye, fx: '#ffe066',
      pal: { g: '#5a4a1a', G: '#8a7a3a', m: '#2a2416', e: '#ffe066', L: '#6a5a2a', y: '#ffd257', b: '#2a2016', l: '#4a3e22', k: '#2a2016' },
      cape: { style: 'cloak', color: '#c9a227' },
    },
  },
  voidArcher: {
    tier: 3, from: 'arcaneArcher', name: '차원궁사', icon: '🌀', weapon: 'voidBow',
    mods: { atk: 1.72, hp: 1.55, aspd: 1.45, crit: 0.14 },
    desc: '차원의 틈을 활시위로 삼는다. 화살 네 발이 공간을 찢으며 날아간다.',
    look: {
      body: BODY.voidArcher, fx: '#ff4dff',
      pal: { g: '#1a0a30', G: '#3a1a6a', s: '#e8c8f0', e: '#ff4dff', L: '#2a1250', c: '#ff8aff', b: '#12081c', l: '#2a1250', k: '#12081c' },
      cape: { style: 'cloak', color: '#2a0a4a' },
    },
  },
  archmage: {
    tier: 3, from: 'pyromancer', name: '대마도사', icon: '☄️', weapon: 'infernoStaff',
    mods: { atk: 2.93, hp: 1.5, aspd: 1.05, crit: 0.12 },
    desc: '불의 근원에 닿은 마도사. 지팡이를 들면 하늘에서 겁화가 쏟아진다.',
    look: {
      body: BODY.pyromancer, fx: '#ff3b1f',
      pal: { P: '#1a0a0a', p: '#3a0e0a', f: '#ffd257', y: '#ff3b1f', s: '#f0c29a', e: '#ff3b1f', r: '#2a0a08', R: '#6a140c', b: '#ffd257', l: '#2a0a08', k: '#1a0606' },
      cape: { style: 'cape', color: '#8a1a0c' },
      halo: true,
    },
  },
  frostlord: {
    tier: 3, from: 'cryomancer', name: '빙결의 군주', icon: '🧊', weapon: 'glacierStaff',
    mods: { atk: 2.62, hp: 1.75, aspd: 1.15, crit: 0.18, guard: 0.15 },
    desc: '만년설을 다스리는 군주. 숨을 내쉬면 전장의 시간까지 얼어붙는다.',
    look: {
      body: BODY.cryomancer, fx: '#cff6ff',
      pal: { P: '#ffffff', p: '#cfe8ff', c: '#9fe8ff', y: '#5ad1ff', s: '#e8e0f0', e: '#5ad1ff', r: '#1b3f6a', R: '#cfe8ff', b: '#0e2240', l: '#1b3f6a', k: '#0e2240' },
      cape: { style: 'cape', color: '#e8f6ff' },
    },
  },
};

// ───────────────────────── 스킬 ─────────────────────────
// 직업마다 1차 1종, 2차 2종. 해금 레벨이 되면 교전 중 쿨타임이 찬 스킬부터 쓰고, 없으면 평타를 친다 (레벨 높은 스킬 우선).
// 수치(여기)는 원정·결투·레이드·DPS 계산이 함께 쓰고, 모션과 이펙트는 src/skills.js 의 SKILL_FX 에 있다.
//  lv 해금 레벨 (0 이면 전직하자마자) · cd 쿨타임(초) · dur 시전 시간(초) — 이 동안은 평타·이동을 멈춘다
//  hits: [[시점(dur 비율 0~1), 배율], ...] — 배율의 합이 대상 하나가 받는 총 피해
//  area: single 가장 가까운 적 | line 앞쪽 일직선 (무기 사거리 × reach) | all 사거리 + radius 안의 적 모두
//  crit 치명타 확정 · air: [시작, 끝] 이 구간엔 공중에 있어 맞지 않는다
//  ward: 시전이 끝나면 펼치는 보호막 { dur 초, guard 받는 피해 감소, heal 즉시 회복(최대 체력 비율), tick 보호막 동안 초당 주변 피해 배율,
//        finish 보호막이 끝날 때 터지는 마무리 타격 배율 }
//  hits 의 세 번째 칸(선택): 그 타격만의 대상 { area, radius, reach, launch 맞은 적을 띄움 } — 예: 첫 타는 눈앞 하나, 검풍은 일직선
//  stages: 숙련 단계(0 = Lv1~9, 1 = ★숙련 Lv10, 2 = ★★달인 Lv20, 3 = ★★★극의 Lv30)마다 기술의 모양을 덮어쓴다 (skillAt).
//          진화 사다리: Lv1 맨몸 기술(제자리·짧게) → ★ 무기 각성(멀리 닿음) → ★★ 전장이 바뀜(분신·지형·소환물) → ★★★ 궁극(거대 소환·시간 정지)
//  stageName·stageDesc: 단계마다 기술 이름이 진화하고(이름 띠·숙련도 패널), 그 단계의 모습을 한 줄로
//          타격 배율은 비율만 뜻한다 — 합이 위의 원래 배율(skillMult)과 같아지도록 자동으로 맞추고, 위력 성장은 skillPowAt 이 따로 곱한다.
//          그래서 타격 횟수·마무리 일격이 늘어도 단계별 DPS 곡선(숙련도 설명 참고)은 그대로다.
const evenHits = (n, from, step, mult) => Array.from({ length: n }, (_, i) => [from + step * i, mult]);

// 질풍난무 동선 시간표(초): n 번 지그재그로 베고 → 뛰어올라 X자로 내리꽂고 → (fin) 다시 높이 솟구쳐 마무리 일격으로 내려찍는다.
// skills.js 의 galeAt 이 같은 시간표로 자세를 그린다
function galePlan(n, fin) {
  const stops = [];
  let t = 0.078;                                   // 준비 자세
  for (let i = 0; i < n; i++) stops.push(t += 0.117);
  const rise = t + 0.182, hang = rise + 0.052, x = hang + 0.104, hold = x + 0.078;
  const f = fin ? { up: hold + 0.2, top: hold + 0.26, hit: hold + 0.34, land: hold + 0.44 } : null;
  const dur = Math.round((f ? f.land + 0.12 : hold + 0.104) * 100) / 100;
  return { stops, rise, hang, x, hold, fin: f, dur };
}
function galeStage(n, fin) {
  const P = galePlan(n, fin), u = (sec) => sec / P.dur;
  return {
    dur: P.dur, n, fin,
    hits: [...P.stops.map((s) => [u(s), 0.5]), [u(P.x), 1.2], ...(fin ? [[u(P.fin.hit), 1.8, { area: 'all', radius: 60 }]] : [])],
  };
}
const SKILLS = {
  // ── 1차 ──
  steelCleave: {
    cls: 'swordsman', name: '강철 베기', icon: '⚔️', lv: 25, cd: 8, dur: 0.7, area: 'single',
    hits: [[0.5, 2.6]],
    stages: [
      {},
      { hits: [[0.5, 2.0], [0.66, 0.8, { area: 'line', reach: 3 }]] },
      { dur: 0.8, hits: [[0.44, 1.8, { area: 'all', radius: 40 }], [0.6, 1.0, { area: 'line', reach: 3.5 }]] },
      { dur: 1.25, hits: [[0.28, 0.9], [0.8, 2.4, { area: 'all', radius: 64 }]] },
    ],
    stageName: ['강철 베기', '강철 검풍', '강철 대검', '천강검'],
    stageDesc: ['제자리에서 내려벤다', '검이 빛나며 초승달 검풍을 날린다', '검이 거대한 강철 대검으로 변해 내려찍고, 땅에서 바위 송곳이 솟는다', '검을 하늘로 치켜들면 거대한 강철 검이 떨어져 꽂힌다'],
    desc: '검을 머리 위로 치켜들었다가 크게 내려벤다.',
  },
  piercingThrust: {
    cls: 'lancer', name: '관통 찌르기', icon: '🔱', lv: 25, cd: 9, dur: 0.65, area: 'line', reach: 1.6,
    hits: [[0.45, 2.3]],
    stages: [
      { dur: 0.55, reach: 1.0, hits: [[0.5, 1]] },
      {},
      { dur: 0.8, hits: [[0.37, 1.3], [0.6, 1.0, { area: 'line', reach: 3.5 }]] },
      { dur: 1.2, hits: [[0.5, 0.8], [0.58, 0.5, { area: 'line', reach: 6 }], [0.65, 0.5, { area: 'line', reach: 6 }], [0.72, 0.5, { area: 'line', reach: 6 }], [0.8, 1.0, { area: 'line', reach: 6 }]] },
    ],
    stageName: ['찌르기', '관통 찌르기', '투창', '천공창'],
    stageDesc: ['제자리에서 짧게 찌른다', '웅크렸다가 돌진하며 일직선을 꿰뚫는다', '찌른 창의 빛이 떨어져 나가 멀리 날아가 꽂히고, 한동안 떨며 서 있다', '등 뒤에 거대한 빛의 창이 맺혀 — 나선으로 회전하며 하단바 끝까지 뚫는다'],
    desc: '뒤로 웅크렸다가 돌진하며 찔러 일직선의 적을 모두 꿰뚫는다.',
  },
  rapidFire: {
    cls: 'ranger', name: '연사', icon: '🏹', lv: 25, cd: 8, dur: 0.8, area: 'single',
    hits: evenHits(4, 0.25, 0.15, 0.7),
    stages: [
      { dur: 0.6, hits: [[0.4, 1], [0.66, 1]] },
      {},
      { dur: 0.95, area: 'all', radius: 40, hits: evenHits(5, 0.22, 0.13, 0.7) },
      { dur: 1.4, area: 'all', radius: 60, hits: [...evenHits(6, 0.2, 0.08, 0.5), [0.82, 1.6]] },
    ],
    stageName: ['두 발 쏘기', '연사', '분열 화살', '바람매 연사'],
    stageDesc: ['화살 두 발을 쏜다', '화살 네 발을 숨 돌릴 틈 없이', '화살이 날아가다 세 갈래로 갈라져 주변까지 맞힌다', '빛나는 바람매가 날아올라 화살과 함께 맴돌다 — 적을 꿰뚫으며 급강하한다'],
    desc: '화살 4발을 숨 돌릴 틈 없이 쏜다.',
  },

  // ── 성기사 ──
  judgment: {
    cls: 'paladin', name: '심판의 일격', icon: '⚡', lv: 60, cd: 10, dur: 1.0, area: 'all', radius: 60,
    hits: [[0.6, 4]],
    stages: [
      { radius: 40 },
      { radius: 60 },
      { dur: 1.2, radius: 60, hits: [[0.55, 1], [0.65, 1], [0.77, 1.4]] },
      { dur: 1.6, radius: 80, hits: [[0.375, 1.0], [0.82, 3.0, { area: 'all', radius: 100, launch: true }]] },
    ],
    stageName: ['심판의 빛', '심판의 일격', '심판의 성검', '대천사 강림'],
    stageDesc: ['가느다란 빛줄기가 내리친다', '빛기둥이 내리꽂히고 적에게 심판의 낙인이 새겨진다', '하늘에 성검 세 자루가 떠올라 차례로 꽂힌다', '기사 뒤로 날개 달린 대천사가 강림해 함께 내리친다 — 적을 띄운다'],
    desc: '성검을 하늘로 들어 적 위에 황금 빛기둥을 내리꽂는다.',
  },
  sanctuary: {
    cls: 'paladin', name: '성역', icon: '🛡️', lv: 70, cd: 18, dur: 0.9, area: 'all', radius: 40,
    hits: [], ward: { dur: 4, guard: 0.5, heal: 0.2, tick: 0.5 },
    stages: [
      { ward: { dur: 3 } },
      { ward: { dur: 4 } },
      { ward: { dur: 4, heal: 0.3 }, hits: [[0.55, 0.5, { area: 'all', radius: 44 }]] },
      { ward: { dur: 4, heal: 0.3, finish: 1 }, hits: [[0.55, 0.4, { area: 'all', radius: 44 }]] },
    ],
    stageName: ['성광', '성역', '성채', '성전'],
    stageDesc: ['발밑에 빛의 원 3초', '황금 돔 4초', '돔 둘레에 성벽 기둥 넷이 솟아 적을 밀어내고, 회복 20% → 30%', '성당이 세워져 종이 울리고, 끝날 때 빛으로 무너지며 성광이 터진다'],
    desc: '성검을 땅에 꽂아 황금 성역을 펼친다. 받는 피해 -50%, 체력 회복, 안의 적은 계속 불탄다.',
  },

  // ── 검성 ──
  gale: {
    cls: 'blademaster', name: '질풍난무', icon: '🌪️', lv: 60, cd: 10, dur: 1.3, area: 'all', radius: 40,
    hits: [...evenHits(6, 0.15, 0.09, 0.5), [0.86, 1.2]],
    stages: [
      { dur: 0.75, trio: true, hits: [[0.3, 1], [0.48, 1], [0.66, 1.2]] },
      galeStage(5, false),
      { ...galeStage(6, false), clones: 1 },
      { ...galeStage(6, true), clones: 3 },
    ],
    stageName: ['삼연참', '질풍난무', '질풍난무·분신', '월하난무'],
    stageDesc: ['제자리에서 쌍검으로 세 번', '적 사이를 지그재그로 돌진하며 5번 베고 X자', '그림자 분신이 반대편에서 함께 난무 (6회)', '분신 셋과 함께 — 시간이 멎은 듯 어두워졌다가 솟구쳐 내려찍는 마무리 일격'],
    desc: '모습을 감추고 적 사이를 오가며 6번 벤 뒤 X자로 마무리한다.',
  },
  iaido: {
    cls: 'blademaster', name: '일섬', icon: '🌙', lv: 70, cd: 15, dur: 1.4, area: 'all', radius: 200, crit: true,
    hits: [[0.78, 4]],
    stages: [
      { dur: 0.9, radius: 60, hits: [[0.5, 1]] },
      { radius: 140 },
      { radius: 200, kb: 32, hits: [[0.78, 0.5], [0.92, 1.5, { area: 'all', radius: 200 }]] },
      { dur: 1.9, radius: 200, kb: 32, hits: [[0.575, 2.0], [0.66, 0.6], [0.86, 2.2]] },
    ],
    stageName: ['발도', '일섬', '일섬·납도', '적월일섬'],
    stageDesc: ['제자리에서 한 번 발도', '섬광처럼 돌진해 지나가며 벤다', '칼을 거두는 순간 지나간 적이 모두 늦게 갈라지고, 하단바를 가로지르는 검선', '붉은 달이 뜨고 — 돌아서서 되돌아오는 이중 일섬'],
    desc: '숨을 죽인 발도 자세에서 한 줄기 섬광으로 지나간다. 늦게 터지는 베기는 반드시 치명타.',
  },

  // ── 용기병 ──
  // 용기병은 예전부터 도약이 직업의 핵심이라 전직하자마자 쓴다 (도약을 스킬로 옮기며 Lv50~59 가 약해지지 않도록)
  dragonFall: {
    cls: 'dragoon', name: '용추락', icon: '☄️', lv: 0, cd: 8, dur: 1.1, area: 'all', radius: 80, air: [0.15, 0.72],
    hits: [[0.72, 3]],
    stages: [
      { dur: 0.8, radius: 40, air: [0.15, 0.6], hits: [[0.62, 1]] },
      {},
      { hits: [[0.72, 2.4], [0.9, 0.6, { area: 'all', radius: 70 }]] },
      { dur: 1.4, radius: 90, air: [0.12, 0.565], hits: [[0.565, 1.8], [0.68, 0.4, { area: 'all', radius: 110 }], [0.74, 0.4, { area: 'all', radius: 110 }], [0.8, 0.4, { area: 'all', radius: 110 }]] },
    ],
    stageName: ['도약 찌르기', '용추락', '용추락·업화', '유성룡'],
    stageDesc: ['낮게 뛰어올라 내려찍는다', '화면 위로 솟구쳤다가 유성처럼 내리꽂힌다', '내리꽂힌 자리에 보라 불바다가 한동안 타오른다', '보라 용의 몸통을 끌며 떨어지고 — 뒤따라 유성 파편 셋이 쏟아진다'],
    desc: '화면 위로 솟구쳤다가 유성처럼 내리꽂혀 땅을 가른다.',
  },
  dragonBreath: {
    cls: 'dragoon', name: '용의 숨결', icon: '🔥', lv: 70, cd: 14, dur: 1.8, area: 'line', reach: 2.2,
    hits: evenHits(8, 0.25, 0.08, 0.5),
    stages: [
      { dur: 1.0, reach: 1.2, hits: evenHits(4, 0.3, 0.12, 0.5) },
      {},
      { dur: 1.9, reach: 2.6, hits: evenHits(10, 0.22, 0.065, 0.5) },
      { dur: 2.3, reach: 6, hits: [...evenHits(8, 0.42, 0.05, 0.5), [0.86, 2.0]] },
    ],
    stageName: ['화염 숨', '용의 숨결', '삼두룡의 숨결', '용왕의 포효'],
    stageDesc: ['창끝에서 짧은 불꽃을 뿜는다', '창끝의 용머리가 보라 불꽃을 쏟는다', '용머리 셋이 나타나 세 갈래 부채꼴로 불꽃을 쏟는다', '거대한 용왕의 머리가 솟아 포효하고 — 하단바 끝까지 닿는 광선을 내뿜는다'],
    desc: '창끝에 깃든 용이 보라색 불꽃을 쏟아낸다.',
  },

  // ── 할버디어 ──
  whirlwind: {
    cls: 'halberdier', name: '대회전', icon: '🌀', lv: 60, cd: 9, dur: 1.0, area: 'all', radius: 30,
    hits: [[0.38, 1.4], [0.78, 1.4]],
    stages: [
      { dur: 0.6, radius: 20, hits: [[0.5, 1]] },
      {},
      { dur: 1.35, radius: 40, hits: [[0.3, 1], [0.55, 1], [0.8, 1.2]] },
      { dur: 1.9, radius: 50, hits: [[0.25, 0.6], [0.4, 0.6], [0.55, 0.6], [0.68, 0.6], [0.86, 2.0, { area: 'all', radius: 70 }]] },
    ],
    stageName: ['휩쓸기', '대회전', '회오리 대회전', '폭풍 참격'],
    stageDesc: ['할버드를 반 바퀴 휘두른다', '두 바퀴 돌며 주변을 쓸어 날린다', '세 바퀴 — 흙먼지 회오리가 일어나 앞으로 굴러간다', '먹구름이 몰려와 도는 동안 벼락이 내리꽂히고 — 하늘로 떠올랐다가 내려찍는다'],
    desc: '할버드를 들고 두 바퀴 돌며 주변을 모두 쓸어 날린다.',
  },
  earthSplitter: {
    cls: 'halberdier', name: '대지 가르기', icon: '⛰️', lv: 70, cd: 15, dur: 1.4, area: 'line', reach: 4,
    hits: [[0.6, 4]],
    stages: [
      { dur: 0.9, reach: 1.6, hits: [[0.55, 1]] },
      {},
      { dur: 1.6, reach: 5, hits: [[0.55, 2.4], [0.7, 0.8, { area: 'line', reach: 5, launch: true }], [0.82, 0.8, { area: 'line', reach: 5 }]] },
      { dur: 1.9, reach: 6, hits: [[0.53, 1.6], [0.66, 0.8, { area: 'line', reach: 6 }], [0.74, 0.8, { area: 'line', reach: 6 }], [0.82, 1.4, { area: 'line', reach: 6, launch: true }]] },
    ],
    stageName: ['내려찍기', '대지 가르기', '대지 진동', '대지 분쇄'],
    stageDesc: ['제자리에서 내려찍어 짧은 금을 낸다', '뛰어올라 내려찍으면 땅이 갈라지며 바위가 솟는다', '땅이 파도처럼 출렁이며 앞으로 밀려가 적을 띄운다', '높이 솟아 내려찍으면 대지가 쪼개져 용암이 뿜어져 나온다'],
    desc: '뛰어올라 내리찍으면 땅이 앞으로 갈라지며 바위가 솟구친다.',
  },

  // ── 저격수 ──
  headshot: {
    cls: 'marksman', name: '헤드샷', icon: '🎯', lv: 60, cd: 12, dur: 1.1, area: 'single', crit: true,
    hits: [[0.75, 2.2]],
    stages: [
      { dur: 0.8, hits: [[0.6, 1]] },
      {},
      { area: 'line', reach: 4, hits: [[0.75, 1]] },
      { dur: 2.0, hits: [[0.82, 1]] },
    ],
    stageName: ['조준 사격', '헤드샷', '관통 헤드샷', '정적의 일발'],
    stageDesc: ['짧게 겨눠 한 발', '무릎 꿇고 조준선을 좁혀 급소를', '머리를 꿰뚫은 탄이 뒤의 적까지 — 지나간 자리에 열선이 일렁인다', '하단바가 조준경 속처럼 가라앉고, 느리게 날아가는 한 발이 공기를 가르며 — 유리처럼 깨진다'],
    desc: '무릎을 꿇고 숨을 고른 뒤 급소를 꿰뚫는다. 반드시 치명타.',
  },
  armorPiercer: {
    cls: 'marksman', name: '철갑 관통탄', icon: '💥', lv: 70, cd: 16, dur: 1.2, area: 'line', reach: 3,
    hits: [[0.6, 3]],
    stages: [
      { dur: 0.9, reach: 2, hits: [[0.6, 1]] },
      {},
      { hits: [[0.6, 2.0], [0.68, 1.0, { area: 'all', radius: 44 }]] },
      { dur: 2.0, reach: 6, hits: [[0.5, 1], [0.66, 1], [0.82, 1.4]] },
    ],
    stageName: ['강궁 사격', '철갑 관통탄', '폭렬 관통탄', '공성 노포'],
    stageDesc: ['힘껏 당겨 묵직한 한 발', '화면 끝까지 꿰뚫는 한 발, 반동에 밀려난다', '맞은 자리에서 포탄처럼 터져 파편이 흩어진다', '옆에 거대한 공성 노포를 세워 — 굵은 쇠뇌 살 세 발로 하단바 끝까지 꿰어 박는다'],
    desc: '시위를 끝까지 당겨 화면 끝까지 꿰뚫는 한 발. 반동에 몸이 밀려난다.',
  },

  // ── 마궁수 ──
  homingBolts: {
    cls: 'arcaneArcher', name: '유도 마탄', icon: '✴️', lv: 60, cd: 9, dur: 1.0, area: 'all', radius: 60,
    hits: evenHits(6, 0.6, 0.05, 0.8),
    stages: [
      { dur: 0.8, hits: [[0.55, 1], [0.65, 1]] },
      {},
      { dur: 1.5, hits: evenHits(8, 0.5, 0.05, 0.8) },
      { dur: 2.0, radius: 90, hits: [...evenHits(4, 0.4, 0.06, 0.4), [0.82, 2.4, { area: 'all', radius: 90 }]] },
    ],
    stageName: ['마력탄', '유도 마탄', '마탄 군무', '마력 붕괴'],
    stageDesc: ['마력탄 두 발이 곧게 날아간다', '등 뒤 마법진에서 마력탄 6발이 휘어 쫓는다', '마력탄 8발이 기사 둘레를 돌며 춤추다가 하나씩 날아간다', '마력탄이 적 위에 소용돌이 특이점을 만들어 — 주변을 빨아들였다가 터뜨린다'],
    desc: '등 뒤 마법진에서 마력탄 6발이 곡선을 그리며 적을 쫓는다.',
  },
  starfall: {
    cls: 'arcaneArcher', name: '별빛 화살비', icon: '🌠', lv: 70, cd: 16, dur: 2.2, area: 'all', radius: 200,
    hits: evenHits(10, 0.35, 0.06, 0.7),
    stages: [
      { dur: 1.2, radius: 120, hits: evenHits(3, 0.45, 0.12, 0.7) },
      {},
      { dur: 2.4, hits: evenHits(12, 0.32, 0.05, 0.7) },
      { dur: 2.8, hits: [...evenHits(10, 0.3, 0.045, 0.5), [0.86, 2.5]] },
    ],
    stageName: ['별똥 화살', '별빛 화살비', '별자리 화살비', '별이 지는 밤'],
    stageDesc: ['하늘로 쏜 화살이 별똥처럼 세 발 떨어진다', '하늘에 마법진을 열어 별빛 화살을 쏟는다', '하늘에 별이 하나씩 켜져 별자리로 이어지고 — 별마다 화살이 떨어진다', '하단바가 밤하늘로 물들고 오로라가 흐르다 — 거대한 별이 떨어져 부서진다'],
    desc: '하늘에 마법진을 열어 별빛 화살을 쏟아붓는다.',
  },

  // ── 마법사 계열 ──
  manaBurst: {
    cls: 'mage', name: '마력 폭발', icon: '🪄', lv: 25, cd: 8, dur: 0.75, area: 'single',
    hits: [[0.55, 2.5]],
    stages: [
      { dur: 0.6, hits: [[0.6, 1]] },
      {},
      { dur: 0.9, area: 'all', radius: 44, hits: [[0.5, 1.4], [0.7, 1.1, { area: 'all', radius: 44 }]] },
      { dur: 1.3, area: 'all', radius: 60, hits: [[0.35, 0.6], [0.5, 0.6], [0.82, 1.8, { area: 'all', radius: 70 }]] },
    ],
    stageName: ['마력탄', '마력 폭발', '마력 폭풍', '비전 붕괴'],
    stageDesc: ['지팡이 끝에서 큰 마력탄 한 발', '적 앞에서 마력 구체가 부풀었다 터진다', '마법진이 적 발밑에 펼쳐지고 두 번 연달아 폭발한다', '공중에 비전 고리 셋이 겹쳐 돌다가 하나로 붕괴하며 크게 터진다'],
    desc: '지팡이 끝에 마력을 모아 적 앞에서 터뜨린다.',
  },
  meteor: {
    cls: 'pyromancer', name: '메테오', icon: '☄️', lv: 60, cd: 11, dur: 1.2, area: 'all', radius: 60,
    hits: [[0.7, 4]],
    stages: [
      { dur: 0.9, radius: 40, hits: [[0.65, 1]] },
      {},
      { dur: 1.5, radius: 70, hits: [[0.55, 1], [0.68, 1], [0.8, 1.4]] },
      { dur: 1.8, radius: 90, hits: [[0.72, 2.6], [0.86, 1.0, { area: 'all', radius: 110 }]] },
    ],
    stageName: ['불덩이 낙하', '메테오', '유성우', '겁화 운석'],
    stageDesc: ['하늘에서 작은 불덩이 하나가 떨어진다', '불타는 운석이 꼬리를 끌며 내리꽂혀 불꽃이 튄다', '운석 셋이 차례로 떨어지고 땅에 불길이 남는다', '하늘을 가리는 거대한 운석이 떨어져 — 충격파와 함께 용암이 튄다'],
    desc: '지팡이를 하늘로 들어 불타는 운석을 떨어뜨린다.',
  },
  flameVortex: {
    cls: 'pyromancer', name: '화염 회오리', icon: '🌪️', lv: 70, cd: 15, dur: 1.6, area: 'all', radius: 50,
    hits: evenHits(6, 0.3, 0.1, 0.7),
    stages: [
      { dur: 1.0, radius: 30, hits: evenHits(3, 0.35, 0.15, 0.7) },
      {},
      { dur: 1.9, radius: 60, hits: evenHits(9, 0.25, 0.07, 0.6) },
      { dur: 2.2, radius: 80, hits: [...evenHits(8, 0.22, 0.06, 0.5), [0.86, 2]] },
    ],
    stageName: ['불기둥', '화염 회오리', '쌍둥이 회오리', '화염 폭풍'],
    stageDesc: ['적 발밑에서 불기둥이 솟는다', '불의 회오리가 적을 감싸 돌며 태운다', '회오리 둘이 양쪽에서 휘감아 하나로 합쳐진다', '하늘까지 닿는 화염 폭풍이 일어 — 마지막에 위에서부터 터져 내린다'],
    desc: '적 발밑에서 불의 회오리를 일으켜 감싸 태운다.',
  },
  iceLance: {
    cls: 'cryomancer', name: '얼음창', icon: '🧊', lv: 60, cd: 10, dur: 1.0, area: 'line', reach: 1.3, crit: true,
    hits: [[0.55, 2.4]],
    stages: [
      { dur: 0.7, reach: 1.0, hits: [[0.6, 1]] },
      {},
      { dur: 1.3, reach: 1.4, hits: [[0.45, 1], [0.6, 1], [0.75, 1]] },
      { dur: 1.7, reach: 2, hits: [[0.4, 0.6], [0.5, 0.6], [0.6, 0.6], [0.7, 0.6], [0.85, 1.6]] },
    ],
    stageName: ['얼음 화살', '얼음창', '얼음창 일제', '빙창 폭우'],
    stageDesc: ['날카로운 얼음 조각 하나를 쏜다', '굵은 얼음창이 일직선을 꿰뚫고, 맞은 자리에 서리가 핀다', '등 뒤에 얼음창 셋이 떠올라 차례로 날아간다', '하늘 가득 얼음창이 맺혀 쏟아지고 — 마지막 거대한 빙창이 꽂히며 깨진다'],
    desc: '굵은 얼음창을 쏘아 일직선의 적을 꿰뚫는다. 반드시 치명타.',
  },
  blizzard: {
    cls: 'cryomancer', name: '블리자드', icon: '🌨️', lv: 70, cd: 15, dur: 2.0, area: 'all', radius: 80,
    hits: evenHits(8, 0.2, 0.09, 0.5),
    stages: [
      { dur: 1.2, radius: 50, hits: evenHits(4, 0.25, 0.15, 0.5) },
      {},
      { dur: 2.2, radius: 90, hits: evenHits(10, 0.18, 0.075, 0.5) },
      { dur: 2.5, radius: 110, hits: [...evenHits(8, 0.18, 0.07, 0.4), [0.88, 2]] },
    ],
    stageName: ['서리 바람', '블리자드', '빙설 폭풍', '영구 동토'],
    stageDesc: ['차가운 바람에 서리가 흩날린다', '눈보라가 몰아쳐 주변 적을 계속 얼린다', '하늘이 흐려지고 우박이 섞인 폭풍이 넓게 몰아친다', '땅이 통째로 얼어붙고 — 마지막에 얼음 결정이 솟구치며 산산이 깨진다'],
    desc: '주변에 눈보라를 일으켜 적을 계속 얼린다.',
  },

  // ── 3차 궁극기: 1차 스킬 자리를 대신한다 (mastOf — 숙련도는 그 1차 스킬 것을 그대로 이어 쓴다) ──
  // 쿨타임이 길고 숙련도로 조금만 준다 (cdSpan: Lv1 60초 → Lv30 40초 — 다른 스킬의 ×3.0 → ×1.2 곡선 대신). 하단바 전체를 쓰는 화면 연출이 있는 한 방. 연출은 src/ult/*.js
  //  ult: true — 시전하는 동안 하단바 전체를 덮는 연출을 허락한다 (skills.js 의 '화면 전체를 쓰지 않는다' 규칙의 예외)
  starJudgment: {
    cls: 'archon', mastOf: 'steelCleave', ult: true, name: '성좌 강림', icon: '🌟', lv: 100, cd: 20, cdSpan: [60, 40], dur: 2.6, area: 'all', radius: 230,
    hits: [...evenHits(5, 0.45, 0.07, 1), [0.86, 4]],
    stages: [
      { dur: 2.3, hits: [...evenHits(3, 0.5, 0.1, 1), [0.85, 3]] },
      {},
      { dur: 2.9, hits: [...evenHits(12, 0.36, 0.036, 0.5), [0.88, 4]] },
      { dur: 3.3, hits: [...evenHits(12, 0.3, 0.032, 0.5), [0.72, 2], [0.9, 5, { area: 'all', radius: 260, launch: true }]] },
    ],
    stageName: ['성좌의 빛', '성좌 강림', '십이성좌', '창세의 빛'],
    stageDesc: [
      '하단바가 밤하늘로 물들고 별 셋이 떨어진 뒤 큰 별 하나가 내리꽂힌다',
      '별들이 선으로 이어져 거대한 기사 성좌가 떠오르고, 성좌의 검이 하단바를 내리긋는다',
      '열두 성좌가 차례로 켜지며 별비가 쏟아지고, 마지막에 성좌들이 한 점으로 모여 터진다',
      '하늘이 갈라져 새하얀 창세의 빛이 쏟아진다 — 모든 별이 한 번에 떨어지고 빛기둥이 하단바 전체를 덮는다',
    ],
    desc: '하늘의 성좌를 불러 내려 하단바 전체에 별을 떨어뜨린다.',
  },
  thousandCuts: {
    cls: 'swordsaint', mastOf: 'steelCleave', ult: true, name: '천검', icon: '🌸', lv: 100, cd: 20, cdSpan: [60, 40], dur: 2.4, area: 'all', radius: 230,
    hits: [...evenHits(8, 0.4, 0.05, 0.6), [0.9, 4]],
    stages: [
      { dur: 2.0, hits: [...evenHits(4, 0.42, 0.08, 0.8), [0.88, 3]] },
      {},
      { dur: 2.8, hits: [...evenHits(14, 0.3, 0.035, 0.4), [0.9, 4]] },
      { dur: 3.2, hits: [...evenHits(16, 0.26, 0.03, 0.35), [0.82, 1.5], [0.93, 5]] },
    ],
    stageName: ['천검', '천검·만화', '천검·벚꽃폭풍', '무명검·천지개벽'],
    stageDesc: [
      '모습이 사라지고 하단바 위에 검선 네 줄이 그어진 뒤, 칼을 거두는 순간 한꺼번에 갈라진다',
      '하단바가 흑백으로 멎은 듯 가라앉고, 수십 갈래 검선이 사방에서 그어진 뒤 한 번에 터진다',
      '벚꽃잎이 폭풍처럼 몰아치고 꽃잎 하나하나가 칼날이 되어 하단바를 가득 메운다',
      '하단바가 위아래로 두 동강 나며 어긋났다가 — 칼집에 칼이 들어가는 소리와 함께 다시 붙고, 그 틈으로 빛이 터진다',
    ],
    desc: '보이지 않는 속도로 하단바 전체를 수십 번 벤 뒤, 칼을 거두는 순간 모두 갈라진다. 반드시 치명타.', crit: true,
  },
  dragonEmperor: {
    cls: 'dragonlord', mastOf: 'piercingThrust', ult: true, name: '용황 강림', icon: '🐲', lv: 100, cd: 20, cdSpan: [60, 40], dur: 2.8, area: 'all', radius: 230,
    hits: [...evenHits(8, 0.45, 0.05, 0.6), [0.9, 4]],
    stages: [
      { dur: 2.3, hits: [...evenHits(4, 0.5, 0.08, 0.8), [0.88, 3]] },
      {},
      { dur: 3.0, hits: [...evenHits(12, 0.38, 0.04, 0.5), [0.9, 4]] },
      { dur: 3.4, hits: [...evenHits(10, 0.3, 0.035, 0.5), [0.75, 2], [0.92, 5, { area: 'all', radius: 260, launch: true }]] },
    ],
    stageName: ['흑룡 소환', '용황 강림', '쌍룡 강림', '용신의 심판'],
    stageDesc: [
      '창을 하늘로 치켜들면 흑룡 한 마리가 하단바를 가로질러 날며 불을 뿜는다',
      '하늘이 갈라지고 거대한 용황이 하단바 위를 휘감아 날며 보랏빛 불길로 전부 태운다',
      '용황 둘이 양쪽 끝에서 마주 날아와 교차하며 불길을 쏟고, 하단바가 불바다가 된다',
      '하단바보다 큰 용신의 눈이 하늘에 떠오르고 — 용신의 숨결이 하늘에서 내리꽂혀 땅 전체가 녹아내린다',
    ],
    desc: '창을 하늘로 치켜들어 용황을 불러 내린다. 거대한 용이 하단바를 휘감아 날며 모든 적을 태운다.',
  },
  worldBreaker: {
    cls: 'warlord', mastOf: 'piercingThrust', ult: true, name: '천붕', icon: '⚒️', lv: 100, cd: 20, cdSpan: [60, 40], dur: 2.6, area: 'all', radius: 230,
    hits: [[0.55, 3], ...evenHits(4, 0.65, 0.05, 1), [0.9, 3]],
    stages: [
      { dur: 2.2, hits: [[0.6, 3], [0.8, 2]] },
      {},
      { dur: 2.9, hits: [[0.5, 2.5], ...evenHits(6, 0.6, 0.04, 0.8), [0.9, 3]] },
      { dur: 3.3, hits: [[0.45, 2], ...evenHits(6, 0.55, 0.035, 0.6), [0.8, 2], [0.93, 5, { area: 'all', radius: 260, launch: true }]] },
    ],
    stageName: ['대지 분쇄', '천붕', '천붕지열', '종말의 일격'],
    stageDesc: [
      '하늘 높이 뛰어올랐다가 내려찍어 하단바 끝까지 땅을 쪼갠다',
      '하늘이 무너지듯 거대한 도끼창 그림자가 떨어지고, 하단바 전체가 흔들리며 땅이 들썩인다',
      '내려찍은 자리에서 균열이 하단바 끝까지 달리며 용암 기둥이 줄줄이 솟구친다',
      '하단바 위에 거인의 도끼가 나타나 내리찍고 — 땅이 통째로 뒤집히며 파편이 하늘로 솟았다가 쏟아진다',
    ],
    desc: '하늘이 무너지듯 내리찍어 하단바 끝까지 땅을 무너뜨린다.',
  },
  sunArrow: {
    cls: 'deadeye', mastOf: 'rapidFire', ult: true, name: '태양 관통', icon: '☀️', lv: 100, cd: 20, cdSpan: [60, 40], dur: 2.6, area: 'all', radius: 260, crit: true,
    hits: [[0.75, 3], ...evenHits(4, 0.8, 0.03, 0.75)],
    stages: [
      { dur: 2.2, hits: [[0.75, 3]] },
      {},
      { dur: 2.9, hits: [[0.7, 2.5], ...evenHits(6, 0.76, 0.03, 0.6)] },
      { dur: 3.3, hits: [[0.62, 1.5], [0.78, 2], ...evenHits(6, 0.82, 0.02, 0.5), [0.95, 3]] },
    ],
    stageName: ['일점 사격', '태양 관통', '천벌의 화살', '태양 낙하'],
    stageDesc: [
      '하단바가 숨을 죽인 듯 어두워지고, 조준선이 모인 한 점으로 빛의 화살이 하단바를 꿰뚫는다',
      '하늘을 향해 쏜 화살이 태양을 꿰뚫고 — 태양빛이 굵은 광선이 되어 하단바 끝까지 관통한다',
      '하늘 가득 화살 그림자가 떠오르고 태양 광선이 하단바를 쓸고 지나가며 화살비가 따라 쏟아진다',
      '하단바 위로 거대한 태양이 떨어져 내려와 — 빛이 하단바 전체를 하얗게 태우고 열기가 일렁인다',
    ],
    desc: '하늘의 태양을 꿰뚫어 그 빛으로 하단바 끝까지 관통한다. 반드시 치명타.',
  },
  dimensionCollapse: {
    cls: 'voidArcher', mastOf: 'rapidFire', ult: true, name: '차원 붕괴', icon: '🌀', lv: 100, cd: 20, cdSpan: [60, 40], dur: 2.8, area: 'all', radius: 230,
    hits: [...evenHits(10, 0.4, 0.04, 0.5), [0.9, 4]],
    stages: [
      { dur: 2.3, hits: [...evenHits(5, 0.45, 0.06, 0.6), [0.86, 3]] },
      {},
      { dur: 3.0, hits: [...evenHits(14, 0.35, 0.035, 0.4), [0.9, 4]] },
      { dur: 3.4, hits: [...evenHits(14, 0.3, 0.03, 0.35), [0.78, 1.5], [0.93, 5, { area: 'all', radius: 260, launch: true }]] },
    ],
    stageName: ['공허탄', '차원 균열', '블랙홀', '사건의 지평선'],
    stageDesc: [
      '공허를 머금은 화살이 하단바 한가운데서 터져 보랏빛 균열이 번진다',
      '하단바에 차원의 균열이 지그재그로 찢어지고, 균열 속 공허가 적을 빨아들이며 찢는다',
      '하단바 한가운데 블랙홀이 열려 주변 빛과 파편이 휘어 빨려 들어가다가 터진다',
      '하단바 전체가 음화처럼 뒤집히고 시공간이 소용돌이친다 — 모든 것이 한 점으로 접혔다가 하얀 빛으로 펼쳐진다',
    ],
    desc: '차원을 찢는 화살로 하단바에 블랙홀을 열어 모든 적을 빨아들이고 터뜨린다.',
  },
  apocalypse: {
    cls: 'archmage', mastOf: 'manaBurst', ult: true, name: '종언의 겁화', icon: '☄️', lv: 100, cd: 20, cdSpan: [60, 40], area: 'all', radius: 230,
    dur: 2.7, hits: [...evenHits(6, 0.45, 0.06, 0.8), [0.9, 4]],
    stages: [
      { dur: 2.3, hits: [...evenHits(3, 0.5, 0.1, 1), [0.86, 3]] },
      {},
      { dur: 3.0, hits: [...evenHits(10, 0.38, 0.04, 0.6), [0.9, 4]] },
      { dur: 3.4, hits: [...evenHits(10, 0.3, 0.035, 0.5), [0.74, 2], [0.92, 5, { area: 'all', radius: 260, launch: true }]] },
    ],
    stageName: ['화염 강하', '종언의 겁화', '태양 붕괴', '세계의 끝'],
    stageDesc: [
      '하단바 위 하늘이 붉게 타오르고 불의 비가 쏟아진다',
      '하늘에 거대한 마법진이 열려 겁화의 운석들이 하단바 전체에 쏟아진다',
      '하늘의 태양이 금이 가며 무너져 — 태양 조각이 불타며 하단바 곳곳에 떨어진다',
      '하단바가 통째로 불바다가 되고 하늘이 갈라져 — 하얀 겁화가 하단바를 끝에서 끝까지 삼킨다',
    ],
    desc: '하늘을 불태워 하단바 전체에 겁화를 쏟아붓는다.',
  },
  absoluteZero: {
    cls: 'frostlord', mastOf: 'manaBurst', ult: true, name: '절대영도', icon: '🧊', lv: 100, cd: 20, cdSpan: [60, 40], area: 'all', radius: 230, crit: true,
    dur: 2.7, hits: [[0.55, 1.5], ...evenHits(5, 0.62, 0.05, 0.7), [0.92, 4]],
    stages: [
      { dur: 2.3, hits: [[0.6, 1.5], [0.86, 3]] },
      {},
      { dur: 3.0, hits: [[0.5, 1.5], ...evenHits(8, 0.58, 0.035, 0.5), [0.92, 4]] },
      { dur: 3.4, hits: [[0.45, 1], ...evenHits(8, 0.52, 0.03, 0.4), [0.8, 2], [0.94, 5, { area: 'all', radius: 260, launch: true }]] },
    ],
    stageName: ['빙결', '절대영도', '시간 동결', '영원의 겨울'],
    stageDesc: [
      '하단바에 서리가 번지며 적이 얼음 덩어리에 갇혔다가 깨진다',
      '온도가 사라지듯 하단바 전체가 새하얗게 얼어붙고 — 얼음이 한꺼번에 산산이 부서진다',
      '하단바의 시간이 멈춘 듯 모든 것이 푸른 정지 화면이 되고, 얼음 결정이 하나씩 솟다가 동시에 깨진다',
      '하늘에서 거대한 얼음 결정이 내려와 하단바 전체를 덮는 빙하가 되고 — 빙하가 통째로 부서지며 눈보라가 휩쓴다',
    ],
    desc: '하단바 전체를 절대영도로 얼려 모든 적을 한꺼번에 부순다. 반드시 치명타.',
  },
};
for (const id in SKILLS) SKILLS[id].id = id;
// 대상 하나가 받는 총 피해 배율 (보호막 지속 피해 포함)
const skillMult = (k) => k.hits.reduce((a, h) => a + h[1], 0) + (k.ward ? k.ward.tick * k.ward.dur + (k.ward.finish || 0) : 0);
// 숙련도 lv 의 모양이 반영된 스킬 (stages). 타격 배율 합은 원래 skillMult 와 같게 맞춘다
const stageCache = {};
function skillAt(id, lv = 1) {
  const k = SKILLS[id];
  if (!k.stages) return k;
  const m = Math.min(3, Math.floor(lv / 10)), key = id + m;
  if (stageCache[key]) return stageCache[key];
  const o = k.stages[m] || {};
  const s = { ...k, ...o, stage: m };
  if (k.ward) s.ward = { ...k.ward, ...(o.ward || {}) };
  const raw = s.hits.reduce((a, h) => a + h[1], 0) + (s.ward ? s.ward.tick * s.ward.dur + (s.ward.finish || 0) : 0);
  const f = raw ? skillMult(k) / raw : 1;
  s.hits = s.hits.map((h) => [h[0], h[1] * f, ...h.slice(2)]);
  if (s.ward) { s.ward.tick *= f; if (s.ward.finish) s.ward.finish *= f; }
  return (stageCache[key] = s);
}
// 숙련도 lv 에서의 기술 이름 (단계마다 이름이 진화한다)
const skillNameAt = (k, lv = 1) => (k.stageName ? k.stageName[Math.min(3, Math.floor(lv / 10))] : k.name);
// 타격 i 의 대상 범위 (그 타격만의 범위가 있으면 덮어쓴다)
const hitRange = (k, i) => (k.hits[i] && k.hits[i][2] ? { ...k, ...k.hits[i][2] } : k);
// 그 직업만의 스킬 (해금 레벨 순)
const classSkillsOf = (cls) => Object.values(SKILLS).filter((k) => k.cls === cls).sort((a, b) => a.lv - b.lv);
// 쓸 수 있는 스킬: 2차 직업은 1차 스킬을 물려받는다 (숙련도도 그대로). 3차 직업은 2차 스킬을 물려받고,
// 1차 스킬 자리는 궁극기가 대신한다 (mastOf). 해금 레벨 순
const skillsOf = (cls) => {
  const out = [];
  for (let c = cls; c; c = CLASSES[c].from) out.push(...classSkillsOf(c));
  const gone = new Set(out.map((k) => k.mastOf).filter(Boolean));
  return out.filter((k) => !gone.has(k.id)).sort((a, b) => a.lv - b.lv);
};
// 숙련도(S.mast)를 기록하는 스킬 id. 궁극기는 대신한 1차 스킬의 숙련도를 그대로 이어 쓴다
const mastKey = (id) => (SKILLS[id] && SKILLS[id].mastOf) || id;

// ───────────────────────── 스킬 숙련도 ─────────────────────────
// 📖 비전서로만 오른다 (쓴다고 오르지 않는다). 경험치 없이 비전서 권수 그대로 — 다음 레벨까지 1~30권. 숙련도가 오르면 **쿨타임이 줄고 한 방이 세진다** (둘을 함께 쓴다).
//  - 쿨타임: 위 SKILLS 의 cd × 3.0 (Lv1) → × 1.2 (Lv30). 다 키워도 숙련도 도입 전보다 길다 — 스킬은 가끔 터지는 한 방
//  - 한 방 위력: SKILLS 배율 × SKILL_DMG[직업] × (Lv1 1/1.4 → Lv30 1). Lv30 이면 그 직업의 전체 DPS 가 도입 전보다 +25% 가 되도록 직업마다 정했다.
//    스킬 비중이 큰 직업(용기병·할버디어 ~50%)일수록 낮고 1차(~25%)는 높다 — 그래야 다 키웠을 때 모든 직업의 성장이 같다.
//    그 결과 전체 DPS(도입 전 = 100%)는 Lv1 79~94%, Lv10 86~99%, Lv20 99~107%, Lv30 125%. 스킬 비중이 큰 직업일수록 Lv1 이 낮다.
//  - 성장의 70% 는 레벨마다 고르게, 30% 는 Lv10·20·30 을 넘는 순간 10% 씩 (비주얼이 바뀌는 순간 힘도 함께 오른다).
//  - 보호막(성역)의 지속·감소·회복 수치는 그대로이고 지속 피해만 위력 배율을 받는다.
const SKILL_MAX = 30;
const SKILL_CD_LV1 = 3.0;
const SKILL_CD_MAX = 1.2;
const SKILL_DMG_LV1 = 1 / 1.4;           // Lv1 한 방 위력 = Lv30 의 71%
const SKILL_DMG = {
  swordsman: 2.28, lancer: 2.34, ranger: 2.30,
  paladin: 1.92, blademaster: 1.82, marksman: 1.81, arcaneArcher: 1.80,
  dragoon: 1.70, halberdier: 1.75,
  // 마법사 계열: 같은 차수 다른 직업들의 평균 DPS 에 맞춤 (화염술사는 범위 피해가 있어 0.95배)
  mage: 2.3, pyromancer: 1.8, cryomancer: 1.8,
  // 3차 궁극기: Lv30 이면 그 직업 전체 DPS 를 +25% (Lv1 +17%). 3차 직업 전체는 2차보다 약 1.4배 (궁극기 포함, 공격력 보정으로 맞춤)
  archon: 1.5, swordsaint: 1.48, dragonlord: 1.47, warlord: 1.16, deadeye: 1.12, voidArcher: 2.87, archmage: 1.58, frostlord: 0.91,
};
// 2차 직업이 물려받은 1차 스킬의 위력 배수. 1차 스킬을 그대로 얹으면 직업마다 DPS 가 +15~43%(Lv30) 로 들쭉날쭉해서,
// 계승 스킬이 2차 직업의 전체 DPS 를 Lv1 +5% → Lv30 +10% 만큼 올리도록 직업마다 맞췄다 (스킬 비중이 큰 직업일수록 낮다)
const INHERIT_DMG = {
  paladin: 0.46, blademaster: 0.77, dragoon: 0.49, halberdier: 0.43, marksman: 0.35, arcaneArcher: 0.74, pyromancer: 0.32, cryomancer: 0.37,
};
// 숙련 단계 (Lv10·20·30). 이름과, 그 단계에서 바뀌는 모습
const MASTERY = [
  null,
  { lv: 10, name: '숙련', star: '★', desc: '쿨타임이 크게 줄고, 타격 이펙트가 커지고 파편이 늘어난다' },
  { lv: 20, name: '달인', star: '★★', desc: '쿨타임이 크게 줄고, 발밑에 빛 고리가 돌고 잔상이 짙어진다' },
  { lv: 30, name: '극의', star: '★★★', desc: '쿨타임이 크게 줄고, 이펙트가 금빛으로 물들고 이름 띠와 마무리 섬광이 붙는다' },
];
// L → L+1 에 필요한 비전서 권수: Lv1→2 1권(탑에서 처음 받은 한 권으로 바로 강화해 보게, FTUE), 그 뒤 2권에서 고르게 늘어 Lv29→30 30권.
// 탑 입장권 소탕(하루 3번 × 최고 층)으로 수급이 크게 늘어 10권 상한은 너무 쉬웠다. 누적 Lv10 45권 · Lv20 194권 · Lv30 449권
const SKILL_NEED_MAX = 30;
const skillNeedWith = (max, L) => (L === 1 ? 1 : Math.min(max, Math.round(2 + (max - 2) * (L - 2) / (SKILL_MAX - 3))));
const skillNeed = (L) => skillNeedWith(SKILL_NEED_MAX, L);
const masteryOf = (lv) => Math.min(3, Math.floor(lv / 10));
const skillProg = (lv) => 0.7 * (lv - 1) / (SKILL_MAX - 1) + 0.1 * masteryOf(lv);
// 쿨타임 배수 (SKILLS 의 cd 에 곱한다)
const skillCdAt = (lv) => SKILL_CD_LV1 + (SKILL_CD_MAX - SKILL_CD_LV1) * skillProg(lv);
// 물려받은 1차 스킬의 한 방 최저선 (Lv1 총 배율). INHERIT_DMG 만 곱하면 한 방이 평타 치명(×2.5~3)보다 작아지는 직업이 있어서,
// 그 아래면 위력을 여기까지 올리고 쿨타임도 같은 배수로 늘린다 — 가끔 터지지만 확실히 센 한 방, 전체 DPS 몫은 그대로
const INHERIT_HIT = 3.5;
// 스킬 전체 상향 (2026-10-06): 한 방 위력 ×1.6, 쿨타임 ×1.35 — 스킬이 평타보다 확실히 세게 느껴지도록.
// 스킬 DPS 는 ×1.19 라 전체 DPS 는 Lv1~10 +3~9%, Lv30 +10~20% (스킬 비중이 큰 2차 직업일수록 더 오른다)
const SKILL_POW_UP = 1.6;
const SKILL_CD_UP = 1.35;
const inheritBoost = (k, owner) => {
  if (owner === k.cls || !INHERIT_DMG[owner]) return 1;
  return Math.max(1, INHERIT_HIT / (skillMult(k) * (SKILL_DMG[k.cls] || 2) * SKILL_DMG_LV1 * INHERIT_DMG[owner] * SKILL_POW_UP));
};
// 쿨타임(초). owner 는 쓰는 기사의 직업 (물려받은 스킬이면 inheritBoost 만큼 길어진다)
const skillCdOf = (k, lv, owner = k.cls) => k.cdSpan
  ? Math.round((k.cdSpan[0] + (k.cdSpan[1] - k.cdSpan[0]) * skillProg(lv)) * 10) / 10
  : Math.round(k.cd * skillCdAt(lv) * SKILL_CD_UP * inheritBoost(k, owner) * 10) / 10;
// 한 방 위력 배수 (SKILLS 배율에 곱한다). k 는 스킬, owner 는 쓰는 기사의 직업 (물려받은 1차 스킬이면 INHERIT_DMG·inheritBoost 를 곱한다)
const skillPowAt = (k, lv, owner = k.cls) =>
  (SKILL_DMG[k.cls] || 2) * SKILL_POW_UP * (SKILL_DMG_LV1 + (1 - SKILL_DMG_LV1) * skillProg(lv)) * (owner !== k.cls ? (INHERIT_DMG[owner] || 1) * inheritBoost(k, owner) : 1);
// 누적 비전서 → { lv, have 이번 레벨에 먹인 권수, need 이번 레벨에 필요한 권수 }
function skillLvOf(total) {
  let lv = 1, left = total;
  while (lv < SKILL_MAX && left >= skillNeed(lv)) { left -= skillNeed(lv); lv++; }
  return { lv, have: lv >= SKILL_MAX ? 0 : left, need: lv >= SKILL_MAX ? 0 : skillNeed(lv) };
}
// Lv1 에서 lv 까지 필요한 누적 비전서
const skillTomesAt = (lv) => { let n = 0; for (let L = 1; L < lv; L++) n += skillNeed(L); return n; };
// 만렙까지 필요한 누적 비전서
const SKILL_TOME_MAX = Array.from({ length: SKILL_MAX - 1 }, (_, i) => skillNeed(i + 1)).reduce((a, b) => a + b, 0);

// 트리 화면 배치 순서
const CLASS_TREE = [
  ['squire'],
  ['swordsman', 'lancer', 'ranger', 'mage'],
  ['paladin', 'blademaster', 'dragoon', 'halberdier', 'marksman', 'arcaneArcher', 'pyromancer', 'cryomancer'],
  ['archon', 'swordsaint', 'dragonlord', 'warlord', 'deadeye', 'voidArcher', 'archmage', 'frostlord'],
];
