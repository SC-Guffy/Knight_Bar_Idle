'use strict';
// 파이터 계열 연출 (docs/specs/boxer-class.md 5·9·10절). 수치는 src/fighter-data.js, 기 규칙은 src/jobs/fighter.js.
// 몸은 통짜 스프라이트 시트(src/sprites.js) — pose 가 { sheet: { anim, u|frame }, dx, lift, skew, sx, sy } 를 돌려준다.
// 이펙트 그림은 전부 PixelLab 텍스처 시트(src/vfx/x*.png, 스펙 10절 XW·XH·XP·XE·XK·XF)이고 코드는 위치·크기·회전·타이밍·색만 맡는다.
// 위치는 시트의 hand 기준점(주먹·발끝·손바닥 끝)을 쓴다 (sheetPoint).

// ── 텍스처 시트 등록: src/vfx/xmeta.js 의 QI_TEX = { id: 프레임 수 } (있는 시트만, node dev/boxer/vfx-meta.js 가 만든다) ──
if (typeof Image !== 'undefined') {
  for (const [id, frames] of Object.entries(QI_TEX)) {
    if (VFX_SHEETS[id]) continue;
    const s = (VFX_SHEETS[id] = { frames, img: new Image() });
    s.img.onload = () => vfxQuantize(s);
    s.img.src = vfxBase + id + '.png';
  }
}
const qiTex = (id) => !!(VFX_SHEETS[id] && VFX_SHEETS[id].lv);
// 직업 → 평타 궤적(XW)·명중(XH). 킥복서 계열 XW 는 2프레임(0 앞차기 · 1 돌려차기)
Object.assign(VFX_BASIC_HIT, { fighter: 'xh1', striker: 'xh2', champion: 'xh3', kickboxer: 'xh4', tempest: 'xh5' });
const QI_TRAIL = { fighter: 'xw1', striker: 'xw2', champion: 'xw2a', kickboxer: 'xw3', tempest: 'xw3a', qigong: 'xw4', grandmaster: 'xw4a' };
const QI_RANGED_HIT = { qigong: 'xh6', grandmaster: 'xh7' };
const QI_AURA = { fighter: 'xe14', striker: 'xe14', champion: 'xe14', kickboxer: 'xe15', tempest: 'xe15', qigong: 'xe16', grandmaster: 'xe16' };

// 시전자의 지금 손(hand)·머리(head) 화면 위치 — 시트 기준점 + 스킬 자세의 이동
function qiPt(a, which = 'hand') {
  const fx = SKILL_FX[a.id], p = fx && fx.pose ? fx.pose(a.u, a) : {};
  return sheetPoint(a.cls, which, a.x(), groundY(), a.dir, { mode: 'fight', swing: -1, t: clock, ...p });
}
const qiHand = (a) => { const p = qiPt(a); return { x: p[0], y: p[1] }; };

// ── 평타: 궤적(XW 키 그림 1장, 늘이며 사라짐) + 근접 명중은 vfxBasicHit 이 XH 를 · 원거리(기공사)는 착탄 때 XH ──
function qiBasicFx(m, combo) {
  const cls = S.cls, id = QI_TRAIL[cls];
  if (!id || !qiTex(id)) return;
  const face = knight.facing || 1, h = sheetPoint(cls, 'hand', toScreen(knight.x) - Math.round((knight.recoil || 0) * 3), groundY(), face);
  const kick = WEAPONS[CLASSES[cls].weapon].motion === 'kick', f = kick ? (combo % 2) : 0;
  skFx(null, 0, 0.14, (u) => {
    const q = Math.min(3, Math.floor(u * 4)) / 3;
    vfxDraw(ctx, id, CLASSES[cls].look.fx, f, h[0] - face * (kick ? 4 : 8), h[1], { flip: face < 0, sx: 1 + 0.3 * q, sy: 1 - 0.3 * q, alpha: 1 - 0.75 * q, scale: kick ? 1 : 2 / 3 });
  });
}
// 기공사 기탄 착탄
function qiRangedHit(m) {
  const id = QI_RANGED_HIT[S.cls];
  if (!id || m.killed) return;
  texFx(id, toScreen(m.x) + m.kb - 4, Math.max(monsterTop(m) + 14, monsterMidY(m)), CLASSES[S.cls].look.fx, { life: 0.22, scale: m.lastCrit ? 1 : 2 / 3, fade: 0.3 });
}
// 기탄 투사체 (world.js drawProjectile): XP 시트를 돌리며 날린다. 그렸으면 true
function qiShotDraw(sh) {
  const id = sh.w.arrow.qi;
  if (!id || !qiTex(id)) return false;
  const f = Math.floor(clock * 14) % VFX_SHEETS[id].frames;
  for (let i = 0; i < sh.trail.length; i += 3) vfxDraw(ctx, id, sh.w.arrow.rgb, f, sh.trail[i][0], sh.trail[i][1], { alpha: 0.18 + 0.1 * i / sh.trail.length, scale: 2 / 3 });
  vfxDraw(ctx, id, sh.w.arrow.rgb, f, sh.x, sh.y, { rot: sh.a });
  return true;
}

