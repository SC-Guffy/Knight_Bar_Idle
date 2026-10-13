# 파이터 계열 기준 그림 (손도트, 1도트 = 캐릭터 고해상 칸 = 화면 1.5px). 레인저 도트(22×26 몸통 + 다리)를 틀로 삼았다.
#   python -I dev/boxer/draw.py  →  dev/boxer/base-<id>.png (64×64, 발 가운데 = (32, 58))
import os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_W, OUT_H, FOOT = 64, 64, (32, 58)

def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)

BASE_PAL = {
    '0': '#0b0d14',
    'a': '#f0c29a', 'b': '#ac8b6e', 'c': '#f4d4b8',  # 살
    'd': '#1b1d27', 'e': '#ffffff',                  # 눈
}

def render(rows, pal, name):
    P = {k: hexrgb(v) for k, v in {**BASE_PAL, **pal}.items()}
    w = max(len(r) for r in rows); h = len(rows)
    im = Image.new('RGBA', (OUT_W, OUT_H), (0, 0, 0, 0))
    # 발 가운데: 가장 아래 줄의 색 칸 범위 가운데
    last = rows[-1]; xs = [i for i, ch in enumerate(last) if ch != '.']
    fx = (xs[0] + xs[-1]) // 2 if xs else w // 2
    ox, oy = FOOT[0] - fx, FOOT[1] - (h - 1)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == '.': continue
            if ch not in P: raise SystemExit(f'{name}: 팔레트에 없는 글자 {ch!r} ({x},{y})')
            im.putpixel((ox + x, oy + y), P[ch])
    im.save(os.path.join(HERE, f'base-{name}.png'))
    return im

# ── 1차 파이터: 짧은 뻗친 머리 + 붉은 머리띠(매듭 꼬리는 뒤로), 흰 반팔, 붕대 감은 두 주먹을 얼굴 앞에, 남색 반바지, 맨다리, 운동화
FIGHTER = [
    ".......0..0..0..........",
    "......0h00h00h00........",
    ".....0hhhhhhhhhhh0......",
    "....0hhHhhHhhHhhhh0.....",
    "....0hhhhhhhhhhhhhh0....",
    "..0rr0rrrrrrrrrrrrrr0...",
    ".0rRhhhhaaaaaaaaab00....",
    "0R0.hhhhaaaaaaaaaac0....",
    "...0hhhhaadeaaadeab0....",
    "...0hhhbaaadaaaddb0.....",
    "...0hhbbaaaaaaaaab0.....",
    "...00hbbaaaaaaaaab0.....",
    "......00aaaaaaaaab0.....",
    ".......0aaaaaaaaa00000..",
    "......0wwwwwwwwwa0xxxX0.",
    "....0wwwwwwwwwwaaaxxxX0.",
    "....0wwwwwwwwwwab0XXXX0.",
    "....0Wwwwwwwww0xxxX0....",
    "....0WWwwwwwaaaxxxX0....",
    "....0WWwwwwwbb0XXXX0....",
    "....0WWwwwwwww0000......",
    "....0WWwwwwwwwW0........",
    "....0yyyyyyyyyy0........",
    "....0ppppppppppP0.......",
    "....0ppppppPpppP0.......",
    "....0Ppppp0PpppP0.......",
    "....0PPpP0.0PppP0.......",
    ".....0aa0...0aa0........",
    ".....0ab0...0ab0........",
    ".....0ab0...0ab0........",
    "....0kkk0...0kkk0.......",
    "....0kkkK0..0kkkK0......",
    "....0KKKK0..0KKKK0......",
    ".....0000....0000.......",
]
# 잽 끝 자세 (PixelLab animate 의 last_frame 으로 넣는다): 앞팔을 끝까지 뻗고 몸이 반 칸 앞으로 기운다
FIGHTER_JAB = FIGHTER[:13] + [
    ".......0aaaaaaaaa0..........",
    "......0wwwwwwwwwwa0000000.0000",
    "....0wwwwwwwwwwwaaaaaaaa0xxxX0",
    "....0wwwwwwwwwwwbbbbbbbbb0xxxX0",
    "....0Wwwwwwwww00000000000XXXX0",
    "....0WWwwwwwaaaxxxX0.....0000",
    "....0WWwwwwwbb0XXXX0",
    "....0WWwwwwwww0000",
] + FIGHTER[21:]
FIGHTER_PAL = {'h': '#2a2230', 'H': '#4a4058', 'r': '#d8343a', 'R': '#8a1a20', 'w': '#ece6d6', 'W': '#b8ae9a',
               'x': '#ffffff', 'X': '#c9c2b4', 'y': '#ffd257', 'p': '#2f4a9a', 'P': '#1f2f66', 'k': '#e8e2d4', 'K': '#8a2a24'}

