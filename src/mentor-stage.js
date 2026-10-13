'use strict';
// 🎓 교관 수련 무대 (마을 → 훈련장 아래 <canvas class="mstage">). 규칙은 mentor.js, 스펙은 docs/specs/training-mentors.md.
// 왼쪽에 내 기사, 오른쪽에 큼직한 교관, 뒤에 교관 장소 배경. 수련(★1~4)과 승부(★5)의 연출을 그린다.
// 결과는 연출 전에 이미 정해져 있다 (mentor.js mentorTry · 서버 승부). 무대를 누르면 연출을 건너뛴다.

const mentorUi = { view: null, anim: null, preview: null, busy: false };
const MS_CELL = 4;                 // 교관 도트 1칸 = 4px (기사는 PX=3 — 교관이 한눈에 크게 보이게)
const MS_W = 28, MS_H = 32;        // 교관 스프라이트 칸 수 (발끝 가운데 = 14열)

// 교관 대사 — fail: 탈락 · ok: 합격 · win: 승부에서 졌을 때(기사 승리) · lose: 기사가 졌을 때 · done: 수료 후
const MENTOR_SAY = {
  sword: {
    fail: ['이놈, 탈락이다!', '칼끝이 흔들린다!', '발이 먼저 나갔다. 다시!', '그걸 검이라고 휘두르느냐!'],
    ok: ['음. 다음 단계로 넘어가도 되겠군.', '호오… 제법이구나.', '좋다. 그 감각을 잊지 마라.'],
    win: '훌륭하다… 더 가르칠 것이 없구나.', lose: ['아직 멀었다. 더 단련하고 오너라.', '검은 마음으로 휘두르는 것이다.'], done: '네 검은 이미 내 손을 떠났다.',
  },
  shield: {
    fail: ['방패 너머가 다 보인다! 탈락!', '자세가 무너졌다!', '그 정도로는 성벽도 못 지킨다!', '한 대 맞고 정신 차려라!'],
    ok: ['버티는 법을 알았군. 통과다.', '좋아, 어깨가 단단해졌어.', '음. 쓸 만한 방패잡이로군.'],
    win: '내 방패를 넘다니… 수료다.', lose: ['방패는 아직 뚫리지 않았다.', '더 무거워져서 와라.'], done: '성문은 이제 네가 지켜라.',
  },
  hunter: {
    fail: ['소리가 너무 크다. 탈락.', '사냥감은 이미 도망갔다.', '바람을 읽지 못했군.', '숲이 너를 비웃는다.'],
    ok: ['…좋아. 숨소리가 사라졌어.', '그 눈빛이면 됐다.', '숲이 너를 받아들였다.'],
    win: '내 화살보다 빨랐다. 인정하지.', lose: ['넌 아직 사냥감이다.', '다시 숲에 숨어 보아라.'], done: '숲길은 이제 네 것이다.',
  },
  brute: {
    fail: ['흐하하! 약하다! 탈락!', '불길에 데이기나 해라!', '그게 힘이냐, 하품이냐!', '용암이 더 뜨겁겠다!'],
    ok: ['흥, 뼈는 좀 있구나!', '좋다! 피가 끓는군!', '크하하, 마음에 든다!'],
    win: '크윽… 네 불길이 더 뜨거웠다!', lose: ['흐하하! 다시 달궈 와라!', '아직 쇠가 덜 달궈졌다!'], done: '화산의 불은 이미 네 안에 있다.',
  },
  sage: {
    fail: ['별의 흐름을 거슬렀구나. 탈락.', '마음이 앞서는구나.', '하늘이 고개를 젓는다.', '구름이 너를 가리는구나.'],
    ok: ['허허… 별이 너를 비추는구나.', '흐름을 탔구나. 다음으로.', '좋다. 고요함이 보인다.'],
    win: '허허… 이제 별이 너를 따르겠구나.', lose: ['아직 하늘이 멀구나.', '별은 서두르지 않는다.'], done: '하늘 끝에서 다시 보자꾸나.',
  },
};

// ───────────────────────── 교관 스프라이트 (28×32 칸, 왼쪽을 봄) ─────────────────────────
// 실루엣부터 다르게 (색깔놀이 금지): 상투·도복·목검 / 깃털 투구·대형 방패·두꺼운 어깨 / 후드·망토·장궁 / 뿔 투구·맨 상체·쌍도끼 / 삿갓·흰 수염·별 로브·지팡이
const msR = (b, x, y, w, h, c) => { b.fillStyle = c; b.fillRect(x, y, w, h); };
const msP = (b, x, y, c) => msR(b, x, y, 1, 1, c);
function msL(b, x0, y0, x1, y1, c, w = 1) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    msR(b, x0, y0, w, w, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}
// 사다리꼴 (윗변 x0..x1 → 아랫변 x2..x3, y 줄마다 보간)
function msTrap(b, y0, y1, x0, x1, x2, x3, c) {
  for (let y = y0; y <= y1; y++) {
    const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
    const a = Math.round(x0 + (x2 - x0) * t), z = Math.round(x1 + (x3 - x1) * t);
    msR(b, a, y, z - a + 1, 1, c);
  }
}

