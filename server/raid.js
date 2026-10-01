'use strict';
// 보스 레이드 전투 시뮬레이션. 결투처럼 서버에서 끝까지 계산하고, 파티원 모두가 같은 기록(events)을 하단바에서 재생한다.
// 1~4명의 기사가 왼쪽에서 걸어와 각자 사거리에 들어오면 멈춰서 공격하고, 보스는 한 명을 때리거나 전원을 광역으로 친다.
// 보스 이름·외형·전리품은 클라이언트 src/data.js 의 RAID_BOSSES 에 있다 (id·stage 가 이 표와 같아야 함).

//  stage: 입장에 필요한 최고 스테이지이자 보스 능력치 기준 스테이지
//  hp·atk: 같은 스테이지 필드 보스 대비 배수, aoeEvery: 광역기 간격(초), aoe: 광역기 위력(평타 대비)
const RAID_BOSSES = {
  slimeking:   { stage: 10,  hp: 5.5, atk: 0.75, aoeEvery: 7,   aoe: 0.7 },
  goblinchief: { stage: 20,  hp: 5.5, atk: 0.75, aoeEvery: 6.5, aoe: 0.75 },
  lichking:    { stage: 40,  hp: 5.5, atk: 0.75, aoeEvery: 6,   aoe: 0.8 },
  boglord:     { stage: 60,  hp: 5.5, atk: 0.75, aoeEvery: 6,   aoe: 0.8 },
  flamedragon: { stage: 80,  hp: 6,   atk: 0.75, aoeEvery: 5.5, aoe: 0.85 },
  frostgiant:  { stage: 100, hp: 6,   atk: 0.8,  aoeEvery: 5.5, aoe: 0.85 },
  demonking:   { stage: 130, hp: 6.5, atk: 0.8,  aoeEvery: 5,   aoe: 0.9 },
};
const MAX_PARTY = 4;
const PARTY_HP = [1, 1.5, 2, 2.5];   // 인원수별 보스 체력 배수 (혼자보다 넷이 한 사람당 덜 때려도 된다)

const START = 300;          // 보스 위치(px). 기사는 0 에서 출발하고 뒷사람은 조금씩 뒤에서 시작
const KNIGHT_GAP = 12;      // 출발 간격
const BOSS_HALF = 30;       // 보스 몸 반폭
const WALK = 40;            // px/s
const KNIGHT_HP_MULT = 3;   // 결투처럼 레이드에서만 기사 체력을 늘린다
const BOSS_CD = 1.5;        // 보스 평타 간격
const ENRAGE_T = 75;        // 이 시간이 지나면 보스가 광폭해져 두 배로 때린다
const MAX_T = 120;          // 이 시간 안에 못 잡으면 실패
const DT = 0.05;
const FLUSH = 0.2;          // 기사 타격 기록은 이 간격으로 묶어서 남긴다 (공속이 빨라도 기록이 너무 커지지 않게)

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round1 = (n) => Math.round(n * 10) / 10;

// 클라이언트 data.js 의 monsterStats(필드 보스) 와 같은 기준
function bossStats(id, n) {
  const b = RAID_BOSSES[id], s = b.stage;
  return {
    hp: 14 * Math.pow(1.23, s - 1) * 7.5 * b.hp * PARTY_HP[Math.max(0, Math.min(MAX_PARTY, n) - 1)],
    atk: 3 * Math.pow(1.17, s - 1) * 1.68 * b.atk,
  };
}

