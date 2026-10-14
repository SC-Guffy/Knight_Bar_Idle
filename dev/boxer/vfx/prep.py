# 키 그림 손질 (애니 넣기 전): python -I prep.py in.png out.png [--black] [--outline] [--flip] [--min N]
import sys
from PIL import Image
a = sys.argv[1:]; src, dst = a[0], a[1]
im = Image.open(src).convert('RGBA'); W, H = im.size; px = im.load()
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
for y in range(H):
    for x in range(W):
        c = px[x, y]
        if c[3] < 128 or ('--black' in a and max(c[:3]) <= 8): px[x, y] = (0, 0, 0, 0)
        else: px[x, y] = c[:3] + (255,)
mn = int(a[a.index('--min') + 1]) if '--min' in a else 0
if mn:
    seen = set()
    for y in range(H):
        for x in range(W):
            if px[x, y][3] and (x, y) not in seen:
                st = [(x, y)]; seen.add((x, y)); comp = []
                while st:
                    p, q = st.pop(); comp.append((p, q))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            n = (p + dx, q + dy)
                            if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and px[n][3]: seen.add(n); st.append(n)
                if len(comp) < mn:
                    for p in comp: px[p] = (0, 0, 0, 0)
if '--outline' in a:
    add = [(x, y) for y in range(H) for x in range(W) if not px[x, y][3] and any(0 <= x + dx < W and 0 <= y + dy < H and px[x + dx, y + dy][3] for dx, dy in N4)]
    for p in add: px[p] = (11, 13, 20, 255)
if '--flip' in a: im = im.transpose(Image.FLIP_LEFT_RIGHT)
im.save(dst)
