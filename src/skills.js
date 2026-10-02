'use strict';
// 스킬: 원정에서 쓰기(쿨타임·대상·피해)와, 원정·결투·레이드 재생이 함께 쓰는 모션·이펙트·타격감.
// 수치(해금 레벨·쿨타임·배율·타격 시점)는 src/classes.js 의 SKILLS 에 있고, 여기 SKILL_FX[id] 는 보이는 것만 정한다.
//   pose(u, a)  시전 진행도 u(0→1)의 기사 자세 { dx 앞으로, lift 위로, sx·sy 늘림, skew 기울임, wa·wa2 무기 각도, ext 창 내밀기,
//               pull 시위 당김, bowA 활 기울기, alpha, facing } — drawHero 가 그린다
//   cues: [[u, fn(a)]]  그 시점에 한 번 나오는 연출
//   hit(a, i, n)  i 번째 타격 순간의 연출 (피해는 원정에서만 a.onHit 이 넣는다. 재생은 숫자만 띄운다)
//   tick(a, u, dt)  매 프레임 연출 (불꽃·기 모으기)
//   kb: 원정에서 맞은 적이 밀려나는 거리 · launch: 맞은 적을 공중에 띄운다
// a(시전 정보): { owner, id, k, cls, color, dir 바라보는 쪽, x() 시전자 화면 x, tx()·ty() 대상 위치, targets() [{x, y}], u, onHit, onEnd,
//               lv 스킬 숙련도(없으면 내 기사는 내 숙련도, 남은 1), mast 숙련 단계 0~3 (classes.js MASTERY) }
//
// 숙련 단계(Lv10·20·30)는 스킬마다 따로 그리지 않고 공통 레이어로 덧입힌다:
//   ★ 숙련  타격 레이어 세기 +15%, 타격마다 직업색 파편
//   ★★ 달인  + 발밑 빛 고리(1차도), 잔상이 짙어짐, 세기 +30%
//   ★★★ 극의 + 이펙트 색이 금빛으로 물듦, 이름 띠(1차도), 시전 끝 마무리 섬광, 세기 +45%
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
const MASTERY_GOLD = '#fff0b8';
// '#rrggbb' 두 색을 u 만큼 섞는다
function mixHex(c1, c2, u) {
  const p = (c, i) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(mix(p(c1, i), p(c2, i), u)).toString(16).padStart(2, '0')).join('');
}

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
  // 숙련 단계마다 기술의 모양이 다르다 (classes.js stages): 타격 횟수·시전 시간·마무리 일격
  const lv = a.lv || (owner === 'hero' ? skillLv(id) : 1);
  const k = skillAt(id, lv), fx = SKILL_FX[id];
  Object.assign(a, { owner, id, k, u: 0, color: CLASSES[a.cls || S.cls].look.fx });
  a.cls = a.cls || S.cls;
  a.lv = lv;
  a.mast = masteryOf(a.lv);
  if (a.mast >= 3) a.color = mixHex(a.color, MASTERY_GOLD, 0.45);
  a.targets = a.targets || (() => [{ x: a.tx(), y: a.ty() }]);
  // 화면에서 시전자가 실제로 서 있는 x. 자세가 뒤돌아(facing -1) 있으면 dx 도 뒤집혀 있다
  a.px = () => {
    if (!fx.pose) return a.x();
    const p = fx.pose(a.u, a);
    return a.x() + (p.dx || 0) * (p.facing || 1) * a.dir;
  };
  casts.push({ owner, id, k, fx, t: 0, a, hi: 0, ci: 0, next: [], squash: 0, hist: [] });
  // 숙련도를 키운 스킬은 이름 옆에 레벨과 단계 별을 붙여서, 먹인 비전서가 전투에 보이게 한다
  const star = (a.lv > 1 ? ` Lv${a.lv}` : '') + (a.mast ? ' ' + MASTERY[a.mast].star : '');
  if (skillTier(k) >= 2 || a.mast >= 3) cutin = { k, color: a.color, t: 0, cx: a.x(), star };
  else addFloater(`${k.icon} ${k.name}${star}`, a.x(), groundY() - 72, a.color, 12);
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
  const h = c.hist, fx = c.a.mast >= 3 ? c.a.color : CLASSES[cls].look.fx;
  for (let j = h.length - 1; j >= 1; j--) {
    const p = h[j].p, q = h[j - 1].p;
    const off = (r) => (r.dx || 0) * (r.facing || facing);         // 화면에서의 이동량 (뒤돌면 dx 부호가 바뀐다)
    const body = Math.abs(off(q) - off(p)) + Math.abs((q.lift || 0) - (p.lift || 0));
    const arm = Math.abs((q.wa || 0) - (p.wa || 0)) * 14 + Math.abs((q.ext || 0) - (p.ext || 0)) + Math.abs((q.pull || 0) - (p.pull || 0));
    if (body + arm < 1.5) continue;
    const fade = (1 - j / h.length) * (c.a.mast >= 2 ? 1.5 : 1), al = p.alpha == null ? 1 : p.alpha;
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
    // cues 는 [[시점, fn]] 목록, 또는 숙련 단계마다 시전 시간이 달라서 시전 정보로 목록을 만드는 함수
    const cues = typeof c.fx.cues === 'function' ? (c.cueList || (c.cueList = c.fx.cues(c.a))) : c.fx.cues || [];
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
      if (c.a.mast >= 3) masteryFinish(c.a);
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
  if (w.left > 0) return;
  knight.ward = null;
  // ★★★ 극의 성역: 보호막이 끝나는 순간 성광이 터진다
  if (w.finish) {
    for (const m of skillTargets({ area: 'all', radius: 56 }, st)) hitMonster(m, w.finish, { kb: 16, color: '#fff3b0' });
    if (SKILL_FX.sanctuary.finish) SKILL_FX.sanctuary.finish(w.a);
  }
}

