'use strict';
// 시즌7 스킬 빌드 트리 — 새 스킬·융합·궁극기 변형·변형 노드의 연출과 전투 규칙 (3단계, docs/specs/skill-tree-swordsaint.md)
// 그림은 새로 뽑지 않고 지금 시트를 재사용한다 (VFX 규칙: 코드는 위치·크기·개수·궤적·타이밍·색 램프만):
//  검무 회오리 = E20 도끼날 폭풍(대회전) + K13 원형 칼날 자국 · 섬광 베기 = 일섬 동작 + E11 칼집 일섬을 화면 끝까지 · 비검·검기 폭풍 = E43 강철 초승달 참격파를
//  투사체·방사로 · 융합 = 두 부모 연출 이어 붙이기 · 궁극기 변형 = 천검 + F04 검선·E11·E43 · 잔영 = ghostFx + K08.
// 모습: a.mast 0~3 (찍은 모습 노드 ★·★★·★★★, src/tree7.js t7Stage) — 개수·크기·금빛이 단계마다 오른다.
// 변형은 내 기사(owner 'hero')만 — 결투·레이드 재생에선 기본 모양으로 (변형 정보를 서버가 모른다).
// 이 파일은 skills.js·vfx 파일들 뒤에 불러온다 (SKILL_FX 를 덮어쓴다).

const T7_SILVER = '#dfe6f0';
const t7Hero = (a) => a.owner === 'hero' && t7Has(a.id);
const t7Sh = (a, name) => t7Hero(a) && t7Mods().shape.has(name);
// 초승달 검기 한 발: (x,y) 에서 ang 방향으로 dist 만큼 날아간다
function t7Crescent(a, x, y, ang, dist, o = {}) {
  texFx('e43', x, y, o.color || a.color, { scale: o.scale || 2 / 3, life: o.life || 0.32, rot: ang + (Math.cos(ang) < 0 ? Math.PI : 0), flip: Math.cos(ang) < 0, fade: 0.3, delay: o.delay || 0,
    move: (u) => [Math.cos(ang) * dist * easeOut(u), Math.sin(ang) * dist * easeOut(u)] });
}
// 화면을 가로지르는 일섬 줄 (E11): y 높이, 왼쪽 끝 → 오른쪽 끝
function t7FlashLine(a, y, o = {}) {
  const x0 = a.dir > 0 ? 0 : W, x1 = a.dir > 0 ? W : 0;   // 화면 끝에서 끝까지 (기사가 이미 지나가 있어도)
  skFx(null, o.delay || 0, o.life || 0.42, (u) => swLine(ctx, 'e11', o.color || a.color, Math.min(3, Math.floor(u * 4)), x0, y, mix(x0, x1, easeOut(Math.min(1, u / 0.15))), y,
    { scale: o.scale || 1, alpha: (o.alpha == null ? 1 : o.alpha) * (u < 0.6 ? 1 : (1 - u) / 0.4) }));
}

