'use strict';
// 필드 전리품 연출: 몬스터가 떨군 상자·비전서가 튀어나와 땅에 떨어지고, 기사가 지나가며 주우면 HUD 🎒 로 날아간다.
// 가방에 넣는 규칙은 core.js rewardKill 이 처치 순간 이미 끝냈다 — 여기는 보이는 것만 (저장·밸런스와 무관).
//
// 한 개의 일생: air(빙글빙글 포물선 → 한 번 튀고 똑바로 앉음) → ground(이름표·광택·빛기둥, 기사를 기다림)
//              → lift(기사 머리 위로 뛰어오름) → hold(좋은 것만 잠깐 들어 보여 줌) → bag(HUD 가방으로 날아가 쏙)
// 등급이 높을수록 더 요란하다 (DROP_TIER). 다만 바탕화면 위에 떠 있는 게임이라 화면 전체를 번쩍이지는 않는다 —
// 빛은 상자 둘레와 빛기둥 안에서만 낸다 (skills.js 머리말과 같은 원칙).

let drops = [];

// 등급별 연출 세기 (GRADES 순서)
//  beam: 빛기둥 0 없음 · 1 낮은 기둥 · 2 하늘까지 / glow: 바닥 빛 / motes: 기둥을 타고 오르는 불티 수
//  rays: 상자 뒤에서 도는 햇살 줄기 수 / wave: 바닥 파동 / hold: 머리 위로 들어 보여 주는 시간(초) / wait: 줍기 전 최소 노출(초)
const DROP_TIER = [
  { beam: 0, glow: 0,    motes: 0,  rays: 0,  wave: 0, hold: 0,    wait: 0.25 },   // 일반
  { beam: 0, glow: 0.45, motes: 0,  rays: 0,  wave: 0, hold: 0,    wait: 0.3 },    // 고급
  { beam: 1, glow: 0.65, motes: 6,  rays: 0,  wave: 0, hold: 0,    wait: 0.45 },   // 희귀
  { beam: 2, glow: 0.85, motes: 10, rays: 0,  wave: 0, hold: 0.55, wait: 0.9 },    // 영웅
  { beam: 2, glow: 1,    motes: 14, rays: 6,  wave: 1, hold: 0.75, wait: 1.1 },    // 전설
  { beam: 2, glow: 1.05, motes: 18, rays: 8,  wave: 1, hold: 0.85, wait: 1.2 },    // 신화
  { beam: 2, glow: 1.1,  motes: 22, rays: 10, wave: 1, hold: 0.95, wait: 1.3 },    // 초월
  { beam: 2, glow: 1.2,  motes: 26, rays: 12, wave: 1, hold: 1.1,  wait: 1.4 },    // 태초
];
// 빛기둥 가장자리·불티에 섞는 두 번째 색 (태초는 무지개로 돈다)
const DROP_TINT = ['#e8e8ee', '#d9ffd4', '#cfe9ff', '#ead6ff', '#fff0b0', '#ffc59a', '#e2ccff', '#ffffff'];
// 비전서: 희귀와 영웅 사이쯤의 보랏빛
const TOME_TIER = { beam: 1, glow: 0.7, motes: 8, rays: 0, wave: 0, hold: 0.4, wait: 0.6 };
const TOME_COLOR = '#c9a7ff';

// 비전서 도트 (GEAR_SPR 과 같은 12×12 · 글자 규칙). 보라 표지에 금빛 룬, 옆으로 책장이 보인다
const TOME_SPR = [
  '............',
  '..HHHHHHHH..',
  '..HBBBBBBHW.',
  '..HBbJJbBHW.',
  '..HBJGGJBHW.',
  '..HBbJJbBHW.',
  '..HBBBBBBHW.',
  '..HBBGGBBHW.',
  '..HbbbbbbHW.',
  '..HHHHHHHHW.',
  '...WWWWWWWW.',
  '............',
];
const TOME_PAL = { B: '#6a3fb0', b: '#4e2c88', H: '#2a1850', W: '#f3ead2', J: '#c9a7ff', G: '#ffd257' };

const DROP_GRAV = 900;

