// 월드 보스 평균 지분 인원 = 기사단을 한 명으로 (docs/specs/guild-shared-content.md) — 파일 저장소로 바로 시험
//  node dev/audit-1023/guild/wbplayers.js
const os = require('os'), fs = require('fs'), path = require('path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-wb-'));
process.env.DATA_DIR = dir;
const { openStore } = require('../../../server/store.js');
(async () => {
  const st = openStore();
  const day = 100;
  st.sdb.wb.push({ day, boss: 'x', hp: 0, killedAt: 1 });
  // 사람 10명(기사단 없음, 피해 100) + 기사단 g1 의 본캐(100)·부캐 4명(피해 1)
  for (let i = 0; i < 10; i++) { st.db['p' + i] = { key: 'p' + i }; st.sdb.wbHits.push({ day, key: 'p' + i, dmg: 100, tries: 1, claimed: false, bot: false }); }
  st.db.main = { key: 'main', guildId: 'g1' }; st.sdb.wbHits.push({ day, key: 'main', dmg: 100, tries: 1, claimed: false, bot: false });
  for (let i = 0; i < 4; i++) { st.db['alt' + i] = { key: 'alt' + i, guildId: 'g1' }; st.sdb.wbHits.push({ day, key: 'alt' + i, dmg: 1, tries: 1, claimed: false, bot: false }); }
  const p = (await st.wbPending('p0', day + 1))[0], m = (await st.wbPending('main', day + 1))[0], a = (await st.wbPending('alt0', day + 1))[0];
  const share = (row) => Math.min(3, (row.dmg / row.total) * row.players);
  const noAlt = 11;   // 부캐가 없었으면: 사람 11명(본캐 포함), 피해 1100
  console.log(JSON.stringify({ players: p.players, total: p.total, shareP: share(p).toFixed(3), shareMain: share(m).toFixed(3), shareAlt: share(a).toFixed(3),
    shareNoAlt: (100 / 1100 * noAlt).toFixed(3), shareOldRule: (100 / p.total * 15).toFixed(3) }));
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(0);
})();