// ── 기 오라: 게이지가 가득이면 캐릭터 둘레에 계열별 오라 (XE14~16), 각성 중엔 금빛 (drawKnight 가 몸보다 먼저 부른다) ──
function qiAura(x, gy) {
  if (!qiOn()) return;
  const q = qiSt(), Q = QI[S.cls], id = QI_AURA[S.cls];
  const on = q.aw > 0 || q.v >= Q.max;
  q.auraK = Math.max(0, Math.min(1, (q.auraK || 0) + (on ? 0.08 : -0.06)));
  if (!q.auraK || !id || !qiTex(id)) return;
  const f = Math.floor(clock * 10) % VFX_SHEETS[id].frames;
  vfxDraw(ctx, id, q.aw > 0 ? '#ffd257' : CLASSES[S.cls].look.fx, f, x, gy + 2, { anchor: 'b', alpha: 0.75 * q.auraK });
}

// ── 스킬 공용 도구 ──
// 시트 동작 구간: t 초가 [t0, t1) 이면 그 동작을 u 로
const qiSeg = (t, t0, t1) => clamp01((t - t0) / (t1 - t0));
// 시전 명중 텍스처 (스킬마다 하나 — K 시트). 숙련이 오를수록 크다
function qiHitTex(id, a, t, big = false, o = {}) {
  const sc = big ? 1 : a.mast >= 2 ? 1 : 2 / 3;
  texFx(id, t.x, o.y != null ? o.y : t.y, a.color, { life: o.life || 0.3, scale: o.scale || sc, flip: a.dir < 0, fade: 0.3, anchor: o.anchor });
}
// 손 앞에서 앞으로 뻗는 텍스처 (충격파 원뿔·쐐기). len: 앞으로 나아가는 거리
function qiFrontTex(id, a, life, o = {}) {
  const h = qiHand(a), d = a.dir;
  texFx(id, h.x + d * (o.off != null ? o.off : 18), o.y != null ? o.y : h.y, a.color, { life, scale: o.scale || 1, flip: d < 0, fade: 0.35,
    sx: o.sx, sy: o.sy, move: o.len ? (u) => [d * o.len * easeOut(u), 0] : null, delay: o.delay });
}
// 바닥 흙먼지 (공용 C 시트가 오면 그것으로 — 지금은 작은 흙 알갱이만)
function qiDust(a, n = 4) {
  for (let i = 0; i < n; i++) parts.push({ x: a.px() - a.dir * 4, y: groundY() - 2, vx: -a.dir * rand(30, 80), vy: rand(-40, -10), g: 200, size: 2, color: i % 2 ? '#c9b38a' : '#a8946a', life: 0.3, t: 0 });
}

// 궁극기 공통 틀: 각성(awaken) → 직업 기술 동작 반복 → 내지르기(release) 막타
function qiUltFx(loopAnim, lastTex) {
  return {
    kb: 10,
    pose(u, a) {
      const d = a.k ? a.k.dur : 2.6, t = u * d, last = a.k.hits[a.k.hits.length - 1][0] * d;
      if (t < 0.5) return { sheet: { anim: 'awaken', u: qiSeg(t, 0, 0.5) } };
      if (t < last - 0.12) return { sheet: { anim: loopAnim, frame: Math.floor(t * 14) % 4 }, dx: 10 * Math.sin(t * 3) };
      return { sheet: { anim: 'release', u: qiSeg(t, last - 0.12, last + 0.25) }, dx: 6 };
    },
    hitTex(a, t, share, i, n) { if (i === n - 1) qiHitTex(lastTex, a, t, true, { scale: 4 / 3 }); else qiHitTex(QI_RANGED_HIT[a.cls] || VFX_BASIC_HIT[a.cls] || 'xh1', a, { x: t.x + rand(-10, 10), y: t.y + rand(-10, 6) }, false, { life: 0.18 }); },
  };
}

