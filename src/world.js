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
  leapT: -1, leapCd: 3,    // 용기병 도약 (leapT 0→1 진행 중)
};
let monsters = [];
let shots = [];            // 화살·마력탄
let effects = [];          // 충격파, 전직 빛기둥
let floaters = [];
let coins = [];
let banner = null;
let grass = [];

function makeGrass() {
  grass = [];
  for (let x = 0; x < W; x += rand(6, 22)) grass.push({ x, h: Math.floor(rand(1, 4)), c: Math.random() < 0.15 });
}

function addFloater(text, x, y, color, size = 12) {
  floaters.push({ text, x, y, color, size, t: 0 });
}
function showBanner(text, color = '#ffd257') { banner = { text, color, t: 0 }; }

// ───────────────────────── 몬스터 ─────────────────────────
function spriteOf(m) {
  const frames = SPR[m.type];
  return frames[Math.floor(m.t * (m.type === 'bat' ? 8 : 3)) % frames.length];
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
  return { type, ...st, maxHp: st.hp, x, born: clock, atkTimer: rand(0.4, 1.0), flash: 0, kb: 0, lunge: 0, dying: 0, t: Math.random() * 10 };
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
  if (boss) lapPlan.push({ type: pool[pool.length - 1], boss: true, x: bossX() });
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
    if (p.boss) showBanner('BOSS!', '#ff9f1c');
  }
}

function endLap() {
  if (finishLap()) { showBanner(`STAGE ${S.stage}`); save(); }
  else if (S.run.farm) showBanner('🔁 재도전 대기', '#9fb3c8');
  lapReady = false;
}

function monsterTop(m) {
  return groundY() - spriteOf(m).length * monsterScale(m) - (m.type === 'bat' ? 22 : 0);
}

function monsterMidY(m) {
  return monsterTop(m) + (spriteOf(m).length * monsterScale(m)) / 2;
}