// body: 머리 아래 전부, head: 머리 (끄덕임은 머리만 내려 그린다)
const MENTOR_ART = {
  sword: {
    body(b) {
      // 하카마 (넓게 퍼지는 바지) + 주름
      msTrap(b, 20, 30, 9, 19, 6, 21, '#2b2f4a');
      for (const x of [11, 14, 17]) msL(b, x, 21, x - (x < 14 ? 1 : x > 14 ? -1 : 0), 30, '#1c1f33');
      msR(b, 6, 31, 4, 1, '#5a3d2a'); msR(b, 17, 31, 4, 1, '#5a3d2a');
      // 도복 상의 · 띠
      msTrap(b, 11, 19, 10, 18, 9, 19, '#ece6d8');
      msL(b, 15, 11, 11, 18, '#bdb5a3'); msL(b, 13, 11, 16, 16, '#bdb5a3');
      msR(b, 13, 11, 2, 2, '#e8b48a');
      msR(b, 9, 19, 11, 2, '#141216'); msR(b, 19, 20, 2, 3, '#141216');
      // 뒷팔·앞팔 (넓은 소매) — 목검을 앞으로 겨눈다
      msR(b, 9, 13, 3, 5, '#bdb5a3');
      msTrap(b, 12, 17, 7, 11, 5, 10, '#ece6d8');
      msR(b, 4, 16, 3, 2, '#e8b48a');
      // 목검 (손잡이 → 끝이 위로)
      msL(b, 6, 17, 0, 6, '#a0703a', 2); msL(b, 7, 18, 6, 17, '#6e4a24', 1);
      msP(b, 0, 5, '#c89a5c'); msP(b, 1, 5, '#c89a5c');
    },
    head(b) {
      msR(b, 13, 10, 3, 2, '#c48d66');                                  // 목
      msR(b, 11, 3, 8, 8, '#e8b48a'); msR(b, 11, 9, 1, 1, '#c48d66');     // 얼굴
      msR(b, 11, 2, 8, 2, '#1d1a20'); msR(b, 17, 3, 2, 6, '#1d1a20');      // 머리카락
      msR(b, 15, 0, 2, 2, '#1d1a20'); msP(b, 14, 1, '#1d1a20');           // 상투
      msR(b, 11, 4, 8, 1, '#b33a3a'); msP(b, 19, 4, '#b33a3a'); msR(b, 20, 5, 2, 1, '#b33a3a'); msP(b, 21, 6, '#8a2a2a');   // 머리띠 꼬리
      msR(b, 12, 6, 2, 1, '#141216'); msR(b, 12, 5, 2, 1, '#5a3d2a');     // 눈·눈썹
      msR(b, 12, 9, 2, 1, '#8a5a44');                                     // 입
    },
  },
  shield: {
    body(b) {
      // 다리 (철 정강이) · 장화
      msR(b, 12, 22, 4, 9, '#6b7280'); msR(b, 17, 22, 4, 9, '#565c69');
      msR(b, 11, 31, 5, 1, '#2a2430'); msR(b, 17, 31, 5, 1, '#2a2430');
      // 갑옷 몸통 · 허리 치마
      msTrap(b, 11, 21, 10, 21, 11, 22, '#8a93a4');
      msR(b, 10, 19, 13, 3, '#5f6676');
      // 거대한 어깨 (실루엣이 위로 넓게)
      msTrap(b, 8, 12, 17, 22, 16, 25, '#9aa3b4'); msR(b, 16, 12, 10, 1, '#6b7280');
      msTrap(b, 8, 12, 7, 12, 5, 13, '#9aa3b4');
      // 등 뒤의 짧은 검
      msL(b, 23, 14, 25, 24, '#c9ced8', 1); msR(b, 22, 13, 3, 1, '#7a5a2a');
      // 대형 방패 (앞)
      msR(b, 2, 11, 9, 19, '#3f5a86'); msR(b, 2, 11, 9, 1, '#a9b4c8'); msR(b, 2, 29, 9, 1, '#2a3a58');
      msR(b, 2, 11, 1, 19, '#a9b4c8'); msR(b, 10, 11, 1, 19, '#2a3a58');
      msR(b, 6, 14, 1, 13, '#d8dde6'); msR(b, 4, 18, 5, 1, '#d8dde6');   // 방패 문장 (십자)
      msR(b, 5, 17, 3, 3, '#c9ced8');
    },
    head(b) {
      msR(b, 12, 2, 8, 9, '#8a93a4'); msR(b, 12, 2, 8, 1, '#c9ced8');     // 투구
      msR(b, 12, 6, 5, 1, '#1a1c22'); msR(b, 12, 8, 3, 1, '#5f6676');     // 눈구멍 · 숨구멍
      msR(b, 19, 3, 1, 8, '#5f6676');
      // 깃털 장식 (뒤로 길게 휘어짐)
      msL(b, 16, 1, 19, 0, '#c23b3b', 1); msL(b, 19, 0, 23, 2, '#c23b3b', 2); msL(b, 23, 2, 25, 6, '#a02e2e', 2); msP(b, 26, 8, '#a02e2e');
    },
  },
  hunter: {
    body(b) {
      // 장화
      msR(b, 13, 28, 3, 3, '#4a3424'); msR(b, 18, 28, 3, 3, '#4a3424'); msR(b, 12, 31, 4, 1, '#2e2018'); msR(b, 18, 31, 4, 1, '#2e2018');
      // 긴 망토 (끝이 들쭉날쭉)
      msTrap(b, 9, 27, 12, 20, 9, 23, '#2f4a2c');
      for (let x = 9; x <= 23; x += 3) msR(b, x, 28, 2, 1, '#2f4a2c');
      msL(b, 17, 11, 21, 27, '#253c23'); msL(b, 14, 11, 12, 27, '#3a5a34');
      // 화살통 (등)
      msR(b, 21, 7, 3, 10, '#6a4a2a'); msR(b, 21, 5, 1, 2, '#e8e2d0'); msR(b, 23, 5, 1, 2, '#e8e2d0'); msP(b, 22, 4, '#e8e2d0');
      // 장궁 (몸보다 길다) + 시위 + 활을 쥔 손
      msL(b, 6, 0, 3, 6, '#7a5230', 1); msL(b, 3, 6, 2, 15, '#7a5230', 1); msL(b, 2, 15, 3, 24, '#7a5230', 1); msL(b, 3, 24, 6, 31, '#7a5230', 1);
      msL(b, 6, 0, 6, 31, '#d8d0b8', 1);
      msR(b, 2, 14, 3, 3, '#5a3d22');
      msTrap(b, 13, 16, 11, 13, 4, 6, '#2f4a2c'); msR(b, 4, 15, 2, 2, '#c99a74');
    },
    head(b) {
      // 뾰족한 후드 (꼭지가 뒤로 처짐) · 그늘진 얼굴 · 빛나는 눈
      msTrap(b, 2, 10, 15, 18, 11, 20, '#3a5a34');
      msL(b, 18, 2, 21, 4, '#3a5a34', 2); msP(b, 22, 6, '#2f4a2c');
      msR(b, 11, 5, 4, 5, '#2a2018'); msR(b, 11, 6, 1, 1, '#d8ff7a'); msR(b, 11, 8, 2, 1, '#6a4a3a');
      msR(b, 15, 3, 1, 8, '#2f4a2c');
    },
  },
  brute: {
    body(b) {
      // 털 장화 · 다리
      msR(b, 9, 25, 4, 5, '#b8674a'); msR(b, 16, 25, 4, 5, '#a25a40');
      msR(b, 8, 29, 6, 3, '#6a4a32'); msR(b, 15, 29, 6, 3, '#6a4a32');
      // 털 허리옷 (들쭉날쭉)
      msR(b, 7, 20, 15, 4, '#7a5636'); for (let x = 7; x <= 21; x += 2) msP(b, x, 24, '#7a5636');
      msR(b, 7, 20, 15, 1, '#4a3424');
      // 맨 상체 (넓은 어깨) + 문신
      msTrap(b, 10, 19, 5, 23, 8, 20, '#c97a58');
      msL(b, 9, 12, 13, 16, '#7a2a20'); msL(b, 13, 16, 11, 19, '#7a2a20'); msL(b, 18, 12, 16, 15, '#7a2a20');
      msR(b, 12, 15, 4, 1, '#a85e44');
      // 앞 도끼 (치켜듦) · 뒤 도끼 (늘어뜨림)
      msL(b, 6, 15, 3, 4, '#5a3a22', 2); msR(b, 4, 15, 3, 3, '#c97a58');
      msTrap(b, 1, 7, 0, 2, 0, 5, '#8a8f98'); msL(b, 0, 1, 0, 7, '#ff7a2a', 1);
      msL(b, 22, 14, 24, 24, '#5a3a22', 2); msR(b, 21, 13, 3, 3, '#a25a40');
      msTrap(b, 22, 27, 24, 25, 25, 27, '#8a8f98'); msL(b, 27, 22, 27, 27, '#ff7a2a', 1);
    },
    head(b) {
      msR(b, 12, 4, 7, 7, '#c97a58'); msR(b, 12, 8, 7, 3, '#2a1a14');      // 얼굴 · 수염
      msR(b, 13, 6, 1, 1, '#ffb13b');                                    // 불타는 눈
      msR(b, 11, 3, 9, 3, '#3a3438'); msR(b, 11, 5, 9, 1, '#5a5258');     // 투구
      msL(b, 11, 3, 8, 1, '#e8e0cc', 1); msP(b, 7, 0, '#e8e0cc');         // 뿔
      msL(b, 19, 3, 22, 1, '#e8e0cc', 1); msP(b, 23, 0, '#e8e0cc');
    },
  },
  sage: {
    body(b) {
      // 별무늬 로브 (발까지)
      msTrap(b, 11, 31, 11, 19, 8, 22, '#2a2c5e');
      msL(b, 15, 12, 13, 31, '#20224a');
      for (const [x, y] of [[10, 22], [18, 15], [20, 26], [12, 28], [17, 21], [14, 17]]) msP(b, x, y, '#ffe9a0');
      // 넓은 소매 · 지팡이를 쥔 손
      msTrap(b, 12, 18, 10, 13, 6, 12, '#33367a'); msR(b, 6, 15, 2, 2, '#e2bfa0');
      // 지팡이 (몸보다 길다) + 빛나는 구슬
      msR(b, 5, 3, 1, 29, '#7a5a3a'); msR(b, 4, 0, 3, 3, '#7af0ff'); msP(b, 5, 1, '#e8ffff'); msP(b, 3, 1, '#3aa8c8'); msP(b, 7, 1, '#3aa8c8');
    },
    head(b) {
      msR(b, 13, 7, 6, 4, '#e2bfa0'); msR(b, 13, 8, 2, 1, '#6a4a3a');     // 얼굴 · 감은 눈
      // 흰 수염 (길게)
      msTrap(b, 10, 21, 12, 17, 13, 14, '#eeeae0'); msR(b, 12, 10, 1, 2, '#d8d2c4');
      // 삿갓 (넓은 챙)
      msTrap(b, 1, 5, 15, 16, 9, 22, '#c8a868'); msR(b, 7, 6, 18, 1, '#a88a50');
      msL(b, 15, 1, 11, 5, '#a88a50'); msL(b, 16, 1, 20, 5, '#a88a50');
    },
  },
};

