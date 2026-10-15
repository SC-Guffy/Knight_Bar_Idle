# 프레임 → GIF (어두운 바탕, 배율): python -I gif.py <출력.gif> <배율> <fps> <crop x0,y0,x1,y1|-> <프레임...>
import sys
from PIL import Image
out, S, fps, cb = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
fr = []
for f in sys.argv[5:]:
    im = Image.open(f).convert('RGBA')
    if cb != '-': im = im.crop(tuple(int(v) for v in cb.split(',')))
    b = Image.new('RGBA', im.size, (0x14, 0x16, 0x1d, 255)); b.alpha_composite(im)
    fr.append(b.convert('RGB').resize((im.width * S, im.height * S), Image.NEAREST))
fr[0].save(out, save_all=True, append_images=fr[1:], duration=round(1000 / fps), loop=0, disposal=1)
