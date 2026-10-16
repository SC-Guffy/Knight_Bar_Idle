# 대검전사 밑그림 2 (비평 N6/p3: 칼자루를 쥔 손이 없어 칼이 붙여 놓은 물체처럼 보임) — 두 주먹이 가슴 앞에서 자루를 쥐고,
#  코등이 위로 넓은 날이 오른 어깨를 지나 머리 뒤로 올라간다. 찡그린 눈썹, 밝은 강철 견갑·가슴판, 주황 허리띠.
#  칸 격자(60×56)에 그려 15배 → 1024 연회색 바탕. design.py gen N8 이 init 으로 쓴다.
#  python -I -B mannequin_gs2.py → design/mannequin-gs2.png, design/_mannequin-gs2-x6.png
import os, math
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, 'design')
GW, GH, S = 60, 56, 15
OUT = (11, 13, 20); SKIN = (232, 190, 150); HAIR = (34, 42, 84); HAIR2 = (60, 74, 130)
STEEL = (214, 220, 230); STEEL_M = (160, 168, 184); STEEL_D = (100, 108, 126)
LEATH = (122, 82, 52); LEATH_D = (88, 58, 38); BOOT = (64, 42, 30); ORANGE = (244, 142, 32); GRIP = (70, 40, 26); GLOVE = (104, 66, 40)


def draw():
    im = Image.new('RGBA', (GW, GH)); d = ImageDraw.Draw(im)
    # 칼날: 코등이(33,29)에서 위·뒤로 (-140도), 폭 7, 길이 34, 끝 뾰족, 가운데 홈
    g = (33, 29); a = math.radians(-140); u = (math.cos(a), math.sin(a)); n = (-u[1], u[0]); L, w = 34, 3.5
    p = lambda t, s: (g[0] + u[0] * t + n[0] * s, g[1] + u[1] * t + n[1] * s)
    d.polygon([p(1, -w), p(L - 6, -w), p(L, 0), p(L - 6, w), p(1, w)], fill=STEEL)
    d.polygon([p(1, 0.5), p(L - 6, 0.5), p(L - 1, 0), p(L - 6, w), p(1, w)], fill=STEEL_M)
    d.line([p(3, 0), p(L - 8, 0)], fill=STEEL_D, width=1)
    # 뒷다리·몸
    d.rectangle([27, 40, 31, 50], fill=LEATH_D); d.rectangle([26, 50, 32, 53], fill=BOOT)
    d.rectangle([25, 25, 40, 40], fill=LEATH)
    d.rectangle([28, 26, 40, 33], fill=STEEL); d.rectangle([28, 32, 40, 33], fill=STEEL_M)        # 가슴판
    d.rectangle([25, 36, 41, 38], fill=ORANGE)                                                       # 허리띠
    d.rectangle([34, 40, 39, 50], fill=LEATH); d.rectangle([34, 50, 42, 53], fill=BOOT)            # 앞다리
    d.ellipse([22, 22, 32, 30], fill=STEEL); d.ellipse([23, 27, 31, 30], fill=STEEL_M)             # 견갑
    # 머리 (키의 약 1/3)
    d.ellipse([22, 3, 45, 25], fill=SKIN)
    d.polygon([(21, 14), (22, 4), (27, 6), (29, 0), (33, 4), (37, 0), (40, 5), (45, 3), (45, 11), (40, 9), (33, 10), (27, 11), (25, 16)], fill=HAIR)
    d.line([(29, 3), (38, 6)], fill=HAIR2, width=1)
    d.rectangle([24, 13, 27, 17], fill=SKIN)                                                         # 귀
    d.line([(35, 12), (41, 14)], fill=OUT, width=2)                                                  # 찡그린 눈썹
    d.rectangle([38, 15, 39, 17], fill=OUT)                                                          # 눈
    d.line([(37, 21), (41, 20)], fill=OUT, width=1)                                                  # 입
    # 자루·주먹 (몸 앞)
    d.line([(33, 29), (40, 36)], fill=GRIP, width=3)
    gx = [p(0, -4.5), p(0, 4.5)]; d.line(gx, fill=STEEL_D, width=2)                                  # 코등이
    d.ellipse([33, 28, 38, 33], fill=GLOVE); d.ellipse([36, 31, 41, 36], fill=GLOVE)
    return im


def outline(im):
    o = Image.new('RGBA', im.size); P = im.load(); O = o.load(); W, H = im.size
    for y in range(H):
        for x in range(W):
            if P[x, y][3]: O[x, y] = P[x, y]
            elif any(0 <= x + a < W and 0 <= y + b < H and P[x + a, y + b][3] for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))): O[x, y] = OUT + (255,)
    return o


if __name__ == '__main__':
    im = outline(draw())
    big = im.resize((GW * S, GH * S), Image.NEAREST)
    bg = Image.new('RGBA', (1024, 1024), (200, 200, 204, 255)); bg.alpha_composite(big, ((1024 - big.width) // 2, 1024 - 60 - big.height))
    bg.convert('RGB').save(os.path.join(D, 'mannequin-gs2.png'))
    pv = Image.new('RGBA', im.size, (200, 200, 204, 255)); pv.alpha_composite(im); pv.resize((GW * 6, GH * 6), Image.NEAREST).save(os.path.join(D, '_mannequin-gs2-x6.png'))
    print('ok')
