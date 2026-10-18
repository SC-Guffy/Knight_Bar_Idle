// 기사단 서버 API 점검 (docs/specs/guild.md 2단계). 가짜 Google 을 받는 로컬 서버를 새로 띄운 직후에 돌린다
// (IP 당 한 시간에 기사·기사단 5개 제한이 있어서 같은 서버로 두 번 돌리면 뒤쪽이 429 로 실패한다):
//   cd server && PORT=3792 DATA_DIR=<스크래치>/srv GOOGLE_FAKE=1 node index.js
//   P=3792 node dev/guild-server-test.mjs
const B = 'http://localhost:' + (process.env.P || 3792);
let fails = 0;
async function api(m, p, body, h = {}) {
  const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-Game-Version': '9.9.9', ...h }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, d: await r.json().catch(() => ({})) };
}
const ok = (name, cond, extra) => { if (!cond) fails++; console.log(cond ? '✅' : '❌', name, extra !== undefined ? JSON.stringify(extra).slice(0, 160) : ''); };
const gh = (t, dev, ch) => ({ Authorization: 'Bearer ' + t, 'X-Device': dev, ...(ch ? { 'X-Char': encodeURIComponent(ch) } : {}) });
const sfx = Date.now().toString(36).slice(-4);
let r = await api('POST', '/api/auth/google', { idToken: 'fake:u' + sfx, deviceId: 'devA' });
ok('새 Google → ticket', r.d.ticket && !r.d.guild, r.d);
r = await api('POST', '/api/guilds', { name: '푸른 방패' + sfx, ticket: r.d.ticket, deviceId: 'devA' });
ok('기사단 만들기', r.s === 201 && r.d.token.startsWith('g.'), r.d.guild);
let G = r.d.token;
r = await api('POST', '/api/guilds/chars', { nickname: '기사가' + sfx }, gh(G, 'devA')); ok('새 기사 1', r.s === 201, r.d);
r = await api('POST', '/api/guilds/chars', { nickname: '기사나' + sfx }, gh(G, 'devA')); ok('새 기사 2', r.s === 201, r.d);
r = await api('PUT', '/api/guilds/slots', { slots: ['기사가' + sfx, '기사나' + sfx, '남의기사', null, null] }, gh(G, 'devA')); ok('슬롯 저장', r.d.ok);
r = await api('GET', '/api/guilds/me', null, gh(G, 'devA')); ok('내 기사단 (남의 기사는 슬롯에서 빠짐)', r.d.chars.length === 2 && r.d.slots[0] === '기사가' + sfx && r.d.slots[2] === null, r.d);
r = await api('GET', '/api/me', null, gh(G, 'devA', '기사가' + sfx)); ok('기사단 토큰 + X-Char 로 /api/me', r.s === 200 && r.d.nickname === '기사가' + sfx);
r = await api('PUT', '/api/me', { state: { level: 3, gold: 5 }, profile: { level: 3, best: 2 } }, { ...gh(G, 'devA', '기사가' + sfx), 'X-Game-Version': '99.0.0' }); ok('세이브 올리기', r.s === 200, r.d);
const lone = await api('POST', '/api/accounts', { nickname: '외톨이' + sfx });
r = await api('GET', '/api/me', null, gh(G, 'devA', '외톨이' + sfx)); ok('다른 기사 이름 → 401', r.s === 401, r.d);
r = await api('POST', '/api/duels', { opponent: '기사나' + sfx }, gh(G, 'devA', '기사가' + sfx)); ok('같은 기사단 결투 거부', r.s === 400, r.d);
r = await api('POST', '/api/duels', { opponent: '외톨이' + sfx }, gh(G, 'devA', '기사가' + sfx)); ok('다른 기사와 결투는 됨', r.s === 200, r.d.error);
r = await api('POST', '/api/guilds/adopt', { nickname: '외톨이' + sfx, token: lone.d.token }, gh(G, 'devA')); ok('개인 토큰 기사 넣기(adopt)', r.s === 200, r.d);
r = await api('GET', '/api/me', null, { Authorization: 'Bearer ' + lone.d.token }); ok('adopt 뒤 개인 토큰도 그대로', r.s === 200);
// 레이드: 같은 기사단 기사끼리 파티 (기사단 토큰 + X-Char)
const H = { 'X-Game-Version': '99.0.0' };
for (const n of ['기사가', '기사나']) await api('PUT', '/api/me', { state: { level: 20 }, profile: { level: 20, best: 12 } }, { ...gh(G, 'devA', n + sfx), ...H });
r = await api('POST', '/api/raids', { boss: 'slimeking' }, { ...gh(G, 'devA', '기사가' + sfx), ...H }); ok('기사단 기사가 레이드 방 만들기', r.s === 200 && r.d.room, r.d.error);
const roomId = r.d.room && r.d.room.id;
r = await api('POST', '/api/raids/join', { id: roomId }, { ...gh(G, 'devA', '기사나' + sfx), ...H }); ok('같은 기사단 기사가 파티에 들어감', r.s === 200 && r.d.room.members.length === 2, r.d.room ? r.d.room.members.map((m) => m.nickname) : r.d);
r = await api('GET', '/api/raids/me', null, gh(G, 'devA', '기사가' + sfx)); ok('방장 쪽에서도 2명', r.d.room && r.d.room.members.length === 2);
await api('POST', '/api/raids/leave', {}, gh(G, 'devA', '기사나' + sfx)); await api('POST', '/api/raids/leave', {}, gh(G, 'devA', '기사가' + sfx));
// 다른 기기 로그인
r = await api('POST', '/api/auth/google', { idToken: 'fake:u' + sfx, deviceId: 'devB' }); ok('B 기기 로그인 → 새 토큰', r.d.token && r.d.guild.chars.length === 3, r.d.guild);
const G2 = r.d.token;
r = await api('GET', '/api/guilds/me', null, gh(G, 'devA')); ok('A 옛 토큰 무효', r.s === 401 && r.d.code === 'guild-auth', r.d);
r = await api('GET', '/api/guilds/me', null, gh(G2, 'devA')); ok('B 토큰을 A 기기에서 → moved', r.s === 409 && r.d.code === 'moved', r.d);
r = await api('POST', '/api/guilds/device', { deviceId: 'devA' }, gh(G2, 'devA')); ok('A "이 기기에서 계속"', r.d.ok);
r = await api('GET', '/api/me', null, gh(G2, 'devB', '기사가' + sfx)); ok('이제 B 가 moved', r.s === 409 && r.d.code === 'moved');
// 연결 코드
r = await api('POST', '/api/link/start', { deviceId: 'devApp' }); ok('연결 코드 받기', /^\d{6}$/.test(r.d.code), r.d);
const L = r.d;
r = await api('GET', '/api/link/poll?id=' + L.id); ok('대기 중', r.d.waiting);
r = await api('POST', '/api/link/confirm', { code: '999999' === L.code ? '999998' : '999999' }, gh(G2, 'devA')); ok('틀린 코드', r.s === 400);
r = await api('POST', '/api/link/confirm', { code: L.code }, gh(G2, 'devA')); ok('맞는 코드', r.d.ok, r.d);
r = await api('GET', '/api/link/poll?id=' + L.id); ok('앱이 토큰 받음', r.d.token === G2 && r.d.guild.name, r.d.guild);
r = await api('GET', '/api/link/poll?id=' + L.id); ok('한 번만', r.s === 404);
r = await api('GET', '/api/me', null, gh(G2, 'devApp', '기사가' + sfx)); ok('앱 기기로 동작', r.s === 200);
r = await api('GET', '/api/me', null, gh(G2, 'devA', '기사가' + sfx)); ok('웹은 moved', r.s === 409);
// 손님 + Google 연결
r = await api('POST', '/api/guilds', { name: '손님단' + sfx, deviceId: 'devC' }); ok('손님 기사단', r.s === 201 && !r.d.guild.google, r.d);
const G3 = r.d.token;
r = await api('POST', '/api/auth/google', { idToken: 'fake:u' + sfx }, gh(G3, 'devC')); ok('이미 다른 기사단이 있는 Google → 409', r.s === 409, r.d);
r = await api('POST', '/api/auth/google', { idToken: 'fake:v' + sfx }, gh(G3, 'devC')); ok('손님에 Google 연결', r.d.linked && r.d.guild.google, r.d);
r = await api('POST', '/api/auth/google', { idToken: 'fake:v' + sfx, deviceId: 'devD' }); ok('연결한 Google 로 다른 기기 로그인', r.d.token && r.d.guild.name === '손님단' + sfx);
r = await api('GET', '/api/ranking?limit=200'); const mine = r.d.players.filter((p) => p.nickname.endsWith(sfx));
ok('랭킹에 기사단 이름', mine.some((p) => p.guild === '푸른 방패' + sfx), mine.map((p) => [p.nickname, p.guild]));
r = await api('POST', '/api/guilds', { name: '푸른  방패' + sfx }); ok('이름 중복(공백 무시)', r.s === 409, r.d);
r = await api('GET', '/api/guilds/name?name=' + encodeURIComponent('푸른방패' + sfx)); ok('이름 확인 API', r.d.available === false);

