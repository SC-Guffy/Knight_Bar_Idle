// 기사단 5단계 점검: 기사 이름 바꾸기·삭제·기사단 이름 바꾸기 (회관 화면 버튼으로). 실행 준비는 dev/guild-shared-test.mjs 와 같다
// (Chrome 디버그 포트 9333 — headless 가 편하다, 정적 서버 8791, 가짜 Google 서버 3792 를 ACCOUNT_PER_HOUR=50 으로): node dev/guild-manage-test.mjs
import { connect, newContextTab } from './guild-cdp.mjs';
const S = 'http://localhost:3792', U = 'http://localhost:8791/index.html?server=' + S + '&guild=1&fakegoogle=1';
const sf = Date.now().toString(36).slice(-3);
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(c ? '✅' : '❌', n, x !== undefined ? JSON.stringify(x).slice(0, 220) : ''); };
const A = await connect(9333, await newContextTab());
await A.nav(U); await A.waitFor(`document.getElementById('fakeSub')`);
await A.ev(`document.getElementById('fakeSub').value='d${sf}'; document.getElementById('fakeGo').click(); 1`);
await A.waitFor(`document.getElementById('gname')`);
await A.ev(`document.getElementById('gname').value='정리단${sf}'; document.getElementById('gnameGo').click(); 1`);
const mk = async (i, nick) => {
  await A.waitFor(`frames[${i}] && frames[${i}].win && frames[${i}].win.document.getElementById('nickIn')`);
  await A.ev(`(() => { const d = frames[${i}].win.document; d.getElementById('nickIn').value = '${nick}'; d.querySelector('[data-action="acct-create"]').click(); return 1; })()`);
  await A.waitFor(`frames[${i}].info && frames[${i}].info.nick === '${nick}'`, 30000);
};
await mk(0, 'DA' + sf); await A.ev(`guildHost.newKnight(); 1`); await mk(1, 'DB' + sf);
// 셋째 기사: 슬롯 2칸이 다 차 있으니 2번을 비우고 만든 뒤 다시 2번에 B
await A.ev(`guildHost.view('DA${sf}'); guildHost.slot('DB${sf}', false); 1`); await A.sleep(500);
await A.ev(`guildHost.newKnight(); 1`); await mk(1, 'DC' + sf);
await A.ev(`guildHost.view('DA${sf}'); guildHost.slot('DC${sf}', false); guildHost.slot('DB${sf}', true); 1`);
await A.waitFor(`frames[1] && frames[1].info && frames[1].info.nick === 'DB${sf}'`, 30000);
ok('기사 3명: A·B 슬롯, C 쉬는 중', (await A.ev('guild.chars.length')) === 3, await A.ev('[guild.chars, guild.slots]'));
const actIn = (fi) => (action, data = {}) => A.ev(`(() => { const d = frames[${fi}].win.document, b = d.createElement('button'); b.dataset.action = ${JSON.stringify(action)}; Object.assign(b.dataset, ${JSON.stringify(data)}); d.body.appendChild(b); b.click(); b.remove(); return 1; })()`);
const typeIn = (fi) => async (v) => { await A.ev(`(() => { const d = frames[${fi}].win.document; d.getElementById('guildEditIn').value = ${JSON.stringify(v)}; d.querySelector('[data-action="guild-edit-ok"]').click(); return 1; })()`); await A.sleep(1500); };
const act = actIn(0), typeOk = typeIn(0);
await A.ev(`frames[0].win.guildApi.openHall(); 1`); await A.sleep(500);
ok('회관에 이름·삭제 버튼 6개 + 기사단 이름 ✏️', (await A.ev(`frames[0].win.document.querySelectorAll('[data-action="guild-edit"]').length`)) === 7);
// ① 슬롯에 있는(숨은) B 이름 바꾸기
await act('guild-edit', { mode: 'rename', nick: 'DB' + sf }); await A.sleep(200); await typeOk('DB2' + sf);
const b = JSON.parse(await A.ev(`JSON.stringify({ slots: guild.slots, fnick: frames[1].nick, inner: frames[1].win.guildApi.info().nick, oldKey: localStorage.getItem('knight-bar-save-v1:db${sf}'), newKey: !!localStorage.getItem('knight-bar-save-v1:db2${sf}') })`));
ok('숨은 B 이름 바꾸기: 슬롯·iframe·세이브 칸 모두 새 이름', b.slots[1] === 'DB2' + sf && b.fnick === 'DB2' + sf && b.inner === 'DB2' + sf && b.oldKey === null && b.newKey, b);
{ const tok = await A.ev(`localStorage.getItem('knight-bar-guild-token')`), dev = await A.ev(`localStorage.getItem('knight-bar-device')`);
  const me = await (await fetch(S + '/api/me', { headers: { Authorization: 'Bearer ' + tok, 'X-Device': dev, 'X-Char': encodeURIComponent('DB2' + sf) } })).json();
  ok('바뀐 B 가 서버에 그대로 닿음 (X-Char 새 이름)', me.nickname === 'DB2' + sf, me.nickname); }
