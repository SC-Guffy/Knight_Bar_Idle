# 원본 그림 여러 장을 확대해 어두운 바탕에 한 줄로 (이름표 포함). python -I look.py out.png 배율 a.png b.png ...
import sys, os
from PIL import Image, ImageDraw
out, k = sys.argv[1], int(sys.argv[2]); fs = sys.argv[3:]
ims = [Image.open(f).convert('RGBA') for f in fs]
W = sum(i.width * k + 8 for i in ims); H = max(i.height * k for i in ims) + 16
M = Image.new('RGBA', (W, H), (30, 32, 44, 255)); d = ImageDraw.Draw(M); x = 0
for f, im in zip(fs, ims):
    M.alpha_composite(im.resize((im.width * k, im.height * k), Image.NEAREST), (x, 14)); d.text((x + 2, 1), os.path.basename(f)[:18], fill=(220, 220, 220)); x += im.width * k + 8
M.save(out); print(M.size)
