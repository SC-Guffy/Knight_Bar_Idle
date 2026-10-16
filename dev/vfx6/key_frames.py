# ComfyUI 키 그림 → 도트 키 (외곽선 없음, 회색 램프) → 코드로 프레임 만들기 (커짐 → 뻗음 → 흩어짐)
#  python dev/vfx6/key_frames.py <src.png> <out-strip.png> <W> <H> <keyW> <keyH> [dx2 dx3]
import sys, os, numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'comfy'))
from post import to_grid, drop_small, render
from PIL import Image
GRAY = [(0x6e, 0x6e, 0x7a), (0x9a, 0x9a, 0xa6), (0xc6, 0xc6, 0xd0), (0xec, 0xec, 0xf2), (0xff, 0xff, 0xff)]
src, out, W, H, kw, kh = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:7])
dx2, dx3 = (int(sys.argv[7]), int(sys.argv[8])) if len(sys.argv) > 8 else (2, 4)
g, box, gain = to_grid(Image.open(src), (kw, kh), cov=0.45)
g = drop_small(g, 5)
key = render(g, GRAY, outline=False)
key.save(out.replace('.png', '-key.png'))

def place(im, s, dx, alpha_cut=None):
    w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    im = im.resize((w, h), Image.NEAREST)
    f = Image.new('RGBA', (W, H)); f.paste(im, ((W - w) // 2 + dx, (H - h) // 2), im)
    return f

def erode(im, k, seed=3):
    # 사라지는 프레임: 가장자리부터 2x2 덩어리로 깎고 밝은 단을 한 단 낮춘다
    a = np.array(im); al = a[..., 3] > 0; rng = np.random.default_rng(seed)
    for _ in range(k):
        e = al.copy(); e[1:] &= al[:-1]; e[:-1] &= al[1:]; e[:, 1:] &= al[:, :-1]; e[:, :-1] &= al[:, 1:]
        rim = al & ~e
        for y, x in zip(*np.nonzero(rim)):
            if rng.random() < 0.6: al[y:y + 2, x:x + 2] = False
    a[~al] = 0
    lv = {c: i for i, c in enumerate(GRAY)}
    for y, x in zip(*np.nonzero(al)):
        c = tuple(a[y, x, :3]); i = lv.get(c)
        if i is not None and i > 0: a[y, x, :3] = GRAY[i - 1]
    return Image.fromarray(a)

def clean(im, mn=5):
    a = np.array(im); g = np.where(a[..., 3] > 0, 0, -1); g = drop_small(g, mn); a[g < 0] = 0
    return Image.fromarray(a)

fr = [place(key, 0.75, -dx2), place(key, 1.0, 0), place(key, 1.0, dx2), erode(place(key, 1.0, dx3), 2)]
sheet = Image.new('RGBA', (W * len(fr), H))
for i, f in enumerate(fr): sheet.paste(clean(f), (i * W, 0))
sheet.save(out); print(out, sheet.size)
