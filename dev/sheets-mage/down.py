# 게임 캡처(1칸 = 3px, 96칸 캔버스, 발 48·88)를 1칸 = 1px 로 줄이고 발을 시트 기준점 (44, 88)로 옮긴다: cap/cap3-*.png → cap/cap1-*.png
import os, glob
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
for p in glob.glob(os.path.join(HERE, 'cap', 'cap3-*.png')):
    im = Image.open(p).convert('RGBA'); w, h = im.width // 3, im.height // 3
    o = Image.new('RGBA', (w, h)); src, dst = im.load(), o.load()
    for y in range(h):
        for x in range(w):
            sx = x + 4                                   # 캡처 발 x 48 → 시트 발 x 44
            c = src[3 * sx + 1, 3 * y + 1] if sx < w else (0, 0, 0, 0)
            dst[x, y] = c[:3] + (255,) if c[3] >= 128 else (0, 0, 0, 0)
    o.save(p.replace('cap3-', 'cap1-'))
