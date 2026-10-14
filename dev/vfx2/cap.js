'use strict';
// ??2 李쎄린??怨꾩뿴 ?꾪썑 罹≪쿂 (媛쒕컻??. dev/skills.html ??????肄섏넄?먯꽌:
//   await new Promise((ok) => { const s = document.createElement('script'); s.src = 'http://localhost:8872/dev/vfx2/cap.js?t=' + Date.now(); s.onload = ok; document.body.appendChild(s); });
//   await famBasic('after'); await famSkills('after');
// ??肄붾뱶??湲곗? 而ㅻ컠(07c7a9c)??git archive 濡?????ㅻⅨ ?ы듃(8874)濡??꾩슫 媛숈? ?섏씠吏?먯꽌 'before' 濡?遺瑜몃떎.
// 諛쏅뒗 履? dev/shot-recv.py ?щ낯(?ы듃 8873) ??dev/shots/vfx2/. ?대쫫: <tag>-<cls>-m<?숈옉>-<h|p><n> 쨌 <tag>-<skill>-s<?④퀎>-h<?寃?-<off>
window.CAP_PORT = 8882;
window.v2Send = (name, d) => fetch(`http://127.0.0.1:${CAP_PORT}/save?name=${name}`, { method: 'POST', body: d });
window.FAM = {
  basic: ['lancer', 'dragoon', 'halberdier', 'cavalier', 'dragonlord', 'warlord', 'skyGeneral'],
  skills: [['lancer', 'piercingThrust'], ['dragoon', 'dragonFall'], ['dragoon', 'dragonBreath'], ['halberdier', 'whirlwind'], ['halberdier', 'earthSplitter'],
    ['cavalier', 'cavalryCharge'], ['cavalier', 'shieldWall'], ['dragonlord', 'dragonEmperor'], ['warlord', 'worldBreaker'], ['skyGeneral', 'cavalryLegion']],
};
window.v2Btn = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t));

// ?됲?: ?숈옉 0쨌1 ??紐낆쨷 吏곹썑(h1)쨌議곌툑 ??h3)
window.famBasic = async (tag, list = FAM.basic) => {
  window.addFloater = () => {};
  const T = skillTest.state;
  if (T.mode !== 'basic') v2Btn('?됲?留?).click();
  const cv = document.getElementById('c');
  for (const cls of list) for (const motion of [0, 1]) {
    skillTest.setClass(cls);
    T.paused = true; T.auto = true; T.motion = motion;
    for (let i = 0; i < 120; i++) skillTest.step(1 / 60);
    const buf = []; let hitAt = -1;
    for (let i = 0; i < 400; i++) {
      const f0 = monsters[0] ? monsters[0].flash : 0;
      skillTest.step(1 / 60); buf.push(cv.toDataURL('image/png'));
      if (hitAt < 0 && monsters[0] && monsters[0].flash > f0 + 0.001) hitAt = buf.length - 1;
      if (hitAt >= 0 && buf.length - 1 >= hitAt + 4) break;
    }
    for (const k of [-1, 1, 3]) if (buf[hitAt + k]) await v2Send(`${tag}-${cls}-m${motion}-${k < 0 ? 'p' + -k : 'h' + k}`, buf[hitAt + k]);
  }
};

// ?ㅽ궗: ?④퀎 0~3 留덈떎 ??踰??쒖쟾. 怨좊Ⅴ???꾨젅??= ?쒖쟾 1/3 吏??a), 泥??寃?+2(b), 留덉?留??寃?+3(c), ??d)
window.famSkills = async (tag, list = FAM.skills, stages = [0, 1, 2, 3]) => {
  window.addFloater = () => {};
  const T = skillTest.state;
  if (T.mode !== 'skill') v2Btn('???ㅽ궗').click();
  const cv = document.getElementById('c'), errs = [];
  for (const [cls, id] of list) for (const st of stages) {
    T.paused = true; T.auto = false;
    skillTest.setClass(cls); skillTest.setStage(st);
    for (let i = 0; i < 90; i++) skillTest.step(1 / 60);
    try { skillTest.cast(id); } catch (e) { errs.push(id + st + ':' + e.message); continue; }
    const c = castOf('hero'), dur = c ? c.k.dur + (c.k.ward ? c.k.ward.dur : 0) : 1, N = Math.round((dur + 0.9) * 60);
    const buf = [], hits = [];
    for (let i = 0; i < N; i++) {
      const f0 = monsters[0] ? monsters[0].flash : 0;
      try { skillTest.step(1 / 60); } catch (e) { errs.push(id + st + ':' + e.message); break; }
      buf.push(cv.toDataURL('image/png'));
      if (monsters[0] && monsters[0].flash > f0 + 0.001) hits.push(buf.length - 1);
    }
    const pick = { a: Math.round(buf.length * 0.3), b: (hits[0] ?? 20) + 2, c: (hits[hits.length - 1] ?? 40) + 3, d: buf.length - 20 };
    for (const [k, f] of Object.entries(pick)) if (buf[f]) await v2Send(`${tag}-${id}-s${st}-${k}`, buf[f]);
  }
  return errs;
};

// ???쒓컙留? ?쒖쟾 ??at 珥덉뿉 罹붾쾭?????(?대쫫 <tag>-<id>-s<?④퀎>-t<ms>)
window.famAt = async (tag, cls, id, st, ats) => {
  window.addFloater = () => {};
  const T = skillTest.state;
  if (T.mode !== 'skill') v2Btn('???ㅽ궗').click();
  T.paused = true; T.auto = false;
  skillTest.setClass(cls); skillTest.setStage(st);
  for (let i = 0; i < 90; i++) skillTest.step(1 / 60);
  skillTest.cast(id);
  const cv = document.getElementById('c');
  let t = 0;
  for (const at of ats) { while (t < at - 1e-6) { skillTest.step(1 / 60); t += 1 / 60; } await v2Send(`${tag}-${id}-s${st}-t${Math.round(at * 1000)}`, cv.toDataURL('image/png')); }
};