// ── 도트 스프라이트 캐시: 외곽선 붙인 14×14 원본과, 번쩍임용 흰 실루엣 ──
const dropSprCache = {};
function dropSprite(key, rows, pal) {
  if (dropSprCache[key]) return dropSprCache[key];
  const make = (fill) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 14;
    const g = cv.getContext('2d');
    const each = (fn) => rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') fn(x + 1, y + 1, ch); }));
    g.fillStyle = fill ? '#ffffff' : '#14151c';
    each((x, y) => { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); });
    if (!fill) each((x, y, ch) => { g.fillStyle = pal[ch] || '#ff00ff'; g.fillRect(x, y, 1, 1); });
    return cv;
  };
  // 땅에 닿는 줄: 맨 아래 칠해진 줄 + 외곽선 1칸 (위아래 빈 줄 때문에 상자가 떠 보이지 않게)
  let last = rows.length - 1;
  while (last > 0 && !/[^.]/.test(rows[last])) last--;
  return (dropSprCache[key] = { cv: make(false), white: make(true), foot: 14 - (last + 3) });
}
const dropScratch = document.createElement('canvas');
dropScratch.width = dropScratch.height = 14;

function dropLook(d) {
  if (d.kind === 'tome') return dropSprite('tome', TOME_SPR, TOME_PAL);
  const def = LOOT_BOXES[d.g];
  return dropSprite('box' + d.g, GEAR_SPR[def.spr], def.pal);
}
const dropTier = (d) => (d.kind === 'tome' ? TOME_TIER : DROP_TIER[d.g]);
const dropName = (d) => (d.kind === 'tome' ? '비전서' : LOOT_BOXES[d.g].name);

