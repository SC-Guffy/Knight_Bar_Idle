# 원형 애니 몸 움직임 검사 (로드맵 검수 ④, 0회): 덧그리기 전 마네킹 프레임에서 지팡이 칸을 빼고
#  첫 프레임(넣은 그림) 대비 몸 실루엣 겹침(IoU)·손 이동·머리 이동(칸)을 잰다 → mq/_motion.png (몸만, 지팡이 칸은 회색)
import os, sys, math
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'sheets-common'))
import pipeline as pl, mannequin as m

M0 = pl.keep_main(pl.build.tidy(Image.open(os.path.join(HERE, 'mq', 'staff.png')).convert('RGBA'), pl.RAMP_PAL))


def parts_of(F):
    mp = m.classify(F)
    body = {p for p, (k, i) in mp.items() if k not in m.STF}
    hand = [p for p, (k, i) in mp.items() if k == 'hand']
    head = m.biggest([p for p, (k, i) in mp.items() if k == 'head'])
    return mp, body, hand, head


_, b0, h0, hd0 = parts_of(M0)
c = lambda ps: m.centroid(ps) if ps else (0, 0)
rows, lines = [], []
for k in pl.MOVES:
    fr = pl.frames(os.path.join(HERE, 'work', 'mq'), k); row = []
    for i, F in enumerate(fr):
        mp, b, h, hd = parts_of(F)
        iou = len(b & b0) / max(1, len(b | b0))
        dh = math.dist(c(h), c(h0)); dhead = math.dist(c(hd), c(hd0))
        lines.append(f'{k}{i}: 몸 겹침 {iou:.2f} · 손 이동 {dh:.1f} · 머리 이동 {dhead:.1f}')
        im = Image.new('RGBA', F.size); P, Q = F.load(), im.load()
        for p, (kk, ii) in mp.items(): Q[p] = P[p] if kk not in m.STF else (90, 90, 100, 255)
        row.append((im, iou, dh, dhead))
    rows.append((k, row))
S, C = 3, (20, 40, 80, 92); W, H = C[2] - C[0], C[3] - C[1]
out = Image.new('RGBA', (60 + W * S * 8, (H * S + 14) * len(rows)), (18, 20, 27, 255)); d = ImageDraw.Draw(out)
for r, (k, row) in enumerate(rows):
    y = r * (H * S + 14); d.text((4, y + 4), k, fill=(255, 220, 90))
    for i, (im, iou, dh, dhead) in enumerate(row):
        out.alpha_composite(im.crop(C).resize((W * S, H * S), Image.NEAREST), (60 + W * S * i, y))
        d.text((60 + W * S * i + 2, y + H * S), f'IoU{iou:.2f} 손{dh:.0f} 머리{dhead:.0f}', fill=(170, 176, 196))
out.save(os.path.join(HERE, 'mq', '_motion.png'))
print('\n'.join(lines))
