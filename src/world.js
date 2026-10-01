'use strict';
// 하단바의 실시간 연출: 기사/몬스터 이동과 전투, 캠프, 이펙트.

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = 0;
const H = BAR_H;
let showGround = true;
let clock = 0;

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  makeGrass();
}

const groundY = () => H - 10;
const worldLen = () => W + 80;            // 화면 밖 좌우 40px 까지 이어진 원형 월드
const toScreen = (x) => x - 40;
const toWorld = (sx) => sx + 40;
const mod = (a, n) => ((a % n) + n) % n;
const rand = (a, b) => a + Math.random() * (b - a);
const aheadDist = (from, to) => mod(to - from, worldLen());

const knight = {
  x: toWorld(CAMP_X), swing: -1, atkTimer: 0, flash: 0, walkT: 0, facing: 1, fighting: false, down: 0,
  pending: false,          // 휘두르는 도중 타격/발사 시점을 기다리는 중
  cds: {},                 // 스킬별 남은 쿨타임 (src/skills.js)
  ward: null,              // 성역 보호막 { left, guard, tick, acc }
};
let monsters = [];
let shots = [];            // 화살·마력탄
let effects = [];          // 충격파, 전직 빛기둥, 몬스터 공격 이펙트
let parts = [];            // 도트 파편·흙먼지·불꽃
let shake = 0;             // 보스 타격 시 화면 흔들림 (남은 초)
let floaters = [];
let coins = [];
let banner = null;
let grass = [];
let decor = [];            // 필드별 땅 장식 (비석·갈대·바위 등)
let groundZone = -1;       // grass/decor 를 만든 필드

// 풀은 어느 필드에나 깔고, 필드마다 장식을 띄엄띄엄 세운다. 캠프(왼쪽 끝)엔 큰 장식을 두지 않는다
const DECOR_KINDS = {
  meadow: ['flower'], grave: ['tomb', 'cross', 'tomb'], swamp: ['reed', 'reed', 'puddle'],
  volcano: ['rock', 'ember', 'rock'], snow: ['drift', 'pine'], castle: ['spike', 'torch'],
};
function makeGrass() {
  groundZone = zoneIndex(S.stage);
  const kinds = DECOR_KINDS[ZONES[groundZone].ground.deco];
  grass = [];
  for (let x = 0; x < W; x += rand(6, 22)) grass.push({ x, h: Math.floor(rand(1, 4)), c: Math.random() < 0.15 });
  decor = [];
  for (let x = 130 + rand(0, 60); x < W - 10; x += rand(90, 190)) decor.push({ x: Math.round(x), kind: kinds[Math.floor(Math.random() * kinds.length)], r: Math.random() });
}

function addFloater(text, x, y, color, size = 12) {
  floaters.push({ text, x, y, color, size, t: 0 });
}
function showBanner(text, color = '#ffd257') { banner = { text, color, t: 0 }; }

// ───────────────────────── 몬스터 ─────────────────────────
function spriteOf(m) {
  const def = MONSTERS[m.type];
  const frames = SPR[def.spr || m.type];
  return frames[Math.floor(m.t * (def.fps || 3)) % frames.length];
}
const monsterScale = (m) => (m.boss ? PX * 2 : PX);
const monsterWidth = (m) => spriteOf(m)[0].length * monsterScale(m);
const reachTo = (m) => stats().range + monsterWidth(m) / 2;        // 기사 무기 사거리
const monsterReach = (m) => MELEE_REACH + monsterWidth(m) / 2;      // 몬스터 공격 사거리

// 스테이지 = 화면 한 바퀴. 바퀴가 시작되면 기사 앞에서 오른쪽 끝까지 몬스터 자리를 정해 두고, 보스 자리는 항상 우하단.
// 몬스터는 기사가 다가가면 하나씩 나타난다. 쓰러져 파밍 중(farm)이면 보스 없이 잡몹만.
let lapReady = false;                     // false 면 다음 프레임에 현재 위치부터 바퀴를 다시 짠다
let lapPlan = [];                         // 아직 나타나지 않은 몬스터 [{ type, boss, x }] (x 오름차순)
const bossX = () => toWorld(W - 60);
const SPAWN_AHEAD = 260;                  // 기사 앞 이 거리 안에 들어온 자리부터 몬스터가 나타남
const MAX_ALIVE = 2;

function makeMonster(type, boss, x) {
  const st = monsterStats(S.stage, boss);
  return { type, ...st, maxHp: st.hp, x, born: clock, atkTimer: rand(0.4, 1.0), flash: 0, kb: 0, hurt: 0, anim: null, dying: 0, t: Math.random() * 10 };
}

function layoutLap() {
  lapReady = true;
  monsters.forEach(m => { if (!m.dying) m.dying = 0.001; });
  const pool = monsterPool(S.stage);
  const from = knight.x + 110;
  // 보스 자리를 이미 지나쳤으면 이번 바퀴는 오른쪽 끝까지 걸어가서 다시 시작한다
  const boss = !S.run.farm && from < bossX();
  const end = boss ? bossX() - 90 : worldLen() - 30;
  const n = Math.max(0, Math.floor((end - from) / MOB_GAP) + 1);
  const gap = n ? (end - from) / n : 0;
  lapPlan = [];
  for (let i = 0; i < n; i++) {
    const x = from + gap * (i + 0.5) + rand(-0.2, 0.2) * gap;
    lapPlan.push({ type: pool[Math.floor(Math.random() * pool.length)], boss: false, x });
  }
  if (boss) lapPlan.push({ type: zoneOf(S.stage).boss, boss: true, x: bossX() });
  S.run.kills = 0; S.run.cleared = false;
  S.run.total = n + (boss ? 1 : 0);
}

// 계획된 자리에 기사가 가까워지면 몬스터를 하나씩 등장시킨다
function spawnAhead() {
  let alive = monsters.filter(m => !m.dying).length;
  while (lapPlan.length && alive < MAX_ALIVE && lapPlan[0].x - knight.x <= SPAWN_AHEAD) {
    const p = lapPlan.shift();
    monsters.push(makeMonster(p.type, p.boss, p.x));
    alive++;
    if (p.boss) {
      const field = S.stage === zoneOf(S.stage).to;
      showBanner(`${field ? 'FIELD BOSS' : 'BOSS'}! ${MONSTERS[p.type].name}`, field ? '#ff5a5a' : '#ff9f1c');
    }
  }
}

function endLap() {
  const prevBest = S.best;
  if (finishLap()) {
    const z = zoneOf(S.stage);
    if (S.stage === z.from) {
      showBanner(`${z.icon} ${z.name}`, '#7dffb0');
      if (S.best > prevBest) toast(`🗺️ 새 필드 개방 — ${z.icon} ${z.name}!`, 6000);
    } else {
      showBanner(`STAGE ${S.stage}`);
    }
    save();
  }
  else if (S.run.farm) showBanner('🔁 재도전 대기', '#9fb3c8');
  lapReady = false;
}

function monsterTop(m) {
  const fly = MONSTERS[m.type].fly;
  return groundY() - spriteOf(m).length * monsterScale(m) - (fly ? fly + 2 : 0);
}

// 끝없는 마지막 필드에선 20스테이지마다 몬스터 색을 바꿔 새로움을 준다
function monsterHue() {
  const last = ZONES[ZONES.length - 1];
  return S.stage >= last.from ? Math.floor((S.stage - last.from) / 20) * 67 % 360 : 0;
}

function monsterMidY(m) {
  return monsterTop(m) + (spriteOf(m).length * monsterScale(m)) / 2;
}

// mult: 연발 화살·스킬 등 피해 배율. o: 스킬 타격 { crit 치명 확정, kb 밀려나는 거리, color 숫자 색 }
function hitMonster(m, mult = 1, o = {}) {
  const st = stats();
  const crit = o.crit || Math.random() < st.crit;
  const dmg = st.atk * mult * (crit ? st.critMult : 1) * rand(0.9, 1.1);
  m.hp -= dmg;
  m.flash = 0.08;
  m.hurt = 1;
  const kb = o.kb != null ? o.kb : heroWeapon().motion === 'sweep' ? 10 : 5;
  m.kb = m.boss ? Math.min(kb, 4) : Math.max(m.kb, kb);
  if (st.heal) S.hp = Math.min(st.maxHp, S.hp + st.maxHp * st.heal);
  // quiet: 여러 번 나눠 때리는 스킬 — 숫자를 모아 두었다가 마지막 타격이나 처치 때 한 번에 띄운다
  m.skAcc = (m.skAcc || 0) + dmg;
  m.skCrit = m.skCrit || crit;
  if (!o.quiet || m.hp <= 0) {
    const total = m.skAcc, anyCrit = m.skCrit, size = (anyCrit ? 14 : 12) + (o.color ? 2 : 0) + (o.quiet != null && total > dmg * 1.5 ? 2 : 0);
    m.skAcc = 0; m.skCrit = false;
    addFloater((anyCrit ? '💥' : '') + fmt(total), toScreen(m.x) + rand(-6, 6), monsterTop(m) - 4 - (o.color ? rand(0, 10) : 0), anyCrit ? '#ffb13b' : o.color || '#ffffff', size);
  }
  if (m.hp > 0) return;

  m.dying = 0.001;
  m.killed = true;
  shatter(m);
  const r = rewardKill(m);
  const sx = toScreen(m.x);
  for (let i = 0; i < (m.boss ? 10 : 3); i++) {
    coins.push({ x: sx, y: groundY() - 14, vx: rand(-60, 60), vy: rand(-160, -90), t: 0, fly: false });
  }
  // 상자 이름만 띄운다 (내용물은 캠프에서 열 때 공개). 보물상자 이상은 크게 알린다
  if (r.loot) {
    const G = GRADES[r.loot.g], big = r.loot.g >= 3;
    addFloater(`${big ? '✨' : '📦'} ${lootName(r.loot)}${big ? '!' : ''}`, sx, monsterTop(m) - 18, G.color, big ? 15 : 12);
    if (big && !m.boss) showBanner(`${lootName(r.loot)} 발견!`, G.color);
  }
  if (m.boss) { showBanner('STAGE CLEAR!'); save(); }
  if (bagFull()) endExpedition('bag');
}

// ───────────────────────── 업데이트 ─────────────────────────
// 타격 시점에 사거리 안의 적을 때리거나(근접: targets 마리까지) 화살을 쏜다(원거리: shots 발을 나눠서)
function releaseAttack(st) {
  const inRange = monsters
    .filter(m => !m.dying && aheadDist(knight.x, m.x) <= reachTo(m) + 2)
    .sort((a, b) => aheadDist(knight.x, a.x) - aheadDist(knight.x, b.x));
  if (!inRange.length) return;
  if (st.kind === 'ranged') {
    const w = heroWeapon();
    const n = Math.min(inRange.length, st.targets);
    const hx = toScreen(knight.x) + 5 * PX, hy = groundY() - 6 * PX;
    for (let i = 0; i < st.shots; i++) {
      shots.push({ w, m: inRange[i % n], mult: st.shotMult, x: hx, y: hy + (i - (st.shots - 1) / 2) * 3, a: 0, trail: [], delay: i * 0.06 });
    }
  } else {
    inRange.slice(0, st.targets).forEach(m => hitMonster(m));
  }
}

