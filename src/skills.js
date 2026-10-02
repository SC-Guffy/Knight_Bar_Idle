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
// 숙련 단계(Lv10·20·30)마다 연출이 진화한다 — Lv1 은 수수하게 시작해서 단계마다 화려해진다:
//   공통 세기 fxVis (MASTERY_VIS): 시전 중 나오는 모든 연출 도구(검흔·고리·빛기둥·파편·히트스톱·흔들림)의 크기·개수에 곱한다
//   Lv1   세기 55%, 직업색이 바랜 회색빛, 오라·몸 잔상·이름 띠 없음 (이름은 작은 글자만)
//   ★ 숙련  세기 80%, 색이 살아나고 작은 오라, 타격마다 직업색 파편
//   ★★ 달인  세기 100%, 원래 색, 발밑 빛 고리·짙은 잔상, 2차 스킬 이름 띠
//   ★★★ 극의 세기 120%, 금빛으로 물듦, 이름 띠(1차도), 바깥 금빛 고리, 시전 끝 마무리 섬광
// 기술의 모양(타격 횟수·마무리 일격)은 classes.js 의 stages 가 따로 바꾼다
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
const MASTERY_VIS = [0.55, 0.8, 1, 1.2];
const MASTERY_FADE = ['#a9adb8', 0.45, 0.2];   // Lv1·★ 에서 직업색을 섞을 회색과 비율
let fxVis = 1;            // 지금 만드는 연출의 세기 (시전의 숙련 단계, updateCasts 가 정한다)
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
  a.vis = MASTERY_VIS[a.mast];
  a.name = skillNameAt(k, lv);              // 단계마다 진화하는 기술 이름 (classes.js stageName)
  if (a.mast >= 3) a.color = mixHex(a.color, MASTERY_GOLD, 0.45);
  else if (a.mast < 2) a.color = mixHex(a.color, MASTERY_FADE[0], MASTERY_FADE[1 + a.mast]);
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
  if (a.mast >= 3 || (skillTier(k) >= 2 && a.mast >= 2)) cutin = { k, name: a.name, color: a.color, t: 0, cx: a.x(), star };
  else addFloater(`${k.icon} ${a.name}${star}`, a.x(), groundY() - 72, a.color, 12);
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
  if (!c || !c.a.mast) return;            // Lv1 은 몸 잔상 없이
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
    fxVis = c.a.vis || 1;
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
  fxVis = 1;
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
    fxVis = MASTERY_VIS[3];
    if (SKILL_FX.sanctuary.finish) SKILL_FX.sanctuary.finish(w.a);
    fxVis = 1;
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
  stop *= fxVis; sh *= fxVis;
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
  width *= fxVis; r *= 0.75 + 0.25 * fxVis;
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
  width *= fxVis;
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
  size *= 0.7 + 0.3 * fxVis;
  slashMarkFx(x, y, Math.PI / 4, size * 2.8, color, 6, life + 0.1, 0, 5);
  slashMarkFx(x, y, -Math.PI / 4, size * 2.8, color, 6, life + 0.1, 0.06, -5);
}
// 4갈래 반짝임
function starFx(x, y, size, color, life) {
  size *= fxVis;
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
const ringFx = (x, color, size = 1, life = 0.5, y = groundY() - 2) => effects.push({ type: 'ring', x, y, t: 0, life, size: size * fxVis, color });
// 하늘에서 내리꽂히는 빛기둥
function pillarFx(x, color, width, life) {
  width *= fxVis;
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
  n = Math.max(1, Math.round(n * fxVis)); spread *= 0.8 + 0.2 * fxVis;
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
  alpha *= Math.min(1, fxVis);
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
  const pow = (t2 ? 1.35 : 1) * (share >= 0.5 ? 2 : share >= 0.2 ? 1.4 : 0.8) * (last && n > 1 ? 1.5 : 1);
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
  len *= 0.75 + 0.25 * fxVis; width *= fxVis;
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
  thick *= fxVis; r *= 0.8 + 0.2 * fxVis;
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
  size *= 0.7 + 0.3 * fxVis;
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
  { const c = (x0 + x1) / 2, k = 0.7 + 0.3 * fxVis; x0 = c + (x0 - c) * k; x1 = c + (x1 - c) * k; }
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
  pow *= fxVis;
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
  if (!c.a.mast || c.a.u >= 0.95 || Math.random() > (c.a.mast >= 2 ? 0.9 : 0.45)) return;
  const x = c.a.px(), gy = groundY();
  parts.push({ x: x + rand(-12, 12), y: gy - rand(2, 30), vx: rand(-8, 8), vy: rand(-90, -40), g: -30, size: Math.random() < 0.3 ? 3 : 2,
    color: Math.random() < 0.65 ? c.a.color : '#ffffff', life: rand(0.3, 0.6), t: 0, add: true });
}
function drawAuras() {
  for (const c of casts) {
    // 오라는 ★ 숙련부터 (작게), ★★ 달인부터 크게 + 발밑 빛 고리
    const t2 = c.a.mast >= 2, k = Math.sin(Math.PI * Math.min(1, c.a.u * 1.2));
    if (k <= 0.02 || !c.a.mast) continue;
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
  size *= fxVis;
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
// ── 진화 연출 도구 (검 계열 숙련 단계 전용) ──
// 뒤 레이어: 기사·몬스터보다 먼저 그린다 (대천사 실루엣·붉은 달·시간 정지 어둠)
function backFx(a, delay, life, draw, end, tick) { aFx(a, delay, life, draw, end, tick); skfx[skfx.length - 1].back = true; }
// 지금 자세의 앞손(무기 쥔 손) 화면 위치와 칼날 각도 — 무기 위에 덧그리는 연출(빛나는 검·대검)이 실제 무기를 따라가게
function gripOf(a) {
  const p = castPose(a.owner) || {}, sy = p.sy || 1, k = p.skew || 0;
  const face = p.facing != null ? p.facing : a.dir;
  const legs = SPR.knightLegs[0].length;
  const wa = p.wa != null ? p.wa : -1.0;
  return {
    x: a.px() + face * (4 * PX + Math.round(k * 3 * PX)),
    y: groundY() - (p.lift || 0) - legs * PX * sy - 3 * PX,
    ang: face > 0 ? wa : Math.PI - wa,
  };
}
// 하단바(탑 안이면 그 층) 전체를 덮는 어둠 — 화면 전체가 아니라 이 게임이 그리는 띠 안에서만
function dimBand(alpha, color = '5,0,10') {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(${color},${alpha})`;
  ctx.fillRect(-60, -240, W + 120, H + 480);
  ctx.restore();
}

// ★ 강철 검풍: 칼날을 따라 푸른 빛이 차오르고 끝에서 불티가 떨어진다
function steelGlowFx(a, life) {
  aFx(a, 0, life, (u) => {
    const g = gripOf(a), L = (9 + 2) * PX, k = Math.min(1, u * 2.2);
    ctx.save();
    ctx.translate(g.x, g.y); ctx.rotate(g.ang);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 + 0.35 * k;
    ctx.fillStyle = '#7fb0ff'; ctx.fillRect(PX, -PX * 1.5, L * k, PX * 3);
    ctx.globalAlpha = 0.9 * k;
    ctx.fillStyle = '#e8f2ff'; ctx.fillRect(PX, -PX / 2, L * k, PX);
    ctx.restore();
  }, null, (u) => {
    if (Math.random() > 0.5) return;
    const g = gripOf(a), L = 10 * PX * Math.min(1, u * 2.2);
    parts.push({ x: g.x + Math.cos(g.ang) * L, y: g.y + Math.sin(g.ang) * L, vx: rand(-20, 20), vy: rand(-30, 10), g: 160, size: 2, color: Math.random() < 0.5 ? '#bcd6ff' : '#ffffff', life: 0.3, t: 0, add: true });
  });
}

// ★★ 강철 대검: 손에 든 검 위로 몸만 한 대검이 겹쳐 보인다 (넓은 칼날·홈·두꺼운 가드)
function greatswordFx(a, life) {
  aFx(a, 0, life, (u) => {
    const g = gripOf(a), grow = easeOut(Math.min(1, u * 4)), fade = u > 0.85 ? (1 - u) / 0.15 : 1;
    const L = 52 * grow, Wd = 11;
    ctx.save();
    ctx.translate(g.x, g.y); ctx.rotate(g.ang);
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#3c4250'; ctx.fillRect(-7, -2, 7, 4);                       // 자루
    ctx.fillStyle = '#c9a24a'; ctx.fillRect(-9, -2.5, 2, 5);                      // 자루 끝
    ctx.fillStyle = '#5a6372'; ctx.fillRect(0, -Wd / 2 - 4, 4, Wd + 8);           // 가드
    ctx.fillStyle = '#9aa6b8'; ctx.fillRect(4, -Wd / 2, L, Wd);                    // 칼날
    ctx.fillStyle = '#d8e0ec'; ctx.fillRect(4, -Wd / 2, L, 2);                     // 날 위쪽 빛
    ctx.fillStyle = '#6d7686'; ctx.fillRect(8, -1, L - 10, 2);                     // 홈
    ctx.fillStyle = '#ffffff'; ctx.fillRect(4, Wd / 2 - 1, L, 1);                  // 날 끝선
    ctx.beginPath(); ctx.moveTo(4 + L, -Wd / 2); ctx.lineTo(4 + L + 8, 0); ctx.lineTo(4 + L, Wd / 2); ctx.closePath();
    ctx.fillStyle = '#c4ccd8'; ctx.fill();                                        // 칼끝
    ctx.restore();
  });
}
// ★★ 바위 송곳: 대검이 땅을 친 자리부터 앞으로 하나씩 솟아 잠시 서 있다가 부서진다
function rockSpikesFx(a, x0, n, gap, life) {
  const gy = groundY();
  for (let i = 0; i < n; i++) {
    const x = x0 + a.dir * gap * (i + 0.5), h = 16 + 7 * Math.sin(i * 1.7 + 1) + i * 2, lean = rand(-0.18, 0.18), at = i * 0.045;
    skFx(null, at, life, (u) => {
      const up = easeOut(Math.min(1, u / 0.08)), sink = u > 0.8 ? (u - 0.8) / 0.2 : 0, hh = h * up * (1 - sink);
      if (hh < 1) return;
      ctx.save();
      ctx.translate(x, gy); ctx.rotate(lean);
      ctx.fillStyle = '#6e6a66';
      ctx.beginPath(); ctx.moveTo(-6, 1); ctx.lineTo(-1, -hh); ctx.lineTo(6, 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a8a29a';
      ctx.beginPath(); ctx.moveTo(-1, -hh); ctx.lineTo(-3, -hh * 0.4); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d9d3c8'; ctx.fillRect(-1, -hh, 1, 3);
      ctx.restore();
    }, () => { debris(x, 5, ['#6e6a66', '#a8a29a'], 0.6); });
    skFx(null, at, 0.01, null, () => { for (let j = 0; j < 6; j++) parts.push({ x: x + rand(-5, 5), y: gy - 2, vx: rand(-60, 60), vy: rand(-160, -60), g: 500, size: 3, color: j % 2 ? '#8a8378' : '#5b5650', life: 0.5, t: 0 }); });
  }
}

// ★★★ 천강검: 땅에 그림자가 번지고, 하늘에서 거대한 강철 검이 떨어져 꽂혔다가 빛가루로 흩어진다
function skySwordFx(x, dropAt, life) {
  const gy = groundY(), BL = 104;          // 칼날 길이
  skFx(null, 0, life, (u) => {
    const t = u * life;
    // 그림자: 떨어지기 전부터 짙어진다
    const sh = Math.min(1, t / dropAt);
    ctx.save();
    ctx.globalAlpha = 0.45 * sh * (t > dropAt + 0.5 ? Math.max(0, 1 - (t - dropAt - 0.5) / 0.3) : 1);
    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.ellipse(x, gy + 1, 6 + 18 * sh, 2 + 2 * sh, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const fall = t < dropAt - 0.16 ? 0 : Math.min(1, (t - (dropAt - 0.16)) / 0.16);
    if (fall <= 0) return;
    const tipY = mix(-40, gy + 6, easeIn(fall));          // 칼끝 높이
    const out = t > dropAt + 0.55 ? Math.min(1, (t - dropAt - 0.55) / 0.3) : 0;
    ctx.save();
    ctx.globalAlpha = 1 - out;
    // 떨어지는 동안 위로 긴 속도선
    if (fall < 1) { ctx.fillStyle = 'rgba(200,220,255,0.5)'; for (const dx of [-9, 0, 9]) ctx.fillRect(x + dx, tipY - BL - 60, 1, 60); }
    const top = tipY - BL;
    ctx.fillStyle = '#8f9bb0'; ctx.fillRect(x - 6, top, 12, BL - 10);                     // 칼날
    ctx.fillStyle = '#dfe7f3'; ctx.fillRect(x - 6, top, 3, BL - 10);                      // 빛 받는 면
    ctx.fillStyle = '#5f6a7e'; ctx.fillRect(x - 1, top + 4, 2, BL - 22);                   // 홈
    ctx.beginPath(); ctx.moveTo(x - 6, tipY - 10); ctx.lineTo(x, tipY); ctx.lineTo(x + 6, tipY - 10); ctx.closePath();
    ctx.fillStyle = '#c9d2e0'; ctx.fill();                                                 // 칼끝
    ctx.fillStyle = '#c9a24a'; ctx.fillRect(x - 20, top - 6, 40, 6);                       // 가드
    ctx.fillStyle = '#ffe08a'; ctx.fillRect(x - 20, top - 6, 40, 2);
    ctx.fillStyle = '#4a3220'; ctx.fillRect(x - 3, top - 26, 6, 20);                       // 자루
    ctx.fillStyle = '#c9a24a'; ctx.fillRect(x - 5, top - 32, 10, 6);                       // 자루 끝
    ctx.fillStyle = '#7fd0ff'; ctx.fillRect(x - 2, top - 30, 4, 3);                        // 보석
    if (fall >= 1) {
      // 꽂힌 뒤: 칼날 가장자리가 숨 쉬듯 빛난다
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - out) * (0.35 + 0.25 * Math.sin(clock * 14));
      ctx.fillStyle = '#9fc4ff'; ctx.fillRect(x - 8, top, 16, BL - 10);
    }
    ctx.restore();
  }, null, (u) => {
    const t = u * life;
    if (t > dropAt + 0.55 && Math.random() < 0.9) parts.push({ x: x + rand(-6, 6), y: gy - rand(0, BL), vx: rand(-10, 10), vy: rand(-70, -30), g: -20, size: 2, color: Math.random() < 0.5 ? '#cfe0ff' : '#ffffff', life: 0.6, t: 0, add: true });
  });
}
// 천강검이 꽂힌 자리: 패인 구덩이와 사방으로 튀는 흙줄기, 바닥을 따라 퍼지는 먼지 물결
function craterFx(x, life = 0.9) {
  const gy = groundY();
  skFx(null, 0, life, (u) => {
    const k = easeOut(Math.min(1, u / 0.15)), fade = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#2b2620';
    ctx.beginPath(); ctx.ellipse(x, gy + 1, 26 * k, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a8946a'; ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const ang = -Math.PI * (0.08 + 0.84 * i / 8), r0 = 10, r1 = 18 + 26 * k;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * r0, gy + Math.sin(ang) * r0 * 0.6); ctx.lineTo(x + Math.cos(ang) * r1, gy + Math.sin(ang) * r1 * 0.6); ctx.stroke();
    }
    const w = 30 + 120 * easeOut(u);
    ctx.globalAlpha = 0.5 * (1 - u);
    ctx.fillStyle = '#c9b38a';
    ctx.fillRect(x - w, gy - 3, w * 2, 3);
    ctx.restore();
  });
}

// Lv1 심판의 빛: 하늘에서 가느다란 빛줄기가 지그재그로 깜박이며 내리친다
function lightRayFx(x, life = 0.28) {
  const gy = groundY(), segs = [];
  for (let y = -10; y < gy; y += 12) segs.push([x + rand(-2.5, 2.5), y]);
  segs.push([x, gy]);
  skFx(null, 0, life, (u) => {
    if (u > 0.4 && Math.floor(u * 30) % 2) return;            // 꺼질 때 깜박
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 2; ctx.globalAlpha = 1 - u * 0.6;
    ctx.beginPath(); segs.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, gy - 2, 6, 2);
    ctx.restore();
  });
}
// ★ 심판의 낙인: 맞은 적 머리 위에 천천히 도는 금빛 표식이 한동안 남는다
function brandFx(x, y, life = 2.2) {
  skFx(null, 0.05, life, (u) => {
    const fade = u < 0.1 ? u / 0.1 : u > 0.75 ? (1 - u) / 0.25 : 1, r = 9, sp = clock * 2.2;
    ctx.save();
    ctx.globalAlpha = fade * 0.9;
    ctx.strokeStyle = '#ffd257'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff3b0';
    for (let i = 0; i < 4; i++) { const t = sp + i * Math.PI / 2; ctx.fillRect(Math.round(x + Math.cos(t) * r) - 1, Math.round(y + Math.sin(t) * r * 0.4) - 1, 2, 2); }
    ctx.fillStyle = '#ffd257'; ctx.fillRect(x - 1, y - 7, 2, 9); ctx.fillRect(x - 3, y - 4, 6, 2);
    ctx.restore();
  });
}
// ★★ 심판의 성검: 대상 위 하늘에 금빛 성검이 나타나 떠 있다가, dropAt 초에 떨어져 박힌 뒤 빛으로 흩어진다
function holySwordFx(x, dropAt, life) {
  const gy = groundY(), hover = gy - 86, L = 30;
  skFx(null, 0, life, (u) => {
    const t = u * life, appear = Math.min(1, t / 0.18);
    const fall = t < dropAt - 0.08 ? 0 : Math.min(1, (t - (dropAt - 0.08)) / 0.08);
    const tip = fall ? mix(hover + L, gy + 4, easeIn(fall)) : hover + L + Math.sin(clock * 6 + x) * 1.5;
    const out = t > dropAt + 0.35 ? Math.min(1, (t - dropAt - 0.35) / 0.25) : 0;
    ctx.save();
    ctx.globalAlpha = appear * (1 - out);
    if (fall === 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,215,90,0.25)'; ctx.fillRect(x - 5, tip - L - 4, 10, L + 8); ctx.globalCompositeOperation = 'source-over'; }
    ctx.fillStyle = '#fff6dc'; ctx.fillRect(x - 2, tip - L, 4, L - 5);                 // 칼날
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, tip - L, 1, L - 5);
    ctx.beginPath(); ctx.moveTo(x - 2, tip - 5); ctx.lineTo(x, tip); ctx.lineTo(x + 2, tip - 5); ctx.closePath(); ctx.fillStyle = '#fff6dc'; ctx.fill();
    ctx.fillStyle = '#ffcc33'; ctx.fillRect(x - 7, tip - L - 3, 14, 3);                // 가드
    ctx.fillStyle = '#8a6a2a'; ctx.fillRect(x - 1, tip - L - 11, 2, 8);                // 자루
    ctx.fillStyle = '#ffcc33'; ctx.fillRect(x - 2, tip - L - 13, 4, 3);
    if (fall > 0 && fall < 1) { ctx.fillStyle = 'rgba(255,240,180,0.6)'; ctx.fillRect(x - 1, tip - L - 40, 2, 30); }
    ctx.restore();
  }, null, (u) => {
    const t = u * life;
    if (t > dropAt + 0.35 && Math.random() < 0.7) parts.push({ x: x + rand(-3, 3), y: gy - rand(4, 28), vx: rand(-10, 10), vy: rand(-60, -30), g: -20, size: 2, color: '#ffe08a', life: 0.5, t: 0, add: true });
  });
}
// 성검이 박힌 자리의 작은 금빛 십자 섬광 (가로로 짧게, 세로로 길게)
function swordImpactFx(x, life = 0.3) {
  const gy = groundY();
  skFx(null, 0, life, (u) => {
    const k = 1 - u;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = k;
    ctx.fillStyle = '#fff3b0'; ctx.fillRect(x - 14 * k, gy - 3, 28 * k, 2); ctx.fillRect(x - 1, gy - 26 * k, 2, 26 * k);
    ctx.restore();
  });
}

// ★★★ 대천사 강림: 기사 뒤에 기사 모습을 한 거대한 빛의 천사가 날개를 펴고 나타나, 기사와 같은 자세로 성검을 휘두른다
function archangelFx(a, life, strikeAt) {
  backFx(a, 0, life, (u) => {
    const t = u * life, x = a.px(), gy = groundY();
    const show = Math.min(1, t / 0.35), out = t > strikeAt + 0.2 ? Math.min(1, (t - strikeAt - 0.2) / 0.3) : 0;
    const al = show * (1 - out);
    if (al <= 0) return;
    const S2 = 2.6, rise = 6 * out * 10;                          // 끝나면 위로 떠오르며 사라진다
    const cx = x - a.dir * 10, base = gy - 4 - rise;
    // 날개: 깃털 줄이 부채꼴로 펼쳐진다
    const open = easeOut(Math.min(1, t / 0.5));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = al * 0.75;
    const flap = Math.sin(clock * 5) * 0.06;
    for (const side of [-1, 1]) {
      for (let row = 0; row < 6; row++) {
        const len = (24 + row * 8) * open, ang = (-Math.PI / 2) + side * (0.3 + row * 0.25 + flap) * open;
        const sx = cx + side * 8, sy = base - 72 + row * 3;
        for (let f = 0; f < len; f += 2) {
          const px = sx + Math.cos(ang) * f, py = sy + Math.sin(ang) * f * 0.75 + f * 0.3;
          ctx.fillStyle = f > len - 5 ? '#ffffff' : row % 2 ? '#ffe7a0' : '#d9a640';
          ctx.fillRect(Math.round(px), Math.round(py), 3, 3);
        }
      }
    }
    ctx.restore();
    // 거대한 빛의 기사 (기사의 지금 자세를 그대로 따라 한다)
    const pose = castPose(a.owner) || {};
    // 망토·방패까지 한 덩어리 빛으로: 따로 그린 기사를 금빛 그라데이션으로 칠해서 겹친다
    const sil = angelSilhouette(a.cls, { mode: 'fight', swing: -1, t: clock, ...pose, lift: 0, dx: 0, facing: a.dir }, S2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 먼저 크게 번진 빛, 그 위에 또렷한 윤곽
    ctx.filter = 'blur(5px)';
    ctx.globalAlpha = al * 0.55;
    ctx.drawImage(sil.cv, cx - sil.ox, base - sil.oy, sil.w, sil.h);
    ctx.filter = 'blur(1px)';
    ctx.globalAlpha = al * (0.3 + 0.08 * Math.sin(clock * 7));
    ctx.drawImage(sil.cv, cx - sil.ox, base - sil.oy, sil.w, sil.h);
    ctx.filter = 'none';
    ctx.restore();
    // 머리 위 고리
    ctx.save();
    ctx.globalAlpha = al;
    ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, base - 108, 12, 3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }, null, (u) => {
    if (Math.random() < 0.5) parts.push({ x: a.px() + rand(-40, 40), y: groundY() - rand(40, 110), vx: rand(-20, 20), vy: rand(10, 40), g: 20, size: 2, color: Math.random() < 0.5 ? '#fff1c8' : '#ffffff', life: 0.8, t: 0, add: true });
  });
}
// 거대한 빛의 기사 한 장: 작은 캔버스에 기사를 S 배로 그린 뒤 그 모양대로 금빛을 칠한다 (망토·방패 색도 지워진다)
const angelCv = document.createElement('canvas');
function angelSilhouette(cls, pose, S) {
  const w = 150, h = 150, ox = 75, oy = 140, dpr = window.devicePixelRatio || 1;
  if (angelCv.width !== w * dpr) { angelCv.width = w * dpr; angelCv.height = h * dpr; }
  const g = angelCv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.imageSmoothingEnabled = false;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, h);
  g.save();
  g.translate(ox, oy); g.scale(S, S); g.translate(-ox, -oy);
  drawHero(g, cls, ox, oy, pose);
  g.restore();
  g.globalCompositeOperation = 'source-in';
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#fffbe8'); grad.addColorStop(0.5, '#ffe08a'); grad.addColorStop(1, '#d9a640');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  return { cv: angelCv, w, h, ox, oy };
}
// 대천사의 일격: 하늘이 열린 듯 넓은 빛이 내려오고 깃털이 흩날린다
function heavenStrikeFx(x, life = 0.9) {
  const gy = groundY();
  skFx(null, 0, life, (u) => {
    const open = easeOut(Math.min(1, u / 0.12)), fade = u > 0.3 ? 1 - (u - 0.3) / 0.7 : 1, w = 120 * open;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade;
    const grad = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    grad.addColorStop(0, 'rgba(255,230,150,0)'); grad.addColorStop(0.3, 'rgba(255,230,150,0.55)'); grad.addColorStop(0.5, 'rgba(255,255,240,0.95)'); grad.addColorStop(0.7, 'rgba(255,230,150,0.55)'); grad.addColorStop(1, 'rgba(255,230,150,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - w / 2, -20, w, gy + 20);
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = fade * 0.8;
    ctx.beginPath(); ctx.ellipse(x, gy, w * 0.7, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
  for (let i = 0; i < 26; i++) parts.push({ x: x + rand(-60, 60), y: rand(-10, gy - 40), vx: rand(-30, 30), vy: rand(20, 60), g: 30, size: Math.random() < 0.4 ? 3 : 2, color: Math.random() < 0.6 ? '#ffffff' : '#fff1c8', life: rand(0.6, 1.1), t: 0 });
}

// ── 성역: 빛의 원 → 황금 돔 → 성채 → 성전 (모두 시전자를 따라다니며 보호막이 끝날 때까지 남는다) ──
const wardFade = (u, life, x) => Math.min(1, u * life / 0.25) * (u > 0.92 ? (1 - u) / 0.08 : 1);
// Lv1 성광: 발밑에만 납작한 빛의 원이 숨 쉬듯 번진다
function lightCircleFx(a, life) {
  aFx(a, 0, life, (u) => {
    const x = a.x(), gy = groundY(), f = wardFade(u, life), p = 0.85 + 0.15 * Math.sin(clock * 5);
    ctx.save();
    ctx.globalAlpha = f * 0.7;
    ctx.strokeStyle = '#e9d9a0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, gy - 1, 22 * p, 4 * p, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = f * 0.18; ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.ellipse(x, gy - 1, 22 * p, 4 * p, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }, null, () => { if (Math.random() < 0.15) parts.push({ x: a.x() + rand(-18, 18), y: groundY() - 2, vx: 0, vy: rand(-30, -15), g: 0, size: 1, color: '#fff3b0', life: 0.6, t: 0 }); });
}
// ★ 성역: 반투명한 황금 돔 하나
function goldenDome(x, gy, rx, ry, f) {
  ctx.save();
  ctx.globalAlpha = f * (0.85 + 0.15 * Math.sin(clock * 6));
  ctx.fillStyle = 'rgba(255,215,90,0.13)';
  ctx.beginPath(); ctx.ellipse(x, gy, rx, ry, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = '#ffd257'; ctx.lineWidth = 2; ctx.shadowColor = '#ffd257'; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.ellipse(x, gy, rx, ry, 0, Math.PI, 0); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x, gy, rx * 0.8, ry * 0.85, 0, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
  ctx.restore();
}
function domeFx(a, life) {
  aFx(a, 0, life, (u) => {
    const g = easeOut(Math.min(1, u * life / 0.25));
    goldenDome(a.x(), groundY(), 34 * g, 46 * g, wardFade(u, life));
  });
}
// ★★ 성채: 돔 둘레에 돌기둥 넷이 땅에서 솟아오른다 (금빛 머리장식, 기둥 사이를 잇는 빛줄)
function rampartFx(a, life) {
  const cols = [-40, -22, 22, 40];
  aFx(a, 0, life, (u) => {
    const x = a.x(), gy = groundY(), f = wardFade(u, life), t = u * life;
    goldenDome(x, gy, 38 * easeOut(Math.min(1, t / 0.25)), 50 * easeOut(Math.min(1, t / 0.25)), f);
    ctx.save();
    ctx.globalAlpha = f;
    const hs = cols.map((c, i) => (Math.abs(c) > 30 ? 30 : 38) * easeOut(Math.min(1, (t - i * 0.05) / 0.18)));
    cols.forEach((c, i) => {
      const h = hs[i]; if (h <= 0) return;
      const px = x + c;
      ctx.fillStyle = '#8c8578'; ctx.fillRect(px - 4, gy - h, 8, h);
      ctx.fillStyle = '#b9b2a4'; ctx.fillRect(px - 4, gy - h, 2, h);
      ctx.fillStyle = '#5e584e'; for (let y = gy - h + 6; y < gy; y += 7) ctx.fillRect(px - 4, y, 8, 1);
      ctx.fillStyle = '#ffcc33'; ctx.fillRect(px - 6, gy - h - 3, 12, 3);
      ctx.fillStyle = '#fff3b0'; ctx.fillRect(px - 1, gy - h - 6, 2, 3);
    });
    // 기둥 꼭대기를 잇는 빛줄
    if (hs.every((h) => h > 20)) {
      ctx.strokeStyle = 'rgba(255,230,140,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); cols.forEach((c, i) => { const px = x + c, py = gy - hs[i] - 5; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke();
    }
    ctx.restore();
  });
}
// ★★★ 성전: 첨탑 셋과 장미창이 있는 금빛 성당 실루엣. 1초마다 종이 울린다
function cathedralShape(x, gy, k) {
  // 바닥 너비 92, 가운데 첨탑 꼭대기 gy-96 — k(0→1)로 아래에서 위로 세워진다
  const top = gy - 96 * k;
  ctx.beginPath();
  ctx.moveTo(x - 46, gy);
  ctx.lineTo(x - 46, gy - 40 * k); ctx.lineTo(x - 38, gy - 62 * k); ctx.lineTo(x - 30, gy - 40 * k);   // 왼쪽 탑
  ctx.lineTo(x - 18, gy - 50 * k); ctx.lineTo(x - 12, gy - 68 * k);
  ctx.lineTo(x, top);                                                                            // 가운데 첨탑
  ctx.lineTo(x + 12, gy - 68 * k); ctx.lineTo(x + 18, gy - 50 * k);
  ctx.lineTo(x + 30, gy - 40 * k); ctx.lineTo(x + 38, gy - 62 * k); ctx.lineTo(x + 46, gy - 40 * k);   // 오른쪽 탑
  ctx.lineTo(x + 46, gy);
  ctx.closePath();
}
function cathedralFx(a, life) {
  aFx(a, 0, life, (u) => {
    const x = a.x(), gy = groundY(), f = wardFade(u, life), t = u * life, k = easeOut(Math.min(1, t / 0.4));
    ctx.save();
    ctx.globalAlpha = f;
    cathedralShape(x, gy, k);
    ctx.fillStyle = 'rgba(255,236,170,0.14)'; ctx.fill();
    ctx.strokeStyle = MASTERY_GOLD; ctx.lineWidth = 1.5; ctx.shadowColor = '#ffd257'; ctx.shadowBlur = 8; ctx.stroke();
    ctx.shadowBlur = 0;
    if (k > 0.7) {
      // 장미창과 아치 창
      const rw = gy - 52;
      ctx.globalAlpha = f * (0.7 + 0.3 * Math.sin(clock * 3));
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, rw, 7, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4 + clock * 0.6; ctx.beginPath(); ctx.moveTo(x, rw); ctx.lineTo(x + Math.cos(an) * 7, rw + Math.sin(an) * 7); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,240,184,0.45)';
      for (const dx of [-38, 38]) { ctx.fillRect(x + dx - 2, gy - 34, 4, 14); ctx.beginPath(); ctx.arc(x + dx, gy - 34, 2, Math.PI, 0); ctx.fill(); }
      ctx.fillRect(x - 5, gy - 18, 10, 18);                                  // 정문
    }
    ctx.restore();
  }, null, (u) => {
    const t = u * life, a0 = a;
    // 종: 1초마다 첨탑 꼭대기에서 소리 물결
    const ring = Math.floor((t - 0.4) / 1.0);
    if (t > 0.4 && ring !== a0.bellN) { a0.bellN = ring; bellWaveFx(a0, 0.7); }
  });
}
// 종소리 물결: 첨탑 꼭대기에서 위쪽 반원 호가 두 겹으로 퍼진다
function bellWaveFx(a, life) {
  skFx(a.owner, 0, life, (u) => {
    const x = a.x(), y = groundY() - 96;
    ctx.save();
    ctx.globalAlpha = (1 - u) * 0.8;
    ctx.strokeStyle = MASTERY_GOLD; ctx.lineWidth = 1;
    for (const k of [1, 0.6]) { const r = 6 + 40 * u * k; ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    ctx.restore();
  });
}
// 성전이 무너진다: 윤곽이 금빛 조각으로 부서져 위로 흩어지고, 큰 종소리와 함께 성광이 터진다
function cathedralFallFx(a) {
  const x = a.x(), gy = groundY();
  for (let i = 0; i < 46; i++) {
    const side = rand(-46, 46), h = rand(0, 90 - Math.abs(side));
    parts.push({ x: x + side, y: gy - h, vx: side * rand(0.5, 1.5), vy: rand(-140, -60), g: 60, size: Math.random() < 0.4 ? 3 : 2, color: i % 3 ? MASTERY_GOLD : '#ffffff', life: rand(0.6, 1.0), t: 0, add: true });
  }
  skFx(null, 0, 0.8, (u) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - u);
    const r = 20 + 130 * easeOut(u);
    const grad = ctx.createRadialGradient(x, gy - 30, 0, x, gy - 30, r);
    grad.addColorStop(0, 'rgba(255,250,220,0.9)'); grad.addColorStop(0.5, 'rgba(255,220,120,0.35)'); grad.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = grad; ctx.fillRect(x - r, gy - 30 - r, r * 2, r * 2);
    ctx.strokeStyle = MASTERY_GOLD; ctx.lineWidth = 2;
    for (const k of [1, 0.7, 0.45]) { ctx.beginPath(); ctx.arc(x, gy - 96, 10 + 120 * u * k, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
    ctx.restore();
  });
  impact({ stop: 0.1, shake: 0.35 });
}

// ── 질풍난무: 삼연참 → 지그재그 → 분신 → 월하난무 ──
// Lv1 삼연참: 제자리에서 쌍검을 번갈아 세 번 (앞칼 내려베기 → 뒷칼 올려베기 → 두 칼 모아 내려베기)
function galeTrioPose(t) {
  if (t < 0.12) { const c = easeOut(t / 0.12); return { wa: mix(-1.0, -2.3, c), wa2: mix(-0.6, 0.9, c), sy: 1 - 0.08 * c, skew: -0.1 * c }; }
  if (t < 0.225) { const d = easeIn(segU(t, 0.12, 0.225)); return { wa: mix(-2.3, 1.0, d), wa2: 0.9, skew: mix(-0.1, 0.3, d), dx: 3 * d, sy: 0.94 }; }      // 앞칼 내려베기
  if (t < 0.27) { const k = segU(t, 0.225, 0.27); return { wa: 1.0, wa2: mix(0.9, 1.2, k), skew: 0.3, dx: 3, sy: 0.94 }; }
  if (t < 0.36) { const d = easeIn(segU(t, 0.27, 0.36)); return { wa: 1.0, wa2: mix(1.2, -2.1, d), skew: mix(0.3, -0.15, d), dx: mix(3, 4.5, d), sy: 0.96 }; }   // 뒷칼 올려베기
  if (t < 0.41) { const k = easeOut(segU(t, 0.36, 0.41)); return { wa: mix(1.0, -2.4, k), wa2: mix(-2.1, -2.2, k), skew: -0.2, dx: 4.5, sy: 1.04 }; }
  if (t < 0.495) { const d = easeIn(segU(t, 0.41, 0.495)); return { wa: mix(-2.4, 1.1, d), wa2: mix(-2.2, 0.9, d), skew: mix(-0.2, 0.4, d), dx: mix(4.5, 7.5, d), sy: mix(1.04, 0.88, d) }; }   // 두 칼 모아 내려베기
  const r = easeOut(segU(t, 0.495, 0.75));
  return { wa: mix(1.1, -1.0, r), wa2: mix(0.9, -0.6, r), skew: 0.4 * (1 - r), dx: 7.5 * (1 - r), sy: mix(0.88, 1, r) };
}
// 삼연참 칼자국: 짧고 가는 붉은 홈 두 줄이 겹친다
function nickFx(x, y, ang, life = 0.25) {
  skFx(null, 0, life, (u) => {
    const L = 14 * Math.min(1, u / 0.2) + 2, ca = Math.cos(ang), sa = Math.sin(ang);
    ctx.save();
    ctx.globalAlpha = 1 - u;
    ctx.strokeStyle = '#d04a52'; ctx.lineWidth = 2;
    for (const o of [-2, 2]) { ctx.beginPath(); ctx.moveTo(x - ca * L - sa * o, y - sa * L + ca * o); ctx.lineTo(x + ca * L - sa * o, y + sa * L + ca * o); ctx.stroke(); }
    ctx.restore();
  });
}
// ★★·★★★ 그림자 분신: 기사의 난무를 거울처럼(대상 너머에서) 혹은 시간차로 따라 하는 검붉은 그림자
//  n: 분신 수. 0번은 거울 분신, 그다음은 0.05초씩 늦게 다른 높이에서 따라 하는 잔영
function shadowClonesFx(a, n) {
  const P = galePlanOf(a);
  aFx(a, 0, P.dur, (u) => {
    const t = u * P.dur, D = Math.max(16, (a.tx() - a.x()) * a.dir), gy = groundY();
    const show = Math.min(1, t / 0.12) * (t > P.dur - 0.15 ? (P.dur - t) / 0.15 : 1);
    for (let i = 0; i < n; i++) {
      const G = galeAt(Math.max(0, t - i * 0.05), D, P);
      const mirror = i % 2 === 0, pos = mirror ? 2 * D - G.pos : G.pos + (i === 1 ? -14 : 14);
      const f = (pos > D ? -1 : 1) * a.dir, x = a.x() + a.dir * pos;
      const pose = { mode: 'fight', swing: -1, t: clock, ...G.body, dx: 0, facing: f };
      ctx.save();
      ctx.globalAlpha = show * (i ? 0.5 : 0.8);
      drawHero(ctx, a.cls, x, gy, { ...pose, tint: '#2a0910' });
      drawHero(ctx, a.cls, x, gy, { ...pose, onlyWeapon: true, alpha: 0.9 });
      // 붉은 눈빛 한 점
      ctx.fillStyle = '#ff2030'; ctx.fillRect(Math.round(x + f * 3), Math.round(gy - (G.body.lift || 0) - 34), 2, 1);
      ctx.restore();
    }
  });
}
// ★★★ 시간 정지: 하단바가 검붉게 어두워지고 그 사이 그어진 칼자국이 허공에 멈춰 있다가, 마무리 일격에 한꺼번에 부서진다
function timeStopFx(a, from, to, cx, cy) {
  const life = to - from, lines = [];
  for (let i = 0; i < 9; i++) lines.push({ ang: rand(0, Math.PI), len: rand(22, 46), ox: rand(-14, 14), oy: rand(-14, 10), at: i / 9 });
  backFx(a, from, life + 0.25, (u) => {
    const t = u * (life + 0.25), k = t < 0.08 ? t / 0.08 : t > life ? 1 - (t - life) / 0.25 : 1;
    dimBand(0.62 * k, '20,0,6');
  });
  aFx(a, from, life, (u) => {
    ctx.save();
    for (const L of lines) {
      if (u < L.at * 0.8) continue;
      const ca = Math.cos(L.ang), sa = Math.sin(L.ang), x = cx + L.ox, y = cy + L.oy;
      ctx.strokeStyle = '#ff2a3a'; ctx.lineWidth = 2; ctx.globalAlpha = 0.95;
      ctx.beginPath(); ctx.moveTo(x - ca * L.len / 2, y - sa * L.len / 2); ctx.lineTo(x + ca * L.len / 2, y + sa * L.len / 2); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(x - ca * L.len / 3, y - sa * L.len / 3); ctx.lineTo(x + ca * L.len / 3, y + sa * L.len / 3); ctx.stroke();
    }
    ctx.restore();
  }, () => {
    for (const L of lines) for (let j = 0; j < 6; j++) {
      const f = rand(-0.5, 0.5);
      parts.push({ x: cx + L.ox + Math.cos(L.ang) * L.len * f, y: cy + L.oy + Math.sin(L.ang) * L.len * f, vx: rand(-160, 160), vy: rand(-160, 60), g: 260, size: 2, color: j % 2 ? '#ff2a3a' : '#ffffff', life: 0.45, t: 0 });
    }
  });
}

// ── 일섬: 발도 → 섬광 돌진 → 납도 → 적월 ──
// Lv1 발도: 제자리에서 앞으로 짧은 호를 긋는 칼빛 (가로로 납작한 반원)
function drawArcFx(a, x, y, life = 0.22) {
  const d = a.dir;
  skFx(null, 0, life, (u) => {
    const sweep = Math.min(1, u / 0.35);
    ctx.save();
    ctx.globalAlpha = 1 - u;
    ctx.strokeStyle = '#e8c8cc'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, 22, 7, 0, d > 0 ? Math.PI * 1.25 : -Math.PI * 0.25, d > 0 ? Math.PI * 1.25 + Math.PI * 1.1 * sweep : -Math.PI * 0.25 - Math.PI * 1.1 * sweep, d < 0);
    ctx.stroke();
    ctx.restore();
  });
}
// ★★ 납도: 칼을 거두는 순간 손잡이에서 "딸깍" 불꽃, 그리고 하단바 끝에서 끝까지 한 줄 검선이 그어졌다 사라진다
function sheatheFx(a, y) {
  const h = hand(a);
  for (let i = 0; i < 7; i++) parts.push({ x: h.x, y: h.y, vx: rand(-60, 60), vy: rand(-80, -20), g: 300, size: 1, color: '#ffe0a0', life: 0.25, t: 0 });
  skFx(null, 0, 0.5, (u) => {
    const grow = easeOut(Math.min(1, u / 0.12)), cx = h.x, half = (W + 80) * grow;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1 - u;
    ctx.fillStyle = '#ff3040'; ctx.fillRect(cx - half, y - 1, half * 2, 3);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - half, y, half * 2, 1);
    ctx.restore();
  });
}
// ★★★ 적월: 대상 뒤 하늘에 붉은 보름달이 떠오르고, 이중 일섬 동안 하단바가 핏빛으로 가라앉는다
function bloodMoonFx(a, life, dimFrom, dimTo) {
  const mx = a.tx() + a.dir * 34, my = groundY() - 92;
  backFx(a, 0, life, (u) => {
    const t = u * life, rise = easeOut(Math.min(1, t / 0.5)), out = t > life - 0.3 ? (life - t) / 0.3 : 1;
    const dim = t < dimFrom ? 0 : t < dimFrom + 0.1 ? (t - dimFrom) / 0.1 : t < dimTo ? 1 : Math.max(0, 1 - (t - dimTo) / 0.2);
    if (dim > 0) dimBand(0.55 * dim, '24,0,4');
    const y = my + 16 * (1 - rise);
    ctx.save();
    ctx.globalAlpha = rise * out;
    const glow = ctx.createRadialGradient(mx, y, 10, mx, y, 44);
    glow.addColorStop(0, 'rgba(255,60,60,0.45)'); glow.addColorStop(1, 'rgba(255,40,40,0)');
    ctx.fillStyle = glow; ctx.fillRect(mx - 44, y - 44, 88, 88);
    ctx.fillStyle = '#c4202c'; ctx.beginPath(); ctx.arc(mx, y, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e84450'; ctx.beginPath(); ctx.arc(mx - 4, y - 4, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a3141f';
    for (const [cx, cy, r] of [[6, -6, 4], [-8, 5, 3], [3, 9, 2.5], [-3, -11, 2]]) { ctx.beginPath(); ctx.arc(mx + cx, y + cy, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
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

// ── 진화 연출 도구 (창 계열 숙련 단계 전용) ──
// Lv1 찌르기: 창끝에서 짧고 가는 흰 선 하나와 작은 불티
function jabLineFx(x, y, dir, life = 0.16) {
  skFx(null, 0, life, (u) => {
    const L = 22 * Math.min(1, u / 0.3);
    ctx.save(); ctx.globalAlpha = 1 - u;
    ctx.fillStyle = '#e8eef5'; ctx.fillRect(Math.min(x, x + dir * L), y, L, 1);
    ctx.restore();
  });
  parts.push({ x: x + dir * 22, y, vx: dir * 40, vy: -20, g: 120, size: 2, color: '#ffffff', life: 0.2, t: 0 });
}
// ★★ 투창: 창의 빛이 떨어져 나가 날아가고(꼬리 바람), 끝에서 비스듬히 땅에 꽂혀 부르르 떨다 녹아내린다
function thrownSpearFx(a, x0, y0, dist, life) {
  const d = a.dir, fly = 0.14, gy = groundY();
  const xEnd = x0 + d * dist, yEnd = gy - 6;
  skFx(null, 0, life, (u) => {
    const t = u * life;
    let x, y, ang;
    if (t < fly) { const k = t / fly; x = mix(x0, xEnd, k); y = mix(y0, yEnd, k * k); ang = Math.atan2((yEnd - y0) * 2 * k / dist, d); }
    else { x = xEnd; y = yEnd; ang = Math.atan2(0.35, d) + Math.sin(t * 60) * 0.06 * Math.max(0, 1 - (t - fly) / 0.4); }
    const out = t > life - 0.3 ? (life - t) / 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = out;
    ctx.translate(x, y); ctx.rotate(ang);
    if (t < fly) { ctx.fillStyle = 'rgba(159,212,154,0.5)'; for (const oy of [-3, 0, 3]) ctx.fillRect(-40, oy, 26, 1); }
    ctx.fillStyle = "#6fa37a"; ctx.fillRect(-26, -1, 26, 2);                                  // 자루
    ctx.fillStyle = '#d6ffd8'; ctx.fillRect(-26, -1, 26, 1);
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(10, 0); ctx.lineTo(0, 4); ctx.closePath();
    ctx.fillStyle = '#eafff0'; ctx.fill();                                                    // 창날
    ctx.restore();
  }, null, (u) => {
    const t = u * life;
    if (t > fly && t < life - 0.3 && Math.random() < 0.4) parts.push({ x: xEnd + rand(-4, 4), y: yEnd - rand(0, 18), vx: 0, vy: rand(-30, -10), g: -10, size: 1, color: '#bfffd0', life: 0.4, t: 0 });
  });
}
// ★★★ 천공창: 기사 등 뒤에 거대한 빛의 창이 맺힌다 (차오르는 동안 길어지고 밝아진다)
function spearChargeFx(a, life) {
  aFx(a, 0, life, (u) => {
    const x = a.px() - a.dir * 6, y = groundY() - 30, k = easeOut(u), L = 70 * k;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.3 + 0.5 * k;
    ctx.translate(x, y); ctx.scale(a.dir, 1);
    ctx.fillStyle = '#6fa37a'; ctx.fillRect(-L, -2, L, 4);
    ctx.fillStyle = '#d6ffd8'; ctx.fillRect(-L, -1, L, 1);
    ctx.beginPath(); ctx.moveTo(0, -9 * k); ctx.lineTo(22 * k, 0); ctx.lineTo(0, 9 * k); ctx.closePath(); ctx.fillStyle = '#eafff0'; ctx.fill();
    // 창날을 감는 나선 빛
    ctx.strokeStyle = '#bfffd0'; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) { const ph = clock * 18 + i * 2.1; ctx.beginPath(); ctx.ellipse(-L * 0.3 * i / 2, 0, 4, 10 * k, 0, ph, ph + 2); ctx.stroke(); }
    ctx.restore();
  });
}
// ★★★ 천공창 발사: 회전하는 거대한 창이 하단바 끝까지 일직선으로 뚫고 나간다 — 창 둘레로 소용돌이 고리, 지나간 땅은 패인 고랑
function drillSpearFx(a, x0, y, life) {
  const d = a.dir, end = d > 0 ? W + 40 : -40, len = Math.abs(end - x0);
  skFx(null, 0, life, (u) => {
    const head = x0 + d * len * easeOut(Math.min(1, u / 0.35)), fade = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    // 지나간 길: 땅이 패인 고랑
    ctx.fillStyle = '#3a3026'; ctx.fillRect(Math.min(x0, head), groundY(), Math.abs(head - x0), 2);
    // 창 몸통: 빛나는 원뿔
    ctx.globalCompositeOperation = 'lighter';
    const tail = head - d * 90;
    const grad = ctx.createLinearGradient(tail, 0, head, 0);
    grad.addColorStop(0, 'rgba(111,163,122,0)'); grad.addColorStop(1, 'rgba(214,255,216,0.9)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(tail, y - 3); ctx.lineTo(head - d * 18, y - 12); ctx.lineTo(head + d * 14, y); ctx.lineTo(head - d * 18, y + 12); ctx.lineTo(tail, y + 3); ctx.closePath(); ctx.fill();
    // 몸통을 감는 회전 띠
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) { const px = head - d * (8 + i * 18), ph = clock * 30 + i; ctx.beginPath(); ctx.ellipse(px, y, 3, 11 - i * 2, 0, ph, ph + 2.4); ctx.stroke(); }
    // 지나간 자리마다 남는 소용돌이 고리
    ctx.strokeStyle = 'rgba(191,255,208,0.7)'; ctx.lineWidth = 1;
    for (let rx = x0 + d * 30; d > 0 ? rx < head - 40 : rx > head + 40; rx += d * 46) { ctx.beginPath(); ctx.ellipse(rx, y, 3, 14 * fade, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }, null, (u) => {
    const head = x0 + d * len * easeOut(Math.min(1, u / 0.35));
    if (u < 0.4) for (let i = 0; i < 3; i++) parts.push({ x: head - d * rand(0, 30), y: groundY() - 1, vx: -d * rand(20, 80), vy: rand(-140, -40), g: 420, size: 2, color: i % 2 ? '#8a7a68' : '#5b5048', life: 0.5, t: 0 });
  });
}

// Lv1 도약 찌르기: 착지 자리의 작은 흙먼지 고리
function hopDustFx(x, life = 0.35) {
  const gy = groundY();
  skFx(null, 0, life, (u) => {
    ctx.save(); ctx.globalAlpha = (1 - u) * 0.7;
    ctx.strokeStyle = '#c9b38a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, gy - 1, 6 + 16 * u, 2 + 2 * u, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  });
}
// ★★ 업화: 내리꽂힌 자리에 보라 불꽃이 바닥을 따라 넘실대며 한동안 타오른다 (도트 불꽃 혀가 제각각 일렁인다)
function firePoolFx(x, halfW, life) {
  const gy = groundY(), tongues = [];
  for (let i = 0; i < 13; i++) tongues.push({ dx: mix(-halfW, halfW, i / 12) + rand(-3, 3), h: rand(7, 15), ph: rand(0, 6) });
  skFx(null, 0, life, (u) => {
    const grow = Math.min(1, u * life / 0.15), fade = u > 0.8 ? (1 - u) / 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(122,60,255,0.35)'; ctx.fillRect(x - halfW * grow, gy - 2, halfW * 2 * grow, 3);
    for (const T of tongues) {
      if (Math.abs(T.dx) > halfW * grow) continue;
      const h = T.h * (0.7 + 0.3 * Math.sin(clock * 12 + T.ph)) * (1 - Math.abs(T.dx) / halfW * 0.4);
      ctx.fillStyle = '#7a3cff'; ctx.fillRect(Math.round(x + T.dx) - 2, gy - h, 4, h);
      ctx.fillStyle = '#b388ff'; ctx.fillRect(Math.round(x + T.dx) - 1, gy - h + 2, 2, h - 2);
      ctx.fillStyle = '#e0c8ff'; ctx.fillRect(Math.round(x + T.dx), gy - h * 0.5, 1, h * 0.5);
    }
    ctx.restore();
  }, null, () => { if (Math.random() < 0.5) parts.push({ x: x + rand(-halfW, halfW), y: gy - rand(6, 14), vx: rand(-8, 8), vy: rand(-50, -25), g: -10, size: 2, color: Math.random() < 0.5 ? '#b388ff' : '#e0c8ff', life: 0.5, t: 0, add: true }); });
}
// ★★★ 유성룡: 떨어지는 동안 기사 뒤로 보라 용의 몸통이 굽이치며 따라오고(지나온 자리를 기억해 잇는다), 머리에 뿔과 눈
function dragonTrailFx(a, from, to) {
  const pts = [];
  aFx(a, from, to - from + 0.25, (u) => {
    if (pts.length < 2) return;
    const fade = u > 0.8 ? (1 - u) / 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i], q = pts[i - 1], k = i / pts.length, w = 2 + 9 * k;
      const wob = Math.sin(clock * 14 + i * 0.7) * 3 * (1 - k);
      ctx.strokeStyle = i % 3 ? '#5a2bb0' : '#b388ff'; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(q.x + wob, q.y); ctx.lineTo(p.x + wob, p.y); ctx.stroke();
      if (i % 4 === 0) { ctx.fillStyle = '#e0c8ff'; ctx.fillRect(Math.round(p.x + wob - w / 2), Math.round(p.y) - 1, 2, 2); }   // 비늘 빛
    }
    const h = pts[pts.length - 1];
    ctx.fillStyle = '#3b2458'; ctx.fillRect(h.x - 7, h.y - 22, 14, 10);       // 머리
    ctx.fillStyle = '#b388ff'; ctx.fillRect(h.x - 9, h.y - 26, 3, 6); ctx.fillRect(h.x + 6, h.y - 26, 3, 6);   // 뿔
    ctx.fillStyle = '#ffe066'; ctx.fillRect(h.x - 4, h.y - 19, 2, 2); ctx.fillRect(h.x + 2, h.y - 19, 2, 2);   // 눈
    ctx.restore();
  }, null, () => {
    const p = castPose(a.owner) || {};
    if (pts.length < 26) pts.push({ x: a.px(), y: groundY() - 24 - (p.lift || 0) });
    else { pts.shift(); pts.push({ x: a.px(), y: groundY() - 24 - (p.lift || 0) }); }
  });
}
// 유성 파편 하나: 하늘에서 비스듬히 떨어지는 작은 보라 불덩이, 땅에 닿으면 작은 불꽃 꽃
function shardFallFx(x, delay, life = 0.22) {
  const gy = groundY(), x0 = x - 30;
  skFx(null, delay, life, (u) => {
    const px = mix(x0, x, u), py = mix(-10, gy - 4, u * u);
    ctx.save();
    ctx.fillStyle = 'rgba(179,136,255,0.5)'; ctx.fillRect(px - 12, py - 10, 12, 2);
    ctx.fillStyle = '#e0c8ff'; ctx.fillRect(px - 3, py - 3, 6, 6);
    ctx.fillStyle = '#7a3cff'; ctx.fillRect(px - 2, py - 2, 4, 4);
    ctx.restore();
  }, () => {
    for (let i = 0; i < 10; i++) parts.push({ x, y: gy - 3, vx: rand(-90, 90), vy: rand(-130, -40), g: 300, size: 2, color: i % 2 ? '#b388ff' : '#ffffff', life: 0.4, t: 0 });
  });
}

// ── 용의 숨결 ──
// Lv1 화염 숨: 창끝에서 짧게 터지는 주황빛 불꽃 몇 점 (용머리 없이)
function puffFx(x, y, dir) {
  for (let i = 0; i < 3; i++) parts.push({ x, y: y + rand(-2, 2), vx: dir * rand(70, 120), vy: rand(-25, 10), g: -30, size: 2, color: i % 2 ? '#ffb070' : '#c79bff', life: rand(0.18, 0.28), t: 0 });
}
// ★★ 삼두룡: 창끝 둘레로 작은 용머리 셋이 위·가운데·아래로 갈라져 나타나 각자 불꽃을 뿜는다
const TRI_ANG = [-0.32, 0, 0.32];
function tripleHeadsFx(a, life) {
  aFx(a, 0, life, (u) => {
    const h = hand(a), k = u < 0.1 ? u / 0.1 : u > 0.88 ? (1 - u) / 0.12 : 1;
    TRI_ANG.forEach((ang, i) => {
      const r = 18 + (i === 1 ? 6 : 0), x = h.x + a.dir * Math.cos(ang) * r, y = h.y + Math.sin(ang) * r * 1.6 + Math.sin(clock * 20 + i) * 1.5;
      // 목: 창끝에서 머리까지 이어진 보라 줄
      ctx.save(); ctx.globalAlpha = k * 0.8; ctx.strokeStyle = '#5a2bb0'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(h.x + a.dir * 6, h.y); ctx.quadraticCurveTo(h.x + a.dir * r * 0.5, y, x - a.dir * 6, y); ctx.stroke(); ctx.restore();
      drawSprite(DRAGON_HEAD, DRAGON_PAL, x, y + 9, 2, { flip: a.dir < 0, alpha: k });
    });
  }, null, (u) => {
    if (u < 0.12 || u > 0.9) return;
    const h = hand(a);
    TRI_ANG.forEach((ang, i) => {
      const r = 18 + (i === 1 ? 6 : 0), x = h.x + a.dir * (Math.cos(ang) * r + 10), y = h.y + Math.sin(ang) * r * 1.6;
      parts.push({ x, y, vx: a.dir * rand(150, 230) * Math.cos(ang), vy: Math.sin(ang) * 160 + rand(-20, 20), g: -30, size: Math.random() < 0.4 ? 3 : 2, color: ['#b388ff', '#e0c8ff', '#7a3cff'][i], life: rand(0.3, 0.45), t: 0 });
    });
  });
}
// ★★★ 용왕: 기사 뒤 하늘에 거대한 용왕 머리가 떠오른다 (뿔·갈기·빛나는 눈, 입이 벌어진다)
const GREAT_DRAGON = [
  '....hh..............',
  '...hHHh......hh.....',
  '..hHHHHhhhhhhHHh....',
  '.hHHHHHHHHHHHHHHhh..',
  'hHHHeeHHHHHHHHHHHHh.',
  'hHHHeyHHHHHHHHHHHHHh',
  'hHHHHHHHHHHHHwHwHwHh',
  '.hhHHHHHHHHHmmmmmmmh',
  '...hhhHHHHHHmmmmmmm.',
  '.....hHHHHHHHwHwHwh.',
  '......hhhHHHHHHHHh..',
  '.........hhhhhhhh...',
];
const GREAT_DRAGON_PAL = { h: '#241238', H: '#5a2bb0', e: '#ffe066', y: '#ff3b3b', w: '#f4f1e8', m: '#1a0a28' };
function greatDragonFx(a, life, openAt) {
  backFx(a, 0, life, (u) => {
    const t = u * life, rise = easeOut(Math.min(1, t / 0.6)), out = t > life - 0.3 ? (life - t) / 0.3 : 1;
    const x = a.px() - a.dir * 10, base = groundY() - 46 + 30 * (1 - rise);
    const open = t > openAt ? Math.min(1, (t - openAt) / 0.12) : 0;
    ctx.save();
    ctx.globalAlpha = rise * out * 0.92;
    // 아래턱이 벌어지도록 위/아래를 나눠 그린다
    const top = GREAT_DRAGON.slice(0, 7), jaw = GREAT_DRAGON.slice(7);
    drawSprite(top, GREAT_DRAGON_PAL, x + a.dir * 30, base, 5, { flip: a.dir < 0 });
    drawSprite(jaw, GREAT_DRAGON_PAL, x + a.dir * 30, base + jaw.length * 5 + open * 12, 5, { flip: a.dir < 0 });
    // 갈기: 머리 뒤로 흔들리는 보라 불꽃 줄기
    for (let i = 0; i < 7; i++) {
      const mx = x - a.dir * (14 + i * 6), my = base - 30 + i * 6, len = 14 + 6 * Math.sin(clock * 10 + i);
      ctx.fillStyle = i % 2 ? '#7a3cff' : '#b388ff'; ctx.fillRect(Math.round(a.dir > 0 ? mx - len : mx), Math.round(my), len, 3);
    }
    ctx.restore();
  });
}
// 용왕의 광선: 입에서 하단바 끝까지 굵은 보라 빛줄기 (가장자리가 출렁이고 흰 심이 떨린다)
function dragonBeamFx(a, from, life) {
  aFx(a, from, life, (u) => {
    const d = a.dir, x0 = a.px() + d * 70, y = groundY() - 30, end = d > 0 ? W + 40 : -40;
    const k = u < 0.08 ? u / 0.08 : u > 0.85 ? (1 - u) / 0.15 : 1, w = 26 * k;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(122,60,255,0.55)';
    for (let x = x0; d > 0 ? x < end : x > end; x += d * 6) {
      const ww = w * (0.8 + 0.2 * Math.sin(clock * 30 + x * 0.1));
      ctx.fillRect(Math.min(x, x + d * 6), y - ww / 2, 6, ww);
    }
    ctx.fillStyle = 'rgba(224,200,255,0.8)'; ctx.fillRect(Math.min(x0, end), y - w * 0.22, Math.abs(end - x0), w * 0.44);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.min(x0, end), y - 1 + Math.sin(clock * 50), Math.abs(end - x0), 2);
    ctx.restore();
  }, null, (u) => {
    const d = a.dir, x0 = a.px() + d * 70, y = groundY() - 30;
    for (let i = 0; i < 2; i++) parts.push({ x: x0 + d * rand(0, W), y: y + rand(-12, 12), vx: d * rand(60, 160), vy: rand(-40, 40), g: 0, size: 2, color: Math.random() < 0.5 ? '#e0c8ff' : '#ffffff', life: 0.3, t: 0, add: true });
  });
}
// 포효: 용왕의 입 앞에서 반원 음파가 연달아 퍼진다
function roarFx(a, life = 0.6) {
  aFx(a, 0, life, (u) => {
    const x = a.px() + a.dir * 64, y = groundY() - 32;
    ctx.save(); ctx.strokeStyle = '#c79bff'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const p = (u * 1.6 + i * 0.25) % 1, r = 8 + 60 * p;
      ctx.globalAlpha = (1 - p) * 0.8;
      ctx.beginPath(); ctx.arc(x, y, r, a.dir > 0 ? -0.9 : Math.PI - 0.9, a.dir > 0 ? 0.9 : Math.PI + 0.9); ctx.stroke();
    }
    ctx.restore();
  });
}

// ── 대회전 ──
// Lv1 휩쓸기: 앞쪽으로 반원을 긋는 납작한 주황 호 하나
function sweepArcFx(a, life = 0.25) {
  skFx(null, 0, life, (u) => {
    const x = a.px(), y = groundY() - HAND_Y, k = Math.min(1, u / 0.4);
    ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = '#e0a070'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y, 34, 9, 0, a.dir > 0 ? -Math.PI / 2 : Math.PI / 2, a.dir > 0 ? -Math.PI / 2 + Math.PI * k : Math.PI / 2 + Math.PI * k, a.dir < 0); ctx.stroke();
    ctx.restore();
  });
}
// ★★ 회오리: 기사 발밑에서 흙먼지 회오리가 생겨 점점 커지다가, 끝나면 앞으로 굴러가며 흩어진다
function dustTwisterFx(a, life, rollAt) {
  let x0 = null;
  aFx(a, 0, life, (u) => {
    const t = u * life;
    if (x0 == null) x0 = a.x();
    const roll = t > rollAt ? (t - rollAt) * 90 : 0;
    const x = (t > rollAt ? x0 + a.dir * roll : a.x()), gy = groundY();
    const grow = Math.min(1, t / 0.4), fade = u > 0.85 ? (1 - u) / 0.15 : 1, H = 64 * grow;
    if (t <= rollAt) x0 = a.x();
    ctx.save();
    ctx.globalAlpha = fade * 0.85;
    for (let i = 0; i < 9; i++) {
      const k = i / 8, y = gy - k * H, rx = 6 + 20 * k, ph = clock * 14 - i * 0.6;
      ctx.strokeStyle = i % 2 ? '#c9b38a' : '#a8946a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x + Math.sin(clock * 6 + k * 3) * 3 * k, y, rx, 3 + 2 * k, 0, ph, ph + 3.6); ctx.stroke();
    }
    ctx.restore();
  }, null, (u) => {
    const t = u * life, x = x0 == null ? a.x() : x0 + (t > rollAt ? a.dir * (t - rollAt) * 90 : 0);
    if (Math.random() < 0.8) parts.push({ x: x + rand(-14, 14), y: groundY() - rand(0, 50), vx: rand(-60, 60), vy: rand(-60, -20), g: 60, size: 2, color: Math.random() < 0.5 ? '#c9b38a' : '#8a7a68', life: 0.4, t: 0 });
  });
}
// ★★★ 폭풍: 하단바 위쪽으로 먹구름이 몰려와 뭉게뭉게 꿈틀대고, 빗줄기가 비스듬히 떨어진다
function stormCloudFx(a, life) {
  const puffs = [];
  for (let i = 0; i < 9; i++) puffs.push({ dx: (i - 4) * 16 + rand(-4, 4), r: rand(10, 17), ph: rand(0, 6) });
  backFx(a, 0, life, (u) => {
    const t = u * life, x = a.px(), cy = groundY() - 108, k = Math.min(1, t / 0.35), out = t > life - 0.35 ? (life - t) / 0.35 : 1;
    ctx.save();
    ctx.globalAlpha = k * out;
    for (const P of puffs) { ctx.fillStyle = '#2a2d3a'; ctx.beginPath(); ctx.arc(x + P.dx * k, cy + Math.sin(clock * 2 + P.ph) * 2, P.r, 0, Math.PI * 2); ctx.fill(); }
    for (const P of puffs) { ctx.fillStyle = '#3d4152'; ctx.beginPath(); ctx.arc(x + P.dx * k - 2, cy - 3 + Math.sin(clock * 2 + P.ph) * 2, P.r * 0.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = 'rgba(160,190,230,0.45)'; ctx.lineWidth = 1;
    for (let i = 0; i < 16; i++) { const rx = x - 70 + ((i * 37 + clock * 120) % 140), ry = cy + 12 + ((i * 53 + clock * 260) % 90); ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 8); ctx.stroke(); }
    ctx.restore();
  });
}
// 벼락: 구름에서 대상까지 갈라지는 번개 (가지 하나), 맞은 자리에 하얀 섬광
function boltFx(x, life = 0.22) {
  const gy = groundY(), top = gy - 100, pts = [[x + rand(-10, 10), top]];
  for (let y = top + 12; y < gy; y += 12) pts.push([x + rand(-7, 7), y]);
  pts.push([x, gy - 2]);
  const br = pts[3] ? [[pts[3][0], pts[3][1]], [pts[3][0] + rand(10, 18), pts[3][1] + 16], [pts[3][0] + rand(14, 24), pts[3][1] + 26]] : null;
  skFx(null, 0, life, (u) => {
    if (u > 0.5 && Math.floor(u * 24) % 2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [P, w, c] of [[pts, 4, 'rgba(140,180,255,0.6)'], [pts, 1.5, '#ffffff'], ...(br ? [[br, 1, '#cfe0ff']] : [])]) {
      ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath(); P.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
    }
    ctx.globalAlpha = 1 - u; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x, gy - 2, 14, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
}

// ── 대지 가르기 ──
// Lv1 내려찍기: 날 끝에서 짧은 금 하나
function shortCrackFx(x, dir, life = 0.5) {
  const gy = groundY(), pts = [[x, gy + 1]];
  for (let i = 1; i <= 4; i++) pts.push([x + dir * i * 7, gy + 1 + (i % 2 ? -1 : 1)]);
  skFx(null, 0, life, (u) => {
    ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = '#5a4a42'; ctx.lineWidth = 2;
    ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke(); ctx.restore();
  });
}
// ★★ 대지 진동: 땅이 파도처럼 솟아 앞으로 밀려간다 (흙 둔덕이 굴러가며 풀과 흙을 튀긴다) — 두 번 연달아
function quakeWaveFx(a, x0, dist, life, delay = 0, hgt = 10) {
  const d = a.dir, gy = groundY();
  skFx(null, delay, life, (u) => {
    const cx = x0 + d * dist * u, fade = u > 0.8 ? (1 - u) / 0.2 : 1, hw = 22;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#6b5a44';
    ctx.beginPath(); ctx.moveTo(cx - hw, gy + 1);
    for (let i = 0; i <= 12; i++) { const k = i / 12, px = cx - hw + 2 * hw * k; ctx.lineTo(px, gy + 1 - Math.sin(Math.PI * k) * hgt); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8fbf5a';
    for (let i = 1; i < 12; i += 2) { const k = i / 12, px = cx - hw + 2 * hw * k; ctx.fillRect(Math.round(px), Math.round(gy - Math.sin(Math.PI * k) * hgt) - 2, 2, 3); }
    ctx.restore();
  }, null, (u) => {
    const cx = x0 + d * dist * u;
    if (Math.random() < 0.7) parts.push({ x: cx + rand(-10, 10), y: gy - hgt, vx: d * rand(0, 60), vy: rand(-120, -50), g: 400, size: 2, color: Math.random() < 0.5 ? '#8a7a68' : '#8fbf5a', life: 0.4, t: 0 });
  });
}
// ★★★ 대지 분쇄: 하단바를 가로지르는 용암 균열이 빛나며 벌어지고, 군데군데 용암이 솟구쳐 불덩이가 흩어진다
function lavaFissureFx(a, x0, life) {
  const d = a.dir, gy = groundY(), end = d > 0 ? W + 20 : -20, pts = [];
  for (let x = x0; d > 0 ? x < end : x > end; x += d * 10) pts.push([x, gy + 1 + rand(-2, 2)]);
  skFx(null, 0, life, (u) => {
    const grow = Math.min(1, u / 0.15), m = Math.max(2, Math.round(pts.length * grow)), fade = u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1;
    const glow = 0.7 + 0.3 * Math.sin(clock * 9);
    ctx.save();
    ctx.globalAlpha = fade;
    for (const [w, c] of [[7, `rgba(255,80,20,${0.35 * glow})`], [4, '#2a1408'], [2, '#ff6a1a'], [1, '#ffe08a']]) {
      ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath(); pts.slice(0, m).forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
    }
    ctx.restore();
  });
}
function lavaGeyserFx(x, delay, life = 0.7) {
  const gy = groundY();
  skFx(null, delay, life, (u) => {
    const up = Math.sin(Math.PI * Math.min(1, u / 0.7)), h = 54 * up;
    if (h < 1) return;
    ctx.save();
    ctx.fillStyle = '#a32a08'; ctx.fillRect(x - 6, gy - h, 12, h);
    ctx.fillStyle = '#ff6a1a'; ctx.fillRect(x - 4, gy - h, 8, h);
    ctx.fillStyle = '#ffe08a'; ctx.fillRect(x - 1, gy - h, 2, h * 0.8);
    ctx.fillStyle = '#ff6a1a'; ctx.beginPath(); ctx.arc(x, gy - h, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }, null, (u) => {
    if (u < 0.6 && Math.random() < 0.8) parts.push({ x: x + rand(-4, 4), y: gy - 54 * Math.sin(Math.PI * Math.min(1, u / 0.7)), vx: rand(-70, 70), vy: rand(-120, -40), g: 380, size: Math.random() < 0.4 ? 3 : 2, color: Math.random() < 0.5 ? '#ff6a1a' : '#ffe08a', life: 0.6, t: 0 });
  });
}

// 창 계열: 숙련 단계 이전부터 있던 기본 자세 (★ 단계의 모습)
function piercingBase(u) {
  if (u < 0.35) { const w = easeOut(segU(u, 0, 0.35)); return { wa: mix(-1.3, -0.05, w), ext: -6 * w, dx: -5 * w, sy: 1 - 0.1 * w, skew: -0.2 * w }; }
  if (u < 0.55) { const d = easeOut(segU(u, 0.35, 0.45)); return { wa: 0, ext: mix(-6, 18, d), dx: mix(-5, 14, d), skew: mix(-0.2, 0.3, d), sy: mix(0.9, 1, d) }; }
  const r = easeOut(segU(u, 0.55, 1));
  return { wa: mix(0, -1.3, r), ext: 18 * (1 - r), dx: 14 * (1 - r), skew: 0.3 * (1 - r) };
}
function dragonFallBase(u, D) {
  if (u < 0.15) { const c = segU(u, 0, 0.15); return { sy: 1 - 0.2 * c, sx: 1 + 0.1 * c, wa: -1.3 }; }
  if (u < 0.45) { const r = easeOut(segU(u, 0.15, 0.42)); return { lift: 170 * r, wa: -1.57, sy: 1.1 }; }
  if (u < 0.6) return { lift: 170, dx: D * segU(u, 0.45, 0.6), wa: 1.57 };
  if (u < 0.72) { const f = easeIn(segU(u, 0.6, 0.72)); return { lift: 170 * (1 - f), dx: D, wa: 1.57, sy: 1.15 }; }
  if (u < 0.85) return { dx: D, sy: mix(0.8, 1, segU(u, 0.72, 0.85)), wa: 1.2 };
  const b = segU(u, 0.85, 1);
  return { dx: D * (1 - b), lift: 30 * Math.sin(Math.PI * b), wa: -1.3 };
}
function dragonBreathBase(u) {
  if (u < 0.2) { const r = easeOut(segU(u, 0, 0.2)); return { skew: -0.3 * r, wa: mix(-1.3, -0.35, r), dx: -3 * r }; }
  if (u < 0.9) return { skew: 0.15, wa: 0.05 + Math.sin(clock * 40) * 0.03, dx: Math.sin(clock * 55), ext: 4 };
  const r = easeOut(segU(u, 0.9, 1));
  return { wa: mix(0.05, -1.3, r), skew: 0.15 * (1 - r) };
}
// 대회전: spins 바퀴 도는 동안 몸이 앞뒤로 돌아서고 할버드가 원을 그린다. lift: 바람에 떠오른 높이
function whirlPose(u, spins, lift = 0) {
  if (u < 0.12) { const w = segU(u, 0, 0.12); return { wa: mix(-1.35, -2.8, w), skew: -0.2 * w, sy: 1 - 0.08 * w, lift }; }
  if (u < 0.9) {
    const s = segU(u, 0.12, 0.9), e = s < 0.5 ? 2 * s * s : 1 - 2 * (1 - s) ** 2;
    const ang = -2.8 + e * Math.PI * 2 * spins, front = Math.cos(ang) >= 0;
    return { facing: front ? 1 : -1, wa: front ? ang : Math.PI - ang, sy: 0.94, lift: lift + 2 * Math.abs(Math.sin(ang)) };
  }
  const r = easeOut(segU(u, 0.9, 1));
  return { wa: mix(-2.8, -1.35, r), lift };
}
function earthSplitterBase(u) {
  if (u < 0.18) { const c = segU(u, 0, 0.18); return { sy: 1 - 0.18 * c, wa: mix(-1.35, -2.0, c) }; }
  if (u < 0.42) { const j = segU(u, 0.18, 0.42); return { lift: 46 * Math.sin((Math.PI / 2) * j), wa: mix(-2.0, -2.9, j), skew: -0.2 }; }
  if (u < 0.52) { const s = easeIn(segU(u, 0.42, 0.52)); return { lift: 46 * (1 - s), wa: mix(-2.9, 1.1, s), skew: mix(-0.2, 0.4, s) }; }
  if (u < 0.8) return { wa: 1.1, sy: 0.84, skew: 0.4 };
  const r = easeOut(segU(u, 0.8, 1));
  return { wa: mix(1.1, -1.35, r), sy: mix(0.84, 1, r), skew: 0.4 * (1 - r) };
}

// ── 진화 연출 도구 (활 계열 숙련 단계 전용) ──
// 활 공통 자세: 다음 타격 시점을 향해 시위를 당겼다가 놓는다 (타격 수가 단계마다 달라도 맞는다)
function bowPullPose(u, a, max = 9) {
  const hits = a.k ? a.k.hits : [[0.5]];
  let prev = 0;
  for (const h of hits) { if (u < h[0]) { const f = (u - prev) / Math.max(0.01, h[0] - prev); return { pull: max * Math.min(1, f * 1.6), dx: -1.5 * (1 - f) }; } prev = h[0]; }
  return { pull: 0, dx: 0 };
}
// Lv1 화살 한 줄: 가늘고 짧게 남는 화살 궤적
function plainShotFx(x0, y0, x1, y1, color, life = 0.1) {
  skFx(null, 0, life, (u) => {
    ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mix(x0, x1, u * 0.6), mix(y0, y1, u * 0.6)); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore();
  });
}
// ★★ 분열 화살: 화살이 반쯤 날아가다 초록 빛과 함께 세 갈래로 갈라져 대상 주변에 꽂힌다
function splitArrowFx(a, x0, y0, tx, ty, life = 0.2) {
  const mx = mix(x0, tx, 0.45), my = mix(y0, ty, 0.45), ends = [[tx, ty - 10], [tx + a.dir * 6, ty], [tx, ty + 9]];
  skFx(null, 0, life, (u) => {
    ctx.save(); ctx.lineCap = 'round';
    if (u < 0.45) {
      const k = u / 0.45, x = mix(x0, mx, k), y = mix(y0, my, k);
      ctx.strokeStyle = '#e8d9b0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - a.dir * 8, y); ctx.lineTo(x, y); ctx.stroke();
    } else {
      const k = (u - 0.45) / 0.55;
      if (k < 0.3) { ctx.fillStyle = `rgba(191,255,208,${1 - k / 0.3})`; ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill(); }
      for (const [ex, ey] of ends) {
        const x = mix(mx, ex, k), y = mix(my, ey, k);
        ctx.strokeStyle = '#bfffd0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - a.dir * 7, y - (ey - my) * 0.08); ctx.lineTo(x, y); ctx.stroke();
      }
    }
    ctx.restore();
  });
}
// ★★★ 바람매: 기사 위에서 초록빛 매가 맴돌다가(날갯짓) diveAt 초에 대상을 꿰뚫고 급강하해 지나간다
const HAWK = [
  ['....bb......', '..bbBBb.....', 'bBBBBBBbbe..', '..bbBBBBBBBy', '....bBBBb...', '.....bb.....'],
  ['bb..........', 'BBb.........', '.bBBbbbbe...', '..bBBBBBBBBy', '...bBBBb....', '..bBb.......'],
];
const HAWK_PAL = { b: '#2f5a2a', B: '#7fd06a', e: '#ffffff', y: '#ffe066' };
function spiritHawkFx(a, life, diveAt) {
  let px = 0, py = 0;
  aFx(a, 0, life, (u) => {
    const t = u * life, gy = groundY();
    if (t < diveAt) {
      const ang = t * 7, cx = a.x() + a.dir * 10;
      px = cx + Math.cos(ang) * 26; py = gy - 74 + Math.sin(ang) * 9;
    } else {
      const k = Math.min(1, (t - diveAt) / 0.25), sx = a.x() + a.dir * 10, tx = a.tx() + a.dir * 70;
      px = mix(sx, tx, easeIn(k)); py = mix(gy - 74, gy - 18, Math.sin(Math.PI * k * 0.9));
    }
    const out = t > life - 0.2 ? (life - t) / 0.2 : Math.min(1, t / 0.15);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = out * 0.5;
    ctx.fillStyle = '#7fd06a'; ctx.beginPath(); ctx.arc(px, py - 5, 15, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const flipFace = t < diveAt ? Math.sin(t * 7) < 0 : a.dir < 0;
    drawSprite(HAWK[Math.floor(t * 12) % 2], HAWK_PAL, px, py, 3, { flip: flipFace, alpha: out });
  }, null, (u) => {
    const t = u * life;
    if (Math.random() < (t >= diveAt ? 1 : 0.3)) parts.push({ x: px, y: py - 4, vx: rand(-20, 20), vy: rand(-10, 20), g: 30, size: 2, color: Math.random() < 0.5 ? '#bfffd0' : '#ffffff', life: 0.4, t: 0 });
    if (t >= diveAt && t < diveAt + 0.25) streakFx(px - a.dir * 18, py - 4, px, py - 4, '#bfffd0', 2, 0.15);
  });
}

// ★★ 관통 헤드샷: 탄이 지나간 길에 아지랑이 같은 열선이 한동안 일렁인다
function heatTrailFx(x0, y, x1, life = 0.8) {
  skFx(null, 0, life, (u) => {
    const fade = 1 - u, n = Math.ceil(Math.abs(x1 - x0) / 6), d = Math.sign(x1 - x0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const x = x0 + d * i * 6, wob = Math.sin(clock * 22 + i * 0.9) * 1.6 * fade;
      ctx.fillStyle = `rgba(255,${150 + 60 * Math.sin(i + clock * 9)},60,${0.55 * fade})`; ctx.fillRect(x, y + wob - 1, 6, 2);
      if (i % 3 === 0) { ctx.fillStyle = `rgba(255,255,220,${0.6 * fade})`; ctx.fillRect(x, y + wob, 3, 1); }
    }
    ctx.restore();
  });
}
// ★★★ 정적의 일발: 하단바가 청회색으로 가라앉고 대상에 커다란 조준경이 걸린다 (눈금·십자선이 천천히 좁혀진다)
function scopeFx(a, life, fireAt) {
  backFx(a, 0, life, (u) => {
    const t = u * life, k = Math.min(1, t / 0.3), out = t > life - 0.25 ? (life - t) / 0.25 : 1;
    dimBand(0.5 * k * out, '10,18,30');
    const x = a.tx(), y = a.ty() - 8, r = mix(60, 30, easeOut(Math.min(1, t / fireAt)));
    ctx.save();
    ctx.globalAlpha = k * out;
    ctx.strokeStyle = 'rgba(255,224,102,0.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,224,102,0.9)';
    ctx.fillRect(x - r - 14, y, r * 0.75, 1); ctx.fillRect(x + r * 0.4 + 6, y, r * 0.75, 1);
    ctx.fillRect(x, y - r - 14, 1, r * 0.75); ctx.fillRect(x, y + r * 0.4 + 6, 1, r * 0.75);
    for (let i = -3; i <= 3; i++) if (i) ctx.fillRect(x + i * r * 0.18, y - 2, 1, 4);
    if (t < fireAt && Math.sin(clock * 16) > 0) { ctx.fillStyle = '#ff3b3b'; ctx.fillRect(x - 1, y - 1, 3, 3); }
    ctx.restore();
  });
}
// 느리게 날아가는 탄: 탄 둘레에 공기가 갈라지는 고리가 연달아 남는다
function slowBulletFx(a, x0, y0, life) {
  skFx(null, 0, life, (u) => {
    const x1 = a.tx(), y1 = a.ty() - 8, x = mix(x0, x1, u), y = mix(y0, y1, u);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,240,180,0.7)'; ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) { const k = Math.max(0, u - i * 0.12), rx = mix(x0, x1, k); ctx.globalAlpha = 0.8 - i * 0.18; ctx.beginPath(); ctx.ellipse(rx, mix(y0, y1, k), 2 + i, 5 + i * 3, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffe066'; ctx.fillRect(x - 4, y - 1, 6, 3);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - a.dir * 1, y - 1, 2, 2);
    ctx.restore();
  });
}
// 맞은 자리가 유리처럼 깨진다: 대상 앞에 방사형 금이 퍼지고 조각이 흩어진다
function glassBreakFx(x, y, life = 0.6) {
  const rays = [];
  for (let i = 0; i < 9; i++) { const an = i / 9 * Math.PI * 2 + rand(-0.2, 0.2); rays.push([an, rand(14, 30)]); }
  skFx(null, 0, life, (u) => {
    const k = Math.min(1, u / 0.12);
    ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    for (const [an, L] of rays) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(an) * L * k, y + Math.sin(an) * L * k); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(x, y, 9 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  });
  for (let i = 0; i < 18; i++) parts.push({ x, y, vx: rand(-170, 170), vy: rand(-170, 80), g: 280, size: 2, color: i % 2 ? '#dff4ff' : '#ffffff', life: 0.5, t: 0 });
}

// ── 철갑 관통탄 ──
// ★★ 폭렬: 맞은 자리에서 주황 불덩이가 부풀었다 꺼지고, 쇳조각이 사방으로 선을 그으며 튄다. 연기가 남는다
function shellBlastFx(x, y, life = 0.6) {
  const shards = [];
  for (let i = 0; i < 10; i++) shards.push([rand(0, Math.PI * 2), rand(26, 48)]);
  skFx(null, 0, life, (u) => {
    const k = easeOut(Math.min(1, u / 0.25)), fade = 1 - u;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.max(0, 1 - u / 0.5);
    ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.arc(x, y, 6 + 16 * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(x, y, 3 + 8 * k, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = fade; ctx.strokeStyle = '#c9c2b4'; ctx.lineWidth = 1;
    for (const [an, L] of shards) { const r0 = L * k * 0.5, r1 = L * k; ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0); ctx.lineTo(x + Math.cos(an) * r1, y + Math.sin(an) * r1); ctx.stroke(); }
    ctx.globalAlpha = fade * 0.5; ctx.fillStyle = '#4a4a52';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + (i - 1.5) * 8, y - 6 - 18 * u - i * 2, 5 + 6 * u, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  });
}
// ★★★ 공성 노포: 기사 옆에 나무 틀과 쇠 활대의 거대한 노포가 세워지고, 쏠 때마다 활대가 휘었다 튕긴다
function ballistaFx(a, life, shotTimes) {
  aFx(a, 0, life, (u) => {
    const t = u * life, d = a.dir, x = a.x() + d * 22, gy = groundY();
    const build = easeOut(Math.min(1, t / 0.3)), out = t > life - 0.25 ? (life - t) / 0.25 : 1;
    let flex = 0;
    for (const s of shotTimes) { if (t > s - 0.25 && t < s) flex = (t - (s - 0.25)) / 0.25; else if (t >= s && t < s + 0.08) flex = -1 + (t - s) / 0.08; }
    ctx.save();
    ctx.globalAlpha = out;
    ctx.translate(x, gy - 4 * build); ctx.scale(d * 1.6, 1.6);          // 기사보다 큰 공성 병기
    const h = 26 * build;
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(-14, -4, 4, 4); ctx.fillRect(10, -4, 4, 4);            // 다리
    ctx.fillStyle = '#7a5530'; ctx.fillRect(-16, -h * 0.55, 32, 5);                                 // 몸통 틀
    ctx.fillStyle = '#4a3220'; ctx.fillRect(-16, -h * 0.55 + 4, 32, 2);
    ctx.fillStyle = '#9a9aa6'; ctx.fillRect(4, -h * 0.55 - 2, 4, 9);                               // 쇠 장식
    // 활대: 앞쪽에서 위아래로 휘어진다 (당길수록 뒤로 굽는다)
    const bend = 6 * flex;
    ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(12, -h * 0.55 - 16); ctx.quadraticCurveTo(14 - bend, -h * 0.55, 12, -h * 0.55 + 18); ctx.stroke();
    ctx.strokeStyle = '#e8d9b0'; ctx.lineWidth = 1;
    const sx = 12 - 22 * Math.max(0, flex);
    ctx.beginPath(); ctx.moveTo(12, -h * 0.55 - 16); ctx.lineTo(sx, -h * 0.55 + 1); ctx.lineTo(12, -h * 0.55 + 18); ctx.stroke();   // 시위
    if (flex > 0) { ctx.fillStyle = '#8a5a2b'; ctx.fillRect(sx, -h * 0.55, 30, 3); ctx.fillStyle = '#c9c2b4'; ctx.fillRect(sx + 30, -h * 0.55 - 2, 6, 7); }   // 장전된 살
    ctx.restore();
  });
}
// 쇠뇌 살: 굵은 나무 살과 쇠촉이 하단바 끝까지 날아가 화면 가장자리에 꽂힌 채 흔들린다
function ballistaBoltFx(a, y, life = 1.0) {
  const d = a.dir, x0 = a.x() + d * 60, end = d > 0 ? W - 6 : 6;
  skFx(null, 0, life, (u) => {
    const t = u * life, fly = Math.min(1, t / 0.12), x = mix(x0, end, fly);
    const wob = fly >= 1 ? Math.sin(t * 70) * 1.5 * Math.max(0, 1 - (t - 0.12) / 0.4) : 0;
    const out = u > 0.75 ? (1 - u) / 0.25 : 1;
    ctx.save();
    ctx.globalAlpha = out;
    if (fly < 1) { ctx.fillStyle = 'rgba(232,217,176,0.4)'; ctx.fillRect(Math.min(x0, x), y - 1, Math.abs(x - x0), 2); }
    ctx.translate(x, y + wob); ctx.scale(d, 1);
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-36, -1.5, 34, 3);
    ctx.fillStyle = '#c9c2b4'; ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(6, 0); ctx.lineTo(-2, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8d9b0'; ctx.fillRect(-36, -4, 5, 2); ctx.fillRect(-36, 2, 5, 2);           // 깃
    ctx.restore();
  });
}

// ── 유도 마탄 ──
// Lv1 마력탄: 활끝에서 대상까지 곧게 날아가는 작은 마력 구슬
function plainBoltFx(a, x0, y0, life = 0.18) {
  skFx(null, 0, life, (u) => { const x = mix(x0, a.tx(), u), y = mix(y0, a.ty(), u); dot(x, y, 3, '#9fefff', 0.9); dot(x, y, 1.5, '#ffffff'); });
}
// ★★ 마탄 군무: 기사 둘레를 마력탄 n 개가 원을 그리며 돌다가, launch[i] 초에 하나씩 대상을 향해 휘어 날아간다
function orbitBoltsFx(a, n, life, launch) {
  aFx(a, 0, life, (u) => {
    const t = u * life, cx = a.x(), cy = groundY() - 28;
    for (let i = 0; i < n; i++) {
      const ang = t * 5 + i / n * Math.PI * 2, r = 22 + 4 * Math.sin(t * 6 + i);
      const ox = cx + Math.cos(ang) * r, oy = cy + Math.sin(ang) * r * 0.55;
      if (t < launch[i]) { ctx.save(); ctx.shadowColor = '#6ff3ff'; ctx.shadowBlur = 6; dot(ox, oy, 4, '#6ff3ff', 0.7); dot(ox, oy, 2, '#ffffff'); ctx.restore(); continue; }
      const k = Math.min(1, (t - launch[i]) / 0.16);
      if (k >= 1) continue;
      const tx = a.tx(), ty = a.ty(), mx = (ox + tx) / 2, my = Math.min(oy, ty) - 30;
      const x = (1 - k) ** 2 * ox + 2 * (1 - k) * k * mx + k * k * tx, y = (1 - k) ** 2 * oy + 2 * (1 - k) * k * my + k * k * ty;
      dot(x, y, 4, '#6ff3ff', 0.8); dot(x, y, 2, '#ffffff');
    }
  });
}
// ★★★ 마력 붕괴: 대상 위에 검푸른 특이점이 열려 둘레의 빛을 빨아들이며 커지다가, burstAt 초에 터져 고리가 퍼진다
function singularityFx(a, life, burstAt) {
  const x = a.tx(), y = a.ty() - 44;
  backFx(a, 0, life, (u) => {
    const t = u * life;
    if (t > burstAt + 0.4) return;
    const grow = Math.min(1, t / burstAt), r = 4 + 14 * grow;
    if (t < burstAt) {
      ctx.save();
      // 빨려 드는 원반: 돌면서 납작한 빛 고리
      ctx.strokeStyle = '#6ff3ff'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.8;
      for (let i = 0; i < 3; i++) { const ph = -t * (8 + i * 3); ctx.beginPath(); ctx.ellipse(x, y, r * (1.8 + i * 0.5), r * (0.45 + i * 0.12), 0.2, ph, ph + 4); ctx.stroke(); }
      ctx.fillStyle = '#05121a'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    } else {
      const k = (t - burstAt) / 0.4;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = '#6ff3ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 18 + 90 * k, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 10 + 60 * k, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }, null, (u) => {
    const t = u * life;
    if (t < burstAt) for (let i = 0; i < 2; i++) { const an = rand(0, Math.PI * 2), dd = rand(40, 70), px = x + Math.cos(an) * dd, py = y + Math.sin(an) * dd * 0.6; parts.push({ x: px, y: py, vx: (x - px) * 3, vy: (y - py) * 3, g: 0, size: 2, color: Math.random() < 0.5 ? '#6ff3ff' : '#ffffff', life: 0.32, t: 0, add: true }); }
  });
}

// ── 별빛 화살비 ──
// Lv1 별똥 화살: 하늘에서 작은 화살 하나가 반짝이며 떨어진다
function fallingArrowFx(x, life = 0.18) {
  const gy = groundY(), x0 = x - 16;
  skFx(null, 0, life, (u) => {
    const px = mix(x0, x, u), py = mix(-10, gy - 6, u);
    ctx.save(); ctx.strokeStyle = '#cfefff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px - 6, py - 12); ctx.lineTo(px, py); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(px - 1, py - 1, 2, 2); ctx.restore();
  });
}
// ★★ 별자리: 대상 위 하늘에 별이 하나씩 켜지고 선으로 이어진다. 별마다 화살이 떨어질 자리
function constellationFx(a, life, n) {
  const cx = a.tx(), stars = [];
  for (let i = 0; i < n; i++) stars.push({ x: cx + (i - (n - 1) / 2) * 14 + rand(-6, 6), y: 18 + rand(0, 26), at: i * 0.06 });
  a.stars = stars;
  aFx(a, 0, life, (u) => {
    const t = u * life, out = u > 0.85 ? (1 - u) / 0.15 : 1;
    ctx.save();
    ctx.globalAlpha = out * 0.6; ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 1;
    ctx.beginPath(); let first = true;
    for (const s of stars) { if (t < s.at) break; first ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y); first = false; }
    ctx.stroke();
    ctx.globalAlpha = out;
    for (const s of stars) {
      if (t < s.at) continue;
      const tw = 0.7 + 0.3 * Math.sin(clock * 10 + s.x);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(s.x - 1, s.y - 1, 2, 2);
      ctx.fillStyle = `rgba(159,216,255,${tw})`; ctx.fillRect(s.x - 4, s.y, 8, 1); ctx.fillRect(s.x, s.y - 4, 1, 8);
    }
    ctx.restore();
  });
}
// ★★★ 별이 지는 밤: 하단바가 남색 밤하늘로 물들고 별이 반짝이며 오로라가 흐른다. 마지막에 거대한 별이 떨어진다
function nightSkyFx(a, life, starAt) {
  const tw = [];
  for (let i = 0; i < 40; i++) tw.push([rand(0, 1), rand(0, 0.65), rand(0, 6)]);
  backFx(a, 0, life, (u) => {
    const t = u * life, k = Math.min(1, t / 0.4), out = t > life - 0.35 ? (life - t) / 0.35 : 1, al = k * out;
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, groundY());
    g.addColorStop(0, `rgba(8,12,40,${0.75 * al})`); g.addColorStop(1, `rgba(20,30,80,${0.35 * al})`);
    ctx.fillStyle = g; ctx.fillRect(-60, -240, W + 120, groundY() + 240);
    for (const [fx, fy, ph] of tw) { ctx.globalAlpha = al * (0.4 + 0.6 * Math.abs(Math.sin(clock * 3 + ph))); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(fx * W), Math.round(fy * groundY()), 1, 1); }
    // 오로라: 위쪽을 흐르는 초록·청록 물결 띠
    ctx.globalCompositeOperation = 'lighter';
    for (const [col, off] of [['rgba(80,255,180,0.18)', 0], ['rgba(111,243,255,0.14)', 2]]) {
      ctx.globalAlpha = al; ctx.fillStyle = col;
      for (let x = 0; x < W; x += 4) { const y = 22 + Math.sin(x * 0.02 + clock * 1.5 + off) * 8, h = 14 + 8 * Math.sin(x * 0.05 + clock * 2 + off); ctx.fillRect(x, y, 4, h); }
    }
    ctx.restore();
  });
  // 거대한 별: 하늘 위에서 빛을 모으며 커지다가 starAt 초에 대상에게 떨어진다
  aFx(a, 0, starAt + 0.05, (u) => {
    const t = u * (starAt + 0.05), x1 = a.tx(), gy = groundY();
    const grow = Math.min(1, t / (starAt - 0.25)), fall = t > starAt - 0.2 ? (t - (starAt - 0.2)) / 0.2 : 0;
    const x = mix(x1 - a.dir * 50, x1, fall), y = mix(28, gy - 10, easeIn(Math.min(1, fall))), R = 6 + 8 * grow;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(clock * 2);
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? R * 0.45 : R, an = i * Math.PI / 5 - Math.PI / 2; i ? ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r) : ctx.moveTo(Math.cos(an) * r, Math.sin(an) * r); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, R * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (fall > 0) streakFx(x - a.dir * 20, y - 30, x, y, '#ffe066', 3, 0.15);
  });
}
// 거대한 별이 부서진다: 다섯 갈래 빛줄기와 별 조각
function starShatterFx(x, life = 0.7) {
  const gy = groundY() - 10;
  skFx(null, 0, life, (u) => {
    const k = easeOut(Math.min(1, u / 0.2)), fade = 1 - u;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade; ctx.fillStyle = '#ffe066';
    for (let i = 0; i < 5; i++) { const an = i * Math.PI * 2 / 5 - Math.PI / 2; ctx.save(); ctx.translate(x, gy); ctx.rotate(an); ctx.fillRect(0, -1.5, 70 * k, 3); ctx.restore(); }
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, gy, 12 * (1 - u), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
  for (let i = 0; i < 30; i++) parts.push({ x, y: gy, vx: rand(-200, 200), vy: rand(-220, -40), g: 260, size: Math.random() < 0.4 ? 3 : 2, color: i % 3 ? '#ffe066' : '#ffffff', life: rand(0.5, 0.9), t: 0 });
}

// 활 계열: 숙련 단계 이전부터 있던 기본 자세 (★ 단계의 모습)
function headshotBase(u) {
  if (u < 0.15) { const k = segU(u, 0, 0.15); return { sy: 1 - 0.16 * k, dx: -2 * k, pull: 0 }; }
  if (u < 0.7) return { sy: 0.84, dx: -2, pull: 11 * easeOut(segU(u, 0.15, 0.6)) };
  if (u < 0.85) return { sy: 0.84, dx: -2 - 5 * easeOut(segU(u, 0.7, 0.76)), pull: 0 };
  const r = segU(u, 0.85, 1);
  return { sy: mix(0.84, 1, r), dx: -7 * (1 - r), pull: 0 };
}
function armorPiercerBase(u) {
  if (u < 0.5) { const d = easeOut(segU(u, 0, 0.5)); return { pull: 13 * d, skew: -0.15 * d, sy: 1 - 0.05 * d }; }
  if (u < 0.58) { const r = easeOut(segU(u, 0.5, 0.58)); return { pull: 0, dx: -12 * r, skew: -0.3 }; }
  const r = segU(u, 0.7, 1);
  return { pull: 0, dx: -12 * (1 - r), skew: -0.3 * (1 - r) };
}

const SKILL_FX = {
  // ── 검사: 강철 베기 ──
  //  Lv1 「강철 베기」 제자리에서 수수하게 내려벤다
  //  ★ 「강철 검풍」 검날을 따라 푸른 빛이 차오르고, 베면 초승달 검풍이 앞으로 날아간다
  //  ★★ 「강철 대검」 손의 검이 몸만 한 대검이 되어 내려찍고, 땅에서 바위 송곳이 차례로 솟는다
  //  ★★★ 「천강검」 한 번 벤 뒤 검을 하늘로 치켜들면 빛줄기가 하늘로 뻗고, 거대한 강철 검이 떨어져 꽂힌다
  steelCleave: {
    pose(u, a) {
      const t = u * (a.k ? a.k.dur : 0.7), m = a.mast || 0;
      if (m >= 3 && t >= 0.42) {
        if (t < 0.72) { const r = easeOut(segU(t, 0.42, 0.72)); return { wa: mix(1.1, -1.57, r), skew: mix(0.3, -0.12, r), sy: mix(0.95, 1.1, r), dx: mix(12, 6, r), lift: 6 * r }; }
        if (t < 0.95) return { wa: -1.57 + 0.04 * Math.sin(clock * 40), skew: -0.12, sy: 1.1, dx: 6, lift: 6 };
        if (t < 1.0) { const d = easeIn(segU(t, 0.95, 1.0)); return { wa: mix(-1.57, 0.9, d), skew: mix(-0.12, 0.35, d), sy: mix(1.1, 0.88, d), dx: mix(6, 9, d), lift: 6 * (1 - d) }; }
        const r = easeOut(segU(t, 1.0, 1.25));
        return { wa: mix(0.9, -1.0, r), skew: 0.35 * (1 - r), dx: 9 * (1 - r), sy: mix(0.88, 1, r) };
      }
      const p = steelCleaveBase(Math.min(1, t / 0.7));
      if (m === 0) { p.lift = (p.lift || 0) * 0.25; p.dx = (p.dx || 0) * 0.35; }   // 뛰어들지 않고 제자리에서
      return p;
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast;
      const list = [[0.21 / d, (a) => { for (let i = 0; i < (m ? 6 : 3); i++) parts.push({ x: a.x() - a.dir * 4, y: groundY() - 2, vx: -a.dir * rand(30, 90), vy: rand(-50, -10), g: 200, size: 3, color: i % 2 ? '#c9b38a' : '#a8946a', life: 0.35, t: 0 }); }]];
      if (m === 1 || m >= 3) list.push([0.01, (a) => steelGlowFx(a, 0.34)]);
      if (m === 2) list.push([0.01, (a) => greatswordFx(a, d * 0.95)]);
      if (m >= 3) {
        list.push([0.6 / d, (a) => {
          // 치켜든 칼끝에서 하늘로 가는 빛줄기, 그리고 대상 위로 천강검
          aFx(a, 0, 0.4, (u) => { const g = gripOf(a), tx = g.x + Math.cos(g.ang) * 11 * PX, ty = g.y + Math.sin(g.ang) * 11 * PX; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.sin(Math.PI * u); ctx.fillStyle = '#cfe0ff'; ctx.fillRect(tx - 1, -20, 2, ty + 20); ctx.fillStyle = '#ffffff'; ctx.fillRect(tx, -20, 1, ty + 20); ctx.restore(); });
          a.skyX = a.tx();
          skySwordFx(a.skyX, 0.4, 1.5);
        }]);
      }
      return list;
    },
    hit(a, i) {
      const m = a.mast, g = gripOf(a);
      if (m === 0) { crescentFx(g.x, g.y, 22, -2.6, 1.0, a.dir, '#dfe6f0', 2, 0.2); return; }
      if (m === 1) {
        if (i === 0) { crescentFx(g.x, g.y, 30, -2.6, 1.0, a.dir, '#bcd6ff', 3, 0.28); ringFx(a.px(), 'rgba(160,200,255,0.9)', 0.6, 0.35); impact({ stop: 0.05, shake: 0.12 }); }
        else { waveFx(a, g.x, g.y + 4, 120, '#8fb4ff', 0.36); impact({ shake: 0.08 }); }
        return;
      }
      if (m === 2) {
        if (i === 0) {
          // 대검이 땅을 찍는다: 양옆으로 무거운 흙 파도
          for (const s of [-1, 1]) for (let j = 0; j < 10; j++) parts.push({ x: a.px() + a.dir * 14, y: groundY() - 2, vx: s * rand(60, 160), vy: rand(-120, -30), g: 420, size: 3, color: j % 2 ? '#8a7a68' : '#c9b38a', life: 0.55, t: 0 });
          impact({ stop: 0.12, shake: 0.35 });
        } else {
          rockSpikesFx(a, a.px() + a.dir * 18, 5, 15, 1.1);
          impact({ shake: 0.18 });
        }
        return;
      }
      if (i === 0) { crescentFx(g.x, g.y, 28, -2.6, 1.0, a.dir, '#cfe0ff', 3, 0.24); impact({ stop: 0.04, shake: 0.1 }); return; }
      const x = a.skyX != null ? a.skyX : a.tx();
      craterFx(x);
      for (let j = 0; j < 24; j++) parts.push({ x: x + rand(-6, 6), y: groundY() - 4, vx: rand(-180, 180), vy: rand(-260, -80), g: 520, size: Math.random() < 0.3 ? 4 : 3, color: j % 3 ? '#8a7a68' : '#dfe7f3', life: rand(0.5, 0.9), t: 0 });
      impact({ stop: 0.18, shake: 0.55 });
    },
    marks(a, t, pow, i) {
      const m = a.mast;
      if (m === 0) { crescentMarkFx(t.x - a.dir * 4, t.y, 18, -2.0, 1.1, 4, '#dfe6f0', 0.4, 0, a.dir); return; }
      if (m === 1 && i === 1) return;
      if (m === 2) { if (i === 0) for (const dy of [-5, 4]) crescentMarkFx(t.x - a.dir * 4, t.y + dy, 28, -2.1, 1.3, 11, '#9aa6b8', 0.6, 0, a.dir); return; }
      if (m >= 3 && i === 1) return;
      crescentMarkFx(t.x - a.dir * 6, t.y - 2, 26, -2.1, 1.25, 9, a.color, 0.6, 0, a.dir);
    },
    kb: 14,
  },

  // ── 창기사: 관통 찌르기 ──
  //  Lv1 「찌르기」 제자리에서 짧게 / ★ 「관통 찌르기」 웅크렸다 돌진하며 일직선 꿰뚫기
  //  ★★ 「투창」 찌른 창의 빛이 떨어져 나가 멀리 날아가 비스듬히 꽂히고 부르르 떤다
  //  ★★★ 「천공창」 오래 웅크린 등 뒤에 거대한 빛의 창이 맺히고 — 나선으로 돌며 하단바 끝까지 뚫는다 (지나간 땅이 패인다)
  piercingThrust: {
    pose(u, a) {
      const m = a.mast || 0, t = u * (a.k ? a.k.dur : 0.65);
      if (a.k && m === 0) {
        if (t < 0.2) { const w = easeOut(t / 0.2); return { wa: mix(-1.3, -0.05, w), ext: -3 * w, sy: 1 - 0.05 * w }; }
        if (t < 0.3) { const d = easeOut(segU(t, 0.2, 0.3)); return { wa: 0, ext: mix(-3, 12, d), dx: 4 * d, skew: 0.15 * d }; }
        if (t < 0.36) return { wa: 0, ext: 12, dx: 4, skew: 0.15 };
        const r = easeOut(segU(t, 0.36, 0.55));
        return { wa: mix(0, -1.3, r), ext: 12 * (1 - r), dx: 4 * (1 - r), skew: 0.15 * (1 - r) };
      }
      if (m >= 3) {
        if (t < 0.55) { const w = easeOut(Math.min(1, t / 0.3)); return { wa: mix(-1.3, -0.05, w), ext: -9 * w, dx: -7 * w + Math.sin(clock * 50) * w, sy: 1 - 0.14 * w, skew: -0.3 * w }; }
        if (t < 0.62) { const d = easeOut(segU(t, 0.55, 0.62)); return { wa: 0, ext: mix(-9, 22, d), dx: mix(-7, 16, d), skew: mix(-0.3, 0.35, d), sy: mix(0.86, 1, d) }; }
        if (t < 0.98) return { wa: Math.sin(clock * 60) * 0.02, ext: 22, dx: 16, skew: 0.35 };
        const r = easeOut(segU(t, 0.98, 1.2));
        return { wa: mix(0, -1.3, r), ext: 22 * (1 - r), dx: 16 * (1 - r), skew: 0.35 * (1 - r) };
      }
      return piercingBase(Math.min(1, t / 0.65));
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast;
      if (m === 0) return [];
      if (m >= 3) return [
        [0.01, (a) => spearChargeFx(a, 0.56)],
        [0.55 / d, (a) => {
          const h = hand(a);
          for (let i = 0; i < 12; i++) parts.push({ x: a.x() - a.dir * 6, y: groundY() - 2, vx: -a.dir * rand(60, 160), vy: rand(-70, -10), g: 220, size: 3, color: i % 2 ? '#c9b38a' : '#6fa37a', life: 0.45, t: 0 });
          drillSpearFx(a, h.x + a.dir * 24, h.y, 0.95);
          impact({ shake: 0.2 });
        }],
      ];
      const list = [[0.234 / d, (a) => {
        const x = a.x();
        for (let i = 0; i < 6; i++) parts.push({ x: x - a.dir * 4, y: groundY() - 2, vx: -a.dir * rand(40, 110), vy: rand(-50, -10), g: 200, size: 3, color: i % 2 ? '#c9b38a' : '#a8946a', life: rand(0.25, 0.4), t: 0 });
        ghostFx(a, x - a.dir * 5, a.dir, a.color, 0.25, { sy: 0.9 });
      }]];
      if (m === 2) list.push([0.46 / d, (a) => { const h = hand(a); thrownSpearFx(a, h.x + a.dir * 20, h.y, Math.max(90, Math.abs(a.tx() - h.x) + 60), 1.3); }]);
      return list;
    },
    hit(a, i, n) {
      const m = a.mast, h = hand(a);
      if (m === 0) { jabLineFx(h.x + a.dir * 4, h.y, a.dir); impact({ shake: 0.05 }); return; }
      if (m >= 3) {
        if (i === 0) { starFx(h.x + a.dir * 30, h.y, 10, '#eafff0', 0.2); return; }
        for (const t of a.targets(i)) burst(t.x, t.y, i === n - 1 ? 22 : 8, ['#ffffff', '#bfffd0', '#6fa37a'], i === n - 1 ? 180 : 110);
        impact({ stop: i === n - 1 ? 0.12 : 0.02, shake: i === n - 1 ? 0.35 : 0.08 });
        return;
      }
      if (m === 2 && i === 1) { for (const t of a.targets(i)) burst(t.x, t.y, 14, ['#ffffff', '#bfffd0'], 140); impact({ stop: 0.05, shake: 0.15 }); return; }
      const tips = a.targets(i);
      const far = Math.max(...tips.map((t) => (t.x - h.x) * a.dir)) + 34;
      streakFx(h.x, h.y, h.x + a.dir * far, h.y, a.color, 6, 0.28);
      starFx(h.x + a.dir * 50, h.y, 8, '#ffffff', 0.2);
      for (const t of tips) burst(t.x, t.y, 10, ['#ffffff', a.color], 130);
      impact({ stop: 0.04, shake: 0.1 });
    },
    marks(a, t, pow, i) {
      const m = a.mast;
      if (m === 0 || (m === 2 && i === 1)) return;
      if (m >= 3) {
        if (i === 0) return;
        // 천공창이 지나간 자리: 대상 둘레에 잠깐 남는 소용돌이 고리 두 겹
        skFx(null, 0, 0.35, (u) => { ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = '#bfffd0'; ctx.lineWidth = 1.5; for (const s of [1, 0.6]) { ctx.beginPath(); ctx.ellipse(t.x, t.y, 4 * s + 6 * u, 14 * s, 0, 0, Math.PI * 2); ctx.stroke(); } ctx.restore(); });
        return;
      }
      pierceSpiralFx(t.x - a.dir * 10, t.y, a.dir, 46 + 8 * pow, a.color);
    },
    kb: 12,
  },

  // ── 레인저: 연사 ──
  //  Lv1 「두 발 쏘기」 가는 화살 두 발 / ★ 「연사」 네 발을 숨 돌릴 틈 없이
  //  ★★ 「분열 화살」 날아가던 화살이 초록 빛과 함께 세 갈래로 갈라져 주변까지 꽂힌다
  //  ★★★ 「바람매 연사」 빛나는 바람매가 기사 위를 맴돌다 — 마지막에 적을 꿰뚫고 급강하한다
  rapidFire: {
    pose(u, a) { return bowPullPose(u, a); },
    cues: (a) => (a.mast >= 3 ? [[0.01, (a) => spiritHawkFx(a, a.k.dur - 0.02, a.k.hits[a.k.hits.length - 1][0] * a.k.dur - 0.15)]] : []),
    hit(a, i, n) {
      const m = a.mast, h = hand(a);
      if (m === 0) { for (const t of a.targets(i)) { plainShotFx(h.x + a.dir * 8, h.y, t.x, t.y, '#e8d9b0'); burst(t.x, t.y, 3, ['#ffffff', '#e8d9b0'], 70); } impact({ shake: 0.03 }); return; }
      if (m === 2) {
        const t0 = a.targets(i)[0] || { x: a.tx(), y: a.ty() };
        splitArrowFx(a, h.x + a.dir * 8, h.y, t0.x, t0.y);
        for (const t of a.targets(i)) burst(t.x, t.y, 5, ['#ffffff', '#bfffd0'], 90);
        impact({ shake: 0.05 });
        return;
      }
      if (m >= 3 && i === n - 1) {
        for (const t of a.targets(i)) burst(t.x, t.y, 26, ['#bfffd0', '#ffffff', '#7fd06a'], 190);
        for (let j = 0; j < 12; j++) parts.push({ x: a.tx(), y: a.ty(), vx: rand(-80, 80), vy: rand(-90, 10), g: 40, size: 2, color: j % 2 ? '#7fd06a' : '#ffffff', life: 0.8, t: 0 });
        impact({ stop: 0.12, shake: 0.35 });
        return;
      }
      for (const t of a.targets(i)) {
        streakFx(h.x + a.dir * 8, h.y, t.x, t.y, '#bfffd0', 3, 0.12);
        burst(t.x, t.y, 6, ['#ffffff', '#e8d9b0', a.color], 90);
      }
      burst(h.x + a.dir * 4, h.y, 4, ['#e9ffe9', a.color], 50, 2, 0);
      impact({ shake: i === n - 1 ? 0.1 : 0.04 });
    },
    marks(a, t, pow, i, n) { if (a.mast && !(a.mast >= 3 && i === n - 1)) arrowStuckFx(t.x, t.y + rand(-9, 5), a.dir, a.color); },
    kb: 6,
  },

  // ── 성기사: 심판의 일격 ──
  //  Lv1 「심판의 빛」 가느다란 빛줄기가 지그재그로 깜박이며 내리친다
  //  ★ 「심판의 일격」 빛기둥이 내리꽂히고, 맞은 적 머리 위에 금빛 낙인이 한동안 돈다
  //  ★★ 「심판의 성검」 대상 위 하늘에 성검 세 자루가 떠올라 하나씩 박힌다
  //  ★★★ 「대천사 강림」 기사 뒤로 날개를 편 거대한 빛의 기사가 나타나 같은 자세로 함께 내리친다 — 하늘이 열린 듯한 빛
  judgment: {
    pose(u, a) {
      const m = a.mast || 0, t = u * (a.k ? a.k.dur : 1);
      if (m >= 3) {
        if (t < 0.78) return judgmentBase(t);
        if (t < 1.2) { const r = easeOut(segU(t, 0.78, 1.2)); return { wa: mix(0.85, -1.75, r), sy: 1 + 0.1 * r, skew: mix(0.28, -0.15, r), dx: 7 * (1 - r), lift: 16 * r + Math.sin(clock * 8) * r }; }
        if (t < 1.31) { const d = easeIn(segU(t, 1.2, 1.31)); return { wa: mix(-1.75, 0.95, d), skew: mix(-0.15, 0.45, d), dx: 9 * d, lift: 16 * (1 - d), sy: mix(1.1, 0.82, d), sx: mix(1, 1.14, d) }; }
        if (t < 1.4) return { wa: 0.95, skew: 0.42, dx: 9, sy: 0.84, sx: 1.1 };
        const r = easeOut(segU(t, 1.4, 1.6));
        return { wa: mix(0.95, -1.0, r), skew: 0.42 * (1 - r), dx: 9 * (1 - r) };
      }
      const p = judgmentBase(Math.min(1, u));
      if (m === 0) p.lift = (p.lift || 0) * 0.3;
      return p;
    },
    tick(a, u) {
      const t = u * a.k.dur;
      if (!a.mast || !((t > 0.05 && t < 0.45) || (a.mast >= 3 && t > 0.8 && t < 1.2)) || Math.random() > 0.6) return;
      const h = hand(a);
      parts.push({ x: h.x + rand(-10, 10), y: h.y - rand(0, 20), vx: rand(-10, 10), vy: rand(-80, -40), g: -20, size: 2, color: Math.random() < 0.5 ? '#ffd257' : '#ffffff', life: 0.5, t: 0 });
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast;
      if (m === 0) return [[0.45, (a) => { const h = hand(a); parts.push({ x: h.x, y: h.y - 20, vx: 0, vy: -20, g: 0, size: 2, color: '#fff3b0', life: 0.3, t: 0 }); }]];
      const list = [[0.2 / d, (a) => { const h = hand(a); starFx(h.x, h.y - 26, 10, '#fff3b0', 0.4); }]];
      if (m === 1 || m >= 3) list.push([0.3 / d, (a) => {
        for (const t of a.targets()) {
          aFx(a, 0, 0.3, (u) => { ctx.save(); ctx.globalAlpha = 0.5 + u * 0.5; ctx.fillStyle = '#ffd257'; ctx.fillRect(Math.round(t.x) - 1, 0, 2, groundY()); ctx.restore(); });
          ringFx(t.x, '#ffd257', 0.5, 0.3);
        }
      }]);
      if (m === 2) list.push([0.3 / d, (a) => {
        // 성검 셋: 떨어질 시각은 타격 시점과 같다
        a.swordX = a.tx();
        [-14, 0, 14].forEach((off, j) => holySwordFx(a.swordX + off * a.dir, a.k.hits[j][0] * d - 0.3, 1.4));
      }]);
      if (m >= 3) list.push([0.01, (a) => archangelFx(a, d - 0.05, a.k.hits[1][0] * d)]);
      return list;
    },
    hit(a, i) {
      const m = a.mast;
      if (m === 0) { for (const t of a.targets(i)) lightRayFx(t.x); impact({ shake: 0.08 }); return; }
      if (m === 2) {
        const off = [-14, 0, 14][i] * a.dir, x = (a.swordX != null ? a.swordX : a.tx()) + off;
        swordImpactFx(x);
        burst(x, groundY() - 6, i === 2 ? 22 : 10, ['#ffd257', '#ffffff'], i === 2 ? 160 : 100);
        impact({ stop: i === 2 ? 0.1 : 0.03, shake: i === 2 ? 0.3 : 0.12 });
        return;
      }
      if (m >= 3 && i === 1) {
        for (const t of a.targets(i)) heavenStrikeFx(t.x);
        impact({ stop: 0.18, shake: 0.5 });
        return;
      }
      for (const t of a.targets(i)) {
        pillarFx(t.x, '#ffd257', 44, 0.6);
        ringFx(t.x, '#ffd257', 1.2, 0.6);
        burst(t.x, groundY() - 10, 26, ['#ffd257', '#ffffff', '#fff3b0'], 170, 3, 250);
        if (m === 1) brandFx(t.x, (t.top != null ? t.top : t.y - 20) - 10);
      }
      impact({ stop: 0.1, shake: 0.3 });
    },
    marks(a, t, pow, i) {
      if (a.mast === 0) return;
      if (a.mast === 2) { if (i === 2) holyCrossFx(t.x, t.y - 4, 18, 0.7); return; }
      holyCrossFx(t.x, t.y - 4, a.mast >= 3 && i === 1 ? 28 : 18, 0.75);
    },
    kb: 16,
  },

  // ── 성기사: 성역 ──
  //  Lv1 「성광」 발밑에 빛의 원만 / ★ 「성역」 황금 돔 / ★★ 「성채」 돔 둘레에 돌기둥 넷이 솟아 적을 밀어낸다
  //  ★★★ 「성전」 금빛 성당이 세워지고 1초마다 종이 울린다 — 끝날 때 빛으로 무너지며 성광이 터진다
  sanctuary: {
    pose(u) {
      if (u < 0.35) { const r = segU(u, 0, 0.35); return { wa: mix(-1.0, -1.57, easeOut(r)), lift: 12 * Math.sin(Math.PI * r) }; }
      if (u < 0.5) { const d = easeIn(segU(u, 0.35, 0.48)); return { wa: mix(-1.57, 1.57, d), sy: mix(1, 0.86, d) }; }
      return { wa: 1.57, sy: mix(0.86, 0.96, segU(u, 0.5, 1)) };
    },
    cues: [[0.48, (a) => {
      const k = a.k, s = k.stage || 0, h = hand(a), life = k.dur * 0.52 + k.ward.dur;
      if (s === 0) { lightCircleFx(a, life); return; }
      impact({ stop: 0.06, shake: 0.15 });
      if (s === 1) { ringFx(h.x, '#ffd257', 1.2, 0.6); debris(h.x, 10, ['#c9b38a', '#ffd257']); domeFx(a, life); return; }
      for (let j = 0; j < 14; j++) parts.push({ x: a.x() + rand(-16, 16), y: groundY() - rand(4, 34), vx: rand(-15, 15), vy: rand(-70, -35), g: -15, size: 3, color: j % 2 ? '#7dffb0' : '#ffffff', life: 0.8, t: 0, add: true });
      if (s === 2) rampartFx(a, life); else cathedralFx(a, life);
    }]],
    hit(a) {
      // ★★·★★★ 기둥·성당이 솟으며 둘레의 적을 밀어낸다: 바닥을 따라 바깥으로 번지는 흙먼지
      const x = a.x(), gy = groundY();
      for (const s of [-1, 1]) for (let j = 0; j < 8; j++) parts.push({ x: x + s * 30, y: gy - 2, vx: s * rand(80, 150), vy: rand(-50, -10), g: 200, size: 2, color: j % 2 ? '#c9b38a' : '#fff3b0', life: 0.4, t: 0 });
    },
    finish(a) { cathedralFallFx(a); },
    kb: 18,
  },

  // ── 검성: 질풍난무 ──
  //  Lv1 「삼연참」 제자리에서 쌍검을 번갈아 세 번 — 돌진도 잔상도 없다
  //  ★ 「질풍난무」 적 앞뒤를 지그재그로 꿰뚫고 오가며 5번 베고 뛰어올라 X자 (붉은 잔상·속도선)
  //  ★★ 「질풍난무·분신」 검붉은 그림자 분신이 대상 너머에서 거울처럼 함께 난무한다 (6회)
  //  ★★★ 「월하난무」 분신 셋 — X자 순간 하단바가 검붉게 멎고 칼자국이 허공에 걸려 있다가, 솟구쳐 내려찍는 마무리 일격에 한꺼번에 부서진다
  gale: {
    pose(u, a) {
      if (a.k && a.k.trio) return galeTrioPose(u * a.k.dur);
      const P = galePlanOf(a), D = Math.max(16, (a.tx() - a.x()) * a.dir);
      const G = galeAt(u * P.dur, D, P);
      const f = G.pos > D ? -1 : 1;                       // 늘 대상 쪽을 본다 (대상 너머면 뒤돈다)
      return { ...G.body, dx: G.pos * f, facing: f };
    },
    tick(a, u, dt) {
      if (a.k.trio) return;
      // 빠르게 움직이는 동안: 지나온 길에 가는 속도선 세 줄 + 옅은 잔상
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
      a.ghostT = 0.035;
      ghostFx(a, sx, (G.pos > D ? -1 : 1) * a.dir, '#ff4d4d', 0.2, { ...G.body }, 0.28);
    },
    cues: (a) => {
      if (a.k.trio) return [[0.05, (a) => { parts.push({ x: a.x(), y: groundY() - 2, vx: -a.dir * 30, vy: -20, g: 200, size: 2, color: '#a8946a', life: 0.3, t: 0 }); }]];
      const P = galePlanOf(a), d = P.dur;
      const list = [
        [0.078 / d, (a) => { burst(a.x(), groundY() - 4, 10, ['#c9b38a', '#a8946a'], 80, 3, 300); }],
        [(P.stops[P.stops.length - 1] + 0.05) / d, (a) => { burst(a.px(), groundY() - 4, 8, ['#c9b38a', '#a8946a'], 80, 3, 300); }],
      ];
      if (a.k.clones) list.push([0.001, (a) => shadowClonesFx(a, a.k.clones)]);
      if (P.fin) {
        list.push([P.x / d, (a) => timeStopFx(a, 0, P.fin.hit - P.x, a.tx(), a.ty())]);
        list.push([P.fin.top / d, (a) => { const h = hand(a); starFx(h.x, h.y - 10, 14, MASTERY_GOLD, 0.3); }]);
      }
      return list;
    },
    hit(a, i) {
      const t = a.targets(i)[0];
      if (a.k.trio) {
        nickFx(t.x, t.y + [-4, 2, 0][i], [-0.8, 0.8, 0.25][i] + (a.dir < 0 ? Math.PI : 0), i === 2 ? 0.32 : 0.25);
        impact({ stop: i === 2 ? 0.04 : 0.015, shake: 0.05 });
        return;
      }
      const P = galePlanOf(a), nS = P.stops.length, clone = a.k.clones;
      if (i < nS) {
        const ang = rand(-0.9, 0.9) + (i % 2 ? Math.PI / 2 : 0);
        slashMarkFx(t.x, t.y, ang, 48, '#ff4d4d', 4, 0.3, 0, rand(-6, 6));
        // 분신의 칼자국: 거울 방향의 검붉은 자국이 한 박자 늦게
        if (clone) slashMarkFx(t.x, t.y, Math.PI - ang, 44, '#6a0a18', 5, 0.3, 0.05, rand(-6, 6));
        burst(t.x, t.y, 6, ['#ffffff', '#ff4d4d'], 90);
        impact({ stop: 0.02, shake: 0.06 });
        return;
      }
      if (i === nS) {
        for (const tt of a.targets(i)) {
          xslashFx(tt.x, tt.y, 22, '#ff3040', 0.4);
          if (clone) xslashFx(tt.x, tt.y, 30, '#6a0a18', 0.45);
          burst(tt.x, tt.y, 24, ['#ffffff', '#ff4d4d', '#1a1b22'], 160);
        }
        ringFx(a.px(), '#ff4d4d', 0.8, 0.4);
        impact({ stop: 0.12, shake: 0.3 });
        return;
      }
      // ★★★ 마무리 일격: 세로로 내리그은 거대한 붉은 베기 (멈춰 있던 칼자국은 timeStopFx 가 이 순간 부순다)
      for (const tt of a.targets(i)) {
        slashMarkFx(tt.x, tt.y - 14, Math.PI / 2, 96, '#ff3040', 8, 0.55, 0, 4);
        slashMarkFx(tt.x, tt.y - 14, Math.PI / 2, 70, '#ffffff', 2, 0.4, 0.04, 4);
        burst(tt.x, tt.y, 40, ['#ffffff', '#ff4d4d', MASTERY_GOLD, '#1a1b22'], 220);
      }
      debris(a.px(), 18, ['#c9b38a', '#a8946a', '#ff4d4d'], 1.8);
      ringFx(a.px(), '#ff3040', 1.8, 0.6);
      impact({ stop: 0.16, shake: 0.45 });
    },
    marks(a, t, pow, i, n) { if (!a.k.trio) weaponMarks(a, t, pow, i, n); },
    kb: 6,
  },

  // ── 검성: 일섬 ──
  //  Lv1 「발도」 제자리에서 칼을 뽑으며 앞을 한 번 — 납작한 칼빛 호 하나
  //  ★ 「일섬」 숨죽인 자세에서 섬광처럼 대상을 꿰뚫고 지나가며 벤다 (붉은 칼날선·잔상)
  //  ★★ 「일섬·납도」 지나간 자리에서 칼을 거두는 순간 "딸깍" — 하단바 끝에서 끝까지 검선이 그어지고 지나친 적이 모두 늦게 갈라진다
  //  ★★★ 「적월일섬」 붉은 보름달이 뜨고, 하단바가 핏빛으로 가라앉은 채 돌아서서 되돌아오는 이중 일섬
  iaido: {
    pose(u, a) {
      const m = a.mast || 0, t = u * (a.k ? a.k.dur : 1.4), D = Math.max(20, Math.abs(a.tx() - a.x()) + 34);
      if (m === 0 && a.k) {
        if (t < 0.3) { const s = easeOut(segU(t, 0, 0.3)); return { sy: 1 - 0.1 * s, skew: 0.12 * s, wa: mix(-1.0, 2.5, s), wa2: mix(-0.5, 2.7, s) }; }
        if (t < 0.45) { const d = easeOut(segU(t, 0.3, 0.45)); return { wa: mix(2.5, 0.1, d), wa2: mix(2.7, 0.4, d), skew: mix(0.12, 0.3, d), dx: 6 * d, sy: 0.92 }; }
        if (t < 0.62) return { wa: 0.1, wa2: 0.4, skew: 0.3, dx: 6, sy: 0.92 };
        const r = easeOut(segU(t, 0.62, 0.9));
        return { wa: mix(0.1, -1.0, r), wa2: mix(0.4, -0.6, r), skew: 0.3 * (1 - r), dx: 6 * (1 - r) };
      }
      if (t < 0.63) { const s = easeOut(segU(t, 0, 0.21)); return { sy: 1 - 0.12 * s, skew: 0.15 * s, wa: mix(-1.0, 2.5, s), wa2: mix(-0.5, 2.7, s) }; }
      if (t < 0.728) { const d = easeOut(segU(t, 0.63, 0.728)); return { dx: D * d, skew: 0.4, wa: 0.15, wa2: 0.35, sy: 0.9, alpha: 0.4 + 0.6 * d }; }
      if (m >= 3) {
        // 뒤돈 자세의 dx 는 facing 이 곱해지므로 부호를 뒤집어 같은 자리를 가리킨다
        if (t < 1.2) return { dx: D, skew: 0.25, wa: 0.15, wa2: 0.35, sy: 0.92 };
        if (t < 1.45) { const k = easeOut(segU(t, 1.2, 1.45)); return { dx: -D, facing: -1, sy: 1 - 0.12 * k, skew: 0.15 * k, wa: mix(0.15, 2.5, k), wa2: mix(0.35, 2.7, k) }; }
        if (t < 1.53) { const d = easeOut(segU(t, 1.45, 1.53)); return { dx: -D * (1 - d), facing: -1, skew: 0.4, wa: 0.15, wa2: 0.35, sy: 0.9, alpha: 0.4 + 0.6 * d }; }
        if (t < 1.78) return { dx: 0, facing: -1, skew: 0.25, wa: 0.15, wa2: 0.35, sy: 0.92 };
        const r = easeOut(segU(t, 1.78, 1.9));
        return { dx: 0, facing: r < 0.5 ? -1 : 1, wa: mix(0.15, -1.0, r), wa2: mix(0.35, -0.6, r) };
      }
      // ★★ 납도: 지나간 자리에서 칼을 천천히 거두었다가(1.24초 딸깍) 돌아온다
      const back = m === 2 ? 1.3 : 1.19;
      if (t < back) {
        if (m === 2 && t > 1.0) { const k = easeIn(segU(t, 1.0, 1.24)); return { dx: D, skew: mix(0.25, 0.05, k), wa: mix(0.15, 2.3, k), wa2: mix(0.35, 2.6, k), sy: mix(0.92, 1, k) }; }
        return { dx: D, skew: 0.25, wa: 0.15, wa2: 0.35, sy: 0.92 };
      }
      const r = easeOut(segU(t, back, 1.4));
      return { dx: D * (1 - r), wa: mix(m === 2 ? 2.3 : 0.15, -1.0, r), wa2: mix(m === 2 ? 2.6 : 0.35, -0.6, r) };
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast;
      if (m === 0) return [[0.2 / d, (a) => { const h = hand(a); parts.push({ x: h.x - a.dir * 6, y: h.y + 3, vx: 0, vy: -15, g: 0, size: 2, color: '#ffffff', life: 0.25, t: 0 }); }]];
      const list = [
        [0.448 / d, (a) => { const h = hand(a); starFx(h.x - a.dir * 12, h.y + 4, 12, '#ffffff', 0.3); }],
        [0.644 / d, (a) => {
          const y = groundY() - 26, x = a.x(), far = Math.abs(a.tx() - x) + 60;
          razorFx(x, x + a.dir * far, y, '#ff3040', 0.5, 0, false);
          for (let i = 1; i <= 3; i++) ghostFx(a, x + a.dir * (Math.abs(a.tx() - x) + 34) * (i / 4), a.dir, '#ff4d4d', 0.3, { wa: 0.15, skew: 0.4 });
        }],
      ];
      if (m === 2) list.push([1.24 / d, (a) => sheatheFx(a, groundY() - 26)]);
      if (m >= 3) {
        list.push([0.01, (a) => bloodMoonFx(a, d - 0.02, 1.2, 1.66)]);
        list.push([1.3 / d, (a) => { const h = hand(a); starFx(h.x + a.dir * 12, h.y + 4, 14, '#ff8090', 0.3); }]);
        list.push([1.46 / d, (a) => {
          // 되돌아오는 섬광: 대상 너머에서 출발점까지 핏빛 칼날 선과 잔상
          const y = groundY() - 26, x = a.x(), D = Math.abs(a.tx() - x) + 34;
          razorFx(x + a.dir * (D + 20), x - a.dir * 20, y + 4, '#ff6070', 0.55, 0, false);
          for (let i = 1; i <= 3; i++) ghostFx(a, x + a.dir * D * (1 - i / 4), -a.dir, '#ff2030', 0.3, { wa: 0.15, skew: 0.4 });
        }]);
      }
      return list;
    },
    hit(a, i) {
      const m = a.mast;
      if (m === 0) { for (const t of a.targets(i)) drawArcFx(a, t.x - a.dir * 6, t.y + 2); impact({ stop: 0.03, shake: 0.08 }); return; }
      if (m === 2 && i === 1) {
        // 납도: 지나친 적이 위아래로 늦게 갈라진다 — 세로 틈이 벌어지며 붉은 빛이 샌다
        for (const t of a.targets(i)) {
          skFx(null, 0, 0.45, (u) => {
            const gap = 1 + 5 * easeOut(Math.min(1, u / 0.3)), h = 22;
            ctx.save(); ctx.globalAlpha = 1 - u;
            ctx.fillStyle = '#ff3040'; ctx.fillRect(t.x - gap / 2, t.y - h, gap, h * 2);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(t.x - 0.5, t.y - h, 1, h * 2);
            ctx.restore();
          });
          burst(t.x, t.y, 26, ['#ffffff', '#ff3040', '#1a1b22'], 190, 3);
        }
        impact({ stop: 0.16, shake: 0.4 });
        return;
      }
      if (m >= 3 && i === 2) {
        // 두 번째 일섬이 터진다: 대상 위로 달빛 X
        for (const t of a.targets(i)) {
          xslashFx(t.x, t.y, 26, '#ff6070', 0.5);
          burst(t.x, t.y, 40, ['#ffffff', '#ff3040', '#ff9aa4', '#1a1b22'], 220, 3);
        }
        impact({ stop: 0.2, shake: 0.5 });
        return;
      }
      if (m >= 3 && i === 1) { for (const t of a.targets(i)) burst(t.x, t.y, 10, ['#ffffff', '#ff4d4d'], 110); return; }
      for (const t of a.targets(i)) burst(t.x, t.y, 28, ['#ffffff', '#ff3040', '#1a1b22'], 190, 3);
      impact({ stop: 0.18, shake: 0.4 });
    },
    // 머리카락처럼 가는 선이 그어졌다가 늦게 위아래로 벌어지며 터진다
    marks(a, t, pow, i) {
      if (a.mast === 0 || (a.mast === 2 && i === 1) || (a.mast >= 3 && i === 1)) return;
      razorFx(t.x - 42, t.x + 42, t.y, '#ff3040', 0.7);
      razorFx(t.x - 26, t.x + 26, t.y - 9, '#ff3040', 0.6, 0.05);
    },
    kb: 20,
  },

  // ── 용기병: 용추락 ──
  //  Lv1 「도약 찌르기」 낮게 뛰어올라 내려찍는다 / ★ 「용추락」 화면 위로 솟구쳤다 유성처럼
  //  ★★ 「용추락·업화」 내리꽂힌 자리에 보라 불바다가 한동안 넘실댄다
  //  ★★★ 「유성룡」 떨어지는 동안 보라 용의 몸통이 굽이치며 따라오고 — 뒤이어 유성 파편 셋이 쏟아진다
  dragonFall: {
    pose(u, a) {
      const m = a.mast || 0, t = u * (a.k ? a.k.dur : 1.1), D = Math.max(0, Math.abs(a.tx() - a.x()) - 14);
      if (a.k && m === 0) {
        if (t < 0.12) { const c = t / 0.12; return { sy: 1 - 0.14 * c, wa: -1.3 }; }
        if (t < 0.3) { const r = easeOut(segU(t, 0.12, 0.3)); return { lift: 30 * r, wa: -1.57, sy: 1.05 }; }
        if (t < 0.42) return { lift: 30, dx: D * segU(t, 0.3, 0.42), wa: 1.4 };
        if (t < 0.5) { const f = easeIn(segU(t, 0.42, 0.5)); return { lift: 30 * (1 - f), dx: D, wa: 1.57, sy: 1.1 }; }
        if (t < 0.62) return { dx: D, sy: mix(0.86, 1, segU(t, 0.5, 0.62)), wa: 1.2 };
        const b = segU(t, 0.62, 0.8);
        return { dx: D * (1 - b), lift: 12 * Math.sin(Math.PI * b), wa: -1.3 };
      }
      if (m >= 3) {
        if (t < 0.935) return dragonFallBase(t / 1.1, D);
        if (t < 1.15) return { dx: D, sy: 0.82, wa: 1.2 };
        const b = segU(t, 1.15, 1.4);
        return { dx: D * (1 - b), lift: 30 * Math.sin(Math.PI * b), wa: -1.3 };
      }
      return dragonFallBase(u, D);
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast;
      if (m === 0) return [[0.12 / d, (a) => { for (let i = 0; i < 4; i++) parts.push({ x: a.x(), y: groundY() - 2, vx: rand(-50, 50), vy: rand(-40, -10), g: 200, size: 2, color: '#c9b38a', life: 0.3, t: 0 }); }]];
      const list = [
        [0.165 / d, (a) => { ringFx(a.x(), 'rgba(214,196,150,0.9)', 0.5, 0.4); debris(a.x(), 8, ['#c9b38a', '#a8946a']); }],
        [0.495 / d, (a) => {
          aFx(a, 0, 0.3, (u) => {
            const x = a.tx() - a.dir * 4, gy = groundY();
            ctx.save();
            ctx.globalAlpha = 0.4 + 0.5 * u;
            ctx.strokeStyle = '#b388ff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(x, gy - 1, 34 * (1 - u * 0.6), 6 * (1 - u * 0.6), 0, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
          });
        }],
        [0.66 / d, (a) => { const x = a.tx() - a.dir * 4; meteorFx(x - a.dir * 40, -20, x, groundY() - 12, '#b388ff', 12, 0.13); }],
      ];
      if (m >= 3) {
        list.push([0.45 / d, (a) => dragonTrailFx(a, 0, 0.36)]);
        list.push([0.79 / d, (a) => {
          const x = a.tx() - a.dir * 4;
          a.k.hits.slice(1).forEach((h, j) => shardFallFx(x + [-26, 30, 4][j] * a.dir, h[0] * d - 0.79 - 0.22));
        }]);
      }
      return list;
    },
    hit(a, i) {
      const m = a.mast, x = a.tx() - a.dir * 4;
      if (m === 0) { hopDustFx(x); for (const t of a.targets(i)) burst(t.x, t.y, 6, ['#ffffff', '#c79bff'], 90); impact({ shake: 0.1 }); return; }
      if (i > 0) {
        if (m === 2) { for (let j = 0; j < 14; j++) parts.push({ x: x + rand(-40, 40), y: groundY() - 4, vx: rand(-20, 20), vy: rand(-140, -60), g: 60, size: 3, color: j % 2 ? '#b388ff' : '#e0c8ff', life: 0.5, t: 0, add: true }); impact({ shake: 0.12 }); }
        else impact({ stop: 0.03, shake: 0.15 });
        return;
      }
      ringFx(x, '#b388ff', m >= 3 ? 1.7 : 1.3, 0.6);
      ringFx(x, '#ffffff', 0.7, 0.35);
      cracksFx(x, x + 90, '#c0a0ff', 0.9);
      cracksFx(x, x - 90, '#c0a0ff', 0.9);
      debris(x, 22, ['#5a4a42', '#b388ff', '#c9b38a'], 1.4);
      for (const t of a.targets(i)) burst(t.x, t.y, 14, ['#ffffff', '#b388ff'], 140);
      if (m === 2) firePoolFx(x, 48, 2.6);
      impact({ stop: 0.12, shake: m >= 3 ? 0.5 : 0.4 });
    },
    marks(a, t, pow, i) { if (a.mast && i === 0) clawMarksFx(t.x, t.y, a.dir, '#b388ff', 1.15); },
    kb: 16,
  },

  // ── 용기병: 용의 숨결 ──
  //  Lv1 「화염 숨」 창끝에서 짧은 불꽃만 / ★ 「용의 숨결」 창끝의 용머리가 보라 불꽃을 쏟는다
  //  ★★ 「삼두룡의 숨결」 창끝 둘레로 용머리 셋이 갈라져 나와 세 갈래 부채꼴로 뿜는다
  //  ★★★ 「용왕의 포효」 기사 뒤 하늘에 거대한 용왕 머리가 솟아 포효하고 — 입을 벌려 하단바 끝까지 닿는 광선
  dragonBreath: {
    pose(u, a) {
      const m = a.mast || 0, t = u * (a.k ? a.k.dur : 1.8);
      if (m >= 3) {
        if (t < 0.95) { const r = easeOut(Math.min(1, t / 0.5)); return { wa: mix(-1.3, -1.6, r), sy: 1 + 0.06 * r, skew: -0.12 * r, lift: 3 * r }; }
        return dragonBreathBase(0.2 + 0.8 * segU(t, 0.95, a.k.dur));
      }
      return dragonBreathBase(u);
    },
    tick(a, u) {
      const m = a.mast, h = hand(a), tip = { x: h.x + a.dir * 26, y: h.y - 2 };
      if (m === 0) { if (u > 0.3 && u < 0.8 && Math.random() < 0.6) puffFx(h.x + a.dir * 20, h.y - 2, a.dir); return; }
      if (m >= 2) return;
      if (u < 0.2) gatherFx(tip.x, tip.y, ['#b388ff', '#ffffff'], 2, 24);
      else if (u < 0.9) {
        for (let i = 0; i < 3; i++) {
          parts.push({ x: tip.x + a.dir * 12, y: tip.y + rand(-3, 3), vx: a.dir * rand(170, 260), vy: rand(-35, 35), g: -40, size: Math.random() < 0.4 ? 4 : 3,
            color: ['#b388ff', '#e0c8ff', '#7a3cff', '#ffffff'][i + (Math.random() < 0.5 ? 0 : 1)], life: rand(0.3, 0.5), t: 0 });
        }
      }
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast;
      if (m === 0) return [];
      if (m === 2) return [[0.2, (a) => { impact({ shake: 0.14 }); tripleHeadsFx(a, d * 0.72); }]];
      if (m >= 3) return [
        [0.01, (a) => greatDragonFx(a, d - 0.05, 0.85)],
        [0.55 / d, (a) => { roarFx(a, 0.55); impact({ shake: 0.3 }); }],
        [0.92 / d, (a) => dragonBeamFx(a, 0, d - 0.92 - 0.15)],
      ];
      return [[0.2, (a) => {
        impact({ shake: 0.12 });
        aFx(a, 0, a.k.dur * 0.7, (u) => {
          const h = hand(a), x = h.x + a.dir * 22, k = u < 0.1 ? u / 0.1 : u > 0.85 ? (1 - u) / 0.15 : 1;
          drawSprite(DRAGON_HEAD, DRAGON_PAL, x + Math.sin(clock * 30), h.y + 15, 3, { flip: a.dir < 0, alpha: k });
        });
      }]];
    },
    hit(a, i, n) {
      const m = a.mast, last = i === n - 1;
      if (m === 0) { for (const t of a.targets(i)) burst(t.x, t.y, 3, ['#ffb070', '#c79bff'], 60); return; }
      if (m >= 3 && last) {
        for (const t of a.targets(i)) burst(t.x, t.y, 40, ['#ffffff', '#e0c8ff', '#7a3cff', '#5a2bb0'], 220, 3);
        impact({ stop: 0.16, shake: 0.5 });
        return;
      }
      for (const t of a.targets(i)) {
        if (m === 2) for (const dy of [-8, 0, 8]) burst(t.x, t.y + dy, last ? 8 : 2, ['#b388ff', '#ffffff', '#7a3cff'], last ? 120 : 60);
        else burst(t.x, t.y, last ? 16 : 5, ['#b388ff', '#ffffff', '#7a3cff'], last ? 140 : 70);
      }
      impact({ shake: last ? 0.2 : 0.05 });
    },
    marks(a, t, pow, i, n) { if (a.mast) scorchFx(t.x + rand(-6, 6), t.y + 8, '#b388ff', i === n - 1 ? 0.8 : 0.45); },
    kb: 5,
  },

  // ── 할버디어: 대회전 ──
  //  Lv1 「휩쓸기」 앞으로 반 바퀴 / ★ 「대회전」 두 바퀴 돌며 주황 궤적
  //  ★★ 「회오리 대회전」 세 바퀴 — 발밑에서 흙먼지 회오리가 커지다가 끝나면 앞으로 굴러간다
  //  ★★★ 「폭풍 참격」 먹구름이 몰려와 비가 내리고, 돌 때마다 벼락이 적에게 떨어지며 — 바람에 떠올랐다가 내려찍는다
  whirlwind: {
    pose(u, a) {
      const m = a.mast || 0, t = u * (a.k ? a.k.dur : 1.0);
      if (a.k && m === 0) {
        if (t < 0.2) { const w = easeOut(t / 0.2); return { wa: mix(-1.35, -2.8, w), skew: -0.2 * w, sy: 1 - 0.06 * w }; }
        if (t < 0.33) { const d = easeIn(segU(t, 0.2, 0.33)); return { wa: mix(-2.8, 0.9, d), skew: mix(-0.2, 0.35, d), sy: 0.94 }; }
        if (t < 0.4) return { wa: 0.9, skew: 0.35, sy: 0.94 };
        const r = easeOut(segU(t, 0.4, 0.6));
        return { wa: mix(0.9, -1.35, r), skew: 0.35 * (1 - r) };
      }
      if (m >= 3) {
        if (t < 1.48) return whirlPose(segU(t, 0, 1.6), 4, 26 * easeOut(segU(t, 0.2, 1.3)));
        if (t < 1.63) { const d = easeIn(segU(t, 1.48, 1.63)); return { wa: mix(-2.6, 1.1, d), lift: 26 * (1 - d), sy: mix(1.08, 0.82, d), skew: mix(-0.2, 0.4, d) }; }
        if (t < 1.72) return { wa: 1.1, sy: 0.84, skew: 0.4 };
        const r = easeOut(segU(t, 1.72, 1.9));
        return { wa: mix(1.1, -1.35, r), sy: mix(0.84, 1, r), skew: 0.4 * (1 - r) };
      }
      return whirlPose(u, m === 2 ? 3 : 2, 0);
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast;
      if (m === 0) return [];
      const trail = [0.12 * (m >= 3 ? 1.6 : d) / d, (a) => {
        ringFx(a.x(), '#ff9f40', 0.8, 0.5);
        const life = (m >= 3 ? 1.36 : d * 0.78);
        aFx(a, 0, life, (u) => {
          const p = castPose(a.owner) || {}, x = a.x(), y = groundY() - HAND_Y - (p.lift || 0);
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
      }];
      const list = [trail];
      if (m === 2) list.push([0.1, (a) => dustTwisterFx(a, d * 0.9 + 0.7, d * 0.85)]);
      if (m >= 3) list.push([0.01, (a) => stormCloudFx(a, d - 0.02)]);
      return list;
    },
    hit(a, i, n) {
      const m = a.mast;
      if (m === 0) { sweepArcFx(a); for (const t of a.targets(i)) burst(t.x, t.y, 4, ['#e0a070', '#ffffff'], 80); impact({ shake: 0.06 }); return; }
      if (m >= 3) {
        for (const t of a.targets(i)) { boltFx(t.x + rand(-4, 4)); burst(t.x, t.y, 10, ['#cfe0ff', '#ffffff', '#ff9f40'], 150); }
        if (i === n - 1) {
          const x = a.px();
          ringFx(x, '#ff9f40', 1.6, 0.5);
          for (const s of [-1, 1]) boltFx(x + s * rand(30, 50), 0.26);
          debris(x, 18, ['#5a4a42', '#c9b38a', '#ff9f40'], 1.5);
          impact({ stop: 0.14, shake: 0.45 });
        } else impact({ stop: 0.04, shake: 0.15 });
        return;
      }
      for (const t of a.targets(i)) burst(t.x, t.y, 12, ['#ff9f40', '#ffffff', '#ffd257'], 150);
      impact({ stop: 0.05, shake: 0.18 });
      if (i === n - 1) ringFx(a.x(), '#ff9f40', 1.2, 0.45);
    },
    marks(a, t, pow, i) { if (a.mast) ringSlashFx(t.x, t.y, 24, 9, i % 2 ? 0.3 : -0.3, '#ff9f40', 0.5); },
    kb: 24,
  },

  // ── 할버디어: 대지 가르기 ──
  //  Lv1 「내려찍기」 제자리에서 짧은 금 / ★ 「대지 가르기」 뛰어올라 내려찍으면 균열과 바위
  //  ★★ 「대지 진동」 땅이 흙 둔덕 파도처럼 솟아 두 번 밀려가며 적을 띄운다
  //  ★★★ 「대지 분쇄」 더 높이 솟구쳐 내려찍으면 하단바를 가로지르는 용암 균열이 열리고 — 적 발밑마다 용암이 솟구친다
  earthSplitter: {
    pose(u, a) {
      const m = a.mast || 0, t = u * (a.k ? a.k.dur : 1.4);
      if (a.k && m === 0) {
        if (t < 0.25) { const c = easeOut(t / 0.25); return { sy: 1 - 0.14 * c, wa: mix(-1.35, -2.0, c) }; }
        if (t < 0.42) { const j = segU(t, 0.25, 0.42); return { lift: 10 * Math.sin((Math.PI / 2) * j), wa: mix(-2.0, -2.6, j), skew: -0.15 }; }
        if (t < 0.5) { const s = easeIn(segU(t, 0.42, 0.5)); return { lift: 10 * (1 - s), wa: mix(-2.6, 1.1, s), skew: mix(-0.15, 0.35, s) }; }
        if (t < 0.7) return { wa: 1.1, sy: 0.88, skew: 0.35 };
        const r = easeOut(segU(t, 0.7, 0.9));
        return { wa: mix(1.1, -1.35, r), sy: mix(0.88, 1, r), skew: 0.35 * (1 - r) };
      }
      const p = earthSplitterBase(u);
      if (m >= 3) p.lift = (p.lift || 0) * 1.9;
      return p;
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast;
      if (m === 0) return [];
      return [[0.52, (a) => {
        const h = hand(a), x0 = h.x + a.dir * 40;
        const far = Math.max(220, Math.max(...a.targets().map((t) => (t.x - x0) * a.dir)) + 50);
        impact({ stop: 0.12, shake: m >= 3 ? 0.55 : 0.45 });
        ringFx(x0, m >= 3 ? '#ff6a1a' : '#ff9f40', m >= 3 ? 1.5 : 1, 0.5);
        debris(x0, 16, ['#5a4a42', '#c9b38a', '#ff9f40']);
        if (m === 1) {
          cracksFx(x0, x0 + a.dir * far, '#ff9f40', 1.3, 0.3);
          const n = Math.round(far / 34);
          for (let i = 0; i < n; i++) {
            const x = x0 + a.dir * (20 + i * 34);
            skLater(a, i * 0.035, () => { spikeFx(x, 18 + rand(0, 14), '#ff9f40', 0.55); debris(x, 4, ['#5a4a42', '#c9b38a']); });
          }
        } else if (m === 2) {
          quakeWaveFx(a, x0 - a.dir * 20, far + 40, 0.55, 0, 12);
          quakeWaveFx(a, x0 - a.dir * 20, far + 40, 0.55, 0.2, 8);
        } else {
          lavaFissureFx(a, x0 - a.dir * 20, 1.4);
          const slam = 0.52 * d;
          a.k.hits.slice(1).forEach((hh, j) => { for (const t of a.targets(j + 1)) lavaGeyserFx(t.x, hh[0] * d - slam - 0.12); });
          if (!a.targets(1).length) [70, 130, 190].forEach((dx, j) => lavaGeyserFx(x0 + a.dir * dx, 0.15 + j * 0.12));
        }
      }]];
    },
    hit(a, i) {
      const m = a.mast;
      if (m === 0) { const h = hand(a); shortCrackFx(h.x + a.dir * 10, a.dir); debris(h.x + a.dir * 10, 4, ['#5a4a42', '#c9b38a']); for (const t of a.targets(i)) burst(t.x, t.y, 5, ['#c9b38a', '#ffffff'], 90); impact({ shake: 0.1 }); return; }
      const col = m >= 3 ? ['#ff6a1a', '#ffe08a', '#5a4a42'] : ['#ff9f40', '#ffffff', '#5a4a42'];
      for (const t of a.targets(i)) burst(t.x, t.y, i === 0 ? 16 : 10, col, 150);
      if (i > 0) impact({ stop: 0.03, shake: 0.15 });
    },
    marks(a, t, pow, i) { if (a.mast === 1) ruptureFx(t.x, '#ff9f40', 62, 0.7); },
    kb: 10, launch: true,
  },

  // ── 저격수: 헤드샷 ──
  //  Lv1 「조준 사격」 짧게 겨눠 한 발 / ★ 「헤드샷」 무릎 꿇고 조준선을 좁혀 급소를
  //  ★★ 「관통 헤드샷」 머리를 꿰뚫은 탄이 뒤의 적까지 — 지나간 길에 열선이 일렁인다
  //  ★★★ 「정적의 일발」 하단바가 조준경 속처럼 청회색으로 가라앉고, 느리게 날아가는 탄이 공기를 가르다 — 유리처럼 깨진다
  headshot: {
    pose(u, a) {
      const m = a.mast || 0, t = u * (a.k ? a.k.dur : 1.1);
      if (a.k && m === 0) {
        if (t < 0.12) { const k = t / 0.12; return { sy: 1 - 0.05 * k, pull: 0 }; }
        if (t < 0.48) return { sy: 0.95, pull: 9 * easeOut(segU(t, 0.12, 0.46)) };
        const r = segU(t, 0.48, 0.8);
        return { sy: mix(0.95, 1, r), dx: -3 * Math.sin(Math.PI * r), pull: 0 };
      }
      if (m >= 3) {
        if (t < 0.2) { const k = t / 0.2; return { sy: 1 - 0.16 * k, dx: -2 * k, pull: 0 }; }
        if (t < 1.14) return { sy: 0.84 + 0.01 * Math.sin(clock * 4), dx: -2, pull: 12 * easeOut(segU(t, 0.2, 1.0)) };
        if (t < 1.3) return { sy: 0.84, dx: -2 - 7 * easeOut(segU(t, 1.14, 1.22)), pull: 0 };
        if (t < 1.7) return { sy: 0.84, dx: -9, pull: 0 };
        const r = segU(t, 1.7, 2.0);
        return { sy: mix(0.84, 1, r), dx: -9 * (1 - r), pull: 0 };
      }
      return headshotBase(u);
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast;
      if (m === 0) return [];
      if (m >= 3) return [
        [0.01, (a) => scopeFx(a, d - 0.02, 1.64)],
        [1.14 / d, (a) => { const h = hand(a); slowBulletFx(a, h.x + a.dir * 8, h.y, 0.5); burst(h.x + a.dir * 6, h.y, 8, ['#ffffff', '#ffe066'], 70, 2, 0); impact({ shake: 0.15 }); }],
      ];
      return [
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
      ];
    },
    hit(a, i) {
      const m = a.mast, h = hand(a);
      if (m === 0) { for (const t of a.targets(i)) { plainShotFx(h.x + a.dir * 8, h.y, t.x, t.y - 8, '#f0e0a0'); burst(t.x, t.y - 8, 6, ['#ffffff', '#ffe066'], 100); } impact({ stop: 0.05, shake: 0.1 }); return; }
      const tg = a.targets(i);
      if (m === 2) {
        const far = Math.max(a.tx() + a.dir * 30, ...tg.map((t) => t.x + a.dir * 40));
        heatTrailFx(h.x + a.dir * 8, h.y, a.dir > 0 ? Math.max(far, a.tx() + 60) : Math.min(far, a.tx() - 60));
      }
      for (const t of tg) {
        if (m >= 3) glassBreakFx(t.x, t.y - 8);
        burst(t.x, t.y - 8, m >= 3 ? 30 : 20, ['#ffffff', '#ff3b3b', '#ffe066'], m >= 3 ? 200 : 160);
        if (m !== 3) starFx(t.x, t.y - 8, 14, '#ffe066', 0.3);
        addFloater(m >= 3 ? 'HEADSHOT!!' : 'HEADSHOT!', t.x, (t.top || t.y - 20) - 22, '#ffe066', m >= 3 ? 15 : 13);
      }
      impact({ stop: m >= 3 ? 0.22 : 0.14, shake: m >= 3 ? 0.45 : 0.25 });
    },
    marks(a, t) { if (a.mast === 1 || a.mast === 2) crackFx(t.x, t.y - 8, '#ffe066', 0.7); },
    kb: 34,
  },

  // ── 저격수: 철갑 관통탄 ──
  //  Lv1 「강궁 사격」 힘껏 당겨 묵직한 한 발 / ★ 「철갑 관통탄」 화면 끝까지 꿰뚫는 한 발, 반동에 밀려난다
  //  ★★ 「폭렬 관통탄」 맞은 자리에서 포탄처럼 터져 쇳조각과 연기가 흩어진다
  //  ★★★ 「공성 노포」 옆에 거대한 노포가 세워지고 — 굵은 쇠뇌 살 세 발이 하단바 끝까지 날아가 가장자리에 꽂힌다
  armorPiercer: {
    pose(u, a) {
      const m = a.mast || 0, t = u * (a.k ? a.k.dur : 1.2);
      if (a.k && m === 0) {
        if (t < 0.54) return { pull: 11 * easeOut(segU(t, 0, 0.5)), skew: -0.1, sy: 0.97 };
        const r = segU(t, 0.54, 0.9);
        return { pull: 0, dx: -4 * Math.sin(Math.PI * Math.min(1, r * 1.5)), skew: -0.1 * (1 - r) };
      }
      if (m >= 3) return { pull: 0, sy: 0.94, skew: 0.1, dx: -6 };
      return armorPiercerBase(u);
    },
    tick(a, u) {
      if ((a.mast === 1 || a.mast === 2) && u < 0.5) { const h = hand(a); gatherFx(h.x + a.dir * 18, h.y, ['#ffe066', '#ffffff'], 1, 22); }
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast;
      if (m === 0) return [];
      if (m >= 3) {
        const shots = a.k.hits.map((h) => h[0] * d - 0.08);
        return [[0.01, (a) => ballistaFx(a, d - 0.02, shots)], ...shots.map((s, j) => [s / d, (a) => {
          ballistaBoltFx(a, groundY() - 26 + j * 3);
          for (let i = 0; i < 6; i++) parts.push({ x: a.x() + a.dir * 18, y: groundY() - 2, vx: -a.dir * rand(40, 120), vy: rand(-60, -10), g: 200, size: 3, color: '#c9b38a', life: 0.4, t: 0 });
          impact({ stop: 0.06, shake: 0.3 });
        }])];
      }
      return [[0.5, (a) => {
        const h = hand(a), end = a.dir > 0 ? W + 20 : -20;
        streakFx(h.x + a.dir * 8, h.y, end, h.y, '#ffe066', 10, 0.4);
        aFx(a, 0, 0.3, (u) => {
          ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2;
          for (const k of [0.6, 1]) { ctx.beginPath(); ctx.ellipse(h.x + a.dir * (10 + u * 30 * k), h.y, 3 + u * 4, 8 + u * 18 * k, 0, 0, Math.PI * 2); ctx.stroke(); }
          ctx.restore();
        });
        for (let i = 0; i < 8; i++) parts.push({ x: a.x(), y: groundY() - 2, vx: -a.dir * rand(60, 140), vy: rand(-60, -10), g: 200, size: 3, color: '#c9b38a', life: 0.4, t: 0 });
        impact({ stop: 0.08, shake: 0.3 });
      }]];
    },
    hit(a, i) {
      const m = a.mast, h = hand(a);
      if (m === 0) { for (const t of a.targets(i)) { plainShotFx(h.x + a.dir * 8, h.y, t.x, t.y, '#ffe066', 0.14); burst(t.x, t.y, 8, ['#ffe066', '#ffffff'], 110); } impact({ stop: 0.05, shake: 0.12 }); return; }
      if (m === 2 && i === 1) {
        const tg = a.targets(0);
        for (const t of (tg.length ? tg : [{ x: a.tx(), y: a.ty() }])) shellBlastFx(t.x, t.y);
        impact({ stop: 0.1, shake: 0.35 });
        return;
      }
      for (const t of a.targets(i)) burst(t.x, t.y, m >= 3 ? 22 : 18, m >= 3 ? ['#c9c2b4', '#8a5a2b', '#ffffff'] : ['#ffe066', '#ffffff'], 160);
    },
    marks(a, t, pow, i) { if ((a.mast === 1 || a.mast === 2) && i === 0) drillFx(t.x, t.y, a.dir, '#ffe066', 0.55); },
    kb: 22,
  },

  // ── 마궁수: 유도 마탄 ──
  //  Lv1 「마력탄」 작은 구슬 두 발이 곧게 / ★ 「유도 마탄」 등 뒤 마법진에서 6발이 휘어 쫓는다
  //  ★★ 「마탄 군무」 마력탄 8발이 기사 둘레를 돌며 춤추다가 하나씩 튀어나가 휘어 날아간다
  //  ★★★ 「마력 붕괴」 적 위에 검푸른 특이점이 열려 빛을 빨아들이며 커지고 — 터지며 고리가 퍼진다
  homingBolts: {
    pose(u) {
      if (u < 0.3) return { pull: 8 * segU(u, 0, 0.3), bowA: -0.25 * segU(u, 0, 0.3) };
      if (u < 0.6) return { pull: 8 * (1 - segU(u, 0.3, 0.55)), bowA: -0.25 };
      return { pull: 0, bowA: -0.25 * (1 - segU(u, 0.6, 1)) };
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast;
      if (m === 0) return a.k.hits.map((hh) => [Math.max(0, hh[0] - 0.12 / d), (a) => { const h = hand(a); plainBoltFx(a, h.x + a.dir * 8, h.y - 2, 0.12); }]);
      if (m === 2) return [[0.01, (a) => orbitBoltsFx(a, 8, d - 0.02, a.k.hits.map((hh) => hh[0] * d - 0.16))]];
      if (m >= 3) return [[0.01, (a) => singularityFx(a, d - 0.02, a.k.hits[a.k.hits.length - 1][0] * d)]];
      return [
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
      ];
    },
    hit(a, i, n) {
      const m = a.mast, last = i === n - 1;
      if (m === 0) { for (const t of a.targets(i)) burst(t.x, t.y, 4, ['#9fefff', '#ffffff'], 70, 2, 0); return; }
      if (m >= 3) {
        if (!last) {
          // 특이점이 맥박치듯 둘레의 빛 고리를 빨아들인다
          const x = a.tx(), y = a.ty() - 44;
          skFx(null, 0, 0.25, (u) => { ctx.save(); ctx.globalAlpha = 0.8 * (1 - u); ctx.strokeStyle = '#9fefff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, 60 * (1 - u) + 6, 24 * (1 - u) + 3, 0.2, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); });
          for (const t of a.targets(i)) burst(t.x, t.y, 5, ['#6ff3ff', '#ffffff'], 80, 2, 0);
          impact({ shake: 0.05 });
          return;
        }
        for (const t of a.targets(i)) burst(t.x, t.y, 34, ['#6ff3ff', '#ffffff', '#05121a'], 210, 3, 0);
        impact({ stop: 0.16, shake: 0.45 });
        return;
      }
      for (const t of a.targets(i)) { burst(t.x, t.y, 8, ['#6ff3ff', '#ffffff'], 100, 2, 0); starFx(t.x, t.y, 6, '#6ff3ff', 0.18); }
      impact({ shake: 0.05 });
      if (last) { ringFx(a.tx(), '#6ff3ff', 0.8, 0.4); impact({ stop: 0.05, shake: 0.18 }); }
    },
    marks(a, t, pow, i, n) { if (a.mast === 1 || a.mast === 2) runeStampFx(t.x + rand(-7, 7), t.y + rand(-9, 9), 7, '#6ff3ff'); },
    kb: 5,
  },

  // ── 마궁수: 별빛 화살비 ──
  //  Lv1 「별똥 화살」 하늘에서 작은 화살 세 발 / ★ 「별빛 화살비」 하늘의 마법진에서 별빛 화살이 쏟아진다
  //  ★★ 「별자리 화살비」 하늘에 별이 하나씩 켜져 선으로 이어지고 — 별마다 화살이 떨어진다
  //  ★★★ 「별이 지는 밤」 하단바가 남색 밤하늘로 물들고 오로라가 흐르다 — 커다란 별이 떨어져 다섯 갈래로 부서진다
  starfall: {
    pose(u) {
      if (u < 0.25) return { bowA: -1.1 * easeOut(segU(u, 0, 0.15)), pull: 10 * segU(u, 0.05, 0.25) };
      if (u < 0.92) return { bowA: -1.1, pull: 0 };
      return { bowA: -1.1 * (1 - segU(u, 0.92, 1)), pull: 0 };
    },
    cues: (a) => {
      const d = a.k.dur, m = a.mast;
      const up = [0.25, (a) => { const h = hand(a); streakFx(h.x + a.dir * 4, h.y - 6, h.x + a.dir * 40, -10, m ? '#6ff3ff' : '#cfefff', m ? 3 : 1, 0.2); }];
      if (m === 0) return [up];
      if (m === 2) return [up, [0.28, (a) => constellationFx(a, d * 0.72, a.k.hits.length)]];
      if (m >= 3) return [up, [0.01, (a) => nightSkyFx(a, d - 0.02, a.k.hits[a.k.hits.length - 1][0] * d)]];
      return [up, [0.3, (a) => { circleFx(a, () => ({ x: a.tx(), y: 34 }), 74, 9, '#6ff3ff', a.k.dur * 0.68); }]];
    },
    hit(a, i, n) {
      const m = a.mast, cx = a.tx(), last = i === n - 1, gy = groundY();
      if (m === 0) { const x = cx + rand(-20, 20); fallingArrowFx(x); skFx(null, 0.18, 0.01, null, () => burst(x, gy - 6, 5, ['#cfefff', '#ffffff'], 80, 2, 260)); impact({ shake: 0.03 }); return; }
      if (m === 2) {
        const s = (a.stars || [])[i] || { x: cx, y: 30 }, x1 = s.x + rand(-6, 6);
        streakFx(s.x, s.y, x1, gy - 6, '#9fd8ff', last ? 3 : 2, 0.14);
        burst(x1, gy - 6, last ? 18 : 6, ['#9fd8ff', '#ffffff'], last ? 150 : 90, 2, 260);
        impact(last ? { stop: 0.08, shake: 0.28 } : { shake: 0.05 });
        return;
      }
      if (m >= 3) {
        if (last) { starShatterFx(cx); impact({ stop: 0.2, shake: 0.55 }); return; }
        // 오로라 아래로 별가루가 빗금으로 떨어진다
        const x = cx + rand(-60, 60);
        skFx(null, 0, 0.16, (u) => { ctx.save(); ctx.globalAlpha = 1 - u * 0.5; ctx.fillStyle = '#ffffff'; ctx.fillRect(x - a.dir * 10 * (1 - u), mix(20, gy - 4, u), 2, 2); ctx.fillStyle = 'rgba(150,255,210,0.6)'; ctx.fillRect(x - a.dir * 10 * (1 - u) - a.dir * 3, mix(20, gy - 4, u) - 6, 1, 6); ctx.restore(); },
          () => burst(x, gy - 4, 4, ['#9fffd8', '#ffffff'], 70, 2, 260));
        impact({ shake: 0.04 });
        return;
      }
      const x1 = cx + (last ? 0 : rand(-46, 46)), x0 = x1 - a.dir * rand(14, 30);
      meteorFx(x0, 34, x1, gy - 6, i % 3 ? '#6ff3ff' : '#ffe066', last ? 7 : 4, 0.1, () => {
        burst(x1, gy - 6, last ? 22 : 8, ['#6ff3ff', '#ffffff', '#ffe066'], last ? 160 : 100, 2, 260);
        starStampFx(x1, i % 3 ? '#6ff3ff' : '#ffe066', last ? 22 : 11, last ? 0.8 : 0.55);
      });
      impact(last ? { stop: 0.08, shake: 0.28 } : { shake: 0.06 });
    },
    marks(a, t) { if (a.mast === 1 || a.mast === 2) starFx(t.x + rand(-10, 10), t.y + rand(-12, 6), 5, '#ffe066', 0.25); },
    kb: 4,
  },
};

// ───────────────────────── 그리기 ─────────────────────────
function drawSkillFx() {
  for (const f of skfx) if (f.draw && !f.back && clock >= f.at) f.draw(f.life ? Math.min(1, (clock - f.at) / f.life) : 1);
}
// 뒤 레이어 연출 (backFx): 기사·몬스터보다 먼저 그린다
function drawSkillFxBack() {
  for (const f of skfx) if (f.draw && f.back && clock >= f.at) f.draw(f.life ? Math.min(1, (clock - f.at) / f.life) : 1);
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
  const label = `${k.icon} ${cutin.name || k.name}${cutin.star || ''}`;
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