// ② 쉬는 C 이름 바꾸기
await act('guild-edit', { mode: 'rename', nick: 'DC' + sf }); await A.sleep(200); await typeOk('DC2' + sf);
const c = JSON.parse(await A.ev(`JSON.stringify([guild.chars.includes('DC2${sf}'), !!localStorage.getItem('knight-bar-save-v1:dc2${sf}'), localStorage.getItem('knight-bar-save-v1:dc${sf}')])`));
ok('쉬는 C 이름 바꾸기: 목록·세이브 칸', c[0] && c[1] && c[2] === null, c);
// ③ 하루 안에 다시 → 안내
await act('guild-edit', { mode: 'rename', nick: 'DC2' + sf }); await A.sleep(200); await typeOk('DC3' + sf);
ok('하루 안에 다시 바꾸면 남은 시간 안내', /하루에 한 번/.test(await A.ev(`frames[0].win.document.querySelector('#campBody').textContent`)));
await act('guild-edit-cancel'); await A.sleep(200);
// ④ C 삭제
await act('guild-edit', { mode: 'delete', nick: 'DC2' + sf }); await A.sleep(200); await typeOk('틀림');
ok('삭제 확인 이름이 다르면 안 지워짐', await A.ev(`guild.chars.includes('DC2${sf}')`));
await typeOk('DC2' + sf);
ok('C 삭제: 목록·세이브 칸에서 사라짐', await A.ev(`!guild.chars.includes('DC2${sf}') && !localStorage.getItem('knight-bar-save-v1:dc2${sf}')`), await A.ev('guild.chars'));
// ⑤ 보던 A 삭제 → B 로 넘어가고 1번 슬롯 빔
await act('guild-edit', { mode: 'delete', nick: 'DA' + sf }); await A.sleep(200); await typeOk('DA' + sf); await A.sleep(1000);
const st = await A.ev('JSON.stringify([guild.chars, guild.slots, active, frames.filter(Boolean).length])');
ok('보던 A 삭제 → B 화면으로, A 슬롯 빔', st === JSON.stringify([['DB2' + sf], [null, 'DB2' + sf, null, null, null], 1, 1]), st);
ok('바깥 토스트 "지웠어요"', /지웠어요/.test(await A.ev(`document.getElementById('gtoast').textContent`)));
// ⑥ 마지막 1명 · 기사단 이름 바꾸기
await A.ev(`frames[1].win.guildApi.openHall(); 1`); await A.sleep(500);
ok('마지막 1명은 삭제 버튼 꺼짐', await A.ev(`frames[1].win.document.querySelector('[data-action="guild-edit"][data-mode="delete"]').disabled`));
await actIn(1)('guild-edit', { mode: 'gname' }); await A.sleep(200); await typeIn(1)('새정리단' + sf);
ok('기사단 이름 바꾸기', (await A.ev('guild.name')) === '새정리단' + sf);
// ⑦ 새로 고침해도 그대로
await A.nav(U); await A.waitFor(`typeof frames !== 'undefined' && frames[1] && frames[1].info && frames[1].info.nick`, 40000);
const re = await A.ev('JSON.stringify([guild.name, guild.chars, guild.slots, frames[1].info.nick])');
ok('새로 고침 뒤에도 바뀐 이름·지운 기사 반영', re === JSON.stringify(['새정리단' + sf, ['DB2' + sf], [null, 'DB2' + sf, null, null, null], 'DB2' + sf]), re);
await A.shot('d1.png');
console.log(A.logs.join('\n') || '콘솔 오류 없음');
console.log(fails ? `실패 ${fails}` : '모두 통과'); A.close();
