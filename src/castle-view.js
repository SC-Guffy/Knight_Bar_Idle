'use strict';
// 🏰 성벽 지키기 하단바 연출. 규칙(웨이브·보상·업그레이드)은 src/castle.js. 스펙: docs/specs/castle-defense.md
// 캠프에서 빛에 싸여 사라짐 → 화면 왼쪽 끝 성벽 앞 성문에 나타남 → 화면 오른쪽 끝에서 5마리 무리가 달려와 전장(480px)을 건너온다 →
// 줄을 서지 않고 기사 앞에 겹겹이 붙어 모두가 기사를 친다 (1:n 포위, 2차 개편 10-15. 전투는 원정 fightTick 그대로) →
// 🔥 끓는 기름 버튼(castleOil): 성벽 위 가마솥을 쏟아 성문 앞 무리에 피해 + 화상 → 기사가 쓰러지면 5초 동안 몬스터가 성벽으로 몰려가 친다 →
// 성벽 위 궁수·투석기·교관이 같이 싸운다 → 성공(깃발·색종이)·실패(먼지) 뒤 귀환 빛으로 캠프.
// sub: warpOut 캠프에서 사라짐 | fight 진행 | end 끝 연출 | home 귀환 빛
// 그림: 성벽·궁수·투석기·돌은 도트 오브젝트(코드). 지원군 명중 이펙트는 지금 기존 burst·ring 을 빌려 쓴다 —
//   PixelLab 텍스처로 바꾸는 것은 남은 일 (VFX 공통 기반이 들어온 뒤, castle-defense.md "남은 일").
let cdv = null;
const CW_W = 64, CW_H = 70;                 // 성벽 폭·높이 px
const castleInside = () => !!cdv && cdv.sub !== 'warpOut';
// 성벽은 언제나 화면 왼쪽 끝. 전장 = 성문부터 min(창 폭 − 성벽 폭, 480)px. 몬스터는 화면 오른쪽 끝(spawnX)에서 달려 나와
//  전장 끝(fieldX)에 들어서면 정해진 속도로 걷는다 → 창 폭과 상관없이 판 흐름이 같다
function castleLayout() {
  const lane = Math.max(120, Math.min(W - CW_W, CASTLE_LANE_MAX));
  const wallX = 0, gateX = CW_W;
  return { lane, wallX, gateX, homeX: gateX + 10, fieldX: gateX + lane, spawnX: Math.max(gateX + lane, W + 10), top: groundY() - CW_H };
}
const CASTLE_RUSH_SEC = 1.2;
const CASTLE_PILE_DEPTH = 40;              // 무리 두께 px (몬스터 사거리에 더해 이만큼 뒤에서도 친다)               // 화면 끝 → 전장 끝을 달려오는 시간 (창이 넓을 때만)

function beginCastleView() {
  cdv = { sub: 'warpOut', t: 0, hold: 0, res: null, q: [], proj: [], arch: 0, catT: CASTLE_CAT_SEC, mt: {}, downT: 0, wallHit: 0, flag: 0, oilCd: 0, oil: 0, pile: 0 };
  monsters = []; shots = []; lapReady = false;
  Object.assign(knight, { down: 0, fighting: false, pending: false, swing: -1, ward: null });
  warpKnight('out');
}
function endCastleView() { cdv = null; }

// 몬스터 한 마리를 화면 오른쪽 끝에 세운다 (spec: castle.js castleWaveMobs 의 한 줄). 무리 안에서 조금씩 흩어진다
//  pileOff: 기사 앞에 붙을 때 무리 안에서 서는 깊이(0~1, 겹겹이 서게) · lift: 위아래 몇 px (무리가 두께 있게)
//  무리 두께 = 몬스터 사거리 + CASTLE_PILE_DEPTH. 사거리 안에만 서면 9마리가 18px 안에 겹쳐 2~3마리로 보여서, 뒷줄도 치게 하고 넓게 세웠다
function castleSpawn(sp, wi, j) {
  const Ly = castleLayout();
  const m = makeMonster(sp.type, !!sp.boss, toWorld(Ly.spawnX + 6 + rand(0, 20)), { hp: sp.hp, atk: sp.atk, gold: 0, exp: 0, boss: !!sp.boss });
  m.wi = wi; m.pts = sp.pts; m.atkCd = sp.cd; m.spd = Ly.lane / castleLaneSec(!!sp.boss);
  m.spdK = sp.boss ? 1 : rand(CASTLE_SPD_JIT[0], CASTLE_SPD_JIT[1]);   // 저마다 빠르기가 달라 덩어리가 아니라 우르르 흩어져 달려온다
  if (sp.boss === 2) m.scale = Math.round(PX * 2.5);
  m.wallT = rand(0.2, 0.8);
  m.pileOff = sp.boss ? 0 : rand(0, 1); m.lift = sp.boss ? 0 : Math.round(rand(0, 8));   // pileOff 는 붙는 깊이 비율 (0 = 무리 맨 뒤, 1 = 기사 몸에 붙음)
  m.pileReach = sp.boss ? 0 : CASTLE_PILE_DEPTH;      // 무리 뒷줄도 앞줄을 밀어붙이며 친다 (world.js fightTick 의 몬스터 사거리에 더한다)
  m.atkTimer = rand(0, sp.cd);              // 한꺼번에 붙어도 같은 박자로 치지 않게
  monsters.push(m);
}
// 처치 (hitMonster·지원군): 점수·웨이브 남은 수
function castleViewKill(m) {
  if (!S.castle.run || m.wi == null) return;
  const done = castleKill(m.wi, m.pts || 1);
  if (m.boss) addFloater(`👑 +${m.pts}`, toScreen(m.x), monsterTop(m) - 10, '#ffd257', 13, true);
  if (done) addFloater(`🛡️ WAVE ${m.wi + 1} 막음!`, toScreen(knight.x) + 30, groundY() - 84, '#9fffc0', 12, true);
}
// 지원군·교관 피해: 치명 없음, 흡혈 없음, 장비 옵션 줄의 보스 피해는 받는다
function castleSupportHit(m, dmg, color = '#c9e6ff', kb = 0) {
  if (!m || m.dying) return;
  const gb = gearBonus();
  if (gb.bossDmg && m.boss) dmg *= 1 + gb.bossDmg;
  m.hp -= dmg;
  m.flash = 0.08; m.hurt = 1;
  if (kb) m.x += m.boss ? kb * 0.3 : kb;
  addFloater(fmt(dmg), toScreen(m.x) + rand(-6, 6), monsterTop(m) - 4, color, 11);
  if (m.hp > 0) return;
  m.dying = 0.001; m.killed = true;
  shatter(m);
  castleViewKill(m);
}

