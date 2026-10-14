'use strict';
// 파이터 계열 원정 런타임: 기(氣) 게이지 충전·소모와 게이지 막대 (docs/specs/boxer-class.md 3·4절·UI).
// 규칙 수치는 src/fighter-data.js 의 QI. 서버(결투·레이드)는 server/duel.js qiReady 가 같은 규칙으로 돈다.
// 원정 코드(world.js fightTick·releaseAttack·dashSkill, skills.js tickSkills·tryCastSkill, procs.js procOnCast)는
// 파이터 직업일 때만 여기 함수를 부른다 — 쿨타임 직업은 그대로다.
//  knight.qi = { v 기 게이지, tj { 투지 기술 id: 투지 칸 }, aw 각성 남은 초, hurtT·hurtN 초당 피격 충전 상한, flash 치명 두 배 번쩍임, key 시작 판 }
//  시작 때 가득: 원정 출발·탑 층·미궁·성벽마다 key 가 바뀌면 기 게이지와 모든 투지 칸을 가득 채운다 (쿨타임 직업이 스킬 준비된 채 시작하는 것과 같다)

const qiOn = () => isQiCls(S.cls);
const qiKey = () => S.phase + ':' + (S.trip ? S.trip.start : '') + ':' + (S.phase === 'tower' && typeof tw !== 'undefined' && tw ? tw.idx : '');
function qiSt() {
  const key = qiKey(), q = knight.qi;
  if (q && q.cls === S.cls && (q.key === key || S.phase === 'returning' || S.phase === 'camp')) return q;
  const Q = QI[S.cls], tj = {};
  for (const id in Q.need) tj[id] = qiNeed(id);
  return (knight.qi = { cls: S.cls, key, v: Q.max, tj, aw: 0, hurtT: -1, hurtN: 0, flash: 0, red: 0, log: [] });
}
// 지금 소모량(주 기술) · 문턱(투지 기술) — 기 절약(☯️) 반영
const qiNeed = (id) => qiCostOf(SKILLS[id], S.cls, skillBonus(id));
const qiMain = (id) => qiIsMain(id, S.cls);
// 충전: 각성 중이면 두 배, 최대치에서 멈춘다
function qiAdd(n) {
  if (!(n > 0)) return;
  const q = qiSt();
  q.v = Math.min(QI[S.cls].max, q.v + n * (q.aw > 0 ? QI_AWAKEN.mult : 1));
}
// 평타가 맞았다: n 마리 (킥복서는 함께 맞힌 적 한 마리당 multi), crit 첫 대상이 치명 (스트라이커는 critX 배)
function qiOnBasic(n, crit) {
  if (!qiOn() || n <= 0) return;
  const Q = QI[S.cls], q = qiSt();
  let g = Q.hit || 0;
  if (Q.critX && crit) { g *= Q.critX; q.red = 0.25; }          // 치명 두 배 충전: 막대가 붉게 번쩍 (떠오르는 글자는 띄우지 않는다 — 너무 잦다)
  if (Q.multi) g += Q.multi * (Math.min(n, Q.multiMax || 3) - 1);
  qiAdd(g);
}
// 맞았다: hurt (초당 hurtCap 까지). 기막 보호막 동안은 qiHurt 배
function qiOnHurt() {
  if (!qiOn()) return;
  const Q = QI[S.cls], q = qiSt();
  if (!Q.hurt) return;
  const sec = Math.floor(clock);
  if (sec !== q.hurtT) { q.hurtT = sec; q.hurtN = 0; }
  const x = knight.ward && knight.ward.qiHurt ? knight.ward.qiHurt : 1, n = Math.min(Q.hurt * x, Q.hurtCap * x - q.hurtN);
  if (n > 0) { q.hurtN += n; qiAdd(n); }
}
// 돌진한 거리(px) (킥복서)
function qiOnDash(px) { if (qiOn() && QI[S.cls].dashPx) qiAdd(px * QI[S.cls].dashPx); }
// 한 프레임: 각성 시간, 교전 중 초당 충전 (걷는 동안·시전 중엔 멈춘다)
function qiTick(dt) {
  const q = qiSt(), Q = QI[S.cls];
  if (q.aw > 0) q.aw = Math.max(0, q.aw - dt);
  q.flash = Math.max(0, q.flash - dt);
  q.red = Math.max(0, q.red - dt);
  if (Q.perSec && knight.fighting && !castOf('hero')) qiAdd(Q.perSec * dt);
}
// 지금 쓸 수 있는가. dash: 돌진기로 달려붙을 때 (킥복서가 남겨 두는 1칸 keep 을 쓴다)
function qiCan(id, dash = false) {
  const q = qiSt();
  if (!qiMain(id)) return (q.tj[id] || 0) >= qiNeed(id);
  return q.v >= qiNeed(id) + (dash ? 0 : QI[S.cls].keep || 0);
}
// 고를 순서: 투지 기술 먼저, 그다음 주 기술 (각각 해금 레벨 높은 것부터 — st.skills 순서)
const qiOrder = (st) => [...st.skills.filter((id) => !qiMain(id)), ...st.skills.filter((id) => qiMain(id))];
// 장풍 3단: 기가 가득이면 시전 시간·폭발이 커진 모양으로 쏜다 (위력은 qiCast 의 배수)
function qiShape(id, k) {
  if (id !== 'palmBlast' || !qiOn() || qiSt().v < QI[S.cls].max) return k;
  return { ...k, dur: k.dur + 0.2, q3: true, radius: 60, hits: k.hits.map((h) => (h[2] && h[2].radius ? [h[0], h[1], { ...h[2], radius: 60 }] : h)) };
}
// 쓴다: 소모·문턱만큼 빼고, 쓴 기만큼 모든 투지 칸을 채운다. 위력 배수를 돌려준다 (장풍 3단 QI_PALM3). 궁극기는 각성
function qiCast(id) {
  const q = qiSt(), k = SKILLS[id];
  let mul = 1;
  if (!qiMain(id)) q.tj[id] = (q.tj[id] || 0) - qiNeed(id);
  else {
    let spend = qiNeed(id);
    if (id === 'palmBlast' && q.v >= QI[S.cls].max) { spend *= 1.5; mul = QI_PALM3; }
    q.v = Math.max(0, q.v - spend);
    for (const o in q.tj) q.tj[o] += spend;
  }
  if (k.ult) { q.aw = QI_AWAKEN.dur + k.dur; q.flash = 0.4; }
  q.log.push({ t: +clock.toFixed(2), id, v: Math.round(q.v), mul });
  if (q.log.length > 40) q.log.shift();
  return mul;
}
// 🔁 환급(refund): 처치마다 소모량(문턱)의 frac 를 돌려받는다 · ✨ 순환(chain): 다른 투지 칸을 각 문턱의 frac, 기 게이지를 주 기술 소모량의 frac
function qiRefund(id, frac) { const q = qiSt(); if (qiMain(id)) qiAdd(qiNeed(id) * frac); else q.tj[id] += qiNeed(id) * frac; }
function qiChain(id, frac) {
  const q = qiSt(), Q = QI[S.cls];
  for (const o in q.tj) if (o !== id) q.tj[o] += qiNeed(o) * frac;
  const main = Object.keys(Q.main)[0];
  if (main) qiAdd(qiNeed(main) * frac);
}
// 고유 발동 cdreset(우로보로스): 기 게이지 최대치의 50% 를 바로
function qiReset() { qiAdd(QI[S.cls].max * QI_CDRESET); qiSt().flash = 0.3; }
// 스킬 칸에 덮는 "아직 모자란 비율" (0 = 준비됨)
function qiLack(id) {
  const q = qiSt(), need = qiNeed(id);
  if (!qiMain(id)) return Math.max(0, Math.min(1, (need - (q.tj[id] || 0)) / need));
  return Math.max(0, Math.min(1, (need + (QI[S.cls].keep || 0) - q.v) / (need + (QI[S.cls].keep || 0))));
}

