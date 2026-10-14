# 변형 64장 밀착 시트 (번호 라벨). python -I contact.py <prefix> <out.png> [scale]
import sys, os, glob
from PIL import Image, ImageDraw
pre, out = sys.argv[1], sys.argv[2]; S = int(sys.argv[3]) if len(sys.argv) > 3 else 3
fs = sorted(glob.glob(pre + '-*.png'), key=lambda p: int(p.rsplit('-', 1)[1][:-4]))
ims = [Image.open(f).convert('RGBA') for f in fs]
w = max(i.width for i in ims); h = max(i.height for i in ims); cols = 8
o = Image.new('RGBA', (cols * (w + 2), ((len(ims) + cols - 1) // cols) * (h + 8)), (20, 22, 29, 255))
for k, (f, im) in enumerate(zip(fs, ims)):
    x, y = (k % cols) * (w + 2), (k // cols) * (h + 8) + 8
    o.alpha_composite(im, (x, y))
o = o.resize((o.width * S, o.height * S), Image.NEAREST); d = ImageDraw.Draw(o)
for k, f in enumerate(fs):
    d.text(((k % cols) * (w + 2) * S + 2, (k // cols) * (h + 8) * S + 2), f.rsplit('-', 1)[1][:-4], fill=(255, 220, 90))
o.save(out)