Object.assign(SKILL_FX, {
  // ── 원투 스트레이트: 잽(atkA) → 스트레이트(release). ★ 일직선 충격파 XE01 · ★★ 훅까지 · ★★★ 섬광 줄 XE02 ──
  oneTwo: {
    kb: 8,
    pose(u, a) {
      const d = a.k ? a.k.dur : 0.6, t = u * d, h = a.k ? a.k.hits : [[0.3], [0.6]], m = a.mast || 0;
      const t1 = h[0][0] * d, t2 = h[1][0] * d, step = m ? 6 : 2;
      if (t < t1 + 0.08) return { sheet: { anim: 'atkA', u: qiSeg(t, t1 - 0.12, t1 + 0.12) }, dx: step * qiSeg(t, 0, t1) };
      if (m >= 2 && h[2] && t >= t2 + 0.06) return { sheet: { anim: 'atkB', u: qiSeg(t, t2 + 0.06, h[2][0] * d + 0.1) }, dx: step + 3, skew: 0.08 };
      return { sheet: { anim: 'release', u: qiSeg(t, t2 - 0.1, t2 + 0.2) }, dx: step + 2 * qiSeg(t, t1, t2), skew: 0.12 * qiSeg(t, t1, t2) };
    },
    hitTex(a, t, share, i, n) { qiHitTex('xk01', a, t, i === n - 1 && a.mast >= 3); },
    hit(a, i, n) {
      const m = a.mast;
      if (i < n - 1) return;
      if (m === 1) qiFrontTex('xe01', a, 0.3, { len: 30 });
      if (m === 2) qiFrontTex('xe01', a, 0.3, { len: 16, scale: 4 / 3 });
      if (m >= 3) { qiFrontTex('xe01', a, 0.3, { len: 30, scale: 4 / 3 }); for (let j = 0; j < 4; j++) qiFrontTex('xe02', a, 0.28, { off: 30 + j * 46, delay: j * 0.035 }); }
    },
  },

  // ── 연타 러시: 기 모으기 → 빠른 연타(skillA 반복) → 어퍼(skillB). ★★ 불붙은 잔상 · ★★★ 띄우고 공중 연타 ──
  ironRush: {
    kb: 3,
    pose(u, a) {
      const d = a.k ? a.k.dur : 1.4, t = u * d, m = a.mast || 0, last = (a.k ? a.k.hits[a.k.hits.length - 1][0] : 0.8) * d;
      const rise = m >= 3 && a.k.air ? a.k.air[0] * d : Infinity, fall = m >= 3 && a.k.air ? a.k.air[1] * d : Infinity;
      const lift = t >= rise && t < fall ? 26 * Math.sin(Math.PI * qiSeg(t, rise, fall)) : 0;
      if (t < 0.12 * d) return { sheet: { anim: 'charge', u: qiSeg(t, 0, 0.12 * d) }, dx: (m ? 8 : 0) * qiSeg(t, 0, 0.12 * d) };
      if (t < last - 0.08) return { sheet: { anim: 'skillA', frame: Math.floor(t * 18) % 4 }, dx: m ? 8 : 0, lift, skew: 0.06 };
      return { sheet: { anim: 'skillB', u: qiSeg(t, last - 0.08, last + 0.16) }, dx: m ? 9 : 1, lift, skew: -0.05 };
    },
    hitTex(a, t, share, i, n) { if (i === n - 1) qiHitTex('xk02', a, t, a.mast >= 3); else if (i % 2 === 0) qiHitTex('xh2', a, { x: t.x + rand(-6, 6), y: t.y + rand(-8, 6) }, false, { life: 0.16 }); },
    tick(a, u) {
      // 주먹 잔상 다발: 연타 동안 손 앞에서 (★★ 이상은 불붙은 잔상)
      const d = a.k.dur, t = u * d, last = a.k.hits[a.k.hits.length - 1][0] * d;
      if (t < 0.12 * d || t > last - 0.08 || (a.rushT && clock - a.rushT < 0.09)) return;
      a.rushT = clock;
      qiFrontTex(a.mast >= 2 ? 'xe04' : 'xe03', a, 0.14, { off: 10, scale: a.mast >= 1 ? 1 : 2 / 3 });
    },
  },

  // ── 붕권: 기 모으기 → 정권(release). ★ 관통 충격 원뿔 XE05 · ★★ 균열 · ★★★ 등 뒤 강철 주먹 XE06 ──
  crushFist: {
    kb: 16,
    pose(u, a) {
      const d = a.k ? a.k.dur : 1.1, t = u * d, hit = a.k.hits[0][0] * d;
      if (t < hit - 0.08) return { sheet: { anim: 'charge', frame: Math.floor(t * 10) % 4 }, sy: 1 - 0.06 * qiSeg(t, 0, hit), skew: -0.05 };
      return { sheet: { anim: 'release', u: qiSeg(t, hit - 0.08, hit + 0.3) }, dx: 6, skew: 0.15 * (1 - qiSeg(t, hit, d)) };
    },
    cues: (a) => (a.mast >= 3 ? [[0.05, (a) => { const h = qiHand(a); texFx('xe06', a.x() - a.dir * 6, h.y - 12, a.color, { life: a.k.dur * 0.75, flip: a.dir < 0, fade: 0.2, move: (u) => [a.dir * 50 * Math.max(0, (u - 0.55) / 0.45), 0] }); }]] : []),
    hitTex(a, t, share, i, n) { qiHitTex('xk03', a, t, a.mast >= 2); },
    hit(a, i, n) {
      if (i !== 0) return;
      qiDust(a, 6);
      if (a.mast >= 1) qiFrontTex('xe05', a, 0.32, { off: 34, len: 30 + 12 * a.mast, scale: a.mast >= 2 ? 4 / 3 : 1 });
    },
  },

  // ── 돌진 발차기: 날아 차기(skillA, 공중). ★ 바람 쐐기 XE07 · ★★ 공중 두 번 · ★★★ 일직선 관통 ──
  flyingKick: {
    kb: 10,
    pose(u, a) {
      const d = a.k ? a.k.dur : 0.8, t = u * d, m = a.mast || 0, fly = m ? 18 : 10;
      const lift = (m ? 14 : 8) * Math.sin(Math.PI * qiSeg(t, 0.05, d * 0.85));
      return { sheet: { anim: 'skillA', u: qiSeg(t, 0, d * 0.9) }, dx: fly * easeOut(qiSeg(t, 0, d * 0.6)), lift };
    },
    hitTex(a, t, share, i, n) { qiHitTex('xk04', a, t, i === n - 1 && a.mast >= 2); },
    hit(a, i, n) {
      if (i !== n - 1 && a.mast < 2) return;
      if (a.mast >= 1) qiFrontTex('xe07', a, 0.28, { off: 8, len: a.mast >= 3 ? 70 : 24, scale: a.mast >= 3 ? 4 / 3 : 1 });
    },
  },

  // ── 회전 발차기: 회전(skillB 반복). ★ 두 바퀴 회오리 띠 XE08 · ★★ 세 바퀴 · ★★★ 남는 회오리 기둥 XE09 ──
  spinKick: {
    kb: 12,
    pose(u, a) {
      const d = a.k ? a.k.dur : 1.1, t = u * d, n = a.k.hits.length;
      return { sheet: { anim: 'skillB', frame: Math.floor(t * 14 * Math.max(1, n / 2)) % 4 }, lift: 3 * Math.sin(Math.PI * u) };
    },
    cues: (a) => a.k.hits.map((h) => [Math.max(0, h[0] - 0.12), (a) => texFx('xe08', a.x(), groundY() - 16, a.color, { life: 0.26, flip: a.dir < 0, scale: a.mast >= 2 ? 4 / 3 : 1, fade: 0.3 })]),
    hitTex(a, t, share, i, n) { qiHitTex('xk05', a, t, i === n - 1 && a.mast >= 2); },
    hit(a, i, n) {
      if (a.mast >= 3 && i === n - 1) texFx('xe09', a.tx(), groundY(), a.color, { anchor: 'b', life: 0.7, fade: 0.3 });
    },
  },

  // ── 장풍: 기 모으기 → 장풍 밀기(skillA). 기탄 XE10 이 날아가 XK06 으로 터진다. 3단(가득)이면 크게 ──
  palmBlast: {
    kb: 12,
    pose(u, a) {
      const d = a.k ? a.k.dur : 1.1, t = u * d, push = a.k.hits[0][0] * d - 0.16;
      if (t < push) return { sheet: { anim: 'charge', frame: Math.floor(t * 10) % 4 }, sy: 1 - 0.05 * qiSeg(t, 0, push) };
      return { sheet: { anim: 'skillA', u: qiSeg(t, push, push + 0.35) }, dx: -2 * qiSeg(t, push, push + 0.1), skew: 0.1 };
    },
    cues: (a) => {
      const d = a.k.dur, hits = a.k.hits, push = hits[0][0] - 0.16 / d, big = a.q3 || (a.k && a.k.q3);
      // 손바닥 끝에서 기탄이 날아가 첫 타격 시점에 닿는다 (★★ 쌍장풍은 두 발)
      const shot = (at, hitAt, dy = 0) => [at, (a) => {
        const h = qiHand(a), tx = a.tx(), ty = a.ty() + dy, life = Math.max(0.05, (hitAt - at) * d);
        const sc = (big ? 4 / 3 : 1) * (a.mast >= 3 ? 4 / 3 : 1);
        skFx(a.owner, 0, life, (u) => vfxDraw(ctx, 'xe10', a.color, Math.floor(clock * 14) % 4, mix(h.x, tx, u), mix(h.y, ty, u), { scale: sc, flip: a.dir < 0 }));
      }];
      return a.mast === 2 ? [shot(push, hits[0][0], -4), shot(push + 0.05, hits[1][0], 4)] : [shot(push, hits[0][0])];
    },
    hitTex(a, t, share, i, n) { qiHitTex('xk06', a, t, a.q3 || i === n - 1, { scale: (a.q3 ? 4 / 3 : 1) * (a.mast >= 2 ? 1 : 2 / 3) * (i === n - 1 ? 1.2 : 1) }); },
    hit(a, i, n) {
      if (a.mast >= 3 && i === n - 1) { const t = a.targets(i)[0]; for (let j = 0; j < 6; j++) texFx('xe11', t.x, t.y, a.color, { life: 0.4, move: ((an) => (u) => [Math.cos(an) * 40 * easeOut(u), Math.sin(an) * 30 * easeOut(u)])(j / 6 * Math.PI * 2) }); }
    },
  },

  // ── 3차 궁극기 (각성): 자리 연출 — 3차 단계(③)에서 XF 배경·XK 막타로 채운다 ──
  kingFist: qiUltFx('skillA', 'xk08'),
  heavenWind: qiUltFx('skillB', 'xk09'),
  qiGodDescent: qiUltFx('skillA', 'xk10'),

  // ── 기막: 기막 자세(skillB) → 반구 막 XE12 가 보호막 동안. ★★ 고리 XE13 · ★★★ 끝에 막이 터진다 XK07 ──
  qiBarrier: {
    kb: 6,
    pose(u, a) { return { sheet: { anim: 'skillB', u: qiSeg(u, 0, 0.8) }, sy: 1 - 0.04 * Math.sin(Math.PI * u) }; },
    cues: (a) => [[0.55, (a) => {
      const life = a.k.dur * 0.45 + (a.k.ward ? a.k.ward.dur : 4);
      skFx(a.owner, 0, life, (u) => {
        const x = a.x(), gy = groundY(), f = Math.floor(clock * 10) % Math.max(1, (VFX_SHEETS.xe12 && VFX_SHEETS.xe12.frames) || 1);
        const al = Math.min(1, u * life / 0.15, (1 - u) * life / 0.3);
        vfxDraw(ctx, 'xe12', a.color, f, x, gy + 1, { anchor: 'b', alpha: 0.7 * al });
        if (a.mast >= 2) vfxDraw(ctx, 'xe13', a.color, f, x, gy - 20, { alpha: 0.85 * al });
      });
    }]],
    hitTex(a, t) { qiHitTex('xh6', a, t); },
    finish(a) { texFx('xk07', a.x(), groundY() - 20, a.color, { life: 0.4, scale: 4 / 3, fade: 0.3 }); impact({ stop: 0.05, shake: 0.15 }); },
  },
});