// ── 검무 회오리 (whirl) ── 기사 주위를 도는 칼날 회오리. 1칸 하나 · ★ 둘(좌우) · ★★ 크게 · ★★★ 크게 + 금빛
//  제자리 폭풍(a_grow): 2배 크기로 제자리 · 쫓는 칼날(a_follow): 회오리가 대상에게 날아가 붙는다
SKILL_FX.whirl = {
  pose(u, a) { const s = Math.sin(u * Math.PI * 10); return { wa: -1.0 + 0.9 * s, wa2: -0.6 - 0.9 * s, skew: 0.12 * s, sy: 1 - 0.04 * Math.abs(s) }; },
  cues: (a) => [[0.01, (a) => {
    const m = a.mast || 0, grow = t7Sh(a, 'grow'), follow = t7Sh(a, 'follow');
    // 크기는 2/3·1·4/3·2 배만 (VFX 규칙). 제자리 폭풍은 한 단계 크게 하나 (★★★ 이면 2배)
    const sc = grow ? (m >= 3 ? 2 : 4 / 3) : m >= 2 ? 1 : 2 / 3, n = m >= 1 && !grow ? 2 : 1, life = a.k.dur;
    const col = m >= 3 ? mixHex(T7_SILVER, MASTERY_GOLD, 0.45) : T7_SILVER;
    for (let j = 0; j < n; j++) {
      const off = n === 2 ? (j ? 22 : -22) : 0;
      swFollow(a, 'e20', life, (u) => {
        const bx = a.x() + off * a.dir, tx = a.tx();
        const x = follow ? mix(bx, tx, easeOut(Math.min(1, u / 0.35))) : bx;
        return [x + Math.sin(u * 30 + j * 3) * 3, groundY() + 2];
      }, { loop: true, fps: 14, anchor: 'b', scale: sc, color: col, fadeIn: 0.12 });
    }
    // 칼날 회오리 ★★ 부터: 발밑 흙먼지
    if (m >= 2) for (let i = 0; i < 10; i++) parts.push({ x: a.x() + rand(-20, 20), y: groundY() - 2, vx: rand(-90, 90), vy: rand(-80, -20), g: 260, size: 2, color: i % 2 ? '#c9b38a' : '#a8946a', life: 0.5, t: 0 });
  }]],
  hitTex(a, t, share, i) {
    const m = a.mast || 0;
    texFx('k13', t.x, t.y, a.color, { scale: m >= 2 ? 1 : 2 / 3, rot: rand(0, Math.PI * 2), life: 0.26, frames: swFrames(6, m), fade: 0.3 });
  },
  kb: 4,
};

// ── 섬광 베기 (flash) ── 일섬 동작 + 마지막 타에 화면 끝까지 그어지는 한 줄 (E11). ★★ 부터 화면 정지가 길다(일섬 연출 그대로)
//  잔상 베기(b_after): 0.5초 뒤 반투명 줄 한 번 더 · 삼중 섬광(b_triple): 위·가운데·아래 세 줄
SKILL_FX.flash = {
  ...SKILL_FX.iaido,
  hit(a, i, n) {
    if (SKILL_FX.iaido.hit) SKILL_FX.iaido.hit(a, i, n);
    if (i !== n - 1 && !t7Sh(a, 'triple')) return;
    if (t7Sh(a, 'triple') && i % 3) return;              // 세 줄은 첫 타 때 한꺼번에
    const y = a.ty(), m = a.mast || 0, sc = m >= 3 ? 4 / 3 : 1;
    if (t7Sh(a, 'triple')) for (const dy of [-14, 0, 14]) t7FlashLine(a, y + dy, { scale: 2 / 3 });
    else t7FlashLine(a, y, { scale: sc });
    if (t7Sh(a, 'after') && i === n - 1) t7FlashLine(a, y + 3, { delay: 0.5, alpha: 0.55, color: '#9a8fb0', scale: sc });
    impact({ stop: 0.08, shake: 0.25 });
  },
};

// ── 비검 (wave) ── 칼끝에서 초승달 검기가 부채꼴로 날아간다: 1칸 1발 · ★ 3발 · ★★ 5발 · ★★★ 7발 금빛. 관통(k_pierce)이면 더 멀리
SKILL_FX.wave = {
  ...SKILL_FX.steelCleave,
  cues: () => [],
  hit(a, i) {
    if (i) return;
    const m = a.mast || 0, n = [1, 3, 5, 7][m], g = gripOf(a), dist = t7Sh(a, 'pierce') ? 300 : 170;
    const y0 = Math.min(g.y, groundY() - 34);   // 가슴 높이에서 쏜다 (칼끝 높이는 내려 베는 자세라 땅에 가깝다)
    for (let j = 0; j < n; j++) {
      const ang = (a.dir > 0 ? 0 : Math.PI) + (n > 1 ? (j / (n - 1) - 0.6) * 0.5 : -0.04) * a.dir;   // 부채꼴은 조금 위로 (땅에 박히지 않게)
      t7Crescent(a, g.x + a.dir * 10, y0, ang, dist, { delay: j * 0.03, scale: m >= 3 ? 1 : 2 / 3 });
    }
    impact({ shake: 0.1 });
  },
  hitTex(a, t) { texFx('e43', t.x, t.y, a.color, { scale: 2 / 3, life: 0.18, flip: a.dir < 0, frames: 3, fade: 0.4 }); },
  marks: null,
};
delete SKILL_FX.wave.marks;

