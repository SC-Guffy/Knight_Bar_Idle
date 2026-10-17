# 대검전사 15차 37번 수리 (스크립트, PixelLab 0): 비평 r15 g37 A·B 공통 "대검 날이 어두운 남보라라 몸·망토와 붙음"
#  날 칸(48,40,64 계열) → 강철 3단: 가운데 중간, 위 가장자리 밝게, 아래 가장자리 어둡게.  python -I -B fix_gs15.py → design/pl2/final-greatswordsman-n15.png 덮어씀
import os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, 'design')
L, M, K = (214, 220, 232, 255), (156, 164, 184, 255), (98, 106, 128, 255)
q = lambda c: tuple(v // 8 * 8 for v in c[:3])
if __name__ == '__main__':
    im = Image.open(os.path.join(D, 'px', 'greatswordsman-N15-37-h46.png')).convert('RGBA'); P = im.load(); W, H = im.size
    blade = {(x, y) for y in range(10, 21) for x in range(30, W) if P[x, y][3] and q(P[x, y]) == (48, 40, 64)}
    for x, y in blade:
        up = (x, y - 1) not in blade and q(P[x, y - 1]) != (248, 248, 248)
        dn = (x, y + 1) not in blade
        P[x, y] = L if up else K if dn else M
    im.save(os.path.join(D, 'pl2', 'final-greatswordsman-n15.png')); print('blade px', len(blade))
