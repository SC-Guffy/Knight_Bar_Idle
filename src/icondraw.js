'use strict';
// 화면(DOM) 글자와 캔버스 글자 속 이모지·스킬 문자를 도트 아이콘으로 바꾼다. index.html 앞쪽(데이터 다음)에 실려 dev/skills.html 같은 개발 페이지에서도 돈다.
// ── 캔버스 ──
// fillTextIco / strokeTextIco / measureTextIco 는 g.fillText 등과 같은 자리에 쓴다. 이모지가 없으면 원래 함수 그대로.
// 아이콘 크기는 글꼴 크기에 맞춘 정수배: 14px(1배), 글꼴이 20px 이상이면 28px(2배)… 표 ICON_OF·칸 순서 ICON_NAMES 는 src/iconmap.js.
const ICON_SHEET = new Image();
ICON_SHEET.src = new URL('skin/icons.png', document.currentScript.src).href;
const ICON_IDX = Object.fromEntries(ICON_NAMES.map((n, i) => [n, i]));
const ICON_CRE = new RegExp(`(${Object.keys(ICON_OF).join('|')})${String.fromCharCode(0xfe0f)}?`, 'gu');
const ICON_CHAS = new RegExp(ICON_CRE.source, 'u');
const iconFontPx = (g) => +(/(\d+(?:\.\d+)?)px/.exec(g.font) || [0, 12])[1];
const iconScale = (g) => Math.max(1, Math.round(iconFontPx(g) / 14));
// 글자를 [글자 조각 | {n: 아이콘 이름}] 로 나눈다
function iconPieces(text) {
  const out = [];
  let at = 0;
  for (const m of text.matchAll(ICON_CRE)) {
    if (m.index > at) out.push(text.slice(at, m.index));
    out.push({ n: ICON_OF[m[1]] });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}
function measureTextIco(g, text) {
  text = String(text);
  if (!ICON_CHAS.test(text)) return g.measureText(text);
  const s = 14 * iconScale(g);
  const width = iconPieces(text).reduce((w, p) => w + (typeof p === 'string' ? g.measureText(p).width : s + 1), 0);
  return { width };
}
function drawTextIco(g, text, x, y, stroke) {
  text = String(text);
  if (!ICON_CHAS.test(text) || !ICON_SHEET.complete) return stroke ? g.strokeText(text, x, y) : g.fillText(text, x, y);
  const s = 14 * iconScale(g), parts = iconPieces(text);
  const w = parts.reduce((a, p) => a + (typeof p === 'string' ? g.measureText(p).width : s + 1), 0);
  const al = g.textAlign, bl = g.textBaseline;
  let cx = al === 'center' ? x - w / 2 : al === 'right' || al === 'end' ? x - w : x;
  // 아이콘 윗변: 기준선에 맞춘다 (middle 은 가운데, 나머지는 글자 몸통에 대충 맞춤)
  const top = bl === 'middle' ? y - s / 2 : bl === 'top' || bl === 'hanging' ? y : bl === 'bottom' ? y - s : y - s + Math.round(s / 7);
  g.textAlign = 'left';
  const smooth = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = false;
  for (const p of parts) {
    if (typeof p === 'string') {
      stroke ? g.strokeText(p, cx, y) : g.fillText(p, cx, y);
      cx += g.measureText(p).width;
    } else {
      // 아이콘은 잉크 외곽선이 이미 있어 글자 테두리(stroke)는 건너뛴다
      if (!stroke) g.drawImage(ICON_SHEET, ICON_IDX[p.n] * 14, 0, 14, 14, Math.round(cx), Math.round(top), s, s);
      cx += s + 1;
    }
  }
  g.textAlign = al;
  g.imageSmoothingEnabled = smooth;
}
const fillTextIco = (g, text, x, y) => drawTextIco(g, text, x, y, false);
const strokeTextIco = (g, text, x, y) => drawTextIco(g, text, x, y, true);

// ── 화면(DOM) ──
// 화면 글자 속 이모지 → 도트 아이콘. 표 ICON_OF 는 dev/make-icons.js 가 만든 src/iconmap.js.
// 문서에 글자가 들어올 때마다(MutationObserver, 그리기 전 마이크로태스크) 글자 노드만 훑어 바꾼다 — title 같은 속성·캔버스·입력칸은 그대로.
// 바꾼 아이콘 안에 원래 이모지를 투명 글자로 남겨서 textContent 비교(tickLive 등)·복사가 그대로 된다. 표에 없는 이모지는 그대로 둔다.
const ICON_RE = ICON_CRE, ICON_HAS = ICON_CHAS;
const ICON_SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION', 'TITLE', 'CANVAS']);
function iconizeText(t) {
  const p = t.parentNode;
  if (!p || p.nodeType !== 1 || ICON_SKIP.has(p.nodeName) || p.classList.contains('pi') || !ICON_HAS.test(t.nodeValue)) return;
  const s = t.nodeValue, f = document.createDocumentFragment();
  let at = 0;
  for (const m of s.matchAll(ICON_RE)) {
    if (m.index > at) f.append(s.slice(at, m.index));
    const i = document.createElement('i');
    i.className = `pi pi-${ICON_OF[m[1]]}`;
    i.textContent = m[0];
    f.append(i);
    at = m.index + m[0].length;
  }
  if (at < s.length) f.append(s.slice(at));
  t.replaceWith(f);
}
function iconize(root) {
  if (root.nodeType === 3) return iconizeText(root);
  if (root.nodeType !== 1 || ICON_SKIP.has(root.nodeName)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [];
  while (w.nextNode()) list.push(w.currentNode);
  list.forEach(iconizeText);
}
new MutationObserver((ms) => ms.forEach((m) => (m.type === 'characterData' ? iconizeText(m.target) : m.addedNodes.forEach(iconize))))
  .observe(document.body, { childList: true, subtree: true, characterData: true });
iconize(document.body);
