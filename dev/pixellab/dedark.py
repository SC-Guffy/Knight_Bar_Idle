# 밝은 이펙트에서 멀리 떨어진 어두운 찌꺼기(배경 원 흔적) 지우기
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGBA'); W, H = im.size; px = im.load()
L = lambda c: sum(c[:3]) / 3
rm = []
for y in range(H):
    for x in range(W):
        c = px[x, y]
        if c[3] > 20 and L(c) < 90:
            near = any(0 <= x+dx < W and 0 <= y+dy < H and px[x+dx, y+dy][3] > 20 and L(px[x+dx, y+dy]) > 140
                       for dx in range(-2, 3) for dy in range(-2, 3))
            if not near: rm.append((x, y))
for q in rm: px[q] = (0, 0, 0, 0)
print('removed', len(rm)); im.save(sys.argv[2])
