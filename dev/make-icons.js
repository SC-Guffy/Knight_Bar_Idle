'use strict';
// UI 도트 아이콘 생성기 (개발용). OS 이모지(매끈한 고해상도라 Galmuri 도트 글꼴·도트 테두리 사이에서 튄다)를 대신한다.
//  node dev/make-icons.js   →  src/skin/icons.svg (스프라이트 시트) + src/skin/icons.css (.pi-<이름> 클래스)
// 게임 HTML 에서는 ico('home') (src/ui.js) → <i class="pi pi-home"></i>. 미리보기·이모지 비교: dev/icons.html
// 장비 아이콘(ui.js gearSprite)과 같은 방식: 12×12 글자 도트 + 공용 팔레트 → 칠해진 칸 상하좌우에 잉크 외곽선 → 14×14.
// 그리는 원칙: 큰 색 덩어리, 면마다 밝음/보통/그늘 3단계까지, 잔점 노이즈 금지. 팔레트는 UI 톤(남보라·바랜 은 + 따뜻한 강조색)에 맞춘다.
// (런타임 canvas → data URL 은 index.html CSP 가 data: 이미지를 막아서 쓰지 않는다)
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', 'src', 'skin');

const INK = '#0b0a14';   // --px-ink. 글자 K 로 안쪽에도 찍을 수 있다
const PAL = {
  W: '#ebe7dc',                               // 종이·하이라이트 (--px-paper)
  S: '#b9b4cc', s: '#8f8aa8', d: '#5e5a78',   // 바랜 은 밝음/보통/그늘 (--px-gold-l / --px-gold / --px-gold-d)
  L: '#fff2b8', Y: '#e0c472', y: '#a8842e',   // 금 하이라이트/보통/그늘 (--gold)
  R: '#d0503f', r: '#8a2a2a',                 // 빨강
  G: '#6cb24e', g: '#3d7a34',                 // 초록
  B: '#5a9ad8', b: '#33609a',                 // 파랑
  O: '#b5793a', o: '#7a4a22',                 // 나무
  P: '#e2d6b4', p: '#b3a27a',                 // 양피지 밝음/그늘
  K: INK,
};
// 이름: [대신하는 이모지, 12줄 × 12칸]. 이모지는 dev/icons.html 비교용
const ICONS = {
  // ── 캠프 탭 ──
  home: ['🏠', [  // 홈: 빨간 지붕 집, 불 켜진 창, 나무 문
    '............',
    '.....RR.....',
    '....RRRR....',
    '...RRRRRR...',
    '..RRRRRRRR..',
    '.rrrrrrrrrr.',
    '..SSSSSSSS..',
    '..SYYSSOOS..',
    '..SYYSSOOS..',
    '..SSSSSOOS..',
    '..sssssoos..',
    '............',
  ]],
  town: ['🏘', [  // 마을: 파란 고깔 망루 + 빨간 지붕 집 (홈과 실루엣이 다르게 두 채)
    '..B.........',
    '.BBB........',
    'BBBBB.......',
    'bbbbb...R...',
    '.sSs...RRR..',
    '.sYs..RRRRR.',
    '.sSs.rrrrrrr',
    '.sSs..SSSSS.',
    '.sSs..SYSOS.',
    '.sSs..SYSOS.',
    '.sSs..SSSOS.',
    '.ddd..sssos.',
  ]],
  char: ['🧑', [  // 캐릭터: 빨간 깃 달린 기사 투구
    '.....RR.....',
    '...SSRRSS...',
    '..SWSSSSSs..',
    '..SWSSSSSs..',
    '..SSSSSSSs..',
    '..SKKKKKKs..',
    '..SSSSSSSs..',
    '..sSdSSdSs..',
    '..ssSSSSss..',
    '...ssssss...',
    '....dddd....',
    '............',
  ]],
  rank: ['🏆', [  // 랭킹: 금 트로피, 나무 받침
    '..YYYYYYYY..',
    'YYYLYYYYYyYY',
    'Y.YLYYYYYy.Y',
    'Y.YLYYYYYy.Y',
    '.YYLYYYYYyY.',
    '...YYYYYy...',
    '....yYYy....',
    '.....Yy.....',
    '.....Yy.....',
    '....yYYy....',
    '...OOOOOO...',
    '..oooooooo..',
  ]],
  raid: ['🐉', [  // 레이드: 왼쪽을 보는 용 머리, 은 뿔, 벌린 입과 송곳니
    '........S...',
    '.......SS.S.',
    '.....GGGGSS.',
    '...GGGGGGGG.',
    '.GGGGGGYrGG.',
    'GWGGGGGGGGGg',
    'GGGGgggGGGGg',
    '.W.W....GGGg',
    '.GGGGGGGGGg.',
    '..gggggGGGg.',
    '......gGGg..',
    '......gGGg..',
  ]],
  sub: ['🗺️', [  // 도전: 세 폭으로 접힌 양피지 지도, 점선 길과 X 표시
    '............',
    'PPPP....PPPP',
    'PPPPppppPPPP',
    'PRPPppppPPPP',
    'PPPPRpppPRPR',
    'PPPPppRpPPRP',
    'PPPPppppPRPR',
    'PPPPppppPPPP',
    'PPPPppppPPPP',
    'pPPPppppPPPp',
    '....pppp....',
    '............',
  ]],
};

