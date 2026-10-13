'use strict';
// 고유 발동 효과의 필드 동작 (시즌6, docs/specs/unique-procs.md). 데이터는 data.js ITEM_PROCS·SET_PROCS, 낀 것 목록은 gear.js activeProcs.
// world.js 의 전투 흐름에 갈고리로 들어간다:
//  hitMonster → procPreHit(배율·확정 치명) · procCritPlus · procOnHit(화상·연쇄·빙결·수확) · procOnKill(폭발·황금손·누적·소환·개미지옥)
//  releaseAttack → procOnBasic(투척) · fightTick → procTick(불기둥·일식·소환·화상 틱·예약) · 평타 타이머 → procHaste(누적 공속)
//  기사 피격 → procBeforeHurt(회피·보호막) · procAfterHurt(반격·보호막 발동) · 쓰러짐 → procRebirth(부활)
//  skills.js tryCastSkill → procOnCast(쿨타임 초기화)
// 발동 효과가 만든 타격은 o.proc 를 달아 다시 발동을 부르지 않는다. 연출은 기사·적 둘레에서만 (화면 전체를 번쩍이지 않는다)

const prs = {};                  // 효과별 상태 (activeProcs 의 key): { t 타이머, n 카운터, say 마지막 말풍선 시각, ... }
const prOf = (key) => prs[key] || (prs[key] = { t: 0, n: 0, say: -9 });
const procLater = [];            // [{ at, fn }] — 투척이 돌아오는 타격 같은 예약
let procShield = 0;              // 보호막 남은 양
let procMinions = [];            // 소환된 해골 병사 [{ left, acc, mult, color }]

const hexRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };
const procsOf = (type) => activeProcs().filter((x) => x.p.type === type);
const procHits = (o = {}) => ({ proc: true, nocrit: true, kb: 6, ...o });
const aliveAhead = (range = W) => monsters.filter((m) => !m.dying && aheadDist(knight.x, m.x) <= range).sort((a, b) => aheadDist(knight.x, a.x) - aheadDist(knight.x, b.x));

// 기사 머리 위 이름 말풍선 (같은 효과는 2초에 한 번)
function procSay(x) {
  if (!x.p.say) return;
  const s = prOf(x.key);
  if (clock - s.say < 2) return;
  s.say = clock;
  addFloater(`✦${x.p.say}`, toScreen(knight.x), groundY() - 78, x.p.color, 12, true);
}

// ───────────────────────── 타격 ─────────────────────────
// hitMonster 가 피해를 굴리기 전에: { mul 피해 배율, crit 확정 치명, critAdd 치명 피해 가산 }
function procPreHit(m, o) {
  let mul = 1, crit = false, critAdd = 0;
  for (const x of activeProcs()) {
    const p = x.p;
    if (p.type === 'gaze' && m.hp <= m.maxHp * p.thr) mul *= 1 + p.v;
    else if (p.type === 'reap' && m.boss && m.hp <= m.maxHp * 0.3) mul *= 1 + p.boss;
    else if (p.type === 'firsthit' && !o.nocrit && !o.proc && !m.prFirst) { m.prFirst = 1; crit = true; critAdd += p.critMult; procSay(x); }
  }
  return { mul, crit, critAdd };
}
// 🌑 일식 중 치명 확률 보정
const procCritPlus = () => procsOf('eclipse').reduce((a, x) => a + (prOf(x.key).on > 0 ? x.p.crit : 0), 0);

