'use strict';
// 하단바의 실시간 연출: 기사/몬스터 이동과 전투, 캠프, 이펙트.

const canvas = document.getElementById('c');
// 그리는 캔버스. 도전의 탑 안의 장면은 탑 캔버스로 잠깐 바꿔서 같은 그리기 함수로 그린다 (drawTower)
let ctx = canvas.getContext('2d');
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
  if (tw) resizeTower();
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
  abyss: ['rift', 'obsidian', 'rift'], sky: ['cloud', 'floatrock', 'cloud'], desert: ['cactus', 'bones', 'dune'],
  deep: ['coral', 'kelp', 'bubble'], fairy: ['glowcap', 'firefly', 'fern'], ruins: ['gear', 'pillar', 'spark'],
  crystal: ['cluster', 'gem', 'cluster'], storm: ['rod', 'crag', 'gust'], cosmos: ['star', 'meteor', 'nebula'],
};
function makeGrass() {
  groundZone = zoneIndex(S.stage);
  const kinds = DECOR_KINDS[ZONES[groundZone].ground.deco];
  grass = [];
  for (let x = 0; x < W; x += rand(6, 22)) grass.push({ x, h: Math.floor(rand(1, 4)), c: Math.random() < 0.15 });
  decor = [];
  for (let x = 130 + rand(0, 60); x < W - 10; x += rand(90, 190)) decor.push({ x: Math.round(x), kind: kinds[Math.floor(Math.random() * kinds.length)], r: Math.random() });
}

// pop: 처음 잠깐 크게 튀어나왔다가 제 크기로 줄어든다 (스킬 피해 숫자)
function addFloater(text, x, y, color, size = 12, pop = false) {
  if (towerInside()) return floaters.push({ text, x, y, color, size, pop, t: 0, tw: true });
  floaters.push({ text, x, y, color, size, t: 0, pop });
}
function showBanner(text, color = '#ffd257') { banner = { text, color, t: 0 }; }

// 서버 확성기: 하단바 위쪽을 오른쪽에서 왼쪽으로 흘러가는 소식 한 줄 (한 번에 하나씩, 밀린 건 줄 서서)
const SHOUT_SPEED = 200;        // px/s
let shouts = [], shoutNow = null;
// parts: [[글자, 색 | 'rainbow'], …] — 조각마다 색이 다르다 (ui.js 의 shoutText)
function pushShout(parts) { if (shouts.length < 10) shouts.push({ parts }); }
function updateShout(dt) {
  if (!shoutNow && shouts.length) shoutNow = { ...shouts.shift(), x: W + 10, w: 0 };
  if (!shoutNow) return;
  shoutNow.x -= SHOUT_SPEED * dt;
  if (shoutNow.w && shoutNow.x + shoutNow.w < -10) shoutNow = null;
}
function drawShout() {
  if (!shoutNow) return;
  ctx.font = 'bold 15px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  const y = 52, hue = performance.now() / 3;     // HUD(위 6~34px) 바로 아래
  let x = Math.round(shoutNow.x);
  for (const [t, c] of shoutNow.parts) {
    // 무지개: 글자마다 색이 흐른다
    for (const piece of c === 'rainbow' ? [...t] : [t]) {
      ctx.strokeText(piece, x, y);
      ctx.fillStyle = c === 'rainbow' ? `hsl(${(hue + (x - shoutNow.x) * 9) % 360}, 100%, 66%)` : c;
      if (c === 'rainbow') { ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8; }
      ctx.fillText(piece, x, y);
      ctx.shadowBlur = 0;
      x += ctx.measureText(piece).width;
    }
  }
  shoutNow.w = x - shoutNow.x;
  ctx.textAlign = 'center';
}

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

function makeMonster(type, boss, x, st = monsterStats(S.stage, boss)) {
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
// 입힌 피해를 돌려준다 (스킬 흡혈용). o.critPlus: 이 타격만의 치명 확률 보정 (트리 V2 💥 치명)
function hitMonster(m, mult = 1, o = {}) {
  const st = stats();
  const crit = o.crit || Math.random() < Math.min(0.8, st.crit + (o.critPlus || 0));
  const dmg = st.atk * mult * (crit ? st.critMult : 1) * rand(0.9, 1.1);
  m.hp -= dmg;
  m.flash = o.color ? 0.13 : 0.08;
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
    addFloater((anyCrit ? '💥' : '') + fmt(total), toScreen(m.x) + rand(-6, 6), monsterTop(m) - 4 - (o.color ? rand(0, 10) : 0), anyCrit ? '#ffb13b' : o.color || '#ffffff', size + (o.color ? 2 : 0), !!o.color);
  }
  if (m.hp > 0) return dmg;

  m.dying = 0.001;
  m.killed = true;
  shatter(m);
  if (S.phase === 'tower') { towerKillReward(m); return dmg; }
  if (S.phase === 'dungeon') { dgKill(m); return dmg; }
  const r = rewardKill(m);
  const sx = toScreen(m.x);
  for (let i = 0; i < (m.boss ? 10 : 3); i++) {
    coins.push({ x: sx, y: groundY() - 14, vx: rand(-60, 60), vy: rand(-160, -90), t: 0, fly: false });
  }
  // 상자·비전서는 실제로 필드에 떨어지고 기사가 주워 간다 (src/drops.js). 내용물은 캠프에서 열 때 공개
  if (r.loot) spawnDrop('box', r.loot.g, sx, monsterMidY(m), m.boss);
  if (r.tome) spawnDrop('tome', 0, sx, monsterMidY(m), false, { dist: r.loot ? rand(-14, -4) : rand(16, 28), delay: r.loot ? 0.12 : 0, pop: 1.15 });
  if (m.boss) addFloater(`💠 강화석 +${BOSS_STONES}`, sx, monsterTop(m) - 18, '#8fd8ff', 13, true);
  if (m.boss) { showBanner('STAGE CLEAR!'); save(); }
  if (bagFull()) endExpedition('bag');
  return dmg;
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

  fightTick(dt, st, () => {
    knight.x += WALK_SPEED * dt;
    if (knight.x >= worldLen()) { knight.x -= worldLen(); endLap(); }
    knight.walkT += dt;
    S.hp = Math.min(st.maxHp, S.hp + st.maxHp * 0.06 * dt);
  });
}

// 교전 한 프레임: 몬스터 접근 → 기사 평타·스킬 → 몬스터 공격. 싸울 상대가 사거리에 없으면 onFree() (원정은 걷기, 탑은 층 정리)
function fightTick(dt, st, onFree) {
  const phase = S.phase;
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
      knight.combo = (knight.combo || 0) + 1;            // 연속기 직업은 평타마다 모션을 번갈아 쓴다
      knight.pending = true;
    }
  } else {
    knight.fighting = false;
    knight.atkTimer = Math.min(knight.atkTimer, 0.25);
    onFree();
  }

  // 공격은 예비동작 → 타격 → 복귀 모션으로 재생하고, 피해는 타격 프레임에 들어간다
  for (const m of monsters) {
    if (m.dying || S.phase !== phase || knight.down > 0) continue;
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
  if (S.hp > 0 && S.hp < st.maxHp * 0.25 && !knight.crisis) { knight.crisis = true; if (S.trip) S.trip.crises++; }
  if (S.hp > 0) return false;
  if (S.phase === 'tower') { towerKnightDown(); return true; }
  if (S.phase === 'dungeon') { dgViewDown(); return true; }
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

// ───────────────────────── 도전의 탑 ─────────────────────────
// 규칙(층·보상)은 src/tower.js. 여기는 연출: 캠프에서 빛에 싸여 탑 1층으로 순간이동 → 층마다 싸우고 사다리로 오름
// → 끝나면 귀환 빛으로 캠프에 돌아온다 (쓰러지면 바닥까지 추락한 뒤, 후퇴·지침은 그 층에서 바로).
// 탑은 화면 오른쪽 끝의 세로 띠(탑 캔버스 #tc)에 그린다. 창이 하단바 높이뿐이면(새 창 모드가 없는 옛 앱, 좁은 iframe)
// 같은 탑이 하단바 오른쪽 끝 150px 안에서 층을 아래로 내리며 보인다. 새 앱은 탑에 들어갈 때 창을 화면 전체 높이로 키운다
// (window.bar.setOverlay — 클릭은 계속 통과).
// 탑 안의 기사·몬스터는 "층 좌표"에 있다: 하단바와 같은 눈금(x = 탑 왼쪽 끝부터, 땅 = groundY())이고,
// 그릴 때만 그 층의 높이로 옮긴다. 그래서 원정의 전투·스킬·이펙트 코드를 그대로 쓴다.
const TOWER_W = 150;            // 탑 폭(px)
const FLOOR_H = 80;             // 층 높이(px)
const TW_START_X = 30;          // 층에서 기사가 자리 잡는 곳 (탑 안 x)
const TW_LADDER_X = TOWER_W - 16;
const TW_SPAWN_X = TOWER_W - 36;
const tcv = document.createElement('canvas');
tcv.id = 'tc';
tcv.hidden = true;
document.body.appendChild(tcv);
const tctx = tcv.getContext('2d');
let tcH = BAR_H;                // 탑 캔버스 높이 (하단바 높이면 하단바 안 탑)
// 탑 연출 상태. sub: warpOut 캠프에서 사라짐 | enter 층 자리로 | fight | clear 잠깐 숨 고르기 | climb 사다리 | fall 추락 | recall 귀환 빛 → 캠프
//  idx: 이번 도전의 시작 층부터 센 층 번호(0 = 1층 자리), dy: 사다리를 오른 높이, h·vy: 추락 높이·속도, cam: 화면 맨 아래 층(소수)
//  hold: recall 에서 귀환 빛이 일기 전까지 머무는 시간
let tw = null;
const WARP_SEC = 0.45;          // 순간이동 빛에 사라지거나 나타나는 시간
const WARP_COLORS = ['#e8dcff', '#c9a7ff', '#ffffff'];
const towerInside = () => !!tw && tw.sub !== 'warpOut';
const towerStrip = () => tcH > BAR_H;
const towerLevel = () => (tw.sub === 'fall' ? tw.h / FLOOR_H : tw.idx + tw.dy / FLOOR_H);
// 기사 순간이동 빛: out 사라짐(끝나도 안 보이는 채로 남음) | in 나타남(끝나면 지움). 그리기는 drawKnight
function warpKnight(dir) {
  knight.warp = { dir, t: 0 };
  burst(toScreen(knight.x), groundY() - 18, 14, WARP_COLORS, 70, 2, -60);
}
const towerFloorY = (i) => tcH - 10 - (i - tw.cam) * FLOOR_H;

function resizeTower() {
  const dpr = window.devicePixelRatio || 1;
  tcH = window.innerHeight >= BAR_H + 150 ? window.innerHeight : BAR_H;
  tcv.width = TOWER_W * dpr; tcv.height = tcH * dpr;
  tcv.style.width = TOWER_W + 'px'; tcv.style.height = tcH + 'px';
  tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  tctx.imageSmoothingEnabled = false;
}

// 캠프에서 도전을 시작한 직후 (core 상태는 startTower 가 이미 바꿨다)
function beginTowerView() {
  tw = { sub: 'warpOut', idx: 0, dy: 0, h: 0, vy: 0, cam: 0, t: 0, hold: 0, res: null };
  monsters = []; shots = []; lapReady = false;
  Object.assign(knight, { down: 0, fighting: false, pending: false, swing: -1, ward: null });
  document.body.classList.add('tower');
  if (window.bar && window.bar.setOverlay) window.bar.setOverlay(true);
  resizeTower();
  warpKnight('out');
}
function endTowerView() {
  tw = null;
  document.body.classList.remove('tower');
  if (window.bar && window.bar.setOverlay) window.bar.setOverlay(false);
}
// 층 좌표에서 생긴 이펙트를 걷어 낸다 (탑을 드나들 때 하단바 좌표와 섞이지 않게)
function clearTowerFx() {
  effects = []; parts = []; shots = []; casts = []; skfx = []; cutin = null;
  floaters = floaters.filter((f) => !f.tw);
}

// 도전 끝: 쓰러지면 바닥까지 추락한 뒤, 지침·후퇴는 그 층에서 바로 귀환 빛에 싸여 캠프로
function towerEndRun(reason) {
  if (!tw || !S.tower.run) return;
  tw.res = endTower(reason);
  monsters.forEach((m) => { if (!m.dying) m.dying = 0.001; m.anim = null; });
  knight.fighting = false; knight.pending = false; knight.ward = null;
  endCast('hero');
  shots = [];
  if (tw.sub === 'warpOut') { towerHome(); return; }   // 아직 캠프를 떠나기 전
  const label = { down: '💀 쓰러졌다!', stamina: '😮‍💨 지쳤다…', retreat: '✨ 귀환!' }[reason];
  if (label) addFloater(label, toScreen(knight.x), groundY() - 60, '#ffd257', 12);
  if (reason === 'down') { tw.h = towerLevel() * FLOOR_H; tw.vy = -60; tw.sub = 'fall'; }
  else { tw.sub = 'recall'; tw.t = 0; tw.hold = reason === 'stamina' ? 0.5 : 0.1; }
  save();
}
// 귀환 빛이 다 걷히면: 탑을 닫고 캠프 모닥불 옆에 나타난다
function towerHome() {
  const res = tw.res;
  clearTowerFx();
  monsters = [];
  endTowerView();
  S.phase = 'camp';
  Object.assign(knight, { x: toWorld(CAMP_X), facing: 1, down: 0, fighting: false });
  warpKnight('in');
  hooks.onTowerEnd(res);
  save();
}
function towerKnightDown() {
  knight.down = 0.6;
  towerEndRun('down');
}

function towerWalk(toX, speed, dt) {
  const sx = toScreen(knight.x), diff = toX - sx;
  if (Math.abs(diff) <= speed * dt) { knight.x = toWorld(toX); return true; }
  knight.facing = Math.sign(diff);
  knight.x += knight.facing * speed * dt;
  knight.walkT += dt;
  return false;
}

function updateTower(dt, gdt) {
  if (!tw) beginTowerView();
  const st = stats();
  const regen = () => { S.hp = Math.min(st.maxHp, S.hp + st.maxHp * 0.06 * dt); };
  knight.down = Math.max(0, knight.down - dt);
  // 카메라: 띠에선 지금 층을 아래에서 30% 쯤에, 하단바 안에선 지금 층을 바닥에 둔다
  const keep = towerStrip() ? Math.floor((tcH * 0.3) / FLOOR_H) : 0;
  const camTo = Math.max(0, towerLevel() - keep);
  tw.cam += (camTo - tw.cam) * Math.min(1, dt * (tw.sub === 'fall' ? 12 : 5));

  if (S.tower.run && towerInside()) {
    S.stamina -= STAMINA_DRAIN * gdt;
    if (S.stamina <= 0) { S.stamina = 0; towerEndRun('stamina'); }
  }

  switch (tw.sub) {
    case 'warpOut':
      // 캠프에서 빛에 싸여 사라지면 → 탑 1층 문 안쪽에 나타난다
      if ((tw.t += dt) >= WARP_SEC) {
        clearTowerFx();
        tw.sub = 'enter';
        knight.x = toWorld(TW_START_X - 14);
        knight.facing = 1;
        warpKnight('in');
      }
      break;
    case 'enter':
      regen();
      if (towerWalk(TW_START_X, WALK_SPEED * 1.6, dt)) {
        knight.facing = 1;
        const floor = S.tower.run.floor, m = towerMonster(floor);
        monsters = [makeMonster(m.type, m.boss, toWorld(TW_SPAWN_X), { ...m, atk0: m.atk, rage: 1 })];
        tw.ft = 0;
        if (m.boss) showBanner(`🗼 ${floor}F 보스! ${MONSTERS[m.type].name}`, '#ff5a5a');
        tw.sub = 'fight';
      }
      break;
    case 'fight':
      // 광폭화: 오래 끌수록 몬스터 공격력이 치솟는다 (tower.js towerRage)
      if (knight.fighting && S.tower.run) {
        const was = towerRage(tw.ft);
        tw.ft += dt;
        const rage = towerRage(tw.ft);
        for (const m of monsters) if (!m.dying && m.atk0) { m.rage = rage; m.atk = m.atk0 * rage; }
        if (was === 1 && rage > 1) showBanner('😡 광폭화!', '#ff5a5a');
        else if (Math.floor(Math.log2(was)) < Math.floor(Math.log2(rage))) {
          const m = monsters.find((o) => !o.dying);
          if (m) addFloater(`😡 공격력 ×${Math.round(rage)}`, toScreen(m.x), groundY() - 56, '#ff5a5a', 12);
        }
      }
      fightTick(dt, st, () => {
        if (monsters.some((m) => !m.dying)) { knight.x += WALK_SPEED * dt; knight.walkT += dt; return; }
        const r = clearTowerFloor();
        addFloater(`${r.floor}F 돌파!`, toScreen(knight.x), groundY() - 62, '#ffffff', 12);
        if (r.tomes) addFloater(`📖 비전서 +${r.tomes}`, toScreen(knight.x), groundY() - 78, '#c9a7ff', 14, true);
        if (r.first) showBanner(`🗼 ${r.floor}F 첫 돌파! 📖 +${r.tomes}`, '#c9a7ff');
        else if (r.record) showBanner(`🗼 최고 기록 경신!`, '#ffd257');
        tw.sub = 'clear'; tw.t = 0;
        save();
      });
      break;
    case 'clear':
      regen();
      if ((tw.t += dt) > 0.45) tw.sub = 'climb';
      break;
    case 'climb':
      regen();
      if (!towerWalk(TW_LADDER_X, WALK_SPEED * 1.6, dt)) break;
      knight.facing = 1;
      knight.walkT += dt;
      tw.dy += (FLOOR_H / 0.6) * dt;
      if (tw.dy >= FLOOR_H) { tw.dy = 0; tw.idx++; monsters = []; tw.sub = 'enter'; }
      break;
    case 'fall':
      tw.vy = Math.min(700, tw.vy + 1100 * dt);
      tw.h -= tw.vy * dt;
      if (tw.h <= 0) {
        tw.h = 0;
        burst(toScreen(knight.x), groundY() - 2, 12, ['#b8a890', '#8a7a68', '#ffffff'], 90, 2, 300);
        shake = Math.max(shake, 0.15);
        // 바닥에 쓰러진 채 잠깐 → 귀환 빛
        tw.idx = 0; tw.dy = 0;
        knight.down = Math.max(knight.down, 0.9);
        addFloater('👻', toScreen(knight.x), groundY() - 40, '#ffffff', 14);
        tw.sub = 'recall'; tw.t = 0; tw.hold = 0.8;
      }
      break;
    case 'recall':
      tw.t += dt;
      if (tw.t >= tw.hold && !knight.warp) warpKnight('out');
      if (knight.warp && knight.warp.dir === 'out' && knight.warp.t >= WARP_SEC) towerHome();
      break;
  }
}

// 탑 캔버스: 벽돌 벽·층 바닥·사다리·층 번호, 그 위에 지금 층의 기사·몬스터·이펙트
function drawTower() {
  if (tcv.hidden !== !tw) { tcv.hidden = !tw; if (tw) resizeTower(); }
  if (!tw) return;
  const g = tctx;
  g.clearRect(0, 0, TOWER_W, tcH);
  drawTowerBody(g);
  if (!towerInside()) return;
  const keep = ctx;
  ctx = g;
  try {
    ctx.save();
    if (shake > 0) { const amp = Math.max(3, shakeAmp); ctx.translate(Math.round(rand(-amp, amp)), Math.round(rand(-amp * 0.7, amp * 0.7))); }
    ctx.translate(0, Math.round(towerFloorY(towerLevel()) - groundY()));
    drawActors();
    drawFloaters(true);
    ctx.restore();
  } finally {
    ctx = keep;
  }
}

function drawTowerBody(g) {
  const r = S.tower.run || tw.res, start = r ? r.start : towerCheckpoint();
  const gr = ZONES[zoneIndex(S.stage)].ground;
  const lo = Math.max(0, Math.floor(tw.cam) - 1), hi = Math.ceil(tw.cam + tcH / FLOOR_H) + 1;
  g.font = 'bold 10px -apple-system, sans-serif';
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  for (let i = lo; i <= hi; i++) {
    const gy = Math.round(towerFloorY(i)), f = start + i, top = gy - FLOOR_H, boss = towerBossFloor(f);
    if (top > tcH || gy < -10) continue;
    // 벽 (벽돌 줄눈)
    g.fillStyle = 'rgba(30,27,40,0.93)';
    g.fillRect(0, top, TOWER_W, FLOOR_H);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let row = 0; row < FLOOR_H; row += 10) {
      g.fillRect(0, top + row, TOWER_W, 1);
      for (let x = (row / 10) % 2 ? 0 : 12; x < TOWER_W; x += 24) g.fillRect(x, top + row, 1, 10);
    }
    // 가운데 좁은 창과 횃불
    g.fillStyle = 'rgba(120,150,220,0.18)';
    g.fillRect(TOWER_W / 2 - 4, top + 14, 8, 22);
    g.fillRect(TOWER_W / 2 - 2, top + 12, 4, 2);
    const fl = 0.6 + 0.4 * Math.sin(clock * 9 + i * 1.7);
    g.fillStyle = '#5a4030'; g.fillRect(14, top + 30, 2, 8);
    g.fillStyle = `rgba(255,170,60,${0.7 * fl})`; g.fillRect(13, top + 26, 4, 4);
    g.fillStyle = `rgba(255,230,140,${fl})`; g.fillRect(14, top + 27, 2, 2);
    // 사다리 (이 층에서 위층으로)
    g.fillStyle = '#7a5530';
    g.fillRect(TW_LADDER_X - 5, top, 2, FLOOR_H);
    g.fillRect(TW_LADDER_X + 4, top, 2, FLOOR_H);
    for (let y = top + 4; y < gy; y += 8) g.fillRect(TW_LADDER_X - 5, y, 11, 2);
    // 바닥
    g.fillStyle = boss ? '#7a3b46' : '#575066';
    g.fillRect(0, gy, TOWER_W, 4);
    g.fillStyle = boss ? '#b05a66' : '#8a8298';
    g.fillRect(0, gy, TOWER_W, 1);
    // 층 번호 (최고 기록 층은 금색, 보스 층은 빨강)
    g.fillStyle = f === S.tower.best ? '#ffd257' : boss ? '#ff8080' : 'rgba(255,255,255,0.55)';
    g.fillText(`${boss ? '👑' : ''}${f}F`, 22, top + 12);
    if (i === 0) {
      // 1층 왼쪽 벽의 문
      g.fillStyle = '#0c0a12';
      g.fillRect(0, gy - 26, 10, 26);
      g.fillRect(2, gy - 28, 6, 2);
    }
  }
  // 바닥층 아래는 하단바와 같은 흙
  const g0 = Math.round(towerFloorY(0));
  if (g0 < tcH) { g.fillStyle = gr.soil; g.fillRect(0, g0 + 4, TOWER_W, tcH - g0 - 4); }
  // 바깥 벽
  g.fillStyle = '#15131c';
  g.fillRect(0, 0, 2, Math.min(tcH, g0 - 26)); g.fillRect(TOWER_W - 2, 0, 2, tcH);
}