// 등급 색 (알파 포함). 태초는 무지개로 돈다 — shift 로 기둥 안에서 색을 조금씩 어긋나게
function dropCol(d, a = 1, shift = 0) {
  if (d.kind !== 'tome' && d.g === 7) return `hsla(${Math.round((clock * 110 + shift + d.seed * 360) % 360)}, 100%, 78%, ${a})`;
  return hexA(d.kind === 'tome' ? TOME_COLOR : GRADES[d.g].color, a);
}
function dropTint(d, a = 1) {
  if (d.kind === 'tome') return hexA('#f0e4ff', a);
  if (d.g === 7) return dropCol(d, a, 140);
  return hexA(DROP_TINT[d.g], a);
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
const easeOutC = (u) => 1 - (1 - u) ** 3;
const easeOutBack = (u) => { const c = 1.9; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2; };

// ───────────────────────── 생성 ─────────────────────────
// sx, sy: 몬스터 화면 위치(가운데). 기사 앞쪽(오른쪽)으로 튀어 떨어진다
function spawnDrop(kind, g, sx, sy, boss = false, opt = {}) {
  const gy = groundY();
  const scale = boss ? 3 : 2;
  const dist = (opt.dist != null ? opt.dist : rand(16, 32)) * (boss ? 1.35 : 1);
  const landX = Math.max(12, Math.min(W - 14, sx + dist));
  const vy = -(boss ? 300 : 240) * (opt.pop || 1);
  // 착지 시각에 정확히 landX 에 닿도록 가로 속도를 맞춘다
  const h = Math.max(0, gy - sy);
  const T = (-vy + Math.sqrt(vy * vy + 2 * DROP_GRAV * h)) / DROP_GRAV;
  const d = {
    kind, g, boss, scale, st: 'air', t: 0,
    x: sx, y: sy, vx: (landX - sx) / T, vy, landX, flight: T,
    rot: 0, vr: rand(9, 13) * (Math.random() < 0.5 ? -1 : 1),
    bounces: 0, sq: 0, flash: 0, seed: Math.random(),
    landAt: 0, beamOut: 0, delay: opt.delay || 0,
  };
  drops.push(d);
  // 튀어나오는 순간: 등급색 불꽃이 몬스터 자리에서 터진다
  const tr = dropTier(d);
  if (tr.beam || tr.glow) burst(sx, sy, 6 + tr.motes, [dropCol(d), dropTint(d), '#ffffff'], 110, 2, 200);
  return d;
}

// ───────────────────────── 업데이트 ─────────────────────────
function updateDrops(dt) {
  if (!drops.length) return;
  const gy = groundY();
  const kx = toScreen(knight.x);
  const away = S.phase !== 'expedition';          // 귀환·캠프·탑으로 넘어가면 남은 건 알아서 가방으로
  for (const d of drops) {
    if (d.delay > 0) { d.delay -= dt; continue; }
    d.t += dt;
    d.sq = Math.max(0, d.sq - dt * 5);
    d.flash = Math.max(0, d.flash - dt);
    const tr = dropTier(d);

    if (d.st === 'air') {
      d.vy += DROP_GRAV * dt;
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.landAt) d.beamX = d.x;
      // 처음엔 빙글빙글, 한 번 튄 뒤엔 똑바로 서며 앉는다
      if (d.bounces === 0) d.rot += d.vr * dt;
      else d.rot *= Math.exp(-dt * 16);
      // 좋은 상자는 날아가는 동안 불티를 흘린다
      if (tr.beam === 2 && Math.random() < dt * 40) {
        parts.push({ x: d.x + rand(-4, 4), y: d.y - 6 * d.scale + rand(-4, 4), vx: rand(-15, 15), vy: rand(-30, 0), g: -40, size: 2, color: Math.random() < 0.5 ? dropCol(d) : '#ffffff', life: rand(0.3, 0.5), t: 0, add: true });
      }
      if (d.y >= gy && d.vy > 0) {
        d.y = gy;
        if (d.bounces === 0) {
          d.bounces = 1;
          d.vy = -Math.min(170, d.vy * 0.32); d.vx *= 0.35;
          d.sq = 1;
          dropLand(d);
        } else {
          d.st = 'ground'; d.vy = 0; d.vx = 0; d.rot = 0; d.sq = 0.7; d.groundAt = d.t;
          d.beamX = d.x;
          dust(d.x, gy, 4, d.scale);
        }
      }
    } else if (d.st === 'ground') {
      const since = d.t - d.groundAt;
      // 기사가 상자에 닿았거나(앞을 지나쳤거나), 너무 오래 기다렸거나, 원정이 끝났으면 줍는다
      const touch = S.phase === 'expedition' && knight.down <= 0 && kx >= d.x - 8 && kx - d.x < 70;
      if (since >= tr.wait && (touch || away || since > 7)) dropPickup(d, touch);
    } else if (d.st === 'lift') {
      const u = Math.min(1, (d.t - d.liftAt) / 0.32);
      const tx = d.viaKnight ? toScreen(knight.x) : d.x0;
      const ty = gy - (tr.hold ? 84 : 46);
      const e = easeOutC(u);
      d.x = d.x0 + (tx - d.x0) * e;
      d.y = d.y0 + (ty - d.y0) * e - Math.sin(u * Math.PI) * 10;
      d.rot = Math.sin(u * Math.PI * 2) * 0.25 * (1 - u);
      if (u >= 1) {
        if (tr.hold) { d.st = 'hold'; d.holdAt = d.t; dropHoldFx(d); }
        else dropToBag(d);
      }
    } else if (d.st === 'hold') {
      // 머리 위에서 둥실 — 기사가 걸어가면 따라간다
      const tx = d.viaKnight ? toScreen(knight.x) : d.x0;
      d.x += (tx - d.x) * Math.min(1, dt * 12);
      d.y = gy - 84 - Math.sin((d.t - d.holdAt) * 5) * 2;
      d.rot = 0;
      if (Math.random() < dt * (12 + tr.motes)) {
        const a = rand(0, Math.PI * 2), r = rand(12, 22) * d.scale / 2;
        parts.push({ x: d.x + Math.cos(a) * r, y: d.y - 6 * d.scale + Math.sin(a) * r, vx: 0, vy: rand(-25, -8), g: -20, size: Math.random() < 0.3 ? 3 : 2, color: Math.random() < 0.5 ? dropCol(d) : dropTint(d), life: rand(0.35, 0.6), t: 0, add: true });
      }
      if (d.t - d.holdAt >= tr.hold) dropToBag(d);
    } else if (d.st === 'bag') {
      d.ft += dt / d.fdur;
      const u = Math.min(1, d.ft);
      const tg = bagTarget();
      const e = u * u;                                    // 처음엔 느긋하게 떠올랐다가 쏙 빨려 든다
      d.x = d.x0 + (tg.x - d.x0) * e;
      d.y = d.y0 + (tg.y - d.y0) * e - Math.sin(u * Math.PI) * 26;
      d.rot = u * (d.vr > 0 ? 1 : -1) * 0.6;
      // 지나간 자리에 등급색 꼬리
      if (Math.random() < dt * 60) {
        parts.push({ x: d.x + rand(-2, 2), y: d.y - 4 * d.scale * dropBagScale(d) + rand(-2, 2), vx: rand(-10, 10), vy: rand(-10, 10), g: 0, size: 2, color: Math.random() < 0.6 ? dropCol(d) : '#ffffff', life: rand(0.2, 0.35), t: 0, add: true });
      }
      if (u >= 1) { d.done = true; dropArrive(d, tg); }
    }
  }
  drops = drops.filter((d) => !d.done);
}