// 🔥 끓는 기름 (castle-defense.md "끓는 기름"): 버튼(castle-ui.js) → 성벽 위 가마솥이 기울고 0.35초 뒤 성문 앞 CASTLE_OIL_R px 에 쏟아진다.
//  즉시 피해 지원군 위력 × CASTLE_OIL_K + 화상 CASTLE_OIL_BURN_SEC 초 (초당 × CASTLE_OIL_BURN, 0.5초마다 나눠 넣는다). 기사가 쓰러져 있어도 쓸 수 있다
const CASTLE_OIL_DELAY = 0.35;
const castleOilReady = () => !!cdv && cdv.sub === 'fight' && !!S.castle.run && cdv.oilCd <= 0;
function castleOil() {
  if (!castleOilReady()) return false;
  cdv.oilCd = CASTLE_OIL_CD; cdv.oil = 0.001;
  const Ly = castleLayout(), gy = groundY(), pow = castlePow(), x0 = Ly.gateX, x1 = Ly.gateX + CASTLE_OIL_R;
  // 쏟아지는 줄기 → 바닥에서 용암 돔처럼 끓어오름 + 튀는 기름 (PixelLab 시트 e34·k23 을 불 램프로)
  texFx('e34', (x0 + x1) / 2, gy + 2, MG_RAMP.fire, { anchor: 'b', scale: 4 / 3, life: 0.9, delay: CASTLE_OIL_DELAY, fade: 0.35 });
  texFx('k23', x0 + 26, gy + 2, MG_RAMP.fire, { anchor: 'b', life: 0.6, delay: CASTLE_OIL_DELAY + 0.05 });
  texFx('k23', x1 - 18, gy + 2, MG_RAMP.fire, { anchor: 'b', flip: true, life: 0.6, delay: CASTLE_OIL_DELAY + 0.12 });
  skFx(null, CASTLE_OIL_DELAY, 0, null, () => {
    if (!cdv || !S.castle.run) return;
    shake = Math.max(shake, 0.3);
    for (const m of monsters) {
      if (m.dying) continue;
      const x = toScreen(m.x);
      if (x < x0 - 4 || x > x1 + monsterWidth(m) / 2) continue;
      m.burn = { t: CASTLE_OIL_BURN_SEC, tick: 0.5, dmg: pow * CASTLE_OIL_BURN * 0.5 };
      castleSupportHit(m, pow * CASTLE_OIL_K, '#ffb13b');
      if (!m.dying) m.stun = Math.max(m.stun || 0, CASTLE_OIL_STUN * (m.boss ? 0.5 : 1));
    }
  });
  showBanner('🔥 끓는 기름!', '#ffb13b', 18, 1.2);
  return true;
}
function castleBurnTick(dt) {
  for (const m of monsters) {
    const b = m.burn;
    if (!b || m.dying) continue;
    b.t -= dt;
    if ((b.tick -= dt) <= 0) {
      b.tick += 0.5;
      texFx('h15', toScreen(m.x) + rand(-4, 4), groundY() - rand(4, 14), MG_RAMP.fire, { scale: 2 / 3, life: 0.35 });
      castleSupportHit(m, b.dmg, '#ff8a3a');
    }
    if (b.t <= 0) m.burn = null;
  }
}