// 3단계: 공용 상태 서버 저장
{
  const Gs = (await api('POST', '/api/auth/google', { idToken: 'fake:s' + sfx, deviceId: 'devS' })).d;
  const made = await api('POST', '/api/guilds', { name: '공용단' + sfx, ticket: Gs.ticket, deviceId: 'devS' });
  const T = made.d.token;
  ok('새 기사단 공용 rev 0', made.d.guild.sharedRev === 0 && made.d.guild.shared === null);
  const sh = { gold: 1234, wood: 50, ore: 7, bld: { training: 3, inn: 2, storage: 1, forge: 4, hall: 3 }, forge: { temper: 2 }, build: { id: 'inn', remain: 100, total: 300 },
    stock: { wood: 1.5, ore: 0, at: 5, tradeDay: '2026-10-17', trades: 1 }, junk: 'x' };
  r = await api('PUT', '/api/guilds/shared', { shared: sh, rev: 0 }, gh(T, 'devS')); ok('공용 상태 올리기 → rev 1', r.d.rev === 1, r.d);
  r = await api('GET', '/api/guilds/me', null, gh(T, 'devS'));
  ok('받아 보면 같고 모르는 키는 빠짐', r.d.sharedRev === 1 && r.d.shared.gold === 1234 && r.d.shared.bld.forge === 4 && r.d.shared.build.id === 'inn' && !('junk' in r.d.shared) && r.d.sharedAt > 0, r.d.shared);
  r = await api('PUT', '/api/guilds/shared', { shared: { ...sh, gold: 1 }, rev: 0 }, gh(T, 'devS')); ok('옛 rev → 409 stale + 서버 것', r.s === 409 && r.d.code === 'stale' && r.d.shared.gold === 1234 && r.d.sharedRev === 1, r.d.code);
  r = await api('PUT', '/api/guilds/shared', { shared: { ...sh, gold: -5, bld: { training: 9999 } }, rev: 1 }, gh(T, 'devS')); ok('음수·지나친 Lv 정리', r.d.rev === 2);
  r = await api('GET', '/api/guilds/me', null, gh(T, 'devS')); ok('gold 0 · Lv 100 · 빠진 건물 1', r.d.shared.gold === 0 && r.d.shared.bld.training === 100 && r.d.shared.bld.inn === 1, r.d.shared.bld);
  r = await api('PUT', '/api/guilds/shared', { shared: sh, rev: 2 }, gh(T, 'devOther')); ok('다른 기기에서 올리기 → moved', r.s === 409 && r.d.code === 'moved');
  if (process.env.ADMIN_KEY) {
    r = await api('GET', '/api/admin/audit?guild=' + encodeURIComponent('공용단' + sfx) + '&kind=guild-snap', null, { 'X-Admin-Key': process.env.ADMIN_KEY });
    ok('운영 기록 guild-snap', r.d.log && r.d.log.length === 1 && r.d.log[0].data.gold === 1234, r.d.log);
  }
}
console.log(fails ? `실패 ${fails}` : '모두 통과');
