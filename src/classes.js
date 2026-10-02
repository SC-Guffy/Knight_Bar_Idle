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
  1: { level: 20, mana: 0, gold: 500 },      // 첫 전직은 마력석 없이 — 초반엔 마력석이 거의 안 모인다
  2: { level: 50, mana: 40, gold: 50000 },
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
    desc: '뒤로 웅크렸다가 돌진하며 찔러 일직선의 적을 모두 꿰뚫는다.',
  },
  rapidFire: {
    cls: 'ranger', name: '연사', icon: '🏹', lv: 25, cd: 8, dur: 0.8, area: 'single',
    hits: evenHits(4, 0.25, 0.15, 0.7),
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
    desc: '화면 위로 솟구쳤다가 유성처럼 내리꽂혀 땅을 가른다.',
  },
  dragonBreath: {
    cls: 'dragoon', name: '용의 숨결', icon: '🔥', lv: 70, cd: 14, dur: 1.8, area: 'line', reach: 2.2,
    hits: evenHits(8, 0.25, 0.08, 0.5),
    desc: '창끝에 깃든 용이 보라색 불꽃을 쏟아낸다.',
  },

  // ── 할버디어 ──
  whirlwind: {
    cls: 'halberdier', name: '대회전', icon: '🌀', lv: 60, cd: 9, dur: 1.0, area: 'all', radius: 30,
    hits: [[0.38, 1.4], [0.78, 1.4]],
    desc: '할버드를 들고 두 바퀴 돌며 주변을 모두 쓸어 날린다.',
  },
  earthSplitter: {
    cls: 'halberdier', name: '대지 가르기', icon: '⛰️', lv: 70, cd: 15, dur: 1.4, area: 'line', reach: 4,
    hits: [[0.6, 4]],
    desc: '뛰어올라 내리찍으면 땅이 앞으로 갈라지며 바위가 솟구친다.',
  },

  // ── 저격수 ──
  headshot: {
    cls: 'marksman', name: '헤드샷', icon: '🎯', lv: 60, cd: 12, dur: 1.1, area: 'single', crit: true,
    hits: [[0.75, 2.2]],
    desc: '무릎을 꿇고 숨을 고른 뒤 급소를 꿰뚫는다. 반드시 치명타.',
  },
  armorPiercer: {
    cls: 'marksman', name: '철갑 관통탄', icon: '💥', lv: 70, cd: 16, dur: 1.2, area: 'line', reach: 3,
    hits: [[0.6, 3]],
    desc: '시위를 끝까지 당겨 화면 끝까지 꿰뚫는 한 발. 반동에 몸이 밀려난다.',
  },

  // ── 마궁수 ──
  homingBolts: {
    cls: 'arcaneArcher', name: '유도 마탄', icon: '✴️', lv: 60, cd: 9, dur: 1.0, area: 'all', radius: 60,
    hits: evenHits(6, 0.6, 0.05, 0.8),
    desc: '등 뒤 마법진에서 마력탄 6발이 곡선을 그리며 적을 쫓는다.',
  },
  starfall: {
    cls: 'arcaneArcher', name: '별빛 화살비', icon: '🌠', lv: 70, cd: 16, dur: 2.2, area: 'all', radius: 200,
    hits: evenHits(10, 0.35, 0.06, 0.7),
    desc: '하늘에 마법진을 열어 별빛 화살을 쏟아붓는다.',
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
// 직업의 스킬 (해금 레벨 순)
const skillsOf = (cls) => Object.values(SKILLS).filter((k) => k.cls === cls).sort((a, b) => a.lv - b.lv);

// ───────────────────────── 스킬 숙련도 ─────────────────────────
// 📖 비전서로만 경험치가 오른다 (쓴다고 오르지 않는다). 숙련도가 오르면 **쿨타임이 줄고 한 방이 세진다** (둘을 함께 쓴다).
//  - 쿨타임: 위 SKILLS 의 cd × 3.0 (Lv1) → × 1.2 (Lv30). 다 키워도 숙련도 도입 전보다 길다 — 스킬은 가끔 터지는 한 방
//  - 한 방 위력: SKILLS 배율 × SKILL_DMG[직업] × (Lv1 1/1.4 → Lv30 1). Lv30 이면 그 직업의 전체 DPS 가 도입 전보다 +25% 가 되도록 직업마다 정했다.
//    스킬 비중이 큰 직업(용기병·할버디어 ~50%)일수록 낮고 1차(~25%)는 높다 — 그래야 다 키웠을 때 모든 직업의 성장이 같다.
//    그 결과 전체 DPS(도입 전 = 100%)는 Lv1 79~94%, Lv10 86~99%, Lv20 99~107%, Lv30 125%. 스킬 비중이 큰 직업일수록 Lv1 이 낮다.
//  - 성장의 70% 는 레벨마다 고르게, 30% 는 Lv10·20·30 을 넘는 순간 10% 씩 (비주얼이 바뀌는 순간 힘도 함께 오른다).
//  - 보호막(성역)의 지속·감소·회복 수치는 그대로이고 지속 피해만 위력 배율을 받는다.
const SKILL_MAX = 30;
const TOME_EXP = 10;                     // 비전서 1권 = 경험치 10
const SKILL_CD_LV1 = 3.0;
const SKILL_CD_MAX = 1.2;
const SKILL_DMG_LV1 = 1 / 1.4;           // Lv1 한 방 위력 = Lv30 의 71%
const SKILL_DMG = {
  swordsman: 2.28, lancer: 2.34, ranger: 2.30,
  paladin: 1.92, blademaster: 1.82, marksman: 1.81, arcaneArcher: 1.80,
  dragoon: 1.70, halberdier: 1.75,
};
// 숙련 단계 (Lv10·20·30). 이름과, 그 단계에서 바뀌는 모습
const MASTERY = [
  null,
  { lv: 10, name: '숙련', star: '★', desc: '쿨타임이 크게 줄고, 타격 이펙트가 커지고 파편이 늘어난다' },
  { lv: 20, name: '달인', star: '★★', desc: '쿨타임이 크게 줄고, 발밑에 빛 고리가 돌고 잔상이 짙어진다' },
  { lv: 30, name: '극의', star: '★★★', desc: '쿨타임이 크게 줄고, 이펙트가 금빛으로 물들고 이름 띠와 마무리 섬광이 붙는다' },
];
// L → L+1 에 필요한 경험치. Lv10 까지 770, Lv20 까지 3,755, Lv30 까지 9,338 (비전서 약 934권).
// Lv1 → 2 만 비전서 1권으로 오른다: 탑에서 처음 받은 비전서 한 권으로 바로 강화를 해 보게 (FTUE)
const skillNeed = (L) => (L === 1 ? TOME_EXP : Math.round(12 * Math.pow(L, 1.2)));
const masteryOf = (lv) => Math.min(3, Math.floor(lv / 10));
const skillProg = (lv) => 0.7 * (lv - 1) / (SKILL_MAX - 1) + 0.1 * masteryOf(lv);
// 쿨타임 배수 (SKILLS 의 cd 에 곱한다)
const skillCdAt = (lv) => SKILL_CD_LV1 + (SKILL_CD_MAX - SKILL_CD_LV1) * skillProg(lv);
const skillCdOf = (k, lv) => Math.round(k.cd * skillCdAt(lv) * 10) / 10;
// 한 방 위력 배수 (SKILLS 배율에 곱한다)
const skillPowAt = (cls, lv) => (SKILL_DMG[cls] || 2) * (SKILL_DMG_LV1 + (1 - SKILL_DMG_LV1) * skillProg(lv));
// 누적 경험치 → { lv, exp 이번 레벨에서 모은 양, need 다음 레벨까지 필요한 양 }
function skillLvOf(total) {
  let lv = 1, left = total;
  while (lv < SKILL_MAX && left >= skillNeed(lv)) { left -= skillNeed(lv); lv++; }
  return { lv, exp: lv >= SKILL_MAX ? 0 : left, need: lv >= SKILL_MAX ? 0 : skillNeed(lv) };
}
// 만렙까지 필요한 누적 경험치
const SKILL_EXP_MAX = Array.from({ length: SKILL_MAX - 1 }, (_, i) => skillNeed(i + 1)).reduce((a, b) => a + b, 0);

// 트리 화면 배치 순서
const CLASS_TREE = [
  ['squire'],
  ['swordsman', 'lancer', 'ranger'],
  ['paladin', 'blademaster', 'dragoon', 'halberdier', 'marksman', 'arcaneArcher'],
];
