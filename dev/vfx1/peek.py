# 키 그림·시트 미리보기: python -I peek.py out.png [배율] 파일...  (어두운 바탕 + 회색 바탕 두 줄, 이름 표시)
import sys, os
from PIL import Image, ImageDraw
out = sys.argv[1]; z = int(sys.argv[2]); fs = sys.argv[3:]
ims = [Image.open(f).convert('RGBA') for f in fs]
cw = max(i.width for i in ims) * z + 8; ch = max(i.height for i in ims) * z + 14
cols = max(1, min(len(ims), 1400 // cw)); rows = (len(ims) + cols - 1) // cols
sh = Image.new('RGBA', (cols * cw, rows * ch * 2), (24, 26, 34, 255)); d = ImageDraw.Draw(sh)
for k, (f, im) in enumerate(zip(fs, ims)):
    x, y = (k % cols) * cw, (k // cols) * ch * 2
    d.rectangle([x, y + ch, x + cw - 1, y + 2 * ch - 1], fill=(120, 140, 110, 255))
    big = im.resize((im.width * z, im.height * z), Image.NEAREST)
    for yy in (y + 12, y + ch + 12): sh.alpha_composite(big, (x + 4, yy))
    d.text((x + 3, y), os.path.basename(f)[:28], fill=(255, 255, 0, 255))
sh.save(out); print(out, sh.size)