// ── 검기 폭풍 (storm) ── 사방으로 검기: 1칸 4방향 · ★ 8방향 · ★★ 8방향 크게 · ★★★ 12방향 금빛. 분열(k_split)이면 맞은 자리에서 두 갈래
SKILL_FX.storm = {
  ...SKILL_FX.steelCleave,
  cues: () => [],
  hit(a, i) {
    if (i) return;
    const m = a.mast || 0, n = [4, 8, 8, 12][m], cx = a.x(), cy = groundY() - 26, dist = t7Sh(a, 'pierce') ? 150 : 120;
    for (let j = 0; j < n; j++) t7Crescent(a, cx, cy, (j / n) * Math.PI * 2, dist, { scale: m >= 2 ? 1 : 2 / 3, life: 0.36 });
    for (let j = 0; j < 12; j++) parts.push({ x: cx, y: groundY() - 2, vx: rand(-140, 140), vy: rand(-90, -20), g: 260, size: 2, color: j % 2 ? '#c9b38a' : '#a8946a', life: 0.45, t: 0 });
    impact({ stop: 0.05, shake: 0.2 });
  },
  hitTex(a, t, share, i) {
    texFx('e43', t.x, t.y, a.color, { scale: 2 / 3, life: 0.2, rot: rand(-0.6, 0.6), frames: 3, fade: 0.4 });
    if (t7Sh(a, 'split')) for (const s of [-1, 1]) t7Crescent(a, t.x, t.y, s * 0.6 + (a.dir > 0 ? 0 : Math.PI), 60, { scale: 2 / 3, life: 0.25 });
  },
};
delete SKILL_FX.storm.marks;

// ── 융합 ── 두 부모 연출을 잇는다
// 질풍 일섬: 난무(질풍난무 연출) 마지막 타에 화면을 가로지르는 일섬 줄
SKILL_FX.f_ab = {
  ...SKILL_FX.gale,
  hit(a, i, n) {
    SKILL_FX.gale.hit(a, i, n);
    if (i === n - 1) { t7FlashLine(a, a.ty(), { scale: (a.mast || 0) >= 3 ? 4 / 3 : 1 }); impact({ stop: 0.1, shake: 0.3 }); }
  },
};
// 섬광 검기: 일섬이 지나간 줄을 따라 초승달 검기가 남아 차례로 터진다
SKILL_FX.f_bk = {
  ...SKILL_FX.iaido,
  hit(a, i, n) {
    if (SKILL_FX.iaido.hit) SKILL_FX.iaido.hit(a, i, n);
    if (i !== n - 1) return;
    const y = a.ty();
    t7FlashLine(a, y);
    for (let j = 1; j <= 6; j++) {
      const x = a.x() + a.dir * j * 60;
      if (x < 0 || x > W) break;
      texFx('e43', x, y, a.color, { scale: 2 / 3, life: 0.3, delay: 0.12 + j * 0.06, rot: rand(-0.8, 0.8), fade: 0.4 });
    }
  },
};
// 칼날 폭풍: 회오리(검무 회오리 연출)가 도는 동안 타격마다 검기를 사방으로 흩뿌린다
SKILL_FX.f_ak = {
  ...SKILL_FX.whirl,
  hit(a, i) {
    const n = 3 + (a.mast || 0);
    for (let j = 0; j < n; j++) t7Crescent(a, a.x(), groundY() - 26, rand(0, Math.PI * 2), 90, { scale: 2 / 3, life: 0.3 });
  },
};

