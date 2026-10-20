# 스킬 카드 아이콘 테두리 (docs/specs/skill-card-icons.md "규칙") — 장면 위 바깥 2px 를 덮는다.
#  1차 철테 · 2차/새 스킬 은테 · 궁극기 금테+모서리 장식. 모서리 한 칸은 깎는다(배지 모양).
from PIL import Image
INK = (11, 10, 20, 255)
METAL = {  # (위·왼쪽 밝음, 아래·오른쪽 그늘, 모서리 장식)
    1: ((143, 138, 168, 255), (94, 90, 120, 255), None),
    2: ((235, 231, 220, 255), (185, 180, 204, 255), None),
    3: ((255, 226, 130, 255), (168, 132, 46, 255), (255, 250, 220, 255)),
}

def frame(im, tier):
    im = im.convert('RGBA').copy()
    W, H = im.size
    hi, lo, orn = METAL[tier]
    px = im.load()
    for x in range(W):
        for y in range(H):
            edge = min(x, y, W - 1 - x, H - 1 - y)
            if edge == 0: px[x, y] = INK
            elif edge == 1: px[x, y] = hi if (x == 1 or y == 1) and x < W - 2 and y < H - 2 else lo
    for cx, cy in ((0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)):
        px[cx, cy] = (0, 0, 0, 0)
        px[1 if cx == 0 else W - 2, 1 if cy == 0 else H - 2] = INK
    if orn:   # 금테: 모서리마다 2×2 장식 + 위 가운데 보석
        for cx, cy in ((2, 2), (W - 4, 2), (2, H - 4), (W - 4, H - 4)):
            for dx in (0, 1):
                for dy in (0, 1): px[cx + dx, cy + dy] = orn if dx == dy == 0 else hi
        for dx in (-1, 0):
            px[W // 2 + dx, 1] = orn; px[W // 2 + dx, 2] = hi
    return im
