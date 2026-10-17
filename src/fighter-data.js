'use strict';
// 파이터 계열 7종 데이터 (docs/specs/boxer-class.md). classes.js 다음에 불러온다 — WEAPONS·CLASSES·SKILLS 에 항목을 더하고,
// 기(氣) 게이지 규칙(QI)과 쿨타임 대신 쓰는 계산(소모량·문턱·등가 쿨타임)을 둔다. 원정 런타임은 src/jobs/fighter.js, 그림은 src/sprites.js.
//  파이터 계열 스킬(k.qi)에는 쿨타임이 없다:
//   주 기술 — 기 게이지가 소모량 이상이면 쓰고, 쓰면 소모량만큼 준다
//   투지 기술 — 기를 1 쓰면 모든 투지 칸이 1씩 찬다. 칸이 문턱에 닿으면 쓴다 (넘친 몫은 남는다)
//  전투력(dpsOf)·결투·레이드 프로필은 등가 쿨타임(소모량 또는 문턱 ÷ 평균 충전 속도)을 cd 로 쓴다 (qiCdOf).

// ── 무기 (motion: jab 주먹 2연타 · kick 앞차기/돌려차기 · palm 장타/쌍장) ──
Object.assign(WEAPONS, {
  wrapKnuckle:   { name: '붕대 너클',       kind: 'melee',  motion: 'jab',  range: 12, targets: 1, trail: '255,200,140' },
  steelGauntlet: { name: '강철 건틀릿',     kind: 'melee',  motion: 'jab',  range: 12, targets: 1, trail: '255,150,120' },
  ironShin:      { name: '철각 정강이받이', kind: 'melee',  motion: 'kick', range: 24, targets: 3, trail: '170,255,210' },
  qiBeads:       { name: '기공 염주',       kind: 'ranged', motion: 'palm', range: 80, targets: 1, shots: 1,
    arrow: { speed: 520, color: '#dfe4ff', magic: true, rgb: '168,180,255', size: 1.1, qi: 'xp1' } },
  kingGauntlet:  { name: '챔피언 건틀릿',   kind: 'melee',  motion: 'jab',  range: 14, targets: 1, trail: '255,220,120', glow: '#ffd257' },
  galeShin:      { name: '폭풍 각반',       kind: 'melee',  motion: 'kick', range: 26, targets: 3, trail: '190,250,255', glow: '#9ff0ff' },
  qiGodBeads:    { name: '천기 염주',       kind: 'ranged', motion: 'palm', range: 90, targets: 1, shots: 1, glow: '#e8e0ff',
    arrow: { speed: 560, color: '#fff6dc', magic: true, rgb: '255,230,170', size: 1.3, qi: 'xp2' } },
});

