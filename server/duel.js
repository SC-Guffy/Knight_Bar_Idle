'use strict';
// 결투 시뮬레이션. 서버에서만 돌리고, 클라이언트는 돌려받은 기록(events)을 재생만 한다.
// 두 기사가 양 끝에서 걸어와 각자 사거리에 들어오면 멈춰서 공격한다. 사거리가 긴 쪽이 먼저 때린다.

const START_DIST = 260;     // 시작 거리(px) — 태양궁(260)은 바로 쏠 수 있다
const BODY_GAP = 20;        // 두 기사 몸 사이 최소 거리
const WALK = 40;            // px/s
const HP_MULT = 4;          // 원정보다 오래 싸우도록 결투에서만 체력을 늘린다 (최소 배수)
// 공격력이 체력보다 빨리 커져서(무기 아이템 레벨 ×1.225 · 갑옷 ×1.18) 뒤로 갈수록 공격력이 체력을 크게 앞지른다.
// 그대로 두면 결투가 1~2초 만에 끝나 사거리 긴 쪽이 먼저 쏘면 이기므로, 서로 평타만 주고받아도
// 이 시간(초)은 버티도록 두 기사의 체력 배수를 같이 키운다 (둘 다 같은 배수라 체력·방어 차이는 그대로)
const DUEL_SEC = 12;
// 위 기준은 평타만 보고 정해서, 치명 터진 스킬(평타 수십~수백 대 분량) 한두 방에 결투가 끝났다 (평균 3.6초).
// 그래서 결투 체력을 한 번 더 키운다 — 평균 약 10초 (docs/specs/duel-length.md).
// 최대 체력 % 로 차는 회복(타격 회복 heal·보호막 회복)은 이 몫만큼 나눠서, 체력을 늘렸다고 회복까지 커지지 않게 한다
const DUEL_HP = 2;
const rateOf = (p) => p.atk * (1 + p.crit * (p.critMult - 1)) * p.shots * p.shotMult * p.aspd;
const MAX_T = 45;           // 이 시간이 지나면 남은 체력 비율로 판정
const HP_TIE = 0.01;        // 시간 종료 때 남은 체력 비율 차이가 이것(또는 결투 중 가장 큰 한 방)보다 작으면 가한 총 피해로 판정
const DT = 0.05;
// 돌진기: 사거리 밖에서도 상대가 이 거리(px) 안이면 DASH 속도로 달려붙어 닿는 순간 그 스킬을 쓴다 (docs/specs/duel-gap-closer.md).
// 저장된 옛 프로필·봇에도 바로 먹도록 서버가 스킬 id 로 정한다 — 원정 쪽 src/classes.js SKILLS 의 gap 과 값을 맞춘다
const GAP = { steelCleave: 120, piercingThrust: 120, gale: 180, iaido: 180, dragonFall: 180, earthSplitter: 180, ramCharge: 180, cavalryCharge: 180,
  oneTwo: 120, ironRush: 180, flyingKick: 180 };
const DASH = 500;           // px/s

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
const makeSkills = (p) => (p.skills || []).map((s, i) => ({ ...s, left: 0.3 + i * 1.5, ...(s.need ? { tj: s.need } : {}) }));