# ── 스트라이커: 위가 무거운 역삼각형 — 짧게 깎은 평머리, 넓은 어깨·맨팔, 검은 민소매 + 챔피언 벨트, 몸통 절반만 한 강철 건틀릿 두 개
STRIKER = [
    "",
    "",
    ".....0000000000000",
    "....0hhhhhhhhhhhhh0",
    "....0hHhHhHhHhHhhhh0",
    "....0hhhhhhhhhhhhhh0",
    "....0hhhaaaaaaaaaab0",
    "....0hhhaaaaaaaaaac0",
    "....0hhhaadeaaadeab0",
    "....0hhbaaadaaaddb0",
    "....0hbbaaaaaaaaab0",
    "....00bbaaaaaaaaab0.000000",
    "......00aaabbbaaab00qggggG0",
    "..00000.0aaaaaaa00qgggggggG0",
    ".0aaaaa0ttttttta0qgggggggggG0",
    "0aaaaaattttttttaa0gGgggGgggG0",
    "0aaaaattttttttaaa0ggggggggGG0",
    "0baaaatttttttaa0qggggGGGGGG0",
    ".0bbaatttttt0qgggggG0GGGG00",
    "..00bbtttttt0gggggggG0000",
    "....0ttttttt0gGggggGG0",
    "....0ttttttt0GGGGGGG0",
    "....0YYYYYYYY0000000",
    "....0YyYYYyYY0",
    "....0ppppppppP0",
    "....0pppp0ppppP0",
    "....0Ppp0.0pppP0",
    "....0aa0...0aa0",
    "....0ab0...0ab0",
    "....0ab0...0ab0",
    "...0kkk0...0kkk0",
    "...0kkkK0..0kkkK0",
    "...0KKKK0..0KKKK0",
    "....0000....0000",
]
STRIKER_PAL = {'h': '#1e1a22', 'H': '#3a3440', 't': '#22232b', 'Y': '#ffd257', 'y': '#c9302c', 'p': '#8a1f24', 'P': '#5a1418',
               'g': '#9aa3b2', 'G': '#4a4e5a', 'q': '#e3e8ef', 'k': '#2a2a30', 'K': '#0f0f14'}

