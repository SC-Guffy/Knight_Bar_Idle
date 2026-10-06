'use strict';
const { simulateBossFight } = require('./raid');
// 월드 보스: 하루(한국 시간 자정 기준)에 한 마리가 나타나고, 서버의 모든 기사가 체력 하나를 함께 깎는다.
// 기사는 하루 WB_TRIES 번 혼자 도전해 WB_SEC 초 동안 피해를 넣는다 (쓰러지면 거기서 끝). 넣은 피해는 모두 서버에 쌓이고,
// 날이 바뀌면 각자 넣은 피해 지분만큼 보상을 받는다 (처치했으면 추가 보상). 보상 내용은 클라이언트가 계산한다 (src/worldboss.js).
//
// 체력 맞추기: 보스가 나타날 때 '최근에 활동한 기사들이 오늘 도전을 다 쓰면 넣을 피해'를 시뮬레이션으로 어림하고(est),
// 난이도 배수(diff)를 곱한다. diff 는 전날 결과로 고친다 — 일찍 잡히면 올리고, 못 잡았으면 넣은 만큼에 맞춰 내린다.
// 그래서 기사들이 세질수록 보스도 같이 세지고, 저녁(17~23시) 무렵 겨우 잡히는 쪽으로 따라간다. 시즌 초반엔 diff 를 높게 시작해
// 첫날은 대개 못 잡는다 (모의 실험: 성장률·참여율이 달라도 이틀째부터 대부분 저녁에 잡히고 가끔 놓친다).

const WB_TRIES = 3;               // 하루 도전 횟수 (클라이언트 src/worldboss.js 의 WB_TRIES 와 같아야 함)
const WB_SEC = 30;                // 한 번 도전에 싸우는 시간(초)
const WB_ENRAGE = 20;             // 이 시간이 지나면 보스가 두 배로 때린다 — 체력·방어를 챙겨야 끝까지 버틴다
const WB_UNLOCK = 30;             // 최고 스테이지가 이만큼은 돼야 도전할 수 있다 (클라이언트와 같아야 함)
const WB_COOLDOWN_MS = 8000;      // 도전 간격 (재생이 끝나기 전에 연달아 누르지 않게)
const WB_ACTIVE_MS = 36 * 3600 * 1000;   // 이 시간 안에 세이브를 올린 기사를 '활동 중'으로 보고 체력 어림에 넣는다
const DIFF_START = 1.6;           // 첫날 난이도 배수 — 시즌 초반엔 다 같이 도전을 다 써도 못 잡을 만큼 세다
const DIFF_MIN = 0.25, DIFF_MAX = 6;
// 보스 공격력: 도전하는 기사의 최고 스테이지 레이드 보스와 같은 눈금 × WB_ATK. 체력은 모두가 함께 깎는 하나지만,
// 공격력은 기사마다 자기 수준에 맞춰 때린다 (약한 기사가 한 방에 죽거나 강한 기사가 아무 위협도 못 느끼지 않게).
// 5배면 훈련·장비를 잘 챙긴 기사는 30초를 다 버티고, 대충 키운 기사는 광폭화 뒤 22~29초에 쓰러져 피해를 15~25% 덜 넣는다
const WB_ATK = 5;
const DAY_MS = 24 * 3600 * 1000;
const KST = 9 * 3600 * 1000;
const dayAt = (t = Date.now()) => Math.floor((t + KST) / DAY_MS);
const dayEnd = (day) => (day + 1) * DAY_MS - KST;

// 보스 패턴 (server/raid.js 의 RAID_BOSSES 와 같은 모양). 이름·외형은 클라이언트 src/data.js 의 WORLD_BOSSES
const WORLD_BOSSES = {
  behemoth:{ atk: 1.0,  aoeEvery: 6,   aoe: 0.85, kb: 60, stun: 1.2, smash: { mult: 2.0, kb: 70, stun: 1.2 } },
  hydra:   { atk: 0.95, aoeEvery: 5,   aoe: 0.75, kb: 30, stun: 1.5, smash: { mult: 1.9, kb: 40, stun: 1.4 } },
  voidwyrm:{ atk: 1.05, aoeEvery: 5.5, aoe: 0.9,  kb: 80, stun: 1.0, smash: { mult: 2.1, kb: 80, stun: 1.1 } },
};
const WB_ORDER = Object.keys(WORLD_BOSSES);
const bossOfDay = (day) => WB_ORDER[((day % WB_ORDER.length) + WB_ORDER.length) % WB_ORDER.length];

const bossAtk = (id, p) => 3 * Math.pow(1.17, p.best - 1) * 1.68 * 1.6 * WB_ATK * WORLD_BOSSES[id].atk;

// 한 번 도전. hp: 지금 남은 체력, max: 최대 체력
function worldFight(id, p, hp, max, seed) {
  return simulateBossFight(id, WORLD_BOSSES[id], { hp, max, atk: bossAtk(id, p) }, [p], seed, { maxT: WB_SEC, enrageT: WB_ENRAGE });
}
// 이 기사가 한 번 도전하면 넣을 피해 (체력이 끝없는 보스를 상대로, 고정된 시드 몇 개의 평균)
function expectedDamage(id, p) {
  let sum = 0;
  for (const seed of [11, 22, 33]) sum += worldFight(id, p, Infinity, Infinity, seed).contrib[0].dmg;
  return sum / 3;
}

// 새 보스의 체력과 난이도. prev: 전날(또는 가장 최근) 보스 기록, profiles: 활동 중인 기사들의 프로필
function spawnBoss(day, prev, profiles, now = Date.now()) {
  const id = bossOfDay(day);
  let diff = DIFF_START;
  if (prev) {
    diff = prev.diff;
    if (prev.killedAt) {
      // 잡혔으면: 하루 중 얼마나 일찍 잡혔는지에 따라 올린다
      const u = (prev.killedAt - prev.spawnedAt) / Math.max(1, dayEnd(prev.day) - prev.spawnedAt);
      diff *= u < 0.35 ? 1.35 : u < 0.6 ? 1.15 : u < 0.8 ? 1.0 : 0.93;
    } else {
      // 못 잡았으면: 넣은 비율에 맞춰 내린다 (다 같이 60%만 깎았으면 다음엔 그만큼 약하게)
      const dealt = (prev.maxHp - prev.hp) / prev.maxHp;
      diff *= Math.max(0.5, Math.min(1, dealt)) * 0.88;
    }
    diff = Math.max(DIFF_MIN, Math.min(DIFF_MAX, diff));
  }
  const est = profiles.reduce((a, p) => a + expectedDamage(id, p) * WB_TRIES, 0);
  const maxHp = Math.max(1000, est * diff);
  return { day, boss: id, maxHp, hp: maxHp, diff, est, spawnedAt: now, killedAt: null };
}

module.exports = { WB_TRIES, WB_SEC, WB_UNLOCK, WB_COOLDOWN_MS, WB_ACTIVE_MS, WORLD_BOSSES, dayAt, dayEnd, bossOfDay, worldFight, spawnBoss, expectedDamage };
