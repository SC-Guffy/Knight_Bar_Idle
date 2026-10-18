// 전체 리셋(/api/admin/reset) 점검 — 서버 3792 (Postgres, ADMIN_KEY=localtestadmin). PG_DIR=pg 패키지 폴더의 부모
import { createRequire } from 'node:module';
const pgmod = createRequire(process.env.PG_DIR + '/')('pg');
const c = new pgmod.Client({ connectionString: 'postgresql://kb:kb@localhost:5433/kb' }); await c.connect();
const cnt = async () => Object.fromEntries(await Promise.all(['accounts', 'guilds', 'hall_of_fame', 'duel_log', 'world_boss_hits', 'season_rewards'].map(async (t) => [t, Number((await c.query(`SELECT count(*) FROM ${t}`)).rows[0].count)])));
const before = await cnt(); console.log('리셋 전', JSON.stringify(before));
const humans = Number((await c.query('SELECT count(*) FROM accounts WHERE NOT is_bot')).rows[0].count);
const r = await (await fetch('http://localhost:3792/api/admin/reset', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'localtestadmin' }, body: JSON.stringify({ confirm: 'RESET' }) })).json();
console.log('리셋 응답', JSON.stringify(r));
await new Promise((res) => setTimeout(res, 500));
const after = await cnt(); console.log('리셋 직후', JSON.stringify(after));
const ok = (n, v) => console.log(v ? '✅' : '❌', n);
ok('계정·기사단·결투 기록·월드 보스·시즌 보상 모두 0', after.guilds === 0 && after.duel_log === 0 && after.world_boss_hits === 0 && after.season_rewards === 0 && after.accounts <= 30);
ok('명예의 전당 1줄 늘어남 (사람 기사 순위)', after.hall_of_fame === before.hall_of_fame + 1);
const hall = (await c.query('SELECT players, stage FROM hall_of_fame ORDER BY id DESC LIMIT 1')).rows[0];
ok(`명예의 전당 사람 수 = 리셋 전 사람 기사 ${humans}`, hall.players === humans);
await c.end();
