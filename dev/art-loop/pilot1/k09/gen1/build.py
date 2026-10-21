# k09 gen1: vfx_workbench slash_trail(facing100 flatten.35 sweep1.1 thick1.6) 렌더를 받아 48x32x5 시트로
import numpy as np
from PIL import Image
f = np.load('frames8.npy')
W, H, OY = 48, 32, 9
BLUE = [77, 166, 255]; WHITE = [255, 255, 255]; PALE = [191, 227, 255]
def cell(i):
    src = f[i].copy()
    dark = (src[..., :3] == [4, 13, 26]).all(-1) & (src[..., 3] > 0)
    src[dark, :3] = BLUE          # 검은 외곽선 -> 직업색 테
    out = np.zeros((H, W, 4), np.uint8)
    c = src[4:18, 4:52]
    out[OY:OY + 14, :c.shape[1]] = c
    return out
frames = [cell(i) for i in (1, 2, 3, 4)]
# 5번째: 4번째를 1픽셀 침식 + 가운데 줄만 남겨 가늘게 사라짐, 왼쪽 머리는 점선으로 끊김
e = cell(4)
a = e[..., 3] > 0
er = a.copy()
er[1:-1, 1:-1] = a[1:-1, 1:-1] & a[:-2, 1:-1] & a[2:, 1:-1] & a[1:-1, :-2] & a[1:-1, 2:]
# 침식으로 사라지는 오른쪽 가는 꼬리는 한 줄로 남긴다
for x in range(W):
    col = np.nonzero(a[:, x])[0]
    if len(col) and not er[:, x].any() and x > 20:
        er[col[len(col)//2], x] = True
for y in range(H):
    for x in range(0, 16):
        if (x + y) % 2 == 0 or x < 5: er[y, x] = False
e[~er, 3] = 0
m = e[..., 3] > 0
e[m & (e[..., :3] == WHITE).all(-1), :3] = PALE
frames.append(e)
# 쇳조각 4개: 2번째 프레임에 충돌점(30,15)에서 튀어나가 천천히 날아감 (마름모 4~5픽셀)
chips = [((1.3, -1.6), 'a'), ((2.0, -0.6), 'b'), ((-1.2, -1.5), 'b'), ((0.9, 1.3), 'a')]
shape = {'a': [(1, 0, PALE), (0, 1, WHITE), (1, 1, WHITE), (2, 1, BLUE), (1, 2, BLUE)],
         'b': [(0, 0, WHITE), (1, 0, PALE), (1, 1, WHITE), (2, 1, BLUE)]}
ox, oy = 30, 14
for fi in range(1, 5):
    t = fi * 2.0
    for (vx, vy), s in chips:
        x = int(round(ox + vx * t)); y = int(round(oy + vy * t + 0.06 * t * t))
        for dx, dy, col in shape[s]:
            if fi == 4 and col == WHITE: col = PALE
            if 0 <= x + dx < W and 0 <= y + dy < H:
                frames[fi][y + dy, x + dx, :3] = col; frames[fi][y + dy, x + dx, 3] = 255
sheet = np.concatenate(frames, 1)
Image.fromarray(sheet).save('out.png')
print(sheet.shape)