function castleViewDown() {
  const r = S.castle.run;
  if (!r) return;
  r.downs++;
  S.hp = 0;
  knight.down = CASTLE_RESPAWN_SEC;
  knight.fighting = false; knight.pending = false; knight.ward = null;
  endCast('hero');
  shots = [];
  knight.x = toWorld(castleLayout().homeX);       // 쓰러진 자리는 성문 앞 (몬스터가 기사를 지나 성벽으로 몰려간다)
  monsters.forEach((m) => { m.anim = null; m.engaged = false; });
  showBanner('💀 기사가 쓰러졌다! 성벽을 지켜라', '#ff8f8f', 18, 2.4);
  shake = Math.max(shake, 0.25);
}
function castleRespawn() {
  const Ly = castleLayout();
  S.hp = stats().maxHp;
  knight.x = toWorld(Ly.homeX); knight.facing = 1;
  effects.push({ type: 'pillar', t: 0, color: '#ffe9a0' });
  addFloater('다시 일어섰다!', Ly.homeX, groundY() - 62, '#ffffff', 12, true);
  monsters.forEach((m) => { m.anim = null; });
}

// 판 끝: 정산하고 끝 연출
function castleEndRun(reason) {
  if (!cdv || !S.castle.run) return;
  cdv.res = endCastle(reason);
  monsters.forEach((m) => { if (!m.dying) m.dying = 0.001; m.anim = null; });
  knight.fighting = false; knight.pending = false; knight.ward = null; knight.down = 0;
  endCast('hero');
  shots = []; cdv.proj = []; cdv.q = [];
  const Ly = castleLayout(), gy = groundY();
  if (reason === 'clear') {
    showBanner('🎉 성벽 사수!', 'rainbow', 26, 3);
    for (let i = 0; i < 4; i++) burst(Ly.wallX + rand(10, CW_W - 10), Ly.top - 10, 18, ['#ff5a5a', '#ffd257', '#9fffc0', '#5ee0ff', '#ffffff'], 140, 3, 160);
    cdv.flag = 0.001;
  } else if (reason === 'broken') {
    showBanner('💥 성벽 붕괴', '#ff8f8f', 22, 2.6);
    shake = Math.max(shake, 0.6);
    for (let i = 0; i < 40; i++) parts.push({ x: Ly.wallX + rand(0, CW_W), y: Ly.top + rand(0, CW_H), vx: rand(-60, 60), vy: rand(-120, -20), g: 300, size: 3, color: i % 3 ? '#8a8292' : '#c9b38a', life: rand(0.6, 1.2), t: 0 });
  } else if (reason === 'timeout') showBanner('⏱️ 시간 초과', '#ffd257', 22, 2.6);
  else if (reason === 'retreat') addFloater('🏳️ 후퇴!', Ly.homeX, gy - 60, '#ffd257', 12);
  cdv.sub = 'end'; cdv.t = 0; cdv.hold = reason === 'retreat' ? 0.4 : 2.2;
  save();
}
function castleRetreat() { castleEndRun('retreat'); }

// 몬스터 이동 (1:n 포위): 줄을 서지 않는다. 기사가 서 있으면 모두 기사 사거리 안까지 와서 겹겹이 붙고(pileStop — fightTick 도 이 자리를 쓴다),
//  쓰러져 있으면 성벽(성문)으로 몰려간다. 화면 끝 → 전장 끝은 달려온다
function castleMove(dt, Ly) {
  const alive = monsters.filter((m) => !m.dying).sort((a, b) => aheadDist(knight.x, a.x) - aheadDist(knight.x, b.x));
  const rush = Math.max(0, Ly.spawnX - Ly.fieldX) / CASTLE_RUSH_SEC;
  let pile = 0;
  for (const m of alive) {
    const d = aheadDist(knight.x, m.x);
    const stop = knight.down > 0 ? Math.max(1, monsterWidth(m) / 2 - 8) : Math.max(4, (monsterReach(m) + (m.pileReach || 0)) * (1 - 0.9 * (m.pileOff || 0)));
    m.pileStop = knight.down > 0 ? null : stop;
    const stunned = m.stun > 0;
    m.moving = d > stop + 0.5 && !m.anim && !stunned;
    const spd = (toScreen(m.x) > Ly.fieldX ? Math.max(m.spd * 3, rush) : m.spd) * (m.spdK || 1);
    if (d > stop && !stunned) m.x -= Math.min(spd * dt, d - stop);
    if (knight.down <= 0 && aheadDist(knight.x, m.x) <= monsterReach(m) + (m.pileReach || 0) + 1) pile++;
  }
  if (dt > 0) cdv.pile = pile;
  return alive;
}
// 쓰러진 동안: 성문에 닿은 몬스터가 모두 성벽을 친다 (일반 1.4초마다 3, 보스 2초마다 24)
function castleWallAttacks(dt, alive, Ly) {
  for (const m of alive) {
    if (m.anim) { m.anim.t += dt; if (m.anim.t >= m.anim.dur) m.anim = null; }
    if (m.stun > 0 || aheadDist(knight.x, m.x) > monsterWidth(m) / 2 + 4) continue;   // 💫 기름에 데어 멈칫한 동안은 성벽도 못 친다
    if ((m.wallT -= dt) > 0) continue;
    const hit = m.boss ? CASTLE_WALL_HIT.boss : CASTLE_WALL_HIT.mob;
    m.wallT = hit.cd;
    m.anim = { t: 0, dur: Math.min(0.5, hit.cd * 0.85), hit: true };
    cdv.wallHit = 0.15;
    for (let i = 0; i < (m.boss ? 10 : 4); i++) parts.push({ x: Ly.gateX - rand(0, 6), y: groundY() - rand(8, 40), vx: rand(-80, 10), vy: rand(-110, -30), g: 380, size: 2 + (i % 2), color: i % 2 ? '#8a8292' : '#b5aebd', life: rand(0.3, 0.6), t: 0 });
    addFloater(`-${hit.dmg}`, Ly.wallX + CW_W / 2 + rand(-8, 8), Ly.top - 6, '#ff9f9f', 11);
    if (m.boss) shake = Math.max(shake, 0.15);
    if (castleWallHit(hit.dmg)) { castleEndRun('broken'); return; }
  }
}