// ── 궁극기 변형 (천검) ── 천검 연출 위에 덧그린다 (내 기사만)
//  만검: 작은 검선(F04) 수십 개가 사방에서 · 일도양단: 화면을 세로로 가르는 거대한 한 줄(E11 ×2) · 검우: 먹구름에서 초승달 검기가 비처럼
// 궁극기 변형 덧그림: 15줄기 궁극기 모두에 (t7Hero — 내 기사가 그 변형을 찍었을 때만)
for (const ultId of new Set(Object.values(T7_LINES).map((L) => L.sk.ult))) (function () {
  const base = SKILL_FX[ultId];
  if (!base) return;
  const hit0 = base.hit;
  base.hit = function (a, i, n) {
    if (hit0) hit0.call(this, a, i, n);
    if (!t7Hero(a)) return;
    const sh = t7Mods().shape, t = a.targets(i)[0] || { x: a.tx(), y: a.ty() };
    if (sh.has('uvA')) for (let j = 0; j < 4; j++) {
      const x = t.x + rand(-90, 90), y = t.y + rand(-30, 20), ang = rand(0, Math.PI);
      skFx(null, j * 0.02, 0.22, (u) => swLine(ctx, 'f04', a.color, Math.min(3, Math.floor(u * 4)), x - Math.cos(ang) * 22, y - Math.sin(ang) * 22, x + Math.cos(ang) * 22, y + Math.sin(ang) * 22, { alpha: 1 - u }));
    }
    if (sh.has('uvB') && i === n - 1) {
      // 천검이 다 끝난 뒤 한 박자 쉬고: 화면이 어두워지고(천검 ★★★ 꽃잎·검선 위로) 붉은 바깥 줄 + 흰 속 줄이 위에서 땅까지 내려긋는다
      const x = t.x, d = 0.18, yEnd = (u) => mix(-10, groundY() + 6, easeOut(Math.min(1, u / 0.12)));
      skFx(null, d - 0.08, 0.78, (u) => { ctx.globalAlpha = 0.5 * (u < 0.15 ? u / 0.15 : u < 0.6 ? 1 : (1 - u) / 0.4); ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; });
      skFx(null, d, 0.7, (u) => swLine(ctx, 'e11', '#ff3040', Math.min(3, Math.floor(u * 4)), x, -10, x, yEnd(u), { scale: 3, alpha: u < 0.6 ? 1 : (1 - u) / 0.4 }));
      skFx(null, d, 0.7, (u) => swLine(ctx, 'e11', '#fff4f0', Math.min(3, Math.floor(u * 4)), x, -10, x, yEnd(u), { scale: 4 / 3, alpha: u < 0.5 ? 1 : (1 - u) / 0.5 }));
      skLater(a, d, () => { impact({ stop: 0.22, shake: 0.7 }); starFx(x, groundY() - 4, 14, '#ffd0c8', 0.3); });
    }
    if (sh.has('uvK')) for (let j = 0; j < 3; j++) {
      const x = t.x + rand(-140, 140);
      texFx('e43', x, -10, a.color, { scale: 2 / 3, life: 0.4, rot: Math.PI / 2, delay: j * 0.04, fade: 0.25, move: (u) => [rand(-1, 1), (groundY() + 10) * easeIn(u)] });
    }
  };
})();

// ── 변형 노드 연출 (지금 스킬 위에) ──
// 참격파(k_wave): 1차 스킬(검사는 강철 베기) 마지막 타에서 초승달 검기 한 발이 날아간다 — 1차 스킬 5종 모두에
for (const s1 of new Set(Object.values(T7_LINES).map((L) => L.sk.slash))) (function () {
  const base = SKILL_FX[s1];
  if (!base) return;
  const hit0 = base.hit || (() => {});
  base.hit = function (a, i, n) {
    hit0.call(this, a, i, n);
    if (t7Sh(a, 'slashWave') && i === n - 1) { const g = gripOf(a); t7Crescent(a, g.x + a.dir * 16, g.y, a.dir > 0 ? 0 : Math.PI, 200, { scale: 1, life: 0.4 }); }
  };
})();

// 새 스킬·융합 연출: 따로 짠 것(검성)이 없으면 바탕 스킬 연출을 빌린다 — 직업 파일(src/jobs)이 skills.js 뒤에 바탕 연출을 채우는 경우까지 여기서 다시
for (const [id, b] of Object.entries(T7_FX_BASE)) if (!SKILL_FX[id] && SKILL_FX[b]) SKILL_FX[id] = SKILL_FX[b];

