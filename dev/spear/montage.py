# 여러 PNG 를 격자로 모아 확대 (검은 회색 바탕). python -I montage.py out.png scale cols a.png b.png ...
import sys
from PIL import Image
out, sc, cols, fs = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4:]
ims = [Image.open(f).convert('RGBA') for f in fs]
w = max(i.width for i in ims); h = max(i.height for i in ims); rows = (len(ims) + cols - 1) // cols
M = Image.new('RGBA', (cols * (w + 2), rows * (h + 2)), (60, 62, 70, 255))
for k, im in enumerate(ims):
    M.alpha_composite(im, ((k % cols) * (w + 2), (k // cols) * (h + 2)))
M.resize((M.width * sc, M.height * sc), Image.NEAREST).save(out)
