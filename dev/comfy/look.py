# 후보를 한눈에 보는 밀착 시트: 원본 축소본 위, 후처리 도트(4배) 아래, 어두운 바탕.
#   python dev/comfy/look.py <출력.png> <glob 패턴 (out/cand 또는 out/anim 기준)>
import sys, os, glob
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
BG = (17, 20, 28)
dst, pat = sys.argv[1], sys.argv[2]
sub = 'anim' if '-anim' in pat or '-sheet' in pat else 'cand'
files = sorted(glob.glob(os.path.join(HERE, 'out', sub, pat)))
cells = []
for f in files:
    name = os.path.splitext(os.path.basename(f))[0]
    px = Image.open(f).convert('RGBA')
    big = px.resize((px.size[0] * 4, px.size[1] * 4), Image.NEAREST)
    th = os.path.join(HERE, 'out', 'thumb', name + '.jpg')
    t = Image.open(th).convert('RGB') if os.path.exists(th) else None
    if t is not None and t.size[0] > 256:
        t = t.resize((256, int(t.size[1] * 256 / t.size[0])))
    w = max(big.size[0], t.size[0] if t else 0) + 8
    h = 14 + (t.size[1] + 4 if t else 0) + big.size[1] + 4
    c = Image.new('RGB', (w, h), BG); d = ImageDraw.Draw(c)
    d.text((2, 1), name, fill=(200, 200, 210))
    y = 14
    if t:
        c.paste(t, (4, y)); y += t.size[1] + 4
    c.paste(big, (4, y), big)
    cells.append(c)
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
rows = [cells[i:i + cols] for i in range(0, len(cells), cols)]
W = max(sum(c.size[0] for c in r) for r in rows); H = sum(max(c.size[1] for c in r) for r in rows)
out = Image.new('RGB', (W, H), BG); y = 0
for r in rows:
    x = 0
    for c in r:
        out.paste(c, (x, y)); x += c.size[0]
    y += max(c.size[1] for c in r)
out.save(dst); print(dst, out.size, len(cells))
