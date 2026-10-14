# 변형 몇 장을 크게 (번호 라벨). python -I pick.py <prefix> out.png n1 n2 ...
import sys
from PIL import Image, ImageDraw
pre, out, ns = sys.argv[1], sys.argv[2], sys.argv[3:]
S = 5; o = Image.new('RGBA', (44 * len(ns), 50), (20, 22, 29, 255))
for k, n in enumerate(ns): o.alpha_composite(Image.open(f'{pre}-{n}.png').convert('RGBA'), (44 * k, 8))
o = o.resize((o.width * S, o.height * S), Image.NEAREST); d = ImageDraw.Draw(o)
for k, n in enumerate(ns): d.text((44 * k * S + 4, 4), n, fill=(255, 220, 90))
o.save(out)