function updateExpedition(dt, gdt) {
  const st = stats();

  S.stamina -= STAMINA_DRAIN * gdt;
  S.trip.dur += gdt;
  if (S.stamina <= 0) { S.stamina = 0; endExpedition('stamina'); return; }

  // 쓰러져 있는 동안은 아무것도 하지 않는다
  if (knight.down > 0) {
    knight.down -= dt;
    if (knight.down <= 0) {
      addFloater('다시 일어섰다!', toScreen(knight.x), groundY() - 62, '#ffffff', 11);
      lapReady = false;
    }
    return;
  }

  if (!lapReady) layoutLap();
  spawnAhead();

  const alive = monsters.filter(m => !m.dying)
    .sort((a, b) => aheadDist(knight.x, a.x) - aheadDist(knight.x, b.x));
  const target = alive[0] || null;
  const best = target ? aheadDist(knight.x, target.x) : Infinity;

  // 기사의 사거리에 들어온 몬스터는 기사에게 달려든다. 원거리 직업은 그동안 먼저 때린다.
  let prev = 0;
  for (const m of alive) {
    const d = aheadDist(knight.x, m.x);
    if (d <= reachTo(m) + 4) m.engaged = true;
    const stop = Math.max(monsterReach(m), prev + 16);
    m.moving = m.engaged && d > stop && !m.anim;
    if (m.engaged && d > stop) m.x -= Math.min(MONSTER_SPEED * dt, d - stop);
    prev = aheadDist(knight.x, m.x);
  }

  // 휘두르는 모션의 타격 시점(근접 35%, 활 45%)에 실제로 때리거나 쏜다
  if (knight.pending && (knight.swing < 0 || knight.swing >= (st.kind === 'ranged' ? 0.45 : 0.35))) {
    knight.pending = false;
    releaseAttack(st);
  }

  knight.facing = 1;
  tickSkills(dt, st);                     // 스킬 쿨타임은 원정 내내 흐르고, 준비되면 다음 교전에서 바로 쓴다
  if (castOf('hero')) {
    // 스킬을 쓰는 동안은 평타도 이동도 멈춘다 (피해는 src/skills.js 가 타격 시점에 넣는다)
  } else if (target && best <= reachTo(target)) {
    if (!knight.fighting) { knight.fighting = true; knight.crisis = false; }
    knight.atkTimer -= dt;
    if (!knight.pending && tryCastSkill(st, target)) {
      // 스킬부터
    } else if (knight.atkTimer <= 0 && !knight.pending) {
      knight.atkTimer = 1 / st.aspd;
      knight.swing = 0;
      knight.pending = true;
    }
  } else {
    knight.fighting = false;
    knight.x += WALK_SPEED * dt;
    if (knight.x >= worldLen()) { knight.x -= worldLen(); endLap(); }
    knight.walkT += dt;
    knight.atkTimer = Math.min(knight.atkTimer, 0.25);
    S.hp = Math.min(st.maxHp, S.hp + st.maxHp * 0.06 * dt);
  }

  // 공격은 예비동작 → 타격 → 복귀 모션으로 재생하고, 피해는 타격 프레임에 들어간다
  for (const m of monsters) {
    if (m.dying || S.phase !== 'expedition') continue;
    if (m.anim && advanceMonsterAttack(m, dt, st)) break;   // true = 기사가 쓰러짐
    if (aheadDist(knight.x, m.x) > monsterReach(m) + 1) continue;
    m.atkTimer -= dt;
    if (m.atkTimer > 0 || m.anim) continue;
    const cd = MONSTERS[m.type].atkCd || 1.4;
    m.atkTimer = cd;
    const mo = ATK_MOTION[MONSTERS[m.type].style] || ATK_MOTION.swing;
    m.anim = { t: 0, dur: Math.min(mo.dur, cd * 0.85), hit: false };
  }
}

function advanceMonsterAttack(m, dt, st) {
  const a = m.anim, mo = monsterMotion(m);
  a.t += dt;
  if (a.t >= a.dur) m.anim = null;
  if (a.hit || a.t < a.dur * mo.hitAt) return false;
  a.hit = true;
  // 공중에 있거나 그새 사거리 밖이면 빗나감
  if (heroAirborne() || aheadDist(knight.x, m.x) > monsterReach(m) + 1) return false;
  strikeFx(m);
  const dmg = m.atk * rand(0.9, 1.1) * (1 - st.guard) * (knight.ward ? 1 - knight.ward.guard : 1);
  S.hp -= dmg;
  knight.flash = 0.08;
  knight.recoil = 1;
  addFloater('-' + fmt(dmg), toScreen(knight.x) + rand(-4, 4), groundY() - 52, '#ff6b6b', 11);
  if (S.hp > 0 && tryPotion()) addFloater('🧪 +HP', toScreen(knight.x), groundY() - 66, '#7dffb0', 12);
  if (S.hp > 0 && S.hp < st.maxHp * 0.25 && !knight.crisis) { knight.crisis = true; S.trip.crises++; }
  if (S.hp > 0) return false;
  addFloater(`💀 스태미나 -${DEFEAT_STAMINA}`, toScreen(knight.x), groundY() - 50, '#ff9f9f', 12);
  knightDefeated(!!m.boss);
  knight.down = DEFEAT_DOWN_SEC;
  knight.fighting = false;
  knight.pending = false;
  endCast('hero');
  knight.ward = null;
  shots = [];
  monsters.forEach(o => { if (!o.dying) o.dying = 0.001; });
  if (S.stamina <= 0) endExpedition('stamina');
  return true;
}

function updateReturning(dt) {
  const sx = toScreen(knight.x);
  const diff = CAMP_X - sx;
  const speed = RETURN_SPEED;
  if (Math.abs(diff) <= speed * dt) {
    knight.x = toWorld(CAMP_X);
    knight.facing = 1;
    arriveCamp();
    save();
    return;
  }
  knight.facing = Math.sign(diff);
  knight.x += knight.facing * speed * dt;
  knight.walkT += dt;
}

function update(dt) {
  // 큰 타격 순간엔 화면 전체를 아주 잠깐 멈춘다 (히트스톱)
  if (hitstop > 0) { hitstop -= dt; return; }
  clock += dt;
  const gdt = dt * TIME_SCALE;
  advanceBuild(gdt);

  knight.flash = Math.max(0, knight.flash - dt);
  knight.recoil = Math.max(0, (knight.recoil || 0) - dt * 6);
  shake = Math.max(0, shake - dt);
  if (knight.swing >= 0) {
    // 공속이 아주 빠르면 모션도 빨라진다
    knight.swing += dt * Math.max(5, stats().aspd * 1.3);
    if (knight.swing >= 1) knight.swing = -1;
  }

  if (S.phase === 'expedition') updateExpedition(dt, gdt);
  else if (S.phase === 'returning') updateReturning(dt);
  else advanceCamp(gdt);
  if (duelPlay) updateDuel();
  if (raidPlay) updateRaid(dt);
  updateCasts(dt);

  for (const m of monsters) {
    m.t += dt;
    m.flash = Math.max(0, m.flash - dt);
    m.kb = Math.max(0, m.kb - dt * 40);
    m.hurt = Math.max(0, m.hurt - dt * 4);
    if (m.air != null && (m.air += dt) > 0.6) m.air = null;   // 스킬에 띄워진 시간
    if (m.dying) m.dying += dt;
  }
  monsters = monsters.filter(m => !m.dying || m.dying < 0.5);

  for (const sh of shots) {
    if (sh.delay > 0) { sh.delay -= dt; continue; }
    if (sh.m.dying || S.phase !== 'expedition') { sh.done = true; continue; }
    const tx = toScreen(sh.m.x), ty = monsterMidY(sh.m);
    const dx = tx - sh.x, dy = ty - sh.y, dist = Math.hypot(dx, dy);
    const step = sh.w.arrow.speed * dt;
    sh.trail.push([sh.x, sh.y]);
    if (sh.trail.length > 8) sh.trail.shift();
    if (dist <= step) { hitMonster(sh.m, sh.mult); sh.done = true; continue; }
    sh.x += (dx / dist) * step; sh.y += (dy / dist) * step;
    sh.a = Math.atan2(dy, dx);
  }
  shots = shots.filter(sh => !sh.done);
  for (const e of effects) e.t += dt;
  effects = effects.filter(e => e.t < (e.life || (e.type === 'pillar' ? 2.4 : 0.6)));

  for (const p of parts) {
    p.t += dt;
    p.vy += p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    const floor = groundY() - p.size / 2;
    if (p.y > floor) { p.y = floor; p.vy *= -0.35; p.vx *= 0.6; }
  }
  parts = parts.filter(p => p.t < p.life);

  for (const f of floaters) { f.t += dt; f.y -= 22 * dt; }
  floaters = floaters.filter(f => f.t < 1.1);

  const goldEl = document.getElementById('gold').getBoundingClientRect();
  const layer = document.getElementById('barLayer').getBoundingClientRect();
  const gx = goldEl.left + goldEl.width / 2 - layer.left, gy = goldEl.top + goldEl.height / 2 - layer.top;
  for (const c of coins) {
    c.t += dt;
    if (!c.fly) {
      c.vy += 420 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.y > groundY() - 4) { c.y = groundY() - 4; c.vy *= -0.4; c.vx *= 0.6; }
      if (c.t > 0.6) { c.fly = true; c.sx = c.x; c.sy = c.y; c.ft = 0; }
    } else {
      c.ft += dt * 1.8;
      const e = c.ft * c.ft;
      c.x = c.sx + (gx - c.sx) * e;
      c.y = c.sy + (gy - c.sy) * e - Math.sin(c.ft * Math.PI) * 30;
    }
  }
  coins = coins.filter(c => !c.fly || c.ft < 1);

  if (banner) { banner.t += dt; if (banner.t > 2.2) banner = null; }
}

// 원정이 끝나면 남은 몬스터는 사라지고 기사는 돌아선다
hooks.onExpeditionEnd = (reason) => {
  monsters.forEach(m => { if (!m.dying) m.dying = 0.001; m.anim = null; });
  knight.fighting = false;
  knight.pending = false;
  endCast('hero');
  knight.ward = null;
  shots = [];
  const label = { stamina: '지쳤다… 귀환!', bag: '가방 가득! 귀환!', manual: '귀환!' }[reason];
  addFloater(label, toScreen(knight.x), groundY() - 70, '#ffd257', 12);
};
hooks.onClassChange = (id) => {
  const c = CLASSES[id];
  effects.push({ type: 'pillar', t: 0, color: c.look.fx });
  showBanner(`⚜️ 전직 — ${c.name}`, c.look.fx);
  addFloater(`${c.icon} ${c.name}`, toScreen(knight.x), groundY() - 70, c.look.fx, 13);
};
hooks.onLevelUp = () => addFloater('LEVEL UP!', toScreen(knight.x), groundY() - 62, '#7cc4ff', 13);

