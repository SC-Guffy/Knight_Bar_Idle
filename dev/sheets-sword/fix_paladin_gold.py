# 성기사 면갑본(design/pl2/visor-paladin.png) 수리 (스크립트, PixelLab 0): 재검수 p2/p10 A·B 공통
#  "방패 십자가가 회색·금 장식이 안 보임·방패/몸통이 흰 덩어리로 붙음" → 방패 십자가 금색, 방패 면 한 단계 크림, 가슴 금 문장, 어깨 띠 금
#  python -I -B fix_paladin_gold.py → design/pl2/fix-paladin.png, design/_pal-fix-x8.png
import os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, 'design')
GOLD = (236, 186, 64, 255); GOLD_D = (178, 124, 36, 255); GOLD_L = (255, 226, 120, 255); FACE = (232, 224, 206, 255)
if __name__ == '__main__':
    src = Image.open(os.path.join(D, 'pl2', 'visor-paladin.png')).convert('RGBA'); im = src.copy(); P = im.load()
    # 방패: x 1..9, y 25..41 (왼팔 카이트 방패)
    for y in range(25, 42):
        for x in range(1, 10):
            c = P[x, y]
            if not c[3] or c[:3] == (11, 13, 20): continue
            if c[:3] in ((57, 54, 59),): P[x, y] = GOLD_D
            elif c[:3] in ((129, 122, 121), (86, 84, 88)): P[x, y] = GOLD
            elif c[:3] == (254, 253, 252): P[x, y] = FACE
    # 끊긴 십자 조각은 지우고 또렷한 십자(세로 x5 y29~38, 가로 y32 x3~7)를 새로 그림
    for y in range(25, 42):
        for x in range(1, 10):
            if P[x, y] in (GOLD, GOLD_D): P[x, y] = FACE
    for y in range(29, 39):
        if P[5, y][3] and P[5, y][:3] != (11, 13, 20): P[5, y] = GOLD
    for x in range(3, 8):
        if P[x, 32][3] and P[x, 32][:3] != (11, 13, 20): P[x, 32] = GOLD
    P[5, 32] = GOLD_L
    for y in range(29, 39):
        if P[6, y] == FACE and y != 32: P[6, y] = (206, 196, 176, 255)      # 십자 오른쪽 그늘 1줄
    # 가슴 금 십자 문장, 어깨 띠 금
    for x, y in ((16, 25), (16, 26), (16, 27), (15, 26), (17, 26)): P[x, y] = GOLD
    P[16, 25] = GOLD_L
    for x in range(13, 20):
        if P[x, 23][3] and P[x, 23][:3] != (11, 13, 20): P[x, 23] = GOLD
    im.save(os.path.join(D, 'pl2', 'fix-paladin.png'))
    S = 8; b = Image.new('RGBA', ((im.width * 2 + 6) * S, im.height * S), (38, 40, 50, 255))
    b.alpha_composite(src.resize((im.width * S, im.height * S), Image.NEAREST)); b.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), ((im.width + 6) * S, 0))
    b.save(os.path.join(D, '_pal-fix-x8.png')); print('ok')
