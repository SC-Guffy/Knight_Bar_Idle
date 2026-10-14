'use strict';
// ⑤-1 전후 캡처 (개발용). dev/skills.html 을 연 뒤 콘솔에서 불러온다:
//   await new Promise((ok) => { const s = document.createElement('script'); s.src = 'vfx1/cap.js?t=' + Date.now(); s.onload = ok; document.body.appendChild(s); });
// 받는 쪽: python -I dev/vfx1/recv.py dev/vfx-survey/vfx1/raw 8891 (CAP1_PORT). 피해 숫자는 끈다. 시간은 skillTest.step(1/60) 로만 진행한다.
// 이름은 조사 캡처(dev/vfx-survey/<id>-{a,b,c,l1}.png)와 같게 하고 끝에 -after:
//   a = 첫 타격 10프레임 전(준비) · b = 막타 3프레임 뒤(가장 화려한 순간) · c = 막타 24프레임 뒤(여운) · l1 = Lv1 첫 타격 2프레임 뒤
window.CAP1_PORT = window.CAP1_PORT || 8891;
const cap1Send = (name, d) => fetch(`http://127.0.0.1:${CAP1_PORT}/save?name=${name}`, { method: 'POST', body: d });

// 한 번 시전하며 모든 프레임을 담고, 타격 프레임(허수아비 번쩍임이 새로 켜진 프레임) 번호를 돌려준다
function cap1Run(cls, id, stage) {
  window.addFloater = () => {};
  const T = skillTest.state;
  if (T.mode !== 'skill') [...document.querySelectorAll('button')].find((b) => b.textContent.includes('✨ 스킬')).click();
  T.paused = true; T.auto = false;
  skillTest.setClass(cls); skillTest.setStage(stage);
  for (let i = 0; i < 90; i++) skillTest.step(1 / 60);
  skillTest.cast(id);
  const cv = document.getElementById('c'), buf = [], hits = [];
  const dur = (castOf('hero') || { k: { dur: 1 } }).k.dur;
  for (let i = 0; i < Math.round((dur + 0.9) * 60); i++) {
    const f0 = monsters[0] ? monsters[0].flash : 0;
    skillTest.step(1 / 60);
    floaters.length = 0;
    buf.push(cv.toDataURL('image/png'));
    if (monsters[0] && monsters[0].flash > f0 + 0.001) hits.push(buf.length - 1);
  }
  return { buf, hits };
}
window.cap1Skill = async (cls, id, tag = 'after') => {
  const out = [];
  {
    const { buf, hits } = cap1Run(cls, id, 3);
    const h0 = hits[0] != null ? hits[0] : 30, hl = hits.length ? hits[hits.length - 1] : buf.length - 30;
    for (const [k, i] of [['a', h0 - 10], ['b', hl + 3], ['c', hl + 24]]) { const f = buf[Math.max(0, Math.min(buf.length - 1, i))]; await cap1Send(`${id}-${k}-${tag}`, f); out.push(k); }
    // 타격마다 3프레임 뒤 (전 과정 보기용)
    for (const [j, h] of hits.entries()) if (j < 12) await cap1Send(`${id}-s3-h${j}-${tag}`, buf[Math.min(buf.length - 1, h + 3)]);
  }
  for (const st of [0, 1, 2]) {
    const { buf, hits } = cap1Run(cls, id, st);
    const h0 = hits[0] != null ? hits[0] : 30, hl = hits.length ? hits[hits.length - 1] : h0;
    await cap1Send(st === 0 ? `${id}-l1-${tag}` : `${id}-s${st}-${tag}`, buf[Math.min(buf.length - 1, (st === 0 ? h0 : hl) + 2)]);
  }
  return out;
};
// 평타: 맞는 프레임 앞 6(날아가는 중) · 맞는 프레임 +2 · +6 를 저장. 이름 basic-<cls>-{a,b,c}-after
window.cap1Basic = async (cls, tag = 'after', motion = 0) => {
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
    floaters.length = 0;
    buf.push(cv.toDataURL('image/png'));
    if (hitAt < 0 && monsters[0] && monsters[0].flash > f0 + 0.001) hitAt = buf.length - 1;
    if (hitAt >= 0 && buf.length - 1 >= hitAt + 8) break;
  }
  for (const [k, o] of [['a', -4], ['b', 1], ['c', 5]]) if (buf[hitAt + o]) await cap1Send(`basic-${cls}-${k}-${tag}`, buf[hitAt + o]);
  return hitAt;
};
window.CAP1_SKILLS = [['mage', 'manaBurst'], ['pyromancer', 'meteor'], ['pyromancer', 'flameVortex'], ['cryomancer', 'iceLance'], ['cryomancer', 'blizzard'],
  ['electromancer', 'chainLightning'], ['electromancer', 'thunderstorm'], ['archmage', 'apocalypse'], ['frostlord', 'absoluteZero'], ['thunderEmperor', 'thunderJudgment']];
window.CAP1_CLS = ['mage', 'pyromancer', 'cryomancer', 'electromancer', 'archmage', 'frostlord', 'thunderEmperor'];
window.cap1All = async () => {
  for (const [c, id] of CAP1_SKILLS) await cap1Skill(c, id);
  for (const c of CAP1_CLS) await cap1Basic(c);
  return 'done';
};