// 가장 앞선(성문에 가까운) 적
const castleFront = () => monsters.filter((m) => !m.dying).sort((a, b) => aheadDist(knight.x, a.x) - aheadDist(knight.x, b.x));
// 성벽 위 자리: 궁수 · 투석기 · 교관 (창이 좁으면 교관은 특기 차례인 한 명만)
function castleSlots(Ly) {
  const top = Ly.top, n = castleArchers(castleUp('archer'));
  const archers = Array.from({ length: n }, (_, i) => ({ x: Ly.gateX - 20 - i * 9, y: top }));
  const cat = castleUp('catapult') ? { x: Ly.wallX >= 30 ? Ly.wallX - 14 : Ly.wallX + 12, y: Ly.wallX >= 30 ? groundY() : top } : null;
  const ms = castleMentors(), mpos = [];
  const room = Math.max(1, Math.floor((Ly.gateX - 20 - n * 9 - (cat && Ly.wallX < 30 ? 26 : 0)) / 24));
  ms.forEach((m, k) => mpos.push({ ...m, x: Ly.gateX - 26 - n * 9 - k * 24, vis: true }));
  if (ms.length > room) {
    // 다음 특기 차례인 교관 하나만 보인다
    const next = ms.reduce((a, m) => ((cdv.mt[m.id] ?? 99) < (cdv.mt[a.id] ?? 99) ? m : a), ms[0]);
    mpos.forEach((p) => { p.vis = p.id === next.id; p.x = Ly.gateX - 26 - n * 9; });
  }
  return { archers, cat, mentors: mpos };
}

