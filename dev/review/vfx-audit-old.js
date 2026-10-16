'use strict';
// 전수조사 전 로더 (커밋 90edd26 의 src/vfx-tex.js vfxQuantize·vfxStripOutline) — 검토 페이지의 '전' 줄을 그린다
function oldQuantize(s) {
  const img = s.img, w = img.naturalWidth, h = img.naturalHeight;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
  const p = g.getImageData(0, 0, w, h).data, lv = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (p[i * 4 + 3] < 24) continue;
    const l = (0.3 * p[i * 4] + 0.59 * p[i * 4 + 1] + 0.11 * p[i * 4 + 2]) / 255;
    // 외곽선(1)은 거의 무채색인 아주 어두운 픽셀만. 짙은 빨강·갈색처럼 색이 있는 어두운 픽셀(불꽃 꼬리·흙)은 램프의 가장 어두운 단(2)
    const r = p[i * 4], gg = p[i * 4 + 1], b = p[i * 4 + 2], ink = Math.max(r, gg, b) < 48 && Math.max(r, gg, b) - Math.min(r, gg, b) < 28;
    lv[i] = l < 0.2 ? (s.soft || !ink ? 2 : 1) : 2 + Math.round(((l - 0.2) / 0.8) * 4);   // soft: 연기처럼 어두운 덩어리가 큰 시트는 외곽선색 대신 램프의 가장 어두운 단
  }
  // 화면을 거의 채우는 그림(밤하늘 배경 등)은 외곽선이 없으니 건드리지 않는다
  let filled = 0;
  for (let i = 0; i < w * h; i++) if (lv[i]) filled++;
  if (filled < w * h * 0.6) oldStrip(lv, w, h, s.frames, p);
  Object.assign(s, { w, h, fw: w / s.frames, lv, tint: new Map(), src: p });
}
function oldStrip(lv, w, h, frames, p) {
  const fw = w / (frames || 1), q = [];
  const fx = (i) => Math.floor((i % w) / fw);
  for (let i = 0; i < w * h; i++) {
    if (lv[i] !== 1) continue;
    const x = i % w, y = (i / w) | 0, f = fx(i);
    const edge = x === f * fw || x === (f + 1) * fw - 1 || y === 0 || y === h - 1
      || (x > 0 && fx(i - 1) === f && !lv[i - 1]) || (x < w - 1 && fx(i + 1) === f && !lv[i + 1])
      || (y > 0 && !lv[i - w]) || (y < h - 1 && !lv[i + w]);
    if (edge) { lv[i] = 0; q.push(i); }
  }
  while (q.length) {
    const i = q.pop(), x = i % w, f = fx(i);
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j < 0 || j >= w * h || lv[j] !== 1 || fx(j) !== f) continue;
      lv[j] = 0; q.push(j);
    }
  }
  // 안쪽에 남은 검은 픽셀: 둘레 색(검정 아닌 이웃들의 평균)으로 메워 얼룩 없이 덩어리에 녹인다
  for (let i = 0; i < w * h; i++) {
    if (lv[i] !== 1) continue;
    const x = i % w; let n = 0, r = 0, g = 0, b = 0;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j < 0 || j >= w * h || lv[j] < 2) continue;
      n++; r += p[j * 4]; g += p[j * 4 + 1]; b += p[j * 4 + 2];
    }
    lv[i] = 2;
    if (n) { p[i * 4] = r / n; p[i * 4 + 1] = g / n; p[i * 4 + 2] = b / n; }
  }
  for (let i = 0; i < w * h; i++) {
    if (!lv[i]) continue;
    const x = i % w, f = fx(i);
    let alone = true;
    for (let dy = -1; dy <= 1 && alone; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, j = i + dy * w + dx;
      if (xx < 0 || xx >= w || j < 0 || j >= w * h || fx(j) !== f) continue;
      if (lv[j]) { alone = false; break; }
    }
    if (alone) lv[i] = 0;
  }
}