// ───────────────────────── 재료의 미궁 (보스 러시 + 슬롯머신) ─────────────────────────
// 규칙(보스·슬롯 결과·보상)은 src/dungeon.js. 여기는 하단바 연출:
// 캠프에서 빛에 싸여 사라짐 → 어두운 돌바닥 위 왼쪽에 나타남 → 오른쪽에서 보스가 나와 싸움 → 잡으면 슬롯머신이 땅에서 올라와 세 칸이 돌고
// 하나씩 멈춘다 (앞 둘이 같으면 셋째는 뜸을 들인다) → 결과대로 재화 아이콘이 쏟아져 바닥에 튀다 HUD 배낭으로 날아간다 → 기사는 오른쪽으로 걸어
// 나가 빛에 싸였다가 다시 왼쪽에 나타나고 다음 보스 → 쓰러지거나 나가면 귀환 빛으로 캠프.
// sub: warpOut 캠프에서 사라짐 | stand 보스 기다림 | fight 보스전 | slot 슬롯머신 | walkOut 다음 보스로 | home 귀환 빛
let dv = null;
let sv = null;                      // 슬롯머신 연출 { t, reels[{ final, stopAt, stopped, bounce, phase }], tier, paidAt, doneAt, rise }
let slotFx = [];                    // 쏟아지는 재화 아이콘
const DG_KX = 90;                   // 기사가 서는 화면 x
const DG_MOB_X = 330;               // 보스 화면 x
const SLOT_X = 300, SLOT_W = 124, SLOT_H = 92;      // 슬롯머신 자리·크기 (바닥에 붙는다)
const SLOT_SPIN = 16;               // 돌 때 초당 그림 수
const dgInside = () => !!dv && dv.sub !== 'warpOut';

function beginDungeonView() {
  dv = { sub: 'warpOut', t: 0, hold: 0 };
  sv = null; slotFx = [];
  monsters = []; shots = []; lapReady = false;
  Object.assign(knight, { down: 0, fighting: false, pending: false, swing: -1, ward: null });
  warpKnight('out');
}
function endDungeonView() { dv = null; sv = null; slotFx = []; }
// 결과 한 줄을 기사 머리 위에 (dungeon.js 가 돌려준 { text, sub, bad, big })
function dgShow(res) {
  if (!res) return;
  const x = toScreen(knight.x);
  if (res.big) showBanner(res.text, res.bad ? '#ff8f8f' : '#ffd257');
  else addFloater(res.text, x, groundY() - 66, res.bad ? '#ff8f8f' : '#ffffff', 13, true);
  if (res.sub) addFloater(res.sub, x, groundY() - 82, res.bad ? '#ffb0b0' : '#9fffc0', 12);
}
// 끝: 귀환 빛에 싸여 캠프로 (endDungeon 은 이미 불렸다)
function dgViewEnd() {
  if (!dv) return;
  dv.res = S.dg.last;
  monsters.forEach((m) => { if (!m.dying) m.dying = 0.001; m.anim = null; });
  knight.fighting = false; knight.pending = false; knight.ward = null;
  endCast('hero');
  shots = []; sv = null;
  slotFx.forEach((f) => { if (f.st !== 'fly') slotFly(f); });
  dv.sub = 'home'; dv.t = 0; dv.hold = dv.res && dv.res.reason === 'down' ? 1 : 0.6;
  save();
}
function dgViewDown() {
  knight.down = 1.2;
  addFloater('💀 쓰러졌다!', toScreen(knight.x), groundY() - 60, '#ff8f8f', 13);
  endDungeon('down');
  dgViewEnd();
}
function dgRetreat() {
  if (!S.dg.run) return;
  endDungeon('retreat');
  addFloater('✨ 나가기!', toScreen(knight.x), groundY() - 60, '#ffd257', 12);
  dgViewEnd();
}
function dgSpawn(f) {
  monsters = f.mobs.map((st, i) => {
    const m = makeMonster(zoneOf(f.stage).boss, true, toWorld(DG_MOB_X + i * 56), st);
    m.engaged = true;
    return m;
  });
  showBanner(`👑 보스 ${S.dg.run.k + 1} · ${MONSTERS[monsters[0].type].name}`, '#ff5a5a');
  f.spawned = true;
}

