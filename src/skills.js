'use strict';
// 스킬: 원정에서 쓰기(쿨타임·대상·피해)와, 원정·결투·레이드 재생이 함께 쓰는 모션·이펙트·타격감.
// 수치(해금 레벨·쿨타임·배율·타격 시점)는 src/classes.js 의 SKILLS 에 있고, 여기 SKILL_FX[id] 는 보이는 것만 정한다.
//   pose(u, a)  시전 진행도 u(0→1)의 기사 자세 { dx 앞으로, lift 위로, sx·sy 늘림, skew 기울임, wa·wa2 무기 각도, ext 창 내밀기,
//               pull 시위 당김, bowA 활 기울기, alpha, facing } — drawHero 가 그린다
//   cues: [[u, fn(a)]]  그 시점에 한 번 나오는 연출
//   hit(a, i, n)  i 번째 타격 순간의 연출 (피해는 원정에서만 a.onHit 이 넣는다. 재생은 숫자만 띄운다)
//   tick(a, u, dt)  매 프레임 연출 (불꽃·기 모으기)
//   kb: 원정에서 맞은 적이 밀려나는 거리 · launch: 맞은 적을 공중에 띄운다
// a(시전 정보): { owner, id, k, cls, color, dir 바라보는 쪽, x() 시전자 화면 x, tx()·ty() 대상 위치, targets() [{x, y}], u, onHit, onEnd }
//
// 1차와 2차의 차이: 1차는 직업색 이펙트 하나 + 가벼운 흔들림. 2차는 이름 띠(컷인), 히트스톱, 검흔 여러 겹, 잔상·마법진·지형 연출.
// 바탕화면 위에 떠 있는 게임이라 화면 전체를 번쩍이거나 어둡게 하지 않는다. 화려함은 타격 지점(검흔·불꽃)과 기사 주변에서만 낸다.

let hitstop = 0;          // 남은 정지 시간(초). 큰 타격 순간 화면 전체를 아주 잠깐 멈춘다 (world.js update)
let casts = [];           // 진행 중인 시전 { owner, id, k, fx, t, a, hi, ci }
let skfx = [];            // 스킬 이펙트 조각 { owner, at, life, draw(u), tick(u, dt), end() } — u 는 0→1 진행
let cutin = null;         // 2차 스킬 이름 띠 { k, color, t }
let shakeAmp = 0;         // 화면 흔들림 세기(px). 0 이면 기본(3px), 최대 6px

const clamp01 = (u) => Math.max(0, Math.min(1, u));
const segU = (u, a, b) => clamp01((u - a) / (b - a));
const easeOut = (u) => 1 - (1 - u) ** 3;
const easeIn = (u) => u * u * u;
const mix = (a, b, u) => a + (b - a) * u;
const HAND_Y = 18;        // 땅에서 손까지 높이 (다리 3칸 + 몸통 3칸)
const skillTier = (k) => CLASSES[k.cls].tier;

// ───────────────────────── 시전 관리 ─────────────────────────
// queue: 결투·레이드 재생은 빨리 감기라 스킬이 겹칠 수 있다 — 앞 스킬이 끝나면 이어서 쓴다 (최대 2개 대기)
function startCast(owner, id, a, queue = false) {
  const cur = castOf(owner);
  if (queue && cur) {
    if (cur.next.length < 2) cur.next.push([id, a]);
    else a.onHit && a.onHit(0, 1);
    return;
  }
  casts = casts.filter((c) => c.owner !== owner);      // 남아 있는 이펙트(성역 돔 등)는 그대로 둔다
  const k = SKILLS[id], fx = SKILL_FX[id];
  Object.assign(a, { owner, id, k, u: 0, color: CLASSES[a.cls || S.cls].look.fx });
  a.cls = a.cls || S.cls;
  a.targets = a.targets || (() => [{ x: a.tx(), y: a.ty() }]);
  a.px = () => a.x() + a.dir * ((fx.pose && fx.pose(a.u, a).dx) || 0);
  casts.push({ owner, id, k, fx, t: 0, a, hi: 0, ci: 0, next: [], squash: 0, hist: [] });
  if (skillTier(k) >= 2) cutin = { k, color: a.color, t: 0, cx: a.x() };
  else addFloater(`${k.icon} ${k.name}`, a.x(), groundY() - 72, a.color, 12);
}
function endCast(owner) {
  casts = casts.filter((c) => c.owner !== owner);
  skfx = skfx.filter((f) => f.owner !== owner);
}
// 결투·레이드 재생이 끝나면 그 시전자들의 연출을 모두 걷어 낸다 (위치를 재생 기록에서 읽으므로)
function endCasts(prefix) {
  casts = casts.filter((c) => !c.owner.startsWith(prefix));
  skfx = skfx.filter((f) => !(f.owner && f.owner.startsWith(prefix)));
}
const castOf = (owner) => casts.find((c) => c.owner === owner) || null;
function castPose(owner) {
  const c = castOf(owner);
  return c && c.fx.pose ? finalPose(c) : null;
}

// ── 모션을 부드럽게 ──
// 무기별 평소 자세. 스킬 자세로 들어갈 때(0.08초)와 나올 때(0.14초) 이 자세에서/로 섞어서 툭 끊기지 않게 한다
function restPose(cls) {
  const w = WEAPONS[CLASSES[cls].weapon];
  if (w.kind === 'ranged') return { pull: 0, bowA: 0 };
  return { wa: w.motion === 'thrust' ? -1.3 : w.motion === 'sweep' ? -1.35 : -1.0, wa2: -0.6, ext: 0 };
}
const POSE_DEF = { dx: 0, lift: 0, sx: 1, sy: 1, skew: 0, wa: null, wa2: null, ext: 0, pull: 0, bowA: 0, alpha: 1 };
function blendPose(from, to, w) {
  const out = { ...to };
  for (const key in POSE_DEF) {
    const d = POSE_DEF[key];
    const a = from[key] != null ? from[key] : d, b = to[key] != null ? to[key] : d != null ? d : a;
    if (a == null || b == null) continue;
    out[key] = mix(a, b, w);
  }
  return out;
}
// 시전 진행도의 자세 + 들어가고 나오는 섞기 + 타격 순간 몸이 찌그러졌다 펴지는 반동
function finalPose(c) {
  let p = c.fx.pose(c.a.u, c.a);
  const w = Math.max(0, Math.min(1, c.t / 0.08, (c.k.dur - c.t) / 0.14));
  if (w < 1) p = blendPose(restPose(c.a.cls), p, w * w * (3 - 2 * w));
  if (c.squash > 0) { p.sy = (p.sy || 1) * (1 - 0.1 * c.squash); p.sx = (p.sx || 1) * (1 + 0.08 * c.squash); }
  if (p.facing) p.facing *= c.a.dir;
  else delete p.facing;
  return p;
}

// 모션 잔상: 최근 몇 프레임의 자세를 기억했다가, 빠르게 움직인 구간만 무기(와 크게 움직인 몸)를 흐리게 겹쳐 그린다
function drawCastTrail(owner, cls, gy, facing) {
  const c = castOf(owner);
  if (!c) return;
  const h = c.hist, fx = CLASSES[cls].look.fx;
  for (let j = h.length - 1; j >= 1; j--) {
    const p = h[j].p, q = h[j - 1].p;
    const body = Math.abs((q.dx || 0) - (p.dx || 0)) + Math.abs((q.lift || 0) - (p.lift || 0));
    const arm = Math.abs((q.wa || 0) - (p.wa || 0)) * 14 + Math.abs((q.ext || 0) - (p.ext || 0)) + Math.abs((q.pull || 0) - (p.pull || 0));
    if (body + arm < 1.5) continue;
    const fade = 1 - j / h.length, al = p.alpha == null ? 1 : p.alpha;
    const pose = { mode: 'fight', swing: -1, t: clock, ...p, facing: p.facing || facing };
    if (body > 3) drawHero(ctx, cls, h[j].x, gy, { ...pose, tint: fx, alpha: 0.3 * fade * al });
    drawHero(ctx, cls, h[j].x, gy, { ...pose, onlyWeapon: true, alpha: 0.3 * fade * al });
  }
}

