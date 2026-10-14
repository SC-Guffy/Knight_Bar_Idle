'use strict';
// ⑤-4 검사 계열 전후 캡처 (개발용). dev/skills.html 을 연 뒤 콘솔에서:
//   await new Promise((ok) => { const s = document.createElement('script'); s.src = 'vfx0/cap.js?t=' + Date.now(); s.onload = ok; document.body.appendChild(s); });
//   await new Promise((ok) => { const s = document.createElement('script'); s.src = 'vfx4/cap.js?t=' + Date.now(); s.onload = ok; document.body.appendChild(s); });
//   CAP_PORT = 8875; await capKey('paladin', 'judgment', 3, 'before')
// 받는 쪽: dev/shot-recv.py 를 포트만 바꾼 사본 (CAP_PORT). 피해 숫자는 끈다.
// 한 번 시전하며 매 프레임을 기억해 두고, 장면 셋을 고른다:
//   a = 첫 타격 2프레임 전 / b = 화면 변화가 가장 큰 타격 프레임(+2) / c = 마지막 타격 8프레임 뒤 / l = (stage 0 이면) 첫 타격 +2
window.SWORD_SKILLS = {
  paladin: ['judgment', 'sanctuary'], blademaster: ['gale', 'iaido'], greatswordsman: ['wideCleave', 'ramCharge'],
  archon: ['starJudgment'], swordsaint: ['thousandCuts'], tyrant: ['skyBreak'],
};
const capSend4 = (name, d) => fetch(`http://127.0.0.1:${CAP_PORT}/save?name=${name}`, { method: 'POST', body: d });
window.capKey = async (cls, id, stage, tag) => {
  window.addFloater = () => {};
  const T = skillTest.state;
  if (T.mode !== 'skill') [...document.querySelectorAll('button')].find((b) => b.textContent.includes('✨ 스킬')).click();
  T.paused = true; T.auto = false;
  skillTest.setClass(cls); skillTest.setStage(stage);
  for (let i = 0; i < 90; i++) skillTest.step(1 / 60);
  skillTest.cast(id);
  const cv = document.getElementById('c'), g = cv.getContext('2d'), buf = [], hits = [], lum = [];
  const c0 = castOf('hero'), dur = (c0 || { k: { dur: 1 } }).k.dur + ((c0 && c0.k.ward) ? c0.k.ward.dur * 0.5 : 0);
  for (let i = 0; i < Math.round((dur + 0.8) * 60); i++) {
    const f0 = monsters[0] ? monsters[0].flash : 0;
    skillTest.step(1 / 60);
    buf.push(cv.toDataURL('image/png'));
    // 화면 변화량 (아래로 줄인 밝기 합) — b 장면 고르기용
    const d = g.getImageData(0, 0, cv.width, cv.height).data; let s = 0;
    for (let k = 0; k < d.length; k += 64) s += d[k] + d[k + 1] + d[k + 2];
    lum.push(s);
    if (monsters[0] && monsters[0].flash > f0 + 0.001) hits.push(buf.length - 1);
  }
  const base = lum[0], pick = {};
  if (hits.length) {
    pick.a = Math.max(0, hits[0] - 2);
    let best = hits[0], bv = -1;
    for (const h of hits) { const v = Math.abs(lum[Math.min(lum.length - 1, h + 2)] - base); if (v > bv && v < base * 1.8) { bv = v; best = h; } }
    pick.b = Math.min(buf.length - 1, best + 2);
    pick.c = Math.min(buf.length - 1, hits[hits.length - 1] + 8);
  } else { pick.a = 20; pick.b = Math.floor(buf.length / 2); pick.c = buf.length - 10; }
  for (const [k, i] of Object.entries(pick)) await capSend4(`${tag}-${id}-s${stage}-${k}`, buf[i]);
  return { hits, pick };
};
// 한 시전의 지정 프레임(시전 시작 기준 초) 들을 저장 — 텍스처 하나하나 확인용
window.capAt = async (cls, id, stage, tag, secs) => {
  window.addFloater = () => {};
  const T = skillTest.state;
  if (T.mode !== 'skill') [...document.querySelectorAll('button')].find((b) => b.textContent.includes('✨ 스킬')).click();
  T.paused = true; T.auto = false;
  skillTest.setClass(cls); skillTest.setStage(stage);
  for (let i = 0; i < 90; i++) skillTest.step(1 / 60);
  skillTest.cast(id);
  const cv = document.getElementById('c'), want = secs.map((s) => Math.round(s * 60));
  for (let i = 1; i <= Math.max(...want); i++) {
    skillTest.step(1 / 60);
    const j = want.indexOf(i);
    if (j >= 0) await capSend4(`${tag}-${id}-s${stage}-t${Math.round(secs[j] * 100)}`, cv.toDataURL('image/png'));
  }
};
// 시전 예외 점검: 직업 목록(기본 = 전 직업)의 스킬마다 단계 0~3 을 한 번씩 시전하며 프레임마다 tick + render. 예외 목록을 돌려준다
window.castCheck = (classes = Object.keys(CLASSES).filter((c) => skillsOf(c).length)) => {
  const T = skillTest.state, errs = [];
  if (T.mode !== 'skill') [...document.querySelectorAll('button')].find((b) => b.textContent.includes('✨ 스킬')).click();
  T.paused = true; T.auto = false;
  let n = 0;
  for (const cls of classes) {
    skillTest.setClass(cls);
    const ids = skillsOf(cls).map((k) => k.id);
    for (const id of ids) for (const st of [0, 1, 2, 3]) {
      try {
        skillTest.setStage(st); skillTest.cast(id);
        const c = castOf('hero'), dur = c ? c.k.dur + (c.k.ward ? c.k.ward.dur : 0) + 1 : 1;
        for (let i = 0; i < dur * 60; i++) skillTest.step(1 / 60);
        n++;
      } catch (e) { errs.push(`${cls}/${id}/${st}: ${e.message}`); }
    }
  }
  return { casts: n, errs };
};
// 계열 전체: 스킬마다 단계 0~3 의 a·b·c
window.capFamily = async (tag, stages = [0, 1, 2, 3]) => {
  const out = {};
  for (const [cls, ids] of Object.entries(SWORD_SKILLS)) for (const id of ids) for (const st of stages) out[`${id}-${st}`] = await capKey(cls, id, st, tag);
  return out;
};
