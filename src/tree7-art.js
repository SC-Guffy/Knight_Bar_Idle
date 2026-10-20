'use strict';
// 시즌7 스킬 빌드 트리 도트 아트 — 노드 아이콘과 노드 틀 (게임 src/tree7-ui.js 와 시안 dev/review/skill-build-tree.html 이 같이 쓴다).
// 그리는 법은 게임 아이콘(dev/make-icons.js)과 같다: 12×12 글자 도트 + 공용 팔레트 → 칠한 칸 상하좌우에 잉크 외곽선 → 14×14.
// 스킬 아이콘(새 액티브·융합·궁극기 변형)은 지금 sk-* 아이콘처럼 모서리 뺀 배지 + 속성색 2톤 바탕, 변형·키스톤은 바탕 없는 상징.
// 노드 틀(액티브 사각·궁극기 금테+왕관·융합 점선·변형 원·키스톤 팔각·스탯 작은 원)도 같은 팔레트의 도트로 그린다 (CSS 테두리·그라디언트 대신).
// 지금 게임 스킬(강철 베기·질풍난무·일섬·천검)과 스탯은 src/skin/icons.png 의 아이콘(sk-* · UI)을 그대로 쓴다.
// 게임은 CSP 가 data: 이미지를 막아서 canvas 에 바로 그린다 (TreeArt.paint). 시안 페이지는 data URL(node·icon)도 쓴다.
(function () {
  const INK = '#0b0a14';
  const PAL = {
    W: '#ebe7dc', S: '#b9b4cc', s: '#8f8aa8', d: '#5e5a78',
    L: '#fff2b8', Y: '#e0c472', y: '#a8842e',
    R: '#d0503f', r: '#8a2a2a', G: '#6cb24e', g: '#3d7a34', B: '#5a9ad8', b: '#33609a',
    O: '#b5793a', o: '#7a4a22', P: '#e2d6b4', p: '#b3a27a', C: '#6fd0d0', c: '#2f8a96',
    V: '#a98ccf', v: '#6f58a8', M: '#e88aa8', m: '#a8506e', E: '#ec9a3c', e: '#b0561e',
    k: '#34324a', K: INK, n: '#1d1928',
  };

  // ── 스킬 배지 (액티브·융합·궁극기 변형) ──
  const BADGE = {
    whirl: [   // 검무 회오리 — 칼날 띠가 겹겹이 도는 깔때기 (연타: 금테 + 짙은 호박 바탕)
      '.yyyyyyyyyy.',
      'yoWWWWWWWWoy',
      'yosSSSSSSdoy',
      'yooWWWWWWooy',
      'yoosSSSSdooy',
      'yoooWWWWoooy',
      'yooLosSdoLoy',
      'yooooWWooooy',
      'yooooSdooooy',
      'yoooooWooooy',
      'yooooooooooy',
      '.yyyyyyyyyy.',
    ],
    flash: [   // 섬광 베기 — 화면 끝까지 그어진 한 줄과 끝의 섬광 (발도: 남색 바탕)
      '.kkkkkkkkkk.',
      'kbbbbbbbbbbk',
      'kbbbbbbbbLbk',
      'kbbbbbbbLWLk',
      'kbbddsssSWbk',
      'kWWWWWWWWWWk',
      'kbbddsssSWbk',
      'kbbbbbbbLWLk',
      'kbbbbbbbbLbk',
      'kBbbbbbbbbbk',
      'kbbbbbbbbbbk',
      '.kkkkkkkkkk.',
    ],
    wave: [   // 비검 — 부채꼴로 날아가는 초승달 검기 세 발 (검기: 주황 바탕)
      '.rrrrrrrrrr.',
      'reeeeeeWWeer',
      'reeeeeeeLWer',
      'reWWeeeeLWer',
      'reeLWeeWWeer',
      'reeLWeeeeeer',
      'reWWeeeWWeer',
      'reeeeeeeLWer',
      'reeeeeeeLWer',
      'reeeeeeWWeer',
      'reeeeeeeeeer',
      '.rrrrrrrrrr.',
    ],
    storm: [   // 검기 폭풍 — 한가운데서 여덟 방향으로 뿜는 검기
      '.rrrrrrrrrr.',
      'rWeeeeWeeeWr',
      'reWeeeWeeWer',
      'reeWeLLLWeer',
      'reeeLYYYLeer',
      'rWWWLYWYLWWr',
      'reeeLYYYLeer',
      'reeWeLLLWeer',
      'reWeeeWeeWer',
      'rWeeeeWeeeWr',
      'reeeeeeeeeer',
      '.rrrrrrrrrr.',
    ],
    f_ab: [   // 질풍 일섬 — 난무의 X 를 일섬 한 줄이 꿰뚫는다 (융합: 분홍 바탕)
      '.vvvvvvvvvv.',
      'vWmmmmmmmmWv',
      'vmWmmmmmmWmv',
      'vmmWmmmmWmmv',
      'vmmmWmmWmmmv',
      'vssSSWWSSLWv',
      'vmmmWmmWmmLv',
      'vmmWmmmmWmmv',
      'vmWmmmmmmWmv',
      'vWmmmmmmmmWv',
      'vmmmmmmmmmmv',
      '.vvvvvvvvvv.',
    ],
    f_bk: [   // 섬광 검기 — 일섬이 지나간 줄 위아래로 검기가 터진다
      '.vvvvvvvvvv.',
      'vmmmmmmmmmmv',
      'vmmWmmmWmmmv',
      'vmLWmmLWmmmv',
      'vmmWmmmWmmmv',
      'vssSSSSSSWWv',
      'vmmmWmmmWmmv',
      'vmmLWmmLWmmv',
      'vmmmWmmmWmmv',
      'vmmmmmmmmmmv',
      'vmmmmmmmmmmv',
      '.vvvvvvvvvv.',
    ],
    f_ak: [   // 칼날 폭풍 — 도는 회오리에서 검기가 흩뿌려진다
      '.vvvvvvvvvv.',
      'vWWWWWWWWmWv',
      'vmsdddddsmmv',
      'vWmWWWWWmmmv',
      'vLWmsddsmmWv',
      'vmmmWWWmmLWv',
      'vmmmmsdmmmWv',
      'vWmmmWWmmmmv',
      'vLWmmsmmmmmv',
      'vWmmmWmmmmmv',
      'vmmmmmmmmmmv',
      '.vvvvvvvvvv.',
    ],
    uv_a: [   // 천검: 만검 — 작은 칼자국 수십 개가 쏟아진다 (궁극기 변형: 천검의 금테)
      '.YYYYYYYYYY.',
      'Yrrrrrrrrrry',
      'YrWrrWrrWrry',
      'YrrSrrSrrSry',
      'Yrrrrrrrrrry',
      'YrWrrWrrWrry',
      'YrrSrrSrrSry',
      'Yrrrrrrrrrry',
      'YrWrrWrrWrry',
      'YrrSrrSrrSry',
      'Yrrrrrrrrrry',
      '.yyyyyyyyyy.',
    ],
    uv_b: [   // 천검: 일도양단 — 하나의 거대한 칼이 화면을 두 쪽으로
      '.YYYYYYYYYY.',
      'YrrrrWLrrrry',
      'YrrrrWSrrrry',
      'YrrrrWSrrrry',
      'YmmmrWSrmmmy',
      'YmmmrWSrmmmy',
      'YrrrrWSrrrry',
      'YrrrrWSrrrry',
      'YrrrYYYYrrry',
      'YrrrroorRrry',
      'Yrrrroorrrry',
      '.yyyyyyyyyy.',
    ],
    uv_k: [   // 천검: 검우 — 먹구름에서 검기가 비처럼
      '.YYYYYYYYYY.',
      'YssSSssSSssy',
      'Yddddddddddy',
      'Yrrrrrrrrrry',
      'YrWrrrrWrrry',
      'YrLWrrrLWrry',
      'YrrWrrrrWrry',
      'YrrrrWrrrrry',
      'YrrrrLWrrrry',
      'YrrrrrWrrrry',
      'Yrrrrrrrrrry',
      '.yyyyyyyyyy.',
    ],
  };

  // ── 상징 (변형·키스톤) — 바탕 없이, 틀 안에 들어간다 ──
  const SYM = {
    s_twin: [   // 2연참 — 앞뒤로 두 번 그은 호
      '............',
      '..WW....WW..',
      '.WS......SW.',
      'WS........SW',
      'W..........W',
      'W....RR....W',
      'W....RR....W',
      'W..........W',
      'WS........SW',
      '.WS......SW.',
      '..WW....WW..',
      '............',
    ],
    a_more: [   // 난무 +3타 — 나란한 참격 셋과 금빛 +
      '............',
      '...W..W..W..',
      '..WS.WS.WS..',
      '..WS.WS.WS..',
      '.WS.WS.WS...',
      '.WS.WS.WS...',
      'WS.WS.WS....',
      'WS.WS.WS..Y.',
      'S..S..S..YLY',
      '..........Y.',
      '............',
      '............',
    ],
    a_bleed: [   // 출혈 — 칼끝에서 떨어지는 핏방울
      '.........WS.',
      '........WS..',
      '.......WS...',
      '......WS....',
      '.....WS.....',
      '..d.WS......',
      '..ddS.......',
      '...dd.......',
      '..d..R......',
      '.....RR..R..',
      '....RrR.RrR.',
      '.....r...r..',
    ],
    a_follow: [   // 쫓는 칼날 — 점선 궤적을 그리며 날아가는 칼날
      '............',
      '.........WS.',
      '........WSd.',
      '.......WSd..',
      '......Ld....',
      '.....L......',
      '...LL.......',
      '..L.........',
      '.L..........',
      '.L..........',
      '..L.........',
      '............',
    ],
    a_grow: [   // 제자리 폭풍 — 회오리가 그 자리에서 사방으로 커진다
      '.....Y......',
      '....YLY.....',
      '............',
      '...WWWWWW...',
      '.Y..sddds.Y.',
      'YL...WWW..LY',
      '.Y...sds..Y.',
      '......W.....',
      '............',
      '....YLY.....',
      '.....Y......',
      '............',
    ],
    b_reset: [   // 잔영 — 처치하면 잔상이 되돌아와 다음 적을 한 번 더 벤다 (돌아오는 화살표 + 일섬)
      '............',
      '...LLLLL....',
      '..L.....L...',
      '.L.......L..',
      '.L......LLL.',
      '.L.......L..',
      '............',
      'sSWWWWWWWWWL',
      '............',
      '............',
      '............',
      '............',
    ],
    b_exec: [   // 처형 — 붉은 일섬에 두 동강 난 해골
      '............',
      '............',
      '...WWWWWW...',
      '..WWWWWWWW..',
      '..WkkWWkkW..',
      '..WkkWWkkW..',
      'LRRRRRRRRRRL',
      '...WWWWWW...',
      '...WsWWsW...',
      '....W..W....',
      '............',
      '............',
    ],
    b_after: [   // 잔상 베기 — 한 줄 뒤로 반투명 잔상 한 줄
      '............',
      '............',
      '.........L..',
      '........LWL.',
      'SSWWWWWWWWWL',
      '........LWL.',
      '.........L..',
      '............',
      '.........v..',
      'vvvVVVVVVVVv',
      '.........v..',
      '............',
    ],
    b_triple: [   // 삼중 섬광 — 한 줄 대신 세 줄
      '............',
      '..........L.',
      'sSSWWWWWWWWL',
      '..........L.',
      '............',
      '..........L.',
      'sSSWWWWWWWWL',
      '..........L.',
      '............',
      '..........L.',
      'sSSWWWWWWWWL',
      '..........L.',
    ],
    k_wave: [   // 참격파 — 내려벤 칼끝에서 초승달 검기가 날아간다
      '............',
      '.......WW...',
      '........WL..',
      '.W.......WL.',
      '.SW.......W.',
      '..SW......W.',
      '...SW....WL.',
      '...dSd..WL..',
      '..d..d.WW...',
      '.o..........',
      '............',
      '............',
    ],
    k_pierce: [   // 관통 — 적 둘을 꿰뚫고 지나가는 검기
      '............',
      '............',
      '...R....R...',
      '..RrR..RrR..',
      '...R....R...',
      'SSWWWWWWWWWL',
      '...R....R...',
      '..RrR..RrR..',
      '...R....R...',
      '............',
      '............',
      '............',
    ],
    k_split: [   // 분열 — 검기가 맞힌 자리에서 두 갈래로
      '............',
      '............',
      '.........WL.',
      '........WL..',
      '.......W....',
      'SSWWWWW.....',
      '.......W....',
      '........WL..',
      '.........WL.',
      '............',
      '............',
      '............',
    ],
    k_homing: [   // 유도 검기 — 휘어 날아가 표적에 꽂힌다
      '............',
      '.......RRRR.',
      '......R....R',
      '......R.YY.R',
      '....WLR.YY.R',
      '...L..R....R',
      '..L....RRRR.',
      '.L..........',
      '.L..........',
      '..L.........',
      '............',
      '............',
    ],
    k_blade: [   // 검의 길 — 시계판 위에 세운 칼
      '....SSSS....',
      '..SS.WW.SS..',
      '.S...WW...S.',
      '.S...WW...S.',
      'S....WW....S',
      'S....WWLL..S',
      'S....WW....S',
      '.S...YY...S.',
      '.S..YYYY..S.',
      '..SS.oo.SS..',
      '....SSSS....',
      '............',
    ],
    a_key: [   // 광란 — 불길에 휩싸인 칼
      '.....W......',
      '.....WS.....',
      '..E..WS..E..',
      '.EE..WS..EE.',
      '.EY..WS..YE.',
      'EYL.EWSE.LYE',
      'EYLEYWSYELYE',
      '.EYYLWSLYYE.',
      '..EEYYYYEE..',
      '...dddddd...',
      '.....oo.....',
      '.....oo.....',
    ],
    a_k3: [   // 무한검 — 칼코등이에 감긴 금빛 무한 고리
      '.....W......',
      '.....WS.....',
      '.....WS.....',
      '.....WS.....',
      '.....WS.....',
      '.YY..WS..YY.',
      'Y..YLWSLY..Y',
      'Y..YLYYLY..Y',
      '.YY..oo..YY.',
      '.....oo.....',
      '.....YY.....',
      '............',
    ],
    b_key: [   // 발도술 — 붉은 칼집에서 반쯤 뽑힌 칼
      '..........W.',
      '.........WS.',
      '........WS..',
      '.......WS...',
      '......YY....',
      '.....YoY....',
      '....rr......',
      '...rR.......',
      '..rR........',
      '.rR.........',
      '.r..........',
      '............',
    ],
    b_k3: [   // 무념 — 붓으로 그은 열린 원
      '...WWWWW....',
      '..WS...SW...',
      '.WS......d..',
      '.W..........',
      'W...........',
      'W..........W',
      'W..........W',
      '.W........W.',
      '.WS......SW.',
      '..WS....SW..',
      '...WWWWWW...',
      '............',
    ],
    k_key: [   // 심검 — 푸른 기운이 감도는 칼
      '.....WW.....',
      '....CWWC....',
      '...CcWWcC...',
      '...CcWWcC...',
      '..CcCWWCcC..',
      '...CcWWcC...',
      '....CWWC....',
      '...YYYYYY...',
      '.....oo.....',
      '.....oo.....',
      '.....YY.....',
      '............',
    ],
    k_k3: [   // 만검귀종 — 사방의 칼이 한가운데로 모인다
      'W....W....W.',
      '.S...S...S..',
      '..S..S..S...',
      '...L.L.L....',
      '....LYL.....',
      'WSSLYLYLSSW.',
      '....LYL.....',
      '...L.L.L....',
      '..S..S..S...',
      '.S...S...S..',
      'W....W....W.',
      '............',
    ],
  };

  // 12×12 글자 → 14×14 색 격자 (null = 투명), make-icons.js grid() 와 같은 규칙
  function grid(rows) {
    const N = 14, g = Array.from({ length: N }, () => Array(N).fill(null));
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) g[y + 1 + dy][x + 1 + dx] = INK; }));
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') g[y + 1][x + 1] = PAL[ch]; }));
    return g;
  }

  // ── 틀 (도트) ──
  // 갈래 색: [밝음, 보통, 그늘]
  const LANE = { a: ['#fff2b8', '#e0c472', '#a8842e'], b: ['#cff6ff', '#6fd0d0', '#2f8a96'], k: ['#ffd0a0', '#ec9a3c', '#b0561e'], c: ['#d8c8f0', '#a98ccf', '#6f58a8'], f: ['#ffd0e0', '#e88aa8', '#a8506e'] };
  // 상태별 테 색: 찍음 = 금 · 찍을 수 있음 = 은 · 잠김 = 어두운 쇠
  const RIM = { got: ['#fff2b8', '#e0c472', '#a8842e'], can: ['#ebe7dc', '#b9b4cc', '#5e5a78'], lock: ['#5e5a78', '#34324a', '#1d1928'] };

  // 사각 틀: size×size, 두께 2 테 + 안쪽 잉크선, 네 모서리 보석(갈래 색), 아래 테에 칸 눈금(pips/max)
  function squareFrame(size, state, lane, pips, max, opt = {}) {
    const g = Array.from({ length: size }, () => Array(size).fill(null));
    const [hi, mid, lo] = RIM[state], L = LANE[lane] || LANE.c, last = size - 1;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const edge = Math.min(x, y, last - x, last - y);
      const corner = (x === 0 || x === last) && (y === 0 || y === last);
      if (corner) continue;
      if (edge === 0) g[y][x] = INK;
      else if (edge <= 2) g[y][x] = (x + y < size - 1) ? (edge === 1 ? hi : mid) : (edge === 1 ? mid : lo);
      else if (edge === 3) g[y][x] = INK;
      else g[y][x] = opt.bg || '#1d1928';
    }
    // 모서리 보석 2×2
    for (const [cx, cy] of [[1, 1], [last - 2, 1], [1, last - 2], [last - 2, last - 2]]) {
      g[cy][cx] = L[0]; g[cy][cx + 1] = L[1]; g[cy + 1][cx] = L[1]; g[cy + 1][cx + 1] = L[2];
    }
    // 아래 테 눈금 (max 칸, 찍은 칸만 갈래 색)
    if (max > 1) {
      const w = 2, gap = 1, total = max * w + (max - 1) * gap, x0 = Math.floor((size - total) / 2);
      for (let i = 0; i < max; i++) for (let k = 0; k < w; k++) {
        const x = x0 + i * (w + gap) + k;
        g[last - 2][x] = i < pips ? L[0] : INK; g[last - 1][x] = i < pips ? L[1] : '#34324a';
      }
    }
    return g;
  }
  // 융합 틀: 사각 틀 + 테에 분홍 점선 무늬
  function fusionFrame(size, state, pips, max) {
    const g = squareFrame(size, state, 'f', pips, max), last = size - 1, P = LANE.f;
    for (let i = 3; i < last - 3; i++) if (i % 3 === 0) { g[1][i] = P[1]; g[i][1] = P[1]; g[last - 1][i] = g[last - 1][i] === INK || g[last - 2][i] !== INK ? g[last - 1][i] : P[2]; g[i][last - 1] = P[2]; }
    return g;
  }
  // 원 틀 (변형·스탯): 지름 size, 두께 thick 테 (위왼쪽 밝게)
  function ringFrame(size, state, lane, thick) {
    const g = Array.from({ length: size }, () => Array(size).fill(null));
    const c = (size - 1) / 2, R = size / 2, [hi, mid, lo] = state === 'got' ? LANE[lane] || LANE.c : RIM[state];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d > R - 0.2) continue;
      if (d > R - 1.2) g[y][x] = INK;
      else if (d > R - 1.2 - thick) g[y][x] = (x + y < size - 1) ? hi : (x + y === size - 1 ? mid : lo);
      else if (d > R - 2.2 - thick) g[y][x] = INK;
      else g[y][x] = '#1d1928';
    }
    return g;
  }
  // 팔각 이중 테 (키스톤)
  function octFrame(size, state, lane) {
    const g = Array.from({ length: size }, () => Array(size).fill(null));
    const last = size - 1, cut = 5, [hi, mid, lo] = state === 'got' ? RIM.got : RIM[state], L = LANE[lane] || LANE.c;
    const inside = (x, y, m) => x >= m && y >= m && x <= last - m && y <= last - m && x + y >= cut + 2 * m - 1 && (last - x) + y >= cut + 2 * m - 1 && x + (last - y) >= cut + 2 * m - 1 && (last - x) + (last - y) >= cut + 2 * m - 1;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (!inside(x, y, 0)) continue;
      const lit = x + y < size - 1;
      g[y][x] = !inside(x, y, 1) ? INK : !inside(x, y, 2) ? (lit ? hi : mid) : !inside(x, y, 3) ? (state === 'got' ? L[1] : '#34324a') : !inside(x, y, 4) ? (lit ? mid : lo) : !inside(x, y, 5) ? INK : '#1d1928';
    }
    return g;
  }
  // 왕관 (궁극기 틀 위) 11×6
  const CROWN = [
    'K.K..K..K.K',
    'KYK.KLK.KYK',
    'KYYKYLYKYYK',
    'KYLYYRYYLYK',
    'KyyyyyyyyyK',
    'KKKKKKKKKKK',
  ];

  // 격자 그리기 → canvas
  function draw(ctx, g, ox, oy) {
    g.forEach((row, y) => row.forEach((c, x) => { if (c) { ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, 1, 1); } }));
  }
  // 아이콘 시트(src/skin/icons.png)에서 이름 하나를 그린다 (지금 게임 아이콘: sk-* · UI)
  let sheet = null;
  const SHEET_URL = new URL('skin/icons.png', document.currentScript ? document.currentScript.src : location.href).href;   // 이 파일 옆 src/skin
  function sheetReady() {
    if (sheet) return sheet.ready;
    sheet = new Image(); sheet.src = SHEET_URL;
    sheet.ready = new Promise((ok) => { sheet.onload = ok; });
    return sheet.ready;
  }
  function drawIcon(ctx, name, ox, oy) {
    if (BADGE[name]) return draw(ctx, grid(BADGE[name]), ox, oy);
    if (SYM[name]) return draw(ctx, grid(SYM[name]), ox, oy);
    const k = ICON_NAMES.indexOf(name);
    if (k >= 0 && sheet && sheet.complete) ctx.drawImage(sheet, k * 14, 0, 14, 14, ox, oy, 14, 14);
  }

  const cache = {};
  // 노드 크기 (도트 칸)
  const SIZE = { active: [22, 22], fusion: [22, 22], ult: [26, 31], uvar: [22, 22], mod: [20, 20], key: [22, 22], stat: [18, 18] };
  // 노드 하나를 canvas 에 그린다 (canvas 크기를 도트 칸 수로 맞춘다 — 화면 크기는 CSS 로 정수배)
  //  kind: active|ult|fusion|uvar|mod|key|stat · icon: 아이콘 이름 · state: got|can|lock · lane · pips/max: 찍은 칸
  // 스탯 점 (2안, docs/specs/skill-tree-v3.md): 아이콘 없는 9×9 도트 점 — 잠김 짙은 회색 · 찍을 수 있음 은테 · 찍음 연보라
  function paintDot(cv, state) {
    const g = 9; cv.width = cv.height = g; const c = cv.getContext('2d'); c.clearRect(0, 0, g, g);
    const fill = state === 'got' ? '#c9b8ff' : state === 'can' ? '#5e5a78' : '#2b2838', rim = state === 'got' ? '#ebe7dc' : state === 'can' ? '#d8d2ee' : '#55516c';
    for (let y = 0; y < g; y++) for (let x = 0; x < g; x++) { const d = Math.hypot(x - 4, y - 4); if (d > 4.4) continue; c.fillStyle = d > 3.5 ? INK : d > 2.6 ? rim : fill; c.fillRect(x, y, 1, 1); }
    return cv;
  }
  function paint(cv, kind, icon, state, lane, pips = 0, max = 1) {
    if (kind === 'dot') return paintDot(cv, state);
    let w, h, frame, ix, iy, fy = 0;
    if (kind === 'active') { w = h = 22; frame = squareFrame(22, state, lane, pips, max); ix = iy = 4; }
    else if (kind === 'fusion') { w = h = 22; frame = fusionFrame(22, state, pips, max); ix = iy = 4; }
    else if (kind === 'ult') { w = 26; h = 31; fy = 5; frame = squareFrame(26, state === 'lock' ? 'lock' : 'got', 'a', pips, max); ix = 6; iy = 6 + fy; }
    else if (kind === 'uvar') { w = h = 22; frame = squareFrame(22, state, lane, 0, 1); ix = iy = 4; }
    else if (kind === 'mod') { w = h = 20; frame = ringFrame(20, state, lane, 2); ix = iy = 3; }
    else if (kind === 'key') { w = h = 22; frame = octFrame(22, state, lane); ix = iy = 4; }
    else { w = h = 18; frame = ringFrame(18, state, lane, 1); ix = iy = 2; }
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    draw(ctx, frame, 0, fy);
    if (kind === 'ult') draw(ctx, CROWN.map((r) => [...r].map((ch) => (ch === '.' ? null : ch === 'K' ? INK : PAL[ch]))), 7, 0);
    drawIcon(ctx, icon, ix, iy);
    return cv;
  }
  // 시안 페이지용: 같은 그림의 data URL { url, w, h }
  function node(kind, icon, state, lane, pips = 0, max = 1) {
    const key = [kind, icon, state, lane, pips, max].join('|');
    if (cache[key]) return cache[key];
    const cv = paint(document.createElement('canvas'), kind, icon, state, lane, pips, max);
    return (cache[key] = { url: cv.toDataURL(), w: cv.width, h: cv.height });
  }
  // 아이콘만 14×14 canvas 에 (장착 칸·목록)
  function paintIcon(cv, name) { cv.width = cv.height = 14; const c = cv.getContext('2d'); c.clearRect(0, 0, 14, 14); drawIcon(c, name, 0, 0); return cv; }
  // 아이콘만 (장착 칸·목록용) 14×14
  function icon(name) {
    const key = 'icon|' + name;
    if (cache[key]) return cache[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = 14;
    drawIcon(cv.getContext('2d'), name, 0, 0);
    return (cache[key] = { url: cv.toDataURL(), w: 14, h: 14 });
  }
  window.TreeArt = { ready: sheetReady, paint, paintIcon, node, icon, SIZE, BADGE, SYM };
})();