function updateCasts(dt) {
  for (const c of casts) {
    c.t += dt;
    const u = Math.min(1, c.t / c.k.dur);
    c.a.u = u;
    const cues = c.fx.cues || [];
    while (c.ci < cues.length && cues[c.ci][0] <= u) cues[c.ci++][1](c.a);
    const hits = c.k.hits;
    while (c.hi < hits.length && hits[c.hi][0] <= u) {
      const i = c.hi++;
      if (c.fx.hit) c.fx.hit(c.a, i, hits.length);
      autoHitFx(c, i);
      c.squash = 1;
      if (c.a.onHit) c.a.onHit(i, hits.length);
    }
    if (c.fx.tick) c.fx.tick(c.a, u, dt);
    auraTick(c);
    c.squash = Math.max(0, c.squash - dt * 7);
    if (c.fx.pose) { c.hist.unshift({ p: finalPose(c), x: c.a.x() }); if (c.hist.length > 5) c.hist.pop(); }
    if (u >= 1) {
      c.done = true;
      if (!hits.length && c.a.onHit) c.a.onHit(0, 1);
      if (c.a.onEnd) c.a.onEnd();
    }
  }
  const finished = casts.filter((c) => c.done);
  casts = casts.filter((c) => !c.done);
  for (const c of finished) {
    if (!c.next.length) continue;
    const [[id, a], ...rest] = c.next;
    startCast(c.owner, id, a);
    castOf(c.owner).next = rest;
  }

  for (const f of skfx) {
    if (clock < f.at) continue;
    const u = f.life ? Math.min(1, (clock - f.at) / f.life) : 1;
    if (f.tick) f.tick(u, dt);
    if (u >= 1) { f.done = true; if (f.end) f.end(); }
  }
  skfx = skfx.filter((f) => !f.done);
  if (shake <= 0) shakeAmp = 0;
  if (cutin && (cutin.t += dt) > 1.2) cutin = null;
}

// ───────────────────────── 원정에서 쓰기 ─────────────────────────
function skillTargets(k, st) {
  const reach = k.area === 'line' ? st.range * (k.reach || 1) : k.area === 'all' ? st.range + (k.radius || 60) : st.range;
  const list = monsters
    .filter((m) => !m.dying && aheadDist(knight.x, m.x) <= reach + monsterWidth(m) / 2 + 2)
    .sort((p, q) => aheadDist(knight.x, p.x) - aheadDist(knight.x, q.x));
  return k.area === 'single' ? list.slice(0, 1) : list;
}

// 쿨타임과 성역 보호막은 원정 내내 흐른다
function tickSkills(dt, st) {
  for (const id of st.skills) if (knight.cds[id] > 0) knight.cds[id] -= dt;
  const w = knight.ward;
  if (!w) return;
  w.left -= dt;
  w.acc += dt;
  if (w.acc >= 1) {
    w.acc -= 1;
    for (const m of skillTargets({ area: 'all', radius: 40 }, st)) {
      hitMonster(m, w.tick, { kb: 3, color: '#ffd257' });
      burst(toScreen(m.x), monsterMidY(m), 8, ['#ffd257', '#fff3b0'], 70, 2, -40);
    }
  }
  if (w.left <= 0) knight.ward = null;
}

// 교전 중 쿨타임이 찬 스킬이 있으면 쓴다 (해금 레벨 높은 것부터)
function tryCastSkill(st, target) {
  for (const id of st.skills) {
    if ((knight.cds[id] || 0) > 0) continue;
    const k = SKILLS[id], fx = SKILL_FX[id];
    knight.cds[id] = k.cd;
    knight.swing = -1;
    let focus = target;
    const a = {
      cls: S.cls, dir: 1,
      x: () => toScreen(knight.x),
      tx: () => toScreen(focus.x) + focus.kb,
      ty: () => monsterMidY(focus),
      targets: () => {
        const list = skillTargets(k, stats());
        return (list.length ? list : [focus]).map((m) => ({ x: toScreen(m.x) + m.kb, y: monsterMidY(m), top: monsterTop(m) }));
      },
      onHit: (i) => {
        if (!k.hits.length) return;
        const list = skillTargets(k, stats());
        if (list.length) focus = list[0];
        for (const m of list) {
          // 여러 번 나눠 때리는 스킬은 숫자를 모아 두었다가 마지막 타격(또는 처치) 때 합쳐서 띄운다
          hitMonster(m, k.hits[i][1], { crit: k.crit, kb: fx.kb != null ? fx.kb : 8, color: a.color, quiet: k.hits.length >= 6 && i < k.hits.length - 1 });
          if (fx.launch && !m.boss) m.air = 0;
        }
      },
      onEnd: () => {
        if (!k.ward) return;
        const max = stats().maxHp;
        knight.ward = { left: k.ward.dur, guard: k.ward.guard, tick: k.ward.tick, acc: 0 };
        S.hp = Math.min(max, S.hp + max * k.ward.heal);
        addFloater(`💚 +${fmt(max * k.ward.heal)}`, toScreen(knight.x), groundY() - 66, '#7dffb0', 13);
      },
    };
    startCast('hero', id, a);
    return true;
  }
  return false;
}

// 공중에 떠 있는 동안은 몬스터 공격이 빗나간다
function heroAirborne() {
  const c = castOf('hero');
  return !!(c && c.k.air && c.a.u >= c.k.air[0] && c.a.u < c.k.air[1]);
}

// ───────────────────────── 타격감 도구 ─────────────────────────
function impact({ stop = 0, shake: sh = 0 } = {}) {
  hitstop = Math.max(hitstop, stop * 1.3);
  shake = Math.max(shake, sh);
  shakeAmp = Math.max(shakeAmp, Math.min(6, 3 + sh * 8));
}

function skFx(owner, delay, life, draw, end, tick) { skfx.push({ owner, at: clock + delay, life, draw, end, tick }); }
const aFx = (a, delay, life, draw, end, tick) => skFx(a.owner, delay, life, draw, end, tick);
const skLater = (a, delay, fn) => aFx(a, delay, 0, null, fn);
function dot(x, y, s, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
  ctx.globalAlpha = 1;
}
const hand = (a) => ({ x: a.px() + a.dir * 4 * PX, y: groundY() - HAND_Y });
const flipA = (ang, dir) => (dir < 0 ? Math.PI - ang : ang);

