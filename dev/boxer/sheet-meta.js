'use strict';
// 통짜 스프라이트 시트 메타 묶기: src/sprites/<직업>.json 을 모두 읽어 src/sprites/meta.js (const SHEET_META) 로 쓴다.
// 게임이 Electron file:// 로 열리면 JSON 을 fetch 할 수 없어서 스크립트로 싣는다 (src/sprites.js). 시트를 바꿀 때마다 다시 돌린다.
//   node dev/boxer/sheet-meta.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const DIR = path.join(__dirname, '..', '..', 'src', 'sprites');
const out = {};
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
  const id = f.slice(0, -5), m = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const png = path.join(DIR, id + '.png');
  // v: 그림이 바뀌면 캐시를 깨도록 PNG 내용 해시 앞 8자
  if (fs.existsSync(png)) m.v = crypto.createHash('md5').update(fs.readFileSync(png)).digest('hex').slice(0, 8);
  out[id] = m;
}
const body = Object.entries(out).map(([id, m]) => `  ${id}: ${JSON.stringify(m)},`).join('\n');
fs.writeFileSync(path.join(DIR, 'meta.js'), `'use strict';\n// 생성 파일 — node dev/boxer/sheet-meta.js 가 src/sprites/*.json 을 묶는다 (src/sprites.js)\nconst SHEET_META = {\n${body}\n};\n`);
console.log('SHEET_META:', Object.keys(out).join(', '));
