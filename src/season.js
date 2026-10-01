'use strict';
// 결투 시즌 보상 규칙. raid.js 처럼 DOM 을 모르고 S 상태만 바꾼다.
// 시즌은 서버가 3일마다 자동으로 열고 닫는다(server/season.js). 끝난 시즌에 직접 결투를 1번 이상 건 기사는
// 그 시즌 결투 점수 순위가 서버에 남고, 여기서 그 순위로 보상을 계산해 세이브에 넣는다.
//  S.season = {
//    claimed: 이미 받은 시즌 번호 (같은 보상을 두 번 받지 않도록),
//    last: 마지막으로 받은 보상 { season, rank, total, rating, wins, losses, tier, reward, at }
//  }

const freshSeason = () => ({ claimed: [], last: null });

// 순위 구간. mult: 재화 배율, chests: 내가 열 수 있는 가장 높은 레이드 보스의 처치 상자 개수
// (아직 레이드를 못 여는 기사는 상자 1개 대신 재화 배율 +1)
const SEASON_TIERS = [
  { id: 'r1',  name: '🥇 1위',      test: (r) => r === 1,          mult: 6,   chests: 3 },
  { id: 'r2',  name: '🥈 2위',      test: (r) => r === 2,          mult: 4.5, chests: 2 },
  { id: 'r3',  name: '🥉 3위',      test: (r) => r === 3,          mult: 3.5, chests: 2 },
  { id: 'r10', name: '🏅 4~10위',   test: (r) => r <= 10,          mult: 2.5, chests: 1 },
  { id: 'p30', name: '⭐ 상위 30%', test: (r, n) => r <= Math.ceil(n * 0.3), mult: 1.6, chests: 0 },
  { id: 'all', name: '🎖️ 참가',     test: () => true,              mult: 1,   chests: 0 },
];
const seasonTier = (rank, total) => SEASON_TIERS.find((t) => t.test(rank, total));
const seasonChestBoss = () => Object.keys(RAID_BOSSES).filter(raidUnlocked).pop() || null;

// 재화는 지금 내 최고 스테이지 기준 (레이드 승리 보상과 같은 눈금)
function seasonReward(tier) {
  const boss = seasonChestBoss();
  const mult = tier.mult + (boss ? 0 : tier.chests);
  const ms = monsterStats(S.best, true), scale = 1 + (S.best - 1) * 0.04;
  return {
    gold: Math.round(ms.gold * 6 * mult),
    wood: Math.round(50 * scale * mult), ore: Math.round(40 * scale * mult), mana: Math.round(10 * scale * mult),
    chests: boss ? tier.chests : 0, boss,
  };
}

// 서버가 남긴 시즌 보상 하나를 받는다. 이미 받았으면 null
function claimSeasonReward(row) {
  if (S.season.claimed.includes(row.season)) return null;
  S.season.claimed.push(row.season);
  if (S.season.claimed.length > 30) S.season.claimed.shift();
  const tier = seasonTier(row.rank, row.total), reward = seasonReward(tier);
  S.gold += reward.gold;
  S.mats.wood += reward.wood; S.mats.ore += reward.ore; S.mats.mana += reward.mana;
  for (let i = 0; i < reward.chests; i++) S.raid.chests.push({ k: 'rbox', b: reward.boss, s: RAID_BOSSES[reward.boss].stage });
  S.season.last = { ...row, tier: tier.id, reward, at: Date.now() };
  return S.season.last;
}