// profiles: sanitizeProfile 을 거친 파티원 프로필 (방에 들어온 순서)
function simulateRaid(bossId, profiles, seed = (Math.random() * 2 ** 32) >>> 0) {
  const rng = mulberry32(seed);
  const def = RAID_BOSSES[bossId];
  const bs = bossStats(bossId, profiles.length);
  const boss = { hp: bs.hp, max: bs.hp, atk: bs.atk, cd: 1.2, aoe: def.aoeEvery * 0.8 };
  const ks = profiles.map((p, i) => ({
    p, i, x: -i * KNIGHT_GAP, hp: p.maxHp * KNIGHT_HP_MULT, max: p.maxHp * KNIGHT_HP_MULT,
    reach: p.range + BOSS_HALF + i * 10,       // 같은 사거리끼리 겹치지 않게 뒷사람은 조금 뒤에 선다
    cd: 0.2 + rng() * 0.4, leapCd: p.leap ? p.leap.every / 2 : Infinity,
    stopT: null, alive: true, dmg: 0, taken: 0, heal: 0, acc: null,
  }));
  const events = [];
  let t = 0, lastFlush = 0;
  const hpList = () => ks.map((k) => Math.max(0, Math.round(k.hp)));

  // 묶어 둔 기사 타격을 기록으로 내보낸다: k 기사 번호, d 피해, c 치명 여부, l 도약 여부, bh 보스 남은 체력, h 기사 체력
  const flush = () => {
    for (const k of ks) {
      if (!k.acc) continue;
      events.push({ t: round1(t), k: k.i, d: Math.round(k.acc.d), c: k.acc.c, l: k.acc.l, bh: Math.max(0, Math.round(boss.hp)), h: Math.max(0, Math.round(k.hp)) });
      k.acc = null;
    }
    lastFlush = t;
  };

  const hit = (k, kind) => {
    const crit = rng() < k.p.crit;
    const base = kind === 'leap' ? k.p.leap.mult : k.p.shots * k.p.shotMult;
    const dmg = Math.min(boss.hp, k.p.atk * base * (crit ? k.p.critMult : 1) * (0.9 + rng() * 0.2));
    boss.hp -= dmg;
    k.dmg += dmg;
    if (k.p.heal) {
      const h = Math.min(k.max - k.hp, k.max * k.p.heal);
      k.hp += h; k.heal += h;
    }
    k.acc = k.acc || { d: 0, c: 0, l: 0 };
    k.acc.d += dmg;
    if (crit) k.acc.c = 1;
    if (kind === 'leap') k.acc.l = 1;
  };

  const strike = (k, mult) => {
    const dmg = boss.atk * mult * (t > ENRAGE_T ? 2 : 1) * (0.9 + rng() * 0.2) * (1 - k.p.guard);
    const d = Math.min(k.hp, dmg);
    k.hp -= d; k.taken += d;
    return Math.round(dmg);
  };
  const deaths = () => {
    for (const k of ks) if (k.alive && k.hp <= 0) { k.alive = false; events.push({ t: round1(t), die: k.i }); }
  };

  while (t < MAX_T && boss.hp > 0 && ks.some((k) => k.alive)) {
    for (const k of ks) {
      if (!k.alive || boss.hp <= 0) continue;
      const dist = START - k.x;
      if (dist > k.reach) { k.x += Math.min(WALK * DT, dist - k.reach); continue; }
      if (k.stopT == null) k.stopT = round1(t);
      k.cd -= DT;
      k.leapCd -= DT;
      if (k.leapCd <= 0) { k.leapCd = k.p.leap.every; hit(k, 'leap'); } else if (k.cd <= 0) { k.cd = 1 / k.p.aspd; hit(k, 'hit'); }
    }
    if (boss.hp <= 0) break;

    // 보스는 누군가 앞에 도착하면 싸우기 시작한다
    const engaged = ks.filter((k) => k.alive && k.stopT != null);
    if (engaged.length) {
      boss.cd -= DT;
      boss.aoe -= DT;
      if (boss.aoe <= 0) {
        boss.aoe = def.aoeEvery;
        flush();
        const d = ks.map((k) => (k.alive ? strike(k, def.aoe) : 0));
        events.push({ t: round1(t), b: 'aoe', d, h: hpList() });
        deaths();
      } else if (boss.cd <= 0) {
        boss.cd = BOSS_CD;
        // 대개 맨 앞(가장 가까운) 기사를 노리고, 가끔 뒤에 있는 기사를 친다
        const front = engaged.reduce((a, k) => (k.x > a.x ? k : a));
        const tg = rng() < 0.65 ? front : engaged[Math.floor(rng() * engaged.length)];
        flush();
        const d = strike(tg, 1);
        events.push({ t: round1(t), b: 'hit', tg: tg.i, d, h: hpList() });
        deaths();
      }
    }
    t += DT;
    if (t - lastFlush >= FLUSH) flush();
  }
  flush();

  const won = boss.hp <= 0;
  // 기여도(%): 피해 비중 75% + 받아 낸 피해 15% + 회복 10%. 아무도 안 한 항목(예: 회복)은 빼고 나머지 비중으로 나눈다
  const W = { dmg: 0.75, taken: 0.15, heal: 0.1 };
  const sums = {};
  for (const key of Object.keys(W)) sums[key] = ks.reduce((a, k) => a + k[key], 0);
  const wsum = Object.keys(W).reduce((a, key) => a + (sums[key] > 0 ? W[key] : 0), 0) || 1;
  const contrib = ks.map((k) => ({
    dmg: Math.round(k.dmg), taken: Math.round(k.taken), heal: Math.round(k.heal),
    score: Math.round(Object.keys(W).reduce((a, key) => a + (sums[key] > 0 ? (W[key] * k[key]) / sums[key] : 0), 0) / wsum * 1000) / 10,
  }));
  const mvp = contrib.reduce((best, c, i) => (c.score > contrib[best].score ? i : best), 0);
  return {
    seed, boss: bossId, won, timeout: !won && ks.some((k) => k.alive), dur: round1(t),
    start: START, walk: WALK, gap: KNIGHT_GAP, maxB: Math.round(boss.max),
    knights: ks.map((k) => ({ max: Math.round(k.max), stop: { t: k.stopT ?? round1(t), x: round1(k.x) } })),
    contrib, mvp, events,
  };
}

module.exports = { RAID_BOSSES, MAX_PARTY, simulateRaid };
