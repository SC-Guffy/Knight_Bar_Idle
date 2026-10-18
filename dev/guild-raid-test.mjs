// 기사단: 숨은 기사의 레이드 대기방·결과 점검 (docs/specs/guild.md 수용 기준 "레이드 대기방"). 실행법은 dev/guild-shared-test.mjs 와 같다
// (보이는 Chrome 디버그 포트 9333 + 정적 서버 8791 + 가짜 Google 서버 3792 를 새로 띄운 직후): node dev/guild-raid-test.mjs
import { connect, newContextTab } from './guild-cdp.mjs';
const S = 'http://localhost:3792', U = 'http://localhost:8791/index.html?server=' + S + '&guild=1&fakegoogle=1';
const sf = Date.now().toString(36).slice(-3);
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(c ? '✅' : '❌', n, x !== undefined ? JSON.stringify(x).slice(0, 220) : ''); };
const A = await connect(9333, await newContextTab());
await A.nav(U); await A.waitFor(`document.getElementById('fakeSub')`);
await A.ev(`document.getElementById('fakeSub').value='r${sf}'; document.getElementById('fakeGo').click(); 1`);
await A.waitFor(`document.getElementById('gname')`);
await A.ev(`document.getElementById('gname').value='레이드단${sf}'; document.getElementById('gnameGo').click(); 1`);
const mk = async (i, nick) => {
  await A.waitFor(`frames[${i}] && frames[${i}].win && frames[${i}].win.document.getElementById('nickIn')`);
  await A.ev(`(() => { const d = frames[${i}].win.document; d.getElementById('nickIn').value = '${nick}'; d.querySelector('[data-action="acct-create"]').click(); return 1; })()`);
  await A.waitFor(`frames[${i}].info && frames[${i}].info.nick === '${nick}'`, 30000);
};
await mk(0, 'RA' + sf);
await A.ev(`guildHost.newKnight(); 1`); await mk(1, 'RB' + sf);
for (const i of [0, 1]) await A.ev(`(async () => { const w = frames[${i}].win, s = w.guildS; s.best = s.stage = 20; s.level = 40; s.raid.tickets = 3; w.save(); await w.pushSave(true); return 1; })()`);
// 게임 버튼 누르기: iframe 안에 data-action 버튼을 잠깐 만들어 클릭 (게임 CSP 라 함수 직접 호출 대신)
const act = (i, action, data = {}) => A.ev(`(() => { const d = frames[${i}].win.document, b = d.createElement('button'); b.dataset.action = ${JSON.stringify(action)}; Object.assign(b.dataset, ${JSON.stringify(data)}); d.body.appendChild(b); b.click(); b.remove(); return 1; })()`);
const me = async (nick) => { const tok = await A.ev(`localStorage.getItem('knight-bar-guild-token')`), dev = await A.ev(`localStorage.getItem('knight-bar-device')`);
  return (await fetch(S + '/api/raids/me', { headers: { Authorization: 'Bearer ' + tok, 'X-Device': dev, 'X-Char': encodeURIComponent(nick) } })).json(); };
await A.ev(`guildHost.view('RA${sf}'); 1`); await A.sleep(300);
await act(0, 'raid-create', { boss: 'slimeking' }); await A.sleep(1500);
let r = await me('RA' + sf);
ok('A 가 레이드 방 만듦', r.room && r.room.members.length === 1, r.room && r.room.members.map((m) => m.nickname));
await act(1, 'raid-join', { id: r.room.id }); await A.sleep(1500);
await act(1, 'raid-ready', { on: '1' }); await A.sleep(1500);
r = await me('RA' + sf);
ok('같은 기사단 B 가 들어와 준비', r.room && r.room.members.length === 2 && r.room.members.some((m) => m.ready), r.room && r.room.members.map((m) => m.nickname + (m.ready ? '✓' : '')));
await A.ev(`guildHost.view('RB${sf}'); 1`); await A.sleep(12000);
r = await me('RA' + sf);
ok('B 를 보는 12초 동안 A 는 방에 남아 있음 (숨은 채 폴링)', r.room && r.room.members.length === 2, r.room && r.room.members.map((m) => m.nickname));
const g0 = await A.ev('shared.gold');
await act(0, 'raid-start'); await A.sleep(4000);
const o = JSON.parse(await A.ev(`JSON.stringify({ toast: document.getElementById('gtoast').innerHTML, dot: !!document.querySelector('.gs[data-i="0"] .dot'), pending: frames[0].win.guildS.raid.pending, last: frames[0].win.guildS.raid.last && frames[0].win.guildS.raid.last.won, chests: frames[0].win.guildS.raid.chests.length, bPending: !!frames[1].win.guildS.raid.pending })`));
ok('숨은 A: 재생 없이 바로 정산 (보류 없음, 결과 반영)', !o.pending && o.last !== null && o.last !== undefined, o);
ok('바깥 토스트 "RA… 레이드 …"', /RA.*레이드/.test(o.toast), o.toast);
ok('1번 슬롯에 레드닷', o.dot);
ok('공용 골드에 레이드 보상이 들어옴', (await A.ev('shared.gold')) > g0);
ok('보던 B 는 평소처럼 재생 중(보상 보류)', o.bPending);
await A.shot('raid-hidden.png');
console.log(A.logs.join('\n') || '콘솔 오류 없음');
console.log(fails ? `실패 ${fails}` : '모두 통과'); A.close();
