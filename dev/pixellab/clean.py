# 배경 제거 찌꺼기 정리: 알파 있는 픽셀의 연결 덩어리 중 작은 것(<min) 지우기, 선택적으로 좌우 반전
import sys
from PIL import Image
src, dst, mn, flip = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4] == '1'
im = Image.open(src).convert('RGBA'); W, H = im.size; px = im.load()
seen = set(); comps = []
for y in range(H):
    for x in range(W):
        if px[x, y][3] > 20 and (x, y) not in seen:
            st = [(x, y)]; seen.add((x, y)); c = []
            while st:
                a, b = st.pop(); c.append((a, b))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        n = (a + dx, b + dy)
                        if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and px[n][3] > 20:
                            seen.add(n); st.append(n)
            comps.append(c)
comps.sort(key=len, reverse=True)
print('components', [len(c) for c in comps][:12])
big = len(comps[0])
for c in comps:
    lum = sum(sum(px[q][:3]) / 3 for q in c) / len(c)
    if c is not comps[0] and (len(c) < mn or lum < 90):
        for p in c: px[p] = (0, 0, 0, 0)
if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
im.save(dst)
