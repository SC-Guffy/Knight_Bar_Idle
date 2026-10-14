# 가운데 비우기: (cx, cy) 에서 시작해 어두운 픽셀(밝기 < thr)을 따라 퍼지며 지운다 (오라·고리처럼 안이 검게 채워진 키 그림용)
#  python -I hollow.py in.png out.png cx cy [thr=80]
import sys
from PIL import Image
src, dst, cx, cy = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
thr = int(sys.argv[5]) if len(sys.argv) > 5 else 80
im = Image.open(src).convert('RGBA'); W, H = im.size; px = im.load()
dark = lambda c: c[3] < 128 or sum(c[:3]) / 3 < thr
st = [(cx, cy)]; seen = {(cx, cy)}; n = 0
while st:
    x, y = st.pop()
    if not dark(px[x, y]): continue
    px[x, y] = (0, 0, 0, 0); n += 1
    for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        q = (x + d[0], y + d[1])
        if 0 <= q[0] < W and 0 <= q[1] < H and q not in seen: seen.add(q); st.append(q)
print('cleared', n); im.save(dst)