// 초승달 베기: 도트를 호를 따라 찍으며 머리가 앞서 나가고 꼬리가 따라온다
function crescentFx(x, y, r, a0, a1, dir, color, width, life) {
  skFx(null, 0, life, (u) => {
    const head = Math.min(1, u * 2.4), tail = Math.max(0, u * 2.4 - 0.9);
    for (let v = tail; v <= head; v += 0.03) {
      const ang = flipA(a0 + (a1 - a0) * v, dir), sz = 1 + Math.round(width * Math.sin(Math.PI * v));
      dot(x + Math.cos(ang) * r, y + Math.sin(ang) * r, sz, color, Math.min(1, (1 - u) * 1.6));
    }
  });
}
// 직선 섬광: 굵게 그어졌다가 가늘어지며 사라진다. 가운데는 하얀 심
function streakFx(x0, y0, x1, y1, color, width, life, delay = 0) {
  skFx(null, delay, life, (u) => {
    const w = width * (1 - u);
    if (w < 0.5) return;
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.globalAlpha = 1 - u * 0.5;
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, w * 0.35);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.restore();
  });
}
function xslashFx(x, y, size, color, life) {
  slashMarkFx(x, y, Math.PI / 4, size * 2.8, color, 6, life + 0.1, 0, 5);
  slashMarkFx(x, y, -Math.PI / 4, size * 2.8, color, 6, life + 0.1, 0.06, -5);
}
// 4갈래 반짝임
function starFx(x, y, size, color, life) {
  skFx(null, 0, life, (u) => {
    const s = size * Math.sin(Math.PI * u);
    ctx.save();
    ctx.globalAlpha = 1 - u * 0.3;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x - s), Math.round(y - 1), Math.round(s * 2), 2);
    ctx.fillRect(Math.round(x - 1), Math.round(y - s), 2, Math.round(s * 2));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(x - 2), Math.round(y - 2), 4, 4);
    ctx.restore();
  });
}
const ringFx = (x, color, size = 1, life = 0.5, y = groundY() - 2) => effects.push({ type: 'ring', x, y, t: 0, life, size, color });
// 하늘에서 내리꽂히는 빛기둥
function pillarFx(x, color, width, life) {
  skFx(null, 0, life, (u) => {
    const w = width * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85 * 0.8);
    const gy = groundY();
    ctx.save();
    ctx.globalAlpha = u < 0.15 ? 1 : 1 - (u - 0.15) / 0.85;
    const grad = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.5, color); grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - w / 2, -10, w, gy + 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(x - w * 0.12), -10, Math.max(2, Math.round(w * 0.24)), gy + 10);
    ctx.restore();
  });
}
// 흙·돌 파편이 튀어 오른다
function debris(x, n, colors, spread = 1) {
  const gy = groundY();
  for (let i = 0; i < n; i++) {
    parts.push({ x: x + rand(-10, 10) * spread, y: gy - 3, vx: rand(-90, 90) * spread, vy: rand(-220, -80), g: 520, size: Math.random() < 0.3 ? 4 : 3, color: colors[i % colors.length], life: rand(0.5, 0.9), t: 0 });
  }
}
// 빨려 들어오는 기 (charge)
function gatherFx(x, y, colors, n = 2, r = 26) {
  for (let i = 0; i < n; i++) {
    const ang = rand(0, Math.PI * 2), d = rand(r * 0.6, r);
    parts.push({ x: x + Math.cos(ang) * d, y: y + Math.sin(ang) * d, vx: -Math.cos(ang) * d * 4, vy: -Math.sin(ang) * d * 4, g: 0, size: 2, color: colors[i % colors.length], life: 0.25, t: 0 });
  }
}
// 시전자 잔상: 같은 모습을 한 가지 색으로 칠해 흐리게 남긴다
function ghostFx(a, x, facing, tint, life, pose = {}) {
  skFx(null, 0, life, (u) => {
    drawHero(ctx, a.cls, x, groundY(), { mode: 'fight', swing: -1, t: clock, facing, tint, alpha: 0.35 * (1 - u), ...pose });
  });
}
// 회전하는 마법진 (rx·ry 타원). 바깥 원 + 도는 룬 점 + 안쪽 별
function circleFx(a, getXY, rx, ry, color, life, delay = 0) {
  aFx(a, delay, life, (u) => {
    const { x, y } = getXY();
    const k = u < 0.15 ? u / 0.15 : u > 0.8 ? (1 - u) / 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.shadowColor = color; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.ellipse(x, y, rx * k, ry * k, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y, rx * 0.7 * k, ry * 0.7 * k, 0, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 10; i++) {
      const ang = clock * 2.5 + (i / 10) * Math.PI * 2;
      dot(x + Math.cos(ang) * rx * 0.85 * k, y + Math.sin(ang) * ry * 0.85 * k, 2, i % 2 ? '#ffffff' : color, k);
    }
    ctx.globalAlpha = k;
    for (let i = 0; i < 5; i++) {
      const p = (i * 2) % 5, q = (i * 2 + 2) % 5;
      const ang1 = -clock * 1.5 + (p / 5) * Math.PI * 2, ang2 = -clock * 1.5 + (q / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang1) * rx * 0.7 * k, y + Math.sin(ang1) * ry * 0.7 * k);
      ctx.lineTo(x + Math.cos(ang2) * rx * 0.7 * k, y + Math.sin(ang2) * ry * 0.7 * k);
      ctx.stroke();
    }
    ctx.restore();
  });
}
// 유성: 위에서 비스듬히 떨어지는 빛줄기
function meteorFx(x0, y0, x1, y1, color, width, life, onLand) {
  skFx(null, 0, life, (u) => {
    const x = mix(x0, x1, u), y = mix(y0, y1, u);
    const tx = mix(x0, x1, Math.max(0, u - 0.35)), ty = mix(y0, y1, Math.max(0, u - 0.35));
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.5, width * 0.4); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.moveTo(mix(tx, x, 0.5), mix(ty, y, 0.5)); ctx.lineTo(x, y); ctx.stroke();
    ctx.restore();
  }, onLand);
}
// 땅 갈라짐: x0 에서 x1 쪽으로 지그재그 균열이 뻗고, 틈에서 빛이 샌다
function cracksFx(x0, x1, color, life, grow = 0.35) {
  const gy = groundY(), pts = [];
  const n = Math.max(3, Math.round(Math.abs(x1 - x0) / 10));
  for (let i = 0; i <= n; i++) pts.push([mix(x0, x1, i / n), gy + 1 + (i % 2 ? -2 : 2) * Math.random()]);
  skFx(null, 0, life, (u) => {
    const m = Math.max(1, Math.round(pts.length * Math.min(1, u / grow)));
    ctx.save();
    ctx.globalAlpha = u > 0.6 ? (1 - u) / 0.4 : 1;
    ctx.strokeStyle = '#1a120c'; ctx.lineWidth = 3;
    ctx.beginPath(); pts.slice(0, m).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.shadowColor = color; ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.restore();
  });
}
// 솟구치는 바위 가시
function spikeFx(x, h, color, life) {
  const gy = groundY();
  skFx(null, 0, life, (u) => {
    const k = u < 0.2 ? easeOut(u / 0.2) : u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
    const hh = h * k;
    ctx.save();
    ctx.fillStyle = '#5a4a42';
    ctx.beginPath(); ctx.moveTo(x - 7, gy); ctx.lineTo(x, gy - hh); ctx.lineTo(x + 7, gy); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x - 2, gy); ctx.lineTo(x, gy - hh); ctx.lineTo(x + 2, gy - hh * 0.3); ctx.fill();
    ctx.restore();
  });
}

// ── 모든 스킬 타격에 공통으로 붙는 타격 레이어 ──
// 그 타격이 전체 피해에서 차지하는 비중(share)과 2차 여부로 세기(pow)를 정한다. 다단 히트의 잔타는 가볍게, 막타·한 방은 세게
function autoHitFx(c, i) {
  const k = c.k, n = k.hits.length, share = k.hits[i][1] / skillMult(k), last = i === n - 1;
  const t2 = skillTier(k) >= 2;
  const pow = (t2 ? 1.35 : 1) * (share >= 0.5 ? 2 : share >= 0.2 ? 1.4 : 0.8) * (last && n > 1 ? 1.5 : 1);
  const tg = c.a.targets();
  for (const t of tg) { hitFx(t.x, t.y, c.a.color, pow); weaponMarks(c.a, t, pow); }
  const big = share >= 0.2 || last;
  impact({ stop: big ? 0.035 * pow : 0.012, shake: 0.06 * pow });
}

// 무기마다 다른 검흔: 검은 휘어진 베기 자국 여러 겹, 창은 곧게 꿰뚫는 자국, 할버드는 넓게 휩쓴 호, 활은 화살이 긁고 간 짧은 X 자국
function weaponMarks(a, t, pow) {
  const w = WEAPONS[CLASSES[a.cls].weapon], col = a.color, d = a.dir;
  const n = Math.min(4, Math.round(0.6 + pow));
  for (let j = 0; j < n; j++) {
    const dl = j * 0.035;
    if (w.kind === 'ranged') {
      const ang = (d > 0 ? 0 : Math.PI) + rand(-0.3, 0.3);
      slashMarkFx(t.x, t.y + rand(-6, 6), ang, 22 + 7 * pow, col, 2.5 + 0.6 * pow, 0.38, dl);
      if (j === 0) slashMarkFx(t.x, t.y, ang + Math.PI / 2 + rand(-0.3, 0.3), 10 + 4 * pow, '#ffffff', 1.5 + 0.4 * pow, 0.25, 0.03);
    } else if (w.motion === 'thrust') {
      slashMarkFx(t.x + d * 6, t.y + (j - (n - 1) / 2) * 6, (d > 0 ? 0 : Math.PI) + rand(-0.08, 0.08), 36 + 12 * pow, col, 3 + 0.7 * pow, 0.42, dl);
    } else if (w.motion === 'sweep') {
      slashMarkFx(t.x, t.y + rand(-8, 8), rand(-0.35, 0.35), 44 + 12 * pow, col, 4.5 + pow, 0.48, dl, (j % 2 ? -1 : 1) * (9 + 3 * pow));
    } else {
      const ang = (j % 2 ? 0.7 : -0.7) + rand(-0.35, 0.35) + (d < 0 ? Math.PI : 0);
      slashMarkFx(t.x + rand(-4, 4), t.y + rand(-6, 6), ang, 34 + 10 * pow, col, 3.5 + pow, 0.45, dl, (j % 2 ? -1 : 1) * rand(4, 9));
    }
  }
}