const N = 14;   // 12 + 외곽선 1px 양쪽
// 아이콘 하나 → 14×14 색 격자 (null = 투명)
function grid(name, rows) {
  if (rows.length !== 12 || rows.some((r) => r.length !== 12)) throw new Error(`${name}: 12줄 × 12칸이어야 한다`);
  const g = Array.from({ length: N }, () => Array(N).fill(null));
  const each = (fn) => rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') fn(x + 1, y + 1, ch); }));
  each((x, y) => { for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) g[y + dy][x + dx] = INK; });
  each((x, y, ch) => { if (!PAL[ch]) throw new Error(`${name}: 팔레트에 없는 글자 ${ch}`); g[y][x] = PAL[ch]; });
  return g;
}
const names = Object.keys(ICONS);
const rects = [];
names.forEach((n, i) => {
  const g = grid(n, ICONS[n][1]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N;) {   // 같은 색 가로 줄은 rect 하나로
    const c = g[y][x];
    let w = 1;
    while (c && x + w < N && g[y][x + w] === c) w++;
    if (c) rects.push(`<rect x="${i * N + x}" y="${y}" width="${w}" height="1" fill="${c}"/>`);
    x += w;
  }
});
const W = names.length * N;
fs.writeFileSync(path.join(OUT, 'icons.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${N}" viewBox="0 0 ${W} ${N}" shape-rendering="crispEdges">\n${rects.join('\n')}\n</svg>\n`);
const pos = (i) => (names.length > 1 ? +(i / (names.length - 1) * 100).toFixed(4) : 0);
fs.writeFileSync(path.join(OUT, 'icons.css'), [
  '/* 생성 파일 — 직접 고치지 말고 dev/make-icons.js 를 고친 뒤 node dev/make-icons.js */',
  '/* UI 도트 아이콘: <i class="pi pi-이름"></i> (src/ui.js ico). 14px 원본, 정수배(.x2)로만 키운다 */',
  `.pi { display: inline-block; width: 14px; height: 14px; flex: none; vertical-align: -3px; font-style: normal;`,
  `  background: url(icons.svg) no-repeat; background-size: ${names.length * 100}% 100%; image-rendering: pixelated; }`,
  '.pi.x2 { width: 28px; height: 28px; vertical-align: -8px; }',
  ...names.map((n, i) => `.pi-${n} { background-position: ${pos(i)}% 0; }`),
  `/* 이모지: ${names.map((n) => `${n} ${ICONS[n][0]}`).join(' · ')} */`,
  '',
].join('\n'));
console.log('icons', names.length, names.join(' '));