// 실제로 맞힌 뒤 (발동 타격·지속 피해에서는 부르지 않는다)
function procOnHit(m, dmg, crit) {
  const mx = toScreen(m.x), my = monsterMidY(m);
  for (const x of activeProcs()) {
    const p = x.p;
    if (p.type === 'burn' && !m.dying) {
      const b = m.prBurn && m.prBurn.key === x.key ? m.prBurn : (m.prBurn = { key: x.key, n: 0, left: 0, acc: 0, v: p.v, color: p.color });
      b.n = Math.min(p.max, b.n + 1); b.left = p.dur;
      if (b.n === p.max) procSay(x);
    } else if (p.type === 'chain' && crit) {
      const near = monsters.filter((o) => o !== m && !o.dying && Math.abs(toScreen(o.x) - mx) < 90).slice(0, p.n);
      procSay(x);
      if (p.fire) { burst(mx, my, 14, [p.color, '#ffe066', '#ffffff'], 110, 2, 120); ringFx(mx, p.color, 0.6, 0.4); }
      near.forEach((o, i) => {
        if (!p.fire) arcFx(mx, my, toScreen(o.x), monsterMidY(o), p.color, hexRgb(p.color), 0.2, 1.5, 0.04 * i);
        hitMonster(o, p.mult, procHits({ color: p.color }));
      });
    } else if (p.type === 'freeze' && !m.dying && Math.random() < p.chance) {
      m.stun = Math.max(m.stun || 0, m.boss ? p.dur / 2 : p.dur);
      burst(mx, my, 8, [p.color, '#ffffff'], 60, 2, -30);
    } else if (p.type === 'reap' && !m.dying && !m.boss && m.hp > 0 && m.hp <= m.maxHp * p.thr) {
      procSay(x);
      skFx(null, 0, 0.3, (u) => {             // 낫이 한 번 긋고 지나간다
        ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = p.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(mx, my, 14, -2.4 + u * 2, -0.6 + u * 2); ctx.stroke(); ctx.restore();
      });
      hitMonster(m, m.hp / Math.max(1e-9, stats().atk) * 1.3, procHits({ color: p.color, kb: 10 }));
    }
  }
}

// 쓰러뜨렸을 때 (원정·탑·미궁 공통, 황금손은 원정만)
function procOnKill(m) {
  const mx = toScreen(m.x), my = monsterMidY(m);
  for (const x of activeProcs()) {
    const p = x.p, s = prOf(x.key);
    if (p.type === 'nova') {
      if (p.heal) { const max = stats().maxHp; S.hp = Math.min(max, S.hp + max * p.heal); burst(toScreen(knight.x), groundY() - 30, 6, [p.color, '#ffffff'], 50, 2, -60); }
      if (p.mult) {
        ringFx(mx, p.color, p.radius / 60, 0.45);
        burst(mx, my, 12, [p.color, '#ffffff'], 100, 2, 150);
        for (const o of monsters) if (o !== m && !o.dying && Math.abs(toScreen(o.x) - mx) <= p.radius) hitMonster(o, p.mult, procHits({ color: p.color }));
      }
      procSay(x);
    } else if (p.type === 'fortune' && S.phase === 'expedition' && m.gold) {
      const hit = p.every ? ++s.n % p.every === 0 : Math.random() < p.chance;
      if (!hit) continue;
      const g = m.gold * goldMult() * (p.x - 1);
      S.gold += g; if (S.trip) S.trip.gold += g;
      addFloater(`💰 ×${p.x} +${fmt(g)}`, mx, monsterTop(m) - 14, '#ffd257', 13, true);
      for (let i = 0; i < 8; i++) coins.push({ x: mx, y: groundY() - 14, vx: rand(-70, 70), vy: rand(-180, -100), t: 0, fly: false });
      procSay(x);
    } else if (p.type === 'stack') {
      s.n = Math.min(p.max, (s.left > 0 ? s.n : 0) + 1); s.left = p.dur;
      if (s.n === p.max) procSay(x);
    } else if (p.type === 'summon') {
      procMinions.push({ left: p.dur, acc: 0, mult: p.mult, color: p.color, x: mx });
      procMinions = procMinions.slice(-3);     // 한 번에 셋까지
      burst(mx, groundY() - 4, 8, [p.color, '#7a7466'], 60, 2, 200);
      procSay(x);
    } else if (p.type === 'quake' && ++s.n % p.every === 0) {
      const kx = toScreen(knight.x);
      for (let k = 0; k < 3; k++) effects.push({ type: 'ring', x: kx + 40, y: groundY(), t: -k * 0.08, life: 0.6, size: 1.4 - k * 0.3, color: p.color });
      burst(kx + 40, groundY() - 4, 16, [p.color, '#fff1c2'], 90, 2, 200);
      for (const o of aliveAhead(p.radius)) { o.x = Math.max(knight.x + 12, o.x - 14); hitMonster(o, p.mult, procHits({ color: p.color })); }
      procSay(x);
    }
  }
}

