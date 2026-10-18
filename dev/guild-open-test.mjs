// 시즌7 기사단 스위치(GUILD_OPEN) 켠 뒤 "배포 주소처럼" 열어 보기 — 로컬 개발 주소가 아닌 이름(knightbar.example)을 이 PC 로 묶은 headless Chrome 으로.
//  Chrome: --headless=new --remote-debugging-port=9333 "--host-resolver-rules=MAP knightbar.example 127.0.0.1"
//  정적 서버 8791(저장소 루트) + 서버 3792 (GOOGLE_FAKE=1) 를 띄운 뒤: node dev/guild-open-test.mjs
import { connect, newContextTab } from './guild-cdp.mjs';
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(c ? '✅' : '❌', n, x !== undefined ? JSON.stringify(x).slice(0, 200) : ''); };
const P = await connect(9333, await newContextTab());
const H = 'http://knightbar.example:8791';
await P.nav(H + '/index.html?server=http://localhost:3792'); await P.sleep(4000);
ok('배포 주소에서 주소 그대로 열면 → 기사단 로그인 화면 (스위치 켬)', (await P.ev('location.pathname')) === '/guild.html' && (await P.ev(`!!document.getElementById('lgGuest')`)), await P.ev('location.pathname'));
ok('Google 버튼 자리 (이 가짜 주소는 승인 원본이 아니라 Google 이 막을 수 있음)', await P.ev(`!!document.getElementById('gsi')`));
// 손님으로 시작 → 기사단 → 첫 기사
await P.ev(`document.getElementById('lgGuest').click(); 1`); await P.waitFor(`document.getElementById('gname')`);
const sf = Date.now().toString(36).slice(-3);
await P.ev(`document.getElementById('gname').value='오픈단${sf}'; document.getElementById('gnameGo').click(); 1`);
await P.waitFor(`frames[0] && frames[0].win && frames[0].win.document.getElementById('nickIn')`, 30000);
await P.ev(`(() => { const d = frames[0].win.document; d.getElementById('nickIn').value = 'Open${sf}'; d.querySelector('[data-action="acct-create"]').click(); return 1; })()`);
await P.waitFor(`frames[0].info && frames[0].info.nick`, 30000);
ok('손님 기사단 → 첫 기사로 게임 시작', (await P.ev('frames[0].info.nick')) === 'Open' + sf);
// ?guild=0 → 이번만 보통 게임
await P.nav(H + '/index.html?server=http://localhost:3792&guild=0'); await P.sleep(3000);
ok('?guild=0 이면 보통 게임 (index.html)', (await P.ev('location.pathname')) === '/index.html');
await P.nav(H + '/index.html?server=http://localhost:3792'); await P.waitFor(`typeof frames !== 'undefined' && frames[0] && frames[0].info`, 30000);
ok('다시 주소 그대로 → 같은 기사단으로 이어짐', (await P.ev('guild.name')) === '오픈단' + sf);
console.log(P.logs.join('\n') || '콘솔 오류 없음');
console.log(fails ? `실패 ${fails}` : '모두 통과'); P.close();
