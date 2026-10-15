'use strict';
// 마법사 계열 시트 연결 시험 (docs/specs/legacy-class-sheets.md): dev/skills.html?patch=sheets-mage&cls=pyromancer
//  src/sprites 에 아직 시트가 없을 때, dev/sheets-mage/<dir>/<cls>.png·.json 을 SHEET_META·SHEETS 에 끼우고 SHEET_ON 을 켠다.
//  &sheetdir=stub (기본) = 기준 그림 한 장으로 만든 시험 시트 — 발 기준점·스위치·동작 연결만 본다 (그림은 아직 생성 전)
//  &sheets=0 이면 끼우지 않는다 (예전 조립식, 전후 비교)
//  콘솔: sheetsMage.diff(cls) = 같은 전투 대기 자세를 조립식·시트로 그려 다른 칸 수 (발 기준점 확인, 0 이면 같은 자리)
(async () => {
  const IDS = ['mage', 'pyromancer', 'cryomancer', 'electromancer', 'archmage', 'frostlord', 'thunderEmperor'];
  const qs = new URLSearchParams(location.search), dir = (qs.get('sheetdir') || 'stub').replace(/[^\w-]/g, '');
  const base = '../dev/sheets-mage/' + dir + '/';
  const loaded = [];
  if (qs.get('sheets') !== '0') {
    for (const id of IDS) {
      if (SHEET_META[id]) { SHEET_ON[id] = true; loaded.push(id + '(src)'); continue; }   // 진짜 시트가 생기면 그것을 쓴다
      const r = await fetch(base + id + '.json?t=' + Date.now());
      if (!r.ok) continue;
      const meta = await r.json();
      SHEET_META[id] = meta;
      const img = new Image();
      const s = (SHEETS[id] = { meta, img, ok: false, tint: new Map() });
      img.onload = () => { s.ok = true; };
      img.src = base + id + '.png?t=' + Date.now();
      SHEET_ON[id] = true;
      loaded.push(id);
    }
  }
  // 같은 자세를 조립식(SHEET_ON 끔)과 시트로 각각 그려 칸 비교 (1칸 = 3px 로 키워 그림)
  const draw = (id, on, pose) => {
    const was = SHEET_ON[id]; SHEET_ON[id] = on;
    const cv = document.createElement('canvas'); cv.width = 288; cv.height = 288;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.translate(144, 264); g.scale(2, 2); drawHero(g, id, 0, 0, { mode: 'fight', swing: -1, t: 0, walkT: 0, facing: 1, ...pose });
    SHEET_ON[id] = was;
    return g.getImageData(0, 0, 288, 288).data;
  };
  window.sheetsMage = {
    loaded,
    diff(id, pose = {}) {
      const a = draw(id, false, pose), b = draw(id, true, pose);
      let n = 0, na = 0, nb = 0;
      for (let i = 3; i < a.length; i += 4) { const A = a[i] > 128, B = b[i] > 128; if (A) na++; if (B) nb++; if (A !== B) n++; }
      return { id, differ: Math.round(n / 9), legacy: Math.round(na / 9), sheet: Math.round(nb / 9) };
    },
  };
  console.log('[sheets-mage]', dir, loaded.join(', ') || '(none)');
})();