// ── 직업 (look.sheet: 통짜 스프라이트 시트 src/sprites/<id>.png — 조립식 몸통이 없다) ──
// 파이터는 새 기사만 될 수 있다: 견습 기사에서 1차를 고를 때만 (기존 1차 이상 기사의 계열 전환은 없다)
Object.assign(CLASSES, {
  fighter: {
    tier: 1, from: 'squire', name: '파이터', icon: '🥊', weapon: 'wrapKnuckle',
    mods: { atk: 1.05, hp: 1.38, aspd: 1.5, crit: 0.08 },
    desc: '붕대 감은 주먹. 평타가 빠르고, 기를 모아 원투 스트레이트를 터뜨린다.',
    look: { sheet: 'fighter', fx: '#ffb35c', lean: 0.14 },
  },
  striker: {
    tier: 2, from: 'fighter', name: '스트라이커', icon: '👊', weapon: 'steelGauntlet',
    mods: { atk: 2.52, hp: 1.75, aspd: 0.96, crit: 0.18, critMult: 0.3 },   // 결투 B안(2026-10-15): 공속 ×0.6·공격력 ×1.55 (dpsOf 거의 그대로, 진행 맞춤) → 0.22.0 원투 계승 약화 삭제분 ×0.927
    desc: '강철 건틀릿으로 한 놈을 두들긴다. 치명타가 터질수록 기가 두 배로 찬다.',
    look: { sheet: 'striker', fx: '#ff5a3a', lean: 0.14 },
  },
  kickboxer: {
    tier: 2, from: 'fighter', name: '킥복서', icon: '🦶', weapon: 'ironShin',
    mods: { atk: 1.88, hp: 1.65, aspd: 1.25, crit: 0.1 },
    desc: '발차기로 앞의 셋을 함께 찬다. 무리 속으로 파고들수록 기가 찬다.',
    look: { sheet: 'kickboxer', fx: '#5fe0a0' },
  },
  qigong: {
    tier: 2, from: 'fighter', name: '기공사', icon: '🧘', weapon: 'qiBeads',
    mods: { atk: 2.27, hp: 1.4, aspd: 1.0, crit: 0.12, guard: 0.05 },
    desc: '버틸수록 기가 찬다. 오래 모은 기를 장풍으로 쏜다.',
    look: { sheet: 'qigong', fx: '#a8b4ff' },
  },
  champion: {
    tier: 3, from: 'striker', name: '챔피언', icon: '🦁', weapon: 'kingGauntlet',
    mods: { atk: 3.13, hp: 2.3, aspd: 0.83, crit: 0.25, critMult: 0.5 },   // 결투 B안: 공속 ×0.45·공격력 ×1.96 → 계승 약화 삭제분 ×0.94
    desc: '황금 사자의 주먹. 각성하면 기가 두 배로 찬다.',
    look: { sheet: 'champion', fx: '#ffd257', lean: 0.14 },
  },
  tempest: {
    tier: 3, from: 'kickboxer', name: '템페스트', icon: '🍃', weapon: 'galeShin',
    mods: { atk: 3.89, hp: 2.05, aspd: 0.7, crit: 0.14 },   // 결투 B안: 공속 ×0.5·공격력 ×1.85 → 계승 약화 삭제분 ×0.936
    desc: '폭풍을 두른 발. 적 사이를 누비며 하단바를 휩쓴다.',
    look: { sheet: 'tempest', fx: '#9ff0ff' },
  },
  grandmaster: {
    tier: 3, from: 'qigong', name: '그랜드마스터', icon: '☯️', weapon: 'qiGodBeads',
    mods: { atk: 2.77, hp: 1.85, aspd: 1.05, crit: 0.16, guard: 0.1 },
    desc: '기의 끝에 닿은 자. 등 뒤의 기의 거인이 장풍을 내리꽂는다.',
    look: { sheet: 'grandmaster', fx: '#e8e0ff' },
  },
});
const SHEET_CLASSES = ['fighter', 'striker', 'kickboxer', 'qigong', 'champion', 'tempest', 'grandmaster'];

