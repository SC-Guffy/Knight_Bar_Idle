'use strict';
// 결투 시즌 보상 규칙. raid.js 처럼 DOM 을 모르고 S 상태만 바꾼다.
// 시즌은 서버가 3일마다 자동으로 열고 닫는다(server/season.js). 끝난 시즌에 직접 결투를 1번 이상 건 기사는
// 그 시즌 결투 점수 순위가 서버에 남고, 여기서 그 순위로 보상을 계산해 세이브에 넣는다.
//  S.season = {
//    claimed: 이미 서버에서 가져온 시즌 번호 (같은 보상을 두 번 받지 않도록),
//    pending: 가져왔지만 아직 🏆 랭킹 탭에서 [받기]를 누르지 않은 보상 행 [{ season, rank, total, ... }],
//    chests: 아직 안 연 ⚔️ 결투 시즌 상자 개수,
//    last: 마지막으로 받은 보상 { season, rank, total, rating, wins, losses, tier, reward, at }
//  }
// 결투 시즌 보상은 레이드 처치 상자를 주지 않는다 — 전설↑ 장비는 레이드 전용 (docs/specs/duel-season-chest.md)

const freshSeason = () => ({ claimed: [], pending: [], chests: 0, last: null });

// 순위 구간. mult: 재화 배율, chests: ⚔️ 결투 시즌 상자 개수, tomes: 📖 비전서 (스킬 숙련도)
const SEASON_TIERS = [
  { id: 'r1',  name: '🥇 1위',      test: (r) => r === 1,          mult: 6,   chests: 3, tomes: 15 },
  { id: 'r2',  name: '🥈 2위',      test: (r) => r === 2,          mult: 4.5, chests: 2, tomes: 12 },
  { id: 'r3',  name: '🥉 3위',      test: (r) => r === 3,          mult: 3.5, chests: 2, tomes: 10 },
  { id: 'r10', name: '🏅 4~10위',   test: (r) => r <= 10,          mult: 2.5, chests: 1, tomes: 7 },
  { id: 'p30', name: '⭐ 상위 30%', test: (r, n) => r <= Math.ceil(n * 0.3), mult: 1.6, chests: 0, tomes: 4 },
  { id: 'all', name: '🎖️ 참가',     test: () => true,              mult: 1,   chests: 0, tomes: 2 },
];
const seasonTier = (rank, total) => SEASON_TIERS.find((t) => t.test(rank, total));

// ⚔️ 결투 시즌 상자 하나의 내용물. 장비는 없다 (레이드 상자를 장비 판매로 환산한 값 약 300 강화석보다 낮게 — 강화석 주 수급처는 레이드)
const DUEL_CHEST = { name: '결투 시즌 상자', stones: 100, stonesPerStage: 1, tomes: 2, reroll: [3, 5], protect: 0.25,
  spr: 'chest', pal: { B: '#5a5f78', b: '#2e3044', W: '#c9d1dd', H: '#ff6b6b', G: '#c9d1dd', J: '#ff6b6b' } };

// 재화는 지금 내 최고 스테이지 기준 (레이드 승리 보상과 같은 눈금)
function seasonReward(tier) {
  const ms = bossLoot(S.best), scale = 1 + (S.best - 1) * 0.04;
  return {
    gold: Math.round(ms.gold * 6 * tier.mult),
    wood: Math.round(50 * scale * tier.mult), ore: Math.round(40 * scale * tier.mult), mana: Math.round(10 * scale * tier.mult),
    chests: tier.chests, tomes: tier.tomes,
  };
}

// 서버가 남긴 시즌 보상 행을 받을 목록에 넣는다 (재화는 아직 안 들어간다). 이미 가져온 시즌이면 false
function queueSeasonReward(row) {
  if (S.season.claimed.includes(row.season)) return false;
  S.season.claimed.push(row.season);
  if (S.season.claimed.length > 30) S.season.claimed.shift();
  S.season.pending.push({ season: row.season, rank: row.rank, total: row.total, rating: row.rating, wins: row.wins, losses: row.losses });
  return true;
}

// 🏆 랭킹 탭 [받기]: 받을 목록의 i 번째 시즌 보상을 세이브에 넣는다
function claimSeasonReward(i) {
  const row = S.season.pending.splice(i, 1)[0];
  if (!row) return null;
  const tier = seasonTier(row.rank, row.total), reward = seasonReward(tier);
  S.gold += reward.gold;
  S.mats.wood += reward.wood; S.mats.ore += reward.ore; S.mats.mana += reward.mana;
  S.tomes += reward.tomes;
  S.season.chests += reward.chests;
  S.season.last = { ...row, tier: tier.id, reward, at: Date.now(), seen: true };
  return S.season.last;
}

// ⚔️ 결투 시즌 상자 하나를 연다. 받은 것 { stones, tomes, reroll?, protect? }
function openDuelChest() {
  if (S.season.chests <= 0) return null;
  S.season.chests--;
  const c = DUEL_CHEST, stones = c.stones + c.stonesPerStage * (S.best || 1);
  S.stones += stones; S.tomes += c.tomes;
  return { stones, tomes: c.tomes, ...rollRareDrops({ protect: c.protect }, c.reroll) };
}