// 교관 스프라이트 캐시: { body, head, white(번쩍) } — 한 번 그려서 재사용
const msSprCache = {};
function mentorSpr(id) {
  if (msSprCache[id]) return msSprCache[id];
  const mk = (fn) => { const c = document.createElement('canvas'); c.width = MS_W; c.height = MS_H; fn(c.getContext('2d')); return c; };
  const art = MENTOR_ART[id];
  const body = mk((b) => art.body(b)), head = mk((b) => art.head(b));
  const white = mk((b) => { b.drawImage(body, 0, 0); b.drawImage(head, 0, 0); b.globalCompositeOperation = 'source-in'; msR(b, 0, 0, MS_W, MS_H, '#ffffff'); });
  return (msSprCache[id] = { body, head, white });
}
// pose: { dx 앞으로 내딛기(px, 음수 = 기사 쪽), lean 기울기(rad), nod 머리 내림(칸), kneel 0~1, flash, alpha }
function drawMentorFig(g, id, x, gy, pose = {}) {
  const s = mentorSpr(id), c = MS_CELL;
  g.save();
  g.imageSmoothingEnabled = false;
  g.globalAlpha *= pose.alpha == null ? 1 : pose.alpha;
  g.translate(Math.round(x + (pose.dx || 0)), gy);
  if (pose.lean) g.rotate(pose.lean);
  if (pose.kneel) g.scale(1, 1 - 0.28 * pose.kneel);
  const ox = -14 * c, oy = -MS_H * c;
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.fillRect(-11 * c, -2, 22 * c, 4);
  if (pose.flash) g.drawImage(s.white, ox, oy, MS_W * c, MS_H * c);
  else {
    g.drawImage(s.body, ox, oy, MS_W * c, MS_H * c);
    g.drawImage(s.head, ox, oy + Math.round((pose.nod || 0) * c), MS_W * c, MS_H * c);
  }
  g.restore();
}

// ───────────────────────── 배경 (교관 장소) ─────────────────────────
// 2px 도트로 칠한다. 지평선 띠는 필드 원경(src/bg)을 빌려 쓰고, 나머지(하늘 띠·바닥·소품)는 여기서 그린다
const MS_BANDS = {
  castle:  ['#23223e', '#2f2d50', '#3e3a62', '#57507c'],
  fairy:   ['#0d2420', '#13322b', '#1a4033', '#24503a'],
  volcano: ['#1a0c0c', '#2e100e', '#4a1610', '#6e2414'],
  sky:     ['#0a0e2c', '#111840', '#192456', '#24346e'],
};
function msBands(g, cols, W, top, bot) {
  const n = cols.length, h = (bot - top) / n;
  for (let i = 0; i < n; i++) {
    const y0 = Math.round(top + i * h), y1 = Math.round(top + (i + 1) * h);
    msR(g, 0, y0, W, y1 - y0, cols[i]);
    if (i + 1 < n) { g.fillStyle = cols[i + 1]; for (let x = 0; x < W; x += 4) g.fillRect(x + ((y1 >> 1) & 1) * 2, y1 - 2, 2, 2); }
  }
}
function msHorizon(g, deco, W, gy) {
  const img = zoneBg(deco);
  if (!img) return;
  const w = img.width * BG_PX, h = img.height * BG_PX, y = gy + 3 - h;
  g.imageSmoothingEnabled = false;
  for (let x = 0, k = 0; x < W; x += w, k++) {
    if (k % 2) { g.save(); g.translate(x + w, 0); g.scale(-1, 1); g.drawImage(img, 0, y, w, h); g.restore(); } else g.drawImage(img, x, y, w, h);
  }
}
function drawDojo(g, W, H, gy) {
  msR(g, 0, 0, W, gy, '#5b3b24');
  for (let x = 12; x < W; x += 26) msR(g, x, 0, 2, gy, '#4a2f1c');
  msR(g, 0, 0, W, 14, '#3a2414'); msR(g, 0, 14, W, 2, '#6e4a2c');
  // 장지문 두 짝 (뒤에서 은은한 빛)
  for (const [a, z] of [[0.05, 0.36], [0.64, 0.95]]) {
    const x0 = Math.round(W * a), x1 = Math.round(W * z), y0 = 28, y1 = gy - 22;
    msR(g, x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6, '#3a2414');
    msR(g, x0, y0, x1 - x0, y1 - y0, '#e9dfc4');
    for (let x = x0 + 16; x < x1; x += 16) msR(g, x, y0, 2, y1 - y0, '#8a6a44');
    for (let y = y0 + 18; y < y1; y += 18) msR(g, x0, y, x1 - x0, 2, '#8a6a44');
  }
  // 가운데 족자 (붓 획)
  const cx = Math.round(W / 2);
  msR(g, cx - 15, 22, 30, 4, '#3a2414'); msR(g, cx - 12, 26, 24, 64, '#efe6cf'); msR(g, cx - 15, 90, 30, 4, '#3a2414');
  msR(g, cx - 2, 34, 4, 22, '#1d1a20'); msR(g, cx - 8, 42, 16, 3, '#1d1a20'); msR(g, cx - 6, 60, 4, 16, '#1d1a20'); msR(g, cx + 2, 64, 6, 3, '#1d1a20'); msR(g, cx + 4, 70, 3, 10, '#1d1a20');
  msR(g, cx + 5, 82, 4, 4, '#b33a3a');
  // 마룻바닥
  msR(g, 0, gy, W, H - gy, '#8a5d36');
  for (let y = gy + 6; y < H; y += 7) msR(g, 0, y, W, 1, '#6e4a2c');
  for (let y = gy, k = 0; y < H; y += 7, k++) for (let x = (k % 2) * 30; x < W; x += 60) msR(g, x, y, 1, 7, '#6e4a2c');
  msR(g, 0, gy, W, 2, '#a8784a');
}
function drawMentorBg(g, m, W, H, gy, t) {
  if (m.bg === 'dojo') { drawDojo(g, W, H, gy); return; }
  msBands(g, MS_BANDS[m.bg], W, 0, gy);
  if (m.bg === 'sky' || m.bg === 'castle') {                       // 별
    for (let i = 0; i < 26; i++) {
      const x = (i * 97) % W, y = (i * 53) % Math.max(10, gy - 60), tw = Math.sin(t * 2 + i) > 0.4;
      msR(g, x, y + 4, 2, 2, tw ? '#fff6d0' : '#8890c0');
    }
  }
  msHorizon(g, m.bg, W, gy);
  if (m.bg === 'castle') {
    msR(g, 0, gy, W, H - gy, '#5e5a66');
    for (let y = gy + 8; y < H; y += 9) msR(g, 0, y, W, 1, '#4a4652');
    for (let y = gy, k = 0; y < H; y += 9, k++) for (let x = (k % 2) * 14; x < W; x += 28) msR(g, x, y, 1, 9, '#4a4652');
    // 깃발 기둥 · 허수아비
    const fx = Math.round(W * 0.07);
    msR(g, fx, gy - 96, 3, 96, '#3a2c22');
    for (let i = 0; i < 24; i += 2) msR(g, fx + 3 + i, gy - 92 + Math.round(Math.sin(t * 3 + i * 0.3) * 2), 2, 18, '#9a3030');
    const dx = Math.round(W * 0.93);
    msR(g, dx - 1, gy - 52, 3, 52, '#5a4028'); msR(g, dx - 14, gy - 42, 29, 3, '#5a4028'); msR(g, dx - 7, gy - 60, 15, 18, '#c8a868'); msR(g, dx - 5, gy - 54, 4, 2, '#7a5a30');
  } else if (m.bg === 'fairy') {
    msR(g, 0, gy, W, H - gy, '#2b4f26');
    for (let i = 0; i < 40; i++) msR(g, (i * 37) % W, gy + 2 + (i * 7) % (H - gy - 4), 2, 4, '#3f6e34');
    for (const fx of [0.03, 0.96]) {                                  // 앞쪽 큰 나무
      const x = Math.round(W * fx);
      msR(g, x - 9, 0, 18, gy + 2, '#2a1e16'); msR(g, x - 9, 0, 3, gy + 2, '#3a2a1e');
      for (let k = 0; k < 5; k++) msR(g, x - 26 + k * 8, 4 + (k % 2) * 8, 26, 18, '#1e3a20');
    }
    for (let i = 0; i < 9; i++) {                                     // 반딧불
      const x = (i * 71 + Math.sin(t * 0.7 + i) * 18) % W, y = 40 + ((i * 29) % (gy - 60)) + Math.sin(t * 1.3 + i * 2) * 6;
      if (Math.sin(t * 2.4 + i * 1.7) > -0.2) msR(g, Math.round(x), Math.round(y), 2, 2, '#d8ff7a');
    }
  } else if (m.bg === 'volcano') {
    msR(g, 0, gy, W, H - gy, '#2a1c1a');
    const glow = 0.6 + 0.4 * Math.sin(t * 2.2);
    g.globalAlpha = glow;
    for (let i = 0; i < 7; i++) { const x = (i * 83) % W; msL(g, x, gy + 4, x + 14, gy + 12 + (i % 3) * 4, '#ff7a2a', 2); msL(g, x + 14, gy + 12 + (i % 3) * 4, x + 24, H - 2, '#ff5a1a', 2); }
    g.globalAlpha = 1;
    for (let i = 0; i < 14; i++) {                                    // 불티
      const ph = (t * 0.25 + i * 0.137) % 1, x = (i * 61 + Math.sin(t + i) * 10) % W;
      msR(g, Math.round(x), Math.round(gy - ph * (gy - 10)), 2, 2, ph < 0.6 ? '#ffb13b' : '#ff5a1a');
    }
  } else if (m.bg === 'sky') {
    msR(g, 0, gy, W, H - gy, '#c9cde8');
    for (let i = 0; i < 14; i++) { const x = (i * 59) % W; msR(g, x, gy - 6 + (i % 3) * 2, 34, 10, '#dfe2f4'); msR(g, x + 6, gy - 10 + (i % 2) * 2, 18, 6, '#eef0fa'); }
    for (let y = gy + 10; y < H; y += 8) for (let x = (y % 16); x < W; x += 16) msR(g, x, y, 6, 2, '#aab0d6');
  }
}