// ── 기 게이지 (스펙 3절 "직업별 기 게이지") ──
//  shape: bar 한 줄 · cells 3칸(킥복서) · tiers 3단(기공사). max 최대치.
//  hit 평타 적중 충전 · critX 치명이면 배수(스트라이커) · multi 함께 맞힌 적 한 마리당(킥복서, multiMax 마리까지)
//  perSec 교전 중 초당 · hurt 맞을 때마다(hurtCap 초당 최대) · dashPx 돌진 1px 당 · keep 사거리 안에서 남겨 두는 몫(킥복서 돌진용 1칸)
//  main: 주 기술 소모량 · need: 투지 기술 문턱
const QI_KICK = { shape: 'cells', max: 300, cell: 100, multi: 2.5, multiMax: 3, dashPx: 0.25, keep: 100 };
const QI_QIGONG = { shape: 'tiers', max: 300, cell: 100, hit: 2, perSec: 5, hurt: 3, hurtCap: 6 };
const QI = {
  fighter:     { shape: 'bar', max: 100, hit: 4.5, main: { oneTwo: 100 }, need: {} },
  striker:     { shape: 'bar', max: 100, hit: 3, critX: 2, main: { ironRush: 100 }, need: { oneTwo: 100, crushFist: 150 } },
  kickboxer:   { ...QI_KICK, hit: 6.5, main: { flyingKick: 100, spinKick: 100 }, need: { oneTwo: 150 } },
  qigong:      { ...QI_QIGONG, main: { palmBlast: 200 }, need: { oneTwo: 200, qiBarrier: 300 }, duelStart: 200 },   // 결투·레이드 시작 기 200 (그랜드마스터와 같이)
  champion:    { shape: 'bar', max: 100, hit: 2.5, critX: 2, main: { ironRush: 100 }, need: { oneTwo: 100, crushFist: 150, kingFist: 220 } },
  tempest:     { ...QI_KICK, hit: 5.8, main: { flyingKick: 100, spinKick: 100 }, need: { oneTwo: 150, heavenWind: 330 } },
  grandmaster: { ...QI_QIGONG, main: { palmBlast: 200 }, need: { oneTwo: 200, qiBarrier: 300, qiGodDescent: 480 }, duelStart: 185 },   // 결투·레이드는 기 185(투지도 같은 비율)에서 시작 — 첫 3단 장풍·궁극기 쏠림 방지 (2026-10-15 B안, 200 이면 3차 후반 60~66% 라 185)
};
const QI_AWAKEN = { dur: 6, mult: 2 };       // 3차 궁극기: 6초 동안 기 충전 두 배
const QI_PALM3 = 3.6 / 2.2;                  // 장풍 3단 위력 배수 (2단 대비, 기 1당 위력이 크다)
const QI_CDRESET = 0.5;                      // 고유 발동 cdreset(우로보로스) → 기 게이지 최대치의 50% 즉시
const isQiCls = (cls) => !!QI[cls];
const qiIsMain = (id, cls) => !!(QI[cls] && QI[cls].main[id] != null);
// 기 절약(트리 ⏱️ 자리의 ☯️) 비율을 뺀 소모량(주 기술) 또는 문턱(투지 기술). 그 직업의 규칙에 없는 스킬이면 0
function qiCostOf(k, cls = k.cls, b) {
  const q = QI[cls];
  if (!q) return 0;
  const base = q.main[k.id] != null ? q.main[k.id] : q.need[k.id] || 0;
  return Math.round(base * (1 - rightVal(k, 'cd', b)) * 10) / 10;
}
// 평균 충전 속도(기/초) — 스펙 7절. 평타 충전 × aspd × (1 + crit, 치명 두 배 직업만) + 초당 충전 + 피격 어림(초당 1회).
//  시전하는 동안은 평타·초당 충전이 멈춘다(피격 충전은 계속). 그래서 시전 시간 몫을 빼고 센다 (2026-10-14 구현 — 처음의 "× 0.9" 어림은
//  스킬이 넷인 3차에서 실제 빈도보다 약 40% 높게 잡혀 결투 전투력이 부풀었다):
//   기 1 을 쓸 때 시전에 드는 시간 B = Σ(시전 시간 ÷ 소모량·문턱) (주 기술은 쓰는 쪽 하나 + 투지 기술 전부, lvl 이 있으면 해금된 것만)
//   멈추는 충전 R 이면 실제 속도 = R ÷ (1 + R × B) + 피격 충전
//  st: { aspd, crit } (없으면 그 직업 기본치). 킥복서는 대상 1마리 기준 (결투·레이드와 같다)
function qiRateOf(cls, st, lvl) {
  const q = QI[cls];
  if (!q) return 0;
  const m = CLASSES[cls].mods;
  st = st || { aspd: 0.9 * (m.aspd || 1), crit: Math.min(0.8, 0.05 + (m.crit || 0)) };
  const R = (q.hit || 0) * st.aspd * (q.critX ? 1 + st.crit * (q.critX - 1) : 1) + (q.perSec || 0);
  const on = (id) => lvl == null || lvl >= SKILLS[id].lv;
  const mains = Object.keys(q.main).filter(on).sort((x, y) => SKILLS[y].lv - SKILLS[x].lv);
  let B = mains.length ? SKILLS[mains[0]].dur / q.main[mains[0]] : 0;
  for (const id in q.need) if (on(id)) B += SKILLS[id].dur / q.need[id];
  return R / (1 + R * B) + (q.hurt ? Math.min(q.hurt, q.hurtCap || q.hurt) : 0);
}
// 등가 쿨타임(초): 소모량·문턱 ÷ 평균 충전 속도. 전투력·결투·레이드 프로필과 스킬 탭 "평균 약 n초" 가 쓴다
//  lvl: 기사 레벨 — 주 기술이 둘(킥복서 돌진·회전)이면 사거리 안에선 해금 레벨이 높은 쪽만 쓰고 낮은 쪽은 돌진할 때만이라 QI_DASH_ONLY 배로 센다
const QI_DASH_ONLY = 3;
const qiCdOf = (k, cls = k.cls, b, st, lvl) => {
  const owner = isQiCls(cls) ? cls : k.cls, r = qiRateOf(owner, st, lvl), Q = QI[owner];
  if (!(r > 0)) return 99;
  const dashOnly = lvl != null && Q.main[k.id] != null && Object.keys(Q.main).some((o) => o !== k.id && SKILLS[o].lv > k.lv && lvl >= SKILLS[o].lv);
  return Math.round(qiCostOf(k, owner, b) / r * (dashOnly ? QI_DASH_ONLY : 1) * 10) / 10;
};
// 스킬 탭·직업 미리보기 문구: 쿨타임 대신 "기 100 소모 · 평균 약 18초" / "기 150 쓸 때마다 · 평균 약 21초" (cd = 등가 쿨타임)
function qiCdText(k, cls, b, cd) {
  const n = qiCostOf(k, cls, b), avg = `평균 약 ${Math.round(cd)}초`;
  if (!qiIsMain(k.id, cls)) return `기 ${n} 쓸 때마다 · ${avg}`;
  return `기 ${n} 소모${k.id === 'palmBlast' ? ' (가득이면 3단)' : ''} · ${avg}`;
}
// 서버(결투·레이드)에 넘기는 기 규칙 (server/duel.js qiInit). 프로필의 skills[] 에는 cost(주 기술) 또는 need(투지 기술)
const qiProfileOf = (cls) => {
  const q = QI[cls];
  if (!q) return null;
  const o = { max: q.max, hit: q.hit || 0 };
  for (const key of ['critX', 'multi', 'perSec', 'hurt', 'hurtCap', 'dashPx', 'keep', 'duelStart']) if (q[key]) o[key] = q[key];
  if (CLASSES[cls].tier === 3) o.awaken = QI_AWAKEN;
  return o;
};

