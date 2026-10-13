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
function drawStarBar(g, W, n, t, slam) {
  const s = 4, gap = 8, sw = 5 * s, total = MENTOR_STARS * sw + (MENTOR_STARS - 1) * gap;
  const x0 = Math.round((W - total) / 2), y0 = 10;
  msR(g, x0 - 8, y0 - 5, total + 16, sw + 10, 'rgba(10,8,20,.55)');
  for (let k = 0; k < MENTOR_STARS; k++) {
    const x = x0 + k * (sw + gap), on = k < n, fin = k === MENTOR_STARS - 1;
    if (on) drawStarPx(g, x, y0, s, fin ? '#ffe9a0' : '#ffd257');
    else {
      drawStarPx(g, x, y0, s, fin ? '#5a2a34' : '#33304a');
      if (k === n && Math.sin(t * 5) > 0) drawStarPx(g, x + s, y0 + s, s * 0.6, fin ? '#a04a5a' : '#5a5680');
    }
  }
  // 별이 날아와 박힌다: slam = { k, p(0~1 비행), hit(박힌 뒤 경과초) }
  if (slam) {
    const x = x0 + slam.k * (sw + gap), tx = x, ty = y0;
    if (slam.p < 1) {
      const sc = s * (3 - 2 * slam.p), sx = slam.fromX + (tx - slam.fromX) * slam.p, sy = slam.fromY + (ty - slam.fromY) * slam.p * slam.p;
      drawStarPx(g, sx - (sc * 5 - sw) / 2, sy - (sc * 5 - sw) / 2, sc, '#fff1b0');
    } else if (slam.hit < 0.5) {
      const r = 6 + slam.hit * 60;
      g.globalAlpha = 1 - slam.hit * 2;
      g.strokeStyle = '#ffe9a0'; g.lineWidth = 3;
      g.strokeRect(Math.round(x + sw / 2 - r / 2), Math.round(y0 + sw / 2 - r / 2), Math.round(r), Math.round(r));
      g.globalAlpha = 1;
    }
  }
}
function msFont(px, bold) { return `${bold ? 800 : 400} ${px}px Galmuri11, -apple-system, sans-serif`; }
function drawBubble(g, text, x, y, W) {
  g.font = msFont(12);
  const w = Math.ceil(g.measureText(text).width) + 16, h = 22;
  const bx = Math.max(4, Math.min(W - w - 4, Math.round(x - w + 18))), by = Math.round(y - h);
  msR(g, bx, by, w, h, '#2a2838'); msR(g, bx + 2, by + 2, w - 4, h - 4, '#f3efe6');
  const tx = Math.max(bx + 8, Math.min(bx + w - 14, Math.round(x)));
  msR(g, tx, by + h - 2, 6, 2, '#f3efe6'); msR(g, tx + 2, by + h, 4, 2, '#2a2838'); msR(g, tx + 2, by + h - 2, 2, 2, '#f3efe6'); msR(g, tx + 4, by + h + 2, 2, 2, '#2a2838');
  g.fillStyle = '#2a2838'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(text, bx + 8, by + h / 2 + 1);
}
function drawPop(g, text, x, y, age, col) {
  const sc = age < 0.12 ? 0.6 + age / 0.12 * 0.6 : age < 0.22 ? 1.2 - (age - 0.12) / 0.1 * 0.2 : 1;
  g.save();
  g.translate(Math.round(x), Math.round(y)); g.scale(sc, sc);
  g.font = msFont(26, true); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = '#1a1424'; g.lineJoin = 'round';
  g.strokeText(text, 0, 0); g.fillStyle = col; g.fillText(text, 0, 0);
  g.restore();
}
function drawSpark(g, x, y, age) {
  if (age < 0 || age > 0.18) return;
  const r = 4 + age * 60;
  g.fillStyle = age < 0.08 ? '#ffffff' : '#ffe9a0';
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) g.fillRect(Math.round(x + dx * r), Math.round(y + dy * r), 3, 3);
}
// 교관이 내리치는 궤적 (반달 모양 흰 획)
function drawSlash(g, x, y, p) {
  if (p < 0 || p > 1) return;
  g.save(); g.globalAlpha = 1 - p; g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.lineCap = 'square';
  g.beginPath(); g.arc(Math.round(x), Math.round(y), 34, -2.4 + p * 0.6, -0.6 + p * 1.2); g.stroke();
  g.restore();
}

