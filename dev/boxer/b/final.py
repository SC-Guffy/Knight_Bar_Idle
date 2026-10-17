# 합격 기준 그림 → final/<cls>.png (무료 수리만: 발밑 그림자·받침 띠 줄 지우기, 비평 r1·r2 지적)
#  python -I -B dev/boxer/b/final.py
import os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); PL = os.path.join(HERE, 'pl'); FIN = os.path.join(HERE, 'final')
OUT = (11, 13, 20, 255)
CUT = {'striker': 1, 'grandmaster': 2}          # 맨 아래에서 지울 줄 수 (회색 그림자 띠 · 장삼 아래 빛 받침)
PASS = ['fighter', 'striker', 'kickboxer', 'qigong', 'tempest', 'grandmaster']   # 챔피언: 2라운드 미달 → 멈춤 (지금 시트 유지)


def outline_bottom(im):
    P = im.load(); W, H = im.size; y = H - 1
    for x in range(W):
        if P[x, y][3] and P[x, y] != OUT: P[x, y] = OUT
    return im


if __name__ == '__main__':
    os.makedirs(FIN, exist_ok=True)
    for c in PASS:
        im = Image.open(os.path.join(PL, f'clean-{c}.png')).convert('RGBA')
        k = CUT.get(c, 0)
        if k: im = outline_bottom(im.crop((0, 0, im.width, im.height - k)))
        im = im.crop(im.getbbox()); im.save(os.path.join(FIN, f'{c}.png')); print(c, im.size)