// ───────────────────────── 별 칸 · 말풍선 · 글자 ─────────────────────────
const MS_STAR = ['..#..', '.###.', '#####', '.###.', '.#.#.'];
function drawStarPx(g, x, y, s, fill) {
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (MS_STAR[r][c] === '#') msR(g, Math.round(x + c * s), Math.round(y + r * s), Math.ceil(s), Math.ceil(s), fill);
}
// 가운데 (cx, cy) 기준 별 (칸 크기 s)
const drawStarC = (g, cx, cy, s, fill) => drawStarPx(g, cx - 2.5 * s, cy - 2.5 * s, s, fill);
// 별 칸 k 의 가운데
const MS_SS = 4, MS_SGAP = 8;
function starSlot(W, k) {
  const sw = 5 * MS_SS, total = MENTOR_STARS * sw + (MENTOR_STARS - 1) * MS_SGAP, x0 = Math.round((W - total) / 2);
  return { x: x0 + k * (sw + MS_SGAP) + sw / 2, y: 10 + sw / 2, x0, total, sw };
}
// n: 지금 보이는 별 수 · pulse: 다음 칸 두근거림(0~1) · pop: { k, age } 막 박힌 별
function drawStarBar(g, W, n, t, pulse, pop) {
  const z = starSlot(W, 0);
  msR(g, z.x0 - 8, 5, z.total + 16, z.sw + 10, 'rgba(10,8,20,.6)');
  for (let k = 0; k < MENTOR_STARS; k++) {
    const c = starSlot(W, k), fin = k === MENTOR_STARS - 1;
    if (k < n) {
      const sc = pop && pop.k === k && pop.age < 0.3 ? 1 + 0.7 * (1 - pop.age / 0.3) : 1;
      drawStarC(g, c.x, c.y, MS_SS * sc, fin ? '#fff1b0' : '#ffd257');
    } else {
      drawStarC(g, c.x, c.y, MS_SS, fin ? '#5a2a34' : '#33304a');
      if (k === n) {
        const p = pulse ? 1 + 0.35 * pulse * Math.abs(Math.sin(t * 9)) : 1;
        if (pulse || Math.sin(t * 5) > 0) drawStarC(g, c.x, c.y, MS_SS * 0.6 * p, fin ? '#c05a6a' : '#7a76a8');
      }
    }
  }
}
function msFont(px, bold) { return `${bold ? 800 : 400} ${px}px Galmuri11, -apple-system, sans-serif`; }
// 말풍선 (n 글자까지 — 타자 치듯)
function drawBubble(g, text, x, y, W, n = text.length) {
  g.font = msFont(12);
  const w = Math.ceil(g.measureText(text).width) + 16, h = 22;
  const bx = Math.max(4, Math.min(W - w - 4, Math.round(x - w + 18))), by = Math.round(y - h);
  msR(g, bx, by, w, h, '#2a2838'); msR(g, bx + 2, by + 2, w - 4, h - 4, '#f3efe6');
  const tx = Math.max(bx + 8, Math.min(bx + w - 14, Math.round(x)));
  msR(g, tx, by + h - 2, 6, 2, '#f3efe6'); msR(g, tx + 2, by + h, 4, 2, '#2a2838'); msR(g, tx + 2, by + h - 2, 2, 2, '#f3efe6'); msR(g, tx + 4, by + h + 2, 2, 2, '#2a2838');
  g.fillStyle = '#2a2838'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(text.slice(0, Math.max(0, Math.floor(n))), bx + 8, by + h / 2 + 1);
}
// 굵은 글자 (외곽선) — 의성어·스탬프·띠가 같이 쓴다
function msBigText(g, text, px, col, ink = '#1a1424') {
  g.font = msFont(px, true); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = Math.max(4, px / 4); g.strokeStyle = ink;
  g.strokeText(text, 0, 0); g.fillStyle = col; g.fillText(text, 0, 0);
}
// 떠오르는 글자 효과: kind sfx(챙!·쾅! 의성어) · stamp(탈락!·수료! 도장) · banner(성공! 띠)
function drawFxText(g, x, W, H) {
  const age = x.age;
  g.save();
  if (x.kind === 'sfx') {
    const sc = age < 0.08 ? 0.4 + age / 0.08 : 1 + Math.max(0, 0.2 - age) * 0.5;
    g.globalAlpha = age > 0.45 ? Math.max(0, 1 - (age - 0.45) / 0.25) : 1;
    g.translate(Math.round(x.x), Math.round(x.y - age * 14)); g.rotate(x.rot || 0); g.scale(sc, sc);
    msBigText(g, x.text, x.size || 20, x.col);
  } else if (x.kind === 'stamp') {
    const sc = age < 0.12 ? 2.6 - 1.6 * (age / 0.12) : 1;
    g.translate(Math.round(x.x), Math.round(x.y)); g.rotate(x.rot || -0.18); g.scale(sc, sc);
    g.font = msFont(x.size || 28, true);
    const w = g.measureText(x.text).width + 24, h = (x.size || 28) + 14;
    g.globalAlpha = Math.min(1, age / 0.06);
    g.strokeStyle = '#1a1424'; g.lineWidth = 8; g.strokeRect(-w / 2, -h / 2, w, h);
    g.strokeStyle = x.col; g.lineWidth = 4; g.strokeRect(-w / 2, -h / 2, w, h);
    msBigText(g, x.text, x.size || 28, x.col);
  } else if (x.kind === 'banner') {
    const sc = age < 0.1 ? 0.5 + age / 0.1 * 0.7 : age < 0.18 ? 1.2 - (age - 0.1) / 0.08 * 0.2 : 1;
    const bh = 40, y = Math.round(x.y);
    g.globalAlpha = Math.min(1, age / 0.08) * 0.75;
    msR(g, 0, y - bh / 2, W, bh, '#1a1424'); msR(g, 0, y - bh / 2, W, 2, x.col); msR(g, 0, y + bh / 2 - 2, W, 2, x.col);
    g.globalAlpha = 1;
    g.translate(Math.round(W / 2), y); g.scale(sc, sc);
    msBigText(g, x.text, x.size || 30, x.col);
    // 반짝 지나가는 빛
    const sx = -120 + ((age - 0.15) / 0.4) * 240;
    if (age > 0.15 && age < 0.55) { g.save(); g.beginPath(); g.rect(sx, -22, 16, 44); g.clip(); g.font = msFont(x.size || 30, true); g.fillStyle = '#ffffff'; g.fillText(x.text, 0, 0); g.restore(); }
  }
  g.restore();
}

