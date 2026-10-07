'use strict';
// 픽셀 UI 프레임 생성기 (개발용). 9-slice 로 쓰는 SVG 프레임을 src/skin/ 에 만든다.
//  node dev/make-skin.js
// 각 프레임은 픽셀 격자. 가장자리에서 r 번째 고리를 어떤 색으로 칠할지 ring(r, side, x, y) 로 정한다.
// side: 'tl'(위·왼쪽, 빛 받는 면) | 'br'(아래·오른쪽, 그늘 면). 모서리 notch 는 corner 만큼 비운다.
// 낡은 느낌: 돌 띠에 결(밝은 점)과 흠집(어두운 점)을 고정 해시로 흩뿌린다. 타일이 넓어야 반복이 눈에 안 띄므로 큰 프레임은 32px.
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', 'src', 'skin');

const C = {
  K: '#0b0a14',   // 외곽선 잉크
  W: '#3e3c52',   // 돌(남보라 회색)
  w: '#5a587a',   // 돌 밝은 면·결
  v: '#26253a',   // 돌 그늘
  n: '#1c1b2c',   // 흠집
  B: '#8f8aa8',   // 안선(바랜 은회색)
  b: '#5e5a78',   // 안선 그늘
  S: '#3a3850',   // 카드 밝은 면
  s: '#121120',   // 카드 그늘
};
const hash = (x, y, salt) => { let h = (x * 374761393 + y * 668265263 + salt * 1274126177) >>> 0; h = (h ^ (h >>> 13)) * 1274126177 >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

function frame(name, size, slice, corner, ring) {
  const px = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.min(x, y, size - 1 - x, size - 1 - y);
    if (r >= slice) continue;
    const cx = Math.min(x, size - 1 - x), cy = Math.min(y, size - 1 - y);
    if (cx < corner && cy < corner) continue;                          // 모서리 notch
    const side = (y <= size - 1 - y && y <= x || x <= size - 1 - x && x <= y) && (y === r || x === r) ? 'tl' : 'br';
    const c = ring(r, side, x, y);
    if (c) px.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${C[c] || c}"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">\n${px.join('\n')}\n</svg>\n`;
  fs.writeFileSync(path.join(OUT, name + '.svg'), svg);
  console.log(name, size, 'slice', slice);
}
// 나무 띠 한 픽셀: 기본은 면에 따라 밝음/보통, 결과 흠집을 섞는다
const wood = (s, x, y, salt) => { const h = hash(x, y, salt); return h < .14 ? 'w' : h < .24 ? (s === 'tl' ? 'W' : 'n') : s === 'tl' ? 'w' : 'W'; };
// 잉크 외곽선: 가끔 이가 빠진다
const ink = (x, y, salt) => (hash(x, y, salt) < .07 ? 'v' : 'K');

// 큰 창·패널: 잉크 1 → 나무 띠 4(결·흠집) → 뼈 안선 1. 32px, slice 6 (가장자리 타일 20px 로 반복이 덜 보인다)
frame('frame-panel', 32, 6, 2, (r, s, x, y) => (r === 0 ? ink(x, y, 1) : r < 5 ? (r === 1 ? (s === 'tl' ? 'w' : 'v') : wood(s, x, y, 2)) : 'B'));
// 작은 띠(HUD 바·토스트): 잉크 → 나무 2 → 뼈. 20px, slice 4
frame('frame-thin', 20, 4, 1, (r, s, x, y) => (r === 0 ? ink(x, y, 3) : r < 3 ? wood(s, x, y, 4) : 'b'));
// 가죽 카드(안쪽 칸): 잉크 → 가죽 베벨 2. 10px, slice 4
frame('frame-stone', 10, 4, 1, (r, s) => (r === 0 ? 'K' : r < 3 ? (s === 'tl' ? 'S' : 's') : null));
// 버튼: 잉크 → 2px 베벨(반투명이라 배경색에 따라 간다). 10px, slice 4
frame('frame-btn', 10, 4, 1, (r, s) => (r === 0 ? 'K' : r < 3 ? (s === 'tl' ? 'rgba(255,240,210,.22)' : 'rgba(0,0,0,.4)') : null));
frame('frame-btn-down', 10, 4, 1, (r, s) => (r === 0 ? 'K' : r < 3 ? (s === 'tl' ? 'rgba(0,0,0,.4)' : 'rgba(255,240,210,.1)') : null));
// 뼈 테두리 버튼(출발·도전 같은 주요 행동, 고른 칸): 잉크 → 뼈 밝음/그늘 베벨
frame('frame-gold', 10, 4, 1, (r, s) => (r === 0 ? 'K' : r < 3 ? (s === 'tl' ? 'B' : 'b') : null));
// 게이지 틀: 잉크 + 안쪽 그늘 1. 6px, slice 2
frame('frame-gauge', 6, 2, 1, (r, s) => (r === 0 ? 'K' : s === 'tl' ? 's' : null));