// ───────────────────────── 렌더 ─────────────────────────
// g: 그릴 캔버스 (기본은 하단바, 전직 미리보기는 자기 캔버스). 알파는 현재 값에 곱한다.
// sx·sy: 가로·세로 늘림(발밑 기준), skew: 높이 1px 당 가로로 밀리는 양 — 줄 단위로 밀어 도트가 계단처럼 기운다
function drawSprite(rows, pal, cx, bottomY, scale, { flip = false, flash = false, tint = null, alpha = 1, sx = 1, sy = 1, skew = 0 } = {}, g = ctx) {
  const h = rows.length, w = rows[0].length;
  const cw = scale * sx, chh = scale * sy;
  const ox = cx - (w * cw) / 2;
  const prevAlpha = g.globalAlpha;
  g.globalAlpha = prevAlpha * alpha;
  for (let r = 0; r < h; r++) {
    const row = rows[r];
    const y0 = Math.round(bottomY - (h - r) * chh), y1 = Math.round(bottomY - (h - r - 1) * chh);
    if (y1 <= y0) continue;
    const shift = skew ? Math.round(skew * (h - r - 0.5) * chh) : 0;
    for (let c = 0; c < w; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      const cc = flip ? w - 1 - c : c;
      const x0 = Math.round(ox + cc * cw) + shift, x1 = Math.round(ox + (cc + 1) * cw) + shift;
      g.fillStyle = flash ? '#ffffff' : tint || (pal[ch] || PAL[ch]);
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  g.globalAlpha = prevAlpha;
}

function drawGround() {
  if (!showGround) return;
  if (groundZone !== zoneIndex(S.stage)) makeGrass();
  const gr = ZONES[groundZone].ground;
  const gy = groundY();
  ctx.fillStyle = gr.line;
  ctx.fillRect(0, gy, W, 3);
  ctx.fillStyle = gr.soil;
  ctx.fillRect(0, gy + 3, W, H - gy - 3);
  for (const d of decor) drawDecor(d, gy);
  for (const g of grass) {
    ctx.fillStyle = g.c ? gr.accent : gr.grass;
    ctx.fillRect(g.x, gy - g.h * 2, 2, g.h * 2);
  }
}

// 필드 장식 한 개. d.r(0~1)로 크기·모양을 조금씩 다르게 한다
function drawDecor(d, gy) {
  const x = d.x, r = d.r;
  const box = (c, dx, dy, w, h) => { ctx.fillStyle = c; ctx.fillRect(x + dx, gy - dy, w, h); };
  switch (d.kind) {
    case 'flower':
      box('rgba(70, 140, 60, 0.9)', 0, 8, 2, 8);
      box(r < 0.5 ? '#ff8fb1' : '#fff3a0', -2, 12, 6, 4);
      box('#ffd257', 0, 11, 2, 2);
      break;
    case 'tomb': {
      const h = 14 + Math.round(r * 6);
      box('#6e7280', 0, h, 12, h);
      box('#8a8f9c', 2, h + 2, 8, 2);
      box('#4a4e5a', 5, h - 4, 2, 7);
      box('#4a4e5a', 3, h - 6, 6, 2);
      break;
    }
    case 'cross':
      box('#5e3818', 4, 18, 3, 18);
      box('#5e3818', 0, 14, 11, 3);
      break;
    case 'reed':
      for (let i = 0; i < 3; i++) {
        const h = 14 + ((r * 10 + i * 5) % 9);
        box('rgba(96, 140, 70, 0.95)', i * 4, h, 2, h);
        box('#8a5a2b', i * 4 - 1, h + 3, 4, 5);
      }
      break;
    case 'puddle':
      box('rgba(90, 120, 80, 0.8)', -6, -3, 26, 3);
      box('rgba(160, 200, 140, 0.5)', 0, -3, 6, 1);
      break;
    case 'rock':
      box('#3a2e2a', 0, 8, 16, 8);
      box('#5a4a42', 3, 11, 9, 3);
      box('#ff7a2a', 6, 4, 4, 1);
      break;
    case 'ember': {
      const f = Math.max(0, Math.sin(clock * 5 + r * 20));
      box('#ff5a1f', 0, 3, 8, 3);
      box('#ffb13b', 2, 5 + Math.round(f * 3), 2, 2);
      box('#ffe066', 5, 8 + Math.round(f * 5), 2, 2);
      break;
    }
    case 'drift':
      box('#f4f8ff', 0, 5, 20, 5);
      box('#f4f8ff', 4, 8, 10, 3);
      break;
    case 'pine': {
      const h = 22 + Math.round(r * 10);
      box('#5e3818', 5, 5, 3, 5);
      for (let i = 0; i < 3; i++) {
        const w = 13 - i * 4, y = 5 + (i + 1) * (h - 5) / 3;
        box('#2f5e4a', 6 - w / 2, y, w + 1, (h - 5) / 3 + 1);
        box('#f4f8ff', 6 - w / 2, y, w + 1, 2);
      }
      break;
    }
    case 'spike':
      for (let i = 0; i < 4; i++) {
        box('#2a2438', i * 5, 16, 2, 16);
        box('#6a6078', i * 5, 18, 2, 2);
      }
      box('#2a2438', 0, 10, 17, 2);
      break;
    case 'torch': {
      const f = Math.sin(clock * 9 + r * 10);
      box('#4a3a52', 0, 18, 4, 18);
      box('#ff5a1f', -1, 24, 6, 6);
      box('#ffd257', 0, 23 + Math.round(f), 4, 3);
      break;
    }
  }
}

function drawCamp() {
  const gy = groundY();
  drawSprite(SPR.tent, PAL, 26, gy, PX);

  const fx = CAMP_X + 28;
  const lit = S.phase === 'camp';
  if (lit) {
    const glow = ctx.createRadialGradient(fx, gy - 8, 2, fx, gy - 8, 46);
    glow.addColorStop(0, 'rgba(255,170,60,0.35)');
    glow.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(fx - 46, gy - 54, 92, 54);
  }
  ctx.fillStyle = '#6b4a2b'; ctx.fillRect(fx - 9, gy - 3, 18, 3);
  ctx.fillStyle = '#4a3220'; ctx.fillRect(fx - 6, gy - 6, 12, 3);
  const flames = lit ? [['#ff5a1f', 9], ['#ff9f1c', 6], ['#ffd257', 3]] : [['#8a8f99', 2]];
  for (const [color, base] of flames) {
    ctx.fillStyle = color;
    for (let i = -1; i <= 1; i++) {
      const h = base + Math.max(0, Math.sin(clock * 11 + i * 2.1) * 3 + Math.sin(clock * 7 + i) * 2);
      ctx.fillRect(fx + i * 3 - 1, gy - 6 - h, 3, h);
    }
  }
  // 앉을 통나무
  ctx.fillStyle = '#5e3818';
  ctx.fillRect(CAMP_X - 10, gy - 5, 16, 5);
}

function drawHpBar(cx, y, w, ratio, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(Math.round(cx - w / 2) - 1, y - 1, w + 2, 5);
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(cx - w / 2), y, Math.round(w * Math.max(0, ratio)), 3);
}

// ───────────────────────── 기사(직업별 외형) ─────────────────────────
// drawHero 는 하단바와 전직 미리보기 캔버스가 함께 쓴다. g = 그릴 캔버스 컨텍스트.
const heroPalCache = {};
function heroPal(id) {
  return heroPalCache[id] || (heroPalCache[id] = Object.assign({}, PAL, CLASSES[id].look.pal));
}

// 휘두르기 각도: 치켜들었다가(0~0.3) 앞으로 내려친다(0.3~1)
function swingAngle(s, wobble = 0) {
  if (s < 0) return -1.0 + wobble;
  return s < 0.3 ? -1.2 - (s / 0.3) * 1.0 : -2.2 + ((s - 0.3) / 0.7) * 3.0;
}

function drawBlade(g, w, hx, hy, angle, len = w.len) {
  g.save();
  g.translate(hx, hy);
  g.rotate(angle);
  g.fillStyle = '#4a3220'; g.fillRect(-PX * 2, -PX / 2, PX * 2, PX);        // 손잡이
  g.fillStyle = w.hilt; g.fillRect(0, -PX * 1.5, PX, PX * 3);                // 가드
  g.fillStyle = w.blade; g.fillRect(PX, -PX / 2, PX * len, PX);             // 칼날
  g.fillStyle = '#ffffff'; g.fillRect(PX * (len + 1), -PX / 2, PX, PX / 2 + 0.5);
  g.restore();
}

// 창·할버드: 손 뒤로도 자루가 조금 나온다
function drawPole(g, w, hx, hy, angle) {
  const L = w.len * PX;
  g.save();
  g.translate(hx, hy);
  g.rotate(angle);
  g.fillStyle = w.shaft; g.fillRect(-PX * 4, -1, L + PX * 4, 2);
  g.fillStyle = w.tip;
  if (w.motion === 'sweep') {
    // 도끼날 + 끝 창날 + 뒤쪽 갈고리
    g.fillRect(L - PX * 3, -PX * 4, PX * 2, PX * 4);
    g.fillRect(L - PX * 4, -PX * 3, PX, PX * 2);
    g.beginPath(); g.moveTo(L, -PX); g.lineTo(L + PX * 3, 0); g.lineTo(L, PX); g.fill();
    g.fillRect(L - PX * 2, 1, PX, PX);
  } else {
    g.beginPath(); g.moveTo(L, -PX * 1.2); g.lineTo(L + PX * 3.5, 0); g.lineTo(L, PX * 1.2); g.fill();
    g.fillStyle = w.glow || '#b0b6c2'; g.fillRect(L - PX, -PX, PX, PX * 2);   // 창날 받침
  }
  g.restore();
}

function drawBow(g, w, hx, hy, pull) {
  const r = w.size;
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = w.wood; g.lineWidth = 3;
  g.beginPath(); g.moveTo(hx, hy - r); g.quadraticCurveTo(hx + r * 0.75, hy, hx, hy + r); g.stroke();
  g.strokeStyle = w.glow || 'rgba(255,255,255,0.85)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(hx, hy - r); g.lineTo(hx - pull, hy); g.lineTo(hx, hy + r); g.stroke();
  if (pull > 0) {
    g.fillStyle = w.arrow.color;
    g.fillRect(hx - pull, hy - 0.75, 18, 1.5);
    g.beginPath(); g.moveTo(hx - pull + 18, hy - 2.5); g.lineTo(hx - pull + 22, hy); g.lineTo(hx - pull + 18, hy + 2.5); g.fill();
  }
  g.restore();
}

function drawArcTrail(g, w, hx, hy, s, r, from, to, width = 2) {
  if (s < 0.3 || s > 0.8) return;
  g.strokeStyle = `rgba(${w.trail},${0.7 * (1 - s)})`;
  g.lineWidth = width;
  g.beginPath();
  g.arc(hx, hy, r, from, to);
  g.stroke();
}

// 스킬 자세(src/skills.js)는 pose.wa(무기 각도)·ext(창 내밀기)·pull(시위)·bowA(활 기울기)로 무기를 직접 정한다
function drawSkillWeapon(g, w, hx, hy, pose) {
  if (w.kind === 'ranged') {
    g.save();
    g.translate(hx + PX, hy); g.rotate(pose.bowA || 0); g.translate(-(hx + PX), -hy);
    drawBow(g, w, hx + PX, hy, pose.pull || 0);
    g.restore();
  } else if (w.motion === 'thrust' || w.motion === 'sweep') {
    const ext = pose.ext || 0;
    drawPole(g, w, hx + Math.cos(pose.wa) * ext, hy + Math.sin(pose.wa) * ext, pose.wa);
  } else {
    if (w.motion === 'dual') drawBlade(g, w, hx - 3 * PX, hy + PX, pose.wa2 != null ? pose.wa2 : pose.wa + 0.5, w.len - 1);
    drawBlade(g, w, hx, hy, pose.wa);
  }
}

function drawWeapon(g, w, x, bodyBottom, pose) {
  const s = pose.swing;
  const hx = x + 4 * PX + Math.round((pose.skew || 0) * 3 * PX), hy = bodyBottom - 3 * PX;
  const wob = pose.mode === 'walk' ? Math.sin((pose.walkT || 0) * 8) * 0.08 : 0;
  g.save();
  if (w.glow) { g.shadowColor = w.glow; g.shadowBlur = 8; }

  if (pose.wa != null || (w.kind === 'ranged' && pose.pull != null)) {
    drawSkillWeapon(g, w, hx, hy, pose);
  } else if (w.kind === 'ranged') {
    const pull = s >= 0 && s < 0.45 ? (s / 0.45) * 8 : 0;
    drawBow(g, w, hx + PX, hy, pull);
  } else if (w.motion === 'swing') {
    drawBlade(g, w, hx, hy, swingAngle(s, wob));
    drawArcTrail(g, w, hx, hy, s, PX * (w.len + 1), -1.9, swingAngle(s));
  } else if (w.motion === 'dual') {
    // 뒷손 칼은 반 박자 늦게 따라온다
    const s2 = s >= 0 ? (s + 0.45) % 1 : -1;
    drawBlade(g, w, hx - 3 * PX, hy + PX, s2 >= 0 ? swingAngle(s2) : -0.6 + wob, w.len - 1);
    drawBlade(g, w, hx, hy, swingAngle(s, wob));
    drawArcTrail(g, w, hx, hy, s, PX * (w.len + 1), -1.9, swingAngle(s));
    drawArcTrail(g, w, hx - 3 * PX, hy + PX, s2, PX * w.len, -1.9, swingAngle(s2));
  } else if (w.motion === 'thrust') {
    const angle = s < 0 ? -1.3 + wob : -1.3 + Math.min(1, s / 0.25) * 1.22;
    const ext = s < 0 ? 0 : s < 0.3 ? -5 * (s / 0.3) : 16 * Math.sin((Math.PI * (s - 0.3)) / 0.7);
    drawPole(g, w, hx + ext, hy, angle);
    if (s >= 0.3 && s < 0.65) {
      const tipX = hx + ext + w.len * PX + 10;
      g.strokeStyle = `rgba(${w.trail},${(0.8 * (0.65 - s)) / 0.35})`;
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(tipX - 26, hy - 2); g.lineTo(tipX + 6, hy - 2); g.stroke();
    }
  } else if (w.motion === 'sweep') {
    const angle = s < 0 ? -1.35 + wob : s < 0.3 ? -1.35 - (s / 0.3) * 1.2 : -2.55 + ((s - 0.3) / 0.7) * 3.2;
    drawPole(g, w, hx, hy, angle);
    drawArcTrail(g, w, hx, hy, s, PX * (w.len + 2), -2.3, angle, 3);
  }
  g.restore();
}

// 캠프에서 쉬는 동안 무기는 옆에 세워 둔다
function drawRestingWeapon(g, w, x, gy) {
  if (w.kind === 'ranged') { drawBow(g, w, x - 2, gy - w.size - 1, 0); return; }
  if (w.motion === 'thrust' || w.motion === 'sweep') { drawPole(g, w, x, gy - 2, -Math.PI / 2); return; }
  drawBlade(g, w, x, gy - (w.len + 3) * PX, Math.PI / 2);
  if (w.motion === 'dual') drawBlade(g, w, x - 5, gy - (w.len + 2) * PX, Math.PI / 2 + 0.15, w.len - 1);
}

function drawCape(g, cape, x, top, bottom, ground, t, moving) {
  const wave = Math.sin(t * (moving ? 9 : 3)) * (moving ? 3 : 1.5);
  const shoulderY = top + 7 * PX;
  g.fillStyle = cape.color;
  if (cape.style === 'scarf') {
    for (let i = 0; i < 7; i++) {
      g.fillRect(x - 2 * PX - i * 4, shoulderY - 3 + Math.sin(t * 8 - i * 0.9) * (1 + i * 0.5), 5, 3);
    }
    return;
  }
  const hemY = cape.style === 'cloak' ? ground - 2 : bottom + 2 * PX;
  g.beginPath();
  g.moveTo(x - 2 * PX, shoulderY);
  g.lineTo(x + PX, shoulderY);
  g.lineTo(x - PX, hemY);
  g.lineTo(x - 5 * PX - wave, hemY - 2);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.22)';                                          // 주름
  g.fillRect(x - 3 * PX, shoulderY + PX, 2, hemY - shoulderY - PX * 2);
}

function drawShield(g, sh, cx, cy) {
  g.fillStyle = sh.rim;
  g.fillRect(cx - 2 * PX, cy - 3 * PX, 4 * PX, 5 * PX);
  g.beginPath(); g.moveTo(cx - 2 * PX, cy + 2 * PX); g.lineTo(cx, cy + 4 * PX); g.lineTo(cx + 2 * PX, cy + 2 * PX); g.fill();
  g.fillStyle = sh.face;
  g.fillRect(cx - 2 * PX + 2, cy - 3 * PX + 2, 4 * PX - 4, 5 * PX - 2);
  g.fillStyle = sh.emblem;
  g.fillRect(cx - 1, cy - 2 * PX, 2, 4 * PX);
  g.fillRect(cx - PX, cy - PX, 2 * PX, 2);
}

