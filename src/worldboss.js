'use strict';
// 월드 보스 보상 규칙. raid.js·season.js 처럼 DOM 을 모르고 S 상태만 바꾼다.
// 보스는 하루(한국 시간 자정 기준)에 한 마리 나타나고 서버의 모든 기사가 체력 하나를 함께 깎는다 (server/worldboss.js).
// 하루 WB_TRIES 번 도전해 넣은 피해가 서버에 쌓이고, 날이 바뀐 뒤 접속하면 그날 넣은 피해 지분만큼 보상을 받는다.
//  S.wb = {
//    claimed: 이미 보상을 받은 날 번호 (같은 보상을 두 번 받지 않도록),
//    last: 마지막으로 받은 보상 { day, boss, dmg, rank, total, players, killed, rel, reward, at },
//    seen: 마지막으로 본 도전 결과 id (재생·정산을 한 번만)
//  }

const freshWb = () => ({ claimed: [], last: null, seen: '' });

const WB_TRIES = 3;          // 하루 도전 횟수 (server/worldboss.js 와 같아야 함)
const WB_UNLOCK = 30;        // 최고 스테이지가 이만큼 돼야 도전할 수 있다 (server/worldboss.js 와 같아야 함)
const WB_REL_MAX = 3;        // 지분 몫은 평균의 3배까지만 쳐 준다 (한두 명이 독식하지 않게)
const wbUnlocked = () => S.best >= WB_UNLOCK;

// 보상 = 참여 기본 몫 1 + 지분 몫 2 × (내 지분 ÷ 평균 지분, 최대 3). 평균만큼 넣으면 3몫, 많이 넣으면 최대 7몫, 조금만 넣어도 1몫.
// 피해량은 스테이지에 따라 지수로 커져서 지분만으로 나누면 최상위 몇 명이 독식하므로, 재화는 각자의 최고 스테이지 눈금으로 준다.
// 보스를 잡은 날은 참가자 모두에게 처치 보상(비전서·강화석·레이드 처치 상자)을 더 준다
function wbReward(row) {
  const rel = row.total > 0 ? Math.min(WB_REL_MAX, (row.dmg / row.total) * Math.max(1, row.players)) : 0;
  const units = 1 + 2 * rel;
  const ms = monsterStats(S.best, true), scale = 1 + (S.best - 1) * 0.04;
  const chestBoss = row.killed ? Object.keys(RAID_BOSSES).filter(raidUnlocked).pop() || null : null;
  const killMats = row.killed && !chestBoss ? 1.5 : 1;     // 레이드를 아직 못 열면 상자 대신 재화를 더
  return {
    rel, units,
    gold: Math.round(ms.gold * 2 * units * killMats),
    wood: Math.round(20 * scale * units * killMats), ore: Math.round(15 * scale * units * killMats), mana: Math.round(4 * scale * units * killMats),
    stones: Math.round(2 * units) + (row.killed ? 5 : 0),
    tomes: Math.max(1, Math.round(units)) + (row.killed ? 3 : 0),
    chests: chestBoss ? 1 : 0, boss: chestBoss,
  };
}

// 서버가 남긴 지난 날의 기록 하나로 보상을 받는다. 이미 받았으면 null
function claimWbReward(row) {
  if (S.wb.claimed.includes(row.day)) return null;
  S.wb.claimed.push(row.day);
  if (S.wb.claimed.length > 30) S.wb.claimed.shift();
  const reward = wbReward(row);
  S.gold += reward.gold;
  S.mats.wood += reward.wood; S.mats.ore += reward.ore; S.mats.mana += reward.mana;
  S.stones += reward.stones;
  S.tomes += reward.tomes;
  for (let i = 0; i < reward.chests; i++) S.raid.chests.push({ k: 'rbox', b: reward.boss, s: RAID_BOSSES[reward.boss].stage });
  S.wb.last = { ...row, reward, at: Date.now() };
  return S.wb.last;
}