// ── 슬롯머신 ──
// 세 칸은 1.0 · 1.8 · 2.7초에 멈춘다. 앞 둘이 같으면 셋째는 3.9초까지 뜸을 들인다 (퍼펙트든 아니든 — 그게 긴장이다)
function beginSlot(slot) {
  const stops = [1.0, 1.8, slot.reels[0] === slot.reels[1] ? 3.9 : 2.7];
  sv = { t: 0, tier: slot.tier, reels: slot.reels.map((final, i) => ({ final, stopAt: stops[i], stopped: false, bounce: 0, phase: Math.random() * 6 })), paidAt: 0, doneAt: 0, rise: 0 };
  slotFx = [];
}
function updateSlot(dt) {
  const run = S.dg.run, slot = run && run.slot;
  if (!sv || !slot) { dv.sub = 'walkOut'; dv.t = 0; return; }
  sv.t += dt;
  sv.rise = Math.min(1, sv.t / 0.35);
  const gy = groundY();
  for (let i = 0; i < 3; i++) {
    const r = sv.reels[i];
    if (r.stopped) { r.bounce = Math.max(0, r.bounce - dt * 4); continue; }
    // 멈추기 직전엔 느려진다
    const left = r.stopAt - sv.t;
    r.phase += dt * SLOT_SPIN * (left < 0.5 ? Math.max(0.25, left / 0.5) : 1);
    if (sv.t >= r.stopAt) {
      r.stopped = true; r.phase = DG_RES_IDS.indexOf(r.final); r.bounce = 1;
      burst(SLOT_X - 38 + i * 38, gy - 58, 5, ['#ffffff', '#ffd257'], 60, 2, 200);
      if (i === 2) shake = Math.max(shake, sv.tier === 'perfect' ? 0.5 : sv.tier === 'pair' ? 0.15 : 0.05);
    }
  }
  if (!sv.paidAt && sv.reels.every((r) => r.stopped)) {
    sv.paidAt = sv.t;
    dgSlotPayout(slot, run);
    slotPour(slot);
    const main = slot.reels.find((r) => slot.reels.filter((x) => x === r).length >= 2);
    if (slot.tier === 'perfect') { showBanner(`🌟 PERFECT!! ${DG_RES[main].icon} ${DG_RES[main].name} 대량!`, '#ffd257'); hitstop = Math.max(hitstop, 0.08); }
    else if (slot.tier === 'pair') showBanner(`🎉 2연속! ${DG_RES[main].icon} ${DG_RES[main].name} 중량`, '#9fffc0');
    else addFloater('3종 소량', SLOT_X, gy - SLOT_H - 14, '#ffffff', 12, true);
    addFloater(dgSlotText(slot), SLOT_X, gy - SLOT_H - 30, slot.tier === 'perfect' ? '#ffd257' : '#9fffc0', slot.tier === 'perfect' ? 14 : 12);
    sv.doneAt = sv.t + (slot.tier === 'perfect' ? 3.2 : slot.tier === 'pair' ? 2.4 : 1.8);
    save();
  }
  if (sv.doneAt && sv.t >= sv.doneAt) {
    sv = null;
    dgNextBoss();
    dv.sub = 'walkOut'; dv.t = 0;
  }
}
// 보상만큼 재화 아이콘이 받침에서 쏟아진다 — 양이 아니라 등급에 따라 개수 (퍼펙트는 우수수)
function slotPour(slot) {
  const gy = groundY(), tier = slot.tier;
  const per = { diff: 3, pair: 9, perfect: 36 }[tier];
  const list = [];
  for (const r of Object.keys(slot.payout)) {
    const main = slot.reels.filter((x) => x === r).length >= 2;
    const n = tier === 'diff' ? per : main ? per : 2;
    for (let i = 0; i < n; i++) list.push(r);
  }
  list.sort(() => Math.random() - 0.5);
  list.forEach((r, i) => slotFx.push({ r, x: SLOT_X + rand(-14, 14), y: gy - 10, vx: rand(-120, 120), vy: rand(-320, -140), st: 'fall', t: 0, delay: i * (tier === 'perfect' ? 0.035 : 0.06), hold: rand(1.0, 1.7) + (tier === 'perfect' ? 0.6 : 0), size: tier === 'perfect' ? 14 : 12, rot: rand(-1, 1) }));
}
function slotFly(f) {
  f.st = 'fly'; f.t = 0; f.x0 = f.x; f.y0 = f.y;
}
// HUD 의 배낭 칩 위치 (하단바 좌표). 없으면 기사 머리 위
function dgBagTarget() {
  const el = document.querySelector('#dgInfo .dchip.bag'), layer = document.getElementById('barLayer');
  if (el && layer && !document.body.classList.contains('faded')) {
    const r = el.getBoundingClientRect(), l = layer.getBoundingClientRect();
    if (r.width) return { x: r.left - l.left + 12, y: r.top - l.top + r.height / 2, el };
  }
  return { x: toScreen(knight.x), y: groundY() - 40, el: null };
}
function updateSlotFx(dt) {
  if (!slotFx.length) return;
  const gy = groundY();
  for (const f of slotFx) {
    if (f.delay > 0) { f.delay -= dt; continue; }
    f.t += dt;
    if (f.st === 'fall') {
      f.vy += 760 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vx * dt * 0.02;
      if (f.y >= gy - 2 && f.vy > 0) { f.y = gy - 2; f.vy = -f.vy * 0.45; f.vx *= 0.7; if (Math.abs(f.vy) < 30) f.vy = 0; }
      if (f.x < 8) { f.x = 8; f.vx = Math.abs(f.vx); } else if (f.x > W - 8) { f.x = W - 8; f.vx = -Math.abs(f.vx); }
      if (f.t >= f.hold) slotFly(f);
    } else {
      const tg = dgBagTarget(), u = Math.min(1, f.t / 0.5), e = u * u;
      f.x = f.x0 + (tg.x - f.x0) * e; f.y = f.y0 + (tg.y - f.y0) * e - Math.sin(u * Math.PI) * 30;
      if (u >= 1) { f.done = true; if (tg.el && tg.el.animate && Math.random() < 0.3) tg.el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)', offset: 0.3 }, { transform: 'scale(1)' }], { duration: 220 }); }
    }
  }
  slotFx = slotFx.filter((f) => !f.done);
}
function drawSlotFx() {
  if (!slotFx.length) return;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of slotFx) {
    if (f.delay > 0) continue;
    const k = f.st === 'fly' ? 1 - Math.min(1, f.t / 0.5) * 0.4 : 1;
    ctx.font = `${Math.round(f.size * k)}px -apple-system, sans-serif`;
    ctx.save(); ctx.translate(Math.round(f.x), Math.round(f.y - f.size / 2)); ctx.rotate(f.st === 'fall' ? f.rot * 0.3 : 0);
    ctx.fillText(DG_RES[f.r].icon, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}
// 슬롯머신: 남보라 몸통에 은회색 테, 위에 전구 줄, 가운데 창 세 개, 오른쪽 레버, 아래 받침
function drawSlotMachine() {
  if (!sv || !dgInside()) return;
  const gy = groundY(), x0 = SLOT_X - SLOT_W / 2, h = SLOT_H * sv.rise, top = gy - h;
  const perfect = sv.tier === 'perfect' && sv.paidAt;
  ctx.save();
  // 몸통
  ctx.fillStyle = '#1a1426'; ctx.fillRect(x0 - 2, top - 2, SLOT_W + 4, h + 2);
  ctx.fillStyle = '#3b2f5a'; ctx.fillRect(x0, top, SLOT_W, h);
  ctx.fillStyle = '#4a3c70'; ctx.fillRect(x0, top, SLOT_W, 6);
  ctx.fillStyle = '#c9c4d6'; ctx.fillRect(x0, top + 6, SLOT_W, 2); ctx.fillRect(x0, gy - 14, SLOT_W, 2);
  // 받침(재화가 나오는 입)
  ctx.fillStyle = '#0f0c18'; ctx.fillRect(x0 + 18, gy - 11, SLOT_W - 36, 7);
  if (h < SLOT_H * 0.9) { ctx.restore(); return; }
  // 전구 줄: 돌 땐 번갈아, 멈추면 결과색으로 숨 쉬듯, 퍼펙트는 무지개
  const n = 9;
  for (let i = 0; i < n; i++) {
    const lx = x0 + 8 + i * ((SLOT_W - 16) / (n - 1));
    let col;
    if (perfect) col = `hsl(${(clock * 400 + i * 40) % 360}, 100%, 65%)`;
    else if (sv.paidAt) col = (Math.floor(clock * 4) + i) % 3 === 0 ? '#ffd257' : '#6a5a40';
    else col = (Math.floor(clock * 8) + i) % 2 === 0 ? '#ff9f1c' : '#5a4630';
    ctx.fillStyle = col; ctx.fillRect(Math.round(lx) - 2, top + 10, 4, 4);
  }
  // 창 세 개
  ctx.font = '18px -apple-system, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const ww = 32, wh = 40, wy = top + 20;
  for (let i = 0; i < 3; i++) {
    const r = sv.reels[i], wx = x0 + 10 + i * (ww + 6);
    ctx.fillStyle = '#0f0c18'; ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
    ctx.fillStyle = r.stopped ? (perfect ? '#fff3c4' : '#f4efe2') : '#e6e0d2'; ctx.fillRect(wx, wy, ww, wh);
    ctx.save();
    ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
    const cx = wx + ww / 2, cy = wy + wh / 2;
    if (r.stopped) {
      const b = Math.sin(r.bounce * Math.PI) * 4;
      ctx.fillStyle = '#000';
      ctx.fillText(DG_RES[r.final].icon, cx, cy + 1 + b);
    } else {
      // 돌아가는 띠: 그림 3개가 아래로 흐른다 (잔상 한 장)
      const p = r.phase, idx = Math.floor(p), off = (p - idx) * wh;
      ctx.fillStyle = '#000';
      for (let j = -1; j <= 1; j++) {
        const id = DG_RES_IDS[((idx + j) % 6 + 6) % 6];
        ctx.globalAlpha = 0.85;
        ctx.fillText(DG_RES[id].icon, cx, cy + 1 - j * wh + off);
        ctx.globalAlpha = 0.25;
        ctx.fillText(DG_RES[id].icon, cx, cy + 1 - j * wh + off - 10);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // 유리 반사
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(wx, wy, ww, 6);
    // 멈춘 칸이 앞 칸과 같으면 금테
    if (r.stopped && i > 0 && sv.reels[i - 1].stopped && sv.reels[i - 1].final === r.final) { ctx.strokeStyle = '#ffd257'; ctx.lineWidth = 2; ctx.strokeRect(wx - 1, wy - 1, ww + 2, wh + 2); }
  }
  // 레버: 처음 0.5초 동안 당겨진다
  const lx = x0 + SLOT_W + 4, pull = !sv.paidAt && sv.t < 0.5 ? Math.sin(Math.min(1, sv.t / 0.5) * Math.PI) : 0;
  ctx.fillStyle = '#c9c4d6'; ctx.fillRect(lx, top + 30 + pull * 22, 3, 26 - pull * 10);
  ctx.fillStyle = '#ff6b6b'; ctx.fillRect(lx - 2, top + 26 + pull * 22, 7, 7);
  // 퍼펙트: 창 둘레로 빛
  if (perfect) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(SLOT_X, wy + wh / 2, 10, SLOT_X, wy + wh / 2, 90);
    g.addColorStop(0, `rgba(255,210,87,${0.25 + 0.15 * Math.sin(clock * 10)})`); g.addColorStop(1, 'rgba(255,210,87,0)');
    ctx.fillStyle = g; ctx.fillRect(SLOT_X - 90, wy - 50, 180, 140);
  }
  ctx.restore();
}

function updateDungeon(dt) {
  if (!dv) beginDungeonView();
  const st = stats(), run = S.dg.run;
  knight.down = Math.max(0, knight.down - dt);
  switch (dv.sub) {
    case 'warpOut':
      if ((dv.t += dt) >= WARP_SEC) {
        clearTowerFx();
        Object.assign(knight, { x: toWorld(DG_KX - 40), facing: 1 });
        warpKnight('in');
        dv.sub = 'stand';
        showBanner('⛏️ 재료의 미궁', '#c9a7ff');
      }
      break;
    case 'stand':
      if (!run) { dgViewEnd(); break; }
      if (towerWalk(DG_KX, WALK_SPEED * 1.6, dt) === false) break;
      knight.facing = 1;
      if (run.fight) {
        if (!run.fight.spawned) dgSpawn(run.fight);
        dv.sub = 'fight';
      } else if (run.slot && !run.slot.paid) { beginSlot(run.slot); dv.sub = 'slot'; dv.t = 0; }
      else dgNextBoss();
      break;
    case 'fight':
      if (!run) { dgViewEnd(); break; }
      fightTick(dt, st, () => {
        if (monsters.some((m) => !m.dying)) { knight.x += WALK_SPEED * dt; knight.walkT += dt; return; }
        const res = dgBossCleared();
        dgShow(res);
        if (!S.dg.run) { dgViewEnd(); return; }
        beginSlot(S.dg.run.slot);
        dv.sub = 'slot'; dv.t = 0;
        save();
      });
      break;
    case 'slot':
      if (!run) { dgViewEnd(); break; }
      knight.facing = 1;
      updateSlot(dt);
      break;
    case 'walkOut':
      // 오른쪽으로 걸어 나가 빛에 싸였다가 다음 보스 앞 왼쪽에 나타난다
      dv.t += dt;
      if (!knight.warp) { knight.x += WALK_SPEED * 1.6 * dt; knight.walkT += dt; }
      if (dv.t > 0.7 && !knight.warp) warpKnight('out');
      if (knight.warp && knight.warp.dir === 'out' && knight.warp.t >= WARP_SEC) {
        clearTowerFx();
        monsters = [];
        Object.assign(knight, { x: toWorld(DG_KX - 40), facing: 1 });
        warpKnight('in');
        dv.sub = 'stand';
      }
      break;
    case 'home':
      dv.t += dt;
      if (dv.t >= dv.hold && !knight.warp) warpKnight('out');
      if (knight.warp && knight.warp.dir === 'out' && knight.warp.t >= WARP_SEC) {
        const res = dv.res;
        clearTowerFx();
        monsters = [];
        endDungeonView();
        S.phase = 'camp';
        Object.assign(knight, { x: toWorld(CAMP_X), facing: 1, down: 0, fighting: false });
        warpKnight('in');
        hooks.onDungeonEnd(res);
        save();
      }
      break;
  }
}

// 던전 바닥: 어두운 돌바닥 + 벽 횃불
function drawDungeonGround() {
  const gy = groundY();
  ctx.fillStyle = 'rgba(20, 16, 28, 0.55)';
  ctx.fillRect(0, gy - 70, W, 70);
  ctx.fillStyle = 'rgba(70, 64, 82, 0.95)';
  ctx.fillRect(0, gy, W, 3);
  ctx.fillStyle = 'rgba(40, 36, 50, 0.9)';
  ctx.fillRect(0, gy + 3, W, H - gy - 3);
  ctx.fillStyle = 'rgba(90, 84, 104, 0.5)';
  for (let x = (clock * 0) % 24; x < W; x += 24) ctx.fillRect(Math.round(x), gy + 4, 1, H - gy - 4);
  for (let x = 60; x < W; x += 260) {
    const fl = 0.75 + 0.25 * Math.sin(clock * 9 + x);
    const glow = ctx.createRadialGradient(x, gy - 48, 1, x, gy - 48, 34);
    glow.addColorStop(0, `rgba(255,160,60,${0.35 * fl})`);
    glow.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 34, gy - 82, 68, 68);
    ctx.fillStyle = '#5a4630'; ctx.fillRect(x - 1, gy - 46, 3, 10);
    ctx.fillStyle = fl > 0.9 ? '#ffe066' : '#ff9f1c'; ctx.fillRect(x - 2, gy - 52, 5, 6);
  }
}

function update(dt) {
  // 큰 타격 순간엔 화면 전체를 아주 잠깐 멈춘다 (히트스톱)
  if (hitstop > 0) { hitstop -= dt; return; }
  clock += dt;
  const gdt = dt * TIME_SCALE;
  advanceBuild(gdt);

  knight.flash = Math.max(0, knight.flash - dt);
  knight.recoil = Math.max(0, (knight.recoil || 0) - dt * 6);
  if (knight.warp && (knight.warp.t += dt) >= WARP_SEC && knight.warp.dir === 'in') knight.warp = null;
  shake = Math.max(0, shake - dt);
  if (knight.swing >= 0) {
    // 평타 한 번은 0.38초 (치켜들기 → 내려치기 → 여운). 공속이 빨라 공격 간격이 더 짧으면 모션도 그만큼 빨라진다
    knight.swing += dt * Math.max(2.6, stats().aspd * 1.25);
    if (knight.swing >= 1) knight.swing = -1;
  }

  if (dv && S.phase !== 'dungeon') endDungeonView();      // 절전·불러오기로 던전이 정산된 뒤
  if (S.phase === 'expedition') updateExpedition(dt, gdt);
  else if (S.phase === 'returning') updateReturning(dt);
  else if (S.phase === 'tower') updateTower(dt, gdt);
  else if (S.phase === 'dungeon') { updateDungeon(dt); advanceCamp(gdt); }
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
    if (sh.m.dying || (S.phase !== 'expedition' && S.phase !== 'tower' && S.phase !== 'dungeon' && S.phase !== 'test')) { sh.done = true; continue; }   // test: 개발용 테스트 페이지(dev/skills.html)
    const tx = toScreen(sh.m.x), ty = monsterMidY(sh.m);
    const dx = tx - sh.x, dy = ty - sh.y, dist = Math.hypot(dx, dy);
    const step = sh.w.arrow.speed * dt;
    sh.trail.push([sh.x, sh.y]);
    if (sh.trail.length > 8) sh.trail.shift();
    if (dist <= step) {
      hitMonster(sh.m, sh.mult);
      // 화염 계열: 맞은 자리 주변의 다른 적도 splash 배율로 (원정에서만 — 결투·레이드는 상대가 하나라 상관없다)
      const sp = sh.w.splash;
      if (sp) {
        for (const o of monsters) if (o !== sh.m && !o.dying && Math.abs(toScreen(o.x) - tx) <= sp.radius) hitMonster(o, sh.mult * sp.mult, { kb: 6, color: sh.w.arrow.color });
        burst(tx, ty, 10, [sh.w.arrow.color, '#ffe066', '#ffffff'], 90, 2, 120);
        effects.push({ type: 'ring', x: tx, y: groundY() - 2, t: 0, color: sh.w.arrow.color });
      }
      sh.done = true; continue;
    }
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
  updateDrops(dt);
  updateSlotFx(dt);

  if (banner) { banner.t += dt; if (banner.t > 2.2) banner = null; }
  updateShout(dt);
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
  if (dgInside()) { drawDungeonGround(); return; }
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
    // 🌑 심연의 균열
    case 'rift': {
      const f = 0.5 + 0.5 * Math.sin(clock * 3 + r * 20);
      box('#120c20', -4, 1, 22, 2);
      box(`rgba(125, 249, 255, ${0.35 + f * 0.5})`, 2, 1, 10, 1);
      box(`rgba(125, 249, 255, ${f * 0.6})`, 6, 3 + Math.round(f * 3), 2, 1);
      break;
    }
    case 'obsidian': {
      const h = 10 + Math.round(r * 6);
      box('#2a1d40', 0, h, 4, h);
      box('#3a2a55', 4, h - 4, 3, h - 4);
      box('#8a6fb8', 1, h - 1, 1, 3);
      break;
    }
    // ☁️ 천공의 섬
    case 'cloud':
      box('rgba(255, 255, 255, 0.85)', 0, 5, 22, 5);
      box('rgba(255, 255, 255, 0.85)', 4, 9, 10, 4);
      box('rgba(190, 214, 240, 0.8)', 0, 1, 22, 1);
      break;
    case 'floatrock': {
      const y = 22 + Math.round(Math.sin(clock * 1.5 + r * 10) * 2);
      box('#8a7a6a', 0, y, 10, 3);
      box('#6a5a4a', 2, y - 3, 6, 2);
      box('rgba(88, 170, 70, 0.9)', 0, y + 1, 10, 1);
      break;
    }
    // 🏜️ 모래폭풍 사막
    case 'cactus': {
      const h = 14 + Math.round(r * 6);
      box('#4a8a3a', 4, h, 4, h);
      box('#4a8a3a', 0, h - 4, 2, 6);
      box('#4a8a3a', 0, h - 8, 4, 2);
      box('#4a8a3a', 10, h - 2, 2, 5);
      box('#4a8a3a', 8, h - 5, 4, 2);
      box('#6aaa4a', 5, h, 1, h - 2);
      break;
    }
    case 'bones':
      box('#e9e4d4', 0, 5, 6, 4);
      box('#1b1d27', 1, 4, 1, 1);
      box('#1b1d27', 3, 4, 1, 1);
      box('#d8ccb0', 8, 2, 8, 2);
      break;
    case 'dune':
      box('rgba(222, 186, 116, 0.9)', 0, 3, 26, 3);
      box('rgba(222, 186, 116, 0.9)', 6, 5, 12, 2);
      break;
    // 🌊 심해 신전
    case 'coral':
      box('#ff8fb1', 4, 12, 3, 12);
      box('#ff8fb1', 0, 9, 2, 6);
      box('#ff8fb1', 0, 9, 5, 2);
      box('#ff8fb1', 9, 8, 2, 5);
      box('#ff8fb1', 6, 6, 5, 2);
      box('#ffc0d0', 4, 12, 3, 1);
      break;
    case 'kelp': {
      const h = 18 + Math.round(r * 8);
      for (let y = 0; y < h; y += 3) box('#2f8a5a', Math.round(Math.sin(clock * 2 + y * 0.3 + r * 10) * 2), y + 3, 2, 3);
      break;
    }
    case 'bubble': {
      const t = (clock * 0.6 + r) % 1;
      box('#3a6a8a', 0, 3, 10, 3);
      box('rgba(180, 230, 255, 0.7)', 3 + Math.round(Math.sin(t * 9) * 2), 6 + Math.round(t * 30), 2, 2);
      box('rgba(180, 230, 255, 0.5)', 6, 6 + Math.round(((t + 0.5) % 1) * 30), 1, 1);
      break;
    }
    // 🍄 요정의 숲
    case 'glowcap': {
      const f = 0.5 + 0.5 * Math.sin(clock * 2 + r * 20);
      box('#e0f0ff', 3, 6, 2, 6);
      box(`rgba(110, 170, 255, ${0.7 + f * 0.3})`, 0, 9, 8, 3);
      box(`rgba(200, 240, 255, ${f * 0.8})`, 2, 9, 2, 1);
      break;
    }
    case 'firefly':
      for (let i = 0; i < 3; i++) {
        const a = clock * 0.8 + r * 10 + i * 2.1;
        box(`rgba(220, 255, 140, ${0.4 + 0.6 * Math.max(0, Math.sin(a * 2.3))})`, i * 7 + Math.round(Math.sin(a) * 3), 14 + i * 4 + Math.round(Math.cos(a * 1.3) * 3), 2, 2);
      }
      break;
    case 'fern':
      box('#3d8b5a', 4, 10, 2, 10);
      box('#5fbf7a', 0, 8, 4, 2);
      box('#5fbf7a', 6, 6, 4, 2);
      box('#5fbf7a', 1, 4, 3, 2);
      break;
    // ⚙️ 고대 기계 유적
    case 'gear':
      box('#6a5e4e', 1, 7, 12, 7);
      box('#6a5e4e', 5, 10, 4, 3);
      box('#6a5e4e', -1, 5, 2, 3);
      box('#6a5e4e', 13, 5, 2, 3);
      box('#8a7a62', 2, 7, 10, 1);
      box('#3a342c', 5, 4, 4, 2);
      break;
    case 'pillar': {
      const h = 14 + Math.round(r * 10);
      box('#8a8070', 0, h, 8, h);
      box('#a89c88', -1, 3, 10, 3);
      box('#6a6050', 5, h, 3, 3);
      box('#6a6050', 2, h - 6, 1, 4);
      break;
    }
    case 'spark': {
      const on = Math.sin(clock * 7 + r * 30) > 0.6;
      box('#5a5e6a', 0, 4, 16, 4);
      box('#3a3d48', 6, 6, 4, 6);
      if (on) { box('#5ad1ff', 7, 9, 2, 2); box('#bff0ff', 9, 11, 1, 1); }
      break;
    }
    // 💎 수정 동굴
    case 'cluster': {
      const h = 10 + Math.round(r * 6);
      box('#9f7ae8', 3, h, 4, h);
      box('#c06bff', 0, h - 5, 3, h - 5);
      box('#7ab8ff', 7, h - 3, 3, h - 3);
      box('#ffe0f8', 4, h - 1, 1, 3);
      break;
    }
    case 'gem': {
      const f = Math.max(0, Math.sin(clock * 4 + r * 20));
      box('#ff8fe0', 0, 3, 4, 3);
      box('#9fe8ff', 6, 2, 3, 2);
      if (f > 0.7) { box('#ffffff', 1, 6, 1, 3); box('#ffffff', 0, 5, 3, 1); }
      break;
    }
    // ⚡ 폭풍의 봉우리
    case 'rod': {
      const on = Math.sin(clock * 6 + r * 30) > 0.8;
      box('#5a6070', 3, 24, 2, 24);
      box('#8a90a0', 2, 25, 4, 2);
      if (on) { box('#ffe066', 2, 29, 2, 3); box('#ffe066', 4, 27, 2, 2); box('#fff8c0', 3, 26, 1, 1); }
      break;
    }
    case 'crag':
      box('#4a5062', 0, 6, 16, 6);
      box('#4a5062', 2, 10, 5, 4);
      box('#4a5062', 8, 15, 4, 9);
      box('#4a5062', 12, 9, 3, 3);
      box('#6a7290', 8, 15, 1, 6);
      box('#6a7290', 2, 10, 1, 3);
      break;
    case 'gust': {
      const t = (clock * 0.9 + r) % 1;
      box(`rgba(220, 230, 255, ${0.5 * Math.sin(t * Math.PI)})`, -Math.round(t * 30), 12 + Math.round(r * 10), 14, 1);
      box(`rgba(220, 230, 255, ${0.35 * Math.sin(t * Math.PI)})`, 6 - Math.round(t * 30), 8 + Math.round(r * 10), 10, 1);
      break;
    }
    // 🌌 별의 끝
    case 'star': {
      const f = 0.5 + 0.5 * Math.sin(clock * 3 + r * 40);
      const y = 18 + Math.round(r * 16);
      box(`rgba(255, 243, 160, ${0.3 + f * 0.7})`, 0, y, 2, 2);
      if (f > 0.8) { box('rgba(255, 243, 160, 0.6)', -2, y - 1, 6, 1); box('rgba(255, 243, 160, 0.6)', 1, y + 2, 1, 6); }
      break;
    }
    case 'meteor':
      box('#3a3050', 0, 6, 12, 6);
      box('#5a4a78', 2, 8, 6, 2);
      box('#ff9f6a', 8, 3, 2, 1);
      box('#ff9f6a', 3, 2, 1, 1);
      break;
    case 'nebula': {
      const f = 0.5 + 0.5 * Math.sin(clock * 1.2 + r * 10);
      box(`rgba(192, 107, 255, ${0.25 + f * 0.2})`, -4, 2, 28, 2);
      box(`rgba(90, 209, 255, ${0.2 + (1 - f) * 0.2})`, 4, 3, 14, 1);
      break;
    }
  }
}

