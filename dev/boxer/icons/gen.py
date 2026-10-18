# 파이터 계열 아이콘 그림 만들기 (무료, 손 도트) → dev/icon-art/f-fighter.js
#  12×12 글자 도트 (dev/make-icons.js 팔레트: K 잉크 W 흰 S/s/d 은 L/Y/y 금 R/r 빨강 G/g 초록 B/b 파랑 O/o 나무 P/p 양피지 C/c 청록 V/v 보라 M/m 분홍(살) E/e 주황 k 짙은 회색)
#  스킬 = 색 바탕 네모(모서리 빈칸) 위 그림, 3차 궁극기 = 금테(Y/y) 배지. 원·소용돌이는 계산으로 찍는다.
#  python -I -B dev/boxer/icons/gen.py → dev/icon-art/f-fighter.js 를 쓴 뒤 node dev/make-icons.js
import math, os
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '..', '..', 'icon-art', 'f-fighter.js')


def grid(fill='.'):
    return [[fill] * 12 for _ in range(12)]


def badge(bg, edge):
    """스킬 바탕: 모서리 빈칸, 오른쪽·아래 테두리 한 단 어둡게"""
    g = grid(bg)
    for (x, y) in ((0, 0), (11, 0), (0, 11), (11, 11)): g[y][x] = '.'
    for i in range(1, 11): g[11][i] = edge; g[i][11] = edge
    return g


def gold(inner='k'):
    g = grid(inner)
    for i in range(12):
        g[0][i] = 'Y'; g[i][0] = 'Y'; g[11][i] = 'y'; g[i][11] = 'y'
    for (x, y) in ((0, 0), (11, 0), (0, 11), (11, 11)): g[y][x] = '.'
    return g


def put(g, rows, x0=0, y0=0):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != ' ' and 0 <= y0 + j < 12 and 0 <= x0 + i < 12: g[y0 + j][x0 + i] = ch
    return g


def disc(g, cx, cy, r, ch, ring=None):
    for y in range(12):
        for x in range(12):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d <= r: g[y][x] = ch
            if ring and r - 1.0 < d <= r: g[y][x] = ring
    return g


def rows(g): return [''.join(r) for r in g]


ICONS = {}
# ── 직업 아이콘 (이모지 대신) ──
ICONS['glove'] = ('🥊', '권투 글러브: 빨간 글러브, 흰 손목띠', [
    '...RRRRR....',
    '..RRRRRRRR..',
    '.RRWRRRRRRr.',
    '.RWRRRRRRRr.',
    'RRRRRRRRRRr.',
    'RRRRRRRRRrr.',
    '.rRRRRRRRr..',
    '..rrRRRRrr..',
    '...rrrrrr...',
    '...WWWWWW...',
    '...WSSSSW...',
    '...ssssss...'])
ICONS['fist'] = ('👊', '주먹: 정면 주먹, 마디·엄지 줄, 흰 손목 붕대', [
    '............',
    '...PPPPPP...',
    '..PPpPPpPPp.',
    '..PPpPPpPPp.',
    '..PPPPPPPPp.',
    '..PppppPPPp.',
    '..PPPPPPPpp.',
    '...PPPPPpp..',
    '...WWWWWW...',
    '...WSWSWW...',
    '...WWWWWW...',
    '...ssssss...'])
ICONS['foot'] = ('🦶', '맨발 옆모습: 뒤꿈치 왼쪽, 발가락 오른쪽', [
    '............',
    '............',
    '...PPp......',
    '...PPp......',
    '...PPp......',
    '...PPPp.....',
    '..PPPPPp.p..',
    '..PPPPPPpPp.',
    '..PPPPPPPPPp',
    '..pPPPPPPPPp',
    '...ppppppppp',
    '............'])
ICONS['meditate'] = ('🧘', '가부좌: 둥근 머리(흰 머리띠), 두 팔을 벌려 무릎에 올린 남색 도복, 넓게 접은 다리', [
    '....kkkk....',
    '...kWWWWk...',
    '...PPPPPP...',
    '....PPPP....',
    '..BBBBBBBB..',
    '.BBBBWWBBBb.',
    'PBBBBBBBBBbP',
    '.BBBBBBBBBb.',
    'BBBBBBBBBBBb',
    'BBBBbbbbBBBb',
    '.bbb....bbb.',
    '............'])
ICONS['lion'] = ('🦁', '사자: 주황 갈기, 금빛 얼굴', [
    '..EEEEEEEE..',
    '.EEEYYYYEEE.',
    'EEYYLLLLYYEe',
    'EYLLLLLLLLYe',
    'EYLKLLLLKLYe',
    'EYLLLLLLLLYe',
    'EYLLLkkLLLYe',
    'EYYLLLLLLYYe',
    'eEYLLWWLLYEe',
    '.eEYYYYYYEe.',
    '..eeEEEEee..',
    '............'])
g = disc(grid(), 6, 6, 6, 'W', ring='K')
for y in range(12):
    for x in range(12):
        if g[y][x] == 'W':
            X, Y = x + 0.5 - 6, y + 0.5 - 6
            dark = X > 0
            if math.hypot(X, Y + 3) < 3: dark = False
            if math.hypot(X, Y - 3) < 3: dark = True
            if math.hypot(X, Y + 3) < 1.1: dark = True
            if math.hypot(X, Y - 3) < 1.1: dark = False
            g[y][x] = 'k' if dark else 'W'
ICONS['yinyang'] = ('☯️', '음양: 흰·검은 반쪽과 두 점 (그랜드마스터·기 절약 노드)', rows(g))

