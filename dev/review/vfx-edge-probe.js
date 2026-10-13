'use strict';
// 하단바 양 끝 밝기 측정 (docs/specs/vfx-rule-fixes.md 수용 기준). dev/skills.html?patch=vfx-edge-probe 로 불러온다.
//  probe(직업, 스킬, 단계) → 시전 전 20프레임 평균 대비, 시전 동안 양 끝 40px(게임 px) 평균 밝기의 최대 변화 { L, R, worst, wf(프레임) }
//  probeAll(단계) → 궁극기를 뺀 스킬 전부. 기준: |변화| ≤ 0.05
//  snapAt(직업, 스킬, 프레임, 이름, 수신 포트) → 그 프레임을 피해 숫자 없이 PNG 로 수신기(dev/shot-recv.py)에 보낸다
// 밝기는 투명 픽셀을 회색(0.5) 바탕에 얹어 계산한다 (실제 게임은 바탕화면 위라서 덮개가 생기면 변화로 잡힌다)
(() => {
  const ready = () => window.skillTest;
  const setup = (cls, stage) => {
    const T = skillTest.state; T.auto = false; T.paused = true; T.allCls = false; T.mode = 'skill';
    skillTest.setClass(cls); skillTest.setStage(stage); skillTest.step(1.2);
  };
  window.probe = (cls, id, stage = 3) => {
    setup(cls, stage);
    const c = document.getElementById('c'), g = c.getContext('2d'), e = Math.round(40 * c.width / W);
    const f = (x) => { const d = g.getImageData(x, 0, e, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) { const a = d[i + 3] / 255, l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; s += a * l + (1 - a) * 0.5; } return s / (d.length / 4); };
    const lum = () => [f(0), f(c.width - e)];
    const b = [0, 0]; for (let i = 0; i < 20; i++) { skillTest.step(1 / 60); const v = lum(); b[0] += v[0] / 20; b[1] += v[1] / 20; }
    skillTest.cast(id);
    const k = SKILLS[id], n = Math.round((k.dur + 1.5 + (k.ward ? k.ward.dur : 0)) * 60);
    let worst = 0, wf = -1, mL = 0, mR = 0;
    for (let i = 0; i < n; i++) {
      skillTest.step(1 / 60);
      const v = lum(), dl = v[0] - b[0], dr = v[1] - b[1];
      if (Math.abs(dl) > Math.abs(mL)) mL = dl;
      if (Math.abs(dr) > Math.abs(mR)) mR = dr;
      const w = Math.max(Math.abs(dl), Math.abs(dr)); if (w > worst) { worst = w; wf = i; }
    }
    return { id, L: +mL.toFixed(3), R: +mR.toFixed(3), worst: +worst.toFixed(3), wf };
  };
  window.probeAll = (stage = 3) => Object.values(SKILLS).filter((k) => !k.ult).map((k) => { try { return probe(k.cls, k.id, stage); } catch (e) { return { id: k.id, err: String(e) }; } });
  window.snapAt = async (cls, id, frame, name, port = 8834) => {
    setup(cls, 3); skillTest.step(20 / 60);
    skillTest.cast(id); for (let i = 0; i <= frame; i++) skillTest.step(1 / 60);
    floaters.length = 0; render();
    const url = document.getElementById('c').toDataURL('image/png');
    return (await fetch(`http://127.0.0.1:${port}/save?name=${name}`, { method: 'POST', body: url })).text();
  };
  const send = async (name, port, hideMon = false) => {
    floaters.length = 0;
    const mon = hideMon ? monsters.splice(0) : [];   // 허수아비가 타격 섬광을 가리지 않게 찍는 순간만 뺀다
    render(); monsters.push(...mon);
    const url = document.getElementById('c').toDataURL('image/png');
    return (await fetch(`http://127.0.0.1:${port}/save?name=${name}`, { method: 'POST', body: url })).text();
  };
  // 평타: 연속기 0번 동작을 공격 간격대로 치다가 pred() 가 처음 참인 프레임을 찍는다
  //  예) 타격 섬광: () => knight.swing >= HERO_ATK[WEAPONS[CLASSES[cls].weapon].id][0].burst[0] + 0.03
  window.snapBasic = async (cls, name, pred, port = 8834, hideMon = false) => {
    duelPlay = null;
    const T = skillTest.state; T.mode = 'basic'; T.auto = true; T.paused = true; T.allCls = false; T.motion = 0;
    skillTest.setClass(cls); skillTest.step(0.5);
    for (let i = 0; i < 400; i++) { skillTest.step(1 / 60); if (pred()) return send(name, port, hideMon); }
    return 'not found';
  };
  // 평타 타격 섬광(drawAtkFx burst)만 크게: 섬광 구간에서 섬광이 가장 넓게 그려진 프레임을 골라, 섬광 둘레를 잘라 4배로 찍는다
  //  (섬광을 끄고 다시 그린 그림과 비교해 섬광이 칠한 영역을 찾는다)
  window.snapBurst = async (cls, name, port = 8834) => {
    duelPlay = null;
    const T = skillTest.state; T.mode = 'basic'; T.auto = true; T.paused = true; T.allCls = false; T.motion = 0;
    skillTest.setClass(cls); skillTest.step(0.5);
    const c = document.getElementById('c'), g = c.getContext('2d'), orig = window.drawAtkFx;
    const at = HERO_ATK[WEAPONS[CLASSES[cls].weapon].id][0].burst[0];
    let s = -1, best = null;
    window.drawAtkFx = function (g2, w, r, atk) { s = atk.s; return orig.apply(this, arguments); };
    for (let i = 0; i < 180; i++) {
      skillTest.step(1 / 60);
      if (s < at || s >= at + 0.16) { if (best && s < at) break; continue; }
      const mon = monsters.splice(0); floaters.length = 0;
      render(); const A = g.getImageData(0, 0, c.width, c.height);
      window.drawAtkFx = () => {}; render(); const B = g.getImageData(0, 0, c.width, c.height).data;
      window.drawAtkFx = function (g2, w, r, atk) { s = atk.s; return orig.apply(this, arguments); };
      monsters.push(...mon);
      let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let p = 0; p < B.length; p += 4) if (A.data[p] !== B[p] || A.data[p + 1] !== B[p + 1] || A.data[p + 2] !== B[p + 2] || A.data[p + 3] !== B[p + 3]) { const q = p / 4, x = q % c.width, y = (q / c.width) | 0; if (y > c.height - 40) continue; n++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      if (n && (!best || n > best.n)) best = { n, img: A, box: [x0, y0, x1, y1] };
    }
    window.drawAtkFx = orig;
    if (!best) return 'not found';
    const [x0, y0, x1, y1] = best.box, m = 24, bx = Math.max(0, x0 - m), by = Math.max(0, y0 - m), bw = Math.min(c.width - bx, x1 - x0 + m * 2), bh = Math.min(c.height - by, y1 - y0 + m * 2);
    const src = document.createElement('canvas'); src.width = c.width; src.height = c.height; src.getContext('2d').putImageData(best.img, 0, 0);
    const out = document.createElement('canvas'); out.width = bw * 4; out.height = bh * 4;
    const o = out.getContext('2d'); o.imageSmoothingEnabled = false; o.fillStyle = '#3c3c46'; o.fillRect(0, 0, out.width, out.height);
    o.drawImage(src, bx, by, bw, bh, 0, 0, out.width, out.height);
    return (await fetch(`http://127.0.0.1:${port}/save?name=${name}`, { method: 'POST', body: out.toDataURL('image/png') })).text();
  };
  // 결투:dev/review/vfx-rule-fixes/duel-sample.json (server/duel.js simulateDuel 결과에서 평타만 남김) 을 두 직업으로 재생하고
  //  side 쪽 평타가 날아가는 중간(0.07초)을 찍는다
  window.snapDuel = async (clsA, clsB, side, name, port = 8834, base = '') => {
    const res = await (await fetch(base + 'review/vfx-rule-fixes/duel-sample.json', { cache: 'no-store' })).json();
    res.me.cls = clsA; res.opponent.cls = clsB;
    const T = skillTest.state; T.mode = 'basic'; T.auto = false; T.paused = true; T.allCls = false;
    monsters.length = 0; playDuel(res, () => {});
    for (let i = 0; i < 900; i++) { skillTest.step(1 / 60); const L = duelPlay && duelPlay.last[side]; if (L && clock - L.at >= 0.07) return send(name, port); }
    return 'not found';
  };
  window.FIX11 = { gale: 'blademaster', iaido: 'blademaster', headshot: 'marksman', starfall: 'arcaneArcher', wideCleave: 'greatswordsman', ramCharge: 'greatswordsman', cavalryCharge: 'cavalier', blastBolt: 'arbalest', boltStorm: 'arbalest', chainLightning: 'electromancer', thunderstorm: 'electromancer' };
  if (!ready()) console.warn('vfx-edge-probe: skillTest 가 아직 없다');
})();