// 검흔: 양끝이 뾰족한 칼자국이 순식간에 그어지고(앞 16%), 잠깐 빛나다가 가늘어지며 사라진다.
// ang 방향, len 길이, width 가운데 두께, bend 휘어짐(+면 오른손 쪽으로 볼록). 바깥은 직업색, 안쪽 심은 흰색
function slashMarkFx(x, y, ang, len, color, width = 4, life = 0.45, delay = 0, bend = 0) {
  const ca = Math.cos(ang), sa = Math.sin(ang), steps = 12;
  skFx(null, delay, life, (u) => {
    const reach = Math.min(1, u / 0.16);
    const fade = u < 0.45 ? 1 : 1 - (u - 0.45) / 0.55;
    const thin = u < 0.45 ? 1 : 1 - 0.7 * (u - 0.45) / 0.55;
    const pt = (t, side, wd) => {
      const along = (t - 0.5) * len, off = bend * Math.sin(Math.PI * t) + side * wd * Math.sin(Math.PI * t) * thin;
      return [x + ca * along - sa * off, y + sa * along + ca * off];
    };
    const poly = (wd) => {
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) { const [px, py] = pt((reach * i) / steps, 1, wd); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      for (let i = steps; i >= 0; i--) { const [px, py] = pt((reach * i) / steps, -1, wd); ctx.lineTo(px, py); }
      ctx.closePath(); ctx.fill();
    };
    // 어두운 테두리 → 직업색 날 → 흰 심. 하얗게 번쩍이는 적 위에서도 자국이 또렷하게 보인다
    ctx.save();
    ctx.globalAlpha = 0.55 * fade;
    ctx.fillStyle = '#0b0d14'; poly(width + 2);
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.globalAlpha = fade;
    ctx.fillStyle = color; poly(width);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff'; poly(width * 0.4);
    // 그어지는 순간 칼끝에 맺히는 빛
    if (reach < 1) { const [hx, hy] = pt(reach, 0, 0); dot(hx, hy, 3, '#ffffff'); }
    ctx.restore();
  });
}

// 타격점: 하얀 섬광 원 + 사방으로 뻗는 불꽃 줄 + 퍼지는 충격파 + 빛나는 파편 (+ 세면 흙먼지·땅 고리)
function hitFx(x, y, color, pow = 1) {
  const n = Math.round(4 + 2 * pow), len = 8 + 6 * pow, rot = rand(0, Math.PI);
  skFx(null, 0, 0.2, (u) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let j = 0; j < n; j++) {
      const ang = rot + (j / n) * Math.PI * 2 + (j % 2) * 0.2, l = len * (j % 2 ? 0.6 : 1);
      const r0 = l * easeOut(u) * 0.6, r1 = l * (0.3 + easeOut(u));
      ctx.globalAlpha = 0.8 * (1 - u);
      ctx.strokeStyle = color; ctx.lineWidth = 2 * (1 - u) + 0.5;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0); ctx.lineTo(x + Math.cos(ang) * r1, y + Math.sin(ang) * r1); ctx.stroke();
    }
    ctx.restore();
  });
  skFx(null, 0, 0.28, (u) => {
    ctx.save();
    ctx.globalAlpha = (1 - u) * 0.55;
    ctx.strokeStyle = color; ctx.lineWidth = 2 * (1 - u) + 0.5;
    ctx.beginPath(); ctx.arc(x, y, 4 + 12 * pow * easeOut(u), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  });
  for (let j = 0; j < Math.round(5 * pow); j++) {
    const ang = rand(0, Math.PI * 2), v = rand(60, 150) * Math.sqrt(pow);
    parts.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 40, g: 320, size: Math.random() < 0.3 ? 3 : 2, color: j % 3 ? color : '#ffffff', life: rand(0.25, 0.5), t: 0, add: true });
  }
  if (pow >= 2) {
    ringFx(x, color, 0.4 * pow, 0.4);
    debris(x, Math.round(3 * pow), ['#c9b38a', '#a8946a']);
  }
}

