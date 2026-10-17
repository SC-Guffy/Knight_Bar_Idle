# ComfyUI 시안(검은 바탕) → 제 색을 지키는 도트 키 그림 ('raw' 시트용: 흙·풀·쇠·나무처럼 여러 색이 섞인 물체)
#  python dev/vfx7/rawkey.py <src.png> <out.png> <W> <H> [colors=8] [cov=0.45]
#  1) 바탕 떼기 (dev/comfy/post.py fg_mask) → 물체 상자에 맞춰 W×H 칸으로 나눔 (가로세로 비율 유지, 가운데)
#  2) 칸마다 덮인 비율이 cov 이상이면 칠하고, 색은 칸 안 픽셀의 중앙값 (평균은 뭉개짐)
#  3) 팔레트를 colors 개로 줄임 (median cut) → 4픽셀 이하 덩어리 지움
#  4) 둘레(투명에 닿은) 픽셀이 너무 어두우면(밝기 0.27 미만) 같은 색상으로 밝힘 — 로더가 검은 테로 보고 벗기지 않게
import sys, os
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'comfy'))
from post import fg_mask, bbox


def rawkey(src, W, H, colors=8, cov=0.45):
    im = Image.open(src)
    a, m = fg_mask(im)
    x0, y0, x1, y1 = bbox(m, pad=0.01)
    bw, bh = x1 - x0, y1 - y0
    cell = max(bw / W, bh / H)
    gw, gh = int(round(bw / cell)), int(round(bh / cell))
    ox, oy = (W - gw) // 2, (H - gh) // 2
    out = np.zeros((H, W, 4), np.uint8)
    for j in range(gh):
        for i in range(gw):
            sx0, sy0 = int(x0 + i * cell), int(y0 + j * cell)
            sx1, sy1 = max(sx0 + 1, int(x0 + (i + 1) * cell)), max(sy0 + 1, int(y0 + (j + 1) * cell))
            mm = m[sy0:sy1, sx0:sx1]
            if mm.size == 0 or mm.mean() < cov:
                continue
            px = a[sy0:sy1, sx0:sx1][mm]
            out[oy + j, ox + i, :3] = np.median(px, axis=0).astype(np.uint8)
            out[oy + j, ox + i, 3] = 255
    img = Image.fromarray(out, 'RGBA')
    rgb = img.convert('RGB').quantize(colors=colors, method=Image.Quantize.MEDIANCUT).convert('RGB')
    q = np.array(rgb); al = out[..., 3] > 0
    res = np.zeros_like(out); res[..., :3] = q; res[..., 3] = np.where(al, 255, 0)
    drop_crumbs(res)
    lift_edges(res)
    return Image.fromarray(res, 'RGBA')


def drop_crumbs(a, mn=4):
    H, W = a.shape[:2]; seen = np.zeros((H, W), bool)
    for y in range(H):
        for x in range(W):
            if seen[y, x] or a[y, x, 3] == 0:
                continue
            st, comp = [(x, y)], []; seen[y, x] = True
            while st:
                cx, cy = st.pop(); comp.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < W and 0 <= ny < H and not seen[ny, nx] and a[ny, nx, 3]:
                            seen[ny, nx] = True; st.append((nx, ny))
            if len(comp) <= mn:
                for cx, cy in comp:
                    a[cy, cx, 3] = 0


def lift_edges(a, lo=0.27):
    H, W = a.shape[:2]
    for y in range(H):
        for x in range(W):
            if not a[y, x, 3]:
                continue
            edge = any(not (0 <= x + dx < W and 0 <= y + dy < H) or not a[y + dy, x + dx, 3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            r, g, b = [int(v) for v in a[y, x, :3]]
            l = (0.3 * r + 0.59 * g + 0.11 * b) / 255
            if edge and l < lo:
                k = (lo + 0.03) / max(l, 0.02)
                if max(r, g, b) < 30:
                    a[y, x, :3] = (78, 74, 84)
                else:
                    a[y, x, :3] = [min(255, int(v * k)) for v in (r, g, b)]


if __name__ == '__main__':
    src, out, W, H = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    colors = int(sys.argv[5]) if len(sys.argv) > 5 else 8
    cov = float(sys.argv[6]) if len(sys.argv) > 6 else 0.45
    rawkey(src, W, H, colors, cov).save(out)
    print(out)