// ───────────────────────── 평타 · 스킬 ─────────────────────────
// 평타가 나갈 때: 투척 카운터
function procOnBasic(st) {
  for (const x of procsOf('throw')) {
    const s = prOf(x.key);
    if (++s.n % x.p.every) continue;
    procThrow(x, st);
  }
}
// 무기가 일직선으로 날아가 관통하고(back 이 있으면) 돌아오며 한 번 더 — 회전하는 창 모양
function procThrow(x, st) {
  const p = x.p, R = Math.max(110, st.range + 60), kx = toScreen(knight.x), y = groundY() - 26, out = 0.28;
  procSay(x);
  const draw = (px, spin) => {
    ctx.save(); ctx.translate(px, y); ctx.rotate(spin);
    ctx.shadowColor = p.color; ctx.shadowBlur = 8;
    ctx.fillStyle = p.color; ctx.fillRect(-12, -1.5, 24, 3);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(12, -4); ctx.lineTo(18, 0); ctx.lineTo(12, 4); ctx.fill();
    ctx.restore();
  };
  skFx(null, 0, out, (u) => draw(kx + R * easeOutC(u), p.back ? u * 12 : 0));
  for (const m of aliveAhead(R)) hitMonster(m, p.mult, procHits({ color: p.color, kb: 10 }));
  if (!p.back) { skFx(null, out, 0.25, (u) => { ctx.save(); ctx.globalAlpha = 1 - u; ctx.fillStyle = p.color; ctx.fillRect(kx, y - 1, R, 2); ctx.restore(); }); return; }
  skFx(null, out, out, (u) => draw(kx + R * (1 - easeOutC(u)), 12 + u * 12));
  procLater.push({ at: clock + out + 0.1, fn: () => { for (const m of aliveAhead(R)) hitMonster(m, p.back, procHits({ color: p.color, kb: 4 })); } });
}
// 스킬을 쓴 직후: 쿨타임 초기화
function procOnCast(id) {
  for (const x of procsOf('cdreset')) {
    if (Math.random() >= x.p.v) continue;
    knight.cds[id] = 0;
    ringFx(toScreen(knight.x), x.p.color, 0.5, 0.4, groundY() - 30);
    procSay(x);
    return;
  }
}
// 🪶 누적 공속 (world.js 평타 타이머가 곱한다)
const procHaste = () => procsOf('stack').reduce((a, x) => { const s = prOf(x.key); return a + (s.left > 0 ? s.n * x.p.v : 0); }, 0);

