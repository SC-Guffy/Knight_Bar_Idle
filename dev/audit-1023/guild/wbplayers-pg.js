// 월드 보스 평균 지분 인원 = 기사단을 한 명으로 — Postgres 저장소(PgStore) 시험 (docs/specs/guild-shared-content.md)
//  임시 Postgres(dev-testing.md "Postgres 로 확인")를 띄운 뒤:
//  NODE_PATH=<pg 패키지 폴더>/node_modules DATABASE_URL=postgresql://kb:kb@localhost:5433/kb node dev/audit-1023/guild/wbplayers-pg.js
//  파일 저장소 시험(wbplayers.js)과 같은 상황: 사람 10명(기사단 없음, 피해 100) + 기사단 g1 의 본캐(100)·부캐 4명(피해 1)
const { openStore } = require('../../../server/store.js');
(async () => {
  const st = openStore();
  await st.init();
  const q = (s, a) => st.pool.query(s, a);
  const day = 90001, now = Date.now(), sfx = String(now).slice(-6);
  await q('DELETE FROM world_boss_hits WHERE day=$1', [day]); await q('DELETE FROM world_boss WHERE day=$1', [day]);
  await q('INSERT INTO world_boss (day, boss, max_hp, hp, diff, est, spawned_at, killed_at) VALUES ($1,$2,1,0,1,1,$3,$3)', [day, 'x', now]);
  const acc = (key, gid) => q('INSERT INTO accounts (key, nickname, token_hash, created_at, updated_at, guild_id) VALUES ($1,$1,$2,$3,$3,$4)', [key, 'h' + key, now, gid || '']);
  const hit = (key, dmg) => q('INSERT INTO world_boss_hits (day, key, nickname, dmg, tries) VALUES ($1,$2,$2,$3,1)', [day, key, dmg]);
  for (let i = 0; i < 10; i++) { await acc('p' + i + sfx); await hit('p' + i + sfx, 100); }
  await acc('main' + sfx, 'g1' + sfx); await hit('main' + sfx, 100);
  for (let i = 0; i < 4; i++) { await acc('alt' + i + sfx, 'g1' + sfx); await hit('alt' + i + sfx, 1); }
  await hit('nobody' + sfx, 50);   // 계정 행이 없는 기록(지운 기사 등)도 한 명으로 센다 — LEFT JOIN
  const [p] = await st.wbPending('p0' + sfx, day + 1), [m] = await st.wbPending('main' + sfx, day + 1), [a] = await st.wbPending('alt0' + sfx, day + 1);
  const share = (row) => Math.min(3, (row.dmg / row.total) * row.players);
  console.log(JSON.stringify({ players: p.players, total: p.total, rank: p.rank, shareP: share(p).toFixed(3), shareMain: share(m).toFixed(3), shareAlt: share(a).toFixed(3) }));
  const okP = p.players === 12 && p.total === 1154, ok = okP && m.players === 12 && a.players === 12;
  console.log(ok ? '✅ 기사단(본캐+부캐 4) = 1명, 계정 없는 기록 = 1명 → 인원 12' : '❌ 인원이 12 가 아님');
  await q('DELETE FROM world_boss_hits WHERE day=$1', [day]); await q('DELETE FROM world_boss WHERE day=$1', [day]);
  await q("DELETE FROM accounts WHERE key LIKE '%' || $1", [sfx]);
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
