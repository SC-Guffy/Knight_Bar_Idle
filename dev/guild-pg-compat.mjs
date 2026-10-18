// 기사단 오픈 준비(docs/specs/guild.md "시즌7 오픈 준비"): 옛 서버(기사단 이전)로 만든 Postgres 계정이 새 서버에서 그대로 되는지.
// Postgres 는 postgresql://kb:kb@localhost:5433/kb (임시 — dev-testing.md "기사단" 절). DB 연결 문자열은 그대로 고쳐 쓴다.
//  node compat.mjs old  → 3793(옛 서버)에 계정·세이브·결투를 만들고 토큰을 old.json 에
//  node compat.mjs new  → 3794(새 서버, 같은 DB)에서 옛 계정 확인 + 표 모양 확인
import fs from 'node:fs';
import { createRequire } from 'node:module';
const pgmod = createRequire(process.env.PG_DIR + '/')('pg');   // PG_DIR=pg 패키지가 있는 node_modules 의 부모 폴더
const mode = process.argv[2];
const B = 'http://localhost:' + (mode === 'old' ? 3793 : 3794);
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(c ? '✅' : '❌', n, x !== undefined ? JSON.stringify(x).slice(0, 200) : ''); };
async function api(m, p, body, h = {}) {
  const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-Game-Version': '99.0.0', ...h }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, d: await r.json().catch(() => ({})) };
}
const au = (t) => ({ Authorization: 'Bearer ' + t });
if (mode === 'old') {
  const a = await api('POST', '/api/accounts', { nickname: 'OldKnightA', state: { level: 30, gold: 777, best: 20 }, profile: { level: 30, best: 20, cls: 'swordsman', power: 1000 } });
  const b = await api('POST', '/api/accounts', { nickname: 'OldKnightB', state: { level: 25, best: 15 }, profile: { level: 25, best: 15, cls: 'ranger', power: 800 } });
  ok('옛 서버: 계정 2개', a.s === 201 && b.s === 201, [a.d, b.d].map((x) => x.nickname));
  let r = await api('PUT', '/api/me', { state: { level: 31, gold: 888, best: 21, lastSeen: Date.now() }, profile: { level: 31, best: 21, cls: 'swordsman', power: 1100 } }, au(a.d.token));
  ok('옛 서버: 세이브 올리기', r.s === 200, r.d);
  r = await api('POST', '/api/duels', { opponent: 'OldKnightB' }, au(a.d.token));
  ok('옛 서버: 결투', r.s === 200, r.d.error);
  fs.writeFileSync(process.env.OLD_JSON || 'old.json', JSON.stringify({ a: a.d.token, b: b.d.token }));
} else {
  const { a, b } = JSON.parse(fs.readFileSync(process.env.OLD_JSON || 'old.json', 'utf8'));
  let r = await api('GET', '/api/me', null, au(a));
  ok('새 서버: 옛 계정 A 개인 토큰으로 /api/me · 세이브 그대로', r.s === 200 && r.d.nickname === 'OldKnightA' && r.d.state.gold === 888 && r.d.level === 31, { nick: r.d.nickname, gold: r.d.state && r.d.state.gold, lv: r.d.level });
  r = await api('PUT', '/api/me', { state: { level: 32, gold: 999, best: 22, lastSeen: Date.now() }, profile: { level: 32, best: 22, cls: 'swordsman', power: 1200 } }, au(a));
  ok('새 서버: 옛 계정 세이브 올리기', r.s === 200, r.d);
  r = await api('POST', '/api/duels', { opponent: 'OldKnightB' }, au(a));
  ok('새 서버: 옛 계정끼리 결투 (기사단 없음 → 같은 기사단 금지 안 걸림)', r.s === 200 || r.s === 429, r.d.error);
  r = await api('GET', '/api/duels/inbox', null, au(b));
  ok('새 서버: 옛 받은 결투 기록', r.s === 200 && (r.d.list || r.d.duels || r.d.items || []).length >= 1, Object.keys(r.d));
  r = await api('GET', '/api/ranking?limit=200');
  const mine = r.d.players.filter((p) => p.nickname.startsWith('OldKnight'));
  ok('새 서버: 랭킹에 옛 계정 (기사단 이름 없음)', mine.length === 2 && mine.every((p) => !p.guild), mine.map((p) => [p.nickname, p.guild]));
  // 표 모양
  const c = new pgmod.Client({ connectionString: 'postgresql://kb:kb@localhost:5433/kb' });
  await c.connect();
  const cols = (await c.query("SELECT table_name, column_name FROM information_schema.columns WHERE (table_name='accounts' AND column_name='guild_id') OR table_name='guilds' ORDER BY table_name, column_name")).rows.map((x) => `${x.table_name}.${x.column_name}`);
  ok('accounts.guild_id 열 · guilds 표(shared·shared_rev·shared_at·name_at 포함)', ['accounts.guild_id', 'guilds.shared', 'guilds.shared_rev', 'guilds.shared_at', 'guilds.name_at', 'guilds.slots', 'guilds.google_sub'].every((k) => cols.includes(k)), cols);
  const g = (await c.query("SELECT key, guild_id FROM accounts WHERE key LIKE 'oldknight%'")).rows;
  ok('옛 계정 guild_id = 빈 값', g.length === 2 && g.every((x) => x.guild_id === ''), g);
  await c.end();
}
console.log(fails ? `실패 ${fails}` : '모두 통과');
process.exitCode = fails ? 1 : 0;
