// 기사단 점검 스크립트용 작은 CDP 도우미 (dev/guild-shared-test.mjs). 저장소가 따로인 창(newContextTab) = "다른 기기".
import fs from 'node:fs';
// 새 브라우저 컨텍스트(저장소가 따로인 "다른 기기") 탭을 만들어 그 targetId 를 돌려준다
export async function newContextTab(port = 9333) {
  const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const bws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise((r) => bws.addEventListener('open', r));
  let id = 0; const pend = new Map();
  bws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); bws.send(JSON.stringify({ id: i, method, params })); });
  const ctx = await send('Target.createBrowserContext');
  const t = await send('Target.createTarget', { url: 'about:blank', browserContextId: ctx.result.browserContextId, newWindow: true });
  bws.close();
  return t.result.targetId;
}
export async function connect(port = +(process.env.CDP || 9333), targetId = null) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const ws = new WebSocket(list.find((t) => t.type === 'page' && (!targetId || t.id === targetId)).webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map(); const logs = [];
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(m.params.exceptionDetails).slice(0, 400));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('ERR ' + m.params.args.map((a) => a.value || a.description).join(' ').slice(0, 300)); });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  const ev = async (expr) => { const m = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (m.result.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description || JSON.stringify(m.result.exceptionDetails)); return m.result.result.value; };
  const shot = async (p) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(p, Buffer.from(s.result.data, 'base64')); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nav = async (url) => { await send('Page.navigate', { url }); };
  const waitFor = async (expr, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev(expr)) return true; } catch {} await sleep(300); } throw new Error('timeout: ' + expr); };
  return { send, ev, shot, sleep, nav, logs, waitFor, close: () => ws.close() };
}