# ── 스킬 아이콘 ──
ICONS['sk-oneTwo'] = ('', '원투 스트레이트 — 작은 잽 주먹 뒤로 큰 스트레이트 주먹, 속도선', rows(put(badge('E', 'e'), [
    '          ',
    ' PPp      ',
    ' PPp WW   ',
    '     PPPPp',
    ' WW  PpPPp',
    'WW   PpPPp',
    '     PPPPp',
    '      pppp',
    '          ',
    '          '], 1, 1)))
ICONS['sk-ironRush'] = ('', '연타 러시 — 은빛 건틀릿 셋이 겹쳐 쏟아짐', rows(put(badge('R', 'r'), [
    '          ',
    ' WW SSSs  ',
    '    SWSs  ',
    ' WW SSSs  ',
    '  SSSs    ',
    '  SWSs    ',
    'WWSSSs  W ',
    '     SSSs ',
    '  WW SWSs ',
    '     SSSs '], 1, 1)))
ICONS['sk-crushFist'] = ('', '붕권 — 주먹 앞에 터지는 금빛 충격', rows(put(badge('r', 'K'), [
    '       Y  ',
    '  Y   YLY ',
    '  YY YLWLY',
    ' PPPp YLY ',
    'PPPPpYYWY ',
    'PpPPp YLY ',
    ' PPpp  Y  ',
    '  pp   Y  ',
    '          ',
    '          '], 1, 1)))
ICONS['sk-flyingKick'] = ('', '돌진 발차기 — 대각선으로 뻗은 발과 속도선', rows(put(badge('g', 'K'), [
    '        PP',
    '  W    PPp',
    '      PPp ',
    ' W   PPp  ',
    '    PPp   ',
    'W  WWp    ',
    '  WWW     ',
    ' WWW  W   ',
    '  W    W  ',
    '          '], 1, 1)))
g = badge('c', 'K')
for i in range(26):
    a = i / 26 * 2 * math.pi * 1.6; r = 1.2 + i * 0.17
    x, y = int(6 + r * math.cos(a)), int(6 + r * math.sin(a))
    if 1 <= x <= 10 and 1 <= y <= 10: g[y][x] = 'W' if i % 3 else 'C'
put(g, ['PPp', 'PPp'], 8, 2)
ICONS['sk-spinKick'] = ('', '회전 발차기 — 소용돌이 바람 고리 끝의 발', rows(g))
g = badge('b', 'K'); disc(g, 7.5, 5.5, 3.2, 'C', ring='B'); disc(g, 7.5, 5.5, 1.4, 'W')
put(g, ['P  ', 'PP ', 'PPp', 'PPp', 'Pp '], 1, 6)
ICONS['sk-palmBlast'] = ('', '장풍 — 내민 손바닥 앞의 청록 기탄', rows(g))
g = badge('V', 'v')
for y in range(12):
    for x in range(12):
        d = math.hypot(x + 0.5 - 6, y + 0.5 - 8)
        if 1 <= x <= 10 and 1 <= y <= 9 and 3.6 < d <= 4.8 and y + 0.5 <= 8.5: g[y][x] = 'C'
        elif 1 <= x <= 10 and 1 <= y <= 9 and 4.8 < d <= 5.6 and y + 0.5 <= 8.5: g[y][x] = 'W'
put(g, ['PP', 'Pp'], 5, 6)
for x in range(1, 11): g[9][x] = 'c'
ICONS['sk-qiBarrier'] = ('', '기막 — 두 손을 감싸는 청록 반구 보호막', rows(g))
# 3차 궁극기 (금테 배지)
ICONS['sk-kingFist'] = ('', '패왕권 — 왕관을 쓴 거대한 금빛 주먹', rows(put(gold('r'), [
    ' Y Y Y    ',
    ' YYYYY    ',
    'LLLLLY    ',
    'LYLYLYy   ',
    'LLLLLLy W ',
    'LLLLLLy  W',
    'YLLLLyy W ',
    ' YYYyy    ',
    '  yyy     ',
    '          '], 1, 1)))
ICONS['sk-heavenWind'] = ('', '천풍각 — 하늘로 솟는 청록 회오리와 강철 정강이 발', rows(put(gold('k'), [
    ' WCCCCCCW ',
    '  CWCCWC  ',
    '  CCCCCC  ',
    '   CWWC   ',
    '   CCCC   ',
    '    CW    ',
    '    CC  SP',
    '   C   SSP',
    '       SS ',
    '          '], 1, 1)))
g = gold('v')
disc(g, 6, 4, 3.4, 'Y', ring='L'); disc(g, 6, 4, 2.2, 'v')
put(g, ['  BB  ', ' BBBB ', 'BBBBBB', 'BBWWBB', 'BBBBBB', 'bBBBBb'], 3, 4)
put(g, ['PP'], 5, 3)
ICONS['sk-qiGodDescent'] = ('', '기신 강림 — 금빛 후광을 진 기의 거인', rows(g))

for n, (e, d, r) in ICONS.items():
    assert len(r) == 12 and all(len(x) == 12 for x in r), (n, [len(x) for x in r])
with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    f.write("'use strict';\n// 파이터 계열 아이콘 (직업 이모지 대신 + 스킬 sk-<id> 10종). 생성: python -I -B dev/boxer/icons/gen.py (손 도트, 무료) — dev/make-icons.js 가 합친다\nmodule.exports = {\n")
    for n, (e, d, r) in ICONS.items():
        f.write(f"  '{n}': ['{e}', [   // {d}\n" + ''.join(f"    '{x}',\n" for x in r) + "  ]],\n")
    f.write('};\n')
print('icons', len(ICONS))
