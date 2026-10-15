# PixelLab 애니 첫 프레임 (0회 준비): 부위색 마네킹 대기 그림 → dev/bowsheets/first/<원형>.png
#   mq-bow (96) · mq-xbow (96) · mq-siege-sh (128, 공성 석궁을 어깨 높이로 — 무기·손 칸을 위·뒤로 옮긴 합성, 아래팔은 올린 손까지 다시 잇는다)
#   python -I -B dev/bowsheets/first.py
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from dress import mannequin, classify, RAMP, OUT_C
OUT = os.path.join(HERE, 'first'); os.makedirs(OUT, exist_ok=True)

SH = (-2, -7)       # 공성 석궁·손을 옮기는 양 (어깨 거치)


def shoulder(im):
    M = classify(im); o = im.copy(); O = o.load(); W = im.width
    move = {p for p, (k, i) in M.items() if k in ('weapon', 'glove')}
    # 무기·손에 붙은 외곽선도 같이
    move |= {p for p, (k, i) in M.items() if k == 'line' and any((p[0] + a, p[1] + b) in move for a in (-1, 0, 1) for b in (-1, 0, 1))
             and not any(M.get((p[0] + a, p[1] + b), ('',))[0] in ('torso', 'helm', 'legs', 'boots') for a in (-1, 0, 1) for b in (-1, 0, 1))}
    src = {p: O[p] for p in move}
    for p in move: O[p] = (0, 0, 0, 0)
    gl = [p for p, (k, i) in M.items() if k == 'glove']
    # 아래팔: 손이 있던 자리 위쪽 몸통색 팔 칸을 손 높이까지 위로 늘인다 (팔 = 몸통 오른쪽 끝 열들)
    if gl:
        gx = round(sum(p[0] for p in gl) / len(gl)); gy = min(p[1] for p in gl)
        for x in range(gx - 4, gx + 1):
            col = [y for y in range(W) if M.get((x, y), ('',))[0] == 'torso']
            if not col: continue
            top = min(col)
            for y in range(top + SH[1], top):
                if 0 <= y < W and not O[x, y][3]: O[x, y] = RAMP['torso'][1] + (255,)
    for (x, y), c in src.items():
        q = (x + SH[0], y + SH[1])
        if 0 <= q[0] < W and 0 <= q[1] < W: O[q] = c
    return o


if __name__ == '__main__':
    for arch in ('mq-bow', 'mq-xbow'):
        mannequin(arch, 'stand').save(os.path.join(OUT, f'{arch}.png'))
    shoulder(mannequin('mq-siege', 'stand')).save(os.path.join(OUT, 'mq-siege-sh.png'))
    ims = [Image.open(os.path.join(OUT, n + '.png')).convert('RGBA') for n in ('mq-bow', 'mq-xbow', 'mq-siege-sh')]
    S = 4; o = Image.new('RGBA', (sum(i.width * S + 8 for i in ims), 128 * S), (30, 33, 42, 255)); x = 0
    for i in ims: o.alpha_composite(i.resize((i.width * S, i.height * S), Image.NEAREST), (x, (128 - i.height) * S)); x += i.width * S + 8
    o.save(os.path.join(OUT, '_preview.png')); print('ok')
