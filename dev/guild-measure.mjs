// 기사단 시제품(dev/guild-spike.html)을 실제 화면 rAF 로 잰다 (docs/specs/guild.md 진행 기록 10-16 집 PC).
// 준비: 로컬 서버(저장소 루트, 예: python -m http.server 8791) + 보이는 Chrome 을 디버그 포트로:
//   chrome --user-data-dir=<임시 폴더> --remote-debugging-port=9333 --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --enable-precise-memory-info
// 실행: node dev/guild-measure.mjs <기사 수 1~5> <스크린샷.png> [초]   · 환경변수 PORT(게임 서버, 기본 8791) · THR=4 면 CPU 4배 느리게
import fs from 'node:fs';
const [n = '5', outPng = 'shot.png', secs = '30'] = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const m = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (m.result.exceptionDetails) throw new Error(JSON.stringify(m.result.exceptionDetails)); return m.result.result.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Page.bringToFront');
await send('Page.navigate', { url: 'about:blank' }); await sleep(1500); await send('HeapProfiler.enable'); await send('HeapProfiler.collectGarbage');
await send('Page.navigate', { url: `http://localhost:${process.env.PORT || 8791}/dev/guild-spike.html?n=${n}&reset=1` });
for (let i = 0; i < 60; i++) { await sleep(500); try { if (await ev('frames.every(f => f.win && f.win.guildS)')) break; } catch {} }
console.log('ready', await ev('frames.map(f => !!(f.win && f.win.guildS))'));
if (process.env.THR) await send('Emulation.setCPUThrottlingRate', { rate: +process.env.THR });
await ev('preset()');
await sleep(5000); // 예열
const r = await ev(`new Promise((res) => {
  const iv = [], steps = []; let last = performance.now(); const t0 = last; let m0 = performance.memory.usedJSHeapSize;
  let memMax = m0;
  // 바깥 tick 이 매 프레임 돌리는 step 합계를 잡기 위해 guildStep 을 감싼다
  let stepSum = 0;
  frames.forEach((f) => { const g = f.win.guildStep; f.win.guildStep = (now, shown) => { const a = performance.now(); g(now, shown); stepSum += performance.now() - a; }; });
  function loop(t) { iv.push(t - last); steps.push(stepSum); stepSum = 0; last = t; memMax = Math.max(memMax, performance.memory.usedJSHeapSize);
    if (t - t0 < ${+secs * 1000}) requestAnimationFrame(loop); else done(t); }
  requestAnimationFrame(loop);
  function q(a, p) { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; }
  function done(t) {
    iv.shift(); steps.shift();
    res({ frames: iv.length, fps: iv.length * 1000 / (t - t0), ivAvg: iv.reduce((a, b) => a + b, 0) / iv.length, ivP99: q(iv, 0.99), ivMax: Math.max(...iv),
      over33: iv.filter((x) => x > 33.4).length, over50: iv.filter((x) => x > 50).length,
      stepAvg: steps.reduce((a, b) => a + b, 0) / steps.length, stepP99: q(steps, 0.99), stepMax: Math.max(...steps),
      heapMB: performance.memory.usedJSHeapSize / 1048576, heapMaxMB: memMax / 1048576,
      perChar: frames.map((f) => ({ nick: f.nick, ms: +f.ms.toFixed(3), phase: f.win.guildS.phase, floor: f.win.guildS.tower && f.win.guildS.tower.run ? f.win.guildS.tower.run.floor : null })) });
  }
})`);
await send('HeapProfiler.collectGarbage'); await sleep(500);
r.heapAfterGcMB = await ev('performance.memory.usedJSHeapSize / 1048576');
console.log(JSON.stringify(r, null, 1));
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(outPng, Buffer.from(shot.result.data, 'base64'));
const pm = await send('Performance.enable'); const met = await send('Performance.getMetrics');
console.log('metrics', JSON.stringify(met.result.metrics.filter((m) => /JSHeap|Nodes|Frames|Documents/.test(m.name))));
await send('Emulation.setCPUThrottlingRate', { rate: 1 }); ws.close();
