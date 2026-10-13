# 생성 그림(검은 바탕, 1024px) → 도트 텍스처 후처리
#  1) 바탕 떼기: 테두리 중앙값을 바탕색으로 보고, 그 색에서 먼 픽셀만 남긴다
#  2) 도트 격자로 줄이기: 칸마다 덮인 비율이 cov 이상이면 칠하고, 색은 칸 안 최빈 밝기 단계 (평균 금지 — 뭉개짐)
#  3) 램프 깎기: 밝기를 levels 단으로 나눠 RAMP 로 칠한다 (게임은 이 밝기로 직업색을 다시 칠함)
#  4) 작은 덩어리 지우기 → 바깥 외곽선 (#0b0d14) → 투명 배경 PNG
# 여러 프레임은 box(원본 좌표 자르기 상자)를 같이 써야 크기·위치가 프레임끼리 맞는다.
import numpy as np
from PIL import Image

OUTLINE = (0x0b, 0x0d, 0x14)
# PixelLab 시험(W1b·H1·C1)에서 뽑은 흰~하늘색 램프, 어두운 쪽부터
RAMP5 = [(0x2f, 0x4d, 0x64), (0x4f, 0x77, 0x99), (0x8f, 0xb0, 0xcf), (0xc8, 0xdc, 0xef), (0xf6, 0xf9, 0xfe)]
RAMP4 = [RAMP5[0], RAMP5[2], RAMP5[3], RAMP5[4]]


def fg_mask(im, thr=48):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    d = np.sqrt(((a - bg) ** 2).sum(-1))
    return a, d > thr


def bbox(mask, pad=0.02):
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return (0, 0, mask.shape[1], mask.shape[0])
    # 드문 잡점에 상자가 끌려가지 않게 0.2% 끝을 버린다
    x0, x1 = np.percentile(xs, [0.2, 99.8]); y0, y1 = np.percentile(ys, [0.2, 99.8])
    p = pad * max(mask.shape)
    return (int(max(0, x0 - p)), int(max(0, y0 - p)), int(min(mask.shape[1], x1 + p + 1)), int(min(mask.shape[0], y1 + p + 1)))


def union(boxes):
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


def fit_box(box, size, img_wh):
    """상자를 목표 비율(외곽선 1칸 여유 포함)에 맞게 넓힌다."""
    W, H = size[0] - 2, size[1] - 2
    x0, y0, x1, y1 = box; bw, bh = x1 - x0, y1 - y0
    s = max(bw / W, bh / H)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return (cx - s * W / 2, cy - s * H / 2, cx + s * W / 2, cy + s * H / 2)


def lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


# 밝기 단계 나누는 분위수 (어두운 쪽부터 칸 비율 15·20·25·20·20%). 생성물은 흰색이 넓게 번져서
# 고정 밝기로 자르면 거의 흰색 한 단이 된다 → 그림 안 밝기 순위로 나눠 램프를 고르게 쓴다.
QUANT = {5: [0.15, 0.35, 0.6, 0.8], 4: [0.2, 0.5, 0.78]}


def to_grid(im, size, box=None, thr=48, cov=0.4, levels=5, gain=None):
    """도트 격자 (H,W) 단계 배열을 돌려준다. -1 = 투명. 그리고 실제 쓴 box·단계 경계(gain)."""
    a, m = fg_mask(im, thr)
    if box is None:
        box = bbox(m)
    fb = fit_box(box, size, im.size)
    L = lum(a)
    if gain is None:  # 여러 프레임은 기준 프레임의 경계를 같이 쓴다
        gain = list(np.quantile(L[m], QUANT[levels])) if m.any() else [50, 100, 150, 200][:levels - 1]
    q = np.digitize(L, gain)
    W, H = size[0] - 2, size[1] - 2
    out = -np.ones((size[1], size[0]), int)
    sx = (fb[2] - fb[0]) / W; sy = (fb[3] - fb[1]) / H
    for j in range(H):
        for i in range(W):
            xa, xb = int(round(fb[0] + i * sx)), int(round(fb[0] + (i + 1) * sx))
            ya, yb = int(round(fb[1] + j * sy)), int(round(fb[1] + (j + 1) * sy))
            xa, ya = max(xa, 0), max(ya, 0); xb, yb = min(xb, im.size[0]), min(yb, im.size[1])
            if xb <= xa or yb <= ya:
                continue
            mm = m[ya:yb, xa:xb]
            if mm.mean() < cov:
                continue
            out[j + 1, i + 1] = np.bincount(q[ya:yb, xa:xb][mm], minlength=levels).argmax()
    return out, box, gain