function drawCamp() {
  if (dgInside()) return;
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

function drawBow(g, w, hx, hy, pull, arrow = true) {
  const r = w.size;
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = w.wood; g.lineWidth = 3;
  g.beginPath(); g.moveTo(hx, hy - r); g.quadraticCurveTo(hx + r * 0.75, hy, hx, hy + r); g.stroke();
  g.strokeStyle = w.glow || 'rgba(255,255,255,0.85)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(hx, hy - r); g.lineTo(hx - pull, hy); g.lineTo(hx, hy + r); g.stroke();
  if (pull > 0 && arrow) {
    g.fillStyle = w.arrow.color;
    g.fillRect(hx - pull, hy - 0.75, 18, 1.5);
    g.beginPath(); g.moveTo(hx - pull + 18, hy - 2.5); g.lineTo(hx - pull + 22, hy); g.lineTo(hx - pull + 18, hy + 2.5); g.fill();
  }
  g.restore();
}

// 마법사 지팡이: 손(hx, hy)에서 ang 방향으로 자루가 뻗고 끝에 마력 구슬. 자루 아래쪽도 손 뒤로 조금 나온다.
// charge(0~13, 활의 시위 당김 자리)만큼 구슬이 커지고 빛난다. w.staff = { len 칸, wood, head 장식색, orb 구슬색, glowRgb }
const staffAngle = (bowA) => -1.25 + bowA * 1.6;      // 평소엔 앞으로 비스듬히 세워 들고, bowA 가 음수면 더 치켜든다
function drawStaff(g, w, hx, hy, ang, charge = 0) {
  const st = w.staff, L = st.len * PX, back = 3 * PX;
  g.save();
  g.translate(hx, hy); g.rotate(ang);
  g.fillStyle = st.wood; g.fillRect(-back, -PX / 2, L + back, PX);                  // 자루
  g.fillStyle = st.head; g.fillRect(L - PX, -PX * 1.5, PX, PX * 3);                // 머리 장식 (갈래)
  g.fillRect(L, -PX * 1.5, PX * 1.5, PX * 0.7); g.fillRect(L, PX * 0.8, PX * 1.5, PX * 0.7);
  const k = Math.min(1, charge / 12), R = PX * (1.1 + 0.9 * k), ox = L + PX * 1.6;
  g.shadowColor = st.orb; g.shadowBlur = 6 + 10 * k;
  g.fillStyle = st.orb; g.fillRect(Math.round(ox - R), Math.round(-R), Math.round(R * 2), Math.round(R * 2));
  g.fillStyle = '#ffffff'; g.fillRect(Math.round(ox - R * 0.4), Math.round(-R * 0.6), Math.max(1, Math.round(R * 0.6)), Math.max(1, Math.round(R * 0.6)));
  if (k > 0.05) {
    g.shadowBlur = 0;
    g.fillStyle = `rgba(${st.glowRgb},${0.25 * k})`;
    g.beginPath(); g.arc(ox, 0, R * 2.6, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

// ───────────────────────── 평타 모션 ─────────────────────────
// 무기만 돌리지 않고 팔과 몸이 같이 움직인다: 예비동작(감속) → 잠깐 멈춤 → 타격(가속, 몸이 앞으로 실림) → 여운 → 제자리.
// 직업(무기)마다 모션이 다르고, 전직할수록 커지고 화려해진다:
//   기본(견습) 한 가지 동작 · 1차 두 동작을 번갈아 치는 연속기 · 2차 큰 동작 연속기 + 타격 순간 섬광
// 타격 판정은 근접 s=0.35, 활 s=0.45 (updateExpedition) 라서 무기가 그 무렵 앞을 지나가도록 키를 잡는다.
// 키: s 진행도 · h 앞손 [x, y] (기본 손 자리에서 칸 단위로 옮김) · wa 무기 각도 · dx 몸 앞으로(px) · skew 기울임 · sy 세로 늘림
//     lift 뛰어오름(px) · b·wb 뒷손과 뒷손 칼(쌍검) · ext 창 내밀기 · pull 시위 · bowA 활 기울기
//     e 이 키로 들어가는 구간의 이징: o 감속(예비동작·여운) · i 가속(타격 시작) · l 일정(타격 끝) · 없으면 부드럽게
// 모션: keys · trail·btrail 무기 끝(뒷손 칼) 잔상 구간 · burst [시점, 'r,g,b', 크기] 무기 끝(활은 활 앞) 섬광
//       charge [시작, 끝, 'r,g,b'] 시위 당기는 손에 모이는 마력
// HERO_ATK[무기 id] 는 모션 배열 — 평타마다 차례로 돌아가며 쓴다
const SWORD_REST = { h: [0, 0], wa: -1.0, dx: 0, skew: 0, sy: 1, lift: 0 };
const POLE_REST = { h: [0, 0], wa: -1.3, ext: 0, dx: 0, skew: 0, sy: 1, lift: 0 };
const BOW_REST = { h: [0, 0], bowA: 0, pull: 0, dx: 0, skew: 0, sy: 1, lift: 0 };
const atkKeys = (rest, ...mid) => [{ s: 0, ...rest }, ...mid.map((k) => ({ ...rest, ...k })), { s: 1, ...rest }];
const HERO_ATK = {
  // ── 견습 기사: 어깨높이에서 투박하게 내려친다 ──
  sword: [
    { trail: [0.27, 0.52], keys: atkKeys(SWORD_REST,
      { s: 0.2,  h: [-1.5, -3.5], wa: -2.1, dx: -1,  skew: -0.06, sy: 1.02, e: 'o' },
      { s: 0.27, h: [-1.6, -3.6], wa: -2.2, dx: -1,  skew: -0.07, sy: 1.02 },
      { s: 0.37, h: [1, 0.5],     wa: 0.55, dx: 2.5, skew: 0.1,   sy: 0.96, e: 'i' },
      { s: 0.56, h: [0.5, 1],     wa: 0.85, dx: 2,   skew: 0.08,  sy: 0.97, e: 'o' }) },
  ],
  // ── 검사: 머리 위에서 내려베기 ↔ 아래에서 올려베기 ──
  knightSword: [
    { trail: [0.24, 0.56], keys: atkKeys(SWORD_REST,
      { s: 0.18, h: [-1, -6],     wa: -2.5,  dx: -2,   skew: -0.12, sy: 1.05, e: 'o' },
      { s: 0.24, h: [-1.2, -6.2], wa: -2.65, dx: -2.5, skew: -0.14, sy: 1.05 },
      { s: 0.3,  h: [1.5, -4.5],  wa: -1.1,  dx: 2,    skew: 0.05,  sy: 1,    e: 'i' },
      { s: 0.36, h: [1.5, 0],     wa: 0.75,  dx: 5,    skew: 0.2,   sy: 0.92, e: 'l' },
      { s: 0.52, h: [1, 1],       wa: 1.1,   dx: 4,    skew: 0.15,  sy: 0.96, e: 'o' }) },
    { trail: [0.24, 0.56], keys: atkKeys(SWORD_REST,
      { s: 0.18, h: [-2.2, 1.5],  wa: 2.5,  dx: -2,   skew: -0.1,  sy: 0.94, e: 'o' },
      { s: 0.24, h: [-2.4, 1.6],  wa: 2.6,  dx: -2.5, skew: -0.12, sy: 0.93 },
      { s: 0.3,  h: [0.5, 1.5],   wa: 0.6,  dx: 2,    skew: 0.08,  sy: 0.98, e: 'i' },
      { s: 0.36, h: [1.5, -2.5],  wa: -1.4, dx: 5,    skew: 0.18,  sy: 1.05, e: 'l' },
      { s: 0.52, h: [1, -3.5],    wa: -1.9, dx: 4,    skew: 0.12,  sy: 1.03, e: 'o' }) },
  ],
  // ── 성기사: 뛰어올라 성검을 내리꽂기 ↔ 크게 올려베기, 타격마다 황금 섬광 ──
  holySword: [
    { trail: [0.26, 0.58], burst: [0.35, '255,215,90', 1.2], keys: atkKeys(SWORD_REST,
      { s: 0.2,  h: [-1.2, -6.5], wa: -2.8, dx: -3,   skew: -0.16, sy: 1.07, e: 'o' },
      { s: 0.26, h: [-1.3, -6.7], wa: -2.9, dx: -3.5, skew: -0.18, sy: 1.08, lift: 3 },
      { s: 0.31, h: [1.5, -5],    wa: -1.2, dx: 2,    skew: 0.06,  sy: 1,    lift: 5, e: 'i' },
      { s: 0.36, h: [2, 0.5],     wa: 1.0,  dx: 7,    skew: 0.26,  sy: 0.86, e: 'l' },
      { s: 0.58, h: [1.5, 1],     wa: 1.15, dx: 6,    skew: 0.2,   sy: 0.92, e: 'o' }) },
    { trail: [0.24, 0.58], burst: [0.35, '255,215,90', 1], keys: atkKeys(SWORD_REST,
      { s: 0.18, h: [-2.5, 1.5],  wa: 2.7,  dx: -3,   skew: -0.14, sy: 0.9,  e: 'o' },
      { s: 0.24, h: [-2.6, 1.6],  wa: 2.75, dx: -3.5, skew: -0.16, sy: 0.88 },
      { s: 0.3,  h: [0.5, 1.5],   wa: 0.6,  dx: 3,    skew: 0.1,   sy: 0.98, e: 'i' },
      { s: 0.36, h: [1.5, -3.5],  wa: -1.6, dx: 7,    skew: 0.2,   sy: 1.08, lift: 5, e: 'l' },
      { s: 0.56, h: [1, -4.5],    wa: -2.1, dx: 6,    skew: 0.12,  sy: 1.04, lift: 2, e: 'o' }) },
  ],
  // ── 검성: 앞손 내려베기 → 뒷손 올려베기 ↔ 두 칼을 함께 X자로 교차해 베기, 붉은 섬광 ──
  dualBlades: [
    { trail: [0.21, 0.46], btrail: [0.36, 0.64], burst: [0.34, '255,70,70', 0.9], keys: atkKeys({ ...SWORD_REST, b: [0, 0], wb: -0.6 },
      { s: 0.16, h: [-1, -5.8],   wa: -2.45, b: [-2, 0],     wb: 2.3,  dx: -1,   skew: -0.1,  sy: 1.03, e: 'o' },
      { s: 0.21, h: [-1.2, -6],   wa: -2.55, b: [-2.2, 0],   wb: 2.4,  dx: -1.5, skew: -0.12, sy: 1.03 },
      { s: 0.27, h: [1.5, -4],    wa: -1.0,  b: [-2.2, 0.3], wb: 2.4,  dx: 2,    skew: 0.05,  sy: 1,    e: 'i' },
      { s: 0.34, h: [1.5, 0.5],   wa: 0.8,   b: [-2, 0.5],   wb: 2.4,  dx: 5,    skew: 0.2,   sy: 0.93, e: 'l' },
      { s: 0.42, h: [1, 1.5],     wa: 1.2,   b: [0.5, -1],   wb: 0.4,  dx: 6,    skew: 0.16,  sy: 0.98, e: 'i' },
      { s: 0.5,  h: [0.5, 1.5],   wa: 1.25,  b: [1, -3],     wb: -1.3, dx: 6,    skew: 0.12,  sy: 1.03, e: 'l' },
      { s: 0.62, h: [0.3, 1],     wa: 1.0,   b: [0.8, -2.5], wb: -1.1, dx: 4,    skew: 0.08,  sy: 1,    e: 'o' }) },
    { trail: [0.24, 0.52], btrail: [0.24, 0.52], burst: [0.35, '255,70,70', 1.2], keys: atkKeys({ ...SWORD_REST, b: [0, 0], wb: -0.6 },
      { s: 0.18, h: [-1, -6],     wa: -2.5, b: [2.5, -6],  wb: -0.8, dx: -2,   skew: -0.12, sy: 1.06, e: 'o' },
      { s: 0.24, h: [-1.2, -6.2], wa: -2.6, b: [2.6, -6.2], wb: -0.7, dx: -2.5, skew: -0.14, sy: 1.07, lift: 2 },
      { s: 0.36, h: [1.5, 0.5],   wa: 0.9,  b: [0, 1.5],   wb: 2.3,  dx: 7,    skew: 0.24,  sy: 0.88, e: 'i' },
      { s: 0.56, h: [1, 1],       wa: 1.1,  b: [0, 1.5],   wb: 2.4,  dx: 6,    skew: 0.18,  sy: 0.92, e: 'o' }) },
  ],
  // ── 창기사: 가슴높이 찌르기 ↔ 위에서 아래로 내려찌르기 (창대가 손 사이로 미끄러져 나간다) ──
  spear: [
    { trail: [0.28, 0.6], keys: atkKeys(POLE_REST,
      { s: 0.22, h: [-2.5, -1.5], wa: -0.15, ext: -2, dx: -3,   skew: -0.14, sy: 0.93, e: 'o' },
      { s: 0.28, h: [-2.7, -1.5], wa: -0.12, ext: -3, dx: -3.5, skew: -0.16, sy: 0.92 },
      { s: 0.36, h: [1.5, -1],    wa: -0.04, ext: 7,  dx: 6,    skew: 0.22,  sy: 1,    e: 'i' },
      { s: 0.54, h: [1, -0.7],    wa: -0.04, ext: 5,  dx: 5,    skew: 0.18,  sy: 0.98, e: 'o' }) },
    { trail: [0.28, 0.6], keys: atkKeys(POLE_REST,
      { s: 0.22, h: [-1.5, -4],   wa: -0.55, ext: -3, dx: -2,   skew: -0.1,  sy: 1.04, e: 'o' },
      { s: 0.28, h: [-1.7, -4.2], wa: -0.5,  ext: -4, dx: -2.5, skew: -0.12, sy: 1.05 },
      { s: 0.36, h: [1.5, -1.5],  wa: 0.3,   ext: 7,  dx: 6,    skew: 0.24,  sy: 0.92, e: 'i' },
      { s: 0.54, h: [1, -1],      wa: 0.3,   ext: 5,  dx: 5,    skew: 0.18,  sy: 0.95, e: 'o' }) },
  ],
  // ── 용기병: 창을 한 바퀴 돌려 눕힌 뒤 두 번 연달아 찌르기 ↔ 뛰어올라 내리꽂기, 보라 섬광 ──
  dragonSpear: [
    { trail: [0.28, 0.62], burst: [0.36, '190,150,255', 1], keys: atkKeys({ ...POLE_REST, wa: -1.3 },
      { s: 0.2,  h: [-1.5, -3],   wa: -6.43, ext: -2, dx: -3,   skew: -0.14, sy: 0.95, e: 'o' },
      { s: 0.27, h: [-2.7, -1.5], wa: -6.41, ext: -3, dx: -4,   skew: -0.18, sy: 0.9 },
      { s: 0.35, h: [2, -1.2],    wa: -6.32, ext: 10, dx: 8,    skew: 0.26,  sy: 1,    e: 'i' },
      { s: 0.41, h: [1, -1],      wa: -6.32, ext: 3,  dx: 7,    skew: 0.2,   sy: 0.97, e: 'o' },
      { s: 0.47, h: [2, -1.2],    wa: -6.32, ext: 11, dx: 9,    skew: 0.26,  sy: 1,    e: 'i' },
      { s: 0.64, h: [1, -0.7],    wa: -6.32, ext: 5,  dx: 6,    skew: 0.18,  sy: 0.98, e: 'o' },
      { s: 0.999, wa: -7.58 }) },
    { trail: [0.27, 0.6], burst: [0.36, '190,150,255', 1.3], keys: atkKeys(POLE_REST,
      { s: 0.18, h: [-1, -5],     wa: -1.0, ext: -3, dx: -2, skew: -0.1,  sy: 0.88, e: 'o' },
      { s: 0.27, h: [-1.2, -5.5], wa: -0.6, ext: -4, dx: 0,  skew: -0.08, sy: 1.08, lift: 12 },
      { s: 0.36, h: [1.5, -1],    wa: 0.65, ext: 9,  dx: 8,  skew: 0.26,  sy: 0.86, lift: 0, e: 'i' },
      { s: 0.58, h: [1, -0.5],    wa: 0.6,  ext: 6,  dx: 7,  skew: 0.2,   sy: 0.92, e: 'o' }) },
  ],
  // ── 할버디어: 머리 뒤까지 넘겨 내려찍기 ↔ 아래에서 뛰어오르며 퍼올리기, 주황 섬광 ──
  halberd: [
    { trail: [0.25, 0.6], burst: [0.37, '255,150,60', 1.3], keys: atkKeys({ ...POLE_REST, wa: -1.35 },
      { s: 0.2,  h: [-1, -5.8],   wa: -2.75, dx: -3,   skew: -0.16, sy: 1.05, e: 'o' },
      { s: 0.25, h: [-1.2, -6],   wa: -2.85, dx: -3.5, skew: -0.18, sy: 1.05 },
      { s: 0.31, h: [1, -4.5],    wa: -1.4,  dx: 1,    skew: 0,     sy: 1,    e: 'i' },
      { s: 0.38, h: [1.5, 0.5],   wa: 0.55,  dx: 6,    skew: 0.24,  sy: 0.88, e: 'l' },
      { s: 0.56, h: [0.5, 1.5],   wa: 0.95,  dx: 5,    skew: 0.18,  sy: 0.92, e: 'o' }) },
    { trail: [0.25, 0.6], burst: [0.36, '255,150,60', 1.1], keys: atkKeys({ ...POLE_REST, wa: -1.35 },
      { s: 0.2,  h: [-2, 1.5],    wa: 2.7,  dx: -3,   skew: -0.14, sy: 0.9,  e: 'o' },
      { s: 0.25, h: [-2.2, 1.6],  wa: 2.8,  dx: -3.5, skew: -0.16, sy: 0.88 },
      { s: 0.3,  h: [0.5, 1.5],   wa: 0.7,  dx: 2,    skew: 0.06,  sy: 0.98, e: 'i' },
      { s: 0.37, h: [1.5, -3],    wa: -1.3, dx: 6,    skew: 0.2,   sy: 1.08, lift: 7, e: 'l' },
      { s: 0.58, h: [1, -4],      wa: -1.9, dx: 5,    skew: 0.12,  sy: 1.04, lift: 2, e: 'o' }) },
  ],
  // ── 레인저: 가슴높이로 당겨 쏘기 ↔ 허리춤에서 몸을 숙여 재빨리 쏘기 ──
  bow: [
    { keys: atkKeys(BOW_REST,
      { s: 0.14, h: [0.5, -2.5], bowA: -0.1,  pull: 2, dx: 0,  skew: -0.03, e: 'o' },
      { s: 0.44, h: [0.5, -2.7], bowA: -0.06, pull: 9, dx: -1, skew: -0.08, sy: 1.02 },
      { s: 0.47, h: [0, -3],     bowA: -0.3,  pull: 0, dx: -3, skew: -0.12, e: 'o' },
      { s: 0.7,  h: [0.2, -2.4], bowA: -0.12, pull: 0, dx: -2, skew: -0.05, e: 'o' }) },
    { keys: atkKeys(BOW_REST,
      { s: 0.1,  h: [1, -0.5],   bowA: 0.05, pull: 3, dx: 2,  skew: 0.12, sy: 0.93, e: 'o' },
      { s: 0.44, h: [1, -0.6],   bowA: 0.03, pull: 7, dx: 2,  skew: 0.14, sy: 0.92 },
      { s: 0.47, h: [0.5, -1],   bowA: -0.2, pull: 0, dx: -1, skew: 0.02, sy: 0.96, e: 'o' },
      { s: 0.7,  h: [0.6, -0.8], bowA: -0.05, pull: 0, dx: 0, skew: 0.04, sy: 0.98, e: 'o' }) },
  ],
  // ── 저격수: 서서 끝까지 당겨 쏘기 ↔ 무릎 꿇고 조준해 쏘기, 놓는 순간 하얀 섬광과 큰 반동 ──
  longbow: [
    { burst: [0.45, '255,255,220', 1], keys: atkKeys(BOW_REST,
      { s: 0.16, h: [0.5, -3],   bowA: -0.08, pull: 4,  dx: -1, skew: -0.06, sy: 1.02, e: 'o' },
      { s: 0.44, h: [0.6, -3.1], bowA: -0.04, pull: 13, dx: -2, skew: -0.12, sy: 1.03 },
      { s: 0.47, h: [-0.5, -3.5], bowA: -0.4, pull: 0,  dx: -6, skew: -0.18, e: 'o' },
      { s: 0.72, h: [0, -2.8],   bowA: -0.15, pull: 0,  dx: -4, skew: -0.08, e: 'o' }) },
    { burst: [0.45, '255,255,220', 1], keys: atkKeys(BOW_REST,
      { s: 0.16, h: [0.5, -0.5], bowA: -0.05, pull: 4,  dx: -1, skew: 0.02,  sy: 0.84, e: 'o' },
      { s: 0.44, h: [0.6, -0.6], bowA: -0.03, pull: 13, dx: -1, skew: -0.04, sy: 0.83 },
      { s: 0.47, h: [-0.5, -1],  bowA: -0.35, pull: 0,  dx: -5, skew: -0.14, sy: 0.86, e: 'o' },
      { s: 0.72, h: [0, -0.6],   bowA: -0.12, pull: 0,  dx: -3, skew: -0.06, sy: 0.88, e: 'o' }) },
  ],
  // ── 마궁수: 몸이 떠오르며 시위에 마력을 모아 쏘기 ↔ 활을 머리 위로 치켜들어 쏘기, 청록 마력·섬광 ──
  arcaneBow: [
    { charge: [0.1, 0.45, '111,243,255'], burst: [0.45, '111,243,255', 1.1], keys: atkKeys(BOW_REST,
      { s: 0.16, h: [0.5, -3],   bowA: -0.12, pull: 3,  dx: 0,  skew: -0.04, sy: 1.03, lift: 4, e: 'o' },
      { s: 0.44, h: [0.6, -3.2], bowA: -0.1,  pull: 10, dx: -1, skew: -0.08, sy: 1.04, lift: 6 },
      { s: 0.47, h: [0, -3.5],   bowA: -0.35, pull: 0,  dx: -3, skew: -0.12, sy: 1,    lift: 6, e: 'o' },
      { s: 0.75, h: [0.2, -2.6], bowA: -0.12, pull: 0,  dx: -2, skew: -0.05, lift: 2,  e: 'o' }) },
    { charge: [0.1, 0.45, '111,243,255'], burst: [0.45, '111,243,255', 1.3], keys: atkKeys(BOW_REST,
      { s: 0.16, h: [0, -5.5],   bowA: -0.55, pull: 3,  dx: -1, skew: -0.1,  sy: 1.06, lift: 2, e: 'o' },
      { s: 0.44, h: [0, -5.7],   bowA: -0.5,  pull: 10, dx: -2, skew: -0.14, sy: 1.07, lift: 3 },
      { s: 0.47, h: [-0.5, -6],  bowA: -0.75, pull: 0,  dx: -4, skew: -0.18, sy: 1.04, lift: 3, e: 'o' },
      { s: 0.75, h: [0, -4.5],   bowA: -0.4,  pull: 0,  dx: -2, skew: -0.08, lift: 1,  e: 'o' }) },
  ],
  // ── 마법사: 지팡이를 치켜들었다가(bowA 음수) 앞으로 내뻗으며(bowA 양수) 쏜다. pull 은 지팡이 끝에 모이는 마력 ──
  wand: [
    { burst: [0.45, '159,216,255', 0.9], keys: atkKeys(BOW_REST,
      { s: 0.2,  h: [-0.5, -1.5], bowA: -0.45, pull: 5,  dx: -1, skew: -0.06, sy: 1.02, e: 'o' },
      { s: 0.4,  h: [-0.6, -1.6], bowA: -0.5,  pull: 9,  dx: -1, skew: -0.08, sy: 1.03 },
      { s: 0.47, h: [1.5, -0.5],  bowA: 0.35,  pull: 0,  dx: 3,  skew: 0.1,   sy: 0.97, e: 'i' },
      { s: 0.72, h: [0.8, -0.3],  bowA: 0.15,  pull: 0,  dx: 1,  skew: 0.04,  e: 'o' }) },
    { burst: [0.45, '159,216,255', 1], keys: atkKeys(BOW_REST,
      { s: 0.2,  h: [-1, -3.5],   bowA: -0.95, pull: 5,  dx: -1, skew: -0.1,  sy: 1.04, e: 'o' },
      { s: 0.4,  h: [-1, -3.7],   bowA: -1.0,  pull: 10, dx: -1, skew: -0.12, sy: 1.05 },
      { s: 0.47, h: [1.2, 0],     bowA: 0.3,   pull: 0,  dx: 3,  skew: 0.12,  sy: 0.95, e: 'i' },
      { s: 0.72, h: [0.6, -0.2],  bowA: 0.1,   pull: 0,  dx: 1,  skew: 0.05,  e: 'o' }) },
  ],
  // ── 화염술사: 몸을 뒤로 젖혀 불을 크게 모았다가 내던진다 ↔ 지팡이를 머리 위에서 돌려 내려찍듯 던진다 ──
  flameStaff: [
    { charge: [0.1, 0.45, '255,140,60'], burst: [0.45, '255,140,60', 1.3], keys: atkKeys(BOW_REST,
      { s: 0.2,  h: [-1.5, -2.5], bowA: -0.7,  pull: 6,  dx: -3, skew: -0.14, sy: 1.04, e: 'o' },
      { s: 0.42, h: [-1.7, -2.8], bowA: -0.8,  pull: 13, dx: -4, skew: -0.18, sy: 1.05 },
      { s: 0.47, h: [2, -0.5],    bowA: 0.4,   pull: 0,  dx: 4,  skew: 0.16,  sy: 0.95, e: 'i' },
      { s: 0.75, h: [1, -0.3],    bowA: 0.15,  pull: 0,  dx: 2,  skew: 0.06,  e: 'o' }) },
    { charge: [0.1, 0.45, '255,140,60'], burst: [0.45, '255,190,90', 1.5], keys: atkKeys(BOW_REST,
      { s: 0.2,  h: [0, -5],      bowA: -1.3,  pull: 7,  dx: -1, skew: -0.1,  sy: 1.06, lift: 3, e: 'o' },
      { s: 0.42, h: [-0.5, -5.3], bowA: -1.5,  pull: 13, dx: -2, skew: -0.14, sy: 1.07, lift: 4 },
      { s: 0.47, h: [1.8, 0.5],   bowA: 0.45,  pull: 0,  dx: 4,  skew: 0.18,  sy: 0.92, lift: 0, e: 'i' },
      { s: 0.75, h: [0.8, 0],     bowA: 0.15,  pull: 0,  dx: 2,  skew: 0.06,  e: 'o' }) },
  ],
  // ── 빙결술사: 짧게 겨눠 빠르게 쏜다 ↔ 지팡이를 앞으로 곧게 뻗어 얼음창을 날린다, 청백 섬광 ──
  frostStaff: [
    { charge: [0.12, 0.44, '159,232,255'], burst: [0.45, '200,245,255', 1.1], keys: atkKeys(BOW_REST,
      { s: 0.22, h: [0, -2],      bowA: -0.3,  pull: 6,  dx: -1, skew: -0.05, sy: 1.02, e: 'o' },
      { s: 0.42, h: [0, -2.1],    bowA: -0.25, pull: 12, dx: -1, skew: -0.06, sy: 1.02 },
      { s: 0.47, h: [2, -1.5],    bowA: 0.05,  pull: 0,  dx: 3,  skew: 0.08,  e: 'i' },
      { s: 0.7,  h: [1, -1],      bowA: 0,     pull: 0,  dx: 1,  e: 'o' }) },
    { charge: [0.12, 0.44, '159,232,255'], burst: [0.45, '255,255,255', 1.3], keys: atkKeys(BOW_REST,
      { s: 0.22, h: [-1, -3],     bowA: -0.6,  pull: 6,  dx: -2, skew: -0.1,  sy: 1.04, lift: 2, e: 'o' },
      { s: 0.42, h: [-1.2, -3.2], bowA: -0.65, pull: 12, dx: -2, skew: -0.12, sy: 1.05, lift: 3 },
      { s: 0.47, h: [2.5, -2],    bowA: -0.05, pull: 0,  dx: 5,  skew: 0.12,  sy: 0.97, lift: 1, e: 'i' },
      { s: 0.72, h: [1.2, -1.2],  bowA: 0,     pull: 0,  dx: 2,  skew: 0.04,  e: 'o' }) },
  ],
};
// 3차 무기의 평타는 2차 무기의 연속기를 그대로 쓴다 (무기 생김새·색만 다르다)
Object.assign(HERO_ATK, {
  starBlade: HERO_ATK.holySword, moonBlades: HERO_ATK.dualBlades, wyrmSpear: HERO_ATK.dragonSpear,
  doomAxe: HERO_ATK.halberd, sunBow: HERO_ATK.longbow, voidBow: HERO_ATK.arcaneBow,
  infernoStaff: HERO_ATK.flameStaff, glacierStaff: HERO_ATK.frostStaff,
});
const ATK_EASE = { o: (u) => 1 - (1 - u) ** 3, i: (u) => u * u, l: (u) => u };
for (const id in WEAPONS) WEAPONS[id].id = id;
// 이 무기의 n 번째 평타 모션 (연속기는 차례로 돈다)
const heroAtkOf = (w, n = 0) => {
  const list = HERO_ATK[w.id] || HERO_ATK.sword;
  return list[(n || 0) % list.length];
};

// 진행도 s 의 평타 자세 (키 사이를 섞는다). mo 는 돌려주는 자세에 실어 잔상·섬광이 같은 모션을 쓰게 한다
function heroAtk(mo, s) {
  const keys = mo.keys;
  let i = 1;
  while (i < keys.length - 1 && keys[i].s < s) i++;
  const a = keys[i - 1], b = keys[i];
  const v = Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s)));
  const u = b.e ? ATK_EASE[b.e](v) : v * v * (3 - 2 * v);
  const out = { s, mo };
  for (const k in a) {
    if (k === 's' || k === 'e') continue;
    out[k] = Array.isArray(a[k]) ? a[k].map((x, j) => x + (b[k][j] - x) * u) : a[k] + (b[k] - a[k]) * u;
  }
  return out;
}

// 몸의 뼈대: 어깨(몸통 9번째 줄 양쪽)와 손. 무기는 손에서 나가고, 팔은 어깨에서 손까지 잇는다.
// atk(평타 자세)가 있으면 그 손 위치·무기 각도를 쓰고, 없으면 기본 손 자리에 스킬 자세(pose.wa 등)나 평소 각도
function heroRig(w, x, bodyBottom, pose, atk) {
  const sy = pose.sy || 1, k = pose.skew || 0;
  const shY = bodyBottom - 5 * PX * sy, shX = x + k * 4.5 * PX * sy;
  const hx = x + 4 * PX + Math.round(k * 3 * PX), hy = bodyBottom - 3 * PX;
  const off = atk ? atk.h : [0, 0];
  const r = { fs: [shX + 1.5 * PX, shY], bs: [shX - 1.5 * PX, shY] };
  const wob = pose.mode === 'walk' ? Math.sin((pose.walkT || 0) * 8) * 0.08 : 0;
  if (w.kind === 'ranged') {
    r.fh = [hx + PX + off[0] * PX, hy + off[1] * PX];
    r.bowA = atk ? atk.bowA : pose.bowA || 0;
    r.pull = atk ? atk.pull : pose.pull || 0;
    r.arrow = !atk || atk.s < 0.45;                          // 놓은 뒤엔 화살이 날아가고 없다
    // 지팡이(마법사)는 한 손으로 쥔다: bowA 는 지팡이를 치켜든 각도, pull 은 지팡이 끝에 모이는 마력
    if (w.staff) { r.grip = r.fh; return r; }
    // 활은 줌통(활대 가운데)을 쥐고, 시위 당기는 손은 시위 가운데 — 둘 다 활 기울기를 따라 돈다
    const c = Math.cos(r.bowA), sn = Math.sin(r.bowA), gx = w.size * 0.375;
    r.grip = [r.fh[0] + gx * c, r.fh[1] + gx * sn];
    if (r.pull > 1) r.bh = [r.fh[0] - r.pull * c, r.fh[1] - r.pull * sn];
    return r;
  }
  r.fh = [hx + off[0] * PX, hy + off[1] * PX];
  const rest = w.motion === 'thrust' ? -1.3 : w.motion === 'sweep' ? -1.35 : -1.0;
  r.wa = atk ? atk.wa : pose.wa != null ? pose.wa : rest + wob;
  r.ext = atk ? atk.ext || 0 : pose.wa != null ? pose.ext || 0 : 0;
  if (w.motion === 'dual') {
    const bo = atk ? atk.b : [0, 0];
    r.bh = [hx - 3 * PX + bo[0] * PX, hy + PX + bo[1] * PX];
    r.wb = atk ? atk.wb : pose.wa != null ? (pose.wa2 != null ? pose.wa2 : pose.wa + 0.5) : -0.6 + wob;
  } else if (w.motion === 'thrust' || w.motion === 'sweep') {
    // 양손 무기: 뒷손은 앞손보다 창대 아래쪽을 쥔다 (창이 미끄러져 나가면 같이 밀려 나간다)
    const d = r.ext - 2.5 * PX;
    r.bh = [r.fh[0] + Math.cos(r.wa) * d, r.fh[1] + Math.sin(r.wa) * d];
  }
  return r;
}

// 팔: 어깨에서 손까지 도트 한 칸 굵기로 잇는다 (한 경로로 채워서 반투명일 때 겹친 곳이 진해지지 않게)
function drawArm(g, col, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (PX * 0.5)));
  g.fillStyle = col;
  g.beginPath();
  for (let i = 0; i <= n; i++) g.rect(Math.round(a[0] + (dx * i) / n - PX / 2), Math.round(a[1] + (dy * i) / n - PX / 2), PX, PX);
  g.fill();
}
function drawFist(g, col, p) {
  g.fillStyle = col;
  g.fillRect(Math.round(p[0] - 2), Math.round(p[1] - 2), 4, 4);
}
// 팔 색: 몸통 어깨 줄의 바깥 테두리 색(팔)과 그 안쪽 색(주먹)
const heroArmCache = {};
function heroArmCols(id, look, pal) {
  if (heroArmCache[id]) return heroArmCache[id];
  const row = look.body[8], i = row.search(/[^.]/);
  return (heroArmCache[id] = [pal[row[i]] || PAL.a, pal[row[i + 1]] || PAL.A]);
}

