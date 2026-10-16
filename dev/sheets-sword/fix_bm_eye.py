# 검성 N7-77 46칸 축소본 수리 (스크립트, PixelLab 0): 비평 p4 b1·b2 공통 "흰 가면에 빨간 눈 틈이 없음"
#  가면의 어두운 눈 두 점을 지우고 가로 한 줄 진홍 눈 틈을 찍는다.  python -I -B fix_bm_eye.py → design/pl2/fix-blademaster-n7.png
import os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, 'design')
if __name__ == '__main__':
    im = Image.open(os.path.join(D, 'px', 'blademaster-N7-77-h46.png')).convert('RGBA'); P = im.load()
    W = P[24, 14]                                              # 가면 흰색
    for x in (22, 23): P[x, 14] = W
    for x in range(23, 30): P[x, 15] = (200, 16, 24, 255)
    im.save(os.path.join(D, 'pl2', 'fix-blademaster-n7.png'))
    # 2차 (비평 p5-B 등 공통: 왼손 칼에 빨간 꼬리·검은 덩어리가 붙어 깃발처럼 읽힘) → 칼 둘레만 남기고 지운 뒤 칼날을 위로 4칸 늘림
    OUT = (8, 12, 20, 255); LIT = (252, 252, 248); MID = (128, 136, 164)
    q = lambda c: tuple(v // 4 * 4 for v in c[:3])
    for y in range(22, 35):
        for x in range(0, 12):
            if P[x, y][3] and q(P[x, y]) not in (LIT, MID): P[x, y] = (0, 0, 0, 0)
    for k, y in enumerate(range(25, 29)):
        x = k + 1; P[x, y] = LIT + (255,); P[x + 1, y] = MID + (255,)
    blade = [(x, y) for y in range(22, 36) for x in range(0, 16) if P[x, y][3] and q(P[x, y]) in (LIT, MID)]
    for x, y in blade:
        for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if 0 <= x + a < im.width and 0 <= y + b < im.height and not P[x + a, y + b][3]: P[x + a, y + b] = OUT
    # 몸 (비평 p5-A·B 공통): 등 뒤 거의 검정(32,48,68) → 한 단계 밝게, 가슴판·치마판 윗변 밝은 테두리, 다리 밝은 줄무늬 → 다리색
    for y in range(im.height):
        for x in range(im.width):
            if P[x, y][3] and q(P[x, y]) == (32, 48, 68): P[x, y] = (54, 70, 94, 255)
    HI = (104, 124, 152, 255)
    for y, x0, x1 in ((25, 14, 32), (34, 16, 31)):
        for x in range(x0, x1):
            if P[x, y][3] and q(P[x, y]) == (64, 84, 108): P[x, y] = HI
    for y in range(37, 43):
        for x in range(im.width):
            if P[x, y][3] and q(P[x, y]) == MID: P[x, y] = (72, 92, 116, 255)
    im.save(os.path.join(D, 'pl2', 'fix2-blademaster-n7.png'))
    S = 8; b = Image.new('RGBA', (im.width * S, im.height * S), (38, 40, 50, 255)); b.alpha_composite(im.resize(b.size, Image.NEAREST)); b.save(os.path.join(D, '_bm77-fix-x8.png'))  # (2차 결과 기준)
    print('ok')
