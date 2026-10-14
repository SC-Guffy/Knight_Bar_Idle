# 전후 캡처를 스킬 하나당 한 장으로: 줄 = 단계(Lv1·★·★★·★★★), 칸 = before a·b·c | after a·b·c
#  python -I dev/vfx2/grid.py out.png <skill> [before태그] [after태그] [frames=abc]
import sys, os
from PIL import Image, ImageDraw
out, sk = sys.argv[1], sys.argv[2]
bt = sys.argv[3] if len(sys.argv) > 3 else 'before'; at = sys.argv[4] if len(sys.argv) > 4 else 'after'
fr = sys.argv[5] if len(sys.argv) > 5 else 'abc'
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'shots', 'vfx2')
cw, ch, sc = 720, 300, 0.5
W, H = int(cw * sc), int(ch * sc)
cols = [(bt, f) for f in fr] + [(at, f) for f in fr]
M = Image.new('RGB', (60 + len(cols) * (W + 4), 20 + 4 * (H + 4)), (24, 26, 34)); d = ImageDraw.Draw(M)
for ci, (t, f) in enumerate(cols): d.text((60 + ci * (W + 4) + 4, 4), f'{t} {f}', fill=(230, 230, 230))
for st in range(4):
    d.text((4, 20 + st * (H + 4) + H // 2), ['Lv1', '*1', '*2', '*3'][st], fill=(230, 230, 230))
    for ci, (t, f) in enumerate(cols):
        p = os.path.join(D, f'{t}-{sk}-s{st}-{f}.png')
        if os.path.exists(p): M.paste(Image.open(p).convert('RGB').resize((W, H), Image.NEAREST), (60 + ci * (W + 4), 20 + st * (H + 4)))
M.save(out)
