'use strict';
// 파이터 계열 이펙트 텍스처 목록 묶기: dev/boxer/vfx/manifest.json 에서 src/vfx/ 에 실제로 있는 x* 시트만 골라
// src/vfx/xmeta.js (const QI_TEX = { id: 프레임 수 }) 로 쓴다. src/jobs/fighter-fx.js 가 이 목록으로 불러온다. 시트를 더할 때마다 다시 돌린다.
//   node dev/boxer/vfx-meta.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..'), M = JSON.parse(fs.readFileSync(path.join(__dirname, 'vfx', 'manifest.json'), 'utf8'));
const out = {};
for (const e of M) if (fs.existsSync(path.join(ROOT, 'src', 'vfx', e.id + '.png'))) out[e.id] = e.frames;
fs.writeFileSync(path.join(ROOT, 'src', 'vfx', 'xmeta.js'), `'use strict';\n// 생성 파일 — node dev/boxer/vfx-meta.js (파이터 계열 텍스처 시트 id: 프레임 수, src/jobs/fighter-fx.js)\nconst QI_TEX = ${JSON.stringify(out)};\n`);
console.log('QI_TEX:', Object.keys(out).join(' '));