// 무기 끝 잔상: 지난 몇 프레임의 무기 끝을 이어 띠로 그린다 (창은 끝이 지나간 직선)
// base: 평타로 뛰어오르기 전의 발밑 높이
function drawAtkTrail(g, w, x0, base, legsH, mo, s, back) {
  const win = back ? mo.btrail : mo.trail;
  if (!win || s < win[0] || s > win[1]) return;
  const pole = w.motion === 'thrust' || w.motion === 'sweep';
  const from = Math.max(win[0], s - 0.12), n = 6, pts = [];
  for (let i = 0; i <= n; i++) {
    const a = heroAtk(mo, from + ((s - from) * i) / n);
    const r = heroRig(w, x0 + Math.round(a.dx), base - a.lift - legsH * a.sy, a, a);
    const hand = back ? r.bh : r.fh, ang = back ? r.wb : r.wa;
    const c = Math.cos(ang), sn = Math.sin(ang);
    const out = pole ? r.ext + (w.len + 3) * PX : (back ? w.len : w.len + 1.5) * PX, inn = pole ? r.ext + w.len * 0.7 * PX : out * 0.6;
    pts.push([hand[0] + c * out, hand[1] + sn * out, hand[0] + c * inn, hand[1] + sn * inn]);
  }
  const fade = 1 - (s - win[0]) / (win[1] - win[0]);
  if (w.motion === 'thrust') {
    // 찌르기: 창끝이 지나온 직선을 창 방향으로 조금 더 길게
    const p = pts[0], q = pts[n], d = Math.hypot(q[0] - q[2], q[1] - q[3]) || 1;
    const ux = (q[0] - q[2]) / d, uy = (q[1] - q[3]) / d;
    g.strokeStyle = `rgba(${w.trail},${0.8 * fade})`;
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(Math.min(p[0], q[0]) - ux * 14, q[1] - uy * 14 - 1); g.lineTo(q[0], q[1] - 1); g.stroke();
    return;
  }
  for (let i = 1; i <= n; i++) {
    const p = pts[i - 1], q = pts[i];
    g.fillStyle = `rgba(${w.trail},${0.45 * fade * (i / n)})`;
    g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.lineTo(q[2], q[3]); g.lineTo(p[2], p[3]); g.closePath(); g.fill();
  }
}

