'use strict';
// 키 1.3배 시트 점검 (docs/specs/legacy-class-sheets.md "게임 안 키 1.3배"). dev/skills.html?patch=sheet-tall-probe 로 불러오거나,
//  레이드는 ui.js 가 필요해서 실제 게임(index.html?server=http://127.0.0.1:9) 콘솔에서 이 파일을 <script> 로 붙여 쓴다.
//  새 그림이 나오기 전에, 지금 있는 시트(src/sprites/<cls>.png)를 배율만큼 키운 임시 시트를 만들어 끼우고
//  머리 위 이름표·체력바(heroTop)·결투·레이드 4인이 겹치거나 잘리는지 본다. 게임 파일은 바꾸지 않는다 (이 페이지 안에서만).
//  콘솔:
//    await tallOn(['paladin', 'swordsman', 'blademaster', 'greatswordsman'], 1.3)   // 임시 시트 켜기 → 직업별 { heroTop, 머리 위 y }
//    tallCheck()                                  // 직업마다 대기·평타·시전 프레임의 머리 위가 heroTop(체력바) 아래인지 → 어긋난 프레임 목록
//    await tallSnap('duel', 'paladin-tyrant')     // dev/sheets-sword/work/duels.json 의 결투를 재생해 화면을 127.0.0.1:8981 로 저장
//    await tallSnap('raid')                       // dev/sheets-sword/work/raid.json 의 4인 레이드
(function () {
  // 레이드 재생이 ui.js 의 clsOf 를 쓰는데 이 페이지는 ui.js 를 안 불러온다
  if (typeof clsOf === 'undefined') window.clsOf = (id) => CLASSES[id] || CLASSES.squire;
  const ORIG = {};
  window.tallOn = async (ids, k = 1.3) => {
    const out = {};
    for (const id of ids) {
      const m0 = ORIG[id] || (ORIG[id] = SHEET_META[id]);
      if (!m0) { out[id] = 'no sheet'; continue; }
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = '/src/sprites/' + id + '.png?t=' + Date.now(); });
      const W = m0.w || 64, H = m0.h || 64, nW = Math.round(W * k), nH = Math.round(H * k);
      const cols = Math.round(img.naturalWidth / W), rows = Math.round(img.naturalHeight / H);
      const cv = document.createElement('canvas'); cv.width = cols * nW; cv.height = rows * nH;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g.drawImage(img, c * W, r * H, W, H, c * nW, r * nH, nW, nH);
      const ft = m0.foot || [32, 58], sc = (p) => [Math.round(p[0] * k), Math.round(p[1] * k), Math.round(p[2] * k), Math.round(p[3] * k)];
      const pts = {}; for (const a in m0.pts) pts[a] = m0.pts[a].map(sc);
      SHEET_META[id] = { ...m0, w: nW, h: nH, foot: [Math.round(ft[0] * k), Math.round(ft[1] * k)], pts };
      SHEETS[id] = { meta: SHEET_META[id], img: cv, ok: true, tint: new Map() };
      cv.naturalWidth = cv.width; cv.naturalHeight = cv.height;      // sheetTinted 가 읽는다
      cv.complete = true;
      SHEET_ON[id] = true;
      const hy = Math.min(...pts.idle.map((p) => p[3]));
      out[id] = { heroTop: heroTop(id), headAboveGround: Math.round((SHEET_META[id].foot[1] - hy) * SHEET_DOT) };
    }
    return out;
  };
  // 프레임마다 머리 위(head 점)가 체력바(heroTop) 아래에 있는지. 평타·시전은 몸이 들려도 체력바는 대기 키 기준이라 얼마나 넘는지 본다
  window.tallCheck = () => {
    const out = {};
    for (const id in ORIG) {
      const m = SHEET_META[id], top = heroTop(id), bad = [];
      for (const a of Object.keys(m.pts)) m.pts[a].forEach((p, f) => {
        const up = (m.foot[1] - p[3]) * SHEET_DOT;
        if (up > top - 2) bad.push(`${a}#${f} +${Math.round(up - top + 2)}px`);
      });
      out[id] = { heroTop: top, over: bad };
    }
    return out;
  };
  const save = async (name) => {
    const cv = document.getElementById('c') || [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    return fetch('http://127.0.0.1:8981/save?name=' + name, { method: 'POST', body: cv.toDataURL('image/png') }).then((r) => r.text());
  };
  window.tallSnap = async (kind, key = 'paladin-tyrant', sec = 3) => {
    if (window.skillTest) skillTest.state.paused = true;
    if (kind === 'duel') {
      const all = await (await fetch('/dev/sheets-sword/work/duels.json', { cache: 'reload' })).json();
      S.phase = 'camp'; playDuel(all[key], () => {});
    } else {
      const res = await (await fetch('/dev/sheets-sword/work/raid.json', { cache: 'reload' })).json();
      const ids = Object.keys(ORIG);          // 레이드 4인을 키운 직업들로 바꿔 세운다
      res.members.forEach((m, i) => { if (ids[i]) { m.cls = ids[i]; m.nickname = ids[i]; } });
      S.phase = 'camp'; playRaid(res, () => {});
    }
    if (window.skillTest) skillTest.step(sec); else { for (let i = 0; i < sec * 60; i++) update(1 / 60); render(); }
    return save(`tall-${kind}-${key}`);
  };
})();