// ───────────────────────── 시간 흐름 ─────────────────────────
// fightTick 이 매 프레임 부른다. fighting: 사거리에 적이 있는가
function procTick(dt, st, fighting) {
  for (let i = procLater.length - 1; i >= 0; i--) if (clock >= procLater[i].at) { const f = procLater[i].fn; procLater.splice(i, 1); f(); }
  // 화상·독 (0.5초마다, 숫자는 끝날 때 합쳐서)
  for (const m of monsters) {
    const b = m.prBurn;
    if (!b || m.dying) continue;
    b.left -= dt; b.acc += dt;
    if (b.acc >= 0.5) { b.acc -= 0.5; hitMonster(m, b.v * b.n * 0.5, procHits({ kb: 0, color: b.color, quiet: b.left > 0 })); }
    if (Math.random() < dt * 6 * b.n) parts.push({ x: toScreen(m.x) + rand(-5, 5), y: monsterMidY(m) + rand(-6, 6), vx: 0, vy: rand(-30, -15), g: -20, size: 2, color: b.color, life: 0.4, t: 0, add: true });
    if (b.left <= 0) m.prBurn = null;
  }
  for (const x of activeProcs()) {
    const p = x.p, s = prOf(x.key);
    if (p.type === 'stack' && s.left > 0) s.left -= dt;
    if (p.type === 'aegis' && s.cd > 0) s.cd -= dt;
    // 주기형은 시간이 늘 흐르고, 다 차면 싸울 상대가 생길 때 터진다 (빨리 잡는 필드에서도 돌도록)
    if (p.type === 'meteor') {
      s.t = Math.min(p.every, s.t + dt);
      if (s.t >= p.every && fighting) { s.t = 0; procMeteor(x); }
    }
    if (p.type === 'eclipse') {
      if (s.on > 0) s.on -= dt;
      else if ((s.t = Math.min(p.every, s.t + dt)) >= p.every && fighting) { s.t = 0; s.on = p.dur; procEclipse(x); }
    }
  }
  // 해골 병사: 기사 뒤에서 0.5초마다 가장 가까운 적을 친다
  for (const mn of procMinions) {
    mn.left -= dt; mn.acc += dt;
    const tg = aliveAhead(st.range + 40)[0];
    if (tg && mn.acc >= 0.5) { mn.acc = 0; hitMonster(tg, mn.mult, procHits({ color: mn.color, kb: 3 })); burst(toScreen(tg.x), monsterMidY(tg), 4, [mn.color, '#ffffff'], 50, 2, 150); }
  }
  procMinions = procMinions.filter((mn) => mn.left > 0);
  if (!fighting && procMinions.length) procMinions.forEach((mn) => (mn.left = Math.min(mn.left, 0.5)));
}
// 불기둥 · 별똥별 · 포격: 앞쪽 적에게 n 발을 0.12초 간격으로
function procMeteor(x) {
  const p = x.p, tg = aliveAhead();
  if (!tg.length) return;
  procSay(x);
  for (let i = 0; i < p.n; i++) {
    procLater.push({ at: clock + i * 0.12, fn: () => {
      const alive = tg.filter((m) => !m.dying);
      const m = alive[i % Math.max(1, alive.length)];
      if (!m) return;
      const mx = toScreen(m.x);
      pillarFx(mx, p.color, p.beam ? 10 : p.star ? 14 : 22, p.beam ? 0.35 : 0.5);
      burst(mx, groundY() - 6, p.star ? 10 : 14, [p.color, '#ffffff', p.star ? '#fff3b0' : '#ffe066'], 110, 2, 200);
      ringFx(mx, p.color, 0.7, 0.4);
      for (const o of monsters) if (!o.dying && Math.abs(toScreen(o.x) - mx) <= 24) hitMonster(o, p.mult, procHits({ color: p.color, kb: 8 }));
    } });
  }
}
// 🌑 일식: 기사 머리 위에 검은 해와 금빛 테두리가 dur 초 동안 떠 있다
function procEclipse(x) {
  const p = x.p;
  procSay(x);
  skFx(null, 0, p.dur, (u) => {
    const cx = toScreen(knight.x), cy = groundY() - 96, a = u < 0.1 ? u / 0.1 : u > 0.85 ? (1 - u) / 0.15 : 1;
    ctx.save(); ctx.globalAlpha = a;
    ctx.shadowColor = p.color; ctx.shadowBlur = 10 + Math.sin(clock * 6) * 3;
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#14151c'; ctx.beginPath(); ctx.arc(cx + 1, cy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
}

// ───────────────────────── 기사가 맞을 때 ─────────────────────────
// 피해를 넣기 전: 회피면 0, 보호막이 있으면 먼저 깎는다
function procBeforeHurt(dmg) {
  for (const x of procsOf('dodge')) {
    if (Math.random() >= x.p.v) continue;
    addFloater('흘려보냄', toScreen(knight.x) + rand(-4, 4), groundY() - 52, x.p.color, 11);
    burst(toScreen(knight.x), groundY() - 30, 6, [x.p.color, '#ffffff'], 60, 2, -40);
    return 0;
  }
  if (procShield > 0) {
    const a = Math.min(procShield, dmg);
    procShield -= a;
    return dmg - a;
  }
  return dmg;
}
// 피해를 넣은 뒤: 반격, 체력 50% 아래면 보호막
function procAfterHurt(m, dmg, st) {
  if (dmg > 0) for (const x of procsOf('thorns')) {
    if (m.dying) break;
    hitMonster(m, dmg * x.p.v / Math.max(1e-9, st.atk), procHits({ color: x.p.color, kb: 4 }));
    procSay(x);
  }
  if (S.hp > 0 && S.hp < st.maxHp * 0.5) for (const x of procsOf('aegis')) {
    const s = prOf(x.key);
    if (s.cd > 0) continue;
    s.cd = x.p.cd;
    procShield = Math.max(procShield, st.maxHp * x.p.v);
    procSay(x);
    const col = x.p.color;
    skFx(null, 0, 8, (u) => {                  // 보호막이 남아 있는 동안 기사 둘레의 빛 막
      if (procShield <= 0) return;
      const cx = toScreen(knight.x), cy = groundY() - 24;
      ctx.save(); ctx.globalAlpha = 0.35 + 0.15 * Math.sin(clock * 5); ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, 20, 28, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    });
    break;
  }
}
// 쓰러질 때: 원정마다 한 번 되살아난다. 살렸으면 true
function procRebirth(st) {
  if (S.phase !== 'expedition' || !S.trip || S.trip.reborn) return false;
  const x = procsOf('rebirth')[0];
  if (!x) return false;
  S.trip.reborn = 1;
  S.hp = st.maxHp * x.p.heal;
  procSay(x);
  const kx = toScreen(knight.x), gy = groundY();
  pillarFx(kx, x.p.color, 30, 0.8);
  burst(kx, gy - 24, 24, [x.p.color, '#ffe066', '#ffffff'], 120, 2, -80);
  ringFx(kx, x.p.color, 1, 0.6);
  return true;
}