// 지원군: 궁수대(1초마다 한 발씩 나눠 쏨) · 투석기(6초마다 돌) · 교관(10초마다 특기, 2초씩 엇갈림)
function castleSupport(dt, Ly) {
  const front = castleFront(), f = front[0], atk = castlePow(), slots = castleSlots(Ly);     // 지원군 위력 (castle.js castlePow)
  const aLv = castleUp('archer');
  if (aLv && slots.archers.length) {
    cdv.arch -= dt;
    if (cdv.arch <= 0 && f) {
      cdv.arch = 1 / slots.archers.length;
      cdv.archI = ((cdv.archI || 0) + 1) % slots.archers.length;
      const a = slots.archers[cdv.archI], dmg = atk * CASTLE_ARCHER_PER * aLv;     // 궁수대 초당 피해를 궁수 수만큼 나눠 1초에 한 바퀴
      cdv.proj.push({ kind: 'arrow', x0: a.x + 2, y0: a.y - 8, m: f, t: 0, dur: 0.45, arc: 14, hit: (m) => castleSupportHit(m, dmg) });
    }
  }
  if (slots.cat) {
    cdv.catT -= dt;
    if (cdv.catT <= 0 && f) {
      cdv.catT = CASTLE_CAT_SEC;
      cdv.catSwing = 0.001;
      const dmg = atk * (1 + CASTLE_CAT_PER * castleUp('catapult'));
      cdv.proj.push({ kind: 'stone', x0: slots.cat.x, y0: slots.cat.y - 18, m: f, t: 0, dur: 0.9, arc: 60, hit: (m, x) => {
        for (const o of monsters) if (!o.dying && Math.abs(toScreen(o.x) - x) <= CASTLE_CAT_R) castleSupportHit(o, dmg, '#ffd2a0');
        effects.push({ type: 'ring', x, y: groundY() - 2, t: 0, life: 0.45, size: 0.7, color: 'rgba(214,196,150,0.9)' });
        burst(x, groundY() - 8, 14, ['#8a8292', '#c9b38a', '#ffffff'], 120, 3, 300);
        shake = Math.max(shake, 0.12);
      } });
    }
  }
  slots.mentors.forEach((mp, k) => {
    if (cdv.mt[mp.id] == null) cdv.mt[mp.id] = 3 + 2 * k;     // 교관끼리 2초씩 엇갈려 시작
    if ((cdv.mt[mp.id] -= dt) > 0 || !f) return;
    cdv.mt[mp.id] = CASTLE_MENTOR_SEC;
    cdv.ml = cdv.ml || {}; cdv.ml[mp.id] = 0.6;              // 기울기·번쩍
    castleMentorSkill(mp, atk * CASTLE_MENTOR_PER * mp.stars, front, Ly);
  });
  if (cdv.ml) for (const id of Object.keys(cdv.ml)) cdv.ml[id] = Math.max(0, cdv.ml[id] - dt);
}
// 교관 특기 (castle-defense.md "성벽 위 교관")
function castleMentorSkill(mp, dmg, front, Ly) {
  const y0 = Ly.top - 18, f = front[0];
  const M = MENTORS[mp.i];
  addFloater(`${M.icon} ${M.name}`, mp.x, Ly.top - 40, '#ffe9a0', 11);
  switch (mp.id) {
    case 'sword':     // 검기: 성벽에서 오른쪽으로 일직선, 맞는 적 모두
      cdv.proj.push({ kind: 'wave', x: Ly.gateX, y: groundY() - 22, v: 520, hitSet: new Set(), dmg, t: 0 });
      break;
    case 'shield':    // 방패 던지기: 가장 앞선 적 하나 + 20px 밀쳐냄
      cdv.proj.push({ kind: 'shield', x0: mp.x, y0, m: f, t: 0, dur: 0.4, arc: 10, hit: (m) => castleSupportHit(m, dmg, '#9fd8ff', 20) });
      break;
    case 'hunter':    // 화살 세 발: 앞에서부터 3마리
      front.slice(0, 3).forEach((m, i) => cdv.proj.push({ kind: 'arrow', x0: mp.x, y0, m, t: -i * 0.08, dur: 0.4, arc: 10, big: 1, hit: (o) => castleSupportHit(o, dmg, '#9fffc0') }));
      break;
    case 'brute':     // 도끼 투척: 가장 앞선 적 자리 반경 40px
      cdv.proj.push({ kind: 'axe', x0: mp.x, y0, m: f, t: 0, dur: 0.6, arc: 36, hit: (m, x) => {
        for (const o of monsters) if (!o.dying && Math.abs(toScreen(o.x) - x) <= 40) castleSupportHit(o, dmg, '#ffb13b');
        burst(x, groundY() - 14, 12, ['#ff5a1f', '#ffb13b', '#ffe066'], 110, 2, 200);
      } });
      break;
    case 'sage':      // 별똥별: 가장 앞선 적 자리 반경 56px
      cdv.proj.push({ kind: 'star', m: f, t: 0, dur: 0.7, hit: (m, x) => {
        for (const o of monsters) if (!o.dying && Math.abs(toScreen(o.x) - x) <= 56) castleSupportHit(o, dmg, '#d59fff');
        effects.push({ type: 'ring', x, y: groundY() - 2, t: 0, life: 0.5, size: 0.8, color: 'rgba(213,159,255,0.9)' });
        burst(x, groundY() - 10, 16, ['#d59fff', '#ffffff', '#7df9ff'], 130, 2, 160);
        shake = Math.max(shake, 0.1);
      } });
      break;
  }
}
// 투사체: 대상 몬스터를 따라가며 포물선으로 날아가 닿으면 hit(m, 닿은 x)
function castleProjTick(dt) {
  for (const p of cdv.proj) {
    if (p.kind === 'wave') {
      p.t += dt; p.x += p.v * dt;
      for (const m of monsters) if (!m.dying && !p.hitSet.has(m) && Math.abs(toScreen(m.x) - p.x) < 8) { p.hitSet.add(m); castleSupportHit(m, p.dmg, '#ffffff', 4); }
      if (p.x > W + 20) p.done = true;
      continue;
    }
    if ((p.t += dt) < 0) continue;
    if (p.m && !p.m.dying) { p.tx = toScreen(p.m.x); p.ty = monsterMidY(p.m); }
    if (p.tx == null) { p.done = true; continue; }
    if (p.t >= p.dur) { p.done = true; p.hit(p.m && !p.m.dying ? p.m : null, p.tx); }
  }
  cdv.proj = cdv.proj.filter((p) => !p.done);
}

