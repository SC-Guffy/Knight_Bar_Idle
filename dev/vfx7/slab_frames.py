# F26 땅 판: 키 그림(통판) → 4프레임 띠 (0 = 통판, 1~3 = 깨진 조각, 조각은 원래 자리에 그대로 — 코드가 벌려 떨어뜨린다)
#  python dev/vfx7/slab_frames.py raw/f26-key.png raw/f26-strip.png
import sys, numpy as np
from PIL import Image
key = np.array(Image.open(sys.argv[1]).convert('RGBA')); H, W = key.shape[:2]
rng = np.random.default_rng(5)
cuts = [W // 3, 2 * W // 3]
off = [[int(v) for v in np.cumsum(rng.integers(-1, 2, H)).clip(-3, 3)] for _ in cuts]   # 줄마다 들쭉날쭉한 금
out = np.zeros((H, W * 4, 4), np.uint8); out[:, :W] = key
for y in range(H):
    b = [0] + [c + o[y] for c, o in zip(cuts, off)] + [W]
    for k in range(3):
        x0, x1 = b[k], b[k + 1] - (1 if k < 2 else 0)        # 조각 사이 1칸 틈
        out[y, W * (k + 1) + x0: W * (k + 1) + x1] = key[y, x0:x1]
Image.fromarray(out, 'RGBA').save(sys.argv[2]); print(sys.argv[2])