// ───────────────────────── 입자 ─────────────────────────
// p: { x, y, vx, vy, g 중력, life, max, s 크기, col, kind: 'sq' | 'ring' | 'conf' }
function msBurst(a, x, y, n, cols, spd, o = {}) {
  for (let i = 0; i < n; i++) {
    const ang = o.up ? -Math.PI / 2 + (Math.random() - 0.5) * (o.spread || 2.4) : Math.random() * Math.PI * 2, v = spd * (0.45 + Math.random() * 0.55);
    const life = (o.life || 0.5) * (0.6 + Math.random() * 0.6);
    a.parts.push({ x, y, vx: Math.cos(ang) * v + (o.vx || 0), vy: Math.sin(ang) * v, g: o.g == null ? 420 : o.g, life, max: life,
      s: (o.size || 3) * (0.7 + Math.random() * 0.6), col: cols[i % cols.length], kind: 'sq' });
  }
}
const msRing = (a, x, y, col, r1 = 70, life = 0.35) => a.parts.push({ x, y, vx: 0, vy: 0, g: 0, life, max: life, s: r1, col, kind: 'ring' });
const msDust = (a, x, y, n = 7) => msBurst(a, x, y, n, ['#c9b896', '#a8987a', '#e2d6bc'], 70, { up: true, spread: 2.8, g: -30, life: 0.55, size: 4 });
function msConfetti(a, W, n) {
  const cols = ['#ffd257', '#ff6b6b', '#7af0ff', '#9fd49a', '#c9a7ff', '#ffffff'];
  for (let i = 0; i < n; i++) {
    const life = 1.4 + Math.random() * 0.8;
    a.parts.push({ x: Math.random() * W, y: -10 - Math.random() * 40, vx: (Math.random() - 0.5) * 50, vy: 40 + Math.random() * 60, g: 50, life, max: life, s: 3, col: cols[i % cols.length], kind: 'conf', ph: Math.random() * 6 });
  }
}
function msStepParts(a, dt) {
  for (const p of a.parts) { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind === 'conf') p.ph += dt * 9; }
  a.parts = a.parts.filter((p) => p.life > 0);
}
function msDrawParts(g, a) {
  for (const p of a.parts) {
    const k = p.life / p.max;
    if (p.kind === 'ring') {
      const r = p.s * (1 - k * k);
      g.globalAlpha = k; g.strokeStyle = p.col; g.lineWidth = 3;
      g.strokeRect(Math.round(p.x - r), Math.round(p.y - r * 0.6), Math.round(r * 2), Math.round(r * 1.2));
    } else if (p.kind === 'conf') {
      g.globalAlpha = Math.min(1, k * 2);
      const w = Math.max(1, Math.round(Math.abs(Math.cos(p.ph)) * p.s * 1.4));
      msR(g, Math.round(p.x - w / 2), Math.round(p.y), w, 2, p.col);
    } else {
      g.globalAlpha = Math.min(1, k * 1.6);
      const s = Math.max(1, Math.round(p.s * (0.5 + k * 0.5)));
      msR(g, Math.round(p.x), Math.round(p.y), s, s, p.col);
    }
  }
  g.globalAlpha = 1;
}

// ───────────────────────── 연출 (타임라인) ─────────────────────────
// 연출은 자기 시계 lt 로 흐른다: 타격 순간 멈칫(hit-stop, a.stop), 마지막 한 방 슬로 모션(a.slow).
// 정해진 시각에 한 번씩 터지는 일(cue)은 a.cues = [[시각, fn], …]. 카메라: 흔들림 a.shake · 확대 a.zoom · 번쩍 a.flash · 조명 a.spot
const pickSay = (arr) => arr[Math.floor(Math.random() * arr.length)];
const SFX_CLANG = ['챙!', '캉!', '탁!', '챙그랑!'];
const msEase = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
const msIsRanged = () => { const c = CLASSES[S.cls] || CLASSES.squire; return WEAPONS[c.weapon].kind === 'ranged'; };

function msNewAnim(kind, i, extra) {
  return Object.assign({
    kind, i, lt: 0, stop: 0, slow: 1, last: null, cues: [], parts: [], fx: [],
    shake: 0, zoom: 1, zoomT: 1, flash: null, spot: 0, spotT: 0, pulse: 0,
    k: { ox: 0, lift: 0, vx: 0, vy: 0, rot: 0, spin: 0, fly: false, bounced: false, sit: false, hop: null },
    m: { dx: 0, lean: 0, nod: 0, kneel: 0, flashUntil: -1 },
    bubble: null, bigStar: null, slotPop: null,
  }, extra);
}
const msCue = (a, at, fn) => { a.cues.push([at, fn]); a.cues.sort((x, y) => x[0] - y[0]); };
const msFx = (a, o) => a.fx.push({ age: 0, ...o });
const msHit = (a, stop, shake, flash) => { a.stop = Math.max(a.stop, stop); a.shake = Math.max(a.shake, shake); if (flash) a.flash = { col: flash, a: 1 }; };
const msSay = (a, text) => { a.bubble = { text, at: a.lt }; };
// 기사가 날아간다 (탈락·패배)
const msLaunch = (a) => Object.assign(a.k, { fly: true, vx: -300, vy: 260, spin: -10, bounced: false, sit: false });