// 시전 중 기사 주변에 직업색 기운이 피어오른다 (2차는 더 크고 진하게). 오라는 기사 뒤에 그린다 (world.js render)
function auraTick(c) {
  if (c.a.u >= 0.95 || Math.random() > (skillTier(c.k) >= 2 ? 0.9 : 0.45)) return;
  const x = c.a.px(), gy = groundY();
  parts.push({ x: x + rand(-12, 12), y: gy - rand(2, 30), vx: rand(-8, 8), vy: rand(-90, -40), g: -30, size: Math.random() < 0.3 ? 3 : 2,
    color: Math.random() < 0.65 ? c.a.color : '#ffffff', life: rand(0.3, 0.6), t: 0, add: true });
}
function drawAuras() {
  for (const c of casts) {
    const t2 = skillTier(c.k) >= 2, k = Math.sin(Math.PI * Math.min(1, c.a.u * 1.2));
    if (k <= 0.02) continue;
    const pose = c.fx.pose ? c.fx.pose(c.a.u, c.a) : {};
    if (pose.alpha === 0) continue;
    const x = c.a.px(), y = groundY() - 24 - (pose.lift || 0), r = t2 ? 46 : 32;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (t2 ? 0.38 : 0.25) * k * (0.85 + 0.15 * Math.sin(clock * 20));
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, c.a.color); grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    if (t2) {
      // 발밑에 도는 빛 고리
      ctx.strokeStyle = c.a.color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7 * k;
      ctx.beginPath(); ctx.ellipse(x, groundY() - 1, 22 + 3 * Math.sin(clock * 8), 5, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}

// ───────────────────────── 직업별 스킬 연출 ─────────────────────────
const DRAGON_HEAD = [
  '..hhh.......',
  '.hHHHhhh....',
  'hHHeHHHHhh..',
  'hHHHHHHHHHw.',
  '.hHHHHhw.w..',
  '..hhh.......',
  '.hHHHHw.w...',
  '..hhHHHHHw..',
  '....hhhh....',
];
const DRAGON_PAL = { h: '#3b2458', H: '#b388ff', e: '#ffe066', w: '#ffffff' };

const SKILL_FX = {
  // ── 검사: 강철 베기 — 치켜들었다가 크게 내려벤다 ──
  steelCleave: {
    pose(u) {
      if (u < 0.4) { const w = easeOut(segU(u, 0, 0.4)); return { wa: mix(-1.0, -2.3, w), skew: -0.25 * w, sy: 1 - 0.08 * w, dx: -2 * w }; }
      if (u < 0.6) { const d = easeIn(segU(u, 0.4, 0.5)); return { wa: mix(-2.3, 1.0, d), skew: mix(-0.25, 0.35, d), sy: mix(0.92, 1.04, d), dx: mix(-2, 8, d) }; }
      const r = easeOut(segU(u, 0.6, 1));
      return { wa: mix(1.0, -1.0, r), skew: 0.35 * (1 - r), dx: 8 * (1 - r) };
    },
    cues: [[0.3, (a) => { const h = hand(a); starFx(h.x - a.dir * 8, h.y - 22, 6, '#ffffff', 0.25); }]],
    hit(a) {
      const h = hand(a);
      crescentFx(h.x, h.y, 30, -2.6, 1.0, a.dir, '#cfe0ff', 4, 0.32);
      crescentFx(h.x, h.y, 23, -2.4, 0.9, a.dir, a.color, 2, 0.3);
      for (const t of a.targets()) slashMarkFx(t.x, t.y - 4, flipA(1.15, a.dir), 52, a.color, 6, 0.42, 0, a.dir * 8);
      for (const t of a.targets()) burst(t.x, t.y, 12, ['#ffffff', a.color, '#cfe0ff'], 140);
      impact({ stop: 0.04, shake: 0.12 });
    },
    kb: 14,
  },

  // ── 창기사: 관통 찌르기 — 웅크렸다가 돌진하며 찌른다 ──
  piercingThrust: {
    pose(u) {
      if (u < 0.35) { const w = easeOut(segU(u, 0, 0.35)); return { wa: mix(-1.3, -0.05, w), ext: -6 * w, dx: -5 * w, sy: 1 - 0.1 * w, skew: -0.2 * w }; }
      if (u < 0.55) { const d = easeOut(segU(u, 0.35, 0.45)); return { wa: 0, ext: mix(-6, 18, d), dx: mix(-5, 14, d), skew: mix(-0.2, 0.3, d), sy: mix(0.9, 1, d) }; }
      const r = easeOut(segU(u, 0.55, 1));
      return { wa: mix(0, -1.3, r), ext: 18 * (1 - r), dx: 14 * (1 - r), skew: 0.3 * (1 - r) };
    },
    cues: [[0.36, (a) => {
      const x = a.x();
      for (let i = 0; i < 6; i++) parts.push({ x: x - a.dir * 4, y: groundY() - 2, vx: -a.dir * rand(40, 110), vy: rand(-50, -10), g: 200, size: 3, color: i % 2 ? '#c9b38a' : '#a8946a', life: rand(0.25, 0.4), t: 0 });
      ghostFx(a, x - a.dir * 5, a.dir, a.color, 0.25, { sy: 0.9 });
    }]],
    hit(a) {
      const h = hand(a), tips = a.targets();
      const far = Math.max(...tips.map((t) => (t.x - h.x) * a.dir)) + 34;
      streakFx(h.x, h.y, h.x + a.dir * far, h.y, a.color, 6, 0.28);
      starFx(h.x + a.dir * 50, h.y, 8, '#ffffff', 0.2);
      for (const t of tips) burst(t.x, t.y, 10, ['#ffffff', a.color], 130);
      impact({ stop: 0.04, shake: 0.1 });
    },
    kb: 12,
  },

  // ── 레인저: 연사 — 숨 돌릴 틈 없이 4발 ──
  rapidFire: {
    pose(u) {
      if (u < 0.1) return { pull: 9 * (u / 0.1) };
      if (u < 0.7) { const f = ((u - 0.1) % 0.15) / 0.15; return { pull: 9 * Math.min(1, f * 1.6), dx: -1.5 * (1 - f), sy: 1 + 0.03 * (1 - f) }; }
      return { pull: 0, dx: 0 };
    },
    hit(a, i, n) {
      const h = hand(a);
      for (const t of a.targets()) {
        streakFx(h.x + a.dir * 8, h.y, t.x, t.y, '#bfffd0', 3, 0.12);
        burst(t.x, t.y, 6, ['#ffffff', '#e8d9b0', a.color], 90);
      }
      burst(h.x + a.dir * 4, h.y, 4, ['#e9ffe9', a.color], 50, 2, 0);
      impact({ shake: i === n - 1 ? 0.1 : 0.04 });
    },
    kb: 6,
  },

  // ── 성기사: 심판의 일격 — 성검을 하늘로, 대상 위로 빛기둥 ──
  judgment: {
    pose(u) {
      if (u < 0.45) { const r = easeOut(segU(u, 0, 0.4)); return { wa: mix(-1.0, -1.57, r), sy: 1 + 0.06 * r, skew: -0.1 * r }; }
      if (u < 0.75) { const d = easeIn(segU(u, 0.45, 0.58)); return { wa: mix(-1.57, 0.7, d), skew: mix(-0.1, 0.3, d), dx: 4 * d }; }
      const r = easeOut(segU(u, 0.75, 1));
      return { wa: mix(0.7, -1.0, r), skew: 0.3 * (1 - r), dx: 4 * (1 - r) };
    },
    tick(a, u) {
      if (u > 0.05 && u < 0.45 && Math.random() < 0.6) {
        const h = hand(a);
        parts.push({ x: h.x + rand(-10, 10), y: h.y - rand(0, 20), vx: rand(-10, 10), vy: rand(-80, -40), g: -20, size: 2, color: Math.random() < 0.5 ? '#ffd257' : '#ffffff', life: 0.5, t: 0 });
      }
    },
    cues: [
      [0.2, (a) => { const h = hand(a); starFx(h.x, h.y - 26, 10, '#fff3b0', 0.4); }],
      [0.3, (a) => {
        for (const t of a.targets()) {
          aFx(a, 0, 0.3, (u) => { ctx.save(); ctx.globalAlpha = 0.5 + u * 0.5; ctx.fillStyle = '#ffd257'; ctx.fillRect(Math.round(t.x) - 1, 0, 2, groundY()); ctx.restore(); });
          ringFx(t.x, '#ffd257', 0.5, 0.3);
        }
      }],
    ],
    hit(a) {
      for (const t of a.targets()) {
        pillarFx(t.x, '#ffd257', 40, 0.6);
        ringFx(t.x, '#ffd257', 1.1, 0.6);
        ringFx(t.x, '#ffffff', 0.6, 0.4);
        starFx(t.x, t.y, 22, '#fff3b0', 0.35);
        burst(t.x, groundY() - 10, 26, ['#ffd257', '#ffffff', '#fff3b0'], 170, 3, 250);
      }
      impact({ stop: 0.1, shake: 0.3 });
    },
    kb: 16,
  },

  // ── 성기사: 성역 — 성검을 땅에 꽂아 황금 돔 ──
  sanctuary: {
    pose(u) {
      if (u < 0.35) { const r = segU(u, 0, 0.35); return { wa: mix(-1.0, -1.57, easeOut(r)), lift: 12 * Math.sin(Math.PI * r) }; }
      if (u < 0.5) { const d = easeIn(segU(u, 0.35, 0.48)); return { wa: mix(-1.57, 1.57, d), sy: mix(1, 0.86, d) }; }
      return { wa: 1.57, sy: mix(0.86, 0.96, segU(u, 0.5, 1)) };
    },
    cues: [[0.48, (a) => {
      const h = hand(a), k = a.k;
      ringFx(h.x, '#ffd257', 1.2, 0.6);
      debris(h.x, 10, ['#c9b38a', '#ffd257']);
      impact({ stop: 0.06, shake: 0.15 });
      // 돔: 시전자를 따라다니며 보호막이 사라질 때까지 남는다
      const life = k.dur * 0.52 + k.ward.dur;
      aFx(a, 0, life, (u) => {
        const x = a.x(), gy = groundY();
        const grow = Math.min(1, u * life / 0.25), fade = u > 0.9 ? (1 - u) / 0.1 : 1;
        const rx = 34 * easeOut(grow), ry = 46 * easeOut(grow);
        ctx.save();
        ctx.globalAlpha = fade * (0.85 + 0.15 * Math.sin(clock * 6));
        ctx.fillStyle = 'rgba(255,215,90,0.13)';
        ctx.beginPath(); ctx.ellipse(x, gy, rx, ry, 0, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = '#ffd257'; ctx.lineWidth = 2; ctx.shadowColor = '#ffd257'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.ellipse(x, gy, rx, ry, 0, Math.PI, 0); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x, gy, rx * 0.8, ry * 0.85, 0, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
        ctx.restore();
      }, null, () => {
        if (Math.random() < 0.35) parts.push({ x: a.x() + rand(-28, 28), y: groundY() - 2, vx: 0, vy: rand(-60, -30), g: -10, size: 2, color: Math.random() < 0.5 ? '#ffd257' : '#ffffff', life: 0.7, t: 0 });
      });
    }]],
    kb: 3,
  },

  // ── 검성: 질풍난무 — 사라졌다가 적 사이를 오가며 6번, 마지막 X자 ──
  gale: {
    pose(u) {
      if (u < 0.1) { const c = segU(u, 0, 0.1); return { sy: 1 - 0.15 * c, skew: 0.2 * c, wa: mix(-1.0, 2.4, c), wa2: mix(-0.6, 2.6, c) }; }
      if (u < 0.74) return { alpha: 0, wa: 2.4 };
      if (u < 0.86) { const r = segU(u, 0.74, 0.8); return { alpha: r, wa: -2.2, wa2: -2.6, skew: -0.15, sy: 0.95 }; }
      const d = easeOut(segU(u, 0.86, 0.92)), r = segU(u, 0.92, 1);
      return { wa: mix(-2.2, 1.0, d), wa2: mix(-2.6, 0.6, d), skew: 0.3 * (1 - r), dx: 6 * d * (1 - r) };
    },
    cues: [
      [0.1, (a) => {
        const x = a.x();
        burst(x, groundY() - 24, 14, ['#ff4d4d', '#1a1b22', '#ffffff'], 120);
        streakFx(x, groundY() - 24, a.tx(), groundY() - 24, '#ff4d4d', 4, 0.15);
      }],
      [0.74, (a) => burst(a.x(), groundY() - 24, 10, ['#ff4d4d', '#ffffff'], 90)],
    ],
    hit(a, i, n) {
      const t = a.targets()[0];
      if (i < n - 1) {
        const side = i % 2 ? 1 : -1;
        ghostFx(a, t.x + side * 18, -side, '#ff4d4d', 0.28, { wa: side > 0 ? 0.9 : -2.2, wa2: 0.5 });
        slashMarkFx(t.x, t.y, rand(-0.9, 0.9) + (i % 2 ? Math.PI / 2 : 0), 48, '#ff4d4d', 4, 0.3, 0, rand(-6, 6));
        burst(t.x, t.y, 6, ['#ffffff', '#ff4d4d'], 90);
        impact({ stop: 0.02, shake: 0.06 });
        return;
      }
      for (const tt of a.targets()) {
        xslashFx(tt.x, tt.y, 22, '#ff3040', 0.4);
        burst(tt.x, tt.y, 24, ['#ffffff', '#ff4d4d', '#1a1b22'], 160);
      }
      impact({ stop: 0.12, shake: 0.3 });
    },
    kb: 6,
  },

  // ── 검성: 일섬 — 숨죽인 발도, 섬광, 늦게 터지는 베기 ──
  iaido: {
    pose(u, a) {
      const D = Math.max(20, Math.abs(a.tx() - a.x()) + 34);
      if (u < 0.45) { const s = easeOut(segU(u, 0, 0.15)); return { sy: 1 - 0.12 * s, skew: 0.15 * s, wa: mix(-1.0, 2.5, s), wa2: mix(-0.5, 2.7, s) }; }
      if (u < 0.52) { const d = easeOut(segU(u, 0.45, 0.52)); return { dx: D * d, skew: 0.4, wa: 0.15, wa2: 0.35, sy: 0.9, alpha: 0.4 + 0.6 * d }; }
      if (u < 0.85) return { dx: D, skew: 0.25, wa: 0.15, wa2: 0.35, sy: 0.92 };
      const r = easeOut(segU(u, 0.85, 1));
      return { dx: D * (1 - r), wa: mix(0.15, -1.0, r), wa2: mix(0.35, -0.6, r) };
    },
    cues: [
      [0.32, (a) => { const h = hand(a); starFx(h.x - a.dir * 12, h.y + 4, 12, '#ffffff', 0.3); }],
      [0.46, (a) => {
        const y = groundY() - 26, x = a.x(), far = Math.abs(a.tx() - x) + 60;
        slashMarkFx(x + a.dir * far / 2, y, a.dir > 0 ? 0 : Math.PI, far, '#ff3040', 3, 0.55);
        for (let i = 1; i <= 3; i++) ghostFx(a, x + a.dir * (Math.abs(a.tx() - x) + 34) * (i / 4), a.dir, '#ff4d4d', 0.3, { wa: 0.15, skew: 0.4 });
        
      }],
    ],
    hit(a) {
      for (const t of a.targets()) {
        xslashFx(t.x, t.y, 28, '#ff3040', 0.45);
        burst(t.x, t.y, 30, ['#ffffff', '#ff3040', '#1a1b22'], 190, 3);
      }
      impact({ stop: 0.18, shake: 0.4 });
    },
    kb: 20,
  },

  // ── 용기병: 용추락 — 화면 밖으로 솟구쳤다가 유성처럼 내리꽂힌다 ──
  dragonFall: {
    pose(u, a) {
      const D = Math.max(0, Math.abs(a.tx() - a.x()) - 14);
      if (u < 0.15) { const c = segU(u, 0, 0.15); return { sy: 1 - 0.2 * c, sx: 1 + 0.1 * c, wa: -1.3 }; }
      if (u < 0.45) { const r = easeOut(segU(u, 0.15, 0.42)); return { lift: 170 * r, wa: -1.57, sy: 1.1 }; }
      if (u < 0.6) return { lift: 170, dx: D * segU(u, 0.45, 0.6), wa: 1.57 };
      if (u < 0.72) { const f = easeIn(segU(u, 0.6, 0.72)); return { lift: 170 * (1 - f), dx: D, wa: 1.57, sy: 1.15 }; }
      if (u < 0.85) return { dx: D, sy: mix(0.8, 1, segU(u, 0.72, 0.85)), wa: 1.2 };
      const b = segU(u, 0.85, 1);
      return { dx: D * (1 - b), lift: 30 * Math.sin(Math.PI * b), wa: -1.3 };
    },
    cues: [
      [0.15, (a) => { ringFx(a.x(), 'rgba(214,196,150,0.9)', 0.5, 0.4); debris(a.x(), 8, ['#c9b38a', '#a8946a']); }],
      [0.45, (a) => {
        aFx(a, 0, 0.3, (u) => {
          const x = a.tx() - a.dir * 4, gy = groundY();
          ctx.save();
          ctx.globalAlpha = 0.4 + 0.5 * u;
          ctx.strokeStyle = '#b388ff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(x, gy - 1, 34 * (1 - u * 0.6), 6 * (1 - u * 0.6), 0, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        });
      }],
      [0.6, (a) => { const x = a.tx() - a.dir * 4; meteorFx(x - a.dir * 40, -20, x, groundY() - 12, '#b388ff', 12, 0.13); }],
    ],
    hit(a) {
      const x = a.tx() - a.dir * 4;
      ringFx(x, '#b388ff', 1.3, 0.6);
      ringFx(x, '#ffffff', 0.7, 0.35);
      cracksFx(x, x + 90, '#c0a0ff', 0.9);
      cracksFx(x, x - 90, '#c0a0ff', 0.9);
      debris(x, 22, ['#5a4a42', '#b388ff', '#c9b38a'], 1.4);
      for (const t of a.targets()) burst(t.x, t.y, 14, ['#ffffff', '#b388ff'], 140);
      impact({ stop: 0.12, shake: 0.4 });
    },
    kb: 16,
  },

  // ── 용기병: 용의 숨결 — 창끝의 용이 보라 불꽃을 쏟는다 ──
  dragonBreath: {
    pose(u) {
      if (u < 0.2) { const r = easeOut(segU(u, 0, 0.2)); return { skew: -0.3 * r, wa: mix(-1.3, -0.35, r), dx: -3 * r }; }
      if (u < 0.9) return { skew: 0.15, wa: 0.05 + Math.sin(clock * 40) * 0.03, dx: Math.sin(clock * 55), ext: 4 };
      const r = easeOut(segU(u, 0.9, 1));
      return { wa: mix(0.05, -1.3, r), skew: 0.15 * (1 - r) };
    },
    tick(a, u) {
      const h = hand(a), tip = { x: h.x + a.dir * 26, y: h.y - 2 };
      if (u < 0.2) gatherFx(tip.x, tip.y, ['#b388ff', '#ffffff'], 2, 24);
      else if (u < 0.9) {
        for (let i = 0; i < 3; i++) {
          parts.push({ x: tip.x + a.dir * 12, y: tip.y + rand(-3, 3), vx: a.dir * rand(170, 260), vy: rand(-35, 35), g: -40, size: Math.random() < 0.4 ? 4 : 3,
            color: ['#b388ff', '#e0c8ff', '#7a3cff', '#ffffff'][i + (Math.random() < 0.5 ? 0 : 1)], life: rand(0.3, 0.5), t: 0 });
        }
      }
    },
    cues: [[0.2, (a) => {
      impact({ shake: 0.12 });
      aFx(a, 0, a.k.dur * 0.7, (u) => {
        const h = hand(a), x = h.x + a.dir * 22, k = u < 0.1 ? u / 0.1 : u > 0.85 ? (1 - u) / 0.15 : 1;
        drawSprite(DRAGON_HEAD, DRAGON_PAL, x + Math.sin(clock * 30), h.y + 15, 3, { flip: a.dir < 0, alpha: k });
      });
    }]],
    hit(a, i, n) {
      for (const t of a.targets()) burst(t.x, t.y, i === n - 1 ? 16 : 5, ['#b388ff', '#ffffff', '#7a3cff'], i === n - 1 ? 140 : 70);
      impact({ shake: i === n - 1 ? 0.2 : 0.05 });
    },
    kb: 5,
  },

  // ── 할버디어: 대회전 — 두 바퀴 돌며 주변을 쓸어 날린다 ──
  whirlwind: {
    pose(u) {
      if (u < 0.12) { const w = segU(u, 0, 0.12); return { wa: mix(-1.35, -2.8, w), skew: -0.2 * w, sy: 1 - 0.08 * w }; }
      if (u < 0.9) {
        const s = segU(u, 0.12, 0.9), e = s < 0.5 ? 2 * s * s : 1 - 2 * (1 - s) ** 2;
        const ang = -2.8 + e * Math.PI * 4, front = Math.cos(ang) >= 0;
        return { facing: front ? 1 : -1, wa: front ? ang : Math.PI - ang, sy: 0.94, lift: 2 * Math.abs(Math.sin(ang)) };
      }
      const r = easeOut(segU(u, 0.9, 1));
      return { wa: mix(-2.8, -1.35, r) };
    },
    cues: [[0.12, (a) => {
      ringFx(a.x(), '#ff9f40', 0.8, 0.5);
      const life = a.k.dur * 0.78;
      aFx(a, 0, life, (u) => {
        const x = a.x(), y = groundY() - HAND_Y;
        const fade = u > 0.85 ? (1 - u) / 0.15 : 1;
        ctx.save();
        ctx.lineCap = 'round';
        for (let j = 0; j < 2; j++) {
          const base = clock * 16 + j * Math.PI;
          ctx.globalAlpha = 0.75 * fade;
          ctx.strokeStyle = '#ff9f40'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.ellipse(x, y, 54, 16, 0, base - 1.4, base); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.globalAlpha = fade;
          ctx.beginPath(); ctx.ellipse(x, y, 54, 16, 0, base - 0.4, base); ctx.stroke();
        }
        ctx.restore();
      }, null, () => {
        const x = a.x();
        if (Math.random() < 0.7) parts.push({ x: x + rand(-30, 30), y: groundY() - 2, vx: rand(-80, 80), vy: rand(-40, -10), g: 200, size: 3, color: '#c9b38a', life: 0.35, t: 0 });
      });
    }]],
    hit(a, i, n) {
      for (const t of a.targets()) burst(t.x, t.y, 12, ['#ff9f40', '#ffffff', '#ffd257'], 150);
      impact({ stop: 0.05, shake: 0.18 });
      if (i === n - 1) ringFx(a.x(), '#ff9f40', 1.2, 0.45);
    },
    kb: 24,
  },

  // ── 할버디어: 대지 가르기 — 뛰어올라 내리찍으면 땅이 갈라지며 바위가 솟는다 ──
  earthSplitter: {
    pose(u) {
      if (u < 0.18) { const c = segU(u, 0, 0.18); return { sy: 1 - 0.18 * c, wa: mix(-1.35, -2.0, c) }; }
      if (u < 0.42) { const j = segU(u, 0.18, 0.42); return { lift: 46 * Math.sin((Math.PI / 2) * j), wa: mix(-2.0, -2.9, j), skew: -0.2 }; }
      if (u < 0.52) { const s = easeIn(segU(u, 0.42, 0.52)); return { lift: 46 * (1 - s), wa: mix(-2.9, 1.1, s), skew: mix(-0.2, 0.4, s) }; }
      if (u < 0.8) return { wa: 1.1, sy: 0.84, skew: 0.4 };
      const r = easeOut(segU(u, 0.8, 1));
      return { wa: mix(1.1, -1.35, r), sy: mix(0.84, 1, r), skew: 0.4 * (1 - r) };
    },
    cues: [[0.52, (a) => {
      const h = hand(a), x0 = h.x + a.dir * 40;
      const far = Math.max(220, Math.max(...a.targets().map((t) => (t.x - x0) * a.dir)) + 50);
      impact({ stop: 0.12, shake: 0.45 });
      ringFx(x0, '#ff9f40', 1, 0.5);
      debris(x0, 16, ['#5a4a42', '#c9b38a', '#ff9f40']);
      cracksFx(x0, x0 + a.dir * far, '#ff9f40', 1.3, 0.3);
      const n = Math.round(far / 34);
      for (let i = 0; i < n; i++) {
        const x = x0 + a.dir * (20 + i * 34);
        skLater(a, i * 0.035, () => { spikeFx(x, 18 + rand(0, 14), '#ff9f40', 0.55); debris(x, 4, ['#5a4a42', '#c9b38a']); });
      }
    }]],
    hit(a) {
      for (const t of a.targets()) burst(t.x, t.y, 16, ['#ff9f40', '#ffffff', '#5a4a42'], 150);
    },
    kb: 10, launch: true,
  },

  // ── 저격수: 헤드샷 — 무릎 꿇고 조준, 급소를 꿰뚫는다 ──
  headshot: {
    pose(u) {
      if (u < 0.15) { const k = segU(u, 0, 0.15); return { sy: 1 - 0.16 * k, dx: -2 * k, pull: 0 }; }
      if (u < 0.7) return { sy: 0.84, dx: -2, pull: 11 * easeOut(segU(u, 0.15, 0.6)) };
      if (u < 0.85) return { sy: 0.84, dx: -2 - 5 * easeOut(segU(u, 0.7, 0.76)), pull: 0 };
      const r = segU(u, 0.85, 1);
      return { sy: mix(0.84, 1, r), dx: -7 * (1 - r), pull: 0 };
    },
    cues: [
      [0.15, (a) => {
        aFx(a, 0, a.k.dur * 0.6, (u) => {
          const x = a.tx(), y = a.ty() - 8, r = mix(26, 7, easeOut(u));
          ctx.save();
          ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#ffe066';
          ctx.fillRect(Math.round(x - r - 6), Math.round(y), 8, 1); ctx.fillRect(Math.round(x + r - 2), Math.round(y), 8, 1);
          ctx.fillRect(Math.round(x), Math.round(y - r - 6), 1, 8); ctx.fillRect(Math.round(x), Math.round(y + r - 2), 1, 8);
          if (Math.sin(clock * 30) > 0) { ctx.fillStyle = '#ff3b3b'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); }
          ctx.restore();
        });
      }],
      [0.7, (a) => {
        const h = hand(a);
        streakFx(h.x + a.dir * 8, h.y, a.tx(), a.ty() - 8, '#ffe066', 3, 0.16);
        burst(h.x + a.dir * 6, h.y, 6, ['#ffffff', '#ffe066'], 60, 2, 0);
      }],
    ],
    hit(a) {
      for (const t of a.targets()) {
        burst(t.x, t.y - 8, 20, ['#ffffff', '#ff3b3b', '#ffe066'], 160);
        starFx(t.x, t.y - 8, 14, '#ffe066', 0.3);
        addFloater('HEADSHOT!', t.x, (t.top || t.y - 20) - 22, '#ffe066', 13);
      }
      impact({ stop: 0.14, shake: 0.25 });
    },
    kb: 34,
  },

  // ── 저격수: 철갑 관통탄 — 끝까지 당겨 화면 끝까지 꿰뚫는다. 반동에 밀려난다 ──
  armorPiercer: {
    pose(u) {
      if (u < 0.5) { const d = easeOut(segU(u, 0, 0.5)); return { pull: 13 * d, skew: -0.15 * d, sy: 1 - 0.05 * d }; }
      if (u < 0.58) { const r = easeOut(segU(u, 0.5, 0.58)); return { pull: 0, dx: -12 * r, skew: -0.3 }; }
      const r = segU(u, 0.7, 1);
      return { pull: 0, dx: -12 * (1 - r), skew: -0.3 * (1 - r) };
    },
    tick(a, u) {
      if (u < 0.5) { const h = hand(a); gatherFx(h.x + a.dir * 18, h.y, ['#ffe066', '#ffffff'], 1, 22); }
    },
    cues: [[0.5, (a) => {
      const h = hand(a), end = a.dir > 0 ? W + 20 : -20;
      streakFx(h.x + a.dir * 8, h.y, end, h.y, '#ffe066', 10, 0.4);
      aFx(a, 0, 0.3, (u) => {
        ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2;
        for (const k of [0.6, 1]) { ctx.beginPath(); ctx.ellipse(h.x + a.dir * (10 + u * 30 * k), h.y, 3 + u * 4, 8 + u * 18 * k, 0, 0, Math.PI * 2); ctx.stroke(); }
        ctx.restore();
      });
      for (let i = 0; i < 8; i++) parts.push({ x: a.x(), y: groundY() - 2, vx: -a.dir * rand(60, 140), vy: rand(-60, -10), g: 200, size: 3, color: '#c9b38a', life: 0.4, t: 0 });
      impact({ stop: 0.08, shake: 0.3 });
    }]],
    hit(a) {
      for (const t of a.targets()) burst(t.x, t.y, 18, ['#ffe066', '#ffffff'], 160);
    },
    kb: 22,
  },

  // ── 마궁수: 유도 마탄 — 등 뒤 마법진에서 마력탄 6발이 휘어 날아간다 ──
  homingBolts: {
    pose(u) {
      if (u < 0.3) return { pull: 8 * segU(u, 0, 0.3), bowA: -0.25 * segU(u, 0, 0.3) };
      if (u < 0.6) return { pull: 8 * (1 - segU(u, 0.3, 0.55)), bowA: -0.25 };
      return { pull: 0, bowA: -0.25 * (1 - segU(u, 0.6, 1)) };
    },
    cues: [
      [0.02, (a) => circleFx(a, () => ({ x: a.x() - a.dir * 14, y: groundY() - 30 }), 9, 26, '#6ff3ff', a.k.dur * 0.9)],
      ...[0, 1, 2, 3, 4, 5].map((i) => [0.3 + i * 0.05, (a) => {
        const h = hand(a), x0 = a.x() - a.dir * 14, y0 = groundY() - 30 + (i - 2.5) * 6;
        const cx = x0 - a.dir * rand(10, 40), cy = h.y + (i % 2 ? -1 : 1) * rand(50, 80);
        const trail = [];
        aFx(a, 0, 0.3, (u) => {
          const tx = a.tx(), ty = a.ty();
          const x = (1 - u) ** 2 * x0 + 2 * (1 - u) * u * cx + u * u * tx, y = (1 - u) ** 2 * y0 + 2 * (1 - u) * u * cy + u * u * ty;
          trail.push([x, y]); if (trail.length > 7) trail.shift();
          trail.forEach(([px, py], j) => dot(px, py, 2, '#6ff3ff', ((j + 1) / trail.length) * 0.6));
          ctx.save(); ctx.shadowColor = '#6ff3ff'; ctx.shadowBlur = 8;
          dot(x, y, 5, '#6ff3ff', 0.6); dot(x, y, 3, '#ffffff');
          ctx.restore();
        });
      }]),
    ],
    hit(a, i, n) {
      for (const t of a.targets()) { burst(t.x, t.y, 8, ['#6ff3ff', '#ffffff'], 100, 2, 0); starFx(t.x, t.y, 6, '#6ff3ff', 0.18); }
      impact({ shake: 0.05 });
      if (i === n - 1) { ringFx(a.tx(), '#6ff3ff', 0.8, 0.4); impact({ stop: 0.05, shake: 0.18 }); }
    },
    kb: 5,
  },

  // ── 마궁수: 별빛 화살비 — 하늘에 마법진, 별빛 화살이 쏟아진다 ──
  starfall: {
    pose(u) {
      if (u < 0.25) return { bowA: -1.1 * easeOut(segU(u, 0, 0.15)), pull: 10 * segU(u, 0.05, 0.25) };
      if (u < 0.92) return { bowA: -1.1, pull: 0 };
      return { bowA: -1.1 * (1 - segU(u, 0.92, 1)), pull: 0 };
    },
    cues: [
      [0.25, (a) => { const h = hand(a); streakFx(h.x + a.dir * 4, h.y - 6, h.x + a.dir * 40, -10, '#6ff3ff', 3, 0.2); }],
      [0.3, (a) => {
        circleFx(a, () => ({ x: a.tx(), y: 34 }), 74, 9, '#6ff3ff', a.k.dur * 0.68);
      }],
    ],
    hit(a, i, n) {
      const cx = a.tx(), last = i === n - 1;
      const x1 = cx + (last ? 0 : rand(-46, 46)), x0 = x1 - a.dir * rand(14, 30);
      meteorFx(x0, 34, x1, groundY() - 6, i % 3 ? '#6ff3ff' : '#ffe066', last ? 7 : 4, 0.1, () => {
        burst(x1, groundY() - 6, last ? 22 : 8, ['#6ff3ff', '#ffffff', '#ffe066'], last ? 160 : 100, 2, 260);
        ringFx(x1, '#6ff3ff', last ? 0.9 : 0.35, 0.35);
      });
      impact(last ? { stop: 0.08, shake: 0.28 } : { shake: 0.06 });
    },
    kb: 4,
  },
};

// ───────────────────────── 그리기 ─────────────────────────
function drawSkillFx() {
  for (const f of skfx) if (f.draw && clock >= f.at) f.draw(f.life ? Math.min(1, (clock - f.at) / f.life) : 1);
}

// 2차 스킬 이름 띠 (화면 전체를 덮는 연출은 쓰지 않는다)
function drawScreenFx() {
  if (!cutin) return;
  // 띠가 옆에서 미끄러져 들어와 잠깐 멈췄다가 빠진다
  const t = cutin.t, k = cutin.k;
  const slide = t < 0.15 ? 1 - easeOut(t / 0.15) : t > 0.95 ? -easeIn((t - 0.95) / 0.25) : 0;
  const a = t > 0.95 ? Math.max(0, 1 - (t - 0.95) / 0.25) : 1;
  // 띠는 시전자 위쪽에 짧게 (레이드 보스 이름표·결투 상대와 덜 겹치게)
  const BW = 260, y = 3, h = 20;
  const cx = Math.max(BW / 2, Math.min(W - BW / 2, cutin.cx)) + slide * BW * 1.5, x = cx - BW / 2;
  ctx.save();
  ctx.globalAlpha = a * 0.85;
  const grad = ctx.createLinearGradient(x, 0, x + BW, 0);
  grad.addColorStop(0, 'rgba(10,12,20,0)'); grad.addColorStop(0.2, 'rgba(10,12,20,0.85)'); grad.addColorStop(0.8, 'rgba(10,12,20,0.85)'); grad.addColorStop(1, 'rgba(10,12,20,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, BW, h);
  ctx.fillStyle = cutin.color;
  ctx.fillRect(x + BW * 0.15, y, BW * 0.7, 2);
  ctx.fillRect(x + BW * 0.15, y + h - 2, BW * 0.7, 2);
  ctx.globalAlpha = a;
  ctx.font = 'bold 15px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  const label = `${k.icon} ${k.name}`;
  ctx.strokeText(label, cx, y + h / 2 + 1);
  ctx.fillStyle = cutin.color;
  ctx.fillText(label, cx, y + h / 2 + 1);
  ctx.restore();
}

// 원정 중 기사 체력바 위의 스킬 쿨타임 칸 (해금 레벨 순)
function drawSkillIcons(x, y) {
  const ids = stats().skills.slice().reverse();
  ids.forEach((id, i) => {
    const k = SKILLS[id], left = Math.max(0, knight.cds[id] || 0), ready = left <= 0;
    const bx = x + i * 13, sz = 11;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx - 1, y - 1, sz + 2, sz + 2);
    ctx.font = '8px -apple-system, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = ready ? 1 : 0.45;
    ctx.fillText(k.icon, bx + sz / 2, y + sz / 2 + 0.5);
    ctx.globalAlpha = 1;
    if (!ready) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx, y, sz, Math.round(sz * Math.min(1, left / k.cd)));
    } else {
      ctx.strokeStyle = CLASSES[k.cls].look.fx; ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(clock * 6);
      ctx.strokeRect(bx - 0.5, y - 0.5, sz + 1, sz + 1);
      ctx.globalAlpha = 1;
    }
  });
  ctx.textBaseline = 'alphabetic';
}
