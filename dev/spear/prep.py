# 기존 게임 그림(1배, 160칸 발 (80,140)) → 시트 칸 크기 기준 그림. 반투명(빛번짐)은 지운다.
#   python -I prep.py <cls> <pose> <size> <footx> <footy>  → ref/<cls>-<pose>-<size>.png
import sys, os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
cls, pose, S, fx, fy = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
im = Image.open(os.path.join(HERE, 'shots', f'{cls}-{pose}.png')).convert('RGBA')
im = im.crop((80 - fx, 140 - fy, 80 - fx + S, 140 - fy + S))
px = im.load()
for y in range(S):
    for x in range(S):
        c = px[x, y]
        px[x, y] = c[:3] + (255,) if c[3] >= 160 else (0, 0, 0, 0)
os.makedirs(os.path.join(HERE, 'ref'), exist_ok=True)
im.save(os.path.join(HERE, 'ref', f'{cls}-{pose}-{S}.png'))
print(im.getbbox())