function drawHalo(g, x, top, t) {
  g.save();
  g.strokeStyle = '#ffd257';
  g.shadowColor = '#ffd257'; g.shadowBlur = 8;
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(x, top - 4 + Math.sin(t * 2) * 1.5, 8, 2.5, 0, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

// pose: { mode: walk|fight|sit, walkT, swing, facing, flash, alpha, t, lift }
function drawHero(g, id, x, gy, pose) {
  const c = CLASSES[id] || CLASSES.squire;
  const look = c.look, w = WEAPONS[c.weapon], pal = heroPal(c === CLASSES[id] ? id : 'squire');
  const t = pose.t || 0;
  const sit = pose.mode === 'sit', walking = pose.mode === 'walk';
  const step = Math.floor((pose.walkT || 0) * 8) % 2;
  const opt = { flash: !!pose.flash, tint: pose.tint || null };
  g.save();
  g.globalAlpha *= pose.alpha == null ? 1 : pose.alpha;
  if (pose.facing < 0) { g.translate(x, 0); g.scale(-1, 1); g.translate(-x, 0); }
  x += Math.round(pose.dx || 0);          // 스킬 돌진 (바라보는 쪽으로)

  if (sit) {
    drawRestingWeapon(g, w, x - 17, gy);
    const bodyBottom = gy - 2 * PX - (Math.floor(t * 1.2) % 2);
    const top = bodyBottom - look.body.length * PX;
    if (look.cape) drawCape(g, look.cape, x, top, bodyBottom, gy, t, false);
    drawSprite(SPR.knightSit, pal, x + 2, gy - PX, PX, opt, g);
    drawSprite(look.body, pal, x, bodyBottom, PX, opt, g);
    if (look.shield) drawShield(g, look.shield, x - 4 * PX, bodyBottom - 4 * PX);
    if (look.halo) drawHalo(g, x, top, t);
  } else {
    // 스킬 자세: sy 웅크림·늘어남, sx 가로 늘림, skew 앞(+)/뒤(-)로 기울임 — 몸통만 기운다
    const sy = pose.sy || 1, sx = pose.sx || 1;
    const base = gy - (pose.lift || 0);
    const legs = SPR.knightLegs[walking ? step : 0];
    const bodyBottom = base - legs.length * PX * sy - (walking ? step : 0);
    const top = bodyBottom - look.body.length * PX * sy;
    if (look.cape) drawCape(g, look.cape, x, top, bodyBottom, base, t, walking || pose.mode === 'fight' || pose.wa != null);
    drawSprite(legs, pal, x, base, PX, { ...opt, sx, sy }, g);
    drawSprite(look.body, pal, x, bodyBottom, PX, { ...opt, sx, sy, skew: pose.skew || 0 }, g);
    if (look.shield) drawShield(g, look.shield, x - 4 * PX, bodyBottom - 4 * PX);
    if (look.halo) drawHalo(g, x, top, t);
    if (!pose.tint) drawWeapon(g, w, x, bodyBottom, pose);      // 한 색 잔상은 몸만 남긴다
  }
  g.restore();
}

function drawKnight() {
  const x = toScreen(knight.x) - Math.round((knight.recoil || 0) * 3);
  const gy = groundY();
  const sp = castPose('hero');
  const lift = sp ? sp.lift || 0 : 0;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  const shadowW = Math.max(6, 28 - lift * 0.3);
  ctx.fillRect(x + (sp ? sp.dx || 0 : 0) - shadowW / 2, gy - 1, shadowW, 2);

  const pose = {
    mode: S.phase === 'camp' ? 'sit' : knight.fighting ? 'fight' : 'walk',
    walkT: knight.walkT, swing: knight.swing, facing: knight.facing, t: clock,
    flash: knight.flash > 0,
    alpha: knight.down > 0 ? 0.35 + 0.25 * Math.sin(clock * 12) : 1,
  };
  if (sp) Object.assign(pose, sp, { alpha: pose.alpha * (sp.alpha == null ? 1 : sp.alpha) });
  drawHero(ctx, S.cls, x, gy, pose);
  if (S.phase !== 'camp') {
    drawHpBar(x, gy - 58 - Math.min(lift, 40), 30, S.hp / stats().maxHp, '#ff5a5a');
    drawSkillIcons(x - 15, gy - 58 - Math.min(lift, 40) - 12);
  }
}

function drawShots() {
  for (const sh of shots) {
    if (sh.delay > 0) continue;
    const a = sh.w.arrow;
    if (a.magic) {
      sh.trail.forEach(([tx, ty], i) => {
        ctx.fillStyle = `rgba(111,243,255,${((i + 1) / sh.trail.length) * 0.5})`;
        ctx.fillRect(tx - 1.5, ty - 1.5, 3, 3);
      });
      ctx.save();
      ctx.shadowColor = a.color; ctx.shadowBlur = 10;
      ctx.fillStyle = a.color; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(sh.x, sh.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(sh.x, sh.y, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }
    if (a.trail && sh.trail.length > 1) {
      ctx.strokeStyle = `rgba(${a.trail},0.45)`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sh.trail[0][0], sh.trail[0][1]); ctx.lineTo(sh.x, sh.y); ctx.stroke();
    }
    ctx.save();
    ctx.translate(sh.x, sh.y); ctx.rotate(sh.a);
    ctx.fillStyle = a.color; ctx.fillRect(-12, -0.75, 13, 1.5);
    ctx.beginPath(); ctx.moveTo(1, -2.5); ctx.lineTo(5, 0); ctx.lineTo(1, 2.5); ctx.fill();
    ctx.fillStyle = '#d0463c'; ctx.fillRect(-13, -2, 3, 1); ctx.fillRect(-13, 1, 3, 1);   // 깃
    ctx.restore();
  }
}

function drawEffects() {
  for (const e of effects) {
    if (e.type === 'ring') {
      const k = Math.max(0, e.t / (e.life || 0.6));      // 음수 반지름이면 캔버스가 예외를 던져 화면이 멈춘다
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = e.color; ctx.lineWidth = 3;
      const sz = e.size || 1;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, (10 + k * 70) * sz, (4 + k * 10) * sz, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    } else if (e.type === 'slash') {
      // 몬스터 쪽에서 기사 앞을 위→아래로 긋는 초승달 베기 (도트로 찍는다)
      const k = e.t / e.life;
      const head = Math.min(1, k * 2.5), tail = Math.max(0, k * 2.5 - 0.7);
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - k) * 2);
      ctx.fillStyle = '#ffffff';
      for (let u = tail; u <= head; u += 0.04) {
        const ang = -2.1 - u * 2.1, sz = 1 + Math.round(3 * Math.sin(Math.PI * u));
        ctx.fillRect(Math.round(e.x + Math.cos(ang) * 18) - 1, Math.round(e.y + Math.sin(ang) * 18) - 1, sz, sz);
      }
      ctx.restore();
    } else if (e.type === 'bite') {
      // 위아래 이빨이 맞물린다
      const k = e.t / e.life;
      const gap = 2 + 12 * (1 - smooth(Math.min(1, k / 0.4)));
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - k) * 2.5);
      ctx.fillStyle = '#ffffff';
      for (let i = -1; i <= 1; i++) {
        const tx = Math.round(e.x + i * 6);
        for (let j = 0; j < 3; j++) {
          ctx.fillRect(tx - 2 + j, Math.round(e.y - gap - 4 + j * 2), 5 - j * 2, 2);   // 윗니 ▼
          ctx.fillRect(tx - 2 + j, Math.round(e.y + gap + 2 - j * 2), 5 - j * 2, 2);   // 아랫니 ▲
        }
      }
      ctx.restore();
    } else if (e.type === 'pillar') {
      // 전직: 기사 위로 빛기둥이 내려오고 빛 조각이 솟아오른다
      const x = toScreen(knight.x);
      const a = e.t < 0.3 ? e.t / 0.3 : Math.max(0, 1 - (e.t - 0.3) / 2.1);
      ctx.save();
      const grad = ctx.createLinearGradient(x - 18, 0, x + 18, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, e.color);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = a * 0.7;
      ctx.fillStyle = grad;
      ctx.fillRect(x - 18, 0, 36, groundY());
      ctx.globalAlpha = a;
      ctx.fillStyle = e.color;
      for (let i = 0; i < 14; i++) {
        const px = x + Math.sin(i * 12.9898) * 20;
        const py = groundY() - ((e.t * 70 + i * 23) % groundY());
        ctx.fillRect(px, py, 2, 2);
      }
      ctx.restore();
    }
  }
}

// ───────────────────────── 몬스터 모션 ─────────────────────────
// 키프레임 [진행도, dx, dy, sx, sy, skew]. dx<0 은 기사 쪽, dy<0 은 위, skew>0 은 뒤로 젖힘. hitAt 에서 피해가 들어간다
const ATK_MOTION = {
  swing:  { dur: 0.6, hitAt: 0.5, keys: [[0, 0, 0, 1, 1, 0], [0.35, 4, 0, 0.94, 1.06, 0.3], [0.5, -7, 0, 1.12, 0.92, -0.45], [0.64, -6, 0, 1.05, 0.97, -0.35], [1, 0, 0, 1, 1, 0]] },
  pounce: { dur: 0.6, hitAt: 0.5, keys: [[0, 0, 0, 1, 1, 0], [0.35, 4, 0, 1.22, 0.74, 0.15], [0.5, -10, -6, 1.3, 0.8, -0.2], [0.62, -8, 0, 0.9, 1.1, 0], [1, 0, 0, 1, 1, 0]] },
  bounce: { dur: 0.65, hitAt: 0.55, keys: [[0, 0, 0, 1, 1, 0], [0.25, 0, 0, 1.25, 0.7, 0], [0.42, -6, -16, 0.85, 1.2, 0], [0.55, -9, 0, 1.3, 0.7, 0], [0.68, -8, 0, 0.95, 1.08, 0], [0.82, -4, -6, 1, 1, 0], [1, 0, 0, 1, 1, 0]] },
  slam:   { dur: 0.8, hitAt: 0.6, keys: [[0, 0, 0, 1, 1, 0], [0.4, 3, 0, 0.9, 1.2, 0.2], [0.5, 3, -1, 0.88, 1.24, 0.22], [0.6, -6, 0, 1.25, 0.78, -0.3], [0.75, -5, 0, 1.1, 0.9, -0.15], [1, 0, 0, 1, 1, 0]] },
  dive:   { dur: 0.7, hitAt: 0.55, keys: [[0, 0, 0, 1, 1, 0], [0.35, 5, -12, 1, 1, 0.25], [0.55, -14, 14, 1.15, 0.9, -0.4], [0.7, -10, 8, 1, 1, -0.2], [1, 0, 0, 1, 1, 0]] },
  cast:   { dur: 0.8, hitAt: 0.72, release: 0.55, keys: [[0, 0, 0, 1, 1, 0], [0.5, 4, -2, 0.92, 1.12, 0.2], [0.58, -3, 0, 1.1, 0.92, -0.15], [0.72, -1, 0, 1.02, 0.98, -0.05], [1, 0, 0, 1, 1, 0]] },
};
const monsterMotion = (m) => ATK_MOTION[MONSTERS[m.type].style] || ATK_MOTION.swing;
const smooth = (u) => u * u * (3 - 2 * u);

function monsterPose(m) {
  const def = MONSTERS[m.type];
  const pose = { dx: 0, dy: 0, sx: 1, sy: 1, skew: 0 };
  if (m.anim) {
    const mo = monsterMotion(m), keys = mo.keys;
    const p = Math.min(1, m.anim.t / m.anim.dur);
    let i = 0;
    while (i < keys.length - 2 && p > keys[i + 1][0]) i++;
    const a = keys[i], b = keys[i + 1];
    const u = Math.min(1, Math.max(0, (p - a[0]) / (b[0] - a[0])));
    const e = b[0] === mo.hitAt ? u * u * u : smooth(u);     // 타격 직전 구간은 확 가속
    const k = m.boss ? 1.5 : 1;
    pose.dx = (a[1] + (b[1] - a[1]) * e) * k;
    pose.dy = (a[2] + (b[2] - a[2]) * e) * k;
    pose.sx = a[3] + (b[3] - a[3]) * e;
    pose.sy = a[4] + (b[4] - a[4]) * e;
    pose.skew = a[5] + (b[5] - a[5]) * e;
  } else if (m.moving) {
    pose.dy = -Math.abs(Math.sin(m.t * 12)) * 3;            // 통통 뛰며 다가온다
    pose.skew = -0.08;
  } else if (!def.fly) {
    const br = Math.sin(m.t * 3.5);                           // 숨쉬기
    pose.sy = 1 + br * 0.04; pose.sx = 1 - br * 0.02;
  }
  if (m.air != null) pose.dy -= Math.sin(Math.PI * Math.min(1, m.air / 0.6)) * (m.boss ? 12 : 34);   // 공중에 띄워졌다 떨어진다
  if (m.hurt) {                                               // 맞으면 찌그러지며 뒤로 젖혀진다
    const h = m.hurt * m.hurt;
    pose.sx *= 1 + 0.14 * h; pose.sy *= 1 - 0.14 * h; pose.skew += 0.3 * h;
  }
  const age = clock - m.born;
  if (age < 0.4 && !m.dying) {                                // 등장: 땅에서 튀어나오거나 위에서 내려온다
    const k = age / 0.4;
    if (def.fly) pose.dy -= (1 - k) * (1 - k) * 24;
    else {
      const c1 = 1.70158, back = 1 + (c1 + 1) * (k - 1) ** 3 + c1 * (k - 1) ** 2;
      pose.sy *= back; pose.sx *= 1 + (1 - k) * 0.3;
    }
  }
  return pose;
}