// ── 게이지 막대 (스킬 칸 줄 바로 아래, 높이 3px, 직업색) ──
//  bar: 한 줄, 가득 차면 금빛으로 깜빡 · 스트라이커 치명 두 배 충전은 붉게 번쩍
//  cells: 3칸 (1px 틈), 돌진용으로 남긴 첫 칸은 테두리만 밝게
//  tiers: 3단 (연보라 → 하늘 → 흰빛), 2단 눈금 위 ▼ (쏘는 지점)
//  각성 중: 막대 전체가 금빛, 남은 6초가 위에 가늘게 줄어든다
function qiDrawBar(x, y, w) {
  if (!qiOn()) return;
  const q = qiSt(), Q = QI[S.cls], fx = CLASSES[S.cls].look.fx, h = 3, gold = '#ffd257';
  const awake = q.aw > 0, full = q.v >= Q.max;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  if (Q.shape === 'bar') {
    const f = q.v / Q.max;
    ctx.fillStyle = awake ? gold : full ? (Math.sin(clock * 10) > 0 ? gold : fx) : fx;
    ctx.fillRect(x, y, Math.round(w * f), h);
    if (q.red > 0) { ctx.globalAlpha = q.red / 0.25; ctx.fillStyle = '#ff3a2a'; ctx.fillRect(x, y, Math.round(w * f), h); ctx.globalAlpha = 1; }
  } else {
    const n = Q.max / Q.cell, cw = (w - (n - 1)) / n;
    const TIER = ['#a8b4ff', '#8fd8ff', '#f4f8ff'];
    for (let i = 0; i < n; i++) {
      const cx = x + i * (cw + 1), f = Math.max(0, Math.min(1, (q.v - i * Q.cell) / Q.cell));
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(cx, y, cw, h);
      ctx.fillStyle = awake ? gold : Q.shape === 'tiers' ? TIER[i] : fx;
      ctx.fillRect(cx, y, Math.round(cw * f), h);
      if (Q.keep && i === 0 && f >= 1 && !awake) { ctx.fillStyle = '#ffffff'; ctx.fillRect(cx, y - 1, cw, 1); ctx.fillRect(cx, y + h, cw, 1); }
    }
    if (Q.shape === 'tiers') {          // 2단 눈금 위 ▼ (쏘는 지점)
      const mx = Math.round(x + 2 * (cw + 1) - 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(mx - 1, y - 3, 3, 1); ctx.fillRect(mx, y - 2, 1, 1);
    }
  }
  if (awake) { ctx.fillStyle = gold; ctx.fillRect(x, y - 2, Math.round(w * Math.min(1, q.aw / QI_AWAKEN.dur)), 1); }
  if (q.flash > 0) { ctx.globalAlpha = q.flash / 0.4; ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w, h); }
  ctx.restore();
}
