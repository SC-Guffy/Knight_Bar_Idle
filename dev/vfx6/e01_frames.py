# E01 하늘 강철검: ComfyUI 키 → 도트 (외곽선 없음, 회색 램프) → 3프레임 낙하 + 위쪽 잔상 (한 단 어둡게)
import sys, os, numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'comfy'))
from post import to_grid, drop_small, render
from PIL import Image
GRAY = [(0x6e, 0x6e, 0x7a), (0x9a, 0x9a, 0xa6), (0xc6, 0xc6, 0xd0), (0xec, 0xec, 0xf2), (0xff, 0xff, 0xff)]
W, H = 32, 96
g, _, _ = to_grid(Image.open(sys.argv[1]), (26, 78), cov=0.45)
g = drop_small(g, 5)
key = render(g, GRAY, outline=False)

def dim(im, k):
    a = np.array(im); lv = {c: i for i, c in enumerate(GRAY)}
    for y, x in zip(*np.nonzero(a[..., 3])):
        i = lv.get(tuple(a[y, x, :3]))
        if i is not None: a[y, x, :3] = GRAY[max(0, i - k)]
    return Image.fromarray(a)

def frame(dy, ghosts):
    f = Image.new('RGBA', (W, H))
    for gy, k in ghosts:   # 잔상: 칼을 위로 gy 만큼 올려 k 단 어둡게, 칼 뒤에
        f.alpha_composite(dim(key, k), ((W - key.width) // 2, dy - gy))
    f.alpha_composite(key, ((W - key.width) // 2, dy))
    return f

fr = [frame(0, []), frame(9, [(9, 2)]), frame(16, [(8, 1), (16, 3)])]
sheet = Image.new('RGBA', (W * 3, H))
for i, f in enumerate(fr): sheet.paste(f, (i * W, 0))
sheet.save(sys.argv[2]); print(sys.argv[2], sheet.size, 'key', key.size)