# ── 킥복서: 아래가 넓은 삼각형 — 뒤로 길게 흐르는 묶은 머리, 맨상체에 가슴 붕대, 넓은 도복 바지 + 허리띠, 앞다리를 들어 올린 자세, 맨발, 정강이 철갑
KICKBOXER = [
    "",
    ".......000000",
    "......0hhhhhh00",
    ".....0hHhhHhhhhh0",
    "....0hhhhhhhhhhhh0",
    "...0hhhhhhhhhhhhhh0",
    "..0hhhhhhaaaaaaaab0",
    ".0hh0hhhhaaaaaaaac0",
    "0hh0.0hhhaadeaadeab0",
    "0h0..0hhbaaadaaddb0",
    "0h0..0hbbaaaaaaaab0",
    "0hh0.00bbaaaaaaaab0",
    ".0hh0..00aaaaaaab0",
    "..0hh0..0aaaaaa00",
    "...0h0.0aaaaaaaa0.000",
    "....0.0aaxxxxxxa00xxX0",
    "......0axxxxxxxaaaxxX0",
    "......0aaaxxxaaab0XXX0",
    "......0baaaaaaa0xxX0",
    ".......0baaaaaab0XX0",
    ".......0bbaaaabb000",
    ".......0rrrrrrrr0",
    "......0wwwwwwwwwww0",
    ".....0wwwwwwwWwwwwww000",
    "....0wwwwwwWW0wwwwwwwgg0",
    "...0wwwwwwwW0.0WwwwwggGG0",
    "..0wwwwwwwwW0..00WWgggG0",
    "..0WwwwwwwWW0....0aaab00",
    "...0WWwWWWW0.....0aab0",
    "....0gggG0........000",
    "....0gggG0",
    "....0aaab00",
    "...0aaaaab0",
    "....000000",
]
KICK_PAL = {'h': '#3a2418', 'H': '#6a4430', 'x': '#f4f1e8', 'X': '#c9c2b4', 'r': '#2a2a30', 'w': '#f0ece0', 'W': '#b9b2a2',
            'g': '#8c95a6', 'G': '#4a5160'}

# ── 기공사: 늘어진 소매의 사각 가운 — 단발 + 흰 머리띠, 넓은 소매 도복이 발목까지, 염주 목걸이, 앞으로 내민 손바닥
QIGONG = [
    "",
    "",
    "......000000000",
    ".....0hhhhhhhhh00",
    "....0hhHhhhHhhhhh0",
    "....0xxxxxxxxxxxxx0",
    "...0hhxxxxxxxxxxxX0",
    "...0hhhhaaaaaaaaac0",
    "...0hhhhaadeaaadeab0",
    "...0hhhbaaadaaaddb0",
    "...0hhhbaaaaaaaaab0",
    "...0hhhbbaaaaaaaab0",
    "....0hh00aaaaaaab0",
    "......00baaaaaa00",
    ".....00mMmMmMmMm00",
    "...00uuuuummmmuuuu0..0000",
    "..0uuuuuuuummuuuuuuu0aaac0",
    ".0uuuuuuuuuuuuuuuuuuuuaaab0",
    "0uuuuuuuUuuuuuuuuuuuuu0bb0",
    "0uuuuuuUUuuuuuuuuuuuuu00",
    "0UuuuuuUU0uuuuuuuuUUU0",
    "0UUuuuUUU0uuuuuuuuUU0",
    ".0UUUUUU00uuuuuuuuu0",
    "..000000.0vvvvvvvvv0",
    ".........0uuuuuuuuu0",
    "........0uuuuuuuuuuu0",
    "........0uuuuUuuuuuu0",
    ".......0uuuuuUUuuuuuu0",
    ".......0uuuuUU0uuuuuu0",
    "......0uuuuuUU0uuuuuuu0",
    "......0UUuuUUU0UuuuuUU0",
    "......0UUUUUU00UUUUUUU0",
    ".......0kkkk0..0kkkkk0",
    "........0000....00000",
]
QI_PAL = {'h': '#1a1a26', 'H': '#3a3a52', 'x': '#f4f1e8', 'X': '#c9c2b4', 'u': '#5a6fc0', 'U': '#33428a', 'v': '#e8dcc0',
          'm': '#8a5a2b', 'M': '#ffd257', 'k': '#2a2a30'}

if __name__ == '__main__':
    for rows, pal, name in [(FIGHTER, FIGHTER_PAL, 'fighter'), (FIGHTER_JAB, FIGHTER_PAL, 'fighter-jab'), (STRIKER, STRIKER_PAL, 'striker'), (KICKBOXER, KICK_PAL, 'kickboxer'), (QIGONG, QI_PAL, 'qigong')]:
        render(rows, pal, name)
    print('ok')
