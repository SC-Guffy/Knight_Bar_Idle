'use strict';
// 기사 스프라이트 고해상 판 (2026-10): classes.js 의 11×13 몸통을 그대로 두고, 불러올 때 2배(22×26)로 키워 쓴다.
//  - 확대는 EPX(Scale2x): 계단 모서리를 둥글려 굵은 도트 느낌은 남기고 실루엣만 매끈하게
//  - 둘레에 1칸 외곽선('#', 짙은 남색) — 배경·이펙트 위에서 읽힌다
//  - 명암은 그릴 때 자동 (world.js drawSprite bevel): 위가 비면 밝게, 아래가 비면 어둡게 → 데이터는 그대로, 입체감만 붙는다
//  - 칸 크기는 PX 의 절반 (rows.px = 0.5) 이라 화면 크기는 전과 같다. 손·어깨·망토 위치 계산(heroRig 등)도 그대로
//  - 다리는 4프레임 걷기(디딤·지남·디딤·지남, 뒷발·앞발이 번갈아 들린다)로 새로 찍었다. 앉은 다리도 2배
//  - 직업마다 평소 서는 자세(STANCE) — 기울임·웅크림·무기 각도·떠 있음. 전투 대기·마을 서 있기에 쓴다 (drawHero)
//  BODY2_OVERRIDE[id] 에 22×26 행을 직접 적으면 자동 확대 대신 그 그림을 쓴다 (손으로 다듬을 때)

PAL['#'] = '#0b0d14';           // 외곽선
// 스프라이트의 높이(칸): 행 수 × 칸 크기 (고해상 판은 px 0.5). 손·지팡이 위치 계산이 다리 높이에 쓴다
const sprCells = (rows) => rows.length * (rows.px || 1);

// EPX 2배 확대: 네 이웃이 같은 색이면 모서리를 채워 계단을 둥글린다
function epx2(rows) {
  const h = rows.length, w = rows[0].length, out = [];
  const at = (r, c) => (r < 0 || c < 0 || r >= h || c >= w ? '.' : rows[r][c]);
  for (let r = 0; r < h; r++) {
    let top = '', bot = '';
    for (let c = 0; c < w; c++) {
      const P = at(r, c), A = at(r - 1, c), B = at(r, c + 1), C = at(r, c - 1), D = at(r + 1, c);
      let p1 = P, p2 = P, p3 = P, p4 = P;
      if (P !== '.') {
        if (C === A && C !== D && A !== B) p1 = A;
        if (A === B && A !== C && B !== D) p2 = B;
        if (D === C && D !== B && C !== A) p3 = C;
        if (B === D && B !== A && D !== C) p4 = D;
      }
      top += p1 + p2; bot += p3 + p4;
    }
    out.push(top, bot);
  }
  return out;
}
// 1칸 외곽선: 빈 칸 중 상하좌우에 색 칸이 있으면 '#'. padBottom=false 면 아래쪽은 늘리지 않는다 (다리 — 발이 땅 아래로 안 내려가게)
function outline(rows, padBottom = true) {
  const h = rows.length, w = rows[0].length;
  const src = ['.'.repeat(w + 2), ...rows.map((r) => '.' + r + '.'), ...(padBottom ? ['.'.repeat(w + 2)] : [])];
  const H = src.length, W2 = w + 2, at = (r, c) => (r < 0 || c < 0 || r >= H || c >= W2 ? '.' : src[r][c]);
  return src.map((row, r) => row.split('').map((ch, c) => {
    if (ch !== '.') return ch;
    return [at(r - 1, c), at(r + 1, c), at(r, c - 1), at(r, c + 1)].some((n) => n !== '.' && n !== '#') ? '#' : '.';
  }).join(''));
}
function hiRes(rows, padBottom = true) {
  const out = outline(epx2(rows), padBottom);
  out.px = 0.5;
  return out;
}