// ── 파이터 계열: 쿨타임 대신 기 게이지 (클라이언트 src/fighter-data.js QI · src/jobs/fighter.js 와 같은 규칙, docs/specs/boxer-class.md 3·7절) ──
// 프로필에 qi 규칙과 스킬마다 cost(주 기술 소모량) 또는 need(투지 기술 문턱)가 있으면 그것으로 돈다. 없으면(옛 프로필) 등가 cd 로 쿨타임 직업처럼.
// 시작 때 기 게이지·투지 칸이 가득이다 (쿨타임 직업이 스킬이 준비된 채 시작하는 것과 같다). 쿨타임 직업은 이 코드를 지나지 않는다 (같은 seed 결과 그대로)
const isQi = (me) => !!(me.p.qi && me.skills.some((s) => s.cost || s.need));
function qiInit(me) {
  if (!isQi(me)) return;
  me.qi = { v: me.p.qi.max, aw: -1, hurtT: -1, hurtN: 0 };
}
// 충전 (각성 중이면 두 배, 최대치에서 멈춘다)
function qiAdd(me, n, t) {
  const q = me.qi, Q = me.p.qi;
  if (!q || !(n > 0)) return;
  q.v = Math.min(Q.max, q.v + n * (Q.awaken && t < q.aw ? Q.awaken.mult : 1));
}
// 평타 적중: hit (치명이면 critX 배). 결투·레이드는 대상이 하나라 multi 는 없다
const qiOnHit = (me, crit, t) => me.qi && qiAdd(me, (me.p.qi.hit || 0) * (crit && me.p.qi.critX ? me.p.qi.critX : 1), t);
// 맞았다: hurt (초당 hurtCap 까지). 기막(qiHurt) 보호막 동안은 그 배수
function qiOnHurt(me, t) {
  const q = me.qi, Q = me.p.qi;
  if (!q || !Q.hurt) return;
  if (Math.floor(t) !== q.hurtT) { q.hurtT = Math.floor(t); q.hurtN = 0; }
  const n = Math.min(Q.hurt * (me.ward && t < me.ward.until && me.ward.qiHurt ? me.ward.qiHurt : 1), (Q.hurtCap || Q.hurt) * (me.ward && t < me.ward.until && me.ward.qiHurt ? me.ward.qiHurt : 1) - q.hurtN);
  if (n > 0) { q.hurtN += n; qiAdd(me, n, t); }
}
// 쓸 수 있는가: 투지 기술은 투지 칸 ≥ 문턱, 주 기술은 기 ≥ 소모량 (dash 가 아니면 keep 만큼 남겨 둔다 — 킥복서 돌진용 1칸)
const qiCanUse = (me, s, dash) => (s.need ? s.tj >= s.need : s.cost ? me.qi.v >= s.cost + (dash ? 0 : me.p.qi.keep || 0) : false);
// 쓴다: 소모·문턱만큼 빼고, 쓴 기만큼 모든 투지 칸을 채운다. 장풍(m3)은 가득이면 3단 (기를 가득 쓰고 위력 m3 배). 궁극기는 각성
function qiUse(me, s, t) {
  const q = me.qi, Q = me.p.qi;
  let out = s;
  if (s.need) s.tj -= s.need;
  else {
    let spend = s.cost;
    if (s.m3 && q.v >= Q.max) { spend = s.cost * 1.5; out = { ...s, mult: s.mult * s.m3, q3: 1 }; }
    q.v -= spend;
    for (const o of me.skills) if (o.need) o.tj += spend;
  }
  if (s.awaken && Q.awaken) q.aw = t + s.dur + Q.awaken.dur;
  return out;
}
// 교전 중 한 틱: 시전 중이 아니면 초당 충전, 그다음 준비된 기술 (투지 기술 먼저, 그다음 목록 앞쪽 = 해금 레벨 높은 것)
function qiReady(me, dt, t) {
  me.busy -= dt;
  if (me.busy > 0) return null;
  qiAdd(me, (me.p.qi.perSec || 0) * dt, t);
  const pick = me.skills.find((s) => s.need && qiCanUse(me, s)) || me.skills.find((s) => s.cost && qiCanUse(me, s));
  if (!pick) return null;
  me.busy = pick.dur;
  me.cd = Math.max(me.cd, pick.dur);
  return qiUse(me, pick, t);
}