// ★1~4 수련 연출 (결과 r = mentorTry 의 반환)
function mentorPlayTry(i, r) {
  const m = MENTORS[i], say = MENTOR_SAY[m.id];
  const swings = Math.random() < 0.5 ? 1 : 2;
  const R0 = 0.24 + swings * 0.36 + 0.1, R = R0 + 0.6;
  const a = msNewAnim('try', i, { ok: r.ok, star: r.star, stars: r.star - 1, swings, R0, R, end: R + (r.ok ? 3.0 : 2.4) });
  msCue(a, 0.01, (a, W, H, P) => msDust(a, P.kx0, P.gy, 6));          // 박차고 달려 나간다
  // 공격 → 교관이 막는다 (챙!)
  for (let k = 0; k < swings; k++) {
    msCue(a, 0.24 + k * 0.36 + 0.11, (a, W, H, P) => {
      msHit(a, 0.06, 3);
      msBurst(a, P.cx, P.cy, 10, ['#ffffff', '#ffe9a0', '#ffd257'], 170, { g: 200, life: 0.35 });
      msFx(a, { kind: 'sfx', text: pickSay(SFX_CLANG), x: P.cx + 6, y: P.cy - 26, col: '#ffffff', size: 18, rot: (Math.random() - 0.5) * 0.4 });
      a.m.recoilAt = a.lt;
    });
  }
  // 숨 고르기: 조명이 좁아지고, 교관이 말없이 바라본다 (…), 다음 별 칸이 두근거린다
  msCue(a, R0, (a) => { a.spotT = 0.55; a.zoomT = 1.07; a.pulse = 1; msSay(a, '……'); });
  if (!r.ok) {
    msCue(a, R + 0.2, (a, W, H, P) => {
      msHit(a, 0.13, 10, '#ffffff');
      a.zoom = 1.14; a.zoomT = 1; a.spotT = 0.25; a.pulse = 0;
      msLaunch(a);
      msBurst(a, P.kx + 6, P.gy - 34, 16, ['#ffffff', '#ff8080', '#ffd0a0'], 230, { g: 300, life: 0.45, size: 4 });
      msRing(a, P.kx + 6, P.gy - 30, '#ffffff', 60);
      msFx(a, { kind: 'sfx', text: '쾅!', x: P.kx + 20, y: P.gy - 78, col: '#ff6b6b', size: 30, rot: -0.15 });
    });
    msCue(a, R + 0.35, (a) => msSay(a, a.say));
    msCue(a, R + 0.62, (a, W, H, P) => { msHit(a, 0.04, 5); msFx(a, { kind: 'stamp', text: '탈락!', x: W * 0.44, y: H * 0.42, col: '#ff5a5a', size: 30, rot: -0.2 }); msDust(a, W * 0.44, H * 0.42 + 22, 8); });
    msCue(a, R + 1.2, (a) => { a.spotT = 0; a.zoomT = 1; });
  } else {
    msCue(a, R + 0.05, (a) => msSay(a, a.say));
    msCue(a, R + 0.55, (a, W, H, P) => {
      a.bigStar = { at: a.lt, x: Math.round(P.W * 0.47), y: 96 };
      a.flash = { col: '#ffe9a0', a: 0.5 };
      msBurst(a, Math.round(P.W * 0.47), 96, 16, ['#fff1b0', '#ffd257', '#ffffff'], 150, { g: 60, life: 0.6 });
    });
    msCue(a, R + 1.45, (a, W, H, P) => {
      msHit(a, 0.09, 6, '#fff1b0');
      a.stars = a.star; a.slotPop = { k: a.star - 1, at: a.lt }; a.bigStar = null;
      const c = starSlot(W, a.star - 1);
      msRing(a, c.x, c.y, '#ffe9a0', 46, 0.4); msRing(a, c.x, c.y, '#ffffff', 26, 0.25);
      msBurst(a, c.x, c.y, 20, ['#fff1b0', '#ffd257', '#ffffff', '#ffb13b'], 210, { g: 260, life: 0.6 });
      a.spotT = 0; a.zoomT = 1; a.pulse = 0;
    });
    msCue(a, R + 1.58, (a, W, H) => { msFx(a, { kind: 'banner', text: `★${a.star} 성공!`, y: H * 0.46, col: '#ffe066', size: 28 }); msConfetti(a, W, 30); a.k.hop = a.lt; });
  }
  a.say = pickSay(r.ok ? say.ok : say.fail);
  mentorUi.anim = a;
}
// 승부(★5) 연출 (서버 결과 res)
function mentorPlayDuel(i, res) {
  const f = res.fight, say = MENTOR_SAY[MENTORS[i].id];
  const speed = Math.max(1, f.dur / 7);
  const a = msNewAnim('duel', i, { res, ok: res.won, star: MENTOR_STARS, stars: MENTOR_STARS - 1, speed, F0: 1.2, shown: 0, hpShow: { a: 1, b: 1 }, hpChip: { a: 1, b: 1 },
    end: Infinity, say: res.won ? say.win : pickSay(say.lose) });
  // 등장: 조명 · VS
  msCue(a, 0, (a) => { a.spotT = 0.5; a.zoomT = 1.05; });
  msCue(a, 0.3, (a, W, H) => { msHit(a, 0.05, 4); msFx(a, { kind: 'stamp', text: 'VS', x: W / 2, y: H * 0.45, col: '#ffb13b', size: 32, rot: 0, life: 0.8 }); });
  msCue(a, 1.0, (a) => { a.fx = a.fx.filter((x) => x.text !== 'VS'); a.spotT = 0.2; a.zoomT = 1; });
  mentorUi.anim = a;
}
// 승부가 끝난 순간 (마지막 한 방) — 그 뒤 일정은 이 시각 기준
function msDuelFinish(a, W, H, P) {
  const D = a.lt;
  a.finished = true; a.slow = 1;
  msHit(a, 0.22, 11, '#ffffff');
  a.zoom = 1.16; a.zoomT = 1;
  if (a.ok) {
    a.m.kneelAt = D;
    msBurst(a, P.mx, P.gy - 60, 18, ['#ffffff', '#ffd0a0', '#ff8080'], 240, { g: 300, life: 0.5, size: 4 });
    msDust(a, P.mx, P.gy, 10);
    msCue(a, D + 0.45, (a) => msSay(a, a.say));
    msCue(a, D + 0.9, (a, W, H, P) => { a.bigStar = { at: a.lt, x: Math.round(W * 0.47), y: 96, big: true }; a.flash = { col: '#ffe9a0', a: 0.6 }; msBurst(a, Math.round(W * 0.47), 96, 22, ['#fff1b0', '#ffd257', '#ffffff'], 170, { g: 60, life: 0.7 }); });
    msCue(a, D + 1.8, (a, W, H, P) => {
      msHit(a, 0.12, 8, '#fff1b0');
      a.stars = MENTOR_STARS; a.slotPop = { k: MENTOR_STARS - 1, at: a.lt }; a.bigStar = null;
      const c = starSlot(W, MENTOR_STARS - 1);
      msRing(a, c.x, c.y, '#ffe9a0', 60, 0.5); msRing(a, c.x, c.y, '#ffffff', 34, 0.3);
      msBurst(a, c.x, c.y, 28, ['#fff1b0', '#ffd257', '#ffffff', '#ffb13b'], 250, { g: 260, life: 0.7 });
    });
    msCue(a, D + 1.95, (a, W, H) => { msHit(a, 0.05, 6); msFx(a, { kind: 'stamp', text: '수료!', x: W * 0.44, y: H * 0.44, col: '#ffe066', size: 34, rot: -0.16 }); msConfetti(a, W, 50); a.spotT = 0; a.k.hop = a.lt; });
    a.end = D + 4.0;
  } else {
    msLaunch(a);
    msBurst(a, P.kx + 6, P.gy - 34, 16, ['#ffffff', '#ff8080', '#ffd0a0'], 230, { g: 300, life: 0.45, size: 4 });
    msFx(a, { kind: 'sfx', text: '쾅!', x: P.kx + 20, y: P.gy - 78, col: '#ff6b6b', size: 30, rot: -0.15 });
    msCue(a, D + 0.45, (a) => msSay(a, a.say));
    msCue(a, D + 0.75, (a, W, H) => { msHit(a, 0.04, 5); msFx(a, { kind: 'stamp', text: '패배', x: W * 0.44, y: H * 0.42, col: '#ff5a5a', size: 30, rot: -0.2 }); a.spotT = 0; });
    a.end = D + 2.8;
  }
}
// 무대를 누르면 끝 장면으로 건너뛴다 (남은 일은 효과 없이 상태만 반영)
function mentorSkip() {
  const a = mentorUi.anim;
  if (!a || a.skipped) return;
  a.skipped = true;
  if (a.kind === 'duel' && !a.finished) { const f = a.res.fight; a.shown = f.events.length; a.finished = true; a.hpShow = { a: f.events.length ? f.events[f.events.length - 1].hpA / f.maxA : 1, b: f.events.length ? f.events[f.events.length - 1].hpB / f.maxB : 1 }; if (a.ok) a.m.kneelAt = a.lt - 1; else Object.assign(a.k, { sit: true, ox: -60 }); }
  a.stars = a.ok ? a.star : a.stars;
  a.cues = []; a.parts = []; a.fx = a.fx.filter((x) => x.kind === 'stamp' && x.text !== 'VS');
  a.bigStar = null; a.stop = 0; a.slow = 1; a.spotT = 0; a.zoomT = 1; a.pulse = 0;
  if (!a.ok && a.kind === 'try') Object.assign(a.k, { fly: false, lift: 0, rot: 0, sit: true, ox: -60 });
  if (a.bubble || a.say) a.bubble = { text: a.say, at: -99 };
  a.end = Math.min(a.end, a.lt + 1.1);
}

