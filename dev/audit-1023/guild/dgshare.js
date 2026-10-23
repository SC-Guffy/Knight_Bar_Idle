// 기사 2명이 공용 상태 하나를 나눠 쓸 때 미궁 입장권이 공용인지 (guild-dungeon-tickets.md 수용 기준)
const vm = require('vm');
const path = require('path');
const R = process.cwd();
const { makeGame } = require(path.join(R, 'dev/progress-bot.js'));
const fs = require('fs');
// 실제 guild.js 의 bindShared·freshShared 를 그대로 쓴다: 함수 본문을 잘라 와서 shared 를 바인딩
const G = fs.readFileSync(path.join(R, 'src/guild.js'), 'utf8');
const fresh = new Function(G.match(/function freshShared\(\) \{[\s\S]*?\n\}/)[0] + '; return freshShared;')();
const bindSrc = G.match(/  bindShared\(S\) \{([\s\S]*?)\n  \},/)[1];
const shared = fresh();
const bind = new Function('shared', 'freshShared', 'S', bindSrc);
const host = { full: true, bindShared: (S) => bind(shared, fresh, S), roster: () => ({ list: [], rev: 0 }), toast() {}, ready() {}, addKnight() {}, serverLost() {} };
const k1 = makeGame(null, host), k2 = makeGame(null, host);
const run = (c, code) => vm.runInContext(code, c);
const out = {};
run(k1, 'loadState(null); S.best = 60;');
// 기사 2: 옛 세이브에 산 입장권 2장 (공용으로 한 번만 옮겨져야 함)
const old = JSON.parse(run(k2, 'JSON.stringify(freshState())')); old.best = 20; old.dg.tixExtra = 2;
run(k2, `loadState(${JSON.stringify(old)});`);
out.afterMove = shared.dg.tixExtra;
const save2 = run(k2, 'JSON.stringify(S)');
out.saveHasTix = 'tixExtra' in JSON.parse(save2).dg;
run(k2, `loadState(${save2});`);
out.reloadExtra = shared.dg.tixExtra;
// 기사 1 이 무료 3장 다 쓰기
run(k1, 'for (let i=0;i<3;i++) useDgTicket();');
out.k2free = run(k2, 'dgFreeTickets()');
out.k2tickets = run(k2, 'dgTickets()');
// 기사 2 가 사면 기사 1 이 보유·가격 단계 공유
run(k2, 'S.gold = 1e30; buyDgTicket();');
out.k1tickets = run(k1, 'dgTickets()');
out.bought = [run(k1, 'dgTicketsBoughtToday()'), run(k2, 'dgTicketsBoughtToday()')];
out.price = [run(k1, 'dgTicketPrice().gold'), run(k2, 'dgTicketPrice().gold')];
// 새 기사(세이브 없음)도 무료가 다시 생기지 않음
const k3 = makeGame(null, host); run(k3, 'loadState(null);');
out.newKnightFree = run(k3, 'dgFreeTickets()');
console.log(JSON.stringify(out));
