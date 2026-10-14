'use strict';
// 직업 트리(전직 탭) 좁은 화면 확인 (개발용): 375px iframe 안에서 견습 기사 Lv20 으로 전직 탭을 연다.
//   iframe 안 문서에 <script src="dev/boxer/tree-check.js"> 를 붙이면 window.__tree 에 칸 위치를 남긴다 (CSP 때문에 eval 대신 파일로)
S.cls = 'squire'; S.level = 20; S.gold = 1e6; S.phase = 'camp'; S.trip = null;
openCamp(); campTab = 'char'; charUi.sub = 'class'; classSel = null; renderCamp();
setTimeout(() => {
  const t = document.querySelector('.ctree');
  window.__tree = { vw: innerWidth, scroll: t.parentElement.scrollWidth, client: t.parentElement.clientWidth,
    nodes: [...document.querySelectorAll('.ctree .cnode')].map((n) => { const r = n.getBoundingClientRect(); return [n.querySelector('.cname').textContent.trim(), Math.round(r.left), Math.round(r.right)]; }) };
}, 300);