// 연출 시계·물리 한 프레임
function msStep(a, dt, W, H, P) {
  if (a.stop > 0) { a.stop -= dt; dt = 0; } else dt *= a.slow;
  a.lt += dt;
  while (a.cues.length && a.cues[0][0] <= a.lt) a.cues.shift()[1](a, W, H, P);
  msStepParts(a, dt);
  for (const x of a.fx) x.age += dt;
  a.fx = a.fx.filter((x) => x.kind === 'stamp' ? x.age < (x.life || 99) : x.kind === 'banner' ? x.age < 1.6 : x.age < 0.8);
  const k = a.k;
  if (k.fly) {
    k.ox += k.vx * dt; k.lift += k.vy * dt; k.vy -= 1000 * dt; k.rot += k.spin * dt;
    if (P.kx0 + k.ox < 26) { k.ox = 26 - P.kx0; k.vx = Math.abs(k.vx) * 0.3; }
    if (k.lift <= 0 && k.vy < 0) {
      if (!k.bounced) { k.bounced = true; k.lift = 0; k.vy = -k.vy * 0.32; k.vx *= 0.35; k.spin *= 0.3; msDust(a, P.kx0 + k.ox, P.gy, 8); a.shake = Math.max(a.shake, 4); }
      else { Object.assign(k, { fly: false, lift: 0, vx: 0, vy: 0, rot: 0, spin: 0, sit: true }); msDust(a, P.kx0 + k.ox, P.gy, 5); }
    }
  }
  const ease = 1 - Math.exp(-dt * 8);
  a.zoom += (a.zoomT - a.zoom) * ease; a.spot += (a.spotT - a.spot) * ease;
  a.shake *= Math.exp(-(dt || 0.016) * 9);
  if (a.flash) { a.flash.a -= (dt || 0.016) * 6; if (a.flash.a <= 0) a.flash = null; }
}

// ───────────────────────── 그리기 (캠프 마을 탭이 열려 있는 동안 매 프레임) ─────────────────────────
function drawMentorStage() {
  const cv = document.querySelector('canvas.mstage');
  if (!cv) return;
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  if (!W) return;
  const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.imageSmoothingEnabled = false;
  const i = mentorView(), m = MENTORS[i], t = clock;
  const a = mentorUi.anim && mentorUi.anim.i === i ? mentorUi.anim : null;
  const gy = H - 26, kx0 = Math.round(W * 0.27), mx = Math.round(W * 0.7);
  const ranged = msIsRanged();
  const kDash = ranged ? kx0 + 20 : Math.max(kx0, mx - 96);

  // 연출 시계·위치 (P: cue 가 쓰는 자리)
  const dt = a ? Math.min(0.05, Math.max(0, clock - (a.last == null ? clock : a.last))) : 0;
  // 기사 자리: 수련은 달려 들어가 공격 → 반걸음 물러나 결과를 기다린다, 승부는 처음부터 맞선 자리
  const kBase = (lt) => (a.kind === 'duel' ? kDash : lt < 0.2 ? kx0 + (kDash - kx0) * msEase(lt / 0.2) : lt < a.R0 ? kDash : kDash - 14 * msEase((lt - a.R0) / 0.15));
  let kx = kx0;
  if (a) {
    a.last = clock;
    msStep(a, dt, W, H, { W, H, gy, kx0, mx, kx: kBase(a.lt) + a.k.ox, cx: Math.round((kDash + mx) / 2 + 14), cy: gy - 58 });
    kx = kBase(a.lt) + a.k.ox;
    // 끝나 갈 때 제자리로 걸어 돌아간다
    const back = a.end - a.lt;
    if (back < 0.45 && !a.k.fly) { const p = 1 - back / 0.45; kx = kx + (kx0 - kx) * msEase(p); }
    // 승부: 결과 처리
    if (a.kind === 'duel') msDuelEvents(a, W, H, { W, H, gy, kx0, mx, kx, cx: Math.round((kDash + mx) / 2 + 14), cy: gy - 58 });
  }

  // 카메라: 흔들림 · 확대 (기사와 교관 사이를 중심으로)
  g.save();
  if (a && a.shake > 0.3) g.translate(Math.round((Math.random() - 0.5) * a.shake * 2), Math.round((Math.random() - 0.5) * a.shake));
  if (a && Math.abs(a.zoom - 1) > 0.002) { const zx = (kDash + mx) / 2, zy = gy - 50; g.translate(zx, zy); g.scale(a.zoom, a.zoom); g.translate(-zx, -zy); }
  g.clearRect(-40, -40, W + 80, H + 80);
  drawMentorBg(g, m, W, H, gy, t);
  // 조명: 배경을 어둡게 누르고 두 사람 발밑만 밝게
  if (a && a.spot > 0.01) {
    msR(g, -40, -40, W + 80, H + 80, `rgba(8,6,18,${a.spot.toFixed(3)})`);
    g.fillStyle = `rgba(255,236,190,${(a.spot * 0.22).toFixed(3)})`;
    g.beginPath(); g.ellipse((kDash + mx) / 2, gy + 4, (mx - kDash) / 2 + 70, 14, 0, 0, Math.PI * 2); g.fill();
  }

  // ── 자세
  const kPose = { mode: 'fight', swing: -1, combo: 0, facing: 1, t };
  const mPose = { dx: 0, lean: 0, nod: 0, kneel: 0 };
  let bubble = null, stars = mentorStarsOf(i), pulse = 0, slotPop = null;
  const breath = Math.round(Math.sin(t * 2.4) * 0.6);
  if (a) {
    stars = a.stars; pulse = a.pulse;
    if (a.slotPop) slotPop = { k: a.slotPop.k, age: a.lt - a.slotPop.at };
    if (a.bubble) bubble = { text: a.bubble.text, n: (a.lt - a.bubble.at) * 26 };
    const lt = a.lt;
    if (a.kind === 'try') {
      for (let k = 0; k < a.swings; k++) { const p = (lt - (0.24 + k * 0.36)) / 0.3; if (p >= 0 && p < 1) { kPose.swing = p; kPose.combo = k; } }
      if (a.m.recoilAt != null && lt - a.m.recoilAt < 0.14) { mPose.lean = 0.07; mPose.dx = 6; }
      const r = lt - a.R;
      if (!a.ok && r >= 0) {
        // 교관: 크게 젖혔다가(예비 동작) 내딛어 내려친다
        if (r < 0.14) { mPose.lean = 0.12 * msEase(r / 0.14); mPose.dx = 9 * msEase(r / 0.14); }
        else if (r < 0.22) { const p = (r - 0.14) / 0.08; mPose.lean = 0.12 - 0.24 * p; mPose.dx = 9 - 55 * p; }
        else if (r < 0.75) { mPose.lean = -0.12; mPose.dx = -46; }
        else { const p = Math.min(1, (r - 0.75) / 0.35); mPose.lean = -0.12 * (1 - p); mPose.dx = -46 * (1 - msEase(p)); }
      }
      if (a.ok && r >= 0 && r < 0.75) mPose.nod = Math.sin(r / 0.375 * Math.PI) > 0 ? 1 : 0;
    } else {
      const La = a.last_a, Lb = a.last_b;
      if (La && a.lt - La.at < 0.3) { kPose.swing = (a.lt - La.at) / 0.3; kPose.combo = La.n; }
      if (Lb && a.lt - Lb.at < 0.28) { const p = (a.lt - Lb.at) / 0.28; mPose.dx = -Math.round(Math.sin(p * Math.PI) * 26); mPose.lean = -0.08 * Math.sin(p * Math.PI); }
      if (a.m.kneelAt != null) { const p = Math.min(1, (a.lt - a.m.kneelAt) / 0.35); mPose.kneel = msEase(p); mPose.dx = 10 * msEase(p); mPose.lean = 0.06 * msEase(p); }
    }
    if (a.m.flashUntil > a.lt) mPose.flash = true;
    if (a.k.flashUntil > a.lt) kPose.flash = true;
    if (a.k.sit) kPose.mode = 'sit';
    if (a.k.hop != null) { const p = (a.lt - a.k.hop) / 0.35; if (p >= 0 && p < 1) a.k.lift = Math.sin(p * Math.PI) * 16; else if (!a.k.fly) a.k.lift = 0; }
    if (a.end - a.lt < 0.45 && !a.k.fly && (a.k.sit || kx !== kx0)) { kPose.mode = 'walk'; kPose.walkT = a.lt; kPose.facing = -1; a.k.sit = false; }
  } else if (mentorDone(i) && Math.sin(t * 0.5) > 0.2) bubble = { text: MENTOR_SAY[m.id].done, n: 99 };

  // ── 교관 · 기사
  drawMentorFig(g, m.id, mx, gy + (a ? 0 : breath), mPose);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(kx - 14, gy - 1, 28, 2);
  if (a && (a.k.lift || a.k.rot)) {
    g.save(); g.translate(kx, gy - a.k.lift - 22); g.rotate(a.k.rot); g.translate(0, 22);
    drawHero(g, S.cls, 0, 0, kPose); g.restore();
  } else drawHero(g, S.cls, kx, gy, kPose);
  // 원거리 직업: 맞는 순간 화살·마법이 날아가는 줄
  if (a && a.kind === 'try' && ranged) for (let k = 0; k < a.swings; k++) {
    const p = (a.lt - (0.24 + k * 0.36 + 0.03)) / 0.08;
    if (p >= 0 && p < 1) { const x0 = kx + 14, x1 = mx - 46, x = x0 + (x1 - x0) * p; msR(g, Math.round(x - 14), gy - 26, 14, 2, '#fff1b0'); }
  }
  // 교관의 내려치기 궤적
  if (a && a.kind === 'try' && !a.ok) {
    const p = (a.lt - a.R - 0.14) / 0.18;
    if (p >= 0 && p < 1) { g.save(); g.globalAlpha = 1 - p; g.strokeStyle = '#ffffff'; g.lineWidth = 7; g.beginPath(); g.arc(mx - 40, gy - 70, 52, -2.6 + p * 0.5, -0.4 + p * 1.4); g.stroke(); g.lineWidth = 3; g.strokeStyle = '#ffd0a0'; g.stroke(); g.restore(); }
  }
  if (a && a.kind === 'duel') msDrawDuelHud(g, a, W, H, gy, kx, mx);
  if (a) msDrawParts(g, a);

  // 떠 있는 큰 별 (빛줄기) → 별 칸으로 날아간다
  if (a && a.bigStar) {
    const b = a.bigStar, age = a.lt - b.at, fly0 = b.big ? 0.9 : 0.6, flyD = b.big ? 0.35 : 0.3;
    const c = starSlot(W, a.star - 1);
    let x = b.x, y = b.y + Math.sin(age * 5) * 3, sc = age < 0.18 ? 1.5 * msEase(age / 0.18) : 1.5 - 0.25 * Math.min(1, (age - 0.18) / 0.15);
    if (b.big) sc *= 1.25;
    if (age >= fly0) {
      const p = Math.min(1, (age - fly0) / flyD), e = p * p;
      x = b.x + (c.x - b.x) * e; y = b.y + (c.y - b.y) * e; sc = sc * (1 - e) + 1.6 * e;
      a.parts.push({ x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8, vx: 0, vy: 20, g: 0, life: 0.3, max: 0.3, s: 3, col: Math.random() < 0.5 ? '#fff1b0' : '#ffd257', kind: 'sq' });
    } else {
      // 빛줄기 (돌아간다)
      g.save(); g.translate(x, y); g.rotate(age * 1.8);
      g.globalAlpha = 0.28 * Math.min(1, age / 0.2);
      for (let r = 0; r < 10; r++) { g.rotate(Math.PI / 5); g.fillStyle = r % 2 ? '#fff1b0' : '#ffd257'; g.beginPath(); g.moveTo(0, 0); g.lineTo(95 * sc / 1.5, -10); g.lineTo(95 * sc / 1.5, 10); g.closePath(); g.fill(); }
      g.restore(); g.globalAlpha = 1;
      if (Math.random() < 0.4) a.parts.push({ x: x + (Math.random() - 0.5) * 50, y: y + (Math.random() - 0.5) * 40, vx: 0, vy: -20, g: 0, life: 0.4, max: 0.4, s: 2, col: '#ffffff', kind: 'sq' });
    }
    drawStarC(g, Math.round(x), Math.round(y), 6 * sc, '#b8860b');
    drawStarC(g, Math.round(x), Math.round(y), 5 * sc, '#ffe066');
    drawStarC(g, Math.round(x), Math.round(y), 2.6 * sc, '#fff8d8');
  }
  g.restore();

  // 화면 위에 붙는 것: 말풍선 · 별 칸 · 글자 효과 · 번쩍
  if (bubble) drawBubble(g, bubble.text, mx - 30, gy - MS_H * MS_CELL - 14, W, bubble.n);
  drawStarBar(g, W, stars, t, pulse, slotPop);
  if (a) for (const x of a.fx) drawFxText(g, x, W, H);
  if (a && a.flash) { g.globalAlpha = Math.max(0, Math.min(1, a.flash.a)) * 0.85; msR(g, 0, 0, W, H, a.flash.col); g.globalAlpha = 1; }

  // 연출이 끝나면 화면(버튼·별 표시)을 다시 그린다
  if (a && a.lt > a.end) {
    mentorUi.anim = null;
    if (typeof renderCamp === 'function' && campOpen) renderCamp();
  }
}