def drop_small(g, mn=3):
    H, W = g.shape; seen = np.zeros_like(g, bool)
    for y in range(H):
        for x in range(W):
            if g[y, x] >= 0 and not seen[y, x]:
                st = [(y, x)]; seen[y, x] = True; comp = []
                while st:
                    a, b = st.pop(); comp.append((a, b))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            c, d = a + dy, b + dx
                            if 0 <= c < H and 0 <= d < W and not seen[c, d] and g[c, d] >= 0:
                                seen[c, d] = True; st.append((c, d))
                if len(comp) < mn:
                    for a, b in comp:
                        g[a, b] = -1
    return g


def render(g, ramp=RAMP5, outline=True):
    H, W = g.shape
    out = np.zeros((H, W, 4), np.uint8)
    for k, c in enumerate(ramp):
        out[g == k] = (*c, 255)
    if outline:
        o = g >= 0
        n = np.zeros_like(o)
        n[1:] |= o[:-1]; n[:-1] |= o[1:]; n[:, 1:] |= o[:, :-1]; n[:, :-1] |= o[:, 1:]
        out[n & ~o] = (*OUTLINE, 255)
    return Image.fromarray(out, 'RGBA')


def post(im, size, box=None, gain=None, thr=48, cov=0.4, levels=5, mn=3, outline=True, cap=None):
    g, box, gain = to_grid(im, size, box, thr, cov, levels, gain)
    g = drop_small(g, mn)
    if cap is not None:  # 사라지는 프레임은 밝은 단을 깎는다 (코드가 맡는 색 램프 조절)
        g[g > cap] = cap
    return render(g, RAMP5 if levels == 5 else RAMP4, outline), box, gain


def sheet(frames):
    w, h = frames[0].size
    s = Image.new('RGBA', (w * len(frames), h))
    for i, f in enumerate(frames):
        s.paste(f, (i * w, 0))
    return s


def clean_bg(im, thr=48):
    """바탕(회색·그림자 포함)을 순수 검정으로 바꾼다. img2img 기준 그림에 쓴다."""
    a, m = fg_mask(im, thr)
    a = a.copy(); a[~m] = 0
    return Image.fromarray(a.astype(np.uint8))


def split_sheet(im, n, thr=48):
    """한 장에 그린 n 프레임을 빈 열 기준으로 나눈다. 안 되면 같은 폭으로 자른다."""
    _, m = fg_mask(im, thr)
    col = m.sum(0) > 2
    runs, x = [], 0
    W = len(col)
    while x < W:
        if col[x]:
            x0 = x
            while x < W and col[x]: x += 1
            runs.append([x0, x])
        x += 1
    # 가까운 덩어리 합치기 (틈 < 폭의 1.5%) → n 개가 될 때까지 가장 좁은 틈부터 합친다
    while len(runs) > n:
        gaps = [runs[i + 1][0] - runs[i][1] for i in range(len(runs) - 1)]
        i = int(np.argmin(gaps)); runs[i][1] = runs[i + 1][1]; del runs[i + 1]
    if len(runs) != n:
        w = W // n
        return [im.crop((i * w, 0, (i + 1) * w, im.size[1])) for i in range(n)], False
    cs = [(r[0] + r[1]) // 2 for r in runs]
    half = max(max(r[1] - r[0] for r in runs) // 2 + 4, 8)
    return [im.crop((c - half, 0, c + half, im.size[1])) for c in cs], True
