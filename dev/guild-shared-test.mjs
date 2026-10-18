// 기사단 3단계(공용 상태 서버 저장) 브라우저 점검 — docs/specs/guild.md, 실행법은 docs/dev-testing.md "기사단".
// 보이는 Chrome 을 디버그 포트 9333 으로 띄우고(dev/guild-measure.mjs 머리 주석), 정적 서버 8791 + 가짜 Google 서버 3792 를 새로 띄운 직후:
//   node dev/guild-shared-test.mjs
import { connect, newContextTab } from './guild-cdp.mjs';
const S = 'http://localhost:3792', U = 'http://localhost:8791/index.html?server=' + S + '&guild=1&fakegoogle=1';
const sf = Date.now().toString(36).slice(-3);
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(c ? '✅' : '❌', n, x !== undefined ? JSON.stringify(x).slice(0, 200) : ''); };
const login = async (P) => { await P.nav(U); await P.waitFor(`document.getElementById('fakeSub')`); await P.ev(`document.getElementById('fakeSub').value='p${sf}'; document.getElementById('fakeGo').click(); 1`); };
const A = await connect(9333, await newContextTab());
await login(A); await A.waitFor(`document.getElementById('gname')`);
await A.ev(`document.getElementById('gname').value='마을단${sf}'; document.getElementById('gnameGo').click(); 1`);
await A.waitFor(`frames[0] && frames[0].win && frames[0].win.document.getElementById('nickIn')`);
await A.ev(`(() => { const d = frames[0].win.document; d.getElementById('nickIn').value = 'V1${sf}'; d.querySelector('[data-action="acct-create"]').click(); return 1; })()`);
await A.waitFor(`frames[0].info && frames[0].info.nick`, 30000);
await A.ev(`shared.gold = 1e6; shared.wood = 1e5; shared.ore = 1e5; frames[0].win.startBuild('training'); 1`);
const r0 = await A.ev('shared.build.remain');
// 시계 조작: 기기 시계를 1시간 앞으로
await A.ev(`(() => { const o = Date.now.bind(Date); Date.now = () => o() + 3600e3; return 1; })()`);
await A.sleep(3000);
const r1 = await A.ev('shared.build.remain');
ok('기기 시계 +1시간에도 건설은 실제 시간만큼만', r0 - r1 > 1.5 && r0 - r1 < 6, { r0, r1 });
await A.ev('pushShared({ force: true })'); await A.sleep(500);
const tok = await A.ev(`localStorage.getItem('knight-bar-guild-token')`), dev = await A.ev(`localStorage.getItem('knight-bar-device')`);
const me = await (await fetch(S + '/api/guilds/me', { headers: { Authorization: 'Bearer ' + tok, 'X-Device': dev } })).json();
ok('서버에 공용 상태', me.shared && me.shared.gold === 1e6 - (await A.ev('1e6 - shared.gold')) && me.shared.build && me.shared.build.id === 'training', { gold: me.shared && me.shared.gold, build: me.shared && me.shared.build, rev: me.sharedRev });
await A.ev('frames[0].win.pushSave(true)'); await A.sleep(500);
const kme = await (await fetch(S + '/api/me', { headers: { Authorization: 'Bearer ' + tok, 'X-Device': dev, 'X-Char': 'V1' + sf } })).json();
ok('기사 세이브에 공용 값 없음', kme.state && !('gold' in kme.state) && !('bld' in kme.state) && !('build' in kme.state) && !('stock' in kme.state) && !('forge' in kme.state) && !('wood' in (kme.state.mats || {})) && 'mana' in (kme.state.mats || {}), Object.keys(kme.state || {}).filter((k) => ['gold', 'bld', 'build', 'stock', 'forge', 'mats'].includes(k)).concat(Object.keys(kme.state.mats || {})));
const goldA = await A.ev('shared.gold'), remA = await A.ev('shared.build.remain');
// B: 다른 기기에서 이어 받기 (10초 뒤)
await A.sleep(8000);
const B = await connect(9333, await newContextTab());
await login(B); await B.waitFor(`frames[0] && frames[0].info`, 40000); await B.sleep(1500);
const sb = await B.ev(`JSON.stringify({gold: shared.gold, bld: shared.bld, build: shared.build, hud: frames[0].win.guildS.gold, rev: guild.sharedRev})`);
const b = JSON.parse(sb);
ok('B 에서 같은 골드·건물·건설', b.gold === goldA && b.bld.training === 1 && b.build && b.build.id === 'training' && b.hud === goldA, b);
ok('B 의 건설은 그사이 흐른 만큼 진행', remA - b.build.remain > 8 && remA - b.build.remain < 20, { remA, remB: b.build.remain });
// 오프라인 동안 쌓인 변경 → 다시 닿으면 올라감 (B 가 지금 기기)
await B.send('Network.enable'); await B.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await B.ev('shared.gold += 777; 1'); await B.sleep(17000);
ok('오프라인 중엔 안 멈춤', await B.ev('!stopped'));
await B.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); await B.sleep(17000);
const tokB = await B.ev(`localStorage.getItem('knight-bar-guild-token')`), devB = await B.ev(`localStorage.getItem('knight-bar-device')`);
const me2 = await (await fetch(S + '/api/guilds/me', { headers: { Authorization: 'Bearer ' + tokB, 'X-Device': devB } })).json();
ok('다시 닿으면 올라감', me2.shared.gold === goldA + 777, { server: me2.shared.gold, want: goldA + 777 });
console.log(A.logs.concat(B.logs).join('\n') || '콘솔 오류 없음');
console.log(fails ? `실패 ${fails}` : '모두 통과'); A.close(); B.close();
