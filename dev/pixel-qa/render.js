// 게임 로더를 그대로 거친 모습 만들기: src/vfx-tex.js 를 vm 에서 불러 vfxQuantize → vfxSheet(색) 를 실제 코드로 돌린다.
//  node dev/pixel-qa/render.js <job.json>
//  job.json: [{ id, in: 'a.rgba', out: 'b.rgba', w, h, opts: { frames, soft, keepInk, inkColor }, color: '#rrggbb' | 'raw' }]
//  .rgba = 원시 RGBA 바이트 (가로 w × 세로 h). 파이썬 쪽(qa.py)이 PNG ↔ .rgba 를 바꾼다.
const fs = require('fs'), vm = require('vm'), path = require('path');
const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let cur = null;
const canvas = () => {
  const cv = { width: 0, height: 0, data: null };
  cv.getContext = () => ({
    drawImage() {},
    getImageData: () => ({ data: cur }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData(d) { cv.data = d.data; },
  });
  return cv;
};
const ctx = vm.createContext({ PX: 3, Math, Map, Uint8Array, Float32Array, Uint8ClampedArray, Object, Array, String, parseInt, console,
  document: { createElement: canvas } });
const src = fs.readFileSync(path.join(__dirname, '../../src/vfx-tex.js'), 'utf8').replace(/^'use strict';/, '');
vm.runInContext(src.replace('vfxRegister({ ...VFX_SHEETS });', ''), ctx);
for (const j of jobs) {
  const buf = fs.readFileSync(j.in);
  cur = new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.length);
  const s = { ...j.opts, img: { naturalWidth: j.w, naturalHeight: j.h } };
  ctx.__s = s; ctx.__c = j.color;
  vm.runInContext('vfxQuantize(__s); __out = vfxSheet ? null : null; VFX_SHEETS.__qa = __s; __cv = vfxSheet("__qa", __c);', ctx);
  fs.writeFileSync(j.out, Buffer.from(ctx.__cv.data.buffer));
}
