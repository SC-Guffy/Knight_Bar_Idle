'use strict';
// dev/icon-art/<파일>.js 아이콘 묶음 검사 (make-icons 를 돌리지 않고): 12줄 × 12칸, 팔레트 글자만, 이름 'sk-<id>' 가 실제 스킬인지.
//  node dev/icon-art-check.js dev/icon-art/t7-lancer.js [...]
//  미리보기: --png out.png (각 아이콘을 6배로 가로로 늘어놓은 PNG — 팔레트는 dev/make-icons.js 와 같다)
const path = require('path'), fs = require('fs');
const PAL = 'WSsdLYyRrGgBbOoPpCcVvMmEekK.';
const args = process.argv.slice(2), png = args.includes('--png') ? args[args.indexOf('--png') + 1] : null;
const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--png');
let skills = null;
try { const vm = require('vm'), { makeGame } = require('./progress-bot'); const c = makeGame(); skills = vm.runInContext('Object.keys(SKILLS)', c); } catch { /* 스킬 목록 없이 */ }
let bad = 0; const all = [];
for (const f of files) {
  const m = require(path.resolve(f));
  for (const [name, v] of Object.entries(m)) {
    const rows = v[1], err = [];
    if (!Array.isArray(rows) || rows.length !== 12) err.push('12줄 아님');
    else rows.forEach((r, i) => { if (r.length !== 12) err.push(`${i}줄 길이 ${r.length}`); for (const ch of r) if (!PAL.includes(ch)) err.push(`${i}줄 모르는 글자 '${ch}'`); });
    if (skills && name.startsWith('sk-') && !skills.includes(name.slice(3))) err.push('그런 스킬 없음: ' + name.slice(3));
    if (err.length) { bad++; console.log('✗', name, err.slice(0, 4).join(', ')); } else all.push([name, rows]);
  }
}
console.log(`${all.length} 개 정상, ${bad} 개 오류`);
if (png && all.length) {
  // PNG 저장 (zlib 만으로)
  const zlib = require('zlib');
  const COL = { W: 'ebe7dc', S: 'b9b4cc', s: '8f8aa8', d: '5e5a78', L: 'fff2b8', Y: 'e0c472', y: 'a8842e', R: 'd0503f', r: '8a2a2a', G: '6cb24e', g: '3d7a34', B: '5a9ad8', b: '33609a', O: 'b5793a', o: '7a4a22', P: 'e2d6b4', p: 'b3a27a', C: '6fd0d0', c: '2f8a96', V: 'a98ccf', v: '6f58a8', M: 'e88aa8', m: 'a8506e', E: 'ec9a3c', e: 'b0561e', k: '34324a', K: '0b0a14' };
  const Z = 6, gap = 2, W = all.length * (14 + gap) * Z, H = 14 * Z;
  const buf = Buffer.alloc((W * 4 + 1) * H);
  const put = (x, y, hex) => { for (let dy = 0; dy < Z; dy++) for (let dx = 0; dx < Z; dx++) { const o = (y * Z + dy) * (W * 4 + 1) + 1 + (x * Z + dx) * 4; buf[o] = parseInt(hex.slice(0, 2), 16); buf[o + 1] = parseInt(hex.slice(2, 4), 16); buf[o + 2] = parseInt(hex.slice(4, 6), 16); buf[o + 3] = 255; } };
  for (let y = 0; y < H; y++) { buf[y * (W * 4 + 1)] = 0; for (let x = 0; x < W * 4; x += 4) { const o = y * (W * 4 + 1) + 1 + x; buf[o] = 0x22; buf[o + 1] = 0x1e; buf[o + 2] = 0x2d; buf[o + 3] = 255; } }
  all.forEach(([, rows], n) => {
    const ox = n * (14 + gap);
    const filled = (x, y) => y >= 0 && y < 12 && x >= 0 && x < 12 && rows[y][x] !== '.';
    for (let y = -1; y <= 12; y++) for (let x = -1; x <= 12; x++) {
      if (filled(x, y)) put(ox + x + 1, y + 1, COL[rows[y][x]] || '0b0a14');
      else if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) put(ox + x + 1, y + 1, '0b0a14');
    }
  });
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(png, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(buf)), chunk('IEND', Buffer.alloc(0))]));
  console.log('미리보기', png, all.map(([n]) => n).join(' '));
}
process.exit(bad ? 1 : 0);