// ───────────────────────── 연출 시작 ─────────────────────────
const pickSay = (arr) => arr[Math.floor(Math.random() * arr.length)];
// ★1~4 수련 연출 (결과 r = mentorTry 의 반환)
function mentorPlayTry(i, r) {
  const m = MENTORS[i], say = MENTOR_SAY[m.id];
  const swings = Math.random() < 0.5 ? 1 : 2;
  const R = 0.35 + swings * 0.42;                         // 결과가 나는 시각
  mentorUi.anim = { kind: 'try', i, ok: r.ok, star: r.star, t0: clock, swings, R, end: R + (r.ok ? 2.3 : 1.9),
    say: pickSay(r.ok ? say.ok : say.fail), before: r.star - 1 };
}
// 승부 연출 (서버 결과 res)
function mentorPlayDuel(i, res) {
  const f = res.fight, say = MENTOR_SAY[MENTORS[i].id];
  const speed = Math.max(1, f.dur / 7);
  const play = 0.8 + f.dur / speed;
  mentorUi.anim = { kind: 'duel', i, res, t0: clock, speed, play, end: play + (res.won ? 3 : 2.4), shown: 0, last: {}, hit: {}, floats: [],
    say: res.won ? say.win : pickSay(say.lose), before: MENTOR_STARS - 1, star: MENTOR_STARS, ok: res.won };
}
// 무대를 누르면 끝으로 건너뛴다 (별이 박히는 마지막 장면은 보여 준다)
function mentorSkip() {
  const a = mentorUi.anim;
  if (!a) return;
  const at = a.kind === 'try' ? a.R + (a.ok ? 1.3 : 0.5) : a.play + 0.1;
  if (clock - a.t0 < at) a.t0 = clock - at;
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
  const at = a ? clock - a.t0 : 0;
  const gy = H - 26, kx0 = Math.round(W * 0.27), mx = Math.round(W * 0.7);

  // 흔들림
  let shake = 0;
  if (a && a.kind === 'try' && !a.ok && at > a.R + 0.18 && at < a.R + 0.42) shake = 4;
  if (a && a.slamAt != null && at - a.slamAt >= 0 && at - a.slamAt < 0.2) shake = 3;
  g.save();
  if (shake) g.translate(Math.round((Math.random() - 0.5) * shake * 2), Math.round((Math.random() - 0.5) * shake));
  g.clearRect(-8, -8, W + 16, H + 16);
  drawMentorBg(g, m, W, H, gy, t);

  const kPose = { mode: 'fight', swing: -1, combo: 0, facing: 1, t };
  const mPose = { dx: 0 };
  let kx = kx0, bubble = null, pop = null, slam = null, stars = mentorStarsOf(i);
  const breath = Math.round(Math.sin(t * 2.4) * 0.6);

  if (a && a.kind === 'try') {
    stars = a.before;
    const step = Math.min(1, at / 0.35);
    kx = kx0 + Math.round(step * 22);
    for (let s = 0; s < a.swings; s++) {
      const s0 = 0.35 + s * 0.42, p = (at - s0) / 0.4;
      if (p >= 0 && p < 1) { kPose.swing = p; kPose.combo = s; mPose.lean = 0.05; mPose.dx = 3; }
    }
    const r = at - a.R;
    if (r >= 0) {
      kPose.swing = -1;
      if (!a.ok) {
        // 교관이 한 대 친다 → 기사가 밀려난다
        mPose.dx = r < 0.25 ? -Math.round(Math.sin(r / 0.25 * Math.PI) * 26) : 0;
        mPose.lean = r < 0.25 ? -0.08 : 0;
        if (r > 0.18) kx = kx0 + 22 - Math.round(Math.min(1, (r - 0.18) / 0.35) * 30);
        kPose.flash = r > 0.18 && r < 0.26;
        if (r > 0.18 && r < 0.5) kPose.mode = 'sit';
        bubble = r > 0.15 ? a.say : null;
        if (r > 0.45) pop = { text: '탈락…', age: r - 0.45, col: '#ff8080' };
      } else {
        // 끄덕끄덕 → 성공! → 별이 날아와 박힌다
        mPose.nod = r < 0.7 ? (Math.sin(r / 0.35 * Math.PI) > 0 ? 1 : 0) : 0;
        kx = kx0 + 22 - Math.round(Math.min(1, r / 0.6) * 22);
        bubble = r > 0.05 ? a.say : null;
        if (r > 0.75) pop = { text: '성공!', age: r - 0.75, col: '#ffe066' };
        const fly = (r - 0.95) / 0.35;
        if (fly >= 0) {
          a.slamAt = a.R + 1.3;
          slam = { k: a.star - 1, p: Math.min(1, fly), hit: Math.max(0, r - 1.3), fromX: mx - 20, fromY: gy - 140 };
          if (fly >= 1) stars = a.star;
        }
      }
    }
  } else if (a && a.kind === 'duel') {
    stars = a.before;
    const f = a.res.fight, pt = Math.min(f.dur, Math.max(0, at - 0.8) * a.speed);
    while (a.shown < f.events.length && f.events[a.shown].t <= pt) {
      const e = f.events[a.shown++], target = e.by === 'a' ? 'b' : 'a';
      a.last[e.by] = { e, at: clock, n: (a.last[e.by] ? a.last[e.by].n : 0) + 1 };
      a.hit[target] = clock;
      const big = e.kind === 'skill' || e.crit;
      a.floats.push({ text: (e.crit ? '💥' : '') + fmt(e.dmg), x: (target === 'a' ? kx0 + 22 : mx) + (Math.random() - 0.5) * 20, y: target === 'a' ? gy - 70 : gy - 120, at: clock, col: e.crit ? '#ffb13b' : e.kind === 'skill' ? '#9fe6ff' : '#ffffff', big });
      if (e.kind === 'skill') a.floats.push({ text: SKILLS[e.sk] ? SKILLS[e.sk].name : '기술', x: e.by === 'a' ? kx0 + 22 : mx, y: e.by === 'a' ? gy - 92 : gy - 150, at: clock, col: '#c9a7ff', big: false, label: true });
    }
    kx = kx0 + 22;
    const La = a.last.a, Lb = a.last.b;
    if (La && clock - La.at < 0.35) { kPose.swing = (clock - La.at) / 0.35; kPose.combo = La.n; }
    if (Lb && clock - Lb.at < 0.3) { const p = (clock - Lb.at) / 0.3; mPose.dx = -Math.round(Math.sin(p * Math.PI) * 20); mPose.lean = -0.06; }
    kPose.flash = a.hit.a != null && clock - a.hit.a < 0.08;
    mPose.flash = a.hit.b != null && clock - a.hit.b < 0.08;
    const lastEv = a.shown ? f.events[a.shown - 1] : null;
    const hpA = lastEv ? lastEv.hpA / f.maxA : 1, hpB = lastEv ? lastEv.hpB / f.maxB : 1;
    const done = at >= a.play;
    const r = at - a.play;
    if (done) {
      kPose.swing = -1;
      if (a.ok) {
        mPose.kneel = Math.min(1, r / 0.4); mPose.dx = 0; mPose.lean = 0;
        bubble = r > 0.3 ? a.say : null;
        if (r > 0.9) pop = { text: '수료!', age: r - 0.9, col: '#ffe066' };
        const fly = (r - 1.1) / 0.35;
        if (fly >= 0) { a.slamAt = a.play + 1.45; slam = { k: MENTOR_STARS - 1, p: Math.min(1, fly), hit: Math.max(0, r - 1.45), fromX: mx - 20, fromY: gy - 140 }; if (fly >= 1) stars = MENTOR_STARS; }
      } else {
        kPose.mode = 'sit';
        bubble = r > 0.3 ? a.say : null;
        if (r > 0.6) pop = { text: '패배', age: r - 0.6, col: '#ff8080' };
      }
    }
    // 체력 바 (바닥 위 — 말풍선·별에 가리지 않게)
    for (const [x, hp, col, w] of [[kx, hpA, '#5fcf5a', 44], [mx, hpB, '#ff5a5a', 80]]) {
      msR(g, x - w / 2, gy + 9, w, 7, '#1a1424'); msR(g, x - w / 2 + 1, gy + 10, Math.round((w - 2) * Math.max(0, hp)), 5, col);
    }
  } else {
    // 대기: 교관은 숨쉬고, 다 받은 교관은 수료 대사
    if (mentorDone(i) && Math.sin(t * 0.5) > 0.2) bubble = MENTOR_SAY[m.id].done;
  }

  // 교관 · 기사
  drawMentorFig(g, m.id, mx, gy + (a ? 0 : breath), mPose);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(kx - 14, gy - 1, 28, 2);
  drawHero(g, S.cls, kx, gy, kPose);
  if (a && a.kind === 'try') for (let s = 0; s < a.swings; s++) drawSpark(g, mx - 30, gy - 58, at - (0.35 + s * 0.42) - 0.16);
  if (a && a.kind === 'try' && !a.ok) drawSlash(g, mx - 26, gy - 70, (at - a.R) / 0.22);

  // 떠오르는 피해 숫자 (승부)
  if (a && a.kind === 'duel') {
    a.floats = a.floats.filter((fl) => clock - fl.at < 0.9);
    for (const fl of a.floats) {
      const age = clock - fl.at;
      g.globalAlpha = Math.max(0, 1 - age / 0.9);
      g.font = msFont(fl.big ? 14 : 12, true); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.75)';
      const y = fl.y - age * 26;
      g.strokeText(fl.text, fl.x, y); g.fillStyle = fl.col; g.fillText(fl.text, fl.x, y);
      g.globalAlpha = 1;
    }
  }

  if (bubble) drawBubble(g, bubble, mx - 30, gy - MS_H * MS_CELL - 14, W);
  if (pop) drawPop(g, pop.text, Math.round((kx0 + mx) / 2), Math.round(H * 0.5), pop.age, pop.col);
  drawStarBar(g, W, stars, t, slam);                // 별은 맨 위 (날아오는 별이 말풍선을 덮는다)
  g.restore();

  // 연출이 끝나면 화면(버튼·별 표시)을 다시 그린다
  if (a && at > a.end) {
    mentorUi.anim = null;
    if (typeof renderCamp === 'function' && campOpen) renderCamp();
  }
}
// 지금 무대에 세울 교관 (고른 칩, 없으면 지금 수련할 교관)
function mentorView() {
  const cur = Math.min(mentorCur(), MENTORS.length - 1);
  const v = mentorUi.view;
  return v != null && v <= cur && v >= 0 ? v : cur;
}
