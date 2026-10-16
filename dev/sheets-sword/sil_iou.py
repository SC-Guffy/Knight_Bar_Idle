# 색깔놀이 검사 (로드맵 2026-10-17): 흑백 실루엣 IoU — 두 그림의 불투명 칸을 발 가운데·바닥에 맞춰 겹친 비율. 높을수록 실루엣이 같다
#  python -I -B sil_iou.py <a.png> <b.png> ...  → 첫 그림과 나머지 각각의 IoU
import sys
from PIL import Image


def mask(p):
    im = Image.open(p).convert('RGBA'); bb = im.getbbox(); im = im.crop(bb); P = im.load()
    W, H = im.size; return {(x - W // 2, y - H) for y in range(H) for x in range(W) if P[x, y][3] > 0}


def iou(a, b):
    return len(a & b) / max(1, len(a | b))


if __name__ == '__main__':
    base = mask(sys.argv[1])
    for p in sys.argv[2:]: print(f'{iou(base, mask(p)):.3f}', p)
