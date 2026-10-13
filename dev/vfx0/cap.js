'use strict';
// ⑤-0 전후 캡처 도우미 (개발용). dev/skills.html 을 연 뒤 콘솔에서 불러온다:
//   await new Promise((ok) => { const s = document.createElement('script'); s.src = 'vfx0/cap.js?t=' + Date.now(); s.onload = ok; document.body.appendChild(s); });
// 캔버스(#c)를 PNG 로 받는 쪽: python -I dev/shot-recv.py dev/shots (기본 8798, 다른 세션이 쓰면 포트를 바꾼 사본) — CAP_PORT 로 맞춘다
// 피해 숫자는 끈다 (addFloater 를 비운다). 시간은 skillTest.step(1/60) 로만 진행한다.
window.CAP_PORT = window.CAP_PORT || 8799;
const capSend = (name, d) => fetch(`http://127.0.0.1:${CAP_PORT}/save?name=${name}`, { method: 'POST', body: d });

// 평타: 직업 cls 의 동작 motion 을 고정하고, 맞는 프레임(허수아비 번쩍임이 새로 켜진 프레임) 앞 pre ~ 뒤 post 프레임을 저장
//  이름: <tag>-<cls>-m<motion>-p<앞 n> / -h<뒤 n>
window.capSeq = async (cls, tag, motion = 0, pre = 3, post = 7) => {
  window.addFloater = () => {};
  const T = skillTest.state;
  if (T.mode !== 'basic') [...document.querySelectorAll('button')].find((b) => b.textContent.includes('평타만')).click();
  skillTest.setClass(cls);
  T.paused = true; T.auto = true; T.motion = motion;
  const cv = document.getElementById('c'), buf = [];
  for (let i = 0; i < 120; i++) skillTest.step(1 / 60);
  let hitAt = -1;
  for (let i = 0; i < 400; i++) {
    const f0 = monsters[0] ? monsters[0].flash : 0;
    skillTest.step(1 / 60);
    buf.push(cv.toDataURL('image/png'));
    if (hitAt < 0 && monsters[0] && monsters[0].flash > f0 + 0.001) hitAt = buf.length - 1;
    if (hitAt >= 0 && buf.length - 1 >= hitAt + post) break;
  }
  for (let k = -pre; k <= post; k++) if (buf[hitAt + k]) await capSend(`${tag}-${cls}-m${motion}-${k < 0 ? 'p' + -k : 'h' + k}`, buf[hitAt + k]);
  return hitAt;
};

// 스킬: 숙련 단계 stage 로 한 번 시전하고, 타격마다 offs 프레임(맞는 프레임 기준)을 저장. 이름: <tag>-<id>-s<stage>-h<타격>-<off>
window.capSkill = async (cls, id, stage, tag, offs = [-2, 0, 2, 5, 9]) => {
  window.addFloater = () => {};
  const T = skillTest.state;
  if (T.mode !== 'skill') [...document.querySelectorAll('button')].find((b) => b.textContent.includes('✨ 스킬')).click();
  T.paused = true; T.auto = false;
  skillTest.setClass(cls); skillTest.setStage(stage);
  for (let i = 0; i < 90; i++) skillTest.step(1 / 60);
  skillTest.cast(id);
  const cv = document.getElementById('c'), buf = [], hits = [];
  const dur = (castOf('hero') || { k: { dur: 1 } }).k.dur;
  for (let i = 0; i < Math.round((dur + 0.8) * 60); i++) {
    const f0 = monsters[0] ? monsters[0].flash : 0;
    skillTest.step(1 / 60);
    buf.push(cv.toDataURL('image/png'));
    if (monsters[0] && monsters[0].flash > f0 + 0.001) hits.push(buf.length - 1);
  }
  for (const [hi, h] of hits.entries()) for (const o of offs) if (buf[h + o]) await capSend(`${tag}-${id}-s${stage}-h${hi}-${o}`, buf[h + o]);
  return hits;
};

// 프레임 비용: 한 프레임(tick + render) 평균 ms. mode 'basic' 이면 평타 반복, 아니면 skill 을 stage 로 계속 시전
window.capPerf = async (cls, skill = null, stage = 3, frames = 600) => {
  const T = skillTest.state;
  const want = skill ? '✨ 스킬' : '평타만';
  if ((T.mode === 'basic') !== !skill) [...document.querySelectorAll('button')].find((b) => b.textContent.includes(want)).click();
  skillTest.setClass(cls); if (skill) skillTest.setStage(stage);
  T.paused = true; T.auto = true; if (skill) { T.lock = true; T.skill = skill; T.stageCycle = false; }
  for (let i = 0; i < 60; i++) skillTest.step(1 / 60);
  const t0 = performance.now();
  for (let i = 0; i < frames; i++) skillTest.step(1 / 60);
  return +((performance.now() - t0) / frames).toFixed(3);
};
