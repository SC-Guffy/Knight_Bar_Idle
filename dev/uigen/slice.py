"""AI 생성 창 테두리 → 9-slice 픽셀 PNG.
usage: slice.py in.png out.png cell corner_cells edge_cells colors
- 마젠타 바깥을 잘라 테두리 bbox 를 찾고, cell(px) 격자로 칸마다 최빈색 복원
- 네 모서리 corner_cells×corner_cells 를 그대로 쓰고, 변은 각 변의 1/4 지점에서 edge_cells 길이만큼 떼어 붙인다
  (변 가운데 장식을 피하려고 1/4 지점)
- 결과: (2c+e)×(2c+e) PNG. 안쪽은 투명 (border-image 는 가운데를 안 쓴다)
"""
import sys
from collections import Counter
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
CELL, C, E, NCOL = float(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6])

im = Image.open(src).convert('RGB')
p = im.load()
W, H = im.size
mag = lambda c: (c[0] > 150 and c[2] > 150 and c[1] < 120) or (c[0] > 90 and c[2] > 90 and c[0] - c[1] > 50 and c[2] - c[1] > 50)
xs = [x for x in range(W) if any(not mag(p[x, y]) for y in range(0, H, 3))]
ys = [y for y in range(H) if any(not mag(p[x, y]) for x in range(0, W, 3))]
im = im.crop((xs[0], ys[0], xs[-1] + 1, ys[-1] + 1))
W, H = im.size
# 원본 전체를 양자화하면 바탕 남색이 팔레트를 먹어 철판·나뭇결이 뭉개진다 → 칸 최빈색은 반올림 색으로 고르고, 양자화는 결과(작은 이미지)에만
qp = im.load()
RND = 8
rnd = lambda c: tuple(min(255, (v + RND // 2) // RND * RND) for v in c)
NW, NH = round(W / CELL), round(H / CELL)
cw, ch = W / NW, H / NH

def cellcol(gx, gy):
    cnt = Counter(rnd(qp[x, y]) for y in range(int(gy * ch), int((gy + 1) * ch)) for x in range(int(gx * cw), int((gx + 1) * cw)))
    return cnt.most_common(1)[0][0]

grid = [[cellcol(x, y) for x in range(NW)] for y in range(NH)]
S = 2 * C + E
outim = Image.new('RGBA', (S, S), (0, 0, 0, 0))
op = outim.load()

def put(dx, dy, sx, sy):
    c = grid[sy][sx]
    # 바깥 마젠타·안쪽 창 바탕색(#1b1a2b 근처)은 투명 → 모서리 칸이 내용 영역에 겹쳐도 창 배경이 비친다
    inner = abs(c[0] - 27) < 14 and abs(c[1] - 26) < 14 and abs(c[2] - 43) < 16
    op[dx, dy] = c + ((0,) if mag(c) or inner else (255,))

ex, ey = NW // 4, NH // 4
for y in range(S):
    for x in range(S):
        # 출력 좌표 → 원본 격자 좌표
        if x < C: sx = x
        elif x >= C + E: sx = NW - (S - x)
        else: sx = ex + (x - C)
        if y < C: sy = y
        elif y >= C + E: sy = NH - (S - y)
        else: sy = ey + (y - C)
        if C <= x < C + E and C <= y < C + E: continue   # 가운데
        put(x, y, sx, sy)
alpha = outim.getchannel('A')
rgb = outim.convert('RGB').quantize(colors=NCOL, method=Image.Quantize.MAXCOVERAGE, dither=Image.Dither.NONE).convert('RGBA')
rgb.putalpha(alpha)
outim = rgb
outim.save(out)
print(out, (NW, NH), 'cell', round(cw, 2))