function updateCastle(dt) {
  if (!cdv) beginCastleView();
  const run = S.castle.run, Ly = castleLayout();
  if (cdv.wallHit > 0) cdv.wallHit -= dt;
  if (cdv.flag) cdv.flag += dt;
  if (cdv.catSwing) { cdv.catSwing += dt; if (cdv.catSwing > 0.5) cdv.catSwing = 0; }
  if (cdv.oil) { cdv.oil += dt; if (cdv.oil > 1) cdv.oil = 0; }
  switch (cdv.sub) {
    case 'warpOut':
      if ((cdv.t += dt) >= WARP_SEC) {
        clearTowerFx();
        Object.assign(knight, { x: toWorld(Ly.homeX), facing: 1 });
        warpKnight('in');
        cdv.sub = 'fight';
        if (run) showBanner(`🏰 성벽 지키기 ${run.lv}단계`, '#ffd257');
      }
      break;
    case 'fight': {
      if (!run) { cdv.sub = 'end'; cdv.t = 0; cdv.hold = 0.3; break; }
      run.t += dt;
      // 웨이브: 시간이 되면 5마리 무리를 1.5초 간격으로 쏟아낸다 (보스는 무리 맨 뒤)
      if (run.wave < CASTLE_WAVES.length && run.t >= run.nextAt) {
        const w = castleNextWave();
        // 무리마다 1.5초 칸 안에서 제각각 튀어나온다 (한 덩어리로 붙어 오지 않게 — 사용자 10-15 "우르르 와서 앞에서 뭉치게")
        w.mobs.forEach((sp, i) => cdv.q.push({ at: run.t + Math.floor(i / CASTLE_SPAWN_PACK) * CASTLE_SPAWN_GAP + (sp.boss ? CASTLE_SPAWN_GAP : rand(0, CASTLE_SPAWN_GAP)), sp, wi: w.wi, j: i % CASTLE_SPAWN_PACK }));
        cdv.q.sort((a, b) => a.at - b.at);
        if (w.boss) { showBanner(w.last ? '👑 BOSS WAVE! 거대 보스' : '👑 BOSS WAVE!', '#ff5a5a', 22, 2.4); shake = Math.max(shake, 0.35); }
        else showBanner(`WAVE ${w.wi + 1}`, '#ffd257', 20, 1.6);
      }
      while (cdv.q.length && cdv.q[0].at <= run.t) { const s = cdv.q.shift(); castleSpawn(s.sp, s.wi, s.j); }
      if (castleAllClear(run)) { castleEndRun('clear'); break; }
      if (castleTimeLeft(run) === 0) { castleEndRun('timeout'); break; }
      const alive = castleMove(dt, Ly);
      if (knight.down > 0) {
        knight.down -= dt;
        castleWallAttacks(dt, alive, Ly);
        if (!S.castle.run) break;
        if (knight.down <= 0) { knight.down = 0; castleRespawn(); }
      } else {
        const st = stats();
        fightTick(dt, st, (px) => {
          if (px != null) { knight.x += px; return; }       // 돌진기
          // 칠 적이 사거리에 없으면 성문 앞으로 걸어 돌아온다
          if (Math.abs(toScreen(knight.x) - Ly.homeX) > 1) towerWalk(Ly.homeX, 90, dt);
          else knight.facing = 1;
        });
        castleMove(0, Ly);                                   // fightTick 이 덮은 걷기 표시를 다시
        if (S.phase !== 'castle' || !S.castle.run) break;
        // 사거리 안에 몬스터가 없을 때(웨이브 사이)만 초당 5% 회복
        if (!alive.some((m) => aheadDist(knight.x, m.x) <= reachTo(m) + 4)) S.hp = Math.min(st.maxHp, S.hp + st.maxHp * CASTLE_REGEN * dt);
      }
      castleSupport(dt, Ly);
      castleBurnTick(dt);
      castleProjTick(dt);
      if (cdv.oilCd > 0) cdv.oilCd -= dt;
      break;
    }
    case 'end':
      cdv.t += dt;
      castleProjTick(dt);
      if (cdv.t >= cdv.hold) { cdv.sub = 'home'; cdv.t = 0; }
      break;
    case 'home':
      cdv.t += dt;
      if (!knight.warp) warpKnight('out');
      if (knight.warp && knight.warp.dir === 'out' && knight.warp.t >= WARP_SEC) {
        const res = cdv.res;
        clearTowerFx();
        monsters = [];
        endCastleView();
        S.phase = 'camp';
        Object.assign(knight, { x: toWorld(CAMP_X), facing: 1, down: 0, fighting: false });
        warpKnight('in');
        hooks.onCastleEnd(res);
        save();
      }
      break;
  }
}