// mult: 연발 화살·도약 등 무기별 피해 배율
function hitMonster(m, mult = 1) {
  const st = stats();
  const crit = Math.random() < st.crit;
  const dmg = st.atk * mult * (crit ? st.critMult : 1) * rand(0.9, 1.1);
  m.hp -= dmg;
  m.flash = 0.08;
  m.kb = m.boss ? 2 : heroWeapon().motion === 'sweep' ? 10 : 5;
  if (st.heal) S.hp = Math.min(st.maxHp, S.hp + st.maxHp * st.heal);
  addFloater((crit ? '💥' : '') + fmt(dmg), toScreen(m.x) + rand(-6, 6), monsterTop(m) - 4, crit ? '#ffb13b' : '#ffffff', crit ? 14 : 12);
  if (m.hp > 0) return;

  m.dying = 0.001;
  const r = rewardKill(m);
  const sx = toScreen(m.x);
  for (let i = 0; i < (m.boss ? 10 : 3); i++) {
    coins.push({ x: sx, y: groundY() - 14, vx: rand(-60, 60), vy: rand(-160, -90), t: 0, fly: false });
  }
  // 영웅·전설 장비는 이름을 숨기고 크게 알린다 (정체는 캠프에서 챙길 때 공개)
  if (r.loot && r.loot.k === 'gear' && r.loot.g >= 3) {
    const G = GRADES[r.loot.g];
    addFloater(`✨ ${G.name} ${GEAR_SLOTS[r.loot.slot].name}!`, sx, monsterTop(m) - 18, G.color, 15);
    if (!m.boss) showBanner(`${G.name} 장비 발견!`, G.color);
  } else if (r.loot) {
    addFloater(`${lootIcon(r.loot)} ${lootName(r.loot)}`, sx, monsterTop(m) - 18, GRADES[lootGrade(r.loot)].color, 12);
  }
  if (m.boss) { showBanner('STAGE CLEAR!'); save(); }
  if (S.bag.length >= bagCap()) endExpedition('bag');
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

// 용기병: 높이 뛰어올라 착지하며 주변 적 모두에게 큰 피해
function updateLeap(dt, st) {
  knight.leapT += dt / 0.7;
  if (knight.leapT < 1) return;
  knight.leapT = -1;
  effects.push({ type: 'ring', x: toScreen(knight.x) + 24, y: groundY() - 2, t: 0, color: heroClass().look.fx });
  monsters
    .filter(m => !m.dying && aheadDist(knight.x, m.x) <= st.range + st.leap.radius)
    .forEach(m => hitMonster(m, st.leap.mult));
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
    if (m.engaged && d > stop) m.x -= Math.min(MONSTER_SPEED * dt, d - stop);
    prev = aheadDist(knight.x, m.x);
  }

  // 휘두르는 모션의 타격 시점(근접 35%, 활 45%)에 실제로 때리거나 쏜다
  if (knight.pending && (knight.swing < 0 || knight.swing >= (st.kind === 'ranged' ? 0.45 : 0.35))) {
    knight.pending = false;
    releaseAttack(st);
  }

  knight.facing = 1;
  if (st.leap) knight.leapCd -= dt;       // 도약 쿨타임은 원정 내내 흐르고, 준비되면 다음 교전에서 바로 뛴다
  if (knight.leapT >= 0) {
    updateLeap(dt, st);
  } else if (target && best <= reachTo(target)) {
    if (!knight.fighting) { knight.fighting = true; knight.crisis = false; }
    knight.atkTimer -= dt;
    if (st.leap && knight.leapCd <= 0 && !knight.pending) { knight.leapCd = st.leap.every; knight.leapT = 0; }
    if (knight.atkTimer <= 0 && knight.leapT < 0 && !knight.pending) {
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

  for (const m of monsters) {
    if (m.dying || S.phase !== 'expedition') continue;
    if (aheadDist(knight.x, m.x) > monsterReach(m) + 1) continue;
    m.atkTimer -= dt;
    if (m.atkTimer > 0) continue;
    m.atkTimer = m.type === 'bat' ? 1.0 : 1.4;
    m.lunge = 1;
    if (knight.leapT >= 0) continue;                       // 공중에 있으면 빗나감
    const dmg = m.atk * rand(0.9, 1.1) * (1 - st.guard);
    S.hp -= dmg;
    knight.flash = 0.08;
    addFloater('-' + fmt(dmg), toScreen(knight.x) + rand(-4, 4), groundY() - 52, '#ff6b6b', 11);
    if (S.hp > 0 && tryPotion()) addFloater('🧪 +HP', toScreen(knight.x), groundY() - 66, '#7dffb0', 12);
    if (S.hp > 0 && S.hp < st.maxHp * 0.25 && !knight.crisis) { knight.crisis = true; S.trip.crises++; }
    if (S.hp <= 0) {
      addFloater(`💀 스태미나 -${DEFEAT_STAMINA}`, toScreen(knight.x), groundY() - 50, '#ff9f9f', 12);
      knightDefeated(!!m.boss);
      knight.down = DEFEAT_DOWN_SEC;
      knight.fighting = false;
      knight.pending = false;
      shots = [];
      monsters.forEach(o => { if (!o.dying) o.dying = 0.001; });
      if (S.stamina <= 0) endExpedition('stamina');
      break;
    }
  }
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
  clock += dt;
  const gdt = dt * TIME_SCALE;
  advanceBuild(gdt);

  knight.flash = Math.max(0, knight.flash - dt);
  if (knight.swing >= 0) {
    // 공속이 아주 빠르면 모션도 빨라진다
    knight.swing += dt * Math.max(5, stats().aspd * 1.3);
    if (knight.swing >= 1) knight.swing = -1;
  }

  if (S.phase === 'expedition') updateExpedition(dt, gdt);
  else if (S.phase === 'returning') updateReturning(dt);
  else advanceCamp(gdt);
  if (duelPlay) updateDuel();

  for (const m of monsters) {
    m.t += dt;
    m.flash = Math.max(0, m.flash - dt);
    m.kb = Math.max(0, m.kb - dt * 40);
    m.lunge = Math.max(0, m.lunge - dt * 3);
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
  effects = effects.filter(e => e.t < (e.type === 'pillar' ? 2.4 : 0.6));

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
  monsters.forEach(m => { if (!m.dying) m.dying = 0.001; });
  knight.fighting = false;
  knight.pending = false;
  knight.leapT = -1;
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
function drawSprite(rows, pal, cx, bottomY, scale, { flip = false, flash = false, alpha = 1 } = {}, g = ctx) {
  const h = rows.length, w = rows[0].length;
  const ox = Math.round(cx - (w * scale) / 2);
  const oy = Math.round(bottomY - h * scale);
  const prevAlpha = g.globalAlpha;
  g.globalAlpha = prevAlpha * alpha;
  for (let r = 0; r < h; r++) {
    const row = rows[r];
    for (let c = 0; c < w; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      g.fillStyle = flash ? '#ffffff' : (pal[ch] || PAL[ch]);
      g.fillRect(ox + (flip ? w - 1 - c : c) * scale, oy + r * scale, scale, scale);
    }
  }
  g.globalAlpha = prevAlpha;
}

function drawGround() {
  if (!showGround) return;
  const gy = groundY();
  ctx.fillStyle = 'rgba(46, 94, 44, 0.85)';
  ctx.fillRect(0, gy, W, 3);
  ctx.fillStyle = 'rgba(92, 60, 36, 0.8)';
  ctx.fillRect(0, gy + 3, W, H - gy - 3);
  for (const g of grass) {
    ctx.fillStyle = g.c ? '#ffd257' : 'rgba(88, 170, 70, 0.9)';
    ctx.fillRect(g.x, gy - g.h * 2, 2, g.h * 2);
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

function drawWeapon(g, w, x, bodyBottom, pose) {
  const s = pose.swing;
  const hx = x + 4 * PX, hy = bodyBottom - 3 * PX;
  const wob = pose.mode === 'walk' ? Math.sin((pose.walkT || 0) * 8) * 0.08 : 0;
  g.save();
  if (w.glow) { g.shadowColor = w.glow; g.shadowBlur = 8; }

  if (w.kind === 'ranged') {
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
  const opt = { flash: !!pose.flash };
  g.save();
  g.globalAlpha *= pose.alpha == null ? 1 : pose.alpha;
  if (pose.facing < 0) { g.translate(x, 0); g.scale(-1, 1); g.translate(-x, 0); }

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
    const base = gy - (pose.lift || 0);
    const legs = SPR.knightLegs[walking ? step : 0];
    const bodyBottom = base - legs.length * PX - (walking ? step : 0);
    const top = bodyBottom - look.body.length * PX;
    if (look.cape) drawCape(g, look.cape, x, top, bodyBottom, base, t, walking || pose.mode === 'fight');
    drawSprite(legs, pal, x, base, PX, opt, g);
    drawSprite(look.body, pal, x, bodyBottom, PX, opt, g);
    if (look.shield) drawShield(g, look.shield, x - 4 * PX, bodyBottom - 4 * PX);
    if (look.halo) drawHalo(g, x, top, t);
    drawWeapon(g, w, x, bodyBottom, pose);
  }
  g.restore();
}

function drawKnight() {
  const x = toScreen(knight.x);
  const gy = groundY();
  const lift = knight.leapT >= 0 ? Math.sin(Math.PI * knight.leapT) * 40 : 0;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  const shadowW = 28 - lift * 0.3;
  ctx.fillRect(x - shadowW / 2, gy - 1, shadowW, 2);

  drawHero(ctx, S.cls, x, gy, {
    mode: S.phase === 'camp' ? 'sit' : knight.fighting ? 'fight' : 'walk',
    walkT: knight.walkT, swing: knight.swing, facing: knight.facing, t: clock, lift,
    flash: knight.flash > 0,
    alpha: knight.down > 0 ? 0.35 + 0.25 * Math.sin(clock * 12) : 1,
  });
  if (S.phase !== 'camp') drawHpBar(x, gy - 58 - lift, 30, S.hp / stats().maxHp, '#ff5a5a');
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
      const k = e.t / 0.6;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = e.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, 10 + k * 70, 4 + k * 10, 0, 0, Math.PI * 2); ctx.stroke();
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

function drawMonster(m) {
  const x = toScreen(m.x) + m.kb - m.lunge * 5;
  if (x < -60 || x > W + 60) return;
  const scale = monsterScale(m);
  const rows = spriteOf(m);
  const fly = m.type === 'bat' ? 20 + Math.sin(m.t * 4) * 4 : 0;
  const bottom = groundY() - fly;
  const alpha = m.dying ? Math.max(0, 1 - m.dying * 2) : Math.min(1, (clock - m.born) / 0.35);   // 등장 시 서서히
  const hue = Math.floor((S.stage - 1) / 10) * 67 % 360;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - rows[0].length * scale / 2 + 2, groundY() - 1, rows[0].length * scale - 4, 2);

  if (hue) ctx.filter = `hue-rotate(${hue}deg)`;
  drawSprite(rows, MONSTER_PAL[m.type], x, bottom - (m.dying ? m.dying * 20 : 0), scale, { flash: m.flash > 0, alpha });
  ctx.filter = 'none';

  const top = bottom - rows.length * scale;
  if (m.boss) drawSprite(SPR.crown, PAL, x, top - 2, PX, { alpha });
  if (!m.dying) drawHpBar(x, top - (m.boss ? 16 : 8), m.boss ? 50 : 24, m.hp / m.maxHp, m.boss ? '#ff9f1c' : '#ff5a5a');
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
    const cx = duelPlay ? duelPlay.x0 + duelPlay.res.fight.start / 2 : toScreen(knight.x) + 40;   // 결투 중엔 두 기사 사이
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
    const lift = L && L.e.kind === 'leap' && since < 0.35 ? (1 - since / 0.35) * 26 : 0;
    const alpha = side === 'b' ? Math.min(1, (clock - d.t0) / DUEL_ENTER_SEC) : 1;

    ctx.fillStyle = `rgba(0,0,0,${0.25 * alpha})`;
    ctx.fillRect(x - 14, gy - 1, 28, 2);
    drawHero(ctx, who.cls, x, gy, {
      mode: loser ? 'sit' : pt < mv.t ? 'walk' : 'fight',
      walkT: pt, swing: !loser && since < 0.16 ? 0.35 + since * 4 : -1,
      facing: side === 'a' ? 1 : -1, t: clock, lift,
      flash: d.hit[side] != null && clock - d.hit[side] < 0.08,
      alpha: loser ? 0.45 : alpha,
    });

    // 원거리 공격은 화살이 날아가는 모습만 짧게 보여 준다
    const w = WEAPONS[c.weapon];
    if (L && w.kind === 'ranged' && since < 0.14) {
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

function render() {
  ctx.clearRect(0, 0, W, H);
  drawGround();
  drawCamp();
  for (const m of monsters) drawMonster(m);
  if (duelPlay) drawDuel(); else drawKnight();
  drawShots();
  drawEffects();
  drawFx();
}
