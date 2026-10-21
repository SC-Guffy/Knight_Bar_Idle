'use strict';
// 연계 검토 페이지 데이터 뽑기: 15줄기 × 8칸 스킬의 이름·모양·쿨·시전 시간 → dev/review/skill-combo-data.js
//   node dev/review/skill-combo-dump.js
const vm = require('vm'), fs = require('fs'), path = require('path');
const { makeGame } = require('../progress-bot');
const c = makeGame();
const out = vm.runInContext(`(() => { const r = {}; for (const id of Object.keys(T7_LINES)) { const L = T7_LINES[id]; r[id] = { cls: L.cls.map((x) => CLASSES[x].name), sk: {} };
  for (const slot of ['slash','gale','iaido','wave','whirl','flash','storm','ult']) { const k = SKILLS[L.sk[slot]]; if (!k) continue;
    r[id].sk[slot] = { id: L.sk[slot], name: k.name, icon: k.icon, area: k.area, gap: k.gap || 0, radius: k.radius || 0, cd: k.cd, dur: k.dur, hits: (k.hits || []).length, ward: !!k.ward, ult: !!k.ult }; } }
  return r; })()`, c);
fs.writeFileSync(path.join(__dirname, 'skill-combo-data.js'), `// node dev/review/skill-combo-dump.js 로 뽑은 것 (${new Date().toISOString().slice(0, 10)})\nglobalThis.COMBO_DATA = ${JSON.stringify(out)};\nif (typeof module !== 'undefined') module.exports = globalThis.COMBO_DATA;\n`);
console.log(Object.keys(out).length, 'lines');
