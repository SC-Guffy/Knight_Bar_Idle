'use strict';
// ⑤-3 전후 캡처 (개발용). dev/skills.html 을 연 뒤 콘솔에서 (옛 코드 서버에서도 이 주소로 불러 쓴다):
//   await new Promise((ok) => { const s = document.createElement('script'); s.src = 'http://127.0.0.1:8873/dev/vfx3/cap3.js?t=' + Date.now(); s.onload = ok; document.body.appendChild(s); });
// 받는 쪽: python -I dev/vfx3/recv.py dev/vfx-survey/vfx3 8883 (CAP_PORT). 피해 숫자는 끈다. 시간은 skillTest.step(1/60) 로만 진행한다.
window.CAP_PORT = window.CAP_PORT || 8883;
const cap3Send = (name, d) => fetch(`http://127.0.0.1:${CAP_PORT}/save?name=${name}`, { method: 'POST', body: d });
// 무대 폭을 720px(게임 360px)로 고정한다 — 창 폭이 달라도 전후 캡처의 배치가 같게 (화면 배율이 2면 캔버스는 1440×600, montage 가 줄여 맞춘다)
const cap3Pin = () => { const st = document.getElementById('stage'); if (st.style.width !== '720px') { st.style.width = '720px'; st.style.maxWidth = '720px'; dispatchEvent(new Event('resize')); } };
const cap3Mode = (want) => { cap3Pin(); const T = skillTest.state; if ((T.mode === 'basic') !== (want === 'basic')) [...document.querySelectorAll('button')].find((b) => b.textContent.includes(want === 'basic' ? '평타만' : '✨ 스킬')).click(); };

// 스킬 한 번 시전: 첫 타격 직전부터 끝까지를 n 장으로 고르게 + 타격마다 맞는 프레임 +2. 이름 <tag>-<id>-s<stage>-<k>
window.cap3Skill = async (cls, id, stage, tag, n = 6) => {
  window.addFloater = () => {};
  cap3Mode('skill');
  const T = skillTest.state; T.paused = true; T.auto = false;
  skillTest.setClass(cls); skillTest.setStage(stage);
  for (let i = 0; i < 90; i++) skillTest.step(1 / 60);
  skillTest.cast(id);
  const cv = document.getElementById('c'), buf = [], hits = [];
  const c = castOf('hero') || { k: { dur: 1 } }, dur = c.k.dur;
  for (let i = 0; i < Math.round((dur + 0.5) * 60); i++) {
    const f0 = monsters[0] ? monsters[0].flash : 0;
    skillTest.step(1 / 60);
    buf.push(cv.toDataURL('image/png'));
    if (monsters[0] && monsters[0].flash > f0 + 0.001) hits.push(buf.length - 1);
  }
  const h0 = Math.max(0, (hits[0] || 10) - 6), h1 = Math.min(buf.length - 1, (hits[hits.length - 1] || buf.length - 1) + 14);
  const pick = new Set();
  for (let k = 0; k < n; k++) pick.add(Math.round(h0 + (h1 - h0) * k / (n - 1)));
  const list = [...pick].sort((a, b) => a - b);
  for (const [k, i] of list.entries()) await cap3Send(`${tag}-${id}-s${stage}-${k}`, buf[i]);
  return { hits, list };
};
// 평타: 맞는 프레임 앞 pre ~ 뒤 post 를 저장 (원거리는 앞 프레임에 날아가는 투사체). 이름 <tag>-basic-<cls>-<k>
window.cap3Basic = async (cls, tag, pre = 3, post = 6, step = 2) => {
  window.addFloater = () => {};
  cap3Mode('basic');
  const T = skillTest.state;
  skillTest.setClass(cls); T.paused = true; T.auto = true;
  const cv = document.getElementById('c'), buf = [];
  for (let i = 0; i < 120; i++) skillTest.step(1 / 60);
  let hitAt = -1;
  for (let i = 0; i < 400; i++) {
    const f0 = monsters[0] ? monsters[0].flash : 0;
    skillTest.step(1 / 60);
    buf.push(cv.toDataURL('image/png'));
    if (hitAt < 0 && monsters[0] && monsters[0].flash > f0 + 0.001) hitAt = buf.length - 1;
    if (hitAt >= 0 && buf.length - 1 >= hitAt + post * step) break;
  }
  let k = 0;
  for (let o = -pre; o <= post; o++) if (buf[hitAt + o * step]) await cap3Send(`${tag}-basic-${cls}-${k++}`, buf[hitAt + o * step]);
  return hitAt;
};
window.CAP3_LIST = [
  ['ranger', 'rapidFire'], ['marksman', 'headshot'], ['marksman', 'armorPiercer'], ['arcaneArcher', 'homingBolts'], ['arcaneArcher', 'starfall'],
  ['arbalest', 'blastBolt'], ['arbalest', 'boltStorm'], ['deadeye', 'sunArrow'], ['voidArcher', 'dimensionCollapse'], ['siegeMaster', 'siegeBarrage'],
];
window.CAP3_CLS = ['ranger', 'marksman', 'arcaneArcher', 'arbalest', 'deadeye', 'voidArcher', 'siegeMaster'];
// 전부: 스킬 10종 × 단계 0~3, 평타 7종
window.cap3All = async (tag) => {
  for (const [cls, id] of CAP3_LIST) for (let s = 0; s <= 3; s++) await cap3Skill(cls, id, s, tag, 6);
  for (const cls of CAP3_CLS) await cap3Basic(cls, tag);
  return 'done';
};