// 처치하면 스프라이트가 도트 조각으로 부서져 튄다
function shatter(m) {
  const rows = spriteOf(m), def = MONSTERS[m.type], pal = def.pal || {};
  const s = monsterScale(m), w = rows[0].length, h = rows.length;
  const cx = toScreen(m.x) + m.kb;
  const bottom = groundY() - (def.fly ? def.fly + Math.sin(m.t * 4) * 4 : 0);
  const hue = monsterHue();
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ch = rows[r][c];
      if (ch === '.') continue;
      parts.push({
        x: cx + (c - w / 2 + 0.5) * s, y: bottom - (h - r - 0.5) * s,
        vx: rand(10, 80) + (c - w / 2) * 10, vy: rand(-150, -40) - (h - r) * 5,
        g: 520, size: s, color: pal[ch] || PAL[ch], life: rand(0.5, 0.9), t: 0, hue,
      });
    }
  }
}

function burst(x, y, n, colors, speed = 90, size = 2, g = 300) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), v = rand(0.4, 1) * speed;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, g, size, color: colors[i % colors.length], life: rand(0.25, 0.45), t: 0 });
  }
}

// 기사가 맞는 순간의 이펙트 (공격 모션별)
function strikeFx(m) {
  const def = MONSTERS[m.type];
  const kx = toScreen(knight.x), gy = groundY(), ky = gy - 24;
  const style = def.style;
  if (style === 'swing') effects.push({ type: 'slash', x: kx + 16, y: ky - 2, t: 0, life: 0.25 });
  else if (style === 'pounce') effects.push({ type: 'bite', x: kx + 8, y: ky + 2, t: 0, life: 0.35 });
  else if (style === 'cast') burst(kx + 8, ky, 12, [def.orb, '#ffffff'], 110, 2, 120);
  else if (style === 'dive') burst(kx + 8, ky - 6, 8, ['#ffffff', '#ffd257'], 100, 2, 200);
  if (style === 'slam' || style === 'bounce') {
    effects.push({ type: 'ring', x: kx + 14, y: gy, t: 0, life: 0.4, size: m.boss ? 0.6 : 0.35, color: 'rgba(214,196,150,0.9)' });
    for (const dir of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        parts.push({ x: kx + 14 + rand(-6, 6), y: gy - 2, vx: dir * rand(30, 90), vy: rand(-70, -20), g: 200, size: 3, color: i % 2 ? '#c9b38a' : '#a8946a', life: rand(0.3, 0.5), t: 0 });
      }
    }
  }
  burst(kx + 6, ky, 5, ['#ffffff', '#ffe9a8'], 70);
  if (m.boss) shake = style === 'slam' || style === 'bounce' ? 0.3 : 0.18;
}

function drawMonster(m) {
  const def = MONSTERS[m.type];
  if (m.killed && m.dying > 0.07) return;                    // 하얗게 번쩍인 뒤엔 파편만 남는다
  const pose = monsterPose(m);
  const baseX = toScreen(m.x) + m.kb;
  const x = baseX + pose.dx;
  if (x < -60 || x > W + 60) return;
  const scale = monsterScale(m);
  const rows = spriteOf(m);
  const fly = def.fly ? def.fly + Math.sin(m.t * 4) * 4 : 0;
  const bottom = Math.min(groundY(), groundY() - fly + pose.dy);
  const fade = m.killed ? 1 : m.dying ? Math.max(0, 1 - m.dying * 2) : 1;
  const alpha = fade * Math.min(1, (clock - m.born) / 0.25);
  const hue = monsterHue();
  const w = rows[0].length * scale;

  // 그림자는 공중에 뜰수록 작아진다
  const air = Math.max(0, groundY() - bottom);
  const sw = Math.max(4, (w - 4) * pose.sx * (1 - Math.min(0.6, air / 60)));
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(Math.round(x - sw / 2), groundY() - 1, Math.round(sw), 2);

  if (hue) ctx.filter = `hue-rotate(${hue}deg)`;
  const opt = { flash: m.flash > 0, alpha: alpha * (def.alpha || 1), sx: pose.sx, sy: pose.sy, skew: pose.skew };
  if (m.killed) { opt.sx *= 1.15; opt.sy *= 0.9; }
  drawSprite(rows, def.pal || {}, x, bottom - (m.dying && !m.killed ? m.dying * 20 : 0), scale, opt);
  ctx.filter = 'none';
  if (m.killed) return;

  const h = rows.length * scale * pose.sy;
  const top = bottom - h;
  if (m.boss) drawSprite(SPR.crown, PAL, x + Math.round(pose.skew * h), top - 2, PX, { alpha });
  if (m.anim && def.style === 'cast') drawOrb(m, x - w / 2 * pose.sx, top + h * 0.45);
  if (!m.dying) {
    const baseTop = groundY() - fly - rows.length * scale;
    drawHpBar(baseX, baseTop - (m.boss ? 16 : 8), m.boss ? 50 : 24, m.hp / m.maxHp, m.boss ? '#ff9f1c' : '#ff5a5a');
  }
}

// 마법형: 손끝에 마력을 모았다가(차징) 기사에게 날린다
function drawOrb(m, mx, my) {
  const mo = monsterMotion(m), a = m.anim, color = MONSTERS[m.type].orb;
  const p = a.t / a.dur;
  const rel = mo.release * a.dur, hit = mo.hitAt * a.dur;
  if (p < 0.15 || a.t > hit) return;
  let x = mx - 3, y = my, r;
  if (a.t < rel) {
    r = 1 + Math.floor(((a.t / a.dur - 0.15) / (mo.release - 0.15)) * 3) + (Math.sin(clock * 40) > 0 ? 1 : 0);
  } else {
    const u = (a.t - rel) / (hit - rel);
    x = mx + (toScreen(knight.x) + 10 - mx) * u;
    y = my + (groundY() - 26 - my) * u - Math.sin(u * Math.PI) * 8;
    r = 3;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    for (let i = 1; i <= 3; i++) ctx.fillRect(Math.round(x + i * 5) - 1, Math.round(y) - 1, 2, 2);
    ctx.globalAlpha = 1;
  }
  if (m.boss) r += 2;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x - r), Math.round(y - r), r * 2, r * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(x - r / 2), Math.round(y - r / 2), Math.max(1, r), Math.max(1, r));
}

function drawParts() {
  let hue = 0;
  for (const p of parts) {
    if ((p.hue || 0) !== hue) { hue = p.hue || 0; ctx.filter = hue ? `hue-rotate(${hue}deg)` : 'none'; }
    ctx.globalAlpha = Math.min(1, (p.life - p.t) / 0.25);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
  }
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
}

