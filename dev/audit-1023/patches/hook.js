'use strict';
// 봇에 수치 패치를 끼워 넣는 preload (docs/specs/economy-build-gold.md). 게임 src 를 vm 에 올리는 모든 봇(progress·lifespan·currency·guild)에 쓴다.
//  PATCH=dev/audit-1023/patches/time-knee.js node -r ./dev/audit-1023/patches/hook.js dev/lifespan-bot.js --days 21 --seeds 8 --mode heavy --build a --out out.json
//  PATCH 는 쉼표로 여러 개. PATCH_VARS='BT_LATE=1.3;BG_GROW=1.25' 는 패치 앞에 먼저 실행된다 (패치 머리의 var 기본값을 덮어씀).
//  원리: vm.runInContext 를 감싸, src/core.js 를 올린 직후 같은 vm 에서 패치 파일을 실행한다 (봇이 게임 함수를 꺼내 가기 전).
const vm = require('vm'), fs = require('fs'), path = require('path');
const files = (process.env.PATCH || '').split(',').filter(Boolean).map((f) => path.resolve(f));
const vars = process.env.PATCH_VARS || '';
const run0 = vm.runInContext;
vm.runInContext = function (code, ctx, opt) {
  const r = run0.call(vm, code, ctx, opt);
  const fn = opt && (typeof opt === 'string' ? opt : opt.filename);
  if (fn === 'core.js' && (files.length || vars)) {
    if (vars) run0.call(vm, vars.split(';').map((s) => s.trim()).filter(Boolean).map((s) => `var ${s};`).join('\n'), ctx, { filename: 'PATCH_VARS' });
    for (const f of files) run0.call(vm, fs.readFileSync(f, 'utf8'), ctx, { filename: path.basename(f) });
  }
  return r;
};
if (files.length || vars) console.error(`[patch] ${files.map((f) => path.basename(f)).join(', ')}${vars ? ' · ' + vars : ''}`);