// ── 스킬 (스펙 5절. 위력은 Lv1 총배율 = hits 배율 합 × SKILL_DMG[직업] × 1.6 / 1.4) ──
const QI_SKILLS = {
  oneTwo: {
    cls: 'fighter', qi: true, name: '원투 스트레이트', icon: '🥊', lv: 25, cd: 8, dur: 0.6, area: 'single',
    gap: 120,
    hits: [[0.3, 1.0], [0.6, 1.6]],
    stages: [
      {},
      { dur: 0.75, hits: [[0.26, 0.8], [0.5, 1.2], [0.62, 0.6, { area: 'line', reach: 3 }]] },
      { dur: 0.9, hits: [[0.22, 0.7], [0.42, 0.9], [0.68, 1.0, { area: 'all', radius: 40 }]] },
      { dur: 1.15, hits: [[0.2, 0.6], [0.38, 0.8], [0.7, 1.2, { area: 'line', reach: 7 }]] },
    ],
    right: ['cd', 'spec', 'crit'],
    spec: { type: 'first', name: '선제', icon: '🎯', full: 0.7 },
    stageName: ['원투', '원투 스트레이트', '원투 쓰리', '섬광권'],
    stageDesc: ['잽 두 번', '파고들며 잽·스트레이트, 끝에 충격파가 일직선으로', '훅까지 이어 주변을 쓸어 낸다', '주먹이 빛나 섬광 충격파가 멀리 뻗는다'],
    desc: '잽으로 거리를 재고 스트레이트를 꽂는다.',
  },
  ironRush: {
    cls: 'striker', qi: true, name: '연타 러시', icon: '👊', lv: 0, cd: 10, dur: 1.4, area: 'single',
    gap: 180,
    hits: evenHits(4, 0.2, 0.18, 0.85),
    stages: [
      {},
      { hits: [...evenHits(8, 0.16, 0.075, 0.3), [0.82, 1.0]] },
      { dur: 1.6, hits: [...evenHits(14, 0.12, 0.045, 0.18), [0.84, 1.0]] },
      { dur: 1.9, air: [0.4, 0.84], hits: [[0.18, 0.6, { launch: true }], ...evenHits(10, 0.42, 0.035, 0.16), [0.86, 1.2, { area: 'all', radius: 50 }]] },
    ],
    right: ['crit', 'spec', 'leech'],
    spec: { type: 'solo', name: '일대일', icon: '⚔️', full: 0.6 },
    stageName: ['연타', '연타 러시', '백열권', '천열권'],
    stageDesc: ['제자리 4연타', '파고들어 8연타 + 어퍼', '잔상 주먹 수십 개가 쏟아진다', '어퍼로 띄우고 공중까지 따라가 연타, 내리꽂는 마무리'],
    desc: '건틀릿으로 쉬지 않고 두들긴다.',
  },
  crushFist: {
    cls: 'striker', qi: true, name: '붕권', icon: '💥', lv: 70, cd: 16, dur: 1.1, area: 'single',
    hits: [[0.55, 3.9]],
    stages: [
      {},
      { hits: [[0.55, 2.6], [0.62, 1.3, { area: 'line', reach: 4 }]] },
      { dur: 1.25, hits: [[0.5, 2.2], [0.6, 1.7, { area: 'line', reach: 5 }]] },
      { dur: 1.5, hits: [[0.45, 1.6], [0.62, 2.3, { area: 'line', reach: 6 }]] },
    ],
    right: ['cd', 'spec', 'crit'],
    spec: { type: 'exec', name: '붕괴', icon: '🗡️', full: 0.7, thr: 0.35 },
    stageName: ['정권', '붕권', '붕산권', '철산붕괴'],
    stageDesc: ['한 걸음 내디뎌 정권', '맞은 적 뒤로 충격파가 일직선 관통', '땅이 갈라지며 균열이 앞으로 달린다', '등 뒤 거대한 강철 주먹 형상이 함께 내지른다'],
    desc: '온몸의 기를 실은 한 방. 맞은 적 너머까지 뚫는다.',
  },
  flyingKick: {
    cls: 'kickboxer', qi: true, name: '돌진 발차기', icon: '🦶', lv: 0, cd: 8, dur: 0.8, area: 'line', reach: 2,
    gap: 180,
    hits: [[0.5, 2.15]],
    stages: [
      { reach: 1.2 },
      {},
      { dur: 0.95, air: [0.2, 0.75], hits: [[0.38, 1.0], [0.62, 1.15]] },
      { dur: 1.0, reach: 4, hits: [[0.45, 0.8], [0.6, 1.35]] },
    ],
    right: ['cd', 'spec', 'leech'],
    spec: { type: 'refund', name: '연속 돌파', icon: '🔁', full: 0.15 },
    stageName: ['앞차기', '돌진 발차기', '비연각', '질풍비각'],
    stageDesc: ['짧게 뛰어 앞차기', '바람을 가르며 날아 차기', '공중에서 두 번 차고 착지', '바람을 두르고 일직선을 꿰뚫는다'],
    desc: '날아들며 앞의 적들을 한 줄로 걷어찬다.',
  },
  spinKick: {
    cls: 'kickboxer', qi: true, name: '회전 발차기', icon: '🌀', lv: 70, cd: 14, dur: 1.1, area: 'all', radius: 50,
    hits: [[0.55, 3.65]],
    stages: [
      {},
      { hits: [[0.35, 1.6], [0.7, 2.05]] },
      { dur: 1.3, hits: [[0.28, 1.1], [0.52, 1.1], [0.76, 1.45]] },
      { dur: 1.5, radius: 64, hits: [[0.25, 0.9], [0.45, 0.9], [0.62, 0.8], [0.86, 1.05, { area: 'all', radius: 70 }]] },
    ],
    right: ['leech', 'spec', 'cd'],
    spec: { type: 'crowd', name: '선풍', icon: '🍃', full: 0.5 },
    stageName: ['돌려차기', '회전 발차기', '선풍각', '폭풍선풍각'],
    stageDesc: ['한 바퀴', '두 바퀴, 주변을 쓸어 낸다', '세 바퀴, 회오리가 남는다', '회오리가 적을 끌어당기고 터진다'],
    desc: '몸을 돌려 둘레의 적을 모두 찬다.',
  },
  palmBlast: {
    cls: 'qigong', qi: true, name: '장풍', icon: '🖐️', lv: 0, cd: 10, dur: 1.1, area: 'line', reach: 1.6,
    hits: [[0.6, 3.7]],
    stages: [
      {},
      { hits: [[0.62, 2.6], [0.72, 1.1, { area: 'all', radius: 45 }]] },
      { hits: [[0.55, 1.6], [0.68, 1.4], [0.76, 0.7, { area: 'all', radius: 45 }]] },
      { hits: [[0.62, 2.2], [0.74, 1.5, { area: 'all', radius: 55 }]] },
    ],
    right: ['cd', 'spec', 'crit'],
    spec: { type: 'range', name: '기탄 확장', icon: '↔️', full: 0.5 },
    stageName: ['장타', '장풍', '쌍장풍', '기공탄'],
    stageDesc: ['손바닥 끝 기탄', '기탄이 날아가 터진다', '두 손에서 두 발', '거대 기탄이 터지며 기의 파편이 흩어진다'],
    desc: '모은 기를 손바닥으로 밀어 쏜다. 가득 모으면(3단) 더 크고 세다.',
  },
  qiBarrier: {
    cls: 'qigong', qi: true, name: '기막', icon: '🛡️', lv: 70, cd: 16, dur: 0.9, area: 'all', radius: 40,
    hits: [[0.6, 0.6]], ward: { dur: 4, guard: 0.4, heal: 0.1, tick: 0.4, finish: 1.4, qiHurt: 2 },
    stages: [
      { ward: { dur: 3 } },
      {},
      {},
      { ward: { finish: 2 } },
    ],
    right: ['cd', 'spec', 'leech'],
    spec: { type: 'chain', name: '기 순환', icon: '✨', full: 0.3 },
    stageName: ['호신기', '기막', '금강기막', '금강불괴'],
    stageDesc: ['몸에 얇은 기의 막', '반구형 기의 막', '막 둘레에 기의 고리 셋이 돈다', '끝날 때 막이 터지며 기 폭발'],
    desc: '기의 막을 두른다. 막이 있는 동안 피해를 덜 받고, 맞을 때 기가 두 배로 찬다.',
  },
  kingFist: {
    cls: 'champion', qi: true, ult: true, name: '패왕권', icon: '🦁', lv: 100, cd: 20, dur: 2.6, area: 'all', radius: 230,
    hits: [...evenHits(8, 0.3, 0.05, 0.5), [0.86, 4.2]],
    stages: [
      {},
      { hits: [...evenHits(12, 0.28, 0.04, 0.35), [0.88, 4]] },
      { dur: 2.9, hits: [...evenHits(16, 0.25, 0.035, 0.27), [0.9, 4]] },
      { dur: 3.2, hits: [...evenHits(14, 0.22, 0.035, 0.25), [0.9, 4.7, { area: 'all', radius: 260, launch: true }]] },
    ],
    right: ['cd', 'spec', 'crit'],
    spec: { type: 'boss', name: '패왕', icon: '🪨', full: 0.8 },
    stageName: ['패왕권', '패왕난무', '패왕격류', '천하패왕권'],
    stageDesc: ['하단바를 가로지르는 무쌍 난타, 마지막 정권 충격파', '잔상 셋과 함께 난타', '주먹 비가 하늘에서 쏟아진다', '거대한 황금 사자 주먹이 하단바를 덮는다'],
    desc: '각성해 하단바를 가로지르며 난타한다. 6초 동안 기가 두 배로 찬다.',
  },
  heavenWind: {
    cls: 'tempest', qi: true, ult: true, name: '천풍각', icon: '🍃', lv: 100, cd: 20, dur: 2.6, area: 'all', radius: 230,
    hits: [...evenHits(8, 0.3, 0.06, 0.5), [0.88, 4.3]],
    stages: [
      {},
      { hits: [...evenHits(12, 0.26, 0.045, 0.35), [0.88, 4]] },
      { dur: 2.9, hits: [...evenHits(10, 0.25, 0.05, 0.3), [0.9, 5.3]] },
      { dur: 3.2, hits: [...evenHits(10, 0.22, 0.045, 0.3), [0.9, 5.3, { area: 'all', radius: 260, launch: true }]] },
    ],
    right: ['cd', 'spec', 'leech'],
    spec: { type: 'crowd', name: '천풍', icon: '🍃', full: 0.6 },
    stageName: ['천풍각', '천풍난각', '천풍회선', '천풍신각'],
    stageDesc: ['회오리 속에서 가로지르며 연속 차기', '분신 둘과 교차', '하단바 위 거대 회오리', '하늘에서 바람의 발이 내려찍는다'],
    desc: '각성해 회오리 속에서 하단바를 휩쓴다. 6초 동안 기가 두 배로 찬다.',
  },
  qiGodDescent: {
    cls: 'grandmaster', qi: true, ult: true, name: '기신 강림', icon: '☯️', lv: 100, cd: 20, dur: 2.7, area: 'all', radius: 230,
    hits: [[0.45, 1.6], [0.62, 1.6], [0.86, 5.1]],
    stages: [
      {},
      { hits: [[0.4, 1.4], [0.55, 1.4], [0.7, 1.4], [0.88, 4.1]] },
      { dur: 3.0, hits: [...evenHits(6, 0.32, 0.08, 0.6), [0.9, 4.7]] },
      { dur: 3.3, hits: [...evenHits(6, 0.3, 0.07, 0.5), [0.9, 5.3, { area: 'all', radius: 260, launch: true }]] },
    ],
    right: ['cd', 'spec', 'crit'],
    spec: { type: 'stun', name: '기압', icon: '💫', full: 2 },
    stageName: ['기신 강림', '기신 법상', '천수기신', '기신천붕'],
    stageDesc: ['등 뒤 기의 거인이 장풍을 내리꽂는다', '거인이 두 손으로', '팔 여럿의 거인이 연달아', '거인이 하단바 전체를 손바닥으로 덮는다'],
    desc: '각성해 등 뒤에 기의 거인을 세운다. 6초 동안 기가 두 배로 찬다.',
  },
};
for (const id in QI_SKILLS) QI_SKILLS[id].id = id;
Object.assign(SKILLS, QI_SKILLS);
// 스킬 위력 (같은 차수 평균에 맞춤 — 스펙 8절 순서로 조정)
// 물려받은 원투는 0.20.11 부터 2·3차에서도 원래 위력 (INHERIT_DMG 삭제) — 대신 2·3차 mods.atk 를 낮춰 직업 전체 DPS 를 맞췄다
Object.assign(SKILL_DMG, { fighter: 2.3, striker: 1.75, kickboxer: 1.75, qigong: 1.8, champion: 1.5, tempest: 1.5, grandmaster: 1.5 });
// 스킬 도트 아이콘 (src/iconmap.js SKILL_CP 에 sk-<id> 가 생기면 classes.js 끝과 같은 식으로 바꿔 끼운다)
if (typeof SKILL_CP !== 'undefined') for (const id in QI_SKILLS) if (SKILL_CP[id]) { SKILLS[id].emoji = SKILLS[id].icon; SKILLS[id].icon = String.fromCharCode(SKILL_CP[id]); }