// ───────── 그리기 ─────────
const cR = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
// 바닥: 적 스테이지 필드의 원경·지면 + 해자 + 성벽 (성벽은 화면 왼쪽 끝 — 2차 개편에서 성 안 풍경은 뺐다)
function drawCastleGround() {
  const run = S.castle.run || (cdv && cdv.res), L = run ? run.lv : castleNextLv();
  const z = zoneOf(castleStage(L)), gr = z.ground, gy = groundY(), Ly = castleLayout();
  drawZoneBg(gr.deco, gy);
  cR(0, gy, W, 3, gr.line); cR(0, gy + 3, W, H - gy - 3, gr.soil);
  for (let x = Ly.gateX + 4; x < W; x += 14) cR(x + ((x * 7) % 5), gy - 2 - ((x * 13) % 3) * 2, 2, 2 + ((x * 13) % 3) * 2, gr.grass);
  // 해자: 성벽 앞 물길
  if (castleUp('moat')) {
    const mw = 10 + castleUp('moat') * 2;
    cR(Ly.gateX, gy, mw, 8, '#2a5a8a'); cR(Ly.gateX, gy, mw, 2, '#5ea8e0');
    for (let x = Ly.gateX + ((clock * 8) % 6); x < Ly.gateX + mw; x += 6) cR(x, gy + 3, 2, 1, '#9fd8ff');
  }
  drawCastleWall(Ly);
}
// 성벽: 2px 도트 돌벽 + 흉벽(톱니) + 성문. 내구도 70%·40%·15% 에서 금이 하나씩 늘어난다
function drawCastleWall(Ly) {
  const gy = groundY(), x0 = Ly.wallX, top = Ly.top, run = S.castle.run;
  const hp = run ? run.wallHp / run.wallMax : cdv && cdv.res ? (cdv.res.reason === 'broken' ? 0 : 1) : 1;
  const jit = cdv && cdv.wallHit > 0 ? Math.round(rand(-1, 1)) : 0;
  const fallen = cdv && cdv.res && cdv.res.reason === 'broken' ? Math.min(1, cdv.t / 1.2) : 0;
  ctx.save();
  ctx.translate(jit, Math.round(fallen * 18));
  cR(x0, top, CW_W, CW_H, '#5d5668');
  // 돌 블록 줄눈 (2px 도트)
  for (let y = top + 2, row = 0; y < gy; y += 10, row++) {
    cR(x0, y, CW_W, 2, '#4a4454');
    for (let x = x0 + (row % 2 ? 6 : 14); x < x0 + CW_W; x += 16) cR(x, y + 2, 2, 8, '#4a4454');
    for (let x = x0 + (row % 2 ? 8 : 0); x < x0 + CW_W - 4; x += 16) cR(x + 2, y + 2, 4, 2, '#6e6779');
  }
  // 흉벽 톱니
  for (let x = x0; x < x0 + CW_W; x += 12) { cR(x, top - 8, 8, 8, '#6e6779'); cR(x, top - 8, 8, 2, '#857d90'); }
  cR(x0, top - 2, CW_W, 2, '#857d90');
  // 성문: 아치 + 쇠창살
  const gx = x0 + CW_W - 22, gw = 18, gh = 34;
  cR(gx - 2, gy - gh - 2, gw + 4, gh + 2, '#3a3444');
  cR(gx, gy - gh, gw, gh, '#1a1620');
  cR(gx + 2, gy - gh - 4, gw - 4, 4, '#1a1620');
  for (let x = gx + 2; x < gx + gw; x += 4) cR(x, gy - gh, 2, gh, '#4a4040');
  for (let y = gy - gh + 6; y < gy; y += 8) cR(gx, y, gw, 2, '#4a4040');
  // 균열
  const cracks = hp < 0.15 ? 3 : hp < 0.4 ? 2 : hp < 0.7 ? 1 : 0;
  for (let k = 0; k < cracks; k++) {
    const cx = x0 + 8 + k * 14;
    for (let i = 0; i < 6; i++) cR(cx + ((i * 5 + k * 3) % 5) - 2, top + 6 + i * 6, 2, 6, '#26222e');
  }
  ctx.restore();
  // 내구도 바: 성벽 윗단 바로 아래 벽면 (윗단은 궁수·교관 자리라 가린다. 숫자는 하단바 위 상태 칩)
  if (run) drawHpBar(x0 + CW_W / 2 - 6, top + 4, CW_W - 24, hp, hp < 0.3 ? '#ff5a5a' : '#ffd257');
  // 성공 깃발: 성벽 위로 올라간다
  if (cdv && cdv.flag) {
    const k = Math.min(1, cdv.flag / 0.8), fx = x0 + 6, fy = top - 8 - 30 * k;
    cR(fx, fy, 2, top - 8 - fy + 2, '#d8d0c0');
    cR(fx + 2, fy, 14, 9, '#c84a4a'); cR(fx + 2, fy + 3, 14, 2, '#ffd257');
  }
}
// 성벽 위 지원군과 투사체, 쓰러짐 카운트다운 (기사·몬스터 앞에)
function drawCastleFx() {
  if (!castleInside()) return;
  const Ly = castleLayout(), gy = groundY(), slots = castleSlots(Ly);
  // 궁수: 작은 도트 (초록 망토·활)
  slots.archers.forEach((a, i) => {
    const pull = cdv.archI === i && cdv.arch > 1 / slots.archers.length - 0.15 ? 1 : 0;
    cR(a.x - 2, a.y - 12, 5, 10, '#3d6b3a'); cR(a.x - 2, a.y - 15, 5, 4, '#f0c8a0'); cR(a.x - 2, a.y - 16, 5, 2, '#5a3a20');
    cR(a.x + 3 - pull, a.y - 13, 1, 9, '#8a5a2b'); cR(a.x + 2 - pull, a.y - 9, 1, 1, '#d8d0c0');
  });
  // 투석기: 나무 받침 + 팔 (던질 때 앞으로 젖혀진다)
  if (slots.cat) {
    const c = slots.cat, sw = cdv.catSwing ? Math.sin(Math.min(1, cdv.catSwing / 0.25) * Math.PI / 2) : 0;
    cR(c.x - 9, c.y - 6, 18, 4, '#6a4a2a'); cR(c.x - 8, c.y - 3, 4, 3, '#3a2a1a'); cR(c.x + 4, c.y - 3, 4, 3, '#3a2a1a');
    cR(c.x - 1, c.y - 14, 3, 9, '#7a5530');
    const a = -2.4 + sw * 1.9, L = 16;
    for (let i = 0; i <= L; i += 2) cR(c.x + Math.cos(a) * i, c.y - 14 + Math.sin(a) * i, 2, 2, '#8a6038');
    if (!sw && cdv.catT > 0.6) cR(c.x + Math.cos(a) * L - 2, c.y - 14 + Math.sin(a) * L - 2, 4, 4, '#8a8292');
  }
  // 🔥 가마솥: 성문 위 흉벽 끝. 쿨이 차면 김이 오르고, 쏟을 때 앞으로 기울며 기름 줄기가 성문 앞으로 떨어진다
  {
    const cx = Ly.gateX - 6, cy = Ly.top - 8, u = cdv.oil, tilt = u ? Math.sin(Math.min(1, u / 0.25) * Math.PI / 2) * (u < 0.7 ? 1 : Math.max(0, (1 - u) / 0.3)) : 0;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt * 0.9);
    cR(-7, -9, 14, 9, '#2a2630'); cR(-8, -10, 16, 2, '#4a4454'); cR(-6, -8, 12, 2, cdv.oilCd <= 0 ? '#ff9a3a' : '#7a4a2a');
    cR(-9, -7, 2, 3, '#4a4454'); cR(7, -7, 2, 3, '#4a4454');
    ctx.restore();
    cR(cx - 5, cy - 1, 2, 3, '#6a4a2a'); cR(cx + 3, cy - 1, 2, 3, '#6a4a2a');
    if (cdv.oilCd <= 0 && !u && Math.floor(clock * 6) % 2) cR(cx - 2 + Math.round(Math.sin(clock * 3) * 2), cy - 14 - ((clock * 10) % 6), 2, 2, 'rgba(230,230,240,0.6)');
    if (u > 0.15 && u < 0.55) for (let i = 0; i < 8; i++) {
      const k = (u - 0.15) / 0.4, y = cy + i * ((gy - cy) / 8) * Math.min(1, k * 1.6);
      cR(cx + 8 + i * 3 + rand(-1, 1), y, 4, (gy - cy) / 8, i % 2 ? '#ffcf4a' : '#ff7a2a');
    }
  }
  // 교관: 칸당 1px (28×32). 특기를 쓸 때 앞으로 기울고 번쩍
  for (const m of slots.mentors) {
    if (!m.vis) continue;
    const l = (cdv.ml && cdv.ml[m.id]) || 0;
    drawMentorFig(ctx, m.id, m.x, Ly.top, { cell: 1, lean: l * 0.35, flash: l > 0.45 });
  }
  // 투사체
  for (const p of cdv.proj) {
    if (p.kind === 'wave') {
      ctx.save(); ctx.globalAlpha = 0.85;
      for (let i = 0; i < 5; i++) cR(p.x - i * 5, p.y - 14 + i, 3, 28 - i * 2, i ? 'rgba(200,230,255,0.6)' : '#ffffff');
      ctx.restore(); continue;
    }
    if (p.t < 0 || p.tx == null) continue;
    const u = Math.min(1, p.t / p.dur);
    if (p.kind === 'star') {
      const x = p.tx + (1 - u) * 60, y = gy - 140 * (1 - u) - 10;
      cR(x - 3, y - 3, 6, 6, '#ffffff'); cR(x - 2, y - 6, 4, 2, '#d59fff');
      for (let i = 1; i < 6; i++) cR(x + i * 5, y - i * 11, 3, 3, `rgba(213,159,255,${0.8 - i * 0.14})`);
      continue;
    }
    const x = p.x0 + (p.tx - p.x0) * u, y = p.y0 + (p.ty - p.y0) * u - Math.sin(u * Math.PI) * p.arc;
    if (p.kind === 'arrow') { const a = Math.atan2(p.ty - p.y0 - Math.cos(u * Math.PI) * p.arc * Math.PI, p.tx - p.x0); for (let i = 0; i < (p.big ? 7 : 5); i++) cR(x - Math.cos(a) * i, y - Math.sin(a) * i, 1, 1, i ? '#c8a878' : '#ffffff'); }
    else if (p.kind === 'stone') { cR(x - 3, y - 3, 6, 6, '#6e6779'); cR(x - 2, y - 3, 3, 2, '#9a92a6'); }
    else if (p.kind === 'shield') { cR(x - 4, y - 5, 8, 10, '#4a78c8'); cR(x - 1, y - 5, 2, 10, '#ffd257'); }
    else if (p.kind === 'axe') { const r = u * 14; cR(x + Math.cos(r) * 4 - 1, y + Math.sin(r) * 4 - 1, 3, 3, '#c0c0c8'); cR(x - 1, y - 1, 3, 3, '#7a5530'); }
  }
  // 쓰러짐 카운트다운
  if (knight.down > 0 && S.castle.run) {
    ctx.font = 'bold 13px -apple-system, sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    const t = `💀 ${Math.ceil(knight.down)}`;
    strokeTextIco(ctx, t, Ly.homeX, gy - 64); ctx.fillStyle = '#ff9f9f'; fillTextIco(ctx, t, Ly.homeX, gy - 64);
  }
  // 성공 색종이
  if (cdv.flag && cdv.flag < 1.6 && Math.random() < 0.5) parts.push({ x: rand(Ly.wallX, W), y: -4, vx: rand(-20, 20), vy: rand(20, 60), g: 60, size: 2 + Math.floor(Math.random() * 2), color: ['#ff5a5a', '#ffd257', '#9fffc0', '#5ee0ff', '#d59fff'][Math.floor(Math.random() * 5)], life: 1.6, t: 0 });
}