// 처음 땅에 닿는 순간: 흙먼지 · 고리 · 빛기둥 분출 · (아주 좋은 건) 흔들림과 짧은 멈춤
function dropLand(d) {
  const tr = dropTier(d), gy = groundY();
  d.landAt = clock;
  d.beamX = d.x;
  d.flash = 0.09;
  dust(d.x, gy, 8 + (d.boss ? 6 : 0), d.scale);
  if (tr.glow) effects.push({ type: 'ring', x: d.x, y: gy, t: 0, life: 0.45, size: 0.3 + tr.glow * 0.35, color: dropCol(d, 0.9) });
  if (tr.beam) {
    burst(d.x, gy - 8, 10 + tr.motes, [dropCol(d), dropTint(d), '#ffffff'], tr.beam === 2 ? 150 : 100, 2, 260);
    for (const p of parts.slice(-(10 + tr.motes))) p.add = true;
  }
  if (tr.beam === 2) {
    effects.push({ type: 'ring', x: d.x, y: gy, t: 0, life: 0.7, size: 0.9, color: dropTint(d, 0.8) });
  }
  if (tr.wave) {
    shake = Math.max(shake, 0.2 + (d.g - 4) * 0.05);
    hitstop = Math.max(hitstop, 0.05);
  }
}

function dust(x, gy, n, scale) {
  const zone = ZONES[zoneIndex(S.stage)].ground;
  for (let i = 0; i < n; i++) {
    const dir = i % 2 ? 1 : -1;
    parts.push({ x: x + dir * rand(2, 5 * scale), y: gy - 2, vx: dir * rand(25, 75), vy: rand(-60, -15), g: 160, size: Math.random() < 0.4 ? 3 : 2, color: i % 3 ? '#c9b38a' : zone.line, life: rand(0.3, 0.5), t: 0 });
  }
}

// 줍기 시작: 반짝 터지고, 빛기둥이 하늘로 걷히기 시작한다
function dropPickup(d, viaKnight) {
  const tr = dropTier(d), gy = groundY();
  d.st = 'lift'; d.liftAt = d.t; d.viaKnight = viaKnight;
  d.x0 = d.x; d.y0 = d.y;
  d.flash = 0.1;
  d.beamOut = clock;
  burst(d.x, gy - 6, 6 + Math.round(tr.motes / 2), [dropCol(d), '#ffffff'], 80, 2, 150);
  for (const p of parts.slice(-(6 + Math.round(tr.motes / 2)))) p.add = true;
  if (tr.glow) effects.push({ type: 'ring', x: d.x, y: gy, t: 0, life: 0.35, size: 0.35, color: dropCol(d, 0.8) });
}

// 머리 위로 들어 올린 순간: 번쩍 터지고, 이름 캡션이 상자 옆에 붙는다 (drawDrop)
function dropHoldFx(d) {
  const tr = dropTier(d);
  d.flash = 0.12;
  burst(d.x, d.y - 6 * d.scale, 14 + tr.motes, [dropCol(d), dropTint(d), '#ffffff'], 130, 2, 60);
  for (const p of parts.slice(-(14 + tr.motes))) p.add = true;
}
const dropTextColor = (d) => (d.kind === 'tome' ? TOME_COLOR : d.g === 7 ? '#ffffff' : GRADES[d.g].color);

function dropToBag(d) {
  const tr = dropTier(d);
  d.st = 'bag'; d.ft = 0;
  d.x0 = d.x; d.y0 = d.y;
  const tg = bagTarget();
  d.fdur = Math.min(0.75, 0.4 + Math.hypot(tg.x - d.x, tg.y - d.y) / 1600);
  // 들어 보여 주지 않은 것들은 날아가며 작게 이름을 남긴다. 영웅 이상 상자는 가방에 넣는 순간 크게 알린다
  if (!tr.hold) addFloater(`+${dropName(d)}`, d.x, d.y - 6 * d.scale - 4, dropTextColor(d), 11);
  else if (d.kind === 'box' && tr.beam === 2) showBanner(`${dropName(d)} 획득!`, dropTextColor(d));
}

// HUD 의 🎒 숫자 위치 (하단바 좌표). 없거나 숨어 있으면 기사 등으로
function bagTarget() {
  const el = document.getElementById('bag'), layer = document.getElementById('barLayer');
  if (el && layer && !document.body.classList.contains('faded')) {
    const r = el.getBoundingClientRect(), l = layer.getBoundingClientRect();
    if (r.width) return { x: r.left - l.left + r.width / 2 - 14, y: r.top - l.top + r.height / 2 + 5, hud: el };
  }
  return { x: toScreen(knight.x), y: groundY() - 26, hud: null };
}
const dropBagScale = (d) => (d.st === 'bag' ? 1 - Math.min(1, d.ft) * 0.6 : 1);

