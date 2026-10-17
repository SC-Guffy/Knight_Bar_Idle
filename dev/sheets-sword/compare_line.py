# 같은 계열 합격작과 나란히 (로드맵 2026-10-17: 비평이 후했던 점 보정 — 검사·성기사 옆에 세워 디테일 밀도·시점·머리 비율 비교)
#  python -I -B compare_line.py <후보.png> <out.png> [더 세울 pl2 그림 ...]  → [검사 | 성기사 | (부모) | 후보] 4배 컬러 + 흑백 줄 + 1배
import sys, os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); PL = os.path.join(HERE, 'design', 'pl2')
REFS = ['clean-swordsman.png', 'fix-paladin.png']
BG = (38, 40, 50, 255)


def gray(im):
    g = im.convert('LA').convert('RGBA'); g.putalpha(im.split()[3]); return g


def row(ims, S, gap=8):
    H = max(i.height for i in ims); W = sum(i.width + gap for i in ims) + gap
    o = Image.new('RGBA', (W * S, (H + 4) * S), BG); x = gap
    for i in ims:
        o.alpha_composite(i.resize((i.width * S, i.height * S), Image.NEAREST), (x * S, (H + 2 - i.height) * S)); x += i.width + gap
    return o


if __name__ == '__main__':
    c = Image.open(sys.argv[1]).convert('RGBA'); c = c.crop(c.getbbox())
    ims = [Image.open(os.path.join(PL, f)).convert('RGBA') for f in REFS + sys.argv[3:]] + [c]   # argv[3:] = 더 세울 그림 (3차의 부모 등)
    a, b, s = row(ims, 4), row([gray(i) for i in ims], 4), row(ims, 1)
    o = Image.new('RGBA', (a.width, a.height + b.height + s.height + 8), BG)
    o.alpha_composite(a); o.alpha_composite(b, (0, a.height)); o.alpha_composite(s, (8, a.height + b.height + 4))
    o.save(sys.argv[2])