// 손으로 찍은 22×26 몸통 (없으면 자동 확대). 열쇠는 직업 id 또는 BODY 의 이름 (직업 id 가 먼저). 외곽선은 자동으로 두른다
//  팔레트 글자는 classes.js 그 직업의 look.pal 에 맞춘다. 팔·주먹 색은 look.arm 으로 따로 준다 (머리카락이 어깨 줄에 걸쳐도 되게)
//  눈: e 눈동자 · E 눈 하이라이트. 궁수 계열은 여성, 마법사 계열은 모자·머리 모양이 전부 다르다
const BODY2_OVERRIDE = {
  // 레인저(여): 깃털 꽂은 초록 모자, 등 뒤로 흘러내린 적갈색 머리, 흰 블라우스 위 가죽 조끼, 화살통 끈
  ranger: [
    '.......f..............',
    '......ff.ggggggg......',
    '.....ff.gGGGGGGGg.....',
    '....ff.gGGGGGGGGGg....',
    '......gGGGGGGGGGGg....',
    '....nngggggggggggggg..',
    '...nnnnsssssssssss....',
    '..nnnnnssssssssssss...',
    '..nnnnnssseEssseEss...',
    '.nnnnnnssseesssees....',
    '.nnnnnnsssssssssss....',
    '.nnnnn.nssssssssss....',
    '..nnnn.nnsssssssss....',
    '..nnn...ssssssssss....',
    '...nn..wwwwwwwwww.....',
    '...nn.LLwwqwwwwLL.....',
    '....n.LLwqwwwwwLLL....',
    '......LLqMMMMMLLLL....',
    '......LqMMMMMMLLLL....',
    '......LMMMMMMMLLLL....',
    '......LLMMMMMMLLL.....',
    '.......LMMMMMMLL......',
    '......bbbbbyybbbb.....',
    '......bbbbbyybbbb.....',
    '......LLLLLLLLLLL.....',
    '......LLLLLLLLLLL.....',
  ],
  // 저격수(여): 높이 묶은 검은 머리, 이마의 고글 바이저, 붉은 스카프, 깃 세운 짙은 초록 코트와 가슴 보호대
  marksman: [
    '.........nnnn.........',
    '........nnnnnn........',
    '.......nnnnnnnn.......',
    '......nnoooooooonn....',
    '......nnoOOOOOOonn....',
    '......nnoooooooonn....',
    '.....nnnssssssssss....',
    '.....nnsssssssssss....',
    '.....nnsssseEssseEs...',
    '.....nnsssseesssees...',
    '.....nnssssssssssss...',
    '......nsssssssssss....',
    '.....ccccsssssscc.....',
    '....cccccccccccccc....',
    '...GGGcccccccccGGG....',
    '...GGGGLLLLLLLGGGG....',
    '...GGGLLLMMLLLLGGG....',
    '...GGGLLMMMMLLLGGG....',
    '...GGGLLMMMMLLLGGG....',
    '...GGGLLLMMLLLLGGG....',
    '...GGGLLLLLLLLLGGG....',
    '....GGLLLLLLLLLGG.....',
    '....bbbbbbyybbbbb.....',
    '....bbbbbbyybbbbb.....',
    '.....GGGGGGGGGGGG.....',
    '.....GGGGGGGGGGGG.....',
  ],
  // 신궁(여): 햇살 뻗는 황금 관, 길게 흘러내린 백금발, 금테 두른 흰 전포와 태양 문양 가죽 흉대
  deadeye: [
    '.........y............',
    '......y..y..y.........',
    '.......yyyyyyy........',
    '.....yyYYYYYYYyy......',
    '....wwwwwwwwwwwww.....',
    '...wwwwwwwwwwwwww.....',
    '..wwwwwssssssssss.....',
    '..wwwwsssssssssssw....',
    '.wwwwwsssseEssseEs....',
    '.wwwwwsssseesssees....',
    '.wwwwwssssssssssss....',
    '.wwww.wsssssssssss....',
    '.wwww.wwssssssssss....',
    '..www...ssssssssss....',
    '..www.cccyccccccyccc..',
    '...ww.ccyLLLLLLLycccc.',
    '...w..ccyLLLyyLLLycc..',
    '......ccyLLyyyyLLycc..',
    '......ccyLLLyyLLLycc..',
    '......ccyLLLLLLLLycc..',
    '......CccLLLLLLLLccC..',
    '.......CcLLLLLLLLcC...',
    '......bbbbbbyybbbbb...',
    '......bbbbbbyybbbbb...',
    '.......cccccccccccc...',
    '.......CCCCCCCCCCCC...',
  ],
  // 마궁수(여): 청록 서클릿, 끝이 빛나는 긴 푸른 머리, 비전 문양이 새겨진 푸른 튜닉
  arcaneArcher: [
    '......................',
    '........nnnnnn........',
    '......nnnnnnnnnn......',
    '.....nnnccccccnnn.....',
    '....nnnNNNNNNNNnnn....',
    '...nnnNssssssssNnn....',
    '..nnnNsssssssssssn....',
    '..nnnNssssssssssss....',
    '.nnnnNsssseEssseEs....',
    '.nnnnNsssseesssees....',
    '.nnnnNsssssssssssss...',
    '.nnnn.Nsssssssssss....',
    '.nccn.Nsssssssssss....',
    '..cc....ssssssssss....',
    '..cc..GGGGGGGGGGGG....',
    '......GGGLLcLLLGGGG...',
    '......GGLLcccLLLGGG...',
    '......GGLLLcLLLLGGG...',
    '......GGLLLcLLLLGGG...',
    '......GGLLLLLLLLGGG...',
    '......GGGLLLLLLGGG....',
    '.......GGLLLLLLGG.....',
    '......bbbbbccbbbbb....',
    '......bbbbbccbbbbb....',
    '......GGGGGGGGGGGG....',
    '......GGGGGGGGGGGG....',
  ],
  // 차원궁사(여): 자줏빛 서클릿, 검보라 긴 머리, 공허 문양의 검은 망토 옷
  voidArcher: [
    '......................',
    '........nnnnnn........',
    '......nnnnnnnnnn......',
    '.....nnnnccccnnnn.....',
    '....nnnNNNNNNNNnnn....',
    '...nnnNssssssssNnn....',
    '..nnnNsssssssssssn....',
    '..nnnNssssssssssss....',
    '.nnnnNsssseEssseEs....',
    '.nnnnNsssseesssees....',
    '.nnnnNsssssssssssss...',
    '.nnnn.Nsssssssssss....',
    '.nnnn.Nsssssssssss....',
    '..nnn...ssssssssss....',
    '..nnn.GGGGGGGGGGGG....',
    '...nn.GGGLLcLLLGGGG...',
    '...n..GGLLcLcLLLGGG...',
    '......GGLLLcLLLLGGG...',
    '......GGLLcLcLLLGGG...',
    '......GGLLLcLLLLGGG...',
    '......GGGLLLLLLGGG....',
    '.......GGLLLLLLGG.....',
    '......bbbbbccbbbbb....',
    '......bbbbbccbbbbb....',
    '......GGGGGGGGGGGG....',
    '......GGGGGGGGGGGG....',
  ],
  // 석궁사수(여): 면갑 올린 강철 투구, 등 뒤로 땋아 내린 머리, 어깨 보호대 달린 흉갑, 붉은 전포, 살 탄띠 (공성포수도 같은 몸통)
  arbalest: [
    '......................',
    '.......hhhhhhhh.......',
    '.....hhHHHHHHHHhh.....',
    '....hHHHHHHHHHHHHh....',
    '....hHHHHHHHHHHHHh....',
    '....hhhhhhhhhhhhhhh...',
    '...nnhhssssssssshh....',
    '..nnnhhsssssssssshh...',
    '..nnnhhsssseEssseEs...',
    '.nnnnhhsssseesssees...',
    '.nnn.hhsssssssssss....',
    '.nnn..hhhhhhhhhhhh....',
    '..nn...hhhhhhhhhh.....',
    '..nn....ssssssss......',
    '..nnaAAAArrrrrrAAAAa..',
    '...naAAAArrqrrrrAAAa..',
    '...naAAAArqQrrrrAAAa..',
    '....aAAAAqQrrrrrAAAa..',
    '....aAAqQrrrrrrrAAA...',
    '....aAqQrrrrrrrrAAA...',
    '....aAArrrrrrrrrAAA...',
    '.....aArrrrrrrrrAA....',
    '.....bbbbbbyybbbbb....',
    '.....bbbbbbyybbbbb....',
    '......aAAAAAAAAAa.....',
    '......aAAAAAAAAAa.....',
  ],
  // 마법사(여): 챙이 넓은 큰 뾰족 모자(별 장식), 챙 아래로 흘러내린 갈색 긴 머리, 흰 깃이 달린 푸른 로브
  mage: [
    '............P.........',
    '...........PP.........',
    '..........PPP.........',
    '.........PPPP.........',
    '........PPPPPy........',
    '.......PPPPPPPP.......',
    '....pppppppppppppp....',
    '...nnnnnssssssssn.....',
    '..nnnnnssssseEssseEs..',
    '..nnnnnssssseesssees..',
    '.nnnnnnsssssssssssss..',
    '.nnnnn.nsssssssssss...',
    '.nnnn..wwwsssssssww...',
    '..nnn.wwwwwssssswwww..',
    '..nn..rRRwwwwwwwRRr...',
    '...n..rRRRRRyRRRRRr...',
    '......rRRRRRyRRRRRr...',
    '......rRRRRRyRRRRRr...',
    '......rRRRRRRRRRRRr...',
    '......rRRRRRRRRRRRr...',
    '......rRRRRRRRRRRRr...',
    '.......rRRRRRRRRRr....',
    '......bbbbbbyybbbb....',
    '......bbbbbbyybbbb....',
    '......rRRRRRRRRRRRr...',
    '......rRRRRRRRRRRRr...',
  ],
  // 화염술사(여): 불꽃처럼 치솟아 등 뒤로 흘러내리는 주황 머리, 가슴에 불꽃 문양이 타는 검붉은 로브
  pyromancer: [
    '.........F..F.........',
    '........fF.fF.F.......',
    '.......fff.ffFf.......',
    '......ffffffffff......',
    '.....fffffffffffff....',
    '....ffffffffffffffF...',
    '...ffffssssssssssff...',
    '..fffffsssssssssssf...',
    '..ffffFssssseEssseEs..',
    '.fffffFssssseesssees..',
    '.ffffFfsssssssssssss..',
    '.fffF.fsssssssssssss..',
    '.ffF..ffsssssssssss...',
    '..fF...ssssssssssss...',
    '..f..rRRRccccccccRRRr.',
    '.....rRRRRccyyccccRRRr',
    '.....rRRRRcyyyycccRRRr',
    '.....rRRRRccyyyyccRRRr',
    '.....rRRRRcccyycccRRRr',
    '.....rRRRRccccccccRRRr',
    '.....rRRRRRRRRRRRRRRr.',
    '......rRRRRRRRRRRRRr..',
    '......bbbbbbbyybbbbb..',
    '......bbbbbbbyybbbbb..',
    '......rRRRRRRRRRRRRr..',
    '......rRRRRRRRRRRRRr..',
  ],
  // 빙결술사(여): 얼음 결정 티아라, 길게 흘러내린 연푸른 머리, 흰 털 깃을 두른 청백 로브와 얼음 문양
  cryomancer: [
    '..........C...........',
    '........c.C.c.........',
    '.......cccCccc........',
    '......nnnccccnnn......',
    '.....nnnNNNNNNnnn.....',
    '....nnnNssssssssNn....',
    '...nnnNssssssssssn....',
    '...nnnNsssssssssss....',
    '..nnnnNsssseEssseEs...',
    '..nnnnNsssseesssees...',
    '..nnnnNssssssssssss...',
    '..nnnn.Nsssssssssss...',
    '..nnnn.Nsssssssssss...',
    '...nnn..ssssssssss....',
    '...nn.wwwwwwwwwwwww...',
    '...nn.wwRRRRRRRRRww...',
    '....n.wRRRRccRRRRRw...',
    '......wRRRcccRRRRRw...',
    '......wRRRRccRRRRRw...',
    '......wRRRRRRRRRRRw...',
    '......wWRRRRRRRRRWw...',
    '.......wWRRRRRRRWw....',
    '......bbbbbbccbbbbb...',
    '......bbbbbbccbbbbb...',
    '......wWWWWWWWWWWWw...',
    '......wWWWWWWWWWWWw...',
  ],
  // 뇌전술사(여): 번개 핀을 꽂은 넓은 챙의 남색 모자, 등 뒤로 흘러내린 노란 머리, 깃 세운 남색 코트에 번개 무늬
  electromancer: [
    '..........PPP.........',
    '.........PPPPP........',
    '........PPPPPPP.......',
    '.......PPPPPPPPPc.....',
    '......PPPPPPPPPPcc....',
    '..ppppppppppppppppp...',
    '....nnnnssssssssss....',
    '...nnnnnsssssssssss...',
    '..nnnnnnsssseEssseEs..',
    '..nnnnnnsssseesssees..',
    '.nnnnnnnssssssssssss..',
    '.nnnnn.nsssssssssss...',
    '.nnnn..yyyysssssssyy..',
    '..nnn.rRRyyyyyyyyyyRr.',
    '..nn..rRRRRRcRRRRRRRr.',
    '...n..rRRRRRRcRRRRRRr.',
    '......rRRRRccRRRRRRRr.',
    '......rRRRRRRcRRRRRRr.',
    '......rRRRRRRRcRRRRRr.',
    '......rRRRRRRRRRRRRRr.',
    '......rRRRRRRRRRRRRRr.',
    '.......rRRRRRRRRRRRr..',
    '......bbbbbbbccbbbbb..',
    '......bbbbbbbccbbbbb..',
    '......rRRRRRRRRRRRRr..',
    '......rRRRRRRRRRRRRr..',
  ],
  // 대마도사(여): 양쪽으로 솟은 불꽃 뿔 관, 등 뒤로 타오르는 긴 불꽃 머리, 금테 두른 검붉은 로브와 가슴의 겁화 문양
  archmage: [
    '......F.........F.....',
    '.....fF........Ff.....',
    '.....ffF......Fff.....',
    '......fffFFFFfff......',
    '.....fffffffffffff....',
    '....ffffffffffffff....',
    '...ffffssssssssssf....',
    '..fffffsssssssssssf...',
    '..ffffFssssseEssseEs..',
    '.fffffFssssseesssees..',
    '.ffffFfsssssssssssss..',
    '.fffF.fsssssssssssss..',
    '.ffF..ffsssssssssss...',
    '..fF...ssssssssssss...',
    '..f.rRRRyyyyyyyyyRRRr.',
    '...rRRRRycccccccyRRRRr',
    '...rRRRRyccFFFccyRRRRr',
    '...rRRRRycFFFFFcyRRRRr',
    '...rRRRRyccFFFccyRRRRr',
    '...rRRRRycccccccyRRRRr',
    '...rRRRRRyyyyyyyRRRRRr',
    '....rRRRRRRRRRRRRRRRr.',
    '....bbbbbbbbyybbbbbbb.',
    '....bbbbbbbbyybbbbbbb.',
    '.....rRRRRRRRRRRRRRr..',
    '.....rRRRRRRRRRRRRRr..',
  ],
  // 빙결의 군주(여): 높이 솟은 얼음 왕관, 길게 흘러내린 백발, 흰 털 망토를 두른 청백 여왕의 로브와 얼음 보석
  frostlord: [
    '.......C..C..C........',
    '.......c.cCc.c........',
    '......cccccccccc......',
    '.....cccCCCCCCccc.....',
    '....wwwwwwwwwwwww.....',
    '...wwwwwwwwwwwwwww....',
    '..wwwwwssssssssssw....',
    '..wwwwsssssssssssww...',
    '.wwwwwsssseEssseEss...',
    '.wwwwwsssseesssees....',
    '.wwwwwssssssssssss....',
    '.wwww.wsssssssssss....',
    '.wwww.wwssssssssss....',
    '..www...ssssssssss....',
    '..www.WWWWWWWWWWWWW...',
    '..ww..WWRRRRRRRRRWWW..',
    '..ww..WRRRRRyRRRRRWW..',
    '...w..WRRRRyyyRRRRWW..',
    '......WRRRRRyRRRRRWW..',
    '......WRRRRRRRRRRRWW..',
    '......rRRRRRRRRRRRRr..',
    '.......rRRRRRRRRRRr...',
    '......bbbbbbyybbbbbb..',
    '......bbbbbbyybbbbbb..',
    '......rRRRRRRRRRRRRr..',
    '......rRRRRRRRRRRRRr..',
  ],
  // 뇌제(여): 흰 보석 박힌 황금 황제관, 등 뒤로 흘러내린 백발, 황금 어깨 망토를 두른 남색 황제 로브와 번개 문장
  thunderEmperor: [
    '........y.y.y.y.......',
    '........yCyCyCy.......',
    '.......yyyyyyyyy......',
    '......yyyyyyyyyyy.....',
    '.....wwwwwwwwwwww.....',
    '....wwwwwwwwwwwwww....',
    '...wwwwssssssssssw....',
    '..wwwwwsssssssssssw...',
    '..wwwwwsssseEssseEs...',
    '.wwwwwwsssseesssees...',
    '.wwwwwwsssssssssssss..',
    '.wwwww.wsssssssssss...',
    '.wwww..wwsssssssss....',
    '..www...ssssssssss....',
    '..ww.yyyyRRRRRRRRyyyy.',
    '..ww.yyyRRRRRRRRRRyyy.',
    '...w.yyRRRRRccRRRRRyy.',
    '.....yRRRRRccRRRRRRRy.',
    '.....yRRRRccccRRRRRRy.',
    '......RRRRRRccRRRRRR..',
    '......RRRRRRcRRRRRRR..',
    '.......rRRRRRRRRRRRr..',
    '......bbbbbbbyybbbbb..',
    '......bbbbbbbyybbbbb..',
    '.......rRRRRRRRRRRRr..',
    '.......rRRRRRRRRRRRr..',
  ],
};
for (const k in BODY2_OVERRIDE) for (const row of BODY2_OVERRIDE[k]) if (row.length !== 22) throw new Error(`BODY2_OVERRIDE.${k} 행 길이 ${row.length}: ${row}`);