// 가방에 쏙: 캔버스엔 작은 불꽃, HUD 🎒 는 톡 튀며 등급색으로 빛난다
function dropArrive(d, tg) {
  const tr = dropTier(d);
  burst(tg.x, tg.y, 6 + Math.round(tr.motes / 2), [dropCol(d), '#ffffff'], 70, 2, 0);
  for (const p of parts.slice(-(6 + Math.round(tr.motes / 2)))) p.add = true;
  const span = tg.hud && tg.hud.parentElement;
  if (!span || !span.animate) return;
  span.style.display = 'inline-block';
  const c = dropCol(d, 1), big = tr.beam === 2;
  span.animate([
    { transform: 'scale(1)', textShadow: 'none' },
    { transform: `scale(${big ? 1.45 : 1.25}) translateY(-2px)`, textShadow: `0 0 ${big ? 10 : 6}px ${c}, 0 0 2px #fff`, filter: 'brightness(1.6)', offset: 0.25 },
    { transform: 'scale(0.94)', offset: 0.55 },
    { transform: 'scale(1)', textShadow: 'none' },
  ], { duration: big ? 520 : 320, easing: 'ease-out' });
}

// ───────────────────────── 그리기 ─────────────────────────
// 뒤 레이어(기사·몬스터보다 먼저): 바닥 빛, 빛기둥, 햇살, 파동, 착지 예고 빛줄기
function drawDropsBack() {
  if (!drops.length || towerInside()) return;
  const gy = groundY();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const d of drops) {
    if (d.delay > 0) continue;
    const tr = dropTier(d);
    // 하늘에서 떨어질 자리를 먼저 가리키는 가는 빛줄기 (영웅 이상, 날아가는 동안)
    if (tr.beam === 2 && d.st === 'air' && d.bounces === 0) {
      const u = Math.min(1, d.t / d.flight);
      const bot = gy * easeOutC(u);
      const vg = ctx.createLinearGradient(0, 0, 0, gy);
      vg.addColorStop(0, dropCol(d, 0));
      vg.addColorStop(1, dropCol(d, 0.55));
      ctx.globalAlpha = 0.5 + 0.5 * u;
      ctx.fillStyle = vg;
      ctx.fillRect(Math.round(d.landX) - 1, 0, 2, bot);
      ctx.globalAlpha = 1;
    }
    if (!d.landAt) continue;
    const bx = Math.round(d.beamX);                                     // 빛기둥은 상자가 앉았던 자리에 남아서 걷힌다
    const sinceLand = clock - d.landAt;
    const out = d.beamOut ? Math.min(1, (clock - d.beamOut) / 0.4) : 0;   // 줍고 나서 걷히는 정도
    if (out >= 1) continue;

    // 바닥 빛: 등급색 타원이 숨 쉬듯 커졌다 작아진다
    if (tr.glow) {
      const pulse = 1 + 0.12 * Math.sin(clock * 4 + d.seed * 9);
      const r = (12 + 10 * tr.glow) * (d.boss ? 1.4 : 1) * pulse * (1 - out);
      const rg = ctx.createRadialGradient(bx, gy, 0, bx, gy, r);
      rg.addColorStop(0, dropCol(d, 0.55 * Math.min(1, sinceLand * 4)));
      rg.addColorStop(1, dropCol(d, 0));
      ctx.fillStyle = rg;
      ctx.save();
      ctx.translate(bx, gy); ctx.scale(1, 0.32); ctx.translate(-bx, -gy);
      ctx.fillRect(bx - r, gy - r, r * 2, r * 2);
      ctx.restore();
    }

    // 바닥 파동: 전설 이상은 1.3초마다 등급색 고리가 퍼져 나간다
    if (tr.wave) {
      for (let i = 0; i < 2; i++) {
        const k = ((sinceLand / 1.3) + i * 0.5) % 1;
        ctx.globalAlpha = (1 - k) * 0.7 * (1 - out);
        ctx.strokeStyle = dropCol(d, 1, i * 60);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(bx, gy, 6 + k * 34, 2 + k * 6, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    if (tr.beam) drawBeam(d, bx, gy, tr, sinceLand, out);
  }
  ctx.restore();
}

// 빛기둥: 세 겹으로 세운다 — 넓고 옅은 아지랑이 · 2px 세로 띠를 계단처럼 겹친 본 기둥(도트 느낌) · 하얀 심지.
// 분출(0.25초) → 일렁임 → 줍으면 바닥부터 하늘로 빨려 올라가며 걷힘
function drawBeam(d, x, gy, tr, since, out) {
  const full = tr.beam === 2;
  const grow = easeOutC(Math.min(1, since / 0.25));
  const topY = full ? 0 : gy - 56 * (d.boss ? 1.3 : 1);
  const len = (gy - topY) * grow;
  const burstK = Math.max(0, 1 - since / 0.4);                        // 분출 직후 잠깐 굵고 밝다
  const flick = 1 + 0.1 * Math.sin(clock * 9 + d.seed * 20) + 0.06 * Math.sin(clock * 23 + d.seed * 7);
  const R = (full ? 9 + Math.min(4, (d.g - 3) * 1.5) : 6) * (d.boss ? 1.3 : 1) * flick * (1 + burstK * 1.4) * (1 - out * 0.8);
  const bottom = gy - (gy - topY) * easeOutC(out);                    // 걷힐 땐 아랫부분이 위로 빨려 올라간다
  const top = Math.max(topY, gy - len);
  if (bottom - top < 1) return;
  const strength = Math.min(1.5, 1 + burstK * 0.8) * (1 - out * 0.4);
  const vfade = (col, mid) => {
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, col(0));
    g.addColorStop(full ? 0.4 : 0.25, col(mid));
    g.addColorStop(1, col(1));
    return g;
  };

  // ① 아지랑이: 기둥 폭의 2.6배, 가로로 부드럽게 퍼지는 등급색
  const HR = R * 2.6;
  const hz = ctx.createLinearGradient(x - HR, 0, x + HR, 0);
  hz.addColorStop(0, dropCol(d, 0));
  hz.addColorStop(0.5, dropCol(d, 0.22 * strength));
  hz.addColorStop(1, dropCol(d, 0));
  ctx.save();
  ctx.fillStyle = hz;
  ctx.globalAlpha = 1;
  // 위로 갈수록 옅게: 세로를 6칸으로 나눠 칸마다 알파를 줄인다 (가로·세로 그라데이션을 한 번에 못 써서)
  for (let i = 0; i < 6; i++) {
    const y0 = top + (bottom - top) * (i / 6), y1 = top + (bottom - top) * ((i + 1) / 6);
    ctx.globalAlpha = ((i + 1) / 6) ** (full ? 1.2 : 0.8);
    ctx.fillRect(x - HR, Math.round(y0), HR * 2, Math.ceil(y1 - y0));
  }
  ctx.restore();

  // ② 본 기둥: 2px 띠. 가운데는 밝은 둘째 색, 가장자리로 갈수록 등급색이 옅어진다
  const main = vfade((a) => dropCol(d, a), 0.55);
  const inner = vfade((a) => dropTint(d, a), 0.6);
  for (let dx = -Math.ceil(R / 2) * 2; dx < R; dx += 2) {
    const k = Math.min(1, Math.abs(dx + 1) / R);                       // 0 가운데 → 1 가장자리
    const a = (1 - k * k) * 0.8 * strength;
    if (a <= 0) continue;
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = k < 0.35 ? inner : main;
    ctx.fillRect(Math.round(x + dx), top, 2, bottom - top);
  }

  // ③ 하얀 심지 (분출 순간엔 4px)
  ctx.globalAlpha = 1;
  ctx.fillStyle = vfade((a) => `rgba(255,255,255,${a * Math.min(1, 0.85 * strength)})`, 0.5);
  const cw = burstK > 0.3 ? 4 : 2;
  ctx.fillRect(x - cw / 2, top, cw, bottom - top);

  // 기둥 뿌리의 눈부신 빛무리
  if (out < 1 && bottom >= gy - 2) {
    const fr = (full ? 14 : 9) * (1 + burstK) * (1 + 0.08 * Math.sin(clock * 7 + d.seed * 3));
    const rg = ctx.createRadialGradient(x, gy - 2, 0, x, gy - 2, fr);
    rg.addColorStop(0, `rgba(255,255,255,${0.7 * strength})`);
    rg.addColorStop(0.35, dropTint(d, 0.45 * strength));
    rg.addColorStop(1, dropCol(d, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(x - fr, gy - 2 - fr, fr * 2, fr * 2);
  }

  // 기둥을 타고 오르는 불티 (자리는 씨앗값으로 정해 두고 시간에 따라 올린다)
  const H = gy - topY;
  for (let i = 0; i < tr.motes; i++) {
    const ph = (clock * (0.35 + (i % 3) * 0.12) + i / tr.motes + d.seed) % 1;
    const py = gy - ph * H;
    if (py < top || py > bottom) continue;
    const px = x + Math.sin(i * 7.31 + clock * 1.9) * R * 0.45;
    ctx.globalAlpha = Math.sin(ph * Math.PI) * (1 - out);
    ctx.fillStyle = i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? dropCol(d, 1, i * 30) : dropTint(d);
    const s = i % 4 === 0 ? 3 : 2;
    ctx.fillRect(Math.round(px), Math.round(py), s, s);
  }
  // 기둥 꼭대기를 지나는 반짝이 (희귀는 기둥 끝에 작은 별)
  if (!full && grow >= 1 && out === 0) {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(clock * 6 + d.seed * 10);
    twinkle(x, top + 6, 3, dropTint(d));
  }
  ctx.globalAlpha = 1;
}

// 4갈래 반짝이 (+ 모양 도트)
function twinkle(x, y, r, color) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = color;
  ctx.fillRect(x - 1, y - r, 2, r * 2);
  ctx.fillRect(x - r, y - 1, r * 2, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 1, y - 1, 2, 2);
}

// 앞 레이어: 땅 위·공중의 상자 (가방으로 날아가는 건 drawDropsTop 이 HUD 근처에서 그린다)
function drawDropsFront() {
  if (towerInside()) return;
  // 가까이 붙어 앉은 것끼리는 이름표가 겹치지 않게 한 줄씩 올린다
  const seated = [];
  for (const d of drops) {
    if (d.st !== 'ground') continue;
    let row = 0;
    while (seated.some((o) => o.row === row && Math.abs(o.x - d.x) < 64)) row++;
    d.labelRow = row;
    seated.push({ x: d.x, row });
  }
  for (const d of drops) if (d.delay <= 0 && d.st !== 'bag') drawDrop(d);
}
function drawDropsTop() {
  for (const d of drops) if (d.st === 'bag') drawDrop(d);
}

function drawDrop(d) {
  const tr = dropTier(d), gy = groundY();
  const look = dropLook(d);
  const s = d.scale * dropBagScale(d);
  const held = d.st === 'hold' || d.st === 'lift';
  const sx = 1 + 0.32 * d.sq, sy = 1 - 0.28 * d.sq;
  const bottom = d.y + look.foot * s;
  const cy = bottom - 7 * s * sy;                                    // 스프라이트 가운데 (회전 축)

  // 그림자: 높이 뜰수록 옅고 작게
  if (d.st !== 'bag') {
    const air = Math.max(0, gy - d.y);
    const sw = Math.max(4, 10 * s * (1 - Math.min(0.7, air / 90)));
    ctx.fillStyle = `rgba(0,0,0,${0.28 * (1 - Math.min(0.8, air / 90))})`;
    ctx.fillRect(Math.round(d.x - sw / 2), gy - 1, Math.round(sw), 2);
  }

  // 햇살 줄기 (전설 이상, 땅에 있을 때 · 들어 보일 땐 더 크게)
  if (tr.rays && d.landAt && d.st !== 'bag' && d.st !== 'air') {
    const len = (held ? 40 : 26) * (d.boss ? 1.3 : 1) * (0.9 + 0.1 * Math.sin(clock * 3));
    const a0 = clock * 0.7 + d.seed * 6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < tr.rays; i++) {
      const a = a0 + (i / tr.rays) * Math.PI * 2, w = 0.09 + (i % 2) * 0.05;
      const l = len * (i % 2 ? 0.75 : 1);
      const rg = ctx.createRadialGradient(d.x, cy, 2, d.x, cy, l);
      rg.addColorStop(0, dropCol(d, held ? 0.55 : 0.4, i * 30));
      rg.addColorStop(1, dropCol(d, 0, i * 30));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(d.x, cy);
      ctx.lineTo(d.x + Math.cos(a - w) * l, cy + Math.sin(a - w) * l);
      ctx.lineTo(d.x + Math.cos(a + w) * l, cy + Math.sin(a + w) * l);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // 상자 둘레의 은은한 빛 (고급 이상)
  if (tr.glow && d.st !== 'air') {
    const r = (10 + 6 * tr.glow) * s / 2 * (1 + 0.1 * Math.sin(clock * 4 + d.seed * 5)) * (held ? 1.5 : 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(d.x, cy, 0, d.x, cy, r);
    rg.addColorStop(0, dropCol(d, 0.35 * tr.glow));
    rg.addColorStop(1, dropCol(d, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(d.x - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  // 광택: 2.4초마다 대각선으로 하얀 빛이 한 번 스윽 지나간다 (고급 이상은 더 자주)
  const period = tr.glow ? 1.6 : 2.4;
  const sp = ((clock + d.seed * period) % period) / 0.45;
  let img = look.cv;
  if (d.st === 'ground' && sp < 1) {
    const g = dropScratch.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, 14, 14);
    g.drawImage(look.cv, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(255,255,255,0.8)';
    const p = -6 + sp * 26;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p + 3, 0); g.lineTo(p - 11, 14); g.lineTo(p - 14, 14); g.closePath(); g.fill();
    img = dropScratch;
  }

  ctx.save();
  ctx.translate(Math.round(d.x), Math.round(cy));
  if (d.rot) ctx.rotate(d.rot);
  ctx.scale(sx, sy);
  ctx.drawImage(img, -7 * s, -7 * s, 14 * s, 14 * s);
  if (d.flash > 0) {
    ctx.globalAlpha = Math.min(1, d.flash / 0.06);
    ctx.drawImage(look.white, -7 * s, -7 * s, 14 * s, 14 * s);
  }
  ctx.restore();

  // 반짝이: 상자 모서리 근처에서 하나씩 피었다 진다
  if (tr.glow && d.st !== 'air' && d.st !== 'bag') {
    const n = tr.beam === 2 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const cyc = clock * 1.3 + i / n + d.seed;
      const ph = cyc % 1, k = Math.floor(cyc) * 3 + i;
      const a = Math.sin(ph * Math.PI);
      ctx.globalAlpha = a;
      twinkle(d.x + Math.sin(k * 12.99) * 6 * s, cy + Math.cos(k * 78.2) * 5 * s, 1 + Math.round(a * 2), dropTint(d));
    }
    ctx.globalAlpha = 1;
  }

  // 이름표: 땅에 앉은 뒤 떠오른다. 영웅 이상은 어두운 띠를 깔고 테두리를 등급색으로
  if (d.st === 'ground') {
    const a = Math.min(1, (d.t - d.groundAt) / 0.2);
    const name = dropName(d);
    const ty = Math.round(bottom - 14 * s - 6 - (1 - a) * 4 - (d.labelRow || 0) * 15);
    ctx.globalAlpha = a;
    ctx.font = `bold ${tr.beam === 2 ? 11 : 10}px -apple-system, sans-serif`;
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    if (tr.beam === 2) {
      const w = ctx.measureText(name).width + 10;
      ctx.fillStyle = 'rgba(12,12,18,0.72)';
      ctx.fillRect(Math.round(d.x - w / 2), ty - 10, Math.round(w), 14);
      ctx.fillStyle = dropCol(d, 0.9);
      ctx.fillRect(Math.round(d.x - w / 2), ty - 10, Math.round(w), 1);
      ctx.fillRect(Math.round(d.x - w / 2), ty + 3, Math.round(w), 1);
    } else {
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(name, d.x, ty);
    }
    ctx.fillStyle = d.g === 7 && d.kind !== 'tome' ? dropCol(d) : dropTextColor(d);
    ctx.fillText(name, d.x, ty);
    ctx.globalAlpha = 1;
  }

  // 들어 보일 때의 이름 캡션: 상자 오른쪽에 톡 튀어나온다 (위쪽은 HUD 와 겹칠 수 있어 옆에 둔다)
  if (d.st === 'hold') {
    const u = (d.t - d.holdAt) / tr.hold;
    const pop = easeOutBack(Math.min(1, u / 0.25));
    const a = Math.min(1, u / 0.12) * (u > 0.8 ? Math.max(0, 1 - (u - 0.8) / 0.2) : 1);
    const name = '✨ ' + dropName(d);
    const size = d.kind === 'tome' ? 12 : 12 + Math.min(3, d.g - 3);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `bold ${size}px -apple-system, sans-serif`;
    const w = ctx.measureText(name).width + 12;
    // 오른쪽 끝에서는 왼쪽으로 붙인다
    const right = d.x + 12 * s + w < W - 4;
    const lx = right ? d.x + 10 * s : d.x - 10 * s - w * pop;
    const ly = Math.round(cy - size / 2 - 3);
    ctx.translate(lx, ly);
    ctx.scale(pop, 1);
    ctx.fillStyle = 'rgba(12,12,18,0.78)';
    ctx.fillRect(0, 0, w, size + 6);
    ctx.fillStyle = dropCol(d, 0.95);
    ctx.fillRect(0, 0, w, 1); ctx.fillRect(0, size + 5, w, 1);
    ctx.fillRect(right ? 0 : w - 2, 0, 2, size + 6);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = d.g === 7 && d.kind !== 'tome' ? dropCol(d) : dropTextColor(d);
    ctx.fillText(name, 6, (size + 6) / 2 + 1);
    ctx.restore();
  }
}