// 승부: 서버 기록을 연출 시계에 맞춰 꺼낸다 (타격마다 멈칫·입자, 마지막 한 방은 슬로 모션 → msDuelFinish)
function msDuelEvents(a, W, H, P) {
  const f = a.res.fight;
  if (a.finished) return;
  const pt = Math.max(0, a.lt - a.F0) * a.speed;
  const lastEv = f.events[f.events.length - 1];
  if (lastEv && a.shown === f.events.length - 1 && pt > lastEv.t - 0.45 * a.speed) a.slow = 0.3;
  while (a.shown < f.events.length && f.events[a.shown].t <= pt) {
    const e = f.events[a.shown++], toB = e.by === 'a';
    const big = e.kind === 'skill' || e.crit;
    if (toB) { a.last_a = { at: a.lt, n: (a.last_a ? a.last_a.n : 0) + 1 }; a.m.flashUntil = a.lt + 0.06; }
    else { a.last_b = { at: a.lt, n: (a.last_b ? a.last_b.n : 0) + 1 }; a.k.flashUntil = a.lt + 0.06; }
    a.hpShow.a = e.hpA / f.maxA; a.hpShow.b = e.hpB / f.maxB;
    const x = toB ? P.mx - 30 : P.kx + 6, y = toB ? P.gy - 70 : P.gy - 34;
    msHit(a, big ? 0.08 : 0.03, big ? 5 : 2);
    msBurst(a, x, y, big ? 12 : 5, big ? ['#ffffff', '#ffb13b', '#ffe9a0'] : ['#ffffff', '#e8e2d0'], big ? 220 : 140, { g: 260, life: 0.35 });
    if (big) msRing(a, x, y, e.crit ? '#ffb13b' : '#9fe6ff', 40, 0.3);
    msFx(a, { kind: 'sfx', text: (e.crit ? '💥' : '') + fmt(e.dmg), x: x + (Math.random() - 0.5) * 16, y: y - 20, col: e.crit ? '#ffb13b' : e.kind === 'skill' ? '#9fe6ff' : '#ffffff', size: big ? 18 : 13 });
    if (e.kind === 'skill' && SKILLS[e.sk]) msFx(a, { kind: 'sfx', text: SKILLS[e.sk].name, x: toB ? P.kx + 10 : P.mx, y: toB ? P.gy - 96 : P.gy - 150, col: '#c9a7ff', size: 14 });
  }
  if (a.shown >= f.events.length && pt >= f.dur) msDuelFinish(a, W, H, P);
}
// 승부 체력 바 (바닥 위, 맞으면 흰 잔상이 천천히 줄어든다)
function msDrawDuelHud(g, a, W, H, gy, kx, mx) {
  for (const [side, x, col, w] of [['a', kx, '#5fcf5a', 48], ['b', mx, '#ff5a5a', 84]]) {
    const hp = Math.max(0, a.hpShow[side]);
    a.hpChip[side] += (hp - a.hpChip[side]) * 0.08;
    msR(g, x - w / 2, gy + 9, w, 8, '#1a1424');
    msR(g, x - w / 2 + 1, gy + 10, Math.round((w - 2) * Math.max(hp, a.hpChip[side])), 6, '#f3efe6');
    msR(g, x - w / 2 + 1, gy + 10, Math.round((w - 2) * hp), 6, col);
  }
}
// 지금 무대에 세울 교관 (고른 칩, 없으면 지금 수련할 교관)
function mentorView() {
  const cur = Math.min(mentorCur(), MENTORS.length - 1);
  const v = mentorUi.view;
  return v != null && v <= cur && v >= 0 ? v : cur;
}