// 걷기 4프레임 (22×6, 외곽선은 자동): 디딤(벌림) → 지남(모음, 뒷발 들림) → 디딤 → 지남(앞발 들림)
const LEGS2 = [
  ['....llll......llll....', '....llll......llll....', '....llll......llll....', '....llll......llll....', '....kkkk......kkkk....', '....kkkk......kkkk....'],
  ['......llll..llll......', '......llll..llll......', '......llll..llll......', '......llll..llll......', '....kkkk....kkkk......', '............kkkk......'],
  ['....llll......llll....', '....llll......llll....', '....llll......llll....', '....llll......llll....', '....kkkk......kkkk....', '..............kkkk....'],
  ['......llll..llll......', '......llll..llll......', '......llll..llll......', '......llll..llll......', '....kkkk....kkkk......', '....kkkk..............'],
].map((f) => { const o = outline(f, false); o.px = 0.5; return o; });
// 서 있을 때는 첫 프레임, 앉은 다리는 자동 확대
const SIT2 = hiRes(SPR.knightSit, false);

// 직업별 평소 자세 (전투 대기·마을): skew 기울임(+앞) · sy 웅크림 · dx 디딤 · wa 무기 각도 보정 · hover 떠 있는 높이(px) · bob 흔들림 세기
const STANCE = {
  squire: { skew: 0.02 },
  swordsman: { skew: 0.05 }, paladin: { skew: -0.04, sy: 1.02 }, blademaster: { skew: 0.16, sy: 0.92, dx: 2 }, archon: { skew: -0.04, sy: 1.02, hover: 2 }, swordsaint: { skew: 0.18, sy: 0.9, dx: 2 },
  greatswordsman: { skew: -0.1, sy: 1.02, dx: -2 }, tyrant: { skew: -0.1, sy: 1.03, dx: -2 },
  lancer: { skew: 0.08, dx: 1 }, dragoon: { skew: 0.1, sy: 0.97, dx: 2 }, halberdier: { skew: 0.05, sy: 0.96 }, dragonlord: { skew: 0.1, sy: 0.97, dx: 2 }, warlord: { skew: 0.04, sy: 0.95 },
  cavalier: { skew: 0.08, sy: 0.98 }, skyGeneral: { skew: 0.06, hover: 2 },
  ranger: { skew: 0.12, sy: 0.95, dx: 1 }, marksman: { skew: 0.1, sy: 0.9, dx: 1 }, arcaneArcher: { skew: 0.08, sy: 0.97, hover: 2 }, deadeye: { skew: 0.1, sy: 0.92 }, voidArcher: { skew: 0.08, sy: 0.96, hover: 3 },
  arbalest: { skew: 0.06, sy: 0.95, dx: 1 }, siegeMaster: { skew: 0.05, sy: 0.95, dx: 1 },
  mage: { skew: -0.03 }, pyromancer: { skew: -0.03, hover: 1 }, cryomancer: { skew: -0.03, hover: 2 }, archmage: { skew: -0.04, hover: 4, bob: 1.5 }, frostlord: { skew: -0.04, hover: 4, bob: 1.5 },
  electromancer: { skew: -0.03, hover: 2, bob: 1.2 }, thunderEmperor: { skew: -0.04, hover: 5, bob: 1.6 },
};

// CLASSES 가 가리키는 몸통을 고해상 판으로 바꿔 끼운다 (같은 몸통을 쓰는 직업은 같은 판을 공유)
(function applyHiRes() {
  const cache = new Map();
  for (const key in BODY) {
    const src = BODY[key];
    const hi = BODY2_OVERRIDE[key] ? Object.assign(outline(BODY2_OVERRIDE[key]), { px: 0.5 }) : hiRes(src);
    cache.set(src, hi);
  }
  for (const id in CLASSES) {
    const look = CLASSES[id].look;
    if (BODY2_OVERRIDE[id] && !BODY[id]) look.body = Object.assign(outline(BODY2_OVERRIDE[id]), { px: 0.5 });   // 몸통을 빌려 쓰던 직업의 전용 손도트
    else if (cache.has(look.body)) look.body = cache.get(look.body);
    if (STANCE[id]) look.stance = STANCE[id];
  }
  SPR.knightLegs = LEGS2;
  SPR.knightSit = SIT2;
})();
