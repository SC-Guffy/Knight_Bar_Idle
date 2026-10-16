# 다시 뽑기(2026-10-16): 게임 캡처 전/후(세 장면씩 세로로 이은 것) → 바뀐 자리만 잘라 나란히 (왼쪽 전 · 오른쪽 후)
#   python3 dev/vfx5/compare.py <before.png> <after.png> <out.png>
import sys
from PIL import Image, ImageChops
b = Image.open(sys.argv[1]).convert('RGB'); a = Image.open(sys.argv[2]).convert('RGB'); W, H = b.size; h = H // 3
rows = []
for k in range(3):
    bb, aa = b.crop((0, k * h, W, (k + 1) * h)), a.crop((0, k * h, W, (k + 1) * h))
    rows.append((bb, aa, ImageChops.difference(aa, bb).convert('L').point(lambda v: 255 if v > 24 else 0).getbbox() or (0, 0, W, h)))
x0 = max(0, min(r[2][0] for r in rows) - 40); x1 = min(W, max(r[2][2] for r in rows) + 40)
y0 = max(0, min(r[2][1] for r in rows) - 30); y1 = min(h, max(r[2][3] for r in rows) + 30)
cw, ch = x1 - x0, y1 - y0; out = Image.new('RGB', (cw * 2 + 12, ch * 3 + 16), (20, 22, 31))
for k, (bb, aa, _) in enumerate(rows):
    out.paste(bb.crop((x0, y0, x1, y1)), (0, k * (ch + 8))); out.paste(aa.crop((x0, y0, x1, y1)), (cw + 12, k * (ch + 8)))
sc = min(1, 1100 / out.width); out.resize((int(out.width * sc), int(out.height * sc))).save(sys.argv[3])