function drawFx() {
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  for (const f of floaters) {
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, f.t - 0.6) / 0.5);
    ctx.font = `bold ${f.size}px -apple-system, sans-serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  for (const c of coins) {
    ctx.fillStyle = '#b8860b'; ctx.fillRect(Math.round(c.x) - 3, Math.round(c.y) - 3, 6, 6);
    ctx.fillStyle = '#ffd257'; ctx.fillRect(Math.round(c.x) - 2, Math.round(c.y) - 3, 4, 5);
  }

  if (banner) {
    const a = banner.t < 0.3 ? banner.t / 0.3 : banner.t > 1.8 ? (2.2 - banner.t) / 0.4 : 1;
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = 'bold 20px -apple-system, sans-serif';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    // 결투 중엔 두 기사 사이, 레이드 중엔 파티와 보스 사이
    const cx = duelPlay ? duelPlay.x0 + duelPlay.res.fight.start / 2 : raidPlay ? raidPlay.x0 + raidPlay.f.start * 0.55 : toScreen(knight.x) + 40;
    const bx = Math.min(W - 60, Math.max(60, cx)), by = groundY() - 78;
    ctx.strokeText(banner.text, bx, by);
    ctx.fillStyle = banner.color;
    ctx.fillText(banner.text, bx, by);
    ctx.globalAlpha = 1;
  }
}

// ───────────────────────── 결투 ─────────────────────────
// 서버가 계산한 결투 기록(fight.events)을 하단바에서 재생한다. 캠프에 있을 때만 벌어지고,
// 캠프의 기사가 일어나 오른쪽에서 걸어오는 상대와 싸운 뒤 다시 캠프에 앉는다.
// 결투 좌표(fight.start·moves.x)는 하단바 px 단위라 그대로 쓴다.
let duelPlay = null;          // { res, t0, speed, shown, last, hit, x0, doneAt, onEnd }
const DUEL_PLAY_SEC = 9;      // 긴 결투도 이 시간 안에 재생되도록 빨리 감는다
const DUEL_HOLD_SEC = 2.5;    // 결판이 난 뒤 결과를 보여 주는 시간
const DUEL_ENTER_SEC = 0.5;   // 상대가 나타나는 시간

const duelActive = () => !!duelPlay;
function playDuel(res, onEnd) {
  const f = res.fight;
  duelPlay = {
    res, onEnd, t0: clock, speed: Math.max(1, f.dur / DUEL_PLAY_SEC), shown: 0, last: {}, hit: {}, doneAt: null,
    x0: CAMP_X + 70,
  };
  showBanner(`⚔️ VS ${res.opponent.nickname}`, '#ff9f1c');
}
const duelTime = () => Math.min(duelPlay.res.fight.dur, Math.max(0, clock - duelPlay.t0 - DUEL_ENTER_SEC) * duelPlay.speed);

// 기사는 한 번 멈추면 다시 움직이지 않으므로 멈춘 시각·위치로 이동을 재현한다
function duelX(side, pt) {
  const f = duelPlay.res.fight, mv = f.moves[side];
  const walked = Math.min(pt, mv.t) * f.walk;
  return duelPlay.x0 + (side === 'a' ? Math.min(mv.x, walked) : Math.max(mv.x, f.start - walked));
}

function updateDuel() {
  const d = duelPlay, f = d.res.fight, pt = duelTime();
  while (d.shown < f.events.length && f.events[d.shown].t <= pt) {
    const e = f.events[d.shown++];
    const target = e.by === 'a' ? 'b' : 'a';
    if (e.kind === 'skill' && SKILLS[e.sk]) {
      // 스킬: 시전 모션을 재생하고, 피해 숫자는 마지막 타격 순간에 띄운다
      const who = e.by === 'a' ? d.res.me : d.res.opponent;
      startCast(`duel-${e.by}`, e.sk, {
        x: () => duelX(e.by, duelTime()), dir: e.by === 'a' ? 1 : -1, tx: () => duelX(target, duelTime()), ty: () => groundY() - 24,
        cls: who.cls,
        onHit: (i, n) => {
          d.hit[target] = clock;
          if (i === n - 1) addFloater((e.crit ? '💥' : '') + fmt(e.dmg), duelX(target, duelTime()) + rand(-8, 8), groundY() - 76, e.crit ? '#ffb13b' : CLASSES[who.cls].look.fx, 16);
        },
     }, true);
      continue;
    }
    d.last[e.by] = { e, at: clock };
    d.hit[target] = clock;
    const tx = duelX(target, pt);
    addFloater((e.crit ? '💥' : '') + fmt(e.dmg), tx + rand(-8, 8), groundY() - 76, e.crit ? '#ffb13b' : '#ffffff', e.crit || e.kind === 'leap' ? 14 : 12);
    if (e.kind === 'leap') {
      const who = e.by === 'a' ? d.res.me : d.res.opponent;
      effects.push({ type: 'ring', x: tx, y: groundY() - 2, t: 0, color: (CLASSES[who.cls] || CLASSES.squire).look.fx });
    }
  }
  if (pt >= f.dur && d.doneAt == null) {
    d.doneAt = clock;
    showBanner(d.res.won ? 'VICTORY!' : 'DEFEAT', d.res.won ? '#ffd257' : '#ff8080');
  }
  if (d.doneAt != null && clock - d.doneAt > DUEL_HOLD_SEC) endDuel();
}

function endDuel() {
  if (!duelPlay) return;
  endCasts('duel-');
  const d = duelPlay;
  duelPlay = null;
  if (d.onEnd) d.onEnd(d.res);
}
// 캠프 창을 여는 등 결투를 끝까지 보지 않을 때: 결과만 알리고 끝낸다
function skipDuel() {
  if (!duelPlay) return;
  if (duelPlay.doneAt == null) showBanner(duelPlay.res.won ? 'VICTORY!' : 'DEFEAT', duelPlay.res.won ? '#ffd257' : '#ff8080');
  endDuel();
}

function drawDuel() {
  const d = duelPlay, f = d.res.fight, pt = duelTime(), done = pt >= f.dur, gy = groundY();
  const lastEv = d.shown ? f.events[d.shown - 1] : null;
  const hp = { a: lastEv ? lastEv.hpA : f.maxA, b: lastEv ? lastEv.hpB : f.maxB };
  const max = { a: f.maxA, b: f.maxB };
  for (const side of ['a', 'b']) {
    const who = side === 'a' ? d.res.me : d.res.opponent;
    const c = CLASSES[who.cls] || CLASSES.squire;
    const x = duelX(side, pt), mv = f.moves[side], L = d.last[side];
    const since = L ? clock - L.at : Infinity;
    const loser = done && f.winner !== side;
    const sp = loser ? null : castPose(`duel-${side}`);
    const lift = sp ? sp.lift || 0 : L && L.e.kind === 'leap' && since < 0.35 ? (1 - since / 0.35) * 26 : 0;
    const alpha = side === 'b' ? Math.min(1, (clock - d.t0) / DUEL_ENTER_SEC) : 1;

    ctx.fillStyle = `rgba(0,0,0,${0.25 * alpha})`;
    ctx.fillRect(x - 14, gy - 1, 28, 2);
    const pose = {
      mode: loser ? 'sit' : pt < mv.t ? 'walk' : 'fight',
      walkT: pt, swing: !loser && since < 0.16 ? 0.35 + since * 4 : -1,
      facing: side === 'a' ? 1 : -1, t: clock, lift,
      flash: d.hit[side] != null && clock - d.hit[side] < 0.08,
      alpha: loser ? 0.45 : alpha,
    };
    if (sp) Object.assign(pose, sp, { alpha: alpha * (sp.alpha == null ? 1 : sp.alpha) });
    drawHero(ctx, who.cls, x, gy, pose);

    // 원거리 공격은 화살이 날아가는 모습만 짧게 보여 준다
    const w = WEAPONS[c.weapon];
    if (L && !sp && w.kind === 'ranged' && since < 0.14) {
      const dir = side === 'a' ? 1 : -1, ox = duelX(side === 'a' ? 'b' : 'a', pt);
      const x0 = x + dir * 16, x1 = ox - dir * 8, ax = x0 + (x1 - x0) * (since / 0.14);
      ctx.fillStyle = w.arrow.color;
      ctx.fillRect(Math.round(dir > 0 ? ax - 12 : ax), gy - 6 * PX, 12, 2);
    }

    // 이름표와 체력바
    const top = gy - 58 - lift;
    ctx.globalAlpha = alpha;
    drawHpBar(x, top, 34, hp[side] / max[side], side === 'a' ? '#5fcf5a' : '#ff5a5a');
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    const label = `${c.icon} ${who.nickname}`;
    ctx.strokeText(label, x, top - 5);
    ctx.fillStyle = side === 'a' ? '#f3efe6' : '#ffc9c9';
    ctx.fillText(label, x, top - 5);
    ctx.globalAlpha = 1;
  }
}

// ───────────────────────── 보스 레이드 ─────────────────────────
// 서버가 계산한 레이드 기록(res.fight.events)을 하단바에서 재생한다. 결투처럼 캠프에 있을 때만 벌어지고,
// 파티원들이 캠프에서 차례로 걸어 나가 오른쪽의 보스와 싸운 뒤 끝나면 정산 화면이 열린다.
// 기록의 좌표(start·stop.x)는 하단바 px 단위라 그대로 쓴다. 파티원 순서 = res.members 순서
// 보스마다 평타(def.hit)·광역기(def.aoe) 연출이 다르다 (RAID_HIT · RAID_AOE). 광역기는 터지기 전에 기를 모은다(RAID_WIND).
let raidPlay = null;          // { res, f, t0, speed, shown, x0, hpB, hpK, last, hitK, bossHit, act, dead, doneAt, onEnd, fx, wind, windIdx, dark }
const RAID_PLAY_SEC = 28;     // 긴 레이드도 이 시간 안에 재생되도록 빨리 감는다
const RAID_HOLD_SEC = 3;      // 결판이 난 뒤 결과를 보여 주는 시간
const RAID_ENTER_SEC = 0.8;   // 보스가 나타나는 시간
const RAID_WIND_SEC = 0.8;    // 광역기 전에 기를 모으는 시간(실제 초)
const RAID_BOSS_LEFT = 30;    // 보스 몸 왼쪽 끝 = 보스 위치 - 30 (server/raid.js 의 BOSS_HALF)

const raidActive = () => !!raidPlay;
function playRaid(res, onEnd) {
  const f = res.fight;
  raidPlay = {
    res, f, onEnd, t0: clock, speed: Math.max(1, f.dur / RAID_PLAY_SEC), shown: 0, x0: CAMP_X + 60,
    hpB: f.maxB, hpK: f.knights.map((k) => k.max), last: {}, hitK: {}, bossHit: -1, act: null, dead: {}, doneAt: null,
    fx: [], wind: 0, windIdx: -1, dark: 0,
  };
  showBanner(`⚔️ ${RAID_BOSSES[f.boss].name} 레이드!`, '#ff9f1c');
}
const raidTime = () => Math.min(raidPlay.f.dur, Math.max(0, clock - raidPlay.t0 - RAID_ENTER_SEC) * raidPlay.speed);
const raidBossX = () => raidPlay.x0 + raidPlay.f.start;
// 기사는 한 번 멈추면 다시 움직이지 않으므로 멈춘 시각·위치로 이동을 재현한다 (뒷사람은 gap 만큼 뒤에서 출발)
function raidKnightX(i, pt = raidTime()) {
  const f = raidPlay.f, k = f.knights[i];
  return raidPlay.x0 + Math.min(k.stop.x, -i * f.gap + Math.min(pt, k.stop.t) * f.walk);
}
const raidKnightY = () => groundY() - 22;

// 보스 도트 크기·위치. 왼쪽 끝을 보스 위치 - 30 에 맞추고 오른쪽으로 크게 그린다
function raidBossGeom() {
  const def = RAID_BOSSES[raidPlay.f.boss], rows = SPR[def.spr][0];
  const scale = Math.max(3, Math.min(7, Math.floor(100 / rows.length)));
  const w = rows[0].length * scale, h = rows.length * scale, left = raidBossX() - RAID_BOSS_LEFT;
  return { def, rows, scale, w, h, left, cx: left + w / 2 };
}
// 투사체·숨결이 나오는 곳 (보스 왼쪽 위 = 머리)
const raidMouth = (g) => ({ x: g.left + g.w * 0.1, y: groundY() - g.h * 0.62 });

// ── 연출 조각: { at: 시작 시각, life, draw(u), tick(u), end() } — u 는 0→1 진행 ──
function raidFx(delay, life, draw, end, tick) { raidPlay.fx.push({ at: clock + delay, life, draw, end, tick }); }
const raidLater = (delay, fn) => raidFx(delay, 0, null, fn);
const lerp = (a, b, u) => a + (b - a) * u;
function px(x, y, s, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
  ctx.globalAlpha = 1;
}

// 기사 i 가 맞는 순간: 체력 반영 + 숫자 + 파편
function raidStrike(i, dmg, hp, colors, big = false) {
  const d = raidPlay;
  if (hp != null) d.hpK[i] = hp;
  if (!dmg) return;
  const kx = raidKnightX(i);
  d.hitK[i] = clock;
  addFloater(fmt(dmg), kx + rand(-6, 6), groundY() - 62 - rand(0, 8), '#ff8080', big ? 14 : 12);
  burst(kx + 4, raidKnightY(), big ? 14 : 9, colors, big ? 130 : 90);
  shake = Math.max(shake, big ? 0.3 : 0.15);
}

// 투사체: 입에서 기사에게 포물선으로 날아간다. draw(x, y, u) 로 모양을 그린다
function raidShot(i, life, arc, drawShot, onHit) {
  const g = raidBossGeom(), m = raidMouth(g);
  raidFx(0, life, (u) => {
    const tx = raidKnightX(i) + 6, ty = raidKnightY();
    drawShot(lerp(m.x, tx, u), lerp(m.y, ty, u) - Math.sin(u * Math.PI) * arc, u);
  }, onHit);
}

// ── 평타 ──
const RAID_HIT = {
  // 슬라임 킹: 파티 앞까지 통통 뛰어가 덮친다
  leap: (e, def) => {
    raidPlay.act = { kind: 'leap', at: clock, dur: 0.55, tx: raidKnightX(e.tg) };
    raidLater(0.27, () => {
      raidStrike(e.tg, e.d, e.h[e.tg], def.fx.concat('#ffffff'), true);
      effects.push({ type: 'ring', x: raidKnightX(e.tg) + 10, y: groundY(), t: 0, life: 0.45, size: 0.8, color: def.fx[1] });
    });
  },
  // 고블린 족장: 빙글빙글 도는 도끼를 던진다
  axe: (e, def) => {
    raidPlay.act = { kind: 'throw', at: clock, dur: 0.3 };
    raidShot(e.tg, 0.32, 22, (x, y, u) => {
      ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(-u * 16);
      ctx.fillStyle = '#7a4a22'; ctx.fillRect(-1, -7, 3, 14);
      ctx.fillStyle = '#8c95a6'; ctx.fillRect(1, -8, 7, 6);
      ctx.fillStyle = '#eef1f6'; ctx.fillRect(7, -8, 2, 6);
      ctx.restore();
    }, () => raidStrike(e.tg, e.d, e.h[e.tg], ['#eef1f6', '#c9a227', '#ffffff']));
  },
  // 리치 킹: 초록 불꽃을 끄는 해골탄
  skull: (e, def) => {
    raidPlay.act = { kind: 'throw', at: clock, dur: 0.3 };
    raidShot(e.tg, 0.36, 10, (x, y, u) => {
      for (let k = 1; k <= 4; k++) px(x + k * 5, y + Math.sin(clock * 30 + k) * 2, 4 - k * 0.6, '#7dffb0', 0.6 - k * 0.12);
      ctx.fillStyle = '#7dffb0'; ctx.globalAlpha = 0.35; ctx.fillRect(Math.round(x) - 6, Math.round(y) - 6, 12, 12); ctx.globalAlpha = 1;
      ctx.fillStyle = '#e9e4d4'; ctx.fillRect(Math.round(x) - 4, Math.round(y) - 4, 8, 6); ctx.fillRect(Math.round(x) - 2, Math.round(y) + 2, 5, 2);
      ctx.fillStyle = '#0d0818'; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 2, 2, 2); ctx.fillRect(Math.round(x) + 1, Math.round(y) - 2, 2, 2);
    }, () => raidStrike(e.tg, e.d, e.h[e.tg], ['#7dffb0', '#e9e4d4', '#b38bff']));
  },
  // 늪의 군주: 몸을 날려 문다
  bite: (e, def) => {
    raidPlay.act = { kind: 'lunge', at: clock, dur: 0.4 };
    raidLater(0.16, () => {
      raidStrike(e.tg, e.d, e.h[e.tg], ['#ffffff', '#c9b3ff']);
      effects.push({ type: 'bite', x: raidKnightX(e.tg) + 8, y: raidKnightY() + 2, t: 0, life: 0.35 });
    });
  },
  // 화염룡: 불꽃 꼬리를 그리는 화염구
  fireball: (e, def) => {
    raidPlay.act = { kind: 'throw', at: clock, dur: 0.3 };
    raidShot(e.tg, 0.3, 6, (x, y) => {
      parts.push({ x: x + rand(2, 8), y: y + rand(-3, 3), vx: rand(20, 60), vy: rand(-30, -5), g: -40, size: 3, color: Math.random() < 0.5 ? '#ff7a1f' : '#ffe066', life: rand(0.15, 0.3), t: 0 });
      ctx.fillStyle = '#ff5a1f'; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd257'; ctx.beginPath(); ctx.arc(x - 1, y, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 1, 3, 3);
    }, () => {
      raidStrike(e.tg, e.d, e.h[e.tg], ['#ff7a1f', '#ffe066', '#ffffff'], true);
      effects.push({ type: 'ring', x: raidKnightX(e.tg) + 6, y: groundY(), t: 0, life: 0.4, size: 0.5, color: '#ff7a1f' });
    });
  },
  // 서리 거인: 얼음 바위를 높이 던진다
  boulder: (e, def) => {
    raidPlay.act = { kind: 'throw', at: clock, dur: 0.35 };
    raidShot(e.tg, 0.42, 46, (x, y, u) => {
      ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(u * 6);
      ctx.fillStyle = '#6a8cc8'; ctx.fillRect(-6, -6, 12, 12);
      ctx.fillStyle = '#9fe8ff'; ctx.fillRect(-6, -6, 9, 9);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-4, -4, 3, 3);
      ctx.restore();
    }, () => {
      raidStrike(e.tg, e.d, e.h[e.tg], ['#9fe8ff', '#ffffff', '#6a8cc8'], true);
      burst(raidKnightX(e.tg) + 6, groundY() - 6, 10, ['#e8f6ff', '#9fe8ff'], 120, 3, 300);
    });
  },
  // 마왕: 붉은 불티를 흩뿌리는 암흑 구체
  darkorb: (e, def) => {
    raidPlay.act = { kind: 'throw', at: clock, dur: 0.3 };
    raidShot(e.tg, 0.34, 14, (x, y) => {
      if (Math.random() < 0.6) parts.push({ x, y, vx: rand(-20, 40), vy: rand(-40, 10), g: 0, size: 2, color: '#ff3b4b', life: 0.25, t: 0 });
      const r = 7 + Math.sin(clock * 40) * 1.5;
      ctx.fillStyle = '#c06bff'; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#3a1a4a'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0a0410'; ctx.beginPath(); ctx.arc(x, y, r - 3, 0, Math.PI * 2); ctx.fill();
    }, () => raidStrike(e.tg, e.d, e.h[e.tg], ['#c06bff', '#ff3b4b', '#150a20'], true));
  },
};

// ── 광역기 (기를 다 모은 순간 = 기록의 시각에 터진다) ──
// 기사마다 맞는 순간을 늦춰 파도·회오리가 지나가는 것처럼 보이게 한다: delayOf(i) 초 뒤에 맞는다
function raidAoeHits(e, def, delayOf, colors, big = true) {
  e.d.forEach((dmg, i) => {
    if (!dmg && e.h[i] == null) return;
    raidLater(delayOf(i), () => raidStrike(i, dmg, e.h[i], colors, big));
  });
}
const byDist = (speed) => (i) => Math.max(0, (raidBossGeom().left - raidKnightX(i)) / speed);
// 공격받는 기사들 (쓰러진 기사는 빼고)
const raidAlive = () => raidPlay.res.members.map((_, i) => i).filter((i) => raidPlay.dead[i] == null);

const RAID_AOE = {
  // 왕의 점프: 높이 뛰었다가 내려찍어 충격파 + 점액 비
  quake: (e, def) => {
    raidPlay.act = { kind: 'land', at: clock, dur: 0.35 };
    shake = 0.5;
    const gy = groundY(), x0 = raidBossGeom().left;
    for (let k = 0; k < 3; k++) raidLater(k * 0.08, () => effects.push({ type: 'ring', x: x0 - 30 * k, y: gy, t: 0, life: 0.6, size: 1.6 - k * 0.3, color: def.fx[k % 2] }));
    for (let k = 0; k < 26; k++) parts.push({ x: rand(raidKnightX(raidPlay.res.members.length - 1) - 30, x0), y: rand(-10, 20), vx: rand(-10, 10), vy: rand(60, 140), g: 300, size: 3, color: def.fx[k % 2], life: rand(0.5, 0.8), t: 0 });
    raidAoeHits(e, def, byDist(500), def.fx.concat('#ffffff'));
  },
  // 약탈의 회오리: 먼지 회오리가 파티를 휩쓸고 지나간다
  whirl: (e, def) => {
    const g = raidBossGeom(), gy = groundY(), end = raidKnightX(raidPlay.res.members.length - 1) - 40;
    const x0 = g.left + 10, dur = Math.max(0.35, (x0 - end) / 420);
    raidFx(0, dur, (u) => {
      const x = lerp(x0, end, u);
      for (let k = 0; k < 9; k++) {
        const y = gy - 4 - k * 7, r = 6 + k * 2.2, off = Math.sin(clock * 30 + k) * (3 + k);
        ctx.globalAlpha = 0.75 * (1 - u * 0.4);
        ctx.strokeStyle = k % 2 ? def.fx[0] : def.fx[1]; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(x + off, y, r, 3, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (Math.random() < 0.5) parts.push({ x: x + rand(-12, 12), y: gy - rand(0, 50), vx: rand(-90, 90), vy: rand(-60, 0), g: 100, size: 2, color: '#c9b38a', life: 0.3, t: 0 });
    });
    raidAoeHits(e, def, (i) => Math.max(0, (x0 - raidKnightX(i)) / 420), ['#c9b38a', '#e8d9a8', '#ffffff']);
  },
  // 죽음의 파동: 초록 파도가 땅을 훑고, 기사 발밑에서 해골 손이 솟는다
  deathwave: (e, def) => {
    const g = raidBossGeom(), gy = groundY(), end = raidKnightX(raidPlay.res.members.length - 1) - 50;
    raidFx(0, 0.5, (u) => {
      const x = lerp(g.left, end, u);
      for (let k = 0; k < 14; k++) {
        const h = 4 + Math.abs(Math.sin(clock * 20 + k)) * 18 * (1 - u * 0.5);
        px(x + k * 6, gy - h / 2, 4, k % 3 ? '#7dffb0' : '#b38bff', 0.8 * (1 - k / 14));
        ctx.globalAlpha = 0.5 * (1 - k / 14); ctx.fillStyle = '#7dffb0'; ctx.fillRect(Math.round(x + k * 6) - 2, Math.round(gy - h), 4, Math.round(h)); ctx.globalAlpha = 1;
      }
    });
    for (const i of raidAlive()) {
      const delay = Math.max(0, (g.left - raidKnightX(i)) / 500);
      raidFx(delay, 0.6, (u) => {
        const x = raidKnightX(i), rise = Math.sin(Math.min(1, u * 1.6) * Math.PI / 2) * 22 * (1 - Math.max(0, u - 0.7) / 0.3);
        for (const side of [-1, 1]) {
          const hx = x + side * 9, top = gy - rise;
          ctx.fillStyle = '#e9e4d4';
          ctx.fillRect(Math.round(hx) - 1, Math.round(top), 3, Math.round(rise));             // 팔뼈
          ctx.fillRect(Math.round(hx) - 4, Math.round(top) - 2, 9, 3);                         // 손바닥
          for (let f = 0; f < 3; f++) ctx.fillRect(Math.round(hx) - 4 + f * 3, Math.round(top) - 6, 2, 4);   // 손가락
        }
      });
    }
    raidAoeHits(e, def, byDist(500), ['#7dffb0', '#b38bff', '#e9e4d4']);
  },
  // 독안개 포효: 보라 독안개가 굴러와 파티를 덮는다
  fog: (e, def) => {
    raidPlay.act = { kind: 'roar', at: clock, dur: 0.6 };
    const g = raidBossGeom(), gy = groundY(), end = raidKnightX(raidPlay.res.members.length - 1) - 60;
    const clouds = Array.from({ length: 10 }, (_, k) => ({ off: k * 16, y: rand(30, 70), r: rand(14, 24), ph: rand(0, 6) }));
    raidFx(0, 1.3, (u) => {
      const front = lerp(g.left, end, Math.min(1, u * 1.6));
      for (const c of clouds) {
        const x = front + c.off;
        if (x > g.left + 10) continue;
        const r = c.r * (1 + Math.sin(clock * 3 + c.ph) * 0.1);
        ctx.globalAlpha = 0.35 * (1 - Math.max(0, u - 0.7) / 0.3);
        ctx.fillStyle = c.off % 32 ? def.fx[0] : def.fx[1];
        ctx.beginPath(); ctx.arc(x, gy - c.y + 20, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (Math.random() < 0.4) parts.push({ x: rand(front, g.left), y: gy - 2, vx: 0, vy: rand(-50, -20), g: -20, size: 3, color: '#c9b3ff', life: 0.5, t: 0 });
    });
    raidAoeHits(e, def, (i) => Math.max(0, (g.left - raidKnightX(i)) / ((g.left - end) * 1.6 / 1.3)), ['#8a6fb8', '#c9b3ff', '#4b3a6b']);
  },
  // 화염 숨결: 입에서 불길을 뿜어 파티를 쓸고, 바닥에 불이 남는다
  breath: (e, def) => {
    raidPlay.act = { kind: 'breath', at: clock, dur: 0.8 };
    const g = raidBossGeom(), m = raidMouth(g), gy = groundY(), end = raidKnightX(raidPlay.res.members.length - 1) - 30;
    // 입에서 파티까지 뻗는 불꽃 원뿔 (끝으로 갈수록 넓고 흔들린다)
    raidFx(0, 0.8, (u) => {
      const reach = Math.min(1, u * 4), fade = 1 - Math.max(0, u - 0.7) / 0.3;
      const x1 = lerp(m.x, end, reach);
      for (const [spread, color, a] of [[26, '#ff5a1f', 0.55], [16, '#ff9f1c', 0.7], [7, '#ffe066', 0.85]]) {
        ctx.globalAlpha = a * fade;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y - 2);
        for (let k = 0; k <= 8; k++) {
          const x = lerp(m.x, x1, k / 8), w = (k / 8) * spread;
          ctx.lineTo(x, Math.min(gy, m.y + (raidKnightY() - m.y) * (k / 8) + w * 0.4) - w + Math.sin(clock * 40 + k) * 2);
        }
        for (let k = 8; k >= 0; k--) {
          const x = lerp(m.x, x1, k / 8), w = (k / 8) * spread;
          ctx.lineTo(x, Math.min(gy, m.y + (raidKnightY() - m.y) * (k / 8) + w * 0.4 + w) + Math.cos(clock * 40 + k) * 2);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }, null, () => {
      for (let k = 0; k < 6; k++) {
        const vx = -rand(260, 380), spread = rand(-0.25, 0.35);
        parts.push({ x: m.x, y: m.y, vx, vy: -vx * spread, g: -30, size: rand(3, 6), color: ['#ff5a1f', '#ff7a1f', '#ffd257', '#ffffff'][k % 4], life: rand(0.25, (m.x - end) / 300), t: 0 });
      }
    });
    for (const i of raidAlive()) {
      raidFx(0.25, 1.1, (u) => {
        const x = raidKnightX(i);
        for (let k = -2; k <= 2; k++) {
          const h = 6 + Math.abs(Math.sin(clock * 18 + k * 1.7)) * 12 * (1 - u);
          px(x + k * 6, gy - h / 2, 4, '#ff7a1f', 0.8 * (1 - u));
          px(x + k * 6, gy - h, 3, '#ffe066', 0.8 * (1 - u));
        }
      });
    }
    raidAoeHits(e, def, byDist(340), ['#ff7a1f', '#ffe066', '#ffffff']);
  },
  // 빙하 내려찍기: 땅을 내려치면 기사들 발밑에서 고드름이 차례로 솟는다
  icicles: (e, def) => {
    raidPlay.act = { kind: 'land', at: clock, dur: 0.3 };
    shake = 0.45;
    const g = raidBossGeom(), gy = groundY();
    burst(g.left + 10, gy - 4, 20, ['#e8f6ff', '#9fe8ff', '#ffffff'], 160, 3, 300);
    for (const i of raidAlive()) {
      const delay = Math.max(0, (g.left - raidKnightX(i)) / 600);
      raidFx(delay, 0.7, (u) => {
        const x = raidKnightX(i), grow = Math.min(1, u * 5) * (1 - Math.max(0, u - 0.75) / 0.25);
        for (const [dx, hh] of [[-10, 18], [-3, 30], [5, 24], [12, 14]]) {
          const h = hh * grow;
          ctx.fillStyle = '#9fe8ff';
          for (let r = 0; r < h; r += 2) {
            const half = Math.max(1, Math.round(4 * (1 - r / hh)));
            ctx.fillRect(Math.round(x + dx - half), Math.round(gy - r - 2), half * 2, 2);
          }
          ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x + dx - 1), Math.round(gy - h), 1, Math.round(h * 0.7));
        }
      });
    }
    raidAoeHits(e, def, byDist(600), ['#9fe8ff', '#ffffff', '#6a8cc8']);
  },
  // 멸망의 흑염: 하늘이 어두워지고 기사마다 검붉은 불기둥이 떨어진다
  hellfire: (e, def) => {
    raidPlay.act = { kind: 'roar', at: clock, dur: 0.5 };
    shake = 0.55;
    const gy = groundY();
    raidAlive().forEach((i, n) => {
      raidFx(n * 0.07, 0.75, (u) => {
        const x = raidKnightX(i), fall = Math.min(1, u * 4), w = 18 * (1 - Math.max(0, u - 0.5) / 0.5);
        const bottom = lerp(0, gy, fall);
        const grad = ctx.createLinearGradient(0, 0, 0, bottom);
        grad.addColorStop(0, 'rgba(21,10,32,0)'); grad.addColorStop(0.5, 'rgba(192,107,255,0.75)'); grad.addColorStop(1, 'rgba(255,59,75,0.95)');
        ctx.fillStyle = grad;
        ctx.fillRect(Math.round(x - w / 2), 0, Math.round(w), Math.round(bottom));
        ctx.fillStyle = '#150a20'; ctx.globalAlpha = 0.8;
        ctx.fillRect(Math.round(x - w / 6), 0, Math.round(w / 3), Math.round(bottom));
        ctx.globalAlpha = 1;
        if (fall >= 1 && Math.random() < 0.6) parts.push({ x: x + rand(-10, 10), y: gy - 2, vx: rand(-60, 60), vy: rand(-120, -40), g: 200, size: 3, color: Math.random() < 0.5 ? '#ff3b4b' : '#c06bff', life: 0.4, t: 0 });
      });
    });
    raidAoeHits(e, def, (i) => raidAlive().indexOf(i) * 0.07 + 0.19, ['#c06bff', '#ff3b4b', '#150a20']);
  },
};

function updateRaid(dt) {
  const d = raidPlay, f = d.f, pt = raidTime(), gy = groundY();
  const def = RAID_BOSSES[f.boss], g = raidBossGeom();
  while (d.shown < f.events.length && f.events[d.shown].t <= pt) {
    const e = f.events[d.shown++];
    if (e.k != null && e.s && SKILLS[e.s]) {
      // 스킬 타격: 시전 모션을 재생하고, 보스 체력·피해 숫자는 마지막 타격 순간에 반영한다
      const i = e.k, cls = d.res.members[i].cls;
      d.hpK[i] = e.h;
      startCast(`raid-${i}`, e.s, {
        x: () => raidKnightX(i), dir: 1, tx: () => raidBossGeom().left + 12, ty: () => groundY() - raidBossGeom().h * 0.5,
        cls,
        onHit: (j, n) => {
          d.bossHit = clock;
          if (j < n - 1) return;
          d.hpB = Math.min(d.hpB, e.bh);
          const gg = raidBossGeom();
          addFloater((e.c ? '💥' : '') + fmt(e.d), gg.left + rand(4, 40), gy - gg.h * 0.6 + rand(-10, 10), e.c ? '#ffb13b' : clsOf(cls).look.fx, 16);
        },
     }, true);
    } else if (e.k != null) {
      // 기사 타격 (짧은 시간 동안의 타격을 묶은 것)
      d.hpB = e.bh; d.hpK[e.k] = e.h;
      d.last[e.k] = { e, at: clock };
      if (e.c || e.l) d.bossHit = clock;      // 보스가 하얗게 번쩍이는 건 치명타·도약 때만 (타격은 0.2초마다 묶여 와서 매번 번쩍이면 정신없다)
      // 피해 숫자는 보스 몸 위쪽에 띄운다 (왼쪽 끝은 기사 이름표·체력바와 겹친다)
      addFloater((e.c ? '💥' : '') + fmt(e.d), g.cx + rand(-g.w * 0.25, g.w * 0.25), gy - g.h * 0.75 + rand(-8, 8), e.c ? '#ffb13b' : '#ffffff', e.c || e.l ? 14 : 12);
      if (e.l) effects.push({ type: 'ring', x: g.left + 10, y: gy - 2, t: 0, color: clsOf(d.res.members[e.k].cls).look.fx });
    } else if (e.b === 'hit') {
      RAID_HIT[def.hit](e, def);
    } else if (e.b === 'aoe') {
      RAID_AOE[def.aoe](e, def);
      d.windIdx = -1;
    } else if (e.die != null) {
      const i = e.die;
      raidLater(0.4, () => { d.dead[i] = clock; addFloater('💀 쓰러짐', raidKnightX(i), gy - 74, '#c9c9c9', 12); });
    }
  }

  // 다음 광역기가 가까우면 기를 모은다 (스킬 이름은 기를 모으기 시작할 때 한 번)
  d.wind = 0;
  for (let j = d.shown; j < f.events.length; j++) {
    const e = f.events[j], left = (e.t - pt) / d.speed;
    if (left > RAID_WIND_SEC) break;
    if (e.b !== 'aoe') continue;
    d.wind = 1 - left / RAID_WIND_SEC;
    if (d.windIdx !== j) {
      d.windIdx = j;
      showBanner(`${def.icon} ${def.skill}!`, def.fx[0]);
    }
    if (Math.random() < 0.7) {
      // 기가 보스에게 빨려 들어간다
      const a = rand(0, Math.PI * 2), r = rand(40, 70);
      parts.push({ x: g.cx + Math.cos(a) * r, y: gy - g.h / 2 + Math.sin(a) * r * 0.6, vx: -Math.cos(a) * r * 2.5, vy: -Math.sin(a) * r * 1.5, g: 0, size: 3, color: def.fx[Math.random() < 0.5 ? 0 : 1], life: 0.35, t: 0 });
    }
    break;
  }
  // 마왕이 기를 모으는 동안 하늘이 어두워진다
  const darkTo = def.aoe === 'hellfire' && d.wind > 0 ? 0.5 * d.wind : 0;
  d.dark += (darkTo - d.dark) * Math.min(1, dt * 6);

  for (const fx of d.fx) {
    if (clock < fx.at) continue;
    const u = fx.life ? Math.min(1, (clock - fx.at) / fx.life) : 1;
    if (fx.tick && u < 1) fx.tick(u);
    if (u >= 1) { fx.done = true; if (fx.end) fx.end(); }
  }
  d.fx = d.fx.filter((fx) => !fx.done);

  if (pt >= f.dur && d.doneAt == null) {
    d.doneAt = clock;
    showBanner(f.won ? '👑 RAID CLEAR!' : f.timeout ? '⏳ TIME OVER' : '💀 RAID FAILED', f.won ? '#ffd257' : '#ff8080');
    if (f.won) {
      burst(g.cx, gy - g.h / 2, 50, def.fx.concat('#ffd257', '#ffffff'), 180, 3, 250);
      for (let i = 0; i < 14; i++) coins.push({ x: g.cx, y: gy - 20, vx: rand(-90, 90), vy: rand(-200, -100), t: 0, fly: false });
    }
    addFloater('👑 MVP', raidKnightX(f.mvp, pt), gy - 88, '#ffd257', 14);
  }
  if (d.doneAt != null && clock - d.doneAt > RAID_HOLD_SEC) endRaid();
}

function endRaid() {
  if (!raidPlay) return;
  endCasts('raid-');
  const d = raidPlay;
  raidPlay = null;
  if (d.onEnd) d.onEnd(d.res);
}
// 캠프 창을 여는 등 끝까지 보지 않을 때
function skipRaid() {
  if (!raidPlay) return;
  if (raidPlay.doneAt == null) showBanner(raidPlay.f.won ? '👑 RAID CLEAR!' : '💀 RAID FAILED', raidPlay.f.won ? '#ffd257' : '#ff8080');
  endRaid();
}

// 보스 자세: 평타·광역기·기 모으기에 따라 움직임이 다르다
function raidBossPose(d, g) {
  const def = g.def, p = { dx: 0, lift: 0, sx: 1, sy: 1 + 0.025 * Math.sin(clock * 3), flip: false };
  const a = d.act, u = a ? (clock - a.at) / a.dur : 1;
  if (a && u < 1) {
    const s = Math.sin(u * Math.PI);
    if (a.kind === 'leap') { p.dx = -(g.left - a.tx - 24) * s; p.lift = 46 * s; if (u > 0.45 && u < 0.6) { p.sy = 0.8; p.sx = 1.15; } }
    else if (a.kind === 'lunge') { p.dx = -40 * s; p.sx = 1 + 0.1 * s; }
    else if (a.kind === 'throw') { p.dx = 6 * s; p.sy += 0.06 * s; }
    else if (a.kind === 'land') { p.sy = 1 - 0.25 * (1 - u); p.sx = 1 + 0.2 * (1 - u); }
    else if (a.kind === 'roar' || a.kind === 'breath') { p.dx = -6 * s; p.sy += 0.08 * s; }
  }
  const w = d.wind;
  if (w > 0) {
    if (def.aoe === 'quake') {
      if (w < 0.35) { p.sy = 1 - 0.25 * (w / 0.35); p.sx = 1 + 0.18 * (w / 0.35); }
      else p.lift = 90 * Math.sin(((w - 0.35) / 0.65) * Math.PI * 0.5 + Math.PI * 0.5 * Math.max(0, (w - 0.8) / 0.2));
    } else if (def.aoe === 'whirl') {
      p.flip = Math.floor(clock * 14) % 2 === 0;
    } else if (def.aoe === 'icicles') {
      p.lift = 18 * w; p.sy += 0.08 * w;
    } else {
      p.dx = 8 * w; p.sy += 0.08 * w;
    }
  }
  return p;
}

function drawRaid() {
  const d = raidPlay, f = d.f, pt = raidTime(), done = pt >= f.dur, gy = groundY();
  const g = raidBossGeom(), def = g.def;
  ctx.font = 'bold 11px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  const label = (text, x, y, color) => {
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  };
  if (d.dark > 0.01) { ctx.fillStyle = `rgba(12,4,20,${d.dark})`; ctx.fillRect(-10, -10, W + 20, H + 20); }

  // ── 보스 ──
  const enter = Math.min(1, (clock - d.t0) / RAID_ENTER_SEC);
  const dying = done && f.won ? Math.min(1, (clock - d.doneAt) / 1.2) : 0;
  const p = raidBossPose(d, g);
  const cx = g.cx + p.dx, bottom = gy - p.lift;
  ctx.fillStyle = `rgba(0,0,0,${0.3 * enter * (1 - Math.min(0.7, p.lift / 120))})`;
  ctx.fillRect(Math.round(cx - g.w / 2), gy - 2, g.w, 3);
  // 기를 모으는 동안 보스 주위가 빛난다
  if (d.wind > 0) {
    const r = g.h * (0.6 + 0.1 * Math.sin(clock * 20));
    const grad = ctx.createRadialGradient(cx, bottom - g.h / 2, 4, cx, bottom - g.h / 2, r);
    grad.addColorStop(0, def.fx[1]); grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55 * d.wind; ctx.fillStyle = grad;
    ctx.fillRect(cx - r, bottom - g.h / 2 - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }
  const bossOpt = { alpha: enter * (1 - dying), sx: p.sx, sy: p.sy * (1 - dying * 0.5), flip: p.flip };
  drawSprite(g.rows, def.pal, cx, bottom + dying * 30, g.scale, bossOpt);
  // 맞았을 때·기를 다 모았을 때는 반투명한 흰 빛만 덮는다 (큰 보스가 통째로 하얘지면 눈이 아프다)
  const glow = clock - d.bossHit < 0.08 ? 0.45 * (1 - (clock - d.bossHit) / 0.08) : d.wind > 0.9 && Math.floor(clock * 20) % 3 === 0 ? 0.35 : 0;
  if (glow > 0) drawSprite(g.rows, def.pal, cx, bottom + dying * 30, g.scale, { ...bossOpt, flash: true, alpha: bossOpt.alpha * glow });
  // 보스 체력바와 이름
  if (!done || !f.won) {
    ctx.globalAlpha = enter;
    const top = Math.max(14, gy - g.h - 12 - p.lift);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(Math.round(g.cx - 56), top - 1, 112, 7);
    ctx.fillStyle = '#ff9f1c';
    ctx.fillRect(Math.round(g.cx - 55), top, Math.round(110 * Math.max(0, d.hpB / f.maxB)), 5);
    label(`${def.icon} ${def.name}`, g.cx, top - 4, '#ffd257');
    ctx.globalAlpha = 1;
  }

  // ── 파티 ──
  d.res.members.forEach((m, i) => {
    const c = clsOf(m.cls), x = raidKnightX(i, pt), k = f.knights[i];
    const L = d.last[i], s = L ? clock - L.at : Infinity;
    const dead = d.dead[i] != null;
    const me = m.nickname === activeNick();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x - 14, gy - 1, 28, 2);
    const sp = dead ? null : castPose(`raid-${i}`);
    const pose = {
      mode: dead ? 'sit' : pt < k.stop.t ? 'walk' : 'fight',
      walkT: pt + i * 0.3, swing: !dead && s < 0.16 ? 0.35 + s * 4 : -1,
      facing: 1, t: clock, lift: L && L.e.l && s < 0.35 ? (1 - s / 0.35) * 26 : 0,
      flash: d.hitK[i] != null && clock - d.hitK[i] < 0.08,
      alpha: dead ? 0.4 : 1,
    };
    if (sp) Object.assign(pose, sp);
    drawHero(ctx, m.cls, x, gy, pose);
    const wpn = WEAPONS[c.weapon];
    if (!dead && !sp && L && wpn.kind === 'ranged' && s < 0.14) {
      const x0 = x + 16, x1 = g.left + 6, ax = x0 + (x1 - x0) * (s / 0.14);
      ctx.fillStyle = wpn.arrow.color;
      ctx.fillRect(Math.round(ax - 12), gy - 6 * PX, 12, 2);
    }
    // 이름표가 겹치지 않게 번갈아 높이를 다르게 한다
    const top = gy - 58 - (i % 2) * 14;
    drawHpBar(x, top, 26, d.hpK[i] / k.max, me ? '#5fcf5a' : '#7cc4ff');
    label(`${done && f.mvp === i ? '👑' : c.icon} ${m.nickname}`, x, top - 4, me ? '#ffd257' : '#f3efe6');
  });

  // ── 공격 연출 ──
  for (const fx of d.fx) if (fx.draw && clock >= fx.at) fx.draw(fx.life ? Math.min(1, (clock - fx.at) / fx.life) : 1);
}

function render() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0) ctx.translate(Math.round(rand(-3, 3)), Math.round(rand(-2, 2)));
  drawGround();
  drawCamp();
  for (const m of monsters) drawMonster(m);
  if (duelPlay) drawDuel(); else if (raidPlay) drawRaid(); else drawKnight();
  drawShots();
  drawEffects();
  drawSkillFx();
  drawParts();
  ctx.restore();
  drawScreenFx();
  drawFx();
}
