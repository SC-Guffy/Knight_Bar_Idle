"""낮은 띠 아래쪽의 '꽉 찬 땅 판' 줄을 깎는다 (게임 자체 땅 위에 물체만 서 있게). 맨 아래 KEEP 줄은 남긴다.
usage: trimground.py in.png out.png [fill_ratio=0.9] [keep=2]"""
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGBA')
R = float(sys.argv[3]) if len(sys.argv) > 3 else 0.9
KEEP = int(sys.argv[4]) if len(sys.argv) > 4 else 2
w, h = im.size
a = im.getchannel('A').load()
ratio = lambda y: sum(1 for x in range(w) if a[x, y]) / w
full = lambda y: ratio(y) >= R
# 맨 아래 빈 줄(생성 이미지 바닥의 하늘색 여백)부터 걷어낸다 — 안 그러면 띠가 땅에서 떠 보인다
while h > 1 and ratio(h - 1) < 0.6:
    h -= 1
im = im.crop((0, 0, w, h))
y = h - 1
while y > 0 and full(y): y -= 1
slab = h - 1 - y                  # 아래에서 연속으로 꽉 찬 줄 수
cut = max(0, slab - KEEP)
if cut:
    im = im.crop((0, 0, w, h - cut))
im.save(sys.argv[2])
print(sys.argv[1], 'slab', slab, 'cut', cut, im.size)
