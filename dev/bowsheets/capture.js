'use strict';
// 레인저 계열 캡처 (dev/skills.html 에서 불러 쓴다 — 게임 스크립트를 다 읽은 뒤):
//   const s = document.createElement('script'); s.src = '/dev/bowsheets/capture.js?t=' + Date.now(); document.body.appendChild(s);
//   await bowCapture()   → dev/shots/<이름>.png (8배, 수신기 127.0.0.1:8893 — python -I dev/shot-recv.py 의 포트만 바꾼 것)
// 직업마다 4장 (대기 자세): full 전체 · noacc 망토 뺌 · body 몸만 한 색(tint, 무기 없음) · wpn 무기만(onlyWeapon)
// 원형 마네킹 (망토 없음, 부위색은 dress.py 가 칠한다): mq-bow = 저격수 몸 + 장궁 · mq-xbow = 석궁사수 몸 + 거대 석궁 · mq-siege = 석궁사수 몸 + 공성 석궁(128칸)
//   검사 계열은 검사 몸을 빌렸지만, 활은 쥔 손·팔 자세가 직업 손도트(body2.js)를 따라가서 같은 계열 몸을 빌린다
//   대기 + 시험 자세(가짜 동작 프레임 — 입히기가 자세가 바뀌어도 되는지 보는 용, 최종에는 안 씀): 시위 반·끝, 하늘 겨눔, 걷기 두 칸
// 활에 메긴 화살·석궁의 장전된 살은 빼고 찍는다 (화살·탄은 VFX 가 맡는다)
(function () {
  const IDS = ['ranger', 'marksman', 'arcaneArcher', 'arbalest', 'deadeye', 'voidArcher', 'siegeMaster'];
  const cellOf = (id) => (id === 'siegeMaster' || id === 'mq-siege' ? [128, [58, 116]] : [96, [42, 86]]);
  const TEST = { stand: { mode: 'stand', t: 0.3 }, p6: { mode: 'fight', swing: -1, pull: 6, bowA: 0, t: 0.3 }, p13: { mode: 'fight', swing: -1, pull: 13, bowA: 0, t: 0.3 },
    up: { mode: 'fight', swing: -1, pull: 13, bowA: -0.9, t: 0.3 }, w0: { mode: 'walk', walkT: 0.05, t: 0.3 }, w1: { mode: 'walk', walkT: 0.3, t: 0.3 } };
  async function save(name, id, pose, K = 8) {
    const [cell, foot] = cellOf(name.startsWith('mq-siege') ? 'mq-siege' : id);
    const cv = document.createElement('canvas'); cv.width = cell * K; cv.height = cell * K;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.translate(foot[0] * K, foot[1] * K); g.scale(K / SHEET_DOT, K / SHEET_DOT);
    drawHero(g, id, 0, 0, { facing: 1, ...pose });
    return (await fetch('http://127.0.0.1:8893/save?name=' + encodeURIComponent(name), { method: 'POST', body: cv.toDataURL('image/png') })).text();
  }
  async function four(name, id, pose) {
    const look = CLASSES[id].look, cape = look.cape;
    await save(`${name}-full`, id, pose);
    look.cape = null; await save(`${name}-noacc`, id, pose);
    await save(`${name}-body`, id, { ...pose, tint: '#ff00ff' });
    await save(`${name}-wpn`, id, { ...pose, onlyWeapon: true });
    look.cape = cape;
  }
  window.bowCapture = async function () {
    const orig = drawCrossbow, origB = drawBow, out = [];
    drawCrossbow = (g, w, hx, hy, pull) => orig(g, w, hx, hy, pull, false);
    drawBow = (g, w, hx, hy, pull) => origB(g, w, hx, hy, pull, false);
    try {
      for (const id of IDS) { await four('c-' + id, id, TEST.stand); out.push(id); }
      // 마네킹: 같은 계열 몸(망토 없음)에 원형 무기를 쥐인 임시 직업
      for (const [mq, wpn, from] of [['mq-bow', 'longbow', 'marksman'], ['mq-xbow', 'ballista', 'arbalest'], ['mq-siege', 'siegeBallista', 'arbalest']]) {
        const base = CLASSES[from]; heroPalCache[mq] = null;
        CLASSES[mq] = { ...base, weapon: wpn, look: { ...base.look, cape: null, shield: null } };
        for (const k in TEST) await four(`${mq}-${k}`, mq, TEST[k]);
        delete CLASSES[mq];
        out.push(mq);
      }
    } finally { drawCrossbow = orig; drawBow = origB; }
    return out;
  };
})();
