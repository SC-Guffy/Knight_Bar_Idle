'use strict';
// 결투 시뮬레이션. 서버에서만 돌리고, 클라이언트는 돌려받은 기록(events)을 재생만 한다.
// 두 기사가 양 끝에서 걸어와 각자 사거리에 들어오면 멈춰서 공격한다. 사거리가 긴 쪽이 먼저 때린다.

const START_DIST = 260;     // 시작 거리(px) — 장궁(230)은 거의 바로 쏠 수 있다
const BODY_GAP = 20;        // 두 기사 몸 사이 최소 거리
const WALK = 40;            // px/s
const HP_MULT = 4;          // 원정보다 오래 싸우도록 결투에서만 체력을 늘린다
const MAX_T = 45;           // 이 시간이 지나면 남은 체력 비율로 판정
const DT = 0.05;

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

// p: 클라이언트가 저장할 때 올린 전투 프로필 (sanitizeProfile 을 거친 값)
function simulateDuel(pa, pb, seed = (Math.random() * 2 ** 32) >>> 0) {
  const rng = mulberry32(seed);
  const make = (p, x, dir) => ({
    p, x, dir, hp: p.maxHp * HP_MULT, max: p.maxHp * HP_MULT,
    cd: 0.2 + rng() * 0.3,
    leapCd: p.leap ? p.leap.every / 2 : Infinity,
    stopT: null,
  });
  const a = make(pa, 0, 1), b = make(pb, START_DIST, -1);
  const events = [];
  let t = 0;

  const hit = (me, op, side, kind) => {
    const crit = rng() < me.p.crit;
    const base = kind === 'leap' ? me.p.leap.mult : me.p.shots * me.p.shotMult;
    const dmg = me.p.atk * base * (crit ? me.p.critMult : 1) * (0.9 + rng() * 0.2) * (1 - op.p.guard);
    op.hp -= dmg;
    if (me.p.heal) me.hp = Math.min(me.max, me.hp + me.max * me.p.heal);
    events.push({ t: round1(t), by: side, kind, dmg: Math.round(dmg), crit, hpA: Math.max(0, Math.round(a.hp)), hpB: Math.max(0, Math.round(b.hp)) });
  };

  while (t < MAX_T && a.hp > 0 && b.hp > 0) {
    for (const [me, op, side] of [[a, b, 'a'], [b, a, 'b']]) {
      if (me.hp <= 0 || op.hp <= 0) break;
      const dist = Math.abs(op.x - me.x);
      const reach = me.p.range + BODY_GAP;
      if (dist > reach) {
        me.x += me.dir * Math.min(WALK * DT, dist - reach);
        continue;
      }
      if (me.stopT == null) me.stopT = round1(t);
      me.cd -= DT;
      me.leapCd -= DT;
      if (me.leapCd <= 0) { me.leapCd = me.p.leap.every; hit(me, op, side, 'leap'); continue; }
      if (me.cd <= 0) { me.cd = 1 / me.p.aspd; hit(me, op, side, 'hit'); }
    }
    t += DT;
  }

  const ra = a.hp / a.max, rb = b.hp / b.max;
  return {
    seed,
    winner: ra >= rb ? 'a' : 'b',
    timeout: a.hp > 0 && b.hp > 0,
    dur: round1(t),
    start: START_DIST, walk: WALK, hpMult: HP_MULT,
    // 기사는 한 번 멈추면 다시 움직이지 않으므로 멈춘 시각·위치만 알면 이동을 재현할 수 있다
    moves: { a: { t: a.stopT ?? round1(t), x: round1(a.x) }, b: { t: b.stopT ?? round1(t), x: round1(b.x) } },
    maxA: Math.round(a.max), maxB: Math.round(b.max),
    events,
  };
}

// 결투 점수 (Elo)
function eloDelta(winnerRating, loserRating, k = 32) {
  const expected = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  return Math.max(1, Math.round(k * (1 - expected)));
}

module.exports = { simulateDuel, eloDelta };