// 교전 중 쿨타임이 찬 스킬이 있으면 쓴다 (해금 레벨 높은 것부터)
function tryCastSkill(st, target) {
  for (const id of st.skills) {
    if ((knight.cds[id] || 0) > 0) continue;
    const k = skillAt(id, skillLv(id)), fx = SKILL_FX[id];
    knight.cds[id] = skillCd(id);
    knight.swing = -1;
    let focus = target;
    const a = {
      cls: S.cls, dir: 1,
      x: () => toScreen(knight.x),
      tx: () => toScreen(focus.x) + focus.kb,
      ty: () => monsterMidY(focus),
      // i: 타격 번호 — 그 타격만의 범위가 있으면 그 범위의 대상 (classes.js hitRange)
      targets: (i) => {
        const list = skillTargets(i == null ? k : hitRange(k, i), stats());
        return (list.length ? list : [focus]).map((m) => ({ x: toScreen(m.x) + m.kb, y: monsterMidY(m), top: monsterTop(m) }));
      },
      onHit: (i) => {
        if (!k.hits.length) return;
        const hk = hitRange(k, i);
        const list = skillTargets(hk, stats());
        if (list.length) focus = list[0];
        for (const m of list) {
          // 여러 번 나눠 때리는 스킬은 숫자를 모아 두었다가 마지막 타격(또는 처치) 때 합쳐서 띄운다
          hitMonster(m, k.hits[i][1] * skillPow(id), { crit: k.crit, kb: k.kb != null ? k.kb : fx.kb != null ? fx.kb : 8, color: a.color, quiet: k.hits.length >= 6 && i < k.hits.length - 1 });
          if ((fx.launch || hk.launch) && !m.boss) m.air = 0;
        }
      },
      onEnd: () => {
        if (!k.ward) return;
        const max = stats().maxHp;
        knight.ward = { left: k.ward.dur, guard: k.ward.guard, tick: k.ward.tick * skillPow(id), acc: 0, finish: (k.ward.finish || 0) * skillPow(id), a };
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
function ghostFx(a, x, facing, tint, life, pose = {}, alpha = 0.35) {
  skFx(null, 0, life, (u) => {
    drawHero(ctx, a.cls, x, groundY(), { mode: 'fight', swing: -1, t: clock, facing, tint, alpha: alpha * (1 - u), ...pose });
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
  const mast = c.a.mast || 0;
  const pow = (t2 ? 1.35 : 1) * (share >= 0.5 ? 2 : share >= 0.2 ? 1.4 : 0.8) * (last && n > 1 ? 1.5 : 1) * (1 + 0.15 * mast);
  const tg = c.a.targets(i);
  // 숙련: 타격마다 직업색 파편 (극의는 금빛이 섞인다)
  if (mast) for (const t of tg) burst(t.x, t.y, Math.round((3 + 3 * mast) * Math.min(1.5, pow / 1.4)), [c.a.color, '#ffffff', mast >= 3 ? MASTERY_GOLD : c.a.color], 70 + 25 * mast, 2, 160);
  // 스킬마다 고유한 타격 이미지(fx.marks). 없으면 무기별 기본 검흔
  for (const t of tg) { hitFx(t.x, t.y, c.a.color, pow); (c.fx.marks || weaponMarks)(c.a, t, pow, i, n); }
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

// ───────────────────────── 스킬 전용 타격 이미지 ─────────────────────────
// 스킬마다 모양이 겹치지 않게 따로 그린다. 공통 규칙: 어두운 테두리 → 스킬 색 → 흰 심 (하얗게 번쩍이는 적 위에서도 또렷하게)
const OUTLINE = '#0b0d14';
const fadeOf = (u, hold = 0.45) => (u < hold ? 1 : 1 - (u - hold) / (1 - hold));

// 초승달 자국 (강철 베기): 두꺼운 반달이 위에서 아래로 그어지고, 바깥 테두리에 강철빛이 번뜩이며 쇳가루 불똥이 떨어진다
function crescentMarkFx(cx, cy, r, a0, a1, thick, color, life = 0.5, delay = 0, dir = 1) {
  const steps = 18;
  skFx(null, delay, life, (u) => {
    const reach = Math.min(1, u / 0.18), fade = fadeOf(u), th = thick * (u < 0.45 ? 1 : 1 - 0.6 * (u - 0.45) / 0.55);
    const ang = (v) => flipA(a0 + (a1 - a0) * v, dir);
    const lune = (outer, inner) => {
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) { const v = (reach * i) / steps, A = ang(v), R = r + outer * Math.sin(Math.PI * v); i ? ctx.lineTo(cx + Math.cos(A) * R, cy + Math.sin(A) * R) : ctx.moveTo(cx + Math.cos(A) * R, cy + Math.sin(A) * R); }
      for (let i = steps; i >= 0; i--) { const v = (reach * i) / steps, A = ang(v), R = r - inner * Math.sin(Math.PI * v); ctx.lineTo(cx + Math.cos(A) * R, cy + Math.sin(A) * R); }
      ctx.closePath(); ctx.fill();
    };
    ctx.save();
    ctx.globalAlpha = 0.6 * fade; ctx.fillStyle = OUTLINE; lune(2, th + 2);
    ctx.globalAlpha = fade; ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.fillStyle = color; lune(0, th);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e8f0ff'; lune(0, th * 0.45);       // 강철 날빛 (바깥쪽만)
    ctx.fillStyle = '#ffffff'; lune(0, th * 0.15);
    ctx.restore();
  }, null, (u) => {
    // 그어지는 동안 칼끝에서 쇳가루 불똥
    if (u > 0.2 || Math.random() > 0.8) return;
    const A = flipA(a0 + (a1 - a0) * Math.min(1, u / 0.18), dir);
    parts.push({ x: cx + Math.cos(A) * r, y: cy + Math.sin(A) * r, vx: rand(-40, 40) + dir * 40, vy: rand(-60, 10), g: 520, size: 2, color: Math.random() < 0.5 ? '#fff3b0' : '#ffffff', life: rand(0.3, 0.55), t: 0, add: true });
  });
}

// 성흔 (심판의 일격): 하늘에서 꽂힌 검 모양의 세로 빛 + 가로 빛이 십자를 이루고, 가운데 마름모 문장이 돌며 빛살이 퍼진다
function holyCrossFx(x, y, size, life = 0.7, delay = 0) {
  const gold = '#ffd257';
  skFx(null, delay, life, (u) => {
    const grow = easeOut(Math.min(1, u / 0.15)), fade = fadeOf(u, 0.5), s = size * (0.9 + 0.1 * grow);
    const blade = (x0, y0, x1, y1, w, color) => {
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + dx * 0.3 + nx * w, y0 + dy * 0.3 + ny * w);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x0 + dx * 0.3 - nx * w, y0 + dy * 0.3 - ny * w);
      ctx.closePath(); ctx.fill();
    };
    ctx.save();
    ctx.globalAlpha = fade;
    // 빛살 8줄 (천천히 돈다)
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = gold; ctx.lineWidth = 1;
    for (let j = 0; j < 8; j++) {
      const A = clock * 0.8 + (j / 8) * Math.PI * 2, r0 = s * 0.5, r1 = s * (0.9 + 0.5 * grow) * (j % 2 ? 0.7 : 1);
      ctx.globalAlpha = 0.5 * fade;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(A) * r0, y + Math.sin(A) * r0); ctx.lineTo(x + Math.cos(A) * r1, y + Math.sin(A) * r1); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.55 * fade;
    const vy0 = y - s * 1.7 * grow, vy1 = y + s * 0.75 * grow, hx = s * 0.6 * grow;
    blade(x, vy0 - 2, x, vy1 + 2, 6, OUTLINE); blade(x - hx - 2, y, x + hx + 2, y, 5, OUTLINE);
    ctx.globalAlpha = fade; ctx.shadowColor = gold; ctx.shadowBlur = 14;
    blade(x, vy0, x, vy1, 4.5, gold); blade(x - hx, y, x + hx, y, 3.5, gold);
    ctx.shadowBlur = 0;
    blade(x, vy0 + 4, x, vy1 - 2, 1.6, '#ffffff'); blade(x - hx + 3, y, x + hx - 3, y, 1.2, '#ffffff');
    // 가운데 문장: 도는 마름모 두 겹
    ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 1.5;
    for (const [rr, sp] of [[7, 2], [11, -1.4]]) {
      const A = clock * sp;
      ctx.beginPath();
      for (let j = 0; j < 4; j++) { const B = A + (j * Math.PI) / 2; j ? ctx.lineTo(x + Math.cos(B) * rr * grow, y + Math.sin(B) * rr * grow) : ctx.moveTo(x + Math.cos(B) * rr * grow, y + Math.sin(B) * rr * grow); }
      ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  });
}

// 머리카락 같은 일섬 (일섬): 실처럼 가는 흰 선이 먼저 그어지고, 잠시 뒤 위아래로 벌어지며 붉게 터진다
function razorFx(x0, x1, y, color, life = 0.6, delay = 0, split = true) {
  skFx(null, delay, life, (u) => {
    const reach = Math.min(1, u / 0.1), fade = fadeOf(u, 0.5);
    const xe = mix(x0, x1, reach);
    ctx.save();
    if (!split || u < 0.22) {
      ctx.globalAlpha = fade;
      ctx.fillStyle = OUTLINE; ctx.fillRect(Math.min(x0, xe), y - 1.5, Math.abs(xe - x0), 3);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.min(x0, xe), y - 0.5, Math.abs(xe - x0), 1);
    } else {
      // 벌어지는 두 줄 + 그 사이 붉은 빛
      const g = 1 + 5 * easeOut(segU(u, 0.22, 0.5));
      ctx.globalAlpha = 0.45 * fade; ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 12;
      ctx.fillRect(Math.min(x0, x1), y - g, Math.abs(x1 - x0), g * 2);
      ctx.shadowBlur = 0; ctx.globalAlpha = fade;
      for (const sgn of [-1, 1]) {
        ctx.fillStyle = OUTLINE; ctx.fillRect(Math.min(x0, x1), y + sgn * g - 1, Math.abs(x1 - x0), 2.5);
        ctx.fillStyle = sgn < 0 ? '#ffffff' : color; ctx.fillRect(Math.min(x0, x1), y + sgn * g - 0.5, Math.abs(x1 - x0), 1.2);
      }
    }
    ctx.restore();
  }, null, (u) => {
    // 벌어질 때 선을 따라 붉은 방울이 떨어진다
    if (!split || u < 0.22 || u > 0.5 || Math.random() > 0.7) return;
    parts.push({ x: mix(x0, x1, Math.random()), y: y + rand(-2, 2), vx: rand(-15, 15), vy: rand(-30, 20), g: 360, size: 2, color: Math.random() < 0.6 ? color : '#ffffff', life: rand(0.3, 0.5), t: 0 });
  });
}

// 나선 관통 (관통 찌르기): 곧은 찌르기 자국을 바람 고리 세 개가 감싸고 앞으로 밀려 나간다
function pierceSpiralFx(x, y, dir, len, color, life = 0.45, delay = 0) {
  slashMarkFx(x + dir * len * 0.3, y, dir > 0 ? 0 : Math.PI, len, color, 3.5, life, delay);
  skFx(null, delay, life, (u) => {
    const fade = fadeOf(u, 0.3);
    ctx.save();
    for (let j = 0; j < 3; j++) {
      const k = segU(u, j * 0.06, 0.5 + j * 0.06), px = x + dir * (len * 0.1 + j * 14 + 22 * easeOut(k)), ry = 4 + 7 * easeOut(k) - j;
      if (k <= 0) continue;
      ctx.globalAlpha = 0.6 * fade; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(px, y, 2.5, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = fade * (1 - k * 0.5); ctx.strokeStyle = j ? color : '#ffffff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(px, y, 2.5, ry, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  });
}

// 화살 박힘 (연사): 화살이 대상에 반쯤 박혀 깃이 파르르 떨다가 사라지고, 맞은 자리에 잎사귀 바람이 흩어진다
function arrowStuckFx(x, y, dir, color, life = 0.5, delay = 0) {
  const tilt = rand(-0.25, 0.25), depth = rand(4, 8);
  skFx(null, delay, life, (u) => {
    const fade = fadeOf(u, 0.6), wob = Math.sin(u * 60) * (1 - u) * 0.12;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(x - dir * depth, y);
    ctx.rotate((dir > 0 ? 0 : Math.PI) + tilt + wob);
    ctx.fillStyle = OUTLINE; ctx.fillRect(-23, -2.5, 23, 5); ctx.fillRect(-24, -5, 7, 10);
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-22, -1, 22, 2);
    ctx.fillStyle = color; ctx.fillRect(-23, -4, 6, 2); ctx.fillRect(-23, 2, 6, 2);           // 깃
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-23, -4, 2, 2); ctx.fillRect(-23, 2, 2, 2);
    ctx.restore();
  });
  for (let j = 0; j < 4; j++) parts.push({ x, y, vx: -dir * rand(20, 70), vy: rand(-60, -10), g: 60, size: 2, color: j % 2 ? color : '#bfffd0', life: rand(0.4, 0.7), t: 0 });
}

// 용 발톱 (용추락): 휘어진 발톱 자국 세 줄이 차례로 할퀴고 지나간다
function clawMarksFx(x, y, dir, color, size = 1, delay = 0) {
  for (let j = 0; j < 3; j++) {
    slashMarkFx(x + (j - 1) * 9 * size, y + (j - 1) * 3, flipA(1.15, dir), 46 * size, color, 4 * size, 0.55, delay + j * 0.045, dir * 7);
  }
}

// 용의 불꽃 자국 (용의 숨결): 보라 불꽃 혀가 대상에 들러붙어 날름거리다 연기로 사그라든다
function scorchFx(x, y, color, life = 0.5) {
  const tongues = Array.from({ length: 5 }, () => ({ dx: rand(-11, 11), dy: rand(-4, 10), h: rand(14, 22), ph: rand(0, 6) }));
  skFx(null, 0, life, (u) => {
    const fade = fadeOf(u, 0.4);
    ctx.save();
    for (const t of tongues) {
      const h = t.h * (1 - u * 0.6) * (0.8 + 0.2 * Math.sin(clock * 30 + t.ph)), bx = x + t.dx, by = y + t.dy;
      for (const [c, k] of [[OUTLINE, 1.25], [color, 1], ['#e0c8ff', 0.6], ['#ffffff', 0.25]]) {
        ctx.globalAlpha = (c === OUTLINE ? 0.5 : 1) * fade; ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(bx - 5 * k, by);
        ctx.quadraticCurveTo(bx - 3 * k, by - h * 0.6 * k, bx + Math.sin(clock * 20 + t.ph) * 3, by - h * k);
        ctx.quadraticCurveTo(bx + 3 * k, by - h * 0.6 * k, bx + 5 * k, by);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }, null, (u) => {
    if (u > 0.4 && Math.random() < 0.3) parts.push({ x: x + rand(-8, 8), y: y - 6, vx: rand(-6, 6), vy: rand(-40, -20), g: -10, size: 3, color: 'rgba(60,40,80,0.8)', life: 0.5, t: 0 });
  });
}

// 회전 베기 고리 (대회전): 대상을 기울어진 타원으로 한 바퀴 휘감아 베는 자국
function ringSlashFx(x, y, rx, ry, tiltA, color, life = 0.5, delay = 0) {
  const steps = 28;
  skFx(null, delay, life, (u) => {
    const reach = Math.min(1, u / 0.2), fade = fadeOf(u), th = 4 * (u < 0.45 ? 1 : 1 - 0.6 * (u - 0.45) / 0.55);
    const ct = Math.cos(tiltA), st = Math.sin(tiltA);
    const P = (v, off) => {
      const A = -Math.PI / 2 + v * Math.PI * 2, ex = Math.cos(A) * (rx + off), ey = Math.sin(A) * (ry + off * 0.4);
      return [x + ex * ct - ey * st, y + ex * st + ey * ct];
    };
    const band = (w) => {
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) { const v = (reach * i) / steps, [px, py] = P(v, w * Math.sin(Math.PI * Math.min(1, v * 1.1))); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      for (let i = steps; i >= 0; i--) { const v = (reach * i) / steps, [px, py] = P(v, -w * Math.sin(Math.PI * Math.min(1, v * 1.1))); ctx.lineTo(px, py); }
      ctx.closePath(); ctx.fill();
    };
    ctx.save();
    ctx.globalAlpha = 0.55 * fade; ctx.fillStyle = OUTLINE; band(th + 1.5);
    ctx.globalAlpha = fade; ctx.shadowColor = color; ctx.shadowBlur = 10; ctx.fillStyle = color; band(th);
    ctx.shadowBlur = 0; ctx.fillStyle = '#ffffff'; band(th * 0.35);
    ctx.restore();
  });
}

// 대지 파열 (대지 가르기): 땅에서 하늘로 솟구치는 거대한 쐐기 자국 + 갈라진 틈에서 새는 빛
function ruptureFx(x, color, h = 56, life = 0.6, delay = 0) {
  const gy = groundY();
  skFx(null, delay, life, (u) => {
    const grow = easeOut(Math.min(1, u / 0.14)), fade = fadeOf(u, 0.4), hh = h * grow, w = 9 * (u < 0.4 ? 1 : 1 - 0.6 * (u - 0.4) / 0.6);
    const wedge = (ww, top) => { ctx.beginPath(); ctx.moveTo(x - ww, gy); ctx.lineTo(x + ww * 0.3, gy - top * 0.5); ctx.lineTo(x, gy - top); ctx.lineTo(x + ww, gy); ctx.closePath(); ctx.fill(); };
    ctx.save();
    ctx.globalAlpha = 0.6 * fade; ctx.fillStyle = OUTLINE; wedge(w + 2, hh + 3);
    ctx.globalAlpha = fade; ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.fillStyle = color; wedge(w, hh);
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff3d0'; wedge(w * 0.35, hh * 0.9);
    ctx.restore();
  });
  for (let j = 0; j < 6; j++) parts.push({ x: x + rand(-6, 6), y: gy - rand(4, 30), vx: rand(-50, 50), vy: rand(-220, -120), g: 520, size: Math.random() < 0.4 ? 4 : 3, color: j % 2 ? '#5a4a42' : '#8a7060', life: rand(0.5, 0.8), t: 0 });
}

// 유리 깨짐 (헤드샷): 맞은 점에서 지그재그 금이 사방으로 뻗고 동그란 금이 이어지며, 가운데 구멍이 뚫린다
function crackFx(x, y, color, life = 0.6, delay = 0) {
  const rays = Array.from({ length: 7 }, (_, j) => {
    const A = (j / 7) * Math.PI * 2 + rand(-0.25, 0.25), L = rand(12, 22), pts = [[0, 0]];
    for (let k = 1; k <= 3; k++) pts.push([Math.cos(A + rand(-0.35, 0.35)) * (L * k) / 3, Math.sin(A + rand(-0.35, 0.35)) * (L * k) / 3]);
    return pts;
  });
  skFx(null, delay, life, (u) => {
    const reach = Math.min(1, u / 0.12), fade = fadeOf(u, 0.5);
    ctx.save();
    ctx.lineJoin = 'round';
    for (const [c, w] of [[OUTLINE, 3], [color, 1.6], ['#ffffff', 0.7]]) {
      ctx.globalAlpha = (c === OUTLINE ? 0.6 : 1) * fade; ctx.strokeStyle = c; ctx.lineWidth = w;
      for (const pts of rays) {
        ctx.beginPath();
        const n = Math.max(1, Math.ceil(reach * 3));
        pts.slice(0, n + 1).forEach(([px, py], k) => (k ? ctx.lineTo(x + px * reach, y + py * reach) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(x, y, 8 * reach, 0.3, Math.PI * 1.6); ctx.stroke();
    }
    ctx.globalAlpha = fade; ctx.fillStyle = OUTLINE; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
    ctx.fillStyle = '#ff3b3b'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    ctx.restore();
  });
}

// 나선 철갑 (철갑 관통탄): 두 가닥 나선이 대상을 꿰뚫고 지나가며, 갑옷 조각이 튄다
function drillFx(x, y, dir, color, life = 0.5, delay = 0) {
  skFx(null, delay, life, (u) => {
    const fade = fadeOf(u, 0.35), L = 70 * easeOut(Math.min(1, u / 0.15)), amp = 6 * (1 - u * 0.5);
    ctx.save();
    for (const ph of [0, Math.PI]) {
      for (const [c, w] of [[OUTLINE, 3], [ph ? color : '#ffffff', 1.5]]) {
        ctx.globalAlpha = (c === OUTLINE ? 0.5 : 1) * fade; ctx.strokeStyle = c; ctx.lineWidth = w;
        ctx.beginPath();
        for (let s = 0; s <= 24; s++) {
          const v = s / 24, px = x - dir * 20 + dir * L * v, py = y + Math.sin(v * Math.PI * 5 + ph - clock * 30) * amp * Math.sin(Math.PI * v);
          s ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  });
  for (let j = 0; j < 6; j++) parts.push({ x, y, vx: dir * rand(60, 160), vy: rand(-120, -30), g: 480, size: 3, color: j % 2 ? '#8c95a6' : '#cfd6e0', life: rand(0.4, 0.7), t: 0 });
}

// 마법 각인 (유도 마탄): 육망성 각인이 찍혔다가 돌면서 오그라든다
function runeStampFx(x, y, r, color, life = 0.45, delay = 0) {
  const rot0 = rand(0, Math.PI);
  skFx(null, delay, life, (u) => {
    const fade = fadeOf(u, 0.3), rr = r * (u < 0.15 ? easeOut(u / 0.15) * 1.3 : 1.3 - 0.5 * segU(u, 0.15, 1)), A = rot0 + u * 3;
    ctx.save();
    for (const [c, w] of [[OUTLINE, 3], [color, 1.5]]) {
      ctx.globalAlpha = (c === OUTLINE ? 0.5 : 1) * fade; ctx.strokeStyle = c; ctx.lineWidth = w;
      for (const off of [0, Math.PI]) {
        ctx.beginPath();
        for (let j = 0; j < 3; j++) { const B = A + off + (j * Math.PI * 2) / 3; j ? ctx.lineTo(x + Math.cos(B) * rr, y + Math.sin(B) * rr) : ctx.moveTo(x + Math.cos(B) * rr, y + Math.sin(B) * rr); }
        ctx.closePath(); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(x, y, rr * 1.15, 0, Math.PI * 2); ctx.stroke();
    }
    dot(x, y, 3, '#ffffff', fade);
    ctx.restore();
  });
}

// 별 각인 (별빛 화살비): 떨어진 자리 땅바닥에 납작한 오각별이 찍혀 번진다
function starStampFx(x, color, size = 12, life = 0.6) {
  const gy = groundY() - 2, A0 = rand(0, Math.PI);
  skFx(null, 0, life, (u) => {
    const fade = fadeOf(u, 0.35), s = size * (0.6 + 0.6 * easeOut(Math.min(1, u / 0.2)));
    const star = () => {
      ctx.beginPath();
      for (let j = 0; j < 10; j++) { const B = A0 + (j * Math.PI) / 5, R = j % 2 ? s * 0.42 : s; const px = x + Math.cos(B) * R, py = gy + Math.sin(B) * R * 0.3; j ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath();
    };
    ctx.save();
    ctx.globalAlpha = 0.5 * fade; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; star(); ctx.stroke();
    ctx.globalAlpha = fade; ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.shadowColor = color; ctx.shadowBlur = 8; star(); ctx.stroke();
    ctx.globalAlpha = 0.25 * fade; ctx.fillStyle = color; star(); ctx.fill();
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
// 극의(Lv30): 시전이 끝나는 순간 발밑에서 금빛 고리가 두 겹 퍼지고 위로 불꽃이 솟는다
function masteryFinish(a) {
  const x = a.px(), gy = groundY();
  effects.push({ type: 'ring', x, y: gy - 2, t: 0, color: MASTERY_GOLD, size: 0.8, life: 0.5 });
  effects.push({ type: 'ring', x, y: gy - 2, t: -0.08, color: a.color, size: 0.6, life: 0.5 });
  for (let i = 0; i < 14; i++) {
    parts.push({ x: x + rand(-14, 14), y: gy - rand(0, 10), vx: rand(-20, 20), vy: rand(-150, -70), g: -20, size: Math.random() < 0.3 ? 3 : 2,
      color: i % 3 ? MASTERY_GOLD : '#ffffff', life: rand(0.35, 0.6), t: 0, add: true });
  }
}

function auraTick(c) {
  if (c.a.u >= 0.95 || Math.random() > (skillTier(c.k) >= 2 || c.a.mast >= 2 ? 0.9 : 0.45)) return;
  const x = c.a.px(), gy = groundY();
  parts.push({ x: x + rand(-12, 12), y: gy - rand(2, 30), vx: rand(-8, 8), vy: rand(-90, -40), g: -30, size: Math.random() < 0.3 ? 3 : 2,
    color: Math.random() < 0.65 ? c.a.color : '#ffffff', life: rand(0.3, 0.6), t: 0, add: true });
}
function drawAuras() {
  for (const c of casts) {
    const t2 = skillTier(c.k) >= 2 || c.a.mast >= 2, k = Math.sin(Math.PI * Math.min(1, c.a.u * 1.2));
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
      if (c.a.mast >= 3) {
        // 극의: 바깥에 반대로 도는 금빛 고리 하나 더
        ctx.strokeStyle = MASTERY_GOLD; ctx.lineWidth = 1; ctx.globalAlpha = 0.55 * k;
        ctx.beginPath(); ctx.ellipse(x, groundY() - 1, 30 - 3 * Math.sin(clock * 6), 7, 0, 0, Math.PI * 2); ctx.stroke();
      }
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

// ── 숙련 단계 연출에 쓰는 도구 ──
// 앞으로 날아가는 초승달 검풍 (x0 에서 dist 만큼). 지나가는 땅에서 흙먼지가 인다
function waveFx(a, x0, y, dist, color, life, size = 1, delay = 0) {
  const d = a.dir, r = 13 * size;
  const at = (u) => x0 + d * dist * easeOut(u);
  skFx(null, delay, life, (u) => {
    const x = at(u), fade = u > 0.65 ? (1 - u) / 0.35 : 1;
    const a0 = d > 0 ? -1.15 : Math.PI - 1.15, a1 = d > 0 ? 1.15 : Math.PI + 1.15;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color; ctx.lineWidth = 5 * size;
    ctx.beginPath(); ctx.arc(x - d * r, y, r, a0, a1); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6 * size;
    ctx.beginPath(); ctx.arc(x - d * r, y, r, a0 + 0.25, a1 - 0.25); ctx.stroke();
    ctx.globalAlpha = fade * 0.5; ctx.strokeStyle = color; ctx.lineWidth = 1;
    for (const dy of [-r * 0.6, 0, r * 0.6]) { ctx.beginPath(); ctx.moveTo(x - d * (r + 4), y + dy); ctx.lineTo(x - d * (r + 26 * size), y + dy); ctx.stroke(); }
    ctx.restore();
  }, null, (u) => {
    if (Math.random() < 0.6) parts.push({ x: at(u), y: groundY() - 2, vx: -d * rand(10, 50), vy: rand(-50, -10), g: 220, size: 2, color: Math.random() < 0.5 ? '#c9b38a' : '#a8946a', life: 0.3, t: 0 });
  });
}
// 땅이 양옆으로 갈라지는 금 (x 에서 좌우 len 만큼)
function groundCrackFx(x, len, color, life = 0.7) {
  const side = (s) => { const out = [[x, groundY() + 1]]; for (let i = 1; i <= 6; i++) out.push([x + s * len * (i / 6), groundY() + 1 + (i % 2 ? -2 : 1) * rand(0.5, 1.5)]); return out; };
  const L = side(-1), R = side(1);
  skFx(null, 0, life, (u) => {
    const grow = Math.min(1, u / 0.18), fade = u > 0.5 ? 1 - (u - 0.5) / 0.5 : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    for (const [P, w, c] of [[L, 3, color], [R, 3, color], [L, 1, '#ffffff'], [R, 1, '#ffffff']]) {
      const m = Math.max(2, Math.round(P.length * grow));
      ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath(); P.slice(0, m).forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
    }
    ctx.restore();
  });
}
// 흩어진 빛 알갱이가 한 점(x, y)으로 빨려 들며 빛 구슬이 커진다 (life 초 뒤 터질 자리)
function gatherFx(a, x, y, color, life, size = 1) {
  aFx(a, 0, life, (u) => {
    const r = (3 + 9 * easeIn(u)) * size;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
    ctx.restore();
  }, null, (u) => {
    for (let j = 0; j < 2; j++) {
      const ang = rand(0, Math.PI * 2), dist = rand(36, 70) * size;
      const px = x + Math.cos(ang) * dist, py = y + Math.sin(ang) * dist * 0.7, k = rand(2.2, 3);
      parts.push({ x: px, y: py, vx: (x - px) * k, vy: (y - py) * k, g: 0, size: 2, color: Math.random() < 0.5 ? color : '#ffffff', life: 1 / k, t: 0, add: true });
    }
  });
}

// 질풍난무 동선: 대상 기준 위치(+ 대상 너머 / - 대상 앞)와 베는 방향(1 내려베기 · -1 올려베기). 난무 횟수만큼 앞에서부터 쓴다
// 시간표(초)는 classes.js 의 galePlan — 각 구간은 앞 55% 동안 돌진(빠르게 → 잔상), 도착 직전부터 베기
const GALE_OFFS = [[36, 1], [-30, -1], [44, 1], [-36, -1], [32, 1], [-26, -1]];
const galePlanOf = (a) => a.galeP || (a.galeP = galePlan(a.k ? a.k.n : 6, a.k ? a.k.fin : false));
function galeAt(t, D, P) {
  // 준비: 몸을 낮추고 쌍검을 뒤로 젖힌다
  if (t < 0.078) { const c = easeOut(t / 0.078); return { pos: 0, fast: false, body: { sy: 1 - 0.16 * c, skew: 0.25 * c, wa: mix(-1.0, 2.4, c), wa2: mix(-0.6, 2.7, c) } }; }
  let prevT = 0.078, prevPos = 0;
  for (let i = 0; i < P.stops.length; i++) {
    const [off, dirS] = GALE_OFFS[i % GALE_OFFS.length], st = P.stops[i];
    if (t < st) {
      const k = (t - prevT) / (st - prevT), dash = segU(k, 0, 0.55), pos = mix(prevPos, D + off, easeOut(dash));
      const sw = easeIn(segU(k, 0.45, 1));                 // 베기
      const wa = dirS > 0 ? mix(-2.4, 1.0, sw) : mix(1.2, -2.2, sw), wa2 = dirS > 0 ? mix(-2.0, 0.7, segU(k, 0.6, 1)) : mix(0.9, -1.8, segU(k, 0.6, 1));
      const moving = dash < 1;
      return { pos, fast: moving && dash > 0.05, body: { wa, wa2, skew: moving ? 0.4 : 0.2, sy: moving ? 0.88 : 0.95, sx: moving ? 1.12 : 1, lift: moving ? 5 * Math.sin(Math.PI * dash) : 0 } };
    }
    prevT = st; prevPos = D + off;
  }
  // X 준비: 대상 앞쪽으로 뛰어올라 쌍검을 머리 위로 엇갈려 든다
  if (t < P.rise) { const k = easeOut(segU(t, prevT, P.rise)); return { pos: mix(prevPos, D - 18, k), fast: k < 0.9, body: { wa: mix(-2.2, -2.5, k), wa2: mix(-1.8, -2.0, k), lift: 30 * Math.sin((Math.PI / 2) * k), sy: 1.08, skew: -0.15 } }; }
  // 정점에서 잠깐 멈췄다가 내리꽂으며 X자로 벤다
  if (t < P.x) { const d = easeIn(segU(t, P.hang, P.x)); return { pos: D - 18, fast: d > 0.1, body: { wa: mix(-2.5, 1.1, d), wa2: mix(-2.0, 0.6, d), lift: 30 * (1 - d), sy: mix(1.08, 0.84, d), sx: mix(1, 1.12, d), skew: mix(-0.15, 0.45, d) } }; }
  if (t < P.hold) return { pos: D - 18, fast: false, body: { wa: 1.1, wa2: 0.6, sy: 0.86, skew: 0.4 } };
  let from = D - 18, t0 = P.hold;
  const F = P.fin;
  if (F) {
    // ★★★ 마무리 일격: 대상 바로 위로 높이 솟구쳐 몸을 말아 쌍검을 모으고 → 내리꽂아 땅째 가른다
    if (t < F.up) { const k = easeOut(segU(t, P.hold, F.up)); return { pos: mix(D - 18, D - 4, k), fast: true, body: { wa: mix(1.1, -2.7, k), wa2: mix(0.6, -2.5, k), lift: 64 * k, sy: mix(0.86, 1.12, k), sx: mix(1.1, 0.9, k), skew: mix(0.4, -0.3, k) } }; }
    if (t < F.top) { const k = segU(t, F.up, F.top); return { pos: D - 4, fast: false, body: { wa: -2.75, wa2: -2.55, lift: 64 + 3 * Math.sin(Math.PI * k), sy: 1.14, sx: 0.88, skew: -0.3 } }; }
    if (t < F.hit) { const d = easeIn(segU(t, F.top, F.hit)); return { pos: D - 4, fast: true, body: { wa: mix(-2.75, 1.35, d), wa2: mix(-2.55, 1.15, d), lift: 64 * (1 - d), sy: mix(1.14, 0.78, d), sx: mix(0.88, 1.18, d), skew: mix(-0.3, 0.55, d) } }; }
    if (t < F.land) return { pos: D - 4, fast: false, body: { wa: 1.35, wa2: 1.15, sy: 0.8, sx: 1.15, skew: 0.5 } };
    from = D - 4; t0 = F.land;
  }
  // 원래 자리로 물러난다
  const r = easeOut(segU(t, t0, P.dur));
  return { pos: mix(from, 0, r), fast: r < 0.8, body: { wa: mix(1.1, -1.0, r), wa2: mix(0.6, -0.6, r), lift: 8 * Math.sin(Math.PI * r), sy: 1, skew: 0.4 * (1 - r) } };
}

// 숙련 단계 이전부터 있던 기본 자세 (단계가 오르면 이 뒤에 동작이 이어진다)
function steelCleaveBase(u) {
  if (u < 0.28) { const w = easeOut(segU(u, 0, 0.28)); return { wa: mix(-1.0, -2.3, w), skew: -0.2 * w, sy: 1 - 0.12 * w, dx: -3 * w }; }
  if (u < 0.44) { const j = segU(u, 0.28, 0.44); return { wa: mix(-2.3, -2.7, j), skew: -0.25, sy: mix(0.88, 1.08, j), sx: mix(1, 0.94, j), dx: mix(-3, 8, easeOut(j)), lift: 16 * Math.sin((Math.PI / 2) * j) }; }
  if (u < 0.5) { const d = easeIn(segU(u, 0.44, 0.5)); return { wa: mix(-2.7, 1.1, d), skew: mix(-0.25, 0.4, d), sy: mix(1.08, 0.86, d), sx: mix(0.94, 1.1, d), dx: mix(8, 12, d), lift: 16 * (1 - d) }; }
  if (u < 0.7) { const f = segU(u, 0.5, 0.7); return { wa: 1.1 + 0.25 * Math.sin(Math.PI * f), skew: 0.4 - 0.15 * f, sy: mix(0.86, 1, easeOut(f)), sx: mix(1.1, 1, f), dx: 12 }; }
  const r = easeOut(segU(u, 0.7, 1));
  return { wa: mix(1.1, -1.0, r), skew: 0.25 * (1 - r), dx: 12 * (1 - r) };
}
// 성검을 하늘로 치켜들며 천천히 떠오른다 → 정점에서 한 번 더 젖힌다 → 내리꽂으며 착지
function judgmentBase(u) {
  if (u < 0.4) { const r = easeOut(segU(u, 0, 0.4)); return { wa: mix(-1.0, -1.57, r), sy: 1 + 0.08 * r, skew: -0.1 * r, lift: 10 * r + Math.sin(clock * 8) * r }; }
  if (u < 0.52) { const r = segU(u, 0.4, 0.52); return { wa: -1.57 - 0.3 * easeOut(r), sy: 1.08, skew: -0.1 - 0.12 * r, lift: 10 + 3 * r }; }
  if (u < 0.6) { const d = easeIn(segU(u, 0.52, 0.6)); return { wa: mix(-1.87, 0.85, d), skew: mix(-0.22, 0.38, d), dx: 7 * d, lift: 13 * (1 - d), sy: mix(1.08, 0.86, d), sx: mix(1, 1.1, d) }; }
  if (u < 0.78) { const f = segU(u, 0.6, 0.78); return { wa: 0.85, skew: 0.38 - 0.1 * f, dx: 7, sy: mix(0.86, 1, easeOut(f)) }; }
  const r = easeOut(segU(u, 0.78, 1));
  return { wa: mix(0.85, -1.0, r), skew: 0.28 * (1 - r), dx: 7 * (1 - r) };
}

const SKILL_FX = {
  // ── 검사: 강철 베기 — 웅크려 검을 치켜들고, 앞으로 뛰어오르며 착지와 함께 내려벤다 ──
  //  ★ 벤 자리에서 초승달 검풍이 앞으로 날아간다 / ★★ 내려벨 때 땅이 양옆으로 갈라지며 주변까지 베고, 검풍이 두 겹
  //  ★★★ 검을 낮게 되돌렸다가 뛰어오르며 올려베어 X자로 마무리 (금빛 반달)
  steelCleave: {
    pose(u, a) {
      const t = u * (a.k ? a.k.dur : 0.7);
      if (a.mast >= 3 && t >= 0.42) {
        if (t < 0.6) { const w = easeOut(segU(t, 0.42, 0.6)); return { wa: mix(1.1, 1.75, w), skew: mix(0.3, -0.1, w), sy: mix(0.95, 0.84, w), sx: mix(1, 1.06, w), dx: mix(12, 9, w) }; }
        if (t < 0.74) { const d = easeIn(segU(t, 0.6, 0.74)); return { wa: mix(1.75, -2.0, d), skew: mix(-0.1, -0.35, d), sy: mix(0.84, 1.12, d), sx: mix(1.06, 0.92, d), dx: mix(9, 20, d), lift: 14 * d }; }
        if (t < 0.83) { const f = segU(t, 0.74, 0.83); return { wa: -2.0 - 0.15 * Math.sin(Math.PI * f), skew: -0.35, sy: 1.08, dx: 20, lift: 14 * (1 - easeIn(f)) }; }
        const r = easeOut(segU(t, 0.83, 0.95));
        return { wa: mix(-2.0, -1.0, r), skew: -0.35 * (1 - r), dx: 20 * (1 - r) };
      }
      return steelCleaveBase(t / 0.7);
    },
    cues: (a) => {
      const d = a.k.dur;
      const list = [
        [0.182 / d, (a) => { const h = hand(a); starFx(h.x - a.dir * 8, h.y - 24, 7 + 2 * Math.min(2, a.mast), '#ffffff', 0.25); }],
        [0.21 / d, (a) => { for (let i = 0; i < 6; i++) parts.push({ x: a.x() - a.dir * 4, y: groundY() - 2, vx: -a.dir * rand(30, 90), vy: rand(-50, -10), g: 200, size: 3, color: i % 2 ? '#c9b38a' : '#a8946a', life: 0.35, t: 0 }); }],
      ];
      if (a.mast >= 3) list.push([0.58 / d, (a) => { const h = hand(a); starFx(h.x + a.dir * 6, h.y + 8, 9, MASTERY_GOLD, 0.25); debris(a.px(), 6, ['#c9b38a', MASTERY_GOLD], 0.8); }]);
      return list;
    },
    hit(a, i) {
      const s = a.k.stage || 0, h = hand(a), big = Math.min(2, s);
      if (i === 0) {
        crescentFx(h.x, h.y, 30 + 6 * big, -2.6, 1.0, a.dir, '#cfe0ff', 3 + (s >= 2 ? 1 : 0), 0.28);
        ringFx(a.px(), 'rgba(214,196,150,0.9)', 0.5 + 0.3 * big, 0.35);
        debris(a.px() + a.dir * 10, 6 + 5 * big, ['#c9b38a', '#a8946a'], s >= 2 ? 1.6 : 1);
        if (s >= 2) { groundCrackFx(a.px() + a.dir * 10, 40, a.color); impact({ shake: 0.15 }); }
      } else if (i === 1) {
        // 검풍: 땅 위를 스치며 앞으로 (★★부터 두 겹)
        waveFx(a, h.x, h.y + 4, 120, a.color, 0.36, s >= 2 ? 1.25 : 1);
        if (s >= 2) waveFx(a, h.x, h.y - 6, 120, '#ffffff', 0.36, 0.8, 0.06);
        impact({ shake: 0.08 });
      } else {
        // ★★★ 올려베기: 금빛 역반달 + 대상마다 X
        crescentFx(h.x, h.y - 6, 42, 1.0, -2.4, a.dir, MASTERY_GOLD, 5, 0.32);
        for (const t of a.targets(i)) { xslashFx(t.x, t.y, 20, a.color, 0.45); burst(t.x, t.y, 22, ['#ffffff', a.color, MASTERY_GOLD], 170); }
        ringFx(a.px(), MASTERY_GOLD, 1.2, 0.45);
        impact({ stop: 0.1, shake: 0.3 });
      }
    },
    // 반달 자국 두 겹: 두꺼운 직업색 + 늦게 따라오는 가는 강철빛. 검풍은 가로로 스친 자국, 올려베기는 금빛 역반달
    marks(a, t, pow, i) {
      if (i === 1) { slashMarkFx(t.x, t.y + rand(-4, 4), a.dir > 0 ? 0 : Math.PI, 44, a.color, 3, 0.3); return; }
      if (i === 2) { crescentMarkFx(t.x + a.dir * 4, t.y + 2, 24, 1.9, -1.2, 8, MASTERY_GOLD, 0.55, 0, a.dir); return; }
      crescentMarkFx(t.x - a.dir * 6, t.y - 2, 26, -2.1, 1.25, 9, a.color, 0.6, 0, a.dir);
      crescentMarkFx(t.x - a.dir * 2, t.y + 2, 19, -1.9, 1.1, 4, '#cfe0ff', 0.5, 0.05, a.dir);
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
    marks(a, t, pow) { pierceSpiralFx(t.x - a.dir * 10, t.y, a.dir, 46 + 8 * pow, a.color); },
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
    marks(a, t) { arrowStuckFx(t.x, t.y + rand(-9, 5), a.dir, a.color); },
    kb: 6,
  },

  // ── 성기사: 심판의 일격 — 성검을 하늘로, 대상 위로 빛기둥 ──
  //  Lv1 가는 기둥 / ★ 범위 +30%·굵은 기둥과 불꽃 / ★★ 흰 빛기둥이 한 번 더 내리꽂힌다
  //  ★★★ 성검을 다시 들어 흩어진 빛을 대상 위로 모으고 → 거대한 금빛 기둥이 터지며 적을 띄운다
  judgment: {
    pose(u, a) {
      const t = u * (a.k ? a.k.dur : 1);
      if (a.mast >= 3 && t >= 0.78) {
        if (t < 1.0) { const r = easeOut(segU(t, 0.78, 1.0)); return { wa: mix(0.85, -1.75, r), sy: 1 + 0.1 * r, skew: mix(0.28, -0.15, r), dx: 7 * (1 - r), lift: 18 * r + Math.sin(clock * 10) * r }; }
        if (t < 1.105) { const d = easeIn(segU(t, 1.0, 1.105)); return { wa: mix(-1.75, 0.95, d), skew: mix(-0.15, 0.45, d), dx: 9 * d, lift: 18 * (1 - d), sy: mix(1.1, 0.82, d), sx: mix(1, 1.14, d) }; }
        if (t < 1.18) return { wa: 0.95, skew: 0.42, dx: 9, sy: 0.84, sx: 1.1 };
        const r = easeOut(segU(t, 1.18, 1.3));
        return { wa: mix(0.95, -1.0, r), skew: 0.42 * (1 - r), dx: 9 * (1 - r) };
      }
      return judgmentBase(Math.min(1, t));
    },
    tick(a, u) {
      const t = u * a.k.dur;
      if (((t > 0.05 && t < 0.45) || (a.mast >= 3 && t > 0.8 && t < 1.05)) && Math.random() < 0.6) {
        const h = hand(a);
        parts.push({ x: h.x + rand(-10, 10), y: h.y - rand(0, 20), vx: rand(-10, 10), vy: rand(-80, -40), g: -20, size: 2, color: Math.random() < 0.5 ? '#ffd257' : '#ffffff', life: 0.5, t: 0 });
      }
    },
    cues: (a) => {
      const d = a.k.dur;
      const list = [
        [0.2 / d, (a) => { const h = hand(a); starFx(h.x, h.y - 26, 10, '#fff3b0', 0.4); }],
        [0.3 / d, (a) => {
          for (const t of a.targets()) {
            aFx(a, 0, 0.3, (u) => { ctx.save(); ctx.globalAlpha = 0.5 + u * 0.5; ctx.fillStyle = '#ffd257'; ctx.fillRect(Math.round(t.x) - 1, 0, 2, groundY()); ctx.restore(); });
            ringFx(t.x, '#ffd257', 0.5, 0.3);
          }
        }],
      ];
      // ★★★ 빛 모으기: 대상 위에서 빛 구슬이 커지다가 내려찍는 순간 터진다
      if (a.mast >= 3) list.push([0.8 / d, (a) => { for (const t of a.targets()) gatherFx(a, t.x, groundY() - 54, MASTERY_GOLD, 1.105 - 0.8, 1.2); starFx(hand(a).x, hand(a).y - 28, 12, MASTERY_GOLD, 0.4); }]);
      return list;
    },
    hit(a, i) {
      const s = a.k.stage || 0;
      if (i === 0) {
        for (const t of a.targets(i)) {
          pillarFx(t.x, '#ffd257', s ? 44 : 28, 0.6);
          ringFx(t.x, '#ffd257', s ? 1.2 : 0.8, 0.6);
          ringFx(t.x, '#ffffff', 0.6, 0.4);
          burst(t.x, groundY() - 10, s ? 30 : 18, ['#ffd257', '#ffffff', '#fff3b0'], 170, 3, 250);
          if (s >= 1) for (const sd of [-1, 1]) streakFx(t.x, groundY() - 2, t.x + sd * 30, groundY() - 2, '#ffd257', 3, 0.3);
        }
        impact({ stop: 0.1, shake: s ? 0.3 : 0.2 });
      } else if (i === 1) {
        // ★★ 두 번째 빛기둥: 흰 심이 굵은 기둥이 살짝 옆에 한 번 더
        for (const t of a.targets(i)) {
          pillarFx(t.x + a.dir * 6, '#ffffff', 34, 0.5);
          pillarFx(t.x + a.dir * 6, '#fff3b0', 18, 0.4);
          holyCrossFx(t.x, t.y - 8, 24, 0.7);
          burst(t.x, t.y, 20, ['#ffffff', '#ffd257'], 150);
        }
        impact({ stop: 0.06, shake: 0.22 });
      } else {
        // ★★★ 대폭발: 금빛 거대 기둥 + 겹고리 + 큰 성호, 적이 떠오른다
        for (const t of a.targets(i)) {
          pillarFx(t.x, MASTERY_GOLD, 90, 0.85);
          pillarFx(t.x, '#ffffff', 30, 0.55);
          ringFx(t.x, MASTERY_GOLD, 2.2, 0.75);
          ringFx(t.x, '#ffffff', 1.4, 0.5);
          holyCrossFx(t.x, t.y - 12, 32, 0.9);
          burst(t.x, groundY() - 14, 50, [MASTERY_GOLD, '#ffffff', '#ffd257'], 230, 3, 220);
        }
        impact({ stop: 0.16, shake: 0.45 });
      }
    },
    marks(a, t, pow, i) { holyCrossFx(t.x, t.y - 4, i === 2 ? 24 : 18, 0.75); },
    kb: 16,
  },

  // ── 성기사: 성역 — 성검을 땅에 꽂아 황금 돔 ──
  //  Lv1 작은 돔 3초 / ★ 4초·돔이 커짐 / ★★ 회복 +50%·돔 둘레를 성호 룬이 돌고 초록빛 회복 / ★★★ 금빛 이중 돔과 양옆 빛기둥, 끝날 때 성광 폭발
  sanctuary: {
    pose(u) {
      if (u < 0.35) { const r = segU(u, 0, 0.35); return { wa: mix(-1.0, -1.57, easeOut(r)), lift: 12 * Math.sin(Math.PI * r) }; }
      if (u < 0.5) { const d = easeIn(segU(u, 0.35, 0.48)); return { wa: mix(-1.57, 1.57, d), sy: mix(1, 0.86, d) }; }
      return { wa: 1.57, sy: mix(0.86, 0.96, segU(u, 0.5, 1)) };
    },
    cues: [[0.48, (a) => {
      const h = hand(a), k = a.k, s = k.stage || 0;
      ringFx(h.x, '#ffd257', 1.2 + 0.2 * s, 0.6);
      debris(h.x, 10, ['#c9b38a', '#ffd257']);
      impact({ stop: 0.06, shake: 0.15 });
      if (s >= 2) for (let j = 0; j < 12; j++) parts.push({ x: a.x() + rand(-14, 14), y: groundY() - rand(4, 30), vx: rand(-15, 15), vy: rand(-70, -35), g: -15, size: 3, color: j % 2 ? '#7dffb0' : '#ffffff', life: 0.8, t: 0, add: true });
      // 돔: 시전자를 따라다니며 보호막이 사라질 때까지 남는다
      const [RX, RY] = [[28, 38], [34, 46], [40, 52], [46, 58]][s];
      const life = k.dur * 0.52 + k.ward.dur;
      aFx(a, 0, life, (u) => {
        const x = a.x(), gy = groundY();
        const grow = Math.min(1, u * life / 0.25), fade = u > 0.9 ? (1 - u) / 0.1 : 1;
        const rx = RX * easeOut(grow), ry = RY * easeOut(grow);
        ctx.save();
        ctx.globalAlpha = fade * (0.85 + 0.15 * Math.sin(clock * 6));
        ctx.fillStyle = s >= 3 ? 'rgba(255,235,160,0.16)' : 'rgba(255,215,90,0.13)';
        ctx.beginPath(); ctx.ellipse(x, gy, rx, ry, 0, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = s >= 3 ? MASTERY_GOLD : '#ffd257'; ctx.lineWidth = 2; ctx.shadowColor = '#ffd257'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.ellipse(x, gy, rx, ry, 0, Math.PI, 0); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x, gy, rx * 0.8, ry * 0.85, 0, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
        if (s >= 3) {
          // 안쪽 두 번째 막 + 돔 양옆의 가는 빛기둥
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.globalAlpha *= 0.8;
          ctx.beginPath(); ctx.ellipse(x, gy, rx * 0.62, ry * 0.7, 0, Math.PI, 0); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(255,240,184,0.35)';
          for (const sd of [-1, 1]) ctx.fillRect(Math.round(x + sd * rx) - 1, gy - ry - 30, 2, ry + 30);
        }
        ctx.shadowBlur = 0;
        if (s >= 2) {
          // 돔 둘레를 도는 성호 룬 6개
          ctx.fillStyle = '#fff3b0'; ctx.globalAlpha = fade * 0.9;
          for (let j = 0; j < 6; j++) {
            const ang = Math.PI + ((clock * 0.9 + j / 6) % 1) * Math.PI;
            const px = Math.round(x + Math.cos(ang) * rx), py = Math.round(gy + Math.sin(ang) * ry);
            ctx.fillRect(px - 1, py - 3, 2, 6); ctx.fillRect(px - 3, py - 1, 6, 2);
          }
        }
        ctx.restore();
      }, null, () => {
        if (Math.random() < 0.35 + 0.1 * s) parts.push({ x: a.x() + rand(-RX + 6, RX - 6), y: groundY() - 2, vx: 0, vy: rand(-60, -30), g: -10, size: 2, color: s >= 2 && Math.random() < 0.4 ? '#7dffb0' : Math.random() < 0.5 ? '#ffd257' : '#ffffff', life: 0.7, t: 0 });
      });
    }]],
    // ★★★ 보호막이 끝나는 순간: 돔이 성광으로 터진다 (피해는 skills.js tickSkills)
    finish(a) {
      const x = a.x(), gy = groundY();
      pillarFx(x, MASTERY_GOLD, 80, 0.8);
      pillarFx(x, '#ffffff', 26, 0.5);
      ringFx(x, MASTERY_GOLD, 2.4, 0.7);
      ringFx(x, '#ffffff', 1.5, 0.5);
      for (const sd of [-1, 1]) holyCrossFx(x + sd * 36, gy - 30, 20, 0.7, 0.05);
      burst(x, gy - 24, 44, [MASTERY_GOLD, '#ffffff', '#ffd257'], 220, 3, 160);
      impact({ stop: 0.1, shake: 0.35 });
    },
    kb: 3,
  },

  // ── 검성: 질풍난무 — 대상 앞뒤를 지그재그로 꿰뚫고 오가며 베고, 뛰어올라 X자로 내리꽂는다 ──
  // 지나간 자리마다 붉은 잔상이 촤라락 남는다 (tick). 위치는 '대상까지 거리' 기준이라 결투·레이드에서도 같은 모양
  //  Lv1 난무 4회 / ★ 5회 · 검흔이 두 겹 / ★★ 6회 · X가 커짐 / ★★★ 6회 + 높이 솟구쳐 내려찍는 마무리 일격 (땅이 갈라지고 금빛 X)
  gale: {
    pose(u, a) {
      const P = galePlanOf(a), D = Math.max(16, (a.tx() - a.x()) * a.dir);
      const G = galeAt(u * P.dur, D, P);
      const f = G.pos > D ? -1 : 1;                       // 늘 대상 쪽을 본다 (대상 너머면 뒤돈다)
      return { ...G.body, dx: G.pos * f, facing: f };
    },
    tick(a, u, dt) {
      // 빠르게 움직이는 동안: 지나온 길에 가는 속도선 세 줄 + 0.03초마다 옅은 잔상 하나
      const P = galePlanOf(a), D = Math.max(16, (a.tx() - a.x()) * a.dir), G = galeAt(u * P.dur, D, P);
      const sx = a.x() + a.dir * G.pos, lift = G.body.lift || 0;
      if (G.fast && a.prevX != null && Math.abs(sx - a.prevX) > 1.5) {
        const x0 = a.prevX, gy = groundY();
        for (const [h, c, w] of [[12, '#ffffff', 1], [24, '#ff4d4d', 2], [36, '#ffffff', 1]]) streakFx(x0, gy - h - lift, sx, gy - h - lift, c, w, 0.16);
      }
      // 마무리 일격으로 솟구치고 내리꽂는 동안은 세로 속도선
      if (P.fin && G.fast && lift > 8 && a.prevLift != null && Math.abs(lift - a.prevLift) > 2) {
        const gy = groundY();
        for (const [dx, c, w] of [[-6, '#ffffff', 1], [0, '#ff4d4d', 2], [6, MASTERY_GOLD, 1]]) streakFx(sx + dx, gy - 24 - a.prevLift, sx + dx, gy - 24 - lift, c, w, 0.18);
      }
      a.prevX = sx; a.prevLift = lift;
      a.ghostT = (a.ghostT || 0) - dt;
      if (!G.fast || a.ghostT > 0) return;
      a.ghostT = 0.03;
      ghostFx(a, sx, (G.pos > D ? -1 : 1) * a.dir, '#ff4d4d', 0.2, { ...G.body }, 0.28);
    },
    cues: (a) => {
      const P = galePlanOf(a), d = P.dur;
      const list = [
        [0.078 / d, (a) => { burst(a.x(), groundY() - 4, 10, ['#c9b38a', '#a8946a'], 80, 3, 300); }],
        [(P.stops[P.stops.length - 1] + 0.05) / d, (a) => { burst(a.px(), groundY() - 4, 8, ['#c9b38a', '#a8946a'], 80, 3, 300); }],
      ];
      if (P.fin) {
        list.push([(P.hold + 0.02) / d, (a) => {
          debris(a.px(), 12, ['#c9b38a', '#ff4d4d'], 1.2);
          ringFx(a.px(), '#ff4d4d', 0.9, 0.35);
        }]);
        list.push([P.fin.top / d, (a) => { const h = hand(a); starFx(h.x, h.y - 10, 14, MASTERY_GOLD, 0.3); starFx(h.x, h.y - 10, 8, '#ffffff', 0.2); }]);
      }
      return list;
    },
    hit(a, i) {
      const P = galePlanOf(a), s = a.k.stage || 0, nS = P.stops.length, t = a.targets(i)[0];
      if (i < nS) {
        const ang = rand(-0.9, 0.9) + (i % 2 ? Math.PI / 2 : 0);
        slashMarkFx(t.x, t.y, ang, 48, '#ff4d4d', s ? 4 : 3, 0.3, 0, rand(-6, 6));
        if (s >= 1) slashMarkFx(t.x, t.y, ang + 0.18, 36, '#ffffff', 1.5, 0.22, 0.03);
        burst(t.x, t.y, 6, ['#ffffff', '#ff4d4d'], 90);
        impact({ stop: 0.02, shake: 0.06 });
        return;
      }
      if (i === nS) {
        for (const tt of a.targets(i)) {
          xslashFx(tt.x, tt.y, s >= 2 ? 26 : 20, '#ff3040', 0.4);
          burst(tt.x, tt.y, 24, ['#ffffff', '#ff4d4d', '#1a1b22'], 160);
        }
        ringFx(a.px(), '#ff4d4d', 0.8, 0.4);
        impact({ stop: 0.12, shake: 0.3 });
        return;
      }
      // ★★★ 마무리 일격: 세로로 내리그은 거대한 붉은 베기, 금빛 X, 땅이 양옆으로 갈라진다
      const x = a.px();
      for (const tt of a.targets(i)) {
        slashMarkFx(tt.x, tt.y - 14, Math.PI / 2, 96, '#ff3040', 8, 0.55, 0, 4);
        slashMarkFx(tt.x, tt.y - 14, Math.PI / 2, 70, '#ffffff', 2, 0.4, 0.04, 4);
        xslashFx(tt.x, tt.y, 30, MASTERY_GOLD, 0.5);
        burst(tt.x, tt.y, 40, ['#ffffff', '#ff4d4d', MASTERY_GOLD, '#1a1b22'], 220);
      }
      groundCrackFx(x, 70, '#ff3040', 0.8);
      debris(x, 18, ['#c9b38a', '#a8946a', '#ff4d4d'], 1.8);
      ringFx(x, '#ff3040', 1.8, 0.6);
      ringFx(x, MASTERY_GOLD, 1.1, 0.5);
      impact({ stop: 0.16, shake: 0.45 });
    },
    kb: 6,
  },

  // ── 검성: 일섬 — 숨죽인 발도, 섬광, 늦게 터지는 베기 ──
  //  Lv1 짧은 섬광 / ★ 늦게 따라오는 잔상이 한 번 더 벤다 / ★★ 범위가 넓어지고, 터질 때 화면 가로로 칼바람이 뻗으며 크게 밀쳐 낸다
  //  ★★★ 지나간 자리에서 돌아서서 다시 발도 — 되돌아오는 금빛 섬광으로 이중 일섬, 대상 뒤로 붉은 달이 뜬다
  iaido: {
    pose(u, a) {
      const t = u * (a.k ? a.k.dur : 1.4), D = Math.max(20, Math.abs(a.tx() - a.x()) + 34);
      if (t < 0.63) { const s = easeOut(segU(t, 0, 0.21)); return { sy: 1 - 0.12 * s, skew: 0.15 * s, wa: mix(-1.0, 2.5, s), wa2: mix(-0.5, 2.7, s) }; }
      if (t < 0.728) { const d = easeOut(segU(t, 0.63, 0.728)); return { dx: D * d, skew: 0.4, wa: 0.15, wa2: 0.35, sy: 0.9, alpha: 0.4 + 0.6 * d }; }
      if (a.mast >= 3) {
        // 뒤돈 자세의 dx 는 facing 이 곱해지므로 부호를 뒤집어 같은 자리를 가리킨다
        if (t < 1.2) return { dx: D, skew: 0.25, wa: 0.15, wa2: 0.35, sy: 0.92 };
        if (t < 1.45) { const k = easeOut(segU(t, 1.2, 1.45)); return { dx: -D, facing: -1, sy: 1 - 0.12 * k, skew: 0.15 * k, wa: mix(0.15, 2.5, k), wa2: mix(0.35, 2.7, k) }; }
        if (t < 1.53) { const d = easeOut(segU(t, 1.45, 1.53)); return { dx: -D * (1 - d), facing: -1, skew: 0.4, wa: 0.15, wa2: 0.35, sy: 0.9, alpha: 0.4 + 0.6 * d }; }
        if (t < 1.78) return { dx: 0, facing: -1, skew: 0.25, wa: 0.15, wa2: 0.35, sy: 0.92 };
        const r = easeOut(segU(t, 1.78, 1.9));
        return { dx: 0, facing: r < 0.5 ? -1 : 1, wa: mix(0.15, -1.0, r), wa2: mix(0.35, -0.6, r) };
      }
      if (t < 1.19) return { dx: D, skew: 0.25, wa: 0.15, wa2: 0.35, sy: 0.92 };
      const r = easeOut(segU(t, 1.19, 1.4));
      return { dx: D * (1 - r), wa: mix(0.15, -1.0, r), wa2: mix(0.35, -0.6, r) };
    },
    cues: (a) => {
      const d = a.k.dur, s = a.k.stage || 0;
      const list = [
        [0.448 / d, (a) => { const h = hand(a); starFx(h.x - a.dir * 12, h.y + 4, 12, '#ffffff', 0.3); }],
        [0.644 / d, (a) => {
          const y = groundY() - 26, x = a.x(), far = Math.abs(a.tx() - x) + (s ? 60 : 36);
          razorFx(x, x + a.dir * far, y, '#ff3040', 0.5, 0, false);
          for (let i = 1; i <= 3; i++) ghostFx(a, x + a.dir * (Math.abs(a.tx() - x) + 34) * (i / 4), a.dir, '#ff4d4d', 0.3, { wa: 0.15, skew: 0.4 });
        }],
      ];
      if (a.mast >= 3) {
        list.push([1.3 / d, (a) => { const h = hand(a); starFx(h.x + a.dir * 12, h.y + 4, 14, MASTERY_GOLD, 0.3); }]);
        list.push([1.46 / d, (a) => {
          // 되돌아오는 섬광: 대상 너머에서 출발점까지 금빛 칼날 선과 잔상
          const y = groundY() - 26, x = a.x(), D = Math.abs(a.tx() - x) + 34;
          razorFx(x + a.dir * (D + 20), x - a.dir * 20, y + 4, MASTERY_GOLD, 0.55, 0, false);
          for (let i = 1; i <= 3; i++) ghostFx(a, x + a.dir * D * (1 - i / 4), -a.dir, MASTERY_GOLD, 0.3, { wa: 0.15, skew: 0.4 });
        }]);
      }
      return list;
    },
    hit(a, i) {
      const s = a.k.stage || 0;
      if (i === 0) {
        for (const t of a.targets(i)) burst(t.x, t.y, s ? 30 : 20, ['#ffffff', '#ff3040', '#1a1b22'], 190, 3);
        if (s >= 2) {
          // 칼바람: 터지는 높이에서 화면 가로로 길게
          const x = a.tx(), y = groundY() - 24;
          razorFx(x - 150, x + 150, y, '#ff3040', 0.55, 0.02, false);
          razorFx(x - 110, x + 110, y - 10, '#ffffff', 0.4, 0.05, false);
        }
        impact({ stop: 0.18, shake: s >= 2 ? 0.45 : 0.4 });
      } else if (i === 1) {
        // 늦게 따라오는 잔상의 한 번 더 베기
        for (const t of a.targets(i)) {
          ghostFx(a, t.x - a.dir * 10, a.dir, '#ff4d4d', 0.25, { wa: 0.9, wa2: 1.1, skew: 0.4 }, 0.45);
          slashMarkFx(t.x, t.y, a.dir > 0 ? -0.5 : Math.PI + 0.5, 40, '#ff4d4d', 3, 0.3);
          burst(t.x, t.y, 10, ['#ffffff', '#ff4d4d'], 110);
        }
        impact({ stop: 0.03, shake: 0.1 });
      } else {
        // ★★★ 두 번째 일섬이 터진다: 대상 뒤로 붉은 달 + 금빛 X
        for (const t of a.targets(i)) {
          crescentMarkFx(t.x, t.y - 6, 34, -1.0, 2.2, 10, '#ff3040', 0.7, 0, -a.dir);
          xslashFx(t.x, t.y, 26, MASTERY_GOLD, 0.5);
          burst(t.x, t.y, 40, ['#ffffff', '#ff3040', MASTERY_GOLD, '#1a1b22'], 220, 3);
        }
        impact({ stop: 0.2, shake: 0.5 });
      }
    },
    // 머리카락처럼 가는 선이 그어졌다가 늦게 위아래로 벌어지며 터진다 (★★★ 두 번째는 금빛 두 겹)
    marks(a, t, pow, i) {
      if (i === 1) return;
      const w = a.k.stage ? 42 : 30, col = i === 2 ? MASTERY_GOLD : '#ff3040';
      razorFx(t.x - w, t.x + w, t.y, col, 0.7);
      razorFx(t.x - w * 0.62, t.x + w * 0.62, t.y - 9, col, 0.6, 0.05);
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
    marks(a, t) { clawMarksFx(t.x, t.y, a.dir, '#b388ff', 1.15); },
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
    marks(a, t, pow, i, n) { scorchFx(t.x + rand(-6, 6), t.y + 8, '#b388ff', i === n - 1 ? 0.8 : 0.45); },
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
    marks(a, t, pow, i) { ringSlashFx(t.x, t.y, 24, 9, i % 2 ? 0.3 : -0.3, '#ff9f40', 0.5); },
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
    marks(a, t) { ruptureFx(t.x, '#ff9f40', 62, 0.7); },
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
    marks(a, t) { crackFx(t.x, t.y - 8, '#ffe066', 0.7); },
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
    marks(a, t) { drillFx(t.x, t.y, a.dir, '#ffe066', 0.55); },
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
    marks(a, t) { runeStampFx(t.x + rand(-7, 7), t.y + rand(-9, 9), 7, '#6ff3ff'); },
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
        starStampFx(x1, i % 3 ? '#6ff3ff' : '#ffe066', last ? 22 : 11, last ? 0.8 : 0.55);
      });
      impact(last ? { stop: 0.08, shake: 0.28 } : { shake: 0.06 });
    },
    marks(a, t) { starFx(t.x + rand(-10, 10), t.y + rand(-12, 6), 5, '#ffe066', 0.25); },
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
  const label = `${k.icon} ${k.name}${cutin.star || ''}`;
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
      ctx.fillRect(bx, y, sz, Math.round(sz * Math.min(1, left / skillCd(id))));
    } else {
      ctx.strokeStyle = CLASSES[k.cls].look.fx; ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(clock * 6);
      ctx.strokeRect(bx - 0.5, y - 0.5, sz + 1, sz + 1);
      ctx.globalAlpha = 1;
    }
  });
  ctx.textBaseline = 'alphabetic';
}
