# 작업 그림 여러 장을 나란히 (4배, 어두운 바탕, 발 기준선 표시). python -I view.py out.png a.png b.png ...
import sys
from PIL import Image, ImageDraw
out, fs = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert('RGBA') for f in fs]
W = max(i.width for i in ims); H = max(i.height for i in ims)
o = Image.new('RGBA', ((W + 2) * len(ims), H), (20, 22, 29, 255))
for k, i in enumerate(ims): o.alpha_composite(i, ((W + 2) * k, 0))
S = 4; o = o.resize((o.width * S, o.height * S), Image.NEAREST); d = ImageDraw.Draw(o)
if H == 64:
    for k in range(len(ims)):
        x0 = (W + 2) * k * S; d.line([(x0, 59 * S), (x0 + 64 * S, 59 * S)], fill=(70, 70, 90)); d.line([(x0 + 32 * S + 2, 60 * S), (x0 + 32 * S + 2, 63 * S)], fill=(200, 80, 80))
o.save(out)
