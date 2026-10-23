# 시트 명암 올리기 (마지막 49회 계획 1번, 유료 0): 외곽선 #0b0d14 는 두고, 나머지 칸의 밝기(HSV V)만 감마로 올린다.
#   python3 dev/spear/side49/brighten.py <cls> <gamma> [--install]   → 원본은 dev/spear/side49/<cls>/orig.png 에 한 번만 남긴다
import sys, os, colorsys, shutil
from PIL import Image
cls, g = sys.argv[1], float(sys.argv[2])
src = f'src/sprites/{cls}.png'; keep = f'dev/spear/side49/{cls}/orig.png'
os.makedirs(os.path.dirname(keep), exist_ok=True)
if not os.path.exists(keep): shutil.copy(src, keep)
im = Image.open(keep).convert('RGBA'); px = im.load(); OUT = (0x0b, 0x0d, 0x14)
for y in range(im.height):
    for x in range(im.width):
        r, gg, b, a = px[x, y]
        if not a or (r, gg, b) == OUT: continue
        h, s, v = colorsys.rgb_to_hsv(r / 255, gg / 255, b / 255)
        v2 = v ** g; s2 = s * (0.92 if v2 > v else 1)
        R, G, B = colorsys.hsv_to_rgb(h, s2, v2); px[x, y] = (round(R * 255), round(G * 255), round(B * 255), a)
dst = src if '--install' in sys.argv else f'dev/spear/side49/{cls}/bright-{g}.png'
im.save(dst); print('->', dst)