function readySkill(me, dt, t = 0) {
  if (me.qi) return qiReady(me, dt, t);
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

const moveOf = (k, t) => ({ t: k.stopT ?? round1(t), x: round1(k.x), ...(k.dashed ? { dash: { t: k.dashed.t, x: k.dashed.x } } : {}) });

// p: 클라이언트가 저장할 때 올린 전투 프로필 (sanitizeProfile 을 거친 값)
function simulateDuel(pa, pb, seed = (Math.random() * 2 ** 32) >>> 0) {
  const rng = mulberry32(seed);
  const hpMult = DUEL_HP * Math.max(HP_MULT, DUEL_SEC * (rateOf(pa) * (1 - pb.guard) / pb.maxHp + rateOf(pb) * (1 - pa.guard) / pa.maxHp) / 2);
  const make = (p, x, dir) => ({
    p, x, dir, hp: p.maxHp * hpMult, max: p.maxHp * hpMult, healBase: p.maxHp * hpMult / DUEL_HP,
    cd: 0.2 + rng() * 0.3,
    leapCd: p.leap ? p.leap.every / 2 : Infinity,
    // 돌진기는 개전 직후 준비되고, 걸어가는 동안에도 쿨타임이 돈다 (다른 스킬은 교전 시작 후부터)
    skills: makeSkills(p).map((s) => (GAP[s.id] ? { ...s, gap: GAP[s.id], left: 0.3 } : s)), busy: 0, ward: null,
    dash: null, dashed: null, stopT: null, dealt: 0,
  });
  const a = make(pa, 0, 1), b = make(pb, START_DIST, -1);
  qiInit(a); qiInit(b);
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
    if (kind === 'hit') qiOnHit(me, crit, t);
    qiOnHurt(op, t);
    bigHit = Math.max(bigHit, dmg / op.max);
    if (me.p.heal) me.hp = Math.min(me.max, me.hp + me.healBase * me.p.heal);
    if (sk && sk.lc) me.hp = Math.min(me.max, me.hp + dmg * sk.lc);      // lc: 스킬 흡혈 (트리 V2)
    if (sk && sk.ward) {
      me.ward = { until: t + sk.dur + sk.ward.dur, guard: sk.ward.guard, ...(sk.qiHurt ? { qiHurt: sk.qiHurt } : {}) };
      me.hp = Math.min(me.max, me.hp + me.healBase * sk.ward.heal);
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
        if (!me.dash) {
          for (const s of me.skills) if (s.gap) s.left -= DT;
          const g = me.skills.find((s) => s.gap && (me.qi ? qiCanUse(me, s, true) : s.left <= 0) && dist - reach <= s.gap);
          if (g) me.dash = me.dashed = { sk: g, t: round1(t), x: round1(me.x) };
        }
        const step = Math.min((me.dash ? DASH : WALK) * DT, dist - reach);
        me.x += me.dir * step;
        if (me.dash && me.qi && me.p.qi.dashPx) qiAdd(me, step * me.p.qi.dashPx, t);     // 킥복서: 돌진한 거리만큼 기
        continue;
      }
      if (me.stopT == null) me.stopT = round1(t);
      if (me.dash) {
        // 돌진이 닿았다: 그 스킬을 바로 쓴다
        let sk = me.dash.sk;
        me.dash = null;
        sk.left = sk.cd;
        if (me.qi) sk = qiUse(me, sk, t);
        me.busy = sk.dur;
        me.cd = Math.max(me.cd, sk.dur);
        hit(me, op, side, 'skill', sk);
        continue;
      }
      me.cd -= DT;
      me.leapCd -= DT;
      if (me.leapCd <= 0) { me.leapCd = me.p.leap.every; hit(me, op, side, 'leap'); continue; }
      const sk = readySkill(me, DT, t);
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
    start: START_DIST, walk: WALK, dashSpeed: DASH, hpMult: Math.round(hpMult * 10) / 10,
    // 기사는 한 번 멈추면 다시 움직이지 않으므로 멈춘 시각·위치만 알면 이동을 재현할 수 있다.
    // dash: 돌진을 시작한 시각·위치 (그때부터 dashSpeed 로 달려 멈춘 위치까지)
    moves: { a: moveOf(a, t), b: moveOf(b, t) },
    maxA: Math.round(a.max), maxB: Math.round(b.max),
    events,
  };
}

// 결투 점수 (Elo)
function eloDelta(winnerRating, loserRating, k = 32) {
  const expected = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  return Math.max(1, Math.round(k * (1 - expected)));
}

module.exports = { GAP, simulateDuel, eloDelta, makeSkills, readySkill, wardCut, qiInit, qiOnHit, qiOnHurt };
