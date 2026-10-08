'use strict';
// 결투 시뮬레이션. 서버에서만 돌리고, 클라이언트는 돌려받은 기록(events)을 재생만 한다.
// 두 기사가 양 끝에서 걸어와 각자 사거리에 들어오면 멈춰서 공격한다. 사거리가 긴 쪽이 먼저 때린다.

const START_DIST = 260;     // 시작 거리(px) — 장궁(230)은 거의 바로 쏠 수 있다
const BODY_GAP = 20;        // 두 기사 몸 사이 최소 거리
const WALK = 40;            // px/s
const HP_MULT = 4;          // 원정보다 오래 싸우도록 결투에서만 체력을 늘린다 (최소 배수)
// 공격력이 체력보다 빨리 커져서(무기 아이템 레벨 ×1.225 · 갑옷 ×1.18) 뒤로 갈수록 공격력이 체력을 크게 앞지른다.
// 그대로 두면 결투가 1~2초 만에 끝나 사거리 긴 쪽이 먼저 쏘면 이기므로, 서로 평타만 주고받아도
// 이 시간(초)은 버티도록 두 기사의 체력 배수를 같이 키운다 (둘 다 같은 배수라 체력·방어 차이는 그대로)
const DUEL_SEC = 12;
const rateOf = (p) => p.atk * (1 + p.crit * (p.critMult - 1)) * p.shots * p.shotMult * p.aspd;
const MAX_T = 45;           // 이 시간이 지나면 남은 체력 비율로 판정
const HP_TIE = 0.01;        // 시간 종료 때 남은 체력 비율 차이가 이것(또는 결투 중 가장 큰 한 방)보다 작으면 가한 총 피해로 판정
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

// 스킬: 교전 중 쿨타임이 찬 스킬부터 쓰고(목록 앞쪽 우선), 시전 시간(dur) 동안은 평타를 멈춘다.
// 첫 스킬은 교전 시작 직후, 나머지는 조금씩 늦게 준비된다. 원정과 같은 규칙 (src/classes.js SKILLS)
const makeSkills = (p) => (p.skills || []).map((s, i) => ({ ...s, left: 0.3 + i * 1.5 }));
function readySkill(me, dt) {
  me.busy -= dt;
  let pick = null;
  for (const s of me.skills) {
    s.left -= dt;
    if (!pick && s.left <= 0 && me.busy <= 0) pick = s;
  }
  if (!pick) return null;
  pick.left = pick.cd;
  me.busy = pick.dur;
  me.cd = Math.max(me.cd, pick.dur);
  return pick;
}
// 보호막(성역)이 켜져 있으면 받는 피해가 준다
const wardCut = (k, t) => (k.ward && t < k.ward.until ? 1 - k.ward.guard : 1);

// p: 클라이언트가 저장할 때 올린 전투 프로필 (sanitizeProfile 을 거친 값)
function simulateDuel(pa, pb, seed = (Math.random() * 2 ** 32) >>> 0) {
  const rng = mulberry32(seed);
  const hpMult = Math.max(HP_MULT, DUEL_SEC * (rateOf(pa) * (1 - pb.guard) / pb.maxHp + rateOf(pb) * (1 - pa.guard) / pa.maxHp) / 2);
  const make = (p, x, dir) => ({
    p, x, dir, hp: p.maxHp * hpMult, max: p.maxHp * hpMult,
    cd: 0.2 + rng() * 0.3,
    leapCd: p.leap ? p.leap.every / 2 : Infinity,
    skills: makeSkills(p), busy: 0, ward: null,
    stopT: null, dealt: 0,
  });
  const a = make(pa, 0, 1), b = make(pb, START_DIST, -1);
  const events = [];
  let t = 0;
  let bigHit = 0;   // 결투 중 가장 큰 한 방 (맞은 쪽 최대 체력 비율)

  // sk: 쓰는 스킬 (kind === 'skill')
  const hit = (me, op, side, kind, sk) => {
    const crit = (sk && sk.crit) || rng() < me.p.crit + ((sk && sk.cp) || 0);   // cp: 스킬 치명 확률 보정 (트리 V2)
    const base = kind === 'leap' ? me.p.leap.mult : sk ? sk.mult : me.p.shots * me.p.shotMult;
    const dmg = me.p.atk * base * (crit ? me.p.critMult : 1) * (0.9 + rng() * 0.2) * (1 - op.p.guard) * wardCut(op, t);
    op.hp -= dmg;
    me.dealt += dmg;
    bigHit = Math.max(bigHit, dmg / op.max);
    if (me.p.heal) me.hp = Math.min(me.max, me.hp + me.max * me.p.heal);
    if (sk && sk.lc) me.hp = Math.min(me.max, me.hp + dmg * sk.lc);      // lc: 스킬 흡혈 (트리 V2)
    if (sk && sk.ward) {
      me.ward = { until: t + sk.dur + sk.ward.dur, guard: sk.ward.guard };
      me.hp = Math.min(me.max, me.hp + me.max * sk.ward.heal);
    }
    events.push({
      t: round1(t), by: side, kind, ...(sk ? { sk: sk.id, sl: sk.lv, ...(sk.st != null ? { ss: sk.st } : {}) } : {}),
      dmg: Math.round(dmg), crit, hpA: Math.max(0, Math.round(a.hp)), hpB: Math.max(0, Math.round(b.hp)),
    });
  };

  const AB = [[a, b, 'a'], [b, a, 'b']], BA = [AB[1], AB[0]];
  while (t < MAX_T && a.hp > 0 && b.hp > 0) {
    // 같은 틱 안에서 누가 먼저 움직일지는 매 틱 무작위로 정한다. 항상 a 가 먼저면 같은 틱에 둘 다 때릴 때
    // b 가 늘 마지막 타격(과 타격 회복)을 가져가서, 시간 종료 판정에서 b 가 유리해진다
    for (const [me, op, side] of (rng() < 0.5 ? AB : BA)) {
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
      const sk = readySkill(me, DT);
      if (sk) { hit(me, op, side, 'skill', sk); continue; }
      if (me.busy <= 0 && me.cd <= 0) { me.cd = 1 / me.p.aspd; hit(me, op, side, 'hit'); }
    }
    t += DT;
  }

  // 판정: 한쪽이 쓰러졌거나 시간 종료 때 체력 비율 차이가 뚜렷하면 체력으로 정한다. 차이가 한 방이면 뒤집힐 정도라면
  // (방어·회복이 높아 둘 다 체력이 거의 가득한 경우 등) 마지막 타격 타이밍에 좌우되지 않도록 가한 총 피해로 정한다.
  // 그마저 같으면 무작위
  const ra = Math.max(0, a.hp) / a.max, rb = Math.max(0, b.hp) / b.max;
  const timeout = a.hp > 0 && b.hp > 0;
  const judge = timeout && Math.abs(ra - rb) < Math.max(HP_TIE, bigHit) ? 'dmg' : 'hp';
  const diff = judge === 'dmg' ? a.dealt - b.dealt : ra - rb;
  return {
    seed,
    winner: diff > 0 ? 'a' : diff < 0 ? 'b' : rng() < 0.5 ? 'a' : 'b',
    timeout, judge,
    dealtA: Math.round(a.dealt), dealtB: Math.round(b.dealt),
    dur: round1(t),
    start: START_DIST, walk: WALK, hpMult: Math.round(hpMult * 10) / 10,
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

module.exports = { simulateDuel, eloDelta, makeSkills, readySkill, wardCut };