// ── 전투 규칙 (core.js·skills.js·world.js 에서 부른다) ──
// 스킬 타격 하나가 끝난 뒤 (skills.js tryCastSkill onHit): 광란 · 잔영 · 만검귀종
function t7OnHit(id, k, i, list, dealt, kills, a, st) {
  // ⚡ 광란: 스킬이 맞힐 때마다 공속 +4% 겹침 (최대 10겹, 3초 안 맞히면 풀린다 — 가속은 knight.haste 틀을 빌린다)
  if (t7Rule('frenzy', id) && dealt > 0) {   // 전설 룬: 끼운 스킬이 맞힐 때 (src/rune.js)
    if (!knight.haste) knight.frenzy = 0;
    knight.frenzy = Math.min(10, (knight.frenzy || 0) + 1);
    knight.haste = { left: 3, v: 0.04 * knight.frenzy };
    if (knight.frenzy === 10 && i === 0) addFloater('🔥 광란 10겹', toScreen(knight.x), groundY() - 84, '#ff6a6a', 12);
  }
  // 🗡️ 잔영: 일섬(마지막 타)으로 처치하면 잔상이 되돌아와 가장 가까운 다른 적을 50% 로 벤다
  if (t7Rule('echo', id) && kills && i === k.hits.length - 1) {   // 전설 룬: 끼운 스킬의 마지막 타로 처치
    const next = monsters.filter((m) => !m.dying && m.hp > 0 && !list.includes(m)).sort((p, q) => aheadDist(knight.x, p.x) - aheadDist(knight.x, q.x))[0];
    if (next) {
      const x = toScreen(next.x) + next.kb, y = monsterMidY(next);
      ghostFx(a, x - 20 * a.dir, a.dir, '#9a8fb0', 0.3, {}, 0.45);
      texFx('k08', x, y, a.color, { life: 0.3, flip: a.dir < 0, fade: 0.35 });
      hitMonster(next, k.hits[i][1] * skillPow(id) * 0.5, { crit: k.crit, kb: 6, color: a.color });
    }
  }
  // 🌙 만검귀종: 검기 스킬이 맞힐 때마다 다른 검기 스킬 쿨 −0.3초
  if (t7Rule('myriad', id) && dealt > 0) for (const o of st.skills) if (o !== id && knight.cds[o] > 0) knight.cds[o] = Math.max(0, knight.cds[o] - 0.3);   // 전설 룬: 끼운 스킬이 맞힐 때 다른 스킬 전부
}
// 시전이 끝날 때 (skills.js onEnd): ⚡ 무한검 — 질풍난무가 끝나면 30% 로 쿨 없이 한 번 더
function t7OnEnd(id) {
  if (t7Rule('endless', id) && Math.random() < 0.3) {   // 전설 룬: 끼운 스킬이 끝나면
    knight.cds[id] = 0;
    addFloater('♾️ 무한검', toScreen(knight.x), groundY() - 84, '#ffe08a', 12);
  }
}
// 평타 한 번 (world.js releaseAttack): 검의 길(3타마다 모든 스킬 쿨 −0.5초) · 심검(평타가 검기로 — 초승달이 날아간다)
function t7OnBasic(st, target) {
  if (t7Rule('blade')) {
    knight.bladeN = ((knight.bladeN || 0) + 1) % 3;
    if (!knight.bladeN) {
      for (const o of st.skills) if (knight.cds[o] > 0) knight.cds[o] = Math.max(0, knight.cds[o] - 0.5);
      starFx(toScreen(knight.x) + 14, groundY() - 34, 8, '#dfe6f0', 0.2);   // 칼끝이 번쩍
    }
  }
  if (t7Mods().stat.rangeMul && target) {
    const x0 = toScreen(knight.x) + 12, x1 = toScreen(target.x) + target.kb, y = monsterMidY(target);
    texFx('e43', x0, y, '#9fd8ff', { scale: 2 / 3, life: 0.2, flip: x1 < x0, fade: 0.3, move: (u) => [(x1 - x0) * u, 0] });
  }
}