// 2차 직업 평타의 타격 섬광(무기 끝, 활은 활 앞)과 마궁수가 시위에 모으는 마력
function drawAtkFx(g, w, r, atk) {
  const mo = atk.mo, s = atk.s;
  g.save();
  g.globalCompositeOperation = 'lighter';
  if (mo.charge && s >= mo.charge[0] && s < mo.charge[1] && r.bh) {
    const u = (s - mo.charge[0]) / (mo.charge[1] - mo.charge[0]);
    g.fillStyle = `rgba(${mo.charge[2]},${0.25 + 0.35 * u})`;
    g.beginPath(); g.arc(r.bh[0], r.bh[1], 2 + 4 * u, 0, Math.PI * 2); g.fill();
    g.fillStyle = `rgba(255,255,255,${0.5 * u})`;
    g.beginPath(); g.arc(r.bh[0], r.bh[1], 1 + 1.5 * u, 0, Math.PI * 2); g.fill();
  }
  const [at, col, size] = mo.burst || [];
  if (at != null && s >= at && s < at + 0.16) {
    const u = (s - at) / 0.16, k = 1 - u;
    let px, py;
    if (w.staff) {
      const L = (w.staff.len + 1.6) * PX, ang = staffAngle(r.bowA);
      px = r.fh[0] + Math.cos(ang) * L; py = r.fh[1] + Math.sin(ang) * L;
    } else if (w.kind === 'ranged') {
      const L = w.size * 0.375 + 6;
      px = r.fh[0] + Math.cos(r.bowA) * L; py = r.fh[1] + Math.sin(r.bowA) * L;
    } else {
      const pole = w.motion === 'thrust' || w.motion === 'sweep';
      const L = pole ? r.ext + (w.len + 3) * PX : (w.len + 1) * PX;
      px = r.fh[0] + Math.cos(r.wa) * L; py = r.fh[1] + Math.sin(r.wa) * L;
    }
    const R = (6 + 14 * easeOutQ(u)) * size;
    g.strokeStyle = `rgba(${col},${0.8 * k})`;
    g.lineWidth = 2;
    g.beginPath(); g.arc(px, py, R * 0.7, 0, Math.PI * 2); g.stroke();
    g.fillStyle = `rgba(255,255,255,${0.9 * k})`;
    for (let i = 0; i < 4; i++) {                                     // 십자로 뻗는 빛살
      const a = i * Math.PI / 2 + Math.PI / 4 * (i % 2 ? 0.2 : 0), len = R * (i % 2 ? 0.8 : 1.2);
      g.save(); g.translate(px, py); g.rotate(a); g.fillRect(0, -1, len, 2); g.restore();
    }
    g.fillStyle = `rgba(${col},${0.6 * k})`;
    g.beginPath(); g.arc(px, py, 3 * size * (1 + u), 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
const easeOutQ = (u) => 1 - (1 - u) * (1 - u);

// 손에 든 무기 (쌍검의 뒷손 칼은 몸 뒤라 drawHero 가 따로 그린다)
function drawWeapon(g, w, r) {
  g.save();
  if (w.glow) { g.shadowColor = w.glow; g.shadowBlur = 8; }
  if (w.staff) {
    drawStaff(g, w, r.fh[0], r.fh[1], staffAngle(r.bowA), r.pull);
  } else if (w.kind === 'ranged') {
    g.translate(r.fh[0], r.fh[1]); g.rotate(r.bowA); g.translate(-r.fh[0], -r.fh[1]);
    drawBow(g, w, r.fh[0], r.fh[1], r.pull, r.arrow);
  } else if (w.motion === 'thrust' || w.motion === 'sweep') {
    drawPole(g, w, r.fh[0] + Math.cos(r.wa) * r.ext, r.fh[1] + Math.sin(r.wa) * r.ext, r.wa);
  } else {
    drawBlade(g, w, r.fh[0], r.fh[1], r.wa);
  }
  g.restore();
}

// 캠프에서 쉬는 동안 무기는 옆에 세워 둔다
function drawRestingWeapon(g, w, x, gy) {
  if (w.staff) { drawStaff(g, w, x - 2, gy - 2, -Math.PI / 2 - 0.08, 0); return; }
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
  // 평타 중이면 몸(dx·skew·sy)과 손·무기를 평타 자세로 (스킬 자세가 있으면 스킬이 우선)
  // combo: 몇 번째 평타인지 — 연속기 직업은 이걸로 모션을 번갈아 고른다
  const atk = pose.mode === 'fight' && pose.swing >= 0 && pose.wa == null && pose.pull == null ? heroAtk(heroAtkOf(w, pose.combo), pose.swing) : null;
  const base0 = gy - (pose.lift || 0);
  if (atk) pose = { ...pose, dx: (pose.dx || 0) + atk.dx, skew: atk.skew, sy: atk.sy, lift: (pose.lift || 0) + atk.lift };
  g.save();
  g.globalAlpha *= pose.alpha == null ? 1 : pose.alpha;
  if (pose.facing < 0) { g.translate(x, 0); g.scale(-1, 1); g.translate(-x, 0); }
  const x0 = x;
  x += Math.round(pose.dx || 0);          // 스킬 돌진·평타 디딤 (바라보는 쪽으로)

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
    const rig = heroRig(w, x, bodyBottom, pose, atk);
    const body = !pose.onlyWeapon, weapon = !pose.tint;      // onlyWeapon: 모션 잔상용으로 무기만 · tint: 한 색 잔상은 몸만
    const [armC, fistC] = opt.flash ? ['#ffffff', '#ffffff'] : opt.tint ? [opt.tint, opt.tint] : heroArmCols(c === CLASSES[id] ? id : 'squire', look, pal);
    const dual = w.motion === 'dual' && w.kind !== 'ranged';
    if (body && look.cape) drawCape(g, look.cape, x, top, bodyBottom, base, t, walking || pose.mode === 'fight' || pose.wa != null);
    // 몸 뒤: 뒷팔 (쌍검은 뒷손 칼까지)
    if (body && rig.bh) drawArm(g, armC, rig.bs, rig.bh);
    if (dual) {
      if (weapon) {
        g.save();
        if (w.glow) { g.shadowColor = w.glow; g.shadowBlur = 8; }
        drawBlade(g, w, rig.bh[0], rig.bh[1], rig.wb, w.len - 1);
        g.restore();
        if (atk) drawAtkTrail(g, w, x0, base0, legs.length * PX, atk.mo, atk.s, true);
      }
      if (body) drawFist(g, fistC, rig.bh);
    }
    if (body) {
      drawSprite(legs, pal, x, base, PX, { ...opt, sx, sy }, g);
      drawSprite(look.body, pal, x, bodyBottom, PX, { ...opt, sx, sy, skew: pose.skew || 0 }, g);
      if (look.shield) drawShield(g, look.shield, x - 4 * PX, bodyBottom - 4 * PX);
      if (look.halo) drawHalo(g, x, top, t);
    }
    // 몸 앞: 무기 → 잔상 → 무기를 쥔 손과 앞팔
    if (weapon) {
      drawWeapon(g, w, rig);
      if (atk) { drawAtkTrail(g, w, x0, base0, legs.length * PX, atk.mo, atk.s, false); drawAtkFx(g, w, rig, atk); }
    }
    if (body) {
      if (rig.bh && !dual) drawFist(g, fistC, rig.bh);
      const hand = rig.grip || rig.fh;
      drawArm(g, armC, rig.fs, hand);
      drawFist(g, fistC, hand);
    }
  }
  g.restore();
}

function drawKnight() {
  const x = toScreen(knight.x) - Math.round((knight.recoil || 0) * 3);
  const gy = groundY();
  const sp = castPose('hero');
  const lift = sp ? sp.lift || 0 : 0;
  // 순간이동: 빛기둥이 솟았다 걷히는 동안 기사가 흐려지거나(out) 짙어진다(in)
  const wp = knight.warp, wk = wp ? Math.min(1, wp.t / WARP_SEC) : 0;
  const vis = !wp ? 1 : wp.dir === 'out' ? 1 - wk : wk;
  if (wp && wk < 1) drawWarpBeam(x, gy, Math.sin(wk * Math.PI));
  if (vis <= 0) return;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  const shadowW = Math.max(6, 28 - lift * 0.3);
  ctx.fillRect(x + (sp ? (sp.dx || 0) * (sp.facing || knight.facing) : 0) - shadowW / 2, gy - 1, shadowW, 2);

  const pose = {
    // 캠프에선 앉아 있지만, 스킬 탭 「비주얼 확인」으로 시전 중이면 일어나서 쓴다
    mode: S.phase === 'camp' ? (sp ? 'fight' : 'sit') : knight.fighting ? 'fight' : 'walk',
    walkT: knight.walkT, swing: knight.swing, combo: knight.combo, facing: knight.facing, t: clock,
    flash: knight.flash > 0,
    alpha: (knight.down > 0 ? 0.35 + 0.25 * Math.sin(clock * 12) : 1) * vis,
  };
  if (sp) Object.assign(pose, sp, { alpha: pose.alpha * (sp.alpha == null ? 1 : sp.alpha) });
  if (sp) drawCastTrail('hero', S.cls, gy, knight.facing);
  drawHero(ctx, S.cls, x, gy, pose);
  if (S.phase !== 'camp' && !wp) {
    drawHpBar(x, gy - 58 - Math.min(lift, 40), 30, S.hp / stats().maxHp, '#ff5a5a');
    drawSkillIcons(x - 15, gy - 58 - Math.min(lift, 40) - 12);
  }
}

// 순간이동 빛기둥 (a: 0~1 세기)
function drawWarpBeam(x, gy, a) {
  if (a <= 0) return;
  const w = Math.round(6 + 14 * a), h = 70;
  const gr = ctx.createLinearGradient(0, gy - h, 0, gy);
  gr.addColorStop(0, 'rgba(201,167,255,0)');
  gr.addColorStop(1, `rgba(201,167,255,${0.55 * a})`);
  ctx.fillStyle = gr;
  ctx.fillRect(x - w / 2, gy - h, w, h);
  ctx.fillStyle = `rgba(255,255,255,${0.7 * a})`;
  ctx.fillRect(x - 1, gy - h * 0.8, 2, h * 0.8);
  ctx.fillRect(x - w / 2 - 2, gy - 2, w + 4, 2);
}

function drawShots() {
  for (const sh of shots) {
    if (sh.delay > 0) continue;
    const a = sh.w.arrow;
    if (a.shape === 'ice') {
      // 얼음창: 뾰족한 결정이 날아가고 뒤로 서리 가루
      sh.trail.forEach(([tx, ty], i) => { ctx.fillStyle = `rgba(${a.rgb},${((i + 1) / sh.trail.length) * 0.4})`; ctx.fillRect(tx - 1, ty - 1, 2, 2); });
      ctx.save();
      ctx.translate(sh.x, sh.y); ctx.rotate(sh.a);
      ctx.shadowColor = a.color; ctx.shadowBlur = 8;
      ctx.fillStyle = a.color;
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-3, -3); ctx.lineTo(-9, 0); ctx.lineTo(-3, 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-4, -1, 8, 1);
      ctx.restore();
      continue;
    }
    if (a.magic) {
      // 마력탄 (rgb: 꼬리 색, size: 크기 — 화염탄은 크고 붉다)
      const rgb = a.rgb || '111,243,255', z = a.size || 1;
      sh.trail.forEach(([tx, ty], i) => {
        ctx.fillStyle = `rgba(${rgb},${((i + 1) / sh.trail.length) * 0.5})`;
        ctx.fillRect(tx - 1.5, ty - 1.5, 3, 3);
      });
      ctx.save();
      ctx.shadowColor = a.color; ctx.shadowBlur = 10;
      ctx.fillStyle = a.color; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(sh.x, sh.y, 4 * z, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(sh.x, sh.y, 2.5 * z, 0, Math.PI * 2); ctx.fill();
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
  n = Math.max(1, Math.round(n * fxVis));            // 스킬 연출 중이면 숙련 단계의 세기만큼 (src/skills.js fxVis)
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

  // 탑 광폭화: 붉은 기운이 맥박처럼 번진다
  const rage = m.rage > 1 && !m.dying ? `drop-shadow(0 0 ${2 + Math.sin(clock * 10) * 1.5 + Math.min(3, Math.log2(m.rage))}px #ff2a2a)` : '';
  if (hue || rage) ctx.filter = `${hue ? `hue-rotate(${hue}deg)` : ''} ${rage}`.trim();
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
    ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';     // add: 빛나는 불꽃 (겹치면 더 밝아진다)
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
}

function drawFx() {
  drawFloaters(false);

  for (const c of coins) {
    ctx.fillStyle = '#b8860b'; ctx.fillRect(Math.round(c.x) - 3, Math.round(c.y) - 3, 6, 6);
    ctx.fillStyle = '#ffd257'; ctx.fillRect(Math.round(c.x) - 2, Math.round(c.y) - 3, 4, 5);
  }
  drawDropsTop();

  if (banner) {
    const a = banner.t < 0.3 ? banner.t / 0.3 : banner.t > 1.8 ? (2.2 - banner.t) / 0.4 : 1;
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = 'bold 20px -apple-system, sans-serif';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    // 결투 중엔 두 기사 사이, 레이드 중엔 파티와 보스 사이, 탑 안에 있으면 탑 바로 왼쪽
    const cx = duelPlay ? duelPlay.x0 + duelPlay.res.fight.start / 2 : raidPlay ? raidPlay.x0 + raidPlay.f.start * 0.55
      : towerInside() ? W - TOWER_W - 130 : toScreen(knight.x) + 40;
    const bx = Math.min(W - 60, Math.max(60, cx)), by = groundY() - 78;
    ctx.strokeText(banner.text, bx, by);
    ctx.fillStyle = banner.color;
    ctx.fillText(banner.text, bx, by);
    ctx.globalAlpha = 1;
  }
  drawShout();
}
// 떠오르는 글자. tw: 탑 안에서 생긴 글자(탑 캔버스의 층 좌표)만 / 아니면 하단바 글자만
function drawFloaters(tw) {
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  for (const f of floaters) {
    if (!!f.tw !== tw) continue;
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, f.t - 0.6) / 0.5);
    const popK = f.pop && f.t < 0.16 ? 1 + 0.7 * (1 - f.t / 0.16) : 1;
    ctx.font = `bold ${Math.round(f.size * popK)}px -apple-system, sans-serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
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
        cls: who.cls, lv: e.sl, star: e.ss,
        onHit: (i, n) => {
          d.hit[target] = clock;
          if (i === n - 1) addFloater((e.crit ? '💥' : '') + fmt(e.dmg), duelX(target, duelTime()) + rand(-8, 8), groundY() - 76, e.crit ? '#ffb13b' : CLASSES[who.cls].look.fx, 18, true);
        },
     }, true);
      continue;
    }
    d.last[e.by] = { e, at: clock, n: (d.last[e.by] ? d.last[e.by].n : 0) + 1 };
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
      walkT: pt, swing: !loser && since < 0.16 ? 0.35 + since * 4 : -1, combo: L ? L.n : 0,
      facing: side === 'a' ? 1 : -1, t: clock, lift,
      flash: d.hit[side] != null && clock - d.hit[side] < 0.08,
      alpha: loser ? 0.45 : alpha,
    };
    if (sp) Object.assign(pose, sp, { alpha: alpha * (sp.alpha == null ? 1 : sp.alpha) });
    if (sp) drawCastTrail(`duel-${side}`, who.cls, gy, side === 'a' ? 1 : -1);
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
// 광역기·강타(b: 'smash')에 맞은 기사는 날아가 기절했다가(e.x 맞은 뒤 위치, e.st 남은 기절 시간) 다시 달려 들어온다 (d.kb).
// 보스 기술이 터지는 순간엔 잠깐 멈췄다가(stopUntil) 느리게 재생해서(slowUntil) 맞고 날아가는 게 눈에 보이게 한다
let raidPlay = null;          // { res, f, t0, pt, speed, shown, x0, hpB, hpK, last, hitK, bossHit, act, dead, doneAt, onEnd, fx, wind, windIdx, dark, kb, warn, flash, slowUntil, slowRate, stopUntil }
const RAID_PLAY_SEC = 24;     // 긴 레이드도 대략 이 시간 안에 재생되도록 빨리 감는다 (보스 기술 때 느려지는 시간은 따로)
const RAID_HOLD_SEC = 3;      // 결판이 난 뒤 결과를 보여 주는 시간
const RAID_ENTER_SEC = 0.8;   // 보스가 나타나는 시간
const RAID_WIND_SEC = 1.0;    // 광역기 전에 기를 모으는 시간(실제 초) — 이동안 바닥에 위험 구역이 깜빡인다
const RAID_WARN_SEC = 0.6;    // 강타 전에 노리는 기사 발밑에 표적이 뜨는 시간(실제 초)
const RAID_KB_SEC = 0.35;     // 맞고 날아가는 시간(실제 초)
const RAID_BOSS_LEFT = 30;    // 보스 몸 왼쪽 끝 = 보스 위치 - 30 (server/raid.js 의 BOSS_HALF)

const raidActive = () => !!raidPlay;
// 레이드 보스 또는 월드 보스(res.world) — 둘 다 같은 모양의 연출 항목을 가진다
const raidDef = (id) => RAID_BOSSES[id] || WORLD_BOSSES[id];
// 결판 배너. 월드 보스는 혼자 30초 동안 피해를 넣는 도전이라 '실패'가 아니라 넣은 피해를 보여 준다
function raidEndBanner(d) {
  const f = d.f;
  if (d.res.world) {
    if (f.won) return showBanner(`👑 ${raidDef(f.boss).name} 처치!`, '#ffd257');
    return showBanner(`${f.timeout ? '⏳' : '💀'} 피해 ${fmt(d.res.dealt)}`, f.timeout ? '#ffd257' : '#ff8080');
  }
  showBanner(f.won ? '👑 RAID CLEAR!' : f.timeout ? '⏳ TIME OVER' : '💀 RAID FAILED', f.won ? '#ffd257' : '#ff8080');
}
function playRaid(res, onEnd) {
  const f = res.fight;
  raidPlay = {
    res, f, onEnd, t0: clock, speed: Math.max(1, f.dur / RAID_PLAY_SEC), shown: 0, x0: CAMP_X + 60,
    // 월드 보스는 모두가 함께 깎던 체력(이번 도전 전 남은 체력)에서 시작한다
    hpB: res.world ? res.hp + res.dealt : f.maxB, hpK: f.knights.map((k) => k.max), last: {}, hitK: {}, bossHit: -1, act: null, dead: {}, doneAt: null,
    fx: [], wind: 0, windIdx: -1, dark: 0, pt: 0, kb: {}, warn: null, flash: null, slowUntil: 0, slowRate: 1, stopUntil: 0,
  };
  showBanner(res.world ? `🌍 월드 보스 ${raidDef(f.boss).name}!` : `⚔️ ${RAID_BOSSES[f.boss].name} 레이드!`, res.world ? '#c06bff' : '#ff9f1c');
}
const raidTime = () => raidPlay.pt;
// 재생 시각을 흘린다: 평소엔 speed 배, 보스 기술 직후엔 느리게, 터지는 순간엔 잠깐 멈춤
function advanceRaidTime(dt) {
  const d = raidPlay;
  if (clock - d.t0 < RAID_ENTER_SEC || clock < d.stopUntil) return;
  d.pt = Math.min(d.f.dur, d.pt + dt * (clock < d.slowUntil ? d.slowRate : d.speed));
}
const raidBossX = () => raidPlay.x0 + raidPlay.f.start;
// 처음엔 멈춘 시각·위치로 걸어 들어오는 걸 재현하고 (뒷사람은 gap 만큼 뒤에서 출발),
// 밀려난 뒤로는 맞은 위치에서 기절이 풀릴 때까지 서 있다가 rush 속도로 다시 제자리까지 달려온다
function raidKnightX(i, pt = raidTime()) {
  const d = raidPlay, f = d.f, k = f.knights[i], kb = d.kb[i];
  if (!kb) return d.x0 + Math.min(k.stop.x, -i * f.gap + Math.min(pt, k.stop.t) * f.walk);
  const x = d.x0 + Math.min(Math.max(k.stop.x, kb.x), kb.x + Math.max(0, pt - kb.t - kb.st) * (f.rush || f.walk * 3));
  const u = (clock - kb.at) / RAID_KB_SEC;
  return u < 1 ? lerp(kb.from, x, 1 - (1 - u) * (1 - u)) : x;
}
const raidKbLift = (i) => { const kb = raidPlay.kb[i], u = kb ? (clock - kb.at) / RAID_KB_SEC : 1; return u < 1 ? Math.sin(u * Math.PI) * kb.h : 0; };
const raidStunned = (i, pt = raidTime()) => { const kb = raidPlay.kb[i]; return !!kb && pt < kb.t + kb.st; };
const raidRushing = (i, pt = raidTime()) => {
  const d = raidPlay, kb = d.kb[i];
  return !!kb && pt >= kb.t + kb.st && raidKnightX(i, pt) < d.x0 + d.f.knights[i].stop.x - 0.5;
};
// 기사 i 를 밀쳐 내고 기절시킨다 (t: 기록 시각, x: 밀려난 위치, st: 남은 기절 시간). heavy 는 강타 — 더 높이 날아간다
function raidKnock(i, t, x, st, heavy = false) {
  const d = raidPlay;
  if (x == null || d.dead[i] != null) return;
  const from = raidKnightX(i), gy = groundY(), frost = raidDef(d.f.boss).aoe === 'icicles';
  // 연출은 맞는 순간(기록 시각보다 조금 늦다)부터 센다. 빨리 감기 때문에 기절이 너무 짧게 보이지 않도록 실제 0.6초는 서 있게 한다
  const rate = clock < d.slowUntil ? d.slowRate : d.speed;
  d.kb[i] = { t: Math.max(t, raidTime()), x, st: Math.max(st || 0, (0.6 + 0.06) * rate), from, at: clock, h: heavy ? 30 : 16 };
  if (st >= 0.3) addFloater(frost ? '❄️ 빙결!' : '💫 기절!', from, gy - 80 - (i % 2) * 10, frost ? '#9fe8ff' : '#ffe066', 13, true);
  raidLater(RAID_KB_SEC, () => burst(raidKnightX(i), gy - 2, heavy ? 10 : 6, ['#c9b38a', '#8a7a5a', '#e8d9a8'], 70, 2, 260));
}
const raidKnightY = () => groundY() - 22;

// 보스 도트 크기·위치. 왼쪽 끝을 보스 위치 - 30 에 맞추고 오른쪽으로 크게 그린다
function raidBossGeom() {
  const def = raidDef(raidPlay.f.boss), rows = SPR[def.spr][0];
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
    raidLater(delayOf(i), () => { raidStrike(i, dmg, e.h[i], colors, big); raidKnock(i, e.t, e.x && e.x[i], e.st && e.st[i]); });
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

// ── 강타: 땅을 타고 충격파가 달려가 맨 앞 기사 발밑에서 터지고, 기사는 멀리 날아가 기절한다 ──
function raidSmash(e, def) {
  const d = raidPlay, g = raidBossGeom(), gy = groundY(), i = e.tg, x0 = g.left + 4, travel = 0.16;
  d.act = { kind: 'lunge', at: clock, dur: 0.35 };
  raidFx(0, travel, (u) => {
    const x = lerp(x0, raidKnightX(i) + 6, u);
    for (let k = 0; k < 6; k++) {
      const h = (10 - k * 1.4) * (1 + Math.sin(clock * 50 + k) * 0.3);
      ctx.fillStyle = k % 2 ? def.fx[1] : def.fx[0];
      ctx.globalAlpha = 0.9 - k * 0.12;
      ctx.fillRect(Math.round(x + k * 7) - 2, Math.round(gy - h), 4, Math.round(h));
    }
    ctx.globalAlpha = 1;
    if (Math.random() < 0.7) parts.push({ x, y: gy - 2, vx: rand(-30, 60), vy: rand(-140, -60), g: 400, size: 3, color: '#8a7a5a', life: 0.35, t: 0 });
  });
  raidLater(travel, () => {
    const ix = raidKnightX(i);
    raidStrike(i, e.d, e.h[i], def.fx.concat('#ffffff'), true);
    raidKnock(i, e.t, e.x, e.st, true);
    shake = Math.max(shake, 0.45);
    d.stopUntil = clock + 0.06;
    d.slowUntil = clock + 0.6; d.slowRate = Math.max(1, d.speed * 0.5);
    d.flash = { at: clock, color: def.fx[0], a: 0.22 };
    for (let k = 0; k < 2; k++) effects.push({ type: 'ring', x: ix + 6, y: gy, t: 0, life: 0.5, size: 1 - k * 0.4, color: def.fx[k] });
    burst(ix + 6, gy - 8, 18, def.fx.concat('#ffffff'), 170, 3, 300);
    // 발밑에서 솟구치는 기둥
    raidFx(0, 0.45, (u) => {
      const h = 80 * Math.min(1, u * 5) * (1 - u * 0.3), w = 22 * (1 - u);
      ctx.globalAlpha = 0.75 * (1 - u);
      ctx.fillStyle = def.fx[0]; ctx.fillRect(Math.round(ix + 6 - w / 2), Math.round(gy - h), Math.round(w), Math.round(h));
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(ix + 6 - w / 6), Math.round(gy - h), Math.round(w / 3), Math.round(h));
      ctx.globalAlpha = 1;
    });
  });
}

function updateRaid(dt) {
  advanceRaidTime(dt);
  const d = raidPlay, f = d.f, pt = raidTime(), gy = groundY();
  const def = raidDef(f.boss), g = raidBossGeom();
  while (d.shown < f.events.length && f.events[d.shown].t <= pt) {
    const e = f.events[d.shown++];
    if (e.k != null && e.s && SKILLS[e.s]) {
      // 스킬 타격: 시전 모션을 재생하고, 보스 체력·피해 숫자는 마지막 타격 순간에 반영한다
      const i = e.k, cls = d.res.members[i].cls;
      d.hpK[i] = e.h;
      startCast(`raid-${i}`, e.s, {
        x: () => raidKnightX(i), dir: 1, tx: () => raidBossGeom().left + 12, ty: () => groundY() - raidBossGeom().h * 0.5,
        cls, lv: e.sl, star: e.ss,
        onHit: (j, n) => {
          d.bossHit = clock;
          if (j < n - 1) return;
          d.hpB = Math.min(d.hpB, e.bh);
          const gg = raidBossGeom();
          addFloater((e.c ? '💥' : '') + fmt(e.d), gg.left + rand(4, 40), gy - gg.h * 0.6 + rand(-10, 10), e.c ? '#ffb13b' : clsOf(cls).look.fx, 18, true);
        },
     }, true);
    } else if (e.k != null) {
      // 기사 타격 (짧은 시간 동안의 타격을 묶은 것)
      d.hpB = e.bh; d.hpK[e.k] = e.h;
      d.last[e.k] = { e, at: clock, n: (d.last[e.k] ? d.last[e.k].n : 0) + 1 };
      if (e.c || e.l) d.bossHit = clock;      // 보스가 하얗게 번쩍이는 건 치명타·도약 때만 (타격은 0.2초마다 묶여 와서 매번 번쩍이면 정신없다)
      // 피해 숫자는 보스 몸 위쪽에 띄운다 (왼쪽 끝은 기사 이름표·체력바와 겹친다)
      addFloater((e.c ? '💥' : '') + fmt(e.d), g.cx + rand(-g.w * 0.25, g.w * 0.25), gy - g.h * 0.75 + rand(-8, 8), e.c ? '#ffb13b' : '#ffffff', e.c || e.l ? 14 : 12);
      if (e.l) effects.push({ type: 'ring', x: g.left + 10, y: gy - 2, t: 0, color: clsOf(d.res.members[e.k].cls).look.fx });
    } else if (e.b === 'hit') {
      RAID_HIT[def.hit](e, def);
    } else if (e.b === 'smash') {
      raidSmash(e, def);
    } else if (e.b === 'aoe') {
      RAID_AOE[def.aoe](e, def);
      d.windIdx = -1;
      d.stopUntil = clock + 0.08;
      d.slowUntil = clock + 1.0; d.slowRate = Math.max(1, d.speed * 0.35);
      d.flash = { at: clock, color: def.fx[0], a: 0.35 };
      shake = Math.max(shake, 0.4);
    } else if (e.die != null) {
      const i = e.die;
      raidLater(0.4, () => { d.dead[i] = clock; addFloater('💀 쓰러짐', raidKnightX(i), gy - 74, '#c9c9c9', 12); });
    }
  }

  // 다음 광역기가 가까우면 기를 모은다 (스킬 이름은 기를 모으기 시작할 때 한 번)
  // 다음 강타가 가까우면 노리는 기사 발밑에 표적을 띄운다
  d.wind = 0; d.warn = null;
  for (let j = d.shown; j < f.events.length; j++) {
    const e = f.events[j], left = (e.t - pt) / d.speed;
    if (left > RAID_WIND_SEC) break;
    if (e.b === 'smash' && !d.warn && left <= RAID_WARN_SEC) d.warn = { i: e.tg, u: 1 - left / RAID_WARN_SEC };
    if (e.b !== 'aoe' || d.wind) continue;
    d.wind = Math.max(0.001, 1 - left / RAID_WIND_SEC);
    if (d.windIdx !== j) {
      d.windIdx = j;
      showBanner(`${def.icon} ${def.skill}!`, def.fx[0]);
    }
    if (Math.random() < 0.7) {
      // 기가 보스에게 빨려 들어간다
      const a = rand(0, Math.PI * 2), r = rand(40, 70);
      parts.push({ x: g.cx + Math.cos(a) * r, y: gy - g.h / 2 + Math.sin(a) * r * 0.6, vx: -Math.cos(a) * r * 2.5, vy: -Math.sin(a) * r * 1.5, g: 0, size: 3, color: def.fx[Math.random() < 0.5 ? 0 : 1], life: 0.35, t: 0 });
    }
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
    raidEndBanner(d);
    if (f.won) {
      burst(g.cx, gy - g.h / 2, 50, def.fx.concat('#ffd257', '#ffffff'), 180, 3, 250);
      for (let i = 0; i < 14; i++) coins.push({ x: g.cx, y: gy - 20, vx: rand(-90, 90), vy: rand(-200, -100), t: 0, fly: false });
    }
    if (!d.res.world) addFloater('👑 MVP', raidKnightX(f.mvp, pt), gy - 88, '#ffd257', 14);
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
  if (raidPlay.doneAt == null) raidEndBanner(raidPlay);
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
  if (d.warn && !(a && u < 1)) { p.dx = 10 * d.warn.u; p.sy += 0.1 * d.warn.u; }
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
  // 광역기 경고: 화면 가장자리가 붉게 물들고, 파티가 선 바닥 전체가 위험 구역으로 깜빡인다
  if (d.wind > 0) {
    const blink = 0.5 + 0.5 * Math.sin(clock * 28), alive = raidAlive();
    const vg = ctx.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, `rgba(255,30,30,${0.28 * d.wind})`); vg.addColorStop(0.35, 'rgba(255,30,30,0)');
    vg.addColorStop(0.75, 'rgba(255,30,30,0)'); vg.addColorStop(1, `rgba(255,30,30,${0.28 * d.wind})`);
    ctx.fillStyle = vg; ctx.fillRect(-10, -10, W + 20, H + 20);
    if (alive.length) {
      const x0 = Math.min(...alive.map((i) => raidKnightX(i))) - 34, x1 = g.left + 6;
      const zg = ctx.createLinearGradient(0, gy - 46, 0, gy);
      zg.addColorStop(0, 'rgba(255,40,40,0)'); zg.addColorStop(1, `rgba(255,40,40,${(0.25 + 0.3 * blink) * d.wind})`);
      ctx.fillStyle = zg; ctx.fillRect(Math.round(x0), gy - 46, Math.round(x1 - x0), 46);
      ctx.fillStyle = `rgba(255,60,60,${(0.5 + 0.5 * blink) * d.wind})`;
      ctx.fillRect(Math.round(x0), gy - 2, Math.round(x1 - x0), 3);
      // 사선 줄무늬 (경고 테이프)
      ctx.fillStyle = `rgba(255,220,80,${0.35 * blink * d.wind})`;
      for (let x = x0 - ((clock * 60) % 16); x < x1; x += 16) if (x >= x0) ctx.fillRect(Math.round(x), gy - 6, 6, 3);
    }
  }
  // 강타 경고: 노리는 기사 발밑에 줄어드는 붉은 표적
  if (d.warn && d.dead[d.warn.i] == null) {
    const x = raidKnightX(d.warn.i), r = 26 - 12 * d.warn.u, on = Math.floor(clock * 16) % 2 === 0;
    ctx.strokeStyle = on ? '#ff3030' : '#ffe066'; ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6 + 0.4 * d.warn.u;
    ctx.beginPath(); ctx.ellipse(x + 2, gy - 1, r, r * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,40,40,0.25)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 2 - r - 4, gy - 1); ctx.lineTo(x + 2 + r + 4, gy - 1); ctx.stroke();
    ctx.globalAlpha = 1;
  }

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
      walkT: pt + i * 0.3, swing: !dead && s < 0.16 ? 0.35 + s * 4 : -1, combo: L ? L.n : 0,
      facing: 1, t: clock, lift: L && L.e.l && s < 0.35 ? (1 - s / 0.35) * 26 : 0,
      flash: d.hitK[i] != null && clock - d.hitK[i] < 0.08,
      alpha: dead ? 0.4 : 1,
    };
    if (sp) Object.assign(pose, sp);
    const stun = !dead && raidStunned(i, pt), kbLift = raidKbLift(i);
    if (!dead && kbLift > 0) Object.assign(pose, { mode: 'fight', swing: -1, lift: kbLift, skew: -0.25 });
    else if (stun) Object.assign(pose, { mode: 'fight', swing: -1, skew: Math.sin(clock * 10) * 0.12 });
    else if (!dead && raidRushing(i, pt)) Object.assign(pose, { mode: 'walk', walkT: clock * 2, swing: -1 });
    if (sp) drawCastTrail(`raid-${i}`, m.cls, gy, 1);
    drawHero(ctx, m.cls, x, gy, pose);
    if (stun) drawRaidStun(x, gy, raidDef(f.boss).aoe === 'icicles', i);
    const wpn = WEAPONS[c.weapon];
    if (!dead && !sp && L && wpn.kind === 'ranged' && s < 0.14) {
      const x0 = x + 16, x1 = g.left + 6, ax = x0 + (x1 - x0) * (s / 0.14);
      ctx.fillStyle = wpn.arrow.color;
      ctx.fillRect(Math.round(ax - 12), gy - 6 * PX, 12, 2);
    }
    // 이름표가 겹치지 않게 번갈아 높이를 다르게 한다
    const top = gy - 58 - (i % 2) * 14;
    drawHpBar(x, top, 26, d.hpK[i] / k.max, me ? '#5fcf5a' : '#7cc4ff');
    label(`${done && !d.res.world && f.mvp === i ? '👑' : c.icon} ${m.nickname}`, x, top - 4, me ? '#ffd257' : '#f3efe6');
  });

  if (d.warn && d.dead[d.warn.i] == null && Math.floor(clock * 12) % 2 === 0) {
    ctx.font = 'bold 18px -apple-system, sans-serif';
    label('❗', raidKnightX(d.warn.i), gy - 84 - (d.warn.i % 2) * 14, '#ff3030');
  }

  // ── 공격 연출 ──
  for (const fx of d.fx) if (fx.draw && clock >= fx.at) fx.draw(fx.life ? Math.min(1, (clock - fx.at) / fx.life) : 1);
  // 보스 기술이 터지는 순간 화면이 번쩍인다
  if (d.flash) {
    const u = (clock - d.flash.at) / 0.18;
    if (u < 1) { ctx.globalAlpha = d.flash.a * (1 - u); ctx.fillStyle = d.flash.color; ctx.fillRect(-10, -10, W + 20, H + 20); ctx.globalAlpha = 1; }
  }
}

// 기절한 기사: 머리 위를 도는 별 (서리 거인에게 맞으면 얼음에 갇힌다)
function drawRaidStun(x, gy, frost, i) {
  if (frost) {
    ctx.globalAlpha = 0.45; ctx.fillStyle = '#9fe8ff'; ctx.fillRect(Math.round(x) - 13, gy - 44, 28, 44);
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(x) - 11, gy - 42, 2, 18); ctx.fillRect(Math.round(x) - 11, gy - 42, 10, 2); ctx.fillRect(Math.round(x) + 9, gy - 20, 2, 12);
    ctx.globalAlpha = 1;
    return;
  }
  for (let k = 0; k < 3; k++) {
    const a = clock * 7 + k * (Math.PI * 2 / 3), sx = x + 2 + Math.cos(a) * 11, sy = gy - 46 + Math.sin(a) * 3;
    const front = Math.sin(a) > 0;
    px(sx, sy, front ? 6 : 4, '#ffe066', front ? 1 : 0.6);
    px(sx - 3, sy, 2, '#ffe066', front ? 1 : 0.6); px(sx + 3, sy, 2, '#ffe066', front ? 1 : 0.6);
    px(sx, sy, 2, '#ffffff', front ? 1 : 0.6);
  }
}

function render() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  // 흔들림 세기는 스킬 타격이 키운다 (shakeAmp, src/skills.js)
  const amp = Math.max(3, shakeAmp);
  if (shake > 0) ctx.translate(Math.round(rand(-amp, amp)), Math.round(rand(-amp * 0.7, amp * 0.7)));
  drawGround();
  drawCamp();
  // 탑 안에 있는 동안 기사·몬스터·이펙트는 탑 캔버스에 그린다 (drawTower)
  if (!towerInside()) drawActors();
  ctx.restore();
  drawScreenFx();
  drawFx();
  drawTower();
}
function drawActors() {
  drawSkillFxBack();                       // 대천사·붉은 달·시간 정지 어둠은 기사·몬스터 뒤에
  drawDropsBack();
  for (const m of monsters) drawMonster(m);
  drawDropsFront();
  drawSlotMachine();
  drawAuras();
  if (duelPlay) drawDuel(); else if (raidPlay) drawRaid(); else drawKnight();
  drawShots();
  drawEffects();
  drawSkillFx();
  drawParts();
  drawSlotFx();
}
