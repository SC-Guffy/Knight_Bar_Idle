'use strict';
// 월드 보스 보상 규칙. raid.js·season.js 처럼 DOM 을 모르고 S 상태만 바꾼다.
// 보스는 하루(한국 시간 자정 기준)에 한 마리 나타나고 서버의 모든 기사가 체력 하나를 함께 깎는다 (server/worldboss.js).
// 하루 WB_TRIES 번 도전해 넣은 피해가 서버에 쌓이고, 날이 바뀐 뒤 접속하면 그날 넣은 피해 지분만큼 보상을 받는다.
//  S.wb = {
//    claimed: 이미 서버에서 가져온 날 번호 (같은 보상을 두 번 받지 않도록),
//    pending: 가져왔지만 아직 🐉 레이드 탭에서 [받기]를 누르지 않은 보상 행 [{ day, boss, dmg, rank, total, players, killed }],
//    chests: 아직 안 연 🌍 월드 보스 전리품 상자 [{ b: 월드 보스 id }],
//    last: 마지막으로 받은 보상 { day, boss, dmg, rank, total, players, killed, rel, reward, at },
//    seen: 마지막으로 본 도전 결과 id (재생·정산을 한 번만)
//  }

const freshWb = () => ({ claimed: [], pending: [], chests: [], last: null, seen: '' });

// 🌍 월드 보스 전리품 상자 하나의 내용물 (처치한 날 참가자 모두 1개). 장비는 없다 — 전설↑ 장비는 레이드 전용.
// 결투 시즌 상자가 강화 쪽이라면 이쪽은 재료 쪽 (목재·철광석이 건물 병목). docs/specs/worldboss-chest.md
const WB_CHEST = { wood: 60, ore: 45, mana: 12, stones: 50, stonesPerStage: 0.5, reroll: [2, 3], spr: 'chest' };
const wbChestName = (b) => `${WORLD_BOSSES[b] ? WORLD_BOSSES[b].name : '월드 보스'}의 전리품 상자`;
// 보스마다 상자 색 (공용 chest 도트에 팔레트만)
const WB_CHEST_PAL = {
  behemoth: { B: '#6b4a2e', b: '#3a2616', W: '#5fcf8a', H: '#c98b4a', G: '#c98b4a', J: '#7dffb0' },
  hydra:    { B: '#2f5a3a', b: '#173020', W: '#8fd8a8', H: '#7dffb0', G: '#7dffb0', J: '#c9b3ff' },
  voidwyrm: { B: '#2a1f4a', b: '#140d26', W: '#8a6fb8', H: '#c06bff', G: '#c06bff', J: '#9fe8ff' },
};
const wbChestDef = (b) => ({ spr: 'chest', pal: WB_CHEST_PAL[b] || WB_CHEST_PAL.behemoth });

const WB_TRIES = 3;          // 하루 도전 횟수 (server/worldboss.js 와 같아야 함)
const WB_UNLOCK = 30;        // 최고 스테이지가 이만큼 돼야 도전할 수 있다 (server/worldboss.js 와 같아야 함)
const WB_ENRAGE = 20;        // 광폭화 시각(초) 기본값 — 보스마다 WORLD_BOSSES[id].rage 가 있으면 그것 (server/worldboss.js 와 같아야 함)
const WB_REL_MAX = 3;        // 지분 몫은 평균의 3배까지만 쳐 준다 (한두 명이 독식하지 않게)
const wbUnlocked = () => S.best >= WB_UNLOCK;

// 보상 = 참여 기본 몫 1 + 지분 몫 2 × (내 지분 ÷ 평균 지분, 최대 3). 평균만큼 넣으면 3몫, 많이 넣으면 최대 7몫, 조금만 넣어도 1몫.
// 피해량은 스테이지에 따라 지수로 커져서 지분만으로 나누면 최상위 몇 명이 독식하므로, 재화는 각자의 최고 스테이지 눈금으로 준다.
// 보스를 잡은 날은 참가자 모두에게 처치 보상(비전서·강화석·🌍 월드 보스 전리품 상자)을 더 준다
function wbReward(row) {
  const rel = row.total > 0 ? Math.min(WB_REL_MAX, (row.dmg / row.total) * Math.max(1, row.players)) : 0;
  const units = 1 + 2 * rel;
  const ms = bossLoot(S.best), scale = 1 + (S.best - 1) * 0.04;
  const killMats = 1 + gearBonus().matPct;     // 🎲 재화 획득 옵션
  return {
    rel, units,
    gold: Math.round(ms.gold * 2 * units * killMats),
    wood: Math.round(20 * scale * units * killMats), ore: Math.round(15 * scale * units * killMats), mana: Math.round(4 * scale * units * killMats),
    stones: Math.round(2 * units) + (row.killed ? 5 : 0),
    tomes: Math.max(1, Math.round(units)) + (row.killed ? 3 : 0),
    chests: row.killed ? 1 : 0, wb: row.boss,     // wb: 상자 이름용 월드 보스 id (0.30.4 전 기록은 boss = 레이드 보스 id)
  };
}

// 서버가 남긴 지난 날의 기록을 받을 목록에 넣는다 (재화는 아직 안 들어간다). 이미 가져온 날이면 false
function queueWbReward(row) {
  if (S.wb.claimed.includes(row.day)) return false;
  S.wb.claimed.push(row.day);
  if (S.wb.claimed.length > 30) S.wb.claimed.shift();
  S.wb.pending.push({ day: row.day, boss: row.boss, dmg: row.dmg, rank: row.rank, total: row.total, players: row.players, killed: !!row.killed });
  return true;
}

// 🐉 레이드 탭 [받기]: 받을 목록의 i 번째 보상을 세이브에 넣는다
function claimWbReward(i) {
  const row = S.wb.pending.splice(i, 1)[0];
  if (!row) return null;
  const reward = wbReward(row);
  S.gold += reward.gold;
  S.mats.wood += reward.wood; S.mats.ore += reward.ore; S.mats.mana += reward.mana;
  S.stones += reward.stones;
  S.tomes += reward.tomes;
  // 🎲 재굴림권 3~5장 확정 · 📜 보호 주문서 (잡은 날은 확률 2배)
  reward.items = rollRareDrops(row.killed ? RARE_DROP.wbKill : RARE_DROP.wb, REROLL_DROP.wb);
  for (let i = 0; i < reward.chests; i++) S.wb.chests.push({ b: row.boss });
  S.wb.last = { ...row, reward, at: Date.now(), seen: true };
  return S.wb.last;
}

// 🌍 월드 보스 전리품 상자 i 번째를 연다. 받은 것 { b, wood, ore, mana, stones, reroll? }
function openWbChest(i) {
  const c = S.wb.chests.splice(i, 1)[0];
  if (!c) return null;
  const C = WB_CHEST, scale = 1 + ((S.best || 1) - 1) * 0.04, mat = 1 + gearBonus().matPct;
  const g = {
    b: c.b,
    wood: Math.round(C.wood * scale * mat), ore: Math.round(C.ore * scale * mat), mana: Math.round(C.mana * scale * mat),
    stones: Math.floor(C.stones + C.stonesPerStage * (S.best || 1)),
  };
  S.mats.wood += g.wood; S.mats.ore += g.ore; S.mats.mana += g.mana; S.stones += g.stones;
  return { ...g, ...rollRareDrops({}, C.reroll) };
}
